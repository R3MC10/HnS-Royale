// Shared data shapes for the monster roster (content as data, no logic). Owned by the monsters agent.

/** How an attack is delivered. Every area kind is telegraphed with a ground marker during its windup. */
export type AttackKind =
  | "melee" // cone in front (red wedge telegraph)
  | "proj" // projectile(s) toward the target (dodge-rollable)
  | "slam" // circle in front of the monster
  | "nova" // circle (or ring) around the monster
  | "leap" // jumps onto the target's position, circle marker where it lands
  | "charge" // dashes along a line, line marker
  | "ground" // circle under the target (caster eruption)
  | "rain" // several circles around the target
  | "summon"; // calls adds (a short glowing windup, no damage)

export interface AttackDef {
  id: string;
  kind: AttackKind;
  /** Max distance (body gap for melee / slam / nova, centre distance otherwise) to start the attack. */
  range: number;
  minRange?: number;
  windup: number; // s of telegraph
  recover: number; // s locked after release
  cooldown: number; // s before this attack can be picked again
  weight: number;
  dmg: number; // multiplier on the monster's damage
  radius?: number; // area radius / melee reach
  arc?: number; // melee cone (radians)
  offset?: number; // slam: distance in front
  count?: number; // proj / rain / summon count
  spread?: number; // proj fan (radians)
  speed?: number; // proj speed
  life?: number; // proj life
  projR?: number;
  width?: number; // charge line width
  kb?: number; // knockback (default type knockback)
  /** Lingering ground left by the attack (sludge, sap, embers). */
  pool?: PoolDef;
  /** summon: monster type id and a cap on living adds from this monster. */
  summon?: { type: string; max: number };
  /** charge: the monster stays put (a lash / beam along the line instead of a dash). */
  noMove?: boolean;
  /** Bosses: only used from this phase on (0-based). */
  phase?: number;
  /** "area" hits can't be rolled through (PoE2 rule); "unblockable" ignores block (red flash). */
  form?: "attack" | "spell" | "area";
  element?: "phys" | "fire" | "cold" | "lightning" | "chaos";
  /** Guaranteed ignite (fraction of the hit over 3 s) / chill (s) on hit (exile gem supports). */
  ignite?: number;
  chill?: number;
}

export interface PoolDef {
  r: number;
  dur: number;
  dps: number;
  slow?: number; // move speed multiplier while inside (0.6 = 40% slower)
  color: string; // css
}

/** Visual / audio family (audio: mon.<fam>.*). */
export type MonFamily = "beast" | "caster" | "brute" | "undead" | "spirit";

export interface BossPhase {
  /** Enter this phase when life falls below this fraction. */
  below: number;
  name: string; // shout shown on entering
  speedMult: number;
  atkSpeedMult: number;
  /** Adds summoned on entering the phase. */
  adds?: { type: string; count: number };
}

export interface BossInfo {
  title: string; // shown under the name
  hpMult: number; // on top of unique rarity
  phases: BossPhase[];
  /** 1.4 s invulnerable roar + knockback nova when a phase starts. */
  roar: { radius: number; dmg: number };
}
