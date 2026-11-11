// The current match map, shared by server and client. Both sides call setMap(params) with the same
// params (the server sends them in a {t:"map"} message) and get an identical procedural map.
//
// Compatibility: OBSTACLES is one array object refilled in place, and MAP_W / MAP_H (constants.ts)
// are live bindings updated here, so older code that iterates OBSTACLES keeps working. New code
// should use the spatial queries below instead of looping over every obstacle.
import { setMapSize } from "./constants";
import type { BiomeDef, ObstacleKind } from "./biomes";
import { generateLaneMap } from "./mapgen/lane";
import { CELL, generateMap, OPEN, WATER, type CampSpot, type GameMap, type MapParams, type MapObstacle, type Poi, type PoiKind, type Area } from "./mapgen/generate";

export type { CampSpot, GameMap, MapParams, Poi, PoiKind, Area, Road, ZoneName } from "./mapgen/generate";
export { CELL, OPEN, WALL, WATER, mapSideFor, reachability, MAPGEN, ZONE, ZONE_NAMES } from "./mapgen/generate";

export interface Obstacle {
  x: number;
  y: number;
  r: number;
  /** Visual kind (rocks / ruin / tree / shrine / water). */
  k?: ObstacleKind;
  /** Visual variant 0..7. */
  v?: number;
  /** Part of a wall or water edge. */
  wall?: boolean;
  /** Landmark dressing hint (pillar / arch / statue / deadtree / woodpile / cart / grim / stones). */
  tag?: string;
}

/** Every collision circle of the current map (refilled in place by setMap). */
export const OBSTACLES: Obstacle[] = [];

let current: GameMap;
let version = 0;
const listeners: ((m: GameMap) => void)[] = [];

/** Generate and install a map. Returns the map (cheap no-op if the params are unchanged). */
export function setMap(params: MapParams): GameMap {
  if (current && current.seed === (params.seed | 0) && current.params.players === params.players && current.params.biome === (params.biome ?? current.params.biome) && current.params.mode === params.mode) {
    return current;
  }
  const m = params.mode === "lanes" ? generateLaneMap(params) : generateMap(params);
  install(m);
  return m;
}

function install(m: GameMap) {
  current = m;
  version++;
  OBSTACLES.length = 0;
  for (const o of m.obstacles) OBSTACLES.push(o);
  setMapSize(m.w, m.h);
  for (const fn of listeners) fn(m);
}

export function currentMap(): GameMap {
  return current;
}

/** Increments every time a new map is installed. */
export function mapVersion(): number {
  return version;
}

/** Register a callback for map changes (called after the new map is installed). */
export function onMapChange(fn: (m: GameMap) => void): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function currentBiome(): BiomeDef {
  return current.biome;
}

// ---- spatial queries ------------------------------------------------------------------------

/** Obstacles whose circles may touch (x, y, r); fn gets (obstacle, index into OBSTACLES). Return true to stop. */
export function forObstaclesNear(x: number, y: number, r: number, fn: (o: Obstacle, i: number) => boolean | void) {
  current.grid.forNear(x, y, r, fn as (o: MapObstacle, i: number) => boolean | void);
}

/** Obstacles that may be visible in a world rect. */
export function forObstaclesInRect(x0: number, y0: number, x1: number, y1: number, fn: (o: Obstacle, i: number) => boolean | void) {
  current.grid.forRect(x0, y0, x1, y1, fn as (o: MapObstacle, i: number) => boolean | void);
}

/** Cell index at a world point, or -1 outside the map. */
export function cellIndexAt(x: number, y: number): number {
  const m = current;
  const i = Math.floor(x / CELL);
  const j = Math.floor(y / CELL);
  if (i < 0 || j < 0 || i >= m.cols || j >= m.rows) return -1;
  return j * m.cols + i;
}

/** OPEN (0) / WALL (1) / WATER (2) at a world point; outside the map counts as WALL. */
export function cellKindAt(x: number, y: number): number {
  const k = cellIndexAt(x, y);
  return k < 0 ? 1 : current.solid[k];
}

/** ZONE id of the cell under a point (0 = blocked / off the map). */
export function zoneAt(x: number, y: number): number {
  const k = cellIndexAt(x, y);
  return k < 0 ? 0 : current.zone[k];
}

/** The themed clearing a point stands in (nearest centre within its radius), or null on roads and trails. */
export function areaAt(x: number, y: number): Area | null {
  let best: Area | null = null;
  let bd = Infinity;
  for (const a of current.areas) {
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d < (a.r * 1.25) ** 2 && d < bd) {
      bd = d;
      best = a;
    }
  }
  return best;
}

export function isWaterAt(x: number, y: number): boolean {
  return cellKindAt(x, y) === WATER;
}

