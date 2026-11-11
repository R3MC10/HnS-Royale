// HUD skin frames (skin foundation): the painted building blocks every HUD package draws with.
// Each primitive uses painted art from art/out/hud/<id> when it has loaded (assets.ts) and otherwise a
// procedural painterly fallback (textures, gradients, bevels). All coordinates are HUD units.
// Look: dark, muted, gothic carved stone and blackened iron with worn bronze (art/STYLE.md v2).
import type { HudCircle, HudLayout, HudRect } from "../types";
import { hudArt } from "./assets";
import { skinText, skinTextW, type SkinTextOpts } from "./text";
import {
  bevel,
  chamferPath,
  devScale,
  drawAnchored,
  drawNine,
  fillTexture,
  grainTexture,
  rgba,
  rivet,
  shade,
  stoneTexture,
  texPattern,
} from "./paint";

/** Shared palette for HUD packages (muted gothic; warm accents only). */
export const SKIN = {
  ink: "#e8dcc4", // primary text (warm white)
  inkDim: "#a89c88",
  inkFaint: "#6c6458",
  gold: "#d8b860",
  goldDim: "#8c7448",
  bronze: "#7a6440",
  ember: "#e08a3a",
  blood: "#c8382c",
  frost: "#8cc8e8",
  life: "#9a1c16",
  lifeLow: "#d0382a",
  mana: "#1f3c9c",
  es: "#a8d4f0",
  stoneDark: "#0c0b0c",
  stone: "#26241f",
  iron: "#3a3a3e",
  ironLight: "#6c6862",
  tooltipBg: "#0b0908",
  locked: "#060508",
};

export type SlotState = "normal" | "hover" | "active" | "locked" | "empty" | "disabled";
export type ButtonState = "normal" | "hover" | "pressed" | "disabled";

const TAU = Math.PI * 2;

// ---- panel ----------------------------------------------------------------------------------------

export interface PanelOpts {
  /** "stone" = carved stone field in an iron frame (default); "iron" = lighter riveted iron plate. */
  variant?: "stone" | "iron";
  alpha?: number;
  /** Corner rivets (default true). */
  rivets?: boolean;
}

/** Carved-stone / iron panel filling r. */
export function drawSkinPanel(g: CanvasRenderingContext2D, r: HudRect, o: PanelOpts = {}): void {
  const variant = o.variant ?? "stone";
  g.save();
  if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
  const art = hudArt(variant === "iron" ? "hud_panel_iron" : "hud_panel");
  if (art) {
    drawNine(g, art, r);
    g.restore();
    return;
  }
  const c = Math.min(3, r.w / 6, r.h / 6);
  // body: textured stone, lit from the top-left
  chamferPath(g, r.x, r.y, r.w, r.h, c);
  g.fillStyle = "#0e0d0d";
  g.fill();
  fillTexture(g, stoneTexture(variant === "iron" ? "iron" : "stone"), variant === "iron" ? 0.75 : 0.9, r.x, r.y);
  const lg = g.createLinearGradient(r.x, r.y, r.x + r.w * 0.4, r.y + r.h);
  lg.addColorStop(0, "rgba(255,240,210,0.07)");
  lg.addColorStop(0.5, "rgba(0,0,0,0.15)");
  lg.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = lg;
  g.fill();
  // iron frame: outer dark edge, bevelled band, inner recess line
  const bw = variant === "iron" ? 1.6 : 2.2;
  g.lineWidth = bw;
  const fg = g.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  fg.addColorStop(0, "#5e5a54");
  fg.addColorStop(0.45, "#2c2a28");
  fg.addColorStop(1, "#141312");
  chamferPath(g, r.x + bw / 2, r.y + bw / 2, r.w - bw, r.h - bw, Math.max(0, c - bw / 3));
  g.strokeStyle = fg;
  g.stroke();
  bevel(g, r.x, r.y, r.w, r.h, c, 0.45, "rgba(200,190,170,0.35)", "rgba(0,0,0,0.9)");
  bevel(g, r.x + bw, r.y + bw, r.w - bw * 2, r.h - bw * 2, Math.max(0, c - bw / 2), 0.4, "rgba(0,0,0,0.85)", "rgba(170,150,120,0.22)");
  // a thin worn-bronze hairline inside the frame
  chamferPath(g, r.x + bw + 0.6, r.y + bw + 0.6, r.w - bw * 2 - 1.2, r.h - bw * 2 - 1.2, Math.max(0, c - bw));
  g.lineWidth = 0.3;
  g.strokeStyle = rgba(SKIN.bronze, 0.45);
  g.stroke();
  if (o.rivets !== false && r.w > 14 && r.h > 14) {
    const i = bw / 2 + 0.2;
    const rr = Math.min(0.9, bw * 0.42);
    rivet(g, r.x + c + i, r.y + i + 0.2, rr);
    rivet(g, r.x + r.w - c - i, r.y + i + 0.2, rr);
    rivet(g, r.x + c + i, r.y + r.h - i - 0.2, rr);
    rivet(g, r.x + r.w - c - i, r.y + r.h - i - 0.2, rr);
  }
  g.restore();
}

// ---- slot -----------------------------------------------------------------------------------------

export interface SlotOpts {
  /** Rarity / accent colour for the inner border line (null = neutral iron). */
  rarity?: string | null;
  state?: SlotState;
  /** Active-glow colour (default warm white). */
  glow?: string;
}

