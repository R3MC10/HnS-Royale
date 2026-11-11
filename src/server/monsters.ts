// Monster camps + AI, projectiles and telegraphed hazards (server-only).
import {
  CAMP_COUNT,
  CAMP_ELITE_CHANCE,
  CAMP_MIN_SPACING,
  CAMP_PLAYER_CLEARANCE,
  CAMP_PRACTICE_RESPAWN,
  DT,
  KNOCKBACK_DECAY,
  LEASH_RADIUS,
  MAP_H,
  MAP_W,
  PLAYER_RADIUS,
} from "../shared/constants";
import { blocksProjectile, currentMap, getCampSpots, isWalkable } from "../shared/map";
import { BucketGrid } from "../shared/spatial";
import {
  ELITE_BASE,
  ELITE_MODS,
  ELITE_NAME_A,
  ELITE_NAME_B,
  MONSTER_TYPES,
  PACK_SIZE,
  type EliteMod,
  type MonsterType,
} from "../shared/content/monsters";
import type { CampSnap, HazardSnap, MonsterSnap, ProjSnap } from "../shared/protocol";
import { resolveCollisions } from "../shared/sim";
import type { ServerPlayer } from "./player";
import { monsterLocked, monsterMoveMult } from "./damage";
import * as X from "./ai/hooks"; // monsters agent: roster brain, rarity, mods, bosses, exiles, shrines
import type { MonExt } from "./ai/state";

const KB_FACTOR = Math.exp(-KNOCKBACK_DECAY * DT);
const EDGE = 100;

export interface Monster {
  id: number;
  type: MonsterType;
  camp: Camp;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  atkSpeed: number; // multiplier on windup/recover
  kbx: number;
  kby: number;
  state: 0 | 1 | 2 | 3; // idle / chase / windup / return
  target: number;
  windT: number;
  windTotal: number;
  recoverT: number;
  homeX: number;
  homeY: number;
  wanderX: number;
  wanderY: number;
  wanderT: number;
  elite: EliteMod[] | null;
  eliteName?: string;
  alive: boolean;
  /** Roster / rarity / modifier / boss / exile state (server/ai). */
  ext?: MonExt;
  /** Breachway lane mode: the side this unit fights for. */
  team?: 0 | 1;
  /** Breachway spire / Core: id of the hero it is shooting at (0 = none). */
  focus?: number;
  /** Breachway structures: recharging energy shield over life (absent = none). */
  es?: number;
  esMax?: number;
}

export interface Camp {
  id: number;
  x: number;
  y: number;
  monsters: Monster[];
  clearedFor: number; // s since the last monster died (practice respawn)
  /** Map camp tier: 0 normal, 1 elite (guaranteed rare), 2 boss. */
  tier?: number;
  /** Simulated this tick (a player is near or a monster is busy). Far camps sleep. */
  awake?: boolean;
  /** What refills this camp (server/ai/hooks.ts): "boss" | "exile" | "shrine". */
  role?: string;
}

/** Camps farther than this from every living player sleep (no AI, no separation). */
export const CAMP_WAKE_RADIUS = 1500;

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  dmg: number;
  kb: number;
  source: string;
  /** Monster that fired it (crit, Thornwake retaliation). */
  owner?: Monster;
  /** Passed to damagePlayer (element / ignite / chill); form is forced to "proj" unless it says "spell". */
  meta?: Record<string, unknown>;
  /** Custom flight (lane mode: homing spire bolts, mob shots that hit enemy units): true keep, false remove, null = default. */
  step?: (pr: Projectile) => boolean | null;
}

