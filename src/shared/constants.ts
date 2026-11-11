// Tunable game constants shared by client and server.
// Content (items, affixes, monsters, flasks) lives in src/shared/content/.

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

// Map size is live: the procedural map (shared/map.ts) sets it per match via setMapSize.
export let MAP_W = 2400;
export let MAP_H = 2400;
/** Called by shared/map.ts when a new map is installed. */
export function setMapSize(w: number, h: number) {
  MAP_W = w;
  MAP_H = h;
}

// ---- Player defaults (base Stats; gear modifies them, see stats.ts) -------
export const PLAYER_RADIUS = 20;
export const MAX_HP = 100;
export const MOVE_SPEED = 230; // px/s
export const SWING_MOVE_MULT = 0.3; // slowed while attacking (weapons override)

// Dodge roll (Space). I-frames are the first DODGE_IFRAMES seconds of the roll.
export const DODGE_SPEED = 560;
export const DODGE_TIME = 0.32; // s
export const DODGE_IFRAMES = 0.24; // s
export const DODGE_COOLDOWN = 1.1; // s

// Unarmed defaults; the equipped weapon base overrides these (content/bases.ts).
export const ATTACK_COOLDOWN = 0.55; // s between swings (= full attack time)
export const SWING_TIME = 0.55; // s a full attack lasts (wind-up + follow-through)
/** Attacks commit: the hit lands this far into the swing (PoE2-style wind-up). A dodge before it cancels the attack. */
export const ATTACK_COMMIT = 0.5;
/**
 * Follow-through: in the last ATTACK_RECOVER_TAIL seconds of any attack or skill use (always after the hit for
 * the weapons and skills in the game) the hero already moves at ATTACK_RECOVER_MOVE of full speed at least,
 * instead of staying at the attack's slow walk until the animation ends. Facing stays locked.
 */
export const ATTACK_RECOVER_TAIL = 0.2; // s
export const ATTACK_RECOVER_MOVE = 0.8; // floor on the move multiplier during the tail
export const ATTACK_RANGE = 62; // reach beyond the attacker's body
export const ATTACK_ARC = (110 * Math.PI) / 180; // total arc width
export const ATTACK_DAMAGE = 22;
export const KNOCKBACK = 520; // initial knockback speed px/s
export const KNOCKBACK_DECAY = 9; // per-second exponential decay

/** Player-vs-player damage multiplier (monsters are unaffected). */
export const PVP_DAMAGE_MULT = 0.4;
/**
 * Life flasks recover this much of their amount while the drinker is in a player fight (dealt or took a
 * player hit in the last PVP_FLASK_WINDOW seconds). Player hits are cut to 0.4 but flasks healed in
 * full; halving them trims the long tail of duels and the share of matches that reach sudden death
 * (docs/BALANCE.md).
 */
export const PVP_FLASK_MULT = 0.5;
export const PVP_FLASK_WINDOW = 6; // s

// Mana (skills; see shared/skills.ts). Regen = BASE_MANA_REGEN + MANA_REGEN_PCT of max mana per second.
export const MAX_MANA = 60;
export const BASE_MANA_REGEN = 2;
export const MANA_REGEN_PCT = 0.04;

/** Clamp ranges applied after all gear is summed (anti-degenerate builds). */
export const STAT_BOUNDS = {
  maxHp: [20, 1000],
  moveSpeed: [120, 420],
  swingMoveMult: [0.2, 1],
  attackDamage: [1, 400],
  attackRange: [20, 170],
  attackArc: [0.3, 3.2],
  attackCooldown: [0.15, 3],
  swingTime: [0.08, 1],
  knockback: [0, 1500],
  dodgeSpeed: [200, 900],
  dodgeTime: [0.1, 0.6],
  dodgeIframes: [0, 0.5],
  dodgeCooldown: [0.3, 5],
  lifeRegen: [0, 50],
  flaskChargeGain: [0.25, 5],
  flaskRecovery: [0.25, 5],
  flaskSlots: [1, 3],
  maxMana: [0, 1000],
  manaRegen: [0, 100],
  spellMult: [0.1, 10],
  castSpeed: [0.2, 5],
  spirit: [0, 500],
  armour: [0, 20000],
  evasion: [0, 20000],
  energyShield: [0, 2000],
  esFasterStart: [0, 300],
  blockChance: [0, 75],
  resFire: [-100, 200],
  resCold: [-100, 200],
  resLight: [-100, 200],
  resChaos: [-100, 200],
  maxRes: [0, 15],
  accuracy: [1, 5000],
  ailmentThreshold: [-50, 300],
  stunThreshold: [-50, 300],
  critChance: [0, 100],
  critMulti: [100, 500],
  lvlSpell: [0, 10],
  lvlMelee: [0, 10],
  lvlProj: [0, 10],
  lvlFire: [0, 10],
  lvlCold: [0, 10],
  lvlLight: [0, 10],
} as const;

