// Client options store: one typed object with defaults, versioned localStorage persistence and
// change subscriptions. Every system READS from here (getSettings() is cheap: call it per frame);
// the options panel (./options.ts) is the only writer. Keybinds live separately in ./keybinds.ts.

export type FpsCap = 30 | 60 | 120 | 0; // 0 = uncapped (display refresh rate)
export type Quality = "low" | "medium" | "high";
export type DamageNumbers = "all" | "own" | "off";
export type PlayerLabels = "all" | "others" | "off";
export type MonsterBars = "damaged" | "always" | "off";

export type GoreLevel = "off" | "reduced" | "full" | "extreme";

export interface GraphicsSettings {
  /** Resolution multiplier for the world canvas, 0.5..1; 0 = Auto (see renderScaleFor). */
  renderScale: number;
  /** Brightness of the ambient darkness (1 = art default). */
  brightness: number;
  fpsCap: FpsCap;
  lightQuality: Quality;
  /** 0..1 multiplier on particle counts. */
  particles: number;
  screenShake: boolean;
  /** Blood / dismemberment level (read by the gore system). */
  gore: GoreLevel;
  /** Blood decals stay on the ground for the whole match. */
  persistentBlood: boolean;
  showFps: boolean;
  showPing: boolean;
  /** Use the painted 2D sprites from public/art (procedural art where none exists). */
  paintedSprites: boolean;
}

export interface InterfaceSettings {
  /** Multiplies the HUD pixel size and DOM panel zoom. */
  uiScale: number;
  damageNumbers: DamageNumbers;
  playerLabels: PlayerLabels;
  monsterBars: MonsterBars;
  /** Item labels on the ground: false = only while the "show labels" key is held. */
  alwaysShowLabels: boolean;
  hideNormal: boolean;
  hideMagic: boolean;
  /** Minimap size multiplier and opacity 0.2..1. */
  minimapSize: number;
  minimapOpacity: number;
  /** Minimap zoom 0.5..2 (royale HUD: +/- buttons, zoom keys, wheel over the minimap). */
  minimapZoom: number;
  globeNumbers: boolean;
  tooltipCompare: boolean;
  // ---- menus package: loot filter + HUD options (options.ts rows; read by the owning files) ----
  /** Loot filter: lowest gear rarity that gets a label (0 all, 1 magic+, 2 rare+, 3 unique only). Mirrors hideNormal/hideMagic. */
  lootMinRarity: number;
  lootGems: boolean;
  lootFlasks: boolean; // flasks and charms
  lootEmbers: boolean; // currency stacks
  /** Minimap / overlay marker for rare-or-better drops. */
  lootMinimapIcons: boolean;
  showMinimap: boolean;
  overlayOpacity: number; // 0.2..1
  overlayZoom: number; // 0.6..1.6
  chatSize: "small" | "normal" | "large";
  chatOpacity: number; // 0.3..1 (log background / text)
  labelScale: number; // 0.8..1.4 ground label size
  cursorScale: number; // 0.8..1.6
  lowLifeVignette: boolean;
  buffTimers: boolean;
  targetBar: boolean;
}

export interface AudioSettings {
  master: number; // 0..1
  music: number;
  effects: number;
  ui: number;
  muteUnfocused: boolean;
}

export interface GameplaySettings {
  /** Ask the server to pick up flasks / currency that come within range (server validates). */
  autoPickup: boolean;
  colorblind: boolean;
  confirmLeave: boolean;
  /** UI language; "auto" follows the system / browser language. */
  language: "auto" | "en" | "pl";
}

export interface Settings {
  v: number;
  graphics: GraphicsSettings;
  interface: InterfaceSettings;
  audio: AudioSettings;
  game: GameplaySettings;
}

export type Group = Exclude<keyof Settings, "v">;

export const SETTINGS_VERSION = 2;
const STORAGE_KEY = "hns-settings";

