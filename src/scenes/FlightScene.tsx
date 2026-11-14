import { Stars, useFBX, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { soundEngine } from "../audio/soundEngine";
import {
  DIFFICULTY_CONFIGS,
  FLIGHT_ANOMALIES,
  LAUNCH_VEHICLES,
  MISSIONS,
  ORBIT_PROFILES,
} from "../game/spacecraftData";
import earthGroundImg from "../assets/images/earth_launch_ground_1794687890657.jpg";
import marsGroundImg from "../assets/images/mars_surface_ground_1794687890852.jpg";
import type { NeoAsteroidRecord } from "../data/nasaSources";
import { resetVirtualInput, virtualInput } from "../game/virtualInput";
import { useGameStore } from "../store/gameStore";
import type { ActiveNeoInfo, CameraMode, FlightStage } from "../types/game";

// Reusable math objects (zero GC in render loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _eulerA = new THREE.Euler(0, 0, 0, "YXZ");
const _padCamPos = new THREE.Vector3();
const _padLook = new THREE.Vector3();
const _flightCamPos = new THREE.Vector3();
const _flightLook = new THREE.Vector3();

interface AsteroidEntity {
  id: number;
  neo: NeoAsteroidRecord;
  x: number;
  y: number;
  z: number;
  speed: number;
  radius: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  spinX: number;
  spinY: number;
  variant: number;
  passed: boolean;
  hit: boolean;
}

function createAsteroidGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const noise =
      0.78 +
      0.22 * Math.sin(vx * 3.7 + seed * 1.9) * Math.cos(vy * 4.3 - seed) +
      0.14 * Math.sin(vz * 5.1 + seed * 2.4);
    pos.setXYZ(i, vx * noise, vy * noise * 0.88, vz * noise);
  }
  geo.computeVertexNormals();
  return geo;
}

function createMarsTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Base rusty iron-oxide Martian crust
    const baseGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    baseGrad.addColorStop(0, "#e6ded8"); // North polar cap
    baseGrad.addColorStop(0.08, "#b6522e");
    baseGrad.addColorStop(0.35, "#cc683d");
    baseGrad.addColorStop(0.55, "#9c3e20");
    baseGrad.addColorStop(0.85, "#b95732");
    baseGrad.addColorStop(0.93, "#dfd5ce"); // South polar cap
    baseGrad.addColorStop(1, "#efe8e2");
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dark basaltic regions (Syrtis Major / Acidalia / Valles Marineris)
    for (let i = 0; i < 42; i++) {
      const x = ((i * 197) % canvas.width);
      const y = 75 + ((i * 113) % (canvas.height - 150));
      const rx = 38 + (i % 5) * 26;
      const ry = 18 + (i % 4) * 14;
      const grad = ctx.createRadialGradient(x, y, 4, x, y, rx);
      grad.addColorStop(0, i % 3 === 0 ? "rgba(74, 28, 16, 0.52)" : "rgba(218, 118, 68, 0.36)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, (i % 6) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine crater and regolith speckles
    for (let i = 0; i < 650; i++) {
      const x = (i * 317) % canvas.width;
      const y = 40 + ((i * 179) % (canvas.height - 80));
      const r = 1 + (i % 4) * 1.4;
      ctx.fillStyle = i % 2 === 0 ? "rgba(62, 22, 12, 0.28)" : "rgba(235, 148, 96, 0.2)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function CockpitInterior({
  cockpitRef,
}: {
  cockpitRef: React.RefObject<THREE.Group | null>;
}) {
  const fbx = useFBX("/models/cockpit/cockpit.fbx");

  const cockpitModel = useMemo(() => {
    const model = fbx.clone(true);
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((m) => {
            m.side = THREE.DoubleSide;
          });
        }
      }
    });
    return model;
  }, [fbx]);

  return (
    <group ref={cockpitRef}>
      <primitive object={cockpitModel} />
    </group>
  );
}

function LauncherPadModel() {
  const { scene } = useGLTF("/models/launcher.glb");

  const launcherModel = useMemo(() => {
    const model = scene.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      model.scale.setScalar(5.4 / maxDim);
    }
    const scaledBox = new THREE.Box3().setFromObject(model);
    model.position.y -= scaledBox.min.y;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return model;
  }, [scene]);

  return (
    <group position={[1.45, -2.66, -9]} rotation={[0, -Math.PI * 0.5, 0]}>
      <primitive object={launcherModel} />
    </group>
  );
}

