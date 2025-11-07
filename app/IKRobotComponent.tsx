import { useFrame, useThree } from "@react-three/fiber";
import { urdfRobotToIKRoot } from "closed-chain-ik";
import { RefObject, useEffect, useState } from "react";
import { Vector3, Quaternion, LoadingManager, Scene } from "three";
import URDFLoader from "urdf-loader";
import { IKRobot } from "./IKRobot";
import { DataFrame } from "./teletable.model";

export function IKRobotComponent({
  basePostion,
  goalPosition,
  goalOtherValues,
  onJointValuesUpdate,
  useDirectValues,
  currentState,
  handId,
}: {
  basePostion: Vector3;
  goalPosition: Vector3;
  goalOtherValues: {
    roll: number;
    pitch: number;
    gripper: number;
  };
  onJointValuesUpdate: (jointValues: number[]) => void;
  useDirectValues: boolean;
  currentState: RefObject<Record<string, DataFrame>>;
  handId: string;
}) {
  const { scene } = useThree();
  const [IKRobotClass, setIKRobotClass] = useState<IKRobot | null>(null);

  useEffect(() => {
    const manager = new LoadingManager();
    const loader = new URDFLoader(manager);
    // loader.packages = {
    //   packageName: "./package/dir/", // The equivalent of a (list of) ROS package(s):// directory
    // };
    loader.load(
      "/SO101/so101_new_calib.urdf", // The path to the URDF within the package OR absolute
      (robot) => {
        // The robot is loaded!
        scene.add(robot);

        // robot.traverse((c) => {
        //   if ((c as any).jointType === "floating") {
        //     (c as any).jointType = "fixed";
        //   }
        // });

        const ikRobot = urdfRobotToIKRoot(robot, false);
        console.log(ikRobot);

        const newIKRobot = new IKRobot(
          scene as unknown as Scene,
          robot,
          ikRobot,
          onJointValuesUpdate
        );
        setIKRobotClass(newIKRobot);
      }
    );
  }, [scene]);

  useEffect(() => {
    if (IKRobotClass) {
      IKRobotClass.onJointValuesUpdate = onJointValuesUpdate;
    }
  }, [IKRobotClass, onJointValuesUpdate]);

  useFrame(() => {
    if (IKRobotClass) {
      //update base
      IKRobotClass.setBaseTransform(basePostion);

      //update goal
      IKRobotClass.setGoalTransform(
        basePostion.clone().add(goalPosition),
        goalOtherValues.pitch,
        goalOtherValues.roll,
        goalOtherValues.gripper
      );

      if (useDirectValues) {
        IKRobotClass.setDirectValues(currentState.current[handId].joints);
      }

      IKRobotClass.directMode = useDirectValues;

      IKRobotClass.update();
    }
  });
  return <></>;
}
