'use client'
import { DataFrame, LeftArmBasePosition, MobileGoal, RightArmBasePosition } from "@/app/teletable.model";
import { useXRInputSourceStateContext, XR, XRLayer, XRStore, useXRSessionFeatureEnabled } from "@react-three/xr";
import { Handle, HandleTarget } from "@react-three/handle";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { controllerPositions, ReportController } from "./ReportController";
import { Clamper } from "./Clamper";
import RobotVisualizer, { RobotVisualizerXR } from "@/app/RobotVisualizer";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Euler, Object3D, Quaternion, Vector3 } from "three";
import { XrUi, Layer } from "react-xr-ui";
import { RemoteCameraStream } from "./useMultiVideoCallConnectionClientside";
import { calculateLocalXAngleDeg, calculateLocalZAngleDeg } from "./angleUtils";

// Import fiber separately (doesn't have WebXR dependencies)
const Canvas = dynamic(
    () => import('@react-three/fiber').then(mod => mod.Canvas),
    { ssr: false }
)

// Diagnostics data type for tracking potential flicker sources
type DiagnosticsData = {
    events: string[];
    frameCount: number;
    videoFrameCount: number;
    renderCount: number;
    lastFps: number;
    fpsHistory: number[];
    stateChanges: number;
};

// Table dimensions
const TABLE_WIDTH = 0.8;
const TABLE_DEPTH = 0.6;
const TABLE_HEIGHT = .05;
const TABLE_LEG_HEIGHT = 1;
const HANDLE_SIZE = 0.06;

const TABLE_OFFSET = new Vector3(0, TABLE_LEG_HEIGHT + TABLE_HEIGHT / 2, -0.8);
const flippedMode = true;

// Debug component that shows a green cube at left controller position
function DebugLeftControllerCube({ targetRef }: { targetRef: React.RefObject<THREE.Object3D> }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (meshRef.current) {
            const targetObj = targetRef.current;
            if (!targetObj) {
                return;
            }
            targetObj.updateWorldMatrix(true, true);
            const targetPosition = new Vector3();
            targetObj.getWorldPosition(targetPosition);
            meshRef.current.position.copy(targetPosition);
        }
    });

    return (
        <mesh ref={meshRef}>
            <boxGeometry args={[0.05, 0.05, 0.05]} />
            <meshStandardMaterial color="green" />
        </mesh>
    );
}

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

// Start tracking button component - thin cube at back edge of table
function StartTrackingButton({ onStart, trackingEnabled }: { onStart: () => void, trackingEnabled: boolean }) {
    return (
        <mesh
            position={[-0.07, TABLE_HEIGHT / 2 + 0.04, -TABLE_DEPTH / 2 - 0.02]}
            onClick={onStart}
        >
            <boxGeometry args={[0.12, 0.06, 0.015]} />
            <meshStandardMaterial color={trackingEnabled ? "#22c55e" : "#3b82f6"} />
        </mesh>
    );
}

// Thumbstick toggle button - next to tracking button
function ThumbstickToggleButton({ onToggle, useThumbstick }: { onToggle: () => void, useThumbstick: boolean }) {
    return (
        <mesh
            position={[0.07, TABLE_HEIGHT / 2 + 0.04, -TABLE_DEPTH / 2 - 0.02]}
            onClick={onToggle}
        >
            <boxGeometry args={[0.12, 0.06, 0.015]} />
            <meshStandardMaterial color={useThumbstick ? "#a855f7" : "#6b7280"} />
        </mesh>
    );
}

