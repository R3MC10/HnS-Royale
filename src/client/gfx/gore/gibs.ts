// Gibs: severed heads / limbs / meat / bone, procedurally painted. Pooled (fixed array), they fly
// with spin and bounce, bleed a trail, skid a smear on impact, settle, and are then baked into the
// ground decal layer so they persist at no per-frame cost.
import { depthOf, isoX, isoY, K, SQ } from "../iso";
import type { Sprite } from "../pixel";
import type { Cam } from "../view";
import { goreSound, M_BLOOD, M_CHAR, M_DUST, M_ECTO, M_ICE, MATS, persistentBlood, rr, seeded, type Mat } from "./core";
import { groundTransform, stamp } from "./decals";
import { P_DROP, spawnP } from "./particles";
import { paintSmear, paintSplat } from "./paint";
import { gibArt, gibArtSize, type GibTheme, type GoreArt } from "./painted";

export const G_HEAD = 0;
export const G_ARM = 1;
export const G_LEG = 2;
export const G_TORSO = 3;
export const G_MEAT = 4;
export const G_GUT = 5;
export const G_BONE = 6;
export const G_RIB = 7;
export const G_ICE = 8;
export const G_ROCK = 9;
export const G_CHAR = 10;

/** Colours for a victim's pieces. */
export interface GibLook {
  skin: string;
  cloth: string; // torso / sleeve
  hands: string; // gloves (or skin)
  feet: string; // boots
  helm: string | null; // helmet colour (null = hair)
  hair: string;
  horns?: boolean;
  monster?: boolean; // beastly head: muzzle + teeth, no helmet
  theme?: GibTheme; // painted pieces to use (gore/painted.ts); none = procedural only
}

interface Gib {
  on: boolean;
  kind: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  a: number;
  va: number;
  s: number;
  mat: Mat;
  seed: number;
  t: number;
  rest: number; // time settled
  bounces: number;
  look: GibLook;
  spr: Sprite | null; // rig piece (player limb / head with its gear) instead of painted art
  art: GoreArt | null; // painted fx sprite (upright billboard) instead of the procedural piece
  sc: { x: number; y: number }; // sprite visual centre (canvas px)
  draw: () => void;
}

const MAX = 240;
const DEFAULT_LOOK: GibLook = { skin: "#c49072", cloth: "#5a4a3a", hands: "#c49072", feet: "#3a2e24", helm: null, hair: "#2a1e16" };
const gibs: Gib[] = [];
for (let i = 0; i < MAX; i++) {
  const g: Gib = { on: false, kind: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, a: 0, va: 0, s: 1, mat: 0, seed: 0, t: 0, rest: 0, bounces: 0, look: DEFAULT_LOOK, spr: null, art: null, sc: { x: 0, y: 0 }, draw: () => drawOne(g) };
  gibs.push(g);
}
/** Visual centre of a sprite's opaque pixels (cached), so severed pieces spin about themselves. */
const centres = new WeakMap<HTMLCanvasElement, { x: number; y: number }>();
function spriteCentre(s: Sprite) {
  let c = centres.get(s.cv);
  if (c) return c;
  c = { x: s.cv.width / 2, y: s.cv.height / 2 };
  try {
    const W = s.cv.width;
    const H = s.cv.height;
    const d = s.cv.getContext("2d")!.getImageData(0, 0, W, H).data;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < W; x += 2)
        if (d[(y * W + x) * 4 + 3] > 40) {
          sx += x;
          sy += y;
          n++;
        }
    if (n) c = { x: sx / n, y: sy / n };
  } catch {
    /* tainted / unavailable: canvas centre */
  }
  centres.set(s.cv, c);
  return c;
}
let live = 0;
const ZK = 0.62;
const GRAV = 640;

export function gibTotal() {
  return live;
}

