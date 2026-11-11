// Maps the existing obstacle / scatter generator (gfx/props.ts) onto the painted hollowpine props.
// Every pick is a pure function of the prop's map position, so all clients see the same world.
import { K } from "../iso";
import { ART_PX } from "./actors";
import { staticDef } from "./registry";

export interface PropPick {
  id: string;
  scale: number;
  flip: boolean;
}

function h(x: number, y: number, s: number) {
  let v = (Math.round(x) * 73856093) ^ (Math.round(y) * 19349663) ^ (s * 83492791);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}

const P = "prop_hollowpine_";
/** One entry of a pick list: prop id (without the hollowpine prefix unless it is an fx_ decal), size multiplier, weight. */
type V = [id: string, m?: number, w?: number];
const full = (id: string) => (id.startsWith("fx_") ? id : P + id);

/** Weighted pick from the entries that have art (same r -> same entry while the art set is the same). */
function pick(list: V[], r: number): { id: string; m: number } | null {
  let total = 0;
  for (const v of list) if (staticDef(full(v[0]))) total += v[2] ?? 1;
  if (total <= 0) return null;
  let t = r * total;
  let last: V | null = null;
  for (const v of list) {
    if (!staticDef(full(v[0]))) continue;
    last = v;
    t -= v[2] ?? 1;
    if (t < 0) break;
  }
  return last ? { id: full(last[0]), m: last[1] ?? 1 } : null;
}
/** Scale so the prop's opaque width is about `w` screen units, kept near the shared art scale. */
function fitWidth(id: string, w: number, lo = 0.6, hi = 1.6) {
  const def = staticDef(id)!;
  const bw = Math.max(8, def.bbox[2] - def.bbox[0]);
  return Math.max(ART_PX * lo, Math.min(ART_PX * hi, w / bw));
}

// ---- obstacle pick lists (m = size multiplier / upper scale clamp for ruins) ----
const TREES_BIG: V[] = [
  ["conifer_large", 1, 5], ["conifer_medium", 1, 3], ["conifer_large_b", 1.6], ["conifer_large_c", 1.65], ["conifer_large_d", 1.65],
  ["conifer_dark_b", 2.1], ["conifer_dark_c", 2], ["conifer_dark_d", 2.2],
];
const TREES: V[] = [
  ["conifer_medium", 1, 4], ["conifer_small", 1, 4], ["conifer_large", 1, 3], ["deadtree", 1, 3],
  ["conifer_medium_b", 1.3], ["conifer_medium_c", 1.2], ["conifer_medium_d", 1.1], ["conifer_small_b", 0.9], ["conifer_small_c", 0.9], ["conifer_small_d", 0.9],
  ["conifer_dark_b", 1.45], ["conifer_dark_c", 1.3], ["conifer_dark_d", 1.45],
];
const BOULDERS: V[] = [["boulder", 1, 4], ["boulder_b"], ["boulder_c"], ["boulder_d"], ["rock_b"], ["rock_c"], ["rock_d"]];
const ARCHES: V[] = [["archway", 1.4, 2], ["archway_b", 1.4], ["archway_c", 1.4], ["archway_d", 1.4], ["archway_e", 1.4], ["ruin_gatehouse_a", 1.2, 0.6], ["ruin_gatehouse_b", 1.2, 0.6], ["ruin_tower_a", 1.3, 0.6], ["ruin_tower_b", 1.3, 0.6]];
const RUINS: V[] = [
  ["wall_a", 1.4, 3], ["wall_b", 1.4, 2], ["wall_c", 1.4], ["wall_d", 1.4], ["wall_e", 1.4],
  ["ruin_wall_b", 1.4], ["ruin_wall_c", 1.4], ["ruin_wall_d", 1.4], ["ruin_corner", 1.2], ["ruin_corner_c", 1.3],
  ["ruin_wall_e", 1.4], ["ruin_wall_f", 1.4], ["ruin_corner_b", 1.2], ["ruin_corner_d", 1.3], ["ruin_steps", 1.2, 0.6], ["ruin_steps_b", 1.2, 0.6],
  ["ruin_pillar_broken", 0.95], ["ruin_pillar_broken_b", 0.95], ["well_ruined", 1.1], ["well_ruined_b", 1.1], ["well_ruined_c", 1.1, 0.5], ["well_ruined_d", 1.1, 0.5],
];
// Landmark dressing, chosen by the map generator's obstacle tag (shared/mapgen: MapObstacle.tag).
const TAGGED: Record<string, V[]> = {
  pillar: [["ruin_pillar_broken", 1.15, 2], ["ruin_pillar_broken_b", 1.15], ["ruin_pillar_broken_c", 1.15, 2], ["obelisk_tree_sigil_a", 1.2], ["obelisk_tree_sigil_b", 1.2]],
  arch: ARCHES,
  statue: [
    ["statue_knight", 1.05], ["statue_knight_b", 1.05], ["statue_knight_c", 1.05], ["statue_knight_d", 1.05], ["statue_knight_e", 1.05],
    ["statue_winged", 1.05], ["statue_winged_b", 1.05], ["statue_winged_c", 1.05], ["statue_winged_d", 1.05], ["statue_winged_e", 1.05],
  ],
  deadtree: [["deadtree", 1, 2], ["deadtree_b", 1.35], ["deadtree_c", 1.35], ["deadtree_d", 1.35], ["hanged_corpse_tree", 1.3, 0.4], ["hanged_corpse_tree_b", 1.3, 0.4]],
  woodpile: [["woodpile", 1.2], ["woodpile_b", 1.2], ["woodpile_c", 1.2], ["woodpile_d", 1.2], ["woodpile_e", 1.2], ["great_stump_hollow_a", 1.1], ["great_stump_hollow_b", 1.1]],
  cart: [["cart", 1.3, 2], ["cart_b", 1.3], ["cart_c", 1.3], ["cart_overturned", 1.2], ["cart_overturned_b", 1.2], ["wagon_burned_a", 1.2], ["wagon_burned_b", 1.2]],
  grim: [["skull_pole", 1.1, 2], ["skull_pole_b", 1.1], ["skull_pole_c", 1.1], ["pike_heads", 1], ["pike_heads_b", 1], ["impaled_corpse_a", 1.1], ["impaled_corpse_b", 1.1], ["gibbet", 1.1, 0.6], ["gibbet_b", 1.1, 0.6]],
  stones: [["standing_stones_b", 1.3, 3], ["standing_stones_a", 1.3], ["boulder", 1.4], ["boulder_c", 1.4]],
};

