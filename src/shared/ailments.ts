// Generic buildup meters (PoE2-style): one component for heavy stun, freeze, chill, shock, ignite,
// bleed, poison and electrocute. A hit adds (damage of the matching types / threshold) * rate to a
// meter; at 100% the ailment triggers a fixed payoff and the meter resets. Stun and electrocute
// "prime" at a rarity-based fill: the next hit that adds any buildup triggers them at once.
// Chill is the exception: it applies on any cold hit, its slow scaled by hit size.
//
// PvP tuning: crowd control on a PLAYER target is short, shares diminishing returns and leaves a
// hard-CC immunity window, so nobody can be stunlocked. Pure logic, browser-safe (server + client).
import type { DamageMap, DamageType } from "./defence";

export type AilmentKind = "stun" | "freeze" | "chill" | "shock" | "ignite" | "bleed" | "poison" | "electrocute";
/** Bit order for snapshot masks. */
export const AIL_KINDS: AilmentKind[] = ["stun", "freeze", "chill", "shock", "ignite", "bleed", "poison", "electrocute"];
/** Meter-driven kinds (everything but chill). */
export const METER_KINDS: AilmentKind[] = ["stun", "freeze", "shock", "ignite", "bleed", "poison", "electrocute"];
/** Hard crowd control: target cannot act. */
export const HARD_CC: AilmentKind[] = ["stun", "freeze", "electrocute"];

export type TargetRarity = "normal" | "magic" | "rare" | "unique" | "player";

export interface AilmentRule {
  src: DamageType[]; // damage types that build the meter
  rate: number; // meter fill per (damage / threshold)
  optIn?: boolean; // builds only when the hit enables it (HitSpec.ail[kind] > 0)
  usesStunThreshold?: boolean; // stun compares with the stun threshold (max life), others with the ailment threshold
  /** Payoff duration: vs monsters, vs unique monsters, vs players. */
  dur: { mon: number; unique: number; player: number };
  /** Damage over time: fraction of the peak contributing hit per second. */
  dotPct?: number;
  /** Damage over time skips energy shield. */
  bypassEs?: boolean;
  /** Shock: extra damage taken (monsters / players). */
  taken?: { mon: number; player: number };
  /** Primed fill per rarity (stun / electrocute). */
  primed?: Record<TargetRarity, number>;
  /** Seconds without buildup before the meter decays, and decay per second. */
  decayDelay: number;
  decayRate: number;
}

export const AILMENTS: Record<Exclude<AilmentKind, "chill">, AilmentRule> = {
  stun: {
    src: ["phys", "fire", "cold", "light", "chaos"], rate: 1, usesStunThreshold: true,
    dur: { mon: 2.0, unique: 1.0, player: 0.8 },
    primed: { normal: 0.4, magic: 0.6, rare: 0.7, unique: 0.8, player: 0.7 },
    decayDelay: 1.5, decayRate: 0.5,
  },
  freeze: {
    src: ["cold"], rate: 1,
    dur: { mon: 3.0, unique: 1.5, player: 1.0 },
    decayDelay: 2, decayRate: 0.35,
  },
  shock: {
    src: ["light"], rate: 1.5,
    dur: { mon: 4.0, unique: 4.0, player: 3.0 },
    taken: { mon: 0.2, player: 0.15 },
    decayDelay: 2, decayRate: 0.35,
  },
  ignite: {
    src: ["fire"], rate: 1.5,
    dur: { mon: 4.0, unique: 4.0, player: 3.0 },
    dotPct: 0.2,
    decayDelay: 2, decayRate: 0.35,
  },
  bleed: {
    src: ["phys"], rate: 1.5, optIn: true,
    dur: { mon: 5.0, unique: 5.0, player: 4.0 },
    dotPct: 0.15, bypassEs: true,
    decayDelay: 2, decayRate: 0.35,
  },
  poison: {
    src: ["phys", "chaos"], rate: 1.5, optIn: true,
    dur: { mon: 3.0, unique: 3.0, player: 3.0 },
    dotPct: 0.2, bypassEs: true,
    decayDelay: 2, decayRate: 0.35,
  },
  electrocute: {
    src: ["light"], rate: 1, optIn: true,
    dur: { mon: 1.5, unique: 0.75, player: 0.6 },
    primed: { normal: 0.4, magic: 0.5, rare: 0.6, unique: 0.7, player: 0.7 },
    decayDelay: 1.5, decayRate: 0.5,
  },
};

/** Stun buildup multipliers (PoE2): player hits x1.5 physical, x1.5 melee; monster hits on players x2 physical, x1.33 melee. */
export const STUN_MULT = {
  byPlayer: { phys: 1.5, melee: 1.5 },
  byMonster: { phys: 2.0, melee: 1.33 },
};

