// Audio engine: context unlock, buses, voice limiter + priority, 2D panning / distance attenuation
// relative to the camera, and shared procedural resources (noise buffers, reverb impulse, grit curve).
// Sample files (samples.ts) and the synth fallback both play through these buses.
//
// Bus layout (the settings stub in ../audio.ts owns the per-channel gain nodes and the
// master / mute-when-unfocused handling, so the options sliders drive everything):
//   voices -> sfxIn  -> sfxComp  -> channels.effects ┐
//             sfxIn  -> sfxVerb  -> channels.effects ├-> master (settings) -> destination
//   music  -> musIn  -> (musVerb) -> channels.music  ┤
//   ui     -> uiIn   ------------->  channels.ui     ┘
import { audioBus } from "../audio";

export type BusName = "sfx" | "music" | "ui";

export interface Engine {
  ctx: AudioContext;
  sfx: GainNode; // dry input of the sfx bus
  sfxVerb: GainNode; // reverb send of the sfx bus
  music: GainNode;
  musicVerb: GainNode;
  ui: GainNode;
  noise: { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer; crackle: AudioBuffer };
  grit: Float32Array; // soft-clip curve for WaveShaper
  hard: Float32Array; // harder clip for distortion
}

let eng: Engine | null = null;
const readyFns: ((e: Engine) => void)[] = [];

/** The engine if audio is unlocked and running, else null (callers just skip the sound). */
export function engine(): Engine | null {
  return eng && eng.ctx.state === "running" ? eng : null;
}
/** The engine even if suspended (for scheduling ahead); null before the first user gesture. */
export function engineAny(): Engine | null {
  return eng;
}
/** Run fn once the engine exists (immediately if it already does). */
export function onEngineReady(fn: (e: Engine) => void) {
  if (eng) fn(eng);
  else readyFns.push(fn);
}

function noiseBuffer(ctx: AudioContext, secs: number, kind: "white" | "pink" | "brown" | "crackle"): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w;
    else if (kind === "pink") {
      // Paul Kellet's refined pink filter
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else if (kind === "brown") {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      // sparse random clicks of varied size: fire crackle, embers, sizzle
      d[i] = Math.random() < 0.0018 ? w * (0.4 + Math.random() * 0.6) : Math.random() < 0.02 ? w * 0.08 : 0;
    }
  }
  return buf;
}

/** Procedural impulse response: decaying stereo noise with a darkening tail (stone hall feel). */
function impulse(ctx: AudioContext, secs: number, decay: number, dark: number): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * secs);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const k = dark * t; // later = darker
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      // a few early reflections
      const er = i < ctx.sampleRate * 0.08 && Math.random() < 0.002 ? (Math.random() * 2 - 1) * 2 : 0;
      d[i] = (lp + er) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

function clipCurve(amount: number): Float32Array {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return c;
}

function build(): Engine | null {
  const b = audioBus();
  if (!b) return null;
  const ctx = b.ctx;

  const sfxIn = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 5;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  sfxIn.connect(comp).connect(b.channels.effects);

  const sfxVerbIn = ctx.createGain();
  sfxVerbIn.gain.value = 0.9;
  const sfxVerb = ctx.createConvolver();
  sfxVerb.buffer = impulse(ctx, 1.8, 3.2, 0.75);
  const sfxVerbOut = ctx.createGain();
  sfxVerbOut.gain.value = 0.35;
  sfxVerbIn.connect(sfxVerb).connect(sfxVerbOut).connect(b.channels.effects);

  const musIn = ctx.createGain();
  const musComp = ctx.createDynamicsCompressor();
  musComp.threshold.value = -18;
  musComp.ratio.value = 3;
  musIn.connect(musComp).connect(b.channels.music);
  const musVerbIn = ctx.createGain();
  const musVerb = ctx.createConvolver();
  musVerb.buffer = impulse(ctx, 4.5, 2.2, 0.85);
  const musVerbOut = ctx.createGain();
  musVerbOut.gain.value = 0.6;
  musVerbIn.connect(musVerb).connect(musVerbOut).connect(musComp);

  const uiIn = ctx.createGain();
  const uiComp = ctx.createDynamicsCompressor();
  uiComp.threshold.value = -10;
  uiIn.connect(uiComp).connect(b.channels.ui);

  return {
    ctx,
    sfx: sfxIn,
    sfxVerb: sfxVerbIn,
    music: musIn,
    musicVerb: musVerbIn,
    ui: uiIn,
    noise: {
      white: noiseBuffer(ctx, 2, "white"),
      pink: noiseBuffer(ctx, 2, "pink"),
      brown: noiseBuffer(ctx, 4, "brown"),
      crackle: noiseBuffer(ctx, 3, "crackle"),
    },
    grit: clipCurve(2.5),
    hard: clipCurve(9),
  };
}

