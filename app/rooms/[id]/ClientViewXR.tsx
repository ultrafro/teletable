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

        return video;
    }, [remoteStream]);



    if (!store) {
        return <div>Loading...</div>
    }

    return (
        <div>
            <h1>XR Page</h1>
            <button onClick={onExitXR}>Exit XR</button>
            <Canvas style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
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