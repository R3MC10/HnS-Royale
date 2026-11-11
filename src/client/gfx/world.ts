// World art: the ground (built lazily in CHUNK-px tiles around the view), the ruined wall along
// the back edges and the cliff along the front edges, pixel boulders for the obstacles, and camp
// decor (dead-grass patch + totem).
import { MAP_H, MAP_W } from "../../shared/constants";
import { cellKindAt, currentBiome, OPEN, WATER, type Obstacle } from "../../shared/map";
import { ART, isoX, isoY, K, SQ, unproject } from "./iso";
import { PAVED, refreshProps } from "./props";
import { hash2, mixColor, mulberry32, PixBuf, ramp, rgba, scaleColor, type Sprite, sprite, vnoise } from "./pixel";
import { projector, rasterize, v, type Part } from "./rig";

/** Ground pixel space: projected world origin (0,0) is chunk pixel (0,0); per-pixel hashes use
 * (ix + GROUND_OX, iy + GROUND_OY) so the look matches the old single-canvas ground. */
const WALL_MAX = 44 * 1.35;
const CLIFF = 90;
const GROUND_OX = 10;
const GROUND_OY = Math.ceil(WALL_MAX + 12);
export const VOID = "#07070a";
/** Ground chunk size in low-res px. Chunks are built on demand around the view, so build and
 * draw cost follow the screen, not the map size. */
export const CHUNK = 128;
/** Placeholder colour for chunks that are not built yet. */
export const GROUND_FILL = "#26281e";

let mapW = MAP_W;
let mapH = MAP_H;
let GW = mapW * K; // ground rectangle size in px
let GH = mapH * K * SQ;

// Desaturated, earthy: sick olive-grey grass, mud browns, cold grey flagstones.
const GRASS = ["#1b1c16", "#22241b", "#292b20", "#303225", "#38392a", "#42422f"].map((c) => rgba(c));
const DIRT = ["#1f1813", "#271f18", "#30261d", "#392d22", "#433528"].map((c) => rgba(c));
const MUD = rgba("#17120e");
const FLAG = ["#1c1b1f", "#26242a", "#2f2d33", "#38353c", "#423f46"].map((c) => rgba(c));
const FLAG_GAP = rgba("#121014");

// ---- biome hooks (world agent): blocked map cells (forest / cliff mass, water) and the biome tint ----
const BASE_GRASS = [...GRASS];
const BASE_DIRT = [...DIRT];
let WALL_FILL: number[] = [];
let WATER_FILL: number[] = [];
/** Re-tint the ground ramps and rebuild the wall / water fills for the current biome. */
function applyBiome() {
  const b = currentBiome();
  const [tr, tg, tb] = b.palette.tint;
  const tint = (c: number) => {
    const r = Math.min(255, Math.round((c & 255) * tr));
    const g = Math.min(255, Math.round(((c >>> 8) & 255) * tg));
    const bl = Math.min(255, Math.round(((c >>> 16) & 255) * tb));
    return ((c & 0xff000000) | (bl << 16) | (g << 8) | r) >>> 0;
  };
  BASE_GRASS.forEach((c, i) => (GRASS[i] = tint(c)));
  BASE_DIRT.forEach((c, i) => (DIRT[i] = tint(c)));
  const wall = rgba(b.palette.wall);
  const edge = rgba(b.palette.wallEdge);
  WALL_FILL = [0, 0.25, 0.5, 0.75].map((t) => mixColor(wall, edge, t));
  const water = rgba(b.palette.water);
  WATER_FILL = [0.8, 0.9, 1, 1.15, 1.35].map((f) => scaleColor(water, f));
}
applyBiome();
/** O(1) per pixel: colour for a blocked map cell, or 0 for open ground. */
function blockedColor(x: number, y: number, px: number, py: number): number {
  const k = cellKindAt(x, y);
  if (k === OPEN) return 0;
  if (k === WATER) {
    const n = vnoise(x / 70, y / 50, 21) * 0.7 + hash2(px, py, 23) * 0.3;
    return WATER_FILL[Math.min(4, Math.floor(n * 5))];
  }
  const n = vnoise(x / 40, y / 40, 22) * 0.75 + hash2(px, py, 24) * 0.25;
  return WALL_FILL[Math.min(3, Math.floor(n * 4))];
}

const chunkCache = new Map<string, HTMLCanvasElement | null>();
// Kept small on purpose: do NOT raise this. Every chunk is its own 256 px canvas (256 KB) and the
// painted ground keeps a second one per chunk (sprites2d/ground.ts MAX). Measured in Chrome: with
// 700 here, a roam over ~8 places left ~800 chunk canvases (200 MB) alive and every frame went from
// 8 ms to 40-60 ms and stayed there for the rest of the match (GPU canvas budget overrun; the time
// shows up inside drawImage). A screen shows about 35 chunks, so 260 is still several screens each way.
const CHUNK_CACHE_MAX = 260;

