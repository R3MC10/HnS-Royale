// The roster brain: any MonsterType with an `attacks` list runs here. Monsters pick a weighted
// usable attack, telegraph it (every area attack places its ground marker the moment the windup
// starts), then release. Leaps and charges travel during the end of the windup so the landing
// lines up with the marker.
import { DT, KNOCKBACK_DECAY, LEASH_RADIUS, PLAYER_RADIUS } from "../../shared/constants";
import { MONSTER_BY_ID } from "../../shared/content/monsters";
import type { AttackDef } from "../../shared/content/monsters/types";
import { isWalkable } from "../../shared/map";
import { resolveCollisions } from "../../shared/sim";
import { findPath } from "../bots/path";
import type { Hazard, Monster, MonsterSystem } from "../monsters";
import type { ServerPlayer } from "../player";
import { modsOf } from "./state";

const KB_FACTOR = Math.exp(-KNOCKBACK_DECAY * DT);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** Hidden-from-monsters check (Veilshroud shrine), installed by shrines. */
export const brainHooks = {
  hidden: (_p: ServerPlayer) => false,
  /** A monster just noticed this player (pack wake-up): hooks.ts scales it to the player's level. */
  wake: (_m: Monster, _p: ServerPlayer) => {},
};

function angDiff(a: number, b: number) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Product of a numeric mod field over all active mods. */
export function modMul(m: Monster, key: "aoeMult" | "kbMult" | "recoverMult" | "cooldownMult" | "dmgTaken"): number {
  let v = 1;
  for (const md of modsOf(m)) v *= (md[key] as number | undefined) ?? 1;
  return v;
}
function modSum(m: Monster, key: "extraProj" | "leech"): number {
  let v = 0;
  for (const md of modsOf(m)) v += (md[key] as number | undefined) ?? 0;
  return v;
}

/** Seconds after a player's hit during which a monster will not leash (monsters.ts damage / hooks.ts extIncoming). */
export const LEASH_HURT_GRACE = 4;

/** Pulled past its leash? Never while a player is hitting it: a monster under attack keeps fighting. */
export function leashBroken(m: Monster, leash: number): boolean {
  if ((m.ext?.hurtT ?? 0) > 0) return false;
  return Math.hypot(m.x - m.homeX, m.y - m.homeY) > leash;
}

/** A living player within this range keeps a monster "in combat": it does not heal (walking home or idle). */
export const COMBAT_NEAR = 900;
/** Seconds the in-combat flag lingers after the last player left that range. */
export const COMBAT_LINGER = 5;

/**
 * Seconds a monster keeps its wounds after a player's hit: no walk-home or idle healing before that (PoE2:
 * monsters do not regenerate when you step back). Exile fights at level 6-10 used to end without a result
 * half the time, and the work was lost on the walk home.
 */
export const WOUND_MEMORY = 60;

/** Out of combat: not hit recently and no living player near. Only then does a monster recover life. */
export function canRecover(m: Monster): boolean {
  const e = m.ext;
  return !e || (e.hurtT <= 0 && e.nearT <= 0 && e.woundT <= 0);
}

/** Give up the chase and walk home (state 3). */
export function beginReturn(m: Monster) {
  m.state = 3;
  if (m.ext) {
    m.ext.retBest = Infinity;
    m.ext.retStall = 0;
    m.ext.retSkips = 0;
    m.ext.loseT = 0;
  }
}

/** Chasing / attacking: drop a breadcrumb every ~48 px so the walk home can retrace the way it came. */
export function trackChase(m: Monster) {
  const e = m.ext;
  if (!e) return;
  const t = e.trail;
  const n = t.length;
  const lx = n ? t[n - 2] : m.homeX;
  const ly = n ? t[n - 1] : m.homeY;
  if (Math.hypot(m.x - lx, m.y - ly) < 48) return;
  // Loops (strafing, circling the target) are cut out: back near home or near an earlier crumb.
  if (Math.hypot(m.x - m.homeX, m.y - m.homeY) < 40) {
    t.length = 0;
    return;
  }
  for (let i = 0; i < n - 2; i += 2) {
    if (Math.hypot(m.x - t[i], m.y - t[i + 1]) < 40) {
      t.length = i + 2;
      return;
    }
  }
  if (n < 240) t.push(m.x, m.y);
}