/** Chill: instant on any cold hit, slow = k * (cold / threshold)^0.4, clamped. */
export const CHILL = { k: 0.5, min: 0.05, maxMon: 0.3, maxPlayer: 0.2, dur: 2 };

/** Player threshold for ailments = 50% of max life; stun threshold = max life. */
export const AILMENT_THRESHOLD_FRAC = 0.5;

/** PvP anti-stunlock rules for player targets. */
export const PVP_CC = {
  /** After any hard CC ends: immune to all hard CC (meters do not build) for this long. */
  immunity: 3,
  /** Each further hard CC inside the window lasts this much less (multiplicative). */
  drFactor: 0.5,
  drWindow: 10,
  /** Hard CC never lasts less than this (s). */
  minDur: 0.25,
};

/** Unique monsters: each freeze raises the freeze threshold by 50%; the bonus decays over 10 s. */
export const BOSS_FREEZE_RAISE = 0.5;
export const BOSS_FREEZE_DECAY = 0.05; // per s

export interface ActiveAilment {
  t: number; // s left
  total: number;
  mag: number; // shock: extra damage taken; chill: slow fraction
  dps: number; // damage over time
}

export interface AilState {
  meter: Partial<Record<AilmentKind, number>>; // 0..1
  idle: Partial<Record<AilmentKind, number>>; // s since last buildup
  peak: Partial<Record<AilmentKind, number>>; // biggest contributing hit since the meter was last empty
  active: Partial<Record<AilmentKind, ActiveAilment>>;
  ccImmune: number; // s of hard-CC immunity left (players)
  drCount: number; // hard CCs inside the DR window
  drT: number; // s left in the DR window
  freezeRaise: number; // bosses: extra freeze threshold fraction
  wasHardCc: boolean;
}

export function newAilState(): AilState {
  return { meter: {}, idle: {}, peak: {}, active: {}, ccImmune: 0, drCount: 0, drT: 0, freezeRaise: 0, wasHardCc: false };
}

export interface BuildupCtx {
  /** Damage taken by type (after mitigation). */
  dmg: DamageMap;
  ailThreshold: number;
  stunThreshold: number;
  rarity: TargetRarity;
  byPlayer: boolean; // attacker is a player
  melee: boolean;
  /** Buildup multiplier (deflected hits: 0.6). */
  mult: number;
  /** Per-ailment multipliers from the hit (opt-in kinds need > 0). */
  ail?: Partial<Record<AilmentKind, number>>;
}

const isPlayerTarget = (c: { rarity: TargetRarity }) => c.rarity === "player";

export function isHardCc(st: AilState): boolean {
  return HARD_CC.some((k) => (st.active[k]?.t ?? 0) > 0);
}

/** Primed (stun / electrocute) for a rarity: meter at or above the primed threshold. */
export function isPrimed(st: AilState, kind: AilmentKind, rarity: TargetRarity): boolean {
  const r = (AILMENTS as Record<string, AilmentRule>)[kind];
  return !!r?.primed && (st.meter[kind] ?? 0) >= r.primed[rarity] && !(st.active[kind]?.t);
}

/** Duration of a payoff on this target (with PvP diminishing returns on hard CC). */
export function payoffDuration(st: AilState, kind: Exclude<AilmentKind, "chill">, rarity: TargetRarity): number {
  const r = AILMENTS[kind];
  let d = rarity === "player" ? r.dur.player : rarity === "unique" ? r.dur.unique : r.dur.mon;
  if (rarity === "player" && HARD_CC.includes(kind)) d = Math.max(PVP_CC.minDur, d * Math.pow(PVP_CC.drFactor, st.drCount));
  return d;
}

/**
 * Add one hit's buildup. Returns the ailments that triggered (including chill).
 * Mutates `st`.
 */
