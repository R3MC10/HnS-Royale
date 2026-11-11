// Procedural royale map: deterministic from (seed, players, biome). Shared by server and client:
// the server sends only the params, the client regenerates the identical map.
//
// Pipeline (all on a CELL-sized grid):
//  1. Clearings: Poisson-disc organic open areas, a big "heart" near the centre.
//  2. Paths: MST over the clearings + a few extra loops, wandering corridors with chokepoints.
//  3. Shape: noisy clearing edges, rock outcrops, ragged border, water (fen), cellular smoothing.
//  4. Walkability: every open cell must sit in a 2x2 open block (corridors >= 2 cells), then a
//     flood fill over the block graph; detached pockets get a corridor carved to the main area
//     or are filled in.
//  5. Content: roles per clearing (spawns, trial shrines, ruins, lairs, boss heart), camps by open
//     area, open-ground props, wall circles along every wall/water edge (collision + art).
//  6. Fine check: flood fill at 32 px with the real circles; props that seal anything are removed.
// No trig anywhere (sqrt / floor / imul only) so every JS engine produces the same map.
import { biomeOf, pickWeighted, type BiomeDef, type ObstacleKind } from "../biomes";
import { StaticCircleGrid } from "../spatial";
import { fbm, hashi, mulberry32, vnoise } from "./noise";

export const CELL = 64;
export const OPEN = 0;
export const WALL = 1;
export const WATER = 2;

/** Tunables (world px). Map side = sqrt(baseArea + players * areaPerPlayer). */
export const MAPGEN = {
  // Was 26e6 + 11.5e6 per player: 15-player bot matches ran ~8 min (target 5-7). Two-player maps keep their size.
  baseArea: 45e6,
  areaPerPlayer: 3.7e6,
  minPlayers: 2,
  maxPlayers: 20,
  clearingSpacing: 1250,
  heartRadius: 900, // more open maps: was 760
  /** One monster camp per this much open ground (px²). */
  campArea: 900_000, // more open maps: was 620k; the open area grew ~1.5x, so this keeps the camp count
  /**
   * At least this many camps per player, room allowing. The smaller maps had left 15 players about 1.8 camps each
   * (5.7 on the old map) and bots a third less gear by the last fights. 15-player bot matches: 3 -> +11 s of fight,
   * 4 -> +38 s, 5.7 -> +51 s (docs/SELF-SURVEY.md round 8).
   */
  campsPerPlayer: 3,
  // (Spacing was 600 and spawn clearance 850: with two spawn clearings per player on the smaller map, those two left no room for the camps.)
  campSpacing: 450,
  spawnCampClearance: 600,
  /** Wall circle radius range (must stay >= CELL * 0.708 so a circle covers its whole cell). */
  wallR: [46, 50] as [number, number],
  /** Player radius used by the walkability check. */
  walkerR: 20,
};

export interface MapParams {
  seed: number;
  players: number;
  biome?: string;
  /** "lanes": the fixed Breachway lane map (mapgen/lane.ts) instead of a procedural royale map. */
  mode?: "lanes";
}

export interface MapObstacle {
  x: number;
  y: number;
  r: number;
  /** Visual kind (props.ts). */
  k: ObstacleKind;
  /** Visual variant 0..7. */
  v: number;
  /** Part of a wall / water edge (vs. a free-standing prop). */
  wall?: boolean;
  /** Landmark dressing hint for the renderer (pillar / statue / deadtree / woodpile / cart / grim / stones). */
  tag?: string;
}

/** Per-cell zone ids: what kind of place an open cell belongs to (drives ground, dressing and the map colours). */
export const ZONE = { none: 0, trail: 1, road: 2, glade: 3, thicket: 4, graveyard: 5, ruins: 6, lumber: 7, lair: 8, heart: 9 } as const;
export type ZoneName = keyof typeof ZONE;
export const ZONE_NAMES: ZoneName[] = ["none", "trail", "road", "glade", "thicket", "graveyard", "ruins", "lumber", "lair", "heart"];

/** One clearing of the map: a themed place with a centre and rough radius. Landmarks have a name. */
export interface Area {
  id: number;
  kind: ZoneName;
  x: number;
  y: number;
  r: number;
  /** "" for plain terrain (glades, thickets). */
  name: string;
}

/** A corridor centre line between two clearings. Main roads lead from the outer gates to the heart. */
export interface Road {
  pts: [number, number][];
  main: boolean;
}

export type PoiKind = "spawn" | "trial" | "chest" | "buff" | "ruin" | "boss" | "lair";

export interface Poi {
  id: number;
  kind: PoiKind;
  x: number;
  y: number;
  /** Radius kept clear of props around the point. */
  r: number;
  /** 0 (outskirts) .. 1 (most dangerous). */
  danger: number;
}

export interface CampSpot {
  id: number;
  x: number;
  y: number;
  /** 0 normal, 1 elite (guaranteed rare), 2 boss. */
  tier: 0 | 1 | 2;
  danger: number;
}

export interface GameMap {
  params: Readonly<MapParams>;
  seed: number;
  players: number;
  biome: BiomeDef;
  w: number;
  h: number;
  cell: number;
  cols: number;
  rows: number;
  /** Per cell: OPEN / WALL / WATER. */
  solid: Uint8Array;
  /** Per cell: ZONE id (0 on blocked cells). */
  zone: Uint8Array;
  /** Themed clearings (landmarks carry a name). */
  areas: Area[];
  /** Corridor centre lines (roads and trails). */
  roads: Road[];
  /** Per cell: Chebyshev distance (cells) to the nearest blocked cell (0 for blocked cells, capped 255). */
  clear: Uint8Array;
  /** Per blocked cell: index of the nearest open cell (-1 for open cells). */
  nearestOpen: Int32Array;
  obstacles: MapObstacle[];
  grid: StaticCircleGrid<MapObstacle>;
  pois: Poi[];
  camps: CampSpot[];
  spawns: { x: number; y: number }[];
  center: { x: number; y: number };
  /** Open (walkable) area in px². */
  openArea: number;
  genMs: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function clampPlayers(n: number) {
  return Math.max(MAPGEN.minPlayers, Math.min(MAPGEN.maxPlayers, Math.round(n) || MAPGEN.minPlayers));
}

/** Square map side (px, a multiple of CELL) for a player count. */
export function mapSideFor(players: number): number {
  const n = clampPlayers(players);
  const side = Math.sqrt(MAPGEN.baseArea + n * MAPGEN.areaPerPlayer);
  return Math.round(side / CELL) * CELL;
}

/** Distance-based danger 0..1 at a world point (centre = 1). */
export function baseDanger(map: { w: number; h: number; center: { x: number; y: number } }, x: number, y: number) {
  const dx = x - map.center.x;
  const dy = y - map.center.y;
  return clamp01(1 - Math.sqrt(dx * dx + dy * dy) / (0.5 * Math.min(map.w, map.h) * 1.1));
}

/** "Any point within d" set backed by a bucket grid. */
class PointSet {
  private b = new Map<number, { x: number; y: number }[]>();
  constructor(private cell: number) {}
  add(x: number, y: number) {
    const k = Math.floor(y / this.cell) * 65536 + Math.floor(x / this.cell);
    let a = this.b.get(k);
    if (!a) this.b.set(k, (a = []));
    a.push({ x, y });
  }
  near(x: number, y: number, d: number): boolean {
    const c0 = Math.floor((x - d) / this.cell);
    const c1 = Math.floor((x + d) / this.cell);
    const r0 = Math.floor((y - d) / this.cell);
    const r1 = Math.floor((y + d) / this.cell);
    const d2 = d * d;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const a = this.b.get(cy * 65536 + cx);
        if (!a) continue;
        for (const p of a) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < d2) return true;
        }
      }
    }
    return false;
  }
}

