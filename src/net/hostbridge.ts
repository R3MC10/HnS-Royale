// Main-thread side of hosting: spawns the host worker (public/hostworker.js), gives the host
// player a loopback ClientConn into it, opens the hall's room code (src/net/p2p.ts: Trystero relays
// + the desktop app's LAN hub), advertises it in the room list and relays guests' bytes to / from
// the worker.
import type { FromWorker, HostCore, ToWorker } from "./hostcore";
import type { LobbyMeta } from "./lobbyproto";
import { HostRoom, lobby, newCode, type HostLink } from "./p2p";
import type { ClientConn } from "./transport";

const LOCAL_ID = 0;

// The worker script sits next to the client bundle (public/hostworker.js). Resolve it against the
// bundle's own <script> URL, not the page URL, so pages under another path still find it.
// window.HNS_HOSTWORKER overrides (full or relative URL).
const SCRIPT_BASE = (() => {
  try {
    return (document.currentScript as HTMLScriptElement | null)?.src || location.href;
  } catch {
    return "";
  }
})();

export function hostWorkerUrl(): string {
  try {
    const o = (window as unknown as { HNS_HOSTWORKER?: string }).HNS_HOSTWORKER;
    return new URL(o || "hostworker.js", SCRIPT_BASE || location.href).href;
  } catch {
    return "hostworker.js";
  }
}

/** Why a worker script failed to load: a plain `error` Event carries no message, so ask the server. */
async function probeWorkerScript(url: string): Promise<string> {
  try {
    const r = await fetch(url, { method: "GET", cache: "no-store" });
    if (!r.ok) return `${url} answered HTTP ${r.status} (was the client built? npm run dev / npm run build output public/hostworker.js)`;
    const ct = r.headers.get("content-type") ?? "";
    if (!/javascript|ecmascript/i.test(ct)) return `${url} is served as "${ct || "no content type"}", browsers only start workers from JavaScript`;
    return `${url} loaded but did not start (blocked by the page's security policy or a script error)`;
  } catch (err) {
    return `${url} could not be fetched (${(err as Error).message})`;
  }
}

export class HostSession {
  readonly local: ClientConn;
  /** The hall's 5-character room code. */
  readonly code = newCode();
  /** Called when the host's tab visibility changes (menus show a warning). */
  onHidden: (hidden: boolean) => void = () => {};
  /** Called with a human-readable problem (lobby service lost, worker crashed...). */
  onProblem: (text: string) => void = () => {};
  lastMeta: LobbyMeta | null = null;

  private worker: Worker | null = null;
  /** Main-thread fallback when the worker script can't be loaded. */
  private inline: HostCore | null = null;
  /** The worker answered (script loaded): no more fallback. */
  private workerReady = false;
  /** Everything posted before the worker answered (replayed into the inline fallback). */
  private backlog: ToWorker[] = [];
  /** "worker" (normal) or "inline" (fallback: the game runs on this page's main thread). */
  mode: "worker" | "inline" = "worker";
  private peers = new Map<number, { key: string; link: HostLink }>();
  private byKey = new Map<string, number>();
  private nextId = 1;
  private room: HostRoom;
  private published = false;
  private localOpen = true;
  private stopped = false;
  private onVis = () => {
    const hidden = document.visibilityState === "hidden";
    this.post({ k: "hidden", v: hidden });
    this.onHidden(hidden);
  };

  constructor(hostName: string, settings: Record<string, unknown>, dev = false) {
    this.room = new HostRoom(this.code, {
      onOpen: (key, link) => {
        if (this.stopped) return link.close();
        const old = this.byKey.get(key);
        if (old !== undefined) this.dropPeer(old);
        const id = this.nextId++;
        this.peers.set(id, { key, link });
        this.byKey.set(key, id);
        this.post({ k: "open", id });
      },
      onMessage: (key, d) => {
        const id = this.byKey.get(key);
        if (id !== undefined) this.post({ k: "msg", id, d });
      },
      onClose: (key) => {
        const id = this.byKey.get(key);
        if (id !== undefined) this.dropPeer(id);
      },
    });
    this.room.onProblem = (t) => this.onProblem(t);
    const url = hostWorkerUrl();
    try {
      const w = new Worker(url);
      this.worker = w;
      w.onmessage = (e: MessageEvent<FromWorker>) => {
        if (!this.workerReady) {
          this.workerReady = true;
          this.backlog.length = 0;
        }
        this.fromWorker(e.data);
      };
      w.onerror = (e: ErrorEvent) => {
        e.preventDefault?.();
        if (!this.workerReady) {
          // A bare Event (no message) = the script never loaded (404, wrong MIME type, CSP...).
          const known = e.message ? `${e.message}${e.filename ? ` (${e.filename}:${e.lineno})` : ""}` : "";
          this.fallbackInline(known ? `the host worker failed to start: ${known}` : "", url);
        } else {
          this.onProblem(`The host worker crashed: ${e.message || "unknown error"}${e.filename ? ` (${e.filename}:${e.lineno})` : ""}. Close the hall and host again.`);
        }
      };
      w.onmessageerror = () => this.onProblem("The host worker sent a message that could not be read.");
    } catch (err) {
      // Worker construction itself refused (file:// pages, CSP, no Worker support).
      queueMicrotask(() => this.fallbackInline(`workers are unavailable here (${(err as Error).message})`, url));
    }

    const self = this;
    this.local = {
      get open() {
        return self.localOpen;
      },
      send: (d) => self.localOpen && self.post({ k: "msg", id: LOCAL_ID, d }),
      close: () => self.stop("The host closed the lobby."),
      onMessage: () => {},
      onClose: () => {},
    };
    this.post({ k: "init", hostName, settings, dev });
    this.post({ k: "open", id: LOCAL_ID, host: true });
    document.addEventListener("visibilitychange", this.onVis);
  }

