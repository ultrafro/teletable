import { Scene, Group, Vector3, Quaternion, Object3D, MathUtils } from "three";
import { URDFRobot, URDFVisual } from "urdf-loader";
import { DOF, Goal, Joint, Link, setUrdfFromIK, Solver } from "closed-chain-ik";
import { drawIKVisualizers } from "./drawIKVisualizers";

export class IKRobot {
  scene: Scene;
  jointVisualizerGroup: Group;
  linkVisualizerGroup: Group;
  urdfRobot: URDFRobot;
  ikRobot: Link | Joint;
  endLink: Link;

  shoulderPanJoint: Joint;
  shoulderLiftJoint: Joint;
  elbowFlexJoint: Joint;
  gripperJoint: Joint;
  wristJoint: Joint;
  pitchJoint: Joint;

  skeletonList: (Link | Joint)[];
  visualSkeletonList: URDFVisual[];

  goal: Goal;
  wristGoal: Goal;
  pitchGoal: Goal;
  gripperGoal: Goal;
  shouldVisualize: boolean = false;

  directMode: boolean = false;
  directValues: number[] = [];

  solver: Solver;
  onJointValuesUpdate?: (jointValues: number[]) => void;

  constructor(
    scene: Scene,
    urdfRobot: URDFRobot,
    ikRobot: Link | Joint,
    onJointValuesUpdate?: (jointValues: number[]) => void
  ) {
    this.goal = new Goal();
    this.wristGoal = new Goal();
    this.pitchGoal = new Goal();
    this.gripperGoal = new Goal();

    this.scene = scene;
    this.urdfRobot = urdfRobot;
    this.onJointValuesUpdate = onJointValuesUpdate;

    this.jointVisualizerGroup = new Group();
    this.linkVisualizerGroup = new Group();

    scene.add(this.jointVisualizerGroup);
    scene.add(this.linkVisualizerGroup);

    // this.ikRobot = ikRobot.children[0] as Link;
    this.ikRobot = ikRobot;

    //clear the DOF of the ikRobot
    (this.ikRobot as Joint).setDoF();

    //set the quaternion of the ikRobot so that Up is Y
    let quaternion = new Quaternion();
    //rotate around x by 90 degrees
    quaternion.setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

    //then rotate around y by 90 degrees
    const yrotator = new Quaternion();
    yrotator.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    quaternion = yrotator.multiply(quaternion);

    //quaternion.setFromAxisAngle(new Vector3(1, 0, 1), Math.PI / 2);
    (this.ikRobot as Joint).setQuaternion(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    this.skeletonList = [];
    this.walkRobotTree(this.ikRobot, this.skeletonList);
    this.visualSkeletonList = [];
    // this.walkRobotTree(this.urdfRobot, this.visualSkeletonList);
    console.log(this.skeletonList);
    this.endLink = this.skeletonList.find(
      (link) => link.name === "gripper_frame_link"
    ) as Link;
    console.log("end link: ", this.endLink);

    this.wristJoint = this.skeletonList.find(
      (link) => link.name === "wrist_roll"
    ) as Joint;
    // this.pitchJoint = (
    //   this.skeletonList.find((link) => link.name === "wrist_link") as Link
    // ).children[0] as Joint;
    this.pitchJoint = this.skeletonList.find(
      (link) => link.name === "wrist_flex"
    ) as Joint;
    this.gripperJoint = this.skeletonList.find(
      (link) => link.name === "gripper"
    ) as Joint;

    this.shoulderPanJoint = this.skeletonList.find(
      (link) => link.name === "shoulder_pan"
    ) as Joint;
    this.shoulderLiftJoint = this.skeletonList.find(
      (link) => link.name === "shoulder_lift"
    ) as Joint;
    this.elbowFlexJoint = this.skeletonList.find(
      (link) => link.name === "elbow_flex"
    ) as Joint;

    //loop through the skeleton list, and set the DOF of each joint to be DOF.X
    // for (const joint of this.skeletonList) {
    //   if (joint instanceof Joint) {
    //     joint.setDoF(DOF.X);
    //   }
    // }

    //this.goal.setGoalDoF(DOF.X, DOF.Y, DOF.Z, DOF.EX, DOF.EY, DOF.EZ);
    this.goal.setGoalDoF(DOF.X, DOF.Y, DOF.Z);

    this.wristJoint.setDoF(DOF.EZ);
    this.pitchJoint.setDoF(DOF.EZ);
    this.gripperJoint.setDoF(DOF.EZ);

    // this.wristGoal.setGoalDoF(DOF.EZ);
    // this.pitchGoal.setGoalDoF(DOF.EZ);
    // this.gripperGoal.setGoalDoF(DOF.EZ);

    this.endLink.getWorldPosition(this.goal.position as unknown as number[]);
    // this.gripperLink.getWorldQuaternion(
    //   this.goal.quaternion as unknown as number[]
    // );

    // this.wristLink.getWorldPosition(
    //   this.wristGoal.position as unknown as number[]
    // );
    // this.wristLink.getWorldQuaternion(
    //   this.wristGoal.quaternion as unknown as number[]
    // );

    // this.pitchLink.getWorldPosition(
    //   this.pitchGoal.position as unknown as number[]
    // );
    // this.pitchLink.getWorldQuaternion(
    //   this.pitchGoal.quaternion as unknown as number[]
    // );

    // this.gripperLink.getWorldPosition(
    //   this.gripperGoal.position as unknown as number[]
    // );
    // this.gripperLink.getWorldQuaternion(
    //   this.gripperGoal.quaternion as unknown as number[]
    // );

    this.goal.makeClosure(this.endLink);
    // this.wristGoal.makeClosure(this.wristLink);
    // this.pitchGoal.makeClosure(this.pitchLink);
    // this.gripperGoal.makeClosure(this.gripperLink);

    this.solver = new Solver(this.ikRobot);
    this.solver.maxIterations = 10;
    this.solver.divergeThreshold = 0.005;
    this.solver.stallThreshold = 1e-3;
    this.solver.translationErrorClamp = 0.25;
    this.solver.translationConvergeThreshold = 1e-3;
    this.solver.restPoseFactor = 0.001;
  }

  setDirectValues(directValues: number[]) {
    this.directValues = directValues;
  }

  walkRobotTree(
    link: Link | Joint | URDFVisual,
    list: (Link | Joint | URDFVisual)[]
  ) {
    for (const child of link.children) {
      list.push(child as Link | Joint);
      this.walkRobotTree(child as Link | Joint | URDFVisual, list);
    }
  }

  setGoalTransform(
    position: Vector3,
    pitch: number,
    roll: number,
    gripper: number
  ) {
    this.goal.setPosition(position.x, position.y, position.z);
    // this.wristGoal.setTargetValue(DOF.EZ, roll);
    // this.pitchGoal.setTargetValue(DOF.EZ, pitch);
    // this.gripperGoal.setTargetValue(DOF.EZ, gripper);

    // this.wristJoint.setTargetValue(DOF.EZ, roll);
    // this.pitchJoint.setTargetValue(DOF.EZ, pitch);
    // this.gripperJoint.setTargetValue(DOF.EZ, gripper);

    this.wristJoint.setDoFValue(DOF.EZ, (roll * Math.PI) / 180);
    this.pitchJoint.setDoFValue(DOF.EZ, (pitch * Math.PI) / 180);
    this.gripperJoint.setDoFValue(DOF.EZ, (gripper * Math.PI) / 180);
    // this.endLink.setTargetValue(DOF.EZ, gripper);
  }

  setBaseTransform(position: Vector3) {
    this.ikRobot.setWorldPosition(position.x, position.y, position.z);
    // this.ikRobot.setWorldQuaternion(
    //   quaternion.x,
    //   quaternion.y,
    //   quaternion.z,
    //   quaternion.w
    // );
  }

  lastDofValues: number[] = [0, 0, 0, 0, 0, 0];

  lastTime = 0;
  update() {
    if (this.directMode) {
      //set the join values directly
      const order = [
        this.shoulderPanJoint,
        this.shoulderLiftJoint,
        this.elbowFlexJoint,
        this.pitchJoint,
        this.wristJoint,
        this.gripperJoint,
      ];
      for (let i = 0; i < order.length; i++) {
        //lerp to this value

        const start = this.lastDofValues[i];
        const end = (this.directValues[i] * Math.PI) / 180;
        const lerped = MathUtils.lerp(start as number, end, 0.1);
        order[i].setDoFValue(DOF.EZ, lerped);
        this.lastDofValues[i] = lerped;

        //order[i].setDoFValue(DOF.EZ, (this.directValues[i] * Math.PI) / 180);
      }
    } else {
      const start = performance.now();
      this.solver.solve();
      const end = performance.now();
    }

    this.ikRobot.updateMatrixWorld();

    setUrdfFromIK(this.urdfRobot, this.ikRobot as Link);

    const jointValues = this.getJointValues();
    if (this.onJointValuesUpdate) {
      this.onJointValuesUpdate(jointValues);
    }

    if (this.shouldVisualize) {
      drawIKVisualizers(
        this.getLinkTransforms(),
        this.getJointTransforms(),
        this.linkVisualizerGroup,
        this.jointVisualizerGroup
      );
    }

    // const now = performance.now();
    // if (now - this.lastTime > 1000) {
    //   this.lastTime = now;
    //   const jointValues = this.getJointValues();
    //   //console.log(jointValues);
    // }
  }

  getJointValues() {
    //loop through ik values, if it is a joint with DOF, print the dof value
    const jointValues: number[] = [];

    jointValues.push(
      (this.shoulderPanJoint.getDoFValue(DOF.EZ) * 180) / Math.PI
    );
    jointValues.push(
      (this.shoulderLiftJoint.getDoFValue(DOF.EZ) * 180) / Math.PI
    );
    jointValues.push((this.elbowFlexJoint.getDoFValue(DOF.EZ) * 180) / Math.PI);
    jointValues.push((this.pitchJoint.getDoFValue(DOF.EZ) * 180) / Math.PI);
    jointValues.push((this.wristJoint.getDoFValue(DOF.EZ) * 180) / Math.PI);
    jointValues.push((this.gripperJoint.getDoFValue(DOF.EZ) * 180) / Math.PI);
    return jointValues;

    // for (const element of this.skeletonList) {
    //   if (element instanceof Joint && element.dof.length > 0) {
    //     jointValues.push(((element as any).dofValues[5] * 180) / Math.PI);
    //   }
    // }
    // return jointValues.slice(0, -1);
  }

  getJointTransforms() {
    const transforms: { position: Vector3; quaternion: Quaternion }[] = [];
    const joints = this.skeletonList.filter(
      (link) => link instanceof Joint
    ) as Joint[];
    //const joints = [this.joint1];
    for (const joint of joints) {
      const position = new Vector3();
      const quaternion = new Quaternion();
      const linkObject = new Object3D();
      const nums = joint.matrixWorld as unknown as number[];
      linkObject.matrix
        .set(
          nums[0],
          nums[1],
          nums[2],
          nums[3],
          nums[4],
          nums[5],
          nums[6],
          nums[7],
          nums[8],
          nums[9],
          nums[10],
          nums[11],
          nums[12],
          nums[13],
          nums[14],
          nums[15]
        )
        .transpose();
      //   linkObject.updateMatrix();
      linkObject.matrix.decompose(position, quaternion, new Vector3());

      // const position = new Vector3();
      // const quaternion = new Quaternion();
      // const positionArr = new Array(3);
      // const quaternionArr = new Array(4);
      // joint.getWorldPosition(positionArr);
      // joint.getWorldQuaternion(quaternionArr);
      // position.set(positionArr[0], positionArr[1], positionArr[2]);
      // quaternion.set(
      //   quaternionArr[0],
      //   quaternionArr[1],
      //   quaternionArr[2],
      //   quaternionArr[3]
      // );
      // joint.getWorldPosition(position);
      // joint.getWorldQuaternion(quaternion);
      transforms.push({ position, quaternion });
    }
    return transforms;
  }

  getLinkTransforms() {
    //loop through links, and return a position and quaternion for each link
    const transforms: { position: Vector3; quaternion: Quaternion }[] = [];
    const links = this.skeletonList.filter(
      (link) => link instanceof Link
    ) as Link[];
    //const links = [this.link1, this.link2];
    for (const link of links) {
      const position = new Vector3();
      const quaternion = new Quaternion();
      const linkObject = new Object3D();
      const nums = link.matrixWorld as unknown as number[];
      linkObject.matrix
        .set(
          nums[0],
          nums[1],
          nums[2],
          nums[3],
          nums[4],
          nums[5],
          nums[6],
          nums[7],
          nums[8],
          nums[9],
          nums[10],
          nums[11],
          nums[12],
          nums[13],
          nums[14],
          nums[15]
        )
        .transpose();
      //   linkObject.updateMatrix();
      linkObject.matrix.decompose(position, quaternion, new Vector3());
      transforms.push({ position, quaternion });
    }
    return transforms;
  }
}
