// Tiny hook table the lane mode (server/modes/lanes.ts) fills while a Breachway match runs. The core
// systems (monster hooks, damage chokepoints, progression) check it; in the royale it stays inactive.
import type { EliteMod } from "../../shared/content/monsters";
import type { Monster, MonsterSystem } from "../monsters";
import type { ServerPlayer } from "../player";

export const laneHook = {
  active: false,
  /** Monster brain override: true = handled. */
  think: null as null | ((sys: MonsterSystem, m: Monster, players: Map<number, ServerPlayer>) => boolean),
  /** Player -> monster damage filter (team, structure order, fortification, backdoor). */
  incoming: null as null | ((m: Monster, dmg: number, attacker: ServerPlayer | null) => number),
  /** True when this player may not be hurt by that player / monster (same team). */
  friendly: null as null | ((t: ServerPlayer, by: ServerPlayer | null | undefined, mon: Monster | null | undefined) => boolean),
  /** A trial shrine spawned this guard / Warden (scale it to the lane level). */
  trialSpawn: null as null | ((m: Monster) => void),
};

/** Elite mods that do not fit a lane (doc section 6): summons, bubbles, ground pools, auras that hurt everyone. */
export function laneModAllowed(md: EliteMod): boolean {
  const m = md as EliteMod & Record<string, unknown>;
  return !(m.nearOnly || m.sphere || m.raiseOnDeath || m.splitOnDeath || m.revive || m.thirstAura || m.pulse || m.trail || m.deathPool || m.deathBlast || m.stormcall);
}
