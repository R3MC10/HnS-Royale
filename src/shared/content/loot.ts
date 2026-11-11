// Drop tables per source. Item level gates which bases, affix tiers and currencies can appear.
// PoE2 rules (server/loot.ts rollDrops): a monster's drops take its monster level as item level
// (+1 magic / rare, +2 unique); the `ilvl` ranges below are only the fallback for sources without
// a level (exiles, dev drops). Monster rarity and the killer's rarity / quantity scale the rolls.

export interface DropTable {
  /** Chance for each roll in `rolls` to produce an item. */
  itemChances: number[];
  flaskChance: number;
  ilvl: [number, number];
  /** Relative weights for normal / magic / rare (base ratio before rarity bonuses). */
  rarity: [number, number, number];
}

// Base ratio from a normal monster is roughly PoE2's: most gear white, a third magic, a few rares.
export const DROPS: Record<"normal" | "elite", DropTable> = {
  normal: { itemChances: [0.35], flaskChance: 0.08, ilvl: [1, 6], rarity: [62, 31, 7] },
  elite: { itemChances: [1, 1, 0.5], flaskChance: 0.45, ilvl: [9, 16], rarity: [10, 52, 38] },
};

/**
 * PoE2 monster-rarity loot bonuses, indexed by monster rarity (normal / magic / rare / unique).
 * quant / rarity: % increased item quantity / rarity of what it drops; ilvl: item level over the
 * monster level. Rares and uniques already roll the richer elite / boss tables, so their bonus
 * here is the extra on top (plus server/ai/hooks.ts gives rares bonus rolls per modifier).
 */
export const MONSTER_LOOT_BONUS: { quant: number; rarity: number; ilvl: number }[] = [
  { quant: 0, rarity: 0, ilvl: 0 },
  { quant: 60, rarity: 40, ilvl: 1 },
  { quant: 0, rarity: 0, ilvl: 1 },
  { quant: 0, rarity: 0, ilvl: 2 },
];

/** Caps on the killer's own rarity / quantity (royale: keeps a stacked-find build from flooding). */
export const MAX_FIND_RARITY = 200;
export const MAX_FIND_QUANT = 60;

/** Rare item names: A + B. */
export const RARE_NAME_A = ["Ember", "Gloom", "Bitter", "Hollow", "Storm", "Rust", "Dread", "Ashen", "Pale", "Thorn", "Grave", "Brine"];
export const RARE_NAME_B = ["Bite", "Whisper", "Mark", "Ward", "Coil", "Vow", "Song", "Shroud", "Grip", "Lament", "Spur", "Knell"];

export const RARITY_NAMES = ["Normal", "Magic", "Rare", "Unique"] as const;
export const RARITY_COLORS = ["#e8e8e8", "#8a9cff", "#ffe066", "#d8873a"] as const;

// ---- loot agent: currency / uniques / runes / ichors / charms / jewels ------------------------
// Tuned so one player who clears ~15 normals, ~4 magic monsters and 2 rares in a match finds a
// handful (~5-7) of Embers, a rune or ichor, and has a real shot (~15%) at a unique; bosses and
// strongboxes are the jackpots. Quantity (monster rarity, killer's gear) scales every roll here.

export type DropSource = "normal" | "elite" | "boss" | "chest" | "strongbox";

export interface ExtraDropTable {
  currency: number[]; // one roll per entry
  rune: number;
  essence: number;
  unique: number;
  charm: number;
  jewel: number;
  ilvl: [number, number];
}

export const EXTRA_DROPS: Record<DropSource, ExtraDropTable> = {
  normal: { currency: [0.085], rune: 0.02, essence: 0.012, unique: 0.003, charm: 0.02, jewel: 0.01, ilvl: [1, 6] },
  elite: { currency: [1, 0.6, 0.3], rune: 0.25, essence: 0.2, unique: 0.06, charm: 0.2, jewel: 0.12, ilvl: [9, 16] },
  boss: { currency: [1, 1, 1, 0.5], rune: 0.6, essence: 0.5, unique: 0.5, charm: 0.4, jewel: 0.4, ilvl: [14, 20] },
  chest: { currency: [1, 0.5], rune: 0.3, essence: 0.2, unique: 0.03, charm: 0.2, jewel: 0.15, ilvl: [4, 12] },
  strongbox: { currency: [1, 1, 0.6], rune: 0.5, essence: 0.4, unique: 0.12, charm: 0.3, jewel: 0.3, ilvl: [8, 18] },
};

/** Gear drops for the new sources (chests / strongboxes / bosses), same shape as DROPS. */
export const POI_DROPS: Record<"boss" | "chest" | "strongbox", DropTable> = {
  boss: { itemChances: [1, 1, 1, 0.5], flaskChance: 0.8, ilvl: [14, 20], rarity: [0, 40, 60] },
  chest: { itemChances: [1, 0.5], flaskChance: 0.3, ilvl: [4, 12], rarity: [30, 50, 20] },
  strongbox: { itemChances: [1, 1, 0.7], flaskChance: 0.4, ilvl: [8, 18], rarity: [5, 50, 45] },
};