/** Change the arena size (e.g. a bigger procedural map); drops cached chunks and the paving index. */
export function setGroundSize(w: number, h: number) {
  if (w === mapW && h === mapH) return;
  mapW = w;
  mapH = h;
  GW = w * K;
  GH = h * K * SQ;
  chunkCache.clear();
  pavedGrid = null;
}

/** Drop every cached chunk (e.g. when obstacle / paving data changes). */
/** sprites2d hook: when on, open ground is left transparent so the painted ground tiles show through. */
let groundHoles = false;
const VOID_PX = rgba(VOID);
export function setGroundHoles(on: boolean) {
  if (on === groundHoles) return;
  groundHoles = on;
  chunkCache.clear();
}

export function resetGround() {
  applyBiome();
  wallRamps();
  refreshProps();
  chunkCache.clear();
  pavedGrid = null;
}

/** Chunk index range covering the projected map diamond (screen units). */
export function groundChunkRange() {
  return {
    cx0: Math.floor(isoX(0, mapH) / CHUNK) - 1,
    cx1: Math.floor(isoX(mapW, 0) / CHUNK) + 1,
    cy0: -1,
    cy1: Math.floor(isoY(mapW, mapH) / CHUNK) + 1,
  };
}

// ---- raised wall masses ----------------------------------------------------------------
/** Screen-unit height of wall masses (forest canopy / cliff tops) above the ground. */
const WALL_H = 30;
const isWall = (x: number, y: number) => cellKindAt(x, y) === 1;
let WALL_TOP: number[] = [];
let WALL_RIM = 0;
let FACE_L: number[] = [];
let FACE_R: number[] = [];
function wallRamps() {
  const b = currentBiome();
  const wall = rgba(b.palette.wall);
  const edge = rgba(b.palette.wallEdge);
  WALL_TOP = [0.75, 0.9, 1, 1.12, 1.25].map((f) => scaleColor(mixColor(wall, edge, 0.35), f));
  WALL_RIM = scaleColor(edge, 1.45);
  FACE_L = [0.45, 0.55, 0.65, 0.75].map((f) => scaleColor(edge, f));
  FACE_R = [0.25, 0.32, 0.4, 0.48].map((f) => scaleColor(edge, f));
}

/** Alpha of the last raisedWall() colour (255 unless the painted ground shows through). */
let wallA = 255;
/** Screen offsets (toward and away from the camera) sampled to feather the wall top's border. */
const FEATHER = [-22, -9, 9, 22];
/** Wall-top alpha by how many FEATHER samples are still wall (0 = right at the border). */
const TOP_A = [110, 160, 200, 225, 238];
/** isWall at a screen point (unproject inlined: no allocation in the per-pixel loop). */
const UX = 1 / (Math.SQRT1_2 * K);
const UY = 1 / (Math.SQRT1_2 * K * SQ);
function isWallS(sx: number, sy: number) {
  const a = sx * UX;
  const b = sy * UY;
  return isWall((a + b) / 2, (b - a) / 2);
}
/** Smooth screen-space warp of the wall test: the 64-unit cell staircase becomes a ragged, organic edge. */
function warpX(sx: number, sy: number) {
  return (vnoise(sx / 70, sy / 70, 71) - 0.5) * 44 + (vnoise(sx / 19, sy / 19, 72) - 0.5) * 12;
}
function warpY(sx: number, sy: number) {
  return (vnoise(sx / 70, sy / 70, 73) - 0.5) * 28 + (vnoise(sx / 19, sy / 19, 74) - 0.5) * 8;
}

/**
 * Colour of a raised wall pixel at screen point (sx, sy), or 0 when the pixel shows ground.
 * Walls are extruded WALL_H up: the top is the wall cell shifted up; faces fill the drop toward
 * the open ground in front (south-west faces lit, south-east faces in shadow).
 */
