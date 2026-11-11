// Equipment / grid inventory / flask-slot operations (server-authoritative).
// Every function validates its inputs (client data is untrusted) and returns an
// error string or null. Grid rules (footprints, bounds, overlap) live in shared/grid.ts.
import { MAX_FLASK_SLOTS } from "../shared/constants";
import { defenceMoveMult } from "./damage";
import { applyPlayerProgression, progEquipError, progJewelMods, progTakeJewels } from "./progression";
import { applyLootStatus } from "./uniques";
import { SLOTS, type Slot, type WeaponKind } from "../shared/content/types";
import { clampStats } from "../shared/stats";
import { computeStats, defaultSlotFor, emptyEquipment, isFlask, slotAccepts, type Item } from "../shared/items";
import { entryById, findFree, fits, footprint, overlapping, type GridEntry } from "../shared/grid";
import type { EquipTarget, InvMsg } from "../shared/protocol";
import { offhandAllowed } from "../shared/content/bases";
import { MAX_CHARM_SLOTS, charmSlotsFor, isCharm } from "../shared/content/charms";
import { canStack, stackMax, stackSize } from "../shared/content/currency";
import { starterFlask, starterWeapon } from "./loot";
import type { ServerPlayer } from "./player";
import { applySkillStatus, resetSkills, stripBar } from "./skills";

export type DropFn = (item: Item, x: number, y: number) => void;

const NO_ROOM = "Not enough room";

const isSlot = (s: unknown): s is Slot => typeof s === "string" && (SLOTS as string[]).includes(s);
const isId = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
function flaskIndex(t: unknown): number {
  if (typeof t !== "string" || !t.startsWith("flask")) return -1;
  const i = Number(t.slice(5));
  return Number.isInteger(i) && i >= 0 && i < MAX_FLASK_SLOTS ? i : -1;
}

function charmIndex(t: unknown): number {
  if (typeof t !== "string" || !t.startsWith("charm")) return -1;
  const i = Number(t.slice(5));
  return Number.isInteger(i) && i >= 0 && i < MAX_CHARM_SLOTS ? i : -1;
}

function charms(p: ServerPlayer): (Item | null)[] {
  if (!p.charms || p.charms.length !== MAX_CHARM_SLOTS) p.charms = Array.from({ length: MAX_CHARM_SLOTS }, (_, i) => p.charms?.[i] ?? null);
  return p.charms;
}

function freeCharmSlot(p: ServerPlayer): number {
  const n = charmSlotsFor(p.equip);
  for (let i = 0; i < n; i++) if (!charms(p)[i]) return i;
  return -1;
}

// ---- stacks (Item.k, see shared/content/currency.ts) ---------------------------------
type Stk = Item & { k?: number };
const setStack = (it: Item, n: number) => {
  if (n > 1) (it as Stk).k = n;
  else delete (it as Stk).k;
};

/** Merge as much of `item` as fits into existing grid stacks. Returns what's left (0 = all merged). */
function mergeIntoStacks(p: ServerPlayer, item: Item): number {
  let left = stackSize(item);
  if (stackMax(item) <= 1) return left;
  for (const e of p.inv) {
    if (left <= 0) break;
    if (e.it === item || !canStack(e.it, item)) continue;
    const room = stackMax(e.it) - stackSize(e.it);
    if (room <= 0) continue;
    const n = Math.min(room, left);
    setStack(e.it, stackSize(e.it) + n);
    left -= n;
    p.invDirty = true;
  }
  if (left > 0) setStack(item, left);
  return left;
}

/** Snapshot / restore for multi-step operations that may fail half-way. */
function snapshot(p: ServerPlayer) {
  return { inv: p.inv.slice(), equip: { ...p.equip }, flasks: p.flasks.slice(), charms: charms(p).slice() };
}
function restore(p: ServerPlayer, s: ReturnType<typeof snapshot>) {
  p.inv = s.inv;
  p.equip = s.equip;
  p.flasks = s.flasks;
  p.charms = s.charms;
  p.invDirty = true;
}

