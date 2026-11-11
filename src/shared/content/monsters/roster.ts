// The biome monster roster: 4 new families per biome + one boss per biome. All names and designs are
// original. Behaviour comes from the `attacks` list (server/ai/brain.ts); every area attack is
// telegraphed with a ground marker during its windup.
import type { MonsterType } from "../monsters";

const P = Math.PI;

// ---- Hollowpine Blight (rotting pine forest) -------------------------------------------------

/** Wiry hound of knotted bark and sap. Rusher: closes fast and pounces (landing circle). */
const barkgnaw: MonsterType = {
  id: "barkgnaw", name: "Barkgnaw", ai: "rusher", family: "beast", color: "#7a5a36",
  // Level-1 balance (Hollowpine is the starting biome): ~5 dps each when face-tanked, telegraphed pounce.
  radius: 16, hp: 46, speed: 215, aggroRadius: 330, damage: 6, attackRange: 26, windup: 0.4, recover: 0.9,
  knockback: 240, kbResist: 0, packWeight: 0, packCount: [2, 4],
  attacks: [
    { id: "bite", kind: "melee", range: 24, windup: 0.4, recover: 0.85, cooldown: 0, weight: 3, dmg: 1, radius: 30, arc: P / 2.4 },
    { id: "pounce", kind: "leap", range: 240, minRange: 90, windup: 0.65, recover: 0.8, cooldown: 6, weight: 4, dmg: 1.3, radius: 46, form: "area" },
  ],
};

/** Gaunt grey wolf gone feral in the blight. Rusher pack hunter: bites, lunges from mid range. */
const wolfFeral: MonsterType = {
  id: "wolf_feral", name: "Feral Wolf", ai: "rusher", family: "beast", color: "#6e6a62",
  radius: 15, hp: 40, speed: 225, aggroRadius: 360, damage: 5, attackRange: 26, windup: 0.38, recover: 0.85,
  knockback: 220, kbResist: 0, packWeight: 0, packCount: [2, 4],
  attacks: [
    { id: "bite", kind: "melee", range: 24, windup: 0.38, recover: 0.8, cooldown: 0, weight: 4, dmg: 1, radius: 28, arc: P / 2.4 },
    { id: "lunge", kind: "leap", range: 220, minRange: 80, windup: 0.6, recover: 0.75, cooldown: 6, weight: 3, dmg: 1.3, radius: 40, form: "area" },
  ],
};

/** Bloated fungal pod on root legs. Ranged: spits a fan of three sap globs. */
const sapspitter: MonsterType = {
  id: "sapspitter", name: "Sapspitter", ai: "ranged", family: "spirit", color: "#9a8a3a",
  radius: 17, hp: 34, speed: 110, aggroRadius: 400, damage: 6, attackRange: 360, windup: 0.7, recover: 1.6,
  knockback: 120, kbResist: 0.2, packWeight: 0, preferredDist: 270, packCount: [1, 2],
  attacks: [
    { id: "sap_fan", kind: "proj", range: 380, windup: 0.7, recover: 1.6, cooldown: 0, weight: 3, dmg: 0.75, count: 3, spread: 0.32, speed: 240, life: 2, projR: 8, element: "chaos" },
    {
      id: "sap_lob", kind: "ground", range: 330, windup: 1.0, recover: 1.3, cooldown: 8, weight: 2, dmg: 1.1, radius: 54, form: "area", element: "chaos",
      pool: { r: 54, dur: 4, dps: 3, slow: 0.7, color: "rgba(170,160,40,0.45)" },
    },
  ],
};

/** Antlered root-shaman in a cloak of moss. Caster: calls root eruptions under you, summons barkgnaws. */
const hollowTender: MonsterType = {
  id: "hollow_tender", name: "Hollow Tender", ai: "caster", family: "caster", color: "#5c7a4a",
  radius: 17, hp: 40, speed: 120, aggroRadius: 420, damage: 9, attackRange: 340, windup: 1.0, recover: 1.5,
  knockback: 300, kbResist: 0.1, packWeight: 0, preferredDist: 240, packCount: [1, 2],
  attacks: [
    { id: "root_burst", kind: "ground", range: 360, windup: 1.1, recover: 1.4, cooldown: 0, weight: 4, dmg: 1, radius: 60, form: "spell", element: "phys" },
    { id: "root_field", kind: "rain", range: 340, windup: 1.2, recover: 1.5, cooldown: 8, weight: 2, dmg: 0.7, radius: 44, count: 4, form: "spell" },
    { id: "call_pack", kind: "summon", range: 420, windup: 1.1, recover: 1.0, cooldown: 16, weight: 2, dmg: 0, count: 2, summon: { type: "barkgnaw", max: 2 } },
  ],
};

