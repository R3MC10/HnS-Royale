// Painted 2D art registry: public/art/index.json (written by scripts/art/import.mjs) + an image cache.
// Everything here is optional at runtime: until the index and an image have loaded, callers get null
// and keep drawing the procedural art.
import { getSettings } from "../../settings";

export type Dir8 = "S" | "SW" | "W" | "NW" | "N" | "NE" | "E" | "SE";
export interface ActorAnim {
  frames: number;
  fps: number;
  dirs: Dir8[];
}
export interface ActorDef {
  kind: string;
  base: string;
  cell: [number, number];
  anchor: [number, number];
  mirror: boolean;
  /** Alpha bounds [x0, y0, x1, y1] of the reference frame (idle S). */
  bbox: [number, number, number, number];
  anims: Record<string, ActorAnim>;
}
export interface StaticDef {
  kind: string;
  src: string;
  size: [number, number];
  anchor: [number, number];
  seamless: boolean;
  bbox: [number, number, number, number];
}
interface ArtIndex {
  actors: Record<string, ActorDef>;
  statics: Record<string, StaticDef>;
  icons: Record<string, string>;
}

let index: ArtIndex | null = null;
let version = 0;

function loadIndex() {
  if (typeof fetch !== "function") return;
  fetch("art/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: ArtIndex | null) => {
      if (!j || typeof j !== "object") return;
      index = { actors: j.actors ?? {}, statics: j.statics ?? {}, icons: j.icons ?? {} };
      version++;
    })
    .catch(() => {});
}
loadIndex();

/** Bumped whenever the index loads (callers caching derived data can compare). */
export function artVersion() {
  return version;
}
export function paintedEnabled() {
  return index !== null && getSettings().graphics.paintedSprites !== false;
}
export function actorDef(id: string): ActorDef | null {
  return paintedEnabled() ? index!.actors[id] ?? null : null;
}
export function staticDef(id: string): StaticDef | null {
  return paintedEnabled() ? index!.statics[id] ?? null : null;
}
export function iconSrc(id: string): string | null {
  return paintedEnabled() ? index!.icons[id] ?? null : null;
}

// ---- image cache ----
const images = new Map<string, HTMLImageElement>();
/** Loaded image for a public-relative URL, or null while it loads / when it failed. */
export function getImage(src: string): HTMLImageElement | null {
  let im = images.get(src);
  if (!im) {
    im = new Image();
    im.decoding = "async";
    im.src = src;
    images.set(src, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
/** The image element for a src that getImage was asked for (loaded or not), or null. */
export function peekImage(src: string): HTMLImageElement | null {
  return images.get(src) ?? null;
}
/** Start loading a list of images (no-op for cached ones). */
export function preload(srcs: string[]) {
  for (const s of srcs) getImage(s);
}