function raisedWall(sx: number, sy: number, px: number, py: number): number {
  wallA = 255;
  const t = unproject(sx, sy + WALL_H);
  if (isWall(t.x, t.y)) {
    const n = vnoise(t.x / 46, t.y / 46, 61) * 0.6 + vnoise(t.x / 13, t.y / 13, 62) * 0.3 + hash2(px, py, 63) * 0.1;
    if (groundHoles) {
      // Painted ground on: the top is a translucent shade over the painted forest floor (no flat slab),
      // feathered toward its border so it ends in a soft edge instead of a hard rim line.
      let depth = 0;
      for (const o of FEATHER) if (isWallS(sx, sy + WALL_H + o)) depth++;
      wallA = TOP_A[depth] - Math.floor(hash2(px, py, 66) * 14);
      return WALL_TOP[Math.min(4, Math.floor(n * 5))];
    }
    // Top: noisy canopy / rock; bright rim where the top ends toward the camera.
    const r = unproject(sx, sy + WALL_H + 2.2);
    if (!isWall(r.x, r.y)) return WALL_RIM;
    return WALL_TOP[Math.min(4, Math.floor(n * 5))];
  }
  // Quick reject: nothing solid anywhere in the column.
  const g = unproject(sx, sy);
  const mid = unproject(sx, sy + WALL_H * 0.5);
  if (!isWall(g.x, g.y) && !isWall(mid.x, mid.y) && cellKindAt(g.x + 64, g.y + 64) !== 1 && cellKindAt(g.x + 32, g.y + 32) !== 1) return 0;
  for (let z = WALL_H - 1.5; z >= 0; z -= 1.5) {
    const qa = sx * UX;
    const qb = (sy + z) * UY;
    const qx = (qa + qb) / 2; // unproject inlined (no allocation per step)
    const qy = (qb - qa) / 2;
    if (!isWall(qx, qy)) continue;
    // Which face: the open neighbour toward the camera decides (+x: south-east face, +y: south-west face).
    const openX = !isWall(qx + 20, qy);
    const openY = !isWall(qx, qy + 20);
    const k = z / WALL_H; // 0 at the foot, 1 at the top
    const strata = Math.floor((z + vnoise(sx / 14, 0, 64) * 5) / 5);
    const i = Math.max(0, Math.min(3, Math.floor(k * 3.2 + (hash2(strata, Math.floor(sx / 7), 65) > 0.7 ? 1 : 0))));
    // Painted ground on: faces are a translucent shadow band (fading out toward the foot), not black notches.
    if (groundHoles) wallA = Math.round(120 + 80 * k);
    return openY && !openX ? FACE_L[i] : FACE_R[i];
  }
  return 0;
}

const WARP_STEP = 4;
/** Warp grid side: covers the chunk's N = CHUNK + 2 * PAD samples (+1 for the far edge, +1 spare). */
const WG = Math.ceil((CHUNK + 4) / WARP_STEP) + 2;
const warpGX = new Float32Array(WG * WG);
const warpGY = new Float32Array(WG * WG);
/** Ground chunk canvas px per screen unit (smooth: finer than the old 1:1 pixel ground). */
export const GROUND_D = 2;
const PAD = 2;

/** Cached chunk; undefined = not built yet, null = nothing to draw there. */
export function cachedChunk(cx: number, cy: number): HTMLCanvasElement | null | undefined {
  const key = cx + "," + cy;
  const c = chunkCache.get(key);
  if (c !== undefined) {
    // LRU touch
    chunkCache.delete(key);
    chunkCache.set(key, c);
  }
  return c;
}

/**
 * Build (and cache) one ground chunk: CHUNK x CHUNK screen units, canvas (CHUNK * GROUND_D) px.
 * Draw it at (offX + cx * CHUNK, offY + cy * CHUNK) with size CHUNK x CHUNK. Outside the map is void
 * (the ragged wall-cell border is the map edge; no rectangle wall / cliff art any more).
 */