/** Painted prop for an obstacle (kind from props.obstacleKind), or null to keep the procedural one. */
export function obstacleProp(o: { x: number; y: number; r: number; tag?: string }, kind: string): PropPick | null {
  const r = h(o.x, o.y, 1);
  const flip = h(o.x, o.y, 2) < 0.5;
  let id: string | null = null;
  let scale = ART_PX;
  const tagged = o.tag ? TAGGED[o.tag] : undefined;
  if (tagged && kind !== "shrine") {
    const p = pick(tagged, h(o.x, o.y, 7));
    if (p) {
      id = p.id;
      scale = o.tag === "deadtree" ? ART_PX * p.m * (0.85 + h(o.x, o.y, 3) * 0.3) : fitWidth(id, o.r * 2.6 * K, 0.8, p.m);
    }
  } else if (kind === "tree") {
    const p = pick(o.r > 40 ? TREES_BIG : TREES, r);
    if (p) {
      id = p.id;
      scale = ART_PX * p.m * (0.85 + h(o.x, o.y, 3) * 0.3);
    }
  } else if (kind === "rocks") {
    const p = pick(BOULDERS, r);
    if (p) {
      id = p.id;
      scale = fitWidth(id, o.r * 2.3 * K);
    }
  } else if (kind === "ruin") {
    const p = pick(r < 0.12 ? ARCHES : RUINS, h(o.x, o.y, 7));
    if (p) {
      id = p.id;
      scale = fitWidth(id, o.r * 2.6 * K, 0.7, p.m);
    }
  }
  return id ? { id, scale, flip } : null;
}

