// Hook points called from server/monsters.ts (kept tiny there). Rarity + modifiers, pack leaders,
// the roster brain, bosses, rogue exiles and guarded buff shrines all hang off these.
import { DT } from "../../shared/constants";
import { MONSTER_BY_ID, type EliteMod, type MonsterType } from "../../shared/content/monsters";
import { BIOME_BOSS, BIOME_ROSTER } from "../../shared/content/monsters/roster";
import { RARE_MINION_HP_MULT, RARE_MOD_COUNT_WEIGHTS, RARE_MON_A, RARE_MON_B, RARE_MON_C, RARITY_INFO, MAGIC_CHANCE, LOOT_RARITY_PER_MOD, MONSTER_LEVEL, MONSTER_MODS, monsterLevelScale, type MonRarity } from "../../shared/content/monsters/mods";
import type { MonsterSnap } from "../../shared/protocol";
import { currentMap, getPois, isWalkable } from "../../shared/map";
import { monsterLocked, monsterMoveMult } from "../damage";
import type { Camp, Monster, MonsterSystem } from "../monsters";
import type { ServerPlayer } from "../player";
import { addPool, brainHooks, canRecover, COMBAT_LINGER, COMBAT_NEAR, LEASH_HURT_GRACE, modMul, poolSlow, resetChasePaths, thinkRoster, WOUND_MEMORY } from "./brain";
import { playerLevel } from "../progression";
import { MAX_LEVEL } from "../../shared/content/classes";
export { beginReturn, leashBroken, stepReturn } from "./brain";
import { exileDamaged, exileKilled, exileSetup, exileStep, spawnExiles } from "./exiles";
import { EXILE_LEVEL } from "../../shared/content/monsters/exiles";
import { setGuardRoller, shrineDealt, shrineHidden, shrineInit, shrineKilled, shrineMoveMult, shrineSpawn, shrineUpdate } from "./shrines";
import { modsOf, newExt } from "./state";
import { laneHook, laneModAllowed } from "../modes/lanehook";

/** The old 1-3 random elite mods are replaced by PoE2-style rarity (see extSpawned). */
export const LEGACY_ELITES = false;
/** Chance an outer (tier-0) camp is led by a rare (was 0.35: too many level-1 deaths to rares). */
const OUTER_RARE_CHANCE = 0.2;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const splitDone = new WeakSet<Monster>();
const lastHit = new WeakMap<Monster, ServerPlayer>();
const bossWoken = new WeakSet<Monster>();
let hookSys: MonsterSystem | null = null;

export function extInit(sys: MonsterSystem) {
  hookSys = sys;
  sys.locked = (m) => monsterLocked(m.id);
  sys.moveMult = (m) => monsterMoveMult(m.id);
  brainHooks.hidden = shrineHidden;
  brainHooks.wake = scaleToPlayer;
  setGuardRoller((s, camp, n) => {
    const roster = BIOME_ROSTER[biomeId()] ?? BIOME_ROSTER.hollowpine;
    const pack: Monster[] = [];
    for (let i = 0; i < n - 1; i++) pack.push(s.spawnMonster(camp, weighted(roster), false, undefined, Math.random() < MAGIC_CHANCE ? 1 : 0));
    const lead = s.spawnMonster(camp, weighted(roster), false, undefined, Math.random() < 0.4 ? 2 : 1);
    if (lead.ext?.rarity === 2) makeLeader(lead, pack);
  });
  shrineInit(sys);
}

function biomeId(): string {
  return currentMap().biome.id;
}

function weighted(w: Record<string, number>): MonsterType {
  let total = 0;
  for (const k in w) total += w[k];
  let r = Math.random() * total;
  for (const k in w) {
    r -= w[k];
    if (r <= 0) return MONSTER_BY_ID.get(k)!;
  }
  return MONSTER_BY_ID.get(Object.keys(w)[0])!;
}

