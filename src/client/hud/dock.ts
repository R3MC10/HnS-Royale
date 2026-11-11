// Panel docking + bottom-bar extras (bar package, HUD-SPEC 2.6 W). Systems copy of the ARPG panel layout:
//  - right dock: the inventory, zoomed to fit above the bottom band (it never scrolls);
//  - left dock: ONE of the character sheet / Skills panel / social (opening one closes the others); the
//    Skills panel drops to one column when the inventory leaves too little room beside it;
//  - full screen: the passive tree, which closes every docked panel when it opens.
// Also owns the canvas part `drawBarHud` (weapon-set tabs, the three menu buttons by the mana globe, the
// XP bar hover readout) and the interface actions close all panels / hide HUD.
// Esc handling is untouched; the world keeps running.
import type { View } from "../render";
import { isCharOpen, toggleChar } from "../charsheet";
import { yieldFirstHints } from "../firsthints";
import { isBigMapOpen } from "./minimap";
import { isSkillsPanelOpen, togglePanel } from "../skillbar";
import { isTreeOpen, toggleTree } from "../tree";
import { actionLabel, newActionsNotice, setActionHandler } from "../keybinds";
import { closeAllPanels, isMenuOpen, openOptions } from "../options";
import { getSettings } from "../settings";
import { drawSkinButton, drawSkinStrip, hudIcon, SKIN, skinText } from "./skin";
import { bevel, rgba, rivet } from "./skin/paint";
import { isSocialOpen, toggleSocial } from "../menus/ingame"; // menus package: social is left-docked too
import { getHudLayout, onHudLayoutChange } from "./layout";
import type { HudState } from "./state";
import { leftCluster } from "./belt";
import type { HudCtx, HudInit, HudLayout, HudRect } from "./types";

// ---- interface actions: hide HUD, close all panels -----------------------------------

let hudHidden = false;
/** "toggleHud" key: the canvas HUD, minimap and DOM bars hide (panels still open normally). */
export function isHudHidden(): boolean {
  return hudHidden;
}
export function setHudHidden(on: boolean): void {
  hudHidden = on;
}

// Map zoom keys (minimapZoomIn / minimapZoomOut) are handled by hud/minimap.ts (mapZoomStep).

function registerActions() {
  setActionHandler("closePanels", () => {
    if (!isMenuOpen()) closeAllPanels();
  });
  setActionHandler("toggleHud", () => (hudHidden = !hudHidden));
}

// ---- docking -----------------------------------------------------------------------------------

// PoE2: docked panels are flush with the screen edge and run from the top down to the bottom band.
const DOCK_TOP_VH = 0;
const DOCK_EDGE = 0;
/** Skills panel width with its two-column bar + bag beside it (2 x 308 + gaps + 280 bag + padding). */
const SKILLS_WIDE_PX = 100000; // the Skills panel is always the one-column left dock (PoE2 gem list)

let styleEl: HTMLStyleElement | null = null;
let ui: HudInit["ui"] | null = null;
let prev = { char: false, skills: false, tree: false, social: false };

