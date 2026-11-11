// Per-match progression content: base classes, the XP curve, XP rewards and attribute rules.
// Every name here is original to this project. Logic lives in src/server/progression.ts and
// src/shared/progression.ts (shared stat math).
import type { PassiveMods } from "./passives";
import type { WeaponKind } from "./types";

// ---- tunables -----------------------------------------------------------------

export const MAX_LEVEL = 40;
/** Passive points per level gained (level 1 starts with 0). */
export const POINTS_PER_LEVEL = 1;
/** Flat life / mana granted per level above 1 (PoE-style "you get sturdier as you level"). */
export const LIFE_PER_LEVEL = 8;
export const MANA_PER_LEVEL = 4;
/**
 * Spirit milestones (PoE2 grants 100 Spirit over the campaign; our matches level fast, so it comes
 * early): [level, spirit]. Lets persistent / meta gems switch on mid-match without spirit gear.
 */
export const SPIRIT_MILESTONES: [level: number, spirit: number][] = [
  [3, 30],
  [8, 30],
  [14, 40],
];
export const spiritForLevel = (level: number): number => SPIRIT_MILESTONES.reduce((n, [l, v]) => n + (level >= l ? v : 0), 0);

/** Level at which a trial shrine can be activated (unlocks the ascendancy pick). */
export const ASCEND_LEVEL = 10;
/** Ascendancy points granted on picking an ascendancy. */
export const ASC_POINTS_ON_PICK = 2;
/** Further ascendancy points: [level, points] steps (PoE-style steps of 2). Granted once ascended. */
export const ASC_POINT_STEPS: [number, number][] = [
  [16, 2],
  [22, 2],
  [28, 2],
];

/** Trial shrine: honour is a separate pool drained by damage taken during the trial; 0 = failed. */
export const TRIAL_HONOUR = 100;

/** XP needed to go from `level` to `level + 1`. Tuned so a typical match ends around 20-30. */
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(18 + 4.5 * Math.pow(level, 1.45));
}

/** Base XP per monster type id (normal tier). Unknown types fall back to their max life / 3. */
export const MONSTER_XP: Record<string, number> = {
  gnashling: 12,
  bog_seer: 14,
  cragback: 30,
  // Bosses: about +4 levels for a kill at level 13 (x20 boss tier, x1.6 at monster level 13). Was 87 / 97 / 93,
  // about +8 levels (round 14, docs/BALANCE.md).
  rotwood_matriarch: 30,
  gulpmaw: 34,
  shattered_warden: 33,
};
/** Rarity multipliers on the type's base XP: normal 1, magic 2, rare 5, unique / boss (incl. trial guardians) 20. */
export const XP_TIER_MULT = { normal: 1, magic: 2, rare: 5, boss: 20 } as const;
export type MonsterTier = keyof typeof XP_TIER_MULT;

/** Player kill XP: a big chunk, scaled by the victim's level. */
export const PLAYER_KILL_XP_BASE = 60; // was 200: a kill gave +3 levels and snowballed; loot is the real reward
export const PLAYER_KILL_XP_PER_LEVEL = 12; // was 40

// ---- attributes ------------------------------------------------------------------
// Small passive bonuses for now; gear / gem requirements can use them later.
export const ATTR_RULES = {
  strLife: 0.5, // + max life per Strength
  strDmg: 0.2, // % increased attack damage per Strength
  dexEvasion: 2, // + evasion rating per Dexterity
  dexAtkSpeed: 0.1, // % increased attack speed per Dexterity
  intMana: 0.5, // + max mana per Intelligence
  intBarrier: 0.4, // + max barrier per Intelligence
};

// ---- defences ----------------------------------------------------------------------
export const DEFENCE = {
  /** Armour: reduction = A / (A + ARMOUR_K * hit), capped. Strong vs small hits, weak vs big ones. */
  armourK: 12,
  armourCap: 0.6,
  /** Evasion: chance = E / (E + EVASION_K), capped; resolved with entropy (no long lucky streaks). */
  evasionK: 300,
  evasionCap: 0.5,
  /** Elemental resistance cap (%). Applies to monster spells / blasts. */
  resistCap: 60,
  /** Barrier recharges after this long without taking damage, at RECHARGE fraction of max per s. */
  barrierDelay: 2.5,
  barrierRecharge: 0.25,
};

