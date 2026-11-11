// Smooth per-map fields for the look of the world: how strongly a point belongs to each kind of
// place (glade, graveyard, ruins ...) and how trodden it is (the real roads and trails between
// clearings). Pure functions of the shared map, so every client paints the same ground.
import { CELL, currentMap, mapVersion, OPEN } from "../../shared/map";

/** Path field resolution (world px per sample). */
const PR = 32;

let ver = -1;
let cols = 0;
let rows = 0;
let weights: Uint8Array[] = [];
let pcols = 0;
let prows = 0;
let path = new Uint8Array(0);

function build() {
  const m = currentMap();
  ver = mapVersion();
  cols = m.cols;
  rows = m.rows;
  const N = cols * rows;
  // Zone weights: the cell's own zone, box-blurred twice so borders blend over about two cells.
  weights = [];
  const tmp = new Float32Array(N);
  const cur = new Float32Array(N);
  for (let z = 0; z < 10; z++) {
    let any = false;
    for (let k = 0; k < N; k++) {
      cur[k] = m.solid[k] === OPEN && m.zone[k] === z ? 1 : 0;
      if (cur[k]) any = true;
    }
    const out = new Uint8Array(N);
    if (any && z > 0) {
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            let s = 0;
            for (let b = -1; b <= 1; b++) {
              const jj = j + b;
              if (jj < 0 || jj >= rows) continue;
              for (let a = -1; a <= 1; a++) {
                const ii = i + a;
                if (ii >= 0 && ii < cols) s += cur[jj * cols + ii];
              }
            }
            tmp[j * cols + i] = s / 9;
          }
        cur.set(tmp);
      }
      for (let k = 0; k < N; k++) out[k] = Math.round(cur[k] * 255);
    }
    weights.push(out);
  }
  // Path strength: distance to the nearest road / trail centre line, main roads wider and stronger.
  pcols = Math.ceil(m.w / PR) + 1;
  prows = Math.ceil(m.h / PR) + 1;
  path = new Uint8Array(pcols * prows);
  for (const rd of m.roads) {
    const half = rd.main ? 135 : 78;
    const top = rd.main ? 255 : 200;
    for (let s = 1; s < rd.pts.length; s++) {
      const [ax, ay] = rd.pts[s - 1];
      const [bx, by] = rd.pts[s];
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - half) / PR));
      const i1 = Math.min(pcols - 1, Math.ceil((Math.max(ax, bx) + half) / PR));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - half) / PR));
      const j1 = Math.min(prows - 1, Math.ceil((Math.max(ay, by) + half) / PR));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = i * PR;
          const y = j * PR;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
          const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
          if (d >= half) continue;
          const v = Math.round(top * (1 - d / half));
          const k = j * pcols + i;
          if (v > path[k]) path[k] = v;
        }
    }
  }
}

function sample(a: Uint8Array, w: number, h: number, gx: number, gy: number) {
  if (gx < 0) gx = 0;
  else if (gx > w - 1.001) gx = w - 1.001;
  if (gy < 0) gy = 0;
  else if (gy > h - 1.001) gy = h - 1.001;
  const i = Math.floor(gx);
  const j = Math.floor(gy);
  const fx = gx - i;
  const fy = gy - j;
  const k = j * w + i;
  return (a[k] * (1 - fx) * (1 - fy) + a[k + 1] * fx * (1 - fy) + a[k + w] * (1 - fx) * fy + a[k + w + 1] * fx * fy) / 255;
}

/** 0..1: how much the ground at a world point belongs to zone id `z` (shared ZONE). */
export function zoneWeight(x: number, y: number, z: number): number {
  if (ver !== mapVersion()) build();
  return sample(weights[z], cols, rows, x / CELL - 0.5, y / CELL - 0.5);
}

/** 0..1: how trodden the ground is (1 on the centre line of a main road, ~0.8 on a trail). */
export function pathStrength(x: number, y: number): number {
  if (ver !== mapVersion()) build();
  return sample(path, pcols, prows, x / PR, y / PR);
}
