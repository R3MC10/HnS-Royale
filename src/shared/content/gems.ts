// Skill gems, spirit gems and support gems (PoE2-style system; every name here is original to this
// project). Skill logic lives in ../skills.ts (shared math) and server/skills.ts (execution).
//
// Rules (PoE2, scaled to one match):
// - Monsters drop ROUGH crystals (skill / support / spirit) with a level from the monster level.
//   The player cuts one into any gem of its family whose tier <= the crystal's level, or uses a
//   higher-level skill crystal to raise an owned skill gem to that level.
// - Supports socket into the skill (2 sockets, up to 5 with the gem-socket currency; `gs` on the item).
// - At most 9 skill gems on the bar, never the same skill twice; weapon skills and the basic attack
//   fill the rest. Supports have tiers I-III and a colour (red Str, green Dex, blue Int); a support
//   can be socketed only once across the whole bar.
// - Spirit gems (persistent auras, meta gems) reserve Spirit while switched on.

export type SkillTag =
  | "attack"
  | "spell"
  | "melee"
  | "projectile"
  | "area"
  | "slam"
  | "chain"
  | "movement"
  | "buff"
  | "totem"
  | "duration"
  | "persistent"
  | "meta"
  | "physical"
  | "fire"
  | "cold"
  | "lightning";

export type Attr = "str" | "dex" | "int";
export const ATTR_COLOR: Record<Attr, string> = { str: "#e0604c", dex: "#5cc46a", int: "#5a8ee0" };
export const ATTR_NAME: Record<Attr, string> = { str: "Strength", dex: "Dexterity", int: "Intelligence" };

/** How the server executes the skill (see server/skills.ts). */
export type SkillKind = "strike" | "slam" | "volley" | "bolt" | "cone" | "chain" | "dash" | "buff" | "totem" | "aura" | "meta" | "spin" | "blast" | "trap" | "guard" | "leap";

export interface SkillGemDef {
  id: string;
  name: string;
  desc: string;
  kind: SkillKind;
  tags: SkillTag[];
  attr: Attr;
  /** Minimum rough-crystal level needed to cut this gem (0 = weapon skill, never dropped or cut). */
  tier: number;
  /** Weapon skill: granted while one of these weapon kinds is equipped (shown on MMB if it's empty). */
  innate?: string[];
  /** Spirit reserved while switched on (auras, meta gems). */
  spirit?: number;
  /** Mana cost at gem level 1 (grows 6% per level). */
  cost: number;
  /** Attacks: multiplier on the weapon's attack time. Spells: cast time in seconds. */
  time: number;
  /** Fraction of the use time at which the effect lands (the commit point). */
  commit: number;
  cd: number; // cooldown, s (0 = none)
  /** Movement multiplier while using the skill. */
  move: number;
  /** Attacks: multiplier on weapon damage at level 1 (+4% of weapon damage per level). Spells: base damage at level 1 (x1.13 per level). */
  dmg: number;
  /** Weapon kinds that can use it (omitted = any, including unarmed). Plain strings so new weapon classes can be listed before they exist. */
  weapons?: string[];
  arcDeg?: number; // strike / cone width
  reach?: number; // strike: added to weapon reach; cone: length; slam: centre distance ahead; chain: first-target range
  radius?: number; // slam radius / chain jump range / totem attack range
  speed?: number; // projectile speed / dash distance
  range?: number; // projectile travel distance
  count?: number; // projectiles / chain targets / spin hits
  spread?: number; // degrees between projectiles
  chill?: number; // inherent chill on hit, s
  kbMult?: number; // knockback multiplier (attacks: on weapon knockback)
  buff?: { dur: number; more: number; move: number };
  totem?: { dur: number; rate: number; place: number };
  /** Projectiles fly through everything they hit instead of stopping at the first target. */
  pierce?: boolean;
  /** Projectiles turn around at the end of their flight and fly back to the user, hitting again. */
  returns?: boolean;
  /** Held use: every consecutive use is `step` faster, down to `min` of the base use time. */
  ramp?: { step: number; min: number };
  /** Guard: `less` of damage taken is ignored and knockback is refused for `dur` seconds. */
  guard?: { dur: number; less: number };
  /**
   * Ground effect placed `place` ahead. blast: strikes `delay` seconds after the cast lands.
   * trap: arms after `delay`, then waits up to `dur` seconds for an enemy within `trig`; at most `max` at once.
   */
  zone?: { place: number; delay: number; dur?: number; trig?: number; max?: number };
  /** Persistent aura while switched on (+2% of the value per gem level). */
  aura?: { more: number; move: number; regen: number };
  /** Meta gem: energy gained per unit of distance rolled; the socketed spell fires at 100 energy. */
  meta?: { perDist: number };
  color: string; // effect / UI tint
}

