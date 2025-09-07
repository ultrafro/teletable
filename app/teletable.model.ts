export type HandDetection = {
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
  open: number;
  detected: boolean;
  base: { x: number; y: number; z: number };
  indexKnuckle: { x: number; y: number; z: number };
  pinkyKnuckle: { x: number; y: number; z: number };
  gripperPosition: { x: number; y: number; z: number };
  gripperOrientation: { x: number; y: number; z: number; w: number };
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
  base: { x: 0, y: 0, z: 0 },
  indexKnuckle: { x: 0, y: 0, z: 0 },
  pinkyKnuckle: { x: 0, y: 0, z: 0 },
  gripperPosition: { x: 0, y: 0, z: 0 },
  gripperOrientation: { x: 0, y: 0, z: 0, w: 1 },
};
