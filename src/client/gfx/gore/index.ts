// GORE. Extreme, procedural, original. Entry points (wired from main.ts):
//   goreEvents(events, selfId)  - server fx events (hit / kill / mdie / boom)
//   goreFrame(view, dt)         - per frame: living-state gore, corpse hits, simulation
//   goreScreen(ctx, W, H)       - screen-edge blood over the final frame
// Queries for the renderer: goreCorpse(kind, id), goreWeaponBlood(playerId), goreTimeScale().
// Layers self-register with gfx/view.ts (ground decals, depth-sorted gibs / corpse overlays, lit
// particles, unlit glows). Amounts follow Options > Graphics > Gore and Persistent blood.
import { MONSTER_BY_ID } from "../../../shared/content/monsters";
import { LEGACY_FAMILY, ROSTER } from "../../../shared/content/monsters/roster";
import { decodeLook } from "../../../shared/look";
import { onMapChange } from "../../../shared/map";
import type { GameEvent, GoreFx, MonsterSnap, PlayerSnap } from "../../../shared/protocol";
import { sfx } from "../../audio/sfx";
import type { BodyRegion } from "../hero";
import { depthOf, isoX, isoY } from "../iso";
import { addLayer, type Cam } from "../view";
import {
  extreme,
  goreAmount,
  goreCount,
  goreLevel,
  goreSound,
  M_BLOOD,
  M_CHAOS,
  M_CHAR,
  M_DUST,
  M_ECTO,
  M_ICE,
  M_ICHOR,
  M_SAP,
  M_UNDEAD,
  pick,
  rnd,
  rr,
  type Mat,
} from "./core";
import { addPool, clearDecals, drawDecals, stamp, updateDecals } from "./decals";
import { clearGibs, drawGibsDepth, setGibContext, G_ARM, G_BONE, G_CHAR, G_GUT, G_HEAD, G_ICE, G_LEG, G_MEAT, G_RIB, G_ROCK, G_TORSO, spawnGib, stepGibs, type GibLook } from "./gibs";
import { paintFootprint, paintFrost, paintEcto, paintLichtenberg, paintScorch, paintSplat } from "./paint";
import { paintedDecal, warmGoreArt, type DecalSet, type GibTheme } from "./painted";
import { clearParticles, drawParticles, P_CLOT, P_DROP, P_EMBER, P_MIST, P_SHARD, P_SHIMMER, P_SMOKE, P_SPARK, P_WISP, spawnP, stepParticles } from "./particles";
import { drawScreen, screenSplat, stepScreen } from "./screen";

export { goreLevel } from "./core";

type Elem = "p" | "f" | "c" | "l" | "x";
interface GoreView {
  selfId: number;
  players: Map<number, PlayerSnap>;
  monsters: Map<number, MonsterSnap>;
}

// ---- known entities -------------------------------------------------------------------------------

const players = new Map<number, PlayerSnap>();
const monsters = new Map<number, MonsterSnap>();
let selfId = -1;

interface Living {
  x: number;
  y: number;
  acc: number; // distance since last footprint
  side: number;
  bleed: number; // bleeding ailment time left
  drip: number;
  coat: number; // weapon blood coating 0..1
  seen: number;
}
const living = new Map<string, Living>();
let clock = 0;
function liv(key: string, x: number, y: number): Living {
  let l = living.get(key);
  if (!l) {
    l = { x, y, acc: 0, side: 1, bleed: 0, drip: 0, coat: 0, seen: clock };
    living.set(key, l);
  }
  return l;
}

const familyOf = new Map<string, string>();
for (const t of ROSTER) {
  const f = (t as { family?: string }).family;
  if (f) familyOf.set(t.id, f);
}
function monFamily(k: string): string {
  const f = familyOf.get(k) ?? LEGACY_FAMILY[k];
  if (f) return f;
  try {
    return sfx.monFamily(k);
  } catch {
    return "beast";
  }
}
/**
 * What a monster bleeds when its sound family says the wrong thing (the family picks voices: the
 * "spirit" sapspitter / harrier / matriarch are not ghosts and left glowing teal ectoplasm).
 */
const MON_MAT: Record<string, Mat> = {
  barkgnaw: M_SAP,
  stumpfather: M_SAP,
  sapspitter: M_SAP,
  rotwood_matriarch: M_SAP,
  spire_harrier: M_BLOOD,
  hollow_tender: M_BLOOD,
  rogue_exile: M_BLOOD,
};
function monMat(k: string): Mat {
  const o = MON_MAT[k];
  if (o !== undefined) return o;
  switch (monFamily(k)) {
    case "caster":
      return M_ICHOR;
    case "brute":
      return M_DUST;
    case "undead":
      return M_UNDEAD;
    case "spirit":
      return M_ECTO;
    default:
      return M_BLOOD;
  }
}
function monColor(k: string): string {
  return MONSTER_BY_ID.get(k)?.color ?? ROSTER.find((t) => t.id === k)?.color ?? "#6a5a4a";
}

// ---- gear colours for gibs -----------------------------------------------------------------------

const HELM: Record<string, string> = { hood: "#3b3328", coif: "#8a8c90", helm_open: "#9aa0a8", helm_great: "#a4aab2", helm_horned: "#8e949c", circlet: "#d4b048" };
const BODY: Record<string, string> = {
  body_leather: "#6b4a2e",
  body_scale: "#6f7562",
  body_mail: "#80848c",
  body_plate: "#a8aeb6",
  body_robe: "#4a3a62",
  body_brigandine: "#5a3a2a",
  body_plate_robe: "#7a7e8a",
  body_scale_robe: "#4e5a4a",
};
const GLOVE: Record<string, string> = { gloves_wrap: "#8a7a62", gloves_leather: "#5a3e26", gloves_gauntlet: "#9aa0a8", gloves_silk: "#6a4a7a" };
const BOOT: Record<string, string> = { boots_wrap: "#7a6a52", boots_soft: "#4a3422", boots_greave: "#8e949c", boots_slipper: "#4a3a5a" };
const SKIN = "#c49072";