function SaturnVRocket({
  rocketModelVisible,
  thrustIntensity,
  reentryIntensity,
  parachuteIntensity,
}: {
  rocketModelVisible: boolean;
  thrustIntensity: number;
  reentryIntensity: number;
  parachuteIntensity: number;
}) {
  const { scene } = useGLTF("/models/saturn-v.glb");
  const flameRef = useRef<THREE.Group>(null);

  const rocketModel = useMemo(() => {
    const model = scene.clone(true);
    // Rotate so +Y (rocket nose) points along -Z (local flight forward)
    model.rotation.x = -Math.PI / 2;

    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    model.position.sub(center);

    const largestDimension = Math.max(size.x, size.y, size.z);
    if (largestDimension > 0) {
      model.scale.setScalar(4.5 / largestDimension);
    }

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return model;
  }, [scene]);

  useFrame((state) => {
    if (!flameRef.current) return;
    const t = state.clock.elapsedTime;
    const flicker = 0.88 + Math.sin(t * 48) * 0.12 + Math.cos(t * 31) * 0.08;
    const activeScale = Math.max(0.01, thrustIntensity * flicker);
    flameRef.current.visible = thrustIntensity > 0.05;
    flameRef.current.scale.set(
      0.85 + thrustIntensity * 0.25,
      0.85 + thrustIntensity * 0.25,
      activeScale * 1.35
    );
  });

  return (
    <group visible={rocketModelVisible}>
      <primitive object={rocketModel} />

      {/* Exhaust plume trailing out local +Z (tail end) */}
      <group ref={flameRef} position={[0, 0, 2.35]} visible={false}>
        <mesh position={[0, 0, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.38, 1.8, 16]} />
          <meshBasicMaterial
            color="#ff9238"
            transparent
            opacity={0.78}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.2, 1.0, 14]} />
          <meshBasicMaterial
            color="#fff2cf"
            transparent
            opacity={0.92}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <pointLight
          position={[0, 0, 0.9]}
          color="#ff994b"
          intensity={3.5 * thrustIntensity}
          distance={14}
        />
      </group>

      {/* Atmospheric Re-entry Nose Plasma */}
      {reentryIntensity > 0.05 && (
        <mesh position={[0, 0, -2.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.62, 1.6, 20, 1, true]} />
          <meshBasicMaterial
            color="#ff6b2b"
            transparent
            opacity={0.52 * reentryIntensity}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Earth Landing Recovery Parachute Cluster (deployed above nose along local -Z) */}
      {parachuteIntensity > 0.05 && (
        <group position={[0, 0, -2.2]} scale={parachuteIntensity}>
          {[-0.9, 0, 0.9].map((offsetX, i) => (
            <group
              key={i}
              position={[offsetX * 0.65, i === 1 ? 0.35 : -0.25, -2.8]}
              rotation={[-Math.PI / 2, 0, offsetX * 0.18]}
            >
              <mesh>
                <coneGeometry args={[0.85, 0.72, 18, 1, true]} />
                <meshStandardMaterial
                  color={i === 1 ? "#f4f6f8" : "#e8642c"}
                  side={THREE.DoubleSide}
                  roughness={0.75}
                />
              </mesh>
              <mesh position={[0, -1.35, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 2.2, 6]} />
                <meshStandardMaterial color="#cfd8e0" />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

function FlightSceneContent() {
  const flightStage = useGameStore((s) => s.flightStage);
  const launchActive = useGameStore((s) => s.launchActive);
  const cameraMode = useGameStore((s) => s.cameraMode);
  const paused = useGameStore((s) => s.paused);
  const muted = useGameStore((s) => s.muted);
  const missionFailed = useGameStore((s) => s.missionFailed);
  const selectedMissionId = useGameStore((s) => s.selectedMissionId);
  const difficulty = useGameStore((s) => s.difficulty);
  const launchVehicleId = useGameStore((s) => s.launchVehicleId);
  const orbitId = useGameStore((s) => s.orbitId);
  const spacecraft = useGameStore((s) => s.spacecraft);
  const flightRunId = useGameStore((s) => s.flightRunId);

  const setFlightStage = useGameStore((s) => s.setFlightStage);
  const updateTelemetry = useGameStore((s) => s.updateTelemetry);
  const triggerHullDamage = useGameStore((s) => s.triggerHullDamage);
  const triggerSystemFailure = useGameStore((s) => s.triggerSystemFailure);
  const triggerAnomaly = useGameStore((s) => s.triggerAnomaly);
  const consumeAnomalyAdjustment = useGameStore(
    (s) => s.consumeAnomalyAdjustment
  );
  const unlockAchievement = useGameStore((s) => s.unlockAchievement);
  const showNotification = useGameStore((s) => s.showNotification);
  const setPage = useGameStore((s) => s.setPage);
  const completeMission = useGameStore((s) => s.completeMission);
  const incrementElapsed = useGameStore((s) => s.incrementElapsed);
  const cycleCameraMode = useGameStore((s) => s.cycleCameraMode);
  const setFastForward = useGameStore((s) => s.setFastForward);
  const loadNeoFeed = useGameStore((s) => s.loadNeoFeed);

  const mission = useMemo(
    () => MISSIONS.find((m) => m.id === selectedMissionId) || MISSIONS[0],
    [selectedMissionId]
  );
  const vehicle = useMemo(
    () =>
      LAUNCH_VEHICLES.find((v) => v.id === launchVehicleId) ||
      LAUNCH_VEHICLES[1],
    [launchVehicleId]
  );
  const orbit = useMemo(
    () => ORBIT_PROFILES.find((o) => o.id === orbitId) || ORBIT_PROFILES[0],
    [orbitId]
  );
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];

  // Textures for Earth, Moon, Earth Launch Ground & Mars Ground
  const [
    earthTex,
    earthCloudsTex,
    moonTex,
    moonHeightTex,
    earthGroundTex,
    marsGroundTex,
  ] = useLoader(THREE.TextureLoader, [
    "/textures/earth-surface.jpg",
    "/textures/earth-clouds.jpg",
    "/textures/moon-surface.jpg",
    "/textures/moon-height.jpg",
    earthGroundImg,
    marsGroundImg,
  ]);

  const marsTex = useMemo(() => createMarsTexture(), []);

  useMemo(() => {
    earthTex.colorSpace = THREE.SRGBColorSpace;
    earthCloudsTex.colorSpace = THREE.SRGBColorSpace;
    moonTex.colorSpace = THREE.SRGBColorSpace;
    earthGroundTex.colorSpace = THREE.SRGBColorSpace;
    earthGroundTex.wrapS = THREE.MirroredRepeatWrapping;
    earthGroundTex.wrapT = THREE.MirroredRepeatWrapping;
    earthGroundTex.repeat.set(3, 3);
    marsGroundTex.colorSpace = THREE.SRGBColorSpace;
    marsGroundTex.wrapS = THREE.RepeatWrapping;
    marsGroundTex.wrapT = THREE.RepeatWrapping;
    marsGroundTex.repeat.set(4, 4);
  }, [earthTex, earthCloudsTex, moonTex, earthGroundTex, marsGroundTex]);

  const asteroidGeos = useMemo(
    () => [
      createAsteroidGeometry(1.1),
      createAsteroidGeometry(2.7),
      createAsteroidGeometry(4.3),
    ],
    []
  );

  const asteroidMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#6b6661",
        roughness: 0.92,
        metalness: 0.12,
        flatShading: true,
      }),
    []
  );

  const hazardousAsteroidMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8f5843",
        roughness: 0.86,
        metalness: 0.18,
        flatShading: true,
      }),
    []
  );

  const worldRef = useRef<THREE.Group>(null);
  const earthLandingRef = useRef<THREE.Group>(null);
  const earthLandingSmokeRef = useRef<THREE.Group>(null);
  const rocketGroupRef = useRef<THREE.Group>(null);
  const cockpitRef = useRef<THREE.Group>(null);
  const smokeRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Group>(null);
  const earthGroupRef = useRef<THREE.Group>(null);
  const moonGroupRef = useRef<THREE.Group>(null);
  const lunarPadRef = useRef<THREE.Group>(null);
  const asteroidGroupRef = useRef<THREE.Group>(null);
  // Initialize as null so remounting FlightScene directly into "moon-launch" restores telemetry fuel/power cleanly
  const prevStageRef = useRef<FlightStage | null>(null);

  const desiredCamera = useRef(new THREE.Vector3(3.2, 1.2, -0.5));
  const cameraLookTarget = useRef(new THREE.Vector3(0, -0.3, -9));
  const lastCamMode = useRef<CameraMode>(cameraMode);
  const keys = useRef<Record<string, boolean>>({});
  const reportTimer = useRef(0);
  const anomalyStepRef = useRef(0);
  const reentryCueStepRef = useRef(0);

  const [thrustVis, setThrustVis] = useState(0);
  const [reentryVis, setReentryVis] = useState(0);
  const [parachuteVis, setParachuteVis] = useState(0);
  const [asteroidsRenderKey, setAsteroidsRenderKey] = useState(0);

  const asteroidsRef = useRef<AsteroidEntity[]>([]);
  const asteroidMeshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const flight = useRef({
    stageElapsed: 0,
    altitudeKm: 0,
    speedMs: 0,
    fuelPct: 100,
    powerPct: 100,
    x: 0,
    y: -0.45,
    heading: 0,
    pitchTrim: 0,
    journeyProgress: 0,
    gravityTurn: 0, // 0 = vertical on pad (+PI/2), 1 = horizontal forward (-Z)
    invulnTimer: 0,
    shakeTimer: 0,
    asteroidsSpawned: 0,
    asteroidsAvoided: 0,
    spawnTimer: 0,
    landedOnce: false,
  });

  const groundSky = useRef(new THREE.Color("#6d9dbb"));
  const spaceSky = useRef(new THREE.Color("#020711"));
  const reentrySky = useRef(new THREE.Color("#d96528"));

  // Ensure NASA NeoWs dataset is loaded before entering asteroid corridor
  useEffect(() => {
    void loadNeoFeed();
  }, [loadNeoFeed]);

  // Reset flight simulation cleanly on new run or return journey
  useEffect(() => {
    const f = flight.current;
    const prevStage = prevStageRef.current;
    prevStageRef.current = flightStage;

    if (flightStage === "moon-launch" && prevStage !== "moon-launch") {
      const storeTelemetry = useGameStore.getState().telemetry;
      f.stageElapsed = 0;
      f.altitudeKm = 0;
      f.speedMs = 0;
      f.fuelPct = storeTelemetry.fuelPct;
      f.powerPct = storeTelemetry.powerPct;
      f.x = 0;
      f.y = -0.3;
      f.heading = 0;
      f.pitchTrim = 0;
      f.journeyProgress = 0;
      f.gravityTurn = 0;
      f.invulnTimer = 0;
      f.shakeTimer = 0;
      f.landedOnce = false;
      asteroidsRef.current = [];
      setAsteroidsRenderKey((k) => k + 1);
      return;
    }

    if (flightStage === "pad") {
      const hasExtraFuel = spacecraft.installedIds.includes("fuel-tank");
      const hasSolar = spacecraft.installedIds.includes("solar-array");
      const hasBattery = spacecraft.installedIds.includes("battery");
      f.stageElapsed = 0;
      f.altitudeKm = 0;
      f.speedMs = 0;
      f.fuelPct = Math.min(100, (hasExtraFuel ? 100 : 28) + vehicle.fuelBonusPct);
      f.powerPct = hasSolar ? 100 : hasBattery ? 65 : 35;
      f.x = 0;
      f.y = -0.45;
      f.heading = 0;
      f.pitchTrim = 0;
      f.journeyProgress = 0;
      f.gravityTurn = 0;
      f.invulnTimer = 0;
      f.shakeTimer = 0;
      f.asteroidsSpawned = 0;
      f.asteroidsAvoided = 0;
      f.spawnTimer = 0;
      f.landedOnce = false;
      anomalyStepRef.current = 0;
      reentryCueStepRef.current = 0;
      asteroidsRef.current = [];
      setThrustVis(0);
      setReentryVis(0);
      setParachuteVis(0);
      setAsteroidsRenderKey((k) => k + 1);
    }
  }, [flightRunId, flightStage, spacecraft.installedIds, vehicle.fuelBonusPct]);

  // Keyboard controls (A/D/W/S/Arrows + C camera + L landing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowDown"
      ) {
        e.preventDefault();
      }
      if (e.code === "KeyC" && !e.repeat) {
        cycleCameraMode();
      }
      if (e.code === "KeyL" && !e.repeat) {
        const st = useGameStore.getState();
        if (
          st.flightStage === "moon-approach" &&
          st.telemetry.journeyProgress >= 0.85 &&
          (mission.destination === "Moon" || mission.destination === "Mars")
        ) {
          st.setFlightStage("moon-landing");
          st.showNotification(
            mission.destination === "Mars"
              ? "Powered Mars descent initiated."
              : "Powered lunar descent initiated."
          );
        }
      }
      keys.current[e.code] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    const clearKeys = () => {
      keys.current = {};
      resetVirtualInput();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    return () => {
      clearKeys();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
    };
  }, [cycleCameraMode, mission.destination]);

  // Stop sound engine on unmount or pause
  useEffect(() => {
    return () => {
      soundEngine.setEngineThrust(false, 0, true);
    };
  }, []);

  useFrame((state, delta) => {
    if (paused || missionFailed) {
      soundEngine.setEngineThrust(false, 0, true);
      return;
    }

    const rawDt = Math.min(delta, 0.05);
    const f = flight.current;
    const k = keys.current;
    const storeSnapshot = useGameStore.getState();
    let currentStage: FlightStage = storeSnapshot.flightStage;

    const isSafeCruise =
      !storeSnapshot.activeAnomaly &&
      ((currentStage === "space-travel" && f.journeyProgress < 0.32) ||
        (currentStage === "moon-approach" && f.journeyProgress < 0.84) ||
        (currentStage === "earth-return" && f.journeyProgress < 0.96));

    if (storeSnapshot.fastForward && !isSafeCruise) {
      setFastForward(false);
    }
    const simScale = storeSnapshot.fastForward && isSafeCruise ? 3.5 : 1.0;
    const dt = rawDt * simScale;

    const adj = consumeAnomalyAdjustment();
    if (adj.fuelDelta !== 0) {
      f.fuelPct = THREE.MathUtils.clamp(f.fuelPct + adj.fuelDelta, 0, 100);
    }
    if (adj.powerDelta !== 0) {
      f.powerPct = THREE.MathUtils.clamp(f.powerPct + adj.powerDelta, 0, 100);
    }

    incrementElapsed(dt, rawDt);

    const installedIds = spacecraft.installedIds;
    const hasAttitude = installedIds.includes("attitude-control");
    const hasPropulsion = installedIds.includes("propulsion-module");
    const hasFuelTank = installedIds.includes("fuel-tank");
    const hasSolar = installedIds.includes("solar-array");
    const hasBattery = installedIds.includes("battery");
    const hasComputer = installedIds.includes("onboard-computer");
    const hasThermal = installedIds.includes("thermal-control");
    const hasLandingGear = installedIds.includes("landing-gear");
    const isMars = mission.destination === "Mars";

    const overweightKg = Math.max(
      0,
      spacecraft.resources.massKg - spacecraft.resources.massLimitKg
    );
    const overweightFuelFactor = overweightKg > 0 ? 1.45 : 1.0;
    const diffBurnFactor = Math.min(1.12, diffCfg.hazardIntensity);

    const steerAgility = hasAttitude ? 1.35 : 1.0;
    const marsFuelFactor = isMars ? 1.35 : 1.0;
    const noTankFactor = hasFuelTank ? 1.0 : 2.1;
    const fuelBurnMultiplier =
      (hasPropulsion ? 0.8 : 1.25) *
      marsFuelFactor *
      noTankFactor *
      orbit.fuelBurnFactor *
      diffBurnFactor;

    const boost = Boolean(k.ShiftLeft || k.ShiftRight || virtualInput.boost);
    const left = Boolean(k.KeyA || k.ArrowLeft || virtualInput.left);
    const right = Boolean(k.KeyD || k.ArrowRight || virtualInput.right);
    const up = Boolean(k.KeyW || k.ArrowUp || virtualInput.up);
    const down = Boolean(k.KeyS || k.ArrowDown || virtualInput.down);

    const steerX = (right ? 1 : 0) - (left ? 1 : 0);
    const steerY = (up ? 1 : 0) - (down ? 1 : 0);

    let phaseLabel = "ON PAD";
    let thrustNow = 0;
    let reentryNow = 0;
    let parachuteNow = 0;

    if (f.fuelPct <= 0 && currentStage !== "pad") {
      soundEngine.setEngineThrust(false, 0, true);
      updateTelemetry({ fuelPct: 0, powerPct: f.powerPct });
      triggerSystemFailure(
        hasFuelTank
          ? "Propellant exhausted (0%) — spacecraft out of fuel in deep space."
          : "Propellant exhausted (0%): Insufficient fuel capacity without a Propellant Tank."
      );
      return;
    }

    // ---------------------------------------------------
    // ELECTRICAL POWER SIMULATION (active once launched)
    // ---------------------------------------------------
    if (currentStage !== "pad") {
      const powerGen = spacecraft.resources.powerGenerationW;
      const powerReserve = spacecraft.resources.powerReserveW;
      if (powerGen === 0) {
        f.powerPct = Math.max(0, f.powerPct - (hasBattery ? 2.8 : 6.2) * dt);
      } else if (powerReserve < 0) {
        f.powerPct = Math.max(
          0,
          f.powerPct - Math.min(4.8, Math.abs(powerReserve) * 0.05) * dt
        );
      } else if (powerReserve < 15) {
        f.powerPct = Math.max(0, f.powerPct - 0.18 * dt);
      } else {
        f.powerPct = Math.min(100, f.powerPct + 1.4 * dt);
      }

      if (f.powerPct <= 0) {
        soundEngine.setEngineThrust(false, 0, true);
        triggerSystemFailure(
          !hasSolar
            ? "Electrical failure: No Solar Array installed — battery reserves depleted mid-flight."
            : "Power grid overload: Spacecraft power draw exceeded solar generation capacity."
        );
        return;
      }
    }

    // ---------------------------------------------------
    // STAGE MACHINE & WEAK-BUILD FAILURE ENFORCEMENT
    // ---------------------------------------------------
    if (currentStage === "pad" && !launchActive) {
      f.gravityTurn = 0;
      f.y = -0.45;
      f.x = 0;
      phaseLabel = "ON PAD";
    } else if (currentStage === "ignition") {
      f.stageElapsed += dt;
      thrustNow = THREE.MathUtils.clamp(f.stageElapsed / 1.8, 0.2, 1);
      phaseLabel = "ENGINE IGNITION";
      f.shakeTimer = 0.025;
      if (f.stageElapsed >= 2.2) {
        currentStage = "ascent";
        setFlightStage("ascent");
        f.stageElapsed = 0;
        showNotification("Liftoff! Tower cleared.");
      }
    } else if (currentStage === "ascent") {
      f.stageElapsed += dt;
      thrustNow = boost ? 1.2 : 1.0;
      phaseLabel = f.altitudeKm < 25 ? "LIFTOFF" : "GRAVITY TURN ASCENT";

      const accel =
        (hasPropulsion ? 780 : 480) *
        vehicle.thrustMultiplier *
        (boost ? 1.25 : 1);
      f.speedMs = Math.min(f.speedMs + accel * dt, 7800);
      f.altitudeKm += (f.speedMs * dt) / 350;
      f.fuelPct = Math.max(
        0,
        f.fuelPct - 0.9 * fuelBurnMultiplier * overweightFuelFactor * dt
      );

      if (overweightKg > 45 && f.altitudeKm >= 46) {
        soundEngine.setEngineThrust(false, 0, true);
        triggerSystemFailure(
          `Structural ascent failure: Spacecraft mass (${spacecraft.resources.massKg} KG) severely exceeded ${vehicle.name} payload ceiling (${spacecraft.resources.massLimitKg} KG).`
        );
        return;
      }

      if (!hasPropulsion && f.altitudeKm >= 28) {
        soundEngine.setEngineThrust(false, 0, true);
        triggerSystemFailure(
          "Propulsion failure: No Propulsion Module installed — orbital stage engines failed to ignite."
        );
        return;
      }

      // Gravity turn from altitude 10km -> 65km
      f.gravityTurn = THREE.MathUtils.clamp((f.altitudeKm - 10) / 55, 0, 1);

      // Smoothly lift off pad then center to flight corridor Y=0
      const liftoffLift = THREE.MathUtils.clamp(f.altitudeKm / 12, 0, 1) * 2.4;
      f.y = THREE.MathUtils.lerp(-0.45 + liftoffLift, 0, f.gravityTurn);

      // Subtle steering once clear of tower
      if (f.altitudeKm > 6) {
        f.heading = THREE.MathUtils.damp(
          f.heading,
          steerX * 0.65 * steerAgility,
          4,
          dt
        );
        f.x = THREE.MathUtils.clamp(f.x + f.heading * 2.6 * dt, -3.5, 3.5);
      }

      if (f.altitudeKm >= 100) {
        currentStage = "space-travel";
        setFlightStage("space-travel");
        f.stageElapsed = 0;
        f.gravityTurn = 1;
        unlockAchievement("liftoff");
        showNotification(
          isMars
            ? "Stage 2: Orbital Escape — En Route to Mars"
            : "Stage 2: Orbital Escape — Entering Cislunar Space"
        );
      }
    } else if (currentStage === "space-travel") {
      f.stageElapsed += dt;
      thrustNow = boost ? 1.15 : 0.72;
      phaseLabel = isMars ? "INTERPLANETARY TRANSIT" : "CISLUNAR TRANSIT";

      const targetSpeed = boost ? 10800 : 8800;
      f.speedMs = THREE.MathUtils.damp(f.speedMs, targetSpeed, 2.2, dt);
      f.altitudeKm += (f.speedMs * dt) / 40;
      f.fuelPct = Math.max(0, f.fuelPct - 0.65 * fuelBurnMultiplier * dt);

      const transitRate = boost ? 0.042 : 0.032;
      f.journeyProgress = Math.min(1, f.journeyProgress + transitRate * dt);

      if (!hasComputer && f.journeyProgress >= 0.16) {
        soundEngine.setEngineThrust(false, 0, true);
        triggerSystemFailure(
          "Avionics failure: No Flight Computer installed — navigation guidance and trajectory lock lost."
        );
        return;
      }

      if (isMars && spacecraft.resources.communicationMbps < 5 && f.journeyProgress >= 0.24) {
        soundEngine.setEngineThrust(false, 0, true);
        triggerSystemFailure(
          "Deep-space telemetry blackout: Insufficient communication link for Mars transit."
        );
        return;
      }

      if (f.journeyProgress >= 0.22 && anomalyStepRef.current === 0) {
        anomalyStepRef.current = 1;
        soundEngine.setEngineThrust(false, 0, true);
        const eventIdx =
          isMars || orbit.radiationHazard === "HIGH" ? 0 : 1;
        triggerAnomaly(FLIGHT_ANOMALIES[eventIdx]);
        return;
      }

      f.heading = THREE.MathUtils.damp(
        f.heading,
        steerX * 0.85 * steerAgility,
        5,
        dt
      );
      f.pitchTrim = THREE.MathUtils.damp(
        f.pitchTrim,
        steerY * 0.45 * steerAgility,
        5,
        dt
      );
      f.x = THREE.MathUtils.clamp(f.x + f.heading * 5.0 * dt, -5.2, 5.2);
      f.y = THREE.MathUtils.clamp(f.y + f.pitchTrim * 4.5 * dt, -2.9, 2.9);

      if (f.journeyProgress >= 0.34) {
        currentStage = "asteroids";
        setFlightStage("asteroids");
        f.stageElapsed = 0;
        f.asteroidsSpawned = 0;
        f.asteroidsAvoided = 0;
        f.spawnTimer = 0.2;
        asteroidsRef.current = [];
        setAsteroidsRenderKey((v) => v + 1);
        showNotification("Warning: Asteroid Corridor Ahead! Steer with A/D or Arrows.");
      }
    } else if (currentStage === "asteroids") {
      f.stageElapsed += dt;
      thrustNow = boost ? 1.1 : 0.75;
      phaseLabel = "ASTEROID CORRIDOR";

      f.speedMs = THREE.MathUtils.damp(f.speedMs, boost ? 11200 : 9200, 3, dt);
      f.altitudeKm += (f.speedMs * dt) / 45;
      f.fuelPct = Math.max(0, f.fuelPct - 0.55 * fuelBurnMultiplier * dt);

      if (spacecraft.resources.communicationMbps === 0 && f.asteroidsSpawned >= 6) {
        soundEngine.setEngineThrust(false, 0, true);
        triggerSystemFailure(
          "Communications blackout: No antenna or transmitter installed — mission control uplink lost."
        );
        return;
      }

      if (
        !hasThermal &&
        f.asteroidsSpawned >= Math.floor(mission.asteroidWaveCount * 0.55)
      ) {
        soundEngine.setEngineThrust(false, 0, true);
        triggerSystemFailure(
          "Thermal overload: No Thermal Control System installed — deep-space radiation overheated spacecraft systems."
        );
        return;
      }

      f.heading = THREE.MathUtils.damp(
        f.heading,
        steerX * 1.1 * steerAgility,
        6,
        dt
      );
      f.pitchTrim = THREE.MathUtils.damp(
        f.pitchTrim,
        steerY * 0.75 * steerAgility,
        6,
        dt
      );
      f.x = THREE.MathUtils.clamp(f.x + f.heading * 6.4 * dt, -5.2, 5.2);
      f.y = THREE.MathUtils.clamp(f.y + f.pitchTrim * 5.2 * dt, -2.9, 2.9);

      // Spawn asteroids mapped to real NASA NeoWs objects (or labeled fallback dataset)
      f.spawnTimer -= dt;
      if (
        f.spawnTimer <= 0 &&
        f.asteroidsSpawned < mission.asteroidWaveCount
      ) {
        f.spawnTimer = isMars ? 0.54 : 0.72;
        f.asteroidsSpawned += 1;

        const feedList = storeSnapshot.neoFeed.asteroids;
        const neo = feedList[(f.asteroidsSpawned - 1) % feedList.length];
        const diameterScaled = THREE.MathUtils.clamp(
          0.56 + Math.log10(Math.max(10, neo.estimatedDiameterM)) * 0.3,
          0.62,
          1.42
        );
        const velocityScaled = THREE.MathUtils.clamp(
          30 + neo.relativeVelocityKmS * 1.15,
          34,
          64
        );

        // Bias some asteroids near player's lane so steering matters!
        const aimBias = f.asteroidsSpawned % 2 === 0 ? f.x : (Math.random() - 0.5) * 9.5;
        const entity: AsteroidEntity = {
          id: f.asteroidsSpawned,
          neo,
          x: THREE.MathUtils.clamp(aimBias + (Math.random() - 0.5) * 2.2, -5.4, 5.4),
          y: THREE.MathUtils.clamp(
            (f.asteroidsSpawned % 3 === 0 ? f.y : (Math.random() - 0.5) * 5.2),
            -2.8,
            2.8
          ),
          z: -105 - Math.random() * 20,
          speed: velocityScaled + (boost ? 12 : 0),
          radius: diameterScaled,
          rotX: Math.random() * Math.PI,
          rotY: Math.random() * Math.PI,
          rotZ: Math.random() * Math.PI,
          spinX: (Math.random() - 0.5) * 2.4,
          spinY: (Math.random() - 0.5) * 2.4,
          variant: f.asteroidsSpawned % 3,
          passed: false,
          hit: false,
        };
        asteroidsRef.current.push(entity);
        setAsteroidsRenderKey((v) => v + 1);
      }

      // Advance asteroids & check collision with rocket at (f.x, f.y, -9)
      if (f.invulnTimer > 0) f.invulnTimer = Math.max(0, f.invulnTimer - dt);
      if (f.shakeTimer > 0) f.shakeTimer = Math.max(0, f.shakeTimer - dt);

      let listChanged = false;
      asteroidsRef.current.forEach((ast, idx) => {
        ast.z += ast.speed * dt;
        ast.rotX += ast.spinX * dt;
        ast.rotY += ast.spinY * dt;

        const mesh = asteroidMeshRefs.current[idx];
        if (mesh) {
          mesh.position.set(ast.x, ast.y, ast.z);
          mesh.rotation.set(ast.rotX, ast.rotY, ast.rotZ);
          mesh.scale.setScalar(ast.radius);
        }

        // Collision sphere test near rocket Z = -9
        if (!ast.hit && Math.abs(ast.z - -9) < 1.55) {
          const distXY = Math.hypot(ast.x - f.x, ast.y - f.y);
          if (distXY < ast.radius + 0.58 && f.invulnTimer <= 0) {
            ast.hit = true;
            f.invulnTimer = 0.75;
            f.shakeTimer = 0.45;
            soundEngine.playImpact(muted);
            triggerHullDamage(22);
            showNotification("Impact detected! Hull integrity reduced.");
          }
        }

        if (!ast.passed && ast.z > -5) {
          ast.passed = true;
          if (!ast.hit) f.asteroidsAvoided += 1;
        }
      });

      const activeRemaining = asteroidsRef.current.filter((a) => a.z < 18);
      if (activeRemaining.length !== asteroidsRef.current.length) {
        asteroidsRef.current = activeRemaining;
        listChanged = true;
      }
      if (listChanged) setAsteroidsRenderKey((v) => v + 1);

      const waveProgress =
        (f.asteroidsAvoided + useGameStore.getState().telemetry.asteroidHits) /
        mission.asteroidWaveCount;
      f.journeyProgress = THREE.MathUtils.lerp(0.34, 0.72, Math.min(1, waveProgress));

      if (
        f.asteroidsSpawned >= mission.asteroidWaveCount &&
        asteroidsRef.current.length === 0
      ) {
        if (useGameStore.getState().telemetry.asteroidHits === 0) {
          unlockAchievement("clean-belt");
        }
        currentStage = "moon-approach";
        setFlightStage("moon-approach");
        f.stageElapsed = 0;
        showNotification(
          isMars
            ? "Asteroid corridor cleared! Approaching Mars orbit."
            : "Asteroid corridor cleared! Approaching lunar orbit."
        );
      }
    } else if (currentStage === "moon-approach") {
      f.stageElapsed += dt;
      thrustNow = 0.55;
      phaseLabel = isMars ? "MARS APPROACH" : "LUNAR APPROACH";

      f.speedMs = THREE.MathUtils.damp(f.speedMs, 2600, 1.5, dt);
      f.fuelPct = Math.max(0, f.fuelPct - 0.45 * fuelBurnMultiplier * dt);

      f.heading = THREE.MathUtils.damp(
        f.heading,
        steerX * 0.65 * steerAgility,
        4,
        dt
      );
      f.pitchTrim = THREE.MathUtils.damp(
        f.pitchTrim,
        steerY * 0.4 * steerAgility,
        4,
        dt
      );
      f.x = THREE.MathUtils.clamp(f.x + f.heading * 3.5 * dt, -3.5, 3.5);
      f.y = THREE.MathUtils.clamp(f.y + f.pitchTrim * 3.0 * dt, -2.0, 2.0);

      // Approach up to 0.92 so player can initiate landing
      f.journeyProgress = Math.min(0.92, f.journeyProgress + 0.032 * dt);
    } else if (currentStage === "moon-landing") {
      f.stageElapsed += dt;
      thrustNow = 0.95;
      phaseLabel = "POWERED DESCENT";

      f.speedMs = THREE.MathUtils.lerp(2400, 0, Math.min(1, f.stageElapsed / 4.8));
      f.fuelPct = Math.max(0, f.fuelPct - 0.7 * fuelBurnMultiplier * dt);
      f.x = THREE.MathUtils.damp(f.x, 0, 3, dt);
      f.y = THREE.MathUtils.damp(f.y, -0.35, 3, dt);
      f.heading = THREE.MathUtils.damp(f.heading, 0, 4, dt);
      f.pitchTrim = THREE.MathUtils.damp(f.pitchTrim, 0, 4, dt);
      // Pitch vertical tail-down for powered planetary landing
      f.gravityTurn = THREE.MathUtils.damp(f.gravityTurn, 0, 2.2, dt);

      if (f.stageElapsed >= 4.7 && !hasLandingGear) {
        soundEngine.setEngineThrust(false, 0, true);
        soundEngine.playImpact(muted);
        triggerSystemFailure(
          `Touchdown crash: No Planetary Landing Gear installed for ${mission.destination} descent.`
        );
        return;
      }

      if (f.stageElapsed >= 5.0 && !f.landedOnce) {
        f.landedOnce = true;
        soundEngine.setEngineThrust(false, 0, true);
        soundEngine.playTouchdown(muted);
        // Flush exact remaining fuel and power to store before unmounting FlightScene
        updateTelemetry({
          altitudeKm: 0,
          speedMs: 0,
          fuelPct: f.fuelPct,
          powerPct: f.powerPct,
          activeNeo: null,
          phaseLabel: isMars ? "MARS TOUCHDOWN" : "LUNAR TOUCHDOWN",
        });
        unlockAchievement("touchdown");
        showNotification(
          isMars
            ? "Mars touchdown confirmed! Welcome to Jezero Crater."
            : "Lunar touchdown confirmed! Welcome to the Moon."
        );
        setPage("lunar");
        return;
      }
    } else if (currentStage === "moon-launch") {
      f.stageElapsed += dt;
      thrustNow = 1.05;
      phaseLabel = isMars ? "MARS ASCENT" : "LUNAR ASCENT";

      f.speedMs = Math.min(f.speedMs + 550 * dt, 4800);
      f.altitudeKm += (f.speedMs * dt) / 280;
      f.fuelPct = Math.max(0, f.fuelPct - 0.6 * fuelBurnMultiplier * dt);

      f.gravityTurn = THREE.MathUtils.clamp((f.stageElapsed - 1.5) / 3.2, 0, 1);
      f.y = THREE.MathUtils.lerp(-0.3, 0, f.gravityTurn);

      if (f.stageElapsed >= 5.2) {
        currentStage = "earth-return";
        setFlightStage("earth-return");
        f.stageElapsed = 0;
        f.journeyProgress = 0;
        showNotification(
          isMars
            ? "Mars escape burn complete — Returning to Earth."
            : "Lunar escape burn complete — Returning to Earth."
        );
      }
    } else if (currentStage === "earth-return") {
      f.stageElapsed += dt;
      thrustNow = boost ? 1.1 : 0.7;
      phaseLabel = "EARTH RETURN TRANSIT";

      f.speedMs = THREE.MathUtils.damp(f.speedMs, boost ? 11200 : 9400, 2, dt);
      f.fuelPct = Math.max(0, f.fuelPct - 0.5 * fuelBurnMultiplier * dt);
      f.journeyProgress = Math.min(1, f.journeyProgress + (boost ? 0.09 : 0.065) * dt);

      if (f.journeyProgress >= 0.52 && anomalyStepRef.current <= 1) {
        anomalyStepRef.current = 2;
        soundEngine.setEngineThrust(false, 0, true);
        triggerAnomaly(
          FLIGHT_ANOMALIES[orbit.radiationHazard === "HIGH" ? 0 : 2]
        );
        return;
      }

      f.heading = THREE.MathUtils.damp(
        f.heading,
        steerX * 0.75 * steerAgility,
        4,
        dt
      );
      f.pitchTrim = THREE.MathUtils.damp(
        f.pitchTrim,
        steerY * 0.45 * steerAgility,
        4,
        dt
      );
      f.x = THREE.MathUtils.clamp(f.x + f.heading * 4.5 * dt, -4.5, 4.5);
      f.y = THREE.MathUtils.clamp(f.y + f.pitchTrim * 3.8 * dt, -2.5, 2.5);

      if (f.journeyProgress >= 1) {
        currentStage = "earth-reentry";
        setFlightStage("earth-reentry");
        f.stageElapsed = 0;
        showNotification("Atmospheric entry interface! Thermal shielding active.");
      }
    } else if (currentStage === "earth-reentry") {
      f.stageElapsed += dt;
      const t = f.stageElapsed;

      if (!hasThermal && t >= 1.6) {
        soundEngine.setEngineThrust(false, 0, true);
        triggerSystemFailure(
          "Re-entry burn-up: No Thermal Control System installed — hull melted during atmospheric entry."
        );
        return;
      }

      if (t < 3.4) {
        // Phase 1: Fiery Atmospheric Re-entry & Attitude Flip to Upright
        thrustNow = 0.25;
        reentryNow = Math.sin((t / 3.4) * Math.PI);
        phaseLabel = "ATMOSPHERIC RE-ENTRY";
        f.speedMs = THREE.MathUtils.lerp(9400, 320, t / 3.4);
        f.altitudeKm = THREE.MathUtils.lerp(120, 18, t / 3.4);
        f.gravityTurn = THREE.MathUtils.damp(f.gravityTurn, 0, 1.8, dt);
        f.shakeTimer = 0.045;
      } else if (t < 7.0) {
        // Phase 2: Parachute Deployment & Controlled Vertical Earth Landing
        if (reentryCueStepRef.current === 0) {
          reentryCueStepRef.current = 1;
          showNotification(
            "Recovery parachutes deployed! Descending to Earth Recovery Zone."
          );
        }
        const landP = (t - 3.4) / 3.6;
        thrustNow = landP > 0.68 ? 0.65 : 0.08;
        reentryNow = 0;
        parachuteNow = landP < 0.94 ? Math.min(1, (t - 3.4) / 0.65) : Math.max(0, (1 - landP) * 16);
        phaseLabel =
          landP < 0.7 ? "PARACHUTE DESCENT" : "EARTH RETRO-LANDING";
        f.speedMs = THREE.MathUtils.lerp(320, 0, landP);
        f.altitudeKm = Math.max(0, THREE.MathUtils.lerp(18, 0, landP));
        f.gravityTurn = THREE.MathUtils.damp(f.gravityTurn, 0, 6, dt);
        f.y = THREE.MathUtils.lerp(1.4, -0.45, THREE.MathUtils.smoothstep(landP, 0.2, 1));
        f.shakeTimer = landP > 0.72 && landP < 0.95 ? 0.015 : 0;
      } else {
        // Phase 3: Touchdown on Earth Recovery Zone before Mission Debrief
        if (reentryCueStepRef.current <= 1) {
          reentryCueStepRef.current = 2;
          soundEngine.playTouchdown(muted);
          showNotification("Touchdown confirmed at Earth Recovery Complex!");
        }
        thrustNow = 0;
        reentryNow = 0;
        parachuteNow = 0;
        phaseLabel = "EARTH TOUCHDOWN CONFIRMED";
        f.speedMs = 0;
        f.altitudeKm = 0;
        f.gravityTurn = 0;
        f.y = -0.45;
        f.shakeTimer = 0;
      }

      f.x = THREE.MathUtils.damp(f.x, 0, 4, dt);
      f.heading = THREE.MathUtils.damp(f.heading, 0, 5, dt);
      f.pitchTrim = THREE.MathUtils.damp(f.pitchTrim, 0, 5, dt);

      if (t >= 7.8) {
        soundEngine.setEngineThrust(false, 0, true);
        soundEngine.playTouchdown(muted);
        updateTelemetry({
          altitudeKm: 0,
          speedMs: 0,
          fuelPct: f.fuelPct,
          powerPct: f.powerPct,
          activeNeo: null,
          phaseLabel: "EARTH TOUCHDOWN CONFIRMED",
        });
        completeMission();
        return;
      }
    }

    // Fuel exhaustion check during flight
    if (f.fuelPct <= 0 && currentStage !== "pad") {
      soundEngine.setEngineThrust(false, 0, true);
      updateTelemetry({ fuelPct: 0, powerPct: f.powerPct });
      triggerSystemFailure(
        hasFuelTank
          ? "Propellant exhausted (0%) — spacecraft adrift with empty tanks."
          : "Propellant exhausted (0%): Insufficient fuel capacity without a Propellant Tank."
      );
      return;
    }

    setThrustVis(thrustNow);
    setReentryVis(reentryNow);
    setParachuteVis(parachuteNow);
    soundEngine.setEngineThrust(thrustNow > 0.05, thrustNow, muted);

    // ---------------------------------------------------
    // ENVIRONMENT VISUALS UPDATE
    // ---------------------------------------------------
    const isPadOrAscent =
      currentStage === "pad" ||
      currentStage === "ignition" ||
      currentStage === "ascent";

    if (worldRef.current) {
      worldRef.current.visible = isPadOrAscent && f.altitudeKm < 65;
      worldRef.current.position.y = -Math.min(f.altitudeKm * 0.42, 48);
    }

    if (earthLandingRef.current) {
      const showEarthRecovery =
        currentStage === "earth-reentry" && f.stageElapsed >= 2.8;
      earthLandingRef.current.visible = showEarthRecovery;
      if (showEarthRecovery) {
        const dropP = THREE.MathUtils.clamp((f.stageElapsed - 2.8) / 4.2, 0, 1);
        earthLandingRef.current.position.y = THREE.MathUtils.lerp(-42, 0, dropP);
      }
    }

    if (smokeRef.current) {
      smokeRef.current.visible =
        launchActive &&
        (currentStage === "ignition" ||
          (currentStage === "ascent" && f.altitudeKm < 14));
      const smokeGrow =
        1 + Math.min(f.altitudeKm * 0.14 + f.stageElapsed * 0.25, 2.8);
      smokeRef.current.scale.setScalar(smokeGrow);
    }

    if (earthLandingSmokeRef.current) {
      const landingDust =
        currentStage === "earth-reentry" &&
        f.stageElapsed >= 5.8 &&
        f.stageElapsed <= 7.4;
      earthLandingSmokeRef.current.visible = landingDust;
      if (landingDust) {
        const dustScale = 1 + (f.stageElapsed - 5.8) * 1.1;
        earthLandingSmokeRef.current.scale.setScalar(dustScale);
      }
    }

    if (lunarPadRef.current) {
      lunarPadRef.current.visible =
        currentStage === "moon-landing" || currentStage === "moon-launch";
      if (currentStage === "moon-landing") {
        const p = THREE.MathUtils.clamp(f.stageElapsed / 5.0, 0, 1);
        lunarPadRef.current.position.y = THREE.MathUtils.lerp(-24, -2.85, p);
      } else if (currentStage === "moon-launch") {
        lunarPadRef.current.position.y = -2.85 - Math.min(f.altitudeKm * 0.7, 32);
      }
    }

    if (starsRef.current) {
      starsRef.current.visible =
        (!isPadOrAscent || f.altitudeKm > 28) &&
        !(currentStage === "earth-reentry" && f.stageElapsed >= 3.2);
    }

    // Sky color transition
    if (state.scene.background instanceof THREE.Color) {
      if (isPadOrAscent) {
        const skyT = THREE.MathUtils.clamp(f.altitudeKm / 70, 0, 1);
        state.scene.background.lerpColors(groundSky.current, spaceSky.current, skyT);
      } else if (currentStage === "earth-reentry") {
        const tRe = f.stageElapsed;
        if (tRe < 2.2) {
          state.scene.background.lerpColors(
            spaceSky.current,
            reentrySky.current,
            tRe / 2.2
          );
        } else if (tRe < 4.2) {
          state.scene.background.lerpColors(
            reentrySky.current,
            groundSky.current,
            (tRe - 2.2) / 2.0
          );
        } else {
          state.scene.background.copy(groundSky.current);
        }
      } else {
        state.scene.background.copy(spaceSky.current);
      }
      if (state.scene.fog) {
        state.scene.fog.color.copy(state.scene.background);
      }
    }

    // Receding or Approaching Earth
    if (earthGroupRef.current) {
      if (
        currentStage === "space-travel" ||
        currentStage === "asteroids" ||
        currentStage === "moon-approach"
      ) {
        earthGroupRef.current.visible = true;
        const p = f.journeyProgress;
        earthGroupRef.current.position.set(
          -2.5,
          -1.5,
          THREE.MathUtils.lerp(24, 155, p)
        );
        earthGroupRef.current.scale.setScalar(THREE.MathUtils.lerp(1.5, 0.35, p));
        earthGroupRef.current.rotation.y += dt * 0.025;
      } else if (currentStage === "earth-return") {
        earthGroupRef.current.visible = true;
        const p = f.journeyProgress;
        earthGroupRef.current.position.set(
          0,
          -0.6,
          THREE.MathUtils.lerp(-155, -28, p)
        );
        earthGroupRef.current.scale.setScalar(THREE.MathUtils.lerp(0.45, 2.3, p));
        earthGroupRef.current.rotation.y += dt * 0.03;
      } else if (currentStage === "earth-reentry" && f.stageElapsed < 3.2) {
        earthGroupRef.current.visible = true;
        earthGroupRef.current.position.set(0, -14, -22);
        earthGroupRef.current.scale.setScalar(4.2);
      } else {
        earthGroupRef.current.visible = false;
      }
    }

    // Approaching or Receding Moon
    if (moonGroupRef.current) {
      if (
        (currentStage === "ascent" && f.altitudeKm > 55) ||
        currentStage === "space-travel" ||
        currentStage === "asteroids" ||
        currentStage === "moon-approach"
      ) {
        moonGroupRef.current.visible = true;
        const p = f.journeyProgress;
        moonGroupRef.current.position.set(
          0,
          0.2,
          THREE.MathUtils.lerp(-165, -36, p)
        );
        moonGroupRef.current.scale.setScalar(THREE.MathUtils.lerp(0.5, 2.2, p));
        moonGroupRef.current.rotation.y += dt * 0.012;
      } else if (currentStage === "moon-launch" || currentStage === "earth-return") {
        moonGroupRef.current.visible = currentStage === "earth-return" && f.journeyProgress < 0.7;
        const p = f.journeyProgress;
        moonGroupRef.current.position.set(
          2.2,
          -0.8,
          THREE.MathUtils.lerp(22, 145, p)
        );
        moonGroupRef.current.scale.setScalar(THREE.MathUtils.lerp(1.7, 0.35, p));
      } else {
        moonGroupRef.current.visible = false;
      }
    }

    // ---------------------------------------------------
    // ROCKET TRANSFORM & UNIFIED SYNCHRONIZED CAMERAS
    // ---------------------------------------------------
    const rocketPos = _vecA.set(f.x, f.y, -9);
    const pitchBase = (1 - f.gravityTurn) * (Math.PI / 2);
    _eulerA.set(
      pitchBase + f.pitchTrim * 0.28,
      -f.heading * 0.22,
      -f.heading * 0.48,
      "YXZ"
    );
    _quatA.setFromEuler(_eulerA);

    if (rocketGroupRef.current) {
      rocketGroupRef.current.position.copy(rocketPos);
      rocketGroupRef.current.quaternion.copy(_quatA);
    }

    if (cockpitRef.current) {
      cockpitRef.current.visible = cameraMode === "cockpit";
      cockpitRef.current.position.copy(rocketPos);
      cockpitRef.current.quaternion.copy(_quatA);
    }

    const shakeAmp =
      f.shakeTimer > 0
        ? 0.055
        : thrustNow > 0.1 && isPadOrAscent
        ? 0.012
        : 0;
    const shakeX = Math.sin(state.clock.elapsedTime * 42) * shakeAmp;
    const shakeY = Math.cos(state.clock.elapsedTime * 37) * shakeAmp;

    if (cameraMode === "cockpit") {
      _vecB.set(shakeX * 0.5, 0.14 + shakeY * 0.5, 0.22).applyQuaternion(_quatA);
      desiredCamera.current.copy(rocketPos).add(_vecB);

      _vecC.set(0, 0.14, -18).applyQuaternion(_quatA);
      cameraLookTarget.current.copy(rocketPos).add(_vecC);
    } else if (cameraMode === "rear") {
      // Blend gracefully between vertical pad wide shot and horizontal chase shot
      _padCamPos.set(f.x + 2.9, f.y + 1.2, -9 + 8.6);
      _padLook.set(f.x, f.y + 0.7, -9);

      _flightCamPos.set(
        f.x * 0.84 + shakeX,
        f.y * 0.84 + 1.35 + shakeY,
        -9 + 6.5
      );
      _flightLook.set(f.x, f.y + 0.15, -9 - 16);

      desiredCamera.current.lerpVectors(_padCamPos, _flightCamPos, f.gravityTurn);
      cameraLookTarget.current.lerpVectors(_padLook, _flightLook, f.gravityTurn);
    } else {
      // Front External View
      _padCamPos.set(f.x + 3.2, f.y + 3.4, -9 - 6.8);
      _padLook.set(f.x, f.y + 0.4, -9);

      _flightCamPos.set(
        f.x + 1.45 + shakeX,
        f.y + 0.95 + shakeY,
        -9 - 7.8
      );
      _flightLook.set(f.x, f.y, -9);

      desiredCamera.current.lerpVectors(_padCamPos, _flightCamPos, f.gravityTurn);
      cameraLookTarget.current.lerpVectors(_padLook, _flightLook, f.gravityTurn);
    }

    // Snap cleanly on camera mode change, smooth exponential damping during movement
    if (lastCamMode.current !== cameraMode) {
      state.camera.position.copy(desiredCamera.current);
      lastCamMode.current = cameraMode;
    } else {
      const camSmooth = 1 - Math.exp(-8 * dt);
      state.camera.position.lerp(desiredCamera.current, camSmooth);
    }
    state.camera.lookAt(cameraLookTarget.current);

    // ---------------------------------------------------
    // TELEMETRY THROTTLED PUBLISH (every 0.12s)
    // ---------------------------------------------------
    reportTimer.current += dt;
    if (reportTimer.current >= 0.12) {
      reportTimer.current = 0;
      const distMoon = Math.round(mission.distanceKm * (1 - f.journeyProgress));
      const distEarth = Math.round(mission.distanceKm * f.journeyProgress);
      let activeNeo: ActiveNeoInfo | null = null;
      if (currentStage === "asteroids" && asteroidsRef.current.length > 0) {
        const upcoming = asteroidsRef.current
          .filter((a) => !a.passed && a.z < -7)
          .sort((a, b) => b.z - a.z);
        const focusAst = upcoming[0] || asteroidsRef.current[0];
        if (focusAst) {
          activeNeo = {
            id: focusAst.neo.id,
            name: focusAst.neo.name,
            diameterM: focusAst.neo.estimatedDiameterM,
            velocityKmS: focusAst.neo.relativeVelocityKmS,
            missDistanceKm: focusAst.neo.missDistanceKm,
            hazardous: focusAst.neo.isHazardous,
            sourceLabel: storeSnapshot.neoFeed.sourceLabel,
          };
        }
      }

      updateTelemetry({
        altitudeKm: f.altitudeKm,
        speedMs: f.speedMs,
        fuelPct: f.fuelPct,
        powerPct: f.powerPct,
        heading: f.heading,
        pitch: f.pitchTrim,
        distanceToMoonKm:
          currentStage === "earth-return" || currentStage === "earth-reentry"
            ? Math.round(mission.distanceKm * f.journeyProgress)
            : distMoon,
        distanceToEarthKm:
          currentStage === "earth-return" || currentStage === "earth-reentry"
            ? Math.round(mission.distanceKm * (1 - f.journeyProgress))
            : distEarth,
        journeyProgress: f.journeyProgress,
        asteroidProgress:
          mission.asteroidWaveCount > 0
            ? Math.min(1, f.asteroidsSpawned / mission.asteroidWaveCount)
            : 0,
        asteroidsAvoided: f.asteroidsAvoided,
        phaseLabel,
        activeNeo,
      });
    }
  });

  return (
    <>
      <color attach="background" args={["#6d9dbb"]} />
      <fog attach="fog" args={["#6d9dbb", 35, 190]} />

      <ambientLight intensity={0.48} />
      <directionalLight
        position={[-14, 18, 12]}
        intensity={2.6}
        color="#fff4df"
        castShadow
      />
      <hemisphereLight args={["#9ed2ff", "#1a2430", 0.45]} />

      {/* EARTH LAUNCH ENVIRONMENT WITH REAL AERIAL SATELLITE GROUND */}
      <group ref={worldRef}>
        <mesh position={[0, -3.1, -20]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial map={earthGroundTex} roughness={0.92} metalness={0.04} />
        </mesh>

        {/* Launch pad octagon / disc */}
        <mesh position={[0, -2.85, -9]} receiveShadow>
          <cylinderGeometry args={[5.5, 6.2, 0.38, 48]} />
          <meshStandardMaterial color="#5c6a73" metalness={0.45} roughness={0.7} />
        </mesh>
        <mesh position={[0, -2.65, -9]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.8, 48]} />
          <meshStandardMaterial color="#24313b" roughness={1} />
        </mesh>

        {/* Detailed GLB Mobile Launcher Tower */}
        <Suspense fallback={null}>
          <LauncherPadModel />
        </Suspense>

        {/* Multi-layered launch smoke */}
        <group ref={smokeRef} position={[0, -2.35, -9]} visible={false}>
          {Array.from({ length: 28 }, (_, i) => {
            const angle = i * 2.15;
            const r = 0.6 + (i % 5) * 0.45;
            const x = Math.cos(angle) * r;
            const y = -0.2 + (i % 4) * 0.25;
            const z = Math.sin(angle) * r;
            const size = 0.55 + (i % 4) * 0.22;
            return (
              <mesh key={i} position={[x, y, z]} scale={size}>
                <sphereGeometry args={[1, 10, 10]} />
                <meshStandardMaterial
                  color="#cfd9e0"
                  transparent
                  opacity={0.28}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* EARTH RECOVERY & PARACHUTE LANDING ZONE */}
      <group ref={earthLandingRef} visible={false}>
        <mesh position={[0, -3.1, -20]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial map={earthGroundTex} roughness={0.92} metalness={0.04} />
        </mesh>

        {/* Concrete Earth Recovery Apron */}
        <mesh position={[0, -2.85, -9]} receiveShadow>
          <cylinderGeometry args={[7.2, 8.0, 0.38, 48]} />
          <meshStandardMaterial color="#65737d" metalness={0.35} roughness={0.75} />
        </mesh>
        <mesh position={[0, -2.65, -9]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.4, 3.8, 48]} />
          <meshBasicMaterial color="#4df0a4" />
        </mesh>
        <mesh position={[0, -2.64, -9]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[3.2, 48]} />
          <meshStandardMaterial color="#273642" roughness={0.95} />
        </mesh>

        {/* Recovery Pad Perimeter Beacons */}
        {[0, 1, 2, 3].map((idx) => {
          const a = (idx * Math.PI) / 2 + Math.PI / 4;
          return (
            <mesh
              key={idx}
              position={[Math.cos(a) * 6.0, -2.55, -9 + Math.sin(a) * 6.0]}
            >
              <sphereGeometry args={[0.18, 12, 12]} />
              <meshBasicMaterial color="#52ffae" />
            </mesh>
          );
        })}

        {/* Earth Touchdown Retro-Exhaust Plume Ring */}
        <group ref={earthLandingSmokeRef} position={[0, -2.4, -9]} visible={false}>
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            const r = 1.2 + (i % 3) * 0.45;
            return (
              <mesh
                key={i}
                position={[Math.cos(angle) * r, (i % 2) * 0.2, Math.sin(angle) * r]}
                scale={0.6 + (i % 3) * 0.18}
              >
                <sphereGeometry args={[1, 8, 8]} />
                <meshStandardMaterial
                  color="#d7e1e8"
                  transparent
                  opacity={0.28}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* PLANETARY LANDING PAD FOR MOON / MARS LANDING & RETURN LAUNCH */}
      <group ref={lunarPadRef} position={[0, -24, -9]} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[90, 64]} />
          <meshStandardMaterial
            map={mission.destination === "Mars" ? marsGroundTex : moonTex}
            bumpMap={moonHeightTex}
            bumpScale={0.18}
            color="#ffffff"
            roughness={1}
          />
        </mesh>
      </group>

      {/* SPACE STARS */}
      <group ref={starsRef} visible={false}>
        <Stars
          radius={140}
          depth={80}
          count={3200}
          factor={3.2}
          fade
          speed={0.35}
        />
      </group>

      {/* RECEDING / APPROACHING EARTH */}
      <group ref={earthGroupRef} visible={false}>
        <mesh>
          <sphereGeometry args={[5.5, 48, 48]} />
          <meshStandardMaterial map={earthTex} roughness={0.9} metalness={0.05} />
        </mesh>
        <mesh scale={1.012}>
          <sphereGeometry args={[5.5, 48, 48]} />
          <meshStandardMaterial
            map={earthCloudsTex}
            alphaMap={earthCloudsTex}
            transparent
            opacity={0.65}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={1.04}>
          <sphereGeometry args={[5.5, 40, 40]} />
          <meshBasicMaterial
            color="#3da4f0"
            transparent
            opacity={0.16}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* APPROACHING / RECEDING TARGET WORLD (MOON OR MARS) */}
      <group ref={moonGroupRef} visible={false}>
        <mesh>
          <sphereGeometry args={[5.5, 56, 56]} />
          <meshStandardMaterial
            map={mission.destination === "Mars" ? marsTex : moonTex}
            bumpMap={moonHeightTex}
            bumpScale={mission.destination === "Mars" ? 0.055 : 0.04}
            roughness={0.96}
            metalness={0}
          />
        </mesh>
        {mission.destination === "Mars" && (
          <mesh scale={1.035}>
            <sphereGeometry args={[5.5, 40, 40]} />
            <meshBasicMaterial
              color="#df7643"
              transparent
              opacity={0.18}
              side={THREE.BackSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        )}
      </group>

      {/* ASTEROID FIELD */}
      <group ref={asteroidGroupRef} key={asteroidsRenderKey}>
        {asteroidsRef.current.map((ast, idx) => (
          <mesh
            key={ast.id}
            ref={(el) => {
              asteroidMeshRefs.current[idx] = el;
            }}
            geometry={asteroidGeos[ast.variant]}
            material={ast.neo.isHazardous ? hazardousAsteroidMat : asteroidMat}
            position={[ast.x, ast.y, ast.z]}
            scale={ast.radius}
          />
        ))}
      </group>

      {/* SATURN V SPACECRAFT */}
      <group ref={rocketGroupRef} position={[0, -0.45, -9]}>
        <Suspense fallback={null}>
          <SaturnVRocket
            rocketModelVisible={cameraMode !== "cockpit"}
            thrustIntensity={thrustVis}
            reentryIntensity={reentryVis}
            parachuteIntensity={parachuteVis}
          />
        </Suspense>
      </group>

      {/* FIRST-PERSON COCKPIT */}
      <Suspense fallback={null}>
        <CockpitInterior cockpitRef={cockpitRef} />
      </Suspense>
    </>
  );
}

export default function FlightScene() {
  return (
    <Canvas
      camera={{
        position: [2.9, 0.75, -0.4],
        fov: 65,
        near: 0.1,
        far: 600,
      }}
      dpr={[1, 1.5]}
      shadows
    >
      <Suspense fallback={null}>
        <FlightSceneContent />
      </Suspense>
    </Canvas>
  );
}
