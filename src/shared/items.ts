// Item model + stat computation, shared so the client can show tooltips and
// stat comparisons with exactly the server's math. Item *generation* (randomness)
// is server-only (src/server/loot.ts).
import { AFFIX_BY_ID, MOD_LABELS } from "./content/affixes";
import { BASE_BY_ID, UNARMED } from "./content/bases";
import { FLASK_AFFIX_BY_ID, FLASK_BASE_BY_ID, FLASK_MOD_LABELS, INSTANT_PENALTY } from "./content/flasks";
import { uniqueModLine } from "./content/uniques";
import type { FlaskModKey, ItemBase, ItemClass, ModKey, Slot, WeaponProps } from "./content/types";
import { SLOTS } from "./content/types";
import { clampStats, defaultStats, type Stats } from "./stats";
import { BASE_MANA_REGEN, MANA_REGEN_PCT, PVP_FLASK_MULT } from "./constants";
import { itemAllTotals, specialModInfo } from "./content/specialmods";
import { FX_LABELS, isFxKey } from "./content/fx";
import { lootBaseLines, lootBaseName, lootClassLabel } from "./lootinfo";
import "./fx"; // registers the "+N Charm Slot" bonus for charmSlotsFor

export type Rarity = 0 | 1 | 2 | 3; // normal / magic / rare / unique

/** One rolled modifier: affix id, tier index, value. */
export interface ItemMod {
  a: string;
  t: number;
  v: number;
  /** Hybrid mods: rolled value of the second stat (Affix.key2). */
  v2?: number;
}

/** Wire + server representation of an item (also used for flasks). */
export interface Item {
  id: number;
  b: string; // base id (ItemBase or FlaskBase)
  r: Rarity;
  l: number; // item level
  n: string; // display name
  m: ItemMod[];
  c?: number; // flask / charm: current charges
  // ---- loot agent (crafting, uniques, sockets, stacks) ----
  q?: number; // quality % (0-20)
  s?: (string | null)[]; // rune sockets: rune base id or null (empty); length = socket count
  u?: string; // unique id (r = 3)
  x?: 1; // corrupted: no further crafting
  k?: number; // stack size (currency, runes, ichors); default 1. See content/currency.ts stackMax
  gs?: number; // skill gem: support sockets set by a Lapidary's Awl (absolute count, max 5)
}

export type Equipment = Record<Slot, Item | null>;

export function emptyEquipment(): Equipment {
  return Object.fromEntries(SLOTS.map((s) => [s, null])) as Equipment;
}

export function isFlask(item: Item): boolean {
  return FLASK_BASE_BY_ID.has(item.b);
}

export function itemClass(item: Item): ItemClass | null {
  if (isFlask(item)) return "flask";
  return BASE_BY_ID.get(item.b)?.cls ?? null;
}

export function itemBase(item: Item): ItemBase | undefined {
  return BASE_BY_ID.get(item.b);
}

const SLOT_CLASS: Record<Slot, ItemClass> = {
  mainhand: "weapon",
  offhand: "offhand",
  helmet: "helmet",
  body: "body",
  gloves: "gloves",
  boots: "boots",
  amulet: "amulet",
  ring1: "ring",
  ring2: "ring",
  belt: "belt",
};

export function slotAccepts(slot: Slot, item: Item): boolean {
  return itemClass(item) === SLOT_CLASS[slot];
}

/** Default slot for an item (rings: first empty ring slot, else ring1). */
export function defaultSlotFor(item: Item, equip: Equipment): Slot | null {
  const cls = itemClass(item);
  if (!cls || cls === "flask") return null;
  if (cls === "ring") return !equip.ring1 ? "ring1" : !equip.ring2 ? "ring2" : "ring1";
  return SLOTS.find((s) => SLOT_CLASS[s] === cls) ?? null;
}

/** Sum of implicit + rolled modifiers on one (non-flask) item. */
export function itemModTotals(item: Item): Partial<Record<ModKey, number>> {
  const out: Partial<Record<ModKey, number>> = {};
  // Implicits (quality-scaled), affixes, unique / blighted lines and socketed runes (content/specialmods.ts).
  for (const [k, v] of Object.entries(itemAllTotals(item))) if (!isFxKey(k)) out[k as ModKey] = v as number;
  return out;
}

