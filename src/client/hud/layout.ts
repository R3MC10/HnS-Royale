// HUD layout (core package): every anchor in HUD units, computed from the window size and settings.
// Canvas parts draw at these rects; DOM parts place themselves via rectToCss so both always agree.
import type { CssBox, HudLayout, HudRect } from "./types";
import { pixelScale } from "../render";
import { getSettings, onChange } from "../settings";

const MAX_FLASKS = 3;
const MAX_CHARMS = 3;

function clamp(lo: number, hi: number, v: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Pure: every anchor for a device-pixel window size. Uses render.ts pixelScale() so the canvas and the DOM agree. */
export function computeHudLayout(devW: number, devH: number, dpr: number, uiScale: number, minimapSize: number): HudLayout {
  // pixelScale reads uiScale from settings; recompute hudScale with the given uiScale so this stays pure in it.
  // Same formula as render.ts pixelScale: smooth (non-integer) device px per HUD unit, so the HUD renders
  // at native resolution and follows uiScale exactly (the HUD grid stays ~480u wide).
  const ps = pixelScale(devW, devH);
  const hudScale = Math.max(2, (devW * (uiScale || 1)) / 480) || ps.hudScale;
  const w = Math.ceil(devW / hudScale);
  const h = Math.ceil(devH / hudScale);
  const u = hudScale / dpr;
  const cx = Math.floor(w / 2);

  // Bottom band, PoE2 arrangement: [life globe][flask 1][flask 3][charms][menu buttons] ..... clear centre .....
  // [weapon-set tabs][8 skill slots][flask 2][mana globe]. Flask 1 stands by the life globe and flask 2 by the
  // mana globe; the belt-granted third flask (ours, not PoE2's) sits beside flask 1 once it is unlocked.
  const GR = 24; // globe radius (diameter ~17.8% of a 16:9 screen height)
  const lifeGlobe = { cx: GR + 5, cy: h - GR - 4, r: GR };
  const manaGlobe = { cx: w - GR - 5, cy: h - GR - 4, r: GR };
  const FW = 13; // tall flask slot
  const FH = 24;
  const baseY = h - 7; // bottom edge shared by flasks, charms and skill slots (the XP bar runs below it)
  const leftX = lifeGlobe.cx + GR + 13; // clear of the carved holder
  const flaskSlots: HudRect[] = [
    { x: leftX, y: baseY - FH, w: FW, h: FH },
    { x: w - leftX - FW, y: baseY - FH, w: FW, h: FH },
    { x: leftX + FW + 2, y: baseY - FH, w: FW, h: FH },
  ];
  const CH = 11; // charm slot edge
  const charmSlots: HudRect[] = [];
  for (let i = 0; i < MAX_CHARMS; i++) charmSlots.push({ x: leftX + 2 * (FW + 2) + 3 + (CH + 1.5) * i, y: baseY - CH, w: CH, h: CH });
  const MB = 10; // menu button diameter
  const lastCharm = charmSlots[MAX_CHARMS - 1];
  const menuButtons: HudRect = { x: lastCharm.x + lastCharm.w + 5, y: baseY - MB, w: 3 * MB + 2 * 2, h: MB };
  const belt: HudRect = { x: leftX, y: baseY - FH, w: menuButtons.x + menuButtons.w - leftX, h: FH };

  // Skill bar (bar package): ONE row of 8 slots (Ctrl shows the second set in place), bottom-right, ending
  // just left of flask 2; weapon-set tabs on its left end.
  const SLOT = 14; // ~5.2% of a 16:9 screen height
  const barW = 8 * SLOT + 7;
  const skillBar: HudRect = { x: flaskSlots[1].x - 6 - barW, y: baseY - SLOT, w: barW, h: SLOT };
  const weaponSet: HudRect = { x: skillBar.x - 14, y: skillBar.y, w: 11, h: SLOT };
  const narrow = belt.x + belt.w + 6 > weaponSet.x;
  if (narrow) {
    // Not enough room in the band (large UI scale): the bar lifts above the mana globe, right-aligned.
    skillBar.x = Math.max(18, w - 6 - barW);
    weaponSet.x = skillBar.x - 14;
    skillBar.y = weaponSet.y = manaGlobe.cy - GR - 14 - SLOT;
  }

  const size = Math.round(clamp(48, 72, Math.floor(w * 0.13)) * minimapSize);
  const minimap: HudRect = { x: w - 6 - size, y: 6, w: size, h: size };
  const royale: HudRect = { x: minimap.x - 40, y: minimap.y + minimap.h + 4, w: minimap.w + 40, h: 18 };
  const feed: HudRect = { x: w - 156, y: royale.y + royale.h + 3, w: 150, h: 54 };

  return {
    w,
    h,
    hudScale,
    dpr,
    u,
    narrow,
    centre: { x: cx, y: Math.floor(h / 2) },
    perf: { x: 6, y: 7, w: 100, h: 7 }, // polish: off the top edge
    buffs: { x: 4, y: 16, w: 150, h: 14 },
    debuffs: { x: 4, y: 32, w: 150, h: 14 },
    target: { x: cx - 80, y: 4, w: 160, h: 48 },
    minimap,
    royale,
    feed,
    scoreboard: { x: cx - 110, y: 30, w: 220, h: h - 90 },
    lifeGlobe,
    manaGlobe,
    spirit: narrow ? { x: w - 6 - barW - 60, y: skillBar.y + 3, w: 40, h: 8 } : { x: w - 58, y: manaGlobe.cy - GR - 13, w: 54, h: 8 },
    points: { x: 6, y: h - 68, w: 36, h: 10 },
    belt,
    flaskSlots,
    charmSlots,
    selfStun: { x: leftX, y: baseY - FH - 9, w: 2 * FW + 2, h: 2.4 },
    dodge: { x: leftX, y: baseY - FH - 4.6, w: 2 * FW + 2, h: 1.5 },
    weaponSet,
    skillBar,
    menuButtons,
    skillSlot: SLOT,
    xpBar: { x: leftX + FW + 13, y: h - 3.4, w: w - 2 * (leftX + FW + 13), h: 2 },
    chat: { x: 4, y: h - 134, w: 110, h: 60 },
    spectate: { x: cx - 100, y: h - 44, w: 200, h: 40 },
    bottomBand: narrow ? 76 : 58,
  };
}

let cached: HudLayout | null = null;
let cacheKey = "";
const subs = new Set<(L: HudLayout) => void>();
let hooked = false;

function currentInputs() {
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const devW = Math.round((typeof window !== "undefined" ? window.innerWidth : 1920) * dpr);
  const devH = Math.round((typeof window !== "undefined" ? window.innerHeight : 1080) * dpr);
  const s = getSettings().interface;
  return { devW, devH, dpr, uiScale: s.uiScale || 1, minimapSize: s.minimapSize || 1 };
}

function recompute(force = false): HudLayout {
  const i = currentInputs();
  const key = `${i.devW}x${i.devH}@${i.dpr}/${i.uiScale}/${i.minimapSize}`;
  if (!cached || force || key !== cacheKey) {
    const changed = !!cached && key !== cacheKey;
    cached = computeHudLayout(i.devW, i.devH, i.dpr, i.uiScale, i.minimapSize);
    cacheKey = key;
    if (changed || force) {
      const L = cached;
      for (const fn of [...subs]) {
        try {
          fn(L);
        } catch (e) {
          console.error("hud layout listener failed", e);
        }
      }
    }
  }
  return cached;
}

function hook() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("resize", () => recompute());
  onChange("interface", "uiScale", () => recompute());
  onChange("interface", "minimapSize", () => recompute());
}

/** Cached layout for the current window + settings; recomputed on resize, uiScale or minimapSize change. */
export function getHudLayout(): HudLayout {
  hook();
  return recompute();
}

/** Called with the new layout whenever it changes. Returns an unsubscribe fn. */
export function onHudLayoutChange(fn: (L: HudLayout) => void): () => void {
  hook();
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** HUD-unit rect -> CSS px box for position:fixed DOM elements. */
export function rectToCss(L: HudLayout, r: HudRect): CssBox {
  const cssW = (L.w * L.hudScale) / L.dpr;
  const cssH = (L.h * L.hudScale) / L.dpr;
  const vw = typeof window !== "undefined" ? window.innerWidth : cssW;
  const vh = typeof window !== "undefined" ? window.innerHeight : cssH;
  const left = r.x * L.u;
  const top = r.y * L.u;
  const width = r.w * L.u;
  const height = r.h * L.u;
  return { left, top, width, height, right: vw - left - width, bottom: vh - top - height };
}
