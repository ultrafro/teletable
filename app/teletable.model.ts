export type HandDetection = {
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
  open: number;
  detected: boolean;
};

export type BothHands = {
  left: HandDetection;
  right: HandDetection;
};

export const DefaultHandDetection: HandDetection = {
  position: { x: 0, y: 0, z: 0 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  open: 0,
  detected: false,
};