/**
 * One tick of walking home along the chase breadcrumbs: returns the unit direction to move in, or null once
 * it is home (idle). It recovers life only out of combat (canRecover): a kiter cannot walk it back to full.
 * A blocked crumb (a leap or knockback crossed something) is skipped; after a few it settles where it stands.
 */
export function stepReturn(m: Monster): { x: number; y: number } | null {
  const ext = m.ext;
  if (canRecover(m)) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.12 * DT);
  const trail = ext?.trail;
  let tx = m.homeX;
  let ty = m.homeY;
  if (trail) {
    while (trail.length && Math.hypot(trail[trail.length - 2] - m.x, trail[trail.length - 1] - m.y) < 24) trail.length -= 2;
    if (trail.length) {
      tx = trail[trail.length - 2];
      ty = trail[trail.length - 1];
    }
  }
  const dHome = Math.hypot(m.homeX - m.x, m.homeY - m.y);
  if (dHome < 12) {
    if (trail) trail.length = 0;
    m.state = 0;
    m.target = -1;
    return null;
  }
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy) || 1;
  if (ext) {
    const left = (trail ? trail.length : 0) * 500 + d; // progress: fewer crumbs left, then closer to the next one
    if (left < ext.retBest - 4) {
      ext.retBest = left;
      ext.retStall = 0;
      ext.retSkips = 0;
    } else ext.retStall += DT;
    if (ext.retStall > 1.2) {
      if (trail && trail.length && ext.retSkips < 3) {
        trail.length -= 2; // try the crumb before it
        ext.retSkips++;
        ext.retStall = 0;
        ext.retBest = Infinity;
      } else {
        // Really blocked: settle here rather than pressing against the obstacle forever.
        if (trail) trail.length = 0;
        m.homeX = m.wanderX = m.x;
        m.homeY = m.wanderY = m.y;
        m.state = 0;
        m.target = -1;
        return null;
      }
    }
  }
  m.angle = Math.atan2(dy, dx);
  return { x: dx / d, y: dy / d };
}

/** Route searches monsters may start per tick (reset by resetChasePaths; A* is the costly part). */
let chasePathsLeft = 1;
export function resetChasePaths() {
  chasePathsLeft = 1;
}

/** Straight walk from a to b free of walls / props (sampled)? */
function clearLine(ax: number, ay: number, bx: number, by: number, r: number): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / 24);
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    if (!isWalkable(ax + (bx - ax) * f, ay + (by - ay) * f, r)) return false;
  }
  return true;
}

/**
 * Chasing toward a target: monsters walk straight, so a wall or a tree line between them and the player used
 * to stop the whole pack. When one makes no headway it asks for a short route around the obstacle and follows
 * it until the straight line is clear again. Returns the unit direction to move in.
 */
