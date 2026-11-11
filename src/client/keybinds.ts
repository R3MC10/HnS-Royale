// Single action -> key table. Input handling (./input.ts), the skill bar and the options panel all
// read from here; only the options panel writes. Persisted separately from ./settings.ts.
//
// A binding is a string: a KeyboardEvent.code ("KeyQ", "Space", "Digit1", "ShiftLeft") or a mouse
// button "Mouse0" (left) / "Mouse1" (middle) / "Mouse2" (right) / "Mouse3" / "Mouse4" (side buttons),
// optionally prefixed with modifiers in the fixed order "Ctrl+", "Shift+", "Alt+"
// (e.g. "Ctrl+KeyQ", "Shift+Mouse2"). Each action has two slots (primary, alternate); null = unbound.
//
// A plain binding is shadowed while a held modifier combo of the same key is bound to something
// else: with Ctrl held, Q fires "Ctrl+KeyQ" (second skill bar), not "KeyQ".
//
// Skill slots are skill0..skill15: 0-7 the main bar, 8-15 the Ctrl bar (PoE2-style second bar).
// Browser-reserved combos (Ctrl+T, Ctrl+W, Ctrl+N, Ctrl+Tab, ...) are refused: pages never get them.

export type Bind = string | null;
export type BindPair = [Bind, Bind];

export type ActionGroup = "move" | "combat" | "skills" | "flasks" | "panels" | "interface";

export interface ActionDef {
  id: string;
  label: string;
  group: ActionGroup;
  /** Held actions are polled every input tick; others fire once on press. */
  held?: boolean;
}

export const SKILL_SLOTS = 16;
export const FLASK_SLOTS = 3; // = MAX_FLASK_SLOTS (HUD core: slots 4/5 do not exist)
export const CHARM_SLOTS = 3;

export const ACTIONS: ActionDef[] = [
  { id: "moveUp", label: "Move up", group: "move", held: true },
  { id: "moveDown", label: "Move down", group: "move", held: true },
  { id: "moveLeft", label: "Move left", group: "move", held: true },
  { id: "moveRight", label: "Move right", group: "move", held: true },
  { id: "dodge", label: "Dodge roll", group: "combat", held: true },
  { id: "attackInPlace", label: "Attack in place (hold)", group: "combat", held: true },
  { id: "raiseShield", label: "Raise shield (hold, needs a shield)", group: "combat", held: true },
  { id: "pickup", label: "Pick up / interact (Shift: equip)", group: "combat" },
  { id: "weaponSwap", label: "Weapon swap", group: "combat" },
  ...Array.from({ length: SKILL_SLOTS }, (_, i): ActionDef => ({ id: `skill${i}`, label: i < 8 ? `Skill ${i + 1}` : `Skill ${i + 1} (second bar)`, group: "skills", held: true })),
  ...Array.from({ length: FLASK_SLOTS }, (_, i): ActionDef => ({ id: `flask${i}`, label: `Flask ${i + 1}`, group: "flasks" })),
  ...Array.from({ length: CHARM_SLOTS }, (_, i): ActionDef => ({ id: `charm${i}`, label: `Charm ${i + 1}`, group: "flasks" })),
  { id: "inventory", label: "Inventory", group: "panels" },
  { id: "character", label: "Character sheet", group: "panels" },
  { id: "tree", label: "Passive skill tree", group: "panels" },
  { id: "skills", label: "Skills / gems", group: "panels" },
  { id: "map", label: "World map", group: "panels" },
  { id: "mapOverlay", label: "Map overlay", group: "panels" },
  { id: "social", label: "Social", group: "panels" },
  { id: "scoreboard", label: "Scoreboard (hold)", group: "panels", held: true },
  { id: "options", label: "Options", group: "panels" },
  { id: "chat", label: "Chat", group: "interface" },
  { id: "showLabels", label: "Show item labels (hold)", group: "interface", held: true },
  { id: "toggleLabels", label: "Item labels", group: "interface" },
  { id: "perfStats", label: "Toggle FPS / ping", group: "interface" },
  { id: "specPrev", label: "Spectate: previous player", group: "interface" },
  { id: "specNext", label: "Spectate: next player", group: "interface" },
  { id: "minimapZoomIn", label: "Map zoom in (minimap / overlay)", group: "interface" },
  { id: "minimapZoomOut", label: "Map zoom out (minimap / overlay)", group: "interface" },
  { id: "closePanels", label: "Close all panels", group: "interface" },
  { id: "toggleHud", label: "Hide / show HUD", group: "interface" },
];
export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

