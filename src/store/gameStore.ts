import { create } from "zustand";
import {
  DEFAULT_TEAM_MEMBERS,
  DIFFICULTY_CONFIGS,
  LAUNCH_VEHICLES,
  MISSIONS,
  MISSION_OBJECTIVES,
  ORBIT_PROFILES,
  RECOMMENDED_LOADOUT_IDS,
} from "../game/spacecraftData";
import {
  calculateDataTransmissionSummary,
  calculateSpacecraft,
  type MissionPlanOptions,
  validateSpacecraft,
} from "../game/spacecraftCalculations";
import type { NeoFeedResponse } from "../data/nasaSources";
import { fetchNeoFeed, getInitialNeoFeed } from "../services/nasaNeoService";
import type {
  Achievement,
  BuiltSpacecraft,
  CameraMode,
  CapturedPhoto,
  DifficultyLevel,
  FlightAnomalyEvent,
  FlightAnomalyOption,
  FlightStage,
  FlightTelemetry,
  GamePage,
  LaunchVehicleDef,
  LunarCameraMode,
  LunarDiscoverable,
  MissionDefinition,
  MissionObjectiveId,
  OrbitProfileDef,
  PrepareModule,
  SavedMissionRecord,
  SpacecraftBlueprint,
  SurvivalKitConfig,
  TeamMemberConfig,
  TeamRoleId,
} from "../types/game";

const HISTORY_STORAGE_KEY = "astrion_mission_history_v1";
const BLUEPRINTS_STORAGE_KEY = "astrion_saved_blueprints_v1";

function loadStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStoredJson<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function createStarterBlueprints(): SpacecraftBlueprint[] {
  const lightIds = [
    "solar-array",
    "battery",
    "relay-transmitter",
    "onboard-computer",
    "propulsion-module",
    "fuel-tank",
    "thermal-control",
    "landing-gear",
    "scientific-camera",
    "data-storage",
  ];
  const heavyIds = [
    ...RECOMMENDED_LOADOUT_IDS,
    "spectrometer",
    "micro-rover",
  ];

  const lightCalc = calculateSpacecraft(lightIds, {
    difficulty: "engineer",
    objectiveId: "rapid-endurance",
    launchVehicleId: "vanguard-light",
    orbitId: "high-relay",
  });
  const heavyCalc = calculateSpacecraft(heavyIds, {
    difficulty: "engineer",
    objectiveId: "max-science",
    launchVehicleId: "saturn-heavy",
    orbitId: "low-science",
  });

  return [
    {
      id: "bp-starter-lean",
      name: "Vanguard Lean Scout",
      createdAt: "Reference Design",
      missionId: "explore-moon",
      difficulty: "engineer",
      objectiveId: "rapid-endurance",
      launchVehicleId: "vanguard-light",
      orbitId: "high-relay",
      installedIds: lightIds,
      teamMode: "solo",
      teamSize: 1,
      summary: {
        massKg: lightCalc.resources.massKg,
        powerReserveW: lightCalc.resources.powerReserveW,
        sciencePoints: lightCalc.resources.sciencePoints,
        communicationMbps: lightCalc.resources.communicationMbps,
        creditsRemaining: lightCalc.resources.creditsRemaining,
      },
    },
    {
      id: "bp-starter-heavy",
      name: "Saturn Heavy Science Lab",
      createdAt: "Reference Design",
      missionId: "explore-mars",
      difficulty: "engineer",
      objectiveId: "max-science",
      launchVehicleId: "saturn-heavy",
      orbitId: "low-science",
      installedIds: heavyIds,
      teamMode: "team",
      teamSize: 4,
      summary: {
        massKg: heavyCalc.resources.massKg,
        powerReserveW: heavyCalc.resources.powerReserveW,
        sciencePoints: heavyCalc.resources.sciencePoints,
        communicationMbps: heavyCalc.resources.communicationMbps,
        creditsRemaining: heavyCalc.resources.creditsRemaining,
      },
    },
  ];
}

function buildSpacecraftFromIds(
  installedIds: string[],
  options: MissionPlanOptions
): BuiltSpacecraft {
  const validation = validateSpacecraft(installedIds, options);
  return {
    installedIds: [...installedIds],
    installedComponents: validation.installedComponents,
    resources: validation.resources,
    validation,
  };
}

export function getDefaultTimeLimitForMission(
  missionId: MissionDefinition["id"]
): number {
  return missionId === "explore-mars" ? 270 : 210;
}

