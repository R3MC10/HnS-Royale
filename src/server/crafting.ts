// Server-authoritative crafting: Embers (currency), Ichors (essences), Runes (sockets) and the
// Lapidary's Awl (gem sockets). The client sends { t: "craft", cur, target } (item ids); every check
// happens here. Also hosts the generic affix-pool machinery (gear, flasks, charms, jewels) that
// server/loot.ts reuses to roll the new item families.
import { consumeOne as invConsumeOne } from "./inventory";
import { AFFIXES, MAX_PREFIXES, MAX_SUFFIXES, affixAllowed, affixGroup, affixesFor, rollTier, tierWeight } from "../shared/content/affixes";
import { BASE_BY_ID } from "../shared/content/bases";
import { CHARM_AFFIXES, CHARM_BY_ID, charmAffixTiers } from "../shared/content/charms";
import {
  CHANCE_UNIQUE_ODDS,
  CORRUPT_OUTCOMES,
  CURRENCY_BY_ID,
  GEM_SOCKET_MAX,
  MAX_QUALITY,
  type CurrencyDef,
  type CurrencyEffect,
} from "../shared/content/currency";
import { ESSENCE_BY_ID, essenceTier } from "../shared/content/essences";
import { eligibleTierIdx, qualityRefusal, qualityStep } from "../shared/craftrules";
import { UNIQUES } from "../shared/content/uniques";
import { FLASK_AFFIXES, FLASK_BASE_BY_ID, flaskAffixTiers } from "../shared/content/flasks";
import { JEWEL_AFFIXES, JEWEL_BASE_BY_ID, JEWEL_MAX_PER_KIND, jewelAffixFits } from "../shared/content/jewels";
import { RARE_NAME_A, RARE_NAME_B } from "../shared/content/loot";
import { RUNE_BY_ID, socketLimit } from "../shared/content/runes";
import { CORRUPT_IMPLICITS, CORRUPT_IMPLICIT_BY_ID } from "../shared/content/specialmods";
import { UNIQUE_BY_ID, uniqueModLine } from "../shared/content/uniques";
import { SLOTS, type AffixTier, type ItemBase } from "../shared/content/types";
import { entryById } from "../shared/grid";
import { baseName, flaskProps, type Item, type ItemMod, type Rarity } from "../shared/items";
import { charmProps } from "../shared/lootinfo";
import { isSkillGem, socketCount } from "../shared/skills";
import type { ServerPlayer } from "./player";

// ---- rng ------------------------------------------------------------------------------

export const rand = {
  next: () => Math.random(),
};
const rnd = () => rand.next();
const randInt = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

export function weighted<T>(items: readonly T[], weight: (t: T) => number): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return null;
  let r = rnd() * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export function rollValue(min: number, max: number, decimals = 0) {
  const p = Math.pow(10, decimals);
  return Math.round((min + rnd() * (max - min)) * p) / p;
}

// ---- affix pools ------------------------------------------------------------------------

export interface PoolAffix {
  id: string;
  kind: "prefix" | "suffix";
  weight: number;
  tiers: AffixTier[];
  decimals?: number;
  /** Mod group (default: id): never two mods of one group on an item. */
  group?: string;
  /** Two-handed weapons roll this multiple of the tier values. */
  twoHand?: number;
}

export interface Pool {
  affixes: PoolAffix[];
  /** Gear base the pool was built for (two-handed value scaling). */
  base?: ItemBase;
  maxRarity: 1 | 2;
  maxPerKind: number; // rare: per kind; magic is always 1
}

