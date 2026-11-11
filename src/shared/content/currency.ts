// Crafting currency: the "Ember" family (original names). Each ember applies one PoE2-style
// crafting mechanic to a target item. Server logic: server/crafting.ts. Client UX: client/crafting.ts.
// Also hosts the stack contract shared with the inventory (one field: Item.k = stack size).
import { registerItemKind } from "../grid";
import type { Item } from "../items";
import { ESSENCE_PREFIX } from "./essences";
import { RUNE_PREFIX } from "./runes";

export const CURRENCY_PREFIX = "cur_";

export type CurrencyEffect =
  | "transmute" // normal -> magic (1 mod)
  | "augment" // magic: add a mod
  | "regal" // magic -> rare (+1 mod)
  | "exalt" // rare: add a mod
  | "chaos" // rare: remove one random mod, add one new
  | "annul" // magic/rare: remove one random mod
  | "divine" // reroll the numeric values of every mod
  | "alch" // normal -> rare (4 mods)
  | "quality" // +quality (max 20)
  | "socket" // gear: add a rune socket (up to the base's limit)
  | "corrupt" // unpredictable outcome, item becomes corrupted (no more crafting)
  | "gemsocket" // skill gem: +1 support socket (max 5); hook in shared/skills.ts socketCount
  | "chance"; // normal -> unique of the same base, or the item is destroyed

/**
 * What a quality currency works on (PoE2 splits quality by item class):
 * martial weapons / caster weapons (wand, staff, sceptre) / armour (helmet, body, gloves, boots,
 * shield, buckler, focus) / flasks and charms / skill gems.
 */
export type QualityTarget = "martial" | "caster" | "armour" | "flask" | "gem";

export interface CurrencyDef {
  id: string; // item base id (cur_*)
  name: string;
  effect: CurrencyEffect;
  desc: string; // tooltip line
  weight: number; // relative drop weight
  minIlvl: number;
  /** Quality currencies: the item class it improves. */
  quality?: QualityTarget;
  /**
   * Greater / perfect variants (PoE2): the added modifier must have at least this modifier level
   * (its tier's item-level requirement). The target's item level still caps the tier.
   */
  minModLevel?: number;
  /** Variant grade for display / art: 1 = greater ("White-Hot"), 2 = perfect ("Soulfire"). */
  grade?: 1 | 2;
}

// Drop weights follow PoE2's relative scarcity (basic upgrades common, rerolls and value rerolls
// rare), tuned so a full match yields a handful of Embers (see content/loot.ts EXTRA_DROPS).
// Greater / perfect variants only drop from higher item levels, like PoE2's drop levels.
const QUAL_RULE = "+5% on Normal, +2% on Magic, +1% on Rare or Unique (max 20%)";
export const CURRENCIES: CurrencyDef[] = [
  { id: "cur_kindling", name: "Kindling Ember", effect: "transmute", weight: 20, minIlvl: 1, desc: "Kindles a Normal item into a Magic item with one modifier" },
  { id: "cur_stoking", name: "Stoking Ember", effect: "augment", weight: 15, minIlvl: 1, desc: "Adds a modifier to a Magic item with room for one" },
  { id: "cur_crowning", name: "Crowning Ember", effect: "regal", weight: 7, minIlvl: 1, desc: "Raises a Magic item to Rare, adding one modifier" },
  { id: "cur_blazing", name: "Blazing Ember", effect: "exalt", weight: 6, minIlvl: 3, desc: "Adds a modifier to a Rare item with room for one" },
  { id: "cur_shifting", name: "Shifting Ember", effect: "chaos", weight: 4.5, minIlvl: 1, desc: "Removes a random modifier from a Rare item and adds a new one" },
  { id: "cur_quenching", name: "Quenching Ember", effect: "annul", weight: 2, minIlvl: 4, desc: "Removes a random modifier from a Magic or Rare item" },
  { id: "cur_tempering", name: "Tempering Ember", effect: "divine", weight: 1.5, minIlvl: 6, desc: "Rerolls the values of every modifier on an item" },
  { id: "cur_forgeheart", name: "Forgeheart Ember", effect: "alch", weight: 4, minIlvl: 1, desc: "Reforges a Normal item into a Rare item with four modifiers" },
  { id: "cur_gambit", name: "Gambit Ember", effect: "chance", weight: 4, minIlvl: 1, desc: "Gambles a Normal item: it may become a Unique of the same base, or it is destroyed" },
  // Quality, split by item class as in PoE2.
  { id: "cur_honing", name: "Honing Ember", effect: "quality", quality: "martial", weight: 6, minIlvl: 1, desc: `Improves a martial weapon's quality, raising its base damage. ${QUAL_RULE}` },
  { id: "cur_inscribing", name: "Inscribing Ember", effect: "quality", quality: "caster", weight: 3, minIlvl: 1, desc: `Improves a wand, staff or sceptre's quality, raising its base damage. ${QUAL_RULE}` },
  { id: "cur_riveting", name: "Riveting Ember", effect: "quality", quality: "armour", weight: 8, minIlvl: 1, desc: `Improves an armour piece's quality, raising its base Armour, Evasion and Energy Shield. ${QUAL_RULE}` },
  { id: "cur_glazing", name: "Glazing Ember", effect: "quality", quality: "flask", weight: 5, minIlvl: 1, desc: `Improves a flask's or charm's quality: flasks recover more, charms last longer. ${QUAL_RULE}` },
  { id: "cur_polish", name: "Lapidary's Polish", effect: "quality", quality: "gem", weight: 3, minIlvl: 1, desc: "Improves a skill gem's quality by 5% (max 20%): each 2% quality is 1% more damage" },
  { id: "cur_boring", name: "Boring Ember", effect: "socket", weight: 6, minIlvl: 1, desc: "Bores a rune socket into a martial weapon or armour piece (body armour and two-handers hold 2, others 1)" },
  { id: "cur_blighted", name: "Blighted Ember", effect: "corrupt", weight: 3, minIlvl: 1, desc: "Corrupts an item with an unpredictable outcome. Corrupted items can't be modified further" },
  { id: "cur_awl", name: "Lapidary's Awl", effect: "gemsocket", weight: 3, minIlvl: 1, desc: "Bores another support socket into a skill gem (max 5)" },
  // Greater ("White-Hot") and perfect ("Soulfire") variants: a minimum modifier level, as in PoE2.
  ...variants("cur_kindling", "Kindling Ember", "transmute", "Kindles a Normal item into a Magic item with one modifier", 8, 14),
  ...variants("cur_stoking", "Stoking Ember", "augment", "Adds a modifier to a Magic item with room for one", 8, 14),
  ...variants("cur_crowning", "Crowning Ember", "regal", "Raises a Magic item to Rare, adding one modifier", 7, 10),
  ...variants("cur_blazing", "Blazing Ember", "exalt", "Adds a modifier to a Rare item with room for one", 7, 10),
  ...variants("cur_shifting", "Shifting Ember", "chaos", "Removes a random modifier from a Rare item and adds a new one", 7, 10),
];

