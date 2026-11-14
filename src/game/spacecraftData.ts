import type {
  DifficultyLevel,
  FlightAnomalyEvent,
  LaunchVehicleDef,
  MissionDefinition,
  MissionObjectiveId,
  OrbitProfileDef,
  SpacecraftComponent,
  TeamMemberConfig,
} from "../types/game";

export const GAME_CONFIG = {
  startingCredits: 1680,
  baseMassKg: 85,
  basePowerDrawW: 25,
  maxMassKg: 500,
  requiredPowerReserveW: 15,
  requiredCommunicationMbps: 5,
  requiredSciencePoints: 25,
  missionDurationDays: 14,
  currency: "CR",
};

export const DIFFICULTY_CONFIGS: Record<
  DifficultyLevel,
  {
    id: DifficultyLevel;
    label: string;
    startingCredits: number;
    maxMassScale: number;
    hazardIntensity: number;
    scoreMultiplier: number;
    description: string;
  }
> = {
  cadet: {
    id: "cadet",
    label: "CADET (GUIDED)",
    startingCredits: 2000,
    maxMassScale: 1.15,
    hazardIntensity: 0.78,
    scoreMultiplier: 0.9,
    description:
      "Generous budget and mass margin with lighter orbital hazards—ideal for learning how subsystems interact.",
  },
  engineer: {
    id: "engineer",
    label: "ENGINEER (STANDARD)",
    startingCredits: 1680,
    maxMassScale: 1.0,
    hazardIntensity: 1.0,
    scoreMultiplier: 1.0,
    description:
      "Balanced aerospace constraints requiring careful trade-offs between payload science, power, mass, and cost.",
  },
  director: {
    id: "director",
    label: "DIRECTOR (REALISTIC)",
    startingCredits: 1350,
    maxMassScale: 0.88,
    hazardIntensity: 1.25,
    scoreMultiplier: 1.4,
    description:
      "Tight budgets, strict payload mass ceilings, and severe space weather anomalies for maximum engineering challenge.",
  },
};

export const MISSION_OBJECTIVES: Record<
  MissionObjectiveId,
  {
    id: MissionObjectiveId;
    name: string;
    requiredScienceBonus: number;
    requiredCommsMin: number;
    scienceRewardMultiplier: number;
    fuelEfficiencyTarget: number;
    description: string;
    tradeoffHint: string;
  }
> = {
  "balanced-recon": {
    id: "balanced-recon",
    name: "Balanced Reconnaissance",
    requiredScienceBonus: 0,
    requiredCommsMin: 5,
    scienceRewardMultiplier: 1.0,
    fuelEfficiencyTarget: 20,
    description:
      "Achieve reliable surface landing, sample return, and imagery while keeping mass and budget balanced.",
    tradeoffHint: "Standard science & comms baselines with moderate risk.",
  },
  "max-science": {
    id: "max-science",
    name: "Maximum Science Yield",
    requiredScienceBonus: 30,
    requiredCommsMin: 10,
    scienceRewardMultiplier: 1.35,
    fuelEfficiencyTarget: 15,
    description:
      "Prioritize heavy spectrometers, drills, and high-rate data downlink for maximum scientific return (+35% Science Score).",
    tradeoffHint: "Extra instruments increase mass, power draw, and data storage needs.",
  },
  "rapid-endurance": {
    id: "rapid-endurance",
    name: "Rapid Transit & Efficiency",
    requiredScienceBonus: -5,
    requiredCommsMin: 5,
    scienceRewardMultiplier: 0.95,
    fuelEfficiencyTarget: 45,
    description:
      "Design a lean spacecraft that completes the round trip rapidly with high remaining fuel and power reserves.",
    tradeoffHint: "Favors lightweight payloads, strong propulsion, and surplus power.",
  },
};

