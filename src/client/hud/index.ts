// HUD entry point (core package): builds the per-frame HudCtx, runs every canvas part in order,
// owns hotspots + the canvas tooltip, and routes canvas clicks to hotspots.
import type { View } from "../render";
import type { ClientMsg } from "../../shared/protocol";
import type { HotOpts, HudCtx, HudInit, HudPart, HudRect } from "./types";
import { getHudLayout } from "./layout";
import { hudState, hudTick, setHudJoined } from "./state";
export { hudHint, hudOnMessage, hudOnSnap, hudReset } from "./state"; // main.ts hooks
import { input } from "../input";
import { drawText, textWidth } from "../gfx/font";
import { drawVitals, drawVignette } from "./vitals";
import { drawBelt } from "./belt";
import { drawEffects } from "./effects";
import { drawTarget } from "./target";
import { drawRoyaleInfo, drawDeathDim } from "./royale";
import { drawKillfeed } from "./killfeed";
import { drawSpectate } from "./spectate";
import { drawScoreboard } from "./scoreboard";
import { drawBarHud, initDock, isHudHidden, updateDock } from "./dock";
import { drawBottomFrames } from "./core-frames";
import { drawSkinTooltipAt, skinText, skinTextW, preloadHudArt } from "./skin";
import { getSettings } from "../settings"; // menus package: HUD toggles

/** HudCtx.text face: "smooth" (skin kit, native resolution; default) or the legacy "pixel" font. */
let textMode: "smooth" | "pixel" = "smooth";
export function setHudTextMode(m: "smooth" | "pixel"): void {
  textMode = m;
}

interface Hotspot {
  r: HudRect;
  o: HotOpts;
}

let sendFn: (m: ClientMsg) => void = () => {};
let hots: Hotspot[] = []; // this frame (being built)
let lastHots: Hotspot[] = []; // last complete frame (click hit-test)
let hovered: Hotspot | null = null;
let ctx: HudCtx | null = null;

/** main.ts, once; also calls bar's initDock(init). */
export function initHud(init: HudInit): void {
  sendFn = init.send;
  preloadHudArt();
  try {
    initDock(init);
  } catch (e) {
    console.error("hud dock init failed", e);
  }
}

