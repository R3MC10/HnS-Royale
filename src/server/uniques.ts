// Special effects (FxKeys) from uniques, runes, blighted implicits and charm buffs, applied in combat.
// Hook points (called from combat / game / inventory; keep them cheap):
//   lootOutMult      attacker-side damage multiplier (before PvP scaling)
//   lootTakenMult    defender-side damage multiplier
//   lootKbMult       0 when the target can't be knocked back
//   lootAfterHit     leech, chill-on-hit and thorns after a hit landed
//   lootOnHitTaken   charm triggers (heavy blow / player hit)
//   lootOnKill       kill heal / haste, charm charges, Gilded Tooth
//   lootTick         timers, charm low-life / slowed triggers, mana-flask recovery
//   applyLootStatus  move-speed buffs / chill / slow immunity on top of stats (from refreshStats)
import { progJewelFx, progJewelSig } from "./progression";
import { DT } from "../shared/constants";
import {
  CHILL_ON_HIT_TIME,
  DODGE_BUFF_TIME,
  KILL_HASTE_TIME,
  LOW_LIFE,
  MAX_DMG_TAKEN_RED,
  MAX_LEECH,
  type FxKey,
} from "../shared/content/fx";
import { computeFx, emptyFx, type FxTotals } from "../shared/fx";
import type { Stats } from "../shared/stats";
import type { AilmentKind } from "../shared/ailments";
import { flaskProps, type FlaskProps, type Item } from "../shared/items";
import { FLASK_BASE_BY_ID } from "../shared/content/flasks";
import { UNIQUE_BY_ID } from "../shared/content/uniques";
import { cleansePlayerAilments, pvpFlaskMult, restoreEs } from "./damage";
import type { ServerPlayer } from "./player";

export interface TimedBuff {
  key: FxKey;
  v: number;
  t: number;
  src: string;
}

export interface LootFx {
  dodgeT: number; // dodge-roll damage window left
  hasteT: number; // kill haste left
  chillT: number;
  chillAmt: number; // 0..1 slow fraction
  buffs: TimedBuff[]; // charm buffs
  prevRollT: number;
  manaHeal: { perSec: number; t: number }[];
  /** Cached equipment fx; recomputed when the equipment object identity or contents change. */
  fx: FxTotals;
  fxKey: string;
  statusKey: string; // last applied speed-status signature (to know when to refresh stats)
}

const STATE = new WeakMap<ServerPlayer, LootFx>();

export function lootFx(p: ServerPlayer): LootFx {
  let s = STATE.get(p);
  if (!s) {
    s = { dodgeT: 0, hasteT: 0, chillT: 0, chillAmt: 0, buffs: [], prevRollT: 0, manaHeal: [], fx: emptyFx(), fxKey: "", statusKey: "" };
    STATE.set(p, s);
  }
  return s;
}

/** Clear timed state (death / new match). */
export function resetLootFx(p: ServerPlayer) {
  STATE.delete(p);
}

function equipSig(p: ServerPlayer): string {
  let k = "";
  for (const it of Object.values(p.equip)) k += it ? `${it.id}:${it.m.length}:${it.s?.join(",") ?? ""}:${it.x ?? 0}|` : "-|";
  return k;
}

/** Equipment fx + active charm buffs. */
export function fxOf(p: ServerPlayer): FxTotals {
  const s = lootFx(p);
  const sig = equipSig(p) + progJewelSig(p);
  if (sig !== s.fxKey) {
    s.fx = computeFx(p.equip);
    for (const [k, v] of Object.entries(progJewelFx(p))) s.fx[k as FxKey] += v as number; // passive-tree jewels
    s.fxKey = sig;
  }
  if (!s.buffs.length) return s.fx;
  const out = { ...s.fx };
  for (const b of s.buffs) out[b.key] += b.v;
  return out;
}

const more = (pct: number) => 1 + pct / 100;