/** Walking stump the size of a hut. Brute: overhead slam (circle) and a wide root sweep. */
const stumpfather: MonsterType = {
  id: "stumpfather", name: "Stumpfather", ai: "brute", family: "brute", color: "#5a4632",
  radius: 30, hp: 170, speed: 92, aggroRadius: 280, damage: 18, attackRange: 46, windup: 1.0, recover: 1.3,
  knockback: 650, kbResist: 0.85, packWeight: 0, packCount: [1, 1],
  attacks: [
    { id: "trunk_slam", kind: "slam", range: 50, windup: 1.0, recover: 1.3, cooldown: 0, weight: 3, dmg: 1, radius: 74, offset: 44, form: "area" },
    { id: "root_sweep", kind: "nova", range: 60, windup: 1.2, recover: 1.4, cooldown: 8, weight: 2, dmg: 0.8, radius: 120, form: "area", kb: 800 },
  ],
};

// ---- Gloamwater Fen (drowned lowland) ---------------------------------------------------------

/** Long eel-thing on stubby fins. Rusher: charges along a line marker, then bites. */
const reedlurker: MonsterType = {
  id: "reedlurker", name: "Reedlurker", ai: "rusher", family: "beast", color: "#3e6a5a",
  radius: 16, hp: 44, speed: 190, aggroRadius: 320, damage: 10, attackRange: 28, windup: 0.32, recover: 0.6,
  knockback: 260, kbResist: 0, packWeight: 0, packCount: [2, 4],
  attacks: [
    { id: "snap", kind: "melee", range: 26, windup: 0.32, recover: 0.5, cooldown: 0, weight: 3, dmg: 1, radius: 32, arc: P / 2.6 },
    { id: "eel_rush", kind: "charge", range: 260, minRange: 80, windup: 0.6, recover: 0.7, cooldown: 4.5, weight: 4, dmg: 1.3, width: 40, form: "area", kb: 420 },
  ],
};

/** Drowned cantor wrapped in weed, singing up sludge. Caster: bursting pools that slow. */
const mireChanter: MonsterType = {
  id: "mire_chanter", name: "Mire Chanter", ai: "caster", family: "undead", color: "#4a6a6a",
  radius: 17, hp: 38, speed: 115, aggroRadius: 420, damage: 13, attackRange: 340, windup: 1.0, recover: 1.3,
  knockback: 200, kbResist: 0.1, packWeight: 0, preferredDist: 250, packCount: [1, 2],
  attacks: [
    {
      id: "sludge_burst", kind: "ground", range: 360, windup: 1.0, recover: 1.1, cooldown: 0, weight: 4, dmg: 1, radius: 58, form: "spell", element: "cold",
      pool: { r: 58, dur: 5, dps: 3, slow: 0.55, color: "rgba(60,110,110,0.45)" },
    },
    { id: "drowning_hymn", kind: "nova", range: 90, windup: 1.1, recover: 1.0, cooldown: 6, weight: 2, dmg: 0.9, radius: 110, form: "spell", element: "cold" },
  ],
};

/** Shell-backed mud turtle. Brute: belly-flop nova that leaves sludge, and a forward shell slam. */
const siltBehemoth: MonsterType = {
  id: "silt_behemoth", name: "Silt Behemoth", ai: "brute", family: "brute", color: "#5a5a46",
  radius: 31, hp: 190, speed: 80, aggroRadius: 260, damage: 26, attackRange: 46, windup: 1.1, recover: 1.2,
  knockback: 600, kbResist: 0.9, packWeight: 0, packCount: [1, 1],
  attacks: [
    { id: "shell_slam", kind: "slam", range: 48, windup: 1.0, recover: 1.0, cooldown: 0, weight: 3, dmg: 1, radius: 70, offset: 42, form: "area" },
    {
      id: "belly_flop", kind: "nova", range: 70, windup: 1.3, recover: 1.4, cooldown: 7, weight: 2, dmg: 1.1, radius: 115, form: "area",
      pool: { r: 115, dur: 4, dps: 2, slow: 0.6, color: "rgba(80,90,60,0.4)" },
    },
  ],
};