/** Crafting pool for an item, or null if it isn't craftable with Embers. */
export function poolFor(item: Item): Pool | null {
  const base = BASE_BY_ID.get(item.b);
  if (base) {
    // PoE2 pools: class, weapon kind, off-hand subtype and defence tag decide what can roll (affixes.ts affixAllowed).
    return { affixes: affixesFor(base), base, maxRarity: 2, maxPerKind: Math.min(MAX_PREFIXES, MAX_SUFFIXES) };
  }
  if (FLASK_BASE_BY_ID.has(item.b)) {
    return {
      affixes: FLASK_AFFIXES.map((a) => ({ id: a.id, kind: a.kind, weight: a.weight, tiers: flaskAffixTiers(a) })), // ilvl-tiered (PoE2)
      maxRarity: 1,
      maxPerKind: 1,
    };
  }
  if (CHARM_BY_ID.has(item.b)) {
    return {
      affixes: CHARM_AFFIXES.map((a) => ({ id: a.id, kind: a.kind, weight: a.weight, tiers: charmAffixTiers(a) })), // ilvl-tiered (PoE2)
      maxRarity: 1,
      maxPerKind: 1,
    };
  }
  const jb = JEWEL_BASE_BY_ID.get(item.b);
  if (jb) {
    return {
      // PoE2: each jewel class rolls from its own pool (jewels.ts `bases`).
      affixes: JEWEL_AFFIXES.filter((a) => jewelAffixFits(a, jb.id)).map((a) => ({ ...a, weight: a.weight * (jb.leaning.includes(a.key) ? 3 : 1) })),
      maxRarity: 2,
      maxPerKind: JEWEL_MAX_PER_KIND,
    };
  }
  return null;
}

const isExplicit = (m: ItemMod) => !CORRUPT_IMPLICIT_BY_ID.has(m.a);

function counts(item: Item, pool: Pool) {
  let p = 0;
  let s = 0;
  for (const m of item.m) {
    const a = pool.affixes.find((x) => x.id === m.a);
    if (!a) continue;
    if (a.kind === "prefix") p++;
    else s++;
  }
  return { p, s };
}

function kindCap(item: Item, pool: Pool) {
  return item.r === 1 || pool.maxRarity === 1 ? 1 : pool.maxPerKind;
}

/**
 * Adds one random eligible mod; false if nothing fits. `exclude`: affix ids not to pick.
 * `minModLevel` (greater / perfect Embers, PoE2): only tiers whose modifier level (item-level
 * requirement) is at least this can roll; the item level still caps the tier.
 */
export function addRandomMod(item: Item, pool: Pool, exclude: string[] = [], minModLevel = 0): boolean {
  const { p, s } = counts(item, pool);
  const cap = kindCap(item, pool);
  const used = new Set(item.m.map((m) => m.a).concat(exclude));
  const groups = usedGroups(item, pool);
  // PoE2: every (affix, tier) the item level allows is its own weighted entry; higher tiers are rarer
  // (affixes.ts tierWeight), and a family already on the item (same group) is out.
  const cands: { a: PoolAffix; idx: number; w: number }[] = [];
  for (const a of pool.affixes) {
    if (used.has(a.id) || groups.has(affixGroup(a)) || (a.kind === "prefix" ? p >= cap : s >= cap)) continue;
    for (const idx of eligibleTierIdx(a.tiers, item.l, minModLevel)) cands.push({ a, idx, w: a.weight * tierWeight(a, idx) });
  }
  const c = weighted(cands, (x) => x.w);
  if (!c) return false;
  item.m.push({ a: c.a.id, t: c.idx, ...rollTier(c.a, c.idx, pool.base, rnd) });
  return true;
}

/** Mod groups already on the item (PoE2: one mod per group). */
function usedGroups(item: Item, pool: Pool): Set<string> {
  const out = new Set<string>();
  for (const m of item.m) {
    const a = pool.affixes.find((x) => x.id === m.a);
    if (a) out.add(affixGroup(a));
  }
  return out;
}

/** Could addRandomMod succeed (room + an eligible affix at this modifier level)? */
function canAddMod(item: Item, pool: Pool, minModLevel = 0, exclude: string[] = []): boolean {
  const { p, s } = counts(item, pool);
  const cap = kindCap(item, pool);
  const used = new Set(item.m.map((m) => m.a).concat(exclude));
  const groups = usedGroups(item, pool);
  return pool.affixes.some(
    (a) => !used.has(a.id) && !groups.has(affixGroup(a)) && (a.kind === "prefix" ? p < cap : s < cap) && eligibleTierIdx(a.tiers, item.l, minModLevel).length > 0,
  );
}

