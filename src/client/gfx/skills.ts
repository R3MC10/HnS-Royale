// Skill VFX: smooth, anti-aliased effects driven by the server's `fx` events (shared/skills.ts SkillFx).
// Every skill reads in four beats: wind-up telegraph (where and when it will land), travel, impact,
// and - where it fits - a mark left on the ground. Colour follows the damage type.
// Glows, trails and sparks are drawn in the world pass's "fx" layer (after the darkness, so they
// glow); ground marks in the "ground" layer (under the actors, lit like the world). Everything is in
// screen units through gfx/view.ts camX/camY. Frame cost: all soft shapes are cached sprites (no
// gradients are created per frame); density follows the Graphics > Particles option.
// Also triggers character poses.
import { SKILL_GEM_BY_ID, type SkillGemDef } from "../../shared/content/gems";
import type { GameEvent } from "../../shared/protocol";
import type { SkillFx } from "../../shared/skills";
import { particleCount } from "../settings";
import { K, SQ, isoX, isoY } from "./iso";
import { extendPose, playPose, type PoseClip, type SkillPose } from "./poses";
import { addLayer, camX, camY, type Cam } from "./view";

type G = CanvasRenderingContext2D;

// ---- colours ---------------------------------------------------------------------------------

interface Pal {
  core: string; // near-white centre
  glow: string; // main hue
  deep: string; // dark edge
}
const PAL: Record<string, Pal> = {
  fire: { core: "#fff4d0", glow: "#ff8a2a", deep: "#b02a08" },
  cold: { core: "#f4ffff", glow: "#8fdcff", deep: "#2a6ab0" },
  lightning: { core: "#ffffff", glow: "#c8b8ff", deep: "#5a48d8" },
  chaos: { core: "#f0d8ff", glow: "#b050e0", deep: "#40104a" },
  shadow: { core: "#ece0ff", glow: "#9a80e0", deep: "#2a1a50" },
  physical: { core: "#fffaf0", glow: "#f0dcb0", deep: "#7a5a30" },
  spirit: { core: "#f8fff0", glow: "#c8f0a0", deep: "#3a6a28" },
  steel: { core: "#f6faff", glow: "#a8c8f0", deep: "#3a5078" },
};

function defOf(s: string): SkillGemDef | undefined {
  return SKILL_GEM_BY_ID.get(s);
}
function palOf(s: string): Pal {
  const d = defOf(s);
  if (!d) return PAL.physical;
  if (d.tags.includes("fire")) return PAL.fire;
  if (d.tags.includes("cold")) return PAL.cold;
  if (d.tags.includes("lightning")) return PAL.lightning;
  if ((d.tags as string[]).includes("chaos")) return PAL.chaos;
  if (d.kind === "dash") return PAL.shadow;
  if (d.kind === "guard") return PAL.steel;
  if (d.kind === "aura" || d.kind === "meta") return d.attr === "str" ? PAL.fire : d.attr === "dex" ? PAL.spirit : PAL.cold;
  return PAL.physical;
}

// ---- cached sprites (drawn scaled; nothing below builds a gradient per frame) ---------------------

const sprites = new Map<string, HTMLCanvasElement>();
function sprite(key: string, size: number, paint: (g: G, s: number) => void): HTMLCanvasElement {
  let c = sprites.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d")!, size);
  sprites.set(key, c);
  return c;
}
/** Soft round glow. */
function glowSprite(col: string): HTMLCanvasElement {
  return sprite(col, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, col);
    gr.addColorStop(0.35, col + "aa");
    gr.addColorStop(1, col + "00");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
}
/** Hollow ring: clear centre, brightening to a crisp rim (ground rings, novas, telegraphs). */
function ringSprite(col: string): HTMLCanvasElement {
  return sprite("ring" + col, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, col + "00");
    gr.addColorStop(0.6, col + "22");
    gr.addColorStop(0.9, col + "aa");
    gr.addColorStop(0.96, col);
    gr.addColorStop(1, col + "00");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
}
function blob(g: G, x: number, y: number, r: number, col: string, a = 1) {
  if (r <= 0.2 || a <= 0.01) return;
  g.globalAlpha = Math.min(1, a);
  g.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2);
}
/** A sprite laid flat on the ground at world (x, y), world radius r. */
function flat(g: G, img: HTMLCanvasElement, x: number, y: number, r: number, a: number) {
  if (r <= 0.3 || a <= 0.01) return;
  const rx = r * K;
  const ry = r * K * SQ;
  g.globalAlpha = Math.min(1, a);
  g.drawImage(img, sx(x, y) - rx, sy(x, y) - ry, rx * 2, ry * 2);
}

// ---- state ---------------------------------------------------------------------------------

interface PlayerPos {
  x: number;
  y: number;
  alive?: boolean;
}
let players: Map<number, PlayerPos> = new Map();
/** Interpolated player positions for effects that follow a player (main.ts, every frame). */
export function setFxPlayers(m: Map<number, PlayerPos>) {
  players = m;
}

interface Part {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  r: number;
  col: string;
  drag: number;
  grav: number;
}
interface Effect {
  age: number;
  life: number;
  draw: (g: G, k: number, age: number) => void; // k = age / life (0..1)
}
type ProjLook = "comet" | "arrow" | "lance" | "glaive";
interface Proj {
  id: number;
  s: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  pal: Pal;
  look: ProjLook;
}
interface Persist {
  p: number;
  s: string;
  pal: Pal;
  t: number;
}
interface Zone {
  s: string;
  x: number;
  y: number;
  r: number;
  /** Seconds until it strikes (blast) or arms (trap). */
  t: number;
  /** Trap: how long it waits once armed. */
  dur: number;
  age: number;
  pal: Pal;
  trap: boolean;
}

const parts: Part[] = [];
const effects: Effect[] = [];
const marks: Effect[] = []; // ground layer
const projs = new Map<number, Proj>();
const auras = new Map<string, Persist>(); // `${player}|${skill}`
const buffs: (Persist & { dur: number })[] = [];
const guards: (Persist & { dur: number })[] = [];
const totems = new Map<number, { x: number; y: number; s: string; pal: Pal; age: number; dur: number }>();
const zones = new Map<number, Zone>();
const lastCast = new Map<number, string>(); // player -> skill id (colours the dash of a leap)

const MAX_PARTS = 1400;
const MAX_MARKS = 40;
function spawn(x: number, y: number, z: number, n: number, f: (i: number) => Partial<Part> & { col: string }) {
  const m = particleCount(n);
  for (let i = 0; i < m && parts.length < MAX_PARTS; i++) {
    const o = f(i);
    parts.push({ x, y, z, vx: 0, vy: 0, vz: 0, age: 0, life: 0.5, r: 4, drag: 2, grav: 0, ...o });
  }
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ---- projection helpers ----------------------------------------------------------------------

const sx = (x: number, y: number) => camX(x, y);
const sy = (x: number, y: number, z = 0) => camY(x, y, z);
/** A world-ground ellipse of radius r. */
function groundEllipse(g: G, x: number, y: number, r: number) {
  g.beginPath();
  g.ellipse(sx(x, y), sy(x, y), Math.max(0.1, r * K), Math.max(0.1, r * K * SQ), 0, 0, Math.PI * 2);
}
/** Screen direction of a world angle (unit-ish). */
function sdir(a: number): [number, number] {
  return [isoX(Math.cos(a), Math.sin(a)), isoY(Math.cos(a), Math.sin(a))];
}
/** Path of a ground sector (pie slice between r0 and r1) at height z. */
function sector(g: G, x: number, y: number, a: number, arc: number, r0: number, r1: number, z = 0) {
  const n = Math.max(4, Math.ceil(arc * 6));
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = a - arc / 2 + (arc * i) / n;
    const px = x + Math.cos(t) * r1;
    const py = y + Math.sin(t) * r1;
    if (i) g.lineTo(sx(px, py), sy(px, py, z));
    else g.moveTo(sx(px, py), sy(px, py, z));
  }
  if (r0 <= 0.5) g.lineTo(sx(x, y), sy(x, y, z));
  else
    for (let i = n; i >= 0; i--) {
      const t = a - arc / 2 + (arc * i) / n;
      g.lineTo(sx(x + Math.cos(t) * r0, y + Math.sin(t) * r0), sy(x + Math.cos(t) * r0, y + Math.sin(t) * r0, z));
    }
  g.closePath();
}
/** Polyline along a world arc at radius r, height z. */
function arcLine(g: G, x: number, y: number, a0: number, a1: number, r: number, z: number, n = 12) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    const px = x + Math.cos(t) * r;
    const py = y + Math.sin(t) * r;
    if (i) g.lineTo(sx(px, py), sy(px, py, z));
    else g.moveTo(sx(px, py), sy(px, py, z));
  }
}

