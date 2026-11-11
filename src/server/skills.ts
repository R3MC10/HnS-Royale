// Skill execution (server-authoritative): mana, spirit, the skill bar, socketing, cutting rough
// crystals, cooldowns, skill projectiles, totems, burns/chills, meta gems and gem drops.
// Uses the commit model from combat.ts: a skill sets atkT/atkCd to its use time and its effect
// lands when atkT runs down to the commit point; a dodge roll before that cancels it (mana and cooldown are given back).
// All damage goes through SkillSystem.hit (one place to route into the shared damage pipeline).
import { DT, KNOCKBACK_DECAY, MAP_H, MAP_W, PLAYER_RADIUS } from "../shared/constants";
import {
  GEM_DROPS,
  GEM_MAX_LEVEL,
  GEM_PITY,
  GEM_PITY_MIN_LEVEL,
  MAX_EQUIPPED_SKILLS,
  META_ENERGY,
  ROUGH_NAMES,
  ROUGH_SKILL,
  ROUGH_SPIRIT,
  ROUGH_SUPPORT,
  SKILL_GEM_BY_ID,
  SKILL_GEM_PREFIX,
  SKILL_GEMS,
  SUPPORT_GEM_BY_ID,
  SUPPORT_GEM_PREFIX,
  SUPPORT_GEMS,
  SUPPORT_MAX_TIER,
} from "../shared/content/gems";
import type { Item } from "../shared/items";
import { blocksProjectile, forObstaclesNear } from "../shared/map";
import type { GameEvent, Phase } from "../shared/protocol";
import {
  BAR_SIZE,
  BASIC_ARROW,
  barSkillIds,
  computeSkill,
  cutOptions,
  effectiveSlot,
  emptyBar,
  isRangedWeapon,
  isRough,
  isSkillGem,
  isSupportGem,
  metaRefusal,
  skillDefOf,
  slotLabel,
  socketCount,
  supportDefOf,
  supportRefusal,
  upgradeRefusal,
  weaponOf,
  type Attrs,
  type BarMsg,
  type BarSlot,
  type CdMsg,
  type SkillAction,
  type SkillFx,
} from "../shared/skills";
import type { Stats } from "../shared/stats";
import type { CombatHost } from "./combat";
import { defenceHooks, hitMonster, hitPlayer, type DamageMap, type HitForm, type HitSpec } from "./damage";
import type { Monster } from "./monsters";
import { progAfterHit, progHitMult } from "./progression";
import type { ServerPlayer } from "./player";

const KB_FACTOR = Math.exp(-KNOCKBACK_DECAY * DT);
const TOTEM_RADIUS = 14;
const ARROW_RADIUS = 6;

// ---- per-player state -----------------------------------------------------------

interface Pending {
  act: SkillAction;
  slot: number;
  angle: number;
  hitAt: number; // lands when atkT <= hitAt
  tx: number;
  ty: number;
  n?: number; // spin: hits already dealt
}

export interface SkillState {
  mana: number;
  bar: BarSlot[];
  cds: number[]; // seconds left per slot
  pending: Pending | null;
  useMove: number | null; // swingMoveMult override while a skill is in use
  buff: { t: number; more: number; move: number } | null;
  guard: { t: number; less: number } | null; // Bulwark Stance: less damage taken, no knockback
  ramp: { slot: number; n: number; t: number } | null; // held ramping skill: consecutive uses, grace time left
  on: Set<number>; // switched-on aura / meta slots
  energy: number[]; // meta energy per slot
  prevHeld: number | undefined; // last held slot (toggles fire on a fresh press only)
  lastX: number;
  lastY: number;
  wasAlive: boolean;
  out: (BarMsg | CdMsg)[]; // private messages for this client
  nagT: number; // toast rate limit
  gemKills: number; // monster kills this match (guaranteed early crystals, GEM_PITY)
  hinted: Set<string>; // one-time "what to do with this gem" toasts shown this match
}

export function newSkillState(): SkillState {
  return {
    mana: 0, bar: emptyBar(), cds: new Array(BAR_SIZE).fill(0), pending: null, useMove: null, buff: null, guard: null, ramp: null,
    on: new Set(), energy: new Array(BAR_SIZE).fill(0), prevHeld: undefined, lastX: 0, lastY: 0, wasAlive: false, out: [], nagT: 0,
    gemKills: 0, hinted: new Set(),
  };
}

/** Attribute lookup (progression); set by SkillSystem so applySkillStatus can use it too. */
let attrsOf: (p: ServerPlayer) => Attrs | undefined = () => undefined;

function slotAction(p: ServerPlayer, slot: number): SkillAction {
  return computeSkill(effectiveSlot(p.sk.bar, slot, p.equip.mainhand), p.stats, weaponOf(p.equip.mainhand), !!p.equip.mainhand, attrsOf(p));
}

/** Status effects on top of gear stats (called from inventory.ts refreshStats). */
export function applySkillStatus(p: ServerPlayer, s: Stats) {
  const k = p.sk;
  if (!k) return;
  if (k.buff) {
    s.attackDamage *= 1 + k.buff.more;
    s.spellMult *= 1 + k.buff.more;
    s.moveSpeed *= 1 + k.buff.move;
  }
  for (const i of k.on) {
    const def = skillDefOf(k.bar[i]?.gem);
    if (!def?.aura) continue;
    const a = computeSkill(k.bar[i], s, weaponOf(p.equip.mainhand), !!p.equip.mainhand).aura;
    if (!a) continue;
    s.attackDamage *= 1 + a.more;
    s.spellMult *= 1 + a.more;
    s.moveSpeed *= 1 + a.move;
    s.lifeRegen += a.regen;
  }
  if (k.guard) s.moveSpeed *= GUARD_MOVE;
  if (k.useMove !== null) s.swingMoveMult = k.useMove;
}

/** Movement multiplier while a guard is up. */
const GUARD_MOVE = 0.65;
// Guard (Bulwark Stance): one hook into the shared damage pipeline for every hit on a guarding player.
defenceHooks.push({
  takenMult: (p) => (p.sk?.guard ? 1 - p.sk.guard.less : 1),
  kbMult: (p) => (p.sk?.guard ? 0 : 1),
});

/** Messages for one client this tick (bar contents, cooldown starts, meta energy). */
export function takeSkillMsgs(p: ServerPlayer): (BarMsg | CdMsg)[] {
  const o = p.sk.out;
  p.sk.out = [];
  return o;
}

/** A reconnected client: forget queued private messages and send the whole bar again. */
export function resendBar(p: ServerPlayer) {
  p.sk.out = [barMsg(p)];
}

/** Mana for the snapshot (rounded). */
export function manaOf(p: ServerPlayer): number {
  return Math.round(p.sk.mana * 10) / 10;
}

/** Strip every gem from the bar (death / leaving: full loot). */
export function stripBar(p: ServerPlayer): Item[] {
  const out: Item[] = [];
  for (const s of p.sk.bar) {
    if (s.gem) out.push(s.gem);
    if (s.inner) out.push(s.inner);
    for (const g of s.sups) if (g) out.push(g);
  }
  p.sk.bar = emptyBar();
  p.sk.pending = null;
  p.sk.on.clear();
  p.sk.energy.fill(0);
  p.sk.out.push(barMsg(p));
  return out;
}

const barMsg = (p: ServerPlayer): BarMsg => ({ t: "bar", bar: p.sk.bar, on: [...p.sk.on] });

// ---- gem items ------------------------------------------------------------------