// ---- presets ---------------------------------------------------------------------------

export type PresetId = "poe2" | "classic";
export const PRESETS: { id: PresetId; label: string; desc: string }[] = [
  { id: "poe2", label: "PoE2-style (WASD)", desc: "Path of Exile 2's WASD defaults for the equivalent actions." },
  { id: "classic", label: "Classic", desc: "This game's original layout: Tab scoreboard, K skills, M map." },
];

/**
 * PoE2's WASD defaults where this game has the same action: skills LMB/MMB/RMB/Q/E/R/T (W moves),
 * Ctrl bar for the second set, Space dodge, Shift attack in place, F pickup, X weapon swap,
 * 1-5 flasks/charms, I inventory, C character, P passive tree, G skills, Tab map overlay, J social,
 * Enter chat, Alt highlight items, Z toggle highlight, O options, F1 performance stats.
 * Differences forced by the browser / this game: G opens skills (as in PoE2), so the 8th slot uses B
 * (alt: side button Mouse4); Ctrl+T is browser-reserved, so that second-bar slot uses Ctrl+V;
 * the world map is M and the scoreboard (no PoE2 equivalent) is L, PoE's ladder key.
 */
function poe2Binds(): Record<string, BindPair> {
  const b: Record<string, BindPair> = {
    moveUp: ["KeyW", "ArrowUp"],
    moveDown: ["KeyS", "ArrowDown"],
    moveLeft: ["KeyA", "ArrowLeft"],
    moveRight: ["KeyD", "ArrowRight"],
    dodge: ["Space", null],
    attackInPlace: ["ShiftLeft", null],
    raiseShield: ["KeyV", null], // free in both presets (Ctrl+V is a second-bar skill)
    pickup: ["KeyF", null],
    weaponSwap: ["KeyX", null],
    inventory: ["KeyI", null],
    character: ["KeyC", null],
    tree: ["KeyP", null],
    skills: ["KeyG", null],
    map: ["KeyM", null],
    mapOverlay: ["Tab", null],
    social: ["KeyJ", null],
    scoreboard: ["KeyL", null],
    options: ["KeyO", null],
    chat: ["Enter", null],
    showLabels: ["AltLeft", null],
    toggleLabels: ["KeyZ", null],
    perfStats: ["F1", null],
    specPrev: ["Comma", null],
    specNext: ["Period", null],
    minimapZoomIn: ["Equal", "NumpadAdd"],
    minimapZoomOut: ["Minus", "NumpadSubtract"],
    closePanels: [null, null], // PoE closes panels with Space; Space is dodge here
    toggleHud: ["F2", null],
  };
  const main = ["Mouse0", "Mouse1", "Mouse2", "KeyQ", "KeyE", "KeyR", "KeyT", "KeyB"];
  const alt8: (string | null)[] = [null, null, null, null, null, null, null, "Mouse3"];
  for (let i = 0; i < 8; i++) {
    b[`skill${i}`] = [main[i], alt8[i]];
    // Ctrl+T is browser-reserved (new tab), so that second-bar slot takes Ctrl+V.
    b[`skill${i + 8}`] = [main[i] === "KeyT" ? "Ctrl+KeyV" : "Ctrl+" + main[i], alt8[i] ? "Ctrl+" + alt8[i] : null];
  }
  for (let i = 0; i < FLASK_SLOTS; i++) b[`flask${i}`] = [`Digit${i + 1}`, null];
  for (let i = 0; i < CHARM_SLOTS; i++) b[`charm${i}`] = [`Digit${i + 4}`, null]; // charms also fire on their own; the key fires one manually
  return b;
}

/** The layout this game shipped with before the PoE2 preset. */
function classicBinds(): Record<string, BindPair> {
  const b = poe2Binds();
  Object.assign(b, {
    skills: ["KeyK", null],
    mapOverlay: [null, null],
    scoreboard: ["Tab", null],
    social: [null, null],
    character: ["KeyC", null],
  });
  const main = ["Mouse0", "Mouse1", "Mouse2", "KeyQ", "KeyE", "KeyR", "KeyT", "KeyG"];
  for (let i = 0; i < 8; i++) {
    b[`skill${i}`] = [main[i], null];
    b[`skill${i + 8}`] = [main[i] === "KeyT" ? "Ctrl+KeyV" : "Ctrl+" + main[i], null];
  }
  return b;
}

