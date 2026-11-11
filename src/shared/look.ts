// Paper-doll appearance code shared by server (snapshot) and client (sprites).
// Bases carry a VISUAL look key (`look: "helm_open"` etc.): the first 14 chars of the code are look-key
// indices + rarity (the painted / paper-doll sprites draw from those). The second 14 chars name the
// exact item BASE per slot, because the 3D hero has one look per base (gfx/hero3d).
import { BASES, BASE_BY_ID } from "./content/bases";
import type { Equipment } from "./items";

/** Visual vocabulary per paper-doll slot. Index 0 of each list is "nothing equipped". Append only. */
export const LOOK_KEYS = {
  helmet: ["", "hood", "coif", "helm_open", "helm_great", "helm_horned", "circlet"],
  body: ["", "body_leather", "body_scale", "body_mail", "body_plate", "body_robe", "body_brigandine", "body_plate_robe", "body_scale_robe"],
  gloves: ["", "gloves_wrap", "gloves_leather", "gloves_gauntlet", "gloves_silk"],
  boots: ["", "boots_wrap", "boots_soft", "boots_greave", "boots_slipper"],
  offhand: ["", "shield_buckler", "shield_round", "shield_kite", "shield_tower", "focus_orb", "quiver"],
  weapon: [
    "",
    "sword_short",
    "sword_long",
    "greatsword",
    "axe_hand",
    "greataxe",
    "mace",
    "maul",
    "dagger",
    "claw",
    "spear",
    "sceptre",
    "wand",
    "quarterstaff",
    "staff",
    "bow",
    "crossbow",
  ],
  belt: ["", "belt_rope", "belt_leather", "belt_studded", "belt_chain"],
} as const;

export type LookSlot = keyof typeof LOOK_KEYS;
/** Wire order of the slots in the look code. */
export const LOOK_SLOTS: LookSlot[] = ["helmet", "body", "gloves", "boots", "offhand", "weapon", "belt"];
/** Equipment slot that feeds each look slot. */
const EQUIP_SLOT: Record<LookSlot, string> = {
  helmet: "helmet",
  body: "body",
  gloves: "gloves",
  boots: "boots",
  offhand: "offhand",
  weapon: "mainhand",
  belt: "belt",
};

export type HelmKey = (typeof LOOK_KEYS.helmet)[number];
export type BodyKey = (typeof LOOK_KEYS.body)[number];
export type GloveKey = (typeof LOOK_KEYS.gloves)[number];
export type BootKey = (typeof LOOK_KEYS.boots)[number];
export type OffhandKey = (typeof LOOK_KEYS.offhand)[number];
export type WeaponLookKey = (typeof LOOK_KEYS.weapon)[number];
export type BeltKey = (typeof LOOK_KEYS.belt)[number];

export interface Look {
  helmet: HelmKey;
  body: BodyKey;
  gloves: GloveKey;
  boots: BootKey;
  offhand: OffhandKey;
  weapon: WeaponLookKey;
  belt: BeltKey;
  /** Rarity per look slot: 0 normal, 1 magic, 2 rare, 3 unique. */
  rar: Record<LookSlot, number>;
  /** Item base id per look slot ("" when empty or when the code carries no bases). */
  base: Record<LookSlot, string>;
}

/** Bases from before look keys existed (and untagged ones): best-guess visuals. */
const LEGACY: Record<string, string> = {
  leather_coif: "coif",
  visored_helm: "helm_great",
  patchwork_jerkin: "body_leather",
  scaled_hauberk: "body_scale",
  wrapped_mitts: "gloves_wrap",
  spiked_gauntlets: "gloves_gauntlet",
  mudwalker_boots: "boots_soft",
  fleetstride_greaves: "boots_greave",
  hide_buckler: "shield_buckler",
  ironbound_ward: "shield_kite",
  rope_sash: "belt_rope",
  studded_girdle: "belt_studded",
  ruststeel_sword: "sword_short",
  gallowsedge_blade: "sword_long",
  thornwood_spear: "spear",
  wyrmtooth_pike: "spear",
  woodsplitter_axe: "axe_hand",
  grievance_axe: "greataxe",
  wick_knife: "dagger",
  moonsliver_dirk: "dagger",
};
/** Default per weapon kind for untagged weapon bases. */
const KIND_DEFAULT: Record<string, WeaponLookKey> = {
  sword: "sword_long",
  spear: "spear",
  axe: "axe_hand",
  dagger: "dagger",
  bow: "bow",
  staff: "staff",
  mace: "mace",
  claw: "claw",
  wand: "wand",
  sceptre: "sceptre",
  crossbow: "crossbow",
  quarterstaff: "quarterstaff",
};
const SLOT_DEFAULT: Record<LookSlot, string> = {
  helmet: "helm_open",
  body: "body_leather",
  gloves: "gloves_leather",
  boots: "boots_soft",
  offhand: "shield_round",
  weapon: "sword_long",
  belt: "belt_leather",
};

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";

