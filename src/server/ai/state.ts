// Per-monster extension state for the roster brain, rarity, modifiers, bosses and exiles.
import type { EliteMod } from "../../shared/content/monsters";
import type { AttackDef } from "../../shared/content/monsters/types";
import type { MonRarity } from "../../shared/content/monsters/mods";
import type { ExileDef } from "../../shared/content/monsters/exiles";
import type { Equipment, Item } from "../../shared/items";
import type { Monster } from "../monsters";

export interface ExileState {
  def: ExileDef;
  equip: Equipment;
  items: Item[];
  lk: string;
  wk: string | null;
  rollT: number; // > 0 while rolling (invulnerable)
  rollCd: number;
  rollDx: number;
  rollDy: number;
  flaskCd: number;
  /** Gem-driven loadout (shared/content/gems.ts), built at spawn by exileLoadout. */
  attacks: AttackDef[];
  /** Gem ids in the loadout (main skill first) and the supports linked to the main skill. */
  gems: string[];
  supports: string[];
  /** Crit chance / multiplier from the exile's gear (%), used when better than the rarity base. */
  crit: number;
  critMulti: number;
}

export interface MonExt {
  rarity: MonRarity;
  /** Monster level (MONSTER_LEVEL in shared/content/monsters/mods.ts): scales life and damage. */
  level: number;
  power: number;
  ccResist: number;
  /** Mod granted by the pack's rare leader (minions only). */
  granted: EliteMod | null;
  leader: Monster | null;
  /** Attack cooldowns by attack id. */
  cds: Record<string, number>;
  atk: AttackDef | null;
  tx: number;
  ty: number;
  fromX: number;
  fromY: number;
  // modifier timers / state
  hardStacks: number;
  hardT: number;
  lastBreathUsed: boolean;
  invulnT: number;
  phaseT: number;
  trailT: number;
  pulseT: number;
  stormT: number;
  reviveT: number;
  /** Ally-aura buffs recomputed each tick. */
  bSpeed: number;
  bRegen: number;
  bTaken: number;
  bDmg: number;
  /** Ids of adds this monster summoned (cap). */
  adds: Set<number>;
  /** Pack minions (for a rare leader: reviver / soul-link / pack ward). */
  pack: Monster[];
  /** Dead minion types awaiting a revive. */
  fallen: string[];
  boss: { phase: number; roarT: number } | null;
  exile: ExileState | null;
  /** > 0 for a few seconds after a player hit it: it does not leash (and so does not heal) while it is being fought. */
  hurtT: number;
  /** > 0 for WOUND_MEMORY seconds after a player hit it: no walk-home or idle healing (brain.ts canRecover). */
  woundT: number;
  /** Walking home (state 3): closest it got to home and how long it has made no progress (blocked). */
  retBest: number;
  retStall: number;
  /** Crumbs skipped in a row while walking home (blocked segment); settles after a few. */
  retSkips: number;
  /** Breadcrumbs of the chase (x0,y0,x1,y1,...; brain.ts trackChase): the walk home retraces them instead of a straight line into a wall. */
  trail: number[];
  /** > 0 while a living player is (or just was) close: no walk-home / idle healing, so kiting cannot reset a fight. */
  nearT: number;
  /** Seconds the chase target has been far out of reach without hitting it (gives up after a few). */
  loseT: number;
  /** Chase route around an obstacle (x0,y0,...; brain.ts chaseSteer), seconds it stays valid, and the retry delay after a failed search. */
  route: number[];
  routeT: number;
  routeCd: number;
  /** Blocked-chase probe: position at the last sample and time since it. */
  probeX: number;
  probeY: number;
  probeT: number;
}

export function newExt(): MonExt {
  return {
    rarity: 0, level: 1, power: 1, ccResist: 0, granted: null, leader: null, cds: {}, atk: null,
    tx: 0, ty: 0, fromX: 0, fromY: 0,
    hardStacks: 0, hardT: 0, lastBreathUsed: false, invulnT: 0, phaseT: 0, trailT: 0, pulseT: 0, stormT: 0, reviveT: 0,
    bSpeed: 1, bRegen: 0, bTaken: 1, bDmg: 1,
    adds: new Set(), pack: [], fallen: [], boss: null, exile: null,
    hurtT: 0, woundT: 0, retBest: Infinity, retStall: 0, retSkips: 0, trail: [], nearT: 0, loseT: 0, route: [], routeT: 0, routeCd: 0, probeX: 0, probeY: 0, probeT: 0,
  };
}

/** Every modifier active on a monster (its own + the one granted by its leader). */
export function modsOf(m: Monster): EliteMod[] {
  const own = m.elite ?? [];
  const g = m.ext?.granted;
  return g ? [...own, g] : own;
}
