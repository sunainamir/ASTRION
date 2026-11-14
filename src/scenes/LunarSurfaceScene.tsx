import { Stars } from "@react-three/drei";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { soundEngine } from "../audio/soundEngine";
import marsGroundImg from "../assets/images/mars_surface_ground_1794687890852.jpg";
import { MISSIONS } from "../game/spacecraftData";
import { resetVirtualInput, virtualInput } from "../game/virtualInput";
import { useGameStore } from "../store/gameStore";
import type { LunarDiscoverable } from "../types/game";

const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();

function sampleHeightmap(
  heightData: Uint8ClampedArray | null,
  width: number,
  height: number,
  x: number,
  z: number
): number {
  // Smooth flat landing pad near origin (0,0)
  const distFromPad = Math.hypot(x, z);
  const padBlend = THREE.MathUtils.smoothstep(distFromPad, 5.5, 14);

  // Subtle procedural craters + heightmap lookup
  let h = 0;
  if (heightData && width > 0 && height > 0) {
    const u = THREE.MathUtils.clamp((x + 95) / 190, 0, 1);
    const v = THREE.MathUtils.clamp((z + 95) / 190, 0, 1);
    const px = Math.min(width - 1, Math.floor(u * width));
    const py = Math.min(height - 1, Math.floor(v * height));
    const idx = (py * width + px) * 4;
    h += (heightData[idx] / 255 - 0.35) * 3.6;
  }

  // Rolling lunar ridges & crater rims
  h +=
    Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.85 +
    Math.sin(x * 0.21 + 1.2) * Math.sin(z * 0.19) * 0.28;

  return h * padBlend;
}

function LunarLander({
  groundAt,
  isNear,
}: {
  groundAt: (x: number, z: number) => number;
  isNear: boolean;
}) {
  const y = groundAt(0, 0);
  const legAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

  return (
    <group position={[0, y, 0]}>
      {/* Gold foil octagonal descent stage */}
      <mesh position={[0, 1.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.45, 1.55, 1.15, 8]} />
        <meshStandardMaterial
          color="#d49b35"
          metalness={0.86}
          roughness={0.28}
        />
      </mesh>

      {/* Descent engine bell */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.52, 0.65, 20]} />
        <meshStandardMaterial color="#2a313b" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* 4 Landing legs & footpads */}
      {legAngles.map((angle, i) => {
        const lx = Math.cos(angle) * 2.15;
        const lz = Math.sin(angle) * 2.15;
        return (
          <group key={i}>
            <mesh
              position={[lx * 0.65, 0.78, lz * 0.65]}
              rotation={[
                Math.sin(angle) * 0.62,
                0,
                -Math.cos(angle) * 0.62,
              ]}
              castShadow
            >
              <cylinderGeometry args={[0.065, 0.075, 1.95, 10]} />
              <meshStandardMaterial color="#b9c6d4" metalness={0.75} roughness={0.35} />
            </mesh>
            <mesh position={[lx, 0.06, lz]} receiveShadow>
              <cylinderGeometry args={[0.38, 0.44, 0.12, 16]} />
              <meshStandardMaterial color="#c9a14a" metalness={0.8} roughness={0.35} />
            </mesh>
          </group>
        );
      })}

      {/* Upper ascent crew cabin */}
      <mesh position={[0, 2.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.25, 1.25, 10]} />
        <meshStandardMaterial color="#dce4ed" metalness={0.55} roughness={0.4} />
      </mesh>

      {/* Forward cockpit viewport frame */}
      <mesh position={[0, 2.7, 1.05]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.82, 0.42, 0.18]} />
        <meshStandardMaterial color="#1c2733" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 2.7, 1.13]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[0.68, 0.28]} />
        <meshStandardMaterial
          color="#17496e"
          metalness={0.9}
          roughness={0.12}
          emissive="#092942"
        />
      </mesh>

      {/* Boarding ladder */}
      <mesh position={[0, 1.2, 1.55]} rotation={[-0.18, 0, 0]} castShadow>
        <boxGeometry args={[0.42, 2.2, 0.06]} />
        <meshStandardMaterial color="#8fa0b2" metalness={0.8} roughness={0.35} />
      </mesh>

      {/* High-gain dish antenna */}
      <group position={[0.75, 3.42, -0.35]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
          <meshStandardMaterial color="#c6d2de" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.3, 0]} rotation={[0.45, 0, 0]}>
          <coneGeometry args={[0.42, 0.18, 18, 1, true]} />
          <meshStandardMaterial
            color="#e7edf2"
            metalness={0.7}
            roughness={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Hatch boarding beacon light */}
      <mesh position={[0, 3.32, 0.8]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color={isNear ? "#52ffae" : "#3baeff"} />
      </mesh>
      <pointLight
        position={[0, 3.2, 1.4]}
        color={isNear ? "#52ffae" : "#80ccff"}
        intensity={1.6}
        distance={8}
      />
    </group>
  );
}

