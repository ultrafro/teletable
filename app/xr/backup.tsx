'use client'
import { useState, useEffect, type ComponentType } from 'react'
import dynamic from 'next/dynamic'

// Import fiber separately (doesn't have WebXR dependencies)
const Canvas = dynamic(
    () => import('@react-three/fiber').then(mod => mod.Canvas),
    { ssr: false }
)

// Dynamically import XR components with error handling
const XRScene = dynamic(
    () => {
        if (typeof window === 'undefined') {
            const NoSSR: ComponentType = () => <div>Server-side rendering not supported</div>
            return Promise.resolve(NoSSR)
        }

        // Wait for WebXR APIs to potentially be available
        return new Promise<ComponentType>((resolve) => {
            // Check if WebXR APIs exist before importing
            const checkWebXR = () => {
                // Check if basic WebXR APIs are available
                const hasWebXR = 'xr' in navigator
                const hasXRWebGLBinding = typeof (window as any).XRWebGLBinding !== 'undefined'

                if (!hasWebXR && !hasXRWebGLBinding) {
                    // WebXR not available, return error component
                    const ErrorComponent: ComponentType = () => (
                        <div>
                            <p>WebXR is not available in this browser.</p>
                            <p>Please use a browser that supports WebXR (e.g., Chrome with WebXR enabled).</p>
                            <p>XRWebGLBinding available: {String(hasXRWebGLBinding)}</p>
                        </div>
                    )
                    resolve(ErrorComponent)
                    return
                }

                // Try to import, but catch errors during module evaluation
                import('@react-three/xr')
                    .then((xr) => {
                        const { XR, createXRStore } = xr

                        resolve(function XRSceneComponent() {
                            const [red, setRed] = useState(false)
                            const [store, setStore] = useState<any>(null)
                            const [mounted, setMounted] = useState(false)
                            const [error, setError] = useState<string | null>(null)

                            useEffect(() => {
                                const initXR = () => {
                                    try {
                                        if (!('xr' in navigator)) {
                                            setError('WebXR not supported in this browser')
                                            setMounted(true)
                                            return
                                        }

                                        const xrStore = createXRStore()
                                        setStore(xrStore)
                                    } catch (err: any) {
                                        console.error('Failed to create XR store:', err)
                                        setError(err?.message || 'Failed to initialize WebXR')
                                    } finally {
                                        setMounted(true)
                                    }
                                }

                                requestAnimationFrame(() => {
                                    setTimeout(initXR, 0)
                                })
                            }, [])

                            if (!mounted) {
                                return <div>Loading XR...</div>
                            }

                            if (error || !store) {
                                return (
                                    <div>
                                        <p>WebXR not available.</p>
                                        <p>{error || 'Please use a browser that supports WebXR (e.g., Chrome with WebXR enabled).'}</p>
                                    </div>
                                )
                            }

                            return (
                                <>
                                    <button onClick={() => store.enterVR()}>Enter VR</button>
                                    <Canvas>
                                        <XR store={store}>
                                            <mesh onClick={() => setRed(!red)} position={[0, 1, -1]}>
                                                <boxGeometry />
                                                <meshBasicMaterial color={red ? 'red' : 'blue'} />
                                            </mesh>
                                        </XR>
                                    </Canvas>
                                </>
                            )
                        })
                    })
                    .catch((err) => {
                        console.error('Failed to import @react-three/xr:', err)
                        resolve(function XRSceneError() {
                            return (
                                <div>
                                    <p>Failed to load WebXR components.</p>
                                    <p>Error: {err?.message || 'Unknown error'}</p>
                                    <p>This may be due to WebXR APIs not being available.</p>
                                    <details>
                                        <summary>Technical details</summary>
                                        <pre>{String(err)}</pre>
                                    </details>
                                </div>
                            )
                        })
                    })
            }

            // Use requestAnimationFrame to ensure we're in the browser context
            requestAnimationFrame(() => {
                // Add a small delay to ensure WebXR APIs are fully initialized
                setTimeout(checkWebXR, 50)
            })
        })
    },
    { ssr: false }
)

export default function XrPage() {
    return <XRScene />
}