/**
 * Two-hand rule: a two-handed weapon empties the off-hand (a bow keeps its quiver), and an
 * off-hand pushes a two-handed weapon out. Returns the item that must leave, if any.
 */
function handConflict(p: ServerPlayer, slot: Slot, item: Item): { slot: Slot; it: Item } | null {
  if (slot === "mainhand" && p.equip.offhand && !offhandAllowed(item.b, p.equip.offhand.b)) return { slot: "offhand", it: p.equip.offhand };
  if (slot === "offhand" && p.equip.mainhand && !offhandAllowed(p.equip.mainhand.b, item.b)) return { slot: "mainhand", it: p.equip.mainhand };
  return null;
}

/** Auto-equip option: the item has an empty slot of its own and the hero meets its requirements. */
export function canAutoEquip(p: ServerPlayer, item: Item): boolean {
  if (isFlask(item)) return freeFlaskSlot(p) >= 0;
  if (isCharm(item)) return freeCharmSlot(p) >= 0;
  const slot = defaultSlotFor(item, p.equip);
  if (!slot || p.equip[slot]) return false;
  if (progEquipError(p, (item as Item).b)) return false;
  return !handConflict(p, slot, item as Item);
}

function freeFlaskSlot(p: ServerPlayer): number {
  for (let i = 0; i < p.stats.flaskSlots; i++) if (!p.flasks[i]) return i;
  return -1;
}

// ---- grid helpers ---------------------------------------------------------------

/** Place at (x, y) if that spot is free and in bounds. */
function placeAt(p: ServerPlayer, item: Item, x: number, y: number): boolean {
  if (!fits(p.inv, footprint(item), x, y)) return false;
  p.inv.push({ x, y, it: item });
  p.invDirty = true;
  return true;
}

/** First-fit placement (columns left to right, top to bottom), without stack merging. */
function placeFirstFit(p: ServerPlayer, item: Item): boolean {
  const at = findFree(p.inv, footprint(item));
  return !!at && placeAt(p, item, at.x, at.y);
}

/** Into the grid: top up matching stacks first (up to stackMax), then first fit for the rest. */
export function autoPlace(p: ServerPlayer, item: Item): boolean {
  if (mergeIntoStacks(p, item) <= 0) return true;
  return placeFirstFit(p, item);
}

/** Prefer (x, y) (e.g. the cell an item was just taken from), else first fit. */
function placeNear(p: ServerPlayer, item: Item, x: number, y: number): boolean {
  return placeAt(p, item, x, y) || autoPlace(p, item);
}

function removeEntry(p: ServerPlayer, e: GridEntry) {
  const i = p.inv.indexOf(e);
  if (i >= 0) p.inv.splice(i, 1);
  p.invDirty = true;
}

/** Gear stats + status effects -> p.stats. Call after any equipment or status change. */
export function refreshStats(p: ServerPlayer, drop: DropFn) {
  p.gearStats = applyPlayerProgression(p, computeStats(p.equip, progJewelMods(p))); // + tree jewels, level / passives / ascendancy
  const s = { ...p.gearStats };
  s.moveSpeed *= p.slowMult;
  s.moveSpeed *= defenceMoveMult(p); // chill (server/damage.ts)
  applySkillStatus(p, s); // skill buffs / auras / chill / use-move (server/skills.ts)
  applyLootStatus(p, s); // unique / charm speed effects, chill-on-hit, slow immunity (server/uniques.ts)
  p.stats = clampStats(s);
  if (p.hp > p.stats.maxHp) p.hp = p.stats.maxHp;
  // A smaller belt locks flask slots: move those flasks to the grid, or the floor.
  for (let i = p.stats.flaskSlots; i < MAX_FLASK_SLOTS; i++) {
    const f = p.flasks[i];
    if (!f) continue;
    p.flasks[i] = null;
    if (!autoPlace(p, f)) drop(f, p.x, p.y);
  }
  // Same for charm slots when the belt changes.
  const cs = charms(p);
  for (let i = charmSlotsFor(p.equip); i < MAX_CHARM_SLOTS; i++) {
    const c = cs[i];
    if (!c) continue;
    cs[i] = null;
    if (!autoPlace(p, c)) drop(c, p.x, p.y);
  }
  p.invDirty = true;
}

