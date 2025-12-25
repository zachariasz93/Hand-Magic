import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { GestureType, CameraDevice } from '../types';
import { detectGesture } from '../utils/gestureLogic';

// Configuration
const PARTICLE_COUNT = 25000;
const BOUNDS = 80;
const CAMERA_Z = 100;

interface Props {
  onGestureChange: (gesture: GestureType) => void;
  onFpsUpdate: (fps: number) => void;
  onCamerasFound: (devices: CameraDevice[]) => void;
  selectedCameraId: string | null;
}

const HandParticlesScene: React.FC<Props> = ({ 
  onGestureChange, 
  onFpsUpdate, 
  onCamerasFound, 
  selectedCameraId 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusText, setStatusText] = useState("Initializing Vision...");
  const hasEnumeratedDevices = useRef(false);

  const requestRef = useRef<number>(0);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    camera: THREE.PerspectiveCamera | null;
    scene: THREE.Scene | null;
    composer: EffectComposer | null;
  }>({
    renderer: null,
    camera: null,
    scene: null,
    composer: null
  });

  const loopState = useRef({
      lastTime: performance.now(),
      frameCount: 0,
      lastFpsTime: 0
  });

  // Refs for animation loop to avoid closures capturing old state
  const sceneState = useRef({
    particles: null as THREE.Points | null,
    positions: null as Float32Array | null,
    velocities: null as Float32Array | null,
    homePositions: null as Float32Array | null,
    colors: null as Float32Array | null,
    handPosition: new THREE.Vector3(0, 0, 0),
    handVelocity: new THREE.Vector3(0, 0, 0),
    isHandPresent: false,
    gesture: GestureType.NONE,
    gestureStrength: 0,
    time: 0,
    doublePalmTimer: 0,
    isStreamReady: false
  });

  const animate = useCallback(() => {
      const { renderer, composer, camera } = threeRef.current;
      if (!renderer || !composer || !camera) return;

      const now = performance.now();
      const dt = Math.min((now - loopState.current.lastTime) / 1000, 0.1); // Cap delta time
      loopState.current.lastTime = now;

      // FPS Calculation
      loopState.current.frameCount++;
      if (now - loopState.current.lastFpsTime >= 1000) {
        onFpsUpdate(Math.round(loopState.current.frameCount * 1000 / (now - loopState.current.lastFpsTime)));
        loopState.current.frameCount = 0;
        loopState.current.lastFpsTime = now;
      }

      sceneState.current.time += dt;

      // Physics Logic
      const { 
        particles, positions, velocities, homePositions, colors, 
        handPosition, isHandPresent, gesture, gestureStrength, time 
      } = sceneState.current;

      if (!particles || !positions || !velocities || !homePositions || !colors) return;

      const positionAttr = particles.geometry.attributes.position;
      const colorAttr = particles.geometry.attributes.color;

      // Interaction params
      const mouse = handPosition;
      
      // Dynamic Logic based on Gesture
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const px = positions[i3];
        const py = positions[i3 + 1];
        const pz = positions[i3 + 2];
        
        let vx = velocities[i3];
        let vy = velocities[i3 + 1];
        let vz = velocities[i3 + 2];

        // Return to home force (Memory)
        const hx = homePositions[i3];
        const hy = homePositions[i3 + 1];
        const hz = homePositions[i3 + 2];

        const distHomeX = hx - px;
        const distHomeY = hy - py;
        const distHomeZ = hz - pz;

        // Base attraction to home
        vx += distHomeX * 1.5 * dt;
        vy += distHomeY * 1.5 * dt;
        vz += distHomeZ * 1.5 * dt;

        // Hand Interaction
        if (isHandPresent) {
          const dx = px - mouse.x;
          const dy = py - mouse.y;
          const dz = pz - mouse.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          const dist = Math.sqrt(distSq);

          // 1. OPEN HAND: Swirl
          if (gesture === GestureType.OPEN_HAND) {
            if (dist < 40) {
              const force = (40 - dist) * 1.5;
              vx += -dy * force * 0.5 * dt;
              vy += dx * force * 0.5 * dt;
              vz += Math.sin(time * 5 + i) * force * dt;
              
              // Gentle attraction
              vx -= dx * 2.0 * dt;
              vy -= dy * 2.0 * dt;
              vz -= dz * 2.0 * dt;
            }
          } 
          // 2. FIST: Repel (Explosion)
          else if (gesture === GestureType.CLOSED_FIST) {
            if (dist < 50) {
              const force = (50 - dist) * 20.0; // Strong Repel
              const dirX = dx / dist;
              const dirY = dy / dist;
              const dirZ = dz / dist;
              
              vx += dirX * force * dt;
              vy += dirY * force * dt;
              vz += dirZ * force * dt;
            }
          }
          // 3. PINCH: Suction
          else if (gesture === GestureType.PINCH) {
             // Strong attraction to center
             if (dist < 60) {
                const strength = 150 * gestureStrength;
                vx -= dx * strength * dt;
                vy -= dy * strength * dt;
                vz -= dz * strength * dt;
             }
          }
          // 4. VICTORY: Wave + Rainbow
          else if (gesture === GestureType.VICTORY) {
            if (dist < 40) {
               // Sine wave lift
               vy += Math.sin(px * 0.2 + time * 10) * 20 * dt;
            }
          }
          // 5. THUMBS UP: Heart/Orbit Shape
          else if (gesture === GestureType.THUMBS_UP) {
             if (dist < 40) {
               // Lissajous orbit
               const tx = Math.sin(time * 3 + i * 0.1) * 20;
               const ty = Math.cos(time * 3 + i * 0.1) * 20;
               vx += (mouse.x + tx - px) * 5 * dt;
               vy += (mouse.y + ty - py) * 5 * dt;
             }
          }
          // 6. ROCK ON: Chaos
          else if (gesture === GestureType.ROCK_ON) {
             if (dist < 60) {
               vx += (Math.random() - 0.5) * 200 * dt;
               vy += (Math.random() - 0.5) * 200 * dt;
               vz += (Math.random() - 0.5) * 200 * dt;
             }
          }
          else {
            // Passive repulse just a bit to not clip through hand
            if (dist < 15) {
               const force = (15 - dist) * 10;
               vx += (dx / dist) * force * dt;
               vy += (dy / dist) * force * dt;
               vz += (dz / dist) * force * dt;
            }
          }

          // Color Updates
          if (gesture === GestureType.VICTORY) {
             // Rainbow wave
             const hue = (time * 0.2 + px * 0.01) % 1;
             const c = new THREE.Color().setHSL(hue, 0.8, 0.6);
             colors[i3] = c.r;
             colors[i3+1] = c.g;
             colors[i3+2] = c.b;
          } else if (gesture === GestureType.PINCH) {
             // Red/Orange heat
             const intensity = Math.min(1, 40 / (dist + 1));
             colors[i3] = 1.0;
             colors[i3+1] = 1.0 - intensity;
             colors[i3+2] = 1.0 - intensity;
          } else {
             // Reset slowly to gradient
             if (Math.random() < 0.05) {
                 colors[i3] = homePositions[i3] > 0 ? 0 : 1; 
                 colors[i3+1] = 0.8;
                 colors[i3+2] = 1;
             }
          }
        }

        // Apply friction
        vx *= 0.92;
        vy *= 0.92;
        vz *= 0.92;

        positions[i3] += vx * dt;
        positions[i3 + 1] += vy * dt;
        positions[i3 + 2] += vz * dt;

        velocities[i3] = vx;
        velocities[i3 + 1] = vy;
        velocities[i3 + 2] = vz;
      }

      positionAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      // Auto Orbit Camera if hand near edge
      if (isHandPresent) {
         const screenX = mouse.x / BOUNDS; // approx -1 to 1
         if (Math.abs(screenX) > 0.8) {
            camera.position.x += screenX * 100 * dt;
            camera.lookAt(0,0,0);
         }
      } else {
        // Gentle idle orbit
        const t = now * 0.0001;
        camera.position.x = Math.sin(t) * 20;
        camera.position.y = Math.cos(t * 0.7) * 20;
        camera.lookAt(0, 0, 0);
      }

      composer.render();
  }, [onFpsUpdate]);

  const predict = useCallback(() => {
      // Ensure video is playing and has size
      if (videoRef.current && videoRef.current.videoWidth > 0 && landmarkerRef.current && sceneState.current.isStreamReady) {
        try {
            const results = landmarkerRef.current.detectForVideo(videoRef.current, performance.now());
            
            if (results.landmarks && results.landmarks.length > 0) {
              sceneState.current.isHandPresent = true;
              
              // Use first hand for main interaction
              const landmarks = results.landmarks[0];
              
              // Map normalized (0-1) coordinates to 3D world space
              // Inverting X because webcam is mirrored usually
              const x = (0.5 - landmarks[9].x) * BOUNDS * 2.5; 
              const y = (0.5 - landmarks[9].y) * BOUNDS * 2.5;
              // Z estimation (MediaPipe Z is relative to wrist, not absolute depth easily)
              const z = -landmarks[9].z * BOUNDS * 2; 
    
              const targetPos = new THREE.Vector3(x, y, z);
              
              // Smooth hand movement
              sceneState.current.handPosition.lerp(targetPos, 0.2);
    
              // Detect Gesture
              const { type, strength } = detectGesture(landmarks);
              sceneState.current.gesture = type;
              sceneState.current.gestureStrength = strength;
    
              // Check for Double Palm (Fullscreen trigger)
              if (results.landmarks.length === 2) {
                 const g1 = detectGesture(results.landmarks[0]);
                 const g2 = detectGesture(results.landmarks[1]);
                 if (g1.type === GestureType.OPEN_HAND && g2.type === GestureType.OPEN_HAND) {
                    const now = performance.now();
                    if (now - sceneState.current.doublePalmTimer < 1000 && sceneState.current.doublePalmTimer > 0) {
                       // Toggle fullscreen
                       if (!document.fullscreenElement) {
                         document.documentElement.requestFullscreen().catch((e) => console.log(e));
                       } else {
                         document.exitFullscreen().catch((e) => console.log(e));
                       }
                       sceneState.current.doublePalmTimer = 0; // Reset
                    } else if (sceneState.current.doublePalmTimer === 0) {
                      sceneState.current.doublePalmTimer = now;
                    }
                 } else {
                   if (performance.now() - sceneState.current.doublePalmTimer > 1000) {
                     sceneState.current.doublePalmTimer = 0;
                   }
                 }
              }
    
            } else {
              sceneState.current.isHandPresent = false;
              sceneState.current.gesture = GestureType.NONE;
            }
        } catch (e) {
            console.warn("Prediction error:", e);
        }
        
        // Notify Parent of gesture
        onGestureChange(sceneState.current.gesture);
      }
      
      // Update Physics & Render
      animate();
      requestRef.current = requestAnimationFrame(predict);
  }, [animate, onGestureChange]);

  const initThree = useCallback(() => {
      if (!containerRef.current) return;
      if (threeRef.current.renderer) return; // Prevent double init

      // 1. Scene & Camera
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x050505, 0.005);

      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
      camera.position.z = CAMERA_Z;

      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      containerRef.current.appendChild(renderer.domElement);

      // 2. Post Processing
      const renderScene = new RenderPass(scene, camera);
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
      bloomPass.threshold = 0;
      bloomPass.strength = 1.8;
      bloomPass.radius = 0.5;

      const composer = new EffectComposer(renderer);
      composer.addPass(renderScene);
      composer.addPass(bloomPass);

      // 3. Particles
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      const velocities = new Float32Array(PARTICLE_COUNT * 3);
      const homePositions = new Float32Array(PARTICLE_COUNT * 3);
      const colors = new Float32Array(PARTICLE_COUNT * 3);

      const color1 = new THREE.Color(0x00ffff);
      const color2 = new THREE.Color(0xff00ff);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // Random sphere distribution
        const r = BOUNDS * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;

        homePositions[i3] = x;
        homePositions[i3 + 1] = y;
        homePositions[i3 + 2] = z;

        velocities[i3] = 0;
        velocities[i3 + 1] = 0;
        velocities[i3 + 2] = 0;

        // Gradient color
        const mixedColor = color1.clone().lerp(color2, Math.random());
        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      // Shader Material for efficiency + size attenuation
      const material = new THREE.PointsMaterial({
        size: 0.6,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Store in ref for update loop
      threeRef.current = { renderer, camera, scene, composer };
      sceneState.current.particles = particles;
      sceneState.current.positions = positions;
      sceneState.current.velocities = velocities;
      sceneState.current.homePositions = homePositions;
      sceneState.current.colors = colors;
  }, []);

  const startCamera = async (deviceId?: string | null) => {
    if (!videoRef.current) return;
    
    // Stop existing tracks if switching
    if (videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          deviceId: deviceId ? { exact: deviceId } : undefined
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      
      // Wait for metadata to load to ensure dimensions are known
      videoRef.current.onloadeddata = async () => {
           sceneState.current.isStreamReady = true;
           
           // List devices only after we have permission (stream active)
           if (!hasEnumeratedDevices.current) {
              try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices
                  .filter(device => device.kind === 'videoinput')
                  .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Camera ${device.deviceId.slice(0, 5)}...`
                  }));
                onCamerasFound(videoDevices);
                hasEnumeratedDevices.current = true;
              } catch (e) {
                console.warn("Error enumerating devices:", e);
              }
           }

           if (isLoading) {
             setIsLoading(false);
             initThree();
             predict();
           }
      };
    } catch (err) {
      console.error("Camera error:", err);
      setStatusText("Camera permission denied or device not found.");
    }
  };

  // Watch for device change
  useEffect(() => {
    if (!isLoading && selectedCameraId) {
      startCamera(selectedCameraId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  useEffect(() => {
    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });
        setStatusText("Starting Camera...");
        // Start with default or currently selected
        startCamera(selectedCameraId);
      } catch (error) {
        console.error("MediaPipe error:", error);
        setStatusText("Error loading AI models. Check console.");
      }
    };

    setupMediaPipe();

    // Resize handler
    const handleResize = () => {
       const { camera, renderer, composer } = threeRef.current;
       if (!camera || !renderer || !composer) return;
       camera.aspect = window.innerWidth / window.innerHeight;
       camera.updateProjectionMatrix();
       renderer.setSize(window.innerWidth, window.innerHeight);
       composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener('resize', handleResize);
      if (threeRef.current.renderer) {
          threeRef.current.renderer.dispose();
          if (containerRef.current) containerRef.current.innerHTML = '';
          threeRef.current.renderer = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
         const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
         tracks.forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency mainly because we handle restarts internally via refs/separate effects

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 bg-black">
      <video
        ref={videoRef}
        style={{ position: 'absolute', opacity: 0, top: 0, left: 0, zIndex: -1 }}
        playsInline
        muted
        autoPlay
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black text-white flex-col gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-orbitron text-cyan-400 animate-pulse">{statusText}</p>
        </div>
      )}
    </div>
  );
};

export default HandParticlesScene;