// ---- event intake ----------------------------------------------------------------------------

/** 2D pose per skill kind (the procedural / painted hero, and the jump lift). */
const POSE: Record<string, SkillPose> = {
  strike: "cast_forward",
  slam: "slam",
  volley: "throw",
  bolt: "cast_forward",
  cone: "cast_forward",
  chain: "channel",
  dash: "leap",
  buff: "buff",
  aura: "buff",
  totem: "summon",
  meta: "cast_raise",
  spin: "channel",
  leap: "leap",
  blast: "cast_raise",
  trap: "throw",
  guard: "buff",
};
/** Leap: seconds in the air between the take-off (the commit point) and the landing hit (server/skills.ts LEAP_AIR). */
const LEAP_AIR = 0.3;
const CONTACT = 4 / 7; // where the attack-family clips land their hit
/**
 * 3D clip of a skill use (public/hero3d/hero.glb, scripts/art/blender/hero_anim.py) and its timing:
 * the clip reaches its contact frame exactly when the skill's hit lands. Skills with no entry
 * (a dash) keep the default clip of their 2D pose.
 */
function clipOf(d: SkillGemDef, t: number): PoseClip | undefined {
  const hit = d.commit;
  switch (d.kind) {
    case "strike": {
      const arc = d.arcDeg ?? 90;
      // narrow: a stab; wide: the flat backhand sweep; heavy: the overhead slam; else the diagonal cut
      return { name: arc <= 30 ? "thrust" : arc >= 120 ? "attack2" : d.dmg >= 1.8 ? "slam" : "attack", hit, contact: CONTACT };
    }
    case "slam":
      return { name: "slam", hit, contact: CONTACT };
    case "leap":
      return { name: "vault", hit: Math.min(0.92, (t * d.commit + LEAP_AIR) / Math.max(0.05, t)), contact: 0.64 };
    case "spin":
      return { name: "spin", loops: d.count ?? 3 };
    case "volley":
      return { name: d.returns ? "throw" : d.weapons?.every((w) => w === "bow" || w === "crossbow") ? "attack" : "throw", hit, contact: CONTACT };
    case "bolt":
    case "cone":
    case "chain":
    case "trap":
      return { name: "cast", hit, contact: 0.6 };
    case "blast":
    case "buff":
    case "totem":
      return { name: "raise", hit, contact: 0.6 };
    case "guard":
      return { name: "guard", enterMs: 220, strongMs: t * 1000 + 60 };
  }
  return undefined;
}

/** Feed a snapshot's events (main.ts onSnap). */
export function skillFxEvents(events: GameEvent[]) {
  for (const e of events) if ((e as { k: string }).k === "fx") onFx((e as { f: SkillFx }).f);
}

const arcOf = (d: SkillGemDef, dflt: number) => ((d.arcDeg ?? (dflt * 180) / Math.PI) * Math.PI) / 180;

function onFx(f: SkillFx) {
  switch (f.e) {
    case "cast": {
      const d = defOf(f.s);
      const pal = palOf(f.s);
      lastCast.set(f.p, f.s);
      if (!d) break;
      const pose = POSE[d.kind];
      const wind = f.t * d.commit; // seconds until the hit lands
      // a guard holds its stance for as long as the ward lasts (the guard event brings the real length)
      if (pose) playPose(f.p, pose, Math.max(180, (f.t + (d.guard?.dur ?? 0)) * 1000), d.guard ? undefined : f.a, clipOf(d, f.t));
      const spell = d.tags.includes("spell");
      switch (d.kind) {
        case "slam":
        case "leap":
          if (f.tx !== undefined && f.ty !== undefined && f.r) telegraph(f.tx, f.ty, f.r, wind + (d.kind === "leap" ? 0.3 : 0), pal);
          break;
        case "strike":
          if (f.r && wind > 0.16) wedge(f.p, f.x, f.y, f.a, arcOf(d, 1.6), f.r, wind, pal);
          break;
        case "cone":
          if (f.r) wedge(f.p, f.x, f.y, f.a, arcOf(d, 1.2), f.r, wind, pal);
          castFlash(f.p, f.x, f.y, f.a, wind, pal, true);
          break;
        case "spin":
          whirl(f.p, f.x, f.y, f.a, f.r ?? 70, f.t, wind, d.count ?? 3, pal);
          break;
        case "guard":
          break; // the guard event raises the ward
        case "volley":
          if (!d.returns) castFlash(f.p, f.x, f.y, f.a, wind, pal, false);
          break;
        default:
          castFlash(f.p, f.x, f.y, f.a, wind, pal, spell);
      }
      break;
    }
    case "land": {
      const d = defOf(f.s);
      const pal = palOf(f.s);
      if (!d) break;
      if (d.kind === "strike") {
        const arc = f.arc ?? 1.6;
        if (arc < 0.6) thrust(f.x, f.y, f.a, f.r, pal);
        else slash(f.x, f.y, f.a, f.r, arc, pal, d.dmg >= 1.8);
      } else if (d.kind === "slam") shockwave(f.x, f.y, f.r, pal, true);
      else if (d.kind === "leap") {
        shockwave(f.x, f.y, f.r, pal, true);
        thunderclap(f.x, f.y, f.r, pal);
      } else if (d.kind === "spin") spinHit(f.x, f.y, f.r, pal);
      else if (d.kind === "cone") gust(f.x, f.y, f.a, f.r, f.arc ?? 1.2, pal);
      else {
        nova(f.x, f.y, f.r, pal); // projectile bursts / novas
        if (pal === PAL.fire && f.r >= 24) scorch(f.x, f.y, f.r * 0.7, 3.5);
      }
      break;
    }
    case "proj": {
      const d = defOf(f.s);
      const look: ProjLook = d?.returns ? "glaive" : d?.pierce && d.kind === "bolt" ? "lance" : d && !d.tags.includes("spell") ? "arrow" : "comet";
      projs.set(f.id, { id: f.id, s: f.s, x: f.x, y: f.y, vx: f.vx, vy: f.vy, age: 0, life: f.life, pal: palOf(f.s), look });
      break;
    }
    case "pend": {
      const p = projs.get(f.id);
      projs.delete(f.id);
      const pal = p?.pal ?? PAL.physical;
      if (f.hit) impact(f.x, f.y, pal, p ? Math.atan2(p.vy, p.vx) : 0);
      else if (p?.look !== "glaive") fizzle(f.x, f.y, pal);
      break;
    }
    case "chain":
      arcs(f.pts, palOf(f.s));
      break;
    case "dash": {
      const d = defOf(lastCast.get(f.p) ?? "");
      if (d?.kind === "leap") vaultTrail(f.x0, f.y0, f.x1, f.y1, palOf(d.id));
      else streak(f.x0, f.y0, f.x1, f.y1, PAL.shadow);
      break;
    }
    case "buff":
      buffs.push({ p: f.p, s: f.s, pal: palOf(f.s), t: 0, dur: f.dur });
      break; // the pose started with the cast
    case "guard": {
      const pal = palOf(f.s);
      for (let i = guards.length - 1; i >= 0; i--) if (guards[i].p === f.p) guards.splice(i, 1);
      guards.push({ p: f.p, s: f.s, pal, t: 0, dur: f.dur });
      extendPose(f.p, "guard", f.dur * 1000);
      const pp = players.get(f.p);
      if (pp) nova(pp.x, pp.y, 36, pal);
      break;
    }
    case "aura": {
      const key = `${f.p}|${f.s}`;
      const pal = palOf(f.s);
      if (f.on) {
        auras.set(key, { p: f.p, s: f.s, pal, t: 0 });
        const pp = players.get(f.p);
        if (pp) nova(pp.x, pp.y, 70, pal);
      } else auras.delete(key);
      break;
    }
    case "meta": {
      const pp = players.get(f.p);
      if (pp) runeFlash(pp.x, pp.y, palOf(f.s));
      break;
    }
    case "totem":
      totems.set(f.id, { x: f.x, y: f.y, s: f.s, pal: palOf(f.s), age: 0, dur: f.dur });
      nova(f.x, f.y, 40, palOf(f.s));
      break;
    case "tend": {
      const t = totems.get(f.id);
      if (t) fizzle(t.x, t.y, t.pal, 18);
      totems.delete(f.id);
      break;
    }
    case "zone":
      zones.set(f.id, { s: f.s, x: f.x, y: f.y, r: f.r, t: f.t, dur: f.dur ?? 0, age: 0, pal: palOf(f.s), trap: f.dur !== undefined });
      break;
    case "zend": {
      const z = zones.get(f.id);
      zones.delete(f.id);
      const pal = z?.pal ?? palOf(f.s);
      if (!f.hit) fizzle(f.x, f.y, pal, 4);
      else if (z?.trap ?? defOf(f.s)?.kind === "trap") snareBurst(f.x, f.y, f.r, pal);
      else skyStrike(f.x, f.y, f.r, pal);
      break;
    }
    case "burn":
      spawn(f.x, f.y, 10, 5, () => ({ x: f.x + rnd(-10, 10), y: f.y + rnd(-10, 10), vz: rnd(30, 70), vx: rnd(-8, 8), vy: rnd(-8, 8), life: rnd(0.4, 0.8), r: rnd(3, 6), col: Math.random() < 0.5 ? PAL.fire.glow : "#ffc060", drag: 1 }));
      break;
    case "chill":
      spawn(f.x, f.y, 14, 4, () => ({ x: f.x + rnd(-12, 12), y: f.y + rnd(-12, 12), vz: rnd(-10, 12), vx: rnd(-10, 10), vy: rnd(-10, 10), life: rnd(0.5, 0.9), r: rnd(2, 4), col: PAL.cold.glow, drag: 2 }));
      break;
  }
}

