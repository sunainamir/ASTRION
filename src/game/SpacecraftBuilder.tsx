import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Suspense, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import type { BuiltSpacecraft, SpacecraftComponent } from "../types/game";
import "./SpacecraftBuilder.css";
import {
  calculateSpacecraft,
  resolveMissionPlan,
  validateSpacecraft,
} from "./spacecraftCalculations";
import {
  EDUCATIONAL_CONCEPTS,
  RECOMMENDED_LOADOUT_IDS,
  SPACECRAFT_COMPONENTS,
} from "./spacecraftData";

const CATEGORY_COLORS: Record<string, string> = {
  POWER: "#38a3eb",
  COMMUNICATION: "#6ec9ff",
  AVIONICS: "#91d4ff",
  PROPULSION: "#ff9a52",
  LANDING: "#b2c7d9",
  EXPLORATION: "#6cd9b8",
  SCIENCE: "#ffd166",
  DATA: "#86b7d9",
  PROTECTION: "#9ba9f5",
};

function SpacecraftPreview({ installedIds }: { installedIds: string[] }) {
  const craftRef = useRef<THREE.Group>(null);

  const installedComponents = useMemo(
    () =>
      installedIds
        .map((id) => SPACECRAFT_COMPONENTS.find((c) => c.id === id))
        .filter((c): c is SpacecraftComponent => Boolean(c)),
    [installedIds]
  );

  useFrame((state) => {
    if (!craftRef.current) return;
    craftRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.08;
  });

  return (
    <group ref={craftRef} rotation={[0.14, 0.45, -0.05]}>
      {/* Crew capsule */}
      <mesh position={[0, 1.35, 0]}>
        <coneGeometry args={[0.52, 0.9, 32]} />
        <meshStandardMaterial color="#e6edf5" metalness={0.65} roughness={0.28} />
      </mesh>

      {/* Main spacecraft hull */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.55, 0.62, 1.4, 32]} />
        <meshStandardMaterial color="#a6b7c7" metalness={0.78} roughness={0.32} />
      </mesh>

      {/* Service ring */}
      <mesh position={[0, -0.68, 0]}>
        <cylinderGeometry args={[0.62, 0.56, 0.55, 32]} />
        <meshStandardMaterial color="#586d80" metalness={0.8} roughness={0.38} />
      </mesh>

      {/* Main engine */}
      <mesh position={[0, -1.16, 0]}>
        <cylinderGeometry args={[0.25, 0.42, 0.42, 24]} />
        <meshStandardMaterial color="#2f3b47" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* Engine glow */}
      <mesh position={[0, -1.42, 0]}>
        <coneGeometry args={[0.24, 0.55, 16]} />
        <meshBasicMaterial color="#4bb8ff" transparent opacity={0.48} />
      </mesh>

      {/* Installed modules attached dynamically */}
      {installedComponents.map((component, index) => {
        const angle = (index / Math.max(installedComponents.length, 1)) * Math.PI * 2;
        const radius = 0.72;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 0.35 - (index % 3) * 0.4;
        const color = CATEGORY_COLORS[component.category] || "#8cc8ff";

        if (component.id === "solar-array") {
          return (
            <group key={`${component.id}-${index}`} position={[0, y, 0]}>
              {[-1, 1].map((side) => (
                <group key={side} position={[side * 0.85, 0, 0]}>
                  <mesh>
                    <boxGeometry args={[0.72, 0.035, 0.38]} />
                    <meshStandardMaterial
                      color="#1262a7"
                      metalness={0.65}
                      roughness={0.25}
                      emissive="#082c50"
                    />
                  </mesh>
                  <mesh position={[0, -0.035, 0]}>
                    <boxGeometry args={[0.76, 0.025, 0.04]} />
                    <meshStandardMaterial color="#a9c9df" />
                  </mesh>
                </group>
              ))}
            </group>
          );
        }

        if (
          component.id === "high-gain-antenna" ||
          component.id === "navigation-beacon"
        ) {
          return (
            <group key={`${component.id}-${index}`} position={[x, y, z]}>
              <mesh>
                <cylinderGeometry args={[0.035, 0.035, 0.28, 10]} />
                <meshStandardMaterial color="#cbd8e0" metalness={0.8} />
              </mesh>
              <mesh position={[0, 0.17, 0]}>
                <sphereGeometry args={[0.13, 12, 8]} />
                <meshStandardMaterial color={color} metalness={0.65} />
              </mesh>
            </group>
          );
        }

        return (
          <group key={`${component.id}-${index}`} position={[x, y, z]}>
            <mesh>
              <boxGeometry args={[0.27, 0.25, 0.25]} />
              <meshStandardMaterial
                color={color}
                metalness={0.7}
                roughness={0.28}
                emissive={color}
                emissiveIntensity={0.12}
              />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.12, 8]} />
              <meshStandardMaterial color="#e0e8ed" metalness={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function ResourceMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="builder-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

interface SpacecraftBuilderProps {
  onBack: () => void;
  onLaunch: (spacecraftData: BuiltSpacecraft) => void;
}

export default function SpacecraftBuilder({
  onBack,
  onLaunch,
}: SpacecraftBuilderProps) {
  const savedSpacecraft = useGameStore((s) => s.spacecraft);
  const difficulty = useGameStore((s) => s.difficulty);
  const objectiveId = useGameStore((s) => s.objectiveId);
  const launchVehicleId = useGameStore((s) => s.launchVehicleId);
  const orbitId = useGameStore((s) => s.orbitId);
  const saveCurrentBlueprint = useGameStore((s) => s.saveCurrentBlueprint);
  const setSpacecraft = useGameStore((s) => s.setSpacecraft);

  const [category, setCategory] = useState<string>("ALL");
  const [installedIds, setInstalledIds] = useState<string[]>(
    savedSpacecraft.installedIds
  );
  const [showInstalled, setShowInstalled] = useState<boolean>(true);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const planOptions = useMemo(
    () => ({ difficulty, objectiveId, launchVehicleId, orbitId }),
    [difficulty, objectiveId, launchVehicleId, orbitId]
  );

  const planMeta = useMemo(() => resolveMissionPlan(planOptions), [planOptions]);

  const calculation = useMemo(
    () => calculateSpacecraft(installedIds, planOptions),
    [installedIds, planOptions]
  );

  const validation = useMemo(
    () => validateSpacecraft(installedIds, planOptions),
    [installedIds, planOptions]
  );

  const { resources } = calculation;

  const filteredComponents = SPACECRAFT_COMPONENTS.filter(
    (component) => category === "ALL" || component.category === category
  );

  function syncIds(nextIds: string[]) {
    setInstalledIds(nextIds);
    const nextCalc = calculateSpacecraft(nextIds, planOptions);
    const nextVal = validateSpacecraft(nextIds, planOptions);
    setSpacecraft({
      installedIds: nextIds,
      installedComponents: nextCalc.installedComponents,
      resources: nextCalc.resources,
      validation: nextVal,
    });
  }

  function installComponent(component: SpacecraftComponent) {
    const isRepeatable = component.id === "data-storage";
    const alreadyInstalled = installedIds.includes(component.id);

    if (!isRepeatable && alreadyInstalled) return;
    if (resources.creditsRemaining < component.price) return;
    if (resources.massKg + component.massKg > resources.massLimitKg) return;

    syncIds([...installedIds, component.id]);
  }

  function removeComponent(indexToRemove: number) {
    syncIds(installedIds.filter((_, index) => index !== indexToRemove));
  }

  return (
    <main className="builder-screen">
      <header className="builder-header">
        <button className="builder-back" onClick={onBack}>
          <ArrowLeft size={15} />
          BACK
        </button>

        <div className="builder-heading">
          <span>
            {planMeta.difficulty.label} · {planMeta.vehicle.name.toUpperCase()} ·{" "}
            {planMeta.orbit.name.toUpperCase()}
          </span>
          <strong>SPACECRAFT CONFIGURATION</strong>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="builder-back"
            onClick={() => setShowGuide((g) => !g)}
            title="Learn how mass, power, data, and orbit trade-offs affect your mission"
          >
            <BookOpen size={14} />
            {showGuide ? "HIDE GUIDE" : "TRADE-OFF GUIDE"}
          </button>
          <button
            className="builder-back"
            onClick={() => saveCurrentBlueprint(`${planMeta.vehicle.tier} Build`)}
            title="Save this configuration to Mission Archive for sharing & comparison"
          >
            <Save size={14} />
            SAVE DESIGN
          </button>
          <button
            className="builder-back"
            onClick={() => syncIds([...RECOMMENDED_LOADOUT_IDS])}
            title="Load mission-ready nominal spacecraft configuration"
          >
            <Sparkles size={14} />
            AUTO-EQUIP
          </button>
          <button
            className="builder-back"
            onClick={() => syncIds([])}
            title="Clear all installed modules"
          >
            <RotateCcw size={14} />
            CLEAR
          </button>
        </div>

        <div className="builder-credit">
          <span>AVAILABLE CREDITS</span>
          <strong className="tabular-nums">
            {resources.creditsRemaining.toLocaleString()} CR
          </strong>
        </div>

        <button
          className="builder-launch-button builder-launch-button-top"
          title={
            validation.ready
              ? "Proceed to launch sequence"
              : "Systems are weak — launch at your own risk"
          }
          onClick={() =>
            onLaunch({
              installedIds,
              installedComponents: calculation.installedComponents,
              resources,
              validation,
            })
          }
        >
          <Rocket size={16} />
          {validation.ready ? "LAUNCH" : "LAUNCH ANYWAY"}
        </button>
      </header>

      {showGuide && (
        <div className="builder-guide-banner">
          {EDUCATIONAL_CONCEPTS.map((c) => (
            <div key={c.topic} className="builder-guide-item">
              <strong>{c.topic}</strong>
              <p>{c.tradeoff}</p>
            </div>
          ))}
        </div>
      )}

      <div className="builder-layout">
        {/* LEFT CATEGORY NAVIGATION */}
        <section className="builder-shop">
          <div className="builder-section-heading">
            <span>COMPONENTS</span>
          </div>

          <div className="builder-categories builder-category-vertical">
            {[
              "ALL",
              ...new Set(SPACECRAFT_COMPONENTS.map((c) => c.category)),
            ].map((item) => (
              <button
                key={item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {/* 3D SPACECRAFT PREVIEW */}
        <section className="builder-preview">
          <div className="builder-section-heading">
            <span>LIVE SPACECRAFT PREVIEW</span>
            <small>3D MODEL / DRAG TO ROTATE</small>
          </div>

          <div className="builder-canvas">
            <Canvas
              camera={{ position: [0, 0, 8], fov: 42 }}
              dpr={[1, 1.5]}
              gl={{ alpha: true, antialias: true }}
            >
              <ambientLight intensity={1.1} />
              <directionalLight position={[5, 7, 5]} intensity={2.5} />
              <pointLight position={[-4, 1, -3]} intensity={1.5} color="#4daeff" />

              <Stars
                radius={80}
                depth={50}
                count={1600}
                factor={3}
                saturation={0.3}
                fade
                speed={0.5}
              />

              <Suspense fallback={null}>
                <SpacecraftPreview installedIds={installedIds} />
              </Suspense>

              <OrbitControls
                enablePan={false}
                minDistance={3}
                maxDistance={11}
                autoRotate
                autoRotateSpeed={0.45}
              />
            </Canvas>

            <div className="builder-preview-label">
              <span>ASTRION / LUNAR EXPLORER</span>
              <small>{installedIds.length} MODULES INSTALLED</small>
            </div>
          </div>
        </section>

        {/* RIGHT COMPONENT OPTIONS + RESOURCES */}
        <aside className="builder-resources builder-options">
          <div className="builder-section-heading">
            <span>AVAILABLE EQUIPMENT</span>
            <small>{filteredComponents.length} ITEMS</small>
          </div>

          <div className="builder-component-list">
            {filteredComponents.map((component) => {
              const installedCount = installedIds.filter(
                (id) => id === component.id
              ).length;

              const repeatable = component.id === "data-storage";
              const alreadyInstalled = installedCount > 0;
              const affordable = resources.creditsRemaining >= component.price;
              const withinMassLimit =
                resources.massKg + component.massKg <= resources.massLimitKg;

              const canInstall =
                (repeatable || !alreadyInstalled) &&
                affordable &&
                withinMassLimit;

              return (
                <article className="builder-component" key={component.id}>
                  <div className="builder-component-top">
                    <div>
                      <span>{component.category}</span>
                      <strong>{component.name}</strong>
                    </div>
                    <b>{component.price} CR</b>
                  </div>

                  <p>{component.description}</p>

                  <div className="builder-component-stats">
                    <span>{component.massKg} KG</span>
                    <span>
                      {component.powerDrawW > 0
                        ? `${component.powerDrawW} W`
                        : component.powerOutputW > 0
                        ? `+${component.powerOutputW} W`
                        : "—"}
                    </span>
                    {component.sciencePoints > 0 && (
                      <span>{component.sciencePoints} SCI</span>
                    )}
                  </div>

                  <button
                    className="builder-install"
                    disabled={!canInstall}
                    onClick={() => installComponent(component)}
                  >
                    {alreadyInstalled && !repeatable ? (
                      <>
                        <CheckCircle2 size={13} /> INSTALLED
                      </>
                    ) : (
                      <>
                        <Plus size={13} />
                        {!affordable
                          ? "INSUFFICIENT CREDITS"
                          : !withinMassLimit
                          ? "MASS LIMIT REACHED"
                          : repeatable && installedCount > 0
                          ? `ADD UNIT (${installedCount})`
                          : "INSTALL"}
                      </>
                    )}
                  </button>
                </article>
              );
            })}
          </div>

          <div className="builder-resource-divider">MISSION RESOURCES</div>

          <div className="builder-installed">
            <button
              className="builder-installed-toggle"
              onClick={() => setShowInstalled((current) => !current)}
            >
              <span>
                INSTALLED EQUIPMENT ({calculation.installedComponents.length})
              </span>
              <span>{showInstalled ? "−" : "+"}</span>
            </button>

            {showInstalled && (
              <div className="builder-installed-list">
                {calculation.installedComponents.length === 0 ? (
                  <p>No equipment installed</p>
                ) : (
                  calculation.installedComponents.map((component, index) => (
                    <div
                      className="builder-installed-item"
                      key={`${component.id}-${index}`}
                    >
                      <div>
                        <strong>{component.name}</strong>
                        <small>{component.massKg} KG</small>
                      </div>

                      <button
                        className="builder-remove-button"
                        onClick={() => removeComponent(index)}
                        title={`Remove ${component.name}`}
                      >
                        <Trash2 size={14} />
                        REMOVE
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <ResourceMetric
            label="SPACECRAFT MASS"
            value={`${resources.massKg} KG`}
            detail={`LIMIT ${resources.massLimitKg} KG`}
          />

          <ResourceMetric
            label="POWER RESERVE"
            value={`${resources.powerReserveW > 0 ? "+" : ""}${resources.powerReserveW} W`}
            detail={`${resources.powerGenerationW} W GENERATED / ${resources.powerConsumptionW} W USED`}
          />

          <ResourceMetric
            label="SCIENCE VALUE"
            value={`${resources.sciencePoints} PTS`}
            detail={`OBJECTIVE: ${planMeta.objective.name.toUpperCase()} (${Math.round(planMeta.orbit.scienceMultiplier * 100)}% ORBIT)`}
          />

          <ResourceMetric
            label="COMMUNICATION"
            value={`${resources.communicationMbps} Mbps`}
            detail={`REQUIRED ${Math.max(5, planMeta.objective.requiredCommsMin)} Mbps · ${planMeta.orbit.name.toUpperCase()}`}
          />

          <ResourceMetric
            label="DATA STORAGE"
            value={`${resources.dataStorageGb} GB`}
            detail={`${resources.totalMissionDataGb} GB OVER ${planMeta.orbit.missionDays} DAYS`}
          />

          <ResourceMetric
            label="MISSION ENDURANCE"
            value={`${resources.estimatedEnduranceDays.toFixed(1)} DAYS`}
            detail={`TARGET ${planMeta.orbit.missionDays} DAYS`}
          />

          <div className="builder-budget">
            <span>TOTAL MISSION COST (INC. ROCKET & ORBIT)</span>
            <strong>{resources.creditsSpent.toLocaleString()} CR</strong>
            <div className="builder-budget-track">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (resources.creditsSpent / planMeta.difficulty.startingCredits) * 100
                  )}%`,
                }}
              />
            </div>
            <small>
              PROGRAM BUDGET {planMeta.difficulty.startingCredits.toLocaleString()} CR
            </small>
          </div>

          <div
            className={`builder-readiness ${
              validation.ready ? "ready" : "not-ready"
            }`}
          >
            <span>MISSION READINESS</span>
            <strong>{validation.ready ? "SYSTEMS NOMINAL" : "WEAK BUILD (RISK)"}</strong>
          </div>

          <div className="builder-validation">
            {validation.errors.length > 0 && (
              <>
                <span>FLIGHT RISK ADVISORIES</span>
                {validation.errors.slice(0, 4).map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </>
            )}

            {validation.warnings.length > 0 && (
              <>
                <span>WARNINGS</span>
                {validation.warnings.slice(0, 2).map((warning, index) => (
                  <p key={index}>{warning}</p>
                ))}
              </>
            )}

            {validation.ready && validation.warnings.length === 0 && (
              <p>All current mission requirements are satisfied.</p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
