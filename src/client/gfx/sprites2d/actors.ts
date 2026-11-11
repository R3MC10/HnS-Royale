// Painted actor sprites (heroes, monsters, bosses): 8 facings with W->E mirroring, anim timing,
// anchors. actorSprite() returns a pixel.Sprite so render.ts can reuse blit / drawTint / drawAilFx.
import type { Sprite } from "../pixel";
import { actorDef, getImage, preload, type ActorDef, type Dir8 } from "./registry";

/** Default view height in screen units at zoom 1 (720 wide, 16:9). */
export const VIEW_H = 405;
/** The hero stands about 1/9 of the screen tall (art/STYLE.md reference v2). */
export const HERO_H = VIEW_H / 9;
/** Screen units per art px for everything painted at the shared hero scale (~195 px tall hero). */
export const ART_PX = HERO_H / 195;

/** Screen-space 8-way order used by iso.dirN(a, 8): 0 = E, clockwise (screen y down). */
export const DIR8: Dir8[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
const DIR_I: Record<Dir8, number> = { E: 0, SE: 1, S: 2, SW: 3, W: 4, NW: 5, N: 6, NE: 7 };
const MIRROR: Record<Dir8, Dir8> = { E: "W", W: "E", NE: "NW", NW: "NE", SE: "SW", SW: "SE", S: "S", N: "N" };

/** 16-way (iso.DIRS) or n-way screen direction index -> 8-way name. */
export function dirName(d: number, n = 8): Dir8 {
  const i = ((Math.round((d * 8) / n) % 8) + 8) % 8;
  return DIR8[i];
}

export type ActorAnimName = "idle" | "run" | "attack" | "die" | "cast" | "slam";
const FALLBACK: Record<string, string[]> = {
  idle: ["idle", "run"],
  run: ["run", "idle"],
  attack: ["attack", "idle"],
  cast: ["cast", "attack", "idle"],
  slam: ["slam", "attack", "idle"],
  die: ["die"],
};
const LOOPING = new Set(["idle", "run"]);

/** Hero archetype sprite for an equipped weapon kind. */
export function heroSpriteId(wk: string | null | undefined): string {
  switch (wk) {
    case "bow":
    case "crossbow":
      return pickHero("hero_bow");
    case "staff":
    case "quarterstaff":
    case "wand":
    case "sceptre":
      return pickHero("hero_staff");
    case "dagger":
    case "claw":
      return pickHero("hero_daggers");
    default:
      return "hero_axe2h"; // axe / mace / sword / spear / unarmed
  }
}
function pickHero(id: string) {
  return actorDef(id) ? id : "hero_axe2h";
}

/** Default screen units per art px for an actor: heroes are normalised to HERO_H. */
export function actorScale(id: string): number {
  const def = actorDef(id);
  if (!def) return ART_PX;
  if (def.kind === "hero") {
    const h = def.bbox[3] - def.bbox[1];
    return h > 40 ? HERO_H / h : ART_PX;
  }
  return ART_PX;
}

interface Pick {
  anim: string;
  dir: Dir8;
  flip: boolean;
  frames: number;
  fps: number;
}
function pick(def: ActorDef, anim: string, want: Dir8): Pick | null {
  for (const a of FALLBACK[anim] ?? [anim, "idle"]) {
    const an = def.anims[a];
    if (!an || an.frames < 1 || !an.dirs.length) continue;
    let best: Pick | null = null;
    let bestD = 99;
    const wi = DIR_I[want];
    const consider = (d: Dir8, flip: boolean) => {
      const dd = Math.abs(DIR_I[d] - wi);
      const dist = Math.min(dd, 8 - dd) + (flip ? 0.01 : 0);
      if (dist < bestD) {
        bestD = dist;
        best = { anim: a, dir: d, flip, frames: an.frames, fps: an.fps };
      }
    };
    for (const d of an.dirs) {
      consider(d, false);
      if (def.mirror && !an.dirs.includes(MIRROR[d])) consider(MIRROR[d], true);
    }
    if (best) return best;
  }
  return null;
}
const srcOf = (def: ActorDef, p: { anim: string; flip: boolean; dir: Dir8 }, i: number) => `${def.base}${p.anim}_${p.flip ? MIRROR[p.dir] : p.dir}_${i}.png`;

const preloaded = new Set<string>();
function preloadActor(id: string, def: ActorDef) {
  if (preloaded.has(id)) return;
  preloaded.add(id);
  const l: string[] = [];
  for (const [a, an] of Object.entries(def.anims)) for (const d of an.dirs) for (let i = 0; i < an.frames; i++) l.push(`${def.base}${a}_${d}_${i}.png`);
  preload(l);
}

// ---- derived canvases (mirrored / flashed / lying), small LRU ----
const derived = new Map<string, HTMLCanvasElement>();
function derive(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  let cv = derived.get(key);
  if (cv) {
    derived.delete(key);
    derived.set(key, cv);
    return cv;
  }
  cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d")!;
  paint(g);
  derived.set(key, cv);
  while (derived.size > 220) derived.delete(derived.keys().next().value!);
  return cv;
}
function variant(im: HTMLImageElement, src: string, flip: boolean, flash: boolean): HTMLCanvasElement {
  if (!flip && !flash) return im as unknown as HTMLCanvasElement; // drawImage / width / height work the same
  const w = im.naturalWidth;
  const h = im.naturalHeight;
  return derive(`${src}|${flip ? 1 : 0}|${flash ? 1 : 0}`, w, h, (g) => {
    if (flip) {
      g.translate(w, 0);
      g.scale(-1, 1);
    }
    g.drawImage(im, 0, 0);
    if (flash) {
      // Hit flash: a warm ADDITIVE tint over the painted frame (detail stays readable; never a white silhouette).
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = FLASH_A;
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tg = tmp.getContext("2d")!;
      tg.drawImage(g.canvas, 0, 0); // already mirrored when flip
      tg.globalCompositeOperation = "source-in";
      tg.fillStyle = FLASH_COL;
      tg.fillRect(0, 0, w, h);
      g.drawImage(tmp, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  });
}
/** Warm additive hit-flash colour and strength (shared with drawWarmFlash). */
const FLASH_COL = "rgb(255,150,80)";
const FLASH_A = 0.42;

// ---- silhouettes (rim / outline / additive flash), cached per source canvas + colour ----
// Bounded LRU at reduced resolution (they are only ever drawn as soft edges / tints), so memory stays
// small no matter how many painted frames are seen. Caller draws them stretched to the sprite rect.
const SIL_MAX = 420;
const SIL_DIM = 128;
const silIds = new WeakMap<object, number>();
let silNext = 1;
const silCache = new Map<string, HTMLCanvasElement>();
function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  let id = silIds.get(src);
  if (!id) silIds.set(src, (id = silNext++));
  const key = id + "|" + color;
  let cv = silCache.get(key);
  if (cv) {
    silCache.delete(key);
    silCache.set(key, cv);
    return cv;
  }
  const w = (src as unknown as HTMLImageElement).naturalWidth || src.width;
  const h = (src as unknown as HTMLImageElement).naturalHeight || src.height;
  const k = Math.min(1, SIL_DIM / Math.max(1, w, h));
  cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * k));
  cv.height = Math.max(1, Math.round(h * k));
  const g = cv.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.drawImage(src, 0, 0, cv.width, cv.height);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, cv.width, cv.height);
  silCache.set(key, cv);
  while (silCache.size > SIL_MAX) silCache.delete(silCache.keys().next().value!);
  return cv;
}