// Fallback video mesh for when WebXR layers aren't supported - renders on top of everything
function FallbackVideoMesh({ video, scale, onClick, diagnostics }: { video: HTMLVideoElement | undefined, scale: [number, number, number], onClick: () => void, diagnostics?: React.RefObject<DiagnosticsData> }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const textureRef = useRef<THREE.VideoTexture | null>(null);
    const lastVideoTime = useRef(0);

    useEffect(() => {
        if (!video || !meshRef.current) return;

        // Create video texture
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        textureRef.current = texture;

        const material = meshRef.current.material as THREE.MeshBasicMaterial;
        material.map = texture;
        material.needsUpdate = true;

        // NOTE: Removed onBeforeRender depth clearing - was causing flicker by clearing every frame

        return () => {
            texture.dispose();
        };
    }, [video]);

    // Update texture only when video frame actually changes (not every render frame)
    useFrame(() => {
        if (textureRef.current && video && !video.paused) {
            // Only update texture if video time actually changed
            if (video.currentTime !== lastVideoTime.current) {
                textureRef.current.needsUpdate = true;
                lastVideoTime.current = video.currentTime;

                // Track video frame changes for diagnostics
                if (diagnostics) {
                    diagnostics.current.videoFrameCount++;
                }
            }
        }
    });

    return (
        <mesh ref={meshRef} scale={scale} onClick={onClick} renderOrder={99999}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
                toneMapped={false}
                side={THREE.DoubleSide}
                depthTest={false}
                depthWrite={false}
            />
        </mesh>
    );
}