const MELEE_ALL = ["sword", "spear", "axe", "dagger", "claw", "staff", "quarterstaff", "mace", "sceptre"];

export const SKILL_GEMS: SkillGemDef[] = [
  {
    id: "sundering_blow", name: "Sundering Blow", kind: "strike", tags: ["attack", "melee", "physical"], attr: "str", tier: 1,
    desc: "A slow, two-handed overhead blow that cleaves a narrow line and hurls the target back.",
    cost: 6, time: 1.25, commit: 0.58, cd: 0, move: 0.15, dmg: 2.3, arcDeg: 60, reach: 18, kbMult: 1.8,
    weapons: MELEE_ALL, color: "#e8c890",
  },
  {
    id: "faultline_slam", name: "Faultline Slam", kind: "slam", tags: ["attack", "melee", "area", "slam", "physical"], attr: "str", tier: 2,
    desc: "Raise your weapon and split the ground ahead. The impact zone is marked while you wind up.",
    cost: 9, time: 1.5, commit: 0.62, cd: 0, move: 0.05, dmg: 2.8, reach: 78, radius: 74, kbMult: 1.3,
    weapons: ["sword", "axe", "spear", "staff", "quarterstaff", "mace"], color: "#d29a5a",
  },
  {
    id: "splinter_volley", name: "Splinter Volley", kind: "volley", tags: ["attack", "projectile", "physical"], attr: "dex", tier: 1,
    desc: "Loose a tight fan of barbed shafts (with a bow) or hurled shards of your blade.",
    cost: 7, time: 1.1, commit: 0.5, cd: 0, move: 0.4, dmg: 0.85, speed: 720, range: 560, count: 3, spread: 9, kbMult: 0.5,
    weapons: ["bow", "crossbow", "dagger", "spear"], color: "#d8d0a0",
  },
  {
    id: "cinderbolt", name: "Cinderbolt", kind: "bolt", tags: ["spell", "projectile", "fire"], attr: "int", tier: 1,
    desc: "Fling a spitting knot of embers that bursts on the first thing it touches.",
    cost: 6, time: 0.6, commit: 0.55, cd: 0, move: 0.45, dmg: 19, speed: 560, range: 600, count: 1, spread: 10, color: "#ff8a3a",
  },
  {
    id: "frostgale", name: "Frostgale", kind: "cone", tags: ["spell", "area", "cold"], attr: "int", tier: 2,
    desc: "Exhale a gale of rime in a cone. Everything caught is chilled.",
    cost: 8, time: 0.7, commit: 0.5, cd: 0, move: 0.3, dmg: 19, arcDeg: 72, reach: 165, chill: 1.6, color: "#9ad8ff",
  },
  {
    id: "stormthread", name: "Stormthread", kind: "chain", tags: ["spell", "chain", "lightning"], attr: "int", tier: 3,
    desc: "A crackling thread leaps to the nearest foe you aim at, then jumps between nearby enemies.",
    cost: 10, time: 0.65, commit: 0.45, cd: 0, move: 0.35, dmg: 14, reach: 330, radius: 210, count: 4, color: "#b8a8ff",
  },
  {
    id: "shadow_lunge", name: "Shadow Lunge", kind: "dash", tags: ["spell", "movement"], attr: "dex", tier: 2,
    desc: "Lunge through the dark toward your aim, stopping short of solid rock.",
    cost: 8, time: 0.22, commit: 0, cd: 3, move: 1, dmg: 0, speed: 240, color: "#9a7ad8",
  },
  {
    id: "ember_pact", name: "Ember Pact", kind: "buff", tags: ["spell", "buff", "duration", "fire"], attr: "str", tier: 3,
    desc: "Bargain with the embers in your blood: deal more damage and move faster for a while.",
    cost: 14, time: 0.45, commit: 0.5, cd: 14, move: 0.5, dmg: 0, buff: { dur: 6, more: 0.25, move: 0.12 }, color: "#ff4a3a",
  },
  {
    id: "pyre_effigy", name: "Pyre Effigy", kind: "totem", tags: ["spell", "totem", "projectile", "duration", "fire"], attr: "str", tier: 4,
    desc: "Plant a burning effigy that spits fire at the nearest enemy until it collapses.",
    cost: 14, time: 0.7, commit: 0.7, cd: 6, move: 0.3, dmg: 7, speed: 480, range: 380, radius: 380, count: 1, spread: 12,
    totem: { dur: 6, rate: 0.9, place: 150 }, color: "#ffb04a",
  },

  // ---- second set: play patterns the first nine lack ----
  {
    id: "reaping_whirl", name: "Reaping Whirl", kind: "spin", tags: ["attack", "melee", "area", "physical"], attr: "str", tier: 2,
    desc: "Spin with your weapon out, cutting everything around you three times. You can walk while you turn.",
    cost: 9, time: 1.6, commit: 0.25, cd: 0, move: 0.6, dmg: 0.7, count: 3, reach: 14, kbMult: 0.4,
    weapons: MELEE_ALL, color: "#e8d0a0",
  },
  {
    id: "glacial_lance", name: "Glacial Lance", kind: "bolt", tags: ["spell", "projectile", "cold"], attr: "int", tier: 1,
    desc: "Hurl a spear of old ice that passes through every enemy in its path and chills them.",
    cost: 7, time: 0.7, commit: 0.55, cd: 0, move: 0.4, dmg: 22, speed: 640, range: 520, count: 1, spread: 10, chill: 1.2, pierce: true, color: "#a8e4ff",
  },
  {
    id: "galeshot_barrage", name: "Galeshot Barrage", kind: "volley", tags: ["attack", "projectile", "physical"], attr: "dex", tier: 2,
    desc: "Hold to loose arrow after arrow, each one quicker than the last, until you stop or run dry.",
    cost: 2, time: 0.62, commit: 0.55, cd: 0, move: 0.25, dmg: 0.7, speed: 800, range: 540, count: 1, spread: 4, kbMult: 0.3, ramp: { step: 0.14, min: 0.48 },
    weapons: ["bow", "crossbow"], color: "#d8e8b0",
  },
  {
    id: "bulwark_stance", name: "Bulwark Stance", kind: "guard", tags: ["buff", "duration"], attr: "str", tier: 2,
    desc: "Set your feet and brace. For a short while you take far less damage and cannot be knocked back, but you move slowly.",
    cost: 8, time: 0.3, commit: 0.4, cd: 9, move: 0.5, dmg: 0, guard: { dur: 2.2, less: 0.5 }, color: "#c8d0e0",
  },
  {
    id: "hoarfrost_snare", name: "Hoarfrost Snare", kind: "trap", tags: ["spell", "area", "duration", "cold"], attr: "dex", tier: 2,
    desc: "Toss a rime-crusted snare ahead of you. Once set, it bursts under the first enemy to step near and chills everything caught.",
    cost: 7, time: 0.5, commit: 0.6, cd: 2.5, move: 0.5, dmg: 26, radius: 62, chill: 3, zone: { place: 130, delay: 0.7, dur: 14, trig: 30, max: 3 }, color: "#b0e8f0",
  },
  {
    id: "wheeling_glaive", name: "Wheeling Glaive", kind: "volley", tags: ["attack", "projectile", "physical"], attr: "dex", tier: 3,
    desc: "Throw your weapon in a spinning arc. It cuts through everything on the way out and again on the way back to your hand.",
    cost: 8, time: 1.15, commit: 0.5, cd: 0, move: 0.4, dmg: 0.8, speed: 520, range: 330, count: 1, spread: 16, kbMult: 0.4, pierce: true, returns: true,
    weapons: ["axe", "sword", "dagger", "spear", "claw"], color: "#e0d8c0",
  },
  {
    id: "stormcall_sigil", name: "Stormcall Sigil", kind: "blast", tags: ["spell", "area", "lightning"], attr: "int", tier: 3,
    desc: "Brand the ground ahead with a sigil. A moment later the sky answers and lightning strikes the mark.",
    cost: 10, time: 0.7, commit: 0.6, cd: 3, move: 0.35, dmg: 34, radius: 84, zone: { place: 190, delay: 0.6 }, color: "#c0b0ff",
  },
  {
    id: "stormvault", name: "Stormvault", kind: "leap", tags: ["attack", "melee", "area", "slam", "lightning"], attr: "str", tier: 4,
    desc: "Vault toward your aim and come down like a thunderclap, shocking the ground where you land.",
    cost: 10, time: 1.2, commit: 0.4, cd: 6, move: 0.1, dmg: 2.2, speed: 230, radius: 70, kbMult: 1.2,
    weapons: MELEE_ALL, color: "#b8b0ff",
  },

  // ---- spirit gems (cut from rough spirit crystals) ----
  {
    id: "ashen_mantle", name: "Ashen Mantle", kind: "aura", tags: ["persistent", "buff"], attr: "str", tier: 1, spirit: 30,
    desc: "Wrap yourself in drifting ash. While switched on: more damage and a little life regeneration.",
    cost: 0, time: 0.4, commit: 0.5, cd: 1, move: 0.6, dmg: 0, aura: { more: 0.1, move: 0, regen: 1 }, color: "#d07a5a",
  },
  {
    id: "windward_hymn", name: "Windward Hymn", kind: "aura", tags: ["persistent", "buff"], attr: "dex", tier: 1, spirit: 30,
    desc: "Hum a travelling song the wind carries for you. While switched on: more movement speed.",
    cost: 0, time: 0.4, commit: 0.5, cd: 1, move: 0.6, dmg: 0, aura: { more: 0, move: 0.08, regen: 0 }, color: "#8ae0b0",
  },
  {
    id: "tumbling_rite", name: "Tumbling Rite", kind: "meta", tags: ["persistent", "meta"], attr: "dex", tier: 3, spirit: 60,
    desc: "Socket a spell into this rite. Rolling builds energy; at full energy the spell fires at your aim for free.",
    cost: 0, time: 0.4, commit: 0.5, cd: 1, move: 0.6, dmg: 0, meta: { perDist: 0.75 }, color: "#c8b0ff",
  },

  // ---- weapon skills (granted by the equipped weapon; not droppable) ----
  {
    id: "riposte_arc", name: "Riposte Arc", kind: "strike", tags: ["attack", "melee", "physical"], attr: "str", tier: 0, innate: ["sword"],
    desc: "A fast, wide backhand sweep that shoves everything around you away.",
    cost: 4, time: 0.85, commit: 0.5, cd: 4, move: 0.5, dmg: 1.1, arcDeg: 160, reach: 4, kbMult: 2.2, weapons: ["sword"], color: "#f0e0b0",
  },
  {
    id: "rending_chop", name: "Rending Chop", kind: "slam", tags: ["attack", "melee", "area", "slam", "physical"], attr: "str", tier: 0, innate: ["axe", "mace"],
    desc: "Bury your weapon in the ground just ahead of you.",
    cost: 5, time: 1.2, commit: 0.55, cd: 5, move: 0.2, dmg: 1.6, reach: 34, radius: 52, kbMult: 1.4, weapons: ["axe", "mace"], color: "#c88a5a",
  },
  {
    id: "longreach_thrust", name: "Longreach Thrust", kind: "strike", tags: ["attack", "melee", "physical"], attr: "dex", tier: 0, innate: ["spear", "quarterstaff"],
    desc: "Step into a long, narrow thrust that outranges most blades.",
    cost: 4, time: 1, commit: 0.55, cd: 3, move: 0.35, dmg: 1.5, arcDeg: 22, reach: 62, kbMult: 1, weapons: ["spear", "quarterstaff"], color: "#e0d8a8",
  },
  {
    id: "smoke_step", name: "Smoke Step", kind: "dash", tags: ["spell", "movement"], attr: "dex", tier: 0, innate: ["dagger"],
    desc: "A short hop through a puff of smoke.",
    cost: 4, time: 0.18, commit: 0, cd: 4, move: 1, dmg: 0, speed: 150, weapons: ["dagger"], color: "#a0a0b8",
  },
  {
    id: "pinning_shot", name: "Pinning Shot", kind: "volley", tags: ["attack", "projectile", "physical"], attr: "dex", tier: 0, innate: ["bow", "crossbow"],
    desc: "A heavy shaft that chills its target in place.",
    cost: 4, time: 1.05, commit: 0.5, cd: 4, move: 0.4, dmg: 1.4, speed: 820, range: 600, count: 1, chill: 1.4, kbMult: 0.8, weapons: ["bow", "crossbow"], color: "#c8e8ff",
  },
  {
    id: "kindling_spark", name: "Kindling Spark", kind: "bolt", tags: ["spell", "projectile", "fire"], attr: "int", tier: 0, innate: ["staff", "wand", "sceptre"],
    desc: "A small, quick ember channelled through your focus.",
    cost: 3, time: 0.45, commit: 0.5, cd: 1.5, move: 0.5, dmg: 10, speed: 640, range: 520, count: 1, weapons: ["staff", "wand", "sceptre"], color: "#ffb070",
  },
];