function css(L: HudLayout): string {
  const band = Math.ceil(L.bottomBand * L.u);
  const maxH = `calc(100vh - ${DOCK_TOP_VH}vh - ${band}px - 4px)`;
  const dockW = `clamp(380px, 34vw, 720px)`;
  // The tree's own "inventory beside the tree" mode (body.pg-with-inv) keeps its placement.
  // The inventory is NOT height-limited: updateDock zooms it to fit (so it never shows a scrollbar);
  // fitInventory sets its top/right inline (pre-divided by its zoom).
  // z: docked panels 20, tooltips 60 (the tree's own mode raises #tooltip to 62 with a stronger selector).
  return `
body:not(.pg-with-inv) #inv-panel { left: auto !important; bottom: auto !important; transform: none !important;
  max-height: none !important; max-width: none !important; overflow: visible !important; box-sizing: border-box !important; z-index: 20 !important; }
#pg-char, #sk-panel, #hns-social { left: ${DOCK_EDGE}px !important; right: auto !important; top: ${DOCK_TOP_VH}vh !important; bottom: auto !important;
  transform: none !important; max-height: ${maxH} !important; height: ${maxH} !important; width: ${dockW} !important; box-sizing: border-box !important;
  border-radius: 0 !important; z-index: 20 !important; }
/* more rows below the fold: the last visible rows fade out (the panel scrolls with the wheel) */
#sk-panel.dock-more, #pg-char .scroll.dock-more { -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 30px), transparent 100%); mask-image: linear-gradient(180deg, #000 calc(100% - 30px), transparent 100%); }
#pg-char .pgz { width: auto !important; }
#hns-social { z-index: 20 !important; }
#tooltip { z-index: 60 !important; }
`;
}

export function initDock(init: HudInit): void {
  ui = init.ui;
  registerActions();
  if (typeof document === "undefined" || styleEl) return;
  styleEl = document.createElement("style");
  styleEl.id = "hud-dock-style";
  styleEl.textContent = css(getHudLayout());
  document.head.appendChild(styleEl);
  onHudLayoutChange((L) => {
    if (styleEl) styleEl.textContent = css(L);
    fitAt = 0;
  });
  window.addEventListener("resize", () => (fitAt = 0));
}

/** The inventory is docked on the right (it covers the minimap corner, so the corner HUD stands down). */
export function isRightDockOpen(): boolean {
  return !!ui?.isOpen() && !(typeof document !== "undefined" && document.body.classList.contains("pg-with-inv"));
}

let fitAt = 0; // next time (ms) the inventory is re-measured
let fitted = false; // our inline zoom/top/right are on #inv-panel
let invVisualW = 0; // inventory width on screen (CSS px), for the left dock

/** PoE2 panel size: a grid cell is about 1/20.5 of the screen height (≈53 px at 1080p), so the docked
 *  inventory and character panels each take about a third of the screen width. Never shrinks below 1. */
const CELL_PX = 34; // inventory.ts CELL
const CHAR_W = 340; // charsheet.ts .pgz width
function dockScale(): number {
  return Math.max(1, window.innerHeight / (20.5 * CELL_PX));
}

/** Zoom the right-docked inventory so its whole natural size fits above the bottom band. */
function fitInventory(open: boolean) {
  const inv = document.getElementById("inv-panel");
  if (!inv) return;
  const uiScale = getSettings().interface.uiScale || 1;
  if (!open || document.body.classList.contains("pg-with-inv")) {
    if (fitted) {
      // hand the panel back to options.ts applyUiScale / the tree's placement
      inv.style.setProperty("zoom", String(uiScale));
      inv.style.removeProperty("top");
      inv.style.removeProperty("right");
      fitted = false;
    }
    invVisualW = 0;
    fitAt = 0;
    return;
  }
  const t = performance.now();
  if (fitted && t < fitAt) return;
  fitAt = t + 250; // content (doll, belt, grid) can change while open
  const L = getHudLayout();
  const topPx = (window.innerHeight * DOCK_TOP_VH) / 100;
  // natural size at zoom 1 (overflow visible, no max size: this is its full content)
  inv.style.setProperty("zoom", "1");
  const natW = inv.offsetWidth;
  const natH = inv.offsetHeight;
  const availH = window.innerHeight - topPx - L.bottomBand * L.u - 4;
  const availW = window.innerWidth / 2 - 24;
  let k = uiScale;
  if (natW > 0 && natH > 0) k = Math.min(uiScale * dockScale(), availH / natH, availW / natW);
  k = Math.max(0.35, Math.round(k * 1000) / 1000);
  inv.style.setProperty("zoom", String(k));
  // CSS zoom scales the element's own top/right too: pre-divide so it lands at the dock edge.
  inv.style.setProperty("top", `${topPx / k}px`, "important");
  inv.style.setProperty("right", `${DOCK_EDGE / k}px`, "important");
  invVisualW = natW * k;
  fitted = true;
}

