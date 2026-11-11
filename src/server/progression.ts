// Per-match progression (server-authoritative): XP and levels, the passive tree, defences
// (armour / evasion / barrier / resistance), keystone and ascendancy effects, and trial shrines.
// State lives here, keyed by player id, so the shared player record stays untouched.
import { DT, MAP_H, MAP_W, PLAYER_RADIUS, PVP_DAMAGE_MULT } from "../shared/constants";
import { ASC_BY_ID, ASC_NODE_BY_ID } from "../shared/content/ascendancies";
import {
  ASC_POINT_STEPS,
  ASC_POINTS_ON_PICK,
  ASCEND_LEVEL,
  CLASS_BY_ID,
  DEFAULT_CLASS,
  DEFENCE,
  MAX_LEVEL,
  MONSTER_XP,
  PLAYER_KILL_XP_BASE,
  PLAYER_KILL_XP_PER_LEVEL,
  POINTS_PER_LEVEL,
  TRIAL_HONOUR,
  XP_TIER_MULT,
  xpToNext,
  type MonsterTier,
} from "../shared/content/classes";
import { BASE_BY_ID, meetsRequirements } from "../shared/content/bases";
import { isFxKey, type FxKey } from "../shared/content/fx";
import { JEWEL_BASE_BY_ID, JEWEL_MAX_PER_KIND, isJewel, jewelModTotals, jewelRadiusCounts } from "../shared/content/jewels";
import type { ModKey } from "../shared/content/types";
import { itemModTotals, type Item } from "../shared/items";
import { autoPlace } from "./inventory";
import { MONSTER_BY_ID, MONSTER_TYPES } from "../shared/content/monsters";
import { MONSTER_XP_PER_LEVEL } from "../shared/content/monsters/mods";
import { JEWEL_SOCKETS, PASSIVE_BY_ID, type PassiveMods } from "../shared/content/passives";
import { getPois, onMapChange, walkableNear } from "../shared/map";
import { HINT_PREFIX, type GameEvent, type Phase } from "../shared/protocol";
import {
  applyProgression,
  armourReduction,
  computeDefences,
  type Defences,
  type ProgConditions,
  type ProgMsg,
  type ShrineSnap,
  type ShrinesMsg,
  totalMods,
} from "../shared/progression";
import type { Stats } from "../shared/stats";
import type { Camp, Monster, MonsterSystem } from "./monsters";
import type { ServerPlayer } from "./player";

// ---- tunables (trial shrines) --------------------------------------------------------
export const SHRINE_RANGE = 110; // px to activate
const TRIAL_TIME_LIMIT = 120; // s before an unfinished trial fails
const SHRINE_COOLDOWN = 20; // s after a trial (success or failure)
const TRIAL_ASSIST_RANGE = 450; // other eligible players this close also clear the trial
const GUARDIAN = { type: "cragback", hpMult: 3.2, dmgMult: 1.15, name: "Shrine Warden" };
const TRIAL_ADDS = ["gnashling", "gnashling", "bog_seer", "gnashling", "gnashling"];
/** Honour drained per 1% of (max life + max barrier) lost to hits during your trial. */
const HONOUR_DRAIN = 1.5;

const KILL_RUSH_TIME = 4;
const POST_ROLL_TIME = 2;
const EVADE_HASTE_TIME = 1.5;
const CALM_TIME = 3;
const CHEAT_DEATH_INVULN = 1.5;
const LOW_LIFE = 0.4;
const NOVA_RADIUS = 160;
const SPLASH_RADIUS = 90;
const ROLL_STRIKE_RADIUS = 110;
const SECOND_WIND_AT = 0.3;
const SECOND_WIND_CD = 20;

/** Host interface (implemented by Game) so this module never imports game.ts. */
export interface ProgHost {
  players: Map<number, ServerPlayer>;
  monsters: MonsterSystem;
  events: GameEvent[];
  phase: Phase;
  toast(p: ServerPlayer, text: string): void;
  addCharges(p: ServerPlayer, amount: number): void;
  onMonsterKilled(m: Monster, killer: ServerPlayer): void;
}

interface Prog {
  cls: string;
  level: number;
  xp: number;
  alloc: Set<string>;
  asc: string | null;
  ascAlloc: Set<string>;
  ascState: 0 | 1 | 2 | 3;
  mods: PassiveMods;
  def: Defences;
  barrier: number;
  // combat state
  lastHitAt: number;
  postRollUntil: number;
  killRushUntil: number;
  evadeHasteUntil: number;
  invulnUntil: number;
  cheatReadyAt: number;
  stillFor: number;
  prevRollT: number;
  prevX: number;
  prevY: number;
  wasAlive: boolean;
  trophies: number;
  secondWindAt: number;
  prevHp: number;
  honour: number; // trial honour (only meaningful while a trial is running)
  entropy: number;
  condKey: string;
  cond: ProgConditions;
  dirty: boolean;
  sentBarrier: number;
  shrineVer: number;
  /** Jewels socketed in the passive tree: socket node id -> item. */
  jewels: Map<string, Item>;
}

interface Shrine {
  x: number;
  y: number;
  s: 0 | 1 | 2;
  cd: number;
  /** phase 1: clear the adds; phase 2: the guardian is up. */
  trial: { owner: number; bossId: number; ids: Set<number>; t: number; camp: Camp; phase: 1 | 2 } | null;
}

let host: ProgHost | null = null;
let refresh: (p: ServerPlayer) => void = () => {};
const progs = new Map<number, Prog>();
const bossIds = new Set<number>();
let shrines: Shrine[] = [];
let shrineVer = 1;
let now = 0;

/**
 * Pluggable links into the combat core (src/server/damage.ts, owned by combat-systems). Barrier and
 * energy shield are ONE pool there: once esOf / esMax / restoreEs are set, progression stops tracking
 * its own barrier. Passive damage (novas, splash, roll strikes, thorns) goes through hitMonster /
 * hitPlayer when set. Until then the fallbacks below keep everything working.
 */
export interface ProgAdapters {
  esOf?(p: ServerPlayer): number;
  esMax?(p: ServerPlayer): number;
  restoreEs?(p: ServerPlayer, frac: number): void;
  hitMonster?(m: Monster, dmg: number, by: ServerPlayer, source: string, x: number, y: number): void;
  hitPlayer?(t: ServerPlayer, dmg: number, by: ServerPlayer, source: string, x: number, y: number): void;
}
let ad: ProgAdapters = {};
export function setProgAdapters(a: ProgAdapters) {
  ad = { ...ad, ...a };
}
function barCur(p: ServerPlayer, pr: Prog): number {
  return ad.esOf ? ad.esOf(p) : pr.barrier;
}
function barMax(p: ServerPlayer, pr: Prog): number {
  return ad.esMax ? ad.esMax(p) : pr.def.barrier;
}
function restoreBar(p: ServerPlayer, pr: Prog, frac: number) {
  if (frac <= 0) return;
  if (ad.restoreEs) ad.restoreEs(p, frac);
  else pr.barrier = Math.min(pr.def.barrier, pr.barrier + pr.def.barrier * frac);
  pr.dirty = true;
}

