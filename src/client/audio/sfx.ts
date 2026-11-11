// Sound effects. Public entry: sfx.play(id, opts).
// Each id plays a generated sample (public/audio, see samples.ts) when one is loaded: a random
// variation with slight pitch / volume variance. Every id also keeps its small synthesis recipe,
// which is the fallback whenever the file is missing or failed to decode.
import { MONSTER_BY_ID } from "../../shared/content/monsters";
import type { WeaponKind } from "../../shared/content/types";
import { admit, engine, spatial, track, type BusName } from "./engine";
import { audioLog, pickSample, sampleCount, sampleFile, sampleGain } from "./samples";
import { fm, metal, midi, noise, shaper, sub, tone, type V } from "./synth";

type Recipe = (v: V) => number; // returns end time

interface Meta {
  bus?: BusName;
  prio?: number; // 0..10, higher survives the voice limiter
  vol?: number;
  pv?: number; // pitch variation (+-fraction)
  vv?: number; // volume variation (+-fraction)
  max?: number; // max copies starting within 60 ms
  verb?: number; // reverb send
  cat: string; // category for the test page
}

const R: Record<string, Recipe> = {};
const M: Record<string, Meta> = {};
function def(id: string, meta: Meta, fn: Recipe) {
  R[id] = fn;
  M[id] = meta;
}

// ---- building blocks ------------------------------------------------------------------

const whoosh = (v: V, f: number, f2: number, dur: number, vol: number, q = 1.4, at = 0) =>
  noise(v, { at, color: "pink", dur, a: dur * 0.35, vol, curve: "lin", filter: { type: "bandpass", f, f2, q } });
const thud = (v: V, f: number, f2: number, dur: number, vol: number, at = 0) => tone(v, { at, type: "sine", f, f2, dur, a: 0.002, vol });
const tick = (v: V, f: number, dur: number, vol: number, at = 0) => noise(v, { at, dur, vol, filter: { type: "bandpass", f, q: 2.5 } });
const crackle = (v: V, dur: number, vol: number, at = 0, f = 2500) => noise(v, { at, color: "crackle", dur, vol, a: 0.02, hold: 0.6, filter: { type: "highpass", f } });
const rumble = (v: V, dur: number, vol: number, f = 400, at = 0) => noise(v, { at, color: "brown", dur, vol, a: 0.01, filter: { type: "lowpass", f, f2: f * 0.3 } });