/** Left dock: never wider than the room the right-docked inventory leaves; Skills one column when narrow. */
function fitLeftDock(invOpen: boolean) {
  const maxW = Math.max(240, window.innerWidth - (invOpen ? invVisualW + 48 : 32) - DOCK_EDGE);
  const mw = `${Math.floor(maxW)}px`;
  const sk = document.getElementById("sk-panel");
  if (sk) {
    if (sk.style.maxWidth !== mw) sk.style.setProperty("max-width", mw, "important");
    sk.classList.toggle("narrow", maxW < SKILLS_WIDE_PX);
  }
  const ch = document.getElementById("pg-char");
  if (ch && ch.style.maxWidth !== mw) ch.style.setProperty("max-width", mw, "important");
  // Character sheet at the same PoE2 scale as the inventory (capped to the room beside it).
  const pgz = ch?.querySelector<HTMLElement>(".pgz");
  if (pgz) {
    const uiScale = getSettings().interface.uiScale || 1;
    const z = String(Math.max(0.5, Math.round(Math.min(uiScale * dockScale(), (maxW - 4) / CHAR_W) * 1000) / 1000));
    if (pgz.style.zoom !== z) pgz.style.setProperty("zoom", z);
  }
  // Scrolling panels show that there is more below.
  for (const el of [sk, ch?.querySelector(".scroll")]) if (el && el.clientHeight > 0) el.classList.toggle("dock-more", el.scrollHeight - el.clientHeight - el.scrollTop > 6);
}

let noticeDone = false;

export function updateDock(v: View, s: HudState): void {
  let char = isCharOpen();
  let skills = isSkillsPanelOpen();
  const tree = isTreeOpen();
  let social = isSocialOpen();

  // Social shares the left dock (menus package): when it just opened it wins, else it yields.
  if (social && (char || skills)) {
    if (!prev.social) {
      if (char) toggleChar(false);
      if (skills) togglePanel(false);
      char = skills = false;
    } else {
      toggleSocial(false);
      social = false;
    }
  }

  // Left dock holds one panel: the one that just opened wins.
  if (char && skills) {
    if (char && !prev.char) {
      togglePanel(false);
      skills = false;
    } else if (skills && !prev.skills) {
      toggleChar(false);
      char = false;
    }
  }

  // The full-screen tree closes every docked panel when it opens.
  if (tree && !prev.tree) {
    if (ui?.isOpen()) ui.toggle(false);
    if (char) toggleChar(false);
    if (skills) togglePanel(false);
    if (social) toggleSocial(false);
    char = skills = social = false;
  }

  prev = { char, skills, tree, social };

  const invOpen = !!ui?.isOpen();
  fitInventory(invOpen);
  yieldFirstHints(char || skills || social || tree || invOpen || isBigMapOpen()); // the first-spawn controls strip sat over the top of the docked panels at 720p
  if (skills || char) fitLeftDock(invOpen);

  // One-time "New controls added" line (keybinds added since the saved layout) once a match runs.
  if (!noticeDone && v.self && s.me) {
    noticeDone = true;
    const n = newActionsNotice();
    if (n) s.feed.push({ t: performance.now() / 1000, kind: "info", text: n, mine: 0 });
  }
}


// ---- canvas: weapon-set tabs, menu buttons, XP readout ------------------------------------------

let lastSet = -1;
let setFlashUntil = 0;

/** HUD part (hud/index.ts, after vitals): only while alive (the bottom band hides when out). */
export function drawBarHud(c: HudCtx): void {
  const me = c.v.self;
  if (!me || !me.alive) {
    lastSet = -1;
    return;
  }
  drawWeaponSet(c);
  drawMenuButtons(c);
  xpHotspot(c);
}

