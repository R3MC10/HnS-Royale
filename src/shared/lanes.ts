// Breachway (lane mode, docs/MODE-LANES.md): fixed layout shared by the server and the client.
// One lane, two bases. Team 0 (Dawn) sits on the left (west), team 1 (Dusk) on the right (east).
import type { MonsterType } from "./content/monsters";
import { MONSTER_BY_ID } from "./content/monsters";
import { BASES } from "./content/bases";
import { ROUGH_SKILL, ROUGH_SPIRIT, ROUGH_SUPPORT } from "./content/gems";
import type { Item } from "./items";

export type GameMode = "royale" | "lanes";
export type Team = 0 | 1;

export const LANE = {
  // Enlarged (was 7168 x 1536): 1.71x longer, 1.83x taller, with jungle glades above and below the band.
  w: 12288,
  h: 2816,
  /** Lane centre line (mobs march on it). */
  y: 1408,
  /** Lane band (walkable) between the bases. */
  bandTop: 960,
  bandBot: 1856,
  /** Base rectangles: x 0-1792 (Dawn) and 10496-12288 (Dusk), y 448-2368. */
  baseW: 1792,
  baseTop: 448,
  baseBot: 2368,
  /** Shop platform centre x per team (y = lane line), radius. */
  shopX: [704, 11584] as const,
  shopR: 420,
  /** Quartermaster NPC and respawn point. */
  npc: [{ x: 576, y: 1340 }, { x: 11712, y: 1340 }] as const,
  respawn: [{ x: 616, y: 1480 }, { x: 11672, y: 1480 }] as const,
  /** Mob spawn x per team. */
  mobX: [1500, 10788] as const,
  /** Mid-lane pillars (cover). */
  pillars: [{ x: 5700, y: 1280 }, { x: 6588, y: 1536 }, { x: 4150, y: 1690 }, { x: 8138, y: 1126 }] as const,
  /**
   * Trial alcoves (ascendancy trial, server/progression.ts): one per team, a side clearing carved off the
   * top edge of the band between that team's Ward and Inner Spire. The enemy has to pass two spires to
   * reach it, and the waves (marching on the centre line, aggro 380) never wander in.
   */
  trial: [{ x: 2875, y: 850 }, { x: 9413, y: 850 }] as const,
  /** Alcove half-width (half-height 140). */
  trialR: 250,
  /**
   * Jungle glades: side clearings joined to the band by a corridor at x (half-width 150), each holding a
   * neutral camp (server/modes/lanes.ts). Own-side glades between the Inner and Outer Spires, two contested
   * glades at mid (elite camps). rx / ry: ellipse half-axes.
   */
  glades: [
    { x: 4200, y: 520, rx: 520, ry: 260, tier: 0 },
    { x: 3600, y: 2300, rx: 600, ry: 280, tier: 0 },
    { x: 8088, y: 520, rx: 520, ry: 260, tier: 0 },
    { x: 8688, y: 2300, rx: 600, ry: 280, tier: 0 },
    { x: 6144, y: 470, rx: 560, ry: 250, tier: 1 },
    { x: 6144, y: 2346, rx: 560, ry: 250, tier: 1 },
  ] as const,
};


/**
 * Spire / Core shooting range. Was 520 / 650: 520 reached past the band edge (the band runs 448 px either
 * side of the lane line), so there was no flank at all, and it out-ranged every hero skill but the two
 * longest (520-600). 420 sits just over a wave's aggro (380): ranged heroes (520-600 reach) can trade with
 * a wave at the ring's edge without being shot, melee must commit, and hugging the band edge is a real,
 * risky flank. The Core keeps a little more (480) as the last line.
 */
export const SPIRE_RANGE = 420;
export const CORE_RANGE = 480;
/** Breachway ascendancy trial: seconds to finish (the royale's is 120; the walk from the lane is longer). */
export const LANE_TRIAL_TIME = 150;
/** Gold for helping kill an enemy hero (damaged them in the last ASSIST_WINDOW seconds). */
export const ASSIST_WINDOW = 10;

/** Structure kinds, in the order they must fall (outer first). */
export const STRUCT_KINDS = ["lane_outer", "lane_inner", "lane_ward", "lane_core"] as const;
export type StructKind = (typeof STRUCT_KINDS)[number];

/** Structure x positions per team (Dawn, Dusk); y is the lane line. */
export const STRUCT_X: Record<StructKind, [number, number]> = {
  lane_outer: [4850, 7438],
  lane_inner: [3500, 8788],
  lane_ward: [2250, 10038],
  lane_core: [1200, 11088],
};

// ---- waypoints ------------------------------------------------------------------------------------