interface Clearing {
  x: number;
  y: number;
  R: number;
  /** Extra blobs (offset x, offset y, radius) that make the clearing irregular. */
  lobes: [number, number, number][];
  deg: number;
  danger: number;
  role: PoiKind | "none" | "dead";
  theme: number;
}

const AREA_NAMES: Partial<Record<ZoneName, string[]>> = {
  graveyard: ["Mourner's Rows", "Paupers' Field", "The Quiet Rows", "Widow's Acre", "Cold Furrows", "Sexton's Plot", "Nameless Yard", "The Low Stones"],
  ruins: ["Fallen Chapel", "Broken Cloister", "Roofless Hall", "Sunken Priory", "The Old Tollhouse", "Mossgate", "Greywall", "The Toppled Stair"],
  lumber: ["Sawyer's Rest", "The Last Felling", "Splitwood Yard", "Charcoal Pits", "Hewer's Stand", "Tallow Camp", "Dry Stack", "Wedge and Maul"],
  lair: ["Gnawed Hollow", "The Carrion Den", "Wolfbone Pit", "Marrow Hole", "Blackroot Den", "Howling Sink", "The Rib Cellar", "Skinner's Dell"],
  heart: ["The Hollow Heart"],
};

const DIR8: [number, number][] = [
  [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071],
];