/** Recessed slot well + bevelled iron bezel (+ rarity line, hover/active/locked states). */
export function drawSkinSlot(g: CanvasRenderingContext2D, r: HudRect, o: SlotOpts = {}): void {
  const state = o.state ?? "normal";
  const c = Math.min(1.6, r.w / 8);
  g.save();
  const k = devScale(g);
  if (state === "active") {
    // outer glow behind the frame
    g.shadowColor = o.glow ?? "rgba(255,226,170,0.9)";
    g.shadowBlur = 2.2 * k;
    chamferPath(g, r.x, r.y, r.w, r.h, c);
    g.fillStyle = "#000";
    g.fill();
    g.shadowColor = "transparent";
    g.shadowBlur = 0;
  }
  const bg = hudArt("hud_slot_bg");
  const fr = hudArt("hud_slot");
  // well
  if (bg) {
    g.imageSmoothingEnabled = true;
    g.drawImage(bg.img, r.x, r.y, r.w, r.h);
  } else {
    chamferPath(g, r.x, r.y, r.w, r.h, c);
    g.fillStyle = state === "locked" ? SKIN.locked : "#0c0a0c";
    g.fill();
    fillTexture(g, stoneTexture("iron"), state === "locked" ? 0.25 : 0.45, r.x, r.y);
    const ig = g.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.42, r.w * 0.1, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.72);
    ig.addColorStop(0, "rgba(40,34,40,0.15)");
    ig.addColorStop(1, "rgba(0,0,0,0.75)");
    g.fillStyle = ig;
    g.fill();
  }
  if (state === "locked") {
    g.globalAlpha *= 0.85;
    g.fillStyle = "rgba(0,0,0,0.55)";
    chamferPath(g, r.x, r.y, r.w, r.h, c);
    g.fill();
    g.globalAlpha /= 0.85;
  }
  // bezel
  if (fr) drawNine(g, fr, r);
  else {
    const light = state === "hover" ? "#b4a482" : state === "locked" ? "#2e2a2c" : "#625c54";
    const dark = "#080707";
    bevel(g, r.x, r.y, r.w, r.h, c, 1, light, dark);
    chamferPath(g, r.x + 0.1, r.y + 0.1, r.w - 0.2, r.h - 0.2, c);
    g.lineWidth = 0.3;
    g.strokeStyle = "rgba(0,0,0,0.95)";
    g.stroke();
  }
  // rarity hairline
  if (o.rarity && state !== "locked") {
    chamferPath(g, r.x + 1.3, r.y + 1.3, r.w - 2.6, r.h - 2.6, Math.max(0, c - 0.6));
    g.lineWidth = 0.55;
    g.strokeStyle = rgba(o.rarity, state === "disabled" ? 0.45 : 0.9);
    g.stroke();
  }
  if (state === "hover" || state === "active") {
    chamferPath(g, r.x + 0.6, r.y + 0.6, r.w - 1.2, r.h - 1.2, c);
    g.lineWidth = 0.4;
    g.strokeStyle = state === "active" ? "rgba(255,240,205,0.9)" : "rgba(230,200,150,0.55)";
    g.stroke();
  }
  if (state === "locked") {
    // carved X
    const p = Math.max(3, r.w * 0.22);
    g.lineCap = "round";
    g.lineWidth = 0.9;
    g.strokeStyle = "rgba(0,0,0,0.9)";
    g.beginPath();
    g.moveTo(r.x + p, r.y + p);
    g.lineTo(r.x + r.w - p, r.y + r.h - p);
    g.moveTo(r.x + r.w - p, r.y + p);
    g.lineTo(r.x + p, r.y + r.h - p);
    g.stroke();
    g.lineWidth = 0.35;
    g.strokeStyle = "rgba(110,100,96,0.5)";
    g.beginPath();
    g.moveTo(r.x + p + 0.3, r.y + p + 0.5);
    g.lineTo(r.x + r.w - p + 0.3, r.y + r.h - p + 0.5);
    g.moveTo(r.x + r.w - p + 0.3, r.y + p + 0.5);
    g.lineTo(r.x + p + 0.3, r.y + r.h - p + 0.5);
    g.stroke();
  }
  if (state === "disabled") {
    chamferPath(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, c);
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fill();
  }
  g.restore();
}

// ---- globe ----------------------------------------------------------------------------------------

export interface GlobeOpts {
  /** Liquid kind: picks colour + painted texture. */
  kind: "life" | "mana" | "custom";
  /** Fill 0..1 (bottom up). */
  frac: number;
  /** Liquid base colour (default per kind). */
  color?: string;
  /** Second translucent layer over the liquid (energy shield): its own level and colour. */
  overlay?: { frac: number; color: string } | null;
  /** Renderer clock (s): drives the meniscus ripple and swirl. */
  time: number;
  /** 0..1 extra brightness (low-life pulse). */
  pulse?: number;
  /** Draw the iron rim (default true). */
  rim?: boolean;
}

function surfaceY(x: number, top: number, time: number, amp: number): number {
  return top + Math.sin(x * 0.42 + time * 2.3) * amp + Math.sin(x * 0.9 - time * 3.4) * amp * 0.45;
}

