// Painted hollowpine ground: per-chunk canvases (same screen-space chunk grid as gfx/world.ts) of
// the seamless mud tile, with moss and path tiles blended in by a world-anchored noise mask.
import { ART_PX } from "./actors";
import { artVersion, getImage, staticDef } from "./registry";
import { mapVersion, ZONE } from "../../../shared/map";
import { SQ, unproject } from "../iso";
import { pathStrength, zoneWeight } from "../zones";

export const GROUND_TILES = {
  base: "tile_hollowpine_mud",
  moss: "tile_hollowpine_moss",
  path: "tile_hollowpine_path",
  /** Optional variety layers (skipped until their art exists): needle litter, bare rock, pebbles on the path. */
  needles: "tile_hollowpine_needles",
  stone: "tile_hollowpine_stone",
  pebbles: "tile_hollowpine_path_c",
  /** Per-place ground (map zones): glade turf, graveyard gravel, ruin flagstones, heart slabs, logging-camp bark, lair bones. */
  gravel: "tile_hollowpine_gravel",
  cobble: "tile_hollowpine_cobble",
  slabs: "tile_hollowpine_stone_b",
  bark: "tile_hollowpine_needles_b",
  bones: "tile_hollowpine_bones",
  roadbed: "tile_hollowpine_path_d",
};
/** Screen units per tile px (512 px tile -> ~150 units). */
const TILE_SCALE = ART_PX * 1.3;
/** Canvas px per screen unit inside a cached chunk. */
const D = 2;
/** Cached chunks (256 KB each). A 1280x720 view shows about 30 and the prefetch ring adds 25. */
const MAX = 150;

const cache = new Map<string, HTMLCanvasElement>();
/** Chunks built while some blend tile was still loading (base only there): rebuilt once all are in. */
const partial = new Set<string>();
let cacheVer = -1;
let cacheMap = -1;

