import { useXRInputSourceState } from "@react-three/xr";

import {
    useXRAnchor,
    XRSpace,
    useXRInputSourceEvent,
    XR,
} from "@react-three/xr";
import { createContext, useEffect, useRef } from "react";
import { Mesh, Object3D, Quaternion, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { ControllerIdentifier, getAAndB, ReportControllerContext } from "./ReportController.model";


export function ReportController({
    identifier,
    children
}: {
    identifier: ControllerIdentifier;
    children?: React.ReactNode;
}) {

    const { a, b } = getAAndB(identifier);


    useEffect(() => {
        (window as any).controllerPositions = controllerPositions;


    }, []);




    const inputState = useXRInputSourceState(a as any, b as any);

    const meshRef = useRef<Mesh>(null!);

    useEffect(() => {
        const valid = !!inputState?.inputSource?.targetRaySpace;
        const thing = controllerPositions[identifier];



        thing.online = valid;
        thing.id = inputState?.id || -1;

        return () => {
            thing.online = false;
        };
    }, [inputState?.inputSource?.targetRaySpace, inputState?.id, identifier]);

    useFrame(() => {
        if (!meshRef.current) {
            return;
        }

        const thing = controllerPositions[identifier];

        const mesh = meshRef.current as unknown as Object3D;

        if (thing.object !== mesh) {
            thing.object = mesh;
        }

        // Use getWorldPosition/getWorldQuaternion for proper XRSpace coordinate extraction
        mesh.getWorldPosition(thing.position);
        mesh.getWorldQuaternion(thing.quaternion);

        const triggerValue = inputState?.gamepad?.['xr-standard-trigger']?.button ?? 0;
        thing.triggerValue = triggerValue;
    });

    if (!inputState?.inputSource?.targetRaySpace) {
        return null;
    }

    return (
        <>
            <XRSpace space={inputState?.inputSource?.targetRaySpace}>
                <ReportControllerContext.Provider value={{ identifier }}>
                    {children}
                </ReportControllerContext.Provider>
                <mesh ref={meshRef}>
                    <boxGeometry args={[0.05, 0.05, 0.05]} />
                    <meshBasicMaterial color={"blue"} />
                </mesh>
            </XRSpace>
        </>
    );
}



export const controllerPositions: Record<ControllerIdentifier, {
    position: Vector3;
    triggerValue: number;
    quaternion: Quaternion;
    id: string | number;
    online: boolean;
    object: Object3D;
}> = {
    rightHand: {
        position: new Vector3(),
        triggerValue: 0,
        quaternion: new Quaternion(),
        id: 0,
        online: false,
        object: new Object3D(),
    },
    leftHand: {
        position: new Vector3(),
        triggerValue: 0,
        quaternion: new Quaternion(),
        id: 1,
        online: false,
        object: new Object3D(),
    },
    rightController: {
        position: new Vector3(),
        triggerValue: 0,
        quaternion: new Quaternion(),
        id: 2,
        online: false,
        object: new Object3D(),
    },
    leftController: {
        position: new Vector3(),
        triggerValue: 0,
        quaternion: new Quaternion(),
        id: 3,
        online: false,
        object: new Object3D(),
    },
};