/** One pack: a family from the biome roster, sized by its packCount. */
export function rollPack(sys: MonsterSystem, camp: Camp, bonus: number, rare: number) {
  const roster = BIOME_ROSTER[biomeId()] ?? BIOME_ROSTER.hollowpine;
  const lead = weighted(roster);
  const [lo, hi] = lead.packCount ?? [2, 4];
  const n = randInt(lo, hi) + bonus;
  const pack: Monster[] = [];
  for (let i = 0; i < n; i++) {
    // Mostly the lead family, sometimes a mixed-in support type.
    const t = i === 0 || Math.random() < 0.7 ? lead : weighted(roster);
    pack.push(sys.spawnMonster(camp, t, false, undefined, Math.random() < MAGIC_CHANCE ? 1 : 0));
  }
  for (let i = 0; i < rare; i++) {
    const leader = sys.spawnMonster(camp, Math.random() < 0.6 ? lead : weighted(roster), false, undefined, 2);
    makeLeader(leader, pack);
  }
}

/** A rare hands one of its minion-capable mods to its pack (PoE2 rare minions). */
function makeLeader(leader: Monster, pack: Monster[]) {
  const ext = leader.ext!;
  ext.pack = pack.filter((p) => p !== leader);
  const grant = (leader.elite ?? []).filter((m) => m.minion);
  const g = grant.length ? pick(grant) : MONSTER_MODS.find((m) => m.id === "bulwarked")!;
  for (const p of ext.pack) {
    if (!p.ext || p.ext.rarity >= 2) continue;
    p.ext.granted = g;
    p.ext.leader = leader;
    p.maxHp *= RARE_MINION_HP_MULT * (g.hpMult ?? 1);
    p.hp = p.maxHp;
    p.speed *= g.speedMult ?? 1;
    p.atkSpeed *= g.attackSpeedMult ?? 1;
    p.damage *= g.dmgMult ?? 1;
  }
}

export function extFillCamp(sys: MonsterSystem, camp: Camp): boolean {
  const tier = camp.tier ?? 0;
  if (camp.role === "shrine") return shrineSpawn(sys, camp), true;
  if (camp.role === "exile") return spawnExiles(sys, camp), true;
  if (camp.role) return false;
  if (tier === 2) {
    const boss = MONSTER_BY_ID.get(BIOME_BOSS[biomeId()] ?? "rotwood_matriarch");
    if (boss) sys.spawnMonster(camp, boss, false, { x: camp.x, y: camp.y }, 3);
    rollPack(sys, camp, 1, 1);
    return true;
  }
  rollPack(sys, camp, tier, tier === 1 ? 1 : Math.random() < OUTER_RARE_CHANCE ? 1 : 0);
  return true;
}

export function extPopulate(sys: MonsterSystem, players: ServerPlayer[]) {
  matchT = 0;
  shrineInit(sys);
  // Shrine guardians at every buff POI, rogue exiles at a few outlying spots.
  import_shrines(sys);
  const n = Math.max(1, Math.floor(players.length / 4));
  const spots = sys.camps.filter((c) => (c.tier ?? 0) === 0 && !c.role && !players.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 900));
  for (let i = 0; i < n && spots.length; i++) {
    const s = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    let x = s.x + 160;
    let y = s.y;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2;
      x = s.x + Math.cos(a) * 200;
      y = s.y + Math.sin(a) * 200;
      if (isWalkable(x, y, 16, 8)) break;
    }
    const camp: Camp = { id: 100000 + sys.allocId(), x, y, monsters: [], clearedFor: 0, tier: 0, role: "exile" };
    sys.camps.push(camp);
    sys.fillCamp(camp);
  }
}

function import_shrines(sys: MonsterSystem) {
  for (const poi of getPois("buff")) {
    const camp: Camp = { id: 200000 + poi.id, x: poi.x, y: poi.y, monsters: [], clearedFor: 0, tier: 0, role: "shrine" };
    sys.camps.push(camp);
    sys.fillCamp(camp);
  }
}

function rollMods(m: Monster, n: number): EliteMod[] {
  const hasProj = (m.type.attacks ?? []).some((a) => a.kind === "proj") || m.type.ai === "ranged";
  const pool = MONSTER_MODS.filter((md) => (md.needs !== "proj" || hasProj) && (!laneHook.active || laneModAllowed(md)));
  const out: EliteMod[] = [];
  const fams = new Set<string>();
  while (out.length < n && pool.length) {
    const md = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    // at most one bubble mod per monster
    if (md.family === "bubble" && fams.has("bubble")) continue;
    fams.add(md.family ?? "");
    out.push(md);
  }
  return out;
}

