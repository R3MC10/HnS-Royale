// Jewels: 1x1 items with modifiers that socket into special passive-tree slots (PoE2 jewel system,
// original names). The progression agent owns the tree; the hook is `jewelModTotals(item, ctx)`: sum
// it into the player's modifiers for each jewel socketed in the tree (server/progression.ts).
//
// PoE2 structure copied:
//  - three attribute jewels (Str / Dex / Int), each with its OWN modifier pool (some mods shared);
//  - a radius jewel whose mods empower the allocated Small / Notable passives around its socket;
//  - a unique-only radius base for "timeless"-style uniques (content/uniques.ts);
//  - Magic: 1 prefix + 1 suffix; Rare: up to 2 prefixes + 2 suffixes; affixes tiered by item level;
//  - jewels never take quality, sockets or implicits. Crafted with Embers like gear.
import { registerItemKind } from "../grid";
import type { Item } from "../items";
import type { FxKey } from "./fx";
import { PASSIVE_BY_ID, PASSIVE_NODES } from "./passives";
import { uniqueModLine } from "./uniques";
import type { AffixTier, ModKey } from "./types";

export const JEWEL_PREFIX = "jwl_";

export type JewelAttr = "str" | "dex" | "int" | "any";
/** Radius names, PoE2-style. Values are passive-tree distances (tree units). */
export const JEWEL_RADIUS = { small: 120, medium: 160, large: 200 } as const;
export type JewelRadius = keyof typeof JEWEL_RADIUS;
export const jewelRadiusName = (r: JewelRadius) => r[0].toUpperCase() + r.slice(1);

export interface JewelBase {
  id: string;
  name: string;
  /** Affix families this jewel favours (weight x3). */
  leaning: (ModKey | FxKey)[];
  weight: number; // 0 = never drops as a normal / magic / rare (unique-only base)
  minIlvl: number;
  color: string; // gem colour for the icon
  attr: JewelAttr;
  /** Radius jewels affect the allocated passives around their socket. */
  radius?: JewelRadius;
  desc?: string;
}

export const JEWEL_BASES: JewelBase[] = [
  { id: "jwl_bloodgarnet", name: "Bloodgarnet Jewel", attr: "str", leaning: ["life", "dmgInc", "dmgFlat", "leech"], weight: 10, minIlvl: 1, color: "#c8323c", desc: "A Strength jewel: life, armour and melee might" },
  { id: "jwl_mossglass", name: "Mossglass Jewel", attr: "dex", leaning: ["moveInc", "atkSpeedInc", "dodgeCdRed", "killHaste"], weight: 10, minIlvl: 1, color: "#46b46a", desc: "A Dexterity jewel: evasion, speed and precision" },
  { id: "jwl_starsilt", name: "Starsilt Jewel", attr: "int", leaning: ["mana", "manaRegen", "spellInc", "charmGain"], weight: 10, minIlvl: 1, color: "#4a78e0", desc: "An Intelligence jewel: energy shield, mana and spells" },
  { id: "jwl_driftglass", name: "Driftglass Jewel", attr: "any", radius: "medium", leaning: [], weight: 5, minIlvl: 6, color: "#c8b48a", desc: "Empowers the allocated passives in its radius" },
  { id: "jwl_stillstone", name: "Stillstone Jewel", attr: "any", radius: "large", leaning: [], weight: 0, minIlvl: 8, color: "#9a8cb8", desc: "Only found as a unique. Rewrites the passives in its radius" },
];
export const JEWEL_BASE_BY_ID = new Map(JEWEL_BASES.map((b) => [b.id, b]));
export const isJewel = (it: Item | null | undefined): it is Item => !!it && JEWEL_BASE_BY_ID.has(it.b);

export interface JewelAffix {
  id: string;
  kind: "prefix" | "suffix";
  key: ModKey | FxKey;
  weight: number;
  decimals?: number;
  tiers: AffixTier[];
  /** Jewel bases that can roll it (PoE2: each jewel class has its own pool). Default: the three attribute jewels. */
  bases?: string[];
  /** Radius mods: the value is granted once per allocated passive of this kind inside the radius. */
  per?: "small" | "notable";
}