export function buildChunk(cx: number, cy: number): HTMLCanvasElement | null {
  const key = cx + "," + cy;
  const r = groundChunkRange();
  if (cx < r.cx0 || cx > r.cx1 || cy < r.cy0 || cy > r.cy1) {
    chunkCache.set(key, null);
    return null;
  }
  const D = GROUND_D;
  // Colours are sampled at 1 per unit (cheap), then upscaled smoothly with a soft blur.
  const N = CHUNK + PAD * 2;
  const buf = new PixBuf(N, N);
  const d = buf.data;
  const ix0 = cx * CHUNK;
  const iy0 = cy * CHUNK;
  let any = false;
  if (groundHoles)
    for (let j = 0; j < WG; j++)
      for (let i = 0; i < WG; i++) {
        const sx = ix0 + (i * WARP_STEP - PAD + 0.5);
        const sy = iy0 + (j * WARP_STEP - PAD + 0.5);
        warpGX[j * WG + i] = warpX(sx, sy);
        warpGY[j * WG + i] = warpY(sx, sy);
      }
  for (let j = 0; j < N; j++) {
    const sy = iy0 + (j - PAD + 0.5);
    const py = Math.floor(sy) + GROUND_OY;
    for (let i = 0; i < N; i++) {
      const sx = ix0 + (i - PAD + 0.5);
      const px = Math.floor(sx) + GROUND_OX;
      // With the painted ground, the wall / water test is warped so cell borders do not show as stairs.
      let wx = sx;
      let wy = sy;
      if (groundHoles) {
        // bilinear from the per-chunk warp grid (the warp is smooth; 4-unit steps are plenty)
        const gi = i / WARP_STEP;
        const gj = j / WARP_STEP;
        const i0 = Math.floor(gi);
        const j0 = Math.floor(gj);
        const fx = gi - i0;
        const fy = gj - j0;
        const k0 = j0 * WG + i0;
        const k1 = k0 + WG;
        wx += (warpGX[k0] * (1 - fx) + warpGX[k0 + 1] * fx) * (1 - fy) + (warpGX[k1] * (1 - fx) + warpGX[k1 + 1] * fx) * fy;
        wy += (warpGY[k0] * (1 - fx) + warpGY[k0 + 1] * fx) * (1 - fy) + (warpGY[k1] * (1 - fx) + warpGY[k1 + 1] * fx) * fy;
      }
      let c = raisedWall(wx, wy, px, py);
      if (c !== 0 && wallA < 255) c = ((c & 0x00ffffff) | (Math.max(0, wallA) << 24)) >>> 0;
      if (c === 0) {
        const { x, y } = unproject(wx, wy);
        if (x < 0 || y < 0 || x >= mapW || y >= mapH) {
          if (groundHoles) d[j * N + i] = VOID_PX; // sprites2d: keep the void opaque over painted ground
          continue;
        }
        if (groundHoles) {
          const f = unproject(sx, sy); // paving stays on the straight grid
          c = blockedColor(x, y, px, py) || (flagstone(f.x, f.y, px, py) ?? 0); // open ground stays transparent
          any = true;
        } else c = groundColor(x, y, px, py);
      }
      if (c) {
        d[j * N + i] = c;
        any = true;
      }
    }
  }
  if (!any) {
    chunkCache.set(key, null);
    return null;
  }
  // Soften the per-pixel grain into a painterly ground, then paint vector decor on top.
  const src = buf.toCanvas();
  const cv = document.createElement("canvas");
  cv.width = CHUNK * D;
  cv.height = CHUNK * D;
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.filter = "blur(1.1px)";
  g.drawImage(src, -PAD * D, -PAD * D, N * D, N * D);
  g.filter = "none";
  if (!groundHoles) paintDecor(g, ix0, iy0); // procedural specks (tufts / stones / bones) only without the painted tiles
  chunkCache.set(key, cv);
  while (chunkCache.size > CHUNK_CACHE_MAX) chunkCache.delete(chunkCache.keys().next().value!);
  return cv;
}

/** Ruins / shrine paving bucketed into 256-unit cells so the per-pixel lookup stays cheap on big maps. */
const PAVE_CELL = 256;
let pavedGrid: Map<number, (typeof PAVED)[number][]> | null = null;
function pavedNear(x: number, y: number) {
  if (!pavedGrid) {
    pavedGrid = new Map();
    for (const e of PAVED) {
      const R = e.o.r * 2.3;
      for (let gx = Math.floor((e.o.x - R) / PAVE_CELL); gx <= Math.floor((e.o.x + R) / PAVE_CELL); gx++) {
        for (let gy = Math.floor((e.o.y - R) / PAVE_CELL); gy <= Math.floor((e.o.y + R) / PAVE_CELL); gy++) {
          const k = gx * 65536 + gy;
          let l = pavedGrid.get(k);
          if (!l) pavedGrid.set(k, (l = []));
          l.push(e);
        }
      }
    }
  }
  return pavedGrid.get(Math.floor(x / PAVE_CELL) * 65536 + Math.floor(y / PAVE_CELL));
}

/** Cracked flagstones around ruins and the shrine; null where the paving has worn away. */
function flagstone(x: number, y: number, px: number, py: number): number | null {
  const near = pavedNear(x, y);
  if (!near) return null;
  for (const { o } of near) {
    const dx = x - o.x;
    const dy = y - o.y;
    const d = Math.hypot(dx, dy) / o.r;
    const edge = 1.55 + vnoise(x / 30, y / 30, 94) * 0.7;
    if (d > edge) continue;
    if (d > edge - 0.35 && hash2(Math.floor(x / 22), Math.floor(y / 22), 95) > (edge - d) / 0.35) return null; // broken edge
    const tx = Math.floor(x / 22 + (Math.floor(y / 22) & 1) * 0.5);
    const ty = Math.floor(y / 22);
    const gx = x / 22 + (ty & 1) * 0.5 - tx;
    const gy = y / 22 - ty;
    if (hash2(tx, ty, 96) < 0.12) return null; // missing stone
    if (gx < 0.07 || gy < 0.07) return FLAG_GAP;
    let i = 1 + Math.floor(hash2(tx, ty, 97) * 3) + (hash2(px, py, 98) > 0.8 ? 1 : 0) - (gx > 0.9 || gy > 0.9 ? 1 : 0);
    if (Math.abs(vnoise(x / 9 + tx, y / 9, 99) - 0.5) < 0.03) i = 0; // crack
    if (vnoise(x / 14, y / 14, 100) > 0.7 && hash2(px, py, 101) > 0.4) return GRASS[1]; // weeds
    return FLAG[Math.max(0, Math.min(4, i))];
  }
  return null;
}