// Draggable video panels component for multiple camera streams
function DraggableVideoPanels({ remoteStreams, diagnostics }: { remoteStreams: RemoteCameraStream[], diagnostics: React.RefObject<DiagnosticsData> }) {
    const videoByCameraIdRef = useRef<Map<string, HTMLVideoElement>>(new Map());
    const [videoDimensions, setVideoDimensions] = useState<Map<string, { width: number; height: number }>>(new Map());

    // Check if WebXR layers are supported - affects how video renders
    const layersEnabled = useXRSessionFeatureEnabled('layers');
    const layersLoggedRef = useRef(false);

    useEffect(() => {
        if (!layersLoggedRef.current) {
            layersLoggedRef.current = true;
            const timestamp = new Date().toISOString().slice(11, 19);
            diagnostics.current.events.push(`${timestamp} LAYERS: ${layersEnabled ? 'ON' : 'OFF (fallback)'}`);
            if (diagnostics.current.events.length > 10) {
                diagnostics.current.events.shift();
            }
        }
    }, [layersEnabled, diagnostics]);

    const videoEntries = useMemo(() => {
        return remoteStreams.map((streamInfo) => {
            let video = videoByCameraIdRef.current.get(streamInfo.cameraId);
            if (!video) {
                video = document.createElement("video");
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true;
                video.setAttribute("playsinline", "true");
                videoByCameraIdRef.current.set(streamInfo.cameraId, video);
                console.log("[XRVideo] created video element", streamInfo.cameraId, streamInfo.label);
            }

            if (video.srcObject !== streamInfo.stream) {
                video.srcObject = streamInfo.stream;
                const trackStates = streamInfo.stream
                    .getVideoTracks()
                    .map((t) => ({ id: t.id, enabled: t.enabled, muted: t.muted, readyState: t.readyState }));
                console.log("[XRVideo] attached stream", streamInfo.cameraId, streamInfo.label, "stereo:", streamInfo.stereoLayout, trackStates);

                // Log stream attachment to diagnostics
                const timestamp = new Date().toISOString().slice(11, 19);
                diagnostics.current.events.push(`${timestamp} STREAM ${streamInfo.label}`);
                if (diagnostics.current.events.length > 10) {
                    diagnostics.current.events.shift();
                }
            }

            return {
                cameraId: streamInfo.cameraId,
                label: streamInfo.label,
                video,
                stereoLayout: streamInfo.stereoLayout,
            };
        });
    }, [remoteStreams]);

    // Calculate aspect ratio for each video, accounting for stereo layout
    const getScaleForVideo = useCallback((cameraId: string, stereoLayout: string | undefined): [number, number, number] => {
        const dims = videoDimensions.get(cameraId);
        const baseHeight = 0.25; // Base height in meters

        if (!dims || dims.width === 0 || dims.height === 0) {
            // Default 16:9 aspect ratio if dimensions not yet available
            return [baseHeight * (16 / 9), baseHeight, 1];
        }

        let effectiveWidth = dims.width;
        // For stereo-left-right, the effective width is half (each eye gets half)
        if (stereoLayout === "stereo-left-right") {
            console.log("[XRVideo] stereo-left-right", dims.width, dims.height);
            effectiveWidth = dims.width / 2;
        }

        const aspectRatio = effectiveWidth / dims.height;
        return [baseHeight * aspectRatio, baseHeight, 1];
    }, [videoDimensions]);

    useEffect(() => {
        const cleanups: Array<() => void> = [];

        for (const entry of videoEntries) {
            const { cameraId, label, video } = entry;

            const logVideoState = (eventName: string) => {
                console.log(
                    `[XRVideo] ${eventName}`,
                    cameraId,
                    label,
                    {
                        readyState: video.readyState,
                        paused: video.paused,
                        width: video.videoWidth,
                        height: video.videoHeight,
                    }
                );
            };

            const updateDimensions = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    const prevDims = videoDimensions.get(cameraId);
                    if (!prevDims || prevDims.width !== video.videoWidth || prevDims.height !== video.videoHeight) {
                        const timestamp = new Date().toISOString().slice(11, 19);
                        diagnostics.current.events.push(`${timestamp} VID ${label}: ${video.videoWidth}x${video.videoHeight}`);
                        // Keep only last 10 events
                        if (diagnostics.current.events.length > 10) {
                            diagnostics.current.events.shift();
                        }
                    }
                    setVideoDimensions((prev) => {
                        const next = new Map(prev);
                        next.set(cameraId, { width: video.videoWidth, height: video.videoHeight });
                        return next;
                    });
                }
            };

            const logToDiagnostics = (event: string) => {
                const timestamp = new Date().toISOString().slice(11, 19);
                diagnostics.current.events.push(`${timestamp} ${event} ${label}`);
                if (diagnostics.current.events.length > 10) {
                    diagnostics.current.events.shift();
                }
            };

            const onLoadedMetadata = () => {
                logVideoState("loadedmetadata");
                updateDimensions();
            };
            const onCanPlay = () => logVideoState("canplay");
            const onPlaying = () => {
                logVideoState("playing");
                logToDiagnostics("PLAY");
            };
            const onWaiting = () => {
                logVideoState("waiting");
                logToDiagnostics("WAIT");
            };
            const onStalled = () => {
                logVideoState("stalled");
                logToDiagnostics("STALL");
            };
            const onError = () => {
                logVideoState("error");
                logToDiagnostics("ERR");
            };
            const onResize = () => {
                logVideoState("resize");
                updateDimensions();
            };

            video.addEventListener("loadedmetadata", onLoadedMetadata);
            video.addEventListener("canplay", onCanPlay);
            video.addEventListener("playing", onPlaying);
            video.addEventListener("waiting", onWaiting);
            video.addEventListener("stalled", onStalled);
            video.addEventListener("error", onError);
            video.addEventListener("resize", onResize);

            // Check if dimensions are already available
            updateDimensions();

            video
                .play()
                .then(() => logVideoState("play-resolved"))
                .catch((err) => {
                    console.warn("[XRVideo] play rejected", cameraId, label, err);
                });

            cleanups.push(() => {
                video.removeEventListener("loadedmetadata", onLoadedMetadata);
                video.removeEventListener("canplay", onCanPlay);
                video.removeEventListener("playing", onPlaying);
                video.removeEventListener("waiting", onWaiting);
                video.removeEventListener("stalled", onStalled);
                video.removeEventListener("error", onError);
                video.removeEventListener("resize", onResize);
            });
        }

        return () => {
            cleanups.forEach((cleanup) => cleanup());
        };
    }, [videoEntries]);

    // Cleanup video elements on unmount
    useEffect(() => {
        return () => {
            for (const video of videoByCameraIdRef.current.values()) {
                video.srcObject = null;
            }
            videoByCameraIdRef.current.clear();
        };
    }, []);

    if (remoteStreams.length === 0) {
        return null;
    }

    // Calculate offset to center the row of videos
    const offset = ((remoteStreams.length - 1) * 0.4) / 2;
    const basePosition: [number, number, number] = [0, TABLE_HEIGHT / 2 + 0.25, -TABLE_DEPTH / 2 - 0.01];

    return (
        <group position={basePosition}>
            {remoteStreams.map((stream, index) => {
                const entry = videoEntries[index];
                const scale: [number, number, number] = entry ? getScaleForVideo(entry.cameraId, entry.stereoLayout) : [0.25 * (16 / 9), 0.25, 1];
                return (
                    <HandleTarget key={stream.cameraId}>
                        <Handle targetRef="from-context">
                            <group position={[index * 0.4 - offset, 0, 0]} renderOrder={9999}>
                                {layersEnabled ? (
                                    <XRLayer
                                        src={entry?.video}
                                        scale={scale}
                                        layout={entry?.stereoLayout === "monodepth" ? "mono" : (entry?.stereoLayout || "mono")}
                                        onClick={() => entry?.video?.play()}
                                        renderOrder={9999}
                                    />
                                ) : (
                                    <FallbackVideoMesh
                                        video={entry?.video}
                                        scale={scale}
                                        onClick={() => entry?.video?.play()}
                                        diagnostics={diagnostics}
                                    />
                                )}
                            </group>
                        </Handle>
                    </HandleTarget>
                );
            })}
        </group>
    );
}