const t = (ilvl: number, min: number, max: number, name: string): AffixTier => ({ ilvl, min, max, name });
const STR = "jwl_bloodgarnet";
const DEX = "jwl_mossglass";
const INT = "jwl_starsilt";
const RAD = ["jwl_driftglass"];

export const JEWEL_AFFIXES: JewelAffix[] = [
  // ---- original pool (ids kept), now split by jewel class ----
  { id: "j_life", kind: "prefix", key: "life", weight: 10, bases: [STR], tiers: [t(1, 5, 9, "Hearty"), t(10, 10, 15, "Thick-Veined")] },
  { id: "j_dmg", kind: "prefix", key: "dmgInc", weight: 8, bases: [STR, DEX], tiers: [t(1, 5, 9, "Spiteful"), t(10, 10, 14, "Feral")] },
  { id: "j_flat", kind: "prefix", key: "dmgFlat", weight: 6, bases: [STR], tiers: [t(1, 1, 2, "Notched"), t(10, 3, 4, "Sawtoothed")] },
  { id: "j_mana", kind: "prefix", key: "mana", weight: 8, bases: [INT], tiers: [t(1, 6, 10, "Musing"), t(10, 11, 16, "Pondering")] },
  { id: "j_spell", kind: "prefix", key: "spellInc", weight: 7, bases: [INT], tiers: [t(1, 5, 9, "Murmuring"), t(10, 10, 14, "Chorused")] },
  { id: "j_leech", kind: "prefix", key: "leech", weight: 4, decimals: 1, bases: [STR], tiers: [t(4, 0.5, 1, "Leeching"), t(12, 1.1, 2, "Gorging")] },
  { id: "j_move", kind: "suffix", key: "moveInc", weight: 6, bases: [DEX], tiers: [t(1, 2, 3, "of Pacing"), t(10, 4, 5, "of the Courier")] },
  { id: "j_aspd", kind: "suffix", key: "atkSpeedInc", weight: 8, bases: [STR, DEX], tiers: [t(1, 2, 4, "of Fidgeting"), t(10, 5, 7, "of Haste")] },
  { id: "j_dodge", kind: "suffix", key: "dodgeCdRed", weight: 6, bases: [DEX], tiers: [t(1, 3, 5, "of Ducking"), t(10, 6, 8, "of Sidesteps")] },
  { id: "j_mregen", kind: "suffix", key: "manaRegen", weight: 6, decimals: 1, bases: [INT], tiers: [t(1, 0.4, 0.8, "of Seeping"), t(10, 0.9, 1.4, "of Rills")] },
  { id: "j_haste", kind: "suffix", key: "killHaste", weight: 4, bases: [DEX], tiers: [t(4, 8, 12, "of the Chase"), t(12, 13, 18, "of the Hunt")] },
  { id: "j_cgain", kind: "suffix", key: "charmGain", weight: 5, tiers: [t(1, 10, 15, "of Trinkets"), t(10, 16, 25, "of Baubles")] },
  { id: "j_regen", kind: "suffix", key: "regen", weight: 6, decimals: 1, bases: [STR], tiers: [t(1, 0.4, 0.8, "of Knitting"), t(10, 0.9, 1.5, "of Stitching")] },
  // ---- Strength jewel ----
  { id: "j_armour", kind: "prefix", key: "armourInc", weight: 9, bases: [STR], tiers: [t(1, 6, 10, "Iron-Skinned"), t(8, 11, 15, "Bulwarked"), t(15, 16, 20, "Unyielding")] },
  { id: "j_kb", kind: "prefix", key: "kbInc", weight: 5, bases: [STR], tiers: [t(1, 8, 12, "Shoving"), t(10, 13, 20, "Battering")] },
  { id: "j_stun", kind: "suffix", key: "stunThr", weight: 7, bases: [STR], tiers: [t(1, 6, 10, "of Footing"), t(8, 11, 15, "of the Oak"), t(15, 16, 20, "of the Mountain")] },
  // ---- Dexterity jewel ----
  { id: "j_evasion", kind: "prefix", key: "evasionInc", weight: 9, bases: [DEX], tiers: [t(1, 6, 10, "Shifting"), t(8, 11, 15, "Hazed"), t(15, 16, 20, "Phantasmal")] },
  { id: "j_acc", kind: "prefix", key: "accuracy", weight: 6, bases: [DEX], tiers: [t(1, 10, 20, "Keen"), t(10, 21, 35, "Hawk-eyed")] },
  { id: "j_reach", kind: "prefix", key: "reach", weight: 3, bases: [DEX], tiers: [t(6, 3, 5, "Lunging"), t(14, 6, 8, "Far-reaching")] },
  // ---- Intelligence jewel ----
  { id: "j_es", kind: "prefix", key: "esInc", weight: 9, bases: [INT], tiers: [t(1, 6, 10, "Shimmering"), t(8, 11, 15, "Lustrous"), t(15, 16, 20, "Radiant")] },
  { id: "j_esstart", kind: "suffix", key: "esStart", weight: 6, bases: [INT], tiers: [t(1, 8, 12, "of Rekindling"), t(10, 13, 20, "of the Pyre Ash")] },
  // ---- shared between two classes (PoE2 jewels overlap on generic mods) ----
  { id: "j_crit", kind: "suffix", key: "critInc", weight: 7, bases: [DEX, INT], tiers: [t(1, 6, 10, "of the Thornprick"), t(8, 11, 15, "of the Awl"), t(15, 16, 20, "of Wreckage")] },
  { id: "j_critm", kind: "suffix", key: "critMulti", weight: 6, bases: [STR, DEX], tiers: [t(4, 5, 8, "of Wounding"), t(12, 9, 14, "of Butchery")] },
  { id: "j_ailthr", kind: "suffix", key: "ailThr", weight: 6, bases: [STR, INT], tiers: [t(1, 6, 10, "of Fortitude"), t(10, 11, 18, "of Constancy")] },
  { id: "j_frec", kind: "suffix", key: "flaskRecInc", weight: 5, tiers: [t(1, 5, 8, "of the Tippler"), t(10, 9, 14, "of the Sot")] },
  { id: "j_fgain", kind: "suffix", key: "flaskGainInc", weight: 5, tiers: [t(1, 6, 10, "of Refilling"), t(10, 11, 16, "of Brimming")] },
  // ---- radius jewel (Driftglass): granted per allocated passive in radius ----
  { id: "jr_n_life", kind: "prefix", key: "life", per: "notable", weight: 8, bases: RAD, tiers: [t(6, 6, 9, "Swelling"), t(14, 10, 14, "Surging")] },
  { id: "jr_n_dmg", kind: "prefix", key: "dmgInc", per: "notable", weight: 8, bases: RAD, tiers: [t(6, 4, 6, "Spiteful Tide"), t(14, 7, 9, "Feral Tide")] },
  { id: "jr_n_spell", kind: "prefix", key: "spellInc", per: "notable", weight: 7, bases: RAD, tiers: [t(6, 4, 6, "Murmuring Tide"), t(14, 7, 9, "Chorused Tide")] },
  { id: "jr_n_armour", kind: "prefix", key: "armourInc", per: "notable", weight: 6, bases: RAD, tiers: [t(6, 6, 10, "Silted"), t(14, 11, 15, "Bedded")] },
  { id: "jr_n_evasion", kind: "prefix", key: "evasionInc", per: "notable", weight: 6, bases: RAD, tiers: [t(6, 6, 10, "Misting"), t(14, 11, 15, "Fogbound")] },
  { id: "jr_n_es", kind: "prefix", key: "esInc", per: "notable", weight: 6, bases: RAD, tiers: [t(6, 6, 10, "Whetstone-Lit"), t(14, 11, 15, "Lanternbright")] },
  { id: "jr_s_life", kind: "suffix", key: "life", per: "small", weight: 8, bases: RAD, tiers: [t(6, 1, 2, "of Drift"), t(14, 3, 4, "of the Undertow")] },
  { id: "jr_s_aspd", kind: "suffix", key: "atkSpeedInc", per: "small", weight: 6, decimals: 1, bases: RAD, tiers: [t(6, 0.5, 0.8, "of Ripples"), t(14, 0.9, 1.2, "of Rapids")] },
  { id: "jr_s_mana", kind: "suffix", key: "mana", per: "small", weight: 6, bases: RAD, tiers: [t(6, 1, 2, "of Eddies"), t(14, 3, 4, "of Whirlpools")] },
  { id: "jr_s_res", kind: "suffix", key: "resAll", per: "small", weight: 5, decimals: 1, bases: RAD, tiers: [t(6, 0.5, 1, "of Shoals"), t(14, 1.1, 1.5, "of Reefs")] },
  { id: "jr_s_regen", kind: "suffix", key: "regen", per: "small", weight: 5, decimals: 1, bases: RAD, tiers: [t(6, 0.1, 0.2, "of Seepage"), t(14, 0.2, 0.3, "of Springs")] },
];
export const JEWEL_AFFIX_BY_ID = new Map(JEWEL_AFFIXES.map((a) => [a.id, a]));

