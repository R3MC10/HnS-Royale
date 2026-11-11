// Charms: automatic, reactive belt trinkets (PoE2 charm system, original names). Each charm fires on
// a trigger (ailment, damage type, low life...), spends charges and grants a short buff; ailment
// charms also remove the ailment that set them off. Quality: +1% duration per point. Charges come
// from kills (royale: there are no wells or checkpoints to refill them). The belt sets how many
// charm slots you have (0-3). Server logic: server/charms.ts. Contract with the inventory agent:
// isCharm, charmSlotsFor, MAX_CHARM_SLOTS (ServerPlayer.charms / InvMsg.charms / charm0-2 targets).
import { registerItemKind } from "../grid";
import { BASE_BY_ID } from "./bases";
import type { Equipment, Item } from "../items";
import type { FxKey } from "./fx";
import type { AffixTier, ItemClass } from "./types";

export const CHARM_PREFIX = "chm_";
export const MAX_CHARM_SLOTS = 3;

export type CharmTrigger =
  | "lowLife" // dropped below 35% life
  | "slowed" // movement slowed (frost aura, chill)
  | "heavyHit" // took a single hit of at least 15% of max life
  | "playerHit" // struck by another player
  | "eliteKill" // killed an elite / boss
  // PoE2 ailment and damage-type triggers (server/charms.ts via the defence pipeline's onAilment / afterHit)
  | "frozen"
  | "ignited"
  | "shocked"
  | "bleeding"
  | "poisoned"
  | "stunned" // stun or electrocute
  | "fireHit" // hit by fire damage
  | "coldHit"
  | "lightHit"
  | "chaosHit";

export const TRIGGER_TEXT: Record<CharmTrigger, string> = {
  lowLife: "when you drop to Low Life",
  slowed: "when you are Slowed",
  heavyHit: "when a heavy blow lands on you",
  playerHit: "when another player hits you",
  eliteKill: "when you slay an elite",
  frozen: "when you are Frozen",
  ignited: "when you are Ignited",
  shocked: "when you are Shocked",
  bleeding: "when you start Bleeding",
  poisoned: "when you are Poisoned",
  stunned: "when you are Stunned",
  fireHit: "when you take Fire Damage from a Hit",
  coldHit: "when you take Cold Damage from a Hit",
  lightHit: "when you take Lightning Damage from a Hit",
  chaosHit: "when you take Chaos Damage from a Hit",
};

export interface CharmDef {
  id: string;
  name: string;
  trigger: CharmTrigger;
  buff: [FxKey, number][]; // granted for `duration` seconds
  heal?: number; // instant % max life on trigger
  duration: number;
  cost: number; // charges used per trigger
  maxCharges: number;
  weight: number;
  minIlvl: number;
  desc: string;
}