// ---- effect builders ---------------------------------------------------------------------------

function add(life: number, draw: Effect["draw"]) {
  effects.push({ age: 0, life, draw });
}
/** A mark on the ground (under the actors). Oldest marks give way when there are too many. */
function mark(life: number, draw: Effect["draw"]) {
  if (marks.length >= MAX_MARKS) marks.shift();
  marks.push({ age: 0, life, draw });
}
/** Fade for a lingering mark: full, then out over the last 40%. */
const linger = (k: number) => (k < 0.6 ? 1 : (1 - k) / 0.4);

/** Burnt ground. */
function scorch(x: number, y: number, r: number, life: number) {
  mark(life, (g, k) => {
    g.globalCompositeOperation = "source-over";
    flat(g, glowSprite("#000000"), x, y, r * 1.25, 0.6 * linger(k));
    if (k < 0.35) {
      g.globalCompositeOperation = "lighter";
      flat(g, glowSprite(PAL.fire.deep), x, y, r * 0.8, 0.5 * (1 - k / 0.35));
    }
  });
}
/** Rime left on the ground: a pale patch (sector, or a disc when arc >= 2 pi) with a few crystals. */
function rime(x: number, y: number, a: number, arc: number, r: number, life: number) {
  const full = arc >= 6.2;
  const ticks = Array.from({ length: 7 }, () => {
    const t = a + rnd(-arc / 2, arc / 2) * 0.9;
    const d = r * Math.sqrt(rnd(0.08, 0.9));
    return [x + Math.cos(t) * d, y + Math.sin(t) * d, rnd(3, 6)] as const;
  });
  mark(life, (g, k) => {
    const f = linger(k);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#cfeeff";
    g.globalAlpha = 0.13 * f;
    if (full) groundEllipse(g, x, y, r);
    else sector(g, x, y, a, arc, 0, r);
    g.fill();
    g.globalAlpha = 0.2 * f;
    if (full) groundEllipse(g, x, y, r * 0.62);
    else sector(g, x, y, a, arc * 0.8, 0, r * 0.68);
    g.fill();
    g.strokeStyle = "#f2fbff";
    g.lineWidth = 1;
    g.globalAlpha = 0.6 * f;
    g.beginPath();
    for (const [px, py, s] of ticks) {
      const cx = sx(px, py);
      const cy = sy(px, py);
      g.moveTo(cx - s, cy);
      g.lineTo(cx + s, cy);
      g.moveTo(cx - s * 0.5, cy - s * 0.5);
      g.lineTo(cx + s * 0.5, cy + s * 0.5);
      g.moveTo(cx + s * 0.5, cy - s * 0.5);
      g.lineTo(cx - s * 0.5, cy + s * 0.5);
    }
    g.stroke();
  });
}
/** Broken ground: the cracks of an impact stay for a while. */
function cracked(x: number, y: number, cracks: [number, number][][], life: number) {
  mark(life, (g, k) => {
    g.globalCompositeOperation = "source-over";
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#0c0806";
    g.globalAlpha = 0.6 * linger(k);
    g.lineWidth = 2.2;
    g.beginPath();
    for (const pts of cracks) pts.forEach(([px, py], i) => (i ? g.lineTo(sx(x + px, y + py), sy(x + px, y + py)) : g.moveTo(sx(x + px, y + py), sy(x + px, y + py))));
    g.stroke();
  });
}

/** Area telegraph: a ground ring that fills inward until impact. */
function telegraph(x: number, y: number, r: number, t: number, pal: Pal) {
  const ring = ringSprite(pal.glow);
  add(Math.max(0.15, t), (g, k) => {
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.35 + 0.4 * k;
    groundEllipse(g, x, y, r);
    g.strokeStyle = pal.glow;
    g.lineWidth = 1.5;
    g.stroke();
    flat(g, ring, x, y, r * k, 0.25 + 0.45 * k);
  });
}

/** Melee / cone wind-up: the area about to be hit, drawn on the ground and filling toward the hit. */
function wedge(p: number, x0: number, y0: number, a: number, arc: number, r: number, t: number, pal: Pal) {
  add(Math.max(0.12, t), (g, k) => {
    const pp = players.get(p) ?? { x: x0, y: y0 };
    g.globalCompositeOperation = "lighter";
    g.fillStyle = pal.glow;
    g.globalAlpha = 0.07 + 0.1 * k;
    sector(g, pp.x, pp.y, a, arc, 0, r);
    g.fill();
    g.globalAlpha = 0.1 + 0.16 * k;
    sector(g, pp.x, pp.y, a, arc, 0, r * k);
    g.fill();
    g.globalAlpha = 0.25 + 0.4 * k;
    g.strokeStyle = pal.glow;
    g.lineWidth = 1.25;
    arcLine(g, pp.x, pp.y, a - arc / 2, a + arc / 2, r, 0, Math.max(4, Math.ceil(arc * 6)));
    g.stroke();
  });
}

/** Spell/attack wind-up: gathering light at the caster's hand. */
function castFlash(p: number, x0: number, y0: number, a: number, t: number, pal: Pal, spell: boolean) {
  const [dx, dy] = sdir(a);
  add(Math.max(0.15, t), (g, k) => {
    const pp = players.get(p) ?? { x: x0, y: y0 };
    const hx = sx(pp.x, pp.y) + dx * 9;
    const hy = sy(pp.x, pp.y, 20) + dy * 9;
    g.globalCompositeOperation = "lighter";
    const s = (spell ? 9 : 5) * (0.4 + k * 0.8);
    blob(g, hx, hy, s * 2.2, pal.glow, 0.5 * (1 - k * 0.3));
    blob(g, hx, hy, s, pal.core, 0.9);
    if (spell && Math.random() < 0.6 * particleCount(1)) {
      const ang = Math.random() * Math.PI * 2;
      parts.push({ x: pp.x + Math.cos(ang) * 22, y: pp.y + Math.sin(ang) * 22, z: 20, vx: -Math.cos(ang) * 60, vy: -Math.sin(ang) * 60, vz: 0, age: 0, life: 0.3, r: 2.5, col: pal.glow, drag: 0, grav: 0 });
    }
  });
}