export function spawnGib(kind: number, mat: Mat, x: number, y: number, z: number, vx: number, vy: number, vz: number, s: number, look: GibLook = DEFAULT_LOOK, spr: Sprite | null = null) {
  let g = gibs.find((q) => !q.on);
  if (!g) {
    // Recycle: bake the longest-settled (or oldest) gib.
    g = gibs.reduce((a, b) => (a.rest + a.t * 0.01 > b.rest + b.t * 0.01 ? a : b));
    bakeGib(g);
  }
  g.on = true;
  live++;
  g.kind = kind;
  g.mat = mat;
  g.x = x;
  g.y = y;
  g.z = z;
  g.vx = vx;
  g.vy = vy;
  g.vz = vz;
  g.a = Math.random() * Math.PI * 2;
  g.va = rr(-14, 14);
  g.s = s;
  g.seed = (Math.random() * 1e9) | 0;
  g.t = 0;
  g.rest = 0;
  g.bounces = 0;
  g.look = look;
  g.spr = spr;
  if (spr) g.sc = spriteCentre(spr);
  g.art = spr ? null : gibArt(look.theme, kind, mat, g.seed);
}

/** Painted pieces lie around for a while before they are baked into the ground layer. */
const ART_REST = 24;
/** Soft contact shadow blob (shared): grounds a resting piece so it does not look pasted on. */
let shadowBlob: HTMLCanvasElement | null = null;
function contactShadow(c: CanvasRenderingContext2D, ext: number) {
  if (!shadowBlob) {
    shadowBlob = document.createElement("canvas");
    shadowBlob.width = 64;
    shadowBlob.height = 32;
    const b = shadowBlob.getContext("2d")!;
    b.scale(1, 0.5);
    const gr = b.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,0.62)");
    gr.addColorStop(0.55, "rgba(0,0,0,0.34)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    b.fillStyle = gr;
    b.fillRect(0, 0, 64, 64);
  }
  const w = ext * 2.5;
  c.drawImage(shadowBlob, -w / 2, ext * 0.18 - w / 4, w, w / 2);
}

function drawArt(c: CanvasRenderingContext2D, a: GoreArt, kind: number, s: number, ang: number, grounded = false) {
  // (capped: a boss's pieces scale with its radius and came out as 130 px slabs of flat bark)
  const ext = (Math.min(s, 8) * K * gibArtSize(kind)) / 2;
  const k = ext / Math.max(a.hw, a.hh);
  if (grounded) contactShadow(c, ext);
  c.rotate(ang);
  c.scale(k, k);
  c.drawImage(a.im, -a.cx, -a.cy);
}

function bakeGib(g: Gib) {
  if (!g.on) return;
  g.on = false;
  live--;
  if (g.spr || (!persistentBlood() && g.kind !== G_ROCK)) return;
  const snap = { ...g };
  if (g.art) {
    const a = g.art;
    stamp(g.x, g.y, g.s * 4, (ctx) => drawArt(ctx, a, snap.kind, snap.s, snap.a, true), true, true);
    return;
  }
  stamp(g.x, g.y, g.s * 3, (ctx) => {
    ctx.rotate(snap.a);
    paintGib(ctx, snap, 0);
  });
}

