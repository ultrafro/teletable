"use client";

import { useRef, useEffect, useMemo, useState, RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
  ExternalGoal,
  HandDetection,
  LeftArmBasePosition,
  MobileGoal,
  RightArmBasePosition,
  RobotVisualizerControlMode,
} from "./teletable.model";
import * as THREE from "three";
import { RobotArmVisualizer } from "./RobotArmVisualizer";
import { HandVisualizer } from "./HandVisualizer";
import IKVisualizer from "./IKVisualizer";

import ControlPointVisualizer from "./ControlPointVisualizer";
import { Vector3 } from "three";
import IKRobotFrame from "./IKRobotFrame";
import Compass from "./Compass";

const X_CAMERA_OFFSET = -0.5;

function OrbitControlsWithTarget({
  focusedRobot,
}: {
  focusedRobot?: string | null;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (!controlsRef.current) return;

    const targetPosition =
      focusedRobot === "left"
        ? LeftArmBasePosition
        : focusedRobot === "right"
          ? RightArmBasePosition
          : new Vector3(0, 0, 0); // Default to origin if no robot focused

    // Update the target
    controlsRef.current.target.copy(targetPosition);

    // Update camera position x to center on the robot
    camera.position.x = targetPosition.x + X_CAMERA_OFFSET;
    controlsRef.current.update();
  }, [focusedRobot, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={0.1}
      maxDistance={12}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2}
      makeDefault
    />
  );
}

export default function RobotVisualizer({
  currentState,
  controlMode,
  onJointValuesUpdate,
  mobileGoal,
  focusedRobot,
}: {
  currentState: RefObject<Record<string, DataFrame>>;
  controlMode: RobotVisualizerControlMode;
  onJointValuesUpdate?: (robotId: string, jointValues: number[]) => void;
  mobileGoal?: MobileGoal;
  focusedRobot?: string | null;
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
        camera={{ position: [0, 1.5, 1.5], fov: 50 }}
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
        <RobotVisualizerCore
          currentState={currentState}
          controlMode={controlMode}
          onJointValuesUpdate={onJointValuesUpdate}
          mobileGoal={mobileGoal}
          focusedRobot={focusedRobot}
        />
      </Canvas>
    </div>
  );
}


export function RobotVisualizerXR({
  currentState,
  controlMode,
  onJointValuesUpdate,
  mobileGoal,
  focusedRobot,
}: {
  currentState: RefObject<Record<string, DataFrame>>;
  controlMode: RobotVisualizerControlMode;
  onJointValuesUpdate?: (robotId: string, jointValues: number[]) => void;
  mobileGoal?: MobileGoal;
  focusedRobot?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (

    <RobotVisualizerCore
      currentState={currentState}
      controlMode={controlMode}
      onJointValuesUpdate={onJointValuesUpdate}
      mobileGoal={mobileGoal}
      focusedRobot={focusedRobot}
      hideGrid={true}
      hideCompass={true}
      hideControlSliders={true}
    />
  );
}


function RobotVisualizerCore({
  currentState,
  controlMode,
  onJointValuesUpdate,
  mobileGoal,
  focusedRobot,
  hideGrid,
  hideCompass,
  hideControlSliders,
}: {
  currentState: RefObject<Record<string, DataFrame>>;
  controlMode: RobotVisualizerControlMode;
  onJointValuesUpdate?: (robotId: string, jointValues: number[]) => void;
  mobileGoal?: MobileGoal;
  focusedRobot?: string | null;
  hideGrid?: boolean;
  hideCompass?: boolean;
  hideControlSliders?: boolean;
}) {
  return (
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
      {!hideGrid && <Grid
        args={[50, 50]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#9ca3af"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#6b7280"
        fadeDistance={100}
        fadeStrength={1}
      />}

      {/* Compass at origin */}
      {!hideCompass && <Compass />}

      <IKRobotFrame
        currentState={currentState}
        handId="left"
        basePosition={LeftArmBasePosition}
        controlMode={controlMode}
        externalGoal={mobileGoal?.[focusedRobot ?? "left"]}
        onJointValuesUpdate={onJointValuesUpdate}
        hideControlSliders={hideControlSliders}
      />

      <IKRobotFrame
        currentState={currentState}
        handId="right"
        basePosition={RightArmBasePosition}
        controlMode={controlMode}
        externalGoal={mobileGoal?.[focusedRobot ?? "right"]}
        onJointValuesUpdate={onJointValuesUpdate}
        hideControlSliders={hideControlSliders}
      />

      <OrbitControlsWithTarget focusedRobot={focusedRobot} />
    </>
  )
}