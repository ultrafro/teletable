"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MonodepthLayoutMetadata } from "@/app/hooks/useMonodepthStream";

interface MonodepthViewer3DProps {
  videoElement: HTMLVideoElement | null;
  layout: MonodepthLayoutMetadata;
  scale?: number;
  position?: [number, number, number];
  resolution?: number; // Number of points in each dimension
  depthScale?: number; // How much to exaggerate depth
  opacity?: number;
}

export function MonodepthViewer3D({
  videoElement,
  layout,
  scale = 1,
  position = [0, 0, -2],
  resolution = 128,
  depthScale = 1,
  opacity = 1,
}: MonodepthViewer3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Create video texture
  const videoTexture = useMemo(() => {
    if (!videoElement) return null;
    const texture = new THREE.VideoTexture(videoElement);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [videoElement]);

  // Create geometry with enough vertices for displacement
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, resolution - 1, resolution - 1);
    return geo;
  }, [resolution]);

  // Shader material that samples depth and displaces vertices
  const shaderMaterial = useMemo(() => {
    if (!layout) return null;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        videoTexture: { value: null },
        colorUV: {
          value: new THREE.Vector4(
            layout.color.u[0],
            layout.color.u[1],
            layout.color.v[0],
            layout.color.v[1]
          ),
        },
        depthUV: {
          value: new THREE.Vector4(
            layout.depth.u[0],
            layout.depth.u[1],
            layout.depth.v[0],
            layout.depth.v[1]
          ),
        },
        depthScale: { value: depthScale },
        opacity: { value: opacity },
      },
      vertexShader: `
        uniform sampler2D videoTexture;
        uniform vec4 depthUV; // x: uStart, y: uEnd, z: vStart, w: vEnd
        uniform float depthScale;

        varying vec2 vUv;
        varying float vDepth;

        void main() {
          vUv = uv;

          float depthSampleX = mix(depthUV.x, depthUV.y, vUv.x);
          float depthSampleY = mix(1.0-depthUV.w, 1.0-depthUV.z, vUv.y);
          vec2 depthSampleUV = vec2(depthSampleX, depthSampleY);
          float depth = texture2D(videoTexture, depthSampleUV).r;

          // float depth = depthSample.r;
          vDepth = depth;

          // Displace vertex along Z axis based on depth
          // Close (black/0) should come forward (+Z), Far (white/1) should go back (-Z)
          vec3 displaced = position;
          displaced.z += (0.5 - depth) * depthScale;

          //gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D videoTexture;
        uniform vec4 colorUV; // x: uStart, y: uEnd, z: vStart, w: vEnd
        uniform vec4 depthUV; // x: uStart, y: uEnd, z: vStart, w: vEnd
        uniform float opacity;

        varying vec2 vUv;
        varying float vDepth;

        void main() {

          float depthSampleX = mix(depthUV.x, depthUV.y, vUv.x);
          float depthSampleY = mix(1.0-depthUV.w, 1.0-depthUV.z, vUv.y);
          vec2 depthSampleUV = vec2(depthSampleX, depthSampleY);
          float depth = texture2D(videoTexture, depthSampleUV).r;

          //get color from color uv
          vec2 colorSampleUV = vec2(
            mix(colorUV.x, colorUV.y, vUv.x),
            mix(colorUV.z, colorUV.w, vUv.y)
          );
          vec4 color = texture2D(videoTexture, colorSampleUV);


          gl_FragColor = vec4(depth, depth, depth, opacity); //depth
          gl_FragColor = color; //color

        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });

    return material;
  }, [layout, depthScale, opacity]);

  // Update texture uniform when video texture changes
  useEffect(() => {
    if (shaderMaterial && videoTexture) {
      shaderMaterial.uniforms.videoTexture.value = videoTexture;
    }
  }, [shaderMaterial, videoTexture]);

  // Update uniforms when props change
  useEffect(() => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.depthScale.value = depthScale;
      shaderMaterial.uniforms.opacity.value = opacity;
    }
  }, [shaderMaterial, depthScale, opacity]);

  // Update video texture each frame
  useFrame(() => {
    if (videoTexture && videoElement && videoElement.readyState >= 2) {
      videoTexture.needsUpdate = true;
    }
  });

  if (!videoElement || !layout || !shaderMaterial) {
    return null;
  }

  // Calculate aspect ratio from color region
  const aspectRatio = layout.color.width / layout.color.height;

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={[scale * aspectRatio, scale, scale]}
      geometry={geometry}
      material={shaderMaterial}
    />
  );
}

// Wrapper component that creates video element from MediaStream
interface MonodepthViewer3DWithStreamProps {
  stream: MediaStream;
  layout: MonodepthLayoutMetadata;
  scale?: number;
  position?: [number, number, number];
  resolution?: number;
  depthScale?: number;
  opacity?: number;
}

export function MonodepthViewer3DWithStream({
  stream,
  layout,
  ...props
}: MonodepthViewer3DWithStreamProps) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;

    video.onloadedmetadata = () => {
      video.play().catch(console.error);
      setVideoElement(video);
    };

    return () => {
      video.srcObject = null;
      setVideoElement(null);
    };
  }, [stream]);

  if (!videoElement) {
    return null;
  }

  return <MonodepthViewer3D videoElement={videoElement} layout={layout} {...props} />;
}

// Point cloud version for alternative visualization
interface MonodepthPointCloudProps {
  videoElement: HTMLVideoElement | null;
  layout: MonodepthLayoutMetadata;
  scale?: number;
  position?: [number, number, number];
  resolution?: number;
  depthScale?: number;
  pointSize?: number;
}

export function MonodepthPointCloud({
  videoElement,
  layout,
  scale = 1,
  position = [0, 0, -2],
  resolution = 64,
  depthScale = 1,
  pointSize = 2,
}: MonodepthPointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Create video texture
  const videoTexture = useMemo(() => {
    if (!videoElement) return null;
    const texture = new THREE.VideoTexture(videoElement);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    return texture;
  }, [videoElement]);

  // Create point geometry
  const geometry = useMemo(() => {
    const positions = new Float32Array(resolution * resolution * 3);
    const uvs = new Float32Array(resolution * resolution * 2);

    let idx = 0;
    let uvIdx = 0;

    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const u = x / (resolution - 1);
        const v = y / (resolution - 1);

        positions[idx++] = u - 0.5;
        positions[idx++] = 0.5 - v;
        positions[idx++] = 0;

        uvs[uvIdx++] = u;
        uvs[uvIdx++] = v;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

    return geo;
  }, [resolution]);

  // Shader material for points
  const shaderMaterial = useMemo(() => {
    if (!layout) return null;

    return new THREE.ShaderMaterial({
      uniforms: {
        videoTexture: { value: null },
        colorUV: {
          value: new THREE.Vector4(
            layout.color.u[0],
            layout.color.u[1],
            layout.color.v[0],
            layout.color.v[1]
          ),
        },
        depthUV: {
          value: new THREE.Vector4(
            layout.depth.u[0],
            layout.depth.u[1],
            layout.depth.v[0],
            layout.depth.v[1]
          ),
        },
        depthScale: { value: depthScale },
        pointSize: { value: pointSize },
      },
      vertexShader: `
        uniform sampler2D videoTexture;
        uniform vec4 depthUV;
        uniform float depthScale;
        uniform float pointSize;

        attribute vec2 uv;

        varying vec2 vUv;
        varying float vDepth;

        void main() {
          vUv = uv;

          // Sample depth from the depth region
          vec2 depthSampleUV = vec2(
            mix(depthUV.x, depthUV.y, uv.x),
            mix(depthUV.z, depthUV.w, uv.y)
          );

          vec4 depthSample = texture2D(videoTexture, depthSampleUV);
          float depth = depthSample.r;
          vDepth = depth;

          // Close (black/0) should come forward (+Z), Far (white/1) should go back (-Z)
          vec3 displaced = position;
          displaced.z += (0.5 - depth) * depthScale;

          vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = pointSize * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        uniform sampler2D videoTexture;
        uniform vec4 colorUV;

        varying vec2 vUv;

        void main() {
          // Sample color from the color region
          vec2 colorSampleUV = vec2(
            mix(colorUV.x, colorUV.y, vUv.x),
            mix(colorUV.z, colorUV.w, vUv.y)
          );

          vec4 color = texture2D(videoTexture, colorSampleUV);

          // Circular point
          vec2 center = gl_PointCoord - vec2(0.5);
          if (length(center) > 0.5) discard;

          gl_FragColor = color;
        }
      `,
      transparent: true,
    });
  }, [layout, depthScale, pointSize]);

  useEffect(() => {
    if (shaderMaterial && videoTexture) {
      shaderMaterial.uniforms.videoTexture.value = videoTexture;
    }
  }, [shaderMaterial, videoTexture]);

  useFrame(() => {
    if (videoTexture && videoElement && videoElement.readyState >= 2) {
      videoTexture.needsUpdate = true;
    }
  });

  if (!videoElement || !layout || !shaderMaterial) {
    return null;
  }

  const aspectRatio = layout.color.width / layout.color.height;

  return (
    <points
      ref={pointsRef}
      position={position}
      scale={[scale * aspectRatio, scale, scale]}
      geometry={geometry}
      material={shaderMaterial}
    />
  );
}
