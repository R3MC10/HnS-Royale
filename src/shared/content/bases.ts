// Item base catalogue. All names and numbers are original to this project; the *structure*
// (weapon classes, tiered bases, armour defence categories, attribute requirements, drop levels)
// follows the action-RPG conventions the design doc locks in.
//
// Every base carries:
//   reqIlvl  minimum item level to drop (loot.ts filters on it)
//   req      level / attribute requirements (shown in tooltips; see meetsRequirements)
//   look     visual key from shared/look.ts LOOK_KEYS
//   size     inventory footprint [w, h] (shared/grid.ts)
//   def      defence category for armour and shields; armour / evasion / barrier base values
import type { DefTag, ItemBase, ItemClass, ModKey, WeaponKind, WeaponProps } from "./types";

// `cooldown` is the full attack time (wind-up + follow-through); hits land at the commit point
// (see skills.ts). `swingMoveMult` is the movement multiplier while attacking.

/** Used when the main hand is empty. */
export const UNARMED: WeaponProps = {
  kind: "sword",
  damage: 8,
  range: 34,
  arcDeg: 90,
  cooldown: 0.55,
  swingTime: 0.55,
  knockback: 300,
  swingMoveMult: 0.45,
};

type W = (damage: number, extra?: Partial<WeaponProps>) => WeaponProps;
const tpl = (base: Omit<WeaponProps, "damage">): W => (damage, extra = {}) => ({ ...base, damage, ...extra });

// ---- weapon templates (per class) --------------------------------------------------------------
// One-handed melee
const sword = tpl({ kind: "sword", range: 62, arcDeg: 110, cooldown: 0.66, swingTime: 0.66, knockback: 480, swingMoveMult: 0.3, crit: 5 });
const axe = tpl({ kind: "axe", range: 64, arcDeg: 100, cooldown: 1.05, swingTime: 1.05, knockback: 440, swingMoveMult: 0.2, crit: 5 });
const mace = tpl({ kind: "mace", range: 60, arcDeg: 90, cooldown: 1.0, swingTime: 1.0, knockback: 500, swingMoveMult: 0.22, crit: 5 });
const dagger = tpl({ kind: "dagger", range: 52, arcDeg: 75, cooldown: 0.44, swingTime: 0.44, knockback: 240, swingMoveMult: 0.45, crit: 7 });
const claw = tpl({ kind: "claw", range: 40, arcDeg: 85, cooldown: 0.4, swingTime: 0.4, knockback: 200, swingMoveMult: 0.5, crit: 6.5 });
const spear = tpl({ kind: "spear", range: 105, arcDeg: 40, cooldown: 0.74, swingTime: 0.74, knockback: 400, swingMoveMult: 0.3, crit: 5 });
const sceptre = tpl({ kind: "sceptre", range: 56, arcDeg: 90, cooldown: 0.9, swingTime: 0.9, knockback: 600, swingMoveMult: 0.28, crit: 5 });
// One-handed ranged
const wand = tpl({ kind: "wand", range: 340, arcDeg: 16, cooldown: 0.62, swingTime: 0.5, knockback: 160, swingMoveMult: 0.55, ranged: true, crit: 7 });
// Two-handed melee
const greatsword = tpl({ kind: "sword", range: 78, arcDeg: 140, cooldown: 0.95, swingTime: 0.95, knockback: 640, swingMoveMult: 0.22, twoHand: true, crit: 5 });
const greataxe = tpl({ kind: "axe", range: 76, arcDeg: 120, cooldown: 1.3, swingTime: 1.3, knockback: 560, swingMoveMult: 0.15, twoHand: true, crit: 5 });
const maul = tpl({ kind: "mace", range: 72, arcDeg: 110, cooldown: 1.35, swingTime: 1.35, knockback: 640, swingMoveMult: 0.15, twoHand: true, crit: 5 });
const quarterstaff = tpl({ kind: "quarterstaff", range: 86, arcDeg: 150, cooldown: 0.72, swingTime: 0.72, knockback: 520, swingMoveMult: 0.35, twoHand: true, crit: 10 });
const staff = tpl({ kind: "staff", range: 88, arcDeg: 110, cooldown: 0.95, swingTime: 0.95, knockback: 500, swingMoveMult: 0.3, twoHand: true, crit: 7 });
// Two-handed ranged
const bow = tpl({ kind: "bow", range: 420, arcDeg: 14, cooldown: 0.78, swingTime: 0.6, knockback: 220, swingMoveMult: 0.42, ranged: true, twoHand: true, crit: 5 });
const crossbow = tpl({ kind: "crossbow", range: 380, arcDeg: 10, cooldown: 1.15, swingTime: 0.8, knockback: 420, swingMoveMult: 0.35, ranged: true, twoHand: true, crit: 5, reload: 0.8 });