function chaseSteer(m: Monster, p: { x: number; y: number }, dirX: number, dirY: number, speed: number): { x: number; y: number } {
  const ext = m.ext!;
  const route = ext.route;
  if (ext.routeCd > 0) ext.routeCd -= DT;
  if (route.length) {
    ext.routeT -= DT;
    while (route.length && Math.hypot(route[0] - m.x, route[1] - m.y) < 22) route.splice(0, 2);
    if (ext.routeT <= 0 || !route.length || clearLine(m.x, m.y, p.x, p.y, m.radius)) route.length = 0;
    else {
      const dx = route[0] - m.x;
      const dy = route[1] - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.angle = Math.atan2(dy, dx);
      return { x: dx / d, y: dy / d };
    }
  }
  // Blocked probe: every 0.4 s, did it cover at least a third of the ground it should have?
  ext.probeT += DT;
  if (ext.probeT >= 0.4) {
    const moved = Math.hypot(m.x - ext.probeX, m.y - ext.probeY);
    const blocked = ext.probeT < 0.6 && moved < speed * ext.probeT * 0.35;
    ext.probeX = m.x;
    ext.probeY = m.y;
    ext.probeT = 0;
    if (blocked && ext.routeCd <= 0 && chasePathsLeft > 0 && !clearLine(m.x, m.y, p.x, p.y, m.radius)) {
      chasePathsLeft--;
      const path = findPath(m.x, m.y, p.x, p.y, 4000);
      if (path && path.length) {
        for (const w of path.slice(0, 40)) route.push(w.x, w.y);
        ext.routeT = 6;
      } else ext.routeCd = 2; // no way round within the budget: do not search again right away
    }
  }
  return { x: dirX, y: dirY };
}

/** Usable attacks for the monster's current phase. */
function attacksOf(m: Monster): AttackDef[] {
  const ph = m.ext?.boss?.phase ?? 0;
  return (m.ext?.exile?.attacks ?? m.type.attacks ?? []).filter((a) => (a.phase ?? 0) <= ph);
}

/** Body gap for melee-ish kinds, centre distance otherwise. */
function rangeTo(m: Monster, a: AttackDef, d: number) {
  return a.kind === "melee" || a.kind === "slam" || a.kind === "nova" ? d - m.radius - PLAYER_RADIUS : d;
}

export function chooseAttack(m: Monster, d: number): AttackDef | null {
  const ext = m.ext!;
  let total = 0;
  const ok: AttackDef[] = [];
  for (const a of attacksOf(m)) {
    if ((ext.cds[a.id] ?? 0) > 0) continue;
    const r = rangeTo(m, a, d);
    if (r > a.range || d < (a.minRange ?? 0)) continue;
    if (a.kind === "summon" && a.summon && countAdds(m) >= a.summon.max) continue;
    ok.push(a);
    total += a.weight;
  }
  let r = Math.random() * total;
  for (const a of ok) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return null;
}

function countAdds(m: Monster) {
  let n = 0;
  for (const id of m.ext!.adds) if (id) n++;
  return n;
}

/** Move + knockback integration (shared by every roster AI). */
export function integrate(sys: MonsterSystem, m: Monster, mvx: number, mvy: number, speed: number) {
  const mult = sys.moveMult(m) * (m.ext?.bSpeed ?? 1);
  m.x += (mvx * speed * mult + m.kbx) * DT;
  m.y += (mvy * speed * mult + m.kby) * DT;
  m.kbx *= KB_FACTOR;
  m.kby *= KB_FACTOR;
  if (Math.abs(m.kbx) < 1) m.kbx = 0;
  if (Math.abs(m.kby) < 1) m.kby = 0;
  resolveCollisions(m, m.radius);
}

/** Damage scaled by attack, ally auras and pack boosts. */
function hitDmg(m: Monster, a: AttackDef) {
  return m.damage * a.dmg * (m.ext?.bDmg ?? 1);
}

function meta(a: AttackDef, m?: Monster): Record<string, unknown> {
  const o: Record<string, unknown> = { form: a.form ?? (a.kind === "melee" || a.kind === "proj" ? "attack" : "area"), element: a.element ?? "phys", monster: true };
  if (m) o.mon = m; // crit, Thornwake retaliation, Bonebreaker stun (server/damage.ts legacySpec)
  if (a.ignite || a.chill) o.force = { ignitePct: a.ignite || undefined, chillDur: a.chill || undefined };
  return o;
}