/** Melee strike: a tapered blade of light swept along the arc. Heavy blows cut wider and scar the ground. */
function slash(x: number, y: number, a: number, r: number, arc: number, pal: Pal, heavy: boolean) {
  const width = heavy ? 0.36 : 0.24; // blade thickness as a fraction of the reach
  const steps = Math.max(8, Math.ceil(arc * 7));
  add(heavy ? 0.36 : 0.28, (g, k) => {
    const sweep = Math.min(1, k * 2.6);
    const a0 = a - arc / 2;
    const a1 = a0 + arc * sweep;
    const tail = Math.max(a0, a1 - arc * (1.1 - k * 0.5)); // the tail catches up as it fades
    g.globalCompositeOperation = "lighter";
    // crescent: outer edge on the reach, inner edge bulging toward the middle
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = tail + ((a1 - tail) * i) / steps;
      const px = x + Math.cos(t) * r;
      const py = y + Math.sin(t) * r;
      if (i) g.lineTo(sx(px, py), sy(px, py, 14));
      else g.moveTo(sx(px, py), sy(px, py, 14));
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const t = tail + (a1 - tail) * u;
      const rr = r * (1 - width * Math.sin(u * Math.PI) * (0.4 + 0.6 * u));
      g.lineTo(sx(x + Math.cos(t) * rr, y + Math.sin(t) * rr), sy(x + Math.cos(t) * rr, y + Math.sin(t) * rr, 14));
    }
    g.closePath();
    g.globalAlpha = 0.5 * (1 - k);
    g.fillStyle = pal.glow;
    g.fill();
    // bright cutting edge
    arcLine(g, x, y, tail, a1, r, 14, steps);
    g.globalAlpha = 0.95 * (1 - k);
    g.strokeStyle = pal.core;
    g.lineWidth = (heavy ? 3.4 : 2.4) * (1 - k * 0.5);
    g.lineCap = "round";
    g.stroke();
    if (k < 0.5) blob(g, sx(x + Math.cos(a1) * r, y + Math.sin(a1) * r), sy(x + Math.cos(a1) * r, y + Math.sin(a1) * r, 14), heavy ? 15 : 10, pal.core, 0.9 * (1 - k * 2));
  });
  const n = heavy ? 16 : 9;
  spawn(x, y, 14, n, (i) => {
    const t = a - arc / 2 + (arc * i) / n;
    return { x: x + Math.cos(t) * r, y: y + Math.sin(t) * r, vx: Math.cos(t) * rnd(60, 150), vy: Math.sin(t) * rnd(60, 150), vz: rnd(0, 60), grav: 160, life: rnd(0.2, 0.45), r: rnd(1.6, 3.2), col: Math.random() < 0.35 ? pal.core : pal.glow };
  });
  if (heavy) {
    // a gouge where the blow came down
    const gx = Math.cos(a);
    const gy = Math.sin(a);
    mark(3, (g, k) => {
      g.globalCompositeOperation = "source-over";
      g.strokeStyle = "#0c0806";
      g.lineCap = "round";
      g.globalAlpha = 0.55 * linger(k);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(sx(x + gx * r * 0.35, y + gy * r * 0.35), sy(x + gx * r * 0.35, y + gy * r * 0.35));
      g.lineTo(sx(x + gx * r * 1.05, y + gy * r * 1.05), sy(x + gx * r * 1.05, y + gy * r * 1.05));
      g.stroke();
    });
  }
}

/** Narrow strike: a lance of light driven straight out along the aim. */
function thrust(x: number, y: number, a: number, r: number, pal: Pal) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  add(0.24, (g, k) => {
    const head = r * Math.min(1, 0.35 + k * 3);
    const tail = r * Math.min(0.9, k * 1.6);
    const ax = sx(x + ca * tail, y + sa * tail);
    const ay = sy(x + ca * tail, y + sa * tail, 16);
    const bx = sx(x + ca * head, y + sa * head);
    const by = sy(x + ca * head, y + sa * head, 16);
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.globalAlpha = 0.4 * (1 - k);
    g.strokeStyle = pal.glow;
    g.lineWidth = 9 * (1 - k * 0.5);
    g.stroke();
    g.globalAlpha = 1 - k;
    g.strokeStyle = pal.core;
    g.lineWidth = 2.5;
    g.stroke();
    blob(g, bx, by, 11 * (1 - k * 0.6), pal.core, 1 - k);
  });
  spawn(x + ca * r, y + sa * r, 16, 7, () => {
    const t = a + rnd(-0.5, 0.5);
    return { vx: Math.cos(t) * rnd(60, 160), vy: Math.sin(t) * rnd(60, 160), vz: rnd(-10, 50), life: rnd(0.18, 0.35), r: rnd(1.5, 3), col: pal.glow };
  });
}

/** Spin: two blades of light circling the player for the whole use, brightening once the cuts start. */
function whirl(p: number, x0: number, y0: number, a: number, r: number, t: number, wind: number, turns: number, pal: Pal) {
  const ring = ringSprite(pal.glow);
  add(Math.max(0.2, t), (g, k, age) => {
    const pp = players.get(p) ?? { x: x0, y: y0 };
    if (pp.alive === false) return;
    const live = age >= wind ? 1 : 0.35 + 0.65 * (age / Math.max(0.01, wind));
    const env = Math.min(1, k * 10, (1 - k) * 5) * live;
    const th = a + k * Math.PI * 2 * turns;
    g.globalCompositeOperation = "lighter";
    flat(g, ring, pp.x, pp.y, r, 0.3 * env);
    g.lineCap = "round";
    for (let b = 0; b < 2; b++) {
      const head = th + b * Math.PI;
      arcLine(g, pp.x, pp.y, head - 1.7, head, r * 0.94, 14, 10);
      g.globalAlpha = 0.3 * env;
      g.strokeStyle = pal.glow;
      g.lineWidth = 9;
      g.stroke();
      arcLine(g, pp.x, pp.y, head - 0.9, head, r * 0.94, 14, 6);
      g.globalAlpha = 0.9 * env;
      g.strokeStyle = pal.core;
      g.lineWidth = 2.6;
      g.stroke();
      const hx = pp.x + Math.cos(head) * r * 0.94;
      const hy = pp.y + Math.sin(head) * r * 0.94;
      blob(g, sx(hx, hy), sy(hx, hy, 14), 9, pal.core, 0.8 * env);
      if (Math.random() < 0.35 * particleCount(1) && parts.length < MAX_PARTS)
        parts.push({ x: hx, y: hy, z: 14, vx: Math.cos(head) * 70, vy: Math.sin(head) * 70, vz: rnd(0, 40), age: 0, life: 0.3, r: 2.4, col: pal.glow, drag: 2, grav: 120 });
    }
  });
}
/** One cut of a spin: a quick ring pulse at the blade's reach. */
function spinHit(x: number, y: number, r: number, pal: Pal) {
  const ring = ringSprite(pal.core);
  add(0.22, (g, k) => {
    g.globalCompositeOperation = "lighter";
    flat(g, ring, x, y, r * (0.8 + 0.25 * k), 0.55 * (1 - k));
  });
  spawn(x, y, 12, 8, () => {
    const t = Math.random() * Math.PI * 2;
    return { x: x + Math.cos(t) * r * 0.9, y: y + Math.sin(t) * r * 0.9, vx: Math.cos(t) * 90, vy: Math.sin(t) * 90, vz: rnd(10, 60), grav: 200, life: rnd(0.2, 0.4), r: rnd(1.6, 3), col: pal.glow };
  });
}

/** Slam impact: flash, double shockwave ring, radial cracks, debris; the cracks stay in the ground. */
function shockwave(x: number, y: number, r: number, pal: Pal, scar: boolean) {
  const cracks = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + rnd(-0.2, 0.2);
    const pts: [number, number][] = [[0, 0]];
    let d = 0;
    let aa = a;
    while (d < r * 0.95) {
      d += rnd(r * 0.12, r * 0.22);
      aa += rnd(-0.35, 0.35);
      pts.push([Math.cos(aa) * d, Math.sin(aa) * d]);
    }
    return pts;
  });
  if (scar) cracked(x, y, cracks, 4.5);
  add(0.7, (g, k) => {
    // cracks (glowing, then cooling)
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    for (const pts of cracks) pts.forEach(([px, py], i) => (i ? g.lineTo(sx(x + px, y + py), sy(x + px, y + py)) : g.moveTo(sx(x + px, y + py), sy(x + px, y + py))));
    g.globalAlpha = (1 - k) * 0.85;
    g.strokeStyle = k < 0.3 ? pal.core : pal.glow;
    g.lineWidth = 2.2 * (1 - k * 0.5);
    g.stroke();
    // rings
    for (const [d, w] of [
      [0, 6],
      [0.12, 3],
    ]) {
      const kk = Math.max(0, (k - d) / (1 - d));
      if (kk <= 0) continue;
      const rr = r * (0.2 + 1.0 * Math.sqrt(kk));
      groundEllipse(g, x, y, rr);
      g.globalAlpha = (1 - kk) * 0.8;
      g.strokeStyle = pal.glow;
      g.lineWidth = w * (1 - kk);
      g.stroke();
    }
    // centre flash
    if (k < 0.35) blob(g, sx(x, y), sy(x, y, 4), r * K * 0.9 * (1 - k), pal.core, (0.35 - k) * 2.2);
  });
  spawn(x, y, 0, 26, () => {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(60, 200);
    return { x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(80, 220), grav: 520, life: rnd(0.4, 0.8), r: rnd(2, 4.5), col: Math.random() < 0.6 ? "#c8a878" : pal.glow, drag: 1.2 };
  });
}