export function presetBinds(id: PresetId): Record<string, BindPair> {
  const b = id === "classic" ? classicBinds() : poe2Binds();
  for (const a of ACTIONS) if (!b[a.id]) b[a.id] = [null, null];
  return b;
}
export const DEFAULT_PRESET: PresetId = "poe2";
export function defaultBinds(): Record<string, BindPair> {
  return presetBinds(DEFAULT_PRESET);
}

// ---- persistence ------------------------------------------------------------------

const STORAGE_KEY = "hns-keybinds";
/** Actions that were missing from the saved table at load (new in this version); see newActionsNotice. */
const addedActions: string[] = [];
const VERSION = 2;

function load(): Record<string, BindPair> {
  const def = defaultBinds();
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return def;
    const raw = JSON.parse(s) as { v?: number; binds?: Record<string, unknown> };
    // v1 used the old classic defaults with no new actions; reset to the new defaults.
    if (!raw || raw.v !== VERSION || !raw.binds) return def;
    const saved = new Set<string>();
    for (const a of ACTIONS) {
      const p = raw.binds[a.id];
      if (!Array.isArray(p) || p.length !== 2) continue;
      const ok = (x: unknown): x is Bind => x === null || (typeof x === "string" && x.length < 40 && !isReserved(x));
      if (ok(p[0]) && ok(p[1])) {
        def[a.id] = [p[0], p[1]];
        saved.add(a.id);
      }
    }
    // Actions added after this table was saved get their default keys only where no saved action
    // already uses that key (no silent duplicates with the player's own layout).
    const used = new Set<string>();
    for (const id of saved) for (const b of def[id]) if (b) used.add(b);
    for (const a of ACTIONS) {
      if (saved.has(a.id)) continue;
      const p = def[a.id].map((b) => (b && used.has(b) ? null : b)) as BindPair;
      if (p[0] === null && p[1] !== null) [p[0], p[1]] = [p[1], null];
      def[a.id] = p;
      for (const b of p) if (b) used.add(b);
      addedActions.push(a.id);
    }
  } catch {
    /* corrupted / unavailable storage: defaults */
  }
  return def;
}

let binds = load();

/**
 * One-time notice text for actions added since the player's saved layout ("New controls added: ...")
 * or null. The list is persisted on the next save, so it is shown once.
 */
export function newActionsNotice(): string | null {
  if (!addedActions.length) return null;
  const parts = addedActions.map((id) => `${ACTION_BY_ID.get(id)?.label ?? id} (${actionLabel(id) === "-" ? "unbound" : actionLabel(id)})`);
  addedActions.length = 0;
  save();
  return `New controls added: ${parts.join(", ")}`;
}

// ---- action handlers ------------------------------------------------------------------
// Systems that own a one-shot action can handle it directly (input.ts asks here first),
// so new interface actions need no extra routing in main.ts.
const handlers = new Map<string, () => void>();
/** Handle a one-shot action id when its key is pressed in game. */
export function setActionHandler(id: string, fn: () => void): void {
  handlers.set(id, fn);
}
/** input.ts: run the registered handler for `id`; true when one handled it. */
export function runActionHandler(id: string): boolean {
  const fn = handlers.get(id);
  if (!fn) return false;
  try {
    fn();
  } catch (e) {
    console.error("action handler failed", id, e);
  }
  return true;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, binds }));
  } catch {
    /* ignore */
  }
}

const listeners = new Set<() => void>();
/** Fires after any binding change. Returns an unsubscribe function. */
export function onBindsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  rebuildIndex();
  save();
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (e) {
      console.error("keybind listener failed", e);
    }
  }
}

// ---- parsing ----------------------------------------------------------------------

const MOD_ORDER = ["Ctrl", "Shift", "Alt"] as const;
type Mod = (typeof MOD_ORDER)[number];

/** "Ctrl+Shift+KeyQ" -> { mods: "Ctrl+Shift+", code: "KeyQ" }. */
export function parseBind(b: string): { mods: string; code: string; n: number } {
  let mods = "";
  let rest = b;
  let n = 0;
  for (const m of MOD_ORDER) {
    if (rest.startsWith(m + "+")) {
      mods += m + "+";
      rest = rest.slice(m.length + 1);
      n++;
    }
  }
  return { mods, code: rest, n };
}

function modOfCode(code: string): Mod | null {
  if (code.startsWith("Control")) return "Ctrl";
  if (code.startsWith("Shift")) return "Shift";
  if (code.startsWith("Alt")) return "Alt";
  return null;
}

