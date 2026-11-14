import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  LogOut,
  Orbit,
  Radio,
  Rocket,
  ShieldAlert,
  Sliders,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DIFFICULTY_CONFIGS,
  EDUCATIONAL_CONCEPTS,
  LAUNCH_VEHICLES,
  MISSIONS,
  MISSION_OBJECTIVES,
  ORBIT_PROFILES,
} from "../game/spacecraftData";
import { useTeamSyncStore } from "../services/teamSyncClient";
import { getDefaultTimeLimitForMission, useGameStore } from "../store/gameStore";
import type {
  DifficultyLevel,
  MissionObjectiveId,
  RoleStance,
} from "../types/game";

export default function MissionPlanningModule({
  onBack,
  onOpenBuilder,
}: {
  onBack: () => void;
  onOpenBuilder: () => void;
}) {
  const selectedMissionId = useGameStore((s) => s.selectedMissionId);
  const difficulty = useGameStore((s) => s.difficulty);
  const objectiveId = useGameStore((s) => s.objectiveId);
  const launchVehicleId = useGameStore((s) => s.launchVehicleId);
  const orbitId = useGameStore((s) => s.orbitId);
  const teamMode = useGameStore((s) => s.teamMode);
  const teamSize = useGameStore((s) => s.teamSize);
  const teamMembers = useGameStore((s) => s.teamMembers);
  const spacecraft = useGameStore((s) => s.spacecraft);
  const timedMode = useGameStore((s) => s.timedMode);
  const timeLimitSec = useGameStore((s) => s.timeLimitSec);

  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const setObjectiveId = useGameStore((s) => s.setObjectiveId);
  const setLaunchVehicleId = useGameStore((s) => s.setLaunchVehicleId);
  const setOrbitId = useGameStore((s) => s.setOrbitId);
  const setTeamMode = useGameStore((s) => s.setTeamMode);
  const setTeamSize = useGameStore((s) => s.setTeamSize);
  const updateTeamMember = useGameStore((s) => s.updateTeamMember);
  const setTimedMode = useGameStore((s) => s.setTimedMode);
  const showNotification = useGameStore((s) => s.showNotification);

  const syncStatus = useTeamSyncStore((s) => s.status);
  const syncRoomCode = useTeamSyncStore((s) => s.roomCode);
  const syncPeers = useTeamSyncStore((s) => s.peers);
  const syncError = useTeamSyncStore((s) => s.errorMessage);
  const createRoom = useTeamSyncStore((s) => s.createRoom);
  const joinRoom = useTeamSyncStore((s) => s.joinRoom);
  const leaveRoom = useTeamSyncStore((s) => s.leaveRoom);
  const pushPlanSnapshot = useTeamSyncStore((s) => s.pushPlanSnapshot);

  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [deviceName, setDeviceName] = useState("Station Control");

  // Push mission plan updates to connected multi-device room peers when local user edits
  useEffect(() => {
    if (syncStatus === "connected") {
      pushPlanSnapshot(undefined, deviceName);
    }
  }, [
    syncStatus,
    selectedMissionId,
    difficulty,
    objectiveId,
    launchVehicleId,
    orbitId,
    teamMode,
    teamSize,
    teamMembers,
    timedMode,
    timeLimitSec,
    spacecraft.installedIds,
    pushPlanSnapshot,
    deviceName,
  ]);

  const [activeTab, setActiveTab] = useState<
    "strategy" | "vehicle-orbit" | "team" | "guide"
  >("strategy");

  const mission =
    MISSIONS.find((m) => m.id === selectedMissionId) || MISSIONS[0];
  const defaultLimit = getDefaultTimeLimitForMission(selectedMissionId);
  const activeVehicle =
    LAUNCH_VEHICLES.find((v) => v.id === launchVehicleId) || LAUNCH_VEHICLES[1];
  const activeOrbit =
    ORBIT_PROFILES.find((o) => o.id === orbitId) || ORBIT_PROFILES[0];
  const activeObjective = MISSION_OBJECTIVES[objectiveId];

  const activeCrew = useMemo(
    () => (teamMode === "team" ? teamMembers.slice(0, teamSize) : [teamMembers[0]]),
    [teamMode, teamSize, teamMembers]
  );

  // Detect real priority conflicts among active team members and hardware
  const teamConflicts = useMemo(() => {
    const conflicts: string[] = [];
    const { resources } = spacecraft;

    if (resources.massKg > resources.massLimitKg) {
      conflicts.push(
        `Flight Director & Systems Engineer conflict: Spacecraft mass (${resources.massKg} KG) exceeds ${activeVehicle.name} capacity (${resources.massLimitKg} KG). Upgrade launch vehicle or trim heavy equipment.`
      );
    }
    if (resources.creditsRemaining < 0) {
      conflicts.push(
        `Budget shortfall (${resources.creditsRemaining} CR): Launch vehicle (${activeVehicle.costCr} CR) + orbit ops (${activeOrbit.opsCostCr} CR) + payload exceed difficulty funding.`
      );
    }
    if (resources.powerReserveW < 15) {
      conflicts.push(
        `Payload vs. Power tension: Current instruments leave only ${resources.powerReserveW} W reserve. Add Solar Array or trim high-draw instruments.`
      );
    }
    if (resources.dataStorageGb < resources.totalMissionDataGb) {
      conflicts.push(
        `Comms & Science bottleneck: ${activeOrbit.missionDays}-day ${activeOrbit.name} generates ${resources.totalMissionDataGb} GB, exceeding ${resources.dataStorageGb} GB storage.`
      );
    }

    if (teamMode === "team") {
      const hasScienceStance = activeCrew.some((m) => m.stance === "science");
      const hasEfficiencyStance = activeCrew.some((m) => m.stance === "efficiency");
      if (hasScienceStance && hasEfficiencyStance && resources.creditsRemaining < 160) {
        conflicts.push(
          "Team Negotiation: Payload Scientist favors high-yield instruments while Systems Engineer demands lean mass/budget reserves."
        );
      }
      const unapproved = activeCrew.filter((m) => !m.approved);
      if (unapproved.length > 0) {
        conflicts.push(
          `Awaiting Crew Sign-Off from: ${unapproved.map((u) => u.roleTitle).join(", ")}.`
        );
      }
    }

    return conflicts;
  }, [spacecraft, activeVehicle, activeOrbit, teamMode, activeCrew]);

  const massOver = spacecraft.resources.massKg > spacecraft.resources.massLimitKg;

  return (
    <section className="module-panel">
      <div className="module-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={15} /> BACK
        </button>
        <div>
          <span className="eyebrow">MISSION ARCHITECTURE · {mission.name.toUpperCase()}</span>
          <h2>LAUNCH, ORBIT & TEAM COMMAND</h2>
        </div>
        <button className="secondary-action" onClick={onOpenBuilder}>
          OPEN SPACECRAFT BUILDER
        </button>
      </div>

      {/* INTEGRATED SYSTEM IMPACT SUMMARY */}
      <div className="module-summary-row">
        <div className="stat-box">
          <span>VEHICLE MASS COMPATIBILITY</span>
          <strong className={massOver ? "text-amber-400 tabular-nums" : "tabular-nums"}>
            {spacecraft.resources.massKg} / {spacecraft.resources.massLimitKg} KG
          </strong>
        </div>
        <div className="stat-box">
          <span>REMAINING BUDGET</span>
          <strong
            className={
              spacecraft.resources.creditsRemaining < 0
                ? "text-rose-400 tabular-nums"
                : "tabular-nums"
            }
          >
            {spacecraft.resources.creditsRemaining} CR
          </strong>
        </div>
        <div className="stat-box">
          <span>ORBIT LIFETIME</span>
          <strong className="tabular-nums">{activeOrbit.missionDays} DAYS</strong>
        </div>
        <div className="stat-box">
          <span>SCIENCE MULTIPLIER</span>
          <strong className="tabular-nums">
            {Math.round(activeOrbit.scienceMultiplier * activeObjective.scienceRewardMultiplier * 100)}%
          </strong>
        </div>
        <div className="stat-box">
          <span>COMMAND MODE</span>
          <strong>{teamMode === "team" ? `${teamSize}-PLAYER CREW` : "SOLO"}</strong>
        </div>
      </div>

      {/* SECTION NAVIGATION TABS */}
      <div className="plan-tabs">
        <button
          className={activeTab === "strategy" ? "seg-btn active" : "seg-btn"}
          onClick={() => setActiveTab("strategy")}
        >
          <Sliders size={13} /> DIFFICULTY & OBJECTIVE
        </button>
        <button
          className={activeTab === "vehicle-orbit" ? "seg-btn active" : "seg-btn"}
          onClick={() => setActiveTab("vehicle-orbit")}
        >
          <Rocket size={13} /> LAUNCH VEHICLE & ORBIT
        </button>
        <button
          className={activeTab === "team" ? "seg-btn active" : "seg-btn"}
          onClick={() => setActiveTab("team")}
        >
          <Users size={13} /> TEAM COLLABORATION ({teamMode === "team" ? teamSize : 1}/4)
        </button>
        <button
          className={activeTab === "guide" ? "seg-btn active" : "seg-btn"}
          onClick={() => setActiveTab("guide")}
        >
          <BookOpen size={13} /> SYSTEMS TRADE-OFF GUIDE
        </button>
      </div>

      {/* TAB 1: DIFFICULTY & MISSION OBJECTIVE */}
      {activeTab === "strategy" && (
        <div className="plan-sections">
          <div className="plan-block">
            <h3>DIFFICULTY LEVEL</h3>
            <div className="module-grid">
              {(Object.keys(DIFFICULTY_CONFIGS) as DifficultyLevel[]).map((key) => {
                const cfg = DIFFICULTY_CONFIGS[key];
                const isSelected = difficulty === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`plan-card ${isSelected ? "active" : ""}`}
                    onClick={() => setDifficulty(key)}
                  >
                    <div className="plan-card-head">
                      <strong>{cfg.label}</strong>
                      <span>{cfg.scoreMultiplier}× SCORE</span>
                    </div>
                    <p>{cfg.description}</p>
                    <div className="card-meta">
                      <span>{cfg.startingCredits} CR BUDGET</span>
                      <span>·</span>
                      <span>{Math.round(cfg.maxMassScale * 100)}% MASS CAP</span>
                      <span>·</span>
                      <span>{Math.round(cfg.hazardIntensity * 100)}% HAZARDS</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="plan-block">
            <h3>LIMITED-TIME SAMPLE RETURN CHALLENGE (OPTIONAL)</h3>
            <div className="module-grid">
              <button
                type="button"
                className={`plan-card ${!timedMode ? "active" : ""}`}
                onClick={() => setTimedMode(false)}
              >
                <div className="plan-card-head">
                  <strong>STANDARD EXPEDITION</strong>
                  <span>NO CLOCK LIMIT</span>
                </div>
                <p>
                  Explore at your own pace with full engineering trade-offs, orbital hazards, and planetary EVA photography.
                </p>
              </button>

              <button
                type="button"
                className={`plan-card ${timedMode ? "active" : ""}`}
                onClick={() => setTimedMode(true, defaultLimit)}
              >
                <div className="plan-card-head">
                  <strong>
                    <Clock size={14} className="inline mr-1" /> TIMED SAMPLE RETURN
                  </strong>
                  <span>
                    {Math.floor(timeLimitSec / 60)}:
                    {String(timeLimitSec % 60).padStart(2, "0")} LIMIT
                  </span>
                </div>
                <p>
                  Race the mission window: launch, land on {mission.destination}, collect all 3 geological samples, and return to Earth before time expires.
                </p>
                {timedMode && (
                  <div className="segmented-row mt-2" onClick={(e) => e.stopPropagation()}>
                    {[
                      { label: "BLITZ 2:30", sec: 150 },
                      {
                        label: `STANDARD ${Math.floor(defaultLimit / 60)}:${String(
                          defaultLimit % 60
                        ).padStart(2, "0")}`,
                        sec: defaultLimit,
                      },
                      { label: "EXTENDED 5:00", sec: 300 },
                    ].map((preset) => (
                      <span
                        key={preset.sec}
                        role="button"
                        tabIndex={0}
                        className={
                          timeLimitSec === preset.sec ? "seg-btn active" : "seg-btn"
                        }
                        onClick={() => setTimedMode(true, preset.sec)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            setTimedMode(true, preset.sec);
                          }
                        }}
                      >
                        {preset.label}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </div>
          </div>

          <div className="plan-block">
            <h3>PRIMARY MISSION OBJECTIVE</h3>
            <div className="module-grid">
              {(Object.keys(MISSION_OBJECTIVES) as MissionObjectiveId[]).map((key) => {
                const obj = MISSION_OBJECTIVES[key];
                const isSelected = objectiveId === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`plan-card ${isSelected ? "active" : ""}`}
                    onClick={() => setObjectiveId(key)}
                  >
                    <div className="plan-card-head">
                      <strong>{obj.name.toUpperCase()}</strong>
                      <span>
                        {Math.round(obj.scienceRewardMultiplier * 100)}% SCI YIELD
                      </span>
                    </div>
                    <p>{obj.description}</p>
                    <div className="card-meta">
                      <span>MIN COMMS {obj.requiredCommsMin} Mbps</span>
                      <span>·</span>
                      <span>FUEL TARGET {obj.fuelEfficiencyTarget}%</span>
                    </div>
                    <div className="plan-tradeoff">{obj.tradeoffHint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LAUNCH VEHICLE & ORBIT PROFILE */}
      {activeTab === "vehicle-orbit" && (
        <div className="plan-sections">
          <div className="plan-block">
            <h3>LAUNCH VEHICLE SELECTION</h3>
            <div className="module-grid">
              {LAUNCH_VEHICLES.map((veh) => {
                const isSelected = launchVehicleId === veh.id;
                const scaledCap = Math.round(
                  veh.maxPayloadKg * DIFFICULTY_CONFIGS[difficulty].maxMassScale
                );
                const fits = spacecraft.resources.massKg <= scaledCap;
                return (
                  <button
                    key={veh.id}
                    type="button"
                    className={`plan-card ${isSelected ? "active" : ""}`}
                    onClick={() => setLaunchVehicleId(veh.id)}
                  >
                    <div className="plan-card-head">
                      <strong>{veh.name.toUpperCase()}</strong>
                      <span>{veh.costCr} CR</span>
                    </div>
                    <p>{veh.description}</p>
                    <div className="card-meta">
                      <span>MAX {scaledCap} KG</span>
                      <span>·</span>
                      <span>+{veh.fuelBonusPct}% FUEL MARGIN</span>
                      <span>·</span>
                      <span className={fits ? "text-emerald-400" : "text-amber-400"}>
                        {fits ? "PAYLOAD FITS" : "OVERWEIGHT RISK"}
                      </span>
                    </div>
                    <div className="plan-tradeoff">{veh.tradeoffNote}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="plan-block">
            <h3>ORBITAL INSERTION PROFILE</h3>
            <div className="orbit-layout">
              <div className="module-grid">
                {ORBIT_PROFILES.map((orb) => {
                  const isSelected = orbitId === orb.id;
                  return (
                    <button
                      key={orb.id}
                      type="button"
                      className={`plan-card ${isSelected ? "active" : ""}`}
                      onClick={() => setOrbitId(orb.id)}
                    >
                      <div className="plan-card-head">
                        <strong>{orb.name.toUpperCase()}</strong>
                        <span>
                          {orb.opsCostCr > 0 ? `${orb.opsCostCr} CR` : "INCLUDED"}
                        </span>
                      </div>
                      <p>{orb.description}</p>
                      <div className="card-meta">
                        <span>{orb.missionDays} DAYS</span>
                        <span>·</span>
                        <span>{Math.round(orb.scienceMultiplier * 100)}% SCI</span>
                        <span>·</span>
                        <span>
                          {orb.commsBonusMbps >= 0
                            ? `+${orb.commsBonusMbps}`
                            : orb.commsBonusMbps}{" "}
                          Mbps
                        </span>
                        <span>·</span>
                        <span>RAD: {orb.radiationHazard}</span>
                      </div>
                      <div className="plan-tradeoff">{orb.tradeoffNote}</div>
                    </button>
                  );
                })}
              </div>

              {/* LIVE ORBITAL TRAJECTORY DIAGRAM */}
              <div className="orbit-diagram-box">
                <div className="orbit-diagram-title">
                  <Orbit size={14} /> TRAJECTORY & CONSTRAINT VISUALIZER
                </div>
                <svg viewBox="0 0 360 155" className="orbit-svg" aria-label="Orbital transfer diagram">
                  {/* Star grid background */}
                  <line x1="20" y1="78" x2="340" y2="78" stroke="rgba(120,175,220,0.16)" strokeDasharray="3 3" />
                  {/* Transfer arc */}
                  <path
                    d={
                      orbitId === "high-relay"
                        ? "M 58 78 Q 180 18 300 50"
                        : orbitId === "low-science"
                        ? "M 58 78 Q 180 128 300 78"
                        : "M 58 78 Q 180 34 300 78"
                    }
                    fill="none"
                    stroke="#5ac8fa"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                  {/* Earth */}
                  <circle cx="58" cy="78" r="18" fill="#1e6fb8" stroke="#76cbff" strokeWidth="1.5" />
                  <text x="58" y="112" textAnchor="middle" fill="#9bc2e0" fontSize="9">
                    EARTH
                  </text>

                  {/* Target orbit ring */}
                  <circle
                    cx="300"
                    cy="78"
                    r={orbitId === "high-relay" ? 36 : orbitId === "low-science" ? 21 : 28}
                    fill="none"
                    stroke={orbitId === "high-relay" ? "#f59e0b" : "#4ade80"}
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                  {/* Target world */}
                  <circle
                    cx="300"
                    cy="78"
                    r="14"
                    fill={mission.destination === "Mars" ? "#b6522e" : "#95a1ad"}
                    stroke="#dce7f2"
                    strokeWidth="1"
                  />
                  <text x="300" y="126" textAnchor="middle" fill="#9bc2e0" fontSize="9">
                    {mission.destination.toUpperCase()}
                  </text>

                  {/* Mid-flight marker */}
                  <circle
                    cx="180"
                    cy={orbitId === "high-relay" ? 48 : orbitId === "low-science" ? 103 : 56}
                    r="4"
                    fill="#ffffff"
                  />
                </svg>
                <div className="orbit-diagram-meta">
                  <span>{activeOrbit.altitudeLabel}</span>
                  <span>FUEL BURN: {Math.round(activeOrbit.fuelBurnFactor * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COLLABORATIVE TEAM MODE (UP TO 4 PLAYERS) */}
      {activeTab === "team" && (
        <div className="plan-sections">
          <div className="team-mode-bar">
            <div className="segmented-row">
              <button
                className={teamMode === "solo" ? "seg-btn active" : "seg-btn"}
                onClick={() => setTeamMode("solo")}
              >
                SOLO COMMANDER (1 PLAYER)
              </button>
              <button
                className={teamMode === "team" ? "seg-btn active" : "seg-btn"}
                onClick={() => setTeamMode("team")}
              >
                COLLABORATIVE TEAM (UP TO 4 PLAYERS)
              </button>
            </div>

            {teamMode === "team" && (
              <div className="segmented-row">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    className={teamSize === count ? "seg-btn active" : "seg-btn"}
                    onClick={() => setTeamSize(count)}
                  >
                    {count} ROLES
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="module-grid">
            {activeCrew.map((member) => (
              <div key={member.roleId} className="module-card">
                <div className="plan-card-head">
                  <span className="card-kicker">{member.roleTitle.toUpperCase()}</span>
                  <button
                    className={`seg-btn ${member.approved ? "active" : ""}`}
                    onClick={() =>
                      updateTeamMember(member.roleId, {
                        approved: !member.approved,
                      })
                    }
                  >
                    {member.approved ? "SIGNED OFF" : "REVIEWING"}
                  </button>
                </div>

                <label className="team-input-label">
                  PARTICIPANT NAME
                  <input
                    type="text"
                    className="team-name-input"
                    value={member.playerName}
                    maxLength={24}
                    onChange={(e) =>
                      updateTeamMember(member.roleId, {
                        playerName: e.target.value,
                      })
                    }
                  />
                </label>

                <p>{member.responsibility}</p>

                <div>
                  <span className="card-kicker">ENGINEERING PRIORITY STANCE</span>
                  <div className="segmented-row mt-2">
                    {(["safety", "science", "efficiency"] as RoleStance[]).map((st) => (
                      <button
                        key={st}
                        className={member.stance === st ? "seg-btn active" : "seg-btn"}
                        onClick={() => updateTeamMember(member.roleId, { stance: st })}
                      >
                        {st === "safety"
                          ? "SAFETY"
                          : st === "science"
                          ? "SCIENCE"
                          : "EFFICIENCY"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* LIVE TEAM NEGOTIATION & CONFLICT ANALYZER */}
          <div className="team-consensus-box">
            <div className="plan-card-head">
              <strong>
                {teamConflicts.length === 0 ? (
                  <span className="text-emerald-400 inline-flex items-center gap-2">
                    <CheckCircle2 size={15} /> TEAM CONSENSUS & ENGINEERING ALIGNMENT NOMINAL
                  </span>
                ) : (
                  <span className="text-amber-400 inline-flex items-center gap-2">
                    <ShieldAlert size={15} /> COMPETING PRIORITIES & CONSTRAINT ADVISORIES ({teamConflicts.length})
                  </span>
                )}
              </strong>
              <span>+120 PTS TEAM COORDINATION BONUS WHEN ALL ROLES SIGN OFF</span>
            </div>

            {teamConflicts.length === 0 ? (
              <p>
                All active crew roles agree on mass, budget, power, data storage, and orbital constraints.
              </p>
            ) : (
              <ul className="conflict-list">
                {teamConflicts.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            )}
          </div>

          {/* STAGE 5: OPTIONAL MULTI-DEVICE WEBSOCKET ROOM SYNC */}
          <div className="team-consensus-box">
            <div className="plan-card-head">
              <strong className="inline-flex items-center gap-2">
                <Radio size={15} className={syncStatus === "connected" ? "text-emerald-400" : "text-sky-400"} />
                MULTI-DEVICE CREW ROOM SYNC (OPTIONAL)
              </strong>
              <span
                className={
                  syncStatus === "connected"
                    ? "text-emerald-400"
                    : syncStatus === "reconnecting"
                    ? "text-amber-400"
                    : syncStatus === "error"
                    ? "text-rose-400"
                    : "text-slate-400"
                }
              >
                {syncStatus === "connected"
                  ? `CONNECTED · ROOM ${syncRoomCode} (${syncPeers.length}/4)`
                  : syncStatus === "reconnecting"
                  ? "RECONNECTING..."
                  : syncStatus === "connecting"
                  ? "CONNECTING..."
                  : "DISCONNECTED (SOLO / LOCAL MODE READY)"}
              </span>
            </div>
            <p className="text-xs opacity-75 mt-1">
              In-memory multi-device rooms sync up to 4 crew devices on a single persistent server instance.
            </p>

            {syncStatus !== "connected" ? (
              <div className="sync-room-controls mt-3">
                <input
                  type="text"
                  className="team-name-input"
                  placeholder="Your device/operator name..."
                  maxLength={24}
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => createRoom(deviceName)}
                >
                  CREATE ROOM
                </button>
                <input
                  type="text"
                  className="team-name-input sync-code-input"
                  placeholder="ROOM CODE"
                  maxLength={6}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => joinRoom(joinCodeInput, deviceName)}
                >
                  JOIN ROOM
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="card-meta tabular-nums">
                    <span>ROOM CODE: {syncRoomCode}</span>
                    <span>·</span>
                    <span>{syncPeers.length} / 4 DEVICES LINKED</span>
                  </div>
                  <div className="segmented-row">
                    <button
                      type="button"
                      className="seg-btn"
                      onClick={() => {
                        if (syncRoomCode) {
                          navigator.clipboard?.writeText(syncRoomCode);
                          showNotification(`Copied room code ${syncRoomCode}.`);
                        }
                      }}
                    >
                      <Copy size={12} className="inline mr-1" /> COPY CODE
                    </button>
                    <button type="button" className="seg-btn" onClick={leaveRoom}>
                      <LogOut size={12} className="inline mr-1" /> LEAVE ROOM
                    </button>
                  </div>
                </div>
                <div className="sync-peers-row">
                  {syncPeers.map((peer) => (
                    <div key={peer.clientId} className="sync-peer-item">
                      <strong>{peer.displayName}</strong>
                      <span>{peer.isHost ? "HOST" : "CREW"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {syncError && <p className="text-rose-400 mt-2">{syncError}</p>}
          </div>
        </div>
      )}

      {/* TAB 4: EDUCATIONAL SYSTEMS TRADE-OFF GUIDE */}
      {activeTab === "guide" && (
        <div className="module-grid">
          {EDUCATIONAL_CONCEPTS.map((item) => (
            <div key={item.topic} className="module-card">
              <span className="card-kicker">AEROSPACE SYSTEMS CONCEPT</span>
              <h3>{item.topic}</h3>
              <p>{item.summary}</p>
              <div className="plan-tradeoff">
                <strong>Mission Trade-Off:</strong> {item.tradeoff}
              </div>
            </div>
          ))}
          <div className="module-card">
            <span className="card-kicker">EXPERIMENTATION SANDBOX</span>
            <h3>Learning from Failure & Success</h3>
            <p>
              ASTRION lets you launch with any spacecraft build—even an incomplete or overweight one—so you can observe exactly how missing propulsion, low power, overweight launchers, or insufficient thermal shielding play out during simulation.
            </p>
            <button className="secondary-action mt-auto" onClick={onOpenBuilder}>
              <Compass size={14} /> EXPERIMENT IN BUILDER
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
