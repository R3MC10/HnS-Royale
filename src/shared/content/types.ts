// Type vocabulary for content tables. Logic lives in ../items.ts and the server.

/** Equipment slots on a character. */
export type Slot =
  | "mainhand"
  | "offhand"
  | "helmet"
  | "body"
  | "gloves"
  | "boots"
  | "amulet"
  | "ring1"
  | "ring2"
  | "belt";

export const SLOTS: Slot[] = ["mainhand", "offhand", "helmet", "body", "gloves", "boots", "amulet", "ring1", "ring2", "belt"];

/** Item categories; decides which slot an item fits and which affixes can roll. */
export type ItemClass = "weapon" | "offhand" | "helmet" | "body" | "gloves" | "boots" | "amulet" | "ring" | "belt" | "flask";

/** Stat modifiers that affixes and implicits can grant (all map onto Stats). */
export type ModKey =
  | "life" // + maximum life
  | "moveInc" // % increased movement speed
  | "dmgFlat" // + attack damage
  | "dmgInc" // % increased attack damage
  | "atkSpeedInc" // % increased attack speed
  | "reach" // + attack reach (px)
  | "kbInc" // % increased knockback
  | "dodgeCdRed" // % reduced dodge cooldown
  | "regen" // life regenerated per second
  | "flaskGainInc" // % increased flask charges gained
  | "flaskRecInc" // % increased flask recovery (all flasks)
  | "mana" // + maximum mana (skills)
  | "manaRegen" // mana regenerated per second
  | "spellInc" // % increased spell damage
  | "spirit" // + spirit (persistent skills)
  | "arcInc" // % increased attack arc (uniques)
  // Defences (server/damage.ts)
  | "armour" // + armour
  | "armourInc" // % increased armour (incl. item base armour)
  | "evasion" // + evasion rating
  | "evasionInc" // % increased evasion rating
  | "es" // + maximum energy shield (barrier)
  | "esInc" // % increased energy shield
  | "esStart" // % faster start of energy shield recharge
  | "block" // + % chance to block
  | "resFire" // + % fire resistance
  | "resCold" // + % cold resistance
  | "resLight" // + % lightning resistance
  | "resChaos" // + % chaos resistance
  | "resAll" // + % to all elemental resistances
  | "maxRes" // + % to maximum elemental resistances
  | "accuracy" // + accuracy rating
  | "ailThr" // % increased ailment threshold
  | "stunThr" // % increased stun threshold
  | "critInc" // % increased critical strike chance
  | "critMulti" // + % critical damage bonus
  // ---- PoE2-style itemization (content/affixes.ts) ----
  // Local weapon mods: only change the weapon they are on (items.ts localWeapon).
  | "lDmgFlat" // adds physical damage to this weapon
  | "lDmgInc" // % increased physical damage of this weapon (additive with quality)
  | "lAtkSpd" // % increased attack speed of this weapon
  | "lCrit" // + % to critical hit chance of this weapon (flat, added to the base)
  // Local armour mods: only change the armour piece they are on (items.ts localDefences).
  | "lAr" // + armour on this item
  | "lEv" // + evasion on this item
  | "lEs" // + energy shield on this item
  | "lArInc" // % increased armour on this item
  | "lEvInc" // % increased evasion on this item
  | "lEsInc" // % increased energy shield on this item
  | "lArEvInc" // % increased armour and evasion on this item
  | "lArEsInc" // % increased armour and energy shield on this item
  | "lEvEsInc" // % increased evasion and energy shield on this item
  | "lBlockInc" // % increased block chance of this shield
  // Attributes (feed server/progression.ts like passive attributes)
  | "str"
  | "dex"
  | "int"
  | "allAttr"
  | "castInc" // % increased cast speed
  // + level of skill gems by tag (shared/skills.ts computeSkill)
  | "lvlSpell"
  | "lvlMelee"
  | "lvlProj"
  | "lvlFire" // fire spell skills
  | "lvlCold" // cold spell skills
  | "lvlLight" // lightning spell skills
  // Loot find (server/loot.ts reads them off the killer's gear; not a Stats field)
  | "rarityInc" // % increased rarity of items found
  | "quantInc"; // % increased quantity of items found

/** Flask-only modifiers. */
export type FlaskModKey =
  | "fRecInc" // % increased amount recovered
  | "fInstant" // recovery is instant (rolled with a recovery penalty, see content/flasks.ts)
  | "fMaxCharges" // + maximum charges
  | "fGainInc" // % increased charges gained
  | "fChargesRed" // % reduced charges per use
  // PoE2-shaped additions (itemization pass)
  | "fPartInstant" // % of recovery applied instantly (rest over the duration)
  | "fRateInc" // % increased recovery rate (same amount, shorter duration)
  | "fLowInstant" // recovery is instant while on low life
  | "fCureBleed" // removes bleeding and poison on use
  | "fCureElem" // removes ignite, chill, freeze and shock on use
  | "fCureStun" // removes stun and electrocute on use
  | "fNoConsume" // % chance not to consume charges
  | "fAmountMore"; // % more recovered (unique lines; negative = less)

export type WeaponKind =
  | "sword"
  | "spear"
  | "axe"
  | "dagger"
  | "mace"
  | "sceptre"
  | "claw"
  | "wand"
  | "quarterstaff"
  | "staff"
  | "bow"
  | "crossbow";

