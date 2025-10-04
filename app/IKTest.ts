import { Solver, Joint, Link, Goal, DOF } from "closed-chain-ik-tiny";
import { Object3D, Quaternion, Vector3 } from "three";
export class IKTest {
  goal: Goal;
  link1: Link;
  joint1: Joint;
  link2: Link;
  joint2: Joint;
  link3: Link;
  solver: Solver;

  constructor() {
    // Create links and joints
    this.link1 = new Link();

    this.joint1 = new Joint();
    this.joint1.setDoF(DOF.EY);
    this.joint1.setDoFValues(0);

    this.link2 = new Link();

    this.joint2 = new Joint();
    this.joint2.setDoF(DOF.EZ);
    this.joint2.setDoFValues(0);

    this.link3 = new Link();

    //construct:
    this.link1.addChild(this.joint1);
    this.joint1.addChild(this.link2);
    this.link2.addChild(this.joint2);
    this.joint2.addChild(this.link3);

    this.joint1.setWorldPosition(0, 0, 0);
    this.joint2.setWorldPosition(0, 1.0, 0);
    this.link3.setWorldPosition(0, 2.0, 0);

    this.goal = new Goal();

    this.goal.setGoalDoF(DOF.X, DOF.Y, DOF.Z);
    this.link3.getWorldPosition(this.goal.position);
    this.link3.getWorldQuaternion(this.goal.quaternion);

    this.goal.makeClosure(this.link3);

    // this.link2 = new Link();

    // this.joint2 = new Joint();
    // this.joint2.setDoF(DOF.EZ);
    // this.joint2.setPosition(0, 0.5, 0);

    // this.link2 = new Link();
    // this.link2.setPosition(0, 0.1, 0);

    // this.link2 = new Link();
    // this.link2.setPosition(0, 0.5, 0);

    //this.joint1.setDoF(DOF.EX);
    //this.joint1.setDoF(DOF.EY);
    // this.joint1.setDoF(DOF.EZ);
    // this.joint1.setPosition(0, 0.5, 0);
    // this.joint1.setDoFValues(Math.PI / 4);
    // this.joint1.setDoFValues(0);

    // this.link2 = new Link();
    // this.link2.setPosition(0, 0.5, 0);

    // this.joint2 = new Joint();
    // this.joint2.setDoF(DOF.EX);
    // this.joint2.setPosition(0, 1, 0);
    // this.joint2.setDoFValues(Math.PI / 4);

    // this.link3 = new Link();
    // this.link3.setPosition(0, 1, 0);

    // this.link1.addChild(this.joint1);
    // this.joint1.addChild(this.joint2);
    // this.joint2.addChild(this.link2);

    // Create the goal
    // this.goal = new Goal();

    // this.goal.setGoalDoF(DOF.X, DOF.Y, DOF.Z);
    // this.link2.getWorldPosition(this.goal.position);
    // this.link2.getWorldQuaternion(this.goal.quaternion);
    // this.link3.getWorldPosition(this.goal.position);
    // this.link3.getWorldQuaternion(this.goal.quaternion);

    // Create structure
    // this.link1.addChild(this.joint1);
    // this.joint1.addChild(this.link2);
    //this.goal.makeClosure(this.link2);
    // this.link2.addChild(this.joint2);
    // this.joint2.addChild(this.link3);

    // this.goal.makeClosure(this.link3);

    // create solver
    this.solver = new Solver(this.link1);
    this.solver.maxIterations = 10;
    this.solver.divergeThreshold = 0.005;
    this.solver.stallThreshold = 1e-3;
    this.solver.translationErrorClamp = 0.25;
    this.solver.translationConvergeThreshold = 1e-3;
    this.solver.restPoseFactor = 0.001;
  }

  setGoalTransform(position: Vector3, quaternion: Quaternion) {
    this.goal.setPosition(position.x, position.y, position.z);
    this.goal.setQuaternion(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );
    //this.goal.position.set(position.x, position.y, position.z);
    // this.goal.quaternion.set(
    //   quaternion.x,
    //   quaternion.y,
    //   quaternion.z,
    //   quaternion.w
    // );
  }

  getJointValues() {
    return null;
    // return this.joint1.getDoFValues();
  }

  getJointTransforms() {
    const transforms: { position: Vector3; quaternion: Quaternion }[] = [];
    const joints = [this.joint1, this.joint2];
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
    const links = [this.link1, this.link2, this.link3];
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

  update() {
    const start = performance.now();
    this.solver.solve();
    this.link1.updateMatrixWorld(true);
    const end = performance.now();
    //console.log(`IK solved in ${end - start}ms`);
  }
}