type Req = NonNullable<ItemBase["req"]>;
type Imp = Partial<Record<ModKey, number>>;
/** One tier row: id, name, drop level, damage, optional implicit / weapon overrides. */
type WRow = [id: string, name: string, ilvl: number, dmg: number, imp?: Imp, extra?: Partial<WeaponProps>];

/** Attribute a weapon class leans on, for requirements: [str, dex, int] share. */
const WEAPON_ATTR: Record<string, [number, number, number]> = {
  sword: [0.5, 0.5, 0], axe: [1, 0, 0], mace: [1, 0, 0], dagger: [0, 0.5, 0.5], claw: [0, 1, 0], spear: [0.5, 0.5, 0],
  sceptre: [0.5, 0, 0.5], wand: [0, 0, 1], greatsword: [0.6, 0.4, 0], greataxe: [1, 0, 0], maul: [1, 0, 0],
  quarterstaff: [0, 0.6, 0.4], staff: [0, 0, 1], bow: [0, 1, 0], crossbow: [0.4, 0.6, 0],
};

const reqFor = (ilvl: number, share: [number, number, number]): Req => {
  const pts = ilvl <= 1 ? 0 : Math.round(8 + ilvl * 2.6);
  const r: Req = { lvl: Math.max(1, ilvl) };
  if (share[0]) r.str = Math.round(pts * share[0]);
  if (share[1]) r.dex = Math.round(pts * share[1]);
  if (share[2]) r.int = Math.round(pts * share[2]);
  for (const k of ["str", "dex", "int"] as const) if (r[k] === 0) delete r[k];
  return r;
};
const weightFor = (i: number) => [10, 8, 6, 5, 4, 3][i] ?? 3;

/**
 * Physical damage spread per weapon class (PoE2 bases show "min-max"; average = `damage`).
 * Heavy weapons roll tight, daggers / bows / crossbows roll wide.
 */
const WEAPON_SPREAD: Record<string, number> = {
  sword: 0.2, axe: 0.25, mace: 0.25, dagger: 0.45, claw: 0.3, spear: 0.25, sceptre: 0.25, wand: 0.3,
  greatsword: 0.25, greataxe: 0.3, maul: 0.3, quarterstaff: 0.25, staff: 0.25, bow: 0.4, crossbow: 0.45,
};
const physRange = (dmg: number, spread: number): [number, number] => [Math.max(1, Math.round(dmg * (1 - spread))), Math.round(dmg * (1 + spread))];

/**
 * Duel-tuned damage per weapon class (headless 1v1 sims, docs/BALANCE.md): heavy and short weapons
 * hit harder to pay for closing the gap; bows / quarterstaves / wands, which already win on reach, a bit less.
 */
const DMG_TUNE: Record<string, number> = {
  dagger: 1.75, staff: 2, mace: 1.6, maul: 1.45, axe: 1.2, greataxe: 1.15, sword: 1.1, greatsword: 1.05, bow: 0.75, wand: 1, quarterstaff: 1.15,
};

function weapons(group: string, w: W, look: string, size: [number, number], rows: WRow[]): ItemBase[] {
  const tune = DMG_TUNE[group] ?? 1;
  return rows.map(([id, name, ilvl, dmg0, imp, extra], i) => { const dmg = Math.round(dmg0 * tune * 10) / 10; return {
    id, name, cls: "weapon" as const, reqIlvl: ilvl, weight: weightFor(i),
    weapon: { phys: physRange(dmg, WEAPON_SPREAD[group] ?? 0.25), ...w(dmg, extra) },
    look, size, req: reqFor(ilvl, WEAPON_ATTR[group]), ...(imp ? { implicit: imp } : {}),
  }; });
}

// ---- armour ---------------------------------------------------------------------------------
/** Pure-category body values per tier (scaled down for other slots). */
const DEF_CURVE = { ar: [40, 75, 115, 160], ev: [55, 100, 150, 210], es: [20, 38, 58, 80] };
const SLOT_SCALE: Record<string, number> = { body: 1, helmet: 0.45, gloves: 0.35, boots: 0.35, offhand: 0.6 };
const HYBRID_SHARE = 0.6;
const DEF_ATTR: Record<DefTag, [number, number, number]> = {
  ar: [1, 0, 0], ev: [0, 1, 0], es: [0, 0, 1], ar_ev: [0.5, 0.5, 0], ar_es: [0.5, 0, 0.5], ev_es: [0, 0.5, 0.5],
};