export function extSpawned(sys: MonsterSystem, m: Monster, rarity: number) {
  const ext = newExt();
  m.ext = ext;
  let r = (m.type.boss ? 3 : Math.max(0, Math.min(3, rarity))) as MonRarity;
  if (m.type.ai === "exile") r = 3;
  const info = RARITY_INFO[r];
  ext.rarity = r;
  (m as unknown as { rarity: number }).rarity = r; // progression reads this for the XP tier
  ext.power = info.power;
  ext.ccResist = info.ccResist;
  m.maxHp *= info.hpMult;
  m.damage *= info.dmgMult;
  m.radius *= info.sizeMult;
  let count = 0;
  if (r === 1) count = 1;
  else if (r === 2) {
    let w = Math.random() * RARE_MOD_COUNT_WEIGHTS.reduce((a, b) => a + b, 0);
    count = 2;
    for (let i = 0; i < RARE_MOD_COUNT_WEIGHTS.length; i++) {
      w -= RARE_MOD_COUNT_WEIGHTS[i];
      if (w <= 0) {
        count = 2 + i;
        break;
      }
    }
  } else if (r === 3 && m.type.boss) count = Math.random() < 0.5 ? 1 : 0;
  if (count > 0) {
    const mods = rollMods(m, count);
    for (const md of mods) {
      m.maxHp *= md.hpMult ?? 1;
      m.speed *= md.speedMult ?? 1;
      m.atkSpeed *= md.attackSpeedMult ?? 1;
      m.damage *= md.dmgMult ?? 1;
      m.radius *= md.sizeMult ?? 1;
      ext.ccResist = Math.min(0.8, ext.ccResist + (md.ccResist ?? 0));
    }
    m.elite = mods;
  }
  if (r === 1 && m.elite) m.eliteName = `${m.elite[0].name} ${m.type.name}`;
  else if (r === 2) m.eliteName = Math.random() < 0.5 ? `${pick(RARE_MON_A)}${pick(RARE_MON_B)} ${pick(RARE_MON_C)}` : `${pick(RARE_MON_A)}${pick(RARE_MON_B)}`;
  if (m.type.boss) {
    m.maxHp *= m.type.boss.hpMult;
    ext.boss = { phase: 0, roarT: 0 };
    ext.ccResist = Math.max(ext.ccResist, 0.6);
    m.eliteName = m.type.name;
  }
  if (m.type.ai === "exile") {
    exileSetup(sys, m);
    // Exiles are on the level curve too: the rolled gear stands for EXILE_LEVEL; the exile starts at level 1
    // and scaleToPlayer raises it to whoever wakes it (it used to meet a level 2 player at full strength).
    const sc = monsterLevelScale(EXILE_LEVEL);
    ext.level = 1;
    m.maxHp /= sc.life;
    m.damage /= sc.dmg;
  } else {
    // Monster level (PoE2 area level): camp tier + match time. Exiles: see above.
    const L = MONSTER_LEVEL;
    ext.level = Math.min(L.max, Math.floor(L.base + (m.camp.tier ?? 0) * L.perTier + (matchT / 60) * L.perMinute));
    const sc = monsterLevelScale(ext.level);
    m.maxHp *= sc.life;
    m.damage *= sc.dmg;
  }
  m.hp = m.maxHp;
}

/**
 * Monsters scale to the player who wakes them, so a camp is a fight at any level: every camp matches
 * the player's level (plus MONSTER_LEVEL.scalePerTier per camp tier, 0 since the balance pass). Level only
 * ever goes up, and only on wake-up (state 0 -> 1), so a passer-by cannot buff a pack mid-fight.
 */