export interface Hazard {
  id: number;
  x: number;
  y: number;
  r: number;
  t: number;
  delay: number;
  dmg: number;
  kb: number;
  source: string;
  owner: Monster | null; // cancelled if the owner dies first
  /** Telegraph of this monster's windup (also set on ownerless ones, e.g. rain): cancelled if it is stunned / frozen. */
  caster?: Monster;
  // ---- shaped / lingering hazards (server/ai) ----
  /** Custom hit test (cones, lines); default is the circle. */
  hit?: (p: ServerPlayer) => boolean;
  /** Called for each player it damages. */
  onHit?: (p: ServerPlayer) => void;
  /** Called once when it detonates. */
  onFire?: () => void;
  /** Lingering hazard: runs every tick instead of detonating; return false to remove. */
  step?: (alive: ServerPlayer[]) => boolean;
  /** Extra snapshot fields (shape, colour). */
  snap?: Partial<HazardSnap>;
  /** Passed to damagePlayer (combat-systems: form / element). */
  meta?: Record<string, unknown>;
}

/** Callbacks into the game (damage rules and loot live there / in combat.ts). */
export interface MonsterHost {
  /** Returns true when the hit connected (blocked / absorbed by energy shield counts), so projectiles are consumed. */
  damagePlayer(p: ServerPlayer, dmg: number, fromX: number, fromY: number, kb: number, source: string, meta?: Record<string, unknown>): boolean | void;
  boom(x: number, y: number, r: number): void;
  /** Spill items on the ground (rogue exile gear, shrine loot). */
  spill?(items: import("../shared/items").Item[], x: number, y: number): void;
  /** Info / toast hooks (boss shouts, shrine buffs). */
  info?(text: string): void;
  toast?(p: ServerPlayer, text: string): void;
  /** Extra drops for a monster killed under a loot shrine. */
  extraDrops?(m: Monster, killer: ServerPlayer, rolls: number): void;
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

function weightedType(): MonsterType {
  // Biome monster family weights (falls back to each type's packWeight).
  const bw = currentMap().biome.monsters;
  // A biome with a family table spawns only those families (prototype: Hollowpine only).
  const wOf = (t: MonsterType) => (bw && Object.keys(bw).length ? bw[t.id] ?? 0 : t.packWeight);
  const total = MONSTER_TYPES.reduce((s, t) => s + wOf(t), 0);
  let r = Math.random() * total;
  for (const t of MONSTER_TYPES) {
    r -= wOf(t);
    if (r <= 0) return t;
  }
  return MONSTER_TYPES[0];
}

function freeOfRocks(x: number, y: number, r: number) {
  if (x < EDGE || y < EDGE || x > MAP_W - EDGE || y > MAP_H - EDGE) return false;
  return isWalkable(x, y, r, 8);
}

export class MonsterSystem {
  camps: Camp[] = [];
  monsters = new Map<number, Monster>();
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  private nextId = 1;
  private nextCampId = 1;
  /** Monsters simulated this tick (camps near players). */
  active: Monster[] = [];
  private sepGrid = new BucketGrid<Monster>(96);

  constructor(public host: MonsterHost) {
    X.extInit(this);
  }

  /** Fresh entity id (monsters, projectiles, hazards share the counter). */
  allocId() {
    return this.nextId++;
  }
  /** combat-systems hooks for the roster brain (stun lock / slows); default: none. */
  locked: (m: Monster) => boolean = () => false;
  moveMult: (m: Monster) => number = () => 1;

  /** Clear everything and place fresh camps away from the given players. */
  populate(players: ServerPlayer[]) {
    this.camps = [];
    this.monsters.clear();
    this.projectiles = [];
    this.hazards = [];
    // Camp spots come from the procedural map (count scales with open area; elite / boss camps
    // sit in the dangerous centre and dead-end lairs).
    for (const spot of getCampSpots()) {
      if (players.some((p) => p.alive && Math.hypot(p.x - spot.x, p.y - spot.y) < CAMP_PLAYER_CLEARANCE)) continue;
      const camp: Camp = { id: this.nextCampId++, x: spot.x, y: spot.y, monsters: [], clearedFor: 0, tier: spot.tier };
      this.camps.push(camp);
      this.fillCamp(camp);
    }
    X.extPopulate(this, players);
  }

