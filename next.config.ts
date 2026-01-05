import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Ensure all Three.js imports resolve to the same instance
    // This prevents "Multiple instances of Three.js" warnings
    config.resolve.alias = {
      ...config.resolve.alias,
      // Force all three imports to use the same instance
      three: require.resolve('three'),
      // Map deprecated BufferGeometry exports to their new names
      "three/src/geometries/BoxBufferGeometry":
        "three/src/geometries/BoxGeometry",
      "three/src/geometries/SphereBufferGeometry":
        "three/src/geometries/SphereGeometry",
      "three/src/geometries/CylinderBufferGeometry":
        "three/src/geometries/CylinderGeometry",
      "three/src/geometries/PlaneBufferGeometry":
        "three/src/geometries/PlaneGeometry",
      "three/src/geometries/RingBufferGeometry":
        "three/src/geometries/RingGeometry",
      "three/src/geometries/TorusBufferGeometry":
        "three/src/geometries/TorusGeometry",
      "three/src/geometries/TorusKnotBufferGeometry":
        "three/src/geometries/TorusKnotGeometry",
      "three/src/geometries/ConeBufferGeometry":
        "three/src/geometries/ConeGeometry",
      "three/src/geometries/OctahedronBufferGeometry":
        "three/src/geometries/OctahedronGeometry",
      "three/src/geometries/TetrahedronBufferGeometry":
        "three/src/geometries/TetrahedronGeometry",
      "three/src/geometries/IcosahedronBufferGeometry":
        "three/src/geometries/IcosahedronGeometry",
      "three/src/geometries/DodecahedronBufferGeometry":
        "three/src/geometries/DodecahedronGeometry",
    };

    return config;
  },
};

export default nextConfig;
