'use client'
import { DataFrame, LeftArmBasePosition, MobileGoal, RightArmBasePosition } from "@/app/teletable.model";
import { useXRInputSourceStateContext, XR, XRLayer, XRStore } from "@react-three/xr";
import { Handle, HandleTarget } from "@react-three/handle";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { controllerPositions, ReportController } from "./ReportController";
import { Clamper } from "./Clamper";
import RobotVisualizer, { RobotVisualizerXR } from "@/app/RobotVisualizer";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { XrUi, Layer } from "react-xr-ui";

// Import fiber separately (doesn't have WebXR dependencies)
const Canvas = dynamic(
    () => import('@react-three/fiber').then(mod => mod.Canvas),
    { ssr: false }
)

// Table dimensions
const TABLE_WIDTH = 0.8;
const TABLE_DEPTH = 0.6;
const TABLE_HEIGHT = 0.05;
const TABLE_LEG_HEIGHT = 0.7;
const HANDLE_SIZE = 0.06;

// Component to display left controller position on the table
function ControllerPositionDisplay() {
    const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });

    const lastUpdateTime = useRef(0);
    useFrame(() => {
        if (Date.now() - lastUpdateTime.current < 100) {
            return;
        }
        lastUpdateTime.current = Date.now();
        const leftPos = controllerPositions.leftController.position;
        setPos({
            x: Math.round(leftPos.x * 1000) / 1000,
            y: Math.round(leftPos.y * 1000) / 1000,
            z: Math.round(leftPos.z * 1000) / 1000,
        });
    });

    return (
        <group position={[0, TABLE_HEIGHT / 2 + 0.05, -TABLE_DEPTH / 2 + 0.05]}>
            <XrUi>
                {/* @ts-expect-error - react-xr-ui types incompatible with fiber v9 rc */}
                <Layer
                    width={0.35}
                    height={0.4}
                    backgroundColor="rgba(0, 0, 0, 0.8)"
                    borderRadius={0.01}
                    borderWidth={0.002}
                    borderColor="#444444"
                    padding={0.01}
                    fontSize={0.1}
                    color="white"
                    textAlign="center"
                    justifyContent="center"
                    alignItems="center"
                    textContent={`X: ${pos.x.toFixed(3)}  Y: ${pos.y.toFixed(3)}  Z: ${pos.z.toFixed(3)}`}
                />
            </XrUi>
        </group>
    );
}

function Table({ video, onJointValuesUpdate }: { video: HTMLVideoElement | null, onJointValuesUpdate: (robotId: string, joints: number[]) => void }) {

    // Corner positions for handles (on top of the table surface)
    const handlePositions: [number, number, number][] = [
        [-TABLE_WIDTH / 2 + HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, -TABLE_DEPTH / 2 + HANDLE_SIZE / 2],
        [TABLE_WIDTH / 2 - HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, -TABLE_DEPTH / 2 + HANDLE_SIZE / 2],
        [-TABLE_WIDTH / 2 + HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, TABLE_DEPTH / 2 - HANDLE_SIZE / 2],
        [TABLE_WIDTH / 2 - HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, TABLE_DEPTH / 2 - HANDLE_SIZE / 2],
    ];

    const currentState = useRef<Record<string, DataFrame>>({});
    const mobileGoal = useRef<MobileGoal>({});

    useFrame(() => {
        //copy controller positions to currentState
        const leftController = controllerPositions.leftController;
        if (!mobileGoal.current.left) {
            mobileGoal.current.left = {
                position: new Vector3(),
                roll: 0,
                pitch: 0,
                gripper: 0,
            };
        }

        //calculate left position relative to table + Left Robot Base Position
        const leftPosition = new Vector3(leftController.position.x, leftController.position.y, leftController.position.z).add(LeftArmBasePosition);
        mobileGoal.current.left.position.copy(leftPosition);
        mobileGoal.current.left.gripper = leftController.triggerValue;



        const rightController = controllerPositions.rightController;
        if (!mobileGoal.current.right) {
            mobileGoal.current.right = {
                position: new Vector3(),
                roll: 0,
                pitch: 0,
                gripper: 0,
            };
        }

        //calculate right position relative to table + Right Robot Base Position
        const rightPosition = new Vector3(rightController.position.x, rightController.position.y, rightController.position.z).add(RightArmBasePosition);

        mobileGoal.current.right.position.copy(rightPosition);
        mobileGoal.current.right.gripper = rightController.triggerValue;

    });


    return (
        <>
            <ReportController identifier="rightController" >
                <Clamper />
            </ReportController>
            <ReportController identifier="leftController" >
                <Clamper />
            </ReportController>
            <group position={[0, TABLE_LEG_HEIGHT + TABLE_HEIGHT / 2, -0.8]}>
                <HandleTarget>
                    {/* Table surface */}
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH]} />
                        <meshStandardMaterial color="#8B4513" />
                    </mesh>


                    {/* Handle cubes at corners */}
                    {handlePositions.map((pos, i) => (
                        <Handle key={`handle-${i}`} targetRef="from-context">
                            <mesh position={pos}>
                                <boxGeometry args={[HANDLE_SIZE, HANDLE_SIZE, HANDLE_SIZE]} />
                                <meshStandardMaterial color="#ff6b35" />
                            </mesh>
                        </Handle>
                    ))}

                    {/* Video screen on the table */}
                    {video && (
                        <XRLayer
                            position={[0, TABLE_HEIGHT / 2 + 0.01, 0]}
                            rotation={[-Math.PI / 2, 0, 0]}
                            onClick={() => video?.play()}
                            scale={0.4}
                            src={video}
                        />
                    )}

                    <RobotVisualizerXR
                        currentState={currentState}
                        controlMode="ExternalGoal"
                        onJointValuesUpdate={onJointValuesUpdate}
                        mobileGoal={mobileGoal.current}
                    />

                    {/* Position display for left controller */}
                    <ControllerPositionDisplay />

                </HandleTarget>
            </group>
        </>
    );
}

export default function ClientViewXR({
    store,
    remoteStream,
    onJointValuesUpdate,
    onExitXR
}: {
    store: XRStore | null,
    remoteStream: MediaStream | null,
    onJointValuesUpdate: (robotId: string, joints: number[]) => void,
    onExitXR: () => void
}) {
    const video = useMemo(() => {
        if (!remoteStream) return null;
        const video = document.createElement('video');
        video.srcObject = remoteStream;
        video.autoplay = true;

        return video;
    }, [remoteStream]);


    if (!store) {
        return <div>Loading...</div>
    }

    return (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh' }}>
            <button
                onClick={onExitXR}
                style={{
                    position: 'absolute',
                    top: '1rem',
                    left: '1rem',
                    zIndex: 10,
                    padding: '0.5rem 1rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '1rem'
                }}
            >
                ← Back
            </button>
            <Canvas style={{ position: 'absolute', inset: 0, touchAction: 'none', zIndex: 1 }}>
                <XR store={store}>
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[5, 5, 5]} intensity={0.8} />
                    <Table video={video} onJointValuesUpdate={onJointValuesUpdate} />
                </XR>
            </Canvas>
        </div>
    );
}