  fillCamp(camp: Camp) {
    camp.monsters = [];
    camp.clearedFor = 0;
    if (X.extFillCamp(this, camp)) return;
    const tier = camp.tier ?? 0;
    const n = randInt(PACK_SIZE[0], PACK_SIZE[1]) + (tier === 2 ? 3 : tier === 1 ? 1 : 0);
    for (let i = 0; i < n; i++) this.spawnMonster(camp, weightedType(), false);
    const elites = tier === 2 ? 2 : tier === 1 ? 1 : Math.random() < CAMP_ELITE_CHANCE ? 1 : 0;
    for (let i = 0; i < elites; i++) {
      const m = this.spawnMonster(camp, weightedType(), true);
      if (tier === 2 && i === 0) {
        // Boss: the heart's warden, tougher and bigger than a normal rare.
        m.maxHp *= 2;
        m.hp = m.maxHp;
        m.radius *= 1.2;
        m.damage *= 1.2;
      }
    }
  }

  /** Spawn one monster in a camp (also used by dev commands). */
  spawnMonster(camp: Camp, type: MonsterType, elite: boolean, at?: { x: number; y: number }, rarity?: 0 | 1 | 2 | 3): Monster {
    let x = camp.x;
    let y = camp.y;
    if (at) {
      x = at.x;
      y = at.y;
    } else {
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = rand(20, 110);
        x = camp.x + Math.cos(a) * d;
        y = camp.y + Math.sin(a) * d;
        if (freeOfRocks(x, y, type.radius)) break;
      }
    }
    let hp = type.hp;
    let speed = type.speed;
    let damage = type.damage;
    let radius = type.radius;
    let atkSpeed = 1;
    let mods: EliteMod[] | null = null;
    let eliteName: string | undefined;
    if (elite && X.LEGACY_ELITES) {
      const count = randInt(ELITE_BASE.modCount[0], ELITE_BASE.modCount[1]);
      const pool = [...ELITE_MODS];
      mods = [];
      while (mods.length < count && pool.length) mods.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      hp *= ELITE_BASE.hpMult;
      damage *= ELITE_BASE.dmgMult;
      radius *= ELITE_BASE.sizeMult;
      for (const m of mods) {
        hp *= m.hpMult ?? 1;
        speed *= m.speedMult ?? 1;
        atkSpeed *= m.attackSpeedMult ?? 1;
      }
      eliteName = pick(ELITE_NAME_A) + pick(ELITE_NAME_B);
    }
    const m: Monster = {
      id: this.nextId++,
      type,
      camp,
      x,
      y,
      angle: Math.random() * Math.PI * 2,
      hp,
      maxHp: hp,
      radius,
      speed,
      damage,
      atkSpeed,
      kbx: 0,
      kby: 0,
      state: 0,
      target: -1,
      windT: 0,
      windTotal: 0,
      recoverT: 0,
      homeX: x,
      homeY: y,
      wanderX: x,
      wanderY: y,
      wanderT: rand(1, 4),
      elite: mods,
      eliteName,
      alive: true,
    };
    resolveCollisions(m, radius);
    // Home is where it actually stands: a home inside a prop could never be reached again (endless return).
    m.homeX = m.wanderX = m.x;
    m.homeY = m.wanderY = m.y;
    camp.monsters.push(m);
    this.monsters.set(m.id, m);
    X.extSpawned(this, m, rarity ?? (elite ? 2 : 0));
    return m;
  }

  /**
   * Spawn one monster with no map camp (dev `spawn`): it gets a private, unlisted camp record (never in
   * `camps`, so no camp snapshot, no braziers / totems / stakes, no practice refill, no pack wake).
   */
  spawnLoose(type: MonsterType, at: { x: number; y: number }, elite = false, rarity?: 0 | 1 | 2 | 3): Monster {
    const camp: Camp = { id: 0, x: at.x, y: at.y, monsters: [], clearedFor: 0, tier: 0, role: "loose" };
    return this.spawnMonster(camp, type, elite, at, rarity);
  }