function scaleToPlayer(m: Monster, p: ServerPlayer) {
  const ext = m.ext;
  if (!ext || !m.alive || typeof ext.level !== "number" || laneHook.active) return; // lanes: the mode sets levels
  if (m.type.boss && !bossWoken.has(m)) {
    bossWoken.add(m); // everyone hears it once, as they hear it fall (the boss is the match's shared objective)
    hookSys?.host.info?.(`${m.type.name} awakens`);
  }
  const want = Math.min(MAX_LEVEL, playerLevel(p) + (m.camp.tier ?? 0) * MONSTER_LEVEL.scalePerTier);
  if (want <= ext.level) return;
  const a = monsterLevelScale(ext.level);
  const b = monsterLevelScale(want);
  const frac = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  m.maxHp *= b.life / a.life;
  m.hp = m.maxHp * frac;
  m.damage *= b.dmg / a.dmg;
  ext.level = want;
}

/** Seconds since the camps were populated (monster level grows with it). */
let matchT = 0;

export function extHidden(p: ServerPlayer): boolean {
  return shrineHidden(p);
}

export function extIncoming(sys: MonsterSystem, m: Monster, dmg: number, _fx: number, _fy: number, attacker: ServerPlayer): number {
  const ext = m.ext;
  if (laneHook.incoming) {
    dmg = laneHook.incoming(m, dmg, attacker ?? null);
    if (dmg <= 0) return 0;
  }
  if (!ext) return dmg;
  ext.hurtT = LEASH_HURT_GRACE; // being fought: no leash, no walk-home heal (brain.ts leashBroken)
  ext.woundT = WOUND_MEMORY; // and it keeps the wounds for a while after (brain.ts canRecover)
  if (attacker) lastHit.set(m, attacker);
  if (m.state === 0 && attacker) scaleToPlayer(m, attacker); // woken by a hit from outside its sight (bow 420 > aggro 380): same rule, every monster
  dmg *= shrineDealt(attacker);
  if (ext.invulnT > 0 || (ext.exile && ext.exile.rollT > 0)) return 0;
  if (ext.boss && ext.boss.roarT > 0) return 0;
  for (const md of modsOf(m)) {
    if (md.nearOnly && attacker && Math.hypot(attacker.x - m.x, attacker.y - m.y) > md.nearOnly) return 0;
  }
  // Veiled Sphere: allies inside a living bubble are immune to attackers outside it.
  for (const o of m.camp.monsters) {
    if (!o.alive) continue;
    for (const md of modsOf(o)) {
      if (!md.sphere || !attacker) continue;
      if (Math.hypot(m.x - o.x, m.y - o.y) < md.sphere && Math.hypot(attacker.x - o.x, attacker.y - o.y) > md.sphere) return 0;
    }
  }
  dmg *= modMul(m, "dmgTaken") * ext.bTaken;
  for (const md of modsOf(m)) if (md.hardening) dmg *= 1 - Math.min(md.hardening.max, ext.hardStacks * md.hardening.per);
  const L = ext.leader;
  if (L?.alive) for (const md of L.elite ?? []) if (md.packWard) dmg *= 1 - md.packWard;
  // Soul-Linked: a rare passes part of its damage to its living pack.
  for (const md of m.elite ?? []) {
    if (!md.soulLink) continue;
    const pack = ext.pack.filter((p) => p.alive);
    if (!pack.length) continue;
    const share = dmg * 0.5;
    for (const p of pack) p.hp = Math.max(1, p.hp - share / pack.length);
    dmg -= share;
  }
  return dmg;
}

export function extKbMult(m: Monster): number {
  const ext = m.ext;
  if (!ext) return 1;
  for (const md of modsOf(m)) if (md.kbImmune) return 0;
  return 1 - ext.ccResist;
}

