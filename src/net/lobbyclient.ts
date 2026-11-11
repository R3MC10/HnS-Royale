// Browser client for the lobby list + signalling service (src/lobby/service.ts).
import { DEFAULT_ICE, LOBBY_PATH, type IceServer, type LobbyClientMsg, type LobbyInfo, type LobbyServerMsg } from "./lobbyproto";

/** Service URL: ?lobby=host:port (or a full ws(s):// URL) overrides; default is this page's origin. */
export function lobbyUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  let q: string | null = null;
  try {
    q = new URLSearchParams(location.search).get("lobby") ?? (window as unknown as { HNS_LOBBY?: string }).HNS_LOBBY ?? null;
  } catch {
    /* ignore */
  }
  if (q) return /^wss?:\/\//.test(q) ? q : `${proto}//${q}${LOBBY_PATH}`;
  return `${proto}//${location.host}${LOBBY_PATH}`;
}

type Handler = (m: LobbyServerMsg) => void;

export class LobbyClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private opening: Promise<void> | null = null;
  ice: IceServer[] = DEFAULT_ICE;
  heartbeat = 5;
  /** Smoothed RTT to the service (ms). */
  rtt = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  onClose: () => void = () => {};

  get open() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    if (this.open) return Promise.resolve();
    if (this.opening) return this.opening;
    this.opening = new Promise<void>((res, rej) => {
      const ws = new WebSocket(lobbyUrl());
      this.ws = ws;
      let hello = false;
      const t = setTimeout(() => {
        if (!hello) {
          ws.close();
          rej(new Error("The lobby service did not answer."));
        }
      }, 6000);
      ws.onmessage = (e) => {
        let m: LobbyServerMsg;
        try {
          m = JSON.parse(e.data as string);
        } catch {
          return;
        }
        if (m.t === "hello") {
          hello = true;
          clearTimeout(t);
          if (Array.isArray(m.ice) && m.ice.length) this.ice = m.ice;
          this.heartbeat = m.heartbeat || 5;
          res();
        } else if (m.t === "pong") {
          const r = performance.now() - m.c;
          this.rtt = this.rtt ? this.rtt * 0.7 + r * 0.3 : r;
        }
        for (const h of [...this.handlers]) h(m);
      };
      ws.onerror = () => {
        clearTimeout(t);
        if (!hello) rej(new Error("Could not reach the lobby service."));
      };
      ws.onclose = () => {
        clearTimeout(t);
        if (this.ws === ws) this.ws = null;
        this.opening = null;
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;
        if (!hello) rej(new Error("Could not reach the lobby service."));
        this.onClose();
      };
    }).then(() => {
      this.opening = null;
      this.ping();
      this.pingTimer = setInterval(() => this.ping(), 3000);
    });
    this.opening.catch(() => (this.opening = null));
    return this.opening;
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }

  private ping() {
    this.send({ t: "ping", c: performance.now() });
  }

  send(m: LobbyClientMsg) {
    if (this.open) this.ws!.send(JSON.stringify(m));
  }

  on(h: Handler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  /** Wait for the first message matching pred. */
  wait<T extends LobbyServerMsg>(pred: (m: LobbyServerMsg) => m is T, ms = 6000): Promise<T> {
    return new Promise((res, rej) => {
      const off = this.on((m) => {
        if (pred(m)) {
          off();
          clearTimeout(t);
          res(m);
        }
      });
      const t = setTimeout(() => {
        off();
        rej(new Error("The lobby service timed out."));
      }, ms);
    });
  }

  async list(): Promise<LobbyInfo[]> {
    await this.connect();
    const p = this.wait((m): m is Extract<LobbyServerMsg, { t: "lobbies" }> => m.t === "lobbies");
    this.send({ t: "list" });
    return (await p).list;
  }
}