/** Fresh match kit: chosen starting weapon + one half-full basic flask, nothing else. */
export function giveStarterKit(p: ServerPlayer, kind: WeaponKind, drop: DropFn) {
  p.equip = emptyEquipment();
  p.inv = [];
  p.flasks = new Array(MAX_FLASK_SLOTS).fill(null);
  p.charms = new Array(MAX_CHARM_SLOTS).fill(null);
  p.alt = { mainhand: null, offhand: null };
  p.weaponSet = 0;
  p.equip.mainhand = starterWeapon(kind);
  p.flasks[0] = starterFlask();
  p.heals = [];
  refreshStats(p, drop);
  resetSkills(p); // fresh bar + starter gem, full mana
}

/** Removes and returns everything the player carries: equipment, grid and flasks (death drops). */
export function stripAll(p: ServerPlayer): Item[] {
  const out: Item[] = [];
  for (const s of SLOTS) if (p.equip[s]) out.push(p.equip[s]!);
  for (const e of p.inv) out.push(e.it);
  for (const it of p.flasks) if (it) out.push(it);
  for (const it of charms(p)) if (it) out.push(it);
  out.push(...progTakeJewels(p)); // jewels socketed in the passive tree drop too (full loot)
  if (p.alt?.mainhand) out.push(p.alt.mainhand);
  if (p.alt?.offhand) out.push(p.alt.offhand);
  p.alt = { mainhand: null, offhand: null };
  out.push(...stripBar(p)); // socketed gems drop too (full loot)
  p.equip = emptyEquipment();
  p.inv = [];
  p.flasks = new Array(MAX_FLASK_SLOTS).fill(null);
  p.charms = new Array(MAX_CHARM_SLOTS).fill(null);
  p.heals = [];
  p.invDirty = true;
  return out;
}

/**
 * Pickup: stackables top up existing stacks first, charms / flasks fill a free slot, everything
 * else goes to the first grid spot that fits.
 */
export function storeItem(p: ServerPlayer, item: Item): string | null {
  if (mergeIntoStacks(p, item) <= 0) return null;
  if (isCharm(item)) {
    const c = freeCharmSlot(p);
    if (c >= 0) {
      charms(p)[c] = item;
      p.invDirty = true;
      return null;
    }
  }
  if (isFlask(item)) {
    const f = freeFlaskSlot(p);
    if (f >= 0) {
      p.flasks[f] = item;
      p.invDirty = true;
      return null;
    }
  }
  if (autoPlace(p, item)) return null;
  p.noRoom.push(item.id);
  return NO_ROOM;
}

/** Equip an item straight from the ground; the replaced item goes to the grid or the floor. */
export function equipDirect(p: ServerPlayer, item: Item, drop: DropFn): string | null {
  if (isFlask(item)) {
    const f = freeFlaskSlot(p);
    const idx = f >= 0 ? f : 0;
    const old = p.flasks[idx];
    p.flasks[idx] = item;
    if (old && !autoPlace(p, old)) drop(old, p.x, p.y);
    p.invDirty = true;
    return null;
  }
  if (isCharm(item)) {
    const c = freeCharmSlot(p);
    if (c < 0) return storeItem(p, item);
    charms(p)[c] = item;
    p.invDirty = true;
    return null;
  }
  const slot = defaultSlotFor(item, p.equip);
  if (!slot) return "Can't equip that";
  const reqErr = progEquipError(p, (item as Item).b); // attribute / level requirements (progression)
  if (reqErr) return reqErr;
  const conflict = handConflict(p, slot, item);
  const old = p.equip[slot];
  p.equip[slot] = item;
  if (old && !autoPlace(p, old)) drop(old, p.x, p.y);
  if (conflict) {
    p.equip[conflict.slot] = null;
    if (!autoPlace(p, conflict.it)) drop(conflict.it, p.x, p.y);
  }
  refreshStats(p, drop);
  return null;
}