export function generateMap(params: MapParams): GameMap {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const seed = params.seed | 0;
  const players = clampPlayers(params.players);
  const biome = biomeOf(params.biome);
  const rng = mulberry32(seed ^ 0x5bd1e995);
  const S = (seed & 0xffff) * 7 + 3; // noise seed base

  const side = mapSideFor(players);
  const w = side;
  const h = side;
  const cols = w / CELL;
  const rows = h / CELL;
  const N = cols * rows;
  const cx0 = w / 2;
  const cy0 = h / 2;
  const at = (i: number, j: number) => j * cols + i;
  const ccx = (i: number) => (i + 0.5) * CELL;

  // ---- 1. clearings ---------------------------------------------------------------------
  const D = MAPGEN.clearingSpacing * biome.clearingScale;
  const margin = CELL * 9;
  const clearings: Clearing[] = [];
  {
    const jx = (rng() - 0.5) * w * 0.08;
    const jy = (rng() - 0.5) * h * 0.08;
    clearings.push({ x: cx0 + jx, y: cy0 + jy, R: MAPGEN.heartRadius, lobes: [], deg: 0, danger: 1, role: "boss", theme: 0 });
    const target = Math.floor(((w - 2 * margin) * (h - 2 * margin)) / (D * D * 0.85));
    const ps = new PointSet(D);
    ps.add(clearings[0].x, clearings[0].y);
    for (let a = 0; a < target * 30 && clearings.length < target; a++) {
      const x = margin + rng() * (w - 2 * margin);
      const y = margin + rng() * (h - 2 * margin);
      // Size variety: most clearings are modest, about a quarter are wide open fields.
      const R = (400 + rng() * 300) * (rng() < 0.35 ? 1.35 : 1) * biome.clearingScale; // more open maps: was (300 + 260) * (26% 1.3x)
      if (ps.near(x, y, D)) continue;
      if (Math.sqrt((x - clearings[0].x) ** 2 + (y - clearings[0].y) ** 2) < MAPGEN.heartRadius + D * 0.7) continue;
      const lobes: [number, number, number][] = [];
      const nl = Math.floor(rng() * 3.2);
      for (let l = 0; l < nl; l++) {
        let ux = rng() * 2 - 1;
        let uy = rng() * 2 - 1;
        const len = Math.sqrt(ux * ux + uy * uy) || 1;
        ux /= len;
        uy /= len;
        const d = R * (0.45 + rng() * 0.35);
        lobes.push([ux * d, uy * d, R * (0.45 + rng() * 0.3)]);
      }
      clearings.push({ x, y, R, lobes, deg: 0, danger: 0, role: "none", theme: 0 });
      ps.add(x, y);
    }
  }
  const nC = clearings.length;

  // ---- 2. graph: MST (Prim) + extra loops -----------------------------------------------
  const edges: [number, number][] = [];
  {
    const inTree = new Uint8Array(nC);
    const best = new Float64Array(nC).fill(Infinity);
    const from = new Int32Array(nC).fill(-1);
    best[0] = 0;
    for (let it = 0; it < nC; it++) {
      let u = -1;
      for (let i = 0; i < nC; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
      inTree[u] = 1;
      if (from[u] >= 0) edges.push([from[u], u]);
      for (let i = 0; i < nC; i++) {
        if (inTree[i]) continue;
        const d = (clearings[i].x - clearings[u].x) ** 2 + (clearings[i].y - clearings[u].y) ** 2;
        if (d < best[i]) {
          best[i] = d;
          from[i] = u;
        }
      }
    }
    const has = new Set(edges.map(([a, b]) => a * 4096 + b).concat(edges.map(([a, b]) => b * 4096 + a)));
    for (let i = 0; i < nC; i++) {
      // Nearest non-connected neighbour, sometimes: loops make flanking routes.
      let bj = -1;
      let bd = Infinity;
      for (let j = 0; j < nC; j++) {
        if (j === i || has.has(i * 4096 + j)) continue;
        const d = (clearings[i].x - clearings[j].x) ** 2 + (clearings[i].y - clearings[j].y) ** 2;
        if (d < bd) {
          bd = d;
          bj = j;
        }
      }
      if (bj >= 0 && bd < (D * 2.0) ** 2 && rng() < 0.75) { // more open maps: more loops (was 1.8 / 0.45)
        edges.push([i, bj]);
        has.add(i * 4096 + bj);
        has.add(bj * 4096 + i);
      }
    }
    // The heart is a hub, not a dead end: up to four approaches from different sides.
    {
      const H = clearings[0];
      const order: number[] = [];
      for (let i = 1; i < nC; i++) order.push(i);
      const dH = (i: number) => (clearings[i].x - H.x) ** 2 + (clearings[i].y - H.y) ** 2;
      order.sort((a, b) => dH(a) - dH(b) || a - b);
      const nb: number[] = [];
      for (let j = 1; j < nC; j++) if (has.has(j)) nb.push(j); // key 0 * 4096 + j
      for (const j of order) {
        if (nb.length >= 4 || dH(j) > (D * 2.6) ** 2) break;
        if (has.has(j)) continue;
        const ax = clearings[j].x - H.x;
        const ay = clearings[j].y - H.y;
        const al = Math.sqrt(ax * ax + ay * ay) || 1;
        let spread = true;
        for (const n of nb) {
          const bx = clearings[n].x - H.x;
          const by = clearings[n].y - H.y;
          const bl = Math.sqrt(bx * bx + by * by) || 1;
          if ((ax * bx + ay * by) / (al * bl) > 0.55) spread = false;
        }
        if (!spread) continue;
        edges.push([0, j]);
        has.add(j);
        has.add(j * 4096);
        nb.push(j);
      }
    }
    for (const [a, b] of edges) {
      clearings[a].deg++;
      clearings[b].deg++;
    }
  }
  // Main roads: the shortest routes from four far corners ("gates") to the heart. Wide, no pinches.
  const mainEdge = new Set<number>();
  {
    const dist = new Float64Array(nC).fill(Infinity);
    const from = new Int32Array(nC).fill(-1);
    const done = new Uint8Array(nC);
    dist[0] = 0;
    for (let it = 0; it < nC; it++) {
      let u = -1;
      for (let i = 0; i < nC; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity) break;
      done[u] = 1;
      for (const [a, b] of edges) {
        const o = a === u ? b : b === u ? a : -1;
        if (o < 0 || done[o]) continue;
        const d = dist[u] + Math.sqrt((clearings[a].x - clearings[b].x) ** 2 + (clearings[a].y - clearings[b].y) ** 2);
        if (d < dist[o]) {
          dist[o] = d;
          from[o] = u;
        }
      }
    }
    const H = clearings[0];
    for (const [qx, qy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      let gate = -1;
      let gd = -1;
      for (let i = 1; i < nC; i++) {
        const dx = clearings[i].x - H.x;
        const dy = clearings[i].y - H.y;
        if (dx * qx < 0 || dy * qy < 0 || dist[i] === Infinity) continue;
        const d = dx * dx + dy * dy;
        if (d > gd) {
          gd = d;
          gate = i;
        }
      }
      for (let i = gate; i > 0 && from[i] >= 0; i = from[i]) {
        mainEdge.add(i * 4096 + from[i]);
        mainEdge.add(from[i] * 4096 + i);
      }
    }
  }
  const roads: Road[] = [];

  // ---- 3. openness field ----------------------------------------------------------------
  const val = new Float32Array(N).fill(-1e9);
  const core = new Uint8Array(N);
  /** Which clearing (>= 0), trail (-2) or main road (-3) opened each cell. */
  const own = new Int16Array(N).fill(-1);
  clearings.forEach((c, ci) => {
    let ext = c.R * 1.45;
    for (const [lx, ly, lr] of c.lobes) ext = Math.max(ext, Math.sqrt(lx * lx + ly * ly) + lr * 1.45);
    const i0 = Math.max(0, Math.floor((c.x - ext) / CELL));
    const i1 = Math.min(cols - 1, Math.floor((c.x + ext) / CELL));
    const j0 = Math.max(0, Math.floor((c.y - ext) / CELL));
    const j1 = Math.min(rows - 1, Math.floor((c.y + ext) / CELL));
    const ns = S + 101 + ci * 13;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = ccx(i);
        const y = ccx(j);
        const d = Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2);
        const nz = 0.68 + 0.62 * fbm(x / 330, y / 330, ns);
        let v = c.R * nz - d;
        for (const [lx, ly, lr] of c.lobes) {
          const dl = Math.sqrt((x - c.x - lx) ** 2 + (y - c.y - ly) ** 2);
          v = Math.max(v, lr * nz - dl);
        }
        const k = at(i, j);
        if (v > val[k]) {
          val[k] = v;
          own[k] = ci;
        }
        if (d < c.R * 0.42) core[k] = 1;
      }
    }
  });
  edges.forEach(([a, b], ei) => {
    const A = clearings[a];
    const B = clearings[b];
    // Midpoint displacement for a wandering trail.
    let pts: [number, number][] = [[A.x, A.y], [B.x, B.y]];
    for (let lvl = 0; lvl < 3; lvl++) {
      const out: [number, number][] = [pts[0]];
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, ay] = pts[s];
        const [bx, by] = pts[s + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const off = (rng() - 0.5) * 0.42 * len;
        out.push([(ax + bx) / 2 + (-dy / len) * off, (ay + by) / 2 + (dx / len) * off]);
        out.push(pts[s + 1]);
      }
      pts = out;
    }
    const main = mainEdge.has(a * 4096 + b);
    roads.push({ pts: pts.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]), main });
    let along = 0;
    const es = S + 500 + ei * 7;
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s];
      const [bx, by] = pts[s + 1];
      const len = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
      const steps = Math.max(1, Math.ceil(len / 24));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        const a2 = along + len * t;
        // Half-width in px: mostly 1.4..2.6 cells, occasionally pinches into a chokepoint.
        const nn = vnoise(a2 / 260, 0.5, es);
        // Main roads stay wide; trails are narrower and pinch into chokepoints.
        const hw = CELL * biome.pathScale * (main ? 3.0 + nn * 1.2 : nn < 0.2 ? 1.9 : 2.1 + (nn - 0.2) * 2.0); // more open maps: wider (was main 2.2, pinch 1.3, trail 1.5)
        const ext = hw + CELL;
        const i0 = Math.max(0, Math.floor((px - ext) / CELL));
        const i1 = Math.min(cols - 1, Math.floor((px + ext) / CELL));
        const j0 = Math.max(0, Math.floor((py - ext) / CELL));
        const j1 = Math.min(rows - 1, Math.floor((py + ext) / CELL));
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const d = Math.sqrt((ccx(i) - px) ** 2 + (ccx(j) - py) ** 2);
            const kk = at(i, j);
            const v = hw - d;
            if (v > val[kk]) {
              val[kk] = v;
              own[kk] = main ? -3 : -2;
            }
            if (d < Math.max(hw * 0.55, CELL * 1.05)) core[kk] = 1;
          }
        }
      }
      along += len;
    }
  });

  let solid = new Uint8Array(N);
  for (let k = 0; k < N; k++) solid[k] = val[k] > 0 ? OPEN : WALL;

  // Rock outcrops inside clearings (not on the protected cores).
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = at(i, j);
      if (solid[k] !== OPEN || core[k]) continue;
      if (fbm(ccx(i) / 210, ccx(j) / 210, S + 77) > biome.outcrop) solid[k] = WALL;
    }
  }
  // Fen: pools inside open ground, and much of the deep wall becomes black water.
  if (biome.waterChance > 0) {
    for (let k = 0; k < N; k++) {
      const i = k % cols;
      const j = (k - i) / cols;
      const x = ccx(i);
      const y = ccx(j);
      if (solid[k] === OPEN) {
        if (!core[k] && fbm(x / 260, y / 260, S + 9) > 0.7) solid[k] = WATER;
      } else if (fbm(x / 640, y / 640, S + 5) < biome.waterChance) solid[k] = WATER;
    }
  }
  // Ragged border: always blocked, 3..7 cells thick.
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const e = Math.min(i, j, cols - 1 - i, rows - 1 - j);
      const thick = 3 + Math.floor(vnoise(i / 5 + j / 5, (i - j) / 7, S + 3) * 5);
      if (e < thick) {
        solid[at(i, j)] = WALL;
        core[at(i, j)] = 0;
      }
    }
  }

  // Cellular smoothing (2 passes) for organic edges; cores never close.
  for (let pass = 0; pass < 2; pass++) {
    const next = solid.slice();
    for (let j = 1; j < rows - 1; j++) {
      for (let i = 1; i < cols - 1; i++) {
        const k = at(i, j);
        let blocked = 0;
        let water = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            if (!di && !dj) continue;
            const s = solid[k + dj * cols + di];
            if (s !== OPEN) blocked++;
            if (s === WATER) water++;
          }
        }
        if (solid[k] === OPEN && blocked >= 5 && !core[k]) next[k] = water * 2 > blocked ? WATER : WALL;
        else if (solid[k] !== OPEN && blocked <= 2 && Math.min(i, j, cols - 1 - i, rows - 1 - j) >= 3) next[k] = OPEN;
      }
    }
    solid = next;
  }

  // ---- 4. walkability: 2x2 rule + block-graph connectivity -----------------------------
  const BW = cols - 1;
  const BN = (cols - 1) * (rows - 1);
  const blockOk = (b: number) => {
    const i = b % BW;
    const j = (b - i) / BW;
    const k = at(i, j);
    return solid[k] === OPEN && solid[k + 1] === OPEN && solid[k + cols] === OPEN && solid[k + cols + 1] === OPEN;
  };
  const enforce2x2 = () => {
    for (let it = 0; it < 6; it++) {
      let changed = 0;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = at(i, j);
          if (solid[k] !== OPEN) continue;
          let ok = false;
          for (let dj = -1; dj <= 0 && !ok; dj++) {
            for (let di = -1; di <= 0 && !ok; di++) {
              const bi = i + di;
              const bj = j + dj;
              if (bi < 0 || bj < 0 || bi >= cols - 1 || bj >= rows - 1) continue;
              if (blockOk(bj * BW + bi)) ok = true;
            }
          }
          if (!ok) {
            solid[k] = WALL;
            changed++;
          }
        }
      }
      if (!changed) break;
    }
  };
  const label = new Int32Array(BN);
  const queue = new Int32Array(Math.max(N, BN));
  let compSizes: number[] = [];
  const labelBlocks = () => {
    label.fill(-1);
    compSizes = [];
    for (let b0 = 0; b0 < BN; b0++) {
      if (label[b0] >= 0 || !blockOk(b0)) continue;
      const id = compSizes.length;
      let qh = 0;
      let qt = 0;
      queue[qt++] = b0;
      label[b0] = id;
      let size = 0;
      while (qh < qt) {
        const b = queue[qh++];
        size++;
        const i = b % BW;
        const j = (b - i) / BW;
        const nb = [i > 0 ? b - 1 : -1, i < BW - 1 ? b + 1 : -1, j > 0 ? b - BW : -1, j < rows - 2 ? b + BW : -1];
        for (const n of nb) {
          if (n < 0 || label[n] >= 0 || !blockOk(n)) continue;
          label[n] = id;
          queue[qt++] = n;
        }
      }
      compSizes.push(size);
    }
  };
  const mainCells = (comp: number) => {
    const m = new Uint8Array(N);
    for (let b = 0; b < BN; b++) {
      if (label[b] !== comp) continue;
      const i = b % BW;
      const j = (b - i) / BW;
      const k = at(i, j);
      m[k] = m[k + 1] = m[k + cols] = m[k + cols + 1] = 1;
    }
    return m;
  };
  const prev = new Int32Array(N);
  const carveToMain = (comp: number, main: Uint8Array) => {
    prev.fill(-2);
    let qh = 0;
    let qt = 0;
    for (let b = 0; b < BN; b++) {
      if (label[b] !== comp) continue;
      const i = b % BW;
      const j = (b - i) / BW;
      const k = at(i, j);
      if (prev[k] === -2) {
        prev[k] = -1;
        queue[qt++] = k;
      }
    }
    let hit = -1;
    while (qh < qt && hit < 0) {
      const k = queue[qh++];
      const i = k % cols;
      const j = (k - i) / cols;
      const nb = [i > 3 ? k - 1 : -1, i < cols - 4 ? k + 1 : -1, j > 3 ? k - cols : -1, j < rows - 4 ? k + cols : -1];
      for (const n of nb) {
        if (n < 0 || prev[n] !== -2) continue;
        prev[n] = k;
        if (main[n]) {
          hit = n;
          break;
        }
        queue[qt++] = n;
      }
    }
    for (let k = hit; k >= 0; k = prev[k]) {
      const i = k % cols;
      const j = (k - i) / cols;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) solid[at(i + di, j + dj)] = OPEN;
    }
  };
  enforce2x2();
  for (let iter = 0; iter < 12; iter++) {
    labelBlocks();
    let mainC = 0;
    for (let c = 1; c < compSizes.length; c++) if (compSizes[c] > compSizes[mainC]) mainC = c;
    const big = compSizes.map((s, c) => (c !== mainC && s >= 10 ? c : -1)).filter((c) => c >= 0);
    if (!big.length) {
      // Fill every open cell outside the main component.
      const m = mainCells(mainC);
      for (let k = 0; k < N; k++) if (solid[k] === OPEN && !m[k]) solid[k] = WALL;
      break;
    }
    const m = mainCells(mainC);
    for (const c of big) carveToMain(c, m);
    enforce2x2();
  }

  // ---- distance fields ----------------------------------------------------------------
  const clear = new Uint8Array(N);
  {
    const dist = new Int32Array(N).fill(-1);
    let qh = 0;
    let qt = 0;
    for (let k = 0; k < N; k++) {
      if (solid[k] !== OPEN) {
        dist[k] = 0;
        queue[qt++] = k;
      }
    }
    while (qh < qt) {
      const k = queue[qh++];
      const i = k % cols;
      const j = (k - i) / cols;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          const n = nj * cols + ni;
          if (dist[n] >= 0) continue;
          dist[n] = dist[k] + 1;
          queue[qt++] = n;
        }
      }
    }
    for (let k = 0; k < N; k++) clear[k] = Math.min(255, dist[k] < 0 ? 255 : dist[k]);
  }
  const nearestOpen = new Int32Array(N).fill(-1);
  {
    let qh = 0;
    let qt = 0;
    const seen = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (solid[k] === OPEN) {
        seen[k] = 1;
        nearestOpen[k] = k;
        queue[qt++] = k;
      }
    }
    while (qh < qt) {
      const k = queue[qh++];
      const i = k % cols;
      const j = (k - i) / cols;
      const nb = [i > 0 ? k - 1 : -1, i < cols - 1 ? k + 1 : -1, j > 0 ? k - cols : -1, j < rows - 1 ? k + cols : -1];
      for (const n of nb) {
        if (n < 0 || seen[n]) continue;
        seen[n] = 1;
        nearestOpen[n] = nearestOpen[k];
        queue[qt++] = n;
      }
    }
    for (let k = 0; k < N; k++) if (solid[k] === OPEN) nearestOpen[k] = -1;
  }
  let openCells = 0;
  for (let k = 0; k < N; k++) if (solid[k] === OPEN) openCells++;
  const openArea = openCells * CELL * CELL;

  const cellOf = (x: number, y: number) => {
    const i = Math.floor(x / CELL);
    const j = Math.floor(y / CELL);
    if (i < 0 || j < 0 || i >= cols || j >= rows) return -1;
    return j * cols + i;
  };
  const clearAt = (x: number, y: number) => {
    const k = cellOf(x, y);
    return k < 0 ? 0 : clear[k];
  };
  const center = { x: clearings[0].x, y: clearings[0].y };
  const dangerAt = (x: number, y: number) => baseDanger({ w, h, center }, x, y);

  // Snap clearing centres onto roomy open cells.
  for (const c of clearings) {
    let bk = -1;
    let bs = -Infinity;
    const ci = Math.floor(c.x / CELL);
    const cj = Math.floor(c.y / CELL);
    for (let dj = -6; dj <= 6; dj++) {
      for (let di = -6; di <= 6; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const k = at(i, j);
        if (solid[k] !== OPEN) continue;
        const s = Math.min(clear[k], 6) * 10 - (di * di + dj * dj);
        if (s > bs) {
          bs = s;
          bk = k;
        }
      }
    }
    if (bk < 0 || clear[bk] < 2) {
      c.role = "dead";
      continue;
    }
    c.x = ccx(bk % cols);
    c.y = ccx(Math.floor(bk / cols));
    c.danger = Math.max(c.danger, dangerAt(c.x, c.y));
  }
  center.x = clearings[0].x;
  center.y = clearings[0].y;

  // ---- 5. roles / POIs ----------------------------------------------------------------
  const pois: Poi[] = [];
  const addPoi = (kind: PoiKind, x: number, y: number, r: number, danger: number) => {
    const p = { id: pois.length, kind, x: Math.round(x), y: Math.round(y), r, danger: Math.round(danger * 100) / 100 };
    pois.push(p);
    return p;
  };
  const live = clearings.filter((c) => c.role !== "dead");
  // Lairs: dead ends away from the centre are more dangerous and more rewarding.
  for (const c of live) {
    if (c.role === "none" && c.deg === 1 && c.danger < 0.6 && rng() < 0.55) {
      c.role = "lair";
      c.danger = Math.min(1, c.danger + 0.35);
    }
  }
  const farthest = (cands: Clearing[], count: number, minD: number, avoid: { x: number; y: number }[], avoidD: number) => {
    const chosen: Clearing[] = [];
    const pool = cands.filter((c) => avoid.every((a) => (a.x - c.x) ** 2 + (a.y - c.y) ** 2 >= avoidD * avoidD));
    if (!pool.length) return chosen;
    // Start from the candidate farthest from the centre (deterministic).
    let first = pool[0];
    for (const c of pool) if ((c.x - center.x) ** 2 + (c.y - center.y) ** 2 > (first.x - center.x) ** 2 + (first.y - center.y) ** 2) first = c;
    chosen.push(first);
    while (chosen.length < count) {
      let best: Clearing | null = null;
      let bd = -1;
      for (const c of pool) {
        if (chosen.includes(c)) continue;
        let md = Infinity;
        for (const o of chosen) md = Math.min(md, (o.x - c.x) ** 2 + (o.y - c.y) ** 2);
        if (md > bd) {
          bd = md;
          best = c;
        }
      }
      if (!best || bd < minD * minD) break;
      chosen.push(best);
    }
    return chosen;
  };
  // Spawns: spread across the calmer outer ring.
  const spawnWant = Math.max(8, Math.min(40, players * 2));
  let spawnCands = live.filter((c) => c.role === "none" && c.danger < 0.6);
  if (spawnCands.length < spawnWant) spawnCands = live.filter((c) => c.role === "none" || c.role === "lair");
  const spawnCl = farthest(spawnCands, spawnWant, 800, [], 0);
  for (const c of spawnCl) c.role = "spawn";
  // Trial shrines: mid danger, spread, away from spawns.
  const trialWant = 3 + Math.round((3 * (players - MAPGEN.minPlayers)) / (MAPGEN.maxPlayers - MAPGEN.minPlayers));
  let trialCands = live.filter((c) => c.role === "none" && c.danger >= 0.25 && c.danger <= 0.85);
  if (trialCands.length < trialWant) trialCands = live.filter((c) => c.role === "none");
  const trialCl = farthest(trialCands, trialWant, 0, spawnCl, 700);
  for (const c of trialCl) c.role = "trial";
  // Ruins: only clearings with room for a walled yard.
  for (const c of live) if (c.role === "none" && c.R >= 380 && rng() < biome.ruinChance * 1.6) c.role = "ruin";

  // ---- themes: every clearing is a kind of place (ground, dressing, landmarks, map colour) ------
  {
    const adj: number[][] = clearings.map(() => []);
    for (const [a, b] of edges) {
      adj[a].push(b);
      adj[b].push(a);
    }
    for (const c of clearings) c.theme = c.role === "boss" ? ZONE.heart : c.role === "lair" ? ZONE.lair : c.role === "ruin" ? ZONE.ruins : 0;
    const TH_NONE: [number, number][] = [[ZONE.graveyard, 1.3], [ZONE.lumber, 1.3], [ZONE.thicket, 3.5], [ZONE.glade, 2.6]];
    const TH_SPAWN: [number, number][] = [[ZONE.glade, 5], [ZONE.thicket, 3.4], [ZONE.lumber, 0.7], [ZONE.graveyard, 0.4]];
    clearings.forEach((c, ci) => {
      if (c.theme || c.role === "dead") return;
      const table = c.role === "none" ? TH_NONE : TH_SPAWN;
      // Neighbours of the same kind are unlikely, so walking a road changes the scenery.
      const wts = table.map(([z, wt]) => {
        let x = wt;
        for (const n of adj[ci]) if (clearings[n].theme === z) x *= 0.3;
        return x;
      });
      let r = rng() * wts.reduce((a, b) => a + b, 0);
      let pick = table[table.length - 1][0];
      for (let i = 0; i < table.length; i++) {
        r -= wts[i];
        if (r <= 0) {
          pick = table[i][0];
          break;
        }
      }
      c.theme = pick;
    });
    // Every map has at least two graveyards and two logging camps.
    for (const want of [ZONE.graveyard, ZONE.lumber]) {
      let have = 0;
      for (const c of clearings) if (c.theme === want) have++;
      for (const c of clearings) {
        if (have >= 2) break;
        if (c.role === "none" && (c.theme === ZONE.glade || c.theme === ZONE.thicket)) {
          c.theme = want;
          have++;
        }
      }
    }
    for (const c of clearings) if (!c.theme) c.theme = ZONE.thicket;
  }
  const zone = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (solid[k] !== OPEN) continue;
    const o = own[k];
    zone[k] = o >= 0 ? clearings[o].theme : o === -3 ? ZONE.road : ZONE.trail;
  }
  const zoneAt = (x: number, y: number) => {
    const k = cellOf(x, y);
    return k < 0 ? 0 : zone[k];
  };
  const areas: Area[] = [];
  {
    const used: Record<string, number> = {};
    for (const c of clearings) {
      if (c.role === "dead") continue;
      const kind = ZONE_NAMES[c.theme];
      const list = AREA_NAMES[kind];
      let name = "";
      if (list) {
        const n = used[kind] ?? 0;
        used[kind] = n + 1;
        // Names never repeat on one map; landmarks past the list stay unnamed.
        if (n < list.length) name = list[(n + (seed & 7)) % list.length];
      }
      areas.push({ id: areas.length, kind, x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.R), name });
    }
  }

  const heart = clearings[0];
  addPoi("boss", heart.x, heart.y, 420, 1);
  for (const c of spawnCl) addPoi("spawn", c.x, c.y, 260, c.danger);
  for (const c of trialCl) addPoi("trial", c.x, c.y, 240, c.danger);
  for (const c of live) {
    if (c.role === "ruin") addPoi("ruin", c.x, c.y, 120, c.danger);
    if (c.role === "lair") addPoi("lair", c.x, c.y, 200, c.danger);
  }

  // ---- obstacles: props first need a reservation map ------------------------------------
  const obstacles: MapObstacle[] = [];
  const reserved: { x: number; y: number; r: number }[] = [];
  const isReserved = (x: number, y: number, r: number) => reserved.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < (q.r + r) ** 2);
  for (const p of pois) reserved.push({ x: p.x, y: p.y, r: p.kind === "ruin" ? 40 : p.r });

  // Heart: the old rune monolith in the middle of the arena.
  obstacles.push({ x: heart.x, y: heart.y, r: 52, k: "shrine", v: 0 });

  // Camps -----------------------------------------------------------------------------
  const camps: CampSpot[] = [];
  const campSet = new PointSet(MAPGEN.campSpacing);
  const spawnSet = new PointSet(MAPGEN.spawnCampClearance);
  for (const c of spawnCl) spawnSet.add(c.x, c.y);
  const trialSet = new PointSet(400);
  for (const c of trialCl) trialSet.add(c.x, c.y);
  const addCamp = (x: number, y: number, tier: 0 | 1 | 2) => {
    camps.push({ id: camps.length, x: Math.round(x), y: Math.round(y), tier, danger: Math.round(dangerAt(x, y) * 100) / 100 });
    campSet.add(x, y);
    reserved.push({ x, y, r: 210 });
  };
  // Boss camp beside the monolith.
  for (const [dx, dy] of DIR8) {
    const x = heart.x + dx * 300;
    const y = heart.y + dy * 300;
    if (clearAt(x, y) >= 3) {
      addCamp(x, y, 2);
      break;
    }
  }
  for (const c of live) if (c.role === "lair") addCamp(c.x, c.y, 1);
  // The place is the camp: graveyards, ruins and logging camps hold a pack at their centre, and so do
  // most other clearings nobody spawns in. Tougher packs sit deeper in.
  for (const c of live) {
    if (c.role !== "none" && c.role !== "ruin") continue;
    if (campSet.near(c.x, c.y, MAPGEN.campSpacing) || spawnSet.near(c.x, c.y, MAPGEN.spawnCampClearance) || trialSet.near(c.x, c.y, 380)) continue;
    const landmark = c.theme === ZONE.graveyard || c.theme === ZONE.ruins || c.theme === ZONE.lumber;
    if (!landmark && rng() < 0.3) continue;
    addCamp(c.x, c.y, c.danger > 0.62 && rng() < 0.55 ? 1 : 0 /* was 0.68: open maps put fewer camps deep in */);
  }
  {
    // (campArea was tuned for how many camps the old, wider corridors could hold; keep that count.)
    const want = Math.max(8, Math.round(openArea / (MAPGEN.campArea * 1.4)), Math.round(players * MAPGEN.campsPerPlayer));
    const cand: number[] = [];
    for (let k = 0; k < N; k++) if (solid[k] === OPEN && clear[k] >= 2) cand.push(k);
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = cand[i];
      cand[i] = cand[j];
      cand[j] = t;
    }
    for (const k of cand) {
      if (camps.length >= want) break;
      const x = ccx(k % cols) + (rng() - 0.5) * 32;
      const y = ccx(Math.floor(k / cols)) + (rng() - 0.5) * 32;
      if (campSet.near(x, y, MAPGEN.campSpacing)) continue;
      if (spawnSet.near(x, y, MAPGEN.spawnCampClearance)) continue;
      if (trialSet.near(x, y, 380)) continue;
      const dg = dangerAt(x, y);
      addCamp(x, y, dg > 0.62 && rng() < 0.55 ? 1 : 0 /* was 0.68 */);
    }
  }
  // Guarded buff shrines + strongbox-style chests at some camps (rewarding, contested).
  const chestSet = new PointSet(300);
  const addChest = (x: number, y: number, danger: number) => {
    if (chestSet.near(x, y, 300)) return;
    chestSet.add(x, y);
    addPoi("chest", x, y, 60, danger);
  };
  for (const cp of camps) {
    if (cp.tier >= 1) {
      // Chest beside the pack.
      for (const [dx, dy] of DIR8) {
        const x = cp.x + dx * 110;
        const y = cp.y + dy * 110;
        if (clearAt(x, y) >= 2) {
          addChest(x, y, cp.danger);
          break;
        }
      }
    }
  }
  // Buff shrines: 3-8 per map (scaled with players / size), beside normal packs, spread out and
  // well away from spawns. Monsters read getPois("buff") to guard them.
  {
    const wantBuff = 3 + Math.round((5 * (players - 2)) / 18);
    const buffGap = side / (1.6 * Math.sqrt(wantBuff));
    const buffSet = new PointSet(500);
    const order = camps.filter((cp) => cp.tier === 0);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = order[i];
      order[i] = order[j];
      order[j] = t;
    }
    let placed = 0;
    for (const gap of [buffGap, buffGap * 0.6, 0]) {
      for (const cp of order) {
        if (placed >= wantBuff) break;
        if (spawnSet.near(cp.x, cp.y, 1100) || (gap > 0 && buffSet.near(cp.x, cp.y, gap)) || buffSet.near(cp.x, cp.y, 1)) continue;
        for (const [dx, dy] of DIR8) {
          const x = cp.x - dx * 120;
          const y = cp.y - dy * 120;
          if (clearAt(x, y) >= 2) {
            addPoi("buff", x, y, 60, cp.danger);
            reserved.push({ x, y, r: 60 });
            buffSet.add(cp.x, cp.y);
            placed++;
            break;
          }
        }
      }
    }
  }
  for (const p of pois.filter((q) => q.kind === "ruin")) {
    // Beside the yard's pack (the camp sits on the centre).
    for (const [dx, dy] of DIR8) {
      const x = p.x - dx * 130;
      const y = p.y - dy * 130;
      if (clearAt(x, y) >= 2) {
        addChest(x, y, p.danger);
        break;
      }
    }
  }

  // Ruin clusters: broken walls in a loose ring around the ruin POI.
  const propSet = new PointSet(200);
  const propFree = (x: number, y: number, r: number, gap: number) => {
    const cl = clearAt(x, y);
    if (cl * CELL - CELL / 2 < r + 90) return false;
    return !propSet.near(x, y, r + 70 + gap);
  };
  /** Up to n obstacles in a loose ring around a point (kept off reserved ground and walls). */
  const ring = (cx: number, cy: number, n: number, d0: number, d1: number, r0: number, r1: number, k: ObstacleKind, tag?: string) => {
    let placed = 0;
    for (let a = 0; a < n * 8 && placed < n; a++) {
      let ux = rng() * 2 - 1;
      let uy = rng() * 2 - 1;
      const l = Math.sqrt(ux * ux + uy * uy);
      if (l < 0.3 || l > 1) continue;
      ux /= l;
      uy /= l;
      const d = d0 + rng() * (d1 - d0);
      const r = r0 + rng() * (r1 - r0);
      const x = cx + ux * d;
      const y = cy + uy * d;
      if (!propFree(x, y, r, 0) || isReserved(x, y, r + 10)) continue;
      const o: MapObstacle = { x, y, r, k, v: Math.floor(rng() * 8) };
      if (tag) o.tag = tag;
      obstacles.push(o);
      propSet.add(x, y);
      placed++;
    }
    return placed;
  };
  // The heart: a ring of old pillars around the monolith (the boss arena reads from far away).
  for (const [dx, dy] of DIR8) {
    const x = heart.x + dx * 490;
    const y = heart.y + dy * 490;
    if (!propFree(x, y, 30, 0) || isReserved(x, y, 40)) continue;
    obstacles.push({ x, y, r: 30, k: "ruin", v: 0, tag: "pillar" });
    propSet.add(x, y);
  }
  // Landmark dressing per clearing kind (collision props; the small stuff is client scatter).
  for (const c of live) {
    const big = c.R >= 420;
    if (c.theme === ZONE.ruins) {
      // A broken yard: walls in a ring around the pack, one gate arch.
      ring(c.x, c.y, 1, 270, 330, 40, 46, "ruin", "arch");
      ring(c.x, c.y, big ? 6 : 4, 260, big ? 400 : 340, 34, 52, "ruin");
      ring(c.x, c.y, 2, 240, 380, 22, 26, "ruin", "pillar");
    } else if (c.theme === ZONE.graveyard) {
      ring(c.x, c.y, 2, 240, 340, 24, 28, "ruin", "statue");
      ring(c.x, c.y, big ? 4 : 3, 250, big ? 460 : 380, 22, 28, "tree", "deadtree");
    } else if (c.theme === ZONE.lumber) {
      ring(c.x, c.y, 3, 240, 360, 30, 36, "rocks", "woodpile");
      ring(c.x, c.y, 1, 260, 380, 42, 46, "rocks", "cart");
    } else if (c.theme === ZONE.lair) {
      ring(c.x, c.y, 3, 235, 330, 20, 26, "rocks", "grim");
      ring(c.x, c.y, 2, 250, 400, 36, 56, "rocks");
    } else if (c.theme === ZONE.thicket) {
      // Standing timber: cover to weave through, never a wall (the fine check removes sealers).
      ring(c.x, c.y, Math.round((c.R * c.R * 16) / 1e6) + 3 /* more open maps: was R²·30 + 4 */, 140, c.R * 1.05, 26, 42, "tree");
    } else if (c.theme === ZONE.glade) {
      ring(c.x, c.y, 1, c.R * 0.45, c.R * 0.9, 40, 60, "rocks", "stones");
    }
  }
  // Free-standing props on open ground (glades, roads and the heart stay mostly clear).
  {
    const want = Math.round((openArea / 1e6) * biome.propDensity * 1.4);
    for (let a = 0, placed = 0; a < want * 14 && placed < want; a++) {
      const k = Math.floor(rng() * N);
      if (solid[k] !== OPEN || clear[k] < 3) continue;
      const z = zone[k];
      const keep = z === ZONE.heart ? 0 : z === ZONE.glade ? 0.25 : z === ZONE.road ? 0.2 : z === ZONE.graveyard || z === ZONE.lumber ? 0.5 : 1;
      if (rng() >= keep) continue;
      const x = ccx(k % cols) + (rng() - 0.5) * CELL;
      const y = ccx(Math.floor(k / cols)) + (rng() - 0.5) * CELL;
      const r = 28 + rng() * 40;
      if (!propFree(x, y, r, 30) || isReserved(x, y, r)) continue;
      const kind = z === ZONE.thicket ? "tree" : z === ZONE.lair ? "rocks" : pickWeighted(biome.propMix, rng());
      const o: MapObstacle = { x, y, r: kind === "tree" ? Math.min(r, 46) : r, k: kind, v: Math.floor(rng() * 8) };
      if (kind === "tree" && z === ZONE.graveyard) o.tag = "deadtree";
      obstacles.push(o);
      propSet.add(x, y);
      placed++;
    }
  }

  // Wall circles: layer 1 on every blocked cell touching open ground (exact centre, covers the
  // cell), layer 2 one cell deeper for thicker forest / cliff silhouettes (art + anti-tunnel).
  const [wr0, wr1] = MAPGEN.wallR;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = at(i, j);
      if (solid[k] === OPEN) continue;
      let near1 = false;
      let near2 = false;
      for (let dj = -2; dj <= 2; dj++) {
        for (let di = -2; di <= 2; di++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          if (solid[nj * cols + ni] !== OPEN) continue;
          if (di >= -1 && di <= 1 && dj >= -1 && dj <= 1) near1 = true;
          else near2 = true;
        }
      }
      const water = solid[k] === WATER;
      const hv = hashi(i, j, S + 11);
      if (near1) {
        obstacles.push({
          x: ccx(i),
          y: ccx(j),
          r: wr0 + hv * (wr1 - wr0),
          k: water ? "water" : pickWeighted(biome.wallMix, hashi(i, j, S + 12)),
          v: Math.floor(hashi(i, j, S + 13) * 8),
          wall: true,
        });
      } else if (near2 && !water && hv < 0.7) {
        obstacles.push({
          x: ccx(i) + (hashi(i, j, S + 14) - 0.5) * 24,
          y: ccx(j) + (hashi(i, j, S + 15) - 0.5) * 24,
          r: 40 + hashi(i, j, S + 16) * 16,
          k: pickWeighted(biome.wallMix, hashi(i, j, S + 12)),
          v: Math.floor(hashi(i, j, S + 13) * 8),
          wall: true,
        });
      }
    }
  }

  const spawns = spawnCl.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) }));
  const map: GameMap = {
    params: { seed, players, biome: biome.id },
    seed,
    players,
    biome,
    w,
    h,
    cell: CELL,
    cols,
    rows,
    solid,
    zone,
    areas,
    roads,
    clear,
    nearestOpen,
    obstacles,
    grid: new StaticCircleGrid(obstacles, w, h, 128),
    pois,
    camps,
    spawns,
    center,
    openArea,
    genMs: 0,
  };

  // ---- 6. fine walkability check: props that seal off ground get removed ----------------
  for (let pass = 0; pass < 3; pass++) {
    const r = reachability(map);
    if (!r.blockers.size) break;
    map.obstacles = map.obstacles.filter((_, i) => !r.blockers.has(i));
    map.grid = new StaticCircleGrid(map.obstacles, w, h, 128);
  }
  map.genMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  return map;
}

