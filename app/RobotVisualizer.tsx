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
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "auto",
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [10, 10, 10], fov: 60 }}
        shadows
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          pointerEvents: "auto",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
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
      {/* X-axis (Red) - pointing in positive X direction */}
      <Cylinder
        args={[0.02, 0.02, 2, 8]}
        position={[1, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <meshStandardMaterial color="#ff0000" />
      </Cylinder>

      {/* Y-axis (Green) - pointing in positive Y direction */}
      <Cylinder args={[0.02, 0.02, 2, 8]} position={[0, 1, 0]}>
        <meshStandardMaterial color="#00ff00" />
      </Cylinder>

      {/* Z-axis (Blue) - pointing in positive Z direction */}
      <Cylinder
        args={[0.02, 0.02, 2, 8]}
        position={[0, 0, 1]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial color="#0000ff" />
      </Cylinder>

      {/* Origin marker */}
      <Sphere args={[0.05]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#ffffff" />
      </Sphere>

      {/* Axis labels */}
      <mesh position={[2.2, 0, 0]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 2.2, 0]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial color="#00ff00" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0, 2.2]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial color="#0000ff" transparent opacity={0.8} />
      </mesh>
    </>
  );
}

// Main Scene Component
function Scene({ currentHands }: { currentHands: BothHands }) {
  return (
    <>
      {/* Ambient lighting for calm atmosphere */}
      <ambientLight intensity={0.4} color="#b8c6db" />

      {/* Main directional light */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.8}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Soft fill light */}
      <directionalLight
        position={[-5, 5, -5]}
        intensity={0.3}
        color="#f0f4f8"
      />

      {/* Compass at origin */}
      <Compass />

      {/* Two Robot Arms */}
      <RobotArmVisualizer
        position={[-2, 0, 0]}
        handData={currentHands.left}
        isLeft={true}
      />
      <RobotArmVisualizer
        position={[2, 0, 0]}
        handData={currentHands.right}
        isLeft={false}
      />

      {/* Hand Visualizers */}
      <HandVisualizer
        handData={currentHands.left}
        position={[0, 0, 0]}
        color="red"
      />
      <HandVisualizer
        handData={currentHands.right}
        position={[0, 0, 0]}
        color="blue"
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#f7fafc" transparent opacity={0.8} />
      </mesh>

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={3}
        maxDistance={15}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        makeDefault
      />
    </>
  );
}