function computeMissionGradeAndScore(
  state: GameState,
  status: "SUCCESS" | "FAILED"
) {
  const diff = DIFFICULTY_CONFIGS[state.difficulty];
  const samplesCollectedCount = state.discoverables.filter((d) => d.collected).length;
  const dataTransmission = calculateDataTransmissionSummary(
    state.spacecraft.resources,
    state.orbitId,
    state.objectiveId,
    state.scienceScore,
    {
      samplesCollected: samplesCollectedCount,
      photosCount: state.photos.length,
    }
  );

  const collectedBonus = samplesCollectedCount * 75;
  const photoBonus = state.photos.length * 40;
  const hullBonus = Math.round(state.telemetry.hullPct * 4);
  const fuelBonus = Math.round(state.telemetry.fuelPct * 3);
  const powerBonus = Math.round(state.telemetry.powerPct * 2);
  const teamBonus =
    state.teamMode === "team" &&
    state.teamMembers.slice(0, state.teamSize).every((m) => m.approved)
      ? 120
      : 0;
  const timedBonus =
    state.timedMode && status === "SUCCESS"
      ? 180 + Math.round(state.remainingTimeSec * 1.5)
      : 0;

  if (status === "FAILED") {
    return {
      grade: "F" as const,
      totalScore: Math.max(
        0,
        Math.round(
          (dataTransmission.effectiveScienceScore * 0.35 + collectedBonus) *
            diff.scoreMultiplier
        )
      ),
      dataTransmission,
    };
  }

  const totalScore = Math.round(
    (dataTransmission.effectiveScienceScore +
      collectedBonus +
      photoBonus +
      hullBonus +
      fuelBonus +
      powerBonus +
      teamBonus +
      timedBonus) *
      diff.scoreMultiplier
  );

  let grade: SavedMissionRecord["grade"] = "C";
  if (totalScore >= 2100 && state.telemetry.hullPct >= 75) grade = "S";
  else if (totalScore >= 1650) grade = "A";
  else if (totalScore >= 1200) grade = "B";
  else if (totalScore < 850) grade = "D";

  return { grade, totalScore, dataTransmission };
}

function createMissionRecord(
  state: GameState,
  status: "SUCCESS" | "FAILED",
  failReason?: string
): SavedMissionRecord {
  const mission =
    MISSIONS.find((m) => m.id === state.selectedMissionId) || MISSIONS[0];
  const { grade, totalScore, dataTransmission } = computeMissionGradeAndScore(
    state,
    status
  );
  return {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    missionId: mission.id,
    missionName: mission.name,
    destination: mission.destination,
    difficulty: state.difficulty,
    objectiveId: state.objectiveId,
    launchVehicleId: state.launchVehicleId,
    orbitId: state.orbitId,
    teamMode: state.teamMode,
    teamNames:
      state.teamMode === "team"
        ? state.teamMembers.slice(0, state.teamSize).map((m) => m.playerName)
        : [state.teamMembers[0].playerName],
    timedMode: state.timedMode,
    timeLimitSec: state.timeLimitSec,
    status,
    failReason,
    grade,
    totalScore,
    scienceScore: dataTransmission.effectiveScienceScore,
    elapsedSec: Math.round(state.missionElapsedSec),
    hullPct: Math.round(state.telemetry.hullPct),
    fuelPct: Math.round(state.telemetry.fuelPct),
    powerPct: Math.round(state.telemetry.powerPct),
    samplesCollected: state.discoverables.filter((d) => d.collected).length,
    photosCount: state.photos.length,
    installedIds: [...state.spacecraft.installedIds],
    massKg: state.spacecraft.resources.massKg,
    creditsSpent: state.spacecraft.resources.creditsSpent,
    dataTransmission,
  };
}

function createInitialDiscoverables(
  missionId: MissionDefinition["id"]
): LunarDiscoverable[] {
  if (missionId === "explore-mars") {
    return [
      {
        id: "sample-basalt",
        title: "Jezero Olivine Basalt",
        kind: "sample",
        description:
          "Iron-rich Martian volcanic basalt weathered by ancient Jezero lakebed mineral flows.",
        scienceValue: 140,
        position: [14, 0, -16],
        collected: false,
        photographed: false,
      },
      {
        id: "sample-anorthosite",
        title: "Hematite Sphere Cluster",
        kind: "sample",
        description:
          "Iron oxide concretions formed in subsurface Martian groundwater milliards of years ago.",
        scienceValue: 170,
        position: [-20, 0, -24],
        collected: false,
        photographed: false,
      },
      {
        id: "sample-ice",
        title: "Subsurface Permafrost Core",
        kind: "sample",
        description:
          "Frozen CO2 and water-ice regolith pocket preserved beneath oxidized Martian dust.",
        scienceValue: 210,
        position: [26, 0, 14],
        collected: false,
        photographed: false,
      },
      {
        id: "relic-flag",
        title: "Ares Vanguard Landing Marker",
        kind: "relic",
        description:
          "Pioneer survey beacon marking humanity's first crewed landing zone in Jezero Crater.",
        scienceValue: 110,
        position: [-11, 0, 12],
        collected: false,
        photographed: false,
      },
      {
        id: "relic-probe",
        title: "Legacy Mars Scout Probe",
        kind: "relic",
        description:
          "Dust-coated robotic lander with weathered solar wings still logging atmospheric pressure.",
        scienceValue: 160,
        position: [4, 0, -34],
        collected: false,
        photographed: false,
      },
      {
        id: "relic-seismometer",
        title: "InSight Seismic & Weather Station",
        kind: "relic",
        description:
          "Orbital-link seismometer and wind sensor array monitoring Martian dust storms.",
        scienceValue: 175,
        position: [-28, 0, 4],
        collected: false,
        photographed: false,
      },
    ];
  }

  return [
    {
      id: "sample-basalt",
      title: "Vesicular Mare Basalt",
      kind: "sample",
      description:
        "Dark volcanic titanium-rich basalt formed by ancient lunar lava flows.",
      scienceValue: 120,
      position: [14, 0, -16],
      collected: false,
      photographed: false,
    },
    {
      id: "sample-anorthosite",
      title: "Highland Anorthosite Crystal",
      kind: "sample",
      description:
        "Primordial pale crustal rock dating back 4.4 billion years to the lunar magma ocean.",
      scienceValue: 160,
      position: [-20, 0, -24],
      collected: false,
      photographed: false,
    },
    {
      id: "sample-ice",
      title: "Shadowed Regolith Core",
      kind: "sample",
      description:
        "Subsurface regolith core containing trapped solar wind hydrogen and trace volatiles.",
      scienceValue: 190,
      position: [26, 0, 14],
      collected: false,
      photographed: false,
    },
    {
      id: "relic-flag",
      title: "Apollo Era Surface Marker",
      kind: "relic",
      description:
        "Historic titanium flagpole and commemorative stainless steel plaque left by early pioneers.",
      scienceValue: 100,
      position: [-11, 0, 12],
      collected: false,
      photographed: false,
    },
    {
      id: "relic-probe",
      title: "Surveyor Telemetry Lander",
      kind: "relic",
      description:
        "Decommissioned unmanned robotic scout with weathered Kapton gold thermal blankets.",
      scienceValue: 140,
      position: [4, 0, -34],
      collected: false,
      photographed: false,
    },
    {
      id: "relic-seismometer",
      title: "Lunar Seismic & Retroreflector Array",
      kind: "relic",
      description:
        "Laser ranging corner-cube mirror array and passive seismic package still aligned toward Earth.",
      scienceValue: 150,
      position: [-28, 0, 4],
      collected: false,
      photographed: false,
    },
  ];
}

