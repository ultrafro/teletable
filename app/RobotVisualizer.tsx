"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Box,
  Cylinder,
  Sphere,
  PivotControls,
} from "@react-three/drei";
import { BothHands, HandDetection } from "./teletable.model";
import * as THREE from "three";
import { RobotArmVisualizer } from "./RobotArmVisualizer";
import { HandVisualizer } from "./HandVisualizer";
import IKVisualizer from "./IKVisualizer";

export default function RobotVisualizer({
  currentHands,
  showDirectControl,
  onDirectControlHandsUpdate,
}: {
  currentHands: BothHands;
  showDirectControl?: boolean;
  onDirectControlHandsUpdate?: (hands: BothHands) => void;
}) {
  const [mounted, setMounted] = useState(false);

  const [directControlHands, setDirectControlHands] =
    useState<BothHands>(currentHands);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update directControlHands when currentHands changes
  useEffect(() => {
    setDirectControlHands(currentHands);
  }, [currentHands]);

  // Handle direct control hands update
  const handleDirectHandsUpdate = (hands: BothHands) => {
    setDirectControlHands(hands);
    if (onDirectControlHandsUpdate) {
      onDirectControlHandsUpdate(hands);
    }
  };

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
        <Scene
          currentHands={currentHands}
          directControlHands={directControlHands}
          setDirectControlHands={setDirectControlHands}
          showDirectControl={showDirectControl}
          onDirectHandsUpdate={handleDirectHandsUpdate}
        />
      </Canvas>
    </div>
  );
}