/** Recompute a player's stats from scratch: defaults + weapon base + every modifier, clamped. */
export function computeStats(equip: Equipment, extra?: Partial<Record<ModKey, number>>): Stats {
  const s = defaultStats();
  const weaponBase = equip.mainhand ? BASE_BY_ID.get(equip.mainhand.b) : undefined;
  const w: WeaponProps = weaponBase?.weapon ?? UNARMED;

  const tot: Partial<Record<ModKey, number>> = {};
  for (const slot of SLOTS) {
    const it = equip[slot];
    if (!it) continue;
    for (const [k, v] of Object.entries(itemModTotals(it))) tot[k as ModKey] = (tot[k as ModKey] ?? 0) + (v as number);
  }
  // Non-equipment modifier sources (passive-tree jewels, server/progression.ts progJewelMods).
  if (extra) for (const [k, v] of Object.entries(extra)) tot[k as ModKey] = (tot[k as ModKey] ?? 0) + (v as number);
  const g = (k: ModKey) => tot[k] ?? 0;

  s.maxHp += g("life");
  s.moveSpeed *= 1 + g("moveInc") / 100;
  // Weapon base after its local mods and quality (PoE2: local flat, then local % + quality), then global.
  const lw = localWeapon(equip.mainhand, w);
  s.attackDamage = (lw.damage + g("dmgFlat")) * (1 + g("dmgInc") / 100);
  s.attackRange = w.range + g("reach");
  s.attackArc = ((w.arcDeg * Math.PI) / 180) * (1 + g("arcInc") / 100);
  const speed = 1 + g("atkSpeedInc") / 100;
  s.attackCooldown = lw.cooldown / speed;
  s.swingTime = lw.swingTime / speed;
  s.swingMoveMult = w.swingMoveMult;
  s.knockback = w.knockback * (1 + g("kbInc") / 100);
  s.dodgeCooldown *= 1 - g("dodgeCdRed") / 100;
  s.lifeRegen = g("regen");
  s.flaskChargeGain = 1 + g("flaskGainInc") / 100;
  s.flaskRecovery = 1 + g("flaskRecInc") / 100;
  s.flaskSlots = equip.belt ? BASE_BY_ID.get(equip.belt.b)?.flaskSlots ?? 1 : 1;
  s.maxMana += g("mana");
  s.spirit += g("spirit");
  s.manaRegen = BASE_MANA_REGEN + g("manaRegen") + s.maxMana * MANA_REGEN_PCT;
  s.spellMult = 1 + g("spellInc") / 100;
  s.castSpeed *= 1 + g("castInc") / 100;
  // + level of skill gems (shared/skills.ts computeSkill)
  s.lvlSpell = g("lvlSpell");
  s.lvlMelee = g("lvlMelee");
  s.lvlProj = g("lvlProj");
  s.lvlFire = g("lvlFire");
  s.lvlCold = g("lvlCold");
  s.lvlLight = g("lvlLight");
  // Defences (combat-systems): item base values (scaled by quality) + flat mods, then % increased.
  let bAr = 0, bEv = 0, bEs = 0;
  for (const slot of SLOTS) {
    const it = equip[slot];
    const b = it ? BASE_BY_ID.get(it.b) : undefined;
    if (!it || !b || b.weapon) continue;
    const d = localDefences(it); // base + local flat, x (local % + quality)
    bAr += d.armour;
    bEv += d.evasion;
    bEs += d.barrier;
  }
  s.armour = (bAr + g("armour")) * (1 + g("armourInc") / 100);
  s.evasion = (bEv + g("evasion")) * (1 + g("evasionInc") / 100);
  s.energyShield = (bEs + g("es")) * (1 + g("esInc") / 100);
  s.esFasterStart = g("esStart");
  const ohb = equip.offhand ? BASE_BY_ID.get(equip.offhand.b) : undefined;
  s.blockChance = g("block") + (ohb?.sub === "shield" ? ((ohb as { block?: number }).block ?? SHIELD_BASE_BLOCK) * (1 + g("lBlockInc") / 100) : 0);
  s.resFire = g("resFire") + g("resAll");
  s.resCold = g("resCold") + g("resAll");
  s.resLight = g("resLight") + g("resAll");
  s.resChaos = g("resChaos");
  s.maxRes = g("maxRes");
  s.accuracy += g("accuracy");
  s.ailmentThreshold = g("ailThr");
  s.stunThreshold = g("stunThr");
  if (w.crit !== undefined) s.critChance = w.crit; // PoE2: base crit chance comes from the weapon base
  s.critChance += lw.critAdd; // local "+% to Critical Hit Chance" adds to the weapon's base
  s.critChance *= 1 + g("critInc") / 100;
  s.critMulti += g("critMulti");
  return clampStats(s);
}

// ---- local mods (PoE2: they change only the item they are on) -------------------------------

