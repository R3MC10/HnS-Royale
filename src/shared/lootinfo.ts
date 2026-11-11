// Display + shared math for the loot agent's item families (currency, runes, ichors, charms, jewels,
// uniques, quality, sockets, corruption). Imported by items.ts (tooltips) and the server; must not
// import items.ts at runtime.
import { AFFIX_BY_ID, MOD_LABELS } from "./content/affixes";
import { BASE_BY_ID } from "./content/bases";
import { CHARM_AFFIX_BY_ID, CHARM_BY_ID, CHARM_COLOR, TRIGGER_TEXT, type CharmModKey } from "./content/charms";
import { CURRENCY_BY_ID, CURRENCY_COLOR, stackMax, stackSize } from "./content/currency";
import { ESSENCE_BY_ID, ESSENCE_COLOR, essenceTier } from "./content/essences";
import { FX_LABELS, isFxKey, type FxKey } from "./content/fx";
import { JEWEL_BASE_BY_ID, jewelRadiusName } from "./content/jewels";
import { RUNE_BY_ID, runeModFor, socketLimit, type RuneMod } from "./content/runes";
import { UNIQUE_BY_ID, uniqueModLine } from "./content/uniques";
import type { ModKey } from "./content/types";
import type { Item } from "./items";

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function keyText(key: ModKey | FxKey, v: number): string {
  const label = isFxKey(key) ? FX_LABELS[key] : MOD_LABELS[key];
  return (label ?? "?").replace("{v}", fmt(v));
}

export const runeModText = (m: RuneMod) => keyText(m[0], m[1]);

// ---- charms --------------------------------------------------------------------------

export interface CharmProps {
  maxCharges: number;
  cost: number;
  duration: number;
  gainMult: number;
  /** Flat life / mana recovered when it triggers (charm mods). */
  lifeOnUse: number;
  manaOnUse: number;
  /** Chance (0..1) not to consume charges. */
  noConsume: number;
}

function charmMod(item: Item, key: CharmModKey): number {
  let v = 0;
  for (const m of item.m) {
    if (CHARM_AFFIX_BY_ID.get(m.a)?.key === key) v += m.v;
    else {
      const u = uniqueModLine(m.a); // unique charm lines
      if (u && u.u.mods[u.i][0] === key) v += m.v;
    }
  }
  return v;
}

export function charmProps(item: Item): CharmProps | null {
  const d = CHARM_BY_ID.get(item.b);
  if (!d) return null;
  return {
    maxCharges: d.maxCharges + charmMod(item, "cMaxCharges"),
    cost: Math.max(1, Math.round(d.cost * (1 - charmMod(item, "cCostRed") / 100))),
    duration: d.duration * (1 + (charmMod(item, "cDuration") + (item.q ?? 0)) / 100),
    gainMult: 1 + charmMod(item, "cGain") / 100,
    lifeOnUse: charmMod(item, "cLifeOnUse"),
    manaOnUse: charmMod(item, "cManaOnUse"),
    noConsume: Math.min(0.9, Math.max(0, charmMod(item, "cNoConsume") / 100)),
  };
}

// ---- tooltip pieces --------------------------------------------------------------------

const APPLY_HINT = "Right-click, then left-click an item to apply (Shift keeps it ready)";

