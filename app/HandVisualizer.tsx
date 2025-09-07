import { Box, Cylinder, Sphere, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { HandDetection } from "./teletable.model";

// Hand Visualizer Component
export function HandVisualizer({
  handData,
  position,
  color,
}: {
  handData: HandDetection;
  position: [number, number, number];
  color: string;
}) {
  const handRef = useRef<Group>(null);
  const gripperRef = useRef<Group>(null);

  const baseRef = useRef<Mesh>(null);
  const indexKnuckleRef = useRef<Mesh>(null);
  const pinkyKnuckleRef = useRef<Mesh>(null);

  // Calculate opacity based on detection status
  const baseOpacity = handData.detected ? 0.95 : 0.6;
  const indicatorOpacity = handData.detected ? 0.85 : 0.5;

  useFrame(() => {
    if (handRef.current) {
      if (handData.detected) {
        // Update position based on hand data
        const targetPos = new Vector3(
          handData.position.x,
          handData.position.y,
          handData.position.z
        );

        handRef.current.position.lerp(targetPos, 0.1);

        // Update rotation based on orientation
        const targetQuat = new Quaternion(
          handData.orientation.x,
          handData.orientation.y,
          handData.orientation.z,
          handData.orientation.w
        );

        handRef.current.quaternion.slerp(targetQuat, 0.1);

        const targetGripperQuat = new Quaternion(
          handData.gripperOrientation.x,
          handData.gripperOrientation.y,
          handData.gripperOrientation.z,
          handData.gripperOrientation.w
        );

        if (gripperRef.current) {
          gripperRef.current.quaternion.slerp(targetGripperQuat, 0.1);

          const targetGripperPos = new Vector3(
            handData.gripperPosition.x,
            handData.gripperPosition.y,
            handData.gripperPosition.z
          );
          gripperRef.current.position.lerp(targetGripperPos, 0.1);
        }
      }
    }

    // Update gripper animation based on hand openness
    if (gripperRef.current) {
      const gripperOpenness = handData.detected ? handData.open : 0.5;
      const maxGripperDistance = 0.15;
      const currentDistance = maxGripperDistance * gripperOpenness;

      gripperRef.current.children?.[0]?.children?.forEach((child, index) => {
        if (index === 0) {
          // Left gripper finger
          child.position.x = -currentDistance / 2;
        } else if (index === 1) {
          // Right gripper finger
          child.position.x = currentDistance / 2;
        }
      });
    }

    if (baseRef.current) {
      baseRef.current.position.x = handData.base.x;
      baseRef.current.position.y = handData.base.y;
      baseRef.current.position.z = handData.base.z;
    }
    if (indexKnuckleRef.current) {
      indexKnuckleRef.current.position.x = handData.indexKnuckle.x;
      indexKnuckleRef.current.position.y = handData.indexKnuckle.y;
      indexKnuckleRef.current.position.z = handData.indexKnuckle.z;
    }
    if (pinkyKnuckleRef.current) {
      pinkyKnuckleRef.current.position.x = handData.pinkyKnuckle.x;
      pinkyKnuckleRef.current.position.y = handData.pinkyKnuckle.y;
      pinkyKnuckleRef.current.position.z = handData.pinkyKnuckle.z;
    }
  });

  return (
    <>
      <group ref={handRef} position={position}>
        {/* Main hand sphere */}
        <Sphere args={[0.12]}>
          <meshStandardMaterial
            color={color}
            transparent
            opacity={baseOpacity}
            emissive={color}
            emissiveIntensity={handData.detected ? 0.4 : 0.15}
          />
        </Sphere>

        {/* Hand orientation indicator */}
        {/* <Cylinder args={[0.025, 0.025, 0.35, 8]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial
            color={color}
            transparent
            opacity={indicatorOpacity}
            emissive={color}
            emissiveIntensity={handData.detected ? 0.3 : 0.1}
          />
        </Cylinder> */}

        {/* Directional Indicators */}
        {/* Positive X (Right) - Red Arrow */}
        <group position={[0.25, 0, 0]}>
          <Cylinder
            args={[0.015, 0.015, 0.2, 8]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <meshStandardMaterial
              color="red"
              transparent
              opacity={indicatorOpacity * 0.8}
              emissive="red"
              emissiveIntensity={handData.detected ? 0.3 : 0.1}
            />
          </Cylinder>
          {/* Arrow tip */}
          <Cylinder
            args={[0, 0.035, 0.08, 6]}
            rotation={[0, 0, Math.PI / 2]}
            position={[0.1, 0, 0]}
          >
            <meshStandardMaterial
              color="red"
              transparent
              opacity={indicatorOpacity * 0.8}
              emissive="red"
              emissiveIntensity={handData.detected ? 0.3 : 0.1}
            />
          </Cylinder>
          {/* Letter X */}
          <Text
            position={[0.15, 0, 0]}
            fontSize={0.05}
            color="red"
            anchorX="center"
            anchorY="middle"
          >
            X
          </Text>
        </group>

        {/* Positive Y (Up) - Green Arrow */}
        <group position={[0, 0.25, 0]}>
          <Cylinder args={[0.015, 0.015, 0.2, 8]}>
            <meshStandardMaterial
              color="lime"
              transparent
              opacity={indicatorOpacity * 0.8}
              emissive="lime"
              emissiveIntensity={handData.detected ? 0.3 : 0.1}
            />
          </Cylinder>
          {/* Arrow tip */}
          <Cylinder args={[0, 0.035, 0.08, 6]} position={[0, 0.1, 0]}>
            <meshStandardMaterial
              color="lime"
              transparent
              opacity={indicatorOpacity * 0.8}
              emissive="lime"
              emissiveIntensity={handData.detected ? 0.3 : 0.1}
            />
          </Cylinder>
          {/* Letter Y */}
          <Text
            position={[0, 0.15, 0]}
            fontSize={0.05}
            color="lime"
            anchorX="center"
            anchorY="middle"
          >
            Y
          </Text>
        </group>

        {/* Positive Z (Forward) - Blue Arrow */}
        <group position={[0, 0, 0.25]}>
          <Cylinder
            args={[0.015, 0.015, 0.2, 8]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color="cyan"
              transparent
              opacity={indicatorOpacity * 0.8}
              emissive="cyan"
              emissiveIntensity={handData.detected ? 0.3 : 0.1}
            />
          </Cylinder>
          {/* Arrow tip */}
          <Cylinder
            args={[0, 0.035, 0.08, 6]}
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0, 0.1]}
          >
            <meshStandardMaterial
              color="cyan"
              transparent
              opacity={indicatorOpacity * 0.8}
              emissive="cyan"
              emissiveIntensity={handData.detected ? 0.3 : 0.1}
            />
          </Cylinder>
          {/* Letter Z */}
          <Text
            position={[0, 0, 0.15]}
            fontSize={0.05}
            color="cyan"
            anchorX="center"
            anchorY="middle"
          >
            Z
          </Text>
        </group>
      </group>

      {/* Gripper visualization */}
      <group ref={gripperRef} position={[0, 0, 0.2]}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          {/* Left gripper finger */}
          <Box args={[0.035, 0.09, 0.06]} position={[-0.075, 0, 0]}>
            <meshStandardMaterial
              color={color}
              transparent
              opacity={baseOpacity}
              emissive={color}
              emissiveIntensity={handData.detected ? 0.25 : 0.08}
            />
          </Box>

          {/* Right gripper finger */}
          <Box args={[0.035, 0.09, 0.06]} position={[0.075, 0, 0]}>
            <meshStandardMaterial
              color={color}
              transparent
              opacity={baseOpacity}
              emissive={color}
              emissiveIntensity={handData.detected ? 0.25 : 0.08}
            />
          </Box>

          {/* Gripper base */}
          <Box args={[0.14, 0.05, 0.04]} position={[0, -0.06, 0]}>
            <meshStandardMaterial
              color={color}
              transparent
              opacity={baseOpacity * 0.9}
              emissive={color}
              emissiveIntensity={handData.detected ? 0.2 : 0.06}
            />
          </Box>
        </group>
      </group>

      {/* Debug Sphere for the Base - relative positioning */}
      <Sphere
        args={[0.025]}
        position={[handData.base.x, handData.base.y, handData.base.z]}
        ref={baseRef}
      >
        <meshStandardMaterial color="black" transparent />
      </Sphere>

      {/* Debug Sphere for the Index Knuckle - relative positioning */}
      <Sphere
        ref={indexKnuckleRef}
        args={[0.025]}
        position={[
          handData.indexKnuckle.x,
          handData.indexKnuckle.y,
          handData.indexKnuckle.z,
        ]}
      >
        <meshStandardMaterial
          color="blue"
          transparent
          opacity={baseOpacity}
          emissive="blue"
          emissiveIntensity={handData.detected ? 0.4 : 0.15}
        />
      </Sphere>

      {/* Debug Sphere for the Pinky Knuckle - relative positioning */}
      <Sphere
        args={[0.025]}
        ref={pinkyKnuckleRef}
        position={[
          handData.pinkyKnuckle.x,
          handData.pinkyKnuckle.y,
          handData.pinkyKnuckle.z,
        ]}
      >
        <meshStandardMaterial
          color="green"
          transparent
          opacity={baseOpacity}
          emissive="green"
          emissiveIntensity={handData.detected ? 0.4 : 0.15}
        />
      </Sphere>
    </>
  );
}
