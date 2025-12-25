import React from 'react';
import { GestureType, CameraDevice } from '../types';

interface Props {
  gesture: GestureType;
  fps: number;
  cameras: CameraDevice[];
  selectedCameraId: string | null;
  onSelectCamera: (deviceId: string) => void;
}

const Overlay: React.FC<Props> = ({ gesture, fps, cameras, selectedCameraId, onSelectCamera }) => {
  const getGestureIcon = (g: GestureType) => {
    switch (g) {
      case GestureType.OPEN_HAND: return "🖐️ Swirl";
      case GestureType.CLOSED_FIST: return "✊ Repel";
      case GestureType.VICTORY: return "✌️ Flow";
      case GestureType.PINCH: return "🤏 Gravity";
      case GestureType.THUMBS_UP: return "👍 Orbit";
      case GestureType.ROCK_ON: return "🤘 Chaos";
      default: return "";
    }
  };

  const getGestureColor = (g: GestureType) => {
    switch (g) {
      case GestureType.CLOSED_FIST: return "text-red-500 border-red-500";
      case GestureType.PINCH: return "text-orange-500 border-orange-500";
      case GestureType.VICTORY: return "text-green-400 border-green-400";
      case GestureType.ROCK_ON: return "text-purple-500 border-purple-500";
      default: return "text-cyan-400 border-cyan-400";
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 sm:p-8">
      {/* Header */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="pointer-events-none">
          <h1 className="text-2xl sm:text-4xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
            Hand Magic
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-inter mt-1 opacity-80">
            Show your hand to interact.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-sm font-mono text-cyan-500/80 mb-1">{fps} FPS</div>
          
          {cameras.length > 0 && (
            <select 
              className="pointer-events-auto bg-black/50 border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-400 font-mono focus:outline-none focus:border-cyan-500 backdrop-blur-sm hover:bg-black/70 transition-all max-w-[150px] sm:max-w-xs"
              value={selectedCameraId || ""}
              onChange={(e) => onSelectCamera(e.target.value)}
            >
              {!selectedCameraId && <option value="" disabled>Select Camera</option>}
              {cameras.map(cam => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Gesture Feedback Center */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center transition-all duration-300">
        {gesture !== GestureType.NONE && (
          <div className={`text-4xl sm:text-6xl font-black font-inter tracking-tighter uppercase border-4 rounded-xl p-4 sm:p-8 backdrop-blur-sm bg-black/20 animate-bounce ${getGestureColor(gesture)}`}>
            {getGestureIcon(gesture)}
          </div>
        )}
      </div>

      {/* Footer / Instructions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] sm:text-xs text-gray-500 font-mono opacity-60">
        <div>🖐️ Open: Swirl</div>
        <div>✊ Fist: Explosion</div>
        <div>✌️ Victory: Wave</div>
        <div>🤏 Pinch: Black Hole</div>
        <div>👍 Thumb: Heart Orbit</div>
        <div>🤘 Rock: Chaos</div>
      </div>
      
      <div className="absolute bottom-2 right-4 text-[10px] text-gray-600 font-mono">
        Cooked by @VotM-usic
      </div>
    </div>
  );
};

export default Overlay;