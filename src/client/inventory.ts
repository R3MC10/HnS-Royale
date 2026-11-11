// Inventory panel (right dock): paper doll (equipment, flask + charm belt) above a 12x5 grid with
// multi-cell items and a currency footer. Items move by click-to-hold (left-click lifts an item onto
// the cursor, the next click places / swaps / equips / drops it) or by drag and drop, with
// ctrl/right-click quick moves and hover tooltips. Pure view: every change is a request to the
// server, which validates it and answers with a fresh `inv` message.
import { RARITY_COLORS } from "../shared/content/loot";
import type { Slot } from "../shared/content/types";
import { GRID_H, GRID_W, fits, footprint, overlapping, type GridEntry } from "../shared/grid";
import { defaultSlotFor, isFlask, slotAccepts, type Equipment, type Item } from "../shared/items";
import type { ClientMsg, EquipTarget } from "../shared/protocol";
import type { Stats } from "../shared/stats";
import { MAX_CHARM_SLOTS, isCharm } from "../shared/content/charms";
import { isJewel } from "../shared/content/jewels";
import { CURRENCIES, isCurrency, stackSize } from "../shared/content/currency";
import { BASE_BY_ID } from "../shared/content/bases";
import { isCraftItem } from "../shared/lootinfo";
import { craftTargetOk } from "../shared/crafttarget";
import { itemArtCanvas } from "./gfx/itemart";
import { drawSkinPanel, drawSkinTooltip, hudArtVersion, hudIcon } from "./hud/skin";
import { progState } from "./prog";
import { panelHead } from "./progstyle";
import { playSfx } from "./invsfx";
import { isGem } from "../shared/skills";
import { openSkillsWith } from "./skillbar";
import { chatIsOpen, insertItemLink, setChatItemTip } from "./menus/ingame"; // menus package: chat item links
import { registerPanel } from "./options"; // menus package: Esc popup layer

export const CELL = 34; // px per grid cell

/**
 * Drop targets outside the inventory panel (e.g. passive-tree jewel sockets, client/tree.ts).
 * Called while dragging a grid item ("move", return true to claim the hover), on release ("drop",
 * return true if handled) and when the drag ends ("end").
 */
export type InvExternalDrop = (item: Item, x: number, y: number, phase: "move" | "drop" | "end") => boolean;
export const invExternalDrops: InvExternalDrop[] = [];

export interface InvState {
  equip: Equipment;
  inv: GridEntry[];
  flasks: (Item | null)[];
  charms: (Item | null)[];
  /** Unlocked charm slots (belt). */
  charmSlots: number;
  /** Inactive weapon set and which set is active (0 = I, 1 = II). */
  alt: { mainhand: Item | null; offhand: Item | null };
  set: number;
  stats: Stats;
}

/** Screen rect a tooltip should sit beside (the hovered cell / label). */
export interface TipAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface InvHooks {
  send: (m: ClientMsg) => void;
  showTip: (item: Item, x: number, y: number, compare: boolean, hint: string, anchor?: TipAnchor) => void;
  hideTip: () => void;
  toast: (text: string) => void;
  /** Close the panel (header close button). */
  close?: () => void;
}

// ---- requirements -------------------------------------------------------------------------------

export interface ReqPart {
  label: string;
  ok: boolean;
}

/** Requirement parts of an item (Level / Str / Dex / Int) checked against your level + attributes. */
export function itemReqs(item: Item): { parts: ReqPart[]; ok: boolean } {
  const r = BASE_BY_ID.get(item.b)?.req;
  if (!r) return { parts: [], ok: true };
  const m = progState.msg;
  const lv = m?.lv ?? 1;
  const d = m?.def;
  const parts: ReqPart[] = [];
  // Without progression data yet, nothing is reported as unmet.
  if (r.lvl && r.lvl > 1) parts.push({ label: `Level ${r.lvl}`, ok: !m || lv >= r.lvl });
  if (r.str) parts.push({ label: `${r.str} Str`, ok: !d || d.str >= r.str });
  if (r.dex) parts.push({ label: `${r.dex} Dex`, ok: !d || d.dex >= r.dex });
  if (r.int) parts.push({ label: `${r.int} Int`, ok: !d || d.int >= r.int });
  return { parts, ok: parts.every((p) => p.ok) };
}

// ---- layout ------------------------------------------------------------------------------------

/** Paper-doll slot positions, in cell units (original layout). */
const DOLL: { t: EquipTarget; x: number; y: number; w: number; h: number; label: string; sil: Sil }[] = [
  { t: "mainhand", x: 0, y: 0.6, w: 2, h: 4, label: "Weapon", sil: "weapon" },
  { t: "helmet", x: 3.5, y: 0, w: 2, h: 2, label: "Helm", sil: "helm" },
  { t: "offhand", x: 7, y: 0.6, w: 2, h: 4, label: "Off-hand", sil: "shield" },
  { t: "amulet", x: 5.85, y: 1.0, w: 1, h: 1, label: "Neck", sil: "amulet" },
  { t: "ring1", x: 2.15, y: 3.1, w: 1, h: 1, label: "Ring", sil: "ring" },
  { t: "body", x: 3.5, y: 2.3, w: 2, h: 3, label: "Body", sil: "body" },
  { t: "ring2", x: 5.85, y: 3.1, w: 1, h: 1, label: "Ring", sil: "ring" },
  { t: "gloves", x: 0, y: 5.0, w: 2, h: 2, label: "Hands", sil: "gloves" },
  { t: "belt", x: 3.5, y: 5.6, w: 2, h: 1, label: "Belt", sil: "belt" },
  { t: "boots", x: 7, y: 5.0, w: 2, h: 2, label: "Feet", sil: "boots" },
  { t: "flask0", x: 2.9, y: 6.9, w: 1, h: 2, label: "Flask I", sil: "flask" },
  { t: "flask1", x: 4.0, y: 6.9, w: 1, h: 2, label: "Flask II", sil: "flask" },
  { t: "flask2", x: 5.1, y: 6.9, w: 1, h: 2, label: "Flask III", sil: "flask" },
  { t: "charm0", x: 0.35, y: 7.6, w: 1, h: 1, label: "Charm", sil: "charm" },
  { t: "charm1", x: 1.45, y: 7.6, w: 1, h: 1, label: "Charm", sil: "charm" },
  { t: "charm2", x: 7.2, y: 7.6, w: 1, h: 1, label: "Charm", sil: "charm" },
];
const DOLL_W = 9;
const DOLL_H = 8.9;

const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOT = 14;
const GAP = 8;
const HEAD_H = 32;
const FOOT_H = 22;

/**
 * Natural (unscaled) size of the inventory panel in CSS px: doll, belt and grid stacked in one
 * column (doll, then grid, then the currency line). The dock can fit-scale with this.
 */
