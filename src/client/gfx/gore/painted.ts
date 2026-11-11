// Painted gore: fx sprites from the art index (art/out/fx, `npm run art`) used in place of the
// procedural painters where they look better. Everything is optional: until the index and the
// picked image have loaded (or with Painted sprites off) the pick returns null and the caller
// draws the procedural shape. Picks are seeded, so a decal / gib keeps its sprite when redrawn.
import { artVersion, getImage, paintedEnabled, staticDef } from "../sprites2d/registry";
import { prewarmStatics } from "../sprites2d/prewarm";
import { M_BLOOD, M_CHAOS, M_ICHOR, M_SAP, M_UNDEAD, type Mat } from "./core";

export interface GoreArt {
  im: CanvasImageSource;
  /** Centre of the opaque pixels and their half extents (image px). */
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

const cache = new Map<string, GoreArt>();
/**
 * The painted blood is a very dark crimson: fine on a white card, near black on forest soil once
 * the decal layer multiplies it in. `boost` adds the image onto itself once at load (brighter,
 * same hue) so it reads as red as the procedural blood did.
 */
function art(id: string, boost = 0, mul?: string): GoreArt | null {
  const hit = cache.get(id);
  if (hit) return paintedEnabled() ? hit : null;
  const d = staticDef(id);
  if (!d) return null;
  const raw = getImage(d.src);
  if (!raw) return null;
  let im: CanvasImageSource = raw;
  if (boost > 0 && typeof document !== "undefined") {
    const cv = document.createElement("canvas");
    cv.width = raw.naturalWidth;
    cv.height = raw.naturalHeight;
    const c = cv.getContext("2d")!;
    c.drawImage(raw, 0, 0);
    c.globalCompositeOperation = "lighter";
    c.globalAlpha = boost;
    c.drawImage(raw, 0, 0);
    // The add pushes the painted glints toward white (pink-white speckle all over the splatter):
    // multiply them back toward red inside the sprite's own alpha (they stay visible as gloss).
    c.globalAlpha = 1;
    c.globalCompositeOperation = "multiply";
    c.fillStyle = "#ff8076";
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(raw, 0, 0);
    if (boost < 0.2) {
      // pools: also a red wash, so the body stays red after soaking in without the gloss going pink
      c.globalCompositeOperation = "source-atop";
      c.globalAlpha = 0.14;
      c.fillStyle = "#900707";
      c.fillRect(0, 0, cv.width, cv.height);
    }
    im = cv;
  } else if (mul && typeof document !== "undefined") {
    // Multiply tint inside the sprite's own alpha (pieces painted in the wrong coat colour / too bright).
    const cv = document.createElement("canvas");
    cv.width = raw.naturalWidth;
    cv.height = raw.naturalHeight;
    const c = cv.getContext("2d")!;
    c.drawImage(raw, 0, 0);
    c.globalCompositeOperation = "multiply";
    c.fillStyle = mul;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(raw, 0, 0);
    im = cv;
  }
  const [x0, y0, x1, y1] = d.bbox;
  let pad = 0;
  if (id.startsWith("fx_gib_") && typeof document !== "undefined") {
    // Severed pieces are drawn 5-10x smaller than painted and sat dim on the dark ground: bake a
    // thin dark rim (about 1 screen px) and a small contrast / brightness gain into the cached
    // sprite once, so the silhouette reads at a glance (live and baked pieces share this sprite).
    const rim = Math.max(2, Math.max(x1 - x0, y1 - y0) * 0.035);
    pad = Math.ceil(rim * 2.5);
    const cv = document.createElement("canvas");
    cv.width = raw.naturalWidth + pad * 2;
    cv.height = raw.naturalHeight + pad * 2;
    const c = cv.getContext("2d")!;
    c.shadowColor = "rgba(8,5,4,0.9)";
    c.shadowBlur = rim;
    c.drawImage(im, pad, pad);
    c.drawImage(im, pad, pad);
    c.shadowColor = "transparent";
    c.shadowBlur = 0;
    c.drawImage(im, pad, pad);
    c.globalCompositeOperation = "overlay"; // contrast: lights up, darks down, inside the piece only
    c.globalAlpha = 0.45;
    c.drawImage(im, pad, pad);
    c.globalCompositeOperation = "lighter"; // small brightness gain
    c.globalAlpha = 0.16;
    c.drawImage(im, pad, pad);
    im = cv;
  }
  const a: GoreArt = { im, cx: (x0 + x1) / 2 + pad, cy: (y0 + y1) / 2 + pad, hw: Math.max(1, (x1 - x0) / 2), hh: Math.max(1, (y1 - y0) / 2) };
  cache.set(id, a);
  return a;
}

/**
 * Gib pieces are painted brighter than the night forest they land in, and the wolf pieces in a
 * blue-grey coat (the feral wolf is tan): multiply them down / warm so they sit in the scene.
 */
function tintOf(id: string): string | undefined {
  if (!id.startsWith("gib_")) return undefined;
  return id.startsWith("gib_wolf") || id.startsWith("gib_fur") ? "#c49a72" : "#cfc6bc";
}

/** Seeded pick from a list ("" = keep the procedural art for this roll). */
function pickArt(list: readonly string[] | undefined, seed: number): GoreArt | null {
  if (!list || !list.length) return null;
  warm();
  const id = list[(seed >>> 0) % list.length];
  return id ? art("fx_" + id, BOOST.get(id) ?? 0, tintOf(id)) : null;
}

// ---- ground decals (flat, drawn under the ground affine) ---------------------------------------

const BLOOD_SPLAT = ["blood_splat_a", "blood_splat_c", "blood_splat_d", "blood_splat_e", "blood_splat_f", "blood_spray_e", "blood_spray_f"];
const BLOOD_BURST = ["blood_spray_a", "blood_spray_d", "blood_spray_e", "blood_spray_f", "blood_splat_c", "blood_splat_d", "blood_splat_e", "blood_splat_h", "blood_splat_f", "blood_splat_i"];
const BLOOD_DROPS = ["blood_drops", "blood_drops_b", "blood_drops_c", "blood_drops_d", "blood_splat_a"];
// (blood_pool is blue-grey with a red middle, blood_pool_g a glossy plate: both read wrong on soil)
const BLOOD_POOL = ["blood_pool_c", "blood_pool_d", "blood_pool_j", "blood_pool_k", "blood_pool_h", "blood_pool_i", "blood_pool_j", "blood_pool_k"];
// (blood_smear_d is an orange brush stroke)
const BLOOD_SMEAR = ["blood_splat_b", "blood_trail_d", "blood_trail_e", "blood_trail_g", "blood_trail_h", "blood_smear_e"];
const BLACK = ["ichor_black_a", "ichor_black_b", "ichor_black_c", "ichor_black_d", "ichor_black_e"];
const GREEN = ["ichor_green_e", "ichor_green_f"];

/** Self-add strength per sprite (see art()): thin splatter needs the most, glossy pools the least. */
const BOOST = new Map<string, number>();
// (kept moderate: at 0.9 the red channel clipped and pools became flat pure-red fills)
for (const id of [...BLOOD_SPLAT, ...BLOOD_BURST, ...BLOOD_DROPS]) BOOST.set(id, 0.45);
for (const id of BLOOD_SMEAR) BOOST.set(id, 0.3);
for (const id of BLOOD_POOL) BOOST.set(id, 0.15);
// (sap_splat_b has a straight glossy rim and a flat lighter patch along its top: reads as a cropped sprite, not used)
const SAP = ["sap_splat_a", "sap_splat_c", "sap_splat_d"];
const SPLAT: Record<number, string[]> = { [M_BLOOD]: BLOOD_SPLAT, [M_UNDEAD]: BLACK, [M_ICHOR]: GREEN, [M_CHAOS]: GREEN, [M_SAP]: SAP };
const POOL: Record<number, string[]> = { [M_BLOOD]: BLOOD_POOL, [M_UNDEAD]: BLACK, [M_SAP]: ["sap_pool_h", "sap_pool_i", "sap_pool_j", "sap_splat_c"] };
const SCORCH = ["scorch_a", "scorch_d", "scorch_e", "scorch_h"];
const FROST = ["frost_patch_d", "frost_patch_f", "frost_patch_g", "frost_patch_h"];
const CHUNKS = ["gore_chunks_a", "gore_chunks_d", "gore_chunks_e", "gore_chunks_f"];
const GUTS = ["gore_guts_a", "gore_guts_b", "gore_guts_c", "gore_guts_d"];
const FEATHERS = ["feathers_a", "feathers_b"];
const SPLINTERS = ["splinter_scatter_a", "splinter_scatter_b", "splinter_scatter_c"];
const FUNGUS = ["fungus_burst_a", "fungus_burst_b"];

export type DecalSet = "chunks" | "guts" | "feathers" | "scorch" | "frost" | "splinters" | "sap" | "fungus";
const SETS: Record<DecalSet, string[]> = { chunks: CHUNKS, guts: GUTS, feathers: FEATHERS, scorch: SCORCH, frost: FROST, splinters: SPLINTERS, sap: SAP, fungus: FUNGUS };

type G = CanvasRenderingContext2D;

/** Draw `a` centred on the origin, its longer half extent scaled to r (sx stretches along x). */
function drawFit(g: G, a: GoreArt, r: number, rot: number, alpha: number, sx = 1) {
  const k = r / Math.max(a.hw, a.hh);
  g.save();
  g.rotate(rot);
  g.scale(k * sx, k);
  g.globalAlpha = alpha;
  g.drawImage(a.im, -a.cx, -a.cy);
  g.restore();
  g.globalAlpha = 1;
}
const turn = (seed: number) => ((seed >>> 3) % 628) / 100;

/** Painted splatter for paintSplat (same arguments); false = not available, draw procedurally. */
export function paintedSplat(g: G, mat: Mat, r: number, dx: number, dy: number, seed: number, power: number, alpha: number): boolean {
  let list: string[] | undefined = SPLAT[mat];
  if (mat === M_BLOOD) list = r < 3.2 ? BLOOD_DROPS : power >= 0.8 ? BLOOD_BURST : BLOOD_SPLAT;
  const a = pickArt(list, seed);
  if (!a) return false;
  const hasDir = dx * dx + dy * dy > 0.01;
  // The procedural splat throws streaks out to ~3 core radii; the painted ones include theirs.
  if (hasDir && power > 0.3) {
    g.save();
    g.rotate(Math.atan2(dy, dx));
    drawFit(g, a, r * (2.3 + power * 0.5), turn(seed), alpha * 0.95, 1 + power * 0.35);
    g.restore();
  } else drawFit(g, a, r * (2.3 + power * 0.5), turn(seed), alpha * 0.95);
  return true;
}

/** Painted pool for paintPool: r = current (grown) radius. */
export function paintedPool(g: G, mat: Mat, r: number, seed: number, alpha: number): boolean {
  const a = pickArt(POOL[mat], seed);
  if (!a) return false;
  drawFit(g, a, r * 1.2, turn(seed), alpha);
  return true;
}

/** Painted smear for paintSmear: from the origin along +x (caller rotated), length len, half width w. */
export function paintedSmear(g: G, mat: Mat, len: number, w: number, seed: number, alpha: number): boolean {
  if (mat !== M_BLOOD) return false;
  const a = pickArt(BLOOD_SMEAR, seed);
  if (!a) return false;
  const wide = a.hw >= a.hh;
  const L = wide ? a.hw : a.hh;
  const W = wide ? a.hh : a.hw;
  g.save();
  g.translate(len * 0.5, 0);
  if (!wide) g.rotate(Math.PI / 2);
  if (seed & 1) g.scale(-1, 1);
  if (seed & 2) g.scale(1, -1);
  g.scale((len * 0.6) / L, Math.max(w * 1.6, len * 0.22) / W);
  g.globalAlpha = alpha * 0.9;
  g.drawImage(a.im, -a.cx, -a.cy);
  g.restore();
  g.globalAlpha = 1;
  return true;
}

/** One painted decal from a named set, radius r; false = none available. */
export function paintedDecal(g: G, set: DecalSet, r: number, seed: number, alpha = 1): boolean {
  const a = pickArt(SETS[set], seed);
  if (!a) return false;
  drawFit(g, a, r, turn(seed), alpha);
  return true;
}

// ---- gibs (upright billboards) -----------------------------------------------------------------

/** What the victim is made of, for picking pieces. */
export type GibTheme = "human" | "beast" | "wolf" | "wood" | "hound" | "fungus" | "antler" | "bird";

// Gib kinds (gibs.ts): 0 head, 1 arm, 2 leg, 3 torso, 4 meat, 5 gut, 6 bone, 7 rib, 9 rock.
// (gib_flesh_e / _f are a butcher's steak and a ham hock: not used)
const MEAT = ["gib_flesh_a", "gib_flesh_b", "gib_flesh_d", "gib_flesh_a", "gib_flesh_b", "gib_flesh_d", "", "", "", "", "gib_heart_b", "gib_eye_b"];
// (gib_guts_d is a neat spiral: reads as a rose, not used)
const GUT = ["gib_guts_c", "gib_intestine_b", "gib_intestine_c"];
const BONE = ["gib_bone_c", "gib_bone_d", "gib_spine", "gib_spine_b", "gib_jaw_b"];
const RIB = ["gib_ribs", "gib_ribs_b", "gib_ribs_c", "gib_spine_c"];
const WOOD = ["gib_bark_c", "gib_bark_d", "gib_bark_e", "gib_bark_f", "gib_splinters_b", "gib_splinters_c", "gib_splinters_d"];
const ROOTS = ["gib_root_a", "gib_root_b", "gib_root_c", "gib_branch_a"];
// (gib_stump_chunk_a is a clean round log slice: not used)
const TRUNK = ["gib_stump_chunk_b", "gib_bark_e", "gib_bark_f", "gib_splinters_b"];
const FUNGI = ["gib_fungus_pod_a", "gib_fungus_cap_a", "gib_fungus_stalk_a"];
// No painted limbs / head for a generic beast: torn flesh and bone instead of the procedural
// capsule limbs (they read as coloured batteries next to the painted pieces).
const SCRAPS = ["gib_flesh_a", "gib_flesh_b", "gib_flesh_d"];
const LIMB = ["gib_bone_c", "gib_bone_d", "gib_beast_leg_a", ...SCRAPS];
const FLESH: Record<number, string[]> = { 0: ["gib_jaw_b", "gib_jaw_c"], 1: LIMB, 2: LIMB, 3: ["gib_ribs_c", "gib_torso_d", "gib_ribs_b"], 4: MEAT, 5: GUT, 6: BONE, 7: RIB };
const WOODEN: Record<number, string[]> = { 0: TRUNK, 1: ROOTS, 2: ROOTS, 3: TRUNK, 4: WOOD, 5: ROOTS, 6: WOOD, 7: WOOD, 9: [...WOOD, ...ROOTS] };
const THEMES: Record<GibTheme, Record<number, string[]>> = {
  beast: FLESH,
  bird: {
    ...FLESH,
    0: ["gib_harrier_head_a", "gib_harrier_head_b"],
    1: ["gib_harrier_wing_a", "gib_harrier_wing_b"],
    2: ["gib_harrier_talon_a", "gib_harrier_wing_b"],
    3: ["gib_harrier_body_a", "gib_ribs_c"],
    4: [...MEAT, "gib_feather_clump_a", "gib_feather_clump_a", "gib_feather_clump_a"],
  },
  human: {
    ...FLESH,
    0: ["gib_head", "gib_head_b", "gib_head_c", "gib_skull_c"],
    1: ["gib_arm", "gib_arm_b", "gib_arm_c", "gib_arm_d", "gib_hand_c", "gib_hand_d", "gib_hand_e"],
    2: ["gib_leg", "gib_leg_b", "gib_leg_c", "gib_leg_d", "gib_foot_c", "gib_foot_d"],
    3: ["gib_torso_c", "gib_torso_d", "gib_ribs_b"],
    4: [...MEAT, "gib_heart_c", "gib_eye_c"],
  },
  wolf: {
    ...FLESH,
    0: ["gib_wolf_head_c", "gib_wolf_head_d", "gib_wolf_head_e"],
    // (gib_wolf_paw_a is a clawed hand, not a paw: not used)
    1: ["gib_wolf_leg", "gib_wolf_leg_c", "gib_wolf_leg_e"],
    2: ["gib_wolf_leg", "gib_wolf_leg_b", "gib_wolf_leg_c", "gib_wolf_leg_e"],
    3: ["gib_wolf_torso_a", "gib_wolf_torso_b", "gib_ribs_c"],
    4: [...MEAT, "gib_fur_chunk_a", "gib_wolf_haunch_a", "gib_wolf_tail_a"],
  },
  antler: { ...FLESH, 0: ["gib_antler_c", "gib_antler_d", "gib_antler_skull_a"], 1: ["gib_tender_arm_a", "gib_tender_arm_b", ...LIMB], 2: ["gib_tender_arm_a", "gib_tender_arm_b", ...LIMB], 3: ["gib_moss_cloak_a", "gib_ribs_c", "gib_ribs_b"] },
  wood: WOODEN,
  hound: { ...WOODEN, 0: ["gib_bark_hound_head_a"], 3: ["gib_bark_hound_torso_a", "gib_stump_chunk_b"], 1: ["gib_bark_hound_leg_a", "gib_root_b"], 2: ["gib_bark_hound_leg_a", "gib_root_a"] },
  fungus: { 0: FUNGI, 1: ["gib_root_b"], 2: ["gib_root_b"], 3: FUNGI, 4: FUNGI },
};
/** Themes whose pieces are not flesh, so they do not depend on the blood material. */
const DRY = new Set<GibTheme>(["wood", "hound", "fungus"]);
/** Longest side on screen, in gib sizes (s), per kind. */
const GIB_SIZE: Record<number, number> = { 0: 3.1, 1: 3.6, 2: 3.9, 3: 3.8, 4: 2.7, 5: 3.4, 6: 3, 7: 3.2, 9: 2.8 };
/** Kinds that are bare bone: fine for any wet material; the red-fleshed ones need red blood. */
const BONY = new Set([6, 7]);

/** Painted piece for a gib, or null (procedural). `mat` is the victim's gore material. */
export function gibArt(theme: GibTheme | undefined, kind: number, mat: Mat, seed: number): GoreArt | null {
  if (!theme) return null;
  if (!DRY.has(theme) && mat !== M_BLOOD && !(BONY.has(kind) && (mat === M_UNDEAD || mat === M_ICHOR))) return null;
  return pickArt(THEMES[theme][kind], seed);
}
export function gibArtSize(kind: number): number {
  return GIB_SIZE[kind] ?? 3;
}

// ---- preload -----------------------------------------------------------------------------------

let warmed = -1;
/**
 * Hand every sprite used here to the art warm-up once the index is in, so the pictures are loaded
 * and decoded before the first kill needs them. (The tinted / rimmed canvases are still made on
 * first use: making all of them up front kept too many canvases alive, see prewarm.ts.)
 */
function warm() {
  if (!paintedEnabled()) return;
  const v = artVersion();
  if (v === warmed) return;
  warmed = v;
  const ids = new Set<string>([...BLOOD_SPLAT, ...BLOOD_BURST, ...BLOOD_DROPS, ...BLOOD_POOL, ...BLOOD_SMEAR, ...BLACK, ...GREEN, ...SCORCH, ...FROST, ...CHUNKS, ...GUTS, ...FEATHERS, ...SPLINTERS, ...SAP, ...FUNGUS]);
  for (const l of Object.values(POOL)) for (const id of l) ids.add(id);
  for (const t of Object.values(THEMES)) for (const l of Object.values(t)) for (const id of l) if (id) ids.add(id);
  prewarmStatics([...ids].map((id) => "fx_" + id).filter((id) => staticDef(id)));
}
/** Called every frame by the gore loop so the sprites are in before the first kill. */
export function warmGoreArt() {
  warm();
}
