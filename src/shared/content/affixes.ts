// Prefixes and suffixes. Tiers are gated by item level. All names are original.
import type { Affix, ItemBase, ItemClass, ModKey } from "./types";
import { GEAR_AFFIXES } from "./gearaffixes";

// Gear prefix / suffix tier tables live in content/gearaffixes.ts (PoE2-style: groups, many
// item-level-gated tiers, per-class / per-defence-tag pools, local and hybrid mods). Other areas may
// push extra families below.
export const AFFIXES: Affix[] = [...GEAR_AFFIXES];

// ---- Loot find (rarity area: server/loot.ts reads it off the killer's gear) ----
// PoE2: "% increased Rarity of Items found" is a suffix on helmets, gloves, boots, rings and amulets,
// and a separate prefix family on helmets, rings and amulets (an item can carry both).
AFFIXES.push({
  id: "find_rarity_p", kind: "prefix", key: "rarityInc", weight: 4, classes: ["helmet", "ring", "amulet"],
  tiers: [
    { ilvl: 4, min: 8, max: 11, name: "Magpie's" },
    { ilvl: 10, min: 12, max: 16, name: "Grave-Robber's" },
    { ilvl: 16, min: 17, max: 22, name: "Hoarder's" },
  ],
});
AFFIXES.push({
  id: "find_rarity", kind: "suffix", key: "rarityInc", weight: 4, classes: ["helmet", "gloves", "boots", "ring", "amulet"],
  tiers: [
    { ilvl: 2, min: 6, max: 10, name: "of the Magpie" },
    { ilvl: 9, min: 11, max: 16, name: "of the Grave-Robber" },
    { ilvl: 15, min: 17, max: 24, name: "of the Hoard" },
  ],
});

export const AFFIX_BY_ID = new Map(AFFIXES.map((a) => [a.id, a]));

/** Tooltip text per modifier; {v} is replaced by the value. */
export const MOD_LABELS: Record<ModKey, string> = {
  life: "+{v} to maximum Life",
  moveInc: "{v}% increased Movement Speed",
  dmgFlat: "+{v} Attack Damage",
  dmgInc: "{v}% increased Attack Damage",
  atkSpeedInc: "{v}% increased Attack Speed",
  reach: "+{v} Attack Reach",
  kbInc: "{v}% increased Knockback",
  dodgeCdRed: "{v}% reduced Dodge Cooldown",
  regen: "Regenerate {v} Life per second",
  flaskGainInc: "{v}% increased Flask Charges gained",
  flaskRecInc: "{v}% increased Flask Recovery",
  mana: "+{v} to maximum Mana",
  manaRegen: "Regenerate {v} Mana per second",
  spellInc: "{v}% increased Spell Damage",
  spirit: "+{v} to Spirit",
  arcInc: "{v}% increased Attack Arc",
  armour: "+{v} to Armour",
  armourInc: "{v}% increased Armour",
  evasion: "+{v} to Evasion Rating",
  evasionInc: "{v}% increased Evasion Rating",
  es: "+{v} to maximum Energy Shield",
  esInc: "{v}% increased Energy Shield",
  esStart: "{v}% faster start of Energy Shield Recharge",
  block: "+{v}% Chance to Block",
  resFire: "+{v}% to Fire Resistance",
  resCold: "+{v}% to Cold Resistance",
  resLight: "+{v}% to Lightning Resistance",
  resChaos: "+{v}% to Chaos Resistance",
  resAll: "+{v}% to all Elemental Resistances",
  maxRes: "+{v}% to all maximum Elemental Resistances",
  accuracy: "+{v} to Accuracy Rating",
  ailThr: "{v}% increased Ailment Threshold",
  stunThr: "{v}% increased Stun Threshold",
  critInc: "{v}% increased Critical Hit Chance",
  critMulti: "+{v}% to Critical Damage Bonus",
  // Local weapon / armour mods (PoE2 wording; locality is implied by the item they sit on).
  lDmgFlat: "Adds {v} Physical Damage",
  lDmgInc: "{v}% increased Physical Damage",
  lAtkSpd: "{v}% increased Attack Speed",
  lCrit: "+{v}% to Critical Hit Chance",
  lAr: "+{v} to Armour",
  lEv: "+{v} to Evasion Rating",
  lEs: "+{v} to maximum Energy Shield",
  lArInc: "{v}% increased Armour",
  lEvInc: "{v}% increased Evasion Rating",
  lEsInc: "{v}% increased Energy Shield",
  lArEvInc: "{v}% increased Armour and Evasion",
  lArEsInc: "{v}% increased Armour and Energy Shield",
  lEvEsInc: "{v}% increased Evasion and Energy Shield",
  lBlockInc: "{v}% increased Block chance",
  str: "+{v} to Strength",
  dex: "+{v} to Dexterity",
  int: "+{v} to Intelligence",
  allAttr: "+{v} to all Attributes",
  castInc: "{v}% increased Cast Speed",
  lvlSpell: "+{v} to Level of all Spell Skills",
  lvlMelee: "+{v} to Level of all Melee Skills",
  lvlProj: "+{v} to Level of all Projectile Skills",
  lvlFire: "+{v} to Level of all Fire Spell Skills",
  lvlCold: "+{v} to Level of all Cold Spell Skills",
  lvlLight: "+{v} to Level of all Lightning Spell Skills",
  rarityInc: "{v}% increased Rarity of Items found",
  quantInc: "{v}% increased Quantity of Items found",
};

