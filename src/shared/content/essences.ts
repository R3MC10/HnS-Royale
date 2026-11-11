// Ichors (our essences), PoE2 rules with original names:
// - Faint / plain / Potent ichors upgrade a Magic item to Rare and add one guaranteed modifier from
//   the ichor's family. The guaranteed tier is fixed by the ichor grade (not by item level).
// - Primeval ichors work on Rares: they remove one random modifier and add the family's top tier.
// Item ids are kept from the first pass (ess_<fam>, ess_<fam>_potent); grades were added around them.
import { registerItemKind } from "../grid";
import type { Item } from "../items";

export const ESSENCE_PREFIX = "ess_";

/** 0 faint (lesser) / 1 plain / 2 potent (greater) / 3 primeval (perfect: Rare items). */
export type EssenceGrade = 0 | 1 | 2 | 3;

export interface EssenceDef {
  id: string;
  name: string;
  affix: string; // affix id from content/affixes.ts
  grade: EssenceGrade;
  /** Kept for older callers: grade >= 2. */
  potent: boolean;
  weight: number;
  minIlvl: number;
}

const FAMILIES: [string, string, string][] = [
  // [suffix of id, display word, affix id]
  ["vital", "Vital", "life"],
  ["swift", "Swift", "move"],
  ["keen", "Keen", "dmg_flat"],
  ["wrath", "Wrathful", "dmg_inc"],
  ["restless", "Restless", "atk_speed"],
  ["lucid", "Lucid", "mana"],
  ["verdant", "Verdant", "regen"],
  ["eel", "Slippery", "dodge_cd"],
  ["incant", "Chanting", "spell_inc"],
];

const GRADES: { g: EssenceGrade; suffix: string; word: string; weight: number; minIlvl: number }[] = [
  { g: 0, suffix: "_faint", word: "Faint ", weight: 9, minIlvl: 1 },
  { g: 1, suffix: "", word: "", weight: 6, minIlvl: 5 },
  { g: 2, suffix: "_potent", word: "Potent ", weight: 2.5, minIlvl: 10 },
  { g: 3, suffix: "_primeval", word: "Primeval ", weight: 0.6, minIlvl: 15 },
];

export const ESSENCES: EssenceDef[] = FAMILIES.flatMap(([id, word, affix]) =>
  GRADES.map((G) => ({
    id: `${ESSENCE_PREFIX}${id}${G.suffix}`,
    name: `${G.word}${word} Ichor`,
    affix,
    grade: G.g,
    potent: G.g >= 2,
    weight: G.weight,
    minIlvl: G.minIlvl,
  })),
);

export const ESSENCE_BY_ID = new Map(ESSENCES.map((e) => [e.id, e]));
export const isEssence = (it: Item | null | undefined): it is Item => !!it && ESSENCE_BY_ID.has(it.b);

/**
 * Tier index (into the affix's tier list, low -> high) an ichor guarantees. PoE2: the essence grade
 * fixes the tier, proportional to the ladder: on a 3-tier ladder faint = lowest, plain = middle,
 * potent / primeval = top; on longer ladders potent sits one below the top and primeval at it.
 */
export function essenceTier(grade: EssenceGrade, tierCount: number): number {
  const top = Math.max(0, tierCount - 1);
  if (grade === 0) return Math.floor(top * 0.34);
  if (grade === 1) return Math.round(top * 0.6);
  if (grade === 2) return top - (top >= 4 ? 1 : 0);
  return top;
}

/** Item family word for an ichor id ("vital" for ess_vital_potent). */
export const essenceFamily = (id: string) => id.replace(ESSENCE_PREFIX, "").replace(/_(faint|potent|primeval)$/, "");

export const ESSENCE_COLOR = "#d07fd0";

registerItemKind({ category: "essence", matches: (it) => ESSENCE_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });
