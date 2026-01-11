import { useFrame } from "@react-three/fiber";
import { IKRobotComponent } from "./IKRobotComponent";
import { Quaternion, Sphere, Vector3 } from "three";
import { RefObject, useEffect, useRef } from "react";
import {
  BothHands,
  DataFrame,
  ExternalGoal,
  HandDetection,
  LeftArmBasePosition,
  RobotVisualizerControlMode,
} from "./teletable.model";
import ControlPointVisualizer from "./ControlPointVisualizer";
import { ExternalGoalVisualizer } from "./ExternalGoalVisualizer";

export default function IKRobotFrame({
  currentState,
  handId,
  basePosition,

  onJointValuesUpdate,
  controlMode,
  externalGoal,
  hideControlSliders,
}: {
  currentState: RefObject<Record<string, DataFrame>>;
  handId: string;
  basePosition: Vector3;
  onJointValuesUpdate?: (robotId: string, jointValues: number[]) => void;
  controlMode: RobotVisualizerControlMode;
  externalGoal?: ExternalGoal;
  hideControlSliders?: boolean;
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

      {controlMode === "ExternalGoal" && externalGoal && (
        <>
          <ExternalGoalVisualizer goal={externalGoal} />
        </>
      )}
    </group>
  );
}