export const LAUNCH_VEHICLES: LaunchVehicleDef[] = [
  {
    id: "vanguard-light",
    name: "Vanguard Light-Lift",
    tier: "LIGHT CLASS",
    costCr: 150,
    maxPayloadKg: 340,
    fuelBonusPct: 0,
    thrustMultiplier: 0.9,
    description:
      "Compact, economical launcher suited for lean, carefully budgeted probes.",
    tradeoffNote:
      "Saves budget (+130–270 CR vs heavier rockets) but strictly caps total spacecraft mass at 340 KG.",
  },
  {
    id: "ares-medium",
    name: "Ares Medium Heavy",
    tier: "MEDIUM CLASS",
    costCr: 280,
    maxPayloadKg: 500,
    fuelBonusPct: 10,
    thrustMultiplier: 1.05,
    description:
      "Balanced orbital launch stack offering 500 KG capacity and +10% upper-stage propellant margin.",
    tradeoffNote:
      "Versatile workhorse balancing launch cost against science instrument capacity.",
  },
  {
    id: "saturn-heavy",
    name: "Saturn V Super-Heavy",
    tier: "HEAVY CLASS",
    costCr: 430,
    maxPayloadKg: 700,
    fuelBonusPct: 22,
    thrustMultiplier: 1.25,
    description:
      "Super-heavy interplanetary booster capable of lifting 700 KG payloads with faster escape thrust and +22% fuel margin.",
    tradeoffNote:
      "High launch cost leaves less budget for onboard instruments—requires smart cost discipline.",
  },
];

export const ORBIT_PROFILES: OrbitProfileDef[] = [
  {
    id: "direct-hohmann",
    name: "Direct Hohmann Transfer",
    altitudeLabel: "180 KM PARKING → DIRECT TRANSFER",
    missionDays: 14,
    opsCostCr: 0,
    scienceMultiplier: 1.0,
    commsBonusMbps: 0,
    fuelBurnFactor: 1.0,
    radiationHazard: "MODERATE",
    description:
      "Standard minimum-energy transfer trajectory balancing transit duration, fuel burn, and downlink stability.",
    tradeoffNote: "Baseline fuel consumption, 14-day mission endurance, and nominal radiation.",
  },
  {
    id: "low-science",
    name: "Low-Altitude Science Orbit",
    altitudeLabel: "65 KM LOW PLANETARY ORBIT",
    missionDays: 21,
    opsCostCr: 75,
    scienceMultiplier: 1.3,
    commsBonusMbps: -2,
    fuelBurnFactor: 1.22,
    radiationHazard: "LOW",
    description:
      "Extended 21-day close-range mapping pass yielding +30% scientific observation value before touchdown.",
    tradeoffNote:
      "Longer 21-day lifetime demands more data storage & power endurance, plus +22% fuel for low-orbit capture.",
  },
  {
    id: "high-relay",
    name: "High-Altitude Relay Orbit",
    altitudeLabel: "4,200 KM POLAR RELAY ORBIT",
    missionDays: 10,
    opsCostCr: 60,
    scienceMultiplier: 0.9,
    commsBonusMbps: 6,
    fuelBurnFactor: 0.85,
    radiationHazard: "HIGH",
    description:
      "Fast 10-day high-altitude insertion with uninterrupted +6 Mbps line-of-sight communications to Earth.",
    tradeoffNote:
      "Saves fuel (-15%) and boosts comms, but exposes hull to elevated cosmic radiation.",
  },
];

export const DEFAULT_TEAM_MEMBERS: TeamMemberConfig[] = [
  {
    roleId: "flight-director",
    roleTitle: "Flight Director",
    playerName: "Commander Alex",
    responsibility: "Mission objective, difficulty, launch vehicle & final Go/No-Go authority",
    stance: "safety",
    approved: true,
  },
  {
    roleId: "systems-engineer",
    roleTitle: "Systems Engineer",
    playerName: "Eng. Maya",
    responsibility: "Mass ceiling, power generation balance, battery endurance & thermal protection",
    stance: "efficiency",
    approved: true,
  },
  {
    roleId: "payload-scientist",
    roleTitle: "Payload Scientist",
    playerName: "Dr. Liam",
    responsibility: "Scientific instruments, data generation rate & surface specimen targets",
    stance: "science",
    approved: true,
  },
  {
    roleId: "comms-navigator",
    roleTitle: "Comms & Nav Officer",
    playerName: "Nav. Priya",
    responsibility: "Orbit profile selection, flight computer guidance & Earth downlink bandwidth",
    stance: "safety",
    approved: true,
  },
];