export interface LocalWeapon {
  damage: number;
  cooldown: number;
  swingTime: number;
  /** Flat crit chance added to the weapon base by local mods. */
  critAdd: number;
  /** Any local mod or quality changed the base numbers (tooltip shows them as augmented). */
  changed: boolean;
}

/** Weapon numbers after its local mods: (base + local flat) x (1 + (local % + quality) / 100); local attack speed. */
export function localWeapon(item: Item | null | undefined, w?: WeaponProps): LocalWeapon {
  const wp = w ?? (item ? BASE_BY_ID.get(item.b)?.weapon : undefined) ?? UNARMED;
  if (!item) return { damage: wp.damage, cooldown: wp.cooldown, swingTime: wp.swingTime, critAdd: 0, changed: false };
  const t = itemModTotals(item);
  const q = item.q ?? 0;
  const inc = q + (t.lDmgInc ?? 0);
  const aspd = 1 + (t.lAtkSpd ?? 0) / 100;
  return {
    damage: (wp.damage + (t.lDmgFlat ?? 0)) * (1 + inc / 100),
    cooldown: wp.cooldown / aspd,
    swingTime: wp.swingTime / aspd,
    critAdd: t.lCrit ?? 0,
    changed: inc !== 0 || !!t.lDmgFlat || !!t.lAtkSpd || !!t.lCrit,
  };
}

export interface LocalDefences {
  armour: number;
  evasion: number;
  barrier: number;
  block: number;
  changed: boolean;
}

/** Armour piece / shield defences after its local mods: (base + local flat) x (1 + (local % + quality) / 100). */
export function localDefences(item: Item): LocalDefences {
  const b = BASE_BY_ID.get(item.b);
  if (!b || b.weapon) return { armour: 0, evasion: 0, barrier: 0, block: 0, changed: false };
  const t = itemModTotals(item);
  const q = item.q ?? 0;
  const f = (k: ModKey) => t[k] ?? 0;
  const arInc = q + f("lArInc") + f("lArEvInc") + f("lArEsInc");
  const evInc = q + f("lEvInc") + f("lArEvInc") + f("lEvEsInc");
  const esInc = q + f("lEsInc") + f("lArEsInc") + f("lEvEsInc");
  const baseBlock = b.sub === "shield" ? b.block ?? SHIELD_BASE_BLOCK : 0;
  return {
    armour: ((b.armour ?? 0) + f("lAr")) * (1 + arInc / 100),
    evasion: ((b.evasion ?? 0) + f("lEv")) * (1 + evInc / 100),
    barrier: ((b.barrier ?? 0) + f("lEs")) * (1 + esInc / 100),
    block: baseBlock * (1 + f("lBlockInc") / 100),
    changed: q !== 0 || ["lAr", "lEv", "lEs", "lArInc", "lEvInc", "lEsInc", "lArEvInc", "lArEsInc", "lEvEsInc", "lBlockInc"].some((k) => f(k as ModKey) !== 0),
  };
}

/** Passive block chance (%) every shield grants (combat-systems; block affixes add to it). */
export const SHIELD_BASE_BLOCK = 20;

/** Stats if `item` were equipped into `slot` (for tooltips' quick compare). */
export function previewStats(equip: Equipment, item: Item, slot: Slot): Stats {
  return computeStats({ ...equip, [slot]: item });
}

// ---- display ----------------------------------------------------------------

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function modText(mod: ItemMod): string {
  const a = AFFIX_BY_ID.get(mod.a);
  if (a) return modLines(mod).join(", ");
  const f = FLASK_AFFIX_BY_ID.get(mod.a);
  if (f) return FLASK_MOD_LABELS[f.key].replace("{v}", fmt(mod.v));
  const sp = specialModInfo(mod.a);
  if (sp) {
    const label = sp.label ?? MOD_LABELS[sp.key as ModKey] ?? (isFxKey(sp.key) ? FX_LABELS[sp.key] : "?");
    // Negative values on "increased" lines read as "reduced" (unique drawbacks).
    if (mod.v < 0 && label.includes("increased")) return label.replace("increased", "reduced").replace("{v}", fmt(-mod.v));
    if (mod.v < 0 && label.startsWith("+{v}")) return label.replace("+{v}", fmt(mod.v));
    return label.replace("{v}", fmt(mod.v));
  }
  return "?";
}

/** Tooltip lines of one modifier: hybrid mods (Affix.key2) show one line per stat, like PoE2. */
export function modLines(mod: ItemMod): string[] {
  const a = AFFIX_BY_ID.get(mod.a);
  if (!a) return [modText(mod)];
  const out = [MOD_LABELS[a.key].replace("{v}", fmt(mod.v))];
  if (a.key2 && mod.v2 !== undefined) out.push(MOD_LABELS[a.key2].replace("{v}", fmt(mod.v2)));
  return out;
}