/** Path: the part of the circle below a rippling surface at level `top`. */
function liquidPath(g: CanvasRenderingContext2D, o: HudCircle, top: number, time: number, amp: number) {
  const x0 = o.cx - o.r - 1;
  const x1 = o.cx + o.r + 1;
  g.beginPath();
  g.moveTo(x0, o.cy + o.r + 1);
  for (let x = x0; x <= x1 + 0.01; x += 0.75) g.lineTo(x, surfaceY(x, top, time, amp));
  g.lineTo(x1, o.cy + o.r + 1);
  g.closePath();
}

function meniscus(g: CanvasRenderingContext2D, o: HudCircle, top: number, time: number, amp: number, color: string) {
  const x0 = o.cx - o.r - 1;
  const x1 = o.cx + o.r + 1;
  // glow band just under the surface
  const band = g.createLinearGradient(0, top - 0.5, 0, top + 2.5);
  band.addColorStop(0, rgba(color, 0.35));
  band.addColorStop(1, rgba(color, 0));
  g.fillStyle = band;
  g.beginPath();
  for (let x = x0; x <= x1 + 0.01; x += 0.75) g.lineTo(x, surfaceY(x, top, time, amp));
  for (let x = x1; x >= x0 - 0.01; x -= 0.75) g.lineTo(x, surfaceY(x, top, time, amp) + 2.5);
  g.closePath();
  g.fill();
  // bright surface line
  g.beginPath();
  for (let x = x0; x <= x1 + 0.01; x += 0.75) g.lineTo(x, surfaceY(x, top, time, amp));
  g.lineWidth = 0.45;
  g.strokeStyle = rgba(color, 0.7);
  g.stroke();
}

/** Width (HUD units) of the procedural iron rim outside radius r; rings drawn around a globe should start beyond r + this. */
export function globeRimWidth(r: number): number {
  return Math.max(1.6, r * 0.11);
}

/** Liquid globe: dark interior, liquid with meniscus + swirl, optional overlay layer, inner shadow, glass and iron rim. */
export function drawSkinGlobe(g: CanvasRenderingContext2D, o: HudCircle, opts: GlobeOpts): void {
  const { cx, cy, r } = o;
  const t = opts.time;
  const base = opts.color ?? (opts.kind === "mana" ? SKIN.mana : SKIN.life);
  const pulse = Math.max(0, Math.min(1, opts.pulse ?? 0));
  g.save();
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";

  // interior
  const back = hudArt("hud_globe_back");
  if (back) drawAnchored(g, back, cx, cy, r);
  else {
    const bg = g.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.1, cx, cy, r);
    bg.addColorStop(0, "#1c1416");
    bg.addColorStop(1, "#040303");
    g.fillStyle = bg;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
  }

  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.clip();

  const f = Math.max(0, Math.min(1, opts.frac));
  const amp = f > 0.01 && f < 0.99 ? Math.min(0.7, r * 0.03) : 0;
  if (f > 0) {
    const top = cy + r - f * r * 2;
    liquidPath(g, o, top, t, amp);
    const tex = hudArt(opts.kind === "mana" ? "hud_globe_liquid_mana" : opts.kind === "life" ? "hud_globe_liquid_life" : "");
    if (tex) {
      const upt = (r * 2) / tex.img.naturalWidth;
      const p = texPattern(g, tex.img, cx - r + t * 1.2, cy - r - t * 0.6, upt);
      g.fillStyle = p ?? base;
      g.fill();
      if (pulse > 0) {
        g.fillStyle = `rgba(255,120,90,${0.35 * pulse})`;
        g.fill();
      }
    } else {
      const lit = shade(base, 1.12 + pulse * 0.45);
      const lg = g.createRadialGradient(cx - r * 0.25, cy - r * 0.1, r * 0.05, cx, cy, r * 1.05);
      lg.addColorStop(0, lit);
      lg.addColorStop(0.5, shade(base, 0.85 + pulse * 0.3));
      lg.addColorStop(1, shade(base, 0.22));
      g.fillStyle = lg;
      g.fill();
      // slow swirl: grain texture drifting in two directions, soft-light blended
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = "soft-light";
      fillTexture(g, grainTexture(), 0.9, cx + t * 1.5, cy - t * 0.8, (r * 2.2) / 128);
      fillTexture(g, grainTexture(), 0.6, cx - t * 1.1, cy + t * 0.5, (r * 1.4) / 128);
      g.globalCompositeOperation = op;
      // dark depth at the bottom of the liquid
      const dg = g.createLinearGradient(0, cy, 0, cy + r);
      dg.addColorStop(0, "rgba(0,0,0,0)");
      dg.addColorStop(1, "rgba(0,0,0,0.45)");
      g.fillStyle = dg;
      g.fill();
    }
    if (amp > 0) meniscus(g, o, top, t, amp, opts.kind === "mana" ? "#6a8ce0" : "#d8604a");
  }

  // overlay layer (energy shield): translucent pale liquid with its own surface
  const ov = opts.overlay;
  if (ov && ov.frac > 0) {
    const of = Math.min(1, ov.frac);
    const otop = cy + r - of * r * 2;
    const oamp = of > 0.01 && of < 0.99 ? Math.min(0.5, r * 0.02) : 0;
    liquidPath(g, o, otop, t * 0.8 + 1.7, oamp);
    const eg = g.createLinearGradient(0, otop, 0, cy + r);
    eg.addColorStop(0, rgba(ov.color, 0.4));
    eg.addColorStop(1, rgba(ov.color, 0.16));
    g.fillStyle = eg;
    g.fill();
    if (oamp > 0) meniscus(g, o, otop, t * 0.8 + 1.7, oamp, "#c8e8ff");
  }

  // inner shadow
  const sh = g.createRadialGradient(cx, cy - r * 0.08, r * 0.62, cx, cy, r);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(1, "rgba(0,0,0,0.78)");
  g.fillStyle = sh;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.restore(); // clip

  // glass
  const glass = hudArt("hud_globe_glass");
  if (glass) drawAnchored(g, glass, cx, cy, r);
  else {
    g.save();
    g.translate(cx - r * 0.3, cy - r * 0.46);
    g.rotate(-0.55);
    g.scale(1, 0.55);
    const hg = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
    hg.addColorStop(0, "rgba(255,250,240,0.34)");
    hg.addColorStop(0.6, "rgba(255,250,240,0.08)");
    hg.addColorStop(1, "rgba(255,250,240,0)");
    g.fillStyle = hg;
    g.beginPath();
    g.arc(0, 0, r * 0.5, 0, TAU);
    g.fill();
    g.restore();
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.beginPath();
    g.arc(cx - r * 0.44, cy - r * 0.5, Math.max(0.35, r * 0.05), 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(220,230,255,0.10)";
    g.lineWidth = Math.max(0.5, r * 0.06);
    g.beginPath();
    g.arc(cx, cy, r * 0.88, Math.PI * 0.18, Math.PI * 0.82);
    g.stroke();
  }

  // rim
  if (opts.rim !== false) {
    const rimArt = hudArt("hud_globe_rim");
    if (rimArt) drawAnchored(g, rimArt, cx, cy, r);
    else {
      const rw = globeRimWidth(r);
      const rg = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      rg.addColorStop(0, "#77726a");
      rg.addColorStop(0.35, "#3a3734");
      rg.addColorStop(0.7, "#1a1817");
      rg.addColorStop(1, "#0b0a0a");
      g.lineWidth = rw;
      g.strokeStyle = rg;
      g.beginPath();
      g.arc(cx, cy, r + rw / 2, 0, TAU);
      g.stroke();
      fillTextureRing(g, cx, cy, r, r + rw);
      g.lineWidth = 0.45;
      g.strokeStyle = "rgba(0,0,0,0.95)";
      g.beginPath();
      g.arc(cx, cy, r + 0.15, 0, TAU);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, r + rw, 0, TAU);
      g.stroke();
      g.lineWidth = 0.3;
      g.strokeStyle = rgba(SKIN.bronze, 0.55);
      g.beginPath();
      g.arc(cx, cy, r + rw * 0.55, Math.PI * 0.95, Math.PI * 1.7);
      g.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + TAU / 16;
        rivet(g, cx + Math.cos(a) * (r + rw / 2), cy + Math.sin(a) * (r + rw / 2), Math.min(0.75, rw * 0.3));
      }
    }
  }
  g.restore();
}

