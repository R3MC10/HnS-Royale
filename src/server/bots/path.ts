// Bot pathfinding: A* over the shared procedural map grid + local obstacle probing (no wall hugging).
// One shared scratch state for every bot (they run one after another on the host's tick).
// Browser-safe (runs in the host's Web Worker): no node:* imports.
import { currentMap, isWalkable, CELL, OPEN, type GameMap } from "../../shared/map";

let mapRef: GameMap | null = null;
let passable: Uint8Array = new Uint8Array(0);
let cost: Float32Array = new Float32Array(0);
function prepMap() {
  const m = currentMap();
  if (m === mapRef) return;
  mapRef = m;
  const N = m.cols * m.rows;
  passable = new Uint8Array(N);
  cost = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    passable[k] = m.solid[k] === OPEN && m.clear[k] >= 1 ? 1 : 0;
    cost[k] = m.clear[k] >= 3 ? 1 : m.clear[k] === 2 ? 1.6 : 3.5; // stay off wall edges
  }
}

const heapK: number[] = [];
const heapF: number[] = [];
function hpush(k: number, f: number) {
  let i = heapK.length;
  heapK.push(k);
  heapF.push(f);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapF[p] <= f) break;
    heapK[i] = heapK[p];
    heapF[i] = heapF[p];
    i = p;
  }
  heapK[i] = k;
  heapF[i] = f;
}
function hpop(): number {
  const top = heapK[0];
  const lk = heapK.pop()!;
  const lf = heapF.pop()!;
  if (heapK.length) {
    let i = 0;
    const n = heapK.length;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && heapF[c + 1] < heapF[c]) c++;
      if (heapF[c] >= lf) break;
      heapK[i] = heapK[c];
      heapF[i] = heapF[c];
      i = c;
    }
    heapK[i] = lk;
    heapF[i] = lf;
  }
  return top;
}

// Neighbour offsets: 4 straight, then 4 diagonal.
const DI = [1, -1, 0, 0, 1, 1, -1, -1];
const DJ = [0, 0, 1, -1, 1, -1, 1, -1];

let gScore = new Float64Array(0);
let came = new Int32Array(0);
let stamp = new Int32Array(0);
let curStamp = 0;

function nearestPassable(k: number): number {
  const m = currentMap();
  if (k >= 0 && passable[k]) return k;
  const ci = k % m.cols;
  const cj = Math.floor(k / m.cols);
  for (let r = 1; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= m.cols || j >= m.rows) continue;
        const kk = j * m.cols + i;
        if (passable[kk]) return kk;
      }
  return -1;
}

/** Node expansions one search may spend before it gives up (the caller then walks straight and retries later). */
const PATH_NODE_BUDGET = 60000;
/** Searches all bots together may start per host tick (the rest wait for a later tick: the host's browser is also rendering). */
const PATHS_PER_TICK = 1;
let pathsLeft = PATHS_PER_TICK;
/** Called once per host tick. */
export function resetPathBudget() {
  pathsLeft = PATHS_PER_TICK;
}
/** True (and one search spent) while this tick's pathfinding budget lasts. */
export function takePathSlot(): boolean {
  if (pathsLeft <= 0) return false;
  pathsLeft--;
  return true;
}

/** World-space waypoints from (sx,sy) to (tx,ty), or null if unreachable within the budget. */
export function findPath(sx: number, sy: number, tx: number, ty: number, budget = PATH_NODE_BUDGET): { x: number; y: number }[] | null {
  prepMap();
  const m = currentMap();
  const N = m.cols * m.rows;
  if (gScore.length !== N) {
    gScore = new Float64Array(N);
    came = new Int32Array(N);
    stamp = new Int32Array(N);
  }
  const cellOf = (x: number, y: number) => Math.max(0, Math.min(m.rows - 1, Math.floor(y / CELL))) * m.cols + Math.max(0, Math.min(m.cols - 1, Math.floor(x / CELL)));
  const s = nearestPassable(cellOf(sx, sy));
  const t = nearestPassable(cellOf(tx, ty));
  if (s < 0 || t < 0) return null;
  curStamp++;
  heapK.length = 0;
  heapF.length = 0;
  const tI = t % m.cols;
  const tJ = Math.floor(t / m.cols);
  const h = (k: number) => {
    const di = Math.abs((k % m.cols) - tI);
    const dj = Math.abs(Math.floor(k / m.cols) - tJ);
    return (Math.max(di, dj) + 0.414 * Math.min(di, dj)) * 1.05;
  };
  stamp[s] = curStamp;
  gScore[s] = 0;
  came[s] = -1;
  hpush(s, h(s));
  let found = false;
  let it = 0;
  while (heapK.length && it++ < budget) {
    const k = hpop();
    if (k === t) {
      found = true;
      break;
    }
    const i = k % m.cols;
    const j = Math.floor(k / m.cols);
    const gk = gScore[k];
    for (let d = 0; d < 8; d++) {
      const di = DI[d];
      const dj = DJ[d];
      const w = d < 4 ? 1 : 1.414;
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= m.cols || nj >= m.rows) continue;
      const nk = nj * m.cols + ni;
      if (!passable[nk]) continue;
      if (di && dj && (!passable[j * m.cols + ni] || !passable[nj * m.cols + i])) continue; // no corner cutting
      const ng = gk + w * cost[nk];
      if (stamp[nk] === curStamp && ng >= gScore[nk]) continue;
      stamp[nk] = curStamp;
      gScore[nk] = ng;
      came[nk] = k;
      hpush(nk, ng + h(nk));
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let k = t; k !== -1; k = came[k]) cells.push(k);
  cells.reverse();
  // Keep every 2nd cell (smooth enough; local steering handles the rest).
  const pts: { x: number; y: number }[] = [];
  for (let n = 1; n < cells.length; n += 2) {
    const k = cells[n];
    pts.push({ x: ((k % m.cols) + 0.5) * CELL, y: (Math.floor(k / m.cols) + 0.5) * CELL });
  }
  pts.push({ x: tx, y: ty });
  return pts;
}

/** Steer: rotate the wanted direction until a short probe ahead is walkable. */
export function steer(x: number, y: number, a: number): number {
  for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5, 2.1, -2.1]) {
    const b = a + off;
    if (isWalkable(x + Math.cos(b) * 34, y + Math.sin(b) * 34, 18) && isWalkable(x + Math.cos(b) * 16, y + Math.sin(b) * 16, 18)) return b;
  }
  return a;
}
