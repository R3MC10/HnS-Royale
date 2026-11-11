// In-game Esc menu and the tabbed Options panel (DOM). Writes ./settings.ts and ./keybinds.ts;
// everything else reads those stores and applies changes live.
//
// Esc order: rebinding capture -> confirm dialog -> options (back to menu) -> menu (resume) ->
// then, in game, the topmost layer only: a popup / mode (stack split, currency targeting, a held
// item) -> the chat input -> full-screen panels (tree, big map) -> docked panels (inventory,
// character, skills, social) -> open the menu.
//
// Fonts: the look agent owns the typefaces. This panel uses --font-title / --font-body when the
// page defines them, else a serif fallback stack.
import { tr } from "./i18n";
import { RARITY_COLORS, RARITY_NAMES } from "../shared/content/loot";
import { clearInput } from "./input";
import {
  ACTIONS,
  ACTION_BY_ID,
  actionLabel,
  bindFromEvent,
  bindLabel,
  conflictsOf,
  DEFAULT_PRESET,
  getBinds,
  isReserved,
  matchingPreset,
  onBindsChange,
  presetBinds,
  PRESETS,
  resetBind,
  resetBinds,
  setBind,
  type ActionGroup,
  type Bind,
  type PresetId,
} from "./keybinds";
import { getSettings, onChange, resetSettings, setSetting, type Group } from "./settings";
import { uiSound } from "./audio";

// ---- panel registry (Esc closes these before opening the menu) -------------------------

export type PanelLayer = "popup" | "chat" | "full" | "docked";
export interface ClosablePanel {
  isOpen: () => boolean;
  close: () => void;
  /** Esc layer (default "docked"). Higher layers close first, one layer per Esc press. */
  layer?: PanelLayer;
  /** Context popup / mode inside the panel: cancel it and return true if there was one (Esc consumed). */
  popup?: () => boolean;
}
const panels: ClosablePanel[] = [];
/** Register a game panel (inventory, passive tree, skills, map...) so Esc closes it first. */
export function registerPanel(p: ClosablePanel) {
  panels.push(p);
}
/** Close every registered game panel without opening the Esc menu (the "closePanels" key). */
export function closeAllPanels(): void {
  for (const p of panels) if (p.isOpen()) p.close();
}

export interface OptionsHooks {
  /** True while in a match (the menu only opens then). */
  inMatch: () => boolean;
  /** Leave the match and go back to the join screen. */
  onLeave: () => void;
  /** False once you are eliminated / spectating (changes the leave button). */
  isAlive?: () => boolean;
}

let aliveHook: (() => boolean) | null = null;
/** menus/ingame.ts tracks whether the local hero is still standing (from the game snapshots). */
export function setAliveHook(fn: () => boolean) {
  aliveHook = fn;
}
const isAlive = () => (hooks.isAlive ? hooks.isAlive() : aliveHook ? aliveHook() : true);

// ---- styles ------------------------------------------------------------------------