/** Where an item currently is. */
type Loc = { k: "grid"; e: GridEntry } | { k: "slot"; s: Slot } | { k: "flask"; i: number } | { k: "charm"; i: number };

function locate(p: ServerPlayer, id: number): Loc | null {
  const e = entryById(p.inv, id);
  if (e) return { k: "grid", e };
  for (const s of SLOTS) if (p.equip[s]?.id === id) return { k: "slot", s };
  for (let i = 0; i < MAX_FLASK_SLOTS; i++) if (p.flasks[i]?.id === id) return { k: "flask", i };
  for (let i = 0; i < MAX_CHARM_SLOTS; i++) if (charms(p)[i]?.id === id) return { k: "charm", i };
  return null;
}

/**
 * Put item `id` into `to` (or its default slot). From the grid, whatever was in the
 * slot goes back into the grid (the vacated cells first). Between slots (ring 1 <->
 * ring 2, flask <-> flask) the two items swap.
 */
export function equipItem(p: ServerPlayer, id: unknown, to: unknown, drop: DropFn): string | null {
  if (!isId(id)) return "Bad item";
  const loc = locate(p, id);
  if (!loc) return "No such item";
  if (to !== undefined && !isSlot(to) && flaskIndex(to) < 0 && charmIndex(to) < 0) return "Bad slot";

  if (loc.k === "charm") {
    const j = charmIndex(to);
    if (j < 0 || j >= charmSlotsFor(p.equip)) return "Doesn't fit that slot";
    if (j === loc.i) return null;
    const cs = charms(p);
    [cs[loc.i], cs[j]] = [cs[j], cs[loc.i]];
    p.invDirty = true;
    return null;
  }

  if (loc.k === "flask") {
    const j = flaskIndex(to);
    if (j < 0 || j >= p.stats.flaskSlots) return "Doesn't fit that slot";
    if (j === loc.i) return null;
    [p.flasks[loc.i], p.flasks[j]] = [p.flasks[j], p.flasks[loc.i]];
    p.invDirty = true;
    return null;
  }

  if (loc.k === "slot") {
    if (!isSlot(to) || to === loc.s) return to === loc.s ? null : "Doesn't fit that slot";
    const item = p.equip[loc.s]!;
    const other = p.equip[to];
    if (!slotAccepts(to, item) || (other && !slotAccepts(loc.s, other))) return "Doesn't fit that slot";
    p.equip[to] = item;
    p.equip[loc.s] = other;
    refreshStats(p, drop);
    return null;
  }

  // From the grid.
  const e = loc.e;
  const item = e.it;
  if (isCharm(item)) {
    let ci = to === undefined ? freeCharmSlot(p) : charmIndex(to);
    if (to === undefined && ci < 0 && charmSlotsFor(p.equip) > 0) ci = 0;
    if (ci < 0 || ci >= charmSlotsFor(p.equip)) return "No free charm slot (a better belt adds more)";
    const cs = charms(p);
    const old = cs[ci];
    removeEntry(p, e);
    if (old && !placeNear(p, old, e.x, e.y)) {
      p.inv.push(e); // revert
      return NO_ROOM;
    }
    cs[ci] = item;
    p.invDirty = true;
    return null;
  }
  if (isFlask(item)) {
    let fi = to === undefined ? freeFlaskSlot(p) : flaskIndex(to);
    if (to === undefined && fi < 0) fi = 0;
    if (fi < 0 || fi >= p.stats.flaskSlots) return "No free flask slot (a belt adds more)";
    const old = p.flasks[fi];
    removeEntry(p, e);
    if (old && !placeNear(p, old, e.x, e.y)) {
      p.inv.push(e); // revert
      return NO_ROOM;
    }
    p.flasks[fi] = item;
    p.invDirty = true;
    return null;
  }

  const slot = to === undefined ? defaultSlotFor(item, p.equip) : isSlot(to) ? to : null;
  if (!slot || !slotAccepts(slot, item)) return "Doesn't fit that slot";
  const reqErr = progEquipError(p, (item as Item).b); // attribute / level requirements (progression)
  if (reqErr) return reqErr;
  const snap = snapshot(p);
  const conflict = handConflict(p, slot, item);
  const old = p.equip[slot];
  removeEntry(p, e);
  if (old && !placeNear(p, old, e.x, e.y)) {
    restore(p, snap);
    return NO_ROOM;
  }
  p.equip[slot] = item;
  if (conflict) {
    p.equip[conflict.slot] = null;
    if (!autoPlace(p, conflict.it)) {
      restore(p, snap);
      return conflict.slot === "offhand" ? "No room to stow the off-hand" : "No room to stow the two-handed weapon";
    }
  }
  refreshStats(p, drop);
  return null;
}