function inside(r: HudRect, x: number, y: number) {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

function run(name: string, fn: HudPart, c: HudCtx) {
  try {
    fn(c);
  } catch (e) {
    // one broken part must not take the HUD down; log once per part
    if (!failed.has(name)) {
      failed.add(name);
      console.error(`hud part ${name} failed`, e);
    }
  }
}
const failed = new Set<string>();

function drawTooltip(c: HudCtx, lines: string[]) {
  if (!lines.length) return;
  if (textMode === "smooth") {
    drawSkinTooltipAt(c.g, c.L, c.mouse.x, c.mouse.y, lines);
    return;
  }
  const g = c.g;
  const pad = 3;
  const pitch = 9;
  let tw = 0;
  for (const l of lines) tw = Math.max(tw, c.textW(l));
  const bw = tw + pad * 2;
  const bh = lines.length * pitch + pad * 2 - 2;
  let x = Math.round(c.mouse.x + 8);
  let y = Math.round(c.mouse.y + 8);
  if (x + bw > c.L.w - 1) x = Math.round(c.mouse.x - 8 - bw);
  if (y + bh > c.L.h - 1) y = Math.round(c.mouse.y - 8 - bh);
  x = Math.max(1, Math.min(c.L.w - bw - 1, x));
  y = Math.max(1, Math.min(c.L.h - bh - 1, y));
  g.fillStyle = "#0a0809e8";
  g.fillRect(x, y, bw, bh);
  g.strokeStyle = "#5a5048";
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
  lines.forEach((l, i) => c.text(l, x + pad, y + pad + i * pitch, i === 0 ? "#f0e4c8" : "#bcb2a0"));
}

/** render.ts drawHud. layer "under": every part (before the minimap); "over": scoreboard then tooltip (after the minimap). */
export function hudDraw(
  g: CanvasRenderingContext2D,
  v: View,
  time: number,
  dt: number,
  fps: number,
  toHud: (wx: number, wy: number) => { x: number; y: number },
  layer: "under" | "over",
): void {
  const L = getHudLayout();
  if (layer === "under") {
    hudTick(performance.now() / 1000);
    hots = [];
    hovered = null;
    const mouse = { x: (input.mouseX * L.dpr) / L.hudScale, y: (input.mouseY * L.dpr) / L.hudScale };
    ctx = {
      g,
      L,
      v,
      s: hudState,
      time,
      dt,
      fps,
      mouse,
      toHud,
      // Smooth skin text: a size-7 line box per scale step, same top-left anchoring as the old pixel font.
      text: (s, x, y, color, align, scale) =>
        textMode === "smooth"
          ? void skinText(g, s, x, y, { color, align, size: 7 * (scale ?? 1), face: (scale ?? 1) >= 2 ? "display" : "body" })
          : drawText(g, s, x, y, color, align, scale ?? 1),
      textW: (s, scale) =>
        textMode === "smooth" ? skinTextW(s, { size: 7 * (scale ?? 1), face: (scale ?? 1) >= 2 ? "display" : "body" }) : textWidth(s) * (scale ?? 1),
      hot: (r, o) => {
        const h = { r, o };
        hots.push(h);
        const over = inside(r, mouse.x, mouse.y);
        if (over) hovered = h; // later registrations sit on top
        return over;
      },
      send: (m) => sendFn(m),
    };
    const c = ctx;
    if (isHudHidden()) return; // bar package: "toggleHud" key (no parts, no hotspots; scoreboard still works)
    if (getSettings().interface.lowLifeVignette !== false) run("vignette", drawVignette, c); // Options > Interface
    run("deathdim", drawDeathDim, c); // royale: dim while dead (world grade: royale.ts hudWorldGrade)
    run("frames", drawBottomFrames, c);
    run("effects", drawEffects, c);
    if (getSettings().interface.targetBar !== false) run("target", drawTarget, c); // Options > Interface
    run("belt", drawBelt, c);
    run("vitals", drawVitals, c);
    run("bar", drawBarHud, c); // bar package (hud/dock.ts): weapon-set tabs, menu buttons, XP readout
    run("royale", drawRoyaleInfo, c);
    run("killfeed", drawKillfeed, c);
    run("spectate", drawSpectate, c);
    return;
  }
  // "over"
  const c = ctx && ctx.g === g ? ctx : null;
  if (!c) return;
  c.v = v;
  if (v.showScoreboard) run("scoreboard", drawScoreboard, c);
  lastHots = hots;
  const hv = hovered as Hotspot | null;
  if (hv && hv.o.tip && hv.o.tip.length) {
    try {
      drawTooltip(c, hv.o.tip);
    } catch (e) {
      console.error("hud tooltip failed", e);
    }
  }
}

/** main.ts onCanvasClick, checked before ground labels. CSS px. True = consumed. */
export function hudClick(cssX: number, cssY: number): boolean {
  const L = getHudLayout();
  const x = (cssX * L.dpr) / L.hudScale;
  const y = (cssY * L.dpr) / L.hudScale;
  for (let i = lastHots.length - 1; i >= 0; i--) {
    const h = lastHots[i];
    if (h.o.onClick && inside(h.r, x, y)) {
      try {
        h.o.onClick();
      } catch (e) {
        console.error("hud click failed", e);
      }
      return true;
    }
  }
  // vitals: any HUD hotspot (globes, flasks, buff icons, belt strap) swallows the click so it never moves/attacks.
  for (let i = lastHots.length - 1; i >= 0; i--) if (inside(lastHots[i].r, x, y)) return true;
  return false;
}

/** main.ts frame(), after renderer.draw: DOM-side parts (dock). */
export function hudFrame(v: View, joined: boolean): void {
  setHudJoined(joined); // royale: parts skip drawing outside a match
  try {
    updateDock(v, hudState);
  } catch (e) {
    if (!failed.has("dock")) {
      failed.add("dock");
      console.error("hud dock update failed", e);
    }
  }
}