const ATTR_BASES = [STR, DEX, INT];
/** Can this affix roll on this jewel base? */
export const jewelAffixFits = (a: JewelAffix, baseId: string): boolean => (a.bases ?? ATTR_BASES).includes(baseId);

/** Rare jewels: up to 2 prefixes + 2 suffixes (PoE2). Magic: 1 + 1. */
export const JEWEL_MAX_PER_KIND = 2;

/** Allocated Small / Notable passives inside a radius jewel's area (server fills this in). */
export interface JewelRadiusCtx {
  small: number;
  notable: number;
}

/** Count allocated Small and Notable passives within `radius` of tree node `socket`. */
export function jewelRadiusCounts(socket: string, radius: JewelRadius, alloc: { has(id: string): boolean }): JewelRadiusCtx {
  const out: JewelRadiusCtx = { small: 0, notable: 0 };
  const s = PASSIVE_BY_ID.get(socket);
  if (!s) return out;
  const r = JEWEL_RADIUS[radius];
  for (const n of PASSIVE_NODES) {
    if ((n.kind !== "small" && n.kind !== "notable") || !alloc.has(n.id)) continue;
    if (Math.hypot(n.x - s.x, n.y - s.y) <= r) out[n.kind]++;
  }
  return out;
}

/** Tooltip label prefix for a radius mod. */
export const jewelPerText = (per: "small" | "notable") =>
  per === "small" ? "Allocated Small Passives in Radius also grant " : "Allocated Notable Passives in Radius also grant ";

