// Sample bank: generated audio files under public/audio/, described by audio/manifest.json.
//   sfx:   id -> list of variation files. All preloaded and decoded once the engine exists.
//   music: track name -> one looping file. Loaded lazily the first time a track is wanted.
//   amb:   loop name -> one looping file (lazy as well).
// Anything missing from the manifest, 404ing or failing to decode is simply absent here, and the
// callers (sfx.ts / music.ts) fall back to the synthesised sound.
import { onEngineReady, type Engine } from "./engine";

export interface Manifest {
  v: number;
  /** id -> files relative to audio/ */
  sfx: Record<string, string[]>;
  /** optional per-id playback gain (default 1) */
  gain?: Record<string, number>;
  music: Record<string, { f: string; g?: number }>;
  amb: Record<string, { f: string; g?: number }>;
}

const BASE = "audio/";
let manifest: Manifest | null = null;
let manifestTried = false;
let eng: Engine | null = null;
const waiters: (() => void)[] = [];

const sfxBufs = new Map<string, AudioBuffer[]>();
const lastPick = new Map<string, number>();
const failed: string[] = [];
let sfxTotal = 0;
let sfxDone = 0;

type Status = "idle" | "loading" | "ready" | "failed";
interface Track {
  status: Status;
  buf: AudioBuffer | null;
  g: number;
}
const tracks = new Map<string, Track>();

// ---- debug log (which file / synth recipe answered each trigger) -------------------------

export interface AudioLogEntry {
  t: number;
  id: string;
  src: "sample" | "synth" | "music" | "amb";
  file?: string;
}
const LOG_MAX = 600;
const log: AudioLogEntry[] = [];
export function audioLog(id: string, src: AudioLogEntry["src"], file?: string) {
  if (log.length >= LOG_MAX) log.splice(0, LOG_MAX / 2);
  log.push({ t: Math.round(performance.now()), id, src, file });
}

async function fetchDecode(ctx: BaseAudioContext, file: string): Promise<AudioBuffer | null> {
  try {
    const r = await fetch(BASE + file);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await ctx.decodeAudioData(await r.arrayBuffer());
  } catch (err) {
    failed.push(file);
    console.warn("audio file unavailable, using synth fallback:", file, err);
    return null;
  }
}

async function boot(e: Engine) {
  eng = e;
  manifestTried = true;
  try {
    const r = await fetch(BASE + "manifest.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    manifest = (await r.json()) as Manifest;
  } catch (err) {
    console.warn("audio manifest unavailable, everything stays synthesised:", err);
    manifest = null;
  }
  for (const w of waiters.splice(0)) w();
  if (!manifest) return;
  // preload every sfx variation, a few at a time
  const jobs: [string, number, string][] = [];
  for (const [id, files] of Object.entries(manifest.sfx)) files.forEach((f, i) => jobs.push([id, i, f]));
  sfxTotal = jobs.length;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const [id, i, f] = jobs[next++];
      const buf = await fetchDecode(e.ctx, f);
      sfxDone++;
      if (!buf) continue;
      let arr = sfxBufs.get(id);
      if (!arr) sfxBufs.set(id, (arr = []));
      arr.push(buf);
      (buf as AudioBuffer & { hnsFile?: string }).hnsFile = f;
      void i;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}
onEngineReady((e) => void boot(e));

/** A decoded variation for this id (never the same one twice in a row), or null -> use the synth. */
export function pickSample(id: string, rnd: () => number): AudioBuffer | null {
  const arr = sfxBufs.get(id);
  if (!arr || !arr.length) return null;
  let k = Math.floor(rnd() * arr.length);
  if (arr.length > 1 && k === lastPick.get(id)) k = (k + 1 + Math.floor(rnd() * (arr.length - 1))) % arr.length;
  lastPick.set(id, k);
  return arr[k];
}
export function sampleFile(buf: AudioBuffer): string {
  return (buf as AudioBuffer & { hnsFile?: string }).hnsFile ?? "?";
}
export function sampleGain(id: string): number {
  return manifest?.gain?.[id] ?? 1;
}
export function sampleCount(id: string): number {
  return sfxBufs.get(id)?.length ?? 0;
}
/** Ids the manifest lists (whether or not they decoded). */
export function manifestSfxIds(): string[] {
  return manifest ? Object.keys(manifest.sfx) : [];
}

/**
 * Looping track (music or ambience) by name. Returns its state right away and starts loading on
 * first use: "loading" -> ask again later, "failed" -> no file, use the synth.
 */
export function track(kind: "music" | "amb", name: string): Track {
  const key = kind + ":" + name;
  let t = tracks.get(key);
  if (t) return t;
  t = { status: "idle", buf: null, g: 1 };
  tracks.set(key, t);
  const tt = t;
  const start = () => {
    const def = manifest?.[kind]?.[name];
    if (!def || !eng) {
      tt.status = "failed";
      return;
    }
    tt.g = def.g ?? 1;
    tt.status = "loading";
    void fetchDecode(eng.ctx, def.f).then((buf) => {
      tt.buf = buf;
      tt.status = buf ? "ready" : "failed";
      if (buf) (buf as AudioBuffer & { hnsFile?: string }).hnsFile = def.f;
    });
  };
  if (manifestTried && (manifest || eng)) start();
  else {
    tt.status = "loading";
    waiters.push(start);
  }
  return t;
}

export function sampleStats() {
  return { manifest: !!manifest, sfxFiles: sfxTotal, sfxLoaded: sfxDone, sfxIds: sfxBufs.size, failed: failed.slice(), tracks: Object.fromEntries([...tracks].map(([k, v]) => [k, v.status])) };
}

if (typeof window !== "undefined") Object.assign(window, { hnsAudioLog: log, hnsAudioStats: sampleStats });