export const SKILL_GEM_BY_ID = new Map(SKILL_GEMS.map((s) => [s.id, s]));
export const isSpiritDef = (d: SkillGemDef) => d.kind === "aura" || d.kind === "meta";
/** Gems a rough skill crystal can be cut into. */
export const CUTTABLE_SKILLS = SKILL_GEMS.filter((d) => d.tier > 0 && !isSpiritDef(d));
/** Gems a rough spirit crystal can be cut into. */
export const CUTTABLE_SPIRIT = SKILL_GEMS.filter((d) => d.tier > 0 && isSpiritDef(d));
/** Weapon skill granted by a weapon kind (if any). */
export function innateFor(kind: string | null | undefined): SkillGemDef | undefined {
  if (!kind) return undefined;
  return SKILL_GEMS.find((d) => d.innate?.includes(kind));
}

export interface SupportGemDef {
  id: string;
  name: string;
  desc: string;
  attr: Attr;
  /** Links only to skills with at least one of these tags (empty = any skill that isn't excluded). */
  needs: SkillTag[];
  /** Never links to skills with any of these tags. */
  excludes?: SkillTag[];
  /** Mana cost multiplier (PoE2: every support raises the cost). */
  costMult: number;
  more?: number; // damage multiplier
  speed?: number; // use speed multiplier
  area?: number; // area multiplier (radius, cone length, chain jump range)
  proj?: number; // added projectiles
  chain?: number; // added chains (projectiles chain to a new target on hit)
  ignite?: number; // burn for this fraction of the hit over 3 s
  chill?: number; // chill on hit, s
  leech?: number; // fraction of damage dealt leeched as life
  cdr?: number; // cooldown recovery multiplier
  dur?: number; // duration multiplier (buffs, totems)
  addTags?: SkillTag[];
  color: string;
}