/** Vocal-ish creature sound: rough sawtooth through two formants + breath. */
function vocal(v: V, o: { f: number; f2: number; dur: number; formants: [number, number]; rough: number; vol: number; breath?: number; at?: number; a?: number; type?: OscillatorType }): number {
  const { ctx } = v;
  const t0 = v.t + (o.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sawtooth";
  osc.frequency.setValueAtTime(o.f * v.p, t0);
  osc.frequency.exponentialRampToValueAtTime(o.f2 * v.p, t0 + o.dur);
  // roughness: amplitude modulation at a sub-audio / low-audio rate
  const am = ctx.createGain();
  am.gain.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = o.rough * (0.85 + v.r() * 0.3);
  const lg = ctx.createGain();
  lg.gain.value = 0.4;
  lfo.connect(lg).connect(am.gain);
  osc.connect(am);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol, t0 + (o.a ?? 0.04));
  g.gain.setValueAtTime(o.vol, t0 + o.dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  const dist = shaper(v, false, g);
  for (const [i, ff] of o.formants.entries()) {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = ff * (0.9 + v.r() * 0.2);
    bp.Q.value = 3 + i;
    am.connect(bp).connect(dist);
  }
  g.connect(v.out);
  for (const n of [osc, lfo]) {
    n.start(t0);
    n.stop(t0 + o.dur + 0.05);
  }
  if (o.breath) noise(v, { at: o.at, color: "pink", dur: o.dur, a: 0.05, vol: o.breath, curve: "lin", filter: { type: "bandpass", f: o.formants[1], q: 1.5 } });
  return t0 + o.dur;
}

function zap(v: V, at: number, dur: number, vol: number) {
  const s = shaper(v, true);
  tone(sub(v, s, at), { type: "sawtooth", f: 900 + v.r() * 800, f2: 120, dur, vol: vol * 0.5 });
  noise(sub(v, s, at), { dur: dur * 0.7, vol, filter: { type: "bandpass", f: 3200, q: 1.2 } });
  return v.t + at + dur;
}

/** Simple chord of tones (stingers). */
function chord(v: V, notes: number[], o: { at?: number; dur: number; vol: number; type?: OscillatorType; a?: number; lp?: number; verb?: number; detune?: number }) {
  let end = 0;
  for (const n of notes)
    for (const d of [-(o.detune ?? 6), o.detune ?? 6])
      end = Math.max(
        end,
        tone(v, { at: o.at, type: o.type ?? "sawtooth", f: midi(n), dur: o.dur, a: o.a ?? 0.08, vol: o.vol / notes.length, detune: d, curve: "lin", verb: o.verb, filter: o.lp ? { type: "lowpass", f: o.lp, q: 0.7 } : undefined }),
      );
  return end;
}

// ---- weapons ------------------------------------------------------------------------

const W = { cat: "weapon", prio: 5, vol: 0.55, pv: 0.08, vv: 0.15, max: 3, verb: 0.15 };
def("swing.sword", W, (v) => {
  whoosh(v, 700, 2600, 0.22, 0.7, 1.6);
  return metal(v, { at: 0.04, f: 2900, ratios: [1, 1.51, 2.32], dur: 0.25, vol: 0.025 });
});
def("swing.axe", W, (v) => {
  tone(v, { type: "sine", f: 95, f2: 60, dur: 0.3, a: 0.12, vol: 0.18, curve: "lin" });
  return whoosh(v, 260, 900, 0.34, 0.9, 1.1);
});
def("swing.mace", W, (v) => {
  tone(v, { type: "triangle", f: 80, f2: 55, dur: 0.28, a: 0.1, vol: 0.2, curve: "lin" });
  whoosh(v, 220, 750, 0.3, 0.85, 1.2);
  return tick(v, 1800, 0.03, 0.08, 0.02);
});
def("swing.spear", W, (v) => {
  tone(v, { type: "triangle", f: 190, f2: 140, dur: 0.08, vol: 0.08 });
  return noise(v, { color: "pink", dur: 0.16, a: 0.02, vol: 0.7, filter: { type: "bandpass", f: 1200, f2: 3200, q: 1.8 } });
});
def("swing.dagger", W, (v) => whoosh(v, 1500, 4200, 0.11, 0.55, 2));
def("swing.claw", W, (v) => {
  whoosh(v, 1800, 4500, 0.08, 0.5, 2.5);
  return whoosh(v, 1600, 4000, 0.09, 0.45, 2.5, 0.07);
});
def("swing.staff", W, (v) => {
  tone(v, { type: "sine", f: 220, dur: 0.35, a: 0.1, vol: 0.06, vib: { rate: 7, depth: 6 }, curve: "lin" });
  return whoosh(v, 350, 1200, 0.32, 0.8, 1);
});
def("bow.draw", { ...W, vol: 0.4 }, (v) => {
  // creak: narrow resonant noise + slow sawtooth rising (tension)
  noise(v, { color: "pink", dur: 0.45, a: 0.35, vol: 0.3, curve: "lin", filter: { type: "bandpass", f: 1400, f2: 2200, q: 9 } });
  return tone(v, { type: "sawtooth", f: 55, f2: 75, dur: 0.45, a: 0.3, vol: 0.05, curve: "lin", filter: { type: "lowpass", f: 600 } });
});
def("bow.release", W, (v) => {
  tone(v, { type: "triangle", f: 118, f2: 96, dur: 0.22, vol: 0.35 });
  metal(v, { f: 330, ratios: [1, 2.01, 3.03], dur: 0.15, vol: 0.12 });
  return noise(v, { at: 0.01, color: "pink", dur: 0.14, vol: 0.4, filter: { type: "bandpass", f: 3000, f2: 1600, q: 2 } });
});
def("crossbow.fire", W, (v) => {
  tick(v, 2500, 0.02, 0.6);
  thud(v, 220, 90, 0.1, 0.5);
  tone(v, { type: "triangle", f: 160, f2: 120, dur: 0.18, vol: 0.25 });
  return noise(v, { at: 0.01, color: "pink", dur: 0.15, vol: 0.4, filter: { type: "bandpass", f: 2600, f2: 1300, q: 2 } });
});
def("wand.cast", W, (v) => {
  fm(v, { f: 880, ratio: 3.5, index: 700, dur: 0.22, vol: 0.12, f2: 1300 });
  return noise(v, { dur: 0.2, vol: 0.2, a: 0.03, filter: { type: "highpass", f: 5000 } });
});

// ---- hits ---------------------------------------------------------------------------

const H = { cat: "hit", prio: 6, vol: 0.75, pv: 0.1, vv: 0.15, max: 4, verb: 0.1 };
def("hit.flesh", H, (v) => {
  thud(v, 150, 45, 0.13, 0.8);
  noise(v, { color: "pink", dur: 0.11, vol: 0.5, filter: { type: "lowpass", f: 1100 } });
  return noise(sub(v, shaper(v)), { dur: 0.06, vol: 0.3, filter: { type: "bandpass", f: 450, q: 1.5 } });
});
def("hit.armour", H, (v) => {
  thud(v, 130, 60, 0.1, 0.5);
  tick(v, 3500, 0.03, 0.5);
  return metal(v, { f: 520, ratios: [1, 2.76, 5.4, 8.93], dur: 0.35, vol: 0.25, verb: 0.2 });
});
def("hit.stone", H, (v) => {
  noise(v, { dur: 0.08, vol: 0.6, filter: { type: "bandpass", f: 1300, q: 2 } });
  rumble(v, 0.2, 0.5, 500);
  return thud(v, 95, 50, 0.14, 0.6);
});
def("hit.block", { ...H, prio: 7 }, (v) => {
  const s = shaper(v);
  thud(sub(v, s), 115, 70, 0.18, 0.8);
  metal(v, { f: 300, ratios: [1, 1.48, 2.21, 3.1], dur: 0.32, vol: 0.2, verb: 0.3 });
  return noise(v, { dur: 0.06, vol: 0.5, filter: { type: "lowpass", f: 2200 } });
});
def("hit.evade", { ...H, vol: 0.5 }, (v) => whoosh(v, 1600, 600, 0.16, 0.8, 2));
def("hit.crit", { ...H, prio: 8, vol: 0.9 }, (v) => {
  const s = shaper(v, true);
  thud(sub(v, s), 160, 40, 0.18, 0.7);
  thud(v, 60, 35, 0.3, 0.8);
  noise(v, { dur: 0.05, vol: 0.6, filter: { type: "highpass", f: 4000 } });
  noise(v, { color: "pink", dur: 0.14, vol: 0.5, filter: { type: "lowpass", f: 1400 } });
  return metal(v, { f: 1250, ratios: [1, 2.41, 3.9], dur: 0.45, vol: 0.12, verb: 0.4 });
});
def("hit.self", { ...H, prio: 9, pv: 0.06 }, (v) => {
  thud(v, 120, 42, 0.22, 0.9);
  noise(v, { color: "brown", dur: 0.18, vol: 0.6, filter: { type: "lowpass", f: 700 } });
  return vocal(v, { at: 0.01, f: 150, f2: 100, dur: 0.16, formants: [620, 1150], rough: 35, vol: 0.18, a: 0.01 });
});

// ---- movement -----------------------------------------------------------------------

const S = { cat: "movement", prio: 2, vol: 0.35, pv: 0.12, vv: 0.25, max: 3, verb: 0.05 };
def("dodge.roll", { ...S, prio: 5, vol: 0.6 }, (v) => {
  noise(v, { color: "pink", dur: 0.32, a: 0.05, vol: 0.5, filter: { type: "bandpass", f: 900, f2: 350, q: 1 } });
  noise(v, { color: "pink", dur: 0.25, a: 0.05, vol: 0.12, filter: { type: "highpass", f: 2500 } });
  thud(v, 110, 60, 0.07, 0.4, 0.03);
  return thud(v, 95, 55, 0.08, 0.45, 0.24);
});
def("step.dirt", S, (v) => {
  noise(v, { color: "brown", dur: 0.07, vol: 0.6, filter: { type: "lowpass", f: 600 } });
  return noise(v, { color: "pink", dur: 0.05, vol: 0.2, filter: { type: "bandpass", f: 1600, q: 1.5 } });
});
def("step.grass", S, (v) => {
  thud(v, 85, 60, 0.05, 0.25);
  return noise(v, { color: "pink", dur: 0.1, a: 0.015, vol: 0.25, filter: { type: "highpass", f: 2600 } });
});
def("step.mud", S, (v) => {
  tone(v, { type: "sine", f: 320, f2: 110, dur: 0.09, vol: 0.2, filter: { type: "lowpass", f: 900 } });
  return noise(v, { color: "pink", dur: 0.13, a: 0.02, vol: 0.35, filter: { type: "lowpass", f: 750 } });
});
def("step.water", S, (v) => {
  noise(v, { color: "white", dur: 0.18, a: 0.01, vol: 0.3, filter: { type: "bandpass", f: 1900, f2: 700, q: 1.2 } });
  return tone(v, { at: 0.03 + v.r() * 0.04, type: "sine", f: 600 + v.r() * 300, f2: 1300, dur: 0.04, vol: 0.06 });
});
def("step.stone", S, (v) => {
  noise(v, { dur: 0.035, vol: 0.35, filter: { type: "bandpass", f: 2400, q: 3 } });
  return thud(v, 160, 90, 0.045, 0.35);
});

// ---- skills -------------------------------------------------------------------------

const K = { cat: "skill", prio: 6, vol: 0.6, pv: 0.06, vv: 0.12, max: 3, verb: 0.3 };
def("skill.fire", K, (v) => {
  noise(v, { color: "brown", dur: 0.55, a: 0.12, vol: 0.9, curve: "lin", filter: { type: "lowpass", f: 300, f2: 2600 } });
  tone(v, { type: "sawtooth", f: 62, f2: 48, dur: 0.5, a: 0.1, vol: 0.1, filter: { type: "lowpass", f: 300 } });
  return crackle(v, 0.6, 0.6, 0.05);
});
def("skill.cold", K, (v) => {
  noise(v, { dur: 0.5, a: 0.1, vol: 0.25, curve: "lin", filter: { type: "highpass", f: 6000, f2: 2000 } });
  metal(v, { f: 1800, ratios: [1, 1.34, 2.09, 2.97], dur: 0.7, vol: 0.08, verb: 0.5 });
  return fm(v, { at: 0.03, f: 2400, ratio: 1.41, index: 900, dur: 0.3, vol: 0.05 });
});
def("skill.lightning", K, (v) => {
  zap(v, 0, 0.12, 0.5);
  zap(v, 0.05 + v.r() * 0.04, 0.1, 0.4);
  return crackle(v, 0.35, 0.5, 0.02, 4000);
});
def("skill.chaos", K, (v) => {
  fm(v, { f: 70, ratio: 1.41, index: 420, dur: 0.75, vol: 0.35, a: 0.15, f2: 45 });
  noise(v, { color: "pink", dur: 0.6, a: 0.45, vol: 0.5, curve: "lin", filter: { type: "bandpass", f: 300, f2: 900, q: 7 } });
  tone(v, { type: "sawtooth", f: 110, dur: 0.6, a: 0.2, vol: 0.06, detune: 40, filter: { type: "lowpass", f: 700 } });
  return tone(v, { type: "sawtooth", f: 116.5, dur: 0.6, a: 0.2, vol: 0.06, filter: { type: "lowpass", f: 700 } });
});
def("skill.slam", { ...K, prio: 7, vol: 0.85 }, (v) => {
  const s = shaper(v);
  thud(sub(v, s), 75, 28, 0.6, 1);
  rumble(v, 0.7, 0.9, 900);
  noise(v, { dur: 0.05, vol: 0.5, filter: { type: "bandpass", f: 1500, q: 1 } });
  return crackle(v, 0.6, 0.5, 0.08, 1200);
});
def("skill.projectile", K, (v) => {
  noise(v, { color: "pink", dur: 0.25, a: 0.02, vol: 0.6, filter: { type: "bandpass", f: 2200, f2: 800, q: 2 } });
  return tone(v, { type: "triangle", f: 600, f2: 280, dur: 0.12, vol: 0.08 });
});
def("skill.nova", K, (v) => {
  noise(v, { color: "pink", dur: 0.55, a: 0.04, vol: 0.7, filter: { type: "bandpass", f: 200, f2: 4500, q: 1.5 } });
  tone(v, { type: "sine", f: 110, f2: 440, dur: 0.45, a: 0.02, vol: 0.2 });
  return metal(v, { at: 0.05, f: 660, ratios: [1, 2.02, 2.99], dur: 0.8, vol: 0.06, verb: 0.6 });
});
def("skill.chain", K, (v) => {
  let e = 0;
  for (let i = 0; i < 4; i++) e = zap(v, i * (0.06 + v.r() * 0.03), 0.07, 0.35 - i * 0.05);
  return Math.max(e, crackle(v, 0.4, 0.4, 0, 4000));
});
def("skill.buff", K, (v) => {
  for (const [i, n] of [57, 60, 64, 69].entries()) tone(v, { at: i * 0.05, type: "triangle", f: midi(n), dur: 0.9, a: 0.15, vol: 0.08, vib: { rate: 5, depth: 3 }, verb: 0.4 });
  return noise(v, { dur: 0.8, a: 0.4, vol: 0.08, curve: "lin", filter: { type: "highpass", f: 5000 } });
});
def("skill.summon", K, (v) => {
  vocal(v, { f: 98, f2: 92, dur: 1.1, formants: [400, 850], rough: 6, vol: 0.12, a: 0.4, breath: 0.08 });
  vocal(v, { f: 147, f2: 139, dur: 1.1, formants: [500, 1000], rough: 5, vol: 0.08, a: 0.5 });
  noise(v, { color: "pink", dur: 0.8, a: 0.7, vol: 0.4, curve: "lin", filter: { type: "bandpass", f: 300, f2: 1800, q: 2 } });
  for (let i = 0; i < 6; i++) tick(v, 1800 + v.r() * 1500, 0.02, 0.15, 0.5 + v.r() * 0.5);
  return v.t + 1.15;
});
def("skill.dash", K, (v) => {
  noise(v, { color: "pink", dur: 0.22, a: 0.03, vol: 0.8, filter: { type: "bandpass", f: 500, f2: 3500, q: 1.3 } });
  return noise(v, { at: 0.12, color: "brown", dur: 0.35, a: 0.05, vol: 0.4, filter: { type: "lowpass", f: 900 } });
});
def("skill.aura", { ...K, vol: 0.45 }, (v) => {
  for (const n of [45, 52, 57]) tone(v, { type: "sawtooth", f: midi(n), dur: 1.2, a: 0.5, vol: 0.05, curve: "lin", filter: { type: "lowpass", f: 900 }, vib: { rate: 0.7 + v.r(), depth: 1 } });
  return metal(v, { at: 0.2, f: 880, ratios: [1, 1.5], dur: 1, vol: 0.04, verb: 0.6 });
});

// impacts
def("impact.fire", K, (v) => {
  noise(v, { color: "pink", dur: 0.4, vol: 0.8, filter: { type: "lowpass", f: 3200, f2: 350 } });
  thud(v, 110, 45, 0.2, 0.6);
  return crackle(v, 0.7, 0.5, 0.1);
});
def("impact.cold", K, (v) => {
  metal(v, { f: 2500, ratios: [1, 1.71, 2.93, 4.1], dur: 0.32, vol: 0.12 });
  noise(v, { dur: 0.15, vol: 0.4, filter: { type: "highpass", f: 4000 } });
  return noise(v, { dur: 0.08, vol: 0.4, filter: { type: "bandpass", f: 1400, q: 2 } });
});
def("impact.lightning", K, (v) => {
  noise(sub(v, shaper(v, true)), { dur: 0.08, vol: 0.7, filter: { type: "highpass", f: 1800 } });
  thud(v, 65, 35, 0.2, 0.7);
  return crackle(v, 0.3, 0.4, 0.04, 4000);
});
def("impact.chaos", K, (v) => {
  fm(v, { f: 150, f2: 55, ratio: 0.71, index: 300, dur: 0.35, vol: 0.4 });
  return noise(v, { color: "pink", dur: 0.3, vol: 0.5, filter: { type: "bandpass", f: 520, q: 3 } });
});
def("impact.projectile", K, (v) => {
  thud(v, 210, 80, 0.08, 0.6);
  return tick(v, 2000, 0.03, 0.4);
});
def("boom", { ...K, prio: 8, vol: 0.95, max: 2 }, (v) => {
  const s = shaper(v);
  thud(sub(v, s), 62, 24, 1.0, 1);
  noise(sub(v, s), { color: "brown", dur: 1.3, a: 0.005, vol: 1, filter: { type: "lowpass", f: 2400, f2: 180 } });
  noise(v, { dur: 0.06, vol: 0.5, filter: { type: "highpass", f: 2000 } });
  return crackle(v, 1.1, 0.5, 0.1, 1500);
});

// ---- ailments -----------------------------------------------------------------------

const A = { cat: "ailment", prio: 5, vol: 0.55, pv: 0.07, vv: 0.15, max: 2, verb: 0.25 };
def("ailment.freeze", A, (v) => {
  noise(sub(v, shaper(v, true)), { dur: 0.06, vol: 0.5, filter: { type: "highpass", f: 3000 } });
  metal(v, { f: 1500, ratios: [1, 2.31, 3.72, 5.1], dur: 0.55, vol: 0.14 });
  return noise(v, { at: 0.04, color: "pink", dur: 0.35, a: 0.05, vol: 0.2, filter: { type: "bandpass", f: 900, q: 8 } });
});
def("ailment.chill", A, (v) => {
  noise(v, { dur: 0.45, a: 0.15, vol: 0.18, curve: "lin", filter: { type: "highpass", f: 5500, f2: 3000 } });
  return metal(v, { f: 2600, ratios: [1, 1.5], dur: 0.4, vol: 0.04 });
});
def("ailment.ignite", A, (v) => {
  noise(v, { color: "brown", dur: 0.5, a: 0.05, vol: 0.5, filter: { type: "lowpass", f: 900, f2: 2000 } });
  return crackle(v, 0.9, 0.8, 0, 1800);
});
def("ailment.shock", A, (v) => {
  tone(sub(v, shaper(v, true)), { type: "square", f: 62, dur: 0.35, vol: 0.12, filter: { type: "bandpass", f: 1500, q: 2 } });
  return zap(v, 0, 0.08, 0.4);
});
def("ailment.bleed", A, (v) => {
  tone(v, { type: "sine", f: 900, f2: 280, dur: 0.06, vol: 0.12 });
  return tone(v, { at: 0.12 + v.r() * 0.08, type: "sine", f: 800, f2: 260, dur: 0.06, vol: 0.1 });
});
def("ailment.poison", A, (v) => {
  let e = 0;
  for (let i = 0; i < 5; i++) e = tone(v, { at: i * 0.07 + v.r() * 0.04, type: "sine", f: 250 + v.r() * 300, f2: 500 + v.r() * 400, dur: 0.05, vol: 0.1, filter: { type: "lowpass", f: 1200 } });
  return e;
});

// ---- monsters -----------------------------------------------------------------------

export type MonFamily = "beast" | "caster" | "brute" | "undead" | "spirit";
const MF = { cat: "monster", prio: 4, vol: 0.55, pv: 0.12, vv: 0.15, max: 2, verb: 0.2 };

// beast: feral, mid-pitched snarls
def("mon.beast.growl", MF, (v) => vocal(v, { f: 95, f2: 80, dur: 0.7, formants: [520, 1250], rough: 45, vol: 0.35, a: 0.15, breath: 0.08 }));
def("mon.beast.attack", { ...MF, prio: 5 }, (v) => {
  vocal(v, { f: 190, f2: 120, dur: 0.25, formants: [700, 1600], rough: 55, vol: 0.4, a: 0.02, breath: 0.15 });
  return tick(v, 2200, 0.02, 0.3, 0.2);
});
def("mon.beast.hurt", MF, (v) => vocal(v, { f: 320, f2: 210, dur: 0.15, formants: [800, 1800], rough: 30, vol: 0.3, a: 0.01 }));
def("mon.beast.death", { ...MF, prio: 5 }, (v) => vocal(v, { f: 280, f2: 55, dur: 0.75, formants: [700, 1500], rough: 40, vol: 0.4, a: 0.02, breath: 0.1 }));

// caster: whispery, wet, hissing
def("mon.caster.growl", MF, (v) => {
  noise(v, { color: "pink", dur: 0.9, a: 0.3, vol: 0.3, curve: "lin", filter: { type: "bandpass", f: 2400, q: 4 }, filter2: { type: "bandpass", f: 700, q: 1 } });
  return vocal(v, { f: 140, f2: 125, dur: 0.9, formants: [450, 2300], rough: 9, vol: 0.12, a: 0.3, type: "triangle" });
});
def("mon.caster.attack", { ...MF, prio: 5 }, (v) => {
  noise(v, { color: "pink", dur: 0.45, a: 0.35, vol: 0.35, curve: "lin", filter: { type: "bandpass", f: 600, f2: 2800, q: 5 } });
  return fm(v, { f: 220, f2: 440, ratio: 2.5, index: 300, dur: 0.45, vol: 0.12, a: 0.3 });
});
def("mon.caster.hurt", MF, (v) => vocal(v, { f: 260, f2: 200, dur: 0.18, formants: [600, 2400], rough: 20, vol: 0.22, a: 0.01, breath: 0.15 }));
def("mon.caster.death", { ...MF, prio: 5 }, (v) => {
  vocal(v, { f: 200, f2: 60, dur: 0.9, formants: [500, 1800], rough: 14, vol: 0.25, a: 0.02, breath: 0.2 });
  let e = 0;
  for (let i = 0; i < 6; i++) e = tone(v, { at: 0.3 + i * 0.09 + v.r() * 0.05, type: "sine", f: 180 + v.r() * 200, f2: 400, dur: 0.05, vol: 0.08 });
  return e;
});

// brute: huge, low, stony
def("mon.brute.growl", MF, (v) => {
  rumble(v, 0.9, 0.3, 300);
  return vocal(v, { f: 52, f2: 44, dur: 1.0, formants: [300, 720], rough: 22, vol: 0.45, a: 0.25, breath: 0.05 });
});
def("mon.brute.attack", { ...MF, prio: 6 }, (v) => vocal(v, { f: 85, f2: 60, dur: 0.4, formants: [380, 900], rough: 28, vol: 0.5, a: 0.03, breath: 0.12 }));
def("mon.brute.hurt", MF, (v) => {
  noise(v, { dur: 0.06, vol: 0.3, filter: { type: "bandpass", f: 1400, q: 2 } });
  return vocal(v, { f: 110, f2: 80, dur: 0.2, formants: [400, 950], rough: 25, vol: 0.35, a: 0.01 });
});
def("mon.brute.death", { ...MF, prio: 6 }, (v) => {
  vocal(v, { f: 75, f2: 32, dur: 1.3, formants: [320, 760], rough: 18, vol: 0.5, a: 0.03, breath: 0.08 });
  rumble(v, 1.0, 0.8, 600, 0.5);
  return crackle(v, 0.8, 0.5, 0.5, 900);
});

// undead: hollow moans, bone rattle
const rattle = (v: V, n: number, at: number) => {
  let e = 0;
  for (let i = 0; i < n; i++) e = tick(v, 1500 + v.r() * 2000, 0.015, 0.25, at + i * 0.035 + v.r() * 0.02);
  return e;
};
def("mon.undead.growl", MF, (v) => {
  tone(v, { type: "sine", f: 160, f2: 130, dur: 1.1, a: 0.35, vol: 0.12, vib: { rate: 4.5, depth: 6 }, curve: "lin", filter: { type: "bandpass", f: 400, q: 2 } });
  noise(v, { color: "pink", dur: 1.1, a: 0.4, vol: 0.15, curve: "lin", filter: { type: "bandpass", f: 500, q: 6 } });
  return rattle(v, 4, 0.2);
});
def("mon.undead.attack", { ...MF, prio: 5 }, (v) => {
  rattle(v, 5, 0);
  return whoosh(v, 400, 1400, 0.25, 0.5, 1.4, 0.1);
});
def("mon.undead.hurt", MF, (v) => {
  rattle(v, 3, 0);
  return thud(v, 240, 140, 0.05, 0.3);
});
def("mon.undead.death", { ...MF, prio: 5 }, (v) => {
  tone(v, { type: "sine", f: 180, f2: 70, dur: 0.9, a: 0.05, vol: 0.12, vib: { rate: 5, depth: 8 }, filter: { type: "bandpass", f: 380, q: 2 } });
  return rattle(v, 12, 0.15);
});

// spirit: wails, glassy
def("mon.spirit.growl", MF, (v) => {
  tone(v, { type: "sine", f: 520, f2: 640, dur: 1.2, a: 0.4, vol: 0.07, vib: { rate: 6, depth: 14 }, curve: "lin", verb: 0.6 });
  return noise(v, { dur: 1.2, a: 0.5, vol: 0.06, curve: "lin", filter: { type: "bandpass", f: 1800, q: 10 } });
});
def("mon.spirit.attack", { ...MF, prio: 5 }, (v) => {
  tone(v, { type: "triangle", f: 900, f2: 300, dur: 0.35, vol: 0.12, vib: { rate: 12, depth: 30 } });
  return whoosh(v, 3000, 600, 0.35, 0.4);
});
def("mon.spirit.hurt", MF, (v) => tone(v, { type: "sine", f: 1000, f2: 700, dur: 0.2, vol: 0.1, vib: { rate: 14, depth: 20 } }));
def("mon.spirit.death", { ...MF, prio: 5 }, (v) => {
  tone(v, { type: "sine", f: 700, f2: 120, dur: 1.2, a: 0.02, vol: 0.12, vib: { rate: 7, depth: 25 }, verb: 0.7 });
  return noise(v, { dur: 1.0, vol: 0.12, filter: { type: "bandpass", f: 2400, f2: 400, q: 6 } });
});

def("mon.windup", { ...MF, prio: 5, vol: 0.45 }, (v) =>
  tone(v, { type: "sawtooth", f: 90, f2: 260, dur: 0.45, a: 0.35, vol: 0.2, curve: "lin", filter: { type: "lowpass", f: 300, f2: 1600, q: 4 } }),
);
def("mon.bolt", { ...MF, prio: 4, max: 3 }, (v) => {
  noise(v, { color: "pink", dur: 0.3, a: 0.02, vol: 0.5, filter: { type: "bandpass", f: 900, f2: 400, q: 4 } });
  return fm(v, { f: 300, f2: 160, ratio: 1.5, index: 250, dur: 0.3, vol: 0.12 });
});
def("hazard.warn", { ...MF, prio: 6, vol: 0.5, pv: 0.03 }, (v) => {
  let e = 0;
  for (let i = 0; i < 3; i++) e = tone(v, { at: i * 0.22, type: "sine", f: 70, f2: 55, dur: 0.18, a: 0.02, vol: 0.5 });
  return Math.max(e, tone(v, { type: "sawtooth", f: 55, dur: 0.7, a: 0.5, vol: 0.06, curve: "lin", filter: { type: "lowpass", f: 400 } }));
});

// ---- loot ---------------------------------------------------------------------------

const L = { cat: "loot", prio: 6, vol: 0.55, pv: 0.05, vv: 0.1, max: 3, verb: 0.3 };
def("loot.normal", { ...L, prio: 3, vol: 0.4 }, (v) => {
  thud(v, 320, 180, 0.06, 0.4);
  return tick(v, 1600, 0.03, 0.3);
});
def("loot.magic", L, (v) => {
  thud(v, 300, 170, 0.06, 0.3);
  return metal(v, { at: 0.01, f: 1400, ratios: [1, 2.72, 4.1], dur: 0.3, vol: 0.15 });
});
def("loot.rare", { ...L, prio: 7, vol: 0.65 }, (v) => {
  thud(v, 280, 160, 0.07, 0.3);
  metal(v, { at: 0.0, f: 1760, ratios: [1, 2.76, 4.07], dur: 0.45, vol: 0.18 });
  metal(v, { at: 0.08, f: 2350, ratios: [1, 2.76], dur: 0.5, vol: 0.12, verb: 0.4 });
  return noise(v, { at: 0.05, dur: 0.5, a: 0.1, vol: 0.05, filter: { type: "highpass", f: 6000 } });
});
def("loot.unique", { ...L, prio: 9, vol: 0.85, pv: 0.01, max: 1, verb: 0.5 }, (v) => {
  // deep bell strike + a rising sparkle; unmistakable across the map
  thud(v, 90, 45, 0.6, 0.6);
  metal(v, { f: midi(38), ratios: [1, 2, 2.4, 3, 4.2, 5.4], dur: 3.0, vol: 0.4, decayK: 0.8, verb: 0.6 });
  let e = 0;
  for (const [i, n] of [62, 65, 69, 74, 77].entries()) e = metal(v, { at: 0.25 + i * 0.09, f: midi(n + 12), ratios: [1, 2.01], dur: 1.2, vol: 0.07, verb: 0.6 });
  noise(v, { at: 0.2, dur: 1.4, a: 0.5, vol: 0.06, curve: "lin", filter: { type: "highpass", f: 6500 } });
  return Math.max(e, v.t + 3);
});
def("loot.currency", { ...L, max: 2 }, (v) => {
  let e = 0;
  for (let i = 0; i < 3; i++) e = metal(v, { at: i * (0.045 + v.r() * 0.03), f: 3000 + v.r() * 1200, ratios: [1, 1.43, 2.6], dur: 0.18, vol: 0.12 });
  return e;
});
def("loot.currency.rare", { ...L, prio: 8, vol: 0.7, max: 1 }, (v) => {
  thud(v, 140, 60, 0.3, 0.5);
  metal(v, { f: midi(69), ratios: [1, 2.0, 3.01, 4.2], dur: 1.6, vol: 0.2, verb: 0.6 });
  let e = 0;
  for (let i = 0; i < 6; i++) e = metal(v, { at: 0.08 + i * 0.05, f: 2600 + i * 350, ratios: [1, 1.43], dur: 0.25, vol: 0.06 });
  return Math.max(e, v.t + 1.6);
});
def("loot.gem", L, (v) => {
  fm(v, { f: 1900, ratio: 2.01, index: 500, dur: 0.6, vol: 0.12 });
  return metal(v, { at: 0.03, f: 2850, ratios: [1, 1.5, 2.25], dur: 0.6, vol: 0.06 });
});
def("loot.flask", L, (v) => {
  metal(v, { f: 2100, ratios: [1, 2.3], dur: 0.2, vol: 0.1 });
  return noise(v, { at: 0.03, color: "pink", dur: 0.25, a: 0.05, vol: 0.2, filter: { type: "bandpass", f: 700, f2: 1300, q: 5 } });
});
def("loot.pickup", { ...L, bus: "ui", prio: 6, verb: 0 }, (v) => {
  noise(v, { color: "pink", dur: 0.09, a: 0.02, vol: 0.4, filter: { type: "bandpass", f: 900, q: 1.5 } });
  return metal(v, { at: 0.03, f: 2400, ratios: [1, 2.7], dur: 0.12, vol: 0.06 });
});

// ---- progression --------------------------------------------------------------------

const P = { cat: "progression", prio: 8, vol: 0.6, pv: 0.02, vv: 0.05, max: 1, verb: 0.4 };
def("flask.drink", { ...P, prio: 7, pv: 0.06 }, (v) => {
  metal(v, { f: 2300, ratios: [1, 2.3], dur: 0.12, vol: 0.06 });
  let e = 0;
  for (let i = 0; i < 3; i++) {
    const at = 0.1 + i * 0.16;
    tone(v, { at, type: "sine", f: 180, f2: 420, dur: 0.07, vol: 0.25, filter: { type: "lowpass", f: 900 } });
    e = noise(v, { at, color: "pink", dur: 0.1, vol: 0.2, filter: { type: "bandpass", f: 600, q: 3 } });
  }
  return Math.max(e, tone(v, { at: 0.5, type: "sine", f: midi(76), dur: 0.5, vol: 0.04, verb: 0.5 }));
});
def("flask.empty", { ...P, bus: "ui", prio: 6 }, (v) => {
  metal(v, { f: 1500, ratios: [1, 2.2], dur: 0.1, vol: 0.08 });
  return tone(v, { at: 0.03, type: "triangle", f: 140, f2: 110, dur: 0.15, vol: 0.2 });
});
def("levelup", P, (v) => {
  noise(v, { dur: 1.4, a: 0.6, vol: 0.06, curve: "lin", filter: { type: "highpass", f: 5000 } });
  chord(v, [50, 57, 62], { dur: 1.6, vol: 0.18, a: 0.3, lp: 1500, verb: 0.5 });
  let e = 0;
  for (const [i, n] of [62, 66, 69, 74].entries()) e = metal(v, { at: 0.1 + i * 0.12, f: midi(n + 12), ratios: [1, 2, 3.01], dur: 1.2, vol: 0.1, verb: 0.6 });
  return Math.max(e, v.t + 1.6);
});
def("ascendancy", { ...P, prio: 9, vol: 0.75 }, (v) => {
  thud(v, 55, 30, 2.0, 0.8);
  metal(v, { f: midi(31), ratios: [1, 1.52, 2.0, 2.71, 3.4, 4.6], dur: 4, vol: 0.35, decayK: 0.85, verb: 0.7 });
  chord(v, [43, 50, 55, 59], { at: 0.4, dur: 2.6, vol: 0.25, a: 0.9, lp: 1200, verb: 0.6 });
  chord(v, [45, 52, 57, 61, 64], { at: 1.6, dur: 2.4, vol: 0.25, a: 0.4, lp: 2200, verb: 0.6 });
  return v.t + 4;
});
def("shrine.trial", { ...P, vol: 0.6 }, (v) => {
  metal(v, { f: midi(36), ratios: [1, 2.32, 3.1, 4.4], dur: 3, vol: 0.25, decayK: 0.85, verb: 0.7 });
  vocal(v, { at: 0.2, f: 110, f2: 104, dur: 2.2, formants: [380, 1700], rough: 4, vol: 0.06, a: 1, breath: 0.08 });
  noise(v, { at: 0.1, color: "pink", dur: 2.5, a: 1.2, vol: 0.12, curve: "lin", filter: { type: "bandpass", f: 2200, q: 8 } });
  return metal(v, { at: 1.2, f: midi(79), ratios: [1, 2.76], dur: 1.6, vol: 0.06, verb: 0.8 });
});
def("passive.allocate", { ...P, bus: "ui", prio: 7, vol: 0.5, pv: 0.04, max: 2 }, (v) => {
  thud(v, 180, 90, 0.12, 0.3);
  return metal(v, { f: midi(76), ratios: [1, 2, 3.02], dur: 0.6, vol: 0.12, verb: 0.4 });
});
def("gem.socket", { ...P, bus: "ui", prio: 7, vol: 0.5, pv: 0.04, max: 2 }, (v) => {
  tick(v, 2600, 0.03, 0.4);
  return fm(v, { at: 0.02, f: 1500, ratio: 2.4, index: 400, dur: 0.45, vol: 0.1 });
});

// ---- UI -----------------------------------------------------------------------------

const U = { cat: "ui", bus: "ui" as BusName, prio: 5, vol: 0.45, pv: 0.04, vv: 0.08, max: 2, verb: 0 };
def("ui.click", U, (v) => {
  tone(v, { type: "triangle", f: 950, f2: 620, dur: 0.035, vol: 0.25 });
  return tick(v, 3200, 0.015, 0.15);
});
def("ui.hover", { ...U, prio: 1, vol: 0.18, max: 1 }, (v) => tone(v, { type: "triangle", f: 2300, dur: 0.02, vol: 0.12 }));
def("ui.open", U, (v) => {
  noise(v, { color: "pink", dur: 0.2, a: 0.06, vol: 0.3, filter: { type: "bandpass", f: 700, f2: 1800, q: 1.2 } });
  return thud(v, 120, 80, 0.1, 0.35, 0.08);
});
def("ui.close", U, (v) => {
  noise(v, { color: "pink", dur: 0.16, a: 0.04, vol: 0.28, filter: { type: "bandpass", f: 1600, f2: 600, q: 1.2 } });
  return thud(v, 100, 70, 0.08, 0.3, 0.06);
});
def("ui.error", U, (v) => {
  tone(v, { type: "square", f: 110, dur: 0.09, vol: 0.12, filter: { type: "lowpass", f: 700 } });
  return tone(v, { at: 0.11, type: "square", f: 98, dur: 0.12, vol: 0.12, filter: { type: "lowpass", f: 700 } });
});
// ---- Breachway (lane mode) -----------------------------------------------------------
def("struct.collapse", { ...K, cat: "lanes", prio: 9, vol: 1, max: 2, verb: 0.35 }, (v) => {
  // stone cracking, a long grinding rumble as it sinks, then the slabs landing
  crackle(v, 0.5, 0.7, 0, 1800);
  noise(v, { dur: 0.05, vol: 0.5, filter: { type: "highpass", f: 2500 } });
  rumble(v, 2.0, 0.9, 380, 0.15);
  noise(v, { at: 0.3, color: "pink", dur: 1.4, a: 0.2, vol: 0.35, filter: { type: "bandpass", f: 260, f2: 120, q: 1.4 } });
  thud(sub(v, shaper(v)), 70, 28, 0.9, 0.9, 0.85);
  for (let i = 0; i < 5; i++) thud(v, 180 + v.r() * 120, 70, 0.12, 0.35, 0.95 + i * 0.09 + v.r() * 0.05);
  return crackle(v, 0.9, 0.35, 1.0, 1200);
});
def("lane.gold", { ...L, cat: "lanes", bus: "ui", prio: 6, vol: 0.5, max: 2, verb: 0.1 }, (v) => {
  let e = 0;
  for (let i = 0; i < 2; i++) e = metal(v, { at: i * 0.07, f: 2300 + i * 700 + v.r() * 200, ratios: [1, 1.43, 2.6], dur: 0.22, vol: 0.12 });
  return e;
});
def("shop.buy", { ...U, cat: "lanes", vol: 0.55 }, (v) => {
  noise(v, { color: "pink", dur: 0.12, a: 0.01, vol: 0.3, filter: { type: "bandpass", f: 1200, q: 2 } });
  let e = 0;
  for (let i = 0; i < 4; i++) e = metal(v, { at: 0.04 + i * 0.04, f: 2600 + v.r() * 900, ratios: [1, 1.43], dur: 0.15, vol: 0.09 });
  return Math.max(e, thud(v, 160, 90, 0.1, 0.3, 0.02));
});
def("shop.sell", { ...U, cat: "lanes", vol: 0.5 }, (v) => {
  thud(v, 140, 80, 0.1, 0.3);
  let e = 0;
  for (let i = 0; i < 3; i++) e = metal(v, { at: 0.08 + i * 0.05, f: 3200 - i * 300 + v.r() * 300, ratios: [1, 1.5], dur: 0.14, vol: 0.08 });
  return e;
});
def("spire.lock", { ...U, cat: "lanes", prio: 7, vol: 0.5, max: 1 }, (v) => {
  tone(v, { type: "square", f: 880, dur: 0.06, vol: 0.12, filter: { type: "lowpass", f: 2400 } });
  return tone(v, { at: 0.09, type: "square", f: 1175, dur: 0.09, vol: 0.12, filter: { type: "lowpass", f: 2400 } });
});

def("lane.waypoint", { ...L, cat: "lanes", prio: 6, vol: 0.55, max: 2, verb: 0.3 }, (v) => {
  noise(v, { color: "pink", dur: 0.55, a: 0.2, vol: 0.22, filter: { type: "bandpass", f: 900, q: 1.2 } });
  let e = 0;
  for (let i = 0; i < 3; i++) e = metal(v, { at: 0.08 + i * 0.09, f: midi(72 + i * 4), ratios: [1, 2.01], dur: 0.5, vol: 0.08 });
  return e;
});

def("ui.confirm", U, (v) => {
  metal(v, { f: midi(69), ratios: [1, 2.01], dur: 0.35, vol: 0.12 });
  return metal(v, { at: 0.08, f: midi(76), ratios: [1, 2.01], dur: 0.45, vol: 0.12 });
});
def("ui.tab", U, (v) => noise(v, { color: "pink", dur: 0.08, a: 0.01, vol: 0.3, filter: { type: "highpass", f: 1500 } }));
def("inv.pick", U, (v) => {
  noise(v, { color: "pink", dur: 0.07, a: 0.01, vol: 0.35, filter: { type: "bandpass", f: 1300, q: 1.4 } });
  return tick(v, 2600, 0.02, 0.12, 0.02);
});
def("inv.place", U, (v) => {
  thud(v, 190, 110, 0.06, 0.4);
  return metal(v, { at: 0.005, f: 1900, ratios: [1, 2.6], dur: 0.08, vol: 0.05 });
});
def("inv.equip", U, (v) => {
  noise(v, { color: "pink", dur: 0.1, a: 0.02, vol: 0.3, filter: { type: "bandpass", f: 900, q: 1.2 } });
  metal(v, { at: 0.06, f: 1150, ratios: [1, 2.4, 3.9], dur: 0.2, vol: 0.12 });
  return thud(v, 150, 90, 0.07, 0.35, 0.06);
});
def("inv.drop", U, (v) => {
  thud(v, 140, 70, 0.1, 0.45);
  return tick(v, 1400, 0.04, 0.2, 0.02);
});

// ---- stingers -----------------------------------------------------------------------

const X = { cat: "stinger", prio: 10, vol: 0.75, pv: 0, vv: 0, max: 1, verb: 0.5 };
def("player.death", X, (v) => {
  thud(v, 70, 25, 1.6, 0.9);
  metal(v, { f: midi(29), ratios: [1, 1.41, 2.13, 2.97, 4.07], dur: 4, vol: 0.4, decayK: 0.85, verb: 0.7 });
  chord(v, [41, 42, 48], { at: 0.2, dur: 3, vol: 0.3, a: 0.8, lp: 700, verb: 0.6, detune: 12 });
  return noise(v, { color: "brown", dur: 3, a: 0.05, vol: 0.4, filter: { type: "lowpass", f: 500, f2: 80 } });
});
def("kill.player", X, (v) => {
  const s = shaper(v);
  thud(sub(v, s), 90, 30, 0.6, 0.9);
  chord(v, [38, 45, 50, 53], { at: 0.02, dur: 1.4, vol: 0.4, a: 0.02, lp: 1300, verb: 0.5 });
  return metal(v, { at: 0.02, f: midi(50), ratios: [1, 2.4, 3.8], dur: 1.5, vol: 0.15, verb: 0.6 });
});
def("kill.distant", { ...X, prio: 6, vol: 0.4 }, (v) => metal(v, { f: midi(45), ratios: [1, 2.01, 2.4, 3.0, 4.2], dur: 2.5, vol: 0.2, decayK: 0.8, verb: 0.8 }));
def("victory", X, (v) => {
  // i - VI - VII - I (picardy)
  const prog = [[38, 45, 50, 53], [34, 46, 50, 53], [36, 48, 52, 55], [38, 50, 54, 57, 62]];
  prog.forEach((c, i) => {
    chord(v, c, { at: i * 0.75, dur: i === 3 ? 2.6 : 0.85, vol: 0.38, a: 0.05, lp: 1400 + i * 300, verb: 0.5 });
    thud(v, 80, 40, 0.35, 0.7, i * 0.75);
  });
  metal(v, { at: 2.25, f: midi(62), ratios: [1, 2, 3.01, 4.2], dur: 2.5, vol: 0.2, verb: 0.7 });
  return v.t + 4.9;
});
def("defeat", X, (v) => {
  const prog = [[41, 48, 53, 56], [40, 47, 52, 55], [36, 43, 48, 51]];
  prog.forEach((c, i) => chord(v, c, { at: i * 1.1, dur: i === 2 ? 3 : 1.3, vol: 0.32, a: 0.4, lp: 900 - i * 150, verb: 0.6 }));
  metal(v, { at: 2.2, f: midi(24), ratios: [1, 1.41, 2.13, 2.97], dur: 3.5, vol: 0.35, verb: 0.7 });
  return v.t + 5.5;
});
def("round.countdown", { ...X, prio: 8, vol: 0.5, max: 1 }, (v) => {
  tick(v, 900, 0.04, 0.5);
  return tone(v, { type: "sine", f: midi(45), dur: 0.4, vol: 0.2 });
});
def("round.start", X, (v) => {
  // war horn: two detuned saws, filter opening, with a drum hit
  for (const [n, d] of [[38, -8], [38, 8], [50, 0]] as [number, number][])
    tone(v, { type: "sawtooth", f: midi(n) * 0.97, f2: midi(n), glide: 0.25, dur: 1.9, a: 0.2, vol: 0.12, detune: d, curve: "lin", filter: { type: "lowpass", f: 300, f2: 1600, q: 2 }, verb: 0.5 });
  thud(v, 70, 35, 0.6, 0.9);
  return rumble(v, 0.8, 0.5, 600);
});
def("players.few", { ...X, prio: 8, vol: 0.55 }, (v) => {
  metal(v, { f: midi(40), ratios: [1, 2.01, 2.4, 3.0, 4.2], dur: 2.4, vol: 0.25, verb: 0.8 });
  return metal(v, { at: 1.1, f: midi(40), ratios: [1, 2.01, 2.4, 3.0, 4.2], dur: 2.4, vol: 0.25, verb: 0.8 });
});

// ---- gore ---------------------------------------------------------------------------

const G = { cat: "gore", prio: 4, vol: 0.55, pv: 0.12, vv: 0.15, max: 2, verb: 0.1 };
def("gore.splat", G, (v) => {
  noise(v, { color: "pink", dur: 0.12, vol: 0.6, filter: { type: "lowpass", f: 1600, f2: 500 } });
  return tone(v, { type: "sine", f: 260, f2: 90, dur: 0.07, vol: 0.25 });
});
def("gore.squelch", G, (v) => {
  noise(v, { color: "pink", dur: 0.22, a: 0.02, vol: 0.6, filter: { type: "bandpass", f: 400, f2: 900, q: 3 } });
  tone(v, { type: "sine", f: 180, f2: 420, dur: 0.12, vol: 0.2, filter: { type: "lowpass", f: 800 } });
  return tone(v, { at: 0.08, type: "sine", f: 350, f2: 140, dur: 0.1, vol: 0.15 });
});
def("gore.gib", G, (v) => {
  let e = 0;
  for (let i = 0; i < 4; i++) {
    const at = i * (0.06 + v.r() * 0.07);
    thud(v, 160 + v.r() * 80, 60, 0.07, 0.35, at);
    e = noise(v, { at, color: "pink", dur: 0.08, vol: 0.35, filter: { type: "lowpass", f: 1200 } });
  }
  return e;
});
def("gore.dismember", { ...G, prio: 5 }, (v) => {
  whoosh(v, 1400, 3800, 0.1, 0.5, 2);
  noise(v, { at: 0.05, color: "pink", dur: 0.25, a: 0.02, vol: 0.5, filter: { type: "bandpass", f: 700, f2: 1400, q: 2.5 } });
  crackle(v, 0.2, 0.4, 0.05, 900);
  return tone(v, { at: 0.06, type: "sine", f: 220, f2: 80, dur: 0.12, vol: 0.3 });
});
def("gore.explode", { ...G, prio: 6, vol: 0.75 }, (v) => {
  thud(v, 75, 30, 0.4, 0.9);
  noise(v, { color: "pink", dur: 0.45, vol: 0.8, filter: { type: "lowpass", f: 2200, f2: 300 } });
  noise(v, { at: 0.03, color: "pink", dur: 0.3, vol: 0.4, filter: { type: "bandpass", f: 500, q: 2 } });
  let e = 0;
  for (let i = 0; i < 5; i++) e = thud(v, 140 + v.r() * 100, 60, 0.06, 0.25, 0.15 + v.r() * 0.35);
  return Math.max(e, v.t + 0.5);
});
def("gore.bonecrack", G, (v) => {
  noise(sub(v, shaper(v, true)), { dur: 0.035, vol: 0.6, filter: { type: "bandpass", f: 2200, q: 2 } });
  tick(v, 1300, 0.03, 0.4, 0.02);
  return thud(v, 200, 120, 0.05, 0.3);
});

// ---- sample-only ids (no synth recipe: silent when the file is missing) -------------------

R["shrine.buff"] = R["shrine.trial"];
M["shrine.buff"] = { ...P, prio: 7 };
const AMB = { cat: "ambience", prio: 1, vol: 0.5, pv: 0.06, vv: 0.2, max: 1, verb: 0.35 };
for (const id of ["amb.owl", "amb.wolf", "amb.crow", "amb.creak", "amb.twig"]) M[id] = AMB;

/** Playback level of a sample per category (files are loudness-normalised per category offline). */
const SAMPLE_VOL: Record<string, number> = { weapon: 0.8, hit: 0.9, movement: 0.5, skill: 0.8, ailment: 0.7, monster: 0.8, loot: 0.7, progression: 0.8, ui: 0.6, stinger: 0.9, gore: 0.8, ambience: 0.5 };

// ---- public API ---------------------------------------------------------------------

export interface PlayOpts {
  /** world position; omit for a non-positional sound */
  x?: number;
  y?: number;
  /** volume multiplier (default 1) */
  vol?: number;
  /** pitch multiplier (default 1); random variation is applied on top */
  pitch?: number;
  /** override the voice priority (0..10) */
  prio?: number;
  /** delay in seconds */
  delay?: number;
}

let rngState = (Math.random() * 2 ** 31) | 0;
function rng(): number {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function play(id: string, o: PlayOpts = {}): boolean {
  const e = engine();
  const recipe = R[id];
  const m = M[id];
  if (!e || !m) return false;
  const sample = pickSample(id, rng);
  if (!sample && !recipe) return false;
  const sp = spatial(o.x, o.y);
  if (!sp) return false;
  const busName = m.bus ?? "sfx";
  const prio = (o.prio ?? m.prio ?? 5) - (sp.dist > 700 ? 1 : 0);
  const now = e.ctx.currentTime;
  if (!admit(id, busName, prio, now, m.max ?? 4)) return false;
  const ctx = e.ctx;
  const t = now + 0.005 + (o.delay ?? 0);
  const pv = m.pv ?? 0.05;
  const vv = m.vv ?? 0.1;
  const pitch = (o.pitch ?? 1) * (1 + (rng() * 2 - 1) * pv);
  const vol = (sample ? (SAMPLE_VOL[m.cat] ?? 0.7) * sampleGain(id) : m.vol ?? 0.5) * (o.vol ?? 1) * (1 + (rng() * 2 - 1) * vv) * sp.gain;
  if (vol < 0.003) return false;

  const vin = ctx.createGain();
  vin.gain.value = vol;
  let chain: AudioNode = vin;
  if (sp.lp < 16000) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = sp.lp;
    chain = chain.connect(lp);
  }
  if (sp.pan) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = sp.pan;
    chain = chain.connect(pan);
  }
  const out = ctx.createGain();
  chain.connect(out);
  const busIn = busName === "ui" ? e.ui : busName === "music" ? e.music : e.sfx;
  out.connect(busIn);
  // reverb: distant sounds are wetter
  let verbIn: GainNode | undefined;
  if (busName !== "ui") {
    verbIn = ctx.createGain();
    const send = ctx.createGain();
    send.gain.value = vol * (0.25 + Math.min(1, sp.dist / 900) * 0.6);
    verbIn.connect(send).connect(busName === "music" ? e.musicVerb : e.sfxVerb);
    if (m.verb) {
      const base = ctx.createGain();
      base.gain.value = m.verb / Math.max(0.001, vol);
      chain.connect(base).connect(verbIn);
    }
  }
  const v: V = { e, ctx, out: vin, verb: verbIn, t, p: pitch, r: rng };
  let end = t + 0.5;
  if (sample) {
    const src = ctx.createBufferSource();
    src.buffer = sample;
    src.playbackRate.value = pitch;
    src.connect(vin);
    src.start(t);
    end = t + sample.duration / pitch;
    audioLog(id, "sample", sampleFile(sample));
  } else {
    try {
      end = recipe(v);
    } catch (err) {
      console.warn("sfx recipe failed", id, err);
    }
    audioLog(id, "synth");
  }
  const voice = { id, out, start: now, end: end + 0.15, prio, bus: busName, nodes: [vin, out, ...(verbIn ? [verbIn] : [])] as AudioNode[] };
  track(voice);
  return true;
}