/** Waypoint kinds: one beside each structure, plus the base one (always up). */
export type WaypointKind = "base" | StructKind;
export const WAYPOINT_KINDS: WaypointKind[] = ["base", "lane_core", "lane_ward", "lane_inner", "lane_outer"];
/** Channel time to travel (cancelled by taking damage). */
export const WAYPOINT_CHANNEL = 2;
/** You must stand this close to one of your team's standing waypoints to travel. */
export const WAYPOINT_USE_R = 220;
/** A waypoint's spot: 300 px below its structure on the band; the base one on the platform. */
export function waypointAt(team: Team, k: WaypointKind): { x: number; y: number } {
  if (k === "base") return { x: LANE.shopX[team] + (team === 0 ? 110 : -110), y: LANE.y - 290 };
  return { x: STRUCT_X[k][team] + (team === 0 ? -60 : 60), y: LANE.y + 300 };
}

export const TEAM_NAMES = ["Dawn", "Dusk"] as const;
export const TEAM_COLORS = ["#4f8fe8", "#e0503c"] as const;
/** Player colours per team (distinct shades so names still tell apart). */
export const TEAM_PLAYER_COLORS: [string[], string[]] = [
  ["#4f8fe8", "#42d4f4", "#6a7cff", "#8fb8ff", "#00a3a3"],
  ["#e0503c", "#f58231", "#ff8080", "#d0306a", "#ffa94d"],
];

/** Level cap in Breachway. */
export const LANE_LEVEL_CAP = 20;

const struct = (id: StructKind, name: string, radius: number, hp: number): MonsterType => ({
  id, name, ai: "melee", color: "#8a8a9a", radius, hp, speed: 0, aggroRadius: 0, damage: 0, attackRange: 0,
  windup: 1, recover: 1, knockback: 0, kbResist: 1, packWeight: 0,
});

/** Structures are monsters that never move (so every player skill hits them). Life is set by the mode. */
export const LANE_STRUCT_TYPES: MonsterType[] = [
  struct("lane_outer", "Outer Spire", 56, 9000),
  struct("lane_inner", "Inner Spire", 56, 12000),
  struct("lane_ward", "Ward", 60, 8000),
  struct("lane_core", "Core", 72, 15000),
];
for (const t of LANE_STRUCT_TYPES) MONSTER_BY_ID.set(t.id, t);

export function isStructKind(k: string): k is StructKind {
  return (STRUCT_KINDS as readonly string[]).includes(k);
}

/** On a team's shop platform? */
export function onPlatform(team: Team, x: number, y: number): boolean {
  return Math.hypot(x - LANE.shopX[team], y - LANE.y) < LANE.shopR;
}

// ---- shop (doc section 8) ---------------------------------------------------------------------

/** Gamble base prices by slot. */
export const GAMBLE_BASE: Record<string, number> = {
  weapon: 70, offhand: 50, body: 60, helmet: 45, gloves: 45, boots: 45, belt: 40, ring: 55, amulet: 65, flask: 30,
};
export const GAMBLE_SLOTS = Object.keys(GAMBLE_BASE);
export const gamblePrice = (slot: string, ilvl: number) => Math.round((GAMBLE_BASE[slot] ?? 60) * (1 + 0.12 * (Math.max(1, ilvl) - 1)));
/** Highest rough skill crystal level on sale at a player level. */
export const maxCrystalLevel = (lvl: number) => Math.min(10, 1 + Math.floor(lvl / 2));
export const skillCrystalPrice = (k: number) => Math.round(40 + 15 * k ** 1.4);
/** Support crystal tiers: unlock level and price. */
export const SUPPORT_TIERS = [
  { tier: 1, level: 1, price: 80 },
  { tier: 2, level: 8, price: 200 },
  { tier: 3, level: 14, price: 400 },
];
export const SPIRIT_PRICE = 150;
export const SPIRIT_LEVEL = 3;
export const SELL_FRACTION = 0.25;

/** What the Quartermaster pays for an item (a quarter of its shop price, more for magic / rare). */
export function laneSellValue(it: Item): number {
  if (it.b === ROUGH_SKILL) return Math.round(skillCrystalPrice(it.l) * SELL_FRACTION);
  if (it.b === ROUGH_SUPPORT) return Math.round((SUPPORT_TIERS[it.l - 1]?.price ?? 80) * SELL_FRACTION);
  if (it.b === ROUGH_SPIRIT) return Math.round(SPIRIT_PRICE * SELL_FRACTION);
  const base = BASES.find((b) => b.id === it.b);
  const slot = base ? base.cls : "flask";
  return Math.max(1, Math.round(gamblePrice(slot, it.l) * SELL_FRACTION * (1 + 0.5 * (it.r ?? 0))));
}
