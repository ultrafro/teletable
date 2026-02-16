import { Euler, Object3D, Quaternion, Vector2, Vector3 } from "three";

export function calculateLocalXAngleDeg(worldQuaternion: Quaternion) {
    //get world quaternion


    //get forward, right, and up vectors in world space
    const forward = new Vector3(0, 0, -1);
    const right = new Vector3(1, 0, 0);
    const up = new Vector3(0, 1, 0);
    forward.applyQuaternion(worldQuaternion);
    right.applyQuaternion(worldQuaternion);
    up.applyQuaternion(worldQuaternion);

    //get forward projected onto Y-Z plane
    const forwardProjected = (new Vector2(forward.z, forward.y)).normalize();
    const globalForward = new Vector2(1, 0);

    //calculate using atan2
    const angle = Math.atan2(forwardProjected.y, forwardProjected.x);
    const angleDeg = angle * 180 / Math.PI;
    return angleDeg;

    // const angle = Math.acos(forwardProjected.dot(globalForward));

    // const angleDeg = angle * 180 / Math.PI;
    // return angleDeg;

    // const regularMagnitude = Math.abs(angleDeg);
    // const negativeMagnitude = Math.abs(180 - regularMagnitude);

    // return regularMagnitude < negativeMagnitude ? angleDeg : -(180 - angleDeg);


}


export function calculateLocalZAngleDeg(worldQuaternion: Quaternion) {




    //get forward, right, and up vectors in world space
    const forward = new Vector3(0, 0, -1);
    const right = new Vector3(1, 0, 0);
    const up = new Vector3(0, 1, 0);
    forward.applyQuaternion(worldQuaternion);
    right.applyQuaternion(worldQuaternion);
    up.applyQuaternion(worldQuaternion);

    const globalUp = new Vector3(0, 1, 0);



    const forwardProjectedOntoUp = forward.clone().projectOnVector(globalUp);
    const A = forward.clone().sub(forwardProjectedOntoUp).normalize();
    const B = A.cross(globalUp);
    const upProjectedOntoGlobalUp = up.dot(globalUp);
    const upProjectedOntoGlobalB = up.dot(B);
    const angle = Math.atan2(upProjectedOntoGlobalB, upProjectedOntoGlobalUp);
    const angleDeg = angle * 180 / Math.PI;
    return angleDeg;




    // const globalPlane = globalUp.cross(forward);
    // const thisPlane = up.cross(forward);

    // const dot = globalPlane.normalize().dot(thisPlane.normalize());
    // const angle = Math.acos(dot);
    // const angleDeg = angle * 180 / Math.PI;
    // return angleDeg;

    // //u

    // const rightProjected = (new Vector2(right.x, right.y)).normalize();
    // const globalRight = new Vector2(1, 0);

    // const angle = Math.atan2(rightProjected.y, rightProjected.x);


    // // const angle = Math.acos(rightProjected.dot(globalRight));


    // const angleDeg = angle * 180 / Math.PI;
    // return angleDeg;

    // const regularMagnitude = Math.abs(angleDeg);
    // const negativeMagnitude = Math.abs(180 - regularMagnitude);

    // return regularMagnitude < negativeMagnitude ? angleDeg : -(180 - angleDeg);


    // //get world quaternion
    // const worldQuaternion = thing.getWorldQuaternion(new Quaternion());

    // //get forward, right, and up vectors in world space
    // const forward = new Vector3(0, 0, 1);
    // const right = new Vector3(1, 0, 0);
    // const up = new Vector3(0, 1, 0);
    // forward.applyQuaternion(worldQuaternion);
    // right.applyQuaternion(worldQuaternion);
    // up.applyQuaternion(worldQuaternion);

    // //get up projected onto X-Y plane
    // const upProjected = new Vector2(up.x, up.y);
    // const angle = Math.atan(upProjected.y / upProjected.x);
    // const angleDeg = angle * 180 / Math.PI;
    // return angleDeg;
}

