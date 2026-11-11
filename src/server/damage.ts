// The single damage pipeline (server-authoritative). Every hit a player or monster takes should go
// through hitPlayer / hitMonster; combat.damagePlayer is a legacy wrapper around hitPlayer.
//
// Player target:  dodge i-frames -> evasion (per-attacker entropy) -> deflection -> block
//   -> armour (physical, vs the raw pre-PvP hit) -> resistances -> PvP multiplier -> shock
//   -> hooks (more/less taken) -> energy shield (chaos x2) -> life -> ailment buildup.
// Monster target: shock -> MonsterSystem.damage() (monster defences live there) -> ailment buildup.
//
// Per-target state (ES pool, entropy counters, ailment meters) lives here, keyed by id, so the shared
// player / monster records stay untouched. Browser-safe: no node imports.
import { laneHook } from "./modes/lanehook";
import { DT, FLASK_TRICKLE_DELAY, FLASK_TRICKLE_PER_SEC, PVP_DAMAGE_MULT, PVP_FLASK_MULT, PVP_FLASK_WINDOW } from "../shared/constants";
import { FLASK_CHARGES_PER_USE } from "../shared/content/flasks";
import { flaskProps } from "../shared/items";
import {
  addBuildup,
  AILMENT_THRESHOLD_FRAC,
  encodeAil,
  forceAilment,
  isHardCc,
  moveMult,
  newAilState,
  shockMult,
  tickAilments,
  type AilmentKind,
  type AilSnap,
  type AilState,
  type TargetRarity,
} from "../shared/ailments";
import {
  absorbEs,
  armourReduction,
  blockFraction,
  DEF,
  deflectChance,
  dominantType,
  effectiveRes,
  entropyRoll,
  esDelay,
  hitChance,
  sumDamage,
  type DamageMap,
  type DamageType,
} from "../shared/defence";
import type { GameEvent, GoreFx } from "../shared/protocol";
import { isInvulnerable } from "../shared/sim";
import { MONSTER_CRIT } from "../shared/content/monsters/mods";
import { modsOf } from "./ai/state";
import type { Monster, MonsterSystem } from "./monsters";
import type { ServerPlayer } from "./player";

export type { DamageMap, DamageType } from "../shared/defence";
export type { AilmentKind } from "../shared/ailments";

/** What the pipeline needs from the game (Game implements it via CombatHost). */
export interface DamageHost {
  events: GameEvent[];
  monsters: MonsterSystem;
  onPlayerKilled(victim: ServerPlayer, killer: ServerPlayer | null, source: string): void;
  onMonsterKilled(m: Monster, killer: ServerPlayer): void;
}

/** melee / proj: evadable, deflectable, blockable. spell: blockable. area / dot: none of those. */
export type HitForm = "melee" | "proj" | "spell" | "area" | "dot";

export interface HitSpec {
  /** RAW damage by type (before the PvP multiplier; the pipeline applies it). */
  dmg: DamageMap;
  /** Attacking player (null for monsters / environment). */
  by: ServerPlayer | null;
  /** Display name for the kill feed. */
  source: string;
  form: HitForm;
  /** Origin (knockback direction, active-block facing). */
  x: number;
  y: number;
  kb?: number;
  /** Attacker accuracy (players default to their stats.accuracy, monsters to DEF.baseAccuracy). */
  accuracy?: number;
  unblockable?: boolean;
  /** Ignore dodge-roll i-frames (e.g. future boss slams). */
  noIframes?: boolean;
  /** Per-ailment buildup multipliers. bleed / poison / electrocute build only when > 0. */
  ail?: Partial<Record<AilmentKind, number>>;
  /** Extra multiplier on the final damage (e.g. "more damage against players" effects). */
  more?: number;
  /** Critical strike (gore: arterial spray; client: crit sound). */
  crit?: boolean;
  /**
   * Guaranteed ailments from skill gems (on top of buildup): ignite deals ignitePct x the hit over
   * FORCED_IGNITE_TIME (players: of the damage dealt; monsters: of the hit before monster defences),
   * chill slows by chillSlow for chillDur seconds.
   */
  force?: { ignitePct?: number; chillDur?: number; chillSlow?: number };
  /** Monster attacker (for monster accuracy / future stats). */
  mon?: Monster;
}

export type HitOutcome = "hit" | "evaded" | "blocked" | "deflected" | "dodged" | "immune";

export interface HitResult {
  outcome: HitOutcome;
  dealt: number; // ES + life removed
  toEs: number;
  toLife: number;
  killed: boolean;
  procs: AilmentKind[];
  /** Set when the hit was evaded (progression reads it for evade-haste). */
  evaded?: boolean;
}

/** Extension points for progression (passives), loot (uniques / charms) and others. */
export interface DefenceHook {
  /** Return true to ignore the hit entirely (e.g. cheat-death invulnerability). */
  invuln?(p: ServerPlayer, h: HitSpec): boolean;
  /** Multiplier on damage taken after resistances (e.g. 0.9 for "10% less damage taken"). */
  takenMult?(p: ServerPlayer, h: HitSpec): number;
  /** Adjust the damage about to reach life (e.g. refuse a lethal hit). Return the new value. */
  beforeLife?(p: ServerPlayer, toLife: number, h: HitSpec): number;
  /** After every resolved hit on a player (including evades / blocks). */
  afterHit?(p: ServerPlayer, h: HitSpec, r: HitResult): void;
  /** An ailment triggered on a player or monster (charms: "when frozen"...). */
  onAilment?(target: ServerPlayer | Monster, kind: AilmentKind, isPlayer: boolean, by: ServerPlayer | null): void;
  /** Knockback multiplier on a player target (0 = knockback immune). */
  kbMult?(p: ServerPlayer, h: HitSpec): number;
  /** Attacker's damage-dealt multiplier for this hit (player attackers; not applied to "dot" form). */
  outMult?(by: ServerPlayer, target: ServerPlayer | Monster, vsPlayer: boolean, h: HitSpec): number;
  /** After a player's hit on a monster resolved (dealt = life actually removed). */
  afterMonsterHit?(by: ServerPlayer, m: Monster, dealt: number, h: HitSpec, r: HitResult): void;
}
export const defenceHooks: DefenceHook[] = [];

