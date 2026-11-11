// HUD lanes: which screen rects the HUD owns this frame, so nothing else draws there.
//
// Top-centre column, highest priority first:
//   "round"  countdown / Fight! / round-end titles / Eliminated (render.ts, hud/royale.ts)
//   "target" boss bar + target block (hud/target.ts); not drawn while a "round" banner is up
//   "boss"   boss bar, "target" hovered target block (hud/target.ts); not drawn while "round" is up
//   "level"  "Level N" banner (DOM, prog.ts): fixed upper-middle lane, under the boss/target block
//   toasts   DOM #toasts, under all of the above (placeToasts)
// Interaction prompts (shrine) sit just above the bottom band; low-priority hints go to the left
// message log (killfeed) and wait while a boss bar or round banner is up (hud/state.ts hudHint).
//
// World-space labels (name plates, loot labels, floats) are drawn BEFORE the HUD parts of the same
// frame, so they read the rects claimed during the previous frame (laneRects): loot labels are pushed
// out of them and everything else is clipped to the area outside them (clipOutsideHud).
import type { HudLayout, HudRect } from "./types";

export type Lane = "round" | "boss" | "target" | "level" | "banner" | "feed" | "buffs" | "prompt";

interface Claim extends HudRect {
  lane: Lane;
}

let prev: Claim[] = [];
let cur: Claim[] = [];

/** render.ts, start of the HUD pass: last frame's claims become readable, this frame's start empty. */
export function lanesBeginFrame(): void {
  prev = cur;
  cur = [];
}

/** A HUD part drew something in this rect (HUD units) this frame. */
export function laneClaim(lane: Lane, r: HudRect): void {
  if (r.w > 0 && r.h > 0) cur.push({ lane, x: r.x, y: r.y, w: r.w, h: r.h });
}

/** True when the lane was in use last frame (parts lower in the order hide or wait). */
export function laneBusy(lane: Lane): boolean {
  return prev.some((c) => c.lane === lane);
}

/** Bottom edge (u) of the top-centre column last frame (0 when empty); withLevel adds the level banner. */
export function topColumnBottom(withLevel = false): number {
  let b = 0;
  for (const c of prev)
    if (c.lane === "round" || c.lane === "boss" || c.lane === "target" || (withLevel && c.lane === "level")) b = Math.max(b, c.y + c.h);
  return b;
}

/** Top edge (u) of the level-up banner: upper-middle, under whatever the column above it shows. */
export function levelBannerTop(L: HudLayout): number {
  return Math.max(L.h * 0.17, topColumnBottom() + 5);
}

/** Fixed HUD furniture (minimap + info lines, perf line, bottom band pieces), from the layout. */
function fixedRects(L: HudLayout, mapShown: boolean, bottomShown: boolean): HudRect[] {
  const out: HudRect[] = [];
  out.push({ x: 0, y: 0, w: L.perf.x + 46, h: L.perf.y + L.perf.h + 3 });
  const m = L.minimap;
  const left = Math.min(m.x, L.royale.x + 6) - 3;
  out.push({ x: left, y: 0, w: L.w - left, h: mapShown ? L.royale.y + 28 : 24 });
  if (bottomShown) {
    const lg = L.lifeGlobe;
    const mg = L.manaGlobe;
    out.push({ x: 0, y: lg.cy - lg.r - 6, w: lg.cx + lg.r + 6, h: L.h });
    out.push({ x: mg.cx - mg.r - 6, y: L.spirit.y - 2, w: L.w, h: L.h });
    out.push({ x: L.belt.x - 2, y: L.selfStun.y - 2, w: L.belt.w + 4, h: L.h });
    out.push({ x: L.weaponSet.x - 4, y: L.skillBar.y - 5, w: L.skillBar.x + L.skillBar.w + 4 - (L.weaponSet.x - 4), h: L.h });
    const f2 = L.flaskSlots[1]; // the flask standing by the mana globe
    if (f2) out.push({ x: f2.x - 3, y: f2.y - 3, w: L.w - f2.x + 3, h: L.h });
    out.push({ x: 0, y: L.xpBar.y - 3, w: L.w, h: L.h });
  }
  for (const r of domRects.values()) out.push(r);
  return out;
}

/** DOM HUD panels outside the canvas HUD (e.g. the Breachway bar, lanehud.ts): rects in HUD units, by id. */
const domRects = new Map<string, HudRect>();
export function setDomRect(id: string, r: HudRect | null): void {
  if (r && r.w > 0 && r.h > 0) domRects.set(id, r);
  else domRects.delete(id);
}

let fixedOpts = { map: true, bottom: true };
/** render.ts: whether the corner map and the bottom band are on screen this frame. */
export function lanesFixed(map: boolean, bottom: boolean): void {
  fixedOpts = { map, bottom };
}

/** Every rect the HUD owns right now (HUD units): fixed furniture + last frame's claims. */
export function laneRects(L: HudLayout): HudRect[] {
  return [...fixedRects(L, fixedOpts.map, fixedOpts.bottom), ...prev];
}

/** Clip the context to everything outside the HUD rects (call inside save/restore). */
export function clipOutsideHud(g: CanvasRenderingContext2D, L: HudLayout): void {
  // one even-odd clip per rect (clips intersect), so overlapping rects never cancel each other out
  for (const r of laneRects(L)) {
    g.beginPath();
    g.rect(0, 0, L.w, L.h);
    g.rect(r.x, r.y, r.w, r.h);
    g.clip("evenodd");
  }
}

// ---- DOM followers -------------------------------------------------------------------------------

let toastTop = -1;
/** Keep the DOM toast stack under the top-centre column (called once per frame). */
let toastRect: DOMRect | null = null;
let toastN = 0;
let toastRectTop = -1;
let toastAge = 0;

export function placeToasts(L: HudLayout): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("toasts");
  if (!el) return;
  const top = Math.max(64, Math.round((topColumnBottom(true) + 3) * L.u));
  if (top !== toastTop) {
    toastTop = top;
    el.style.top = `${top}px`;
  }
  const n = el.childElementCount;
  if (n > 0) {
    // world labels keep out from under a showing toast. Reading the rect forces a layout, so only re-read
    // it when the toast count or top changes, or every 15 frames (not every frame).
    if (n !== toastN || top !== toastRectTop || ++toastAge >= 15 || !toastRect) {
      toastRect = el.getBoundingClientRect();
      toastN = n;
      toastRectTop = top;
      toastAge = 0;
    }
    const r = toastRect;
    laneClaim("banner", { x: r.left / L.u, y: r.top / L.u, w: r.width / L.u, h: r.height / L.u });
  } else toastN = 0;
}
