'use client'
import { DataFrame } from "@/app/teletable.model";
import { XR, XRLayer, XRStore } from "@react-three/xr";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";

// Import fiber separately (doesn't have WebXR dependencies)
const Canvas = dynamic(
    () => import('@react-three/fiber').then(mod => mod.Canvas),
    { ssr: false }
)

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
    const [red, setRed] = useState(false);

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
                    {video && <XRLayer position={[0, 1.5, -0.5]} onClick={() => video?.play()} scale={0.5} src={video} />}
                    <ambientLight intensity={0.5} />
                    <mesh pointerEventsType={{ deny: 'grab' }} onClick={() => setRed(!red)} position={[0, 1, -1]}>
                        <boxGeometry />
                        <meshBasicMaterial color={red ? 'red' : 'blue'} />
                    </mesh>
                </XR>
            </Canvas>
        </div>
    );
}