/** Create / resume the context. Must run inside a user gesture the first time. */
export function unlockAudio() {
  if (!eng) {
    eng = build();
    if (eng) for (const fn of readyFns.splice(0)) fn(eng);
  }
  if (eng && eng.ctx.state === "suspended") void eng.ctx.resume();
}

if (typeof window !== "undefined") {
  const gesture = () => unlockAudio();
  for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, gesture, { capture: true });
}

// ---- listener (camera) ------------------------------------------------------------------

export const listener = { x: 0, y: 0, valid: false };
/** Set the camera position in world units; positional sounds pan / attenuate against it. */
export function setListener(x: number, y: number) {
  listener.x = x;
  listener.y = y;
  listener.valid = true;
}

/** Beyond this distance (world px) a positional sound is not played at all. */
export const MAX_DIST = 1500;
/** Full volume within this radius. */
const REF_DIST = 260;

export interface Spatial {
  gain: number;
  pan: number;
  /** lowpass cutoff for distance muffling (Hz) */
  lp: number;
  dist: number;
}

export function spatial(x: number | undefined, y: number | undefined): Spatial | null {
  if (x === undefined || y === undefined || !listener.valid) return { gain: 1, pan: 0, lp: 20000, dist: 0 };
  const dx = x - listener.x;
  const dy = (y - listener.y) * 0.8;
  const d = Math.hypot(dx, dy);
  if (d > MAX_DIST) return null;
  const over = Math.max(0, d - REF_DIST);
  const gain = 1 / (1 + (over / 380) ** 2) * (1 - d / MAX_DIST) ** 0.5;
  const pan = Math.max(-0.85, Math.min(0.85, dx / 650));
  const lp = 18000 * Math.pow(0.12, Math.min(1, over / 1100));
  return { gain, pan, lp, dist: d };
}

// ---- voice limiter ----------------------------------------------------------------------

export interface Voice {
  id: string;
  out: GainNode; // the voice's own output gain (fade to steal)
  start: number;
  end: number;
  prio: number;
  bus: BusName;
  nodes: AudioNode[]; // disconnected when done
}

const MAX_VOICES: Record<BusName, number> = { sfx: 40, ui: 8, music: 64 };
const voices: Voice[] = [];
const recent = new Map<string, number[]>(); // id -> recent start times (instance throttle)

function reap(now: number) {
  for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= now) free(voices.splice(i, 1)[0]);
}
function free(v: Voice) {
  for (const n of v.nodes) {
    try {
      n.disconnect();
    } catch {
      /* already gone */
    }
  }
}

/** Most plays of one sound id per rolling second. */
const MAX_SAME_PER_SEC = 12;

/**
 * Ask for a voice slot. Returns false if the voice should not play (limit reached and nothing of
 * lower priority to steal, or too many copies of the same id this instant / this second).
 */
export function admit(id: string, bus: BusName, prio: number, now: number, maxSame: number): boolean {
  reap(now);
  const r = (recent.get(id) ?? []).filter((t) => now - t < 1);
  let burst = 0;
  for (const t of r) if (now - t < 0.06) burst++;
  // maxSame copies per instant, and never more than MAX_SAME_PER_SEC of one id in a second (multi-hit spam)
  if (burst >= maxSame || r.length >= MAX_SAME_PER_SEC) {
    recent.set(id, r);
    return false;
  }
  r.push(now);
  recent.set(id, r);
  const mine = voices.filter((v) => v.bus === bus);
  if (mine.length < MAX_VOICES[bus]) return true;
  // steal the lowest-priority (oldest on ties) voice that doesn't outrank us
  let victim: Voice | null = null;
  for (const v of mine) if (v.prio <= prio && (!victim || v.prio < victim.prio || (v.prio === victim.prio && v.start < victim.start))) victim = v;
  if (!victim) return false;
  victim.out.gain.cancelScheduledValues(now);
  victim.out.gain.setTargetAtTime(0, now, 0.01);
  const vv = victim;
  voices.splice(voices.indexOf(vv), 1);
  setTimeout(() => free(vv), 80);
  return true;
}

export function track(v: Voice) {
  voices.push(v);
}
export function voiceCount(): number {
  return voices.length;
}