export function stepGibs(dt: number) {
  for (const g of gibs) {
    if (!g.on) continue;
    g.t += dt;
    if (g.rest > 0 || (g.z <= 0 && Math.abs(g.vz) < 1 && Math.hypot(g.vx, g.vy) < 4)) {
      g.rest += dt;
      g.vx = g.vy = g.vz = 0;
      if (g.rest > (g.spr ? 90 : g.art ? ART_REST : 2.2)) bakeGib(g);
      continue;
    }
    g.vz -= GRAV * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.z += g.vz * dt;
    g.a += g.va * dt;
    // Blood trail while flying (fleshy pieces only).
    const bleeds = g.mat !== M_DUST && g.mat !== M_ICE && g.mat !== M_CHAR && g.kind !== G_ROCK && g.kind !== G_ICE && g.kind !== G_BONE;
    if (bleeds && g.t < 1.6 && Math.random() < dt * 30) spawnP(P_DROP, g.mat, g.x, g.y, g.z, g.vx * 0.2 + rr(-15, 15), g.vy * 0.2 + rr(-15, 15), rr(-10, 30), rr(0.8, 1.6), rr(0.7, 1.4));
    if (g.z <= 0) {
      g.z = 0;
      const sp = Math.hypot(g.vx, g.vy);
      if (g.bounces === 0 && bleeds) {
        // First impact: splat + skid smear.
        const m = g.mat;
        const s = g.s;
        const sd = g.seed;
        const vx = g.vx;
        const vy = g.vy;
        stamp(g.x, g.y, s * 3, (c) => paintSplat(c, m, s * 0.9, vx, vy, sd, 0.6));
        if (sp > 60) {
          const len = Math.min(40, sp * 0.12);
          stamp(g.x, g.y, len + s, (c) => paintSmear(c, m, len, s * 0.5, vx, vy, sd + 1));
        }
        if (g.kind === G_HEAD) goreSound("gore.squelch", g.x, g.y, 0.7, 1.2);
      } else if (g.bounces === 0 && (g.kind === G_BONE || g.kind === G_ROCK || g.kind === G_ICE)) goreSound("gore.bonecrack", g.x, g.y, 0.35, 1.4);
      g.bounces++;
      g.vz = g.vz < -50 ? -g.vz * (g.kind === G_HEAD ? 0.42 : 0.3) : 0;
      g.vx *= 0.55;
      g.vy *= 0.55;
      g.va *= 0.5;
    }
  }
}

// ---- painting (world-plane, centred on the gib, rotated) ------------------------------------------

type G = CanvasRenderingContext2D;

function shade(g: G, r: number, base: string, dark = "rgba(0,0,0,0.45)") {
  const grd = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  grd.addColorStop(0, "rgba(255,255,255,0.18)");
  grd.addColorStop(0.5, "rgba(0,0,0,0)");
  grd.addColorStop(1, dark);
  g.fillStyle = base;
  g.fill();
  g.fillStyle = grd;
  g.fill();
}

function stump(g: G, x: number, y: number, r: number, mat: Mat) {
  const m = MATS[mat];
  g.beginPath();
  g.ellipse(x, y, r * 0.55, r, 0, 0, Math.PI * 2);
  g.fillStyle = m.drop[2];
  g.fill();
  g.beginPath();
  g.ellipse(x, y, r * 0.38, r * 0.72, 0, 0, Math.PI * 2);
  g.fillStyle = m.drop[0];
  g.fill();
  if (mat !== M_ECTO) {
    g.beginPath();
    g.arc(x, y, r * 0.24, 0, Math.PI * 2);
    g.fillStyle = "#efe6d4";
    g.fill();
  }
}

function capsule(g: G, x0: number, x1: number, w: number) {
  g.beginPath();
  g.moveTo(x0, -w);
  g.lineTo(x1, -w);
  g.arc(x1, 0, w, -Math.PI / 2, Math.PI / 2);
  g.lineTo(x0, w);
  g.arc(x0, 0, w, Math.PI / 2, -Math.PI / 2);
  g.closePath();
}

