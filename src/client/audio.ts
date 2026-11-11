// Audio settings stub. There is no sound yet; future sound code should route every sound through
// `volumeFor(channel)` (or an AudioContext built on `audioBus()`), so the options panel's sliders and
// "mute when unfocused" already work the day sound lands.
import { getSettings, subscribe } from "./settings";

export type AudioChannel = "music" | "effects" | "ui";

let focused = typeof document === "undefined" ? true : document.hasFocus();

/** Dev mute: the Claude desktop app's built-in browser (agents' test tabs) is always silent,
 *  unless the URL has ?sound=1. Real players' browsers are unaffected. */
const DEV_MUTED =
  typeof navigator !== "undefined" &&
  / Claude\//.test(navigator.userAgent) &&
  !(typeof location !== "undefined" && /[?&]sound=1/.test(location.search));

/** Effective linear gain 0..1 for a channel: master x channel x focus mute. */
export function volumeFor(channel: AudioChannel): number {
  const a = getSettings().audio;
  if (DEV_MUTED || (a.muteUnfocused && !focused)) return 0;
  return clamp01(a.master) * clamp01(a[channel]);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---- optional Web Audio bus ---------------------------------------------------------
// Created lazily (browsers need a user gesture before audio can start).

interface Bus {
  ctx: AudioContext;
  master: GainNode;
  channels: Record<AudioChannel, GainNode>;
}
let bus: Bus | null = null;

/** Lazily build an AudioContext with master + per-channel gain nodes wired to the settings. */
export function audioBus(): Bus | null {
  if (bus) return bus;
  const AC = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const mk = () => {
      const g = ctx.createGain();
      g.connect(master);
      return g;
    };
    bus = { ctx, master, channels: { music: mk(), effects: mk(), ui: mk() } };
    applyGains();
  } catch {
    bus = null;
  }
  return bus;
}

function applyGains() {
  if (!bus) return;
  const a = getSettings().audio;
  const t = bus.ctx.currentTime;
  bus.master.gain.setTargetAtTime(DEV_MUTED || (a.muteUnfocused && !focused) ? 0 : clamp01(a.master), t, 0.05);
  for (const ch of ["music", "effects", "ui"] as AudioChannel[]) bus.channels[ch].gain.setTargetAtTime(clamp01(a[ch]), t, 0.05);
}

subscribe((_s, group) => {
  if (group === "audio") applyGains();
});
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    focused = true;
    applyGains();
  });
  window.addEventListener("blur", () => {
    focused = false;
    applyGains();
  });
  // Hidden tabs (background tab, minimised window, hidden pane) count as unfocused too.
  document.addEventListener("visibilitychange", () => {
    focused = !document.hidden && document.hasFocus();
    applyGains();
  });
}

// ---- UI sound hook -------------------------------------------------------------------------
// The menus call uiSound("ui.click") etc. The sound module (./audio/index.ts) plugs its player in
// with registerUiSound((id) => sfx.play(id)); until then the calls are silent no-ops.

export type UiSoundId = "ui.click" | "ui.hover" | "ui.open" | "ui.close" | "ui.confirm";
let uiPlayer: ((id: UiSoundId) => void) | null = null;
export function registerUiSound(fn: (id: UiSoundId) => void) {
  uiPlayer = fn;
}
export function uiSound(id: UiSoundId) {
  try {
    uiPlayer?.(id);
  } catch {
    /* never let a sound break the menu */
  }
}