  displayName(m: Monster) {
    return m.eliteName ?? m.type.name;
  }

  /** Apply player damage to a monster. Returns true if it died. */
  damage(m: Monster, dmg: number, fromX: number, fromY: number, kb: number, attacker: ServerPlayer): boolean {
    if (!m.alive) return false;
    dmg = X.extIncoming(this, m, dmg, fromX, fromY, attacker);
    kb *= X.extKbMult(m);
    m.hp -= dmg;
    const dx = m.x - fromX;
    const dy = m.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    const k = kb * (1 - m.type.kbResist);
    m.kbx = (dx / d) * k;
    m.kby = (dy / d) * k;
    if (m.state === 0 || (m.state === 3 && attacker.alive)) {
      // Idle, or walking home: it turns on whoever hits it (a returning monster used to ignore the hit and heal it off).
      m.state = 1;
      m.target = attacker.id;
    }
    X.extAfterDamage(this, m, dmg, attacker);
    if (m.hp <= 0 && X.extPreventDeath(this, m)) return false;
    if (m.hp <= 0) {
      this.kill(m);
      return true;
    }
    return false;
  }

  /** Remove a dead monster (lane mode kills units directly with this). */
  kill(m: Monster) {
    m.alive = false;
    m.hp = 0;
    this.monsters.delete(m.id);
    m.camp.monsters = m.camp.monsters.filter((x) => x !== m);
    X.extOnKill(this, m);
    for (const mod of m.elite ?? []) {
      if (mod.deathBlast) {
        const b = mod.deathBlast;
        this.hazards.push({
          id: this.nextId++, x: m.x, y: m.y, r: b.radius, t: 0, delay: b.delay, dmg: b.damage, kb: 500,
          source: `${this.displayName(m)}'s blast`, owner: null,
        });
      }
    }
  }

  /** Frost auras: sets slowMult on players (1 = none). Returns players whose slow changed. */
  applyAuras(players: ServerPlayer[]): ServerPlayer[] {
    const changed: ServerPlayer[] = [];
    for (const p of players) {
      let slow = 1;
      if (p.alive) {
        for (const m of this.active) {
          if (!m.alive) continue;
          for (const mod of m.elite ?? []) {
            if (mod.frostAura && Math.hypot(m.x - p.x, m.y - p.y) < mod.frostAura.radius) slow = Math.min(slow, mod.frostAura.slow);
          }
        }
      }
      slow = X.extPlayerSlow(this, p, slow);
      if (slow !== p.slowMult) {
        p.slowMult = slow;
        changed.push(p);
      }
    }
    return changed;
  }

  update(players: Map<number, ServerPlayer>, practice: boolean) {
    const alivePlayers = [...players.values()].filter((p) => p.joined && p.alive);

    // Sleep camps far from every living player: tick cost follows the players, not the map size.
    const W2 = CAMP_WAKE_RADIUS * CAMP_WAKE_RADIUS;
    for (const c of this.camps) {
      let awake = false;
      for (const p of alivePlayers) {
        if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < W2) {
          awake = true;
          break;
        }
      }
      if (!awake) for (const m of c.monsters) if (m.state !== 0 || m.kbx || m.kby) awake = true;
      // Falling asleep (nobody near, everything idle): reset life, since sleeping monsters do not tick their recovery.
      // Not while it keeps its wounds (ai/brain.ts WOUND_MEMORY): a fight a player walked away from is not undone.
      if (!awake && c.awake !== false)
        for (const m of c.monsters)
          if (m.alive && !((m.ext?.woundT ?? 0) > 0)) {
            m.hp = m.maxHp;
            if (m.ext) m.ext.hurtT = 0;
          }
      c.awake = awake;
    }
    const active: Monster[] = [];
    for (const m of this.monsters.values()) if (m.camp.awake !== false) active.push(m);
    this.active = active;
    for (const m of active) this.think(m, players, alivePlayers);
    this.separate(alivePlayers);
    this.updateProjectiles(alivePlayers);
    this.updateHazards(alivePlayers);
    X.extUpdate(this, players, alivePlayers, practice);