function defValues(def: DefTag, tier: number, slot: string): Pick<ItemBase, "armour" | "evasion" | "barrier"> {
  const parts = def.split("_") as ("ar" | "ev" | "es")[];
  const share = parts.length > 1 ? HYBRID_SHARE : 1;
  const t = Math.min(tier, 3);
  const v = (k: "ar" | "ev" | "es") => Math.round(DEF_CURVE[k][t] * share * SLOT_SCALE[slot]);
  const out: Pick<ItemBase, "armour" | "evasion" | "barrier"> = {};
  if (parts.includes("ar")) out.armour = v("ar");
  if (parts.includes("ev")) out.evasion = v("ev");
  if (parts.includes("es")) out.barrier = v("es");
  return out;
}

type ARow = [id: string, name: string, imp?: Imp];
const PURE_ILVL = [1, 6, 11, 16];
const HYBRID_ILVL = [3, 9, 15];

function armours(cls: "helmet" | "body" | "gloves" | "boots", def: DefTag, look: string, rows: ARow[], size?: [number, number]): ItemBase[] {
  const ilvls = def.includes("_") ? HYBRID_ILVL : PURE_ILVL;
  const scale = SLOT_SCALE[cls];
  return rows.map(([id, name, imp], i) => {
    const ilvl = ilvls[i] ?? ilvls[ilvls.length - 1];
    const tier = def.includes("_") ? Math.min(3, i + 1) : i; // hybrids start a step up
    const r = reqFor(ilvl, DEF_ATTR[def]);
    for (const k of ["str", "dex", "int"] as const) if (r[k]) r[k] = Math.max(1, Math.round(r[k]! * (0.5 + scale / 2)));
    return {
      id, name, cls, reqIlvl: ilvl, weight: weightFor(i), look, def, req: r,
      ...defValues(def, tier, cls), ...(size ? { size } : {}), ...(imp ? { implicit: imp } : {}),
    };
  });
}

/** Block chance per shield type (PoE2-like: bucklers low, towers high). */
const SHIELD_BLOCK: Record<string, number> = { shield_buckler: 14, shield_round: 20, shield_kite: 24, shield_tower: 30 };

function offhands(sub: "shield" | "focus" | "quiver", def: DefTag | undefined, look: string, size: [number, number], rows: ARow[], ilvls: number[], attr: [number, number, number]): ItemBase[] {
  return rows.map(([id, name, imp], i) => ({
    id, name, cls: "offhand" as const, sub, reqIlvl: ilvls[i], weight: weightFor(i), look, size,
    ...(sub === "shield" ? { block: SHIELD_BLOCK[look] + i } : {}),
    req: reqFor(ilvls[i], attr), ...(def ? { def, ...defValues(def, def.includes("_") ? Math.min(3, i + 1) : i, "offhand") } : {}),
    ...(imp ? { implicit: imp } : {}),
  }));
}

const jewel = (cls: "amulet" | "ring", rows: [string, string, number, Imp][]): ItemBase[] =>
  rows.map(([id, name, ilvl, implicit], i) => ({ id, name, cls, reqIlvl: ilvl, weight: weightFor(i), implicit, req: { lvl: Math.max(1, ilvl) } }));

