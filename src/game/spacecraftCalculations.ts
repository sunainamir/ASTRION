import type {
  DifficultyLevel,
  LaunchVehicleDef,
  MissionObjectiveId,
  OrbitProfileDef,
  SpacecraftComponent,
  SpacecraftResources,
  SpacecraftValidation,
} from "../types/game";
import {
  DIFFICULTY_CONFIGS,
  GAME_CONFIG,
  LAUNCH_VEHICLES,
  MISSION_OBJECTIVES,
  MISSION_PROFILE,
  ORBIT_PROFILES,
  SPACECRAFT_COMPONENTS,
} from "./spacecraftData";

export interface MissionPlanOptions {
  difficulty?: DifficultyLevel;
  objectiveId?: MissionObjectiveId;
  launchVehicleId?: LaunchVehicleDef["id"];
  orbitId?: OrbitProfileDef["id"];
}

export function resolveMissionPlan(options: MissionPlanOptions = {}) {
  const difficulty = DIFFICULTY_CONFIGS[options.difficulty || "engineer"];
  const objective = MISSION_OBJECTIVES[options.objectiveId || "balanced-recon"];
  const vehicle =
    LAUNCH_VEHICLES.find((v) => v.id === options.launchVehicleId) ||
    LAUNCH_VEHICLES[1]; // Ares Medium Heavy default
  const orbit =
    ORBIT_PROFILES.find((o) => o.id === options.orbitId) ||
    ORBIT_PROFILES[0]; // Direct Hohmann default

  return { difficulty, objective, vehicle, orbit };
}

export function calculateSpacecraft(
  installedComponentIds: string[] = [],
  options: MissionPlanOptions = {}
): {
  installedComponents: SpacecraftComponent[];
  unknownComponentIds: string[];
  resources: SpacecraftResources;
} {
  const { difficulty, vehicle, orbit } = resolveMissionPlan(options);

  const installedComponents = installedComponentIds
    .map((id) => SPACECRAFT_COMPONENTS.find((component) => component.id === id))
    .filter((c): c is SpacecraftComponent => Boolean(c));

  const unknownComponentIds = installedComponentIds.filter(
    (id) => !SPACECRAFT_COMPONENTS.some((component) => component.id === id)
  );

  const totals = installedComponents.reduce(
    (result, component) => ({
      cost: result.cost + component.price,
      mass: result.mass + component.massKg,
      powerGeneration: result.powerGeneration + component.powerOutputW,
      powerConsumption: result.powerConsumption + component.powerDrawW,
      batteryCapacity: result.batteryCapacity + component.batteryCapacityWh,
      dailyData: result.dailyData + component.dataGbPerDay,
      storage: result.storage + component.storageGb,
      communication: result.communication + component.communicationMbps,
      science: result.science + component.sciencePoints,
    }),
    {
      cost: 0,
      mass: 0,
      powerGeneration: 0,
      powerConsumption: 0,
      batteryCapacity: 0,
      dailyData: 0,
      storage: 0,
      communication: 0,
      science: 0,
    }
  );

  const totalMassKg = GAME_CONFIG.baseMassKg + totals.mass;
  const effectiveMassLimitKg = Math.round(
    vehicle.maxPayloadKg * difficulty.maxMassScale
  );
  const totalPowerDrawW = GAME_CONFIG.basePowerDrawW + totals.powerConsumption;
  const powerReserveW = totals.powerGeneration - totalPowerDrawW;

  const totalCreditsSpent = totals.cost + vehicle.costCr + orbit.opsCostCr;
  const remainingCredits = difficulty.startingCredits - totalCreditsSpent;

  const missionDays = orbit.missionDays;
  const effectiveCommsMbps = Math.max(
    0,
    totals.communication + (totals.communication > 0 ? orbit.commsBonusMbps : 0)
  );
  const dailyTransmissionCapacityGb = effectiveCommsMbps * 10.8;
  const estimatedMissionDataGb = totals.dailyData * missionDays;
  const effectiveSciencePoints = Math.round(totals.science * orbit.scienceMultiplier);

  let estimatedEnduranceDays = missionDays;
  if (powerReserveW < 0) {
    estimatedEnduranceDays =
      totals.batteryCapacity > 0
        ? totals.batteryCapacity / Math.abs(powerReserveW) / 24
        : 0;
  }

  const resources: SpacecraftResources = {
    creditsSpent: totalCreditsSpent,
    creditsRemaining: remainingCredits,
    massKg: totalMassKg,
    massLimitKg: effectiveMassLimitKg,
    massRemainingKg: effectiveMassLimitKg - totalMassKg,
    powerGenerationW: totals.powerGeneration,
    powerConsumptionW: totalPowerDrawW,
    powerReserveW,
    batteryCapacityWh: totals.batteryCapacity,
    estimatedEnduranceDays,
    dataGenerationGbPerDay: totals.dailyData,
    totalMissionDataGb: estimatedMissionDataGb,
    dataStorageGb: totals.storage,
    dailyTransmissionCapacityGb,
    communicationMbps: effectiveCommsMbps,
    sciencePoints: effectiveSciencePoints,
    installedCount: installedComponents.length,
  };

  return {
    installedComponents,
    unknownComponentIds,
    resources,
  };
}