/** PvP: the crit damage bonus counts half against players (one-shot protection). */
export const PVP_CRIT_BONUS_SCALE = 0.5;
/** Final duel (two left in a bigger match): players hit each other harder so sustain cannot stall the ending. Set each tick by game.ts. */
export const finalDuel = { mult: 1 };
export const FINAL_DUEL_PVP_MULT = 2; // was 1.5 (round 13: with REVEAL_AFTER 240, sudden death 23% -> 14-19% of bot matches)

/**
 * Monster critical strike chance (%) and multiplier (%): small PoE2-style base by rarity
 * (shared/content/monsters/mods.ts MONSTER_CRIT), plus modifiers (Keen-Edged) and exile gear.
 */
export function monsterCrit(m: Monster): { chance: number; multi: number } {
  const r = Math.max(0, Math.min(3, m.ext?.rarity ?? (m.elite ? 2 : 0)));
  const base = MONSTER_CRIT[r];
  let chance = base.chance;
  let multi = base.multi;
  for (const md of modsOf(m)) {
    chance += md.critChance ?? 0;
    multi += md.critMulti ?? 0;
  }
  const ex = m.ext?.exile;
  if (ex) {
    chance = Math.max(chance, ex.crit);
    multi = Math.max(multi, ex.critMulti);
  }
  return { chance: Math.min(60, chance), multi };
}

/** Roll a critical hit for a player or monster attacker (sets h.crit; dot form never crits). Returns the damage multiplier. */
function rollCrit(h: HitSpec, vsPlayer: boolean): number {
  if (h.crit === undefined) {
    if (h.form === "dot") h.crit = false;
    else if (h.by) h.crit = rng() * 100 < (h.by.stats.critChance ?? 0);
    else if (h.mon) h.crit = rng() * 100 < monsterCrit(h.mon).chance;
    else h.crit = false;
  }
  if (!h.crit) return 1;
  if (!h.by && h.mon) return Math.max(1, monsterCrit(h.mon).multi / 100); // monster crits: full (small) bonus
  const bonus = Math.max(0, ((h.by?.stats.critMulti ?? 150) - 100) / 100);
  return 1 + bonus * (vsPlayer ? PVP_CRIT_BONUS_SCALE : 1);
}

function outMultOf(h: HitSpec, t: ServerPlayer | Monster, vsPlayer: boolean): number {
  if (!h.by || h.form === "dot" || (h.by as unknown) === t) return 1;
  let m = 1;
  for (const hk of defenceHooks) if (hk.outMult) m *= Math.max(0, hk.outMult(h.by, t, vsPlayer, h));
  return m;
}

interface DefState {
  ail: AilState;
  es: number;
  lastHit: number;
  /** Last time this player dealt or took a player hit (PvP flask rule, constants.ts PVP_FLASK_*). */
  lastPvp: number;
  entropy: Map<string, { c: number; t: number }>;
  lastBy: ServerPlayer | null; // credit for damage over time
  lastSource: string;
  dotAcc: number; // DoT damage not yet reported in a hit event
  dotT: number;
  moveSent: number; // last move multiplier applied to stats
  wasAlive: boolean;
  activeBlock: { angle: number; until: number } | null;
  /** Seconds left of skill-forced burn / chill status fx (client "burn" / "chill" particles). */
  fxIg: number;
  fxCh: number;
  fxT: number;
}

const newState = (): DefState => ({
  ail: newAilState(), es: 0, lastHit: -99, lastPvp: -99, entropy: new Map(), lastBy: null, lastSource: "", dotAcc: 0, dotT: 0, moveSent: 1, wasAlive: false, activeBlock: null,
  fxIg: 0, fxCh: 0, fxT: 0,
});

const pst = new Map<number, DefState>();
const mst = new Map<number, DefState>();
let now = 0;
let rng: () => number = Math.random;
let refresh: (p: ServerPlayer) => void = () => {};

/** Deterministic tests can swap the RNG. */
export function setDamageRng(f: () => number) {
  rng = f;
}
/** Game registers its stat refresh (chill changes move speed). */
export function setDamageRefresh(fn: (p: ServerPlayer) => void) {
  refresh = fn;
}

function ps(p: ServerPlayer): DefState {
  let s = pst.get(p.id);
  if (!s) {
    s = newState();
    s.es = p.stats.energyShield;
    s.wasAlive = p.alive;
    pst.set(p.id, s);
  }
  return s;
}
function ms(m: Monster): DefState {
  let s = mst.get(m.id);
  if (!s) mst.set(m.id, (s = newState()));
  return s;
}

/** Fresh defensive state (spawn / respawn): full energy shield, no ailments. */
export function resetDefence(p: ServerPlayer) {
  const s = newState();
  s.es = p.stats.energyShield;
  s.wasAlive = true;
  pst.set(p.id, s);
}
export function removeDefence(p: ServerPlayer) {
  pst.delete(p.id);
}

// ---- queries --------------------------------------------------------------------------------