/** Jagged path between two screen points (re-rolled by the caller for a crackle). */
function jagged(x0: number, y0: number, x1: number, y1: number, amp: number): [number, number][] {
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 16));
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const l = Math.hypot(nx, ny) || 1;
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = i === 0 || i === n ? 0 : rnd(-amp, amp);
    out.push([x0 + (x1 - x0) * t + (nx / l) * off, y0 + (y1 - y0) * t + (ny / l) * off]);
  }
  return out;
}
function strokePaths(g: G, paths: [number, number][][], pal: Pal, a: number, wide: number, thin: number) {
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  for (const path of paths) path.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.globalAlpha = 0.35 * a;
  g.strokeStyle = pal.glow;
  g.lineWidth = wide;
  g.stroke();
  g.globalAlpha = a;
  g.strokeStyle = pal.core;
  g.lineWidth = thin;
  g.stroke();
}

/** Lightning running out along the ground from an impact. */
function crackle(x: number, y: number, r: number, pal: Pal) {
  const dirs = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + rnd(-0.3, 0.3));
  const roll = () => dirs.map((a) => jagged(sx(x, y), sy(x, y, 3), sx(x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05), sy(x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, 3), 7));
  let shape = roll();
  let tick = 0;
  add(0.4, (g, k, age) => {
    if (Math.floor(age / 0.06) !== tick) {
      tick = Math.floor(age / 0.06);
      shape = roll();
    }
    g.globalCompositeOperation = "lighter";
    strokePaths(g, shape, pal, (1 - k) * (0.7 + Math.random() * 0.3), 6, 1.8);
  });
}

/**
 * Leap landing: a lit disc under the feet, a ring racing out, forked lightning that keeps re-striking along the
 * ground with a glow at every tip, and a spray of sparks. (Was six thin white lines.)
 */
function thunderclap(x: number, y: number, r: number, pal: Pal) {
  const N = 8;
  const dirs = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2 + rnd(-0.25, 0.25));
  const lens = dirs.map(() => r * rnd(0.85, 1.25));
  const pt = (a: number, d: number): [number, number] => [sx(x + Math.cos(a) * d, y + Math.sin(a) * d), sy(x + Math.cos(a) * d, y + Math.sin(a) * d, 3)];
  const roll = () => {
    const paths: [number, number][][] = [];
    dirs.forEach((a, i) => {
      const tip = pt(a, lens[i]);
      const arm = jagged(sx(x, y), sy(x, y, 3), tip[0], tip[1], 8);
      paths.push(arm);
      const from = arm[Math.floor(arm.length * rnd(0.4, 0.65))];
      const ft = pt(a + (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 0.9), lens[i] * rnd(0.7, 0.95));
      paths.push(jagged(from[0], from[1], ft[0], ft[1], 5));
    });
    return paths;
  };
  let shape = roll();
  let tick = 0;
  const glow = glowSprite(pal.glow);
  const ring = ringSprite(pal.glow);
  add(0.5, (g, k, age) => {
    if (Math.floor(age / 0.05) !== tick) {
      tick = Math.floor(age / 0.05);
      shape = roll();
    }
    g.globalCompositeOperation = "lighter";
    flat(g, glow, x, y, r * (1.1 + 0.5 * k), 0.4 * (1 - k) * (1 - k)); // lit ground
    flat(g, ring, x, y, r * (0.3 + 1.1 * Math.sqrt(k)), 0.8 * (1 - k));
    const a = (1 - k) * (0.7 + Math.random() * 0.3);
    strokePaths(g, shape, { ...pal, glow: pal.deep, core: pal.deep }, a, 9, 4); // coloured body (stays violet under additive blending)
    strokePaths(g, shape, pal, a * 0.9, 2.4, 1); // hot core
    for (let i = 0; i < N; i++) {
      const tip = shape[i * 2][shape[i * 2].length - 1];
      blob(g, tip[0], tip[1], 7 * (1 - k * 0.5), pal.glow, a * 0.7);
    }
    if (k < 0.3) blob(g, sx(x, y), sy(x, y, 10), r * K * 1.3 * (1 - k), pal.core, (0.3 - k) * 3);
  });
  scorch(x, y, r * 0.5, 3.5);
  spawn(x, y, 6, 28, () => {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(120, 320);
    return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(40, 240), grav: 420, life: rnd(0.25, 0.6), r: rnd(1.6, 3.2), col: Math.random() < 0.4 ? pal.core : pal.glow, drag: 2 };
  });
}

/** Cone spell: a bank of rime rolling out in a fan, streaked with gusts; it leaves frost on the ground. */
function gust(x: number, y: number, a: number, r: number, arc: number, pal: Pal) {
  const lines = Array.from({ length: 7 }, (_, i) => [a - arc / 2 + (arc * (i + 0.5)) / 7 + rnd(-0.04, 0.04), rnd(0.75, 1.0), rnd(0, 0.25)] as const);
  add(0.5, (g, k) => {
    g.globalCompositeOperation = "lighter";
    const front = Math.min(1, 0.25 + k * 2.2);
    const fade = 1 - k;
    // body of the gale: three stacked fans, densest near the caster
    g.fillStyle = pal.glow;
    for (const [f, al] of [
      [1, 0.14],
      [0.72, 0.16],
      [0.42, 0.2],
    ]) {
      g.globalAlpha = al * fade;
      sector(g, x, y, a, arc, 0, r * front * f, 8);
      g.fill();
    }
    // leading edge
    arcLine(g, x, y, a - arc / 2, a + arc / 2, r * front, 8, 10);
    g.globalAlpha = 0.75 * fade;
    g.strokeStyle = pal.core;
    g.lineWidth = 3 * fade + 0.5;
    g.lineCap = "round";
    g.stroke();
    // gust streaks racing outward
    g.beginPath();
    for (const [t, len, lag] of lines) {
      const h = Math.min(1, Math.max(0, (k - lag * 0.4) * 2.6)) * len;
      const t0 = Math.max(0, h - 0.35);
      if (h <= 0.02) continue;
      g.moveTo(sx(x + Math.cos(t) * r * t0, y + Math.sin(t) * r * t0), sy(x + Math.cos(t) * r * t0, y + Math.sin(t) * r * t0, 10));
      g.lineTo(sx(x + Math.cos(t) * r * h, y + Math.sin(t) * r * h), sy(x + Math.cos(t) * r * h, y + Math.sin(t) * r * h, 10));
    }
    g.globalAlpha = 0.8 * fade;
    g.strokeStyle = pal.core;
    g.lineWidth = 1.6;
    g.stroke();
  });
  spawn(x, y, 12, 30, () => {
    const t = a + rnd(-arc / 2, arc / 2);
    const sp = rnd(r * 1.2, r * 2.4);
    return { vx: Math.cos(t) * sp, vy: Math.sin(t) * sp, vz: rnd(-10, 20), life: rnd(0.3, 0.5), r: rnd(2, 5), col: Math.random() < 0.3 ? pal.core : pal.glow, drag: 2.5 };
  });
  if (pal === PAL.cold) rime(x, y, a, arc, r, 2.8);
}

/** Area burst / nova: an expanding glowing ring and a flash. */
function nova(x: number, y: number, r: number, pal: Pal) {
  const ring = ringSprite(pal.glow);
  add(0.5, (g, k) => {
    g.globalCompositeOperation = "lighter";
    const rr = Math.max(4, r) * (0.25 + 0.75 * Math.sqrt(k));
    flat(g, ring, x, y, rr, 0.85 * (1 - k));
    groundEllipse(g, x, y, rr);
    g.globalAlpha = 0.85 * (1 - k);
    g.strokeStyle = pal.core;
    g.lineWidth = 2 * (1 - k);
    g.stroke();
    if (k < 0.3) blob(g, sx(x, y), sy(x, y) - 8, r * 0.6 * K, pal.core, (0.3 - k) * 3);
  });
  spawn(x, y, 8, 16, () => {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(r * 1.5, r * 3);
    return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(20, 80), life: rnd(0.3, 0.55), r: rnd(2, 4), col: pal.glow, drag: 3 };
  });
}

/** Delayed blast going off: a bolt from the sky, a shock ring, ground lightning and a scorched mark. */
function skyStrike(x: number, y: number, r: number, pal: Pal) {
  const roll = () => {
    const bx = sx(x, y);
    const by = sy(x, y);
    const main = jagged(bx + rnd(-60, 60), by - 460, bx, by, 16);
    const mid = main[Math.floor(main.length * 0.55)];
    return [main, jagged(mid[0], mid[1], mid[0] + rnd(-70, 70), mid[1] + rnd(50, 110), 8)];
  };
  let shape = roll();
  let tick = 0;
  add(0.34, (g, k, age) => {
    if (Math.floor(age / 0.05) !== tick) {
      tick = Math.floor(age / 0.05);
      shape = roll();
    }
    g.globalCompositeOperation = "lighter";
    strokePaths(g, shape, pal, (1 - k) * (0.75 + Math.random() * 0.25), 11, 3);
    blob(g, sx(x, y), sy(x, y, 6), r * K * (0.9 - 0.4 * k), pal.core, 0.9 * (1 - k));
  });
  nova(x, y, r, pal);
  crackle(x, y, r * 0.8, pal);
  scorch(x, y, r * 0.55, 3.5);
  spawn(x, y, 4, 18, () => {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(80, 240);
    return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 260), grav: 480, life: rnd(0.3, 0.6), r: rnd(1.6, 3.4), col: Math.random() < 0.5 ? pal.core : pal.glow, drag: 1.5 };
  });
}

