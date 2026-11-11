// Isometric pixel-art renderer. The world is drawn into a low-resolution canvas (about 480-640 px
// wide) at a whole-number scale of the window, then upscaled without smoothing. Gameplay stays in
// flat world coordinates; everything here is a client-side projection (see gfx/iso.ts).
import { DODGE_TIME, MAP_H, MAP_W, MAX_FLASK_SLOTS, MIN_PLAYERS_FOR_ROUND, PICKUP_RANGE, PLAYER_RADIUS, ATTACK_COMMIT } from "../shared/constants";
import { RARITY_COLORS } from "../shared/content/loot";
import { ELITE_MOD_BY_ID, MONSTER_BY_ID } from "../shared/content/monsters";
import { CORE_RANGE, isStructKind, SPIRE_RANGE, STRUCT_KINDS, TEAM_COLORS, WAYPOINT_KINDS, waypointAt } from "../shared/lanes";
import { t as trf } from "./i18n";
import { isLaneMode, laneStructUp } from "./lanehud";
import { flaskProps, type Item } from "../shared/items";
import { decodeLook, NAKED_LOOK } from "../shared/look";
import { currentMap, getPois, onMapChange, OBSTACLES, WALL, WATER } from "../shared/map";
import type { BoardEntry, CampSnap, GameEvent, HazardSnap, MonsterSnap, Phase, PlayerSnap, ProjSnap } from "../shared/protocol";
import type { Stats } from "../shared/stats";
import { drawText, drawTitle, FONT_H, textWidth, TITLE_BLOOD, TITLE_BONE, TITLE_EMBER } from "./gfx/font";
import { HERO_FRAMES, heroFrame, heroLiftAt, type HeroAnim } from "./gfx/hero";
import { paperdollFrame } from "./gfx/paperdoll";
import { hero3dFrame } from "./gfx/hero3d";
import { currentPose, playPose } from "./gfx/poses";
import { manaFrac, manaNow } from "./skillbar";
import { flaskIcon, iconSprite, itemIconKind } from "./gfx/icons";
import { itemArtCanvas } from "./gfx/itemart";
import { ART, depthOf, dir8, DIRS, dirN, dirToWorldAngle, isoX, isoY, K, SQ, unproject } from "./gfx/iso";
import { setSpriteDensity } from "./gfx/rig";
import { cam, layers, runLayer } from "./gfx/view";
import { goreLevel } from "./gfx/gore/core";
import { goreCorpse, goreWeaponBlood } from "./gfx/gore/index";
import { ELITE_COLORS, monsterFrame, type MonAnim } from "./gfx/monsters";
import { smoothMonsterFrame, smoothTop } from "./gfx/monsters_smooth"; // monsters agent: smooth roster art
import { clipOutsideHud, laneClaim, laneRects, levelBannerTop, lanesBeginFrame, lanesFixed, placeToasts } from "./hud/lanes"; // HUD lanes: who owns which screen rect
import { getHudLayout } from "./hud/layout";
import { drawBuffHud, drawBuffShrineLabels, drawBuffShrines, drawMonAura, drawMonHazard, drawMonLabel, type MonFx, type PlateRect } from "./gfx/monsters_fx"; // monsters agent
import { hudState } from "./hud/state"; // polish: last-hit target gets a nameplate
import { hexRGB, LightMap, type RGB } from "./gfx/light";
import { hash2, mulberry32, PixBuf, pxEllipse, pxLine, rgba, sprite, startFrameBudget, type Sprite } from "./gfx/pixel";
import { brazierSprite, obstacleKind, obstacleSprite, SCATTER, scatterSprite, shrineIndex, stakeSprite } from "./gfx/props";
import { buildCampPatch, buildChunk, buildTotem, cachedChunk, CHUNK, GROUND_FILL, groundChunkRange, resetGround, setGroundHoles, setGroundSize, shadowSprite, VOID } from "./gfx/world";
import { actorScale, actorSprite, ART_PX, corpseSprite, drawProp, fillPaintedGround, heroSpriteId, iconImage, obstacleProp, paintedGroundChunk, propBox, type PropPick, paintedGroundDue, paintedGroundReady, scatterProp, wallDressProp } from "./gfx/sprites2d/index"; // engine-sprites: painted art
import { HERO_H } from "./gfx/sprites2d/actors"; // integrate: painted hero height for nameplates
import { corpseFall, drawActorBacking, drawWarmFlash, isPaintedSprite, paintedEnabled } from "./gfx/sprites2d/index"; // engine: procedural motion + readability
import { RARITY_INFO } from "../shared/content/monsters/mods"; // engine: rarity ground glow
import { globeBack, globeFrame, globeLiquid, PANEL_SPIKE, panelSprite } from "./gfx/hud";
import { ambientColor, getSettings, lightBudget, onChange, particleCount, renderScaleFor } from "./settings";
import { input } from "./input";
import { itemCategory } from "../shared/grid";
import { ailTint, defenceEvent, drawAilFx, drawEsGlobe, drawStatus, drawTint, hitFloat } from "./defencefx";
import { hudDraw } from "./hud/index";
import { isHudHidden } from "./hud/dock"; // bar package: "toggleHud" key
import { buildMapArt, MAP_ART_SCALE } from "./hud/mapart";
import { drawBigMapExtras, drawHudMinimap, drawHudOverlay, type MapApi } from "./hud/minimap"; // royale: corner map / overlay / waypoint
import { hudWorldGrade } from "./hud/royale"; // royale: death desaturation
import { drawFloatText, drawGroundLabel, drawInteractLabel, drawWorldBar, groundLabelSize } from "./gfx/worldui"; // worldui
import { skinText, skinTextW, skinTitle } from "./hud/skin"; // worldui: smooth nameplate text (polish: + banners)
import { CURRENCY_BY_ID } from "../shared/content/currency"; // loot beams for valuable currency
import { labelStyle } from "./gfx/lootart"; // worldui: ground label colours
import { progBannerRect, progState, shrineHint } from "./prog"; // worldui: Alt highlights trial shrines

export interface GroundView {
  g: number;
  x: number;
  y: number;
  item: Item | undefined;
}

export interface View {
  selfId: number;
  self: PlayerSnap | null; // local player with predicted physics
  selfStats: Stats;
  players: Map<number, PlayerSnap>; // everyone visible (self entry replaced by predicted)
  monsters: Map<number, MonsterSnap>;
  projs: Map<number, ProjSnap>;
  hazards: HazardSnap[];
  ground: GroundView[];
  flasks: (Item | null)[];
  phase: Phase;
  phaseLeft: number;
  winner: string | null;
  alive: number;
  total: number;
  /** Endgame reveal: [id, x, y] of every survivor once three or fewer are left. */
  last?: [number, number, number][];
  ping: number;
  camX: number;
  camY: number;
  spectating: PlayerSnap | null;
  showScoreboard: boolean;
  connected: boolean;
  board: BoardEntry[];
  camps: CampSnap[];
  hoverG: number;
  /** worldui: ground item the player is walking to (click-to-pick-up), or -1. */
  pendingG?: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  big: boolean;
}
interface FeedItem {
  text: string;
  color: string;
  t: number;
}
interface Ring {
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
  color: string;
  color2: string;
}
interface Particle {
  x: number; // world
  y: number;
  z: number; // px above ground
  vx: number;
  vy: number;
  vz: number;
  g: number; // gravity px/s^2
  t: number;
  life: number;
  c: string;
  c2?: string;
  s: number; // size px
}
interface LabelRect {
  g: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Corpse {
  kind: "p" | "m";
  id: number;
  x: number;
  y: number;
  t: number;
  dir: number;
  // player
  lk?: string;
  color?: string;
  wk?: PlayerSnap["wk"];
  // monster
  mk?: string;
  r?: number;
  el?: string[];
}
interface Motion {
  x: number;
  y: number;
  speed: number;
  phase: number;
  s: number; // monster AI state last frame
  strikeT: number; // time since the monster's attack landed (strike animation)
  seen: number;
}
interface Decal {
  x: number;
  y: number;
  t: number;
  life: number;
  v: number;
}
/** engine: procedural motion layered on painted frame sprites (bob, lean, squash, lunge, knockback). */
interface Feel {
  px: number;
  py: number;
  vx: number; // smoothed world velocity
  vy: number;
  sq: number; // squash spring (+ = squashed, - = stretched)
  sqv: number;
  step: number; // last footfall index
  kx: number; // knockback slide offset (world units) + its velocity
  ky: number;
  kvx: number;
  kvy: number;
  air: boolean; // rolling / leaping last frame (landing squash when it ends)
  seen: number;
}
/** World units per footfall: painted hero run cycle (8 frames of 11 units, 2 steps). */
const HERO_STEP = 44;
interface Drawable {
  d: number;
  fn: () => void;
}

const FEED_TIME = 6;
const FLASH_TIME = 0.1;
const OWN_HIT_SHAKE = 1.1; // camera nudge (px at the peak, gone in ~60 ms) when one of your hits lands
const OWN_HIT_SHAKE_HEAVY = 2.2; // crit, or a hit for a quarter of the target's life
/** Per-frame time for building ground chunks (ms; render.drawGround). The first build a frame always runs. */
const GROUND_BUDGET_MS = 4;
const DROP_HOP_TIME = 0.34; // s a fresh drop takes to hop out and land
const DROP_HOP_H = 13; // peak height of the hop (screen px)
const GROUND_PRESEEN_S = 0.6; // s after the first frame on a map in which ground items count as already there (no hop)
const DROP_GLINT_TIME = 0.3; // s the landing glint lasts (magic and better)
const HERO_FLASH_TIME = 0.14; // hero hit flash length (s): a clear hit mark
const HERO_FLASH_GAP = 0.22; // min time between two hero flashes (s)
const TARGET_LOW_W = 720; // world buffer: fine pixels, large readable sprites
/** See-through props: opacity of a tall prop that hides someone, minimum prop height (screen units; a hero is ~49), body point above the feet, and how close to you others must be to count (world px, |dx|+|dy|). */
const PROP_FADE_MIN = 0.35;
const PROP_FADE_TALL = 64;
const PROP_FADE_BODY = 22;
const PROP_FADE_NEAR = 380;
const TARGET_HUD_W = 480; // HUD / labels buffer: chunkier so the pixel font stays readable
/** Old-pixel heights (labels, slashes) -> current world px. */
const ZP = ART * 0.87;
const RARITY_BEAM = ["#c8c8c8", "#7f95ff", "#ffe066", "#ff9a3a"]; // [3] = unique
const HP_GREEN = "#5cc04a";
const AMBIENT = "#80798a"; // what the dark lets through (multiplied): moody but readable (x1.25 of the first pass; light.ts adds an exposure lift)
const WARM: RGB = [255, 206, 150];
const TORCH: RGB = [255, 128, 40];
const SHRINE_LIGHT: RGB = [80, 180, 255];
const LOOT_LIGHT: RGB[] = [[150, 150, 150], [90, 120, 255], [255, 210, 80], [255, 140, 50]]; // [3] = unique

/** Brazier offsets around a camp centre (world units). */
const BRAZIERS: [number, number][] = [
  [62, -38],
  [-46, 58],
];

const splatCache = new Map<number, Sprite>();
/** Blood splatter decal (flat on the ground), a few seeded variants; 6+ are big pools. */
function splatSprite(v: number): Sprite {
  let s = splatCache.get(v);
  if (s) return s;
  const big = v >= 6;
  const W = big ? 30 : 18;
  const H = big ? 16 : 10;
  const buf = new PixBuf(W, H);
  const rnd = mulberry32(v * 977 + 3);
  const cols = [rgba("#2a0707"), rgba("#3d0b0a"), rgba("#55110e")];
  const blobs = big ? 7 : 4;
  for (let b = 0; b < blobs; b++) {
    const cx = W / 2 + (rnd() - 0.5) * W * 0.55;
    const cy = H / 2 + (rnd() - 0.5) * H * 0.5;
    const r = (big ? 4 : 2) + rnd() * (big ? 5 : 3);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - cx) / r, ((y - cy) * 2) / r);
        if (d < 1) buf.set(x, y, cols[d < 0.45 ? 0 : d < 0.8 ? 1 : 2]);
      }
  }
  for (let k = 0; k < (big ? 10 : 5); k++) buf.set(Math.floor(rnd() * W), Math.floor(rnd() * H), cols[2]);
  s = sprite(buf, Math.floor(W / 2), Math.floor(H / 2));
  splatCache.set(v, s);
  return s;
}

let fogCv: HTMLCanvasElement | null = null;
const groundArt = new Map<string, HTMLCanvasElement>();

function fogSprite(): HTMLCanvasElement {
  if (fogCv) return fogCv;
  const cv = document.createElement("canvas");
  cv.width = 192;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  g.setTransform(1, 0, 0, 1 / 3, 0, 0);
  const gr = g.createRadialGradient(96, 96, 0, 96, 96, 96);
  gr.addColorStop(0, "rgba(176,172,188,1)");
  gr.addColorStop(0.5, "rgba(170,166,182,0.55)");
  gr.addColorStop(1, "rgba(160,156,170,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 192, 192);
  fogCv = cv;
  return fogCv;
}

/** Integer upscale factor and low-res size for a device-pixel window size. */
export function pixelScale(devW: number, devH: number) {
  const scale = Math.max(1, Math.round(devW / TARGET_LOW_W));
  // HUD skin: smooth native-resolution HUD; hudScale (device px per HUD unit) is no longer rounded to an integer.
  const hudScale = Math.max(2, (devW * (getSettings().interface.uiScale || 1)) / TARGET_HUD_W);
  return { scale, lowW: Math.ceil(devW / scale), lowH: Math.ceil(devH / scale), hudScale, hudW: Math.ceil(devW / hudScale), hudH: Math.ceil(devH / hudScale) };
}

/** Pixel-art frame used by every HUD panel. */
export function pxFrame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = "#120e0c", hi = "#6b5739") {
  g.fillStyle = "#050405";
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = hi;
  g.fillRect(x + 2, y + 1, w - 4, 1);
  g.fillRect(x + 1, y + 2, 1, h - 4);
  g.fillStyle = "#3a2e20";
  g.fillRect(x + 2, y + h - 2, w - 4, 1);
  g.fillRect(x + w - 2, y + 2, 1, h - 4);
  g.fillStyle = fill;
  g.fillRect(x + 2, y + 2, w - 4, h - 4);
}

const GOLD_POP_LIFE = 1.6;
const COLLAPSE_TIME = 2.6;
const COLLAPSE_RUBBLE_AT = 1.2;
const STRUCT_NAME: Record<string, string> = { lane_outer: "Outer Spire", lane_inner: "Inner Spire", lane_ward: "Ward", lane_core: "Core" };
/** Breachway: can this structure be hit now (every one in front of it in its line is down)? */
function laneStructOpen(k: string, tm: 0 | 1): boolean {
  const i = (STRUCT_KINDS as readonly string[]).indexOf(k);
  return i <= 0 || !laneStructUp(STRUCT_KINDS[i - 1], tm);
}
/** Breachway structure look: painted prop id and scale (existing art, docs/MODE-LANES.md). */
const STRUCT_PROP: Record<string, [string, number]> = {
  lane_outer: ["bs_spire_tall", 1.1],
  lane_inner: ["bs_spire_tall", 1.25],
  lane_ward: ["bs_crystal_large", 1.2],
  lane_core: ["bs_obelisk", 1.6],
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private lo: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private worldG: CanvasRenderingContext2D;
  private hlo = document.createElement("canvas");
  private hg = this.hlo.getContext("2d", { willReadFrequently: false })!; // GPU (gfx/softcanvas.ts)
  private hudScale = 4;
  private hw = 320;
  private hh = 180;
  private ww = 320; // world buffer size (lw/lh are swapped to the HUD size during the HUD pass)
  private wh = 180;
  /** World low-res px -> current target px (1 for the world pass, scale/hudScale for the HUD pass). */
  private hr = 1;
  private dpr = 1;
  /** World canvas px per screen unit (base * zoom) and the render-scale fraction of device px. */
  private Z = 2;
  private baseZ = 2;
  private rs = 1;
  /** Camera zoom (mouse wheel), eased toward zoomTarget, clamped. */
  zoom = 1;
  private zoomTarget = 1;
  private camSX = NaN;
  private camSY = NaN;
  private scale = 2;
  private lw = 320;
  private lh = 180;
  private offX = 0;
  private offY = 0;
  private time = 0;
  /** Props bucketed by 256-unit world cell (rebuilt if the obstacle / scatter lists change). */
  private propGrid: { n: number; cells: Map<number, number[]> } | null = null;
  /** loop19: painted dressing on blocked cells (deep wall trees / rocks, bushes on tree-less rims); art only, no collision. */
  private dress: { x: number; y: number; pp: PropPick; deep: boolean }[] | null = null;
  private light = new LightMap();
  private decals: Decal[] = [];
  private fog = Array.from({ length: 9 }, (_, i) => ({ x: hash2(i, 1, 7) * 900, y: hash2(i, 2, 7) * 600, sp: 3 + hash2(i, 3, 7) * 5 }));
  private dust = Array.from({ length: 60 }, (_, i) => ({ x: hash2(i, 4, 7) * 700, y: hash2(i, 5, 7) * 500, ph: hash2(i, 6, 7) * 6 }));
  private campArt = new Map<string, { patch: Sprite; totem: Sprite }>();
  private floats: FloatText[] = [];
  private feed: FeedItem[] = [];
  private flashes = new Map<string, number>(); // "p:id" / "m:id" -> time left
  private heroFlashAt = new Map<number, number>(); // player id -> renderer time of the last hit flash
  private rings: Ring[] = [];
  private parts: Particle[] = [];
  private corpses: Corpse[] = [];
  /** Breachway: structures falling (cracks, shudder, sinking, dust) and the rubble each one leaves. */
  private collapses: { x: number; y: number; k: string; tm: number; t: number; seed: number }[] = [];
  private rubble: { x: number; y: number; k: string; seed: number }[] = [];
  /** Breachway: "+N gold" popups over your own hero (credits within 0.35 s add up into one). */
  private goldPops: { n: number; t: number }[] = [];
  /** Breachway: renderer time a turret last locked onto you (pulse on lock). */
  private lockedAt = -9;
  private lockedBy = 0;
  private motion = new Map<string, Motion>();
  private feel = new Map<string, Feel>(); // engine: procedural motion state
  private flatCv = document.createElement("canvas"); // engine: telegraph / ring layer (composited at lower opacity)
  private lastPlayers = new Map<number, PlayerSnap>();
  private lastHaz = new Map<number, HazardSnap>();
  private swingSeen = new Map<number, number>();
  private healGlow = new Map<number, number>();
  private shake = 0;
  private groundBorn = new Map<number, number>(); // ground item id -> render time it was first seen
  private groundSince = -1; // render time of the first frame on this map (groundBorn: what was there before)
  private groundLast = new Map<number, { x: number; y: number; r: number }>(); // ground items of the previous frame (pickup puff)
  private bannerFlash: { text: string; t: number; at?: number } | null = null;
  private lastPhase: Phase | null = null;
  private labels: LabelRect[] = [];
  /** See-through props: current opacity of each tall prop that hides someone (absent = 1), and this frame's points to keep visible. */
  private propFadeA = new Map<number, number>();
  private fadePts: { x: number; y: number; d: number }[] = [];
  private fps = 60;
  private hudDt = 1 / 60; // last frame delta (HUD core)
  /** Per-section frame cost (ms, smoothed) for profiling from the console. */
  readonly prof: Record<string, number> = {};

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.lo = document.createElement("canvas");
    this.g = this.lo.getContext("2d", { willReadFrequently: false })!; // GPU: the world pass (gfx/softcanvas.ts)
    this.worldG = this.g;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    onChange("interface", "uiScale", () => this.resize());
    onChange("graphics", "renderScale", () => this.resize());
    canvas.addEventListener(
      "wheel",
      (ev) => {
        if (ev.ctrlKey) return;
        this.zoomTarget = Math.max(0.8, Math.min(1.3, this.zoomTarget * (ev.deltaY > 0 ? 0.93 : 1.07)));
      },
      { passive: true },
    );
    // Ground is built lazily in chunks around the camera (see drawGround), props on first sight.
    onMapChange(() => this.onMapChanged());
    this.onMapChanged();
  }

  /** World agent hook: a new procedural map was installed (shared/map.ts setMap). */
  onMapChanged() {
    const m = currentMap();
    setGroundSize(m.w, m.h);
    resetGround(); // also re-derives props (shrine, paving, scatter)
    this.propGrid = null;
    this.dress = null;
    this.decals = [];
    this.corpses = [];
    this.collapses = [];
    this.rubble = [];
    this.groundBorn.clear();
    this.groundSince = -1;
    this.groundLast.clear();
    this.campArt.clear();
    this.mapOverview = null;
  }

  /** Big world-map panel (M). */
  bigMapOpen = false;
  /** Translucent full-screen map overlay over the game (Tab in the PoE2 preset). */
  mapOverlayOpen = false;
  /** Extra world-space overlay drawn above the darkness (progression: trial shrines, level-up rings). */
  /** CSS px from the bottom of the screen to the top of the bottom HUD panel (progression XP bar sits above it). */
  panelTopCss(): number {
    return ((26 + 4) * this.hudScale) / (this.dpr || 1);
  }
  worldFx: ((g: CanvasRenderingContext2D, to: (x: number, y: number) => { x: number; y: number }, up: (px: number) => number) => void) | null = null;
  /** Cached overview picture of the current map (north-up, MAP_ART_SCALE px per cell). */
  private mapOverview: HTMLCanvasElement | null = null;
  private overview(): HTMLCanvasElement {
    if (this.mapOverview) return this.mapOverview;
    const cv = buildMapArt(currentMap()); // hud/mapart.ts: zone tints, shaded forest edge, roads
    this.mapOverview = cv;
    return cv;
  }

  private resize() {
    this.dpr = window.devicePixelRatio || 1;
    const devW = Math.round(window.innerWidth * this.dpr);
    const devH = Math.round(window.innerHeight * this.dpr);
    const { scale, hudScale, hudW, hudH } = pixelScale(devW, devH);
    this.scale = scale;
    this.rs = renderScaleFor(this.dpr);
    // Smooth world: native device resolution x render scale; the world pass draws in screen units
    // (~720 across at zoom 1) through a canvas transform of Z px per unit.
    this.lo.width = Math.max(1, Math.round(devW * this.rs));
    this.lo.height = Math.max(1, Math.round(devH * this.rs));
    this.baseZ = this.lo.width / TARGET_LOW_W;
    this.applyZoom();
    this.hudScale = hudScale;
    this.hw = hudW;
    this.hh = hudH;
    // HUD skin: the HUD canvas is native device resolution; the HUD pass draws in HUD units through a
    // hudScale transform (smooth vector shapes/text). Smoothing stays off for legacy pixel sprites;
    // the skin kit (hud/skin) turns it on locally for painted art.
    this.hlo.width = devW;
    this.hlo.height = devH;
    this.hg.imageSmoothingEnabled = false;
    this.canvas.width = devW;
    this.canvas.height = devH;
    this.canvas.style.width = devW / this.dpr + "px";
    this.canvas.style.height = devH / this.dpr + "px";
  }

  /** Recompute the unit size of the view for the current zoom. */
  private applyZoom() {
    this.Z = this.baseZ * this.zoom;
    this.lw = this.ww = this.lo.width / this.Z;
    this.lh = this.wh = this.lo.height / this.Z;
    this.light.resize(this.ww, this.wh);
    setSpriteDensity(Math.min(6, Math.max(1, Math.ceil(this.Z * 2) / 2)));
  }

  get fpsEstimate() {
    return Math.round(this.fps);
  }

  /** Client (CSS) pixels -> low-res pixels. */
  private toLow(cx: number, cy: number) {
    return { x: (cx * this.dpr * this.rs) / this.Z, y: (cy * this.dpr * this.rs) / this.Z };
  }

  /** Client (CSS) pixels -> world position on the ground plane (using the last frame's camera). */
  screenToWorld(cx: number, cy: number): { x: number; y: number } {
    const p = this.toLow(cx, cy);
    return unproject(p.x - this.offX, p.y - this.offY);
  }

  /** Aim angle from a world point (the player's feet) toward the ground point under the cursor. */
  aimAngle(cx: number, cy: number, fromX: number, fromY: number): number {
    const p = this.toLow(cx, cy);
    const sx = this.offX + isoX(fromX, fromY);
    const sy = this.offY + isoY(fromX, fromY);
    const w = unproject(p.x - sx, p.y - sy);
    return Math.atan2(w.y, w.x);
  }

  /** Ground item whose label is under the given client point (from the last frame). */
  groundLabelAt(cx: number, cy: number): number | null {
    if (!input.overCanvas) return null; // worldui: no world hover while the cursor is over a DOM panel
    const x = (cx * this.dpr) / this.hudScale;
    const y = (cy * this.dpr) / this.hudScale;
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      if (x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) return l.g;
    }
    return null;
  }

  // ---- projection helpers --------------------------------------------------
  private sx(x: number, y: number) {
    const v = (this.offX + isoX(x, y)) * this.hr;
    return this.hr === 1 ? v : Math.round(v * this.hudScale) / this.hudScale; // worldui: snap to device px (native-res HUD), not whole HUD units
  }
  private sy(x: number, y: number) {
    const v = (this.offY + isoY(x, y)) * this.hr;
    return this.hr === 1 ? v : Math.round(v * this.hudScale) / this.hudScale;
  }
  /** World-pass pixel length -> current target pixels. */
  private up(px: number) {
    return Math.round(px * this.hr);
  }
  private onScreen(x: number, y: number, m = 80) {
    const a = this.offX + isoX(x, y);
    const b = this.offY + isoY(x, y);
    m *= 1.5;
    return a > -m && b > -m && a < this.ww + m && b < this.wh + m * 1.5;
  }
  /** Opacity for a painted obstacle prop this frame: eases to PROP_FADE_MIN while it covers one of fadePts, back to 1 after. */
  private propFade(k: number, pp: PropPick, wx: number, wy: number, dt: number): number {
    let cur = this.propFadeA.get(k) ?? 1;
    let hide = false;
    if (this.fadePts.length) {
      const b = propBox(pp.id, pp.scale, pp.flip);
      if (b && b.t >= PROP_FADE_TALL) {
        const x = this.sx(wx, wy);
        const y = this.sy(wx, wy);
        const d = depthOf(wx, wy);
        const pad = (b.r - b.l) * 0.12;
        for (const q of this.fadePts) {
          if (d > q.d + 2 && q.x > x + b.l + pad && q.x < x + b.r - pad && q.y > y - b.t && q.y < y - 4) {
            hide = true;
            break;
          }
        }
      }
    }
    if (!hide && cur >= 1) return 1;
    cur += ((hide ? PROP_FADE_MIN : 1) - cur) * Math.min(1, dt * 9);
    if (!hide && cur > 0.99) {
      this.propFadeA.delete(k);
      return 1;
    }
    this.propFadeA.set(k, cur);
    return cur;
  }
  private blit(s: Sprite, x: number, y: number, alpha = 1) {
    if (alpha < 1) this.g.globalAlpha = alpha;
    const d = s.d ?? 1;
    if (d === 1) this.g.drawImage(s.cv, x - s.ax, y - s.ay);
    else this.g.drawImage(s.cv, x - s.ax / d, y - s.ay / d, s.cv.width / d, s.cv.height / d);
    if (alpha < 1) this.g.globalAlpha = 1;
  }

  // ---- effects -----------------------------------------------------------

  private burst(x: number, y: number, z: number, n: number, colors: string[], speed: number, opts: Partial<Particle> = {}) {
    n = particleCount(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x,
        y,
        z,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: 40 + Math.random() * 70,
        g: 260,
        t: 0,
        life: 0.35 + Math.random() * 0.35,
        c: colors[Math.floor(Math.random() * colors.length)],
        s: 1,
        ...opts,
      });
    }
  }

  onEvents(events: GameEvent[], selfId: number) {
    for (const e of events) {
      switch (e.k) {
        case "hit": {
          const self = !e.m && e.target === selfId;
          const color = self ? "#ff5050" : e.m ? "#ffd27a" : "#ffffff";
          const dn = getSettings().interface.damageNumbers;
          if (dn === "all" || (dn === "own" && (e.by === selfId || self))) {
            const hf = hitFloat(e, color); // combat-systems: type colour / ES / resisted / deflect
            this.floats.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y, text: hf.text, color: hf.color, t: 0, big: hf.big });
          }
          if (e.m) this.flashes.set("m:" + e.target, FLASH_TIME);
          else {
            // heroes: one short flash per HERO_FLASH_GAP at most, so a stream of hits blinks instead of
            // holding the hero washed out
            const last = this.heroFlashAt.get(e.target) ?? -1;
            if (this.time - last >= HERO_FLASH_GAP) {
              this.heroFlashAt.set(e.target, this.time);
              this.flashes.set("p:" + e.target, HERO_FLASH_TIME);
            }
          }
          if (!e.dot) this.knock(e); // engine: knockback slide
          if (!e.m) {
            const tp = this.lastPlayers.get(e.target);
            const heavy = tp && tp.maxHp > 0 && e.dmg >= tp.maxHp * 0.25;
            playPose(e.target, heavy ? "stagger" : "flinch", heavy ? 520 : 200);
          }
          this.burst(e.x, e.y, 14, 6, ["#fff6c8", "#ffd27a", "#ffffff"], 160, { g: 120, life: 0.18, vz: 30 });
          const bloodless = e.m && this.monsterKindAt(e.target) === "cragback";
          if (goreLevel() === "off") this.burst(e.x, e.y, 12, 7, bloodless ? ["#6a625a", "#8a8278", "#4a443e"] : ["#7a1414", "#a01c1c", "#5a0d0d"], 90); // gfx/gore owns blood
          if (!bloodless && Math.random() < 0.8) this.decals.push({ x: e.x + (Math.random() - 0.5) * 18, y: e.y + (Math.random() - 0.5) * 18, t: 0, life: 25, v: Math.floor(Math.random() * 6) });
          if (self) this.shake = Math.max(this.shake, 3);
          else if (e.by === selfId && !e.dot && !e.sn) {
            // game feel: your own blows nudge the camera (small; a crit or a quarter-life hit a little more)
            const heavy = e.cr || (e.mx !== undefined && e.mx > 0 && e.dmg >= e.mx * 0.25);
            this.shake = Math.max(this.shake, heavy ? OWN_HIT_SHAKE_HEAVY : OWN_HIT_SHAKE);
          }
          break;
        }
        case "def":
        case "ail": {
          // combat-systems: evade / block / deflect / immune and ailment popups + sounds
          const df = defenceEvent(e);
          if (df && getSettings().interface.damageNumbers !== "off") this.floats.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y - 6, text: df.text, color: df.color, t: 0, big: df.big });
          break;
        }
        case "heal":
          this.healGlow.set(e.target, 0.7);
          if (e.target === selfId) this.floats.push({ x: NaN, y: NaN, text: "+FLASK", color: "#7dff9a", t: 0, big: false });
          break;
        case "boom":
          this.rings.push({ x: e.x, y: e.y, r: e.r, t: 0, life: 0.45, color: "#ffcf5a", color2: "#ff5a1f" });
          this.burst(e.x, e.y, 6, 40, ["#ffcf5a", "#ff8a1f", "#ff4a1a", "#fff2b0"], 260, { vz: 90 });
          this.burst(e.x, e.y, 2, 18, ["#3a3430", "#2a2522", "#4a423b"], 140, { g: 40, vz: 20, life: 0.9, s: 2 });
          this.shake = Math.max(this.shake, 4);
          break;
        case "kill": {
          this.feed.push({ text: `${e.killer} > ${e.victim}`, color: "#ffd0d0", t: 0 });
          const p = this.lastPlayers.get(e.vid);
          this.corpses.push({
            kind: "p",
            id: e.vid,
            x: e.x,
            y: e.y,
            t: 0,
            dir: p ? dirN(p.angle, DIRS) : 4,
            lk: p?.lk ?? NAKED_LOOK,
            color: p?.color ?? "#888888",
            wk: p?.wk ?? null,
          });
          this.burst(e.x, e.y, 2, 14, ["#4a423b", "#5c544a", "#3a3430"], 70, { g: 30, vz: 15, life: 0.8, s: 2 });
          this.decals.push({ x: e.x, y: e.y, t: 0, life: 45, v: 6 + Math.floor(Math.random() * 2) });
          break;
        }
        case "mdie":
          if (isStructKind(e.mk)) {
            // Breachway: a structure collapses (no corpse, no blood): debris, dust, a heavy shake, rubble after.
            const sm = this.lastMonsters.get(e.id);
            this.collapses.push({ x: e.x, y: e.y, k: e.mk, tm: sm?.tm ?? 0, t: 0, seed: e.id * 7 + 3 });
            const big = e.mk === "lane_core" ? 1.6 : e.mk === "lane_ward" ? 1.1 : 1.25;
            const n = particleCount(Math.round(26 * big));
            for (let i = 0; i < n; i++) {
              const a = Math.random() * Math.PI * 2;
              const sp = (50 + Math.random() * 110) * big;
              this.parts.push({ x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14, z: 30 + Math.random() * 90 * big, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 60 + Math.random() * 160, g: 420, t: 0, life: 0.8 + Math.random() * 0.6, c: ["#5a524a", "#6e665b", "#3e3833", "#857a6a"][i & 3], c2: "#2a2522", s: 2 + Math.random() * 2.5 });
            }
            this.burst(e.x, e.y, 4, Math.round(16 * big), ["#9a8f7e", "#b3a893", "#7d7466"], 70 * big, { g: -6, vz: 12, life: 1.6, s: 4 });
            this.shake = Math.max(this.shake, e.mk === "lane_core" ? 9 : 6);
            break;
          }
          if (e.mk !== "cragback") this.decals.push({ x: e.x, y: e.y, t: 0, life: 30, v: 6 + Math.floor(Math.random() * 2) });
          this.corpses.push({ kind: "m", id: e.id, x: e.x, y: e.y, t: 0, dir: dir8(e.a), mk: e.mk, r: e.r, el: e.el ? this.eliteOf(e.id) : undefined });
          this.burst(e.x, e.y, 2, 10, ["#4a423b", "#5c544a", "#3a3430"], 60, { g: 30, vz: 15, life: 0.7, s: 2 });
          break;
        case "wp": {
          // Waypoint travel: a team-blue flare where the hero left and where it arrived.
          for (const [x, y] of [[e.x, e.y], [e.x2, e.y2]]) {
            if (!this.onScreen(x, y, 120)) continue;
            this.burst(x, y, 30, 18, ["#9fd0ff", "#e6f4ff", "#5a9cff"], 120, { g: -40, vz: 70, life: 0.9, s: 3 });
          }
          if (e.id === selfId) this.shake = Math.max(this.shake, 2);
          break;
        }
        case "gold": {
          if (e.id !== selfId || e.n <= 0) break;
          const last = this.goldPops[this.goldPops.length - 1];
          if (last && last.t < 0.35) {
            last.n += e.n;
            last.t = Math.min(last.t, 0.1);
          } else this.goldPops.push({ n: e.n, t: 0 });
          if (this.goldPops.length > 4) this.goldPops.shift();
          break;
        }
        case "info":
          this.feed.push({ text: e.text, color: "#c8d4ff", t: 0 });
          break;
      }
    }
    if (this.feed.length > 6) this.feed.splice(0, this.feed.length - 6);
    if (this.corpses.length > 120) this.corpses.splice(0, this.corpses.length - 120);
    if (this.decals.length > 260) this.decals.splice(0, this.decals.length - 260);
  }

  private lastMonsters = new Map<number, MonsterSnap>();
  private monsterKindAt(id: number) {
    return this.lastMonsters.get(id)?.k;
  }
  private eliteOf(id: number) {
    return this.lastMonsters.get(id)?.e;
  }

  private updateFx(dt: number, v: View) {
    this.time += dt;
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < 0.9);
    for (const gp of this.goldPops) gp.t += dt;
    this.goldPops = this.goldPops.filter((gp) => gp.t < GOLD_POP_LIFE);
    for (const c of this.collapses) {
      c.t += dt;
      if (c.t >= COLLAPSE_RUBBLE_AT && c.t - dt < COLLAPSE_RUBBLE_AT) this.rubble.push({ x: c.x, y: c.y, k: c.k, seed: c.seed });
      // a second, lower dust roll as the body hits the ground
      if (c.t >= 0.9 && c.t - dt < 0.9) this.burst(c.x, c.y, 2, 14, ["#a39884", "#8a8070", "#c0b49c"], 110, { g: -4, vz: 6, life: 1.8, s: 5 });
    }
    this.collapses = this.collapses.filter((c) => c.t < COLLAPSE_TIME);
    if (this.rubble.length > 24) this.rubble.splice(0, this.rubble.length - 24);
    for (const f of this.feed) f.t += dt;
    this.feed = this.feed.filter((f) => f.t < FEED_TIME);
    for (const [id, t] of this.flashes) {
      if (t - dt <= 0) this.flashes.delete(id);
      else this.flashes.set(id, t - dt);
    }
    for (const [id, t] of this.healGlow) {
      if (t - dt <= 0) this.healGlow.delete(id);
      else this.healGlow.set(id, t - dt);
    }
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.life);
    for (const c of this.corpses) c.t += dt;
    this.corpses = this.corpses.filter((c) => c.t < 60 && !goreCorpse(c.kind, c.id)?.hidden);
    for (const d of this.decals) d.t += dt;
    this.decals = this.decals.filter((d) => d.t < d.life);
    for (const f of this.fog) f.x += f.sp * dt;
    for (const d of this.dust) {
      d.x += 4 * dt;
      d.ph += dt;
    }
    for (const p of this.parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.g * dt;
      p.z += p.vz * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.3;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    this.shake = Math.max(0, this.shake - dt * 18);
    // game feel: remember when each ground item was first seen, so a fresh drop hops out (drawGroundItem)
    // Items already lying there when this map was first shown (join, rejoin) do not hop. This used to be "the
    // first batch ever seen", which in a fresh match was the first kill's drop: the first loot never hopped.
    if (this.groundSince < 0) this.groundSince = this.time;
    const preExisting = this.time - this.groundSince < GROUND_PRESEEN_S;
    for (const gi of v.ground) if (!this.groundBorn.has(gi.g)) this.groundBorn.set(gi.g, preExisting ? -9 : this.time);
    // game feel: an item that leaves the ground next to you was picked up: a puff of its rarity colour is drawn into the hero
    const groundNow = new Map<number, { x: number; y: number; r: number }>();
    for (const gi of v.ground) groundNow.set(gi.g, { x: gi.x, y: gi.y, r: gi.item?.r ?? 0 });
    if (v.self?.alive) {
      for (const [g, it] of this.groundLast) {
        if (groundNow.has(g)) continue;
        const dx = v.self.x - it.x;
        const dy = v.self.y - it.y;
        if (Math.hypot(dx, dy) > PICKUP_RANGE + 40) continue;
        const col = RARITY_BEAM[it.r] ?? RARITY_BEAM[0];
        const n = particleCount(7 + it.r * 3);
        for (let i = 0; i < n; i++) {
          const life = 0.22 + Math.random() * 0.16;
          this.parts.push({ x: it.x + (Math.random() - 0.5) * 14, y: it.y + (Math.random() - 0.5) * 14, z: 2, vx: dx / life, vy: dy / life, vz: 95 + Math.random() * 50, g: 240, t: 0, life, c: Math.random() < 0.35 ? "#ffffff" : col, s: 1 });
        }
      }
    }
    this.groundLast = groundNow;
    if (this.groundBorn.size > 1500) {
      const live = new Set(v.ground.map((gi) => gi.g));
      for (const g of this.groundBorn.keys()) if (!live.has(g)) this.groundBorn.delete(g);
    }
    if (this.bannerFlash) {
      this.bannerFlash.t = this.bannerFlash.at !== undefined ? (performance.now() - this.bannerFlash.at) / 1000 : this.bannerFlash.t + dt; // polish: wall clock (no lingering when frames are sparse)
      if (this.bannerFlash.t > 1.2) this.bannerFlash = null;
    }

    // Motion tracking (run cycles synced to distance travelled, monster strike detection).
    const seenNow = this.time;
    const track = (key: string, x: number, y: number, s: number) => {
      let m = this.motion.get(key);
      if (!m) {
        m = { x, y, speed: 0, phase: 0, s, strikeT: 9, seen: seenNow };
        this.motion.set(key, m);
      }
      const d = Math.hypot(x - m.x, y - m.y);
      if (d > 120) m.speed = 0;
      else {
        m.speed = m.speed * 0.6 + (dt > 0 ? d / dt : 0) * 0.4;
        m.phase += d;
      }
      if (m.s === 2 && s !== 2) m.strikeT = 0;
      else m.strikeT += dt;
      m.s = s;
      m.x = x;
      m.y = y;
      m.seen = seenNow;
      return m;
    };
    for (const p of v.players.values()) {
      track("p:" + p.id, p.x, p.y, 0);
      // Dust while rolling
      if (p.alive && p.rollT > 0 && Math.random() < 0.7) {
        this.parts.push({ x: p.x + (Math.random() - 0.5) * 16, y: p.y + (Math.random() - 0.5) * 16, z: 1, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, vz: 20 + Math.random() * 20, g: 30, t: 0, life: 0.45, c: Math.random() < 0.5 ? "#5c5246" : "#776a58", s: 2 });
      }
    }
    for (const m of v.monsters.values()) {
      track("m:" + m.id, m.x, m.y, m.s);
      // Frost aura: drifting ice motes on the ground
      if (m.e?.includes("rimecloaked")) {
        const aura = ELITE_MOD_BY_ID.get("rimecloaked")?.frostAura;
        const R = aura?.radius ?? 170;
        const n = Math.random() < dt * 40 ? 1 : 0;
        for (let i = 0; i < n + (Math.random() < dt * 20 ? 1 : 0); i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = Math.sqrt(Math.random()) * R;
          this.parts.push({ x: m.x + Math.cos(a) * rr, y: m.y + Math.sin(a) * rr, z: 0, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, vz: 6 + Math.random() * 10, g: 0, t: 0, life: 0.8 + Math.random() * 0.8, c: Math.random() < 0.3 ? "#ffffff" : "#9adfff", c2: "#3f7fb0", s: 1 });
        }
      }
    }
    for (const pr of v.projs.values()) {
      for (let i = 0; i < 2; i++) {
        this.parts.push({ x: pr.x + (Math.random() - 0.5) * 6, y: pr.y + (Math.random() - 0.5) * 6, z: 12 + (Math.random() - 0.5) * 4, vx: 0, vy: 0, vz: 4, g: 0, t: 0, life: 0.3, c: Math.random() < 0.4 ? "#e0ffb0" : "#6fd04a", c2: "#2a5a20", s: 1 });
      }
    }
    for (const [key, m] of this.motion) if (seenNow - m.seen > 2) this.motion.delete(key);

    // Hazards that vanish near completion leave a shockwave.
    const cur = new Map(v.hazards.map((h) => [h.id, h]));
    for (const [id, h] of this.lastHaz) {
      if (!cur.has(id) && h.f > 0.8) {
        this.rings.push({ x: h.x, y: h.y, r: h.r, t: 0, life: 0.4, color: "#d8c8a8", color2: "#6a5a48" });
        this.burst(h.x, h.y, 2, 22, ["#5c5246", "#776a58", "#3e362e"], h.r * 1.4, { g: 120, vz: 50, s: 2, life: 0.6 });
        this.shake = Math.max(this.shake, 2.5);
      }
    }
    this.lastHaz = cur;

    // Swing start (axe chop dust on impact, spear dust streak)
    for (const p of v.players.values()) {
      if (!p.alive || p.atkT <= 0) continue;
      const prog = 1 - p.atkT / p.swingTime;
      const seen = this.swingSeen.get(p.id) ?? 1;
      if (p.wk === "axe" && prog >= ATTACK_COMMIT && seen < ATTACK_COMMIT) {
        const r = PLAYER_RADIUS + p.atkRange * 0.7;
        this.burst(p.x + Math.cos(p.angle) * r, p.y + Math.sin(p.angle) * r, 1, 10, ["#5c5246", "#776a58"], 90, { g: 140, vz: 40, s: 2 });
      }
      this.swingSeen.set(p.id, prog);
    }
    for (const id of this.swingSeen.keys()) {
      const p = v.players.get(id);
      if (!p || p.atkT <= 0) this.swingSeen.set(id, 1);
    }
  }

  // ---- frame -------------------------------------------------------------

  draw(v: View, dt: number) {
    this.fps = this.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
    this.hudDt = dt;
    if (v.phase !== this.lastPhase) {
      if (v.phase === "fight" && this.lastPhase === "countdown") this.bannerFlash = { text: "FIGHT!", t: 0, at: performance.now() };
      if (v.phase === "countdown") {
        this.corpses = [];
        this.decals = [];
      }
      this.lastPhase = v.phase;
    }
    let pt = performance.now();
    const mark = (k: string) => {
      const n = performance.now();
      this.prof[k] = (this.prof[k] ?? 0) * 0.9 + (n - pt) * 0.1;
      pt = n;
    };
    startFrameBudget(3);
    this.updateFx(dt, v);
    this.updateFeel(dt, v); // engine: procedural motion springs
    mark("fx");
    for (const p of v.players.values()) if (p.alive) this.lastPlayers.set(p.id, p);
    for (const m of v.monsters.values()) this.lastMonsters.set(m.id, m);
    if (this.lastMonsters.size > 400) this.lastMonsters = new Map([...v.monsters].map(([k, m]) => [k, m]));

    // Zoom eases toward the wheel target.
    if (Math.abs(this.zoomTarget - this.zoom) > 0.002) {
      this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 10);
      this.applyZoom();
    }
    const { g, lw, lh } = this;
    g.setTransform(this.Z, 0, 0, this.Z, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.fillStyle = VOID;
    g.fillRect(0, 0, lw, lh);

    // Camera: smooth follow (sub-pixel), player centred slightly above the feet.
    const tx = isoX(v.camX, v.camY);
    const ty = isoY(v.camX, v.camY);
    if (!Number.isFinite(this.camSX) || Math.hypot(tx - this.camSX, ty - this.camSY) > 400) {
      this.camSX = tx;
      this.camSY = ty;
    } else {
      const k = 1 - Math.exp(-dt * 14);
      this.camSX += (tx - this.camSX) * k;
      this.camSY += (ty - this.camSY) * k;
    }
    const shk = getSettings().graphics.screenShake ? this.shake : 0;
    const shx = (Math.random() - 0.5) * shk;
    const shy = (Math.random() - 0.5) * shk;
    this.offX = lw / 2 - this.camSX + shx;
    this.offY = lh / 2 + 24 - this.camSY + shy;
    Object.assign(cam, { offX: this.offX, offY: this.offY, Z: this.Z, ww: this.ww, wh: this.wh, time: this.time });

    this.drawGround();

    mark("bg");
    // Flat ground layer: camp patches, blood, auras, hazards, telegraphs, shadows.
    for (const c of v.camps) {
      if (!this.onScreen(c.x, c.y, 120)) continue;
      this.blit(this.campFor(c).patch, this.sx(c.x, c.y), this.sy(c.x, c.y));
    }
    if (goreLevel() !== "off") this.decals.length = 0; // gfx/gore owns blood decals unless Gore is Off
    for (const d of this.decals) {
      if (!this.onScreen(d.x, d.y, 20)) continue;
      this.blit(splatSprite(d.v), this.sx(d.x, d.y), this.sy(d.x, d.y), Math.min(1, (d.life - d.t) / 5));
    }
    runLayer("ground", g); // engine: gore decals first, so blood never buries telegraphs / rarity rings
    drawBuffShrines(this.monFx()); // monsters agent: guarded buff shrines
    // engine: rarity glow, auras, hazards and telegraphs go to a side layer composited at lower opacity (under the actors).
    const flatPrev = this.flatBegin();
    try {
      for (const m of v.monsters.values()) this.drawRarityGlow(m);
      for (const m of v.monsters.values()) this.drawAura(m);
      for (const hz of v.hazards) this.drawHazard(hz);
      for (const m of v.monsters.values()) this.drawTelegraph(m);
      if (v.self?.alive) this.isoEllipse(v.self.x, v.self.y, PLAYER_RADIUS + 6, null, "rgba(255,240,210,0.22)", true);
      this.drawLaneGround(v);
    } finally {
      this.flatEnd(flatPrev, 0.8);
    }

    mark("flat");
    // Depth-sorted pass
    const list: Drawable[] = [];
    const corpseHide = new Set<string>();
    for (const c of this.corpses) if (c.t < 1.5) corpseHide.add(c.kind + ":" + c.id);
    for (const c of this.corpses) {
      if (!this.onScreen(c.x, c.y)) continue;
      list.push({ d: depthOf(c.x, c.y) - (c.t > 0.6 ? 18 : 0), fn: () => this.drawCorpse(c) });
    }
    for (const c of this.collapses) if (this.onScreen(c.x, c.y, 200)) list.push({ d: depthOf(c.x, c.y), fn: () => this.drawCollapse(c) });
    if (isLaneMode())
      for (const tm of [0, 1] as const) for (const k of WAYPOINT_KINDS) {
        const q = waypointAt(tm, k);
        if (this.onScreen(q.x, q.y, 160)) list.push({ d: depthOf(q.x, q.y), fn: () => this.drawWaypointStone(q.x, q.y, tm, k === "base" || laneStructUp(k, tm)) });
      }
    for (const r of this.rubble) if (this.onScreen(r.x, r.y, 160) && !this.structAt(v, r.x, r.y)) list.push({ d: depthOf(r.x, r.y) - 4, fn: () => this.drawRubble(r) });
    for (const gi of v.ground) {
      if (!this.onScreen(gi.x, gi.y, 60)) continue;
      list.push({ d: depthOf(gi.x, gi.y) - 8, fn: () => this.drawGroundItem(gi) });
    }
    // Trees and other tall props in front of you (or of anyone close to you) go see-through, as in PoE2 / Diablo.
    this.fadePts.length = 0;
    if (v.self?.alive) {
      const me = v.self;
      const pt = (x: number, y: number) => this.fadePts.push({ x: this.sx(x, y), y: this.sy(x, y) - PROP_FADE_BODY, d: depthOf(x, y) });
      pt(me.x, me.y);
      for (const p of v.players.values()) if (p.alive && p.id !== v.selfId && Math.abs(p.x - me.x) + Math.abs(p.y - me.y) < PROP_FADE_NEAR) pt(p.x, p.y);
      for (const m of v.monsters.values()) if (m.hp > 0 && Math.abs(m.x - me.x) + Math.abs(m.y - me.y) < PROP_FADE_NEAR) pt(m.x, m.y);
    }
    for (const k of this.visibleProps()) {
      if (k < OBSTACLES.length) {
        const o = OBSTACLES[k];
        if (o.k === "water" || (o.wall && hash2(Math.round(o.x), Math.round(o.y), 77) < (paintedEnabled() ? 0.45 : 0.75)) || !this.onScreen(o.x, o.y, 160)) continue; // wall rims are the raised masses; about half keep a painted tree so the forest edge reads as trees, not slabs (a quarter with the procedural fallback sprites)
        const pp = obstacleProp(o, obstacleKind(k)); // engine-sprites: painted hollowpine prop when available
        const fa = pp ? this.propFade(k, pp, o.x, o.y, dt) : 1;
        list.push({ d: depthOf(o.x, o.y), fn: () => (pp && drawProp(this.g, pp.id, this.sx(o.x, o.y), this.sy(o.x, o.y), pp.scale, { flipX: pp.flip, alpha: fa })) || this.blit(obstacleSprite(k), this.sx(o.x, o.y), this.sy(o.x, o.y)) });
      } else if (k >= OBSTACLES.length + SCATTER.length) {
        const w = this.dress![k - OBSTACLES.length - SCATTER.length];
        if (!this.onScreen(w.x, w.y, 160)) continue;
        const fa = this.propFade(k, w.pp, w.x, w.y, dt); // loop21: rim fill is small trees / boulders now, so it fades in front of you too
        list.push({ d: depthOf(w.x, w.y), fn: () => drawProp(this.g, w.pp.id, this.sx(w.x, w.y), this.sy(w.x, w.y), w.pp.scale, { flipX: w.pp.flip, alpha: fa }) });
      } else {
        const i = k - OBSTACLES.length;
        const sc = SCATTER[i];
        if (!this.onScreen(sc.x, sc.y, 40)) continue;
        const sp = scatterProp(sc);
        list.push({ d: depthOf(sc.x, sc.y), fn: () => (sp && drawProp(this.g, sp.id, this.sx(sc.x, sc.y), this.sy(sc.x, sc.y), sp.scale, { flipX: sp.flip })) || this.blit(scatterSprite(i), this.sx(sc.x, sc.y), this.sy(sc.x, sc.y)) });
      }
    }
    const bf = Math.floor(this.time * 9) % 4;
    for (const c of v.camps) {
      if (!this.onScreen(c.x, c.y, 200)) continue;
      list.push({ d: depthOf(c.x, c.y), fn: () => this.blit(this.campFor(c).totem, this.sx(c.x, c.y), this.sy(c.x, c.y)) });
      for (const [dx, dy] of BRAZIERS) {
        const x = c.x + dx;
        const y = c.y + dy;
        list.push({ d: depthOf(x, y), fn: () => this.blit(brazierSprite((bf + dx) & 3), this.sx(x, y), this.sy(x, y)) });
      }
      // Palisade stakes around the rim, leaving gaps
      const seed = Math.floor(hash2(Math.round(c.x), Math.round(c.y), 9) * 1000);
      for (let k = 0; k < 10; k++) {
        if ((k + seed) % 4 === 0) continue;
        const a = (k / 10) * Math.PI * 2 + (seed % 7) * 0.1;
        const x = c.x + Math.cos(a) * 150;
        const y = c.y + Math.sin(a) * 150;
        const d8 = ((Math.round((a / (Math.PI * 2)) * 8) % 8) + 8) % 8;
        list.push({ d: depthOf(x, y), fn: () => this.blit(stakeSprite(seed + k, d8), this.sx(x, y), this.sy(x, y)) });
      }
    }
    for (const m of v.monsters.values()) {
      if (corpseHide.has("m:" + m.id) || !this.onScreen(m.x, m.y)) continue;
      list.push({ d: depthOf(m.x, m.y), fn: () => this.drawMonster(m) });
    }
    const living = [...v.players.values()].filter((p) => p.alive && !(corpseHide.has("p:" + p.id) && p.id !== v.selfId));
    for (const p of living) {
      if (!this.onScreen(p.x, p.y)) continue;
      list.push({ d: depthOf(p.x, p.y), fn: () => this.drawPlayer(p, v) });
    }
    for (const pr of v.projs.values()) {
      if (!this.onScreen(pr.x, pr.y)) continue;
      list.push({ d: depthOf(pr.x, pr.y), fn: () => this.drawProj(pr) });
    }
    // Elliptical ground shadows first (all on the ground plane)
    for (const m of v.monsters.values()) if (!corpseHide.has("m:" + m.id) && this.onScreen(m.x, m.y)) this.blit(shadowSprite(m.r * K * 1.0 * this.rarityScale(m)), this.sx(m.x, m.y), this.sy(m.x, m.y));
    for (const p of living) if (this.onScreen(p.x, p.y)) this.blit(shadowSprite(PLAYER_RADIUS * K * 0.95), this.sx(p.x, p.y), this.sy(p.x, p.y) + 1);
    // engine: tight dark contact shadow right under the feet (grounds actors on busy / bloody ground)
    for (const m of v.monsters.values()) if (!corpseHide.has("m:" + m.id) && this.onScreen(m.x, m.y)) this.blit(shadowSprite(m.r * K * 0.5 * this.rarityScale(m)), this.sx(m.x, m.y), this.sy(m.x, m.y), 0.85);
    for (const p of living) if (this.onScreen(p.x, p.y)) this.blit(shadowSprite(PLAYER_RADIUS * K * 0.5), this.sx(p.x, p.y), this.sy(p.x, p.y) + 0.5, 0.75);
    for (const pr of v.projs.values()) if (this.onScreen(pr.x, pr.y)) this.blit(shadowSprite(6), this.sx(pr.x, pr.y), this.sy(pr.x, pr.y));
    this.drawHoverRing(v); // worldui: hovered hostile ring (from last frame's pick)
    for (const c of v.camps) {
      if (!this.onScreen(c.x, c.y, 200)) continue;
      for (const [dx, dy] of BRAZIERS) this.blit(shadowSprite(8), this.sx(c.x + dx, c.y + dy), this.sy(c.x + dx, c.y + dy));
    }
    for (const fn of layers.depth) {
      try {
        fn((d, draw) => list.push({ d, fn: draw }), cam);
      } catch (err) {
        console.error("depth layer", err);
      }
    }
    list.sort((a, b) => a.d - b.d);
    for (const it of list) it.fn();
    runLayer("over", g);
    mark("sorted");

    // Drifting fog banks and dust motes (world-locked, lit by the light map like everything else)
    this.drawFog(v);
    // Darkness: build the light map and multiply it over the world.
    this.buildLights(v);
    this.light.apply(g);
    mark("light");

    // Effects above the darkness: loot beams, weapon arcs, sparks, blasts, flask glow.
    // worldui (STYLE v2): no loot beams for ordinary drops; items lie small on the ground and the dark-box
    // label marks them. PoE2 loot-filter parity: uniques and high-tier currency still get a light beam.
    for (const gi of v.ground) if (gi.item && beamWorthy(gi.item) && this.onScreen(gi.x, gi.y, 160)) this.drawLootBeam(gi);
    for (const p of living) this.drawSlash(p);
    this.drawParticles();
    runLayer("fx", g);
    for (const r of this.rings) this.drawRing(r);
    this.drawTurretBeams(v);
    if (this.worldFx) this.worldFx(g, (x, y) => ({ x: this.sx(x, y), y: this.sy(x, y) }), (px) => this.up(px));
    for (const [id, t] of this.healGlow) {
      const p = v.players.get(id);
      if (!p) continue;
      const k = t / 0.7;
      g.globalAlpha = Math.max(0, k);
      this.isoEllipse(p.x, p.y, 18 + (1 - k) * 12, null, "#8cffa0");
      g.globalAlpha = 1;
      if (Math.random() < 0.6) this.parts.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30, z: 2, vx: 0, vy: 0, vz: 40, g: 0, t: 0, life: 0.5, c: Math.random() < 0.5 ? "#7dff9a" : "#ff6a72", s: 1 });
    }

    mark("effects");
    // HUD pass: labels and panels go to a separate overlay (restored even if a HUD draw throws).
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.hw <= 0 || this.hh <= 0) return;
    this.hg.setTransform(1, 0, 0, 1, 0, 0);
    this.hg.clearRect(0, 0, this.hlo.width, this.hlo.height);
    this.hg.setTransform(this.hudScale, 0, 0, this.hudScale, 0, 0);
    this.g = this.hg;
    this.lw = this.hw;
    this.lh = this.hh;
    this.hr = this.Z / this.rs / this.hudScale;
    try {
    // Labels (world-space): clipped to the area outside the HUD's rects, so no plate, float or loot
    // label is ever drawn across the minimap, the bars, the feed or the top-centre column.
    lanesBeginFrame();
    lanesFixed(!this.mapOverlayOpen && getSettings().interface.showMinimap !== false && !isHudHidden(), !isHudHidden() && !!v.self?.alive);
    placeToasts(getHudLayout());
    this.g.save();
    clipOutsideHud(this.g, getHudLayout());
    this.pickHover(v); // worldui: hovered hostile / interactable (cursor + ground ring next frame)
    {
      // polish: PoE2-style declutter. Focused (hovered / recently hit) first, then by rarity, so the
      // important plates keep their spot and the rest stack above them.
      const lh = hudState.lastHit;
      const hitId = lh && lh.m && performance.now() / 1000 - lh.at < 4 ? lh.id : -1;
      const hovId = this.hoverEnt?.m ? this.hoverEnt.id : -1;
      const focusOf = (m: MonsterSnap) => m.hp > 0 && (m.id === hovId || m.id === hitId);
      const ms = [...v.monsters.values()].filter((m) => !corpseHide.has("m:" + m.id) && this.onScreen(m.x, m.y));
      ms.sort((a, b) => Number(focusOf(b)) - Number(focusOf(a)) || (b.rr ?? 0) - (a.rr ?? 0) || b.y - a.y);
      this.plates = [];
      // Crowds: the modifier line only for the focused monster and the few rares nearest the player;
      // player name plates are obstacles so monster names stack clear of them.
      const me = v.self;
      const near = me ? ms.filter((m) => (m.rr ?? 0) >= 2 && m.hp > 0).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y)) : [];
      // loop19: with more than one rare in the fight only the focused one shows its mods (its plate in the top
      // bar, or overhead with the bar off), so several rares no longer stack 2-line plates into a column.
      const modIds = new Set(near.length > 1 ? [] : near.map((m) => m.id));
      this.hudR = laneRects(getHudLayout());
      this.selfPlate = undefined;
      if (getSettings().interface.playerLabels !== "off")
        for (const p of v.players.values())
          if (p.alive && this.onScreen(p.x, p.y)) {
            const r = { x: this.sx(p.x, p.y) - 20, y: this.plateY(p) - 9, w: 40, h: 13 };
            this.plates.push(r);
            if (p.id === v.selfId) this.selfPlate = r; // loop21: monster bars over your own plate are dimmed
          }
      // loop17: PoE2 declutter. The focused enemy's name and mods are in the top target bar and a damaged
      // boss's in the boss bar, so overhead they keep only the life bar; magic (and pack-granted) monsters show no name unless
      // focused; at most 3 other names per screen (rarest first, then front-most, from the sort above).
      const topBar = getSettings().interface.targetBar !== false;
      let named = 0;
      for (const m of ms) {
        if (m.tm !== undefined && isStructKind(m.k)) {
          this.drawStructPlate(m, v.players.values()); // Breachway: owner plate
          continue;
        }
        const f = focusOf(m);
        const boss = !!MONSTER_BY_ID.get(m.k)?.boss;
        const rr = m.rr ?? 0;
        const laneElite = m.tm !== undefined && rr >= 1 && m.hp > 0; // Breachway: elites / exiles always named and marked
        let bare = topBar && (f || (boss && m.hp < m.mhp));
        if (!bare && !f && !boss && !laneElite && (rr >= 1 || m.gm)) bare = rr <= 1 || named++ >= 3; // granted-mod (pack) normals count as magic
        if (laneElite) {
          // Breachway: lane elites keep their name right over their own bar (it used to stack up past every hero plate
          // in the wave and float far above the elite); only the elite's own rects join the shared plate list.
          const own: PlateRect[] = [];
          const saved = this.plates;
          this.plates = own;
          try {
            this.drawMonsterLabel(m, f, !me || modIds.has(m.id), bare);
          } finally {
            this.plates = saved;
          }
          this.plates.push(...own);
          this.drawLaneEliteMark(m, own);
        } else this.drawMonsterLabel(m, f, !me || modIds.has(m.id), bare);
      }
      for (const fn of this.plateText) fn(); // loop19: names over every bar
      this.plateText.length = 0;
    }
    drawBuffShrineLabels(this.monFx()); // monsters agent
    if (input.showLabels) this.drawInteractHighlights(); // worldui: Alt also marks interactables
    drawBuffHud(this.monFx());
    const pl = getSettings().interface.playerLabels;
    for (const p of living) {
      if (!this.onScreen(p.x, p.y)) continue;
      if (pl !== "off" && !(pl === "others" && p.id === v.selfId)) this.drawLabel(p, p.id === v.selfId);
      else if (p.st) drawStatus(this.g, p.st, this.sx(p.x, p.y), this.plateY(p) - 13, 1, this.time); // worldui: ailments stay visible without the nameplate
    }
    this.drawLootLabels(v);
    for (const f of this.floats) {
      const fx = Number.isNaN(f.x) && v.self ? v.self.x : f.x;
      const fy = Number.isNaN(f.y) && v.self ? v.self.y : f.y;
      const rise = this.up(34 * ZP + f.t * 36);
      // HUD pass (native resolution): smooth serif floats; big hits are only brightened, never doubled.
      drawFloatText(this.g, f.text, this.sx(fx, fy), this.sy(fx, fy) - rise, f.color, f.big, Math.max(0, Math.min(1, 1.6 - f.t * 1.8)), 1 + 0.2 * Math.max(0, 1 - f.t / 0.12)); // pops in 20% larger
    }
    this.drawLaneHudMarks(v);
    this.g.restore(); // end of the outside-the-HUD clip

    mark("labels");
    this.drawHud(v);
    } finally {
      this.g = this.worldG;
      this.lw = this.ww;
      this.lh = this.wh;
      this.hr = 1;
    }
    mark("hud");

    // Upscale to the window
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(this.lo, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;
    hudWorldGrade(this.ctx, this.canvas.width, this.canvas.height); // royale: dim + desaturate the world while dead
    this.ctx.drawImage(this.hlo, 0, 0);
    mark("up");
  }

  /** World point -> light map (centred a little above the feet so bodies are lit). */
  private lightAt(x: number, y: number, R: number, c: RGB, k: number) {
    this.light.add(this.sx(x, y), this.sy(x, y) - 16, R * K, c, k);
  }

  private buildLights(v: View) {
    const t = this.time;
    this.light.begin(ambientColor(AMBIENT));
    const lb = lightBudget();
    const flick = (seed: number, a: number) => 1 + a * (Math.sin(t * 7.3 + seed) * 0.6 + Math.sin(t * 17.1 + seed * 2.3) * 0.4);
    let anyPlayer = false;
    for (const p of v.players.values()) {
      if (!p.alive || !this.onScreen(p.x, p.y, 260)) continue;
      const self = p.id === v.selfId;
      anyPlayer ||= self || p.id === v.spectating?.id;
      this.lightAt(p.x, p.y, (self ? 270 : 225) * lb.radiusK * flick(p.id, 0.025), WARM, self ? 1 : 0.85);
    }
    if (!anyPlayer) this.lightAt(v.camX, v.camY, 300, [150, 150, 180], 0.55);
    for (const c of v.camps) {
      if (!this.onScreen(c.x, c.y, 300)) continue;
      BRAZIERS.forEach(([dx, dy], i) => this.lightAt(c.x + dx, c.y + dy, 190 * flick(c.x + i * 3, 0.06), TORCH, 1));
    }
    const SHRINE_IDX = shrineIndex();
    if (SHRINE_IDX >= 0) {
      const o = OBSTACLES[SHRINE_IDX];
      if (this.onScreen(o.x, o.y, 300)) this.lightAt(o.x, o.y, o.r * 2.6, SHRINE_LIGHT, 0.75 + Math.sin(t * 1.7) * 0.1);
    }
    for (const gi of v.ground) {
      if (!gi.item || !this.onScreen(gi.x, gi.y, 60)) continue;
      const r = gi.item.r;
      if (lb.minor) this.lightAt(gi.x, gi.y, [45, 80, 100, 130][r] ?? 45, LOOT_LIGHT[r] ?? LOOT_LIGHT[0], r === 0 ? 0.45 : 0.85);
    }
    for (const pr of v.projs.values()) if (lb.minor && this.onScreen(pr.x, pr.y)) this.lightAt(pr.x, pr.y, 80, [130, 255, 200], 0.9);
    for (const m of v.monsters.values()) {
      if (!this.onScreen(m.x, m.y, 100)) continue;
      if (m.k === "bog_seer") this.lightAt(m.x, m.y, m.s === 2 ? 110 : 70, [110, 230, 200], m.s === 2 ? 0.8 : 0.45); // corpse-light staff
      if (m.e?.includes("rimecloaked")) this.lightAt(m.x, m.y, (ELITE_MOD_BY_ID.get("rimecloaked")?.frostAura?.radius ?? 170) * 1.1, [90, 150, 255], 0.35);
    }
    for (const hz of v.hazards) if (this.onScreen(hz.x, hz.y, 120)) this.lightAt(hz.x, hz.y, hz.r * 1.3, [255, 80, 30], 0.3 + 0.5 * hz.f);
    for (const r of this.rings) this.lightAt(r.x, r.y, r.r * 1.8, hexRGB(r.color), 1 - r.t / r.life);
    for (const [id, tt] of this.healGlow) {
      const p = v.players.get(id);
      if (p) this.lightAt(p.x, p.y, 110, [120, 255, 150], tt / 0.7);
    }
  }

  private drawFog(v: View) {
    const { g, lw, lh } = this;
    const cx = isoX(v.camX, v.camY);
    const cy = isoY(v.camX, v.camY);
    const wrap = (a: number, lo: number, span: number) => lo + ((((a - lo) % span) + span) % span);
    const fog = fogSprite();
    g.globalAlpha = 0.09;
    for (const f of this.fog) {
      const x = wrap(f.x, cx - lw / 2 - 140, lw + 280);
      const y = wrap(f.y, cy - lh / 2 - 60, lh + 120);
      g.drawImage(fog, this.offX + x - 90, this.offY + y - 30, 180, 60);
    }
    g.fillStyle = "#c8bea6";
    for (const d of this.dust) {
      const x = wrap(d.x, cx - lw / 2, lw);
      const y = wrap(d.y + Math.sin(d.ph * 0.7) * 6, cy - lh / 2, lh);
      g.globalAlpha = 0.25 + 0.2 * Math.sin(d.ph * 1.3);
      g.beginPath();
      g.arc(this.offX + x, this.offY + y, 0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  private campFor(c: CampSnap) {
    const key = `${Math.round(c.x)},${Math.round(c.y)}`;
    let a = this.campArt.get(key);
    if (!a) {
      const seed = Math.floor(hash2(Math.round(c.x), Math.round(c.y), 5) * 1000);
      a = { patch: buildCampPatch(seed % 97), totem: buildTotem(seed % 7) };
      if (this.campArt.size > 64) this.campArt.clear();
      this.campArt.set(key, a);
    }
    return a;
  }

  // ---- ground layer --------------------------------------------------------
  /** Blit the visible ground chunks; build missing ones under a small per-frame budget, then prefetch a ring. */
  /** Smoothed cost of one wall / water chunk build (ms), for the per-frame ground budget. */
  private chunkCost = 3;
  private drawGround() {
    const { g } = this;
    const R = groundChunkRange();
    const x0 = Math.max(R.cx0, Math.floor(-this.offX / CHUNK));
    const x1 = Math.min(R.cx1, Math.floor((this.ww - this.offX) / CHUNK));
    const y0 = Math.max(R.cy0, Math.floor(-this.offY / CHUNK));
    const y1 = Math.min(R.cy1, Math.floor((this.wh - this.offY) / CHUNK));
    const until = performance.now() + GROUND_BUDGET_MS;
    let built = 0;
    const painted = paintedGroundReady(); // engine-sprites: painted hollowpine tiles under the wall / water chunks
    setGroundHoles(painted);
    const sc = g.getTransform().a || 1;
    const snap = (v: number) => Math.round(v * sc) / sc;
    /** Wall / water chunk build (2-5 ms each): the first one a frame always, more only when the measured cost still fits. */
    const build = (cx: number, cy: number) => {
      const t = performance.now();
      const c = buildChunk(cx, cy);
      if (c) this.chunkCost = this.chunkCost * 0.8 + (performance.now() - t) * 0.2;
      built++;
      return c;
    };
    const fits = () => built === 0 || performance.now() + this.chunkCost < until;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let c = cachedChunk(cx, cy);
        if (c === undefined && fits()) c = build(cx, cy);
        // Snapped to device pixels: at a fractional position neighbouring chunks both antialias
        // their shared edge and the chunk grid shows as faint lines.
        const dx = snap(this.offX + cx * CHUNK);
        const dy = snap(this.offY + cy * CHUNK);
        const dw = snap(this.offX + (cx + 1) * CHUNK) - dx;
        const dh = snap(this.offY + (cy + 1) * CHUNK) - dy;
        if (c && painted) {
          // Painted chunks are budgeted like the wall chunks and painted a few layers per frame (sprites2d/ground.ts):
          // a whole row of them entering the view used to be painted inside one frame, a 50-200 ms hitch, and later
          // one whole 5-10 ms chunk per frame. A late one shows the plain base tile.
          const due = paintedGroundDue(cx, cy);
          const go = due && (built === 0 || performance.now() < until);
          if (go) built++;
          const pg = paintedGroundChunk(cx, cy, CHUNK, go, until);
          if (pg) g.drawImage(pg, dx, dy, dw, dh);
          else fillPaintedGround(g, this.offX, this.offY, dx, dy, CHUNK);
        }
        if (c) g.drawImage(c, dx, dy, dw, dh);
        else if (c === undefined && !(painted && fillPaintedGround(g, this.offX, this.offY, dx, dy, CHUNK))) {
          // not built yet: the plain ground tile when the painted ground is on, else a flat fill
          g.fillStyle = GROUND_FILL;
          g.fillRect(dx, dy, CHUNK, CHUNK);
        }
      }
    }
    // Prefetch one chunk ring beyond the view with whatever budget is left (painted ground too, so walking
    // finds the next row ready instead of painting it the frame it shows).
    for (let cy = Math.max(R.cy0, y0 - 1); cy <= Math.min(R.cy1, y1 + 1) && performance.now() < until; cy++) {
      for (let cx = Math.max(R.cx0, x0 - 1); cx <= Math.min(R.cx1, x1 + 1) && performance.now() < until; cx++) {
        let c = cachedChunk(cx, cy);
        if (c === undefined) {
          if (performance.now() + this.chunkCost >= until) continue;
          c = build(cx, cy);
        }
        if (c && painted && paintedGroundDue(cx, cy)) paintedGroundChunk(cx, cy, CHUNK, true, until);
      }
    }
  }

  /** Obstacle (k < OBSTACLES.length) and scatter (k - OBSTACLES.length) indices near the view. */
  /**
   * loop19: dress blocked ground with existing painted props (visual only; the map and collision are untouched).
   * Cells 3+ deep in a wall get a tall conifer (or boulder on rocky walls) on about 3 in 5 cells, layer-2 cells a
   * sparser one; rim obstacles that draw no tree (render skip below) get a low bush / fern / rock nudged toward the
   * open side, so the walkable edge reads even where no tree marks it.
   */
  private buildDress(): { x: number; y: number; pp: PropPick; deep: boolean }[] {
    const out: { x: number; y: number; pp: PropPick; deep: boolean }[] = [];
    const m = currentMap();
    const C = m.cell;
    const mix = m.biome.wallMix as Record<string, number>;
    const tot = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
    const rockP = ((mix.rocks ?? 0) + (mix.ruin ?? 0)) / tot;
    const at = (i: number, j: number) => (i < 0 || j < 0 || i >= m.cols || j >= m.rows ? WALL : m.solid[j * m.cols + i]);
    // loop21: cells that already draw a wall tree (the render keeps about 55%), so layer-2 fill goes only into the holes
    const drawn = new Set<number>();
    for (const o of OBSTACLES) if (o.wall && o.k !== "water" && hash2(Math.round(o.x), Math.round(o.y), 77) >= 0.45) drawn.add(Math.floor(o.y / C) * m.cols + Math.floor(o.x / C));
    for (let j = 0; j < m.rows; j++)
      for (let i = 0; i < m.cols; i++) {
        if (at(i, j) !== WALL) continue;
        let dist = 3;
        for (let dj = -2; dj <= 2 && dist > 1; dj++)
          for (let di = -2; di <= 2; di++)
            if (at(i + di, j + dj) !== WALL) dist = Math.min(dist, Math.max(Math.abs(di), Math.abs(dj)));
        if (dist === 1) continue; // rims: handled from the obstacle list below
        const hx = hash2(i, j, 91);
        // layer 2 (loop21): 30% of all cells left see-through gaps between the rim and the deep forest; now 80% of
        // the cells that draw no wall tree of their own (about 90% covered, was about 57%)
        if (dist === 2 && drawn.has(j * m.cols + i)) continue;
        if (hx > (dist >= 3 ? 0.6 : 0.8)) continue;
        const x = (i + 0.5) * C + (hash2(i, j, 92) - 0.5) * C * 0.6;
        const y = (j + 0.5) * C + (hash2(i, j, 93) - 0.5) * C * 0.6;
        const pp = wallDressProp(x, y, true, hash2(i, j, 94) < rockP, dist === 2);
        if (pp) out.push({ x, y, pp, deep: true });
      }
    for (const o of OBSTACLES) {
      if (!o.wall || o.k === "water" || hash2(Math.round(o.x), Math.round(o.y), 77) >= 0.45) continue; // only rims that draw no tree
      const i = Math.floor(o.x / C);
      const j = Math.floor(o.y / C);
      let ox = 0;
      let oy = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (at(i + di, j + dj) === 0) { ox += di; oy += dj; } // OPEN = 0
      const l = Math.hypot(ox, oy);
      if (l < 0.01) continue; // layer-2 obstacle (no open neighbour): the deep pass covers it
      const x = o.x + (ox / l) * 20;
      const y = o.y + (oy / l) * 20;
      const pp = wallDressProp(x, y, false, false);
      if (pp) out.push({ x, y, pp, deep: false });
    }
    return out;
  }

  private visibleProps(): number[] {
    const CELL = 256;
    if (!this.dress && paintedEnabled()) this.dress = this.buildDress(); // waits for the painted art index
    const dress = this.dress ?? [];
    const n0 = OBSTACLES.length + SCATTER.length;
    const n = n0 + dress.length;
    if (!this.propGrid || this.propGrid.n !== n) {
      const cells = new Map<number, number[]>();
      for (let k = 0; k < n; k++) {
        const p = k < OBSTACLES.length ? OBSTACLES[k] : k < n0 ? SCATTER[k - OBSTACLES.length] : dress[k - n0];
        const key = Math.floor(p.x / CELL) * 65536 + Math.floor(p.y / CELL);
        let l = cells.get(key);
        if (!l) cells.set(key, (l = []));
        l.push(k);
      }
      this.propGrid = { n, cells };
    }
    const a = unproject(-this.offX, -this.offY);
    const b = unproject(this.ww - this.offX, this.wh - this.offY);
    const out: number[] = [];
    for (let gx = Math.floor(a.x / CELL) - 1; gx <= Math.floor(b.x / CELL) + 1; gx++) {
      for (let gy = Math.floor(a.y / CELL) - 1; gy <= Math.floor(b.y / CELL) + 2; gy++) {
        const l = this.propGrid.cells.get(gx * 65536 + gy);
        if (l) for (const k of l) out.push(k);
      }
    }
    return out;
  }


  /** Smooth ellipse (fill, then a thin stroke); "dither" now means a softer, translucent fill. */
  private ell(cx: number, cy: number, rx: number, ry: number, fill: string | null, stroke: string | null, dither = false) {
    if (rx < 0.5 || ry < 0.5) return;
    const g = this.g;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (fill) {
      const a = g.globalAlpha;
      if (dither) g.globalAlpha = a * 0.6;
      g.fillStyle = fill;
      g.fill();
      g.globalAlpha = a;
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = this.hr === 1 ? 0.8 : 1;
      g.stroke();
    }
  }

  private isoEllipse(x: number, y: number, r: number, fill: string | null, stroke: string | null, dither = false) {
    this.ell(this.sx(x, y), this.sy(x, y), r * K * this.hr, r * K * SQ * this.hr, fill, stroke, dither);
  }

  private drawAura(m: MonsterSnap) {
    drawMonAura(this.monFx(), m); // monsters agent: rarity ring, ally auras, bubbles
    for (const id of m.e ?? []) {
      const aura = ELITE_MOD_BY_ID.get(id)?.frostAura;
      if (!aura || !this.onScreen(m.x, m.y, 120)) continue;
      this.isoEllipse(m.x, m.y, aura.radius, "rgba(120,190,255,0.10)", null, true);
      // Dashed frosty rim, slowly rotating
      const g = this.g;
      g.save();
      g.setLineDash([6, 4]);
      g.lineDashOffset = -this.time * 12;
      g.strokeStyle = "rgba(160,220,255,0.7)";
      g.lineWidth = 0.9;
      g.beginPath();
      g.ellipse(this.sx(m.x, m.y), this.sy(m.x, m.y), aura.radius * K, aura.radius * K * SQ, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  private drawHazard(hz: HazardSnap) {
    if (hz.sh && drawMonHazard(this.monFx(), hz)) return; // monsters agent: cone / line / ring / pool
    if (!this.onScreen(hz.x, hz.y, 120)) return;
    const pulse = Math.floor(this.time * 10) % 2 === 0;
    const g = this.g;
    g.globalAlpha = 0.35 + 0.4 * hz.f;
    this.isoEllipse(hz.x, hz.y, hz.r, "rgba(255,60,30,0.4)", null, true);
    g.globalAlpha = 0.45 + 0.5 * hz.f;
    this.isoEllipse(hz.x, hz.y, Math.round(hz.r * hz.f / 4) * 4, "rgba(255,90,40,0.5)", null);
    g.globalAlpha = 1;
    this.isoEllipse(hz.x, hz.y, hz.r, null, pulse || hz.f > 0.8 ? "#ff5a3c" : "#b8301e");
  }

  /** Melee windup: a dithered red wedge on the ground in front of the monster. */
  private drawTelegraph(m: MonsterSnap) {
    const type = MONSTER_BY_ID.get(m.k);
    if (m.s !== 2 || type?.ai !== "melee" || !this.onScreen(m.x, m.y)) return;
    const g = this.g;
    const reach = m.r + type.attackRange + PLAYER_RADIUS;
    const flash = m.w > 0.78 && Math.floor(this.time * 16) % 2 === 0;
    g.beginPath();
    g.moveTo(this.sx(m.x + Math.cos(m.a - Math.PI / 3) * m.r, m.y + Math.sin(m.a - Math.PI / 3) * m.r), this.sy(m.x + Math.cos(m.a - Math.PI / 3) * m.r, m.y + Math.sin(m.a - Math.PI / 3) * m.r));
    for (let i = 0; i <= 16; i++) {
      const a = m.a - Math.PI / 3 + ((Math.PI * 2) / 3) * (i / 16);
      g.lineTo(this.sx(m.x + Math.cos(a) * reach, m.y + Math.sin(a) * reach), this.sy(m.x + Math.cos(a) * reach, m.y + Math.sin(a) * reach));
    }
    for (let i = 16; i >= 0; i--) {
      const a = m.a - Math.PI / 3 + ((Math.PI * 2) / 3) * (i / 16);
      g.lineTo(this.sx(m.x + Math.cos(a) * m.r, m.y + Math.sin(a) * m.r), this.sy(m.x + Math.cos(a) * m.r, m.y + Math.sin(a) * m.r));
    }
    g.closePath();
    // Fill grows with the windup (inner to outer), rim brightens; flashes just before the hit.
    const cx = this.sx(m.x, m.y);
    const cy = this.sy(m.x, m.y);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, reach * K);
    const w = Math.max(0.05, Math.min(0.98, m.w));
    gr.addColorStop(0, "rgba(255,60,40,0.35)");
    gr.addColorStop(w, `rgba(255,70,40,${flash ? 0.6 : 0.32})`);
    gr.addColorStop(Math.min(1, w + 0.02), "rgba(255,60,40,0.08)");
    gr.addColorStop(1, "rgba(255,60,40,0.08)");
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = flash ? "rgba(255,220,180,0.9)" : `rgba(255,90,60,${0.35 + 0.4 * m.w})`;
    g.lineWidth = flash ? 1.2 : 0.8;
    g.stroke();
  }

  // ---- entities ------------------------------------------------------------

  /** Swing counter per player: odd swings play the mirrored attack (alternating slashes). */
  private swingParity = new Map<number, { t: number; n: number }>();

  private heroAnim(p: PlayerSnap, v: View): { anim: HeroAnim; frame: number; dir: number; clip?: { clip: string; prog: number; loop?: boolean } } {
    const m = this.motion.get("p:" + p.id);
    if (p.rollT > 0) {
      const dur = p.id === v.selfId ? v.selfStats.dodgeTime : DODGE_TIME;
      const prog = 1 - p.rollT / Math.max(0.05, dur);
      const ang = Math.hypot(p.rollDx, p.rollDy) > 0.01 ? Math.atan2(p.rollDy, p.rollDx) : p.angle;
      return { anim: "roll", frame: Math.max(0, Math.min(5.99, prog * 6)), dir: dirN(ang, DIRS) };
    }
    const dir = dirN(p.angle, DIRS);
    const pose = currentPose(p.id);
    const clip = pose?.clip !== undefined ? { clip: pose.clip, prog: pose.prog ?? 0, loop: pose.loop } : undefined; // skill clip of the 3D hero (gfx/skills.ts)
    if (pose && !pose.weak) return { anim: pose.anim, frame: pose.frame, dir: pose.dir !== undefined ? dirN(pose.dir, DIRS) : dir, clip };
    if (p.atkT > 0) {
      // Frames 0-3 are the wind-up (lingering on the draw-back), contact at 3 (the commit point), 4-5 follow-through.
      const prog = 1 - p.atkT / Math.max(0.05, p.swingTime);
      const sp = this.swingParity.get(p.id) ?? { t: 0, n: 0 };
      if (p.atkT > sp.t + 0.01) sp.n++;
      sp.t = p.atkT;
      this.swingParity.set(p.id, sp);
      const C = ATTACK_COMMIT;
      const f = prog < C ? Math.pow(prog / C, 1.6) * 3 : 3 + ((prog - C) / (1 - C)) * 2.99;
      return { anim: sp.n % 2 ? "attack2" : "attack", frame: Math.max(0, Math.min(5.99, f)), dir };
    }
    const sp = this.swingParity.get(p.id);
    if (sp) sp.t = 0;
    if (pose) return { anim: pose.anim, frame: pose.frame, dir, clip };
    if (m && m.speed > 40) {
      return { anim: "run", frame: (m.phase / 11) % 8, dir };
    }
    return { anim: "idle", frame: (this.time * 3 + p.id * 0.7) % 4, dir };
  }

  /** engine-sprites: painted hero archetype frame (by weapon kind) for a procedural hero anim state, or null. */
  private paintedHero(wk: string | null | undefined, anim: HeroAnim, frame: number, dir: number, flash: boolean): Sprite | null {
    const id = heroSpriteId(wk);
    const o = { dirs: DIRS, flash };
    switch (anim) {
      case "idle":
        return actorSprite(id, "idle", dir, this.time, o);
      case "run":
        return actorSprite(id, "run", dir, 0, { ...o, progress: ((frame * 2) % 8) / 8 });
      case "roll":
        return actorSprite(id, "run", dir, 0, { ...o, progress: ((frame * 2) % 6) / 6 });
      case "attack":
      case "attack2":
        return actorSprite(id, "attack", dir, 0, { ...o, progress: frame / 6 });
      case "slam":
      case "leap":
        return actorSprite(id, "slam", dir, 0, { ...o, progress: frame / Math.max(1, HERO_FRAMES[anim]) });
      case "death":
        return corpseSprite(id, dir, 0, { ...o, progress: frame / 6 });
      case "flinch":
      case "stagger":
        return actorSprite(id, "idle", dir, this.time, { ...o, flash: true });
      default:
        return actorSprite(id, "cast", dir, 0, { ...o, progress: frame / Math.max(1, HERO_FRAMES[anim] ?? 6) });
    }
  }

  private drawPlayer(p: PlayerSnap, v: View) {
    const { anim, frame, dir, clip } = this.heroAnim(p, v);
    const lk = p.lk ?? NAKED_LOOK;
    const flash = this.flashes.has("p:" + p.id);
    const blood = Math.min(3, Math.ceil(goreWeaponBlood(p.id) * 3 - 0.15));
    const heroCfg = { look: decodeLook(lk), color: p.color, wk: p.wk, blood: blood > 0 ? blood : 0 };
    // paperdoll: painted parts on the rig (shows gear) > painted archetype frames > procedural rig.
    const s = hero3dFrame("p:" + p.id, heroCfg.look, lk, p.angle, anim, frame, flash, p.id !== v.selfId, clip) ?? paperdollFrame(heroCfg, lk, dir, anim, frame, flash) ?? this.paintedHero(p.wk, anim, frame, dir, flash) ?? heroFrame(heroCfg, lk, dir, anim, frame, flash);
    // engine: procedural motion (painted frames get bob / lean / squash / lunge; everyone gets the knockback slide)
    const painted = isPaintedSprite(s);
    let lunge = 0;
    if (painted && p.atkT > 0 && p.rollT <= 0) {
      const prog = 1 - p.atkT / Math.max(0.05, p.swingTime);
      lunge = prog < ATTACK_COMMIT ? -0.2 * (prog / ATTACK_COMMIT) : Math.sin(Math.PI * Math.min(1, (prog - ATTACK_COMMIT) / (1 - ATTACK_COMMIT))) * 0.8;
    }
    const fp = this.feelPose("p:" + p.id, painted, p.angle, lunge, 1);
    const g = this.g;
    g.save();
    g.translate(this.sx(p.x + fp.ox, p.y + fp.oy), this.sy(p.x + fp.ox, p.y + fp.oy) - heroLiftAt(anim, frame) - fp.lift);
    g.transform(fp.a, 0, fp.c, fp.d, 0, 0);
    this.blit(s, 0, 0);
    const tn = ailTint(p.st, this.time); // combat-systems: freeze / shock / ignite tint
    if (tn) drawTint(this.g, s, 0, 0, tn.color, tn.a);
    // Hit mark: the whole body flashes bright red-white for a moment when struck.
    const hf = this.flashes.get("p:" + p.id) ?? 0;
    if (hf > 0) {
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = "lighter";
      drawTint(this.g, s, 0, 0, "#ff9a8a", 0.75 * Math.min(1, hf / HERO_FLASH_TIME));
      g.globalCompositeOperation = op;
    }
    drawAilFx(this.g, p.st, s, 0, 0, this.time, p.id);
    g.restore();
  }

  // ---- engine: procedural motion on frame sprites --------------------------------------------

  /** Knockback slide: kick the target's visual offset away from the attacker (springs back). */
  private knock(e: Extract<GameEvent, { k: "hit" }>) {
    const key = (e.m ? "m:" : "p:") + e.target;
    const f = this.feel.get(key);
    if (!f) return;
    const tgt = e.m ? this.lastMonsters.get(e.target) : this.lastPlayers.get(e.target);
    if (!tgt) return;
    const src = e.m ? this.lastPlayers.get(e.by) : e.sn ? this.lastMonsters.get(e.by) : (this.lastPlayers.get(e.by) ?? this.lastMonsters.get(e.by));
    let dx = tgt.x - (src ? src.x : e.x);
    let dy = tgt.y - (src ? src.y : e.y);
    const d = Math.hypot(dx, dy);
    if (d < 0.01) {
      const a = e.m ? (tgt as MonsterSnap).a : (tgt as PlayerSnap).angle;
      dx = -Math.cos(a);
      dy = -Math.sin(a);
    } else {
      dx /= d;
      dy /= d;
    }
    const mhp = e.m ? (tgt as MonsterSnap).mhp : (tgt as PlayerSnap).maxHp;
    const frac = mhp > 0 ? e.dmg / mhp : 0.1;
    const mass = e.m ? this.monMass(tgt as MonsterSnap) : 1;
    const amp = Math.min(9, 2.5 + frac * 30) * mass; // world units at the peak
    f.kvx += dx * amp * 22;
    f.kvy += dy * amp * 22;
    f.sqv += 1.2 * mass; // hit squash
  }

  /** Heavier (bigger) actors move less: 1 for small monsters, ~0.45 for bosses. */
  private monMass(m: MonsterSnap) {
    if (MONSTER_BY_ID.get(m.k)?.boss) return 0.45;
    return Math.max(0.4, Math.min(1, 16 / Math.max(1, m.r)));
  }
  /** Slight scale-up for rare / unique (non-boss) monsters so they stand out of the pack. */
  private rarityScale(m: MonsterSnap) {
    if (m.tm !== undefined && m.rr) return 1.18; // Breachway: lane elites stand out of their wave
    if (!m.rr || m.rr < 2 || MONSTER_BY_ID.get(m.k)?.boss) return 1;
    return m.rr === 3 ? 1.16 : 1.1;
  }

  private updateFeel(dt: number, v: View) {
    if (dt <= 0) return;
    const now = this.time;
    const kd = 1 - Math.exp(-dt * 12);
    const upd = (key: string, x: number, y: number, air: boolean, stepLen: number) => {
      let f = this.feel.get(key);
      if (!f) {
        f = { px: x, py: y, vx: 0, vy: 0, sq: 0, sqv: 0, step: 0, kx: 0, ky: 0, kvx: 0, kvy: 0, air, seen: now };
        this.feel.set(key, f);
      }
      if (Math.hypot(x - f.px, y - f.py) > 120) f.vx = f.vy = 0;
      else {
        f.vx += ((x - f.px) / dt - f.vx) * kd;
        f.vy += ((y - f.py) / dt - f.vy) * kd;
      }
      f.px = x;
      f.py = y;
      const sp = Math.hypot(f.vx, f.vy);
      const idx = Math.floor((this.motion.get(key)?.phase ?? 0) / stepLen);
      if (idx !== f.step) {
        if (sp > 40 && !air) f.sqv += 1.1 * Math.min(1, sp / 160); // footfall
        f.step = idx;
      }
      if (f.air && !air) f.sqv += 2.6; // landing (roll / leap end)
      f.air = air;
      // squash spring (slightly under-damped: a little stretch after each squash)
      const sdt = Math.min(dt, 1 / 30);
      f.sqv += (-f.sq * 380 - f.sqv * 20) * sdt;
      f.sq += f.sqv * sdt;
      // knockback slide spring
      f.kvx += (-f.kx * 200 - f.kvx * 24) * sdt;
      f.kvy += (-f.ky * 200 - f.kvy * 24) * sdt;
      f.kx += f.kvx * sdt;
      f.ky += f.kvy * sdt;
      f.seen = now;
    };
    for (const p of v.players.values()) if (p.alive) upd("p:" + p.id, p.x, p.y, p.rollT > 0 || currentPose(p.id)?.anim === "leap", HERO_STEP);
    for (const m of v.monsters.values()) upd("m:" + m.id, m.x, m.y, !!m.rl, m.k === "cragback" ? 20 : 13);
    for (const [k, f] of this.feel) if (now - f.seen > 2) this.feel.delete(k);
  }

  /**
   * Offset (world units), lift (screen units) and a 2x2 transform (a, c, d: scale x, lean shear, scale y)
   * for an actor sprite anchored at its feet. Deformations only for painted frames (rigged art animates itself).
   */
  private feelPose(key: string, painted: boolean, ang: number, lunge: number, mass: number, stepLen = HERO_STEP): { ox: number; oy: number; lift: number; a: number; c: number; d: number } {
    const f = this.feel.get(key);
    let ox = f ? f.kx : 0;
    let oy = f ? f.ky : 0;
    ox += Math.cos(ang) * lunge * 6 * mass;
    oy += Math.sin(ang) * lunge * 6 * mass;
    if (!painted || !f) return { ox, oy, lift: 0, a: 1, c: 0, d: 1 };
    const sp = Math.hypot(f.vx, f.vy);
    const runK = Math.max(0, Math.min(1, (sp - 25) / 140));
    const bob = Math.abs(Math.sin((Math.PI * (this.motion.get(key)?.phase ?? 0)) / stepLen));
    const lift = bob * 1.6 * runK * mass;
    const sq = Math.max(-0.12, Math.min(0.18, f.sq * mass));
    const stretch = 0.03 * runK * bob * mass;
    // lean into screen-horizontal movement, plus a little into the lunge
    const lean = (Math.max(-1, Math.min(1, isoX(f.vx, f.vy) / 200)) * 0.14 + lunge * 0.06 * Math.sign(isoX(Math.cos(ang), Math.sin(ang)))) * mass;
    return { ox, oy, lift, a: 1 + sq * 0.6 - stretch * 0.5, c: -lean, d: 1 - sq + stretch };
  }

  /** PoE2-style soft rarity glow on the ground under magic / rare / unique monsters. */
  private drawRarityGlow(m: MonsterSnap) {
    if (!m.rr || !this.onScreen(m.x, m.y, 60)) return;
    const col = RARITY_INFO[m.rr]?.color;
    if (!col) return;
    const [r, gg, b] = hexRGB(col);
    const R = (m.r + 10) * this.rarityScale(m) * K;
    const pulse = m.rr === 3 ? 0.06 * Math.sin(this.time * 3 + m.id) : 0;
    const a = (m.rr === 1 ? 0.2 : m.rr === 2 ? 0.26 : 0.3) + pulse;
    const g = this.g;
    g.save();
    g.translate(this.sx(m.x, m.y), this.sy(m.x, m.y));
    g.scale(1, SQ);
    const gr = g.createRadialGradient(0, 0, R * 0.35, 0, 0, R);
    gr.addColorStop(0, `rgba(${r},${gg},${b},0)`);
    gr.addColorStop(0.7, `rgba(${r},${gg},${b},${a})`);
    gr.addColorStop(0.86, `rgba(${r},${gg},${b},${Math.min(1, a * 1.3)})`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  /** Redirect world drawing to the flat side layer (same transform); returns the context to restore. */
  private flatBegin(): CanvasRenderingContext2D {
    const prev = this.g;
    const cv = this.flatCv;
    if (cv.width !== this.lo.width || cv.height !== this.lo.height) {
      cv.width = this.lo.width;
      cv.height = this.lo.height;
    }
    const fg = cv.getContext("2d", { willReadFrequently: false })!;
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, cv.width, cv.height);
    fg.setTransform(this.Z, 0, 0, this.Z, 0, 0);
    fg.imageSmoothingEnabled = true;
    fg.globalAlpha = 1;
    this.g = fg;
    return prev;
  }
  private flatEnd(prev: CanvasRenderingContext2D, alpha: number) {
    this.g = prev;
    prev.save();
    prev.setTransform(1, 0, 0, 1, 0, 0);
    prev.globalAlpha = alpha;
    prev.drawImage(this.flatCv, 0, 0);
    prev.restore();
  }

  /** engine-sprites: painted monster scale (shared art scale, grown for oversized rares / bosses). */
  private monScale(k: string, r: number) {
    const base = MONSTER_BY_ID.get(k)?.radius ?? r;
    return actorScale(k) * Math.max(0.8, Math.min(1.6, r / Math.max(1, base)));
  }

  private drawCorpse(c: Corpse) {
    const gc = goreCorpse(c.kind, c.id);
    if (gc?.hidden) return;
    const sink = gc?.sink ?? 0;
    const x = this.sx(c.x, c.y);
    const y = this.sy(c.x, c.y) + sink * 8;
    const fade = Math.min(1, (60 - c.t) / 4) * (1 - sink);
    const frame = Math.min(5, c.t / 0.11);
    let s: Sprite;
    if (c.kind === "p") {
      // Dying with gear; the lying body has nothing left (everything spilled as loot).
      const lying = frame >= 5;
      const lk = lying ? NAKED_LOOK : c.lk!;
      const corpseCfg = { look: decodeLook(lk), color: c.color!, wk: lying ? null : c.wk ?? null, missing: gc?.missing };
      s = (gc?.missing?.length ? null : hero3dFrame("c:" + c.id, corpseCfg.look, lk, dirToWorldAngle(c.dir, DIRS), "death", frame)) ?? paperdollFrame(corpseCfg, lk, c.dir, "death", frame) ?? corpseSprite(heroSpriteId(c.wk), c.dir, 0, { dirs: DIRS, progress: frame / 5 }) ?? heroFrame(corpseCfg, lk, c.dir, "death", frame);
    } else {
      s = corpseSprite(c.mk!, c.dir, 0, { dirs: 8, progress: frame / 5, scale: this.monScale(c.mk!, c.r!) }) ?? smoothMonsterFrame(c.mk!, c.r!, c.dir * (DIRS / 8), "death", Math.floor(frame)) ?? monsterFrame(c.mk!, c.r!, c.el, c.dir, "death", Math.floor(frame));
    }
    // engine: death slump on painted frames. A lying frame (no die art) topples over from upright about
    // its feet; real die frames (and the end of the topple) get a landing squash that settles.
    const g = this.g;
    g.save();
    let body = s;
    if (isPaintedSprite(s)) {
      const fall = corpseFall(s);
      const FALL = 0.42;
      if (fall && c.t < FALL) {
        const e = Math.min(1, c.t / FALL);
        const ee = e * e; // gravity: slow start, fast finish
        const d = s.d ?? 1;
        g.translate(x + ((fall.fx - s.ax) / d) * ee, y);
        g.rotate(fall.sign * (Math.PI / 2) * (1 - ee));
        body = { cv: s.cv, ax: fall.fx, ay: s.ay, d: s.d };
      } else {
        const lt = c.t - (fall ? FALL : 0.5);
        const sq = lt > 0 && lt < 0.4 ? Math.sin((lt / 0.4) * Math.PI) * 0.12 * (1 - lt / 0.4) : 0;
        g.translate(x, y);
        g.scale(1 + sq * 0.7, 1 - sq);
      }
    } else g.translate(x, y);
    this.blit(body, 0, 0, fade);
    if (gc?.tint && (gc.tintA ?? 0) > 0) {
      this.g.globalAlpha = fade;
      drawTint(this.g, body, 0, 0, gc.tint, gc.tintA ?? 0);
      this.g.globalAlpha = 1;
    }
    g.restore();
  }

  // ---- monsters agent: drawing context for gfx/monsters_fx + rogue exile paper doll ----
  private _monFx: MonFx | null = null;
  private monFx(): MonFx {
    if (!this._monFx) {
      const self = this;
      this._monFx = {
        get g() { return self.g; },
        get time() { return self.time; },
        sx: (x, y) => this.sx(x, y),
        sy: (x, y) => this.sy(x, y),
        up: (px) => this.up(px),
        ell: (x, y, r, f, st, d) => this.isoEllipse(x, y, r, f, st, d),
        bar: (x, y, w, fr, c) => this.bar(x, y, w, fr, c),
        onScreen: (x, y, pad) => this.onScreen(x, y, pad),
      };
    }
    return this._monFx;
  }
  private exileFrame(m: MonsterSnap, mo: { speed: number; phase: number; strikeT: number } | undefined, flash: boolean): Sprite | null {
    if (!m.lk) return null;
    const dir = dirN(m.a, DIRS);
    let anim: HeroAnim = "idle";
    let frame = (this.time * 3 + m.id * 0.7) % 4;
    if (m.rl) {
      anim = "roll";
      frame = (this.time * 18) % 6;
    } else if (m.s === 2) {
      anim = "attack";
      frame = Math.min(2.99, m.w * 3);
    } else if (mo && mo.strikeT < 0.3) {
      anim = "attack";
      frame = Math.min(5.99, 3 + mo.strikeT * 10);
    } else if (mo && mo.speed > 40) {
      anim = "run";
      frame = (mo.phase / 11) % 8;
    }
    return heroFrame({ look: decodeLook(m.lk), color: m.cl ?? "#c0b090", wk: (m.wk ?? null) as never }, m.lk, dir, anim, frame, flash);
  }

  /** engine-sprites: painted monster frame (sprite id = monster kind) for the anim state, or null. */
  private paintedMonster(m: MonsterSnap, anim: MonAnim, mo: Motion | undefined, flash: boolean): Sprite | null {
    const o = { dirs: DIRS, flash, scale: this.monScale(m.k, m.r) };
    const dir = dirN(m.a, DIRS);
    const atk = m.k === "cragback" ? "slam" : "attack";
    if (anim === "windup") return actorSprite(m.k, atk, dir, 0, { ...o, progress: Math.min(0.66, m.w * 0.66) });
    if (anim === "strike") return actorSprite(m.k, atk, dir, 0, { ...o, progress: 0.67 + Math.min(0.33, ((mo?.strikeT ?? 0) / 0.27) * 0.33) });
    if (anim === "move" && mo) {
      const stride = m.k === "cragback" ? 20 : 13;
      return actorSprite(m.k, "run", dir, 0, { ...o, progress: (Math.floor(mo.phase / stride) % 2) / 2 });
    }
    return actorSprite(m.k, "idle", dir, this.time + m.id * 0.37, o);
  }

  /** Breachway: team ring under lane units (blue Dawn / red Dusk). */
  private drawTeamRing(m: MonsterSnap) {
    const g = this.g;
    const R = (m.r + 6) * K;
    g.save();
    g.strokeStyle = TEAM_COLORS[m.tm ?? 0];
    g.globalAlpha = 0.75;
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(this.sx(m.x, m.y), this.sy(m.x, m.y), R, R * SQ, 0, 0, Math.PI * 2);
    g.stroke();
    if (m.rr) {
      // Lane elites / exiles: a pulsing rarity-coloured glow and a second ring so they read inside a wave.
      const rc = RARITY_INFO[m.rr].color;
      const R2 = R + 7 * K;
      const pulse = 0.75 + 0.25 * Math.sin(this.time * 5 + m.id);
      const x = this.sx(m.x, m.y);
      const y = this.sy(m.x, m.y);
      g.save();
      g.translate(x, y);
      g.scale(1, SQ);
      const gr = g.createRadialGradient(0, 0, R * 0.3, 0, 0, R2 * 1.35);
      gr.addColorStop(0, rc + "00");
      gr.addColorStop(0.6, rc + "55");
      gr.addColorStop(1, rc + "00");
      g.globalAlpha = pulse;
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, R2 * 1.35, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = rc;
      g.globalAlpha = 0.95;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(x, y, R2, R2 * SQ, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  /** Breachway: a bobbing rarity-coloured marker over a lane elite / exile (HUD pass, over every bar). */
  private drawLaneEliteMark(m: MonsterSnap, own: PlateRect[]) {
    const col = RARITY_INFO[m.rr ?? 1].color;
    const x = this.sx(m.x, m.y);
    // Just over the elite's own name plate (or its bar), never past other units' plates.
    const u = 1;
    const topY = own.length ? Math.min(...own.map((r) => r.y)) : this.sy(m.x, m.y) - this.up(30 * this.rarityScale(m));
    const y = topY - 3 + Math.sin(this.time * 4 + m.id) * 1;
    this.plateText.push(() => {
      const g = this.g;
      g.save();
      g.fillStyle = col;
      g.strokeStyle = "#0a0709";
      g.lineWidth = 1.5 * u;
      g.beginPath();
      g.moveTo(x - 5 * u, y - 5 * u);
      g.lineTo(x + 5 * u, y - 5 * u);
      g.lineTo(x, y + 2 * u);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    });
  }

  /** Breachway: owner plate over a structure: team name and structure name in the team colour, a team-coloured
   *  life bar; grey while it cannot be hit yet (the one in front of it still stands). */
  private drawStructPlate(m: MonsterSnap, players: Iterable<PlayerSnap>) {
    if (m.hp <= 0) return;
    const tm = m.tm ?? 0;
    const col = TEAM_COLORS[tm];
    const open = laneStructOpen(m.k, tm);
    const lift = m.k === "lane_core" ? 150 : m.k === "lane_ward" ? 100 : 170;
    const x = this.sx(m.x, m.y);
    let y = this.sy(m.x, m.y) - this.up(lift * K * 0.5) - 26;
    const bw = m.k === "lane_core" ? 64 : 48;
    // One line: the structure's name in its team's colour over a team-coloured bar. It never covers a
    // player (moves above any hero standing in front of it) and is dropped where a HUD panel sits.
    const rect = { x: x - bw / 2 - 1, y: y - 8, w: bw + 2, h: 11 };
    const heroes = [...players].filter((q) => q.alive && this.onScreen(q.x, q.y));
    const hit = (a: PlateRect, b: PlateRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (let i = 0; i < 4; i++) {
      const p = heroes.find((q) => hit(rect, { x: this.sx(q.x, q.y) - 20, y: this.plateY(q) - 10, w: 40, h: this.sy(q.x, q.y) - this.plateY(q) + 10 }));
      if (!p) break;
      const dy = rect.y + rect.h - (this.plateY(p) - 11);
      rect.y -= dy;
      y -= dy;
    }
    if (this.hudR.some((r) => hit(rect, r))) {
      // Under a HUD panel: below the structure's base ring instead, or not at all.
      y = this.sy(m.x, m.y) + this.up((m.r + 18) * K * SQ) + 12;
      rect.y = y - 8;
      if (this.hudR.some((r) => hit(rect, r))) return;
    }
    this.bar(x - Math.floor(bw / 2), y, bw, m.hp / m.mhp, open ? col : "#77737e");
    this.plates.push(rect);
    const name = STRUCT_NAME[m.k] ?? m.k;
    this.plateText.push(() => skinText(this.g, name, x, y - 7, { size: 5, face: "display", align: "center", color: col, alpha: open ? 1 : 0.7 }));
  }

  /** A living structure stands on this spot (a respawned Ward hides its old rubble). */
  private structAt(v: View, x: number, y: number): boolean {
    for (const m of v.monsters.values()) if (m.tm !== undefined && m.hp > 0 && isStructKind(m.k) && Math.abs(m.x - x) < 30 && Math.abs(m.y - y) < 30) return true;
    return false;
  }

  /** Breachway, flat layer: ground cracks under a fall, turret range rings when an enemy hero comes near, your own lock ring. */
  /** Breachway waypoint: a rune pillar (existing prop) over a team-coloured circle; grey and still once its structure fell. */
  private drawWaypointStone(wx: number, wy: number, tm: 0 | 1, up: boolean) {
    const g = this.g;
    const x = this.sx(wx, wy);
    const y = this.sy(wx, wy);
    if (!drawProp(g, "bs_pillar_rune_b", x, y, ART_PX * 0.55, { alpha: up ? 1 : 0.55 })) {
      g.fillStyle = "#4a4650";
      g.fillRect(x - 6 * K, y - 40 * K, 12 * K, 40 * K);
    }
    if (!up) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    const pulse = 0.55 + 0.25 * Math.sin(this.time * 2.4 + wx * 0.01);
    const gl = g.createRadialGradient(x, y - 34 * K, 0, x, y - 34 * K, 18 * K);
    gl.addColorStop(0, TEAM_COLORS[tm] + "cc");
    gl.addColorStop(1, TEAM_COLORS[tm] + "00");
    g.globalAlpha = pulse;
    g.fillStyle = gl;
    g.fillRect(x - 18 * K, y - 52 * K, 36 * K, 36 * K);
    g.restore();
  }

  private drawLaneGround(v: View) {
    const g = this.g;
    if (isLaneMode())
      for (const tm of [0, 1] as const) for (const k of WAYPOINT_KINDS) {
        const q = waypointAt(tm, k);
        if (!this.onScreen(q.x, q.y, 120)) continue;
        const up = k === "base" || laneStructUp(k, tm);
        this.isoEllipse(q.x, q.y, 58, up ? TEAM_COLORS[tm] + "22" : null, up ? TEAM_COLORS[tm] + "aa" : "rgba(120,110,100,0.35)", false);
        if (up) this.isoEllipse(q.x, q.y, 44, null, TEAM_COLORS[tm] + "55", false);
      }
    const cracks = ["fx_crack_ground_d", "fx_crack_ground_e", "fx_crack_ground_f"];
    for (const c of this.collapses) {
      if (!this.onScreen(c.x, c.y, 200)) continue;
      const a = Math.min(1, c.t / 0.35);
      this.groundFx(cracks[c.seed % 3], c.x, c.y, (c.k === "lane_core" ? 0.75 : 0.55) * (0.6 + 0.4 * a), a);
    }
    for (const r of this.rubble) {
      if (!this.onScreen(r.x, r.y, 160) || this.structAt(v, r.x, r.y)) continue;
      this.groundFx(cracks[r.seed % 3], r.x, r.y, r.k === "lane_core" ? 0.75 : 0.55, 0.85);
    }
    const me = v.self;
    if (!me || me.tm === undefined) return;
    for (const m of v.monsters.values()) {
      if (m.tm === undefined || m.hp <= 0 || (m.k !== "lane_outer" && m.k !== "lane_inner" && m.k !== "lane_core")) continue;
      if (!this.onScreen(m.x, m.y, 500)) continue;
      const range = m.k === "lane_core" ? CORE_RANGE : SPIRE_RANGE;
      // The ring shows only while an enemy hero of that turret (you, or a foe near their own turret) closes in.
      let near = Infinity;
      for (const p of v.players.values()) {
        if (!p.alive || p.tm === undefined || p.tm === m.tm) continue;
        near = Math.min(near, Math.hypot(p.x - m.x, p.y - m.y));
      }
      if (near > range + 250) continue;
      const dMe = me.alive && me.tm !== m.tm ? Math.hypot(me.x - m.x, me.y - m.y) : Infinity;
      const hostile = dMe < range + 250; // an enemy turret to you
      const close = Math.max(0, Math.min(1, 1 - ((hostile ? dMe : near) - range) / 250));
      const locked = m.fc === v.selfId;
      const col = hostile ? (locked ? "255,70,50" : "255,150,90") : "200,210,255";
      const a = (hostile ? 0.32 + 0.4 * close : 0.16 + 0.16 * close) * (locked ? 1 + 0.25 * Math.sin(this.time * 10) : 1);
      g.save();
      g.strokeStyle = `rgba(${col},${Math.min(1, a).toFixed(3)})`;
      g.lineWidth = locked ? 2.4 : 1.6;
      g.setLineDash(locked ? [] : [10, 6]);
      g.lineDashOffset = -this.time * 14;
      g.beginPath();
      g.ellipse(this.sx(m.x, m.y), this.sy(m.x, m.y), range * K * this.hr, range * K * SQ * this.hr, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = `rgba(${col},${(a * 0.12).toFixed(3)})`;
      g.fill();
      g.restore();
    }
    // Your own hero under fire from a turret: a pulsing red ring at your feet.
    if (me.alive && this.lockedBy) {
      const p = 0.5 + 0.5 * Math.sin(this.time * 12);
      this.isoEllipse(me.x, me.y, PLAYER_RADIUS + 10 + p * 5, "rgba(255,40,30,0.16)", `rgba(255,60,40,${(0.6 + 0.4 * p).toFixed(3)})`);
    }
  }

  /** A top-down painted fx sprite laid flat on the ground (iso squash). */
  private groundFx(id: string, x: number, y: number, scale: number, alpha: number) {
    const g = this.g;
    g.save();
    g.translate(this.sx(x, y), this.sy(x, y));
    g.scale(1, SQ);
    drawProp(g, id, 0, 0, ART_PX * scale * 2.2, { alpha });
    g.restore();
  }

  /** Beacon top of a structure (screen y). */
  private beaconY(k: string, y: number) {
    return y - (k === "lane_core" ? 150 : k === "lane_ward" ? 100 : 170) * K * 0.5;
  }

  /** Breachway: a falling structure. Cracks spread and it shudders (0-0.45 s), then it sinks into the ground and
   *  crumbles (to 1.75 s) while dust rolls out; the rubble is laid at COLLAPSE_RUBBLE_AT. */
  private drawCollapse(c: { x: number; y: number; k: string; tm: number; t: number; seed: number }) {
    const g = this.g;
    const prop = STRUCT_PROP[c.k] ?? ["bs_obelisk", 1];
    const scale = ART_PX * prop[1];
    const box = propBox(prop[0], scale);
    const H = box ? box.t : 160 * K;
    const W = box ? Math.max(-box.l, box.r) : 60 * K;
    const x0 = this.sx(c.x, c.y);
    const y0 = this.sy(c.x, c.y);
    const shudder = c.t < 0.45 ? Math.sin(c.t * 70) * 2.2 * (c.t / 0.45) : 0;
    const sinkT = Math.max(0, Math.min(1, (c.t - 0.45) / 1.25));
    const sink = sinkT * sinkT * H * 0.85;
    const tilt = (c.seed % 2 ? 1 : -1) * sinkT * 0.12;
    const alpha = Math.max(0, Math.min(1, 1 - (c.t - 1.35) / 0.4));
    if (alpha > 0) {
      g.save();
      // clip at the ground line: the body sinks into the earth
      g.beginPath();
      g.rect(x0 - W * 2 - 40, y0 - H * 1.5 - 40, W * 4 + 80, H * 1.5 + 40 + 6 * K);
      g.clip();
      g.translate(x0 + shudder, y0 + sink);
      g.rotate(tilt);
      if (!drawProp(g, prop[0], 0, 0, scale, { alpha })) {
        g.globalAlpha = alpha;
        g.fillStyle = "#4a4650";
        g.fillRect(-W * 0.4, -H, W * 0.8, H);
      }
      // cracks: dark jagged lines with a faint hot edge, growing over the first half second
      const grow = Math.min(1, c.t / 0.45);
      g.globalAlpha = alpha;
      g.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        let px = (hash2(c.seed, i, 11) - 0.5) * W * 0.9;
        let py = -H * (0.15 + hash2(c.seed, i, 12) * 0.7);
        g.beginPath();
        g.moveTo(px, py);
        const steps = Math.ceil(4 * grow);
        for (let sI = 0; sI < steps; sI++) {
          px += (hash2(c.seed + sI, i, 13) - 0.5) * W * 0.35;
          py += (hash2(c.seed + sI, i, 14) - 0.3) * H * 0.12;
          g.lineTo(px, py);
        }
        g.strokeStyle = "rgba(255,190,120,0.35)";
        g.lineWidth = 3.2;
        g.stroke();
        g.strokeStyle = "rgba(18,12,10,0.9)";
        g.lineWidth = 1.6;
        g.stroke();
      }
      g.restore();
    }
    // dust skirt rolling out at the base while it sinks
    const dustT = Math.max(0, c.t - 0.3);
    if (dustT > 0 && dustT < 2.2) {
      const da = Math.max(0, 1 - dustT / 2.2) * 0.55;
      const R = (40 + dustT * 70) * K * (c.k === "lane_core" ? 1.4 : 1);
      g.save();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + c.seed;
        const px = x0 + Math.cos(a) * R * 0.6;
        const py = y0 + Math.sin(a) * R * 0.6 * SQ - dustT * 10 * K;
        const r = R * (0.45 + hash2(c.seed, i, 21) * 0.3);
        const gr = g.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, `rgba(150,140,122,${da.toFixed(3)})`);
        gr.addColorStop(1, "rgba(150,140,122,0)");
        g.fillStyle = gr;
        g.fillRect(px - r, py - r, r * 2, r * 2);
      }
      g.restore();
    }
  }

  /** Breachway: what a fallen structure leaves (painted rubble props, no new art). */
  private drawRubble(r: { x: number; y: number; k: string; seed: number }) {
    const g = this.g;
    const x = this.sx(r.x, r.y);
    const y = this.sy(r.x, r.y);
    const fl = r.seed % 2 === 1;
    if (r.k === "lane_outer" || r.k === "lane_inner") {
      drawProp(g, "bs_debris_rubble", x - 26 * K, y + 6 * K, ART_PX * 0.7, { flipX: !fl });
      drawProp(g, "bs_spire_broken", x, y, ART_PX * (r.k === "lane_inner" ? 0.95 : 0.85), { flipX: fl });
    } else if (r.k === "lane_ward") {
      drawProp(g, "bs_rubble_slabs_b", x, y, ART_PX * 0.8, { flipX: fl });
      drawProp(g, "bs_crystal_small_" + "abc"[r.seed % 3], x + 14 * K, y + 4 * K, ART_PX * 0.55, { flipX: !fl });
    } else {
      drawProp(g, "bs_rubble_slabs_a", x - 18 * K, y - 4 * K, ART_PX * 1.0, { flipX: fl });
      drawProp(g, "bs_rubble_slabs_c", x + 22 * K, y + 6 * K, ART_PX * 0.9, { flipX: !fl });
      drawProp(g, "bs_debris_rubble", x, y + 10 * K, ART_PX * 0.9, { flipX: fl });
    }
  }

  /** Breachway: a turret's lock on a hero: a beam from its beacon to the hero's chest (over the darkness). */
  private drawTurretBeams(v: View) {
    const g = this.g;
    let lockedBy = 0;
    for (const m of v.monsters.values()) {
      if (!m.fc || m.hp <= 0 || m.tm === undefined) continue;
      const p = v.players.get(m.fc);
      if (!p || !p.alive) continue;
      const self = p.id === v.selfId;
      if (self) lockedBy = m.id;
      if (!this.onScreen(m.x, m.y, 500) && !this.onScreen(p.x, p.y)) continue;
      const x1 = this.sx(m.x, m.y);
      const y1 = this.beaconY(m.k, this.sy(m.x, m.y));
      const x2 = this.sx(p.x, p.y);
      const y2 = this.sy(p.x, p.y) - 22 * ZP;
      const pulse = 0.65 + 0.35 * Math.sin(this.time * 14);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      g.strokeStyle = self ? `rgba(255,60,40,${(0.35 * pulse).toFixed(3)})` : `rgba(255,170,90,${(0.22 * pulse).toFixed(3)})`;
      g.lineWidth = self ? 7 : 5;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      g.strokeStyle = self ? `rgba(255,200,170,${(0.85 * pulse).toFixed(3)})` : `rgba(255,220,180,${(0.6 * pulse).toFixed(3)})`;
      g.lineWidth = self ? 2 : 1.4;
      g.setLineDash([8, 6]);
      g.lineDashOffset = -this.time * 60;
      g.stroke();
      g.restore();
    }
    if (lockedBy && lockedBy !== this.lockedBy) {
      this.lockedAt = this.time;
      this.onLaneLock?.();
    }
    this.lockedBy = lockedBy;
  }
  /** Breachway: called once when a turret locks onto your hero (audio hook, set by main.ts). */
  onLaneLock?: () => void;

  /** Breachway, HUD pass: "+N gold" over your hero, and the lock warning over any hero a turret is shooting. */
  private drawLaneHudMarks(v: View) {
    const g = this.g;
    for (const m of v.monsters.values()) {
      if (!m.fc || m.hp <= 0) continue;
      const p = v.players.get(m.fc);
      if (!p || !p.alive || !this.onScreen(p.x, p.y)) continue;
      const self = p.id === v.selfId;
      const x = this.sx(p.x, p.y);
      const pop = self ? Math.max(0, 1 - (this.time - this.lockedAt) / 0.3) : 0;
      const y = this.plateY(p) - (self ? 15 : 12) - Math.sin(this.time * 6);
      const s = (self ? 6.5 : 4.5) * (1 + pop * 0.6);
      const a = 0.75 + 0.25 * Math.sin(this.time * 12);
      g.save();
      g.globalAlpha = a;
      g.fillStyle = self ? "#ff3b2a" : "#ff9a4a";
      g.strokeStyle = "#140806";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y - s * 1.6);
      g.lineTo(x + s, y);
      g.lineTo(x - s, y);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      skinText(g, "!", x, y - s * 1.35, { size: s * 0.95, face: "display", align: "center", color: "#1a0a06", weight: 700 });
      if (self) skinText(g, trf("Spire targeting you"), x, y - s * 1.6 - 7, { size: 4.6, face: "body", align: "center", color: "#ff8a70", alpha: a });
    }
    const me = v.self;
    if (!me || !this.goldPops.length) return;
    let k = 0;
    for (const gp of this.goldPops) {
      const tt = gp.t / GOLD_POP_LIFE;
      const x = this.sx(me.x, me.y) + 16;
      const y = this.sy(me.x, me.y) - this.up(28 * ZP + gp.t * 26) - k * 9;
      const alpha = Math.max(0, Math.min(1, 1.25 - tt * 1.25));
      const sc = 1 + 0.3 * Math.max(0, 1 - gp.t / 0.15);
      const text = trf("+{n} gold", { n: gp.n });
      const size = 6 * sc;
      const cr = 2.6 * sc;
      const tw = skinTextW(text, { size, face: "display" });
      const cx = x - tw / 2 - cr - 1.5;
      const cy = y - size * 0.55;
      g.save();
      g.globalAlpha = alpha;
      const cg = g.createRadialGradient(cx - cr * 0.3, cy - cr * 0.3, 0, cx, cy, cr);
      cg.addColorStop(0, "#fff2b0");
      cg.addColorStop(0.6, "#f0c040");
      cg.addColorStop(1, "#8a6010");
      g.fillStyle = cg;
      g.strokeStyle = "#2a1c06";
      g.lineWidth = 0.6;
      g.beginPath();
      g.arc(cx, cy, cr, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
      skinText(g, text, x, y - size, { size, face: "display", align: "center", color: "#ffd24a", alpha, weight: 700 });
      k++;
    }
  }

  /** Breachway structures: existing painted props on a team-coloured rune ring (no new art). */
  private drawStructure(m: MonsterSnap) {
    if (m.hp <= 0) return; // fallen: drawCollapse / drawRubble
    const g = this.g;
    const x = this.sx(m.x, m.y);
    const y = this.sy(m.x, m.y);
    const col = TEAM_COLORS[m.tm ?? 0];
    const R = (m.r + 18) * K;
    g.save();
    g.translate(x, y);
    g.scale(1, SQ);
    const gr = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    gr.addColorStop(0, col + "55");
    gr.addColorStop(0.8, col + "33");
    gr.addColorStop(1, col + "00");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = 3;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(0, 0, R * 0.8, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    const prop = STRUCT_PROP[m.k] ?? ["bs_obelisk", 1];
    const flashT = this.flashes.get("m:" + m.id) ?? 0;
    if (!drawProp(g, prop[0], x, y, ART_PX * prop[1], { alpha: flashT > 0 ? 0.8 : 1 })) {
      // Fallback: a plain drawn pillar.
      g.fillStyle = "#4a4650";
      g.fillRect(x - m.r * K * 0.4, y - m.r * K * 2.2, m.r * K * 0.8, m.r * K * 2.2);
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y - m.r * K * 2.3, m.r * K * 0.35, 0, Math.PI * 2);
      g.fill();
    }
    // The beacon on top: team colour, brighter while it is shooting soon.
    g.save();
    g.globalCompositeOperation = "lighter";
    const top = y - (m.k === "lane_core" ? 150 : m.k === "lane_ward" ? 100 : 170) * (K / 1.0) * 0.5;
    const pulse = 1 + Math.sin(this.time * 4 + m.id) * 0.15;
    const bg = g.createRadialGradient(x, top, 0, x, top, 22 * pulse);
    bg.addColorStop(0, "#ffffffcc");
    bg.addColorStop(0.35, col + "aa");
    bg.addColorStop(1, col + "00");
    g.fillStyle = bg;
    g.beginPath();
    g.arc(x, top, 22 * pulse, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  private drawMonster(m: MonsterSnap) {
    if (m.tm !== undefined && isStructKind(m.k)) return this.drawStructure(m);
    if (m.tm !== undefined) this.drawTeamRing(m);
    const mo = this.motion.get("m:" + m.id);
    const dir = dir8(m.a);
    let anim: MonAnim = "idle";
    let frame = Math.floor(this.time * 4 + m.id * 0.37) % 4;
    if (m.s === 2) {
      anim = "windup";
      frame = Math.max(0, Math.min(3, Math.floor(m.w * 4)));
    } else if (mo && mo.strikeT < 0.27) {
      anim = "strike";
      frame = Math.min(2, Math.floor(mo.strikeT / 0.09));
    } else if (mo && mo.speed > 25) {
      anim = "move";
      const stride = m.k === "cragback" ? 14 : m.k === "gnashling" ? 9 : 8;
      frame = Math.floor(mo.phase / stride) % 6;
    }
    // engine: hit flash is a warm additive overlay drawn below (frames are fetched without their own white flash)
    const flashT = this.flashes.get("m:" + m.id) ?? 0;
    const s = this.exileFrame(m, mo, false) ?? this.paintedMonster(m, anim, mo, false) ?? smoothMonsterFrame(m.k, m.r, dirN(m.a, DIRS), anim, frame, false) ?? monsterFrame(m.k, m.r, m.e, dir, anim, frame, false);
    // Windup jitter for the Cragback makes the slam extra readable.
    const jx = m.s === 2 && m.k === "cragback" && m.w > 0.6 ? (Math.floor(this.time * 30) % 2 ? 1 : -1) : 0;
    // engine: procedural motion (windup pull-back, strike lunge, knockback slide; bob / lean / squash on painted frames)
    const lunge = m.s === 2 ? -0.35 * m.w : mo && mo.strikeT < 0.27 ? Math.sin(Math.PI * Math.min(1, mo.strikeT / 0.27)) : 0;
    const mass = this.monMass(m);
    const fp = this.feelPose("m:" + m.id, isPaintedSprite(s), m.a, lunge, mass, m.k === "cragback" ? 20 : 13);
    const rs = this.rarityScale(m);
    const g = this.g;
    g.save();
    g.translate(this.sx(m.x + fp.ox, m.y + fp.oy) + jx, this.sy(m.x + fp.ox, m.y + fp.oy) - fp.lift);
    g.transform(fp.a * rs, 0, fp.c * rs, fp.d * rs, 0, 0);
    drawActorBacking(g, s, 0, 0, 0.7 / rs, 0.8, 0.3, "rgb(188,200,222)"); // engine: dark outline + pale rim so monsters read on dark / bloody ground (firmer outline, neutral rim: the saturated blue one read as a cut-out fringe on warm fur and bark, and did not match the 3D hero)
    this.blit(s, 0, 0);
    if (flashT > 0) drawWarmFlash(g, s, 0, 0, flashT / FLASH_TIME);
    const tn = ailTint(m.st, this.time); // combat-systems: ailment tint
    if (tn) drawTint(this.g, s, 0, 0, tn.color, tn.a);
    drawAilFx(this.g, m.st, s, 0, 0, this.time, m.id);
    g.restore();
  }

  private drawProj(p: ProjSnap) {
    const { g } = this;
    const x = this.sx(p.x, p.y);
    const y = this.sy(p.x, p.y) - 17;
    const pulse = 1 + Math.sin(this.time * 18) * 0.12;
    const gr = g.createRadialGradient(x, y, 0, x, y, 7 * pulse);
    gr.addColorStop(0, "rgba(245,255,225,1)");
    gr.addColorStop(0.3, "rgba(160,250,110,0.9)");
    gr.addColorStop(0.65, "rgba(60,150,40,0.35)");
    gr.addColorStop(1, "rgba(40,120,30,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, 7 * pulse, 0, Math.PI * 2);
    g.fill();
  }

  private drawGroundItem(gi: GroundView) {
    const { g } = this;
    const x = this.sx(gi.x, gi.y);
    const y = this.sy(gi.x, gi.y);
    const r = gi.item?.r ?? 0;
    // game feel: a fresh drop hops out of the kill and lands; magic and better glint as they land
    const age = this.time - (this.groundBorn.get(gi.g) ?? -9);
    const hopK = age < DROP_HOP_TIME ? age / DROP_HOP_TIME : 1;
    const hop = hopK < 1 ? Math.sin(hopK * Math.PI) * DROP_HOP_H : 0;
    const hopS = hopK < 1 ? 0.55 + 0.45 * hopK : 1;
    g.globalAlpha = (r === 0 ? 0.12 : 0.22) * hopK;
    this.ell(x, y, 12, 9, RARITY_BEAM[r], null);
    const gl = age - DROP_HOP_TIME;
    if (r > 0 && gl >= 0 && gl < DROP_GLINT_TIME) {
      const k = gl / DROP_GLINT_TIME;
      g.globalAlpha = 0.55 * (1 - k);
      this.ell(x, y, 12 + 16 * k, 9 + 12 * k, null, RARITY_BEAM[r]);
    }
    g.globalAlpha = 1;
    if (gi.item) {
      // Smooth item art, lying flat on the ground (squashed, slightly turned) over a soft shadow.
      const key = gi.g + "|" + gi.item.b;
      let cv = groundArt.get(key);
      if (!cv) {
        if (groundArt.size > 300) groundArt.clear();
        cv = itemArtCanvas(gi.item, 40, 40);
        groundArt.set(key, cv);
      }
      const rot = ((gi.g * 2654435761) % 1000) / 1000 * 1.2 - 0.6;
      g.save();
      g.translate(x, y + 1);
      g.scale(1, SQ);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.beginPath();
      g.arc(0.5, 1.5, 7.5 * hopS, 0, Math.PI * 2);
      g.fill();
      if (hop > 0) g.translate(0, -hop / SQ);
      g.rotate(rot + (1 - hopK) * 2.4);
      if (hopS < 1) g.scale(hopS, hopS);
      const ic = iconImage(gi.item.b); // engine-sprites: painted item icon when one exists
      if (ic) g.drawImage(ic, -9, -9, 18, 18);
      else g.drawImage(cv, -8, -8, 16, 16);
      g.restore();
    }
  }

  /** Rarity light beam, drawn above the darkness so loot can be spotted from afar. */
  private drawLootBeam(gi: GroundView) {
    const { g } = this;
    const x = this.sx(gi.x, gi.y);
    const y = this.sy(gi.x, gi.y);
    const r = gi.item?.r ?? 0;
    const cur = !!gi.item && CURRENCY_BY_ID.has(gi.item.b);
    const col = cur ? "#e0a850" : RARITY_BEAM[r];
    const h = r === 3 ? 120 : cur ? 90 : r === 2 ? 80 : r === 1 ? 50 : 16;
    const flick = 0.85 + 0.15 * Math.sin(this.time * 6 + gi.g);
    const gr = g.createLinearGradient(x, y - 4, x, y - 4 - h);
    gr.addColorStop(0, col);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    const wd = r > 0 || cur ? 2.4 : 1;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = (r === 0 && !cur ? 0.25 : 0.6) * flick;
    g.fillStyle = gr;
    g.fillRect(x - wd / 2, y - 4 - h, wd, h);
    g.globalAlpha *= 0.4;
    g.fillRect(x - wd * 1.5, y - 4 - h * 0.7, wd * 3, h * 0.7);
    g.restore();
  }

  /** Screen point for a world point at height z (old-pixel units). */
  private spt(wx: number, wy: number, z: number): [number, number] {
    return [this.sx(wx, wy), this.sy(wx, wy) - z * ZP];
  }

  /**
   * Tapered glowing ribbon through screen points (tail -> head): width grows from 0 to w at the head,
   * colour fades in from the tail; drawn additively with a soft glow.
   */
  private ribbon(pts: [number, number][], w: number, core: string, glow: string, alpha = 1) {
    if (pts.length < 2) return;
    const g = this.g;
    const L: [number, number][] = [];
    const R: [number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(b[1] - a[1]);
      let ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      const t = i / (pts.length - 1);
      const hw = (w / 2) * Math.pow(t, 0.8) * (t > 0.92 ? (1 - t) / 0.08 * 0.6 + 0.4 : 1);
      L.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
      R.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
    }
    const t0 = pts[0];
    const t1 = pts[pts.length - 1];
    const gr = g.createLinearGradient(t0[0], t0[1], t1[0], t1[1]);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.55, glow);
    gr.addColorStop(1, core);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = alpha;
    g.shadowColor = glow;
    g.shadowBlur = 6 * this.Z;
    g.fillStyle = gr;
    g.beginPath();
    L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    g.fill();
    // Hot core line along the leading half.
    g.shadowBlur = 0;
    g.strokeStyle = core;
    g.lineWidth = Math.max(0.4, w * 0.12);
    g.lineCap = "round";
    g.beginPath();
    const h0 = Math.floor(pts.length * 0.55);
    for (let i = h0; i < pts.length; i++) (i === h0 ? g.moveTo(pts[i][0], pts[i][1]) : g.lineTo(pts[i][0], pts[i][1]));
    g.stroke();
    g.restore();
  }

  private drawSlash(p: PlayerSnap) {
    if (p.atkT <= 0) return;
    const sp = currentPose(p.id);
    if (sp?.clip !== undefined && !sp.weak) return; // a skill is in use: it draws its own effect (gfx/skills.ts)
    // The trail starts just before the commit point (where the hit lands) and finishes in the follow-through.
    const raw = 1 - p.atkT / Math.max(0.05, p.swingTime);
    const prog = Math.max(0, Math.min(1, (raw - (ATTACK_COMMIT - 0.12)) / 0.5));
    if (prog <= 0) return;
    const fadeOut = prog > 0.8 ? (1 - prog) / 0.2 : 1;
    const reach = PLAYER_RADIUS + p.atkRange;
    const wk = p.wk;
    // Tint by weapon (cool steel, warm axe edge, pale thrusts).
    const tint = wk === "axe" ? ["rgba(255,236,200,0.95)", "rgba(255,140,60,0.55)"] : wk === "spear" || wk === "dagger" ? ["rgba(235,245,255,0.95)", "rgba(140,190,255,0.5)"] : ["rgba(240,246,255,0.95)", "rgba(150,180,255,0.5)"];
    if (wk === "spear" || wk === "dagger") {
      const k = wk === "spear" ? Math.max(0, Math.min(1, (prog - 0.25) / 0.35)) : Math.sin(Math.min(1, prog * 1.15) * Math.PI);
      if (k <= 0) return;
      const tip = reach * (0.45 + 0.55 * k);
      const offs = wk === "dagger" ? [-0.18, 0.12] : [0];
      for (const o of offs) {
        const a = p.angle + o;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const pts: [number, number][] = [];
        for (let i = 0; i <= 10; i++) {
          const d = PLAYER_RADIUS * 0.8 + ((tip - PLAYER_RADIUS * 0.8) * i) / 10;
          pts.push(this.spt(p.x + ca * d, p.y + sa * d, 14));
        }
        this.ribbon(pts, wk === "spear" ? 5 : 3.5, tint[0], tint[1], fadeOut);
      }
      return;
    }
    if (wk === "axe") {
      // Overhead chop: a vertical crescent in front of the body, thick at the head.
      const b1 = Math.min(1, prog * 1.2) * 2.3;
      const b0 = Math.max(0, b1 - 1.4);
      const ca = Math.cos(p.angle);
      const sa = Math.sin(p.angle);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 16; i++) {
        const b = b0 + ((b1 - b0) * i) / 16;
        const d = PLAYER_RADIUS * 0.4 + reach * 0.65 * Math.sin(Math.min(Math.PI / 2, b * 0.75));
        const z = 34 * Math.cos(b * 0.7) + 2;
        pts.push(this.spt(p.x + ca * d, p.y + sa * d, z));
      }
      this.ribbon(pts, 9, tint[0], tint[1], fadeOut);
      return;
    }
    // Sword / unarmed: a wide crescent following the blade; alternate swings sweep the other way.
    const arc = p.atkArc;
    const flip = (this.swingParity.get(p.id)?.n ?? 0) % 2 ? -1 : 1;
    const start = p.angle + (flip * arc) / 2;
    const swept = arc * Math.min(1, prog * 1.25);
    const tail = Math.min(arc * 0.75, swept);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 18; i++) {
      const a = start - flip * (swept - tail + (tail * i) / 18);
      pts.push(this.spt(p.x + Math.cos(a) * reach * 0.86, p.y + Math.sin(a) * reach * 0.86, 13));
    }
    this.ribbon(pts, reach * 0.22, tint[0], tint[1], fadeOut);
  }

  private drawParticles() {
    const { g } = this;
    for (const p of this.parts) {
      const k = p.t / p.life;
      g.fillStyle = p.c2 && k > 0.6 ? p.c2 : p.c;
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      g.beginPath();
      g.arc(this.sx(p.x, p.y), this.sy(p.x, p.y) - p.z * ZP, (p.s + 1) * 0.55, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  private drawRing(r: Ring) {
    const k = r.t / r.life;
    const rad = r.r * (0.35 + 0.75 * k);
    this.g.globalAlpha = 1 - k;
    this.isoEllipse(r.x, r.y, rad, null, r.color);
    this.isoEllipse(r.x, r.y, rad * 0.92, null, r.color2, true);
    if (k < 0.25) this.isoEllipse(r.x, r.y, rad * 0.6, "rgba(255,240,200,0.35)", null);
    this.g.globalAlpha = 1;
  }

  // ---- labels ---------------------------------------------------------------

  private bar(x: number, y: number, w: number, frac: number, color: string) {
    // worldui: smooth two-tone bar in a dark iron frame (native-res HUD pass); same footprint as before.
    if (this.g === this.hg) drawWorldBar(this.g, x, y, w, 2, frac, color);
    else {
      const { g } = this;
      g.fillStyle = "#050405";
      g.fillRect(x - 1, y - 1, w + 2, 4);
      g.fillStyle = "#2a1414";
      g.fillRect(x, y, w, 2);
      g.fillStyle = color;
      g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 2);
    }
  }

  private plateText: (() => void)[] = []; // loop19: queued plate text (drawn after all bars)
  private selfPlate: PlateRect | undefined; // loop21: your own name / life plate this frame
  private hudR: PlateRect[] = []; // loop19: HUD-owned rects this frame (plates never land in them)
  private plates: PlateRect[] = []; // polish: nameplates placed this frame (stacked to avoid overlap)

  private drawMonsterLabel(m: MonsterSnap, focus = false, mods = true, bare = false) {
    const mb = getSettings().interface.monsterBars;
    const damaged = mb === "always" || (mb === "damaged" && m.hp < m.mhp);
    if (m.st) {
      // combat-systems: ailment icons + buildup meters
      const t0 = (m.k === "cragback" ? 52 : m.k === "bog_seer" ? 30 : 20) * (m.r / (MONSTER_BY_ID.get(m.k)?.radius ?? m.r)) * ZP * 1.12 + 10;
      drawStatus(this.g, m.st, this.sx(m.x, m.y), this.sy(m.x, m.y) - this.up(t0) - (m.e ? 24 : 4), 1, this.time);
    }
    if (drawMonLabel(this.monFx(), m, damaged, this.up((smoothTop(m.k, m.r) ?? (m.k === "cragback" ? 52 : m.k === "bog_seer" ? 30 : 20) * ZP * 1.12) + 10), { focus, plates: this.plates, mods, bare, hud: this.hudR, defer: this.plateText, self: this.selfPlate })) return; // monsters agent: rarity nameplates (polish: smooth, decluttered)
    if (!damaged && !m.e) return;
    const top = m.k === "cragback" ? 52 : m.k === "bog_seer" ? 30 : 20;
    const sc = m.r / (MONSTER_BY_ID.get(m.k)?.radius ?? m.r);
    const x = this.sx(m.x, m.y);
    const y = this.sy(m.x, m.y) - this.up(top * sc * ZP * 1.12 + 10);
    const bw = Math.max(16, this.up(m.r * 1.3));
    if (damaged) this.bar(x - Math.floor(bw / 2), y, bw, m.hp / m.mhp, m.e ? "#e8a03a" : "#c8402e");
    if (m.e) {
      const c = ELITE_COLORS[m.e[0]] ?? "#ffcc66";
      skinText(this.g, m.n ?? "", x, y - 17, { size: 5, face: "display", align: "center", color: "#ffd27a" }); // worldui: smooth serif
      const mods = m.e.map((id) => ELITE_MOD_BY_ID.get(id)?.name ?? id).join(" ");
      skinText(this.g, mods, x, y - 9, { size: 4.2, face: "body", align: "center", color: c });
    }
  }

  /** Overhead nameplate y (HUD pass): just above the head. */
  private plateY(p: PlayerSnap): number {
    // integrate: painted heroes are HERO_H tall, so sit the nameplate just above the head
    const painted = actorSprite(heroSpriteId(p.wk), "idle", 0, 0) !== null;
    return this.sy(p.x, p.y) - this.up(painted ? HERO_H + 14 : 68 * ZP); // loop17: +4 so the raised sword hilt clears the bar // 3D hero stands 49 tall (taller than the painted 45), so clear its head
  }

  private drawLabel(p: PlayerSnap, isSelf: boolean) {
    const g = this.g;
    const x = this.sx(p.x, p.y);
    const y = this.plateY(p);
    const frac = Math.max(0, p.hp / (p.maxHp || 100));
    // worldui: smooth life bar with an energy-shield strip, dim "Lv N" + name in the serif face
    const esm = p.esm ?? 0;
    drawWorldBar(g, x - 11, y, 22, 2.2, frac, frac > 0.5 ? HP_GREEN : frac > 0.25 ? "#e0b030" : "#e03a2a", esm > 0 ? (p.es ?? 0) / esm : -1);
    const size = 4.4;
    const lv = p.lv ? `Lv ${p.lv}  ` : "";
    const lvW = lv ? skinTextW(lv, { size: size * 0.82, face: "body" }) : 0;
    const nameW = skinTextW(p.name, { size, face: "body" });
    const lx = x - (lvW + nameW) / 2;
    this.plates.push({ x: Math.min(lx, x - 15) - 1, y: y - size - 3.5, w: Math.max(lvW + nameW, 28) + 2, h: size + 7.5 }); // loot labels keep off name plates
    if (lv) skinText(g, lv, lx, y - size - 2.6 + size * 0.14, { size: size * 0.82, face: "body", color: "#9a8f7a" });
    skinText(g, p.name, lx + lvW, y - size - 2.6, { size, face: "body", color: isSelf ? "#ffe9a8" : "#e8e2d4" });
    if (p.st) drawStatus(g, p.st, x, y - 13, 1, this.time); // combat-systems
    // Colour pip so the scarf colour is readable in the label too
    g.save();
    g.beginPath();
    g.arc(x - 13.6, y + 1.1, 1.2, 0, Math.PI * 2);
    g.fillStyle = p.color;
    g.fill();
    g.lineWidth = 0.35;
    g.strokeStyle = "rgba(4,3,4,0.95)";
    g.stroke();
    g.restore();
  }

  /** worldui: Alt held -> ring + dark-box name over trial shrines, ring over buff shrines (their names are drawn by monsters_fx). */
  private drawInteractHighlights() {
    const g = this.g;
    const ring = (x: number, y: number, r: number, col: string) => {
      const cx = this.sx(x, y);
      const cy = this.sy(x, y);
      const rx = this.up(r * K);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.beginPath();
      g.ellipse(cx, cy, rx, rx * SQ, 0, 0, Math.PI * 2);
      g.lineWidth = 0.6;
      g.strokeStyle = col;
      g.globalAlpha = 0.55 + 0.2 * Math.sin(this.time * 3);
      g.stroke();
      g.restore();
    };
    for (const s of progState.shrines) {
      if (!this.onScreen(s.x, s.y, 80)) continue;
      const col = s.s === 2 ? "#8a8478" : s.s === 1 ? "#ff8a6a" : "#8cc0ff";
      ring(s.x, s.y, 48, col);
      drawInteractLabel(g, this.sx(s.x, s.y), this.sy(s.x, s.y) - this.up(70), s.s === 2 ? "Trial Shrine (spent)" : s.s === 1 ? "Trial Shrine (active)" : "Trial Shrine", col);
    }
    for (const p of getPois("buff")) if (this.onScreen(p.x, p.y, 80)) ring(p.x, p.y, 34, "#e0c070");
  }

  /** worldui: hovered hostile (monster / other player) under the cursor, refreshed every HUD pass. */
  private hoverEnt: { m: boolean; id: number; col: string; x: number; y: number } | null = null;
  private hoverInteract = false;

  /** What the cursor is over in the world (main.ts maps it to a cursor): null = nothing of note. */
  hoverKind(): "enemy" | "interact" | null {
    if (!input.overCanvas) return null;
    return this.hoverEnt ? "enemy" : this.hoverInteract ? "interact" : null;
  }

  /** Aim: world feet of the hostile under the cursor (the cursor sits on its body, above the ground point). */
  hoverAimPoint(): { x: number; y: number } | null {
    return input.overCanvas && this.hoverEnt ? { x: this.hoverEnt.x, y: this.hoverEnt.y } : null;
  }

  private pickHover(v: View) {
    this.hoverEnt = null;
    this.hoverInteract = false;
    if (!input.overCanvas) return;
    const mx = (input.mouseX * this.dpr) / this.hudScale;
    const my = (input.mouseY * this.dpr) / this.hudScale;
    let bestD = Infinity;
    const consider = (x: number, y: number, r: number, tall: number, m: boolean, id: number, col: string) => {
      const dx = mx - this.sx(x, y);
      const dy = this.sy(x, y) - my; // the body is above the feet
      const hw = Math.max(5, this.up(r * K * 1.15));
      if (Math.abs(dx) > hw || dy < -3 || dy > Math.max(10, this.up(tall))) return;
      const d = dx * dx + dy * dy * 0.25;
      if (d < bestD) {
        bestD = d;
        this.hoverEnt = { m, id, col, x, y };
      }
    };
    for (const m of v.monsters.values()) {
      if (m.hp <= 0 || !this.onScreen(m.x, m.y)) continue;
      const col = m.rr === 3 ? "#d8873a" : m.rr === 2 ? "#ffe066" : m.rr === 1 ? "#8a9cff" : "#e8d8b0";
      consider(m.x, m.y, m.r, (smoothTop(m.k, m.r) ?? 20 * ZP * 1.12) + 4, true, m.id, col);
    }
    for (const p of v.players.values()) {
      if (!p.alive || p.id === v.selfId || !this.onScreen(p.x, p.y)) continue;
      consider(p.x, p.y, PLAYER_RADIUS, HERO_H, false, p.id, "#ff6a50");
    }
    if (this.hoverEnt) return;
    const near = (x: number, y: number, r: number) => {
      const dx = mx - this.sx(x, y);
      const dy = my - this.sy(x, y);
      const rx = Math.max(6, this.up(r * K));
      return (dx * dx) / (rx * rx) + (dy * dy) / (rx * rx * 0.6) <= 1 || (Math.abs(dx) < rx * 0.5 && dy < 0 && dy > -this.up(60));
    };
    for (const s of progState.shrines) if (s.s !== 2 && near(s.x, s.y, 48)) this.hoverInteract = true;
    if (!this.hoverInteract) for (const p of getPois("buff")) if (near(p.x, p.y, 34)) this.hoverInteract = true;
  }

  /** worldui: soft rarity-tinted ground ring under the hovered hostile (world pass, under the sprites). */
  private drawHoverRing(v: View) {
    const h = this.hoverEnt;
    if (!h || !input.overCanvas) return;
    const e = h.m ? v.monsters.get(h.id) : v.players.get(h.id);
    if (!e || !this.onScreen(e.x, e.y)) return;
    const r = (h.m ? (e as MonsterSnap).r : PLAYER_RADIUS) * 1.25;
    const g = this.g;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.18;
    this.isoEllipse(e.x, e.y, r * 1.1, h.col, null);
    g.globalAlpha = 0.7;
    this.isoEllipse(e.x, e.y, r, null, h.col);
    g.restore();
  }

  /** Interface options: always-show toggle (else only while the show-labels key is held) and the rarity filter. */
  private labelVisible(item: Item): boolean {
    const ui = getSettings().interface;
    if (input.showLabels) return true;
    if (!ui.alwaysShowLabels) return false;
    // Loot filter (options.ts Interface > Items): minimum gear rarity + per-category toggles.
    const cat = itemCategory(item);
    if (cat === "gear") return item.r >= (ui.lootMinRarity ?? 0);
    if (cat === "gem") return ui.lootGems !== false;
    if (cat === "flask" || cat === "charm") return ui.lootFlasks !== false;
    if (cat === "currency") return ui.lootEmbers !== false;
    return true;
  }

  /** Item name labels (also used for hover / click hit-testing, in low-res pixels). */
  private drawLootLabels(v: View) {
    // worldui: native-res dark-box labels (serif text in the loot-filter colour), stacked column-wise
    // around the item: up to 4 rows above it, then alternating right / left columns, then upward.
    const { g } = this;
    this.labels = [];
    const GAP = 0.8;
    // Labels never sit on the HUD (minimap, bars, feed, top-centre column, banners) or on a name plate:
    // those rects are obstacles, and a label is pushed to the nearest free spot around its item.
    const blocked: PlateRect[] = [...laneRects(getHudLayout()), ...this.plates];
    if (v.self?.alive) {
      // ... nor on your own hero: a drop at your feet opens around the body instead of covering it
      const hx = this.sx(v.self.x, v.self.y);
      const hy = this.sy(v.self.x, v.self.y);
      blocked.push({ x: hx - 6, y: hy - this.up(HERO_H), w: 12, h: this.up(HERO_H) + 1 });
    }
    const hits = (l: PlateRect, r: PlateRect) => l.x < r.x + r.w + GAP && r.x < l.x + l.w + GAP && l.y < r.y + r.h + GAP && r.y < l.y + l.h + GAP;
    let pipHits = 0; // leading entries of this.labels that are pip hit rects (labels may cover them)
    const clash = (r: PlateRect) => this.labels.some((l, i) => i >= pipHits && hits(l, r)) || blocked.some((l) => hits(l, r));
    let shown = v.ground.filter((gi) => gi.item && this.onScreen(gi.x, gi.y, 40) && this.labelVisible(gi.item));
    // Loot explosions (boss kill, full-loot player death): past LOOT_LABEL_CAP labels only the most
    // valuable keep a label; the rest are small pips in the label colour on the item. Holding the
    // show-labels key (Alt) shows every label, and the item under the cursor always shows its own.
    if (shown.length > LOOT_LABEL_CAP && !input.showLabels) {
      const me = v.self;
      const dist = (gi: GroundView) => (me ? Math.hypot(gi.x - me.x, gi.y - me.y) : 0);
      const ranked = [...shown].sort((a, b) => lootLabelRank(b.item!) - lootLabelRank(a.item!) || dist(a) - dist(b) || a.g - b.g);
      const keep = new Set(ranked.slice(0, LOOT_LABEL_CAP).map((gi) => gi.g));
      const mx = input.overCanvas ? (input.mouseX * this.dpr) / this.hudScale : -1e9;
      const my = (input.mouseY * this.dpr) / this.hudScale;
      const pips: { gi: GroundView; r: LabelRect }[] = [];
      let hov: GroundView | null = null;
      let hovD = Infinity;
      for (const gi of shown) {
        if (keep.has(gi.g)) continue;
        const px = this.sx(gi.x, gi.y);
        const py = this.sy(gi.x, gi.y);
        const r = { g: gi.g, x: px - PIP_HIT, y: py - PIP_HIT, w: PIP_HIT * 2, h: PIP_HIT * 2 };
        pips.push({ gi, r });
        const d = Math.hypot(mx - px, my - py);
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h && d < hovD) {
          hov = gi;
          hovD = d;
        }
      }
      // the label being hovered (last frame) keeps its item labelled while the cursor is on it
      if (!hov && v.hoverG >= 0 && !keep.has(v.hoverG)) hov = pips.find((p) => p.gi.g === v.hoverG)?.gi ?? null;
      if (hov) keep.add(hov.g);
      for (const { gi, r } of pips) {
        if (gi.g !== hov?.g) this.drawLootPip(r.x + PIP_HIT, r.y + PIP_HIT, labelStyle(gi.item!).text, gi.item!.r);
        this.labels.push(r); // hit rect only: hover / click / walk-to-pickup work on unlabeled items (labels win, they come later)
      }
      pipHits = pips.length;
      shown = shown.filter((gi) => keep.has(gi.g));
    }
    const sorted = shown.sort((a, b) => a.y - b.y);
    for (const gi of sorted) {
      if (!gi.item) continue;
      const text = gi.item.n;
      const st = labelStyle(gi.item);
      const sz = groundLabelSize(text, st);
      const sx = this.sx(gi.x, gi.y);
      const sy = this.sy(gi.x, gi.y);
      const bx = sx - sz.w / 2;
      const by = sy - this.up(30);
      const rect = { g: gi.g, x: bx, y: by, w: sz.w, h: sz.h };
      // Nearest free slot first (LABEL_SLOTS is sorted by distance): rows stack upward, then spread
      // sideways in part-label steps, so a 20+ item pile opens into a readable cloud.
      let placed = false;
      // an item that is on screen keeps its whole label on screen too
      const keepIn = sx > 0 && sx < this.lw && sy > 0 && sy < this.lh;
      for (const s of LABEL_SLOTS) {
        rect.x = bx + s.dx;
        rect.y = by - s.row * (sz.h + GAP);
        if (keepIn && (rect.x < 1 || rect.x + rect.w > this.lw - 1 || rect.y < 1 || rect.y + rect.h > this.lh - 1)) continue;
        if (!clash(rect)) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        rect.x = bx;
        rect.y = by;
      }
      this.labels.push(rect);
      // a faint leader line when the label was pushed well away from its item
      if (Math.abs(rect.x - bx) > 0.5 || Math.abs(rect.y - by) > 3 * (sz.h + GAP)) {
        g.save();
        g.strokeStyle = "rgba(232,216,176,0.22)";
        g.lineWidth = 0.35;
        g.beginPath();
        g.moveTo(sx, sy - 2);
        g.lineTo(rect.x + rect.w / 2, rect.y + rect.h);
        g.stroke();
        g.restore();
      }
      const inRange = v.self ? Math.hypot(v.self.x - gi.x, v.self.y - gi.y) <= PICKUP_RANGE : false;
      drawGroundLabel(g, rect, text, st, { hover: v.hoverG === gi.g, inRange, pending: v.pendingG === gi.g, time: this.time });
    }
  }

  /** Unlabeled ground item marker: a small diamond in the item's label colour (HUD units). */
  private drawLootPip(x: number, y: number, col: string, rarity: number) {
    const { g } = this;
    const s = rarity >= 2 ? 2.1 : 1.7;
    g.save();
    g.beginPath();
    g.moveTo(x, y - s);
    g.lineTo(x + s, y);
    g.lineTo(x, y + s);
    g.lineTo(x - s, y);
    g.closePath();
    g.fillStyle = col;
    g.fill();
    g.lineWidth = 0.6;
    g.strokeStyle = "rgba(10,8,7,0.9)";
    g.stroke();
    g.restore();
  }

  // ---- HUD ---------------------------------------------------------------

  private drawHud(v: View) {
    const { g, lw, lh } = this;
    if (this.mapOverlayOpen && !this.bigMapOpen) this.drawMapOverlay(v); // under the rest of the HUD
    const cx = Math.floor(lw / 2);

    if (v.phase === "waiting") {
      // Practice status is shown by the HUD info cluster (hud/royale.ts); drawing it here overlapped the target bar.
    } else if (v.phase === "countdown") {
      // polish: smooth serif banners, well above the hero; each new digit eases in (fade + slight shrink).
      const top = Math.floor(lh / 2) - 118;
      laneClaim("round", { x: cx - 100, y: 0, w: 200, h: top + 46 });
      this.drawBand(cx, top - 4, 46);
      skinTitle(g, "The Round Begins", cx, top, 9, "center", "#efe2c4", "#9c8a66");
      const n = Math.max(1, Math.ceil(v.phaseLeft));
      const age = Math.max(0, Math.min(1, (n - v.phaseLeft) / 0.35)); // 0 -> 1 over the first 0.35 s of each digit
      const e = 1 - (1 - age) ** 3;
      this.scaledTitle(String(n), cx, top + 13, 24, 1.25 - 0.25 * e, e, "#ffcfb0", "#a0241a");
    } else if (v.phase === "ended") {
      const top = Math.floor(lh / 2) - 72; // under hud/royale's "Last One Standing" (cy - 100)
      laneClaim("round", { x: cx - 110, y: 0, w: 220, h: top + 40 }); // down to under the "continue" line (it stopped at top + 27 and ground loot labels sat on that line)
      this.drawBand(cx, top - 4, 44);
      skinTitle(g, v.winner ? `${v.winner} Prevails` : "None Survived", cx, top, 15, "center", "#ffe6b0", "#b0601c");
      skinText(g, `Next round in ${Math.ceil(v.phaseLeft)}`, cx, top + 20, { size: 7, face: "display", align: "center", color: "#d8ccb0" });
      skinText(g, "Click or press any key to continue", cx, top + 30, { size: 6, face: "display", align: "center", color: "#a89c84" });
    }
    if (this.bannerFlash) {
      laneClaim("round", { x: cx - 70, y: 0, w: 140, h: Math.floor(lh / 2) - 110 + 26 });
      const t = this.bannerFlash.t;
      const inE = 1 - (1 - Math.min(1, t / 0.22)) ** 3; // ease-out in
      const fade = t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.45);
      this.scaledTitle(this.bannerFlash.text === "FIGHT!" ? "Fight!" : this.bannerFlash.text, cx, Math.floor(lh / 2) - 110, 22, 1.18 - 0.18 * inE, inE * fade, "#ffd8b8", "#a8201a");
    }

    // HUD core (client/hud): vitals, belt, status, royale info, killfeed, spectate; replaces the old
    // ALIVE / ping / fps / spectating line / drawPanel / feed / key-hint blocks (kept below as dead code).
    const toHud = (x: number, y: number) => ({ x: this.sx(x, y), y: this.sy(x, y) });
    hudDraw(g, v, this.time, this.hudDt, this.fps, toHud, "under");

    if (!this.mapOverlayOpen && getSettings().interface.showMinimap !== false && !isHudHidden()) this.drawMinimap(v); // hidden while the Tab overlay is open

    {
      // The level-up banner (DOM, prog.ts) in its upper-middle lane, and the interaction prompt above the bottom band.
      const L = getHudLayout();
      const br = progBannerRect(levelBannerTop(L) * L.u);
      if (br) laneClaim("level", { x: br.left / L.u, y: br.top / L.u, w: br.width / L.u, h: br.height / L.u });
      const hint = !isHudHidden() ? shrineHint() : null;
      if (hint) {
        const st = { text: hint.ready ? "#cfe6ff" : "#b8ac98", border: hint.ready ? "#8cc0ff" : null, bg: "rgba(10,8,7,0.86)", scale: 1.35 };
        const sz = groundLabelSize(hint.text, st);
        const r = { x: cx - sz.w / 2, y: L.h - L.bottomBand - 6 - sz.h, w: sz.w, h: sz.h };
        drawGroundLabel(g, r, hint.text, st, { hover: false, inRange: true, pending: false, time: this.time });
        laneClaim("prompt", r);
      }
    }

    hudDraw(g, v, this.time, this.hudDt, this.fps, toHud, "over"); // scoreboard + HUD tooltip
    if (this.bigMapOpen) this.drawBigMap(v); // last, over the feed and HUD
  }

  /** polish: soft dark horizontal band behind a centred banner (legibility over the world). */
  private drawBand(cx: number, y: number, h: number) {
    const g = this.g;
    const band = g.createLinearGradient(cx - 130, 0, cx + 130, 0);
    band.addColorStop(0, "rgba(8,5,5,0)");
    band.addColorStop(0.5, "rgba(8,5,5,0.5)");
    band.addColorStop(1, "rgba(8,5,5,0)");
    g.fillStyle = band;
    g.fillRect(cx - 130, y, 260, h);
  }

  /** polish: smooth serif title scaled about its centre (ease-in banners) at the given alpha. */
  private scaledTitle(s: string, cx: number, y: number, size: number, scale: number, alpha: number, top: string, bot: string) {
    if (alpha <= 0.01) return;
    const g = this.g;
    g.save();
    g.globalAlpha *= Math.min(1, alpha);
    const my = y + size * 0.45;
    g.translate(cx, my);
    g.scale(scale, scale);
    skinTitle(g, s, 0, -size * 0.45, size, "center", top, bot);
    g.restore();
  }

  /** Bottom panel: life globe, flask belt + dodge cooldown, and the (dormant) mana globe. */
  private drawPanel(v: View) {
    const { g, lw, lh } = this;
    const self = v.self!;
    const GR = 19;
    const PW = Math.min(lw - 6, 300);
    const PH = 26;
    const px0 = Math.floor(lw / 2 - PW / 2);
    const py0 = lh - PH;
    g.drawImage(panelSprite(PW, PH), px0, py0 - PANEL_SPIKE);
    const gy = lh - GR - 4;
    const frac = Math.max(0, Math.min(1, self.hp / v.selfStats.maxHp));
    const low = frac < 0.3 && Math.floor(this.time * 4) % 2 === 0;
    this.globe(px0 + GR + 3, gy, frac, low ? "#d0241a" : "#a3140f", 1);
    drawEsGlobe(g, px0 + GR + 3, gy, GR, self.es, self.esm, this.time); // combat-systems: energy shield
    if (getSettings().interface.globeNumbers) drawText(g, `${Math.ceil(self.hp)}`, px0 + GR + 3, gy - 3, "#f2e2cc", "center");
    this.globe(px0 + PW - GR - 4, gy, manaFrac(), "#2a46b0", 0.9); // mana (skillbar.ts)
    if (getSettings().interface.globeNumbers) drawText(g, `${manaNow()}`, px0 + PW - GR - 4, gy - 3, "#dce6ff", "center");

    // Flask belt: a leather strap with three iron-framed slots
    const bx0 = px0 + GR * 2 + 12;
    const bx1 = px0 + PW - GR * 2 - 12;
    g.fillStyle = "#1c120b";
    g.fillRect(bx0, py0 + 7, bx1 - bx0, 6);
    g.fillStyle = "#3a2615";
    g.fillRect(bx0, py0 + 8, bx1 - bx0, 4);
    g.fillStyle = "#5a3d22";
    for (let x = bx0 + 2; x < bx1 - 1; x += 4) g.fillRect(x, py0 + 8, 2, 1);
    const size = 18;
    const gap = 5;
    const fx0 = Math.floor((bx0 + bx1) / 2 - (MAX_FLASK_SLOTS * size + (MAX_FLASK_SLOTS - 1) * gap) / 2);
    for (let i = 0; i < MAX_FLASK_SLOTS; i++) {
      const x = fx0 + i * (size + gap);
      const y = py0 + 1;
      const locked = i >= v.selfStats.flaskSlots;
      const f = v.flasks[i];
      pxFrame(g, x, y, size, size, locked ? "#080708" : "#0f0d10", f && !locked ? RARITY_COLORS[f.r] : "#3c3842");
      if (f && !locked) {
        const props = flaskProps(f, v.selfStats.flaskRecovery);
        const fr = Math.min(1, (f.c ?? 0) / props.maxCharges);
        const usable = (f.c ?? 0) >= props.perUse;
        g.drawImage(flaskIcon(fr, usable), x + 3, y + 3);
        drawText(g, String(Math.floor(f.c ?? 0)), x + size - 2, y + size - 8, "#e8dcc4", "right");
      }
      drawText(g, locked ? "-" : String(i + 1), x + 3, y + 2, locked ? "#4a4248" : "#d8c08a");
    }
    // Dodge cooldown: a thin iron-framed bar along the bottom of the belt
    const dfrac = Math.min(1, 1 - self.rollCd / v.selfStats.dodgeCooldown);
    const dw = bx1 - bx0;
    g.fillStyle = "#050405";
    g.fillRect(bx0 - 1, py0 + 20, dw + 2, 4);
    g.fillStyle = "#101820";
    g.fillRect(bx0, py0 + 21, dw, 2);
    g.fillStyle = dfrac >= 1 ? "#7cc4e4" : "#2c5a74";
    g.fillRect(bx0, py0 + 21, Math.round(dw * dfrac), 2);
    if (dfrac >= 1) {
      g.fillStyle = "#d8f2ff";
      g.fillRect(bx0, py0 + 21, dw, 1);
    }
  }

  private globe(cx: number, cy: number, frac: number, color: string, dim: number) {
    const { g } = this;
    const R = 19;
    const S = R * 2 + 1;
    g.drawImage(globeBack(R), cx - R, cy - R);
    const top = Math.round((1 - frac) * S);
    if (top < S) {
      g.drawImage(globeLiquid(R, color, dim), 0, top, S, S - top, cx - R, cy - R + top, S, S - top);
      if (top > 0) {
        // Rippling surface line
        const dy = top - R;
        const hw = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
        g.fillStyle = dim < 1 ? "#4058a0" : "#ff6a50";
        g.globalAlpha = 0.7;
        const ph = Math.floor(this.time * 6);
        for (let x = -hw; x <= hw; x++) if ((x + ph) % 3 !== 0) g.fillRect(cx + x, cy - R + top, 1, 1);
        g.globalAlpha = 1;
      }
    }
    g.drawImage(globeFrame(R), cx - R - 5, cy - R - 8);
  }

  /**
   * Draw the cached overview with the camera's projection (45-degree turn + ground foreshortening,
   * gfx/iso) so map views line up with the game view. World (wx, wy) lands at screen (ox, oy);
   * k = screen px per projected world unit.
   */
  private drawOverviewIso(ox: number, oy: number, wx: number, wy: number, k: number) {
    const { g } = this;
    const cell = currentMap().cell / MAP_ART_SCALE; // world px per overview px
    const a = isoX(1, 0) * k;
    const b = isoY(1, 0) * k;
    const c = isoX(0, 1) * k;
    const d = isoY(0, 1) * k;
    g.save();
    g.transform(a * cell, b * cell, c * cell, d * cell, ox - (a * wx + c * wy), oy - (b * wx + d * wy));
    g.imageSmoothingEnabled = true;
    g.drawImage(this.overview(), 0, 0);
    g.restore();
  }

  /** Top-right minimap: local window of the cached overview, rotated like the camera; returns its bottom edge. */
  private drawMinimap(v: View): number {
    // royale HUD (hud/minimap.ts): native-res framed map, zoom, facing arrow, fog of war, area name.
    return drawHudMinimap(this.g, v, this.mapApi());
  }

  /** hud/minimap.ts hooks: the cached overview and the current view footprint in world coordinates. */
  private mapApi(): MapApi {
    return {
      overview: () => this.overview(),
      footprint: () =>
        [
          [0, 0],
          [this.ww, 0],
          [this.ww, this.wh],
          [0, this.wh],
        ].map(([a, b]) => unproject(a - this.offX, b - this.offY)),
    };
  }

  /** Translucent full-screen overlay: the overview rotated like the camera, centred on the player. */
  private drawMapOverlay(v: View) {
    // royale HUD (hud/minimap.ts): same opacity / zoom options, plus fog, icons, area / alive / clock block.
    drawHudOverlay(this.g, v, this.mapApi());
  }

  /** Full world map overlay (M / Esc closes), projected like the camera (a diamond). */
  private drawBigMap(v: View) {
    const { g, lw, lh } = this;
    const m = currentMap();
    const boxW = Math.floor(lw * 0.9);
    const boxH = Math.floor(lh * 0.86);
    const bx = Math.floor(lw / 2 - boxW / 2);
    const by = Math.floor(lh / 2 - boxH / 2);
    const projW = isoX(m.w, 0) - isoX(0, m.h);
    const projH = isoY(m.w, m.h) - isoY(0, 0);
    const k = Math.min(boxW / projW, boxH / projH);
    const ox = lw / 2;
    const oy = lh / 2;
    const wx = m.w / 2;
    const wy = m.h / 2;
    g.save();
    g.globalAlpha = 0.9;
    pxFrame(g, bx - 3, by - 3, boxW + 6, boxH + 6, "#07070a", "#6b5739");
    g.globalAlpha = 0.95;
    this.drawOverviewIso(ox, oy, wx, wy, k);
    g.globalAlpha = 1;
    drawBigMapExtras(g, v, ox, oy, wx, wy, k, { x: bx, y: by, w: boxW, h: boxH }); // royale: landmarks, camps, markers, legend, waypoint, self arrow
    drawText(g, m.biome.name.toUpperCase(), bx + 6, by + 6, "#e8e2d4");
    g.restore();
  }

  private drawScoreboard(rowsIn: BoardEntry[], selfId: number) {
    const { g, lw, lh } = this;
    const rows = [...rowsIn].sort((a, b) => b.wins - a.wins || b.kills - a.kills);
    const bw = 200;
    const rh = 10;
    const bh = 28 + rows.length * rh;
    const bx = Math.floor(lw / 2 - bw / 2);
    const by = Math.max(10, Math.floor(lh / 2 - bh / 2));
    pxFrame(g, bx, by, bw, bh, "rgba(14,10,9,0.94)");
    drawText(g, "PLAYER", bx + 8, by + 7, "#9a8f7a");
    drawText(g, "KILLS", bx + 140, by + 7, "#9a8f7a", "right");
    drawText(g, "WINS", bx + bw - 8, by + 7, "#9a8f7a", "right");
    rows.forEach((p, i) => {
      const y = by + 20 + i * rh;
      g.fillStyle = "#050405";
      g.fillRect(bx + 7, y, 5, 5);
      g.fillStyle = p.color;
      g.fillRect(bx + 8, y + 1, 3, 3);
      const col = p.id === selfId ? "#ffe08a" : p.alive ? "#e8e2d4" : "#7a7268";
      drawText(g, p.name, bx + 16, y, col);
      drawText(g, String(p.kills), bx + 140, y, col, "right");
      drawText(g, String(p.wins), bx + bw - 8, y, col, "right");
    });
  }
}

/** PoE2 loot-filter beam: uniques and high-tier (rare-weight) currency. Matches the "loot.currency.rare" sound rule. */
/** Ground-label candidate offsets around an item, nearest first: `row` label rows up (negative = below), `dx` HUD units sideways. */
const LABEL_SLOTS: { row: number; dx: number }[] = (() => {
  const out: { row: number; dx: number; cost: number }[] = [];
  for (let row = -10; row <= 18; row++)
    for (let step = -26; step <= 26; step++) out.push({ row, dx: step * 9, cost: Math.abs(step) * 9 + (row >= 0 ? row * 11 : -row * 17 + 4) });
  return out.sort((a, b) => a.cost - b.cost);
})();

/** Most ground labels shown at once before the rest collapse to pips (Alt shows all). */
const LOOT_LABEL_CAP = 14;
/** Half-size of an unlabeled item's hover / click box, HUD units. */
const PIP_HIT = 4.5;
/** Label priority when capped: rarity first (valuable currency counts as unique), then gear / gems / currency over the rest. */
function lootLabelRank(it: Item): number {
  const cat = itemCategory(it);
  const cur = CURRENCY_BY_ID.get(it.b);
  const r = cur ? (cur.weight <= 4 ? 3 : 1) : cat === "essence" ? 2 : cat === "gem" ? Math.max(1, it.r) : it.r;
  return r * 2 + (cat === "flask" || cat === "charm" || cat === "rune" || cat === "other" ? 0 : 1);
}

function beamWorthy(it: Item): boolean {
  if (it.r === 3) return true;
  const c = CURRENCY_BY_ID.get(it.b);
  return !!c && c.weight <= 4;
}

