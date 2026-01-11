import { useFrame, useThree } from "@react-three/fiber";
import { urdfRobotToIKRoot } from "closed-chain-ik";
import { RefObject, useEffect, useRef, useState } from "react";
import { Vector3, Quaternion, LoadingManager, Scene, Group, Object3D } from "three";
import URDFLoader from "urdf-loader";
import { IKRobot } from "./IKRobot";
import { DataFrame } from "./teletable.model";

export function IKRobotComponent({
  //basePostion,
  goalPosition,
  goalOtherValues,
  onJointValuesUpdate,
  useDirectValues,
  currentState,
  handId,
}: {
  //basePostion: Vector3;
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
  const groupRef = useRef<Group>(null!);

  const [groupReady, setGroupReady] = useState(false);


  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current || !groupReady) {
      return;
    }
    hasLoaded.current = true;

    const manager = new LoadingManager();
    const loader = new URDFLoader(manager);



    // loader.packages = {
    //   packageName: "./package/dir/", // The equivalent of a (list of) ROS package(s):// directory
    // };
    loader.load(
      "/SO101/so101_new_calib.urdf", // The path to the URDF within the package OR absolute
      (robot) => {
        // The robot is loaded!
        groupRef.current.add(robot as any);

        // robot.traverse((c) => {
        //   if ((c as any).jointType === "floating") {
        //     (c as any).jointType = "fixed";
        //   }
        // });

        const ikRobot = urdfRobotToIKRoot(robot, false);
        // console.log(ikRobot);

        const newIKRobot = new IKRobot(
          groupRef.current as unknown as Object3D,
          robot,
          ikRobot,
          onJointValuesUpdate
        );
        setIKRobotClass(newIKRobot);
      }
    );
  }, [scene, groupReady]);

  useEffect(() => {
    if (IKRobotClass) {
      IKRobotClass.onJointValuesUpdate = onJointValuesUpdate;
    }
  }, [IKRobotClass, onJointValuesUpdate]);

  useFrame(() => {
    if (!groupReady && !!groupRef.current) {
      setGroupReady(true);
    }



    if (IKRobotClass) {
      //update base
      //IKRobotClass.setBaseTransform(basePostion);

      //update goal
      IKRobotClass.setGoalTransform(
        goalPosition,
        // basePostion.clone().add(goalPosition),
        goalOtherValues.pitch,
        goalOtherValues.roll,
        goalOtherValues.gripper
      );

      if (useDirectValues) {
        if (!currentState.current[handId]) {
          currentState.current[handId] = {
            joints: [],
            type: "SO101",
          };
        }
        if (!currentState.current[handId].joints) {
          currentState.current[handId].joints = [];
        }
        IKRobotClass.setDirectValues(currentState.current[handId].joints);
      }

      IKRobotClass.directMode = useDirectValues;

      IKRobotClass.update();
    }
  });
  return <group ref={groupRef} />;
}
