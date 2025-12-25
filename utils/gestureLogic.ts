import { GestureType, HandLandmark } from '../types';

// MediaPipe Hands Landmark Indices
// 0: Wrist
// 4: Thumb Tip, 3: Thumb IP, 2: Thumb MCP
// 8: Index Tip, 6: Index PIP
// 12: Middle Tip, 10: Middle PIP
// 16: Ring Tip, 14: Ring PIP
// 20: Pinky Tip, 18: Pinky PIP

function distance(p1: HandLandmark, p2: HandLandmark): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
}

function isFingerExtended(landmarks: HandLandmark[], tipIdx: number, pipIdx: number): boolean {
  // Simple check: Tip is higher (smaller y) than PIP? 
  // Note: Y increases downwards in screen space, but MediaPipe might be normalized.
  // We use distance from wrist to determine extension for better rotation invariance.
  const wrist = landmarks[0];
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  
  return distance(wrist, tip) > distance(wrist, pip);
}

export function detectGesture(landmarks: HandLandmark[]): { type: GestureType; strength: number } {
  if (!landmarks || landmarks.length < 21) return { type: GestureType.NONE, strength: 0 };

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  
  // 1. PINCH Check (Thumb close to Index)
  const pinchDist = distance(thumbTip, indexTip);
  if (pinchDist < 0.05) {
    // Strength inversely proportional to distance
    return { type: GestureType.PINCH, strength: Math.max(0, 1 - pinchDist * 20) };
  }

  const thumbExt = isFingerExtended(landmarks, 4, 2);
  const indexExt = isFingerExtended(landmarks, 8, 6);
  const middleExt = isFingerExtended(landmarks, 12, 10);
  const ringExt = isFingerExtended(landmarks, 16, 14);
  const pinkyExt = isFingerExtended(landmarks, 20, 18);

  const extendedCount = [thumbExt, indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

  // 2. CLOSED FIST
  if (extendedCount === 0) {
    return { type: GestureType.CLOSED_FIST, strength: 1 };
  }

  // 3. ROCK ON (Index + Pinky only)
  if (indexExt && pinkyExt && !middleExt && !ringExt) {
    return { type: GestureType.ROCK_ON, strength: 1 };
  }

  // 4. VICTORY (Index + Middle only)
  if (indexExt && middleExt && !ringExt && !pinkyExt) {
    return { type: GestureType.VICTORY, strength: 1 };
  }

  // 5. THUMBS UP (Thumb only, maybe loose index)
  // Harder to detect orientation without robust vectors, but "Thumb extended, others curled" is a good proxy.
  if (thumbExt && !indexExt && !middleExt && !ringExt && !pinkyExt) {
    return { type: GestureType.THUMBS_UP, strength: 1 };
  }

  // 6. OPEN HAND
  if (extendedCount >= 4) {
    return { type: GestureType.OPEN_HAND, strength: 1 };
  }

  return { type: GestureType.NONE, strength: 0 };
}