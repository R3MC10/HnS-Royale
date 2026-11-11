// Monster types, elite modifiers and pack composition. All names are original.

import type { AttackDef, BossInfo, MonFamily, PoolDef } from "./monsters/types";
import { ROSTER } from "./monsters/roster";
import { MONSTER_MODS } from "./monsters/mods";

/** melee / ranged / brute: the original three AIs. The rest run the attack-list brain (server/ai/brain.ts). */
export type MonsterAi = "melee" | "ranged" | "brute" | "rusher" | "caster" | "swarm" | "boss" | "exile";

export interface MonsterType {
  id: string;
  name: string;
  ai: MonsterAi;
  color: string;
  radius: number;
  hp: number;
  speed: number; // px/s
  aggroRadius: number;
  damage: number;
  attackRange: number; // distance between bodies at which it starts an attack
  windup: number; // s of telegraph before the attack lands
  recover: number; // s after an attack before it can act again
  knockback: number; // knockback dealt to players
  kbResist: number; // 0..1, fraction of incoming knockback ignored
  packWeight: number;
  preferredDist?: number; // ranged: tries to keep this distance
  projectile?: { speed: number; radius: number; life: number };
  slam?: { radius: number; offset: number };
  // ---- roster extensions (monsters agent) ----
  /** Attack list: present = the generic attack brain runs this type. */
  attacks?: AttackDef[];
  /** Visual / audio family. */
  family?: MonFamily;
  /** Pack size when this type leads a camp (swarms come in numbers). */
  packCount?: [number, number];
  /** Telegraphed pop on death (swarms). */
  deathPop?: { radius: number; delay: number; dmg: number };
  /** Bosses: phases, title, roar. */
  boss?: BossInfo;
}

export const MONSTER_TYPES: MonsterType[] = [
  {
    id: "gnashling", name: "Gnashling", ai: "melee", color: "#c27840",
    radius: 15, hp: 40, speed: 200, aggroRadius: 300,
    damage: 8, attackRange: 26, windup: 0.32, recover: 0.6, knockback: 220, kbResist: 0,
    packWeight: 50,
  },
  {
    id: "bog_seer", name: "Bog Seer", ai: "ranged", color: "#5fa37a",
    radius: 16, hp: 32, speed: 135, aggroRadius: 380,
    damage: 13, attackRange: 360, windup: 0.55, recover: 1.4, knockback: 150, kbResist: 0,
    packWeight: 30, preferredDist: 260,
    projectile: { speed: 230, radius: 9, life: 2.4 },
  },
  {
    id: "cragback", name: "Cragback", ai: "brute", color: "#8a7f72",
    radius: 28, hp: 150, speed: 100, aggroRadius: 260,
    damage: 28, attackRange: 46, windup: 0.95, recover: 1.1, knockback: 650, kbResist: 0.8,
    packWeight: 20,
    slam: { radius: 72, offset: 42 },
  },
];

export const MONSTER_BY_ID = new Map(MONSTER_TYPES.map((m) => [m.id, m]));

export const PACK_SIZE: [number, number] = [3, 6];

// ---- Elites ---------------------------------------------------------------

export const ELITE_BASE = { hpMult: 2.5, dmgMult: 1.3, sizeMult: 1.3, modCount: [1, 2] as [number, number] };

export interface EliteMod {
  id: string;
  name: string;
  speedMult?: number;
  attackSpeedMult?: number;
  hpMult?: number;
  /** Explodes after death: a telegraphed blast. */
  deathBlast?: { radius: number; delay: number; damage: number };
  /** Slows players inside the aura (multiplies their move speed). */
  frostAura?: { radius: number; slow: number };
  // ---- modifier pool extensions (content/monsters/mods.ts; effects in server/ai/modfx.ts) ----
  family?: "offence" | "defence" | "aura" | "hazard" | "minion" | "bubble";
  color?: string;
  /** A rare can grant this mod to its pack's minions. */
  minion?: boolean;
  /** Only rolls on types with this attack kind. */
  needs?: "proj";
  dmgMult?: number;
  sizeMult?: number;
  extraProj?: number;
  aoeMult?: number;
  kbMult?: number;
  stunMult?: number;
  stormMark?: { radius: number; delay: number; dmg: number };
  recoverMult?: number;
  cooldownMult?: number;
  leech?: number;
  dmgTaken?: number;
  regen?: number;
  hardening?: { per: number; max: number; reset: number };
  kbImmune?: boolean;
  ccResist?: number;
  thorns?: number;
  lastBreath?: number;
  allyAura?: { radius: number; speed?: number; regen?: number; dmgTaken?: number; dmg?: number };
  thirstAura?: { radius: number; perSec: number };
  trail?: { every: number } & PoolDef;
  pulse?: { every: number; radius: number; delay: number; dmg: number };
  deathPool?: PoolDef;
  stormcall?: { every: number; count: number; radius: number; delay: number; dmg: number };
  splitOnDeath?: number;
  raiseOnDeath?: number;
  packWard?: number;
  revive?: { every: number };
  packBoost?: { dmg: number; speed: number };
  soulLink?: number;
  /** Added critical strike chance (percentage points) and multiplier (% points) on this monster's hits. */
  critChance?: number;
  critMulti?: number;
  nearOnly?: number;
  sphere?: number;
  phasing?: { every: number; dur: number };
}

export const ELITE_MODS: EliteMod[] = [
  { id: "frenzied", name: "Frenzied", speedMult: 1.35, attackSpeedMult: 1.35 },
  { id: "ironhide", name: "Ironhide", hpMult: 2 },
  { id: "volatile", name: "Volatile", deathBlast: { radius: 110, delay: 1.0, damage: 28 } },
  { id: "rimecloaked", name: "Rimecloaked", frostAura: { radius: 170, slow: 0.7 } },
];

// Roster + modifier pool (content/monsters/*.ts) join the shared tables so every lookup finds them.
MONSTER_TYPES.push(...ROSTER);
for (const t of ROSTER) MONSTER_BY_ID.set(t.id, t);
for (const m of MONSTER_MODS) {
  const old = ELITE_MODS.find((e) => e.id === m.id);
  if (old) Object.assign(old, m);
  else ELITE_MODS.push(m);
}

export const ELITE_MOD_BY_ID = new Map(ELITE_MODS.map((m) => [m.id, m]));

/** Elite names are built as A + B, e.g. "Mirefang". */
export const ELITE_NAME_A = ["Grudge", "Mire", "Ash", "Hollow", "Rot", "Cinder", "Gloam", "Bramble", "Sleet", "Gall"];
export const ELITE_NAME_B = ["maw", "hide", "wretch", "spawn", "fang", "husk", "jaw", "gut", "knuckle", "brood"];