const CSS = `
#hns-menu { --o-title: var(--font-title, "Cinzel", "Trajan Pro", "Palatino Linotype", "Book Antiqua", Georgia, serif);
  --o-body: var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif);
  --o-gold: #d9b26a; --o-gold-dim: #8c7448; --o-line: rgba(140,116,72,0.28); --o-ember: #c8562a;
  position: fixed; inset: 0; z-index: 40; display: none; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, rgba(40,14,8,0.42), rgba(3,2,4,0.88) 70%);
  font-family: var(--o-body); color: #ddd0b4; user-select: none; -webkit-font-smoothing: antialiased; }
#hns-menu.open { display: flex; }
#hns-menu .hm-zoom { zoom: var(--hns-ui, 1); display: flex; align-items: center; justify-content: center; max-width: 100vw; }
#hns-menu button, #hns-menu input { font-family: var(--o-body); }
.hm-panel { position: relative; border-radius: 6px;
  background: radial-gradient(ellipse at 50% 0%, rgba(120,70,40,0.10), transparent 60%), linear-gradient(180deg, #1b1719 0%, #121012 55%, #0d0b0d 100%);
  border: 1px solid #050405;
  box-shadow: 0 0 0 1px #3a3136, 0 0 0 3px #0d0b0d, 0 0 0 4px #5a4a3a, 0 0 0 5px #0a0809, 0 24px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,230,190,0.06), inset 0 0 40px rgba(0,0,0,0.6); }
.hm-panel::before, .hm-panel::after { content: ""; position: absolute; width: 14px; height: 14px; transform: rotate(45deg);
  background: linear-gradient(135deg, #7a6448, #3a2e22); border: 1px solid #050405; top: -8px; }
.hm-panel::before { left: calc(50% - 7px); }
.hm-panel::after { display: none; }
.hm-box { width: 320px; padding: 26px 26px 22px; box-sizing: border-box; text-align: center; }
.hm-box > .hm-title { font-size: 22px; letter-spacing: 4px; line-height: 1.25; padding-left: 4px; overflow-wrap: anywhere; }
.hm-title { font-family: var(--o-title); font-size: 26px; font-weight: 600; letter-spacing: 6px; text-transform: uppercase; margin: 0;
  background: linear-gradient(180deg, #f6e6c4 10%, #d0a460 55%, #8a4a22 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 2px 0 rgba(0,0,0,0.9)); }
.hm-sub { color: #7c705e; font-size: 13px; font-style: italic; margin: 4px 0 16px; }
.hm-orn { height: 10px; margin: 2px auto 14px; width: 80%; background:
  radial-gradient(circle, #c8a060 0 2px, transparent 3px) center/10px 10px no-repeat,
  linear-gradient(90deg, transparent, #6a5436 30%, #6a5436 70%, transparent) center/100% 1px no-repeat; }
.hm-btn { display: block; width: 100%; margin-top: 10px; padding: 10px 12px; font-size: 15px; font-family: var(--o-title) !important; letter-spacing: 3px;
  text-transform: uppercase; color: #d8c8a4; cursor: pointer; border-radius: 4px; border: 1px solid #050405;
  background: linear-gradient(180deg, #2a2428 0%, #1a1619 60%, #141114 100%);
  box-shadow: 0 0 0 1px #4a3e3a, inset 0 1px 0 rgba(255,220,170,0.12), 0 2px 6px rgba(0,0,0,0.6); transition: color .12s, box-shadow .12s, background .12s; }
.hm-btn:hover, .hm-btn:focus-visible { color: #ffe2a8; outline: none; background: linear-gradient(180deg, #342a2a 0%, #201a1a 100%);
  box-shadow: 0 0 0 1px #9a7a48, inset 0 1px 0 rgba(255,220,170,0.2), 0 0 14px rgba(200,140,60,0.25); }
.hm-btn.blood { color: #f6e2c0; background: linear-gradient(180deg, #7a1c14 0%, #4e0f0a 70%, #3a0a07 100%); box-shadow: 0 0 0 1px #8c3424, inset 0 1px 0 rgba(255,170,130,0.25), 0 2px 6px rgba(0,0,0,0.6); }
.hm-btn.blood:hover, .hm-btn.blood:focus-visible { background: linear-gradient(180deg, #942820 0%, #5e140e 100%); box-shadow: 0 0 0 1px #d0603e, 0 0 16px rgba(220,80,40,0.35); }
.hm-keys { margin: 14px 0 0; padding: 8px 10px; text-align: left; border-radius: 4px; background: rgba(0,0,0,0.28);
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.7), 0 0 0 1px #2a2428; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px; }
.hm-key { display: flex; justify-content: space-between; gap: 6px; font-size: 12px; color: #8c806a; }
.hm-key b { font-weight: normal; color: #d8c8a4; font-size: 11.5px; }
.hm-rule { height: 1px; margin: 16px 6px 6px; background: linear-gradient(90deg, transparent, #5a4632, transparent); }

.ho-box { width: min(900px, calc(100vw - 24px)); height: min(640px, calc(100vh - 24px)); display: grid;
  grid-template-columns: 170px 1fr; grid-template-rows: auto 1fr auto; box-sizing: border-box; overflow: hidden; }
.ho-head { grid-column: 1 / 3; display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 10px;
  border-bottom: 1px solid var(--o-line); background: linear-gradient(180deg, rgba(0,0,0,0.25), transparent); }
.ho-head .hm-title { font-size: 22px; }
/* same close button as the docked panels (progstyle .pc-x) */
.ho-x { width: 26px; height: 26px; padding: 0; font-size: 16px; line-height: 1; color: #a89474; cursor: pointer; border-radius: 3px;
  border: 1px solid rgba(216,184,96,0.35); background: linear-gradient(180deg, #2a2220, #120e0d); box-shadow: inset 0 1px 0 rgba(255,230,190,0.07), 0 1px 2px rgba(0,0,0,0.8);
  transition: color .1s, border-color .1s, box-shadow .1s; }
.ho-x:hover { color: #fff0d0; border-color: #d8b36a; box-shadow: 0 0 8px rgba(216,179,106,0.35); }
.ho-x:active { transform: scale(0.92); }
.hm-btn:active { transform: translateY(1px); }
.ho-tabs { display: flex; flex-direction: column; gap: 2px; padding: 14px 0; border-right: 1px solid var(--o-line);
  background: linear-gradient(90deg, rgba(0,0,0,0.25), rgba(0,0,0,0.05)); }
.ho-tab { text-align: left; padding: 11px 16px 11px 20px; font-family: var(--o-title) !important; font-size: 13px; letter-spacing: 2.5px; text-transform: uppercase;
  color: #8c806a; cursor: pointer; background: transparent; border: 0; position: relative; transition: color .12s, background .12s; }
.ho-tab:hover { color: #d8c8a4; background: rgba(255,220,170,0.03); }
.ho-tab.on { color: #ffe2a8; background: linear-gradient(90deg, rgba(150,50,20,0.38), rgba(150,50,20,0.0)); }
.ho-tab.on::before { content: ""; position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; background: linear-gradient(180deg, #ffb070, #a8401e); box-shadow: 0 0 8px rgba(255,120,40,0.6); }
.ho-body { overflow-y: auto; padding: 4px 22px 22px; scrollbar-width: thin; scrollbar-color: #5a4a3c #0c0b0d; }
.ho-foot { grid-column: 1 / 3; display: flex; align-items: center; gap: 12px; padding: 10px 18px; border-top: 1px solid var(--o-line); background: rgba(0,0,0,0.2); }
.ho-foot .hm-btn { width: auto; margin: 0; padding: 8px 18px; font-size: 13px; letter-spacing: 2px; }
.ho-note { flex: 1; font-size: 13px; color: #7c705e; font-style: italic; min-height: 16px; }
.ho-note.warn { color: #ffb878; font-style: normal; }
.ho-note.err { color: #ff8a76; font-style: normal; }

.ho-sec { margin: 22px 0 6px; padding-bottom: 6px; font-family: var(--o-title); font-size: 13px; letter-spacing: 3px; text-transform: uppercase;
  color: var(--o-gold); border-bottom: 1px solid var(--o-line); display: flex; align-items: center; gap: 10px; }
.ho-sec::before { content: ""; width: 6px; height: 6px; transform: rotate(45deg); background: #a8401e; box-shadow: 0 0 6px rgba(255,100,40,0.6); }
.ho-row { display: flex; align-items: center; gap: 14px; padding: 8px 6px; border-radius: 3px; }
.ho-row:hover { background: rgba(255,220,170,0.035); }
.ho-lab { flex: 1; min-width: 0; font-size: 15px; color: #ddd0b4; }
.ho-desc { display: block; font-size: 12.5px; color: #7c705e; margin-top: 2px; font-style: italic; }
.ho-ctl { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }

.ho-tog { width: 48px; height: 24px; padding: 0; position: relative; cursor: pointer; border-radius: 12px; border: 1px solid #050405;
  background: linear-gradient(180deg, #0a090b, #18151a); box-shadow: 0 0 0 1px #3a3136, inset 0 2px 4px rgba(0,0,0,0.7); transition: background .15s; }
.ho-tog::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #8a8490, #3e3a44); box-shadow: 0 1px 3px rgba(0,0,0,0.8); transition: left .15s, background .15s; }
.ho-tog.on { background: linear-gradient(180deg, #4a120c, #6a1c12); box-shadow: 0 0 0 1px #8c3424, inset 0 2px 4px rgba(0,0,0,0.5); }
.ho-tog.on::after { left: 26px; background: radial-gradient(circle at 40% 35%, #ffd6a0, #c8562a); box-shadow: 0 0 8px rgba(255,140,60,0.7); }

.ho-seg { display: flex; border-radius: 4px; overflow: hidden; border: 1px solid #050405; box-shadow: 0 0 0 1px #3a3136; background: #0d0b0d; }
.ho-seg button { padding: 6px 11px; font-size: 13px; color: #8c806a; background: transparent; border: 0; border-right: 1px solid #241f23; cursor: pointer; transition: color .12s, background .12s; }
.ho-seg button:last-child { border-right: 0; }
.ho-seg button:hover { color: #ddd0b4; background: rgba(255,220,170,0.04); }
.ho-seg button.on { color: #fff0d0; background: linear-gradient(180deg, #7a1c14, #4a0f0a); box-shadow: inset 0 1px 0 rgba(255,170,130,0.3); }

.ho-sl { -webkit-appearance: none; appearance: none; width: 190px; height: 20px; background: transparent; cursor: pointer; margin: 0; }
.ho-sl::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: linear-gradient(90deg, #c8562a, #8c2316 var(--p), #0d0b0d var(--p)); box-shadow: 0 0 0 1px #3a3136, inset 0 1px 2px rgba(0,0,0,0.8); }
.ho-sl::-moz-range-track { height: 6px; border-radius: 3px; background: linear-gradient(90deg, #c8562a, #8c2316 var(--p), #0d0b0d var(--p)); }
.ho-sl::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -5px; border-radius: 50%; border: 1px solid #050405;
  background: radial-gradient(circle at 40% 35%, #f0dcb4, #8a7050); box-shadow: 0 0 0 1px #6a5436, 0 2px 4px rgba(0,0,0,0.8); }
.ho-sl::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; border: 1px solid #050405; background: radial-gradient(circle at 40% 35%, #f0dcb4, #8a7050); }
.ho-val { width: 48px; text-align: right; font-size: 14px; color: var(--o-gold); font-variant-numeric: tabular-nums; }

.ho-key { width: 118px; padding: 6px 8px; font-size: 13.5px; color: #f0e2c4; cursor: pointer; border-radius: 4px; border: 1px solid #050405;
  background: linear-gradient(180deg, #252025, #161316); box-shadow: 0 0 0 1px #423838, inset 0 1px 0 rgba(255,220,170,0.08); transition: box-shadow .12s; }
.ho-key:hover { box-shadow: 0 0 0 1px #9a7a48, 0 0 8px rgba(200,140,60,0.25); }
.ho-key.empty { color: #5a5048; font-style: italic; }
.ho-key.wait { color: #ffe2a8; box-shadow: 0 0 0 1px #ff8a2a, 0 0 12px rgba(255,120,40,0.5); animation: hoPulse 1s ease-in-out infinite; }
.ho-key.clash { color: #ff9a86; box-shadow: 0 0 0 1px #b03020; }
.ho-key.changed:not(.wait) { color: #ffd890; }
@keyframes hoPulse { 50% { background: #3a1c12; } }
.ho-rst { width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 1px solid #050405; background: #141114; color: #6a5e50; cursor: pointer;
  box-shadow: 0 0 0 1px #3a3136; font-size: 14px; line-height: 1; }
.ho-rst:hover:not(:disabled) { color: #ffe2a8; box-shadow: 0 0 0 1px #9a7a48; }
.ho-rst:disabled { opacity: 0.25; cursor: default; }
.ho-keyhead { display: flex; gap: 8px; justify-content: flex-end; font-size: 11px; color: #7c705e; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 6px 0; }
.ho-keyhead span { width: 118px; text-align: center; } .ho-keyhead i { width: 26px; }
.ho-help { margin: 12px 6px 0; font-size: 13px; color: #8c806a; line-height: 1.5; }
.ho-help b { color: #d8c8a4; font-weight: normal; border: 1px solid #3a3136; border-radius: 3px; padding: 0 5px; background: #161316; }
.ho-confirm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(3,2,4,0.72); z-index: 2; }
.ho-confirm .hm-box { width: 380px; }
.ho-confirm .hm-title { font-size: 19px; }
.ho-confirm p { font-size: 15px; color: #ddd0b4; margin: 10px 0 4px; line-height: 1.55; }
.ho-confirm .row2 { display: flex; gap: 10px; } .ho-confirm .row2 .hm-btn { flex: 1; }
.ho-sw { display: inline-block; width: 11px; height: 11px; margin-right: 5px; border-radius: 2px; border: 1px solid #050405; vertical-align: -1px; }

body.hns-cb .good { color: #6cb8ff; }
body.hns-cb .bad { color: #ff9a3c; }
`;