function createInitialAchievements(): Achievement[] {
  return [
    {
      id: "liftoff",
      title: "Orbital Escape",
      description: "Break through Earth's atmosphere and reach deep space.",
      unlocked: false,
    },
    {
      id: "clean-belt",
      title: "Ace Navigator",
      description: "Clear the asteroid corridor with zero hull collisions.",
      unlocked: false,
    },
    {
      id: "touchdown",
      title: "Touchdown Confirmed",
      description: "Execute a controlled powered descent onto another world.",
      unlocked: false,
    },
    {
      id: "geologist",
      title: "Planetary Geologist",
      description: "Collect all 3 geological regolith and rock samples.",
      unlocked: false,
    },
    {
      id: "historian",
      title: "Expedition Historian",
      description: "Inspect and document all 3 historical surface artifacts.",
      unlocked: false,
    },
    {
      id: "photographer",
      title: "Horizon Chronicler",
      description: "Capture at least 3 photographs during surface EVA.",
      unlocked: false,
    },
    {
      id: "safe-return",
      title: "Splashdown Home",
      description: "Complete the round-trip expedition and return safely to Earth.",
      unlocked: false,
    },
  ];
}

const INITIAL_TELEMETRY: FlightTelemetry = {
  altitudeKm: 0,
  speedMs: 0,
  fuelPct: 100,
  powerPct: 100,
  hullPct: 100,
  heading: 0,
  pitch: 0,
  distanceToMoonKm: 384400,
  distanceToEarthKm: 0,
  journeyProgress: 0,
  asteroidProgress: 0,
  asteroidsAvoided: 0,
  asteroidHits: 0,
  phaseLabel: "ON PAD",
  activeNeo: null,
};

interface GameState {
  page: GamePage;
  selectedModule: PrepareModule;
  selectedMissionId: MissionDefinition["id"];
  difficulty: DifficultyLevel;
  objectiveId: MissionObjectiveId;
  launchVehicleId: LaunchVehicleDef["id"];
  orbitId: OrbitProfileDef["id"];
  teamMode: "solo" | "team";
  teamSize: number;
  teamMembers: TeamMemberConfig[];
  spacecraft: BuiltSpacecraft;
  survivalKit: SurvivalKitConfig;
  countdown: number;
  launchStarted: boolean;
  launchActive: boolean;
  flightStage: FlightStage;
  cameraMode: CameraMode;
  lunarCameraMode: LunarCameraMode;
  paused: boolean;
  muted: boolean;
  fastForward: boolean;
  timedMode: boolean;
  timeLimitSec: number;
  remainingTimeSec: number;
  missionFailed: boolean;
  missionFailReason: string;
  telemetry: FlightTelemetry;
  discoverables: LunarDiscoverable[];
  photos: CapturedPhoto[];
  scienceScore: number;
  missionElapsedSec: number;
  achievements: Achievement[];
  flightRunId: number;
  notificationText: string | null;
  activeAnomaly: FlightAnomalyEvent | null;
  anomalyAdjustment: { fuelDelta: number; powerDelta: number };
  neoFeed: NeoFeedResponse;
  neoLoading: boolean;
  neoError: string | null;
  missionHistory: SavedMissionRecord[];
  savedBlueprints: SpacecraftBlueprint[];
  lastCompletedRecord: SavedMissionRecord | null;

