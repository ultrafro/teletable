'use client'
import { XRStore, createXRStore } from '@react-three/xr'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Import fiber separately (doesn't have WebXR dependencies)
const Canvas = dynamic(
    () => import('@react-three/fiber').then(mod => mod.Canvas),
    { ssr: false }
)

// Dynamically import XR component with delay
const XR = dynamic(
    () => {
        if (typeof window === 'undefined') {
            return Promise.resolve(() => null)
        }
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    import('@react-three/xr').then(mod => resolve(mod.XR))
                }, 50)
            })
        })
    },
    { ssr: false }
)

export function XrPageClient() {
    const [red, setRed] = useState(false)

    const [store, setStore] = useState<XRStore | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return
        requestAnimationFrame(() => {
            setTimeout(() => {
                console.log('Creating XR store')
                setStore(createXRStore({
                    emulate: { inject: true }
                }))
            }, 50)
        })
    }, [])

    if (!store) {
        return <div>Loading...</div>
    }



    return <>
        <button onClick={() => store.enterAR()}>Enter AR</button>
        <Canvas>
            <XR store={store}>
                <mesh pointerEventsType={{ deny: 'grab' }} onClick={() => setRed(!red)} position={[0, 1, -1]}>
                    <boxGeometry />
                    <meshBasicMaterial color={red ? 'red' : 'blue'} />
                </mesh>
            </XR>
        </Canvas>
    </>
}