// Diagnostic display component to track potential flicker sources
function DiagnosticsDisplay({ diagnostics }: { diagnostics: React.RefObject<DiagnosticsData> }) {
    const [displayText, setDisplayText] = useState("");
    const lastUpdateTime = useRef(0);
    const lastFrameCount = useRef(0);
    const lastVideoFrameCount = useRef(0);

    useFrame(() => {
        // Update display every 500ms to avoid causing flicker itself
        const now = Date.now();
        const elapsed = now - lastUpdateTime.current;
        if (elapsed < 500) {
            return;
        }

        const d = diagnostics.current;

        // Calculate FPS
        const framesDelta = d.frameCount - lastFrameCount.current;
        const fps = Math.round((framesDelta / elapsed) * 1000);
        lastFrameCount.current = d.frameCount;

        // Calculate video FPS
        const videoFramesDelta = d.videoFrameCount - lastVideoFrameCount.current;
        const videoFps = Math.round((videoFramesDelta / elapsed) * 1000);
        lastVideoFrameCount.current = d.videoFrameCount;

        // Update FPS history
        d.fpsHistory.push(fps);
        if (d.fpsHistory.length > 10) d.fpsHistory.shift();
        d.lastFps = fps;

        lastUpdateTime.current = now;

        // Show most recent events at the bottom (auto-scroll effect)
        const recentEvents = d.events.slice(-5).join("\n");
        const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
        const avgFps = d.fpsHistory.length > 0 ? Math.round(d.fpsHistory.reduce((a, b) => a + b, 0) / d.fpsHistory.length) : 0;

        setDisplayText(
            `FPS: ${fps} (avg: ${avgFps}) VidFPS: ${videoFps}\n` +
            `Frames: ${d.frameCount} VidFrames: ${d.videoFrameCount}\n` +
            `Renders: ${d.renderCount} StateChg: ${d.stateChanges}\n` +
            `Time: ${timestamp}\n` +
            `${recentEvents}`
        );
    });

    return (
        <HandleTarget>
            <Handle targetRef="from-context">
                <group position={[TABLE_WIDTH / 2 + 0.15, TABLE_HEIGHT / 2 + 0.25, 0]}>
                    <XrUi>
                        {/* @ts-expect-error - react-xr-ui types incompatible with fiber v9 rc */}
                        <Layer
                            width={0.45}
                            height={0.35}
                            backgroundColor="rgba(0, 0, 50, 0.95)"
                            borderRadius={0.01}
                            borderWidth={0.003}
                            borderColor="#00ff00"
                            padding={0.015}
                            fontSize={0.024}
                            color="#00ff00"
                            textAlign="left"
                            justifyContent="flex-end"
                            alignItems="flex-start"
                            textContent={displayText}
                        />
                    </XrUi>
                </group>
            </Handle>
        </HandleTarget>
    );
}