const SWING: Partial<Record<WeaponKind, string>> = {
  sword: "swing.sword",
  axe: "swing.axe",
  mace: "swing.mace",
  sceptre: "swing.mace",
  spear: "swing.spear",
  dagger: "swing.dagger",
  claw: "swing.claw",
  quarterstaff: "swing.staff",
  staff: "swing.staff",
  wand: "wand.cast",
  bow: "bow.release",
  crossbow: "crossbow.fire",
};

const FAMILY: Record<string, MonFamily> = { gnashling: "beast", bog_seer: "caster", cragback: "brute" };

export const sfx = {
  play,
  /** Swing / fire sound id for a weapon kind (unarmed -> dagger-ish whoosh). */
  swingFor(wk: WeaponKind | string | null | undefined): string {
    return (wk && SWING[wk as WeaponKind]) || "swing.dagger";
  },
  /** Give a monster type id a voice family (monsters agent: call once per new monster). */
  registerFamily(k: string, fam: MonFamily) {
    FAMILY[k] = fam;
  },
  /** Monster type id -> voice family; unknown ids fall back by AI type, then by name. */
  monFamily(k: string): MonFamily {
    const f = FAMILY[k];
    if (f) return f;
    const t = MONSTER_BY_ID.get(k);
    if (t?.family) return t.family as MonFamily;
    if (t) return t.ai === "ranged" ? "caster" : t.ai === "brute" ? "brute" : "beast";
    if (/skel|bone|ghoul|zomb|dead|lich|crypt|grave/.test(k)) return "undead";
    if (/wraith|ghost|spirit|shade|wisp|spectre/.test(k)) return "spirit";
    return "beast";
  },
  /** Every registered id (for the test page and docs). */
  ids(): string[] {
    return Object.keys(M);
  },
  /** How many decoded sample variations this id has (0 = it plays the synth recipe). */
  samples(id: string): number {
    return sampleCount(id);
  },
  category(id: string): string {
    return M[id]?.cat ?? "?";
  },
  has(id: string): boolean {
    return id in M;
  },
};
