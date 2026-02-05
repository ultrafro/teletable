import { useFrame } from "@react-three/fiber";
import { IKRobotComponent } from "./IKRobotComponent";
import { Quaternion, Vector3 } from "three";
import { RefObject, useEffect, useRef } from "react";
import {
  DataFrame,
  ExternalGoal,
  RobotVisualizerControlMode,
} from "./teletable.model";
import ControlPointVisualizer from "./ControlPointVisualizer";
import { ExternalGoalVisualizer } from "./ExternalGoalVisualizer";

/** Shell limits in front of the arm: angle (deg) from -Z, radius in XZ, height (Y). */
const SHELL_MIN_ANGLE_DEG = -30;
const SHELL_MAX_ANGLE_DEG = 30;
const SHELL_MIN_RADIUS = 0.1;
const SHELL_MAX_RADIUS = 2;
const SHELL_MIN_HEIGHT = 0;
const SHELL_MAX_HEIGHT = 2;

/** Half-width of the wedge on the z=0 plane: max radius * sin(30°) */
const SHELL_BACK_X_MAX = SHELL_MAX_RADIUS * Math.sin((SHELL_MAX_ANGLE_DEG * Math.PI) / 180);

/** Clamp a position (in local arm space) to the shell in front of the arm. Mutates v. */
function clampHandPositionToShell(v: Vector3): Vector3 {
  const x = v.x;
  const y = v.y;
  const z = v.z;

  // Behind the arm (positive Z): clamp to the back boundary (z=0 plane), don't project to front
  if (z > 0) {
    v.x = Math.max(-SHELL_BACK_X_MAX, Math.min(SHELL_BACK_X_MAX, x));
    v.y = Math.max(SHELL_MIN_HEIGHT, Math.min(SHELL_MAX_HEIGHT, y));
    v.z = 0;
    return v;
  }

  const r = Math.sqrt(x * x + z * z) || 1e-6;
  // Angle from -Z axis: 0 = straight ahead
  const angleRad = Math.atan2(x, -z);
  const angleDeg = (angleRad * 180) / Math.PI;
  const height = y;

  const clampedAngleDeg = Math.max(
    SHELL_MIN_ANGLE_DEG,
    Math.min(SHELL_MAX_ANGLE_DEG, angleDeg)
  );
  const clampedRadius = Math.max(
    SHELL_MIN_RADIUS,
    Math.min(SHELL_MAX_RADIUS, r)
  );
  const clampedHeight = Math.max(
    SHELL_MIN_HEIGHT,
    Math.min(SHELL_MAX_HEIGHT, height)
  );

  const ca = (clampedAngleDeg * Math.PI) / 180;
  v.x = clampedRadius * Math.sin(ca);
  v.z = -clampedRadius * Math.cos(ca);
  v.y = clampedHeight;
  return v;
}

export default function IKRobotFrame({
  currentState,
  handId,
  basePosition,

  onJointValuesUpdate,
  controlMode,
  externalGoal,
  hideControlSliders,
  hideExternalGoal,
}: {
  currentState: RefObject<Record<string, DataFrame>>;
  handId: string;
  basePosition: Vector3;
  onJointValuesUpdate?: (robotId: string, jointValues: number[]) => void;
  controlMode: RobotVisualizerControlMode;
  externalGoal?: ExternalGoal;
  hideControlSliders?: boolean;
  hideExternalGoal?: boolean;
}) {
  const handPosition = useRef(new Vector3(0, 0, -0.3));
  const handQuaternion = useRef(new Quaternion(0, 0, 0, 1));
  const handOtherValues = useRef({
    roll: 0,
    pitch: 0,
    gripper: 0,
  });

  useEffect(() => {
    if (externalGoal && controlMode === "ExternalGoal") {
      handPosition.current = externalGoal.position;
      handOtherValues.current = externalGoal;
    }
  }, [externalGoal]);

  return (
    <group position={basePosition}>
      <IKRobotComponent
        //basePostion={basePosition}
        goalPosition={handPosition.current}
        goalOtherValues={handOtherValues.current}
        onJointValuesUpdate={(jointValues) => {
          //copy into currentState.joints
          for (let i = 0; i < jointValues.length; i++) {
            if (!currentState.current[handId]) {
              currentState.current[handId] = {
                joints: [],
                type: "SO101",
              };
            }
            if (!currentState.current[handId].joints) {
              currentState.current[handId].joints = [];
            }
            currentState.current[handId].joints[i] = jointValues[i];
          }


          if (controlMode === "DirectJoints") {
            return;
          }

          //console.log("Joint values for", handId, ":", jointValues);
          onJointValuesUpdate?.(handId, jointValues);
        }}
        useDirectValues={controlMode === "DirectJoints" || false}
        currentState={currentState}
        handId={handId}
      />
      {/* <ControlPointVisualizer handData={handData} color="#ef4444" /> */}

      {controlMode === "WidgetGoal" && (
        <ControlPointVisualizer
          position={handPosition.current}
          //basePosition={basePosition}
          otherValues={handOtherValues.current}
          handId={handId}
          offset={basePosition}
          color="#ef4444"
          hideControlSliders={hideControlSliders}
        />
      )}

      {controlMode === "ExternalGoal" && externalGoal && !hideExternalGoal && (
        <>
          <ExternalGoalVisualizer goal={externalGoal} />
        </>
      )}
    </group>
  );
}
