"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Box, Cylinder, Sphere } from "@react-three/drei";
import { BothHands, HandDetection } from "./teletable.model";
import * as THREE from "three";
import { RobotArmVisualizer } from "./RobotArmVisualizer";
import { HandVisualizer } from "./HandVisualizer";

export default function RobotVisualizer({
  currentHands,
}: {
  currentHands: BothHands;
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
        <Scene currentHands={currentHands} />
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
function Scene({ currentHands }: { currentHands: BothHands }) {
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
