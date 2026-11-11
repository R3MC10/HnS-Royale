// Painted hero part manifest (public/heroparts/manifest.json, written by scripts/art/heroparts.mjs)
// plus a tiny image loader that tells "still loading" from "failed".
// Until the manifest and the needed images are in, the paperdoll returns null and the renderer keeps
// its fallback (painted frame sprites / procedural rig).
import { getSettings } from "../../settings";

export type PartView = "S" | "E" | "N";
export interface PartViewDef {
  /** Path relative to the manifest root. */
  src: string;
  w: number;
  h: number;
  /** Pivot (px): lands on the part's first joint. */
  ax: number;
  ay: number;
  /** Stretch parts: px from the pivot (along +y) to the second joint. 0 for rigid parts. */
  len: number;
}
export interface PartDef {
  slot: string;
  look: string;
  seg: string;
  mode: "stretch" | "rigid";
  /** Image -y (instead of +y) points from the first joint to the second. */
  up: boolean;
  views: Partial<Record<PartView, PartViewDef>>;
}
export interface PartManifest {
  version: number;
  /** Image px per screen unit (at rig scale). */
  ppu: number;
  root: string;
  parts: Record<string, PartDef>;
}

const BASE_URL = "heroparts/";
let manifest: PartManifest | null = null;
let version = 0;

function load() {
  if (typeof fetch !== "function") return;
  fetch(BASE_URL + "manifest.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: PartManifest | null) => {
      if (!j || typeof j !== "object" || !j.parts) return;
      manifest = { version: j.version ?? 1, ppu: j.ppu || 7.2, root: BASE_URL, parts: j.parts };
      version++;
      // Warm every image so the first hero frame does not wait on a cascade of loads.
      for (const p of Object.values(manifest.parts)) for (const v of Object.values(p.views)) if (v) partImage(v);
    })
    .catch(() => {});
}
load();

export function partManifest(): PartManifest | null {
  if (!manifest) return null;
  return getSettings().graphics.paintedSprites !== false ? manifest : null;
}
export function partManifestVersion() {
  return version;
}

type ImgState = { im: HTMLImageElement; failed: boolean };
const images = new Map<string, ImgState>();
/** "ready" image, null while loading, or "failed" for a permanently missing file. */
export function partImage(v: PartViewDef): HTMLImageElement | null | "failed" {
  const url = BASE_URL + v.src;
  let st = images.get(url);
  if (!st) {
    const im = new Image();
    st = { im, failed: false };
    const s = st;
    im.decoding = "async";
    im.onerror = () => (s.failed = true);
    im.src = url;
    images.set(url, st);
  }
  if (st.failed) return "failed";
  return st.im.complete && st.im.naturalWidth > 0 ? st.im : null;
}