export function extAfterDamage(sys: MonsterSystem, m: Monster, dmg: number, attacker: ServerPlayer) {
  const ext = m.ext;
  if (!ext || dmg <= 0) return;
  for (const md of modsOf(m)) {
    if (md.hardening) {
      ext.hardStacks = Math.min(Math.ceil(md.hardening.max / md.hardening.per), ext.hardStacks + 1);
      ext.hardT = md.hardening.reset;
    }
    if (md.thorns && attacker?.alive) sys.host.damagePlayer(attacker, dmg * md.thorns, m.x, m.y, 0, `${sys.displayName(m)}'s thorns`, { form: "reflect", monster: true, mon: m });
  }
  if (ext.exile) exileDamaged(sys, m, attacker);
  const b = m.type.boss;
  if (ext.boss && b && m.hp > 0) {
    const f = m.hp / m.maxHp;
    const next = ext.boss.phase + 1;
    const ph = b.phases[next];
    if (ph && f < ph.below) {
      ext.boss.phase = next;
      ext.boss.roarT = 1.2;
      m.state = 1;
      ext.atk = null;
      m.speed = m.type.speed * ph.speedMult;
      m.atkSpeed = ph.atkSpeedMult;
      sys.host.info?.(`${m.type.name}: ${ph.name}`);
      // Roar: telegraphed shockwave around the boss.
      sys.hazards.push({
        id: sys.allocId(), x: m.x, y: m.y, r: b.roar.radius, t: 0, delay: 1.1, dmg: b.roar.dmg, kb: 600,
        source: `${m.type.name}'s roar`, owner: m, snap: { sh: "ring" }, meta: { form: "area", monster: true },
      });
      if (ph.adds) {
        const t = MONSTER_BY_ID.get(ph.adds.type);
        if (t) for (let i = 0; i < ph.adds.count; i++) {
          const a = (i / ph.adds.count) * Math.PI * 2;
          const at = { x: m.x + Math.cos(a) * (m.radius + 60), y: m.y + Math.sin(a) * (m.radius + 60) };
          if (!isWalkable(at.x, at.y, t.radius, 6)) continue;
          const add = sys.spawnMonster(m.camp, t, false, at, 0);
          add.state = 1;
          add.target = m.target;
          ext.adds.add(add.id);
          if (add.ext) add.ext.leader = m;
        }
      }
    }
  }
}

export function extPreventDeath(sys: MonsterSystem, m: Monster): boolean {
  const ext = m.ext;
  if (!ext || ext.lastBreathUsed) return false;
  for (const md of modsOf(m)) {
    if (!md.lastBreath) continue;
    ext.lastBreathUsed = true;
    ext.invulnT = md.lastBreath;
    m.hp = 1;
    sys.host.boom(m.x, m.y, m.radius + 20);
    return true;
  }
  return false;
}

export function extOnKill(sys: MonsterSystem, m: Monster) {
  const ext = m.ext;
  if (!ext) return;
  const L = ext.leader;
  if (L?.ext) {
    L.ext.adds.delete(m.id);
    if (L.alive && (L.elite ?? []).some((md) => md.revive) && L.ext.pack.includes(m)) L.ext.fallen.push(m.type.id);
  }
  const dp = m.type.deathPop;
  if (dp) sys.hazards.push({ id: sys.allocId(), x: m.x, y: m.y, r: dp.radius, t: 0, delay: dp.delay, dmg: dp.dmg, kb: 260, source: `${m.type.name}'s burst`, owner: null, meta: { form: "area", element: "fire", monster: true } });
  for (const md of modsOf(m)) {
    if (md.deathPool) addPool(sys, m.x, m.y, md.deathPool, `${sys.displayName(m)}'s blight`);
    if (md.splitOnDeath && !splitDone.has(m)) {
      for (let i = 0; i < md.splitOnDeath; i++) {
        const a = Math.random() * Math.PI * 2;
        const at = { x: m.x + Math.cos(a) * 24, y: m.y + Math.sin(a) * 24 };
        if (!isWalkable(at.x, at.y, m.type.radius, 6)) continue;
        const c = sys.spawnMonster(m.camp, m.type, false, at, 0);
        c.maxHp *= 0.5;
        c.hp = c.maxHp;
        c.radius *= 0.8;
        c.state = 1;
        c.target = m.target;
        splitDone.add(c);
      }
    }
    if (md.raiseOnDeath) {
      const swarm = { hollowpine: "barkgnaw", gloamwater: "leechkin", brokenspire: "cindermite" }[biomeId()] ?? "cindermite";
      const t = MONSTER_BY_ID.get(swarm);
      if (t) for (let i = 0; i < md.raiseOnDeath; i++) {
        const a = Math.random() * Math.PI * 2;
        const at = { x: m.x + Math.cos(a) * 30, y: m.y + Math.sin(a) * 30 };
        if (!isWalkable(at.x, at.y, t.radius, 6)) continue;
        const c = sys.spawnMonster(m.camp, t, false, at, 0);
        c.state = 1;
        c.target = m.target;
      }
      sys.host.boom(m.x, m.y, 50);
    }
  }
  if (ext.exile) exileKilled(sys, m);
  if (m.type.boss) sys.host.info?.(`${m.type.name} has fallen`);
  const k = lastHit.get(m);
  if (k) {
    shrineKilled(sys, m, k);
    // Loot scales with rarity: rares roll extra per modifier past the first, bosses roll a hoard.
    const extra = m.type.boss ? 4 : ext.rarity === 2 ? Math.max(0, (m.elite?.length ?? 1) - 1) * LOOT_RARITY_PER_MOD : 0;
    if (extra > 0) sys.host.extraDrops?.(m, k, extra);
  }
}

