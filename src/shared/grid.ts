// Grid inventory model (shared by server and client): item footprints, placement
// checks and first-fit search. The server is authoritative; the client uses the
// same functions only to preview drops.
import { BASE_BY_ID } from "./content/bases";
import { FLASK_BASE_BY_ID } from "./content/flasks";
import type { ItemClass } from "./content/types";
import type { Item } from "./items";

export const GRID_W = 12;
export const GRID_H = 5;

export interface Footprint {
  w: number;
  h: number;
}

/** One item sitting in the grid; (x, y) is its top-left cell. */
export interface GridEntry {
  x: number;
  y: number;
  it: Item;
}

// ---- item categories (hook for new item families, e.g. gems) -----------------

/**
 * A family of items that is not a gear base or a flask (gems, currency, ...).
 * Register one from a module that both the server and the client import, e.g.
 *   registerItemKind({ category: "gem", matches: (it) => it.b.startsWith("gem_") });
 * Registered items live in the grid with the given footprint (default 1x1) and
 * are never equippable through the gear slots. Socketing is up to the owner.
 */
export interface ItemKindDef {
  category: string;
  matches: (item: Item) => boolean;
  footprint?: Footprint | ((item: Item) => Footprint);
}

const KINDS: ItemKindDef[] = [];

export function registerItemKind(def: ItemKindDef) {
  const i = KINDS.findIndex((k) => k.category === def.category);
  if (i >= 0) KINDS[i] = def;
  else KINDS.push(def);
}

function kindDefOf(item: Item): ItemKindDef | undefined {
  return KINDS.find((k) => k.matches(item));
}

/** "gear" | "flask" | a registered category (e.g. "gem") | "other". */
export function itemCategory(item: Item): string {
  if (FLASK_BASE_BY_ID.has(item.b)) return "flask";
  if (BASE_BY_ID.has(item.b)) return "gear";
  return kindDefOf(item)?.category ?? "other";
}

// ---- footprints ---------------------------------------------------------------

const CLASS_FOOTPRINT: Record<ItemClass, Footprint> = {
  weapon: { w: 2, h: 3 },
  offhand: { w: 2, h: 2 },
  helmet: { w: 2, h: 2 },
  body: { w: 2, h: 3 },
  gloves: { w: 2, h: 2 },
  boots: { w: 2, h: 2 },
  amulet: { w: 1, h: 1 },
  ring: { w: 1, h: 1 },
  belt: { w: 2, h: 1 },
  flask: { w: 1, h: 2 },
};

/** One-handers 1x3 / 2x3 (spears 1x4), two-handers 2x4. */
const WEAPON_FOOTPRINT: Record<string, Footprint | undefined> = {
  sword: { w: 2, h: 3 },
  axe: { w: 2, h: 3 },
  dagger: { w: 1, h: 3 },
  spear: { w: 1, h: 4 },
  bow: { w: 2, h: 4 },
  staff: { w: 2, h: 4 },
};

export function footprint(item: Item): Footprint {
  if (FLASK_BASE_BY_ID.has(item.b)) return CLASS_FOOTPRINT.flask;
  const base = BASE_BY_ID.get(item.b);
  if (base) {
    if (base.size) return { w: base.size[0], h: base.size[1] };
    if (base.weapon) return WEAPON_FOOTPRINT[base.weapon.kind] ?? CLASS_FOOTPRINT.weapon;
    return CLASS_FOOTPRINT[base.cls];
  }
  const fp = kindDefOf(item)?.footprint;
  if (fp) return typeof fp === "function" ? fp(item) : fp;
  return { w: 1, h: 1 };
}

// ---- placement ------------------------------------------------------------------

export function inBounds(fp: Footprint, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x + fp.w <= GRID_W && y + fp.h <= GRID_H;
}

const rectsOverlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;

/** Entries that a footprint at (x, y) would overlap (ignoring the item with id `ignoreId`). */
export function overlapping(entries: GridEntry[], fp: Footprint, x: number, y: number, ignoreId = -1): GridEntry[] {
  const out: GridEntry[] = [];
  for (const e of entries) {
    if (e.it.id === ignoreId) continue;
    const f = footprint(e.it);
    if (rectsOverlap(x, y, fp.w, fp.h, e.x, e.y, f.w, f.h)) out.push(e);
  }
  return out;
}

export function fits(entries: GridEntry[], fp: Footprint, x: number, y: number, ignoreId = -1): boolean {
  return inBounds(fp, x, y) && overlapping(entries, fp, x, y, ignoreId).length === 0;
}

/** First free spot, scanning columns left to right and each column top to bottom. */
export function findFree(entries: GridEntry[], fp: Footprint): { x: number; y: number } | null {
  for (let x = 0; x + fp.w <= GRID_W; x++) {
    for (let y = 0; y + fp.h <= GRID_H; y++) {
      if (overlapping(entries, fp, x, y).length === 0) return { x, y };
    }
  }
  return null;
}

/** Item id -> entry, or undefined. */
export function entryById(entries: GridEntry[], id: number): GridEntry | undefined {
  return entries.find((e) => e.it.id === id);
}