function DiscoverableMesh({
  item,
  groundY,
  isTarget,
  isMars,
}: {
  item: LunarDiscoverable;
  groundY: number;
  isTarget: boolean;
  isMars: boolean;
}) {
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!beaconRef.current) return;
    beaconRef.current.position.y =
      2.1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.16;
  });

  const [x, , z] = item.position;

  return (
    <group position={[x, groundY, z]}>
      {item.kind === "sample" ? (
        <group>
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial
              color={
                item.id === "sample-anorthosite"
                  ? isMars
                    ? "#94736c"
                    : "#d9dfe6"
                  : item.id === "sample-ice"
                  ? "#8cc4de"
                  : isMars
                  ? "#693524"
                  : "#4d5259"
              }
              roughness={item.id === "sample-ice" ? 0.35 : 0.88}
              metalness={item.id === "sample-ice" ? 0.25 : 0.08}
            />
          </mesh>
          <mesh position={[0.38, 0.15, 0.2]} rotation={[0.4, 0.8, 0]} castShadow>
            <icosahedronGeometry args={[0.24, 0]} />
            <meshStandardMaterial color={isMars ? "#8a462b" : "#686d75"} roughness={0.9} />
          </mesh>
          {item.collected && (
            <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.48, 0.56, 24]} />
              <meshBasicMaterial color="#4df0a4" />
            </mesh>
          )}
        </group>
      ) : item.id === "relic-flag" ? (
        <group>
          <mesh position={[0, 1.15, 0]} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 2.3, 10]} />
            <meshStandardMaterial color="#d2dbe3" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0.48, 1.95, 0]} castShadow>
            <boxGeometry args={[0.92, 0.55, 0.025]} />
            <meshStandardMaterial color={isMars ? "#d9582b" : "#1c5ca8"} roughness={0.6} />
          </mesh>
          <mesh position={[0.48, 2.04, 0.016]}>
            <boxGeometry args={[0.88, 0.12, 0.01]} />
            <meshStandardMaterial color="#e8eef5" />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.16, 12]} />
            <meshStandardMaterial color="#8794a1" metalness={0.7} />
          </mesh>
        </group>
      ) : item.id === "relic-probe" ? (
        <group>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.48, 0.62, 0.75, 6]} />
            <meshStandardMaterial color="#c99338" metalness={0.85} roughness={0.28} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.95, 0.75, 0]} rotation={[0.2, 0, 0]} castShadow>
              <boxGeometry args={[0.9, 0.04, 0.45]} />
              <meshStandardMaterial color="#1a4e82" metalness={0.7} roughness={0.25} />
            </mesh>
          ))}
          <mesh position={[0, 1.35, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
            <meshStandardMaterial color="#ccd6e0" metalness={0.8} />
          </mesh>
        </group>
      ) : (
        <group>
          <mesh position={[0, 0.32, 0]} castShadow>
            <boxGeometry args={[0.7, 0.45, 0.5]} />
            <meshStandardMaterial color="#d49b35" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.58, 0]}>
            <boxGeometry args={[0.45, 0.12, 0.45]} />
            <meshStandardMaterial color="#99b9d4" metalness={0.95} roughness={0.08} />
          </mesh>
        </group>
      )}

      {/* Subtle objective ring marker if uncollected */}
      {!item.collected && (
        <mesh ref={beaconRef} position={[0, 2.1, 0]}>
          <octahedronGeometry args={[0.16, 0]} />
          <meshBasicMaterial color={isTarget ? "#52ffae" : "#5ac8fa"} />
        </mesh>
      )}
    </group>
  );
}