export function getBinds(id: string): BindPair {
  return binds[id] ?? [null, null];
}

/** Browser / OS reserved combos that a page can never receive (or must not swallow). */
const RESERVED = new Set([
  "Ctrl+KeyT",
  "Ctrl+KeyW",
  "Ctrl+KeyN",
  "Ctrl+Tab",
  "Ctrl+Shift+KeyT",
  "Ctrl+Shift+KeyW",
  "Ctrl+Shift+KeyN",
  "Ctrl+Shift+Tab",
  "Ctrl+Shift+KeyQ",
  "Alt+Tab",
  "Alt+F4",
  "Escape",
]);
export function isReserved(b: string): boolean {
  return RESERVED.has(b) || parseBind(b).code === "Escape";
}

/** code -> the modifier prefixes bound on it (e.g. "KeyQ" -> {"", "Ctrl+"}). */
let comboIndex = new Map<string, Set<string>>();
function rebuildIndex() {
  comboIndex = new Map();
  for (const p of Object.values(binds)) {
    for (const b of p) {
      if (!b) continue;
      const { mods, code } = parseBind(b);
      let s = comboIndex.get(code);
      if (!s) comboIndex.set(code, (s = new Set()));
      s.add(mods);
    }
  }
}
rebuildIndex();

/** Other actions already using this binding. */
export function conflictsOf(b: string, exceptId?: string): string[] {
  const out: string[] = [];
  for (const a of ACTIONS) {
    if (a.id === exceptId) continue;
    const p = getBinds(a.id);
    if (p[0] === b || p[1] === b) out.push(a.id);
  }
  return out;
}

/** Every binding used by more than one action (for highlighting). */
export function allConflicts(): Set<string> {
  const seen = new Map<string, number>();
  for (const a of ACTIONS) for (const b of getBinds(a.id)) if (b) seen.set(b, (seen.get(b) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([b]) => b));
}

export type SetBindResult = { ok: true; unbound: string[] } | { ok: false; reason: string };

/**
 * Assign `b` to slot `slot` of action `id`. A binding used by other actions is moved: they lose
 * it and their ids come back in `unbound` so the UI can say so.
 */
export function setBind(id: string, slot: 0 | 1, b: Bind): SetBindResult {
  if (!ACTION_BY_ID.has(id)) return { ok: false, reason: "Unknown action." };
  if (b && isReserved(b)) return { ok: false, reason: `${bindLabel(b)} is reserved by the browser and can't be bound.` };
  const unbound: string[] = [];
  if (b) {
    for (const other of conflictsOf(b, id)) {
      const p = [...getBinds(other)] as BindPair;
      if (p[0] === b) p[0] = null;
      if (p[1] === b) p[1] = null;
      binds[other] = p;
      unbound.push(other);
    }
  }
  const p = [...getBinds(id)] as BindPair;
  p[slot] = b;
  if (b && p[1 - slot] === b) p[1 - slot] = null;
  binds[id] = p;
  emit();
  return { ok: true, unbound };
}

/** Restore one action to its default in the given preset (or the default preset). */
export function resetBind(id: string, preset: PresetId = DEFAULT_PRESET) {
  const def = presetBinds(preset)[id] ?? [null, null];
  // Free the default keys from whoever holds them now.
  for (const b of def) if (b) for (const other of conflictsOf(b, id)) binds[other] = getBinds(other).map((x) => (x === b ? null : x)) as BindPair;
  binds[id] = [...def] as BindPair;
  emit();
}

export function resetBinds(preset: PresetId = DEFAULT_PRESET) {
  binds = presetBinds(preset);
  emit();
}

/** Which preset the current table equals, if any. */
export function matchingPreset(): PresetId | null {
  for (const p of PRESETS) {
    const def = presetBinds(p.id);
    if (ACTIONS.every((a) => def[a.id][0] === getBinds(a.id)[0] && def[a.id][1] === getBinds(a.id)[1])) return p.id;
  }
  return null;
}

// ---- input state ----------------------------------------------------------------

const pressed = new Set<string>();

/** Turn an event into a binding string ("Ctrl+KeyQ", "Shift+Mouse2"). A modifier key alone stays bare. */
export function bindFromEvent(e: KeyboardEvent | MouseEvent): string {
  const code = e instanceof KeyboardEvent ? e.code : "Mouse" + e.button;
  const own = modOfCode(code);
  let mods = "";
  if (e.ctrlKey && own !== "Ctrl") mods += "Ctrl+";
  if (e.shiftKey && own !== "Shift") mods += "Shift+";
  if (e.altKey && own !== "Alt") mods += "Alt+";
  return mods + code;
}

