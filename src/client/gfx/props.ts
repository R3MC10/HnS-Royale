// World props, all generated in code. Obstacles get a visual that covers their collision circle:
// faceted rock clusters, ruined walls with broken pillars, a dead tree on a rocky mound, or the old
// shrine (the obstacle nearest the centre). Solids are heightfields splatted back to front; walls
// and pillars also draw their vertical faces. Small walk-through dressing (graves, bone piles, dead
// shrubs, camp stakes, braziers) is scattered with a fixed seed so every client sees the same world.
import { MAP_H, MAP_W } from "../../shared/constants";
import { currentMap, isWalkable, OBSTACLES, ZONE, zoneAt } from "../../shared/map";
import { ART, K, SQ } from "./iso";

/** Solid heights are authored in old pixels; this converts them to screen px in the 3/4 view. */
const ZS = ART * 0.87;
import { hash2, mixColor, mulberry32, PixBuf, ramp, rgba, type Sprite, sprite, vnoise } from "./pixel";
import { add, lerp3, mul, norm, projector, rasterize, v, type Part, type V3 } from "./rig";

const pal = (...h: string[]) => h.map((c) => rgba(c));
const ROCK = pal("#121113", "#1e1c1e", "#2b2828", "#3c3734", "#544c45", "#70675d", "#8e8476");
const LICHEN = pal("#1a1d16", "#262b1f", "#343b29", "#444c33");
const RUIN = pal("#121116", "#1d1b22", "#2a2730", "#3a3640", "#4e4953", "#666069", "#827b84");
const DIRT = pal("#140f0b", "#1e1711", "#291f17", "#34281d", "#3f3123", "#4a3a2a", "#57442f");
const RUNE = rgba("#8fe8ff");
const RUNE2 = rgba("#3f9fc0");

const LX = -0.55;
const LY = -0.45;
const LZ = 0.7;
const LN = Math.hypot(LX, LY, LZ);

function shadeIdx(nx: number, ny: number, nz: number, n: number): number {
  const l = Math.hypot(nx, ny, nz) || 1;
  const lit = (nx * LX + ny * LY + nz * LZ) / (l * LN);
  return Math.max(0, Math.min(n - 1, Math.floor(((lit + 0.45) / 1.45) * n)));
}

// ---- solids ---------------------------------------------------------------------------
interface Solid {
  /** Height in px at local world point (x, y), or -1. Also fills n / sn / u / gap. */
  z(x: number, y: number): number;
  n: [number, number, number]; // top normal
  sn: [number, number]; // side normal (for vertical faces)
  u: number; // texture coordinate along the face
  gap: number; // distance to the next facet (edge highlight)
  pal: number[];
  cols: boolean;
  brick: boolean;
  lichen: boolean;
  seed: number;
}

function rock(cx: number, cy: number, rr: number, hh: number, seed: number, p = ROCK): Solid {
  const rnd = mulberry32(seed * 7919 + 17);
  const planes: [number, number, number, number][] = [];
  const n = 6 + Math.floor(rnd() * 3);
  const a0 = rnd() * 6.283;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + (rnd() - 0.5) * 0.7) / n) * Math.PI * 2;
    planes.push([Math.cos(a), Math.sin(a), 1.05 + rnd() * 0.9, hh * (0.95 + rnd() * 0.35)]);
  }
  const top = hh * (0.72 + rnd() * 0.2);
  const t0 = (rnd() - 0.5) * 0.5;
  const t1 = (rnd() - 0.5) * 0.5;
  const s: Solid = {
    n: [0, 0, 1],
    sn: [0, 0],
    u: 0,
    gap: 9,
    pal: p,
    cols: false,
    brick: false,
    lichen: p === ROCK,
    seed,
    z(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > rr * rr * 2.2) return -1;
      let z = top * (1 + (t0 * dx + t1 * dy) / rr);
      let z2 = Infinity;
      let best = -1;
      for (let i = 0; i < planes.length; i++) {
        const [px, py, k, h] = planes[i];
        const zz = h * (1 - (k * (dx * px + dy * py)) / rr);
        if (zz < z) {
          z2 = z;
          z = zz;
          best = i;
        } else if (zz < z2) z2 = zz;
      }
      if (z <= 0.3) return -1;
      if (best < 0) s.n = [(-top * t0 * 2) / rr, (-top * t1 * 2) / rr, 1];
      else {
        const [px, py, k, h] = planes[best];
        s.n = [((h * k) / rr) * px * 2, ((h * k) / rr) * py * 2, 1];
      }
      s.gap = z2 - z;
      return z;
    },
  };
  return s;
}

