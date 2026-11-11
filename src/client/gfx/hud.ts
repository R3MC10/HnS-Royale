// HUD art of our own design: a carved-stone bottom panel with a wrought-iron band and spikes,
// iron-ringed glass globes (life / mana) and their sphere-shaded liquid. Everything is rasterized
// once per size into cached canvases.
import { hash2, mixColor, PixBuf, rgba, scaleColor, vnoise } from "./pixel";

const cache = new Map<string, HTMLCanvasElement>();
const memo = (key: string, fn: () => HTMLCanvasElement) => {
  let c = cache.get(key);
  if (!c) {
    c = fn();
    cache.set(key, c);
  }
  return c;
};

const STONE = ["#121115", "#18171c", "#1e1c22", "#25222a", "#2d2a33", "#36323d"].map((c) => rgba(c));
const IRON = ["#09090b", "#16161a", "#24242a", "#36363e", "#4c4c56", "#6a6a76"].map((c) => rgba(c));

/** Bottom panel: carved stone blocks under an iron band with rivets and small spikes. */
export function panelSprite(w: number, h: number): HTMLCanvasElement {
  return memo(`panel|${w}|${h}`, () => {
    const SP = 4; // spike headroom
    const buf = new PixBuf(w, h + SP);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const row = y < h / 2 ? 0 : 1;
        const bx = Math.floor((x + row * 13) / 26);
        const lx = (x + row * 13) % 26;
        const ly = y - row * Math.floor(h / 2);
        let i = 2 + Math.floor(vnoise(x / 5, y / 3, 3) * 2.2 + (hash2(x, y, 4) - 0.5) * 1.2) + (hash2(bx, row, 5) > 0.6 ? 1 : 0);
        if (lx === 0 || ly === 0) i = 0; // seams
        else if (lx === 1 || ly === 1) i += 1; // chiselled edge highlight
        else if (lx === 25 || ly === Math.floor(h / 2) - 1) i -= 1;
        if (Math.abs(vnoise(x / 7, y / 7, 6) - 0.5) < 0.02) i -= 2; // cracks
        buf.set(x, y + SP, STONE[Math.max(0, Math.min(5, i))]);
      }
    }
    // Iron band along the top with rivets
    for (let x = 0; x < w; x++) {
      buf.set(x, SP, IRON[0]);
      buf.set(x, SP + 1, IRON[4]);
      buf.set(x, SP + 2, IRON[3]);
      buf.set(x, SP + 3, IRON[2]);
      buf.set(x, SP + 4, IRON[0]);
      buf.set(x, SP + h - 1, IRON[0]);
    }
    for (let x = 8; x < w - 4; x += 20) {
      buf.set(x, SP + 2, IRON[5]);
      buf.set(x + 1, SP + 2, IRON[4]);
      buf.set(x + 1, SP + 3, IRON[0]);
    }
    // Spikes rising from the band
    for (let x = 18; x < w - 10; x += 40) {
      for (let k = 0; k < SP; k++) {
        const half = Math.floor((SP - k) / 2);
        for (let dx = -half; dx <= half; dx++) buf.set(x + dx, SP - 1 - k + 1, dx < 0 ? IRON[4] : IRON[2]);
      }
      buf.set(x, 0, IRON[5]);
    }
    // Side edges
    for (let y = SP; y < h + SP; y++) {
      buf.set(0, y, IRON[0]);
      buf.set(1, y, IRON[3]);
      buf.set(w - 1, y, IRON[0]);
      buf.set(w - 2, y, IRON[1]);
    }
    return buf.toCanvas();
  });
}
export const PANEL_SPIKE = 4;

/** Iron ring with rivets, a crest of three thorns on top and a glass glint (centre at r+5, r+8). */
export function globeFrame(r: number): HTMLCanvasElement {
  return memo(`gframe|${r}`, () => {
    const W = r * 2 + 11;
    const H = r * 2 + 14;
    const cx = r + 5;
    const cy = r + 8;
    const buf = new PixBuf(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - cx - 0.5;
        const dy = y + 0.5 - cy - 0.5;
        const d = Math.hypot(dx, dy);
        if (d >= r + 0.5 && d < r + 4.5) {
          const t = d - r - 0.5;
          const lit = (-dx - dy) / (d || 1);
          let i = t < 1 || t > 3.2 ? 0 : 2 + Math.round(lit * 1.6);
          if (hash2(x, y, 11) > 0.85) i -= 1;
          buf.set(x, y, IRON[Math.max(0, Math.min(5, i))]);
        }
      }
    }
    // Rivets at the diagonals
    for (const a of [0.785, 2.356, 3.927, 5.498]) {
      const x = Math.round(cx + Math.cos(a) * (r + 2.5));
      const y = Math.round(cy + Math.sin(a) * (r + 2.5));
      buf.set(x, y, IRON[5]);
      buf.set(x + 1, y + 1, IRON[0]);
    }
    // Crest thorns
    for (const [ox, hgt] of [[-4, 4], [0, 7], [4, 4]] as const) {
      for (let k = 0; k < hgt; k++) {
        buf.set(cx + ox, cy - r - 4 - k, k === hgt - 1 ? IRON[5] : IRON[3]);
        if (k < hgt - 2) buf.set(cx + ox + 1, cy - r - 4 - k, IRON[1]);
      }
    }
    // Glass glint (upper left)
    const glint = rgba("#ffffff", 150);
    const glint2 = rgba("#ffffff", 70);
    for (let a = 3.6; a < 4.5; a += 0.08) {
      buf.set(Math.round(cx + Math.cos(a) * (r - 3)), Math.round(cy + Math.sin(a) * (r - 3)), glint);
      buf.set(Math.round(cx + Math.cos(a) * (r - 4)), Math.round(cy + Math.sin(a) * (r - 4)), glint2);
    }
    buf.set(cx - Math.round(r * 0.25), cy - Math.round(r * 0.55), glint);
    return buf.toCanvas();
  });
}

/** Sphere-shaded liquid filling a circle of radius r (size 2r+1), base colour with depth swirl. */
export function globeLiquid(r: number, base: string, dim = 1): HTMLCanvasElement {
  return memo(`gliq|${r}|${base}|${dim}`, () => {
    const S = r * 2 + 1;
    const buf = new PixBuf(S, S);
    const c = scaleColor(rgba(base), dim);
    const ramp = [scaleColor(c, 0.25), scaleColor(c, 0.45), scaleColor(c, 0.7), c, mixColor(c, rgba("#ffffff"), 0.3)];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (x - r) / r;
        const dy = (y - r) / r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        const lit = -dx * 0.45 - dy * 0.5 + nz * 0.75;
        const swirl = vnoise(x / 4, y / 3, 21) * 0.5;
        const q = lit * 3 + swirl + ((x + y) & 1) * 0.35;
        buf.set(x, y, ramp[Math.max(0, Math.min(4, Math.floor(q)))]);
      }
    }
    return buf.toCanvas();
  });
}

/** Dark empty interior behind the liquid. */
export function globeBack(r: number): HTMLCanvasElement {
  return memo(`gback|${r}`, () => {
    const S = r * 2 + 1;
    const buf = new PixBuf(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - r, y - r) / r;
        if (d <= 1) buf.set(x, y, rgba(d > 0.8 ? "#050405" : (x + y) % 2 ? "#0b090c" : "#0e0b0f"));
      }
    return buf.toCanvas();
  });
}
