// Music. Generated tracks (public/audio/music, loaded lazily through samples.ts) play as loops and
// cross-fade: menu, lobby, and in a match explore <-> combat <-> boss, driven by the same state the
// synth used. If a track's file is missing or fails to decode, the generative synth scene below
// plays for that state instead.
//
// Synth fallback: one "scene" graph plays at a time (menu / lobby / match); scenes
// crossfade. Match music is per biome: a detuned drone, a filtered wind bed and sparse motifs,
// plus a combat layer (drums + bass ostinato) driven by `combat` and a tense late-match layer
// (tremolo cluster + clock tick) driven by `late`. All synthesised; nothing is sampled.
import { ambience } from "./ambience";
import { engineAny, onEngineReady, type Engine } from "./engine";
import { audioLog, track } from "./samples";
import { fm, metal, midi, noise, tone, type V } from "./synth";

export type MusicScene = "none" | "menu" | "lobby" | "match";

export interface MusicState {
  scene: MusicScene;
  biome: string;
  /** 0..1 combat intensity (monsters aggroed, hits, nearby players) */
  combat: number;
  /** 0..1 late-match tension (few players left) */
  late: number;
  /** 0..1 a boss is engaged near the listener (optional, default 0) */
  boss?: number;
}

interface BiomeMusic {
  root: number; // midi
  scale: number[];
  windF: number;
  windQ: number;
  bpm: number;
  bell: "pluck" | "bell" | "metal";
}

const BIOMES: Record<string, BiomeMusic> = {
  hollowpine: { root: 38, scale: [0, 2, 3, 5, 7, 8, 10], windF: 520, windQ: 1.2, bpm: 84, bell: "pluck" },
  gloamwater: { root: 37, scale: [0, 1, 3, 5, 7, 8, 10], windF: 300, windQ: 2, bpm: 76, bell: "bell" },
  brokenspire: { root: 33, scale: [0, 1, 3, 5, 6, 8, 10], windF: 950, windQ: 6, bpm: 92, bell: "metal" },
};
const MENU: BiomeMusic = { root: 38, scale: [0, 2, 3, 5, 7, 9, 10], windF: 400, windQ: 1, bpm: 60, bell: "bell" };

let rs = 0x2f6b1d3;
const rnd = () => {
  rs ^= rs << 13;
  rs ^= rs >>> 17;
  rs ^= rs << 5;
  return ((rs >>> 0) % 100000) / 100000;
};

class Scene {
  out: GainNode;
  private oscs: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private motifG: GainNode;
  private combatG: GainNode;
  private lateG: GainNode;
  private droneLp: BiquadFilterNode;
  private nextMotif = 0;
  private nextStep = 0;
  private step = 0;
  private combat = 0;
  private late = 0;
  private dead = false;

  constructor(
    private e: Engine,
    readonly kind: MusicScene,
    readonly biome: string,
    private m: BiomeMusic,
  ) {
    const ctx = e.ctx;
    const now = ctx.currentTime;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0.0001, now);
    this.out.gain.exponentialRampToValueAtTime(1, now + 3);
    this.out.connect(e.music);
    const verbSend = ctx.createGain();
    verbSend.gain.value = 0.5;
    this.out.connect(verbSend).connect(e.musicVerb);

    // drone: root + fifth (+ octave in menu), detuned saws into a slowly breathing lowpass
    this.droneLp = ctx.createBiquadFilter();
    this.droneLp.type = "lowpass";
    this.droneLp.frequency.value = kind === "match" ? 260 : 420;
    this.droneLp.Q.value = 3;
    const droneG = ctx.createGain();
    droneG.gain.value = kind === "match" ? 0.16 : 0.13;
    this.droneLp.connect(droneG).connect(this.out);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + rnd() * 0.04;
    const lfoG = ctx.createGain();
    lfoG.gain.value = kind === "match" ? 120 : 200;
    lfo.connect(lfoG).connect(this.droneLp.frequency);
    this.start(lfo);
    const notes = kind === "match" ? [0, 7, -12] : [0, 7, 12, 15];
    for (const n of notes)
      for (const d of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midi(m.root + n);
        o.detune.value = d + rnd() * 3;
        const g = ctx.createGain();
        g.gain.value = 1 / notes.length;
        o.connect(g).connect(this.droneLp);
        this.start(o);
      }