function playerLook(lk: string | undefined, color: string | undefined): GibLook {
  try {
    const L = decodeLook(lk);
    return {
      skin: SKIN,
      cloth: BODY[L.body] ?? color ?? "#5a4a3a",
      hands: GLOVE[L.gloves] ?? SKIN,
      feet: BOOT[L.boots] ?? "#3a2a1e",
      helm: HELM[L.helmet] ?? null,
      hair: "#2a1e16",
      horns: L.helmet === "helm_horned",
      theme: "human",
    };
  } catch {
    return { skin: SKIN, cloth: color ?? "#5a4a3a", hands: SKIN, feet: "#3a2a1e", helm: null, hair: "#2a1e16", theme: "human" };
  }
}
/** Painted gib pieces per monster (gore/painted.ts); anything else is a generic beast. */
const MON_THEME: Record<string, GibTheme> = {
  wolf_feral: "wolf",
  barkgnaw: "hound",
  sapspitter: "fungus",
  stumpfather: "wood",
  rotwood_matriarch: "wood",
  hollow_tender: "antler",
  spire_harrier: "bird",
  rogue_exile: "human",
};
function monsterLook(k: string): GibLook {
  const c = monColor(k);
  return { skin: c, cloth: shadeHex(c, 0.75), hands: c, feet: shadeHex(c, 0.6), helm: null, hair: shadeHex(c, 0.5), monster: true, theme: MON_THEME[k] ?? "beast" };
}
/** A painted ground decal (chunks / guts / feathers) near a death; nothing when the art is missing. */
function dressing(set: DecalSet, x: number, y: number, r: number) {
  const sd = (rnd() * 1e9) | 0;
  stamp(x, y, r * 1.3, (g) => void paintedDecal(g, set, r, sd));
}
function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

// ---- corpses --------------------------------------------------------------------------------------

export interface CorpseGore {
  /** Draw nothing (exploded / shattered / fully melted). */
  hidden: boolean;
  /** Player rig regions severed (HeroConfig.missing). */
  missing: BodyRegion[];
  /** Elemental tint for the corpse sprite (source-atop), alpha 0..1. */
  tint: string | null;
  tintA: number;
  /** 0..1 sinking / melting into the ground (chaos). Draw lower and fade. */
  sink: number;
}
interface Corpse extends CorpseGore {
  on: boolean;
  kind: "p" | "m";
  id: number;
  x: number;
  y: number;
  r: number;
  mat: Mat;
  elem: Elem;
  t: number;
  shatterAt: number; // frozen: time of shattering (0 = never)
  hits: number;
  lk?: string;
  color?: string;
  wk?: string | null;
  mk?: string;
  look: GibLook;
  draw: () => void; // depth-layer overlay (bound once per pool slot)
}
const MAXC = 220;
const corpses: Corpse[] = [];
for (let i = 0; i < MAXC; i++) {
  const c: Corpse = { on: false, kind: "m", id: 0, x: 0, y: 0, r: 0, mat: 0, elem: "p", t: 0, shatterAt: 0, hits: 0, look: monsterLook(""), hidden: false, missing: [], tint: null, tintA: 0, sink: 0, draw: () => drawCorpseOverlay(c) };
  corpses.push(c);
}
const corpseKey = new Map<string, Corpse>();

function newCorpse(kind: "p" | "m", id: number, x: number, y: number, r: number, mat: Mat, elem: Elem, look: GibLook): Corpse {
  let c = corpses.find((q) => !q.on);
  if (!c) c = corpses.reduce((a, b) => (a.t > b.t ? a : b));
  corpseKey.delete(c.kind + ":" + c.id);
  Object.assign(c, { on: true, kind, id, x, y, r, mat, elem, t: 0, shatterAt: 0, hits: 0, look, hidden: false, missing: [], tint: null, tintA: 0, sink: 0 });
  corpseKey.set(kind + ":" + id, c);
  return c;
}

/** Renderer query: how to draw this corpse (null = no gore info, draw normally). */
export function goreCorpse(kind: "p" | "m", id: number): CorpseGore | null {
  if (goreAmount() <= 0) return null;
  const c = corpseKey.get(kind + ":" + id);
  return c && c.on ? c : null;
}

/** Renderer query: blood coating on a player's weapon, 0..1 (tint the blade). */
export function goreWeaponBlood(playerId: number): number {
  return goreAmount() > 0 ? (living.get("p:" + playerId)?.coat ?? 0) : 0;
}

// ---- hit-stop -------------------------------------------------------------------------------------

let hitStop = 0;
/** Multiply the frame dt by this (PvP kill hit-stop). */
export function goreTimeScale(): number {
  return hitStop > 0 ? 0.06 : 1;
}

// ---- emitters -------------------------------------------------------------------------------------

const E_ARTERY = 0;
const E_NECK = 1;
const E_SMOKE = 2;
const E_ARC = 3;
const E_WISP = 4;
interface Emitter {
  on: boolean;
  type: number;
  key: string; // follow an entity ("" = static)
  x: number;
  y: number;
  z: number;
  a: number;
  mat: Mat;
  t: number;
  life: number;
  acc: number;
  power: number;
}
const emitters: Emitter[] = Array.from({ length: 96 }, () => ({ on: false, type: 0, key: "", x: 0, y: 0, z: 0, a: 0, mat: 0, t: 0, life: 0, acc: 0, power: 1 }));
function emit(type: number, key: string, x: number, y: number, z: number, a: number, mat: Mat, life: number, power = 1) {
  let e = emitters.find((q) => !q.on);
  if (!e) e = emitters.reduce((p, q) => (p.t / p.life > q.t / q.life ? p : q));
  Object.assign(e, { on: true, type, key, x, y, z, a, mat, t: 0, life, acc: 0, power });
}