function hash(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, s: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function tileImg(id: string) {
  const def = staticDef(id);
  return def ? getImage(def.src) : null;
}

/** Every ground tile that exists in the art index has its image loaded. */
function allTilesLoaded() {
  for (const id of Object.values(GROUND_TILES)) {
    const def = staticDef(id);
    if (def && !getImage(def.src)) return false;
  }
  return true;
}

/** True once the base ground tile is loaded (and painted sprites are on). */
export function paintedGroundReady() {
  return tileImg(GROUND_TILES.base) !== null;
}

const maskCv = document.createElement("canvas");
const layerCv = document.createElement("canvas");
const MG = 9; // mask samples per chunk side (+1)

/** Pattern -> chunk canvas: the tile lies flat in the screen (organic ground), or on the iso ground plane
 * (laid stone: rotated 45 degrees and foreshortened like the world, so slabs and cobbles do not read as a
 * wall of upright bricks across a big plaza). */
function tileMatrix(x0: number, y0: number, iso: boolean | "turn"): DOMMatrix {
  if (iso === "turn") {
    // Same tile turned 90 degrees, 1.27x larger and offset: a second copy that does not line up with the first.
    const t = TILE_SCALE * 1.27 * D;
    return new DOMMatrix([0, t, -t, 0, -x0 * D + 61, -y0 * D + 37]);
  }
  if (!iso) return new DOMMatrix([TILE_SCALE * D, 0, 0, TILE_SCALE * D, -x0 * D, -y0 * D]);
  const s = TILE_SCALE * ISO_TILE * Math.SQRT1_2 * D;
  return new DOMMatrix([s, s * SQ, -s, s * SQ, -x0 * D, -y0 * D]);
}
/** Laid-stone tiles on the iso plane span about 1.4x wider: scale them down to keep the stone size. */
const ISO_TILE = 0.8;

function blend(g: CanvasRenderingContext2D, im: HTMLImageElement, x0: number, y0: number, size: number, f: (sx: number, sy: number) => number, iso: boolean | "turn" = false): boolean {
  maskCv.width = MG;
  maskCv.height = MG;
  const mg = maskCv.getContext("2d")!;
  const img = mg.createImageData(MG, MG);
  let any = false;
  for (let j = 0; j < MG; j++) {
    for (let i = 0; i < MG; i++) {
      const a = Math.max(0, Math.min(1, f(x0 + (i / (MG - 1)) * size, y0 + (j / (MG - 1)) * size)));
      if (a > 0.01) any = true;
      img.data[(j * MG + i) * 4 + 3] = Math.round(a * 255);
    }
  }
  if (!any) return false;
  mg.putImageData(img, 0, 0);
  const px = size * D;
  layerCv.width = px;
  layerCv.height = px;
  const lg = layerCv.getContext("2d")!;
  const pat = lg.createPattern(im, "repeat");
  if (!pat) return false;
  pat.setTransform(tileMatrix(x0, y0, iso));
  lg.fillStyle = pat;
  lg.fillRect(0, 0, px, px);
  lg.globalCompositeOperation = "destination-in";
  lg.imageSmoothingEnabled = true;
  // mask samples sit on the chunk corners: stretch so sample centres land on them
  const cell = px / (MG - 1);
  lg.drawImage(maskCv, -cell / 2, -cell / 2, px + cell, px + cell);
  lg.globalCompositeOperation = "source-over";
  g.drawImage(layerCv, 0, 0);
  return true;
}

/** Chunks being painted: one chunk is 5-10 ms of pattern fills and blends, so it is painted a few layers
 * per frame (render.ts drawGround budget) instead of in one go, which was a frame hitch per new chunk. */
const jobs = new Map<string, Generator<void, HTMLCanvasElement | null>>();
const MAX_JOBS = 48;

/**
 * Painted ground for chunk (cx, cy) of `size` screen units (world.ts CHUNK); draw it at
 * (offX + cx * size, offY + cy * size). Null until the tiles are loaded or while it is still being painted
 * (the stale chunk, if any, until then). With `build` it paints at least one layer, then more until
 * performance.now() reaches `until`.
 */
export function paintedGroundChunk(cx: number, cy: number, size: number, build = true, until = 0): HTMLCanvasElement | null {
  if (cacheVer !== artVersion() || cacheMap !== mapVersion()) {
    cache.clear();
    partial.clear();
    jobs.clear();
    cacheVer = artVersion();
    cacheMap = mapVersion(); // the ground follows the map's places and roads
  }
  const key = cx + "," + cy;
  const hit = cache.get(key);
  // A chunk painted before the moss / needle / path tiles had loaded stayed a plain-mud
  // rectangle among finished neighbours for the whole match: redo it once they are in.
  const complete = allTilesLoaded();
  if (hit && !(complete && partial.has(key))) return hit;
  if (!build) return hit ?? null; // over this frame's budget: the stale chunk (or nothing) for now
  let job = jobs.get(key);
  if (!job) {
    if (!tileImg(GROUND_TILES.base)) return null;
    job = paintChunk(cx, cy, size, key, complete);
    jobs.set(key, job);
    while (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value!); // left behind (walked away mid-paint)
  }
  for (;;) {
    const r = job.next();
    if (r.done) {
      jobs.delete(key);
      return r.value ?? hit ?? null;
    }
    if (performance.now() >= until) return hit ?? null;
  }
}

/** Paint one chunk, yielding after each layer; returns the finished (and cached) canvas. */
function* paintChunk(cx: number, cy: number, size: number, key: string, complete: boolean): Generator<void, HTMLCanvasElement | null> {
  const base = tileImg(GROUND_TILES.base);
  if (!base) return null;
  const moss = tileImg(GROUND_TILES.moss);
  const path = tileImg(GROUND_TILES.path);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size * D;
  const g = cv.getContext("2d")!;
  const x0 = cx * size;
  const y0 = cy * size;
  const pat = g.createPattern(base, "repeat");
  if (!pat) return null;
  pat.setTransform(new DOMMatrix([TILE_SCALE * D, 0, 0, TILE_SCALE * D, -x0 * D, -y0 * D]));
  g.fillStyle = pat;
  g.fillRect(0, 0, cv.width, cv.height);
  yield;
  const needles = tileImg(GROUND_TILES.needles);
  const stone = tileImg(GROUND_TILES.stone);
  const pebbles = tileImg(GROUND_TILES.pebbles);
  // World-anchored masks only (no per-client randomness): every client paints the same ground.
  // Each kind of place has its own ground, and the path tile follows the real roads and trails.
  const zw = (x: number, y: number, z: number) => {
    const w = unproject(x, y);
    return zoneWeight(w.x, w.y, z);
  };
  /** Zone mask: solid inside the place, breaking up in noisy patches toward its border. */
  // Open maps made the places big: inside, patches of plain ground break the place tile up so a large
  // plaza or logging yard is not one unbroken repeat of the same tile.
  const place = (z: number, s: number, max: number) => (x: number, y: number) =>
    Math.min(max, (zw(x, y, z) * 1.25 + (noise(x / 150, y / 100, s) - 0.5) * 0.7 - 0.42) * 3) - Math.max(0, noise(x / 210, y / 140, s + 100) - 0.6) * 3.5;
  if (
    needles &&
    blend(g, needles, x0, y0, size, (x, y) =>
      Math.min(0.85, (noise(x / 310, y / 200, 21) * 0.75 + noise(x / 70, y / 46, 22) * 0.25 - 0.56 + zw(x, y, ZONE.thicket) * 0.5 - zw(x, y, ZONE.glade) * 0.4) * 5),
    )
  )
    yield;
  if (stone && blend(g, stone, x0, y0, size, (x, y) => (noise(x / 230, y / 150, 31) * 0.8 + noise(x / 60, y / 40, 32) * 0.2 - 0.68 - zw(x, y, ZONE.glade) * 0.3) * 7)) yield;
  if (
    moss &&
    blend(g, moss, x0, y0, size, (x, y) =>
      Math.min(0.95, (noise(x / 260, y / 170, 11) * 0.7 + noise(x / 90, y / 60, 12) * 0.3 - 0.56 + zw(x, y, ZONE.glade) * 0.62 - zw(x, y, ZONE.graveyard) * 0.25 - zw(x, y, ZONE.lumber) * 0.3) * 4),
    )
  )
    yield;
  const gravel = tileImg(GROUND_TILES.gravel);
  const cobble = tileImg(GROUND_TILES.cobble);
  const slabs = tileImg(GROUND_TILES.slabs);
  const bark = tileImg(GROUND_TILES.bark);
  const bones = tileImg(GROUND_TILES.bones);
  const roadbed = tileImg(GROUND_TILES.roadbed);
  if (gravel && blend(g, gravel, x0, y0, size, place(ZONE.graveyard, 51, 0.8))) yield;
  if (bark) {
    const yard = place(ZONE.lumber, 52, 0.8);
    if (blend(g, bark, x0, y0, size, yard)) yield;
    // loop17: the big yards showed the bark tile's grid; patches of a turned, rescaled copy break the repeat.
    if (blend(g, bark, x0, y0, size, (x, y) => Math.min(yard(x, y), (noise(x / 170, y / 110, 57) - 0.42) * 4), "turn")) yield;
  }
  if (bones && blend(g, bones, x0, y0, size, place(ZONE.lair, 53, 0.9))) yield;
  if (cobble && blend(g, cobble, x0, y0, size, place(ZONE.ruins, 54, 0.9), true)) yield;
  if (slabs && blend(g, slabs, x0, y0, size, place(ZONE.heart, 55, 0.9), true)) yield;
  // Trodden earth along the roads (wide) and trails (narrow, fainter), with a ragged edge.
  const pathMask = (x: number, y: number) => {
    const w = unproject(x, y);
    return Math.min(0.92, (pathStrength(w.x, w.y) + (noise(x / 90, y / 60, 13) - 0.5) * 0.45 - 0.42) * 3.2);
  };
  if (path && blend(g, path, x0, y0, size, pathMask)) yield;
  if (path && pebbles && blend(g, pebbles, x0, y0, size, (x, y) => Math.min(pathMask(x, y), 0.7, (noise(x / 120, y / 80, 41) - 0.45) * 5))) yield;
  if (roadbed)
    blend(g, roadbed, x0, y0, size, (x, y) => {
      const w = unproject(x, y);
      return Math.min(0.75, (pathStrength(w.x, w.y) - 0.86 + (noise(x / 70, y / 46, 42) - 0.5) * 0.25) * 7); // only the middle of main roads
    });
  cache.delete(key);
  cache.set(key, cv);
  if (complete) partial.delete(key);
  else partial.add(key);
  while (cache.size > MAX) {
    const old = cache.keys().next().value!;
    cache.delete(old);
    partial.delete(old);
  }
  return cv;
}

let fillPat: CanvasPattern | null = null;
let fillPatImg: HTMLImageElement | null = null;
/**
 * Stand-in for a ground chunk that is not built yet (render.ts drawGround): the base tile as a
 * world-anchored pattern, so a late chunk reads as plain ground instead of a flat rectangle.
 * (offX, offY) = where the projected world origin sits in g's units. False = tiles not loaded.
 */
export function fillPaintedGround(g: CanvasRenderingContext2D, offX: number, offY: number, dx: number, dy: number, size: number): boolean {
  const base = tileImg(GROUND_TILES.base);
  if (!base) return false;
  if (fillPatImg !== base) {
    fillPat = g.createPattern(base, "repeat");
    fillPatImg = base;
  }
  if (!fillPat) return false;
  fillPat.setTransform(new DOMMatrix([TILE_SCALE, 0, 0, TILE_SCALE, offX, offY]));
  g.fillStyle = fillPat;
  g.fillRect(dx, dy, size, size);
  return true;
}

/** True when paintedGroundChunk would have to paint this chunk now (not cached, or cached before all tiles had loaded). */
export function paintedGroundDue(cx: number, cy: number) {
  if (cacheVer !== artVersion()) return true;
  const key = cx + "," + cy;
  return !cache.has(key) || (partial.has(key) && allTilesLoaded());
}

/** Whether a chunk is already cached (to budget builds per frame). */
export function paintedGroundCached(cx: number, cy: number) {
  return cache.has(cx + "," + cy);
}
