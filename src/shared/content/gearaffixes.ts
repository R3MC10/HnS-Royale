// Gear prefix / suffix tier tables (PoE2-style itemization; every name is original to this game).
//
// Rules the data follows (rolling lives in server/crafting.ts addRandomMod, eligibility in affixes.ts):
//  - Each affix is one modifier family with many tiers. A tier needs a minimum item level; low tiers
//    stay rollable at high item level, and each tier is its own weighted entry in the pool, with higher
//    tiers rarer (AffixTier.weight, default falloff in affixes.ts tierWeight).
//  - `group`: an item never carries two mods of the same group (local / global variants of a stat,
//    the hybrid % defence family, and so on share one).
//  - Pools differ per item class (`classes`), weapon kind (`weapons`), off-hand subtype (`subs`) and
//    armour defence tag (`defTags`): armour-only mods roll only on armour bases, hybrid bases roll
//    the hybrid defence mods. `armourTags` / `classTags` bind shared mods to defence types the way
//    PoE2's str / dex / int item tags do (ar = str, ev = dex, es = int).
//  - Which mod rolls where follows the PoE2 pools researched in
//    research_notes/PoE2 mod pools/pools.md (poe2db, 2026-11-10). Stand-ins and gaps are listed there.
//  - Local mods (`local`) change only the item they are on (weapon damage / speed / crit, armour
//    piece defences, shield block); items.ts localWeapon / localDefences apply them.
//  - Hybrid mods carry a second stat (`key2`, tier min2..max2).
//  - `twoHand`: two-handed weapons roll this multiple of the tier values.
import type { Affix, AffixTier, DefTag, ItemClass, WeaponKind } from "./types";

type Row = [ilvl: number, min: number, max: number, name: string, min2?: number, max2?: number];

/** Tier rows -> AffixTier[] (ordered low -> high). */
const T = (...rows: Row[]): AffixTier[] =>
  rows.map(([ilvl, min, max, name, min2, max2]) => ({ ilvl, min, max, name, ...(min2 !== undefined ? { min2, max2: max2 ?? min2 } : {}) }));

// ---- pools --------------------------------------------------------------------------------------
const ARMOUR: ItemClass[] = ["helmet", "body", "gloves", "boots", "offhand"]; // off-hand: shields / foci via defTags
const JEWELLERY: ItemClass[] = ["amulet", "ring"];
const RES: ItemClass[] = ["helmet", "body", "gloves", "boots", "offhand", "amulet", "ring", "belt"];
/** Body / helmet / gloves / boots (the four armour slots; shields and foci are "offhand"). */
const WORN: ItemClass[] = ["helmet", "body", "gloves", "boots"];
const ALL_DEF: DefTag[] = ["ar", "ev", "es", "ar_ev", "ar_es", "ev_es"];

/** Weapons that attack (physical / attack-speed / local crit pools). */
const ATTACK_W: WeaponKind[] = ["sword", "spear", "axe", "dagger", "mace", "claw", "quarterstaff", "bow", "crossbow"];
const MELEE_W: WeaponKind[] = ["sword", "spear", "axe", "dagger", "mace", "claw", "quarterstaff"];
const BOW_W: WeaponKind[] = ["bow", "crossbow"];
/** Spellcasting weapons (spell damage / cast speed / spell levels). */
const CASTER_W: WeaponKind[] = ["wand", "staff"];
const SPIRIT_W: WeaponKind[] = ["sceptre"];

const HAS_AR: DefTag[] = ["ar", "ar_ev", "ar_es"];
const HAS_EV: DefTag[] = ["ev", "ar_ev", "ev_es"];
const HAS_ES: DefTag[] = ["es", "ar_es", "ev_es"];