// ---- state ---------------------------------------------------------------------------

type Screen = "closed" | "menu" | "options";
type TabId = Group | "controls";
let screen: Screen = "closed";
let tab: TabId = "game";
let hooks: OptionsHooks = { inMatch: () => false, onLeave: () => {} };
let root: HTMLDivElement;
let confirmEl: HTMLDivElement | null = null;
/** Rebinding capture in progress. `mod` = a modifier key held alone (bound on release). */
let capture: { id: string; slot: 0 | 1; btn: HTMLButtonElement; mod: string | null } | null = null;
let noteEl: HTMLDivElement | null = null;
/** Time of the last captured mouse bind: the right-click's contextmenu must not clear it. */
let capturedAt = 0;

export function isMenuOpen(): boolean {
  return screen !== "closed";
}

/** Esc pressed in game (input.ts -> main.ts "close" action). */
export function handleEscape() {
  if (screen !== "closed") return back();
  // 1. Popups / modes (split box, currency targeting, a held item).
  for (const p of panels) if (p.popup?.()) return;
  // 2..4. Chat input, then full-screen panels, then every docked panel.
  for (const layer of ["chat", "full", "docked"] as PanelLayer[]) {
    const open = panels.filter((p) => (p.layer ?? "docked") === layer && p.isOpen());
    if (open.length) {
      for (const p of open) p.close();
      return;
    }
  }
  if (hooks.inMatch()) openMenu();
}