export function invNaturalSize(): { w: number; h: number } {
  const w = Math.max(GRID_W * CELL + 1, DOLL_W * CELL) + PAD_X * 2;
  const h = PAD_TOP + HEAD_H + GAP + DOLL_H * CELL + GAP + GRID_H * CELL + 1 + GAP + FOOT_H + PAD_BOT;
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

const CSS = `
#inv-panel.invp { display: none; flex-direction: column; flex-wrap: nowrap; align-items: center; gap: ${GAP}px;
  padding: ${PAD_TOP}px ${PAD_X}px ${PAD_BOT}px; width: auto; min-width: 0;
  background: #100e0d; border: none; border-radius: 0; box-shadow: 0 18px 60px rgba(0,0,0,0.85), 0 0 0 1px #050405;
  color: #d8ccb0; font-family: var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif);
  -webkit-font-smoothing: antialiased; font-smooth: auto; }
#inv-panel.invp > canvas.skin-bd { position: absolute; }
canvas.skin-bd { position: absolute; left: 0; top: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; }
#inv-panel .invp-head { align-self: stretch; height: ${HEAD_H}px; } /* shared panel header (progstyle .pc-head) */
.invp-body { display: flex; flex-direction: column; flex-wrap: nowrap; gap: ${GAP}px; align-items: center; }
.invp-doll { position: relative; flex: none;
  background: radial-gradient(ellipse at 50% 42%, rgba(120,40,20,0.14), transparent 62%); }
.invp-doll::before { content: ""; position: absolute; left: 50%; top: 10%; bottom: 8%; width: 2px; transform: translateX(-50%);
  background: linear-gradient(180deg, transparent, rgba(140,90,50,0.16), transparent); }
.invp-slot { position: absolute; box-sizing: border-box; display: flex; align-items: center; justify-content: center;
  border: 1px solid #3a3530; border-radius: 3px;
  background: radial-gradient(ellipse at 50% 40%, #1a1714, #0a0908 75%);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.85), inset 0 2px 6px rgba(0,0,0,0.9), inset 0 -1px 0 rgba(200,170,120,0.08), 0 1px 0 rgba(255,230,190,0.05); }
.invp-slot canvas.sil { position: absolute; inset: 0; margin: auto; }
.invp-slot.locked { opacity: 0.4; background: repeating-linear-gradient(135deg, #0b0a0a 0 4px, #141211 4px 8px); }
.invp-slot.can { border-color: #6f8a4a; box-shadow: inset 0 0 0 1px #050405, inset 0 0 14px rgba(110,160,60,0.3); }
.invp-slot.over { border-color: #b6e07a; }
.invp-slot.over.no, .invp-slot.no { border-color: #c0402a; box-shadow: inset 0 0 0 1px #050405, inset 0 0 14px rgba(200,40,30,0.35); }
.invp-grid { position: relative; flex: none; background-color: #0a0908;
  background-image: linear-gradient(90deg, rgba(120,104,80,0.16) 1px, transparent 1px), linear-gradient(0deg, rgba(120,104,80,0.16) 1px, transparent 1px);
  box-shadow: 0 0 0 1px #3a3530, 0 0 0 3px #070606, 0 1px 0 3px rgba(255,230,190,0.05), inset 0 0 18px rgba(0,0,0,0.85); }
.invp-grid.flash { animation: invp-flash 0.45s; }
@keyframes invp-flash { 0%, 60% { box-shadow: 0 0 0 1px #c0402a, 0 0 0 3px #3a0a06, inset 0 0 22px rgba(160,30,20,0.5); } }
.invp-item { position: absolute; box-sizing: border-box; border: 1px solid; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.invp-item:hover { filter: brightness(1.25); }
.invp-item canvas, .invp-slot canvas, .invp-ghost canvas { pointer-events: none; }
.invp-item, .invp-slot { border-radius: 3px; }
.invp-item.unusable::after, .invp-slot.unusable::after { content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: 2px;
  background: rgba(150,18,12,0.32); box-shadow: inset 0 0 10px rgba(220,40,30,0.45); }
.invp-stack { position: absolute; left: 3px; top: 1px; font-size: 12px; font-weight: 700; color: #f4e8cc; text-shadow: 0 0 3px #000, 0 0 2px #000; pointer-events: none; z-index: 1; }
.invp-applying, .invp-applying * { cursor: crosshair !important; }
.invp-item.applysrc { box-shadow: 0 0 10px 2px rgba(255,150,40,0.7); }
/* PoE2: while a currency is held, valid targets glow and the rest dim */
.invp-item.applyok, .invp-slot.applyok { box-shadow: 0 0 0 1px #f0c060, 0 0 9px 1px rgba(240,190,90,0.55), inset 0 0 10px rgba(240,190,90,0.25); }
.invp-item.applybad, .invp-slot.applybad > canvas { opacity: 0.38; filter: grayscale(0.7); }
.invp-split { position: fixed; z-index: 63; background: linear-gradient(180deg, #1a1614, #0c0a09); border: 1px solid #6a5238; border-radius: 3px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,230,190,0.08);
  padding: 8px 10px; color: #d8c8a8; font: 12px var(--font-body, "Palatino Linotype", Georgia, serif); display: flex; gap: 6px; align-items: center; }
.invp-split input[type=range] { width: 110px; }
.invp-split button { background: linear-gradient(180deg, #3a2c20, #1e1610); color: #e8d8b0; border: 1px solid #8a6a3a; border-radius: 3px; padding: 2px 8px; cursor: pointer; font: inherit; }
.invp-item.dragging, .invp-slot.dragging canvas { opacity: 0.3; }
.invp-ch { position: absolute; right: 2px; bottom: 0; font-size: 10px; color: #f0e2c4; text-shadow: 1px 1px 0 #000; pointer-events: none; z-index: 1; }
.invp-prev { position: absolute; box-sizing: border-box; pointer-events: none; border: 1px solid; }
.invp-prev.ok { border-color: #8fd060; background: rgba(110,180,60,0.18); }
.invp-prev.swap { border-color: #e0c060; background: rgba(200,160,50,0.18); }
.invp-prev.bad { border-color: #d04030; background: rgba(190,40,30,0.22); }
.invp-ghost { position: fixed; pointer-events: none; z-index: 64; display: flex; align-items: center; justify-content: center; opacity: 0.92;
  border: 1px solid; box-sizing: border-box; background: rgba(8,7,10,0.55); border-radius: 3px; box-shadow: 0 6px 18px rgba(0,0,0,0.6); }
.invp-ghost.unusable { box-shadow: 0 6px 18px rgba(0,0,0,0.6), inset 0 0 12px rgba(220,40,30,0.55); }
.invp-holding, .invp-holding * { cursor: grabbing !important; }
.invp-sets { position: absolute; left: 0; top: 0; display: flex; gap: 3px; z-index: 1; }
.invp-sets button { font: 600 10px var(--font-title, "Cinzel", Georgia, serif); padding: 0 7px; height: 16px; line-height: 14px; letter-spacing: 1px;
  background: linear-gradient(180deg, #1c1917, #0e0c0b); color: #7a7064; border: 1px solid #3a3530; border-radius: 2px; cursor: pointer; }
.invp-sets button.on { color: #f0d090; border-color: #8a6a3a; background: linear-gradient(180deg, #3a2a1a, #1e140c); }
.invp-foot { align-self: stretch; height: ${FOOT_H}px; display: flex; align-items: center; justify-content: flex-end; gap: 6px;
  color: #c8b890; font-size: 13px; padding: 0 2px; border-top: 1px solid rgba(216,184,96,0.18); }
.invp-foot b { color: #f0d898; font-variant-numeric: tabular-nums; font-weight: 700; }
.invp-foot .lbl { margin-right: auto; color: #6c6458; font-size: 11px; letter-spacing: 1px; }
`;

function injectCss() {
  if (document.getElementById("invp-css")) return;
  const st = document.createElement("style");
  st.id = "invp-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}

// ---- skin backdrop (painted panel / tooltip behind DOM panels) ---------------------------------

/** CSS px per HUD unit used when painting skin pieces behind DOM panels. */
const SKIN_UNIT = 2.6;

/**
 * Paint the HUD skin (painted art when present, procedural stone/iron otherwise) behind a DOM panel:
 * a canvas child that follows the host's size. The host must be positioned (fixed/absolute/relative).
 * Call again after replacing the host's children (re-attaches the same canvas).
 */
export function attachSkinBackdrop(host: HTMLElement, kind: "panel" | "iron" | "tooltip"): HTMLCanvasElement {
  const h = host as HTMLElement & { _skinBd?: HTMLCanvasElement; _skinRo?: ResizeObserver };
  let cv = h._skinBd;
  if (!cv) {
    cv = document.createElement("canvas");
    cv.className = "skin-bd";
    h._skinBd = cv;
    const draw = () => paintBackdrop(host, cv!, kind);
    if (typeof ResizeObserver !== "undefined") {
      h._skinRo = new ResizeObserver(draw);
      h._skinRo.observe(host);
    }
    // Painted art may arrive after the first paint: repaint once the art index version changes.
    let v = hudArtVersion();
    const poll = setInterval(() => {
      if (hudArtVersion() !== v) {
        v = hudArtVersion();
        draw();
      }
    }, 1500);
    setTimeout(() => clearInterval(poll), 20000);
  }
  if (cv.parentElement !== host) host.insertBefore(cv, host.firstChild);
  paintBackdrop(host, cv, kind);
  return cv;
}

function paintBackdrop(host: HTMLElement, cv: HTMLCanvasElement, kind: "panel" | "iron" | "tooltip") {
  const cw = host.clientWidth;
  const ch = host.clientHeight;
  if (cw <= 0 || ch <= 0) return;
  const vis = host.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const k = cw > 0 && vis.width > 0 ? vis.width / host.offsetWidth : 1; // zoom / transform scale
  const W = Math.max(1, Math.round(cw * k * dpr));
  const H = Math.max(1, Math.round(ch * k * dpr));
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  const g = cv.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const s = (k * dpr * SKIN_UNIT) || 1;
  g.setTransform(s, 0, 0, s, 0, 0);
  g.imageSmoothingEnabled = true;
  const r = { x: 0, y: 0, w: cw / SKIN_UNIT, h: ch / SKIN_UNIT };
  try {
    if (kind === "tooltip") drawSkinTooltip(g, r);
    else drawSkinPanel(g, r, { variant: kind === "iron" ? "iron" : "stone" });
  } catch {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#0e0c0b";
    g.fillRect(0, 0, W, H);
  }
}

// ---- icons + empty-slot silhouettes ---------------------------------------------------------------

/**
 * Item icon drawn smoothly into a w x h px box: the painted icon (art/out/icon/<base>.png) aspect-fit
 * when available, else the procedural vector art. A painted icon that is still loading swaps in.
 */
export function itemIconCanvas(item: Item, wpx: number, hpx: number): HTMLCanvasElement {
  const cv = itemArtCanvas(item, wpx, hpx);
  if (!paintIcon(cv, item.b, wpx, hpx)) {
    // Retry for a short while: the icon index/image may still be loading.
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (paintIcon(cv, item.b, wpx, hpx) || tries > 12 || (tries > 2 && !cv.isConnected)) clearInterval(t);
    }, 400);
  }
  return cv;
}

