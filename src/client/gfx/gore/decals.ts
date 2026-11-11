// Persistent ground gore: decals are BAKED into chunked offscreen canvases in screen-unit space,
// so thousands of splats cost one drawImage per visible chunk layer per frame.
//
// Storage: the ground is cut into CH x CH (screen unit) locations. A location holds
//   - a few GENERATION layers (one per GEN_LEN seconds of gore): fresh blood is wet paint, it then
//     soaks into the ground (drawn partly multiplied, so the soil shows through) and darkens a
//     little while it dries: old blood is a dark RED, never black;
//   - one PERMANENT layer that every settled generation is folded into (body parts are baked
//     straight into it). With persistent blood (the default) it is NEVER dropped during a match.
// Memory (canvas backing store, 4 bytes / px) is bounded by BUDGET_BYTES instead of by throwing
// gore away: when the total goes over, the permanent layers that have been off screen the longest
// are halved in resolution (full -> 1/2 -> 1/4). At 1/4 the whole 20-player map fits the budget,
// so nothing is ever evicted; a normal match stays at full resolution (~800 locations).
// Every layer carries a PAD px gutter holding its neighbours' pixels and is drawn from the inner
// rectangle: bilinear filtering at a chunk edge then reads the right texels and no seam shows,
// whatever the resolution of the two neighbours.
// Without persistent blood a layer erodes and is removed after ~40 s. Per location the fresh
// stamp count and area are capped: far over the cap, new small stamps are dropped.
// Live (still spreading / bubbling) pools are drawn per frame and baked when they settle.
import { isoX, isoY, K, SQ } from "../iso";
import type { Cam } from "../view";
import { goreAmount, MATS, persistentBlood, type Mat } from "./core";
import { paintPool } from "./paint";

const C = Math.SQRT1_2;
/** Location size in screen units, and backing pixels per screen unit at full resolution. */
const CH = 128;
const RES = 1.25;
/** Gutter (px at full resolution) around the CH * RES px of a layer. */
const PAD = 4;
const SIZE0 = CH * RES + PAD * 2;
/** Resolution levels of a permanent layer: 0 = full, 1 = half, 2 = quarter. */
const MAX_LV = 2;
const bytesOf = (lv: number) => (SIZE0 >> lv) * (SIZE0 >> lv) * 4;
/** Hard cap on all gore canvases together (generation + permanent layers + the spare pool). */
const BUDGET_BYTES = 128 * 1024 * 1024;
/** Cap on generation (still drying) layers: over it the oldest one is settled early. */
const MAX_GENS = 320;
const MAX_SPARE = 24;
/** Generation of the permanent layer of a location (settled gore lives here for the whole match). */
const BASE = -1;
/** Age (s) at which a settled generation layer is folded into the permanent layer. */
const SETTLE = 36;
const MAX_QUEUE = 1600;
const BAKE_BUDGET = 140; // stamps per frame
/** Seconds of gore per generation layer. */
const GEN_LEN = 15;
/** Overall size of ground decals (splats and pools came out too big on screen). */
const DECAL_SCALE = 0.82;
/** Per location caps: stamps and estimated covered area (screen units^2). */
const LOC_N = 80;
const LOC_AREA = CH * CH * 0.5;
/** Ageing passes per layer (seconds between passes) and the darkening passes a layer gets in all. */
const AGE_EVERY = 2.5;
const DARK_PASSES = 10;
const DARK_A = 0.04;

export type Painter = (g: CanvasRenderingContext2D) => void;

interface Layer {
  cv: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  gen: number;
  lv: number; // resolution level (generation layers are always 0)
  born: number;
  used: number; // clock when last on screen / written
  n: number; // stamps baked
  area: number; // estimated covered area (screen units^2)
  agedAt: number;
  dark: number; // darkening passes applied
  loc: Loc;
}
interface Loc {
  cx: number;
  cy: number;
  base: Layer | null;
  gens: Layer[]; // oldest first
}

const locs = new Map<number, Loc>();
/** Generation layers (round-robin ageing) and permanent layers (budget scans). */
const genList: Layer[] = [];
const baseList: Layer[] = [];
const spare: HTMLCanvasElement[] = [];
let bytes = 0;
const lkey = (cx: number, cy: number) => (cx + 32768) * 65536 + (cy + 32768);
let clock = 0;

const life = () => (persistentBlood() ? 85 : 40);

interface Stamp {
  x: number;
  y: number;
  r: number;
  p: Painter;
  up: boolean; // upright (screen-space) painter instead of the ground plane
  solid: boolean; // a solid piece (body part): goes straight to the permanent layer, never darkened
}
const queue: Stamp[] = [];
let qHead = 0;

/** Ground affine for world-plane painters: world (dx, dy) around a point -> screen units. */
export function groundTransform(g: CanvasRenderingContext2D, sx: number, sy: number, scale = 1) {
  g.transform(C * K * scale, C * K * SQ * scale, -C * K * scale, C * K * SQ * scale, sx, sy);
}

function reset(g: CanvasRenderingContext2D) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

function release(cv: HTMLCanvasElement) {
  bytes -= cv.width * cv.height * 4;
  cv.width = cv.height = 0; // frees the backing store now
}
function newCanvas(lv: number): HTMLCanvasElement {
  let cv = lv === 0 ? spare.pop() : undefined;
  if (cv) {
    const g = cv.getContext("2d")!;
    reset(g);
    g.clearRect(0, 0, cv.width, cv.height);
    return cv; // (its bytes are already counted)
  }
  cv = document.createElement("canvas");
  cv.width = cv.height = SIZE0 >> lv;
  bytes += bytesOf(lv);
  return cv;
}
function freeCanvas(cv: HTMLCanvasElement) {
  if (cv.width === SIZE0 && spare.length < MAX_SPARE && bytes <= BUDGET_BYTES) spare.push(cv);
  else release(cv);
}

function locAt(cx: number, cy: number): Loc {
  const k = lkey(cx, cy);
  let l = locs.get(k);
  if (!l) locs.set(k, (l = { cx, cy, base: null, gens: [] }));
  return l;
}
function mkLayer(loc: Loc, gen: number, lv: number): Layer {
  const cv = newCanvas(lv);
  // Every layer of a generation is born (and so fades) at the same moment wherever it is, so a
  // stain lying across a chunk edge ages as one piece.
  return { cv, g: cv.getContext("2d")!, gen, lv, born: gen === BASE ? -1e6 : gen * GEN_LEN, used: clock, n: 0, area: 0, agedAt: clock, dark: 0, loc };
}

/** Swap a permanent layer's canvas for one at another resolution level (content resampled). */
function resample(b: Layer, lv: number) {
  const cv = newCanvas(lv);
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(b.cv, 0, 0, b.cv.width, b.cv.height, 0, 0, cv.width, cv.height);
  freeCanvas(b.cv);
  b.cv = cv;
  b.g = g;
  b.lv = lv;
}

/** The permanent layer of a location at full resolution, ready to be drawn into. */
function baseOf(loc: Loc): Layer {
  let b = loc.base;
  if (!b) {
    b = loc.base = mkLayer(loc, BASE, 0);
    baseList.push(b);
  } else if (b.lv > 0) resample(b, 0);
  b.used = clock;
  return b;
}

function dropGen(c: Layer, keepCanvas = false) {
  const i = genList.indexOf(c);
  if (i >= 0) genList.splice(i, 1);
  const j = c.loc.gens.indexOf(c);
  if (j >= 0) c.loc.gens.splice(j, 1);
  if (!keepCanvas) freeCanvas(c.cv);
  if (!keepCanvas && !c.loc.base && !c.loc.gens.length) locs.delete(lkey(c.loc.cx, c.loc.cy));
}