export function initProgression(h: ProgHost, refreshFn: (p: ServerPlayer) => void) {
  host = h;
  refresh = refreshFn;
  resetShrines();
  onMapChange(() => resetShrines());
}

// ---- state --------------------------------------------------------------------------

function freshProg(cls: string): Prog {
  const c = CLASS_BY_ID.get(cls) ?? CLASS_BY_ID.get(DEFAULT_CLASS)!;
  const pr: Prog = {
    cls: c.id,
    level: 1,
    xp: 0,
    alloc: new Set([c.start]),
    asc: null,
    ascAlloc: new Set(),
    ascState: 0,
    mods: {},
    def: computeDefences({}),
    barrier: 0,
    lastHitAt: -99,
    postRollUntil: -1,
    killRushUntil: -1,
    evadeHasteUntil: -1,
    invulnUntil: -1,
    cheatReadyAt: 0,
    stillFor: 0,
    prevRollT: 0,
    prevX: 0,
    prevY: 0,
    wasAlive: false,
    trophies: 0,
    secondWindAt: 0,
    prevHp: -1,
    honour: 0,
    entropy: Math.random(),
    condKey: "",
    cond: { lowLife: false, postRoll: false, calm: false, still: false, barrierFull: false, killRush: false, evadeHaste: false, trophies: 0 },
    dirty: true,
    sentBarrier: -1,
    shrineVer: 0,
    jewels: new Map(),
  };
  recalc(pr);
  pr.barrier = pr.def.barrier;
  return pr;
}

export function prog(p: ServerPlayer): Prog {
  let pr = progs.get(p.id);
  if (!pr) {
    pr = freshProg(DEFAULT_CLASS);
    progs.set(p.id, pr);
  }
  return pr;
}

function recalc(pr: Prog, p?: ServerPlayer) {
  pr.mods = totalMods(pr.cls, pr.alloc, pr.ascAlloc);
  pr.def = computeDefences(p ? withGearAttrs(pr.mods, p) : pr.mods); // gear attributes too, so a passive never clips barrier
  if (pr.barrier > pr.def.barrier) pr.barrier = pr.def.barrier;
}

export function playerClass(p: ServerPlayer): string {
  return prog(p).cls;
}

export function playerLevel(p: ServerPlayer): number {
  return progs.get(p.id)?.level ?? 1;
}

/** Look digit (1..8) for the paper doll; 0 if unknown. */
export function classLookDigit(p: ServerPlayer): string {
  return String(CLASS_BY_ID.get(prog(p).cls)?.look ?? 0);
}

/** Fresh level-1 state for a new match (keeps the class). */
export function resetProgression(p: ServerPlayer, cls?: string) {
  const pr = freshProg(cls ?? prog(p).cls);
  progs.set(p.id, pr);
  refresh(p);
  pr.barrier = pr.def.barrier;
}

export function removeProgression(p: ServerPlayer) {
  progs.delete(p.id);
}

export function passivePoints(pr: Prog): number {
  return (pr.level - 1) * POINTS_PER_LEVEL - (pr.alloc.size - 1);
}

export function ascPoints(pr: Prog): number {
  if (!pr.asc) return 0;
  const earned = ASC_POINTS_ON_PICK + ASC_POINT_STEPS.reduce((n, [l, pts]) => n + (pr.level >= l ? pts : 0), 0);
  return earned - (pr.ascAlloc.size - 1);
}

/** Layer level + passives + conditional effects on top of gear stats (called from refreshStats). */
export function applyPlayerProgression(p: ServerPlayer, s: Stats): Stats {
  const pr = prog(p);
  // PoE2: attributes on gear ("+N to Strength", "+N to all Attributes") count like passive ones:
  // they feed the attribute bonuses, the character sheet and equip requirements (pr.def).
  const m = withGearAttrs(pr.mods, p);
  pr.def = computeDefences(m);
  if (pr.barrier > pr.def.barrier) pr.barrier = pr.def.barrier;
  return applyProgression(s, m, pr.level, pr.cond);
}

/** Passive totals plus the attributes granted by equipped gear (same object if gear grants none). */
function withGearAttrs(mods: PassiveMods, p: ServerPlayer): PassiveMods {
  let str = 0, dex = 0, int = 0;
  for (const it of Object.values(p.equip ?? {})) {
    if (!it) continue;
    const t = itemModTotals(it);
    const all = t.allAttr ?? 0;
    str += (t.str ?? 0) + all;
    dex += (t.dex ?? 0) + all;
    int += (t.int ?? 0) + all;
  }
  if (!str && !dex && !int) return mods;
  return { ...mods, str: (mods.str ?? 0) + str, dex: (mods.dex ?? 0) + dex, int: (mods.int ?? 0) + int };
}

// ---- XP --------------------------------------------------------------------------------

/** Level cap in force (Breachway sets 20 for its matches). */
export const levelCap = { v: MAX_LEVEL };

export function gainXp(p: ServerPlayer, amount: number) {
  const pr = prog(p);
  const MAX_LEVEL = levelCap.v;
  if (amount <= 0 || pr.level >= MAX_LEVEL) return;
  pr.xp += Math.round(amount);
  pr.dirty = true;
  let gained = 0;
  while (pr.level < MAX_LEVEL && pr.xp >= xpToNext(pr.level)) {
    pr.xp -= xpToNext(pr.level);
    pr.level++;
    gained++;
    if (pr.level === ASCEND_LEVEL && pr.ascState === 0) {
      pr.ascState = 1;
      host?.toast(p, HINT_PREFIX + "A trial shrine calls: clear one to ascend");
    }
    if (pr.asc && ASC_POINT_STEPS.some(([l]) => l === pr.level)) host?.toast(p, "You gained ascendancy points (P)");
  }
  if (pr.level >= MAX_LEVEL) pr.xp = 0;
  if (gained > 0) {
    refresh(p);
    if (p.alive) p.hp = p.stats.maxHp; // levelling up restores life and barrier
    pr.barrier = pr.def.barrier;
    host?.events.push({ k: "lvl", id: p.id, lv: pr.level, x: Math.round(p.x), y: Math.round(p.y) });
  }
}