/** Sprites that came from painted frame art (actorSprite / corpseSprite), for procedural motion. */
const paintedSet = new WeakSet<Sprite>();
export function isPaintedSprite(s: Sprite | null | undefined): boolean {
  return !!s && paintedSet.has(s);
}

/** Brief warm additive tint over any sprite (hit flash); k = 0..1 strength. */
export function drawWarmFlash(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, k = 1) {
  if (k <= 0) return;
  const d = s.d ?? 1;
  const op = ctx.globalCompositeOperation;
  const a0 = ctx.globalAlpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = a0 * FLASH_A * Math.min(1, k);
  ctx.drawImage(silhouette(s.cv, FLASH_COL), x - s.ax / d, y - s.ay / d, s.cv.width / d, s.cv.height / d);
  ctx.globalAlpha = a0;
  ctx.globalCompositeOperation = op;
}

/**
 * Readability pass drawn BEHIND an actor sprite: a thin dark outline (4 offset silhouettes) and a
 * subtle cool rim peeking out on the upper-left edge. o = offset in screen units.
 */
export function drawActorBacking(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, o = 0.7, outlineA = 0.6, rimA = 0.45, rim = "rgb(150,190,255)") {
  const d = s.d ?? 1;
  const w = s.cv.width / d;
  const h = s.cv.height / d;
  const x0 = x - s.ax / d;
  const y0 = y - s.ay / d;
  const a0 = ctx.globalAlpha;
  if (outlineA > 0) {
    const dark = silhouette(s.cv, "rgb(8,6,10)");
    ctx.globalAlpha = a0 * outlineA;
    ctx.drawImage(dark, x0 - o, y0, w, h);
    ctx.drawImage(dark, x0 + o, y0, w, h);
    ctx.drawImage(dark, x0, y0 - o, w, h);
    ctx.drawImage(dark, x0, y0 + o, w, h);
  }
  if (rimA > 0) {
    ctx.globalAlpha = a0 * rimA;
    ctx.drawImage(silhouette(s.cv, rim), x0 - o * 0.9, y0 - o * 1.1, w, h);
  }
  ctx.globalAlpha = a0;
}

export interface ActorOpts {
  /** 0..1 progress through a one-shot anim (overrides t). */
  progress?: number;
  flash?: boolean;
  /** Screen units per art px; default actorScale(id). */
  scale?: number;
}

/**
 * Sprite for an actor frame, anchored at the feet, or null (no art / not loaded yet).
 * `dir` is an 8-way name or a screen direction index of `dirs` ways (iso.dirN). `t` = seconds into the anim.
 */