/** True if a circle at (x, y, r) stands on open ground and touches no obstacle (pad = extra gap). */
export function isWalkable(x: number, y: number, r: number, pad = 0): boolean {
  if (cellKindAt(x, y) !== OPEN) return false;
  return !current.grid.overlaps(x, y, r, pad);
}

/** True if any obstacle blocks a projectile of radius r at (x, y). Water edges do not block shots. */
export function blocksProjectile(x: number, y: number, r: number): boolean {
  const k = cellKindAt(x, y);
  if (k === 1) return true;
  let hit = false;
  current.grid.forNear(x, y, r, (o) => {
    if (o.k === "water") return;
    const dx = o.x - x;
    const dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) ** 2) {
      hit = true;
      return true;
    }
  });
  return hit;
}

/**
 * If (x, y) ended up inside blocked ground (tunnelled through a wall edge), move it to the centre of
 * the nearest open cell. Returns true if it moved. Deterministic (precomputed nearest-open table).
 */
export function rescueFromWall(s: { x: number; y: number }): boolean {
  const m = current;
  const k = cellIndexAt(s.x, s.y);
  if (k >= 0 && m.solid[k] === OPEN) return false;
  let target = k >= 0 ? m.nearestOpen[k] : -1;
  if (target < 0) {
    const i = Math.max(0, Math.min(m.cols - 1, Math.floor(s.x / CELL)));
    const j = Math.max(0, Math.min(m.rows - 1, Math.floor(s.y / CELL)));
    target = m.nearestOpen[j * m.cols + i];
    if (target < 0) target = j * m.cols + i;
  }
  s.x = ((target % m.cols) + 0.5) * CELL;
  s.y = (Math.floor(target / m.cols) + 0.5) * CELL;
  return true;
}

// ---- points of interest -------------------------------------------------------------------

/**
 * Points of interest of the current map. Kinds:
 *  - "spawn": player spawn candidates (spread out, calm outskirts)
 *  - "trial": 3-6 trial shrine spots (progression), mid danger, kept clear of props
 *  - "chest": chest / strongbox spots (next to elite packs, in ruins)
 *  - "buff":  guarded buff-shrine spots next to normal packs
 *  - "ruin":  ruin cluster centres (paved)
 *  - "lair":  dead-end lairs (elite camp)
 *  - "boss":  the heart of the map (boss camp + rune monolith)
 */
export function getPois(kind?: PoiKind): Poi[] {
  return kind ? current.pois.filter((p) => p.kind === kind) : current.pois;
}

/** Monster camp spots (positions + tier) of the current map. */
export function getCampSpots(): CampSpot[] {
  return current.camps;
}

/** Danger 0..1 at a world point (centre and lairs are dangerous). */
export function dangerAt(x: number, y: number): number {
  const m = current;
  const dx = x - m.center.x;
  const dy = y - m.center.y;
  let d = Math.max(0, Math.min(1, 1 - Math.sqrt(dx * dx + dy * dy) / (0.5 * Math.min(m.w, m.h) * 1.1)));
  for (const p of m.pois) {
    if (p.kind !== "lair") continue;
    if ((p.x - x) ** 2 + (p.y - y) ** 2 < 500 * 500) d = Math.max(d, p.danger);
  }
  return d;
}

/** Nearest walkable spot to (x, y) for a circle of radius r (rings outward), or null. */
export function walkableNear(x: number, y: number, r: number, maxDist = 900): { x: number; y: number } | null {
  if (isWalkable(x, y, r)) return { x, y };
  for (let rad = 12; rad < maxDist; rad += 12) {
    const n = Math.max(8, Math.floor(rad / 8));
    for (let a = 0; a < n; a++) {
      const ang = (a / n) * Math.PI * 2;
      const cx = x + Math.cos(ang) * rad;
      const cy = y + Math.sin(ang) * rad;
      if (isWalkable(cx, cy, r)) return { x: cx, y: cy };
    }
  }
  return null;
}

/** A random walkable spot (uses the given rng, default Math.random). */
export function randomWalkable(r: number, rnd: () => number = Math.random, ok: (x: number, y: number) => boolean = () => true): { x: number; y: number } {
  const m = current;
  for (let i = 0; i < 400; i++) {
    const k = Math.floor(rnd() * m.solid.length);
    if (m.solid[k] !== OPEN || m.clear[k] < 2) continue;
    const x = ((k % m.cols) + 0.2 + rnd() * 0.6) * CELL;
    const y = (Math.floor(k / m.cols) + 0.2 + rnd() * 0.6) * CELL;
    if (isWalkable(x, y, r) && (i > 300 || ok(x, y))) return { x, y };
  }
  return { x: m.spawns[0]?.x ?? m.center.x, y: m.spawns[0]?.y ?? m.center.y };
}

// A default map so imports never see an empty world (art page, before the server's map arrives).
install(generateMap({ seed: 1337, players: 2, biome: "hollowpine" }));
