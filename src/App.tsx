import {
  ArrowLeft,
  Award,
  BookOpen,
  ChevronRight,
  Clock,
  Database,
  Globe2,
  Rocket,
  Satellite,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { soundEngine } from "./audio/soundEngine";
import { JudgeDemoFlowModal, NasaSourcesModal } from "./components/HomeInfoModals";
import MissionArchiveModule from "./components/MissionArchiveModule";
import MissionPlanningModule from "./components/MissionPlanningModule";
import {
  FlightHud,
  LunarHud,
  MissionCompleteScreen,
  ResearchEquipmentsModule,
  ResearchGalleryModule,
  SurvivalEssentialsModule,
} from "./components/MissionScreens";
import SpacecraftBuilder from "./game/SpacecraftBuilder";
import {
  DIFFICULTY_CONFIGS,
  LAUNCH_VEHICLES,
  MISSIONS,
  ORBIT_PROFILES,
} from "./game/spacecraftData";
import FlightScene from "./scenes/FlightScene";
import HomeSpaceScene from "./scenes/HomeSpaceScene";
import LunarSurfaceScene from "./scenes/LunarSurfaceScene";
import { getDefaultTimeLimitForMission, useGameStore } from "./store/gameStore";
import type { LunarDiscoverable, PrepareModule } from "./types/game";

export default function App() {
  const page = useGameStore((s) => s.page);
  const selectedModule = useGameStore((s) => s.selectedModule);
  const selectedMissionId = useGameStore((s) => s.selectedMissionId);
  const difficulty = useGameStore((s) => s.difficulty);
  const launchVehicleId = useGameStore((s) => s.launchVehicleId);
  const orbitId = useGameStore((s) => s.orbitId);
  const teamMode = useGameStore((s) => s.teamMode);
  const teamSize = useGameStore((s) => s.teamSize);
  const timedMode = useGameStore((s) => s.timedMode);
  const timeLimitSec = useGameStore((s) => s.timeLimitSec);
  const spacecraft = useGameStore((s) => s.spacecraft);
  const countdown = useGameStore((s) => s.countdown);
  const launchStarted = useGameStore((s) => s.launchStarted);
  const muted = useGameStore((s) => s.muted);

  const setPage = useGameStore((s) => s.setPage);
  const setSelectedModule = useGameStore((s) => s.setSelectedModule);
  const selectMission = useGameStore((s) => s.selectMission);
  const setSpacecraft = useGameStore((s) => s.setSpacecraft);
  const setCountdown = useGameStore((s) => s.setCountdown);
  const setLaunchStarted = useGameStore((s) => s.setLaunchStarted);
  const setTimedMode = useGameStore((s) => s.setTimedMode);
  const igniteEngines = useGameStore((s) => s.igniteEngines);
  const restartMission = useGameStore((s) => s.restartMission);
  const togglePause = useGameStore((s) => s.togglePause);
  const loadNeoFeed = useGameStore((s) => s.loadNeoFeed);

  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [archiveReturnPage, setArchiveReturnPage] = useState<"home" | "prepare">("prepare");

  const [lunarProximity, setLunarProximity] = useState<{
    nearestItem: LunarDiscoverable | null;
    nearestDistance: number;
    nearLander: boolean;
    landerDistance: number;
  }>({
    nearestItem: null,
    nearestDistance: Infinity,
    nearLander: true,
    landerDistance: 4.5,
  });

  const activeMission =
    MISSIONS.find((m) => m.id === selectedMissionId) || MISSIONS[0];
  const activeVehicle =
    LAUNCH_VEHICLES.find((v) => v.id === launchVehicleId) || LAUNCH_VEHICLES[1];
  const activeOrbit =
    ORBIT_PROFILES.find((o) => o.id === orbitId) || ORBIT_PROFILES[0];
  const activeDifficulty = DIFFICULTY_CONFIGS[difficulty];
  const defaultLimit = getDefaultTimeLimitForMission(selectedMissionId);

  // Preload NASA NeoWs asteroid catalog once at startup
  useEffect(() => {
    void loadNeoFeed();
  }, [loadNeoFeed]);

  // Global Escape pause shortcut during active 3D gameplay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape" && (page === "flight" || page === "lunar")) {
        togglePause();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page, togglePause]);

  // Countdown timer -> launches directly into FlightScene and ignites engines
  useEffect(() => {
    if (!launchStarted || page !== "launch") return;

    if (countdown <= 0) {
      soundEngine.playCountdownBeep(true, muted);
      setLaunchStarted(false);
      restartMission("flight");
      igniteEngines();
      return;
    }

    soundEngine.playCountdownBeep(false, muted);
    const timer = window.setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [
    launchStarted,
    page,
    countdown,
    muted,
    setLaunchStarted,
    restartMission,
    igniteEngines,
    setCountdown,
  ]);

  const isMenuScreen = page !== "flight" && page !== "lunar";

  return (
    <main className={`game-shell ${!isMenuScreen ? "gameplay-mode" : ""}`}>
      {/* 3D VIEWPORT */}
      <div className="space-background">
        {page === "flight" ? (
          <FlightScene />
        ) : page === "lunar" ? (
          <LunarSurfaceScene onProximityChange={setLunarProximity} />
        ) : (
          <HomeSpaceScene />
        )}
      </div>

      {/* TOP NAVIGATION */}
      <header className="top-nav">
        <button
          className="brand"
          onClick={() => {
            soundEngine.setEngineThrust(false, 0, true);
            setPage("home");
          }}
          aria-label="Return to ASTRION home"
          title="Home"
        >
          <img src="/astrion-logo.png" alt="ASTRION" className="brand-logo" />

          <span
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    lineHeight: 1.1,
  }}