function stepEmitters(dt: number) {
  for (const e of emitters) {
    if (!e.on) continue;
    e.t += dt;
    if (e.t >= e.life) {
      e.on = false;
      continue;
    }
    if (e.key) {
      const [k, ids] = e.key.split(":");
      const id = +ids;
      const s = k === "p" ? players.get(id) : monsters.get(id);
      if (s) {
        e.x = s.x;
        e.y = s.y;
      }
    }
    const f = e.t / e.life;
    switch (e.type) {
      case E_ARTERY:
      case E_NECK: {
        // Pulsing jets (heartbeat), weakening.
        const beat = Math.max(0, Math.sin(e.t * (e.type === E_NECK ? 9 : 14)));
        e.acc += dt * 160 * e.power * beat * (1 - f) * goreAmount();
        while (e.acc > 1) {
          e.acc--;
          const a = e.a + rr(-0.35, 0.35);
          const sp = rr(60, 190) * (1 - f * 0.5) * e.power;
          const up = e.type === E_NECK ? rr(120, 260) : rr(40, 140);
          spawnP(P_DROP, e.mat, e.x, e.y, e.z, Math.cos(a) * sp, Math.sin(a) * sp, up * (1 - f * 0.4), 3, rr(0.9, 2));
        }
        break;
      }
      case E_SMOKE: {
        e.acc += dt * 16 * goreAmount();
        while (e.acc > 1) {
          e.acc--;
          spawnP(P_SMOKE, M_CHAR, e.x + rr(-12, 12), e.y + rr(-12, 12), rr(2, 10), rr(-4, 4), rr(-4, 4), rr(18, 34), rr(1.6, 2.8), rr(3, 6));
          if (rnd() < 0.7) spawnP(P_EMBER, M_CHAR, e.x + rr(-14, 14), e.y + rr(-14, 14), rr(1, 8), rr(-10, 10), rr(-10, 10), rr(20, 60), rr(0.6, 1.4), rr(0.5, 1.1));
        }
        break;
      }
      case E_ARC: {
        e.acc += dt * 30;
        while (e.acc > 1) {
          e.acc--;
          if (rnd() < 0.5) spawnP(P_SPARK, M_BLOOD, e.x + rr(-14, 14), e.y + rr(-14, 14), rr(2, 14), rr(-120, 120), rr(-120, 120), rr(40, 140), rr(0.12, 0.3), rr(0.8, 1.4));
        }
        break;
      }
      case E_WISP: {
        e.acc += dt * 14 * goreAmount();
        while (e.acc > 1) {
          e.acc--;
          spawnP(P_WISP, M_ECTO, e.x + rr(-10, 10), e.y + rr(-10, 10), rr(4, 16), rr(-6, 6), rr(-6, 6), rr(18, 40), rr(1.2, 2.2), rr(3, 6));
        }
        break;
      }
    }
  }
}

// ---- spray ---------------------------------------------------------------------------------------

/** Directional spray at a body: amount scales with `frac` (life fraction lost), crit = arterial. */
function spray(x: number, y: number, z: number, a: number, mat: Mat, frac: number, crit: boolean, elem: Elem) {
  const f = Math.min(1.6, frac);
  const n = goreCount(8 + f * 70 + (crit ? 45 : 0));
  const spread = 0.45 + (1 - Math.min(1, f)) * 0.35;
  for (let i = 0; i < n; i++) {
    const back = rnd() < 0.12;
    const ang = (back ? a + Math.PI : a) + (rnd() + rnd() + rnd() - 1.5) * spread * 1.4;
    const sp = rr(70, 190 + f * 260) * (back ? 0.4 : 1);
    const big = rnd() < 0.12;
    spawnP(big ? P_CLOT : P_DROP, mat, x + rr(-4, 4), y + rr(-4, 4), z + rr(-6, 6), Math.cos(ang) * sp, Math.sin(ang) * sp, rr(10, 120 + f * 80), 3, (big ? rr(1.6, 2.8) : rr(0.6, 1.8)) * (0.9 + f * 0.4));
  }
  const mist = goreCount(3 + f * 10 + (crit ? 10 : 0));
  for (let i = 0; i < mist; i++) {
    const ang = a + rr(-0.6, 0.6);
    const sp = rr(30, 110);
    spawnP(P_MIST, mat, x, y, z, Math.cos(ang) * sp, Math.sin(ang) * sp, rr(0, 30), rr(0.35, 0.7), rr(2, 4) * (1 + f));
  }
  // Element flavour on top of the blood.
  if (elem === "f") for (let i = 0; i < goreCount(8 + f * 16); i++) spawnP(P_EMBER, M_CHAR, x, y, z, rr(-60, 60), rr(-60, 60), rr(30, 120), rr(0.4, 1), rr(0.5, 1.2));
  if (elem === "c") for (let i = 0; i < goreCount(5 + f * 14); i++) spawnP(P_SHARD, M_ICE, x, y, z, Math.cos(a) * rr(60, 200) + rr(-40, 40), Math.sin(a) * rr(60, 200) + rr(-40, 40), rr(60, 160), rr(1, 2.5), rr(0.8, 2));
  if (elem === "l") for (let i = 0; i < goreCount(6 + f * 12); i++) spawnP(P_SPARK, M_BLOOD, x, y, z, rr(-180, 180), rr(-180, 180), rr(-40, 160), rr(0.1, 0.25), rr(0.8, 1.4));
  if (elem === "x") for (let i = 0; i < goreCount(4 + f * 10); i++) spawnP(P_DROP, M_CHAOS, x, y, z, Math.cos(a) * rr(40, 160), Math.sin(a) * rr(40, 160), rr(20, 100), 3, rr(0.8, 1.8));
  if (mat === M_DUST) for (let i = 0; i < goreCount(3 + f * 10); i++) spawnP(P_SHARD, M_DUST, x, y, z, Math.cos(a) * rr(60, 220), Math.sin(a) * rr(60, 220), rr(50, 150), rr(0.8, 2), rr(0.8, 2.2));
  if (mat === M_UNDEAD && rnd() < 0.3 + f) spawnP(P_SHARD, M_UNDEAD, x, y, z, Math.cos(a) * rr(60, 180), Math.sin(a) * rr(60, 180), rr(60, 150), rr(1.2, 3), rr(0.8, 1.6));
}

function splatAt(x: number, y: number, r: number, mat: Mat, a: number, power: number) {
  if (mat === M_DUST) return;
  const sd = (rnd() * 1e9) | 0;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  stamp(x, y, r * 4, (g) => paintSplat(g, mat, r, dx, dy, sd, power));
}

// ---- events ---------------------------------------------------------------------------------------

function attackerPos(by: number, victimIsMonster: boolean): { x: number; y: number } | null {
  if (victimIsMonster) return players.get(by) ?? monsters.get(by) ?? null;
  return players.get(by) ?? monsters.get(by) ?? null;
}

