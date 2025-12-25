export enum GestureType {
  NONE = 'NONE',
  OPEN_HAND = 'OPEN_HAND',
  CLOSED_FIST = 'CLOSED_FIST',
  VICTORY = 'VICTORY',
  PINCH = 'PINCH',
  THUMBS_UP = 'THUMBS_UP',
  ROCK_ON = 'ROCK_ON',
  DOUBLE_PALM = 'DOUBLE_PALM' // For fullscreen toggle
}

export interface ParticleSystemConfig {
  count: number;
  colorBase: number;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}