function AstronautCharacter({
  astroRef,
  walking,
  visorMode,
}: {
  astroRef: React.RefObject<THREE.Group | null>;
  walking: boolean;
  visorMode: boolean;
}) {
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 7;
    const amp = walking ? 0.55 : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t) * amp;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.sin(t) * amp;
    if (leftArmRef.current) leftArmRef.current.rotation.x = -Math.sin(t) * amp * 0.7;
    if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t) * amp * 0.7;
  });

  return (
    <group ref={astroRef} visible={!visorMode}>
      {/* Torso */}
      <mesh position={[0, 1.08, 0]} castShadow>
        <boxGeometry args={[0.52, 0.64, 0.34]} />
        <meshStandardMaterial color="#eef3f8" roughness={0.62} metalness={0.1} />
      </mesh>
      {/* Chest control pack */}
      <mesh position={[0, 1.12, 0.2]} castShadow>
        <boxGeometry args={[0.28, 0.26, 0.1]} />
        <meshStandardMaterial color="#b4c2d0" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* PLSS Life support backpack */}
      <mesh position={[0, 1.12, -0.25]} castShadow>
        <boxGeometry args={[0.42, 0.56, 0.22]} />
        <meshStandardMaterial color="#dce4ec" roughness={0.55} />
      </mesh>
      {/* Helmet */}
      <mesh position={[0, 1.58, 0]} castShadow>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshStandardMaterial color="#f2f6fa" roughness={0.35} />
      </mesh>
      {/* Reflective Gold Visor */}
      <mesh position={[0, 1.58, 0.08]}>
        <sphereGeometry args={[0.21, 24, 20, 0, Math.PI * 2, 0.35, 1.5]} />
        <meshStandardMaterial color="#d49b35" metalness={0.95} roughness={0.08} />
      </mesh>
      {/* Arms */}
      <mesh ref={leftArmRef} position={[-0.36, 1.08, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.44, 6, 12]} />
        <meshStandardMaterial color="#e6edf4" roughness={0.65} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.36, 1.08, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.44, 6, 12]} />
        <meshStandardMaterial color="#e6edf4" roughness={0.65} />
      </mesh>
      {/* Legs */}
      <mesh ref={leftLegRef} position={[-0.14, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.52, 6, 12]} />
        <meshStandardMaterial color="#dfe6ee" roughness={0.65} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.14, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.52, 6, 12]} />
        <meshStandardMaterial color="#dfe6ee" roughness={0.65} />
      </mesh>
    </group>
  );
}

interface LunarHudHandlers {
  nearestItem: LunarDiscoverable | null;
  nearestDistance: number;
  nearLander: boolean;
  landerDistance: number;
  onRegisterActions: (actions: {
    collectNearest: () => void;
    takePhoto: () => void;
    boardLander: () => void;
  }) => void;
}

