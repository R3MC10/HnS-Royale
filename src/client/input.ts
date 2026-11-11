// Keyboard + mouse state. Held actions are polled by the input loop;
// one-shot actions (pickup, flasks, inventory) go through `onAction`.
import { actionsForPress, isBoundCode, isCodeDown, isHeld, onBindsChange, press, release, releaseAll, runActionHandler, SKILL_SLOTS } from "./keybinds";

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  dodge: boolean;
  scoreboard: boolean;
  shift: boolean;
  /** Held state of the 16 skill bar slots (keybinds skill0..skill15). Slot 0 also drives `attack`. */
  skills: boolean[];
  /** "Hold to attack in place" key: movement is suppressed while held. */
  attackInPlace: boolean;
  /** "Raise shield" key held (active block; main.ts sends it only with a shield equipped). */
  block: boolean;
  /** "Show item labels" key held (labels are hidden otherwise when that option is off). */
  showLabels: boolean;
  mouseX: number; // CSS pixels in the canvas
  mouseY: number;
  /** worldui: the pointer is over the game canvas itself (not a DOM panel / outside the window). World hover is suppressed otherwise. */
  overCanvas: boolean;
}

export const input: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  attack: false,
  dodge: false,
  scoreboard: false,
  shift: false,
  skills: new Array(SKILL_SLOTS).fill(false),
  attackInPlace: false,
  block: false,
  showLabels: false,
  mouseX: 0,
  mouseY: 0,
  overCanvas: false,
};

export type Action =
  | { a: "pickup"; equip: boolean }
  | { a: "flask"; i: number }
  | { a: "inventory" }
  | { a: "panel"; p: PanelId }
  | { a: "charm"; i: number }
  | { a: "weaponSwap" }
  | { a: "chat" }
  | { a: "options" }
  | { a: "toggleLabels" }
  | { a: "perfStats" }
  | { a: "specPrev" }
  | { a: "specNext" }
  | { a: "close" };

/** Panels / screens opened by a key (see keybinds.ts). Systems that own them handle the action. */
export type PanelId = "tree" | "skills" | "map" | "mapOverlay" | "character" | "social";
const PANEL_IDS = new Set<string>(["tree", "skills", "map", "mapOverlay", "character", "social"]);
const SIMPLE = new Set<string>(["weaponSwap", "chat", "options", "toggleLabels", "perfStats", "specPrev", "specNext"]);

export interface InputHooks {
  enabled: () => boolean; // false while the join overlay is up
  onAction: (act: Action) => void;
  /** Left click on the canvas; return true to consume it (e.g. clicked a ground item). */
  onCanvasClick: (x: number, y: number, shift: boolean) => boolean;
}

// Held keys / mouse buttons are tracked in ./keybinds.ts; every binding is looked up there.

function refresh() {
  input.up = isHeld("moveUp");
  input.down = isHeld("moveDown");
  input.left = isHeld("moveLeft");
  input.right = isHeld("moveRight");
  for (let i = 0; i < SKILL_SLOTS; i++) input.skills[i] = isHeld(`skill${i}`);
  input.attack = input.skills[0];
  input.dodge = isHeld("dodge");
  input.scoreboard = isHeld("scoreboard");
  input.attackInPlace = isHeld("attackInPlace");
  input.block = isHeld("raiseShield");
  input.showLabels = isHeld("showLabels");
  input.shift = isCodeDown("ShiftLeft") || isCodeDown("ShiftRight");
}

/** Drop every held key and button (window blur, a menu opening over the game). */
export function clearInput() {
  releaseAll();
  taps.skills.fill(0);
  taps.dodge = 0;
  refresh();
}

/**
 * Input buffering: when each skill slot / the dodge key was last freshly pressed (performance.now() ms, 0 = never).
 * main.ts keeps a tap alive until the hero is free to act (see TAP_BUFFER_MS there), so a press made
 * during a swing, a cast or a roll is not lost, and a press shorter than one input tick still counts.
 */
export const taps = { skills: new Array<number>(SKILL_SLOTS).fill(0), dodge: 0 };

/** One-shot actions for a fresh press of a key or mouse button. */
function dispatchPress(code: string, e: KeyboardEvent | MouseEvent, hooks: InputHooks) {
  for (const id of actionsForPress(code, e)) {
    if (id === "dodge") taps.dodge = performance.now();
    else if (id.startsWith("skill") && id !== "skills") taps.skills[Number(id.slice(5))] = performance.now();
    if (runActionHandler(id)) continue; // actions a system registered itself for (keybinds.setActionHandler)
    if (id === "pickup") hooks.onAction({ a: "pickup", equip: e.shiftKey });
    else if (id.startsWith("flask")) hooks.onAction({ a: "flask", i: Number(id.slice(5)) });
    else if (id.startsWith("charm")) hooks.onAction({ a: "charm", i: Number(id.slice(5)) });
    else if (id === "inventory") hooks.onAction({ a: "inventory" });
    else if (PANEL_IDS.has(id)) hooks.onAction({ a: "panel", p: id as PanelId });
    else if (SIMPLE.has(id)) hooks.onAction({ a: id } as Action);
  }
}

export function initInput(canvas: HTMLCanvasElement, hooks: InputHooks) {
  window.addEventListener("keydown", (e) => {
    if (!hooks.enabled()) return;
    if (["Tab", "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) || isBoundCode(e.code, e) || e.code.startsWith("Alt")) e.preventDefault();
    if (!e.repeat) {
      if (e.code === "Escape") hooks.onAction({ a: "close" });
      else dispatchPress(e.code, e, hooks);
    }
    press(e.code);
    refresh();
  });
  window.addEventListener("keyup", (e) => {
    release(e.code);
    refresh();
  });
  window.addEventListener("blur", () => clearInput());
  canvas.addEventListener("mousemove", (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    input.overCanvas = true;
  });
  // worldui: DOM panels over the canvas (inventory, tree, menus) fire mouseleave; world hover stops there.
  canvas.addEventListener("mouseenter", () => (input.overCanvas = true));
  canvas.addEventListener("mouseleave", () => (input.overCanvas = false));
  canvas.addEventListener("mousedown", (e) => {
    if (!hooks.enabled()) return;
    if (e.button !== 0) e.preventDefault(); // no autoscroll (MMB) / history navigation (side buttons)
    if (e.button === 0 && hooks.onCanvasClick(e.clientX, e.clientY, e.shiftKey)) return;
    const code = "Mouse" + e.button;
    dispatchPress(code, e, hooks);
    press(code);
    refresh();
  });
  window.addEventListener("mouseup", (e) => {
    if ((e.button === 3 || e.button === 4) && hooks.enabled()) e.preventDefault();
    release("Mouse" + e.button);
    refresh();
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  onBindsChange(refresh);
}

/** Movement axes from keys, -1..1. */
export function moveAxes(): { mx: number; my: number } {
  return {
    mx: (input.right ? 1 : 0) - (input.left ? 1 : 0),
    my: (input.down ? 1 : 0) - (input.up ? 1 : 0),
  };
}