/** Two small stone tabs with bronze trim and serif numerals at the left end of the skill strip. */
function drawWeaponSet(c: HudCtx) {
  const inv = c.s.inv;
  if (!inv) return;
  const { g } = c;
  const r = c.L.weaponSet;
  const set = inv.set === 1 ? 1 : 0;
  if (lastSet !== -1 && lastSet !== set) setFlashUntil = c.time + 0.3;
  lastSet = set;
  const names = ["I", "II"];
  const key = actionLabel("weaponSwap");
  const tabH = (r.h - 1) / 2;
  for (let i = 0; i < 2; i++) {
    const tr: HudRect = { x: r.x, y: r.y + i * (tabH + 1), w: r.w, h: tabH };
    const active = i === set;
    const flash = active && c.time < setFlashUntil;
    const hover = c.hot(tr, {
      tip: [`Weapon set ${names[set]} active`, `${key === "-" ? "Click" : key} swaps sets`, ...(i !== set && !inv.alt?.mainhand && !inv.alt?.offhand ? [`Set ${names[i]} is empty`] : [])],
      onClick: () => c.send({ t: "weaponSwap" }),
    });
    g.save();
    if (!active) g.globalAlpha *= hover ? 0.9 : 0.7;
    drawSkinButton(g, tr, active || hover ? "hover" : "normal");
    // bronze trim: bright on the active set
    g.lineWidth = active ? 0.45 : 0.3;
    g.strokeStyle = flash ? "#fff0c8" : active ? SKIN.gold : rgba(SKIN.bronze, 0.8);
    g.strokeRect(tr.x + 0.35, tr.y + 0.35, tr.w - 0.7, tr.h - 0.7);
    if (active) {
      g.fillStyle = rgba(SKIN.gold, flash ? 0.45 : 0.12);
      g.fillRect(tr.x + 0.6, tr.y + 0.6, tr.w - 1.2, tr.h - 1.2);
    }
    g.restore();
    const size = Math.min(4.6, tr.h * 0.9);
    skinText(g, names[i], tr.x + tr.w / 2, tr.y + (tr.h - size) / 2 - 0.1, {
      face: "display",
      size,
      align: "center",
      color: flash ? "#fff6dc" : active ? "#f4dfa8" : SKIN.inkFaint,
    });
  }
}

type MenuId = "tree" | "character" | "options";
const MENU: { id: MenuId; name: string; open: () => void }[] = [
  { id: "tree", name: "Passive Tree", open: () => toggleTree() },
  { id: "character", name: "Character", open: () => toggleChar() },
  { id: "options", name: "Options", open: () => openOptions() },
];

/** Three round carved-stone buttons left of the mana globe; the passive one pulses with unspent points. */
function drawMenuButtons(c: HudCtx) {
  const { g, L } = c;
  const r = leftCluster(c).menu; // packed after the charm slots (hud/belt.ts)
  const n = MENU.length;
  const d = Math.min(r.h, (r.w - (n - 1) * 2) / n);
  const prog = c.s.prog;
  MENU.forEach((m, i) => {
    const cx = r.x + d / 2 + i * (d + 2);
    const cy = r.y + d / 2;
    const rr = d / 2;
    const box: HudRect = { x: cx - rr, y: cy - rr, w: d, h: d };
    const pts = m.id === "tree" && prog ? prog.pts : 0;
    const asc = m.id === "tree" && prog ? prog.ascPts : 0;
    const key = actionLabel(m.id);
    const tip = [key === "-" ? m.name : `${m.name} - ${key}`];
    if (pts > 0) tip.push(`${pts} unspent passive point${pts === 1 ? "" : "s"}`);
    if (asc > 0) tip.push(`${asc} unspent ascendancy point${asc === 1 ? "" : "s"}`);
    const open = m.id === "tree" ? isTreeOpen() : m.id === "character" ? isCharOpen() : isMenuOpen();
    const hover = c.hot(box, { tip, onClick: m.open });
    const pulse = pts > 0 || asc > 0 ? 0.5 + 0.5 * Math.sin(c.time * 4) : 0;
    roundButton(g, cx, cy, rr, hover, open, pulse, asc > 0 && pts <= 0 ? "#b080e0" : SKIN.gold);
    const icon = hudIcon(`btn_${m.id}`);
    if (icon) {
      g.save();
      g.imageSmoothingEnabled = true;
      g.beginPath();
      g.arc(cx, cy, rr * 0.8, 0, Math.PI * 2);
      g.clip();
      g.drawImage(icon, cx - rr * 0.8, cy - rr * 0.8, rr * 1.6, rr * 1.6);
      g.restore();
    } else glyph(g, m.id, cx, cy, rr * 0.6, hover || open ? "#f2dfb4" : "#bfae8c");
    if (pts > 0 || asc > 0) {
      skinText(g, `+${pts > 0 ? pts : asc}`, cx + rr * 0.6, cy - rr - 0.8, {
        face: "display",
        size: 4.2,
        align: "center",
        color: pts > 0 ? "#ffe6a0" : "#e0c8ff",
      });
    }
  });
}