function hasRoom(item: Item, pool: Pool): boolean {
  const { p, s } = counts(item, pool);
  const cap = kindCap(item, pool);
  return p < cap || s < cap;
}

/** Rebuild the display name after a rarity / mod change. */
export function renameItem(item: Item, pool: Pool | null, forceNewRare = false) {
  const bn = baseName(item);
  if (item.r === 0) item.n = bn;
  else if (item.r === 1) {
    let pre: string | undefined;
    let suf: string | undefined;
    for (const m of item.m) {
      const a = pool?.affixes.find((x) => x.id === m.a);
      if (!a) continue;
      const name = a.tiers[Math.min(m.t, a.tiers.length - 1)]?.name;
      if (a.kind === "prefix") pre ??= name;
      else suf ??= name;
    }
    item.n = [pre, bn, suf].filter(Boolean).join(" ");
  } else if (item.r === 2 && (forceNewRare || !isRareName(item.n))) {
    item.n = `${pick(RARE_NAME_A)} ${pick(RARE_NAME_B)}`;
  }
}

const isRareName = (n: string) => {
  const [a, b] = n.split(" ");
  return RARE_NAME_A.includes(a) && RARE_NAME_B.includes(b);
};

/** Reroll one mod's value inside its range (tier, unique line or blighted implicit). */
function rerollMod(item: Item, m: ItemMod, pool: Pool | null) {
  const a = pool?.affixes.find((x) => x.id === m.a);
  if (a) {
    const r = rollTier(a, Math.min(m.t, a.tiers.length - 1), pool?.base, rnd); // hybrid mods reroll both values
    m.v = r.v;
    if (r.v2 !== undefined) m.v2 = r.v2;
    return;
  }
  const u = uniqueModLine(m.a);
  if (u) {
    const [, min, max, dec] = u.u.mods[u.i];
    m.v = rollValue(min, max, dec ?? 0);
    return;
  }
  const x = CORRUPT_IMPLICIT_BY_ID.get(m.a);
  if (x) m.v = rollValue(x.min, x.max, x.decimals ?? 0);
}

// ---- locating items ---------------------------------------------------------------------

type Where = { k: "grid" } | { k: "equip" } | { k: "flask" } | { k: "charm" };

export function findOwned(p: ServerPlayer, id: number): { it: Item; where: Where } | null {
  const e = entryById(p.inv, id);
  if (e) return { it: e.it, where: { k: "grid" } };
  for (const s of SLOTS) if (p.equip[s]?.id === id) return { it: p.equip[s]!, where: { k: "equip" } };
  for (const f of p.flasks) if (f?.id === id) return { it: f, where: { k: "flask" } };
  const charms = (p as { charms?: (Item | null)[] }).charms;
  if (charms) for (const c of charms) if (c?.id === id) return { it: c, where: { k: "charm" } };
  return null;
}

/** Take one from a grid stack (inventory agent's consumeOne: removes the entry at 0). */
function consumeOne(p: ServerPlayer, id: number) {
  invConsumeOne(p, id);
}

// ---- applying currency --------------------------------------------------------------------

export interface CraftResult {
  err?: string;
  msg?: string;
  /** The target was equipped: caller must recompute stats. */
  equipped?: boolean;
  /** The target was destroyed (failed Gambit Ember): craft() removes it from the player. */
  destroyed?: boolean;
}

const NO = (err: string): CraftResult => ({ err });