/** Fold a generation layer into its location's permanent layer (it stays for the match). */
function settle(c: Layer) {
  const g = c.g;
  reset(g);
  if (c.dark < DARK_PASSES) {
    // Finish drying first, so every layer ends equally dark whenever it was settled.
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(0,0,0,${1 - Math.pow(1 - DARK_A, DARK_PASSES - c.dark)})`;
    g.fillRect(0, 0, c.cv.width, c.cv.height);
    g.globalCompositeOperation = "source-over";
    c.dark = DARK_PASSES;
  }
  const loc = c.loc;
  if (!loc.base) {
    // first settled layer here: it becomes the permanent layer as it is
    dropGen(c, true);
    c.gen = BASE;
    c.born = -1e6;
    c.used = clock;
    loc.base = c;
    baseList.push(c);
    return;
  }
  const b = baseOf(loc);
  reset(b.g);
  b.g.drawImage(c.cv, 0, 0);
  dropGen(c);
}

function genLayer(loc: Loc, gen: number): Layer {
  for (const c of loc.gens) if (c.gen === gen) return c;
  if (genList.length >= MAX_GENS) {
    // Over the cap: the oldest drying layer goes early (settled, never thrown away).
    let old = genList[0];
    for (const c of genList) if (c.born < old.born || (c.born === old.born && c.used < old.used)) old = c;
    if (persistentBlood()) settle(old);
    else dropGen(old);
    locs.set(lkey(loc.cx, loc.cy), loc); // (dropGen may have removed this very location)
  }
  const c = mkLayer(loc, gen, 0);
  loc.gens.push(c);
  genList.push(c);
  return c;
}

/** Over the memory budget: halve the resolution of the permanent layers unseen the longest. */
function enforceBudget() {
  while (bytes > BUDGET_BYTES && spare.length) release(spare.pop()!);
  for (let k = 0; k < 4 && bytes > BUDGET_BYTES; k++) {
    let pick: Layer | null = null;
    for (const b of baseList) {
      if (b.lv >= MAX_LV || clock - b.used < 2) continue; // on screen (or just written): leave
      if (!pick || b.lv < pick.lv || (b.lv === pick.lv && b.used < pick.used)) pick = b;
    }
    if (!pick) return;
    resample(pick, pick.lv + 1);
  }
}

/**
 * Queue a persistent ground decal at world (x, y), bounding radius r (world units). `upright`
 * painters draw in screen units around the point (painted billboard gibs) instead of the ground plane.
 */
export function stamp(x: number, y: number, r: number, p: Painter, upright = false, solid = false) {
  if (goreAmount() <= 0) return;
  if (queue.length - qHead >= MAX_QUEUE) qHead++;
  queue.push({ x, y, r, p, up: upright, solid });
}

function bake(s: Stamp) {
  const ix = isoX(s.x, s.y);
  const iy = isoY(s.x, s.y);
  // rotated painters can extend either way: be generous (+ the gutter of the neighbouring layers)
  const e = s.r * K * DECAL_SCALE * 1.05 + 2 + PAD / RES;
  const cx0 = Math.floor((ix - e) / CH);
  const cx1 = Math.floor((ix + e) / CH);
  const cy0 = Math.floor((iy - e) / CH);
  const cy1 = Math.floor((iy + e) / CH);
  // Rough painted area (bounding radii are generous: ~half of it is actually painted).
  const rr = s.r * K * DECAL_SCALE * 0.45;
  const area = Math.PI * rr * rr * SQ;
  const gen = s.solid && persistentBlood() ? BASE : Math.floor(clock / GEN_LEN);
  // Screen budget: far over the cap where the stamp is centred, small stamps are dropped. The
  // decision is per stamp, never per chunk, and layers are never aged early: either would cut
  // stains off along the chunk edge (a whole chunk of fresh blood used to vanish mid-fight).
  if (s.r < 30 && !s.solid) {
    const l = locs.get(lkey(Math.floor(ix / CH), Math.floor(iy / CH)));
    if (l) {
      let n = 0;
      let a = 0;
      for (const c of l.gens) {
        n += c.n;
        a += c.area;
      }
      if (n > LOC_N * 3 || a > LOC_AREA * 3) return;
    }
  }
  for (let cx = cx0; cx <= cx1; cx++)
    for (let cy = cy0; cy <= cy1; cy++) {
      const loc = locAt(cx, cy);
      const c = gen === BASE ? baseOf(loc) : genLayer(loc, gen);
      const g = c.g;
      g.setTransform(RES, 0, 0, RES, PAD, PAD);
      if (s.up) g.translate(ix - cx * CH, iy - cy * CH);
      else groundTransform(g, ix - cx * CH, iy - cy * CH, DECAL_SCALE);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      s.p(g);
      if (gen !== BASE) {
        c.n++;
        c.area += area;
      }
    }
}

// ---- live pools ---------------------------------------------------------------------------------

interface Pool {
  on: boolean;
  x: number;
  y: number;
  R: number;
  t: number;
  grow: number;
  mat: Mat;
  seed: number;
  hold: number; // extra seconds to stay live (chaos bubbling)
}
const MAX_POOLS = 80;
const pools: Pool[] = Array.from({ length: MAX_POOLS }, () => ({ on: false, x: 0, y: 0, R: 0, t: 0, grow: 0, mat: 0, seed: 0, hold: 0 }));

/** A pool that spreads to radius R over `grow` seconds, then is baked into the ground. */
export function addPool(x: number, y: number, R: number, mat: Mat, grow = 4, hold = 0) {
  if (goreAmount() <= 0 || !MATS[mat].pools) return;
  let p = pools.find((q) => !q.on);
  if (!p) {
    // bake the oldest now
    p = pools.reduce((a, b) => (a.t > b.t ? a : b));
    finishPool(p);
  }
  p.on = true;
  p.x = x;
  p.y = y;
  p.R = R;
  p.t = 0;
  p.grow = grow;
  p.mat = mat;
  p.seed = (Math.random() * 1e9) | 0;
  p.hold = hold;
}

function finishPool(p: Pool) {
  p.on = false;
  const { R, mat, seed } = p;
  stamp(p.x, p.y, R * 1.6, (g) => paintPool(g, mat, R, seed, 1, 0, 0.95));
}

/** Chaos pools bubble while live. */
function drawBubbles(g: CanvasRenderingContext2D, p: Pool, time: number) {
  const r = p.R * 0.7;
  for (let i = 0; i < 7; i++) {
    const ph = (time * (0.6 + (i % 3) * 0.25) + i * 0.37) % 1;
    const a = i * 2.39 + p.seed;
    const d = r * (((i * 0.618) % 1) * 0.9);
    const bx = Math.cos(a) * d;
    const by = Math.sin(a) * d;
    const br = (0.6 + (i % 4) * 0.5) * (ph < 0.85 ? ph / 0.85 : 1);
    g.globalAlpha = ph < 0.85 ? 0.85 : (1 - ph) / 0.15;
    g.fillStyle = "#4a6a12";
    g.beginPath();
    g.arc(bx, by, br, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(220,255,140,0.6)";
    g.beginPath();
    g.arc(bx - br * 0.3, by - br * 0.3, br * 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

// ---- ageing -------------------------------------------------------------------------------------

/** Erosion noise tile: punches irregular holes so old stains break up (thin edges vanish first). */
let noiseCv: HTMLCanvasElement | null = null;
function noiseTile(): HTMLCanvasElement {
  if (noiseCv) return noiseCv;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(64, 64);
  for (let i = 0; i < 64 * 64; i++) {
    const v = Math.random();
    img.data[i * 4 + 3] = v > 0.55 ? Math.round((v - 0.55) * 2.2 * 255) : 0;
  }
  g.putImageData(img, 0, 0);
  noiseCv = cv;
  return cv;
}

/**
 * One ageing pass on a layer: darken a little while it dries (a few passes only, hue kept: old
 * blood stays a dark RED, it must never go brown / black), later erode.
 */
function ageLayer(c: Layer, age: number, L: number) {
  const g = c.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  if (age > 8 && c.dark < DARK_PASSES) {
    // darker and drier: thin black over the stain only (DARK_PASSES passes, about a third darker in all)
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(0,0,0,${DARK_A})`;
    g.fillRect(0, 0, c.cv.width, c.cv.height);
    c.dark++;
  }
  if (!persistentBlood() && age > L * 0.62) {
    // smaller / patchier: uniform thinning (faint edges disappear first) + noisy holes
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "rgba(0,0,0,0.06)";
    g.fillRect(0, 0, c.cv.width, c.cv.height);
    const pat = g.createPattern(noiseTile(), "repeat");
    if (pat) {
      pat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.random() * 64, Math.random() * 64]));
      g.globalAlpha = 0.35;
      g.fillStyle = pat;
      g.fillRect(0, 0, c.cv.width, c.cv.height);
      g.globalAlpha = 1;
    }
  }
  g.globalCompositeOperation = "source-over";
}