/** Rarity tier for XP. Reads the monster's `rarity` (0 normal, 1 magic, 2 rare, 3 unique/boss) when present. */
export function monsterTier(m: Monster): MonsterTier {
  if (bossIds.has(m.id)) return "boss";
  const r = (m as unknown as { rarity?: number }).rarity;
  if (typeof r === "number") return r >= 3 ? "boss" : r === 2 ? "rare" : r === 1 ? "magic" : "normal";
  return m.elite ? "rare" : "normal";
}

export function monsterXp(m: Monster): number {
  const t = m.type as unknown as { id: string; hp: number; xp?: number };
  const base = t.xp ?? MONSTER_XP[t.id] ?? Math.max(5, Math.round(t.hp / 3));
  // Monsters scale with the player who wakes them: XP follows their level so they stay worth killing.
  const lvl = (m as unknown as { ext?: { level?: number } }).ext?.level ?? 1;
  return base * XP_TIER_MULT[monsterTier(m)] * (1 + MONSTER_XP_PER_LEVEL * Math.max(0, lvl - 1));
}

export function playerKillXp(victimLevel: number): number {
  return PLAYER_KILL_XP_BASE + PLAYER_KILL_XP_PER_LEVEL * victimLevel;
}

// ---- kill hooks --------------------------------------------------------------------------

function onKillEffects(killer: ServerPlayer, pr: Prog) {
  const g = (k: keyof PassiveMods) => pr.mods[k] ?? 0;
  if (!killer.alive) return;
  if (g("lifeOnKill")) killer.hp = Math.min(killer.stats.maxHp, killer.hp + (killer.stats.maxHp * g("lifeOnKill")) / 100);
  if (g("barrierOnKill")) restoreBar(killer, pr, g("barrierOnKill") / 100);
  if (g("killRushAtk") || g("killRushMove")) pr.killRushUntil = now + KILL_RUSH_TIME;
  if (g("chargesOnKill")) host?.addCharges(killer, g("chargesOnKill"));
}

/** Called by Game.onMonsterKilled. */
export function progOnMonsterKilled(m: Monster, killer: ServerPlayer) {
  const pr = prog(killer);
  gainXp(killer, monsterXp(m) * (1 + (pr.mods.xpMore ?? 0) / 100));
  onKillEffects(killer, pr);
  if (bossIds.has(m.id)) completeTrialFor(m);
  bossIds.delete(m.id);
  for (const s of shrines) {
    if (!s.trial || !s.trial.ids.delete(m.id)) continue;
    if (s.trial.phase === 1 && s.trial.ids.size === 0) summonGuardian(s);
  }
  const nova = pr.mods.killNova ?? 0;
  if (nova > 0 && host) {
    host.events.push({ k: "boom", x: Math.round(m.x), y: Math.round(m.y), r: NOVA_RADIUS });
    const dmg = (m.maxHp * nova) / 100;
    for (const o of [...host.monsters.monsters.values()]) {
      if (o === m || !o.alive || Math.hypot(o.x - m.x, o.y - m.y) > NOVA_RADIUS + o.radius) continue;
      hurtMonster(o, dmg, m.x, m.y, 250, killer);
    }
  }
}

/** Called by Game.onPlayerKilled (before the victim's progression is discarded). */
export function progOnPlayerKilled(victim: ServerPlayer, killer: ServerPlayer | null) {
  const vpr = progs.get(victim.id);
  if (vpr) failTrialsOf(victim);
  if (!killer || killer === victim) return;
  const pr = prog(killer);
  pr.trophies++;
  gainXp(killer, playerKillXp(vpr?.level ?? 1) * (1 + (pr.mods.bountyXp ?? 0) / 100));
  onKillEffects(killer, pr);
  if (pr.mods.bountyFlask) host?.addCharges(killer, 999);
  pr.condKey = ""; // trophies changed
}

function hurtMonster(m: Monster, dmg: number, fx: number, fy: number, kb: number, by: ServerPlayer, source = "passive") {
  if (!host || !m.alive) return;
  if (ad.hitMonster) {
    ad.hitMonster(m, dmg, by, source, fx, fy);
    return;
  }
  host.events.push({ k: "hit", x: Math.round(m.x), y: Math.round(m.y), target: m.id, by: by.id, dmg: Math.round(dmg * 10) / 10, m: 1 });
  const hpB = m.hp;
  if (host.monsters.damage(m, dmg, fx, fy, kb, by)) {
    // Gore (GoreFx): every kill gets type / life / overkill / direction, like server/damage.ts kills.
    const dd = Math.hypot(m.x - fx, m.y - fy);
    const dir = dd > 0.5 ? { dx: Math.round(((m.x - fx) / dd) * 100) / 100, dy: Math.round(((m.y - fy) / dd) * 100) / 100 } : {};
    const gore = { dt: "p" as const, mx: Math.round(m.maxHp), lf: Math.round(Math.min(dmg, hpB) * 10) / 10, ok: Math.round(Math.max(0, dmg - hpB) * 10) / 10, fo: "area" as const, ...dir };
    host.events.push({ k: "mdie", id: m.id, mk: m.type.id, x: Math.round(m.x), y: Math.round(m.y), r: m.radius, a: Math.round(m.angle * 100) / 100, ...(m.elite ? { el: 1 as const } : {}), ...gore });
    host.onMonsterKilled(m, by);
  }
}

// ---- defences ------------------------------------------------------------------------------

const THORNS = "'s thorns";

function isElementalSource(source: string): boolean {
  if (source.endsWith("blast")) return true;
  if (MONSTER_TYPES.some((t) => t.ai === "ranged" && t.name === source)) return true;
  if (!host) return false;
  for (const m of host.monsters.monsters.values()) if (m.type.ai === "ranged" && (m.eliteName ?? m.type.name) === source) return true;
  return false;
}

/**
 * Defensive layer for every hit a player takes (called from combat.damagePlayer after the i-frame
 * check). Returns the damage and knockback to apply, or null if the hit is avoided entirely.
 * Order: evasion -> resistance (elemental) / armour (physical) -> more/less taken -> barrier -> cheat death.
 */