/** Apply consumable `curId` (grid item) onto `targetId` (grid, equipped, flask or charm). */
export function craft(p: ServerPlayer, curId: unknown, targetId: unknown): CraftResult {
  if (typeof curId !== "number" || typeof targetId !== "number") return NO("Bad craft");
  if (curId === targetId) return NO("Pick another item");
  const ce = entryById(p.inv, curId);
  if (!ce) return NO("The currency must be in your bag");
  const tgt = findOwned(p, targetId);
  if (!tgt) return NO("No such item");
  const cur = ce.it;
  const item = tgt.it;
  let res: CraftResult;
  const c = CURRENCY_BY_ID.get(cur.b);
  if (c) res = applyEffect(c.effect, item, c);
  else if (ESSENCE_BY_ID.has(cur.b)) res = applyEssence(cur.b, item);
  else if (RUNE_BY_ID.has(cur.b)) res = applyRune(cur.b, item);
  else return NO("That can't be applied to items");
  if (res.err) return res;
  consumeOne(p, curId);
  if (res.destroyed) destroyOwned(p, targetId, tgt.where);
  p.invDirty = true;
  return { ...res, equipped: tgt.where.k === "equip" };
}

/** Remove a crafting target from wherever the player carries it. */
function destroyOwned(p: ServerPlayer, id: number, where: Where) {
  if (where.k === "grid") return void invConsumeOne(p, id);
  if (where.k === "equip") {
    for (const s of SLOTS) if (p.equip[s]?.id === id) p.equip[s] = null;
    return;
  }
  if (where.k === "flask") {
    const i = p.flasks.findIndex((f) => f?.id === id);
    if (i >= 0) p.flasks[i] = null;
    return;
  }
  const charms = (p as { charms?: (Item | null)[] }).charms;
  const i = charms ? charms.findIndex((c) => c?.id === id) : -1;
  if (charms && i >= 0) charms[i] = null;
}

const UNMOD_UNIQUE = "Uniques can't be modified that way";
const CORRUPTED = "Corrupted items can't be modified";

export function applyEffect(effect: CurrencyEffect, item: Item, def?: CurrencyDef): CraftResult {
  if (effect === "gemsocket") return applyGemSocket(item);
  if (item.x) return NO(CORRUPTED);
  const pool = poolFor(item);
  const unique = item.r === 3;
  const minLvl = def?.minModLevel ?? 0;

  switch (effect) {
    case "quality": {
      // PoE2: one quality currency per item class; +5 / +2 / +1 by rarity.
      const target = def?.quality ?? "martial";
      const why = qualityRefusal(item, target);
      if (why) return NO(why);
      item.q = Math.min(MAX_QUALITY, (item.q ?? 0) + qualityStep(item, target));
      return { msg: `Quality raised to ${item.q}%` };
    }
    case "chance":
      return applyChance(item);
    case "socket": {
      const lim = socketLimit(BASE_BY_ID.get(item.b));
      if (lim <= 0) return NO("Only weapons and armour take sockets");
      const n = item.s?.length ?? 0;
      if (n >= lim) return NO(`Already has ${n} socket${n > 1 ? "s" : ""} (the limit)`);
      item.s = [...(item.s ?? []), null];
      return { msg: `Bored a socket (${item.s.length}/${lim})` };
    }
    case "corrupt":
      return corrupt(item, pool);
    case "divine": {
      const mods = item.m;
      if (!mods.length) return NO("No modifiers to temper");
      for (const m of mods) rerollMod(item, m, pool);
      return { msg: "Modifier values rerolled" };
    }
  }

  if (unique) return NO(UNMOD_UNIQUE);
  if (!pool) return NO("That item can't be crafted");

  const noLevel = `No modifier of level ${minLvl}+ can roll on this item (item level ${item.l})`;
  switch (effect) {
    case "transmute":
      if (item.r !== 0) return NO("Needs a Normal item");
      item.r = 1;
      if (!addRandomMod(item, pool, [], minLvl)) return revert(item, 0, minLvl ? noLevel : undefined);
      renameItem(item, pool);
      return { msg: "Kindled to Magic" };
    case "augment":
      if (item.r !== 1) return NO("Needs a Magic item");
      if (!hasRoom(item, pool)) return NO("No room for another modifier");
      if (!addRandomMod(item, pool, [], minLvl)) return NO(minLvl ? noLevel : "No room for another modifier");
      renameItem(item, pool);
      return { msg: "Added a modifier" };
    case "regal": {
      if (pool.maxRarity < 2) return NO("This item can't become Rare");
      if (item.r !== 1) return NO("Needs a Magic item");
      item.r = 2;
      if (minLvl && !canAddMod(item, pool, minLvl)) return revert(item, 1, noLevel);
      addRandomMod(item, pool, [], minLvl);
      renameItem(item, pool, true);
      return { msg: "Crowned to Rare" };
    }
    case "alch": {
      if (pool.maxRarity < 2) return NO("This item can't become Rare");
      if (item.r !== 0) return NO("Needs a Normal item");
      item.r = 2;
      for (let i = 0; i < 4; i++) addRandomMod(item, pool);
      if (!item.m.length) return revert(item, 0);
      renameItem(item, pool, true);
      return { msg: "Reforged into a Rare" };
    }
    case "exalt":
      if (item.r !== 2) return NO("Needs a Rare item");
      if (!hasRoom(item, pool)) return NO("No room for another modifier");
      if (!addRandomMod(item, pool, [], minLvl)) return NO(minLvl ? noLevel : "No room for another modifier");
      return { msg: "Added a modifier" };
    case "chaos": {
      if (item.r !== 2) return NO("Needs a Rare item");
      const ex = item.m.filter(isExplicit);
      if (!ex.length) return NO("No modifiers to shift");
      const gone = pick(ex);
      const at = item.m.indexOf(gone);
      item.m.splice(at, 1);
      if (minLvl && !canAddMod(item, pool, minLvl, [gone.a])) {
        item.m.splice(at, 0, gone); // greater / perfect: refuse rather than strip a mod for nothing
        return NO(noLevel);
      }
      addRandomMod(item, pool, [gone.a], minLvl);
      return { msg: "A modifier shifted" };
    }
    case "annul": {
      if (item.r !== 1 && item.r !== 2) return NO("Needs a Magic or Rare item");
      const ex = item.m.filter(isExplicit);
      if (!ex.length) return NO("No modifiers to remove");
      item.m.splice(item.m.indexOf(pick(ex)), 1);
      if (item.r === 1) renameItem(item, pool);
      return { msg: "A modifier was quenched" };
    }
  }
  return NO("Nothing happens");
}