/** Oriented box with a broken (noisy) top; `hFn` gives the height along the length. */
function box(cx: number, cy: number, ang: number, len: number, thk: number, hFn: (u: number) => number, seed: number, p = RUIN): Solid {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const s: Solid = {
    n: [0, 0, 1],
    sn: [0, 0],
    u: 0,
    gap: 9,
    pal: p,
    cols: true,
    brick: true,
    lichen: false,
    seed,
    z(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * c + dy * sn;
      const w = -dx * sn + dy * c;
      if (Math.abs(u) > len / 2 || Math.abs(w) > thk / 2) return -1;
      const z = hFn(u);
      if (z <= 0.5) return -1;
      if (thk / 2 - Math.abs(w) < len / 2 - Math.abs(u)) {
        const k = Math.sign(w) || 1;
        s.sn = [-sn * k, c * k];
        s.u = u;
      } else {
        const k = Math.sign(u) || 1;
        s.sn = [c * k, sn * k];
        s.u = w;
      }
      s.n = [0, 0, 1];
      return z;
    },
  };
  return s;
}

function pillar(cx: number, cy: number, pr: number, ph: number, broken: number, seed: number): Solid {
  const ba = hash2(seed, 2, 91) * 6.283;
  const bx = Math.cos(ba);
  const by = Math.sin(ba);
  const s: Solid = {
    n: [0, 0, 1],
    sn: [0, 0],
    u: 0,
    gap: 9,
    pal: RUIN,
    cols: true,
    brick: false,
    lichen: false,
    seed,
    z(x, y) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > pr) return -1;
      // Capital ring near the top, broken pillars slant.
      const z = ph - broken * ((dx * bx + dy * by) / pr) * 4 - broken * (hash2(Math.round(dx), Math.round(dy), seed) * 2);
      s.n = [broken * bx * 0.6, broken * by * 0.6, 1];
      s.sn = [dx / (d || 1), dy / (d || 1)];
      s.u = Math.atan2(dy, dx) * 4;
      return z;
    },
  };
  return s;
}

/** Splat solids (back to front: rows of increasing world y) into a buffer. */
function splat(buf: PixBuf, solids: Solid[], ax: number, ay: number, B: number) {
  const step = 0.55 / K;
  const zAt = (x: number, y: number) => {
    let m = -1;
    for (const s of solids) m = Math.max(m, s.z(x, y));
    return m;
  };
  for (let y = -B; y <= B; y += step) {
    for (let x = -B; x <= B; x += step) {
      let best: Solid | null = null;
      let bz = -1;
      for (const s of solids) {
        const z = s.z(x, y);
        if (z > bz) {
          bz = z;
          best = s;
        }
      }
      if (!best || bz <= 0) continue;
      best.z(x, y); // refresh normals for the winner
      const P = best.pal;
      const N = P.length;
      let i = shadeIdx(best.n[0], best.n[1], best.n[2], N);
      if (!best.cols) {
        if (Math.abs(vnoise(x / 6 + best.seed * 3.1, y / 6, 63) - 0.5) < 0.028) i -= 2; // cracks
        else if (best.gap < 1.1 && i >= 3) i += 1; // facet edge glint
        if (hash2(Math.round(x * 2), Math.round(y * 2), best.seed) > 0.9) i -= 1;
      } else if (hash2(Math.round(x * 2), Math.round(y * 2), best.seed) > 0.85) i -= 1;
      i = Math.max(0, Math.min(N - 1, i));
      let c = P[i];
      if (best.lichen && best.n[2] / Math.hypot(...best.n) > 0.8 && vnoise(x / 7 + best.seed, y / 7, 64) > 0.62) c = LICHEN[Math.min(3, Math.max(0, i - 2))];
      const sx = ax + x * K;
      const gy = ay + y * K * SQ;
      const px = Math.floor(sx);
      const py = Math.floor(gy - bz * ZS);
      buf.set(px, py, c);
      buf.set(px, py + 1, c);
      // Vertical face where the surface drops toward the viewer (+y).
      const front = zAt(x, y + step * 1.5);
      if (front < bz - 1.5) {
        const sideI = best.cols ? shadeIdx(best.sn[0], best.sn[1], 0.25, N) + 1 : Math.max(0, i - 2);
        const bottom = Math.floor(gy - Math.max(0, front) * ZS);
        for (let yy = py + 1; yy <= bottom; yy++) {
          const zz = bz - (yy - py) / ZS;
          let si = sideI;
          if (best.brick) {
            const row = Math.floor(zz / 5);
            const uu = best.u + (row & 1) * 5;
            if (zz - row * 5 < 1 || ((uu % 11) + 11) % 11 < 1) si -= 2;
            else if (hash2(Math.floor(uu / 11), row, best.seed + 40) > 0.75) si += 1;
          } else if (best.cols && Math.floor(best.u) % 3 === 0) si -= 1; // fluting
          else if (!best.cols && hash2(px, yy, best.seed + 3) > 0.8) si -= 1;
          if (zz < 6 && vnoise(best.u / 4 + x / 4, zz / 3, 43 + best.seed) > 0.55) {
            buf.set(px, yy, mixColor(P[Math.max(0, Math.min(N - 1, si))], LICHEN[1], 0.7));
            continue;
          }
          buf.set(px, yy, P[Math.max(0, Math.min(N - 1, si))]);
        }
      }
    }
  }
}

