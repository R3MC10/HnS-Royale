// Lobby list + WebRTC signalling protocol (browser <-> src/lobby/service.ts), JSON over WebSocket.
// Game traffic never goes through the service: it only lists lobbies and relays SDP / ICE.

export const LOBBY_PATH = "/lobby";

/** Public lobby metadata a host publishes (validated + clamped by the service). */
export interface LobbyMeta {
  name: string; // lobby name
  host: string; // host player name
  players: number;
  max: number; // 2..20
  biome: string;
  size: string; // "auto" | "small" | "medium" | "large"
  state: "room" | "match"; // in the lobby room, or a match in progress
  /** A new player can get in right now (open seat, or a running match still taking late joiners). */
  joinable?: boolean;
  /** Seconds left to join the running match (late join). */
  lateLeft?: number;
}

export interface LobbyInfo extends LobbyMeta {
  id: string;
  /** Host's RTT to the lobby service (ms); the browser adds its own for a rough ping estimate. */
  hostRtt: number;
  age: number; // seconds since published
}

/** Opaque WebRTC payload relayed between host and joiner. */
export type SignalData = { sdp: { type: string; sdp: string } } | { ice: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null } | null };

export type LobbyClientMsg =
  | { t: "list" }
  | { t: "host"; meta: LobbyMeta } // publish (or re-publish) this socket's lobby
  | { t: "meta"; meta: LobbyMeta; rtt?: number } // heartbeat + metadata update (host only)
  | { t: "unhost" }
  | { t: "join"; id: string } // ask to join a lobby; the host gets {t:"peer"}
  | { t: "signal"; to: string; data: SignalData } // host: to = peer id; joiner: to = "host"
  | { t: "ping"; c: number };

export type LobbyServerMsg =
  | { t: "hello"; ice: IceServer[]; heartbeat: number; expire: number }
  | { t: "lobbies"; list: LobbyInfo[] }
  | { t: "hosted"; id: string }
  | { t: "peer"; peer: string } // (to host) a joiner wants in
  | { t: "peer-gone"; peer: string } // (to host) the joiner's signalling socket closed before connecting
  | { t: "joining"; peer: string; id: string } // (to joiner) your peer id
  | { t: "signal"; from: string; data: SignalData }
  | { t: "error"; code: string; text: string }
  | { t: "pong"; c: number };

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** Public STUN only. A TURN server is needed for symmetric / strict NATs: set HNS_ICE on the service. */
export const DEFAULT_ICE: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

export const MAP_SIZES = ["auto", "small", "medium", "large"] as const;
/** Map size -> the player count fed to the map generator (auto = actual players). */
export const SIZE_PLAYERS: Record<string, number> = { small: 4, medium: 10, large: 20 };
