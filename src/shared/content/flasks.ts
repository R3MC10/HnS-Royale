// Life and mana flasks: bases and flask-only modifiers (PoE2 flask system, original names).
//
// PoE2 rules kept: a life ladder and a mana ladder of base tiers gated by item level, each base with
// its own recovery amount and recovery time; every use costs 10 charges; charges refill from kills
// (server/game.ts addCharges: more for elites and players); flasks are Normal or Magic (1 prefix +
// 1 suffix) or Unique; affixes are tiered by item level; quality raises the amount recovered.
// Royale adaptation: recovery times are shorter than PoE2's 2-5 s (fights are short, no towns or
// wells to refill), and pools are smaller to match this game's life totals. In place of wells, an
// empty flask trickles back to one use while its owner takes no damage (constants.ts FLASK_TRICKLE_*).
import type { AffixTier, FlaskAffix, FlaskBase } from "./types";

/** PoE2: every life and mana flask costs 10 charges per use. */
export const FLASK_CHARGES_PER_USE = 10;

export const FLASK_BASES: FlaskBase[] = [
  // ---- life ladder (9 tiers, like PoE2's; ids of the original five kept) ----
  { id: "tin_draught", name: "Tin Draught", reqIlvl: 1, weight: 10, maxCharges: 30, chargesPerUse: 10, heal: 45, duration: 2.5 },
  { id: "pewter_draught", name: "Pewter Draught", reqIlvl: 3, weight: 9, maxCharges: 32, chargesPerUse: 10, heal: 58, duration: 3 },
  { id: "copper_draught", name: "Copper Draught", reqIlvl: 5, weight: 8, maxCharges: 34, chargesPerUse: 10, heal: 72, duration: 2.8 },
  { id: "bronze_draught", name: "Bronze Draught", reqIlvl: 7, weight: 7, maxCharges: 36, chargesPerUse: 10, heal: 88, duration: 3 },
  { id: "ironbound_draught", name: "Ironbound Draught", reqIlvl: 9, weight: 6, maxCharges: 38, chargesPerUse: 10, heal: 105, duration: 2.8 },
  { id: "silvered_draught", name: "Silvered Draught", reqIlvl: 11, weight: 5, maxCharges: 40, chargesPerUse: 10, heal: 125, duration: 2.8 },
  { id: "gilt_draught", name: "Gilt Draught", reqIlvl: 13, weight: 5, maxCharges: 40, chargesPerUse: 10, heal: 150, duration: 3 },
  { id: "blackglass_draught", name: "Blackglass Draught", reqIlvl: 16, weight: 4, maxCharges: 40, chargesPerUse: 10, heal: 175, duration: 2.8 },
  { id: "saintsblood_draught", name: "Saintsblood Draught", reqIlvl: 19, weight: 3, maxCharges: 40, chargesPerUse: 10, heal: 200, duration: 2.5 },
  // ---- mana ladder (same level gates as the life ladder) ----
  { id: "inkwell_phial", name: "Inkwell Phial", res: "mana", reqIlvl: 1, weight: 8, maxCharges: 30, chargesPerUse: 10, heal: 35, duration: 1.6 },
  { id: "slate_phial", name: "Slate Phial", res: "mana", reqIlvl: 3, weight: 7, maxCharges: 32, chargesPerUse: 10, heal: 44, duration: 2 },
  { id: "cobalt_phial", name: "Cobalt Phial", res: "mana", reqIlvl: 5, weight: 7, maxCharges: 34, chargesPerUse: 10, heal: 54, duration: 1.8 },
  { id: "indigo_phial", name: "Indigo Phial", res: "mana", reqIlvl: 7, weight: 6, maxCharges: 36, chargesPerUse: 10, heal: 64, duration: 1.8 },
  { id: "azure_phial", name: "Azure Phial", res: "mana", reqIlvl: 9, weight: 5, maxCharges: 38, chargesPerUse: 10, heal: 74, duration: 2.2 },
  { id: "tidewater_phial", name: "Tidewater Phial", res: "mana", reqIlvl: 11, weight: 5, maxCharges: 40, chargesPerUse: 10, heal: 84, duration: 1.8 },
  { id: "nightwell_phial", name: "Nightwell Phial", res: "mana", reqIlvl: 13, weight: 4, maxCharges: 40, chargesPerUse: 10, heal: 94, duration: 1.6 },
  { id: "starwater_phial", name: "Starwater Phial", res: "mana", reqIlvl: 16, weight: 4, maxCharges: 40, chargesPerUse: 10, heal: 108, duration: 2.2 },
  { id: "aetherwell_phial", name: "Aetherwell Phial", res: "mana", reqIlvl: 19, weight: 3, maxCharges: 40, chargesPerUse: 10, heal: 120, duration: 2 },
];

