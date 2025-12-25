import React, { useState, useCallback } from 'react';
import HandParticlesScene from './components/HandParticlesScene';
import Overlay from './components/Overlay';
import { GestureType, CameraDevice } from './types';

function App() {
  const [currentGesture, setCurrentGesture] = useState<GestureType>(GestureType.NONE);
  const [fps, setFps] = useState(0);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const handleGestureChange = useCallback((gesture: GestureType) => {
    setCurrentGesture(gesture);
  }, []);

  const handleFpsUpdate = useCallback((newFps: number) => {
    setFps(newFps);
  }, []);

  const handleCamerasFound = useCallback((devices: CameraDevice[]) => {
    setCameras(devices);
    // If we have devices and none selected, potentially set the first one or leave null (default)
    if (devices.length > 0 && !selectedCameraId) {
      // We don't strictly force it here to allow the browser default to persist 
      // until user interaction, but updating the UI state is good practice.
      // Keeping it null means "Default" in the UI logic usually.
    }
  }, [selectedCameraId]);

  const handleCameraSelect = useCallback((deviceId: string) => {
    setSelectedCameraId(deviceId);
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden select-none">
      <HandParticlesScene 
        onGestureChange={handleGestureChange} 
        onFpsUpdate={handleFpsUpdate}
        onCamerasFound={handleCamerasFound}
        selectedCameraId={selectedCameraId}
      />
      <Overlay 
        gesture={currentGesture} 
        fps={fps}
        cameras={cameras}
        selectedCameraId={selectedCameraId}
        onSelectCamera={handleCameraSelect}
      />
    </div>
  );
}

export default App;