function fillTextureRing(g: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number) {
  g.beginPath();
  g.arc(cx, cy, r1, 0, TAU);
  g.arc(cx, cy, r0, 0, TAU, true);
  const op = g.globalCompositeOperation;
  g.globalCompositeOperation = "soft-light";
  fillTexture(g, stoneTexture("iron"), 0.8, cx, cy);
  g.globalCompositeOperation = op;
}

/** The carved stone figure/cradle behind a globe (draw BEFORE drawSkinGlobe). side = which screen edge the globe sits at. */
export function drawSkinGlobeHolder(g: CanvasRenderingContext2D, o: HudCircle, side: "left" | "right"): void {
  const { cx, cy, r } = o;
  const art = hudArt(side === "left" ? "hud_holder_life" : "hud_holder_mana");
  if (art) {
    drawAnchored(g, art, cx, cy, r);
    return;
  }
  // Fallback (mirrored for the right side): a pointed gothic back slab, a stone cradle with horns and a plinth.
  const dir = side === "left" ? 1 : -1; // +1: the figure faces right (toward the screen centre)
  g.save();
  g.imageSmoothingEnabled = true;
  const stone = stoneTexture("stone");
  const shadeFill = (x0: number, y0: number, x1: number, y1: number, a = 0.55) => {
    const lg = g.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, "rgba(255,236,200,0.10)");
    lg.addColorStop(0.5, "rgba(0,0,0,0.15)");
    lg.addColorStop(1, `rgba(0,0,0,${a})`);
    g.fillStyle = lg;
    g.fill();
  };

  // 1) pointed-arch back slab (halo) behind the globe
  const R = r * 1.3;
  g.beginPath();
  g.moveTo(cx - R, cy + r * 0.6);
  g.lineTo(cx - R, cy);
  g.quadraticCurveTo(cx - R, cy - R * 0.9, cx, cy - R * 1.28);
  g.quadraticCurveTo(cx + R, cy - R * 0.9, cx + R, cy);
  g.lineTo(cx + R, cy + r * 0.6);
  g.closePath();
  g.fillStyle = "#0d0c0b";
  g.fill();
  fillTexture(g, stone, 0.85, cx, cy);
  shadeFill(cx - R, cy - R, cx + R * 0.4, cy + R, 0.6);
  g.lineWidth = 0.6;
  g.strokeStyle = "rgba(0,0,0,0.9)";
  g.stroke();
  // carved grooves following the arch
  g.lineWidth = 0.35;
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.beginPath();
  g.moveTo(cx - R + 1.4, cy + r * 0.5);
  g.lineTo(cx - R + 1.4, cy);
  g.quadraticCurveTo(cx - R + 1.4, cy - R * 0.84, cx, cy - R * 1.2);
  g.quadraticCurveTo(cx + R - 1.4, cy - R * 0.84, cx + R - 1.4, cy);
  g.lineTo(cx + R - 1.4, cy + r * 0.5);
  g.stroke();
  g.strokeStyle = "rgba(190,175,150,0.16)";
  g.beginPath();
  g.moveTo(cx - R + 1.8, cy + r * 0.5);
  g.lineTo(cx - R + 1.8, cy);
  g.quadraticCurveTo(cx - R + 1.8, cy - R * 0.82, cx, cy - R * 1.17);
  g.stroke();
  // finial at the apex
  g.beginPath();
  g.moveTo(cx, cy - R * 1.28 - r * 0.22);
  g.lineTo(cx - r * 0.07, cy - R * 1.22);
  g.lineTo(cx + r * 0.07, cy - R * 1.22);
  g.closePath();
  g.fillStyle = "#3a3632";
  g.fill();

  // 2) the hooded warden's shoulder/wing on the outer side (toward the screen edge)
  const ox = cx - dir * r * 1.05;
  g.beginPath();
  g.moveTo(ox - dir * r * 0.5, cy + r * 1.3);
  g.quadraticCurveTo(ox - dir * r * 0.55, cy - r * 0.3, ox - dir * r * 0.05, cy - r * 0.95);
  g.quadraticCurveTo(ox + dir * r * 0.25, cy - r * 0.55, ox + dir * r * 0.3, cy + r * 0.2);
  g.lineTo(ox + dir * r * 0.35, cy + r * 1.3);
  g.closePath();
  g.fillStyle = "#121110";
  g.fill();
  fillTexture(g, stone, 0.8, cx + 30, cy);
  shadeFill(ox - dir * r * 0.5, cy - r, ox + dir * r * 0.4, cy + r, 0.7);
  g.lineWidth = 0.5;
  g.strokeStyle = "rgba(0,0,0,0.85)";
  g.stroke();
  // hood folds
  g.lineWidth = 0.35;
  g.strokeStyle = "rgba(0,0,0,0.55)";
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(ox - dir * r * (0.35 - i * 0.12), cy + r * 1.2);
    g.quadraticCurveTo(ox - dir * r * (0.38 - i * 0.12), cy - r * 0.1, ox - dir * r * (0.05 - i * 0.05), cy - r * (0.75 - i * 0.12));
    g.stroke();
  }

  // 3) cradle: a stone crescent under the globe with horn tips gripping its sides
  const R1 = r * 1.04;
  const R2 = r * 1.32;
  const a0 = Math.PI / 2 - 2.0;
  const a1 = Math.PI / 2 + 2.0;
  g.beginPath();
  g.arc(cx, cy, R2, a0 + 0.12, a1 - 0.12);
  g.lineTo(cx + Math.cos(a1) * R1, cy + Math.sin(a1) * R1);
  g.arc(cx, cy, R1, a1, a0, true);
  g.closePath();
  g.fillStyle = "#151412";
  g.fill();
  fillTexture(g, stone, 0.9, cx - 17, cy + 5);
  const cg = g.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.4, cx, cy, R2);
  cg.addColorStop(0, "rgba(255,236,200,0.08)");
  cg.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = cg;
  g.fill();
  g.lineWidth = 0.5;
  g.strokeStyle = "rgba(0,0,0,0.9)";
  g.stroke();
  // carved ribs on the cradle
  g.lineWidth = 0.4;
  for (let i = 1; i < 8; i++) {
    const a = a0 + ((a1 - a0) * i) / 8;
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R1 + 0.4), cy + Math.sin(a) * (R1 + 0.4));
    g.lineTo(cx + Math.cos(a) * (R2 - 0.5), cy + Math.sin(a) * (R2 - 0.5));
    g.stroke();
  }
  g.lineWidth = 0.35;
  g.strokeStyle = "rgba(200,185,160,0.18)";
  g.beginPath();
  g.arc(cx, cy, R2 - 0.4, a0 + 0.3, Math.PI * 0.9);
  g.stroke();
  // iron talons at the horn tips
  for (const a of [a0, a1]) {
    const tx = cx + Math.cos(a) * (R1 + r * 0.12);
    const ty = cy + Math.sin(a) * (R1 + r * 0.12);
    const inward = a + (a === a0 ? -0.35 : 0.35);
    g.beginPath();
    g.moveTo(tx + Math.cos(a) * r * 0.16, ty + Math.sin(a) * r * 0.16);
    g.lineTo(tx + Math.cos(inward) * -r * 0.02 + Math.cos(a + Math.PI / 2) * r * 0.08, ty + Math.sin(a + Math.PI / 2) * r * 0.08);
    g.lineTo(cx + Math.cos(inward) * (r * 0.96), cy + Math.sin(inward) * (r * 0.96));
    g.closePath();
    const tg = g.createLinearGradient(tx - 2, ty - 2, tx + 2, ty + 2);
    tg.addColorStop(0, "#6e6862");
    tg.addColorStop(1, "#161514");
    g.fillStyle = tg;
    g.fill();
    g.lineWidth = 0.3;
    g.strokeStyle = "rgba(0,0,0,0.9)";
    g.stroke();
  }

  // 4) plinth block under the cradle
  const px = cx - r * 1.2;
  const py = cy + r * 0.92;
  chamferPath(g, px, py, r * 2.4, r * 0.9, 1.5);
  g.fillStyle = "#121110";
  g.fill();
  fillTexture(g, stone, 0.9, px, py);
  shadeFill(px, py, px + r * 0.6, py + r * 0.9, 0.65);
  bevel(g, px, py, r * 2.4, r * 0.9, 1.5, 0.5, "rgba(210,195,170,0.3)", "rgba(0,0,0,0.9)");
  g.restore();
}