export function mitigateHit(t: ServerPlayer, dmg: number, kb: number, attacker: ServerPlayer | null, source: string): { dmg: number; kb: number } | null {
  const pr = prog(t);
  if (pr.invulnUntil > now) return null;
  const mods = pr.mods;
  const thorns = source.endsWith(THORNS);
  const elemental = isElementalSource(source);

  // Evasion (attacks and projectiles; not blasts or reflected damage), with entropy
  if (!thorns && !source.endsWith("blast") && pr.def.evadeChance > 0) {
    pr.entropy += pr.def.evadeChance;
    if (pr.entropy >= 1) {
      pr.entropy -= 1;
      if (mods.evadeHaste) pr.evadeHasteUntil = now + EVADE_HASTE_TIME;
      host?.events.push({ k: "evade", target: t.id, x: Math.round(t.x), y: Math.round(t.y) });
      return null;
    }
  }
  if (elemental) dmg *= 1 - pr.def.resist / 100;
  else dmg *= 1 - armourReduction(pr.def.armour, dmg);
  dmg *= 1 + (mods.dmgTakenMore ?? 0) / 100;
  dmg = Math.max(0, dmg);

  // Reflect (players and monsters; reflected damage never reflects again)
  if (!thorns && (mods.reflect ?? 0) > 0 && host) {
    const back = (dmg * mods.reflect!) / 100;
    if (attacker && attacker.alive) dealPlayer(attacker, back, t, thornsSource(t.name));
    else {
      let best: Monster | null = null;
      let bd = 260;
      for (const m of host.monsters.monsters.values()) {
        const d = Math.hypot(m.x - t.x, m.y - t.y);
        if (d < bd && (m.eliteName ?? m.type.name) === source) {
          bd = d;
          best = m;
        }
      }
      if (best) hurtMonster(best, back, t.x, t.y, 0, t);
    }
  }

  pr.lastHitAt = now;
  drainHonour(t, pr, dmg);
  if (pr.barrier > 0) {
    const take = Math.min(pr.barrier, dmg);
    pr.barrier -= take;
    dmg -= take;
    pr.dirty = true;
  }
  if ((mods.cheatDeath ?? 0) > 0 && dmg >= t.hp && now >= pr.cheatReadyAt) {
    dmg = Math.max(0, t.hp - 1);
    pr.invulnUntil = now + CHEAT_DEATH_INVULN;
    pr.cheatReadyAt = now + mods.cheatDeath!;
    host?.toast(t, "Last Stand! Death refused.");
    host?.events.push({ k: "evade", target: t.id, x: Math.round(t.x), y: Math.round(t.y), cd: 1 });
  }
  if (mods.noKnockback) kb = 0;
  return { dmg, kb };
}

/** Set by Game: applies passive-effect damage (thorns, roll strikes) to a player through the normal damage path. */
let hurtPlayer: ((target: ServerPlayer, dmg: number, from: ServerPlayer, source: string) => void) | null = null;
export function setHurtPlayerHandler(fn: (target: ServerPlayer, dmg: number, from: ServerPlayer, source: string) => void) {
  hurtPlayer = fn;
}
function dealPlayer(t: ServerPlayer, dmg: number, from: ServerPlayer, source: string) {
  if (ad.hitPlayer) ad.hitPlayer(t, dmg, from, source, from.x, from.y);
  else hurtPlayer?.(t, dmg, from, source);
}

/**
 * "When hit" passives for the combat core's defenceHooks (damage.ts): cheat-death invulnerability,
 * more/less damage taken (+ the cheat-death save), and after-hit effects (honour, reflect, evade haste,
 * calm timer). Shapes are read defensively so this keeps working while HitSpec evolves.
 */
let hooksLive = false;
export const progDefenceHooks = {
  invuln(p: ServerPlayer): boolean {
    return (progs.get(p.id)?.invulnUntil ?? -1) > now;
  },
  takenMult(p: ServerPlayer, h: { dmg?: Record<string, number> }): number {
    const pr = progs.get(p.id);
    if (!pr) return 1;
    let mult = 1 + (pr.mods.dmgTakenMore ?? 0) / 100;
    const raw = Object.values(h?.dmg ?? {}).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
    if ((pr.mods.cheatDeath ?? 0) > 0 && now >= pr.cheatReadyAt && raw * mult >= p.hp + barCur(p, pr)) {
      mult = Math.min(mult, Math.max(0, p.hp + barCur(p, pr) - 1) / Math.max(1, raw));
      pr.invulnUntil = now + CHEAT_DEATH_INVULN;
      pr.cheatReadyAt = now + pr.mods.cheatDeath!;
      host?.toast(p, "Last Stand! Death refused.");
      host?.events.push({ k: "evade", target: p.id, x: Math.round(p.x), y: Math.round(p.y), cd: 1 });
    }
    return mult;
  },
  afterHit(p: ServerPlayer, h: { by?: unknown; source?: string }, res: unknown): void {
    hooksLive = true;
    const pr = progs.get(p.id);
    if (!pr) return;
    const r = (res ?? {}) as Record<string, unknown>;
    if (r.evaded || r.evade) {
      if (pr.mods.evadeHaste) pr.evadeHasteUntil = now + EVADE_HASTE_TIME;
      return;
    }
    const dealt = typeof res === "number" ? res : [r.total, r.dealt, r.dmg, r.life].find((v) => typeof v === "number") as number | undefined;
    pr.lastHitAt = now;
    if (!dealt || dealt <= 0) return;
    drainHonour(p, pr, dealt);
    const source = h?.source ?? "";
    if ((pr.mods.reflect ?? 0) > 0 && !source.endsWith(THORNS) && host) {
      const back = (dealt * pr.mods.reflect!) / 100;
      const by = h?.by;
      const attacker = by && typeof by === "object" ? (by as ServerPlayer) : typeof by === "number" ? host.players.get(by) : undefined;
      if (attacker && attacker !== p && "joined" in attacker) {
        if (attacker.alive) dealPlayer(attacker, back, p, thornsSource(p.name));
      } else {
        const m = by && typeof by === "object" ? (by as Monster) : typeof by === "number" ? host.monsters.monsters.get(by) : undefined;
        if (m && m.alive) hurtMonster(m, back, p.x, p.y, 0, p, thornsSource(p.name));
      }
    }
  },
};
export const thornsSource = (name: string) => name + THORNS;

// ---- offensive hooks (called from combat.resolveSwing; skills may call them too) ---------------

export type HitTarget = { m: Monster } | { p: ServerPlayer };