/** Fist-sized leech swarm. Swarm: many, fast, fragile; each bite heals the leech. */
const leechkin: MonsterType = {
  id: "leechkin", name: "Leechkin", ai: "swarm", family: "beast", color: "#5a2a32",
  radius: 9, hp: 12, speed: 235, aggroRadius: 300, damage: 4, attackRange: 18, windup: 0.22, recover: 0.45,
  knockback: 60, kbResist: 0, packWeight: 0, packCount: [6, 10],
  attacks: [{ id: "latch", kind: "melee", range: 16, windup: 0.22, recover: 0.4, cooldown: 0, weight: 1, dmg: 1, radius: 20, arc: P / 2 }],
};

// ---- Brokenspire Heights (cliffs and fallen towers) -------------------------------------------

/** Stone-winged harrier off the broken towers. Rusher: dives onto you from range. */
const spireHarrier: MonsterType = {
  id: "spire_harrier", name: "Spire Harrier", ai: "rusher", family: "spirit", color: "#7a7a88",
  radius: 15, hp: 40, speed: 225, aggroRadius: 360, damage: 9, attackRange: 26, windup: 0.3, recover: 0.6,
  knockback: 220, kbResist: 0, packWeight: 0, packCount: [2, 4],
  attacks: [
    { id: "rake", kind: "melee", range: 24, windup: 0.28, recover: 0.5, cooldown: 0, weight: 3, dmg: 1, radius: 30, arc: P / 2.2 },
    { id: "dive", kind: "leap", range: 300, minRange: 110, windup: 0.65, recover: 0.7, cooldown: 4, weight: 4, dmg: 1.5, radius: 50, form: "area" },
  ],
};

/** Crystal-studded construct. Ranged: fans of shards, plus a slow arcing lob. */
const shardslinger: MonsterType = {
  id: "shardslinger", name: "Shardslinger", ai: "ranged", family: "brute", color: "#8aa0b8",
  radius: 18, hp: 50, speed: 105, aggroRadius: 420, damage: 9, attackRange: 380, windup: 0.65, recover: 1.3,
  knockback: 140, kbResist: 0.4, packWeight: 0, preferredDist: 280, packCount: [1, 3],
  attacks: [
    { id: "shard_fan", kind: "proj", range: 400, windup: 0.65, recover: 1.2, cooldown: 0, weight: 3, dmg: 1, count: 5, spread: 0.55, speed: 280, life: 1.8, projR: 7, element: "phys" },
    { id: "crystal_rain", kind: "rain", range: 360, windup: 1.2, recover: 1.3, cooldown: 7, weight: 2, dmg: 1, radius: 40, count: 5, form: "area", element: "lightning" },
  ],
};

/** Rubble giant wearing a tower's broken crown. Brute: two-fisted slam and a quake ring. */
const cairnbreaker: MonsterType = {
  id: "cairnbreaker", name: "Cairnbreaker", ai: "brute", family: "brute", color: "#6c6660",
  radius: 31, hp: 200, speed: 88, aggroRadius: 270, damage: 32, attackRange: 48, windup: 1.05, recover: 1.1,
  knockback: 700, kbResist: 0.9, packWeight: 0, packCount: [1, 1],
  attacks: [
    { id: "cairn_slam", kind: "slam", range: 50, windup: 1.05, recover: 1.0, cooldown: 0, weight: 3, dmg: 1, radius: 78, offset: 46, form: "area" },
    { id: "quake", kind: "nova", range: 80, windup: 1.4, recover: 1.3, cooldown: 7, weight: 2, dmg: 0.9, radius: 140, form: "area", kb: 900 },
  ],
};

/** Ember-backed beetles from the old forges. Swarm: rush in and pop when they die. */
const cindermite: MonsterType = {
  id: "cindermite", name: "Cindermite", ai: "swarm", family: "beast", color: "#b8582a",
  radius: 10, hp: 14, speed: 225, aggroRadius: 300, damage: 4, attackRange: 18, windup: 0.24, recover: 0.5,
  knockback: 80, kbResist: 0, packWeight: 0, packCount: [6, 9], deathPop: { radius: 44, delay: 0.7, dmg: 7 },
  attacks: [{ id: "nip", kind: "melee", range: 16, windup: 0.24, recover: 0.45, cooldown: 0, weight: 1, dmg: 1, radius: 20, arc: P / 2, element: "fire" }],
};

// ---- Bosses (unique, Power 20) -----------------------------------------------------------------

/**
 * The Rotwood Matriarch: a hollow pine-witch with a crown of antlers. Life 130 -> 65 and damage 18 -> 12.6 in the
 * objective pass: about 1200 life met at level 13 (a fight of 20-30 s for a level 12-14 player), so the
 * mid-match objective gets taken (bots killed it in about 1 match in 300 before).
 */