let nextGemId = 1_000_000_000; // separate id range from loot.ts items

const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const clampLv = (v: number) => Math.max(1, Math.min(GEM_MAX_LEVEL, Math.round(v)));

export function makeSkillGem(id: string, level: number): Item {
  const def = SKILL_GEM_BY_ID.get(id)!;
  return { id: nextGemId++, b: SKILL_GEM_PREFIX + id, r: 0, l: clampLv(level), n: def.name, m: [] } as Item;
}

export function makeSupportGem(id: string, tier = 1): Item {
  const def = SUPPORT_GEM_BY_ID.get(id)!;
  return { id: nextGemId++, b: SUPPORT_GEM_PREFIX + id, r: 0, l: Math.max(1, Math.min(SUPPORT_MAX_TIER, tier)), n: def.name, m: [] } as Item;
}

export function makeRough(kind: string, level: number): Item {
  return { id: nextGemId++, b: kind, r: 0, l: kind === ROUGH_SUPPORT ? Math.max(1, Math.min(SUPPORT_MAX_TIER, level)) : clampLv(level), n: ROUGH_NAMES[kind], m: [] } as Item;
}

/** Crystal level from monster level: about half the area level, so elites drop much better gems. */
export function gemLevelFor(ilvl: number): number {
  return clampLv(Math.ceil(ilvl / 2) + randInt(-1, 0));
}

function supportTierFor(source: "normal" | "elite"): number {
  const r = Math.random();
  return source === "elite" ? (r < 0.3 ? 3 : 2) : r < 0.2 ? 2 : 1;
}

/**
 * Gem drops for a monster kill: mostly rough crystals the player cuts, rarely a pre-cut gem.
 * `killer` adds the guaranteed early crystals (GEM_PITY) on that player's Nth kill of the match.
 */
export function rollGemDrops(source: "normal" | "elite", ilvl: number, killer?: ServerPlayer): Item[] {
  const t = GEM_DROPS[source];
  const out: Item[] = [];
  if (killer?.sk) {
    const n = ++killer.sk.gemKills;
    const has = (a: readonly number[]) => a.includes(n);
    if (has(GEM_PITY.skill)) out.push(makeRough(ROUGH_SKILL, Math.max(GEM_PITY_MIN_LEVEL, gemLevelFor(ilvl))));
    if (has(GEM_PITY.support)) out.push(makeRough(ROUGH_SUPPORT, 1));
    if (has(GEM_PITY.spirit)) out.push(makeRough(ROUGH_SPIRIT, gemLevelFor(ilvl)));
  }
  for (const c of t.skill) if (Math.random() < c) out.push(makeRough(ROUGH_SKILL, gemLevelFor(ilvl)));
  for (const c of t.support) if (Math.random() < c) out.push(makeRough(ROUGH_SUPPORT, supportTierFor(source)));
  for (const c of t.spirit) if (Math.random() < c) out.push(makeRough(ROUGH_SPIRIT, gemLevelFor(ilvl)));
  for (const c of t.precut) {
    if (Math.random() >= c) continue;
    if (Math.random() < 0.5) out.push(makeSupportGem(pick(SUPPORT_GEMS).id, supportTierFor(source)));
    else {
      const lv = gemLevelFor(ilvl);
      const ok = SKILL_GEMS.filter((d) => d.tier > 0 && d.tier <= lv);
      out.push(makeSkillGem(pick(ok.length ? ok : SKILL_GEMS.filter((d) => d.tier === 1)).id, lv));
    }
  }
  return out;
}

/** Starting skill per weapon kind (socketed on RMB at the start of every match). */
const STARTER_SKILL: Record<string, string> = {
  sword: "sundering_blow",
  axe: "sundering_blow",
  mace: "sundering_blow",
  spear: "splinter_volley",
  dagger: "splinter_volley",
  claw: "sundering_blow",
  bow: "splinter_volley",
  crossbow: "splinter_volley",
  staff: "cinderbolt",
  quarterstaff: "sundering_blow",
  wand: "cinderbolt",
  sceptre: "cinderbolt",
};

/** Fresh match kit: empty bar plus one starter skill on RMB, full mana. */
export function resetSkills(p: ServerPlayer) {
  const k = p.sk;
  k.bar = emptyBar();
  k.cds.fill(0);
  k.pending = null;
  k.useMove = null;
  k.buff = null;
  k.guard = null;
  k.ramp = null;
  k.on.clear();
  k.energy.fill(0);
  k.gemKills = 0;
  k.hinted.clear();
  const wk = p.equip.mainhand ? weaponOf(p.equip.mainhand).kind : "";
  const sk = STARTER_SKILL[wk] ?? "cinderbolt";
  k.bar[2].gem = makeSkillGem(sk, 1);
  k.bar[2].sups = new Array(socketCount(k.bar[2].gem)).fill(null);
  k.mana = p.stats.maxMana;
  k.out.push(barMsg(p));
}

// ---- system -----------------------------------------------------------------------

export interface SkillHost extends CombatHost {
  players: Map<number, ServerPlayer>;
  phase: Phase;
  toast(p: ServerPlayer, text: string): void;
  dropItem(item: Item, x: number, y: number, spread?: number): void;
}

interface Proj {
  id: number;
  owner: ServerPlayer;
  s: string; // skill id ("" = basic arrow)
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
  dmg: number;
  kb: number;
  act: SkillAction;
  chain: number;
  burst: number; // explosion radius on impact (0 = none)
  hit: Set<string>;
  pierce: boolean;
  back: 0 | 1 | 2; // returning projectile: 0 = does not return, 1 = flying out, 2 = flying back
}

/** Ground effect: a delayed blast (strikes when t runs out) or a trap (armed when t runs out, then waits for an enemy). */
interface Zone {
  id: number;
  owner: ServerPlayer;
  s: string;
  kind: "blast" | "trap";
  x: number;
  y: number;
  t: number; // blast: time to the strike; trap: time until armed
  life: number; // trap: time left once placed
  act: SkillAction;
  follow: boolean; // blast lands on the owner (leap landing)
}

interface Totem {
  id: number;
  owner: ServerPlayer;
  s: string;
  x: number;
  y: number;
  t: number;
  cd: number;
  act: SkillAction;
}

type Target = { kind: "m"; m: Monster } | { kind: "p"; p: ServerPlayer };
const tx = (t: Target) => (t.kind === "m" ? t.m.x : t.p.x);
const ty = (t: Target) => (t.kind === "m" ? t.m.y : t.p.y);
const tr = (t: Target) => (t.kind === "m" ? t.m.radius : PLAYER_RADIUS);
const tkey = (t: Target) => (t.kind === "m" ? "m:" + t.m.id : "p:" + t.p.id);

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True if a body of radius r cannot stand at (x, y): map edge or any obstacle, water edges included. For shots use blocksProjectile. */
function blocked(x: number, y: number, r: number): boolean {
  if (x < r || y < r || x > MAP_W - r || y > MAP_H - r) return true;
  let hit = false;
  forObstaclesNear(x, y, r, (o) => {
    const dx = o.x - x;
    const dy = o.y - y;
    if (dx * dx + dy * dy < (o.r + r) ** 2) return (hit = true);
  });
  return hit;
}

/** Seconds between a leap's take-off and its landing blast (the knockback-style travel is nearly over by then). */
const LEAP_AIR = 0.3;