export function openMenu() {
  uiSound("ui.open");
  screen = "menu";
  clearInput();
  render();
}

/** Jump straight to the Options panel (the "options" key, O by default). */
export function openOptions(t?: TabId) {
  if (screen === "closed") uiSound("ui.open");
  if (t) tab = t;
  screen = "options";
  clearInput();
  render();
}

export function closeMenu() {
  if (screen !== "closed") uiSound("ui.close");
  screen = "closed";
  capture = null;
  closeConfirm();
  render();
  (document.getElementById("game") as HTMLCanvasElement | null)?.focus();
}

function back() {
  if (capture) return cancelCapture();
  if (confirmEl) return closeConfirm();
  if (screen === "options") {
    screen = "menu";
    render();
  } else closeMenu();
}

// ---- init ------------------------------------------------------------------------------

const MOD_CODES = new Set(["ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight"]);

export function initOptions(h: OptionsHooks) {
  hooks = h;
  const style = document.createElement("style");
  style.id = "hns-options-css";
  style.textContent = CSS;
  document.head.appendChild(style);
  root = document.createElement("div");
  root.id = "hns-menu";
  document.body.appendChild(root);
  root.addEventListener("mousedown", (e) => {
    if (e.target === root && !capture && !confirmEl) closeMenu(); // click outside the panel resumes
  });
  root.addEventListener("contextmenu", (e) => e.preventDefault());
  // Menu sounds: hover on entering a new button, click on press (confirms play their own).
  let hovered: Element | null = null;
  root.addEventListener("mouseover", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b && b !== hovered && !b.disabled) uiSound("ui.hover");
    hovered = b;
  });
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b && !b.classList.contains("blood")) uiSound("ui.click");
    else if (b) uiSound("ui.confirm");
  });

  // Capture phase on window: runs before input.ts, so game keys don't fire while the menu is up.
  window.addEventListener(
    "keydown",
    (e) => {
      if (capture) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        if (e.code === "Escape") return cancelCapture();
        // A modifier alone: wait to see if a key follows (combo) or it is released (bind the modifier).
        if (MOD_CODES.has(e.code)) {
          capture.mod = e.code;
          capture.btn.textContent = bindLabel(bindFromEvent(e)) + "+ ...";
          return;
        }
        finishCapture(bindFromEvent(e));
        return;
      }
      if (screen === "closed") return;
      e.stopImmediatePropagation();
      if (e.code === "Escape") {
        e.preventDefault();
        if (!e.repeat) back();
      } else if (e.code === "Tab" || e.altKey) e.preventDefault();
    },
    true,
  );
  window.addEventListener(
    "keyup",
    (e) => {
      if (!capture) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (capture.mod && e.code === capture.mod) finishCapture(bindFromEvent(e));
    },
    true,
  );
  window.addEventListener(
    "mousedown",
    (e) => {
      if (!capture) return;
      const t = e.target as HTMLElement;
      // Clicking another key box, a tab or the X cancels; any other click binds that mouse button.
      if (t !== capture.btn && (t.closest(".ho-key") || t.closest(".ho-x") || t.closest(".ho-tab") || t.closest(".ho-rst"))) {
        cancelCapture();
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      capturedAt = performance.now();
      finishCapture(bindFromEvent(e));
    },
    true,
  );
  // Swallow the click that follows a captured mouse bind so it can't restart capture.
  window.addEventListener(
    "click",
    (e) => {
      if (performance.now() - capturedAt < 400) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener("blur", () => {
    if (capture) cancelCapture();
  });

  applyUiScale();
  applyColorblind();
  onChange("interface", "uiScale", applyUiScale);
  onChange("game", "colorblind", applyColorblind);
  onBindsChange(() => {
    if (screen === "options" && tab === "controls" && !capture && !confirmEl) renderBody();
  });
}

// ---- live-applied settings owned here ----------------------------------------------------

function applyUiScale() {
  // Canvas HUD reads uiScale in render.ts; DOM panels follow through this CSS variable.
  const k = getSettings().interface.uiScale;
  document.documentElement.style.setProperty("--hns-ui", String(k));
  const inv = document.getElementById("inv-panel");
  if (inv) inv.style.setProperty("zoom", String(k));
}

const BASE_RARITY = [...RARITY_COLORS] as string[];
/** Colourblind-friendly rarity colours: spread on lightness and the blue-orange axis. */
const CB_RARITY = ["#f2f2f2", "#5ab0ff", "#ffb000"];
function applyColorblind() {
  const cb = getSettings().game.colorblind;
  // RARITY_COLORS is read every frame by the renderer and on every tooltip build; swapping its
  // entries in place recolours everything without touching those files.
  const target = RARITY_COLORS as unknown as string[];
  const pal = cb ? CB_RARITY : BASE_RARITY;
  for (let i = 0; i < target.length; i++) target[i] = pal[i] ?? BASE_RARITY[i];
  document.body.classList.toggle("hns-cb", cb);
}

// ---- rendering ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(text: string, onClick: () => void, cls = "hm-btn"): HTMLButtonElement {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function render() {
  root.classList.toggle("open", screen !== "closed");
  root.innerHTML = "";
  confirmEl = null;
  noteEl = null;
  bodyEl = null;
  if (screen === "closed") return;
  const zoom = el("div", "hm-zoom");
  root.appendChild(zoom);
  if (screen === "menu") zoom.appendChild(renderMenu());
  else zoom.appendChild(renderOptions());
}

function renderMenu(): HTMLElement {
  const box = el("div", "hm-box hm-panel");
  box.appendChild(el("h2", "hm-title", "Respite"));
  box.appendChild(el("div", "hm-sub", "The match goes on without you"));
  box.appendChild(el("div", "hm-orn"));
  const resume = button("Resume", closeMenu);
  box.appendChild(resume);
  box.appendChild(button("Options", () => openOptions()));
  box.appendChild(button("Controls", () => openOptions("controls")));
  box.appendChild(renderKeyCard());
  box.appendChild(el("div", "hm-rule"));
  box.appendChild(button(isAlive() ? "Leave match" : "Stop spectating", tryLeave, "hm-btn blood"));
  setTimeout(() => resume.focus(), 0);
  return box;
}

/** Read-only quick reference of the panel / HUD keys (current bindings). */
function renderKeyCard(): HTMLElement {
  const card = el("div", "hm-keys");
  const ids = ["inventory", "character", "skills", "tree", "map", "mapOverlay", "social", "chat", "weaponSwap", "toggleLabels", "options"];
  for (const id of ids) {
    const a = ACTION_BY_ID.get(id);
    if (!a) continue;
    const row = el("div", "hm-key");
    row.appendChild(el("span", "", a.label));
    row.appendChild(el("b", "", actionLabel(id) || "unbound"));
    card.appendChild(row);
  }
  return card;
}

/** Royale HUD spectate panel "Leave" button: the same confirm-then-leave flow as the Esc menu. */
export function requestLeaveMatch(): void {
  if (!hooks.inMatch()) return;
  if (screen === "closed") openMenu(); // the confirm lives in the menu root
  tryLeave();
}

function tryLeave() {
  // Already eliminated: nothing is at stake, so no confirm.
  if (!isAlive()) return leave();
  if (!getSettings().game.confirmLeave) return leave();
  showConfirm("Leave the match?", "You drop out of this round and return to the join screen. Everything you carry stays where you stood.", "Leave", leave);
}

function leave() {
  closeMenu();
  hooks.onLeave();
}

function showConfirm(title: string, text: string, yes: string, onYes: () => void) {
  closeConfirm();
  const wrap = el("div", "ho-confirm");
  const box = el("div", "hm-box hm-panel");
  box.appendChild(el("h3", "hm-title", title));
  box.appendChild(el("p", "", text));
  const row = el("div", "row2");
  row.appendChild(button(yes, onYes, "hm-btn blood"));
  const no = button("Cancel", closeConfirm);
  row.appendChild(no);
  box.appendChild(row);
  wrap.appendChild(box);
  wrap.addEventListener("mousedown", (e) => {
    if (e.target === wrap) closeConfirm();
  });
  root.appendChild(wrap);
  confirmEl = wrap;
  setTimeout(() => no.focus(), 0);
}

function closeConfirm() {
  confirmEl?.remove();
  confirmEl = null;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "game", label: "Game" },
  { id: "graphics", label: "Graphics" },
  { id: "audio", label: "Audio" },
  { id: "controls", label: "Controls" },
  { id: "interface", label: "Interface" },
];

