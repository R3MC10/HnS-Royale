// World UI (worldui package): ground loot labels, overhead nameplate bars, floating combat text and
// context cursors. Everything draws in the renderer's HUD pass, which is a native-resolution canvas
// with a hudScale transform, so sizes here are HUD units and the skin kit's smooth serif text is used
// (never the old pixel font). Painted cursors come from art/out/hud/cursor_<kind>/cursor_<kind>.png
// (listed in public/art/index.json by `npm run art`); CSS cursors are the fallback.
import { devScale, rgba, roundRectPath, shade, skinText, skinTextW, SKIN } from "../hud/skin";
import type { LabelStyle } from "./lootart";

type G = CanvasRenderingContext2D;

// ---- ground labels -------------------------------------------------------------------------------

/** Base label text size (HUD units); the label style's scale multiplies it. */
export const LABEL_TEXT = 4.6;
const PAD_X = 2.2;
const PAD_Y = 1.3;

export function groundLabelSize(text: string, st: LabelStyle): { w: number; h: number; size: number } {
  const size = LABEL_TEXT * st.scale;
  const w = skinTextW(text, { size, face: "body" }) + PAD_X * 2;
  return { w: Math.ceil(w * 2) / 2, h: size + PAD_Y * 2, size };
}

export interface LabelState {
  hover: boolean;
  inRange: boolean;
  /** Walk-to-pickup target. */
  pending: boolean;
  time: number;
}

/** Dark rounded box, soft shadow, 1px rarity-tinted border with an inner bevel, serif text. */
export function drawGroundLabel(g: G, r: { x: number; y: number; w: number; h: number }, text: string, st: LabelStyle, s: LabelState): void {
  const px = 1 / devScale(g); // one device pixel in HUD units
  const rad = Math.min(1.2, r.h * 0.22);
  g.save();
  // soft drop shadow
  g.shadowColor = "rgba(0,0,0,0.65)";
  g.shadowBlur = 4 * devScale(g) * 0.35;
  g.shadowOffsetY = px * 2;
  roundRectPath(g, r.x, r.y, r.w, r.h, rad);
  g.fillStyle = s.hover ? "rgba(48,38,28,0.95)" : st.bg;
  g.fill();
  g.shadowColor = "transparent";
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
  // subtle vertical sheen
  const lg = g.createLinearGradient(0, r.y, 0, r.y + r.h);
  lg.addColorStop(0, s.hover ? "rgba(255,230,190,0.10)" : "rgba(255,230,190,0.05)");
  lg.addColorStop(1, "rgba(0,0,0,0.25)");
  g.fillStyle = lg;
  g.fill();
  // border: rarity tint for valuable drops, bronze otherwise; brighter on hover / in reach
  const base = st.border ?? SKIN.bronze;
  const a = s.hover ? 1 : st.border ? 0.85 : s.inRange ? 0.7 : 0.35;
  roundRectPath(g, r.x + px / 2, r.y + px / 2, r.w - px, r.h - px, rad);
  g.lineWidth = px;
  g.strokeStyle = rgba(s.hover && !st.border ? "#e8d8b0" : base, a);
  g.stroke();
  // inner bevel: light top edge, dark bottom edge
  g.lineWidth = px;
  g.strokeStyle = "rgba(255,240,210,0.10)";
  g.beginPath();
  g.moveTo(r.x + rad, r.y + px * 1.5);
  g.lineTo(r.x + r.w - rad, r.y + px * 1.5);
  g.stroke();
  g.strokeStyle = "rgba(0,0,0,0.5)";
  g.beginPath();
  g.moveTo(r.x + rad, r.y + r.h - px * 1.5);
  g.lineTo(r.x + r.w - rad, r.y + r.h - px * 1.5);
  g.stroke();
  // walk-to-pickup target: a faint pulsing outer ring
  if (s.pending) {
    const k = 0.5 + 0.5 * Math.sin(s.time * 7);
    roundRectPath(g, r.x - 1.2, r.y - 1.2, r.w + 2.4, r.h + 2.4, rad + 1);
    g.lineWidth = px * 1.5;
    g.strokeStyle = rgba(st.text.startsWith("#") ? st.text : "#e8d8b0", 0.35 + 0.35 * k);
    g.stroke();
  }
  g.restore();
  const size = LABEL_TEXT * st.scale;
  skinText(g, text, r.x + r.w / 2, r.y + PAD_Y - size * 0.02, { size, face: "body", align: "center", color: s.hover ? shade(st.text, 1.15) : st.text, shadow: false, weight: 600 });
}

/** Name label for an interactable (shrines) in the same dark-box style as loot (Alt highlight). */
export function drawInteractLabel(g: G, x: number, y: number, text: string, color: string): void {
  const st: LabelStyle = { text: color, border: color, bg: "rgba(10,8,7,0.82)", scale: 1 };
  const sz = groundLabelSize(text, st);
  drawGroundLabel(g, { x: x - sz.w / 2, y: y - sz.h, w: sz.w, h: sz.h }, text, st, { hover: false, inRange: false, pending: false, time: 0 });
}

