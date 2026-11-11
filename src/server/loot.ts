// Item generation (server-only: all randomness lives here).
import { MAX_ITEM_LEVEL } from "../shared/constants";
import { AFFIXES, MAGIC_MAX_PER_KIND, MAX_PREFIXES, MAX_SUFFIXES, RARITY_MOD_COUNT } from "../shared/content/affixes";
import { BASES, BASE_BY_ID, STARTER_WEAPONS } from "../shared/content/bases";
import { FLASK_BASES, FLASK_BASE_BY_ID, FLASK_MAGIC_CHANCE, STARTING_FLASK } from "../shared/content/flasks";
import { DROPS, EXTRA_DROPS, MAX_FIND_QUANT, MAX_FIND_RARITY, MONSTER_LOOT_BONUS, POI_DROPS, RARE_NAME_A, RARE_NAME_B, type DropSource, type DropTable } from "../shared/content/loot";
import { itemAllTotals } from "../shared/content/specialmods";
import { SLOTS } from "../shared/content/types";
import { CURRENCIES, CURRENCY_BY_ID } from "../shared/content/currency";
import { RUNES, RUNE_BY_ID } from "../shared/content/runes";
import { ESSENCES, ESSENCE_BY_ID } from "../shared/content/essences";
import { UNIQUES, UNIQUE_BY_ID } from "../shared/content/uniques";
import { CHARMS, CHARM_BY_ID } from "../shared/content/charms";
import { JEWEL_BASES, JEWEL_BASE_BY_ID } from "../shared/content/jewels";
import { addRandomMod, makeUnique, poolFor, renameItem, uniqueBaseLevel } from "./crafting";
import type { Affix, WeaponKind } from "../shared/content/types";
import { flaskProps, type Item, type ItemMod, type Rarity } from "../shared/items";

let nextItemId = 1;
/** Mint a fresh item id (stack splits etc.). */
export const newItemId = () => nextItemId++;

const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

function weighted<T>(items: readonly T[], weight: (t: T) => number): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function rollValue(min: number, max: number, decimals = 0) {
  const p = Math.pow(10, decimals);
  return Math.round((min + Math.random() * (max - min)) * p) / p;
}

function rollRarity(weights: [number, number, number]): Rarity {
  return weighted([0, 1, 2] as const, (r) => weights[r]) ?? 0;
}

/** Roll a gear item (not a flask) of the given item level. */
export function rollItem(ilvl: number, rarity: Rarity, baseId?: string): Item {
  ilvl = Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.round(ilvl)));
  const base = (baseId && BASE_BY_ID.get(baseId)) || weighted(BASES.filter((b) => b.reqIlvl <= ilvl), (b) => b.weight)!;

  // PoE2 rolling (server/crafting.ts addRandomMod): pool by class / weapon kind / off-hand subtype /
  // defence tag, one mod per group, every allowed (affix, tier) weighted with higher tiers rarer,
  // Magic 1-2 mods (max 1 prefix + 1 suffix), Rare 4-6 mods (max 3 + 3).
  const item: Item = { id: nextItemId++, b: base.id, r: rarity, l: ilvl, n: base.name, m: [] };
  const pool = poolFor(item);
  if (pool && rarity > 0 && rarity < 3) {
    const [lo, hi] = RARITY_MOD_COUNT[rarity];
    const want = randInt(lo, hi);
    for (let i = 0; i < want; i++) if (!addRandomMod(item, pool)) break;
  }
  // Rarity reflects what actually rolled (a pool could run dry).
  if (!item.m.length) item.r = 0;
  renameItem(item, pool, true);
  return item;
}

export function rollFlask(ilvl: number, baseId?: string, chargesFrac = 0): Item {
  const base = (baseId && FLASK_BASE_BY_ID.get(baseId)) || weighted(FLASK_BASES.filter((b) => b.reqIlvl <= ilvl), (b) => b.weight)!;
  const item: Item = { id: nextItemId++, b: base.id, r: 0, l: Math.max(1, Math.round(ilvl)), n: base.name, m: [] };
  if (!baseId && Math.random() < FLASK_MAGIC_CHANCE) {
    // Magic flask: 1-2 mods (max 1 prefix + 1 suffix), tiers gated by item level (PoE2).
    const pool = poolFor(item)!;
    item.r = 1;
    const n = randInt(1, 2);
    for (let i = 0; i < n; i++) addRandomMod(item, pool);
    if (!item.m.length) item.r = 0;
    renameItem(item, pool);
  }
  item.c = Math.floor(flaskProps(item, 1).maxCharges * chargesFrac);
  return item;
}