function roundButton(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, hover: boolean, open: boolean, pulse: number, glowCol: string) {
  g.save();
  g.imageSmoothingEnabled = true;
  if (pulse > 0) {
    const gl = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.7);
    gl.addColorStop(0, rgba(glowCol, 0.3 + 0.35 * pulse));
    gl.addColorStop(1, rgba(glowCol, 0));
    g.fillStyle = gl;
    g.beginPath();
    g.arc(cx, cy, r * 1.7, 0, Math.PI * 2);
    g.fill();
  }
  // blackened iron rim
  const rim = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, "#77716a");
  rim.addColorStop(0.45, "#35322f");
  rim.addColorStop(1, "#0b0a0a");
  g.fillStyle = rim;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  // carved stone face
  const face = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r * 0.85);
  face.addColorStop(0, hover ? "#4a3e32" : "#34302b");
  face.addColorStop(0.7, hover ? "#241d18" : "#191715");
  face.addColorStop(1, "#0a0909");
  g.fillStyle = face;
  g.beginPath();
  g.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  g.fill();
  // inner shadow + upper-left light
  g.lineWidth = 0.35;
  g.strokeStyle = "rgba(0,0,0,0.9)";
  g.beginPath();
  g.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "rgba(220,200,170,0.22)";
  g.beginPath();
  g.arc(cx, cy, r * 0.95, Math.PI * 1.05, Math.PI * 1.7);
  g.stroke();
  // bronze trim when hovered / its panel is open / pulsing
  if (hover || open || pulse > 0) {
    g.lineWidth = 0.45;
    g.strokeStyle = rgba(pulse > 0 && !hover && !open ? glowCol : SKIN.gold, hover || open ? 0.95 : 0.5 + 0.5 * pulse);
    g.beginPath();
    g.arc(cx, cy, r - 0.25, 0, Math.PI * 2);
    g.stroke();
  }
  for (const a of [-0.25, 0.25, 0.75, 1.25]) rivet(g, cx + Math.cos(a * Math.PI) * r * 0.91, cy + Math.sin(a * Math.PI) * r * 0.91, 0.3);
  g.restore();
}