let bodyEl: HTMLDivElement | null = null;

function renderOptions(): HTMLElement {
  const box = el("div", "ho-box hm-panel");
  const head = el("div", "ho-head");
  head.appendChild(el("h2", "hm-title", "Options"));
  const x = button("✕", back, "ho-x");
  x.title = "Back (Esc)";
  head.appendChild(x);
  box.appendChild(head);

  const tabs = el("div", "ho-tabs");
  for (const tb of TABS) {
    tabs.appendChild(
      button(
        tb.label,
        () => {
          capture = null;
          tab = tb.id;
          render();
        },
        "ho-tab" + (tb.id === tab ? " on" : ""),
      ),
    );
  }
  box.appendChild(tabs);

  bodyEl = el("div", "ho-body");
  box.appendChild(bodyEl);

  const foot = el("div", "ho-foot");
  foot.appendChild(
    button(tab === "controls" ? "Reset all keys" : "Reset tab", () => {
      const label = TABS.find((t) => t.id === tab)?.label ?? "";
      const what = tab === "controls" ? `every key binding to the ${PRESETS.find((p) => p.id === DEFAULT_PRESET)!.label} defaults` : `every ${label} option to its default`;
      showConfirm("Reset?", `Restore ${what}.`, "Reset", () => {
        if (tab === "controls") resetBinds();
        else resetSettings(tab);
        closeConfirm();
        renderBody();
        note(`${label} restored to defaults.`);
      });
    }),
  );
  noteEl = el("div", "ho-note");
  foot.appendChild(noteEl);
  foot.appendChild(button("Done", closeMenu, "hm-btn blood"));
  box.appendChild(foot);
  renderBody();
  return box;
}

function note(text: string, kind: "" | "warn" | "err" = "") {
  if (!noteEl) return;
  noteEl.textContent = text;
  noteEl.className = "ho-note" + (kind ? " " + kind : "");
}

function renderBody() {
  if (!bodyEl) return;
  const scroll = bodyEl.scrollTop;
  bodyEl.innerHTML = "";
  if (tab === "controls") renderControls(bodyEl);
  else for (const r of ROWS[tab]) bodyEl.appendChild(renderRow(r));
  bodyEl.scrollTop = scroll;
}

// ---- generic setting rows -----------------------------------------------------------------

type Val = string | number | boolean;
type RowDef =
  | { k: "sec"; text: string }
  | { k: "tog"; g: Group; key: string; label: string; desc?: string }
  | { k: "seg"; g: Group; key: string; label: string; desc?: string; opts: [Val, string][] }
  | { k: "sl"; g: Group; key: string; label: string; desc?: string; min: number; max: number; step: number; fmt: (v: number) => string }
  | { k: "info"; label: string; desc?: string; html: () => string };

const pct = (v: number) => Math.round(v * 100) + "%";

