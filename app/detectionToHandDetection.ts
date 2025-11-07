import { Category, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { BothHands } from "./teletable.model";
import { Matrix4, Quaternion, Vector3 } from "three";

export function detectionToHandDetection(
  detection: NormalizedLandmark[][],
  worldLandmarks: NormalizedLandmark[][],
  currentHands: BothHands,
  handedness: Category[][]
) {
  if (!detection.length) {
    currentHands.left.detected = false;
    currentHands.right.detected = false;
    return currentHands;
  }

  //clear detected status
  currentHands.left.detected = false;
  currentHands.right.detected = false;

  for (let i = 0; i < detection.length; i++) {
    const isLeft = handedness[i]?.[0]?.categoryName == "Left";

    if (isLeft) {
      currentHands.left.detected = true;
    } else {
      currentHands.right.detected = true;
    }

    const hand = detection[i];
    const worldHand = worldLandmarks[i];
    const base = hand[0];
    const indexKnuckle = hand[5];
    const pinkyKnuckle = hand[17];
    const thumb = hand[4];
    const index = hand[8];

    const worldBase = worldHand[0];
    const worldIndexKnuckle = worldHand[5];
    const worldPinkyKnuckle = worldHand[17];
    const worldThumb = worldHand[4];
    const worldIndex = worldHand[8];

    const { x, y, z, qx, qy, qz, qw, open, gx, gy, gz, gqx, gqy, gqz, gqw } =
      extractTransform(
        base,
        indexKnuckle,
        pinkyKnuckle,
        thumb,
        index,
        worldBase,
        worldIndexKnuckle,
        worldPinkyKnuckle,
        worldThumb,
        worldIndex,
        isLeft
      );

    if (isLeft) {
      const baseVec = createVector(base.x, base.y, base.z);
      const indexKnuckleVec = createVector(
        indexKnuckle.x,
        indexKnuckle.y,
        indexKnuckle.z
      );
      const pinkyKnuckleVec = createVector(
        pinkyKnuckle.x,
        pinkyKnuckle.y,
        pinkyKnuckle.z
      );

      currentHands.left.position.x = x;
      currentHands.left.position.y = y;
      currentHands.left.position.z = z;
      currentHands.left.orientation.x = qx;
      currentHands.left.orientation.y = qy;
      currentHands.left.orientation.z = qz;
      currentHands.left.orientation.w = qw;
      currentHands.left.open = open;
      currentHands.left.base.x = baseVec.x;
      currentHands.left.base.y = baseVec.y;
      currentHands.left.base.z = baseVec.z;
      currentHands.left.indexKnuckle.x = indexKnuckleVec.x;
      currentHands.left.indexKnuckle.y = indexKnuckleVec.y;
      currentHands.left.indexKnuckle.z = indexKnuckleVec.z;
      currentHands.left.pinkyKnuckle.x = pinkyKnuckleVec.x;
      currentHands.left.pinkyKnuckle.y = pinkyKnuckleVec.y;
      currentHands.left.pinkyKnuckle.z = pinkyKnuckleVec.z;
      currentHands.left.gripperPosition.x = gx;
      currentHands.left.gripperPosition.y = gy;
      currentHands.left.gripperPosition.z = gz;
      currentHands.left.gripperOrientation.x = gqx;
      currentHands.left.gripperOrientation.y = gqy;
      currentHands.left.gripperOrientation.z = gqz;
      currentHands.left.gripperOrientation.w = gqw;
    } else {
      const baseVec = createVector(base.x, base.y, base.z);
      const indexKnuckleVec = createVector(
        indexKnuckle.x,
        indexKnuckle.y,
        indexKnuckle.z
      );
      const pinkyKnuckleVec = createVector(
        pinkyKnuckle.x,
        pinkyKnuckle.y,
        pinkyKnuckle.z
      );
      currentHands.right.position.x = x;
      currentHands.right.position.y = y;
      currentHands.right.position.z = z;
      currentHands.right.orientation.x = qx;
      currentHands.right.orientation.y = qy;
      currentHands.right.orientation.z = qz;
      currentHands.right.orientation.w = qw;
      currentHands.right.open = open;
      currentHands.right.base.x = baseVec.x;
      currentHands.right.base.y = baseVec.y;
      currentHands.right.base.z = baseVec.z;
      currentHands.right.indexKnuckle.x = indexKnuckleVec.x;
      currentHands.right.indexKnuckle.y = indexKnuckleVec.y;
      currentHands.right.indexKnuckle.z = indexKnuckleVec.z;
      currentHands.right.pinkyKnuckle.x = pinkyKnuckleVec.x;
      currentHands.right.pinkyKnuckle.y = pinkyKnuckleVec.y;
      currentHands.right.pinkyKnuckle.z = pinkyKnuckleVec.z;
      currentHands.right.gripperPosition.x = gx;
      currentHands.right.gripperPosition.y = gy;
      currentHands.right.gripperPosition.z = gz;
      currentHands.right.gripperOrientation.x = gqx;
      currentHands.right.gripperOrientation.y = gqy;
      currentHands.right.gripperOrientation.z = gqz;
      currentHands.right.gripperOrientation.w = gqw;
    }
  }
}

function extractTransform(
  base: NormalizedLandmark,
  knuckle: NormalizedLandmark,
  pinky: NormalizedLandmark,
  thumb: NormalizedLandmark,
  index: NormalizedLandmark,
  worldBase: NormalizedLandmark,
  worldKnuckle: NormalizedLandmark,
  worldPinky: NormalizedLandmark,
  worldThumb: NormalizedLandmark,
  worldIndex: NormalizedLandmark,
  isLeft: boolean
) {
  const useWorldForRotationAndOpen = false;

  const worldBaseVector = createVector(worldBase.x, worldBase.y, worldBase.z);
  const worldKnuckleVector = createVector(
    worldKnuckle.x,
    worldKnuckle.y,
    worldKnuckle.z
  );
  const worldPinkyVector = createVector(
    worldPinky.x,
    worldPinky.y,
    worldPinky.z
  );
  const worldThumbVector = createVector(
    worldThumb.x,
    worldThumb.y,
    worldThumb.z
  );
  const worldIndexVector = createVector(
    worldIndex.x,
    worldIndex.y,
    worldIndex.z
  );

  const nonWorldBaseVector = createVector(base.x, base.y, base.z);
  const nonWorldKnuckleVector = createVector(knuckle.x, knuckle.y, knuckle.z);
  const nonWorldPinkyVector = createVector(pinky.x, pinky.y, pinky.z);

  const baseVector = useWorldForRotationAndOpen
    ? worldBaseVector
    : nonWorldBaseVector;
  const knuckleVector = useWorldForRotationAndOpen
    ? worldKnuckleVector
    : nonWorldKnuckleVector;
  const pinkyVector = useWorldForRotationAndOpen
    ? worldPinkyVector
    : nonWorldPinkyVector;

  const nonWorldCenterVector = nonWorldBaseVector
    .clone()
    .add(nonWorldKnuckleVector)
    .add(nonWorldPinkyVector)
    .divideScalar(3);

  const worldCenterVector = worldBaseVector
    .clone()
    .add(worldKnuckleVector)
    .add(worldPinkyVector)
    .divideScalar(3);

  const centerVector = useWorldForRotationAndOpen
    ? worldCenterVector
    : nonWorldCenterVector;

  const baseToPinkyVector = centerVector.clone().sub(pinkyVector);
  const baseToKnuckleVector = centerVector.clone().sub(knuckleVector);

  const outVector = isLeft
    ? baseToKnuckleVector
        .clone()
        .cross(baseToPinkyVector)
        .normalize()
        .multiplyScalar(-1)
    : baseToPinkyVector
        .clone()
        .cross(baseToKnuckleVector)
        .normalize()
        .multiplyScalar(-1);

  const rightVector = centerVector.clone().sub(baseVector).normalize();

  const upVector = outVector.clone().cross(rightVector).normalize();

  const basisMat = new Matrix4().makeBasis(
    rightVector,
    upVector,
    outVector.multiplyScalar(1)
  );

  const quaternion = new Quaternion();
  quaternion.setFromRotationMatrix(basisMat);

  const worldIndexToThumbVector = worldIndexVector
    .clone()
    .sub(worldThumbVector);
  const worldBaseToKnuckleVector = worldBaseVector
    .clone()
    .sub(worldKnuckleVector);
  const open =
    worldIndexToThumbVector.length() / worldBaseToKnuckleVector.length();

  //have the gripper be an object slightly forward and slightly up from the center
  const gripperPosition = centerVector
    .clone()
    .add(outVector.multiplyScalar(0.2))
    .add(upVector.multiplyScalar(isLeft ? 0.2 : -0.2));
  const gripperQuaternion = new Quaternion();
  gripperQuaternion.copy(quaternion);

  return {
    x: nonWorldCenterVector.x,
    y: nonWorldCenterVector.y,
    z: nonWorldCenterVector.z,
    qx: quaternion.x,
    qy: quaternion.y,
    qz: quaternion.z,
    qw: quaternion.w,
    open,
    gx: gripperPosition.x,
    gy: gripperPosition.y,
    gz: gripperPosition.z,
    gqx: gripperQuaternion.x,
    gqy: gripperQuaternion.y,
    gqz: gripperQuaternion.z,
    gqw: gripperQuaternion.w,
  };
}

function createVector(x: number, y: number, z: number) {
  const tableFlip = true;
  const newVec = new Vector3(-x, -y, -z);

  const zFactor = 10;

  if (tableFlip) {
    newVec.x = -x;
    newVec.y = z;
    newVec.z = y;
    // return new Vector3(-x, z, y);
  }
  // return new Vector3(-x, -y, z);

  // if (tableFlip) {
  //   newVec.y *= zFactor;
  // } else {
  //   newVec.z *= zFactor;
  // }
  return newVec;
}