function modHeld(m: Mod): boolean {
  if (m === "Ctrl") return pressed.has("ControlLeft") || pressed.has("ControlRight");
  if (m === "Shift") return pressed.has("ShiftLeft") || pressed.has("ShiftRight");
  return pressed.has("AltLeft") || pressed.has("AltRight");
}

/**
 * The modifier prefix that `code` resolves to right now: the bound combo with the most modifiers
 * whose modifiers are all held (the key's own modifier does not count for a bare modifier bind).
 */
function resolvedMods(code: string, held: (m: Mod) => boolean): string | null {
  const combos = comboIndex.get(code);
  if (!combos) return null;
  const own = modOfCode(code);
  let best: string | null = null;
  let bestN = -1;
  for (const mods of combos) {
    const ms = mods ? (mods.slice(0, -1).split("+") as Mod[]) : [];
    if (ms.some((m) => m === own || !held(m))) continue;
    if (ms.length > bestN) {
      best = mods;
      bestN = ms.length;
    }
  }
  return best;
}

function heldBind(b: Bind): boolean {
  if (!b) return false;
  const { mods, code } = parseBind(b);
  if (!pressed.has(code)) return false;
  return resolvedMods(code, modHeld) === mods;
}

/** True while a key bound to the action is held. */
export function isHeld(id: string): boolean {
  const p = binds[id];
  return !!p && (heldBind(p[0]) || heldBind(p[1]));
}

/** Actions a fresh press triggers. `ev` gives the modifier state at the time of the press. */
export function actionsForPress(code: string, ev: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): string[] {
  const held = (m: Mod) => (m === "Ctrl" ? ev.ctrlKey : m === "Shift" ? ev.shiftKey : ev.altKey);
  const mods = resolvedMods(code, held);
  if (mods === null) return [];
  const b = mods + code;
  return ACTIONS.filter((a) => {
    const p = binds[a.id];
    return p && (p[0] === b || p[1] === b);
  }).map((a) => a.id);
}

/** Track a raw key / mouse code going down or up. Called by input.ts. */
export function press(code: string) {
  pressed.add(code);
}
export function release(code: string) {
  pressed.delete(code);
}
export function releaseAll() {
  pressed.clear();
}
export function isCodeDown(code: string) {
  return pressed.has(code);
}

/** Is this key (with these modifiers) bound to anything? Used to suppress browser defaults. */
export function isBoundCode(code: string, ev: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return actionsForPress(code, ev).length > 0;
}

// ---- labels ------------------------------------------------------------------------

const MOUSE_LABELS = ["LMB", "MMB", "RMB", "Mouse4", "Mouse5"];
const SPECIAL: Record<string, string> = {
  Space: "Space",
  Tab: "Tab",
  Enter: "Enter",
  Backspace: "Bksp",
  ShiftLeft: "Shift",
  ShiftRight: "RShift",
  ControlLeft: "Ctrl",
  ControlRight: "RCtrl",
  AltLeft: "Alt",
  AltRight: "RAlt",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  CapsLock: "Caps",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Delete: "Del",
  Insert: "Ins",
};

/** Short human label for a binding: "Ctrl+Q", "RMB", "Shift". */
export function bindLabel(b: Bind): string {
  if (!b) return "";
  const { mods, code } = parseBind(b);
  let k: string;
  if (code.startsWith("Mouse")) k = MOUSE_LABELS[Number(code.slice(5))] ?? code;
  else if (SPECIAL[code]) k = SPECIAL[code];
  else if (code.startsWith("Key")) k = code.slice(3);
  else if (code.startsWith("Digit")) k = code.slice(5);
  else if (code.startsWith("Numpad")) k = "Num" + code.slice(6);
  else k = code;
  return mods + k;
}

/** Label of an action's primary (else alternate) binding, for HUD hints and the skill bar. */
export function actionLabel(id: string): string {
  const p = getBinds(id);
  return bindLabel(p[0] ?? p[1]) || "-";
}

/** Skill slot i (0..15) -> its current key label. Client replacement for shared/skills.ts slotLabel. */
export function skillSlotLabel(i: number): string {
  return actionLabel(`skill${i}`);
}