function revert(item: Item, r: Rarity, why = "No modifier can roll on this item"): CraftResult {
  item.r = r;
  return NO(why);
}

/** Gambit Ember (PoE2 chance): a Normal item becomes a Unique of its base, or is destroyed. */
function applyChance(item: Item): CraftResult {
  if (!BASE_BY_ID.has(item.b)) return NO("Only Normal gear can be gambled");
  if (item.r !== 0) return NO("Needs a Normal item");
  const options = UNIQUES.filter((u) => u.base === item.b);
  if (!options.length) return NO("No Unique is known on this base");
  if (rnd() >= CHANCE_UNIQUE_ODDS) return { destroyed: true, msg: `The gamble fails: ${item.n} crumbles to ash` };
  const u = weighted(options, (x) => x.weight) ?? options[0];
  const made = makeUnique(u.id, item.l, item.id);
  if (!made) return NO("No Unique is known on this base");
  item.r = 3;
  item.n = made.n;
  item.u = made.u;
  item.m = made.m;
  return { msg: `The gamble pays: ${made.n}!` };
}

function corrupt(item: Item, pool: Pool | null): CraftResult {
  const ok = BASE_BY_ID.has(item.b) || JEWEL_BASE_BY_ID.has(item.b);
  if (!ok) return NO("Only gear and jewels can be corrupted");
  const out = weighted(CORRUPT_OUTCOMES, (o) => o.weight)!;
  let text = out.text;
  item.x = 1;
  switch (out.id) {
    case "implicit": {
      // PoE2: a corruption implicit is added, replacing any blighted implicit already there.
      const old = item.m.filter((m) => CORRUPT_IMPLICIT_BY_ID.has(m.a));
      item.m = item.m.filter((m) => !CORRUPT_IMPLICIT_BY_ID.has(m.a));
      const x = pick(CORRUPT_IMPLICITS.filter((c) => !old.some((o) => o.a === c.id)));
      if (x) item.m.unshift({ a: x.id, t: 0, v: rollValue(x.min, x.max, x.decimals ?? 0) });
      if (old.length) text = "The blight rewrites the item's implicit.";
      break;
    }
    case "socket": {
      const lim = socketLimit(BASE_BY_ID.get(item.b));
      if (lim > 0 && (item.s?.length ?? 0) < lim + 1) item.s = [...(item.s ?? []), null];
      else text = CORRUPT_OUTCOMES[0].text;
      break;
    }
    case "values": {
      // PoE2: up to 3 modifiers are rerolled into new ones. Uniques (fixed lines) and items with
      // no explicit mods get their values twisted instead (80% .. 130%).
      const ex = item.m.filter(isExplicit);
      if (pool && item.r !== 3 && ex.length) {
        const n = Math.min(ex.length, randInt(1, 3));
        item.x = undefined; // so addRandomMod's caps see the live item
        for (let i = 0; i < n; i++) {
          const live = item.m.filter(isExplicit);
          const gone = pick(live);
          item.m.splice(item.m.indexOf(gone), 1);
          addRandomMod(item, pool, [gone.a]);
        }
        item.x = 1;
        renameItem(item, pool);
        text = `${n === 1 ? "A modifier twists" : `${n} modifiers twist`} into new ones.`;
      } else {
        for (const m of item.m) {
          const f = 0.8 + rnd() * 0.5; // 80% .. 130%
          m.v = Math.round(m.v * f * 10) / 10;
          if (Math.abs(m.v) >= 5) m.v = Math.round(m.v);
        }
        text = "Every value twists: some stronger, some weaker.";
      }
      break;
    }
    case "unravel":
      if (item.r === 3 || !pool) {
        for (const m of item.m) rerollMod(item, m, pool);
        text = "The blight rerolls every value.";
      } else {
        item.r = 2;
        item.m = item.m.filter((m) => !isExplicit(m));
        const n = randInt(3, 5);
        item.x = undefined; // so addRandomMod's caps see a normal rare
        for (let i = 0; i < n; i++) addRandomMod(item, pool);
        item.x = 1;
        renameItem(item, pool, true);
      }
      break;
  }
  return { msg: `Corrupted. ${text}` };
}