export const EDUCATIONAL_CONCEPTS: Array<{
  topic: string;
  summary: string;
  tradeoff: string;
}> = [
  {
    topic: "Mass vs. Launch Vehicle",
    summary:
      "Every extra kilogram on the spacecraft requires exponentially more propellant to lift out of Earth's gravity well.",
    tradeoff:
      "Exceeding your launch vehicle's max payload rating stresses booster staging and sharply increases ascent propellant burn.",
  },
  {
    topic: "Power Budget & Endurance",
    summary:
      "Solar arrays generate Watts continuously in sunlight, while batteries carry load when power draw spikes or sunlight fades.",
    tradeoff:
      "High-yield instruments (Spectrometers, Drills, Radar) draw heavy wattage—adding science can starve avionics if power reserve turns negative.",
  },
  {
    topic: "Data Generation vs. Communications",
    summary:
      "Instruments generate gigabytes (GB) of data daily that must either be stored onboard or transmitted back at your Mbps downlink speed.",
    tradeoff:
      "Selecting a 21-day Low Science Orbit multiplies total mission data—without Data Storage Units or a High-Gain Antenna, observations bottle up.",
  },
  {
    topic: "Orbit Selection Trade-Offs",
    summary:
      "Orbital altitude governs how long you observe a world, how clear your radio link to Earth is, and how much delta-V fuel braking takes.",
    tradeoff:
      "Low orbits boost science resolution (+30%) at higher fuel cost; high relay orbits preserve fuel and boost comms (+6 Mbps) with higher radiation.",
  },
];

export const FLIGHT_ANOMALIES: FlightAnomalyEvent[] = [
  {
    id: "solar-flare",
    title: "CORONAL MASS EJECTION ALERT",
    responsibleRole: "systems-engineer",
    description:
      "Solar particle flux is spiking across your transit corridor. Unmitigated exposure will degrade hull plating and avionics.",
    educationalNote:
      "Space weather forces engineers to trade electrical power reserve for active shielding or accept hardware degradation.",
    options: [
      {
        id: "divert-shield",
        label: "Divert Power to Magnetic Shielding",
        effectSummary: "-16% Power · Protects Hull (+0 damage)",
        powerDelta: -16,
        hullDelta: 0,
      },
      {
        id: "coast-safe",
        label: "Power Down Non-Essentials & Coast",
        effectSummary: "-8% Fuel · -10 Science · +4% Power",
        fuelDelta: -8,
        scienceDelta: -10,
        powerDelta: 4,
      },
      {
        id: "brace-impact",
        label: "Hold Course & Rely on Hull Armor",
        effectSummary: "-18% Hull (mitigated if Shield installed) · +25 Bonus Science",
        hullDelta: -18,
        scienceDelta: 25,
      },
    ],
  },
  {
    id: "comms-window",
    title: "DEEP-SPACE TELEMETRY CONGESTION",
    responsibleRole: "comms-navigator",
    description:
      "Data buffers are filling faster than scheduled Earth tracking station windows. Mission Control requests a downlink strategy.",
    educationalNote:
      "When onboard instruments produce data faster than your Mbps link, teams trade electrical power or data fidelity.",
    options: [
      {
        id: "high-gain-burst",
        label: "Execute High-Power Burst Downlink",
        effectSummary: "-14% Power · +60 Bonus Science",
        powerDelta: -14,
        scienceDelta: 60,
        requiresComponentId: "high-gain-antenna",
      },
      {
        id: "compress-data",
        label: "Run Lossy Onboard Compression",
        effectSummary: "-4% Power · +15 Science",
        powerDelta: -4,
        scienceDelta: 15,
      },
      {
        id: "store-buffer",
        label: "Buffer Data Until Surface EVA",
        effectSummary: "0% Power · -15 Science if low storage",
        scienceDelta: 10,
      },
    ],
  },
  {
    id: "course-drift",
    title: "TRAJECTORY PERTURBATION DETECTED",
    responsibleRole: "flight-director",
    description:
      "Gravitational shear has shifted your approach corridor by 1.4 degrees. Correcting early preserves landing accuracy.",
    educationalNote:
      "Early mid-course delta-V corrections spend modest fuel to prevent costly braking maneuvers near the target world.",
    options: [
      {
        id: "rcs-burn",
        label: "Execute Precision Mid-Course Burn",
        effectSummary: "-10% Fuel · +45 Navigation Science",
        fuelDelta: -10,
        scienceDelta: 45,
      },
      {
        id: "gravity-assist",
        label: "Use Gravity-Gradient Trim (Computer Assisted)",
        effectSummary: "-3% Fuel · -6% Power · +20 Science",
        fuelDelta: -3,
        powerDelta: -6,
        scienceDelta: 20,
      },
    ],
  },
];


export const MISSION_PROFILE = {
  id: "moon-research",
  name: "LUNAR SURFACE RESEARCH",
  destination: "MOON",
  objective:
    "Launch from Earth, navigate the cislunar corridor, land on the target world, collect geological samples, and return safely.",
  requirements: {
    minSciencePoints: 25,
    minCommunicationMbps: 5,
    minPowerReserveW: 15,
    missionDurationDays: 14,
  },
};