const rotwoodMatriarch: MonsterType = {
  id: "rotwood_matriarch", name: "The Rotwood Matriarch", ai: "boss", family: "spirit", color: "#6a5a3a",
  radius: 40, hp: 65, speed: 90, aggroRadius: 380, damage: 12.6, attackRange: 56, windup: 1.0, recover: 1.0,
  knockback: 700, kbResist: 0.95, packWeight: 0,
  attacks: [
    { id: "bough_crush", kind: "slam", range: 60, windup: 1.0, recover: 0.9, cooldown: 0, weight: 3, dmg: 1, radius: 90, offset: 56, form: "area" },
    { id: "sap_volley", kind: "proj", range: 420, minRange: 120, windup: 0.8, recover: 1.0, cooldown: 3, weight: 3, dmg: 0.6, count: 7, spread: 0.9, speed: 250, life: 2.2, projR: 9, element: "chaos" },
    { id: "rootfall", kind: "rain", range: 420, windup: 1.2, recover: 1.0, cooldown: 6, weight: 3, dmg: 0.9, radius: 54, count: 6, form: "area", phase: 1 },
    { id: "brood_call", kind: "summon", range: 500, windup: 1.2, recover: 0.8, cooldown: 14, weight: 2, dmg: 0, count: 3, summon: { type: "barkgnaw", max: 5 }, phase: 1 },
    {
      id: "rot_bloom", kind: "nova", range: 140, windup: 1.4, recover: 1.0, cooldown: 7, weight: 3, dmg: 1.2, radius: 190, form: "area", phase: 2,
      pool: { r: 150, dur: 5, dps: 6, slow: 0.7, color: "rgba(120,140,40,0.4)" },
    },
  ],
  boss: {
    title: "Mother of the Hollow Pines",
    hpMult: 1,
    roar: { radius: 170, dmg: 10 },
    phases: [
      { below: 1, name: "", speedMult: 1, atkSpeedMult: 1 },
      { below: 0.66, name: "The pines answer her call!", speedMult: 1.05, atkSpeedMult: 1.1, adds: { type: "barkgnaw", count: 3 } },
      { below: 0.33, name: "The Matriarch splits open, weeping rot!", speedMult: 1.2, atkSpeedMult: 1.3, adds: { type: "hollow_tender", count: 2 } },
    ],
  },
};

/** Gulpmaw: a fen toad the size of a cart, with a bell of drowned skulls on its tongue. */
const gulpmaw: MonsterType = {
  id: "gulpmaw", name: "Gulpmaw the Bloated", ai: "boss", family: "beast", color: "#4a5a3a",
  radius: 42, hp: 145, speed: 85, aggroRadius: 380, damage: 18, attackRange: 56, windup: 1.0, recover: 1.0,
  knockback: 700, kbResist: 0.95, packWeight: 0,
  attacks: [
    { id: "tongue_lash", kind: "charge", range: 320, windup: 0.9, recover: 0.8, cooldown: 2.5, weight: 3, dmg: 1, width: 46, form: "attack", kb: 300, noMove: true },
    { id: "belly_slam", kind: "slam", range: 60, windup: 1.0, recover: 1.0, cooldown: 0, weight: 3, dmg: 1.1, radius: 96, offset: 40, form: "area" },
    { id: "great_leap", kind: "leap", range: 420, minRange: 100, windup: 1.0, recover: 1.0, cooldown: 5, weight: 3, dmg: 1.3, radius: 110, form: "area", phase: 1,
      pool: { r: 110, dur: 4, dps: 4, slow: 0.6, color: "rgba(60,90,70,0.45)" } },
    { id: "spawn_leeches", kind: "summon", range: 500, windup: 1.0, recover: 0.8, cooldown: 12, weight: 2, dmg: 0, count: 5, summon: { type: "leechkin", max: 10 }, phase: 1 },
    { id: "bile_rain", kind: "rain", range: 440, windup: 1.3, recover: 1.0, cooldown: 6, weight: 3, dmg: 0.8, radius: 60, count: 7, form: "area", phase: 2,
      pool: { r: 60, dur: 4, dps: 5, slow: 0.7, color: "rgba(110,140,50,0.45)" } },
  ],
  boss: {
    title: "Bell-Tongue of the Drowned Fen",
    hpMult: 1,
    roar: { radius: 180, dmg: 10 },
    phases: [
      { below: 1, name: "", speedMult: 1, atkSpeedMult: 1 },
      { below: 0.66, name: "Gulpmaw rings its bell of skulls!", speedMult: 1.1, atkSpeedMult: 1.1, adds: { type: "leechkin", count: 6 } },
      { below: 0.33, name: "Gulpmaw vomits the fen!", speedMult: 1.2, atkSpeedMult: 1.3, adds: { type: "mire_chanter", count: 2 } },
    ],
  },
};