export const BASES: ItemBase[] = [
  // ================= Weapons: one-handed melee =================
  ...weapons("sword", sword, "sword_short", [1, 3], [
    ["ruststeel_sword", "Ruststeel Sword", 1, 22],
    ["chapel_shortsword", "Chapel Shortsword", 5, 26],
  ]),
  ...weapons("sword", sword, "sword_long", [2, 3], [
    ["gallowsedge_blade", "Gallowsedge Blade", 8, 30],
    ["oathbreaker_sabre", "Oathbreaker Sabre", 12, 35, { atkSpeedInc: 4 }],
    ["vigil_longsword", "Vigil Longsword", 16, 41],
  ]),
  ...weapons("axe", axe, "axe_hand", [2, 3], [
    ["woodsplitter_axe", "Woodsplitter Axe", 1, 38],
    ["bearded_hatchet", "Bearded Hatchet", 5, 44],
    ["grievance_axe", "Grievance Axe", 8, 50],
    ["widowmaker_axe", "Widowmaker Axe", 12, 57],
    ["headsman_cleaver", "Headsman's Cleaver", 16, 66, { kbInc: 10 }],
  ]),
  ...weapons("mace", mace, "mace", [2, 3], [
    ["knotwood_club", "Knotwood Club", 1, 34],
    ["flanged_mace", "Flanged Mace", 5, 40],
    ["bellhammer", "Bellhammer", 9, 47],
    ["penitent_morningstar", "Penitent Morningstar", 13, 54],
    ["reliquary_mace", "Reliquary Mace", 17, 62, { life: 15 }],
  ]),
  ...weapons("dagger", dagger, "dagger", [1, 3], [
    ["wick_knife", "Wick Knife", 1, 13],
    ["gutting_knife", "Gutting Knife", 4, 15],
    ["moonsliver_dirk", "Moonsliver Dirk", 8, 18],
    ["mercy_stiletto", "Mercy Stiletto", 12, 21, { atkSpeedInc: 5 }],
    ["veilpiercer", "Veilpiercer", 16, 25, undefined, { crit: 8.5 }],
  ]),
  ...weapons("claw", claw, "claw", [2, 2], [
    ["rag_talon", "Rag Talon", 1, 12, { regen: 0.4 }],
    ["hooked_grip", "Hooked Grip", 5, 14, { regen: 0.6 }],
    ["carrion_hook", "Carrion Hook", 9, 17, { regen: 0.8 }],
    ["nightjar_talons", "Nightjar Talons", 13, 20, { regen: 1.0 }],
    ["ravener_claw", "Ravener Claw", 17, 23, { regen: 1.3 }],
  ]),
  ...weapons("spear", spear, "spear", [1, 4], [
    ["thornwood_spear", "Thornwood Spear", 1, 20],
    ["boar_lance", "Boar Lance", 5, 23],
    ["wyrmtooth_pike", "Wyrmtooth Pike", 8, 26, undefined, { range: 114 }],
    ["harrow_partisan", "Harrow Partisan", 12, 30, undefined, { range: 116 }],
    ["skyrend_spear", "Skyrend Spear", 16, 35, undefined, { range: 120 }],
  ]),
  ...weapons("sceptre", sceptre, "sceptre", [1, 3], [
    ["acolyte_rod", "Acolyte's Rod", 1, 20, { spirit: 50, mana: 6 }],
    ["bone_sceptre", "Bone Sceptre", 5, 23, { spirit: 50, mana: 9 }],
    ["cinder_sceptre", "Cinder Sceptre", 9, 27, { spirit: 50, mana: 12 }],
    ["abbess_sceptre", "Abbess Sceptre", 13, 31, { spirit: 50, mana: 15 }],
    ["eclipse_sceptre", "Eclipse Sceptre", 17, 35, { spirit: 50, mana: 18 }],
  ]),
  // ================= Weapons: one-handed ranged =================
  ...weapons("wand", wand, "wand", [1, 3], [
    ["twig_wand", "Twig Wand", 1, 11, { spellInc: 6 }],
    ["fingerbone_wand", "Fingerbone Wand", 5, 13, { spellInc: 9 }],
    ["ashen_wand", "Ashen Wand", 9, 15, { spellInc: 12 }],
    ["gloam_wand", "Gloam Wand", 13, 18, { spellInc: 15 }],
    ["starhook_wand", "Starhook Wand", 17, 21, { spellInc: 19 }],
  ]),
  // ================= Weapons: two-handed =================
  ...weapons("greatsword", greatsword, "greatsword", [2, 4], [
    ["pilgrim_greatblade", "Pilgrim Greatblade", 2, 40],
    ["executioner_blade", "Executioner Blade", 7, 48],
    ["cathedral_zweihander", "Cathedral Zweihander", 12, 57],
    ["dusk_claymore", "Dusk Claymore", 17, 67, { reach: 6 }],
  ]),
  ...weapons("greataxe", greataxe, "greataxe", [2, 4], [
    ["timber_greataxe", "Timber Greataxe", 2, 60],
    ["gravedigger_axe", "Gravedigger Axe", 7, 71],
    ["butcher_poleaxe", "Butcher Poleaxe", 12, 83],
    ["ruin_greataxe", "Ruin Greataxe", 17, 96],
  ]),
  ...weapons("maul", maul, "maul", [2, 4], [
    ["mallet_of_toil", "Mallet of Toil", 2, 58],
    ["anvil_maul", "Anvil Maul", 7, 69],
    ["tollbell_hammer", "Tollbell Hammer", 12, 81],
    ["sepulchre_maul", "Sepulchre Maul", 17, 95, { kbInc: 15 }],
  ]),
  ...weapons("quarterstaff", quarterstaff, "quarterstaff", [2, 4], [
    ["ashpole_staff", "Ashpole", 1, 23, { dodgeCdRed: 4 }],
    ["ironshod_pole", "Ironshod Pole", 5, 26, { dodgeCdRed: 5 }],
    ["pilgrim_quarterstaff", "Pilgrim Quarterstaff", 9, 31, { dodgeCdRed: 6 }],
    ["wardancer_staff", "Wardancer Staff", 13, 35, { dodgeCdRed: 8 }],
    ["tempest_quarterstaff", "Tempest Quarterstaff", 17, 40, { dodgeCdRed: 10 }, { crit: 11.5 }],
  ]),
  ...weapons("staff", staff, "staff", [2, 4], [
    ["gnarled_staff", "Gnarled Staff", 1, 22, { spellInc: 10, mana: 10 }],
    ["hollow_staff", "Hollow Staff", 5, 25, { spellInc: 14, mana: 14 }],
    ["vesper_staff", "Vesper Staff", 9, 29, { spellInc: 18, mana: 18 }],
    ["occultist_staff", "Occultist Staff", 13, 33, { spellInc: 23, mana: 24 }],
    ["moonwell_staff", "Moonwell Staff", 17, 38, { spellInc: 28, mana: 30 }],
  ]),
  // ================= Weapons: two-handed ranged =================
  ...weapons("bow", bow, "bow", [2, 4], [
    ["shortbow_yew", "Yew Shortbow", 1, 18],
    ["hunter_recurve", "Hunter's Recurve", 5, 21],
    ["thornstring_bow", "Thornstring Bow", 9, 25],
    ["ravenwing_longbow", "Ravenwing Longbow", 13, 29, undefined, { range: 460, crit: 6.5 }],
    ["gallows_warbow", "Gallows Warbow", 17, 34, undefined, { range: 480 }],
  ]),
  ...weapons("crossbow", crossbow, "crossbow", [2, 3], [
    ["latch_crossbow", "Latch Crossbow", 1, 30],
    ["windlass_crossbow", "Windlass Crossbow", 5, 35],
    ["siege_arbalest", "Siege Arbalest", 9, 41],
    ["bastion_arbalest", "Bastion Arbalest", 13, 48],
    ["requiem_crossbow", "Requiem Crossbow", 17, 56, undefined, { reload: 0.7 }],
  ]),

  // ================= Off-hand =================
  // Shields (blocking will key off def; stat sticks until then)
  ...offhands("shield", "ev", "shield_buckler", [2, 2], [
    ["hide_buckler", "Hide Buckler", { life: 15 }],
    ["studded_buckler", "Studded Buckler", { life: 20 }],
    ["duelist_buckler", "Fencer's Buckler", { life: 25, dodgeCdRed: 3 }],
    ["mirrorpoint_buckler", "Mirrorpoint Buckler", { life: 30, dodgeCdRed: 5 }],
  ], [1, 6, 11, 16], [0, 1, 0]),
  ...offhands("shield", "ar_ev", "shield_round", [2, 2], [
    ["targe_of_boughs", "Bough Targe", { life: 22 }],
    ["iron_rim_targe", "Iron-rim Targe", { life: 30 }],
    ["raider_roundshield", "Raider Roundshield", { life: 38 }],
  ], [3, 9, 15], [0.5, 0.5, 0]),
  ...offhands("shield", "ar_es", "shield_kite", [2, 3], [
    ["ironbound_ward", "Ironbound Ward", { life: 30 }],
    ["chapter_kite", "Chapter Kiteshield", { life: 38 }],
    ["seraph_crest", "Seraph Crest", { life: 46 }],
  ], [3, 9, 15], [0.5, 0, 0.5]),
  ...offhands("shield", "ar", "shield_tower", [2, 3], [
    ["plank_pavise", "Plank Pavise", { life: 25 }],
    ["rampart_shield", "Rampart Shield", { life: 35 }],
    ["bulwark_tower", "Bulwark Tower", { life: 45 }],
    ["gatekeeper_aegis", "Gatekeeper Aegis", { life: 55 }],
  ], [1, 6, 11, 16], [1, 0, 0]),
  // Foci (spellcaster off-hand)
  ...offhands("focus", "es", "focus_orb", [2, 2], [
    ["candle_focus", "Candle Focus", { mana: 12 }],
    ["glass_eye_focus", "Glass-eye Focus", { mana: 18, spellInc: 5 }],
    ["ossuary_focus", "Ossuary Focus", { mana: 24, spellInc: 8 }],
    ["nightglass_orb", "Nightglass Orb", { mana: 30, spellInc: 12 }],
  ], [1, 6, 11, 16], [0, 0, 1]),
  // Quivers (bows only)
  ...offhands("quiver", undefined, "quiver", [2, 3], [
    ["sackcloth_quiver", "Sackcloth Quiver", { dmgFlat: 2 }],
    ["fletcher_quiver", "Fletcher's Quiver", { dmgFlat: 3, atkSpeedInc: 3 }],
    ["barbed_quiver", "Barbed Quiver", { dmgFlat: 5 }],
    ["whisperfeather_quiver", "Whisperfeather Quiver", { dmgFlat: 6, atkSpeedInc: 5 }],
  ], [1, 6, 11, 16], [0, 1, 0]),

  // ================= Helmets =================
  ...armours("helmet", "ar", "helm_open", [["kettle_helm", "Kettle Helm"], ["nasal_helm", "Nasal Helm"], ["visored_helm", "Visored Helm"], ["crowned_greathelm", "Crowned Greathelm"]]),
  ...armours("helmet", "ev", "hood", [["ragged_hood", "Ragged Hood"], ["poacher_hood", "Poacher's Hood"], ["shade_cowl", "Shade Cowl"], ["nightstalker_hood", "Nightstalker Hood"]]),
  ...armours("helmet", "es", "circlet", [["copper_circlet", "Copper Circlet", { mana: 6 }], ["thorn_diadem", "Thorn Diadem", { mana: 9 }], ["moonsilver_circlet", "Moonsilver Circlet", { mana: 12 }], ["seer_crown", "Seer's Crown", { mana: 16 }]]),
  ...armours("helmet", "ar_ev", "helm_horned", [["horned_cap", "Horned Cap"], ["raider_helm", "Raider Helm"], ["warlord_horns", "Warlord Horns"]]),
  ...armours("helmet", "ar_es", "helm_great", [["templar_bascinet", "Templar Bascinet"], ["choir_helm", "Choir Helm"], ["reliquary_greathelm", "Reliquary Greathelm"]]),
  ...armours("helmet", "ev_es", "coif", [["leather_coif", "Leather Coif"], ["mystic_wrap", "Mystic Headwrap"], ["veiled_coif", "Veiled Coif"]]),

  // ================= Body armour =================
  ...armours("body", "ar", "body_mail", [["riveted_jerkin", "Riveted Jerkin"], ["chain_hauberk", "Chain Hauberk"]]),
  ...armours("body", "ar", "body_plate", [["", ""], ["", ""], ["bastion_plate", "Bastion Plate", { moveInc: -2 }], ["gravewarden_plate", "Gravewarden Plate", { moveInc: -2 }]]).filter((b) => b.id),
  ...armours("body", "ev", "body_leather", [["patchwork_jerkin", "Patchwork Jerkin"], ["poacher_jerkin", "Poacher's Jerkin"]]),
  ...armours("body", "ev", "body_scale", [["", ""], ["", ""], ["scaled_hauberk", "Scaled Hauberk"], ["wyrmhide_coat", "Wyrmhide Coat"]]).filter((b) => b.id),
  ...armours("body", "es", "body_robe", [["novice_robe", "Novice Robe", { mana: 8 }], ["vesper_vestment", "Vesper Vestment", { mana: 12 }], ["occult_regalia", "Occult Regalia", { mana: 16 }], ["starweave_robe", "Starweave Robe", { mana: 22 }]]),
  ...armours("body", "ar_ev", "body_brigandine", [["mercenary_brigandine", "Mercenary Brigandine"], ["raider_lamellar", "Raider Lamellar"], ["warlord_brigandine", "Warlord Brigandine"]]),
  ...armours("body", "ar_es", "body_plate_robe", [["templar_tabard", "Templar Tabard"], ["choir_vestplate", "Choir Vestplate"], ["sanctified_plate", "Sanctified Plate"]]),
  ...armours("body", "ev_es", "body_scale_robe", [["wanderer_wrap", "Wanderer's Wrap"], ["mistscale_coat", "Mistscale Coat"], ["duskweave_raiment", "Duskweave Raiment"]]),

  // ================= Gloves =================
  ...armours("gloves", "ar", "gloves_gauntlet", [["tin_gauntlets", "Tin Gauntlets"], ["riveted_gauntlets", "Riveted Gauntlets"], ["spiked_gauntlets", "Spiked Gauntlets", { dmgFlat: 2 }], ["warden_gauntlets", "Warden Gauntlets", { dmgFlat: 3 }]]),
  ...armours("gloves", "ev", "gloves_leather", [["hide_gloves", "Hide Gloves"], ["archer_gloves", "Archer's Gloves"], ["ghostgrip_gloves", "Ghostgrip Gloves", { atkSpeedInc: 3 }], ["silkstring_gloves", "Silkstring Gloves", { atkSpeedInc: 4 }]]),
  ...armours("gloves", "es", "gloves_silk", [["linen_gloves", "Linen Gloves"], ["chanter_gloves", "Chanter's Gloves"], ["sigil_gloves", "Sigil Gloves", { spellInc: 4 }], ["astral_gloves", "Astral Gloves", { spellInc: 6 }]]),
  ...armours("gloves", "ar_ev", "gloves_wrap", [["wrapped_mitts", "Wrapped Mitts", { dmgFlat: 1 }], ["brawler_wraps", "Brawler Wraps", { dmgFlat: 2 }], ["pit_fighter_wraps", "Pit-fighter Wraps", { dmgFlat: 3 }]]),
  ...armours("gloves", "ar_es", "gloves_gauntlet", [["chapel_gauntlets", "Chapel Gauntlets"], ["oathsworn_gauntlets", "Oathsworn Gauntlets"], ["hallowed_gauntlets", "Hallowed Gauntlets"]]),
  ...armours("gloves", "ev_es", "gloves_silk", [["thief_gloves", "Thief's Gloves"], ["mistweave_gloves", "Mistweave Gloves"], ["shadowsilk_gloves", "Shadowsilk Gloves"]]),

  // ================= Boots =================
  ...armours("boots", "ar", "boots_greave", [["iron_sabatons", "Iron Sabatons"], ["march_greaves", "March Greaves"], ["fleetstride_greaves", "Fleetstride Greaves", { moveInc: 4 }], ["bastion_sabatons", "Bastion Sabatons", { moveInc: 4 }]]),
  ...armours("boots", "ev", "boots_soft", [["mudwalker_boots", "Mudwalker Boots", { moveInc: 3 }], ["tracker_boots", "Tracker Boots", { moveInc: 4 }], ["shadowstep_boots", "Shadowstep Boots", { moveInc: 5 }], ["windrunner_boots", "Windrunner Boots", { moveInc: 6 }]]),
  ...armours("boots", "es", "boots_slipper", [["cloth_slippers", "Cloth Slippers"], ["acolyte_slippers", "Acolyte Slippers"], ["silken_slippers", "Silken Slippers", { mana: 8 }], ["starwalk_slippers", "Starwalk Slippers", { mana: 12 }]]),
  ...armours("boots", "ar_ev", "boots_wrap", [["legwrap_boots", "Legwrap Boots"], ["raider_boots", "Raider Boots", { moveInc: 2 }], ["warlord_treads", "Warlord Treads", { moveInc: 3 }]]),
  ...armours("boots", "ar_es", "boots_greave", [["chapel_boots", "Chapel Boots"], ["oathsworn_greaves", "Oathsworn Greaves"], ["hallowed_greaves", "Hallowed Greaves"]]),
  ...armours("boots", "ev_es", "boots_soft", [["pilgrim_boots", "Pilgrim Boots"], ["mistwalk_boots", "Mistwalk Boots", { moveInc: 2 }], ["duskweave_boots", "Duskweave Boots", { moveInc: 3 }]]),

  // ================= Jewellery =================
  ...jewel("amulet", [
    ["knotted_cord", "Knotted Cord", 1, { regen: 0.5 }],
    ["bonecharm_pendant", "Bonecharm Pendant", 4, { life: 12 }],
    ["amber_talisman", "Amber Talisman", 7, { dmgInc: 6 }],
    ["lapis_locket", "Lapis Locket", 10, { mana: 15 }],
    ["jade_amulet", "Greenstone Amulet", 13, { atkSpeedInc: 4 }],
    ["obsidian_reliquary", "Obsidian Reliquary", 16, { life: 15, regen: 0.6 }],
  ]),
  ...jewel("ring", [
    ["tarnished_band", "Tarnished Band", 1, { dmgFlat: 1 }],
    ["glimmer_loop", "Glimmer Loop", 4, { atkSpeedInc: 4 }],
    ["garnet_ring", "Garnet Ring", 7, { life: 10 }],
    ["moonstone_ring", "Palemoon Ring", 10, { mana: 12 }],
    ["thornsteel_ring", "Thornsteel Ring", 13, { dmgFlat: 3 }],
    ["prismatic_band", "Sevenfold Band", 16, { life: 6, mana: 6, dmgFlat: 1 }],
  ]),
  // PoE2-pattern jewellery: one ring base per resistance, an all-resistance band, and amulets
  // whose implicit is the defence / resource the slot is known for (ES, mana regen, Spirit).
  ...([
    ["cinderstone_ring", "Cinderstone Ring", "ring", 5, 6, { resFire: 15 }],
    ["rimestone_ring", "Rimestone Ring", "ring", 5, 6, { resCold: 15 }],
    ["stormglass_ring", "Stormglass Ring", "ring", 5, 6, { resLight: 15 }],
    ["blightstone_ring", "Blightstone Ring", "ring", 11, 4, { resChaos: 9 }],
    ["vergestone_band", "Vergestone Band", "ring", 14, 3, { resAll: 6 }],
    ["palewater_pendant", "Palewater Pendant", "amulet", 5, 6, { manaRegen: 1.5 }],
    ["halo_torc", "Halo Torc", "amulet", 9, 5, { es: 12 }],
    ["soulflame_amulet", "Soulflame Amulet", "amulet", 12, 3, { spirit: 12 }],
  ] as [string, string, "ring" | "amulet", number, number, Imp][]).map(
    ([id, name, cls, ilvl, weight, implicit]): ItemBase => ({ id, name, cls, reqIlvl: ilvl, weight, implicit, req: { lvl: ilvl } }),
  ),

  // ================= Belts (flask slots + charm slots) =================
  { id: "rope_sash", name: "Rope Sash", cls: "belt", reqIlvl: 1, weight: 10, flaskSlots: 2, charmSlots: 1, look: "belt_rope", req: { lvl: 1 } },
  { id: "hide_belt", name: "Hide Belt", cls: "belt", reqIlvl: 4, weight: 8, flaskSlots: 2, charmSlots: 1, look: "belt_leather", req: { lvl: 4 }, implicit: { flaskRecInc: 10 } },
  { id: "studded_girdle", name: "Studded Girdle", cls: "belt", reqIlvl: 8, weight: 6, flaskSlots: 3, charmSlots: 2, look: "belt_studded", req: { lvl: 8 }, implicit: { life: 10 } },
  { id: "plated_girdle", name: "Plated Girdle", cls: "belt", reqIlvl: 12, weight: 5, flaskSlots: 3, charmSlots: 2, look: "belt_studded", req: { lvl: 12 }, implicit: { life: 18 } },
  { id: "chainlink_belt", name: "Chainlink Belt", cls: "belt", reqIlvl: 16, weight: 4, flaskSlots: 3, charmSlots: 3, look: "belt_chain", req: { lvl: 16 }, implicit: { flaskGainInc: 15 } },
  // PoE2-pattern defensive belts (stun threshold / armour implicits).
  { id: "drover_strap", name: "Drover's Strap", cls: "belt", reqIlvl: 6, weight: 6, flaskSlots: 2, charmSlots: 1, look: "belt_leather", req: { lvl: 6 }, implicit: { stunThr: 15 } },
  { id: "ironplate_cinch", name: "Ironplate Cinch", cls: "belt", reqIlvl: 10, weight: 5, flaskSlots: 3, charmSlots: 2, look: "belt_studded", req: { lvl: 10 }, implicit: { armour: 30 } },
];

