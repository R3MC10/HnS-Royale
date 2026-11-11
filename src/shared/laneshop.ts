// Breachway Quartermaster: gold services on your own items ("Enhance") and crowdfunded wave units
// ("Reinforcements"). Prices and eligibility shared by the server (server/modes/lanes.ts, authoritative)
// and the vendor window (client/lanehud.ts). Eligibility reuses the crafting preview rules
// (shared/crafttarget.ts), so the shop refuses exactly what the matching Ember would refuse.
import { craftTargetOk } from "./crafttarget";
import { BASE_BY_ID } from "./content/bases";
import { GEM_SOCKET_MAX, MAX_QUALITY } from "./content/currency";
import { RUNES, socketLimit } from "./content/runes";
import { UNIQUES } from "./content/uniques";
import { qualityTargetOf } from "./craftrules";
import type { Item } from "./items";

/** Prices rise 4% per wave (a wave every ~25 s: x1.6 at 15 waves, x2.5 near the 15-20 min mark). */
export const laneInflation = (wave: number) => 1 + 0.04 * Math.max(0, wave);

export const ENHANCE_KINDS = ["forge", "quality", "socket", "rune", "chaos", "divine", "reforge", "gemsocket", "unique", "corrupt"] as const;
export type EnhanceKind = (typeof ENHANCE_KINDS)[number];

/** Mods counted for pricing (uniques are refused anyway). */
const modCount = (it: Item) => it.m.length;

/** Base (wave-0) price of a service on this item. */
function basePrice(k: EnhanceKind, it: Item): number {
  const l = Math.max(1, it.l ?? 1);
  switch (k) {
    case "forge": return 40 + 35 * modCount(it) + 2 * l;
    case "quality": return 30 + 15 * Math.floor((it.q ?? 0) / 5);
    case "socket": return 60 * ((it.s?.length ?? 0) + 1);
    case "rune": return 40;
    case "chaos": return 50 + 3 * l;
    case "divine": return 60 + 3 * l;
    case "reforge": return 120 + 5 * l;
    case "gemsocket": return 80 + 60 * Math.max(0, (it.gs ?? 1) - 1);
    case "unique": return 600 + 20 * l;
    case "corrupt": return 80;
  }
}

export function enhancePrice(k: EnhanceKind, it: Item, wave: number, runeId?: string): number {
  let p = basePrice(k, it);
  if (k === "rune" && runeId) {
    const r = RUNES.find((q) => q.id === runeId);
    p = r?.core ? 160 : (r?.minIlvl ?? 1) >= 10 ? 110 : (r?.minIlvl ?? 1) >= 4 ? 60 : 40;
  }
  return Math.round(p * laneInflation(wave));
}

const cur = (b: string): Item => ({ id: -7, b, r: 0, l: 1, n: "", m: [] });
const ok = (b: string, it: Item) => craftTargetOk(cur(b), it) === true;

/** Which Ember a forge step uses: Normal -> Magic, Magic (room) +1, Magic (full) -> Rare, Rare (room) +1. */
export function forgeStep(it: Item): string | null {
  if (it.r === 0 && ok("cur_kindling", it)) return "cur_kindling";
  if (it.r === 1) {
    if (ok("cur_stoking", it)) return "cur_stoking";
    if (ok("cur_crowning", it)) return "cur_crowning";
  }
  if (it.r === 2 && ok("cur_blazing", it)) return "cur_blazing";
  return null;
}

/** Quality Ember for this item (by class), or null. */
export function qualityCur(it: Item): string | null {
  const q = qualityTargetOf(it);
  return q ? { martial: "cur_honing", caster: "cur_inscribing", armour: "cur_riveting", flask: "cur_glazing", gem: "cur_polish" }[q] : null;
}

/** Uniques that share this item's base. */
export const uniquesFor = (it: Item) => UNIQUES.filter((u) => u.base === it.b);

/** Runes that fit this item's sockets (by item level). */
export const runesFor = (it: Item) => RUNES.filter((r) => r.minIlvl <= Math.max(1, it.l ?? 1));

/** null = the service applies; otherwise a short reason (English; the client translates). */
export function enhanceBlock(k: EnhanceKind, it: Item): string | null {
  if (it.x && k !== "gemsocket") return "Corrupted items can't be changed";
  const gear = BASE_BY_ID.has(it.b);
  switch (k) {
    case "forge":
      if (it.r === 3) return "Uniques can't take more modifiers";
      return forgeStep(it) ? null : it.r === 2 ? "No room for another modifier" : "This item can't take modifiers";
    case "quality": {
      const c = qualityCur(it);
      if (!c) return "This item can't take quality";
      return (it.q ?? 0) >= MAX_QUALITY ? `Already at ${MAX_QUALITY}% quality` : null;
    }
    case "socket": {
      const lim = socketLimit(BASE_BY_ID.get(it.b));
      if (lim <= 0) return "Only martial weapons and armour take sockets";
      return (it.s?.length ?? 0) >= lim ? "Socket limit reached" : null;
    }
    case "rune":
      if (!it.s?.length) return "No sockets: add one first";
      return it.s.includes(null) ? null : "No empty socket";
    case "chaos":
      return ok("cur_shifting", it) ? null : "Needs a Rare item";
    case "divine":
      return ok("cur_tempering", it) ? null : "No modifiers to reroll";
    case "reforge":
      if (!gear || it.r === 3) return "Needs a piece of gear (not unique)";
      return it.r === 0 && !ok("cur_forgeheart", it) ? "This item can't become Rare" : null;
    case "gemsocket":
      if (!ok("cur_awl", it)) return (it.gs ?? 0) >= GEM_SOCKET_MAX ? `Already has ${GEM_SOCKET_MAX} support sockets` : "Only skill gems take support sockets";
      return null;
    case "unique":
      if (it.r === 3) return "Already unique";
      return uniquesFor(it).length ? null : "No unique exists on this base";
    case "corrupt":
      return ok("cur_blighted", it) ? null : "This item can't be corrupted";
  }
}

// ---- Reinforcements (crowdfunded wave units) ------------------------------------------------------

export const REINF_KINDS = ["brute", "archer", "champion"] as const;
export type ReinfKind = (typeof REINF_KINDS)[number];
/** Wave-0 price per unit; one pot per team per unit. */
export const REINF_BASE: Record<ReinfKind, number> = { brute: 150, archer: 180, champion: 450 };
/** Purchased units joining any one wave, per team. */
export const REINF_CAP = 3;
export const reinfPrice = (k: ReinfKind, wave: number) => Math.round(REINF_BASE[k] * laneInflation(wave));
export const REINF_NAME: Record<ReinfKind, string> = { brute: "Brute", archer: "Archer", champion: "Champion" };
