// Runes: socketable stones that add a fixed modifier to gear sockets (PoE2 rune system, original
// names). Body armour and two-handed weapons hold 2 sockets, other weapons/armour 1, jewellery and
// belts none. A Boring Ember adds a socket; a Blighted Ember can add one past the limit.
import { registerItemKind } from "../grid";
import type { Item } from "../items";
import type { FxKey } from "./fx";
import type { ItemBase, ItemClass, ModKey } from "./types";

export const RUNE_PREFIX = "rune_";

export type RuneMod = [ModKey | FxKey, number];

export interface RuneDef {
  id: string;
  name: string;
  weapon: RuneMod; // granted when socketed in a weapon
  armour: RuneMod; // granted when socketed in armour (helmet/body/gloves/boots/off-hand)
  /** Per-slot overrides (PoE2 soul-core style: a different line per item class). */
  slots?: Partial<Record<ItemClass, RuneMod>>;
  /** Heartstone: the stronger, rarer socketable tier (PoE2 soul-core analogue). */
  core?: boolean;
  weight: number;
  minIlvl: number;
}

export const RUNES: RuneDef[] = [
  { id: "rune_rootbound", name: "Rootbound Rune", weapon: ["dmgFlat", 3], armour: ["life", 15], weight: 10, minIlvl: 1 },
  { id: "rune_quickwater", name: "Quickwater Rune", weapon: ["atkSpeedInc", 5], armour: ["moveInc", 3], weight: 8, minIlvl: 1 },
  { id: "rune_hearthstone", name: "Hearthstone Rune", weapon: ["leech", 1.5], armour: ["regen", 1], weight: 8, minIlvl: 1 },
  { id: "rune_stillmind", name: "Stillmind Rune", weapon: ["spellInc", 12], armour: ["mana", 15], weight: 8, minIlvl: 1 },
  { id: "rune_gale", name: "Gale Rune", weapon: ["reach", 8], armour: ["dodgeCdRed", 6], weight: 7, minIlvl: 1 },
  { id: "rune_bramble", name: "Bramble Rune", weapon: ["kbInc", 25], armour: ["thorns", 3], weight: 7, minIlvl: 1 },
  { id: "rune_hoarfrost", name: "Hoarfrost Rune", weapon: ["chillOnHit", 10], armour: ["dmgTakenRed", 3], weight: 6, minIlvl: 4 },
  { id: "rune_brimstone", name: "Brimstone Rune", weapon: ["dmgInc", 12], armour: ["flaskRecInc", 12], weight: 6, minIlvl: 4 },
  // Stronger "core" stones, deeper in the match.
  { id: "rune_kingsblood", name: "Kingsblood Rune", weapon: ["dmgInc", 22], armour: ["life", 30], weight: 3, minIlvl: 10 },
  { id: "rune_duskglass", name: "Duskglass Rune", weapon: ["pvpMore", 8], armour: ["dmgTakenRed", 6], weight: 2, minIlvl: 13 },
  // Heartstones (PoE2 soul-core analogue): rarer, stronger, and each item slot reads a different line.
  {
    id: "rune_heart_ossuary", name: "Ossuary Heartstone", core: true, weight: 1.2, minIlvl: 8,
    weapon: ["executeMore", 12], armour: ["life", 25],
    slots: { helmet: ["stunThr", 25], gloves: ["leech", 2], boots: ["killHaste", 15], offhand: ["block", 4] },
  },
  {
    id: "rune_heart_cinder", name: "Cinder Heartstone", core: true, weight: 1.2, minIlvl: 8,
    weapon: ["dmgInc", 18], armour: ["resFire", 18],
    slots: { helmet: ["critInc", 20], gloves: ["atkSpeedInc", 6], boots: ["moveInc", 5], body: ["maxRes", 2] },
  },
  {
    id: "rune_heart_gravewater", name: "Gravewater Heartstone", core: true, weight: 1.2, minIlvl: 8,
    weapon: ["chillOnHit", 15], armour: ["resCold", 18],
    slots: { helmet: ["mana", 30], gloves: ["manaRegen", 2], boots: ["dodgeCdRed", 10], body: ["esInc", 25] },
  },
  {
    id: "rune_heart_thornwife", name: "Thornwife Heartstone", core: true, weight: 1, minIlvl: 11,
    weapon: ["critMulti", 15], armour: ["thorns", 6],
    slots: { helmet: ["accuracy", 120], gloves: ["dmgFlat", 4], boots: ["ailThr", 25], body: ["armourInc", 30] },
  },
  {
    id: "rune_heart_magpie", name: "Magpie Heartstone", core: true, weight: 0.8, minIlvl: 11,
    weapon: ["pveMore", 15], armour: ["rarityInc", 12],
    slots: { helmet: ["rarityInc", 18], boots: ["rarityInc", 15] },
  },
];

export const RUNE_BY_ID = new Map(RUNES.map((r) => [r.id, r]));
export const isRune = (it: Item | null | undefined): it is Item => !!it && RUNE_BY_ID.has(it.b);

const ARMOUR: ItemClass[] = ["helmet", "body", "gloves", "boots", "offhand"];
const TWO_HAND_KINDS = new Set(["staff", "bow", "greataxe", "greatsword", "maul", "halberd"]);

/** Two-handed weapon base (explicit flag if the base catalogue grows one, else by kind / big footprint). */
export function isTwoHanded(base: ItemBase | undefined): boolean {
  if (!base?.weapon) return false;
  const b = base as ItemBase & { twoHanded?: boolean; hands?: number };
  if (b.twoHanded || b.hands === 2 || base.weapon.twoHand) return true;
  if (TWO_HAND_KINDS.has(base.weapon.kind)) return true;
  return !!base.size && base.size[0] >= 2 && base.size[1] >= 4;
}

/** Wand / staff / sceptre: PoE2 caster weapons take no rune sockets. */
const CASTER_KINDS = new Set(["wand", "staff", "sceptre"]);

/**
 * Normal socket limit for a base (PoE2): body armour and two-handed martial weapons 2; other
 * martial weapons, helmets, gloves, boots, shields / bucklers and foci 1; caster weapons, quivers,
 * jewellery and belts 0. A Blighted Ember can add one past this.
 */
export function socketLimit(base: ItemBase | undefined): number {
  if (!base) return 0;
  if (base.weapon && CASTER_KINDS.has(base.weapon.kind)) return 0;
  if (base.cls === "offhand" && base.sub === "quiver") return 0;
  if (base.cls === "body" || isTwoHanded(base)) return 2;
  if (base.cls === "weapon" || ARMOUR.includes(base.cls)) return 1;
  return 0;
}

/** The modifier a rune grants in an item of this class (null = can't go there). */
export function runeModFor(rune: RuneDef, cls: ItemClass | null): RuneMod | null {
  if (cls && rune.slots?.[cls]) return rune.slots[cls]!;
  if (cls === "weapon") return rune.weapon;
  if (cls && ARMOUR.includes(cls)) return rune.armour;
  return null;
}

registerItemKind({ category: "rune", matches: (it) => RUNE_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });
