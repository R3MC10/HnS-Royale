// First-use warm-up for painted art. An <img> that has merely loaded is not decoded: the browser
// decodes it (and uploads it to the canvas backend) inside the first frame that draws it, which
// showed up as a hitch on the first sight of each monster type, prop and gore sprite. This module
// walks everything the current biome can show and draws each picture once into a scratch canvas
// during idle frames (menu, lobby countdown, then a thin slice of every match frame), so the cost
// is paid a little at a time before the picture is needed. Purely an optimisation: nothing waits
// for it and nothing breaks if a picture is drawn before its turn.
import { BIOME_BOSS, BIOME_ROSTER } from "../../../shared/content/monsters/roster";
import { PROTOTYPE_BIOME } from "../../../shared/biomes";
import { decorPropIds } from "./decor";
import { GROUND_TILES } from "./ground";
import { actorDef, artVersion, getImage, paintedEnabled, peekImage, staticDef } from "./registry";

/** Pictures still to do, most urgent first. */
let queue: string[] = [];
const queued = new Set<string>();
let builtVer = -1;
let builtBiome = "";
/** Loads in flight (bounded so the warm-up never floods the connection pool ahead of what is on screen). */
const loading: string[] = [];
const MAX_LOADING = 10;

const SCRATCH = 64;
let scratch: HTMLCanvasElement | null = null;
let sg: CanvasRenderingContext2D | null = null;
let warmed = 0;

function add(src: string) {
  if (queued.has(src)) return;
  queued.add(src);
  queue.push(src);
}
function addStatic(id: string) {
  const d = staticDef(id);
  if (d) add(d.src);
}
function addActor(id: string) {
  const d = actorDef(id);
  if (!d) return;
  // idle and run first (what a pack is doing when it comes into view), then the rest
  const order = Object.keys(d.anims).sort((a, b) => rank(a) - rank(b));
  for (const a of order) for (const dir of d.anims[a].dirs) for (let i = 0; i < d.anims[a].frames; i++) add(`${d.base}${a}_${dir}_${i}.png`);
}
const rank = (a: string) => (a === "idle" ? 0 : a === "run" ? 1 : a === "attack" ? 2 : 3);

function build(biome: string) {
  for (const id of Object.values(GROUND_TILES)) addStatic(id);
  const roster = BIOME_ROSTER[biome] ?? {};
  for (const id of Object.keys(roster).sort((a, b) => roster[b] - roster[a])) addActor(id);
  if (biome === "hollowpine") for (const id of decorPropIds()) addStatic(id);
  for (const id of extra) addStatic(id);
  const boss = BIOME_BOSS[biome];
  if (boss) addActor(boss);
}

const extra = new Set<string>();
/** Other systems (gore) list the statics they will draw; they are warmed after the props. */
export function prewarmStatics(ids: Iterable<string>) {
  for (const id of ids) extra.add(id);
  builtVer = -1;
}

/**
 * Draw a picture (or a cached canvas made from one) once, tiny, into the scratch canvas: this is
 * what makes the browser decode / rasterise it now instead of inside its first real frame.
 */
export function touchArt(im: CanvasImageSource) {
  if (typeof document === "undefined") return;
  if (!scratch) {
    scratch = document.createElement("canvas");
    scratch.width = scratch.height = SCRATCH;
    // CPU canvas on purpose: drawing into it makes the browser decode the picture (the expensive part)
    // without also parking a texture for every picture of the biome on the GPU. Doing that, or
    // keeping a few hundred extra cached canvases alive, overran the browser's canvas budget and
    // every frame after that took 50-100 ms.
    sg = scratch.getContext("2d", { willReadFrequently: true });
  }
  if (!sg) return;
  const k = (warmed++ % 64) * 4;
  sg.drawImage(im, k, 0, 4, 4);
  sg.getImageData(k, 0, 1, 1); // read it back so the decode happens here, inside the budget, not at the end of the frame
}

/** Spend up to `budgetMs` warming art (at least one loaded picture per call). */
export function prewarmTick(budgetMs: number, biome: string = PROTOTYPE_BIOME) {
  if (!paintedEnabled()) return;
  if (builtVer !== artVersion() || builtBiome !== biome) {
    builtVer = artVersion();
    builtBiome = biome;
    build(biome);
  }
  const t0 = performance.now();
  // 1. loaded pictures: touch them (at least one a frame, then while the budget lasts)
  for (let i = 0; i < loading.length; ) {
    const im = getImage(loading[i]);
    const el = peekImage(loading[i]);
    if (im) {
      touchArt(im);
      loading.splice(i, 1);
      if (performance.now() - t0 > budgetMs) break;
    } else if (el && el.complete) loading.splice(i, 1); // failed to load: drop it
    else i++;
  }
  // 2. start more loads (cached ones are picked up on the next tick)
  while (loading.length < MAX_LOADING && queue.length) {
    const src = queue.shift()!;
    getImage(src);
    loading.push(src);
  }
}

/** Pictures not warmed yet (0 = done); for the dev console. */
export function prewarmLeft() {
  return queue.length + loading.length;
}