export const esOf = (p: ServerPlayer) => pst.get(p.id)?.es ?? p.stats.energyShield;
/** Life flask recovery multiplier: PVP_FLASK_MULT while in a player fight, else 1. */
export const pvpFlaskMult = (p: ServerPlayer) => (now - (pst.get(p.id)?.lastPvp ?? -99) < PVP_FLASK_WINDOW ? PVP_FLASK_MULT : 1);
export const esMax = (p: ServerPlayer) => p.stats.energyShield;
/** Restore a fraction of max energy shield (e.g. barrier on kill). */
export function restoreEs(p: ServerPlayer, frac: number) {
  const s = ps(p);
  s.es = Math.min(p.stats.energyShield, s.es + p.stats.energyShield * frac);
}
/** Player cannot act (stun / freeze / electrocute). */
export const playerLocked = (p: ServerPlayer) => {
  const s = pst.get(p.id);
  return !!s && isHardCc(s.ail);
};
/** Movement multiplier from chill (hard CC is enforced through playerLocked). */
export const defenceMoveMult = (p: ServerPlayer) => {
  const s = pst.get(p.id);
  if (!s) return 1;
  const c = s.ail.active.chill;
  return c && c.t > 0 ? 1 - c.mag : 1;
};
export const monsterLocked = (id: number) => {
  const s = mst.get(id);
  return !!s && isHardCc(s.ail);
};
export const monsterMoveMult = (id: number) => {
  const s = mst.get(id);
  return s ? moveMult(s.ail) : 1;
};
/**
 * Remove ailments from a player and empty their buildup meters (flask cures, charm immunities;
 * loot agent). Returns true if an active ailment was removed.
 */
export function cleansePlayerAilments(p: ServerPlayer, kinds: readonly AilmentKind[]): boolean {
  const s = pst.get(p.id);
  if (!s) return false;
  let any = false;
  for (const k of kinds) {
    if ((s.ail.active[k]?.t ?? 0) > 0) any = true;
    delete s.ail.active[k];
    s.ail.meter[k] = 0;
  }
  if (any) syncMove(p, s);
  return any;
}
export function hasAilment(target: ServerPlayer | Monster, kind: AilmentKind, isPlayer: boolean): boolean {
  const s = (isPlayer ? pst : mst).get(target.id);
  return (s?.ail.active[kind]?.t ?? 0) > 0;
}

/**
 * Raise a shield: for `secs`, hits from within 100 degrees of `angle` are fully blocked (even
 * unblockable-by-chance ones, but never area / dot), and each block adds heavy-stun buildup.
 * Driven by the held "raise shield" input (InputCmd.blk, server/game.ts; keybind raiseShield).
 */
export function setActiveBlock(p: ServerPlayer, angle: number, secs: number) {
  ps(p).activeBlock = { angle, until: now + secs };
}

export function monsterRarity(m: Monster): TargetRarity {
  const r = (m as unknown as { rarity?: string | number }).rarity;
  if (r === "normal" || r === "magic" || r === "rare" || r === "unique") return r;
  if (typeof r === "number") return (["normal", "magic", "rare", "unique"] as const)[Math.max(0, Math.min(3, r | 0))];
  if (m.camp?.tier === 2 || m.id < 0) return "unique";
  return m.elite ? "rare" : "normal";
}

// ---- snapshots ------------------------------------------------------------------------------

/** Extra PlayerSnap fields: energy shield and ailment status. */
export function playerDefSnap(p: ServerPlayer): { es?: number; esm?: number; st?: AilSnap } {
  const s = pst.get(p.id);
  const out: { es?: number; esm?: number; st?: AilSnap } = {};
  if (p.stats.energyShield > 0) {
    out.esm = Math.round(p.stats.energyShield);
    out.es = Math.round(s ? s.es : p.stats.energyShield);
  }
  const st = s && encodeAil(s.ail, "player");
  if (st) out.st = st;
  return out;
}
/** Extra MonsterSnap fields: ailment status. */
export function monsterDefSnap(m: Monster): { st?: AilSnap } {
  const s = mst.get(m.id);
  const st = s && encodeAil(s.ail, monsterRarity(m));
  return st ? { st } : {};
}

// ---- the pipeline ---------------------------------------------------------------------------

const EVADABLE: HitForm[] = ["melee", "proj"];
const BLOCKABLE: HitForm[] = ["melee", "proj", "spell"];
const resOf = (p: ServerPlayer, t: DamageType) =>
  t === "fire" ? effectiveRes(p.stats.resFire, p.stats.maxRes)
  : t === "cold" ? effectiveRes(p.stats.resCold, p.stats.maxRes)
  : t === "light" ? effectiveRes(p.stats.resLight, p.stats.maxRes)
  : t === "chaos" ? effectiveRes(p.stats.resChaos, 0)
  : 0;

function defEvent(host: DamageHost, x: number, y: number, target: number, o: "evade" | "block" | "deflect" | "immune", m = false) {
  host.events.push({ k: "def", x: Math.round(x), y: Math.round(y), target, o, ...(m ? { m: 1 as const } : {}) });
}

function result(outcome: HitOutcome): HitResult {
  return { outcome, dealt: 0, toEs: 0, toLife: 0, killed: false, procs: [], ...(outcome === "evaded" ? { evaded: true } : {}) };
}

function applyKnockback(t: { x: number; y: number; kbx: number; kby: number }, fx: number, fy: number, kb: number) {
  if (kb <= 0) return;
  const dx = t.x - fx;
  const dy = t.y - fy;
  const d = Math.hypot(dx, dy) || 1;
  t.kbx = (dx / d) * kb;
  t.kby = (dy / d) * kb;
}

// ---- gore info on fx events (gore agent's GoreFx in shared/protocol.ts) ----------------------