/** Lingering ground pool (sludge, sap, embers). */
export function addPool(sys: MonsterSystem, x: number, y: number, pool: { r: number; dur: number; dps: number; slow?: number; color: string }, source: string) {
  let t = 0;
  let tickT = 0;
  const h: Hazard = {
    id: sys.allocId(), x, y, r: pool.r, t: 0, delay: pool.dur, dmg: 0, kb: 0, source, owner: null,
    snap: { sh: "pool", c: pool.color },
    step: (alive) => {
      t += DT;
      h.t = t;
      tickT -= DT;
      if (tickT <= 0) {
        tickT = 0.5;
        for (const p of alive) {
          if (p.alive && Math.hypot(p.x - x, p.y - y) < pool.r) sys.host.damagePlayer(p, pool.dps * 0.5, x, y, 0, source, { form: "dot", monster: true });
        }
      }
      return t < pool.dur;
    },
  };
  (h as Hazard & { pool?: typeof pool }).pool = pool;
  sys.hazards.push(h);
  return h;
}

/** Players' slow from standing in pools (min of all). */
export function poolSlow(sys: MonsterSystem, p: ServerPlayer): number {
  let s = 1;
  for (const h of sys.hazards) {
    const pool = (h as Hazard & { pool?: { slow?: number; r: number } }).pool;
    if (pool?.slow && Math.hypot(p.x - h.x, p.y - h.y) < pool.r) s = Math.min(s, pool.slow);
  }
  return s;
}

/** Push a telegraphed hazard owned by the monster (detonates when the windup ends). */
function telegraph(sys: MonsterSystem, m: Monster, a: AttackDef, x: number, y: number, r: number, delay: number, extra: Partial<Hazard> = {}): Hazard {
  const kb = (a.kb ?? m.type.knockback) * modMul(m, "kbMult");
  const leech = modSum(m, "leech");
  const h: Hazard = {
    id: sys.allocId(), x, y, r, t: 0, delay, dmg: hitDmg(m, a), kb, source: sys.displayName(m), owner: m, caster: m, meta: meta(a, m),
    onHit: leech > 0 ? () => (m.hp = Math.min(m.maxHp, m.hp + hitDmg(m, a) * leech)) : undefined,
    ...extra,
  };
  if (a.pool) {
    const pool = a.pool;
    const prev = h.onFire;
    h.onFire = () => {
      prev?.();
      addPool(sys, h.x, h.y, { ...pool, r: Math.max(pool.r, r * 0.9) }, `${sys.displayName(m)}'s ${a.id.replace(/_/g, " ")}`);
    };
  }
  sys.hazards.push(h);
  return h;
}

/** Clamp a ground point to walkable ground near it (leap landings). */
function landable(x: number, y: number, r: number, fx: number, fy: number) {
  for (let i = 0; i <= 6; i++) {
    const t = 1 - i / 6;
    const lx = fx + (x - fx) * t;
    const ly = fy + (y - fy) * t;
    if (isWalkable(lx, ly, r, 6)) return { x: lx, y: ly };
  }
  return { x: fx, y: fy };
}