export function defaultSettings(): Settings {
  return {
    v: SETTINGS_VERSION,
    graphics: {
      renderScale: 0,
      brightness: 1,
      fpsCap: 0,
      lightQuality: "high",
      particles: 1,
      screenShake: true,
      gore: "extreme",
      persistentBlood: true,
      showFps: false,
      showPing: true,
      paintedSprites: true,
    },
    interface: {
      uiScale: 1,
      damageNumbers: "off", // worldui: PoE2 shows no floating damage numbers by default (Interface option turns them on)
      playerLabels: "all",
      monsterBars: "damaged",
      alwaysShowLabels: true,
      hideNormal: false,
      hideMagic: false,
      minimapSize: 1,
      minimapOpacity: 1,
      minimapZoom: 1,
      globeNumbers: false, // hover shows them; this keeps them always on
      tooltipCompare: true,
      lootMinRarity: 0,
      lootGems: true,
      lootFlasks: true,
      lootEmbers: true,
      lootMinimapIcons: true,
      showMinimap: true,
      overlayOpacity: 0.7,
      overlayZoom: 1,
      chatSize: "normal",
      chatOpacity: 1,
      labelScale: 1,
      cursorScale: 1,
      lowLifeVignette: true,
      buffTimers: true,
      targetBar: true,
    },
    audio: { master: 0.8, music: 0.6, effects: 0.8, ui: 0.7, muteUnfocused: true },
    game: { autoPickup: false, colorblind: false, confirmLeave: true, language: "auto" },
  };
}

// ---- load / save ----------------------------------------------------------------

/** Keep only keys that exist in the defaults and whose value has the same type. */
function merge<T extends object>(def: T, raw: unknown): T {
  const out = { ...def };
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(def) as (keyof T)[]) {
    const v = (raw as Record<string, unknown>)[k as string];
    if (v === undefined || typeof v !== typeof def[k]) continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    out[k] = v as T[keyof T];
  }
  return out;
}

/** Older saved versions -> current shape. Add steps here when the layout changes. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  // v1 -> v2: globe numbers became hover-only by default (drop the old default-on value), and the
  // two loot-filter toggles became a minimum rarity.
  if (typeof raw.v !== "number" || raw.v < 2) {
    const ui = raw.interface as Record<string, unknown> | undefined;
    if (ui && typeof ui === "object") {
      delete ui.globeNumbers;
      if (ui.lootMinRarity === undefined) ui.lootMinRarity = ui.hideMagic === true ? 2 : ui.hideNormal === true ? 1 : 0;
    }
  }
  return raw;
}

function load(): Settings {
  const def = defaultSettings();
  let raw: Record<string, unknown> | null = null;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) raw = JSON.parse(s);
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== "object") return def;
  raw = migrate(raw);
  const out: Settings = {
    v: SETTINGS_VERSION,
    graphics: merge(def.graphics, raw.graphics),
    interface: merge(def.interface, raw.interface),
    audio: merge(def.audio, raw.audio),
    game: merge(def.game, raw.game),
  };
  // Enum-ish fields: fall back to the default if the stored value is not a known option.
  if (out.graphics.renderScale !== 0 && !(out.graphics.renderScale >= 0.5 && out.graphics.renderScale <= 1)) out.graphics.renderScale = def.graphics.renderScale;
  if (![30, 60, 120, 0].includes(out.graphics.fpsCap)) out.graphics.fpsCap = def.graphics.fpsCap;
  if (!["low", "medium", "high"].includes(out.graphics.lightQuality)) out.graphics.lightQuality = def.graphics.lightQuality;
  if (!["all", "own", "off"].includes(out.interface.damageNumbers)) out.interface.damageNumbers = def.interface.damageNumbers;
  if (!["all", "others", "off"].includes(out.interface.playerLabels)) out.interface.playerLabels = def.interface.playerLabels;
  if (!["damaged", "always", "off"].includes(out.interface.monsterBars)) out.interface.monsterBars = def.interface.monsterBars;
  if (!["auto", "en", "pl"].includes(out.game.language)) out.game.language = def.game.language;
  if (![0, 1, 2, 3].includes(out.interface.lootMinRarity)) out.interface.lootMinRarity = def.interface.lootMinRarity;
  out.interface.hideNormal = out.interface.lootMinRarity >= 1;
  out.interface.hideMagic = out.interface.lootMinRarity >= 2;
  if (!["small", "normal", "large"].includes(out.interface.chatSize)) out.interface.chatSize = def.interface.chatSize;
  return out;
}

let current: Settings = load();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      /* storage unavailable (private mode, quota): settings still apply for this session */
    }
  }, 150);
}