const ROWS: Record<Group, RowDef[]> = {
  game: [
    { k: "sec", text: "Language" },
    { k: "seg", g: "game", key: "language", label: "Language", desc: "Auto follows your system language.", opts: [["auto", "Auto"], ["en", "English"], ["pl", "Polski"]] },
    { k: "sec", text: "Loot" },
    { k: "tog", g: "game", key: "autoPickup", label: "Auto-pickup flasks and currency", desc: "Picked up as you walk over them. The server still checks the range." },
    { k: "sec", text: "Accessibility" },
    { k: "tog", g: "game", key: "colorblind", label: "Colourblind-friendly palette", desc: "Rarity colours and the better / worse colours in tooltips." },
    {
      k: "info",
      label: "Rarity preview",
      html: () => RARITY_NAMES.map((n, i) => `<span style="color:${RARITY_COLORS[i]};margin-left:12px"><span class="ho-sw" style="background:${RARITY_COLORS[i]}"></span>${n}</span>`).join(""),
    },
    { k: "sec", text: "Match" },
    { k: "tog", g: "game", key: "autoEquip", label: "Auto-equip into empty slots", desc: "Picked-up gear you can use goes straight into an empty slot." },
    { k: "tog", g: "game", key: "confirmLeave", label: "Confirm before leaving the match" },
  ],
  graphics: [
    { k: "sec", text: "Display" },
    { k: "seg", g: "graphics", key: "renderScale", label: "Render scale", desc: "Resolution of the game world. Auto caps it on very dense (4K / retina) screens.", opts: [[0, "Auto"], [0.5, "50%"], [0.67, "67%"], [0.75, "75%"], [0.85, "85%"], [1, "100%"]] },
    { k: "sl", g: "graphics", key: "brightness", label: "Brightness", desc: "How much the dark lets through outside your light.", min: 0.5, max: 1.8, step: 0.05, fmt: pct },
    { k: "seg", g: "graphics", key: "fpsCap", label: "Frame rate cap", desc: "Max follows your display's refresh rate.", opts: [[30, "30"], [60, "60"], [120, "120"], [0, "Max"]] },
    { k: "sec", text: "Effects" },
    { k: "seg", g: "graphics", key: "lightQuality", label: "Light quality", desc: "Low drops minor lights (loot, projectiles, auras) and shrinks the rest.", opts: [["low", "Low"], ["medium", "Medium"], ["high", "High"]] },
    { k: "seg", g: "graphics", key: "particles", label: "Particle density", opts: [[0.25, "25%"], [0.5, "50%"], [0.75, "75%"], [1, "100%"]] },
    { k: "tog", g: "graphics", key: "screenShake", label: "Screen shake", desc: "Camera shake on heavy hits and slams." },
    { k: "tog", g: "graphics", key: "paintedSprites", label: "Painted sprites", desc: "Hand-painted heroes, monsters, ground and props (procedural art where none exists)." },
    { k: "sec", text: "Gore" },
    { k: "seg", g: "graphics", key: "gore", label: "Gore", desc: "Blood, gibs and dismemberment. Off shows none.", opts: [["off", "Off"], ["reduced", "Reduced"], ["full", "Full"], ["extreme", "Extreme"]] },
    { k: "tog", g: "graphics", key: "persistentBlood", label: "Persistent blood", desc: "Blood stays on the ground for the whole match instead of fading." },
    { k: "sec", text: "Performance overlay" },
    { k: "tog", g: "graphics", key: "showFps", label: "Show FPS" },
    { k: "tog", g: "graphics", key: "showPing", label: "Show ping" },
  ],
  interface: [
    { k: "sec", text: "Layout" },
    { k: "seg", g: "interface", key: "uiScale", label: "UI scale", desc: "HUD, panels and this menu.", opts: [[0.75, "75%"], [0.9, "90%"], [1, "100%"], [1.15, "115%"], [1.3, "130%"]] },
    { k: "sec", text: "Map" },
    { k: "tog", g: "interface", key: "showMinimap", label: "Show corner map" },
    { k: "sl", g: "interface", key: "minimapSize", label: "Minimap size", min: 0.6, max: 1.8, step: 0.1, fmt: pct },
    { k: "sl", g: "interface", key: "minimapOpacity", label: "Minimap opacity", min: 0.2, max: 1, step: 0.05, fmt: pct },
    { k: "sl", g: "interface", key: "overlayOpacity", label: "Overlay map opacity", desc: "The see-through map on the map overlay key (Tab).", min: 0.2, max: 1, step: 0.05, fmt: pct },
    { k: "sl", g: "interface", key: "overlayZoom", label: "Overlay map zoom", min: 0.6, max: 1.6, step: 0.1, fmt: pct },
    { k: "sec", text: "Chat" },
    { k: "seg", g: "interface", key: "chatSize", label: "Chat text size", opts: [["small", "Small"], ["normal", "Normal"], ["large", "Large"]] },
    { k: "sl", g: "interface", key: "chatOpacity", label: "Chat opacity", min: 0.3, max: 1, step: 0.05, fmt: pct },
    { k: "sec", text: "Combat text" },
    { k: "seg", g: "interface", key: "damageNumbers", label: "Damage numbers", desc: "Own: hits you deal and hits you take.", opts: [["all", "All"], ["own", "Own"], ["off", "Off"]] },
    { k: "seg", g: "interface", key: "playerLabels", label: "Player name labels", opts: [["all", "All"], ["others", "Others"], ["off", "Off"]] },
    { k: "seg", g: "interface", key: "monsterBars", label: "Monster life bars", desc: "Elite names always show.", opts: [["damaged", "Damaged"], ["always", "Always"], ["off", "Off"]] },
    { k: "tog", g: "interface", key: "targetBar", label: "Target and boss life bar", desc: "The bar at the top for what you hover or last hit." },
    { k: "tog", g: "interface", key: "buffTimers", label: "Buff and debuff timers" },
    { k: "tog", g: "interface", key: "lowLifeVignette", label: "Low-life warning", desc: "Red pulse at the screen edges while your life is low." },
    { k: "sec", text: "Items" },
    { k: "tog", g: "interface", key: "alwaysShowLabels", label: "Always show item labels", desc: "Off: labels show only while holding the Show item labels key (Alt)." },
    { k: "seg", g: "interface", key: "lootMinRarity", label: "Show gear from", desc: "Loot filter. Hold Alt to reveal hidden items.", opts: [[0, "All"], [1, "Magic+"], [2, "Rare+"], [3, "Unique"]] },
    { k: "tog", g: "interface", key: "lootGems", label: "Show gems" },
    { k: "tog", g: "interface", key: "lootFlasks", label: "Show flasks and charms" },
    { k: "tog", g: "interface", key: "lootEmbers", label: "Show Embers and other currency" },
    { k: "tog", g: "interface", key: "lootMinimapIcons", label: "Map icons for rare and better drops" },
    { k: "sl", g: "interface", key: "labelScale", label: "Item label size", min: 0.8, max: 1.4, step: 0.05, fmt: pct },
    { k: "sl", g: "interface", key: "cursorScale", label: "Cursor size", min: 0.8, max: 1.6, step: 0.1, fmt: pct },
    { k: "tog", g: "interface", key: "tooltipCompare", label: "Tooltip compare", desc: "Compare against what you have equipped." },
  ],
  audio: [
    { k: "sec", text: "Volume" },
    { k: "sl", g: "audio", key: "master", label: "Master", min: 0, max: 1, step: 0.01, fmt: pct },
    { k: "sl", g: "audio", key: "music", label: "Music", min: 0, max: 1, step: 0.01, fmt: pct },
    { k: "sl", g: "audio", key: "effects", label: "Effects", min: 0, max: 1, step: 0.01, fmt: pct },
    { k: "sl", g: "audio", key: "ui", label: "Interface", min: 0, max: 1, step: 0.01, fmt: pct },
    { k: "sec", text: "Behaviour" },
    { k: "tog", g: "audio", key: "muteUnfocused", label: "Mute when unfocused", desc: "Silence the game while another window has focus." },
    { k: "info", label: "Sound", desc: "Interface volume covers menu clicks; effects covers combat and the world.", html: () => "" },
  ],
};