const NO_UTIL: SkillTag[] = ["movement", "buff", "persistent", "meta"];

/** Values are tier I; tiers II and III are stronger (see supportAt in ../skills.ts). */
export const SUPPORT_GEMS: SupportGemDef[] = [
  { id: "heavy_hand", name: "Heavy Hand", attr: "str", needs: ["attack", "spell"], excludes: NO_UTIL, costMult: 1.4, more: 1.25, desc: "More damage.", color: "#e0b070" },
  { id: "scattershot", name: "Scattershot", attr: "dex", needs: ["projectile"], costMult: 1.3, proj: 2, more: 0.75, desc: "+2 projectiles in a wider fan, but less damage.", color: "#d8d0a0" },
  { id: "quickened_rite", name: "Quickened Rite", attr: "dex", needs: [], excludes: ["persistent", "meta"], costMult: 1.2, speed: 1.2, desc: "More attack and cast speed for this skill.", color: "#a0e0a0" },
  { id: "broadened_ruin", name: "Broadened Ruin", attr: "int", needs: ["area", "chain"], costMult: 1.3, area: 1.35, more: 0.92, desc: "More area of effect, slightly less damage.", color: "#c0b0e0" },
  { id: "cindertouch", name: "Cindertouch", attr: "str", needs: ["attack", "spell"], excludes: NO_UTIL, costMult: 1.2, ignite: 0.4, addTags: ["fire"], desc: "Hits ignite: the target burns for part of the hit over 3 seconds.", color: "#ff7a2a" },
  { id: "arcing_link", name: "Arcing Link", attr: "int", needs: ["projectile", "chain"], costMult: 1.25, chain: 2, more: 0.88, desc: "Projectiles chain to 2 more enemies; chaining skills jump 2 more times. Less damage.", color: "#b8a8ff" },
  { id: "bloodthirst", name: "Bloodthirst", attr: "str", needs: ["attack", "spell"], excludes: NO_UTIL, costMult: 1.15, leech: 0.06, desc: "Part of the damage dealt by this skill is leeched as Life.", color: "#d04050" },
  { id: "frugal_sigil", name: "Frugal Sigil", attr: "int", needs: [], excludes: ["persistent", "meta"], costMult: 0.7, more: 0.9, desc: "Less mana cost, slightly less damage.", color: "#8fb8e0" },
  { id: "rimebite", name: "Rimebite", attr: "int", needs: ["attack", "spell"], excludes: NO_UTIL, costMult: 1.15, chill: 1.6, addTags: ["cold"], desc: "Hits chill the target (30% slower). Skills that already chill do so for longer.", color: "#9ad8ff" },
  { id: "swift_recall", name: "Swift Recall", attr: "dex", needs: ["movement", "buff", "totem", "duration"], excludes: ["persistent"], costMult: 1.2, cdr: 1.3, dur: 1.15, desc: "Faster cooldown recovery and longer duration.", color: "#e0d080" },
];