/** Greater (+ grade 1) and perfect (grade 2) variants of a basic Ember. */
function variants(id: string, name: string, effect: CurrencyEffect, desc: string, greater: number, perfect: number): CurrencyDef[] {
  return [
    { id: `${id}_g`, name: `White-Hot ${name}`, effect, grade: 1, minModLevel: greater, weight: 0.8, minIlvl: 9, desc: `${desc}. The new modifier is at least modifier level ${greater}` },
    { id: `${id}_p`, name: `Soulfire ${name}`, effect, grade: 2, minModLevel: perfect, weight: 0.25, minIlvl: 14, desc: `${desc}. The new modifier is at least modifier level ${perfect}` },
  ];
}

export const CURRENCY_BY_ID = new Map(CURRENCIES.map((c) => [c.id, c]));

export const isCurrency = (it: Item | null | undefined): it is Item => !!it && CURRENCY_BY_ID.has(it.b);

/** Label colour for currency (ground labels, tooltips). */
export const CURRENCY_COLOR = "#cdb27a";

export const QUALITY_STEP = 5;
export const MAX_QUALITY = 20;
/** Quality one use adds, by rarity (PoE2: Normal 5, Magic 2, Rare / Unique 1). Gems always 5. */
export const QUALITY_BY_RARITY = [5, 2, 1, 1] as const;
/** Gambit Ember (chance): odds the Normal item becomes a Unique; otherwise it's destroyed. */
export const CHANCE_UNIQUE_ODDS = 0.2;

/** Wand / staff / sceptre: caster weapons (PoE2: their own quality currency, no rune sockets). */
export const CASTER_WEAPON_KINDS: ReadonlySet<string> = new Set(["wand", "staff", "sceptre"]);
/** Support sockets a gem can reach with Lapidary's Awls. */
export const GEM_SOCKET_MAX = 5;

// Corruption outcome weights (Blighted Ember). PoE2's outcome set: nothing / an implicit is added
// or replaced / a socket past the limit / up to 3 modifiers rerolled / (brick-like) the item is
// rerolled into a new Rare. Odds are our call (PoE2 doesn't publish them).
export const CORRUPT_OUTCOMES: { id: "nothing" | "implicit" | "socket" | "values" | "unravel"; weight: number; text: string }[] = [
  { id: "nothing", weight: 25, text: "The ember gutters. Nothing changes, but the item is corrupted." },
  { id: "implicit", weight: 25, text: "A blighted implicit takes root." },
  { id: "socket", weight: 15, text: "The blight bores an extra socket, past the usual limit." },
  { id: "values", weight: 20, text: "Up to three modifiers twist into new ones." },
  { id: "unravel", weight: 15, text: "The item unravels into a new Rare with random modifiers." },
];

// ---- stacks (contract with the inventory agent) -------------------------------------

/** Stack size of an item (Item.k, default 1). */
export function stackSize(it: Item): number {
  return Math.max(1, Math.floor(it.k ?? 1));
}

/** Largest stack an item can form (1 = doesn't stack). */
export function stackMax(it: Item): number {
  if (CURRENCY_BY_ID.has(it.b)) return 20;
  if (it.b.startsWith(RUNE_PREFIX) || it.b.startsWith(ESSENCE_PREFIX)) return 10;
  return 1;
}

/** Two items can merge into one stack. */
export function canStack(a: Item, b: Item): boolean {
  return a.b === b.b && stackMax(a) > 1 && a.r === b.r && !a.m.length && !b.m.length;
}

registerItemKind({ category: "currency", matches: (it) => CURRENCY_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });
