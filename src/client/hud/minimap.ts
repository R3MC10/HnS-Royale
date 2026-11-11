// Corner minimap, Tab overlay map and the personal waypoint (royale package, HUD-SPEC P / STYLE v2).
// Systems: auto-centred corner map with zoom (+/- buttons, zoom keys, wheel over the map), a facing
// arrow for the player, fog of war that clears as you explore, the area name under the frame; the Tab
// overlay is a translucent map over the play field (input passes through) with Ctrl+wheel zoom and
// the area / alive / clock block at the top right; one local waypoint (right- or middle-click on the
// world map, Alt+right/middle-click on the overlay) with an edge-of-screen arrow. The waypoint is
// never networked (free-for-all: no information leaks). All labels and glyphs are original.
// render.ts keeps the cached overview canvas; it calls drawHudMinimap / drawHudOverlay /
// drawBigMapExtras from its HUD pass (this.g = the HUD canvas, HUD units).
import type { View } from "../render";
import type { HudCtx, HudRect } from "./types";
import { getHudLayout } from "./layout";
import { hudState } from "./state";
import { getSettings, setSetting } from "../settings";
import { actionLabel, actionsForPress } from "../keybinds";
import { areaAt, currentMap, getCampSpots, getPois, ZONE, zoneAt, type Area } from "../../shared/map";
import { laneTravel, laneWaypoints } from "../lanehud";
import { isoX, isoY, K, unproject } from "../gfx/iso";
import { itemCategory } from "../../shared/grid";
import { RARITY_COLORS } from "../../shared/content/loot";
import { SKIN, bevel, drawNine, drawSkinPanel, hudArt, rgba, skinText } from "./skin";
import { isRightDockOpen } from "./dock";

/** render.ts hands this over: the cached 1 px-per-cell overview and the view footprint (world). */
export interface MapApi {
  overview(): HTMLCanvasElement;
  footprint(): { x: number; y: number }[];
}

type Pt = { x: number; y: number };
type ToFn = (x: number, y: number) => Pt;

const BASE_SPAN = 3600; // world px across the minimap at zoom 1
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const OVR_MIN = 0.6;
const OVR_MAX = 1.6;
const REVEAL_R = 760; // world px cleared around the player
const WAYPOINT_REACH = 90;
const TAU = Math.PI * 2;

const nowMs = () => performance.now();
const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));

// ---- state -----------------------------------------------------------------------------------------

let waypoint: Pt | null = null;
let zoomHover: -1 | 0 | 1 = 0; // which minimap zoom button the mouse is over (from the last HUD pass)
let lastOverlay: { t: number; ox: number; oy: number; cx: number; cy: number; k: number } | null = null;
let lastBig: { t: number; ox: number; oy: number; wx: number; wy: number; k: number; box: HudRect } | null = null;
let lastMini: { t: number; r: HudRect; ox: number; oy: number; cx: number; cy: number; k: number } | null = null;
let lastPhase = "";

export function getWaypoint(): Pt | null {
  return waypoint;
}
export function clearWaypoint(): void {
  waypoint = null;
}

function minimapZoom(): number {
  return clamp(0.5, 2, getSettings().interface.minimapZoom || 1);
}

/** +1 zoom in / -1 zoom out on the corner map (or the Tab overlay while it is open). */
export function mapZoomStep(dir: 1 | -1): void {
  if (overlayOpen()) {
    const z = clamp(OVR_MIN, OVR_MAX, getSettings().interface.overlayZoom || 1);
    setSetting("interface", "overlayZoom", Math.round(clamp(OVR_MIN, OVR_MAX, z + dir * 0.1) * 100) / 100);
    return;
  }
  const z = minimapZoom();
  let i = 0;
  ZOOM_STEPS.forEach((s, n) => {
    if (Math.abs(s - z) < Math.abs(ZOOM_STEPS[i] - z)) i = n;
  });
  setSetting("interface", "minimapZoom", ZOOM_STEPS[clamp(0, ZOOM_STEPS.length - 1, i + dir)]);
}

function overlayOpen(): boolean {
  return !!lastOverlay && nowMs() - lastOverlay.t < 150;
}
/** polish: the Tab map overlay is showing (its info block replaces the royale cluster). */
export const isMapOverlayOpen = overlayOpen;
function bigOpen(): boolean {
  return !!lastBig && nowMs() - lastBig.t < 150;
}
/** The world map (M) is showing: the first-spawn controls strip steps aside (hud/dock.ts). */
export const isBigMapOpen = bigOpen;

// ---- fog of war --------------------------------------------------------------------------------------

let fog: { map: unknown; cv: HTMLCanvasElement; cx: CanvasRenderingContext2D; lx: number; ly: number } | null = null;

function fogCanvas(): typeof fog {
  const m = currentMap();
  if (fog && fog.map === m) return fog;
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, m.cols);
  cv.height = Math.max(1, m.rows);
  const cx = cv.getContext("2d");
  if (!cx) return null;
  cx.fillStyle = "#060508";
  cx.fillRect(0, 0, cv.width, cv.height);
  fog = { map: m, cv, cx, lx: NaN, ly: NaN };
  return fog;
}

function resetFog(): void {
  fog = null;
  cleared.clear();
}

// ---- what this client has seen ----------------------------------------------------------------------

/** Camps this client saw emptied (camp snapshots only cover the neighbourhood, so the map remembers). */
const cleared = new Set<string>();
const campKey = (x: number, y: number) => Math.round(x) + "," + Math.round(y);

const KIND_LABEL: Record<string, string> = {
  glade: "Quiet Glade",
  thicket: "Deep Thicket",
  graveyard: "Old Graveyard",
  ruins: "Nameless Ruins",
  lumber: "Logging Camp",
  lair: "Beast Lair",
  heart: "The Hollow Heart",
};

