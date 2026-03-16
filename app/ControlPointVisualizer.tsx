import {
  Box,
  Cylinder,
  DragControls,
  PivotControls,
  Sphere,
  Text,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Group,
  Matrix4,
  Mesh,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { HandDetection, RobotOtherValues } from "./teletable.model";
import ControlSliders from "./ControlSliders";

export default function ControlPointVisualizer({
  position,
  basePosition,
  baseRotation,
  otherValues,
  handId,
  offset,
  color,
  hideControlSliders,
}: {
  position: Vector3;
  basePosition: Vector3;
  baseRotation: [number, number, number];
  otherValues: RobotOtherValues;
  handId: string;
  offset: Vector3;
  color: string;
  hideControlSliders?: boolean;
}) {

  //starting position is the point when you apply baseRotation and basePosition to the position
  const [startingPosition, setStartingPosition] = useState(position.clone());




  const handRef = useRef<Group>(null);
  const gripperRef = useRef<Group>(null);

  const baseRef = useRef<Mesh>(null);

  const showDebug = false;

  // State for sliders
  const [wristValue, setWristValue] = useState(0);
  const [gripperValue, setGripperValue] = useState(0);
  const [pitchValue, setPitchValue] = useState(0);

  useFrame(() => {
    if (handRef.current) {
      // Update position based on hand data
      const targetPos = new Vector3(position.x, position.y, position.z);

      handRef.current.position.copy(targetPos);

      // handRef.current.position.lerp(targetPos, 0.1);

      // // Update rotation based on orientation
      // const targetQuat = new Quaternion(
      //   handData.orientation.x,
      //   handData.orientation.y,
      //   handData.orientation.z,
      //   handData.orientation.w
      // );

      // handRef.current.quaternion.slerp(targetQuat, 0.1);
    }

    // if (baseRef.current) {
    //   baseRef.current.position.x = basePosition.x;
    //   baseRef.current.position.y = basePosition.y;
    //   baseRef.current.position.z = basePosition.z;
    // }
  });

  const [handMatrix, setHandMatrix] = useState<Matrix4>(
    new Matrix4().compose(
      position.clone(),
      new Quaternion(),
      new Vector3(1, 1, 1)
    )
  );

  //   useFrame(() => {
  //     //convert hand data to a matrix:
  //     const matrix = new Matrix4().compose(
  //       new Vector3(
  //         handData.position.x,
  //         handData.position.y,
  //         handData.position.z
  //       ),
  //       new Quaternion(
  //         handData.orientation.x,
  //         handData.orientation.y,
  //         handData.orientation.z,
  //         handData.orientation.w
  //       ),
  //       new Vector3(1, 1, 1)
  //     );
  //     if (handRef.current) {
  //       handRef.current.matrix.copy(matrix);
  //     }
  //   });

  useEffect(() => {
    otherValues.gripper = gripperValue;
    otherValues.pitch = pitchValue;
    otherValues.roll = wristValue;
  }, [wristValue, gripperValue, pitchValue]);

  useEffect(() => {
    //update position accordingly
    const rotatedPosition = startingPosition.clone().applyAxisAngle(new Vector3(0, 0, 1), baseRotation[2]);
    position.x = rotatedPosition.x + basePosition.x;
    position.y = rotatedPosition.y + basePosition.y;
    position.z = rotatedPosition.z + basePosition.z;


  }, [startingPosition])

  const directBallControl = true;
  const { camera } = useThree();
  const dragStartPosRef = useRef<Vector3 | null>(null);
  const dragPlaneRef = useRef<Plane | null>(null);

  return (
    <group>
      {/* Main hand rectangle - made thicker for visibility */}
      {/* <Box ref={handRef} args={[0.05, 0.05, 0.05]}>
        <meshStandardMaterial
          color={color}
          metalness={0.1}
          roughness={0.3}
          emissive={color}
          emissiveIntensity={1}
          transparent={false}
          depthWrite={true}
          depthTest={true}
        />
      </Box> */}

      {directBallControl ? (
        <DragControls
          matrix={handMatrix}
          autoTransform={false}
          onDragStart={(origin) => {
            // Store the starting position and create the drag plane
            dragStartPosRef.current = origin.clone();
            const cameraDirection = new Vector3();
            camera.getWorldDirection(cameraDirection);
            dragPlaneRef.current = new Plane(cameraDirection, 0);
            dragPlaneRef.current.constant =
              -dragPlaneRef.current.normal.dot(origin);
          }}
          onDrag={(localMatrix, deltaLocal, worldMatrix, deltaWorld) => {
            const newPosition = new Vector3();
            const rotation = new Quaternion();
            const scale = new Vector3();
            localMatrix.decompose(newPosition, rotation, scale);

            //rotate the new position by the base rotation
            //and offset it by the base position
            const rotatedPosition = newPosition.clone().applyAxisAngle(new Vector3(0, 0, 1), baseRotation[2]);
            position.x = rotatedPosition.x + basePosition.x;
            position.y = rotatedPosition.y + basePosition.y;
            position.z = rotatedPosition.z + basePosition.z;
            // const offsetPosition = rotatedPosition.clone().add(basePosition);


            // position.x = newPosition.x + 0 * offset.x;
            // position.y = newPosition.y + 0 * offset.y;
            // position.z = newPosition.z + 0 * offset.z;

            //rotate this matrix by 180 degrees in the z axis
            // const rotator = new Matrix4().makeRotationZ(Math.PI);
            // localMatrix.multiply(rotator);

            //print the position y of hte new world matrix
            console.log(localMatrix.elements[13]);



            setHandMatrix(localMatrix.clone());
            //setHandMatrix(worldMatrix.clone());

            // // Get the new world position from the drag
            // const newWorldPos = new Vector3();
            // worldMatrix.decompose(
            //   newWorldPos,
            //   new Quaternion(),
            //   new Vector3(1, 1, 1)
            // );

            // // Project the position onto the fixed drag plane
            // const projectedPos = new Vector3();
            // if (dragPlaneRef.current) {
            //   dragPlaneRef.current.projectPoint(newWorldPos, projectedPos);
            // } else {
            //   projectedPos.copy(newWorldPos);
            // }

            // // Update hand matrix with projected position
            // const newMatrix = new Matrix4().compose(
            //   projectedPos,
            //   new Quaternion(),
            //   new Vector3(1, 1, 1)
            // );

            // setHandMatrix(newMatrix);

            // Update position reference
            // position.x = projectedPos.x;
            // position.y = projectedPos.y;
            // position.z = projectedPos.z;
          }}
          onDragEnd={() => {
            dragStartPosRef.current = null;
            dragPlaneRef.current = null;
          }}
        >
          <Sphere args={[0.02]} renderOrder={999}>
            <meshStandardMaterial
              //color="#ef4444"
              color={'#00ffff'}
              transparent
              opacity={0.5}
              // emissive="#ef4444"
              emissive={'#00ffff'}
              emissiveIntensity={0.5}
              depthTest={false}
              depthWrite={false}
            />
          </Sphere>
        </DragControls>
      ) : (
        <PivotControls
          key={"pivot-control-" + handId}
          anchor={[0, 0, 0]}
          matrix={handMatrix}
          //   matrix={leftHandMatrix}
          enabled={true}
          scale={0.2}
          lineWidth={3}
          fixed={false}
          activeAxes={[true, true, true]}
          disableRotations={true}
          disableScaling={true}
          axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
          hoveredColor="#f59e0b"
          annotations={true}
          autoTransform={false}
          onDrag={(localMatrix, deltaLocal, worldMatrix, deltaWorld) => {
            const newPosition = new Vector3();
            const rotation = new Quaternion();
            const scale = new Vector3();
            localMatrix.decompose(newPosition, rotation, scale);

            position.x = newPosition.x + 0 * offset.x;
            position.y = newPosition.y + 0 * offset.y;
            position.z = newPosition.z + 0 * offset.z;
            // handData.orientation.x = rotation.x;
            // handData.orientation.y = rotation.y;
            // handData.orientation.z = rotation.z;
            // handData.orientation.w = rotation.w;

            setHandMatrix(localMatrix.clone());
          }}
        >
          <Sphere args={[0.01]}>
            <meshStandardMaterial color="#ef4444" transparent opacity={0.6} />
          </Sphere>
        </PivotControls>
      )}

      {/* Three sliders for wrist, pitch, and gripper */}
      {!hideControlSliders && <group position={startingPosition} >
        <ControlSliders
          wristValue={wristValue}
          gripperValue={gripperValue}
          pitchValue={pitchValue}
          onWristChange={setWristValue}
          onGripperChange={setGripperValue}
          onPitchChange={setPitchValue}
          position={[0, -0.05, 0]}
        />
      </group>}
    </group>
  );
}
