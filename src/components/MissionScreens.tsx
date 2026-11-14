import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Award,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  FastForward,
  FlaskConical,
  Globe2,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Satellite,
  Save,
  Shield,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useState } from "react";
import { calculateDataTransmissionSummary } from "../game/spacecraftCalculations";
import {
  DIFFICULTY_CONFIGS,
  LAUNCH_VEHICLES,
  MISSIONS,
  MISSION_OBJECTIVES,
  ORBIT_PROFILES,
} from "../game/spacecraftData";
import { useGameStore } from "../store/gameStore";
import type { LunarDiscoverable } from "../types/game";
import TouchControls from "./TouchControls";

function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export function SurvivalEssentialsModule({ onBack }: { onBack: () => void }) {
  const survivalKit = useGameStore((s) => s.survivalKit);
  const updateSurvivalKit = useGameStore((s) => s.updateSurvivalKit);

  return (
    <section className="module-panel">
      <div className="module-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={15} /> BACK
        </button>
        <div>
          <span className="eyebrow">EVA & LIFE SUPPORT</span>
          <h2>SURVIVAL ESSENTIALS</h2>
        </div>
      </div>

      <div className="module-grid">
        <div className="module-card">
          <h3>Oxygen Reserve Capacity</h3>
          <p>Calibrates primary and backup EVA suit O₂ tanks for extended lunar surface walks.</p>
          <div className="segmented-row">
            {([1, 2, 3] as const).map((lvl) => (
              <button
                key={lvl}
                className={survivalKit.oxygenReserveLevel === lvl ? "seg-btn active" : "seg-btn"}
                onClick={() => updateSurvivalKit({ oxygenReserveLevel: lvl })}
              >
                {lvl === 1 ? "4 HR" : lvl === 2 ? "8 HR" : "12 HR"}
              </button>
            ))}
          </div>
        </div>

        <div className="module-card">
          <h3>Thermal Micrometeoroid Suit</h3>
          <p>Multi-layer Kapton and aluminized Mylar insulation rated for −173 °C to +127 °C lunar extremes.</p>
          <div className="segmented-row">
            {([1, 2, 3] as const).map((grade) => (
              <button
                key={grade}
                className={survivalKit.thermalSuitGrade === grade ? "seg-btn active" : "seg-btn"}
                onClick={() => updateSurvivalKit({ thermalSuitGrade: grade })}
              >
                GRADE {grade}
              </button>
            ))}
          </div>
        </div>

        <div className="module-card">
          <h3>Low-Gravity RCS Thruster Pack</h3>
          <p>Enables boosted lunar mobility and higher 1/6g terrain traversal leaps during EVA.</p>
          <div className="segmented-row">
            <button
              className={survivalKit.jetpackThrusterBoost ? "seg-btn active" : "seg-btn"}
              onClick={() => updateSurvivalKit({ jetpackThrusterBoost: true })}
            >
              RCS BOOST ENABLED
            </button>
            <button
              className={!survivalKit.jetpackThrusterBoost ? "seg-btn active" : "seg-btn"}
              onClick={() => updateSurvivalKit({ jetpackThrusterBoost: false })}
            >
              STANDARD WALK
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ResearchEquipmentsModule({
  onBack,
  onOpenBuilder,
}: {
  onBack: () => void;
  onOpenBuilder: () => void;
}) {
  const spacecraft = useGameStore((s) => s.spacecraft);
  const scienceComponents = spacecraft.installedComponents.filter(
    (c) =>
      c.category === "SCIENCE" ||
      c.category === "EXPLORATION" ||
      c.category === "LANDING"
  );

  return (
    <section className="module-panel">
      <div className="module-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={15} /> BACK
        </button>
        <div>
          <span className="eyebrow">PAYLOAD & INSTRUMENTS</span>
          <h2>RESEARCH EQUIPMENTS</h2>
        </div>
        <button className="secondary-action" onClick={onOpenBuilder}>
          MODIFY IN BUILDER
        </button>
      </div>

      <div className="module-summary-row">
        <div className="stat-box">
          <span>SCIENCE PAYLOAD</span>
          <strong>{spacecraft.resources.sciencePoints} PTS</strong>
        </div>
        <div className="stat-box">
          <span>DATA STORAGE</span>
          <strong>{spacecraft.resources.dataStorageGb} GB</strong>
        </div>
        <div className="stat-box">
          <span>DOWNLINK RATE</span>
          <strong>{spacecraft.resources.communicationMbps} Mbps</strong>
        </div>
      </div>

      {scienceComponents.length === 0 ? (
        <div className="empty-box">
          No scientific or surface exploration instruments mounted. Open the Spacecraft Builder to equip instruments.
        </div>
      ) : (
        <div className="module-grid">
          {scienceComponents.map((comp, i) => (
            <div className="module-card" key={`${comp.id}-${i}`}>
              <span className="card-kicker">{comp.category}</span>
              <h3>{comp.name}</h3>
              <p>{comp.description}</p>
              <div className="card-meta">
                <span>{comp.massKg} KG</span>
                <span>·</span>
                <span>+{comp.sciencePoints} SCI</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ResearchGalleryModule({ onBack }: { onBack: () => void }) {
  const photos = useGameStore((s) => s.photos);
  const discoverables = useGameStore((s) => s.discoverables);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const collected = discoverables.filter((d) => d.collected);
  const activePhoto = photos.find((p) => p.id === selectedPhotoId) || null;

  return (
    <section className="module-panel">
      <div className="module-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={15} /> BACK
        </button>
        <div>
          <span className="eyebrow">ARCHIVE & IMAGERY</span>
          <h2>LATEST RESEARCH GALLERY</h2>
        </div>
      </div>

      <div className="module-summary-row">
        <div className="stat-box">
          <span>PHOTOGRAPHS CAPTURED</span>
          <strong>{photos.length}</strong>
        </div>
        <div className="stat-box">
          <span>SPECIMENS & RELICS LOGGED</span>
          <strong>
            {collected.length} / {discoverables.length}
          </strong>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="empty-box">
          No photographs captured yet. Land on the Moon or Mars and press [F] during surface EVA to capture real 3D mission photography.
        </div>
      ) : (
        <div className="gallery-grid">
          {photos.map((photo) => (
            <button
              key={photo.id}
              className="gallery-card"
              onClick={() => setSelectedPhotoId(photo.id)}
            >
              <img src={photo.dataUrl} alt={photo.title} />
              <div className="gallery-card-meta">
                <strong>{photo.title}</strong>
                <span>
                  {photo.location} · {photo.timestamp}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {activePhoto && (
        <div className="photo-modal" onClick={() => setSelectedPhotoId(null)}>
          <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <button
              className="photo-modal-close"
              onClick={() => setSelectedPhotoId(null)}
            >
              <X size={18} />
            </button>
            <img src={activePhoto.dataUrl} alt={activePhoto.title} />
            <div className="photo-modal-info">
              <strong>{activePhoto.title}</strong>
              <p>{activePhoto.caption}</p>
              <span>
                {activePhoto.missionName} · {activePhoto.location} ·{" "}
                {activePhoto.timestamp}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function FlightHud() {
  const flightStage = useGameStore((s) => s.flightStage);
  const launchActive = useGameStore((s) => s.launchActive);
  const cameraMode = useGameStore((s) => s.cameraMode);
  const telemetry = useGameStore((s) => s.telemetry);
  const selectedMissionId = useGameStore((s) => s.selectedMissionId);
  const paused = useGameStore((s) => s.paused);
  const muted = useGameStore((s) => s.muted);
  const fastForward = useGameStore((s) => s.fastForward);
  const timedMode = useGameStore((s) => s.timedMode);
  const remainingTimeSec = useGameStore((s) => s.remainingTimeSec);
  const neoFeed = useGameStore((s) => s.neoFeed);
  const neoLoading = useGameStore((s) => s.neoLoading);
  const missionFailed = useGameStore((s) => s.missionFailed);
  const missionFailReason = useGameStore((s) => s.missionFailReason);
  const notificationText = useGameStore((s) => s.notificationText);
  const activeAnomaly = useGameStore((s) => s.activeAnomaly);
  const teamMode = useGameStore((s) => s.teamMode);
  const teamSize = useGameStore((s) => s.teamSize);
  const teamMembers = useGameStore((s) => s.teamMembers);
  const spacecraft = useGameStore((s) => s.spacecraft);

  const igniteEngines = useGameStore((s) => s.igniteEngines);
  const setCameraMode = useGameStore((s) => s.setCameraMode);
  const setFlightStage = useGameStore((s) => s.setFlightStage);
  const togglePause = useGameStore((s) => s.togglePause);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const setFastForward = useGameStore((s) => s.setFastForward);
  const restartMission = useGameStore((s) => s.restartMission);
  const resolveAnomaly = useGameStore((s) => s.resolveAnomaly);
  const setPage = useGameStore((s) => s.setPage);
  const showNotification = useGameStore((s) => s.showNotification);

  const [dockCollapsed, setDockCollapsed] = useState(false);

  const mission =
    MISSIONS.find((m) => m.id === selectedMissionId) || MISSIONS[0];

  const anomalyOwner = activeAnomaly
    ? (teamMode === "team" ? teamMembers.slice(0, teamSize) : teamMembers).find(
        (m) => m.roleId === activeAnomaly.responsibleRole
      ) || teamMembers[0]
    : null;

  const canLand =
    (mission.destination === "Moon" || mission.destination === "Mars") &&
    flightStage === "moon-approach" &&
    telemetry.journeyProgress >= 0.85;

  const canFastForward =
    !activeAnomaly &&
    !paused &&
    !missionFailed &&
    ((flightStage === "space-travel" && telemetry.journeyProgress < 0.32) ||
      (flightStage === "moon-approach" && telemetry.journeyProgress < 0.84) ||
      (flightStage === "earth-return" && telemetry.journeyProgress < 0.96));

  const isReturnStage =
    flightStage === "moon-launch" ||
    flightStage === "earth-return" ||
    flightStage === "earth-reentry";

  return (
    <>
      {/* TOP-LEFT COMPACT TELEMETRY STRIP */}
      <aside className="hud-telemetry">
        <div className="hud-phase-row">
          <span className="eyebrow">FLIGHT TELEMETRY</span>
          <strong className="hud-phase">{telemetry.phaseLabel}</strong>
        </div>

        <div className="hud-metrics-grid">
          <div className="hud-metric">
            <span>ALTITUDE</span>
            <strong className="tabular-nums">
              {telemetry.altitudeKm.toFixed(1)} <small>KM</small>
            </strong>
          </div>
          <div className="hud-metric">
            <span>VELOCITY</span>
            <strong className="tabular-nums">
              {Math.round(telemetry.speedMs).toLocaleString()} <small>M/S</small>
            </strong>
          </div>
          <div className="hud-metric">
            <span>FUEL</span>
            <strong
              className={`tabular-nums ${
                telemetry.fuelPct <= 20 ? "text-amber-400" : ""
              }`}
            >
              {Math.round(telemetry.fuelPct)} <small>%</small>
            </strong>
          </div>
          <div className="hud-metric">
            <span>POWER</span>
            <strong
              className={`tabular-nums ${
                telemetry.powerPct <= 25 ? "text-amber-400" : ""
              }`}
            >
              {Math.round(telemetry.powerPct)} <small>%</small>
            </strong>
          </div>
          <div className="hud-metric">
            <span>HULL</span>
            <strong
              className={`tabular-nums ${
                telemetry.hullPct <= 35 ? "text-amber-400" : ""
              }`}
            >
              {Math.round(telemetry.hullPct)} <small>%</small>
            </strong>
          </div>
          <div className="hud-metric">
            <span>HEADING</span>
            <strong className="tabular-nums">
              {Math.round(telemetry.heading * 30)}°
            </strong>
          </div>
        </div>

        <div className="hud-bars">
          <div className="hud-bar-row">
            <span>
              {isReturnStage
                ? "EARTH RANGE"
                : `${mission.destination.toUpperCase()} RANGE`}
            </span>
            <span className="tabular-nums">
              {(isReturnStage
                ? telemetry.distanceToEarthKm
                : telemetry.distanceToMoonKm
              ).toLocaleString()}{" "}
              KM
            </span>
          </div>
          <div className="hud-progress-track">
            <div
              className="hud-progress-fill"
              style={{ width: `${Math.round(telemetry.journeyProgress * 100)}%` }}
            />
          </div>
        </div>

        {timedMode && (
          <div
            className={`hud-timer-banner ${
              remainingTimeSec <= 20
                ? "critical"
                : remainingTimeSec <= 45
                ? "warn"
                : ""
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} /> MISSION CLOCK
            </span>
            <strong className="tabular-nums">{formatClock(remainingTimeSec)}</strong>
          </div>
        )}

        {flightStage === "asteroids" && (
          <div className="hud-neo-box">
            <div className="hud-alert">
              <Shield size={14} />
              <span>
                ASTEROIDS · DODGED {telemetry.asteroidsAvoided} · HITS{" "}
                {telemetry.asteroidHits} / 2
              </span>
            </div>
            {telemetry.activeNeo && (
              <div className="hud-neo-meta">
                <div className="hud-bar-row">
                  <strong>{telemetry.activeNeo.name}</strong>
                  <span
                    className={
                      telemetry.activeNeo.hazardous
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }
                  >
                    {telemetry.activeNeo.hazardous ? "PHA" : "NOMINAL"}
                  </span>
                </div>
                <div className="hud-neo-stats tabular-nums">
                  <span>Ø {telemetry.activeNeo.diameterM.toLocaleString()} m</span>
                  <span>·</span>
                  <span>{telemetry.activeNeo.velocityKmS} km/s</span>
                  <span>·</span>
                  <span>
                    {(telemetry.activeNeo.missDistanceKm / 1000).toFixed(0)}k km miss
                  </span>
                </div>
                <div className="hud-neo-source">
                  {neoLoading
                    ? "Syncing NASA NeoWs · Simulated encounter path"
                    : neoFeed.source === "nasa-neows"
                    ? "NASA NeoWs Catalog · Simulated encounter path"
                    : "Sample Fallback (Simulated) · Simulated encounter path"}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* NOTIFICATION TOAST */}
      {notificationText && (
        <div className="hud-toast">{notificationText}</div>
      )}

      {/* RESPONSIVE TOUCH CONTROLS (COARSE POINTER DEVICES ONLY) */}
      {!paused && !missionFailed && !activeAnomaly && (
        <TouchControls mode="flight" />
      )}

      {/* COLLAPSIBLE BOTTOM CONTROL DOCK */}
      <div className={`bottom-dock-wrap ${dockCollapsed ? "collapsed" : ""}`}>
        <button
          className="dock-collapse-btn"
          onClick={() => setDockCollapsed((c) => !c)}
        >
          {dockCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {dockCollapsed ? "SHOW CONTROLS" : "HIDE CONTROLS"}
        </button>

        {!dockCollapsed && (
          <div className="bottom-dock">
            <div className="dock-group">
              {(["cockpit", "rear", "front"] as const).map((mode) => (
                <button
                  key={mode}
                  className={cameraMode === mode ? "dock-btn active" : "dock-btn"}
                  onClick={() => setCameraMode(mode)}
                >
                  {mode === "cockpit"
                    ? "COCKPIT"
                    : mode === "rear"
                    ? "REAR VIEW"
                    : "FRONT VIEW"}
                </button>
              ))}
            </div>

            <div className="dock-divider" />

            <div className="dock-group">
              {!launchActive && flightStage === "pad" && (
                <button className="dock-primary" onClick={igniteEngines}>
                  <Rocket size={15} /> IGNITE / LAUNCH
                </button>
              )}

              {canLand && (
                <button
                  className="dock-primary dock-highlight"
                  onClick={() => {
                    setFlightStage("moon-landing");
                    showNotification(
                      mission.destination === "Mars"
                        ? "Powered Mars descent initiated."
                        : "Powered lunar descent initiated."
                    );
                  }}
                >
                  <Compass size={15} /> LAND ON {mission.destination.toUpperCase()} [L]
                </button>
              )}

              <button
                className={fastForward && canFastForward ? "dock-btn active" : "dock-btn"}
                disabled={!canFastForward}
                onClick={() => setFastForward(!fastForward)}
                title={
                  canFastForward
                    ? "Speed up safe deep-space cruise (×3.5)"
                    : "Fast-forward disabled during launch, hazards, anomalies, and landing"
                }
              >
                <FastForward size={14} />
                {fastForward && canFastForward ? "CRUISE ×3.5 ON" : "SKIP TRANSIT"}
              </button>

              <button
                className="dock-icon-btn"
                onClick={toggleMute}
                title={muted ? "Unmute Audio" : "Mute Audio"}
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>

              <button
                className="dock-icon-btn"
                onClick={togglePause}
                title="Pause Simulation (Esc)"
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
              </button>

              <button
                className="dock-icon-btn"
                onClick={() => restartMission("flight")}
                title="Restart Flight"
              >
                <RotateCcw size={15} />
              </button>
            </div>

            <div className="dock-hint">
              A/D Steer · W/S Pitch · Shift Boost · C Camera
            </div>
          </div>
        )}
      </div>

      {/* INTERACTIVE MISSION ANOMALY DECISION MODAL */}
      {activeAnomaly && !missionFailed && (
        <div className="modal-backdrop">
          <div className="tactical-modal anomaly-modal">
            <span className="eyebrow text-amber-400">
              <AlertTriangle size={12} className="inline mr-1" />
              IN-FLIGHT ENGINEERING ANOMALY
            </span>
            <h2>{activeAnomaly.title}</h2>
            {anomalyOwner && (
              <div className="anomaly-role-tag">
                <Users size={13} />
                <span>
                  LEAD ROLE: {anomalyOwner.roleTitle.toUpperCase()} ·{" "}
                  {teamMode === "team" ? anomalyOwner.playerName : "COMMANDER"}
                </span>
              </div>
            )}
            <p className="modal-copy">{activeAnomaly.description}</p>
            <div className="plan-tradeoff mb-4">
              <strong>Systems Trade-Off:</strong> {activeAnomaly.educationalNote}
            </div>
            <div className="anomaly-options">
              {activeAnomaly.options.map((opt) => {
                const missingComp = Boolean(
                  opt.requiresComponentId &&
                    !spacecraft.installedIds.includes(opt.requiresComponentId)
                );
                return (
                  <button
                    key={opt.id}
                    className="anomaly-option-btn"
                    disabled={missingComp}
                    onClick={() => resolveAnomaly(opt)}
                  >
                    <strong>
                      {opt.label}{" "}
                      {missingComp ? "[Requires High-Gain Antenna]" : ""}
                    </strong>
                    <span>{opt.effectSummary}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PAUSE OVERLAY */}
      {paused && !missionFailed && !activeAnomaly && (
        <div className="modal-backdrop">
          <div className="tactical-modal">
            <span className="eyebrow">SIMULATION PAUSED</span>
            <h2>{mission.name.toUpperCase()}</h2>
            <div className="tactical-modal-actions">
              <button className="primary-button" onClick={togglePause}>
                <Play size={16} /> RESUME FLIGHT
              </button>
              <button
                className="secondary-action"
                onClick={() => restartMission("flight")}
              >
                <RotateCcw size={15} /> RESTART MISSION
              </button>
              <button
                className="secondary-action"
                onClick={() => {
                  restartMission("briefing");
                  setPage("briefing");
                }}
              >
                EXIT TO BRIEFING
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISSION FAILURE OVERLAY */}
      {missionFailed && (
        <div className="modal-backdrop">
          <div className="tactical-modal">
            <span className="eyebrow text-rose-400">CRITICAL FAILURE</span>
            <h2>SPACECRAFT LOST</h2>
            <p className="modal-copy">{missionFailReason}</p>
            <div className="tactical-modal-actions">
              <button
                className="primary-button"
                onClick={() => restartMission("flight")}
              >
                <RotateCcw size={16} /> RELAUNCH MISSION
              </button>
              <button
                className="secondary-action"
                onClick={() => {
                  restartMission("module");
                  setPage("module");
                }}
              >
                RECONFIGURE SPACECRAFT
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function LunarHud({
  proximity,
}: {
  proximity: {
    nearestItem: LunarDiscoverable | null;
    nearestDistance: number;
    nearLander: boolean;
    landerDistance: number;
  };
}) {
  const selectedMissionId = useGameStore((s) => s.selectedMissionId);
  const discoverables = useGameStore((s) => s.discoverables);
  const photos = useGameStore((s) => s.photos);
  const scienceScore = useGameStore((s) => s.scienceScore);
  const lunarCameraMode = useGameStore((s) => s.lunarCameraMode);
  const paused = useGameStore((s) => s.paused);
  const muted = useGameStore((s) => s.muted);
  const timedMode = useGameStore((s) => s.timedMode);
  const remainingTimeSec = useGameStore((s) => s.remainingTimeSec);
  const missionFailed = useGameStore((s) => s.missionFailed);
  const missionFailReason = useGameStore((s) => s.missionFailReason);
  const notificationText = useGameStore((s) => s.notificationText);

  const setLunarCameraMode = useGameStore((s) => s.setLunarCameraMode);
  const togglePause = useGameStore((s) => s.togglePause);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const restartMission = useGameStore((s) => s.restartMission);
  const setPage = useGameStore((s) => s.setPage);

  const [showChecklist, setShowChecklist] = useState(false);

  const mission =
    MISSIONS.find((m) => m.id === selectedMissionId) || MISSIONS[0];
  const isMars = mission.destination === "Mars";

  const samplesCollected = discoverables.filter(
    (d) => d.kind === "sample" && d.collected
  ).length;
  const relicsCollected = discoverables.filter(
    (d) => d.kind === "relic" && d.collected
  ).length;

  const canCollectNearest =
    proximity.nearestItem &&
    !proximity.nearestItem.collected &&
    proximity.nearestDistance < 4.8;

  return (
    <>
      <aside className="hud-telemetry">
        <div className="hud-phase-row">
          <span className="eyebrow">
            {isMars ? "MARS SURFACE EVA" : "LUNAR SURFACE EVA"}
          </span>
          <strong className="hud-phase">EXPLORATION</strong>
        </div>

        <div className="hud-metrics-grid">
          <div className="hud-metric">
            <span>SAMPLES</span>
            <strong className="tabular-nums">{samplesCollected} / 3</strong>
          </div>
          <div className="hud-metric">
            <span>RELICS</span>
            <strong className="tabular-nums">{relicsCollected} / 3</strong>
          </div>
          <div className="hud-metric">
            <span>PHOTOS</span>
            <strong className="tabular-nums">{photos.length}</strong>
          </div>
          <div className="hud-metric">
            <span>SCIENCE</span>
            <strong className="tabular-nums">{scienceScore}</strong>
          </div>
        </div>

        {timedMode && (
          <div
            className={`hud-timer-banner ${
              remainingTimeSec <= 20
                ? "critical"
                : remainingTimeSec <= 45
                ? "warn"
                : ""
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} /> RETURN CLOCK
            </span>
            <strong className="tabular-nums">{formatClock(remainingTimeSec)}</strong>
          </div>
        )}

        <div className="hud-bars">
          <div className="hud-bar-row">
            <span>
              {proximity.nearestItem
                ? `TARGET: ${proximity.nearestItem.title.toUpperCase()}`
                : "ALL TARGETS LOGGED"}
            </span>
            <span className="tabular-nums">
              {proximity.nearestItem && Number.isFinite(proximity.nearestDistance)
                ? `${proximity.nearestDistance.toFixed(1)} M`
                : "—"}
            </span>
          </div>
          <div className="hud-bar-row">
            <span>{isMars ? "MARS LANDER" : "LUNAR LANDER"}</span>
            <span className="tabular-nums">
              {proximity.landerDistance.toFixed(1)} M
            </span>
          </div>
        </div>

        <button
          className="dock-btn w-full justify-between"
          onClick={() => setShowChecklist((v) => !v)}
        >
          <span>SURFACE SURVEY LOG</span>
          {showChecklist ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {showChecklist && (
          <div className="eva-checklist">
            {discoverables.map((d) => (
              <div key={d.id} className="eva-check-item">
                <span>
                  {d.collected ? "✓" : "○"} {d.title}
                </span>
                <small>{d.kind.toUpperCase()}</small>
              </div>
            ))}
          </div>
        )}
      </aside>

      {notificationText && <div className="hud-toast">{notificationText}</div>}

      {!paused && !missionFailed && <TouchControls mode="lunar" />}

      {/* BOTTOM EVA DOCK */}
      <div className="bottom-dock-wrap">
        <div className="bottom-dock">
          <div className="dock-group">
            {canCollectNearest && (
              <button
                className="dock-primary dock-highlight"
                onClick={() => window.dispatchEvent(new CustomEvent("astrion:collect"))}
              >
                <FlaskConical size={15} />
                {proximity.nearestItem?.kind === "sample"
                  ? "COLLECT SAMPLE [E]"
                  : "INSPECT RELIC [E]"}
              </button>
            )}

            <button
              className="dock-btn"
              onClick={() => window.dispatchEvent(new CustomEvent("astrion:photo"))}
            >
              <Camera size={14} /> TAKE PHOTO [F]
            </button>

            <button
              className="dock-btn"
              onClick={() =>
                setLunarCameraMode(
                  lunarCameraMode === "third-person" ? "visor" : "third-person"
                )
              }
            >
              {lunarCameraMode === "third-person"
                ? "VISOR VIEW [V]"
                : "3RD PERSON [V]"}
            </button>

            {proximity.nearLander ? (
              <button
                className="dock-primary"
                onClick={() => window.dispatchEvent(new CustomEvent("astrion:board"))}
              >
                <Rocket size={15} /> BOARD & RETURN TO EARTH [R]
              </button>
            ) : (
              <span className="dock-hint">
                Lander {proximity.landerDistance.toFixed(0)}m away
              </span>
            )}
          </div>

          <div className="dock-divider" />

          <div className="dock-group">
            <button className="dock-icon-btn" onClick={toggleMute}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button className="dock-icon-btn" onClick={togglePause}>
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>

          <div className="dock-hint">
            WASD Move · Drag Orbit · Space Hop · E Collect · F Photo
          </div>
        </div>
      </div>

      {paused && !missionFailed && (
        <div className="modal-backdrop">
          <div className="tactical-modal">
            <span className="eyebrow">EVA PAUSED</span>
            <h2>
              {isMars ? "MARS SURFACE OPERATIONS" : "LUNAR SURFACE OPERATIONS"}
            </h2>
            <div className="tactical-modal-actions">
              <button className="primary-button" onClick={togglePause}>
                <Play size={16} /> RESUME EVA
              </button>
              <button
                className="secondary-action"
                onClick={() => restartMission("flight")}
              >
                <RotateCcw size={15} /> RESTART EXPEDITION
              </button>
            </div>
          </div>
        </div>
      )}

      {missionFailed && (
        <div className="modal-backdrop">
          <div className="tactical-modal">
            <span className="eyebrow text-rose-400">CRITICAL FAILURE</span>
            <h2>EXPEDITION TERMINATED</h2>
            <p className="modal-copy">{missionFailReason}</p>
            <div className="tactical-modal-actions">
              <button
                className="primary-button"
                onClick={() => restartMission("flight")}
              >
                <RotateCcw size={16} /> RELAUNCH MISSION
              </button>
              <button
                className="secondary-action"
                onClick={() => {
                  restartMission("module");
                  setPage("module");
                }}
              >
                RECONFIGURE SPACECRAFT
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MissionCompleteScreen() {
  const selectedMissionId = useGameStore((s) => s.selectedMissionId);
  const difficulty = useGameStore((s) => s.difficulty);
  const objectiveId = useGameStore((s) => s.objectiveId);
  const launchVehicleId = useGameStore((s) => s.launchVehicleId);
  const orbitId = useGameStore((s) => s.orbitId);
  const teamMode = useGameStore((s) => s.teamMode);
  const teamSize = useGameStore((s) => s.teamSize);
  const teamMembers = useGameStore((s) => s.teamMembers);
  const spacecraft = useGameStore((s) => s.spacecraft);
  const scienceScore = useGameStore((s) => s.scienceScore);
  const telemetry = useGameStore((s) => s.telemetry);
  const discoverables = useGameStore((s) => s.discoverables);
  const photos = useGameStore((s) => s.photos);
  const achievements = useGameStore((s) => s.achievements);
  const missionElapsedSec = useGameStore((s) => s.missionElapsedSec);
  const timedMode = useGameStore((s) => s.timedMode);
  const remainingTimeSec = useGameStore((s) => s.remainingTimeSec);
  const lastCompletedRecord = useGameStore((s) => s.lastCompletedRecord);
  const restartMission = useGameStore((s) => s.restartMission);
  const saveCurrentBlueprint = useGameStore((s) => s.saveCurrentBlueprint);
  const setSelectedModule = useGameStore((s) => s.setSelectedModule);
  const setPage = useGameStore((s) => s.setPage);

  const [savedNotice, setSavedNotice] = useState(false);

  const mission =
    MISSIONS.find((m) => m.id === selectedMissionId) || MISSIONS[0];
  const vehicle =
    LAUNCH_VEHICLES.find((v) => v.id === launchVehicleId) || LAUNCH_VEHICLES[1];
  const orbit =
    ORBIT_PROFILES.find((o) => o.id === orbitId) || ORBIT_PROFILES[0];
  const diffCfg = DIFFICULTY_CONFIGS[difficulty];
  const objCfg = MISSION_OBJECTIVES[objectiveId];

  const collectedCount = discoverables.filter((d) => d.collected).length;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const dataSummary =
    lastCompletedRecord?.dataTransmission ||
    calculateDataTransmissionSummary(
      spacecraft.resources,
      orbitId,
      objectiveId,
      scienceScore,
      { samplesCollected: collectedCount, photosCount: photos.length }
    );

  const fallbackTotalScore = Math.round(
    (dataSummary.effectiveScienceScore +
      collectedCount * 75 +
      photos.length * 40 +
      Math.round(telemetry.hullPct * 4) +
      Math.round(telemetry.fuelPct * 3) +
      Math.round(telemetry.powerPct * 2) +
      (teamMode === "team" &&
      teamMembers.slice(0, teamSize).every((m) => m.approved)
        ? 120
        : 0)) *
      diffCfg.scoreMultiplier
  );

  const totalScore = lastCompletedRecord?.totalScore ?? fallbackTotalScore;

  const grade =
    lastCompletedRecord?.grade ||
    (totalScore >= 2100 && telemetry.hullPct >= 75
      ? "S"
      : totalScore >= 1650
      ? "A"
      : totalScore >= 1200
      ? "B"
      : totalScore < 850
      ? "D"
      : "C");

  const mins = Math.floor(missionElapsedSec / 60);
  const secs = Math.floor(missionElapsedSec % 60);

  const instrumentDataGb =
    dataSummary.instrumentDataGb ?? Math.max(0, Math.round(spacecraft.resources.totalMissionDataGb));
  const sampleDataGb = dataSummary.sampleDataGb ?? collectedCount;
  const photoDataGb = dataSummary.photoDataGb ?? photos.length * 2;

  const insights: string[] = [
    `Launch & Mass Balance: ${vehicle.name} carried ${spacecraft.resources.massKg}/${spacecraft.resources.massLimitKg} KG (${Math.round((spacecraft.resources.massKg / Math.max(1, spacecraft.resources.massLimitKg)) * 100)}% capacity) and ended with ${Math.round(telemetry.fuelPct)}% propellant reserve.`,
    `Orbit & Data Downlink: ${orbit.name} (${orbit.missionDays} days) generated ${dataSummary.generatedDataGb} GB (${instrumentDataGb} GB instruments, ${sampleDataGb} GB ${collectedCount} specimens, ${photoDataGb} GB ${photos.length} photos); ${dataSummary.transmittedDataGb} GB transmitted (${dataSummary.transmissionEfficiencyPct}% efficiency${dataSummary.lostDataGb > 0 ? `, ${dataSummary.lostDataGb} GB lost to storage/downlink bottleneck` : ""}).`,
    `Power & Comms Margin: ${spacecraft.resources.powerReserveW >= 0 ? `+${spacecraft.resources.powerReserveW} W` : `${spacecraft.resources.powerReserveW} W`} net power and ${spacecraft.resources.communicationMbps} Mbps downlink (${Math.round(telemetry.powerPct)}% charge at splashdown).`,
  ];

  return (
    <section className="complete-panel">
      <div className="complete-head">
        <div>
          <span className="eyebrow">
            EXPEDITION COMPLETE · {diffCfg.label} · {objCfg.name.toUpperCase()}
            {timedMode ? ` · TIMED (${formatClock(remainingTimeSec)} LEFT)` : ""}
          </span>
          <h1>{mission.name.toUpperCase()}</h1>
        </div>
        <div className="complete-score-group">
          <div className="grade-badge">
            <span>GRADE</span>
            <strong>{grade}</strong>
          </div>
          <div className="complete-score">
            <span>TOTAL MISSION SCORE</span>
            <strong className="tabular-nums">{totalScore.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <div className="module-summary-row">
        <div className="stat-box">
          <span>MISSION TIME</span>
          <strong className="tabular-nums">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </strong>
        </div>
        <div className="stat-box">
          <span>RESULTING SCIENCE</span>
          <strong className="tabular-nums">{dataSummary.effectiveScienceScore}</strong>
        </div>
        <div className="stat-box">
          <span>SAMPLES & RELICS</span>
          <strong className="tabular-nums">
            {collectedCount} / {discoverables.length}
          </strong>
        </div>
        <div className="stat-box">
          <span>PHOTOGRAPHS</span>
          <strong className="tabular-nums">{photos.length}</strong>
        </div>
        <div className="stat-box">
          <span>HULL / FUEL</span>
          <strong className="tabular-nums">
            {Math.round(telemetry.hullPct)}% / {Math.round(telemetry.fuelPct)}%
          </strong>
        </div>
        <div className="stat-box">
          <span>CREW MODE</span>
          <strong>
            {teamMode === "team"
              ? `${teamSize}-PLAYER (${teamMembers
                  .slice(0, teamSize)
                  .map((m) => m.playerName.split(" ")[0])
                  .join(", ")})`
              : "SOLO COMMANDER"}
          </strong>
        </div>
      </div>

      {/* STAGE 2: DATA STORAGE & EARTH TRANSMISSION DEBRIEF */}
      <div className="debrief-insights">
        <h3>DATA TRANSMISSION & STORAGE TELEMETRY BREAKDOWN</h3>
        <div className="module-summary-row mb-0 mt-2">
          <div className="stat-box">
            <span>GENERATED SCIENCE DATA</span>
            <strong className="tabular-nums">{dataSummary.generatedDataGb} GB</strong>
            <small className="tabular-nums opacity-75">
              {instrumentDataGb} Inst · {sampleDataGb} Samp · {photoDataGb} Photo
            </small>
          </div>
          <div className="stat-box">
            <span>STORAGE CAPACITY</span>
            <strong className="tabular-nums">{dataSummary.storageCapacityGb} GB</strong>
          </div>
          <div className="stat-box">
            <span>DOWNLINK CAPACITY</span>
            <strong className="tabular-nums">{dataSummary.downlinkCapacityGb} GB</strong>
          </div>
          <div className="stat-box">
            <span>DATA TRANSMITTED</span>
            <strong className="tabular-nums text-emerald-400">
              {dataSummary.transmittedDataGb} GB ({dataSummary.transmissionEfficiencyPct}%)
            </strong>
          </div>
          <div className="stat-box">
            <span>DATA LOST</span>
            <strong
              className={`tabular-nums ${
                dataSummary.lostDataGb > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {dataSummary.lostDataGb} GB
            </strong>
          </div>
          <div className="stat-box">
            <span>EFFECTIVE SCIENCE SCORE</span>
            <strong className="tabular-nums">
              {dataSummary.effectiveScienceScore} PTS
            </strong>
          </div>
        </div>
      </div>

      <div className="debrief-insights">
        <h3>ENGINEERING OUTCOME & TRADE-OFF ANALYSIS</h3>
        <ul>
          {insights.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="complete-columns">
        <div className="complete-col">
          <h3>
            <Award size={16} /> ACHIEVEMENTS ({unlockedCount}/{achievements.length})
          </h3>
          <div className="achievement-list">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={a.unlocked ? "achievement-item unlocked" : "achievement-item"}
              >
                <CheckCircle2 size={15} />
                <div>
                  <strong>{a.title}</strong>
                  <span>{a.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="complete-col">
          <h3>
            <Camera size={16} /> CAPTURED IMAGERY ({photos.length})
          </h3>
          {photos.length === 0 ? (
            <div className="empty-box">No surface photographs recorded during this sortie.</div>
          ) : (
            <div className="complete-photos">
              {photos.slice(0, 4).map((p) => (
                <div key={p.id} className="complete-photo-thumb">
                  <img src={p.dataUrl} alt={p.title} />
                  <span>{p.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="complete-actions">
        <button
          className="primary-button"
          onClick={() => restartMission("missions")}
        >
          <Globe2 size={16} /> NEW EXPEDITION <ChevronRight size={16} />
        </button>
        <button
          className="secondary-action"
          onClick={() => {
            saveCurrentBlueprint(`${mission.destination} Grade ${grade}`);
            setSavedNotice(true);
          }}
        >
          <Save size={15} /> {savedNotice ? "BLUEPRINT SAVED" : "SAVE THIS BLUEPRINT"}
        </button>
        <button
          className="secondary-action"
          onClick={() => {
            restartMission("module");
            setSelectedModule("MISSION ARCHIVE & COMPARE");
            setPage("module");
          }}
        >
          <ArrowLeftRight size={15} /> ARCHIVE & COMPARE
        </button>
        <button
          className="secondary-action"
          onClick={() => {
            restartMission("home");
            setPage("home");
          }}
        >
          <Satellite size={15} /> RETURN TO ORBITAL COMMAND
        </button>
      </div>
    </section>
  );
}
