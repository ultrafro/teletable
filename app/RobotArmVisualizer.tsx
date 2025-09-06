import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import { Group, MathUtils, Mesh } from "three";
import { HandDetection } from "./teletable.model";
import { Box, Cylinder, Sphere } from "@react-three/drei";

export function RobotArmVisualizer({
  position,
  handData,
  isLeft = false,
}: {
  position: [number, number, number];
  handData: HandDetection;
  isLeft?: boolean;
}) {
  const armGroupRef = useRef<Group>(null);
  const baseRef = useRef<Mesh>(null);
  const shoulderRef = useRef<Group>(null);
  const elbowRef = useRef<Group>(null);
  const wristRef = useRef<Group>(null);
  const wristRotatorRef = useRef<Group>(null);
  const jawRef = useRef<Group>(null);

  // Calculate joint angles based on hand position and orientation
  const jointAngles = useMemo(() => {
    if (!handData.detected) {
      return {
        base: 0,
        shoulder: 0,
        elbow: 0,
        wrist: 0,
        wristRotator: 0,
        jaw: handData.open * 0.5,
      };
    }

    // Convert hand position to robot joint angles
    const { x, y, z } = handData.position;
    const { x: qx, y: qy, z: qz, w: qw } = handData.orientation;

    // Simple inverse kinematics approximation
    const baseAngle = Math.atan2(x, z);
    const shoulderAngle =
      Math.atan2(y, Math.sqrt(x * x + z * z)) * (isLeft ? -1 : 1);
    const elbowAngle = Math.sin(Date.now() * 0.001) * 0.3; // Slight movement
    const wristAngle = Math.atan2(qy, qw);
    const wristRotatorAngle = Math.atan2(qx, qw);
    const jawAngle = handData.open * 0.5;

    return {
      base: baseAngle,
      shoulder: shoulderAngle,
      elbow: elbowAngle,
      wrist: wristAngle,
      wristRotator: wristRotatorAngle,
      jaw: jawAngle,
    };
  }, [handData, isLeft]);

  // Update joint rotations
  useFrame(() => {
    if (baseRef.current) {
      baseRef.current.rotation.y = MathUtils.lerp(
        baseRef.current.rotation.y,
        jointAngles.base,
        0.1
      );
    }
    if (shoulderRef.current) {
      shoulderRef.current.rotation.z = MathUtils.lerp(
        shoulderRef.current.rotation.z,
        jointAngles.shoulder,
        0.1
      );
    }
    if (elbowRef.current) {
      elbowRef.current.rotation.z = MathUtils.lerp(
        elbowRef.current.rotation.z,
        jointAngles.elbow,
        0.1
      );
    }
    if (wristRef.current) {
      wristRef.current.rotation.x = MathUtils.lerp(
        wristRef.current.rotation.x,
        jointAngles.wrist,
        0.1
      );
    }
    if (wristRotatorRef.current) {
      wristRotatorRef.current.rotation.y = MathUtils.lerp(
        wristRotatorRef.current.rotation.y,
        jointAngles.wristRotator,
        0.1
      );
    }
  });

  return (
    <group ref={armGroupRef} position={position}>
      {/* Base */}
      <mesh ref={baseRef}>
        <Cylinder args={[0.3, 0.3, 0.2, 16]}>
          <meshStandardMaterial color="#4a5568" />
        </Cylinder>

        {/* Shoulder */}
        <group ref={shoulderRef} position={[0, 0.1, 0]}>
          <Cylinder args={[0.15, 0.15, 0.8, 16]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color="#2d3748" />
          </Cylinder>

          {/* Elbow */}
          <group ref={elbowRef} position={[0, 0, 0.8]}>
            <Sphere args={[0.1]}>
              <meshStandardMaterial color="#4a5568" />
            </Sphere>
            <Cylinder
              args={[0.1, 0.1, 0.6, 16]}
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, 0, 0.3]}
            >
              <meshStandardMaterial color="#2d3748" />
            </Cylinder>

            {/* Wrist */}
            <group ref={wristRef} position={[0, 0, 0.6]}>
              <Sphere args={[0.08]}>
                <meshStandardMaterial color="#4a5568" />
              </Sphere>

              {/* Wrist Rotator */}
              <group ref={wristRotatorRef}>
                <Cylinder args={[0.06, 0.06, 0.3, 16]} position={[0, 0, 0.15]}>
                  <meshStandardMaterial color="#2d3748" />
                </Cylinder>

                {/* Clamping Jaw */}
                <group ref={jawRef} position={[0, 0, 0.3]}>
                  <Box
                    args={[0.1, 0.02, 0.15]}
                    position={[jointAngles.jaw * 0.05, 0.03, 0]}
                  >
                    <meshStandardMaterial color="#e53e3e" />
                  </Box>
                  <Box
                    args={[0.1, 0.02, 0.15]}
                    position={[-jointAngles.jaw * 0.05, -0.03, 0]}
                  >
                    <meshStandardMaterial color="#e53e3e" />
                  </Box>
                </group>
              </group>
            </group>
          </group>
        </group>
      </mesh>
    </group>
  );
}
