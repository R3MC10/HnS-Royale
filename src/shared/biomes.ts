// Biome themes for the procedural map rotation (one biome per match). Content as data:
// generation knobs, obstacle mix, monster family weights and palette / tint hints for the renderer.
// All names are original.

export type BiomeId = "hollowpine" | "gloamwater" | "brokenspire";

/** Collision-obstacle visual kinds (props.ts draws these). "water" is invisible (the ground shows it). */
export type ObstacleKind = "rocks" | "ruin" | "tree" | "shrine" | "water";

export interface BiomePalette {
  /** Base ground colour (open walkable ground), CSS hex. */
  ground: string;
  /** Dark fill for wall interiors (deep forest canopy, cliff tops). */
  wall: string;
  /** Wall rim colour (where walls meet open ground). */
  wallEdge: string;
  /** Water / mire colour for water cells (bog), if any. */
  water: string;
  /** Path / worn dirt colour. */
  path: string;
  /** Minimap colours. */
  mapOpen: string;
  mapWall: string;
  mapWater: string;
  /** Per-channel multiplier applied to the generic ground art (1 = unchanged). */
  tint: [number, number, number];
  /** Ambient light the darkness lets through (multiplied), CSS hex. */
  ambient: string;
  /** Fog tint, CSS hex. */
  fog: string;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  blurb: string;
  palette: BiomePalette;
  /** Wall circle visual mix (weights). */
  wallMix: Partial<Record<ObstacleKind, number>>;
  /** Open-area obstacle mix (weights). */
  propMix: Partial<Record<ObstacleKind, number>>;
  /** Open-area obstacles per 1M px² of open ground. */
  propDensity: number;
  /** Fraction of clearings that become ruin clusters. */
  ruinChance: number;
  /** Fraction of solid cells (not the outer border) that become water instead of wall. */
  waterChance: number;
  /** Clearing size multiplier and path width multiplier. */
  clearingScale: number;
  pathScale: number;
  /** Outcrop noise threshold inside clearings (lower = more inner rock islands). */
  outcrop: number;
  /** Monster family weights (monster type id -> weight). */
  monsters: Record<string, number>;
  /** Scatter dressing weights (client props). */
  scatter: Record<"grave" | "bones" | "shrub" | "stones", number>;
}

export const BIOMES: BiomeDef[] = [
  {
    id: "hollowpine",
    name: "Hollowpine Blight",
    blurb: "A rotting forest of dead pines, choked clearings and leaning stones.",
    palette: {
      ground: "#2a2c20",
      wall: "#0b0d09",
      wallEdge: "#1a1d14",
      water: "#14181a",
      path: "#30261d",
      mapOpen: "#4a4a36",
      mapWall: "#141710",
      mapWater: "#22303a",
      tint: [0.95, 1.04, 0.9],
      ambient: "#66616e",
      fog: "#9aa58c",
    },
    wallMix: { tree: 8, rocks: 2 },
    propMix: { tree: 5, rocks: 3, ruin: 1 },
    propDensity: 0.7, // more open maps: was 2.2
    ruinChance: 0.2,
    waterChance: 0,
    clearingScale: 1,
    pathScale: 1,
    outcrop: 0.8, // more open maps: fewer rock outcrops (was 0.74)
    monsters: { barkgnaw: 28, wolf_feral: 24, sapspitter: 22, hollow_tender: 14, stumpfather: 10 },
    scatter: { grave: 1, bones: 3, shrub: 5, stones: 2 },
  },
  {
    id: "gloamwater",
    name: "Gloamwater Fen",
    blurb: "A drowned lowland of black pools, reed hummocks and sunken causeways.",
    palette: {
      ground: "#262a22",
      wall: "#0a0c0b",
      wallEdge: "#182019",
      water: "#0f1a1c",
      path: "#2b2419",
      mapOpen: "#3f4636",
      mapWall: "#121510",
      mapWater: "#1c3640",
      tint: [0.88, 1.0, 0.98],
      ambient: "#5f6670",
      fog: "#8fb0a8",
    },
    wallMix: { tree: 5, rocks: 3 },
    propMix: { tree: 3, rocks: 3, ruin: 1 },
    propDensity: 1.6,
    ruinChance: 0.15,
    waterChance: 0.4,
    clearingScale: 1.1,
    pathScale: 1.1,
    outcrop: 0.7,
    monsters: { gnashling: 25, bog_seer: 55, cragback: 20 },
    scatter: { grave: 1, bones: 2, shrub: 4, stones: 3 },
  },
  {
    id: "brokenspire",
    name: "Brokenspire Heights",
    blurb: "Wind-scoured uplands of cliffs, fallen towers and old paved roads.",
    palette: {
      ground: "#2c2a26",
      wall: "#0c0b0c",
      wallEdge: "#211e1f",
      water: "#121619",
      path: "#34302a",
      mapOpen: "#4c4842",
      mapWall: "#161416",
      mapWater: "#24303a",
      tint: [1.04, 0.98, 0.95],
      ambient: "#6a6470",
      fog: "#a8a49c",
    },
    wallMix: { rocks: 8, ruin: 1 },
    propMix: { rocks: 4, ruin: 4, tree: 1 },
    propDensity: 2.0,
    ruinChance: 0.45,
    waterChance: 0,
    clearingScale: 1,
    pathScale: 0.9,
    outcrop: 0.68,
    monsters: { gnashling: 25, bog_seer: 20, cragback: 55 },
    scatter: { grave: 3, bones: 2, shrub: 1, stones: 4 },
  },
];

export const BIOME_BY_ID = new Map<string, BiomeDef>(BIOMES.map((b) => [b.id, b]));

/** Prototype lock: the one biome every match uses (server env HNS_BIOME overrides; see game.newMap). */
export const PROTOTYPE_BIOME: BiomeId = "hollowpine";

export function biomeOf(id: string | undefined): BiomeDef {
  return (id && BIOME_BY_ID.get(id)) || BIOMES[0];
}

/** Pick from a weight table with a 0..1 roll. */
export function pickWeighted<K extends string>(table: Partial<Record<K, number>>, roll: number): K {
  const entries = Object.entries(table) as [K, number][];
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = roll * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}