/** Damage multiplier from passives for one hit (first hit, elites, players). */
export function progHitMult(attacker: ServerPlayer, target: HitTarget): number {
  const m = prog(attacker).mods;
  let mult = 1;
  if ("m" in target) {
    const t = target.m;
    if (m.firstHitDmg && t.hp >= t.maxHp - 0.01) mult *= 1 + m.firstHitDmg / 100;
    if (m.eliteDmg && (t.elite || bossIds.has(t.id))) mult *= 1 + m.eliteDmg / 100;
  } else {
    const t = target.p;
    if (m.firstHitDmg && t.hp >= t.stats.maxHp - 0.01) mult *= 1 + m.firstHitDmg / 100;
    if (m.pvpDmg) mult *= 1 + m.pvpDmg / 100;
  }
  return mult;
}

/** After a hit landed for `dealt` damage: leech, splash, execute. */
export function progAfterHit(attacker: ServerPlayer, dealt: number, target: HitTarget) {
  if (!attacker.alive || dealt <= 0) return;
  const pr = prog(attacker);
  const m = pr.mods;
  if (m.lifeLeech) attacker.hp = Math.min(attacker.stats.maxHp, attacker.hp + (dealt * m.lifeLeech) / 100);
  if (m.barrierLeech) {
    const mx = barMax(attacker, pr);
    if (mx > 0) restoreBar(attacker, pr, (dealt * m.barrierLeech) / 100 / mx);
  }
  if (!("m" in target) || !host) return;
  const t = target.m;
  if (m.execute && t.alive && t.hp > 0 && t.hp <= (t.maxHp * m.execute) / 100 && !bossIds.has(t.id)) hurtMonster(t, t.hp + 1, attacker.x, attacker.y, 0, attacker);
  if (m.splash) {
    const d = (dealt * m.splash) / 100;
    for (const o of [...host.monsters.monsters.values()]) {
      if (o === t || !o.alive || Math.hypot(o.x - t.x, o.y - t.y) > SPLASH_RADIUS + o.radius) continue;
      hurtMonster(o, d, t.x, t.y, 0, attacker);
    }
  }
}

/** Once per swing that hit something. */
export function progAfterSwing(attacker: ServerPlayer, hits: number) {
  const c = prog(attacker).mods.chargesOnHit ?? 0;
  if (hits > 0 && c > 0) host?.addCharges(attacker, c);
}

function onRollStart(p: ServerPlayer, pr: Prog) {
  const m = pr.mods;
  if (m.dodgeHeal) p.hp = Math.min(p.stats.maxHp, p.hp + (p.stats.maxHp * m.dodgeHeal) / 100);
  if (m.dodgeBarrier) restoreBar(p, pr, m.dodgeBarrier / 100);
  if (m.rollStrike && host) {
    const dmg = (p.stats.attackDamage * m.rollStrike) / 100;
    host.events.push({ k: "boom", x: Math.round(p.x), y: Math.round(p.y), r: ROLL_STRIKE_RADIUS });
    for (const o of [...host.monsters.monsters.values()]) {
      if (!o.alive || Math.hypot(o.x - p.x, o.y - p.y) > ROLL_STRIKE_RADIUS + o.radius) continue;
      hurtMonster(o, dmg * progHitMult(p, { m: o }), p.x, p.y, 200, p, `${p.name}'s roll`);
    }
    for (const o of host.players.values()) {
      if (o === p || !o.alive || !o.joined || Math.hypot(o.x - p.x, o.y - p.y) > ROLL_STRIKE_RADIUS + PLAYER_RADIUS) continue;
      dealPlayer(o, dmg * PVP_DAMAGE_MULT * progHitMult(p, { p: o }), p, p.name);
    }
  }
}

// ---- allocation ------------------------------------------------------------------------------

export function allocate(p: ServerPlayer, id: unknown): string | null {
  const pr = prog(p);
  if (typeof id !== "string") return "Bad node";
  const n = PASSIVE_BY_ID.get(id);
  if (!n) return "Unknown passive";
  if (pr.alloc.has(id)) return "Already allocated";
  if (passivePoints(pr) <= 0) return "No passive points";
  if (!n.links.some((l) => pr.alloc.has(l))) return "Must connect to an allocated passive";
  pr.alloc.add(id);
  afterAlloc(p, pr);
  return null;
}

export function allocateAsc(p: ServerPlayer, id: unknown): string | null {
  const pr = prog(p);
  if (typeof id !== "string") return "Bad node";
  if (!pr.asc) return "No ascendancy chosen";
  const n = ASC_NODE_BY_ID.get(id);
  if (!n || !id.startsWith(pr.asc + "_")) return "Not part of your ascendancy";
  if (pr.ascAlloc.has(id)) return "Already allocated";
  if (ascPoints(pr) <= 0) return "No ascendancy points";
  if (!n.links.some((l) => pr.ascAlloc.has(l))) return "Must connect to an allocated node";
  pr.ascAlloc.add(id);
  afterAlloc(p, pr);
  return null;
}

export function chooseAscendancy(p: ServerPlayer, ascId: unknown): string | null {
  const pr = prog(p);
  if (pr.ascState !== 2) return pr.ascState === 3 ? "Already ascended" : "Clear a trial shrine first";
  const a = typeof ascId === "string" ? ASC_BY_ID.get(ascId) : undefined;
  const c = CLASS_BY_ID.get(pr.cls)!;
  if (!a || !c.ascendancies.includes(a.id)) return "Not an ascendancy of your class";
  pr.asc = a.id;
  pr.ascAlloc = new Set([a.nodes[0].id]);
  pr.ascState = 3;
  afterAlloc(p, pr);
  host?.events.push({ k: "info", text: `${p.name} ascended as a ${a.name}` });
  host?.events.push({ k: "lvl", id: p.id, lv: pr.level, x: Math.round(p.x), y: Math.round(p.y), asc: 1 });
  return null;
}

function afterAlloc(p: ServerPlayer, pr: Prog) {
  const before = pr.def.barrier;
  recalc(pr, p);
  if (pr.def.barrier > before) pr.barrier += pr.def.barrier - before; // new barrier comes in charged
  pr.condKey = "";
  pr.dirty = true;
  const oldMax = p.stats.maxHp;
  refresh(p);
  if (p.alive && p.stats.maxHp > oldMax) p.hp = Math.min(p.stats.maxHp, p.hp + (p.stats.maxHp - oldMax));
}

// ---- trial shrines ----------------------------------------------------------------------------

/**
 * Trial shrine locations: the map's "trial" points of interest (3-6 per map from the world
 * generator). Fallback: four spots between the centre and the corners.
 */
