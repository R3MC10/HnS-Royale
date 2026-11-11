// Lobby list + WebRTC signalling service (Node, `ws`). Hosts publish + heartbeat lobby metadata;
// browsers list open lobbies; joiners and hosts exchange SDP offers / answers / ICE through here.
// No game traffic passes through: once the DataChannels are open the joiner hangs up.
//
// Limits: per-socket token-bucket rate limit, 8 KB messages, per-IP socket cap, one lobby per
// socket, lobbies expire without a heartbeat, every field validated / clamped.
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_ICE, LOBBY_PATH, MAP_SIZES, type IceServer, type LobbyInfo, type LobbyMeta, type LobbyServerMsg, type SignalData } from "../net/lobbyproto";

export { LOBBY_PATH } from "../net/lobbyproto";

export interface LobbyServiceOptions {
  /** ICE servers handed to browsers (STUN by default; add TURN for strict NATs). */
  ice?: IceServer[];
  /** Seconds between host heartbeats (told to hosts) and until a silent lobby expires. */
  heartbeat?: number;
  expire?: number;
  maxLobbies?: number;
  maxSocketsPerIp?: number;
  /** Rate limit: sustained messages / second and burst. */
  rate?: number;
  burst?: number;
  log?: (...a: unknown[]) => void;
}

interface Client {
  ws: WebSocket;
  ip: string;
  tokens: number;
  lastRefill: number;
  /** Lobby this socket hosts. */
  lobby: Lobby | null;
  /** As a joiner: peer id + target lobby. */
  peer: string | null;
  joinTo: Lobby | null;
  strikes: number;
}

interface Lobby {
  id: string;
  meta: LobbyMeta;
  host: Client;
  hostRtt: number;
  created: number;
  lastBeat: number;
  peers: Map<string, Client>;
}

const MAX_MSG = 8 * 1024;
const MAX_SDP = 6 * 1024;

const BAD = new RegExp("[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]", "g");
function cleanStr(v: unknown, max: number, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const s = [...v.slice(0, 200).replace(BAD, "")].slice(0, max).join("").trim();
  return s || fallback;
}
const clampInt = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d;

export function validateMeta(m: unknown): LobbyMeta | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  const max = clampInt(o.max, 2, 20, 20);
  return {
    name: cleanStr(o.name, 32, "Unnamed lobby"),
    host: cleanStr(o.host, 16, "Host"),
    players: clampInt(o.players, 0, max, 1),
    max,
    biome: cleanStr(o.biome, 24, "random"),
    size: (MAP_SIZES as readonly string[]).includes(o.size as string) ? (o.size as string) : "auto",
    state: o.state === "match" ? "match" : "room",
  };
}

function validSignal(d: unknown): SignalData | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (o.sdp && typeof o.sdp === "object") {
    const s = o.sdp as Record<string, unknown>;
    if ((s.type !== "offer" && s.type !== "answer") || typeof s.sdp !== "string" || s.sdp.length > MAX_SDP) return null;
    return { sdp: { type: s.type, sdp: s.sdp } };
  }
  if ("ice" in o) {
    if (o.ice === null) return { ice: null };
    const c = o.ice as Record<string, unknown>;
    if (!c || typeof c !== "object" || typeof c.candidate !== "string" || c.candidate.length > 1024) return null;
    return {
      ice: {
        candidate: c.candidate,
        sdpMid: typeof c.sdpMid === "string" ? c.sdpMid.slice(0, 32) : null,
        sdpMLineIndex: typeof c.sdpMLineIndex === "number" ? clampInt(c.sdpMLineIndex, 0, 16, 0) : null,
      },
    };
  }
  return null;
}