// ---- scatter pick lists ----
const GRAVES: V[] = [
  ["gravestakes", 1, 6], ["grave_cross", 0.8], ["grave_cross_b", 0.8], ["grave_cross_c", 0.8], ["grave_cross_d", 0.75],
  ["gravestone_a", 0.65], ["gravestone_b", 0.65], ["gravestone_c", 0.65], ["gravestone_d", 0.65],
];
const BONES: V[] = [["skeleton", 0.8, 5], ["skeleton_b", 0.8, 2], ["skeleton_c", 0.85, 2], ["bones_pile", 0.5], ["bones_pile_c", 0.5], ["fx_bone_scatter", 0.6], ["fx_bone_scatter_b", 0.6], ["fx_bone_scatter_c", 0.6], ["deer_carcass", 0.75, 0.6]];
const SHRUBS: V[] = [["fern", 1, 6], ["fern_b", 0.72], ["fern_c", 0.7], ["fern_d", 0.72], ["grass_tuft_b", 0.85], ["grass_tuft_c", 0.8], ["grass_tuft_d", 0.85], ["bush_dead", 0.7], ["bush_dead_b", 0.7]];
const SHROOMS: V[] = [["mushrooms", 1, 4], ["mushrooms_b"], ["mushrooms_c"], ["mushrooms_d"], ["fungus_b", 0.5], ["fungus_c", 0.5], ["fungus_d", 0.5], ["fungus_cluster", 0.62], ["fungus_cluster_c", 0.62], ["fx_pine_cones_a", 0.5], ["fx_pine_cones_b", 0.5]];
const STONES: V[] = [["rocks", 1, 5], ["rocks_c"], ["rocks_d"], ["rubble_b", 0.5], ["rubble_c", 0.5], ["rubble_d", 0.5]];
const LOGS: V[] = [["log", 1, 4], ["log_b", 0.8], ["log_c", 0.9], ["log_d", 0.9], ["stump_b", 0.7], ["stump_c", 0.7], ["stump_d", 0.7], ["stump_axe", 0.75], ["woodpile", 0.7]];
const BARRELS: V[] = [["barrel", 1, 3], ["barrel_b"], ["barrel_c"], ["barrel_broken_b", 0.75], ["barrel_broken_c", 0.75], ["barrel_broken_d", 0.75], ["pots_cluster_a", 0.7], ["urn_b", 0.7]];
const CRATES: V[] = [["crate", 1, 3], ["crate_b"], ["crate_c"], ["crate_broken_b", 0.75], ["crate_broken_c", 0.75], ["crate_broken_d", 0.75], ["wheel_broken", 0.75], ["weapons_discarded_b", 0.65], ["arrows_stuck_b", 0.9]];
const TORCHES: V[] = [["torch_standing", 1, 2], ["torch_standing_b"], ["torch_standing_c"]];

