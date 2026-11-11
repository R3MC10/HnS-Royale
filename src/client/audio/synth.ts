// Synthesis primitives used by the sound recipes (sfx.ts) and the music (music.ts).
// Each primitive schedules nodes into `v.out` starting at `v.t + at` and returns its end time.
import type { Engine } from "./engine";

export interface V {
  e: Engine;
  ctx: AudioContext;
  out: AudioNode; // voice input
  verb?: AudioNode; // optional reverb send for this voice
  t: number; // start time
  p: number; // pitch multiplier (variation)
  r: () => number; // 0..1 random
}

type Wave = OscillatorType;

export interface ToneOpts {
  at?: number; // offset seconds
  type?: Wave;
  f: number; // start Hz (before pitch mult)
  f2?: number; // end Hz (exp glide)
  glide?: number; // glide time (default = dur)
  dur: number;
  a?: number; // attack
  vol?: number;
  curve?: "exp" | "lin"; // release shape
  detune?: number; // cents
  filter?: { type: BiquadFilterType; f: number; f2?: number; q?: number };
  verb?: number; // reverb send amount
  pan?: number;
  vib?: { rate: number; depth: number }; // depth in Hz
  dest?: AudioNode;
  noPitch?: boolean;
}

/** Simple enveloped oscillator with optional glide, filter and vibrato. */
export function tone(v: V, o: ToneOpts): number {
  const { ctx } = v;
  const t0 = v.t + (o.at ?? 0);
  const pm = o.noPitch ? 1 : v.p;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(Math.max(1, o.f * pm), t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2 * pm), t0 + (o.glide ?? o.dur));
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  env(g.gain, t0, o.a ?? 0.004, o.dur, o.vol ?? 0.5, o.curve);
  let node: AudioNode = osc;
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib.rate;
    const lg = ctx.createGain();
    lg.gain.value = o.vib.depth;
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + o.dur + 0.05);
  }
  if (o.filter) node = node.connect(filt(v, o.filter, t0, o.dur));
  node.connect(g);
  route(v, g, o.verb, o.pan, o.dest);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
  return t0 + o.dur;
}

export interface NoiseOpts {
  at?: number;
  color?: "white" | "pink" | "brown" | "crackle";
  dur: number;
  a?: number;
  vol?: number;
  curve?: "exp" | "lin";
  filter?: { type: BiquadFilterType; f: number; f2?: number; q?: number };
  filter2?: { type: BiquadFilterType; f: number; f2?: number; q?: number };
  rate?: number; // playback rate
  verb?: number;
  pan?: number;
  dest?: AudioNode;
  hold?: number; // fraction of dur at full level before decay (swells)
}

/** Enveloped, filtered noise burst. */
export function noise(v: V, o: NoiseOpts): number {
  const { ctx } = v;
  const t0 = v.t + (o.at ?? 0);
  const src = ctx.createBufferSource();
  const buf = v.e.noise[o.color ?? "white"];
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = (o.rate ?? 1) * (o.color === "crackle" ? 1 : Math.sqrt(v.p));
  const g = ctx.createGain();
  if (o.hold) {
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.vol ?? 0.5, t0 + (o.a ?? 0.004));
    g.gain.setValueAtTime(o.vol ?? 0.5, t0 + o.dur * o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  } else env(g.gain, t0, o.a ?? 0.002, o.dur, o.vol ?? 0.5, o.curve);
  let node: AudioNode = src;
  if (o.filter) node = node.connect(filt(v, o.filter, t0, o.dur));
  if (o.filter2) node = node.connect(filt(v, o.filter2, t0, o.dur));
  node.connect(g);
  route(v, g, o.verb, o.pan, o.dest);
  src.start(t0, v.r() * (buf.duration - 0.1));
  src.stop(t0 + o.dur + 0.05);
  return t0 + o.dur;
}