// ---- bars -----------------------------------------------------------------------------------------

export interface BarOpts {
  frac: number;
  color: string;
  /** Optional second layer on top (e.g. ES over life): its fraction and colour. */
  frac2?: number;
  color2?: string;
  /** Tick marks every 1/ticks of the width. */
  ticks?: number;
  /** Brightened fill (ready / primed). */
  glow?: boolean;
}

/** Recessed iron channel; returns the inner fill rect. */
export function drawSkinBarFrame(g: CanvasRenderingContext2D, r: HudRect): HudRect {
  const art = hudArt("hud_bar_frame");
  const inset = r.h >= 4 ? 0.8 : 0.5;
  const inner: HudRect = { x: r.x + inset, y: r.y + inset, w: Math.max(0, r.w - inset * 2), h: Math.max(0, r.h - inset * 2) };
  g.save();
  // track
  g.fillStyle = "#070606";
  g.fillRect(r.x, r.y, r.w, r.h);
  const tg = g.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
  tg.addColorStop(0, "#030303");
  tg.addColorStop(1, "#16130f");
  g.fillStyle = tg;
  g.fillRect(inner.x, inner.y, inner.w, inner.h);
  if (art) drawNine(g, art, { x: r.x - 0.6, y: r.y - 0.6, w: r.w + 1.2, h: r.h + 1.2 });
  else {
    bevel(g, r.x - 0.4, r.y - 0.4, r.w + 0.8, r.h + 0.8, 0, 0.5, "rgba(0,0,0,0.95)", "rgba(150,135,110,0.35)");
  }
  g.restore();
  return inner;
}