/** How many affixes each rarity rolls: [min, max]. Max 3 prefixes + 3 suffixes. */
export const RARITY_MOD_COUNT: Record<0 | 1 | 2 | 3, [number, number]> = {
  0: [0, 0],
  1: [1, 2],
  2: [4, 6], // PoE2: a fresh rare has 4-6 mods (any prefix / suffix split within 3 + 3)
  3: [0, 0], // unique: fixed mods
};
export const MAX_PREFIXES = 3;
export const MAX_SUFFIXES = 3;
/** Magic items: at most this many of each kind. */
export const MAGIC_MAX_PER_KIND = 1;

// ---- PoE2 mod-pool rules (shared by server/loot.ts rolling, server/crafting.ts and tooltips) ----

/** Mod group: an item never carries two modifiers of one group. */
export function affixGroup(a: { id: string; group?: string }): string {
  return a.group ?? a.id;
}

/** Relative spawn weight of tier `idx` (x the affix weight): explicit, else higher tiers are rarer. */
export function tierWeight(a: { tiers: { weight?: number }[] }, idx: number): number {
  return a.tiers[idx]?.weight ?? Math.max(0.25, 1 - 0.12 * idx);
}

/** Can this affix roll on this base (class, weapon kind, off-hand subtype, defence tag)? */
export function affixAllowed(a: Affix, base: ItemBase): boolean {
  if (!a.classes.includes(base.cls)) return false;
  if (base.cls === "weapon" && a.weapons && (!base.weapon || !a.weapons.includes(base.weapon.kind))) return false;
  if (base.cls === "offhand" && a.subs && (!base.sub || !a.subs.includes(base.sub))) return false;
  if (a.defTags && (!base.def || !a.defTags.includes(base.def))) return false;
  const tags = a.classTags?.[base.cls] ?? a.armourTags; // per-class list wins over the general one
  if (tags && base.def && !tags.includes(base.def)) return false;
  return true;
}

/** Every affix that can roll on `base`. */
export function affixesFor(base: ItemBase): Affix[] {
  return AFFIXES.filter((x) => affixAllowed(x, base));
}

export interface TierRange {
  min: number;
  max: number;
  min2?: number;
  max2?: number;
}

/** Roll range of tier `idx` on `base` (two-handed weapons scale by Affix.twoHand). */
export function tierRange(a: Pick<Affix, "tiers" | "twoHand" | "decimals">, idx: number, base?: ItemBase): TierRange | null {
  const t = a.tiers[Math.max(0, Math.min(idx, a.tiers.length - 1))];
  if (!t) return null;
  const m = a.twoHand && base?.weapon?.twoHand ? a.twoHand : 1;
  const p = Math.pow(10, a.decimals ?? 0);
  const sc = (v: number) => Math.round(v * m * p) / p;
  const out: TierRange = { min: sc(t.min), max: sc(t.max) };
  if (t.min2 !== undefined) {
    out.min2 = sc(t.min2);
    out.max2 = sc(t.max2 ?? t.min2);
  }
  return out;
}

/** Roll a value (and the hybrid second value) inside tier `idx`. `rnd` returns [0, 1). */
export function rollTier(a: Pick<Affix, "tiers" | "twoHand" | "decimals">, idx: number, base: ItemBase | undefined, rnd: () => number): { v: number; v2?: number } {
  const r = tierRange(a, idx, base) ?? { min: 0, max: 0 };
  const p = Math.pow(10, a.decimals ?? 0);
  const roll = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * p) / p;
  return r.min2 !== undefined ? { v: roll(r.min, r.max), v2: roll(r.min2, r.max2!) } : { v: roll(r.min, r.max) };
}

/** Tier number as PoE2 shows it: 1 = best tier of the family. */
export function tierNumber(a: { tiers: unknown[] }, idx: number): number {
  return a.tiers.length - idx;
}
