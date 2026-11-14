import {
  CheckCircle2,
  Database,
  ExternalLink,
  RefreshCw,
  Rocket,
  X,
} from "lucide-react";
import { useState } from "react";
import { OFFICIAL_NASA_SOURCES } from "../data/nasaSources";
import { useGameStore } from "../store/gameStore";

export function NasaSourcesModal({ onClose }: { onClose: () => void }) {
  const neoFeed = useGameStore((s) => s.neoFeed);
  const neoLoading = useGameStore((s) => s.neoLoading);
  const neoError = useGameStore((s) => s.neoError);
  const loadNeoFeed = useGameStore((s) => s.loadNeoFeed);
  const [refreshing, setRefreshing] = useState(false);

  const isBusy = refreshing || neoLoading;

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNeoFeed(true);
    setRefreshing(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="tactical-modal info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nasa-sources-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="info-modal-head">
          <div>
            <span className="eyebrow">OPEN DATA & SCIENTIFIC TRANSPARENCY</span>
            <h2 id="nasa-sources-title">NASA DATA & PHYSICS SOURCES</h2>
          </div>
          <button
            className="dock-icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <div className="neo-status-card">
          <div className="plan-card-head">
            <span className="inline-flex items-center gap-2">
              <Database size={14} />
              <strong>
                {isBusy ? "SYNCHRONIZING NASA NEOWS..." : neoFeed.sourceLabel.toUpperCase()}
              </strong>
            </span>
            <button
              className="seg-btn"
              onClick={handleRefresh}
              disabled={isBusy}
            >
              <RefreshCw size={12} className={isBusy ? "animate-spin inline mr-1" : "inline mr-1"} />
              {isBusy ? "SYNCING..." : "REFRESH FEED"}
            </button>
          </div>
          <p>{neoError || neoFeed.note}</p>
          <div className="card-meta tabular-nums">
            <span>{neoFeed.asteroids.length} ASTEROIDS LOADED</span>
            <span>·</span>
            <span>WINDOW: {neoFeed.dateWindow}</span>
            <span>·</span>
            <span>
              STATUS:{" "}
              <strong
                className={
                  isBusy
                    ? "text-sky-400"
                    : neoFeed.source === "nasa-neows"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              >
                {isBusy
                  ? "LOADING"
                  : neoFeed.source === "nasa-neows"
                  ? neoFeed.cached
                    ? "LIVE API (CACHED)"
                    : "LIVE API"
                  : "SIMULATED / SAMPLE FALLBACK"}
              </strong>
            </span>
          </div>
        </div>

        <div className="sources-list">
          {OFFICIAL_NASA_SOURCES.map((src) => (
            <div key={src.id} className="source-item">
              <div className="plan-card-head">
                <span className="card-kicker">{src.category}</span>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  OFFICIAL SOURCE <ExternalLink size={12} />
                </a>
              </div>
              <h3>{src.title}</h3>
              <p>{src.description}</p>
              {"secondaryUrl" in src && src.secondaryUrl && (
                <a
                  href={src.secondaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link mt-1"
                >
                  JPL CNEOS REFERENCE <ExternalLink size={11} />
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="plan-tradeoff">
          <strong>Catalog Data vs. Simulated Gameplay:</strong> Near-Earth asteroid designations, estimated diameter bounds, relative flyby velocities, real orbital miss distances, and PHA classifications come live from NASA NeoWs (or the clearly labeled sample reference dataset when offline). By contrast, in-game asteroid corridor positions, encounter timing, scaled flyby speeds, rocket trajectories, fuel burn, and orbital trade-offs are simulated for interactive gameplay—NASA orbital miss distances do not represent the spacecraft's simulated encounter trajectory.
        </div>

        <div className="info-modal-foot">
          <button className="primary-button" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

const DEMO_STEPS = [
  {
    step: "01",
    title: "PICK MISSION & MODE",
    detail:
      "Select Explore Moon or Explore Mars. Enable optional Timed Challenge if you want a strict sample-return clock.",
  },
  {
    step: "02",
    title: "CONFIGURE SUBSYSTEMS & CREW",
    detail:
      "Balance launch vehicle mass cap, orbit lifetime, power margin, data storage, and solo or 2–4 player team roles.",
  },
  {
    step: "03",
    title: "COMPARE OR EXPERIMENT",
    detail:
      "Save spacecraft blueprints, compare builds side by side, or test weak builds directly in flight to see trade-offs.",
  },
  {
    step: "04",
    title: "FLY & SURVIVE HAZARDS",
    detail:
      "Steer with A/D & W/S past real NASA NeoWs asteroids, fast-forward safe cruise legs, and resolve mid-flight anomalies.",
  },
  {
    step: "05",
    title: "EXPLORE & RETURN TO EARTH",
    detail:
      "Collect surface samples, capture live 3D photos, conserve propellant across launch & ascent, and parachute home for debrief.",
  },
];

export function JudgeDemoFlowModal({
  onClose,
  onStartExpedition,
}: {
  onClose: () => void;
  onStartExpedition: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="tactical-modal info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-flow-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="info-modal-head">
          <div>
            <span className="eyebrow">30-SECOND MISSION WALKTHROUGH</span>
            <h2 id="demo-flow-title">HOW TO PLAY · DEMO FLOW</h2>
          </div>
          <button
            className="dock-icon-btn"
            onClick={onClose}
            aria-label="Close walkthrough"
          >
            <X size={16} />
          </button>
        </div>

        <div className="demo-steps-list">
          {DEMO_STEPS.map((item) => (
            <div key={item.step} className="demo-step-row">
              <span className="demo-step-num tabular-nums">{item.step}</span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
              <CheckCircle2 size={15} className="demo-step-icon" />
            </div>
          ))}
        </div>

        <div className="info-modal-foot">
          <button className="secondary-action" onClick={onClose}>
            CLOSE
          </button>
          <button
            className="primary-button"
            onClick={() => {
              onClose();
              onStartExpedition();
            }}
          >
            <Rocket size={16} /> START EXPEDITION
          </button>
        </div>
      </div>
    </div>
  );
}
