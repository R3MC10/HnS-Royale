// Lookup for modifier ids that are not regular gear affixes: unique lines (u_*), jewel affixes (j_*),
// charm affixes (c_*) and blighted (corruption) implicits (x_*). items.ts uses this for tooltips
// and stat totals; shared/fx.ts for special effects.
import type { Item } from "../items";
import { AFFIX_BY_ID, MOD_LABELS } from "./affixes";
import { BASE_BY_ID } from "./bases";
import { RUNE_BY_ID, runeModFor } from "./runes";
import { CHARM_AFFIX_BY_ID, CHARM_MOD_LABELS } from "./charms";
import { FX_LABELS, isFxKey, type FxKey } from "./fx";
import { FLASK_MOD_LABELS } from "./flasks";
import { JEWEL_AFFIX_BY_ID, jewelPerText } from "./jewels";
import { uniqueModLine } from "./uniques";
import type { ModKey } from "./types";

/** Blighted implicits (one may be added by a Blighted Ember). */
export const CORRUPT_IMPLICITS: { id: string; key: ModKey | FxKey; min: number; max: number; decimals?: number }[] = [
  { id: "x_life", key: "life", min: 10, max: 20 },
  { id: "x_move", key: "moveInc", min: 3, max: 6 },
  { id: "x_flat", key: "dmgFlat", min: 2, max: 4 },
  { id: "x_aspd", key: "atkSpeedInc", min: 4, max: 8 },
  { id: "x_dodge", key: "dodgeCdRed", min: 5, max: 10 },
  { id: "x_red", key: "dmgTakenRed", min: 3, max: 5 },
  { id: "x_leech", key: "leech", min: 1, max: 2, decimals: 1 },
  { id: "x_reach", key: "reach", min: 5, max: 10 },
  { id: "x_pvp", key: "pvpMore", min: 5, max: 8 },
  // Loot find (server/loot.ts): the only source of item quantity on gear, as in PoE2 (none on explicits).
  { id: "x_rarity", key: "rarityInc", min: 8, max: 14 },
  { id: "x_quant", key: "quantInc", min: 3, max: 6 },
];
export const CORRUPT_IMPLICIT_BY_ID = new Map(CORRUPT_IMPLICITS.map((c) => [c.id, c]));

export interface SpecialModInfo {
  key: ModKey | FxKey | string;
  /** Label with {v}; null = use MOD_LABELS (key is a ModKey). */
  label: string | null;
  implicit?: boolean; // corruption implicit (shown above explicit mods)
}

/** Info for a non-affix mod id, or undefined. */
export function specialModInfo(id: string): SpecialModInfo | undefined {
  const u = uniqueModLine(id);
  if (u) {
    const key = u.u.mods[u.i][0];
    const per = u.u.radiusLines?.[u.i];
    return per ? perInfo(key as ModKey | FxKey, per) : keyInfo(key);
  }
  const j = JEWEL_AFFIX_BY_ID.get(id);
  if (j) return j.per ? perInfo(j.key, j.per) : keyInfo(j.key);
  const c = CHARM_AFFIX_BY_ID.get(id);
  if (c) return { key: c.key, label: CHARM_MOD_LABELS[c.key] };
  const x = CORRUPT_IMPLICIT_BY_ID.get(id);
  if (x) return { ...keyInfo(x.key), implicit: true };
  return undefined;
}

function keyInfo(key: string): SpecialModInfo {
  if (isFxKey(key)) return { key, label: FX_LABELS[key] };
  if (key in FLASK_MOD_LABELS) return { key, label: FLASK_MOD_LABELS[key as keyof typeof FLASK_MOD_LABELS] }; // unique flasks
  if (key in CHARM_MOD_LABELS) return { key, label: CHARM_MOD_LABELS[key as keyof typeof CHARM_MOD_LABELS] }; // unique charms
  return { key, label: null };
}

/** Radius-jewel line: "Allocated ... Passives in Radius also grant <label>". */
function perInfo(key: ModKey | FxKey, per: "small" | "notable"): SpecialModInfo {
  const base = isFxKey(key) ? FX_LABELS[key] : MOD_LABELS[key as ModKey];
  return { key, label: jewelPerText(per) + (base ?? key) };
}

/** Flask / charm keys only mean something on the flask or charm itself (not as gear stats). */
const isItemLocalKey = (k: string) => k in FLASK_MOD_LABELS || k in CHARM_MOD_LABELS;

// ---- totals over every mod source on one item -----------------------------------------

/**
 * Implicit (scaled by quality for non-weapons) + rolled affixes + unique/jewel/blighted lines +
 * socketed runes. Keys are ModKeys (Stats) and FxKeys (special effects).
 */
export function itemAllTotals(item: Item): Partial<Record<ModKey | FxKey, number>> {
  const out: Partial<Record<ModKey | FxKey, number>> = {};
  const add = (k: ModKey | FxKey, v: number) => (out[k] = (out[k] ?? 0) + v);
  const base = BASE_BY_ID.get(item.b);
  const q = !base?.weapon ? (item.q ?? 0) : 0; // weapon quality scales base damage instead (items.ts)
  if (base?.implicit) {
    for (const [k, v] of Object.entries(base.implicit)) {
      const val = v as number;
      add(k as ModKey, q > 0 && val > 0 ? Math.round(val * (1 + q / 100) * 10) / 10 : val);
    }
  }
  for (const mod of item.m) {
    const a = AFFIX_BY_ID.get(mod.a);
    if (a) {
      add(a.key, mod.v);
      if (a.key2 && mod.v2 !== undefined) add(a.key2, mod.v2); // hybrid mods carry a second stat
      continue;
    }
    const sp = specialModInfo(mod.a);
    if (sp && !CHARM_AFFIX_BY_ID.has(mod.a) && !isItemLocalKey(sp.key)) add(sp.key as ModKey | FxKey, mod.v);
  }
  if (item.s && base) {
    for (const rid of item.s) {
      const r = rid ? RUNE_BY_ID.get(rid) : undefined;
      const rm = r ? runeModFor(r, base.cls) : null;
      if (rm) add(rm[0], rm[1]);
    }
  }
  return out;
}
