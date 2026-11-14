export interface NeoAsteroidRecord {
  id: string;
  name: string;
  estimatedDiameterMinM: number;
  estimatedDiameterMaxM: number;
  estimatedDiameterM: number;
  relativeVelocityKmS: number;
  missDistanceKm: number;
  isHazardous: boolean;
  closeApproachDate: string;
  nasaJplUrl?: string;
}

export interface NeoFeedResponse {
  source: "nasa-neows" | "sample-fallback";
  sourceLabel: string;
  fetchedAt: string;
  dateWindow: string;
  note: string;
  cached?: boolean;
  asteroids: NeoAsteroidRecord[];
}

export const OFFICIAL_NASA_SOURCES = [
  {
    id: "neows",
    title: "NASA Near-Earth Object Web Service (NeoWs)",
    category: "LIVE OPEN DATA API",
    description:
      "Provides near-Earth asteroid designations, estimated diameter bounds (meters), relative flyby velocities (km/s), nominal miss distances (km), and Potentially Hazardous Asteroid (PHA) classifications.",
    url: "https://api.nasa.gov/",
    secondaryUrl: "https://cneos.jpl.nasa.gov/",
  },
  {
    id: "artemis",
    title: "NASA Artemis Lunar South Pole Exploration",
    category: "LUNAR MISSION REFERENCE",
    description:
      "Informs ASTRION's lunar surface EVA concepts, Artemis lunar South Pole exploration plans (investigating permanently shadowed craters and water-ice volatiles), and crewed spacecraft return architecture.",
    url: "https://www.nasa.gov/humans-in-space/artemis/",
  },
  {
    id: "perseverance",
    title: "NASA Mars 2020 Perseverance & Jezero Crater",
    category: "MARS MISSION REFERENCE",
    description:
      "Informs the Jezero Crater Delta landing site, Perseverance's core drilling and collection of Martian rock and regolith samples into sealed tubes, and deep-space communications trade-offs.",
    url: "https://science.nasa.gov/mission/mars-2020-perseverance/",
  },
] as const;

// Explicitly labeled offline fallback dataset modeled on real NEO catalog formats.
// Used ONLY when the NASA NeoWs API is unreachable or rate-limited.
export const FALLBACK_NEO_ASTEROIDS: NeoAsteroidRecord[] = [
  {
    id: "fallback-99942",
    name: "99942 Apophis (Sample Ref)",
    estimatedDiameterMinM: 310,
    estimatedDiameterMaxM: 370,
    estimatedDiameterM: 340,
    relativeVelocityKmS: 7.42,
    missDistanceKm: 38017,
    isHazardous: true,
    closeApproachDate: "Sample Reference",
    nasaJplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=99942",
  },
  {
    id: "fallback-101955",
    name: "101955 Bennu (Sample Ref)",
    estimatedDiameterMinM: 450,
    estimatedDiameterMaxM: 525,
    estimatedDiameterM: 488,
    relativeVelocityKmS: 12.6,
    missDistanceKm: 298000,
    isHazardous: true,
    closeApproachDate: "Sample Reference",
    nasaJplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=101955",
  },
  {
    id: "fallback-433",
    name: "433 Eros (Sample Ref)",
    estimatedDiameterMinM: 11200,
    estimatedDiameterMaxM: 16840,
    estimatedDiameterM: 14020,
    relativeVelocityKmS: 5.9,
    missDistanceKm: 26700000,
    isHazardous: false,
    closeApproachDate: "Sample Reference",
    nasaJplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=433",
  },
  {
    id: "fallback-25143",
    name: "25143 Itokawa (Sample Ref)",
    estimatedDiameterMinM: 290,
    estimatedDiameterMaxM: 360,
    estimatedDiameterM: 325,
    relativeVelocityKmS: 10.1,
    missDistanceKm: 1940000,
    isHazardous: true,
    closeApproachDate: "Sample Reference",
    nasaJplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=25143",
  },
  {
    id: "fallback-162173",
    name: "162173 Ryugu (Sample Ref)",
    estimatedDiameterMinM: 840,
    estimatedDiameterMaxM: 920,
    estimatedDiameterM: 880,
    relativeVelocityKmS: 9.25,
    missDistanceKm: 95400,
    isHazardous: true,
    closeApproachDate: "Sample Reference",
    nasaJplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=162173",
  },
  {
    id: "fallback-4179",
    name: "4179 Toutatis (Sample Ref)",
    estimatedDiameterMinM: 2100,
    estimatedDiameterMaxM: 2750,
    estimatedDiameterM: 2425,
    relativeVelocityKmS: 14.8,
    missDistanceKm: 1549000,
    isHazardous: false,
    closeApproachDate: "Sample Reference",
    nasaJplUrl: "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=4179",
  },
  {
    id: "fallback-2023-dz2",
    name: "(2023 DZ2) (Sample Ref)",
    estimatedDiameterMinM: 42,
    estimatedDiameterMaxM: 94,
    estimatedDiameterM: 68,
    relativeVelocityKmS: 7.79,
    missDistanceKm: 174650,
    isHazardous: false,
    closeApproachDate: "Sample Reference",
  },
  {
    id: "fallback-2024-yr4",
    name: "(2024 YR4) (Sample Ref)",
    estimatedDiameterMinM: 40,
    estimatedDiameterMaxM: 90,
    estimatedDiameterM: 65,
    relativeVelocityKmS: 17.3,
    missDistanceKm: 828000,
    isHazardous: false,
    closeApproachDate: "Sample Reference",
  },
];