export function applyEssence(essId: string, item: Item): CraftResult {
  // PoE2 essences: faint / plain / potent turn a Magic item Rare with the guaranteed mod; primeval
  // (perfect) works on a Rare, removing one random modifier first. The grade fixes the tier.
  const ess = ESSENCE_BY_ID.get(essId)!;
  if (item.x) return NO(CORRUPTED);
  const base = BASE_BY_ID.get(item.b);
  if (!base) return NO("Ichors only work on gear");
  if (item.r === 3) return NO(UNMOD_UNIQUE);
  const perfect = ess.grade === 3;
  if (perfect ? item.r !== 2 : item.r !== 1) return NO(perfect ? "Primeval ichors need a Rare item" : "Needs a Magic item");
  const affix = AFFIXES.find((a) => a.id === ess.affix);
  if (!affix || !affixAllowed(affix, base)) return NO(`${ess.name} can't take hold on ${base.cls === "weapon" ? "this weapon" : base.cls}`);
  if (item.m.some((m) => m.a === affix.id || AFFIXES.find((x) => x.id === m.a && affixGroup(x) === affixGroup(affix)))) return NO("The item already has a modifier of that kind");
  const pool = poolFor(item)!;
  const tier = essenceTier(ess.grade, affix.tiers.length);
  const t = affix.tiers[tier];
  item.r = 2;
  if (perfect) {
    // Remove a random explicit modifier, preferring one of the same kind so the new mod fits.
    const ex = item.m.filter(isExplicit);
    const same = ex.filter((m) => pool.affixes.find((a) => a.id === m.a)?.kind === affix.kind);
    const gone = same.length && !kindHasRoom(item, pool, affix.kind) ? pick(same) : ex.length ? pick(ex) : null;
    if (gone) item.m.splice(item.m.indexOf(gone), 1);
    if (!kindHasRoom(item, pool, affix.kind)) {
      // Removed the other kind and this one is still full: drop one of this kind too.
      const sk = item.m.filter((m) => isExplicit(m) && pool.affixes.find((a) => a.id === m.a)?.kind === affix.kind);
      if (sk.length) item.m.splice(item.m.indexOf(pick(sk)), 1);
    }
  }
  item.m.push({ a: affix.id, t: tier, ...rollTier(affix, tier, base, rnd) });
  renameItem(item, pool, !perfect);
  return { msg: `The ichor binds: ${perfect ? "a modifier is replaced by" : "Rare with"} ${t.name}` };
}