function getVal(g: Group, key: string): Val {
  return (getSettings()[g] as unknown as Record<string, Val>)[key];
}
function setVal(g: Group, key: string, v: Val) {
  (setSetting as (g: Group, k: string, v: Val) => void)(g, key, v);
  if (g === "interface" && key === "lootMinRarity") {
    // Older readers still look at the two legacy toggles.
    setSetting("interface", "hideNormal", Number(v) >= 1);
    setSetting("interface", "hideMagic", Number(v) >= 2);
  }
}

function rowShell(label: string, desc?: string): { row: HTMLDivElement; ctl: HTMLDivElement } {
  const row = el("div", "ho-row");
  const lab = el("div", "ho-lab", label);
  if (desc) lab.appendChild(el("span", "ho-desc", desc));
  const ctl = el("div", "ho-ctl");
  row.appendChild(lab);
  row.appendChild(ctl);
  return { row, ctl };
}

function renderRow(r: RowDef): HTMLElement {
  if (r.k === "sec") return el("div", "ho-sec", r.text);
  const { row, ctl } = rowShell(r.label, r.desc);
  if (r.k === "info") {
    ctl.innerHTML = r.html();
  } else if (r.k === "tog") {
    const b = el("button", "ho-tog");
    b.type = "button";
    b.setAttribute("role", "switch");
    b.setAttribute("aria-label", r.label);
    const sync = () => {
      const on = !!getVal(r.g, r.key);
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    };
    sync();
    b.addEventListener("click", () => {
      setVal(r.g, r.key, !getVal(r.g, r.key));
      sync();
      if (r.g === "game" && r.key === "colorblind") renderBody(); // refresh the swatches
    });
    ctl.appendChild(b);
  } else if (r.k === "seg") {
    const seg = el("div", "ho-seg");
    const btns = r.opts.map(([v, label]) => {
      const b = el("button", "", label);
      b.type = "button";
      b.addEventListener("click", () => {
        setVal(r.g, r.key, v);
        btns.forEach((x, i) => x.classList.toggle("on", r.opts[i][0] === v));
      });
      seg.appendChild(b);
      return b;
    });
    const cur = getVal(r.g, r.key);
    btns.forEach((x, i) => x.classList.toggle("on", r.opts[i][0] === cur));
    ctl.appendChild(seg);
  } else {
    const s = el("input", "ho-sl");
    s.type = "range";
    s.min = String(r.min);
    s.max = String(r.max);
    s.step = String(r.step);
    s.value = String(getVal(r.g, r.key));
    s.setAttribute("aria-label", r.label);
    const val = el("span", "ho-val");
    const sync = () => {
      const v = Number(s.value);
      val.textContent = r.fmt(v);
      s.style.setProperty("--p", ((v - r.min) / (r.max - r.min)) * 100 + "%");
    };
    sync();
    s.addEventListener("input", () => {
      setVal(r.g, r.key, Math.round(Number(s.value) * 1000) / 1000);
      sync();
    });
    ctl.appendChild(s);
    ctl.appendChild(val);
  }
  return row;
}

// ---- controls tab ------------------------------------------------------------------------

const GROUP_LABELS: Record<ActionGroup, string> = {
  move: "Movement",
  combat: "Combat & interaction",
  skills: "Skill bar",
  flasks: "Flasks & charms",
  panels: "Panels & screens",
  interface: "Interface",
};

