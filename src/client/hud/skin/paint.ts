// HUD skin painting helpers (skin foundation): procedural painterly textures (stone, grain), 9-slice
// drawing of painted art, bevels and small shape helpers. Everything draws in HUD units on a context
// whose transform maps 1u -> hudScale device px; textures are kept 1:1 with device pixels.
import type { HudArt } from "./assets";
import type { HudRect } from "../types";

/** Device px per HUD unit on this context (its current x scale). */
export function devScale(g: CanvasRenderingContext2D): number {
  const m = g.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

// ---- deterministic value noise -----------------------------------------------------------------

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, s: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const p = (a: number) => ((a % period) + period) % period;
  const a = hash(p(xi), p(yi), s);
  const b = hash(p(xi + 1), p(yi), s);
  const c = hash(p(xi), p(yi + 1), s);
  const d = hash(p(xi + 1), p(yi + 1), s);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** Seamless fractal noise over a size x size tile, 0..1. */
function fbm(x: number, y: number, size: number, s: number): number {
  let v = 0;
  let amp = 0.5;
  let f = 8 / size;
  let per = 8;
  for (let o = 0; o < 4; o++) {
    v += vnoise(x * f, y * f, s + o, per) * amp;
    amp *= 0.5;
    f *= 2;
    per *= 2;
  }
  return v / 0.9375;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const texCache = new Map<string, HTMLCanvasElement>();

/** Seamless 256px painterly stone texture (cold grey-green-brown, mottled, with faint cracks). */
export function stoneTexture(tone: "stone" | "iron" | "leather" = "stone"): HTMLCanvasElement {
  const key = "tex|" + tone;
  let c = texCache.get(key);
  if (c) return c;
  const S = 256;
  c = makeCanvas(S, S);
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  const base = tone === "iron" ? [34, 34, 38] : tone === "leather" ? [44, 32, 24] : [40, 40, 38];
  const tint = tone === "iron" ? [6, 6, 10] : tone === "leather" ? [16, 8, 2] : [4, 8, 2];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const n = fbm(x, y, S, tone === "iron" ? 31 : tone === "leather" ? 47 : 11);
      const m = fbm(x + 97, y + 41, S, 5);
      const crack = Math.abs(fbm(x, y, S, 77) - 0.5) < 0.012 ? -18 : 0;
      const k = 0.55 + n * 0.75;
      const i = (y * S + x) * 4;
      const grain = (hash(x, y, 3) - 0.5) * 10;
      img.data[i] = Math.max(0, base[0] * k + tint[0] * m + grain + crack);
      img.data[i + 1] = Math.max(0, base[1] * k + tint[1] * m * 1.4 + grain + crack);
      img.data[i + 2] = Math.max(0, base[2] * k + tint[2] * m + grain + crack);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  texCache.set(key, c);
  return c;
}

/** Seamless 128px alpha grain (white, low alpha mottling) for overlays on liquid/glass/metal. */
export function grainTexture(): HTMLCanvasElement {
  let c = texCache.get("grain");
  if (c) return c;
  const S = 128;
  c = makeCanvas(S, S);
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const n = fbm(x, y, S, 91);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.max(0, Math.min(255, (n - 0.35) * 240));
    }
  g.putImageData(img, 0, 0);
  texCache.set("grain", c);
  return c;
}

const patCache = new WeakMap<CanvasRenderingContext2D, Map<HTMLCanvasElement | HTMLImageElement, CanvasPattern>>();
/** A repeat pattern of `src`, offset by (ox, oy) HUD units; one texel = `unitsPerTexel` HUD units (default: 1 device px). */
export function texPattern(g: CanvasRenderingContext2D, src: HTMLCanvasElement | HTMLImageElement, ox = 0, oy = 0, unitsPerTexel?: number): CanvasPattern | null {
  let m = patCache.get(g);
  if (!m) {
    m = new Map();
    patCache.set(g, m);
  }
  let p = m.get(src);
  if (!p) {
    p = g.createPattern(src, "repeat") ?? undefined;
    if (!p) return null;
    m.set(src, p);
  }
  const k = unitsPerTexel ?? 1 / devScale(g);
  try {
    p.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy]));
  } catch {
    /* older browsers: unscaled pattern */
  }
  return p;
}

/** Fill a path/rect area with a texture: call after building the path (uses g.fill()). */
export function fillTexture(g: CanvasRenderingContext2D, src: HTMLCanvasElement | HTMLImageElement, alpha = 1, ox = 0, oy = 0, unitsPerTexel?: number) {
  const p = texPattern(g, src, ox, oy, unitsPerTexel);
  if (!p) return;
  const a = g.globalAlpha;
  g.globalAlpha = a * alpha;
  g.fillStyle = p;
  g.fill();
  g.globalAlpha = a;
}