function kindHasRoom(item: Item, pool: Pool, kind: "prefix" | "suffix"): boolean {
  const { p, s } = counts(item, pool);
  const cap = kindCap(item, pool);
  return kind === "prefix" ? p < cap : s < cap;
}

export function applyRune(runeId: string, item: Item): CraftResult {
  const rune = RUNE_BY_ID.get(runeId)!;
  const base = BASE_BY_ID.get(item.b);
  if (!base || socketLimit(base) <= 0) return NO("Runes go into weapon or armour sockets");
  if (!item.s?.length) return NO("No sockets (bore one with a Boring Ember)");
  let i = item.s.indexOf(null);
  let replaced = "";
  if (i < 0) {
    i = 0;
    replaced = ` (replaced ${RUNE_BY_ID.get(item.s[0]!)?.name ?? "a rune"})`;
  }
  item.s = item.s.slice();
  item.s[i] = rune.id;
  return { msg: `${rune.name} socketed${replaced}` };
}

function applyGemSocket(item: Item): CraftResult {
  if (!isSkillGem(item)) return NO("Lapidary's Awls work on skill gems");
  if (item.x) return NO(CORRUPTED);
  const n = socketCount(item);
  if (n >= GEM_SOCKET_MAX) return NO(`Already has ${GEM_SOCKET_MAX} support sockets`);
  item.gs = n + 1;
  return { msg: `Support sockets: ${item.gs}` };
}

// ---- unique rolling (used by loot.ts) ---------------------------------------------------------

let nextUid = 1_000_000;
/** Item ids: loot.ts passes its own allocator in so ids never collide. */
export function makeUnique(uid: string, ilvl: number, id: number = nextUid++): Item | null {
  const u = UNIQUE_BY_ID.get(uid);
  // Uniques exist on gear, flask, charm and jewel bases (PoE2 covers every class).
  if (!u || !uniqueBaseLevel(u.base)) return null;
  const it: Item = {
    id,
    b: u.base,
    r: 3,
    l: ilvl,
    n: u.name,
    u: u.id,
    m: u.mods.map(([, min, max, dec], i) => ({ a: `u_${u.id}_${i}`, t: 0, v: rollValue(min, max, dec ?? 0) })),
  };
  const fb = FLASK_BASE_BY_ID.get(u.base);
  if (fb) it.c = Math.floor(flaskProps(it, 1).maxCharges * 0.5); // found half full, like other flasks
  const cb = CHARM_BY_ID.get(u.base);
  if (cb) it.c = Math.round((charmProps(it)?.maxCharges ?? cb.maxCharges) / 2);
  return it;
}

/** Drop level of a unique's base (gear, flask, charm or jewel), or 0 if the base is unknown. */
export function uniqueBaseLevel(baseId: string): number {
  return (
    BASE_BY_ID.get(baseId)?.reqIlvl ??
    FLASK_BASE_BY_ID.get(baseId)?.reqIlvl ??
    CHARM_BY_ID.get(baseId)?.minIlvl ??
    JEWEL_BASE_BY_ID.get(baseId)?.minIlvl ??
    0
  );
}