// ---- damage ----------------------------------------------------------------------------------

export function lootOutMult(attacker: ServerPlayer, target: { hp: number; maxHp: number }, vsPlayer: boolean): number {
  const fx = fxOf(attacker);
  const s = lootFx(attacker);
  let m = 1;
  if (attacker.hp <= attacker.stats.maxHp * LOW_LIFE) m *= more(fx.lowLifeMore);
  const frac = target.maxHp > 0 ? target.hp / target.maxHp : 1;
  if (frac <= LOW_LIFE) m *= more(fx.executeMore);
  if (frac >= 0.999) m *= more(fx.fullLifeMore);
  if (s.dodgeT > 0) m *= more(fx.dodgeMore);
  m *= more(vsPlayer ? fx.pvpMore : fx.pveMore);
  return Math.max(0.1, m);
}

export function lootTakenMult(t: ServerPlayer): number {
  const fx = fxOf(t);
  const lowRed = t.hp <= t.stats.maxHp * LOW_LIFE ? fx.lowLifeTakenRed : 0;
  const red = Math.min(MAX_DMG_TAKEN_RED, fx.dmgTakenRed + lowRed);
  return Math.max(0.1, (1 - red / 100) * more(fx.takenMore));
}

export function lootKbMult(t: ServerPlayer): number {
  return fxOf(t).kbImmune > 0 ? 0 : 1;
}

/** Host surface needed for thorns (reflected damage goes through the normal player-damage path). */
export interface LootHost {
  damagePlayerRaw(t: ServerPlayer, dmg: number, by: ServerPlayer, source: string): void;
  toast(p: ServerPlayer, text: string): void;
}

/**
 * After `attacker` dealt `dealt` damage. `target` is the player hit (null for a monster).
 * `melee`: a weapon swing (thorns only answer melee).
 */
export function lootAfterHit(host: LootHost, attacker: ServerPlayer, dealt: number, target: ServerPlayer | null, melee: boolean) {
  if (dealt <= 0 || !attacker.alive) return;
  const fx = fxOf(attacker);
  const leech = Math.min(MAX_LEECH, fx.leech);
  if (leech > 0) attacker.hp = Math.min(attacker.stats.maxHp, attacker.hp + (dealt * leech) / 100);
  if (!target) return;
  if (fx.chillOnHit > 0 && target.alive) {
    const ts = lootFx(target);
    if (fxOf(target).slowImmune <= 0) {
      ts.chillT = CHILL_ON_HIT_TIME;
      ts.chillAmt = Math.max(ts.chillAmt, Math.min(0.6, fx.chillOnHit / 100));
    }
  }
  if (melee) {
    const thorns = fxOf(target).thorns;
    if (thorns > 0 && target.alive) host.damagePlayerRaw(attacker, thorns, target, `${target.name}'s thorns`);
  }
}

// ---- kills / tick ----------------------------------------------------------------------------

export function lootKillEffects(killer: ServerPlayer) {
  if (!killer.alive) return;
  const fx = fxOf(killer);
  if (fx.killHeal > 0) killer.hp = Math.min(killer.stats.maxHp, killer.hp + (killer.stats.maxHp * fx.killHeal) / 100);
  if (fx.killHaste > 0) lootFx(killer).hasteT = KILL_HASTE_TIME;
  if (fx.esOnKill > 0) restoreEs(killer, fx.esOnKill / 100);
  if (fx.manaOnKill > 0) {
    const sk = (killer as { sk?: { mana: number } }).sk;
    if (sk) sk.mana = Math.min(killer.stats.maxMana, sk.mana + (killer.stats.maxMana * fx.manaOnKill) / 100);
  }
}

/** Ailments each immunity effect keeps off (cleansed every tick while active). */
const IMMUNITY: [keyof FxTotals, AilmentKind[]][] = [
  ["freezeImmune", ["freeze"]],
  ["igniteImmune", ["ignite"]],
  ["shockImmune", ["shock"]],
  ["bleedImmune", ["bleed", "poison"]],
  ["stunImmune", ["stun", "electrocute"]],
];