const DT_SHORT: Record<DamageType, NonNullable<GoreFx["dt"]>> = { phys: "p", fire: "f", cold: "c", light: "l", chaos: "x" };
const r1 = (v: number) => Math.round(v * 10) / 10;
const act = (st: AilState, k: AilmentKind) => (st.active[k]?.t ?? 0) > 0;

function goreFx(h: HitSpec | null, t: { x: number; y: number }, ty: DamageType, toEs: number, toLife: number, maxHp: number, bleeding: boolean, form?: HitForm): GoreFx {
  const o: GoreFx = { dt: DT_SHORT[ty], mx: Math.round(maxHp), lf: r1(toLife) };
  if (toEs > 0) o.es = r1(toEs);
  if (h?.crit) o.cr = 1;
  if (h) {
    const dx = t.x - h.x;
    const dy = t.y - h.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.5) {
      o.dx = Math.round((dx / d) * 100) / 100;
      o.dy = Math.round((dy / d) * 100) / 100;
    }
  }
  const fo = form ?? h?.form;
  if (fo) o.fo = fo;
  if (bleeding) o.bl = 1;
  return o;
}

/** Copy gore info onto the kill / mdie event another system just pushed for this victim. */
function tagDeath(host: DamageHost, kind: "kill" | "mdie", id: number, fx: GoreFx) {
  for (let i = host.events.length - 1; i >= 0 && i >= host.events.length - 8; i--) {
    const e = host.events[i];
    if ((e.k === "kill" && kind === "kill" && e.vid === id) || (e.k === "mdie" && kind === "mdie" && e.id === id)) {
      Object.assign(e, fx);
      return;
    }
  }
}

export const FORCED_IGNITE_TIME = 3;
export const FORCED_CHILL_SLOW = 0.3;

function applyForced(s: DefState, h: HitSpec, base: number, procs: AilmentKind[]) {
  const st = s.ail;
  const f = h.force;
  if (!f) return;
  if (f.ignitePct && f.ignitePct > 0 && base > 0 && forceAilment(st, "ignite", (base * f.ignitePct) / FORCED_IGNITE_TIME, FORCED_IGNITE_TIME)) {
    if (!procs.includes("ignite")) procs.push("ignite");
    s.fxIg = FORCED_IGNITE_TIME;
    s.fxT = 0; // first status puff on the next tick
  }
  if (f.chillDur && f.chillDur > 0 && forceAilment(st, "chill", f.chillSlow ?? FORCED_CHILL_SLOW, f.chillDur)) {
    if (!procs.includes("chill")) procs.push("chill");
    s.fxCh = f.chillDur;
    s.fxT = 0;
  }
}

/** Seconds between client burn / chill status puffs (fx only: the ailment itself ticks in tickAilments). */
const STATUS_FX_EVERY = 0.4;

/** Emit the skill status fx ("burn" / "chill" SkillFx) while a skill-forced ignite / chill is still active. */
function statusFx(host: DamageHost, s: DefState, x: number, y: number) {
  if (s.fxIg <= 0 && s.fxCh <= 0) return;
  if (!act(s.ail, "ignite")) s.fxIg = 0;
  if (!act(s.ail, "chill") && !act(s.ail, "freeze")) s.fxCh = 0;
  s.fxT -= DT;
  const due = s.fxT <= 0;
  if (due) s.fxT = STATUS_FX_EVERY;
  const px = Math.round(x);
  const py = Math.round(y);
  if (due && s.fxIg > 0) host.events.push({ k: "fx", f: { e: "burn", x: px, y: py } });
  if (due && s.fxCh > 0) host.events.push({ k: "fx", f: { e: "chill", x: px, y: py } });
  s.fxIg = Math.max(0, s.fxIg - DT);
  s.fxCh = Math.max(0, s.fxCh - DT);
}