/** Name of the place at a world point: the landmark, the kind of clearing, or the road between them. */
function placeName(x: number, y: number): string {
  if (currentMap().params.mode === "lanes") return "Breachway";
  const a = areaAt(x, y);
  const z = zoneAt(x, y);
  if (a && z === ZONE[a.kind]) return a.name || KIND_LABEL[a.kind] || "";
  if (z === ZONE.road) return "Old Road";
  if (z === ZONE.trail) return "Forest Trail";
  return a ? a.name || KIND_LABEL[a.kind] || "" : currentMap().biome.name;
}

function reveal(x: number, y: number): void {
  const f = fogCanvas();
  if (!f) return;
  if (Math.hypot(x - f.lx, y - f.ly) < 48) return;
  f.lx = x;
  f.ly = y;
  const cell = currentMap().cell;
  const px = x / cell;
  const py = y / cell;
  const r = REVEAL_R / cell;
  const gr = f.cx.createRadialGradient(px, py, r * 0.55, px, py, r);
  gr.addColorStop(0, "rgba(0,0,0,1)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  f.cx.save();
  f.cx.globalCompositeOperation = "destination-out";
  f.cx.fillStyle = gr;
  f.cx.beginPath();
  f.cx.arc(px, py, r, 0, TAU);
  f.cx.fill();
  f.cx.restore();
}

/** Per frame (from the minimap / overlay draw): new round resets the fog, the player clears it. */
function tickWorld(v: View): void {
  if (v.phase !== lastPhase) {
    if (v.phase === "countdown" || (lastPhase === "ended" && v.phase !== "ended")) {
      resetFog();
      waypoint = null;
    }
    lastPhase = v.phase;
  }
  for (const c of v.camps) {
    const k = campKey(c.x, c.y);
    if (c.n === 0) cleared.add(k);
    else cleared.delete(k); // practice arena: camps come back
  }
  const self = v.self;
  if (self?.alive) {
    reveal(self.x, self.y);
    if (waypoint && Math.hypot(self.x - waypoint.x, self.y - waypoint.y) < WAYPOINT_REACH) waypoint = null;
  }
}

// ---- projection helpers ----------------------------------------------------------------------------

/** Draw a north-up map canvas (any whole number of px per cell) with the camera projection so world (wx, wy) lands at (ox, oy). */
function drawIsoCanvas(g: CanvasRenderingContext2D, img: HTMLCanvasElement, ox: number, oy: number, wx: number, wy: number, k: number): void {
  const m = currentMap();
  const cell = (m.cell * m.cols) / Math.max(1, img.width); // world px per canvas px
  const a = isoX(1, 0) * k;
  const b = isoY(1, 0) * k;
  const c = isoX(0, 1) * k;
  const d = isoY(0, 1) * k;
  g.save();
  g.transform(a * cell, b * cell, c * cell, d * cell, ox - (a * wx + c * wy), oy - (b * wx + d * wy));
  g.imageSmoothingEnabled = true;
  g.drawImage(img, 0, 0);
  g.restore();
}

function toFn(ox: number, oy: number, cx: number, cy: number, k: number): ToFn {
  return (x, y) => ({ x: ox + isoX(x - cx, y - cy) * k, y: oy + isoY(x - cx, y - cy) * k });
}

function fromScreen(hx: number, hy: number, ox: number, oy: number, cx: number, cy: number, k: number): Pt {
  const w = unproject((hx - ox) / k, (hy - oy) / k);
  return { x: cx + w.x, y: cy + w.y };
}

/** Screen angle of a world facing angle (iso projection). */
function screenDir(a: number): number {
  return Math.atan2(isoY(Math.cos(a), Math.sin(a)), isoX(Math.cos(a), Math.sin(a)));
}

function selfOf(v: View) {
  return v.self ?? (v.selfId >= 0 ? v.players.get(v.selfId) : undefined);
}

function facing(p: object): number {
  const q = p as { angle?: number; a?: number };
  return typeof q.angle === "number" ? q.angle : q.a ?? 0;
}

// ---- glyphs (vector, HUD units) ----------------------------------------------------------------------

function outlinePath(g: CanvasRenderingContext2D, fill: string, lw: number) {
  g.lineJoin = "round";
  g.lineWidth = lw;
  g.strokeStyle = "rgba(4,3,3,0.92)";
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

function glyphDiamond(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y);
  g.lineTo(x, y + r);
  g.lineTo(x - r, y);
  g.closePath();
  outlinePath(g, fill, r * 0.5);
}

function glyphStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  outlinePath(g, fill, r * 0.4);
}

/** Boss: a horned disc. */
function glyphBoss(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.moveTo(x - r * 0.95, y - r * 1.25);
  g.lineTo(x - r * 0.35, y - r * 0.55);
  g.lineTo(x + r * 0.35, y - r * 0.55);
  g.lineTo(x + r * 0.95, y - r * 1.25);
  g.lineTo(x + r * 0.9, y - r * 0.2);
  g.arc(x, y + r * 0.1, r * 0.9, -0.2, Math.PI + 0.2);
  g.closePath();
  outlinePath(g, fill, r * 0.45);
  g.fillStyle = "rgba(10,6,6,0.85)";
  g.beginPath();
  g.arc(x - r * 0.35, y + r * 0.05, r * 0.2, 0, TAU);
  g.arc(x + r * 0.35, y + r * 0.05, r * 0.2, 0, TAU);
  g.fill();
}