/**
 * HOOK for the passive tree: modifiers a socketed jewel grants. Keys are ModKeys (map onto Stats via
 * the same math as gear) or FxKeys (server/uniques.ts effects). `ctx` = allocated passives inside the
 * jewel's radius (radius mods scale with it; without ctx they count as zero).
 */
export function jewelModTotals(item: Item, ctx?: JewelRadiusCtx): Partial<Record<ModKey | FxKey, number>> {
  const out: Partial<Record<ModKey | FxKey, number>> = {};
  if (!isJewel(item)) return out;
  const add = (k: ModKey | FxKey, v: number) => (out[k] = (out[k] ?? 0) + v);
  for (const m of item.m) {
    const a = JEWEL_AFFIX_BY_ID.get(m.a);
    if (a) {
      add(a.key, a.per ? m.v * (ctx?.[a.per] ?? 0) : m.v);
      continue;
    }
    const u = uniqueModLine(m.a); // unique jewels
    if (u) {
      const key = u.u.mods[u.i][0] as ModKey | FxKey;
      const per = u.u.radiusLines?.[u.i];
      add(key, per ? m.v * (ctx?.[per] ?? 0) : m.v);
    }
  }
  return out;
}

registerItemKind({ category: "jewel", matches: (it) => JEWEL_BASE_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });
