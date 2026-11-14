import { create } from "zustand";
import { useGameStore } from "../store/gameStore";
import type {
  DifficultyLevel,
  LaunchVehicleDef,
  MissionDefinition,
  MissionObjectiveId,
  OrbitProfileDef,
  TeamMemberConfig,
} from "../types/game";

export interface SyncedPeerInfo {
  clientId: string;
  displayName: string;
  roleId: string | null;
  isHost: boolean;
}

export interface SyncedMissionPlan {
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

interface TeamSyncState {
  status: "disconnected" | "connecting" | "reconnecting" | "connected" | "error";
  roomCode: string | null;
  clientId: string | null;
  hostClientId: string | null;
  peers: SyncedPeerInfo[];
  errorMessage: string | null;
  lastSyncedAt: string | null;
  suppressOutgoingSync: boolean;

  createRoom: (displayName: string, roleId?: string) => void;
  joinRoom: (roomCode: string, displayName: string, roleId?: string) => void;
  leaveRoom: () => void;
  pushPlanSnapshot: (roleId?: string, displayName?: string) => void;
}

const MAX_RECONNECT_ATTEMPTS = 4;

let socket: WebSocket | null = null;
let heartbeatTimer: number | undefined;
let reconnectTimer: number | undefined;
let intentionalClose = false;
let reconnectAttempts = 0;
let lastSession: {
  roomCode: string | null;
  displayName: string;
  roleId?: string;
} | null = null;

function buildCurrentPlanSnapshot(): SyncedMissionPlan {
  const s = useGameStore.getState();
  return {
    selectedMissionId: s.selectedMissionId,
    difficulty: s.difficulty,
    objectiveId: s.objectiveId,
    launchVehicleId: s.launchVehicleId,
    orbitId: s.orbitId,
    installedIds: [...s.spacecraft.installedIds],
    teamMode: s.teamMode,
    teamSize: s.teamSize,
    teamMembers: s.teamMembers.map((m) => ({ ...m })),
    timedMode: s.timedMode,
    timeLimitSec: s.timeLimitSec,
  };
}

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function clearTimers() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  }
}

function closeSocket(userInitiated: boolean) {
  intentionalClose = userInitiated;
  clearTimers();
  if (socket) {
    try {
      socket.close();
    } catch {
      // ignore close errors
    }
    socket = null;
  }
}

function isValidIncomingPlan(plan: unknown): plan is SyncedMissionPlan {
  if (!plan || typeof plan !== "object") return false;
  const p = plan as Partial<SyncedMissionPlan>;
  return (
    typeof p.selectedMissionId === "string" &&
    typeof p.difficulty === "string" &&
    typeof p.objectiveId === "string" &&
    typeof p.launchVehicleId === "string" &&
    typeof p.orbitId === "string" &&
    Array.isArray(p.installedIds) &&
    (p.teamMode === "solo" || p.teamMode === "team") &&
    typeof p.teamSize === "number" &&
    Array.isArray(p.teamMembers) &&
    typeof p.timedMode === "boolean" &&
    typeof p.timeLimitSec === "number"
  );
}

function connectSocket(
  mode: "create" | "join",
  roomCode: string | null,
  displayName: string,
  roleId: string | undefined,
  set: (partial: Partial<TeamSyncState>) => void,
  get: () => TeamSyncState,
  isReconnect = false
) {
  closeSocket(false);
  intentionalClose = false;
  set({
    status: isReconnect ? "reconnecting" : "connecting",
    errorMessage: isReconnect
      ? `Reconnecting to room ${roomCode} (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
      : null,
  });

  const ws = new WebSocket(getWsUrl());
  socket = ws;

  ws.onopen = () => {
    reconnectAttempts = 0;
    if (mode === "create") {
      ws.send(
        JSON.stringify({
          type: "CREATE_ROOM",
          displayName: displayName || "Flight Director",
          roleId,
          plan: buildCurrentPlanSnapshot(),
        })
      );
    } else if (roomCode) {
      ws.send(
        JSON.stringify({
          type: "JOIN_ROOM",
          roomCode,
          displayName: displayName || "Crew Specialist",
          roleId,
        })
      );
    }

    heartbeatTimer = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "PING" }));
      }
    }, 20000);
  };

  ws.onmessage = (evt) => {
    if (typeof evt.data !== "string") return;
    handleIncomingMessage(evt.data, set);
  };

  ws.onerror = () => {
    set({
      status: "error",
      errorMessage:
        "WebSocket connection interrupted. Single-device Team Mode & JSON export remain available.",
    });
  };

  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    if (heartbeatTimer) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }

    const activeCode = lastSession?.roomCode || get().roomCode;
    if (!intentionalClose && activeCode && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts += 1;
      const delayMs = Math.min(8000, 1000 * Math.pow(2, reconnectAttempts - 1));
      set({
        status: "reconnecting",
        errorMessage: `Connection lost. Reconnecting to room ${activeCode} in ${Math.round(
          delayMs / 1000
        )}s...`,
      });
      reconnectTimer = window.setTimeout(() => {
        if (!intentionalClose && lastSession?.roomCode) {
          connectSocket(
            "join",
            lastSession.roomCode,
            lastSession.displayName,
            lastSession.roleId,
            set,
            get,
            true
          );
        }
      }, delayMs);
      return;
    }

    if (intentionalClose || !activeCode) {
      set({ status: "disconnected", roomCode: null, peers: [], clientId: null });
    } else {
      lastSession = null;
      set({
        status: "disconnected",
        roomCode: null,
        peers: [],
        clientId: null,
        errorMessage: "Unable to reconnect to mission room. You can create or join a new room.",
      });
    }
  };
}

export const useTeamSyncStore = create<TeamSyncState>((set, get) => ({
  status: "disconnected",
  roomCode: null,
  clientId: null,
  hostClientId: null,
  peers: [],
  errorMessage: null,
  lastSyncedAt: null,
  suppressOutgoingSync: false,

  createRoom: (displayName, roleId) => {
    reconnectAttempts = 0;
    lastSession = {
      roomCode: null,
      displayName: displayName || "Flight Director",
      roleId,
    };
    connectSocket("create", null, lastSession.displayName, roleId, set, get);
  },

  joinRoom: (roomCode, displayName, roleId) => {
    const cleaned = roomCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(cleaned)) {
      set({ errorMessage: "Enter a valid 5-character alphanumeric room code to join." });
      return;
    }
    reconnectAttempts = 0;
    lastSession = {
      roomCode: cleaned,
      displayName: displayName || "Crew Specialist",
      roleId,
    };
    connectSocket("join", cleaned, lastSession.displayName, roleId, set, get);
  },

  leaveRoom: () => {
    reconnectAttempts = 0;
    lastSession = null;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "LEAVE_ROOM" }));
    }
    closeSocket(true);
    set({
      status: "disconnected",
      roomCode: null,
      clientId: null,
      hostClientId: null,
      peers: [],
      errorMessage: null,
    });
  },

  pushPlanSnapshot: (roleId, displayName) => {
    const state = get();
    if (
      state.status !== "connected" ||
      state.suppressOutgoingSync ||
      !socket ||
      socket.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    socket.send(
      JSON.stringify({
        type: "SYNC_PLAN",
        roleId,
        displayName,
        plan: buildCurrentPlanSnapshot(),
      })
    );
  },
}));

function handleIncomingMessage(
  rawData: string,
  set: (partial: Partial<TeamSyncState>) => void
) {
  try {
    const msg = JSON.parse(rawData) as {
      type?: string;
      roomCode?: string;
      clientId?: string;
      hostClientId?: string;
      peers?: SyncedPeerInfo[];
      plan?: unknown;
      message?: string;
    };

    if (msg.type === "CONNECTED_ACK") {
      if (msg.roomCode && lastSession) {
        lastSession.roomCode = msg.roomCode;
      }
      set({
        status: "connected",
        roomCode: msg.roomCode || null,
        clientId: msg.clientId || null,
        errorMessage: null,
      });
      return;
    }

    if (msg.type === "ROOM_ERROR") {
      // Stop auto-reconnecting if the room expired or was rejected
      if (
        typeof msg.message === "string" &&
        (msg.message.includes("not found") ||
          msg.message.includes("expired") ||
          msg.message.includes("maximum"))
      ) {
        lastSession = null;
        intentionalClose = true;
      }
      set({
        status: "error",
        errorMessage: msg.message || "Synchronization error.",
      });
      return;
    }

    if (msg.type === "ROOM_STATE" && isValidIncomingPlan(msg.plan)) {
      if (msg.roomCode && lastSession) {
        lastSession.roomCode = msg.roomCode;
      }
      set({
        status: "connected",
        roomCode: msg.roomCode || null,
        hostClientId: msg.hostClientId || null,
        peers: Array.isArray(msg.peers) ? msg.peers : [],
        errorMessage: null,
        lastSyncedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        suppressOutgoingSync: true,
      });

      useGameStore.getState().applySyncedPlan(msg.plan);
      set({ suppressOutgoingSync: false });
    }
  } catch {
    // ignore malformed packet
  }
}