export const SUPPORT_GEM_BY_ID = new Map(SUPPORT_GEMS.map((s) => [s.id, s]));

/** Gem item base ids: "gem_<skill id>" (skill + spirit gems) and "sup_<support id>" (supports; item level = tier 1..3). */
export const SKILL_GEM_PREFIX = "gem_";
export const SUPPORT_GEM_PREFIX = "sup_";
/** Rough crystals (uncut gems); item level = crystal level (support crystals: tier). */
export const ROUGH_SKILL = "rough_skill";
export const ROUGH_SUPPORT = "rough_support";
export const ROUGH_SPIRIT = "rough_spirit";
export const ROUGH_NAMES: Record<string, string> = {
  [ROUGH_SKILL]: "Rough Skill Crystal",
  [ROUGH_SUPPORT]: "Rough Support Crystal",
  [ROUGH_SPIRIT]: "Rough Spirit Crystal",
};
export const GEM_MAX_LEVEL = 10;
export const SUPPORT_MAX_TIER = 3;
/** Support sockets on a fresh skill gem; the gem-socket currency raises it (`gs`) up to MAX_SOCKETS. */
export const BASE_SOCKETS = 2;
export const MAX_SOCKETS = 5;
/** Skill gems allowed on the bar at once (weapon skills and the basic attack don't count). */
export const MAX_EQUIPPED_SKILLS = 9;
/**
 * Support attribute requirement by tier (I, II, III). 0 = none: like current PoE2, supports have no
 * attribute requirement, so a support cut from a crystal always works on a skill it fits.
 */
export const SUPPORT_ATTR_REQ = [0, 0, 0];
/** Meta gem energy needed to fire the socketed spell. */
export const META_ENERGY = 100;

/** Drop chances per monster kill (each entry is one independent roll). */
export const GEM_DROPS = {
  normal: { skill: [0.12], support: [0.14], spirit: [0.025], precut: [0.015] },
  elite: { skill: [1, 0.35], support: [1, 0.5], spirit: [0.3], precut: [0.15] },
} as const;
/**
 * Guaranteed early crystals so every player has extra skills within the first camps of a 15-minute
 * match: the killer's Nth monster kill of the match always drops that crystal (on top of the rolls).
 * Guaranteed skill crystals are at least level GEM_PITY_MIN_LEVEL so tier-2 gems can be cut from them.
 */
export const GEM_PITY = { skill: [2, 8], support: [5, 13], spirit: [20] } as const;
export const GEM_PITY_MIN_LEVEL = 2;
export const GEM_COLOR = "#5ad1c9"; // label colour for skill gems
export const SUPPORT_COLOR = "#8fd0a0"; // label colour for support gems
export const ROUGH_COLOR = "#b0c8c8"; // label colour for rough crystals
