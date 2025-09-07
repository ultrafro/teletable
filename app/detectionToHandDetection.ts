import { Category, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { BothHands, DefaultHandDetection } from "./teletable.model";
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
      currentHands.left.position.x = x;
      currentHands.left.position.y = y;
      currentHands.left.position.z = z;
      currentHands.left.orientation.x = qx;
      currentHands.left.orientation.y = qy;
      currentHands.left.orientation.z = qz;
      currentHands.left.orientation.w = qw;
      currentHands.left.open = open;
      currentHands.left.base.x = -base.x;
      currentHands.left.base.y = -base.y;
      currentHands.left.base.z = base.z;
      currentHands.left.indexKnuckle.x = -indexKnuckle.x;
      currentHands.left.indexKnuckle.y = -indexKnuckle.y;
      currentHands.left.indexKnuckle.z = indexKnuckle.z;
      currentHands.left.pinkyKnuckle.x = -pinkyKnuckle.x;
      currentHands.left.pinkyKnuckle.y = -pinkyKnuckle.y;
      currentHands.left.pinkyKnuckle.z = pinkyKnuckle.z;
      currentHands.left.gripperPosition.x = gx;
      currentHands.left.gripperPosition.y = gy;
      currentHands.left.gripperPosition.z = gz;
      currentHands.left.gripperOrientation.x = gqx;
      currentHands.left.gripperOrientation.y = gqy;
      currentHands.left.gripperOrientation.z = gqz;
      currentHands.left.gripperOrientation.w = gqw;
    } else {
      currentHands.right.position.x = x;
      currentHands.right.position.y = y;
      currentHands.right.position.z = z;
      currentHands.right.orientation.x = qx;
      currentHands.right.orientation.y = qy;
      currentHands.right.orientation.z = qz;
      currentHands.right.orientation.w = qw;
      currentHands.right.open = open;
      currentHands.right.base.x = -base.x;
      currentHands.right.base.y = -base.y;
      currentHands.right.base.z = base.z;
      currentHands.right.indexKnuckle.x = -indexKnuckle.x;
      currentHands.right.indexKnuckle.y = -indexKnuckle.y;
      currentHands.right.indexKnuckle.z = indexKnuckle.z;
      currentHands.right.pinkyKnuckle.x = -pinkyKnuckle.x;
      currentHands.right.pinkyKnuckle.y = -pinkyKnuckle.y;
      currentHands.right.pinkyKnuckle.z = pinkyKnuckle.z;
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

  const worldBaseVector = new Vector3(-worldBase.x, -worldBase.y, worldBase.z);
  const worldKnuckleVector = new Vector3(
    -worldKnuckle.x,
    -worldKnuckle.y,
    worldKnuckle.z
  );
  const worldPinkyVector = new Vector3(
    -worldPinky.x,
    -worldPinky.y,
    worldPinky.z
  );
  const worldThumbVector = new Vector3(
    -worldThumb.x,
    -worldThumb.y,
    worldThumb.z
  );
  const worldIndexVector = new Vector3(
    -worldIndex.x,
    -worldIndex.y,
    worldIndex.z
  );

  const nonWorldBaseVector = new Vector3(-base.x, -base.y, base.z);
  const nonWorldKnuckleVector = new Vector3(-knuckle.x, -knuckle.y, knuckle.z);
  const nonWorldPinkyVector = new Vector3(-pinky.x, -pinky.y, pinky.z);

  const nonWorldThumbVector = new Vector3(-thumb.x, -thumb.y, thumb.z);
  const nonWorldIndexVector = new Vector3(-index.x, -index.y, index.z);

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
