// Monster rarity (PoE2-style Power budget) and the original monster modifier pool.
// Magic monsters roll 1 modifier, rares 2-4, and each rare gives its pack's minions one of its
// `minion` modifiers. Every modifier also raises drop rarity (see RARITY_INFO.lootPerMod).
import type { EliteMod } from "../monsters";

export type MonRarity = 0 | 1 | 2 | 3; // normal / magic / rare / unique

export interface RarityInfo {
  name: string;
  power: number; // spawn budget, flask charges and XP weight
  hpMult: number;
  dmgMult: number;
  sizeMult: number;
  mods: [number, number];
  /** Fraction less effect of slows / CC (PoE2 ladder). */
  ccResist: number;
  color: string; // nameplate
}

export const RARITY_INFO: RarityInfo[] = [
  { name: "Normal", power: 1, hpMult: 1, dmgMult: 1, sizeMult: 1, mods: [0, 0], ccResist: 0, color: "#e8e2d4" },
  { name: "Magic", power: 2, hpMult: 1.7, dmgMult: 1.15, sizeMult: 1.1, mods: [1, 1], ccResist: 0.15, color: "#8a9cff" },
  { name: "Rare", power: 5, hpMult: 4, dmgMult: 1.3, sizeMult: 1.25, mods: [2, 4], ccResist: 0.3, color: "#ffe066" },
  { name: "Unique", power: 20, hpMult: 6, dmgMult: 1.35, sizeMult: 1, mods: [0, 1], ccResist: 0.5, color: "#d8873a" },
];

/**
 * Monster critical strikes by rarity (PoE2: every monster has a small base crit chance and a much
 * lower crit bonus than players). chance in %, multi in % of the hit (130 = +30%). Mods add on top
 * (Keen-Edged); rogue exiles use their gear when it is better.
 */
export const MONSTER_CRIT: { chance: number; multi: number }[] = [
  { chance: 5, multi: 130 }, // normal
  { chance: 6, multi: 135 }, // magic
  { chance: 8, multi: 145 }, // rare
  { chance: 10, multi: 150 }, // unique
];

/**
 * Monster level (PoE2 area level, royale-style): outer camps start at level 1, elite / boss camps
 * sit higher, and every camp gains levels as the match runs (respawned packs come back stronger).
 * Life grows faster than damage, like PoE2's early acts.
 *
 * `scalePerTier` is the extra levels an elite / boss camp gets over the player who wakes it
 * (server/ai/hooks.ts scaleToPlayer). 0 since the balance pass: rarity already multiplies life and
 * damage, and +2 / +4 levels on top made the boss a death trap (docs/BALANCE.md).
 */
export const MONSTER_LEVEL = { base: 1, perTier: 2, perMinute: 0.75, max: 20, scalePerTier: 0 };
/**
 * Life / damage multiplier of a monster level. The squared term keeps levels 1-5 where they were and
 * steepens the curve after that, so a pack at the player's level costs about the same share of life
 * at level 15 as at level 5 (a straight line fell behind player gear and passives; docs/BALANCE.md).
 */
export const monsterLevelScale = (lvl: number) => {
  const l = Math.max(1, lvl) - 1;
  return { life: 1 + 0.11 * l + 0.005 * l * l, dmg: 1 + 0.06 * l + 0.004 * l * l };
};
/** Monster XP grows this much per monster level above 1, so monsters that scale with you stay worth killing. */
export const MONSTER_XP_PER_LEVEL = 0.05;

/** Chance weights for a rare's modifier count 2 / 3 / 4. */
export const RARE_MOD_COUNT_WEIGHTS = [40, 40, 20];
/** Minions of a rare get this much more life (PoE2 cut theirs from +400% to +94%: keep it modest). */
export const RARE_MINION_HP_MULT = 1.3;
/** Each modifier adds this much to the loot rarity bonus (PoE2: at least +100% per mod). */
export const LOOT_RARITY_PER_MOD = 1;
/** Chance a normal camp member rolls magic (packs: 1-2 magic per camp on average). */
export const MAGIC_CHANCE = 0.18;

export type ModFamily = "offence" | "defence" | "aura" | "hazard" | "minion" | "bubble";

/**
 * 37 original modifiers in the six PoE2 families. Effects are read by server/ai/modfx.ts and
 * server/ai/brain.ts. `minion: true` means a rare can hand it to its pack.
 */
