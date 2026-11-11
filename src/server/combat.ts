// Combat resolution (server-only, authoritative). Kept separate so the
// mechanics can be iterated on without touching networking or phases.
import { ATTACK_COMMIT, PLAYER_RADIUS, PVP_DAMAGE_MULT } from "../shared/constants";
import type { GameEvent } from "../shared/protocol";
import { isInvulnerable } from "../shared/sim";
import type { Monster, MonsterSystem } from "./monsters";
import type { ServerPlayer } from "./player";
import { fireRangedBasic } from "./skills";
import { progAfterHit, progAfterSwing, progHitMult } from "./progression";
import { hitMonster, hitPlayer, legacySpec, type DamageMeta } from "./damage";

/** Smallest signed difference between two angles, in [-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True if a circle (x, y, r) is inside the attacker's swing cone. */
export function inSwing(attacker: ServerPlayer, x: number, y: number, r: number): boolean {
  const dx = x - attacker.x;
  const dy = y - attacker.y;
  const dist = Math.hypot(dx, dy);
  // Center distance <= reach + target radius (for players: ATTACK_RANGE + PLAYER_RADIUS, as before).
  if (dist > attacker.stats.attackRange + r) return false;
  if (dist < Math.max(PLAYER_RADIUS, r)) return true; // overlapping centers: always hits
  return Math.abs(angleDiff(Math.atan2(dy, dx), attacker.angle)) <= attacker.stats.attackArc / 2;
}

export interface CombatHost {
  events: GameEvent[];
  monsters: MonsterSystem;
  onPlayerKilled(victim: ServerPlayer, killer: ServerPlayer | null, source: string): void;
  onMonsterKilled(m: Monster, killer: ServerPlayer): void;
}

/**
 * Apply damage to a player from any source. Ignored during dodge i-frames.
 * Returns true if damage was applied.
 */
export function damagePlayer(
  host: CombatHost,
  t: ServerPlayer,
  dmg: number,
  fromX: number,
  fromY: number,
  kb: number,
  attacker: ServerPlayer | null,
  source: string,
  attackerId = -1,
  meta?: DamageMeta,
): boolean {
  if (!t.alive || isInvulnerable(t, t.stats)) return false;
  // Loot taken / knockback / dealt multipliers, after-hit effects and thorns run as defence hooks
  // (server/defloot.ts) so they apply to every hit exactly once.
  // Defence pipeline (server/damage.ts): evasion, block, armour, resistances, energy shield, ailments.
  void attackerId;
  const r = hitPlayer(host, t, legacySpec(dmg, fromX, fromY, kb, attacker, source, meta, t.x, t.y));
  if (r.outcome === "dodged" || r.outcome === "immune" || r.outcome === "evaded") return false; // evaded projectiles fly on
  return true;
}

/**
 * Attack timing after each simulated input. A swing that starts schedules its hit at the commit
 * point (ATTACK_COMMIT of the swing); the hit lands once atkT has run down to it. A dodge roll before
 * the commit point cancels the attack (sim.ts zeroes atkT and starts the roll).
 */
export function stepAttack(host: CombatHost, p: ServerPlayer, swung: boolean, enabled: boolean, players: Iterable<ServerPlayer>) {
  if (swung) p.hitAt = p.stats.swingTime * (1 - ATTACK_COMMIT);
  if (p.hitAt < 0) return;
  if (!p.alive || p.rollT > 0) {
    p.hitAt = -1; // died or rolled out of the attack
    return;
  }
  if (p.atkT > p.hitAt + 1e-9) return;
  p.hitAt = -1;
  if (enabled && !fireRangedBasic(host, p)) resolveSwing(host, p, players); // bows/crossbows shoot (server/skills.ts)
}

/** Resolve a swing at its commit point against players and monsters. */
export function resolveSwing(host: CombatHost, attacker: ServerPlayer, players: Iterable<ServerPlayer>) {
  const st = attacker.stats;
  let hits = 0; // progression: on-hit passives
  for (const t of players) {
    if (t === attacker || !t.alive || !t.joined) continue;
    if (!inSwing(attacker, t.x, t.y, PLAYER_RADIUS)) continue;
    const pd = st.attackDamage * PVP_DAMAGE_MULT * progHitMult(attacker, { p: t });
    if (damagePlayer(host, t, pd, attacker.x, attacker.y, st.knockback, attacker, attacker.name)) {
      hits++;
      progAfterHit(attacker, pd, { p: t });
    }
  }
  for (const m of [...host.monsters.monsters.values()]) {
    if (!m.alive || !inSwing(attacker, m.x, m.y, m.radius)) continue;
    const md = st.attackDamage * progHitMult(attacker, { m });
    hits++;
    // Defence pipeline (server/damage.ts): hit event, kill handling and ailment buildup.
    hitMonster(host, m, { dmg: { phys: md }, by: attacker, source: attacker.name, form: "melee", x: attacker.x, y: attacker.y, kb: st.knockback });
    progAfterHit(attacker, md, { m });
  }
  progAfterSwing(attacker, hits);
}