    // wind / ambience bed
    const wind = ctx.createBufferSource();
    wind.buffer = e.noise.brown;
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = m.windF;
    bp.Q.value = m.windQ;
    const wlfo = ctx.createOscillator();
    wlfo.frequency.value = 0.07 + rnd() * 0.05;
    const wlg = ctx.createGain();
    wlg.gain.value = m.windF * 0.5;
    wlfo.connect(wlg).connect(bp.frequency);
    const wg = ctx.createGain();
    wg.gain.value = kind === "match" ? 0.5 : 0.25;
    wind.connect(bp).connect(wg).connect(this.out);
    this.start(wind);
    this.start(wlfo);

    this.motifG = ctx.createGain();
    this.motifG.gain.value = 0.9;
    this.motifG.connect(this.out);
    this.combatG = ctx.createGain();
    this.combatG.gain.value = 0.0001;
    this.combatG.connect(this.out);
    this.lateG = ctx.createGain();
    this.lateG.gain.value = 0.0001;
    this.lateG.connect(this.out);

    // late layer: high minor-second cluster with tremolo (continuous, gated by lateG)
    const trem = ctx.createGain();
    trem.gain.value = 0.5;
    const tl = ctx.createOscillator();
    tl.frequency.value = 6.5;
    const tlg = ctx.createGain();
    tlg.gain.value = 0.5;
    tl.connect(tlg).connect(trem.gain);
    const tlp = ctx.createBiquadFilter();
    tlp.type = "lowpass";
    tlp.frequency.value = 2400;
    trem.connect(tlp).connect(this.lateG);
    this.start(tl);
    for (const n of [24, 25, 31]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = midi(m.root + n);
      const g = ctx.createGain();
      g.gain.value = 0.03;
      o.connect(g).connect(trem);
      this.start(o);
    }
    this.nextMotif = now + 2 + rnd() * 3;
    this.nextStep = now + 0.5;
  }

  private start(n: OscillatorNode | AudioBufferSourceNode) {
    n.start();
    this.oscs.push(n);
  }

  private v(out: AudioNode, t: number): V {
    return { e: this.e, ctx: this.e.ctx, out, verb: this.e.musicVerb, t, p: 1, r: rnd };
  }

  setLevels(combat: number, late: number) {
    if (this.dead) return;
    const t = this.e.ctx.currentTime;
    this.combat = combat;
    this.late = late;
    this.combatG.gain.setTargetAtTime(Math.max(0.0001, combat * 0.9), t, combat > 0.5 ? 0.6 : 2.5);
    this.lateG.gain.setTargetAtTime(Math.max(0.0001, late * 0.8), t, 2);
    this.droneLp.frequency.setTargetAtTime((this.kind === "match" ? 260 : 420) + combat * 500 + late * 200, t, 1.5);
  }

  /** Schedule events up to `until`. */
  schedule(until: number) {
    if (this.dead) return;
    const m = this.m;
    // sparse motif notes
    while (this.nextMotif < until) {
      const t = this.nextMotif;
      const deg = m.scale[Math.floor(rnd() * m.scale.length)];
      const oct = rnd() < 0.3 ? 36 : 24;
      const f = midi(m.root + oct + deg);
      const v = this.v(this.motifG, t);
      const notes = rnd() < 0.35 ? 2 : 1;
      for (let i = 0; i < notes; i++) {
        const vv = { ...v, t: t + i * (0.4 + rnd() * 0.5) };
        const ff = i ? midi(m.root + oct + m.scale[Math.floor(rnd() * m.scale.length)]) : f;
        if (m.bell === "pluck") fm(vv, { f: ff, ratio: 2, index: ff * 1.2, dur: 2.4, vol: 0.07, noPitch: true });
        else if (m.bell === "bell") metal(vv, { f: ff, ratios: [1, 2.0, 3.01, 4.17], dur: 4, vol: 0.06, decayK: 0.7 });
        else metal(vv, { f: ff, ratios: [1, 2.32, 3.73, 5.1], dur: 3, vol: 0.05, decayK: 0.65 });
      }
      // occasional low swell under the motif
      if (rnd() < 0.3) tone(v, { type: "triangle", f: midi(m.root + 12 + m.scale[4]), dur: 5, a: 2.5, vol: 0.05, curve: "lin", noPitch: true });
      const busy = this.kind === "match" ? this.combat : 0;
      this.nextMotif = t + (this.kind === "match" ? 4 : 3) + rnd() * 6 - busy * 2.5;
    }
    // rhythm (16th steps): combat drums, lobby heartbeat, late clock
    const stepDur = 60 / m.bpm / 4;
    while (this.nextStep < until) {
      const t = this.nextStep;
      const s = this.step % 16;
      if (this.kind === "match") this.combatStep(t, s);
      else if (this.kind === "lobby" && (s === 0 || s === 3)) this.kick(this.out, t, s === 0 ? 0.25 : 0.15, 55);
      if (this.kind === "match" && this.late > 0.05 && s % 4 === 0) {
        noise(this.v(this.lateG, t), { dur: 0.03, vol: s === 0 ? 0.5 : 0.3, filter: { type: "bandpass", f: s === 0 ? 1800 : 2600, q: 6 } });
      }
      this.nextStep += stepDur;
      this.step++;
    }
  }

  private kick(out: AudioNode, t: number, vol: number, f = 60) {
    tone(this.v(out, t), { type: "sine", f: f * 1.8, f2: f * 0.6, glide: 0.12, dur: 0.35, vol, noPitch: true });
  }

  private combatStep(t: number, s: number) {
    if (this.combat < 0.03) return;
    const g = this.combatG;
    const m = this.m;
    const bar = Math.floor(this.step / 16) % 4;
    // war drums: low on 0, 6, 10; toms fill when intense
    if (s === 0 || s === 6 || s === 10) this.kick(g, t, s === 0 ? 0.55 : 0.4, 50);
    if (this.combat > 0.45 && (s === 4 || s === 12)) {
      noise(this.v(g, t), { color: "pink", dur: 0.18, vol: 0.25, filter: { type: "bandpass", f: 260, q: 2 } });
      tone(this.v(g, t), { type: "sine", f: 140, f2: 90, dur: 0.2, vol: 0.2, noPitch: true });
    }
    if (this.combat > 0.7 && bar === 3 && s >= 12) tone(this.v(g, t), { type: "sine", f: 180 - (s - 12) * 15, f2: 90, dur: 0.15, vol: 0.18, noPitch: true });
    // bass ostinato on 8ths: root, root, b2/b6 alternating per bar
    if (s % 2 === 0) {
      const off = s >= 12 ? (bar % 2 ? m.scale[1] : m.scale[5] - 12) : 0;
      tone(this.v(g, t), { type: "sawtooth", f: midi(m.root - 12 + off), dur: 0.22, a: 0.01, vol: s % 4 === 0 ? 0.14 : 0.09, noPitch: true, filter: { type: "lowpass", f: 500, f2: 200, q: 4 } });
    }
    // metallic scrape accent
    if (this.combat > 0.6 && s === 14 && rnd() < 0.5) noise(this.v(g, t), { dur: 0.25, a: 0.15, vol: 0.06, curve: "lin", filter: { type: "bandpass", f: 3500, q: 8 } });
  }

  stop() {
    this.dead = true;
    const t = this.e.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.0001, t, 0.6);
    const oscs = this.oscs;
    setTimeout(() => {
      for (const o of oscs) {
        try {
          o.stop();
        } catch {
          /* ignore */
        }
      }
      this.out.disconnect();
    }, 4000);
  }
}