/** Snare sprung: jaws of ice spear up in a ring, a frost burst rolls out, rime stays on the ground. */
function snareBurst(x: number, y: number, r: number, pal: Pal) {
  const spikes = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + rnd(-0.2, 0.2);
    return [a, rnd(0.3, 0.72) * r, rnd(26, 46), rnd(3.5, 6)] as const; // angle, distance, height, half-width
  });
  add(0.75, (g, k) => {
    const up = Math.min(1, k * 7); // shoot up fast
    const fade = k < 0.55 ? 1 : (1 - k) / 0.45;
    g.globalCompositeOperation = "lighter";
    for (const [a, d, h, w] of spikes) {
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      const bx = sx(px, py);
      const by = sy(px, py);
      const lean = isoX(Math.cos(a), Math.sin(a)) * 7;
      g.beginPath();
      g.moveTo(bx - w, by);
      g.lineTo(bx + lean * up, by - h * up);
      g.lineTo(bx + w, by);
      g.closePath();
      g.globalAlpha = 0.55 * fade;
      g.fillStyle = pal.glow;
      g.fill();
      g.globalAlpha = 0.9 * fade;
      g.strokeStyle = pal.core;
      g.lineWidth = 1;
      g.stroke();
    }
  });
  nova(x, y, r, pal);
  rime(x, y, 0, Math.PI * 2, r, 3.2);
  spawn(x, y, 10, 22, () => {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(40, 170);
    return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(40, 170), grav: 300, life: rnd(0.35, 0.7), r: rnd(1.6, 3.6), col: Math.random() < 0.4 ? pal.core : pal.glow, drag: 2 };
  });
}

/** Projectile struck: spark spray back along its path plus a flash. */
function impact(x: number, y: number, pal: Pal, a: number) {
  add(0.25, (g, k) => {
    g.globalCompositeOperation = "lighter";
    blob(g, sx(x, y), sy(x, y, 16), 22 * (1 - k * 0.5), pal.glow, 0.8 * (1 - k));
    blob(g, sx(x, y), sy(x, y, 16), 9 * (1 - k), pal.core, 1 - k);
  });
  spawn(x, y, 16, 12, () => {
    const t = a + Math.PI + rnd(-1.2, 1.2);
    const sp = rnd(70, 200);
    return { vx: Math.cos(t) * sp, vy: Math.sin(t) * sp, vz: rnd(-20, 90), grav: 200, life: rnd(0.2, 0.45), r: rnd(1.5, 3.2), col: Math.random() < 0.4 ? pal.core : pal.glow, drag: 3 };
  });
}
function fizzle(x: number, y: number, pal: Pal, z = 16) {
  spawn(x, y, z, 6, () => ({ vx: rnd(-30, 30), vy: rnd(-30, 30), vz: rnd(10, 40), life: rnd(0.25, 0.45), r: rnd(1.5, 3), col: pal.glow, drag: 3 }));
}

/** Chain lightning: jagged, flickering arcs between the hit points. */
function arcs(pts: number[], pal: Pal) {
  const roll = () => {
    const out: [number, number][][] = [];
    for (let i = 0; i + 3 < pts.length; i += 2) out.push(jagged(sx(pts[i], pts[i + 1]), sy(pts[i], pts[i + 1], 18), sx(pts[i + 2], pts[i + 3]), sy(pts[i + 2], pts[i + 3], 18), 9));
    return out;
  };
  let shape = roll();
  let tick = 0;
  add(0.35, (g, k, age) => {
    if (Math.floor(age / 0.05) !== tick) {
      tick = Math.floor(age / 0.05);
      shape = roll(); // re-roll the jitter for a crackle
    }
    g.globalCompositeOperation = "lighter";
    strokePaths(g, shape, pal, (1 - k) * (0.7 + Math.random() * 0.3), 7, 2);
    for (let i = 0; i + 1 < pts.length; i += 2) blob(g, sx(pts[i], pts[i + 1]), sy(pts[i], pts[i + 1], 18), 16, pal.glow, 0.7 * (1 - k));
  });
}

/** A fading line of light from a to b: faint for the first half, bright at the head. */
function trailLine(g: G, ax: number, ay: number, bx: number, by: number, pal: Pal, a: number, wide: number, thin: number) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  g.lineCap = "round";
  g.strokeStyle = pal.glow;
  g.globalAlpha = 0.22 * a;
  g.lineWidth = wide * 0.7;
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.stroke();
  g.globalAlpha = 0.5 * a;
  g.lineWidth = wide;
  g.beginPath();
  g.moveTo(mx, my);
  g.lineTo(bx, by);
  g.stroke();
  g.strokeStyle = pal.core;
  g.globalAlpha = a;
  g.lineWidth = thin;
  g.beginPath();
  g.moveTo(mx + (bx - mx) * 0.4, my + (by - my) * 0.4);
  g.lineTo(bx, by);
  g.stroke();
}

/** Dash: an afterimage streak with smoke wisps. */
function streak(x0: number, y0: number, x1: number, y1: number, pal: Pal) {
  add(0.45, (g, k) => {
    g.globalCompositeOperation = "lighter";
    trailLine(g, sx(x0, y0), sy(x0, y0, 16), sx(x1, y1), sy(x1, y1, 16), pal, 1 - k, 16 * (1 - k * 0.5), 5 * (1 - k * 0.5));
  });
  const n = 18;
  spawn(x0, y0, 12, n, (i) => {
    const t = i / n;
    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, vx: rnd(-20, 20), vy: rnd(-20, 20), vz: rnd(5, 30), life: rnd(0.35, 0.7), r: rnd(4, 8), col: Math.random() < 0.7 ? pal.deep : pal.glow, drag: 2 };
  });
}

/** Leap: a high arc of light from the take-off to the landing. */
function vaultTrail(x0: number, y0: number, x1: number, y1: number, pal: Pal) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const h = Math.min(70, 20 + d * 0.22);
  add(0.5, (g, k) => {
    g.globalCompositeOperation = "lighter";
    const head = Math.min(1, k * 2.2);
    const tail = Math.max(0, k * 1.6 - 0.4);
    g.beginPath();
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const u = tail + ((head - tail) * i) / n;
      const px = x0 + (x1 - x0) * u;
      const py = y0 + (y1 - y0) * u;
      const z = 16 + Math.sin(u * Math.PI) * h;
      if (i) g.lineTo(sx(px, py), sy(px, py, z));
      else g.moveTo(sx(px, py), sy(px, py, z));
    }
    g.lineCap = "round";
    g.globalAlpha = 0.35 * (1 - k);
    g.strokeStyle = pal.glow;
    g.lineWidth = 12 * (1 - k * 0.5);
    g.stroke();
    g.globalAlpha = 0.9 * (1 - k);
    g.strokeStyle = pal.core;
    g.lineWidth = 2.5;
    g.stroke();
  });
  spawn(x0, y0, 2, 10, () => {
    const a = Math.random() * Math.PI * 2;
    return { vx: Math.cos(a) * rnd(30, 90), vy: Math.sin(a) * rnd(30, 90), vz: rnd(20, 70), life: rnd(0.3, 0.55), r: rnd(2.5, 5), col: Math.random() < 0.6 ? "#c8a878" : pal.glow, drag: 2.5 };
  });
}

/** Meta gem fired: a rune circle flash under the player. */
function runeFlash(x: number, y: number, pal: Pal) {
  add(0.55, (g, k) => {
    g.globalCompositeOperation = "lighter";
    const r = 34 + k * 10;
    g.globalAlpha = 1 - k;
    g.strokeStyle = pal.core;
    g.lineWidth = 1.5;
    groundEllipse(g, x, y, r);
    g.stroke();
    runeTriangle(g, x, y, r, k * 2);
    g.strokeStyle = pal.glow;
    g.stroke();
  });
}
function runeTriangle(g: G, x: number, y: number, r: number, rot: number) {
  g.beginPath();
  for (let i = 0; i <= 3; i++) {
    const a = rot + (i * Math.PI * 2) / 3;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i) g.lineTo(sx(px, py), sy(px, py));
    else g.moveTo(sx(px, py), sy(px, py));
  }
}