/** Camp: a small tent. */
function glyphCamp(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y + r * 0.75);
  g.lineTo(x - r, y + r * 0.75);
  g.closePath();
  outlinePath(g, fill, r * 0.45);
}

function glyphDot(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  outlinePath(g, fill, r * 0.6);
}

/** Facing arrow (player), pointing along screen angle `ang`. */
function glyphArrow(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, fill: string) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(r * 1.35, 0);
  g.lineTo(-r * 0.85, r * 0.9);
  g.lineTo(-r * 0.35, 0);
  g.lineTo(-r * 0.85, -r * 0.9);
  g.closePath();
  g.lineJoin = "round";
  g.lineWidth = r * 0.55;
  g.strokeStyle = "rgba(4,3,3,0.95)";
  g.stroke();
  g.fillStyle = "#f4ecdc";
  g.fill();
  g.beginPath();
  g.moveTo(r * 0.75, 0);
  g.lineTo(-r * 0.45, r * 0.45);
  g.lineTo(-r * 0.15, 0);
  g.lineTo(-r * 0.45, -r * 0.45);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.restore();
}

/** Waypoint: a gold pin with a slow pulse ring. */
function glyphWaypoint(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const t = nowMs() / 1000;
  const p = (t * 0.8) % 1;
  g.save();
  g.globalAlpha *= 1 - p;
  g.lineWidth = r * 0.25;
  g.strokeStyle = SKIN.gold;
  g.beginPath();
  g.arc(x, y, r * (0.8 + p * 1.6), 0, TAU);
  g.stroke();
  g.restore();
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x - r * 0.7, y - r * 1.3);
  g.arc(x, y - r * 1.55, r * 0.75, Math.PI * 0.85, Math.PI * 0.15);
  g.closePath();
  outlinePath(g, SKIN.gold, r * 0.4);
  g.fillStyle = "#2a1c08";
  g.beginPath();
  g.arc(x, y - r * 1.55, r * 0.28, 0, TAU);
  g.fill();
}

/** Graveyard: a grave cross. */
function glyphCross(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  const w = r * 0.42;
  g.beginPath();
  g.rect(x - w / 2, y - r, w, r * 2);
  g.rect(x - r * 0.7, y - r * 0.5, r * 1.4, w);
  outlinePath(g, fill, r * 0.45);
}

/** Ruins: a broken arch. */
function glyphArch(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.moveTo(x - r, y + r);
  g.lineTo(x - r, y - r * 0.2);
  g.arc(x, y - r * 0.2, r, Math.PI, 0);
  g.lineTo(x + r, y + r * 0.3);
  g.lineTo(x + r * 0.45, y + r * 0.3);
  g.lineTo(x + r * 0.45, y - r * 0.2);
  g.arc(x, y - r * 0.2, r * 0.45, 0, Math.PI, true);
  g.lineTo(x - r * 0.45, y + r);
  g.closePath();
  outlinePath(g, fill, r * 0.4);
}

/** Logging camp: a cut stump. */
function glyphStump(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.moveTo(x - r * 0.7, y - r * 0.6);
  g.lineTo(x + r * 0.7, y - r * 0.6);
  g.lineTo(x + r, y + r * 0.8);
  g.lineTo(x - r, y + r * 0.8);
  g.closePath();
  outlinePath(g, fill, r * 0.45);
  g.fillStyle = "rgba(40,24,10,0.8)";
  g.fillRect(x - r * 0.45, y - r * 0.35, r * 0.9, r * 0.22);
}

/** Lair: a fang. */
function glyphFang(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  g.beginPath();
  g.moveTo(x - r * 0.85, y - r * 0.8);
  g.lineTo(x + r * 0.85, y - r * 0.8);
  g.lineTo(x, y + r * 1.1);
  g.closePath();
  outlinePath(g, fill, r * 0.45);
}

const LANDMARK_COLOR: Record<string, string> = { graveyard: "#c9d4de", ruins: "#cfc4ea", lumber: "#dba463", lair: "#e3795c" };
function glyphLandmark(g: CanvasRenderingContext2D, kind: string, x: number, y: number, r: number) {
  const col = LANDMARK_COLOR[kind];
  if (kind === "graveyard") glyphCross(g, x, y, r, col);
  else if (kind === "ruins") glyphArch(g, x, y, r, col);
  else if (kind === "lumber") glyphStump(g, x, y, r, col);
  else if (kind === "lair") glyphFang(g, x, y, r, col);
}

/** Camp that this client saw cleared: an empty tent outline. */
function glyphCampCleared(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.lineTo(x + r, y + r * 0.75);
  g.lineTo(x - r, y + r * 0.75);
  g.closePath();
  g.lineJoin = "round";
  g.lineWidth = r * 0.34;
  g.strokeStyle = "rgba(150,146,134,0.75)";
  g.stroke();
}

interface MarkerOpts {
  /** Corner minimap: endgame survivors off the edge are pinned to this rect. */
  pin?: HudRect;
  /** Landmark names next to their icons (world map, overlay). */
  names?: number;
  /** The caller draws the player arrow itself. */
  noSelf?: boolean;
}