function paintIcon(cv: HTMLCanvasElement, id: string, wpx: number, hpx: number): boolean {
  let im: HTMLImageElement | null = null;
  try {
    im = hudIcon(id);
  } catch {
    im = null;
  }
  if (!im || !im.naturalWidth) return false;
  const g = cv.getContext("2d");
  if (!g) return false;
  const W = cv.width;
  const H = cv.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const pad = Math.min(W, H) * 0.04;
  const sc = Math.min((W - pad * 2) / im.naturalWidth, (H - pad * 2) / im.naturalHeight);
  const dw = im.naturalWidth * sc;
  const dh = im.naturalHeight * sc;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.shadowColor = "rgba(0,0,0,0.7)";
  g.shadowBlur = Math.min(W, H) * 0.06;
  g.shadowOffsetY = Math.min(W, H) * 0.02;
  g.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
  void wpx;
  void hpx;
  return true;
}

type Sil = "weapon" | "shield" | "helm" | "body" | "gloves" | "boots" | "belt" | "amulet" | "ring" | "flask" | "charm";

/** Faint carved silhouette for an empty equipment slot (original shapes, canvas-drawn). */
function silhouette(kind: Sil, w: number, h: number): HTMLCanvasElement {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const cv = document.createElement("canvas");
  cv.className = "sil";
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.width = w + "px";
  cv.style.height = h + "px";
  const g = cv.getContext("2d");
  if (!g) return cv;
  g.scale(dpr, dpr);
  // Normalised drawing space: unit box centred in the slot, keeping aspect.
  const s = Math.min(w, h) * 0.78;
  g.translate(w / 2, h / 2);
  g.scale(s, s);
  g.lineJoin = "round";
  g.lineCap = "round";
  const P = new Path2D();
  const tall = h / w; // 2 for 1x2 / 2x4 slots
  switch (kind) {
    case "weapon": {
      const L = 0.5 * tall; // half-length
      P.moveTo(0, -L);
      P.lineTo(0.08, -L + 0.16);
      P.lineTo(0.08, L * 0.42);
      P.lineTo(-0.08, L * 0.42);
      P.lineTo(-0.08, -L + 0.16);
      P.closePath();
      P.rect(-0.28, L * 0.42, 0.56, 0.08);
      P.rect(-0.05, L * 0.42 + 0.08, 0.1, L * 0.36);
      P.arc(0, L * 0.42 + 0.1 + L * 0.36, 0.08, 0, Math.PI * 2);
      break;
    }
    case "shield": {
      const T = 0.38 * tall;
      P.moveTo(-0.4, -T);
      P.quadraticCurveTo(0, -T - 0.12, 0.4, -T);
      P.lineTo(0.4, T * 0.15);
      P.quadraticCurveTo(0.36, T * 0.8, 0, T);
      P.quadraticCurveTo(-0.36, T * 0.8, -0.4, T * 0.15);
      P.closePath();
      break;
    }
    case "helm":
      P.moveTo(-0.36, 0.34);
      P.lineTo(-0.36, -0.02);
      P.bezierCurveTo(-0.36, -0.46, 0.36, -0.46, 0.36, -0.02);
      P.lineTo(0.36, 0.34);
      P.lineTo(0.12, 0.34);
      P.lineTo(0.12, 0.02);
      P.lineTo(-0.12, 0.02);
      P.lineTo(-0.12, 0.34);
      P.closePath();
      break;
    case "body": {
      const T = 0.33 * tall;
      P.moveTo(-0.16, -T);
      P.lineTo(-0.44, -T + 0.12);
      P.lineTo(-0.48, -T + 0.42);
      P.lineTo(-0.3, -T + 0.46);
      P.lineTo(-0.3, T);
      P.lineTo(0.3, T);
      P.lineTo(0.3, -T + 0.46);
      P.lineTo(0.48, -T + 0.42);
      P.lineTo(0.44, -T + 0.12);
      P.lineTo(0.16, -T);
      P.quadraticCurveTo(0, -T + 0.12, -0.16, -T);
      P.closePath();
      break;
    }
    case "gloves":
      P.moveTo(-0.22, 0.42);
      P.lineTo(-0.24, -0.06);
      P.lineTo(-0.34, -0.2);
      P.lineTo(-0.26, -0.26);
      P.lineTo(-0.16, -0.16);
      P.lineTo(-0.16, -0.42);
      P.lineTo(0.2, -0.42);
      P.lineTo(0.24, 0.08);
      P.lineTo(0.22, 0.42);
      P.closePath();
      break;
    case "boots":
      P.moveTo(-0.24, -0.42);
      P.lineTo(0.08, -0.42);
      P.lineTo(0.08, 0.12);
      P.lineTo(0.38, 0.22);
      P.lineTo(0.4, 0.4);
      P.lineTo(-0.26, 0.4);
      P.closePath();
      break;
    case "belt": {
      const W2 = 0.5 / tall; // wide slot: tall = 0.5
      P.rect(-W2 * 0.95, -0.11, W2 * 1.9, 0.22);
      P.rect(-0.14, -0.17, 0.28, 0.34);
      break;
    }
    case "amulet":
      P.moveTo(-0.3, -0.42);
      P.quadraticCurveTo(0, 0.06, 0.3, -0.42);
      P.moveTo(0.16, 0.16);
      P.arc(0, 0.16, 0.16, 0, Math.PI * 2);
      break;
    case "ring":
      P.arc(0, 0.04, 0.3, 0, Math.PI * 2);
      P.moveTo(0.18, 0.04);
      P.arc(0, 0.04, 0.18, 0, Math.PI * 2, true);
      P.moveTo(0.1, -0.3);
      P.arc(0, -0.3, 0.1, 0, Math.PI * 2);
      break;
    case "flask": {
      const T = 0.4 * tall;
      P.rect(-0.1, -T, 0.2, 0.18);
      P.moveTo(-0.1, -T + 0.18);
      P.lineTo(-0.1, -T + 0.4);
      P.quadraticCurveTo(-0.34, -T + 0.52, -0.34, -T + 0.84);
      P.lineTo(-0.34, T - 0.06);
      P.quadraticCurveTo(-0.34, T, -0.28, T);
      P.lineTo(0.28, T);
      P.quadraticCurveTo(0.34, T, 0.34, T - 0.06);
      P.lineTo(0.34, -T + 0.84);
      P.quadraticCurveTo(0.34, -T + 0.52, 0.1, -T + 0.4);
      P.lineTo(0.1, -T + 0.18);
      P.closePath();
      break;
    }
    case "charm":
      P.moveTo(0, -0.4);
      P.lineTo(0.3, 0);
      P.lineTo(0, 0.4);
      P.lineTo(-0.3, 0);
      P.closePath();
      break;
  }
  g.fillStyle = "rgba(200,180,150,0.07)";
  g.fill(P, "evenodd");
  g.lineWidth = 0.025;
  g.strokeStyle = "rgba(210,190,160,0.16)";
  g.stroke(P);
  return cv;
}

