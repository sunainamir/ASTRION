export type GamePage =
  | "home"
  | "missions"
  | "prepare"
  | "module"
  | "briefing"
  | "launch"
  | "flight"
  | "lunar"
  | "complete";

export type PrepareModule =
  | "LAUNCH, ORBIT & TEAM"
  | "BUILD YOUR SPACESHIP"
  | "SURVIVAL ESSENTIALS"
  | "RESEARCH EQUIPMENTS"
  | "LATEST RESEARCH GALLERY"
  | "MISSION ARCHIVE & COMPARE";

export type DifficultyLevel = "cadet" | "engineer" | "director";

export type MissionObjectiveId =
  | "balanced-recon"
  | "max-science"
  | "rapid-endurance";

export type TeamRoleId =
  | "flight-director"
  | "systems-engineer"
  | "payload-scientist"
  | "comms-navigator";

export type RoleStance = "safety" | "science" | "efficiency";

export interface TeamMemberConfig {
  roleId: TeamRoleId;
  roleTitle: string;
  playerName: string;
  responsibility: string;
  stance: RoleStance;
  approved: boolean;
}

export interface LaunchVehicleDef {
  id: "vanguard-light" | "ares-medium" | "saturn-heavy";
  name: string;
  tier: string;
  costCr: number;
  maxPayloadKg: number;
  fuelBonusPct: number;
  thrustMultiplier: number;
  description: string;
  tradeoffNote: string;
}

export interface OrbitProfileDef {
  id: "direct-hohmann" | "low-science" | "high-relay";
  name: string;
  altitudeLabel: string;
  missionDays: number;
  opsCostCr: number;
  scienceMultiplier: number;
  commsBonusMbps: number;
  fuelBurnFactor: number;
  radiationHazard: "LOW" | "MODERATE" | "HIGH";
  description: string;
  tradeoffNote: string;
}

export interface FlightAnomalyOption {
  id: string;
  label: string;
  effectSummary: string;
  fuelDelta?: number;
  powerDelta?: number;
  hullDelta?: number;
  scienceDelta?: number;
  requiresComponentId?: string;
}

export interface FlightAnomalyEvent {
  id: string;
  title: string;
  responsibleRole: TeamRoleId;
  description: string;
  educationalNote: string;
  options: FlightAnomalyOption[];
}

export interface SpacecraftBlueprint {
  id: string;
  name: string;
  createdAt: string;
  missionId: "explore-moon" | "explore-mars";
  difficulty: DifficultyLevel;
  objectiveId: MissionObjectiveId;
  launchVehicleId: LaunchVehicleDef["id"];
  orbitId: OrbitProfileDef["id"];
  installedIds: string[];
  teamMode: "solo" | "team";
  teamSize: number;
  summary: {
    massKg: number;
    powerReserveW: number;
    sciencePoints: number;
    communicationMbps: number;
    creditsRemaining: number;
  };
}

export interface DataTransmissionSummary {
  instrumentDataGb: number;
  sampleDataGb: number;
  photoDataGb: number;
  generatedDataGb: number;
  storageCapacityGb: number;
  downlinkCapacityGb: number;
  transmittedDataGb: number;
  lostDataGb: number;
  transmissionEfficiencyPct: number;
  rawScienceScore: number;
  effectiveScienceScore: number;
}

export interface ActiveNeoInfo {
  id: string;
  name: string;
  diameterM: number;
  velocityKmS: number;
  missDistanceKm: number;
  hazardous: boolean;
  sourceLabel: string;
}