/** Framed bar with a lit liquid-like fill (+ optional overlay layer and ticks). */
export function drawSkinBar(g: CanvasRenderingContext2D, r: HudRect, o: BarOpts): void {
  const inner = drawSkinBarFrame(g, r);
  const fill = (frac: number, color: string, alpha: number) => {
    const f = Math.max(0, Math.min(1, frac));
    const w = inner.w * f;
    if (w <= 0) return;
    const fg = g.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    fg.addColorStop(0, shade(color, o.glow ? 1.7 : 1.45));
    fg.addColorStop(0.45, shade(color, o.glow ? 1.2 : 1));
    fg.addColorStop(1, shade(color, 0.45));
    g.save();
    g.globalAlpha *= alpha;
    g.fillStyle = fg;
    g.fillRect(inner.x, inner.y, w, inner.h);
    g.fillStyle = "rgba(255,255,255,0.25)";
    g.fillRect(inner.x + w - Math.min(0.4, w), inner.y, Math.min(0.4, w), inner.h); // leading edge
    g.restore();
  };
  fill(o.frac, o.color, 1);
  if (o.frac2 !== undefined && o.color2) fill(o.frac2, o.color2, 0.75);
  if (o.ticks && o.ticks > 1) {
    g.fillStyle = "rgba(0,0,0,0.55)";
    for (let i = 1; i < o.ticks; i++) g.fillRect(inner.x + (inner.w * i) / o.ticks - 0.15, inner.y, 0.3, inner.h);
  }
}

// ---- strip / belt backplates ---------------------------------------------------------------------

/** Dark carved stone strip with iron rails (skill bar / belt backplate). */
export function drawSkinStrip(g: CanvasRenderingContext2D, r: HudRect, variant: "strip" | "belt" = "strip"): void {
  const art = hudArt(variant === "belt" ? "hud_belt" : "hud_strip");
  if (art) {
    drawNine(g, art, r);
    return;
  }
  g.save();
  const c = Math.min(3, r.h / 4);
  chamferPath(g, r.x, r.y, r.w, r.h, c);
  g.fillStyle = "#0b0a0a";
  g.fill();
  fillTexture(g, stoneTexture(variant === "belt" ? "leather" : "stone"), 0.9, r.x, r.y);
  const lg = g.createLinearGradient(0, r.y, 0, r.y + r.h);
  lg.addColorStop(0, "rgba(255,236,200,0.06)");
  lg.addColorStop(0.5, "rgba(0,0,0,0.25)");
  lg.addColorStop(1, "rgba(0,0,0,0.6)");
  g.fillStyle = lg;
  g.fill();
  // rails
  const rail = (y: number, h: number) => {
    const rg = g.createLinearGradient(0, y, 0, y + h);
    rg.addColorStop(0, "#6a6560");
    rg.addColorStop(0.4, "#34312e");
    rg.addColorStop(1, "#0c0b0a");
    g.fillStyle = rg;
    g.fillRect(r.x + c * 0.6, y, r.w - c * 1.2, h);
    g.fillStyle = "rgba(0,0,0,0.9)";
    g.fillRect(r.x + c * 0.6, y + h, r.w - c * 1.2, 0.3);
  };
  rail(r.y, Math.min(1.6, r.h * 0.12));
  rail(r.y + r.h - 1.1, 0.8);
  for (let x = r.x + 6; x < r.x + r.w - 4; x += 12) rivet(g, x, r.y + 0.8, 0.5);
  // end caps
  for (const ex of [r.x, r.x + r.w - 3]) {
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(ex, r.y + 1.6, 3, r.h - 2.7);
    g.fillStyle = "rgba(190,175,150,0.12)";
    g.fillRect(ex === r.x ? ex + 2.6 : ex, r.y + 1.6, 0.4, r.h - 2.7);
  }
  bevel(g, r.x, r.y, r.w, r.h, c, 0.5, "rgba(190,175,150,0.3)", "rgba(0,0,0,0.95)");
  g.restore();
}