export const CHARMS: CharmDef[] = [
  { id: "chm_thawstone", name: "Thawstone Charm", trigger: "slowed", buff: [["slowImmune", 1]], duration: 3, cost: 20, maxCharges: 40, weight: 10, minIlvl: 1, desc: "Unaffected by Slows" },
  { id: "chm_anchor", name: "Anchorweight Charm", trigger: "heavyHit", buff: [["kbImmune", 1]], duration: 3, cost: 20, maxCharges: 40, weight: 10, minIlvl: 1, desc: "Cannot be Knocked Back" },
  { id: "chm_lastbreath", name: "Last-Breath Charm", trigger: "lowLife", buff: [["dmgTakenRed", 25]], duration: 3, cost: 40, maxCharges: 40, weight: 7, minIlvl: 1, desc: "25% less Damage taken" },
  { id: "chm_harefoot", name: "Harefoot Charm", trigger: "lowLife", buff: [["hasteBuff", 30]], duration: 3, cost: 30, maxCharges: 60, weight: 8, minIlvl: 1, desc: "30% increased Movement Speed" },
  { id: "chm_bristle", name: "Bristleback Charm", trigger: "playerHit", buff: [["thorns", 8]], duration: 4, cost: 20, maxCharges: 40, weight: 8, minIlvl: 1, desc: "Reflects 8 Damage to melee attackers" },
  { id: "chm_mender", name: "Mender's Knot Charm", trigger: "heavyHit", buff: [["regenBuff", 8]], duration: 3, cost: 30, maxCharges: 60, weight: 7, minIlvl: 4, desc: "Regenerate 8 Life per second" },
  { id: "chm_gildtooth", name: "Gilded Tooth Charm", trigger: "eliteKill", buff: [], heal: 20, duration: 0, cost: 40, maxCharges: 80, weight: 4, minIlvl: 6, desc: "Recover 20% of maximum Life and the elite drops an extra Ember" },
  // ---- PoE2 charm roster (ailment answers and elemental wards), original names ----
  // Triggering one also removes the ailment that set it off (server/charms.ts), then grants immunity.
  { id: "chm_hearthcoal", name: "Hearthcoal Charm", trigger: "frozen", buff: [["freezeImmune", 1]], duration: 3, cost: 40, maxCharges: 40, weight: 9, minIlvl: 1, desc: "Thaws you and you cannot be Frozen" },
  { id: "chm_wetash", name: "Wet Ash Charm", trigger: "ignited", buff: [["igniteImmune", 1]], duration: 3, cost: 30, maxCharges: 40, weight: 9, minIlvl: 1, desc: "Douses you and you cannot be Ignited" },
  { id: "chm_lodestone", name: "Lodestone Charm", trigger: "shocked", buff: [["shockImmune", 1]], duration: 3, cost: 30, maxCharges: 40, weight: 9, minIlvl: 2, desc: "Grounds you and you cannot be Shocked" },
  { id: "chm_clotroot", name: "Clotroot Charm", trigger: "bleeding", buff: [["bleedImmune", 1]], duration: 3, cost: 30, maxCharges: 40, weight: 8, minIlvl: 2, desc: "Stems Bleeding and you cannot Bleed or be Poisoned" },
  { id: "chm_bitterleaf", name: "Bitterleaf Charm", trigger: "poisoned", buff: [["bleedImmune", 1]], duration: 3, cost: 20, maxCharges: 40, weight: 8, minIlvl: 3, desc: "Purges Poison and you cannot Bleed or be Poisoned" },
  { id: "chm_bedrock", name: "Bedrock Charm", trigger: "stunned", buff: [["stunImmune", 1]], duration: 3, cost: 20, maxCharges: 40, weight: 8, minIlvl: 3, desc: "Breaks the Stun and you cannot be Stunned" },
  { id: "chm_emberglass", name: "Emberglass Charm", trigger: "fireHit", buff: [["resFireBuff", 25]], duration: 4, cost: 20, maxCharges: 40, weight: 7, minIlvl: 4, desc: "+25% to Fire Resistance" },
  { id: "chm_rimeglass", name: "Rimeglass Charm", trigger: "coldHit", buff: [["resColdBuff", 25]], duration: 4, cost: 20, maxCharges: 40, weight: 7, minIlvl: 4, desc: "+25% to Cold Resistance" },
  { id: "chm_stormglass", name: "Stormglass Charm", trigger: "lightHit", buff: [["resLightBuff", 25]], duration: 4, cost: 20, maxCharges: 40, weight: 7, minIlvl: 4, desc: "+25% to Lightning Resistance" },
  { id: "chm_blightglass", name: "Blightglass Charm", trigger: "chaosHit", buff: [["resChaosBuff", 18]], duration: 4, cost: 30, maxCharges: 40, weight: 5, minIlvl: 8, desc: "+18% to Chaos Resistance" },
];

/** Ailments a charm trigger answers: firing the charm removes them (PoE2: the charm cures, then wards). */
export const TRIGGER_CURES: Partial<Record<CharmTrigger, ("freeze" | "ignite" | "shock" | "bleed" | "poison" | "stun" | "electrocute" | "chill")[]>> = {
  frozen: ["freeze", "chill"],
  ignited: ["ignite"],
  shocked: ["shock"],
  bleeding: ["bleed", "poison"],
  poisoned: ["poison", "bleed"],
  stunned: ["stun", "electrocute"],
};

export const CHARM_BY_ID = new Map(CHARMS.map((c) => [c.id, c]));
export const isCharm = (it: Item | null | undefined): it is Item => !!it && CHARM_BY_ID.has(it.b);

/** Charm modifiers (charms are Normal or Magic). Ids c_*; stored in Item.m like flask mods. */
export type CharmModKey =
  | "cDuration" // % increased duration
  | "cCostRed" // % reduced charges used
  | "cGain" // % increased charges gained
  | "cLifeOnUse" // recover flat life when the charm triggers
  | "cManaOnUse" // recover flat mana when the charm triggers
  | "cNoConsume" // % chance to not consume charges
  | "cMaxCharges"; // + maximum charges
