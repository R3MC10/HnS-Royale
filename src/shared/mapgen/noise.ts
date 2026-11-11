// Deterministic RNG + value noise for map generation. Only integer math, floor, multiply and sqrt
// (all exactly specified in JS), so server and every browser produce bit-identical maps.

export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash -> [0, 1). */
export function hashi(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
export function vnoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hashi(ix, iy, s);
  const b = hashi(ix + 1, iy, s);
  const c = hashi(ix, iy + 1, s);
  const d = hashi(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** 3-octave fractal noise in [0, 1). */
export function fbm(x: number, y: number, s: number): number {
  return (vnoise(x, y, s) * 0.57 + vnoise(x * 2.03, y * 2.03, s + 17) * 0.29 + vnoise(x * 4.1, y * 4.1, s + 31) * 0.14);
}