export const FLASK_BASE_BY_ID = new Map(FLASK_BASES.map((f) => [f.id, f]));

/** Every player starts with this flask at half charges. */
export const STARTING_FLASK = "tin_draught";

/** Fully instant recovery recovers this much less (PoE2: instant flask mods trade amount for speed). */
export const INSTANT_PENALTY = 0.3;

const t = (ilvl: number, min: number, max: number, name: string): AffixTier => ({ ilvl, min, max, name });
/** Affix with item-level tiers; min / max / name mirror the lowest tier. */
function tiered(id: string, kind: "prefix" | "suffix", key: FlaskAffix["key"], weight: number, tiers: AffixTier[]): FlaskAffix {
  return { id, kind, key, weight, name: tiers[0].name, min: tiers[0].min, max: tiers[0].max, tiers };
}

/** Flasks are Normal or Magic (max 1 prefix + 1 suffix), like PoE2. */
export const FLASK_AFFIXES: FlaskAffix[] = [
  // ---- prefixes: how the flask recovers ----
  tiered("f_potent", "prefix", "fRecInc", 10, [t(1, 15, 25, "Potent"), t(7, 26, 35, "Brimming"), t(14, 36, 45, "Overflowing")]),
  tiered("f_snapcork", "prefix", "fInstant", 4, [t(1, 1, 1, "Snapcork")]),
  tiered("f_boiling", "prefix", "fPartInstant", 6, [t(3, 20, 30, "Hissing"), t(10, 31, 40, "Boiling"), t(16, 41, 50, "Scalding")]),
  tiered("f_quick", "prefix", "fRateInc", 8, [t(1, 15, 25, "Quickened"), t(9, 26, 40, "Hastened"), t(16, 41, 55, "Torrential")]),
  tiered("f_desperate", "prefix", "fLowInstant", 5, [t(5, 1, 1, "Desperate")]),
  // ---- suffixes: charges and cures ----
  tiered("f_spring", "suffix", "fMaxCharges", 10, [t(1, 5, 8, "of the Spring"), t(8, 9, 12, "of the Cistern"), t(15, 13, 16, "of the Wellspring")]),
  tiered("f_thirst", "suffix", "fGainInc", 10, [t(1, 15, 25, "of Thirst"), t(8, 26, 35, "of Craving"), t(15, 36, 45, "of Gluttony")]),
  tiered("f_frugal", "suffix", "fChargesRed", 8, [t(1, 10, 15, "of Thrift"), t(8, 16, 22, "of Scrimping"), t(15, 23, 30, "of the Miser")]),
  tiered("f_spare", "suffix", "fNoConsume", 5, [t(6, 8, 12, "of Sparing"), t(14, 13, 18, "of Hoarding")]),
  tiered("f_clot", "suffix", "fCureBleed", 5, [t(4, 1, 1, "of Clotting")]),
  tiered("f_quench", "suffix", "fCureElem", 5, [t(4, 1, 1, "of Quenching")]),
  tiered("f_steady", "suffix", "fCureStun", 4, [t(6, 1, 1, "of Steadying")]),
];

export const FLASK_AFFIX_BY_ID = new Map(FLASK_AFFIXES.map((a) => [a.id, a]));

/** Tiers of a flask affix (single-range affixes become one tier). */
export const flaskAffixTiers = (a: FlaskAffix): AffixTier[] => a.tiers ?? [{ ilvl: 1, min: a.min, max: a.max, name: a.name }];

export const FLASK_MOD_LABELS: Record<FlaskAffix["key"], string> = {
  fRecInc: "{v}% increased Amount Recovered",
  fInstant: `Instant Recovery, ${Math.round(INSTANT_PENALTY * 100)}% less Amount Recovered`,
  fMaxCharges: "+{v} maximum Charges",
  fGainInc: "{v}% increased Charges gained",
  fChargesRed: "{v}% reduced Charges per use",
  fPartInstant: "{v}% of Recovery applied Instantly",
  fRateInc: "{v}% increased Recovery rate",
  fLowInstant: "Instant Recovery when on Low Life",
  fCureBleed: "Removes Bleeding and Poison when used",
  fCureElem: "Removes Ignite, Chill, Freeze and Shock when used",
  fCureStun: "Removes Stun and Electrocution when used",
  fNoConsume: "{v}% chance to not consume Charges",
  fAmountMore: "{v}% more Amount Recovered",
};

/** Chance a dropped flask is magic (otherwise normal). */
export const FLASK_MAGIC_CHANCE = 0.6;
