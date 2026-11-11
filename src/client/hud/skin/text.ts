// HUD skin text (skin foundation): smooth anti-aliased text at native resolution, replacing the pixel
// font for the canvas HUD. Two faces: "display" (serif titles / numbers, same stack as menus/style.ts)
// and "body" (readable serif for small text). Sizes and positions are in HUD units; `y` is the TOP of
// the line box (like the old pixel font), so a size-7 line fits where a 7u pixel line did.
import type { HudAlign } from "../types";
import { devScale } from "./paint";
import { tr } from "../../i18n";

export type SkinFace = "display" | "body";

export interface SkinTextOpts {
  color?: string;
  align?: HudAlign;
  /** Line height / em size in HUD units (default 7). */
  size?: number;
  face?: SkinFace;
  /** CSS font weight (default: display 700, body 600). */
  weight?: number;
  /** Dark outline + drop shadow for legibility over the world (default true). */
  shadow?: boolean;
  /** Letter spacing in em (display default 0.06). */
  spacing?: number;
  /** Max width in HUD units (text is squeezed to fit). */
  maxW?: number;
  alpha?: number;
}

const FALLBACK = {
  display: '"Cinzel", "Trajan Pro", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
  body: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
};
let faces: { display: string; body: string } | null = null;

/** Font stacks: the look agent's --font-title / --font-body CSS variables when set, else serif fallbacks. */
export function skinFonts(): { display: string; body: string } {
  if (faces) return faces;
  let display = FALLBACK.display;
  let body = FALLBACK.body;
  try {
    const cs = getComputedStyle(document.documentElement);
    const t = cs.getPropertyValue("--font-title").trim();
    const b = cs.getPropertyValue("--font-body").trim();
    if (t) display = `${t}, ${FALLBACK.display}`;
    if (b) body = `${b}, ${FALLBACK.body}`;
  } catch {
    /* no DOM */
  }
  faces = { display, body };
  return faces;
}
/** Re-read the CSS font variables (call after the look agent changes them). */
export function refreshSkinFonts(): void {
  faces = null;
}

function fontString(face: SkinFace, weight: number, px: number): string {
  const f = skinFonts();
  return `${weight} ${px.toFixed(2)}px ${face === "display" ? f.display : f.body}`;
}

let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
const MEASURE_PX = 64;

function defaults(o: SkinTextOpts | undefined) {
  const face: SkinFace = o?.face ?? "body";
  return {
    face,
    size: o?.size ?? 7,
    weight: o?.weight ?? (face === "display" ? 700 : 600),
    spacing: o?.spacing ?? (face === "display" ? 0.06 : 0.01),
  };
}

/** Width of `s` in HUD units. */
export function skinTextW(s: string, o?: SkinTextOpts): number {
  s = tr(s);
  const d = defaults(o);
  const key = `${d.face}|${d.weight}|${d.spacing}|${s}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    if (!measureCtx) {
      if (typeof document === "undefined") return s.length * d.size * 0.5;
      measureCtx = document.createElement("canvas").getContext("2d");
    }
    if (!measureCtx) return s.length * d.size * 0.5;
    measureCtx.font = fontString(d.face, d.weight, MEASURE_PX);
    w = (measureCtx.measureText(s).width + Math.max(0, s.length - 1) * d.spacing * MEASURE_PX) / MEASURE_PX;
    if (widthCache.size > 4000) widthCache.clear();
    widthCache.set(key, w);
  }
  const width = w * d.size;
  return o?.maxW ? Math.min(o.maxW, width) : width;
}

/** Draw `s` with its line box top at y (HUD units). Returns the drawn width in HUD units. */
export function skinText(g: CanvasRenderingContext2D, s: string, x: number, y: number, o?: SkinTextOpts): number {
  if (!s) return 0;
  s = tr(s);
  const d = defaults(o);
  const k = devScale(g);
  const px = d.size * k;
  const natural = skinTextW(s, { ...o, maxW: undefined });
  const w = o?.maxW ? Math.min(o.maxW, natural) : natural;
  const squeeze = natural > 0 ? w / natural : 1;
  const align = o?.align ?? "left";
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  const base = y + d.size * 0.84;
  g.save();
  if (o?.alpha !== undefined) g.globalAlpha *= o.alpha;
  // Draw in device px (unscaled) so glyphs are hinted at their real size.
  g.translate(left, base);
  g.scale(squeeze / k, 1 / k);
  g.font = fontString(d.face, d.weight, px);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  const ls = d.spacing * px;
  const anyG = g as CanvasRenderingContext2D & { letterSpacing?: string };
  const hasLS = "letterSpacing" in g;
  if (hasLS) anyG.letterSpacing = `${ls.toFixed(2)}px`;
  if (o?.shadow !== false) {
    g.lineJoin = "round";
    g.strokeStyle = "rgba(6,4,4,0.85)";
    g.lineWidth = Math.max(1.5, px * 0.16);
    g.shadowColor = "rgba(0,0,0,0.7)";
    g.shadowBlur = Math.max(1, px * 0.12);
    g.shadowOffsetY = Math.max(0.5, px * 0.05);
    g.strokeText(s, 0, 0);
    g.shadowColor = "transparent";
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
  }
  g.fillStyle = o?.color ?? "#e8dcc4";
  g.fillText(s, 0, 0);
  if (hasLS) anyG.letterSpacing = "0px";
  g.restore();
  return w;
}

/** Display-face number/title helper with a warm metallic gradient fill (globe numbers, banners). */
export function skinTitle(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, align: HudAlign = "center", top = "#f4e6c4", bot = "#b08850"): number {
  if (!s) return 0;
  s = tr(s);
  const d = defaults({ face: "display", size });
  const w = skinTextW(s, { face: "display", size });
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  // Shadowed outline first, then a vertical gradient fill on top.
  skinText(g, s, x, y, { face: "display", size, align, color: bot });
  const k = devScale(g);
  g.save();
  g.translate(left, y + size * 0.84);
  g.scale(1 / k, 1 / k);
  g.font = fontString("display", d.weight, size * k);
  g.textBaseline = "alphabetic";
  const anyG = g as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in g) anyG.letterSpacing = `${(d.spacing * size * k).toFixed(2)}px`;
  // gradient is in HUD units; re-express in this scaled space
  const gr2 = g.createLinearGradient(0, -size * 0.64 * k, 0, size * 0.06 * k);
  gr2.addColorStop(0, top);
  gr2.addColorStop(1, bot);
  g.fillStyle = gr2;
  g.fillText(s, 0, 0);
  if ("letterSpacing" in g) anyG.letterSpacing = "0px";
  g.restore();
  return w;
}
