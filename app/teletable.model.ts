import { Vector3 } from "three";

export type DataFrame = {
  joints: number[];
  type: "SO101";
};

export type RobotOtherValues = {
  roll: number;
  pitch: number;
  gripper: number;
};

export const DefaultDirectValues = [0, 0, 0, 0, 0, 0];

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

export const LeftArmBasePosition = new Vector3(-1, 0, 0);
export const RightArmBasePosition = new Vector3(1, 0, 0);

export const DefaultLeftHandDetection: HandDetection = {
  position: { x: 0, y: 0, z: -0.3 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  open: 0,
  detected: false,
  base: { x: 0, y: 0, z: 0 },
  indexKnuckle: { x: 0, y: 0, z: 0 },
  pinkyKnuckle: { x: 0, y: 0, z: 0 },
  gripperPosition: { x: 0, y: 0, z: 0 },
  gripperOrientation: { x: 0, y: 0, z: 0, w: 1 },
};

export const DefaultRightHandDetection: HandDetection = {
  position: { x: 0, y: 0, z: -0.3 },
  orientation: { x: 0, y: 0, z: 0, w: 1 },
  open: 0,
  detected: false,
  base: { x: 0, y: 0, z: 0 },
  indexKnuckle: { x: 0, y: 0, z: 0 },
  pinkyKnuckle: { x: 0, y: 0, z: 0 },
  gripperPosition: { x: 0, y: 0, z: 0 },
  gripperOrientation: { x: 0, y: 0, z: 0, w: 1 },
};

export type RobotVisualizerControlMode =
  | "ExternalGoal"
  | "WidgetGoal"
  | "DirectJoints";

export type ExternalGoal = {
  position: Vector3;
  roll: number;
  pitch: number;
  gripper: number;
};

export type MobileGoal = Record<string, ExternalGoal>;