function onHit(e: Extract<GameEvent, { k: "hit" }>) {
  const isM = !!e.m;
  const v = isM ? monsters.get(e.target) : players.get(e.target);
  const mat = isM ? monMat(v ? (v as MonsterSnap).k : "") : M_BLOOD;
  const maxL = e.mx ?? (v ? (isM ? (v as MonsterSnap).mhp : (v as PlayerSnap).maxHp) : 100) ?? 100;
  const es = e.es ?? 0;
  const lifeD = e.lf ?? Math.max(0, e.dmg - es);
  const x = v?.x ?? e.x;
  const y = v?.y ?? e.y;
  const r = isM ? ((v as MonsterSnap | undefined)?.r ?? 16) : 20;
  const z = r * 1.15;
  if (es > 0) {
    // Energy shield took it: shimmer, no blood.
    for (let i = 0; i < goreCount(4 + Math.min(14, (es / maxL) * 60)) + 2; i++) spawnP(P_SHIMMER, M_BLOOD, x + rr(-r, r), y + rr(-r, r), z + rr(-10, 14), rr(-20, 20), rr(-20, 20), rr(10, 40), rr(0.25, 0.5), rr(2, 4));
  }
  if (lifeD <= 0 || goreAmount() <= 0) return;
  if (e.fo === "dot") {
    // Damage over time: no impact spray, just bleeding drips (and the element's flavour).
    const key = (isM ? "m:" : "p:") + e.target;
    if (mat !== M_DUST && mat !== M_ECTO) liv(key, x, y).bleed = Math.max(liv(key, x, y).bleed, e.bl ? 3 : 1);
    return;
  }
  let a: number;
  if (e.dx !== undefined && e.dy !== undefined) a = Math.atan2(e.dy, e.dx);
  else {
    const at = attackerPos(e.by, isM);
    a = at ? Math.atan2(y - at.y, x - at.x) : rnd() * Math.PI * 2;
  }
  const frac = lifeD / Math.max(1, maxL);
  const crit = !!e.cr;
  const elem = (e.dt ?? "p") as Elem;
  spray(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, z, a, mat, frac, crit, elem);
  splatAt(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, 2.5 + Math.min(1.5, frac) * 10, mat, a, Math.min(1, frac * 2));
  if (crit && goreAmount() >= 0.7) emit(E_ARTERY, (isM ? "m:" : "p:") + e.target, x, y, z, a + rr(-0.5, 0.5), mat, 0.9, 1 + frac);
  const key = (isM ? "m:" : "p:") + e.target;
  if (e.bl) liv(key, x, y).bleed = 5;
  else if (frac > 0.2) liv(key, x, y).bleed = Math.max(liv(key, x, y).bleed, 2 + frac * 4);
  // Weapon gets bloodier.
  if (players.has(e.by) && mat !== M_DUST && mat !== M_ECTO && mat !== M_SAP) {
    const l = liv("p:" + e.by, 0, 0);
    l.coat = Math.min(1, l.coat + 0.08 + frac * 0.6);
  }
  if (!isM && e.target === selfId && (frac > 0.1 || crit)) screenSplat(frac * 2.2 + (crit ? 0.35 : 0));
  goreSound(frac > 0.25 || crit ? "gore.squelch" : "gore.splat", x, y, Math.min(1, 0.4 + frac * 1.5), crit ? 0.85 : 1);
  // Hits next to corpses splash them too.
  corpseHitsNear(e.x, e.y, 18, a);
}

function onBoom(x: number, y: number, r: number) {
  for (const c of corpses) {
    if (!c.on || c.hidden) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d > r + c.r) continue;
    const a = Math.atan2(c.y - y, c.x - x);
    if (extreme() && d < r * 0.7) explode(c, a, 1.2);
    else corpseSplat(c, a);
  }
}

function corpseHitsNear(x: number, y: number, rad: number, a: number) {
  for (const c of corpses) {
    if (!c.on || c.hidden || c.t < 0.6) continue;
    if (Math.hypot(c.x - x, c.y - y) <= rad + c.r) corpseSplat(c, a);
  }
}

function corpseSplat(c: Corpse, a: number) {
  if (c.mat === M_DUST || c.elem === "x") return;
  c.hits++;
  spray(c.x, c.y, 6, a, c.mat, 0.5, false, "p");
  // Up-splash
  for (let i = 0; i < goreCount(14); i++) spawnP(P_DROP, c.mat, c.x + rr(-8, 8), c.y + rr(-8, 8), 2, rr(-60, 60), rr(-60, 60), rr(120, 240), 3, rr(0.8, 1.8));
  splatAt(c.x, c.y, rr(5, 9), c.mat, a, 0.7);
  if (rnd() < 0.5) spawnGib(G_MEAT, c.mat, c.x, c.y, 4, Math.cos(a) * rr(60, 160), Math.sin(a) * rr(60, 160), rr(80, 200), rr(2, 3.5), c.look);
  goreSound("gore.squelch", c.x, c.y, 0.8);
  if (extreme() && c.hits >= 4) explode(c, a, 0.8);
}

/** Death: dispatch on element / family / overkill. */
function onDeath(kind: "p" | "m", id: number, x: number, y: number, r: number, mat: Mat, look: GibLook, fx: GoreFx, pvp: boolean, src: { lk?: string; color?: string; wk?: string | null; mk?: string; ang?: number }) {
  const amt = goreAmount();
  if (amt <= 0) return;
  const elem = (fx.dt ?? "p") as Elem;
  const prev = kind === "p" ? players.get(id) : monsters.get(id);
  const maxL = fx.mx ?? (prev ? (kind === "p" ? (prev as PlayerSnap).maxHp : (prev as MonsterSnap).mhp) : 100) ?? 100;
  const ok = fx.ok ?? 0;
  let a: number;
  if (fx.dx !== undefined && fx.dy !== undefined) a = Math.atan2(fx.dy, fx.dx);
  else a = src.ang !== undefined ? src.ang + Math.PI : rnd() * Math.PI * 2;
  const crit = !!fx.cr;
  const lvl = goreLevel();
  const massive = ok > 0.5 * maxL || (fx.fo === "area" && ok > 0.2 * maxL);
  const c = newCorpse(kind, id, x, y, r, mat, elem, look);
  c.lk = src.lk;
  c.color = src.color;
  c.wk = src.wk;
  c.mk = src.mk;
  const z = r * 1.1;

  // Death spray in every case.
  spray(x, y, z, a, mat, pvp ? 1.6 : 0.9, crit, elem);
  if (look.theme === "bird") dressing("feathers", x + rr(-6, 6), y + rr(-6, 6), r * 1.5);
  else if (look.theme === "wood" || look.theme === "hound") {
    // Wooden things leave splinters and sap, whatever killed them.
    dressing("splinters", x + rr(-r, r), y + rr(-r, r), r * 1.5);
    if (massive || rnd() < 0.5) dressing("sap", x + rr(-r, r) * 1.5, y + rr(-r, r) * 1.5, r * 1.2);
  } else if (look.theme === "fungus") dressing("fungus", x + rr(-6, 6), y + rr(-6, 6), r * 1.6);
  if (pvp) {
    hitStop = 0.16;
    spray(x, y, z, a + Math.PI * 0.5, mat, 1.2, true, elem);
    spray(x, y, z, a - Math.PI * 0.5, mat, 1.2, true, elem);
    for (let i = 0; i < 6; i++) splatAt(x + rr(-40, 40), y + rr(-40, 40), rr(6, 14), mat, rnd() * 6.28, 1);
    if (fx.cr === undefined && selfId >= 0 && id === selfId) screenSplat(1);
  }

  let explodeIt = lvl !== "reduced" && (massive || (crit && lvl === "extreme") || (pvp && rnd() < 0.55));
  if (lvl === "full" && !massive) explodeIt = false;

  switch (elem) {
    case "c": {
      // Frozen solid, then shatters into ice and flesh.
      c.tint = "#bfe8ff";
      c.tintA = 0.6;
      c.shatterAt = explodeIt ? 0.15 : rr(1.3, 2.4);
      stamp(x, y, r * 2.2, (g) => paintFrost(g, r * 1.6, id * 7 + 3));
      break;
    }
    case "f": {
      c.tint = "#120c08";
      c.tintA = 0.78;
      emit(E_SMOKE, "", x, y, 0, 0, M_CHAR, 9);
      stamp(x, y, r * 2.4, (g) => paintScorch(g, r * 1.7, id * 13 + 1));
      if (explodeIt) explode(c, a, 1, true);
      break;
    }
    case "l": {
      c.tint = "#1a1a22";
      c.tintA = 0.65;
      emit(E_ARC, "", x, y, 0, 0, M_BLOOD, 3.2);
      stamp(x, y, r * 2.8, (g) => paintLichtenberg(g, r * 2.2, id * 17 + 5));
      if (explodeIt) explode(c, a, 1);
      else addPool(x, y, r * 1.2, mat, 4);
      break;
    }
    case "x": {
      c.tint = "#1c2a08";
      c.tintA = 0.55;
      addPool(x, y, r * 2, M_CHAOS, 4, 7);
      for (let i = 0; i < goreCount(20); i++) spawnP(P_SMOKE, M_CHAOS, x + rr(-r, r), y + rr(-r, r), 2, 0, 0, rr(10, 24), rr(1, 2), rr(2, 4));
      break;
    }
    default: {
      if (mat === M_DUST) {
        // Stone things crumble into rock and dust.
        rockBurst(c, a, explodeIt ? 1.3 : 0.7);
        break;
      }
      if (mat === M_ECTO) {
        emit(E_WISP, "", x, y, 0, 0, M_ECTO, 3.5);
        for (let i = 0; i < goreCount(30); i++) spawnP(P_WISP, M_ECTO, x + rr(-r, r), y + rr(-r, r), rr(4, 20), rr(-40, 40), rr(-40, 40), rr(20, 70), rr(1, 2), rr(3, 7));
        stamp(x, y, r * 2, (g) => paintEcto(g, r * 1.5, id * 3 + 1));
        c.tint = "#7affe0";
        c.tintA = 0.35;
        if (explodeIt) explode(c, a, 0.8);
        break;
      }
      if (explodeIt) explode(c, a, pvp ? 1.5 : 1.1);
      else if (lvl !== "reduced") dismember(c, a, pvp);
      addPool(x, y, r * (pvp ? 2.6 : 1.6), mat, 4);
      break;
    }
  }
  goreSound(pvp ? "gore.explode" : "gore.splat", x, y, pvp ? 1 : 0.8);
}

function dismember(c: Corpse, a: number, pvp: boolean) {
  const lvl = goreLevel();
  const chance = lvl === "extreme" ? 0.9 : 0.5;
  if (rnd() > chance && !pvp) return;
  const regions: BodyRegion[] = [];
  const pool: BodyRegion[] = ["head", "armL", "armR", "legL", "legR"];
  const nCut = lvl === "extreme" ? (pvp ? 3 : 1 + ((rnd() * 2.2) | 0)) : 1;
  if (rnd() < (lvl === "extreme" ? 0.6 : 0.35) || pvp) regions.push("head");
  while (regions.length < nCut) {
    const r = pick(pool);
    if (!regions.includes(r)) regions.push(r);
  }
  c.missing = regions;
  for (const reg of regions) severPiece(c, reg, a);
  goreSound("gore.dismember", c.x, c.y, 1);
  goreSound("gore.bonecrack", c.x, c.y, 0.7);
}

const REG_KIND: Record<string, number> = { head: G_HEAD, armL: G_ARM, armR: G_ARM, legL: G_LEG, legR: G_LEG, torso: G_TORSO };

function severPiece(c: Corpse, reg: BodyRegion, a: number) {
  const ang = a + rr(-0.9, 0.9);
  const sp = rr(110, 240) * (reg === "head" ? 1.2 : 1);
  const z = reg === "head" ? c.r * 1.6 : reg.startsWith("leg") ? c.r * 0.5 : c.r * 1.1;
  // Players lose painted human pieces like everything else: the rig's own limb sprite read as a
  // coloured capsule next to the painted gore, and it faded instead of staying on the ground.
  spawnGib(REG_KIND[reg], c.mat, c.x, c.y, z, Math.cos(ang) * sp, Math.sin(ang) * sp, rr(160, 300), c.r * (reg === "head" ? 0.42 : 0.4), c.look);
  // Fountain from the stump.
  emit(reg === "head" ? E_NECK : E_ARTERY, "", c.x, c.y, reg === "head" ? c.r * 0.9 : c.r * 0.6, reg === "head" ? rnd() * 6.28 : ang, c.mat, reg === "head" ? 2.6 : 1.4, reg === "head" ? 1.2 : 0.8);
}