  private post(m: ToWorker) {
    if (this.stopped) return;
    if (this.inline) {
      const core = this.inline;
      queueMicrotask(() => core.handle(m)); // async, like a worker: never re-enter the caller
      return;
    }
    if (!this.workerReady) this.backlog.push(m);
    this.worker?.postMessage(m); // (null while the inline fallback loads: replayed from the backlog)
  }

  /** The worker script could not run: host on this page's main thread instead (same code). */
  private fallbackInline(reason: string, url: string) {
    if (this.inline || this.mode === "inline" || this.stopped) return;
    this.worker?.terminate();
    this.worker = null;
    this.mode = "inline";
    // Loaded lazily: the server code only runs on this page when the fallback is actually needed.
    void import("./hostcore").then(({ createHostCore }) => {
      if (this.stopped) return;
      this.inline = createHostCore((m) => queueMicrotask(() => this.fromWorker(m)));
      const replay = this.backlog.splice(0);
      for (const m of replay) this.post(m);
    }, (err) => this.onProblem(`Could not start the host at all: ${(err as Error).message}`));
    const say = (why: string) =>
      this.onProblem(`Hosting without the background worker: ${why}. The match runs on this page instead, so keep this tab in the foreground.`);
    if (reason) say(reason);
    else void probeWorkerScript(url).then((why) => !this.stopped && say(`the host worker script could not be loaded: ${why}`));
  }

  /** Open the room code and list the hall in the room browser. */
  async publish(): Promise<void> {
    await this.room.start();
    this.published = true;
    lobby.advertise(this.room.ad(this.lastMeta ?? { name: "Lobby", host: "Host", players: 1, max: 20, biome: "random", size: "auto", state: "room" }));
  }

  private fromWorker(m: FromWorker) {
    switch (m.k) {
      case "ready":
        break;
      case "error":
        this.onProblem(`Host error (the game keeps running): ${m.text}`);
        break;
      case "send":
        if (m.id === LOCAL_ID) {
          // Loopback: deliver asynchronously so the client never re-enters the worker bridge.
          const d = m.d;
          if (this.localOpen) queueMicrotask(() => this.local.onMessage(d));
        } else {
          this.peers.get(m.id)?.link.send(m.d, m.r);
        }
        break;
      case "close":
        if (m.id === LOCAL_ID) return;
        this.dropPeer(m.id);
        break;
      case "meta": {
        this.lastMeta = m.meta as LobbyMeta;
        if (this.published && !this.stopped) lobby.advertise(this.room.ad(this.lastMeta));
        break;
      }
      case "lag":
        console.warn(`host tick fell ${m.ms} ms behind`);
        break;
    }
  }

  private dropPeer(id: number) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    if (this.byKey.get(p.key) === id) this.byKey.delete(p.key);
    p.link.close();
    this.post({ k: "close", id });
  }

  /** Close the lobby: everyone gets a "host left" message, the worker stops. */
  stop(reason = "The host closed the lobby.") {
    if (this.stopped) return;
    this.post({ k: "shutdown", reason });
    // Give the shutdown notice a moment to reach peers over the reliable channel.
    const peers = [...this.peers.keys()];
    const worker = this.worker;
    const inline = this.inline;
    const room = this.room;
    setTimeout(() => {
      for (const id of peers) this.dropPeer(id);
      worker?.terminate();
      inline?.stop();
      room.stop();
    }, 300);
    this.stopped = true;
    lobby.advertise(null);
    document.removeEventListener("visibilitychange", this.onVis);
    if (this.localOpen) {
      this.localOpen = false;
      this.local.onClose(reason);
    }
  }
}