/** Landmarks, POIs, loot, camps, players, self arrow and the waypoint on a map view. s = glyph scale (u). */
function drawMarkers(g: CanvasRenderingContext2D, v: View, to: ToFn, s: number, o: MarkerOpts = {}): void {
  const pin = o.pin;
  // Named places: an icon per kind (the boss glyph below marks the heart).
  const written: { x: number; y: number; hw: number }[] = [];
  for (const a of currentMap().areas as Area[]) {
    if (!a.name) continue;
    const q = to(a.x, a.y);
    if (a.kind !== "heart") glyphLandmark(g, a.kind, q.x, q.y - 3.4 * s, 1.5 * s);
    if (!o.names) continue;
    // A name that would run into one already written is left out (its icon still shows).
    const ly = q.y - (a.kind === "heart" ? 6.5 : 5.6) * s - o.names;
    const hw = a.name.length * o.names * 0.33 + 1;
    if (written.some((w) => Math.abs(w.x - q.x) < w.hw + hw && Math.abs(w.y - ly) < o.names! * 1.2)) continue;
    written.push({ x: q.x, y: ly, hw });
    skinText(g, a.name, q.x, ly, { size: o.names, face: "display", align: "center", color: SKIN.ink });
  }
  // Every camp of the map (where they are is map knowledge; whether one is alive is only what this
  // client has seen: live status from the nearby-camp snapshots, cleared ones remembered).
  const live = new Map<string, { n: number; e: boolean }>();
  for (const c of v.camps) live.set(campKey(c.x, c.y), c);
  for (const c of getCampSpots()) {
    if (c.tier === 2) continue;
    const key = campKey(c.x, c.y);
    const now = live.get(key);
    const q = to(c.x, c.y);
    if (now ? now.n === 0 : cleared.has(key)) {
      glyphCampCleared(g, q.x, q.y, 1.05 * s);
      continue;
    }
    const elite = now ? now.e : c.tier === 1;
    const a = g.globalAlpha;
    if (!now) g.globalAlpha = a * 0.6; // not in sight: where the map says a camp stands
    glyphCamp(g, q.x, q.y, (elite ? 1.5 : 1.1) * s, elite ? "#ffb347" : "#c8402e");
    g.globalAlpha = a;
  }
  for (const p of getPois()) {
    const q = to(p.x, p.y);
    if (p.kind === "trial") glyphDiamond(g, q.x, q.y, 1.7 * s, "#7fc8ff");
    else if (p.kind === "boss") glyphBoss(g, q.x, q.y, 1.6 * s, "#e8503a");
    else if (p.kind === "buff") glyphStar(g, q.x, q.y, 2 * s, "#b48cff");
  }
  if (getSettings().interface.lootMinimapIcons !== false) {
    for (const gi of v.ground) {
      if (!gi.item || gi.item.r < 2 || itemCategory(gi.item) !== "gear") continue;
      const q = to(gi.x, gi.y);
      glyphDiamond(g, q.x, q.y, 1.1 * s, RARITY_COLORS[gi.item.r] ?? "#ffd76a");
    }
  }
  let me: { x: number; y: number; color: string } | null = null;
  for (const p of v.players.values()) {
    if (!p.alive) continue;
    if (p.id === v.selfId) {
      me = p;
      continue;
    }
    const q = to(p.x, p.y);
    glyphDot(g, q.x, q.y, 1.1 * s, p.color);
  }
  // Endgame reveal: survivors outside view range, pulsing so they read as "hunt this".
  if (v.last) {
    const pulse = 1.3 + 0.35 * Math.sin(performance.now() / 220);
    for (const [id, x, y] of v.last) {
      if (id === v.selfId || v.players.has(id)) continue;
      const q = to(x, y);
      if (pin) {
        // Corner minimap: a survivor off the edge is pinned to the border, so the direction is always visible.
        q.x = clamp(pin.x + 2, pin.x + pin.w - 2, q.x);
        q.y = clamp(pin.y + 2, pin.y + pin.h - 2, q.y);
      }
      glyphDot(g, q.x, q.y, pulse * s, v.board.find((b) => b.id === id)?.color ?? "#e8503a");
    }
  }
  if (waypoint) {
    const q = to(waypoint.x, waypoint.y);
    glyphWaypoint(g, q.x, q.y, 1.4 * s);
  }
  // Breachway waypoints: your team's (bright while standing, a hollow ring once fallen), the enemy's dim.
  for (const w of laneWaypoints()) {
    const q = to(w.x, w.y);
    if (!w.mine) {
      if (w.up) glyphDiamond(g, q.x, q.y, 0.9 * s, w.color + "88");
      continue;
    }
    if (w.up) {
      g.beginPath();
      g.arc(q.x, q.y, 2.3 * s, 0, TAU);
      g.fillStyle = "rgba(10,14,24,0.85)";
      g.fill();
      g.lineWidth = 0.6 * s;
      g.strokeStyle = w.color;
      g.stroke();
      glyphDiamond(g, q.x, q.y, 1.25 * s, "#cfe6ff");
    } else {
      g.beginPath();
      g.arc(q.x, q.y, 1.8 * s, 0, TAU);
      g.lineWidth = 0.4 * s;
      g.strokeStyle = "rgba(150,140,130,0.6)";
      g.stroke();
    }
  }
  if (me && !o.noSelf) {
    const q = to(me.x, me.y);
    glyphArrow(g, q.x, q.y, 1.9 * s, screenDir(facing(me)), me.color);
  }
}

// ---- corner minimap ----------------------------------------------------------------------------------

function zoomButtons(r: HudRect): { minus: HudRect; plus: HudRect } {
  const s = 7;
  const y = r.y + r.h - s - 1;
  return { plus: { x: r.x + r.w - s - 1, y, w: s, h: s }, minus: { x: r.x + r.w - 2 * s - 2, y, w: s, h: s } };
}