/** Fine (32 px) walkability flood fill from the first spawn using the real collision circles.
 * Returns the reachable fraction of open ground, unreachable key spots and props (non-wall
 * obstacles) next to unreachable open samples. */
export function reachability(map: GameMap, step = 32) {
  const R = MAPGEN.walkerR;
  const sc = Math.ceil(map.w / step);
  const sr = Math.ceil(map.h / step);
  const walk = new Uint8Array(sc * sr);
  const openS = new Uint8Array(sc * sr);
  const cellOf = (x: number, y: number) => Math.floor(y / map.cell) * map.cols + Math.floor(x / map.cell);
  for (let j = 0; j < sr; j++) {
    for (let i = 0; i < sc; i++) {
      const x = (i + 0.5) * step;
      const y = (j + 0.5) * step;
      if (x >= map.w || y >= map.h || map.solid[cellOf(x, y)] !== OPEN) continue;
      openS[j * sc + i] = 1;
      if (!map.grid.overlaps(x, y, R)) walk[j * sc + i] = 1;
    }
  }
  const seen = new Uint8Array(sc * sr);
  const q = new Int32Array(sc * sr);
  let qh = 0;
  let qt = 0;
  const startPt = map.spawns[0] ?? map.center;
  // Nearest walkable sample to the start.
  let s0 = -1;
  for (let rad = 0; rad < 12 && s0 < 0; rad++) {
    const ci = Math.floor(startPt.x / step);
    const cj = Math.floor(startPt.y / step);
    for (let dj = -rad; dj <= rad && s0 < 0; dj++) {
      for (let di = -rad; di <= rad; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i >= 0 && j >= 0 && i < sc && j < sr && walk[j * sc + i]) {
          s0 = j * sc + i;
          break;
        }
      }
    }
  }
  if (s0 >= 0) {
    seen[s0] = 1;
    q[qt++] = s0;
  }
  while (qh < qt) {
    const k = q[qh++];
    const i = k % sc;
    const j = (k - i) / sc;
    const nb = [i > 0 ? k - 1 : -1, i < sc - 1 ? k + 1 : -1, j > 0 ? k - sc : -1, j < sr - 1 ? k + sc : -1];
    for (const n of nb) {
      if (n < 0 || seen[n] || !walk[n]) continue;
      seen[n] = 1;
      q[qt++] = n;
    }
  }
  let open = 0;
  let reach = 0;
  const blockers = new Set<number>();
  for (let k = 0; k < sc * sr; k++) {
    if (!openS[k]) continue;
    open++;
    if (seen[k]) {
      reach++;
      continue;
    }
    if (!walk[k]) continue; // inside / against a circle: fine
    // A walkable open sample we can't reach: some prop seals it. Blame props within reach.
    const i = k % sc;
    const j = (k - i) / sc;
    const x = (i + 0.5) * step;
    const y = (j + 0.5) * step;
    map.grid.forNear(x, y, 140, (o, oi) => {
      if (!o.wall) blockers.add(oi);
    });
  }
  const reachAt = (x: number, y: number) => {
    const ci = Math.floor(x / step);
    const cj = Math.floor(y / step);
    for (let dj = -3; dj <= 3; dj++) {
      for (let di = -3; di <= 3; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i >= 0 && j >= 0 && i < sc && j < sr && seen[j * sc + i]) return true;
      }
    }
    return false;
  };
  const unreachable: string[] = [];
  map.spawns.forEach((p, i) => reachAt(p.x, p.y) || unreachable.push(`spawn${i}`));
  map.camps.forEach((p) => reachAt(p.x, p.y) || unreachable.push(`camp${p.id}`));
  map.pois.forEach((p) => reachAt(p.x, p.y) || unreachable.push(`${p.kind}${p.id}`));
  // Walkable-but-unreached samples (pockets that a player could never get to).
  let pockets = 0;
  for (let k = 0; k < sc * sr; k++) if (walk[k] && !seen[k]) pockets++;
  return { openSamples: open, reachable: reach, frac: open ? reach / open : 0, pockets, unreachable, blockers };
}
