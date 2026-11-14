import assert from "node:assert/strict";
import {
  calculateDataTransmissionSummary,
  calculateSpacecraft,
  validateSpacecraft,
} from "./spacecraftCalculations";
import { RECOMMENDED_LOADOUT_IDS } from "./spacecraftData";

function runTests() {
  // 1. Orbit science multiplier should apply ONCE (not twice via calculateSpacecraft + calculateDataTransmissionSummary)
  const lowScienceBuild = calculateSpacecraft(
    [
      "scientific-camera",
      "spectrometer",
      "data-storage",
      "data-storage",
      "data-storage",
      "high-gain-antenna",
    ],
    {
      difficulty: "engineer",
      objectiveId: "balanced-recon",
      launchVehicleId: "ares-medium",
      orbitId: "low-science", // 21 days * 10 GB/day = 210 GB; scienceMultiplier = 1.3
    }
  );
  // scientific-camera (15) + spectrometer (30) = 45 * 1.3 = 58.5 -> 59
  assert.equal(lowScienceBuild.resources.sciencePoints, 59);

  const lowScienceDebrief = calculateDataTransmissionSummary(
    lowScienceBuild.resources,
    "low-science",
    "balanced-recon",
    0
  );
  // Expect 59 * 2 * 1.0 = 118 (NOT 118 * 1.3 = 153 from duplicated orbit multiplier)
  assert.equal(lowScienceDebrief.rawScienceScore, 118);
  assert.equal(lowScienceDebrief.effectiveScienceScore, 118);
  assert.equal(lowScienceDebrief.transmissionEfficiencyPct, 100);

  // 2. Nominal recommended build with samples & photos
  const nominalBuild = calculateSpacecraft(RECOMMENDED_LOADOUT_IDS, {
    difficulty: "engineer",
    objectiveId: "balanced-recon",
    launchVehicleId: "ares-medium",
    orbitId: "direct-hohmann",
  });
  const nominalValidation = validateSpacecraft(RECOMMENDED_LOADOUT_IDS, {
    difficulty: "engineer",
    objectiveId: "balanced-recon",
    launchVehicleId: "ares-medium",
    orbitId: "direct-hohmann",
  });
  assert.equal(nominalValidation.ready, true);

  const nominalDebrief = calculateDataTransmissionSummary(
    nominalBuild.resources,
    "direct-hohmann",
    "balanced-recon",
    120,
    { samplesCollected: 3, photosCount: 2 }
  );
  // 4 GB/day * 14 days = 56 GB instruments + 3 GB samples + 4 GB photos = 63 GB <= 200 GB storage
  assert.equal(nominalDebrief.instrumentDataGb, 56);
  assert.equal(nominalDebrief.sampleDataGb, 3);
  assert.equal(nominalDebrief.photoDataGb, 4);
  assert.equal(nominalDebrief.generatedDataGb, 63);
  assert.equal(nominalDebrief.lostDataGb, 0);
  assert.equal(nominalDebrief.transmissionEfficiencyPct, 100);
  assert.equal(
    nominalDebrief.effectiveScienceScore,
    120 + nominalBuild.resources.sciencePoints * 2
  );

  // 3. Weak configuration: fails validation checks, yet calculates deterministically
  const weakIds = ["scientific-camera"]; // no solar, no computer, no propulsion, no storage, no comms
  const weakValidation = validateSpacecraft(weakIds, {
    difficulty: "engineer",
    objectiveId: "balanced-recon",
    launchVehicleId: "vanguard-light",
    orbitId: "direct-hohmann",
  });
  assert.equal(weakValidation.ready, false);
  assert.ok(weakValidation.errors.length >= 5);

  // 4. Zero downlink configuration (no antenna/transmitter -> 0 Mbps -> 0 GB downlink capacity)
  const zeroDownlinkBuild = calculateSpacecraft(
    ["solar-array", "spectrometer", "data-storage", "data-storage"],
    {
      difficulty: "engineer",
      objectiveId: "balanced-recon",
      launchVehicleId: "ares-medium",
      orbitId: "direct-hohmann",
    }
  );
  assert.equal(zeroDownlinkBuild.resources.communicationMbps, 0);
  const zeroDownlinkDebrief = calculateDataTransmissionSummary(
    zeroDownlinkBuild.resources,
    "direct-hohmann",
    "balanced-recon",
    90,
    { samplesCollected: 2, photosCount: 1 }
  );
  assert.equal(zeroDownlinkDebrief.downlinkCapacityGb, 0);
  assert.equal(zeroDownlinkDebrief.transmittedDataGb, 0);
  assert.equal(zeroDownlinkDebrief.lostDataGb, zeroDownlinkDebrief.generatedDataGb);
  assert.equal(zeroDownlinkDebrief.transmissionEfficiencyPct, 0);
  assert.equal(zeroDownlinkDebrief.effectiveScienceScore, 0);

  // Zero downlink with zero instruments and zero samples/photos also yields 0% efficiency
  const emptyZeroDownlinkBuild = calculateSpacecraft(["solar-array"], {
    difficulty: "engineer",
    objectiveId: "balanced-recon",
    launchVehicleId: "ares-medium",
    orbitId: "direct-hohmann",
  });
  const emptyZeroDownlinkDebrief = calculateDataTransmissionSummary(
    emptyZeroDownlinkBuild.resources,
    "direct-hohmann",
    "balanced-recon",
    50
  );
  assert.equal(emptyZeroDownlinkDebrief.transmissionEfficiencyPct, 0);
  assert.equal(emptyZeroDownlinkDebrief.effectiveScienceScore, 0);

  // 5. Insufficient storage configuration (8 GB/day * 14 days = 112 GB + 6 GB samples/photos = 118 GB > 100 GB storage)
  const tightStorageBuild = calculateSpacecraft(
    ["solar-array", "high-gain-antenna", "spectrometer", "data-storage"],
    {
      difficulty: "engineer",
      objectiveId: "max-science", // 1.35x multiplier
      launchVehicleId: "ares-medium",
      orbitId: "direct-hohmann",
    }
  );
  const tightStorageDebrief = calculateDataTransmissionSummary(
    tightStorageBuild.resources,
    "direct-hohmann",
    "max-science",
    100,
    { samplesCollected: 2, photosCount: 2 }
  );
  assert.equal(tightStorageDebrief.instrumentDataGb, 112);
  assert.equal(tightStorageDebrief.sampleDataGb, 2);
  assert.equal(tightStorageDebrief.photoDataGb, 4);
  assert.equal(tightStorageDebrief.generatedDataGb, 118);
  assert.equal(tightStorageDebrief.storageCapacityGb, 100);
  assert.equal(tightStorageDebrief.transmittedDataGb, 100);
  assert.equal(tightStorageDebrief.lostDataGb, 18);
  assert.equal(tightStorageDebrief.transmissionEfficiencyPct, Math.round((100 / 118) * 100));
  assert.equal(
    tightStorageDebrief.effectiveScienceScore,
    Math.round(
      tightStorageDebrief.rawScienceScore *
        (tightStorageDebrief.transmissionEfficiencyPct / 100)
    )
  );

  console.log("ALL SCIENCE & TELEMETRY SCORING TESTS PASSED (5/5 scenarios)");
}

runTests();