export function addBuildup(st: AilState, c: BuildupCtx): AilmentKind[] {
  const procs: AilmentKind[] = [];
  const player = isPlayerTarget(c);
  const hardBlocked = player && (st.ccImmune > 0 || isHardCc(st));
  for (const kind of METER_KINDS) {
    const rule = AILMENTS[kind as Exclude<AilmentKind, "chill">];
    const hitMult = c.ail?.[kind] ?? (rule.optIn ? 0 : 1);
    if (hitMult <= 0) continue;
    if (HARD_CC.includes(kind) && hardBlocked) continue;
    let typed = 0;
    for (const t of rule.src) typed += c.dmg[t] ?? 0;
    if (typed <= 0) continue;
    let thr = rule.usesStunThreshold ? c.stunThreshold : c.ailThreshold;
    if (kind === "freeze") thr *= 1 + st.freezeRaise;
    if (thr <= 0) continue;
    let add = (typed / thr) * rule.rate * c.mult * hitMult;
    if (kind === "stun") {
      const m = c.byPlayer ? STUN_MULT.byPlayer : STUN_MULT.byMonster;
      const physShare = (c.dmg.phys ?? 0) / typed;
      add *= 1 + (m.phys - 1) * physShare; // physical portion builds faster
      if (c.melee) add *= m.melee;
    }
    if (add <= 0) continue;
    const wasPrimed = isPrimed(st, kind, c.rarity);
    const v = (st.meter[kind] ?? 0) + add;
    st.idle[kind] = 0;
    st.peak[kind] = Math.max(st.peak[kind] ?? 0, typed);
    if (v >= 1 || wasPrimed) {
      trigger(st, kind as Exclude<AilmentKind, "chill">, c.rarity, st.peak[kind] ?? typed);
      procs.push(kind);
    } else st.meter[kind] = v;
  }
  // Chill: any cold hit, magnitude by hit size.
  const cold = c.dmg.cold ?? 0;
  const chillMult = c.ail?.chill ?? 1;
  if (cold > 0 && chillMult > 0 && c.ailThreshold > 0 && !(st.active.freeze?.t)) {
    const max = player ? CHILL.maxPlayer : CHILL.maxMon;
    const slow = Math.min(max, CHILL.k * Math.pow((cold / c.ailThreshold) * c.mult * chillMult, 0.4));
    if (slow >= CHILL.min) {
      const cur = st.active.chill;
      if (!cur || cur.t <= 0) procs.push("chill");
      if (!cur || cur.t <= 0 || slow >= cur.mag) st.active.chill = { t: CHILL.dur, total: CHILL.dur, mag: slow, dps: 0 };
      else cur.t = CHILL.dur; // weaker chill refreshes the stronger one
    }
  }
  return procs;
}

function trigger(st: AilState, kind: Exclude<AilmentKind, "chill">, rarity: TargetRarity, peak: number) {
  const rule = AILMENTS[kind];
  const d = payoffDuration(st, kind, rarity);
  const cur = st.active[kind];
  const dps = rule.dotPct ? rule.dotPct * peak : 0;
  const mag = rule.taken ? (rarity === "player" ? rule.taken.player : rule.taken.mon) : 0;
  // Damage over time: keep the stronger instance (single instance per ailment, PvP-friendly).
  if (cur && cur.t > 0 && rule.dotPct && cur.dps > dps) cur.t = Math.max(cur.t, d);
  else st.active[kind] = { t: d, total: d, mag, dps };
  st.meter[kind] = 0;
  st.peak[kind] = 0;
  if (HARD_CC.includes(kind)) {
    if (kind === "freeze") delete st.active.chill;
    if (rarity === "player") {
      st.drCount++;
      st.drT = PVP_CC.drWindow;
      // A hard CC wipes the other hard-CC meters so they cannot chain straight after it.
      for (const k of HARD_CC) if (k !== kind) st.meter[k] = 0;
    }
    if (rarity === "unique" && kind === "freeze") st.freezeRaise += BOSS_FREEZE_RAISE;
  }
}

/** Damage over time this tick, split by whether it bypasses energy shield. */
export interface DotTick {
  normal: number; // ignite (fire)
  bypass: number; // bleed, poison
  chaos: number; // poison share that is chaos (for ES); kept in bypass too
}

/** Advance timers, decay meters, return damage over time for this step. Mutates `st`. */
/**
 * Guaranteed payoff from a skill (skill gems: "ignites for X% of the hit", "chills for N s"), applied
 * through the same single-instance rules as buildup: the stronger ignite / chill wins, a weaker one
 * refreshes the duration. `v` = ignite dps or chill slow fraction. Returns true if newly applied.
 */
export function forceAilment(st: AilState, kind: "ignite" | "chill", v: number, dur: number): boolean {
  if (!(v > 0) || !(dur > 0)) return false;
  if (kind === "chill" && st.active.freeze?.t) return false;
  const cur = st.active[kind];
  const fresh = !cur || cur.t <= 0;
  const strength = kind === "ignite" ? "dps" : "mag";
  if (fresh || v >= cur[strength]) st.active[kind] = { t: dur, total: dur, mag: kind === "chill" ? v : 0, dps: kind === "ignite" ? v : 0 };
  else cur.t = Math.max(cur.t, dur);
  return fresh;
}