// Per-place scatter lists (props.ts Scatter.p): what lies around in each kind of place.
const HINTS: Record<string, V[]> = {
  meadow: [
    ["grass_tuft_b", 0.85, 3], ["grass_tuft_c", 0.8, 3], ["grass_tuft_d", 0.85, 3], ["grass_tuft_e", 0.85, 2], ["grass_tuft_f", 0.85, 2],
    ["fern", 1, 3], ["fern_b", 0.72], ["fern_e", 0.72], ["fern_f", 0.72], ["bush_b", 0.75], ["bush_c", 0.75], ["bush_d", 0.75], ["mushrooms_e", 1, 0.6], ["fx_moss_patch", 0.6],
  ],
  forest: [
    ["fern", 1, 4], ["fern_b", 0.72, 2], ["fern_c", 0.7, 2], ["fern_d", 0.72, 2], ["mushrooms", 1, 2], ["mushrooms_b"], ["mushrooms_c"], ["mushrooms_d"], ["mushrooms_f"],
    ["fungus_b", 0.5], ["fungus_c", 0.5], ["fungus_e", 0.5], ["fungus_cluster", 0.62], ["fungus_cluster_b", 0.62], ["fungus_cluster_d", 0.62],
    ["roots_a", 0.7], ["roots_b", 0.7], ["roots_c", 0.7], ["log", 1, 1.5], ["log_c", 0.9], ["log_e", 0.9], ["stump_b", 0.7], ["stump_e", 0.7], ["bush_dead", 0.7], ["bush_dead_c", 0.7],
    ["fx_pine_cones_a", 0.5, 2], ["fx_pine_cones_b", 0.5, 2],
  ],
  graves: [
    ["gravestone_a", 0.68, 2], ["gravestone_b", 0.68, 2], ["gravestone_c", 0.68, 2], ["gravestone_d", 0.68, 2], ["gravestone_e", 0.68, 2], ["gravestone_f", 0.68, 2],
    ["grave_cross", 0.8], ["grave_cross_b", 0.8], ["grave_cross_c", 0.8], ["grave_cross_d", 0.75], ["grave_cross_e", 0.8], ["grave_cross_f", 0.8], ["gravestakes", 1], ["gravestakes_b", 0.8],
  ],
  tomb: [
    ["gravestones_cluster", 0.75, 2], ["gravestones_cluster_b", 0.75], ["gravestones_cluster_c", 0.75], ["grave_open", 0.7], ["grave_open_b", 0.7], ["coffin_closed_a", 0.7], ["coffin_open_a", 0.7],
    ["sarcophagus_a", 0.75], ["sarcophagus_b", 0.75], ["urn_a", 0.7], ["urn_c", 0.7], ["lantern_post", 0.9], ["lantern_post_b", 0.9], ["skeleton_d", 0.8], ["bush_dead_d", 0.7],
  ],
  rubble: [
    ["rubble_b", 0.55, 2], ["rubble_c", 0.55, 2], ["rubble_d", 0.55, 2], ["rubble_e", 0.55], ["rubble_f", 0.55], ["urn_a", 0.7], ["urn_b", 0.7], ["urn_d", 0.7], ["urn_broken_a", 0.7], ["urn_broken_b", 0.7],
    ["pots_cluster_a", 0.7], ["pots_cluster_b", 0.7], ["pots_cluster_c", 0.7], ["rocks", 1], ["rocks_c"], ["torch_standing", 1, 0.5], ["torch_standing_d", 1, 0.5],
  ],
  lumber: [
    ["stump_b", 0.75, 2], ["stump_c", 0.75, 2], ["stump_d", 0.75, 2], ["stump_e", 0.75], ["stump_f", 0.75], ["stump_axe", 0.78], ["stump_axe_b", 0.78], ["stump_axe_c", 0.78], ["stump_axe_d", 0.78],
    ["log", 1, 2], ["log_b", 0.8], ["log_c", 0.9], ["log_d", 0.9], ["log_e", 0.9], ["log_f", 0.9], ["woodpile", 0.7], ["woodpile_d", 0.7], ["wheel_broken", 0.75, 0.6], ["campfire_cold", 0.75, 0.5], ["tent_collapsed", 0.8, 0.4],
  ],
  den: [
    ["bones_pile", 0.55, 2], ["bones_pile_b", 0.55], ["bones_pile_c", 0.55], ["bones_pile_d", 0.55], ["bones_pile_e", 0.55], ["skeleton", 0.8, 2], ["skeleton_b", 0.8], ["skeleton_c", 0.85], ["skeleton_e", 0.8], ["skeleton_f", 0.8],
    ["ribcage", 0.75], ["ribcage_b", 0.75], ["skull_pile_b", 0.7], ["skull_pile_c", 0.7], ["skull_pile_d", 0.7], ["deer_carcass", 0.75], ["deer_carcass_c", 0.75], ["dead_wolf", 0.75, 0.6],
    ["fx_bone_scatter", 0.6, 2], ["fx_bone_scatter_b", 0.6, 2], ["fx_bone_scatter_c", 0.6, 2],
  ],
  road: [
    ["wheel_broken", 0.75, 2], ["wheel_broken_b", 0.75], ["wheel_broken_c", 0.75], ["signpost_blank", 0.9, 2], ["signpost_blank_b", 0.9], ["signpost_blank_c", 0.9], ["fence_broken", 0.75], ["fence_broken_b", 0.75],
    ["crate_broken_b", 0.75], ["barrel_broken_b", 0.75], ["rocks", 1, 2], ["rocks_d"], ["lantern_post_c", 0.9, 0.6], ["shrine_wayside", 0.8, 0.5], ["shrine_wayside_b", 0.8, 0.5],
  ],
  torch: [["torch_standing", 1, 2], ["torch_standing_b"], ["torch_standing_c"], ["torch_standing_d"], ["torch_standing_e"]],
};

/** Painted prop for a scatter item (props.SCATTER kind), or null. */
export function scatterProp(sc: { x: number; y: number; kind: string; seed: number; p?: string }): PropPick | null {
  const r = h(sc.x, sc.y, 4);
  const r2 = h(sc.x, sc.y, 8);
  const flip = h(sc.x, sc.y, 5) < 0.5;
  let p: { id: string; m: number } | null = null;
  const hint = sc.p ? HINTS[sc.p] : undefined;
  if (hint) p = pick(hint, r2);
  if (!p) switch (sc.kind) {
    case "grave":
      p = (r < 0.85 ? null : pick(BONES.slice(0, 3), r2)) ?? pick(GRAVES, r2);
      break;
    case "bones":
      p = pick(BONES, r2);
      break;
    case "shrub":
      p = (r < 0.7 ? null : pick(SHROOMS, r2)) ?? pick(SHRUBS, r2);
      break;
    case "stones":
      p = (r < 0.55 ? null : r < 0.75 ? pick(LOGS, r2) : r < 0.85 ? pick(BARRELS, r2) : r < 0.93 ? pick(CRATES, r2) : pick(TORCHES, r2)) ?? pick(STONES, r2);
      break;
  }
  return p ? { id: p.id, scale: ART_PX * p.m * (0.85 + h(sc.x, sc.y, 6) * 0.3), flip } : null;
}

// ---- loop19: wall dressing (client-only art on blocked cells; no collision) ----
/** Deep inside a forest wall: tall conifers, so blocked ground reads as forest, not an empty dark shade. */
const DEEP_TREES: V[] = [
  ["conifer_large", 1, 3], ["conifer_large_b", 1.6], ["conifer_large_c", 1.65], ["conifer_dark_b", 2.1, 2], ["conifer_dark_c", 2, 2], ["conifer_dark_d", 2.2, 2],
  ["conifer_medium", 1, 2], ["conifer_medium_b", 1.3],
];
/** Deep inside a rocky wall. */
const DEEP_ROCKS: V[] = [["boulder", 1.3, 3], ["boulder_b", 1.3], ["boulder_c", 1.3], ["boulder_d", 1.3], ["rock_b", 1.2], ["rock_c", 1.2]];
/**
 * Rim cells that carry no tree: small conifers and boulders mark where walkable ground ends. Loop21: only props
 * that never appear as walkable-ground scatter (ferns, rock piles and dead bushes do, so a fern rim read as open
 * ground you could walk into); these are the same trees / boulders the blocking obstacles use, a size down.
 */
const RIM_FILL: V[] = [
  // (conifer_small_b..d are pale bare-rooted saplings that read as a gap in the wall: left out)
  ["conifer_small", 1.1, 4], ["conifer_medium", 0.9, 2.5], ["boulder_b", 0.8, 1.5], ["boulder_c", 0.8, 1.2], ["boulder_d", 0.8, 1.2],
];
/** Layer 2 (one cell behind the rim, loop21): mid-size trees, so tall deep trees do not hide you at the edge. */
const MID_TREES: V[] = [["conifer_medium", 1, 3], ["conifer_medium_b", 1.1], ["conifer_small", 1.25, 2]];
const MID_ROCKS: V[] = [["boulder", 1.05, 2], ["boulder_b", 1.05], ["boulder_c", 1.05]];
/** Painted dressing for a blocked spot: `deep` = inside the wall (`mid` = only one cell in), else a tree-less rim cell. */
export function wallDressProp(x: number, y: number, deep: boolean, rock: boolean, mid = false): PropPick | null {
  const p = pick(deep ? (mid ? (rock ? MID_ROCKS : MID_TREES) : rock ? DEEP_ROCKS : DEEP_TREES) : RIM_FILL, h(x, y, 11));
  return p ? { id: p.id, scale: ART_PX * p.m * (0.85 + h(x, y, 12) * 0.3), flip: h(x, y, 13) < 0.5 } : null;
}

/** Every painted prop / ground decal id the pick lists above can return (for the idle-time warm-up). */
export function decorPropIds(): string[] {
  const out = new Set<string>();
  for (const l of [TREES_BIG, TREES, DEEP_TREES, DEEP_ROCKS, RIM_FILL, BOULDERS, ARCHES, RUINS, GRAVES, BONES, SHRUBS, SHROOMS, STONES, LOGS, BARRELS, CRATES, TORCHES, ...Object.values(TAGGED), ...Object.values(HINTS)]) for (const v of l) out.add(full(v[0]));
  return [...out];
}