// ---- obstacles --------------------------------------------------------------------------
export type ObsKind = "rocks" | "ruin" | "tree" | "shrine" | "water";
const OBS_KINDS: readonly string[] = ["rocks", "ruin", "tree", "shrine", "water"];

function findShrine(): number {
  // Map data may name it; otherwise the big obstacle nearest the centre.
  const named = OBSTACLES.findIndex((o) => (o as { k?: string }).k === "shrine");
  if (named >= 0) return named;
  let best = -1;
  let bd = Infinity;
  OBSTACLES.forEach((o, i) => {
    if ((o as { k?: string }).k) return;
    const d = Math.hypot(o.x - MAP_W / 2, o.y - MAP_H / 2) - o.r * 0.5;
    if (d < bd && o.r > 45) {
      bd = d;
      best = i;
    }
  });
  return best;
}
let SHRINE_I = findShrine();
/** Index of the shrine obstacle (-1 if the map has none). */
export function shrineIndex() {
  return SHRINE_I;
}

export function obstacleKind(i: number): ObsKind {
  if (i === SHRINE_I) return "shrine";
  const k = (OBSTACLES[i] as { k?: string } | undefined)?.k;
  if (k && OBS_KINDS.includes(k)) return k as ObsKind;
  const h = hash2(i, 7, 90);
  if (h < 0.24) return "ruin";
  if (h < 0.42) return "tree";
  return "rocks";
}

const WOOD = [rgba("#100d0b"), rgba("#211b17"), rgba("#362e27"), rgba("#4f453b")] as [number, number, number, number];
const BONE = ramp("#4a4438", "#7d7462", "#aaa088", "#cfc6ac");
const IRON = ramp("#0e0e10", "#1e1e22", "#33333a", "#4f4f58");

