"use client";
import { Box } from "@react-three/drei";
import { BothHands } from "./teletable.model";
import { useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";

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

export default function IKVisualizer({
  currentHands,
}: {
  currentHands: BothHands;
}) {
  const meshRef = useRef<Mesh>(null);
  const ikTestRef = useRef<IKTest>(new IKTest());
  const linkVisualizersRef = useRef<Group>(null);
  const jointVisualizersRef = useRef<Group>(null);
  const onLoop = useCallback(() => {
    //make the goal transform move in a circle:
    if (meshRef.current) {
      const radius = 0.8;
      meshRef.current.position.x = Math.sin(Date.now() * 0.001) * radius;
      meshRef.current.position.z = Math.cos(Date.now() * 0.001) * radius;
      meshRef.current.position.y = 0.5 + Math.sin(Date.now() * 0.001) * radius;

      ikTestRef.current.setGoalTransform(
        meshRef.current.position,
        meshRef.current.quaternion
      );
    }

    ikTestRef.current.update();
    const transforms = ikTestRef.current.getLinkTransforms();
    const jointTransforms = ikTestRef.current.getJointTransforms();
    //console.log(transforms);

    //update link visualizers
    //create each one if it doesn't exist, and update it if it does
    for (const transform of transforms) {
      const linkChildren = linkVisualizersRef.current?.children;
      if (linkChildren) {
        //adjust count of linkChildren to match transforms
        if (linkChildren.length !== transforms.length) {
          for (let i = 0; i < transforms.length; i++) {
            if (i >= linkChildren.length) {
              const mesh = new Mesh(
                new BoxGeometry(0.1 * (i + 1), 0.1 * (i + 1), 0.1 * (i + 1))
              );
              mesh.material = new MeshStandardMaterial({ color: 0xbbbbbb });
              linkChildren.push(mesh);
            }
          }
        }
        for (let i = 0; i < transforms.length; i++) {
          linkChildren[i].position.copy(transforms[i].position);
          linkChildren[i].quaternion.copy(transforms[i].quaternion);
        }
      }
    }

    for (const transform of jointTransforms) {
      const jointChildren = jointVisualizersRef.current?.children;
      if (jointChildren) {
        //adjust count of jointChildren to match jointTransforms
        if (jointChildren.length !== jointTransforms.length) {
          for (let i = 0; i < jointTransforms.length; i++) {
            if (i >= jointChildren.length) {
              const mesh = new Mesh(new SphereGeometry(0.2, 10, 10));
              mesh.material = new MeshStandardMaterial({
                color: 0x00ffff,
                opacity: 0.5,
                transparent: true,
              });
              mesh.scale.set(0.3, 1.0, 0.3);
              jointChildren.push(mesh);
            }
          }
        }
        for (let i = 0; i < jointTransforms.length; i++) {
          jointChildren[i].position.copy(jointTransforms[i].position);
          jointChildren[i].quaternion.copy(jointTransforms[i].quaternion);
        }
      }
    }

    // const jointValues = ikTestRef.current.getJointValues();
    // console.log(jointValues);
  }, []);
  useFrame(onLoop);

  return (
    <>
      {/* Green Cube */}
      <Box ref={meshRef} args={[0.1, 0.1, 0.1]} position={[0, 0, 0]}>
        <meshStandardMaterial color="green" />
      </Box>
      {/* Link Visualizers */}
      <group ref={linkVisualizersRef}></group>
      {/* Joint Visualizers */}
      <group ref={jointVisualizersRef}></group>
    </>
  );
}