// Compass Component
function Compass() {
  return (
    <>
      {/* X-axis - pointing in positive X direction */}
      <Cylinder
        args={[0.002, 0.002, 0.3, 8]}
        position={[0.15, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <meshStandardMaterial color="#9ca3af" />
      </Cylinder>

      {/* Y-axis - pointing in positive Y direction */}
      <Cylinder args={[0.002, 0.002, 0.3, 8]} position={[0, 0.15, 0]}>
        <meshStandardMaterial color="#6b7280" />
      </Cylinder>

      {/* Z-axis - pointing in positive Z direction */}
      <Cylinder
        args={[0.002, 0.002, 0.3, 8]}
        position={[0, 0, 0.15]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial color="#3b82f6" />
      </Cylinder>

      {/* Origin marker */}
      <Sphere args={[0.006]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#e5e7eb" />
      </Sphere>
    </>
  );
}

// Grid Component for the ground
function Grid() {
  const gridSize = 10;
  const divisions = 20;
  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(
      gridSize,
      divisions,
      "#6b7280",
      "#9ca3af"
    );
    grid.position.y = 0;
    return grid;
  }, []);

  return <primitive object={gridHelper} />;
}

// Main Scene Component
function Scene({
  currentHands,
  directControlHands,
  showDirectControl,
  setDirectControlHands,
  onDirectHandsUpdate,
}: {
  currentHands: BothHands;
  directControlHands?: BothHands;
  showDirectControl?: boolean;
  setDirectControlHands?: (hands: BothHands) => void;
  onDirectHandsUpdate?: (hands: BothHands) => void;
}) {
  const { leftHandMatrix, rightHandMatrix } = useMemo(() => {
    if (!directControlHands) {
      return {
        leftHandMatrix: new THREE.Matrix4(),
        rightHandMatrix: new THREE.Matrix4(),
      };
    }

    //use position, and rotation to create the matrix
    const leftQuaternion = new THREE.Quaternion(
      directControlHands.left.orientation.x,
      directControlHands.left.orientation.y,
      directControlHands.left.orientation.z,
      directControlHands.left.orientation.w
    );
    const rightQuaternion = new THREE.Quaternion(
      directControlHands.right.orientation.x,
      directControlHands.right.orientation.y,
      directControlHands.right.orientation.z,
      directControlHands.right.orientation.w
    );

    const leftObject = new THREE.Object3D();
    leftObject.position.set(
      directControlHands.left.position.x,
      directControlHands.left.position.y,
      directControlHands.left.position.z
    );
    leftObject.quaternion.set(
      leftQuaternion.x,
      leftQuaternion.y,
      leftQuaternion.z,
      leftQuaternion.w
    );
    const rightObject = new THREE.Object3D();
    rightObject.position.set(
      directControlHands.right.position.x,
      directControlHands.right.position.y,
      directControlHands.right.position.z
    );
    rightObject.quaternion.set(
      rightQuaternion.x,
      rightQuaternion.y,
      rightQuaternion.z,
      rightQuaternion.w
    );

    //do updates on left and right object's matrix before copying
    leftObject.updateMatrix();
    rightObject.updateMatrix();

    const leftHandMatrix = leftObject.matrix;
    const rightHandMatrix = rightObject.matrix;

    return { leftHandMatrix, rightHandMatrix };
  }, [directControlHands]);

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
      <Grid />

      {/* Compass at origin */}
      <Compass />

      {/* Hand Visualizers with subtle colors */}
      <HandVisualizer
        handData={currentHands.left}
        position={[-1, 0, 0]}
        color="#ef4444"
      />

      <HandVisualizer
        handData={currentHands.right}
        position={[1, 0, 0]}
        color="#3b82f6"
      />

      <IKVisualizer currentHands={currentHands} />

      {/* Direct Control Pivot Controls */}
      {showDirectControl && directControlHands && (
        <>
          {/* Left Hand Pivot Control */}

          <PivotControls
            matrix={leftHandMatrix}
            enabled={true}
            scale={0.5}
            lineWidth={3}
            fixed={false}
            activeAxes={[true, true, true]}
            disableRotations={false}
            disableScaling={true}
            axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
            hoveredColor="#f59e0b"
            annotations={true}
            autoTransform={false}
            onDrag={(localMatrix, deltaLocal, worldMatrix, deltaWorld) => {
              const position = new THREE.Vector3();
              const rotation = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              worldMatrix.decompose(position, rotation, scale);

              const updatedHands = {
                ...directControlHands,
                left: {
                  ...directControlHands.left,
                  position: {
                    x: position.x,
                    y: position.y,
                    z: position.z,
                  },
                  orientation: {
                    x: rotation.x,
                    y: rotation.y,
                    z: rotation.z,
                    w: rotation.w,
                  },
                  open: 1,
                  detected: true,
                },
              };
              setDirectControlHands?.(updatedHands);
              onDirectHandsUpdate?.(updatedHands);
            }}
          >
            <Sphere args={[0.05]}>
              <meshStandardMaterial color="#ef4444" transparent opacity={0.6} />
            </Sphere>
          </PivotControls>

          {/* Right Hand Pivot Control */}

          <PivotControls
            matrix={rightHandMatrix}
            enabled={true}
            scale={0.5}
            lineWidth={3}
            fixed={false}
            activeAxes={[true, true, true]}
            disableRotations={false}
            disableScaling={true}
            axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
            hoveredColor="#f59e0b"
            annotations={true}
            onDrag={(localMatrix, deltaLocal, worldMatrix, deltaWorld) => {
              const position = new THREE.Vector3();
              const rotation = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              worldMatrix.decompose(position, rotation, scale);

              const updatedHands = {
                ...directControlHands,
                right: {
                  ...directControlHands.right,
                  position: {
                    x: position.x,
                    y: position.y,
                    z: position.z,
                  },
                  orientation: {
                    x: rotation.x,
                    y: rotation.y,
                    z: rotation.z,
                    w: rotation.w,
                  },
                  open: 1,
                  detected: true,
                },
              };
              setDirectControlHands?.(updatedHands);
              onDirectHandsUpdate?.(updatedHands);
            }}
          >
            <Sphere args={[0.05]}>
              <meshStandardMaterial color="#3b82f6" transparent opacity={0.6} />
            </Sphere>
          </PivotControls>
        </>
      )}

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={12}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        makeDefault
      />
    </>
  );
}