function groundColor(x: number, y: number, px: number, py: number): number {
  const bc = blockedColor(x, y, px, py);
  if (bc) return bc;
  const fl = flagstone(x, y, px, py);
  if (fl !== null) return fl;
  const big = vnoise(x / 260, y / 260, 11);
  const patch = vnoise(x / 90, y / 90, 3) * 0.6 + vnoise(x / 34, y / 34, 4) * 0.4;
  const fine = hash2(px, py, 9);
  const dirt = patch + big * 0.35 - 0.62;
  if (dirt > 0.02) {
    if (dirt > 0.22 && vnoise(x / 20, y / 20, 5) > 0.72) return MUD;
    const i = Math.min(DIRT.length - 1, Math.max(0, Math.floor(1.5 + vnoise(x / 16, y / 16, 6) * 3 + (fine - 0.5) * 1.6)));
    // Ragged dirt edge
    if (dirt < 0.06 && fine > 0.5) return GRASS[2];
    return DIRT[i];
  }
  // Tile shading (64-unit diamond tiles), then grain.
  const tx = Math.floor(x / 64);
  const ty = Math.floor(y / 64);
  const tile = hash2(tx, ty, 2);
  let v0 = 1.9 + big * 1.6 + (tile - 0.5) * 0.9 + (fine - 0.5) * 1.5 + vnoise(x / 22, y / 22, 8) * 0.9;
  const gx = x - tx * 64;
  const gy = y - ty * 64;
  if (gx < 1.6 || gy < 1.6) v0 -= 0.9; // faint seams
  else if (gx < 3.5 || gy < 3.5) v0 += 0.25;
  const i = Math.min(GRASS.length - 1, Math.max(0, Math.floor(v0)));
  return GRASS[i];
}

function wallHeight(sx: number): number {
  // Ruined: stepped segments of varying height, a few gaps.
  const seg = Math.floor((sx + 2000) / 22);
  const h = hash2(seg, 1, 31);
  if (h < 0.08) return 6;
  return 16 + Math.floor(h * 6) * 4 + (hash2(Math.floor((sx + 2000) / 5), 2, 32) > 0.7 ? 2 : 0);
}

const STONE = ["#1a1a20", "#2a2a32", "#3a3a44", "#4b4b57", "#5d5d6a"].map((c) => rgba(c));
const MORTAR = rgba("#121216");

function wallColor(sx: number, dd: number, hgt: number, px: number, py: number): number {
  const leftFace = sx < 0;
  // Top cap row
  if (dd > hgt - 2.5) return leftFace ? STONE[4] : STONE[3];
  const row = Math.floor(dd / 5);
  const u = Math.abs(sx) + (row & 1) * 5;
  const inRow = dd - row * 5;
  const brick = Math.floor(u / 10);
  if (inRow < 1 || u - brick * 10 < 1) return MORTAR;
  const shade = (leftFace ? 2 : 1) + (hash2(brick, row, 40) > 0.75 ? 1 : 0) - (hash2(brick, row, 41) > 0.85 ? 1 : 0);
  let c = STONE[Math.max(0, Math.min(4, shade))];
  if (inRow > 3.6 && hash2(px, py, 42) > 0.3) c = scaleColor(c, 0.82);
  // Moss creeping up from the base
  if (dd < 7 && vnoise(sx / 6, dd / 3, 43) > 0.55) c = mixColor(c, rgba("#2d3d22"), 0.75);
  // Ivy / grime streaks
  if (vnoise(sx / 3, 0, 44) > 0.82 && dd < hgt * 0.8) c = scaleColor(c, 0.7);
  return c;
}

const ROCKF = ["#0f0e10", "#18161a", "#221f22", "#2c282a", "#373133"].map((c) => rgba(c));

function cliffColor(sx: number, dd: number, depth: number, px: number, py: number): number {
  const leftFace = sx < 0;
  const t = dd / depth;
  const strata = Math.floor((dd + vnoise(sx / 18, 0, 50) * 6) / 6);
  let i = (leftFace ? 3 : 2) - Math.floor(t * 3) + (hash2(strata, Math.floor(sx / 12), 51) > 0.6 ? 1 : 0);
  if (((dd + vnoise(sx / 18, 0, 50) * 6) % 6) < 1) i -= 1;
  if (hash2(px, py, 52) > 0.85) i -= 1;
  i = Math.max(0, Math.min(4, i));
  // Hanging roots near the top
  if (dd < 10 && vnoise(sx / 2.2, 0, 53) > 0.75 && dd < vnoise(sx / 5, 1, 54) * 14) return rgba("#2a2116");
  // Fade into the void at the bottom
  if (t > 0.75 && hash2(px, py, 55) < (t - 0.75) * 4) return rgba(VOID);
  return ROCKF[i];
}

