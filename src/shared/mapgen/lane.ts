// Breachway lane map (docs/MODE-LANES.md section 3): fixed, hand-authored, built in code. Two bases
// joined by one lane band, walls everywhere else. Same GameMap shape as the procedural royale map, so
// collision, rendering and the minimap work unchanged.
import { biomeOf, pickWeighted } from "../biomes";
import { LANE, STRUCT_X } from "../lanes";
import { StaticCircleGrid } from "../spatial";
import { CELL, MAPGEN, OPEN, WALL, ZONE, type GameMap, type MapObstacle, type MapParams } from "./generate";
import { hashi } from "./noise";

export function generateLaneMap(params: MapParams): GameMap {
  const biome = biomeOf(params.biome);
  const w = LANE.w;
  const h = LANE.h;
  const cols = w / CELL;
  const rows = h / CELL;
  const N = cols * rows;
  const S = 7771;
  const solid = new Uint8Array(N).fill(WALL);
  const zone = new Uint8Array(N);
  const ccx = (i: number) => (i + 0.5) * CELL;

  // Open ground: bases (rounded corners) and the lane band with a slightly ragged edge.
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = ccx(i);
      const y = ccx(j);
      const k = j * cols + i;
      const inBase = (bx0: number, bx1: number) => {
        if (x < bx0 || x > bx1 || y < LANE.baseTop || y > LANE.baseBot) return false;
        // round the outer corners a little
        const cx = Math.max(bx0 + 220, Math.min(bx1 - 220, x));
        const cy = Math.max(LANE.baseTop + 220, Math.min(LANE.baseBot - 220, y));
        return Math.hypot(x - cx, y - cy) < 220;
      };
      const rag = (hashi(i, 0, S) - 0.5) * CELL * 1.2;
      const inBand = x >= LANE.baseW - CELL && x <= w - LANE.baseW + CELL && y > LANE.bandTop + rag && y < LANE.bandBot - rag;
      // Trial alcoves: a flattened clearing off the band's top edge (ascendancy trial, shared/lanes.ts LANE.trial).
      const inAlcove = LANE.trial.some((a) => ((x - a.x) / LANE.trialR) ** 2 + ((y - a.y) / 140) ** 2 < 1 + rag / 400);
      // Jungle glades (neutral camps) and the corridor joining each to the band.
      const rag2 = (hashi(i, j, S + 3) - 0.5) * 0.18;
      const inGlade = LANE.glades.some((a) => ((x - a.x) / a.rx) ** 2 + ((y - a.y) / a.ry) ** 2 < 1 + rag2);
      const inPath = LANE.glades.some((a) => Math.abs(x - a.x) < 150 + rag * 0.5 && (a.y < LANE.y ? y > a.y && y < LANE.bandTop + 40 : y < a.y && y > LANE.bandBot - 40));
      if (inBase(CELL * 2, LANE.baseW) || inBase(w - LANE.baseW, w - CELL * 2) || inBand || inAlcove || inGlade || inPath) {
        solid[k] = OPEN;
        zone[k] = Math.abs(y - LANE.y) < 160 ? ZONE.road : inBand ? ZONE.glade : ZONE.heart;
      }
    }
  }

  // Distance fields (same rules as generate.ts).
  const queue = new Int32Array(N);
  const clear = new Uint8Array(N);
  {
    const dist = new Int32Array(N).fill(-1);
    let qh = 0;
    let qt = 0;
    for (let k = 0; k < N; k++) if (solid[k] !== OPEN) {
      dist[k] = 0;
      queue[qt++] = k;
    }
    while (qh < qt) {
      const k = queue[qh++];
      const i = k % cols;
      const j = (k - i) / cols;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const n = nj * cols + ni;
        if (dist[n] >= 0) continue;
        dist[n] = dist[k] + 1;
        queue[qt++] = n;
      }
    }
    for (let k = 0; k < N; k++) clear[k] = Math.min(255, dist[k] < 0 ? 255 : dist[k]);
  }
  const nearestOpen = new Int32Array(N).fill(-1);
  {
    let qh = 0;
    let qt = 0;
    const seen = new Uint8Array(N);
    for (let k = 0; k < N; k++) if (solid[k] === OPEN) {
      seen[k] = 1;
      nearestOpen[k] = k;
      queue[qt++] = k;
    }
    while (qh < qt) {
      const k = queue[qh++];
      const i = k % cols;
      const j = (k - i) / cols;
      for (const n of [i > 0 ? k - 1 : -1, i < cols - 1 ? k + 1 : -1, j > 0 ? k - cols : -1, j < rows - 1 ? k + cols : -1]) {
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

  // Obstacles: wall circles on the edge (as generate.ts), two mid pillars, a few rocks off the lane line.
  const obstacles: MapObstacle[] = [];
  const [wr0, wr1] = MAPGEN.wallR;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (solid[k] === OPEN) continue;
      let near1 = false;
      let near2 = false;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows || solid[nj * cols + ni] !== OPEN) continue;
        if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) near1 = true;
        else near2 = true;
      }
      const hv = hashi(i, j, S + 11);
      if (near1) obstacles.push({ x: ccx(i), y: ccx(j), r: wr0 + hv * (wr1 - wr0), k: pickWeighted(biome.wallMix, hashi(i, j, S + 12)), v: Math.floor(hashi(i, j, S + 13) * 8), wall: true });
      else if (near2 && hv < 0.7)
        obstacles.push({ x: ccx(i) + (hashi(i, j, S + 14) - 0.5) * 24, y: ccx(j) + (hashi(i, j, S + 15) - 0.5) * 24, r: 40 + hashi(i, j, S + 16) * 16, k: pickWeighted(biome.wallMix, hashi(i, j, S + 12)), v: Math.floor(hashi(i, j, S + 13) * 8), wall: true });
    }
  }
  for (const p of LANE.pillars) obstacles.push({ x: p.x, y: p.y, r: 48, k: "ruin", v: 0, tag: "pillar" });
  // Side cover: rocks along the band edges between the spires (never on the lane line or near structures).
  const structXs = Object.values(STRUCT_X).flat();
  for (let n = 0; n < 26; n++) {
    const x = 2600 + hashi(n, 1, S + 20) * (w - 5200);
    const top = hashi(n, 2, S + 21) < 0.5;
    const y = top ? LANE.bandTop + 110 + hashi(n, 3, S + 22) * 90 : LANE.bandBot - 110 - hashi(n, 3, S + 22) * 90;
    if (structXs.some((sx) => Math.abs(sx - x) < 260) || LANE.pillars.some((p) => Math.hypot(p.x - x, p.y - y) < 300)) continue;
    if (top && LANE.trial.some((a) => Math.abs(a.x - x) < LANE.trialR + 80)) continue; // keep the trial alcove mouths open
    if (LANE.glades.some((a) => Math.abs(a.x - x) < 260)) continue; // and the jungle corridors
    obstacles.push({ x, y, r: 30 + hashi(n, 4, S + 23) * 16, k: "rocks", v: Math.floor(hashi(n, 5, S + 24) * 8) });
  }

  const spawns = [LANE.respawn[0], LANE.respawn[1]].map((s) => ({ x: s.x, y: s.y }));
  return {
    params: { seed: params.seed | 0, players: params.players, biome: biome.id, mode: "lanes" },
    seed: params.seed | 0,
    players: params.players,
    biome,
    w,
    h,
    cell: CELL,
    cols,
    rows,
    solid,
    zone,
    areas: [],
    roads: [{ pts: [[LANE.baseW - 200, LANE.y], [w - LANE.baseW + 200, LANE.y]], main: true }],
    clear,
    nearestOpen,
    obstacles,
    grid: new StaticCircleGrid(obstacles, w, h, 128),
    // One trial shrine per team in its alcove (server/progression.ts reads the "trial" points).
    pois: LANE.trial.map((a, i) => ({ id: i, kind: "trial" as const, x: a.x, y: a.y, r: 90, danger: 0.3 })),
    // Jungle camps (spawned and refilled by server/modes/lanes.ts, not by the royale camp populate).
    camps: LANE.glades.map((a, i) => ({ id: i, x: a.x, y: a.y, tier: a.tier, danger: a.tier ? 0.6 : 0.35 })),
    spawns,
    center: { x: w / 2, y: LANE.y },
    openArea: openCells * CELL * CELL,
    genMs: 0,
  };
}