// ---- API --------------------------------------------------------------------------

export type ChangeFn = (s: Settings, group: Group, key: string) => void;
const listeners = new Set<ChangeFn>();

/** Current settings. Treat as read-only; change values through setSetting. */
export function getSettings(): Readonly<Settings> {
  return current;
}

export function setSetting<G extends Group, K extends keyof Settings[G]>(group: G, key: K, value: Settings[G][K]) {
  if (current[group][key] === value) return;
  current = { ...current, [group]: { ...current[group], [key]: value } };
  save();
  emit(group, key as string);
}

/** Restore one group (or everything) to defaults. */
export function resetSettings(group?: Group) {
  const def = defaultSettings();
  current = group ? { ...current, [group]: def[group] } : def;
  save();
  for (const g of group ? [group] : (["game", "graphics", "interface", "audio"] as Group[])) emit(g, "*");
}

/** Called on every change (key "*" = whole group reset). Returns an unsubscribe function. */
export function subscribe(fn: ChangeFn): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Subscribe to one setting; also fires on a reset of its group. */
export function onChange<G extends Group, K extends keyof Settings[G]>(group: G, key: K, fn: (value: Settings[G][K]) => void): () => void {
  return subscribe((s, g, k) => {
    if (g === group && (k === key || k === "*")) fn(s[group][key]);
  });
}

function emit(group: Group, key: string) {
  for (const fn of [...listeners]) {
    try {
      fn(current, group, key);
    } catch (e) {
      console.error("settings listener failed", e);
    }
  }
}

// ---- helpers other systems use ------------------------------------------------------

const ambientCache = new Map<string, string>();
/** Scale an ambient-darkness colour by the brightness setting (used by the light pass). */
export function ambientColor(hex: string): string {
  const k = current.graphics.brightness;
  if (k === 1) return hex;
  const key = hex + "|" + k;
  let c = ambientCache.get(key);
  if (!c) {
    const h = hex.replace("#", "");
    const ch = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k)));
    c = `rgb(${ch(0)},${ch(2)},${ch(4)})`;
    ambientCache.set(key, c);
  }
  return c;
}

/**
 * Resolution multiplier to render at (0.5..1). Auto: full resolution up to ~1.5 device pixels per
 * CSS pixel; on denser (4K / retina) screens cap the backing store so fill rate stays sane.
 */
export function renderScaleFor(devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1): number {
  const r = current.graphics.renderScale;
  if (r > 0) return Math.max(0.5, Math.min(1, r));
  return Math.max(0.5, Math.min(1, 1.5 / devicePixelRatio));
}

/** Number of particles to spawn for a requested count, honouring the density setting. */
export function particleCount(n: number): number {
  const k = current.graphics.particles;
  if (k >= 1) return n;
  const f = n * k;
  return Math.floor(f) + (Math.random() < f - Math.floor(f) ? 1 : 0);
}

let lastFrameMs = 0;
/**
 * Frame limiter for a requestAnimationFrame loop: returns false when this frame should be skipped
 * to honour the FPS cap. Uncapped (0) always draws, which means the display's refresh rate.
 */
export function frameAllowed(nowMs: number): boolean {
  const cap = current.graphics.fpsCap;
  if (!cap) {
    lastFrameMs = nowMs;
    return true;
  }
  const interval = 1000 / cap;
  // 1 ms slack so a 60 cap on a 60 Hz display doesn't drop every other frame from jitter.
  if (nowMs - lastFrameMs < interval - 1) return false;
  lastFrameMs = Math.max(lastFrameMs + interval, nowMs - interval);
  return true;
}

/** Light pass quality: how many of the optional lights to place and how big. */
export function lightBudget(): { minor: boolean; radiusK: number } {
  const q = current.graphics.lightQuality;
  return q === "high" ? { minor: true, radiusK: 1 } : q === "medium" ? { minor: true, radiusK: 0.85 } : { minor: false, radiusK: 0.75 };
}