// ---- flask vial -----------------------------------------------------------------------------------

export interface FlaskOpts {
  frac: number;
  color: string;
  /** Enough charges for a use (false = dim). */
  usable?: boolean;
  time: number;
}

/** A small glass flask filled to `frac`, fitted inside r (use inside a slot rect). */
export function drawSkinFlask(g: CanvasRenderingContext2D, r: HudRect, o: FlaskOpts): void {
  const art = hudArt("hud_flask_glass");
  const cx = r.x + r.w / 2;
  const br = Math.min(r.w * 0.36, r.h * 0.3); // body radius
  const by = r.y + r.h - br - r.h * 0.08; // body centre
  const neckW = br * 0.7;
  const neckTop = r.y + r.h * 0.14;
  g.save();
  g.imageSmoothingEnabled = true;
  if (o.usable === false) g.globalAlpha *= 0.55;
  const bodyPath = () => {
    g.beginPath();
    const k = Math.min(0.95, neckW / 2 / br);
    g.moveTo(cx - neckW / 2, neckTop + r.h * 0.06);
    // long way round the body circle: upper-left -> bottom -> upper-right (the neck joins at the top)
    g.arc(cx, by, br, -Math.acos(-k), -Math.acos(k), true);
    g.lineTo(cx + neckW / 2, neckTop + r.h * 0.06);
    g.closePath();
  };
  // back glass
  bodyPath();
  g.fillStyle = "rgba(10,10,14,0.75)";
  g.fill();
  // liquid
  const f = Math.max(0, Math.min(1, o.frac));
  if (f > 0) {
    g.save();
    bodyPath();
    g.clip();
    const yBot = by + br;
    const yTop = neckTop + r.h * 0.1;
    const top = yBot - (yBot - yTop) * f;
    const lg = g.createLinearGradient(cx - br, 0, cx + br, 0);
    lg.addColorStop(0, shade(o.color, 0.45));
    lg.addColorStop(0.4, shade(o.color, 1.1));
    lg.addColorStop(1, shade(o.color, 0.3));
    g.fillStyle = lg;
    g.fillRect(cx - br - 1, top, br * 2 + 2, yBot - top + 1);
    g.fillStyle = rgba("#ffffff", 0.35);
    g.fillRect(cx - br - 1, top, br * 2 + 2, 0.35);
    g.restore();
  }
  if (art) {
    g.drawImage(art.img, r.x + r.w * 0.1, r.y + r.h * 0.05, r.w * 0.8, r.h * 0.9);
  } else {
    // glass outline + highlight
    bodyPath();
    g.lineWidth = 0.45;
    g.strokeStyle = "rgba(200,210,220,0.45)";
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 0.4;
    g.beginPath();
    g.arc(cx, by, br * 0.72, Math.PI * 1.05, Math.PI * 1.4);
    g.stroke();
    // cork + iron band
    g.fillStyle = "#5a3e26";
    g.fillRect(cx - neckW * 0.42, neckTop - r.h * 0.05, neckW * 0.84, r.h * 0.11);
    g.fillStyle = "#3a3836";
    g.fillRect(cx - neckW * 0.6, neckTop + r.h * 0.05, neckW * 1.2, 0.6);
  }
  g.restore();
}

// ---- buttons / tooltip / label -------------------------------------------------------------------

/** Stone button with an optional centred label (display face). */
export function drawSkinButton(g: CanvasRenderingContext2D, r: HudRect, state: ButtonState = "normal", label?: string, textOpts?: SkinTextOpts): void {
  const id = state === "hover" ? "hud_button_hover" : state === "pressed" ? "hud_button_pressed" : "hud_button";
  const art = hudArt(id) ?? (state !== "normal" ? hudArt("hud_button") : null);
  g.save();
  if (state === "disabled") g.globalAlpha *= 0.5;
  if (art) drawNine(g, art, r);
  else {
    const c = Math.min(1.5, r.h / 4);
    chamferPath(g, r.x, r.y, r.w, r.h, c);
    g.fillStyle = state === "pressed" ? "#0c0b0a" : "#1a1816";
    g.fill();
    fillTexture(g, stoneTexture("stone"), 0.8, r.x, r.y);
    const lg = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (state === "pressed") {
      lg.addColorStop(0, "rgba(0,0,0,0.55)");
      lg.addColorStop(1, "rgba(0,0,0,0.1)");
    } else {
      lg.addColorStop(0, state === "hover" ? "rgba(255,190,120,0.16)" : "rgba(255,240,210,0.08)");
      lg.addColorStop(1, "rgba(0,0,0,0.45)");
    }
    g.fillStyle = lg;
    g.fill();
    if (state === "pressed") bevel(g, r.x, r.y, r.w, r.h, c, 0.6, "rgba(0,0,0,0.95)", "rgba(170,150,120,0.3)");
    else bevel(g, r.x, r.y, r.w, r.h, c, 0.6, state === "hover" ? "rgba(240,180,110,0.75)" : "rgba(170,160,140,0.45)", "rgba(0,0,0,0.95)");
  }
  if (label) {
    const size = textOpts?.size ?? Math.min(7, r.h * 0.62);
    const ty = r.y + (r.h - size) / 2 + (state === "pressed" ? 0.3 : 0);
    skinText(g, label, r.x + r.w / 2, ty, {
      face: "display",
      size,
      align: "center",
      color: state === "hover" ? "#fff0d0" : SKIN.ink,
      maxW: r.w - 2,
      ...textOpts,
    });
  }
  g.restore();
}

