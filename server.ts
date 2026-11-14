import "dotenv/config";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import {
  FALLBACK_NEO_ASTEROIDS,
  type NeoAsteroidRecord,
  type NeoFeedResponse,
} from "./src/data/nasaSources";
import {
  DEFAULT_TEAM_MEMBERS,
  DIFFICULTY_CONFIGS,
  LAUNCH_VEHICLES,
  MISSIONS,
  MISSION_OBJECTIVES,
  ORBIT_PROFILES,
  SPACECRAFT_COMPONENTS,
} from "./src/game/spacecraftData";
import type {
  DifficultyLevel,
  LaunchVehicleDef,
  MissionDefinition,
  MissionObjectiveId,
  OrbitProfileDef,
  RoleStance,
  TeamMemberConfig,
  TeamRoleId,
} from "./src/types/game";

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD =
  process.env.NODE_ENV === "production" || process.argv.includes("--prod");

// ------------------------------------------------------------
// NASA NEOWS PROXY CACHING & RATE LIMITING
// ------------------------------------------------------------
const NEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours for live responses
const NEO_FAILURE_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes for failed upstream attempts
const REFRESH_COOLDOWN_MS = 20 * 1000; // 20s minimum interval between forced upstream refreshes
const NEO_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const NEO_RATE_LIMIT_MAX = 30;

let cachedNeoFeed: { timestamp: number; data: NeoFeedResponse } | null = null;
let cachedFailedFeed: { timestamp: number; data: NeoFeedResponse } | null = null;
const neoIpRequests = new Map<string, number[]>();

function isNeoRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (neoIpRequests.get(ip) || []).filter(
    (ts) => now - ts < NEO_RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= NEO_RATE_LIMIT_MAX) {
    neoIpRequests.set(ip, recent);
    return true;
  }
  recent.push(now);
  neoIpRequests.set(ip, recent);
  if (neoIpRequests.size > 500) {
    for (const [k, list] of neoIpRequests) {
      if (list.every((ts) => now - ts >= NEO_RATE_LIMIT_WINDOW_MS)) {
        neoIpRequests.delete(k);
      }
    }
  }
  return false;
}