export function tickAilments(st: AilState, dt: number, isPlayer: boolean): DotTick {
  const out: DotTick = { normal: 0, bypass: 0, chaos: 0 };
  const hardBefore = isHardCc(st);
  for (const kind of AIL_KINDS) {
    const a = st.active[kind];
    if (a && a.t > 0) {
      const step = Math.min(dt, a.t);
      if (a.dps > 0) {
        const rule = (AILMENTS as Record<string, AilmentRule>)[kind];
        if (rule?.bypassEs) out.bypass += a.dps * step;
        else out.normal += a.dps * step;
      }
      a.t -= dt;
      if (a.t <= 0) delete st.active[kind];
    }
    if (kind === "chill") continue;
    const m = st.meter[kind] ?? 0;
    if (m > 0) {
      const idle = (st.idle[kind] ?? 0) + dt;
      st.idle[kind] = idle;
      const rule = AILMENTS[kind as Exclude<AilmentKind, "chill">];
      if (idle >= rule.decayDelay) {
        const nv = m - rule.decayRate * dt;
        if (nv <= 0) {
          delete st.meter[kind];
          st.peak[kind] = 0;
        } else st.meter[kind] = nv;
      }
    }
  }
  if (isPlayer && hardBefore && !isHardCc(st)) {
    st.ccImmune = PVP_CC.immunity; // CC just ended: immunity window
    for (const k of HARD_CC) st.meter[k] = 0;
  } else if (st.ccImmune > 0) st.ccImmune = Math.max(0, st.ccImmune - dt);
  if (st.drT > 0) {
    st.drT -= dt;
    if (st.drT <= 0) st.drCount = 0;
  }
  if (st.freezeRaise > 0) st.freezeRaise = Math.max(0, st.freezeRaise - BOSS_FREEZE_DECAY * dt);
  st.wasHardCc = isHardCc(st);
  return out;
}

/** Extra damage taken multiplier from shock. */
export function shockMult(st: AilState): number {
  const s = st.active.shock;
  return s && s.t > 0 ? 1 + s.mag : 1;
}

/** Movement multiplier: 0 while hard CC'd, else 1 - chill slow. */
export function moveMult(st: AilState): number {
  if (isHardCc(st)) return 0;
  const c = st.active.chill;
  return c && c.t > 0 ? 1 - c.mag : 1;
}

// ---- network encoding ---------------------------------------------------------------------

/** Compact ailment status for snapshots. a = active bits, p = primed bits, m = meters (0..99) by short key, i = CC immune. */
export interface AilSnap {
  a?: number;
  p?: number;
  m?: Partial<Record<AilShort, number>>;
  i?: 1;
}
export type AilShort = "s" | "f" | "k" | "g" | "b" | "p" | "e";
export const AIL_SHORT: Record<Exclude<AilmentKind, "chill">, AilShort> = {
  stun: "s", freeze: "f", shock: "k", ignite: "g", bleed: "b", poison: "p", electrocute: "e",
};

export function encodeAil(st: AilState, rarity: TargetRarity): AilSnap | undefined {
  let a = 0;
  let p = 0;
  let m: AilSnap["m"];
  AIL_KINDS.forEach((k, i) => {
    if ((st.active[k]?.t ?? 0) > 0) a |= 1 << i;
    if (isPrimed(st, k, rarity)) p |= 1 << i;
    if (k === "chill") return;
    const v = Math.round((st.meter[k] ?? 0) * 100);
    if (v > 0) (m ??= {})[AIL_SHORT[k as Exclude<AilmentKind, "chill">]] = Math.min(99, v);
  });
  if (!a && !p && !m && st.ccImmune <= 0) return undefined;
  const out: AilSnap = {};
  if (a) out.a = a;
  if (p) out.p = p;
  if (m) out.m = m;
  if (st.ccImmune > 0) out.i = 1;
  return out;
}

export const hasAil = (s: AilSnap | undefined, k: AilmentKind) => !!s?.a && (s.a & (1 << AIL_KINDS.indexOf(k))) !== 0;
export const isPrimedSnap = (s: AilSnap | undefined, k: AilmentKind) => !!s?.p && (s.p & (1 << AIL_KINDS.indexOf(k))) !== 0;
export const meterOf = (s: AilSnap | undefined, k: Exclude<AilmentKind, "chill">) => (s?.m?.[AIL_SHORT[k]] ?? 0) / 100;

/** Display info (client). Names are original. */
export const AIL_INFO: Record<AilmentKind, { name: string; color: string }> = {
  stun: { name: "Staggered", color: "#f2e6b8" },
  freeze: { name: "Frozen", color: "#9fe3ff" },
  chill: { name: "Chilled", color: "#6fb7e8" },
  shock: { name: "Shocked", color: "#ffe14d" },
  ignite: { name: "Burning", color: "#ff7a2a" },
  bleed: { name: "Bleeding", color: "#d0323a" },
  poison: { name: "Poisoned", color: "#7bd34a" },
  electrocute: { name: "Jolted", color: "#b49bff" },
};