/** Light lip of turf along the front edge, darker seams down the sides (clipped to one chunk). */
function edgeLip(buf: PixBuf, ix0: number, iy0: number) {
  const out = rgba("#3c3a2c");
  const side = rgba("#0d0c0e");
  const yb = Math.floor(GROUND_OY + GH) - GROUND_OY; // first row below the ground
  const xr = Math.floor(GW) - 1;
  const d = buf.data;
  for (let j = 0; j < CHUNK; j++) {
    const iy = iy0 + j;
    if (iy < 0 || iy >= yb) continue;
    for (let i = 0; i < CHUNK; i++) {
      const ix = ix0 + i;
      if (ix < 0 || ix > xr) continue;
      if (iy === yb - 1) d[j * CHUNK + i] = out;
      else if (ix === 0 || ix === xr) d[j * CHUNK + i] = side;
    }
  }
}

// ---- decor stamps -------------------------------------------------------------------
type Stamp = { rows: string[]; pal: Record<string, string> };
const STAMPS: Record<string, Stamp> = {
  tuft: { rows: [".a.a.", "a.ab.", ".bbb."], pal: { a: "#4a4a32", b: "#33352a" } },
  tuft2: { rows: ["a..a", ".ab.", ".bb."], pal: { a: "#565236", b: "#3a3a2a" } },
  flowerV: { rows: [".p.", "pyp", ".g."], pal: { p: "#4e4658", y: "#7d7450", g: "#2c3121" } },
  flowerR: { rows: ["r.", "g."], pal: { r: "#5e2222", g: "#2c3121" } },
  flowerY: { rows: [".y.", "y.y", ".g."], pal: { y: "#6c6640", g: "#2c3121" } },
  stone: { rows: [".hl.", "lmmd", ".dd."], pal: { h: "#8a8a92", l: "#6a6a72", m: "#4e4e56", d: "#2c2c32" } },
  stone2: { rows: [".hl", "lmd"], pal: { h: "#7d7b80", l: "#5f5d63", m: "#48464c", d: "#29282c" } },
  bone: { rows: ["b.....", ".bbbb.", ".....b"], pal: { b: "#bdb49a" } },
  skull: { rows: [".www.", "wkwkw", ".www.", "..w.."], pal: { w: "#c9c0a4", k: "#1a1612" } },
  ribs: { rows: [".b.b.b", "bbbbbb", ".b.b.b"], pal: { b: "#aaa188" } },
  mushroom: { rows: ["rrr", ".s."], pal: { r: "#6e3a52", s: "#b8ad92" } },
};

function stamp(buf: PixBuf, st: Stamp, x: number, y: number) {
  for (let j = 0; j < st.rows.length; j++) {
    const row = st.rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ".") continue;
      buf.set(x + i, y + j, rgba(st.pal[ch]));
    }
  }
}

/** One decor stamp per 30x30-unit world cell, hash-placed so each chunk can stamp independently. */
const DECOR_CELL = 30;
function decorAt(gx: number, gy: number): { st: Stamp; x: number; y: number } {
  const x = (gx + hash2(gx, gy, 4243)) * DECOR_CELL;
  const y = (gy + hash2(gx, gy, 4244)) * DECOR_CELL;
  const r = hash2(gx, gy, 4245);
  const q = hash2(gx, gy, 4246);
  let st: Stamp;
  if (r < 0.42) st = q < 0.5 ? STAMPS.tuft : STAMPS.tuft2;
  else if (r < 0.6) st = [STAMPS.flowerV, STAMPS.flowerR, STAMPS.flowerY][Math.min(2, Math.floor(q * 3))];
  else if (r < 0.8) st = q < 0.5 ? STAMPS.stone : STAMPS.stone2;
  else if (r < 0.92) st = STAMPS.bone;
  else if (r < 0.96) st = STAMPS.mushroom;
  else st = q < 0.6 ? STAMPS.skull : STAMPS.ribs;
  return { st, x, y };
}