export const BASE_BY_ID = new Map(BASES.map((b) => [b.id, b]));

/** Starting weapon per kind (join screen / class kits). Always a level-1 base. */
export const STARTER_WEAPONS: Record<WeaponKind, string> = {
  sword: "ruststeel_sword",
  spear: "thornwood_spear",
  axe: "woodsplitter_axe",
  dagger: "wick_knife",
  mace: "knotwood_club",
  sceptre: "acolyte_rod",
  claw: "rag_talon",
  wand: "twig_wand",
  quarterstaff: "ashpole_staff",
  staff: "gnarled_staff",
  bow: "shortbow_yew",
  crossbow: "latch_crossbow",
};

export const WEAPON_KIND_INFO: Record<WeaponKind, string> = {
  sword: "Sword: wide arc, all-rounder",
  spear: "Spear: long reach, narrow arc",
  axe: "Axe: slow, heavy hits",
  dagger: "Dagger: fast, short reach",
  mace: "Mace: slow, crushing knockback",
  sceptre: "Sceptre: mace with a caster's edge",
  claw: "Claw: fastest strikes, life regeneration",
  wand: "Wand: ranged bolts, spell damage",
  quarterstaff: "Quarterstaff: sweeping two-handed reach",
  staff: "Staff: two-handed caster weapon",
  bow: "Bow: long-range arrows",
  crossbow: "Crossbow: slow, heavy bolts",
};

