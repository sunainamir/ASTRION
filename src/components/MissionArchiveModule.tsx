import {
  ArrowLeft,
  ArrowLeftRight,
  Award,
  Copy,
  Download,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import {
  DIFFICULTY_CONFIGS,
  LAUNCH_VEHICLES,
  MISSION_OBJECTIVES,
  ORBIT_PROFILES,
} from "../game/spacecraftData";
import { useGameStore } from "../store/gameStore";

export default function MissionArchiveModule({
  onBack,
  onOpenBuilder,
}: {
  onBack: () => void;
  onOpenBuilder: () => void;
}) {
  const missionHistory = useGameStore((s) => s.missionHistory);
  const savedBlueprints = useGameStore((s) => s.savedBlueprints);
  const saveCurrentBlueprint = useGameStore((s) => s.saveCurrentBlueprint);
  const loadBlueprint = useGameStore((s) => s.loadBlueprint);
  const importBlueprintJson = useGameStore((s) => s.importBlueprintJson);
  const deleteBlueprint = useGameStore((s) => s.deleteBlueprint);
  const showNotification = useGameStore((s) => s.showNotification);

  const [tab, setTab] = useState<"leaderboard" | "blueprints" | "compare">(
    "leaderboard"
  );
  const [bpName, setBpName] = useState("");
  const [importText, setImportText] = useState("");
  const [compareAId, setCompareAId] = useState<string>(
    savedBlueprints[0]?.id || ""
  );
  const [compareBId, setCompareBId] = useState<string>(
    savedBlueprints[1]?.id || savedBlueprints[0]?.id || ""
  );

  const sortedLeaderboard = [...missionHistory].sort(
    (a, b) => b.totalScore - a.totalScore
  );

  const bpA =
    savedBlueprints.find((b) => b.id === compareAId) || savedBlueprints[0];
  const bpB =
    savedBlueprints.find((b) => b.id === compareBId) ||
    savedBlueprints[1] ||
    savedBlueprints[0];

  const getVehicleName = (id: string) =>
    LAUNCH_VEHICLES.find((v) => v.id === id)?.name || id;
  const getOrbitName = (id: string) =>
    ORBIT_PROFILES.find((o) => o.id === id)?.name || id;

  return (
    <section className="module-panel">
      <div className="module-header">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={15} /> BACK
        </button>
        <div>
          <span className="eyebrow">TELEMETRY LOGS & ENGINEERING ARCHIVE</span>
          <h2>MISSION ARCHIVE & DESIGN COMPARE</h2>
        </div>
        <button className="secondary-action" onClick={onOpenBuilder}>
          OPEN BUILDER
        </button>
      </div>

      <div className="plan-tabs">
        <button
          className={tab === "leaderboard" ? "seg-btn active" : "seg-btn"}
          onClick={() => setTab("leaderboard")}
        >
          <Award size={13} /> LEADERBOARD & RUNS ({missionHistory.length})
        </button>
        <button
          className={tab === "blueprints" ? "seg-btn active" : "seg-btn"}
          onClick={() => setTab("blueprints")}
        >
          <Save size={13} /> SAVED & SHAREABLE DESIGNS ({savedBlueprints.length})
        </button>
        <button
          className={tab === "compare" ? "seg-btn active" : "seg-btn"}
          onClick={() => setTab("compare")}
        >
          <ArrowLeftRight size={13} /> COMPARE DESIGNS
        </button>
      </div>

      {/* TAB 1: LEADERBOARD & PAST MISSION REPORTS */}
      {tab === "leaderboard" && (
        <div className="plan-sections">
          {sortedLeaderboard.length === 0 ? (
            <div className="empty-box">
              No simulated expeditions logged yet. Launch a Moon or Mars mission to record your performance grade, resource efficiency, and leaderboard rank.
            </div>
          ) : (
            <div className="archive-table-wrap">
              <table className="archive-table">
                <thead>
                  <tr>
                    <th>RANK</th>
                    <th>GRADE</th>
                    <th>MISSION</th>
                    <th>MODE & CREW</th>
                    <th>VEHICLE & ORBIT</th>
                    <th>HULL / FUEL</th>
                    <th>SCORE</th>
                    <th>OUTCOME</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((run, idx) => (
                    <tr key={run.id}>
                      <td className="tabular-nums">#{idx + 1}</td>
                      <td>
                        <strong
                          className={
                            run.grade === "S" || run.grade === "A"
                              ? "text-emerald-400"
                              : run.grade === "F"
                              ? "text-rose-400"
                              : "text-sky-300"
                          }
                        >
                          {run.grade}
                        </strong>
                      </td>
                      <td>
                        <div>{run.missionName}</div>
                        <small>{DIFFICULTY_CONFIGS[run.difficulty]?.label}</small>
                      </td>
                      <td>
                        <div>{run.teamMode === "team" ? "TEAM" : "SOLO"}</div>
                        <small>{run.teamNames.join(", ")}</small>
                      </td>
                      <td>
                        <div>{getVehicleName(run.launchVehicleId)}</div>
                        <small>{getOrbitName(run.orbitId)}</small>
                      </td>
                      <td className="tabular-nums">
                        {run.hullPct}% / {run.fuelPct}%
                      </td>
                      <td className="tabular-nums font-semibold">
                        {run.totalScore.toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={
                            run.status === "SUCCESS"
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }
                        >
                          {run.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SAVE, EXPORT & IMPORT BLUEPRINTS */}
      {tab === "blueprints" && (
        <div className="plan-sections">
          <div className="blueprint-toolbar">
            <input
              type="text"
              className="team-name-input"
              placeholder="Name current mission blueprint..."
              value={bpName}
              onChange={(e) => setBpName(e.target.value)}
            />
            <button
              className="secondary-action"
              onClick={() => {
                saveCurrentBlueprint(bpName);
                setBpName("");
              }}
            >
              <Save size={14} /> SAVE CURRENT DESIGN
            </button>
          </div>

          <div className="module-grid">
            {savedBlueprints.map((bp) => (
              <div key={bp.id} className="module-card">
                <div className="plan-card-head">
                  <strong>{bp.name}</strong>
                  <span>{bp.createdAt}</span>
                </div>
                <div className="card-meta">
                  <span>{bp.missionId === "explore-mars" ? "MARS" : "MOON"}</span>
                  <span>·</span>
                  <span>{getVehicleName(bp.launchVehicleId)}</span>
                  <span>·</span>
                  <span>{getOrbitName(bp.orbitId)}</span>
                </div>
                <div className="card-meta tabular-nums">
                  <span>{bp.summary.massKg} KG</span>
                  <span>·</span>
                  <span>{bp.summary.powerReserveW} W RES</span>
                  <span>·</span>
                  <span>{bp.summary.sciencePoints} SCI</span>
                  <span>·</span>
                  <span>{bp.summary.communicationMbps} Mbps</span>
                </div>

                <div className="segmented-row mt-2">
                  <button
                    className="seg-btn active"
                    onClick={() => {
                      loadBlueprint(bp);
                      onOpenBuilder();
                    }}
                  >
                    <Download size={12} /> LOAD & EDIT
                  </button>
                  <button
                    className="seg-btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(JSON.stringify(bp));
                      showNotification(`Copied blueprint JSON for "${bp.name}".`);
                    }}
                  >
                    <Copy size={12} /> COPY SHARE CODE
                  </button>
                  {savedBlueprints.length > 1 && (
                    <button
                      className="seg-btn"
                      onClick={() => deleteBlueprint(bp.id)}
                      title="Delete blueprint"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="team-consensus-box">
            <strong>IMPORT TEAMMATE BLUEPRINT CODE (JSON)</strong>
            <div className="blueprint-toolbar mt-2">
              <input
                type="text"
                className="team-name-input"
                placeholder='Paste copied blueprint JSON here...'
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <button
                className="secondary-action"
                onClick={() => {
                  const res = importBlueprintJson(importText);
                  showNotification(res.message);
                  if (res.ok) setImportText("");
                }}
              >
                <Upload size={14} /> IMPORT & LOAD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SIDE-BY-SIDE DESIGN COMPARISON */}
      {tab === "compare" && (
        <div className="plan-sections">
          {savedBlueprints.length < 2 ? (
            <div className="empty-box">
              Save at least 2 blueprints to compare spacecraft architectures side by side.
            </div>
          ) : (
            <>
              <div className="compare-selectors">
                <label>
                  DESIGN A
                  <select
                    className="team-name-input"
                    value={bpA?.id || ""}
                    onChange={(e) => setCompareAId(e.target.value)}
                  >
                    {savedBlueprints.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  DESIGN B
                  <select
                    className="team-name-input"
                    value={bpB?.id || ""}
                    onChange={(e) => setCompareBId(e.target.value)}
                  >
                    {savedBlueprints.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {bpA && bpB && (
                <div className="archive-table-wrap">
                  <table className="archive-table">
                    <thead>
                      <tr>
                        <th>ENGINEERING METRIC</th>
                        <th>{bpA.name.toUpperCase()}</th>
                        <th>{bpB.name.toUpperCase()}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>TARGET & OBJECTIVE</td>
                        <td>
                          {bpA.missionId === "explore-mars" ? "Mars" : "Moon"} ·{" "}
                          {MISSION_OBJECTIVES[bpA.objectiveId].name}
                        </td>
                        <td>
                          {bpB.missionId === "explore-mars" ? "Mars" : "Moon"} ·{" "}
                          {MISSION_OBJECTIVES[bpB.objectiveId].name}
                        </td>
                      </tr>
                      <tr>
                        <td>LAUNCH VEHICLE</td>
                        <td>{getVehicleName(bpA.launchVehicleId)}</td>
                        <td>{getVehicleName(bpB.launchVehicleId)}</td>
                      </tr>
                      <tr>
                        <td>ORBIT PROFILE</td>
                        <td>{getOrbitName(bpA.orbitId)}</td>
                        <td>{getOrbitName(bpB.orbitId)}</td>
                      </tr>
                      <tr>
                        <td>TOTAL MASS</td>
                        <td className="tabular-nums">{bpA.summary.massKg} KG</td>
                        <td className="tabular-nums">{bpB.summary.massKg} KG</td>
                      </tr>
                      <tr>
                        <td>POWER RESERVE</td>
                        <td className="tabular-nums">
                          {bpA.summary.powerReserveW >= 0 ? "+" : ""}
                          {bpA.summary.powerReserveW} W
                        </td>
                        <td className="tabular-nums">
                          {bpB.summary.powerReserveW >= 0 ? "+" : ""}
                          {bpB.summary.powerReserveW} W
                        </td>
                      </tr>
                      <tr>
                        <td>SCIENCE YIELD</td>
                        <td className="tabular-nums">{bpA.summary.sciencePoints} PTS</td>
                        <td className="tabular-nums">{bpB.summary.sciencePoints} PTS</td>
                      </tr>
                      <tr>
                        <td>DOWNLINK RATE</td>
                        <td className="tabular-nums">
                          {bpA.summary.communicationMbps} Mbps
                        </td>
                        <td className="tabular-nums">
                          {bpB.summary.communicationMbps} Mbps
                        </td>
                      </tr>
                      <tr>
                        <td>CREDITS REMAINING</td>
                        <td className="tabular-nums">
                          {bpA.summary.creditsRemaining} CR
                        </td>
                        <td className="tabular-nums">
                          {bpB.summary.creditsRemaining} CR
                        </td>
                      </tr>
                      <tr>
                        <td>MODULES INSTALLED</td>
                        <td className="tabular-nums">{bpA.installedIds.length}</td>
                        <td className="tabular-nums">{bpB.installedIds.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