/** Other item kinds (skill gems, shared/skills.ts) describe themselves for tooltips here. */
export interface ItemInfoHook {
  name?(it: Item): string | undefined;
  cls?(it: Item): string | undefined;
  lines?(it: Item): string[] | undefined;
}
export const itemInfoHooks: ItemInfoHook[] = [];
function hookInfo<K extends keyof ItemInfoHook>(k: K, it: Item): ReturnType<NonNullable<ItemInfoHook[K]>> | undefined {
  for (const h of itemInfoHooks) {
    const v = h[k]?.(it);
    if (v !== undefined) return v as ReturnType<NonNullable<ItemInfoHook[K]>>;
  }
  return undefined;
}

/** Base-type lines: weapon properties, implicits, flask properties. */
export function baseLines(item: Item): string[] {
  const out: string[] = [];
  const fb = FLASK_BASE_BY_ID.get(item.b);
  if (fb) {
    const f = flaskProps(item, 1);
    out.push(`Recovers ${Math.round(f.heal)} ${fb.res === "mana" ? "Mana" : "Life"} ${f.instant ? "instantly" : `over ${f.duration.toFixed(1)}s`}`);
    if (!f.instant && f.partInstant > 0) out.push(`${Math.round(f.partInstant * 100)}% of it applied instantly`);
    if (fb.res !== "mana" && PVP_FLASK_MULT < 1) out.push(`${Math.round((1 - PVP_FLASK_MULT) * 100)}% less while fighting other players`);
    out.push(`Consumes ${f.perUse} of ${f.maxCharges} Charges · refilled by kills`);
    out.push(`Currently has ${Math.floor(item.c ?? 0)} Charges`);
    return out.concat(lootBaseLines(item));
  }
  const b = BASE_BY_ID.get(item.b);
  if (!b) return hookInfo("lines", item) ?? lootBaseLines(item);
  if (b.weapon) {
    const w = b.weapon;
    out.push(`Damage: ${w.damage}   Reach: ${w.range}   Arc: ${w.arcDeg}°`);
    if (w.phys) out.push(`Physical Damage: ${w.phys[0]}-${w.phys[1]}`);
    if (w.crit !== undefined) out.push(`Critical Hit Chance: ${w.crit.toFixed(2)}%`);
    out.push(`Attacks per second: ${(1 / w.cooldown).toFixed(2)}`);
    if (w.reload) out.push(`Reload Time: ${w.reload.toFixed(2)}s`);
  }
  if (b.flaskSlots) out.push(`Flask slots: ${b.flaskSlots}`);
  if (b.implicit) {
    for (const [k, v] of Object.entries(b.implicit)) out.push(MOD_LABELS[k as ModKey].replace("{v}", fmt(v as number)));
  }
  return out.concat(lootBaseLines(item)); // quality, sockets, blighted implicits, corruption
}

export function classLabel(item: Item): string {
  const cls = itemClass(item);
  if (cls === "weapon") return BASE_BY_ID.get(item.b)?.weapon?.kind ?? "weapon";
  return cls ?? hookInfo("cls", item) ?? lootClassLabel(item) ?? "item";
}

export function baseName(item: Item): string {
  return BASE_BY_ID.get(item.b)?.name ?? FLASK_BASE_BY_ID.get(item.b)?.name ?? hookInfo("name", item) ?? lootBaseName(item) ?? item.b;
}