// ---- per frame ------------------------------------------------------------------------------------

let ageIdx = 0;
export function updateDecals(dt: number) {
  clock += dt;
  // Bake a budget of queued stamps.
  let n = 0;
  while (qHead < queue.length && n < BAKE_BUDGET) {
    bake(queue[qHead++]);
    n++;
  }
  if (qHead > 512 && qHead * 2 > queue.length) {
    queue.splice(0, qHead);
    qHead = 0;
  }
  for (const p of pools) {
    if (!p.on) continue;
    p.t += dt;
    if (p.t > p.grow + p.hold + 0.4) finishPool(p);
  }
  // Age a few drying layers per frame (round-robin); settle or drop the old ones.
  const L = life();
  const persist = persistentBlood();
  for (let k = 0; k < 4 && genList.length; k++) {
    const c = genList[ageIdx++ % genList.length];
    const age = clock - c.born;
    if (persist && age > SETTLE) {
      settle(c);
      continue;
    }
    if (age > L) {
      dropGen(c);
      continue;
    }
    if (clock - c.agedAt > AGE_EVERY) {
      ageLayer(c, age, L);
      c.agedAt = clock;
    }
  }
  if (bytes > BUDGET_BYTES) enforceBudget();
}

/** Ground layer: baked chunk layers (wet paint -> soaked / multiplied -> faded) + live pools. */
export function drawDecals(g: CanvasRenderingContext2D, cam: Cam, time: number) {
  if (goreAmount() <= 0) return;
  const x0 = Math.floor(-cam.offX / CH);
  const x1 = Math.floor((-cam.offX + cam.ww) / CH);
  const y0 = Math.floor(-cam.offY / CH);
  const y1 = Math.floor((-cam.offY + cam.wh) / CH);
  const L = life();
  const persist = persistentBlood();
  g.imageSmoothingEnabled = true;
  // Chunk rectangles are snapped to device pixels: at a fractional position both neighbours
  // antialias their shared edge and a faint line shows where a stain crosses it.
  const sc = g.getTransform().a || 1;
  const snap = (v: number) => Math.round(v * sc) / sc;
  const a0 = g.globalAlpha;
  const op0 = g.globalCompositeOperation;
  const layer = (c: Layer, cx: number, cy: number) => {
    const base = c.gen === BASE;
    const age = clock - c.born;
    if (!base && age > L) return;
    c.used = clock;
    const fade = base || persist || age < L - 20 ? 1 : Math.max(0, (L - age) / 20);
    // 0 = wet paint, 1 = soaked into the soil
    const soak = base ? 1 : Math.max(0, Math.min(1, (age - 5) / 15));
    const dx = snap(cam.offX + cx * CH);
    const dy = snap(cam.offY + cy * CH);
    const dw = snap(cam.offX + (cx + 1) * CH) - dx;
    const dh = snap(cam.offY + (cy + 1) * CH) - dy;
    // inner rectangle of the layer (the gutter around it only feeds the edge filtering)
    const p = PAD >> c.lv;
    const n = c.cv.width - p * 2;
    g.globalCompositeOperation = "source-over";
    // Soaked blood keeps most of its own colour: multiplied into dark soil alone it went black.
    g.globalAlpha = a0 * fade * (0.84 + 0.16 * (1 - soak));
    g.drawImage(c.cv, p, p, n, n, dx, dy, dw, dh);
    if (soak > 0) {
      g.globalCompositeOperation = "multiply";
      g.globalAlpha = a0 * fade * soak * 0.3;
      g.drawImage(c.cv, p, p, n, n, dx, dy, dw, dh);
    }
  };
  for (let cx = x0; cx <= x1; cx++)
    for (let cy = y0; cy <= y1; cy++) {
      const l = locs.get(lkey(cx, cy));
      if (!l) continue;
      if (l.base) layer(l.base, cx, cy);
      for (const c of l.gens) layer(c, cx, cy);
    }
  g.globalCompositeOperation = op0;
  g.globalAlpha = a0;
  for (const p of pools) {
    if (!p.on) continue;
    const sx = cam.offX + isoX(p.x, p.y);
    const sy = cam.offY + isoY(p.x, p.y);
    if (sx < -p.R * 3 || sy < -p.R * 3 || sx > cam.ww + p.R * 3 || sy > cam.wh + p.R * 3) continue;
    g.save();
    groundTransform(g, sx, sy, DECAL_SCALE);
    paintPool(g, p.mat, p.R, p.seed, p.t / p.grow, time, 0.95);
    if (p.mat === 7) drawBubbles(g, p, time);
    g.restore();
  }
}

export function clearDecals() {
  for (const c of genList) c.cv.width = c.cv.height = 0;
  for (const c of baseList) c.cv.width = c.cv.height = 0;
  for (const cv of spare) cv.width = cv.height = 0;
  genList.length = 0;
  baseList.length = 0;
  spare.length = 0;
  locs.clear();
  bytes = 0;
  queue.length = 0;
  qHead = 0;
  for (const p of pools) p.on = false;
}

/** Counts for tests / tuning: layers, permanent layers per resolution level, canvas bytes. */
export function decalStats() {
  let area = 0;
  for (const c of genList) area += c.area;
  const lv = [0, 0, 0];
  for (const b of baseList) lv[b.lv]++;
  return { chunks: genList.length + baseList.length, locations: locs.size, gens: genList.length, bases: baseList.length, lv, spare: spare.length, bytes, mb: +(bytes / 1048576).toFixed(1), queued: queue.length - qHead, pools: pools.filter((p) => p.on).length, area: Math.round(area) };
}
