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
  w: 7168,
  h: 1536,
  /** Lane centre line (mobs march on it). */
  y: 768,
  /** Lane band (walkable) between the bases. */
  bandTop: 320,
  bandBot: 1216,
  /** Base rectangles: x 0-1152 (Dawn) and 6016-7168 (Dusk), y 128-1408. */
  baseW: 1152,
  baseTop: 128,
  baseBot: 1408,
  /** Shop platform centre x per team (y = lane line), radius. */
  shopX: [448, 6720] as const,
  shopR: 420,
  /** Quartermaster NPC and respawn point. */
  npc: [{ x: 320, y: 700 }, { x: 6848, y: 700 }] as const,
  respawn: [{ x: 360, y: 840 }, { x: 6808, y: 840 }] as const,
  /** Mob spawn x per team. */
  mobX: [824, 6344] as const,
  /** Mid-lane pillars (cover). */
  pillars: [{ x: 3300, y: 640 }, { x: 3868, y: 896 }] as const,
};

/** Structure kinds, in the order they must fall (outer first). */
export const STRUCT_KINDS = ["lane_outer", "lane_inner", "lane_ward", "lane_core"] as const;
export type StructKind = (typeof STRUCT_KINDS)[number];

/** Structure x positions per team (Dawn, Dusk); y is the lane line. */
export const STRUCT_X: Record<StructKind, [number, number]> = {
  lane_outer: [2688, 4480],
  lane_inner: [1920, 5248],
  lane_ward: [1280, 5888],
  lane_core: [704, 6464],
};

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