// ---- classes -----------------------------------------------------------------------
// Attribute spread: one STR, two DEX, two INT, and the three hybrids. Two classes share each pure
// DEX / INT region of the tree. Concepts are original to this project.

export type ClassId =
  | "reaver"
  | "harrier"
  | "gutterblade"
  | "gloamcaller"
  | "lanternwright"
  | "drifter"
  | "mistrunner"
  | "bellwarden";

export interface ClassDef {
  id: ClassId;
  name: string;
  blurb: string; // short picker description
  attrs: string; // e.g. "STR" or "STR / DEX"
  base: { str: number; dex: number; int: number; armour: number; evasion: number; barrier: number };
  /** Tree start node id (see passives.ts). */
  start: string;
  /** Look digit appended to the paper-doll code (1..8) and the cloth tint the client uses. */
  look: number;
  tint: string;
  ascendancies: [string, string, string];
  /** One-line playstyle shown in the hall's class showcase. */
  playstyle: string;
  /** How forgiving the class is for a new player: 1 straightforward, 2 moderate, 3 demanding. */
  difficulty: 1 | 2 | 3;
  /** Bright identity colour: tree heatmap region, showcase accents, legends. */
  color: string;
  /** Starting skill gem id (gems.ts), socketed on RMB each match. Must be usable with the class weapon. */
  starter: string;
  /** Signature class trait: a small innate passive every match (added in totalMods, shared/progression.ts);
   *  its lines are the passive labels (modLines), so they translate like tree nodes. */
  trait: { name: string; mods: PassiveMods };
  /**
   * Passive tree placement (passives.ts): angle of the class start on the outer ring, degrees (-90 = up).
   * Omit it and the tree builder puts the class in the widest gap between existing starts.
   */
  treeDeg?: number;
}

/**
 * Starter weapon per class: preferred weapon kinds in order; the first that has a starter base in
 * the item catalogue (bases.ts STARTER_WEAPONS) wins. Single table to update as weapons land.
 */
export const CLASS_WEAPONS: Record<ClassId, string[]> = {
  reaver: ["axe", "mace"],
  harrier: ["bow", "crossbow", "spear"],
  gutterblade: ["dagger"],
  gloamcaller: ["staff", "dagger"],
  lanternwright: ["wand", "sceptre", "staff", "dagger"],
  drifter: ["sword"],
  mistrunner: ["quarterstaff", "spear"],
  bellwarden: ["mace", "axe"],
};