/**
 * Apply a flask's recovery (charges are already paid). PoE2 rules: full or partial instant recovery,
 * instant on low life, ailment cures, unique flask buffs; "of Life Flask recovery applied instantly"
 * from belts / uniques (fx.flaskInstant). Returns the seconds of over-time recovery (0 = all instant).
 */
export function lootDrinkFlask(p: ServerPlayer, f: Item, props: FlaskProps): number {
  const mana = FLASK_BASE_BY_ID.get(f.b)?.res === "mana";
  const fx = fxOf(p);
  const low = p.hp <= p.stats.maxHp * LOW_LIFE;
  const allInstant = props.instant || (props.lowInstant && low);
  const frac = allInstant ? 1 : Math.min(1, Math.max(props.partInstant, mana ? 0 : fx.flaskInstant / 100));
  const amount = props.heal * (mana ? 1 : pvpFlaskMult(p)); // life flasks heal less in a player fight
  const now = amount * frac;
  const rest = amount - now;
  const dur = Math.max(0.1, props.duration);
  if (mana) {
    if (now > 0) lootManaFlask(p, now, 0, true);
    if (rest > 0) lootManaFlask(p, rest, dur, false);
  } else {
    if (now > 0) p.hp = Math.min(p.stats.maxHp, p.hp + now);
    if (rest > 0) p.heals.push({ perSec: rest / dur, t: dur });
  }
  const cures: AilmentKind[] = [];
  if (props.cureBleed) cures.push("bleed", "poison");
  if (props.cureElem) cures.push("ignite", "chill", "freeze", "shock");
  if (props.cureStun) cures.push("stun", "electrocute");
  if (cures.length) cleansePlayerAilments(p, cures);
  lootFlaskUsed(p, f, rest > 0 ? dur : 0);
  return rest > 0 ? dur : 0;
}

/** A flask was drunk: unique flask buffs for its recovery time (content/uniques.ts flaskBuff). */
export function lootFlaskUsed(p: ServerPlayer, f: Item, duration: number) {
  const u = f.u ? UNIQUE_BY_ID.get(f.u) : undefined;
  if (!u?.flaskBuff) return;
  for (const [k, v] of u.flaskBuff.fx) addBuff(p, k, v, Math.max(u.flaskBuff.dur, duration), `flask${f.id}`);
}

export function addBuff(p: ServerPlayer, key: FxKey, v: number, t: number, src: string) {
  const s = lootFx(p);
  const old = s.buffs.find((b) => b.src === src && b.key === key);
  if (old) old.t = Math.max(old.t, t);
  else s.buffs.push({ key, v, t, src });
}

/** Signature of everything that changes move speed; refresh stats when it changes. */
function statusSig(p: ServerPlayer): string {
  const s = lootFx(p);
  const fx = fxOf(p);
  return `${s.hasteT > 0 ? fx.killHaste : 0}|${s.chillT > 0 ? s.chillAmt : 0}|${fx.slowImmune > 0 ? 1 : 0}|${fx.hasteBuff}|${fx.resFireBuff}|${fx.resColdBuff}|${fx.resLightBuff}|${fx.resChaosBuff}|${fx.armourBuff}|${fx.speedBuff}`;
}