function treeParts(seed: number, scale: number): Part[] {
  const rnd = mulberry32(seed * 31 + 7);
  const P: Part[] = [];
  const branch = (a: V3, dir: V3, len: number, r: number, depth: number) => {
    const b = add(a, mul(dir, len));
    P.push({ kind: "cap", a, b, r, ramp: WOOD });
    if (depth <= 0 || r < 0.45) return;
    const n = 2 + (rnd() < 0.45 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const d2 = norm(add(dir, v((rnd() - 0.5) * 1.6, (rnd() - 0.5) * 1.6, (rnd() - 0.25) * 0.7)));
      branch(lerp3(a, b, 0.6 + rnd() * 0.4), d2, len * (0.58 + rnd() * 0.15), r * 0.6, depth - 1);
    }
  };
  branch(v(0, 0, 0), norm(v((rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4, 1)), 22 * scale, 2.8 * scale, 4);
  for (let k = 0; k < 4; k++) {
    const a = rnd() * 6.283;
    P.push({ kind: "cap", a: v(0, 0, 3), b: v(Math.cos(a) * 7 * scale, Math.sin(a) * 7 * scale, 0), r: 1.4 * scale, ramp: WOOD });
  }
  return P;
}

const obsCache = new Map<number, Sprite>();
/** Visual for obstacle i: anchor = obstacle centre on the ground. */
export function obstacleSprite(i: number): Sprite {
  let s = obsCache.get(i);
  if (s) return s;
  const o = OBSTACLES[i];
  const r = o.r;
  const seed = i + 1;
  const rnd = mulberry32(seed * 104729);
  const kind = obstacleKind(i);
  const solids: Solid[] = [];
  let maxZ = 40;
  let tree: { x: number; y: number; z: number } | null = null;
  let rune: { x: number; y: number; z: number } | null = null;
  if (kind === "rocks") {
    const ox = (rnd() - 0.5) * r * 0.2;
    const oy = (rnd() - 0.5) * r * 0.2;
    solids.push(rock(ox, oy, r * 0.74, 8 + r * 0.28, seed));
    const n = 2 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const a = rnd() * 6.283;
      const d = r * (0.55 + rnd() * 0.3);
      const rr = r * (0.24 + rnd() * 0.18);
      solids.push(rock(Math.cos(a) * d, Math.sin(a) * d, rr, 4 + rr * 0.32, seed * 10 + k));
    }
  } else if (kind === "ruin") {
    const th = rnd() * Math.PI;
    const len = r * 1.75;
    const H = 20 + r * 0.14;
    const sd = seed;
    const hFn = (u: number) => {
      const t = vnoise(u / 10 + sd * 5, 0, 92);
      if (t < 0.22) return 4 + t * 10;
      return H * (0.45 + 0.55 * t) + (hash2(Math.floor(u / 3), 1, sd) - 0.5) * 3;
    };
    solids.push(box(0, 0, th, len, 9, hFn, seed));
    const ex = Math.cos(th) * (len / 2 + 2);
    const ey = Math.sin(th) * (len / 2 + 2);
    solids.push(pillar(ex, ey, 7, 34 + rnd() * 10, 0, seed + 1));
    solids.push(pillar(-ex, -ey, 7, 16 + rnd() * 10, 1, seed + 2));
    // Rubble and fallen blocks on both sides of the wall
    for (let k = 0; k < 5; k++) {
      const a = th + (k % 2 ? Math.PI / 2 : -Math.PI / 2) + (rnd() - 0.5) * 1.2;
      const d = r * (0.35 + rnd() * 0.45);
      const rr = r * (0.12 + rnd() * 0.12) + 3;
      solids.push(k < 2 ? box(Math.cos(a) * d, Math.sin(a) * d, rnd() * 3, rr * 1.6, rr, () => 5 + rnd() * 0 + rr * 0.3, seed + 20 + k) : rock(Math.cos(a) * d, Math.sin(a) * d, rr, 3 + rr * 0.35, seed * 20 + k, RUIN));
    }
    maxZ = 52;
  } else if (kind === "tree") {
    solids.push(rock(0, 0, r * 0.82, 5 + r * 0.1, seed, ROCK));
    for (let k = 0; k < 3; k++) {
      const a = rnd() * 6.283;
      const d = r * (0.6 + rnd() * 0.25);
      const rr = r * (0.18 + rnd() * 0.12);
      solids.push(rock(Math.cos(a) * d, Math.sin(a) * d, rr, 3 + rr * 0.35, seed * 30 + k));
    }
    tree = { x: 0, y: 0, z: 0 };
    maxZ = 96;
  } else {
    // Shrine: two-step plinth, a rune-carved monolith, four broken corner posts.
    const sd = seed;
    solids.push(box(0, 0, Math.PI / 4, r * 1.6, r * 1.6, () => 5, sd, RUIN));
    solids.push(box(0, 0, Math.PI / 4, r * 1.05, r * 1.05, () => 10, sd + 1, RUIN));
    solids.push(box(0, 0, Math.PI / 4, 16, 8, (u) => 50 - Math.abs(u) * 0.6, sd + 2, RUIN));
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      solids.push(pillar(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, 5, 18 + hash2(k, sd, 93) * 18, k % 2, sd + 10 + k));
    }
    rune = { x: 0, y: 0, z: 0 };
    maxZ = 60;
  }
  const B = r * 1.3;
  const W = Math.ceil(2 * B * K) + 12;
  const H = Math.ceil(2 * B * K * SQ + maxZ * ZS + 12);
  const ax = Math.floor(W / 2);
  const ay = Math.ceil(maxZ * ZS + B * K * SQ + 6);
  const buf = new PixBuf(W, H);
  splat(buf, solids, ax, ay, B);
  if (tree) {
    let z = -1;
    for (const so of solids) z = Math.max(z, so.z(0, 0));
    const parts = treeParts(seed, r > 55 ? 1.25 : 1);
    rasterize(parts, projector(rnd() * 6.283, ART, ax, ay - Math.max(0, z) * ZS + 1), ART, buf, false);
  }
  buf.outline(0.4);
  if (rune) {
    // Glowing glyph carved into the monolith's front faces.
    const gx = ax - 3;
    const gy = Math.round(ay + 5 * K * SQ - 40 * ZS);
    const glyph = [".x.", "xxx", ".x.", "x.x", ".x.", "x.x"];
    glyph.forEach((row, j) => [...row].forEach((ch, k) => ch === "x" && buf.set(gx + k, gy + j * 2, RUNE)));
    glyph.forEach((row, j) => [...row].forEach((ch, k) => ch === "x" && buf.set(gx + k, gy + j * 2 + 1, RUNE2)));
    buf.set(ax + 4, gy + 4, RUNE2);
    buf.set(ax + 5, gy + 8, RUNE2);
  }
  s = sprite(buf, ax, ay);
  obsCache.set(i, s);
  if (obsCache.size > 2500) obsCache.delete(obsCache.keys().next().value!); // big maps: bounded cache
  return s;
}