function utcDateOffset(daysOffset: number): string {
  const d = new Date(Date.now() + daysOffset * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Network unavailable";
  return raw.replace(/api_key=[^&\s]+/gi, "api_key=[REDACTED]");
}

interface RawNeoItem {
  id: string;
  name: string;
  nasa_jpl_url?: string;
  is_potentially_hazardous_asteroid?: boolean;
  estimated_diameter?: {
    meters?: {
      estimated_diameter_min?: number;
      estimated_diameter_max?: number;
    };
  };
  close_approach_data?: Array<{
    close_approach_date?: string;
    relative_velocity?: {
      kilometers_per_second?: string;
    };
    miss_distance?: {
      kilometers?: string;
    };
  }>;
}

async function getNeoFeed(forceRefresh = false): Promise<NeoFeedResponse> {
  const now = Date.now();

  if (cachedNeoFeed) {
    const age = now - cachedNeoFeed.timestamp;
    const withinTtl = age < NEO_CACHE_TTL_MS;
    const withinRefreshCooldown = forceRefresh && age < REFRESH_COOLDOWN_MS;
    if ((!forceRefresh && withinTtl) || withinRefreshCooldown) {
      return {
        ...cachedNeoFeed.data,
        cached: true,
      };
    }
  }

  // Temporarily cache failed NASA API responses so repeated client loads do not exhaust the API
  if (cachedFailedFeed) {
    const failAge = now - cachedFailedFeed.timestamp;
    const withinFailTtl = failAge < NEO_FAILURE_CACHE_TTL_MS;
    const withinCooldown = forceRefresh && failAge < REFRESH_COOLDOWN_MS;
    if ((!forceRefresh && withinFailTtl) || withinCooldown) {
      return {
        ...cachedFailedFeed.data,
        cached: true,
      };
    }
  }

  const startDate = utcDateOffset(-2);
  const endDate = utcDateOffset(0);
  const dateWindow = `${startDate} to ${endDate}`;
  const apiKey = process.env.NASA_API_KEY?.trim() || "DEMO_KEY";
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${encodeURIComponent(
    apiKey
  )}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5500),
    });

    if (!response.ok) {
      throw new Error(`NASA NeoWs returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      near_earth_objects?: Record<string, RawNeoItem[]>;
    };

    const rawBuckets = payload.near_earth_objects || {};
    const flatItems: RawNeoItem[] = Object.values(rawBuckets).flat();

    const parsed: NeoAsteroidRecord[] = flatItems
      .map((item) => {
        const minM =
          Number(item.estimated_diameter?.meters?.estimated_diameter_min) || 25;
        const maxM =
          Number(item.estimated_diameter?.meters?.estimated_diameter_max) || 60;
        const approach = item.close_approach_data?.[0];
        const velKmS =
          Number(approach?.relative_velocity?.kilometers_per_second) || 11.5;
        const missKm = Number(approach?.miss_distance?.kilometers) || 1200000;

        return {
          id: String(item.id),
          name: String(item.name || "Unknown NEO").trim(),
          estimatedDiameterMinM: Math.round(minM),
          estimatedDiameterMaxM: Math.round(maxM),
          estimatedDiameterM: Math.round((minM + maxM) * 0.5),
          relativeVelocityKmS: Number(velKmS.toFixed(2)),
          missDistanceKm: Math.round(missKm),
          isHazardous: Boolean(item.is_potentially_hazardous_asteroid),
          closeApproachDate: approach?.close_approach_date || endDate,
          nasaJplUrl: item.nasa_jpl_url,
        };
      })
      .filter((a) => Number.isFinite(a.estimatedDiameterM) && Number.isFinite(a.relativeVelocityKmS))
      .sort((a, b) => Number(b.isHazardous) - Number(a.isHazardous) || a.missDistanceKm - b.missDistanceKm)
      .slice(0, 24);

    if (parsed.length === 0) {
      throw new Error("NASA NeoWs returned zero near-Earth objects for window");
    }

    const feed: NeoFeedResponse = {
      source: "nasa-neows",
      sourceLabel: "NASA NeoWs Live Feed",
      fetchedAt: new Date().toISOString(),
      dateWindow,
      cached: false,
      note: `Live Near-Earth Object catalog retrieved from NASA NeoWs (${parsed.length} objects tracked for ${dateWindow}).`,
      asteroids: parsed,
    };

    cachedNeoFeed = { timestamp: now, data: feed };
    cachedFailedFeed = null;
    return feed;
  } catch (err) {
    const reason = sanitizeErrorMessage(err);
    const fallbackFeed: NeoFeedResponse = {
      source: "sample-fallback",
      sourceLabel: "Simulated / Sample NEO Data (Fallback)",
      fetchedAt: new Date().toISOString(),
      dateWindow,
      cached: false,
      note: `NASA NeoWs live feed unavailable (${reason}); displaying labeled simulated/sample reference NEO data.`,
      asteroids: FALLBACK_NEO_ASTEROIDS,
    };
    cachedFailedFeed = { timestamp: now, data: fallbackFeed };
    return fallbackFeed;
  }
}

// ------------------------------------------------------------
// MULTI-DEVICE TEAM ROOM SYNCHRONIZATION (/ws)
// NOTE: Rooms are stored in-memory and require a single persistent
// server instance. Multi-instance scaling requires shared storage (e.g., Redis).
// ------------------------------------------------------------
const MAX_WS_PAYLOAD_BYTES = 16 * 1024; // 16 KB
const MAX_WS_CONNECTIONS = 100;
const MAX_WS_PER_IP = 10;
const MAX_ROOMS = 50;
const MAX_ROOM_PEERS = 4;
const WS_MSG_RATE_WINDOW_MS = 5000;
const WS_MSG_RATE_MAX = 30;
const WS_HEARTBEAT_INTERVAL_MS = 30 * 1000;
const ROOM_IDLE_TTL_MS = 30 * 60 * 1000;

const VALID_MISSION_IDS = new Set<string>(MISSIONS.map((m) => m.id));
const VALID_DIFFICULTIES = new Set<string>(Object.keys(DIFFICULTY_CONFIGS));
const VALID_OBJECTIVES = new Set<string>(Object.keys(MISSION_OBJECTIVES));
const VALID_VEHICLES = new Set<string>(LAUNCH_VEHICLES.map((v) => v.id));
const VALID_ORBITS = new Set<string>(ORBIT_PROFILES.map((o) => o.id));
const VALID_COMPONENT_IDS = new Set<string>(SPACECRAFT_COMPONENTS.map((c) => c.id));
const VALID_ROLE_IDS = new Set<string>(DEFAULT_TEAM_MEMBERS.map((m) => m.roleId));
const VALID_STANCES = new Set<string>(["safety", "science", "efficiency"]);

interface SyncedMissionPlan {
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
}

interface RoomPeer {
  clientId: string;
  displayName: string;
  roleId?: TeamRoleId;
  ws: WebSocket;
}

interface TeamRoom {
  code: string;
  hostClientId: string;
  plan: SyncedMissionPlan;
  peers: Map<string, RoomPeer>;
  updatedAt: number;
}

const rooms = new Map<string, TeamRoom>();
const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sanitizeDisplayText(val: unknown, fallback: string, maxLen = 24): string {
  if (typeof val !== "string") return fallback;
  const cleaned = val.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return (cleaned || fallback).slice(0, maxLen);
}

function validateSyncedMissionPlan(raw: unknown): SyncedMissionPlan | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (
    typeof obj.selectedMissionId !== "string" ||
    !VALID_MISSION_IDS.has(obj.selectedMissionId)
  ) {
    return null;
  }
  if (
    typeof obj.difficulty !== "string" ||
    !VALID_DIFFICULTIES.has(obj.difficulty)
  ) {
    return null;
  }
  if (
    typeof obj.objectiveId !== "string" ||
    !VALID_OBJECTIVES.has(obj.objectiveId)
  ) {
    return null;
  }
  if (
    typeof obj.launchVehicleId !== "string" ||
    !VALID_VEHICLES.has(obj.launchVehicleId)
  ) {
    return null;
  }
  if (typeof obj.orbitId !== "string" || !VALID_ORBITS.has(obj.orbitId)) {
    return null;
  }
  if (!Array.isArray(obj.installedIds) || obj.installedIds.length > 40) {
    return null;
  }

  const seenNonRepeatable = new Set<string>();
  const cleanInstalledIds: string[] = [];
  for (const id of obj.installedIds) {
    if (typeof id !== "string" || !VALID_COMPONENT_IDS.has(id)) return null;
    if (id !== "data-storage") {
      if (seenNonRepeatable.has(id)) return null;
      seenNonRepeatable.add(id);
    }
    cleanInstalledIds.push(id);
  }

  if (obj.teamMode !== "solo" && obj.teamMode !== "team") return null;
  if (
    typeof obj.teamSize !== "number" ||
    !Number.isInteger(obj.teamSize) ||
    obj.teamSize < 1 ||
    obj.teamSize > MAX_ROOM_PEERS
  ) {
    return null;
  }

  if (
    !Array.isArray(obj.teamMembers) ||
    obj.teamMembers.length !== DEFAULT_TEAM_MEMBERS.length
  ) {
    return null;
  }

  const cleanMembers: TeamMemberConfig[] = [];
  for (let i = 0; i < DEFAULT_TEAM_MEMBERS.length; i++) {
    const rawMember = obj.teamMembers[i];
    const base = DEFAULT_TEAM_MEMBERS[i];
    if (!rawMember || typeof rawMember !== "object" || Array.isArray(rawMember)) {
      return null;
    }
    const m = rawMember as Record<string, unknown>;
    if (typeof m.roleId !== "string" || !VALID_ROLE_IDS.has(m.roleId)) {
      return null;
    }
    if (typeof m.stance !== "string" || !VALID_STANCES.has(m.stance)) {
      return null;
    }
    if (typeof m.approved !== "boolean") {
      return null;
    }
    cleanMembers.push({
      roleId: m.roleId as TeamRoleId,
      roleTitle: sanitizeDisplayText(m.roleTitle, base.roleTitle, 32),
      playerName: sanitizeDisplayText(m.playerName, base.playerName, 24),
      responsibility: sanitizeDisplayText(
        m.responsibility,
        base.responsibility,
        140
      ),
      stance: m.stance as RoleStance,
      approved: m.approved,
    });
  }

  if (typeof obj.timedMode !== "boolean") return null;
  if (
    typeof obj.timeLimitSec !== "number" ||
    !Number.isFinite(obj.timeLimitSec) ||
    obj.timeLimitSec < 60 ||
    obj.timeLimitSec > 1800
  ) {
    return null;
  }

  return {
    selectedMissionId: obj.selectedMissionId as MissionDefinition["id"],
    difficulty: obj.difficulty as DifficultyLevel,
    objectiveId: obj.objectiveId as MissionObjectiveId,
    launchVehicleId: obj.launchVehicleId as LaunchVehicleDef["id"],
    orbitId: obj.orbitId as OrbitProfileDef["id"],
    installedIds: cleanInstalledIds,
    teamMode: obj.teamMode,
    teamSize: obj.teamSize,
    teamMembers: cleanMembers,
    timedMode: obj.timedMode,
    timeLimitSec: Math.round(obj.timeLimitSec),
  };
}

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 16; attempt++) {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return `${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

function broadcastRoomState(room: TeamRoom) {
  const payload = JSON.stringify({
    type: "ROOM_STATE",
    roomCode: room.code,
    hostClientId: room.hostClientId,
    peerCount: room.peers.size,
    peers: Array.from(room.peers.values()).map((p) => ({
      clientId: p.clientId,
      displayName: p.displayName,
      roleId: p.roleId || null,
      isHost: p.clientId === room.hostClientId,
    })),
    plan: room.plan,
    updatedAt: room.updatedAt,
  });

  for (const peer of room.peers.values()) {
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
}

function parseAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  const addOrigin = (raw?: string) => {
    if (!raw) return;
    try {
      allowed.add(new URL(raw.trim()).origin);
    } catch {
      // ignore invalid URL strings
    }
  };
  addOrigin(process.env.APP_URL);
  if (process.env.ALLOWED_ORIGINS) {
    for (const entry of process.env.ALLOWED_ORIGINS.split(",")) {
      addOrigin(entry);
    }
  }
  return allowed;
}

function isOriginAllowed(req: http.IncomingMessage, allowedOrigins: Set<string>): boolean {
  const originHeader = req.headers.origin;
  const hostHeader = (
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0] ||
    req.headers.host ||
    ""
  ).trim();

  if (!originHeader) {
    // Require Origin header on browser WebSocket upgrades in production
    return !IS_PROD;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    return false;
  }

  if (hostHeader && parsedOrigin.host === hostHeader) {
    return true;
  }
  if (allowedOrigins.has(parsedOrigin.origin)) {
    return true;
  }
  if (
    !IS_PROD &&
    (parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1")
  ) {
    return true;
  }
  return false;
}

function getClientIp(req: http.IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      mode: IS_PROD ? "production" : "development",
      roomsActive: rooms.size,
      wsConnections: wss.clients.size,
    });
  });

  app.get("/api/nasa/neos", async (req, res) => {
    const clientIp = getClientIp(req);
    if (isNeoRateLimited(clientIp)) {
      res.status(429).json({
        error: "Rate limit exceeded for /api/nasa/neos. Please retry shortly.",
      });
      return;
    }
    const forceRefresh = req.query.refresh === "true";
    const data = await getNeoFeed(forceRefresh);
    res.json(data);
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WS_PAYLOAD_BYTES,
  });

  const allowedOrigins = parseAllowedOrigins();
  const wsConnectionsByIp = new Map<string, number>();

  interface TrackedSocket extends WebSocket {
    isAlive?: boolean;
    clientIp?: string;
  }

  httpServer.on("upgrade", (req, socket, head) => {
    const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (reqUrl.pathname !== "/ws") {
      if (IS_PROD) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
      }
      return;
    }

    if (!isOriginAllowed(req, allowedOrigins)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const clientIp = getClientIp(req);
    const ipCount = wsConnectionsByIp.get(clientIp) || 0;
    if (wss.clients.size >= MAX_WS_CONNECTIONS || ipCount >= MAX_WS_PER_IP) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws: TrackedSocket) => {
      ws.clientIp = clientIp;
      wsConnectionsByIp.set(clientIp, ipCount + 1);
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: TrackedSocket) => {
    const clientId = `crew-${Math.random().toString(36).slice(2, 8)}`;
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    let activeRoomCode: string | null = null;
    const msgTimestamps: number[] = [];

    const sendError = (message: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ROOM_ERROR", message }));
      }
    };

    const detachFromRoom = () => {
      if (!activeRoomCode) return;
      const room = rooms.get(activeRoomCode);
      activeRoomCode = null;
      if (!room) return;
      room.peers.delete(clientId);
      if (room.peers.size === 0) {
        rooms.delete(room.code);
        return;
      }
      if (room.hostClientId === clientId) {
        const nextHost = room.peers.values().next().value;
        if (nextHost) room.hostClientId = nextHost.clientId;
      }
      room.updatedAt = Date.now();
      broadcastRoomState(room);
    };

    ws.on("message", (raw) => {
      const now = Date.now();
      while (msgTimestamps.length > 0 && now - msgTimestamps[0] > WS_MSG_RATE_WINDOW_MS) {
        msgTimestamps.shift();
      }
      if (msgTimestamps.length >= WS_MSG_RATE_MAX) {
        sendError("Message rate limit exceeded. Slow down synchronization updates.");
        if (msgTimestamps.length >= WS_MSG_RATE_MAX + 5) {
          ws.close(1008, "Rate limit exceeded");
        }
        return;
      }
      msgTimestamps.push(now);

      try {
        const rawStr = typeof raw === "string" ? raw : raw.toString("utf8");
        if (Buffer.byteLength(rawStr, "utf8") > MAX_WS_PAYLOAD_BYTES) {
          sendError("Synchronization payload exceeded 16 KB limit.");
          return;
        }
        const msg = JSON.parse(rawStr) as Record<string, unknown>;
        if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
          sendError("Malformed synchronization packet.");
          return;
        }

        const msgType = msg.type;
        if (typeof msgType !== "string") {
          sendError("Missing message type.");
          return;
        }

        if (msgType === "PING") {
          ws.isAlive = true;
          ws.send(JSON.stringify({ type: "PONG" }));
          return;
        }

        const validRoleId =
          typeof msg.roleId === "string" && VALID_ROLE_IDS.has(msg.roleId)
            ? (msg.roleId as TeamRoleId)
            : undefined;

        if (msgType === "CREATE_ROOM") {
          const validatedPlan = validateSyncedMissionPlan(msg.plan);
          if (!validatedPlan) {
            sendError("Invalid mission plan payload for room creation.");
            return;
          }
          if (rooms.size >= MAX_ROOMS && !activeRoomCode) {
            sendError("Server room capacity reached. Try again later.");
            return;
          }
          detachFromRoom();
          const code = generateRoomCode();
          const room: TeamRoom = {
            code,
            hostClientId: clientId,
            plan: validatedPlan,
            peers: new Map(),
            updatedAt: now,
          };
          room.peers.set(clientId, {
            clientId,
            displayName: sanitizeDisplayText(msg.displayName, "Flight Director"),
            roleId: validRoleId,
            ws,
          });
          rooms.set(code, room);
          activeRoomCode = code;
          ws.send(JSON.stringify({ type: "CONNECTED_ACK", clientId, roomCode: code }));
          broadcastRoomState(room);
          return;
        }

        if (msgType === "JOIN_ROOM") {
          const code =
            typeof msg.roomCode === "string"
              ? msg.roomCode.trim().toUpperCase()
              : "";
          if (!/^[A-Z0-9]{5}$/.test(code)) {
            sendError("Invalid room code format. Expected a 5-character mission code.");
            return;
          }
          const room = rooms.get(code);
          if (!room) {
            sendError(`Room "${code}" was not found or has expired.`);
            return;
          }
          if (room.peers.size >= MAX_ROOM_PEERS && !room.peers.has(clientId)) {
            sendError(`Room ${code} already has the maximum ${MAX_ROOM_PEERS} connected crew devices.`);
            return;
          }
          detachFromRoom();
          room.peers.set(clientId, {
            clientId,
            displayName: sanitizeDisplayText(msg.displayName, "Crew Specialist"),
            roleId: validRoleId,
            ws,
          });
          activeRoomCode = code;
          room.updatedAt = now;
          ws.send(JSON.stringify({ type: "CONNECTED_ACK", clientId, roomCode: code }));
          broadcastRoomState(room);
          return;
        }

        if (msgType === "SYNC_PLAN") {
          if (!activeRoomCode) {
            sendError("Join or create a room before syncing mission plans.");
            return;
          }
          const room = rooms.get(activeRoomCode);
          if (!room) {
            activeRoomCode = null;
            sendError("Active room no longer exists.");
            return;
          }
          const validatedPlan = validateSyncedMissionPlan(msg.plan);
          if (!validatedPlan) {
            sendError("Rejected invalid mission plan update.");
            return;
          }
          room.plan = validatedPlan;
          const peer = room.peers.get(clientId);
          if (peer) {
            if (validRoleId) peer.roleId = validRoleId;
            if (typeof msg.displayName === "string") {
              peer.displayName = sanitizeDisplayText(msg.displayName, peer.displayName);
            }
          }
          room.updatedAt = now;
          broadcastRoomState(room);
          return;
        }

        if (msgType === "LEAVE_ROOM") {
          detachFromRoom();
          return;
        }

        sendError(`Unsupported message type: ${msgType}`);
      } catch {
        sendError("Malformed synchronization packet.");
      }
    });

    ws.on("close", () => {
      if (ws.clientIp) {
        const current = wsConnectionsByIp.get(ws.clientIp) || 0;
        if (current <= 1) wsConnectionsByIp.delete(ws.clientIp);
        else wsConnectionsByIp.set(ws.clientIp, current - 1);
      }
      detachFromRoom();
    });
  });

  // Heartbeat sweep for dead WebSockets and stale idle rooms
  const maintenanceTimer = setInterval(() => {
    const now = Date.now();
    for (const client of wss.clients as Set<TrackedSocket>) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }

    for (const [code, room] of rooms) {
      for (const [peerId, peer] of room.peers) {
        if (peer.ws.readyState !== WebSocket.OPEN) {
          room.peers.delete(peerId);
        }
      }
      if (room.peers.size === 0 || now - room.updatedAt > ROOM_IDLE_TTL_MS) {
        for (const peer of room.peers.values()) {
          if (peer.ws.readyState === WebSocket.OPEN) {
            peer.ws.send(
              JSON.stringify({
                type: "ROOM_ERROR",
                message: "Room closed due to inactivity.",
              })
            );
            peer.ws.close(1000, "Room expired");
          }
        }
        rooms.delete(code);
      }
    }
  }, WS_HEARTBEAT_INTERVAL_MS);

  httpServer.on("close", () => clearInterval(maintenanceTimer));

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true" ? { server: httpServer } : false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve("dist");
    const indexHtml = path.join(distDir, "index.html");
    if (!fs.existsSync(indexHtml)) {
      console.warn(
        `Warning: ${indexHtml} not found. Run "npm run build" before starting in production mode.`
      );
    }
    app.use(express.static(distDir));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "API route not found" });
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(
      `ASTRION server (${IS_PROD ? "production" : "development"}) listening on http://0.0.0.0:${PORT}`
    );
  });
}

startServer();