/** Original procedural reliefs: a branching tree with nodes, a clasped book, a cog. */
function glyph(g: CanvasRenderingContext2D, id: MenuId, cx: number, cy: number, s: number, col: string) {
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = col;
  g.fillStyle = col;
  g.lineWidth = s * 0.16;
  // carved: a dark offset copy underneath reads as relief
  const pass = (dy: number, colour: string) => {
    g.strokeStyle = colour;
    g.fillStyle = colour;
    if (id === "tree") {
      const node = (x: number, y: number, r: number) => {
        g.beginPath();
        g.arc(x, y + dy, r, 0, Math.PI * 2);
        g.fill();
      };
      g.beginPath();
      g.moveTo(cx, cy + s * 0.95 + dy);
      g.lineTo(cx, cy - s * 0.1 + dy);
      g.moveTo(cx, cy + s * 0.25 + dy);
      g.lineTo(cx - s * 0.65, cy - s * 0.35 + dy);
      g.moveTo(cx, cy + s * 0.05 + dy);
      g.lineTo(cx + s * 0.65, cy - s * 0.45 + dy);
      g.moveTo(cx, cy - s * 0.1 + dy);
      g.lineTo(cx, cy - s * 0.75 + dy);
      g.stroke();
      node(cx, cy - s * 0.8, s * 0.2);
      node(cx - s * 0.7, cy - s * 0.4, s * 0.17);
      node(cx + s * 0.7, cy - s * 0.5, s * 0.17);
      node(cx, cy + s * 0.95, s * 0.14);
    } else if (id === "character") {
      const w = s * 1.25;
      const h = s * 1.6;
      const x = cx - w / 2;
      const y = cy - h / 2 + dy;
      g.lineWidth = s * 0.13;
      g.strokeRect(x, y, w, h);
      g.fillRect(x, y, w * 0.18, h);
      g.beginPath();
      g.moveTo(x + w * 0.35, y + h * 0.3);
      g.lineTo(x + w * 0.8, y + h * 0.3);
      g.moveTo(x + w * 0.35, y + h * 0.5);
      g.lineTo(x + w * 0.7, y + h * 0.5);
      g.stroke();
      g.fillRect(x + w - s * 0.06, cy - s * 0.15 + dy, s * 0.22, s * 0.3);
    } else {
      const teeth = 8;
      g.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? s * 0.95 : s * 0.72;
        const da = (Math.PI / (teeth * 2)) * 0.55;
        const p0 = [cx + Math.cos(a - da) * rr, cy + dy + Math.sin(a - da) * rr];
        if (i === 0) g.moveTo(p0[0], p0[1]);
        else g.lineTo(p0[0], p0[1]);
        g.lineTo(cx + Math.cos(a + da) * rr, cy + dy + Math.sin(a + da) * rr);
      }
      g.closePath();
      g.moveTo(cx + s * 0.32, cy + dy);
      g.arc(cx, cy + dy, s * 0.32, 0, Math.PI * 2, true); // hub hole (even-odd via reverse winding)
      g.fill("evenodd");
    }
  };
  pass(s * 0.14, "rgba(0,0,0,0.85)");
  pass(0, col);
  g.restore();
}

/** Hover readout for the DOM XP bar (prog.ts): level, cur / next, %. Through the shared HUD tooltip. */
function xpHotspot(c: HudCtx) {
  const m = c.s.prog;
  if (!m) return;
  const r = c.L.xpBar;
  const hit: HudRect = { x: r.x - 14, y: r.y - 1.5, w: r.w + 14, h: r.h + 2.5 };
  const pct = m.next > 0 ? Math.min(100, (m.xp / m.next) * 100) : 100;
  const tip =
    m.next > 0
      ? [`Level ${m.lv}`, `Experience ${m.xp.toLocaleString()} / ${m.next.toLocaleString()} (${pct.toFixed(1)}%)`, `${Math.max(0, m.next - m.xp).toLocaleString()} to level ${m.lv + 1}`]
      : [`Level ${m.lv}`, "Maximum level"];
  if (c.hot(hit, { tip })) {
    c.g.save();
    c.g.fillStyle = rgba(SKIN.gold, 0.12);
    c.g.fillRect(r.x, r.y - 0.5, r.w, r.h + 1);
    bevel(c.g, r.x - 0.4, r.y - 0.9, r.w + 0.8, r.h + 1.8, 0.4, 0.3, rgba(SKIN.gold, 0.5), "rgba(0,0,0,0.8)");
    c.g.restore();
  }
}
