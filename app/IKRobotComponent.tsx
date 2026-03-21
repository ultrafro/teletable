import { useFrame, useThree } from "@react-three/fiber";
import { urdfRobotToIKRoot } from "closed-chain-ik";
import { RefObject, useEffect, useRef, useState } from "react";
import { Vector3, LoadingManager, Group, Object3D, Color } from "three";
import URDFLoader from "urdf-loader";
import { IKRobot } from "./IKRobot";
import { DataFrame } from "./teletable.model";

export function IKRobotComponent({
  //basePostion,
  goalPosition,
  goalOtherValues,
  isFlipped,
  onJointValuesUpdate,
  useDirectValues,
  currentState,
  handId,
  color,
}: {
  //basePostion: Vector3;
  goalPosition: Vector3;
  goalOtherValues: {
    roll: number;
    pitch: number;
    gripper: number;
  };
  isFlipped?: boolean;
  onJointValuesUpdate: (jointValues: number[]) => void;
  useDirectValues: boolean;
  currentState: RefObject<Record<string, DataFrame>>;
  handId: string;
  color: Color;
}) {
  const { scene } = useThree();
  const [IKRobotClass, setIKRobotClass] = useState<IKRobot | null>(null);
  const groupRef = useRef<Group>(null!);

  const [groupReady, setGroupReady] = useState(false);

  const colorRef = useRef(color);
  colorRef.current = color;

  const hasLoaded = useRef(false);
  const hasAppliedColor = useRef(false);
  const robotObjRef = useRef<Object3D | null>(null);
  const lastMaterialCount = useRef(0);
  const stableFrames = useRef(0);
  const originalColors = useRef<Map<any, Color>>(new Map());

  const countMaterials = (target: Object3D): number => {
    let count = 0;
    target.traverse((child) => {
      const obj = child as any;
      if (obj.material) count++;
    });
    return count;
  };

  const cloneMaterials = (target: Object3D) => {
    target.traverse((child) => {
      const obj = child as any;
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((mat: any) => {
            const cloned = mat.clone();
            if (cloned.color) {
              originalColors.current.set(cloned, cloned.color.clone());
            }
            return cloned;
          });
        } else {
          obj.material = obj.material.clone();
          if (obj.material.color) {
            originalColors.current.set(obj.material, obj.material.color.clone());
          }
        }
      }
    });
  };

  const applyColor = (target: Object3D, tint: Color) => {
    const tintStrength = 0.5;
    target.traverse((child) => {
      const obj = child as any;
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((mat: any) => {
          if (mat.color) {
            const original = originalColors.current.get(mat);
            if (original) {
              mat.color.setRGB(
                original.r * (1 - tintStrength) + tint.r * tintStrength,
                original.g * (1 - tintStrength) + tint.g * tintStrength,
                original.b * (1 - tintStrength) + tint.b * tintStrength
              );
            }
          }
        });
      }
    });
  };

  useEffect(() => {
    if (hasLoaded.current || !groupReady) {
      return;
    }
    hasLoaded.current = true;

    const manager = new LoadingManager();
    const loader = new URDFLoader(manager);

    // loader.packages = {
    //   packageName: "./package/dir/", // The equivalent of a (list of) ROS package(s):// directory
    // };
    loader.load(
      "/SO101/so101_new_calib.urdf", // The path to the URDF within the package OR absolute
      (robot) => {
        robotObjRef.current = robot;
        groupRef.current.add(robot as any);

        // robot.traverse((c) => {
        //   if ((c as any).jointType === "floating") {
        //     (c as any).jointType = "fixed";
        //   }
        // });

        const ikRobot = urdfRobotToIKRoot(robot, false);
        // console.log(ikRobot);

        const newIKRobot = new IKRobot(
          groupRef.current as unknown as Object3D,
          robot,
          ikRobot,
          onJointValuesUpdate
        );
        setIKRobotClass(newIKRobot);
      }
    );
  }, [scene, groupReady]);

  useEffect(() => {
    if (IKRobotClass) {
      IKRobotClass.onJointValuesUpdate = onJointValuesUpdate;
    }
  }, [IKRobotClass, onJointValuesUpdate]);

  useEffect(() => {
    if (!robotObjRef.current || !hasAppliedColor.current) return;
    applyColor(robotObjRef.current, color);
  }, [color]);

  useFrame(() => {
    if (!groupReady && !!groupRef.current) {
      setGroupReady(true);
    }

    // Apply color once materials are available and count has stabilized
    if (!hasAppliedColor.current && robotObjRef.current) {
      const currentCount = countMaterials(robotObjRef.current);
      if (currentCount > 0) {
        if (currentCount === lastMaterialCount.current) {
          stableFrames.current++;
        } else {
          lastMaterialCount.current = currentCount;
          stableFrames.current = 0;
        }
        if (stableFrames.current >= 5) {
          cloneMaterials(robotObjRef.current);
          applyColor(robotObjRef.current, colorRef.current);
          hasAppliedColor.current = true;
        }
      }
    }

    if (IKRobotClass) {
      IKRobotClass.setHeightLimits(isFlipped ? -1.0 : 0.0, 1.0);

      //update base
      //IKRobotClass.setBaseTransform(basePostion);

      //update goal
      IKRobotClass.setGoalTransform(
        goalPosition,
        // basePostion.clone().add(goalPosition),
        goalOtherValues.pitch,
        goalOtherValues.roll,
        goalOtherValues.gripper
      );

      if (useDirectValues) {
        if (!currentState.current[handId]) {
          currentState.current[handId] = {
            joints: [],
            type: "SO101",
          };
        }
        if (!currentState.current[handId].joints) {
          currentState.current[handId].joints = [];
        }
        IKRobotClass.setDirectValues(currentState.current[handId].joints);
      }

      IKRobotClass.directMode = useDirectValues;

      IKRobotClass.update();
    }
  });
  return <group ref={groupRef} />;
}
