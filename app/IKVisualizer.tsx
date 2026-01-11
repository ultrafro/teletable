"use client";
import { Box } from "@react-three/drei";
import { BothHands } from "./teletable.model";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingManager, Object3D, Scene } from "three";
import URDFLoader from "urdf-loader";
import { urdfRobotToIKRoot } from "closed-chain-ik";

import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { IKTest } from "./IKTest";
import { IKRobot } from "./IKRobot";
import { drawIKVisualizers } from "./drawIKVisualizers";

export default function IKVisualizer({
  currentHands,
}: {
  currentHands: BothHands;
}) {
  const meshRef = useRef<Mesh>(null);
  const ikTestRef = useRef<IKTest>(new IKTest());
  const linkVisualizersRef = useRef<Group>(null);
  const jointVisualizersRef = useRef<Group>(null);
  const ikRobotLinkVisualizersRef = useRef<Group>(null);
  const ikRobotJointVisualizersRef = useRef<Group>(null);

  const { scene } = useThree();
  const [IKRobotClass, setIKRobotClass] = useState<IKRobot | null>(null);

  const onLoop = useCallback(() => {
    //make the goal transform move in a circle:
    if (meshRef.current) {
      const radius = 0.15;
      meshRef.current.position.x = Math.cos(Date.now() * 0.001) * radius;
      //meshRef.current.position.z = Math.cos(Date.now() * 0.001) * radius;
      meshRef.current.position.z = -0.3;
      meshRef.current.position.y = 0.3 + Math.sin(Date.now() * 0.001) * 0.15;

      ikTestRef.current.setGoalTransform(
        meshRef.current.position,
        meshRef.current.quaternion
      );
      IKRobotClass?.setGoalTransform(meshRef.current.position, 0, 0, 0);
    }

    ikTestRef.current.update();
    const transforms = ikTestRef.current.getLinkTransforms();
    const jointTransforms = ikTestRef.current.getJointTransforms();
    //console.log(transforms);

    // drawIKVisualizers(
    //   transforms,
    //   jointTransforms,
    //   linkVisualizersRef.current,
    //   jointVisualizersRef.current
    // );

    if (IKRobotClass) {
      // IKRobotClass.shouldVisualize = true;
      IKRobotClass?.update();
      // const ikRobotLinkTransforms = IKRobotClass?.getLinkTransforms();
      // const ikRobotJointTransforms = IKRobotClass?.getJointTransforms();

      // drawIKVisualizers(
      //   ikRobotLinkTransforms,
      //   ikRobotJointTransforms,
      //   ikRobotLinkVisualizersRef.current,
      //   ikRobotJointVisualizersRef.current
      // );
    }

    // const jointValues = ikTestRef.current.getJointValues();
    // console.log(jointValues);
  }, [IKRobotClass]);
  useFrame(onLoop);

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
        scene.add(robot as any);

        // robot.traverse((c) => {
        //   if ((c as any).jointType === "floating") {
        //     (c as any).jointType = "fixed";
        //   }
        // });

        const ikRobot = urdfRobotToIKRoot(robot, false);
        console.log(ikRobot);

        const newIKRobot = new IKRobot(
          scene as unknown as Object3D,
          robot,
          ikRobot
        );
        setIKRobotClass(newIKRobot);
      }
    );
  }, [scene]);

  return (
    <>
      {/* Green Cube */}
      <Box ref={meshRef} args={[0.02, 0.02, 0.02]} position={[0, 0, 0]}>
        <meshStandardMaterial color="green" />
      </Box>
      {/* Link Visualizers */}
      <group ref={linkVisualizersRef}></group>
      {/* Joint Visualizers */}
      <group ref={jointVisualizersRef}></group>

      {/* IKRobot Link Visualizers */}
      <group ref={ikRobotLinkVisualizersRef}></group>
      {/* IKRobot Joint Visualizers */}
      <group ref={ikRobotJointVisualizersRef}></group>
    </>
  );
}