function rarityBg(item: Item): string {
  if ((item.r as number) === 3) return "radial-gradient(ellipse at 50% 45%, rgba(190,100,30,0.28), rgba(40,20,8,0.2))";
  return item.r === 2 ? "rgba(120,100,30,0.16)" : item.r === 1 ? "rgba(60,70,150,0.16)" : "rgba(90,85,80,0.10)";
}

type DragSrc = { k: "grid"; e: GridEntry } | { k: "slot"; t: EquipTarget };

interface Drag {
  item: Item;
  src: DragSrc;
  sx: number; // mouse down position
  sy: number;
  gx: number; // grab offset inside the item, visual px
  gy: number;
  started: boolean;
  /** Click-to-hold: the item rides on the cursor until the next click. */
  held?: boolean;
  ghost?: HTMLDivElement;
  srcEl: HTMLElement;
}

/** Currency being applied (right-clicked in the bag), so other panels (skill gems) can take the click. */
let activeInv: InventoryView | null = null;
export function applyingCurrency(): Item | null {
  return activeInv?.applyingItem() ?? null;
}
/** Apply the held currency to an item shown outside the bag (e.g. a gem on the skill bar). */
export function applyCurrencyTo(targetId: number, keep: boolean): void {
  activeInv?.applyTo(targetId, keep);
}

export class InventoryView {
  private st: InvState | null = null;
  private gridEl: HTMLDivElement | null = null;
  private prevEl: HTMLDivElement | null = null;
  private slotEls = new Map<EquipTarget, HTMLDivElement>();
  private drag: Drag | null = null;
  /** Currency being applied (right-clicked), waiting for a target click. */
  private applying: Item | null = null;
  private splitEl: HTMLDivElement | null = null;
  /** After a swap: the displaced item to lift onto the cursor when the server's update arrives. */
  private pendingHold: { id: number; until: number } | null = null;
  private mouse = { x: 0, y: 0 };

  applyingItem(): Item | null {
    return this.applying;
  }