/** Tooltip plate. */
export function drawSkinTooltip(g: CanvasRenderingContext2D, r: HudRect): void {
  const art = hudArt("hud_tooltip");
  g.save();
  if (art) drawNine(g, art, r);
  else {
    const c = 1.2;
    chamferPath(g, r.x, r.y, r.w, r.h, c);
    g.fillStyle = "rgba(11,9,8,0.95)";
    g.fill();
    fillTexture(g, stoneTexture("iron"), 0.25, r.x, r.y);
    const lg = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    lg.addColorStop(0, "rgba(255,230,190,0.05)");
    lg.addColorStop(1, "rgba(0,0,0,0.3)");
    g.fillStyle = lg;
    g.fill();
    chamferPath(g, r.x + 0.3, r.y + 0.3, r.w - 0.6, r.h - 0.6, c);
    g.lineWidth = 0.55;
    g.strokeStyle = rgba(SKIN.bronze, 0.85);
    g.stroke();
    chamferPath(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, c * 0.6);
    g.lineWidth = 0.3;
    g.strokeStyle = "rgba(0,0,0,0.8)";
    g.stroke();
    for (const [x, y] of [[r.x + 1.6, r.y + 1.6], [r.x + r.w - 1.6, r.y + 1.6], [r.x + 1.6, r.y + r.h - 1.6], [r.x + r.w - 1.6, r.y + r.h - 1.6]])
      rivet(g, x, y, 0.45);
  }
  g.restore();
}

export interface LabelOpts {
  /** Border colour (e.g. rarity); default worn bronze. */
  border?: string;
  alpha?: number;
}

/** Small dark label plate (ground loot names, tags). */
export function drawSkinLabel(g: CanvasRenderingContext2D, r: HudRect, o: LabelOpts = {}): void {
  const art = hudArt("hud_label");
  g.save();
  if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
  if (art) {
    drawNine(g, art, r);
    if (o.border) {
      g.lineWidth = 0.4;
      g.strokeStyle = rgba(o.border, 0.85);
      g.strokeRect(r.x + 0.6, r.y + 0.6, r.w - 1.2, r.h - 1.2);
    }
  } else {
    const c = Math.min(1, r.h / 5);
    chamferPath(g, r.x, r.y, r.w, r.h, c);
    g.fillStyle = "rgba(14,10,8,0.9)";
    g.fill();
    const lg = g.createLinearGradient(0, r.y, 0, r.y + r.h);
    lg.addColorStop(0, "rgba(255,230,190,0.06)");
    lg.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = lg;
    g.fill();
    chamferPath(g, r.x + 0.25, r.y + 0.25, r.w - 0.5, r.h - 0.5, c);
    g.lineWidth = 0.4;
    g.strokeStyle = rgba(o.border ?? SKIN.bronze, o.border ? 0.85 : 0.7);
    g.stroke();
  }
  g.restore();
}

// ---- convenience ----------------------------------------------------------------------------------

/** Measure + place (beside the mouse, clamped to the screen) + draw a tooltip with lines. First line is the title. */
export function drawSkinTooltipAt(g: CanvasRenderingContext2D, L: HudLayout, mx: number, my: number, lines: string[]): HudRect | null {
  if (!lines.length) return null;
  const pad = 3;
  const titleSize = 6.5;
  const bodySize = 5.5;
  const pitch = (i: number) => (i === 0 ? titleSize + 2 : bodySize + 1.6);
  let tw = 0;
  let th = 0;
  lines.forEach((l, i) => {
    tw = Math.max(tw, skinTextW(l, i === 0 ? { face: "display", size: titleSize } : { size: bodySize }));
    th += pitch(i);
  });
  const bw = tw + pad * 2;
  const bh = th + pad * 2 - 1.6;
  let x = mx + 8;
  let y = my + 8;
  if (x + bw > L.w - 1) x = mx - 8 - bw;
  if (y + bh > L.h - 1) y = my - 8 - bh;
  x = Math.max(1, Math.min(L.w - bw - 1, x));
  y = Math.max(1, Math.min(L.h - bh - 1, y));
  const r = { x, y, w: bw, h: bh };
  drawSkinTooltip(g, r);
  let yy = y + pad;
  lines.forEach((l, i) => {
    if (i === 0) skinText(g, l, x + pad, yy, { face: "display", size: titleSize, color: "#f0e4c8" });
    else skinText(g, l, x + pad, yy, { size: bodySize, color: "#bcb2a0" });
    yy += pitch(i);
  });
  return r;
}