/** Move an equipped item (or flask) into the grid: at (x, y) if given, else the first fit. */
export function unequip(p: ServerPlayer, from: unknown, x: unknown, y: unknown, drop: DropFn): string | null {
  const fi = flaskIndex(from);
  const ci = charmIndex(from);
  const item = fi >= 0 ? p.flasks[fi] : ci >= 0 ? charms(p)[ci] : isSlot(from) ? p.equip[from] : undefined;
  if (item === undefined) return "Bad slot";
  if (!item) return "Empty slot";
  const at = x === undefined && y === undefined ? null : { x, y };
  if (at) {
    if (!isId(at.x) || !isId(at.y) || !placeAt(p, item, at.x, at.y)) return "Doesn't fit there";
  } else if (!autoPlace(p, item)) return NO_ROOM;
  if (fi >= 0) {
    p.flasks[fi] = null;
    p.invDirty = true;
  } else if (ci >= 0) {
    charms(p)[ci] = null;
    p.invDirty = true;
  } else {
    p.equip[from as Slot] = null;
    refreshStats(p, drop);
  }
  return null;
}

/**
 * Move a grid item to (x, y). If the new spot overlaps exactly one other item, the two
 * swap: the other item goes to the moved item's old cells if it fits there, else the
 * first free spot.
 */
export function moveInGrid(p: ServerPlayer, id: unknown, x: unknown, y: unknown): string | null {
  if (!isId(id) || !isId(x) || !isId(y)) return "Bad move";
  const e = entryById(p.inv, id);
  if (!e) return "No such item";
  if (e.x === x && e.y === y) return null;
  const fp = footprint(e.it);
  if (!fits([], fp, x, y)) return "Doesn't fit there";
  const hit = overlapping(p.inv, fp, x, y, id);
  if (hit.length > 1) return "Doesn't fit there";
  // Dropping a stack onto a matching stack merges (the remainder stays where it was).
  if (hit.length === 1 && canStack(hit[0].it, e.it) && stackSize(hit[0].it) < stackMax(hit[0].it)) {
    const t = hit[0].it;
    const n = Math.min(stackMax(t) - stackSize(t), stackSize(e.it));
    setStack(t, stackSize(t) + n);
    if (stackSize(e.it) - n <= 0) removeEntry(p, e);
    else setStack(e.it, stackSize(e.it) - n);
    p.invDirty = true;
    return null;
  }
  const old = { x: e.x, y: e.y };
  removeEntry(p, e);
  const other = hit[0];
  if (other) removeEntry(p, other);
  p.inv.push({ x, y, it: e.it });
  if (other && !placeNear(p, other.it, old.x, old.y)) {
    p.inv.pop();
    p.inv.push(e, other); // revert
    return NO_ROOM;
  }
  p.invDirty = true;
  return null;
}