/** A returning projectile homes on its thrower; true when its heading changed enough to tell the clients. */
function steerHome(pr: Proj): boolean {
  const sp = Math.hypot(pr.vx, pr.vy);
  const want = Math.atan2(pr.owner.y - pr.y, pr.owner.x - pr.x);
  const d = angleDiff(want, Math.atan2(pr.vy, pr.vx));
  pr.life = Math.max(pr.life, Math.hypot(pr.owner.x - pr.x, pr.owner.y - pr.y) / sp + 0.1);
  if (Math.abs(d) < 0.12) return false;
  pr.vx = Math.cos(want) * sp;
  pr.vy = Math.sin(want) * sp;
  return true;
}

const SYSTEMS = new WeakMap<object, SkillSystem>();

/** Basic attack of a ranged weapon: fires an arrow at the commit point. Returns false for melee weapons. */
export function fireRangedBasic(host: CombatHost, p: ServerPlayer): boolean {
  const sys = SYSTEMS.get(host);
  if (!sys) return false;
  return sys.fireRangedBasic(p);
}

type AutoPlace = (p: ServerPlayer, it: Item) => boolean;

export class SkillSystem {
  projs: Proj[] = [];
  totems: Totem[] = [];
  zones: Zone[] = [];
  private nextId = 1;

  constructor(
    private host: SkillHost,
    private refresh: (p: ServerPlayer) => void,
    attrs?: (p: ServerPlayer) => Attrs | undefined,
  ) {
    SYSTEMS.set(host, this);
    if (attrs) attrsOf = attrs;
  }

  private fx(f: SkillFx) {
    this.host.events.push({ k: "fx", f } as unknown as GameEvent);
  }

  private combatOn() {
    return this.host.phase === "waiting" || this.host.phase === "fight";
  }

  private nag(p: ServerPlayer, text: string) {
    if (p.sk.nagT > 0) return;
    p.sk.nagT = 0.8;
    this.host.toast(p, text);
  }

  private reserved(p: ServerPlayer, except = -1): number {
    let r = 0;
    for (const i of p.sk.on) if (i !== except) r += skillDefOf(p.sk.bar[i]?.gem)?.spirit ?? 0;
    return r;
  }

  private setOn(p: ServerPlayer, slot: number, on: boolean) {
    const k = p.sk;
    if (on === k.on.has(slot)) return;
    if (on) k.on.add(slot);
    else {
      k.on.delete(slot);
      k.energy[slot] = 0;
    }
    const id = skillDefOf(k.bar[slot]?.gem)?.id ?? "";
    this.fx({ e: "aura", p: p.id, s: id, on: on ? 1 : 0 });
    k.out.push(barMsg(p));
    this.refresh(p);
  }

  // ---- input --------------------------------------------------------------------

  /** After each simulated input: land/cancel the pending skill, then try the held slot. */
  afterInput(p: ServerPlayer, held: number | undefined) {
    this.stepPending(p);
    const fresh = held !== p.sk.prevHeld;
    p.sk.prevHeld = held;
    if (held !== undefined) this.tryUse(p, held, fresh);
  }