/** The Shattered Warden: a hollow suit of tower-armour held together by storm. */
const shatteredWarden: MonsterType = {
  id: "shattered_warden", name: "The Shattered Warden", ai: "boss", family: "undead", color: "#7a7a8a",
  radius: 38, hp: 140, speed: 100, aggroRadius: 380, damage: 20, attackRange: 60, windup: 0.9, recover: 0.9,
  knockback: 700, kbResist: 0.95, packWeight: 0,
  attacks: [
    { id: "halberd_sweep", kind: "melee", range: 70, windup: 0.8, recover: 0.8, cooldown: 0, weight: 3, dmg: 1, radius: 110, arc: P * 0.9 },
    { id: "warden_slam", kind: "slam", range: 64, windup: 1.1, recover: 1.0, cooldown: 3, weight: 3, dmg: 1.3, radius: 92, offset: 60, form: "area", element: "lightning" },
    { id: "tower_fall", kind: "rain", range: 440, windup: 1.3, recover: 1.0, cooldown: 6, weight: 3, dmg: 1, radius: 58, count: 6, form: "area", phase: 1 },
    { id: "rally_mites", kind: "summon", range: 500, windup: 1.0, recover: 0.8, cooldown: 12, weight: 2, dmg: 0, count: 5, summon: { type: "cindermite", max: 9 }, phase: 1 },
    { id: "storm_charge", kind: "charge", range: 420, minRange: 120, windup: 0.9, recover: 0.9, cooldown: 4, weight: 4, dmg: 1.3, width: 60, form: "area", kb: 700, phase: 2, element: "lightning" },
  ],
  boss: {
    title: "Last Keeper of the Spire",
    hpMult: 1,
    roar: { radius: 170, dmg: 12 },
    phases: [
      { below: 1, name: "", speedMult: 1, atkSpeedMult: 1 },
      { below: 0.66, name: "The Warden calls down the tower!", speedMult: 1.05, atkSpeedMult: 1.1, adds: { type: "cindermite", count: 6 } },
      { below: 0.33, name: "Storm pours out of the Warden's cracks!", speedMult: 1.3, atkSpeedMult: 1.3, adds: { type: "spire_harrier", count: 2 } },
    ],
  },
};

/** Rogue exiles share one type: their stats come from their rolled gear (server/ai/exiles.ts). */
const rogueExile: MonsterType = {
  id: "rogue_exile", name: "Rogue Exile", ai: "exile", family: "undead", color: "#c0b090",
  radius: 14, hp: 140, speed: 180, aggroRadius: 380, damage: 14, attackRange: 40, windup: 0.4, recover: 0.5,
  knockback: 380, kbResist: 0.5, packWeight: 0,
};

export const ROSTER: MonsterType[] = [
  barkgnaw, wolfFeral, sapspitter, hollowTender, stumpfather,
  reedlurker, mireChanter, siltBehemoth, leechkin,
  spireHarrier, shardslinger, cairnbreaker, cindermite,
  rotwoodMatriarch, gulpmaw, shatteredWarden, rogueExile,
];

/** Pack weights per biome (includes the three original monsters). */
export const BIOME_ROSTER: Record<string, Record<string, number>> = {
  // Prototype: Hollowpine is the only live biome; its packs are Hollowpine families only (+ feral wolves).
  hollowpine: { barkgnaw: 28, wolf_feral: 24, sapspitter: 22, hollow_tender: 14, stumpfather: 10 },
  gloamwater: { bog_seer: 20, reedlurker: 28, mire_chanter: 16, silt_behemoth: 10, leechkin: 18, gnashling: 8 },
  brokenspire: { cragback: 8, spire_harrier: 28, shardslinger: 22, cairnbreaker: 12, cindermite: 22, gnashling: 8 },
};

/** The boss guarding each biome's heart (tier-2 camp). */
export const BIOME_BOSS: Record<string, string> = {
  hollowpine: "rotwood_matriarch",
  gloamwater: "gulpmaw",
  brokenspire: "shattered_warden",
};

/** Audio family for the original three (new types carry `family`). */
export const LEGACY_FAMILY: Record<string, string> = { gnashling: "beast", bog_seer: "caster", cragback: "brute" };