  applyTo(targetId: number, keep: boolean) {
    const cur = this.applying;
    if (!cur || cur.id === targetId) return;
    this.h.send({ t: "useCurrency", id: cur.id, on: targetId });
    playSfx("inv.place");
    if (!keep || stackSize(cur) <= 1) this.stopApply();
  }

  constructor(private root: HTMLDivElement, private h: InvHooks) {
    activeInv = this; // eslint-disable-line @typescript-eslint/no-this-alias
    injectCss();
    root.classList.add("invp");
    // menus package: hovering a linked item in chat shows this tooltip; Esc cancels modes before panels.
    setChatItemTip((it, x, y, cmp, hint) => this.h.showTip(it, x, y, cmp, hint), () => this.h.hideTip());
    registerPanel({ isOpen: () => false, close: () => {}, layer: "popup", popup: () => this.escapePopup() });
    window.addEventListener("mousemove", (e) => this.onMove(e));
    window.addEventListener("mouseup", (e) => this.onUp(e));
    // A held item resolves on the next press, before anything else (item cells, the game canvas) sees it.
    window.addEventListener("mousedown", (e) => this.onHeldDown(e), true);
    window.addEventListener(
      "contextmenu",
      (e) => {
        if (this.drag?.held) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
    // Esc puts a held / dragged item back where it came from (and does nothing else).
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape" && this.drag?.started) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.cancelDrag();
          playSfx("inv.place");
        }
      },
      true,
    );
    // Right-click anywhere (outside an item) cancels currency application.
    window.addEventListener("contextmenu", (e) => {
      if (this.applying && !(e.target as HTMLElement | null)?.closest?.(".invp-item, .invp-slot")) this.stopApply();
    });
  }

  /** Esc (options.ts popup layer): cancel currency targeting / the split box first; true if one was open. */
  escapePopup(): boolean {
    if (!this.applying && !this.splitEl) return false;
    this.cancelModes();
    return true;
  }

  /** Esc / panel close: leave currency mode and close the split box. */
  cancelModes() {
    this.stopApply();
    this.closeSplit();
  }

  private startApply(cur: Item) {
    this.applying = cur;
    this.root.classList.add("invp-applying");
    this.root.querySelector(`[data-id="${cur.id}"]`)?.classList.add("applysrc");
    this.markTargets();
    this.h.toast(`${cur.n}: click an item to apply · right-click to cancel`);
  }

  private stopApply() {
    if (!this.applying) return;
    this.applying = null;
    this.root.classList.remove("invp-applying");
    this.root.querySelectorAll(".applysrc").forEach((el) => el.classList.remove("applysrc"));
    this.root.querySelectorAll(".applyok, .applybad").forEach((el) => el.classList.remove("applyok", "applybad"));
  }

  /** PoE2 valid-target highlight: every bag / equipped item the held currency would act on glows. */
  private markTargets() {
    const cur = this.applying;
    const st = this.st;
    if (!cur || !st) return;
    const mark = (el: Element | null | undefined, it: Item | null) => {
      if (!el || !it || it.id === cur.id) return;
      const ok = craftTargetOk(cur, it);
      if (ok === null) return;
      el.classList.add(ok ? "applyok" : "applybad");
    };
    for (const e of st.inv) mark(this.gridEl?.querySelector(`[data-id="${e.it.id}"]`), e.it);
    for (const [t, el] of this.slotEls) mark(el, this.slotItem(t));
  }

  private closeSplit() {
    this.splitEl?.remove();
    this.splitEl = null;
  }

  /** Shift+click a stack: choose how many to take off into a new stack (first free cell). */
  private openSplit(item: Item, x: number, y: number) {
    this.closeSplit();
    const n = stackSize(item);
    const box = document.createElement("div");
    box.className = "invp-split";
    box.innerHTML = `<span>Split</span><input type="range" min="1" max="${n - 1}" value="${Math.floor(n / 2)}"><b>${Math.floor(n / 2)}</b><button>Take</button>`;
    const range = box.querySelector("input")!;
    const out = box.querySelector("b")!;
    range.addEventListener("input", () => (out.textContent = range.value));
    box.querySelector("button")!.addEventListener("click", () => {
      this.h.send({ t: "split", id: item.id, n: Number(range.value) });
      playSfx("inv.place");
      this.closeSplit();
    });
    box.addEventListener("mousedown", (e) => e.stopPropagation());
    box.style.left = x + 8 + "px";
    box.style.top = y + 8 + "px";
    document.body.appendChild(box);
    this.splitEl = box;
  }

  get dragging() {
    return !!this.drag?.started;
  }

  /** An item is riding on the cursor (click-to-hold). */
  get holding() {
    return !!this.drag?.held;
  }

  flashNoRoom() {
    const g = this.gridEl;
    if (!g) return;
    g.classList.remove("flash");
    void g.offsetWidth;
    g.classList.add("flash");
  }

  /** Ends any drag / held item; the item stays where the server has it (its origin). */
  cancelDrag() {
    this.closeSplit();
    this.pendingHold = null;
    if (!this.drag) return;
    this.drag.ghost?.remove();
    this.drag.srcEl.classList.remove("dragging");
    document.body.classList.remove("invp-holding");
    for (const f of invExternalDrops) f(this.drag.item, 0, 0, "end");
    this.drag = null;
    this.clearHighlights();
  }

  /** Visual px per layout px of the panel (UI-scale zoom, dock fit-scale). */
  private scaleK(): number {
    const g = this.gridEl;
    if (g && g.isConnected) {
      const w = g.getBoundingClientRect().width;
      if (w > 0) return w / (GRID_W * CELL + 1);
    }
    const r = this.root.getBoundingClientRect().width;
    return r > 0 && this.root.offsetWidth > 0 ? r / this.root.offsetWidth : 1;
  }

  // ---- build ----------------------------------------------------------------------

  build(st: InvState) {
    this.st = st;
    const root = this.root;
    root.innerHTML = "";
    this.slotEls.clear();

    const head = panelHead("Belongings", "inventory", () => this.h.close?.());
    head.classList.add("invp-head");
    root.appendChild(head);

    const body = document.createElement("div");
    body.className = "invp-body";
    body.appendChild(this.buildDoll(st));
    body.appendChild(this.buildGrid(st));
    root.appendChild(body);
    root.appendChild(this.buildFooter(st));
    attachSkinBackdrop(root, "panel");
    this.reattachDrag();
    this.takePendingHold();
    // Shift-repeat currency: follow the held stack through server updates; stop when it runs out.
    if (this.applying) {
      const id = this.applying.id;
      const still = st.inv.find((e) => e.it.id === id)?.it;
      if (still) {
        this.applying = still;
        this.markTargets();
      } else this.stopApply();
    }
  }

  private buildFooter(st: InvState): HTMLDivElement {
    const foot = document.createElement("div");
    foot.className = "invp-foot";
    let total = 0;
    let sample: Item | null = null;
    for (const e of st.inv)
      if (e.it.b.startsWith("cur_") || isCurrency(e.it)) {
        total += stackSize(e.it);
        sample ??= e.it;
      }
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = "Right-click an Ember, then click an item";
    foot.appendChild(lbl);
    const icon = sample ?? ({ id: -1, b: CURRENCIES[0]?.id ?? "cur_kindling", r: 0, l: 1, n: "Ember", m: [] } as Item);
    foot.appendChild(itemIconCanvas(icon, 18, 18));
    const t = document.createElement("span");
    t.innerHTML = `Embers <b>${total.toLocaleString()}</b>`;
    foot.appendChild(t);
    foot.title = "Total Embers carried (all kinds)";
    return foot;
  }

  /** A server update arrived mid-drag: point the drag at the rebuilt element, or cancel if the item moved away. */
  private reattachDrag() {
    const d = this.drag;
    if (!d) return;
    const el =
      d.src.k === "slot"
        ? this.slotEls.get(d.src.t)
        : (this.gridEl?.querySelector(`[data-id="${d.item.id}"]`) as HTMLElement | null) ?? undefined;
    const still = d.src.k === "slot" ? this.slotItem(d.src.t)?.id === d.item.id : !!el;
    if (!el || !still) {
      this.cancelDrag();
      return;
    }
    if (d.src.k === "grid") {
      const e = this.st!.inv.find((x) => x.it.id === d.item.id);
      if (e) d.src = { k: "grid", e };
    }
    d.srcEl = el;
    if (d.started) {
      el.classList.add("dragging");
      this.markSlots(d.item);
    }
  }

  /** Lift the item displaced by a swap onto the cursor (PoE-style held swap). */
  private takePendingHold() {
    const p = this.pendingHold;
    if (!p || this.drag) return;
    if (performance.now() > p.until) {
      this.pendingHold = null;
      return;
    }
    const e = this.st?.inv.find((x) => x.it.id === p.id);
    const el = e ? (this.gridEl?.querySelector(`[data-id="${p.id}"]`) as HTMLElement | null) : null;
    if (!e || !el) return; // not in the grid yet: wait for the next update
    this.pendingHold = null;
    const k = this.scaleK();
    const fp = footprint(e.it);
    const d: Drag = { item: e.it, src: { k: "grid", e }, sx: this.mouse.x, sy: this.mouse.y, gx: (fp.w * CELL * k) / 2, gy: (fp.h * CELL * k) / 2, started: false, srcEl: el };
    this.drag = d;
    this.startDrag(d, true);
    this.positionGhost(d, this.mouse.x, this.mouse.y);
    this.preview(d, this.mouse.x, this.mouse.y);
  }

  private slotItem(t: EquipTarget): Item | null {
    const st = this.st!;
    if (t.startsWith("flask")) return st.flasks[Number(t.slice(5))] ?? null;
    if (t.startsWith("charm")) return st.charms[Number(t.slice(5))] ?? null;
    return st.equip[t as Slot];
  }

  private buildDoll(st: InvState): HTMLDivElement {
    const doll = document.createElement("div");
    doll.className = "invp-doll";
    doll.style.width = DOLL_W * CELL + "px";
    doll.style.height = DOLL_H * CELL + "px";
    // Weapon set tabs (I / II): clicking the inactive one swaps sets (also the weapon-swap key).
    const sets = document.createElement("div");
    sets.className = "invp-sets";
    const altNames = [st.alt.mainhand?.n, st.alt.offhand?.n].filter(Boolean).join(" + ") || "empty";
    for (const i of [0, 1]) {
      const b = document.createElement("button");
      b.textContent = i === 0 ? "I" : "II";
      if (st.set === i) b.classList.add("on");
      b.title = st.set === i ? "Active weapon set" : `Swap to set ${b.textContent} (${altNames})`;
      b.addEventListener("click", () => {
        if (st.set !== i) {
          playSfx("inv.equip");
          this.h.send({ t: "weaponSwap" });
        }
      });
      sets.appendChild(b);
    }
    doll.appendChild(sets);
    for (const d of DOLL) {
      const el = document.createElement("div");
      el.className = "invp-slot";
      el.dataset.target = d.t;
      el.style.left = d.x * CELL + "px";
      el.style.top = d.y * CELL + "px";
      el.style.width = d.w * CELL + "px";
      el.style.height = d.h * CELL + "px";
      const fi = d.t.startsWith("flask") ? Number(d.t.slice(5)) : -1;
      const ci = d.t.startsWith("charm") ? Number(d.t.slice(5)) : -1;
      const locked = (fi >= 0 && fi >= st.stats.flaskSlots) || (ci >= 0 && ci >= st.charmSlots);
      const item = this.slotItem(d.t);
      if (locked) el.classList.add("locked");
      if (item) {
        el.style.borderColor = RARITY_COLORS[item.r];
        el.style.background = rarityBg(item);
        el.appendChild(itemIconCanvas(item, d.w * CELL - 2, d.h * CELL - 2));
        if (isFlask(item)) el.appendChild(this.chargeLabel(item));
        if (!itemReqs(item).ok) el.classList.add("unusable");
        this.bindItem(el, item, { k: "slot", t: d.t });
      } else {
        el.appendChild(silhouette(d.sil, d.w * CELL - 2, d.h * CELL - 2));
        el.title = locked ? (ci >= 0 ? "Charm slot: a better belt unlocks it" : `${d.label}: a better belt unlocks it`) : d.label;
      }
      this.slotEls.set(d.t, el);
      doll.appendChild(el);
    }
    return doll;
  }

  private buildGrid(st: InvState): HTMLDivElement {
    const grid = document.createElement("div");
    grid.className = "invp-grid";
    grid.style.width = GRID_W * CELL + 1 + "px";
    grid.style.height = GRID_H * CELL + 1 + "px";
    grid.style.backgroundSize = `${CELL}px ${CELL}px`;
    for (const e of st.inv) {
      const fp = footprint(e.it);
      const el = document.createElement("div");
      el.className = "invp-item";
      el.style.left = e.x * CELL + 1 + "px";
      el.style.top = e.y * CELL + 1 + "px";
      el.style.width = fp.w * CELL - 1 + "px";
      el.style.height = fp.h * CELL - 1 + "px";
      el.style.borderColor = RARITY_COLORS[e.it.r];
      el.style.background = rarityBg(e.it);
      el.dataset.id = String(e.it.id);
      el.appendChild(itemIconCanvas(e.it, fp.w * CELL - 3, fp.h * CELL - 3));
      if (isFlask(e.it)) el.appendChild(this.chargeLabel(e.it));
      if (stackSize(e.it) > 1) {
        const k = document.createElement("span");
        k.className = "invp-stack";
        k.textContent = String(stackSize(e.it));
        el.appendChild(k);
      }
      if (!itemReqs(e.it).ok) el.classList.add("unusable");
      if (this.applying?.id === e.it.id) el.classList.add("applysrc");
      this.bindItem(el, e.it, { k: "grid", e });
      grid.appendChild(el);
    }
    const prev = document.createElement("div");
    prev.className = "invp-prev";
    prev.style.display = "none";
    grid.appendChild(prev);
    this.prevEl = prev;
    this.gridEl = grid;
    return grid;
  }

  private chargeLabel(item: Item) {
    const c = document.createElement("span");
    c.className = "invp-ch";
    c.textContent = String(Math.floor(item.c ?? 0));
    return c;
  }

  // ---- interaction --------------------------------------------------------------

  private bindItem(el: HTMLElement, item: Item, src: DragSrc) {
    const inGrid = src.k === "grid";
    const hint = isCraftItem(item) && inGrid
      ? "Right-click, then click an item to apply" + (stackSize(item) > 1 ? " · Shift+click: split stack" : "")
      : stackSize(item) > 1 && inGrid
        ? "Click: pick up · Shift+click: split stack · Ctrl+click: quick move"
        : inGrid && isJewel(item)
          ? "Ctrl+click or right-click: socket into a free Jewel Socket · or drag onto a socket on the passive tree"
        : inGrid
          ? "Click: pick up · Ctrl+click: equip · Ctrl+Shift+click a ring: second ring slot"
          : "Click: pick up · Ctrl+click: unequip";
    el.addEventListener("mousemove", (e) => {
      if (!this.drag?.started) this.h.showTip(item, e.clientX, e.clientY, inGrid && !this.applying, this.applying ? `Apply ${this.applying.n}` : hint, el.getBoundingClientRect());
    });
    el.addEventListener("mouseleave", () => this.h.hideTip());
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.h.hideTip();
      if (this.applying) return this.stopApply();
      if (inGrid && isCraftItem(item)) return this.startApply(item); // Embers, runes, ichors (shared/lootinfo.ts)
      this.quickMove(item, src, e.shiftKey);
    });
    el.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.h.hideTip();
      if (this.applying) {
        // Currency mode: this click picks the target.
        const cur = this.applying;
        if (cur.id !== item.id) {
          this.h.send({ t: "useCurrency", id: cur.id, on: item.id });
          playSfx("inv.place");
        }
        if (!e.shiftKey || stackSize(cur) <= 1) this.stopApply(); // Shift keeps applying (PoE-style)
        return;
      }
      // Chat input open: Ctrl / Shift+click links the item into the message (menus/ingame.ts).
      if ((e.shiftKey || e.ctrlKey || e.metaKey) && chatIsOpen()) {
        insertItemLink(item);
        return;
      }
      if (e.shiftKey && !e.ctrlKey && inGrid && stackSize(item) > 1) {
        this.openSplit(item, e.clientX, e.clientY);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        this.quickMove(item, src, e.shiftKey);
        return;
      }
      const r = el.getBoundingClientRect();
      this.drag = { item, src, sx: e.clientX, sy: e.clientY, gx: e.clientX - r.left, gy: e.clientY - r.top, started: false, srcEl: el };
    });
  }

  /** Ctrl+click / right-click: grid -> its slot, slot -> grid. */
  private quickMove(item: Item, src: DragSrc, shift: boolean) {
    if (src.k === "slot") {
      this.h.send({ t: "unequip", from: src.t });
      playSfx("inv.place");
      return;
    }
    const charm: boolean = isCharm(item);
    if (isFlask(item) || charm) {
      playSfx("inv.equip");
      this.h.send({ t: "equip", id: item.id });
      return;
    }
    const jewel: boolean = isJewel(item);
    if (jewel) {
      this.h.send({ t: "jewel", id: item.id }); // first free allocated socket; the server explains if there is none
      return;
    }
    const slot = this.st ? defaultSlotFor(item, this.st.equip) : null;
    if (!slot && isGem(item)) {
      openSkillsWith(item.id); // gems: straight to the Skills panel, already picked up (cut it / click a slot or socket)
      return;
    }
    if (!slot) {
      this.h.toast("Can't equip that");
      return;
    }
    const rq = itemReqs(item);
    if (!rq.ok) {
      this.h.toast(`Requires ${rq.parts.filter((p) => !p.ok).map((p) => p.label).join(", ")}`);
      return;
    }
    playSfx("inv.equip");
    const to: EquipTarget | undefined = shift && slot.startsWith("ring") ? "ring2" : undefined;
    this.h.send({ t: "equip", id: item.id, to });
  }

  private startDrag(d: Drag, held = false) {
    d.started = true;
    d.held = held;
    const k = this.scaleK();
    const fp = footprint(d.item);
    const g = document.createElement("div");
    g.className = "invp-ghost";
    g.style.width = fp.w * CELL * k + "px";
    g.style.height = fp.h * CELL * k + "px";
    g.style.borderColor = RARITY_COLORS[d.item.r];
    if (!itemReqs(d.item).ok) g.classList.add("unusable");
    g.appendChild(itemIconCanvas(d.item, fp.w * CELL * k - 2, fp.h * CELL * k - 2));
    document.body.appendChild(g);
    d.ghost = g;
    // Grab offset relative to the ghost (slot frames can be bigger than the footprint).
    d.gx = Math.max(0, Math.min(d.gx, fp.w * CELL * k - (CELL * k) / 2));
    d.gy = Math.max(0, Math.min(d.gy, fp.h * CELL * k - (CELL * k) / 2));
    d.srcEl.classList.add("dragging");
    if (held) document.body.classList.add("invp-holding");
    playSfx("inv.pick");
    this.markSlots(d.item);
  }

  /** Glow the slots this item could go into; slots of its kind it can't use (requirements) show red. */
  private markSlots(item: Item) {
    const ok = itemReqs(item).ok;
    for (const [t, el] of this.slotEls) {
      if (!this.fitsSlot(t, item)) continue;
      el.classList.add(ok ? "can" : "no");
    }
  }

  /** Slot type / lock check only. */
  private fitsSlot(t: EquipTarget, item: Item): boolean {
    if (t.startsWith("flask")) return isFlask(item) && Number(t.slice(5)) < (this.st?.stats.flaskSlots ?? 1);
    if (t.startsWith("charm")) return isCharm(item) && Number(t.slice(5)) < Math.min(MAX_CHARM_SLOTS, this.st?.charmSlots ?? 0);
    const charm: boolean = isCharm(item);
    return !isFlask(item) && !charm && slotAccepts(t as Slot, item);
  }

  /** Can the item go into this slot right now (type, lock and requirements)? */
  private accepts(t: EquipTarget, item: Item): boolean {
    return this.fitsSlot(t, item) && itemReqs(item).ok;
  }

  private clearHighlights() {
    if (this.prevEl) this.prevEl.style.display = "none";
    for (const el of this.slotEls.values()) el.classList.remove("can", "over", "no");
  }

  /** Where the dragged item would land in the grid (top-left cell), or null if not over the grid. */
  private gridCell(d: Drag, mx: number, my: number): { x: number; y: number } | null {
    const g = this.gridEl;
    if (!g || !g.isConnected) return null;
    const r = g.getBoundingClientRect();
    if (mx < r.left || mx >= r.right || my < r.top || my >= r.bottom) return null;
    const cell = CELL * this.scaleK();
    const left = mx - d.gx - r.left;
    const top = my - d.gy - r.top;
    return { x: Math.round(left / cell), y: Math.round(top / cell) };
  }

  private slotUnder(mx: number, my: number): EquipTarget | null {
    for (const [t, el] of this.slotEls) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (mx >= r.left && mx < r.right && my >= r.top && my < r.bottom) return t;
    }
    return null;
  }

  /** Grid drop classification: ok (free), swap (exactly one item to swap), bad. */
  private gridDrop(d: Drag, x: number, y: number): { kind: "ok" | "swap" | "bad"; other?: GridEntry } {
    const st = this.st!;
    const fp = footprint(d.item);
    if (!fits([], fp, x, y)) return { kind: "bad" };
    const hit = overlapping(st.inv, fp, x, y, d.item.id);
    if (hit.length === 0) return { kind: "ok" };
    if (hit.length > 1) return { kind: "bad" };
    if (d.src.k === "grid") return { kind: "swap", other: hit[0] }; // includes merging onto a matching stack
    // From a slot: swap only with an item that fits that slot.
    return this.accepts(d.src.t, hit[0].it) ? { kind: "swap", other: hit[0] } : { kind: "bad" };
  }

  private positionGhost(d: Drag, x: number, y: number) {
    if (!d.ghost) return;
    d.ghost.style.left = x - d.gx + "px";
    d.ghost.style.top = y - d.gy + "px";
  }

  private onMove(e: MouseEvent) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    const d = this.drag;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      this.startDrag(d);
    }
    this.positionGhost(d, e.clientX, e.clientY);
    this.preview(d, e.clientX, e.clientY);
  }

  /** Placement preview (grid cells / slot highlight / external target) under the cursor. */
  private preview(d: Drag, mx: number, my: number) {
    for (const el of this.slotEls.values()) el.classList.remove("over");
    const prev = this.prevEl;
    if (!prev) return;
    prev.style.display = "none";
    const cell = this.gridCell(d, mx, my);
    if (cell) {
      const fp = footprint(d.item);
      const res = this.gridDrop(d, cell.x, cell.y);
      prev.className = "invp-prev " + res.kind;
      prev.style.display = "block";
      prev.style.left = Math.max(0, cell.x) * CELL + "px";
      prev.style.top = Math.max(0, cell.y) * CELL + "px";
      prev.style.width = Math.min(fp.w, GRID_W - Math.max(0, cell.x)) * CELL + 1 + "px";
      prev.style.height = Math.min(fp.h, GRID_H - Math.max(0, cell.y)) * CELL + 1 + "px";
      return;
    }
    if (d.src.k === "grid") for (const f of invExternalDrops) if (f(d.item, mx, my, "move")) return;
    const t = this.slotUnder(mx, my);
    if (t) {
      const el = this.slotEls.get(t)!;
      el.classList.add("over");
      if (!this.accepts(t, d.item)) el.classList.add("no");
    }
  }

  /** Capture-phase press while an item is held: place / swap / equip / drop it. */
  private onHeldDown(e: MouseEvent) {
    const d = this.drag;
    if (!d?.held) return;
    if ((e.target as HTMLElement | null)?.closest?.(".invp-split, #hns-menu")) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return; // other buttons do nothing while holding
    this.resolve(d, e.clientX, e.clientY);
  }

  private onUp(e: MouseEvent) {
    const d = this.drag;
    if (!d || e.button !== 0) return;
    if (d.held) return; // held items resolve on the next press (onHeldDown)
    if (!d.started) {
      // A plain click: lift the item onto the cursor (click-to-hold).
      this.startDrag(d, true);
      this.positionGhost(d, e.clientX, e.clientY);
      this.preview(d, e.clientX, e.clientY);
      return;
    }
    this.resolve(d, e.clientX, e.clientY);
  }

  /** Release / place the dragged or held item at (x, y). */
  private resolve(d: Drag, x: number, y: number) {
    this.cancelDrag();
    const id = d.item.id;
    const hold = (otherId: number | undefined) => {
      if (otherId !== undefined && otherId !== id) this.pendingHold = { id: otherId, until: performance.now() + 1500 };
    };

    const cell = this.gridCell(d, x, y);
    if (cell) {
      const res = this.gridDrop(d, cell.x, cell.y);
      if (res.kind === "bad") return this.h.toast("Doesn't fit there");
      playSfx("inv.place");
      if (d.src.k === "grid") {
        if (d.src.e.x === cell.x && d.src.e.y === cell.y) return; // put back where it was
        this.h.send({ t: "move", id, x: cell.x, y: cell.y });
        const o = res.other?.it;
        const merges = !!o && o.b === d.item.b && (stackSize(o) > 1 || stackSize(d.item) > 1 || isCurrency(o));
        if (o && !merges) hold(o.id);
      } else if (res.kind === "ok") this.h.send({ t: "unequip", from: d.src.t, x: cell.x, y: cell.y });
      else {
        this.h.send({ t: "equip", id: res.other!.it.id, to: d.src.t }); // swap with the grid item under it
        hold(id); // the item that was in the slot lands in the grid: lift it
      }
      return;
    }
    const t = this.slotUnder(x, y);
    if (t) {
      if (d.src.k === "slot" && d.src.t === t) return;
      if (!this.fitsSlot(t, d.item)) return this.h.toast("Doesn't fit that slot");
      const rq = itemReqs(d.item);
      if (!rq.ok) return this.h.toast(`Requires ${rq.parts.filter((p) => !p.ok).map((p) => p.label).join(", ")}`);
      playSfx("inv.equip");
      const prevItem = this.slotItem(t);
      this.h.send({ t: "equip", id, to: t });
      if (prevItem && d.src.k === "grid") hold(prevItem.id);
      return;
    }
    if (d.src.k === "grid") for (const f of invExternalDrops) if (f(d.item, x, y, "drop")) return;
    // Released / clicked outside the panel, over the game world: drop it on the ground.
    const under = document.elementFromPoint(x, y);
    if (under && !under.closest("#inv-panel") && under.id === "game") {
      playSfx("inv.drop");
      this.h.send({ t: "drop", id });
    }
  }
}