export function starterWeapon(kind: WeaponKind): Item {
  return rollItem(1, 0, STARTER_WEAPONS[kind]);
}

export function starterFlask(): Item {
  return rollFlask(1, STARTING_FLASK, 0.5);
}

/**
 * PoE2 drop context for one kill. ilvl: the monster level (everything it drops takes it as item
 * level, plus the monster-rarity bonus). monRarity: monster rarity (quantity / rarity bonus).
 * rarity / quant: the killer's % increased rarity / quantity of items found (playerFind).
 */
export interface DropContext {
  ilvl?: number;
  monRarity?: 0 | 1 | 2 | 3;
  rarity?: number;
  quant?: number;
}

/** Resolved multipliers: Q scales how many things drop, R how rare the gear is. */
interface DropMods {
  il: () => number;
  Q: number;
  R: number;
}

function dropMods(range: [number, number], ctx: DropContext = {}): DropMods {
  const mb = MONSTER_LOOT_BONUS[ctx.monRarity ?? 0] ?? MONSTER_LOOT_BONUS[0];
  const q = Math.max(0, Math.min(MAX_FIND_QUANT, ctx.quant ?? 0)) + mb.quant;
  const r = Math.max(0, Math.min(MAX_FIND_RARITY, ctx.rarity ?? 0)) + mb.rarity;
  const lvl = ctx.ilvl;
  return {
    il: typeof lvl === "number" ? () => clampIlvl(lvl + mb.ilvl) : () => randInt(range[0], range[1]),
    Q: 1 + q / 100,
    R: r / 100,
  };
}

/** How many times a `chance` roll hits once quantity scales it past 1 (1.4 = 1 + 40% for a 2nd). */
function rollCount(chance: number, Q: number): number {
  const x = Math.max(0, chance * Q);
  return Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);
}

/** PoE-style rarity: increased rarity scales the chance of each upgrade (magic, rare), not normals. */
function rarityWeights(w: [number, number, number], R: number): [number, number, number] {
  return [w[0], w[1] * (1 + R), w[2] * (1 + R)];
}

/** The killer's % increased rarity / quantity of items found, from gear (affixes, runes, implicits). */
export function playerFind(p: { equip: Record<string, Item | null> }): { rarity: number; quant: number } {
  let rarity = 0;
  let quant = 0;
  for (const s of SLOTS) {
    const it = p.equip[s];
    if (!it) continue;
    const t = itemAllTotals(it);
    rarity += t.rarityInc ?? 0;
    quant += t.quantInc ?? 0;
  }
  return { rarity, quant };
}

/**
 * Drop context for a monster kill: monster level (PoE2 area level, server/ai/hooks.ts) as item
 * level, its rarity, and the killer's find stats. Exiles have no monster level (their gear is their
 * loot), so they keep the table's item-level range.
 */
export function monsterDropContext(
  m: { ext?: { rarity?: number; level?: number }; type?: { ai?: string; boss?: unknown }; elite?: unknown },
  killer: { equip: Record<string, Item | null> } | null,
): DropContext {
  const ext = m.ext;
  const r = typeof ext?.rarity === "number" ? ext.rarity : m.elite ? 2 : 0;
  const monRarity = (m.type?.boss ? 3 : Math.max(0, Math.min(3, r))) as 0 | 1 | 2 | 3;
  const find = killer ? playerFind(killer) : { rarity: 0, quant: 0 };
  const ilvl = m.type?.ai !== "exile" && typeof ext?.level === "number" ? ext.level : undefined;
  return { ilvl, monRarity, rarity: find.rarity, quant: find.quant };
}

/** Roll everything a monster (or chest / strongbox / boss) drops. */
export function rollDrops(source: DropSource, ctx?: DropContext): Item[] {
  const t: DropTable = source === "normal" || source === "elite" ? DROPS[source] : POI_DROPS[source];
  const d = dropMods(t.ilvl, ctx);
  const out: Item[] = [];
  const weights = rarityWeights(t.rarity, d.R);
  for (const chance of t.itemChances) {
    for (let n = rollCount(chance, d.Q); n > 0; n--) out.push(rollItem(d.il(), rollRarity(weights)));
  }
  for (let n = rollCount(t.flaskChance, d.Q); n > 0; n--) out.push(rollFlask(d.il(), undefined, 0.3));
  return out.concat(rollExtraDrops(source, ctx));
}

