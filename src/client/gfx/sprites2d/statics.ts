// Painted statics: props (anchored at their base), seamless ground tiles, item icons.
import type { Sprite } from "../pixel";
import { ART_PX } from "./actors";
import { getImage, iconSrc, staticDef } from "./registry";

/** Prop sprite (anchor at its foot point) at `scale` screen units per art px, or null. */
export function propSprite(id: string, scale = ART_PX): Sprite | null {
  const def = staticDef(id);
  if (!def) return null;
  const im = getImage(def.src);
  if (!im) return null;
  return { cv: im as unknown as HTMLCanvasElement, ax: def.anchor[0], ay: def.anchor[1], d: 1 / scale };
}

/** Draw a prop with its anchor at screen (x, y). */
export function drawProp(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, scale = ART_PX, opts: { alpha?: number; flipX?: boolean } = {}): boolean {
  const s = propSprite(id, scale);
  if (!s) return false;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * (opts.alpha ?? 1);
  const k = scale;
  if (opts.flipX) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(s.cv, -s.ax * k, -s.ay * k, s.cv.width * k, s.cv.height * k);
    ctx.restore();
  } else ctx.drawImage(s.cv, x - s.ax * k, y - s.ay * k, s.cv.width * k, s.cv.height * k);
  ctx.globalAlpha = a0;
  return true;
}

/** Opaque box of a prop around its foot anchor, in screen units: left / right offsets and height above the foot. */
export function propBox(id: string, scale = ART_PX, flipX = false): { l: number; r: number; t: number } | null {
  const def = staticDef(id);
  if (!def) return null;
  const l = (def.bbox[0] - def.anchor[0]) * scale;
  const r = (def.bbox[2] - def.anchor[0]) * scale;
  return { l: flipX ? -r : l, r: flipX ? -l : r, t: (def.anchor[1] - def.bbox[1]) * scale };
}

/** Visual width (screen units) of a prop's opaque part at a scale. */
export function propWidth(id: string, scale = ART_PX): number {
  const def = staticDef(id);
  return def ? (def.bbox[2] - def.bbox[0]) * scale : 0;
}

const patterns = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();
/** A repeating pattern of a tile for this context (null until loaded). */
export function tilePattern(ctx: CanvasRenderingContext2D, id: string): { pat: CanvasPattern; w: number; h: number } | null {
  const def = staticDef(id);
  if (!def) return null;
  const im = getImage(def.src);
  if (!im) return null;
  let m = patterns.get(ctx);
  if (!m) patterns.set(ctx, (m = new Map()));
  let pat = m.get(id);
  if (!pat) {
    pat = ctx.createPattern(im, "repeat") ?? undefined;
    if (!pat) return null;
    m.set(id, pat);
  }
  return { pat, w: im.naturalWidth, h: im.naturalHeight };
}

/**
 * Fill a screen rect with a seamless tile aligned to the world: (originX, originY) is where the
 * projected world origin is on screen (cam.offX / offY), so the pattern scrolls with the ground.
 */
export function drawTilePattern(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, originX: number, originY: number, scale = ART_PX * 1.3, alpha = 1): boolean {
  const tp = tilePattern(ctx, id);
  if (!tp) return false;
  tp.pat.setTransform(new DOMMatrix([scale, 0, 0, scale, originX, originY]));
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  ctx.fillStyle = tp.pat;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = a0;
  return true;
}

/** Loaded icon image (art/out/icon/<id>.png) or null. */
export function iconImage(id: string): HTMLImageElement | null {
  const src = iconSrc(id);
  return src ? getImage(src) : null;
}
export function hasIcon(id: string) {
  return iconSrc(id) !== null;
}

/** Draw an icon centred on (x, y), `size` units square. */
export function drawIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, alpha = 1): boolean {
  const im = iconImage(id);
  if (!im) return false;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(im, x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = a0;
  return true;
}