export function trialShrineSpots(): { x: number; y: number }[] {
  let pois: { x: number; y: number }[] = [];
  try {
    pois = getPois("trial");
  } catch {
    pois = [];
  }
  if (pois.length > 0) return pois.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  return [
    [0.3, 0.3],
    [0.7, 0.3],
    [0.3, 0.7],
    [0.7, 0.7],
  ].map(([fx, fy]) => {
    const at = walkableNear(MAP_W * fx, MAP_H * fy, 60) ?? { x: MAP_W * fx, y: MAP_H * fy };
    return { x: Math.round(at.x), y: Math.round(at.y) };
  });
}

export function resetShrines() {
  for (const s of shrines) if (s.trial) despawnTrial(s);
  shrines = trialShrineSpots().map((p) => ({ x: p.x, y: p.y, s: 0, cd: 0, trial: null }));
  bossIds.clear();
  shrineVer++;
}

export function shrineSnaps(): ShrineSnap[] {
  return shrines.map((s) => ({ x: s.x, y: s.y, s: s.s }));
}

/** Player pressed interact near a shrine. */
export function activateTrial(p: ServerPlayer): string | null {
  if (!host || !p.alive) return "You can't do that now";
  if (host.phase === "countdown" || host.phase === "ended") return "Not now";
  const s = shrines.find((sh) => Math.hypot(sh.x - p.x, sh.y - p.y) <= SHRINE_RANGE + PLAYER_RADIUS);
  if (!s) return "No trial shrine nearby";
  const pr = prog(p);
  if (pr.ascState >= 2) return "You have already passed a trial";
  if (pr.level < ASCEND_LEVEL) return `The shrine ignores you (requires level ${ASCEND_LEVEL})`;
  if (s.s === 1) return "A trial is already under way here";
  if (s.s === 2) return "The shrine is still dormant";
  const camp = { id: -2, x: s.x, y: s.y, monsters: [], clearedFor: 0 } as unknown as Camp;
  const ids = new Set<number>();
  TRIAL_ADDS.forEach((tid, i) => {
    const t = MONSTER_BY_ID.get(tid);
    if (!t) return;
    const a = (i / TRIAL_ADDS.length) * Math.PI * 2;
    const m = host!.monsters.spawnMonster(camp, t, false, spotNear(s.x + Math.cos(a) * 110, s.y + Math.sin(a) * 110, t.radius));
    m.state = 1;
    m.target = p.id;
    ids.add(m.id);
  });
  s.s = 1;
  s.trial = { owner: p.id, bossId: -1, ids, t: 0, camp, phase: 1 };
  pr.honour = TRIAL_HONOUR;
  pr.dirty = true;
  shrineVer++;
  host.toast(p, "Trial of Honour: slay the shrine guard, then its Warden. Every hit you take costs honour.");
  host.events.push({ k: "info", text: `${p.name} woke a trial shrine` });
  host.events.push({ k: "boom", x: s.x, y: s.y, r: 140 });
  return null;
}

function spotNear(x: number, y: number, r: number) {
  return walkableNear(x, y, r + 4, 300) ?? { x, y };
}

/** Phase 2: the adds are dead, the Shrine Warden rises. */
function summonGuardian(s: Shrine) {
  if (!host || !s.trial) return;
  const g = MONSTER_BY_ID.get(GUARDIAN.type) ?? MONSTER_TYPES[0];
  const boss = host.monsters.spawnMonster(s.trial.camp, g, true, spotNear(s.x + 70, s.y - 40, g.radius));
  boss.hp *= GUARDIAN.hpMult;
  boss.maxHp = boss.hp;
  boss.damage *= GUARDIAN.dmgMult;
  boss.eliteName = GUARDIAN.name;
  boss.state = 1;
  boss.target = s.trial.owner;
  bossIds.add(boss.id);
  s.trial.ids.add(boss.id);
  s.trial.bossId = boss.id;
  s.trial.phase = 2;
  host.events.push({ k: "boom", x: Math.round(boss.x), y: Math.round(boss.y), r: 160 });
  const owner = host.players.get(s.trial.owner);
  if (owner) host.toast(owner, "The Shrine Warden rises!");
}

function drainHonour(t: ServerPlayer, pr: Prog, dmg: number) {
  if (dmg <= 0 || !shrines.some((s) => s.trial?.owner === t.id)) return;
  const pool = Math.max(1, t.stats.maxHp + pr.def.barrier);
  pr.honour = Math.max(0, pr.honour - (dmg / pool) * 100 * HONOUR_DRAIN);
  pr.dirty = true;
  if (pr.honour <= 0) {
    host?.toast(t, "Your honour is spent. The trial has failed.");
    failTrialsOf(t);
  }
}

function completeTrialFor(boss: Monster) {
  const s = shrines.find((sh) => sh.trial?.bossId === boss.id);
  if (!s || !s.trial || !host) return;
  const winners: ServerPlayer[] = [];
  const ownerPr = progs.get(s.trial.owner);
  if (ownerPr) {
    ownerPr.honour = 0;
    ownerPr.dirty = true;
  }
  for (const p of host.players.values()) {
    if (!p.joined || !p.alive) continue;
    const pr = prog(p);
    if (pr.ascState !== 1) continue;
    if (p.id === s.trial.owner || Math.hypot(p.x - s.x, p.y - s.y) <= TRIAL_ASSIST_RANGE) winners.push(p);
  }
  for (const p of winners) {
    const pr = prog(p);
    pr.ascState = 2;
    pr.dirty = true;
    host.toast(p, "Trial complete! Press P to choose your ascendancy.");
    host.events.push({ k: "info", text: `${p.name} passed the trial` });
  }
  despawnTrial(s);
  s.s = 2;
  s.cd = SHRINE_COOLDOWN;
  shrineVer++;
}

function despawnTrial(s: Shrine) {
  if (!s.trial || !host) return;
  for (const id of s.trial.ids) {
    const m = host.monsters.monsters.get(id);
    if (m) {
      m.alive = false;
      host.monsters.monsters.delete(id);
    }
    bossIds.delete(id);
  }
  s.trial = null;
}

function failTrialsOf(p: ServerPlayer) {
  const pr = progs.get(p.id);
  if (pr && pr.honour > 0) {
    pr.honour = 0;
    pr.dirty = true;
  }
  for (const s of shrines) {
    if (s.trial?.owner !== p.id) continue;
    despawnTrial(s);
    s.s = 2;
    s.cd = SHRINE_COOLDOWN / 2;
    shrineVer++;
    host?.events.push({ k: "info", text: "A trial shrine falls dormant" });
  }
}

// ---- per tick -------------------------------------------------------------------------------------