/** Resolve one hit on a player. */
export function hitPlayer(host: DamageHost, t: ServerPlayer, h: HitSpec): HitResult {
  if (!t.alive) return result("immune");
  if (laneHook.friendly?.(t, h.by, h.mon)) return result("immune"); // Breachway: no friendly fire
  if (!h.noIframes && isInvulnerable(t, t.stats)) return result("dodged");
  for (const hk of defenceHooks) if (hk.invuln?.(t, h)) return finish(host, t, h, result("immune"));
  const s = ps(t);
  const st = t.stats;
  const acc = h.accuracy ?? h.by?.stats.accuracy ?? DEF.baseAccuracy;

  // 1. Evasion (attacks and projectiles), per-attacker entropy.
  if (EVADABLE.includes(h.form) && st.evasion > 0) {
    const key = h.by ? `p${h.by.id}` : h.mon ? `m${h.mon.id}` : `s${h.source}`;
    let e = s.entropy.get(key);
    if (!e || now - e.t > DEF.entropyReset) e = { c: Math.floor(rng() * 100), t: now };
    const r = entropyRoll(e.c, hitChance(acc, st.evasion));
    s.entropy.set(key, { c: r.counter, t: now });
    if (!r.hit) {
      defEvent(host, t.x, t.y, t.id, "evade");
      return finish(host, t, h, result("evaded"));
    }
  }
  // 2. Deflection (hit lands with 40% less damage and ailment buildup).
  let deflected = false;
  if (EVADABLE.includes(h.form) && st.evasion > 0 && rng() < deflectChance(st.evasion, 0, acc)) deflected = true;

  // 3. Block: active (directional, guaranteed) or passive (chance).
  if (BLOCKABLE.includes(h.form)) {
    const ab = s.activeBlock;
    if (ab && ab.until > now) {
      const ang = Math.atan2(h.y - t.y, h.x - t.x);
      let da = ang - ab.angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= (100 * Math.PI) / 180 / 2 + Math.PI / 4) {
        // Blocking fills the blocker's heavy stun meter (PoE2 risky-state rule).
        const procs = addBuildup(s.ail, {
          dmg: { phys: sumDamage(h.dmg) * 0.5 }, ailThreshold: 0, stunThreshold: stunThreshold(t), rarity: "player",
          byPlayer: !!h.by, melee: h.form === "melee", mult: 1, ail: { stun: 1, freeze: 0, shock: 0, ignite: 0, chill: 0 },
        });
        defEvent(host, t.x, t.y, t.id, "block");
        const r = result("blocked");
        r.procs = procs;
        announceProcs(host, t, true, procs, h.by);
        return finish(host, t, h, r);
      }
    }
    if (!h.unblockable && st.blockChance > 0 && rng() < blockFraction(st.blockChance)) {
      defEvent(host, t.x, t.y, t.id, "block");
      return finish(host, t, h, result("blocked"));
    }
  }

  // 4. Mitigation by type.
  const pvp = h.by ? PVP_DAMAGE_MULT * finalDuel.mult : 1;
  const defl = deflected ? 1 - DEF.deflectLess : 1;
  const mult = (h.more ?? 1) * shockMult(s.ail) * outMultOf(h, t, true) * rollCrit(h, true);
  let taken = 1;
  for (const hk of defenceHooks) if (hk.takenMult) taken *= Math.max(0, hk.takenMult(t, h));
  const out: DamageMap = {};
  let resisted = 0;
  for (const [k, raw0] of Object.entries(h.dmg) as [DamageType, number][]) {
    if (!(raw0 > 0)) continue;
    const raw = raw0 * defl;
    let v = raw;
    if (k === "phys") v *= 1 - armourReduction(st.armour, raw); // armour sees the raw (pre-PvP) hit
    else {
      const res = resOf(t, k);
      v *= 1 - res / 100;
      resisted += (raw - v) * pvp;
    }
    out[k] = Math.max(0, v * pvp * mult * taken);
  }
  const chaos = out.chaos ?? 0;
  const nonChaos = sumDamage(out) - chaos;

  // 5. Energy shield, then life.
  s.lastHit = now;
  if (h.by && h.by !== t) {
    s.lastPvp = now;
    const bs = pst.get(h.by.id);
    if (bs) bs.lastPvp = now;
  }
  const ab = absorbEs(s.es, nonChaos, chaos);
  s.es = ab.es;
  let toLife = ab.toLife;
  for (const hk of defenceHooks) if (hk.beforeLife) toLife = Math.max(0, hk.beforeLife(t, toLife, h));
  const hpBefore = t.hp;
  t.hp = Math.max(0, t.hp - toLife);
  let kbm = 1;
  for (const hk of defenceHooks) if (hk.kbMult) kbm *= Math.max(0, hk.kbMult(t, h));
  applyKnockback(t, h.x, h.y, (h.kb ?? 0) * kbm);
  if (h.by) s.lastBy = h.by;
  s.lastSource = h.source;

  const r: HitResult = { outcome: deflected ? "deflected" : "hit", dealt: ab.toEs + toLife, toEs: ab.toEs, toLife, killed: false, procs: [] };
  host.events.push({
    k: "hit", x: Math.round(t.x), y: Math.round(t.y), target: t.id, by: h.by?.id ?? -1, dmg: Math.round(r.dealt * 10) / 10,
    ...(h.by ? {} : { sn: h.source }), // royale HUD: death recap source name
    ty: dominantType(out), ...(ab.toEs > 0 ? { es: Math.round(ab.toEs * 10) / 10 } : {}),
    ...(resisted >= 0.5 ? { rs: Math.round(resisted) } : {}), ...(deflected ? { o: "deflect" as const } : {}),
    ...goreFx(h, t, dominantType(out), ab.toEs, toLife, st.maxHp, act(s.ail, "bleed")),
  });

  if (t.hp <= 0) {
    r.killed = true;
    host.onPlayerKilled(t, h.by, h.source);
    tagDeath(host, "kill", t.id, { ...goreFx(h, t, dominantType(out), ab.toEs, toLife, st.maxHp, act(s.ail, "bleed")), ok: r1(Math.max(0, toLife - hpBefore)) });
    return finish(host, t, h, r);
  }
  // 6. Ailments, from the damage actually taken.
  r.procs = addBuildup(s.ail, {
    dmg: out, ailThreshold: ailThreshold(t), stunThreshold: stunThreshold(t), rarity: "player",
    byPlayer: !!h.by, melee: h.form === "melee", mult: defl, ail: h.ail,
  });
  applyForced(s, h, r.dealt, r.procs);
  announceProcs(host, t, true, r.procs, h.by);
  syncMove(t, s);
  return finish(host, t, h, r);
}

function finish(_host: DamageHost, t: ServerPlayer, h: HitSpec, r: HitResult): HitResult {
  for (const hk of defenceHooks) hk.afterHit?.(t, h, r);
  return r;
}

const ailThreshold = (p: ServerPlayer) => p.stats.maxHp * AILMENT_THRESHOLD_FRAC * Math.max(0.1, 1 + p.stats.ailmentThreshold / 100);
const stunThreshold = (p: ServerPlayer) => p.stats.maxHp * Math.max(0.1, 1 + p.stats.stunThreshold / 100);

function announceProcs(host: DamageHost, t: ServerPlayer | Monster, isPlayer: boolean, procs: AilmentKind[], by: ServerPlayer | null) {
  for (const a of procs) {
    host.events.push({ k: "ail", target: t.id, a, x: Math.round(t.x), y: Math.round(t.y), ...(isPlayer ? {} : { m: 1 as const }) });
    for (const hk of defenceHooks) hk.onAilment?.(t, a, isPlayer, by);
  }
}