export const CLASSES: ClassDef[] = [
  {
    id: "reaver",
    name: "Reaver",
    blurb: "A pit-born brute. Heavy blows, thick hide, feeds on the fight.",
    attrs: "STR",
    base: { str: 24, dex: 8, int: 8, armour: 40, evasion: 0, barrier: 0 },
    start: "start_reaver",
    look: 1,
    tint: "#6a2a1e",
    ascendancies: ["bloodsworn", "stonewarden", "pitking"],
    playstyle: "Close-range bruiser: wade in with big axe blows and let armour soak the hits.",
    difficulty: 1,
    color: "#e0533a",
    starter: "sundering_blow",
    trait: { name: "Pit-Fed", mods: { lifeOnKill: 4 } },
    treeDeg: 150,
  },
  {
    id: "harrier",
    name: "Harrier",
    blurb: "Hunts from afar and never stands where the arrows land.",
    attrs: "DEX",
    base: { str: 10, dex: 22, int: 8, armour: 0, evasion: 40, barrier: 0 },
    start: "start_harrier",
    look: 2,
    tint: "#2f4a2a",
    ascendancies: ["windrunner", "huntmaster", "gallowsbow"],
    playstyle: "Ranged skirmisher: keep moving, keep distance, rain arrows from cover.",
    difficulty: 2,
    color: "#6cc35a",
    starter: "splinter_volley",
    trait: { name: "Light Feet", mods: { dodgeCdRed: 12 } },
    treeDeg: 16,
  },
  {
    id: "gutterblade",
    name: "Gutterblade",
    blurb: "Back-alley knife work: first cut, deepest cut, then gone.",
    attrs: "DEX",
    base: { str: 8, dex: 24, int: 8, armour: 0, evasion: 50, barrier: 0 },
    start: "start_gutterblade",
    look: 3,
    tint: "#3a3036",
    ascendancies: ["alleyknife", "ratking", "debtcollector"],
    playstyle: "Hit-and-run duellist: fast dagger strikes, then roll out before they answer.",
    difficulty: 3,
    color: "#d0457a",
    starter: "opening_cut",
    trait: { name: "First Cut", mods: { firstHitDmg: 20 } },
    treeDeg: 44,
  },
  {
    id: "gloamcaller",
    name: "Gloamcaller",
    blurb: "Wears the dusk as armour and drinks from the dying.",
    attrs: "INT",
    base: { str: 8, dex: 10, int: 22, armour: 0, evasion: 0, barrier: 20 },
    start: "start_gloamcaller",
    look: 4,
    tint: "#2e2a52",
    ascendancies: ["hexweaver", "mothwarden", "dirgesinger"],
    playstyle: "Caster behind a barrier: spells from a distance, energy shield instead of armour.",
    difficulty: 2,
    color: "#8a7af0",
    starter: "glacial_lance",
    trait: { name: "Dusk Drinker", mods: { barrierOnKill: 12 } },
    treeDeg: -104,
  },
  {
    id: "lanternwright",
    name: "Lanternwright",
    blurb: "Carries a caged flame that burns brighter with every death.",
    attrs: "INT",
    base: { str: 8, dex: 8, int: 24, armour: 0, evasion: 0, barrier: 15 },
    start: "start_lanternwright",
    look: 5,
    tint: "#6a4a1a",
    ascendancies: ["pyrebinder", "beaconkeeper", "tallowsworn"],
    playstyle: "Fire caster: burn crowds from range with wand spells; fragile up close.",
    difficulty: 2,
    color: "#ffb83a",
    starter: "cinderbolt",
    trait: { name: "Caged Flame", mods: { killNova: 10 } },
    treeDeg: -76,
  },
  {
    id: "drifter",
    name: "Drifter",
    blurb: "Sword for hire. Takes whatever the dead leave behind.",
    attrs: "STR / DEX",
    base: { str: 16, dex: 16, int: 8, armour: 12, evasion: 20, barrier: 0 },
    start: "start_drifter",
    look: 6,
    tint: "#5a4a26",
    ascendancies: ["edgewalker", "oathbreaker", "roadwarden"],
    playstyle: "All-rounder: sword in hand, armour and evasion, fits any build you find.",
    difficulty: 1,
    color: "#9fb4d0",
    starter: "reaping_whirl",
    trait: { name: "Scavenger", mods: { chargesOnKill: 1 } },
    treeDeg: 90,
  },
  {
    id: "mistrunner",
    name: "Mistrunner",
    blurb: "Fog-dancer with a long staff; strikes from the haze.",
    attrs: "DEX / INT",
    base: { str: 8, dex: 16, int: 16, armour: 0, evasion: 25, barrier: 10 },
    start: "start_mistrunner",
    look: 7,
    tint: "#3a5a5a",
    ascendancies: ["fogdancer", "marshlight", "reedpilgrim"],
    playstyle: "Mobile hybrid: long staff reach, evasion and a little barrier; rewards good footwork.",
    difficulty: 3,
    color: "#4fc8c0",
    starter: "hazeward_sweep",
    trait: { name: "Out of the Haze", mods: { postRollDmg: 12 } },
    treeDeg: -30,
  },
  {
    id: "bellwarden",
    name: "Bellwarden",
    blurb: "Keeper of a bronze bell. Every blow rings through the crowd.",
    attrs: "INT / STR",
    base: { str: 22, dex: 8, int: 16, armour: 45, evasion: 0, barrier: 10 },
    start: "start_bellwarden",
    look: 8,
    tint: "#5a5a3a",
    ascendancies: ["toller", "shrinekeeper", "ironcantor"],
    playstyle: "Armoured battle-mage: heavy mace blows backed by armour and a barrier.",
    difficulty: 2,
    color: "#c8904c",
    starter: "faultline_slam",
    trait: { name: "Bell Toll", mods: { splash: 5 } },
    treeDeg: 210,
  },
];

export const CLASS_BY_ID = new Map<string, ClassDef>(CLASSES.map((c) => [c.id, c]));
export const DEFAULT_CLASS: ClassId = "drifter";

/** Starter weapon kind for a class: the first preferred kind that has a starter base. */
export function classWeapon(cls: string, starters: Partial<Record<string, string>>): WeaponKind {
  const list = CLASS_WEAPONS[cls as ClassId] ?? [];
  return (list.find((k) => !!starters[k]) ?? Object.keys(starters)[0] ?? "sword") as WeaponKind;
}