/** Full-body explosion into gibs, bone and a big splat ring. */
function explode(c: Corpse, a: number, power: number, charred = false) {
  if (c.hidden) return;
  c.hidden = true;
  const { x, y, r, mat } = c;
  const k = goreAmount();
  const mt = charred ? M_CHAR : mat;
  const out = (z: number, s: number) => {
    const ang = a + rr(-1.6, 1.6) + (rnd() < 0.3 ? Math.PI : 0);
    const sp = rr(90, 300) * power;
    return [Math.cos(ang) * sp, Math.sin(ang) * sp, rr(150, 360) * power, z, s] as const;
  };
  if (c.kind === "p" && !charred) for (const reg of ["head", "armL", "armR", "legL", "legR", "torso"] as BodyRegion[]) severPiece(c, reg, a + rr(-1.5, 1.5));
  else {
    const kinds = charred ? [G_CHAR, G_CHAR, G_CHAR, G_BONE] : [G_HEAD, G_ARM, G_ARM, G_LEG, G_LEG, G_TORSO];
    for (const kk of kinds) {
      const [vx, vy, vz, z, s] = out(r, r * (kk === G_TORSO ? 0.45 : 0.4));
      spawnGib(kk, mt, x, y, z, vx, vy, vz, s, c.look);
    }
  }
  const nMeat = Math.round((6 + 8 * power) * k);
  for (let i = 0; i < nMeat; i++) {
    const [vx, vy, vz, , s] = out(r, rr(1.5, 3.5));
    spawnGib(charred ? G_CHAR : G_MEAT, mt, x, y, r * 0.8, vx, vy, vz, s, c.look);
  }
  if (!charred) {
    for (let i = 0; i < Math.round(3 * k); i++) {
      const [vx, vy, vz] = out(r, 0);
      spawnGib(G_GUT, mat, x, y, r * 0.7, vx * 0.6, vy * 0.6, vz * 0.7, rr(3, 4.5), c.look);
    }
    for (let i = 0; i < Math.round(5 * k); i++) {
      const [vx, vy, vz] = out(r, 0);
      spawnGib(rnd() < 0.5 ? G_BONE : G_RIB, mat, x, y, r, vx, vy, vz, rr(2.5, 4), c.look);
    }
  }
  for (let i = 0; i < goreCount(30); i++) spawnP(P_SHARD, M_UNDEAD, x, y, r, rr(-260, 260) * power, rr(-260, 260) * power, rr(80, 260), rr(1.5, 3), rr(0.6, 1.4));
  // Blood everywhere: radial burst + ring of splats + central pool.
  if (mt !== M_CHAR) {
    for (let i = 0; i < 4; i++) spray(x, y, r, (i / 4) * Math.PI * 2 + rr(-0.3, 0.3), mat, 1.4 * power, true, "p");
    const ring = Math.round(12 * k);
    for (let i = 0; i < ring; i++) {
      const ang = (i / ring) * Math.PI * 2 + rr(-0.2, 0.2);
      const d = r * rr(1.4, 3.6) * power;
      splatAt(x + Math.cos(ang) * d, y + Math.sin(ang) * d, rr(5, 12), mat, ang, 1);
    }
    addPool(x, y, r * 2.4 * power, mat, 3);
    if (mat === M_BLOOD && c.look.theme !== "wood" && c.look.theme !== "hound") {
      // Painted viscera left where the body burst.
      // (beside the pool: the pool is baked later and would cover them)
      const ga = a + rr(-1, 1);
      const gd = r * 2.6 * power;
      dressing("guts", x + Math.cos(ga) * gd, y + Math.sin(ga) * gd, r * 1.1 * Math.min(1.3, power));
      for (let i = 0; i < Math.round(2 * k); i++) dressing("chunks", x + rr(-r, r) * 3.4, y + rr(-r, r) * 3.4, r * rr(0.8, 1.2));
    }
  } else {
    for (let i = 0; i < goreCount(40); i++) spawnP(P_EMBER, M_CHAR, x, y, r, rr(-200, 200), rr(-200, 200), rr(40, 200), rr(0.6, 1.6), rr(0.6, 1.4));
    for (let i = 0; i < goreCount(14); i++) spawnP(P_SMOKE, M_CHAR, x + rr(-10, 10), y + rr(-10, 10), r, rr(-30, 30), rr(-30, 30), rr(20, 50), rr(1.5, 3), rr(4, 8));
  }
  goreSound("gore.explode", x, y, 1);
  goreSound("gore.gib", x, y, 0.9);
  goreSound("gore.bonecrack", x, y, 0.8, 0.8);
}

function rockBurst(c: Corpse, a: number, power: number) {
  const { x, y, r } = c;
  if (power > 1) c.hidden = true;
  const n = Math.round((power > 1 ? 14 : 6) * goreAmount());
  for (let i = 0; i < n; i++) {
    const ang = a + rr(-2, 2);
    const sp = rr(60, 240) * power;
    spawnGib(G_ROCK, M_DUST, x, y, r * 0.9, Math.cos(ang) * sp, Math.sin(ang) * sp, rr(100, 280) * power, rr(2.5, 6), c.look);
  }
  for (let i = 0; i < goreCount(40 * power); i++) spawnP(P_SMOKE, M_DUST, x + rr(-r, r), y + rr(-r, r), rr(2, r), rr(-60, 60), rr(-60, 60), rr(6, 30), rr(0.8, 1.8), rr(3, 7));
  for (let i = 0; i < goreCount(30 * power); i++) spawnP(P_SHARD, M_DUST, x, y, r, rr(-220, 220), rr(-220, 220), rr(60, 220), rr(1, 2.4), rr(0.8, 2));
  goreSound("gore.bonecrack", x, y, 1, 0.6);
}