export function startAttack(sys: MonsterSystem, m: Monster, a: AttackDef, target: { x: number; y: number }) {
  const ext = m.ext!;
  m.state = 2;
  m.windT = 0;
  m.windTotal = a.windup / m.atkSpeed;
  ext.atk = a;
  ext.fromX = m.x;
  ext.fromY = m.y;
  m.angle = Math.atan2(target.y - m.y, target.x - m.x);
  const aoe = modMul(m, "aoeMult");
  const size = m.radius / m.type.radius;
  const W = m.windTotal;
  switch (a.kind) {
    case "melee": {
      const reach = m.radius + (a.radius ?? 30) * aoe + PLAYER_RADIUS * 0.5;
      const arc = a.arc ?? Math.PI / 2;
      const ang = m.angle;
      telegraph(sys, m, a, m.x, m.y, reach, W, {
        snap: { sh: "cone", a: Math.round(ang * 100) / 100, arc: Math.round(arc * 100) / 100 },
        hit: (p) => {
          const d = Math.hypot(p.x - m.x, p.y - m.y);
          if (d > reach + PLAYER_RADIUS * 0.5) return false;
          return d < m.radius + PLAYER_RADIUS || Math.abs(angDiff(Math.atan2(p.y - m.y, p.x - m.x), ang)) <= arc / 2 + 0.15;
        },
      });
      break;
    }
    case "slam": {
      const off = (a.offset ?? 40) * size;
      telegraph(sys, m, a, m.x + Math.cos(m.angle) * off, m.y + Math.sin(m.angle) * off, (a.radius ?? 70) * size * aoe, W);
      break;
    }
    case "nova":
      telegraph(sys, m, a, m.x, m.y, (a.radius ?? 100) * size * aoe, W, { snap: { sh: "ring" } });
      break;
    case "leap": {
      const d = Math.min(a.range, Math.hypot(target.x - m.x, target.y - m.y));
      const land = landable(m.x + Math.cos(m.angle) * d, m.y + Math.sin(m.angle) * d, m.radius, m.x, m.y);
      ext.tx = land.x;
      ext.ty = land.y;
      telegraph(sys, m, a, land.x, land.y, (a.radius ?? 50) * aoe * Math.max(1, size * 0.8), W);
      break;
    }
    case "charge": {
      const len = Math.min(a.range, Math.hypot(target.x - m.x, target.y - m.y) + 50);
      const ang = m.angle;
      const w = (a.width ?? 40) * aoe;
      const sx = m.x;
      const sy = m.y;
      const land = a.noMove ? { x: sx, y: sy } : landable(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, m.radius, sx, sy);
      const L = a.noMove ? len : Math.hypot(land.x - sx, land.y - sy);
      ext.tx = land.x;
      ext.ty = land.y;
      telegraph(sys, m, a, sx, sy, L, W, {
        snap: { sh: "line", a: Math.round(ang * 100) / 100, len: Math.round(L), w: Math.round(w) },
        hit: (p) => {
          const dx = p.x - sx;
          const dy = p.y - sy;
          const along = dx * Math.cos(ang) + dy * Math.sin(ang);
          const across = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
          return along > -PLAYER_RADIUS && along < L + PLAYER_RADIUS && across < w / 2 + PLAYER_RADIUS * 0.6;
        },
      });
      break;
    }
    case "ground":
      telegraph(sys, m, a, target.x, target.y, (a.radius ?? 56) * aoe, W);
      break;
    case "rain": {
      const n = a.count ?? 4;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dd = i === 0 ? 0 : rand(50, 140);
        telegraph(sys, m, a, target.x + Math.cos(ang) * dd, target.y + Math.sin(ang) * dd, (a.radius ?? 44) * aoe, W + i * 0.12, { owner: null });
      }
      break;
    }
    case "proj":
    case "summon":
      break;
  }
}