/** Obstacles whose ground gets cracked flagstones around it (refilled in place by refreshProps). */
export const PAVED: { o: (typeof OBSTACLES)[number]; k: ObsKind }[] = [];
function fillPaved() {
  PAVED.length = 0;
  OBSTACLES.forEach((o, i) => {
    const k = obstacleKind(i);
    if (k === "ruin" || k === "shrine") PAVED.push({ o, k });
  });
}
fillPaved();

// ---- scatter dressing -----------------------------------------------------------------------
export type ScatterKind = "grave" | "bones" | "shrub" | "stones";
export interface Scatter {
  x: number;
  y: number;
  kind: ScatterKind;
  seed: number;
  /** Painted-prop pick list for the place it stands in (sprites2d/decor.ts HINTS); kind is the fallback. */
  p?: string;
}

export const SCATTER: Scatter[] = [];
function fillScatter() {
  SCATTER.length = 0;
  for (const s of makeScatter()) SCATTER.push(s);
}
function makeScatter(): Scatter[] {
  // World agent: seeded per map, counts scale with open area, kinds weighted by the biome, and the
  // free test uses the map's spatial grid (no loop over every obstacle).
  const map = currentMap();
  const rnd = mulberry32(90210 ^ map.seed);
  const out: Scatter[] = [];
  const near = new Set<number>();
  const nkey = (x: number, y: number) => Math.floor(x / 24) * 65536 + Math.floor(y / 24);
  const free = (x: number, y: number, pad: number) => {
    if (!(x > 70 && y > 70 && x < MAP_W - 70 && y < MAP_H - 70) || !isWalkable(x, y, 1, pad)) return false;
    if (near.has(nkey(x, y))) return false;
    return true;
  };
  const push = (s: Scatter) => {
    out.push(s);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) near.add(nkey(s.x + a * 18, s.y + b * 18));
  };
  const sw = map.biome.scatter;
  // Dressing belongs to the place: headstone rows in graveyards, stumps in logging camps, bones in
  // lairs, rubble in ruins, ferns under the trees, turf in glades; roads stay mostly clear.
  const campNear = (x: number, y: number) => {
    for (const c of map.camps) if ((c.x - x) ** 2 + (c.y - y) ** 2 < 125 * 125) return true;
    return false;
  };
  let n = 0;
  const put = (x: number, y: number, kind: ScatterKind, p: string, pad = 24) => {
    if (!free(x, y, pad) || campNear(x, y)) return false;
    push({ x, y, kind, seed: (n++ % 48) + 1, p: p || undefined });
    return true;
  };
  for (const a of map.areas) {
    if (a.kind === "graveyard") {
      // Two plots of headstone rows either side of the middle.
      for (const side of [-1, 1]) {
        const rowsN = 2 + Math.floor(rnd() * 2);
        const colsN = 3 + Math.floor(rnd() * 3);
        const bx = a.x + side * (150 + rnd() * 40) - (side < 0 ? (colsN - 1) * 50 : 0);
        const by = a.y - ((rowsN - 1) * 72) / 2 + (rnd() - 0.5) * 60;
        for (let r = 0; r < rowsN; r++)
          for (let c = 0; c < colsN; c++) {
            if (rnd() < 0.12) continue; // a missing stone
            put(bx + c * 50 + (rnd() - 0.5) * 10, by + r * 72 + (rnd() - 0.5) * 10, "grave", rnd() < 0.1 ? "tomb" : "graves", 30);
          }
      }
    } else if (a.kind === "heart") {
      // Torches between the pillars of the ring.
      for (const [dx, dy] of [[0.92, 0.38], [0.38, 0.92], [-0.38, 0.92], [-0.92, 0.38], [-0.92, -0.38], [-0.38, -0.92], [0.38, -0.92], [0.92, -0.38]]) put(a.x + dx * 440, a.y + dy * 440, "stones", "torch", 30);
    }
  }
  type Row = [kind: ScatterKind, p: string, w: number];
  const TABLE: Record<number, { d: number; t: Row[] }> = {
    [ZONE.trail]: { d: 0.55, t: [["shrub", "forest", 4 * sw.shrub], ["stones", "", 2.5 * sw.stones], ["bones", "", 1.2 * sw.bones]] },
    [ZONE.road]: { d: 0.3, t: [["stones", "road", 3], ["stones", "", 2], ["bones", "", 0.6]] },
    [ZONE.glade]: { d: 0.95, t: [["shrub", "meadow", 9], ["stones", "", 1]] },
    [ZONE.thicket]: { d: 1.3, t: [["shrub", "forest", 9], ["stones", "", 1.5], ["bones", "", 0.5]] },
    [ZONE.graveyard]: { d: 0.75, t: [["grave", "graves", 4], ["grave", "tomb", 1.6], ["bones", "", 1], ["shrub", "meadow", 1.5]] },
    [ZONE.ruins]: { d: 1.0, t: [["stones", "rubble", 6], ["shrub", "meadow", 1.5], ["bones", "", 0.8]] },
    [ZONE.lumber]: { d: 1.1, t: [["stones", "lumber", 7], ["shrub", "forest", 1.5]] },
    [ZONE.lair]: { d: 1.4, t: [["bones", "den", 8], ["stones", "", 1]] },
    [ZONE.heart]: { d: 0.45, t: [["bones", "den", 3], ["stones", "rubble", 2]] },
  };
  const want = Math.round((map.openArea / 1e6) * 22);
  for (let a = 0, placed = 0; a < want * 14 && placed < want; a++) {
    const x = 90 + rnd() * (MAP_W - 180);
    const y = 90 + rnd() * (MAP_H - 180);
    const zt = TABLE[zoneAt(x, y)];
    if (!zt || rnd() * 1.4 > zt.d) continue;
    let tot = 0;
    for (const r of zt.t) tot += r[2];
    let pickR = rnd() * tot;
    let row = zt.t[0];
    for (const r of zt.t) {
      pickR -= r[2];
      if (pickR <= 0) {
        row = r;
        break;
      }
    }
    if (put(x, y, row[0], row[1])) placed++;
  }
  return out;
}
fillScatter();

