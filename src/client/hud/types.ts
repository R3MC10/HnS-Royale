// HUD shared types (core package). Packages code against these; keep them stable.
import type { View } from "../render";
import type { ClientMsg } from "../../shared/protocol";
import type { HudState } from "./state";

export interface HudRect { x: number; y: number; w: number; h: number }
export interface HudCircle { cx: number; cy: number; r: number }
export type HudAlign = "left" | "center" | "right";

/** Every HUD anchor, in HUD units (top-left origin of the HUD buffer). See HUD-SPEC.md section 2 for each rect. */
export interface HudLayout {
  w: number; // HUD buffer width (u)
  h: number; // HUD buffer height (u)
  hudScale: number; // device px per u
  dpr: number;
  u: number; // CSS px per u (= hudScale / dpr)
  narrow: boolean; // skill bar stacked above the belt
  centre: { x: number; y: number };
  perf: HudRect;
  buffs: HudRect;
  debuffs: HudRect;
  target: HudRect;
  minimap: HudRect;
  royale: HudRect;
  feed: HudRect;
  scoreboard: HudRect;
  lifeGlobe: HudCircle;
  manaGlobe: HudCircle;
  spirit: HudRect;
  points: HudRect;
  belt: HudRect;
  flaskSlots: HudRect[]; // length MAX_FLASK_SLOTS
  charmSlots: HudRect[]; // length MAX_CHARM_SLOTS
  selfStun: HudRect;
  dodge: HudRect;
  weaponSet: HudRect;
  skillBar: HudRect; // one row of 8 slots (the Ctrl set swaps in place)
  menuButtons: HudRect; // 3 round panel buttons (passives / character / options) left of the mana globe
  skillSlot: number; // slot edge (u); gap is 1u
  xpBar: HudRect;
  chat: HudRect;
  spectate: HudRect;
  bottomBand: number; // u from the screen bottom to the top of the bottom band (for panel max-height)
}

/** CSS px box (position:fixed coordinates) for a HUD rect. */
export interface CssBox { left: number; top: number; width: number; height: number; right: number; bottom: number }

export interface HotOpts {
  tip?: string[]; // tooltip lines shown while hovered (first line is the title)
  onClick?: () => void; // canvas click inside the rect (consumes the click)
}

/** Per-frame drawing context handed to every canvas HUD part. All coordinates in HUD units. */
export interface HudCtx {
  g: CanvasRenderingContext2D; // the HUD canvas at native device resolution, transformed so 1 unit = 1 HUD unit (L.hudScale device px); draw with ./skin
  L: HudLayout;
  v: View;
  s: HudState;
  time: number; // renderer clock, seconds
  dt: number; // frame delta, seconds
  fps: number;
  mouse: { x: number; y: number }; // HUD units
  toHud(wx: number, wy: number): { x: number; y: number }; // world -> HUD units
  text(s: string, x: number, y: number, color?: string, align?: HudAlign, scale?: number): void; // smooth skin text (skin/text skinText, size 7*scale, y = line top); pixel font if setHudTextMode("pixel")
  textW(s: string, scale?: number): number;
  /** Register a hotspot for this frame; returns true when the mouse is over it. */
  hot(r: HudRect, opts: HotOpts): boolean;
  send(m: ClientMsg): void;
}

export type HudPart = (c: HudCtx) => void;

/** Handles main.ts gives the HUD at start-up. */
export interface HudInit {
  send(m: ClientMsg): void;
  ui: { isOpen(): boolean; toggle(force?: boolean): void };
}
