import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

function EarthGlobe() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const [surfaceTexture, cloudTexture] = useLoader(THREE.TextureLoader, [
    "/textures/earth-surface.jpg",
    "/textures/earth-clouds.jpg",
  ]);

  surfaceTexture.colorSpace = THREE.SRGBColorSpace;
  cloudTexture.colorSpace = THREE.SRGBColorSpace;

  useFrame((_, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.025;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.032;
    }
  });

  return (
    <group position={[1.8, 0, 0]}>
      <mesh ref={earthRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial map={surfaceTexture} roughness={0.95} metalness={0.04} />
      </mesh>

      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.018, 64, 64]} />
        <meshStandardMaterial
          map={cloudTexture}
          alphaMap={cloudTexture}
          transparent
          opacity={0.65}
          depthWrite={false}
          roughness={1}
        />
      </mesh>

      <mesh scale={1.038}>
        <sphereGeometry args={[2, 48, 48]} />
        <meshBasicMaterial
          color="#398ed0"
          transparent
          opacity={0.14}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function MoonOrbit() {
  const orbitRef = useRef<THREE.Group>(null);

  const [moonTexture, moonHeightTexture] = useLoader(THREE.TextureLoader, [
    "/textures/moon-surface.jpg",
    "/textures/moon-height.jpg",
  ]);

  moonTexture.colorSpace = THREE.SRGBColorSpace;

  useFrame((_, delta) => {
    if (orbitRef.current) {
      orbitRef.current.rotation.y += delta * 0.14;
    }
  });

  return (
    <group ref={orbitRef} position={[1.8, 0, 0]} rotation={[0.25, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.05, 0.007, 6, 128]} />
        <meshBasicMaterial color="#8CC8FF" transparent opacity={0.22} />
      </mesh>

      <mesh position={[3.05, 0, 0]}>
        <sphereGeometry args={[0.24, 48, 48]} />
        <meshStandardMaterial
          map={moonTexture}
          bumpMap={moonHeightTexture}
          bumpScale={0.015}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}



export default function HomeSpaceScene() {
  return (
    <Canvas camera={{ position: [0, 1.2, 7.5], fov: 42 }} dpr={[1, 1.5]}>
      <color attach="background" args={["#020711"]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[-6, 4, 6]} intensity={2.8} color="#fff4df" />
      <pointLight position={[4, 2, -5]} intensity={1.3} color="#398ed0" />
      <pointLight position={[5, -3, 5]} intensity={0.35} color="#8cc8ff" />

      <Stars radius={100} depth={55} count={3200} factor={3} fade speed={0.3} />

      <Suspense fallback={null}>
        <EarthGlobe />
        <MoonOrbit />
      </Suspense>



      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI / 2.8}
        maxPolarAngle={Math.PI / 1.8}
        autoRotate
        autoRotateSpeed={0.15}
      />
    </Canvas>
  );
}