export interface SavedMissionRecord {
  id: string;
  timestamp: string;
  missionId: "explore-moon" | "explore-mars";
  missionName: string;
  destination: "Moon" | "Mars";
  difficulty: DifficultyLevel;
  objectiveId: MissionObjectiveId;
  launchVehicleId: LaunchVehicleDef["id"];
  orbitId: OrbitProfileDef["id"];
  teamMode: "solo" | "team";
  teamNames: string[];
  timedMode: boolean;
  timeLimitSec: number;
  status: "SUCCESS" | "FAILED";
  failReason?: string;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  totalScore: number;
  scienceScore: number;
  elapsedSec: number;
  hullPct: number;
  fuelPct: number;
  powerPct: number;
  samplesCollected: number;
  photosCount: number;
  installedIds: string[];
  massKg: number;
  creditsSpent: number;
  dataTransmission?: DataTransmissionSummary;
}

export type CameraMode = "cockpit" | "rear" | "front";
export type LunarCameraMode = "third-person" | "visor";

export type FlightStage =
  | "pad"
  | "ignition"
  | "ascent"
  | "space-travel"
  | "asteroids"
  | "moon-approach"
  | "moon-landing"
  | "moon-launch"
  | "earth-return"
  | "earth-reentry";

export interface MissionDefinition {
  id: "explore-moon" | "explore-mars";
  name: string;
  subtitle: string;
  destination: "Moon" | "Mars";
  distanceKm: number;
  landingSite: string;
  hazardLevel: "MODERATE" | "HIGH";
  description: string;
  requiredSciencePoints: number;
  asteroidWaveCount: number;
}

export interface SpacecraftComponent {
  id: string;
  name: string;
  category:
    | "POWER"
    | "COMMUNICATION"
    | "AVIONICS"
    | "PROPULSION"
    | "LANDING"
    | "EXPLORATION"
    | "SCIENCE"
    | "DATA"
    | "PROTECTION";
  price: number;
  massKg: number;
  powerOutputW: number;
  powerDrawW: number;
  batteryCapacityWh: number;
  dataGbPerDay: number;
  storageGb: number;
  communicationMbps: number;
  sciencePoints: number;
  description: string;
}

export interface SpacecraftResources {
  creditsSpent: number;
  creditsRemaining: number;
  massKg: number;
  massLimitKg: number;
  massRemainingKg: number;
  powerGenerationW: number;
  powerConsumptionW: number;
  powerReserveW: number;
  batteryCapacityWh: number;
  estimatedEnduranceDays: number;
  dataGenerationGbPerDay: number;
  totalMissionDataGb: number;
  dataStorageGb: number;
  dailyTransmissionCapacityGb: number;
  communicationMbps: number;
  sciencePoints: number;
  installedCount: number;
}

export interface SpacecraftValidation {
  ready: boolean;
  errors: string[];
  warnings: string[];
  resources: SpacecraftResources;
  installedComponents: SpacecraftComponent[];
}

export interface BuiltSpacecraft {
  installedIds: string[];
  installedComponents: SpacecraftComponent[];
  resources: SpacecraftResources;
  validation: SpacecraftValidation;
}

export interface FlightTelemetry {
  altitudeKm: number;
  speedMs: number;
  fuelPct: number;
  powerPct: number;
  hullPct: number;
  heading: number;
  pitch: number;
  distanceToMoonKm: number;
  distanceToEarthKm: number;
  journeyProgress: number; // 0 to 1
  asteroidProgress: number; // 0 to 1
  asteroidsAvoided: number;
  asteroidHits: number;
  phaseLabel: string;
  activeNeo: ActiveNeoInfo | null;
}

export interface SurvivalKitConfig {
  oxygenReserveLevel: 1 | 2 | 3;
  thermalSuitGrade: 1 | 2 | 3;
  jetpackThrusterBoost: boolean;
}

export interface LunarDiscoverable {
  id: string;
  title: string;
  kind: "sample" | "relic";
  description: string;
  scienceValue: number;
  position: [number, number, number];
  collected: boolean;
  photographed: boolean;
}

export interface CapturedPhoto {
  id: string;
  title: string;
  caption: string;
  dataUrl: string;
  timestamp: string;
  missionName: string;
  location: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}