/** Extra base-type lines for loot-agent items (and quality / sockets on gear). */
export function lootBaseLines(item: Item): string[] {
  const out: string[] = [];
  const stack = stackMax(item) > 1 ? [`Stack: ${stackSize(item)} / ${stackMax(item)}`] : [];
  const cur = CURRENCY_BY_ID.get(item.b);
  if (cur) return [cur.desc, ...stack, APPLY_HINT];
  const rune = RUNE_BY_ID.get(item.b);
  if (rune) {
    // PoE2 socketables: one line for martial weapons, one for armour, and per-slot lines on heartstones.
    const lines = [`Martial weapon: ${runeModText(rune.weapon)}`, `Armour: ${runeModText(rune.armour)}`];
    const SLOT_NAME: Record<string, string> = { helmet: "Helmet", body: "Body armour", gloves: "Gloves", boots: "Boots", offhand: "Shield / focus" };
    for (const [cls, m] of Object.entries(rune.slots ?? {})) if (m) lines.push(`${SLOT_NAME[cls] ?? cls}: ${runeModText(m)}`);
    if (rune.core) lines.unshift("Heartstone");
    return [...lines, ...stack, APPLY_HINT + " with a socket (replaces the first rune when all are full)"];
  }
  const ess = ESSENCE_BY_ID.get(item.b);
  if (ess) {
    const a = AFFIX_BY_ID.get(ess.affix);
    const what = a ? MOD_LABELS[a.key].replace("{v}", "#").replace("+#", "#") : ess.affix;
    const t = a ? a.tiers[essenceTier(ess.grade, a.tiers.length)] : undefined;
    const range = t ? ` (${fmt(t.min)}-${fmt(t.max)}, ${t.name})` : "";
    return [
      ess.grade === 3
        ? "Removes a random modifier from a Rare item and adds a guaranteed modifier:"
        : "Upgrades a Magic item to Rare with a guaranteed modifier:",
      `  ${what}${range}`,
      ...stack,
      APPLY_HINT,
    ];
  }
  const ch = CHARM_BY_ID.get(item.b);
  if (ch) {
    const p = charmProps(item)!;
    out.push(`Triggers ${TRIGGER_TEXT[ch.trigger]}`);
    out.push(ch.duration > 0 ? `${ch.desc} for ${p.duration.toFixed(1)}s` : ch.desc);
    out.push(`Consumes ${p.cost} of ${p.maxCharges} Charges · charged by kills`);
    out.push(`Currently has ${Math.floor(item.c ?? 0)} Charges`);
    out.push(...uniqueEffectLines(item));
    if (item.q) out.push(`Quality: +${item.q}% (duration)`);
    out.push("Goes in a charm slot (the belt decides how many)");
    return out;
  }
  const jb = JEWEL_BASE_BY_ID.get(item.b);
  if (jb) {
    const lines = [jb.desc ?? "Place into a jewel socket on the passive tree"];
    if (jb.radius) lines.push(`Radius: ${jewelRadiusName(jb.radius)}`);
    lines.push("Ctrl+click or right-click to socket it (needs an allocated Jewel Socket on the passive tree)");
    return lines;
  }

  const base = BASE_BY_ID.get(item.b);
  out.push(...uniqueEffectLines(item)); // unique flasks
  if (item.q) out.push(`Quality: +${item.q}%${base?.weapon ? " (base damage)" : base ? " (base defences)" : " (recovery)"}`);
  if (item.s?.length) {
    const parts = item.s.map((rid) => {
      const r = rid ? RUNE_BY_ID.get(rid) : undefined;
      if (!r || !base) return "[empty socket]";
      const m = runeModFor(r, base.cls);
      return m ? `[${r.name}: ${runeModText(m)}]` : `[${r.name}]`;
    });
    out.push(`Sockets: ${parts.join(" ")}`);
  } else if (base && socketLimit(base) > 0 && !item.x) {
    out.push(`Sockets: none (a Boring Ember adds up to ${socketLimit(base)})`);
  }
  return out;
}

/** Extra effects of unique flasks / charms (content/uniques.ts flaskBuff / charmBuff). */
function uniqueEffectLines(item: Item): string[] {
  const u = item.u ? UNIQUE_BY_ID.get(item.u) : undefined;
  if (!u) return [];
  const out: string[] = [];
  if (u.flaskBuff) out.push(`During effect: ${u.flaskBuff.fx.map(([k, v]) => keyText(k, v)).join(", ")}`);
  if (u.charmBuff) out.push(`While active: ${u.charmBuff.map(([k, v]) => keyText(k, v)).join(", ")}`);
  return out;
}

/** Lines shown after the modifiers: unique flavour text and corruption. */
export function lootFooterLines(item: Item): { text: string; cls: "flavour" | "corrupt" }[] {
  const out: { text: string; cls: "flavour" | "corrupt" }[] = [];
  const u = item.u ? UNIQUE_BY_ID.get(item.u) : undefined;
  if (u) out.push({ text: u.flavour, cls: "flavour" });
  if (item.x) {
    out.push({ text: "Corrupted", cls: "corrupt" });
    out.push({ text: "Can't be modified further (runes still fit its sockets)", cls: "corrupt" });
  }
  return out;
}

export function lootBaseName(item: Item): string | undefined {
  return (
    CURRENCY_BY_ID.get(item.b)?.name ??
    RUNE_BY_ID.get(item.b)?.name ??
    ESSENCE_BY_ID.get(item.b)?.name ??
    CHARM_BY_ID.get(item.b)?.name ??
    JEWEL_BASE_BY_ID.get(item.b)?.name
  );
}

export function lootClassLabel(item: Item): string | undefined {
  if (CURRENCY_BY_ID.has(item.b)) return "currency";
  if (RUNE_BY_ID.has(item.b)) return "rune";
  if (ESSENCE_BY_ID.has(item.b)) return "ichor";
  if (CHARM_BY_ID.has(item.b)) return "charm";
  if (JEWEL_BASE_BY_ID.has(item.b)) return "jewel";
  return undefined;
}

/** Label colour by family (falls back to the rarity colour). */
export function lootColor(item: Item): string | undefined {
  if (CURRENCY_BY_ID.has(item.b)) return CURRENCY_COLOR;
  if (RUNE_BY_ID.has(item.b)) return "#9fb8c8";
  if (ESSENCE_BY_ID.has(item.b)) return ESSENCE_COLOR;
  if (CHARM_BY_ID.has(item.b) && item.r === 0) return CHARM_COLOR;
  return undefined;
}

/** Items applied onto another item (right-click, then click the target): Embers, runes, ichors. */
export function isCraftItem(it: Item): boolean {
  return it.b.startsWith("cur_") || it.b.startsWith("rune_") || it.b.startsWith("ess_");
}