    if (practice) {
      for (const c of this.camps) {
        if (c.monsters.length) continue;
        c.clearedFor += DT;
        if (c.clearedFor >= CAMP_PRACTICE_RESPAWN && !alivePlayers.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 500)) {
          this.fillCamp(c);
        }
      }
    }
  }

  private think(m: Monster, players: Map<number, ServerPlayer>, alive: ServerPlayer[]) {
    const t = m.type;
    m.recoverT = Math.max(0, m.recoverT - DT);
    if (monsterLocked(m.id)) {
      // Stunned / frozen / electrocuted (server/damage.ts): no actions, only knockback drift.
      if (m.state === 2) {
        // Hard CC interrupts the windup: drop the attack and its pending ground telegraphs / slam.
        m.state = 1;
        if (m.ext) m.ext.atk = null;
        this.hazards = this.hazards.filter((h) => h.step || (h.owner !== m && h.caster !== m));
      }
      m.x += m.kbx * DT;
      m.y += m.kby * DT;
      m.kbx *= KB_FACTOR;
      m.kby *= KB_FACTOR;
      resolveCollisions(m, m.radius);
      return;
    }
    if (X.extThink(this, m, players, alive)) return;
    let mvx = 0;
    let mvy = 0;
    let speed = m.speed;

    if (m.state === 0) {
      let best: ServerPlayer | null = null;
      let bestD = t.aggroRadius;
      for (const p of alive) {
        if (X.extHidden(p)) continue;
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best) {
        m.state = 1;
        m.target = best.id;
      } else {
        m.wanderT -= DT;
        if (m.wanderT <= 0) {
          m.wanderT = rand(2, 5);
          const a = Math.random() * Math.PI * 2;
          m.wanderX = m.homeX + Math.cos(a) * rand(0, 60);
          m.wanderY = m.homeY + Math.sin(a) * rand(0, 60);
        }
        const dx = m.wanderX - m.x;
        const dy = m.wanderY - m.y;
        const d = Math.hypot(dx, dy);
        if (d > 6) {
          mvx = dx / d;
          mvy = dy / d;
          speed = m.speed * 0.3;
          m.angle = Math.atan2(dy, dx);
        }
      }
    }

    if (m.state === 1) {
      const p = players.get(m.target);
      if (!p || !p.alive || !p.joined || X.leashBroken(m, LEASH_RADIUS)) {
        X.beginReturn(m);
      } else {
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        m.angle = Math.atan2(dy, dx);
        const gap = d - m.radius - PLAYER_RADIUS;
        if (t.ai === "ranged") {
          if (d <= t.attackRange && m.recoverT <= 0) this.startWindup(m);
          else if (d > (t.preferredDist ?? 250) + 40) {
            mvx = dx / d;
            mvy = dy / d;
          } else if (d < (t.preferredDist ?? 250) - 70) {
            mvx = -dx / d;
            mvy = -dy / d;
            speed = m.speed * 0.8;
          }
        } else if (gap <= t.attackRange && m.recoverT <= 0) {
          this.startWindup(m);
        } else if (gap > t.attackRange * 0.6) {
          mvx = dx / d;
          mvy = dy / d;
        }
      }
    }

    if (m.state === 2) {
      m.windT += DT;
      if (t.ai === "ranged") {
        const p = players.get(m.target);
        if (p?.alive) m.angle = Math.atan2(p.y - m.y, p.x - m.x);
      }
      if (m.windT >= m.windTotal) this.release(m, players);
    }

    if (m.state === 3) {
      const dir = X.stepReturn(m);
      if (dir) {
        mvx = dir.x;
        mvy = dir.y;
        speed = m.speed * 1.2;
      }
    }

    speed *= monsterMoveMult(m.id); // chill (server/damage.ts)
    m.x += (mvx * speed + m.kbx) * DT;
    m.y += (mvy * speed + m.kby) * DT;
    m.kbx *= KB_FACTOR;
    m.kby *= KB_FACTOR;
    if (Math.abs(m.kbx) < 1) m.kbx = 0;
    if (Math.abs(m.kby) < 1) m.kby = 0;
    resolveCollisions(m, m.radius);
  }

  private startWindup(m: Monster) {
    m.state = 2;
    m.windT = 0;
    m.windTotal = m.type.windup / m.atkSpeed;
    if (m.type.slam) {
      const s = m.type.slam;
      const scale = m.radius / m.type.radius;
      this.hazards.push({
        id: this.nextId++,
        x: m.x + Math.cos(m.angle) * s.offset * scale,
        y: m.y + Math.sin(m.angle) * s.offset * scale,
        r: s.radius * scale,
        t: 0,
        delay: m.windTotal,
        dmg: m.damage,
        kb: m.type.knockback,
        source: this.displayName(m),
        owner: m,
      });
    }
  }

  private release(m: Monster, players: Map<number, ServerPlayer>) {
    const t = m.type;
    m.state = 1;
    m.recoverT = t.recover / m.atkSpeed;
    if (t.ai === "melee") {
      for (const p of players.values()) {
        if (!p.alive || !p.joined) continue;
        const dx = p.x - m.x;
        const dy = p.y - m.y;
        const d = Math.hypot(dx, dy);
        if (d - m.radius - PLAYER_RADIUS > t.attackRange + 8) continue;
        let da = Math.atan2(dy, dx) - m.angle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) > Math.PI / 3 && d > m.radius + PLAYER_RADIUS) continue;
        this.host.damagePlayer(p, m.damage, m.x, m.y, t.knockback, this.displayName(m), { form: "melee", monster: true, mon: m });
      }
    } else if (t.ai === "ranged" && t.projectile) {
      const pr = t.projectile;
      this.projectiles.push({
        id: this.nextId++,
        x: m.x + Math.cos(m.angle) * (m.radius + 4),
        y: m.y + Math.sin(m.angle) * (m.radius + 4),
        vx: Math.cos(m.angle) * pr.speed,
        vy: Math.sin(m.angle) * pr.speed,
        r: pr.radius,
        life: pr.life,
        dmg: m.damage,
        kb: t.knockback,
        source: this.displayName(m),
        owner: m,
      });
    }
    // Brutes: the slam hazard detonates on its own.
  }

  /** Monsters push each other apart and are pushed out of players (players are never pushed: they are predicted). */
  private separate(alive: ServerPlayer[]) {
    // Only awake monsters, pairs found through a bucket grid (was O(n²) over every monster).
    const ms = this.active.filter((m) => m.alive);
    const order = new Map<Monster, number>();
    ms.forEach((m, i) => order.set(m, i));
    this.sepGrid.clear();
    for (const m of ms) this.sepGrid.insert(m);
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i];
      const near: Monster[] = [];
      this.sepGrid.forNear(a.x, a.y, a.radius + 60, (b) => {
        if ((order.get(b) ?? -1) > i) near.push(b);
      });
      for (const b of near) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) / 2;
        // Static monsters (Breachway structures, speed 0) are never pushed: the other one takes the whole push.
        const sa = a.type.speed === 0;
        const sb = b.type.speed === 0;
        if (sa && sb) continue;
        const ka = sa ? 0 : sb ? 2 : 1;
        const kb = sb ? 0 : sa ? 2 : 1;
        a.x -= (dx / d) * push * ka;
        a.y -= (dy / d) * push * ka;
        b.x += (dx / d) * push * kb;
        b.y += (dy / d) * push * kb;
      }
      if (a.type.speed === 0) continue;
      for (const p of alive) {
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        const min = a.radius + PLAYER_RADIUS;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        a.x = p.x + (dx / d) * min;
        a.y = p.y + (dy / d) * min;
      }
      resolveCollisions(a, a.radius);
    }
  }

  private updateProjectiles(alive: ServerPlayer[]) {
    this.projectiles = this.projectiles.filter((pr) => {
      pr.x += pr.vx * DT;
      pr.y += pr.vy * DT;
      pr.life -= DT;
      if (pr.life <= 0 || pr.x < 0 || pr.y < 0 || pr.x > MAP_W || pr.y > MAP_H) return false;
      if (blocksProjectile(pr.x, pr.y, pr.r)) return false;
      if (pr.step) {
        const keep = pr.step(pr);
        if (keep !== null) return keep;
      }
      for (const p of alive) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < pr.r + PLAYER_RADIUS) {
          const before = p.hp;
          const meta: Record<string, unknown> = { monster: true, ...pr.meta, form: pr.meta?.form === "spell" ? "spell" : "proj" };
          if (pr.owner) meta.mon = pr.owner;
          const hit = this.host.damagePlayer(p, pr.dmg, pr.x - pr.vx, pr.y - pr.vy, pr.kb, pr.source, meta);
          if (hit === true || p.hp !== before || !p.alive) return false; // consumed; dodged / evaded projectiles fly on
        }
      }
      return true;
    });
  }

  private updateHazards(alive: ServerPlayer[]) {
    this.hazards = this.hazards.filter((h) => {
      if (h.owner && !h.owner.alive) return false;
      if (h.step) return h.step(alive);
      h.t += DT;
      if (h.t < h.delay) return true;
      if (!h.snap?.sh) this.host.boom(h.x, h.y, h.r);
      h.onFire?.();
      for (const p of alive) {
        if (p.alive && (h.hit ? h.hit(p) : Math.hypot(p.x - h.x, p.y - h.y) < h.r + PLAYER_RADIUS * 0.5)) {
          const src = h.caster ?? h.owner;
          this.host.damagePlayer(p, h.dmg, h.x, h.y, h.kb, h.source, src ? { monster: true, ...h.meta, mon: src } : h.meta);
          h.onHit?.(p);
        }
      }
      return false;
    });
  }

  // ---- snapshots ----

  monsterSnap(m: Monster): MonsterSnap {
    const s: MonsterSnap = {
      id: m.id,
      k: m.type.id,
      x: Math.round(m.x * 10) / 10,
      y: Math.round(m.y * 10) / 10,
      a: Math.round(m.angle * 100) / 100,
      hp: Math.ceil(m.hp),
      mhp: Math.ceil(m.maxHp),
      r: m.radius,
      s: m.state,
      w: m.state === 2 ? Math.round((m.windT / m.windTotal) * 100) / 100 : 0,
    };
    if (m.elite) {
      s.e = m.elite.map((e) => e.id);
      s.n = m.eliteName;
    }
    X.extSnap(m, s);
    if (m.team !== undefined) s.tm = m.team;
    if (m.focus) s.fc = m.focus;
    if (m.esMax) {
      s.es = Math.ceil(m.es ?? 0);
      s.esm = Math.ceil(m.esMax);
    }
    return s;
  }

  projSnap(p: Projectile): ProjSnap {
    return { id: p.id, x: Math.round(p.x), y: Math.round(p.y), r: p.r };
  }

  hazardSnap(h: Hazard): HazardSnap {
    const hs: HazardSnap = { id: h.id, x: Math.round(h.x), y: Math.round(h.y), r: h.r, f: Math.round(Math.min(1, h.t / h.delay) * 100) / 100 };
    return h.snap ? Object.assign(hs, h.snap) : hs;
  }

  campSnaps(): CampSnap[] {
    return this.camps.map((c) => ({
      x: Math.round(c.x),
      y: Math.round(c.y),
      n: c.monsters.length,
      e: c.monsters.some((m) => m.elite),
    }));
  }
}