function drawRoundButton(g: CanvasRenderingContext2D, b: HudRect, label: "+" | "-", hover: boolean) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const r = b.w / 2;
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  gr.addColorStop(0, hover ? "#5a4a34" : "#3a342c");
  gr.addColorStop(1, "#0e0c0a");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fill();
  g.lineWidth = 0.6;
  g.strokeStyle = hover ? "rgba(240,180,110,0.9)" : rgba(SKIN.bronze, 0.9);
  g.stroke();
  g.strokeStyle = hover ? "#fff0d0" : SKIN.ink;
  g.lineWidth = 0.75;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx - r * 0.45, cy);
  g.lineTo(cx + r * 0.45, cy);
  if (label === "+") {
    g.moveTo(cx, cy - r * 0.45);
    g.lineTo(cx, cy + r * 0.45);
  }
  g.stroke();
  g.lineCap = "butt";
}

/** Carved-stone frame around the minimap rect (painted hud_minimap_frame when present). */
function drawMapFrame(g: CanvasRenderingContext2D, r: HudRect) {
  const art = hudArt("hud_minimap_frame");
  const o: HudRect = { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 };
  if (art) {
    drawNine(g, art, o);
    return;
  }
  drawSkinPanel(g, o, { variant: "stone" });
}

function drawMapFrameInner(g: CanvasRenderingContext2D, r: HudRect) {
  if (hudArt("hud_minimap_frame")) return;
  // inner shadow so the map reads as recessed into the stone
  const w = 2.4;
  const sides: [number, number, number, number, number, number, number, number][] = [
    [r.x, r.y, r.x, r.y + w, r.x, r.y, r.w, w],
    [r.x, r.y + r.h, r.x, r.y + r.h - w, r.x, r.y + r.h - w, r.w, w],
    [r.x, r.y, r.x + w, r.y, r.x, r.y, w, r.h],
    [r.x + r.w, r.y, r.x + r.w - w, r.y, r.x + r.w - w, r.y, w, r.h],
  ];
  for (const [x0, y0, x1, y1, fx, fy, fw, fh] of sides) {
    const lg = g.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, "rgba(0,0,0,0.75)");
    lg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = lg;
    g.fillRect(fx, fy, fw, fh);
  }
  bevel(g, r.x - 0.3, r.y - 0.3, r.w + 0.6, r.h + 0.6, 0, 0.5, "rgba(0,0,0,0.95)", "rgba(170,150,120,0.35)");
}

/** render.ts drawMinimap: the corner map at the HUD layout's minimap rect. Returns its bottom edge (u). */
export function drawHudMinimap(g: CanvasRenderingContext2D, v: View, api: MapApi): number {
  tickWorld(v);
  const L = getHudLayout();
  const r = L.minimap;
  if (isRightDockOpen()) return r.y + r.h + 10; // the docked inventory covers the map corner
  const ui = getSettings().interface;
  const m = currentMap();
  const self = selfOf(v);
  const cx = self ? self.x : v.camX;
  const cy = self ? self.y : v.camY;
  const k = r.w / ((BASE_SPAN / minimapZoom()) * K);
  const ox = r.x + r.w / 2;
  const oy = r.y + r.h / 2;
  const to = toFn(ox, oy, cx, cy, k);
  lastMini = { t: nowMs(), r, ox, oy, cx, cy, k };

  g.save();
  g.globalAlpha = clamp(0.2, 1, ui.minimapOpacity ?? 1);
  drawMapFrame(g, r);
  g.save();
  g.beginPath();
  g.rect(r.x, r.y, r.w, r.h);
  g.clip();
  g.fillStyle = m.biome.palette.mapWall;
  g.fillRect(r.x, r.y, r.w, r.h);
  drawIsoCanvas(g, api.overview(), ox, oy, cx, cy, k);
  const f = fogCanvas();
  if (f) {
    const a = g.globalAlpha;
    g.globalAlpha = a * 0.62; // unexplored ground is dimmed, not hidden: the layout still reads
    drawIsoCanvas(g, f.cv, ox, oy, cx, cy, k);
    g.globalAlpha = a;
  }
  // view footprint
  const fp = api.footprint().map((p) => to(p.x, p.y));
  if (fp.length === 4) {
    g.beginPath();
    fp.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.lineWidth = 0.4;
    g.strokeStyle = "rgba(240,230,210,0.28)";
    g.stroke();
  }
  drawMarkers(g, v, to, 1, { pin: r });
  drawMapFrameInner(g, r);
  g.restore();
  // zoom buttons (hotspots are registered by minimapHots in the HUD pass)
  const zb = zoomButtons(r);
  drawRoundButton(g, zb.minus, "-", zoomHover === -1);
  drawRoundButton(g, zb.plus, "+", zoomHover === 1);
  // zoom readout while not 1x
  const z = minimapZoom();
  if (Math.abs(z - 1) > 1e-3) skinText(g, `${z}x`, r.x + 2, r.y + r.h - 6.5, { size: 5, color: SKIN.inkDim });
  // area name under the frame (small caps)
  skinText(g, placeName(cx, cy).toUpperCase(), r.x + r.w, r.y + r.h + 4, { size: 5.5, face: "display", align: "right", color: SKIN.inkDim, maxW: r.w + 34, spacing: 0.12 }); // right-aligned with the info lines: a centred long name ran off the screen edge
  g.restore();
  return r.y + r.h + 10;
}

/** HUD pass (royale part): hotspots for the corner map zoom buttons + the map itself. */
export function minimapHots(c: HudCtx): void {
  zoomHover = 0;
  if (!lastMini || nowMs() - lastMini.t > 250) return; // minimap hidden (overlay open / option off)
  const r = c.L.minimap;
  const zb = zoomButtons(r);
  const zin = actionLabel("minimapZoomIn");
  const zout = actionLabel("minimapZoomOut");
  if (c.hot(zb.minus, { tip: ["Zoom out", `Key: ${zout}`, "Wheel over the map also zooms"], onClick: () => mapZoomStep(-1) })) zoomHover = -1;
  if (c.hot(zb.plus, { tip: ["Zoom in", `Key: ${zin}`, "Wheel over the map also zooms"], onClick: () => mapZoomStep(1) })) zoomHover = 1;
}