/** Inharmonic partial bank: bells, clinks, metal ring, armour. ratios relative to f. */
export function metal(v: V, o: { at?: number; f: number; ratios: number[]; dur: number; vol?: number; decayK?: number; verb?: number; type?: Wave; pan?: number; dest?: AudioNode }): number {
  let end = 0;
  o.ratios.forEach((ra, i) => {
    const d = o.dur * Math.pow(o.decayK ?? 0.75, i);
    end = Math.max(end, tone(v, { at: o.at, type: o.type ?? "sine", f: o.f * ra * (1 + (v.r() - 0.5) * 0.004), dur: d, a: 0.001, vol: (o.vol ?? 0.3) / (1 + i * 0.6), verb: o.verb, pan: o.pan, dest: o.dest }));
  });
  return end;
}

/** FM pair: carrier f, modulator f*ratio with index (Hz deviation) decaying over dur. */
export function fm(v: V, o: { at?: number; f: number; ratio: number; index: number; dur: number; vol?: number; a?: number; type?: Wave; f2?: number; verb?: number; pan?: number; dest?: AudioNode; noPitch?: boolean }): number {
  const { ctx } = v;
  const t0 = v.t + (o.at ?? 0);
  const pm = o.noPitch ? 1 : v.p;
  const car = ctx.createOscillator();
  car.type = o.type ?? "sine";
  car.frequency.setValueAtTime(o.f * pm, t0);
  if (o.f2) car.frequency.exponentialRampToValueAtTime(o.f2 * pm, t0 + o.dur);
  const mod = ctx.createOscillator();
  mod.frequency.setValueAtTime(o.f * o.ratio * pm, t0);
  if (o.f2) mod.frequency.exponentialRampToValueAtTime(o.f2 * o.ratio * pm, t0 + o.dur);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(o.index * pm, t0);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, o.index * 0.05), t0 + o.dur);
  mod.connect(mg).connect(car.frequency);
  const g = ctx.createGain();
  env(g.gain, t0, o.a ?? 0.002, o.dur, o.vol ?? 0.4);
  car.connect(g);
  route(v, g, o.verb, o.pan, o.dest);
  car.start(t0);
  mod.start(t0);
  car.stop(t0 + o.dur + 0.05);
  mod.stop(t0 + o.dur + 0.05);
  return t0 + o.dur;
}

/** Distorted noise/tone grit: route a sub-mix through a waveshaper. Returns the input node. */
export function shaper(v: V, hard = false, out: AudioNode = v.out): AudioNode {
  const ws = v.ctx.createWaveShaper();
  ws.curve = (hard ? v.e.hard : v.e.grit) as Float32Array<ArrayBuffer>;
  ws.oversample = "2x";
  ws.connect(out);
  return ws;
}

/** Copy of v that renders into another node (e.g. a shaper) and/or at an offset. */
export function sub(v: V, out: AudioNode, at = 0): V {
  return { ...v, out, t: v.t + at };
}

// ---- helpers ---------------------------------------------------------------------------

export function env(p: AudioParam, t0: number, a: number, dur: number, vol: number, curve: "exp" | "lin" = "exp") {
  p.setValueAtTime(0.0001, t0);
  if (curve === "lin") {
    p.linearRampToValueAtTime(vol, t0 + a);
    p.linearRampToValueAtTime(0.0001, t0 + dur);
  } else {
    p.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.max(0.001, a));
    p.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a + 0.005, dur));
  }
}

function filt(v: V, f: { type: BiquadFilterType; f: number; f2?: number; q?: number }, t0: number, dur: number): BiquadFilterNode {
  const b = v.ctx.createBiquadFilter();
  b.type = f.type;
  b.frequency.setValueAtTime(Math.min(20000, f.f * v.p), t0);
  if (f.f2) b.frequency.exponentialRampToValueAtTime(Math.min(20000, f.f2 * v.p), t0 + dur);
  if (f.q !== undefined) b.Q.value = f.q;
  return b;
}

function route(v: V, g: GainNode, verb?: number, pan?: number, dest?: AudioNode) {
  let n: AudioNode = g;
  if (pan) {
    const p = v.ctx.createStereoPanner();
    p.pan.value = pan;
    n = g.connect(p);
  }
  n.connect(dest ?? v.out);
  if (verb && v.verb) {
    const s = v.ctx.createGain();
    s.gain.value = verb;
    n.connect(s).connect(v.verb);
  }
}

/** Musical helpers */
export const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