>
  <strong>ASTRION</strong>
  <small
    style={{
      fontSize: "9px",
      fontWeight: 400,
      letterSpacing: "2px",
      opacity: 0.7,
      marginTop: "4px",
      whiteSpace: "nowrap",
    }}
  >
    by zenith horizon
  </small>
</span>
        </button>

        <div className="top-nav-right">
          {page !== "home" && page !== "flight" && page !== "lunar" && (
            <span className="top-nav-mission">
              {activeMission.name.toUpperCase()} · {activeMission.destination.toUpperCase()}
            </span>
          )}
        </div>
      </header>

      {/* HOME */}
      {page === "home" && (
        <section className="home-content">
          <div className="home-copy">
            <h1>
              BEYOND
              <br />
              <span>EARTH.</span>
            </h1>
            <p>YOUR NEXT FRONTIER AWAITS.</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="primary-button" onClick={() => setPage("missions")}>
                <Rocket size={17} /> NEW EXPEDITION <ChevronRight size={18} />
              </button>
              <button
                className="secondary-action"
                onClick={() => {
                  setArchiveReturnPage("home");
                  setSelectedModule("MISSION ARCHIVE & COMPARE");
                  setPage("module");
                }}
              >
                <Award size={15} /> ARCHIVE & LEADERBOARD
              </button>
            </div>
            <div className="home-utility-row">
              <button
                className="utility-link-btn"
                onClick={() => setShowDemoModal(true)}
              >
                <BookOpen size={13} /> HOW TO PLAY
              </button>
              <button
                className="utility-link-btn"
                onClick={() => setShowSourcesModal(true)}
              >
                <Database size={13} /> DATA & SOURCES
              </button>
            </div>
            <div className="home-meta">
              <span>
                <Globe2 size={14} /> SOL SYSTEM
              </span>
              <span>
                <Satellite size={14} /> FLIGHT SYSTEMS READY
              </span>
            </div>
          </div>
        </section>
      )}

      {/* MISSIONS SELECTION — TWO OPTIONS ONLY: EXPLORE MOON & EXPLORE MARS */}
      {page === "missions" && (
        <section className="expedition-panel wide-panel">
          <button className="back-button" onClick={() => setPage("home")}>
            <ArrowLeft size={15} /> BACK
          </button>

          <div className="eyebrow">SELECT EXPEDITION</div>

          <div className="mission-cards">
            {MISSIONS.slice(0, 2).map((m) => (
              <button
                key={m.id}
                className={
                  selectedMissionId === m.id
                    ? "mission-card active"
                    : "mission-card"
                }
                onClick={() => {
                  selectMission(m.id);
                  setPage("prepare");
                }}
              >
                <div className="mission-card-top">
                  <strong>{m.name.toUpperCase()}</strong>
                  <span>{m.hazardLevel}</span>
                </div>
                <p>{m.description}</p>
                <div className="mission-card-foot">
                  <span>{m.distanceKm.toLocaleString()} KM</span>
                  <span>·</span>
                  <span>{m.subtitle}</span>
                  <ChevronRight size={16} />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* PREPARE EXPEDITION */}
      {page === "prepare" && (
        <section className="expedition-panel">
          <button className="back-button" onClick={() => setPage("missions")}>
            <ArrowLeft size={15} /> BACK
          </button>

          <div className="eyebrow">
            {activeMission.name.toUpperCase()} · {activeDifficulty.label} ·{" "}
            {teamMode === "team" ? `${teamSize}-PLAYER CREW` : "SOLO"}
          </div>

          <div className="expedition-actions">
            {(
              [
                "LAUNCH, ORBIT & TEAM",
                "BUILD YOUR SPACESHIP",
                "SURVIVAL ESSENTIALS",
                "RESEARCH EQUIPMENTS",
                "LATEST RESEARCH GALLERY",
                "MISSION ARCHIVE & COMPARE",
              ] as PrepareModule[]
            ).map((item) => (
              <button
                key={item}
                className="primary-button expedition-button"
                onClick={() => {
                  if (item === "MISSION ARCHIVE & COMPARE") {
                    setArchiveReturnPage("prepare");
                  }
                  setSelectedModule(item);
                  setPage("module");
                }}
              >
                {item} <ChevronRight size={18} />
              </button>
            ))}

            <button
              className="primary-button launch-ready-button"
              onClick={() => {
                setCountdown(5);
                setLaunchStarted(false);
                setPage("briefing");
              }}
            >
              <Sparkles size={16} /> PROCEED TO BRIEFING <ChevronRight size={18} />
            </button>
          </div>
        </section>
      )}

      {/* PREPARE SUB-MODULES */}
      {page === "module" &&
        (selectedModule === "LAUNCH, ORBIT & TEAM" ? (
          <MissionPlanningModule
            onBack={() => setPage("prepare")}
            onOpenBuilder={() => setSelectedModule("BUILD YOUR SPACESHIP")}
          />
        ) : selectedModule === "BUILD YOUR SPACESHIP" ? (
          <SpacecraftBuilder
            onBack={() => setPage("prepare")}
            onLaunch={(spacecraftData) => {
              setSpacecraft(spacecraftData);
              setCountdown(5);
              setLaunchStarted(false);
              setPage("launch");
            }}
          />
        ) : selectedModule === "SURVIVAL ESSENTIALS" ? (
          <SurvivalEssentialsModule onBack={() => setPage("prepare")} />
        ) : selectedModule === "RESEARCH EQUIPMENTS" ? (
          <ResearchEquipmentsModule
            onBack={() => setPage("prepare")}
            onOpenBuilder={() => setSelectedModule("BUILD YOUR SPACESHIP")}
          />
        ) : selectedModule === "MISSION ARCHIVE & COMPARE" ? (
          <MissionArchiveModule
            onBack={() => setPage(archiveReturnPage)}
            onOpenBuilder={() => setSelectedModule("BUILD YOUR SPACESHIP")}
          />
        ) : (
          <ResearchGalleryModule onBack={() => setPage("prepare")} />
        ))}

      {/* BRIEFING */}
      {page === "briefing" && (
        <section className="selection-panel">
          <button className="back-button" onClick={() => setPage("prepare")}>
            <ArrowLeft size={16} /> BACK
          </button>

          <div className="eyebrow">EXPEDITION BRIEFING</div>
          <h2>{activeMission.name.toUpperCase()}</h2>
          <p className="briefing-desc">{activeMission.description}</p>

          <div className="briefing-stats">
            <div>
              <span>DESTINATION</span>
              <strong>{activeMission.destination.toUpperCase()}</strong>
            </div>
            <div>
              <span>LAUNCH VEHICLE</span>
              <strong>{activeVehicle.name.toUpperCase()}</strong>
            </div>
            <div>
              <span>ORBIT PROFILE</span>
              <strong>{activeOrbit.name.toUpperCase()}</strong>
            </div>
            <div>
              <span>DIFFICULTY</span>
              <strong>{activeDifficulty.label}</strong>
            </div>
            <div>
              <span>COMMAND MODE</span>
              <strong>
                {teamMode === "team" ? `${teamSize}-PLAYER CREW` : "SOLO"}
              </strong>
            </div>
            <div>
              <span>SPACECRAFT</span>
              <strong className={spacecraft.validation.ready ? "ready-text" : "text-amber-400"}>
                {spacecraft.validation.ready ? "FLIGHT READY" : "WEAK BUILD (RISK)"}
              </strong>
            </div>
          </div>

          <div className="briefing-timed-row">
            <span className="inline-flex items-center gap-2 text-xs text-sky-200">
              <Clock size={14} />
              LIMITED-TIME SAMPLE RETURN
            </span>
            <div className="segmented-row">
              <button
                type="button"
                className={!timedMode ? "seg-btn active" : "seg-btn"}
                onClick={() => setTimedMode(false)}
              >
                UNLIMITED
              </button>
              <button
                type="button"
                className={timedMode ? "seg-btn active" : "seg-btn"}
                onClick={() => setTimedMode(true, defaultLimit)}
              >
                TIMED ({Math.floor(timeLimitSec / 60)}:
                {String(timeLimitSec % 60).padStart(2, "0")})
              </button>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={() => {
              setCountdown(5);
              setLaunchStarted(false);
              setPage("launch");
            }}
          >
            <Rocket size={17} /> PREPARE LAUNCH
          </button>
        </section>
      )}

      {/* LAUNCH COUNTDOWN */}
      {page === "launch" && (
        <section className="selection-panel launch-panel">
          <button
            className="back-button"
            onClick={() => {
              setLaunchStarted(false);
              setCountdown(5);
              setPage("briefing");
            }}
          >
            <ArrowLeft size={16} /> BACK
          </button>

          <div className="eyebrow">LAUNCH CONTROL · PAD 39A</div>
          <h2>{launchStarted ? "IGNITION SEQUENCE" : "READY FOR LAUNCH"}</h2>

          <div className="countdown-display tabular-nums">
            {launchStarted ? `T−${String(countdown).padStart(2, "0")}` : "T−05"}
          </div>

          <div className="briefing-stats">
            <div>
              <span>DESTINATION</span>
              <strong>{activeMission.destination.toUpperCase()}</strong>
            </div>
            <div>
              <span>INSTALLED MODULES</span>
              <strong>{spacecraft.installedComponents.length}</strong>
            </div>
            <div>
              <span>SPACECRAFT MASS</span>
              <strong>{spacecraft.resources.massKg} KG</strong>
            </div>
          </div>

          <button
            className="primary-button"
            disabled={launchStarted}
            onClick={() => {
              setCountdown(5);
              setLaunchStarted(true);
            }}
          >
            <Rocket size={17} />
            {launchStarted ? "COUNTDOWN ACTIVE" : "INITIATE LAUNCH"}
          </button>
        </section>
      )}

      {/* FLIGHT HUD */}
      {page === "flight" && <FlightHud />}

      {/* LUNAR EXPLORATION HUD */}
      {page === "lunar" && <LunarHud proximity={lunarProximity} />}

      {/* MISSION COMPLETE DEBRIEF */}
      {page === "complete" && <MissionCompleteScreen />}

      {isMenuScreen && (
        <footer className="bottom-bar">
          <span>ASTRION SPACE EXPLORATION</span>
          <span>{activeMission.name.toUpperCase()}</span>
        </footer>
      )}

      {showSourcesModal && (
        <NasaSourcesModal onClose={() => setShowSourcesModal(false)} />
      )}

      {showDemoModal && (
        <JudgeDemoFlowModal
          onClose={() => setShowDemoModal(false)}
          onStartExpedition={() => setPage("missions")}
        />
      )}
    </main>
  );
}
