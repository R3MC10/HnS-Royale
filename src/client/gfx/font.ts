// 5x7 bitmap font (original glyph set), rendered into cached text sprites with a 1px outline.
// Lowercase is drawn as uppercase (small-caps look).

import { tr } from "../i18n";

const G: Record<string, number[]> = {
  // Polish letters (the 5x7 cell is shared with the diacritic)
  "Ą": [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x12, 0x03],
  "Ć": [0x02, 0x04, 0x0e, 0x11, 0x10, 0x11, 0x0e],
  "Ę": [0x1f, 0x10, 0x1e, 0x10, 0x1f, 0x02, 0x03],
  "Ł": [0x10, 0x10, 0x14, 0x18, 0x10, 0x10, 0x1f],
  "Ń": [0x02, 0x04, 0x11, 0x19, 0x15, 0x13, 0x11],
  "Ó": [0x02, 0x04, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  "Ś": [0x02, 0x04, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  "Ź": [0x02, 0x04, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  "Ż": [0x04, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "/": [0, 0x01, 0x02, 0x04, 0x08, 0x10, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "[": [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  "]": [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
  "%": [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  _: [0, 0, 0, 0, 0, 0, 0x1f],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "*": [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
  "·": [0, 0, 0, 0x04, 0, 0, 0],
  "×": [0, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0],
  "°": [0x0c, 0x12, 0x12, 0x0c, 0, 0, 0],
};

interface Glyph {
  rows: number[];
  x0: number; // leftmost used column (0..4)
  w: number;
}
const glyphs = new Map<string, Glyph>();
for (const [ch, rows] of Object.entries(G)) {
  let mask = 0;
  for (const r of rows) mask |= r;
  let x0 = 0;
  let x1 = 4;
  while (x0 < 4 && !(mask & (0x10 >> x0))) x0++;
  while (x1 > x0 && !(mask & (0x10 >> x1))) x1--;
  glyphs.set(ch, { rows, x0, w: mask ? x1 - x0 + 1 : 1 });
}

export const FONT_H = 7;

function glyphFor(ch: string): Glyph | null {
  if (ch === " ") return null;
  const u = ch.toUpperCase();
  return glyphs.get(u) ?? glyphs.get(normalize(u)) ?? glyphs.get("?")!;
}
function normalize(c: string): string {
  if (c === "–" || c === "—") return "-";
  if (c === "’" || c === "‘") return "'";
  if (c === "…") return ".";
  return c;
}

/** Width in pixels of a string (unscaled, without outline). */
export function textWidth(s: string): number {
  s = tr(s);
  let w = 0;
  for (const ch of s) {
    const g = glyphFor(ch);
    w += (g ? g.w : 2) + 1;
  }
  return Math.max(0, w - 1);
}

const cache = new Map<string, HTMLCanvasElement>();

/** Cached text sprite (outlined). Size = textWidth + 2 by FONT_H + 2. */
export function textSprite(s: string, color: string, outline = "#0a0709"): HTMLCanvasElement {
  s = tr(s);
  const key = `${color}|${outline}|${s}`;
  let cv = cache.get(key);
  if (cv) return cv;
  if (cache.size > 1500) cache.clear();
  const w = textWidth(s) + 2;
  const h = FONT_H + 2;
  cv = document.createElement("canvas");
  cv.width = Math.max(1, w);
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const px: [number, number][] = [];
  let x = 1;
  for (const ch of s) {
    const g = glyphFor(ch);
    if (!g) {
      x += 3;
      continue;
    }
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < g.w; c++) if (g.rows[r] & (0x10 >> (c + g.x0))) px.push([x + c, 1 + r]);
    }
    x += g.w + 1;
  }
  if (outline) {
    ctx.fillStyle = outline;
    for (const [a, b] of px) ctx.fillRect(a - 1, b - 1, 3, 3);
  }
  ctx.fillStyle = color;
  for (const [a, b] of px) ctx.fillRect(a, b, 1, 1);
  cache.set(key, cv);
  return cv;
}

export type Align = "left" | "center" | "right";

/** Draw text at integer pixel coords; y is the top of the glyphs. */
export function drawText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = "#e8e2d4", align: Align = "left", scale = 1, outline = "#0a0709") {
  const cv = textSprite(s, color, outline);
  const w = cv.width * scale;
  const dx = align === "left" ? x : align === "center" ? x - Math.floor(w / 2) : x - w;
  ctx.drawImage(cv, Math.round(dx - scale), Math.round(y - scale), w, cv.height * scale);
}

// ---- gothic title face ---------------------------------------------------------------
// Derived from the 5x7 glyphs at double size with calligraphic contrast: vertical strokes are
// two pixels wide, horizontal strokes are one-pixel hairlines, stem tops get a chiselled bevel and
// a left spur, stem feet a small right flick. Filled with a bone-to-blood vertical ramp.

const titleCache = new Map<string, HTMLCanvasElement>();
export const TITLE_H = 14;

export interface TitlePalette {
  top: string;
  mid: string;
  bot: string;
  outline: string;
  shadow: string;
}
export const TITLE_BLOOD: TitlePalette = { top: "#f3dfb4", mid: "#c99a56", bot: "#8c2316", outline: "#0a0506", shadow: "#000000" };
export const TITLE_BONE: TitlePalette = { top: "#f0e6cc", mid: "#b8a888", bot: "#6a5c48", outline: "#0a0708", shadow: "#000000" };
export const TITLE_EMBER: TitlePalette = { top: "#fff0b0", mid: "#ff9a2a", bot: "#a8260c", outline: "#100404", shadow: "#000000" };

export function titleWidth(s: string): number {
  s = tr(s);
  let w = 0;
  for (const ch of s) {
    const g = glyphFor(ch);
    w += (g ? g.w * 2 + 1 : 5) + 2;
  }
  return Math.max(0, w - 2);
}

export function titleSprite(s: string, pal: TitlePalette = TITLE_BLOOD): HTMLCanvasElement {
  s = tr(s);
  const key = `${pal.top}|${pal.bot}|${s}`;
  let cv = titleCache.get(key);
  if (cv) return cv;
  if (titleCache.size > 200) titleCache.clear();
  const W = titleWidth(s) + 6;
  const H = TITLE_H + 6;
  const mask = new Uint8Array(W * H);
  const put = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 1;
  };
  const clear = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) mask[y * W + x] = 0;
  };
  let pen = 3;
  for (const ch of s) {
    const g = glyphFor(ch);
    if (!g) {
      pen += 7;
      continue;
    }
    const on = (c: number, r: number) => r >= 0 && r < 7 && c >= 0 && c < g.w && !!(g.rows[r] & (0x10 >> (c + g.x0)));
    const cuts: [number, number][] = [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < g.w; c++) {
        if (!on(c, r)) continue;
        const x = pen + c * 2;
        const y = 2 + r * 2;
        const vert = on(c, r - 1) || on(c, r + 1);
        if (vert || (!on(c - 1, r) && !on(c + 1, r))) {
          put(x, y);
          put(x + 1, y);
          put(x, y + 1);
          put(x + 1, y + 1);
        } else {
          put(x, y);
          put(x + 1, y);
          if (on(c - 1, r + 1) || on(c + 1, r + 1)) put(x + (on(c + 1, r + 1) ? 1 : 0), y + 1);
        }
        if (on(c, r + 1) && !on(c, r - 1)) {
          put(x - 1, y); // spur
          if (!on(c + 1, r)) cuts.push([x + 1, y]); // chisel bevel
        }
        if (on(c, r - 1) && !on(c, r + 1)) put(x + 2, y + 1); // foot flick
      }
    }
    for (const [x, y] of cuts) clear(x, y);
    pen += g.w * 2 + 1 + 2;
  }
  cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  // Drop shadow, outline, then the ramp fill (dithered between bands)
  ctx.fillStyle = pal.shadow;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x - 1, y - 1)) ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillStyle = pal.outline;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (!at(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y + 1))) ctx.fillRect(x, y, 1, 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      const t = (y - 2) / TITLE_H;
      const d = ((x + y) & 1) * 0.08;
      ctx.fillStyle = t + d < 0.36 ? pal.top : t + d < 0.66 ? pal.mid : pal.bot;
      ctx.fillRect(x, y, 1, 1);
    }
  titleCache.set(key, cv);
  return cv;
}

/** Draw a gothic title; y is the top of the letters. */
export function drawTitle(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, align: Align = "center", scale = 1, pal: TitlePalette = TITLE_BLOOD) {
  const cv = titleSprite(s, pal);
  const w = cv.width * scale;
  const dx = align === "left" ? x : align === "center" ? x - Math.floor(w / 2) : x - w;
  ctx.drawImage(cv, Math.round(dx), Math.round(y - 2 * scale), w, cv.height * scale);
}