// ---- per-frame update + draw -----------------------------------------------------------------

let lastT = -1;
let pillar: HTMLCanvasElement | null = null;
/** Effigy pillar (cached). 16 x 32, base at the bottom centre. */
function pillarSprite(): HTMLCanvasElement {
  if (pillar) return pillar;
  pillar = sprite("pillar", 32, (g) => {
    const lg = g.createLinearGradient(10, 0, 22, 0);
    lg.addColorStop(0, "#1a120c");
    lg.addColorStop(0.5, "#5a4030");
    lg.addColorStop(1, "#140e0a");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(10, 32);
    g.lineTo(11.5, 2);
    g.lineTo(20.5, 2);
    g.lineTo(22, 32);
    g.closePath();
    g.fill();
  });
  return pillar;
}

function drawProj(g: G, p: Proj, dt: number) {
  const x = p.x + p.vx * p.age;
  const y = p.y + p.vy * p.age;
  const sp = Math.hypot(p.vx, p.vy) || 1;
  const ux = p.vx / sp;
  const uy = p.vy / sp;
  const hx = sx(x, y);
  const hy = sy(x, y, 18);
  const back = (d: number): [number, number] => [sx(x - ux * d, y - uy * d), sy(x - ux * d, y - uy * d, 18)];
  const few = particleCount(1);
  switch (p.look) {
    case "arrow": {
      // a dark shaft with a bright head and a short wake
      const tl = Math.min(p.age * sp, 46);
      const [ex, ey] = back(tl);
      trailLine(g, ex, ey, hx, hy, p.pal, 0.55, 3, 1);
      const [bx, by] = back(17);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 0.95;
      g.strokeStyle = "#2a1c10";
      g.lineWidth = 2;
      g.lineCap = "butt";
      g.beginPath();
      g.moveTo(bx, by);
      g.lineTo(hx, hy);
      g.stroke();
      g.globalCompositeOperation = "lighter";
      blob(g, hx, hy, 6, p.pal.glow, 0.8);
      blob(g, hx, hy, 2.6, p.pal.core, 1);
      break;
    }
    case "lance": {
      // a long shard of ice: bright faceted body, pale wake, falling frost
      const tl = Math.min(p.age * sp, 90);
      const [ex, ey] = back(tl);
      trailLine(g, ex, ey, hx, hy, p.pal, 0.6, 7, 0);
      const [tx, ty] = back(-10); // tip ahead of the centre
      const [mx, my] = back(8);
      const [bx, by] = back(30);
      const nx = -(hy - by);
      const ny = hx - bx;
      const nl = Math.hypot(nx, ny) || 1;
      const wx = (nx / nl) * 4.2;
      const wy = (ny / nl) * 4.2;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(mx + wx, my + wy);
      g.lineTo(bx, by);
      g.lineTo(mx - wx, my - wy);
      g.closePath();
      g.globalAlpha = 0.85;
      g.fillStyle = p.pal.glow;
      g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = p.pal.core;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(bx, by);
      g.stroke();
      blob(g, tx, ty, 12, p.pal.glow, 0.7);
      blob(g, tx, ty, 4.5, p.pal.core, 1);
      if (Math.random() < dt * 45 * few && parts.length < MAX_PARTS)
        parts.push({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), z: 18, vx: rnd(-14, 14), vy: rnd(-14, 14), vz: rnd(-30, 5), age: 0, life: rnd(0.3, 0.6), r: rnd(1.5, 3), col: Math.random() < 0.4 ? p.pal.core : p.pal.glow, drag: 2, grav: 60 });
      break;
    }
    case "glaive": {
      // a spinning wheel of three blades with a ghost ring
      const th = p.age * 24;
      blob(g, hx, hy, 17, p.pal.glow, 0.4);
      g.globalAlpha = 0.5;
      g.strokeStyle = p.pal.glow;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(hx, hy, 13, 13 * 0.7, 0, th % (Math.PI * 2), (th % (Math.PI * 2)) + 4.4);
      g.stroke();
      g.globalAlpha = 1;
      g.strokeStyle = p.pal.core;
      g.lineWidth = 2.6;
      g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = th + (i * Math.PI * 2) / 3;
        g.moveTo(hx + Math.cos(a) * 3, hy + Math.sin(a) * 3 * 0.7);
        g.quadraticCurveTo(hx + Math.cos(a + 0.7) * 9, hy + Math.sin(a + 0.7) * 9 * 0.7, hx + Math.cos(a + 0.35) * 14, hy + Math.sin(a + 0.35) * 14 * 0.7);
      }
      g.stroke();
      const [ex, ey] = back(Math.min(p.age * sp, 34));
      trailLine(g, ex, ey, hx, hy, p.pal, 0.35, 8, 0);
      if (Math.random() < dt * 30 * few && parts.length < MAX_PARTS)
        parts.push({ x, y, z: 18, vx: -p.vx * 0.15 + rnd(-30, 30), vy: -p.vy * 0.15 + rnd(-30, 30), vz: rnd(0, 30), age: 0, life: rnd(0.15, 0.3), r: rnd(1.5, 2.6), col: p.pal.glow, drag: 2, grav: 0 });
      break;
    }
    default: {
      // comet: tapered trail and a glowing head
      const tl = Math.min(p.age * sp, 70);
      const [ex, ey] = back(tl);
      trailLine(g, ex, ey, hx, hy, p.pal, 1, 9, 3);
      const fl = 0.9 + Math.random() * 0.2;
      blob(g, hx, hy, 18 * fl, p.pal.glow, 0.75);
      blob(g, hx, hy, 7, p.pal.core, 1);
      if (Math.random() < dt * 40 * few && parts.length < MAX_PARTS)
        parts.push({ x, y, z: 18, vx: -p.vx * 0.1 + rnd(-20, 20), vy: -p.vy * 0.1 + rnd(-20, 20), vz: rnd(-5, 25), age: 0, life: rnd(0.2, 0.4), r: rnd(2, 4), col: p.pal.glow, drag: 2, grav: 0 });
    }
  }
}

/** A blast mark waiting to strike, or a snare lying armed. */
function drawZone(g: G, z: Zone, dt: number) {
  g.globalCompositeOperation = "lighter";
  if (!z.trap) {
    // sigil: ring + turning rune, filling toward the strike
    const k = Math.min(1, z.age / Math.max(0.05, z.t));
    flat(g, ringSprite(z.pal.glow), z.x, z.y, z.r, 0.35 + 0.4 * k);
    flat(g, ringSprite(z.pal.core), z.x, z.y, z.r * k, 0.25 + 0.5 * k);
    g.globalAlpha = 0.45 + 0.45 * k;
    g.strokeStyle = z.pal.core;
    g.lineWidth = 1.4;
    runeTriangle(g, z.x, z.y, z.r * 0.82, z.age * 2.2);
    g.stroke();
    g.strokeStyle = z.pal.glow;
    runeTriangle(g, z.x, z.y, z.r * 0.82, -z.age * 2.2 + Math.PI);
    g.stroke();
    // the charge gathering overhead
    blob(g, sx(z.x, z.y), sy(z.x, z.y, 150 - 90 * k), 6 + 10 * k, z.pal.glow, 0.25 + 0.5 * k);
    if (Math.random() < dt * 26 * particleCount(1) && parts.length < MAX_PARTS) {
      const a = Math.random() * Math.PI * 2;
      parts.push({ x: z.x + Math.cos(a) * z.r * 0.8, y: z.y + Math.sin(a) * z.r * 0.8, z: 2, vx: 0, vy: 0, vz: rnd(50, 110), age: 0, life: rnd(0.25, 0.45), r: rnd(1.5, 2.8), col: z.pal.glow, drag: 0, grav: 0 });
    }
    return;
  }
  const armed = z.age >= z.t;
  const cx = sx(z.x, z.y);
  const cy = sy(z.x, z.y);
  if (!armed) {
    // settling: the jaws swing open
    const k = z.age / Math.max(0.05, z.t);
    flat(g, ringSprite(z.pal.glow), z.x, z.y, z.r * (1.6 - 0.6 * k), 0.5 * k);
    blob(g, cx, cy - 4, 9, z.pal.core, 0.8 * (1 - k));
  } else {
    const breathe = 0.5 + 0.5 * Math.sin(z.age * 3);
    const left = z.dur > 0 ? Math.min(1, (z.t + z.dur - z.age) / 1.5) : 1; // fades as it runs out
    flat(g, ringSprite(z.pal.glow), z.x, z.y, z.r, (0.3 + 0.2 * breathe) * left);
    blob(g, cx, cy - 3, 5, z.pal.core, (0.5 + 0.3 * breathe) * left);
  }
  // teeth around the rim
  const open = armed ? 1 : z.age / Math.max(0.05, z.t);
  g.globalAlpha = 0.75 * open;
  g.strokeStyle = z.pal.core;
  g.lineWidth = 1.3;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = z.x + Math.cos(a) * z.r * 0.7;
    const py = z.y + Math.sin(a) * z.r * 0.7;
    const bx = sx(px, py);
    const by = sy(px, py);
    g.moveTo(bx - 2.5, by);
    g.lineTo(bx, by - 7 * open);
    g.lineTo(bx + 2.5, by);
  }
  g.stroke();
}

