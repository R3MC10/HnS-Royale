// Low-level pixel helpers: an RGBA pixel buffer with crisp (non-antialiased) primitives,
// colour ramps and the selective-outline pass used by every generated sprite.

export type Ramp = [number, number, number, number]; // dark, mid, light, highlight (packed ABGR)

export function rgba(hex: string, a = 255): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
export function unpack(c: number): [number, number, number, number] {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];
}
export function pack(r: number, g: number, b: number, a = 255): number {
  return ((a << 24) | (Math.max(0, Math.min(255, b)) << 16) | (Math.max(0, Math.min(255, g)) << 8) | Math.max(0, Math.min(255, r))) >>> 0;
}
export function scaleColor(c: number, f: number): number {
  const [r, g, b, a] = unpack(c);
  return pack(Math.round(r * f), Math.round(g * f), Math.round(b * f), a);
}
export function mixColor(c1: number, c2: number, t: number): number {
  const a = unpack(c1);
  const b = unpack(c2);
  return pack(
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  );
}
export function cssColor(c: number): string {
  const [r, g, b, a] = unpack(c);
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}

/** Ramp from 4 hex colours (dark -> highlight). */
export function ramp(d: string, m: string, l: string, h: string): Ramp {
  return [rgba(d), rgba(m), rgba(l), rgba(h)];
}
/** Ramp built from one base colour. */
export function rampFrom(hex: string): Ramp {
  const c = rgba(hex);
  return [scaleColor(c, 0.55), scaleColor(c, 0.8), c, mixColor(c, rgba("#ffffff"), 0.35)];
}

// Light comes from the upper left, slightly toward the viewer.
const LX = -0.55;
const LY = -0.62;
const LZ = 0.56;

export function shadeIndex(nx: number, ny: number, nz: number, bias = 0): number {
  const l = nx * LX + ny * LY + nz * LZ + bias;
  return l > 0.8 ? 3 : l > 0.42 ? 2 : l > 0.05 ? 1 : 0;
}

export class PixBuf {
  readonly data: Uint32Array;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint32Array(w * h);
  }
  set(x: number, y: number, c: number) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  /** Blend a colour over the existing pixel. */
  blend(x: number, y: number, c: number) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    const a = (c >>> 24) / 255;
    if (a >= 1 || this.data[i] >>> 24 === 0) {
      this.data[i] = a >= 1 ? c : c;
      return;
    }
    this.data[i] = mixColor(this.data[i], (c | 0xff000000) >>> 0, a);
  }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  }

  /** Shaded capsule between two screen points. `dither` gives a mail/scale texture. */
  capsule(ax: number, ay: number, bx: number, by: number, r: number, rp: Ramp, opts: { dither?: boolean; bias?: number; flat?: number } = {}) {
    r = Math.max(0.7, r);
    const x0 = Math.floor(Math.min(ax, bx) - r - 1);
    const x1 = Math.ceil(Math.max(ax, bx) + r + 1);
    const y0 = Math.floor(Math.min(ay, by) - r - 1);
    const y1 = Math.ceil(Math.max(ay, by) + r + 1);
    const dx = bx - ax;
    const dy = by - ay;
    const ll = dx * dx + dy * dy || 1e-6;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let t = ((px - ax) * dx + (py - ay) * dy) / ll;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = ax + dx * t;
        const cy = ay + dy * t;
        const ox = (px - cx) / r;
        const oy = (py - cy) / r;
        const d2 = ox * ox + oy * oy;
        if (d2 > 1) continue;
        let idx: number;
        if (opts.flat !== undefined) idx = opts.flat;
        else idx = shadeIndex(ox, oy, Math.sqrt(1 - d2), opts.bias ?? 0);
        if (opts.dither && ((x + y) & 1) === 0 && idx > 0) idx -= 1;
        this.set(x, y, rp[idx]);
      }
    }
  }

  sphere(cx: number, cy: number, r: number, rp: Ramp, opts: { dither?: boolean; bias?: number; ry?: number } = {}) {
    const ry = opts.ry ?? r;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const ox = (x + 0.5 - cx) / r;
        const oy = (y + 0.5 - cy) / ry;
        const d2 = ox * ox + oy * oy;
        if (d2 > 1) continue;
        let idx = shadeIndex(ox, oy, Math.sqrt(1 - d2), opts.bias ?? 0);
        if (opts.dither && ((x + y) & 1) === 0 && idx > 0) idx -= 1;
        this.set(x, y, rp[idx]);
      }
    }
  }

  /** Flat-filled polygon (convex or simple), pixel centres. */
  poly(pts: [number, number][], c: number) {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const py = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) xs.push(a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
      }
    }
  }

  line(ax: number, ay: number, bx: number, by: number, c: number) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let i = 0; i <= n; i++) this.set(Math.floor(ax + ((bx - ax) * i) / n), Math.floor(ay + ((by - ay) * i) / n), c);
  }

  /** Selective outline: every empty pixel touching the sprite gets a darkened copy of its neighbour. */
  outline(dark = 0.32, minAlpha = 200) {
    const { w, h, data } = this;
    const src = data.slice();
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 >= minAlpha;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] >>> 24 !== 0) continue;
        let n = -1;
        if (op(x, y + 1)) n = src[(y + 1) * w + x];
        else if (op(x - 1, y)) n = src[y * w + x - 1];
        else if (op(x + 1, y)) n = src[y * w + x + 1];
        else if (op(x, y - 1)) n = src[(y - 1) * w + x];
        if (n !== -1) data[y * w + x] = (scaleColor(n, dark) | 0xff000000) >>> 0;
      }
    }
  }

  /** Copy with every opaque pixel tinted toward a colour (hit flash, silhouettes). */
  tinted(c: number, t: number): PixBuf {
    const out = new PixBuf(this.w, this.h);
    for (let i = 0; i < this.data.length; i++) {
      const p = this.data[i];
      if (p >>> 24 === 0) continue;
      out.data[i] = (mixColor(p, c, t) & 0x00ffffff) | (p & 0xff000000);
    }
    return out;
  }

  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement("canvas");
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