const rid = (n: number) => {
  const A = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

export class LobbyService {
  readonly wss: WebSocketServer;
  readonly lobbies = new Map<string, Lobby>();
  private clients = new Set<Client>();
  private perIp = new Map<string, number>();
  private timer: ReturnType<typeof setInterval>;
  private o: Required<Omit<LobbyServiceOptions, "log">> & { log: (...a: unknown[]) => void };

  constructor(opts: LobbyServiceOptions = {}) {
    this.o = {
      ice: opts.ice ?? iceFromEnv() ?? DEFAULT_ICE,
      heartbeat: opts.heartbeat ?? 5,
      expire: opts.expire ?? 15,
      maxLobbies: opts.maxLobbies ?? 500,
      maxSocketsPerIp: opts.maxSocketsPerIp ?? 24,
      rate: opts.rate ?? 20,
      burst: opts.burst ?? 60,
      log: opts.log ?? (() => {}),
    };
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MSG });
    this.wss.on("connection", (ws, req: IncomingMessage) => this.onConnection(ws, req));
    this.timer = setInterval(() => this.sweep(), 1000);
    this.timer.unref?.();
  }

  /** Route an HTTP upgrade here (the caller already checked the path). */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const ip = clientIp(req);
    if ((this.perIp.get(ip) ?? 0) >= this.o.maxSocketsPerIp) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit("connection", ws, req));
  }

  close() {
    clearInterval(this.timer);
    for (const c of this.clients) c.ws.close();
    this.wss.close();
  }

  private send(c: Client, m: LobbyServerMsg) {
    if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(m));
  }

  private onConnection(ws: WebSocket, req: IncomingMessage) {
    const ip = clientIp(req);
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
    const c: Client = { ws, ip, tokens: this.o.burst, lastRefill: Date.now(), lobby: null, peer: null, joinTo: null, strikes: 0 };
    this.clients.add(c);
    this.send(c, { t: "hello", ice: this.o.ice, heartbeat: this.o.heartbeat, expire: this.o.expire });
    ws.on("message", (data, isBinary) => {
      if (isBinary || !this.take(c)) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString());
        if (!msg || typeof msg !== "object") return;
      } catch {
        return this.strike(c, "bad json");
      }
      try {
        this.onMessage(c, msg);
      } catch (err) {
        this.o.log("lobby: message error", err);
      }
    });
    let gone = false;
    const cleanup = () => {
      if (gone) return;
      gone = true;
      this.clients.delete(c);
      const n = (this.perIp.get(ip) ?? 1) - 1;
      if (n <= 0) this.perIp.delete(ip);
      else this.perIp.set(ip, n);
      if (c.lobby) this.removeLobby(c.lobby);
      if (c.joinTo && c.peer) {
        c.joinTo.peers.delete(c.peer);
        this.send(c.joinTo.host, { t: "peer-gone", peer: c.peer });
      }
    };
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  }

  /** Token bucket. Sockets that keep flooding get closed. */
  private take(c: Client): boolean {
    const now = Date.now();
    c.tokens = Math.min(this.o.burst, c.tokens + ((now - c.lastRefill) / 1000) * this.o.rate);
    c.lastRefill = now;
    if (c.tokens < 1) {
      this.strike(c, "rate limited");
      return false;
    }
    c.tokens -= 1;
    return true;
  }

  private strike(c: Client, why: string) {
    c.strikes++;
    if (c.strikes === 1 || c.strikes % 20 === 0) this.send(c, { t: "error", code: "limit", text: why });
    if (c.strikes > 200) c.ws.close(1008, why);
  }

  private onMessage(c: Client, m: Record<string, unknown>) {
    switch (m.t) {
      case "ping":
        if (typeof m.c === "number" && Number.isFinite(m.c)) this.send(c, { t: "pong", c: m.c });
        break;
      case "list":
        this.send(c, { t: "lobbies", list: this.list() });
        break;
      case "host": {
        const meta = validateMeta(m.meta);
        if (!meta) return this.send(c, { t: "error", code: "meta", text: "invalid lobby metadata" });
        if (c.lobby) {
          c.lobby.meta = meta;
          c.lobby.lastBeat = Date.now();
          return this.send(c, { t: "hosted", id: c.lobby.id });
        }
        if (this.lobbies.size >= this.o.maxLobbies) return this.send(c, { t: "error", code: "full", text: "too many lobbies on this service" });
        let id = rid(8);
        while (this.lobbies.has(id)) id = rid(8);
        const lobby: Lobby = { id, meta, host: c, hostRtt: 0, created: Date.now(), lastBeat: Date.now(), peers: new Map() };
        this.lobbies.set(id, lobby);
        c.lobby = lobby;
        this.o.log(`lobby: + ${id} "${meta.name}" by ${meta.host}`);
        this.send(c, { t: "hosted", id });
        break;
      }
      case "meta": {
        if (!c.lobby) return;
        const meta = validateMeta(m.meta);
        if (meta) c.lobby.meta = meta;
        if (typeof m.rtt === "number" && Number.isFinite(m.rtt)) c.lobby.hostRtt = clampInt(m.rtt, 0, 5000, 0);
        c.lobby.lastBeat = Date.now();
        break;
      }
      case "unhost":
        if (c.lobby) this.removeLobby(c.lobby);
        break;
      case "join": {
        const lobby = typeof m.id === "string" ? this.lobbies.get(m.id) : undefined;
        if (!lobby) return this.send(c, { t: "error", code: "nolobby", text: "That lobby is gone." });
        if (lobby.host === c) return this.send(c, { t: "error", code: "self", text: "You are hosting this lobby." });
        if (c.joinTo) {
          // A finished (or abandoned) earlier join: the browser left that hall and is joining again
          // (leave + rejoin, reconnect during a countdown). Forget the old peer instead of refusing.
          const prev = c.joinTo;
          if (c.peer) {
            prev.peers.delete(c.peer);
            if (this.lobbies.get(prev.id) === prev) this.send(prev.host, { t: "peer-gone", peer: c.peer });
          }
          c.joinTo = null;
          c.peer = null;
        }
        if (lobby.peers.size >= 32) return this.send(c, { t: "error", code: "busy", text: "Too many pending joins, try again." });
        const peer = rid(10);
        c.peer = peer;
        c.joinTo = lobby;
        lobby.peers.set(peer, c);
        this.send(c, { t: "joining", peer, id: lobby.id });
        this.send(lobby.host, { t: "peer", peer });
        break;
      }
      case "signal": {
        const data = validSignal(m.data);
        if (!data) return this.strike(c, "bad signal");
        if (c.lobby && typeof m.to === "string") {
          // host -> joiner
          const j = c.lobby.peers.get(m.to);
          if (j) this.send(j, { t: "signal", from: "host", data });
        } else if (c.joinTo && c.peer && this.lobbies.get(c.joinTo.id) === c.joinTo) {
          // joiner -> host
          this.send(c.joinTo.host, { t: "signal", from: c.peer, data });
        }
        break;
      }
    }
  }

  list(): LobbyInfo[] {
    const now = Date.now();
    return [...this.lobbies.values()]
      .map((l) => ({ ...l.meta, id: l.id, hostRtt: l.hostRtt, age: Math.round((now - l.created) / 1000) }))
      .sort((a, b) => Number(a.state === "match") - Number(b.state === "match") || b.players - a.players || a.age - b.age);
  }

  private removeLobby(l: Lobby) {
    if (this.lobbies.get(l.id) !== l) return;
    this.lobbies.delete(l.id);
    l.host.lobby = null;
    for (const j of l.peers.values()) {
      this.send(j, { t: "error", code: "nolobby", text: "The host closed the lobby." });
      j.joinTo = null;
      j.peer = null;
    }
    this.o.log(`lobby: - ${l.id}`);
  }

  /** Expire lobbies whose host stopped heartbeating. */
  private sweep() {
    const cutoff = Date.now() - this.o.expire * 1000;
    for (const l of this.lobbies.values()) if (l.lastBeat < cutoff) this.removeLobby(l);
  }
}

function clientIp(req: IncomingMessage): string {
  // Behind a proxy set HNS_TRUST_PROXY=1 to use X-Forwarded-For.
  if (typeof process !== "undefined" && process.env.HNS_TRUST_PROXY === "1") {
    const f = req.headers["x-forwarded-for"];
    if (typeof f === "string" && f) return f.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "?";
}

/** HNS_ICE='[{"urls":"turn:turn.example.com:3478","username":"u","credential":"p"}, ...]' */
function iceFromEnv(): IceServer[] | null {
  const raw = typeof process !== "undefined" ? process.env.HNS_ICE : undefined;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v) && v.every((s) => s && (typeof s.urls === "string" || Array.isArray(s.urls)))) return v;
  } catch {
    /* fall through */
  }
  console.warn("HNS_ICE is not a valid JSON array of ICE servers; using public STUN");
  return null;
}
