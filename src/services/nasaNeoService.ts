import {
  FALLBACK_NEO_ASTEROIDS,
  type NeoFeedResponse,
} from "../data/nasaSources";

let cachedClientFeed: NeoFeedResponse | null = null;
let lastAttemptMs = 0;
let inflightPromise: Promise<NeoFeedResponse> | null = null;

export function getInitialNeoFeed(): NeoFeedResponse {
  return (
    cachedClientFeed || {
      source: "sample-fallback",
      sourceLabel: "Synchronizing NASA NeoWs...",
      fetchedAt: new Date().toISOString(),
      dateWindow: "Pending API Sync",
      note: "Synchronizing with NASA Near-Earth Object Web Service (NeoWs)...",
      asteroids: FALLBACK_NEO_ASTEROIDS,
    }
  );
}

export async function fetchNeoFeed(forceRefresh = false): Promise<NeoFeedResponse> {
  const now = Date.now();
  if (
    cachedClientFeed &&
    !forceRefresh &&
    (cachedClientFeed.source === "nasa-neows" || now - lastAttemptMs < 15_000)
  ) {
    return cachedClientFeed;
  }
  if (inflightPromise && !forceRefresh) {
    return inflightPromise;
  }

  lastAttemptMs = now;
  const endpoint = forceRefresh ? "/api/nasa/neos?refresh=true" : "/api/nasa/neos";

  inflightPromise = (async () => {
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as NeoFeedResponse;
      if (!Array.isArray(data.asteroids) || data.asteroids.length === 0) {
        throw new Error("Empty asteroid list");
      }
      cachedClientFeed = data;
      return data;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Network unavailable";
      const fallback: NeoFeedResponse = {
        source: "sample-fallback",
        sourceLabel: "Simulated / Sample NEO Data (Fallback)",
        fetchedAt: new Date().toISOString(),
        dateWindow: "Local Sample Dataset",
        cached: false,
        note: `Could not reach NASA NeoWs server endpoint (${reason}); using clearly labeled simulated/sample asteroid data.`,
        asteroids: FALLBACK_NEO_ASTEROIDS,
      };
      cachedClientFeed = fallback;
      return fallback;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}