export function progressionTick(players: ServerPlayer[]) {
  now += DT;
  // Shrines
  for (const s of shrines) {
    if (s.s === 2) {
      s.cd -= DT;
      if (s.cd <= 0) {
        s.s = 0;
        shrineVer++;
      }
    } else if (s.s === 1 && s.trial) {
      s.trial.t += DT;
      const owner = host?.players.get(s.trial.owner);
      const bossGone = s.trial.phase === 2 && !host?.monsters.monsters.has(s.trial.bossId);
      if (!owner || !owner.alive || s.trial.t > TRIAL_TIME_LIMIT || bossGone) {
        if (owner && owner.alive && s.trial.t > TRIAL_TIME_LIMIT) host?.toast(owner, "The trial has failed: too slow.");
        failTrialsOf(owner ?? ({ id: s.trial.owner } as ServerPlayer));
        if (s.trial) {
          despawnTrial(s);
          s.s = 2;
          s.cd = SHRINE_COOLDOWN / 2;
          shrineVer++;
        }
      }
    }
  }

  for (const p of players) {
    const pr = prog(p);
    if (!p.alive) {
      pr.wasAlive = false;
      continue;
    }
    if (!pr.wasAlive) {
      // (Re)spawned: full barrier, fresh combat state.
      pr.wasAlive = true;
      pr.barrier = pr.def.barrier;
      pr.lastHitAt = now - CALM_TIME;
      pr.prevX = p.x;
      pr.prevY = p.y;
      pr.dirty = true;
    }
    if (p.rollT > pr.prevRollT + 1e-6) {
      pr.postRollUntil = now + POST_ROLL_TIME;
      onRollStart(p, pr);
    }
    // Until the combat core calls progDefenceHooks.afterHit, infer hits from life loss (honour, calm timer).
    if (!hooksLive && pr.prevHp >= 0 && p.hp < pr.prevHp - 0.01) {
      pr.lastHitAt = now;
      drainHonour(p, pr, pr.prevHp - p.hp);
    }
    pr.prevHp = p.hp;
    // Second wind: dropping low grants a burst of barrier (may overcharge; the excess fades).
    if (pr.mods.secondWind && p.hp < p.stats.maxHp * SECOND_WIND_AT && now >= pr.secondWindAt) {
      pr.secondWindAt = now + SECOND_WIND_CD;
      restoreBar(p, pr, (p.stats.maxHp * pr.mods.secondWind) / 100 / Math.max(1, barMax(p, pr)));
      host?.events.push({ k: "evade", target: p.id, x: Math.round(p.x), y: Math.round(p.y), cd: 1 });
    }
    pr.prevRollT = p.rollT;
    const moved = Math.abs(p.x - pr.prevX) + Math.abs(p.y - pr.prevY) > 0.5;
    pr.stillFor = moved ? 0 : pr.stillFor + DT;
    pr.prevX = p.x;
    pr.prevY = p.y;

    // Barrier recharge
    // Own barrier pool only until the combat core owns barrier / ES (see ProgAdapters).
    if (!ad.esOf && !pr.mods.noBarrierRecharge && pr.def.barrier > 0 && pr.barrier < pr.def.barrier && now - pr.lastHitAt >= DEFENCE.barrierDelay) {
      const rate = DEFENCE.barrierRecharge * (1 + (pr.mods.barrierRechargeMore ?? 0) / 100);
      pr.barrier = Math.min(pr.def.barrier, pr.barrier + pr.def.barrier * rate * DT);
    }
    if (Math.round(barCur(p, pr)) !== pr.sentBarrier) pr.dirty = true;

    // Conditional effects: only the ones this player's passives care about can trigger a refresh.
    const m = pr.mods;
    const c: ProgConditions = {
      lowLife: !!m.lowLifeDmg && p.hp < p.stats.maxHp * LOW_LIFE,
      postRoll: !!m.postRollDmg && now < pr.postRollUntil,
      calm: !!m.calmDmg && now - pr.lastHitAt >= CALM_TIME,
      still: !!m.stillAtk && pr.stillFor > 0.25,
      barrierFull: !!m.fullBarrierDmg && barMax(p, pr) > 0 && barCur(p, pr) >= barMax(p, pr) - 0.01,
      killRush: (!!m.killRushAtk || !!m.killRushMove) && now < pr.killRushUntil,
      evadeHaste: !!m.evadeHaste && now < pr.evadeHasteUntil,
      trophies: m.trophyDmg ? pr.trophies : 0,
    };
    const key = `${+c.lowLife}${+c.postRoll}${+c.calm}${+c.still}${+c.barrierFull}${+c.killRush}${+c.evadeHaste}${c.trophies}`;
    if (key !== pr.condKey) {
      pr.cond = c;
      pr.condKey = key;
      refresh(p);
    }
  }
}

// ---- network ---------------------------------------------------------------------------------------

export function progMessage(p: ServerPlayer): ProgMsg {
  const pr = prog(p);
  return {
    t: "prog",
    lv: pr.level,
    xp: pr.xp,
    next: pr.level >= levelCap.v ? 0 : xpToNext(pr.level),
    pts: passivePoints(pr),
    cls: pr.cls,
    alloc: [...pr.alloc],
    asc: pr.asc,
    ascAlloc: [...pr.ascAlloc],
    ascPts: ascPoints(pr),
    ascState: pr.ascState,
    def: pr.def,
    bar: Math.round(barCur(p, pr)),
    ...(shrines.some((s) => s.trial?.owner === p.id) ? { hon: Math.round(pr.honour) } : {}),
    ...(pr.jewels.size ? { jw: Object.fromEntries(pr.jewels) } : {}),
  };
}

/** Messages to send this player this tick (prog when changed, shrines when changed). */
/** A reconnected client: send the whole progression state and the shrine list again. */
export function progResend(p: ServerPlayer) {
  const pr = prog(p);
  pr.dirty = true;
  pr.shrineVer = 0;
}

export function progOutbox(p: ServerPlayer): (ProgMsg | ShrinesMsg)[] {
  const pr = prog(p);
  const out: (ProgMsg | ShrinesMsg)[] = [];
  if (pr.dirty) {
    pr.dirty = false;
    pr.sentBarrier = Math.round(barCur(p, pr));
    out.push(progMessage(p));
  }
  if (pr.shrineVer !== shrineVer) {
    pr.shrineVer = shrineVer;
    out.push({ t: "shrines", list: shrineSnaps() });
  }
  return out;
}

// ---- dev (HNS_DEV=1) -------------------------------------------------------------------------------