export const MONSTER_MODS: EliteMod[] = [
  // ---- offence ----
  { id: "frenzied", name: "Frenzied", family: "offence", color: "#ff5a3a", speedMult: 1.3, attackSpeedMult: 1.3, minion: true },
  { id: "brutish", name: "Brutish", family: "offence", color: "#e07a3a", dmgMult: 1.4, minion: true },
  { id: "splintering", name: "Splintering", family: "offence", color: "#d8c890", extraProj: 2, needs: "proj" },
  { id: "farreaching", name: "Far-Reaching", family: "offence", color: "#c8a0ff", aoeMult: 1.35 },
  { id: "bonebreaker", name: "Bonebreaker", family: "offence", color: "#d8d0c0", kbMult: 1.8, stunMult: 2, minion: true },
  { id: "stormmarked", name: "Storm-Marked", family: "offence", color: "#8ad0ff", stormMark: { radius: 50, delay: 0.9, dmg: 0.6 } },
  { id: "relentless", name: "Relentless", family: "offence", color: "#ff8a6a", recoverMult: 0.6, cooldownMult: 0.7 },
  { id: "lifedrinker", name: "Lifedrinker", family: "offence", color: "#c02040", leech: 0.4, minion: true },
  { id: "keenedged", name: "Keen-Edged", family: "offence", color: "#ffd0a0", critChance: 10, critMulti: 40, minion: true },
  // ---- defence ----
  { id: "ironhide", name: "Ironhide", family: "defence", color: "#b9c4d0", hpMult: 2 },
  { id: "bulwarked", name: "Bulwarked", family: "defence", color: "#a0a8b8", dmgTaken: 0.65, minion: true },
  { id: "mending", name: "Mending", family: "defence", color: "#60d080", regen: 0.015, minion: true },
  { id: "hardening", name: "Hardening", family: "defence", color: "#c0b090", hardening: { per: 0.07, max: 0.35, reset: 4 } },
  { id: "unshakable", name: "Unshakable", family: "defence", color: "#d0c8a0", kbImmune: true, ccResist: 0.3, minion: true },
  { id: "thornhide", name: "Thornhide", family: "defence", color: "#a0c040", thorns: 0.18 },
  { id: "lastbreath", name: "Last-Breath", family: "defence", color: "#f0f0ff", lastBreath: 1.5 },
  { id: "swollen", name: "Swollen", family: "defence", color: "#d0a080", hpMult: 1.5, dmgMult: 1.25, sizeMult: 1.15 },
  // ---- auras ----
  { id: "rimecloaked", name: "Rimecloaked", family: "aura", color: "#7fd4ff", frostAura: { radius: 170, slow: 0.7 } },
  { id: "rallying", name: "Rallying Howl", family: "aura", color: "#ffb060", allyAura: { radius: 260, speed: 1.25 } },
  { id: "chorus", name: "Mending Chorus", family: "aura", color: "#80e0a0", allyAura: { radius: 260, regen: 0.01 } },
  { id: "thirsting", name: "Thirsting Presence", family: "aura", color: "#b080ff", thirstAura: { radius: 200, perSec: 1.5 } },
  { id: "wardcaller", name: "Ward-Caller", family: "aura", color: "#9ab0ff", allyAura: { radius: 260, dmgTaken: 0.7 } },
  { id: "bloodscent", name: "Bloodscent", family: "aura", color: "#ff6060", allyAura: { radius: 260, dmg: 1.25 } },
  // ---- ground hazards and on-death ----
  { id: "volatile", name: "Volatile", family: "hazard", color: "#ff9a1f", deathBlast: { radius: 110, delay: 1.0, damage: 28 } },
  { id: "emberwake", name: "Emberwake", family: "hazard", color: "#ff7a2a", trail: { every: 0.45, r: 30, dur: 3, dps: 6, color: "rgba(255,110,40,0.45)" } },
  { id: "frostwake", name: "Frostwake", family: "hazard", color: "#a0e0ff", trail: { every: 0.45, r: 32, dur: 3.5, dps: 1, slow: 0.55, color: "rgba(150,210,255,0.4)" } },
  { id: "pulsing", name: "Pulsing", family: "hazard", color: "#e0a0ff", pulse: { every: 5, radius: 130, delay: 1.1, dmg: 0.7 } },
  { id: "blightburst", name: "Blightburst", family: "hazard", color: "#90c040", deathPool: { r: 110, dur: 6, dps: 7, slow: 0.8, color: "rgba(110,160,40,0.45)" } },
  { id: "stormcaller", name: "Stormcaller", family: "hazard", color: "#80c0ff", stormcall: { every: 4, count: 3, radius: 46, delay: 1.1, dmg: 0.6 } },
  { id: "splitting", name: "Splitting", family: "hazard", color: "#d0a0d0", splitOnDeath: 2 },
  { id: "gravebound", name: "Grave-Bound", family: "hazard", color: "#a09080", raiseOnDeath: 3 },
  // ---- minion synergy ----
  { id: "packward", name: "Pack Ward", family: "minion", color: "#a0c0ff", packWard: 0.6 },
  { id: "reviver", name: "Reviver", family: "minion", color: "#ffe0a0", revive: { every: 9 } },
  { id: "packmaster", name: "Packmaster", family: "minion", color: "#ffa060", packBoost: { dmg: 1.3, speed: 1.2 } },
  { id: "soullinked", name: "Soul-Linked", family: "minion", color: "#c0a0ff", soulLink: 0.1 },
  // ---- immunity bubbles ----
  { id: "closequarters", name: "Close-Quarters", family: "bubble", color: "#ffd0ff", nearOnly: 220 },
  { id: "veiledsphere", name: "Veiled Sphere", family: "bubble", color: "#d0f0ff", sphere: 210 },
  { id: "phasing", name: "Phasing", family: "bubble", color: "#f0f0f0", phasing: { every: 6, dur: 1.5 } },
];

/** Original rare-monster name parts (A + B), e.g. "Mosscrown Gutripper". */
export const RARE_MON_A = ["Moss", "Gloom", "Silt", "Shard", "Rot", "Ember", "Hollow", "Brine", "Cairn", "Thorn", "Sleet", "Grave", "Rust", "Ash"];
export const RARE_MON_B = ["crown", "maw", "heart", "spine", "eye", "tooth", "veil", "hide", "root", "skull", "wing", "coil"];
export const RARE_MON_C = ["Gutripper", "the Starved", "Bonegnawer", "of Many Teeth", "the Unburied", "Wallbreaker", "the Pale", "Neckbiter", "the Patient", "Mirewalker"];