  setPage: (page: GamePage) => void;
  setSelectedModule: (module: PrepareModule) => void;
  selectMission: (id: MissionDefinition["id"]) => void;
  setDifficulty: (difficulty: DifficultyLevel) => void;
  setObjectiveId: (objectiveId: MissionObjectiveId) => void;
  setLaunchVehicleId: (vehicleId: LaunchVehicleDef["id"]) => void;
  setOrbitId: (orbitId: OrbitProfileDef["id"]) => void;
  setTeamMode: (mode: "solo" | "team") => void;
  setTeamSize: (size: number) => void;
  updateTeamMember: (roleId: TeamRoleId, patch: Partial<TeamMemberConfig>) => void;
  setSpacecraft: (spacecraft: BuiltSpacecraft) => void;
  updateSurvivalKit: (patch: Partial<SurvivalKitConfig>) => void;
  setCameraMode: (mode: CameraMode) => void;
  cycleCameraMode: () => void;
  setLunarCameraMode: (mode: LunarCameraMode) => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  toggleMute: () => void;
  setFastForward: (fastForward: boolean) => void;
  setTimedMode: (enabled: boolean, customTimeLimitSec?: number) => void;
  setCountdown: (val: number) => void;
  setLaunchStarted: (val: boolean) => void;
  igniteEngines: () => void;
  setFlightStage: (stage: FlightStage) => void;
  updateTelemetry: (patch: Partial<FlightTelemetry>) => void;
  triggerHullDamage: (amount: number) => void;
  triggerSystemFailure: (reason: string) => void;
  triggerAnomaly: (event: FlightAnomalyEvent) => void;
  resolveAnomaly: (option: FlightAnomalyOption) => void;
  consumeAnomalyAdjustment: () => { fuelDelta: number; powerDelta: number };
  collectDiscoverable: (id: string) => void;
  addCapturedPhoto: (
    photo: Omit<CapturedPhoto, "id" | "timestamp">,
    discoverableId?: string
  ) => void;
  unlockAchievement: (id: string) => void;
  showNotification: (msg: string) => void;
  startReturnJourney: () => void;
  completeMission: () => void;
  restartMission: (targetPage?: GamePage) => void;
  incrementElapsed: (simDt: number, realDt?: number) => void;
  loadNeoFeed: (forceRefresh?: boolean) => Promise<void>;
  applySyncedPlan: (plan: {
    selectedMissionId: MissionDefinition["id"];
    difficulty: DifficultyLevel;
    objectiveId: MissionObjectiveId;
    launchVehicleId: LaunchVehicleDef["id"];
    orbitId: OrbitProfileDef["id"];
    installedIds: string[];
    teamMode: "solo" | "team";
    teamSize: number;
    teamMembers: TeamMemberConfig[];
    timedMode: boolean;
    timeLimitSec: number;
  }) => void;
  saveCurrentBlueprint: (name: string) => SpacecraftBlueprint;
  loadBlueprint: (bp: SpacecraftBlueprint) => void;
  importBlueprintJson: (raw: string) => { ok: boolean; message: string };
  deleteBlueprint: (id: string) => void;
}

let notificationTimer: number | undefined;

const defaultPlanOptions: MissionPlanOptions = {
  difficulty: "engineer",
  objectiveId: "balanced-recon",
  launchVehicleId: "ares-medium",
  orbitId: "direct-hohmann",
};