function keyIndex(slot: LookSlot, baseId: string | undefined): number {
  if (!baseId) return 0;
  const list = LOOK_KEYS[slot] as readonly string[];
  const base = BASE_BY_ID.get(baseId) as ({ look?: string; weapon?: { kind?: string } } & object) | undefined;
  let key = base?.look ?? LEGACY[baseId];
  if (!key && slot === "weapon") key = KIND_DEFAULT[base?.weapon?.kind ?? ""];
  let i = key ? list.indexOf(key) : -1;
  if (i <= 0) i = list.indexOf(SLOT_DEFAULT[slot]);
  return Math.max(1, i);
}

let baseIndex: Map<string, number> | null = null;
/** Two base36 digits naming an item base (index into BASES + 1); "00" = none / unknown. */
function baseCode(baseId: string | undefined): string {
  baseIndex ??= new Map(BASES.map((b, i) => [b.id, i + 1]));
  const i = (baseId && baseIndex.get(baseId)) || 0;
  return B36[Math.floor(i / 36) % 36] + B36[i % 36];
}

/**
 * 28 chars: per slot (helmet, body, gloves, boots, offhand, weapon, belt) a base36 key index + rarity
 * digit, then per slot the item base (2 base36 digits).
 */
export function encodeLook(e: Equipment): string {
  const eq = e as unknown as Record<string, { b: string; r: number } | null | undefined>;
  let s = "";
  let bases = "";
  for (const slot of LOOK_SLOTS) {
    const it = eq[EQUIP_SLOT[slot]];
    const idx = keyIndex(slot, it?.b);
    s += B36[idx] + (it ? String(Math.max(0, Math.min(3, it.r | 0))) : "0");
    bases += baseCode(it?.b);
  }
  return s + bases;
}

/** Look code of a character with nothing equipped. */
export const NAKED_LOOK = "0".repeat(LOOK_SLOTS.length * 2);

const decodeCache = new Map<string, Look>();
export function decodeLook(s: string | undefined): Look {
  const n = LOOK_SLOTS.length * 2;
  const code = s && (s.length === n || s.length === n * 2) ? s : NAKED_LOOK;
  let l = decodeCache.get(code);
  if (l) return l;
  const out: Record<string, unknown> = {};
  const rar = {} as Record<LookSlot, number>;
  const base = {} as Record<LookSlot, string>;
  LOOK_SLOTS.forEach((slot, k) => {
    const list = LOOK_KEYS[slot] as readonly string[];
    const i = B36.indexOf(code[k * 2]);
    out[slot] = list[i > 0 && i < list.length ? i : 0];
    rar[slot] = Math.max(0, Math.min(3, Number(code[k * 2 + 1]) || 0));
    const bi = code.length > n ? B36.indexOf(code[n + k * 2]) * 36 + B36.indexOf(code[n + k * 2 + 1]) : 0;
    base[slot] = out[slot] && bi > 0 ? (BASES[bi - 1]?.id ?? "") : "";
  });
  out.rar = rar;
  out.base = base;
  l = out as unknown as Look;
  if (decodeCache.size > 2000) decodeCache.clear();
  decodeCache.set(code, l);
  return l;
}

/** Build a look code directly from keys (sprite sheets, previews); `bases` adds the exact item bases. */
export function lookCode(keys: Partial<Record<LookSlot, string>>, rarity: Partial<Record<LookSlot, number>> = {}, bases?: Partial<Record<LookSlot, string>>): string {
  let s = "";
  let bs = "";
  for (const slot of LOOK_SLOTS) {
    const list = LOOK_KEYS[slot] as readonly string[];
    const i = bases?.[slot] ? keyIndex(slot, bases[slot]) : Math.max(0, list.indexOf(keys[slot] ?? ""));
    s += B36[i] + String(i ? rarity[slot] ?? 0 : 0);
    bs += baseCode(bases?.[slot]);
  }
  return bases ? s + bs : s;
}
