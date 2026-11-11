// Rogue exiles: player-like AI enemies with real rolled gear and gem skills. They dodge-roll and drop
// everything they carry on death. All names are original. Each archetype draws its loadout from the
// real gem list (shared/content/gems.ts): the weapon skill its weapon grants, one main skill, one or
// two secondary skills, supports linked to the main skill and sometimes a spirit gem. The server
// (server/ai/exiles.ts) turns the gems into attack-brain AttackDefs scaled from gem level and gear.

export interface ExileDef {
  id: string;
  name: string;
  epithet: string;
  weapon: string; // weapon kind for the gear roll
  color: string; // scarf colour (hero renderer)
  /** Gear slots rolled (rarity 1-2), on top of the weapon. */
  armour: ("helmet" | "body" | "gloves" | "boots" | "amulet" | "ring" | "belt")[];
  /** Keep-away distance (casters / archers kite). */
  kite?: number;
  /** Gem loadout pools (skill gem ids from SKILL_GEMS / SUPPORT_GEMS). */
  gems: {
    /** One main skill is picked from these (most-used attack). */
    main: string[];
    /** 1-2 secondary skills are picked from these. */
    extra: string[];
    /** 0-2 supports linked to the main skill (only ones that can link to it). */
    supports: string[];
    /** Spirit gem worn 50% of the time (passive bonus). */
    spirit?: string[];
  };
}

export const EXILES: ExileDef[] = [
  {
    id: "vesk", name: "Vesk Halloran", epithet: "the Oathless", weapon: "sword", color: "#c03030",
    armour: ["helmet", "body", "gloves", "boots", "ring"],
    gems: { main: ["sundering_blow"], extra: ["shadow_lunge", "reaping_whirl", "ember_pact"], supports: ["heavy_hand", "bloodthirst", "quickened_rite", "cindertouch"], spirit: ["ashen_mantle"] },
  },
  {
    id: "maren", name: "Maren Ashcaller", epithet: "of the Cinder Choir", weapon: "staff", color: "#e07a20", kite: 250,
    armour: ["helmet", "body", "boots", "amulet"],
    gems: { main: ["cinderbolt"], extra: ["frostgale", "pyre_effigy", "stormthread"], supports: ["cindertouch", "scattershot", "heavy_hand", "quickened_rite"], spirit: ["ashen_mantle"] },
  },
  {
    id: "tobb", name: "Tobb Grimlatch", epithet: "the Gravedigger", weapon: "mace", color: "#808060",
    armour: ["helmet", "body", "gloves", "boots", "belt"],
    gems: { main: ["faultline_slam"], extra: ["sundering_blow", "ember_pact"], supports: ["heavy_hand", "broadened_ruin", "bloodthirst"], spirit: ["ashen_mantle"] },
  },
  {
    id: "ilsa", name: "Ilsa Thornquill", epithet: "the Hollow Eye", weapon: "bow", color: "#40a060", kite: 280,
    armour: ["helmet", "body", "gloves", "boots", "ring"],
    gems: { main: ["splinter_volley"], extra: ["shadow_lunge", "pyre_effigy"], supports: ["scattershot", "rimebite", "cindertouch", "quickened_rite"], spirit: ["windward_hymn"] },
  },
  {
    id: "corvin", name: "Corvin Saltmere", epithet: "the Storm-Tithed", weapon: "staff", color: "#6a6ae0", kite: 240,
    armour: ["helmet", "body", "gloves", "amulet"],
    gems: { main: ["stormthread"], extra: ["frostgale", "shadow_lunge", "cinderbolt"], supports: ["broadened_ruin", "heavy_hand", "rimebite"], spirit: ["windward_hymn"] },
  },
];

export const EXILE_BY_ID = new Map(EXILES.map((e) => [e.id, e]));

/** Exile spawns: one per this many players (at least 1), at random normal camps away from spawns. */
export const EXILE_PER_PLAYERS = 4;
/**
 * The player level an exile's rolled gear stands for. Exiles follow the monster level curve
 * (mods.ts monsterLevelScale): they start at level 1 and scale up to the player who wakes them, so
 * life and damage are what the gear gives at this level, less below it and more above it.
 */
export const EXILE_LEVEL = 8;
/** Dodge roll: cooldown, duration (invulnerable), speed. */
export const EXILE_ROLL = { cd: 2.2, dur: 0.35, speed: 520 };
/** Exile gem level from its item level: 1 + (ilvl - 8) / 3, clamped. */
export const exileGemLevel = (ilvl: number) => Math.max(1, Math.min(6, 1 + Math.floor((ilvl - 8) / 3)));
