// Smooth (non-pixel) sprite registry for the biome roster + bosses, painted with rig.paintSprite
// for the 45-degree 3/4 camera. render.ts asks here first and falls back to gfx/monsters.ts.
import { sfx } from "../audio/index";
import { MONSTER_TYPES } from "../../shared/content/monsters";
import { ART, DIRS, dirToWorldAngle } from "./iso";
import { canBuild, type Sprite } from "./pixel";
import { paintSprite, rotF, rotS, spriteDensity, transformParts, v } from "./rig";
import type { SmoothAnim } from "./monsters_kit";
import { HOLLOWPINE, type SmoothDef } from "./monsters_hollowpine";
import { GLOAMWATER } from "./monsters_gloamwater";
import { BROKENSPIRE } from "./monsters_brokenspire";
import { BOSSES } from "./monsters_bosses";

const DEFS: Record<string, SmoothDef> = { ...HOLLOWPINE, ...GLOAMWATER, ...BROKENSPIRE, ...BOSSES };

// Voice families for the new roster (audio: mon.<fam>.*).
for (const t of MONSTER_TYPES) if (t.family) sfx.registerFamily(t.id, t.family);

export function hasSmoothMonster(k: string) {
  return k in DEFS;
}

const cache = new Map<string, Sprite>();

/** `dir` is a DIRS-way direction index (iso.dirN). Returns null for kinds without smooth art. */
export function smoothMonsterFrame(k: string, r: number, dir: number, anim: SmoothAnim, frame: number, flash = false): Sprite | null {
  const def = DEFS[k];
  if (!def) return null;
  const size = Math.round((r / def.baseR) * 10) / 10;
  const key = `${k}|${size}|${dir}|${anim}|${frame}|${flash ? 1 : 0}|${spriteDensity()}`;
  let s = cache.get(key);
  if (s) return s;
  if (!canBuild()) {
    const fb = cache.get(`${k}|${size}|${dir}|${anim}|0|0|${spriteDensity()}`) ?? cache.get(`${k}|${size}|${dir}|idle|0|0|${spriteDensity()}`);
    if (fb) return fb;
  }
  if (cache.size > 5000) cache.clear();
  const k2 = ART * 1.12 * size;
  const W = Math.ceil(def.w * k2) + 10;
  const H = Math.ceil(def.h * k2) + 10;
  const AX = Math.floor(W / 2);
  const AY = Math.ceil(def.ay * k2) + 5;
  const parts = def.parts(anim === "death" ? "idle" : anim, anim === "death" ? 0 : frame);
  if (anim === "death") {
    const t = Math.min(1, frame / 5);
    const e = t * t;
    if (def.baseR >= 28) transformParts(parts, (p) => rotS(p, -e * 1.4, v(-4, 0, 0)));
    else transformParts(parts, (p) => rotF(p, e * 1.5, v(0, 3, 0)));
  }
  s = paintSprite(parts, dirToWorldAngle(dir, DIRS), def.scale * k2, W, H, AX, AY, flash);
  cache.set(key, s);
  return s;
}

/** Frames per anim for the smooth roster (same as the legacy rig). */
export const SMOOTH_FRAMES: Record<SmoothAnim, number> = { idle: 4, move: 6, windup: 4, strike: 3, death: 6 };
export const SMOOTH_KINDS = Object.keys(DEFS);

/** Height of the sprite's head above its feet (world-pass pixels) for nameplates; null if not smooth. */
export function smoothTop(k: string, r: number): number | null {
  const def = DEFS[k];
  if (!def) return null;
  return def.ay * ART * 1.12 * (r / def.baseR) * 0.8;
}
