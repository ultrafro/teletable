"use client";

import { useRef, useEffect, useMemo, useState, RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Box,
  Cylinder,
  Sphere,
  PivotControls,
  Grid,
} from "@react-three/drei";
import {
  BothHands,
  DataFrame,
  HandDetection,
  LeftArmBasePosition,
  RightArmBasePosition,
} from "./teletable.model";
import * as THREE from "three";
import { RobotArmVisualizer } from "./RobotArmVisualizer";
import { HandVisualizer } from "./HandVisualizer";
import IKVisualizer from "./IKVisualizer";

import ControlPointVisualizer from "./ControlPointVisualizer";
import { Vector3 } from "three";
import IKRobotFrame from "./IKRobotFrame";
import Compass from "./Compass";

export default function RobotVisualizer({
  currentState,
  remotelyControlled,
  onJointValuesUpdate,
}: {
  currentState: RefObject<Record<string, DataFrame>>;
  remotelyControlled: boolean;
  onJointValuesUpdate?: (robotId: string, jointValues: number[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "auto",
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [0, 4, 1], fov: 50 }}
        shadows
        style={{
          background: "linear-gradient(to bottom, #e6f3ff 0%, #cce7ff 100%)",
          pointerEvents: "auto",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.8;
        }}
        // eventSource={document.getElementById("canvas-root") || document.body}
        // eventPrefix="client"
      >
        <>
          {/* Soft ambient lighting */}
          <ambientLight intensity={0.6} color="#f8fafc" />

          {/* Main directional light */}
          <directionalLight
            position={[8, 8, 5]}
            intensity={0.5}
            color="#ffffff"
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />

          {/* Subtle fill light */}
          <directionalLight
            position={[-3, 3, -3]}
            intensity={0.2}
            color="#f1f5f9"
          />

          {/* Grid ground */}
          <Grid
            args={[50, 50]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#9ca3af"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#6b7280"
            fadeDistance={100}
            fadeStrength={1}
          />

          {/* Compass at origin */}
          <Compass />

          <IKRobotFrame
            currentState={currentState}
            handId="left"
            basePosition={LeftArmBasePosition}
            remotelyControlled={remotelyControlled}
            onJointValuesUpdate={onJointValuesUpdate}
          />

          <IKRobotFrame
            currentState={currentState}
            handId="right"
            basePosition={RightArmBasePosition}
            remotelyControlled={remotelyControlled}
            onJointValuesUpdate={onJointValuesUpdate}
          />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={0.1}
            maxDistance={12}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2}
            makeDefault
          />
        </>
      </Canvas>
    </div>
  );
}