export const MISSIONS: MissionDefinition[] = [
  {
    id: "explore-moon",
    name: "Explore Moon",
    subtitle: "Lunar Landing & Return",
    destination: "Moon",
    distanceKm: 384400,
    landingSite: "Mare Tranquillitatis · 0.67° N, 23.47° E",
    hazardLevel: "MODERATE",
    description:
      "Launch Saturn V from Earth, navigate the cislunar asteroid corridor, land on the Moon, collect samples & historical imagery, and return home.",
    requiredSciencePoints: 25,
    asteroidWaveCount: 22,
  },
  {
    id: "explore-mars",
    name: "Explore Mars",
    subtitle: "Deep-Space Landing & Return",
    destination: "Mars",
    distanceKm: 225000000,
    landingSite: "Jezero Crater Delta · 18.38° N, 77.58° E",
    hazardLevel: "HIGH",
    description:
      "Long-range interplanetary expedition to the Red Planet. Survive a dense asteroid field, touch down in Jezero Crater, gather Martian specimens, and return to Earth.",
    requiredSciencePoints: 35,
    asteroidWaveCount: 30,
  },
];

export const RECOMMENDED_LOADOUT_IDS: string[] = [
  "solar-array",
  "battery",
  "high-gain-antenna",
  "onboard-computer",
  "propulsion-module",
  "fuel-tank",
  "thermal-control",
  "radiation-shield",
  "landing-gear",
  "scientific-camera",
  "robotic-arm",
  "data-storage",
  "data-storage",
];