// ---- helpers for other systems ----------------------------------------------------------------

/** True when the main-hand base occupies both hands. */
export function isTwoHanded(baseId: string | undefined): boolean {
  return !!(baseId && BASE_BY_ID.get(baseId)?.weapon?.twoHand);
}

/** Can this off-hand base be held next to that main-hand base? (bows take a quiver only; quivers need a bow) */
export function offhandAllowed(mainBaseId: string | undefined, offBaseId: string): boolean {
  const off = BASE_BY_ID.get(offBaseId);
  const main = mainBaseId ? BASE_BY_ID.get(mainBaseId) : undefined;
  const kind = main?.weapon?.kind;
  if (off?.sub === "quiver") return kind === "bow" || !main;
  if (main?.weapon?.twoHand) return false;
  return true;
}

/** Equip requirements check (attributes from progression's Defences). */
export function meetsRequirements(baseId: string, level: number, attrs: { str: number; dex: number; int: number }): boolean {
  const r = BASE_BY_ID.get(baseId)?.req;
  if (!r) return true;
  return level >= (r.lvl ?? 1) && attrs.str >= (r.str ?? 0) && attrs.dex >= (r.dex ?? 0) && attrs.int >= (r.int ?? 0);
}

/** Sum of base defences (armour / evasion / barrier) across equipped items, for progression. */
export function gearDefences(equip: Record<string, { b: string } | null | undefined>): { armour: number; evasion: number; barrier: number } {
  const out = { armour: 0, evasion: 0, barrier: 0 };
  for (const it of Object.values(equip)) {
    const b = it ? BASE_BY_ID.get(it.b) : undefined;
    if (!b) continue;
    out.armour += b.armour ?? 0;
    out.evasion += b.evasion ?? 0;
    out.barrier += b.barrier ?? 0;
  }
  return out;
}

/** Bases of a class (debug spawners, tests). */
export const basesOf = (cls: Exclude<ItemClass, "flask">) => BASES.filter((b) => b.cls === cls);