/** Stats shown in quick compare. `better` = which direction is an improvement. */
export const COMPARE_STATS: { key: keyof Stats; label: string; better: 1 | -1; scale?: number; decimals?: number }[] = [
  { key: "maxHp", label: "Max Life", better: 1 },
  { key: "attackDamage", label: "Attack Damage", better: 1, decimals: 1 },
  { key: "attackCooldown", label: "Attack Time (s)", better: -1, decimals: 2 },
  { key: "attackRange", label: "Reach", better: 1 },
  { key: "attackArc", label: "Arc (°)", better: 1, scale: 180 / Math.PI },
  { key: "knockback", label: "Knockback", better: 1 },
  { key: "moveSpeed", label: "Move Speed", better: 1, decimals: 1 },
  { key: "dodgeCooldown", label: "Dodge Cooldown (s)", better: -1, decimals: 2 },
  { key: "lifeRegen", label: "Life Regen /s", better: 1, decimals: 1 },
  { key: "flaskChargeGain", label: "Flask Charge Gain", better: 1, scale: 100, decimals: 0 },
  { key: "flaskRecovery", label: "Flask Recovery", better: 1, scale: 100, decimals: 0 },
  { key: "flaskSlots", label: "Flask Slots", better: 1 },
  // PoE2 compare also lists defences, resources, crit and resistances.
  { key: "armour", label: "Armour", better: 1 },
  { key: "evasion", label: "Evasion Rating", better: 1 },
  { key: "energyShield", label: "Energy Shield", better: 1 },
  { key: "blockChance", label: "Block Chance (%)", better: 1, decimals: 1 },
  { key: "maxMana", label: "Max Mana", better: 1 },
  { key: "spirit", label: "Spirit", better: 1 },
  { key: "critChance", label: "Critical Hit Chance (%)", better: 1, decimals: 1 },
  { key: "castSpeed", label: "Cast Speed", better: 1, scale: 100, decimals: 0 },
  { key: "resFire", label: "Fire Resistance (%)", better: 1 },
  { key: "resCold", label: "Cold Resistance (%)", better: 1 },
  { key: "resLight", label: "Lightning Resistance (%)", better: 1 },
  { key: "resChaos", label: "Chaos Resistance (%)", better: 1 },
];

export interface CompareLine {
  label: string;
  diff: number; // displayed difference
  good: boolean;
}

export function compareStats(cur: Stats, next: Stats): CompareLine[] {
  const out: CompareLine[] = [];
  for (const c of COMPARE_STATS) {
    const scale = c.scale ?? 1;
    const d = (next[c.key] - cur[c.key]) * scale;
    const p = Math.pow(10, c.decimals ?? 0);
    const rounded = Math.round(d * p) / p;
    if (rounded === 0) continue;
    out.push({ label: c.label, diff: rounded, good: rounded * c.better > 0 });
  }
  return out;
}

// ---- flasks -------------------------------------------------------------------

export interface FlaskProps {
  maxCharges: number;
  perUse: number;
  heal: number;
  duration: number;
  instant: boolean;
  gainMult: number;
  /** Fraction (0..1) of the recovery applied instantly; the rest goes over `duration`. */
  partInstant: number;
  /** Recovery becomes fully instant while the user is on Low Life. */
  lowInstant: boolean;
  /** Ailments removed on use. */
  cureBleed: boolean;
  cureElem: boolean;
  cureStun: boolean;
  /** Chance (0..1) not to consume charges. */
  noConsume: number;
}

function flaskModTotal(item: Item, key: FlaskModKey): number {
  let v = 0;
  for (const m of item.m) {
    if (FLASK_AFFIX_BY_ID.get(m.a)?.key === key) v += m.v;
    else {
      const u = uniqueModLine(m.a); // unique flask lines
      if (u && u.u.mods[u.i][0] === key) v += m.v;
    }
  }
  return v;
}

/** Effective flask numbers; `recovery` is the player's flaskRecovery stat. */
export function flaskProps(item: Item, recovery: number): FlaskProps {
  const b = FLASK_BASE_BY_ID.get(item.b)!;
  const instant = flaskModTotal(item, "fInstant") > 0;
  return {
    maxCharges: b.maxCharges + flaskModTotal(item, "fMaxCharges"),
    perUse: Math.max(1, Math.round(b.chargesPerUse * (1 - flaskModTotal(item, "fChargesRed") / 100))),
    // Quality: increased amount recovered (PoE2). Instant recovery trades amount for speed.
    heal:
      b.heal *
      (1 + (flaskModTotal(item, "fRecInc") + (item.q ?? 0)) / 100) *
      Math.max(0.1, 1 + flaskModTotal(item, "fAmountMore") / 100) *
      (instant ? 1 - INSTANT_PENALTY : 1) *
      recovery,
    duration: b.duration / Math.max(0.1, 1 + flaskModTotal(item, "fRateInc") / 100),
    instant,
    gainMult: 1 + flaskModTotal(item, "fGainInc") / 100,
    partInstant: Math.min(1, Math.max(0, flaskModTotal(item, "fPartInstant") / 100)),
    lowInstant: flaskModTotal(item, "fLowInstant") > 0,
    cureBleed: flaskModTotal(item, "fCureBleed") > 0,
    cureElem: flaskModTotal(item, "fCureElem") > 0,
    cureStun: flaskModTotal(item, "fCureStun") > 0,
    noConsume: Math.min(0.9, Math.max(0, flaskModTotal(item, "fNoConsume") / 100)),
  };
}