export const GEAR_AFFIXES: Affix[] = [
  // =============================================================================================
  // PREFIXES
  // =============================================================================================

  // ---- life / mana / spirit ----
  {
    id: "life", kind: "prefix", key: "life", group: "life", weight: 10, tags: ["Life"],
    // PoE2: every armour slot, shields and bucklers, all jewellery; not foci, not quivers.
    classes: ["helmet", "body", "gloves", "boots", "offhand", "amulet", "ring", "belt"], subs: ["shield"],
    tiers: T(
      [1, 6, 10, "Thick-Hided"], [3, 11, 16, "Gristled"], [6, 17, 23, "Ox-Blooded"], [9, 24, 31, "Boar-Hearted"],
      [12, 32, 40, "Mountainheart"], [15, 41, 50, "Barrowborn"], [18, 51, 62, "Cairn-Giant's"],
    ),
  },
  {
    id: "mana", kind: "prefix", key: "mana", group: "mana", weight: 8, tags: ["Mana"],
    // PoE2: helmets, gloves, boots, foci, jewellery, wands / staves / sceptres; not body armour, not shields.
    classes: ["weapon", "helmet", "gloves", "boots", "offhand", "amulet", "ring", "belt"],
    weapons: [...CASTER_W, ...SPIRIT_W], subs: ["focus"], twoHand: 1.5,
    tiers: T([1, 8, 14, "Lucid"], [4, 15, 22, "Brimming-Minded"], [8, 23, 31, "Inkwell"], [12, 32, 41, "Wellspring"], [16, 42, 52, "Moonpooled"], [19, 53, 64, "Abyss-Drinking"]),
  },
  {
    id: "spirit", kind: "prefix", key: "spirit", group: "spirit", weight: 5, tags: ["Spirit"],
    // PoE2: body armour (every type) and amulets; sceptres roll % Spirit (flat Spirit stands in here). Not foci.
    classes: ["weapon", "body", "amulet"], weapons: SPIRIT_W,
    tiers: T([1, 10, 15, "Kindred"], [5, 16, 22, "Soulbound"], [10, 23, 30, "Hallowed"], [15, 31, 38, "Ossuary-Kept"], [19, 39, 46, "Reliquary"]),
  },
  {
    // Hybrid: Spirit + maximum mana (PoE2 sceptre prefix).
    id: "spirit_mana", kind: "prefix", key: "spirit", key2: "mana", group: "spirit_mana", weight: 4, classes: ["weapon"], weapons: SPIRIT_W,
    tags: ["Spirit", "Mana"],
    tiers: T([2, 6, 10, "Vigil-Keeper's", 6, 10], [7, 11, 15, "Wake-Singer's", 11, 18], [13, 16, 21, "Ossuary-Warden's", 19, 26], [18, 22, 27, "Reliquary-Choir", 27, 34]),
  },
  {
    id: "move", kind: "prefix", key: "moveInc", group: "move", weight: 8, classes: ["boots"], tags: ["Speed"],
    tiers: T([1, 4, 6, "Scurrying"], [5, 7, 9, "Hare-Footed"], [9, 10, 12, "Windswept"], [13, 13, 15, "Ghost-Striding"], [17, 16, 18, "Stormheeled"]),
  },

  // ---- weapon: local physical ----
  {
    id: "dmg_flat", kind: "prefix", key: "lDmgFlat", group: "w_flat", weight: 9, classes: ["weapon"], weapons: ATTACK_W,
    local: true, twoHand: 1.6, tags: ["Damage", "Physical", "Attack"],
    tiers: T(
      [1, 2, 3, "Jagged"], [3, 4, 6, "Hooked"], [6, 7, 9, "Barbed"], [9, 10, 12, "Flensing"],
      [12, 13, 15, "Gutting"], [15, 16, 19, "Marrow-Splitting"], [18, 20, 23, "Bonebreaker's"],
    ),
  },
  {
    id: "dmg_inc", kind: "prefix", key: "lDmgInc", group: "w_pct", weight: 8, classes: ["weapon"], weapons: ATTACK_W,
    local: true, tags: ["Damage", "Physical", "Attack"],
    tiers: T([1, 15, 24, "Grim"], [4, 25, 34, "Baleful"], [8, 35, 49, "Ruinous"], [12, 50, 64, "Gore-Slick"], [15, 65, 84, "Butcher's"], [18, 85, 109, "Carrion-King's"]),
  },
  {
    // Hybrid: local % physical + accuracy.
    id: "dmg_inc_acc", kind: "prefix", key: "lDmgInc", key2: "accuracy", group: "w_pct_acc", weight: 6, classes: ["weapon"],
    weapons: ATTACK_W, local: true, tags: ["Damage", "Physical", "Attack"],
    tiers: T([1, 8, 14, "Hedge-Knight's", 15, 30], [6, 15, 24, "Freebooter's", 31, 60], [11, 25, 34, "Warband's", 61, 95], [16, 35, 44, "Dread-Captain's", 96, 135]),
  },

  // ---- spell weapons / foci ----
  {
    id: "spell_inc", kind: "prefix", key: "spellInc", group: "spell_pct", weight: 8, classes: ["weapon", "offhand", "amulet"],
    weapons: CASTER_W, subs: ["focus"], twoHand: 1.5, tags: ["Damage", "Caster"], // PoE2: wands, staves, foci, amulets (not sceptres)
    tiers: T([1, 10, 19, "Whispering"], [4, 20, 29, "Murmuring"], [8, 30, 44, "Hexing"], [12, 45, 59, "Thundervoiced"], [16, 60, 79, "Abyssal"], [19, 80, 99, "Voidcalling"]),
  },
  {
    // Hybrid: % spell damage + maximum mana.
    id: "spell_mana", kind: "prefix", key: "spellInc", key2: "mana", group: "spell_pct_mana", weight: 6, classes: ["weapon"],
    weapons: CASTER_W, twoHand: 1.5, tags: ["Damage", "Caster", "Mana"], // PoE2: wands and staves only
    tiers: T([1, 8, 14, "Candlelit", 6, 10], [7, 15, 24, "Grimoire-Bound", 11, 18], [13, 25, 34, "Lichlight", 19, 26], [18, 35, 44, "Ninth-Bell", 27, 34]),
  },

  // ---- global attack damage (PoE2: gloves, rings, quivers) ----
  {
    id: "atk_flat", kind: "prefix", key: "dmgFlat", group: "atk_flat", weight: 7, classes: ["gloves", "ring", "offhand"], subs: ["quiver"],
    tags: ["Damage", "Physical", "Attack"],
    tiers: T([1, 1, 2, "Spurred"], [5, 3, 4, "Thorned"], [10, 5, 7, "Spiked"], [15, 8, 10, "Rending"], [19, 11, 13, "Skinflayer's"]),
  },

  {
    // Quivers: % damage of the bow attacks they feed (PoE2 quiver projectile-damage role).
    id: "atk_inc_g", kind: "prefix", key: "dmgInc", group: "atk_pct", weight: 6, classes: ["offhand"], subs: ["quiver"], tags: ["Damage", "Attack"],
    tiers: T([1, 8, 14, "Fletched"], [5, 15, 22, "Bodkin"], [10, 23, 31, "Broadhead"], [15, 32, 40, "Heartseeker's"], [19, 41, 50, "Skewering"]),
  },

  {
    // PoE2: "+ Accuracy Rating" is a prefix on martial weapons, helmets, gloves, quivers, amulets and rings.
    id: "accuracy", kind: "prefix", key: "accuracy", group: "accuracy", weight: 6, classes: ["weapon", "gloves", "helmet", "ring", "amulet", "offhand"],
    weapons: ATTACK_W, subs: ["quiver"], tags: ["Attack"],
    tiers: T([1, 15, 30, "Level-Eyed"], [4, 31, 60, "Marksman's"], [8, 61, 100, "Unblinking"], [12, 101, 150, "Crow's-Nest"], [16, 151, 210, "Far-Sighted"], [19, 211, 280, "Gallows-Watch"]),
  },

  // ---- armour: local flat defences (by defence tag) ----
  // PoE2: a pure base rolls its one flat defence, a hybrid base only the matching two-stat flat mod.
  {
    id: "def_armour", kind: "prefix", key: "lAr", group: "flat_ar", weight: 8, classes: ARMOUR, defTags: ["ar"], local: true, tags: ["Defences", "Armour"],
    tiers: T([1, 6, 12, "Riveted"], [4, 13, 22, "Hobnailed"], [8, 23, 36, "Bulwarked"], [12, 37, 52, "Iron-Banded"], [16, 53, 72, "Ironclad"], [19, 73, 95, "Siegewalled"]),
  },
  {
    id: "def_evasion", kind: "prefix", key: "lEv", group: "flat_ev", weight: 8, classes: ARMOUR, defTags: ["ev"], local: true, tags: ["Defences", "Evasion"],
    tiers: T([1, 8, 16, "Lissom"], [4, 17, 30, "Wraithlike"], [8, 31, 48, "Smokeborn"], [12, 49, 70, "Mist-Stepping"], [16, 71, 96, "Duskwalker's"], [19, 97, 125, "Nightveiled"]),
  },
  {
    id: "def_es", kind: "prefix", key: "lEs", group: "flat_es", weight: 8, classes: ARMOUR, defTags: ["es"], local: true, tags: ["Defences", "Energy Shield"],
    tiers: T([1, 4, 7, "Candlewarded"], [4, 8, 12, "Haloed"], [8, 13, 18, "Starwoven"], [12, 19, 25, "Auroral"], [16, 26, 33, "Seraph-Spun"], [19, 34, 42, "Eclipse-Hung"]),
  },
  // Hybrid flat defences: only on matching hybrid bases.
  {
    id: "def_ar_ev", kind: "prefix", key: "lAr", key2: "lEv", group: "flat_hybrid", weight: 6, classes: ARMOUR, defTags: ["ar_ev"], local: true,
    tags: ["Defences", "Armour", "Evasion"],
    tiers: T([1, 4, 8, "Brigand's", 5, 10], [6, 9, 18, "Skirmisher's", 11, 22], [11, 19, 30, "Raider's", 23, 38], [16, 31, 45, "Raid-Chief's", 39, 56]),
  },
  {
    id: "def_ar_es", kind: "prefix", key: "lAr", key2: "lEs", group: "flat_hybrid", weight: 6, classes: ARMOUR, defTags: ["ar_es"], local: true,
    tags: ["Defences", "Armour", "Energy Shield"],
    tiers: T([1, 4, 8, "Chaplain's", 2, 4], [6, 9, 18, "Penitent's", 5, 8], [11, 19, 30, "Inquisitor's", 9, 13], [16, 31, 45, "Black Abbot's", 14, 19]),
  },
  {
    id: "def_ev_es", kind: "prefix", key: "lEv", key2: "lEs", group: "flat_hybrid", weight: 6, classes: ARMOUR, defTags: ["ev_es"], local: true,
    tags: ["Defences", "Evasion", "Energy Shield"],
    tiers: T([1, 5, 10, "Hedge-Witch's", 2, 4], [6, 11, 22, "Moth-Winged", 5, 8], [11, 23, 38, "Fen-Spirit's", 9, 13], [16, 39, 56, "Will-o'-Wisp", 14, 19]),
  },
  // Local % defence: exactly one family per defence tag (all share the "def_pct" group).
  ...pctDef("def_armour_inc", "lArInc", ["ar"], ["Defences", "Armour"], ["Hardened", "Cold-Forged", "Unbending", "Anvil-Hearted", "Unbreaking", "Doomforged"]),
  ...pctDef("def_evasion_inc", "lEvInc", ["ev"], ["Defences", "Evasion"], ["Shifting", "Flickering", "Slipshadow", "Fogbound", "Phantasmal", "Unseen"]),
  ...pctDef("def_es_inc", "lEsInc", ["es"], ["Defences", "Energy Shield"], ["Shimmering", "Lambent", "Vesper-Lit", "Moonwrought", "Starfallen", "Godspark"]),
  ...pctDef("def_ar_ev_inc", "lArEvInc", ["ar_ev"], ["Defences", "Armour", "Evasion"], ["Scrapper's", "Bladesman's", "Bandit-Lord's", "Wolfmail", "Reaver-King's", "Blood-Oath"]),
  ...pctDef("def_ar_es_inc", "lArEsInc", ["ar_es"], ["Defences", "Armour", "Energy Shield"], ["Votive", "Censer-Hung", "Sanctified", "Cathedral", "Martyr's", "Saint-Forged"]),
  ...pctDef("def_ev_es_inc", "lEvEsInc", ["ev_es"], ["Defences", "Evasion", "Energy Shield"], ["Thistledown", "Gloaming", "Veil-Woven", "Sable", "Twilit", "Starless"]),
  // Hybrid % defence + second stat. PoE2 picks the second stat by slot, not by defence type:
  // + life on body armour / helmets / gloves, + mana on helmets / foci, + stun threshold on boots / shields.
  // Three separate families (a helmet can carry the life and the mana one).
  ...defHybrid("ar", "lArInc", ["Defences", "Armour"], {
    life: ["def_ar_life", ["Ox-Yoked", "Bull-Necked", "Aurochs-Hide", "Titan-Ribbed"]],
    mana: ["def_ar_mana", ["Squire's", "Chanter-Knight's", "Rune-Helmed", "Oracle-Guard's"]],
    stun: ["def_ar_stun", ["Stockade", "Palisade", "Rampart-Built", "Keepwalled"]],
  }),
  ...defHybrid("ev", "lEvInc", ["Defences", "Evasion"], {
    life: ["def_ev_life", ["Fox-Blooded", "Lynx-Blooded", "Panther-Blooded", "Night-Hunter's"]],
    mana: ["def_ev_mana", ["Dreaming", "Owl-Eyed", "Dusk-Reader's", "Far-Dreamer's"]],
    stun: ["def_ev_stun", ["Surefoot", "Goat-Stepping", "Ledge-Walker's", "Unfalling"]],
  }),
  ...defHybrid("es", "lEsInc", ["Defences", "Energy Shield"], {
    life: ["def_es_life", ["Hearth-Warded", "Blood-Sigiled", "Lifebound", "Heart-of-Glass"]],
    mana: ["def_es_mana", ["Acolyte's", "Scrivener's", "Archivist's", "Thought-Eater's"]],
    stun: ["def_es_stun", ["Poised", "Stillwater", "Unruffled", "Calm-Eyed"]],
  }),
  ...defHybrid("ar_ev", "lArEvInc", ["Defences", "Armour", "Evasion"], {
    life: ["def_arev_life", ["Drifter's", "Outrider's", "Marauder's", "Wolf-Captain's"]],
    mana: ["def_arev_mana", ["Hedge-Captain's", "Cunning", "War-Seer's", "Raven-Marshal's"]],
    stun: ["def_hyb_stun", ["Footpad's", "Sellsword's", "Free-Captain's", "Pale Company"]],
  }),
  ...defHybrid("ar_es", "lArEsInc", ["Defences", "Armour", "Energy Shield"], {
    life: ["def_ares_life", ["Pilgrim's", "Almoner's", "Hospitaller's", "Relic-Bearer's"]],
    mana: ["def_ares_mana", ["Cantor's", "Lector's", "Psalm-Bound", "High Cantor's"]],
    stun: ["def_ares_stun", ["Novice's", "Oath-Sworn", "Reliquary-Guard", "Last Bastion"]],
  }),
  ...defHybrid("ev_es", "lEvEsInc", ["Defences", "Evasion", "Energy Shield"], {
    life: ["def_eves_life", ["Marsh-Walker's", "Crow-Mother's", "Bog-Seer's", "Wychwood"]],
    mana: ["def_eves_mana", ["Moth-Minded", "Dew-Reader's", "Mist-Seer's", "Moon-Hollow"]],
    stun: ["def_eves_stun", ["Reed-Walker's", "Heron-Stepping", "Mire-Dancer's", "Fen-Ghost's"]],
  }),
  // Hybrid flat + % of the same defence: PoE2 body armour only. (The hybrid-base versions carry three
  // stats, which an affix here cannot express: see the research notes.)
  {
    id: "def_ar_flatpct", kind: "prefix", key: "lAr", key2: "lArInc", group: "def_flat_pct", weight: 5, classes: ["body"], defTags: ["ar"], local: true,
    tags: ["Defences", "Armour"],
    tiers: T([2, 4, 8, "Banded", 6, 12], [7, 9, 18, "Double-Riveted", 13, 20], [12, 19, 30, "Thrice-Forged", 21, 28], [17, 31, 45, "Gatehouse", 29, 36]),
  },
  {
    id: "def_ev_flatpct", kind: "prefix", key: "lEv", key2: "lEvInc", group: "def_flat_pct", weight: 5, classes: ["body"], defTags: ["ev"], local: true,
    tags: ["Defences", "Evasion"],
    tiers: T([2, 5, 10, "Soft-Footed", 6, 12], [7, 11, 22, "Quicksilver", 13, 20], [12, 23, 38, "Windblown", 21, 28], [17, 39, 56, "Vanishing", 29, 36]),
  },
  {
    id: "def_es_flatpct", kind: "prefix", key: "lEs", key2: "lEsInc", group: "def_flat_pct", weight: 5, classes: ["body"], defTags: ["es"], local: true,
    tags: ["Defences", "Energy Shield"],
    tiers: T([2, 2, 4, "Glimmering", 6, 12], [7, 5, 8, "Halo-Bound", 13, 20], [12, 9, 13, "Dawn-Woven", 21, 28], [17, 14, 19, "Sun-Crowned", 29, 36]),
  },

  // ---- jewellery / belts: global defences ----
  // PoE2: flat Armour on belts, flat Evasion on rings, flat Energy Shield and the three % defences on amulets.
  {
    id: "armour_g", kind: "prefix", key: "armour", group: "flat_ar", weight: 6, classes: ["belt"], tags: ["Defences", "Armour"],
    tiers: T([1, 10, 20, "Leathered"], [6, 21, 40, "Scaled"], [12, 41, 65, "Horn-Plated"], [17, 66, 90, "Anvil-Struck"]),
  },
  {
    id: "evasion_g", kind: "prefix", key: "evasion", group: "flat_ev", weight: 6, classes: ["ring"], tags: ["Defences", "Evasion"],
    tiers: T([1, 12, 25, "Lithe"], [6, 26, 50, "Mistcloaked"], [12, 51, 80, "Shadow-Slipping"], [17, 81, 110, "Nightjar's"]),
  },
  {
    id: "es_g", kind: "prefix", key: "es", group: "flat_es", weight: 6, classes: ["amulet"], tags: ["Defences", "Energy Shield"],
    tiers: T([1, 5, 9, "Wardlit"], [6, 10, 16, "Glyph-Etched"], [12, 17, 24, "Sigil-Bright"], [17, 25, 32, "Crowned in Stars"]),
  },
  {
    id: "armour_inc_g", kind: "prefix", key: "armourInc", group: "g_ar_pct", weight: 4, classes: ["amulet"], tags: ["Defences", "Armour"],
    tiers: T([1, 8, 14, "Ironsouled"], [8, 15, 22, "Oak-Ribbed"], [15, 23, 30, "Bastioned"]),
  },
  {
    id: "evasion_inc_g", kind: "prefix", key: "evasionInc", group: "g_ev_pct", weight: 4, classes: ["amulet"], tags: ["Defences", "Evasion"],
    tiers: T([1, 8, 14, "Quickblooded"], [8, 15, 22, "Feline"], [15, 23, 30, "Shade-Kissed"]),
  },
  {
    id: "es_inc_g", kind: "prefix", key: "esInc", group: "g_es_pct", weight: 4, classes: ["amulet"], tags: ["Defences", "Energy Shield"],
    tiers: T([1, 8, 14, "Pious"], [8, 15, 22, "Rapt"], [15, 23, 30, "Transfigured"]),
  },

  // =============================================================================================
  // SUFFIXES
  // =============================================================================================

  // ---- weapon: local speed / crit ----
  {
    id: "atk_speed", kind: "suffix", key: "lAtkSpd", group: "atk_speed", weight: 8, classes: ["weapon"], weapons: ATTACK_W, local: true,
    tags: ["Attack", "Speed"],
    tiers: T([1, 5, 7, "of Twitching"], [5, 8, 10, "of Flurries"], [10, 11, 13, "of the Hummingbird"], [14, 14, 16, "of the Hornet"], [18, 17, 20, "of the Locust Swarm"]),
  },
  {
    id: "crit_local", kind: "suffix", key: "lCrit", group: "crit_local", weight: 7, classes: ["weapon"], weapons: ATTACK_W, local: true, decimals: 1,
    tags: ["Attack", "Critical"],
    tiers: T([1, 0.5, 1, "of Splinters"], [6, 1.1, 1.6, "of the Fang"], [11, 1.7, 2.3, "of the Bone Needle"], [16, 2.4, 3, "of the Fault Line"]),
  },
  {
    id: "atk_speed_g", kind: "suffix", key: "atkSpeedInc", group: "atk_speed", weight: 6, classes: ["gloves", "offhand"], subs: ["quiver"], // PoE2: gloves and quivers (not rings)
    tags: ["Attack", "Speed"],
    tiers: T([1, 4, 6, "of Restless Hands"], [8, 7, 9, "of Quick Knuckles"], [15, 10, 13, "of the Mantis"]),
  },
  {
    id: "reach", kind: "suffix", key: "reach", group: "reach", weight: 6, classes: ["weapon"], weapons: MELEE_W, tags: ["Attack"],
    tiers: T([1, 6, 10, "of Long Arms"], [7, 11, 16, "of the Heron"], [13, 17, 24, "of Far Grasp"], [18, 25, 32, "of the Gibbet Pole"]),
  },
  {
    id: "knockback", kind: "suffix", key: "kbInc", group: "knockback", weight: 5, classes: ["weapon", "gloves", "offhand"], weapons: MELEE_W, subs: ["shield"],
    tags: ["Attack"],
    tiers: T([1, 15, 30, "of Shoving"], [8, 31, 55, "of the Battering Ram"], [15, 56, 80, "of the Avalanche"]),
  },
  {
    // Hybrid accuracy + reach (PoE2's accuracy + light radius; this game has no light radius, reach is its small positional stat).
    id: "acc_reach", kind: "suffix", key: "accuracy", key2: "reach", group: "acc_reach", weight: 5, classes: ["weapon", "helmet"], weapons: MELEE_W,
    tags: ["Attack"],
    tiers: T([1, 10, 20, "of the Lantern-Eye", 2, 3], [7, 21, 40, "of the Night Watch", 4, 5], [13, 41, 65, "of the Torchbearer", 6, 8]),
  },
  {
    // PoE2: helmets, amulets, quivers (attacks), foci / wands / staves (spells). Not rings.
    id: "off_crit_inc", kind: "suffix", key: "critInc", group: "crit_g", weight: 5, classes: ["weapon", "amulet", "helmet", "offhand"],
    weapons: CASTER_W, subs: ["focus", "quiver"], twoHand: 1.5, tags: ["Critical"],
    tiers: T([2, 10, 14, "of Keen Eyes"], [6, 15, 19, "of the Keen Edge"], [10, 20, 24, "of Glass Shards"], [14, 25, 29, "of the Split Hair"], [18, 30, 39, "of the Last Breath"]),
  },
  {
    // PoE2: martial weapons, gloves, amulets, quivers, and (as spell crit damage) wands / staves / foci. Not sceptres.
    id: "off_crit_multi", kind: "suffix", key: "critMulti", group: "crit_multi", weight: 4, classes: ["weapon", "amulet", "gloves", "offhand"],
    weapons: [...ATTACK_W, ...CASTER_W], subs: ["quiver", "focus"], tags: ["Damage", "Critical"],
    tiers: T([4, 8, 12, "of Cruel Intent"], [9, 13, 18, "of the Severing"], [14, 19, 25, "of the Headsman"], [18, 26, 33, "of the Gallows"]),
  },

  // ---- casters ----
  {
    id: "cast_speed", kind: "suffix", key: "castInc", group: "cast_speed", weight: 6, classes: ["weapon", "offhand", "ring", "amulet"],
    weapons: CASTER_W, subs: ["focus"], twoHand: 1.5, tags: ["Caster", "Speed"],
    tiers: T([1, 5, 8, "of Quick Tongues"], [6, 9, 12, "of the Hasty Rite"], [11, 13, 16, "of the Racing Pulse"], [16, 17, 21, "of the Ninefold Chant"]),
  },
  {
    id: "mana_regen", kind: "suffix", key: "manaRegen", group: "mana_regen", weight: 7, decimals: 1, classes: ["ring", "amulet", "offhand", "weapon"],
    weapons: [...CASTER_W, ...SPIRIT_W], subs: ["focus"], tags: ["Mana"], // PoE2: amulets, rings, foci, wands / staves / sceptres (no armour slot)
    tiers: T([1, 0.8, 1.4, "of Trickling Thought"], [5, 1.5, 2.2, "of the Spring"], [9, 2.3, 3.1, "of the Undertow"], [13, 3.2, 4.1, "of the Cistern"], [17, 4.2, 5.4, "of the Drowned Choir"]),
  },

  // ---- + level of skills ----
  // PoE2: every "+ level of skills" mod is one family, so an item carries at most one of them (shared group).
  {
    id: "lvl_spell", kind: "suffix", key: "lvlSpell", group: "lvl_skill", weight: 3, classes: ["weapon", "offhand", "amulet"], weapons: CASTER_W,
    subs: ["focus"], twoHand: 2, tags: ["Caster", "Gem"],
    tiers: [{ ilvl: 5, min: 1, max: 1, name: "of the Hedge-Witch" }, { ilvl: 15, min: 2, max: 2, name: "of the Black Coven", weight: 0.35 }],
  },
  {
    id: "lvl_fire", kind: "suffix", key: "lvlFire", group: "lvl_skill", weight: 3, classes: ["weapon"], weapons: CASTER_W, twoHand: 1.5,
    tags: ["Caster", "Fire", "Gem"],
    tiers: [{ ilvl: 3, min: 1, max: 1, name: "of the Tinderbox" }, { ilvl: 11, min: 2, max: 2, name: "of the Burning Pyre", weight: 0.5 }, { ilvl: 18, min: 3, max: 3, name: "of the Witch-Fire", weight: 0.25 }],
  },
  {
    id: "lvl_cold", kind: "suffix", key: "lvlCold", group: "lvl_skill", weight: 3, classes: ["weapon"], weapons: CASTER_W, twoHand: 1.5,
    tags: ["Caster", "Cold", "Gem"],
    tiers: [{ ilvl: 3, min: 1, max: 1, name: "of the Hoarfrost" }, { ilvl: 11, min: 2, max: 2, name: "of the Frozen Mere", weight: 0.5 }, { ilvl: 18, min: 3, max: 3, name: "of the Deathless Winter", weight: 0.25 }],
  },
  {
    id: "lvl_light", kind: "suffix", key: "lvlLight", group: "lvl_skill", weight: 3, classes: ["weapon"], weapons: CASTER_W, twoHand: 1.5,
    tags: ["Caster", "Lightning", "Gem"],
    tiers: [{ ilvl: 3, min: 1, max: 1, name: "of the Crackle" }, { ilvl: 11, min: 2, max: 2, name: "of the Struck Bell", weight: 0.5 }, { ilvl: 18, min: 3, max: 3, name: "of the Splitting Sky", weight: 0.25 }],
  },
  {
    id: "lvl_melee", kind: "suffix", key: "lvlMelee", group: "lvl_skill", weight: 3, classes: ["amulet", "gloves", "weapon"], weapons: MELEE_W, tags: ["Attack", "Gem"],
    tiers: [{ ilvl: 5, min: 1, max: 1, name: "of the Pit-Fighter" }, { ilvl: 15, min: 2, max: 2, name: "of the Bloody Sands", weight: 0.35 }],
  },
  {
    id: "lvl_proj", kind: "suffix", key: "lvlProj", group: "lvl_skill", weight: 3, classes: ["amulet", "offhand", "weapon"], weapons: [...BOW_W, "spear"], subs: ["quiver"],
    tags: ["Attack", "Gem"],
    tiers: [{ ilvl: 5, min: 1, max: 1, name: "of the Fletcher" }, { ilvl: 15, min: 2, max: 2, name: "of the Hollow Shaft", weight: 0.35 }],
  },

  // ---- attributes ----
  // PoE2 binds attributes to item tags. Strength: str-tagged armour (ar / ar_ev / ar_es) and shields, sword / axe /
  // mace / spear / crossbow / sceptre, all jewellery incl. belts. Dexterity: every glove, dex-tagged armour, bucklers
  // and ar_ev shields, quivers, sword / dagger / claw / spear / quarterstaff / bow / crossbow, amulets and rings.
  // Intelligence: every helmet, int-tagged armour, ar_es shields, foci, dagger / quarterstaff / wand / staff /
  // sceptre, amulets and rings.
  {
    id: "attr_str", kind: "suffix", key: "str", group: "attr_str", weight: 7, classes: [...WORN, "weapon", "offhand", "amulet", "ring", "belt"],
    weapons: ["sword", "axe", "mace", "spear", "crossbow", "sceptre"], subs: ["shield"], armourTags: HAS_AR, tags: ["Attribute"],
    tiers: T([1, 3, 5, "of the Hauler"], [4, 6, 8, "of the Quarryman"], [8, 9, 12, "of the Smith"], [12, 13, 16, "of the Barrow-Bear"], [16, 17, 20, "of the Iron Giant"], [19, 21, 24, "of the Mountain King"]),
  },
  {
    id: "attr_dex", kind: "suffix", key: "dex", group: "attr_dex", weight: 7, classes: [...WORN, "weapon", "offhand", "amulet", "ring"],
    weapons: ["sword", "dagger", "claw", "spear", "quarterstaff", "bow", "crossbow"], subs: ["shield", "quiver"], armourTags: HAS_EV,
    classTags: { gloves: ALL_DEF }, tags: ["Attribute"],
    tiers: T([1, 3, 5, "of the Stoat"], [4, 6, 8, "of the Pickpocket"], [8, 9, 12, "of the Cutpurse"], [12, 13, 16, "of the Knife-Dancer"], [16, 17, 20, "of the Nightcat"], [19, 21, 24, "of the Shadowpaw"]),
  },
  {
    id: "attr_int", kind: "suffix", key: "int", group: "attr_int", weight: 7, classes: [...WORN, "weapon", "offhand", "amulet", "ring"],
    weapons: ["dagger", "quarterstaff", "wand", "staff", "sceptre"], subs: ["shield", "focus"], armourTags: HAS_ES,
    classTags: { helmet: ALL_DEF }, tags: ["Attribute"],
    tiers: T([1, 3, 5, "of the Novice"], [4, 6, 8, "of the Scribe"], [8, 9, 12, "of the Lamplighter"], [12, 13, 16, "of the Bone Scholar"], [16, 17, 20, "of the Black Library"], [19, 21, 24, "of the Starless Mind"]),
  },
  {
    id: "attr_all", kind: "suffix", key: "allAttr", group: "attr_all", weight: 3, classes: JEWELLERY, tags: ["Attribute"],
    tiers: T([3, 2, 4, "of the Ash Tree"], [9, 5, 7, "of Old Bones"], [15, 8, 10, "of the Pale Throne"]),
  },

  // ---- resistances ----
  {
    id: "def_res_fire", kind: "suffix", key: "resFire", group: "res_fire", weight: 8, classes: RES, subs: ["shield", "focus"], tags: ["Elemental", "Fire", "Resistance"],
    tiers: T([1, 6, 10, "of the Hearth"], [3, 11, 15, "of Cinderproof"], [6, 16, 20, "of the Charred Hide"], [9, 21, 25, "of the Pyre-Walker"], [13, 26, 30, "of the Coalwarden"], [17, 31, 35, "of the Ashen Saint"]),
  },
  {
    id: "def_res_cold", kind: "suffix", key: "resCold", group: "res_cold", weight: 8, classes: RES, subs: ["shield", "focus"], tags: ["Elemental", "Cold", "Resistance"],
    tiers: T([1, 6, 10, "of the Fur"], [3, 11, 15, "of Rimeproof"], [6, 16, 20, "of the Wolfpelt"], [9, 21, 25, "of the Glacier"], [13, 26, 30, "of the Long Night"], [17, 31, 35, "of the Frostbitten Saint"]),
  },
  {
    id: "def_res_light", kind: "suffix", key: "resLight", group: "res_light", weight: 8, classes: RES, subs: ["shield", "focus"], tags: ["Elemental", "Lightning", "Resistance"],
    tiers: T([1, 6, 10, "of Grounding"], [3, 11, 15, "of the Lodestone"], [6, 16, 20, "of the Copper Rod"], [9, 21, 25, "of the Stormwall"], [13, 26, 30, "of the Lightning-Eater"], [17, 31, 35, "of the Skyward Spire"]),
  },
  {
    id: "def_res_chaos", kind: "suffix", key: "resChaos", group: "res_chaos", weight: 4, classes: RES, subs: ["shield", "focus"], tags: ["Chaos", "Resistance"],
    tiers: T([4, 4, 7, "of Clean Blood"], [8, 8, 11, "of the Antidote"], [12, 12, 15, "of the Plague Doctor"], [16, 16, 19, "of the Leech-Eater"], [19, 20, 23, "of the Rotless"]),
  },
  {
    // PoE2: amulets, rings, and armour + energy shield shields.
    id: "def_res_all", kind: "suffix", key: "resAll", group: "res_all", weight: 3, classes: [...JEWELLERY, "offhand"], subs: ["shield"],
    classTags: { offhand: ["ar_es"] }, tags: ["Elemental", "Resistance"],
    tiers: T([3, 3, 5, "of the Spectrum"], [9, 6, 8, "of Mother-of-Pearl"], [15, 9, 12, "of the Bright Shell"]),
  },

  // ---- life / recovery ----
  {
    id: "regen", kind: "suffix", key: "regen", group: "regen", weight: 8, decimals: 1, classes: ["helmet", "body", "boots", "amulet", "ring", "belt"], tags: ["Life"], // PoE2: body / helmet / boots of every type, all jewellery
    tiers: T([1, 0.6, 1, "of Mending"], [4, 1.1, 1.6, "of Moss"], [8, 1.7, 2.4, "of Stitchwort"], [12, 2.5, 3.4, "of the Old Oak"], [16, 3.5, 4.6, "of the Rootheart"], [19, 4.7, 6, "of the Undying Elm"]),
  },
  {
    id: "flask_gain", kind: "suffix", key: "flaskGainInc", group: "flask_gain", weight: 6, classes: ["belt"], tags: ["Flask"],
    tiers: T([1, 10, 17, "of Brimming"], [6, 18, 27, "of the Deep Well"], [12, 28, 37, "of the Cask"], [17, 38, 48, "of the Bottomless Jug"]),
  },
  {
    // PoE2: flask recovery is a belt prefix.
    id: "flask_rec", kind: "prefix", key: "flaskRecInc", group: "flask_rec", weight: 6, classes: ["belt"], tags: ["Flask", "Life"],
    tiers: T([1, 10, 17, "Sipping"], [6, 18, 27, "Deep-Gulping"], [12, 28, 37, "Tippler's"], [17, 38, 48, "Wake-Feasting"]),
  },

  // ---- defensive utility ----
  {
    // Stands in for PoE2's "% increased Energy Shield Recharge Rate": int-tagged armour of every slot, armour + energy
    // shield shields and foci. (PoE2 gear has no "faster start" mod; that one is jewel-only.)
    id: "def_es_start", kind: "suffix", key: "esStart", group: "es_start", weight: 4, classes: [...WORN, "offhand"], subs: ["shield", "focus"], armourTags: HAS_ES,
    tags: ["Defences", "Energy Shield"],
    tiers: T([5, 15, 25, "of Quick Wards"], [10, 26, 38, "of the Ready Veil"], [15, 39, 50, "of the Unbroken Vigil"]),
  },
  {
    // PoE2: "% increased Block chance" is a shield / buckler prefix.
    id: "def_block", kind: "prefix", key: "lBlockInc", group: "block", weight: 5, classes: ["offhand"], subs: ["shield"], local: true, tags: ["Block"],
    tiers: T([1, 5, 10, "Parrying"], [7, 11, 18, "Turning"], [14, 19, 26, "Unbreached"]),
  },
  {
    // PoE2: maximum resistances roll on shields and bucklers only, at the top item levels.
    id: "def_max_res", kind: "suffix", key: "maxRes", group: "max_res", weight: 1, classes: ["offhand"], subs: ["shield"], tags: ["Elemental", "Resistance"],
    tiers: [{ ilvl: 16, min: 1, max: 1, name: "of the Tempered Rim" }, { ilvl: 19, min: 2, max: 2, name: "of the Storm-Proof Wall", weight: 0.5 }],
  },
  {
    id: "def_stun_thr", kind: "suffix", key: "stunThr", group: "stun_thr", weight: 5, classes: ["body", "boots", "belt", "offhand"], subs: ["shield"],
    tags: ["Defences"], // PoE2: body armour and boots of every type, shields and bucklers, belts
    tiers: T([1, 6, 12, "of Footing"], [5, 13, 20, "of the Anchor"], [10, 21, 28, "of the Millstone"], [15, 29, 37, "of the Standing Stone"]),
  },
  {
    // Stands in for PoE2's "reduced <ailment> duration on you" suffixes: body armour and boots of every type.
    // (PoE2 gear has no ailment threshold mod in the base pool.)
    id: "def_ail_thr", kind: "suffix", key: "ailThr", group: "ail_thr", weight: 4, classes: ["body", "boots"], tags: ["Defences", "Ailment"],
    tiers: T([3, 10, 17, "of Hardy Blood"], [8, 18, 26, "of the Unflinching"], [14, 27, 35, "of the Iron Gut"]),
  },
  {
    id: "dodge_cd", kind: "suffix", key: "dodgeCdRed", group: "dodge_cd", weight: 7, classes: ["boots", "belt", "amulet"], tags: ["Speed"],
    tiers: T([1, 5, 8, "of Tumbling"], [5, 9, 12, "of the Eel"], [10, 13, 16, "of the Weasel"], [15, 17, 20, "of the Smoke-Dancer"]),
  },
];

