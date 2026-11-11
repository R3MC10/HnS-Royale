// DEV-ONLY match replay. Open the client with ?dev=1&replay=<url of a recording>, where the recording
// is the gzip "<tick>\t<json>" message stream one player received (src/server/devrecord.ts). The
// lines are fed to the normal client at 30 ticks/s through a fake ClientConn, so the camera, HUD,
// spawn pick, kill feed and results screen are exactly that player's. Nothing is sent anywhere.
// Inert unless both ?dev=1 and ?replay= are present.
//   &hold=1     wait for window.hnsReplay.start() instead of starting on load
//   &speed=N    playback speed multiplier (spot checks)
//   &skip=T     fast-forward (deliver instantly) up to recording tick T
import type { ClientConn } from "../net/transport";

const params = (() => {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
})();

export const REPLAY_URL: string | null = params.get("dev") === "1" ? params.get("replay") : null;
/** True when this page is a dev replay viewer (no input is simulated or sent). */
export const REPLAYING = !!REPLAY_URL;

const TICK_MS = 1000 / 30;

export interface ReplayStatus {
  state: "loading" | "ready" | "playing" | "done" | "error";
  /** Recording tick being played. */
  tick: number;
  /** Lines delivered so far. */
  lines: number;
  /** Highest tick decoded so far. */
  decoded: number;
  eof: boolean;
  err?: string;
  start(): void;
}

export function startReplay(attach: (conn: ClientConn) => void) {
  if (!REPLAY_URL) return;
  const speed = Math.max(0.1, Number(params.get("speed")) || 1);
  const skip = Number(params.get("skip")) || 0;
  const queue: [number, string][] = [];
  let qi = 0;
  const st: ReplayStatus = { state: "loading", tick: 0, lines: 0, decoded: 0, eof: false, start: () => begin() };
  (window as unknown as { hnsReplay: ReplayStatus }).hnsReplay = st;

  const conn: ClientConn = {
    open: true,
    send: () => {},
    close: () => {},
    onMessage: () => {},
    onClose: () => {},
  };

  // ---- streaming decode (keeps a bounded buffer ahead of the playhead) -------------------
  let pullWaiter: (() => void) | null = null;
  const AHEAD = 6000;
  async function decode() {
    const res = await fetch(REPLAY_URL!);
    if (!res.ok || !res.body) throw new Error(`replay fetch ${res.status}`);
    const gz = REPLAY_URL!.endsWith(".gz");
    const body = gz ? res.body.pipeThrough(new DecompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>) : res.body;
    const reader = body.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
    let rest = "";
    for (;;) {
      while (queue.length - qi > AHEAD) await new Promise<void>((r) => (pullWaiter = r));
      const { value, done } = await reader.read();
      if (done) break;
      rest += value;
      let nl: number;
      let from = 0;
      while ((nl = rest.indexOf("\n", from)) >= 0) {
        const line = rest.slice(from, nl);
        from = nl + 1;
        const tab = line.indexOf("\t");
        if (tab > 0) {
          const t = Number(line.slice(0, tab));
          queue.push([t, line.slice(tab + 1)]);
          st.decoded = t;
        }
      }
      rest = rest.slice(from);
      if (st.state === "loading" && queue.length > 200) st.state = "ready";
    }
    st.eof = true;
    if (st.state === "loading") st.state = "ready";
  }
  decode().catch((e) => {
    st.err = String((e as Error).message ?? e);
    // A truncated file (recording still open) plays up to where it ends.
    if (queue.length) {
      st.eof = true;
      if (st.state === "loading") st.state = "ready";
    } else st.state = "error";
  });

  // ---- playback -----------------------------------------------------------------------------
  let started = false;
  let clock0 = 0;
  let tick0 = 0;
  function begin() {
    if (started) return;
    started = true;
    attach(conn);
    st.state = "playing";
    tick0 = queue[qi]?.[0] ?? 0;
    clock0 = performance.now();
    pump();
  }
  function deliver(upTo: number) {
    while (qi < queue.length && queue[qi][0] <= upTo) {
      const data = queue[qi][1];
      qi++;
      st.lines++;
      try {
        conn.onMessage(data);
      } catch (e) {
        console.error("replay message failed", e);
      }
    }
    if (qi > 4000) {
      queue.splice(0, qi);
      qi = 0;
    }
    if (pullWaiter && queue.length - qi <= AHEAD) {
      const w = pullWaiter;
      pullWaiter = null;
      w();
    }
  }
  function pump() {
    let now = tick0 + ((performance.now() - clock0) / TICK_MS) * speed;
    if (skip > now) {
      deliver(skip);
      tick0 = Math.max(tick0, skip);
      clock0 = performance.now();
      now = tick0;
    }
    // Decoder fell behind: hold the clock rather than skipping ticks.
    if (qi >= queue.length && !st.eof) {
      clock0 += 8;
    }
    st.tick = Math.floor(now);
    deliver(now);
    if (st.eof && qi >= queue.length) {
      st.state = "done";
      return;
    }
    setTimeout(pump, 8);
  }
  if (params.get("hold") !== "1") {
    const wait = () => (st.state === "ready" ? begin() : st.state === "error" ? undefined : setTimeout(wait, 50));
    wait();
  }
}