/** Drop a grid item, an equipped item or a flask on the ground. */
export function dropById(p: ServerPlayer, id: unknown, drop: DropFn): string | null {
  if (!isId(id)) return "Bad item";
  const loc = locate(p, id);
  if (!loc) return "No such item";
  let item: Item;
  if (loc.k === "grid") {
    item = loc.e.it;
    removeEntry(p, loc.e);
  } else if (loc.k === "flask") {
    item = p.flasks[loc.i]!;
    p.flasks[loc.i] = null;
    p.invDirty = true;
  } else if (loc.k === "charm") {
    item = charms(p)[loc.i]!;
    charms(p)[loc.i] = null;
    p.invDirty = true;
  } else {
    item = p.equip[loc.s]!;
    p.equip[loc.s] = null;
    refreshStats(p, drop);
  }
  drop(item, p.x, p.y);
  return null;
}

/**
 * Split `n` off a grid stack into a new stack at (x, y) (else the first fit). `newId` mints the
 * new item's id (server/loot.ts owns the id counter).
 */
export function splitStack(p: ServerPlayer, id: unknown, n: unknown, x: unknown, y: unknown, newId: () => number): string | null {
  if (!isId(id) || !isId(n)) return "Bad split";
  const e = entryById(p.inv, id);
  if (!e) return "No such item";
  const have = stackSize(e.it);
  if (n < 1 || n >= have) return "Can't split that";
  const part: Item = { ...e.it, id: newId(), m: e.it.m.slice() };
  setStack(part, n);
  const at = x !== undefined || y !== undefined;
  const placed = at ? isId(x) && isId(y) && placeAt(p, part, x, y) : placeFirstFit(p, part);
  if (!placed) return at ? "Doesn't fit there" : NO_ROOM;
  setStack(e.it, have - n);
  p.invDirty = true;
  return null;
}

/** Consume one from a grid stack (crafting). Returns false if the item isn't in the grid. */
export function consumeOne(p: ServerPlayer, id: number): boolean {
  const e = entryById(p.inv, id);
  if (!e) return false;
  const n = stackSize(e.it);
  if (n > 1) setStack(e.it, n - 1);
  else removeEntry(p, e);
  p.invDirty = true;
  return true;
}

/** Find a carried item (grid, equipped, flask or charm slot) by id, e.g. a crafting target. */
export function carriedItem(p: ServerPlayer, id: unknown): Item | null {
  if (!isId(id)) return null;
  const loc = locate(p, id);
  if (!loc) return null;
  if (loc.k === "grid") return loc.e.it;
  if (loc.k === "slot") return p.equip[loc.s];
  if (loc.k === "flask") return p.flasks[loc.i];
  return charms(p)[loc.i];
}

/** Swap the active weapon set with the inactive one (PoE2-style weapon sets I / II). */
export function swapWeaponSets(p: ServerPlayer, drop: DropFn): string | null {
  p.alt ??= { mainhand: null, offhand: null };
  const { mainhand, offhand } = p.equip;
  p.equip.mainhand = p.alt.mainhand;
  p.equip.offhand = p.alt.offhand;
  p.alt = { mainhand, offhand };
  p.weaponSet = p.weaponSet === 1 ? 0 : 1;
  refreshStats(p, drop);
  return null;
}

export function invMessage(p: ServerPlayer): InvMsg {
  return { t: "inv", equip: p.equip, inv: p.inv, flasks: p.flasks, charms: charms(p), alt: p.alt, set: p.weaponSet ?? 0 };
}

export type { EquipTarget };