/** Re-derive shrine, paving and scatter after the map (OBSTACLES) is regenerated; drops sprite caches. */
export function refreshProps() {
  SHRINE_I = findShrine();
  obsCache.clear();
  scatterCache.clear();
  fillPaved();
  fillScatter();
}

const scatterCache = new Map<number, Sprite>();
export function scatterSprite(idx: number): Sprite {
  const sc = SCATTER[idx];
  const ck = sc.seed * 8 + ["grave", "bones", "shrub", "stones"].indexOf(sc.kind); // sprite depends only on kind + seed
  let s = scatterCache.get(ck);
  if (s) return s;
  const rnd = mulberry32(sc.seed * 613 + sc.kind.length * 97);
  const W = Math.ceil(48 * ART);
  const H = Math.ceil(48 * ART);
  const ax = Math.floor(W / 2);
  const ay = Math.ceil(36 * ART);
  const buf = new PixBuf(W, H);
  if (sc.kind === "grave") {
    const tilt = (rnd() - 0.5) * 0.25;
    const h = 11 + rnd() * 6;
    const ang = Math.PI / 4 + (rnd() - 0.5) * 0.3;
    // Earth mound in front, headstone with a rounded top behind it
    const mound = rock(4, 4, 8, 2.5, sc.seed + 500, DIRT);
    mound.lichen = false;
    const stone = box(-2, -2, ang, 9, 3.5, (u) => h - (Math.abs(u) > 3 ? 2 : 0) - (Math.abs(u) > 4 ? 2 : 0) + tilt * u * 3, sc.seed + 700, RUIN);
    stone.brick = false;
    splat(buf, [mound, stone], ax, ay, 14);
    if (rnd() < 0.5) {
      // Carved notch
      buf.set(ax - 2, ay - Math.round(h) + 3, RUIN[0]);
      buf.set(ax - 2, ay - Math.round(h) + 4, RUIN[0]);
    }
    buf.outline(0.4);
  } else if (sc.kind === "stones") {
    const solids = [rock(0, 0, 5 + rnd() * 3, 3 + rnd() * 2, sc.seed + 900)];
    if (rnd() < 0.6) solids.push(rock(6, -3, 3 + rnd() * 2, 2 + rnd(), sc.seed + 901));
    splat(buf, solids, ax, ay, 14);
    buf.outline(0.4);
  } else {
    const P: Part[] = [];
    if (sc.kind === "bones") {
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const a = rnd() * 6.283;
        const c = v((rnd() - 0.5) * 8, (rnd() - 0.5) * 8, 0.8 + k * 0.4);
        const l = 3 + rnd() * 3;
        P.push({ kind: "cap", a: add(c, v(Math.cos(a) * -l, Math.sin(a) * -l, 0)), b: add(c, v(Math.cos(a) * l, Math.sin(a) * l, 0.3)), r: 0.75, ramp: BONE });
      }
      if (rnd() < 0.7) {
        const c = v((rnd() - 0.5) * 4, (rnd() - 0.5) * 4, 2.2);
        P.push({ kind: "sph", a: c, r: 2.4, ramp: BONE });
        P.push({ kind: "dot", a: add(c, v(2, -0.8, 0.3)), ref: c, r: 1, ramp: BONE, color: rgba("#0e0b09"), depthBias: 1 });
        P.push({ kind: "dot", a: add(c, v(2, 0.8, 0.3)), ref: c, r: 1, ramp: BONE, color: rgba("#0e0b09"), depthBias: 1 });
      }
    } else {
      // Dead shrub: a tangle of thin twigs
      const n = 5 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const a = rnd() * 6.283;
        const up = 0.6 + rnd() * 0.8;
        const l = 5 + rnd() * 6;
        const mid = v(Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.5, up * l * 0.5);
        P.push({ kind: "cap", a: v(0, 0, 0), b: mid, r: 0.6, ramp: WOOD });
        P.push({ kind: "cap", a: mid, b: add(mid, v(Math.cos(a + 0.6) * l * 0.4, Math.sin(a + 0.6) * l * 0.4, up * l * 0.5)), r: 0.45, ramp: WOOD });
      }
    }
    rasterize(P, projector(rnd() * 6.283, ART, ax, ay), ART, buf);
  }
  s = sprite(buf, ax, ay);
  scatterCache.set(ck, s);
  return s;
}

