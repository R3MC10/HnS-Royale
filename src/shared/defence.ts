// Defence formulas (PoE2-style, tuned for a PvP royale). Pure math, browser-safe: the server
// pipeline (server/damage.ts) and the client character sheet / tooltips both use these.
// Order of a hit: evasion (entropy) -> deflection -> block -> armour (physical only) ->
// resistances -> shock -> energy shield (barrier) -> life.

export type DamageType = "phys" | "fire" | "cold" | "light" | "chaos";
export const DAMAGE_TYPES: DamageType[] = ["phys", "fire", "cold", "light", "chaos"];
export type DamageMap = Partial<Record<DamageType, number>>;
export const ELEMENTS: DamageType[] = ["fire", "cold", "light"];

/** Colour per damage type (floating numbers, tooltips). */
export const DAMAGE_COLORS: Record<DamageType, string> = {
  phys: "#e8e2d6",
  fire: "#ff8a3d",
  cold: "#8fd8ff",
  light: "#ffe75a",
  chaos: "#c77dff",
};

export const DEF = {
  /** Armour: reduction = A / (A + K * hit), physical hits only. */
  armourK: 10,
  armourCap: 0.9,
  /** Resistances (%): default max 75, raisable to the hard cap 90. Floor -100. */
  resDefaultCap: 75,
  resHardCap: 90,
  resMin: -100,
  /** Flat resistance penalty applied to every player (no acts in a royale: 0 by default; a late-match penalty can set it). */
  resPenalty: 0,
  /** Hit chance = 1.25 * acc / (acc + 0.3 * eva), clamped to [5%, 100%]. */
  minHitChance: 0.05,
  /** Base accuracy of players and monsters (gear / monster level add to it). */
  baseAccuracy: 200,
  /** Entropy counter resets after this long without attacks from the same attacker. */
  entropyReset: 3.33,
  /** Deflection rating = 17% of evasion (+ flat deflection). Chance = R / (R + K * acc), capped. */
  deflectShare: 0.17,
  deflectK: 0.6,
  deflectCap: 0.6,
  /** A deflected hit takes 40% less damage and builds 40% less ailment. */
  deflectLess: 0.4,
  /** Passive block chance cap (%). A blocked hit is negated. */
  blockCap: 50,
  /** Energy shield (barrier): recharges 12.5% of max per s after 4 s without damage. */
  esDelay: 4,
  esRecharge: 0.125,
  /** Chaos damage removes energy shield at double rate. */
  chaosEsMult: 2,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Fraction of a physical hit removed by armour. */
export function armourReduction(armour: number, hit: number): number {
  if (armour <= 0 || hit <= 0) return 0;
  return Math.min(DEF.armourCap, armour / (armour + DEF.armourK * hit));
}

/** Chance an attack with this accuracy hits a target with this evasion. */
export function hitChance(accuracy: number, evasion: number): number {
  if (evasion <= 0) return 1;
  const acc = Math.max(1, accuracy);
  return clamp((1.25 * acc) / (acc + 0.3 * evasion), DEF.minHitChance, 1);
}

/** Chance to deflect a hit that was not evaded. */
export function deflectChance(evasion: number, flatRating: number, accuracy: number): number {
  const r = Math.max(0, evasion * DEF.deflectShare + flatRating);
  if (r <= 0) return 0;
  return Math.min(DEF.deflectCap, r / (r + DEF.deflectK * Math.max(1, accuracy)));
}

/** Effective resistance (%): raw - penalty, clamped to [min, max], max = 75 + maxRes, never above 90. */
export function effectiveRes(raw: number, maxResBonus = 0, penalty = DEF.resPenalty): number {
  const cap = Math.min(DEF.resHardCap, DEF.resDefaultCap + maxResBonus);
  return clamp(raw - penalty, DEF.resMin, cap);
}

/** Block chance as a 0..1 fraction (passive block, capped). */
export function blockFraction(blockPct: number): number {
  return clamp(blockPct, 0, DEF.blockCap) / 100;
}

/**
 * Entropy roll (pseudo-random evasion). The counter starts at a random 0..99 on the first attack
 * (or after a pause); each attack adds its hit chance (in %), and lands only when the counter
 * reaches 100. Returns whether the attack hits and the new counter.
 */
export function entropyRoll(counter: number, chance: number): { hit: boolean; counter: number } {
  const c = counter + chance * 100;
  if (c >= 100) return { hit: true, counter: c - 100 };
  return { hit: false, counter: c };
}

/** Seconds before energy shield starts recharging (faster start % shortens it). */
export function esDelay(fasterStartPct = 0): number {
  return (DEF.esDelay * 100) / (100 + Math.max(0, fasterStartPct));
}

/**
 * Split damage between energy shield and life. Chaos costs double ES. `bypass` damage (bleed,
 * poison) goes straight to life. Returns the new ES and the damage that reaches life.
 */
export function absorbEs(es: number, nonChaos: number, chaos: number, bypass = 0): { es: number; toEs: number; toLife: number } {
  let left = es;
  let life = bypass;
  // Non-chaos first, 1 ES per point.
  const a = Math.min(left, nonChaos);
  left -= a;
  life += nonChaos - a;
  // Chaos: 2 ES per point.
  const chaosAbsorbed = Math.min(chaos, left / DEF.chaosEsMult);
  left -= chaosAbsorbed * DEF.chaosEsMult;
  life += chaos - chaosAbsorbed;
  left = Math.max(0, left);
  return { es: left, toEs: es - left, toLife: life };
}

export const sumDamage = (d: DamageMap) => (d.phys ?? 0) + (d.fire ?? 0) + (d.cold ?? 0) + (d.light ?? 0) + (d.chaos ?? 0);

/** The largest damage type in a hit (number colour). */
export function dominantType(d: DamageMap): DamageType {
  let best: DamageType = "phys";
  let bv = -1;
  for (const t of DAMAGE_TYPES) {
    const v = d[t] ?? 0;
    if (v > bv) {
      bv = v;
      best = t;
    }
  }
  return best;
}