export function release(sys: MonsterSystem, m: Monster, players: Map<number, ServerPlayer>) {
  const ext = m.ext!;
  const a = ext.atk;
  m.state = 1;
  ext.atk = null;
  if (!a) return;
  m.recoverT = (a.recover * modMul(m, "recoverMult")) / m.atkSpeed;
  ext.cds[a.id] = a.cooldown * modMul(m, "cooldownMult");
  const p = players.get(m.target);
  if (a.kind === "proj") {
    if (p?.alive) m.angle = Math.atan2(p.y - m.y, p.x - m.x);
    const n = (a.count ?? 1) + modSum(m, "extraProj");
    const spread = (a.spread ?? 0) + (n > (a.count ?? 1) ? 0.25 : 0);
    for (let i = 0; i < n; i++) {
      const ang = m.angle + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
      const sp = a.speed ?? 240;
      sys.projectiles.push({
        id: sys.allocId(),
        x: m.x + Math.cos(ang) * (m.radius + 4),
        y: m.y + Math.sin(ang) * (m.radius + 4),
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        r: a.projR ?? 8,
        life: a.life ?? 2,
        dmg: hitDmg(m, a),
        kb: a.kb ?? m.type.knockback,
        source: sys.displayName(m),
        owner: m,
        meta: { ...meta(a, m), form: a.form === "spell" ? "spell" : "proj" }, // element / ignite / chill ride along
      });
    }
  } else if (a.kind === "summon" && a.summon) {
    const t = MONSTER_BY_ID.get(a.summon.type);
    if (t) {
      const n = Math.min(a.count ?? 1, a.summon.max - countAdds(m));
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const at = landable(m.x + Math.cos(ang) * (m.radius + 40), m.y + Math.sin(ang) * (m.radius + 40), t.radius, m.x, m.y);
        const add = sys.spawnMonster(m.camp, t, false, at);
        add.state = 1;
        add.target = m.target;
        add.homeX = m.homeX;
        add.homeY = m.homeY;
        ext.adds.add(add.id);
        if (add.ext) add.ext.leader = m;
      }
      sys.host.boom(m.x, m.y, m.radius + 30);
    }
  }
  // Storm-Marked: every attack also calls a delayed bolt on the target's position.
  if (p?.alive) {
    for (const md of modsOf(m)) {
      if (!md.stormMark) continue;
      const sm = md.stormMark;
      sys.hazards.push({
        id: sys.allocId(), x: p.x, y: p.y, r: sm.radius, t: 0, delay: sm.delay, dmg: m.damage * sm.dmg, kb: 150,
        source: `${sys.displayName(m)}'s storm mark`, owner: null, meta: { form: "area", element: "lightning", monster: true, mon: m },
      });
    }
  }
}

/** Windup step: leaps and charges travel over the last part of the windup. */
function stepWindup(sys: MonsterSystem, m: Monster, players: Map<number, ServerPlayer>) {
  const ext = m.ext!;
  const a = ext.atk;
  m.windT += DT;
  if (a && (a.kind === "proj" || a.kind === "summon")) {
    const p = players.get(m.target);
    if (p?.alive) m.angle = Math.atan2(p.y - m.y, p.x - m.x);
  }
  if (a && (a.kind === "leap" || (a.kind === "charge" && !a.noMove))) {
    const start = a.kind === "leap" ? 0.55 : 0.65;
    const f = m.windT / m.windTotal;
    if (f > start) {
      const t = Math.min(1, (f - start) / (1 - start));
      const e = t * t * (3 - 2 * t);
      m.x = ext.fromX + (ext.tx - ext.fromX) * e;
      m.y = ext.fromY + (ext.ty - ext.fromY) * e;
    }
  }
  if (m.windT >= m.windTotal) release(sys, m, players);
}

/**
 * Generic brain for roster monsters (rusher / ranged / caster / brute / swarm / boss). Returns false
 * for the original three types so their legacy AI keeps running untouched.
 */