/** The six local %-defence families (one per defence tag), same tier shape, shared "def_pct" group. */
function pctDef(id: string, key: Affix["key"], defTags: DefTag[], tags: string[], names: string[]): Affix[] {
  const rows: [number, number, number][] = [[1, 10, 20], [4, 21, 32], [8, 33, 44], [12, 45, 56], [15, 57, 68], [18, 69, 80]];
  return [{
    id, kind: "prefix", key, group: "def_pct", weight: 7, classes: ARMOUR, defTags, local: true, tags,
    tiers: rows.map(([ilvl, min, max], i) => ({ ilvl, min, max, name: names[i] })),
  }];
}

/**
 * The three "% local defence + second stat" families of one defence type. PoE2 binds the second stat to
 * the slot: life on body / helmet / gloves, mana on helmets and foci, stun threshold on boots and shields.
 */
function defHybrid(def: DefTag, key: Affix["key"], tags: string[], fam: Record<"life" | "mana" | "stun", [id: string, names: string[]]>): Affix[] {
  const pct: [number, number, number][] = [[1, 6, 12], [6, 13, 20], [11, 21, 28], [16, 29, 36]];
  const second = { life: [[3, 6], [7, 11], [12, 16], [17, 22]], mana: [[4, 7], [8, 12], [13, 17], [18, 22]], stun: [[4, 7], [8, 12], [13, 17], [18, 22]] };
  const mk = (k: "life" | "mana" | "stun", key2: Affix["key"], classes: ItemClass[], subs: Affix["subs"], extraTags: string[]): Affix => ({
    id: fam[k][0], kind: "prefix", key, key2, group: `def_pct_${k}`, weight: 5, classes, ...(subs ? { subs } : {}), defTags: [def], local: true,
    tags: [...tags, ...extraTags],
    tiers: pct.map(([ilvl, min, max], i) => ({ ilvl, min, max, name: fam[k][1][i], min2: second[k][i][0], max2: second[k][i][1] })),
  });
  return [
    mk("life", "life", ["body", "helmet", "gloves"], undefined, ["Life"]),
    mk("mana", "mana", ["helmet", "offhand"], ["focus"], ["Mana"]),
    mk("stun", "stunThr", ["boots", "offhand"], ["shield"], []),
  ];
}