// ---- Tab overlay -------------------------------------------------------------------------------------

/** render.ts drawMapOverlay: the translucent map over the play field (input passes through). */
export function drawHudOverlay(g: CanvasRenderingContext2D, v: View, api: MapApi): void {
  tickWorld(v);
  const L = getHudLayout();
  const lw = L.w;
  const lh = L.h;
  const self = selfOf(v);
  const cx = self ? self.x : v.camX;
  const cy = self ? self.y : v.camY;
  const ui = getSettings().interface;
  const k = (lw / (9000 * K)) * clamp(OVR_MIN, OVR_MAX, ui.overlayZoom ?? 1);
  const ox = lw / 2;
  const oy = lh / 2;
  const oa = clamp(0.2, 1, ui.overlayOpacity ?? 0.7);
  lastOverlay = { t: nowMs(), ox, oy, cx, cy, k };
  g.save();
  g.globalAlpha = 0.6 * oa;
  drawIsoCanvas(g, api.overview(), ox, oy, cx, cy, k);
  const f = fogCanvas();
  if (f) {
    g.globalAlpha = 0.5 * oa;
    drawIsoCanvas(g, f.cv, ox, oy, cx, cy, k);
  }
  g.globalAlpha = Math.min(1, 1.28 * oa);
  drawMarkers(g, v, toFn(ox, oy, cx, cy, k), 1.3, { names: 5 });
  g.restore();

  // info block, top right (where the corner map sits when the overlay is closed)
  const x = lw - 8;
  let y = 8;
  g.save();
  skinText(g, placeName(cx, cy), x, y, { size: 9, face: "display", align: "right", color: SKIN.ink });
  y += 11;
  const line = v.phase === "waiting" ? "Practice arena" : `${v.alive} of ${v.total} alive`;
  skinText(g, line, x, y, { size: 6.5, align: "right", color: v.phase !== "waiting" && v.alive <= 3 ? SKIN.blood : SKIN.inkDim });
  y += 8;
  const clock = hudState.matchSecs >= 0 ? mmss(hudState.matchSecs) : ""; // match clock (server time), as in hud/royale.ts
  // polish: kills here too, since the royale cluster hides while the overlay is open
  const kills = `Player kills ${hudState.me?.k ?? 0}`;
  skinText(g, clock ? `${kills}   ${clock}` : kills, x, y, { size: 6.5, align: "right", color: SKIN.inkDim });
  y += 8;
  skinText(g, "Ctrl+wheel: zoom   Alt+right-click: waypoint", x, y + 2, { size: 5, align: "right", color: SKIN.inkFaint });
  g.restore();
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

// ---- world map (M) extras ----------------------------------------------------------------------------

/** render.ts drawBigMap, after its markers: fog, waypoint, self arrow and the waypoint hint; records the transform for clicks. */
export function drawBigMapExtras(g: CanvasRenderingContext2D, v: View, ox: number, oy: number, wx: number, wy: number, k: number, box: HudRect): void {
  lastBig = { t: nowMs(), ox, oy, wx, wy, k, box };
  tickWorld(v);
  const to = toFn(ox, oy, wx, wy, k);
  g.save();
  drawMarkers(g, v, to, 1.35, { names: 4.3, noSelf: true });
  drawLegend(g, box);
  if (waypoint) {
    const q = to(waypoint.x, waypoint.y);
    glyphWaypoint(g, q.x, q.y, 2.2);
  }
  // Endgame reveal (three or fewer left): the world map shows every survivor out of view too, as a
  // pulsing dot with an expanding ring (the corner minimap and Tab overlay already do, drawMarkers).
  if (v.last) {
    const now = performance.now();
    const ph = (now / 900) % 1;
    for (const [id, x, y] of v.last) {
      if (id === v.selfId || v.players.has(id)) continue;
      const q = to(x, y);
      const col = v.board.find((b) => b.id === id)?.color ?? "#e8503a";
      g.save();
      g.globalAlpha = 1 - ph;
      g.strokeStyle = col;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(q.x, q.y, 3 + ph * 10, 0, TAU);
      g.stroke();
      g.restore();
      glyphDot(g, q.x, q.y, 2.8 + 0.5 * Math.sin(now / 220), col);
    }
  }
  const self = v.self;
  if (self?.alive) {
    const q = to(self.x, self.y);
    glyphArrow(g, q.x, q.y, 2.6, screenDir(facing(self)), self.color);
  }
  skinText(g, waypoint ? "Right-click: move waypoint   (click it again to clear)" : "Right-click: set a waypoint", box.x + box.w - 6, box.y + box.h - 9, {
    size: 5.5,
    align: "right",
    color: SKIN.inkDim,
  });
  g.restore();
}

/** World map legend, bottom left: what each glyph means. */
function drawLegend(g: CanvasRenderingContext2D, box: HudRect): void {
  const rows: [string, (x: number, y: number) => void][] = [
    ["You", (x, y) => glyphArrow(g, x, y, 1.9, -Math.PI / 2, "#7fd0ff")],
    ["Camp", (x, y) => glyphCamp(g, x, y, 1.4, "#c8402e")],
    ["Elite camp", (x, y) => glyphCamp(g, x, y, 1.8, "#ffb347")],
    ["Cleared", (x, y) => glyphCampCleared(g, x, y, 1.4)],
    ["Boss", (x, y) => glyphBoss(g, x, y, 1.7, "#e8503a")],
    ["Trial shrine", (x, y) => glyphDiamond(g, x, y, 1.8, "#7fc8ff")],
    ["Buff shrine", (x, y) => glyphStar(g, x, y, 2.1, "#b48cff")],
    ["Graveyard", (x, y) => glyphLandmark(g, "graveyard", x, y, 1.7)],
    ["Ruins", (x, y) => glyphLandmark(g, "ruins", x, y, 1.7)],
    ["Logging camp", (x, y) => glyphLandmark(g, "lumber", x, y, 1.7)],
    ["Lair", (x, y) => glyphLandmark(g, "lair", x, y, 1.7)],
  ];
  const x = box.x + 8;
  let y = box.y + box.h - 8 - rows.length * 7.5;
  g.save();
  g.fillStyle = "rgba(6,5,6,0.6)";
  g.fillRect(x - 4, y - 5, 58, rows.length * 7.5 + 7);
  for (const [label, draw] of rows) {
    draw(x + 2, y + 1.5);
    skinText(g, label, x + 8, y - 1.2, { size: 5, color: SKIN.inkDim });
    y += 7.5;
  }
  // road key
  g.restore();
}

// ---- waypoint in the world view ---------------------------------------------------------------------

/** HUD pass (royale part): beacon at the waypoint, or an edge arrow + distance when it is off-screen. */
export function drawWaypointHud(c: HudCtx): void {
  const wp = waypoint;
  const self = c.v.self;
  if (!wp || !self?.alive) return;
  const { g, L } = c;
  const p = c.toHud(wp.x, wp.y);
  const dist = Math.hypot(wp.x - self.x, wp.y - self.y);
  const label = `${Math.max(1, Math.round(dist / 40))} m`;
  const m = 16;
  const inside = p.x >= m && p.x <= L.w - m && p.y >= m + 10 && p.y <= L.h - 60;
  g.save();
  if (inside) {
    glyphWaypoint(g, p.x, p.y, 2.6);
    skinText(g, label, p.x, p.y + 3, { size: 5.5, align: "center", color: SKIN.gold });
  } else edgeArrow(c, p, SKIN.gold, label);
  g.restore();
}

/** Arrow on the edge of the play field toward an off-screen HUD point, with a short label behind it. */
function edgeArrow(c: HudCtx, p: Pt, color: string, label: string, alpha = 1, glyph?: (x: number, y: number) => void): void {
  const { g, L } = c;
  const m = 16;
  const cx = L.w / 2;
  const cy = L.h / 2;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const hw = L.w / 2 - m;
  const hh = (L.h - 60 - (m + 10)) / 2;
  const ccy = m + 10 + hh;
  const s = Math.min(hw / Math.max(1e-6, Math.abs(dx)), hh / Math.max(1e-6, Math.abs(p.y - ccy)));
  const ex = cx + dx * s;
  const ey = ccy + (p.y - ccy) * s;
  const ang = Math.atan2(dy, dx);
  g.save();
  g.globalAlpha *= alpha;
  g.translate(ex, ey);
  g.save();
  g.rotate(ang);
  g.beginPath();
  g.moveTo(5, 0);
  g.lineTo(-3, 3.6);
  g.lineTo(-1.5, 0);
  g.lineTo(-3, -3.6);
  g.closePath();
  g.lineJoin = "round";
  g.lineWidth = 1.4;
  g.strokeStyle = "rgba(6,4,2,0.9)";
  g.stroke();
  g.fillStyle = color;
  g.fill();
  g.restore();
  const tx = -Math.cos(ang) * 9;
  const ty = -Math.sin(ang) * 9 - 3;
  skinText(g, label, tx, ty, { size: 5.5, align: "center", color });
  glyph?.(tx, ty - 3.5);
  g.restore();
}

// ---- next camp pointer --------------------------------------------------------------------------------

const CAMP_HINT_QUIET_R = 700; // world px: a living monster this close means there is something to do here
const CAMP_HINT_AFTER_MS = 2500; // nothing to fight for this long before the pointer shows
const CAMP_HINT_FADE_MS = 400;
let quietSince = 0;

/**
 * HUD pass (royale part): when nothing is left to fight around the player, an edge arrow + distance toward
 * the nearest camp this client has not seen emptied (same knowledge as the minimap tents: map layout plus
 * the nearby-camp snapshots). Red for a camp, amber for an elite camp. Hidden while a waypoint is set, once
 * the survivors are revealed, and whenever the camp itself is on screen.
 */
export function drawCampHintHud(c: HudCtx): void {
  const v = c.v;
  const self = v.self;
  const now = nowMs();
  if (v.phase !== "fight" || !self?.alive || waypoint || (v.last?.length ?? 0) > 0 || isMapOverlayOpen()) {
    quietSince = now;
    return;
  }
  for (const mo of v.monsters.values()) {
    if (mo.hp > 0 && Math.hypot(mo.x - self.x, mo.y - self.y) < CAMP_HINT_QUIET_R) {
      quietSince = now;
      return;
    }
  }
  const quiet = now - quietSince - CAMP_HINT_AFTER_MS;
  if (quiet <= 0) return;
  const live = new Map<string, { n: number; e: boolean }>();
  for (const cs of v.camps) live.set(campKey(cs.x, cs.y), cs);
  let best: { x: number; y: number; elite: boolean } | null = null;
  let bd = Infinity;
  for (const cs of getCampSpots()) {
    if (cs.tier === 2) continue; // the boss has its own map glyph and is not a "next camp"
    const key = campKey(cs.x, cs.y);
    const seen = live.get(key);
    if (seen ? seen.n === 0 : cleared.has(key)) continue;
    const d = Math.hypot(cs.x - self.x, cs.y - self.y);
    if (d < bd) {
      bd = d;
      best = { x: cs.x, y: cs.y, elite: seen ? seen.e : cs.tier === 1 };
    }
  }
  if (!best) return;
  const p = c.toHud(best.x, best.y);
  const m = 16;
  if (p.x >= m && p.x <= c.L.w - m && p.y >= m + 10 && p.y <= c.L.h - 60) return; // in view: the camp speaks for itself
  const col = best.elite ? "#ffb347" : "#e0604a";
  const big = best.elite ? 2.6 : 2.1;
  edgeArrow(c, p, col, `${Math.max(1, Math.round(bd / 40))} m`, Math.min(1, quiet / CAMP_HINT_FADE_MS) * 0.9, (x, y) => glyphCamp(c.g, x, y, big, col)); // the minimap's tent, so the arrow reads as "camp"

}

// ---- input (installed once; gated on being in a match) -------------------------------------------

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

function toHudUnits(cssX: number, cssY: number): Pt {
  const L = getHudLayout();
  return { x: (cssX * L.dpr) / L.hudScale, y: (cssY * L.dpr) / L.hudScale };
}

function placeWaypoint(w: Pt, clearR: number): void {
  const m = currentMap();
  if (w.x < 0 || w.y < 0 || w.x > m.w || w.y > m.h) return;
  if (waypoint && Math.hypot(w.x - waypoint.x, w.y - waypoint.y) < clearR) waypoint = null;
  else waypoint = { x: w.x, y: w.y };
}

let installed = false;
/** Called from the royale HUD part; installs the window listeners once. */
export function installMapInput(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // Zoom keys (keybinds minimapZoomIn / minimapZoomOut). Handled here so no other input path is needed.
  window.addEventListener("keydown", (e) => {
    if (!hudState.joined || e.repeat || isTyping(e.target)) return;
    const ids = actionsForPress(e.code, e);
    if (ids.includes("minimapZoomIn")) mapZoomStep(1);
    else if (ids.includes("minimapZoomOut")) mapZoomStep(-1);
  });
  // Breachway: left-click one of your waypoints on the corner map, the world map or the overlay to travel there.
  window.addEventListener(
    "mousedown",
    (e) => {
      if (!hudState.joined || e.button !== 0 || !(e.target instanceof HTMLCanvasElement)) return;
      const list = laneWaypoints().filter((w) => w.mine && w.up);
      if (!list.length) return;
      const h = toHudUnits(e.clientX, e.clientY);
      let at: Pt | null = null;
      let k = 1;
      if (bigOpen() && lastBig) {
        const b = lastBig;
        if (h.x < b.box.x || h.y < b.box.y || h.x > b.box.x + b.box.w || h.y > b.box.y + b.box.h) return;
        at = fromScreen(h.x, h.y, b.ox, b.oy, b.wx, b.wy, b.k);
        k = b.k;
      } else if (overlayOpen() && lastOverlay) {
        const o = lastOverlay;
        at = fromScreen(h.x, h.y, o.ox, o.oy, o.cx, o.cy, o.k);
        k = o.k;
      } else if (lastMini && nowMs() - lastMini.t < 250) {
        const m = lastMini;
        if (h.x < m.r.x || h.y < m.r.y || h.x > m.r.x + m.r.w || h.y > m.r.y + m.r.h) return;
        at = fromScreen(h.x, h.y, m.ox, m.oy, m.cx, m.cy, m.k);
        k = m.k;
      }
      if (!at) return;
      const reach = Math.max(140, 5 / k);
      let best: { k: string; d: number } | null = null;
      for (const w of list) {
        const d = Math.hypot(w.x - at.x, w.y - at.y);
        if (d < reach && (!best || d < best.d)) best = { k: w.k, d };
      }
      if (!best) return;
      laneTravel(best.k);
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
  // Waypoint clicks on the world map / overlay (capture: runs before the canvas skill input).
  window.addEventListener(
    "mousedown",
    (e) => {
      if (!hudState.joined || (e.button !== 1 && e.button !== 2)) return;
      if (!(e.target instanceof HTMLCanvasElement)) return;
      const h = toHudUnits(e.clientX, e.clientY);
      if (bigOpen() && lastBig) {
        const b = lastBig;
        if (h.x < b.box.x || h.y < b.box.y || h.x > b.box.x + b.box.w || h.y > b.box.y + b.box.h) return;
        placeWaypoint(fromScreen(h.x, h.y, b.ox, b.oy, b.wx, b.wy, b.k), 6 / b.k);
      } else if (overlayOpen() && lastOverlay && e.altKey) {
        const o = lastOverlay;
        placeWaypoint(fromScreen(h.x, h.y, o.ox, o.oy, o.cx, o.cy, o.k), 6 / o.k);
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
  // Ctrl+wheel zooms the overlay; plain wheel over the corner map zooms it (not the camera).
  window.addEventListener(
    "wheel",
    (e) => {
      if (!hudState.joined) return;
      if (overlayOpen() && e.ctrlKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        mapZoomStep(e.deltaY < 0 ? 1 : -1);
        return;
      }
      if (!lastMini || nowMs() - lastMini.t > 250 || !(e.target instanceof HTMLCanvasElement)) return;
      const h = toHudUnits(e.clientX, e.clientY);
      const r = lastMini.r;
      if (h.x < r.x - 3 || h.y < r.y - 3 || h.x > r.x + r.w + 3 || h.y > r.y + r.h + 3) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      mapZoomStep(e.deltaY < 0 ? 1 : -1);
    },
    { capture: true, passive: false },
  );
}

/** main.ts resetSession (via hudReset callers): drop the waypoint and fog. */
export function resetMapState(): void {
  waypoint = null;
  resetFog();
}