function syncMove(p: ServerPlayer, s: DefState) {
  const c = s.ail.active.chill;
  const mm = c && c.t > 0 ? 1 - c.mag : 1;
  if (Math.abs(mm - s.moveSent) > 1e-6) {
    s.moveSent = mm;
    refresh(p);
  }
}

type MonsterDamageFn = (m: Monster, dmg: number, fx: number, fy: number, kb: number, by: ServerPlayer, meta?: { element?: DamageType; types?: DamageMap }) => boolean;

/**
 * Resolve one hit on a monster. Monster defences (armour, resistances, bubbles) are applied by
 * MonsterSystem.damage(); this adds shock, the hit event, kill handling and ailment buildup.
 */
export function hitMonster(host: DamageHost, m: Monster, h: HitSpec): HitResult {
  if (!m.alive || !h.by) return result("immune");
  if (laneHook.incoming && laneHook.incoming(m, 1, h.by) <= 0) return result("immune"); // Breachway: own units, locked structures
  const s = ms(m);
  const shock = shockMult(s.ail) * (h.more ?? 1) * outMultOf(h, m, false) * rollCrit(h, false);
  const scaled: DamageMap = {};
  for (const [k, v] of Object.entries(h.dmg) as [DamageType, number][]) if (v > 0) scaled[k] = v * shock;
  const total = sumDamage(scaled);
  const ty = dominantType(scaled);
  const r: HitResult = { outcome: "hit", dealt: 0, toEs: 0, toLife: 0, killed: false, procs: [] };
  const before = m.hp;
  const hitEv: GameEvent = { k: "hit", x: Math.round(m.x), y: Math.round(m.y), target: m.id, by: h.by.id, dmg: Math.round(total * 10) / 10, m: 1, ty };
  host.events.push(hitEv);
  s.lastBy = h.by;
  const died = (host.monsters.damage as MonsterDamageFn).call(host.monsters, m, total, h.x, h.y, h.kb ?? 0, h.by, { element: ty, types: scaled });
  r.dealt = r.toLife = Math.max(0, before - Math.max(0, m.hp));
  const gfx = goreFx(h, m, ty, 0, r.toLife, m.maxHp, act(s.ail, "bleed"));
  Object.assign(hitEv, gfx); // life actually lost is known only after MonsterSystem.damage
  if (died) r.killed = true;
  for (const hk of defenceHooks) hk.afterMonsterHit?.(h.by, m, r.dealt, h, r);
  if (died) {
    r.killed = true;
    host.events.push({ k: "mdie", id: m.id, mk: m.type.id, x: Math.round(m.x), y: Math.round(m.y), r: m.radius, a: Math.round(m.angle * 100) / 100, ...(m.elite ? { el: 1 as const } : {}), ...gfx, ok: r1(Math.max(0, total - before)) });
    host.onMonsterKilled(m, h.by);
    mst.delete(m.id);
    return r;
  }
  // Monster ailment threshold = its max life (stun threshold too).
  const frac = total > 0 ? Math.min(1, r.dealt / total) : 0; // buildup from damage actually dealt
  const taken: DamageMap = {};
  for (const [k, v] of Object.entries(scaled) as [DamageType, number][]) taken[k] = v * frac;
  r.procs = addBuildup(s.ail, {
    dmg: taken, ailThreshold: m.maxHp, stunThreshold: m.maxHp, rarity: monsterRarity(m),
    byPlayer: true, melee: h.form === "melee", mult: 1, ail: h.ail,
  });
  applyForced(s, h, total, r.procs);
  if (r.procs.some((k) => k === "stun" || k === "freeze" || k === "electrocute") && m.state === 2) m.state = 1; // CC interrupts the wind-up
  announceProcs(host, m, false, r.procs, h.by);
  return r;
}

// ---- per tick -------------------------------------------------------------------------------

const DOT_REPORT = 0.5; // s between damage-over-time numbers

