// The host's game + lobby-room core, driven by ToWorker messages and answering with FromWorker
// messages. Runs inside the Web Worker (src/net/hostworker.ts) and, when the worker script can't be
// loaded, inline on the page's main thread (src/net/hostbridge.ts fallback). Browser-safe: no DOM.
import { TICK_RATE } from "../shared/constants";
import { HostRuntime } from "./hostruntime";
import type { HostConn } from "./transport";

export type ToWorker =
  | { k: "init"; hostName: string; settings?: Record<string, unknown>; dev?: boolean }
  | { k: "open"; id: number; host?: boolean }
  | { k: "msg"; id: number; d: string }
  | { k: "close"; id: number }
  | { k: "hidden"; v: boolean }
  | { k: "hub"; port: number; token: string } // desktop app: connect to the LAN relay hub from here
  | { k: "shutdown"; reason: string };

export type FromWorker =
  | { k: "ready" } // the worker script loaded and evaluated
  | { k: "send"; id: number; d: string; r: boolean }
  | { k: "close"; id: number; reason: string }
  | { k: "meta"; meta: unknown }
  | { k: "lag"; ms: number }
  | { k: "error"; text: string } // an exception inside the host (the game keeps running)
  | { k: "problem"; text: string } // shown as is in the hall chat
  | { k: "hubfail"; port: number; token: string } // the hub socket could not open here: the page connects instead
  | { k: "batch"; m: FromWorker[] }; // several messages from one tick (hostworker.ts), in order

export interface HostCore {
  handle(m: ToWorker): void;
  /** Stop the tick loop (inline mode, on shutdown). */
  stop(): void;
}

export function createHostCore(post: (m: FromWorker) => void): HostCore {
  let rt: HostRuntime | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let errReported = 0;
  const conns = new Map<number, HostConn>();
  const perf = { n: 0, sum: 0, max: 0 };
  (globalThis as { __hostPerf?: typeof perf }).__hostPerf = perf;

  const reportError = (where: string, err: unknown) => {
    console.error(`host ${where} error:`, err);
    // Throttle: one report per 5 s is plenty for the host's chat.
    const now = Date.now();
    if (now - errReported < 5000) return;
    errReported = now;
    const e = err as { message?: string; stack?: string };
    post({ k: "error", text: `${where}: ${e?.message ?? String(err)}` });
  };

  function makeConn(id: number): HostConn {
    let open = true;
    return {
      get open() {
        return open && conns.has(id);
      },
      send: (d, reliable = true) => {
        if (open) post({ k: "send", id, d, r: reliable });
      },
      close: (reason) => {
        if (!open) return;
        open = false;
        post({ k: "close", id, reason: reason ?? "closed" });
        // The bridge confirms with {k:"close"} which removes it from the runtime.
      },
    };
  }

  // ---- desktop app LAN hub (electron/main.mjs), connected from here so LAN guests' messages never
  // queue behind the host page's main thread (its panels, chunk builds, garbage collection) ----
  /** Hub guest ids live above the bridge's own peer ids. */
  const HUB_BASE = 1 << 24;
  let hub: WebSocket | null = null;
  const hubSend = (m: unknown) => {
    if (hub?.readyState === 1) hub.send(JSON.stringify(m));
  };
  function hubConn(hid: number): HostConn {
    const id = HUB_BASE + hid;
    let open = true;
    return {
      get open() {
        return open && conns.has(id);
      },
      send: (d) => {
        if (open) hubSend({ t: "send", id: hid, d });
      },
      close: () => {
        if (!open) return;
        open = false;
        hubSend({ t: "close", id: hid });
        // Leave the runtime asynchronously, like a bridge peer (never re-enter it from inside its own call).
        queueMicrotask(() => {
          const c = conns.get(id);
          if (!c || !rt) return;
          conns.delete(id);
          rt.close(c);
        });
      },
    };
  }
  function connectHub(port: number, token: string) {
    if (hub || typeof WebSocket === "undefined") return post({ k: "hubfail", port, token });
    let opened = false;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?host=${encodeURIComponent(token)}`);
    hub = ws;
    ws.onopen = () => (opened = true);
    ws.onmessage = (e) => {
      let m: { t: string; id: number; d?: string };
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (!rt || typeof m.id !== "number") return;
      const id = HUB_BASE + m.id;
      try {
        if (m.t === "open") {
          const old = conns.get(id);
          if (old) {
            conns.delete(id);
            rt.close(old);
          }
          const c = hubConn(m.id);
          conns.set(id, c);
          rt.open(c, false);
        } else if (m.t === "msg" && typeof m.d === "string") {
          const c = conns.get(id);
          if (c) rt.message(c, m.d);
        } else if (m.t === "close") {
          const c = conns.get(id);
          if (c) {
            conns.delete(id);
            rt.close(c);
          }
        }
      } catch (err) {
        reportError("hub", err);
      }
    };
    ws.onclose = () => {
      if (hub !== ws) return;
      hub = null;
      for (const [id, c] of [...conns]) {
        if (id < HUB_BASE) continue;
        conns.delete(id);
        rt?.close(c);
      }
      if (stopped) return;
      if (!opened) post({ k: "hubfail", port, token }); // never connected from the worker: the page tries
      else post({ k: "problem", text: "The local network relay stopped: players on your network join over the internet relays instead." });
    };
  }

  function startLoop() {
    const TICK_MS = 1000 / TICK_RATE;
    let nextTick = performance.now();
    const loop = () => {
      if (stopped) return;
      const now = performance.now();
      let steps = 0;
      while (now >= nextTick && steps < 5) {
        const t0 = performance.now();
        try {
          rt!.tick();
        } catch (err) {
          reportError("tick", err);
        }
        // Tick cost, readable from a debugger (self.__hostPerf in the worker): count / total ms / worst ms.
        const ms = performance.now() - t0;
        perf.n++;
        perf.sum += ms;
        if (ms > perf.max) perf.max = ms;
        nextTick += TICK_MS;
        steps++;
      }
      if (now - nextTick > TICK_MS * 5) {
        post({ k: "lag", ms: Math.round(now - nextTick) });
        nextTick = now; // fell far behind: resync
      }
      timer = setTimeout(loop, Math.max(0, nextTick - performance.now()));
    };
    loop();
  }

  return {
    handle(m: ToWorker) {
      try {
        switch (m.k) {
          case "init":
            if (rt) return;
            rt = new HostRuntime({ hostName: m.hostName, settings: m.settings, dev: m.dev, onMeta: (meta) => post({ k: "meta", meta }) });
            startLoop();
            break;
          case "open": {
            if (!rt || conns.has(m.id)) return;
            const c = makeConn(m.id);
            conns.set(m.id, c);
            rt.open(c, !!m.host);
            break;
          }
          case "msg": {
            const c = conns.get(m.id);
            if (c && rt) rt.message(c, m.d);
            break;
          }
          case "close": {
            const c = conns.get(m.id);
            if (!c || !rt) return;
            conns.delete(m.id);
            rt.close(c);
            break;
          }
          case "hidden":
            rt?.setHostHidden(m.v);
            break;
          case "hub":
            connectHub(m.port, m.token);
            break;
          case "shutdown":
            rt?.shutdown(m.reason);
            break;
        }
      } catch (err) {
        reportError(m.k, err);
      }
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      try {
        hub?.close();
      } catch {
        /* ignore */
      }
    },
  };
}