function shatter(c: Corpse) {
  c.hidden = true;
  const { x, y, r } = c;
  const k = goreAmount();
  for (let i = 0; i < Math.round(14 * k) + 3; i++) {
    const ang = rnd() * Math.PI * 2;
    const sp = rr(60, 260);
    spawnGib(rnd() < 0.7 ? G_ICE : G_MEAT, M_ICE, x, y, r * rr(0.4, 1.4), Math.cos(ang) * sp, Math.sin(ang) * sp, rr(80, 260), rr(2.5, 5.5), c.look);
  }
  for (let i = 0; i < goreCount(70); i++) spawnP(P_SHARD, M_ICE, x, y, r, rr(-260, 260), rr(-260, 260), rr(40, 240), rr(0.8, 2.2), rr(0.6, 1.8));
  for (let i = 0; i < goreCount(14); i++) spawnP(P_MIST, M_ICE, x, y, r, rr(-60, 60), rr(-60, 60), rr(0, 30), rr(0.5, 1), rr(4, 8));
  spray(x, y, r, rnd() * 6.28, M_BLOOD, 0.4, false, "p");
  goreSound("gore.bonecrack", x, y, 1, 1.6);
}

export function goreEvents(events: GameEvent[], self: number) {
  selfId = self;
  if (goreAmount() <= 0) return;
  for (const e of events) {
    try {
      switch (e.k) {
        case "hit":
          onHit(e);
          break;
        case "boom":
          onBoom(e.x, e.y, e.r);
          break;
        case "mdie": {
          const m = monsters.get(e.id);
          onDeath("m", e.id, e.x, e.y, e.r, monMat(e.mk), monsterLook(e.mk), e, false, { mk: e.mk, ang: m?.a ?? e.a });
          break;
        }
        case "kill": {
          const p = players.get(e.vid);
          let pvp = false;
          for (const q of players.values()) if (q.name === e.killer && q.id !== e.vid) pvp = true;
          onDeath("p", e.vid, e.x, e.y, 20, M_BLOOD, playerLook(p?.lk, p?.color), e, pvp, { lk: p?.lk, color: p?.color, wk: p?.wk ?? null, ang: p?.angle });
          if (pvp) {
            for (const q of players.values()) if (q.name === e.killer) liv("p:" + q.id, q.x, q.y).coat = 1;
          }
          break;
        }
      }
    } catch (err) {
      console.error("gore", err);
    }
  }
}

// ---- per frame ------------------------------------------------------------------------------------

const swing = new Map<number, number>();

export function goreFrame(v: GoreView, dtIn: number) {
  selfId = v.selfId;
  hitStop = Math.max(0, hitStop - dtIn);
  const dt = dtIn * goreTimeScale();
  clock += dt;
  for (const p of v.players.values()) players.set(p.id, p);
  for (const m of v.monsters.values()) monsters.set(m.id, m);
  if (players.size > 200) for (const id of players.keys()) if (!v.players.has(id)) players.delete(id);
  if (monsters.size > 900) for (const id of monsters.keys()) if (!v.monsters.has(id)) monsters.delete(id);

  warmGoreArt();
  stepParticles(dt);
  stepGibs(dt);
  stepEmitters(dt);
  stepScreen(dtIn);
  updateDecals(dt);
  if (goreAmount() <= 0) return;

  // Corpses: freeze -> shatter, chaos melt.
  for (const c of corpses) {
    if (!c.on) continue;
    c.t += dt;
    if (c.shatterAt > 0 && !c.hidden && c.t >= c.shatterAt) shatter(c);
    if (c.elem === "x" && !c.hidden) {
      c.sink = Math.min(1, c.t / 5);
      if (rnd() < dt * 8) spawnP(P_SMOKE, M_CHAOS, c.x + rr(-c.r, c.r), c.y + rr(-c.r, c.r), 1, 0, 0, rr(8, 20), rr(0.8, 1.6), rr(1.5, 3));
      if (c.sink >= 1) c.hidden = true;
    }
    if (c.t > 120) {
      c.on = false;
      corpseKey.delete(c.kind + ":" + c.id);
    }
  }

  // Living-state gore.
  for (const p of v.players.values()) {
    if (!p.alive) continue;
    const l = liv("p:" + p.id, p.x, p.y);
    livingStep(l, p.x, p.y, dt, p.hp / Math.max(1, p.maxHp) < 0.35, M_BLOOD, 20);
    if (l.coat > 0) {
      l.coat = Math.max(0, l.coat - dt / 45);
      if (l.coat > 0.35 && rnd() < dt * l.coat * 3) spawnP(P_DROP, M_BLOOD, p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16, 14, 0, 0, -10, 2, rr(0.6, 1.1));
    }
    // Swinging through corpses splatters them.
    const prog = p.atkT > 0 ? 1 - p.atkT / Math.max(0.05, p.swingTime) : 1;
    const was = swing.get(p.id) ?? 1;
    if (prog >= 0.45 && was < 0.45) {
      const reach = 20 + p.atkRange;
      for (const c of corpses) {
        if (!c.on || c.hidden || c.t < 0.6) continue;
        const dx = c.x - p.x;
        const dy = c.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > reach + c.r) continue;
        let da = Math.atan2(dy, dx) - p.angle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) <= (p.atkArc || 1.6) / 2 + 0.3) corpseSplat(c, p.angle);
      }
    }
    swing.set(p.id, prog);
  }
  for (const m of v.monsters.values()) {
    const l = liv("m:" + m.id, m.x, m.y);
    const mat = monMat(m.k);
    if (mat === M_DUST || mat === M_ECTO) {
      l.x = m.x;
      l.y = m.y;
      l.seen = clock;
      continue;
    }
    livingStep(l, m.x, m.y, dt, false, mat, m.r);
  }
  if (living.size > 600) for (const [k, l] of living) if (clock - l.seen > 5) living.delete(k);
}

function livingStep(l: Living, x: number, y: number, dt: number, lowLife: boolean, mat: Mat, r: number) {
  const dx = x - l.x;
  const dy = y - l.y;
  const d = Math.hypot(dx, dy);
  l.seen = clock;
  if (d > 100) {
    l.x = x;
    l.y = y;
    return;
  }
  l.bleed = Math.max(0, l.bleed - dt);
  const bleeding = l.bleed > 0 || lowLife;
  if (bleeding) {
    l.drip += dt * (lowLife ? 5 : 8) * goreAmount();
    while (l.drip > 1) {
      l.drip--;
      spawnP(P_DROP, mat, x + rr(-r * 0.4, r * 0.4), y + rr(-r * 0.4, r * 0.4), r * rr(0.5, 1.1), rr(-10, 10), rr(-10, 10), rr(-20, 10), 2, rr(0.6, 1.4));
    }
    // Footprints (players) / smeared trail (monsters).
    l.acc += d;
    if (l.acc > 20 && d > 0.01) {
      l.acc = 0;
      l.side = -l.side;
      const ang = Math.atan2(dy, dx);
      const ox = -Math.sin(ang) * 4 * l.side;
      const oy = Math.cos(ang) * 4 * l.side;
      const sd = (rnd() * 1e9) | 0;
      if (lowLife) stamp(x + ox, y + oy, 6, (g) => paintFootprint(g, mat, ang, sd));
      else splatAt(x + rr(-4, 4), y + rr(-4, 4), rr(1.5, 3), mat, ang + Math.PI, 0.3);
    }
  }
  l.x = x;
  l.y = y;
}