// ---- camp dressing --------------------------------------------------------------------------
const stakeCache = new Map<number, Sprite>();
/** A cluster of three sharpened stakes leaning outward (`out` = outward world angle). */
export function stakeSprite(seed: number, outDir: number): Sprite {
  const key = seed * 16 + outDir;
  let s = stakeCache.get(key);
  if (s) return s;
  const rnd = mulberry32(seed * 7 + outDir * 131);
  const P: Part[] = [];
  const TIP = ramp("#4a4136", "#7a6d5b", "#a39478", "#c4b496");
  for (let k = -1; k <= 1; k++) {
    const base = v(rnd() * 2, k * 4.5 + (rnd() - 0.5), 0);
    const len = 15 + rnd() * 6;
    const dir = norm(v(0.55 + rnd() * 0.2, (rnd() - 0.5) * 0.2, 1));
    const top = add(base, mul(dir, len));
    P.push({ kind: "cap", a: base, b: top, r: 1.3, ramp: WOOD });
    P.push({ kind: "cap", a: top, b: add(top, mul(dir, 3.2)), r: 0.6, ramp: TIP });
  }
  // Rope binding
  P.push({ kind: "cap", a: v(3, -5, 7), b: v(3, 5, 7.2), r: 0.5, ramp: ramp("#1a140e", "#2e251a", "#463a2a", "#5c4d38") });
  const SW = Math.ceil(44 * ART);
  const sax = Math.floor(SW / 2);
  const say = Math.ceil(32 * ART);
  const buf = new PixBuf(SW, SW);
  rasterize(P, projector((outDir / 8) * Math.PI * 2, ART, sax, say), ART, buf);
  s = sprite(buf, sax, say);
  stakeCache.set(key, s);
  return s;
}