export interface CharmAffix {
  id: string;
  kind: "prefix" | "suffix";
  key: CharmModKey;
  name: string;
  min: number;
  max: number;
  weight: number;
  /** Item-level tiers (low -> high). When set, min / max / name mirror the lowest tier. */
  tiers?: AffixTier[];
}
const ct = (ilvl: number, min: number, max: number, name: string): AffixTier => ({ ilvl, min, max, name });
function tieredCharm(id: string, kind: "prefix" | "suffix", key: CharmModKey, weight: number, tiers: AffixTier[]): CharmAffix {
  return { id, kind, key, weight, name: tiers[0].name, min: tiers[0].min, max: tiers[0].max, tiers };
}
/** Charms are Normal or Magic (1 prefix + 1 suffix), affixes tiered by item level (PoE2). */
export const CHARM_AFFIXES: CharmAffix[] = [
  tieredCharm("c_lasting", "prefix", "cDuration", 10, [ct(1, 15, 25, "Lingering"), ct(8, 26, 35, "Abiding"), ct(15, 36, 45, "Undying")]),
  tieredCharm("c_frugal", "prefix", "cCostRed", 8, [ct(1, 10, 18, "Frugal"), ct(8, 19, 25, "Sparing"), ct(15, 26, 32, "Miserly")]),
  tieredCharm("c_mending", "prefix", "cLifeOnUse", 7, [ct(1, 12, 20, "Mending"), ct(7, 21, 35, "Suturing"), ct(14, 36, 55, "Restoring")]),
  tieredCharm("c_musing", "prefix", "cManaOnUse", 5, [ct(3, 10, 16, "Musing"), ct(10, 17, 28, "Pondering")]),
  tieredCharm("c_hungry", "suffix", "cGain", 10, [ct(1, 15, 25, "of Hunger"), ct(8, 26, 35, "of Famine"), ct(15, 36, 45, "of the Glutton")]),
  tieredCharm("c_hoard", "suffix", "cNoConsume", 5, [ct(6, 8, 12, "of Hoarding"), ct(14, 13, 18, "of the Magpie")]),
  tieredCharm("c_deep", "suffix", "cMaxCharges", 6, [ct(1, 6, 10, "of Depth"), ct(10, 11, 16, "of the Abyss")]),
];
export const CHARM_AFFIX_BY_ID = new Map(CHARM_AFFIXES.map((a) => [a.id, a]));
export const charmAffixTiers = (a: CharmAffix): AffixTier[] => a.tiers ?? [{ ilvl: 1, min: a.min, max: a.max, name: a.name }];
export const CHARM_MOD_LABELS: Record<CharmModKey, string> = {
  cDuration: "{v}% increased Charm Duration",
  cCostRed: "{v}% reduced Charges used",
  cGain: "{v}% increased Charges gained",
  cLifeOnUse: "Recover {v} Life when triggered",
  cManaOnUse: "Recover {v} Mana when triggered",
  cNoConsume: "{v}% chance to not consume Charges",
  cMaxCharges: "+{v} maximum Charges",
};

/** Base charm slots per belt base (PoE2: every belt rolls 1-3). Unknown belts default to 1. */
export const BELT_CHARM_SLOTS: Record<string, number> = {
  rope_sash: 1,
  studded_girdle: 2,
};

/** Optional extra source of charm slots (e.g. jewels in the passive tree). */
let extraSlots: (equip: Equipment) => number = () => 0;
export function setExtraCharmSlots(fn: (equip: Equipment) => number) {
  extraSlots = fn;
}

/** Charm slots for an equipment set: belt base + "+N Charm Slot" mods (uniques), capped at 3. No belt = 0. */
export function charmSlotsFor(equip: Equipment): number {
  const belt = equip.belt;
  if (!belt) return 0;
  let n = BASE_BY_ID.get(belt.b)?.charmSlots ?? BELT_CHARM_SLOTS[belt.b] ?? 1;
  n += charmSlotBonus(equip) + extraSlots(equip);
  return Math.max(0, Math.min(MAX_CHARM_SLOTS, n));
}

/** Filled in by shared/fx.ts (sums the charmSlots effect over equipment) to avoid an import cycle. */
let charmSlotBonus: (equip: Equipment) => number = () => 0;
export function setCharmSlotBonus(fn: (equip: Equipment) => number) {
  charmSlotBonus = fn;
}

export const CHARM_CLASS: ItemClass | "charm" = "charm";
export const CHARM_COLOR = "#7fc8a8";

registerItemKind({ category: "charm", matches: (it) => CHARM_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });
