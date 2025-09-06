import { Cylinder, Sphere } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group, Quaternion, Vector3 } from "three";
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

  useFrame(() => {
    if (handRef.current && handData.detected) {
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
    }
  });

  //   if (!handData.detected) return null;

  return (
    <group ref={handRef} position={position}>
      <Sphere args={[0.1]}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.7}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </Sphere>

      {/* Hand orientation indicator */}
      <Cylinder args={[0.02, 0.02, 0.3, 8]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={color} transparent opacity={0.5} />
      </Cylinder>
    </group>
  );
}