/** ES recharge, ailment timers, meter decay and damage over time. Call once per server tick. */
export function damageTick(host: DamageHost, players: Iterable<ServerPlayer>) {
  now += DT;
  for (const p of players) {
    const s = ps(p);
    if (!p.alive) {
      s.wasAlive = false;
      continue;
    }
    if (!s.wasAlive) {
      resetDefence(p);
      syncMove(p, pst.get(p.id)!);
      continue;
    }
    // Energy shield recharge (any damage, DoT included, resets the delay).
    const max = p.stats.energyShield;
    if (s.es > max) s.es = max;
    if (max > 0 && s.es < max && now - s.lastHit >= esDelay(p.stats.esFasterStart)) s.es = Math.min(max, s.es + max * DEF.esRecharge * DT);
    if (s.activeBlock && s.activeBlock.until <= now) s.activeBlock = null;
    // Flask trickle: out of uses and not being hit, a flask slowly refills to one use (shared/constants.ts).
    if (now - s.lastHit >= FLASK_TRICKLE_DELAY) {
      for (const f of p.flasks) {
        const c = f?.c ?? 0;
        if (!f || c >= FLASK_CHARGES_PER_USE) continue;
        const use = flaskProps(f, 1).perUse;
        if (c >= use) continue;
        f.c = Math.min(use, c + FLASK_TRICKLE_PER_SEC * DT);
        if (Math.floor(f.c) !== Math.floor(c)) p.invDirty = true;
      }
    }

    const dot = tickAilments(s.ail, DT, true);
    let toLife = dot.bypass;
    if (dot.normal > 0) {
      const ab = absorbEs(s.es, dot.normal, 0);
      s.es = ab.es;
      toLife += ab.toLife;
      s.dotAcc += ab.toEs;
    }
    if (dot.normal + dot.bypass > 0) {
      s.lastHit = now;
      dotHurt(host, p, s, toLife); // DoT magnitude already derives from post-PvP, post-mitigation damage
    }
    if (p.alive) statusFx(host, s, p.x, p.y);
    syncMove(p, s);
  }
  for (const [id, s] of mst) {
    const m = host.monsters.monsters.get(id);
    if (!m || !m.alive) {
      mst.delete(id);
      continue;
    }
    const dot = tickAilments(s.ail, DT, false);
    statusFx(host, s, m.x, m.y);
    const d = dot.normal + dot.bypass;
    if (d > 0 && s.lastBy) {
      s.dotAcc += d;
      s.dotT += DT;
      const by = s.lastBy;
      const hpB = m.hp;
      if ((host.monsters.damage as MonsterDamageFn).call(host.monsters, m, d, m.x, m.y, 0, by, { types: { fire: dot.normal, phys: dot.bypass } })) {
        host.events.push({ k: "mdie", id: m.id, mk: m.type.id, x: Math.round(m.x), y: Math.round(m.y), r: m.radius, a: Math.round(m.angle * 100) / 100, ...(m.elite ? { el: 1 as const } : {}), ...goreFx(null, m, dot.normal >= dot.bypass ? "fire" : "phys", 0, d, m.maxHp, act(s.ail, "bleed"), "dot"), ok: r1(Math.max(0, d - hpB)) });
        host.onMonsterKilled(m, by);
        mst.delete(id);
        continue;
      }
      if (s.dotT >= DOT_REPORT) {
        host.events.push({ k: "hit", x: Math.round(m.x), y: Math.round(m.y), target: m.id, by: by.id, dmg: Math.round(s.dotAcc * 10) / 10, m: 1, dot: 1, ...goreFx(null, m, dot.normal >= dot.bypass ? "fire" : "phys", 0, s.dotAcc, m.maxHp, act(s.ail, "bleed"), "dot") });
        s.dotAcc = 0;
        s.dotT = 0;
      }
    }
  }
}

function dotHurt(host: DamageHost, p: ServerPlayer, s: DefState, toLife: number) {
  p.hp = Math.max(0, p.hp - toLife);
  s.dotAcc += toLife;
  s.dotT += DT;
  if (p.hp <= 0) {
    const gfx = goreFx(null, p, act(s.ail, "ignite") ? "fire" : act(s.ail, "poison") ? "chaos" : "phys", 0, s.dotAcc, p.stats.maxHp, act(s.ail, "bleed"), "dot");
    host.events.push({ k: "hit", x: Math.round(p.x), y: Math.round(p.y), target: p.id, by: s.lastBy?.id ?? -1, dmg: Math.round(s.dotAcc * 10) / 10, dot: 1, ...gfx });
    host.onPlayerKilled(p, s.lastBy, s.lastSource || "a lingering wound");
    tagDeath(host, "kill", p.id, gfx);
    return;
  }
  if (s.dotT >= DOT_REPORT) {
    host.events.push({ k: "hit", x: Math.round(p.x), y: Math.round(p.y), target: p.id, by: s.lastBy?.id ?? -1, dmg: Math.round(s.dotAcc * 10) / 10, dot: 1 });
    s.dotAcc = 0;
    s.dotT = 0;
  }
}

// ---- legacy adapter -------------------------------------------------------------------------

/** Metadata the monsters agent passes as host.damagePlayer's 6th argument. */
export interface DamageMeta {
  area?: boolean;
  unblockable?: boolean;
  element?: DamageType | "physical" | "lightning";
  /**
   * Optional form override. Monster content also passes "attack" (melee hit, or proj when it came
   * from range) and "reflect" (thorns: never evaded / blocked); legacySpec normalises both.
   */
  form?: HitForm | "attack" | "reflect";
  /** Monster attacker (crit, Thornwake retaliation target, Bonebreaker stun). */
  mon?: Monster;
  /** Monster-sourced hit (shrine Ironbark / Thornwake). */
  monster?: boolean;
  /** Guaranteed ignite / chill (exile gem supports). */
  force?: HitSpec["force"];
}

/** Map a monster content form ("attack" / "reflect") onto a pipeline HitForm. */
function normForm(f: DamageMeta["form"], far: boolean): HitForm | undefined {
  if (f === "attack") return far ? "proj" : "melee";
  if (f === "reflect") return "dot";
  return f;
}

/** Monster damage types by type id (until monster content carries its own). */
const MONSTER_TYPES_DMG: Record<string, DamageMap> = {
  bog_seer: { cold: 0.5, chaos: 0.5 },
};

/**
 * Build a HitSpec from the old flat-damage call (combat.damagePlayer). `dmg` from a player attacker
 * already includes PVP_DAMAGE_MULT, so it is divided back out (armour sees the raw hit).
 */