// ---- shapes ---------------------------------------------------------------------------------------

export function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

/** Chamfered (cut-corner) rect path: the carved-stone silhouette. */
export function chamferPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
  const k = Math.max(0, Math.min(c, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + k, y);
  g.lineTo(x + w - k, y);
  g.lineTo(x + w, y + k);
  g.lineTo(x + w, y + h - k);
  g.lineTo(x + w - k, y + h);
  g.lineTo(x + k, y + h);
  g.lineTo(x, y + h - k);
  g.lineTo(x, y + k);
  g.closePath();
}

/** Two-tone bevel stroke around a chamfered rect: light top-left, dark bottom-right. */
export function bevel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number, lw: number, light: string, dark: string) {
  const k = Math.max(0, Math.min(c, w / 2, h / 2));
  const o = lw / 2;
  g.lineWidth = lw;
  g.lineJoin = "miter";
  g.strokeStyle = light;
  g.beginPath();
  g.moveTo(x + o, y + h - k);
  g.lineTo(x + o, y + k);
  g.lineTo(x + k, y + o);
  g.lineTo(x + w - k, y + o);
  g.lineTo(x + w - o, y + k);
  g.stroke();
  g.strokeStyle = dark;
  g.beginPath();
  g.moveTo(x + w - o, y + k);
  g.lineTo(x + w - o, y + h - k);
  g.lineTo(x + w - k, y + h - o);
  g.lineTo(x + k, y + h - o);
  g.lineTo(x + o, y + h - k);
  g.stroke();
}

/** Small domed rivet. */
export function rivet(g: CanvasRenderingContext2D, x: number, y: number, r: number, tone = "#8a7656") {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  gr.addColorStop(0, "#e8d8b0");
  gr.addColorStop(0.35, tone);
  gr.addColorStop(1, "#1a140e");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/** Parse "#rgb"/"#rrggbb" to [r,g,b]. */
export function rgbOf(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((ch) => ch + ch).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Colour with alpha, from hex. */
export function rgba(hex: string, a: number): string {
  if (!hex.startsWith("#")) return hex;
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}
/** Hex colour scaled toward black (k<1) or white (k>1). */
export function shade(hex: string, k: number): string {
  if (!hex.startsWith("#")) return hex;
  const [r, g, b] = rgbOf(hex);
  const f = (v: number) => Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---- painted art ----------------------------------------------------------------------------------

/** Draw painted 9-slice art into a rect; the insets map onto `borderU` HUD units (def.borderU). */
export function drawNine(g: CanvasRenderingContext2D, a: HudArt, r: HudRect, borderU?: number) {
  const img = a.img;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const s = a.slice;
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  if (!s) {
    g.drawImage(img, r.x, r.y, r.w, r.h);
    g.restore();
    return;
  }
  const bu = borderU ?? a.def.borderU ?? 4;
  const unit = bu / Math.max(1, Math.max(s[0], s[1], s[2], s[3]));
  let L = s[0] * unit;
  let T = s[1] * unit;
  let R = s[2] * unit;
  let B = s[3] * unit;
  // Squeeze the borders when the rect is smaller than both borders.
  const fx = Math.min(1, r.w / Math.max(0.001, L + R));
  const fy = Math.min(1, r.h / Math.max(0.001, T + B));
  L *= fx;
  R *= fx;
  T *= fy;
  B *= fy;
  const sx = [0, s[0], W - s[2], W];
  const sy = [0, s[1], H - s[3], H];
  const dx = [r.x, r.x + L, r.x + r.w - R, r.x + r.w];
  const dy = [r.y, r.y + T, r.y + r.h - B, r.y + r.h];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++) {
      const sw = sx[i + 1] - sx[i];
      const sh = sy[j + 1] - sy[j];
      const dw = dx[i + 1] - dx[i];
      const dh = dy[j + 1] - dy[j];
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
      // Slight overlap hides hairline seams between pieces.
      g.drawImage(img, sx[i], sy[j], sw, sh, dx[i], dy[j], dw + (i < 2 ? 0.05 : 0), dh + (j < 2 ? 0.05 : 0));
    }
  g.restore();
}

/** Draw painted art so its anchor lands on (cx, cy) and its radiusPx maps onto r HUD units. */
export function drawAnchored(g: CanvasRenderingContext2D, a: HudArt, cx: number, cy: number, r: number, flipX = false) {
  const k = r / Math.max(1, a.radiusPx);
  const W = a.img.naturalWidth * k;
  const H = a.img.naturalHeight * k;
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  if (flipX) {
    g.translate(cx, 0);
    g.scale(-1, 1);
    g.translate(-cx, 0);
  }
  g.drawImage(a.img, cx - a.anchor[0] * k, cy - a.anchor[1] * k, W, H);
  g.restore();
}
