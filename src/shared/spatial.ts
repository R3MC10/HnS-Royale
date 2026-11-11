// Spatial indexes shared by server and client.
//  - StaticCircleGrid: immutable CSR grid over circles (map obstacles), deterministic iteration order.
//  - BucketGrid: cheap rebuild-every-tick grid for moving entities (server interest management,
//    monster separation).

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Immutable uniform grid over circles. Query order is deterministic (cell order, then insertion order). */
export class StaticCircleGrid<T extends Circle> {
  readonly cols: number;
  readonly rows: number;
  readonly maxR: number;
  private start: Int32Array;
  private items: Int32Array;

  constructor(readonly list: readonly T[], readonly w: number, readonly h: number, readonly cell = 128) {
    this.cols = Math.max(1, Math.ceil(w / cell));
    this.rows = Math.max(1, Math.ceil(h / cell));
    let maxR = 0;
    const n = this.cols * this.rows;
    const counts = new Int32Array(n + 1);
    const cellOf = new Int32Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.r > maxR) maxR = o.r;
      const c = this.cellIndex(o.x, o.y);
      cellOf[i] = c;
      counts[c + 1]++;
    }
    this.maxR = maxR;
    for (let i = 0; i < n; i++) counts[i + 1] += counts[i];
    this.start = counts;
    this.items = new Int32Array(list.length);
    const fill = counts.slice(0, n);
    for (let i = 0; i < list.length; i++) this.items[fill[cellOf[i]]++] = i;
  }

  private cellIndex(x: number, y: number) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)));
    return cy * this.cols + cx;
  }

  /** Calls fn(circle, index) for every circle whose centre lies in a cell touching the rect grown by maxR. Return true to stop. */
  forRect(x0: number, y0: number, x1: number, y1: number, fn: (o: T, i: number) => boolean | void): void {
    const m = this.maxR;
    const c0 = Math.max(0, Math.floor((x0 - m) / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor((x1 + m) / this.cell));
    const r0 = Math.max(0, Math.floor((y0 - m) / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor((y1 + m) / this.cell));
    const { start, items, list } = this;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const c = cy * this.cols + cx;
        for (let k = start[c], e = start[c + 1]; k < e; k++) {
          const i = items[k];
          if (fn(list[i], i) === true) return;
        }
      }
    }
  }

  /** Circles that may touch a circle at (x, y) with radius r (candidates; caller does the exact test). */
  forNear(x: number, y: number, r: number, fn: (o: T, i: number) => boolean | void): void {
    this.forRect(x - r, y - r, x + r, y + r, fn);
  }

  /** True if a circle at (x, y, r) overlaps any circle (with extra padding). */
  overlaps(x: number, y: number, r: number, pad = 0): boolean {
    let hit = false;
    this.forNear(x, y, r + pad, (o) => {
      const dx = o.x - x;
      const dy = o.y - y;
      const m = o.r + r + pad;
      if (dx * dx + dy * dy < m * m) {
        hit = true;
        return true;
      }
    });
    return hit;
  }
}

/** Rebuild-per-tick bucket grid for moving entities. */
export class BucketGrid<T extends { x: number; y: number }> {
  private buckets = new Map<number, T[]>();
  constructor(readonly cell: number) {}

  private key(cx: number, cy: number) {
    return (cy + 1024) * 4096 + (cx + 1024);
  }

  clear() {
    this.buckets.clear();
  }

  insert(e: T) {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    let b = this.buckets.get(k);
    if (!b) this.buckets.set(k, (b = []));
    b.push(e);
  }

  /** Every entity in cells touching the circle (x, y, r) (candidates; caller tests distance). */
  forNear(x: number, y: number, r: number, fn: (e: T) => void) {
    const c0 = Math.floor((x - r) / this.cell);
    const c1 = Math.floor((x + r) / this.cell);
    const r0 = Math.floor((y - r) / this.cell);
    const r1 = Math.floor((y + r) / this.cell);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const b = this.buckets.get(this.key(cx, cy));
        if (b) for (const e of b) fn(e);
      }
    }
  }
}