export function legacySpec(dmg: number, fromX: number, fromY: number, kb: number, attacker: ServerPlayer | null, source: string, meta?: DamageMeta, targetX?: number, targetY?: number): HitSpec {
  const raw = attacker ? dmg / PVP_DAMAGE_MULT : dmg;
  let el: DamageType = "phys";
  const me = meta?.element;
  if (me === "lightning") el = "light";
  else if (me && me !== "physical") el = me as DamageType;
  else if (!me && source.endsWith("blast")) el = "fire";
  let dmap: DamageMap = { [el]: raw };
  if (!meta?.element && !attacker) {
    const split = Object.entries(MONSTER_TYPES_DMG).find(([id]) => source.toLowerCase().replace(/ /g, "_").includes(id));
    if (split) dmap = Object.fromEntries(Object.entries(split[1]).map(([k, v]) => [k, (v as number) * raw]));
  }
  const far = targetX !== undefined && targetY !== undefined && Math.hypot(targetX - fromX, targetY - fromY) > 120;
  const given = normForm(meta?.form, far);
  let form: HitForm = given ?? "melee";
  if (!given) {
    if (source.endsWith("thorns")) form = "dot"; // reflected damage: cannot be evaded or blocked
    else if (meta?.area || source.endsWith("blast")) form = "area";
    else if (far) form = "proj";
    else if (attacker && el !== "phys") form = "spell";
  }
  const h: HitSpec = { dmg: dmap, by: attacker, source, form, x: fromX, y: fromY, kb, unblockable: meta?.unblockable || form === "area" };
  const mon = attacker ? undefined : meta?.mon;
  if (mon) {
    h.mon = mon;
    // Bonebreaker (stunMult): more heavy-stun buildup from this monster's hits.
    let stun = 1;
    for (const md of modsOf(mon)) stun *= md.stunMult ?? 1;
    if (stun !== 1) h.ail = { stun };
  }
  if (meta?.force) h.force = meta.force;
  return h;
}

// ---- dev (HNS_DEV=1) ------------------------------------------------------------------------

const DEV_TYPE: Record<AilmentKind, DamageType> = {
  stun: "phys", freeze: "cold", chill: "cold", shock: "light", ignite: "fire", bleed: "phys", poison: "chaos", electrocute: "light",
};

/**
 * Dev commands: {cmd:"ail", a:"freeze"} triggers an ailment on you and monsters within 500 px;
 * {cmd:"meters"} half-fills every buildup meter there; {cmd:"es", v:80} sets your energy shield
 * (until the next stat refresh). Returns true if handled.
 */
export function damageDevCommand(host: DamageHost, p: ServerPlayer, msg: Record<string, unknown>): boolean {
  const near = [...host.monsters.monsters.values()].filter((m) => m.alive && Math.hypot(m.x - p.x, m.y - p.y) < 500);
  switch (msg.cmd) {
    case "ail": {
      const a = String(msg.a ?? "freeze") as AilmentKind;
      if (!(a in DEV_TYPE)) return true;
      const ctx = (thr: number, rarity: TargetRarity) => ({
        dmg: { [DEV_TYPE[a]]: thr * 3 }, ailThreshold: thr, stunThreshold: thr, rarity, byPlayer: true, melee: true, mult: 1,
        ail: { stun: 0, freeze: 0, chill: 0, shock: 0, ignite: 0, bleed: 0, poison: 0, electrocute: 0, [a]: 1e6 }, // huge build rate: a tiny dev hit always triggers (keeps DoT peaks small)
      });
      if (msg.self !== false) {
        const s = ps(p);
        s.ail.ccImmune = 0;
        const procs = addBuildup(s.ail, { ...ctx(ailThreshold(p), "player"), dmg: { [DEV_TYPE[a]]: 1 } });
        announceProcs(host, p, true, procs, null);
        syncMove(p, s);
      }
      for (const m of near) {
        const s = ms(m);
        s.lastBy = p;
        announceProcs(host, m, false, addBuildup(s.ail, { ...ctx(m.maxHp, monsterRarity(m)), dmg: { [DEV_TYPE[a]]: m.maxHp * 0.05 } }), p);
      }
      return true;
    }
    case "meters": {
      const fill = (st: AilState) => {
        st.meter = { stun: 0.65, freeze: 0.5, shock: 0.35, ignite: 0.8, electrocute: 0.45 };
        st.idle = {};
      };
      fill(ps(p).ail);
      for (const m of near) fill(ms(m).ail);
      return true;
    }
    case "def": {
      // {cmd:"def", eva?, block?, armour?}: set defences until the next stat refresh (screenshots / feel tests).
      const n = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
      const eva = n(msg.eva, 0, 20000);
      const blk = n(msg.block, 0, 75);
      const arm = n(msg.armour, 0, 20000);
      if (eva !== undefined) p.stats.evasion = eva;
      if (blk !== undefined) p.stats.blockChance = blk;
      if (arm !== undefined) p.stats.armour = arm;
      return true;
    }
    case "es": {
      const v = typeof msg.v === "number" && Number.isFinite(msg.v) ? Math.max(0, Math.min(2000, msg.v)) : 80;
      p.stats.energyShield = v;
      ps(p).es = v * (typeof msg.f === "number" ? Math.max(0, Math.min(1, msg.f)) : 1);
      return true;
    }
  }
  return false;
}

// ---- HUD core (server/hudsnap.ts): seconds left per active ailment + CC immunity on a player ----
const HUD_AIL_SHORT: Partial<Record<AilmentKind, "s" | "f" | "k" | "g" | "b" | "p" | "e">> = { stun: "s", freeze: "f", shock: "k", ignite: "g", bleed: "b", poison: "p", electrocute: "e" };
export function playerAilTimes(p: ServerPlayer): { am?: Partial<Record<"s" | "f" | "k" | "g" | "b" | "p" | "e", number>>; ci?: number } {
  const st = pst.get(p.id)?.ail;
  if (!st) return {};
  const am: Partial<Record<"s" | "f" | "k" | "g" | "b" | "p" | "e", number>> = {};
  for (const [k, a] of Object.entries(st.active)) {
    const sh = HUD_AIL_SHORT[k as AilmentKind];
    if (sh && a && a.t > 0) am[sh] = a.t;
  }
  return { am, ci: st.ccImmune > 0 ? st.ccImmune : undefined };
}