export const SPACECRAFT_COMPONENTS: SpacecraftComponent[] = [
  {
    id: "solar-array",
    name: "Solar Array",
    category: "POWER",
    price: 120,
    massKg: 18,
    powerOutputW: 180,
    powerDrawW: 0,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Generates electrical power from sunlight.",
  },
  {
    id: "battery",
    name: "Power Battery",
    category: "POWER",
    price: 100,
    massKg: 15,
    powerOutputW: 0,
    powerDrawW: 0,
    batteryCapacityWh: 900,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Stores electrical energy for periods without sunlight.",
  },
  {
    id: "high-gain-antenna",
    name: "High-Gain Antenna",
    category: "COMMUNICATION",
    price: 90,
    massKg: 8,
    powerOutputW: 0,
    powerDrawW: 15,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 12,
    sciencePoints: 0,
    description: "Provides a high-capacity link to Earth.",
  },
  {
    id: "relay-transmitter",
    name: "Relay Transmitter",
    category: "COMMUNICATION",
    price: 65,
    massKg: 5,
    powerOutputW: 0,
    powerDrawW: 8,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 4,
    sciencePoints: 0,
    description: "Provides a basic communication link.",
  },
  {
    id: "onboard-computer",
    name: "Flight Computer",
    category: "AVIONICS",
    price: 100,
    massKg: 12,
    powerOutputW: 0,
    powerDrawW: 20,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Controls spacecraft systems and navigation guidance.",
  },
  {
    id: "attitude-control",
    name: "Attitude Control System",
    category: "AVIONICS",
    price: 110,
    massKg: 20,
    powerOutputW: 0,
    powerDrawW: 30,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Improves spacecraft steering responsiveness and RCS stability.",
  },
  {
    id: "propulsion-module",
    name: "Propulsion Module",
    category: "PROPULSION",
    price: 160,
    massKg: 35,
    powerOutputW: 0,
    powerDrawW: 25,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Provides thrust for orbital escape and deep-space burns.",
  },
  {
    id: "fuel-tank",
    name: "Propellant Tank",
    category: "PROPULSION",
    price: 90,
    massKg: 25,
    powerOutputW: 0,
    powerDrawW: 0,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Increases propellant reserves for launch and return burns.",
  },
  {
    id: "scientific-camera",
    name: "Scientific Camera",
    category: "SCIENCE",
    price: 80,
    massKg: 8,
    powerOutputW: 0,
    powerDrawW: 12,
    batteryCapacityWh: 0,
    dataGbPerDay: 2,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 15,
    description: "Captures detailed images of planetary surfaces.",
  },
  {
    id: "spectrometer",
    name: "Spectrometer",
    category: "SCIENCE",
    price: 140,
    massKg: 18,
    powerOutputW: 0,
    powerDrawW: 35,
    batteryCapacityWh: 0,
    dataGbPerDay: 8,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 30,
    description: "Studies the composition of surface materials.",
  },
  {
    id: "radar-instrument",
    name: "Surface Radar",
    category: "SCIENCE",
    price: 125,
    massKg: 16,
    powerOutputW: 0,
    powerDrawW: 28,
    batteryCapacityWh: 0,
    dataGbPerDay: 6,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 24,
    description: "Investigates surface structure and subsurface features.",
  },
  {
    id: "data-storage",
    name: "Data Storage Unit",
    category: "DATA",
    price: 70,
    massKg: 5,
    powerOutputW: 0,
    powerDrawW: 5,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 100,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Stores scientific observations and photographs before transmission.",
  },
  {
    id: "thermal-control",
    name: "Thermal Control System",
    category: "PROTECTION",
    price: 110,
    massKg: 14,
    powerOutputW: 0,
    powerDrawW: 18,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Maintains safe operating temperatures and re-entry heat shielding.",
  },
  {
    id: "radiation-shield",
    name: "Radiation & Micrometeoroid Shield",
    category: "PROTECTION",
    price: 85,
    massKg: 12,
    powerOutputW: 0,
    powerDrawW: 0,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Reduces hull damage from asteroid and debris impacts.",
  },
  {
    id: "landing-gear",
    name: "Planetary Landing Gear",
    category: "LANDING",
    price: 130,
    massKg: 22,
    powerOutputW: 0,
    powerDrawW: 5,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 0,
    description: "Absorbs touchdown forces during planetary landings.",
  },
  {
    id: "landing-radar",
    name: "Landing Radar",
    category: "LANDING",
    price: 105,
    massKg: 10,
    powerOutputW: 0,
    powerDrawW: 14,
    batteryCapacityWh: 0,
    dataGbPerDay: 1,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 5,
    description: "Measures altitude and identifies safe landing areas.",
  },
  {
    id: "robotic-arm",
    name: "Robotic Sampling Arm",
    category: "EXPLORATION",
    price: 150,
    massKg: 18,
    powerOutputW: 0,
    powerDrawW: 25,
    batteryCapacityWh: 0,
    dataGbPerDay: 2,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 20,
    description: "Collects planetary soil and rock samples.",
  },
  {
    id: "lunar-drill",
    name: "Surface Core Drill",
    category: "EXPLORATION",
    price: 145,
    massKg: 20,
    powerOutputW: 0,
    powerDrawW: 32,
    batteryCapacityWh: 0,
    dataGbPerDay: 3,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 25,
    description: "Drills into the surface to collect deep core samples.",
  },
  {
    id: "micro-rover",
    name: "Mini Exploration Rover",
    category: "EXPLORATION",
    price: 220,
    massKg: 35,
    powerOutputW: 0,
    powerDrawW: 35,
    batteryCapacityWh: 0,
    dataGbPerDay: 5,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 30,
    description: "Extends surface exploration telemetry and science yield.",
  },
  {
    id: "radiation-sensor",
    name: "Radiation Sensor",
    category: "SCIENCE",
    price: 95,
    massKg: 7,
    powerOutputW: 0,
    powerDrawW: 8,
    batteryCapacityWh: 0,
    dataGbPerDay: 2,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 12,
    description: "Measures radiation levels around the spacecraft.",
  },
  {
    id: "panoramic-camera",
    name: "Panoramic Camera",
    category: "SCIENCE",
    price: 115,
    massKg: 9,
    powerOutputW: 0,
    powerDrawW: 16,
    batteryCapacityWh: 0,
    dataGbPerDay: 4,
    storageGb: 0,
    communicationMbps: 0,
    sciencePoints: 18,
    description: "Captures wide-angle images of the surface landscape.",
  },
  {
    id: "navigation-beacon",
    name: "Navigation Beacon",
    category: "AVIONICS",
    price: 85,
    massKg: 6,
    powerOutputW: 0,
    powerDrawW: 7,
    batteryCapacityWh: 0,
    dataGbPerDay: 0,
    storageGb: 0,
    communicationMbps: 2,
    sciencePoints: 0,
    description: "Supports spacecraft positioning and asteroid radar tracking.",
  },
];

export const COMPONENT_CATEGORIES = [
  "ALL",
  "POWER",
  "COMMUNICATION",
  "AVIONICS",
  "PROPULSION",
  "LANDING",
  "EXPLORATION",
  "SCIENCE",
  "DATA",
  "PROTECTION",
] as const;