function LunarSurfaceContent({
  onProximityChange,
}: {
  onProximityChange: (info: Omit<LunarHudHandlers, "onRegisterActions">) => void;
}) {
  const { gl, scene, camera } = useThree();
  const discoverables = useGameStore((s) => s.discoverables);
  const lunarCameraMode = useGameStore((s) => s.lunarCameraMode);
  const setLunarCameraMode = useGameStore((s) => s.setLunarCameraMode);
  const survivalKit = useGameStore((s) => s.survivalKit);
  const selectedMissionId = useGameStore((s) => s.selectedMissionId);
  const paused = useGameStore((s) => s.paused);
  const missionFailed = useGameStore((s) => s.missionFailed);
  const muted = useGameStore((s) => s.muted);

  const collectDiscoverable = useGameStore((s) => s.collectDiscoverable);
  const addCapturedPhoto = useGameStore((s) => s.addCapturedPhoto);
  const startReturnJourney = useGameStore((s) => s.startReturnJourney);
  const showNotification = useGameStore((s) => s.showNotification);
  const incrementElapsed = useGameStore((s) => s.incrementElapsed);

  const mission = useMemo(
    () => MISSIONS.find((m) => m.id === selectedMissionId) || MISSIONS[0],
    [selectedMissionId]
  );
  const isMars = mission.destination === "Mars";

  const [moonTex, moonHeightTex, earthTex, earthCloudsTex, marsGroundTex] = useLoader(
    THREE.TextureLoader,
    [
      "/textures/moon-surface.jpg",
      "/textures/moon-height.jpg",
      "/textures/earth-surface.jpg",
      "/textures/earth-clouds.jpg",
      marsGroundImg,
    ]
  );

  useMemo(() => {
    moonTex.colorSpace = THREE.SRGBColorSpace;
    moonTex.wrapS = THREE.RepeatWrapping;
    moonTex.wrapT = THREE.RepeatWrapping;
    moonTex.repeat.set(5, 5);
    marsGroundTex.colorSpace = THREE.SRGBColorSpace;
    marsGroundTex.wrapS = THREE.RepeatWrapping;
    marsGroundTex.wrapT = THREE.RepeatWrapping;
    marsGroundTex.repeat.set(5, 5);
    earthTex.colorSpace = THREE.SRGBColorSpace;
    earthCloudsTex.colorSpace = THREE.SRGBColorSpace;
  }, [moonTex, marsGroundTex, earthTex, earthCloudsTex]);

  // Decode heightmap pixels once so we have exact groundHeightAt(x, z)
  const heightMap = useMemo(() => {
    const img = moonHeightTex.image as HTMLImageElement | undefined;
    if (!img || !img.width) return { data: null, w: 0, h: 0 };
    const w = 256;
    const h = 256;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return { data: null, w: 0, h: 0 };
    ctx.drawImage(img, 0, 0, w, h);
    return { data: ctx.getImageData(0, 0, w, h).data, w, h };
  }, [moonHeightTex]);

  const groundAt = useCallback(
    (x: number, z: number) =>
      sampleHeightmap(heightMap.data, heightMap.w, heightMap.h, x, z),
    [heightMap]
  );

  // Build displaced lunar terrain geometry
  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(190, 190, 110, 110);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, groundAt(x, z));
    }
    geo.computeVertexNormals();
    return geo;
  }, [groundAt]);

  // Procedural scattered lunar boulders
  const boulders = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const angle = i * 2.39996;
      const r = 9 + (i % 14) * 5.2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const scale = 0.35 + (i % 5) * 0.25;
      return {
        x,
        y: groundAt(x, z) + scale * 0.35,
        z,
        scale,
        rot: i * 0.7,
      };
    });
  }, [groundAt]);

  const astroRef = useRef<THREE.Group>(null);
  const player = useRef({
    x: 0,
    y: groundAt(0, 4.5),
    z: 4.5,
    vy: 0,
    yaw: Math.PI,
    camYaw: Math.PI,
    grounded: true,
    walking: false,
  });

  const [walkingState, setWalkingState] = useState(false);
  const [nearestId, setNearestId] = useState<string | null>(null);
  const [nearLanderState, setNearLanderState] = useState(true);
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);
  const lastMouseX = useRef(0);
  const hudReportTimer = useRef(0);

  const captureLunarPhoto = useCallback(() => {
    const p = player.current;
    const nearest = discoverables.find((d) => {
      const dist = Math.hypot(d.position[0] - p.x, d.position[2] - p.z);
      return dist < 7.5;
    });

    // Render fresh frame before reading buffer
    gl.render(scene, camera);
    const dataUrl = gl.domElement.toDataURL("image/jpeg", 0.85);
    soundEngine.playShutter(muted);

    addCapturedPhoto(
      {
        title: nearest
          ? nearest.title
          : isMars
          ? "Martian Horizon & Jezero Ridge"
          : "Lunar Horizon & Earthrise",
        caption: nearest
          ? nearest.description
          : `Surface EVA survey at ${mission.landingSite}`,
        dataUrl,
        missionName: mission.name,
        location: `X ${p.x.toFixed(1)}m · Z ${p.z.toFixed(1)}m`,
      },
      nearest?.id
    );
  }, [
    gl,
    scene,
    camera,
    discoverables,
    muted,
    addCapturedPhoto,
    mission.name,
    mission.landingSite,
    isMars,
  ]);

  const collectNearest = useCallback(() => {
    const p = player.current;
    let best: LunarDiscoverable | null = null;
    let bestD = Infinity;
    for (const d of discoverables) {
      if (d.collected) continue;
      const dist = Math.hypot(d.position[0] - p.x, d.position[2] - p.z);
      if (dist < 4.8 && dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    if (best) {
      soundEngine.playDiscovery(muted);
      collectDiscoverable(best.id);
    } else {
      showNotification("Move closer to a sample or relic to collect it.");
    }
  }, [discoverables, muted, collectDiscoverable, showNotification]);

  const boardAndLaunch = useCallback(() => {
    const p = player.current;
    const dist = Math.hypot(p.x, p.z);
    if (dist > 6.2) {
      showNotification(
        isMars
          ? "Return within 6m of the Mars Ascent Lander to board."
          : "Return within 6m of the Lunar Lander to board."
      );
      return;
    }

    const st = useGameStore.getState();
    if (st.timedMode) {
      const sampleItems = st.discoverables.filter((d) => d.kind === "sample");
      const collectedSamples = sampleItems.filter((d) => d.collected).length;
      if (collectedSamples < sampleItems.length) {
        showNotification(
          `Timed Mode: Collect all ${sampleItems.length} geological samples (${collectedSamples}/${sampleItems.length}) before returning!`
        );
        return;
      }
    }

    soundEngine.playDiscovery(muted);
    startReturnJourney();
  }, [muted, startReturnJourney, showNotification, isMars]);

  // Attach global custom event hooks so HUD buttons invoke exact same actions
  useEffect(() => {
    const onCollectEvt = () => collectNearest();
    const onPhotoEvt = () => captureLunarPhoto();
    const onBoardEvt = () => boardAndLaunch();
    window.addEventListener("astrion:collect", onCollectEvt);
    window.addEventListener("astrion:photo", onPhotoEvt);
    window.addEventListener("astrion:board", onBoardEvt);
    return () => {
      window.removeEventListener("astrion:collect", onCollectEvt);
      window.removeEventListener("astrion:photo", onPhotoEvt);
      window.removeEventListener("astrion:board", onBoardEvt);
    };
  }, [collectNearest, captureLunarPhoto, boardAndLaunch]);

  // Input listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "Space"
      ) {
        e.preventDefault();
      }
      if (e.code === "KeyE" && !e.repeat) collectNearest();
      if (e.code === "KeyF" && !e.repeat) captureLunarPhoto();
      if (e.code === "KeyR" && !e.repeat) boardAndLaunch();
      if (e.code === "KeyV" && !e.repeat) {
        setLunarCameraMode(
          useGameStore.getState().lunarCameraMode === "third-person"
            ? "visor"
            : "third-person"
        );
      }
      keys.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.tagName === "CANVAS") {
        dragging.current = true;
        lastMouseX.current = e.clientX;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastMouseX.current;
      lastMouseX.current = e.clientX;
      player.current.camYaw -= dx * 0.0065;
    };
    const onPointerUp = () => {
      dragging.current = false;
    };

    const clearKeys = () => {
      keys.current = {};
      resetVirtualInput();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("blur", clearKeys);
    return () => {
      clearKeys();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, [collectNearest, captureLunarPhoto, boardAndLaunch, setLunarCameraMode]);

  useFrame((_, delta) => {
    if (paused || missionFailed) return;
    const dt = Math.min(delta, 0.05);
    incrementElapsed(dt, dt);

    const p = player.current;
    const k = keys.current;

    if (k.KeyQ) p.camYaw += 1.9 * dt;
    if (k.KeyZ) p.camYaw -= 1.9 * dt;

    const forwardInput =
      (k.KeyW || k.ArrowUp || virtualInput.up ? 1 : 0) -
      (k.KeyS || k.ArrowDown || virtualInput.down ? 1 : 0);
    const strafeInput =
      (k.KeyD || k.ArrowRight || virtualInput.right ? 1 : 0) -
      (k.KeyA || k.ArrowLeft || virtualInput.left ? 1 : 0);

    const isMoving = forwardInput !== 0 || strafeInput !== 0;
    if (isMoving !== p.walking) {
      p.walking = isMoving;
      setWalkingState(isMoving);
    }

    const walkSpeed = survivalKit.jetpackThrusterBoost ? 6.8 : 5.0;
    if (isMoving) {
      const sinY = Math.sin(p.camYaw);
      const cosY = Math.cos(p.camYaw);
      // Camera looks along (-sinY, -cosY)
      const moveX = -sinY * forwardInput + cosY * strafeInput;
      const moveZ = -cosY * forwardInput - sinY * strafeInput;
      const len = Math.hypot(moveX, moveZ) || 1;
      p.x = THREE.MathUtils.clamp(p.x + (moveX / len) * walkSpeed * dt, -72, 72);
      p.z = THREE.MathUtils.clamp(p.z + (moveZ / len) * walkSpeed * dt, -72, 72);

      const targetYaw = Math.atan2(moveX, moveZ);
      let diff = targetYaw - p.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.yaw += diff * Math.min(1, 10 * dt);
    }

    // Low-gravity lunar hop (1/6g)
    if ((k.Space || virtualInput.jump) && p.grounded) {
      p.vy = survivalKit.jetpackThrusterBoost ? 4.4 : 3.2;
      p.grounded = false;
    }

    p.vy -= 3.4 * dt;
    p.y += p.vy * dt;

    const floorY = groundAt(p.x, p.z);
    if (p.y <= floorY) {
      p.y = floorY;
      p.vy = 0;
      p.grounded = true;
    }

    if (astroRef.current) {
      astroRef.current.position.set(p.x, p.y, p.z);
      astroRef.current.rotation.y = p.yaw;
    }

    // Camera positioning
    if (lunarCameraMode === "visor") {
      _camDesired.set(p.x, p.y + 1.62, p.z);
      _camLook.set(
        p.x - Math.sin(p.camYaw) * 14,
        p.y + 1.45,
        p.z - Math.cos(p.camYaw) * 14
      );
      camera.position.copy(_camDesired);
    } else {
      _camDesired.set(
        p.x + Math.sin(p.camYaw) * 5.2,
        p.y + 2.65,
        p.z + Math.cos(p.camYaw) * 5.2
      );
      _camLook.set(p.x, p.y + 1.25, p.z);
      camera.position.lerp(_camDesired, 1 - Math.exp(-9 * dt));
    }
    camera.lookAt(_camLook);

    // Proximity checks for HUD
    hudReportTimer.current += dt;
    if (hudReportTimer.current >= 0.12) {
      hudReportTimer.current = 0;
      let best: LunarDiscoverable | null = null;
      let bestD = Infinity;
      for (const d of discoverables) {
        if (d.collected) continue;
        const dist = Math.hypot(d.position[0] - p.x, d.position[2] - p.z);
        if (dist < bestD) {
          bestD = dist;
          best = d;
        }
      }
      const landerDist = Math.hypot(p.x, p.z);
      const nearLanderNow = landerDist <= 6.2;
      setNearestId(best && bestD < 4.8 ? best.id : null);
      setNearLanderState(nearLanderNow);

      onProximityChange({
        nearestItem: best,
        nearestDistance: bestD,
        nearLander: nearLanderNow,
        landerDistance: landerDist,
      });
    }
  });

  return (
    <>
      <color attach="background" args={[isMars ? "#3b1b12" : "#020408"]} />
      <fog attach="fog" args={[isMars ? "#4a2216" : "#020408", 55, 155]} />

      {/* Crisp planetary sunlight + sky bounce fill */}
      <ambientLight intensity={isMars ? 0.28 : 0.18} />
      <directionalLight
        position={[35, 28, -25]}
        intensity={isMars ? 2.85 : 3.1}
        color={isMars ? "#ffd4b3" : "#fff9eb"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
      />
      <hemisphereLight
        args={isMars ? ["#b05a3a", "#2b130c", 0.38] : ["#4574a8", "#1f2228", 0.28]}
      />

      <Stars
        radius={160}
        depth={80}
        count={isMars ? 1800 : 3600}
        factor={isMars ? 2.4 : 3.2}
        fade
        speed={0.1}
      />

      {/* Earthrise on Moon / distant blue Earth + Phobos on Mars */}
      <group
        position={isMars ? [-35, 38, -110] : [-28, 34, -85]}
        scale={isMars ? 0.24 : 1.15}
      >
        <mesh>
          <sphereGeometry args={[7, 48, 48]} />
          <meshStandardMaterial map={earthTex} roughness={0.9} />
        </mesh>
        <mesh scale={1.015}>
          <sphereGeometry args={[7, 40, 40]} />
          <meshStandardMaterial
            map={earthCloudsTex}
            alphaMap={earthCloudsTex}
            transparent
            opacity={0.68}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={1.04}>
          <sphereGeometry args={[7, 32, 32]} />
          <meshBasicMaterial
            color="#3da4f0"
            transparent
            opacity={0.15}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {isMars && (
        <mesh position={[32, 30, -90]} scale={[1.4, 1.1, 1.25]}>
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#8c7365" roughness={0.95} flatShading />
        </mesh>
      )}

      {/* Planetary Surface Terrain */}
      <mesh geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial
          map={isMars ? marsGroundTex : moonTex}
          bumpMap={moonHeightTex}
          bumpScale={0.22}
          color="#ffffff"
          roughness={0.96}
          metalness={0.02}
        />
      </mesh>

      {/* Scattered Surface Boulders */}
      {boulders.map((b, idx) => (
        <mesh
          key={idx}
          position={[b.x, b.y, b.z]}
          rotation={[b.rot, b.rot * 0.5, 0]}
          scale={b.scale}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color={isMars ? "#7a3b25" : "#676b70"}
            roughness={0.95}
            flatShading
          />
        </mesh>
      ))}

      {/* Landed Ascent Module */}
      <LunarLander groundAt={groundAt} isNear={nearLanderState} />

      {/* Discoverable Samples & Historical Relics */}
      {discoverables.map((item) => (
        <DiscoverableMesh
          key={item.id}
          item={item}
          groundY={groundAt(item.position[0], item.position[2])}
          isTarget={nearestId === item.id}
          isMars={isMars}
        />
      ))}

      {/* Player Astronaut */}
      <AstronautCharacter
        astroRef={astroRef}
        walking={walkingState}
        visorMode={lunarCameraMode === "visor"}
      />
    </>
  );
}

export default function LunarSurfaceScene({
  onProximityChange,
}: {
  onProximityChange: (info: Omit<LunarHudHandlers, "onRegisterActions">) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 3.2, 10], fov: 62, near: 0.1, far: 450 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ preserveDrawingBuffer: true }}
    >
      <Suspense fallback={null}>
        <LunarSurfaceContent onProximityChange={onProximityChange} />
      </Suspense>
    </Canvas>
  );
}