/** Per-tick timers. Returns true if this player's stats need a refresh (speed status changed). */
export function lootStepPlayer(p: ServerPlayer): boolean {
  const s = lootFx(p);
  if (!p.alive) {
    if (s.buffs.length || s.chillT || s.hasteT) {
      resetLootFx(p);
      return true;
    }
    return false;
  }
  // Dodge-roll window: a roll just started.
  if (p.rollT > s.prevRollT + 1e-6) s.dodgeT = DODGE_BUFF_TIME;
  s.prevRollT = p.rollT;
  s.dodgeT = Math.max(0, s.dodgeT - DT);
  s.hasteT = Math.max(0, s.hasteT - DT);
  s.chillT = Math.max(0, s.chillT - DT);
  if (s.chillT <= 0) s.chillAmt = 0;
  for (const b of s.buffs) b.t -= DT;
  s.buffs = s.buffs.filter((b) => b.t > 0);
  // Charm regen buff.
  const fx = fxOf(p);
  if (fx.regenBuff > 0) p.hp = Math.min(p.stats.maxHp, p.hp + fx.regenBuff * DT);
  // Ailment immunities (charm buffs, unique lines): keep the ailment and its buildup off.
  for (const [k, kinds] of IMMUNITY) if (fx[k] > 0) cleansePlayerAilments(p, kinds);
  // Flask charge regeneration (PoE2 belt / unique mod); resend the inventory per whole charge.
  if (fx.flaskChargeRegen > 0) {
    for (const f of p.flasks) {
      if (!f) continue;
      const before = f.c ?? 0;
      f.c = Math.min(flaskProps(f, 1).maxCharges, before + fx.flaskChargeRegen * DT);
      if (Math.floor(f.c) !== Math.floor(before)) p.invDirty = true;
    }
  }
  // Mana flask recovery (mana lives in the skills state).
  if (s.manaHeal.length) {
    const sk = (p as { sk?: { mana: number } }).sk;
    let gain = 0;
    for (const h of s.manaHeal) {
      gain += h.perSec * Math.min(DT, h.t);
      h.t -= DT;
    }
    s.manaHeal = s.manaHeal.filter((h) => h.t > 0);
    if (sk) sk.mana = Math.min(p.stats.maxMana, sk.mana + gain);
  }
  const sig = statusSig(p);
  if (sig !== s.statusKey) {
    s.statusKey = sig;
    return true;
  }
  return false;
}

/** Queue mana recovery from a mana flask. */
export function lootManaFlask(p: ServerPlayer, amount: number, duration: number, instant: boolean) {
  const sk = (p as { sk?: { mana: number } }).sk;
  if (instant || duration <= 0) {
    if (sk) sk.mana = Math.min(p.stats.maxMana, sk.mana + amount);
    return;
  }
  lootFx(p).manaHeal.push({ perSec: amount / duration, t: duration });
}

/** Move-speed effects on top of gear stats (call from refreshStats before clamping, after other slows). */
export function applyLootStatus(p: ServerPlayer, s: Stats) {
  const st = lootFx(p);
  const fx = fxOf(p);
  if (fx.slowImmune > 0) s.moveSpeed = Math.max(s.moveSpeed, p.gearStats.moveSpeed);
  else if (st.chillT > 0) s.moveSpeed *= 1 - st.chillAmt;
  let inc = fx.hasteBuff;
  if (st.hasteT > 0) inc += fx.killHaste;
  if (inc) s.moveSpeed *= 1 + inc / 100;
  // Charm wards and buffs (PoE2 elemental charms: +% resistance for a few seconds).
  s.resFire += fx.resFireBuff;
  s.resCold += fx.resColdBuff;
  s.resLight += fx.resLightBuff;
  s.resChaos += fx.resChaosBuff;
  if (fx.armourBuff) s.armour *= 1 + fx.armourBuff / 100;
  if (fx.speedBuff) {
    s.attackCooldown /= 1 + fx.speedBuff / 100;
    s.swingTime /= 1 + fx.speedBuff / 100;
  }
}

/** Is this player currently slowed (for the Thawstone charm trigger)? */
export function isSlowed(p: ServerPlayer): boolean {
  const sk = (p as { sk?: { chill?: number } }).sk;
  return p.slowMult < 0.999 || lootFx(p).chillT > 0 || (sk?.chill ?? 0) > 0;
}