// ---- Items / inventory ----------------------------------------------------
export const INV_SIZE = 12;
export const MAX_FLASK_SLOTS = 3;
export const PICKUP_RANGE = 90; // px from player center to the item
export const ITEM_RADIUS = 10;
export const MAX_GROUND_ITEMS = 500; // oldest are removed beyond this
export const MAX_ITEM_LEVEL = 20;

// Flask charges gained per kill (multiplied by the flaskChargeGain stat).
export const CHARGES_NORMAL_KILL = 3;
export const CHARGES_ELITE_KILL = 8;
export const CHARGES_PLAYER_KILL = 15;
/**
 * Flask trickle (royale stand-in for PoE2's wells and checkpoints, there are none here): a flask with less
 * than one use left gains charges while its owner has taken no damage for FLASK_TRICKLE_DELAY seconds, up to
 * one use and no further. Kills stay the only way to more than one use.
 */
export const FLASK_TRICKLE_DELAY = 6; // s without taking damage
export const FLASK_TRICKLE_PER_SEC = 0.5; // charges per second (a use costs 10)

// ---- Monsters ---------------------------------------------------------------
export const CAMP_COUNT = 14;
export const CAMP_MIN_SPACING = 380;
export const CAMP_PLAYER_CLEARANCE = 320; // no camp this close to a player at populate time
export const CAMP_ELITE_CHANCE = 0.35;
export const CAMP_PRACTICE_RESPAWN = 25; // s, cleared camps respawn while waiting for players
export const LEASH_RADIUS = 650; // monsters return home if pulled this far from camp

// ---- Rounds ---------------------------------------------------------------
export const MIN_PLAYERS_FOR_ROUND = 2;
export const COUNTDOWN_TIME = 4; // s
export const ROUND_END_TIME = 14; // s showing the winner (lobby-run matches leave after hostruntime endHold, 12 s)
// Match-length levers (no zone, no timer; target 5-7 min with 15 players). See docs/BALANCE.md (round 13).
export const REVEAL_ALIVE = 5; // this many or fewer left: every survivor is shown on the map (was 3)
export const REVEAL_AFTER = 240; // s of fight after which survivors are shown on the map whatever the count (was 300)
// Sudden death: a duel where recovery (life regeneration, energy shield recharge, flasks) keeps up with the
// damped PvP damage never ends on its own, for bots or people. Past this point damage between players doubles
// every SUDDEN_DEATH_DOUBLE seconds (server/game.ts), so every match ends a couple of minutes later at most.
export const SUDDEN_DEATH_AFTER = 420; // s of fight
export const SUDDEN_DEATH_DOUBLE = 60; // s
export const SUDDEN_DEATH_MAX = 16; // cap on the multiplier
export const BOT_LATE_SECS = 240; // s of fight after which bots treat the match as late game and hunt (was 420, then 270 while monsters still killed half the field)
export const PRACTICE_RESPAWN = 2; // s, respawn delay while waiting for players

export const MAX_NAME_LEN = 16;
export const MAX_PLAYERS = 20;

// ---- Networking / anti-cheat ----------------------------------------------
export const MAX_INPUTS_PER_TICK = 4; // burst cap on simulated inputs per server tick (token bucket)
export const MAX_INPUT_QUEUE = 12; // queued inputs beyond this are dropped (oldest first)
export const INTERP_DELAY = 0.1; // s, remote entities are rendered this far in the past
export const PING_INTERVAL = 2; // s
export const VIEW_RADIUS = 1150; // interest management: entities farther than this are not sent
export const BOARD_INTERVAL = 30; // ticks between scoreboard / minimap camp updates