export function actorSprite(id: string, anim: ActorAnimName | string, dir: Dir8 | number, t: number, opts: ActorOpts & { dirs?: number } = {}): Sprite | null {
  const def = actorDef(id);
  if (!def) return null;
  preloadActor(id, def);
  const want = typeof dir === "number" ? dirName(dir, opts.dirs ?? 8) : dir;
  const p = pick(def, anim, want);
  if (!p) return null;
  let i: number;
  if (opts.progress !== undefined) i = Math.min(p.frames - 1, Math.max(0, Math.floor(opts.progress * p.frames)));
  else {
    const f = Math.floor(Math.max(0, t) * p.fps);
    i = LOOPING.has(p.anim) ? f % p.frames : Math.min(p.frames - 1, f);
  }
  const src = srcOf(def, p, i);
  let im = getImage(src);
  if (!im && i > 0) im = getImage(srcOf(def, p, 0)); // a frame still loading: hold frame 0
  if (!im) return null;
  const scale = opts.scale ?? actorScale(id);
  const ax = p.flip ? im.naturalWidth - def.anchor[0] : def.anchor[0];
  const out: Sprite = { cv: variant(im, src, p.flip, !!opts.flash), ax, ay: def.anchor[1], d: 1 / scale };
  paintedSet.add(out);
  return out;
}

/** Corpse frame: the die anim, or (no die art) the idle frame laid on its side. */
export function corpseSprite(id: string, dir: Dir8 | number, t: number, opts: ActorOpts & { dirs?: number } = {}): Sprite | null {
  const def = actorDef(id);
  if (!def) return null;
  if (def.anims.die) return actorSprite(id, "die", dir, t, opts);
  const want = typeof dir === "number" ? dirName(dir, opts.dirs ?? 8) : dir;
  const p = pick(def, "idle", "W"); // side view reads best lying down
  if (!p) return null;
  const src = srcOf(def, p, 0);
  const im = getImage(src);
  if (!im) return null;
  const w = im.naturalWidth;
  const h = im.naturalHeight;
  const flip = DIR_I[want] <= 1 || DIR_I[want] === 7; // E-facing corpses fall the other way
  const [bx0, by0, bx1, by1] = def.bbox;
  // Rotate -90deg: (x, y) -> (y, w - x); squash a little so it reads as lying on the ground.
  const cv = derive(`${src}|lying|${flip ? 1 : 0}`, h, w, (g) => {
    if (flip) {
      g.translate(h, 0);
      g.scale(-1, 1);
    }
    g.translate(0, w);
    g.rotate(-Math.PI / 2);
    g.drawImage(im, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(20,10,8,0.35)";
    g.fillRect(0, 0, h, w);
  });
  const mid = (by0 + by1) / 2;
  const ax = flip ? h - mid : mid;
  const ay = w - bx0 - (bx1 - bx0) * 0.3;
  const out: Sprite = { cv, ax, ay, d: 1 / (opts.scale ?? actorScale(id)) };
  paintedSet.add(out);
  fallInfo.set(out, { fx: flip ? h - by1 : by1, sign: flip ? -1 : 1 });
  return out;
}

const fallInfo = new WeakMap<Sprite, { fx: number; sign: number }>();
/**
 * For a lying corpse frame (no die art): the feet x in canvas px and the rotation sign that stands
 * the figure back up (render.ts topples it over for the death slump). Null for real die frames.
 */
export function corpseFall(s: Sprite): { fx: number; sign: number } | null {
  return fallInfo.get(s) ?? null;
}

export interface DrawOpts extends ActorOpts {
  /** Colour wash (ailments) and its strength 0..1. */
  tint?: { color: string; a: number };
  alpha?: number;
}

/** Draw an actor at screen position (x, y) (already iso-projected feet; see gfx/iso + view.camX/camY). */
export function drawActorSprite(ctx: CanvasRenderingContext2D, id: string, anim: ActorAnimName | string, dir: Dir8 | number, t: number, x: number, y: number, scale?: number, opts: DrawOpts = {}): boolean {
  const s = actorSprite(id, anim, dir, t, { ...opts, scale: scale ?? opts.scale });
  if (!s) return false;
  drawSprite(ctx, s, x, y, opts.alpha ?? 1, opts.tint);
  return true;
}

const tintCv = document.createElement("canvas");
/** Blit a sprite (anchor at x, y; s.d canvas px per unit), optionally washed with a tint colour. */
export function drawSprite(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, alpha = 1, tint?: { color: string; a: number }) {
  const d = s.d ?? 1;
  const w = s.cv.width;
  const h = s.cv.height;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  ctx.drawImage(s.cv, x - s.ax / d, y - s.ay / d, w / d, h / d);
  if (tint && tint.a > 0) {
    if (tintCv.width < w) tintCv.width = w;
    if (tintCv.height < h) tintCv.height = h;
    const g = tintCv.getContext("2d")!;
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    g.drawImage(s.cv, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = tint.color;
    g.fillRect(0, 0, w, h);
    ctx.globalAlpha = a0 * alpha * tint.a;
    ctx.drawImage(tintCv, 0, 0, w, h, x - s.ax / d, y - s.ay / d, w / d, h / d);
  }
  ctx.globalAlpha = a0;
}