// ---- overhead bars -------------------------------------------------------------------------------

/**
 * Overhead life bar (players and monsters): dark iron frame, recessed trough, two-tone gradient fill
 * with a highlight line, optional energy-shield strip along the top. x/y = top-left of the fill, HUD units.
 */
export function drawWorldBar(g: G, x: number, y: number, w: number, h: number, frac: number, color: string, esFrac = -1): void {
  const px = 1 / devScale(g);
  const f = Math.max(0, Math.min(1, frac));
  g.save();
  // frame
  roundRectPath(g, x - px * 2, y - px * 2, w + px * 4, h + px * 4, px * 2);
  g.fillStyle = "rgba(4,3,4,0.92)";
  g.fill();
  g.lineWidth = px;
  g.strokeStyle = "rgba(122,100,64,0.55)";
  g.stroke();
  // trough
  g.fillStyle = "#1c0f0d";
  g.fillRect(x, y, w, h);
  if (f > 0) {
    const lg = g.createLinearGradient(0, y, 0, y + h);
    lg.addColorStop(0, shade(color, 1.25));
    lg.addColorStop(0.45, color);
    lg.addColorStop(1, shade(color, 0.55));
    g.fillStyle = lg;
    g.fillRect(x, y, w * f, h);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(x, y, w * f, Math.max(px, h * 0.22));
  }
  if (esFrac > 0) {
    const eh = Math.max(px * 2, h * 0.42);
    g.fillStyle = "rgba(10,14,22,0.75)";
    g.fillRect(x, y, w, eh);
    g.fillStyle = SKIN.es;
    g.fillRect(x, y, w * Math.min(1, esFrac), eh);
  }
  g.restore();
}

// ---- floating combat text ------------------------------------------------------------------------

/** Base size of a float (HUD units). Emphasised floats are 1.2x at most (never doubled). */
export const FLOAT_TEXT = 5;

/**
 * One float. `emphasis` (big hits) only brightens the colour; `scale` is clamped to 1..1.2 and is meant
 * for crits (the hit event carries no crit flag yet, so callers pass 1).
 */
export function drawFloatText(g: G, text: string, x: number, y: number, color: string, emphasis: boolean, alpha: number, scale = 1): void {
  const size = FLOAT_TEXT * Math.max(1, Math.min(1.2, scale));
  skinText(g, text, x, y - size, { size, face: "display", align: "center", color: emphasis ? shade(color, 1.18) : color, alpha, weight: 700, spacing: 0.02 });
}

// ---- cursors -------------------------------------------------------------------------------------

export type CursorKind = "default" | "loot" | "enemy" | "interact" | "held";

const FALLBACK_CURSOR: Record<CursorKind, string> = {
  default: "default",
  loot: "pointer",
  enemy: "crosshair",
  interact: "pointer",
  held: "none",
};

interface IndexStatic {
  src: string;
  anchor?: [number, number];
}
const cursorArt: Partial<Record<CursorKind, string>> = {};
let cursorIndex: "idle" | "loading" | "done" = "idle";

function loadCursorArt() {
  if (cursorIndex !== "idle" || typeof fetch !== "function") return;
  cursorIndex = "loading";
  fetch("art/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { statics?: Record<string, IndexStatic> } | null) => {
      const st = j?.statics ?? {};
      for (const k of ["default", "loot", "enemy", "interact"] as CursorKind[]) {
        const e = st[`cursor_${k}`];
        if (!e?.src || typeof Image === "undefined") continue;
        const im = new Image();
        im.onload = () => {
          // Browsers cap CSS cursors at 128px; larger art keeps the fallback.
          if (im.naturalWidth > 128 || im.naturalHeight > 128) return;
          // Hotspot: the manifest anchor unless it is the importer's bottom-centre default, else the top-left tip.
          const a = e.anchor;
          const isDefault = !a || (a[0] === im.naturalWidth / 2 && a[1] === im.naturalHeight);
          const hx = isDefault ? 2 : Math.max(0, Math.min(im.naturalWidth - 1, Math.round(a![0])));
          const hy = isDefault ? 2 : Math.max(0, Math.min(im.naturalHeight - 1, Math.round(a![1])));
          cursorArt[k] = `url("${e.src}") ${hx} ${hy}, ${FALLBACK_CURSOR[k]}`;
          lastCursor = ""; // re-apply on the next frame
        };
        im.src = e.src;
      }
    })
    .catch(() => undefined)
    .finally(() => {
      cursorIndex = "done";
    });
}

let lastCursor = "";
/** Set the game canvas cursor for the hovered context (cheap: only touches the style on change). */
export function setWorldCursor(canvas: HTMLCanvasElement, kind: CursorKind): void {
  loadCursorArt();
  const css = cursorArt[kind] ?? FALLBACK_CURSOR[kind];
  if (css === lastCursor) return;
  lastCursor = css;
  canvas.style.cursor = css;
  canvas.dataset.cur = kind;
}