/** A cached sprite: canvas + anchor (the foot point). */
export interface Sprite {
  cv: HTMLCanvasElement;
  ax: number; // anchor in canvas px
  ay: number;
  /** Canvas px per screen unit (smooth high-res sprites); 1 when absent. */
  d?: number;
}

export function sprite(buf: PixBuf, ax: number, ay: number): Sprite {
  return { cv: buf.toCanvas(), ax, ay };
}

/** Seeded PRNG. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash -> [0,1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise. */
export function vnoise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---- crisp drawing on a 2D context (integer rectangles only) -------------------

/** Filled or outlined pixel ellipse (no antialiasing). `dither` draws every other pixel. */
export function pxEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, fill: string | null, stroke: string | null, dither = false) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  if (rx < 1 || ry < 1) return;
  const rows = Math.ceil(ry);
  let prevHw = 0;
  for (let j = -rows; j <= rows; j++) {
    const t = 1 - (j * j) / (ry * ry);
    if (t < 0) continue;
    const hw = Math.round(rx * Math.sqrt(t));
    if (fill) {
      ctx.fillStyle = fill;
      if (dither) {
        for (let x = -hw; x <= hw; x++) if (((x + j) & 1) === 0) ctx.fillRect(cx + x, cy + j, 1, 1);
      } else ctx.fillRect(cx - hw, cy + j, hw * 2 + 1, 1);
    }
    if (stroke) {
      ctx.fillStyle = stroke;
      const span = Math.max(1, Math.abs(hw - prevHw));
      if (!dither || (j & 1) === 0) {
        ctx.fillRect(cx - hw, cy + j, Math.min(span, hw + 1), 1);
        ctx.fillRect(cx + hw - Math.min(span, hw + 1) + 1, cy + j, Math.min(span, hw + 1), 1);
      }
    }
    prevHw = hw;
  }
}

/** 1px line on a 2D context. */
export function pxLine(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, color: string, w = 1) {
  ctx.fillStyle = color;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(ax + ((bx - ax) * i) / n), Math.round(ay + ((by - ay) * i) / n), w, w);
}

/**
 * Per-frame budget for generating new sprite frames. Frames are built lazily and cached; when
 * many new looks appear at once, callers fall back to an already cached neighbour frame once the
 * budget is spent, so a crowd never causes a long hitch.
 */
export const frameBudget = { until: Infinity };
export function startFrameBudget(ms: number) {
  frameBudget.until = performance.now() + ms;
}
export function canBuild() {
  return performance.now() < frameBudget.until;
}