const state: MusicState = { scene: "none", biome: "hollowpine", combat: 0, late: 0, boss: 0 };
let scene: Scene | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const sent = { c: 0, l: 0 };

function rebuild(e: Engine, want: MusicScene) {
  const biome = state.biome;
  if (scene && scene.kind === want && (want !== "match" || scene.biome === biome)) return;
  scene?.stop();
  scene = null;
  if (want === "none") return;
  scene = new Scene(e, want, biome, want === "match" ? BIOMES[biome] ?? BIOMES.hollowpine : MENU);
  scene.setLevels(state.combat, state.late);
  sent.c = state.combat;
  sent.l = state.late;
  audioLog("music." + want, "synth");
}

// ---- generated tracks -------------------------------------------------------------------

type TrackName = "menu" | "lobby" | "explore" | "combat" | "boss";
interface Deck {
  name: TrackName;
  src: AudioBufferSourceNode;
  g: GainNode;
}
let deck: Deck | null = null;
let mode: "explore" | "combat" | "boss" = "explore";
let calmSince = 0;
/** fade seconds when a track comes in (the outgoing one fades over the same time) */
const FADE: Record<TrackName, number> = { menu: 2.5, lobby: 2, explore: 4, combat: 1.2, boss: 1.5 };

function wantedTrack(now: number): TrackName | null {
  if (state.scene === "none") return null;
  if (state.scene === "menu") return "menu";
  if (state.scene === "lobby") return "lobby";
  // match: hysteresis so one stray hit does not flip the music back and forth.
  // boss while a boss is engaged; combat above 0.4 heat; back down only after ~7 calm seconds.
  const hot = Math.max(state.combat, state.late >= 0.7 ? 1 : 0);
  if ((state.boss ?? 0) > 0.5) {
    mode = "boss";
    calmSince = now;
  } else if (hot > 0.4) {
    if (mode === "explore") mode = "combat";
    if (mode === "combat") calmSince = now;
  }
  if (mode !== "explore" && (state.boss ?? 0) <= 0.5 && now - calmSince > 7) {
    mode = hot > 0.4 ? "combat" : "explore";
    calmSince = now - 4; // a boss -> combat step holds at least 3 s (no one-tick combat blip before explore)
  }
  return mode;
}