export function thinkRoster(sys: MonsterSystem, m: Monster, players: Map<number, ServerPlayer>, alive: ServerPlayer[]): boolean {
  if (!m.ext || !(m.type.attacks || m.ext.exile)) return false;
  const ext = m.ext;
  for (const k in ext.cds) if (ext.cds[k] > 0) ext.cds[k] -= DT;
  if (sys.locked(m)) {
    integrate(sys, m, 0, 0, 0);
    return true;
  }
  const t = m.type;
  let mvx = 0;
  let mvy = 0;
  let speed = m.speed;

  if (ext.boss && ext.boss.roarT > 0) {
    ext.boss.roarT -= DT;
    integrate(sys, m, 0, 0, 0);
    return true;
  }

  if (m.state === 0) {
    let best: ServerPlayer | null = null;
    let bestD = t.aggroRadius * (ext.rarity >= 2 ? 1.15 : 1);
    for (const p of alive) {
      if (brainHooks.hidden(p)) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      m.state = 1;
      m.target = best.id;
      brainHooks.wake(m, best);
      // A pack wakes together.
      for (const o of m.camp.monsters) if (o.state === 0 && o !== m) {
        o.state = 1;
        o.target = best.id;
        brainHooks.wake(o, best);
      }
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
    const leash = LEASH_RADIUS * (ext.boss ? 1.2 : 1);
    // A veiled player stays unnoticed only until they hit it: then it fights back instead of healing the hits off.
    // Target far out of reach and not hitting it (outran it, or it is stuck behind a wall): give up after 3 s.
    if (p && ext.hurtT <= 0 && Math.hypot(p.x - m.x, p.y - m.y) > Math.max(600, t.aggroRadius * 1.8)) ext.loseT += DT;
    else ext.loseT = 0;
    if (!p || !p.alive || !p.joined || leashBroken(m, leash) || ext.loseT > 3 || (brainHooks.hidden(p) && ext.hurtT <= 0)) {
      beginReturn(m);
    } else {
      trackChase(m);
      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.angle = Math.atan2(dy, dx);
      const a = m.recoverT <= 0 ? chooseAttack(m, d) : null;
      if (a) startAttack(sys, m, a, p);
      else {
        const pref = ext.exile?.def.kite ?? t.preferredDist;
        if (pref) {
          if (d > pref + 40) {
            mvx = dx / d;
            mvy = dy / d;
          } else if (d < pref - 70) {
            mvx = -dx / d;
            mvy = -dy / d;
            speed = m.speed * 0.8;
          } else {
            // strafe around the target while keeping range
            const s = m.id % 2 ? 1 : -1;
            mvx = (-dy / d) * s * 0.6;
            mvy = (dx / d) * s * 0.6;
          }
        } else {
          const melee = Math.min(...attacksOf(m).filter((x) => x.kind === "melee" || x.kind === "slam").map((x) => x.range), 30);
          const gap = d - m.radius - PLAYER_RADIUS;
          if (gap > melee * 0.6) {
            // swarms come in from slightly different angles
            const j = t.ai === "swarm" ? Math.sin(m.id * 1.7) * 0.5 : 0;
            const c = Math.cos(j);
            const s = Math.sin(j);
            mvx = (dx / d) * c - (dy / d) * s;
            mvy = (dx / d) * s + (dy / d) * c;
          }
        }
      }
    }
  }

  // Closing in on the target (not strafing / backing off / attacking): steer around obstacles.
  if (m.state === 1 && (mvx || mvy)) {
    const p = players.get(m.target);
    if (p && mvx * (p.x - m.x) + mvy * (p.y - m.y) > 0.7 * Math.hypot(p.x - m.x, p.y - m.y) * Math.hypot(mvx, mvy)) {
      const dir = chaseSteer(m, p, mvx, mvy, speed * sys.moveMult(m));
      mvx = dir.x;
      mvy = dir.y;
    } else ext.probeT = 0.7; // stale probe: start a fresh sample when it closes in again
  } else if (m.state !== 1) {
    ext.route.length = 0;
    ext.probeT = 0.7;
  }

  if (m.state === 2) {
    stepWindup(sys, m, players);
    trackChase(m); // leaps / charges move it too
  }

  if (m.state === 3) {
    // Walking home but a player is right there and home is not far: fight again (no free reset by stepping back).
    if (Math.hypot(m.x - m.homeX, m.y - m.homeY) < LEASH_RADIUS * 0.5) {
      for (const p of alive) {
        if (brainHooks.hidden(p) || Math.hypot(p.x - m.x, p.y - m.y) > t.aggroRadius) continue;
        m.state = 1;
        m.target = p.id;
        break;
      }
    }
  }
  if (m.state === 3) {
    const dir = stepReturn(m);
    if (dir) {
      mvx = dir.x;
      mvy = dir.y;
      speed = m.speed * 1.2;
    }
  }
  integrate(sys, m, mvx, mvy, speed);
  return true;
}