export function validateSpacecraft(
  installedComponentIds: string[] = [],
  options: MissionPlanOptions = {}
): SpacecraftValidation {
  const { objective, vehicle, orbit } = resolveMissionPlan(options);
  const { installedComponents, unknownComponentIds, resources } =
    calculateSpacecraft(installedComponentIds, options);

  const componentIds = installedComponents.map((component) => component.id);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (unknownComponentIds.length > 0) {
    errors.push("Unknown component IDs were found.");
  }
  if (resources.creditsRemaining < 0) {
    errors.push(
      `Budget exceeded by ${Math.abs(resources.creditsRemaining)} CR (including ${vehicle.name} + orbit ops).`
    );
  }
  if (resources.massKg > resources.massLimitKg) {
    errors.push(
      `Payload overweight (${resources.massKg} KG > ${resources.massLimitKg} KG limit for ${vehicle.name}).`
    );
  }
  if (resources.powerGenerationW === 0) {
    errors.push("No Solar Array installed — relies solely on depleting battery reserve.");
  }
  if (resources.powerReserveW < GAME_CONFIG.requiredPowerReserveW) {
    errors.push("Power reserve is below +15 W safe operating margin.");
  }
  if (!componentIds.includes("onboard-computer")) {
    errors.push("No Flight Computer installed — guidance lock will fail in space.");
  }
  if (!componentIds.includes("propulsion-module")) {
    errors.push("No Propulsion Module installed — orbital escape burn cannot sustain.");
  }
  if (!componentIds.includes("fuel-tank")) {
    errors.push("No Propellant Tank installed — severe risk of mid-flight fuel exhaustion.");
  }
  if (!componentIds.includes("thermal-control")) {
    errors.push("No Thermal Control System — risk of solar overheat or re-entry burn-up.");
  }
  if (!componentIds.includes("landing-gear")) {
    errors.push("No Planetary Landing Gear — spacecraft cannot survive touchdown.");
  }

  const reqComms = Math.max(
    MISSION_PROFILE.requirements.minCommunicationMbps,
    objective.requiredCommsMin
  );
  if (resources.communicationMbps < reqComms) {
    errors.push(
      `Comms bandwidth (${resources.communicationMbps} Mbps) is below ${reqComms} Mbps objective target.`
    );
  }

  const reqScience = Math.max(
    10,
    MISSION_PROFILE.requirements.minSciencePoints + objective.requiredScienceBonus
  );
  if (resources.sciencePoints < reqScience) {
    errors.push(
      `Science payload (${resources.sciencePoints} PTS) is below ${reqScience} PTS objective target.`
    );
  }

  if (resources.dataStorageGb < resources.totalMissionDataGb) {
    errors.push(
      `Data storage (${resources.dataStorageGb} GB) is below ${resources.totalMissionDataGb} GB ${orbit.missionDays}-day mission output.`
    );
  }
  if (resources.dataGenerationGbPerDay > resources.dailyTransmissionCapacityGb) {
    warnings.push("Daily data output exceeds Earth downlink capacity.");
  }
  if (resources.estimatedEnduranceDays < orbit.missionDays) {
    errors.push(
      `Power endurance (${resources.estimatedEnduranceDays.toFixed(1)}d) is shorter than ${orbit.missionDays}-day orbit.`
    );
  }
  if (orbit.radiationHazard === "HIGH" && !componentIds.includes("radiation-shield")) {
    warnings.push("High-altitude orbit radiation is elevated without a Radiation Shield.");
  }
  if (resources.massRemainingKg >= 0 && resources.massRemainingKg < 40) {
    warnings.push("Tight payload mass margin on selected launch vehicle.");
  }
  if (resources.creditsRemaining < 120 && resources.creditsRemaining >= 0) {
    warnings.push("Program budget reserve is thin.");
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    resources,
    installedComponents,
  };
}