export function paintGib(g: G, gb: Pick<Gib, "kind" | "s" | "mat" | "seed" | "look">, t: number) {
  const s = gb.s;
  const L = gb.look;
  const rand = seeded(gb.seed);
  const m = MATS[gb.mat];
  void t;
  switch (gb.kind) {
    case G_HEAD: {
      // Neck stump at -x, face toward +x.
      g.beginPath();
      g.arc(0, 0, s, 0, Math.PI * 2);
      shade(g, s, L.skin);
      if (L.monster) {
        // Muzzle, teeth, eye
        g.beginPath();
        g.ellipse(s * 0.85, 0, s * 0.6, s * 0.45, 0, 0, Math.PI * 2);
        shade(g, s * 0.6, L.cloth);
        g.fillStyle = "#f0e6cc";
        for (let i = -2; i <= 2; i++) {
          g.beginPath();
          g.moveTo(s * 1.25, i * s * 0.14 - s * 0.05);
          g.lineTo(s * 1.5, i * s * 0.14);
          g.lineTo(s * 1.25, i * s * 0.14 + s * 0.05);
          g.fill();
        }
        g.fillStyle = "#ffcc33";
        g.beginPath();
        g.arc(s * 0.35, -s * 0.45, s * 0.14, 0, Math.PI * 2);
        g.fill();
      } else {
        // Eyes (glassy), mouth
        g.fillStyle = "#1a0e0a";
        g.beginPath();
        g.arc(s * 0.62, -s * 0.32, s * 0.12, 0, Math.PI * 2);
        g.arc(s * 0.62, s * 0.32, s * 0.12, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.7)";
        g.beginPath();
        g.arc(s * 0.6, -s * 0.36, s * 0.04, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#5a1a14";
        g.lineWidth = s * 0.1;
        g.beginPath();
        g.moveTo(s * 0.85, -s * 0.2);
        g.quadraticCurveTo(s * 0.95, 0, s * 0.85, s * 0.2);
        g.stroke();
        // Hair or helmet cap on the back of the head
        g.beginPath();
        g.arc(0, 0, s * 1.04, Math.PI * 0.55, Math.PI * 1.45);
        g.quadraticCurveTo(s * 0.5, 0, Math.cos(Math.PI * 0.55) * s * 1.04, Math.sin(Math.PI * 0.55) * s * 1.04);
        shade(g, s, L.helm ?? L.hair);
        if (L.helm) {
          g.strokeStyle = "rgba(255,255,255,0.35)";
          g.lineWidth = s * 0.08;
          g.beginPath();
          g.arc(0, 0, s * 0.9, Math.PI * 0.75, Math.PI * 1.25);
          g.stroke();
        }
        if (L.horns) {
          g.fillStyle = "#e8dcc0";
          for (const sg of [-1, 1]) {
            g.beginPath();
            g.moveTo(-s * 0.2, sg * s * 0.8);
            g.quadraticCurveTo(-s * 0.4, sg * s * 1.8, s * 0.3, sg * s * 1.9);
            g.quadraticCurveTo(-s * 0.05, sg * s * 1.5, s * 0.2, sg * s * 0.8);
            g.fill();
          }
        }
      }
      // Ragged neck
      stump(g, -s * 0.95, 0, s * 0.5, gb.mat);
      break;
    }
    case G_ARM:
    case G_LEG: {
      const leg = gb.kind === G_LEG;
      const len = s * (leg ? 3.2 : 2.6);
      const w = s * (leg ? 0.55 : 0.42);
      capsule(g, -len / 2, len / 2, w);
      shade(g, w * 2, L.cloth);
      // Joint crease
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = w * 0.25;
      g.beginPath();
      g.moveTo(0, -w);
      g.lineTo(rand() * w * 0.4, w);
      g.stroke();
      // Hand / boot at +x
      g.beginPath();
      if (leg) g.ellipse(len / 2 + w * 0.3, w * 0.35, w * 1.25, w * 0.95, 0.3, 0, Math.PI * 2);
      else g.arc(len / 2 + w * 0.2, 0, w * 1.05, 0, Math.PI * 2);
      shade(g, w * 1.2, leg ? L.feet : L.hands);
      if (!leg) {
        g.strokeStyle = "rgba(0,0,0,0.35)";
        g.lineWidth = w * 0.18;
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(len / 2 + w * 0.6, i * w * 0.4);
          g.lineTo(len / 2 + w * 1.3, i * w * 0.5);
          g.stroke();
        }
      }
      // Torn end with bone
      g.beginPath();
      g.moveTo(-len / 2 - w * 0.2, 0);
      g.lineTo(-len / 2 - w * 1.4, -w * 0.15);
      g.lineTo(-len / 2 - w * 1.5, w * 0.12);
      g.lineTo(-len / 2 - w * 0.2, w * 0.25);
      g.fillStyle = "#e9dfcc";
      g.fill();
      stump(g, -len / 2, 0, w * 1.05, gb.mat);
      break;
    }
    case G_TORSO: {
      // Ribcage chunk in the armour colour with exposed meat
      g.beginPath();
      g.ellipse(0, 0, s * 1.4, s * 1.05, 0, 0, Math.PI * 2);
      shade(g, s * 1.3, L.cloth);
      g.beginPath();
      g.ellipse(-s * 0.3, 0, s * 0.85, s * 0.75, 0, 0, Math.PI * 2);
      g.fillStyle = m.drop[1];
      g.fill();
      g.strokeStyle = "#ecdfc8";
      g.lineWidth = s * 0.16;
      g.lineCap = "round";
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(-s * 0.9, i * s * 0.28);
        g.quadraticCurveTo(-s * 0.3, i * s * 0.36 - s * 0.1, s * 0.3, i * s * 0.3);
        g.stroke();
      }
      g.fillStyle = m.drop[0];
      g.beginPath();
      g.arc(-s * 0.2, s * 0.15, s * 0.25, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case G_MEAT:
    case G_CHAR: {
      const charred = gb.kind === G_CHAR || gb.mat === M_CHAR;
      g.beginPath();
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = s * (0.65 + rand() * 0.5);
        if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      shade(g, s, charred ? "#1e1612" : m.drop[2]);
      g.fillStyle = charred ? "rgba(255,110,30,0.55)" : m.drop[0];
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc((rand() - 0.5) * s, (rand() - 0.5) * s, s * (0.1 + rand() * 0.18), 0, Math.PI * 2);
        g.fill();
      }
      if (!charred) {
        g.fillStyle = "rgba(255,210,190,0.5)"; // fat / sinew
        g.beginPath();
        g.ellipse(s * 0.2, -s * 0.2, s * 0.3, s * 0.1, rand() * 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case G_GUT: {
      // Coiled intestine
      g.lineCap = "round";
      g.lineJoin = "round";
      const path = () => {
        g.beginPath();
        g.moveTo(-s * 1.4, 0);
        g.bezierCurveTo(-s * 0.8, -s * 1.2, s * 0.2, -s * 1.1, s * 0.3, -s * 0.2);
        g.bezierCurveTo(s * 0.4, s * 0.8, -s * 0.6, s * 0.8, -s * 0.3, s * 0.1);
        g.bezierCurveTo(-s * 0.1, -s * 0.5, s * 1.2, -s * 0.3, s * 1.4, s * 0.5);
      };
      path();
      g.strokeStyle = gb.mat === M_BLOOD ? "#a8545a" : m.drop[2];
      g.lineWidth = s * 0.55;
      g.stroke();
      path();
      g.strokeStyle = gb.mat === M_BLOOD ? "#d48a8a" : m.drop[3];
      g.lineWidth = s * 0.22;
      g.stroke();
      break;
    }
    case G_BONE:
    case G_RIB: {
      g.lineCap = "round";
      g.strokeStyle = "#eadfca";
      g.lineWidth = s * 0.35;
      g.beginPath();
      if (gb.kind === G_RIB) {
        g.arc(0, s * 0.8, s * 1.2, Math.PI * 1.15, Math.PI * 1.85);
      } else {
        g.moveTo(-s, 0);
        g.lineTo(s, 0);
      }
      g.stroke();
      if (gb.kind === G_BONE) {
        g.fillStyle = "#f4ead8";
        g.beginPath();
        g.arc(-s, -s * 0.18, s * 0.25, 0, Math.PI * 2);
        g.arc(-s, s * 0.18, s * 0.25, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = m.drop[1];
        g.beginPath();
        g.arc(s, 0, s * 0.22, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case G_ICE: {
      // Frozen flesh chunk: translucent ice shell with a red core
      g.beginPath();
      g.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      g.fillStyle = gb.mat === M_ICE ? "#7a1a1a" : m.drop[1];
      g.fill();
      g.beginPath();
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.4;
        const r = s * (0.8 + rand() * 0.5);
        if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = "rgba(190,230,250,0.6)";
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.85)";
      g.lineWidth = s * 0.08;
      g.stroke();
      g.beginPath();
      g.moveTo(-s * 0.5, -s * 0.3);
      g.lineTo(s * 0.1, -s * 0.6);
      g.stroke();
      break;
    }
    case G_ROCK: {
      g.beginPath();
      const n = 5 + ((rand() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.5;
        const r = s * (0.7 + rand() * 0.45);
        if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      shade(g, s, L.cloth, "rgba(0,0,0,0.6)");
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.lineWidth = s * 0.08;
      g.stroke();
      break;
    }
  }
}

let dg: CanvasRenderingContext2D | null = null;
let dcam: Cam | null = null;

function drawOne(gb: Gib) {
  const g = dg;
  const cam = dcam;
  if (!g || !cam) return;
  const sx = cam.offX + isoX(gb.x, gb.y);
  const sy = cam.offY + isoY(gb.x, gb.y);
  // Ground shadow while airborne
  if (gb.z > 1) {
    g.globalAlpha = Math.max(0.1, 0.4 - gb.z * 0.004);
    g.fillStyle = "#000";
    g.beginPath();
    g.ellipse(sx, sy, gb.s * K * 1.1, gb.s * K * SQ * 1.1, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  g.save();
  if (gb.spr) {
    const s = gb.spr;
    const d = s.d ?? 1;
    g.translate(sx, sy - gb.z * ZK - 2);
    g.rotate(gb.a * (gb.rest > 0 ? 0.15 : 1));
    if (gb.rest > 60) g.globalAlpha = Math.max(0, 1 - (gb.rest - 60) / 30);
    g.drawImage(s.cv, -gb.sc.x / d, -gb.sc.y / d, s.cv.width / d, s.cv.height / d);
  } else if (gb.art) {
    g.translate(sx, sy - gb.z * ZK - (gb.z > 0 ? 2 : 0));
    // Airborne pieces tumble (squash with the spin); at rest they lie as painted.
    if (gb.rest <= 0 && gb.z > 0) g.scale(1, 0.6 + 0.4 * Math.abs(Math.cos(gb.t * 9 + gb.seed)));
    drawArt(g, gb.art, gb.kind, gb.s, gb.a, gb.z <= 0);
  } else {
    groundTransform(g, sx, sy - gb.z * ZK);
    g.rotate(gb.a);
    // Airborne pieces tumble: squash on one axis with the spin so they read as 3D.
    if (gb.rest <= 0 && gb.z > 0) g.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(gb.t * 9 + gb.seed)));
    paintGib(g, gb, gb.t);
  }
  g.restore();
}

/** Depth layer: one sorted drawable per visible gib (closures are bound once per pool slot). */
export function drawGibsDepth(push: (depth: number, draw: () => void) => void, cam: Cam) {
  dcam = cam;
  if (!live) return;
  for (const gb of gibs) {
    if (!gb.on) continue;
    const sx = cam.offX + isoX(gb.x, gb.y);
    const sy = cam.offY + isoY(gb.x, gb.y);
    if (sx < -60 || sy < -60 || sx > cam.ww + 60 || sy > cam.wh + 80) continue;
    push(depthOf(gb.x, gb.y) + (gb.z > 0 ? 6 : -4), gb.draw);
  }
}

/** The depth closures need the world context; the "over" layer of the previous frame provides it. */
export function setGibContext(g: CanvasRenderingContext2D) {
  dg = g;
}

export function clearGibs() {
  for (const g of gibs) g.on = false;
  live = 0;
}