function frame(g: G, c: Cam) {
  const dt = lastT < 0 ? 0 : Math.max(0, Math.min(0.1, c.time - lastT));
  lastT = c.time;
  g.globalCompositeOperation = "lighter";

  // persistent auras: soft breathing ring + rising motes at the player's feet
  for (const [key, a] of auras) {
    const pp = players.get(a.p);
    if (!pp) continue;
    if (pp.alive === false) {
      auras.delete(key);
      continue;
    }
    a.t += dt;
    const br = 0.5 + 0.5 * Math.sin(a.t * 2.4);
    const r = 34 + br * 4;
    flat(g, ringSprite(a.pal.glow), pp.x, pp.y, r, 0.55 + 0.25 * br);
    groundEllipse(g, pp.x, pp.y, r);
    g.globalAlpha = 0.4;
    g.strokeStyle = a.pal.core;
    g.lineWidth = 1;
    g.setLineDash([6, 8]);
    g.lineDashOffset = -a.t * 20;
    g.stroke();
    g.setLineDash([]);
    if (Math.random() < dt * 12 * particleCount(1)) {
      const ang = Math.random() * Math.PI * 2;
      parts.push({ x: pp.x + Math.cos(ang) * r * 0.9, y: pp.y + Math.sin(ang) * r * 0.9, z: 2, vx: 0, vy: 0, vz: rnd(25, 50), age: 0, life: rnd(0.6, 1), r: rnd(1.5, 3), col: a.pal.glow, drag: 0, grav: 0 });
    }
  }

  // timed buffs: a flame mantle wrapping the player
  for (let i = buffs.length - 1; i >= 0; i--) {
    const b = buffs[i];
    b.t += dt;
    if (b.t >= b.dur) {
      buffs.splice(i, 1);
      continue;
    }
    const pp = players.get(b.p);
    if (!pp) continue;
    const fade = Math.min(1, b.t * 4, (b.dur - b.t) * 2);
    const cx = sx(pp.x, pp.y);
    const cy = sy(pp.x, pp.y, 18);
    blob(g, cx, cy, 30, b.pal.glow, 0.28 * fade);
    groundEllipse(g, pp.x, pp.y, 24);
    g.globalAlpha = 0.6 * fade;
    g.strokeStyle = b.pal.glow;
    g.lineWidth = 2;
    g.stroke();
    if (Math.random() < dt * 30 * particleCount(1)) {
      const ang = Math.random() * Math.PI * 2;
      parts.push({ x: pp.x + Math.cos(ang) * 14, y: pp.y + Math.sin(ang) * 14, z: rnd(0, 20), vx: 0, vy: 0, vz: rnd(40, 80), age: 0, life: rnd(0.35, 0.6), r: rnd(2.5, 5), col: Math.random() < 0.5 ? b.pal.glow : b.pal.core, drag: 0.5, grav: 0 });
    }
  }

  // guards: a steady ward - ground ring, two standing arcs and a slow glint; blinks before it drops
  for (let i = guards.length - 1; i >= 0; i--) {
    const b = guards[i];
    b.t += dt;
    const pp = players.get(b.p);
    if (b.t >= b.dur || pp?.alive === false) {
      guards.splice(i, 1);
      continue;
    }
    if (!pp) continue;
    const left = b.dur - b.t;
    const fade = Math.min(1, b.t * 6) * (left < 0.5 ? 0.45 + 0.55 * Math.abs(Math.sin(left * 22)) : 1);
    flat(g, ringSprite(b.pal.glow), pp.x, pp.y, 30, 0.8 * fade);
    const cx = sx(pp.x, pp.y);
    const cy = sy(pp.x, pp.y);
    g.lineCap = "round";
    g.strokeStyle = b.pal.glow;
    g.lineWidth = 2;
    g.globalAlpha = 0.55 * fade;
    g.beginPath();
    g.ellipse(cx, cy - 22, 24, 34, 0, Math.PI * 1.08, Math.PI * 1.92); // dome over the head
    g.stroke();
    g.strokeStyle = b.pal.core;
    g.lineWidth = 1.2;
    g.globalAlpha = 0.5 * fade;
    g.beginPath();
    g.ellipse(cx, cy - 20, 30, 16, 0, Math.PI * 0.1, Math.PI * 0.9); // front lip
    g.stroke();
    const gl = b.t * 2.6;
    blob(g, cx + Math.cos(gl) * 28, cy - 22 + Math.sin(gl) * 12, 5, b.pal.core, 0.8 * fade);
  }

  // ground effects waiting to go off
  for (const [id, z] of zones) {
    z.age += dt;
    if (z.age > z.t + z.dur + 1.5) {
      zones.delete(id);
      continue;
    }
    drawZone(g, z, dt);
  }

  // totems: a carved, burning pillar
  for (const [id, t] of totems) {
    t.age += dt;
    if (t.age > t.dur + 1) {
      totems.delete(id);
      continue;
    }
    const cx = sx(t.x, t.y);
    const cy = sy(t.x, t.y);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    const h = 30;
    g.drawImage(pillarSprite(), cx - 16, cy - 32);
    g.globalCompositeOperation = "lighter";
    const flick = 0.8 + Math.random() * 0.2;
    blob(g, cx, cy - h - 3, 16 * flick, t.pal.glow, 0.7);
    blob(g, cx, cy - h - 2, 6 * flick, t.pal.core, 0.9);
    g.globalAlpha = 0.35;
    g.fillStyle = t.pal.glow;
    for (let i = 0; i < 3; i++) g.fillRect(cx - 3, cy - h * (0.3 + i * 0.2), 6, 1.2);
    if (Math.random() < dt * 14 * particleCount(1)) parts.push({ x: t.x + rnd(-3, 3), y: t.y + rnd(-3, 3), z: h / 0.62 + 4, vx: rnd(-6, 6), vy: rnd(-6, 6), vz: rnd(30, 60), age: 0, life: rnd(0.4, 0.7), r: rnd(2, 3.5), col: t.pal.glow, drag: 1, grav: 0 });
  }

  // projectiles
  for (const [id, p] of projs) {
    p.age += dt;
    if (p.age > p.life + 0.3) {
      projs.delete(id);
      continue;
    }
    drawProj(g, p, dt);
  }

  // timed effects
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.age += dt;
    if (e.age >= e.life) {
      effects.splice(i, 1);
      continue;
    }
    g.save();
    try {
      e.draw(g, e.age / e.life, e.age);
    } finally {
      g.restore();
    }
  }

  // particles
  g.globalCompositeOperation = "lighter";
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) {
      parts[i] = parts[parts.length - 1];
      parts.pop();
      continue;
    }
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr;
    p.vy *= dr;
    p.vz = p.vz * dr - p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z = Math.max(0, p.z + p.vz * dt);
    const k = p.age / p.life;
    blob(g, sx(p.x, p.y), sy(p.x, p.y, p.z), p.r * (1 - k * 0.5), p.col, 1 - k);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

/** Ground marks (scorch, rime, cracks): drawn under the actors; aged by their own clock. */
let lastG = -1;
function groundFrame(g: G, c: Cam) {
  const dt = lastG < 0 ? 0 : Math.max(0, Math.min(0.1, c.time - lastG));
  lastG = c.time;
  if (!marks.length) return;
  for (let i = marks.length - 1; i >= 0; i--) {
    const e = marks[i];
    e.age += dt;
    if (e.age >= e.life) {
      marks.splice(i, 1);
      continue;
    }
    g.save();
    try {
      e.draw(g, e.age / e.life, e.age);
    } finally {
      g.restore();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

addLayer("ground", groundFrame);
addLayer("fx", frame);

/** Forget everything (match over / disconnected). */
export function clearSkillFx() {
  parts.length = 0;
  effects.length = 0;
  marks.length = 0;
  projs.clear();
  auras.clear();
  buffs.length = 0;
  guards.length = 0;
  totems.clear();
  zones.clear();
  lastCast.clear();
}