function renderControls(body: HTMLElement) {
  // Preset picker
  body.appendChild(el("div", "ho-sec", "Preset"));
  const cur = matchingPreset();
  const { row, ctl } = rowShell("Key layout", cur ? PRESETS.find((p) => p.id === cur)!.desc : "Custom: you have changed some keys.");
  const seg = el("div", "ho-seg");
  for (const p of PRESETS) {
    const b = button(
      p.label,
      () => {
        if (matchingPreset() === p.id) return;
        showConfirm("Apply preset?", `Replace every key binding with the ${p.label} layout.`, "Apply", () => {
          resetBinds(p.id);
          closeConfirm();
          renderBody();
          note(`${p.label} layout applied.`);
        });
      },
      p.id === cur ? "on" : "",
    );
    seg.appendChild(b);
  }
  ctl.appendChild(seg);
  body.appendChild(row);

  const help = el("div", "ho-help");
  help.innerHTML = tr(
    "Click a key box, then press a key, a mouse button or a combo (<b>Ctrl</b> / <b>Shift</b> / <b>Alt</b> + key). " +
    "Tap a modifier alone to bind just it. <b>Right-click</b> clears a box, <b>↺</b> restores a row, <b>Esc</b> cancels.",
  );
  body.appendChild(help);

  const def = presetBinds(DEFAULT_PRESET);
  for (const grp of Object.keys(GROUP_LABELS) as ActionGroup[]) {
    body.appendChild(el("div", "ho-sec", GROUP_LABELS[grp]));
    const head = el("div", "ho-keyhead");
    head.appendChild(el("span", "", "Primary"));
    head.appendChild(el("span", "", "Secondary"));
    head.appendChild(el("i"));
    body.appendChild(head);
    for (const a of ACTIONS.filter((x) => x.group === grp)) {
      const { row: r, ctl: c } = rowShell(a.label);
      const pair = getBinds(a.id);
      for (const slot of [0, 1] as const) {
        const b = pair[slot];
        const btn = el("button", "ho-key" + (b ? "" : " empty"), b ? bindLabel(b) : "unbound");
        btn.type = "button";
        if (b && conflictsOf(b, a.id).length) btn.classList.add("clash");
        if (b !== def[a.id]?.[slot]) btn.classList.add("changed");
        btn.title = b ? `${bindLabel(b)}: click to change, right-click to clear` : "Click to bind";
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          startCapture(a.id, slot, btn);
        });
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          if (performance.now() - capturedAt < 600) return;
          capture = null;
          setBind(a.id, slot, null);
          renderBody();
          note(`${a.label}: ${slot ? "secondary" : "primary"} key cleared.`);
        });
        c.appendChild(btn);
      }
      const isDef = pair[0] === def[a.id]?.[0] && pair[1] === def[a.id]?.[1];
      const rst = button("↺", () => {
        resetBind(a.id);
        renderBody();
        note(`${a.label} restored to ${bindLabel(def[a.id][0]) || "unbound"}.`);
      }, "ho-rst");
      rst.title = "Restore default";
      rst.disabled = isDef;
      c.appendChild(rst);
      body.appendChild(r);
    }
  }
}

function startCapture(id: string, slot: 0 | 1, btn: HTMLButtonElement) {
  if (capture) renderBody();
  capture = { id, slot, btn, mod: null };
  btn.classList.add("wait");
  btn.classList.remove("empty");
  btn.textContent = "press a key…";
  note(`Binding ${ACTION_BY_ID.get(id)?.label} (${slot ? "secondary" : "primary"}): press a key, mouse button or combo. Esc cancels.`);
}

function cancelCapture() {
  if (!capture) return;
  capture = null;
  renderBody();
  note("");
}

function finishCapture(b: Bind) {
  if (!capture || !b) return;
  const { id, slot } = capture;
  const label = ACTION_BY_ID.get(id)?.label ?? id;
  if (isReserved(b)) {
    capture.mod = null;
    capture.btn.textContent = "press a key…";
    note(
      b.endsWith("Escape") ? "Esc is reserved for the menu. Pick another key." : `${bindLabel(b)} is reserved by the browser (the page never receives it). Pick another key.`,
      "err",
    );
    return; // stay in capture so they can try again
  }
  capture = null;
  if (getBinds(id)[slot] === b) {
    renderBody();
    note(`${label} is already on ${bindLabel(b)}.`);
    return;
  }
  const clashes = conflictsOf(b, id);
  if (!clashes.length) {
    setBind(id, slot, b);
    uiSound("ui.confirm");
    renderBody();
    note(`${label} bound to ${bindLabel(b)}.`);
    return;
  }
  renderBody();
  note("");
  const names = clashes.map((c) => ACTION_BY_ID.get(c)?.label ?? c).join(", ");
  showConfirm("Key in use", `${bindLabel(b)} is already bound to ${names}. Move it to ${label}? ${names} will be left without it.`, "Rebind", () => {
    const res = setBind(id, slot, b);
    closeConfirm();
    renderBody();
    if (res.ok) note(`${label} bound to ${bindLabel(b)}; removed from ${names}.`, "warn");
    else note(res.reason, "err");
  });
}

export type { PresetId };

// ---- small handlers main.ts delegates to ------------------------------------------------

/** One-shot option keys from input.ts. Returns true if handled. */
export function handleOptionAction(a: string): boolean {
  const s = getSettings();
  if (a === "options") {
    if (screen === "closed" && hooks.inMatch()) openOptions();
    return true;
  }
  if (a === "toggleLabels") {
    setSetting("interface", "alwaysShowLabels", !s.interface.alwaysShowLabels);
    return true;
  }
  if (a === "perfStats") {
    const on = !(s.graphics.showFps && s.graphics.showPing);
    setSetting("graphics", "showFps", on);
    setSetting("graphics", "showPing", on);
    return true;
  }
  return false;
}

const AUTO_CATEGORIES = new Set(["flask", "currency"]);
const autoTried = new Map<number, number>();
let autoNext = 0;
/**
 * Auto-pickup (Game option): ask the server for flasks / currency within range. The server
 * validates range and room; each ground id is retried at most every 1.5 s.
 */
export function autoPickupTick(
  nowMs: number,
  me: { x: number; y: number } | null,
  ground: readonly (readonly [number, number, number])[],
  category: (g: number) => string | null,
  range: number,
  send: (g: number) => void,
) {
  if (!getSettings().game.autoPickup || !me || nowMs < autoNext) return;
  autoNext = nowMs + 150;
  for (const [g, x, y] of ground) {
    if (Math.hypot(x - me.x, y - me.y) > range) continue;
    const c = category(g);
    if (!c || !AUTO_CATEGORIES.has(c)) continue;
    if (nowMs - (autoTried.get(g) ?? -1e9) < 1500) continue;
    autoTried.set(g, nowMs);
    send(g);
  }
  if (autoTried.size > 500) for (const [g, t] of autoTried) if (nowMs - t > 5000) autoTried.delete(g);
}