// ---- loot agent: new item families ----------------------------------------------------------

const clampIlvl = (l: number) => Math.max(1, Math.min(MAX_ITEM_LEVEL, Math.round(l)));

/** Currency, runes, ichors, uniques, charms and jewels for one kill / container. */
export function rollExtraDrops(source: DropSource, ctx?: DropContext): Item[] {
  const t = EXTRA_DROPS[source];
  const { il, Q, R } = dropMods(t.ilvl, ctx);
  const out: Item[] = [];
  for (const ch of t.currency) for (let n = rollCount(ch, Q); n > 0; n--) out.push(rollCurrency(il()));
  for (let n = rollCount(t.rune, Q); n > 0; n--) out.push(rollRune(il()));
  for (let n = rollCount(t.essence, Q); n > 0; n--) out.push(rollEssence(il()));
  // Uniques: a rarity upgrade, so item rarity scales the chance (PoE2), quantity the count.
  for (let n = rollCount(t.unique * (1 + R), Q); n > 0; n--) {
    const u = rollUnique(il());
    if (u) out.push(u);
  }
  for (let n = rollCount(t.charm, Q); n > 0; n--) out.push(rollCharm(il()));
  for (let n = rollCount(t.jewel, Q); n > 0; n--) out.push(rollJewel(il(), rollRarity(rarityWeights([0, 60, 40], R))));
  return out;
}

function stackItem(b: string, name: string, ilvl: number): Item {
  return { id: nextItemId++, b, r: 0, l: clampIlvl(ilvl), n: name, m: [], k: 1 };
}

export function rollCurrency(ilvl: number, id?: string): Item {
  const c = (id && CURRENCY_BY_ID.get(id)) || weighted(CURRENCIES.filter((x) => x.minIlvl <= ilvl), (x) => x.weight)!;
  return stackItem(c.id, c.name, ilvl);
}

export function rollRune(ilvl: number, id?: string): Item {
  const r = (id && RUNE_BY_ID.get(id)) || weighted(RUNES.filter((x) => x.minIlvl <= ilvl), (x) => x.weight)!;
  return stackItem(r.id, r.name, ilvl);
}

export function rollEssence(ilvl: number, id?: string): Item {
  const e = (id && ESSENCE_BY_ID.get(id)) || weighted(ESSENCES.filter((x) => x.minIlvl <= ilvl), (x) => x.weight)!;
  return stackItem(e.id, e.name, ilvl);
}

/** A random unique whose base can drop at this ilvl (or a specific one). */
export function rollUnique(ilvl: number, uid?: string): Item | null {
  ilvl = clampIlvl(ilvl);
  const u =
    (uid && UNIQUE_BY_ID.get(uid)) ||
    weighted(UNIQUES.filter((x) => { const lv = uniqueBaseLevel(x.base); return lv > 0 && lv <= ilvl; }), (x) => x.weight); // gear, flask, charm and jewel uniques
  if (!u) return null;
  return makeUnique(u.id, ilvl, nextItemId++);
}

export function rollCharm(ilvl: number, id?: string, magicChance = 0.5): Item {
  ilvl = clampIlvl(ilvl);
  const d = (id && CHARM_BY_ID.get(id)) || weighted(CHARMS.filter((x) => x.minIlvl <= ilvl), (x) => x.weight)!;
  const it: Item = { id: nextItemId++, b: d.id, r: 0, l: ilvl, n: d.name, m: [], c: Math.round(d.maxCharges / 2) };
  if (!id && Math.random() < magicChance) {
    const pool = poolFor(it)!;
    it.r = 1;
    const n = randInt(1, 2);
    for (let i = 0; i < n; i++) addRandomMod(it, pool);
    renameItem(it, pool);
  }
  return it;
}

export function rollJewel(ilvl: number, rarity: Rarity, id?: string): Item {
  ilvl = clampIlvl(ilvl);
  const b = (id && JEWEL_BASE_BY_ID.get(id)) || weighted(JEWEL_BASES.filter((x) => x.minIlvl <= ilvl), (x) => x.weight)!;
  const it: Item = { id: nextItemId++, b: b.id, r: 0, l: ilvl, n: b.name, m: [] };
  const pool = poolFor(it)!;
  const r = rarity >= 2 ? 2 : 1;
  it.r = r;
  const n = r === 1 ? randInt(1, 2) : randInt(3, 4);
  for (let i = 0; i < n; i++) addRandomMod(it, pool);
  renameItem(it, pool, true);
  return it;
}
