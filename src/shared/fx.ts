// Special-effect totals (FxKeys) over a player's equipment. Server combat reads these through
// server/uniques.ts; the client can show them. See content/fx.ts for the vocabulary.
import { setCharmSlotBonus } from "./content/charms";
import { FX_KEYS, type FxKey } from "./content/fx";
import { itemAllTotals } from "./content/specialmods";
import { SLOTS } from "./content/types";
import type { Equipment } from "./items";

export type FxTotals = Record<FxKey, number>;

export function emptyFx(): FxTotals {
  return Object.fromEntries(FX_KEYS.map((k) => [k, 0])) as FxTotals;
}

export function computeFx(equip: Equipment): FxTotals {
  const out = emptyFx();
  for (const s of SLOTS) {
    const it = equip[s];
    if (!it) continue;
    for (const [k, v] of Object.entries(itemAllTotals(it))) if (k in out) out[k as FxKey] += v as number;
  }
  return out;
}

setCharmSlotBonus((equip) => computeFx(equip).charmSlots);