function Table({ remoteStreams, onJointValuesUpdate, trackingEnabled, onStartTracking, useThumbstick, onToggleThumbstick, diagnostics }: { remoteStreams: RemoteCameraStream[], onJointValuesUpdate: (robotId: string, joints: number[]) => void, trackingEnabled: boolean, onStartTracking: () => void, useThumbstick: boolean, onToggleThumbstick: () => void, diagnostics: React.RefObject<DiagnosticsData> }) {
    // Track React renders
    diagnostics.current.renderCount++;

    // Corner positions for handles (on top of the table surface)
    const handlePositions: [number, number, number][] = [
        [-TABLE_WIDTH / 2 + HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, -TABLE_DEPTH / 2 + HANDLE_SIZE / 2],
        [TABLE_WIDTH / 2 - HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, -TABLE_DEPTH / 2 + HANDLE_SIZE / 2],
        [-TABLE_WIDTH / 2 + HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, TABLE_DEPTH / 2 - HANDLE_SIZE / 2],
        [TABLE_WIDTH / 2 - HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, TABLE_DEPTH / 2 - HANDLE_SIZE / 2],
    ];

    const currentState = useRef<Record<string, DataFrame>>({});
    const mobileGoal = useRef<MobileGoal>({});
    const tableRef = useRef<THREE.Object3D>(null!);

    // Reusable objects to avoid allocations in useFrame
    const tempTableQuaternion = useRef(new Quaternion());
    const tempLeftInTableSpace = useRef(new Vector3());
    const tempLeftPosition = useRef(new Vector3());
    const tempRightInTableSpace = useRef(new Vector3());
    const tempRightPosition = useRef(new Vector3());
    const tempAxisZ = useRef(new Vector3(0, 0, 1));

    useFrame(() => {
        // Increment frame counter for diagnostics
        diagnostics.current.frameCount++;

        // Only track when enabled
        if (!trackingEnabled) {
            return;
        }

        //get global table position
        const tableObj = tableRef.current;
        if (!tableObj) {
            return;
        }

        tableObj.getWorldQuaternion(tempTableQuaternion.current);

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

        const minGripperAngle = -45;
        const maxGripperAngle = 45;

        // Reuse temp vectors instead of creating new ones
        tempLeftInTableSpace.current.copy(leftController.position);
        tableObj.worldToLocal(tempLeftInTableSpace.current);

        //create leftPosition by taking the leftInTableSpace and applying the leftBase rotation and position
        tempLeftPosition.current.copy(tempLeftInTableSpace.current)
            .applyAxisAngle(tempAxisZ.current, Math.PI)
            .add(LeftArmBasePosition);

        const rightController = controllerPositions.rightController;

        mobileGoal.current.left.position.copy(tempLeftPosition.current);

        mobileGoal.current.left.pitch = calculateLocalXAngleDeg(leftController.quaternion, flippedMode);
        mobileGoal.current.left.roll = calculateLocalZAngleDeg(leftController.quaternion, flippedMode);
        mobileGoal.current.left.gripper = (1 - leftController.triggerValue) * (maxGripperAngle - minGripperAngle) + minGripperAngle;


        if (useThumbstick) {
            //only control roll using thumbstick
            mobileGoal.current.left.pitch = leftController.xyAccumulator.y;

        }

        if (!mobileGoal.current.right) {
            mobileGoal.current.right = {
                position: new Vector3(),
                roll: 0,
                pitch: 0,
                gripper: 0,
            };
        }

        //calculate right position relative to table + Right Robot Base Position
        tempRightInTableSpace.current.copy(rightController.position);
        tableObj.worldToLocal(tempRightInTableSpace.current);

        tempRightPosition.current.copy(tempRightInTableSpace.current)
            .applyAxisAngle(tempAxisZ.current, Math.PI)
            .add(RightArmBasePosition);

        mobileGoal.current.right.position.copy(tempRightPosition.current);

        mobileGoal.current.right.pitch = calculateLocalXAngleDeg(rightController.quaternion, flippedMode);
        mobileGoal.current.right.roll = calculateLocalZAngleDeg(rightController.quaternion, flippedMode);
        mobileGoal.current.right.gripper = (1 - rightController.triggerValue) * (maxGripperAngle - minGripperAngle) + minGripperAngle;



        if (useThumbstick) {
            //only control pitch using thumbstick
            mobileGoal.current.right.pitch = rightController.xyAccumulator.y;
        }



    }, -100);  // Priority -100: run before XR layer updates (which run at 0)

    return (
        <>
            <ReportController identifier="rightController" >
                {/* <Clamper /> */}
            </ReportController>
            <ReportController identifier="leftController" >
                {/* <Clamper /> */}
            </ReportController>
            <group position={TABLE_OFFSET}>
                <HandleTarget>
                    {/* Table surface */}
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH]} />
                        <meshStandardMaterial color="#8B4513" transparent opacity={0.35} />
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

                    {/* Draggable video panels for multiple camera streams */}
                    <DraggableVideoPanels remoteStreams={remoteStreams} diagnostics={diagnostics} />

                    {/* Diagnostics display */}
                    <DiagnosticsDisplay diagnostics={diagnostics} />

                    {/* Start tracking button at front edge of table */}
                    <StartTrackingButton onStart={onStartTracking} trackingEnabled={trackingEnabled} />

                    {/* Thumbstick toggle button */}
                    <ThumbstickToggleButton onToggle={onToggleThumbstick} useThumbstick={useThumbstick} />


                    <group position={[0, 0, TABLE_DEPTH / 2 + 0.05]}>
                        <group ref={tableRef} />
                        <RobotVisualizerXR
                            currentState={currentState}
                            controlMode="ExternalGoal"
                            onJointValuesUpdate={onJointValuesUpdate}
                            mobileGoal={mobileGoal.current}
                            flippedMode={flippedMode}
                        />
                    </group>

                    {/* Position display for left controller */}
                    {/* <ControllerPositionDisplay /> */}

                </HandleTarget>



            </group>

            {/* Debug cube at left controller position */}
            {/* <DebugLeftControllerCube targetRef={tableRef} /> */}

        </>
    );
}

export default function ClientViewXR({
    store,
    remoteStreams,
    onJointValuesUpdate,
    onExitXR
}: {
    store: XRStore | null,
    remoteStreams: RemoteCameraStream[],
    onJointValuesUpdate: (robotId: string, joints: number[]) => void,
    onExitXR: () => void
}) {
    const [trackingEnabled, setTrackingEnabled] = useState(false);
    const [useThumbstick, setUseThumbstick] = useState(true);

    // Diagnostics ref to track events without causing re-renders
    const diagnostics = useRef<DiagnosticsData>({
        events: [],
        frameCount: 0,
        videoFrameCount: 0,
        renderCount: 0,
        lastFps: 0,
        fpsHistory: [],
        stateChanges: 0,
    });

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
                    <Table
                        remoteStreams={remoteStreams}
                        onJointValuesUpdate={onJointValuesUpdate}
                        trackingEnabled={trackingEnabled}
                        onStartTracking={() => setTrackingEnabled(prev => !prev)}
                        useThumbstick={useThumbstick}
                        onToggleThumbstick={() => setUseThumbstick(prev => !prev)}
                        diagnostics={diagnostics}
                    />
                </XR>
            </Canvas>
        </div>
    );
}