// ---- corpse overlays (depth layer) ------------------------------------------------------------------

let drawG: CanvasRenderingContext2D | null = null;
let drawCam: Cam | null = null;

function drawCorpseOverlay(c: Corpse) {
  const g = drawG;
  const cam = drawCam;
  if (!g || !cam || c.hidden) return;
  const sx = cam.offX + isoX(c.x, c.y);
  const sy = cam.offY + isoY(c.x, c.y);
  if (c.elem === "c" && c.shatterAt > 0) {
    // Ice shell over the frozen body.
    const k = Math.min(1, c.t / 0.25);
    const R = c.r * 1.25;
    g.save();
    g.globalAlpha = 0.55 * k;
    const grd = g.createLinearGradient(sx - R, sy - R * 1.2, sx + R, sy);
    grd.addColorStop(0, "rgba(240,252,255,0.9)");
    grd.addColorStop(0.5, "rgba(150,210,240,0.5)");
    grd.addColorStop(1, "rgba(90,160,210,0.7)");
    g.fillStyle = grd;
    g.beginPath();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr2 = R * (0.75 + 0.35 * (((c.id * 31 + i * 17) % 10) / 10));
      const px = sx + Math.cos(a) * rr2;
      const py = sy - R * 0.45 + Math.sin(a) * rr2 * 0.6;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.globalAlpha = 0.9 * k;
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.lineWidth = 0.6;
    g.stroke();
    // Cracks growing toward the shatter
    const crack = Math.max(0, (c.t - c.shatterAt * 0.4) / (c.shatterAt * 0.6));
    if (crack > 0) {
      g.strokeStyle = "rgba(255,255,255,0.95)";
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + c.id;
        g.moveTo(sx, sy - R * 0.45);
        g.lineTo(sx + Math.cos(a) * R * crack, sy - R * 0.45 + Math.sin(a) * R * 0.6 * crack);
      }
      g.stroke();
    }
    g.restore();
  }
}

function drawArcs(g: CanvasRenderingContext2D, cam: Cam) {
  for (const e of emitters) {
    if (!e.on || e.type !== E_ARC) continue;
    if (rnd() < 0.45) continue; // flicker
    const sx = cam.offX + isoX(e.x, e.y);
    const sy = cam.offY + isoY(e.x, e.y);
    if (sx < -60 || sy < -60 || sx > cam.ww + 60 || sy > cam.wh + 60) continue;
    const f = 1 - e.t / e.life;
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 2; k++) {
      let x = sx + rr(-16, 16);
      let y = sy - rr(0, 10);
      const tx = sx + rr(-18, 18);
      const ty = sy - rr(0, 16);
      g.strokeStyle = k ? `rgba(240,248,255,${0.9 * f})` : `rgba(110,160,255,${0.5 * f})`;
      g.lineWidth = k ? 0.6 : 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 1; i <= 5; i++) {
        x += (tx - x) / (6 - i) + rr(-3, 3);
        y += (ty - y) / (6 - i) + rr(-3, 3);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  }
}

// ---- layers -----------------------------------------------------------------------------------------

addLayer("ground", (g, cam) => {
  drawG = g; // same world context the depth pass draws into
  setGibContext(g);
  drawDecals(g, cam, cam.time);
});
addLayer("depth", (push, cam) => {
  if (goreAmount() <= 0) return;
  drawCam = cam;
  for (const c of corpses) {
    if (!c.on || c.hidden || c.elem !== "c" || c.shatterAt <= 0) continue;
    const sx = cam.offX + isoX(c.x, c.y);
    if (sx < -80 || sx > cam.ww + 80) continue;
    push(depthOf(c.x, c.y) + 2, c.draw);
  }
  drawGibsDepth(push, cam);
});
addLayer("over", (g, cam) => {
  drawG = g;
  setGibContext(g);
  drawCam = cam;
  drawParticles(g, cam, false);
});
addLayer("fx", (g, cam) => {
  drawParticles(g, cam, true);
  drawArcs(g, cam);
});

/** Corpse overlays need the world context during the depth pass: the renderer sets it via this. */
export function goreSetContext(g: CanvasRenderingContext2D) {
  drawG = g;
}

export function goreScreen(ctx: CanvasRenderingContext2D, W: number, H: number) {
  drawScreen(ctx, W, H);
}

export function goreReset() {
  clearDecals();
  clearGibs();
  clearParticles();
  for (const c of corpses) c.on = false;
  corpseKey.clear();
  for (const e of emitters) e.on = false;
  living.clear();
}
onMapChange(() => goreReset());

/** Debug: spawn a showcase at a world point (console: hnsGore(x, y)). */
export function goreDemo(x?: number, y?: number, hurt = false) {
  const me = players.get(selfId);
  const lk = me?.lk;
  x ??= me?.x ?? 0;
  y ??= me?.y ?? 0;
  if (hurt) screenSplat(0.8);
  const types: Elem[] = ["p", "p", "f", "c", "l", "x"];
  types.forEach((el, i) => {
    const a = (i / types.length) * Math.PI * 2;
    const px = x + Math.cos(a) * 110;
    const py = y + Math.sin(a) * 110;
    const id = 900000 + ((rnd() * 99999) | 0);
    onDeath("p", id, px, py, 20, M_BLOOD, playerLook(lk, "#a33"), { dt: el, cr: i === 1 ? 1 : undefined, ok: i === 1 ? 999 : 0, mx: 100 }, false, { lk, color: "#a33", wk: "sword" });
  });
}
if (typeof window !== "undefined") (window as unknown as { hnsGore?: unknown }).hnsGore = goreDemo;