/** Smooth decor (grass tufts, stones, bones, flowers) painted with paths onto a ground chunk. */
function paintDecor(g: CanvasRenderingContext2D, ix0: number, iy0: number) {
  const D = GROUND_D;
  const a = unproject(ix0, iy0 + CHUNK);
  const b = unproject(ix0 + CHUNK, iy0);
  const c0 = unproject(ix0, iy0);
  const c1 = unproject(ix0 + CHUNK, iy0 + CHUNK);
  const gx0 = Math.max(0, Math.floor(Math.min(a.x, c0.x) / DECOR_CELL) - 1);
  const gx1 = Math.min(Math.floor(mapW / DECOR_CELL), Math.floor(Math.max(b.x, c1.x) / DECOR_CELL) + 1);
  const gy0 = Math.max(0, Math.floor(Math.min(b.y, c0.y) / DECOR_CELL) - 1);
  const gy1 = Math.min(Math.floor(mapH / DECOR_CELL), Math.floor(Math.max(a.y, c1.y) / DECOR_CELL) + 1);
  g.lineCap = "round";
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      const { st, x, y } = decorAt(gx, gy);
      if (x >= mapW || y >= mapH || cellKindAt(x, y) !== OPEN) continue;
      const px = (isoX(x, y) - ix0) * D;
      const py = (isoY(x, y) - iy0) * D;
      if (px < -20 || py < -20 || px > CHUNK * D + 20 || py > CHUNK * D + 20) continue;
      const q = hash2(gx, gy, 4247);
      const s = D * (0.9 + q * 0.4);
      if (st === STAMPS.tuft || st === STAMPS.tuft2) {
        const col = st.pal.a;
        for (let k = 0; k < 5; k++) {
          const ang = -Math.PI / 2 + (k - 2) * 0.35 + (hash2(gx, gy, 4250 + k) - 0.5) * 0.3;
          const L = (2.6 + hash2(gx, gy, 4260 + k) * 2.4) * s;
          g.strokeStyle = k % 2 ? st.pal.b : col;
          g.lineWidth = 0.7 * s;
          g.beginPath();
          g.moveTo(px + (k - 2) * 0.6 * s, py);
          g.quadraticCurveTo(px + (k - 2) * 0.9 * s, py - L * 0.6, px + Math.cos(ang) * L, py + Math.sin(ang) * L);
          g.stroke();
        }
      } else if (st === STAMPS.stone || st === STAMPS.stone2) {
        const rx = (st === STAMPS.stone ? 2.4 : 1.8) * s;
        const gr = g.createRadialGradient(px - rx * 0.4, py - rx * 0.5, 0, px, py, rx * 1.2);
        gr.addColorStop(0, st.pal.h);
        gr.addColorStop(0.5, st.pal.m);
        gr.addColorStop(1, st.pal.d);
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.beginPath();
        g.ellipse(px + rx * 0.2, py + rx * 0.35, rx * 1.1, rx * 0.55, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(px, py, rx, rx * 0.7, q * 2, 0, Math.PI * 2);
        g.fill();
      } else if (st === STAMPS.bone || st === STAMPS.ribs) {
        g.strokeStyle = st.pal.b;
        g.lineWidth = 0.8 * s;
        const ang = q * Math.PI;
        g.beginPath();
        g.moveTo(px - Math.cos(ang) * 3 * s, py - Math.sin(ang) * 1.6 * s);
        g.lineTo(px + Math.cos(ang) * 3 * s, py + Math.sin(ang) * 1.6 * s);
        g.stroke();
        if (st === STAMPS.ribs)
          for (let k = -1; k <= 1; k++) {
            g.beginPath();
            g.arc(px + k * 1.6 * s, py, 1.4 * s, Math.PI * 1.1, Math.PI * 1.9);
            g.stroke();
          }
      } else if (st === STAMPS.skull) {
        g.fillStyle = st.pal.w;
        g.beginPath();
        g.ellipse(px, py, 2 * s, 1.6 * s, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = st.pal.k;
        g.beginPath();
        g.arc(px - 0.7 * s, py - 0.2 * s, 0.45 * s, 0, Math.PI * 2);
        g.arc(px + 0.7 * s, py - 0.2 * s, 0.45 * s, 0, Math.PI * 2);
        g.fill();
      } else {
        // flowers / mushrooms: a stem and a soft head
        const head = Object.values(st.pal)[0];
        g.strokeStyle = "#2c3121";
        g.lineWidth = 0.5 * s;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px, py - 2.5 * s);
        g.stroke();
        g.fillStyle = head;
        g.beginPath();
        g.arc(px, py - 2.8 * s, 1.1 * s, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

// ---- camps --------------------------------------------------------------------------
/** Dead-grass patch with scattered bones, drawn flat under a camp. */
export function buildCampPatch(seed: number): Sprite {
  const R0 = 150; // world radius
  const rx = Math.ceil(R0 * K);
  const W = rx * 2 + 4;
  const H = Math.ceil(R0 * K * SQ) * 2 + 4;
  const buf = new PixBuf(W, H);
  const ax = W / 2;
  const ay = H / 2;
  const dead = ["#272319", "#2f2a1e", "#373123", "#403828"].map((c) => rgba(c));
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const { x, y } = unproject(px + 0.5 - ax, py + 0.5 - ay);
      const d = Math.hypot(x, y) / R0;
      const edge = 0.75 + vnoise(x / 30 + seed, y / 30, 70) * 0.4;
      if (d > edge) continue;
      if (d > edge - 0.12 && hash2(px, py, 71) > 0.5) continue; // dithered fade
      const i = Math.max(0, Math.min(3, Math.floor(1 + vnoise(x / 12, y / 12, 72 + seed) * 2.4 + (hash2(px, py, 73) - 0.5))));
      buf.set(px, py, dead[i]);
    }
  }
  const rnd = mulberry32(seed * 977 + 13);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = rnd() * R0 * 0.65;
    const px = Math.round(ax + isoX(Math.cos(a) * rr, Math.sin(a) * rr));
    const py = Math.round(ay + isoY(Math.cos(a) * rr, Math.sin(a) * rr));
    const st = [STAMPS.bone, STAMPS.ribs, STAMPS.skull, STAMPS.bone, STAMPS.stone2][Math.floor(rnd() * 5)];
    stamp(buf, st, px, py);
  }
  return sprite(buf, Math.floor(ax), Math.floor(ay));
}

const T = {
  wood: ramp("#1d130b", "#352315", "#523621", "#6e4a2e"),
  bone: ramp("#5e5648", "#9b9078", "#cfc4a6", "#efe7cf"),
  rag: ramp("#2a0e0e", "#4a1616", "#6e2020", "#8c2e2a"),
  rope: ramp("#2a2216", "#43382a", "#5e503c", "#7a6a52"),
};

/** Camp totem: a stake with a crossbar, a skull and tattered rags. */
export function buildTotem(seed: number): Sprite {
  const P: Part[] = [];
  const cap = (a: [number, number, number], b: [number, number, number], r: number, rp: typeof T.wood): Part => ({ kind: "cap", a, b, r, ramp: rp });
  const lean = (hash2(seed, 3, 80) - 0.5) * 2;
  P.push(cap(v(0, 0, 0), v(lean, 0, 30), 1.6, T.wood));
  P.push(cap(v(lean * 0.8, -6, 24), v(lean * 0.8, 6, 25), 1.1, T.wood));
  P.push(cap(v(lean * 0.8 + 0.6, -6, 24), v(lean * 0.8 + 0.4, -7, 15), 1.2, T.rag));
  P.push(cap(v(lean * 0.8 + 0.6, 6, 25), v(lean * 0.8 + 0.8, 6.5, 18), 1.1, T.rag));
  P.push(cap(v(lean, 0, 21), v(lean, 0, 23), 1.9, T.rope));
  const hd = v(lean + 0.6, 0, 32);
  P.push({ kind: "sph", a: hd, r: 3.5, ramp: T.bone });
  P.push({ kind: "cap", a: v(lean + 2, -1.6, 30), b: v(lean + 2, 1.6, 30), r: 1.4, ramp: T.bone });
  for (const s of [-1.3, 1.3]) P.push({ kind: "dot", a: v(lean + 3.6, s, 32.3), ref: v(lean + 1.6, s, 32.3), r: 2, ramp: T.bone, color: rgba("#120d0a"), depthBias: 1 });
  // Horns
  P.push(cap(v(lean, -2.6, 34), v(lean - 2, -5.5, 38.5), 0.9, T.bone));
  P.push(cap(v(lean, 2.6, 34), v(lean - 2, 5.5, 38.5), 0.9, T.bone));
  // Stones at the base
  P.push({ kind: "sph", a: v(2.5, 2, 1), r: 2.2, ramp: ramp("#202025", "#33333a", "#4a4a52", "#64646d") });
  P.push({ kind: "sph", a: v(-2, -2.5, 1), r: 1.8, ramp: ramp("#202025", "#33333a", "#4a4a52", "#64646d") });
  const W = Math.ceil(40 * ART);
  const H = Math.ceil(56 * ART);
  const buf = new PixBuf(W, H);
  const ax = Math.floor(W / 2);
  const ay = H - Math.ceil(8 * ART);
  rasterize(P, projector(0.8 + seed, ART, ax, ay), ART, buf);
  return sprite(buf, ax, ay);
}

/** Shared soft drop shadow (ellipse, dithered) cached by radius. */
const shadowCache = new Map<number, Sprite>();
export function shadowSprite(rpx: number): Sprite {
  const r = Math.max(3, Math.round(rpx));
  let s = shadowCache.get(r);
  if (s) return s;
  // Soft contact shadow: smooth radial falloff, 4 canvas px per unit.
  const d = 4;
  const W = Math.ceil((r * 2 + 6) * d);
  const H = Math.ceil((r * 1.3 + 6) * d);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  g.setTransform(1, 0, 0, 0.6, 0, 0);
  const cx = W / 2;
  const cy = H / 2 / 0.6;
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, (r + 2) * d);
  gr.addColorStop(0, "rgba(0,0,0,0.55)");
  gr.addColorStop(0.45, "rgba(0,0,0,0.42)");
  gr.addColorStop(0.8, "rgba(0,0,0,0.14)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H / 0.6);
  s = { cv, ax: W / 2, ay: H / 2, d };
  shadowCache.set(r, s);
  return s;
}
