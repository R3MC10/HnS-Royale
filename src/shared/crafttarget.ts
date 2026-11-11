// Client-side preview of "can this currency / rune / ichor be applied to that item?", used by the
// inventory to highlight valid targets while a currency is held (PoE2: right-click a currency, then
// valid items light up and invalid ones dim). The server (server/crafting.ts) stays authoritative;
// this only mirrors its cheap rejection rules. Unknown currency effects answer `null` ("can't tell"),
// so new currencies added elsewhere never get wrongly dimmed. Other areas can register exact checks
// through `craftTargetHooks`.
import { AFFIX_BY_ID, affixAllowed } from "./content/affixes";
import { BASE_BY_ID } from "./content/bases";
import { CHARM_AFFIX_BY_ID, CHARM_BY_ID } from "./content/charms";
import { CURRENCY_BY_ID, GEM_SOCKET_MAX } from "./content/currency";
import { UNIQUES } from "./content/uniques";
import { qualityRefusal } from "./craftrules";
import { ESSENCE_BY_ID } from "./content/essences";
import { FLASK_AFFIX_BY_ID, FLASK_BASE_BY_ID } from "./content/flasks";
import { JEWEL_AFFIX_BY_ID, JEWEL_BASE_BY_ID, JEWEL_MAX_PER_KIND } from "./content/jewels";
import { RUNE_BY_ID, socketLimit } from "./content/runes";
import { isSkillGem, socketCount } from "./skills";
import type { Item } from "./items";

/** Extra checks: return true / false to decide, undefined to defer to the built-in rules. */
export type CraftTargetHook = (cur: Item, target: Item) => boolean | undefined;
export const craftTargetHooks: CraftTargetHook[] = [];

/** Affix kind of a rolled mod on any craftable family (null = not a regular prefix/suffix). */
function modKind(id: string): "prefix" | "suffix" | null {
  return AFFIX_BY_ID.get(id)?.kind ?? FLASK_AFFIX_BY_ID.get(id)?.kind ?? CHARM_AFFIX_BY_ID.get(id)?.kind ?? JEWEL_AFFIX_BY_ID.get(id)?.kind ?? null;
}

/** Can the item take one more prefix or suffix at its rarity? */
function hasRoom(it: Item): boolean {
  let p = 0;
  let s = 0;
  for (const m of it.m) {
    const k = modKind(m.a);
    if (k === "prefix") p++;
    else if (k === "suffix") s++;
  }
  const magicOnly = FLASK_BASE_BY_ID.has(it.b) || CHARM_BY_ID.has(it.b);
  const cap = it.r === 1 || magicOnly ? 1 : JEWEL_BASE_BY_ID.has(it.b) ? JEWEL_MAX_PER_KIND : 3;
  return p < cap || s < cap;
}

const craftable = (it: Item) => BASE_BY_ID.has(it.b) || FLASK_BASE_BY_ID.has(it.b) || CHARM_BY_ID.has(it.b) || JEWEL_BASE_BY_ID.has(it.b);
const canBeRare = (it: Item) => BASE_BY_ID.has(it.b) || JEWEL_BASE_BY_ID.has(it.b);

/**
 * true = the currency will (very likely) do something to `target`; false = the server would refuse;
 * null = unknown currency kind.
 */
export function craftTargetOk(cur: Item, target: Item): boolean | null {
  if (cur.id === target.id) return false;
  for (const h of craftTargetHooks) {
    const v = h(cur, target);
    if (v !== undefined) return v;
  }
  const rune = RUNE_BY_ID.get(cur.b);
  if (rune) {
    const base = BASE_BY_ID.get(target.b);
    return !!base && socketLimit(base) > 0 && !!target.s?.length;
  }
  const ess = ESSENCE_BY_ID.get(cur.b);
  if (ess) {
    const base = BASE_BY_ID.get(target.b);
    const a = AFFIX_BY_ID.get(ess.affix);
    // PoE2: faint / plain / potent ichors need a Magic item, primeval ones a Rare.
    if (!base || target.x || target.r !== (ess.grade === 3 ? 2 : 1)) return false;
    return !!a && affixAllowed(a, base) && !target.m.some((m) => m.a === a.id);
  }
  const c = CURRENCY_BY_ID.get(cur.b);
  if (!c) return null;
  const eff = c.effect as string;
  if (eff === "gemsocket") return isSkillGem(target) && !target.x && socketCount(target) < GEM_SOCKET_MAX;
  if (target.x) return false; // corrupted: no further crafting
  const unique = target.r === 3;
  switch (eff) {
    case "quality":
      return qualityRefusal(target, c.quality ?? "martial") === null;
    case "chance":
      return target.r === 0 && BASE_BY_ID.has(target.b) && UNIQUES.some((u) => u.base === target.b); // server: gear only
    case "socket": {
      const lim = socketLimit(BASE_BY_ID.get(target.b));
      return lim > 0 && (target.s?.length ?? 0) < lim;
    }
    case "corrupt":
      return BASE_BY_ID.has(target.b) || JEWEL_BASE_BY_ID.has(target.b);
    case "divine":
      return target.m.length > 0;
  }
  if (unique || !craftable(target)) return false;
  if (c.minModLevel && (target.l ?? 0) < c.minModLevel) return false; // greater / perfect: item level too low for any such mod
  switch (eff) {
    case "transmute":
      return target.r === 0;
    case "augment":
      return target.r === 1 && hasRoom(target);
    case "regal":
      return target.r === 1 && canBeRare(target);
    case "alch":
      return target.r === 0 && canBeRare(target);
    case "exalt":
      return target.r === 2 && hasRoom(target);
    case "chaos":
      return target.r === 2 && target.m.some((m) => modKind(m.a) !== null);
    case "annul":
      return (target.r === 1 || target.r === 2) && target.m.some((m) => modKind(m.a) !== null);
  }
  return null;
}