/** Defence category of an armour piece / shield (drives which base defences it carries). */
export type DefTag = "ar" | "ev" | "es" | "ar_ev" | "ar_es" | "ev_es";

export interface WeaponProps {
  kind: WeaponKind;
  damage: number;
  range: number; // reach beyond the body, px
  arcDeg: number; // total swing arc
  cooldown: number; // s between swings
  swingTime: number; // s
  knockback: number;
  swingMoveMult: number;
  /** Basic attack fires a projectile (bows, crossbows, wands). */
  ranged?: boolean;
  /** Occupies both hands: the off-hand must be empty (a bow may still hold a quiver). */
  twoHand?: boolean;
  /** Physical damage range [min, max] shown on the base (its average is `damage`). PoE2-style per-base roll. */
  phys?: [number, number];
  /** Base critical hit chance % of this weapon (replaces the unarmed default for attacks). */
  crit?: number;
  /** Crossbows: seconds to reload a bolt between volleys (display + skills that read it). */
  reload?: number;
}

export interface ItemBase {
  id: string;
  name: string;
  cls: Exclude<ItemClass, "flask">;
  reqIlvl: number; // minimum item level to drop
  weight: number; // relative drop weight among eligible bases
  implicit?: Partial<Record<ModKey, number>>;
  weapon?: WeaponProps;
  flaskSlots?: number; // belts only
  /** Paper-doll look (client art): helmet 1 hood 2 helm; body 1 leather 2 mail 3 plate; boots 1 boots 2 greaves; gloves 1 wraps 2 gauntlets; offhand 1 buckler 2 ward. */
  vis?: number;
  /** Inventory footprint [w, h] in grid cells; default comes from the class (see shared/grid.ts). */
  size?: [number, number];
  /** Visual look key (shared/look.ts LOOK_KEYS). */
  look?: string;
  /** Defence category (armour, shields). */
  def?: DefTag;
  /** Off-hand subtype. */
  sub?: "shield" | "focus" | "quiver";
  /** Requirements to equip: character level and attributes. */
  req?: { lvl?: number; str?: number; dex?: number; int?: number };
  /** Base defences granted while equipped (feed progression's armour / evasion / barrier). */
  armour?: number;
  evasion?: number;
  barrier?: number;
  /** Shields: % chance to block (combat-systems reads it; default SHIELD_BASE_BLOCK). */
  block?: number;
  /** Belts: number of charm slots unlocked (0-3). */
  charmSlots?: number;
}

export interface AffixTier {
  ilvl: number; // minimum item level for this tier
  min: number;
  max: number;
  name: string; // shown in magic item names
  /** Relative spawn weight of this tier (x the affix weight). Default falls off for higher tiers (affixes.ts tierWeight). */
  weight?: number;
  /** Hybrid mods: roll range of the second stat (Affix.key2). */
  min2?: number;
  max2?: number;
}

export interface Affix {
  id: string;
  kind: "prefix" | "suffix";
  key: ModKey;
  classes: ItemClass[];
  weight: number;
  decimals?: number; // rolled value precision (default integer)
  tiers: AffixTier[]; // ordered low -> high
  /** Mod group: an item never carries two mods of one group (default: the affix id). */
  group?: string;
  /** Hybrid mods: second stat granted by the same modifier (value range: tier min2..max2). */
  key2?: ModKey;
  /** Armour / shields: only bases whose defence tag is listed (local defence pools per tag). */
  defTags?: DefTag[];
  /** Base binding for mods shared with jewellery: on armour pieces (bases with a defence tag) the mod
   *  only rolls on these defence types; bases without a defence tag (jewellery, weapons) are unaffected. */
  armourTags?: DefTag[];
  /** Per-class override of `armourTags`: for a class listed here, bases with a defence tag must carry one
   *  of these tags instead (PoE2: Dexterity rolls on every glove type but only on dex-tagged body armour;
   *  all-resistance rolls on jewellery and on armour + energy shield shields only). */
  classTags?: Partial<Record<ItemClass, DefTag[]>>;
  /** Weapons: only these weapon kinds (default: any weapon). */
  weapons?: WeaponKind[];
  /** Off-hands: only these subtypes (default: any off-hand). */
  subs?: ("shield" | "focus" | "quiver")[];
  /** Two-handed weapons roll this multiple of the tier values (PoE2: bigger rolls on 2H). */
  twoHand?: number;
  /** Local: changes only the item it is on (tooltip tag). */
  local?: boolean;
  /** Tooltip mod tags shown in the advanced (Alt) view. */
  tags?: string[];
}

export interface FlaskBase {
  id: string;
  name: string;
  reqIlvl: number;
  weight: number;
  maxCharges: number;
  chargesPerUse: number;
  heal: number; // total life restored
  duration: number; // s over which it heals
  /** What it restores (default life). Mana flasks restore mana (skills). */
  res?: "life" | "mana";
}

export interface FlaskAffix {
  id: string;
  kind: "prefix" | "suffix";
  key: FlaskModKey;
  name: string;
  min: number;
  max: number;
  weight: number;
  /** Item-level tiers (low -> high). When set, min / max / name above mirror the lowest tier. */
  tiers?: AffixTier[];
}