  tryUse(p: ServerPlayer, slot: unknown, fresh = true): boolean {
    if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot >= BAR_SIZE) return false;
    const k = p.sk;
    if (!p.alive || !p.joined || !this.combatOn()) return false;
    const bs = effectiveSlot(k.bar, slot, p.equip.mainhand);
    if (!bs?.gem) return false; // empty slot (LMB without a gem is the basic attack, handled by the sim)
    if (k.cds[slot] > 0) return false;
    const act = slotAction(p, slot);
    if (act.kind === "aura" || act.kind === "meta") {
      if (!fresh) return false; // toggles fire once per press
      k.cds[slot] = 0.5;
      if (k.on.has(slot)) {
        this.setOn(p, slot, false);
        return true;
      }
      if (act.kind === "meta" && !act.inner) {
        this.nag(p, `${act.name}: socket a spell into it first`);
        return false;
      }
      if (this.reserved(p) + act.spirit > p.stats.spirit) {
        this.nag(p, `Not enough Spirit: ${act.name} reserves ${act.spirit}, you have ${Math.max(0, p.stats.spirit - this.reserved(p))} free (Spirit comes at levels 3, 8 and 14, and from gear)`);
        return false;
      }
      this.setOn(p, slot, true);
      return true;
    }
    if (k.pending || p.atkCd > 0 || p.rollT > 0) return false;
    if (!act.ok) {
      this.nag(p, `${act.name}: ${act.why}`);
      return false;
    }
    if (k.mana + 1e-9 < act.cost) {
      this.nag(p, "Not enough mana");
      return false;
    }
    k.mana -= act.cost;
    if (act.ramp) {
      // Held ramp (Galeshot Barrage): each use started right after the last one is quicker.
      const n = k.ramp && k.ramp.slot === slot ? k.ramp.n + 1 : 0;
      act.time = Math.max(0.12, act.time * Math.max(act.ramp.min, Math.pow(1 - act.ramp.step, n)));
      k.ramp = { slot, n, t: act.time + 0.2 };
    } else k.ramp = null;
    if (act.cd > 0) {
      k.cds[slot] = act.cd;
      k.out.push({ t: "skcd", s: slot, cd: Math.round(act.cd * 100) / 100 });
    }
    // Commit: the player is locked into the skill (facing, slowed movement) for its use time.
    p.atkT = act.time;
    p.atkCd = act.time;
    k.useMove = act.move;
    this.refresh(p);
    const pe = this.aim(p, act, slot, act.time * (1 - act.commit));
    k.pending = pe;
    this.fx({
      e: "cast", p: p.id, s: act.id, x: Math.round(p.x), y: Math.round(p.y), a: Math.round(p.angle * 100) / 100, t: Math.round(act.time * 100) / 100,
      ...(act.kind === "slam" || act.kind === "totem" || act.kind === "leap" || act.kind === "blast" || act.kind === "trap"
        ? { tx: Math.round(pe.tx), ty: Math.round(pe.ty), r: Math.round(act.kind === "totem" ? TOTEM_RADIUS : act.kind === "trap" ? (act.zone?.trig ?? 30) : act.radius) }
        : act.kind === "strike" || act.kind === "cone"
          ? { r: Math.round(act.reach) }
          : act.kind === "spin"
            ? { r: Math.round(act.radius) }
            : {}),
    });
    this.stepPending(p);
    return true;
  }

  private aim(p: ServerPlayer, act: SkillAction, slot: number, hitAt: number): Pending {
    const ca = Math.cos(p.angle);
    const sa = Math.sin(p.angle);
    let tX = p.x + ca * act.reach;
    let tY = p.y + sa * act.reach;
    if (act.kind === "totem" && act.totem) {
      // Step back from the aim point until the effigy fits.
      let d = act.totem.place;
      while (d > 0 && blocked(p.x + ca * d, p.y + sa * d, TOTEM_RADIUS)) d -= 10;
      tX = p.x + ca * Math.max(0, d);
      tY = p.y + sa * Math.max(0, d);
    }
    if ((act.kind === "blast" || act.kind === "trap") && act.zone) {
      // The mark lands `place` ahead, or just short of the first wall in the way.
      let d = 0;
      while (d + 10 <= act.zone.place && !blocksProjectile(p.x + ca * (d + 10), p.y + sa * (d + 10), 4)) d += 10;
      tX = p.x + ca * d;
      tY = p.y + sa * d;
    }
    if (act.kind === "leap") {
      const d = this.dashDist(p, ca, sa, act.speed);
      tX = p.x + ca * d;
      tY = p.y + sa * d;
    }
    return { act, slot, angle: p.angle, hitAt, tx: tX, ty: tY };
  }

  private stepPending(p: ServerPlayer) {
    const k = p.sk;
    const pe = k.pending;
    if (!pe) return;
    if (!p.alive || p.rollT > 0) {
      // Rolled out of the wind-up: cancelled. Nothing has landed yet, so the mana and the cooldown come back
      // (the price of the cancel is the roll and the time already spent, not the skill).
      if (p.alive && pe.n === undefined) {
        k.mana = Math.min(p.stats.maxMana, k.mana + pe.act.cost);
        if (pe.act.cd > 0) {
          k.cds[pe.slot] = 0;
          k.out.push({ t: "skcd", s: pe.slot, cd: 0 });
        }
      }
      k.pending = null;
      return;
    }
    if (p.atkT > pe.hitAt + 1e-9) return;
    k.pending = null;
    if (this.combatOn()) this.execute(p, pe);
    if (pe.act.kind === "spin") {
      // The whirl keeps cutting: the remaining hits are spread evenly up to 92% of the use time.
      const hits = Math.max(1, pe.act.count);
      const n = (pe.n ?? 0) + 1;
      if (n < hits) {
        const frac = pe.act.commit + ((0.92 - pe.act.commit) * n) / (hits - 1);
        k.pending = { ...pe, n, hitAt: pe.act.time * (1 - frac) };
      }
    }
  }

  /** How far a body can travel from p along (ca, sa), up to `max`, before something solid. */
  private dashDist(p: ServerPlayer, ca: number, sa: number, max: number): number {
    let d = 0;
    while (d + 8 <= max && !blocked(p.x + ca * (d + 8), p.y + sa * (d + 8), PLAYER_RADIUS)) d += 8;
    return d;
  }

  // ---- execution ----------------------------------------------------------------------

  private targets(owner: ServerPlayer): Target[] {
    const out: Target[] = [];
    for (const m of this.host.monsters.monsters.values()) if (m.alive) out.push({ kind: "m", m });
    for (const o of this.host.players.values()) if (o !== owner && o.joined && o.alive) out.push({ kind: "p", p: o });
    return out;
  }

  private execute(p: ServerPlayer, pe: Pending) {
    const a = pe.act;
    const ang = pe.angle;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    switch (a.kind) {
      case "strike":
      case "cone": {
        for (const t of this.targets(p)) {
          const dx = tx(t) - p.x;
          const dy = ty(t) - p.y;
          const d = Math.hypot(dx, dy);
          if (d > a.reach + tr(t)) continue;
          if (d > Math.max(PLAYER_RADIUS, tr(t)) && Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > a.arc / 2) continue;
          this.hit(p, t, a.dmg, p.x, p.y, a.kb, a);
        }
        this.fx({ e: "land", p: p.id, s: a.id, x: Math.round(p.x), y: Math.round(p.y), a: Math.round(ang * 100) / 100, r: Math.round(a.reach), arc: Math.round(a.arc * 100) / 100 });
        break;
      }
      case "slam": {
        for (const t of this.targets(p)) {
          if (Math.hypot(tx(t) - pe.tx, ty(t) - pe.ty) <= a.radius + tr(t) * 0.5) this.hit(p, t, a.dmg, pe.tx, pe.ty, a.kb, a);
        }
        this.fx({ e: "land", p: p.id, s: a.id, x: Math.round(pe.tx), y: Math.round(pe.ty), a: Math.round(ang * 100) / 100, r: Math.round(a.radius) });
        break;
      }
      case "volley":
      case "bolt": {
        const n = Math.max(1, a.count);
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * a.spread;
          this.spawnProj(p, a, p.x + ca * (PLAYER_RADIUS + 4), p.y + sa * (PLAYER_RADIUS + 4), ang + off, a.kind === "bolt" ? 9 : a.returns ? 11 : ARROW_RADIUS, a.kind === "bolt" && !a.pierce ? 42 : 0);
        }
        break;
      }
      case "chain": {
        const all = this.targets(p);
        const hit = new Set<string>();
        const pts = [Math.round(p.x), Math.round(p.y)];
        // First target: nearest enemy within reach near the aim direction.
        let best: Target | null = null;
        let bd = Infinity;
        for (const t of all) {
          const dx = tx(t) - p.x;
          const dy = ty(t) - p.y;
          const d = Math.hypot(dx, dy);
          if (d > a.reach + tr(t)) continue;
          const off = Math.abs(angleDiff(Math.atan2(dy, dx), ang));
          if (off > 0.6) continue;
          const score = d * (1 + off);
          if (score < bd) {
            bd = score;
            best = t;
          }
        }
        if (!best) {
          // Fizzle: a short spark toward the aim.
          let d = a.reach * 0.6;
          while (d > 20 && blocked(p.x + ca * d, p.y + sa * d, 2)) d -= 15;
          pts.push(Math.round(p.x + ca * d), Math.round(p.y + sa * d));
          this.fx({ e: "chain", s: a.id, pts });
          break;
        }
        let cur: Target | null = best;
        for (let n = 0; cur && n < a.count; n++) {
          hit.add(tkey(cur));
          pts.push(Math.round(tx(cur)), Math.round(ty(cur)));
          const cx = tx(cur);
          const cy = ty(cur);
          this.hit(p, cur, a.dmg, pts[pts.length - 4], pts[pts.length - 3], a.kb, a);
          let next: Target | null = null;
          let nd = a.radius;
          for (const t of all) {
            if (hit.has(tkey(t))) continue;
            if (t.kind === "m" && !t.m.alive) continue;
            if (t.kind === "p" && !t.p.alive) continue;
            const d = Math.hypot(tx(t) - cx, ty(t) - cy);
            if (d < nd) {
              nd = d;
              next = t;
            }
          }
          cur = next;
        }
        this.fx({ e: "chain", s: a.id, pts });
        break;
      }
      case "spin": {
        // One turn of the whirl: everything within the blade's sweep, all around the user.
        for (const t of this.targets(p)) {
          if (Math.hypot(tx(t) - p.x, ty(t) - p.y) <= a.radius + tr(t)) this.hit(p, t, a.dmg, p.x, p.y, a.kb, a);
        }
        this.fx({ e: "land", p: p.id, s: a.id, x: Math.round(p.x), y: Math.round(p.y), a: Math.round(ang * 100) / 100, r: Math.round(a.radius) });
        break;
      }
      case "leap": {
        const d = this.dashDist(p, ca, sa, a.speed);
        const v = d / (DT / (1 - KB_FACTOR));
        p.kbx = ca * v;
        p.kby = sa * v;
        this.fx({ e: "dash", p: p.id, x0: Math.round(p.x), y0: Math.round(p.y), x1: Math.round(p.x + ca * d), y1: Math.round(p.y + sa * d) });
        // The slam lands where the user actually ends up, a moment later.
        this.zones.push({ id: this.nextId++, owner: p, s: a.id, kind: "blast", x: p.x + ca * d, y: p.y + sa * d, t: LEAP_AIR, life: 0, act: a, follow: true });
        break;
      }
      case "blast": {
        if (!a.zone) break;
        const z: Zone = { id: this.nextId++, owner: p, s: a.id, kind: "blast", x: pe.tx, y: pe.ty, t: a.zone.delay, life: 0, act: a, follow: false };
        this.zones.push(z);
        this.fx({ e: "zone", id: z.id, s: a.id, x: Math.round(z.x), y: Math.round(z.y), r: Math.round(a.radius), t: a.zone.delay });
        break;
      }
      case "trap": {
        if (!a.zone) break;
        // Over the cap: the oldest snare of this player fizzles.
        const mine = this.zones.filter((z) => z.kind === "trap" && z.owner === p);
        for (let i = 0; i <= mine.length - a.zone.max; i++) mine[i].life = 0;
        const z: Zone = { id: this.nextId++, owner: p, s: a.id, kind: "trap", x: pe.tx, y: pe.ty, t: a.zone.delay, life: a.zone.dur, act: a, follow: false };
        this.zones.push(z);
        this.fx({ e: "zone", id: z.id, s: a.id, x: Math.round(z.x), y: Math.round(z.y), r: Math.round(a.zone.trig), t: a.zone.delay, dur: Math.round(a.zone.dur * 10) / 10 });
        break;
      }
      case "guard": {
        if (!a.guard) break;
        p.sk.guard = { t: a.guard.dur, less: a.guard.less };
        this.refresh(p);
        this.fx({ e: "guard", p: p.id, s: a.id, dur: Math.round(a.guard.dur * 10) / 10 });
        break;
      }
      case "dash": {
        const d = this.dashDist(p, ca, sa, a.speed);
        // kb decays geometrically in the sim: total travel = v * DT / (1 - KB_FACTOR).
        const v = d / (DT / (1 - KB_FACTOR));
        p.kbx = ca * v;
        p.kby = sa * v;
        this.fx({ e: "dash", p: p.id, x0: Math.round(p.x), y0: Math.round(p.y), x1: Math.round(p.x + ca * d), y1: Math.round(p.y + sa * d) });
        break;
      }
      case "buff": {
        if (!a.buff) break;
        p.sk.buff = { t: a.buff.dur, more: a.buff.more, move: a.buff.move };
        this.refresh(p);
        this.fx({ e: "buff", p: p.id, s: a.id, dur: Math.round(a.buff.dur * 10) / 10 });
        break;
      }
      case "totem": {
        if (!a.totem) break;
        for (const t of this.totems) if (t.owner === p) t.t = 0; // one effigy per player
        const tt: Totem = { id: this.nextId++, owner: p, s: a.id, x: pe.tx, y: pe.ty, t: a.totem.dur, cd: 0.35, act: a };
        this.totems.push(tt);
        this.fx({ e: "totem", id: tt.id, s: a.id, x: Math.round(tt.x), y: Math.round(tt.y), dur: Math.round(a.totem.dur * 10) / 10 });
        break;
      }
    }
  }

  fireRangedBasic(p: ServerPlayer): boolean {
    const w = weaponOf(p.equip.mainhand);
    if (!p.equip.mainhand || !isRangedWeapon(w)) return false;
    const a = computeSkill(null, p.stats, w, true);
    const ca = Math.cos(p.angle);
    const sa = Math.sin(p.angle);
    a.speed = BASIC_ARROW.speed;
    a.range = BASIC_ARROW.range;
    this.spawnProj(p, a, p.x + ca * (PLAYER_RADIUS + 4), p.y + sa * (PLAYER_RADIUS + 4), p.angle, ARROW_RADIUS, 0);
    return true;
  }

  private spawnProj(owner: ServerPlayer, a: SkillAction, x: number, y: number, ang: number, r: number, burst: number, s = a.id) {
    const speed = a.speed || 600;
    const pr: Proj = {
      id: this.nextId++, owner, s, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: (a.range || 500) / speed, r,
      dmg: a.dmg, kb: a.kb, act: a, chain: a.chain, burst, hit: new Set(), pierce: !!a.pierce, back: a.returns ? 1 : 0,
    };
    this.projs.push(pr);
    this.projFx(pr);
  }

  private projFx(pr: Proj) {
    this.fx({ e: "proj", id: pr.id, s: pr.s, x: Math.round(pr.x), y: Math.round(pr.y), vx: Math.round(pr.vx), vy: Math.round(pr.vy), life: Math.round(pr.life * 100) / 100 });
  }

  /** Apply one hit through the shared damage pipeline (server/damage.ts). Returns true if it connected. */
  private hit(owner: ServerPlayer, t: Target, dmg: number, fromX: number, fromY: number, kb: number, a: SkillAction): boolean {
    if (t.kind === "p" ? !t.p.alive : !t.m.alive) return false;
    dmg *= progHitMult(owner, t.kind === "p" ? { p: t.p } : { m: t.m }); // passives / ascendancies
    const ty = a.elem; // the skill's own element; burn / chill supports don't convert the hit
    const dm: DamageMap = ty === "fire" ? { fire: dmg } : ty === "cold" ? { cold: dmg } : ty === "lightning" ? { light: dmg } : { phys: dmg };
    const form: HitForm = a.kind === "basic" ? (a.tags.includes("projectile") ? "proj" : "melee") : a.kind === "volley" || a.kind === "bolt" ? (a.attack ? "proj" : "spell") : a.attack ? (a.kind === "slam" || a.kind === "leap" ? "area" : "melee") : a.kind === "cone" || a.kind === "blast" || a.kind === "trap" ? "area" : "spell";
    const ail: HitSpec["ail"] = {};
    if (a.ignite > 0) ail.ignite = 1 + a.ignite * 2;
    if (a.chill > 0) ail.chill = 1 + a.chill;
    // Burn / chill payoffs run in the shared ailment pipeline (server/damage.ts), one set of rules.
    const force: HitSpec["force"] = a.ignite > 0 || a.chill > 0 ? { ignitePct: a.ignite > 0 ? a.ignite : undefined, chillDur: a.chill > 0 ? a.chill : undefined } : undefined;
    const h: HitSpec = { dmg: dm, by: owner, source: a.name || owner.name, form, x: fromX, y: fromY, kb, ail, force };
    let dealt = 0;
    if (t.kind === "p") {
      const r = hitPlayer(this.host, t.p, h);
      if (r.outcome !== "hit") return r.outcome !== "dodged";
      dealt = r.dealt;
    } else {
      const m = t.m;
      if (!m.alive) return false;
      const r = hitMonster(this.host, m, h);
      if (r.outcome !== "hit") return false;
      dealt = r.dealt;
    }
    if (a.leech > 0 && owner.alive && dealt > 0) owner.hp = Math.min(owner.stats.maxHp, owner.hp + dealt * a.leech);
    progAfterHit(owner, dealt, t.kind === "p" ? { p: t.p } : { m: t.m });
    return true;
  }

  // ---- per tick ----------------------------------------------------------------------

  update() {
    const players = [...this.host.players.values()].filter((p) => p.joined);
    for (const p of players) {
      const k = p.sk;
      k.nagT = Math.max(0, k.nagT - DT);
      for (let i = 0; i < BAR_SIZE; i++) if (k.cds[i] > 0) k.cds[i] = Math.max(0, k.cds[i] - DT);
      if (p.alive && !k.wasAlive) k.mana = p.stats.maxMana; // (re)spawned: full mana
      k.wasAlive = p.alive;
      const moved = Math.hypot(p.x - k.lastX, p.y - k.lastY);
      k.lastX = p.x;
      k.lastY = p.y;
      if (!p.alive) {
        k.pending = null;
        k.guard = null;
        k.ramp = null;
        continue;
      }
      if (this.host.phase !== "countdown") k.mana = Math.min(p.stats.maxMana, k.mana + p.stats.manaRegen * DT);
      if (k.mana > p.stats.maxMana) k.mana = p.stats.maxMana;
      // Lost Spirit (gear swapped): switch everything off.
      if (k.on.size && this.reserved(p) > p.stats.spirit) {
        for (const i of [...k.on]) this.setOn(p, i, false);
        this.nag(p, "Not enough Spirit: persistent skills switched off");
      }
      // Meta gems: rolling builds energy; full energy fires the socketed spell.
      if (p.rollT > 0 && moved > 0 && moved < 200) {
        for (const i of k.on) {
          const act = slotAction(p, i);
          if (act.kind !== "meta" || !act.meta || !act.inner) continue;
          const before = k.energy[i];
          k.energy[i] = Math.min(META_ENERGY, k.energy[i] + moved * act.meta.perDist);
          if (Math.floor(k.energy[i] / 10) !== Math.floor(before / 10)) k.out.push({ t: "skcd", s: i, cd: 0, en: Math.round(k.energy[i]) });
          if (k.energy[i] >= META_ENERGY && this.combatOn()) {
            k.energy[i] = 0;
            k.out.push({ t: "skcd", s: i, cd: 0, en: 0 });
            this.fx({ e: "meta", p: p.id, s: act.inner.id });
            this.execute(p, this.aim(p, act.inner, i, 0));
          }
        }
      }
      let changed = false;
      if (k.useMove !== null && p.atkT <= 0 && !k.pending) {
        k.useMove = null;
        changed = true;
      }
      if (k.buff && (k.buff.t -= DT) <= 0) {
        k.buff = null;
        changed = true;
      }
      if (k.guard && (k.guard.t -= DT) <= 0) {
        k.guard = null;
        changed = true;
      }
      if (k.ramp && (k.ramp.t -= DT) <= 0) k.ramp = null;
      if (changed) this.refresh(p);
    }
    this.updateProjs();
    this.updateTotems();
    this.updateZones();
    this.updateStatuses();
  }

  private updateProjs() {
    const keep: Proj[] = [];
    for (const pr of this.projs) {
      let alive = true;
      const steps = Math.max(1, Math.ceil((Math.hypot(pr.vx, pr.vy) * DT) / 12));
      for (let s = 0; s < steps && alive; s++) {
        pr.x += (pr.vx * DT) / steps;
        pr.y += (pr.vy * DT) / steps;
        pr.life -= DT / steps;
        // Shots fly over water and stop at walls and props, the same rule as monster shots.
        if (pr.back === 2 && Math.hypot(pr.owner.x - pr.x, pr.owner.y - pr.y) < PLAYER_RADIUS + 10) {
          this.fx({ e: "pend", id: pr.id, x: Math.round(pr.x), y: Math.round(pr.y) }); // caught
          alive = false;
          break;
        }
        if (pr.back === 1 && (pr.life <= 0 || blocksProjectile(pr.x, pr.y, pr.r * 0.5)) && pr.owner.alive) {
          // Wheeling Glaive: turn around and fly back to the thrower, free to hit everything again.
          pr.back = 2;
          pr.hit.clear();
          const sp = Math.hypot(pr.vx, pr.vy);
          pr.x -= (pr.vx * DT) / steps;
          pr.y -= (pr.vy * DT) / steps;
          const ang = Math.atan2(pr.owner.y - pr.y, pr.owner.x - pr.x);
          pr.vx = Math.cos(ang) * sp;
          pr.vy = Math.sin(ang) * sp;
          pr.life = Math.hypot(pr.owner.x - pr.x, pr.owner.y - pr.y) / sp + 0.25;
          this.projFx(pr);
          break;
        }
        if (pr.life <= 0 || (pr.back !== 2 && blocksProjectile(pr.x, pr.y, pr.r * 0.5))) {
          if (pr.burst && pr.life > 0) this.burst(pr);
          this.fx({ e: "pend", id: pr.id, x: Math.round(pr.x), y: Math.round(pr.y), ...(pr.life > 0 ? { hit: 1 as const } : {}) });
          alive = false;
          break;
        }
        for (const t of this.targets(pr.owner)) {
          if (pr.hit.has(tkey(t))) continue;
          if (Math.hypot(tx(t) - pr.x, ty(t) - pr.y) > pr.r + tr(t)) continue;
          if (pr.burst) {
            this.burst(pr);
            // Chaining bolts (Arcing Link): burst, then fly on to the next enemy and burst again.
            pr.hit.add(tkey(t));
            if (pr.chain > 0 && this.redirect(pr, t)) {
              pr.chain--;
              break;
            }
            this.fx({ e: "pend", id: pr.id, x: Math.round(pr.x), y: Math.round(pr.y), hit: 1 });
            alive = false;
            break;
          }
          if (!this.hit(pr.owner, t, pr.dmg, pr.x - pr.vx * 0.05, pr.y - pr.vy * 0.05, pr.kb, pr.act)) continue; // dodged: flies on
          pr.hit.add(tkey(t));
          if (pr.chain > 0 && pr.back !== 2 && this.redirect(pr, t)) {
            pr.chain--;
            break;
          }
          if (pr.pierce) continue; // flies on through
          this.fx({ e: "pend", id: pr.id, x: Math.round(pr.x), y: Math.round(pr.y), hit: 1 });
          alive = false;
          break;
        }
      }
      if (alive && pr.back === 2 && steerHome(pr)) this.projFx(pr);
      if (alive) keep.push(pr);
    }
    this.projs = keep;
  }

  /** Chain: turn toward the nearest enemy not hit yet. */
  private redirect(pr: Proj, from: Target): boolean {
    let best: Target | null = null;
    let bd = 260;
    for (const t of this.targets(pr.owner)) {
      if (pr.hit.has(tkey(t)) || tkey(t) === tkey(from)) continue;
      const d = Math.hypot(tx(t) - pr.x, ty(t) - pr.y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    if (!best) return false;
    const sp = Math.hypot(pr.vx, pr.vy);
    const ang = Math.atan2(ty(best) - pr.y, tx(best) - pr.x);
    pr.vx = Math.cos(ang) * sp;
    pr.vy = Math.sin(ang) * sp;
    pr.life = Math.max(pr.life, 300 / sp);
    this.projFx(pr);
    return true;
  }

  private burst(pr: Proj) {
    for (const t of this.targets(pr.owner)) {
      if (pr.hit.has(tkey(t))) continue; // a chaining bolt never hits the same enemy twice
      if (Math.hypot(tx(t) - pr.x, ty(t) - pr.y) <= pr.burst + tr(t) && this.hit(pr.owner, t, pr.dmg, pr.x, pr.y, pr.kb, pr.act)) pr.hit.add(tkey(t));
    }
    this.fx({ e: "land", p: pr.owner.id, s: pr.s, x: Math.round(pr.x), y: Math.round(pr.y), a: 0, r: pr.burst });
  }

  private updateTotems() {
    const keep: Totem[] = [];
    for (const t of this.totems) {
      t.t -= DT;
      if (t.t <= 0 || !t.owner.alive || !t.owner.joined) {
        this.fx({ e: "tend", id: t.id });
        continue;
      }
      keep.push(t);
      t.cd -= DT;
      if (t.cd > 0 || !this.combatOn()) continue;
      let best: Target | null = null;
      let bd = t.act.radius;
      for (const g of this.targets(t.owner)) {
        const d = Math.hypot(tx(g) - t.x, ty(g) - t.y);
        if (d < bd) {
          bd = d;
          best = g;
        }
      }
      if (!best) continue;
      t.cd = t.act.totem?.rate ?? 0.8;
      const ang = Math.atan2(ty(best) - t.y, tx(best) - t.x);
      const n = Math.max(1, t.act.count);
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * t.act.spread;
        this.spawnProj(t.owner, t.act, t.x + Math.cos(ang) * 12, t.y + Math.sin(ang) * 12, ang + off, 7, 0, "pyre_shot");
      }
    }
    this.totems = keep;
  }

  /** Delayed blasts strike when their time runs out; armed traps go off under the first enemy that steps close. */
  private updateZones() {
    if (!this.zones.length) return;
    const keep: Zone[] = [];
    for (const z of this.zones) {
      const o = z.owner;
      if (!o.joined || (z.follow && !o.alive)) {
        if (!z.follow) this.fx({ e: "zend", id: z.id, s: z.s, x: Math.round(z.x), y: Math.round(z.y), r: 0 });
        continue;
      }
      z.t -= DT;
      if (z.kind === "blast") {
        if (z.t > 0) {
          keep.push(z);
          continue;
        }
        if (z.follow) {
          z.x = o.x;
          z.y = o.y;
        }
        this.zoneBlast(z);
        continue;
      }
      // trap
      z.life -= DT;
      if (z.life <= 0 || !o.alive) {
        this.fx({ e: "zend", id: z.id, s: z.s, x: Math.round(z.x), y: Math.round(z.y), r: 0 });
        continue;
      }
      let sprung = false;
      if (z.t <= 0 && this.combatOn()) {
        const trig = z.act.zone?.trig ?? 30;
        for (const t of this.targets(o)) {
          if (Math.hypot(tx(t) - z.x, ty(t) - z.y) <= trig + tr(t)) {
            sprung = true;
            break;
          }
        }
      }
      if (sprung) this.zoneBlast(z);
      else keep.push(z);
    }
    this.zones = keep;
  }

  private zoneBlast(z: Zone) {
    const a = z.act;
    if (this.combatOn()) {
      for (const t of this.targets(z.owner)) {
        if (Math.hypot(tx(t) - z.x, ty(t) - z.y) <= a.radius + tr(t) * 0.5) this.hit(z.owner, t, a.dmg, z.x, z.y, a.kb, a);
      }
    }
    if (z.follow) this.fx({ e: "land", p: z.owner.id, s: z.s, x: Math.round(z.x), y: Math.round(z.y), a: 0, r: Math.round(a.radius) });
    else this.fx({ e: "zend", id: z.id, s: z.s, x: Math.round(z.x), y: Math.round(z.y), r: Math.round(a.radius), hit: 1 });
  }

  /** Burns and chills now tick in server/damage.ts (damageTick); nothing left to update here. */
  private updateStatuses() {}

  // ---- socketing / cutting (client requests; all validated here) -------------------------

  private takeFromInv(p: ServerPlayer, id: unknown): Item | null {
    if (typeof id !== "number") return null;
    const i = p.inv.findIndex((e) => e.it.id === id);
    if (i < 0) return null;
    const it = p.inv[i].it;
    p.inv.splice(i, 1);
    p.invDirty = true;
    return it;
  }

  /** Put an item back into the grid (or at the player's feet if there's no room). */
  private give(p: ServerPlayer, it: Item, autoPlace: AutoPlace) {
    if (!autoPlace(p, it)) {
      this.host.dropItem(it, p.x, p.y, 20);
      this.host.toast(p, `No room: ${it.n} dropped`);
    }
    p.invDirty = true;
  }

  private slotChanged(p: ServerPlayer, slot: number) {
    if (p.sk.on.has(slot)) this.setOn(p, slot, false);
    p.sk.energy[slot] = 0;
    p.sk.out.push(barMsg(p));
    this.refresh(p);
  }

  /**
   * Socket a gem from the inventory grid:
   * - skill / spirit gem into a bar slot (`sup` and `inner` undefined),
   * - support gem into socket `sup` of the slot's skill,
   * - spell gem into the slot's meta gem (`inner` truthy).
   */
  socket(p: ServerPlayer, id: unknown, slot: unknown, sup: unknown, autoPlace: AutoPlace, inner?: unknown): string | null {
    if (!p.alive) return "You are dead";
    if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot >= BAR_SIZE) return "Bad slot";
    const entry = p.inv.find((e) => e.it.id === id);
    if (!entry) return "That gem isn't in your bag";
    const it = entry.it;
    const bs = p.sk.bar[slot];
    if (p.sk.pending?.slot === slot) return "That skill is in use";
    if (inner) {
      if (skillDefOf(bs.gem)?.kind !== "meta") return "Only meta gems hold a spell";
      const d = skillDefOf(it);
      if (!d) return "Not a skill gem";
      const why = metaRefusal(d);
      if (why) return why;
      const others = barSkillIds(p.sk.bar);
      const oldId = skillDefOf(bs.inner)?.id;
      if (oldId) others.splice(others.indexOf(oldId), 1);
      if (others.includes(d.id)) return `${d.name} is already on your bar`;
      if (others.length + 1 > MAX_EQUIPPED_SKILLS) return `At most ${MAX_EQUIPPED_SKILLS} skill gems`;
      this.takeFromInv(p, id);
      const old = bs.inner;
      bs.inner = it;
      if (old) this.give(p, old, autoPlace);
      this.dropInvalidSupports(p, bs, autoPlace);
      this.slotChanged(p, slot);
      return null;
    }
    if (sup === undefined || sup === null) {
      if (!isSkillGem(it)) return isSupportGem(it) ? "Support gems go into a skill's sockets" : isRough(it) ? "Cut the crystal first" : "Not a skill gem";
      const d = skillDefOf(it)!;
      const others = barSkillIds(p.sk.bar, slot);
      if (others.includes(d.id)) return `${d.name} is already on your bar`;
      if (others.length + 1 > MAX_EQUIPPED_SKILLS) return `At most ${MAX_EQUIPPED_SKILLS} skill gems`;
      this.takeFromInv(p, id);
      const old = bs.gem;
      bs.gem = it;
      if (bs.inner && d.kind !== "meta") {
        this.give(p, bs.inner, autoPlace);
        bs.inner = null;
      }
      this.dropInvalidSupports(p, bs, autoPlace);
      if (old) this.give(p, old, autoPlace);
      p.sk.cds[slot] = 0;
      this.slotChanged(p, slot);
      return null;
    }
    if (typeof sup !== "number" || !Number.isInteger(sup) || sup < 0) return "Bad socket";
    if (!isSupportGem(it)) return "Only support gems fit a skill's sockets";
    if (!bs.gem) return "Socket a skill gem in that slot first";
    if (sup >= socketCount(bs.gem)) return "That skill gem has no such socket";
    const target = skillDefOf(bs.gem)?.kind === "meta" ? skillDefOf(bs.inner) : skillDefOf(bs.gem);
    if (!target) return "Socket a spell into the meta gem first";
    const sd = supportDefOf(it)!;
    const others = bs.sups.filter((_, i) => i !== sup).map((s) => supportDefOf(s));
    const why = supportRefusal(sd, target, others);
    if (why) return why;
    // PoE2: each support only once across the whole character.
    const dupe = p.sk.bar.findIndex((o, i) => i !== slot && o.sups.some((g) => supportDefOf(g)?.id === sd.id));
    if (dupe >= 0) return `${sd.name} is already socketed in ${skillDefOf(p.sk.bar[dupe].gem)?.name ?? "another skill"} (one of each support)`;
    this.takeFromInv(p, id);
    while (bs.sups.length < socketCount(bs.gem)) bs.sups.push(null);
    const old = bs.sups[sup];
    bs.sups[sup] = it;
    if (old) this.give(p, old, autoPlace);
    this.slotChanged(p, slot);
    return null;
  }

  /** Re-fit the supports to the slot's (new) skill: invalid or extra ones go back to the bag. */
  private dropInvalidSupports(p: ServerPlayer, bs: BarSlot, autoPlace: AutoPlace) {
    const target = skillDefOf(bs.gem)?.kind === "meta" ? skillDefOf(bs.inner) : skillDefOf(bs.gem);
    const n = socketCount(bs.gem);
    const kept: (Item | null)[] = [];
    bs.sups.forEach((s, i) => {
      if (!s) return;
      const sd = supportDefOf(s)!;
      if (i < n && (!target || !supportRefusal(sd, target, kept.map((k) => supportDefOf(k))))) kept.push(s);
      else this.give(p, s, autoPlace);
    });
    bs.sups = [...kept, ...new Array(Math.max(0, n - kept.length)).fill(null)].slice(0, n);
  }

  /** Move a socketed gem back to the bag (a skill gem takes its supports with it). */
  unsocket(p: ServerPlayer, slot: unknown, sup: unknown, autoPlace: AutoPlace, inner?: unknown): string | null {
    if (!p.alive) return "You are dead";
    if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot >= BAR_SIZE) return "Bad slot";
    const bs = p.sk.bar[slot];
    if (p.sk.pending?.slot === slot) return "That skill is in use";
    if (inner) {
      if (!bs.inner) return "Empty";
      const it = bs.inner;
      bs.inner = null;
      this.give(p, it, autoPlace);
    } else if (sup === undefined || sup === null) {
      if (!bs.gem) return "Empty slot";
      const items = [bs.gem, ...(bs.inner ? [bs.inner] : []), ...bs.sups.filter((s): s is Item => !!s)];
      bs.gem = null;
      bs.inner = null;
      bs.sups = [];
      for (const it of items) this.give(p, it, autoPlace);
    } else {
      if (typeof sup !== "number" || !Number.isInteger(sup) || sup < 0 || sup >= bs.sups.length) return "Bad socket";
      const it = bs.sups[sup];
      if (!it) return "Empty socket";
      bs.sups[sup] = null;
      this.give(p, it, autoPlace);
    }
    this.slotChanged(p, slot);
    return null;
  }

  /**
   * Use a rough crystal from the bag: cut it into gem `gem` (in place in the grid), or raise the
   * level of the owned skill/spirit gem with item id `target` (bag or bar). The crystal is consumed.
   */
  cut(p: ServerPlayer, id: unknown, gem: unknown, target: unknown, autoPlace?: AutoPlace): string | null {
    if (!p.alive) return "You are dead";
    const entry = p.inv.find((e) => e.it.id === id);
    if (!entry || !isRough(entry.it)) return "That crystal isn't in your bag";
    const rough = entry.it;
    if (typeof target === "number") {
      let tgt: Item | null = p.inv.find((e) => e.it.id === target)?.it ?? null;
      let onBar = false;
      if (!tgt)
        for (const s of p.sk.bar) {
          if (s.gem?.id === target) tgt = s.gem;
          else if (s.inner?.id === target) tgt = s.inner;
          if (tgt) {
            onBar = true;
            break;
          }
        }
      if (!tgt) return "Gem not found";
      const why = upgradeRefusal(rough, tgt);
      if (why) return why;
      tgt.l = rough.l;
      this.takeFromInv(p, id);
      p.invDirty = true;
      if (onBar) {
        p.sk.out.push(barMsg(p));
        this.refresh(p);
      }
      return null;
    }
    if (typeof gem !== "string") return "Pick a gem";
    const opt = cutOptions(rough).find((o) => o.id === gem);
    if (!opt) return "That crystal can't become that gem";
    if (!opt.ok) return `${opt.name}: ${opt.why}`;
    const made = rough.b === ROUGH_SUPPORT ? makeSupportGem(gem, rough.l) : makeSkillGem(gem, rough.l);
    made.id = rough.id; // same grid cell, same id
    entry.it = made;
    p.invDirty = true;
    if (autoPlace && isSkillGem(made)) this.autoEquip(p, made, autoPlace);
    return null;
  }

  /** Bar slots a new skill gem goes to on its own: Q E R T G first, then RMB, then the Ctrl set (never LMB / the weapon-skill slot). */
  private static readonly AUTO_SLOTS = [3, 4, 5, 6, 7, 2, 11, 12, 13, 14, 15, 10, 8, 9];

  /**
   * PoE2-style: a freshly cut or picked-up skill gem goes straight onto the first free bar slot.
   * Does nothing (the gem stays in the bag) if that skill is already on the bar or the bar is full.
   */
  autoEquip(p: ServerPlayer, it: Item, autoPlace: AutoPlace): boolean {
    const d = skillDefOf(it);
    if (!d || !p.alive) return false;
    if (barSkillIds(p.sk.bar).includes(d.id)) return false;
    const slot = SkillSystem.AUTO_SLOTS.find((i) => !p.sk.bar[i].gem);
    if (slot === undefined) return false;
    if (this.socket(p, it.id, slot, undefined, autoPlace)) return false;
    const a = slotAction(p, slot);
    this.host.toast(p, `${d.name} is on your skill bar (${slotLabel(slot)})${a.ok ? "" : `, but it needs ${d.weapons?.join(" / ") ?? "another weapon"}`}`);
    return true;
  }

  /** A gem was picked up into the bag: cut skill gems equip themselves; crystals and supports get a one-time hint. */
  onPickup(p: ServerPlayer, it: Item, autoPlace: AutoPlace) {
    if (isSkillGem(it)) {
      if (!this.autoEquip(p, it, autoPlace)) this.hint(p, "skillgem", `${it.n}: right-click it in your bag to equip it`);
    } else if (isRough(it)) this.hint(p, it.b, `${ROUGH_NAMES[it.b]}: right-click it in your bag to cut it`);
    else if (isSupportGem(it)) this.hint(p, "support", `${it.n}: right-click it in your bag to socket it`);
  }

  private hint(p: ServerPlayer, key: string, text: string) {
    if (p.sk.hinted.has(key)) return;
    p.sk.hinted.add(key);
    this.host.toast(p, text);
  }

  // ---- dev (HNS_DEV=1) ------------------------------------------------------------------

  dev(p: ServerPlayer, msg: Record<string, unknown>) {
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    switch (msg.cmd) {
      case "gem": {
        const id = String(msg.id ?? "");
        const it = SKILL_GEM_BY_ID.has(id)
          ? makeSkillGem(id, num(msg.level, 1))
          : SUPPORT_GEM_BY_ID.has(id)
            ? makeSupportGem(id, num(msg.level, 1))
            : id in ROUGH_NAMES
              ? makeRough(id, num(msg.level, 1))
              : null;
        if (it) {
          if (typeof msg.gs === "number") (it as { gs?: number }).gs = msg.gs;
          this.host.dropItem(it, p.x, p.y, 20);
        } else this.host.toast(p, `dev: no gem ${id}`);
        break;
      }
      case "mana":
        p.sk.mana = Math.max(0, Math.min(p.stats.maxMana, num(msg.v, p.sk.mana)));
        break;
      case "nocd":
        p.sk.cds.fill(0);
        break;
    }
  }
}
