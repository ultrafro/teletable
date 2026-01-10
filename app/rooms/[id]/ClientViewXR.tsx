'use client'
import { DataFrame } from "@/app/teletable.model";
import { XR, XRLayer, XRStore } from "@react-three/xr";
import { Handle, HandleTarget } from "@react-three/handle";
import dynamic from "next/dynamic";
import { useMemo } from "react";

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

function Table({ video }: { video: HTMLVideoElement | null }) {
    // Corner positions for handles (on top of the table surface)
    const handlePositions: [number, number, number][] = [
        [-TABLE_WIDTH / 2 + HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, -TABLE_DEPTH / 2 + HANDLE_SIZE / 2],
        [TABLE_WIDTH / 2 - HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, -TABLE_DEPTH / 2 + HANDLE_SIZE / 2],
        [-TABLE_WIDTH / 2 + HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, TABLE_DEPTH / 2 - HANDLE_SIZE / 2],
        [TABLE_WIDTH / 2 - HANDLE_SIZE / 2, TABLE_HEIGHT / 2 + HANDLE_SIZE / 2, TABLE_DEPTH / 2 - HANDLE_SIZE / 2],
    ];

    // Leg positions
    const legPositions: [number, number, number][] = [
        [-TABLE_WIDTH / 2 + 0.03, -TABLE_LEG_HEIGHT / 2, -TABLE_DEPTH / 2 + 0.03],
        [TABLE_WIDTH / 2 - 0.03, -TABLE_LEG_HEIGHT / 2, -TABLE_DEPTH / 2 + 0.03],
        [-TABLE_WIDTH / 2 + 0.03, -TABLE_LEG_HEIGHT / 2, TABLE_DEPTH / 2 - 0.03],
        [TABLE_WIDTH / 2 - 0.03, -TABLE_LEG_HEIGHT / 2, TABLE_DEPTH / 2 - 0.03],
    ];

    return (
        <group position={[0, TABLE_LEG_HEIGHT + TABLE_HEIGHT / 2, -0.8]}>
            <HandleTarget>
                {/* Table surface */}
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH]} />
                    <meshStandardMaterial color="#8B4513" />
                </mesh>

                {/* Table legs */}
                {legPositions.map((pos, i) => (
                    <mesh key={`leg-${i}`} position={pos}>
                        <boxGeometry args={[0.04, TABLE_LEG_HEIGHT, 0.04]} />
                        <meshStandardMaterial color="#654321" />
                    </mesh>
                ))}

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
            </HandleTarget>
        </group>
    );
}

export default function ClientViewXR({
    store,
    remoteStream,
    onStateUpdate,
    onExitXR
}: {
    store: XRStore | null,
    remoteStream: MediaStream | null,
    onStateUpdate: (state: Record<string, DataFrame>) => void,
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
                    <Table video={video} />
                </XR>
            </Canvas>
        </div>
    );
}