export function calculateDataTransmissionSummary(
  resources: SpacecraftResources,
  orbitId: OrbitProfileDef["id"],
  objectiveId: MissionObjectiveId,
  fieldScienceScore: number,
  surfaceActivity: { samplesCollected?: number; photosCount?: number } = {}
): import("../types/game").DataTransmissionSummary {
  const { objective, orbit } = resolveMissionPlan({ orbitId, objectiveId });
  const instrumentDataGb = Math.max(0, Math.round(resources.totalMissionDataGb));
  const sampleDataGb = Math.max(
    0,
    Math.round((surfaceActivity.samplesCollected || 0) * 1)
  );
  const photoDataGb = Math.max(
    0,
    Math.round((surfaceActivity.photosCount || 0) * 2)
  );
  const generatedDataGb = instrumentDataGb + sampleDataGb + photoDataGb;

  const storageCapacityGb = Math.max(0, Math.round(resources.dataStorageGb));
  const downlinkCapacityGb = Math.max(
    0,
    Math.round(resources.dailyTransmissionCapacityGb * orbit.missionDays)
  );

  // Delivery is capped by whichever is smaller: onboard storage or Earth downlink capacity
  const deliverableCeilingGb = Math.min(storageCapacityGb, downlinkCapacityGb);
  const transmittedDataGb =
    generatedDataGb > 0 ? Math.min(generatedDataGb, deliverableCeilingGb) : 0;
  const lostDataGb = Math.max(0, generatedDataGb - transmittedDataGb);

  let transmissionEfficiencyPct = 100;
  if (generatedDataGb > 0) {
    transmissionEfficiencyPct = Math.round((transmittedDataGb / generatedDataGb) * 100);
  } else if (downlinkCapacityGb === 0) {
    transmissionEfficiencyPct = 0;
  }

  // Note: resources.sciencePoints (in calculateSpacecraft) and surface sample collection
  // already apply orbit.scienceMultiplier once; do not multiply by it a second time here.
  const ratio = transmissionEfficiencyPct / 100;
  const rawScienceScore = Math.round(
    (fieldScienceScore + resources.sciencePoints * 2) *
      objective.scienceRewardMultiplier
  );
  const effectiveScienceScore = Math.round(rawScienceScore * ratio);

  return {
    instrumentDataGb,
    sampleDataGb,
    photoDataGb,
    generatedDataGb,
    storageCapacityGb,
    downlinkCapacityGb,
    transmittedDataGb,
    lostDataGb,
    transmissionEfficiencyPct,
    rawScienceScore,
    effectiveScienceScore,
  };
}