export function extPlayerSlow(sys: MonsterSystem, p: ServerPlayer, slow: number): number {
  if (!p.alive) return slow;
  let s = slow * poolSlow(sys, p);
  return Math.round(s * shrineMoveMult(p) * 1000) / 1000;
}

/** Per-tick modifier effects (regen, ally auras, trails, pulses, revives) + shrines. */
export function extUpdate(sys: MonsterSystem, players: Map<number, ServerPlayer>, alive: ServerPlayer[], _practice: boolean) {
  matchT += DT;
  const holders: Monster[] = [];
  for (const m of sys.active) {
    const e = m.ext;
    if (!e || !m.alive) continue;
    e.bSpeed = 1;
    e.bRegen = 0;
    e.bTaken = 1;
    e.bDmg = 1;
    if (modsOf(m).some((md) => md.allyAura || md.packBoost)) holders.push(m);
  }
  for (const h of holders) {
    for (const md of modsOf(h)) {
      const au = md.allyAura;
      if (au) {
        const r2 = au.radius * au.radius;
        for (const o of h.camp.monsters) {
          if (!o.ext || (o.x - h.x) ** 2 + (o.y - h.y) ** 2 > r2) continue;
          o.ext.bSpeed = Math.max(o.ext.bSpeed, au.speed ?? 1);
          o.ext.bRegen = Math.max(o.ext.bRegen, au.regen ?? 0);
          o.ext.bTaken = Math.min(o.ext.bTaken, au.dmgTaken ?? 1);
          o.ext.bDmg = Math.max(o.ext.bDmg, au.dmg ?? 1);
        }
      }
      if (md.packBoost && h.ext) for (const o of h.ext.pack) if (o.alive && o.ext) {
        o.ext.bDmg = Math.max(o.ext.bDmg, md.packBoost.dmg);
        o.ext.bSpeed = Math.max(o.ext.bSpeed, md.packBoost.speed);
      }
    }
  }
  for (const m of sys.active) {
    const e = m.ext;
    if (!e || !m.alive) continue;
    if (e.invulnT > 0) e.invulnT -= DT;
    if (e.hurtT > 0) e.hurtT -= DT;
    if (e.woundT > 0) e.woundT -= DT;
    // In combat while a living player is close (brain.ts canRecover): no healing, so kiting cannot reset it.
    if (e.nearT > 0) e.nearT -= DT;
    for (const p of alive) {
      if (Math.abs(p.x - m.x) < COMBAT_NEAR && Math.abs(p.y - m.y) < COMBAT_NEAR && Math.hypot(p.x - m.x, p.y - m.y) < COMBAT_NEAR) {
        e.nearT = COMBAT_LINGER;
        break;
      }
    }
    if (e.hardT > 0 && (e.hardT -= DT) <= 0) e.hardStacks = 0;
    if (e.exile) exileStep(sys, m, players);
    const mods = modsOf(m);
    let regen = e.bRegen;
    for (const md of mods) regen += md.regen ?? 0;
    if (regen > 0 && m.state !== 0) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * regen * DT);
    if (m.state === 0) {
      // Idle and not hit for a while: recover, so a monster that got home (or settled) while still "recently hurt" is not stuck at partial life.
      if (!laneHook.active && canRecover(m) && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.12 * DT); // lanes: no idle heal (structures)
      continue;
    }
    for (const md of mods) {
      if (md.trail && (e.trailT -= DT) <= 0) {
        e.trailT = md.trail.every;
        addPool(sys, m.x, m.y, md.trail, `${sys.displayName(m)}'s wake`);
      }
      if (md.pulse && (e.pulseT -= DT) <= 0) {
        e.pulseT = md.pulse.every;
        sys.hazards.push({ id: sys.allocId(), x: m.x, y: m.y, r: md.pulse.radius, t: 0, delay: md.pulse.delay, dmg: m.damage * md.pulse.dmg, kb: 300, source: `${sys.displayName(m)}'s pulse`, owner: m, snap: { sh: "ring" }, meta: { form: "area", monster: true } });
      }
      if (md.stormcall && (e.stormT -= DT) <= 0) {
        e.stormT = md.stormcall.every;
        const p = players.get(m.target);
        if (p?.alive) for (let i = 0; i < md.stormcall.count; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = i === 0 ? 0 : rand(40, 130);
          sys.hazards.push({ id: sys.allocId(), x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: md.stormcall.radius, t: 0, delay: md.stormcall.delay + i * 0.15, dmg: m.damage * md.stormcall.dmg, kb: 120, source: `${sys.displayName(m)}'s storm`, owner: null, meta: { form: "area", element: "lightning", monster: true, mon: m } });
        }
      }
      if (md.phasing && (e.phaseT -= DT) <= 0) {
        e.phaseT = md.phasing.every;
        e.invulnT = Math.max(e.invulnT, md.phasing.dur);
      }
      if (md.revive && e.fallen.length && (e.reviveT -= DT) <= 0) {
        e.reviveT = md.revive.every;
        const t = MONSTER_BY_ID.get(e.fallen.shift()!);
        if (t) {
          const at = { x: m.x + rand(-40, 40), y: m.y + rand(-40, 40) };
          if (isWalkable(at.x, at.y, t.radius, 6)) {
            const c = sys.spawnMonster(m.camp, t, false, at, 0);
            c.state = 1;
            c.target = m.target;
            if (c.ext) c.ext.leader = m;
            e.pack.push(c);
            sys.host.boom(at.x, at.y, 40);
          }
        }
      }
      if (md.thirstAura) {
        const r = md.thirstAura.radius;
        for (const p of alive) {
          if (p.alive && Math.hypot(p.x - m.x, p.y - m.y) < r) sys.host.damagePlayer(p, md.thirstAura.perSec * DT, m.x, m.y, 0, `${sys.displayName(m)}'s thirst`, { form: "dot", monster: true });
        }
      }
    }
  }
  shrineUpdate(sys, players, alive);
  resetChasePaths(); // one monster route search per tick (brain.ts chaseSteer)
}

export function extThink(sys: MonsterSystem, m: Monster, players: Map<number, ServerPlayer>, alive: ServerPlayer[]): boolean {
  if (laneHook.think && laneHook.think(sys, m, players)) return true;
  return thinkRoster(sys, m, players, alive);
}

export function extSnap(m: Monster, s: MonsterSnap) {
  const e = m.ext;
  if (!e) return;
  if (e.rarity > 0) s.rr = e.rarity as 1 | 2 | 3;
  if (e.granted) s.gm = e.granted.id;
  if (m.state === 2 && e.atk) s.at = e.atk.id;
  if (e.boss) s.ph = e.boss.phase;
  if (e.invulnT > 0 || (e.boss && e.boss.roarT > 0) || (e.exile && e.exile.rollT > 0)) s.iv = 1;
  for (const md of modsOf(m)) {
    if (md.sphere) s.bb = md.sphere;
    else if (md.nearOnly) s.bb = -md.nearOnly;
  }
  if (e.exile) {
    s.lk = e.exile.lk;
    if (e.exile.wk) s.wk = e.exile.wk;
    s.cl = e.exile.def.color;
    if (e.exile.rollT > 0) s.rl = 1;
  }
}