/** Returns true if the dev command was a progression one. */
export function progDevCommand(p: ServerPlayer, msg: Record<string, unknown>): boolean {
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  switch (msg.cmd) {
    case "xp":
      gainXp(p, num(msg.v, 100));
      return true;
    case "level": {
      const target = Math.max(1, Math.min(MAX_LEVEL, Math.round(num(msg.v, 10))));
      const pr = prog(p);
      while (pr.level < target) gainXp(p, xpToNext(pr.level) - pr.xp);
      return true;
    }
    case "trialdone": {
      const pr = prog(p);
      if (pr.level < ASCEND_LEVEL) progDevCommand(p, { cmd: "level", v: ASCEND_LEVEL });
      if (pr.ascState < 2) pr.ascState = 2;
      pr.dirty = true;
      return true;
    }
    case "shrinetp": {
      const s = shrines[Math.max(0, Math.min(shrines.length - 1, Math.round(num(msg.i, 0))))];
      if (s && p.alive) {
        const at = spotNear(s.x + 60, s.y + 40, PLAYER_RADIUS);
        p.x = at.x;
        p.y = at.y;
      }
      return true;
    }
  }
  return false;
}

// ---- equip requirements ------------------------------------------------------------------------

/**
 * Attribute / level requirement check for equipping a base (PoE-style: you need the stats to wear it).
 * Returns an error string, or null if allowed. For the inventory equip path.
 */
export function progEquipError(p: ServerPlayer, baseId: string): string | null {
  const pr = prog(p);
  const attrs = { str: pr.def.str, dex: pr.def.dex, int: pr.def.int };
  if (meetsRequirements(baseId, pr.level, attrs)) return null;
  const r = BASE_BY_ID.get(baseId)?.req;
  if (!r) return null;
  const need: string[] = [];
  if ((r.lvl ?? 1) > pr.level) need.push(`level ${r.lvl}`);
  if ((r.str ?? 0) > attrs.str) need.push(`${r.str} Str`);
  if ((r.dex ?? 0) > attrs.dex) need.push(`${r.dex} Dex`);
  if ((r.int ?? 0) > attrs.int) need.push(`${r.int} Int`);
  return `Requires ${need.join(", ")}`;
}

// ---- jewel sockets (passive tree) ---------------------------------------------------------------

/**
 * Socket grid jewel `id` into allocated tree socket `node` (a jewel already there goes back to the
 * bag), or with no id take the socketed jewel out. Returns an error string or null.
 */
export function socketJewel(p: ServerPlayer, node: unknown, id: unknown): string | null {
  const pr = prog(p);
  if ((node === undefined || node === null) && typeof id === "number") {
    // Quick socket (Ctrl / right-click in the bag): first allocated empty socket.
    const own = JEWEL_SOCKETS.filter((n) => pr.alloc.has(n));
    if (!own.length) return "Allocate a Jewel Socket on the passive tree first";
    node = own.find((n) => !pr.jewels.has(n));
    if (!node) return "Jewel sockets full - empty one on the passive tree";
  }
  if (typeof node !== "string" || PASSIVE_BY_ID.get(node)?.kind !== "jewel") return "Not a jewel socket";
  if (!pr.alloc.has(node)) return "Allocate the jewel socket first";
  const cur = pr.jewels.get(node) ?? null;
  if (id === undefined || id === null) {
    if (!cur) return null;
    if (!autoPlace(p, cur)) return "No room in your bag";
    pr.jewels.delete(node);
  } else {
    if (typeof id !== "number") return "Bad item";
    const idx = p.inv.findIndex((e) => e.it.id === id);
    if (idx < 0) return "That jewel isn't in your bag";
    const entry = p.inv[idx];
    const it = entry.it;
    if (!isJewel(it)) return "Only jewels fit a jewel socket";
    let same = 0;
    for (const [n, j] of pr.jewels) if (n !== node && j.b === it.b) same++;
    if (same >= JEWEL_MAX_PER_KIND) return `At most ${JEWEL_MAX_PER_KIND} ${JEWEL_BASE_BY_ID.get(it.b)?.name ?? "jewel"}s can be socketed`;
    p.inv.splice(idx, 1);
    if (cur && !autoPlace(p, cur)) {
      p.inv.splice(idx, 0, entry); // revert
      return "No room in your bag for the old jewel";
    }
    pr.jewels.set(node, it);
  }
  p.invDirty = true;
  afterAlloc(p, pr); // marks prog dirty and refreshes stats
  return null;
}

function jewelTotals(p: ServerPlayer): Partial<Record<ModKey | FxKey, number>> {
  const pr = progs.get(p.id);
  const out: Partial<Record<ModKey | FxKey, number>> = {};
  if (!pr) return out;
  for (const [node, j] of pr.jewels) {
    // Radius jewels (Driftglass / Stillstone uniques) scale with the allocated passives around their socket.
    const rad = JEWEL_BASE_BY_ID.get(j.b)?.radius;
    const ctx = rad ? jewelRadiusCounts(node, rad, pr.alloc) : undefined;
    for (const [k, v] of Object.entries(jewelModTotals(j, ctx))) out[k as ModKey] = (out[k as ModKey] ?? 0) + (v as number);
  }
  return out;
}

/** Gear-style modifiers from socketed jewels (computeStats `extra`, server/inventory.ts refreshStats). */
export function progJewelMods(p: ServerPlayer): Partial<Record<ModKey, number>> {
  const out: Partial<Record<ModKey, number>> = {};
  for (const [k, v] of Object.entries(jewelTotals(p))) if (!isFxKey(k)) out[k as ModKey] = v;
  return out;
}

/** Special-effect (FxKey) totals from socketed jewels (server/uniques.ts fxOf). */
export function progJewelFx(p: ServerPlayer): Partial<Record<FxKey, number>> {
  const out: Partial<Record<FxKey, number>> = {};
  for (const [k, v] of Object.entries(jewelTotals(p))) if (isFxKey(k)) out[k] = v;
  return out;
}

/** Cache signature of the socketed jewels (fx recompute key). */
export function progJewelSig(p: ServerPlayer): string {
  const pr = progs.get(p.id);
  if (!pr || !pr.jewels.size) return "";
  let k = "J";
  for (const [n, j] of pr.jewels) k += `${n}:${j.id}:${j.m.length}|`;
  k += `a${pr.alloc.size}`; // radius jewels change with allocated passives
  return k;
}

/** Remove and return every socketed jewel (death drops, server/inventory.ts stripAll). */
export function progTakeJewels(p: ServerPlayer): Item[] {
  const pr = progs.get(p.id);
  if (!pr || !pr.jewels.size) return [];
  const out = [...pr.jewels.values()];
  pr.jewels.clear();
  pr.dirty = true;
  return out;
}
