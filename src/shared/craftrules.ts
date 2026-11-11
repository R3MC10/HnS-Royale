// Shared PoE2 crafting rules used by both the server (server/crafting.ts, authoritative) and the
// client target preview (shared/crafttarget.ts): which quality currency fits which item, how much
// quality one use adds, and the greater / perfect "minimum modifier level" filter.
import { BASE_BY_ID } from "./content/bases";
import { CHARM_BY_ID } from "./content/charms";
import { CASTER_WEAPON_KINDS, MAX_QUALITY, QUALITY_BY_RARITY, QUALITY_STEP, type QualityTarget } from "./content/currency";
import { FLASK_BASE_BY_ID } from "./content/flasks";
import { SKILL_GEM_PREFIX } from "./content/gems";
import type { Item } from "./items";

/** Which quality currency an item takes (null = none: jewellery, belts, quivers, jewels...). */
export function qualityTargetOf(item: Item): QualityTarget | null {
  const base = BASE_BY_ID.get(item.b);
  if (base) {
    if (base.weapon) return CASTER_WEAPON_KINDS.has(base.weapon.kind) ? "caster" : "martial";
    if (base.cls === "offhand") return base.sub === "quiver" ? null : "armour";
    if (base.cls === "helmet" || base.cls === "body" || base.cls === "gloves" || base.cls === "boots") return "armour";
    return null;
  }
  if (FLASK_BASE_BY_ID.has(item.b) || CHARM_BY_ID.has(item.b)) return "flask";
  // PoE2: skill gems take quality, support gems don't.
  if (item.b.startsWith(SKILL_GEM_PREFIX)) return "gem";
  return null;
}

/** Quality one use adds (PoE2: 5 on Normal, 2 on Magic, 1 on Rare / Unique; gems always 5). */
export function qualityStep(item: Item, target: QualityTarget): number {
  if (target === "gem") return QUALITY_STEP;
  return QUALITY_BY_RARITY[item.r] ?? 1;
}

/** null = the quality currency applies; otherwise why not. */
export function qualityRefusal(item: Item, target: QualityTarget): string | null {
  const t = qualityTargetOf(item);
  if (t !== target) return QUALITY_WRONG[target];
  if ((item.q ?? 0) >= MAX_QUALITY) return `Already at ${MAX_QUALITY}% quality`;
  return null;
}

const QUALITY_WRONG: Record<QualityTarget, string> = {
  martial: "Only martial weapons take this (wands, staves and sceptres need an Inscribing Ember)",
  caster: "Only wands, staves and sceptres take this",
  armour: "Only armour pieces take this (helmet, body, gloves, boots, shield or focus)",
  flask: "Only flasks and charms take this",
  gem: "Only skill gems take this",
};

/** Tiers of an affix that roll under a greater / perfect currency at this item level. */
export function eligibleTierIdx(tiers: readonly { ilvl: number }[], ilvl: number, minModLevel = 0): number[] {
  const out: number[] = [];
  tiers.forEach((t, i) => {
    if (t.ilvl <= ilvl && t.ilvl >= minModLevel) out.push(i);
  });
  return out;
}