function stopDeck(e: Engine, fade: number) {
  if (!deck) return;
  const d = deck;
  deck = null;
  const t = e.ctx.currentTime;
  d.g.gain.cancelScheduledValues(t);
  d.g.gain.setTargetAtTime(0.0001, t, fade / 3);
  setTimeout(() => {
    try {
      d.src.stop();
    } catch {
      /* already stopped */
    }
    d.g.disconnect();
  }, fade * 2000 + 200);
}

function tick() {
  const e = engineAny();
  if (!e || e.ctx.state !== "running") return;
  const now = e.ctx.currentTime;
  ambience.setMatch(state.scene === "match");
  ambience.tick();
  const want = wantedTrack(now);
  if (!want) {
    stopDeck(e, 1.5);
    rebuild(e, "none");
    return;
  }
  const tr = track("music", want);
  if (tr.status === "failed") {
    // no file for this state: the synth scene plays it
    stopDeck(e, 1.5);
    rebuild(e, state.scene);
    scene?.schedule(now + 0.35);
    return;
  }
  if (scene) rebuild(e, "none");
  if (tr.status !== "ready" || !tr.buf) return; // still loading: keep what is playing
  if (deck?.name === want) return;
  const fade = FADE[want];
  stopDeck(e, fade);
  const src = e.ctx.createBufferSource();
  src.buffer = tr.buf;
  src.loop = true;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.setTargetAtTime(tr.g, now, fade / 3);
  src.connect(g).connect(e.music);
  // rhythmic tracks start on the downbeat; beds start anywhere so re-entries do not repeat
  src.start(now, want === "explore" || want === "menu" ? Math.random() * tr.buf.duration : 0);
  deck = { name: want, src, g };
  audioLog("music." + want, "music", want);
}

onEngineReady(() => {
  if (!timer) timer = setInterval(tick, 100);
});

export const music = {
  /** Merge a partial state. Cheap: call every frame if convenient. */
  setState(s: Partial<MusicState>) {
    const combat = s.combat !== undefined ? Math.max(0, Math.min(1, s.combat)) : state.combat;
    const late = s.late !== undefined ? Math.max(0, Math.min(1, s.late)) : state.late;
    Object.assign(state, s, { combat, late });
    if (Math.abs(combat - sent.c) > 0.03 || Math.abs(late - sent.l) > 0.03 || (combat === 0 && sent.c !== 0)) {
      sent.c = combat;
      sent.l = late;
      scene?.setLevels(combat, late);
    }
  },
  getState(): Readonly<MusicState> {
    return state;
  },
  /** Name of the generated track playing now, "synth:<scene>" for the fallback, or null. */
  playing(): string | null {
    return deck ? deck.name : scene ? "synth:" + scene.kind : null;
  },
};
