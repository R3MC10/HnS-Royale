// THE camera projection (client-side only; gameplay stays in flat world x/y). Every screen <-> world
// conversion (render, mouse aim, culling, minimap, VFX, telegraphs) goes through this module.
//
// A fixed camera turned 45 degrees to the world grid, looking steeply down (the diagonal 3/4
// ARPG view). In "world units" u (before the renderer's zoom):
//   screenX = (x - y) * C * K
//   screenY = (x + y) * C * K * SQ - height * K * HZ
// SQ is the vertical foreshortening of the ground (0.62: steeper than 2:1 iso's 0.5).

/** World units -> screen units along a world axis's diagonal. */
export const K = 1.1;
/** Vertical foreshortening of the ground plane. */
export const SQ = 0.62;
/** Height (z) -> screen units, per world unit of height. */
export const HZ = 0.8;
const C = Math.SQRT1_2;
/** Art scale for rigged sprites (rig units -> screen units before the diagonal factor). */
export const ART = K / C;

export function isoX(x: number, y: number) {
  return (x - y) * C * K;
}
export function isoY(x: number, y: number) {
  return (x + y) * C * K * SQ;
}

/** Inverse projection: screen offset (units, relative to the projected origin) -> ground point. */
export function unproject(sx: number, sy: number): { x: number; y: number } {
  const a = sx / (C * K); // x - y
  const b = sy / (C * K * SQ); // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Movement keys are screen directions (W = up the screen); convert to a world direction, same length. */
export function screenMoveToWorld(mx: number, my: number): { mx: number; my: number } {
  const len = Math.hypot(mx, my);
  if (len < 1e-6) return { mx: 0, my: 0 };
  // Undo the diagonal turn only (not the foreshortening), so W walks straight up the screen.
  const wx = (mx + my) * C;
  const wy = (my - mx) * C;
  const s = Math.min(1, len) / Math.hypot(wx, wy);
  return { mx: wx * s, my: wy * s };
}

/** Screen-space angle of a world direction. */
export function screenAngle(worldAngle: number) {
  const cx = Math.cos(worldAngle);
  const cy = Math.sin(worldAngle);
  return Math.atan2((cx + cy) * SQ, cx - cy);
}

/** Number of facing directions the sprites are pre-rendered in. */
export const DIRS = 16;

/** Sprite direction index in SCREEN space (0 = east/right, increasing clockwise), n directions. */
export function dirN(worldAngle: number, n = DIRS) {
  const a = screenAngle(worldAngle);
  return ((Math.round(a / ((Math.PI * 2) / n)) % n) + n) % n;
}
/** 8-direction index (legacy callers). */
export function dir8(worldAngle: number) {
  return dirN(worldAngle, 8);
}

/** World facing angle that looks like screen direction d (of n). */
export function dirToWorldAngle(d: number, n = 8) {
  const a = (d * Math.PI * 2) / n;
  const w = unproject(Math.cos(a), Math.sin(a));
  return Math.atan2(w.y, w.x);
}

/** Depth key for painter's sorting (larger = closer to the camera) = projected ground y. */
export function depthOf(x: number, y: number) {
  return x + y;
}