const brazierCache = new Map<number, Sprite>();
/** Iron fire bowl on a tripod with an animated flame (4 frames). */
export function brazierSprite(frame: number): Sprite {
  let s = brazierCache.get(frame);
  if (s) return s;
  const P: Part[] = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4;
    P.push({ kind: "cap", a: v(Math.cos(a) * 5, Math.sin(a) * 5, 0), b: v(Math.cos(a) * 2, Math.sin(a) * 2, 11), r: 0.8, ramp: IRON });
  }
  P.push({ kind: "sph", a: v(0, 0, 13), r: 5, ramp: IRON, ry: 0.55 });
  const buf = new PixBuf(Math.ceil(32 * ART), Math.ceil(52 * ART));
  const ax = Math.floor(16 * ART);
  const ay = Math.ceil(46 * ART);
  rasterize(P, projector(0.3, ART, ax, ay), ART, buf);
  // Coals
  const coal = [rgba("#5a1608"), rgba("#a8320c"), rgba("#ff7a1a")];
  const top = ay - Math.round(15 * ART * 0.8);
  for (let x = -6; x <= 6; x++) buf.set(ax + x, top, coal[(x + frame + 9) % 3]);
  // Flame: tapered noisy columns, white-yellow core, orange, red tips
  const FL = [rgba("#fff3c0"), rgba("#ffd25a"), rgba("#ff9a2a"), rgba("#e0501a"), rgba("#8a2410")];
  for (let x = -6; x <= 6; x++) {
    const h = Math.max(2, Math.round((20 - Math.abs(x) * 2.7) * (0.65 + 0.35 * hash2(x, frame, 77)) + (frame % 2 ? 1 : 0)));
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const edge = Math.abs(x) >= 4 || t > 0.8;
      const c = edge ? (t > 0.7 ? FL[4] : FL[3]) : t < 0.35 && Math.abs(x) <= 1 ? FL[0] : t < 0.6 ? FL[1] : FL[2];
      buf.set(ax + x + (t > 0.6 ? (frame % 2 ? 1 : -1) * (x > 0 ? 1 : 0) : 0), top - 1 - y, c);
    }
  }
  if (frame % 2 === 0) buf.set(ax + 1, top - 24, FL[3]);
  else buf.set(ax - 2, top - 22, FL[4]);
  s = sprite(buf, ax, ay);
  brazierCache.set(frame, s);
  return s;
}
