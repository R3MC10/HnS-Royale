// Derived per-player stats. Start from constants.ts defaults; the server
// recomputes them from equipment (items.ts computeStats) and status effects.
// Sim and combat read only from this object.
import {
  ATTACK_ARC,
  ATTACK_COOLDOWN,
  ATTACK_DAMAGE,
  ATTACK_RANGE,
  DODGE_COOLDOWN,
  DODGE_IFRAMES,
  DODGE_SPEED,
  DODGE_TIME,
  KNOCKBACK,
  MAX_HP,
  MAX_MANA,
  BASE_MANA_REGEN,
  MANA_REGEN_PCT,
  MOVE_SPEED,
  STAT_BOUNDS,
  SWING_MOVE_MULT,
  SWING_TIME,
} from "./constants";

export interface Stats {
  maxHp: number;
  moveSpeed: number; // px/s
  swingMoveMult: number; // movement multiplier while swinging
  attackDamage: number;
  attackRange: number; // reach beyond the attacker's body
  attackArc: number; // total arc width, radians
  attackCooldown: number; // s between swings
  swingTime: number; // s the swing lasts
  knockback: number; // initial knockback speed applied to targets
  dodgeSpeed: number;
  dodgeTime: number;
  dodgeIframes: number; // invulnerable for this long at the start of a roll
  dodgeCooldown: number;
  lifeRegen: number; // hp per second
  flaskChargeGain: number; // multiplier on charges gained
  flaskRecovery: number; // multiplier on flask healing
  flaskSlots: number; // 1..3 (set by belt)
  maxMana: number; // skills (shared/skills.ts)
  manaRegen: number; // mana per second
  spellMult: number; // multiplier on spell damage
  castSpeed: number; // multiplier on spell cast speed
  spirit: number; // reservable pool for persistent skills (starts at 0)
  // Defences (server/damage.ts, shared/defence.ts)
  armour: number; // physical hit reduction A / (A + 10 * hit)
  evasion: number; // entropy evasion vs attacks; 17% of it is deflection rating
  energyShield: number; // max energy shield (barrier): absorbs before life, recharges after a delay
  esFasterStart: number; // % faster start of energy shield recharge
  blockChance: number; // % passive block (cap 50)
  resFire: number; // % (default cap 75, hard cap 90)
  resCold: number;
  resLight: number;
  resChaos: number;
  maxRes: number; // + % to maximum elemental resistances
  accuracy: number; // vs evasion
  ailmentThreshold: number; // % increased ailment threshold (base 50% of life)
  stunThreshold: number; // % increased stun threshold (base = life)
  critChance: number; // % chance for a hit to crit (server/damage.ts)
  critMulti: number; // % damage of a critical hit (150 = +50%)
  // + level of skill gems from gear (content/affixes.ts lvl* mods; shared/skills.ts computeSkill)
  lvlSpell: number;
  lvlMelee: number;
  lvlProj: number;
  lvlFire: number; // fire spell skills
  lvlCold: number; // cold spell skills
  lvlLight: number; // lightning spell skills
}

export function defaultStats(): Stats {
  return {
    maxHp: MAX_HP,
    moveSpeed: MOVE_SPEED,
    swingMoveMult: SWING_MOVE_MULT,
    attackDamage: ATTACK_DAMAGE,
    attackRange: ATTACK_RANGE,
    attackArc: ATTACK_ARC,
    attackCooldown: ATTACK_COOLDOWN,
    swingTime: SWING_TIME,
    knockback: KNOCKBACK,
    dodgeSpeed: DODGE_SPEED,
    dodgeTime: DODGE_TIME,
    dodgeIframes: DODGE_IFRAMES,
    dodgeCooldown: DODGE_COOLDOWN,
    lifeRegen: 0,
    flaskChargeGain: 1,
    flaskRecovery: 1,
    flaskSlots: 1,
    maxMana: MAX_MANA,
    manaRegen: BASE_MANA_REGEN + MAX_MANA * MANA_REGEN_PCT,
    spellMult: 1,
    castSpeed: 1,
    spirit: 0,
    armour: 0,
    evasion: 0,
    energyShield: 0,
    esFasterStart: 0,
    blockChance: 0,
    resFire: 0,
    resCold: 0,
    resLight: 0,
    resChaos: 0,
    maxRes: 0,
    accuracy: 200,
    ailmentThreshold: 0,
    stunThreshold: 0,
    critChance: 5,
    critMulti: 150,
    lvlSpell: 0,
    lvlMelee: 0,
    lvlProj: 0,
    lvlFire: 0,
    lvlCold: 0,
    lvlLight: 0,
  };
}

/** Read-only defaults (used when no stats are supplied). */
export const DEFAULT_STATS: Readonly<Stats> = Object.freeze(defaultStats());

export const STAT_KEYS = Object.keys(DEFAULT_STATS) as (keyof Stats)[];

export function clampStats(s: Stats): Stats {
  for (const k of STAT_KEYS) {
    const [lo, hi] = STAT_BOUNDS[k];
    s[k] = Math.max(lo, Math.min(hi, s[k]));
  }
  s.flaskSlots = Math.round(s.flaskSlots);
  return s;
}

/** Validates an untrusted stats object (e.g. from the network); falls back to defaults per field. */
export function sanitizeStats(raw: unknown): Stats {
  const out = defaultStats();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of STAT_KEYS) {
      const v = o[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    }
  }
  return out;
}

export function statsEqual(a: Stats, b: Stats): boolean {
  return STAT_KEYS.every((k) => a[k] === b[k]);
}