export const useGameStore = create<GameState>((set, get) => ({
  page: "home",
  selectedModule: "LAUNCH, ORBIT & TEAM",
  selectedMissionId: "explore-moon",
  difficulty: "engineer",
  objectiveId: "balanced-recon",
  launchVehicleId: "ares-medium",
  orbitId: "direct-hohmann",
  teamMode: "solo",
  teamSize: 4,
  teamMembers: DEFAULT_TEAM_MEMBERS.map((m) => ({ ...m })),
  spacecraft: buildSpacecraftFromIds(RECOMMENDED_LOADOUT_IDS, defaultPlanOptions),
  survivalKit: {
    oxygenReserveLevel: 2,
    thermalSuitGrade: 2,
    jetpackThrusterBoost: true,
  },
  countdown: 5,
  launchStarted: false,
  launchActive: false,
  flightStage: "pad",
  cameraMode: "rear",
  lunarCameraMode: "third-person",
  paused: false,
  muted: false,
  fastForward: false,
  timedMode: false,
  timeLimitSec: 210,
  remainingTimeSec: 210,
  missionFailed: false,
  missionFailReason: "",
  telemetry: { ...INITIAL_TELEMETRY },
  discoverables: createInitialDiscoverables("explore-moon"),
  photos: [],
  scienceScore: 0,
  missionElapsedSec: 0,
  achievements: createInitialAchievements(),
  flightRunId: 1,
  notificationText: null,
  activeAnomaly: null,
  anomalyAdjustment: { fuelDelta: 0, powerDelta: 0 },
  neoFeed: getInitialNeoFeed(),
  neoLoading: true,
  neoError: null,
  missionHistory: loadStoredJson<SavedMissionRecord[]>(HISTORY_STORAGE_KEY, []),
  savedBlueprints: loadStoredJson<SpacecraftBlueprint[]>(
    BLUEPRINTS_STORAGE_KEY,
    createStarterBlueprints()
  ),
  lastCompletedRecord: null,

  setPage: (page) => set({ page, paused: false, fastForward: false }),
  setSelectedModule: (selectedModule) => set({ selectedModule }),
  selectMission: (selectedMissionId) => {
    const mission =
      MISSIONS.find((m) => m.id === selectedMissionId) || MISSIONS[0];
    const defaultLimit = getDefaultTimeLimitForMission(selectedMissionId);
    set((state) => ({
      selectedMissionId,
      timeLimitSec: defaultLimit,
      remainingTimeSec: defaultLimit,
      discoverables: createInitialDiscoverables(selectedMissionId),
      telemetry: {
        ...state.telemetry,
        distanceToMoonKm: mission.distanceKm,
      },
    }));
  },

  setDifficulty: (difficulty) =>
    set((state) => ({
      difficulty,
      spacecraft: buildSpacecraftFromIds(state.spacecraft.installedIds, {
        difficulty,
        objectiveId: state.objectiveId,
        launchVehicleId: state.launchVehicleId,
        orbitId: state.orbitId,
      }),
    })),

  setObjectiveId: (objectiveId) =>
    set((state) => ({
      objectiveId,
      spacecraft: buildSpacecraftFromIds(state.spacecraft.installedIds, {
        difficulty: state.difficulty,
        objectiveId,
        launchVehicleId: state.launchVehicleId,
        orbitId: state.orbitId,
      }),
    })),

  setLaunchVehicleId: (launchVehicleId) =>
    set((state) => ({
      launchVehicleId,
      spacecraft: buildSpacecraftFromIds(state.spacecraft.installedIds, {
        difficulty: state.difficulty,
        objectiveId: state.objectiveId,
        launchVehicleId,
        orbitId: state.orbitId,
      }),
    })),

  setOrbitId: (orbitId) =>
    set((state) => ({
      orbitId,
      spacecraft: buildSpacecraftFromIds(state.spacecraft.installedIds, {
        difficulty: state.difficulty,
        objectiveId: state.objectiveId,
        launchVehicleId: state.launchVehicleId,
        orbitId,
      }),
    })),

  setTeamMode: (teamMode) => set({ teamMode }),
  setTeamSize: (teamSize) =>
    set({ teamSize: Math.max(2, Math.min(4, teamSize)) }),
  updateTeamMember: (roleId, patch) =>
    set((state) => ({
      teamMembers: state.teamMembers.map((m) =>
        m.roleId === roleId ? { ...m, ...patch } : m
      ),
    })),

  setSpacecraft: (spacecraft) => set({ spacecraft }),
  updateSurvivalKit: (patch) =>
    set((state) => ({
      survivalKit: { ...state.survivalKit, ...patch },
    })),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  cycleCameraMode: () =>
    set((state) => {
      const order: CameraMode[] = ["cockpit", "rear", "front"];
      const next = order[(order.indexOf(state.cameraMode) + 1) % order.length];
      return { cameraMode: next };
    }),
  setLunarCameraMode: (lunarCameraMode) => set({ lunarCameraMode }),
  togglePause: () => set((state) => ({ paused: !state.paused, fastForward: false })),
  setPaused: (paused) => set({ paused, fastForward: false }),
  toggleMute: () => set((state) => ({ muted: !state.muted })),
  setFastForward: (fastForward) => set({ fastForward }),
  setTimedMode: (enabled, customTimeLimitSec) =>
    set((state) => {
      const limit =
        customTimeLimitSec ||
        state.timeLimitSec ||
        getDefaultTimeLimitForMission(state.selectedMissionId);
      return {
        timedMode: enabled,
        timeLimitSec: limit,
        remainingTimeSec: limit,
      };
    }),
  setCountdown: (countdown) => set({ countdown }),
  setLaunchStarted: (launchStarted) => set({ launchStarted }),

  igniteEngines: () =>
    set((state) => {
      const vehicle =
        LAUNCH_VEHICLES.find((v) => v.id === state.launchVehicleId) ||
        LAUNCH_VEHICLES[1];
      const hasExtraFuel = state.spacecraft.installedIds.includes("fuel-tank");
      const baseFuel = hasExtraFuel ? 100 : 28;
      const startFuel = Math.min(100, baseFuel + vehicle.fuelBonusPct);
      const hasSolar = state.spacecraft.installedIds.includes("solar-array");
      const hasBattery = state.spacecraft.installedIds.includes("battery");
      const startPower = hasSolar ? 100 : hasBattery ? 65 : 35;
      return {
        launchActive: true,
        flightStage: "ignition",
        activeAnomaly: null,
        telemetry: {
          ...state.telemetry,
          fuelPct: startFuel,
          powerPct: startPower,
          phaseLabel: "ENGINE IGNITION",
        },
      };
    }),

  setFlightStage: (flightStage) => set({ flightStage }),

  updateTelemetry: (patch) =>
    set((state) => ({
      telemetry: { ...state.telemetry, ...patch },
    })),

  triggerHullDamage: (amount) =>
    set((state) => {
      if (state.missionFailed) return state;
      const hasShield = state.spacecraft.installedIds.includes("radiation-shield");
      const hasThermal = state.spacecraft.installedIds.includes("thermal-control");
      const diffIntensity = DIFFICULTY_CONFIGS[state.difficulty].hazardIntensity;
      const mitigation = (hasShield ? 0.65 : 1) * (hasThermal ? 0.85 : 1);
      const nextHull = Math.max(
        0,
        state.telemetry.hullPct - amount * mitigation * diffIntensity
      );
      const nextHits = state.telemetry.asteroidHits + 1;
      const failed = nextHull <= 0 || nextHits >= 2;
      const failReason =
        nextHits >= 2
          ? "Catastrophic structural damage: Spacecraft hit asteroids 2 times."
          : "Critical hull breach from asteroid or hazard impact.";
      let nextHistory = state.missionHistory;
      if (failed) {
        const rec = createMissionRecord(
          {
            ...state,
            telemetry: {
              ...state.telemetry,
              hullPct: nextHull,
              asteroidHits: nextHits,
            },
          },
          "FAILED",
          failReason
        );
        nextHistory = [rec, ...state.missionHistory].slice(0, 20);
        saveStoredJson(HISTORY_STORAGE_KEY, nextHistory);
      }
      return {
        telemetry: {
          ...state.telemetry,
          hullPct: nextHull,
          asteroidHits: nextHits,
        },
        launchActive: failed ? false : state.launchActive,
        missionFailed: failed,
        missionFailReason: failed ? failReason : state.missionFailReason,
        missionHistory: nextHistory,
      };
    }),

  triggerSystemFailure: (reason) =>
    set((state) => {
      if (state.missionFailed) return state;
      const rec = createMissionRecord(state, "FAILED", reason);
      const nextHistory = [rec, ...state.missionHistory].slice(0, 20);
      saveStoredJson(HISTORY_STORAGE_KEY, nextHistory);
      return {
        launchActive: false,
        activeAnomaly: null,
        missionFailed: true,
        missionFailReason: reason,
        missionHistory: nextHistory,
      };
    }),

  triggerAnomaly: (event) =>
    set({
      activeAnomaly: event,
      paused: true,
      fastForward: false,
    }),

  resolveAnomaly: (option) =>
    set((state) => {
      const hasShield = state.spacecraft.installedIds.includes("radiation-shield");
      const rawHull = option.hullDelta || 0;
      const mitigatedHull =
        rawHull < 0 && hasShield ? Math.round(rawHull * 0.55) : rawHull;
      const nextHull = Math.max(
        0,
        Math.min(100, state.telemetry.hullPct + mitigatedHull)
      );
      const nextScience = Math.max(0, state.scienceScore + (option.scienceDelta || 0));
      const nextFuel = Math.max(
        0,
        Math.min(100, state.telemetry.fuelPct + (option.fuelDelta || 0))
      );
      const nextPower = Math.max(
        0,
        Math.min(100, state.telemetry.powerPct + (option.powerDelta || 0))
      );

      if (nextHull <= 0 || nextFuel <= 0) {
        const reason =
          nextFuel <= 0
            ? "Propellant exhausted: Emergency maneuver depleted remaining fuel reserves."
            : "Hull integrity failed during space weather anomaly.";
        const rec = createMissionRecord(
          {
            ...state,
            telemetry: {
              ...state.telemetry,
              hullPct: nextHull,
              fuelPct: nextFuel,
            },
          },
          "FAILED",
          reason
        );
        const nextHistory = [rec, ...state.missionHistory].slice(0, 20);
        saveStoredJson(HISTORY_STORAGE_KEY, nextHistory);
        return {
          activeAnomaly: null,
          launchActive: false,
          paused: false,
          missionFailed: true,
          missionFailReason: reason,
          telemetry: {
            ...state.telemetry,
            hullPct: nextHull,
            fuelPct: nextFuel,
          },
          missionHistory: nextHistory,
        };
      }

      return {
        activeAnomaly: null,
        paused: false,
        scienceScore: nextScience,
        anomalyAdjustment: {
          fuelDelta: state.anomalyAdjustment.fuelDelta + (option.fuelDelta || 0),
          powerDelta: state.anomalyAdjustment.powerDelta + (option.powerDelta || 0),
        },
        telemetry: {
          ...state.telemetry,
          hullPct: nextHull,
          fuelPct: nextFuel,
          powerPct: nextPower,
        },
        notificationText: `Anomaly response executed: ${option.label}`,
      };
    }),

  consumeAnomalyAdjustment: () => {
    const adj = get().anomalyAdjustment;
    if (adj.fuelDelta !== 0 || adj.powerDelta !== 0) {
      set({ anomalyAdjustment: { fuelDelta: 0, powerDelta: 0 } });
    }
    return adj;
  },

  collectDiscoverable: (id) =>
    set((state) => {
      const item = state.discoverables.find((d) => d.id === id);
      if (!item || item.collected) return state;

      const orbit =
        ORBIT_PROFILES.find((o) => o.id === state.orbitId) || ORBIT_PROFILES[0];
      const bonusMultiplier =
        (1 +
          (state.spacecraft.installedIds.includes("spectrometer") ? 0.25 : 0) +
          (state.spacecraft.installedIds.includes("lunar-drill") ? 0.15 : 0)) *
        orbit.scienceMultiplier;
      const gained = Math.round(item.scienceValue * bonusMultiplier);

      const nextDiscoverables = state.discoverables.map((d) =>
        d.id === id ? { ...d, collected: true } : d
      );

      const allSamples = nextDiscoverables
        .filter((d) => d.kind === "sample")
        .every((d) => d.collected);
      const allRelics = nextDiscoverables
        .filter((d) => d.kind === "relic")
        .every((d) => d.collected);

      const nextAchievements = state.achievements.map((a) => {
        if (a.id === "geologist" && allSamples) return { ...a, unlocked: true };
        if (a.id === "historian" && allRelics) return { ...a, unlocked: true };
        return a;
      });

      return {
        discoverables: nextDiscoverables,
        scienceScore: state.scienceScore + gained,
        achievements: nextAchievements,
        notificationText: `${item.kind === "sample" ? "Sample collected" : "Artifact documented"}: ${item.title} (+${gained} SCI)`,
      };
    }),

  addCapturedPhoto: (photo, discoverableId) =>
    set((state) => {
      const newPhoto: CapturedPhoto = {
        ...photo,
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
      const nextPhotos = [newPhoto, ...state.photos];
      const nextDiscoverables = discoverableId
        ? state.discoverables.map((d) =>
            d.id === discoverableId ? { ...d, photographed: true } : d
          )
        : state.discoverables;

      const nextAchievements = state.achievements.map((a) =>
        a.id === "photographer" && nextPhotos.length >= 3
          ? { ...a, unlocked: true }
          : a
      );

      return {
        photos: nextPhotos,
        discoverables: nextDiscoverables,
        scienceScore: state.scienceScore + 45,
        achievements: nextAchievements,
        notificationText: `Photograph saved: ${photo.title} (+45 SCI)`,
      };
    }),

  unlockAchievement: (id) =>
    set((state) => ({
      achievements: state.achievements.map((a) =>
        a.id === id ? { ...a, unlocked: true } : a
      ),
    })),

  showNotification: (msg) => {
    if (notificationTimer) window.clearTimeout(notificationTimer);
    set({ notificationText: msg });
    notificationTimer = window.setTimeout(() => {
      set({ notificationText: null });
    }, 3500);
  },

  startReturnJourney: () =>
    set((state) => {
      const mission =
        MISSIONS.find((m) => m.id === state.selectedMissionId) || MISSIONS[0];
      return {
        page: "flight",
        flightStage: "moon-launch",
        launchActive: true,
        cameraMode: "rear",
        paused: false,
        telemetry: {
          ...state.telemetry,
          altitudeKm: 0,
          speedMs: 0,
          journeyProgress: 0,
          distanceToMoonKm: 0,
          distanceToEarthKm: mission.distanceKm,
          phaseLabel:
            mission.destination === "Mars" ? "MARS ASCENT" : "LUNAR ASCENT",
        },
      };
    }),

  completeMission: () =>
    set((state) => {
      const allSamplesCollected = state.discoverables
        .filter((d) => d.kind === "sample")
        .every((d) => d.collected);

      if (state.timedMode && !allSamplesCollected) {
        const failReason =
          "Timed mission incomplete: Returned to Earth without collecting all 3 geological samples.";
        const rec = createMissionRecord(state, "FAILED", failReason);
        const nextHistory = [rec, ...state.missionHistory].slice(0, 20);
        saveStoredJson(HISTORY_STORAGE_KEY, nextHistory);
        return {
          launchActive: false,
          paused: false,
          fastForward: false,
          activeAnomaly: null,
          missionFailed: true,
          missionFailReason: failReason,
          missionHistory: nextHistory,
        };
      }

      const updatedState: GameState = {
        ...state,
        achievements: state.achievements.map((a) =>
          a.id === "safe-return" ? { ...a, unlocked: true } : a
        ),
      };
      const rec = createMissionRecord(updatedState, "SUCCESS");
      const nextHistory = [rec, ...state.missionHistory].slice(0, 20);
      saveStoredJson(HISTORY_STORAGE_KEY, nextHistory);
      return {
        page: "complete",
        launchActive: false,
        paused: false,
        fastForward: false,
        activeAnomaly: null,
        achievements: updatedState.achievements,
        missionHistory: nextHistory,
        lastCompletedRecord: rec,
      };
    }),

  restartMission: (targetPage = "flight") => {
    const missionId = get().selectedMissionId;
    const mission = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
    set((state) => ({
      page: targetPage,
      countdown: 5,
      launchStarted: false,
      launchActive: false,
      flightStage: "pad",
      cameraMode: "rear",
      lunarCameraMode: "third-person",
      paused: false,
      fastForward: false,
      remainingTimeSec: state.timeLimitSec,
      missionFailed: false,
      missionFailReason: "",
      activeAnomaly: null,
      anomalyAdjustment: { fuelDelta: 0, powerDelta: 0 },
      telemetry: {
        ...INITIAL_TELEMETRY,
        distanceToMoonKm: mission.distanceKm,
      },
      discoverables: createInitialDiscoverables(missionId),
      scienceScore: 0,
      missionElapsedSec: 0,
      flightRunId: state.flightRunId + 1,
      notificationText: null,
    }));
  },

  incrementElapsed: (simDt, realDt) => {
    const state = get();
    if (state.missionFailed) return;
    const realStep = realDt ?? simDt;
    let nextRemaining = state.remainingTimeSec;
    const timerActive =
      state.timedMode &&
      (state.page === "lunar" ||
        (state.page === "flight" && state.flightStage !== "pad"));

    if (timerActive) {
      nextRemaining = Math.max(0, state.remainingTimeSec - realStep);
      if (nextRemaining <= 0) {
        get().triggerSystemFailure(
          "Mission timer expired before completing planetary sample return to Earth."
        );
        return;
      }
    }

    set({
      missionElapsedSec: state.missionElapsedSec + simDt,
      remainingTimeSec: nextRemaining,
    });
  },

  loadNeoFeed: async (forceRefresh = false) => {
    set({ neoLoading: true });
    const feed = await fetchNeoFeed(forceRefresh);
    set({
      neoFeed: feed,
      neoLoading: false,
      neoError: feed.source === "sample-fallback" ? feed.note : null,
    });
  },

  applySyncedPlan: (plan) =>
    set((state) => {
      const mission =
        MISSIONS.find((m) => m.id === plan.selectedMissionId) || MISSIONS[0];
      const spacecraft = buildSpacecraftFromIds(plan.installedIds, {
        difficulty: plan.difficulty,
        objectiveId: plan.objectiveId,
        launchVehicleId: plan.launchVehicleId,
        orbitId: plan.orbitId,
      });
      return {
        selectedMissionId: plan.selectedMissionId,
        difficulty: plan.difficulty,
        objectiveId: plan.objectiveId,
        launchVehicleId: plan.launchVehicleId,
        orbitId: plan.orbitId,
        teamMode: plan.teamMode,
        teamSize: plan.teamSize,
        teamMembers: plan.teamMembers.map((m) => ({ ...m })),
        timedMode: plan.timedMode,
        timeLimitSec: plan.timeLimitSec,
        remainingTimeSec: plan.timeLimitSec,
        spacecraft,
        discoverables: createInitialDiscoverables(plan.selectedMissionId),
        telemetry: {
          ...state.telemetry,
          distanceToMoonKm: mission.distanceKm,
        },
      };
    }),

  saveCurrentBlueprint: (name) => {
    const state = get();
    const bp: SpacecraftBlueprint = {
      id: `bp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: name.trim() || `${state.selectedMissionId === "explore-mars" ? "Mars" : "Lunar"} Concept`,
      createdAt: new Date().toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      missionId: state.selectedMissionId,
      difficulty: state.difficulty,
      objectiveId: state.objectiveId,
      launchVehicleId: state.launchVehicleId,
      orbitId: state.orbitId,
      installedIds: [...state.spacecraft.installedIds],
      teamMode: state.teamMode,
      teamSize: state.teamSize,
      summary: {
        massKg: state.spacecraft.resources.massKg,
        powerReserveW: state.spacecraft.resources.powerReserveW,
        sciencePoints: state.spacecraft.resources.sciencePoints,
        communicationMbps: state.spacecraft.resources.communicationMbps,
        creditsRemaining: state.spacecraft.resources.creditsRemaining,
      },
    };
    const next = [bp, ...state.savedBlueprints].slice(0, 16);
    saveStoredJson(BLUEPRINTS_STORAGE_KEY, next);
    set({
      savedBlueprints: next,
      notificationText: `Blueprint saved: ${bp.name}`,
    });
    return bp;
  },

  loadBlueprint: (bp) =>
    set((state) => {
      const options: MissionPlanOptions = {
        difficulty: bp.difficulty,
        objectiveId: bp.objectiveId,
        launchVehicleId: bp.launchVehicleId,
        orbitId: bp.orbitId,
      };
      const spacecraft = buildSpacecraftFromIds(bp.installedIds, options);
      const mission =
        MISSIONS.find((m) => m.id === bp.missionId) || MISSIONS[0];
      return {
        selectedMissionId: bp.missionId,
        difficulty: bp.difficulty,
        objectiveId: bp.objectiveId,
        launchVehicleId: bp.launchVehicleId,
        orbitId: bp.orbitId,
        teamMode: bp.teamMode,
        teamSize: bp.teamSize,
        spacecraft,
        discoverables: createInitialDiscoverables(bp.missionId),
        telemetry: {
          ...state.telemetry,
          distanceToMoonKm: mission.distanceKm,
        },
        notificationText: `Loaded mission design: ${bp.name}`,
      };
    }),

  importBlueprintJson: (raw) => {
    try {
      const parsed = JSON.parse(raw) as Partial<SpacecraftBlueprint>;
      if (!Array.isArray(parsed.installedIds) || !parsed.launchVehicleId || !parsed.orbitId) {
        return { ok: false, message: "Invalid mission blueprint code format." };
      }
      const missionId: MissionDefinition["id"] =
        parsed.missionId === "explore-mars" ? "explore-mars" : "explore-moon";
      const difficulty: DifficultyLevel =
        parsed.difficulty === "cadet" || parsed.difficulty === "director"
          ? parsed.difficulty
          : "engineer";
      const objectiveId: MissionObjectiveId =
        parsed.objectiveId === "max-science" || parsed.objectiveId === "rapid-endurance"
          ? parsed.objectiveId
          : "balanced-recon";
      const calc = calculateSpacecraft(parsed.installedIds, {
        difficulty,
        objectiveId,
        launchVehicleId: parsed.launchVehicleId,
        orbitId: parsed.orbitId,
      });
      const bp: SpacecraftBlueprint = {
        id: `bp-imp-${Date.now()}`,
        name: parsed.name || "Imported Design",
        createdAt: "Imported",
        missionId,
        difficulty,
        objectiveId,
        launchVehicleId: parsed.launchVehicleId,
        orbitId: parsed.orbitId,
        installedIds: parsed.installedIds,
        teamMode: parsed.teamMode === "team" ? "team" : "solo",
        teamSize: parsed.teamSize || 1,
        summary: {
          massKg: calc.resources.massKg,
          powerReserveW: calc.resources.powerReserveW,
          sciencePoints: calc.resources.sciencePoints,
          communicationMbps: calc.resources.communicationMbps,
          creditsRemaining: calc.resources.creditsRemaining,
        },
      };
      const state = get();
      const next = [bp, ...state.savedBlueprints].slice(0, 16);
      saveStoredJson(BLUEPRINTS_STORAGE_KEY, next);
      set({ savedBlueprints: next });
      get().loadBlueprint(bp);
      return { ok: true, message: `Imported and loaded "${bp.name}".` };
    } catch {
      return { ok: false, message: "Could not parse blueprint JSON." };
    }
  },

  deleteBlueprint: (id) =>
    set((state) => {
      const next = state.savedBlueprints.filter((b) => b.id !== id);
      saveStoredJson(BLUEPRINTS_STORAGE_KEY, next);
      return { savedBlueprints: next };
    }),
}));
