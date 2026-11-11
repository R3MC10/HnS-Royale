"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/shared/biomes.ts
  var BIOMES = [
    {
      id: "hollowpine",
      name: "Hollowpine Blight",
      blurb: "A rotting forest of dead pines, choked clearings and leaning stones.",
      palette: {
        ground: "#2a2c20",
        wall: "#0b0d09",
        wallEdge: "#1a1d14",
        water: "#14181a",
        path: "#30261d",
        mapOpen: "#4a4a36",
        mapWall: "#141710",
        mapWater: "#22303a",
        tint: [0.95, 1.04, 0.9],
        ambient: "#66616e",
        fog: "#9aa58c"
      },
      wallMix: { tree: 8, rocks: 2 },
      propMix: { tree: 5, rocks: 3, ruin: 1 },
      propDensity: 2.2,
      ruinChance: 0.2,
      waterChance: 0,
      clearingScale: 1,
      pathScale: 1,
      outcrop: 0.74,
      monsters: { gnashling: 60, bog_seer: 20, cragback: 20 },
      scatter: { grave: 1, bones: 3, shrub: 5, stones: 2 }
    },
    {
      id: "gloamwater",
      name: "Gloamwater Fen",
      blurb: "A drowned lowland of black pools, reed hummocks and sunken causeways.",
      palette: {
        ground: "#262a22",
        wall: "#0a0c0b",
        wallEdge: "#182019",
        water: "#0f1a1c",
        path: "#2b2419",
        mapOpen: "#3f4636",
        mapWall: "#121510",
        mapWater: "#1c3640",
        tint: [0.88, 1, 0.98],
        ambient: "#5f6670",
        fog: "#8fb0a8"
      },
      wallMix: { tree: 5, rocks: 3 },
      propMix: { tree: 3, rocks: 3, ruin: 1 },
      propDensity: 1.6,
      ruinChance: 0.15,
      waterChance: 0.4,
      clearingScale: 1.1,
      pathScale: 1.1,
      outcrop: 0.7,
      monsters: { gnashling: 25, bog_seer: 55, cragback: 20 },
      scatter: { grave: 1, bones: 2, shrub: 4, stones: 3 }
    },
    {
      id: "brokenspire",
      name: "Brokenspire Heights",
      blurb: "Wind-scoured uplands of cliffs, fallen towers and old paved roads.",
      palette: {
        ground: "#2c2a26",
        wall: "#0c0b0c",
        wallEdge: "#211e1f",
        water: "#121619",
        path: "#34302a",
        mapOpen: "#4c4842",
        mapWall: "#161416",
        mapWater: "#24303a",
        tint: [1.04, 0.98, 0.95],
        ambient: "#6a6470",
        fog: "#a8a49c"
      },
      wallMix: { rocks: 8, ruin: 1 },
      propMix: { rocks: 4, ruin: 4, tree: 1 },
      propDensity: 2,
      ruinChance: 0.45,
      waterChance: 0,
      clearingScale: 1,
      pathScale: 0.9,
      outcrop: 0.68,
      monsters: { gnashling: 25, bog_seer: 20, cragback: 55 },
      scatter: { grave: 3, bones: 2, shrub: 1, stones: 4 }
    }
  ];
  var BIOME_BY_ID = new Map(BIOMES.map((b) => [b.id, b]));
  function biomeOf(id) {
    return id && BIOME_BY_ID.get(id) || BIOMES[0];
  }
  function pickWeighted(table, roll) {
    const entries = Object.entries(table);
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = roll * total;
    for (const [k, w] of entries) {
      r -= w;
      if (r <= 0) return k;
    }
    return entries[entries.length - 1][0];
  }

  // src/shared/content/bases.ts
  var UNARMED = {
    kind: "sword",
    damage: 8,
    range: 34,
    arcDeg: 90,
    cooldown: 0.55,
    swingTime: 0.55,
    knockback: 300,
    swingMoveMult: 0.45
  };
  var tpl = (base) => (damage, extra = {}) => ({ ...base, damage, ...extra });
  var sword = tpl({ kind: "sword", range: 62, arcDeg: 110, cooldown: 0.66, swingTime: 0.66, knockback: 480, swingMoveMult: 0.3 });
  var axe = tpl({ kind: "axe", range: 64, arcDeg: 100, cooldown: 1.05, swingTime: 1.05, knockback: 720, swingMoveMult: 0.2 });
  var mace = tpl({ kind: "mace", range: 58, arcDeg: 90, cooldown: 1, swingTime: 1, knockback: 820, swingMoveMult: 0.22 });
  var dagger = tpl({ kind: "dagger", range: 42, arcDeg: 75, cooldown: 0.44, swingTime: 0.44, knockback: 240, swingMoveMult: 0.45 });
  var claw = tpl({ kind: "claw", range: 40, arcDeg: 85, cooldown: 0.4, swingTime: 0.4, knockback: 200, swingMoveMult: 0.5 });
  var spear = tpl({ kind: "spear", range: 105, arcDeg: 40, cooldown: 0.74, swingTime: 0.74, knockback: 400, swingMoveMult: 0.3 });
  var sceptre = tpl({ kind: "sceptre", range: 56, arcDeg: 90, cooldown: 0.9, swingTime: 0.9, knockback: 600, swingMoveMult: 0.28 });
  var wand = tpl({ kind: "wand", range: 340, arcDeg: 16, cooldown: 0.62, swingTime: 0.5, knockback: 160, swingMoveMult: 0.55, ranged: true });
  var greatsword = tpl({ kind: "sword", range: 78, arcDeg: 140, cooldown: 0.95, swingTime: 0.95, knockback: 640, swingMoveMult: 0.22, twoHand: true });
  var greataxe = tpl({ kind: "axe", range: 76, arcDeg: 120, cooldown: 1.3, swingTime: 1.3, knockback: 900, swingMoveMult: 0.15, twoHand: true });
  var maul = tpl({ kind: "mace", range: 72, arcDeg: 110, cooldown: 1.35, swingTime: 1.35, knockback: 1050, swingMoveMult: 0.15, twoHand: true });
  var quarterstaff = tpl({ kind: "quarterstaff", range: 92, arcDeg: 150, cooldown: 0.72, swingTime: 0.72, knockback: 520, swingMoveMult: 0.35, twoHand: true });
  var staff = tpl({ kind: "staff", range: 80, arcDeg: 110, cooldown: 0.95, swingTime: 0.95, knockback: 500, swingMoveMult: 0.3, twoHand: true });
  var bow = tpl({ kind: "bow", range: 420, arcDeg: 14, cooldown: 0.7, swingTime: 0.55, knockback: 220, swingMoveMult: 0.5, ranged: true, twoHand: true });
  var crossbow = tpl({ kind: "crossbow", range: 380, arcDeg: 10, cooldown: 1.15, swingTime: 0.8, knockback: 420, swingMoveMult: 0.35, ranged: true, twoHand: true });
  var WEAPON_ATTR = {
    sword: [0.5, 0.5, 0],
    axe: [1, 0, 0],
    mace: [1, 0, 0],
    dagger: [0, 0.5, 0.5],
    claw: [0, 1, 0],
    spear: [0.5, 0.5, 0],
    sceptre: [0.5, 0, 0.5],
    wand: [0, 0, 1],
    greatsword: [0.6, 0.4, 0],
    greataxe: [1, 0, 0],
    maul: [1, 0, 0],
    quarterstaff: [0, 0.6, 0.4],
    staff: [0, 0, 1],
    bow: [0, 1, 0],
    crossbow: [0.4, 0.6, 0]
  };
  var reqFor = (ilvl, share) => {
    const pts = ilvl <= 1 ? 0 : Math.round(8 + ilvl * 2.6);
    const r = { lvl: Math.max(1, ilvl) };
    if (share[0]) r.str = Math.round(pts * share[0]);
    if (share[1]) r.dex = Math.round(pts * share[1]);
    if (share[2]) r.int = Math.round(pts * share[2]);
    for (const k of ["str", "dex", "int"]) if (r[k] === 0) delete r[k];
    return r;
  };
  var weightFor = (i) => [10, 8, 6, 5, 4, 3][i] ?? 3;
  function weapons(group, w, look, size2, rows) {
    return rows.map(([id, name, ilvl, dmg, imp, extra], i) => ({
      id,
      name,
      cls: "weapon",
      reqIlvl: ilvl,
      weight: weightFor(i),
      weapon: w(dmg, extra),
      look,
      size: size2,
      req: reqFor(ilvl, WEAPON_ATTR[group]),
      ...imp ? { implicit: imp } : {}
    }));
  }
  var DEF_CURVE = { ar: [40, 75, 115, 160], ev: [55, 100, 150, 210], es: [20, 38, 58, 80] };
  var SLOT_SCALE = { body: 1, helmet: 0.45, gloves: 0.35, boots: 0.35, offhand: 0.6 };
  var HYBRID_SHARE = 0.6;
  var DEF_ATTR = {
    ar: [1, 0, 0],
    ev: [0, 1, 0],
    es: [0, 0, 1],
    ar_ev: [0.5, 0.5, 0],
    ar_es: [0.5, 0, 0.5],
    ev_es: [0, 0.5, 0.5]
  };
  function defValues(def2, tier, slot) {
    const parts = def2.split("_");
    const share = parts.length > 1 ? HYBRID_SHARE : 1;
    const t4 = Math.min(tier, 3);
    const v2 = (k) => Math.round(DEF_CURVE[k][t4] * share * SLOT_SCALE[slot]);
    const out = {};
    if (parts.includes("ar")) out.armour = v2("ar");
    if (parts.includes("ev")) out.evasion = v2("ev");
    if (parts.includes("es")) out.barrier = v2("es");
    return out;
  }
  var PURE_ILVL = [1, 6, 11, 16];
  var HYBRID_ILVL = [3, 9, 15];
  function armours(cls, def2, look, rows, size2) {
    const ilvls = def2.includes("_") ? HYBRID_ILVL : PURE_ILVL;
    const scale = SLOT_SCALE[cls];
    return rows.map(([id, name, imp], i) => {
      const ilvl = ilvls[i] ?? ilvls[ilvls.length - 1];
      const tier = def2.includes("_") ? Math.min(3, i + 1) : i;
      const r = reqFor(ilvl, DEF_ATTR[def2]);
      for (const k of ["str", "dex", "int"]) if (r[k]) r[k] = Math.max(1, Math.round(r[k] * (0.5 + scale / 2)));
      return {
        id,
        name,
        cls,
        reqIlvl: ilvl,
        weight: weightFor(i),
        look,
        def: def2,
        req: r,
        ...defValues(def2, tier, cls),
        ...size2 ? { size: size2 } : {},
        ...imp ? { implicit: imp } : {}
      };
    });
  }
  var SHIELD_BLOCK = { shield_buckler: 14, shield_round: 20, shield_kite: 24, shield_tower: 30 };
  function offhands(sub3, def2, look, size2, rows, ilvls, attr) {
    return rows.map(([id, name, imp], i) => ({
      id,
      name,
      cls: "offhand",
      sub: sub3,
      reqIlvl: ilvls[i],
      weight: weightFor(i),
      look,
      size: size2,
      ...sub3 === "shield" ? { block: SHIELD_BLOCK[look] + i } : {},
      req: reqFor(ilvls[i], attr),
      ...def2 ? { def: def2, ...defValues(def2, def2.includes("_") ? Math.min(3, i + 1) : i, "offhand") } : {},
      ...imp ? { implicit: imp } : {}
    }));
  }
  var jewel = (cls, rows) => rows.map(([id, name, ilvl, implicit], i) => ({ id, name, cls, reqIlvl: ilvl, weight: weightFor(i), implicit, req: { lvl: Math.max(1, ilvl) } }));
  var BASES = [
    // ================= Weapons: one-handed melee =================
    ...weapons("sword", sword, "sword_short", [1, 3], [
      ["ruststeel_sword", "Ruststeel Sword", 1, 22],
      ["chapel_shortsword", "Chapel Shortsword", 5, 26]
    ]),
    ...weapons("sword", sword, "sword_long", [2, 3], [
      ["gallowsedge_blade", "Gallowsedge Blade", 8, 30],
      ["oathbreaker_sabre", "Oathbreaker Sabre", 12, 35, { atkSpeedInc: 4 }],
      ["vigil_longsword", "Vigil Longsword", 16, 41]
    ]),
    ...weapons("axe", axe, "axe_hand", [2, 3], [
      ["woodsplitter_axe", "Woodsplitter Axe", 1, 38],
      ["bearded_hatchet", "Bearded Hatchet", 5, 44],
      ["grievance_axe", "Grievance Axe", 8, 50],
      ["widowmaker_axe", "Widowmaker Axe", 12, 57],
      ["headsman_cleaver", "Headsman's Cleaver", 16, 66, { kbInc: 10 }]
    ]),
    ...weapons("mace", mace, "mace", [2, 3], [
      ["knotwood_club", "Knotwood Club", 1, 34],
      ["flanged_mace", "Flanged Mace", 5, 40],
      ["bellhammer", "Bellhammer", 9, 47],
      ["penitent_morningstar", "Penitent Morningstar", 13, 54],
      ["reliquary_mace", "Reliquary Mace", 17, 62, { life: 15 }]
    ]),
    ...weapons("dagger", dagger, "dagger", [1, 3], [
      ["wick_knife", "Wick Knife", 1, 13],
      ["gutting_knife", "Gutting Knife", 4, 15],
      ["moonsliver_dirk", "Moonsliver Dirk", 8, 18],
      ["mercy_stiletto", "Mercy Stiletto", 12, 21, { atkSpeedInc: 5 }],
      ["veilpiercer", "Veilpiercer", 16, 25]
    ]),
    ...weapons("claw", claw, "claw", [2, 2], [
      ["rag_talon", "Rag Talon", 1, 12, { regen: 0.4 }],
      ["hooked_grip", "Hooked Grip", 5, 14, { regen: 0.6 }],
      ["carrion_hook", "Carrion Hook", 9, 17, { regen: 0.8 }],
      ["nightjar_talons", "Nightjar Talons", 13, 20, { regen: 1 }],
      ["ravener_claw", "Ravener Claw", 17, 23, { regen: 1.3 }]
    ]),
    ...weapons("spear", spear, "spear", [1, 4], [
      ["thornwood_spear", "Thornwood Spear", 1, 20],
      ["boar_lance", "Boar Lance", 5, 23],
      ["wyrmtooth_pike", "Wyrmtooth Pike", 8, 26, void 0, { range: 114 }],
      ["harrow_partisan", "Harrow Partisan", 12, 30, void 0, { range: 116 }],
      ["skyrend_spear", "Skyrend Spear", 16, 35, void 0, { range: 120 }]
    ]),
    ...weapons("sceptre", sceptre, "sceptre", [1, 3], [
      ["acolyte_rod", "Acolyte's Rod", 1, 20, { mana: 10 }],
      ["bone_sceptre", "Bone Sceptre", 5, 23, { mana: 14 }],
      ["cinder_sceptre", "Cinder Sceptre", 9, 27, { mana: 18 }],
      ["abbess_sceptre", "Abbess Sceptre", 13, 31, { mana: 22 }],
      ["eclipse_sceptre", "Eclipse Sceptre", 17, 35, { mana: 28 }]
    ]),
    // ================= Weapons: one-handed ranged =================
    ...weapons("wand", wand, "wand", [1, 3], [
      ["twig_wand", "Twig Wand", 1, 11, { spellInc: 6 }],
      ["fingerbone_wand", "Fingerbone Wand", 5, 13, { spellInc: 9 }],
      ["ashen_wand", "Ashen Wand", 9, 15, { spellInc: 12 }],
      ["gloam_wand", "Gloam Wand", 13, 18, { spellInc: 15 }],
      ["starhook_wand", "Starhook Wand", 17, 21, { spellInc: 19 }]
    ]),
    // ================= Weapons: two-handed =================
    ...weapons("greatsword", greatsword, "greatsword", [2, 4], [
      ["pilgrim_greatblade", "Pilgrim Greatblade", 2, 40],
      ["executioner_blade", "Executioner Blade", 7, 48],
      ["cathedral_zweihander", "Cathedral Zweihander", 12, 57],
      ["dusk_claymore", "Dusk Claymore", 17, 67, { reach: 6 }]
    ]),
    ...weapons("greataxe", greataxe, "greataxe", [2, 4], [
      ["timber_greataxe", "Timber Greataxe", 2, 60],
      ["gravedigger_axe", "Gravedigger Axe", 7, 71],
      ["butcher_poleaxe", "Butcher Poleaxe", 12, 83],
      ["ruin_greataxe", "Ruin Greataxe", 17, 96]
    ]),
    ...weapons("maul", maul, "maul", [2, 4], [
      ["mallet_of_toil", "Mallet of Toil", 2, 58],
      ["anvil_maul", "Anvil Maul", 7, 69],
      ["tollbell_hammer", "Tollbell Hammer", 12, 81],
      ["sepulchre_maul", "Sepulchre Maul", 17, 95, { kbInc: 15 }]
    ]),
    ...weapons("quarterstaff", quarterstaff, "quarterstaff", [2, 4], [
      ["ashpole_staff", "Ashpole", 1, 26, { dodgeCdRed: 4 }],
      ["ironshod_pole", "Ironshod Pole", 5, 30, { dodgeCdRed: 5 }],
      ["pilgrim_quarterstaff", "Pilgrim Quarterstaff", 9, 35, { dodgeCdRed: 6 }],
      ["wardancer_staff", "Wardancer Staff", 13, 40, { dodgeCdRed: 8 }],
      ["tempest_quarterstaff", "Tempest Quarterstaff", 17, 46, { dodgeCdRed: 10 }]
    ]),
    ...weapons("staff", staff, "staff", [2, 4], [
      ["gnarled_staff", "Gnarled Staff", 1, 22, { spellInc: 10, mana: 10 }],
      ["hollow_staff", "Hollow Staff", 5, 25, { spellInc: 14, mana: 14 }],
      ["vesper_staff", "Vesper Staff", 9, 29, { spellInc: 18, mana: 18 }],
      ["occultist_staff", "Occultist Staff", 13, 33, { spellInc: 23, mana: 24 }],
      ["moonwell_staff", "Moonwell Staff", 17, 38, { spellInc: 28, mana: 30 }]
    ]),
    // ================= Weapons: two-handed ranged =================
    ...weapons("bow", bow, "bow", [2, 4], [
      ["shortbow_yew", "Yew Shortbow", 1, 18],
      ["hunter_recurve", "Hunter's Recurve", 5, 21],
      ["thornstring_bow", "Thornstring Bow", 9, 25],
      ["ravenwing_longbow", "Ravenwing Longbow", 13, 29, void 0, { range: 460 }],
      ["gallows_warbow", "Gallows Warbow", 17, 34, void 0, { range: 480 }]
    ]),
    ...weapons("crossbow", crossbow, "crossbow", [2, 3], [
      ["latch_crossbow", "Latch Crossbow", 1, 30],
      ["windlass_crossbow", "Windlass Crossbow", 5, 35],
      ["siege_arbalest", "Siege Arbalest", 9, 41],
      ["bastion_arbalest", "Bastion Arbalest", 13, 48],
      ["requiem_crossbow", "Requiem Crossbow", 17, 56]
    ]),
    // ================= Off-hand =================
    // Shields (blocking will key off def; stat sticks until then)
    ...offhands("shield", "ev", "shield_buckler", [2, 2], [
      ["hide_buckler", "Hide Buckler", { life: 15 }],
      ["studded_buckler", "Studded Buckler", { life: 20 }],
      ["duelist_buckler", "Duelist's Buckler", { life: 25, dodgeCdRed: 3 }],
      ["mirrorpoint_buckler", "Mirrorpoint Buckler", { life: 30, dodgeCdRed: 5 }]
    ], [1, 6, 11, 16], [0, 1, 0]),
    ...offhands("shield", "ar_ev", "shield_round", [2, 2], [
      ["targe_of_boughs", "Bough Targe", { life: 22 }],
      ["iron_rim_targe", "Iron-rim Targe", { life: 30 }],
      ["raider_roundshield", "Raider Roundshield", { life: 38 }]
    ], [3, 9, 15], [0.5, 0.5, 0]),
    ...offhands("shield", "ar_es", "shield_kite", [2, 3], [
      ["ironbound_ward", "Ironbound Ward", { life: 30 }],
      ["chapter_kite", "Chapter Kiteshield", { life: 38 }],
      ["seraph_crest", "Seraph Crest", { life: 46 }]
    ], [3, 9, 15], [0.5, 0, 0.5]),
    ...offhands("shield", "ar", "shield_tower", [2, 3], [
      ["plank_pavise", "Plank Pavise", { life: 25 }],
      ["rampart_shield", "Rampart Shield", { life: 35 }],
      ["bulwark_tower", "Bulwark Tower", { life: 45 }],
      ["gatekeeper_aegis", "Gatekeeper Aegis", { life: 55 }]
    ], [1, 6, 11, 16], [1, 0, 0]),
    // Foci (spellcaster off-hand)
    ...offhands("focus", "es", "focus_orb", [2, 2], [
      ["candle_focus", "Candle Focus", { mana: 12 }],
      ["glass_eye_focus", "Glass-eye Focus", { mana: 18, spellInc: 5 }],
      ["ossuary_focus", "Ossuary Focus", { mana: 24, spellInc: 8 }],
      ["nightglass_orb", "Nightglass Orb", { mana: 30, spellInc: 12 }]
    ], [1, 6, 11, 16], [0, 0, 1]),
    // Quivers (bows only)
    ...offhands("quiver", void 0, "quiver", [2, 3], [
      ["sackcloth_quiver", "Sackcloth Quiver", { dmgFlat: 2 }],
      ["fletcher_quiver", "Fletcher's Quiver", { dmgFlat: 3, atkSpeedInc: 3 }],
      ["barbed_quiver", "Barbed Quiver", { dmgFlat: 5 }],
      ["whisperfeather_quiver", "Whisperfeather Quiver", { dmgFlat: 6, atkSpeedInc: 5 }]
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
      ["jade_amulet", "Jade Amulet", 13, { atkSpeedInc: 4 }],
      ["obsidian_reliquary", "Obsidian Reliquary", 16, { life: 15, regen: 0.6 }]
    ]),
    ...jewel("ring", [
      ["tarnished_band", "Tarnished Band", 1, { dmgFlat: 1 }],
      ["glimmer_loop", "Glimmer Loop", 4, { atkSpeedInc: 4 }],
      ["garnet_ring", "Garnet Ring", 7, { life: 10 }],
      ["moonstone_ring", "Moonstone Ring", 10, { mana: 12 }],
      ["thornsteel_ring", "Thornsteel Ring", 13, { dmgFlat: 3 }],
      ["prismatic_band", "Prismatic Band", 16, { life: 6, mana: 6, dmgFlat: 1 }]
    ]),
    // ================= Belts (flask slots + charm slots) =================
    { id: "rope_sash", name: "Rope Sash", cls: "belt", reqIlvl: 1, weight: 10, flaskSlots: 2, charmSlots: 1, look: "belt_rope", req: { lvl: 1 } },
    { id: "hide_belt", name: "Hide Belt", cls: "belt", reqIlvl: 4, weight: 8, flaskSlots: 2, charmSlots: 1, look: "belt_leather", req: { lvl: 4 }, implicit: { flaskRecInc: 10 } },
    { id: "studded_girdle", name: "Studded Girdle", cls: "belt", reqIlvl: 8, weight: 6, flaskSlots: 3, charmSlots: 2, look: "belt_studded", req: { lvl: 8 }, implicit: { life: 10 } },
    { id: "plated_girdle", name: "Plated Girdle", cls: "belt", reqIlvl: 12, weight: 5, flaskSlots: 3, charmSlots: 2, look: "belt_studded", req: { lvl: 12 }, implicit: { life: 18 } },
    { id: "chainlink_belt", name: "Chainlink Belt", cls: "belt", reqIlvl: 16, weight: 4, flaskSlots: 3, charmSlots: 3, look: "belt_chain", req: { lvl: 16 }, implicit: { flaskGainInc: 15 } }
  ];
  var BASE_BY_ID = new Map(BASES.map((b) => [b.id, b]));

  // src/shared/look.ts
  var LOOK_KEYS = {
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
      "crossbow"
    ],
    belt: ["", "belt_rope", "belt_leather", "belt_studded", "belt_chain"]
  };
  var LOOK_SLOTS = ["helmet", "body", "gloves", "boots", "offhand", "weapon", "belt"];
  var B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
  var NAKED_LOOK = "0".repeat(LOOK_SLOTS.length * 2);
  var decodeCache = /* @__PURE__ */ new Map();
  function decodeLook(s) {
    const code = s && s.length === LOOK_SLOTS.length * 2 ? s : NAKED_LOOK;
    let l = decodeCache.get(code);
    if (l) return l;
    const out = {};
    const rar = {};
    LOOK_SLOTS.forEach((slot, k) => {
      const list = LOOK_KEYS[slot];
      const i = B36.indexOf(code[k * 2]);
      out[slot] = list[i > 0 && i < list.length ? i : 0];
      rar[slot] = Math.max(0, Math.min(3, Number(code[k * 2 + 1]) || 0));
    });
    out.rar = rar;
    l = out;
    if (decodeCache.size > 2e3) decodeCache.clear();
    decodeCache.set(code, l);
    return l;
  }
  function lookCode(keys, rarity = {}) {
    let s = "";
    for (const slot of LOOK_SLOTS) {
      const list = LOOK_KEYS[slot];
      const i = Math.max(0, list.indexOf(keys[slot] ?? ""));
      s += B36[i] + String(i ? rarity[slot] ?? 0 : 0);
    }
    return s;
  }

  // src/shared/constants.ts
  var TICK_RATE = 30;
  var DT = 1 / TICK_RATE;
  var MAP_W = 2400;
  var MAP_H = 2400;
  function setMapSize(w, h) {
    MAP_W = w;
    MAP_H = h;
  }
  var PLAYER_RADIUS = 20;
  var MAX_HP = 100;
  var MOVE_SPEED = 230;
  var SWING_MOVE_MULT = 0.3;
  var DODGE_SPEED = 560;
  var DODGE_TIME = 0.32;
  var DODGE_IFRAMES = 0.24;
  var DODGE_COOLDOWN = 1.1;
  var ATTACK_COOLDOWN = 0.55;
  var SWING_TIME = 0.55;
  var ATTACK_COMMIT = 0.5;
  var ATTACK_RANGE = 62;
  var ATTACK_ARC = 110 * Math.PI / 180;
  var ATTACK_DAMAGE = 22;
  var KNOCKBACK = 520;
  var MAX_MANA = 60;
  var BASE_MANA_REGEN = 2;
  var MANA_REGEN_PCT = 0.04;
  var MAX_FLASK_SLOTS = 3;
  var PICKUP_RANGE = 90;
  var MIN_PLAYERS_FOR_ROUND = 2;

  // src/shared/spatial.ts
  var StaticCircleGrid = class {
    constructor(list, w, h, cell2 = 128) {
      this.list = list;
      this.w = w;
      this.h = h;
      this.cell = cell2;
      __publicField(this, "cols");
      __publicField(this, "rows");
      __publicField(this, "maxR");
      __publicField(this, "start");
      __publicField(this, "items");
      this.cols = Math.max(1, Math.ceil(w / cell2));
      this.rows = Math.max(1, Math.ceil(h / cell2));
      let maxR = 0;
      const n2 = this.cols * this.rows;
      const counts = new Int32Array(n2 + 1);
      const cellOf = new Int32Array(list.length);
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (o.r > maxR) maxR = o.r;
        const c = this.cellIndex(o.x, o.y);
        cellOf[i] = c;
        counts[c + 1]++;
      }
      this.maxR = maxR;
      for (let i = 0; i < n2; i++) counts[i + 1] += counts[i];
      this.start = counts;
      this.items = new Int32Array(list.length);
      const fill = counts.slice(0, n2);
      for (let i = 0; i < list.length; i++) this.items[fill[cellOf[i]]++] = i;
    }
    cellIndex(x2, y2) {
      const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x2 / this.cell)));
      const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y2 / this.cell)));
      return cy * this.cols + cx;
    }
    /** Calls fn(circle, index) for every circle whose centre lies in a cell touching the rect grown by maxR. Return true to stop. */
    forRect(x0, y0, x1, y1, fn) {
      const m = this.maxR;
      const c0 = Math.max(0, Math.floor((x0 - m) / this.cell));
      const c1 = Math.min(this.cols - 1, Math.floor((x1 + m) / this.cell));
      const r0 = Math.max(0, Math.floor((y0 - m) / this.cell));
      const r12 = Math.min(this.rows - 1, Math.floor((y1 + m) / this.cell));
      const { start, items, list } = this;
      for (let cy = r0; cy <= r12; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const c = cy * this.cols + cx;
          for (let k = start[c], e = start[c + 1]; k < e; k++) {
            const i = items[k];
            if (fn(list[i], i) === true) return;
          }
        }
      }
    }
    /** Circles that may touch a circle at (x, y) with radius r (candidates; caller does the exact test). */
    forNear(x2, y2, r, fn) {
      this.forRect(x2 - r, y2 - r, x2 + r, y2 + r, fn);
    }
    /** True if a circle at (x, y, r) overlaps any circle (with extra padding). */
    overlaps(x2, y2, r, pad = 0) {
      let hit = false;
      this.forNear(x2, y2, r + pad, (o) => {
        const dx = o.x - x2;
        const dy = o.y - y2;
        const m = o.r + r + pad;
        if (dx * dx + dy * dy < m * m) {
          hit = true;
          return true;
        }
      });
      return hit;
    }
  };

  // src/shared/mapgen/noise.ts
  function mulberry32(seed2) {
    return () => {
      seed2 |= 0;
      seed2 = seed2 + 1831565813 | 0;
      let t4 = Math.imul(seed2 ^ seed2 >>> 15, 1 | seed2);
      t4 = t4 + Math.imul(t4 ^ t4 >>> 7, 61 | t4) ^ t4;
      return ((t4 ^ t4 >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashi(x2, y2, s) {
    let h = Math.imul(x2 | 0, 374761393) + Math.imul(y2 | 0, 668265263) + Math.imul(s | 0, 1274126177) | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x2, y2, s) {
    const ix = Math.floor(x2);
    const iy = Math.floor(y2);
    let fx = x2 - ix;
    let fy = y2 - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = hashi(ix, iy, s);
    const b = hashi(ix + 1, iy, s);
    const c = hashi(ix, iy + 1, s);
    const d = hashi(ix + 1, iy + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x2, y2, s) {
    return vnoise(x2, y2, s) * 0.57 + vnoise(x2 * 2.03, y2 * 2.03, s + 17) * 0.29 + vnoise(x2 * 4.1, y2 * 4.1, s + 31) * 0.14;
  }

  // src/shared/mapgen/generate.ts
  var CELL = 64;
  var OPEN = 0;
  var WALL = 1;
  var WATER = 2;
  var MAPGEN = {
    baseArea: 26e6,
    areaPerPlayer: 115e5,
    minPlayers: 2,
    maxPlayers: 20,
    clearingSpacing: 1250,
    heartRadius: 700,
    /** One monster camp per this much open ground (px²). */
    campArea: 62e4,
    campSpacing: 600,
    spawnCampClearance: 850,
    /** Wall circle radius range (must stay >= CELL * 0.708 so a circle covers its whole cell). */
    wallR: [46, 50],
    /** Player radius used by the walkability check. */
    walkerR: 20
  };
  var clamp01 = (v2) => v2 < 0 ? 0 : v2 > 1 ? 1 : v2;
  function clampPlayers(n2) {
    return Math.max(MAPGEN.minPlayers, Math.min(MAPGEN.maxPlayers, Math.round(n2) || MAPGEN.minPlayers));
  }
  function mapSideFor(players3) {
    const n2 = clampPlayers(players3);
    const side = Math.sqrt(MAPGEN.baseArea + n2 * MAPGEN.areaPerPlayer);
    return Math.round(side / CELL) * CELL;
  }
  function baseDanger(map, x2, y2) {
    const dx = x2 - map.center.x;
    const dy = y2 - map.center.y;
    return clamp01(1 - Math.sqrt(dx * dx + dy * dy) / (0.5 * Math.min(map.w, map.h) * 1.1));
  }
  var PointSet = class {
    constructor(cell2) {
      this.cell = cell2;
      __publicField(this, "b", /* @__PURE__ */ new Map());
    }
    add(x2, y2) {
      const k = Math.floor(y2 / this.cell) * 65536 + Math.floor(x2 / this.cell);
      let a = this.b.get(k);
      if (!a) this.b.set(k, a = []);
      a.push({ x: x2, y: y2 });
    }
    near(x2, y2, d) {
      const c0 = Math.floor((x2 - d) / this.cell);
      const c1 = Math.floor((x2 + d) / this.cell);
      const r0 = Math.floor((y2 - d) / this.cell);
      const r12 = Math.floor((y2 + d) / this.cell);
      const d2 = d * d;
      for (let cy = r0; cy <= r12; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const a = this.b.get(cy * 65536 + cx);
          if (!a) continue;
          for (const p of a) {
            const dx = p.x - x2;
            const dy = p.y - y2;
            if (dx * dx + dy * dy < d2) return true;
          }
        }
      }
      return false;
    }
  };
  var DIR8 = [
    [1, 0],
    [0.7071, 0.7071],
    [0, 1],
    [-0.7071, 0.7071],
    [-1, 0],
    [-0.7071, -0.7071],
    [0, -1],
    [0.7071, -0.7071]
  ];
  function generateMap(params) {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const seed2 = params.seed | 0;
    const players3 = clampPlayers(params.players);
    const biome = biomeOf(params.biome);
    const rng2 = mulberry32(seed2 ^ 1540483477);
    const S3 = (seed2 & 65535) * 7 + 3;
    const side = mapSideFor(players3);
    const w = side;
    const h = side;
    const cols = w / CELL;
    const rows = h / CELL;
    const N = cols * rows;
    const cx0 = w / 2;
    const cy0 = h / 2;
    const at2 = (i, j) => j * cols + i;
    const ccx = (i) => (i + 0.5) * CELL;
    const D = MAPGEN.clearingSpacing * biome.clearingScale;
    const margin = CELL * 9;
    const clearings = [];
    {
      const jx = (rng2() - 0.5) * w * 0.08;
      const jy = (rng2() - 0.5) * h * 0.08;
      clearings.push({ x: cx0 + jx, y: cy0 + jy, R: MAPGEN.heartRadius, lobes: [], deg: 0, danger: 1, role: "boss" });
      const target = Math.floor((w - 2 * margin) * (h - 2 * margin) / (D * D * 0.85));
      const ps = new PointSet(D);
      ps.add(clearings[0].x, clearings[0].y);
      for (let a = 0; a < target * 30 && clearings.length < target; a++) {
        const x2 = margin + rng2() * (w - 2 * margin);
        const y2 = margin + rng2() * (h - 2 * margin);
        const R8 = (300 + rng2() * 300) * biome.clearingScale;
        if (ps.near(x2, y2, D)) continue;
        if (Math.sqrt((x2 - clearings[0].x) ** 2 + (y2 - clearings[0].y) ** 2) < MAPGEN.heartRadius + D * 0.7) continue;
        const lobes = [];
        const nl = Math.floor(rng2() * 3.2);
        for (let l = 0; l < nl; l++) {
          let ux = rng2() * 2 - 1;
          let uy = rng2() * 2 - 1;
          const len = Math.sqrt(ux * ux + uy * uy) || 1;
          ux /= len;
          uy /= len;
          const d = R8 * (0.45 + rng2() * 0.35);
          lobes.push([ux * d, uy * d, R8 * (0.45 + rng2() * 0.3)]);
        }
        clearings.push({ x: x2, y: y2, R: R8, lobes, deg: 0, danger: 0, role: "none" });
        ps.add(x2, y2);
      }
    }
    const nC = clearings.length;
    const edges = [];
    {
      const inTree = new Uint8Array(nC);
      const best = new Float64Array(nC).fill(Infinity);
      const from = new Int32Array(nC).fill(-1);
      best[0] = 0;
      for (let it = 0; it < nC; it++) {
        let u = -1;
        for (let i = 0; i < nC; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
        inTree[u] = 1;
        if (from[u] >= 0) edges.push([from[u], u]);
        for (let i = 0; i < nC; i++) {
          if (inTree[i]) continue;
          const d = (clearings[i].x - clearings[u].x) ** 2 + (clearings[i].y - clearings[u].y) ** 2;
          if (d < best[i]) {
            best[i] = d;
            from[i] = u;
          }
        }
      }
      const has = new Set(edges.map(([a, b]) => a * 4096 + b).concat(edges.map(([a, b]) => b * 4096 + a)));
      for (let i = 0; i < nC; i++) {
        let bj = -1;
        let bd = Infinity;
        for (let j = 0; j < nC; j++) {
          if (j === i || has.has(i * 4096 + j)) continue;
          const d = (clearings[i].x - clearings[j].x) ** 2 + (clearings[i].y - clearings[j].y) ** 2;
          if (d < bd) {
            bd = d;
            bj = j;
          }
        }
        if (bj >= 0 && bd < (D * 1.8) ** 2 && rng2() < 0.45) {
          edges.push([i, bj]);
          has.add(i * 4096 + bj);
          has.add(bj * 4096 + i);
        }
      }
      for (const [a, b] of edges) {
        clearings[a].deg++;
        clearings[b].deg++;
      }
    }
    const val = new Float32Array(N).fill(-1e9);
    const core = new Uint8Array(N);
    clearings.forEach((c, ci) => {
      let ext = c.R * 1.45;
      for (const [lx, ly, lr] of c.lobes) ext = Math.max(ext, Math.sqrt(lx * lx + ly * ly) + lr * 1.45);
      const i0 = Math.max(0, Math.floor((c.x - ext) / CELL));
      const i1 = Math.min(cols - 1, Math.floor((c.x + ext) / CELL));
      const j0 = Math.max(0, Math.floor((c.y - ext) / CELL));
      const j1 = Math.min(rows - 1, Math.floor((c.y + ext) / CELL));
      const ns = S3 + 101 + ci * 13;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x2 = ccx(i);
          const y2 = ccx(j);
          const d = Math.sqrt((x2 - c.x) ** 2 + (y2 - c.y) ** 2);
          const nz = 0.68 + 0.62 * fbm(x2 / 330, y2 / 330, ns);
          let v2 = c.R * nz - d;
          for (const [lx, ly, lr] of c.lobes) {
            const dl = Math.sqrt((x2 - c.x - lx) ** 2 + (y2 - c.y - ly) ** 2);
            v2 = Math.max(v2, lr * nz - dl);
          }
          const k = at2(i, j);
          if (v2 > val[k]) val[k] = v2;
          if (d < c.R * 0.42) core[k] = 1;
        }
      }
    });
    edges.forEach(([a, b], ei) => {
      const A2 = clearings[a];
      const B = clearings[b];
      let pts = [[A2.x, A2.y], [B.x, B.y]];
      for (let lvl = 0; lvl < 3; lvl++) {
        const out = [pts[0]];
        for (let s = 0; s < pts.length - 1; s++) {
          const [ax, ay] = pts[s];
          const [bx, by] = pts[s + 1];
          const dx = bx - ax;
          const dy = by - ay;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const off = (rng2() - 0.5) * 0.42 * len;
          out.push([(ax + bx) / 2 + -dy / len * off, (ay + by) / 2 + dx / len * off]);
          out.push(pts[s + 1]);
        }
        pts = out;
      }
      let along = 0;
      const es = S3 + 500 + ei * 7;
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, ay] = pts[s];
        const [bx, by] = pts[s + 1];
        const len = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
        const steps = Math.max(1, Math.ceil(len / 24));
        for (let k = 0; k <= steps; k++) {
          const t4 = k / steps;
          const px = ax + (bx - ax) * t4;
          const py = ay + (by - ay) * t4;
          const a2 = along + len * t4;
          const nn = vnoise(a2 / 260, 0.5, es);
          const hw = CELL * biome.pathScale * (nn < 0.2 ? 1.3 : 1.5 + (nn - 0.2) * 2.6);
          const ext = hw + CELL;
          const i0 = Math.max(0, Math.floor((px - ext) / CELL));
          const i1 = Math.min(cols - 1, Math.floor((px + ext) / CELL));
          const j0 = Math.max(0, Math.floor((py - ext) / CELL));
          const j1 = Math.min(rows - 1, Math.floor((py + ext) / CELL));
          for (let j = j0; j <= j1; j++) {
            for (let i = i0; i <= i1; i++) {
              const d = Math.sqrt((ccx(i) - px) ** 2 + (ccx(j) - py) ** 2);
              const kk = at2(i, j);
              const v2 = hw - d;
              if (v2 > val[kk]) val[kk] = v2;
              if (d < Math.max(hw * 0.55, CELL * 1.05)) core[kk] = 1;
            }
          }
        }
        along += len;
      }
    });
    let solid = new Uint8Array(N);
    for (let k = 0; k < N; k++) solid[k] = val[k] > 0 ? OPEN : WALL;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = at2(i, j);
        if (solid[k] !== OPEN || core[k]) continue;
        if (fbm(ccx(i) / 210, ccx(j) / 210, S3 + 77) > biome.outcrop) solid[k] = WALL;
      }
    }
    if (biome.waterChance > 0) {
      for (let k = 0; k < N; k++) {
        const i = k % cols;
        const j = (k - i) / cols;
        const x2 = ccx(i);
        const y2 = ccx(j);
        if (solid[k] === OPEN) {
          if (!core[k] && fbm(x2 / 260, y2 / 260, S3 + 9) > 0.7) solid[k] = WATER;
        } else if (fbm(x2 / 640, y2 / 640, S3 + 5) < biome.waterChance) solid[k] = WATER;
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const e = Math.min(i, j, cols - 1 - i, rows - 1 - j);
        const thick = 3 + Math.floor(vnoise(i / 5 + j / 5, (i - j) / 7, S3 + 3) * 5);
        if (e < thick) {
          solid[at2(i, j)] = WALL;
          core[at2(i, j)] = 0;
        }
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      const next = solid.slice();
      for (let j = 1; j < rows - 1; j++) {
        for (let i = 1; i < cols - 1; i++) {
          const k = at2(i, j);
          let blocked = 0;
          let water = 0;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              if (!di && !dj) continue;
              const s = solid[k + dj * cols + di];
              if (s !== OPEN) blocked++;
              if (s === WATER) water++;
            }
          }
          if (solid[k] === OPEN && blocked >= 5 && !core[k]) next[k] = water * 2 > blocked ? WATER : WALL;
          else if (solid[k] !== OPEN && blocked <= 2 && Math.min(i, j, cols - 1 - i, rows - 1 - j) >= 3) next[k] = OPEN;
        }
      }
      solid = next;
    }
    const BW = cols - 1;
    const BN = (cols - 1) * (rows - 1);
    const blockOk = (b) => {
      const i = b % BW;
      const j = (b - i) / BW;
      const k = at2(i, j);
      return solid[k] === OPEN && solid[k + 1] === OPEN && solid[k + cols] === OPEN && solid[k + cols + 1] === OPEN;
    };
    const enforce2x2 = () => {
      for (let it = 0; it < 6; it++) {
        let changed = 0;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const k = at2(i, j);
            if (solid[k] !== OPEN) continue;
            let ok = false;
            for (let dj = -1; dj <= 0 && !ok; dj++) {
              for (let di = -1; di <= 0 && !ok; di++) {
                const bi = i + di;
                const bj = j + dj;
                if (bi < 0 || bj < 0 || bi >= cols - 1 || bj >= rows - 1) continue;
                if (blockOk(bj * BW + bi)) ok = true;
              }
            }
            if (!ok) {
              solid[k] = WALL;
              changed++;
            }
          }
        }
        if (!changed) break;
      }
    };
    const label = new Int32Array(BN);
    const queue2 = new Int32Array(Math.max(N, BN));
    let compSizes = [];
    const labelBlocks = () => {
      label.fill(-1);
      compSizes = [];
      for (let b0 = 0; b0 < BN; b0++) {
        if (label[b0] >= 0 || !blockOk(b0)) continue;
        const id = compSizes.length;
        let qh = 0;
        let qt = 0;
        queue2[qt++] = b0;
        label[b0] = id;
        let size2 = 0;
        while (qh < qt) {
          const b = queue2[qh++];
          size2++;
          const i = b % BW;
          const j = (b - i) / BW;
          const nb = [i > 0 ? b - 1 : -1, i < BW - 1 ? b + 1 : -1, j > 0 ? b - BW : -1, j < rows - 2 ? b + BW : -1];
          for (const n2 of nb) {
            if (n2 < 0 || label[n2] >= 0 || !blockOk(n2)) continue;
            label[n2] = id;
            queue2[qt++] = n2;
          }
        }
        compSizes.push(size2);
      }
    };
    const mainCells = (comp) => {
      const m = new Uint8Array(N);
      for (let b = 0; b < BN; b++) {
        if (label[b] !== comp) continue;
        const i = b % BW;
        const j = (b - i) / BW;
        const k = at2(i, j);
        m[k] = m[k + 1] = m[k + cols] = m[k + cols + 1] = 1;
      }
      return m;
    };
    const prev = new Int32Array(N);
    const carveToMain = (comp, main) => {
      prev.fill(-2);
      let qh = 0;
      let qt = 0;
      for (let b = 0; b < BN; b++) {
        if (label[b] !== comp) continue;
        const i = b % BW;
        const j = (b - i) / BW;
        const k = at2(i, j);
        if (prev[k] === -2) {
          prev[k] = -1;
          queue2[qt++] = k;
        }
      }
      let hit = -1;
      while (qh < qt && hit < 0) {
        const k = queue2[qh++];
        const i = k % cols;
        const j = (k - i) / cols;
        const nb = [i > 3 ? k - 1 : -1, i < cols - 4 ? k + 1 : -1, j > 3 ? k - cols : -1, j < rows - 4 ? k + cols : -1];
        for (const n2 of nb) {
          if (n2 < 0 || prev[n2] !== -2) continue;
          prev[n2] = k;
          if (main[n2]) {
            hit = n2;
            break;
          }
          queue2[qt++] = n2;
        }
      }
      for (let k = hit; k >= 0; k = prev[k]) {
        const i = k % cols;
        const j = (k - i) / cols;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) solid[at2(i + di, j + dj)] = OPEN;
      }
    };
    enforce2x2();
    for (let iter = 0; iter < 12; iter++) {
      labelBlocks();
      let mainC = 0;
      for (let c = 1; c < compSizes.length; c++) if (compSizes[c] > compSizes[mainC]) mainC = c;
      const big = compSizes.map((s, c) => c !== mainC && s >= 10 ? c : -1).filter((c) => c >= 0);
      if (!big.length) {
        const m2 = mainCells(mainC);
        for (let k = 0; k < N; k++) if (solid[k] === OPEN && !m2[k]) solid[k] = WALL;
        break;
      }
      const m = mainCells(mainC);
      for (const c of big) carveToMain(c, m);
      enforce2x2();
    }
    const clear = new Uint8Array(N);
    {
      const dist = new Int32Array(N).fill(-1);
      let qh = 0;
      let qt = 0;
      for (let k = 0; k < N; k++) {
        if (solid[k] !== OPEN) {
          dist[k] = 0;
          queue2[qt++] = k;
        }
      }
      while (qh < qt) {
        const k = queue2[qh++];
        const i = k % cols;
        const j = (k - i) / cols;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
            const n2 = nj * cols + ni;
            if (dist[n2] >= 0) continue;
            dist[n2] = dist[k] + 1;
            queue2[qt++] = n2;
          }
        }
      }
      for (let k = 0; k < N; k++) clear[k] = Math.min(255, dist[k] < 0 ? 255 : dist[k]);
    }
    const nearestOpen = new Int32Array(N).fill(-1);
    {
      let qh = 0;
      let qt = 0;
      const seen = new Uint8Array(N);
      for (let k = 0; k < N; k++) {
        if (solid[k] === OPEN) {
          seen[k] = 1;
          nearestOpen[k] = k;
          queue2[qt++] = k;
        }
      }
      while (qh < qt) {
        const k = queue2[qh++];
        const i = k % cols;
        const j = (k - i) / cols;
        const nb = [i > 0 ? k - 1 : -1, i < cols - 1 ? k + 1 : -1, j > 0 ? k - cols : -1, j < rows - 1 ? k + cols : -1];
        for (const n2 of nb) {
          if (n2 < 0 || seen[n2]) continue;
          seen[n2] = 1;
          nearestOpen[n2] = nearestOpen[k];
          queue2[qt++] = n2;
        }
      }
      for (let k = 0; k < N; k++) if (solid[k] === OPEN) nearestOpen[k] = -1;
    }
    let openCells = 0;
    for (let k = 0; k < N; k++) if (solid[k] === OPEN) openCells++;
    const openArea = openCells * CELL * CELL;
    const cellOf = (x2, y2) => {
      const i = Math.floor(x2 / CELL);
      const j = Math.floor(y2 / CELL);
      if (i < 0 || j < 0 || i >= cols || j >= rows) return -1;
      return j * cols + i;
    };
    const clearAt = (x2, y2) => {
      const k = cellOf(x2, y2);
      return k < 0 ? 0 : clear[k];
    };
    const center2 = { x: clearings[0].x, y: clearings[0].y };
    const dangerAt = (x2, y2) => baseDanger({ w, h, center: center2 }, x2, y2);
    for (const c of clearings) {
      let bk = -1;
      let bs = -Infinity;
      const ci = Math.floor(c.x / CELL);
      const cj = Math.floor(c.y / CELL);
      for (let dj = -6; dj <= 6; dj++) {
        for (let di = -6; di <= 6; di++) {
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
          const k = at2(i, j);
          if (solid[k] !== OPEN) continue;
          const s = Math.min(clear[k], 6) * 10 - (di * di + dj * dj);
          if (s > bs) {
            bs = s;
            bk = k;
          }
        }
      }
      if (bk < 0 || clear[bk] < 2) {
        c.role = "dead";
        continue;
      }
      c.x = ccx(bk % cols);
      c.y = ccx(Math.floor(bk / cols));
      c.danger = Math.max(c.danger, dangerAt(c.x, c.y));
    }
    center2.x = clearings[0].x;
    center2.y = clearings[0].y;
    const pois = [];
    const addPoi = (kind2, x2, y2, r, danger) => {
      const p = { id: pois.length, kind: kind2, x: Math.round(x2), y: Math.round(y2), r, danger: Math.round(danger * 100) / 100 };
      pois.push(p);
      return p;
    };
    const live2 = clearings.filter((c) => c.role !== "dead");
    for (const c of live2) {
      if (c.role === "none" && c.deg === 1 && c.danger < 0.6 && rng2() < 0.55) {
        c.role = "lair";
        c.danger = Math.min(1, c.danger + 0.35);
      }
    }
    const farthest = (cands, count, minD, avoid, avoidD) => {
      const chosen = [];
      const pool = cands.filter((c) => avoid.every((a) => (a.x - c.x) ** 2 + (a.y - c.y) ** 2 >= avoidD * avoidD));
      if (!pool.length) return chosen;
      let first = pool[0];
      for (const c of pool) if ((c.x - center2.x) ** 2 + (c.y - center2.y) ** 2 > (first.x - center2.x) ** 2 + (first.y - center2.y) ** 2) first = c;
      chosen.push(first);
      while (chosen.length < count) {
        let best = null;
        let bd = -1;
        for (const c of pool) {
          if (chosen.includes(c)) continue;
          let md = Infinity;
          for (const o of chosen) md = Math.min(md, (o.x - c.x) ** 2 + (o.y - c.y) ** 2);
          if (md > bd) {
            bd = md;
            best = c;
          }
        }
        if (!best || bd < minD * minD) break;
        chosen.push(best);
      }
      return chosen;
    };
    const spawnWant = Math.max(8, Math.min(40, players3 * 2));
    let spawnCands = live2.filter((c) => c.role === "none" && c.danger < 0.6);
    if (spawnCands.length < spawnWant) spawnCands = live2.filter((c) => c.role === "none" || c.role === "lair");
    const spawnCl = farthest(spawnCands, spawnWant, 800, [], 0);
    for (const c of spawnCl) c.role = "spawn";
    const trialWant = 3 + Math.round(3 * (players3 - MAPGEN.minPlayers) / (MAPGEN.maxPlayers - MAPGEN.minPlayers));
    let trialCands = live2.filter((c) => c.role === "none" && c.danger >= 0.25 && c.danger <= 0.85);
    if (trialCands.length < trialWant) trialCands = live2.filter((c) => c.role === "none");
    const trialCl = farthest(trialCands, trialWant, 0, spawnCl, 700);
    for (const c of trialCl) c.role = "trial";
    for (const c of live2) if (c.role === "none" && rng2() < biome.ruinChance) c.role = "ruin";
    const heart = clearings[0];
    addPoi("boss", heart.x, heart.y, 420, 1);
    for (const c of spawnCl) addPoi("spawn", c.x, c.y, 260, c.danger);
    for (const c of trialCl) addPoi("trial", c.x, c.y, 240, c.danger);
    for (const c of live2) {
      if (c.role === "ruin") addPoi("ruin", c.x, c.y, 120, c.danger);
      if (c.role === "lair") addPoi("lair", c.x, c.y, 200, c.danger);
    }
    const obstacles = [];
    const reserved = [];
    const isReserved2 = (x2, y2, r) => reserved.some((q) => (q.x - x2) ** 2 + (q.y - y2) ** 2 < (q.r + r) ** 2);
    for (const p of pois) reserved.push({ x: p.x, y: p.y, r: p.kind === "ruin" ? 40 : p.r });
    obstacles.push({ x: heart.x, y: heart.y, r: 52, k: "shrine", v: 0 });
    const camps2 = [];
    const campSet = new PointSet(MAPGEN.campSpacing);
    const spawnSet = new PointSet(MAPGEN.spawnCampClearance);
    for (const c of spawnCl) spawnSet.add(c.x, c.y);
    const trialSet = new PointSet(400);
    for (const c of trialCl) trialSet.add(c.x, c.y);
    const addCamp = (x2, y2, tier) => {
      camps2.push({ id: camps2.length, x: Math.round(x2), y: Math.round(y2), tier, danger: Math.round(dangerAt(x2, y2) * 100) / 100 });
      campSet.add(x2, y2);
      reserved.push({ x: x2, y: y2, r: 210 });
    };
    for (const [dx, dy] of DIR8) {
      const x2 = heart.x + dx * 300;
      const y2 = heart.y + dy * 300;
      if (clearAt(x2, y2) >= 3) {
        addCamp(x2, y2, 2);
        break;
      }
    }
    for (const c of live2) if (c.role === "lair") addCamp(c.x, c.y, 1);
    {
      const want = Math.max(8, Math.round(openArea / MAPGEN.campArea));
      const cand = [];
      for (let k = 0; k < N; k++) if (solid[k] === OPEN && clear[k] >= 3) cand.push(k);
      for (let i = cand.length - 1; i > 0; i--) {
        const j = Math.floor(rng2() * (i + 1));
        const t4 = cand[i];
        cand[i] = cand[j];
        cand[j] = t4;
      }
      for (const k of cand) {
        if (camps2.length >= want) break;
        const x2 = ccx(k % cols) + (rng2() - 0.5) * 32;
        const y2 = ccx(Math.floor(k / cols)) + (rng2() - 0.5) * 32;
        if (campSet.near(x2, y2, MAPGEN.campSpacing)) continue;
        if (spawnSet.near(x2, y2, MAPGEN.spawnCampClearance)) continue;
        if (trialSet.near(x2, y2, 380)) continue;
        const dg2 = dangerAt(x2, y2);
        addCamp(x2, y2, dg2 > 0.68 && rng2() < 0.55 ? 1 : 0);
      }
    }
    const chestSet = new PointSet(300);
    const addChest = (x2, y2, danger) => {
      if (chestSet.near(x2, y2, 300)) return;
      chestSet.add(x2, y2);
      addPoi("chest", x2, y2, 60, danger);
    };
    for (const cp of camps2) {
      if (cp.tier >= 1) {
        for (const [dx, dy] of DIR8) {
          const x2 = cp.x + dx * 110;
          const y2 = cp.y + dy * 110;
          if (clearAt(x2, y2) >= 2) {
            addChest(x2, y2, cp.danger);
            break;
          }
        }
      }
    }
    {
      const wantBuff = 3 + Math.round(5 * (players3 - 2) / 18);
      const buffGap = side / (1.6 * Math.sqrt(wantBuff));
      const buffSet = new PointSet(500);
      const order = camps2.filter((cp) => cp.tier === 0);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng2() * (i + 1));
        const t4 = order[i];
        order[i] = order[j];
        order[j] = t4;
      }
      let placed = 0;
      for (const gap of [buffGap, buffGap * 0.6, 0]) {
        for (const cp of order) {
          if (placed >= wantBuff) break;
          if (spawnSet.near(cp.x, cp.y, 1100) || gap > 0 && buffSet.near(cp.x, cp.y, gap) || buffSet.near(cp.x, cp.y, 1)) continue;
          for (const [dx, dy] of DIR8) {
            const x2 = cp.x - dx * 120;
            const y2 = cp.y - dy * 120;
            if (clearAt(x2, y2) >= 2) {
              addPoi("buff", x2, y2, 60, cp.danger);
              reserved.push({ x: x2, y: y2, r: 60 });
              buffSet.add(cp.x, cp.y);
              placed++;
              break;
            }
          }
        }
      }
    }
    for (const p of pois.filter((q) => q.kind === "ruin")) addChest(p.x, p.y, p.danger);
    const propSet = new PointSet(200);
    const propFree = (x2, y2, r, gap) => {
      const cl = clearAt(x2, y2);
      if (cl * CELL - CELL / 2 < r + 90) return false;
      return !propSet.near(x2, y2, r + 70 + gap);
    };
    for (const p of pois) {
      if (p.kind !== "ruin") continue;
      const n2 = 3 + Math.floor(rng2() * 3);
      for (let a = 0, placed = 0; a < 24 && placed < n2; a++) {
        let ux = rng2() * 2 - 1;
        let uy = rng2() * 2 - 1;
        const l = Math.sqrt(ux * ux + uy * uy);
        if (l < 0.3 || l > 1) continue;
        ux /= l;
        uy /= l;
        const d = 110 + rng2() * 140;
        const r = 34 + rng2() * 22;
        const x2 = p.x + ux * d;
        const y2 = p.y + uy * d;
        if (!propFree(x2, y2, r, 0) || isReserved2(x2, y2, r + 10)) continue;
        obstacles.push({ x: x2, y: y2, r, k: "ruin", v: Math.floor(rng2() * 8) });
        propSet.add(x2, y2);
        placed++;
      }
    }
    {
      const want = Math.round(openArea / 1e6 * biome.propDensity);
      for (let a = 0, placed = 0; a < want * 12 && placed < want; a++) {
        const k = Math.floor(rng2() * N);
        if (solid[k] !== OPEN || clear[k] < 3) continue;
        const x2 = ccx(k % cols) + (rng2() - 0.5) * CELL;
        const y2 = ccx(Math.floor(k / cols)) + (rng2() - 0.5) * CELL;
        const r = 28 + rng2() * 40;
        if (!propFree(x2, y2, r, 30) || isReserved2(x2, y2, r)) continue;
        obstacles.push({ x: x2, y: y2, r, k: pickWeighted(biome.propMix, rng2()), v: Math.floor(rng2() * 8) });
        propSet.add(x2, y2);
        placed++;
      }
    }
    const [wr0, wr1] = MAPGEN.wallR;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = at2(i, j);
        if (solid[k] === OPEN) continue;
        let near1 = false;
        let near2 = false;
        for (let dj = -2; dj <= 2; dj++) {
          for (let di = -2; di <= 2; di++) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
            if (solid[nj * cols + ni] !== OPEN) continue;
            if (di >= -1 && di <= 1 && dj >= -1 && dj <= 1) near1 = true;
            else near2 = true;
          }
        }
        const water = solid[k] === WATER;
        const hv2 = hashi(i, j, S3 + 11);
        if (near1) {
          obstacles.push({
            x: ccx(i),
            y: ccx(j),
            r: wr0 + hv2 * (wr1 - wr0),
            k: water ? "water" : pickWeighted(biome.wallMix, hashi(i, j, S3 + 12)),
            v: Math.floor(hashi(i, j, S3 + 13) * 8),
            wall: true
          });
        } else if (near2 && !water && hv2 < 0.7) {
          obstacles.push({
            x: ccx(i) + (hashi(i, j, S3 + 14) - 0.5) * 24,
            y: ccx(j) + (hashi(i, j, S3 + 15) - 0.5) * 24,
            r: 40 + hashi(i, j, S3 + 16) * 16,
            k: pickWeighted(biome.wallMix, hashi(i, j, S3 + 12)),
            v: Math.floor(hashi(i, j, S3 + 13) * 8),
            wall: true
          });
        }
      }
    }
    const spawns = spawnCl.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) }));
    const map = {
      params: { seed: seed2, players: players3, biome: biome.id },
      seed: seed2,
      players: players3,
      biome,
      w,
      h,
      cell: CELL,
      cols,
      rows,
      solid,
      clear,
      nearestOpen,
      obstacles,
      grid: new StaticCircleGrid(obstacles, w, h, 128),
      pois,
      camps: camps2,
      spawns,
      center: center2,
      openArea,
      genMs: 0
    };
    for (let pass = 0; pass < 3; pass++) {
      const r = reachability(map);
      if (!r.blockers.size) break;
      map.obstacles = map.obstacles.filter((_, i) => !r.blockers.has(i));
      map.grid = new StaticCircleGrid(map.obstacles, w, h, 128);
    }
    map.genMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    return map;
  }
  function reachability(map, step = 32) {
    const R8 = MAPGEN.walkerR;
    const sc = Math.ceil(map.w / step);
    const sr = Math.ceil(map.h / step);
    const walk = new Uint8Array(sc * sr);
    const openS = new Uint8Array(sc * sr);
    const cellOf = (x2, y2) => Math.floor(y2 / map.cell) * map.cols + Math.floor(x2 / map.cell);
    for (let j = 0; j < sr; j++) {
      for (let i = 0; i < sc; i++) {
        const x2 = (i + 0.5) * step;
        const y2 = (j + 0.5) * step;
        if (x2 >= map.w || y2 >= map.h || map.solid[cellOf(x2, y2)] !== OPEN) continue;
        openS[j * sc + i] = 1;
        if (!map.grid.overlaps(x2, y2, R8)) walk[j * sc + i] = 1;
      }
    }
    const seen = new Uint8Array(sc * sr);
    const q = new Int32Array(sc * sr);
    let qh = 0;
    let qt = 0;
    const startPt = map.spawns[0] ?? map.center;
    let s0 = -1;
    for (let rad4 = 0; rad4 < 12 && s0 < 0; rad4++) {
      const ci = Math.floor(startPt.x / step);
      const cj = Math.floor(startPt.y / step);
      for (let dj = -rad4; dj <= rad4 && s0 < 0; dj++) {
        for (let di = -rad4; di <= rad4; di++) {
          const i = ci + di;
          const j = cj + dj;
          if (i >= 0 && j >= 0 && i < sc && j < sr && walk[j * sc + i]) {
            s0 = j * sc + i;
            break;
          }
        }
      }
    }
    if (s0 >= 0) {
      seen[s0] = 1;
      q[qt++] = s0;
    }
    while (qh < qt) {
      const k = q[qh++];
      const i = k % sc;
      const j = (k - i) / sc;
      const nb = [i > 0 ? k - 1 : -1, i < sc - 1 ? k + 1 : -1, j > 0 ? k - sc : -1, j < sr - 1 ? k + sc : -1];
      for (const n2 of nb) {
        if (n2 < 0 || seen[n2] || !walk[n2]) continue;
        seen[n2] = 1;
        q[qt++] = n2;
      }
    }
    let open = 0;
    let reach = 0;
    const blockers = /* @__PURE__ */ new Set();
    for (let k = 0; k < sc * sr; k++) {
      if (!openS[k]) continue;
      open++;
      if (seen[k]) {
        reach++;
        continue;
      }
      if (!walk[k]) continue;
      const i = k % sc;
      const j = (k - i) / sc;
      const x2 = (i + 0.5) * step;
      const y2 = (j + 0.5) * step;
      map.grid.forNear(x2, y2, 140, (o, oi) => {
        if (!o.wall) blockers.add(oi);
      });
    }
    const reachAt = (x2, y2) => {
      const ci = Math.floor(x2 / step);
      const cj = Math.floor(y2 / step);
      for (let dj = -3; dj <= 3; dj++) {
        for (let di = -3; di <= 3; di++) {
          const i = ci + di;
          const j = cj + dj;
          if (i >= 0 && j >= 0 && i < sc && j < sr && seen[j * sc + i]) return true;
        }
      }
      return false;
    };
    const unreachable = [];
    map.spawns.forEach((p, i) => reachAt(p.x, p.y) || unreachable.push(`spawn${i}`));
    map.camps.forEach((p) => reachAt(p.x, p.y) || unreachable.push(`camp${p.id}`));
    map.pois.forEach((p) => reachAt(p.x, p.y) || unreachable.push(`${p.kind}${p.id}`));
    let pockets = 0;
    for (let k = 0; k < sc * sr; k++) if (walk[k] && !seen[k]) pockets++;
    return { openSamples: open, reachable: reach, frac: open ? reach / open : 0, pockets, unreachable, blockers };
  }

  // src/shared/map.ts
  var OBSTACLES = [];
  var current;
  var version = 0;
  var listeners = [];
  function setMap(params) {
    if (current && current.seed === (params.seed | 0) && current.params.players === params.players && current.params.biome === (params.biome ?? current.params.biome)) {
      return current;
    }
    const m = generateMap(params);
    install(m);
    return m;
  }
  function install(m) {
    current = m;
    version++;
    OBSTACLES.length = 0;
    for (const o of m.obstacles) OBSTACLES.push(o);
    setMapSize(m.w, m.h);
    for (const fn of listeners) fn(m);
  }
  function currentMap() {
    return current;
  }
  function onMapChange(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }
  function currentBiome() {
    return current.biome;
  }
  function cellIndexAt(x2, y2) {
    const m = current;
    const i = Math.floor(x2 / CELL);
    const j = Math.floor(y2 / CELL);
    if (i < 0 || j < 0 || i >= m.cols || j >= m.rows) return -1;
    return j * m.cols + i;
  }
  function cellKindAt(x2, y2) {
    const k = cellIndexAt(x2, y2);
    return k < 0 ? 1 : current.solid[k];
  }
  function isWalkable(x2, y2, r, pad = 0) {
    if (cellKindAt(x2, y2) !== OPEN) return false;
    return !current.grid.overlaps(x2, y2, r, pad);
  }
  function getPois(kind2) {
    return kind2 ? current.pois.filter((p) => p.kind === kind2) : current.pois;
  }
  function getCampSpots() {
    return current.camps;
  }
  install(generateMap({ seed: 1337, players: 2, biome: "hollowpine" }));

  // src/shared/stats.ts
  function defaultStats() {
    return {
      maxHp: MAX_HP,
      moveSpeed: MOVE_SPEED,
      swingMoveMult: SWING_MOVE_MULT,
      attackDamage: ATTACK_DAMAGE,
      attackRange: ATTACK_RANGE,
      attackArc: ATTACK_ARC,
      attackCooldown: ATTACK_COOLDOWN,
      swingTime: SWING_TIME,
      knockback: KNOCKBACK,
      dodgeSpeed: DODGE_SPEED,
      dodgeTime: DODGE_TIME,
      dodgeIframes: DODGE_IFRAMES,
      dodgeCooldown: DODGE_COOLDOWN,
      lifeRegen: 0,
      flaskChargeGain: 1,
      flaskRecovery: 1,
      flaskSlots: 1,
      maxMana: MAX_MANA,
      manaRegen: BASE_MANA_REGEN + MAX_MANA * MANA_REGEN_PCT,
      spellMult: 1,
      castSpeed: 1,
      spirit: 0,
      armour: 0,
      evasion: 0,
      energyShield: 0,
      esFasterStart: 0,
      blockChance: 0,
      resFire: 0,
      resCold: 0,
      resLight: 0,
      resChaos: 0,
      maxRes: 0,
      accuracy: 200,
      ailmentThreshold: 0,
      stunThreshold: 0
    };
  }
  var DEFAULT_STATS = Object.freeze(defaultStats());
  var STAT_KEYS = Object.keys(DEFAULT_STATS);

  // src/client/gfx/iso.ts
  var K = 1.1;
  var SQ = 0.62;
  var HZ = 0.8;
  var C = Math.SQRT1_2;
  var ART = K / C;
  function isoX(x2, y2) {
    return (x2 - y2) * C * K;
  }
  function isoY(x2, y2) {
    return (x2 + y2) * C * K * SQ;
  }
  function unproject(sx, sy) {
    const a = sx / (C * K);
    const b = sy / (C * K * SQ);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }
  function screenAngle(worldAngle) {
    const cx = Math.cos(worldAngle);
    const cy = Math.sin(worldAngle);
    return Math.atan2((cx + cy) * SQ, cx - cy);
  }
  var DIRS = 16;
  function dirN(worldAngle, n2 = DIRS) {
    const a = screenAngle(worldAngle);
    return (Math.round(a / (Math.PI * 2 / n2)) % n2 + n2) % n2;
  }
  function dir8(worldAngle) {
    return dirN(worldAngle, 8);
  }
  function dirToWorldAngle(d, n2 = 8) {
    const a = d * Math.PI * 2 / n2;
    const w = unproject(Math.cos(a), Math.sin(a));
    return Math.atan2(w.y, w.x);
  }
  function depthOf(x2, y2) {
    return x2 + y2;
  }

  // src/client/gfx/pixel.ts
  function rgba(hex, a = 255) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (a << 24 | b << 16 | g << 8 | r) >>> 0;
  }
  function unpack(c) {
    return [c & 255, c >>> 8 & 255, c >>> 16 & 255, c >>> 24];
  }
  function pack(r, g, b, a = 255) {
    return (a << 24 | Math.max(0, Math.min(255, b)) << 16 | Math.max(0, Math.min(255, g)) << 8 | Math.max(0, Math.min(255, r))) >>> 0;
  }
  function scaleColor(c, f) {
    const [r, g, b, a] = unpack(c);
    return pack(Math.round(r * f), Math.round(g * f), Math.round(b * f), a);
  }
  function mixColor(c1, c2, t4) {
    const a = unpack(c1);
    const b = unpack(c2);
    return pack(
      Math.round(a[0] + (b[0] - a[0]) * t4),
      Math.round(a[1] + (b[1] - a[1]) * t4),
      Math.round(a[2] + (b[2] - a[2]) * t4),
      Math.round(a[3] + (b[3] - a[3]) * t4)
    );
  }
  function cssColor(c) {
    const [r, g, b, a] = unpack(c);
    return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
  }
  function ramp(d, m, l, h) {
    return [rgba(d), rgba(m), rgba(l), rgba(h)];
  }
  function rampFrom(hex) {
    const c = rgba(hex);
    return [scaleColor(c, 0.55), scaleColor(c, 0.8), c, mixColor(c, rgba("#ffffff"), 0.35)];
  }
  var LX = -0.55;
  var LY = -0.62;
  var LZ = 0.56;
  function shadeIndex(nx, ny, nz, bias = 0) {
    const l = nx * LX + ny * LY + nz * LZ + bias;
    return l > 0.8 ? 3 : l > 0.42 ? 2 : l > 0.05 ? 1 : 0;
  }
  var PixBuf = class _PixBuf {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      __publicField(this, "data");
      this.data = new Uint32Array(w * h);
    }
    set(x2, y2, c) {
      x2 |= 0;
      y2 |= 0;
      if (x2 < 0 || y2 < 0 || x2 >= this.w || y2 >= this.h) return;
      this.data[y2 * this.w + x2] = c;
    }
    get(x2, y2) {
      if (x2 < 0 || y2 < 0 || x2 >= this.w || y2 >= this.h) return 0;
      return this.data[y2 * this.w + x2];
    }
    /** Blend a colour over the existing pixel. */
    blend(x2, y2, c) {
      x2 |= 0;
      y2 |= 0;
      if (x2 < 0 || y2 < 0 || x2 >= this.w || y2 >= this.h) return;
      const i = y2 * this.w + x2;
      const a = (c >>> 24) / 255;
      if (a >= 1 || this.data[i] >>> 24 === 0) {
        this.data[i] = a >= 1 ? c : c;
        return;
      }
      this.data[i] = mixColor(this.data[i], (c | 4278190080) >>> 0, a);
    }
    rect(x2, y2, w, h, c) {
      for (let j = y2; j < y2 + h; j++) for (let i = x2; i < x2 + w; i++) this.set(i, j, c);
    }
    /** Shaded capsule between two screen points. `dither` gives a mail/scale texture. */
    capsule(ax, ay, bx, by, r, rp, opts = {}) {
      r = Math.max(0.7, r);
      const x0 = Math.floor(Math.min(ax, bx) - r - 1);
      const x1 = Math.ceil(Math.max(ax, bx) + r + 1);
      const y0 = Math.floor(Math.min(ay, by) - r - 1);
      const y1 = Math.ceil(Math.max(ay, by) + r + 1);
      const dx = bx - ax;
      const dy = by - ay;
      const ll = dx * dx + dy * dy || 1e-6;
      for (let y2 = y0; y2 <= y1; y2++) {
        for (let x2 = x0; x2 <= x1; x2++) {
          const px = x2 + 0.5;
          const py = y2 + 0.5;
          let t4 = ((px - ax) * dx + (py - ay) * dy) / ll;
          t4 = t4 < 0 ? 0 : t4 > 1 ? 1 : t4;
          const cx = ax + dx * t4;
          const cy = ay + dy * t4;
          const ox = (px - cx) / r;
          const oy = (py - cy) / r;
          const d2 = ox * ox + oy * oy;
          if (d2 > 1) continue;
          let idx;
          if (opts.flat !== void 0) idx = opts.flat;
          else idx = shadeIndex(ox, oy, Math.sqrt(1 - d2), opts.bias ?? 0);
          if (opts.dither && (x2 + y2 & 1) === 0 && idx > 0) idx -= 1;
          this.set(x2, y2, rp[idx]);
        }
      }
    }
    sphere(cx, cy, r, rp, opts = {}) {
      const ry = opts.ry ?? r;
      for (let y2 = Math.floor(cy - ry - 1); y2 <= Math.ceil(cy + ry + 1); y2++) {
        for (let x2 = Math.floor(cx - r - 1); x2 <= Math.ceil(cx + r + 1); x2++) {
          const ox = (x2 + 0.5 - cx) / r;
          const oy = (y2 + 0.5 - cy) / ry;
          const d2 = ox * ox + oy * oy;
          if (d2 > 1) continue;
          let idx = shadeIndex(ox, oy, Math.sqrt(1 - d2), opts.bias ?? 0);
          if (opts.dither && (x2 + y2 & 1) === 0 && idx > 0) idx -= 1;
          this.set(x2, y2, rp[idx]);
        }
      }
    }
    /** Flat-filled polygon (convex or simple), pixel centres. */
    poly(pts, c) {
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of pts) {
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      }
      for (let y2 = Math.floor(y0); y2 <= Math.ceil(y1); y2++) {
        const py = y2 + 0.5;
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          if (a[1] <= py && b[1] > py || b[1] <= py && a[1] > py) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          for (let x2 = Math.round(xs[i]); x2 < Math.round(xs[i + 1]); x2++) this.set(x2, y2, c);
        }
      }
    }
    line(ax, ay, bx, by, c) {
      const n2 = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let i = 0; i <= n2; i++) this.set(Math.floor(ax + (bx - ax) * i / n2), Math.floor(ay + (by - ay) * i / n2), c);
    }
    /** Selective outline: every empty pixel touching the sprite gets a darkened copy of its neighbour. */
    outline(dark = 0.32, minAlpha = 200) {
      const { w, h, data } = this;
      const src = data.slice();
      const op = (x2, y2) => x2 >= 0 && y2 >= 0 && x2 < w && y2 < h && src[y2 * w + x2] >>> 24 >= minAlpha;
      for (let y2 = 0; y2 < h; y2++) {
        for (let x2 = 0; x2 < w; x2++) {
          if (src[y2 * w + x2] >>> 24 !== 0) continue;
          let n2 = -1;
          if (op(x2, y2 + 1)) n2 = src[(y2 + 1) * w + x2];
          else if (op(x2 - 1, y2)) n2 = src[y2 * w + x2 - 1];
          else if (op(x2 + 1, y2)) n2 = src[y2 * w + x2 + 1];
          else if (op(x2, y2 - 1)) n2 = src[(y2 - 1) * w + x2];
          if (n2 !== -1) data[y2 * w + x2] = (scaleColor(n2, dark) | 4278190080) >>> 0;
        }
      }
    }
    /** Copy with every opaque pixel tinted toward a colour (hit flash, silhouettes). */
    tinted(c, t4) {
      const out = new _PixBuf(this.w, this.h);
      for (let i = 0; i < this.data.length; i++) {
        const p = this.data[i];
        if (p >>> 24 === 0) continue;
        out.data[i] = mixColor(p, c, t4) & 16777215 | p & 4278190080;
      }
      return out;
    }
    toCanvas() {
      const cv = document.createElement("canvas");
      cv.width = this.w;
      cv.height = this.h;
      const ctx = cv.getContext("2d");
      const img = ctx.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.data);
      ctx.putImageData(img, 0, 0);
      return cv;
    }
  };
  function sprite(buf, ax, ay) {
    return { cv: buf.toCanvas(), ax, ay };
  }
  function mulberry322(seed2) {
    let a = seed2 >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t4 = a;
      t4 = Math.imul(t4 ^ t4 >>> 15, t4 | 1);
      t4 ^= t4 + Math.imul(t4 ^ t4 >>> 7, t4 | 61);
      return ((t4 ^ t4 >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash2(x2, y2, s = 0) {
    let h = Math.imul(x2 | 0, 374761393) + Math.imul(y2 | 0, 668265263) + Math.imul(s | 0, 1442695041) | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise2(x2, y2, s = 0) {
    const xi = Math.floor(x2);
    const yi = Math.floor(y2);
    const xf = x2 - xi;
    const yf = y2 - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v2 = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s);
    const b = hash2(xi + 1, yi, s);
    const c = hash2(xi, yi + 1, s);
    const d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v2 + (a - b - c + d) * u * v2;
  }
  function pxLine(ctx, ax, ay, bx, by, color, w = 1) {
    ctx.fillStyle = color;
    const n2 = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
    for (let i = 0; i <= n2; i++) ctx.fillRect(Math.round(ax + (bx - ax) * i / n2), Math.round(ay + (by - ay) * i / n2), w, w);
  }
  var frameBudget = { until: Infinity };
  function startFrameBudget(ms) {
    frameBudget.until = performance.now() + ms;
  }
  function canBuild() {
    return performance.now() < frameBudget.until;
  }

  // src/client/gfx/rig.ts
  var v = (f, s, z2) => [f, s, z2];
  var add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  var mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  var lerp3 = (a, b, t4) => [a[0] + (b[0] - a[0]) * t4, a[1] + (b[1] - a[1]) * t4, a[2] + (b[2] - a[2]) * t4];
  var len3 = (a) => Math.hypot(a[0], a[1], a[2]);
  var norm = (a) => {
    const l = len3(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  var cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function rotS(p, ang, pivot) {
    const df = p[0] - pivot[0];
    const dz = p[2] - pivot[2];
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return [pivot[0] + df * c + dz * s, p[1], pivot[2] - df * s + dz * c];
  }
  function rotF(p, ang, pivot) {
    const ds = p[1] - pivot[1];
    const dz = p[2] - pivot[2];
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return [p[0], pivot[1] + ds * c + dz * s, pivot[2] - ds * s + dz * c];
  }
  function transformParts(parts, fn) {
    for (const pt of parts) {
      pt.a = fn(pt.a);
      if (pt.b) pt.b = fn(pt.b);
      if (pt.ref) pt.ref = fn(pt.ref);
      if (pt.pts) pt.pts = pt.pts.map(fn);
      if (pt.n) {
        const o = fn([0, 0, 0]);
        pt.n = norm(sub(fn(pt.n), o));
      }
    }
  }
  var C2 = Math.SQRT1_2;
  var SZ = HZ * C2;
  function projector(facing, scale, ax, ay) {
    const c = Math.cos(facing);
    const s = Math.sin(facing);
    const wx = (p) => (p[0] * c - p[1] * s) * scale;
    const wy = (p) => (p[0] * s + p[1] * c) * scale;
    return {
      x: (p) => ax + (wx(p) - wy(p)) * C2,
      y: (p) => ay + (wx(p) + wy(p)) * C2 * SQ - p[2] * scale * SZ,
      depth: (p) => (wx(p) + wy(p)) * C2 + p[2] * scale * 0.22
    };
  }
  function rasterize(parts, pr, scale, buf, outline2 = true) {
    const items = parts.map((p, i) => {
      let d;
      if (p.kind === "cap") d = pr.depth(lerp3(p.a, p.b, 0.5));
      else if (p.kind === "poly") d = p.pts.reduce((acc, q) => acc + pr.depth(q), 0) / p.pts.length;
      else d = pr.depth(p.a);
      return { p, d: d + (p.depthBias ?? 0) + i * 1e-4 };
    });
    items.sort((a, b) => a.d - b.d);
    for (const { p } of items) {
      switch (p.kind) {
        case "cap":
          buf.capsule(pr.x(p.a), pr.y(p.a), pr.x(p.b), pr.y(p.b), p.r * scale, p.ramp, { dither: p.dither, bias: p.bias });
          break;
        case "sph":
          buf.sphere(pr.x(p.a), pr.y(p.a), p.r * scale, p.ramp, { dither: p.dither, bias: p.bias, ry: p.ry ? p.r * scale * p.ry : void 0 });
          break;
        case "dot":
          if (p.ref && pr.depth(p.a) <= pr.depth(p.ref) + 0.3) break;
          buf.set(Math.floor(pr.x(p.a)), Math.floor(pr.y(p.a)), p.color);
          if (p.r > 1) buf.set(Math.floor(pr.x(p.a)) + 1, Math.floor(pr.y(p.a)), p.color);
          break;
        case "poly":
          buf.poly(p.pts.map((q) => [pr.x(q), pr.y(q)]), p.color);
          break;
        case "disc":
          drawDisc(buf, p, pr, scale);
          break;
      }
    }
    if (outline2) buf.outline();
  }
  function drawDisc(buf, p, pr, scale) {
    const n2 = norm(p.n);
    const up = Math.abs(n2[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const e1 = norm(cross(n2, up));
    const e2 = norm(cross(n2, e1));
    const R8 = p.r;
    const nsx = pr.x(add(p.a, n2)) - pr.x(p.a);
    const nsy = pr.y(add(p.a, n2)) - pr.y(p.a);
    const nl = Math.hypot(nsx, nsy) || 1;
    const facing = 1 - Math.min(1, nl / (scale * 0.9));
    const lit = (-0.55 * nsx - 0.62 * nsy) / nl;
    const face = p.ramp[lit > 0.3 ? 2 : facing > 0.6 ? 2 : lit > -0.3 ? 1 : 0];
    const step = 0.3 / scale;
    for (let u = -R8; u <= R8; u += step) {
      for (let w = -R8; w <= R8; w += step) {
        const d = Math.hypot(u, w);
        if (d > R8) continue;
        const q = add(p.a, add(mul(e1, u), mul(e2, w)));
        let c = face;
        if (d > R8 - 1.1) c = p.rim ?? p.ramp[0];
        else if (d < 1.3 && p.boss !== void 0) c = p.boss;
        else if (u < -R8 * 0.3 && w < -R8 * 0.3 && d < R8 - 1.5) c = p.ramp[Math.min(3, lit > 0 ? 3 : 2)];
        buf.set(Math.floor(pr.x(q)), Math.floor(pr.y(q)), c);
      }
    }
  }
  var LIGHT_X = -0.62;
  var LIGHT_Y = -0.78;
  var css = /* @__PURE__ */ new Map();
  function col(c) {
    let s = css.get(c);
    if (!s) {
      s = cssColor(c);
      if (css.size > 4e3) css.clear();
      css.set(c, s);
    }
    return s;
  }
  function depthItems(parts, pr) {
    const items = parts.map((p, i) => {
      let d;
      if (p.kind === "cap") d = pr.depth(lerp3(p.a, p.b, 0.5));
      else if (p.kind === "poly") d = p.pts.reduce((acc, q) => acc + pr.depth(q), 0) / p.pts.length;
      else d = pr.depth(p.a);
      return { p, d: d + (p.depthBias ?? 0) + i * 1e-4 };
    });
    items.sort((a, b) => a.d - b.d);
    return items;
  }
  function capStops(g, rp, bias = 0) {
    const b = Math.max(-0.3, Math.min(0.3, bias * 0.25));
    g.addColorStop(0, col(rp[2]));
    g.addColorStop(Math.max(0.05, 0.2 - b), col(rp[3]));
    g.addColorStop(Math.max(0.1, 0.42 - b), col(rp[2]));
    g.addColorStop(Math.min(0.95, 0.74 - b), col(rp[1]));
    g.addColorStop(1, col(rp[0]));
  }
  var METAL_RAMPS = /* @__PURE__ */ new Set();
  var GLOW_RAMPS = /* @__PURE__ */ new Set();
  var RIM = "rgba(255,196,140,0.38)";
  var SPEC = "rgba(255,255,255,0.75)";
  function paintParts(parts, pr, scale, ctx) {
    for (const { p } of depthItems(parts, pr)) {
      switch (p.kind) {
        case "cap": {
          const x0 = pr.x(p.a);
          const y0 = pr.y(p.a);
          const x1 = pr.x(p.b);
          const y1 = pr.y(p.b);
          const r = p.r * scale;
          let nx = -(y1 - y0);
          let ny = x1 - x0;
          const l = Math.hypot(nx, ny);
          if (l < 0.01) {
            nx = LIGHT_X;
            ny = LIGHT_Y;
          } else {
            nx /= l;
            ny /= l;
            if (nx * LIGHT_X + ny * LIGHT_Y < 0) {
              nx = -nx;
              ny = -ny;
            }
          }
          const mx = (x0 + x1) / 2;
          const my = (y0 + y1) / 2;
          const g = ctx.createLinearGradient(mx + nx * r, my + ny * r, mx - nx * r, my - ny * r);
          capStops(g, p.ramp, p.bias);
          ctx.strokeStyle = g;
          ctx.lineWidth = r * 2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(l < 0.01 ? x0 + 0.01 : x1, y1);
          ctx.stroke();
          if (r > 0.9 && l > r * 0.6) {
            const metal2 = METAL_RAMPS.has(p.ramp);
            ctx.lineWidth = Math.max(0.6, r * (metal2 ? 0.22 : 0.16));
            ctx.strokeStyle = RIM;
            ctx.beginPath();
            ctx.moveTo(x0 - nx * r * 0.82, y0 - ny * r * 0.82);
            ctx.lineTo(x1 - nx * r * 0.82, y1 - ny * r * 0.82);
            ctx.stroke();
            if (metal2) {
              ctx.strokeStyle = SPEC;
              ctx.lineWidth = Math.max(0.5, r * 0.2);
              const ins = 0.18 * l;
              const ux = (x1 - x0) / l;
              const uy = (y1 - y0) / l;
              ctx.beginPath();
              ctx.moveTo(x0 + nx * r * 0.45 + ux * ins, y0 + ny * r * 0.45 + uy * ins);
              ctx.lineTo(x1 + nx * r * 0.45 - ux * ins, y1 + ny * r * 0.45 - uy * ins);
              ctx.stroke();
            }
          }
          break;
        }
        case "sph": {
          const x2 = pr.x(p.a);
          const y2 = pr.y(p.a);
          const r = p.r * scale;
          const ry = p.ry ? r * p.ry : r;
          const b = (p.bias ?? 0) * 0.15;
          const g = ctx.createRadialGradient(x2 - r * 0.38, y2 - ry * 0.42, r * 0.05, x2, y2, r * 1.05);
          g.addColorStop(0, col(p.ramp[3]));
          g.addColorStop(Math.max(0.1, 0.28 - b), col(p.ramp[2]));
          g.addColorStop(Math.min(0.9, 0.7 - b), col(p.ramp[1]));
          g.addColorStop(1, col(p.ramp[0]));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x2, y2, r, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          if (r > 1.2) {
            ctx.save();
            ctx.clip();
            ctx.strokeStyle = RIM;
            ctx.lineWidth = r * 0.22;
            ctx.beginPath();
            ctx.ellipse(x2 - r * 0.1, y2 - ry * 0.1, r, ry, 0, -0.2, Math.PI * 0.75);
            ctx.stroke();
            ctx.restore();
            if (METAL_RAMPS.has(p.ramp)) {
              const sg = ctx.createRadialGradient(x2 - r * 0.38, y2 - ry * 0.45, 0, x2 - r * 0.38, y2 - ry * 0.45, r * 0.45);
              sg.addColorStop(0, SPEC);
              sg.addColorStop(1, "rgba(255,255,255,0)");
              ctx.fillStyle = sg;
              ctx.beginPath();
              ctx.arc(x2 - r * 0.38, y2 - ry * 0.45, r * 0.45, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          if (GLOW_RAMPS.has(p.ramp)) {
            const gg = ctx.createRadialGradient(x2, y2, 0, x2, y2, r * 3);
            gg.addColorStop(0, "rgba(255,230,180,0.45)");
            gg.addColorStop(1, "rgba(255,200,120,0)");
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.arc(x2, y2, r * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case "dot": {
          if (p.ref && pr.depth(p.a) <= pr.depth(p.ref) + 0.3) break;
          ctx.fillStyle = col(p.color);
          ctx.beginPath();
          ctx.arc(pr.x(p.a), pr.y(p.a), Math.max(0.6, scale * 0.42) * (p.r > 1 ? 1.4 : 1), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "poly": {
          const pts = p.pts.map((q) => [pr.x(q), pr.y(q)]);
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const [x2, y2] of pts) {
            minX = Math.min(minX, x2);
            minY = Math.min(minY, y2);
            maxX = Math.max(maxX, x2);
            maxY = Math.max(maxY, y2);
          }
          const base = p.color ?? p.ramp[2];
          const g = ctx.createLinearGradient(minX, minY, maxX, maxY);
          g.addColorStop(0, col(p.ramp[3]));
          g.addColorStop(0.35, col(base));
          g.addColorStop(1, col(p.ramp[0]));
          ctx.fillStyle = g;
          ctx.strokeStyle = col(p.ramp[0]);
          ctx.lineWidth = Math.max(0.6, scale * 0.25);
          ctx.lineJoin = "round";
          ctx.beginPath();
          pts.forEach(([x2, y2], i) => i ? ctx.lineTo(x2, y2) : ctx.moveTo(x2, y2));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          if (METAL_RAMPS.has(p.ramp)) {
            ctx.strokeStyle = "rgba(255,255,255,0.35)";
            ctx.lineWidth = Math.max(0.5, scale * 0.18);
            ctx.beginPath();
            for (let k = 0; k < pts.length; k++) {
              const [ax, ay] = pts[k];
              const [bx, by] = pts[(k + 1) % pts.length];
              const ex = bx - ax;
              const ey = by - ay;
              if ((-ey * LIGHT_X + ex * LIGHT_Y) * (k % 2 ? 1 : 1) > 0) {
                ctx.moveTo(ax, ay);
                ctx.lineTo(bx, by);
              }
            }
            ctx.stroke();
          }
          break;
        }
        case "disc": {
          const n2 = norm(p.n);
          const up = Math.abs(n2[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
          const e1 = norm(cross(n2, up));
          const e2 = norm(cross(n2, e1));
          const ring = (R9) => {
            ctx.beginPath();
            for (let i = 0; i <= 28; i++) {
              const a = i / 28 * Math.PI * 2;
              const q = add(p.a, add(mul(e1, Math.cos(a) * R9), mul(e2, Math.sin(a) * R9)));
              if (i) ctx.lineTo(pr.x(q), pr.y(q));
              else ctx.moveTo(pr.x(q), pr.y(q));
            }
            ctx.closePath();
          };
          const cx = pr.x(p.a);
          const cy = pr.y(p.a);
          const R8 = p.r * scale;
          const g = ctx.createLinearGradient(cx - R8, cy - R8, cx + R8, cy + R8);
          g.addColorStop(0, col(p.ramp[3]));
          g.addColorStop(0.35, col(p.ramp[2]));
          g.addColorStop(0.75, col(p.ramp[1]));
          g.addColorStop(1, col(p.ramp[0]));
          ring(p.r);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = col(p.rim ?? p.ramp[0]);
          ctx.lineWidth = Math.max(0.8, scale * 0.85);
          ctx.stroke();
          if (p.boss !== void 0) {
            ring(Math.min(1.3, p.r * 0.3));
            const bg = ctx.createRadialGradient(cx - scale * 0.4, cy - scale * 0.4, 0, cx, cy, scale * 1.4);
            bg.addColorStop(0, "rgba(255,255,255,0.9)");
            bg.addColorStop(0.35, col(p.boss));
            bg.addColorStop(1, col(p.ramp[0]));
            ctx.fillStyle = bg;
            ctx.fill();
          }
          break;
        }
      }
    }
  }
  function outlined(src, o, flash) {
    const cv = document.createElement("canvas");
    cv.width = src.width;
    cv.height = src.height;
    const g = cv.getContext("2d");
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      g.drawImage(src, Math.cos(a) * o, Math.sin(a) * o);
    }
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "rgba(8,6,6,0.82)";
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = "source-over";
    g.drawImage(src, 0, 0);
    if (flash) {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(255,250,240,0.8)";
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = "source-over";
    }
    return cv;
  }
  var density = 3;
  function setSpriteDensity(d) {
    density = Math.max(1, Math.min(6, d));
  }
  function spriteDensity() {
    return density;
  }
  function paintSprite(parts, facing, scale, W3, H3, ax, ay, flash = false) {
    const d = density;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(W3 * d);
    cv.height = Math.ceil(H3 * d);
    const ctx = cv.getContext("2d");
    paintParts(parts, projector(facing, scale * d, ax * d, ay * d), scale * d, ctx);
    return { cv: outlined(cv, Math.max(1, d * 0.55), flash), ax: ax * d, ay: ay * d, d };
  }

  // src/client/gfx/hero.ts
  var SKILL_POSES = ["cast_forward", "cast_raise", "channel", "slam", "leap", "throw", "buff", "summon"];
  var HERO_FRAMES = {
    idle: 4,
    run: 8,
    attack: 6,
    attack2: 6,
    roll: 6,
    death: 6,
    flinch: 3,
    stagger: 6,
    cast_forward: 6,
    cast_raise: 6,
    channel: 4,
    slam: 8,
    leap: 8,
    throw: 6,
    buff: 6,
    summon: 6
  };
  var LOOPING = /* @__PURE__ */ new Set(["channel"]);
  var FAMILY = {
    sword: "sword",
    sword_short: "sword",
    sword_long: "sword",
    greatsword: "sword",
    quarterstaff: "sword",
    spear: "spear",
    axe: "axe",
    axe_hand: "axe",
    greataxe: "axe",
    mace: "axe",
    maul: "axe",
    dagger: "dagger",
    claw: "dagger",
    bow: "bow",
    crossbow: "bow",
    staff: "staff",
    wand: "staff",
    sceptre: "staff"
  };
  function weaponFamily(wk, wl) {
    return wk && FAMILY[wk] || wl && FAMILY[wl] || null;
  }
  var KIND_LOOK = {
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
    quarterstaff: "quarterstaff"
  };
  var SCALE = 1.42 * ART;
  var W = Math.ceil(118 * ART);
  var H = Math.ceil(112 * ART);
  var AX = Math.floor(W / 2);
  var AY = Math.ceil(92 * ART);
  var HS = 0.82;
  var hv = (f, s, z2) => [f * HS, s * HS, z2 * HS];
  var stretchZ = (z2) => z2 <= 14 ? z2 * 1.18 : 16.5 + (z2 - 14) * 1.08;
  var M = {
    skin: ramp("#36241d", "#634537", "#8c6a55", "#b08e74"),
    hair: ramp("#100b09", "#1f1612", "#33251d", "#4a372b"),
    tunic: ramp("#221e18", "#3c3429", "#574c3b", "#746751"),
    rag: ramp("#1d1812", "#2e261c", "#423727", "#574a35"),
    pants: ramp("#121012", "#1f1b1e", "#2f292d", "#423a3f"),
    leather: ramp("#1c120b", "#342115", "#4f331e", "#6c492d"),
    strap: ramp("#0e0906", "#1a110b", "#291b11", "#382518"),
    mail: ramp("#1b1e22", "#373c43", "#5a616b", "#848d99"),
    plate: ramp("#202328", "#454a53", "#787f8b", "#b2bac4"),
    dark: ramp("#121418", "#262a30", "#3d434c", "#5b636e"),
    scale: ramp("#16180f", "#2d3220", "#4a5133", "#6e7650"),
    robe: ramp("#120f1c", "#231c38", "#372c56", "#4f4178"),
    silk: ramp("#17121f", "#2c2340", "#46386a", "#6a5a96"),
    hood: ramp("#0d0f0e", "#191c1a", "#282c29", "#3b413c"),
    brass: ramp("#2a1f0b", "#513e19", "#806228", "#ab8c48"),
    wraps: ramp("#28231d", "#433c32", "#625849", "#7f7461"),
    rope: ramp("#2a2216", "#43382a", "#5e503c", "#7a6a52"),
    wood: ramp("#24160b", "#432b16", "#674325", "#8a6035"),
    pale: ramp("#2e2a22", "#5a5242", "#8a7e66", "#b4a88c"),
    steel: ramp("#363c44", "#78838f", "#bfc8d2", "#f2f6fa"),
    iron: ramp("#17181b", "#2c2e33", "#474a52", "#676b75"),
    bone: ramp("#5e5648", "#9b9078", "#cfc4a6", "#efe7cf"),
    glow: ramp("#1c3a66", "#3a7ac8", "#8cd0ff", "#f0faff"),
    gem: ramp("#3a0a10", "#7a1622", "#c8343e", "#ff9aa0")
  };
  var TRIM = [null, null, ramp("#3a2a08", "#7a5a14", "#c8a040", "#f4dc8a"), ramp("#3a1606", "#7a3410", "#c46a28", "#f0b070")];
  for (const rp of [M.mail, M.plate, M.steel, M.iron, M.brass, M.dark, TRIM[2], TRIM[3]]) METAL_RAMPS.add(rp);
  GLOW_RAMPS.add(M.glow);
  GLOW_RAMPS.add(M.gem);
  var EYE = rgba("#120c0a");
  var SLIT = rgba("#07090c");
  function weaponRest(fam, wl) {
    switch (fam) {
      case "sword":
        return wl === "greatsword" || wl === "quarterstaff" ? { ha: v(3, 5, 15), w: norm(v(0.35, -0.15, 0.95)) } : { ha: v(3, 6, 15), w: norm(v(0.55, 0.2, 0.8)) };
      case "spear":
        return { ha: v(3, 5.5, 16), w: norm(v(0.3, 0, 0.95)) };
      case "axe":
        return { ha: v(2, 6, 14.5), w: norm(v(0.3, 0.25, 0.92)) };
      case "dagger":
        return { ha: v(3, 5.5, 14.5), w: norm(v(1, 0.05, 0.25)) };
      case "staff":
        return wl === "wand" || wl === "sceptre" ? { ha: v(3, 5.5, 14.5), w: norm(v(0.9, 0.05, 0.4)) } : { ha: v(3, 6, 15), w: norm(v(0.12, 0.05, 1)) };
      case "bow":
        return { ha: v(1.5, 6, 14), w: v(1, 0, 0) };
      default:
        return { ha: v(1.5, 6, 14), w: v(1, 0, 0) };
    }
  }
  var BOW_REST = { up: norm(v(0.45, -0.1, 0.88)), aim: norm(v(0.88, 0, -0.45)), draw: 0, arrow: false };
  function heroPose(anim, frame2, wk, wl = "") {
    const fam = weaponFamily(wk, wl);
    const rest = weaponRest(fam, wl);
    const p = {
      hip: v(0, 0, 14),
      chest: v(0, 0, 22),
      neck: v(0, 0, 26),
      head: v(0, 0, 31),
      shL: v(0, -4.8, 24.3),
      shR: v(0, 4.8, 24.3),
      haL: v(1, -6, 15),
      haR: rest.ha,
      hpL: v(0, -2.4, 13),
      hpR: v(0, 2.4, 13),
      ftL: v(0.5, -2.7, 1),
      ftR: v(0.5, 2.7, 1),
      w: rest.w,
      run: 0,
      flap: 0
    };
    if (fam === "bow") p.bow = { ...BOW_REST };
    const up = (pt, dz) => [pt[0], pt[1], pt[2] + dz];
    const fwd = (pt, df) => [pt[0] + df, pt[1], pt[2]];
    const TORSO = ["hip", "chest", "neck", "head", "shL", "shR", "hpL", "hpR"];
    const UPPER = ["chest", "neck", "head", "shL", "shR"];
    const lean = (k) => {
      p.chest = fwd(p.chest, k);
      p.neck = fwd(p.neck, k * 1.3);
      p.head = fwd(p.head, k * 1.45);
      p.shL = fwd(p.shL, k * 1.1);
      p.shR = fwd(p.shR, k * 1.1);
    };
    const shift = (df, dz) => {
      for (const k of TORSO) p[k] = up(fwd(p[k], df), dz);
    };
    const twist = (k) => {
      p.shR = fwd(p.shR, -k * 1.5);
      p.shL = fwd(p.shL, k * 1.5);
    };
    const at2 = (a) => a[Math.max(0, Math.min(a.length - 1, frame2))];
    if (anim === "idle") {
      const b = [0, 0.5, 1, 0.5][frame2 % 4];
      for (const k of UPPER) p[k] = up(p[k], b * 0.55);
      p.haL = up(p.haL, b * 0.3);
      p.haR = up(p.haR, b * 0.3);
      p.flap = b * 0.5;
      if (fam === "bow") p.haL = up(v(2, -6, 14), b * 0.3);
    } else if (anim === "run") {
      const ph = frame2 / 8 * Math.PI * 2;
      const sw = Math.sin(ph);
      const lift = (a) => Math.max(0, Math.cos(a)) * 3.4;
      p.ftL = v(sw * 5.5, -2.7, 1 + lift(ph));
      p.ftR = v(-sw * 5.5, 2.7, 1 + lift(ph + Math.PI));
      const bob = Math.abs(Math.cos(ph)) * 0.9;
      for (const k of TORSO) p[k] = up(p[k], bob - 0.6);
      p.chest = fwd(p.chest, 1.4);
      p.neck = fwd(p.neck, 2.2);
      p.head = fwd(p.head, 2.6);
      p.shL = fwd(p.shL, 1.6);
      p.shR = fwd(p.shR, 1.6);
      p.haL = v(1 - sw * 4.5, -6, 15.5 + Math.max(0, -sw) * 2);
      const dampen = fam ? 0.35 : 1;
      p.haR = add(rest.ha, v(sw * 4 * dampen + 1, 0, Math.max(0, sw) * 1.5 * dampen));
      p.run = 1;
      p.flap = Math.sin(ph * 2) * 1.2;
    } else if (anim === "attack" || anim === "attack2") {
      attackPose(p, anim === "attack2", frame2, fam, wl, { lean, shift, twist, at: at2, fwd, up });
    } else if (anim === "roll") {
      const t4 = (frame2 + 0.5) / 6;
      Object.assign(p, {
        hip: v(0, 0, 9),
        chest: v(1.5, 0, 14),
        neck: v(2.5, 0, 17),
        head: v(3.5, 0, 20.5),
        shL: v(1.5, -4.5, 16),
        shR: v(1.5, 4.5, 16),
        haL: v(5, -4, 9),
        haR: v(5, 4.5, 9.5),
        hpL: v(0, -2.4, 8.5),
        hpR: v(0, 2.4, 8.5),
        knL: v(5, -2.6, 11),
        knR: v(5, 2.6, 11),
        ftL: v(1, -2.7, 4),
        ftR: v(1, 2.7, 4),
        w: norm(v(0.4, 0.1, -0.9))
      });
      if (p.bow) p.bow = { up: norm(v(0.3, 0, -1)), aim: v(1, 0, 0), draw: 0, arrow: false };
      p.rot = { ang: t4 * Math.PI * 2, pivot: v(1.5, 0, 10) };
      p.run = 0.6;
    } else if (anim === "flinch") {
      const k = [1, 0.6, 0.25][frame2] ?? 0;
      lean(-2.2 * k);
      p.head = add(p.head, v(-0.6 * k, 0.6 * k, -0.4 * k));
      p.haL = add(p.haL, v(-1.5 * k, -1.5 * k, 2 * k));
      p.haR = add(p.haR, v(-1.2 * k, 1 * k, 1.2 * k));
      shift(-0.6 * k, -0.4 * k);
    } else if (anim === "stagger") {
      const k = [0.7, 1, 1, 0.85, 0.55, 0.25][frame2];
      const sag = [0.3, 0.8, 1.5, 1.7, 1.2, 0.5][frame2];
      lean(-3.6 * k);
      shift(-1.2 * k, -sag);
      p.head = add(p.head, v(-0.4, 1.2 * k, -0.8 * k));
      p.haL = v(-1 - 2 * k, -7.5, 18 + 7 * k);
      p.haR = v(-0.5 - 2 * k, 7.5, 17 + 6 * k);
      p.w = norm(v(-0.4, 0.6, 0.6));
      p.ftR = v(-3.5 * k, 3, 1);
      p.ftL = v(1.5, -2.9, 1);
      p.knL = v(2.5, -2.6, 7.2 - sag * 0.5);
      p.knR = v(-1, 2.8, 7 - sag * 0.6);
      p.run = 0.3;
      if (p.bow) p.bow = { up: norm(v(-0.3, -0.3, 0.9)), aim: v(1, 0, 0), draw: 0, arrow: false };
    } else if (anim === "death") {
      const t4 = Math.min(1, frame2 / 5);
      const recoil = frame2 === 0 ? 1 : 0;
      const buckle = Math.sin(Math.min(1, t4 * 1.6) * Math.PI) * 3;
      lean(-1.6 * recoil);
      p.knL = v(1 + buckle, -2.6, 7 - buckle * 0.6);
      p.knR = v(1.5 + buckle, 2.6, 7 - buckle * 0.6);
      p.haL = v(-1 - t4 * 2, -7.5 - recoil, 17 + t4 * 4 + recoil * 4);
      p.haR = v(-1 - t4 * 2, 7.5 + recoil, 17 + t4 * 4 + recoil * 3);
      const fall = t4 < 0.25 ? 0 : (t4 - 0.25) / 0.75;
      p.rot = { ang: -fall * fall * 1.5, pivot: v(-1, 0, 0) };
      p.w = norm(v(0, 1, -0.2));
      if (p.bow) p.bow = { up: norm(v(-0.6, 0.2, 0.6)), aim: v(1, 0, 0), draw: 0, arrow: false };
    } else {
      skillPose(p, anim, frame2, fam, { lean, shift, twist, at: at2, fwd, up });
    }
    const sq = p.squash ?? 1;
    const st = (q) => [q[0], q[1], stretchZ(q[2]) * sq];
    for (const k of ["hip", "chest", "neck", "head", "shL", "shR", "haL", "haR", "hpL", "hpR", "ftL", "ftR", "knL", "knR"]) {
      const q = p[k];
      if (q) p[k] = st(q);
    }
    if (p.rot) p.rot = { ang: p.rot.ang, pivot: st(p.rot.pivot) };
    return p;
  }
  function attackPose(p, alt, frame2, fam, wl, k) {
    const { lean, shift, twist, at: at2 } = k;
    if (fam === "sword") {
      const d = alt ? -1 : 1;
      const a = at2([1.2, 1.8, 2.15, 0.15, -1.3, -1.6]) * d;
      const el = at2([0.3, 0.38, 0.42, 0.06, -0.12, -0.2]);
      const big = wl === "greatsword" || wl === "quarterstaff";
      p.w = norm(v(Math.cos(a), Math.sin(a), el));
      const r = big ? 6 : 7;
      p.haR = add(p.shR, v(Math.cos(a) * r + 1, Math.sin(a) * r - 3, -3 + el * 4));
      twist(Math.sin(a) * 0.9);
      lean(at2([-0.4, -0.7, -0.9, 1.6, 1.9, 1.2]));
      if (big) {
        p.twoHand = true;
        p.haL = add(p.haR, v(-1.2, -2.4, -0.6));
      } else p.haL = v(-1 + Math.sin(a) * 1.5, -6.5, 16 + (frame2 >= 3 ? 1.5 : 0));
      if (frame2 >= 3) p.ftL = v(2.8, -2.8, 1);
      else p.ftR = v(-1.2, 2.9, 1);
      p.run = frame2 >= 3 ? 0.4 : 0;
    } else if (fam === "spear") {
      const reach = at2([-1, -2.5, -3.5, 9, 10, 5]);
      const lunge = at2([-0.5, -1, -1.5, 3, 3.5, 1.5]);
      const crouch = at2([0.3, 0.8, 1.2, 1.4, 1.1, 0.5]);
      p.w = norm(v(1, 0, frame2 < 3 ? 0.12 : 0.03));
      shift(lunge, -crouch);
      lean(Math.max(0, lunge) * 0.4);
      p.haR = v(3 + reach + lunge, 3.5, 18 - crouch * 0.6);
      p.haL = add(sub(p.haR, mul(p.w, 8)), v(0, -4.5, 0));
      p.ftL = v(3 + Math.max(0, lunge) * 1.7, -2.7, 1);
      p.ftR = v(-3 - Math.max(0, lunge) * 0.6, 2.7, 1);
      p.twoHand = true;
      p.run = lunge > 0 ? 0.6 : 0;
    } else if (fam === "axe") {
      const b = at2([-0.3, -0.7, -0.95, 1.75, 2.2, 1.85]);
      p.w = norm(v(Math.sin(b), 0.12, Math.cos(b)));
      const piv = frame2 < 3 ? v(-0.5, 2.5, 27) : v(3.5, 1.5, 20);
      p.haR = add(piv, mul(p.w, 5));
      p.haL = add(sub(p.haR, mul(p.w, 3)), v(0, -2.5, 0));
      lean(at2([-0.8, -1.6, -2.1, 3, 3.6, 2.2]));
      shift(0, at2([0.3, 0.6, 0.9, -1.5, -1.9, -1]));
      p.ftL = v(3, -2.7, 1);
      p.ftR = v(-2.5, 2.7, 1);
      p.twoHand = true;
      p.run = frame2 >= 3 ? 0.5 : 0;
    } else if (fam === "dagger") {
      const ext = at2([-1, -2, -2.5, 9, 2.5, 8.5]);
      const lat = at2([0.5, 0.8, 1, 0.3, 0, -1.6]);
      const hz = at2([19, 19.3, 19.6, 19, 18.4, 17.2]);
      p.haR = v(2 + ext, 4.5 + lat - Math.max(0, ext) * 0.25, hz);
      p.w = norm(v(1, frame2 === 5 ? -0.3 : -0.1, frame2 === 5 ? -0.05 : 0.05));
      p.haL = v(1.5, -5.5, 18);
      lean(Math.max(-0.6, ext * 0.18));
      twist(frame2 < 3 ? 0.4 : -0.3);
      if (frame2 >= 3) p.ftL = v(2.5, -2.8, 1);
    } else if (fam === "bow") {
      const draw = at2([0.3, 0.65, 1, 0, 0, 0]);
      p.haL = v(8.5, -2.6, frame2 === 5 ? 19.5 : 21);
      p.haR = frame2 < 3 ? v(8.5 - 2 - draw * 8.5, -2.6 + draw * 4.8, 21 + draw * 1.6) : at2([v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(-3, 3.6, 23.5), v(-2.5, 4.6, 21.5), v(-0.5, 5.4, 18)]);
      p.bow = { up: norm(v(0, 0.06, 1)), aim: v(1, 0, 0), draw: frame2 < 3 ? draw : 0, arrow: frame2 < 3 };
      p.shL = k.fwd(p.shL, 1.6);
      p.shR = k.fwd(p.shR, -1.4);
      p.head = k.fwd(p.head, 0.6);
      p.ftL = v(2.6, -3.1, 1);
      p.ftR = v(-2.6, 3.1, 1);
    } else if (fam === "staff") {
      const wand2 = wl === "wand" || wl === "sceptre";
      const r = at2([0.35, 0.7, 1, 0, 0, 0]);
      const th = at2([0, 0, 0, 1, 0.8, 0.4]);
      if (frame2 < 3) {
        p.haR = v(1 - r * 1.5, 5, 17 + r * 7);
        p.w = wand2 ? norm(v(0.2, 0.1, 1)) : norm(v(-0.25 * r + 0.1, 0.05, 1));
        p.haL = v(3 + r * 2, -4.5, 18 + r * 3);
        lean(-0.6 * r);
      } else {
        p.haR = v(2 + th * 6, 4, 22 - th * 2);
        p.w = wand2 ? norm(v(1, -0.1, 0.15)) : norm(v(0.75 * th + 0.15, 0, 1 - 0.3 * th));
        p.haL = v(4 + th * 6, -3.5, 21);
        lean(1.6 * th);
        p.ftL = v(2.6, -2.8, 1);
      }
      p.glow = frame2 < 3 ? r * 0.55 : th;
      p.glowAt = "tip";
    } else {
      const ext = at2([-1, -2, -2.5, 10, 8, 3]);
      p.w = norm(v(1, -0.12, 0.05));
      p.haR = v(2 + ext, 4.5 - Math.max(0, ext) * 0.25, 19);
      p.haL = v(1, -5.5, 18);
      lean(Math.max(-0.6, ext * 0.15));
      twist(frame2 < 3 ? 0.5 : -0.4);
    }
  }
  function skillPose(p, anim, frame2, fam, k) {
    const { lean, shift, at: at2 } = k;
    const heldUp = () => {
      p.w = fam === "staff" ? norm(v(0.3, 0, 1)) : fam === "bow" ? p.w : norm(v(0.2, 0.3, 0.9));
    };
    switch (anim) {
      case "cast_forward": {
        const g = at2([0.25, 0.55, 1, 0.9, 0.5, 0.2]);
        const out = at2([0, 0.2, 1, 1, 0.6, 0.2]);
        p.haR = v(3 + out * 6, 3 - out * 0.8, 20 + out);
        p.haL = v(3 + out * 6, -3 + out * 0.8, 20 + out);
        if (fam === "staff") p.w = norm(v(0.6 * out + 0.2, 0, 1 - 0.3 * out));
        else heldUp();
        lean(-0.5 + out * 1.8);
        p.ftL = v(2.2, -2.8, 1);
        p.glow = g;
        p.glowAt = fam === "staff" ? "tip" : "both";
        break;
      }
      case "cast_raise": {
        const h = at2([20, 26, 32, 34, 33, 25]);
        const g = at2([0.2, 0.5, 0.9, 1, 0.8, 0.3]);
        p.haR = v(at2([2, 1.2, 0.6, 0.5, 0.8, 1.8]), 3.6, h);
        p.haL = v(at2([2, 1.2, 0.6, 0.5, 0.8, 1.8]), -3.6, h);
        p.w = norm(v(0.1, 0.1, 1));
        lean(at2([0, -0.6, -1.2, -1.3, -1, -0.3]));
        shift(0, at2([0, 0.3, 0.6, 0.7, 0.4, 0]));
        p.glow = g;
        p.glowAt = fam === "staff" ? "tip" : "both";
        break;
      }
      case "channel": {
        const b = [0, 0.5, 1, 0.5][frame2 % 4];
        p.haR = v(7.5, 2.6, 21 + b * 0.6);
        p.haL = v(7.5, -2.6, 21 + b * 0.6);
        if (fam === "staff") p.w = norm(v(0.9, 0, 0.5));
        else heldUp();
        lean(0.8);
        p.ftL = v(2.2, -2.8, 1);
        p.ftR = v(-1.5, 2.9, 1);
        p.glow = 0.65 + b * 0.35;
        p.glowAt = fam === "staff" ? "tip" : "both";
        p.flap = b;
        break;
      }
      case "slam": {
        p.lift = at2([0, 0, 6, 10, 9, 3, 0, 0]);
        p.squash = at2([0.93, 0.86, 1.08, 1.03, 1, 1.05, 0.86, 0.96]);
        const crouch = at2([1.5, 2.6, 0, 0, 0, 0, 3, 1]);
        shift(0, -crouch);
        if (frame2 <= 4) {
          const hz = at2([20, 18, 31, 33, 32]);
          p.haR = v(-0.5, 2.5, hz);
          p.haL = v(-0.5, -1, hz - 0.5);
          p.w = norm(v(-0.5, 0.05, 0.85));
          lean(frame2 >= 2 ? -1.6 : 1.2);
        } else {
          p.haR = at2([v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(6, 2.5, 22), v(8, 2, 11), v(5, 3.5, 15)]);
          p.haL = add(p.haR, v(-1, -3, -0.4));
          p.w = at2([v(1, 0, 0), v(1, 0, 0), v(1, 0, 0), v(1, 0, 0), v(1, 0, 0), norm(v(1, 0, 0.6)), norm(v(1, 0, -0.7)), norm(v(1, 0, -0.3))]);
          lean(at2([0, 0, 0, 0, 0, 2, 4, 2]));
        }
        if (frame2 >= 2 && frame2 <= 4) {
          p.knL = v(3.5, -2.6, 9);
          p.knR = v(2.5, 2.6, 8);
          p.ftL = v(0, -2.7, 3.5);
          p.ftR = v(-1, 2.7, 3);
        }
        p.twoHand = fam !== "bow";
        p.run = frame2 >= 2 && frame2 <= 5 ? 0.8 : 0;
        break;
      }
      case "leap": {
        p.lift = at2([0, 4, 13, 19, 19, 12, 1, 0]);
        p.squash = at2([0.8, 1.16, 1.06, 0.94, 0.94, 1.08, 0.8, 0.95]);
        shift(at2([0, 0.5, 1, 1, 1, 1, 0.5, 0]), at2([-2, 0, 0, 0, 0, 0, -2.2, -0.8]));
        lean(at2([1.5, -0.5, 0.5, 1.2, 1.2, 0.8, 2, 0.6]));
        if (frame2 >= 2 && frame2 <= 5) {
          const tuck = frame2 === 3 || frame2 === 4 ? 1 : 0.4;
          p.knL = v(3 + tuck * 2, -2.6, 9 + tuck * 2);
          p.knR = v(2 + tuck * 2, 2.6, 8.5 + tuck * 2);
          p.ftL = v(0.5, -2.7, 2 + tuck * 3);
          p.ftR = v(-0.5, 2.7, 1.5 + tuck * 3);
          p.haR = v(2, 5.5, 26 + tuck * 3);
          p.haL = v(2, -5.5, 25 + tuck * 3);
          p.w = norm(v(0.3, 0.2, 1));
        } else if (frame2 === 1) {
          p.haR = v(5, 5, 24);
          p.haL = v(5, -5, 24);
          p.ftR = v(-2.5, 2.7, 1.5);
        } else {
          p.haL = v(3, -6.5, 13);
          p.haR = add(p.haR, v(1, 1, -1));
        }
        p.run = frame2 >= 1 && frame2 <= 5 ? 1 : 0;
        p.flap = frame2 >= 2 && frame2 <= 5 ? 1.2 : 0;
        break;
      }
      case "throw": {
        p.haR = v(at2([-2, -4, -5.5, 7, 9, 6]), 5, at2([23, 26, 28, 26, 20, 17]));
        p.haL = v(at2([4, 6, 6.5, 0, -1, 1]), -5, at2([19, 21, 21.5, 17, 16, 15]));
        p.w = frame2 < 3 ? norm(v(-0.6, 0.1, 0.8)) : norm(v(1, 0, frame2 === 3 ? 0.4 : -0.2));
        lean(at2([-0.8, -1.6, -2.2, 2.5, 3, 1.4]));
        k.twist(frame2 < 3 ? 0.8 : -0.6);
        p.ftL = v(at2([2, 2.5, 3, 3.5, 3.5, 2.5]), -2.8, 1);
        p.ftR = v(-2.5, 2.8, 1);
        p.run = frame2 >= 3 ? 0.5 : 0;
        break;
      }
      case "buff": {
        const out = at2([0, 0, 1, 1, 0.7, 0.3]);
        const hunch = at2([0.6, 1, 0, 0, 0, 0]);
        p.squash = at2([0.96, 0.92, 1.06, 1.03, 1, 1]);
        lean(hunch * 1.6 - out * 1.2);
        p.haR = out > 0 ? v(1 - out, 5 + out * 4, 19 + out * 8) : v(4, 2, 17);
        p.haL = out > 0 ? v(1 - out, -5 - out * 4, 19 + out * 8) : v(4, -2, 17);
        p.w = norm(v(0, 0.6, 0.8));
        p.ftL = v(1, -3.5, 1);
        p.ftR = v(1, 3.5, 1);
        p.glow = at2([0.2, 0.5, 1, 0.8, 0.5, 0.2]);
        p.glowAt = "both";
        p.flap = out;
        break;
      }
      case "summon": {
        const c = at2([0, 0.8, 1.5, 1.5, 1, 0.3]);
        const g = at2([0.2, 0.5, 0.9, 1, 0.7, 0.3]);
        shift(0, -c);
        lean(c * 0.9);
        p.haR = v(1.5, 4.5, 23 + g * 8);
        p.haL = v(5 + c * 2, -3.5, 13 - c * 2.5);
        p.w = norm(v(0.2, 0.1, 1));
        p.ftL = v(3, -2.8, 1);
        p.knL = v(4.5, -2.6, 7.5 - c * 0.4);
        p.glow = g;
        p.glowAt = "L";
        break;
      }
    }
    if (fam === "bow") p.bow = { up: norm(add(v(0, 0, 1), mul(norm(sub(p.haL, p.shL)), 0.4))), aim: v(1, 0, 0), draw: 0, arrow: false };
  }
  function joint(a, b, len, bend) {
    const mid = lerp3(a, b, 0.5);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const k = Math.sqrt(Math.max(0, len * len - d / 2 * (d / 2)));
    return add(mid, mul(norm(bend), k));
  }
  function segDist(p, a, b) {
    const ab = sub(b, a);
    const l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
    const t4 = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / l2));
    const q = add(a, mul(ab, t4));
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }
  function regionOf(p, pose) {
    const c = p.kind === "cap" ? lerp3(p.a, p.b, 0.5) : p.kind === "poly" ? mul(p.pts.reduce((s, q) => add(s, q), [0, 0, 0]), 1 / p.pts.length) : p.a;
    const segs = [
      ["head", pose.neck, add(pose.head, [0, 0, 3])],
      ["armL", pose.shL, pose.haL],
      ["armR", pose.shR, add(pose.haR, mul(pose.w, 14))],
      ["legL", pose.hpL, pose.ftL],
      ["legR", pose.hpR, pose.ftR],
      ["torso", pose.hip, pose.chest]
    ];
    let best = "torso";
    let bd = Infinity;
    for (const [r, a, b] of segs) {
      const d = segDist(c, a, b) * (r === "torso" ? 0.8 : 1);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    return best;
  }
  function filterRegions(parts, pose, cfg) {
    if (!cfg.only && !cfg.missing?.length) return parts;
    const gore = [];
    const keep = parts.filter((p) => {
      const r = regionOf(p, pose);
      return cfg.only ? r === cfg.only : !cfg.missing.includes(r);
    });
    const stump2 = (at2, r) => gore.push({ kind: "sph", a: at2, r, ramp: GORE_RAMP });
    const cuts = cfg.only ? [cfg.only] : cfg.missing;
    for (const r of cuts) {
      if (r === "head") stump2(pose.neck, 2.2);
      else if (r === "armL") stump2(pose.shL, 2);
      else if (r === "armR") stump2(pose.shR, 2);
      else if (r === "legL") stump2(pose.hpL, 2.2);
      else if (r === "legR") stump2(pose.hpR, 2.2);
    }
    return [...keep, ...gore];
  }
  var GORE_RAMP = ramp("#2a0606", "#5a0c0c", "#8a1616", "#c03030");
  function bodyStyle(key) {
    const base = { torso: M.leather, torsoR: 4.4, hem: M.leather, hemLen: 4.5, hemR: 4.7, sleeve: M.tunic, sleeveR: 1.8, forearm: M.leather, dither: false, pauldrons: 0, strap: false, studs: false, bare: false };
    switch (key) {
      case "":
        return { ...base, torso: M.skin, torsoR: 4.1, hem: M.rag, hemLen: 3, hemR: 4.4, sleeve: M.skin, sleeveR: 1.6, forearm: M.skin, bare: true };
      case "body_leather":
        return { ...base, strap: true };
      case "body_scale":
        return { ...base, torso: M.scale, hem: M.scale, hemLen: 5.5, dither: true, sleeve: M.leather, forearm: M.leather };
      case "body_mail":
        return { ...base, torso: M.mail, hem: M.mail, hemLen: 5.5, dither: true, sleeve: M.mail, forearm: M.leather };
      case "body_plate":
        return { ...base, torso: M.plate, torsoR: 4.9, hem: M.plate, hemLen: 4.5, hemR: 4.4, sleeve: M.plate, forearm: M.plate, pauldrons: 2 };
      case "body_robe":
        return { ...base, torso: M.robe, hem: M.robe, hemLen: 11, hemR: 4.9, sleeve: M.robe, sleeveR: 2.1, forearm: M.robe };
      case "body_brigandine":
        return { ...base, torso: M.leather, torsoR: 4.6, hem: M.leather, hemLen: 5, sleeve: M.leather, forearm: M.leather, pauldrons: 1, studs: true };
      case "body_plate_robe":
        return { ...base, torso: M.plate, torsoR: 4.8, hem: M.robe, hemLen: 10, hemR: 4.9, sleeve: M.robe, sleeveR: 2, forearm: M.plate, pauldrons: 2 };
      case "body_scale_robe":
        return { ...base, torso: M.scale, dither: true, hem: M.robe, hemLen: 10, hemR: 4.9, sleeve: M.robe, sleeveR: 2.1, forearm: M.robe };
      default:
        return base;
    }
  }
  function heroParts(cfg, pose) {
    const { look } = cfg;
    const wl = look.weapon || (cfg.wk ? KIND_LOOK[cfg.wk] ?? "" : "");
    const pc = rampFrom(cfg.color);
    const parts = [];
    const cap3 = (a, b, r, rp, extra = {}) => parts.push({ kind: "cap", a, b, r, ramp: rp, ...extra });
    const sph3 = (a, r, rp, extra = {}) => parts.push({ kind: "sph", a, r, ramp: rp, ...extra });
    const dot3 = (a, ref, color, depthBias = 0.6) => parts.push({ kind: "dot", a, r: 1, ramp: M.skin, color, ref, depthBias });
    const bs = bodyStyle(look.body);
    const bodyTrim = TRIM[look.rar.body];
    for (const side of [-1, 1]) {
      const hp = side < 0 ? pose.hpL : pose.hpR;
      const ft = side < 0 ? pose.ftL : pose.ftR;
      const kn = (side < 0 ? pose.knL : pose.knR) ?? joint(hp, ft, 7.9, v(1, 0, 0.2));
      cap3(hp, kn, 2.2, M.pants);
      cap3(kn, ft, 1.9, bs.bare ? M.skin : M.pants);
      const toe = add(ft, v(2.3, 0, -0.2));
      switch (look.boots) {
        case "":
          cap3(ft, add(ft, v(1.9, 0, -0.3)), 1.25, M.skin, { depthBias: 0.2 });
          break;
        case "boots_wrap":
          cap3(lerp3(kn, ft, 0.55), ft, 2.05, M.wraps);
          cap3(ft, toe, 1.5, M.wraps, { depthBias: 0.2 });
          break;
        case "boots_soft":
          cap3(lerp3(kn, ft, 0.4), ft, 2.1, M.leather);
          cap3(lerp3(kn, ft, 0.38), lerp3(kn, ft, 0.46), 2.35, M.strap, { depthBias: 0.05 });
          cap3(ft, toe, 1.5, M.leather, { depthBias: 0.2 });
          break;
        case "boots_greave":
          cap3(lerp3(kn, ft, 0.12), ft, 2.3, M.plate);
          sph3(kn, 2.05, M.plate, { depthBias: 0.1 });
          cap3(ft, add(toe, v(0.3, 0, 0)), 1.6, M.plate, { depthBias: 0.2 });
          break;
        case "boots_slipper":
          cap3(lerp3(kn, ft, 0.8), ft, 1.95, M.silk);
          cap3(ft, add(ft, v(2.9, 0, 0.1)), 1.2, M.silk, { depthBias: 0.2 });
          break;
      }
      const bt = TRIM[look.rar.boots];
      if (bt && look.boots) cap3(lerp3(kn, ft, 0.5), lerp3(kn, ft, 0.56), 2.4, bt, { depthBias: 0.06 });
    }
    const hip = pose.hip;
    const hemEnd = add(hip, v(-0.4 - bs.hemLen * 0.05, 0, -bs.hemLen));
    cap3(add(hip, v(0, 0, 1)), hemEnd, bs.hemR + (bs.hemLen > 8 ? 0.4 : 0), bs.hem, { dither: bs.dither && bs.hem !== M.robe });
    if (bs.bare) {
      cap3(add(hip, v(2.6, 0, 0)), add(hip, v(3, 0.4, -5)), 1.5, M.rag, { depthBias: 0.1 });
    }
    cap3(add(hip, v(0, 0, 1)), pose.chest, bs.torsoR, bs.torso, { dither: bs.dither });
    if (bs.bare) {
      cap3(add(pose.shL, v(1.2, 1.2, -1)), add(pose.shR, v(1.2, -1.2, -1)), 0.5, M.skin, { bias: -0.4, depthBias: 0.1 });
    }
    if (bs.strap) cap3(add(pose.shL, v(0.9, 0.5, 0)), add(hip, v(1.2, 3.5, 2)), 0.8, M.strap, { depthBias: 0.6 });
    if (bs.studs) {
      for (let i = 0; i < 6; i++) {
        const pt = add(lerp3(add(hip, v(0, 0, 3)), pose.chest, i % 3 / 2.5 + 0.1), v(bs.torsoR * 0.9, i < 3 ? -1.6 : 1.6, 0));
        sph3(pt, 0.55, M.brass, { depthBias: 0.5 });
      }
    }
    if (bs.pauldrons) {
      sph3(pose.shL, 3.1, M.plate, { depthBias: 0.3 });
      if (bs.pauldrons === 2) sph3(pose.shR, 3.1, M.plate, { depthBias: 0.3 });
    }
    if (bodyTrim && look.body) {
      cap3(add(hemEnd, v(0, 0, 0.3)), add(hemEnd, v(0, 0, -0.2)), bs.hemR + (bs.hemLen > 8 ? 0.55 : 0.15), bodyTrim, { depthBias: 0.05 });
      cap3(add(pose.neck, v(0, 0, -1.6)), add(pose.neck, v(0, 0, -0.9)), 3.4, bodyTrim, { depthBias: 0.12 });
      if (bs.hem === M.robe) cap3(add(hip, v(4.6, 0, 1)), add(hemEnd, v(5.1, 0, 0.2)), 0.6, bodyTrim, { depthBias: 0.4 });
    }
    const beltR = bs.torsoR + 0.35;
    cap3(add(hip, v(0, 0, 2.2)), add(hip, v(0, 0, 3.2)), beltR + 0.1, pc, { depthBias: 0.15 });
    cap3(add(hip, v(-0.5, -4.2, 2.4)), add(hip, v(-1.6 - pose.run, -4.6, -4 + pose.flap * 0.4)), 1.15, pc);
    const beltTrim = TRIM[look.rar.belt];
    switch (look.belt) {
      case "belt_rope":
        cap3(add(hip, v(0, 0, 0.9)), add(hip, v(0, 0, 1.4)), beltR, M.rope, { depthBias: 0.16 });
        cap3(add(hip, v(beltR, 1.2, 1)), add(hip, v(beltR + 0.4, 1.6, -2.4)), 0.5, M.rope, { depthBias: 0.3 });
        break;
      case "belt_leather":
      case "belt_studded":
        cap3(add(hip, v(0, 0, 0.6)), add(hip, v(0, 0, 1.7)), beltR + 0.05, M.strap, { depthBias: 0.16 });
        sph3(add(hip, v(beltR, 0, 1.15)), 0.95, beltTrim ?? M.brass, { depthBias: 0.4 });
        if (look.belt === "belt_studded") for (const s of [-2.6, -1.4, 1.4, 2.6]) sph3(add(hip, v(beltR * 0.85, s, 1.15)), 0.45, M.steel, { depthBias: 0.4 });
        cap3(add(hip, v(0.5, 4.6, 0.6)), add(hip, v(0.5, 4.8, -1.6)), 1.2, M.leather, { depthBias: 0.2 });
        break;
      case "belt_chain":
        cap3(add(hip, v(0, 0, 0.8)), add(hip, v(0, 0, 1.5)), beltR, M.iron, { dither: true, depthBias: 0.16 });
        cap3(add(hip, v(beltR, -1, 1)), add(hip, v(beltR + 0.3, -1.3, -2)), 0.45, M.iron, { depthBias: 0.3 });
        break;
    }
    const glTrim = TRIM[look.rar.gloves];
    const elbowBend = (side) => v(-0.6, side * 0.6, -0.5);
    for (const side of [-1, 1]) {
      const sh = side < 0 ? pose.shL : pose.shR;
      const ha = side < 0 ? pose.haL : pose.haR;
      const el = joint(sh, ha, 6.1, elbowBend(side));
      cap3(sh, el, bs.sleeveR, bs.sleeve, { dither: bs.dither && bs.sleeve !== M.robe });
      cap3(el, ha, bs.sleeveR > 1.9 ? 1.8 : 1.6, bs.forearm, { dither: bs.dither && bs.forearm === M.mail });
      switch (look.gloves) {
        case "":
          sph3(ha, 1.7, M.skin, { depthBias: 0.1 });
          break;
        case "gloves_wrap":
          cap3(lerp3(el, ha, 0.55), ha, 1.7, M.wraps);
          sph3(ha, 1.85, M.wraps, { depthBias: 0.1 });
          break;
        case "gloves_leather":
          cap3(lerp3(el, ha, 0.62), lerp3(el, ha, 0.78), 1.95, M.leather);
          sph3(ha, 1.9, M.leather, { depthBias: 0.1 });
          break;
        case "gloves_gauntlet":
          cap3(lerp3(el, ha, 0.5), lerp3(el, ha, 0.8), 2.1, M.plate);
          sph3(ha, 2.2, M.plate, { depthBias: 0.1 });
          break;
        case "gloves_silk":
          cap3(lerp3(el, ha, 0.75), lerp3(el, ha, 0.85), 1.8, M.brass, { depthBias: 0.05 });
          sph3(ha, 1.65, M.silk, { depthBias: 0.1 });
          break;
      }
      if (glTrim && look.gloves) cap3(lerp3(el, ha, 0.7), lerp3(el, ha, 0.76), 2.15, glTrim, { depthBias: 0.07 });
      if (side < 0) offhandParts(parts, look, el, ha, pose, pc);
    }
    if (pose.glow && (pose.glowAt === "L" || pose.glowAt === "both")) glowAt(parts, pose.haL, pose.glow);
    if (pose.glow && (pose.glowAt === "R" || pose.glowAt === "both")) glowAt(parts, pose.haR, pose.glow);
    cap3(add(pose.neck, v(0, 0, -0.6)), add(pose.neck, v(0.2, 0, 0.9)), 3.3, pc, { depthBias: 0.2 });
    const back = add(pose.neck, v(-2.4, 0.5, 0));
    const tailMid = add(back, v(-2.5 - pose.run * 1.5, 0.6, -2.5 + pose.flap));
    const tailEnd = add(tailMid, v(-2 - pose.run * 2.5, 0.4, -2.5 - pose.flap * 0.6));
    cap3(back, tailMid, 1.4, pc);
    cap3(tailMid, tailEnd, 1.2, pc);
    const hd = pose.head;
    const eye = (s, f = 4.4) => ({ kind: "dot", a: add(hd, hv(f, s, 0.2)), r: 1, ramp: M.skin, color: EYE, ref: add(hd, hv(f - 1, s, 0.2)), depthBias: 0.6 });
    const face = (r = 3.3) => sph3(add(hd, hv(2.4, 0, -0.9)), r * HS, M.skin, { depthBias: 0.35 });
    const hTrim = TRIM[look.rar.helmet];
    switch (look.helmet) {
      case "":
        sph3(hd, 4.7 * HS, M.skin, { depthBias: 0.3 });
        sph3(add(hd, hv(-0.9, 0, 1.1)), 4.75 * HS, M.hair, { depthBias: 0.31 });
        parts.push(eye(-1.7), eye(1.7));
        break;
      case "circlet":
        sph3(hd, 4.7 * HS, M.skin, { depthBias: 0.3 });
        sph3(add(hd, hv(-0.9, 0, 1.1)), 4.75 * HS, M.hair, { depthBias: 0.31 });
        parts.push(eye(-1.7), eye(1.7));
        for (let i = 0; i < 10; i++) {
          const a0 = i / 10 * Math.PI * 2;
          const a1 = (i + 1) / 10 * Math.PI * 2;
          const R8 = 5.05;
          cap3(add(hd, hv(Math.cos(a0) * R8 - 0.4, Math.sin(a0) * R8, 2.2)), add(hd, hv(Math.cos(a1) * R8 - 0.4, Math.sin(a1) * R8, 2.2)), 0.42, hTrim ?? M.brass, { depthBias: 0.45 });
        }
        sph3(add(hd, hv(4.7, 0, 2.3)), 0.75, M.gem, { depthBias: 0.6 });
        break;
      case "hood":
        sph3(add(hd, hv(-0.4, 0, 0.6)), 5.5 * HS, M.hood, { depthBias: 0.31 });
        cap3(add(hd, hv(-1, 0, 4.2)), add(hd, hv(-4.6, 0, 3)), 1.6 * HS, M.hood, { depthBias: 0.3 });
        cap3(add(hd, hv(-3, 0, -1)), add(pose.neck, v(-3.4, 0, -3)), 3.2 * HS, M.hood, { depthBias: -0.2 });
        parts.push({ kind: "sph", a: add(hd, hv(2.7, 0, -0.6)), r: 3.2 * HS, ramp: [M.skin[0], M.skin[0], M.skin[1], M.skin[2]], depthBias: 0.35 });
        parts.push(eye(-1.3), eye(1.3));
        if (hTrim) cap3(add(hd, hv(3.6, -3, 2.6)), add(hd, hv(3.6, 3, 2.6)), 0.5, hTrim, { depthBias: 0.5 });
        break;
      case "coif":
        sph3(add(hd, hv(-0.4, 0, 0.5)), 5.05 * HS, M.leather, { depthBias: 0.31 });
        face(3.2);
        for (const s of [-1, 1]) cap3(add(hd, hv(0.5, s * 3.6, 0)), add(hd, hv(1.4, s * 3.4, -3.6)), 1.2 * HS, M.leather, { depthBias: 0.4 });
        parts.push(eye(-1.4), eye(1.4));
        if (hTrim) cap3(add(hd, hv(3.4, -3, 2.2)), add(hd, hv(3.4, 3, 2.2)), 0.45, hTrim, { depthBias: 0.5 });
        break;
      case "helm_open":
      case "helm_horned": {
        sph3(add(hd, hv(-0.5, 0, 1)), 5.2 * HS, M.plate, { depthBias: 0.31 });
        face(3.3);
        parts.push(eye(-1.4), eye(1.4));
        cap3(add(hd, hv(4.4, 0, 2.6)), add(hd, hv(4.9, 0, -0.6)), 0.55, M.plate, { depthBias: 0.62 });
        parts.push({ kind: "disc", a: add(hd, hv(-0.3, 0, 1.7)), r: 5.6 * HS, n: v(0, 0, 1), ramp: M.plate, rim: rgba("#2a2d33"), depthBias: 0.3 });
        if (look.helmet === "helm_horned") {
          for (const s of [-1, 1]) {
            const a0 = add(hd, hv(-0.5, s * 4.2, 3));
            const a1 = add(hd, hv(-1.5, s * 6.8, 5.5));
            const a2 = add(hd, hv(0.8, s * 7.6, 9));
            cap3(a0, a1, 1.1, M.bone, { depthBias: 0.35 });
            cap3(a1, a2, 0.7, M.bone, { depthBias: 0.35 });
          }
        }
        if (hTrim) cap3(add(hd, hv(-0.4, -4.9, 1.9)), add(hd, hv(-0.4, 4.9, 1.9)), 0.5, hTrim, { depthBias: 0.45 });
        break;
      }
      case "helm_great":
        cap3(add(hd, hv(0, 0, -1.6)), add(hd, hv(0, 0, 1.4)), 5.1 * HS, M.plate, { depthBias: 0.31 });
        cap3(add(hd, hv(2.2, 0, 5.3)), add(hd, hv(-3.5, 0, 4.5)), 1.1 * HS, hTrim ?? M.brass, { depthBias: 0.4 });
        for (let s = -2.4; s <= 2.4; s += 0.8) dot3(add(hd, hv(5.1, s, 0.2)), add(hd, hv(3.8, s * 0.6, 0.2)), SLIT);
        dot3(add(hd, hv(5.2, 0, -1.4)), add(hd, hv(3.8, 0, -1.4)), SLIT);
        break;
    }
    weaponParts(parts, wl, pose, TRIM[look.rar.weapon], look.rar.weapon >= 3);
    return parts;
  }
  function glowAt(parts, at2, k) {
    if (k <= 0.05) return;
    parts.push({ kind: "sph", a: at2, r: 1.4 + k * 1.6, ramp: M.glow, depthBias: 0.8, dither: k < 0.5 });
  }
  function offhandParts(parts, look, el, ha, pose, pc) {
    const trim = TRIM[look.rar.offhand];
    const c = add(lerp3(el, ha, 0.55), v(0.4, -1.8, 0));
    const n2 = norm(v(0.25, -1, 0.1));
    const u = v(0, 0, 1);
    const t4 = norm(cross(n2, u));
    const P3 = (a, b) => add(add(c, mul(t4, a)), mul(u, b));
    const rim = (pts, rp) => {
      for (let i = 0; i < pts.length; i++) parts.push({ kind: "cap", a: pts[i], b: pts[(i + 1) % pts.length], r: 0.5, ramp: rp, depthBias: 0.45 });
    };
    switch (look.offhand) {
      case "shield_buckler":
        parts.push({ kind: "disc", a: c, r: 3.4, n: n2, ramp: M.leather, rim: rgba("#2b1b10"), boss: rgba(trim ? "#e6c36a" : "#9aa2ae"), depthBias: 0.4 });
        break;
      case "shield_round":
        parts.push({ kind: "disc", a: c, r: 5, n: n2, ramp: M.wood, rim: rgba(trim ? "#c8a040" : "#3a3c42"), boss: rgba("#9aa2ae"), depthBias: 0.4 });
        break;
      case "shield_kite": {
        const pts = [P3(0, 6.5), P3(4.2, 2.2), P3(0, -8), P3(-4.2, 2.2)];
        parts.push({ kind: "poly", a: c, r: 0, ramp: M.plate, pts, color: M.plate[1], depthBias: 0.4 });
        parts.push({ kind: "disc", a: add(P3(0, 1), mul(n2, 0.2)), r: 1.8, n: n2, ramp: pc, rim: pc[0], boss: pc[2], depthBias: 0.42 });
        rim(pts, trim ?? M.iron);
        break;
      }
      case "shield_tower": {
        const pts = [P3(-4, 8.5), P3(4, 8.5), P3(4, -8.5), P3(-4, -8.5)];
        parts.push({ kind: "poly", a: c, r: 0, ramp: M.wood, pts, color: M.wood[1], depthBias: 0.4 });
        for (const b of [5, 0, -5]) parts.push({ kind: "cap", a: P3(-3.8, b), b: P3(3.8, b), r: 0.45, ramp: M.iron, depthBias: 0.43 });
        rim(pts, trim ?? M.iron);
        break;
      }
      case "focus_orb": {
        const o = add(ha, v(0.6, 0, 3.6));
        parts.push({ kind: "sph", a: o, r: 2.1, ramp: M.glow, depthBias: 0.5 });
        parts.push({ kind: "cap", a: add(o, v(-1.8, -1.8, -0.6)), b: add(o, v(1.8, 1.8, 0.6)), r: 0.35, ramp: trim ?? M.brass, depthBias: 0.55 });
        break;
      }
      case "quiver": {
        const top = add(pose.neck, v(-3.4, 2.2, 1.5));
        const bot = add(pose.hip, v(-3.6, 2.8, 0));
        parts.push({ kind: "cap", a: top, b: bot, r: 1.7, ramp: M.leather, depthBias: -0.3 });
        for (const s of [-0.7, 0, 0.7]) parts.push({ kind: "cap", a: add(top, v(0, s, 0)), b: add(top, v(0.3, s * 1.4, 2.6)), r: 0.45, ramp: s === 0 ? M.gem : M.bone, depthBias: -0.25 });
        if (trim) parts.push({ kind: "cap", a: lerp3(top, bot, 0.2), b: lerp3(top, bot, 0.26), r: 1.9, ramp: trim, depthBias: -0.28 });
        break;
      }
    }
  }
  var UNIQUE_BLADE = ramp("#4a3a30", "#9a8070", "#e6cbb0", "#fff4e6");
  METAL_RAMPS.add(UNIQUE_BLADE);
  var BLOOD_C = rgba("#6a0606");
  var bladeBlood = 0;
  var bloodCache = /* @__PURE__ */ new Map();
  function bloodied(base) {
    if (bladeBlood <= 0) return base;
    const k = base.join(",") + "|" + bladeBlood;
    let r = bloodCache.get(k);
    if (!r) {
      const t4 = [0.25, 0.45, 0.65][Math.min(3, bladeBlood) - 1];
      r = base.map((c, i) => mixColor(c, BLOOD_C, i === 3 ? t4 * 0.6 : t4));
      bloodCache.set(k, r);
    }
    return r;
  }
  function weaponParts(parts, wl, pose, trim, unique) {
    const cap3 = (a, b, r, rp, extra = {}) => parts.push({ kind: "cap", a, b, r, ramp: rp, ...extra });
    const sph3 = (a, r, rp, extra = {}) => parts.push({ kind: "sph", a, r, ramp: rp, ...extra });
    const poly2 = (pts, rp, ci = 2, depthBias = 0.03) => parts.push({ kind: "poly", a: pts[0], r: 0, ramp: rp, pts, color: rp[ci], depthBias });
    const ha = pose.haR;
    const w = pose.w;
    const upv = Math.abs(w[2]) > 0.95 ? v(1, 0, 0) : v(0, 0, 1);
    const side = norm(cross(w, upv));
    const at2 = (t4) => add(ha, mul(w, t4));
    const guard2 = trim ?? M.brass;
    const blade2 = bloodied(unique ? UNIQUE_BLADE : M.steel);
    let edge2 = norm(cross(w, v(0, 1, 0)));
    if (edge2[0] < 0) edge2 = mul(edge2, -1);
    const e = (t4, k) => add(at2(t4), mul(edge2, k));
    let tip = null;
    switch (wl) {
      case "sword_short":
        cap3(at2(-2), at2(0.8), 0.85, M.strap);
        cap3(add(at2(1.2), mul(side, -2.4)), add(at2(1.2), mul(side, 2.4)), 0.8, guard2, { depthBias: 0.05 });
        cap3(at2(1.8), at2(11), 1.1, blade2, { depthBias: 0.05 });
        tip = at2(11);
        break;
      case "sword_long":
        cap3(at2(-2.6), at2(1), 0.9, M.strap);
        sph3(at2(-2.9), 0.9, guard2);
        cap3(add(at2(1.4), mul(side, -3.2)), add(at2(1.4), mul(side, 3.2)), 0.9, guard2, { depthBias: 0.05 });
        cap3(at2(2), at2(15.5), 1.15, blade2, { depthBias: 0.05 });
        tip = at2(15.5);
        break;
      case "greatsword":
        cap3(at2(-5), at2(1), 0.95, M.strap);
        sph3(at2(-5.3), 1.1, guard2);
        cap3(add(at2(1.5), mul(side, -4.2)), add(at2(1.5), mul(side, 4.2)), 1.05, guard2, { depthBias: 0.05 });
        cap3(at2(2.2), at2(21), 1.55, blade2, { depthBias: 0.05 });
        cap3(at2(2.4), at2(18), 0.45, M.iron, { depthBias: 0.07, bias: -0.5 });
        tip = at2(21.5);
        break;
      case "axe_hand":
      case "greataxe": {
        const big = wl === "greataxe";
        const L2 = big ? 19 : 13.5;
        cap3(at2(big ? -6 : -3), at2(L2), big ? 1.1 : 1, M.wood);
        poly2([e(L2 - 4.5, 0.8), e(L2 + 0.3, 0.8), e(L2 + 2.1, big ? 8.5 : 7), e(L2 - 6.1, big ? 8.5 : 7)], blade2, 1, 0.02);
        cap3(e(L2 + 1.9, big ? 8.2 : 6.7), e(L2 - 5.9, big ? 8.2 : 6.7), 0.55, blade2, { bias: 0.8, depthBias: 0.03 });
        if (big) poly2([e(L2 - 4, -0.8), e(L2, -0.8), e(L2 + 1.2, -6), e(L2 - 5.2, -6)], blade2, 1, 0.02);
        else poly2([e(L2 - 3, -0.6), e(L2 - 1, -0.6), e(L2 - 2, -3.2)], blade2, 0, 0.02);
        if (trim) cap3(at2(L2 - 5), at2(L2 + 0.5), 1.25, trim, { depthBias: 0.04 });
        tip = e(L2, 5);
        break;
      }
      case "mace":
      case "sceptre": {
        cap3(at2(-2.5), at2(10), 0.85, wl === "sceptre" ? M.brass : M.wood);
        const hdp = at2(11.5);
        if (wl === "mace") {
          sph3(hdp, 2.3, M.iron);
          for (const k of [-1, 1]) {
            cap3(add(hdp, mul(side, 2.4 * k)), add(add(hdp, mul(side, 2.6 * k)), mul(w, 0.8)), 0.65, M.iron, { depthBias: 0.04 });
            cap3(add(hdp, mul(edge2, 2.4 * k)), add(add(hdp, mul(edge2, 2.6 * k)), mul(w, 0.8)), 0.65, M.iron, { depthBias: 0.04 });
          }
        } else {
          sph3(hdp, 1.9, trim ?? M.brass);
          sph3(add(hdp, mul(w, 1.6)), 1.15, M.gem, { depthBias: 0.05 });
        }
        tip = at2(13);
        break;
      }
      case "maul":
        cap3(at2(-6), at2(17), 1.05, M.wood);
        cap3(add(at2(18.5), mul(edge2, -3.2)), add(at2(18.5), mul(edge2, 3.6)), 2.6, M.iron);
        if (trim) cap3(add(at2(18.5), mul(edge2, -1)), add(at2(18.5), mul(edge2, 1)), 2.8, trim, { depthBias: 0.03 });
        tip = at2(18.5);
        break;
      case "dagger":
        cap3(at2(-1.6), at2(0.8), 0.8, M.strap);
        cap3(add(at2(1.1), mul(side, -1.8)), add(at2(1.1), mul(side, 1.8)), 0.7, guard2, { depthBias: 0.05 });
        cap3(at2(1.6), at2(8.5), 0.9, blade2, { depthBias: 0.05 });
        tip = at2(8.5);
        break;
      case "claw":
        for (const s of [-1.1, 0, 1.1]) {
          const b0 = add(at2(0.8), mul(side, s));
          cap3(b0, add(add(b0, mul(w, 5.5)), mul(edge2, 1.2)), 0.5, M.bone, { depthBias: 0.05 });
        }
        cap3(at2(-1), at2(1), 1.3, guard2);
        tip = at2(6);
        break;
      case "spear":
      case "quarterstaff": {
        if (wl === "quarterstaff") {
          cap3(at2(-12), at2(14), 0.9, M.wood);
          for (const t4 of [-12, 14]) cap3(at2(t4 - 1), at2(t4 + 0.4), 1.15, trim ?? M.iron);
          tip = at2(14);
          break;
        }
        cap3(at2(-12), at2(20), 0.85, M.wood);
        cap3(at2(19), at2(20.5), 1.1, guard2);
        const b = at2(20.5);
        const tp = at2(27);
        poly2([add(b, mul(side, 1.9)), tp, add(b, mul(side, -1.9))], blade2, 2, 0.03);
        cap3(lerp3(b, tp, 0.1), lerp3(b, tp, 0.85), 0.5, blade2, { bias: 0.6, depthBias: 0.01 });
        tip = tp;
        break;
      }
      case "wand":
        cap3(at2(-1), at2(8), 0.55, M.bone);
        sph3(at2(8.4), 0.9, trim ?? M.gem, { depthBias: 0.05 });
        tip = at2(8.6);
        break;
      case "staff": {
        cap3(at2(-11), at2(14.5), 0.9, M.wood);
        for (const k of [-1, 1]) cap3(at2(14.5), add(at2(17), mul(side, 1.6 * k)), 0.6, M.wood, { depthBias: 0.02 });
        cap3(at2(14.5), add(at2(17.5), mul(edge2, 1.4)), 0.6, M.wood);
        sph3(at2(16.4), 1.3, trim ?? M.glow, { depthBias: 0.04 });
        tip = at2(16.4);
        break;
      }
      case "bow":
        if (pose.bow) bowParts(parts, pose, trim, unique);
        break;
      case "crossbow": {
        cap3(at2(-4), at2(10), 1, M.wood);
        const fr = at2(9);
        const pull = at2(4.5);
        const l = add(add(fr, mul(side, -6)), mul(w, -2));
        const r = add(add(fr, mul(side, 6)), mul(w, -2));
        cap3(fr, l, 0.6, trim ?? M.iron);
        cap3(fr, r, 0.6, trim ?? M.iron);
        cap3(l, pull, 0.22, M.bone, { depthBias: 0.05 });
        cap3(r, pull, 0.22, M.bone, { depthBias: 0.05 });
        cap3(pull, at2(10.5), 0.35, M.wood, { depthBias: 0.06 });
        tip = at2(10.5);
        break;
      }
    }
    if (tip && pose.glow && pose.glowAt === "tip") glowAt(parts, tip, pose.glow);
    else if (pose.glow && pose.glowAt === "tip") glowAt(parts, pose.haR, pose.glow);
    if (tip && unique) parts.push({ kind: "sph", a: tip, r: 1.1, ramp: TRIM[3], depthBias: 0.07, dither: true });
  }
  function bowParts(parts, pose, trim, unique) {
    const b = pose.bow;
    const g = pose.haL;
    const u = norm(b.up);
    const aim = norm(b.aim);
    const flex = 2.6 + b.draw * 1.6;
    const pt = (k) => add(add(g, mul(u, k * 9.5)), mul(aim, -flex * k * k + (Math.abs(k) < 0.3 ? 0.6 : 0)));
    const wood = unique ? M.bone : M.wood;
    const ks = [-1, -0.65, -0.3, 0, 0.3, 0.65, 1];
    for (let i = 0; i < ks.length - 1; i++) parts.push({ kind: "cap", a: pt(ks[i]), b: pt(ks[i + 1]), r: Math.abs(ks[i]) < 0.35 ? 0.85 : 0.6, ramp: wood, depthBias: 0.1 });
    parts.push({ kind: "cap", a: pt(-0.12), b: pt(0.12), r: 1, ramp: trim ?? M.strap, depthBias: 0.12 });
    const top = add(pt(1), mul(aim, -0.3));
    const bot = add(pt(-1), mul(aim, -0.3));
    const str = ramp("#4a4436", "#8a8270", "#c8c0aa", "#ece6d6");
    if (b.draw > 0.05) {
      const nock = pose.haR;
      parts.push({ kind: "cap", a: top, b: nock, r: 0.2, ramp: str, depthBias: 0.15 });
      parts.push({ kind: "cap", a: bot, b: nock, r: 0.2, ramp: str, depthBias: 0.15 });
    } else parts.push({ kind: "cap", a: top, b: bot, r: 0.2, ramp: str, depthBias: 0.15 });
    if (b.arrow) {
      const nock = b.draw > 0.05 ? pose.haR : add(g, mul(aim, -3));
      const dir = norm(sub(add(g, mul(aim, 3)), nock));
      const head = add(nock, mul(dir, 15));
      parts.push({ kind: "cap", a: nock, b: head, r: 0.3, ramp: M.wood, depthBias: 0.2 });
      parts.push({ kind: "cap", a: head, b: add(head, mul(dir, 1.6)), r: 0.6, ramp: M.steel, depthBias: 0.21 });
      parts.push({ kind: "cap", a: add(nock, mul(dir, 0.4)), b: add(nock, mul(dir, 2.4)), r: 0.6, ramp: M.gem, depthBias: 0.19 });
    }
  }
  var POSE_PTS = ["hip", "chest", "neck", "head", "shL", "shR", "haL", "haR", "hpL", "hpR", "ftL", "ftR", "w"];
  function heroPoseAt(anim, ft, wk, wl = "") {
    const n2 = HERO_FRAMES[anim];
    const loop2 = LOOPING.has(anim) || anim === "idle" || anim === "run";
    const f0 = Math.floor(ft);
    const t4 = ft - f0;
    const a = heroPose(anim, loop2 ? (f0 % n2 + n2) % n2 : Math.min(n2 - 1, f0), wk, wl);
    if (t4 < 0.02) return a;
    const b = heroPose(anim, loop2 ? ((f0 + 1) % n2 + n2) % n2 : Math.min(n2 - 1, f0 + 1), wk, wl);
    const out = { ...a };
    for (const k of POSE_PTS) out[k] = lerp3(a[k], b[k], t4);
    out.w = norm(out.w);
    for (const k of ["knL", "knR"]) {
      const ka = a[k];
      const kb = b[k];
      if (ka && kb) out[k] = lerp3(ka, kb, t4);
      else out[k] = t4 < 0.5 ? ka : kb;
    }
    out.run = a.run + (b.run - a.run) * t4;
    out.flap = a.flap + (b.flap - a.flap) * t4;
    out.glow = (a.glow ?? 0) + ((b.glow ?? 0) - (a.glow ?? 0)) * t4;
    out.glowAt = a.glowAt ?? b.glowAt;
    out.lift = (a.lift ?? 0) + ((b.lift ?? 0) - (a.lift ?? 0)) * t4;
    if (a.rot || b.rot) {
      const ra = a.rot ?? { ang: 0, pivot: b.rot.pivot };
      const rb = b.rot ?? { ang: 0, pivot: ra.pivot };
      let d = rb.ang - ra.ang;
      if (anim === "roll" && d < 0) d += Math.PI * 2;
      out.rot = { ang: ra.ang + d * t4, pivot: lerp3(ra.pivot, rb.pivot, t4) };
    }
    if (a.bow && b.bow) {
      out.bow = {
        up: norm(lerp3(a.bow.up, b.bow.up, t4)),
        aim: norm(lerp3(a.bow.aim, b.bow.aim, t4)),
        draw: a.bow.draw + (b.bow.draw - a.bow.draw) * t4,
        arrow: t4 < 0.5 ? a.bow.arrow : b.bow.arrow
      };
    }
    return out;
  }
  function heroLiftAt(anim, ft) {
    if (anim !== "slam" && anim !== "leap") return 0;
    return (heroPoseAt(anim, ft, null).lift ?? 0) * SCALE;
  }
  var SUBFRAMES = 3;
  function buildHeroFrame(cfg, dir, anim, ft, flash) {
    const wl = cfg.look.weapon || (cfg.wk ? KIND_LOOK[cfg.wk] ?? "" : "");
    const pose = heroPoseAt(anim, ft, cfg.wk, wl);
    bladeBlood = cfg.blood ?? 0;
    const parts = filterRegions(heroParts(cfg, pose), pose, cfg);
    bladeBlood = 0;
    if (pose.rot) {
      const { ang, pivot } = pose.rot;
      transformParts(parts, (q) => rotS(q, ang, pivot));
    }
    return paintSprite(parts, dirToWorldAngle(dir, DIRS), SCALE, W, H, AX, AY, flash);
  }
  var cache = /* @__PURE__ */ new Map();
  function heroFrame(cfg, lookCode2, dir, anim, frameIn, flash = false) {
    const frame2 = Math.round(frameIn * SUBFRAMES) / SUBFRAMES;
    const gk = (cfg.only ? "o" + cfg.only : cfg.missing?.length ? "m" + cfg.missing.join(".") : "") + (cfg.blood ? "b" + cfg.blood : "");
    const key = `${lookCode2}|${cfg.color}|${cfg.wk}|${dir}|${anim}|${frame2}|${flash ? 1 : 0}|${spriteDensity()}${gk}`;
    let s = cache.get(key);
    if (!s) {
      if (!canBuild()) {
        const base = `${lookCode2}|${cfg.color}|${cfg.wk}|`;
        const d = spriteDensity();
        const fb = cache.get(`${base}${dir}|${anim}|${Math.floor(frame2)}|0|${d}`) ?? cache.get(`${base}${dir}|${anim}|0|0|${d}`) ?? cache.get(`${base}${dir}|idle|0|0|${d}`);
        if (fb) return fb;
      }
      if (cache.size > 6e3) cache.clear();
      s = buildHeroFrame(cfg, dir, anim, frame2, flash);
      cache.set(key, s);
    }
    return s;
  }

  // src/client/gfx/poses.ts
  var skills = /* @__PURE__ */ new Map();
  var reacts = /* @__PURE__ */ new Map();
  var now = () => performance.now();
  function playPose(entityId, pose, durationMs, dir) {
    const a = { pose, start: now(), dur: Math.max(60, durationMs), dir };
    if (pose === "flinch" || pose === "stagger") {
      const cur = reacts.get(entityId);
      if (pose === "flinch" && cur?.pose === "stagger" && now() - cur.start < cur.dur) return;
      reacts.set(entityId, a);
    } else skills.set(entityId, a);
  }
  function stateOf(a, t4) {
    const n2 = HERO_FRAMES[a.pose];
    const k = (t4 - a.start) / a.dur;
    let frame2;
    if (LOOPING.has(a.pose)) frame2 = (t4 - a.start) / 1e3 * 7 % n2;
    else frame2 = Math.min(n2 - 1, k * (n2 - 1e-3));
    return { anim: a.pose, frame: frame2, dir: a.dir, weak: a.pose === "flinch" };
  }
  function currentPose(entityId) {
    const t4 = now();
    const r = reacts.get(entityId);
    if (r && t4 - r.start >= r.dur) reacts.delete(entityId);
    const s = skills.get(entityId);
    if (s && t4 - s.start >= s.dur) skills.delete(entityId);
    const rr3 = reacts.get(entityId);
    if (rr3?.pose === "stagger") return stateOf(rr3, t4);
    const ss = skills.get(entityId);
    if (ss) return stateOf(ss, t4);
    if (rr3) return stateOf(rr3, t4);
    return null;
  }

  // src/client/gfx/monsters.ts
  var R = {
    gnashHide: ramp("#1b1915", "#34302a", "#504a3f", "#6c6554"),
    gnashBelly: ramp("#28221d", "#433930", "#5e5144", "#786a5a"),
    gnashMouth: ramp("#160505", "#330b0b", "#561412", "#74221c"),
    teeth: ramp("#7a735f", "#ada58c", "#d0c8ae", "#ece6d2"),
    claw: ramp("#14100d", "#2a221b", "#40362b", "#58493a"),
    robe: ramp("#110e0b", "#201b15", "#322a20", "#463b2e"),
    robeHem: ramp("#0b0908", "#16120e", "#231d16", "#332a20"),
    seerSkin: ramp("#38332a", "#655d4e", "#8f8670", "#b1a990"),
    wood: ramp("#17100a", "#2d2014", "#45321f", "#5e462c"),
    orb: ramp("#1d5450", "#45ab9c", "#a0eedd", "#eafff9"),
    orbHot: ramp("#33918a", "#86ecd8", "#d8fff4", "#ffffff"),
    cragSkin: ramp("#1b1715", "#332c28", "#4d433d", "#685b53"),
    cragRock: ramp("#232327", "#3e3e44", "#605f66", "#838188"),
    cragMoss: ramp("#191c14", "#282d20", "#3a412e", "#4f573e"),
    cragFist: ramp("#211d1b", "#3c3532", "#5a504a", "#776a62")
  };
  var GLOW_Y = rgba("#ff5a22");
  var GLOW_G = rgba("#a8fff0");
  var GLOW_R = rgba("#ff4a2a");
  var DARK = rgba("#0b0605");
  var cap = (a, b, r, rp, x2 = {}) => ({ kind: "cap", a, b, r, ramp: rp, ...x2 });
  var sph = (a, r, rp, x2 = {}) => ({ kind: "sph", a, r, ramp: rp, ...x2 });
  var dot = (a, ref, color, r = 1) => ({ kind: "dot", a, ref, r, color, ramp: R.teeth, depthBias: 0.8 });
  function gnashParts(anim, f) {
    let lunge = 0;
    let crouch = 0;
    let jaw = 0.25;
    let gait = 0;
    let bob = 0;
    if (anim === "idle") {
      bob = [0, 0.4, 0.7, 0.4][f] ?? 0;
      jaw = 0.2 + bob * 0.15;
    } else if (anim === "move") {
      gait = f / 6 * Math.PI * 2;
      bob = Math.abs(Math.sin(gait)) * 1.4;
      jaw = 0.35;
    } else if (anim === "windup") {
      const t4 = (f + 1) / 4;
      crouch = t4 * 2.6;
      jaw = 0.4 + t4 * 0.6;
      lunge = -t4 * 2;
    } else if (anim === "strike") {
      lunge = [5, 6, 3][f] ?? 0;
      jaw = [1, 0.1, 0.3][f] ?? 0;
    }
    const z0 = 8 - crouch + bob * 0.5;
    const P3 = [];
    const body0 = v(-6 + lunge, 0, z0 + 0.5);
    const body1 = v(2 + lunge, 0, z0 + 4);
    P3.push(cap(body0, body1, 4.4, R.gnashHide));
    P3.push(cap(add(body0, v(1, 0, -2.2)), add(body1, v(-1, 0, -2.4)), 3.6, R.gnashBelly, { depthBias: -0.3 }));
    for (let i = 0; i < 4; i++) {
      const b = lerp3(body0, body1, i / 3);
      P3.push(cap(add(b, v(0, 0, 3.2)), add(b, v(-1.6, 0, 5.6 - i * 0.4)), 0.9, R.teeth, { depthBias: -0.2 }));
    }
    const legs = [
      [2.5 + lunge, -3.2, 0],
      [2.5 + lunge, 3.2, Math.PI],
      [-5 + lunge, -3.2, Math.PI],
      [-5 + lunge, 3.2, 0]
    ];
    for (const [lf, ls, ph] of legs) {
      const sw = Math.sin(gait + ph) * (anim === "move" ? 3.5 : 0);
      const lift = anim === "move" ? Math.max(0, Math.cos(gait + ph)) * 2.2 : 0;
      const top = v(lf, ls, z0 - 1);
      const foot = v(lf + sw + (anim === "strike" ? 1.5 : 0), ls * 1.15, 0.8 + lift);
      const knee = v((lf + foot[0]) / 2 + (lf < 0 ? -1.5 : 1), ls * 1.2, (z0 + foot[2]) / 2);
      P3.push(cap(top, knee, 1.9, R.gnashHide));
      P3.push(cap(knee, foot, 1.4, R.gnashHide));
      P3.push(cap(foot, add(foot, v(1.6, 0, -0.2)), 1, R.claw));
    }
    P3.push(cap(add(body0, v(-3, 0, 1)), add(body0, v(-8, 0, 3 + bob)), 1.4, R.gnashHide));
    P3.push(cap(add(body0, v(-8, 0, 3 + bob)), add(body0, v(-11, 0.5, 1.5 + bob)), 0.9, R.claw));
    const hd = add(body1, v(4, 0, 1));
    P3.push(sph(hd, 4.5, R.gnashHide, { depthBias: 0.2 }));
    P3.push(cap(add(hd, v(-1.2, -2.6, 2.6)), add(hd, v(-6, -6, 5)), 0.8, R.gnashHide));
    P3.push(cap(add(hd, v(-1.2, 2.6, 2.6)), add(hd, v(-6, 6, 5)), 0.8, R.gnashHide));
    const snout = add(hd, v(4.5, 0, 0.6));
    P3.push(cap(add(hd, v(1.5, 0, 0.6)), snout, 3.4, R.gnashHide, { depthBias: 0.25 }));
    const jawOpen = jaw * 4.2;
    const lowJaw = add(hd, v(4, 0, -2.2 - jawOpen));
    P3.push(cap(add(hd, v(1, 0, -2)), lowJaw, 2.8, R.gnashBelly, { depthBias: 0.22 }));
    if (jawOpen > 1) P3.push(cap(add(hd, v(3.2, 0, -0.5)), add(hd, v(4.2, 0, -1.5 - jawOpen * 0.5)), 1.8, R.gnashMouth, { depthBias: 0.24 }));
    for (const s of [-2.4, -1.2, 0, 1.2, 2.4]) {
      P3.push(dot(add(snout, v(1.3 - Math.abs(s) * 0.3, s, -2.2)), add(snout, v(-0.5, s * 0.5, -1.5)), R.teeth[3]));
      P3.push(dot(add(lowJaw, v(1 - Math.abs(s) * 0.3, s * 0.9, 1.6)), add(lowJaw, v(-1, s * 0.5, 1)), R.teeth[2]));
    }
    P3.push(dot(add(hd, v(3, -2.4, 2.4)), add(hd, v(1, -1.4, 2)), GLOW_Y));
    P3.push(dot(add(hd, v(3, 2.4, 2.4)), add(hd, v(1, 1.4, 2)), GLOW_Y));
    return P3;
  }
  function seerParts(anim, f) {
    let sway = 0;
    let bob = 0;
    let raise = 0;
    let thrust = 0;
    let hot = false;
    if (anim === "idle") {
      sway = [0, 0.5, 0, -0.5][f] ?? 0;
      bob = [0, 0.3, 0.6, 0.3][f] ?? 0;
    } else if (anim === "move") {
      const ph = f / 6 * Math.PI * 2;
      bob = Math.abs(Math.sin(ph)) * 1.2;
      sway = Math.sin(ph) * 0.8;
    } else if (anim === "windup") {
      raise = (f + 1) / 4;
      hot = f >= 2;
    } else if (anim === "strike") {
      thrust = [1, 0.8, 0.4][f] ?? 0;
      hot = f === 0;
    }
    const P3 = [];
    const z2 = bob * 0.5;
    P3.push(cap(v(-0.5, sway * 0.3, 2 + z2 * 0.2), v(0, 0, 3), 6.4, R.robeHem));
    P3.push(cap(v(0, 0, 4 + z2), v(1, sway * 0.2, 11 + z2), 5.4, R.robe));
    for (const [a, l] of [[0.3, 3], [1.4, 2.2], [2.5, 3.2], [3.6, 2.4], [4.7, 3], [5.6, 2]]) {
      P3.push(cap(v(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 2.5), v(Math.cos(a) * 6.1, Math.sin(a) * 6.1, 2.5 - l * 0.6), 1.1, R.robeHem, { depthBias: -0.1 }));
    }
    const back = v(-1.5, sway * 0.2, 14.5 + z2);
    P3.push(sph(back, 5, R.robe));
    const sh = v(1.5, sway * 0.3, 15.5 + z2);
    const hd = add(sh, v(3.3, 0, 1.6));
    P3.push(sph(add(hd, v(-0.6, 0, 0.5)), 4.4, R.robe, { depthBias: 0.2 }));
    P3.push(sph(add(hd, v(1.6, 0, -0.3)), 2.9, R.robeHem, { depthBias: 0.25 }));
    P3.push(sph(add(hd, v(2.4, 0, -0.6)), 2.2, R.seerSkin, { depthBias: 0.27 }));
    P3.push(cap(add(hd, v(-1, 0, 3.5)), add(hd, v(-4.5, 0, 6)), 1.3, R.robe, { depthBias: 0.1 }));
    for (const s of [-1, 1]) {
      const base = add(hd, v(-0.5, s * 2.6, 3));
      const tip = add(base, v(-1.5, s * 3, 5));
      P3.push(cap(base, tip, 0.55, R.wood));
      P3.push(cap(lerp3(base, tip, 0.5), add(lerp3(base, tip, 0.5), v(1.6, s * 1.2, 2.2)), 0.45, R.wood));
    }
    P3.push(dot(add(hd, v(4.3, -1, -0.4)), add(hd, v(1.8, -0.8, -0.2)), GLOW_G));
    P3.push(dot(add(hd, v(4.3, 1, -0.4)), add(hd, v(1.8, 0.8, -0.2)), GLOW_G));
    const shL = add(sh, v(0, -4.2, -0.5));
    const haL = add(shL, v(4.5 + raise * 1.5, -0.5, -3.5 + raise * 2));
    P3.push(cap(shL, haL, 1.6, R.robe));
    P3.push(sph(haL, 1.4, R.seerSkin, { depthBias: 0.1 }));
    for (const s of [-0.8, 0, 0.8]) P3.push(cap(haL, add(haL, v(1.8, s, -0.8)), 0.45, R.seerSkin, { depthBias: 0.12 }));
    const shR = add(sh, v(0, 4.2, -0.5));
    const haR = add(shR, v(3 + raise * 2 + thrust * 4, 1.2, -4 + raise * 6 + thrust * 1));
    P3.push(cap(shR, haR, 1.6, R.robe));
    P3.push(sph(haR, 1.4, R.seerSkin, { depthBias: 0.12 }));
    const tilt = raise * 0.55 + thrust * 1.1;
    const sdir = norm(v(Math.sin(tilt), 0, Math.cos(tilt)));
    const at2 = (t4) => add(haR, [sdir[0] * t4, sdir[1] * t4, sdir[2] * t4]);
    P3.push(cap(at2(-9 + raise * 3), at2(10), 0.8, R.wood));
    P3.push(cap(at2(10), add(at2(11.5), v(-1.4, 0, 0)), 0.7, R.wood));
    P3.push(cap(at2(10), add(at2(11.5), v(1.4, 0, 0)), 0.7, R.wood));
    const orbR = 1.9 + raise * 1.2 + (hot ? 0.5 : 0);
    P3.push(sph(at2(12.5), orbR, hot ? R.orbHot : R.orb, { depthBias: 0.3, bias: 0.25 }));
    return P3;
  }
  function cragParts(anim, f) {
    let bob = 0;
    let raise = 0;
    let slam = 0;
    let gait = 0;
    let lean = 0;
    if (anim === "idle") bob = [0, 0.5, 0.9, 0.5][f] ?? 0;
    else if (anim === "move") {
      gait = f / 6 * Math.PI * 2;
      bob = Math.abs(Math.sin(gait)) * 1.5;
    } else if (anim === "windup") {
      raise = Math.min(1, (f + 1) / 3.2);
      lean = -raise * 3;
    } else if (anim === "strike") {
      slam = [1, 1, 0.7][f] ?? 0;
      lean = 4 * slam;
    }
    const P3 = [];
    const z2 = bob * 0.5;
    for (const s of [-1, 1]) {
      const sw = Math.sin(gait + (s > 0 ? Math.PI : 0)) * (anim === "move" ? 3.5 : 0);
      const lift = anim === "move" ? Math.max(0, Math.cos(gait + (s > 0 ? Math.PI : 0))) * 2 : 0;
      const hip = v(-1, s * 5.5, 11 + z2);
      const ft = v(sw + (anim === "strike" ? 2 : 0), s * 6.8, 2 + lift);
      P3.push(cap(hip, ft, 3.6, R.cragSkin));
      P3.push(cap(ft, add(ft, v(2.6, 0, -0.5)), 2.7, R.cragFist));
    }
    const torsoB = v(-1 + lean * 0.2, 0, 14 + z2);
    const torsoT = v(2 + lean * 0.8, 0, 24 + z2 - Math.max(0, lean) * 0.6);
    P3.push(cap(torsoB, torsoT, 9.2, R.cragSkin));
    P3.push(sph(add(torsoB, v(3.5, 0, 1)), 6.5, R.cragFist, { depthBias: 0.3, bias: -0.05 }));
    const rocks = [
      [-5, -4, 26, 4.8],
      [-5.5, 4, 25.5, 4.4],
      [-7.5, 0, 22, 4.8],
      [-3, 0.5, 30, 4.4],
      [-8, -4.5, 17, 3.6],
      [-8, 4.5, 17.5, 3.4]
    ];
    for (const [rf, rs2, rz, rr3] of rocks) {
      const c = v(rf + lean * 0.5, rs2, rz + z2 - Math.max(0, lean) * 0.4);
      P3.push(sph(c, rr3, R.cragRock, { depthBias: -0.4 }));
      P3.push(sph(add(c, v(-0.6, rs2 * 0.08, rr3 * 0.55)), rr3 * 0.55, R.cragMoss, { depthBias: -0.35, ry: 0.5 }));
    }
    const hd = add(torsoT, v(6, 0, -2.5));
    P3.push(sph(hd, 4.2, R.cragSkin, { depthBias: 0.4 }));
    P3.push(cap(add(hd, v(1.5, -2.6, 2)), add(hd, v(3.5, -3.4, 0.5)), 0.9, R.cragRock));
    P3.push(cap(add(hd, v(1.5, 2.6, 2)), add(hd, v(3.5, 3.4, 0.5)), 0.9, R.cragRock));
    const eyeCol = anim === "windup" || anim === "strike" ? GLOW_R : rgba("#ff8a3a");
    P3.push(dot(add(hd, v(4, -1.6, 0.6)), add(hd, v(2, -1, 0.6)), eyeCol, anim === "windup" ? 2 : 1));
    P3.push(dot(add(hd, v(4, 1.6, 0.6)), add(hd, v(2, 1, 0.6)), eyeCol, anim === "windup" ? 2 : 1));
    P3.push(cap(add(hd, v(2.5, -2, -2.5)), add(hd, v(2.5, 2, -2.5)), 1.8, R.cragFist, { depthBias: 0.45 }));
    P3.push(cap(add(hd, v(3.5, -2, -2)), add(hd, v(4.3, -2.4, 0.5)), 0.7, R.teeth, { depthBias: 0.5 }));
    P3.push(cap(add(hd, v(3.5, 2, -2)), add(hd, v(4.3, 2.4, 0.5)), 0.7, R.teeth, { depthBias: 0.5 }));
    for (const s of [-1, 1]) {
      const sh = add(torsoT, v(-0.5, s * 9, -1.5));
      let fist;
      let elbow;
      if (raise > 0) {
        fist = lerp3(v(9, s * 11, 6), v(1, s * 5, 44), raise);
        elbow = lerp3(v(5, s * 12.5, 13), v(-1, s * 11, 34), raise);
      } else if (slam > 0) {
        fist = v(15, s * 5, 3 + (1 - slam) * 6);
        elbow = v(9, s * 10, 15);
      } else {
        const sw = Math.sin(gait + (s > 0 ? 0 : Math.PI)) * (anim === "move" ? 3 : 0);
        fist = v(8 + sw, s * 11.5, 5 + z2 * 0.5);
        elbow = v(4 + sw * 0.5, s * 12.5, 14 + z2 * 0.5);
      }
      P3.push(sph(sh, 4.6, R.cragSkin));
      P3.push(sph(add(sh, v(-1.2, s * 0.6, 3)), 3.2, R.cragRock, { depthBias: -0.2 }));
      P3.push(cap(sh, elbow, 3.6, R.cragSkin));
      P3.push(cap(elbow, fist, 3.4, R.cragSkin));
      P3.push(sph(fist, 4.6, R.cragFist, { depthBias: 0.2 }));
    }
    return P3;
  }
  var DEFS = {
    gnashling: { baseR: 15, scale: 1.25, w: 64, h: 52, ay: 40, parts: gnashParts },
    bog_seer: { baseR: 16, scale: 1.3, w: 64, h: 72, ay: 58, parts: seerParts },
    cragback: { baseR: 28, scale: 1.25, w: 104, h: 116, ay: 96, parts: cragParts }
  };
  var ELITE_COLORS = {
    frenzied: "#ff3b2e",
    ironhide: "#b9c4d0",
    volatile: "#ff9a1f",
    rimecloaked: "#7fd4ff"
  };
  function deathTransform(parts, k, f) {
    const t4 = Math.min(1, f / 5);
    const e = t4 * t4;
    if (k === "cragback") transformParts(parts, (p) => rotS(p, e * 1.45, v(6, 0, 0)));
    else if (k === "bog_seer") {
      transformParts(parts, (p) => {
        const q = rotS(p, -e * 1.35, v(-2, 0, 0));
        return [q[0], q[1], q[2] * (1 - e * 0.25)];
      });
    } else transformParts(parts, (p) => rotF(p, e * 1.6, v(0, 4, 0)));
  }
  function buildMonsterFrame(k, sizeMul, elite, dir, anim, frame2, flash) {
    const def2 = DEFS[k] ?? DEFS.gnashling;
    const sc = def2.scale * sizeMul * ART * 1.12;
    const W3 = Math.ceil(def2.w * sizeMul * ART * 1.12) + 10;
    const H3 = Math.ceil(def2.h * sizeMul * ART * 1.12) + 10;
    const AX2 = Math.floor(W3 / 2);
    const AY2 = Math.ceil(def2.ay * sizeMul * ART * 1.12) + 5;
    const parts = def2.parts(anim === "death" ? "idle" : anim, anim === "death" ? 0 : frame2);
    if (anim === "death") deathTransform(parts, k, frame2);
    const buf = new PixBuf(W3, H3);
    rasterize(parts, projector(dirToWorldAngle(dir), sc, AX2, AY2), sc, buf);
    if (anim === "death" && frame2 >= 5) {
      const d = buf.tinted(rgba("#2a2522"), 0.35);
      return sprite(d, AX2, AY2);
    }
    if (elite && elite.length && anim !== "death") eliteRing(buf, elite);
    return sprite(flash ? buf.tinted(rgba("#ffffff"), 0.85) : buf, AX2, AY2);
  }
  function eliteRing(buf, mods) {
    for (let i = 0; i < Math.min(2, mods.length); i++) {
      const c = rgba(ELITE_COLORS[mods[i]] ?? "#ffb347");
      const { w, h, data } = buf;
      const src = data.slice();
      for (let y2 = 0; y2 < h; y2++) {
        for (let x2 = 0; x2 < w; x2++) {
          if (src[y2 * w + x2] >>> 24 !== 0) continue;
          const n2 = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx] >>> 24 !== 0;
          if (n2(x2 - 1, y2) || n2(x2 + 1, y2) || n2(x2, y2 - 1) || n2(x2, y2 + 1)) data[y2 * w + x2] = i === 0 ? c : scaleColor(c, 0.7);
        }
      }
    }
  }
  var cache2 = /* @__PURE__ */ new Map();
  function monsterFrame(k, r, elite, dir, anim, frame2, flash = false) {
    const def2 = DEFS[k] ?? DEFS.gnashling;
    const sizeMul = Math.round(r / def2.baseR * 10) / 10;
    const ek = elite?.join(",") ?? "";
    const key = `${k}|${sizeMul}|${ek}|${dir}|${anim}|${frame2}|${flash ? 1 : 0}`;
    let s = cache2.get(key);
    if (!s) {
      if (!canBuild()) {
        const base = `${k}|${sizeMul}|${ek}|${dir}|`;
        const fb = cache2.get(`${base}${anim}|${frame2}|0`) ?? cache2.get(`${base}${anim}|0|0`) ?? cache2.get(`${base}idle|0|0`);
        if (fb) return fb;
      }
      if (cache2.size > 6e3) cache2.clear();
      s = buildMonsterFrame(k, sizeMul, elite, dir, anim, frame2, flash);
      cache2.set(key, s);
    }
    return s;
  }
  var MONSTER_KINDS = Object.keys(DEFS);

  // src/client/gfx/view.ts
  var cam = { offX: 0, offY: 0, Z: 1, ww: 720, wh: 405, time: 0 };
  var layers = {
    ground: /* @__PURE__ */ new Set(),
    depth: /* @__PURE__ */ new Set(),
    /** Drawn after the sorted entities, before the darkness (lit like the world). */
    over: /* @__PURE__ */ new Set(),
    /** Drawn after the darkness (glows, sparks, unlit effects). */
    fx: /* @__PURE__ */ new Set()
  };
  function addLayer(kind2, fn) {
    layers[kind2].add(fn);
    return () => layers[kind2].delete(fn);
  }
  function runLayer(kind2, g) {
    for (const fn of layers[kind2]) {
      try {
        g.save();
        fn(g, cam);
      } catch (e) {
        console.error("layer", kind2, e);
      } finally {
        g.restore();
      }
    }
  }

  // src/shared/content/monsters/roster.ts
  var P = Math.PI;
  var barkgnaw = {
    id: "barkgnaw",
    name: "Barkgnaw",
    ai: "rusher",
    family: "beast",
    color: "#7a5a36",
    radius: 16,
    hp: 46,
    speed: 215,
    aggroRadius: 330,
    damage: 9,
    attackRange: 26,
    windup: 0.3,
    recover: 0.55,
    knockback: 240,
    kbResist: 0,
    packWeight: 0,
    packCount: [3, 5],
    attacks: [
      { id: "bite", kind: "melee", range: 24, windup: 0.3, recover: 0.5, cooldown: 0, weight: 3, dmg: 1, radius: 30, arc: P / 2.4 },
      { id: "pounce", kind: "leap", range: 240, minRange: 90, windup: 0.55, recover: 0.6, cooldown: 4, weight: 4, dmg: 1.4, radius: 46, form: "area" }
    ]
  };
  var sapspitter = {
    id: "sapspitter",
    name: "Sapspitter",
    ai: "ranged",
    family: "spirit",
    color: "#9a8a3a",
    radius: 17,
    hp: 34,
    speed: 110,
    aggroRadius: 400,
    damage: 10,
    attackRange: 360,
    windup: 0.6,
    recover: 1.3,
    knockback: 120,
    kbResist: 0.2,
    packWeight: 0,
    preferredDist: 270,
    packCount: [2, 3],
    attacks: [
      { id: "sap_fan", kind: "proj", range: 380, windup: 0.6, recover: 1.2, cooldown: 0, weight: 3, dmg: 1, count: 3, spread: 0.32, speed: 240, life: 2, projR: 8, element: "chaos" },
      {
        id: "sap_lob",
        kind: "ground",
        range: 330,
        windup: 0.9,
        recover: 1.1,
        cooldown: 6,
        weight: 2,
        dmg: 1.1,
        radius: 54,
        form: "area",
        element: "chaos",
        pool: { r: 54, dur: 4, dps: 5, slow: 0.65, color: "rgba(170,160,40,0.45)" }
      }
    ]
  };
  var hollowTender = {
    id: "hollow_tender",
    name: "Hollow Tender",
    ai: "caster",
    family: "caster",
    color: "#5c7a4a",
    radius: 17,
    hp: 40,
    speed: 120,
    aggroRadius: 420,
    damage: 15,
    attackRange: 340,
    windup: 0.9,
    recover: 1.4,
    knockback: 300,
    kbResist: 0.1,
    packWeight: 0,
    preferredDist: 240,
    packCount: [1, 2],
    attacks: [
      { id: "root_burst", kind: "ground", range: 360, windup: 1, recover: 1, cooldown: 0, weight: 4, dmg: 1, radius: 60, form: "spell", element: "phys" },
      { id: "root_field", kind: "rain", range: 340, windup: 1.2, recover: 1.4, cooldown: 7, weight: 2, dmg: 0.8, radius: 44, count: 4, form: "spell" },
      { id: "call_pack", kind: "summon", range: 420, windup: 1.1, recover: 1, cooldown: 12, weight: 2, dmg: 0, count: 2, summon: { type: "barkgnaw", max: 3 } }
    ]
  };
  var stumpfather = {
    id: "stumpfather",
    name: "Stumpfather",
    ai: "brute",
    family: "brute",
    color: "#5a4632",
    radius: 30,
    hp: 170,
    speed: 92,
    aggroRadius: 280,
    damage: 30,
    attackRange: 46,
    windup: 1,
    recover: 1.1,
    knockback: 650,
    kbResist: 0.85,
    packWeight: 0,
    packCount: [1, 1],
    attacks: [
      { id: "trunk_slam", kind: "slam", range: 50, windup: 1, recover: 1, cooldown: 0, weight: 3, dmg: 1, radius: 74, offset: 44, form: "area" },
      { id: "root_sweep", kind: "nova", range: 60, windup: 1.2, recover: 1.2, cooldown: 6, weight: 2, dmg: 0.8, radius: 120, form: "area", kb: 800 }
    ]
  };
  var reedlurker = {
    id: "reedlurker",
    name: "Reedlurker",
    ai: "rusher",
    family: "beast",
    color: "#3e6a5a",
    radius: 16,
    hp: 44,
    speed: 190,
    aggroRadius: 320,
    damage: 10,
    attackRange: 28,
    windup: 0.32,
    recover: 0.6,
    knockback: 260,
    kbResist: 0,
    packWeight: 0,
    packCount: [2, 4],
    attacks: [
      { id: "snap", kind: "melee", range: 26, windup: 0.32, recover: 0.5, cooldown: 0, weight: 3, dmg: 1, radius: 32, arc: P / 2.6 },
      { id: "eel_rush", kind: "charge", range: 260, minRange: 80, windup: 0.6, recover: 0.7, cooldown: 4.5, weight: 4, dmg: 1.3, width: 40, form: "area", kb: 420 }
    ]
  };
  var mireChanter = {
    id: "mire_chanter",
    name: "Mire Chanter",
    ai: "caster",
    family: "undead",
    color: "#4a6a6a",
    radius: 17,
    hp: 38,
    speed: 115,
    aggroRadius: 420,
    damage: 13,
    attackRange: 340,
    windup: 1,
    recover: 1.3,
    knockback: 200,
    kbResist: 0.1,
    packWeight: 0,
    preferredDist: 250,
    packCount: [1, 2],
    attacks: [
      {
        id: "sludge_burst",
        kind: "ground",
        range: 360,
        windup: 1,
        recover: 1.1,
        cooldown: 0,
        weight: 4,
        dmg: 1,
        radius: 58,
        form: "spell",
        element: "cold",
        pool: { r: 58, dur: 5, dps: 3, slow: 0.55, color: "rgba(60,110,110,0.45)" }
      },
      { id: "drowning_hymn", kind: "nova", range: 90, windup: 1.1, recover: 1, cooldown: 6, weight: 2, dmg: 0.9, radius: 110, form: "spell", element: "cold" }
    ]
  };
  var siltBehemoth = {
    id: "silt_behemoth",
    name: "Silt Behemoth",
    ai: "brute",
    family: "brute",
    color: "#5a5a46",
    radius: 31,
    hp: 190,
    speed: 80,
    aggroRadius: 260,
    damage: 26,
    attackRange: 46,
    windup: 1.1,
    recover: 1.2,
    knockback: 600,
    kbResist: 0.9,
    packWeight: 0,
    packCount: [1, 1],
    attacks: [
      { id: "shell_slam", kind: "slam", range: 48, windup: 1, recover: 1, cooldown: 0, weight: 3, dmg: 1, radius: 70, offset: 42, form: "area" },
      {
        id: "belly_flop",
        kind: "nova",
        range: 70,
        windup: 1.3,
        recover: 1.4,
        cooldown: 7,
        weight: 2,
        dmg: 1.1,
        radius: 115,
        form: "area",
        pool: { r: 115, dur: 4, dps: 2, slow: 0.6, color: "rgba(80,90,60,0.4)" }
      }
    ]
  };
  var leechkin = {
    id: "leechkin",
    name: "Leechkin",
    ai: "swarm",
    family: "beast",
    color: "#5a2a32",
    radius: 9,
    hp: 12,
    speed: 235,
    aggroRadius: 300,
    damage: 4,
    attackRange: 18,
    windup: 0.22,
    recover: 0.45,
    knockback: 60,
    kbResist: 0,
    packWeight: 0,
    packCount: [6, 10],
    attacks: [{ id: "latch", kind: "melee", range: 16, windup: 0.22, recover: 0.4, cooldown: 0, weight: 1, dmg: 1, radius: 20, arc: P / 2 }]
  };
  var spireHarrier = {
    id: "spire_harrier",
    name: "Spire Harrier",
    ai: "rusher",
    family: "spirit",
    color: "#7a7a88",
    radius: 15,
    hp: 40,
    speed: 225,
    aggroRadius: 360,
    damage: 9,
    attackRange: 26,
    windup: 0.3,
    recover: 0.6,
    knockback: 220,
    kbResist: 0,
    packWeight: 0,
    packCount: [2, 4],
    attacks: [
      { id: "rake", kind: "melee", range: 24, windup: 0.28, recover: 0.5, cooldown: 0, weight: 3, dmg: 1, radius: 30, arc: P / 2.2 },
      { id: "dive", kind: "leap", range: 300, minRange: 110, windup: 0.65, recover: 0.7, cooldown: 4, weight: 4, dmg: 1.5, radius: 50, form: "area" }
    ]
  };
  var shardslinger = {
    id: "shardslinger",
    name: "Shardslinger",
    ai: "ranged",
    family: "brute",
    color: "#8aa0b8",
    radius: 18,
    hp: 50,
    speed: 105,
    aggroRadius: 420,
    damage: 9,
    attackRange: 380,
    windup: 0.65,
    recover: 1.3,
    knockback: 140,
    kbResist: 0.4,
    packWeight: 0,
    preferredDist: 280,
    packCount: [1, 3],
    attacks: [
      { id: "shard_fan", kind: "proj", range: 400, windup: 0.65, recover: 1.2, cooldown: 0, weight: 3, dmg: 1, count: 5, spread: 0.55, speed: 280, life: 1.8, projR: 7, element: "phys" },
      { id: "crystal_rain", kind: "rain", range: 360, windup: 1.2, recover: 1.3, cooldown: 7, weight: 2, dmg: 1, radius: 40, count: 5, form: "area", element: "lightning" }
    ]
  };
  var cairnbreaker = {
    id: "cairnbreaker",
    name: "Cairnbreaker",
    ai: "brute",
    family: "brute",
    color: "#6c6660",
    radius: 31,
    hp: 200,
    speed: 88,
    aggroRadius: 270,
    damage: 32,
    attackRange: 48,
    windup: 1.05,
    recover: 1.1,
    knockback: 700,
    kbResist: 0.9,
    packWeight: 0,
    packCount: [1, 1],
    attacks: [
      { id: "cairn_slam", kind: "slam", range: 50, windup: 1.05, recover: 1, cooldown: 0, weight: 3, dmg: 1, radius: 78, offset: 46, form: "area" },
      { id: "quake", kind: "nova", range: 80, windup: 1.4, recover: 1.3, cooldown: 7, weight: 2, dmg: 0.9, radius: 140, form: "area", kb: 900 }
    ]
  };
  var cindermite = {
    id: "cindermite",
    name: "Cindermite",
    ai: "swarm",
    family: "beast",
    color: "#b8582a",
    radius: 10,
    hp: 14,
    speed: 225,
    aggroRadius: 300,
    damage: 4,
    attackRange: 18,
    windup: 0.24,
    recover: 0.5,
    knockback: 80,
    kbResist: 0,
    packWeight: 0,
    packCount: [6, 9],
    deathPop: { radius: 44, delay: 0.7, dmg: 7 },
    attacks: [{ id: "nip", kind: "melee", range: 16, windup: 0.24, recover: 0.45, cooldown: 0, weight: 1, dmg: 1, radius: 20, arc: P / 2, element: "fire" }]
  };
  var rotwoodMatriarch = {
    id: "rotwood_matriarch",
    name: "The Rotwood Matriarch",
    ai: "boss",
    family: "spirit",
    color: "#6a5a3a",
    radius: 40,
    hp: 260,
    speed: 90,
    aggroRadius: 380,
    damage: 26,
    attackRange: 56,
    windup: 1,
    recover: 1,
    knockback: 700,
    kbResist: 0.95,
    packWeight: 0,
    attacks: [
      { id: "bough_crush", kind: "slam", range: 60, windup: 1, recover: 0.9, cooldown: 0, weight: 3, dmg: 1, radius: 90, offset: 56, form: "area" },
      { id: "sap_volley", kind: "proj", range: 420, minRange: 120, windup: 0.8, recover: 1, cooldown: 3, weight: 3, dmg: 0.6, count: 7, spread: 0.9, speed: 250, life: 2.2, projR: 9, element: "chaos" },
      { id: "rootfall", kind: "rain", range: 420, windup: 1.2, recover: 1, cooldown: 6, weight: 3, dmg: 0.9, radius: 54, count: 6, form: "area", phase: 1 },
      { id: "brood_call", kind: "summon", range: 500, windup: 1.2, recover: 0.8, cooldown: 14, weight: 2, dmg: 0, count: 3, summon: { type: "barkgnaw", max: 5 }, phase: 1 },
      {
        id: "rot_bloom",
        kind: "nova",
        range: 140,
        windup: 1.4,
        recover: 1,
        cooldown: 7,
        weight: 3,
        dmg: 1.2,
        radius: 190,
        form: "area",
        phase: 2,
        pool: { r: 150, dur: 5, dps: 6, slow: 0.7, color: "rgba(120,140,40,0.4)" }
      }
    ],
    boss: {
      title: "Mother of the Hollow Pines",
      hpMult: 1,
      roar: { radius: 170, dmg: 10 },
      phases: [
        { below: 1, name: "", speedMult: 1, atkSpeedMult: 1 },
        { below: 0.66, name: "The pines answer her call!", speedMult: 1.05, atkSpeedMult: 1.1, adds: { type: "barkgnaw", count: 3 } },
        { below: 0.33, name: "The Matriarch splits open, weeping rot!", speedMult: 1.2, atkSpeedMult: 1.3, adds: { type: "hollow_tender", count: 2 } }
      ]
    }
  };
  var gulpmaw = {
    id: "gulpmaw",
    name: "Gulpmaw the Bloated",
    ai: "boss",
    family: "beast",
    color: "#4a5a3a",
    radius: 42,
    hp: 290,
    speed: 85,
    aggroRadius: 380,
    damage: 25,
    attackRange: 56,
    windup: 1,
    recover: 1,
    knockback: 700,
    kbResist: 0.95,
    packWeight: 0,
    attacks: [
      { id: "tongue_lash", kind: "charge", range: 320, windup: 0.9, recover: 0.8, cooldown: 2.5, weight: 3, dmg: 1, width: 46, form: "attack", kb: 300, noMove: true },
      { id: "belly_slam", kind: "slam", range: 60, windup: 1, recover: 1, cooldown: 0, weight: 3, dmg: 1.1, radius: 96, offset: 40, form: "area" },
      {
        id: "great_leap",
        kind: "leap",
        range: 420,
        minRange: 100,
        windup: 1,
        recover: 1,
        cooldown: 5,
        weight: 3,
        dmg: 1.3,
        radius: 110,
        form: "area",
        phase: 1,
        pool: { r: 110, dur: 4, dps: 4, slow: 0.6, color: "rgba(60,90,70,0.45)" }
      },
      { id: "spawn_leeches", kind: "summon", range: 500, windup: 1, recover: 0.8, cooldown: 12, weight: 2, dmg: 0, count: 5, summon: { type: "leechkin", max: 10 }, phase: 1 },
      {
        id: "bile_rain",
        kind: "rain",
        range: 440,
        windup: 1.3,
        recover: 1,
        cooldown: 6,
        weight: 3,
        dmg: 0.8,
        radius: 60,
        count: 7,
        form: "area",
        phase: 2,
        pool: { r: 60, dur: 4, dps: 5, slow: 0.7, color: "rgba(110,140,50,0.45)" }
      }
    ],
    boss: {
      title: "Bell-Tongue of the Drowned Fen",
      hpMult: 1,
      roar: { radius: 180, dmg: 10 },
      phases: [
        { below: 1, name: "", speedMult: 1, atkSpeedMult: 1 },
        { below: 0.66, name: "Gulpmaw rings its bell of skulls!", speedMult: 1.1, atkSpeedMult: 1.1, adds: { type: "leechkin", count: 6 } },
        { below: 0.33, name: "Gulpmaw vomits the fen!", speedMult: 1.2, atkSpeedMult: 1.3, adds: { type: "mire_chanter", count: 2 } }
      ]
    }
  };
  var shatteredWarden = {
    id: "shattered_warden",
    name: "The Shattered Warden",
    ai: "boss",
    family: "undead",
    color: "#7a7a8a",
    radius: 38,
    hp: 280,
    speed: 100,
    aggroRadius: 380,
    damage: 28,
    attackRange: 60,
    windup: 0.9,
    recover: 0.9,
    knockback: 700,
    kbResist: 0.95,
    packWeight: 0,
    attacks: [
      { id: "halberd_sweep", kind: "melee", range: 70, windup: 0.8, recover: 0.8, cooldown: 0, weight: 3, dmg: 1, radius: 110, arc: P * 0.9 },
      { id: "warden_slam", kind: "slam", range: 64, windup: 1.1, recover: 1, cooldown: 3, weight: 3, dmg: 1.3, radius: 92, offset: 60, form: "area", element: "lightning" },
      { id: "tower_fall", kind: "rain", range: 440, windup: 1.3, recover: 1, cooldown: 6, weight: 3, dmg: 1, radius: 58, count: 6, form: "area", phase: 1 },
      { id: "rally_mites", kind: "summon", range: 500, windup: 1, recover: 0.8, cooldown: 12, weight: 2, dmg: 0, count: 5, summon: { type: "cindermite", max: 9 }, phase: 1 },
      { id: "storm_charge", kind: "charge", range: 420, minRange: 120, windup: 0.9, recover: 0.9, cooldown: 4, weight: 4, dmg: 1.3, width: 60, form: "area", kb: 700, phase: 2, element: "lightning" }
    ],
    boss: {
      title: "Last Keeper of the Spire",
      hpMult: 1,
      roar: { radius: 170, dmg: 12 },
      phases: [
        { below: 1, name: "", speedMult: 1, atkSpeedMult: 1 },
        { below: 0.66, name: "The Warden calls down the tower!", speedMult: 1.05, atkSpeedMult: 1.1, adds: { type: "cindermite", count: 6 } },
        { below: 0.33, name: "Storm pours out of the Warden's cracks!", speedMult: 1.3, atkSpeedMult: 1.3, adds: { type: "spire_harrier", count: 2 } }
      ]
    }
  };
  var rogueExile = {
    id: "rogue_exile",
    name: "Rogue Exile",
    ai: "exile",
    family: "undead",
    color: "#c0b090",
    radius: 14,
    hp: 140,
    speed: 180,
    aggroRadius: 380,
    damage: 14,
    attackRange: 40,
    windup: 0.4,
    recover: 0.5,
    knockback: 380,
    kbResist: 0.5,
    packWeight: 0
  };
  var ROSTER = [
    barkgnaw,
    sapspitter,
    hollowTender,
    stumpfather,
    reedlurker,
    mireChanter,
    siltBehemoth,
    leechkin,
    spireHarrier,
    shardslinger,
    cairnbreaker,
    cindermite,
    rotwoodMatriarch,
    gulpmaw,
    shatteredWarden,
    rogueExile
  ];

  // src/shared/content/monsters/mods.ts
  var RARITY_INFO = [
    { name: "Normal", power: 1, hpMult: 1, dmgMult: 1, sizeMult: 1, mods: [0, 0], ccResist: 0, color: "#e8e2d4" },
    { name: "Magic", power: 2, hpMult: 1.7, dmgMult: 1.15, sizeMult: 1.1, mods: [1, 1], ccResist: 0.15, color: "#8a9cff" },
    { name: "Rare", power: 5, hpMult: 4, dmgMult: 1.3, sizeMult: 1.25, mods: [2, 4], ccResist: 0.3, color: "#ffe066" },
    { name: "Unique", power: 20, hpMult: 6, dmgMult: 1.35, sizeMult: 1, mods: [0, 1], ccResist: 0.5, color: "#d8873a" }
  ];
  var MONSTER_MODS = [
    // ---- offence ----
    { id: "frenzied", name: "Frenzied", family: "offence", color: "#ff5a3a", speedMult: 1.3, attackSpeedMult: 1.3, minion: true },
    { id: "brutish", name: "Brutish", family: "offence", color: "#e07a3a", dmgMult: 1.4, minion: true },
    { id: "splintering", name: "Splintering", family: "offence", color: "#d8c890", extraProj: 2, needs: "proj" },
    { id: "farreaching", name: "Far-Reaching", family: "offence", color: "#c8a0ff", aoeMult: 1.35 },
    { id: "bonebreaker", name: "Bonebreaker", family: "offence", color: "#d8d0c0", kbMult: 1.8, stunMult: 2, minion: true },
    { id: "stormmarked", name: "Storm-Marked", family: "offence", color: "#8ad0ff", stormMark: { radius: 50, delay: 0.9, dmg: 0.6 } },
    { id: "relentless", name: "Relentless", family: "offence", color: "#ff8a6a", recoverMult: 0.6, cooldownMult: 0.7 },
    { id: "lifedrinker", name: "Lifedrinker", family: "offence", color: "#c02040", leech: 0.4, minion: true },
    // ---- defence ----
    { id: "ironhide", name: "Ironhide", family: "defence", color: "#b9c4d0", hpMult: 2 },
    { id: "bulwarked", name: "Bulwarked", family: "defence", color: "#a0a8b8", dmgTaken: 0.65, minion: true },
    { id: "mending", name: "Mending", family: "defence", color: "#60d080", regen: 0.03, minion: true },
    { id: "hardening", name: "Hardening", family: "defence", color: "#c0b090", hardening: { per: 0.07, max: 0.35, reset: 4 } },
    { id: "unshakable", name: "Unshakable", family: "defence", color: "#d0c8a0", kbImmune: true, ccResist: 0.3, minion: true },
    { id: "thornhide", name: "Thornhide", family: "defence", color: "#a0c040", thorns: 0.18 },
    { id: "lastbreath", name: "Last-Breath", family: "defence", color: "#f0f0ff", lastBreath: 1.5 },
    { id: "swollen", name: "Swollen", family: "defence", color: "#d0a080", hpMult: 1.5, dmgMult: 1.25, sizeMult: 1.15 },
    // ---- auras ----
    { id: "rimecloaked", name: "Rimecloaked", family: "aura", color: "#7fd4ff", frostAura: { radius: 170, slow: 0.7 } },
    { id: "rallying", name: "Rallying Howl", family: "aura", color: "#ffb060", allyAura: { radius: 260, speed: 1.25 } },
    { id: "chorus", name: "Mending Chorus", family: "aura", color: "#80e0a0", allyAura: { radius: 260, regen: 0.02 } },
    { id: "thirsting", name: "Thirsting Presence", family: "aura", color: "#b080ff", thirstAura: { radius: 200, perSec: 1.5 } },
    { id: "wardcaller", name: "Ward-Caller", family: "aura", color: "#9ab0ff", allyAura: { radius: 260, dmgTaken: 0.7 } },
    { id: "bloodscent", name: "Bloodscent", family: "aura", color: "#ff6060", allyAura: { radius: 260, dmg: 1.25 } },
    // ---- ground hazards and on-death ----
    { id: "volatile", name: "Volatile", family: "hazard", color: "#ff9a1f", deathBlast: { radius: 110, delay: 1, damage: 28 } },
    { id: "emberwake", name: "Emberwake", family: "hazard", color: "#ff7a2a", trail: { every: 0.45, r: 30, dur: 3, dps: 6, color: "rgba(255,110,40,0.45)" } },
    { id: "frostwake", name: "Frostwake", family: "hazard", color: "#a0e0ff", trail: { every: 0.45, r: 32, dur: 3.5, dps: 1, slow: 0.55, color: "rgba(150,210,255,0.4)" } },
    { id: "pulsing", name: "Pulsing", family: "hazard", color: "#e0a0ff", pulse: { every: 5, radius: 130, delay: 1.1, dmg: 0.7 } },
    { id: "blightburst", name: "Blightburst", family: "hazard", color: "#90c040", deathPool: { r: 110, dur: 6, dps: 7, slow: 0.8, color: "rgba(110,160,40,0.45)" } },
    { id: "stormcaller", name: "Stormcaller", family: "hazard", color: "#80c0ff", stormcall: { every: 4, count: 3, radius: 46, delay: 1.1, dmg: 0.6 } },
    { id: "splitting", name: "Splitting", family: "hazard", color: "#d0a0d0", splitOnDeath: 2 },
    { id: "gravebound", name: "Grave-Bound", family: "hazard", color: "#a09080", raiseOnDeath: 3 },
    // ---- minion synergy ----
    { id: "packward", name: "Pack Ward", family: "minion", color: "#a0c0ff", packWard: 0.6 },
    { id: "reviver", name: "Reviver", family: "minion", color: "#ffe0a0", revive: { every: 9 } },
    { id: "packmaster", name: "Packmaster", family: "minion", color: "#ffa060", packBoost: { dmg: 1.3, speed: 1.2 } },
    { id: "soullinked", name: "Soul-Linked", family: "minion", color: "#c0a0ff", soulLink: 0.1 },
    // ---- immunity bubbles ----
    { id: "closequarters", name: "Close-Quarters", family: "bubble", color: "#ffd0ff", nearOnly: 220 },
    { id: "veiledsphere", name: "Veiled Sphere", family: "bubble", color: "#d0f0ff", sphere: 210 },
    { id: "phasing", name: "Phasing", family: "bubble", color: "#f0f0f0", phasing: { every: 6, dur: 1.5 } }
  ];

  // src/shared/content/monsters.ts
  var MONSTER_TYPES = [
    {
      id: "gnashling",
      name: "Gnashling",
      ai: "melee",
      color: "#c27840",
      radius: 15,
      hp: 40,
      speed: 200,
      aggroRadius: 300,
      damage: 8,
      attackRange: 26,
      windup: 0.32,
      recover: 0.6,
      knockback: 220,
      kbResist: 0,
      packWeight: 50
    },
    {
      id: "bog_seer",
      name: "Bog Seer",
      ai: "ranged",
      color: "#5fa37a",
      radius: 16,
      hp: 32,
      speed: 135,
      aggroRadius: 380,
      damage: 13,
      attackRange: 360,
      windup: 0.55,
      recover: 1.4,
      knockback: 150,
      kbResist: 0,
      packWeight: 30,
      preferredDist: 260,
      projectile: { speed: 230, radius: 9, life: 2.4 }
    },
    {
      id: "cragback",
      name: "Cragback",
      ai: "brute",
      color: "#8a7f72",
      radius: 28,
      hp: 150,
      speed: 100,
      aggroRadius: 260,
      damage: 28,
      attackRange: 46,
      windup: 0.95,
      recover: 1.1,
      knockback: 650,
      kbResist: 0.8,
      packWeight: 20,
      slam: { radius: 72, offset: 42 }
    }
  ];
  var MONSTER_BY_ID = new Map(MONSTER_TYPES.map((m) => [m.id, m]));
  var ELITE_MODS = [
    { id: "frenzied", name: "Frenzied", speedMult: 1.35, attackSpeedMult: 1.35 },
    { id: "ironhide", name: "Ironhide", hpMult: 2 },
    { id: "volatile", name: "Volatile", deathBlast: { radius: 110, delay: 1, damage: 28 } },
    { id: "rimecloaked", name: "Rimecloaked", frostAura: { radius: 170, slow: 0.7 } }
  ];
  MONSTER_TYPES.push(...ROSTER);
  for (const t4 of ROSTER) MONSTER_BY_ID.set(t4.id, t4);
  for (const m of MONSTER_MODS) {
    const old = ELITE_MODS.find((e) => e.id === m.id);
    if (old) Object.assign(old, m);
    else ELITE_MODS.push(m);
  }
  var ELITE_MOD_BY_ID = new Map(ELITE_MODS.map((m) => [m.id, m]));

  // src/client/settings.ts
  var SETTINGS_VERSION = 1;
  var STORAGE_KEY = "hns-settings";
  function defaultSettings() {
    return {
      v: SETTINGS_VERSION,
      graphics: {
        renderScale: 0,
        brightness: 1,
        fpsCap: 0,
        lightQuality: "high",
        particles: 1,
        screenShake: true,
        gore: "extreme",
        persistentBlood: true,
        showFps: false,
        showPing: true
      },
      interface: {
        uiScale: 1,
        damageNumbers: "all",
        playerLabels: "all",
        monsterBars: "damaged",
        alwaysShowLabels: true,
        hideNormal: false,
        hideMagic: false,
        minimapSize: 1,
        minimapOpacity: 1,
        globeNumbers: true,
        tooltipCompare: true
      },
      audio: { master: 0.8, music: 0.6, effects: 0.8, ui: 0.7, muteUnfocused: true },
      game: { autoPickup: false, colorblind: false, confirmLeave: true }
    };
  }
  function merge(def2, raw) {
    const out = { ...def2 };
    if (!raw || typeof raw !== "object") return out;
    for (const k of Object.keys(def2)) {
      const v2 = raw[k];
      if (v2 === void 0 || typeof v2 !== typeof def2[k]) continue;
      if (typeof v2 === "number" && !Number.isFinite(v2)) continue;
      out[k] = v2;
    }
    return out;
  }
  function migrate(raw) {
    return raw;
  }
  function load() {
    const def2 = defaultSettings();
    let raw = null;
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) raw = JSON.parse(s);
    } catch {
      raw = null;
    }
    if (!raw || typeof raw !== "object") return def2;
    raw = migrate(raw);
    const out = {
      v: SETTINGS_VERSION,
      graphics: merge(def2.graphics, raw.graphics),
      interface: merge(def2.interface, raw.interface),
      audio: merge(def2.audio, raw.audio),
      game: merge(def2.game, raw.game)
    };
    if (out.graphics.renderScale !== 0 && !(out.graphics.renderScale >= 0.5 && out.graphics.renderScale <= 1)) out.graphics.renderScale = def2.graphics.renderScale;
    if (![30, 60, 120, 0].includes(out.graphics.fpsCap)) out.graphics.fpsCap = def2.graphics.fpsCap;
    if (!["low", "medium", "high"].includes(out.graphics.lightQuality)) out.graphics.lightQuality = def2.graphics.lightQuality;
    if (!["all", "own", "off"].includes(out.interface.damageNumbers)) out.interface.damageNumbers = def2.interface.damageNumbers;
    if (!["all", "others", "off"].includes(out.interface.playerLabels)) out.interface.playerLabels = def2.interface.playerLabels;
    if (!["damaged", "always", "off"].includes(out.interface.monsterBars)) out.interface.monsterBars = def2.interface.monsterBars;
    return out;
  }
  var current2 = load();
  var saveTimer = null;
  function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current2));
      } catch {
      }
    }, 150);
  }
  var listeners2 = /* @__PURE__ */ new Set();
  function getSettings() {
    return current2;
  }
  function setSetting(group, key, value) {
    if (current2[group][key] === value) return;
    current2 = { ...current2, [group]: { ...current2[group], [key]: value } };
    save();
    emit(group, key);
  }
  function subscribe(fn) {
    listeners2.add(fn);
    return () => listeners2.delete(fn);
  }
  function onChange(group, key, fn) {
    return subscribe((s, g, k) => {
      if (g === group && (k === key || k === "*")) fn(s[group][key]);
    });
  }
  function emit(group, key) {
    for (const fn of [...listeners2]) {
      try {
        fn(current2, group, key);
      } catch (e) {
        console.error("settings listener failed", e);
      }
    }
  }
  var ambientCache = /* @__PURE__ */ new Map();
  function ambientColor(hex) {
    const k = current2.graphics.brightness;
    if (k === 1) return hex;
    const key = hex + "|" + k;
    let c = ambientCache.get(key);
    if (!c) {
      const h = hex.replace("#", "");
      const ch = (i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * k)));
      c = `rgb(${ch(0)},${ch(2)},${ch(4)})`;
      ambientCache.set(key, c);
    }
    return c;
  }
  function renderScaleFor(devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1) {
    const r = current2.graphics.renderScale;
    if (r > 0) return Math.max(0.5, Math.min(1, r));
    return Math.max(0.5, Math.min(1, 1.5 / devicePixelRatio));
  }
  function particleCount(n2) {
    const k = current2.graphics.particles;
    if (k >= 1) return n2;
    const f = n2 * k;
    return Math.floor(f) + (Math.random() < f - Math.floor(f) ? 1 : 0);
  }
  function lightBudget() {
    const q = current2.graphics.lightQuality;
    return q === "high" ? { minor: true, radiusK: 1 } : q === "medium" ? { minor: true, radiusK: 0.85 } : { minor: false, radiusK: 0.75 };
  }

  // src/client/audio.ts
  var focused = typeof document === "undefined" ? true : document.hasFocus();
  var DEV_MUTED = typeof navigator !== "undefined" && / Claude\//.test(navigator.userAgent) && !(typeof location !== "undefined" && /[?&]sound=1/.test(location.search));
  var clamp012 = (v2) => Math.max(0, Math.min(1, v2));
  var bus = null;
  function audioBus() {
    if (bus) return bus;
    const AC = window.AudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const mk = () => {
        const g = ctx.createGain();
        g.connect(master);
        return g;
      };
      bus = { ctx, master, channels: { music: mk(), effects: mk(), ui: mk() } };
      applyGains();
    } catch {
      bus = null;
    }
    return bus;
  }
  function applyGains() {
    if (!bus) return;
    const a = getSettings().audio;
    const t4 = bus.ctx.currentTime;
    bus.master.gain.setTargetAtTime(DEV_MUTED || a.muteUnfocused && !focused ? 0 : clamp012(a.master), t4, 0.05);
    for (const ch of ["music", "effects", "ui"]) bus.channels[ch].gain.setTargetAtTime(clamp012(a[ch]), t4, 0.05);
  }
  subscribe((_s, group) => {
    if (group === "audio") applyGains();
  });
  if (typeof window !== "undefined") {
    window.addEventListener("focus", () => {
      focused = true;
      applyGains();
    });
    window.addEventListener("blur", () => {
      focused = false;
      applyGains();
    });
    document.addEventListener("visibilitychange", () => {
      focused = !document.hidden && document.hasFocus();
      applyGains();
    });
  }
  var uiPlayer = null;
  function registerUiSound(fn) {
    uiPlayer = fn;
  }

  // src/client/audio/engine.ts
  var eng = null;
  var readyFns = [];
  function engine() {
    return eng && eng.ctx.state === "running" ? eng : null;
  }
  function engineAny() {
    return eng;
  }
  function onEngineReady(fn) {
    if (eng) fn(eng);
    else readyFns.push(fn);
  }
  function noiseBuffer(ctx, secs, kind2) {
    const n2 = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(1, n2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last2 = 0;
    for (let i = 0; i < n2; i++) {
      const w = Math.random() * 2 - 1;
      if (kind2 === "white") d[i] = w;
      else if (kind2 === "pink") {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else if (kind2 === "brown") {
        last2 = (last2 + 0.02 * w) / 1.02;
        d[i] = last2 * 3.5;
      } else {
        d[i] = Math.random() < 18e-4 ? w * (0.4 + Math.random() * 0.6) : Math.random() < 0.02 ? w * 0.08 : 0;
      }
    }
    return buf;
  }
  function impulse(ctx, secs, decay, dark) {
    const n2 = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, n2, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n2; i++) {
        const t4 = i / n2;
        const k = dark * t4;
        lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
        const er = i < ctx.sampleRate * 0.08 && Math.random() < 2e-3 ? (Math.random() * 2 - 1) * 2 : 0;
        d[i] = (lp + er) * Math.pow(1 - t4, decay);
      }
    }
    return buf;
  }
  function clipCurve(amount) {
    const n2 = 1024;
    const c = new Float32Array(n2);
    for (let i = 0; i < n2; i++) {
      const x2 = i / (n2 - 1) * 2 - 1;
      c[i] = Math.tanh(x2 * amount) / Math.tanh(amount);
    }
    return c;
  }
  function build() {
    const b = audioBus();
    if (!b) return null;
    const ctx = b.ctx;
    const sfxIn = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 5;
    comp.attack.value = 4e-3;
    comp.release.value = 0.18;
    sfxIn.connect(comp).connect(b.channels.effects);
    const sfxVerbIn = ctx.createGain();
    sfxVerbIn.gain.value = 0.9;
    const sfxVerb = ctx.createConvolver();
    sfxVerb.buffer = impulse(ctx, 1.8, 3.2, 0.75);
    const sfxVerbOut = ctx.createGain();
    sfxVerbOut.gain.value = 0.35;
    sfxVerbIn.connect(sfxVerb).connect(sfxVerbOut).connect(b.channels.effects);
    const musIn = ctx.createGain();
    const musComp = ctx.createDynamicsCompressor();
    musComp.threshold.value = -18;
    musComp.ratio.value = 3;
    musIn.connect(musComp).connect(b.channels.music);
    const musVerbIn = ctx.createGain();
    const musVerb = ctx.createConvolver();
    musVerb.buffer = impulse(ctx, 4.5, 2.2, 0.85);
    const musVerbOut = ctx.createGain();
    musVerbOut.gain.value = 0.6;
    musVerbIn.connect(musVerb).connect(musVerbOut).connect(musComp);
    const uiIn = ctx.createGain();
    const uiComp = ctx.createDynamicsCompressor();
    uiComp.threshold.value = -10;
    uiIn.connect(uiComp).connect(b.channels.ui);
    return {
      ctx,
      sfx: sfxIn,
      sfxVerb: sfxVerbIn,
      music: musIn,
      musicVerb: musVerbIn,
      ui: uiIn,
      noise: {
        white: noiseBuffer(ctx, 2, "white"),
        pink: noiseBuffer(ctx, 2, "pink"),
        brown: noiseBuffer(ctx, 4, "brown"),
        crackle: noiseBuffer(ctx, 3, "crackle")
      },
      grit: clipCurve(2.5),
      hard: clipCurve(9)
    };
  }
  function unlockAudio() {
    if (!eng) {
      eng = build();
      if (eng) for (const fn of readyFns.splice(0)) fn(eng);
    }
    if (eng && eng.ctx.state === "suspended") void eng.ctx.resume();
  }
  if (typeof window !== "undefined") {
    const gesture = () => unlockAudio();
    for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, gesture, { capture: true });
  }
  var listener = { x: 0, y: 0, valid: false };
  var MAX_DIST = 1500;
  var REF_DIST = 260;
  function spatial(x2, y2) {
    if (x2 === void 0 || y2 === void 0 || !listener.valid) return { gain: 1, pan: 0, lp: 2e4, dist: 0 };
    const dx = x2 - listener.x;
    const dy = (y2 - listener.y) * 0.8;
    const d = Math.hypot(dx, dy);
    if (d > MAX_DIST) return null;
    const over = Math.max(0, d - REF_DIST);
    const gain = 1 / (1 + (over / 380) ** 2) * (1 - d / MAX_DIST) ** 0.5;
    const pan = Math.max(-0.85, Math.min(0.85, dx / 650));
    const lp = 18e3 * Math.pow(0.12, Math.min(1, over / 1100));
    return { gain, pan, lp, dist: d };
  }
  var MAX_VOICES = { sfx: 40, ui: 8, music: 64 };
  var voices = [];
  var recent = /* @__PURE__ */ new Map();
  function reap(now4) {
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= now4) free(voices.splice(i, 1)[0]);
  }
  function free(v2) {
    for (const n2 of v2.nodes) {
      try {
        n2.disconnect();
      } catch {
      }
    }
  }
  function admit(id, bus2, prio, now4, maxSame) {
    reap(now4);
    const r = (recent.get(id) ?? []).filter((t4) => now4 - t4 < 0.06);
    if (r.length >= maxSame) return false;
    r.push(now4);
    recent.set(id, r);
    const mine = voices.filter((v2) => v2.bus === bus2);
    if (mine.length < MAX_VOICES[bus2]) return true;
    let victim = null;
    for (const v2 of mine) if (v2.prio <= prio && (!victim || v2.prio < victim.prio || v2.prio === victim.prio && v2.start < victim.start)) victim = v2;
    if (!victim) return false;
    victim.out.gain.cancelScheduledValues(now4);
    victim.out.gain.setTargetAtTime(0, now4, 0.01);
    const vv = victim;
    voices.splice(voices.indexOf(vv), 1);
    setTimeout(() => free(vv), 80);
    return true;
  }
  function track(v2) {
    voices.push(v2);
  }

  // src/client/audio/synth.ts
  function tone(v2, o) {
    const { ctx } = v2;
    const t0 = v2.t + (o.at ?? 0);
    const pm = o.noPitch ? 1 : v2.p;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(Math.max(1, o.f * pm), t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2 * pm), t0 + (o.glide ?? o.dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    env(g.gain, t0, o.a ?? 4e-3, o.dur, o.vol ?? 0.5, o.curve);
    let node = osc;
    if (o.vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = o.vib.rate;
      const lg = ctx.createGain();
      lg.gain.value = o.vib.depth;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + o.dur + 0.05);
    }
    if (o.filter) node = node.connect(filt(v2, o.filter, t0, o.dur));
    node.connect(g);
    route(v2, g, o.verb, o.pan, o.dest);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
    return t0 + o.dur;
  }
  function noise(v2, o) {
    const { ctx } = v2;
    const t0 = v2.t + (o.at ?? 0);
    const src = ctx.createBufferSource();
    const buf = v2.e.noise[o.color ?? "white"];
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = (o.rate ?? 1) * (o.color === "crackle" ? 1 : Math.sqrt(v2.p));
    const g = ctx.createGain();
    if (o.hold) {
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(o.vol ?? 0.5, t0 + (o.a ?? 4e-3));
      g.gain.setValueAtTime(o.vol ?? 0.5, t0 + o.dur * o.hold);
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + o.dur);
    } else env(g.gain, t0, o.a ?? 2e-3, o.dur, o.vol ?? 0.5, o.curve);
    let node = src;
    if (o.filter) node = node.connect(filt(v2, o.filter, t0, o.dur));
    if (o.filter2) node = node.connect(filt(v2, o.filter2, t0, o.dur));
    node.connect(g);
    route(v2, g, o.verb, o.pan, o.dest);
    src.start(t0, v2.r() * (buf.duration - 0.1));
    src.stop(t0 + o.dur + 0.05);
    return t0 + o.dur;
  }
  function metal(v2, o) {
    let end = 0;
    o.ratios.forEach((ra, i) => {
      const d = o.dur * Math.pow(o.decayK ?? 0.75, i);
      end = Math.max(end, tone(v2, { at: o.at, type: o.type ?? "sine", f: o.f * ra * (1 + (v2.r() - 0.5) * 4e-3), dur: d, a: 1e-3, vol: (o.vol ?? 0.3) / (1 + i * 0.6), verb: o.verb, pan: o.pan, dest: o.dest }));
    });
    return end;
  }
  function fm(v2, o) {
    const { ctx } = v2;
    const t0 = v2.t + (o.at ?? 0);
    const pm = o.noPitch ? 1 : v2.p;
    const car = ctx.createOscillator();
    car.type = o.type ?? "sine";
    car.frequency.setValueAtTime(o.f * pm, t0);
    if (o.f2) car.frequency.exponentialRampToValueAtTime(o.f2 * pm, t0 + o.dur);
    const mod = ctx.createOscillator();
    mod.frequency.setValueAtTime(o.f * o.ratio * pm, t0);
    if (o.f2) mod.frequency.exponentialRampToValueAtTime(o.f2 * o.ratio * pm, t0 + o.dur);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(o.index * pm, t0);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, o.index * 0.05), t0 + o.dur);
    mod.connect(mg).connect(car.frequency);
    const g = ctx.createGain();
    env(g.gain, t0, o.a ?? 2e-3, o.dur, o.vol ?? 0.4);
    car.connect(g);
    route(v2, g, o.verb, o.pan, o.dest);
    car.start(t0);
    mod.start(t0);
    car.stop(t0 + o.dur + 0.05);
    mod.stop(t0 + o.dur + 0.05);
    return t0 + o.dur;
  }
  function shaper(v2, hard = false, out = v2.out) {
    const ws = v2.ctx.createWaveShaper();
    ws.curve = hard ? v2.e.hard : v2.e.grit;
    ws.oversample = "2x";
    ws.connect(out);
    return ws;
  }
  function sub2(v2, out, at2 = 0) {
    return { ...v2, out, t: v2.t + at2 };
  }
  function env(p, t0, a, dur, vol, curve = "exp") {
    p.setValueAtTime(1e-4, t0);
    if (curve === "lin") {
      p.linearRampToValueAtTime(vol, t0 + a);
      p.linearRampToValueAtTime(1e-4, t0 + dur);
    } else {
      p.exponentialRampToValueAtTime(Math.max(2e-4, vol), t0 + Math.max(1e-3, a));
      p.exponentialRampToValueAtTime(1e-4, t0 + Math.max(a + 5e-3, dur));
    }
  }
  function filt(v2, f, t0, dur) {
    const b = v2.ctx.createBiquadFilter();
    b.type = f.type;
    b.frequency.setValueAtTime(Math.min(2e4, f.f * v2.p), t0);
    if (f.f2) b.frequency.exponentialRampToValueAtTime(Math.min(2e4, f.f2 * v2.p), t0 + dur);
    if (f.q !== void 0) b.Q.value = f.q;
    return b;
  }
  function route(v2, g, verb, pan, dest) {
    let n2 = g;
    if (pan) {
      const p = v2.ctx.createStereoPanner();
      p.pan.value = pan;
      n2 = g.connect(p);
    }
    n2.connect(dest ?? v2.out);
    if (verb && v2.verb) {
      const s = v2.ctx.createGain();
      s.gain.value = verb;
      n2.connect(s).connect(v2.verb);
    }
  }
  var midi = (n2) => 440 * Math.pow(2, (n2 - 69) / 12);

  // src/client/audio/sfx.ts
  var R2 = {};
  var M2 = {};
  function def(id, meta, fn) {
    R2[id] = fn;
    M2[id] = meta;
  }
  var whoosh = (v2, f, f2, dur, vol, q = 1.4, at2 = 0) => noise(v2, { at: at2, color: "pink", dur, a: dur * 0.35, vol, curve: "lin", filter: { type: "bandpass", f, f2, q } });
  var thud = (v2, f, f2, dur, vol, at2 = 0) => tone(v2, { at: at2, type: "sine", f, f2, dur, a: 2e-3, vol });
  var tick = (v2, f, dur, vol, at2 = 0) => noise(v2, { at: at2, dur, vol, filter: { type: "bandpass", f, q: 2.5 } });
  var crackle = (v2, dur, vol, at2 = 0, f = 2500) => noise(v2, { at: at2, color: "crackle", dur, vol, a: 0.02, hold: 0.6, filter: { type: "highpass", f } });
  var rumble = (v2, dur, vol, f = 400, at2 = 0) => noise(v2, { at: at2, color: "brown", dur, vol, a: 0.01, filter: { type: "lowpass", f, f2: f * 0.3 } });
  function vocal(v2, o) {
    const { ctx } = v2;
    const t0 = v2.t + (o.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sawtooth";
    osc.frequency.setValueAtTime(o.f * v2.p, t0);
    osc.frequency.exponentialRampToValueAtTime(o.f2 * v2.p, t0 + o.dur);
    const am = ctx.createGain();
    am.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.rough * (0.85 + v2.r() * 0.3);
    const lg = ctx.createGain();
    lg.gain.value = 0.4;
    lfo.connect(lg).connect(am.gain);
    osc.connect(am);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(o.vol, t0 + (o.a ?? 0.04));
    g.gain.setValueAtTime(o.vol, t0 + o.dur * 0.55);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + o.dur);
    const dist = shaper(v2, false, g);
    for (const [i, ff] of o.formants.entries()) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = ff * (0.9 + v2.r() * 0.2);
      bp.Q.value = 3 + i;
      am.connect(bp).connect(dist);
    }
    g.connect(v2.out);
    for (const n2 of [osc, lfo]) {
      n2.start(t0);
      n2.stop(t0 + o.dur + 0.05);
    }
    if (o.breath) noise(v2, { at: o.at, color: "pink", dur: o.dur, a: 0.05, vol: o.breath, curve: "lin", filter: { type: "bandpass", f: o.formants[1], q: 1.5 } });
    return t0 + o.dur;
  }
  function zap(v2, at2, dur, vol) {
    const s = shaper(v2, true);
    tone(sub2(v2, s, at2), { type: "sawtooth", f: 900 + v2.r() * 800, f2: 120, dur, vol: vol * 0.5 });
    noise(sub2(v2, s, at2), { dur: dur * 0.7, vol, filter: { type: "bandpass", f: 3200, q: 1.2 } });
    return v2.t + at2 + dur;
  }
  function chord(v2, notes, o) {
    let end = 0;
    for (const n2 of notes)
      for (const d of [-(o.detune ?? 6), o.detune ?? 6])
        end = Math.max(
          end,
          tone(v2, { at: o.at, type: o.type ?? "sawtooth", f: midi(n2), dur: o.dur, a: o.a ?? 0.08, vol: o.vol / notes.length, detune: d, curve: "lin", verb: o.verb, filter: o.lp ? { type: "lowpass", f: o.lp, q: 0.7 } : void 0 })
        );
    return end;
  }
  var W2 = { cat: "weapon", prio: 5, vol: 0.55, pv: 0.08, vv: 0.15, max: 3, verb: 0.15 };
  def("swing.sword", W2, (v2) => {
    whoosh(v2, 700, 2600, 0.22, 0.7, 1.6);
    return metal(v2, { at: 0.04, f: 2900, ratios: [1, 1.51, 2.32], dur: 0.25, vol: 0.025 });
  });
  def("swing.axe", W2, (v2) => {
    tone(v2, { type: "sine", f: 95, f2: 60, dur: 0.3, a: 0.12, vol: 0.18, curve: "lin" });
    return whoosh(v2, 260, 900, 0.34, 0.9, 1.1);
  });
  def("swing.mace", W2, (v2) => {
    tone(v2, { type: "triangle", f: 80, f2: 55, dur: 0.28, a: 0.1, vol: 0.2, curve: "lin" });
    whoosh(v2, 220, 750, 0.3, 0.85, 1.2);
    return tick(v2, 1800, 0.03, 0.08, 0.02);
  });
  def("swing.spear", W2, (v2) => {
    tone(v2, { type: "triangle", f: 190, f2: 140, dur: 0.08, vol: 0.08 });
    return noise(v2, { color: "pink", dur: 0.16, a: 0.02, vol: 0.7, filter: { type: "bandpass", f: 1200, f2: 3200, q: 1.8 } });
  });
  def("swing.dagger", W2, (v2) => whoosh(v2, 1500, 4200, 0.11, 0.55, 2));
  def("swing.claw", W2, (v2) => {
    whoosh(v2, 1800, 4500, 0.08, 0.5, 2.5);
    return whoosh(v2, 1600, 4e3, 0.09, 0.45, 2.5, 0.07);
  });
  def("swing.staff", W2, (v2) => {
    tone(v2, { type: "sine", f: 220, dur: 0.35, a: 0.1, vol: 0.06, vib: { rate: 7, depth: 6 }, curve: "lin" });
    return whoosh(v2, 350, 1200, 0.32, 0.8, 1);
  });
  def("bow.draw", { ...W2, vol: 0.4 }, (v2) => {
    noise(v2, { color: "pink", dur: 0.45, a: 0.35, vol: 0.3, curve: "lin", filter: { type: "bandpass", f: 1400, f2: 2200, q: 9 } });
    return tone(v2, { type: "sawtooth", f: 55, f2: 75, dur: 0.45, a: 0.3, vol: 0.05, curve: "lin", filter: { type: "lowpass", f: 600 } });
  });
  def("bow.release", W2, (v2) => {
    tone(v2, { type: "triangle", f: 118, f2: 96, dur: 0.22, vol: 0.35 });
    metal(v2, { f: 330, ratios: [1, 2.01, 3.03], dur: 0.15, vol: 0.12 });
    return noise(v2, { at: 0.01, color: "pink", dur: 0.14, vol: 0.4, filter: { type: "bandpass", f: 3e3, f2: 1600, q: 2 } });
  });
  def("crossbow.fire", W2, (v2) => {
    tick(v2, 2500, 0.02, 0.6);
    thud(v2, 220, 90, 0.1, 0.5);
    tone(v2, { type: "triangle", f: 160, f2: 120, dur: 0.18, vol: 0.25 });
    return noise(v2, { at: 0.01, color: "pink", dur: 0.15, vol: 0.4, filter: { type: "bandpass", f: 2600, f2: 1300, q: 2 } });
  });
  def("wand.cast", W2, (v2) => {
    fm(v2, { f: 880, ratio: 3.5, index: 700, dur: 0.22, vol: 0.12, f2: 1300 });
    return noise(v2, { dur: 0.2, vol: 0.2, a: 0.03, filter: { type: "highpass", f: 5e3 } });
  });
  var H2 = { cat: "hit", prio: 6, vol: 0.75, pv: 0.1, vv: 0.15, max: 4, verb: 0.1 };
  def("hit.flesh", H2, (v2) => {
    thud(v2, 150, 45, 0.13, 0.8);
    noise(v2, { color: "pink", dur: 0.11, vol: 0.5, filter: { type: "lowpass", f: 1100 } });
    return noise(sub2(v2, shaper(v2)), { dur: 0.06, vol: 0.3, filter: { type: "bandpass", f: 450, q: 1.5 } });
  });
  def("hit.armour", H2, (v2) => {
    thud(v2, 130, 60, 0.1, 0.5);
    tick(v2, 3500, 0.03, 0.5);
    return metal(v2, { f: 520, ratios: [1, 2.76, 5.4, 8.93], dur: 0.35, vol: 0.25, verb: 0.2 });
  });
  def("hit.stone", H2, (v2) => {
    noise(v2, { dur: 0.08, vol: 0.6, filter: { type: "bandpass", f: 1300, q: 2 } });
    rumble(v2, 0.2, 0.5, 500);
    return thud(v2, 95, 50, 0.14, 0.6);
  });
  def("hit.block", { ...H2, prio: 7 }, (v2) => {
    const s = shaper(v2);
    thud(sub2(v2, s), 115, 70, 0.18, 0.8);
    metal(v2, { f: 300, ratios: [1, 1.48, 2.21, 3.1], dur: 0.32, vol: 0.2, verb: 0.3 });
    return noise(v2, { dur: 0.06, vol: 0.5, filter: { type: "lowpass", f: 2200 } });
  });
  def("hit.evade", { ...H2, vol: 0.5 }, (v2) => whoosh(v2, 1600, 600, 0.16, 0.8, 2));
  def("hit.crit", { ...H2, prio: 8, vol: 0.9 }, (v2) => {
    const s = shaper(v2, true);
    thud(sub2(v2, s), 160, 40, 0.18, 0.7);
    thud(v2, 60, 35, 0.3, 0.8);
    noise(v2, { dur: 0.05, vol: 0.6, filter: { type: "highpass", f: 4e3 } });
    noise(v2, { color: "pink", dur: 0.14, vol: 0.5, filter: { type: "lowpass", f: 1400 } });
    return metal(v2, { f: 1250, ratios: [1, 2.41, 3.9], dur: 0.45, vol: 0.12, verb: 0.4 });
  });
  def("hit.self", { ...H2, prio: 9, pv: 0.06 }, (v2) => {
    thud(v2, 120, 42, 0.22, 0.9);
    noise(v2, { color: "brown", dur: 0.18, vol: 0.6, filter: { type: "lowpass", f: 700 } });
    return vocal(v2, { at: 0.01, f: 150, f2: 100, dur: 0.16, formants: [620, 1150], rough: 35, vol: 0.18, a: 0.01 });
  });
  var S = { cat: "movement", prio: 2, vol: 0.35, pv: 0.12, vv: 0.25, max: 3, verb: 0.05 };
  def("dodge.roll", { ...S, prio: 5, vol: 0.6 }, (v2) => {
    noise(v2, { color: "pink", dur: 0.32, a: 0.05, vol: 0.5, filter: { type: "bandpass", f: 900, f2: 350, q: 1 } });
    noise(v2, { color: "pink", dur: 0.25, a: 0.05, vol: 0.12, filter: { type: "highpass", f: 2500 } });
    thud(v2, 110, 60, 0.07, 0.4, 0.03);
    return thud(v2, 95, 55, 0.08, 0.45, 0.24);
  });
  def("step.dirt", S, (v2) => {
    noise(v2, { color: "brown", dur: 0.07, vol: 0.6, filter: { type: "lowpass", f: 600 } });
    return noise(v2, { color: "pink", dur: 0.05, vol: 0.2, filter: { type: "bandpass", f: 1600, q: 1.5 } });
  });
  def("step.grass", S, (v2) => {
    thud(v2, 85, 60, 0.05, 0.25);
    return noise(v2, { color: "pink", dur: 0.1, a: 0.015, vol: 0.25, filter: { type: "highpass", f: 2600 } });
  });
  def("step.mud", S, (v2) => {
    tone(v2, { type: "sine", f: 320, f2: 110, dur: 0.09, vol: 0.2, filter: { type: "lowpass", f: 900 } });
    return noise(v2, { color: "pink", dur: 0.13, a: 0.02, vol: 0.35, filter: { type: "lowpass", f: 750 } });
  });
  def("step.water", S, (v2) => {
    noise(v2, { color: "white", dur: 0.18, a: 0.01, vol: 0.3, filter: { type: "bandpass", f: 1900, f2: 700, q: 1.2 } });
    return tone(v2, { at: 0.03 + v2.r() * 0.04, type: "sine", f: 600 + v2.r() * 300, f2: 1300, dur: 0.04, vol: 0.06 });
  });
  def("step.stone", S, (v2) => {
    noise(v2, { dur: 0.035, vol: 0.35, filter: { type: "bandpass", f: 2400, q: 3 } });
    return thud(v2, 160, 90, 0.045, 0.35);
  });
  var K2 = { cat: "skill", prio: 6, vol: 0.6, pv: 0.06, vv: 0.12, max: 3, verb: 0.3 };
  def("skill.fire", K2, (v2) => {
    noise(v2, { color: "brown", dur: 0.55, a: 0.12, vol: 0.9, curve: "lin", filter: { type: "lowpass", f: 300, f2: 2600 } });
    tone(v2, { type: "sawtooth", f: 62, f2: 48, dur: 0.5, a: 0.1, vol: 0.1, filter: { type: "lowpass", f: 300 } });
    return crackle(v2, 0.6, 0.6, 0.05);
  });
  def("skill.cold", K2, (v2) => {
    noise(v2, { dur: 0.5, a: 0.1, vol: 0.25, curve: "lin", filter: { type: "highpass", f: 6e3, f2: 2e3 } });
    metal(v2, { f: 1800, ratios: [1, 1.34, 2.09, 2.97], dur: 0.7, vol: 0.08, verb: 0.5 });
    return fm(v2, { at: 0.03, f: 2400, ratio: 1.41, index: 900, dur: 0.3, vol: 0.05 });
  });
  def("skill.lightning", K2, (v2) => {
    zap(v2, 0, 0.12, 0.5);
    zap(v2, 0.05 + v2.r() * 0.04, 0.1, 0.4);
    return crackle(v2, 0.35, 0.5, 0.02, 4e3);
  });
  def("skill.chaos", K2, (v2) => {
    fm(v2, { f: 70, ratio: 1.41, index: 420, dur: 0.75, vol: 0.35, a: 0.15, f2: 45 });
    noise(v2, { color: "pink", dur: 0.6, a: 0.45, vol: 0.5, curve: "lin", filter: { type: "bandpass", f: 300, f2: 900, q: 7 } });
    tone(v2, { type: "sawtooth", f: 110, dur: 0.6, a: 0.2, vol: 0.06, detune: 40, filter: { type: "lowpass", f: 700 } });
    return tone(v2, { type: "sawtooth", f: 116.5, dur: 0.6, a: 0.2, vol: 0.06, filter: { type: "lowpass", f: 700 } });
  });
  def("skill.slam", { ...K2, prio: 7, vol: 0.85 }, (v2) => {
    const s = shaper(v2);
    thud(sub2(v2, s), 75, 28, 0.6, 1);
    rumble(v2, 0.7, 0.9, 900);
    noise(v2, { dur: 0.05, vol: 0.5, filter: { type: "bandpass", f: 1500, q: 1 } });
    return crackle(v2, 0.6, 0.5, 0.08, 1200);
  });
  def("skill.projectile", K2, (v2) => {
    noise(v2, { color: "pink", dur: 0.25, a: 0.02, vol: 0.6, filter: { type: "bandpass", f: 2200, f2: 800, q: 2 } });
    return tone(v2, { type: "triangle", f: 600, f2: 280, dur: 0.12, vol: 0.08 });
  });
  def("skill.nova", K2, (v2) => {
    noise(v2, { color: "pink", dur: 0.55, a: 0.04, vol: 0.7, filter: { type: "bandpass", f: 200, f2: 4500, q: 1.5 } });
    tone(v2, { type: "sine", f: 110, f2: 440, dur: 0.45, a: 0.02, vol: 0.2 });
    return metal(v2, { at: 0.05, f: 660, ratios: [1, 2.02, 2.99], dur: 0.8, vol: 0.06, verb: 0.6 });
  });
  def("skill.chain", K2, (v2) => {
    let e = 0;
    for (let i = 0; i < 4; i++) e = zap(v2, i * (0.06 + v2.r() * 0.03), 0.07, 0.35 - i * 0.05);
    return Math.max(e, crackle(v2, 0.4, 0.4, 0, 4e3));
  });
  def("skill.buff", K2, (v2) => {
    for (const [i, n2] of [57, 60, 64, 69].entries()) tone(v2, { at: i * 0.05, type: "triangle", f: midi(n2), dur: 0.9, a: 0.15, vol: 0.08, vib: { rate: 5, depth: 3 }, verb: 0.4 });
    return noise(v2, { dur: 0.8, a: 0.4, vol: 0.08, curve: "lin", filter: { type: "highpass", f: 5e3 } });
  });
  def("skill.summon", K2, (v2) => {
    vocal(v2, { f: 98, f2: 92, dur: 1.1, formants: [400, 850], rough: 6, vol: 0.12, a: 0.4, breath: 0.08 });
    vocal(v2, { f: 147, f2: 139, dur: 1.1, formants: [500, 1e3], rough: 5, vol: 0.08, a: 0.5 });
    noise(v2, { color: "pink", dur: 0.8, a: 0.7, vol: 0.4, curve: "lin", filter: { type: "bandpass", f: 300, f2: 1800, q: 2 } });
    for (let i = 0; i < 6; i++) tick(v2, 1800 + v2.r() * 1500, 0.02, 0.15, 0.5 + v2.r() * 0.5);
    return v2.t + 1.15;
  });
  def("skill.dash", K2, (v2) => {
    noise(v2, { color: "pink", dur: 0.22, a: 0.03, vol: 0.8, filter: { type: "bandpass", f: 500, f2: 3500, q: 1.3 } });
    return noise(v2, { at: 0.12, color: "brown", dur: 0.35, a: 0.05, vol: 0.4, filter: { type: "lowpass", f: 900 } });
  });
  def("skill.aura", { ...K2, vol: 0.45 }, (v2) => {
    for (const n2 of [45, 52, 57]) tone(v2, { type: "sawtooth", f: midi(n2), dur: 1.2, a: 0.5, vol: 0.05, curve: "lin", filter: { type: "lowpass", f: 900 }, vib: { rate: 0.7 + v2.r(), depth: 1 } });
    return metal(v2, { at: 0.2, f: 880, ratios: [1, 1.5], dur: 1, vol: 0.04, verb: 0.6 });
  });
  def("impact.fire", K2, (v2) => {
    noise(v2, { color: "pink", dur: 0.4, vol: 0.8, filter: { type: "lowpass", f: 3200, f2: 350 } });
    thud(v2, 110, 45, 0.2, 0.6);
    return crackle(v2, 0.7, 0.5, 0.1);
  });
  def("impact.cold", K2, (v2) => {
    metal(v2, { f: 2500, ratios: [1, 1.71, 2.93, 4.1], dur: 0.32, vol: 0.12 });
    noise(v2, { dur: 0.15, vol: 0.4, filter: { type: "highpass", f: 4e3 } });
    return noise(v2, { dur: 0.08, vol: 0.4, filter: { type: "bandpass", f: 1400, q: 2 } });
  });
  def("impact.lightning", K2, (v2) => {
    noise(sub2(v2, shaper(v2, true)), { dur: 0.08, vol: 0.7, filter: { type: "highpass", f: 1800 } });
    thud(v2, 65, 35, 0.2, 0.7);
    return crackle(v2, 0.3, 0.4, 0.04, 4e3);
  });
  def("impact.chaos", K2, (v2) => {
    fm(v2, { f: 150, f2: 55, ratio: 0.71, index: 300, dur: 0.35, vol: 0.4 });
    return noise(v2, { color: "pink", dur: 0.3, vol: 0.5, filter: { type: "bandpass", f: 520, q: 3 } });
  });
  def("impact.projectile", K2, (v2) => {
    thud(v2, 210, 80, 0.08, 0.6);
    return tick(v2, 2e3, 0.03, 0.4);
  });
  def("boom", { ...K2, prio: 8, vol: 0.95, max: 2 }, (v2) => {
    const s = shaper(v2);
    thud(sub2(v2, s), 62, 24, 1, 1);
    noise(sub2(v2, s), { color: "brown", dur: 1.3, a: 5e-3, vol: 1, filter: { type: "lowpass", f: 2400, f2: 180 } });
    noise(v2, { dur: 0.06, vol: 0.5, filter: { type: "highpass", f: 2e3 } });
    return crackle(v2, 1.1, 0.5, 0.1, 1500);
  });
  var A = { cat: "ailment", prio: 5, vol: 0.55, pv: 0.07, vv: 0.15, max: 2, verb: 0.25 };
  def("ailment.freeze", A, (v2) => {
    noise(sub2(v2, shaper(v2, true)), { dur: 0.06, vol: 0.5, filter: { type: "highpass", f: 3e3 } });
    metal(v2, { f: 1500, ratios: [1, 2.31, 3.72, 5.1], dur: 0.55, vol: 0.14 });
    return noise(v2, { at: 0.04, color: "pink", dur: 0.35, a: 0.05, vol: 0.2, filter: { type: "bandpass", f: 900, q: 8 } });
  });
  def("ailment.chill", A, (v2) => {
    noise(v2, { dur: 0.45, a: 0.15, vol: 0.18, curve: "lin", filter: { type: "highpass", f: 5500, f2: 3e3 } });
    return metal(v2, { f: 2600, ratios: [1, 1.5], dur: 0.4, vol: 0.04 });
  });
  def("ailment.ignite", A, (v2) => {
    noise(v2, { color: "brown", dur: 0.5, a: 0.05, vol: 0.5, filter: { type: "lowpass", f: 900, f2: 2e3 } });
    return crackle(v2, 0.9, 0.8, 0, 1800);
  });
  def("ailment.shock", A, (v2) => {
    tone(sub2(v2, shaper(v2, true)), { type: "square", f: 62, dur: 0.35, vol: 0.12, filter: { type: "bandpass", f: 1500, q: 2 } });
    return zap(v2, 0, 0.08, 0.4);
  });
  def("ailment.bleed", A, (v2) => {
    tone(v2, { type: "sine", f: 900, f2: 280, dur: 0.06, vol: 0.12 });
    return tone(v2, { at: 0.12 + v2.r() * 0.08, type: "sine", f: 800, f2: 260, dur: 0.06, vol: 0.1 });
  });
  def("ailment.poison", A, (v2) => {
    let e = 0;
    for (let i = 0; i < 5; i++) e = tone(v2, { at: i * 0.07 + v2.r() * 0.04, type: "sine", f: 250 + v2.r() * 300, f2: 500 + v2.r() * 400, dur: 0.05, vol: 0.1, filter: { type: "lowpass", f: 1200 } });
    return e;
  });
  var MF = { cat: "monster", prio: 4, vol: 0.55, pv: 0.12, vv: 0.15, max: 2, verb: 0.2 };
  def("mon.beast.growl", MF, (v2) => vocal(v2, { f: 95, f2: 80, dur: 0.7, formants: [520, 1250], rough: 45, vol: 0.35, a: 0.15, breath: 0.08 }));
  def("mon.beast.attack", { ...MF, prio: 5 }, (v2) => {
    vocal(v2, { f: 190, f2: 120, dur: 0.25, formants: [700, 1600], rough: 55, vol: 0.4, a: 0.02, breath: 0.15 });
    return tick(v2, 2200, 0.02, 0.3, 0.2);
  });
  def("mon.beast.hurt", MF, (v2) => vocal(v2, { f: 320, f2: 210, dur: 0.15, formants: [800, 1800], rough: 30, vol: 0.3, a: 0.01 }));
  def("mon.beast.death", { ...MF, prio: 5 }, (v2) => vocal(v2, { f: 280, f2: 55, dur: 0.75, formants: [700, 1500], rough: 40, vol: 0.4, a: 0.02, breath: 0.1 }));
  def("mon.caster.growl", MF, (v2) => {
    noise(v2, { color: "pink", dur: 0.9, a: 0.3, vol: 0.3, curve: "lin", filter: { type: "bandpass", f: 2400, q: 4 }, filter2: { type: "bandpass", f: 700, q: 1 } });
    return vocal(v2, { f: 140, f2: 125, dur: 0.9, formants: [450, 2300], rough: 9, vol: 0.12, a: 0.3, type: "triangle" });
  });
  def("mon.caster.attack", { ...MF, prio: 5 }, (v2) => {
    noise(v2, { color: "pink", dur: 0.45, a: 0.35, vol: 0.35, curve: "lin", filter: { type: "bandpass", f: 600, f2: 2800, q: 5 } });
    return fm(v2, { f: 220, f2: 440, ratio: 2.5, index: 300, dur: 0.45, vol: 0.12, a: 0.3 });
  });
  def("mon.caster.hurt", MF, (v2) => vocal(v2, { f: 260, f2: 200, dur: 0.18, formants: [600, 2400], rough: 20, vol: 0.22, a: 0.01, breath: 0.15 }));
  def("mon.caster.death", { ...MF, prio: 5 }, (v2) => {
    vocal(v2, { f: 200, f2: 60, dur: 0.9, formants: [500, 1800], rough: 14, vol: 0.25, a: 0.02, breath: 0.2 });
    let e = 0;
    for (let i = 0; i < 6; i++) e = tone(v2, { at: 0.3 + i * 0.09 + v2.r() * 0.05, type: "sine", f: 180 + v2.r() * 200, f2: 400, dur: 0.05, vol: 0.08 });
    return e;
  });
  def("mon.brute.growl", MF, (v2) => {
    rumble(v2, 0.9, 0.3, 300);
    return vocal(v2, { f: 52, f2: 44, dur: 1, formants: [300, 720], rough: 22, vol: 0.45, a: 0.25, breath: 0.05 });
  });
  def("mon.brute.attack", { ...MF, prio: 6 }, (v2) => vocal(v2, { f: 85, f2: 60, dur: 0.4, formants: [380, 900], rough: 28, vol: 0.5, a: 0.03, breath: 0.12 }));
  def("mon.brute.hurt", MF, (v2) => {
    noise(v2, { dur: 0.06, vol: 0.3, filter: { type: "bandpass", f: 1400, q: 2 } });
    return vocal(v2, { f: 110, f2: 80, dur: 0.2, formants: [400, 950], rough: 25, vol: 0.35, a: 0.01 });
  });
  def("mon.brute.death", { ...MF, prio: 6 }, (v2) => {
    vocal(v2, { f: 75, f2: 32, dur: 1.3, formants: [320, 760], rough: 18, vol: 0.5, a: 0.03, breath: 0.08 });
    rumble(v2, 1, 0.8, 600, 0.5);
    return crackle(v2, 0.8, 0.5, 0.5, 900);
  });
  var rattle = (v2, n2, at2) => {
    let e = 0;
    for (let i = 0; i < n2; i++) e = tick(v2, 1500 + v2.r() * 2e3, 0.015, 0.25, at2 + i * 0.035 + v2.r() * 0.02);
    return e;
  };
  def("mon.undead.growl", MF, (v2) => {
    tone(v2, { type: "sine", f: 160, f2: 130, dur: 1.1, a: 0.35, vol: 0.12, vib: { rate: 4.5, depth: 6 }, curve: "lin", filter: { type: "bandpass", f: 400, q: 2 } });
    noise(v2, { color: "pink", dur: 1.1, a: 0.4, vol: 0.15, curve: "lin", filter: { type: "bandpass", f: 500, q: 6 } });
    return rattle(v2, 4, 0.2);
  });
  def("mon.undead.attack", { ...MF, prio: 5 }, (v2) => {
    rattle(v2, 5, 0);
    return whoosh(v2, 400, 1400, 0.25, 0.5, 1.4, 0.1);
  });
  def("mon.undead.hurt", MF, (v2) => {
    rattle(v2, 3, 0);
    return thud(v2, 240, 140, 0.05, 0.3);
  });
  def("mon.undead.death", { ...MF, prio: 5 }, (v2) => {
    tone(v2, { type: "sine", f: 180, f2: 70, dur: 0.9, a: 0.05, vol: 0.12, vib: { rate: 5, depth: 8 }, filter: { type: "bandpass", f: 380, q: 2 } });
    return rattle(v2, 12, 0.15);
  });
  def("mon.spirit.growl", MF, (v2) => {
    tone(v2, { type: "sine", f: 520, f2: 640, dur: 1.2, a: 0.4, vol: 0.07, vib: { rate: 6, depth: 14 }, curve: "lin", verb: 0.6 });
    return noise(v2, { dur: 1.2, a: 0.5, vol: 0.06, curve: "lin", filter: { type: "bandpass", f: 1800, q: 10 } });
  });
  def("mon.spirit.attack", { ...MF, prio: 5 }, (v2) => {
    tone(v2, { type: "triangle", f: 900, f2: 300, dur: 0.35, vol: 0.12, vib: { rate: 12, depth: 30 } });
    return whoosh(v2, 3e3, 600, 0.35, 0.4);
  });
  def("mon.spirit.hurt", MF, (v2) => tone(v2, { type: "sine", f: 1e3, f2: 700, dur: 0.2, vol: 0.1, vib: { rate: 14, depth: 20 } }));
  def("mon.spirit.death", { ...MF, prio: 5 }, (v2) => {
    tone(v2, { type: "sine", f: 700, f2: 120, dur: 1.2, a: 0.02, vol: 0.12, vib: { rate: 7, depth: 25 }, verb: 0.7 });
    return noise(v2, { dur: 1, vol: 0.12, filter: { type: "bandpass", f: 2400, f2: 400, q: 6 } });
  });
  def(
    "mon.windup",
    { ...MF, prio: 5, vol: 0.45 },
    (v2) => tone(v2, { type: "sawtooth", f: 90, f2: 260, dur: 0.45, a: 0.35, vol: 0.2, curve: "lin", filter: { type: "lowpass", f: 300, f2: 1600, q: 4 } })
  );
  def("mon.bolt", { ...MF, prio: 4, max: 3 }, (v2) => {
    noise(v2, { color: "pink", dur: 0.3, a: 0.02, vol: 0.5, filter: { type: "bandpass", f: 900, f2: 400, q: 4 } });
    return fm(v2, { f: 300, f2: 160, ratio: 1.5, index: 250, dur: 0.3, vol: 0.12 });
  });
  def("hazard.warn", { ...MF, prio: 6, vol: 0.5, pv: 0.03 }, (v2) => {
    let e = 0;
    for (let i = 0; i < 3; i++) e = tone(v2, { at: i * 0.22, type: "sine", f: 70, f2: 55, dur: 0.18, a: 0.02, vol: 0.5 });
    return Math.max(e, tone(v2, { type: "sawtooth", f: 55, dur: 0.7, a: 0.5, vol: 0.06, curve: "lin", filter: { type: "lowpass", f: 400 } }));
  });
  var L = { cat: "loot", prio: 6, vol: 0.55, pv: 0.05, vv: 0.1, max: 3, verb: 0.3 };
  def("loot.normal", { ...L, prio: 3, vol: 0.4 }, (v2) => {
    thud(v2, 320, 180, 0.06, 0.4);
    return tick(v2, 1600, 0.03, 0.3);
  });
  def("loot.magic", L, (v2) => {
    thud(v2, 300, 170, 0.06, 0.3);
    return metal(v2, { at: 0.01, f: 1400, ratios: [1, 2.72, 4.1], dur: 0.3, vol: 0.15 });
  });
  def("loot.rare", { ...L, prio: 7, vol: 0.65 }, (v2) => {
    thud(v2, 280, 160, 0.07, 0.3);
    metal(v2, { at: 0, f: 1760, ratios: [1, 2.76, 4.07], dur: 0.45, vol: 0.18 });
    metal(v2, { at: 0.08, f: 2350, ratios: [1, 2.76], dur: 0.5, vol: 0.12, verb: 0.4 });
    return noise(v2, { at: 0.05, dur: 0.5, a: 0.1, vol: 0.05, filter: { type: "highpass", f: 6e3 } });
  });
  def("loot.unique", { ...L, prio: 9, vol: 0.85, pv: 0.01, max: 1, verb: 0.5 }, (v2) => {
    thud(v2, 90, 45, 0.6, 0.6);
    metal(v2, { f: midi(38), ratios: [1, 2, 2.4, 3, 4.2, 5.4], dur: 3, vol: 0.4, decayK: 0.8, verb: 0.6 });
    let e = 0;
    for (const [i, n2] of [62, 65, 69, 74, 77].entries()) e = metal(v2, { at: 0.25 + i * 0.09, f: midi(n2 + 12), ratios: [1, 2.01], dur: 1.2, vol: 0.07, verb: 0.6 });
    noise(v2, { at: 0.2, dur: 1.4, a: 0.5, vol: 0.06, curve: "lin", filter: { type: "highpass", f: 6500 } });
    return Math.max(e, v2.t + 3);
  });
  def("loot.currency", { ...L, max: 2 }, (v2) => {
    let e = 0;
    for (let i = 0; i < 3; i++) e = metal(v2, { at: i * (0.045 + v2.r() * 0.03), f: 3e3 + v2.r() * 1200, ratios: [1, 1.43, 2.6], dur: 0.18, vol: 0.12 });
    return e;
  });
  def("loot.currency.rare", { ...L, prio: 8, vol: 0.7, max: 1 }, (v2) => {
    thud(v2, 140, 60, 0.3, 0.5);
    metal(v2, { f: midi(69), ratios: [1, 2, 3.01, 4.2], dur: 1.6, vol: 0.2, verb: 0.6 });
    let e = 0;
    for (let i = 0; i < 6; i++) e = metal(v2, { at: 0.08 + i * 0.05, f: 2600 + i * 350, ratios: [1, 1.43], dur: 0.25, vol: 0.06 });
    return Math.max(e, v2.t + 1.6);
  });
  def("loot.gem", L, (v2) => {
    fm(v2, { f: 1900, ratio: 2.01, index: 500, dur: 0.6, vol: 0.12 });
    return metal(v2, { at: 0.03, f: 2850, ratios: [1, 1.5, 2.25], dur: 0.6, vol: 0.06 });
  });
  def("loot.flask", L, (v2) => {
    metal(v2, { f: 2100, ratios: [1, 2.3], dur: 0.2, vol: 0.1 });
    return noise(v2, { at: 0.03, color: "pink", dur: 0.25, a: 0.05, vol: 0.2, filter: { type: "bandpass", f: 700, f2: 1300, q: 5 } });
  });
  def("loot.pickup", { ...L, bus: "ui", prio: 6, verb: 0 }, (v2) => {
    noise(v2, { color: "pink", dur: 0.09, a: 0.02, vol: 0.4, filter: { type: "bandpass", f: 900, q: 1.5 } });
    return metal(v2, { at: 0.03, f: 2400, ratios: [1, 2.7], dur: 0.12, vol: 0.06 });
  });
  var P2 = { cat: "progression", prio: 8, vol: 0.6, pv: 0.02, vv: 0.05, max: 1, verb: 0.4 };
  def("flask.drink", { ...P2, prio: 7, pv: 0.06 }, (v2) => {
    metal(v2, { f: 2300, ratios: [1, 2.3], dur: 0.12, vol: 0.06 });
    let e = 0;
    for (let i = 0; i < 3; i++) {
      const at2 = 0.1 + i * 0.16;
      tone(v2, { at: at2, type: "sine", f: 180, f2: 420, dur: 0.07, vol: 0.25, filter: { type: "lowpass", f: 900 } });
      e = noise(v2, { at: at2, color: "pink", dur: 0.1, vol: 0.2, filter: { type: "bandpass", f: 600, q: 3 } });
    }
    return Math.max(e, tone(v2, { at: 0.5, type: "sine", f: midi(76), dur: 0.5, vol: 0.04, verb: 0.5 }));
  });
  def("flask.empty", { ...P2, bus: "ui", prio: 6 }, (v2) => {
    metal(v2, { f: 1500, ratios: [1, 2.2], dur: 0.1, vol: 0.08 });
    return tone(v2, { at: 0.03, type: "triangle", f: 140, f2: 110, dur: 0.15, vol: 0.2 });
  });
  def("levelup", P2, (v2) => {
    noise(v2, { dur: 1.4, a: 0.6, vol: 0.06, curve: "lin", filter: { type: "highpass", f: 5e3 } });
    chord(v2, [50, 57, 62], { dur: 1.6, vol: 0.18, a: 0.3, lp: 1500, verb: 0.5 });
    let e = 0;
    for (const [i, n2] of [62, 66, 69, 74].entries()) e = metal(v2, { at: 0.1 + i * 0.12, f: midi(n2 + 12), ratios: [1, 2, 3.01], dur: 1.2, vol: 0.1, verb: 0.6 });
    return Math.max(e, v2.t + 1.6);
  });
  def("ascendancy", { ...P2, prio: 9, vol: 0.75 }, (v2) => {
    thud(v2, 55, 30, 2, 0.8);
    metal(v2, { f: midi(31), ratios: [1, 1.52, 2, 2.71, 3.4, 4.6], dur: 4, vol: 0.35, decayK: 0.85, verb: 0.7 });
    chord(v2, [43, 50, 55, 59], { at: 0.4, dur: 2.6, vol: 0.25, a: 0.9, lp: 1200, verb: 0.6 });
    chord(v2, [45, 52, 57, 61, 64], { at: 1.6, dur: 2.4, vol: 0.25, a: 0.4, lp: 2200, verb: 0.6 });
    return v2.t + 4;
  });
  def("shrine.trial", { ...P2, vol: 0.6 }, (v2) => {
    metal(v2, { f: midi(36), ratios: [1, 2.32, 3.1, 4.4], dur: 3, vol: 0.25, decayK: 0.85, verb: 0.7 });
    vocal(v2, { at: 0.2, f: 110, f2: 104, dur: 2.2, formants: [380, 1700], rough: 4, vol: 0.06, a: 1, breath: 0.08 });
    noise(v2, { at: 0.1, color: "pink", dur: 2.5, a: 1.2, vol: 0.12, curve: "lin", filter: { type: "bandpass", f: 2200, q: 8 } });
    return metal(v2, { at: 1.2, f: midi(79), ratios: [1, 2.76], dur: 1.6, vol: 0.06, verb: 0.8 });
  });
  def("passive.allocate", { ...P2, bus: "ui", prio: 7, vol: 0.5, pv: 0.04, max: 2 }, (v2) => {
    thud(v2, 180, 90, 0.12, 0.3);
    return metal(v2, { f: midi(76), ratios: [1, 2, 3.02], dur: 0.6, vol: 0.12, verb: 0.4 });
  });
  def("gem.socket", { ...P2, bus: "ui", prio: 7, vol: 0.5, pv: 0.04, max: 2 }, (v2) => {
    tick(v2, 2600, 0.03, 0.4);
    return fm(v2, { at: 0.02, f: 1500, ratio: 2.4, index: 400, dur: 0.45, vol: 0.1 });
  });
  var U = { cat: "ui", bus: "ui", prio: 5, vol: 0.45, pv: 0.04, vv: 0.08, max: 2, verb: 0 };
  def("ui.click", U, (v2) => {
    tone(v2, { type: "triangle", f: 950, f2: 620, dur: 0.035, vol: 0.25 });
    return tick(v2, 3200, 0.015, 0.15);
  });
  def("ui.hover", { ...U, prio: 1, vol: 0.18, max: 1 }, (v2) => tone(v2, { type: "triangle", f: 2300, dur: 0.02, vol: 0.12 }));
  def("ui.open", U, (v2) => {
    noise(v2, { color: "pink", dur: 0.2, a: 0.06, vol: 0.3, filter: { type: "bandpass", f: 700, f2: 1800, q: 1.2 } });
    return thud(v2, 120, 80, 0.1, 0.35, 0.08);
  });
  def("ui.close", U, (v2) => {
    noise(v2, { color: "pink", dur: 0.16, a: 0.04, vol: 0.28, filter: { type: "bandpass", f: 1600, f2: 600, q: 1.2 } });
    return thud(v2, 100, 70, 0.08, 0.3, 0.06);
  });
  def("ui.error", U, (v2) => {
    tone(v2, { type: "square", f: 110, dur: 0.09, vol: 0.12, filter: { type: "lowpass", f: 700 } });
    return tone(v2, { at: 0.11, type: "square", f: 98, dur: 0.12, vol: 0.12, filter: { type: "lowpass", f: 700 } });
  });
  def("ui.confirm", U, (v2) => {
    metal(v2, { f: midi(69), ratios: [1, 2.01], dur: 0.35, vol: 0.12 });
    return metal(v2, { at: 0.08, f: midi(76), ratios: [1, 2.01], dur: 0.45, vol: 0.12 });
  });
  def("ui.tab", U, (v2) => noise(v2, { color: "pink", dur: 0.08, a: 0.01, vol: 0.3, filter: { type: "highpass", f: 1500 } }));
  def("inv.pick", U, (v2) => {
    noise(v2, { color: "pink", dur: 0.07, a: 0.01, vol: 0.35, filter: { type: "bandpass", f: 1300, q: 1.4 } });
    return tick(v2, 2600, 0.02, 0.12, 0.02);
  });
  def("inv.place", U, (v2) => {
    thud(v2, 190, 110, 0.06, 0.4);
    return metal(v2, { at: 5e-3, f: 1900, ratios: [1, 2.6], dur: 0.08, vol: 0.05 });
  });
  def("inv.equip", U, (v2) => {
    noise(v2, { color: "pink", dur: 0.1, a: 0.02, vol: 0.3, filter: { type: "bandpass", f: 900, q: 1.2 } });
    metal(v2, { at: 0.06, f: 1150, ratios: [1, 2.4, 3.9], dur: 0.2, vol: 0.12 });
    return thud(v2, 150, 90, 0.07, 0.35, 0.06);
  });
  def("inv.drop", U, (v2) => {
    thud(v2, 140, 70, 0.1, 0.45);
    return tick(v2, 1400, 0.04, 0.2, 0.02);
  });
  var X = { cat: "stinger", prio: 10, vol: 0.75, pv: 0, vv: 0, max: 1, verb: 0.5 };
  def("player.death", X, (v2) => {
    thud(v2, 70, 25, 1.6, 0.9);
    metal(v2, { f: midi(29), ratios: [1, 1.41, 2.13, 2.97, 4.07], dur: 4, vol: 0.4, decayK: 0.85, verb: 0.7 });
    chord(v2, [41, 42, 48], { at: 0.2, dur: 3, vol: 0.3, a: 0.8, lp: 700, verb: 0.6, detune: 12 });
    return noise(v2, { color: "brown", dur: 3, a: 0.05, vol: 0.4, filter: { type: "lowpass", f: 500, f2: 80 } });
  });
  def("kill.player", X, (v2) => {
    const s = shaper(v2);
    thud(sub2(v2, s), 90, 30, 0.6, 0.9);
    chord(v2, [38, 45, 50, 53], { at: 0.02, dur: 1.4, vol: 0.4, a: 0.02, lp: 1300, verb: 0.5 });
    return metal(v2, { at: 0.02, f: midi(50), ratios: [1, 2.4, 3.8], dur: 1.5, vol: 0.15, verb: 0.6 });
  });
  def("kill.distant", { ...X, prio: 6, vol: 0.4 }, (v2) => metal(v2, { f: midi(45), ratios: [1, 2.01, 2.4, 3, 4.2], dur: 2.5, vol: 0.2, decayK: 0.8, verb: 0.8 }));
  def("victory", X, (v2) => {
    const prog = [[38, 45, 50, 53], [34, 46, 50, 53], [36, 48, 52, 55], [38, 50, 54, 57, 62]];
    prog.forEach((c, i) => {
      chord(v2, c, { at: i * 0.75, dur: i === 3 ? 2.6 : 0.85, vol: 0.38, a: 0.05, lp: 1400 + i * 300, verb: 0.5 });
      thud(v2, 80, 40, 0.35, 0.7, i * 0.75);
    });
    metal(v2, { at: 2.25, f: midi(62), ratios: [1, 2, 3.01, 4.2], dur: 2.5, vol: 0.2, verb: 0.7 });
    return v2.t + 4.9;
  });
  def("defeat", X, (v2) => {
    const prog = [[41, 48, 53, 56], [40, 47, 52, 55], [36, 43, 48, 51]];
    prog.forEach((c, i) => chord(v2, c, { at: i * 1.1, dur: i === 2 ? 3 : 1.3, vol: 0.32, a: 0.4, lp: 900 - i * 150, verb: 0.6 }));
    metal(v2, { at: 2.2, f: midi(24), ratios: [1, 1.41, 2.13, 2.97], dur: 3.5, vol: 0.35, verb: 0.7 });
    return v2.t + 5.5;
  });
  def("round.countdown", { ...X, prio: 8, vol: 0.5, max: 1 }, (v2) => {
    tick(v2, 900, 0.04, 0.5);
    return tone(v2, { type: "sine", f: midi(45), dur: 0.4, vol: 0.2 });
  });
  def("round.start", X, (v2) => {
    for (const [n2, d] of [[38, -8], [38, 8], [50, 0]])
      tone(v2, { type: "sawtooth", f: midi(n2) * 0.97, f2: midi(n2), glide: 0.25, dur: 1.9, a: 0.2, vol: 0.12, detune: d, curve: "lin", filter: { type: "lowpass", f: 300, f2: 1600, q: 2 }, verb: 0.5 });
    thud(v2, 70, 35, 0.6, 0.9);
    return rumble(v2, 0.8, 0.5, 600);
  });
  def("players.few", { ...X, prio: 8, vol: 0.55 }, (v2) => {
    metal(v2, { f: midi(40), ratios: [1, 2.01, 2.4, 3, 4.2], dur: 2.4, vol: 0.25, verb: 0.8 });
    return metal(v2, { at: 1.1, f: midi(40), ratios: [1, 2.01, 2.4, 3, 4.2], dur: 2.4, vol: 0.25, verb: 0.8 });
  });
  var G = { cat: "gore", prio: 4, vol: 0.55, pv: 0.12, vv: 0.15, max: 2, verb: 0.1 };
  def("gore.splat", G, (v2) => {
    noise(v2, { color: "pink", dur: 0.12, vol: 0.6, filter: { type: "lowpass", f: 1600, f2: 500 } });
    return tone(v2, { type: "sine", f: 260, f2: 90, dur: 0.07, vol: 0.25 });
  });
  def("gore.squelch", G, (v2) => {
    noise(v2, { color: "pink", dur: 0.22, a: 0.02, vol: 0.6, filter: { type: "bandpass", f: 400, f2: 900, q: 3 } });
    tone(v2, { type: "sine", f: 180, f2: 420, dur: 0.12, vol: 0.2, filter: { type: "lowpass", f: 800 } });
    return tone(v2, { at: 0.08, type: "sine", f: 350, f2: 140, dur: 0.1, vol: 0.15 });
  });
  def("gore.gib", G, (v2) => {
    let e = 0;
    for (let i = 0; i < 4; i++) {
      const at2 = i * (0.06 + v2.r() * 0.07);
      thud(v2, 160 + v2.r() * 80, 60, 0.07, 0.35, at2);
      e = noise(v2, { at: at2, color: "pink", dur: 0.08, vol: 0.35, filter: { type: "lowpass", f: 1200 } });
    }
    return e;
  });
  def("gore.dismember", { ...G, prio: 5 }, (v2) => {
    whoosh(v2, 1400, 3800, 0.1, 0.5, 2);
    noise(v2, { at: 0.05, color: "pink", dur: 0.25, a: 0.02, vol: 0.5, filter: { type: "bandpass", f: 700, f2: 1400, q: 2.5 } });
    crackle(v2, 0.2, 0.4, 0.05, 900);
    return tone(v2, { at: 0.06, type: "sine", f: 220, f2: 80, dur: 0.12, vol: 0.3 });
  });
  def("gore.explode", { ...G, prio: 6, vol: 0.75 }, (v2) => {
    thud(v2, 75, 30, 0.4, 0.9);
    noise(v2, { color: "pink", dur: 0.45, vol: 0.8, filter: { type: "lowpass", f: 2200, f2: 300 } });
    noise(v2, { at: 0.03, color: "pink", dur: 0.3, vol: 0.4, filter: { type: "bandpass", f: 500, q: 2 } });
    let e = 0;
    for (let i = 0; i < 5; i++) e = thud(v2, 140 + v2.r() * 100, 60, 0.06, 0.25, 0.15 + v2.r() * 0.35);
    return Math.max(e, v2.t + 0.5);
  });
  def("gore.bonecrack", G, (v2) => {
    noise(sub2(v2, shaper(v2, true)), { dur: 0.035, vol: 0.6, filter: { type: "bandpass", f: 2200, q: 2 } });
    tick(v2, 1300, 0.03, 0.4, 0.02);
    return thud(v2, 200, 120, 0.05, 0.3);
  });
  var rngState = Math.random() * 2 ** 31 | 0;
  function rng() {
    rngState = rngState + 1831565813 | 0;
    let t4 = rngState;
    t4 = Math.imul(t4 ^ t4 >>> 15, t4 | 1);
    t4 ^= t4 + Math.imul(t4 ^ t4 >>> 7, t4 | 61);
    return ((t4 ^ t4 >>> 14) >>> 0) / 4294967296;
  }
  function play(id, o = {}) {
    const e = engine();
    const recipe = R2[id];
    if (!e || !recipe) return false;
    const m = M2[id];
    const sp = spatial(o.x, o.y);
    if (!sp) return false;
    const busName = m.bus ?? "sfx";
    const prio = (o.prio ?? m.prio ?? 5) - (sp.dist > 700 ? 1 : 0);
    const now4 = e.ctx.currentTime;
    if (!admit(id, busName, prio, now4, m.max ?? 4)) return false;
    const ctx = e.ctx;
    const t4 = now4 + 5e-3 + (o.delay ?? 0);
    const pv = m.pv ?? 0.05;
    const vv = m.vv ?? 0.1;
    const pitch = (o.pitch ?? 1) * (1 + (rng() * 2 - 1) * pv);
    const vol = (m.vol ?? 0.5) * (o.vol ?? 1) * (1 + (rng() * 2 - 1) * vv) * sp.gain;
    if (vol < 3e-3) return false;
    const vin = ctx.createGain();
    vin.gain.value = vol;
    let chain = vin;
    if (sp.lp < 16e3) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = sp.lp;
      chain = chain.connect(lp);
    }
    if (sp.pan) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = sp.pan;
      chain = chain.connect(pan);
    }
    const out = ctx.createGain();
    chain.connect(out);
    const busIn = busName === "ui" ? e.ui : busName === "music" ? e.music : e.sfx;
    out.connect(busIn);
    let verbIn;
    if (busName !== "ui") {
      verbIn = ctx.createGain();
      const send2 = ctx.createGain();
      send2.gain.value = vol * (0.25 + Math.min(1, sp.dist / 900) * 0.6);
      verbIn.connect(send2).connect(busName === "music" ? e.musicVerb : e.sfxVerb);
      if (m.verb) {
        const base = ctx.createGain();
        base.gain.value = m.verb / Math.max(1e-3, vol);
        chain.connect(base).connect(verbIn);
      }
    }
    const v2 = { e, ctx, out: vin, verb: verbIn, t: t4, p: pitch, r: rng };
    let end = t4 + 0.5;
    try {
      end = recipe(v2);
    } catch (err) {
      console.warn("sfx recipe failed", id, err);
    }
    const voice = { id, out, start: now4, end: end + 0.15, prio, bus: busName, nodes: [vin, out, ...verbIn ? [verbIn] : []] };
    track(voice);
    return true;
  }
  var SWING = {
    sword: "swing.sword",
    axe: "swing.axe",
    mace: "swing.mace",
    sceptre: "swing.mace",
    spear: "swing.spear",
    dagger: "swing.dagger",
    claw: "swing.claw",
    quarterstaff: "swing.staff",
    staff: "swing.staff",
    wand: "wand.cast",
    bow: "bow.release",
    crossbow: "crossbow.fire"
  };
  var FAMILY2 = { gnashling: "beast", bog_seer: "caster", cragback: "brute" };
  var sfx = {
    play,
    /** Swing / fire sound id for a weapon kind (unarmed -> dagger-ish whoosh). */
    swingFor(wk) {
      return wk && SWING[wk] || "swing.dagger";
    },
    /** Give a monster type id a voice family (monsters agent: call once per new monster). */
    registerFamily(k, fam) {
      FAMILY2[k] = fam;
    },
    /** Monster type id -> voice family; unknown ids fall back by AI type, then by name. */
    monFamily(k) {
      const f = FAMILY2[k];
      if (f) return f;
      const t4 = MONSTER_BY_ID.get(k);
      if (t4) return t4.ai === "ranged" ? "caster" : t4.ai === "brute" ? "brute" : "beast";
      if (/skel|bone|ghoul|zomb|dead|lich|crypt|grave/.test(k)) return "undead";
      if (/wraith|ghost|spirit|shade|wisp|spectre/.test(k)) return "spirit";
      return "beast";
    },
    /** Every registered id (for the test page and docs). */
    ids() {
      return Object.keys(R2);
    },
    category(id) {
      return M2[id]?.cat ?? "?";
    },
    has(id) {
      return id in R2;
    }
  };

  // src/client/gfx/gore/core.ts
  function goreLevel() {
    return getSettings().graphics.gore ?? "extreme";
  }
  function goreAmount() {
    switch (goreLevel()) {
      case "off":
        return 0;
      case "reduced":
        return 0.3;
      case "full":
        return 0.7;
      default:
        return 1;
    }
  }
  function goreCount(n2) {
    const a = goreAmount();
    if (a <= 0) return 0;
    return particleCount(n2 * a);
  }
  function persistentBlood() {
    return getSettings().graphics.persistentBlood !== false;
  }
  var M_BLOOD = 0;
  var M_ICHOR = 1;
  var M_DUST = 2;
  var M_UNDEAD = 3;
  var M_ECTO = 4;
  var M_CHAR = 5;
  var M_ICE = 6;
  var M_CHAOS = 7;
  var MATS = [
    { drop: ["#5e0606", "#8a0b0b", "#b0130f", "#c9221a"], wet: "#7a0808", dark: "#3a0303", gloss: "rgba(255,140,120,0.32)", glow: false, pools: true },
    { drop: ["#1d3a10", "#2f5a1c", "#4f7f22", "#78a82e"], wet: "#2a4a14", dark: "#0f1f07", gloss: "rgba(200,255,140,0.28)", glow: false, pools: true },
    { drop: ["#4e463d", "#6c6256", "#8f8474", "#b2a691"], wet: "#4a4339", dark: "#2c2721", gloss: "rgba(0,0,0,0)", glow: false, pools: false },
    { drop: ["#24060a", "#3a0a0e", "#4e1414", "#5e2418"], wet: "#2e0609", dark: "#140204", gloss: "rgba(200,120,100,0.18)", glow: false, pools: true },
    { drop: ["#3ab0a0", "#5fe0c8", "#9affe6", "#e0fff8"], wet: "#1e5a52", dark: "#0c2a26", gloss: "rgba(160,255,230,0.35)", glow: true, pools: true },
    { drop: ["#0c0806", "#1a1410", "#2a201a", "#3a2c22"], wet: "#120d0a", dark: "#070504", gloss: "rgba(0,0,0,0)", glow: false, pools: false },
    { drop: ["#6fb6d8", "#9fd8f2", "#d8f4ff", "#ffffff"], wet: "#9cc8dc", dark: "#5a8ca8", gloss: "rgba(255,255,255,0.5)", glow: false, pools: false },
    { drop: ["#101a06", "#2a3a10", "#4a6a12", "#8aaa22"], wet: "#1a2a0a", dark: "#060a02", gloss: "rgba(200,255,90,0.3)", glow: false, pools: true }
  ];
  var rnd = Math.random;
  var rr = (a, b) => a + Math.random() * (b - a);
  var pick = (a) => a[Math.random() * a.length | 0];
  function seeded(seed2) {
    let s = seed2 * 2654435761 >>> 0 || 1;
    return () => {
      s = s + 1831565813 | 0;
      let t4 = s;
      t4 = Math.imul(t4 ^ t4 >>> 15, t4 | 1);
      t4 ^= t4 + Math.imul(t4 ^ t4 >>> 7, t4 | 61);
      return ((t4 ^ t4 >>> 14) >>> 0) / 4294967296;
    };
  }
  var lastPlay = /* @__PURE__ */ new Map();
  function goreSound(id, x2, y2, vol = 1, pitch = 1) {
    if (goreAmount() <= 0) return;
    const now4 = performance.now();
    if (now4 - (lastPlay.get(id) ?? 0) < 35) return;
    lastPlay.set(id, now4);
    try {
      sfx.play(id, { x: x2, y: y2, vol, pitch });
    } catch {
    }
  }

  // src/client/gfx/gore/paint.ts
  function blobPath(g, r, rand, lobes = 11, rough = 0.35, cx = 0, cy = 0) {
    const n2 = lobes;
    const pts = [];
    for (let i = 0; i < n2; i++) {
      const a = i / n2 * Math.PI * 2;
      const k = 1 - rough / 2 + rand() * rough;
      pts.push(cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k);
    }
    g.beginPath();
    const mx = (pts[2 * n2 - 2] + pts[0]) / 2;
    const my = (pts[2 * n2 - 1] + pts[1]) / 2;
    g.moveTo(mx, my);
    for (let i = 0; i < n2; i++) {
      const x2 = pts[2 * i];
      const y2 = pts[2 * i + 1];
      const j = (i + 1) % n2;
      g.quadraticCurveTo(x2, y2, (x2 + pts[2 * j]) / 2, (y2 + pts[2 * j + 1]) / 2);
    }
    g.closePath();
  }
  function tear(g, x2, y2, ang, l, w) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const tx = x2 + c * l;
    const ty = y2 + s * l;
    g.beginPath();
    g.moveTo(x2 - s * w, y2 + c * w);
    g.quadraticCurveTo(x2 + c * l * 0.55 - s * w * 0.7, y2 + s * l * 0.55 + c * w * 0.7, tx, ty);
    g.quadraticCurveTo(x2 + c * l * 0.55 + s * w * 0.7, y2 + s * l * 0.55 - c * w * 0.7, x2 + s * w, y2 - c * w);
    g.arc(x2, y2, w, ang + Math.PI / 2, ang - Math.PI / 2);
    g.fill();
  }
  function paintSplat(g, mat2, r, dx, dy, seed2, power = 0.5, alpha = 1) {
    const m = MATS[mat2];
    const rand = seeded(seed2);
    const dir = Math.atan2(dy, dx);
    const hasDir = dx * dx + dy * dy > 0.01;
    g.globalAlpha = alpha * 0.92;
    g.save();
    g.rotate(dir);
    g.scale(1 + power * 0.6, 1);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.1);
    grad.addColorStop(0, m.dark);
    grad.addColorStop(0.55, m.wet);
    grad.addColorStop(1, m.drop[1]);
    g.fillStyle = grad;
    blobPath(g, r, rand, 9 + (rand() * 5 | 0), 0.55);
    g.fill();
    g.restore();
    g.fillStyle = m.wet;
    const n2 = 4 + Math.round(power * 10 + rand() * 4);
    for (let i = 0; i < n2; i++) {
      const a = hasDir ? dir + (rand() - 0.5) * (1.2 + (1 - power) * 2.4) : rand() * Math.PI * 2;
      const d = r * (0.9 + rand() * (1.4 + power * 2.2));
      const w = r * (0.06 + rand() * 0.16);
      const x2 = Math.cos(a) * d;
      const y2 = Math.sin(a) * d;
      if (rand() < 0.45 + power * 0.3) tear(g, x2 * 0.6, y2 * 0.6, a, d * 0.5 * (0.5 + rand()), w);
      else {
        g.beginPath();
        g.arc(x2, y2, w * 1.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = alpha * 0.55;
    g.fillStyle = m.drop[0];
    const mist = 6 + Math.round(power * 14);
    for (let i = 0; i < mist; i++) {
      const a = hasDir ? dir + (rand() - 0.5) * 2.2 : rand() * Math.PI * 2;
      const d = r * (1.2 + rand() * (2 + power * 3));
      g.beginPath();
      g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.25 + rand() * 0.55, 0, Math.PI * 2);
      g.fill();
    }
    if (m.gloss !== "rgba(0,0,0,0)" && r > 2) {
      g.globalAlpha = alpha * 0.7;
      g.fillStyle = m.gloss;
      g.beginPath();
      g.ellipse(-r * 0.25, -r * 0.3, r * 0.35, r * 0.12, -0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  function paintPool(g, mat2, R8, seed2, k = 1, t4 = 0, alpha = 1) {
    const m = MATS[mat2];
    const r = R8 * (0.15 + 0.85 * Math.sqrt(Math.min(1, k)));
    const rand = seeded(seed2);
    g.globalAlpha = alpha;
    g.fillStyle = m.drop[1];
    blobPath(g, r * 1.04, rand, 13, 0.42);
    g.fill();
    const rand2 = seeded(seed2);
    const grad = g.createRadialGradient(r * 0.1, r * 0.1, 0, 0, 0, r);
    grad.addColorStop(0, m.dark);
    grad.addColorStop(0.75, m.dark);
    grad.addColorStop(1, m.wet);
    g.fillStyle = grad;
    blobPath(g, r * 0.96, rand2, 13, 0.42);
    g.fill();
    const lobes = 2 + (rand() * 3 | 0);
    for (let i = 0; i < lobes; i++) {
      const a = rand() * Math.PI * 2;
      const d = r * (0.7 + rand() * 0.3);
      g.fillStyle = m.wet;
      blobPath(g, r * (0.25 + rand() * 0.2), rand, 8, 0.4, Math.cos(a) * d, Math.sin(a) * d);
      g.fill();
    }
    if (m.gloss !== "rgba(0,0,0,0)") {
      g.globalAlpha = alpha * (0.5 + 0.2 * Math.sin(t4 * 1.3));
      g.strokeStyle = m.gloss;
      g.lineWidth = Math.max(0.6, r * 0.05);
      g.lineCap = "round";
      g.beginPath();
      g.ellipse(-r * 0.15, -r * 0.2, r * 0.55, r * 0.3, -0.7, Math.PI * 1.05, Math.PI * 1.55);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  function paintScorch(g, r, seed2, alpha = 1) {
    const rand = seeded(seed2);
    g.globalAlpha = alpha;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, "rgba(8,6,5,0.95)");
    grad.addColorStop(0.55, "rgba(22,16,12,0.8)");
    grad.addColorStop(0.85, "rgba(60,34,18,0.35)");
    grad.addColorStop(1, "rgba(60,34,18,0)");
    g.fillStyle = grad;
    blobPath(g, r, rand, 12, 0.45);
    g.fill();
    g.fillStyle = "rgba(10,8,6,0.8)";
    for (let i = 0; i < 10; i++) {
      const a = rand() * Math.PI * 2;
      const d = r * (0.8 + rand() * 0.6);
      g.beginPath();
      g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.4 + rand() * 1.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  function paintLichtenberg(g, r, seed2, alpha = 1) {
    const rand = seeded(seed2);
    g.globalAlpha = alpha;
    g.lineCap = "round";
    const branch = (x2, y2, a, len, w, depth) => {
      if (depth > 4 || len < 1.5) return;
      let cx = x2;
      let cy = y2;
      g.lineWidth = w;
      g.strokeStyle = depth < 2 ? "rgba(12,10,14,0.85)" : "rgba(30,24,26,0.6)";
      g.beginPath();
      g.moveTo(cx, cy);
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        a += (rand() - 0.5) * 0.9;
        cx += Math.cos(a) * len / steps;
        cy += Math.sin(a) * len / steps;
        g.lineTo(cx, cy);
        if (rand() < 0.35) branch(cx, cy, a + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.6), len * 0.55, w * 0.6, depth + 1);
      }
      g.stroke();
    };
    const arms = 5 + (rand() * 3 | 0);
    for (let i = 0; i < arms; i++) branch(0, 0, i / arms * Math.PI * 2 + rand() * 0.5, r * (0.6 + rand() * 0.5), 1.2, 0);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.4);
    grad.addColorStop(0, "rgba(6,6,8,0.9)");
    grad.addColorStop(1, "rgba(6,6,8,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  function paintFrost(g, r, seed2, alpha = 1) {
    const rand = seeded(seed2);
    g.globalAlpha = alpha * 0.55;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, "rgba(220,245,255,0.9)");
    grad.addColorStop(0.6, "rgba(150,205,235,0.5)");
    grad.addColorStop(1, "rgba(150,205,235,0)");
    g.fillStyle = grad;
    blobPath(g, r, rand, 10, 0.5);
    g.fill();
    g.globalAlpha = alpha;
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * r * 0.9;
      const s = 0.8 + rand() * 2.2;
      const x2 = Math.cos(a) * d;
      const y2 = Math.sin(a) * d;
      const b = rand() * Math.PI;
      g.fillStyle = rand() < 0.5 ? "#e8f8ff" : "#a8daf2";
      g.beginPath();
      g.moveTo(x2 + Math.cos(b) * s, y2 + Math.sin(b) * s);
      g.lineTo(x2 + Math.cos(b + 2.2) * s * 0.4, y2 + Math.sin(b + 2.2) * s * 0.4);
      g.lineTo(x2 - Math.cos(b) * s, y2 - Math.sin(b) * s);
      g.lineTo(x2 + Math.cos(b - 2.2) * s * 0.4, y2 + Math.sin(b - 2.2) * s * 0.4);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
  }
  function paintEcto(g, r, seed2, alpha = 1) {
    const rand = seeded(seed2);
    g.globalAlpha = alpha * 0.6;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, "rgba(140,255,225,0.55)");
    grad.addColorStop(0.6, "rgba(50,160,140,0.35)");
    grad.addColorStop(1, "rgba(20,80,70,0)");
    g.fillStyle = grad;
    blobPath(g, r, rand, 10, 0.6);
    g.fill();
    g.globalAlpha = 1;
  }

  // src/client/gfx/gore/decals.ts
  var C3 = Math.SQRT1_2;
  var CH = 256;
  var RES = 1.5;
  var MAX_CHUNKS = 64;
  var MAX_QUEUE = 1600;
  var BAKE_BUDGET = 140;
  var SATURATE = 1400;
  var chunks = /* @__PURE__ */ new Map();
  var chunkList = [];
  var ckey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
  var clock = 0;
  var queue = [];
  var qHead = 0;
  function groundTransform(g, sx, sy, scale = 1) {
    g.transform(C3 * K * scale, C3 * K * SQ * scale, -C3 * K * scale, C3 * K * SQ * scale, sx, sy);
  }
  function chunk(cx, cy, create) {
    const k = ckey(cx, cy);
    let c = chunks.get(k);
    if (c) {
      c.used = clock;
      return c;
    }
    if (!create) return null;
    if (chunks.size >= MAX_CHUNKS) {
      let oldK = -1;
      let oldU = Infinity;
      for (const [kk, cc] of chunks) if (cc.used < oldU) oldU = cc.used, oldK = kk;
      const old = chunks.get(oldK);
      chunks.delete(oldK);
      chunkList.splice(chunkList.indexOf(old), 1);
      old.g.setTransform(1, 0, 0, 1, 0, 0);
      old.g.clearRect(0, 0, old.cv.width, old.cv.height);
      c = old;
    } else {
      const cv = document.createElement("canvas");
      cv.width = cv.height = Math.ceil(CH * RES);
      c = { cv, g: cv.getContext("2d"), cx, cy, used: clock, n: 0, fadeT: clock };
    }
    c.cx = cx;
    c.cy = cy;
    c.used = clock;
    c.n = 0;
    c.fadeT = clock;
    chunks.set(k, c);
    chunkList.push(c);
    return c;
  }
  function stamp(x2, y2, r, p) {
    if (goreAmount() <= 0) return;
    if (queue.length - qHead >= MAX_QUEUE) qHead++;
    queue.push({ x: x2, y: y2, r, p });
  }
  function bake(s) {
    const ix = isoX(s.x, s.y);
    const iy = isoY(s.x, s.y);
    const ex = s.r * K * 1.05 + 2;
    const ey = s.r * K * 1.05 + 2;
    const cx0 = Math.floor((ix - ex) / CH);
    const cx1 = Math.floor((ix + ex) / CH);
    const cy0 = Math.floor((iy - ey) / CH);
    const cy1 = Math.floor((iy + ey) / CH);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cy = cy0; cy <= cy1; cy++) {
        const c = chunk(cx, cy, true);
        const g = c.g;
        g.setTransform(RES, 0, 0, RES, 0, 0);
        groundTransform(g, ix - cx * CH, iy - cy * CH);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        s.p(g);
        c.n++;
      }
  }
  var MAX_POOLS = 80;
  var pools = Array.from({ length: MAX_POOLS }, () => ({ on: false, x: 0, y: 0, R: 0, t: 0, grow: 0, mat: 0, seed: 0, hold: 0 }));
  function addPool(x2, y2, R8, mat2, grow = 4, hold = 0) {
    if (goreAmount() <= 0 || !MATS[mat2].pools) return;
    let p = pools.find((q) => !q.on);
    if (!p) {
      p = pools.reduce((a, b) => a.t > b.t ? a : b);
      finishPool(p);
    }
    p.on = true;
    p.x = x2;
    p.y = y2;
    p.R = R8;
    p.t = 0;
    p.grow = grow;
    p.mat = mat2;
    p.seed = Math.random() * 1e9 | 0;
    p.hold = hold;
  }
  function finishPool(p) {
    p.on = false;
    const { R: R8, mat: mat2, seed: seed2 } = p;
    stamp(p.x, p.y, R8 * 1.6, (g) => paintPool(g, mat2, R8, seed2, 1, 0, 0.95));
  }
  function drawBubbles(g, p, time) {
    const r = p.R * 0.7;
    for (let i = 0; i < 7; i++) {
      const ph = (time * (0.6 + i % 3 * 0.25) + i * 0.37) % 1;
      const a = i * 2.39 + p.seed;
      const d = r * (i * 0.618 % 1 * 0.9);
      const bx = Math.cos(a) * d;
      const by = Math.sin(a) * d;
      const br = (0.6 + i % 4 * 0.5) * (ph < 0.85 ? ph / 0.85 : 1);
      g.globalAlpha = ph < 0.85 ? 0.85 : (1 - ph) / 0.15;
      g.fillStyle = "#4a6a12";
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(220,255,140,0.6)";
      g.beginPath();
      g.arc(bx - br * 0.3, by - br * 0.3, br * 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  var fadeIdx = 0;
  function updateDecals(dt) {
    clock += dt;
    let n2 = 0;
    while (qHead < queue.length && n2 < BAKE_BUDGET) {
      bake(queue[qHead++]);
      n2++;
    }
    if (qHead > 512 && qHead * 2 > queue.length) {
      queue.splice(0, qHead);
      qHead = 0;
    }
    for (const p of pools) {
      if (!p.on) continue;
      p.t += dt;
      if (p.t > p.grow + p.hold + 0.4) finishPool(p);
    }
    if (chunkList.length) {
      const c = chunkList[fadeIdx++ % chunkList.length];
      const pers = persistentBlood();
      const every = pers ? 5 : 1.2;
      if (clock - c.fadeT > every) {
        const k = pers ? 0.018 : 0.07;
        const extra = c.n > SATURATE ? 0.12 : 0;
        c.g.setTransform(1, 0, 0, 1, 0, 0);
        c.g.globalCompositeOperation = "destination-out";
        c.g.globalAlpha = 1;
        c.g.fillStyle = `rgba(0,0,0,${k + extra})`;
        c.g.fillRect(0, 0, c.cv.width, c.cv.height);
        c.g.globalCompositeOperation = "source-over";
        if (extra) c.n = Math.floor(c.n * 0.8);
        c.fadeT = clock;
      }
    }
  }
  function drawDecals(g, cam2, time) {
    if (goreAmount() <= 0) return;
    const x0 = Math.floor(-cam2.offX / CH);
    const x1 = Math.floor((-cam2.offX + cam2.ww) / CH);
    const y0 = Math.floor(-cam2.offY / CH);
    const y1 = Math.floor((-cam2.offY + cam2.wh) / CH);
    g.imageSmoothingEnabled = true;
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const c = chunk(cx, cy, false);
        if (c) g.drawImage(c.cv, cam2.offX + cx * CH, cam2.offY + cy * CH, CH, CH);
      }
    for (const p of pools) {
      if (!p.on) continue;
      const sx = cam2.offX + isoX(p.x, p.y);
      const sy = cam2.offY + isoY(p.x, p.y);
      if (sx < -p.R * 3 || sy < -p.R * 3 || sx > cam2.ww + p.R * 3 || sy > cam2.wh + p.R * 3) continue;
      g.save();
      groundTransform(g, sx, sy);
      paintPool(g, p.mat, p.R, p.seed, p.t / p.grow, time, 0.95);
      if (p.mat === 7) drawBubbles(g, p, time);
      g.restore();
    }
  }
  function clearDecals() {
    for (const c of chunks.values()) {
      c.g.setTransform(1, 0, 0, 1, 0, 0);
      c.g.clearRect(0, 0, c.cv.width, c.cv.height);
    }
    chunks.clear();
    chunkList.length = 0;
    queue.length = 0;
    qHead = 0;
    for (const p of pools) p.on = false;
  }

  // src/client/gfx/gore/particles.ts
  var P_DROP = 0;
  var P_MIST = 1;
  var P_EMBER = 2;
  var P_SMOKE = 3;
  var P_SPARK = 4;
  var P_SHARD = 5;
  var P_WISP = 6;
  var P_SHIMMER = 7;
  var P_CLOT = 8;
  var MAX = 3200;
  var x = new Float32Array(MAX);
  var y = new Float32Array(MAX);
  var z = new Float32Array(MAX);
  var vx = new Float32Array(MAX);
  var vy = new Float32Array(MAX);
  var vz = new Float32Array(MAX);
  var t = new Float32Array(MAX);
  var life = new Float32Array(MAX);
  var size = new Float32Array(MAX);
  var seed = new Float32Array(MAX);
  var kind = new Uint8Array(MAX);
  var mat = new Uint8Array(MAX);
  var col2 = new Uint8Array(MAX);
  var n = 0;
  var C4 = Math.SQRT1_2;
  var ZK = 0.62;
  var GRAV = 620;
  function spawnP(k, m, px, py, pz, pvx, pvy, pvz, lf, s) {
    let i = n;
    if (n >= MAX) i = Math.random() * MAX | 0;
    else n++;
    x[i] = px;
    y[i] = py;
    z[i] = pz;
    vx[i] = pvx;
    vy[i] = pvy;
    vz[i] = pvz;
    t[i] = 0;
    life[i] = lf;
    size[i] = s;
    kind[i] = k;
    mat[i] = m;
    col2[i] = Math.random() * 4 | 0;
    seed[i] = Math.random() * 1e6;
  }
  function kill(i) {
    n--;
    if (i === n) return;
    x[i] = x[n];
    y[i] = y[n];
    z[i] = z[n];
    vx[i] = vx[n];
    vy[i] = vy[n];
    vz[i] = vz[n];
    t[i] = t[n];
    life[i] = life[n];
    size[i] = size[n];
    kind[i] = kind[n];
    mat[i] = mat[n];
    col2[i] = col2[n];
    seed[i] = seed[n];
  }
  var landBudget = 0;
  function land(i) {
    if (landBudget <= 0) return;
    landBudget--;
    const m = mat[i];
    const s = size[i];
    const r = kind[i] === P_CLOT ? s * 1.6 : s * (0.9 + Math.random() * 0.8);
    const dx = vx[i];
    const dy = vy[i];
    const sp = Math.hypot(dx, dy);
    const pw = Math.min(1, sp / 260);
    const sd = seed[i] | 0;
    const px = x[i];
    const py = y[i];
    if (m === M_DUST) return;
    stamp(px, py, r * 4, (g) => paintSplat(g, m, r, dx, dy, sd, pw, persistentBlood() ? 0.95 : 0.8));
  }
  function stepParticles(dt) {
    landBudget = 220;
    for (let i = n - 1; i >= 0; i--) {
      t[i] += dt;
      const k = kind[i];
      if (t[i] >= life[i]) {
        if (k === P_SHARD && mat[i] !== M_DUST) {
          const m = mat[i];
          const sd = seed[i] | 0;
          const s = size[i];
          const a = seed[i];
          stamp(x[i], y[i], s * 2, (g) => {
            g.rotate(a);
            g.fillStyle = m === M_ICE ? "#cfeefc" : "#d8d0c0";
            g.beginPath();
            g.moveTo(-s, 0);
            g.lineTo(0, -s * 0.35);
            g.lineTo(s, 0);
            g.lineTo(0, s * 0.3);
            g.fill();
          });
        }
        kill(i);
        continue;
      }
      switch (k) {
        case P_DROP:
        case P_CLOT: {
          vz[i] -= GRAV * dt * (k === P_CLOT ? 1.1 : 1);
          x[i] += vx[i] * dt;
          y[i] += vy[i] * dt;
          z[i] += vz[i] * dt;
          const drag = 1 - 0.6 * dt;
          vx[i] *= drag;
          vy[i] *= drag;
          if (z[i] <= 0) {
            land(i);
            kill(i);
          }
          break;
        }
        case P_SHARD: {
          vz[i] -= GRAV * dt;
          x[i] += vx[i] * dt;
          y[i] += vy[i] * dt;
          z[i] += vz[i] * dt;
          if (z[i] <= 0) {
            z[i] = 0;
            vz[i] = Math.abs(vz[i]) > 40 ? -vz[i] * 0.3 : 0;
            vx[i] *= 0.45;
            vy[i] *= 0.45;
          }
          break;
        }
        case P_MIST: {
          x[i] += vx[i] * dt;
          y[i] += vy[i] * dt;
          z[i] += vz[i] * dt;
          vx[i] *= 1 - 3 * dt;
          vy[i] *= 1 - 3 * dt;
          vz[i] -= 40 * dt;
          break;
        }
        case P_SMOKE:
        case P_WISP: {
          x[i] += (vx[i] + Math.sin(t[i] * 3 + seed[i]) * (k === P_WISP ? 14 : 6)) * dt;
          y[i] += vy[i] * dt;
          z[i] += vz[i] * dt;
          break;
        }
        case P_EMBER: {
          x[i] += (vx[i] + Math.sin(t[i] * 7 + seed[i]) * 10) * dt;
          y[i] += vy[i] * dt;
          z[i] += vz[i] * dt;
          vz[i] += 20 * dt;
          break;
        }
        default: {
          x[i] += vx[i] * dt;
          y[i] += vy[i] * dt;
          z[i] += vz[i] * dt;
        }
      }
    }
  }
  function drawParticles(g, cam2, glowPass) {
    if (!n) return;
    const ox = cam2.offX;
    const oy = cam2.offY;
    const W3 = cam2.ww + 40;
    const H3 = cam2.wh + 60;
    g.lineCap = "round";
    if (glowPass) g.globalCompositeOperation = "lighter";
    let lastStyle = "";
    for (let i = 0; i < n; i++) {
      const k = kind[i];
      const m = mat[i];
      const glow4 = k === P_EMBER || k === P_SPARK || k === P_WISP || k === P_SHIMMER || MATS[m].glow;
      if (glow4 !== glowPass) continue;
      const px = x[i];
      const py = y[i];
      const sx = ox + isoX(px, py);
      const sy = oy + isoY(px, py) - z[i] * ZK;
      if (sx < -40 || sy < -40 || sx > W3 || sy > H3) continue;
      const f = t[i] / life[i];
      const s = size[i];
      switch (k) {
        case P_DROP:
        case P_CLOT: {
          const svx = (vx[i] - vy[i]) * C4 * K;
          const svy = (vx[i] + vy[i]) * C4 * K * SQ - vz[i] * ZK;
          const st = k === P_CLOT ? 0.012 : 0.022;
          const c = MATS[m].drop[col2[i]];
          if (c !== lastStyle) {
            g.strokeStyle = c;
            lastStyle = c;
          }
          g.globalAlpha = 1;
          g.lineWidth = s * (k === P_CLOT ? 1.4 : 0.9);
          g.beginPath();
          g.moveTo(sx - svx * st, sy - svy * st);
          g.lineTo(sx, sy);
          g.stroke();
          break;
        }
        case P_MIST: {
          const r = s * (1 + f * 2.5);
          g.globalAlpha = (1 - f) * 0.45;
          g.fillStyle = MATS[m].drop[1];
          lastStyle = "";
          g.beginPath();
          g.arc(sx, sy, r, 0, Math.PI * 2);
          g.fill();
          break;
        }
        case P_SMOKE: {
          const r = s * (1 + f * 3);
          g.globalAlpha = Math.min(1, f * 6) * (1 - f) * 0.4;
          g.fillStyle = f < 0.3 ? "#2a2420" : "#4a4440";
          lastStyle = "";
          g.beginPath();
          g.arc(sx, sy, r, 0, Math.PI * 2);
          g.fill();
          break;
        }
        case P_SHARD: {
          g.globalAlpha = Math.min(1, (1 - f) * 4);
          const c = MATS[m].drop[col2[i]];
          g.fillStyle = m === M_ICE ? col2[i] & 1 ? "#e8f8ff" : "#9fd8f2" : m === M_DUST ? c : "#e6dccb";
          lastStyle = "";
          const a = seed[i] + t[i] * (z[i] > 0 ? 14 : 0);
          const ca = Math.cos(a) * s;
          const sa = Math.sin(a) * s * 0.7;
          g.beginPath();
          g.moveTo(sx + ca, sy + sa);
          g.lineTo(sx - sa * 0.5, sy + ca * 0.3);
          g.lineTo(sx - ca, sy - sa);
          g.lineTo(sx + sa * 0.4, sy - ca * 0.3);
          g.closePath();
          g.fill();
          break;
        }
        case P_EMBER: {
          g.globalAlpha = (1 - f) * (0.6 + 0.4 * Math.sin(t[i] * 20 + seed[i]));
          g.fillStyle = f < 0.4 ? "#ffd27a" : "#ff6a1a";
          lastStyle = "";
          g.beginPath();
          g.arc(sx, sy, s * (1 - f * 0.5), 0, Math.PI * 2);
          g.fill();
          break;
        }
        case P_SPARK: {
          g.globalAlpha = 1 - f;
          g.strokeStyle = f < 0.5 ? "#f2f6ff" : "#8ab8ff";
          lastStyle = "";
          g.lineWidth = s * 0.6;
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(sx - vx[i] * 0.02, sy - vy[i] * 0.02 + vz[i] * 0.01);
          g.stroke();
          break;
        }
        case P_WISP: {
          const r = s * (1 + f * 1.5);
          const grd = g.createRadialGradient(sx, sy, 0, sx, sy, r);
          grd.addColorStop(0, "rgba(200,255,240,0.8)");
          grd.addColorStop(0.5, "rgba(90,230,200,0.35)");
          grd.addColorStop(1, "rgba(40,160,140,0)");
          g.globalAlpha = Math.min(1, f * 5) * (1 - f);
          g.fillStyle = grd;
          lastStyle = "";
          g.beginPath();
          g.arc(sx, sy, r, 0, Math.PI * 2);
          g.fill();
          break;
        }
        case P_SHIMMER: {
          g.globalAlpha = (1 - f) * 0.9;
          g.strokeStyle = "#9fd0ff";
          lastStyle = "";
          g.lineWidth = 0.7;
          const r = s * (0.6 + f);
          g.beginPath();
          for (let h = 0; h < 6; h++) {
            const a = h / 6 * Math.PI * 2 + seed[i];
            const hx = sx + Math.cos(a) * r;
            const hy = sy + Math.sin(a) * r * 0.8;
            if (h === 0) g.moveTo(hx, hy);
            else g.lineTo(hx, hy);
          }
          g.closePath();
          g.stroke();
          break;
        }
        default: {
          g.globalAlpha = 1 - f * 0.5;
          g.fillStyle = MATS[m].drop[col2[i]];
          lastStyle = "";
          g.beginPath();
          g.arc(sx, sy, s * 0.8, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  function clearParticles() {
    n = 0;
  }

  // src/shared/content/loot.ts
  var RARITY_COLORS = ["#e8e8e8", "#8a9cff", "#ffe066", "#d8873a"];

  // src/shared/content/affixes.ts
  var AFFIXES = [
    // ---- Prefixes ----
    {
      id: "life",
      kind: "prefix",
      key: "life",
      weight: 10,
      classes: ["offhand", "helmet", "body", "gloves", "boots", "amulet", "ring", "belt"],
      tiers: [
        { ilvl: 1, min: 8, max: 14, name: "Thick-Hided" },
        { ilvl: 7, min: 15, max: 24, name: "Ox-Blooded" },
        { ilvl: 14, min: 25, max: 36, name: "Mountainheart" }
      ]
    },
    {
      id: "move",
      kind: "prefix",
      key: "moveInc",
      weight: 8,
      classes: ["boots"],
      tiers: [
        { ilvl: 1, min: 4, max: 7, name: "Scurrying" },
        { ilvl: 8, min: 8, max: 11, name: "Hare-Footed" },
        { ilvl: 15, min: 12, max: 16, name: "Windswept" }
      ]
    },
    {
      id: "dmg_flat",
      kind: "prefix",
      key: "dmgFlat",
      weight: 9,
      classes: ["weapon", "gloves", "ring", "amulet"],
      tiers: [
        { ilvl: 1, min: 2, max: 4, name: "Barbed" },
        { ilvl: 7, min: 5, max: 8, name: "Hooked" },
        { ilvl: 14, min: 9, max: 13, name: "Flensing" }
      ]
    },
    {
      id: "dmg_inc",
      kind: "prefix",
      key: "dmgInc",
      weight: 8,
      classes: ["weapon"],
      tiers: [
        { ilvl: 1, min: 10, max: 19, name: "Grim" },
        { ilvl: 8, min: 20, max: 34, name: "Baleful" },
        { ilvl: 15, min: 35, max: 50, name: "Ruinous" }
      ]
    },
    // ---- Suffixes ----
    {
      id: "atk_speed",
      kind: "suffix",
      key: "atkSpeedInc",
      weight: 8,
      classes: ["weapon", "gloves", "ring"],
      tiers: [
        { ilvl: 1, min: 4, max: 7, name: "of Twitching" },
        { ilvl: 8, min: 8, max: 12, name: "of Flurries" },
        { ilvl: 15, min: 13, max: 18, name: "of the Squall" }
      ]
    },
    {
      id: "reach",
      kind: "suffix",
      key: "reach",
      weight: 6,
      classes: ["weapon"],
      tiers: [
        { ilvl: 1, min: 6, max: 10, name: "of Long Arms" },
        { ilvl: 9, min: 11, max: 16, name: "of the Heron" },
        { ilvl: 16, min: 17, max: 24, name: "of Far Grasp" }
      ]
    },
    {
      id: "knockback",
      kind: "suffix",
      key: "kbInc",
      weight: 6,
      classes: ["weapon", "gloves", "offhand"],
      tiers: [
        { ilvl: 1, min: 15, max: 30, name: "of Shoving" },
        { ilvl: 10, min: 31, max: 55, name: "of the Battering Ram" }
      ]
    },
    {
      id: "dodge_cd",
      kind: "suffix",
      key: "dodgeCdRed",
      weight: 7,
      classes: ["boots", "belt", "amulet"],
      tiers: [
        { ilvl: 1, min: 5, max: 9, name: "of Tumbling" },
        { ilvl: 9, min: 10, max: 15, name: "of the Eel" },
        { ilvl: 16, min: 16, max: 22, name: "of the Weasel" }
      ]
    },
    {
      id: "regen",
      kind: "suffix",
      key: "regen",
      weight: 8,
      decimals: 1,
      classes: ["helmet", "body", "amulet", "ring", "belt"],
      tiers: [
        { ilvl: 1, min: 0.8, max: 1.6, name: "of Mending" },
        { ilvl: 8, min: 1.7, max: 3, name: "of Moss" },
        { ilvl: 15, min: 3.1, max: 5, name: "of the Old Oak" }
      ]
    },
    {
      id: "flask_gain",
      kind: "suffix",
      key: "flaskGainInc",
      weight: 6,
      classes: ["belt", "amulet"],
      tiers: [
        { ilvl: 1, min: 10, max: 20, name: "of Brimming" },
        { ilvl: 10, min: 21, max: 40, name: "of the Deep Well" }
      ]
    },
    {
      id: "flask_rec",
      kind: "suffix",
      key: "flaskRecInc",
      weight: 6,
      classes: ["belt", "ring", "amulet"],
      tiers: [
        { ilvl: 1, min: 10, max: 20, name: "of Sipping" },
        { ilvl: 10, min: 21, max: 40, name: "of Gulping" }
      ]
    },
    // ---- Mana / spells (skills) ----
    {
      id: "mana",
      kind: "prefix",
      key: "mana",
      weight: 8,
      classes: ["helmet", "body", "amulet", "ring", "offhand", "gloves"],
      tiers: [
        { ilvl: 1, min: 10, max: 18, name: "Lucid" },
        { ilvl: 7, min: 19, max: 30, name: "Brimming-Minded" },
        { ilvl: 14, min: 31, max: 45, name: "Wellspring" }
      ]
    },
    {
      id: "mana_regen",
      kind: "suffix",
      key: "manaRegen",
      weight: 7,
      decimals: 1,
      classes: ["ring", "amulet", "helmet", "offhand", "weapon"],
      tiers: [
        { ilvl: 1, min: 0.8, max: 1.6, name: "of Trickling Thought" },
        { ilvl: 8, min: 1.7, max: 2.8, name: "of the Spring" },
        { ilvl: 15, min: 2.9, max: 4.2, name: "of the Undertow" }
      ]
    },
    {
      id: "spell_inc",
      kind: "prefix",
      key: "spellInc",
      weight: 6,
      classes: ["weapon", "offhand", "amulet"],
      tiers: [
        { ilvl: 1, min: 10, max: 19, name: "Whispering" },
        { ilvl: 8, min: 20, max: 34, name: "Incanting" },
        { ilvl: 15, min: 35, max: 50, name: "Thundervoiced" }
      ]
    },
    {
      id: "spirit",
      kind: "prefix",
      key: "spirit",
      weight: 5,
      classes: ["body", "amulet", "offhand"],
      tiers: [
        { ilvl: 1, min: 12, max: 20, name: "Kindred" },
        { ilvl: 8, min: 21, max: 32, name: "Soulbound" },
        { ilvl: 15, min: 33, max: 45, name: "Hallowed" }
      ]
    }
  ];
  var ARMOUR_SLOTS = ["helmet", "body", "gloves", "boots", "offhand"];
  var RES_SLOTS = ["helmet", "body", "gloves", "boots", "offhand", "amulet", "ring", "belt"];
  AFFIXES.push(
    { id: "def_armour", kind: "prefix", key: "armour", weight: 7, classes: ARMOUR_SLOTS, tiers: [
      { ilvl: 1, min: 8, max: 20, name: "Riveted" },
      { ilvl: 8, min: 21, max: 45, name: "Bulwarked" },
      { ilvl: 15, min: 46, max: 80, name: "Ironclad" }
    ] },
    { id: "def_armour_inc", kind: "prefix", key: "armourInc", weight: 5, classes: ARMOUR_SLOTS, tiers: [
      { ilvl: 1, min: 15, max: 30, name: "Hardened" },
      { ilvl: 10, min: 31, max: 60, name: "Tempered" },
      { ilvl: 16, min: 61, max: 90, name: "Unbreaking" }
    ] },
    { id: "def_evasion", kind: "prefix", key: "evasion", weight: 7, classes: ARMOUR_SLOTS, tiers: [
      { ilvl: 1, min: 10, max: 25, name: "Lithe" },
      { ilvl: 8, min: 26, max: 55, name: "Wraithlike" },
      { ilvl: 15, min: 56, max: 100, name: "Smokeborn" }
    ] },
    { id: "def_evasion_inc", kind: "prefix", key: "evasionInc", weight: 5, classes: ARMOUR_SLOTS, tiers: [
      { ilvl: 1, min: 15, max: 30, name: "Shifting" },
      { ilvl: 10, min: 31, max: 60, name: "Elusive" },
      { ilvl: 16, min: 61, max: 90, name: "Phantasmal" }
    ] },
    { id: "def_es", kind: "prefix", key: "es", weight: 7, classes: [...ARMOUR_SLOTS, "amulet", "ring", "belt"], tiers: [
      { ilvl: 1, min: 5, max: 10, name: "Glinting" },
      { ilvl: 8, min: 11, max: 20, name: "Haloed" },
      { ilvl: 15, min: 21, max: 34, name: "Starwoven" }
    ] },
    { id: "def_es_inc", kind: "prefix", key: "esInc", weight: 5, classes: ARMOUR_SLOTS, tiers: [
      { ilvl: 1, min: 15, max: 30, name: "Shimmering" },
      { ilvl: 10, min: 31, max: 60, name: "Lambent" },
      { ilvl: 16, min: 61, max: 90, name: "Auroral" }
    ] },
    { id: "def_es_start", kind: "suffix", key: "esStart", weight: 4, classes: ["body", "helmet", "amulet"], tiers: [
      { ilvl: 5, min: 15, max: 30, name: "of Quick Wards" },
      { ilvl: 14, min: 31, max: 50, name: "of the Ready Veil" }
    ] },
    { id: "def_block", kind: "suffix", key: "block", weight: 5, classes: ["offhand"], tiers: [
      { ilvl: 1, min: 3, max: 5, name: "of the Parry" },
      { ilvl: 10, min: 6, max: 9, name: "of the Rampart" }
    ] },
    { id: "def_res_fire", kind: "suffix", key: "resFire", weight: 8, classes: RES_SLOTS, tiers: [
      { ilvl: 1, min: 6, max: 12, name: "of the Hearth" },
      { ilvl: 8, min: 13, max: 22, name: "of Cinderproof" },
      { ilvl: 15, min: 23, max: 32, name: "of the Kiln" }
    ] },
    { id: "def_res_cold", kind: "suffix", key: "resCold", weight: 8, classes: RES_SLOTS, tiers: [
      { ilvl: 1, min: 6, max: 12, name: "of the Fur" },
      { ilvl: 8, min: 13, max: 22, name: "of Rimeproof" },
      { ilvl: 15, min: 23, max: 32, name: "of the Glacier" }
    ] },
    { id: "def_res_light", kind: "suffix", key: "resLight", weight: 8, classes: RES_SLOTS, tiers: [
      { ilvl: 1, min: 6, max: 12, name: "of Grounding" },
      { ilvl: 8, min: 13, max: 22, name: "of the Lodestone" },
      { ilvl: 15, min: 23, max: 32, name: "of the Stormwall" }
    ] },
    { id: "def_res_chaos", kind: "suffix", key: "resChaos", weight: 4, classes: RES_SLOTS, tiers: [
      { ilvl: 4, min: 5, max: 10, name: "of Clean Blood" },
      { ilvl: 12, min: 11, max: 19, name: "of the Antidote" }
    ] },
    { id: "def_res_all", kind: "suffix", key: "resAll", weight: 3, classes: ["amulet", "ring", "offhand"], tiers: [
      { ilvl: 3, min: 3, max: 6, name: "of the Prism" },
      { ilvl: 12, min: 7, max: 12, name: "of the Spectrum" }
    ] },
    { id: "def_accuracy", kind: "suffix", key: "accuracy", weight: 6, classes: ["weapon", "gloves", "helmet", "ring", "amulet"], tiers: [
      { ilvl: 1, min: 20, max: 50, name: "of Steady Aim" },
      { ilvl: 8, min: 51, max: 110, name: "of the Hawk" },
      { ilvl: 15, min: 111, max: 180, name: "of the Unblinking" }
    ] },
    { id: "def_ail_thr", kind: "suffix", key: "ailThr", weight: 4, classes: ["body", "boots", "belt"], tiers: [
      { ilvl: 3, min: 10, max: 20, name: "of Steadiness" },
      { ilvl: 12, min: 21, max: 35, name: "of the Unflinching" }
    ] },
    { id: "def_stun_thr", kind: "suffix", key: "stunThr", weight: 4, classes: ["body", "boots", "belt", "offhand"], tiers: [
      { ilvl: 3, min: 10, max: 20, name: "of Footing" },
      { ilvl: 12, min: 21, max: 35, name: "of the Anchor" }
    ] }
  );
  var AFFIX_BY_ID = new Map(AFFIXES.map((a) => [a.id, a]));

  // src/shared/content/flasks.ts
  var FLASK_BASES = [
    { id: "tin_draught", name: "Tin Draught", reqIlvl: 1, weight: 10, maxCharges: 30, chargesPerUse: 10, heal: 45, duration: 2 },
    { id: "copper_draught", name: "Copper Draught", reqIlvl: 8, weight: 6, maxCharges: 36, chargesPerUse: 12, heal: 70, duration: 2.2 },
    // Life ladder continued (loot agent): bigger recovery deeper in the match.
    { id: "pewter_draught", name: "Pewter Draught", reqIlvl: 4, weight: 8, maxCharges: 32, chargesPerUse: 10, heal: 56, duration: 2.1 },
    { id: "bronze_draught", name: "Bronze Draught", reqIlvl: 12, weight: 5, maxCharges: 40, chargesPerUse: 12, heal: 95, duration: 2.4 },
    { id: "silvered_draught", name: "Silvered Draught", reqIlvl: 16, weight: 4, maxCharges: 45, chargesPerUse: 13, heal: 125, duration: 2.5 },
    // Mana flasks: restore mana for skills.
    { id: "inkwell_phial", name: "Inkwell Phial", res: "mana", reqIlvl: 1, weight: 7, maxCharges: 30, chargesPerUse: 10, heal: 35, duration: 1.8 },
    { id: "cobalt_phial", name: "Cobalt Phial", res: "mana", reqIlvl: 6, weight: 6, maxCharges: 34, chargesPerUse: 10, heal: 55, duration: 2 },
    { id: "azure_phial", name: "Azure Phial", res: "mana", reqIlvl: 11, weight: 5, maxCharges: 38, chargesPerUse: 11, heal: 80, duration: 2.2 },
    { id: "starwater_phial", name: "Starwater Phial", res: "mana", reqIlvl: 16, weight: 4, maxCharges: 42, chargesPerUse: 12, heal: 105, duration: 2.4 }
  ];
  var FLASK_BASE_BY_ID = new Map(FLASK_BASES.map((f) => [f.id, f]));
  var FLASK_AFFIXES = [
    { id: "f_potent", kind: "prefix", key: "fRecInc", name: "Potent", min: 20, max: 40, weight: 10 },
    { id: "f_snapcork", kind: "prefix", key: "fInstant", name: "Snapcork", min: 1, max: 1, weight: 5 },
    { id: "f_spring", kind: "suffix", key: "fMaxCharges", name: "of the Spring", min: 8, max: 15, weight: 10 },
    { id: "f_thirst", kind: "suffix", key: "fGainInc", name: "of Thirst", min: 20, max: 40, weight: 10 },
    { id: "f_frugal", kind: "suffix", key: "fChargesRed", name: "of Thrift", min: 15, max: 25, weight: 8 }
  ];
  var FLASK_AFFIX_BY_ID = new Map(FLASK_AFFIXES.map((a) => [a.id, a]));

  // src/shared/content/types.ts
  var SLOTS = ["mainhand", "offhand", "helmet", "body", "gloves", "boots", "amulet", "ring1", "ring2", "belt"];

  // src/shared/grid.ts
  var KINDS = [];
  function registerItemKind(def2) {
    const i = KINDS.findIndex((k) => k.category === def2.category);
    if (i >= 0) KINDS[i] = def2;
    else KINDS.push(def2);
  }
  function kindDefOf(item) {
    return KINDS.find((k) => k.matches(item));
  }
  function itemCategory(item) {
    if (FLASK_BASE_BY_ID.has(item.b)) return "flask";
    if (BASE_BY_ID.has(item.b)) return "gear";
    return kindDefOf(item)?.category ?? "other";
  }

  // src/shared/content/runes.ts
  var RUNES = [
    { id: "rune_rootbound", name: "Rootbound Rune", weapon: ["dmgFlat", 3], armour: ["life", 15], weight: 10, minIlvl: 1 },
    { id: "rune_quickwater", name: "Quickwater Rune", weapon: ["atkSpeedInc", 5], armour: ["moveInc", 3], weight: 8, minIlvl: 1 },
    { id: "rune_hearthstone", name: "Hearthstone Rune", weapon: ["leech", 1.5], armour: ["regen", 1], weight: 8, minIlvl: 1 },
    { id: "rune_stillmind", name: "Stillmind Rune", weapon: ["spellInc", 12], armour: ["mana", 15], weight: 8, minIlvl: 1 },
    { id: "rune_gale", name: "Gale Rune", weapon: ["reach", 8], armour: ["dodgeCdRed", 6], weight: 7, minIlvl: 1 },
    { id: "rune_bramble", name: "Bramble Rune", weapon: ["kbInc", 25], armour: ["thorns", 3], weight: 7, minIlvl: 1 },
    { id: "rune_hoarfrost", name: "Hoarfrost Rune", weapon: ["chillOnHit", 10], armour: ["dmgTakenRed", 3], weight: 6, minIlvl: 4 },
    { id: "rune_brimstone", name: "Brimstone Rune", weapon: ["dmgInc", 12], armour: ["flaskRecInc", 12], weight: 6, minIlvl: 4 },
    // Stronger "core" stones, deeper in the match.
    { id: "rune_kingsblood", name: "Kingsblood Rune", weapon: ["dmgInc", 22], armour: ["life", 30], weight: 3, minIlvl: 10 },
    { id: "rune_duskglass", name: "Duskglass Rune", weapon: ["pvpMore", 8], armour: ["dmgTakenRed", 6], weight: 2, minIlvl: 13 }
  ];
  var RUNE_BY_ID = new Map(RUNES.map((r) => [r.id, r]));
  var ARMOUR = ["helmet", "body", "gloves", "boots", "offhand"];
  function runeModFor(rune, cls) {
    if (cls === "weapon") return rune.weapon;
    if (cls && ARMOUR.includes(cls)) return rune.armour;
    return null;
  }
  registerItemKind({ category: "rune", matches: (it) => RUNE_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });

  // src/shared/content/charms.ts
  var CHARMS = [
    { id: "chm_thawstone", name: "Thawstone Charm", trigger: "slowed", buff: [["slowImmune", 1]], duration: 3, cost: 20, maxCharges: 40, weight: 10, minIlvl: 1, desc: "Unaffected by Slows" },
    { id: "chm_anchor", name: "Anchorweight Charm", trigger: "heavyHit", buff: [["kbImmune", 1]], duration: 3, cost: 20, maxCharges: 40, weight: 10, minIlvl: 1, desc: "Cannot be Knocked Back" },
    { id: "chm_lastbreath", name: "Last-Breath Charm", trigger: "lowLife", buff: [["dmgTakenRed", 25]], duration: 3, cost: 40, maxCharges: 40, weight: 7, minIlvl: 1, desc: "25% less Damage taken" },
    { id: "chm_harefoot", name: "Harefoot Charm", trigger: "lowLife", buff: [["hasteBuff", 30]], duration: 3, cost: 30, maxCharges: 60, weight: 8, minIlvl: 1, desc: "30% increased Movement Speed" },
    { id: "chm_bristle", name: "Bristleback Charm", trigger: "playerHit", buff: [["thorns", 8]], duration: 4, cost: 20, maxCharges: 40, weight: 8, minIlvl: 1, desc: "Reflects 8 Damage to melee attackers" },
    { id: "chm_mender", name: "Mender's Knot Charm", trigger: "heavyHit", buff: [["regenBuff", 8]], duration: 3, cost: 30, maxCharges: 60, weight: 7, minIlvl: 4, desc: "Regenerate 8 Life per second" },
    { id: "chm_gildtooth", name: "Gilded Tooth Charm", trigger: "eliteKill", buff: [], heal: 20, duration: 0, cost: 40, maxCharges: 80, weight: 4, minIlvl: 6, desc: "Recover 20% of maximum Life and the elite drops an extra Ember" }
  ];
  var CHARM_BY_ID = new Map(CHARMS.map((c) => [c.id, c]));
  var CHARM_AFFIXES = [
    { id: "c_lasting", kind: "prefix", key: "cDuration", name: "Lingering", min: 20, max: 40, weight: 10 },
    { id: "c_frugal", kind: "prefix", key: "cCostRed", name: "Frugal", min: 15, max: 30, weight: 8 },
    { id: "c_hungry", kind: "suffix", key: "cGain", name: "of Hunger", min: 20, max: 40, weight: 10 }
  ];
  var CHARM_AFFIX_BY_ID = new Map(CHARM_AFFIXES.map((a) => [a.id, a]));
  var CHARM_MOD_LABELS = {
    cDuration: "{v}% increased Charm Duration",
    cCostRed: "{v}% reduced Charges used",
    cGain: "{v}% increased Charges gained"
  };
  var charmSlotBonus = () => 0;
  function setCharmSlotBonus(fn) {
    charmSlotBonus = fn;
  }
  registerItemKind({ category: "charm", matches: (it) => CHARM_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });

  // src/shared/content/fx.ts
  var FX_LABELS = {
    leech: "{v}% of Attack Damage dealt is regained as Life",
    thorns: "Reflects {v} Damage to players who strike you in melee",
    dmgTakenRed: "{v}% less Damage taken",
    takenMore: "{v}% more Damage taken",
    lowLifeMore: "{v}% more Damage while on Low Life",
    executeMore: "{v}% more Damage against enemies on Low Life",
    fullLifeMore: "{v}% more Damage against enemies at full Life",
    killHeal: "Recover {v}% of maximum Life on Kill",
    killHaste: "{v}% increased Movement Speed for 4s after a Kill",
    dodgeMore: "{v}% more Attack Damage for 2s after a Dodge Roll",
    chillOnHit: "Your Hits slow players by {v}% for 1.5s",
    kbImmune: "Cannot be Knocked Back",
    slowImmune: "Unaffected by Slows",
    pvpMore: "{v}% more Damage against players",
    pveMore: "{v}% more Damage against monsters",
    charmSlots: "+{v} Charm Slot",
    charmGain: "{v}% increased Charm Charges gained",
    hasteBuff: "{v}% increased Movement Speed",
    regenBuff: "Regenerate {v} Life per second"
  };
  var FX_KEYS = Object.keys(FX_LABELS);
  var isFxKey = (k) => k in FX_LABELS;

  // src/shared/content/jewels.ts
  var JEWEL_BASES = [
    { id: "jwl_bloodgarnet", name: "Bloodgarnet Jewel", leaning: ["life", "dmgInc", "dmgFlat", "leech"], weight: 10, minIlvl: 1, color: "#c8323c" },
    { id: "jwl_mossglass", name: "Mossglass Jewel", leaning: ["moveInc", "atkSpeedInc", "dodgeCdRed", "killHaste"], weight: 10, minIlvl: 1, color: "#46b46a" },
    { id: "jwl_starsilt", name: "Starsilt Jewel", leaning: ["mana", "manaRegen", "spellInc", "charmGain"], weight: 10, minIlvl: 1, color: "#4a78e0" }
  ];
  var JEWEL_BASE_BY_ID = new Map(JEWEL_BASES.map((b) => [b.id, b]));
  var t2 = (ilvl, min, max, name) => ({ ilvl, min, max, name });
  var JEWEL_AFFIXES = [
    { id: "j_life", kind: "prefix", key: "life", weight: 10, tiers: [t2(1, 5, 9, "Hale"), t2(10, 10, 15, "Robust")] },
    { id: "j_dmg", kind: "prefix", key: "dmgInc", weight: 8, tiers: [t2(1, 5, 9, "Spiteful"), t2(10, 10, 14, "Vicious")] },
    { id: "j_flat", kind: "prefix", key: "dmgFlat", weight: 6, tiers: [t2(1, 1, 2, "Notched"), t2(10, 3, 4, "Serrated")] },
    { id: "j_mana", kind: "prefix", key: "mana", weight: 8, tiers: [t2(1, 6, 10, "Musing"), t2(10, 11, 16, "Pondering")] },
    { id: "j_spell", kind: "prefix", key: "spellInc", weight: 7, tiers: [t2(1, 5, 9, "Murmuring"), t2(10, 10, 14, "Chorused")] },
    { id: "j_leech", kind: "prefix", key: "leech", weight: 4, decimals: 1, tiers: [t2(4, 0.5, 1, "Leeching"), t2(12, 1.1, 2, "Vampiric")] },
    { id: "j_move", kind: "suffix", key: "moveInc", weight: 6, tiers: [t2(1, 2, 3, "of Pacing"), t2(10, 4, 5, "of the Courier")] },
    { id: "j_aspd", kind: "suffix", key: "atkSpeedInc", weight: 8, tiers: [t2(1, 2, 4, "of Fidgeting"), t2(10, 5, 7, "of Haste")] },
    { id: "j_dodge", kind: "suffix", key: "dodgeCdRed", weight: 6, tiers: [t2(1, 3, 5, "of Ducking"), t2(10, 6, 8, "of Sidesteps")] },
    { id: "j_mregen", kind: "suffix", key: "manaRegen", weight: 6, decimals: 1, tiers: [t2(1, 0.4, 0.8, "of Seeping"), t2(10, 0.9, 1.4, "of Rills")] },
    { id: "j_haste", kind: "suffix", key: "killHaste", weight: 4, tiers: [t2(4, 8, 12, "of the Chase"), t2(12, 13, 18, "of the Hunt")] },
    { id: "j_cgain", kind: "suffix", key: "charmGain", weight: 5, tiers: [t2(1, 10, 15, "of Trinkets"), t2(10, 16, 25, "of Baubles")] },
    { id: "j_regen", kind: "suffix", key: "regen", weight: 6, decimals: 1, tiers: [t2(1, 0.4, 0.8, "of Knitting"), t2(10, 0.9, 1.5, "of Stitching")] }
  ];
  var JEWEL_AFFIX_BY_ID = new Map(JEWEL_AFFIXES.map((a) => [a.id, a]));
  registerItemKind({ category: "jewel", matches: (it) => JEWEL_BASE_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });

  // src/shared/content/uniques.ts
  var UNIQUES = [
    // ---- weapons ----
    {
      id: "firstblood_hush",
      name: "Firstblood Hush",
      base: "moonsliver_dirk",
      weight: 8,
      mods: [["dmgInc", 40, 60], ["fullLifeMore", 50, 70], ["atkSpeedInc", 8, 12]],
      flavour: "The first cut decides. The rest is paperwork.",
      look: { tint: "#2b2233", glow: "#b04a6a", fx: "shadow" }
    },
    {
      id: "gravecall",
      name: "Gravecall",
      base: "grievance_axe",
      weight: 8,
      mods: [["executeMore", 40, 60], ["killHeal", 12, 18], ["atkSpeedInc", -12, -8]],
      flavour: "It hears the dying before they know.",
      look: { tint: "#4a4f45", glow: "#8fd08a", fx: "shadow" }
    },
    {
      id: "long_argument",
      name: "The Long Argument",
      base: "wyrmtooth_pike",
      weight: 8,
      mods: [["reach", 25, 35], ["kbInc", 40, 60], ["dmgInc", 15, 25], ["moveInc", -6, -4]],
      flavour: "Settled, eventually, at a comfortable distance.",
      look: { tint: "#6a5a40", glow: "#e0d090", fx: "wind" }
    },
    {
      id: "thirstblade",
      name: "Thirstblade",
      base: "gallowsedge_blade",
      weight: 8,
      mods: [["leech", 6, 9, 1], ["dmgFlat", 5, 8], ["life", -25, -15]],
      flavour: "It drinks first and asks never.",
      look: { tint: "#5a1a20", glow: "#ff3a4a", fx: "blood" }
    },
    {
      id: "rimebrand",
      name: "Rimebrand",
      base: "ruststeel_sword",
      weight: 10,
      mods: [["chillOnHit", 25, 35], ["dmgInc", 15, 25], ["dmgFlat", 2, 4]],
      flavour: "Forged in a well that never thawed.",
      look: { tint: "#a8d8f0", glow: "#7ad0ff", fx: "frost" }
    },
    {
      id: "oathsplitter",
      name: "Oathsplitter",
      base: "woodsplitter_axe",
      weight: 10,
      mods: [["arcInc", 60, 80], ["kbInc", 30, 50], ["atkSpeedInc", -18, -12]],
      flavour: "Every promise has a grain. Find it.",
      look: { tint: "#7a5a2a", glow: "#ffb050", fx: "ember" }
    },
    {
      id: "hollow_fang",
      name: "Hollow Fang",
      base: "wick_knife",
      weight: 10,
      mods: [["pvpMore", 30, 40], ["dmgFlat", 3, 5], ["pveMore", -25, -15]],
      flavour: "Made for one kind of quarry.",
      look: { tint: "#3a3a3a", glow: "#e0e0e0", fx: "shadow" }
    },
    {
      id: "cinderthorn",
      name: "Cinderthorn",
      base: "thornwood_spear",
      weight: 10,
      mods: [["dodgeMore", 60, 80], ["dodgeCdRed", 12, 18]],
      flavour: "Roll, then strike while the ash still falls.",
      look: { tint: "#6a2a10", glow: "#ff7a2a", fx: "ember" }
    },
    // ---- off-hands ----
    {
      id: "last_gate",
      name: "The Last Gate",
      base: "ironbound_ward",
      weight: 8,
      mods: [["dmgTakenRed", 12, 16], ["life", 25, 35], ["moveInc", -9, -6]],
      flavour: "Nothing passed. Nothing ever will.",
      look: { tint: "#606a74", glow: "#d0e0ff", fx: "stone" }
    },
    {
      id: "briarwall",
      name: "Briarwall",
      base: "hide_buckler",
      weight: 10,
      mods: [["thorns", 6, 10], ["life", 20, 30]],
      flavour: "Hold it close. Let them come closer.",
      look: { tint: "#4a6a2a", glow: "#a0d060", fx: "thorn" }
    },
    // ---- helmets ----
    {
      id: "cindercrown",
      name: "Cindercrown",
      base: "visored_helm",
      weight: 8,
      mods: [["lowLifeMore", 30, 40], ["life", 25, 35]],
      flavour: "Burns brightest just before it goes out.",
      look: { tint: "#7a3010", glow: "#ffa040", fx: "ember" }
    },
    {
      id: "unseen_hour",
      name: "Hood of the Unseen Hour",
      base: "leather_coif",
      weight: 10,
      mods: [["dodgeCdRed", 20, 25], ["killHaste", 25, 35]],
      flavour: "Gone before the bell finishes ringing.",
      look: { tint: "#20202a", glow: "#8080c0", fx: "shadow" }
    },
    // ---- body armour ----
    {
      id: "ossuary_plate",
      name: "Ossuary Plate",
      base: "scaled_hauberk",
      weight: 8,
      mods: [["dmgTakenRed", 8, 12], ["life", 45, 60], ["moveInc", -8, -5]],
      flavour: "Every scale was once somebody's courage.",
      look: { tint: "#d8d0b8", glow: "#f0e8c0", fx: "stone" }
    },
    {
      id: "bloodweave",
      name: "Bloodweave Jerkin",
      base: "patchwork_jerkin",
      weight: 10,
      mods: [["killHeal", 8, 12], ["regen", 2, 3, 1], ["life", 10, 20]],
      flavour: "Mended with whatever was spilled.",
      look: { tint: "#6a1a1a", glow: "#e04040", fx: "blood" }
    },
    {
      id: "glass_saint",
      name: "Vestment of the Glass Saint",
      base: "patchwork_jerkin",
      weight: 6,
      mods: [["pvpMore", 25, 30], ["dmgInc", 10, 15], ["takenMore", 20, 20]],
      flavour: "Holy, fragile and in a hurry.",
      look: { tint: "#d0f0ff", glow: "#ffffff", fx: "holy" }
    },
    // ---- gloves ----
    {
      id: "hangmans_hands",
      name: "Hangman's Hands",
      base: "spiked_gauntlets",
      weight: 8,
      mods: [["executeMore", 25, 35], ["dmgFlat", 4, 6]],
      flavour: "They only ever finish the job.",
      look: { tint: "#3a2a20", glow: "#c06040", fx: "shadow" }
    },
    {
      id: "frostbitten_grasp",
      name: "Frostbitten Grasp",
      base: "wrapped_mitts",
      weight: 10,
      mods: [["chillOnHit", 18, 24], ["atkSpeedInc", 8, 12]],
      flavour: "Shake on it. Then try to walk away.",
      look: { tint: "#90b8d0", glow: "#9adcff", fx: "frost" }
    },
    // ---- boots ----
    {
      id: "stridewind",
      name: "Stridewind",
      base: "fleetstride_greaves",
      weight: 8,
      mods: [["moveInc", 20, 25], ["life", -25, -15]],
      flavour: "The wind does not stop to fight.",
      look: { tint: "#c0e0d0", glow: "#e0fff0", fx: "wind" }
    },
    {
      id: "mudlark_tread",
      name: "Mudlark's Tread",
      base: "mudwalker_boots",
      weight: 10,
      mods: [["kbImmune", 1, 1], ["dodgeCdRed", 10, 15], ["moveInc", 4, 6]],
      flavour: "Rooted like the reeds; quick like the tide.",
      look: { tint: "#5a4a2a", glow: "#a09060", fx: "stone" }
    },
    // ---- jewellery ----
    {
      id: "gamblers_coin",
      name: "The Gambler's Coin",
      base: "bonecharm_pendant",
      weight: 8,
      mods: [["pvpMore", 18, 24], ["takenMore", 10, 10], ["life", 10, 20]],
      flavour: "Heads, you win. Tails, so do they.",
      look: { tint: "#d0a030", glow: "#ffe070", fx: "gold" }
    },
    {
      id: "choirstone",
      name: "Choirstone",
      base: "knotted_cord",
      weight: 10,
      mods: [["spellInc", 40, 50], ["mana", 30, 40], ["manaRegen", 2, 3, 1]],
      flavour: "Hums a note nobody taught it.",
      look: { tint: "#5a60c0", glow: "#a0b0ff", fx: "arcane" }
    },
    {
      id: "leechcoil",
      name: "Leechcoil",
      base: "tarnished_band",
      weight: 10,
      mods: [["leech", 3, 5, 1], ["dmgFlat", 2, 4]],
      flavour: "A ring that is always a little warm.",
      look: { tint: "#7a2030", glow: "#ff5060", fx: "blood" }
    },
    {
      id: "second_wind",
      name: "Ring of the Second Wind",
      base: "glimmer_loop",
      weight: 8,
      mods: [["killHeal", 8, 12], ["killHaste", 20, 30]],
      flavour: "One more breath. One more step.",
      look: { tint: "#a0d0c0", glow: "#c0fff0", fx: "wind" }
    },
    {
      id: "cinderloop",
      name: "Cinderloop",
      base: "glimmer_loop",
      weight: 8,
      mods: [["dodgeMore", 30, 40], ["atkSpeedInc", 4, 8]],
      flavour: "Spin through the sparks.",
      look: { tint: "#a04010", glow: "#ff8030", fx: "ember" }
    },
    // ---- belts ----
    {
      id: "many_pouches",
      name: "Girdle of Many Pouches",
      base: "studded_girdle",
      weight: 8,
      mods: [["charmSlots", 1, 1], ["charmGain", 30, 40], ["flaskGainInc", 20, 30]],
      flavour: "Something for every bad day.",
      look: { tint: "#6a4a2a", glow: "#d0a060", fx: "gold" }
    },
    {
      id: "tallymans_cord",
      name: "Tallyman's Cord",
      base: "rope_sash",
      weight: 10,
      mods: [["pveMore", 25, 35], ["flaskRecInc", 25, 35], ["charmGain", 20, 30]],
      flavour: "Every notch a beast. Every beast a meal.",
      look: { tint: "#8a6a3a", glow: "#e0c080", fx: "gold" }
    }
  ];
  var UNIQUE_BY_ID = new Map(UNIQUES.map((u) => [u.id, u]));
  function uniqueModLine(id) {
    if (!id.startsWith("u_")) return null;
    const at2 = id.lastIndexOf("_");
    const u = UNIQUE_BY_ID.get(id.slice(2, at2));
    const i = Number(id.slice(at2 + 1));
    return u && u.mods[i] ? { u, i } : null;
  }

  // src/shared/content/specialmods.ts
  var CORRUPT_IMPLICITS = [
    { id: "x_life", key: "life", min: 10, max: 20 },
    { id: "x_move", key: "moveInc", min: 3, max: 6 },
    { id: "x_flat", key: "dmgFlat", min: 2, max: 4 },
    { id: "x_aspd", key: "atkSpeedInc", min: 4, max: 8 },
    { id: "x_dodge", key: "dodgeCdRed", min: 5, max: 10 },
    { id: "x_red", key: "dmgTakenRed", min: 3, max: 5 },
    { id: "x_leech", key: "leech", min: 1, max: 2, decimals: 1 },
    { id: "x_reach", key: "reach", min: 5, max: 10 },
    { id: "x_pvp", key: "pvpMore", min: 5, max: 8 }
  ];
  var CORRUPT_IMPLICIT_BY_ID = new Map(CORRUPT_IMPLICITS.map((c) => [c.id, c]));
  function specialModInfo(id) {
    const u = uniqueModLine(id);
    if (u) return keyInfo(u.u.mods[u.i][0]);
    const j = JEWEL_AFFIX_BY_ID.get(id);
    if (j) return keyInfo(j.key);
    const c = CHARM_AFFIX_BY_ID.get(id);
    if (c) return { key: c.key, label: CHARM_MOD_LABELS[c.key] };
    const x2 = CORRUPT_IMPLICIT_BY_ID.get(id);
    if (x2) return { ...keyInfo(x2.key), implicit: true };
    return void 0;
  }
  function keyInfo(key) {
    return isFxKey(key) ? { key, label: FX_LABELS[key] } : { key, label: null };
  }
  function itemAllTotals(item) {
    const out = {};
    const add2 = (k, v2) => out[k] = (out[k] ?? 0) + v2;
    const base = BASE_BY_ID.get(item.b);
    const q = !base?.weapon ? item.q ?? 0 : 0;
    if (base?.implicit) {
      for (const [k, v2] of Object.entries(base.implicit)) {
        const val = v2;
        add2(k, q > 0 && val > 0 ? Math.round(val * (1 + q / 100) * 10) / 10 : val);
      }
    }
    for (const mod of item.m) {
      const a = AFFIX_BY_ID.get(mod.a);
      if (a) {
        add2(a.key, mod.v);
        continue;
      }
      const sp = specialModInfo(mod.a);
      if (sp && !CHARM_AFFIX_BY_ID.has(mod.a)) add2(sp.key, mod.v);
    }
    if (item.s && base) {
      for (const rid of item.s) {
        const r = rid ? RUNE_BY_ID.get(rid) : void 0;
        const rm = r ? runeModFor(r, base.cls) : null;
        if (rm) add2(rm[0], rm[1]);
      }
    }
    return out;
  }

  // src/shared/content/essences.ts
  var ESSENCE_PREFIX = "ess_";
  var FAMILIES = [
    // [suffix of id, display word, affix id]
    ["vital", "Vital", "life"],
    ["swift", "Swift", "move"],
    ["keen", "Keen", "dmg_flat"],
    ["wrath", "Wrathful", "dmg_inc"],
    ["restless", "Restless", "atk_speed"],
    ["lucid", "Lucid", "mana"],
    ["verdant", "Verdant", "regen"],
    ["eel", "Slippery", "dodge_cd"],
    ["incant", "Chanting", "spell_inc"]
  ];
  var ESSENCES = FAMILIES.flatMap(([id, word, affix]) => [
    { id: `${ESSENCE_PREFIX}${id}`, name: `${word} Ichor`, affix, potent: false, weight: 10, minIlvl: 1 },
    { id: `${ESSENCE_PREFIX}${id}_potent`, name: `Potent ${word} Ichor`, affix, potent: true, weight: 3, minIlvl: 10 }
  ]);
  var ESSENCE_BY_ID = new Map(ESSENCES.map((e) => [e.id, e]));
  registerItemKind({ category: "essence", matches: (it) => ESSENCE_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });

  // src/shared/content/currency.ts
  var CURRENCIES = [
    { id: "cur_kindling", name: "Kindling Ember", effect: "transmute", weight: 22, minIlvl: 1, desc: "Kindles a Normal item into a Magic item with one modifier" },
    { id: "cur_stoking", name: "Stoking Ember", effect: "augment", weight: 16, minIlvl: 1, desc: "Adds a modifier to a Magic item with room for one" },
    { id: "cur_crowning", name: "Crowning Ember", effect: "regal", weight: 7, minIlvl: 1, desc: "Raises a Magic item to Rare, adding one modifier" },
    { id: "cur_blazing", name: "Blazing Ember", effect: "exalt", weight: 4, minIlvl: 4, desc: "Adds a modifier to a Rare item with room for one" },
    { id: "cur_shifting", name: "Shifting Ember", effect: "chaos", weight: 6, minIlvl: 1, desc: "Removes a random modifier from a Rare item and adds a new one" },
    { id: "cur_quenching", name: "Quenching Ember", effect: "annul", weight: 5, minIlvl: 1, desc: "Removes a random modifier from a Magic or Rare item" },
    { id: "cur_tempering", name: "Tempering Ember", effect: "divine", weight: 4, minIlvl: 4, desc: "Rerolls the values of every modifier on an item" },
    { id: "cur_forgeheart", name: "Forgeheart Ember", effect: "alch", weight: 3, minIlvl: 1, desc: "Reforges a Normal item into a Rare item with four modifiers" },
    { id: "cur_honing", name: "Honing Ember", effect: "quality", weight: 12, minIlvl: 1, desc: "Adds 5% quality to an item (max 20%). Weapons: more damage. Armour: stronger implicits. Flasks: more recovery. Charms: longer duration" },
    { id: "cur_boring", name: "Boring Ember", effect: "socket", weight: 8, minIlvl: 1, desc: "Bores a rune socket into a weapon or armour piece (body armour and two-handers hold 2, others 1)" },
    { id: "cur_blighted", name: "Blighted Ember", effect: "corrupt", weight: 3, minIlvl: 1, desc: "Corrupts an item with an unpredictable outcome. Corrupted items can't be crafted further" },
    { id: "cur_awl", name: "Lapidary's Awl", effect: "gemsocket", weight: 3, minIlvl: 1, desc: "Bores another support socket into a skill gem (max 5)" }
  ];
  var CURRENCY_BY_ID = new Map(CURRENCIES.map((c) => [c.id, c]));
  registerItemKind({ category: "currency", matches: (it) => CURRENCY_BY_ID.has(it.b), footprint: { w: 1, h: 1 } });

  // src/shared/fx.ts
  function emptyFx() {
    return Object.fromEntries(FX_KEYS.map((k) => [k, 0]));
  }
  function computeFx(equip) {
    const out = emptyFx();
    for (const s of SLOTS) {
      const it = equip[s];
      if (!it) continue;
      for (const [k, v2] of Object.entries(itemAllTotals(it))) if (k in out) out[k] += v2;
    }
    return out;
  }
  setCharmSlotBonus((equip) => computeFx(equip).charmSlots);

  // src/shared/items.ts
  function isFlask(item) {
    return FLASK_BASE_BY_ID.has(item.b);
  }
  var itemInfoHooks = [];
  var COMPARE_STATS = [
    { key: "maxHp", label: "Max Life", better: 1 },
    { key: "attackDamage", label: "Attack Damage", better: 1, decimals: 1 },
    { key: "attackCooldown", label: "Attack Time (s)", better: -1, decimals: 2 },
    { key: "attackRange", label: "Reach", better: 1 },
    { key: "attackArc", label: "Arc (\xB0)", better: 1, scale: 180 / Math.PI },
    { key: "knockback", label: "Knockback", better: 1 },
    { key: "moveSpeed", label: "Move Speed", better: 1, decimals: 1 },
    { key: "dodgeCooldown", label: "Dodge Cooldown (s)", better: -1, decimals: 2 },
    { key: "lifeRegen", label: "Life Regen /s", better: 1, decimals: 1 },
    { key: "flaskChargeGain", label: "Flask Charge Gain", better: 1, scale: 100, decimals: 0 },
    { key: "flaskRecovery", label: "Flask Recovery", better: 1, scale: 100, decimals: 0 },
    { key: "flaskSlots", label: "Flask Slots", better: 1 }
  ];
  function flaskModTotal(item, key) {
    let v2 = 0;
    for (const m of item.m) if (FLASK_AFFIX_BY_ID.get(m.a)?.key === key) v2 += m.v;
    return v2;
  }
  function flaskProps(item, recovery) {
    const b = FLASK_BASE_BY_ID.get(item.b);
    return {
      maxCharges: b.maxCharges + flaskModTotal(item, "fMaxCharges"),
      perUse: Math.max(1, Math.round(b.chargesPerUse * (1 - flaskModTotal(item, "fChargesRed") / 100))),
      heal: b.heal * (1 + (flaskModTotal(item, "fRecInc") + (item.q ?? 0)) / 100) * recovery,
      duration: b.duration,
      instant: flaskModTotal(item, "fInstant") > 0,
      gainMult: 1 + flaskModTotal(item, "fGainInc") / 100
    };
  }

  // src/client/gfx/font.ts
  var G2 = {
    A: [14, 17, 17, 31, 17, 17, 17],
    B: [30, 17, 17, 30, 17, 17, 30],
    C: [14, 17, 16, 16, 16, 17, 14],
    D: [30, 17, 17, 17, 17, 17, 30],
    E: [31, 16, 16, 30, 16, 16, 31],
    F: [31, 16, 16, 30, 16, 16, 16],
    G: [14, 17, 16, 23, 17, 17, 15],
    H: [17, 17, 17, 31, 17, 17, 17],
    I: [14, 4, 4, 4, 4, 4, 14],
    J: [7, 2, 2, 2, 2, 18, 12],
    K: [17, 18, 20, 24, 20, 18, 17],
    L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17],
    N: [17, 17, 25, 21, 19, 17, 17],
    O: [14, 17, 17, 17, 17, 17, 14],
    P: [30, 17, 17, 30, 16, 16, 16],
    Q: [14, 17, 17, 17, 21, 18, 13],
    R: [30, 17, 17, 30, 20, 18, 17],
    S: [15, 16, 16, 14, 1, 1, 30],
    T: [31, 4, 4, 4, 4, 4, 4],
    U: [17, 17, 17, 17, 17, 17, 14],
    V: [17, 17, 17, 17, 17, 10, 4],
    W: [17, 17, 17, 21, 21, 21, 10],
    X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 10, 4, 4, 4, 4],
    Z: [31, 1, 2, 4, 8, 16, 31],
    "0": [14, 17, 19, 21, 25, 17, 14],
    "1": [4, 12, 4, 4, 4, 4, 14],
    "2": [14, 17, 1, 2, 4, 8, 31],
    "3": [31, 2, 4, 2, 1, 17, 14],
    "4": [2, 6, 10, 18, 31, 2, 2],
    "5": [31, 16, 30, 1, 1, 17, 14],
    "6": [6, 8, 16, 30, 17, 17, 14],
    "7": [31, 1, 2, 4, 8, 8, 8],
    "8": [14, 17, 17, 14, 17, 17, 14],
    "9": [14, 17, 17, 15, 1, 2, 12],
    ".": [0, 0, 0, 0, 0, 12, 12],
    ",": [0, 0, 0, 0, 12, 4, 8],
    ":": [0, 12, 12, 0, 12, 12, 0],
    ";": [0, 12, 12, 0, 12, 4, 8],
    "!": [4, 4, 4, 4, 4, 0, 4],
    "?": [14, 17, 1, 2, 4, 0, 4],
    "'": [4, 4, 8, 0, 0, 0, 0],
    '"': [10, 10, 0, 0, 0, 0, 0],
    "-": [0, 0, 0, 14, 0, 0, 0],
    "+": [0, 4, 4, 31, 4, 4, 0],
    "/": [0, 1, 2, 4, 8, 16, 0],
    "(": [2, 4, 8, 8, 8, 4, 2],
    ")": [8, 4, 2, 2, 2, 4, 8],
    "[": [14, 8, 8, 8, 8, 8, 14],
    "]": [14, 2, 2, 2, 2, 2, 14],
    "%": [24, 25, 2, 4, 8, 19, 3],
    "#": [10, 10, 31, 10, 31, 10, 10],
    "<": [2, 4, 8, 16, 8, 4, 2],
    ">": [8, 4, 2, 1, 2, 4, 8],
    "=": [0, 0, 31, 0, 31, 0, 0],
    _: [0, 0, 0, 0, 0, 0, 31],
    "&": [12, 18, 20, 8, 21, 18, 13],
    "*": [0, 4, 21, 14, 21, 4, 0],
    "\xB7": [0, 0, 0, 4, 0, 0, 0],
    "\xD7": [0, 17, 10, 4, 10, 17, 0],
    "\xB0": [12, 18, 18, 12, 0, 0, 0]
  };
  var glyphs = /* @__PURE__ */ new Map();
  for (const [ch, rows] of Object.entries(G2)) {
    let mask = 0;
    for (const r of rows) mask |= r;
    let x0 = 0;
    let x1 = 4;
    while (x0 < 4 && !(mask & 16 >> x0)) x0++;
    while (x1 > x0 && !(mask & 16 >> x1)) x1--;
    glyphs.set(ch, { rows, x0, w: mask ? x1 - x0 + 1 : 1 });
  }
  var FONT_H = 7;
  function glyphFor(ch) {
    if (ch === " ") return null;
    const u = ch.toUpperCase();
    return glyphs.get(u) ?? glyphs.get(normalize(u)) ?? glyphs.get("?");
  }
  function normalize(c) {
    if (c === "\u2013" || c === "\u2014") return "-";
    if (c === "\u2019" || c === "\u2018") return "'";
    if (c === "\u2026") return ".";
    return c;
  }
  function textWidth(s) {
    let w = 0;
    for (const ch of s) {
      const g = glyphFor(ch);
      w += (g ? g.w : 2) + 1;
    }
    return Math.max(0, w - 1);
  }
  var cache3 = /* @__PURE__ */ new Map();
  function textSprite(s, color, outline2 = "#0a0709") {
    const key = `${color}|${outline2}|${s}`;
    let cv = cache3.get(key);
    if (cv) return cv;
    if (cache3.size > 1500) cache3.clear();
    const w = textWidth(s) + 2;
    const h = FONT_H + 2;
    cv = document.createElement("canvas");
    cv.width = Math.max(1, w);
    cv.height = h;
    const ctx = cv.getContext("2d");
    const px = [];
    let x2 = 1;
    for (const ch of s) {
      const g = glyphFor(ch);
      if (!g) {
        x2 += 3;
        continue;
      }
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < g.w; c++) if (g.rows[r] & 16 >> c + g.x0) px.push([x2 + c, 1 + r]);
      }
      x2 += g.w + 1;
    }
    if (outline2) {
      ctx.fillStyle = outline2;
      for (const [a, b] of px) ctx.fillRect(a - 1, b - 1, 3, 3);
    }
    ctx.fillStyle = color;
    for (const [a, b] of px) ctx.fillRect(a, b, 1, 1);
    cache3.set(key, cv);
    return cv;
  }
  function drawText(ctx, s, x2, y2, color = "#e8e2d4", align = "left", scale = 1, outline2 = "#0a0709") {
    const cv = textSprite(s, color, outline2);
    const w = cv.width * scale;
    const dx = align === "left" ? x2 : align === "center" ? x2 - Math.floor(w / 2) : x2 - w;
    ctx.drawImage(cv, Math.round(dx - scale), Math.round(y2 - scale), w, cv.height * scale);
  }
  var titleCache = /* @__PURE__ */ new Map();
  var TITLE_H = 14;
  var TITLE_BLOOD = { top: "#f3dfb4", mid: "#c99a56", bot: "#8c2316", outline: "#0a0506", shadow: "#000000" };
  var TITLE_BONE = { top: "#f0e6cc", mid: "#b8a888", bot: "#6a5c48", outline: "#0a0708", shadow: "#000000" };
  var TITLE_EMBER = { top: "#fff0b0", mid: "#ff9a2a", bot: "#a8260c", outline: "#100404", shadow: "#000000" };
  function titleWidth(s) {
    let w = 0;
    for (const ch of s) {
      const g = glyphFor(ch);
      w += (g ? g.w * 2 + 1 : 5) + 2;
    }
    return Math.max(0, w - 2);
  }
  function titleSprite(s, pal2 = TITLE_BLOOD) {
    const key = `${pal2.top}|${pal2.bot}|${s}`;
    let cv = titleCache.get(key);
    if (cv) return cv;
    if (titleCache.size > 200) titleCache.clear();
    const W3 = titleWidth(s) + 6;
    const H3 = TITLE_H + 6;
    const mask = new Uint8Array(W3 * H3);
    const put = (x2, y2) => {
      if (x2 >= 0 && y2 >= 0 && x2 < W3 && y2 < H3) mask[y2 * W3 + x2] = 1;
    };
    const clear = (x2, y2) => {
      if (x2 >= 0 && y2 >= 0 && x2 < W3 && y2 < H3) mask[y2 * W3 + x2] = 0;
    };
    let pen = 3;
    for (const ch of s) {
      const g = glyphFor(ch);
      if (!g) {
        pen += 7;
        continue;
      }
      const on = (c, r) => r >= 0 && r < 7 && c >= 0 && c < g.w && !!(g.rows[r] & 16 >> c + g.x0);
      const cuts = [];
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < g.w; c++) {
          if (!on(c, r)) continue;
          const x2 = pen + c * 2;
          const y2 = 2 + r * 2;
          const vert = on(c, r - 1) || on(c, r + 1);
          if (vert || !on(c - 1, r) && !on(c + 1, r)) {
            put(x2, y2);
            put(x2 + 1, y2);
            put(x2, y2 + 1);
            put(x2 + 1, y2 + 1);
          } else {
            put(x2, y2);
            put(x2 + 1, y2);
            if (on(c - 1, r + 1) || on(c + 1, r + 1)) put(x2 + (on(c + 1, r + 1) ? 1 : 0), y2 + 1);
          }
          if (on(c, r + 1) && !on(c, r - 1)) {
            put(x2 - 1, y2);
            if (!on(c + 1, r)) cuts.push([x2 + 1, y2]);
          }
          if (on(c, r - 1) && !on(c, r + 1)) put(x2 + 2, y2 + 1);
        }
      }
      for (const [x2, y2] of cuts) clear(x2, y2);
      pen += g.w * 2 + 1 + 2;
    }
    cv = document.createElement("canvas");
    cv.width = W3;
    cv.height = H3;
    const ctx = cv.getContext("2d");
    const at2 = (x2, y2) => x2 >= 0 && y2 >= 0 && x2 < W3 && y2 < H3 && mask[y2 * W3 + x2] === 1;
    ctx.fillStyle = pal2.shadow;
    for (let y2 = 0; y2 < H3; y2++) for (let x2 = 0; x2 < W3; x2++) if (at2(x2 - 1, y2 - 1)) ctx.fillRect(x2 + 1, y2 + 1, 1, 1);
    ctx.fillStyle = pal2.outline;
    for (let y2 = 0; y2 < H3; y2++)
      for (let x2 = 0; x2 < W3; x2++) if (!at2(x2, y2) && (at2(x2 - 1, y2) || at2(x2 + 1, y2) || at2(x2, y2 - 1) || at2(x2, y2 + 1) || at2(x2 - 1, y2 - 1) || at2(x2 + 1, y2 + 1))) ctx.fillRect(x2, y2, 1, 1);
    for (let y2 = 0; y2 < H3; y2++)
      for (let x2 = 0; x2 < W3; x2++) {
        if (!at2(x2, y2)) continue;
        const t4 = (y2 - 2) / TITLE_H;
        const d = (x2 + y2 & 1) * 0.08;
        ctx.fillStyle = t4 + d < 0.36 ? pal2.top : t4 + d < 0.66 ? pal2.mid : pal2.bot;
        ctx.fillRect(x2, y2, 1, 1);
      }
    titleCache.set(key, cv);
    return cv;
  }
  function drawTitle(ctx, s, x2, y2, align = "center", scale = 1, pal2 = TITLE_BLOOD) {
    const cv = titleSprite(s, pal2);
    const w = cv.width * scale;
    const dx = align === "left" ? x2 : align === "center" ? x2 - Math.floor(w / 2) : x2 - w;
    ctx.drawImage(cv, Math.round(dx), Math.round(y2 - 2 * scale), w, cv.height * scale);
  }

  // src/shared/content/gems.ts
  var ATTR_COLOR = { str: "#e0604c", dex: "#5cc46a", int: "#5a8ee0" };
  var ATTR_NAME = { str: "Strength", dex: "Dexterity", int: "Intelligence" };
  var MELEE_ALL = ["sword", "spear", "axe", "dagger", "staff", "quarterstaff", "mace", "sceptre"];
  var SKILL_GEMS = [
    {
      id: "sundering_blow",
      name: "Sundering Blow",
      kind: "strike",
      tags: ["attack", "melee", "physical"],
      attr: "str",
      tier: 1,
      desc: "A slow, two-handed overhead blow that cleaves a narrow line and hurls the target back.",
      cost: 6,
      time: 1.45,
      commit: 0.62,
      cd: 0,
      move: 0.15,
      dmg: 2.1,
      arcDeg: 60,
      reach: 18,
      kbMult: 1.8,
      weapons: MELEE_ALL,
      color: "#e8c890"
    },
    {
      id: "faultline_slam",
      name: "Faultline Slam",
      kind: "slam",
      tags: ["attack", "melee", "area", "slam", "physical"],
      attr: "str",
      tier: 2,
      desc: "Raise your weapon and split the ground ahead. The impact zone is marked while you wind up.",
      cost: 11,
      time: 1.75,
      commit: 0.72,
      cd: 0,
      move: 0.05,
      dmg: 2.5,
      reach: 78,
      radius: 66,
      kbMult: 1.3,
      weapons: ["sword", "axe", "spear", "staff", "quarterstaff", "mace"],
      color: "#d29a5a"
    },
    {
      id: "splinter_volley",
      name: "Splinter Volley",
      kind: "volley",
      tags: ["attack", "projectile", "physical"],
      attr: "dex",
      tier: 1,
      desc: "Loose a tight fan of barbed shafts (with a bow) or hurled shards of your blade.",
      cost: 7,
      time: 1.1,
      commit: 0.5,
      cd: 0,
      move: 0.4,
      dmg: 0.85,
      speed: 720,
      range: 560,
      count: 3,
      spread: 9,
      kbMult: 0.5,
      weapons: ["bow", "crossbow", "dagger", "spear"],
      color: "#d8d0a0"
    },
    {
      id: "cinderbolt",
      name: "Cinderbolt",
      kind: "bolt",
      tags: ["spell", "projectile", "fire"],
      attr: "int",
      tier: 1,
      desc: "Fling a spitting knot of embers that bursts on the first thing it touches.",
      cost: 6,
      time: 0.6,
      commit: 0.55,
      cd: 0,
      move: 0.45,
      dmg: 19,
      speed: 560,
      range: 600,
      count: 1,
      spread: 10,
      color: "#ff8a3a"
    },
    {
      id: "frostgale",
      name: "Frostgale",
      kind: "cone",
      tags: ["spell", "area", "cold"],
      attr: "int",
      tier: 2,
      desc: "Exhale a gale of rime in a cone. Everything caught is chilled.",
      cost: 9,
      time: 0.7,
      commit: 0.5,
      cd: 0,
      move: 0.3,
      dmg: 15,
      arcDeg: 72,
      reach: 165,
      chill: 1.6,
      color: "#9ad8ff"
    },
    {
      id: "stormthread",
      name: "Stormthread",
      kind: "chain",
      tags: ["spell", "chain", "lightning"],
      attr: "int",
      tier: 3,
      desc: "A crackling thread leaps to the nearest foe you aim at, then jumps between nearby enemies.",
      cost: 10,
      time: 0.65,
      commit: 0.45,
      cd: 0,
      move: 0.35,
      dmg: 14,
      reach: 330,
      radius: 210,
      count: 4,
      color: "#b8a8ff"
    },
    {
      id: "shadow_lunge",
      name: "Shadow Lunge",
      kind: "dash",
      tags: ["spell", "movement"],
      attr: "dex",
      tier: 2,
      desc: "Lunge through the dark toward your aim, stopping short of solid rock.",
      cost: 8,
      time: 0.22,
      commit: 0,
      cd: 3,
      move: 1,
      dmg: 0,
      speed: 240,
      color: "#9a7ad8"
    },
    {
      id: "ember_pact",
      name: "Ember Pact",
      kind: "buff",
      tags: ["spell", "buff", "duration", "fire"],
      attr: "str",
      tier: 3,
      desc: "Bargain with the embers in your blood: deal more damage and move faster for a while.",
      cost: 14,
      time: 0.45,
      commit: 0.5,
      cd: 14,
      move: 0.5,
      dmg: 0,
      buff: { dur: 6, more: 0.25, move: 0.12 },
      color: "#ff4a3a"
    },
    {
      id: "pyre_effigy",
      name: "Pyre Effigy",
      kind: "totem",
      tags: ["spell", "totem", "projectile", "duration", "fire"],
      attr: "str",
      tier: 4,
      desc: "Plant a burning effigy that spits fire at the nearest enemy until it collapses.",
      cost: 16,
      time: 0.7,
      commit: 0.7,
      cd: 6,
      move: 0.3,
      dmg: 8,
      speed: 480,
      range: 380,
      radius: 380,
      count: 1,
      spread: 12,
      totem: { dur: 8, rate: 0.8, place: 150 },
      color: "#ffb04a"
    },
    // ---- spirit gems (cut from rough spirit crystals) ----
    {
      id: "ashen_mantle",
      name: "Ashen Mantle",
      kind: "aura",
      tags: ["persistent", "buff"],
      attr: "str",
      tier: 1,
      spirit: 30,
      desc: "Wrap yourself in drifting ash. While switched on: more damage and a little life regeneration.",
      cost: 0,
      time: 0.4,
      commit: 0.5,
      cd: 1,
      move: 0.6,
      dmg: 0,
      aura: { more: 0.1, move: 0, regen: 1 },
      color: "#d07a5a"
    },
    {
      id: "windward_hymn",
      name: "Windward Hymn",
      kind: "aura",
      tags: ["persistent", "buff"],
      attr: "dex",
      tier: 1,
      spirit: 30,
      desc: "Hum a travelling song the wind carries for you. While switched on: more movement speed.",
      cost: 0,
      time: 0.4,
      commit: 0.5,
      cd: 1,
      move: 0.6,
      dmg: 0,
      aura: { more: 0, move: 0.08, regen: 0 },
      color: "#8ae0b0"
    },
    {
      id: "tumbling_rite",
      name: "Tumbling Rite",
      kind: "meta",
      tags: ["persistent", "meta"],
      attr: "dex",
      tier: 3,
      spirit: 60,
      desc: "Socket a spell into this rite. Rolling builds energy; at full energy the spell fires at your aim for free.",
      cost: 0,
      time: 0.4,
      commit: 0.5,
      cd: 1,
      move: 0.6,
      dmg: 0,
      meta: { perDist: 0.75 },
      color: "#c8b0ff"
    },
    // ---- weapon skills (granted by the equipped weapon; not droppable) ----
    {
      id: "riposte_arc",
      name: "Riposte Arc",
      kind: "strike",
      tags: ["attack", "melee", "physical"],
      attr: "str",
      tier: 0,
      innate: ["sword"],
      desc: "A fast, wide backhand sweep that shoves everything around you away.",
      cost: 4,
      time: 0.85,
      commit: 0.5,
      cd: 4,
      move: 0.5,
      dmg: 1.1,
      arcDeg: 160,
      reach: 4,
      kbMult: 2.2,
      weapons: ["sword"],
      color: "#f0e0b0"
    },
    {
      id: "rending_chop",
      name: "Rending Chop",
      kind: "slam",
      tags: ["attack", "melee", "area", "slam", "physical"],
      attr: "str",
      tier: 0,
      innate: ["axe", "mace"],
      desc: "Bury your weapon in the ground just ahead of you.",
      cost: 5,
      time: 1.2,
      commit: 0.65,
      cd: 5,
      move: 0.2,
      dmg: 1.6,
      reach: 34,
      radius: 52,
      kbMult: 1.4,
      weapons: ["axe", "mace"],
      color: "#c88a5a"
    },
    {
      id: "longreach_thrust",
      name: "Longreach Thrust",
      kind: "strike",
      tags: ["attack", "melee", "physical"],
      attr: "dex",
      tier: 0,
      innate: ["spear", "quarterstaff"],
      desc: "Step into a long, narrow thrust that outranges most blades.",
      cost: 4,
      time: 1,
      commit: 0.55,
      cd: 3,
      move: 0.35,
      dmg: 1.5,
      arcDeg: 22,
      reach: 62,
      kbMult: 1,
      weapons: ["spear", "quarterstaff"],
      color: "#e0d8a8"
    },
    {
      id: "smoke_step",
      name: "Smoke Step",
      kind: "dash",
      tags: ["spell", "movement"],
      attr: "dex",
      tier: 0,
      innate: ["dagger"],
      desc: "A short hop through a puff of smoke.",
      cost: 4,
      time: 0.18,
      commit: 0,
      cd: 4,
      move: 1,
      dmg: 0,
      speed: 150,
      weapons: ["dagger"],
      color: "#a0a0b8"
    },
    {
      id: "pinning_shot",
      name: "Pinning Shot",
      kind: "volley",
      tags: ["attack", "projectile", "physical"],
      attr: "dex",
      tier: 0,
      innate: ["bow", "crossbow"],
      desc: "A heavy shaft that chills its target in place.",
      cost: 4,
      time: 1.05,
      commit: 0.5,
      cd: 4,
      move: 0.4,
      dmg: 1.4,
      speed: 820,
      range: 600,
      count: 1,
      chill: 1.4,
      kbMult: 0.8,
      weapons: ["bow", "crossbow"],
      color: "#c8e8ff"
    },
    {
      id: "kindling_spark",
      name: "Kindling Spark",
      kind: "bolt",
      tags: ["spell", "projectile", "fire"],
      attr: "int",
      tier: 0,
      innate: ["staff", "wand", "sceptre"],
      desc: "A small, quick ember channelled through your focus.",
      cost: 3,
      time: 0.45,
      commit: 0.5,
      cd: 1.5,
      move: 0.5,
      dmg: 10,
      speed: 640,
      range: 520,
      count: 1,
      weapons: ["staff", "wand", "sceptre"],
      color: "#ffb070"
    }
  ];
  var SKILL_GEM_BY_ID = new Map(SKILL_GEMS.map((s) => [s.id, s]));
  var isSpiritDef = (d) => d.kind === "aura" || d.kind === "meta";
  var CUTTABLE_SKILLS = SKILL_GEMS.filter((d) => d.tier > 0 && !isSpiritDef(d));
  var CUTTABLE_SPIRIT = SKILL_GEMS.filter((d) => d.tier > 0 && isSpiritDef(d));
  function innateFor(kind2) {
    if (!kind2) return void 0;
    return SKILL_GEMS.find((d) => d.innate?.includes(kind2));
  }
  var NO_UTIL = ["movement", "buff", "persistent", "meta"];
  var SUPPORT_GEMS = [
    { id: "heavy_hand", name: "Heavy Hand", attr: "str", needs: ["attack", "spell"], excludes: NO_UTIL, costMult: 1.4, more: 1.25, desc: "More damage.", color: "#e0b070" },
    { id: "scattershot", name: "Scattershot", attr: "dex", needs: ["projectile"], costMult: 1.3, proj: 2, more: 0.75, desc: "+2 projectiles in a wider fan, but less damage.", color: "#d8d0a0" },
    { id: "quickened_rite", name: "Quickened Rite", attr: "dex", needs: [], excludes: ["persistent", "meta"], costMult: 1.2, speed: 1.2, desc: "More attack and cast speed for this skill.", color: "#a0e0a0" },
    { id: "broadened_ruin", name: "Broadened Ruin", attr: "int", needs: ["area", "chain"], costMult: 1.3, area: 1.35, more: 0.92, desc: "More area of effect, slightly less damage.", color: "#c0b0e0" },
    { id: "cindertouch", name: "Cindertouch", attr: "str", needs: ["attack", "spell"], excludes: NO_UTIL, costMult: 1.2, ignite: 0.4, addTags: ["fire"], desc: "Hits ignite: the target burns for part of the hit over 3 seconds.", color: "#ff7a2a" },
    { id: "arcing_link", name: "Arcing Link", attr: "int", needs: ["projectile", "chain"], costMult: 1.25, chain: 2, more: 0.88, desc: "Projectiles chain to 2 more enemies; chaining skills jump 2 more times. Less damage.", color: "#b8a8ff" },
    { id: "bloodthirst", name: "Bloodthirst", attr: "str", needs: ["attack", "spell"], excludes: NO_UTIL, costMult: 1.15, leech: 0.06, desc: "Part of the damage dealt by this skill is leeched as Life.", color: "#d04050" },
    { id: "frugal_sigil", name: "Frugal Sigil", attr: "int", needs: [], excludes: ["persistent", "meta"], costMult: 0.7, more: 0.9, desc: "Less mana cost, slightly less damage.", color: "#8fb8e0" },
    { id: "rimebite", name: "Rimebite", attr: "int", needs: ["attack", "spell"], excludes: NO_UTIL, costMult: 1.15, chill: 1.6, addTags: ["cold"], desc: "Hits chill the target (30% slower).", color: "#9ad8ff" },
    { id: "swift_recall", name: "Swift Recall", attr: "dex", needs: ["movement", "buff", "totem"], excludes: ["persistent"], costMult: 1.2, cdr: 1.3, dur: 1.15, desc: "Faster cooldown recovery and longer duration.", color: "#e0d080" }
  ];
  var SUPPORT_GEM_BY_ID = new Map(SUPPORT_GEMS.map((s) => [s.id, s]));
  var SKILL_GEM_PREFIX = "gem_";
  var SUPPORT_GEM_PREFIX = "sup_";
  var ROUGH_SKILL = "rough_skill";
  var ROUGH_SUPPORT = "rough_support";
  var ROUGH_SPIRIT = "rough_spirit";
  var ROUGH_NAMES = {
    [ROUGH_SKILL]: "Rough Skill Crystal",
    [ROUGH_SUPPORT]: "Rough Support Crystal",
    [ROUGH_SPIRIT]: "Rough Spirit Crystal"
  };
  var GEM_MAX_LEVEL = 10;
  var SUPPORT_MAX_TIER = 3;
  var BASE_SOCKETS = 2;
  var MAX_SOCKETS = 5;
  var MAX_EQUIPPED_SKILLS = 9;
  var SUPPORT_ATTR_REQ = [10, 25, 40];
  var ROUGH_COLOR = "#b0c8c8";

  // src/shared/skills.ts
  var SKILL_KEYS = [
    { code: "Mouse0", label: "LMB" },
    { code: "Mouse1", label: "MMB" },
    { code: "Mouse2", label: "RMB" },
    { code: "KeyQ", label: "Q" },
    { code: "KeyE", label: "E" },
    { code: "KeyR", label: "R" },
    { code: "KeyT", label: "T" },
    { code: "KeyG", label: "G" }
  ];
  var BAR_MAIN = SKILL_KEYS.length;
  var BAR_SIZE = BAR_MAIN * 2;
  var WEAPON_SKILL_SLOT = 1;
  var isSkillGem = (it) => !!it && it.b.startsWith(SKILL_GEM_PREFIX) && SKILL_GEM_BY_ID.has(it.b.slice(SKILL_GEM_PREFIX.length));
  var isSupportGem = (it) => !!it && it.b.startsWith(SUPPORT_GEM_PREFIX) && SUPPORT_GEM_BY_ID.has(it.b.slice(SUPPORT_GEM_PREFIX.length));
  var isRough = (it) => !!it && it.b in ROUGH_NAMES;
  var isGem = (it) => isSkillGem(it) || isSupportGem(it) || isRough(it);
  var skillDefOf = (it) => isSkillGem(it) ? SKILL_GEM_BY_ID.get(it.b.slice(SKILL_GEM_PREFIX.length)) : void 0;
  var supportDefOf = (it) => isSupportGem(it) ? SUPPORT_GEM_BY_ID.get(it.b.slice(SUPPORT_GEM_PREFIX.length)) : void 0;
  registerItemKind({ category: "gem", matches: (it) => isGem(it), footprint: { w: 1, h: 1 } });
  function gemLevel(it) {
    return Math.max(1, Math.min(GEM_MAX_LEVEL, Math.round(it.l || 1)));
  }
  function supportTier(it) {
    return Math.max(1, Math.min(SUPPORT_MAX_TIER, Math.round(it.l || 1)));
  }
  var TIER_NAMES = ["I", "II", "III"];
  function socketCount(gem) {
    if (!gem) return 0;
    return Math.min(MAX_SOCKETS, Math.max(BASE_SOCKETS, gem.gs ?? 0));
  }
  function gemAttr(it) {
    return skillDefOf(it)?.attr ?? supportDefOf(it)?.attr ?? null;
  }
  function gemColor(it) {
    const a = gemAttr(it);
    return a ? ATTR_COLOR[a] : "#b0c0c0";
  }
  function gemDisplayName(it) {
    const sp = supportDefOf(it);
    if (sp) return `${sp.name} ${TIER_NAMES[supportTier(it) - 1]}`;
    if (isRough(it)) return `${ROUGH_NAMES[it.b]} (Level ${Math.round(it.l)})`;
    return skillDefOf(it)?.name ?? it.n;
  }
  function cutOptions(rough) {
    if (rough.b === ROUGH_SUPPORT) return SUPPORT_GEMS.map((s) => ({ id: s.id, name: `${s.name} ${TIER_NAMES[supportTier(rough) - 1]}`, ok: true }));
    const list = rough.b === ROUGH_SPIRIT ? CUTTABLE_SPIRIT : rough.b === ROUGH_SKILL ? CUTTABLE_SKILLS : [];
    return list.map((d) => ({ id: d.id, name: d.name, ok: d.tier <= rough.l, why: d.tier > rough.l ? `needs a level ${d.tier} crystal` : void 0 }));
  }
  function upgradeRefusal(rough, gem) {
    const d = skillDefOf(gem);
    if (!d || d.innate) return "Only skill and spirit gems can be raised";
    if (rough.b !== (isSpiritDef(d) ? ROUGH_SPIRIT : ROUGH_SKILL)) return `Needs a ${isSpiritDef(d) ? "spirit" : "skill"} crystal`;
    if (rough.l <= gemLevel(gem)) return `The crystal must be above level ${gemLevel(gem)}`;
    return null;
  }
  function gemLines(it, attrs) {
    const sk = skillDefOf(it);
    if (sk) {
      const out = [`${isSpiritDef(sk) ? "Spirit gem" : sk.innate ? "Weapon skill" : "Skill gem"} \xB7 Level ${gemLevel(it)} \xB7 ${ATTR_NAME[sk.attr]}`, sk.tags.join(", "), sk.desc];
      if (sk.spirit) out.push(`Reserves ${sk.spirit} Spirit while on`);
      else out.push(`Mana cost ${Math.round(levelCost(sk, gemLevel(it)))}${sk.cd ? ` \xB7 Cooldown ${sk.cd}s` : ""}`);
      if (sk.weapons) out.push(`Requires: ${sk.weapons.join(" / ")}`);
      out.push(`Support sockets: ${socketCount(it)} / ${MAX_SOCKETS}`);
      return out;
    }
    const sp = supportDefOf(it);
    if (sp) {
      const t4 = supportTier(it);
      const req = SUPPORT_ATTR_REQ[t4 - 1];
      const have = attrs?.[sp.attr];
      const out = [`Support gem \xB7 Tier ${TIER_NAMES[t4 - 1]}`, supportSummary(supportAt(sp, t4))];
      out.push(`Cost multiplier ${Math.round(supportAt(sp, t4).costMult * 100)}%`);
      out.push(sp.needs.length ? `Supports: ${sp.needs.join(" or ")} skills` : "Supports any skill");
      if (sp.excludes?.length) out.push(`Cannot support: ${sp.excludes.join(", ")}`);
      out.push(`${have !== void 0 && have < req ? "! " : ""}Requires ${req} ${ATTR_NAME[sp.attr]}${have !== void 0 ? ` (you have ${Math.floor(have)})` : ""}`);
      return out;
    }
    if (isRough(it)) {
      if (it.b === ROUGH_SUPPORT) return [`Tier ${TIER_NAMES[supportTier(it) - 1]}`, "Open the Skills panel (K) and cut it into any support gem of this tier."];
      const fam = it.b === ROUGH_SPIRIT ? "spirit" : "skill";
      return [
        `Level ${Math.round(it.l)}`,
        `Open the Skills panel (K) and cut it into any ${fam} gem of tier ${Math.round(it.l)} or lower,`,
        `or use it to raise an owned ${fam} gem to level ${Math.round(it.l)}.`
      ];
    }
    return [];
  }
  function supportAt(s, tier) {
    if (tier <= 1) return s;
    const up = tier === 2 ? 1.4 : 1.8;
    const down = tier === 2 ? 0.8 : 0.6;
    const scale = (v2) => v2 === void 0 ? void 0 : v2 >= 1 ? 1 + (v2 - 1) * up : 1 - (1 - v2) * down;
    return {
      ...s,
      more: scale(s.more),
      speed: scale(s.speed),
      area: scale(s.area),
      cdr: scale(s.cdr),
      dur: scale(s.dur),
      costMult: s.costMult < 1 ? 1 - (1 - s.costMult) * up : s.costMult,
      proj: s.proj !== void 0 ? s.proj + (tier === 3 ? 1 : 0) : void 0,
      chain: s.chain !== void 0 ? s.chain + (tier === 3 ? 1 : 0) : void 0,
      ignite: s.ignite !== void 0 ? s.ignite * up : void 0,
      chill: s.chill !== void 0 ? s.chill * up : void 0,
      leech: s.leech !== void 0 ? s.leech * up : void 0
    };
  }
  var pct = (m) => `${Math.round(Math.abs(m - 1) * 100)}% ${m >= 1 ? "more" : "less"}`;
  function supportSummary(s) {
    const p = [];
    if (s.more !== void 0) p.push(`${pct(s.more)} damage`);
    if (s.speed !== void 0) p.push(`${pct(s.speed)} use speed`);
    if (s.area !== void 0) p.push(`${pct(s.area)} area`);
    if (s.proj) p.push(`+${s.proj} projectiles`);
    if (s.chain) p.push(`+${s.chain} chains`);
    if (s.ignite) p.push(`ignite for ${Math.round(s.ignite * 100)}% of the hit`);
    if (s.chill) p.push(`chill ${s.chill.toFixed(1)}s`);
    if (s.leech) p.push(`${Math.round(s.leech * 100)}% life leech`);
    if (s.cdr !== void 0) p.push(`${pct(s.cdr)} cooldown recovery`);
    if (s.dur !== void 0) p.push(`${pct(s.dur)} duration`);
    return p.join(", ");
  }
  function emptyBar() {
    return Array.from({ length: BAR_SIZE }, () => ({ gem: null, sups: [] }));
  }
  function barSkillIds(bar2, exceptSlot = -1) {
    const out = [];
    bar2.forEach((s, i) => {
      if (i === exceptSlot) return;
      const d = skillDefOf(s.gem);
      if (d) out.push(d.id);
      const n2 = skillDefOf(s.inner);
      if (n2) out.push(n2.id);
    });
    return out;
  }
  function metaRefusal(inner) {
    if (!inner.tags.includes("spell")) return `${inner.name} is not a spell`;
    if (inner.tags.some((t4) => t4 === "movement" || t4 === "buff" || t4 === "persistent" || t4 === "meta" || t4 === "totem")) return `${inner.name} can't be triggered`;
    return null;
  }
  function supportRefusal(sup, skill, others = []) {
    if (sup.excludes?.some((t4) => skill.tags.includes(t4))) return `${sup.name} can't support ${skill.name}`;
    if (sup.needs.length && !sup.needs.some((t4) => skill.tags.includes(t4))) return `${sup.name} needs a ${sup.needs.join(" or ")} skill`;
    if (others.some((o) => o?.id === sup.id)) return `${skill.name} already has ${sup.name}`;
    return null;
  }
  function effectiveSlot(bar2, i, mainhand) {
    const s = bar2[i];
    if (!s) return null;
    if (s.gem || i !== WEAPON_SKILL_SLOT || !mainhand) return s;
    const d = innateFor(weaponOf(mainhand).kind);
    if (!d) return s;
    const lv = Math.max(1, Math.min(GEM_MAX_LEVEL, Math.ceil((mainhand.l || 1) / 2)));
    return { gem: { id: -1, b: SKILL_GEM_PREFIX + d.id, r: 0, l: lv, n: d.name, m: [] }, sups: [] };
  }
  function levelCost(def2, level) {
    return def2.cost * (1 + 0.06 * (level - 1));
  }
  function weaponOf(mainhand) {
    return mainhand && BASE_BY_ID.get(mainhand.b)?.weapon || UNARMED;
  }
  var r1 = (v2) => Math.round(v2 * 10) / 10;
  function isRangedWeapon(w) {
    return w.ranged === true || w.kind === "bow" || w.kind === "crossbow";
  }
  var BASIC_ARROW = { speed: 760, range: 560 };
  function basicAction(st, w) {
    const ranged = isRangedWeapon(w);
    return {
      id: "",
      name: ranged ? "Loose Arrow" : "Weapon Strike",
      kind: "basic",
      level: 1,
      tags: ranged ? ["attack", "projectile"] : ["attack", "melee"],
      ok: true,
      attack: true,
      cost: 0,
      time: st.swingTime,
      commit: 0.5,
      cd: 0,
      move: st.swingMoveMult,
      dmg: r1(st.attackDamage),
      reach: st.attackRange,
      arc: st.attackArc,
      radius: 0,
      speed: BASIC_ARROW.speed,
      range: BASIC_ARROW.range,
      count: 1,
      spread: 0,
      chain: 0,
      ignite: 0,
      chill: 0,
      leech: 0,
      kb: st.knockback,
      spirit: 0,
      innate: false,
      color: "#e8e0d0",
      supports: []
    };
  }
  function computeSkill(slot, st, w, armed, attrs) {
    const def2 = skillDefOf(slot?.gem);
    if (!slot || !def2) return basicAction(st, w);
    if (def2.kind === "meta") {
      const innerDef = skillDefOf(slot.inner);
      const inner = innerDef && !metaRefusal(innerDef) ? computeSkill({ gem: slot.inner, sups: slot.sups }, st, w, armed, attrs) : null;
      const lv2 = gemLevel(slot.gem);
      return {
        ...basicAction(st, w),
        id: def2.id,
        name: def2.name,
        kind: "meta",
        level: lv2,
        tags: [...def2.tags],
        attack: false,
        cost: 0,
        time: def2.time,
        commit: def2.commit,
        cd: def2.cd,
        move: def2.move,
        dmg: 0,
        spirit: def2.spirit ?? 0,
        innate: false,
        color: def2.color,
        inner,
        meta: { perDist: (def2.meta?.perDist ?? 1) * (1 + 0.05 * (lv2 - 1)) },
        supports: inner?.supports ?? [],
        ok: !!inner,
        why: inner ? void 0 : "Socket a spell into it"
      };
    }
    const level = gemLevel(slot.gem);
    const sdefs = slot.sups.map((s) => supportDefOf(s));
    const supports = [];
    const tags = [...def2.tags];
    let more = 1, costM = 1, speed = 1, area = 1, proj = 0, chain = 0, ignite = 0, chill = def2.chill ?? 0, leech = 0, cdr = 1, dur = 1;
    sdefs.forEach((s0, i) => {
      if (!s0) return;
      const tier = supportTier(slot.sups[i]);
      const s = supportAt(s0, tier);
      let why2 = supportRefusal(s0, def2, sdefs.slice(0, i)) ?? void 0;
      const req = SUPPORT_ATTR_REQ[tier - 1];
      if (!why2 && attrs && attrs[s0.attr] < req) why2 = `needs ${req} ${ATTR_NAME[s0.attr]}`;
      supports.push({ id: s0.id, name: `${s0.name} ${TIER_NAMES[tier - 1]}`, ok: !why2, why: why2 });
      if (why2) return;
      costM *= s.costMult;
      more *= s.more ?? 1;
      speed *= s.speed ?? 1;
      area *= s.area ?? 1;
      proj += s.proj ?? 0;
      chain += s.chain ?? 0;
      ignite += s.ignite ?? 0;
      chill = Math.max(chill, s.chill ?? 0);
      leech += s.leech ?? 0;
      cdr *= s.cdr ?? 1;
      dur *= s.dur ?? 1;
      for (const t4 of s.addTags ?? []) if (!tags.includes(t4)) tags.push(t4);
    });
    const attack = def2.tags.includes("attack");
    const wk = armed ? w.kind : null;
    let ok = true;
    let why;
    if (def2.weapons && (!wk || !def2.weapons.includes(wk))) {
      ok = false;
      why = `Requires: ${def2.weapons.join(" / ")}`;
    }
    const lv = level - 1;
    const base = attack ? st.attackDamage * (def2.dmg + 0.04 * lv) : def2.dmg * Math.pow(1.13, lv) * st.spellMult;
    const time = (attack ? st.swingTime * def2.time : def2.time / (st.castSpeed || 1)) / speed;
    const sqA = Math.sqrt(area);
    let reach = def2.reach ?? 0;
    const arc = (def2.arcDeg ?? 0) * Math.PI / 180;
    if (def2.kind === "strike") reach = st.attackRange + (def2.reach ?? 0);
    if (def2.kind === "cone") reach *= sqA;
    if (def2.kind === "slam") reach = st.attackRange * 0.5 + (def2.reach ?? 0);
    const auraScale = 1 + 0.1 * lv;
    return {
      id: def2.id,
      name: def2.name,
      kind: def2.kind,
      level,
      tags,
      ok,
      why,
      attack,
      cost: def2.cost > 0 ? Math.max(1, Math.round(levelCost(def2, level) * costM)) : 0,
      time: Math.max(0.12, time),
      commit: def2.commit,
      cd: def2.cd / cdr,
      move: def2.move,
      dmg: r1(base * more),
      reach,
      arc,
      radius: (def2.radius ?? 0) * (def2.kind === "totem" ? 1 : sqA),
      speed: def2.speed ?? 0,
      range: def2.range ?? 0,
      count: (def2.count ?? 1) + proj + (def2.kind === "chain" ? chain : 0),
      spread: ((def2.spread ?? 8) + (proj > 0 ? 6 : 0)) * Math.PI / 180,
      chain: def2.kind === "chain" ? 0 : chain,
      ignite,
      chill,
      leech,
      kb: attack ? st.knockback * (def2.kbMult ?? 1) : 240,
      buff: def2.buff ? { ...def2.buff, dur: def2.buff.dur * dur } : void 0,
      totem: def2.totem ? { ...def2.totem, dur: def2.totem.dur * dur } : void 0,
      aura: def2.aura ? { more: def2.aura.more * auraScale, move: def2.aura.move * auraScale, regen: def2.aura.regen * auraScale } : void 0,
      spirit: def2.spirit ?? 0,
      innate: !!def2.innate,
      color: def2.color,
      supports
    };
  }
  function actionLines(a) {
    const out = [];
    if (!a.ok && a.why) out.push(`! ${a.why}`);
    if (a.id === "") {
      out.push(`Damage ${a.dmg} \xB7 ${a.time.toFixed(2)}s per attack \xB7 free`);
      return out;
    }
    if (a.innate) out.push("Weapon skill (from your equipped weapon)");
    out.push(`Level ${a.level} \xB7 ${a.tags.join(", ")}`);
    if (a.kind === "aura" || a.kind === "meta") {
      out.push(`Reserves ${a.spirit} Spirit while switched on (press to toggle)`);
      if (a.aura) {
        if (a.aura.more) out.push(`${Math.round(a.aura.more * 100)}% more damage`);
        if (a.aura.move) out.push(`${Math.round(a.aura.move * 100)}% more movement speed`);
        if (a.aura.regen) out.push(`${a.aura.regen.toFixed(1)} life regenerated per second`);
      }
      if (a.meta) {
        out.push(`Rolling builds ${a.meta.perDist.toFixed(2)} energy per unit; fires the spell at 100 energy`);
        if (a.inner) out.push(`Socketed: ${a.inner.name} (level ${a.inner.level}), damage ${a.inner.dmg}, no mana cost`);
      }
      for (const s of a.supports) if (!s.ok) out.push(`! ${s.name}: ${s.why ?? "does not apply"}`);
      return out;
    }
    out.push(`Mana cost ${a.cost} \xB7 ${a.attack ? "Attack" : "Cast"} time ${a.time.toFixed(2)}s${a.cd ? ` \xB7 Cooldown ${a.cd.toFixed(1)}s` : ""}`);
    if (a.dmg > 0) {
      const n2 = a.kind === "volley" || a.kind === "bolt" ? a.count > 1 ? ` x${a.count} projectiles` : "" : a.kind === "chain" ? ` \xB7 hits up to ${a.count} enemies` : "";
      out.push(`Damage ${a.dmg} per hit${n2} (players take 40%)`);
    }
    if (a.kind === "slam") out.push(`Impact radius ${Math.round(a.radius)}`);
    if (a.kind === "cone") out.push(`Cone length ${Math.round(a.reach)}, ${Math.round(a.arc * 180 / Math.PI)}\xB0`);
    if (a.kind === "chain") out.push(`Jump range ${Math.round(a.radius)}`);
    if (a.kind === "dash") out.push(`Lunge up to ${Math.round(a.speed)}`);
    if (a.buff) out.push(`${Math.round(a.buff.more * 100)}% more damage, ${Math.round(a.buff.move * 100)}% more move speed for ${a.buff.dur.toFixed(1)}s`);
    if (a.totem) out.push(`Effigy lasts ${a.totem.dur.toFixed(1)}s, fires every ${a.totem.rate}s`);
    if (a.chain) out.push(`Projectiles chain ${a.chain} times`);
    if (a.ignite) out.push(`Ignites for ${Math.round(a.ignite * 100)}% of the hit over 3s`);
    if (a.chill) out.push(`Chills for ${a.chill.toFixed(1)}s`);
    if (a.leech) out.push(`${Math.round(a.leech * 100)}% life leech`);
    for (const s of a.supports) if (!s.ok) out.push(`! ${s.name}: ${s.why ?? "does not apply"}`);
    return out;
  }

  // src/client/gfx/gemart.ts
  function rad(g, x2, y2, r, stops) {
    const gr = g.createRadialGradient(x2, y2, 0, x2, y2, Math.max(0.01, r));
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  function glow(g, x2, y2, r, col3, a = 1) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = a;
    g.fillStyle = rad(g, x2, y2, r, [[0, col3], [1, "rgba(0,0,0,0)"]]);
    g.beginPath();
    g.arc(x2, y2, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function shade(hex, k) {
    const n2 = parseInt(hex.slice(1, 7), 16);
    let r = n2 >> 16 & 255;
    let gg = n2 >> 8 & 255;
    let b = n2 & 255;
    const t4 = k > 0 ? 255 : 0;
    const f = Math.abs(k);
    r = Math.round(r + (t4 - r) * f);
    gg = Math.round(gg + (t4 - gg) * f);
    b = Math.round(b + (t4 - b) * f);
    return `rgb(${r},${gg},${b})`;
  }
  function rgba2(hex, a) {
    const n2 = parseInt(hex.slice(1, 7), 16);
    return `rgba(${n2 >> 16 & 255},${n2 >> 8 & 255},${n2 & 255},${a})`;
  }
  function drawGlyph(g, cx, cy, r, kind2, col3) {
    g.save();
    g.translate(cx, cy);
    g.lineCap = "round";
    g.lineJoin = "round";
    const light = shade(col3, 0.75);
    g.strokeStyle = light;
    g.fillStyle = light;
    g.shadowColor = col3;
    g.shadowBlur = r * 0.5;
    const lw = Math.max(1, r * 0.13);
    g.lineWidth = lw;
    switch (kind2) {
      case "basic": {
        g.rotate(-Math.PI / 4);
        g.beginPath();
        g.moveTo(0, -r * 0.9);
        g.lineTo(r * 0.14, -r * 0.65);
        g.lineTo(r * 0.12, r * 0.35);
        g.lineTo(-r * 0.12, r * 0.35);
        g.lineTo(-r * 0.14, -r * 0.65);
        g.closePath();
        g.fill();
        g.fillRect(-r * 0.36, r * 0.35, r * 0.72, r * 0.12);
        g.fillRect(-r * 0.07, r * 0.47, r * 0.14, r * 0.4);
        break;
      }
      case "strike": {
        g.beginPath();
        g.arc(-r * 0.25, r * 0.25, r * 0.95, -Math.PI * 0.62, Math.PI * 0.12);
        g.arc(-r * 0.45, r * 0.45, r * 0.95, Math.PI * 0.08, -Math.PI * 0.55, true);
        g.closePath();
        g.fill();
        g.lineWidth = lw * 0.6;
        g.beginPath();
        g.moveTo(-r * 0.75, r * 0.75);
        g.lineTo(-r * 0.2, r * 0.2);
        g.stroke();
        break;
      }
      case "slam": {
        g.beginPath();
        g.roundRect(-r * 0.42, -r * 0.85, r * 0.84, r * 0.55, r * 0.12);
        g.fill();
        g.fillRect(-r * 0.08, -r * 0.3, r * 0.16, r * 0.45);
        g.beginPath();
        g.moveTo(-r * 0.9, r * 0.45);
        g.lineTo(-r * 0.4, r * 0.32);
        g.lineTo(-r * 0.15, r * 0.6);
        g.lineTo(r * 0.15, r * 0.3);
        g.lineTo(r * 0.45, r * 0.62);
        g.lineTo(r * 0.9, r * 0.42);
        g.stroke();
        break;
      }
      case "volley": {
        for (const a of [-0.45, 0, 0.45]) {
          g.save();
          g.rotate(a - Math.PI / 4);
          g.beginPath();
          g.moveTo(0, -r * 0.92);
          g.lineTo(r * 0.12, -r * 0.6);
          g.lineTo(r * 0.04, r * 0.75);
          g.lineTo(-r * 0.04, r * 0.75);
          g.lineTo(-r * 0.12, -r * 0.6);
          g.closePath();
          g.fill();
          g.restore();
        }
        break;
      }
      case "bolt": {
        g.rotate(-Math.PI / 4);
        g.beginPath();
        g.moveTo(0, -r * 0.55);
        g.quadraticCurveTo(r * 0.5, r * 0.2, 0, r * 0.95);
        g.quadraticCurveTo(-r * 0.5, r * 0.2, 0, -r * 0.55);
        g.globalAlpha = 0.55;
        g.fill();
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(0, -r * 0.42, r * 0.36, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "cone": {
        g.lineWidth = lw * 0.9;
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI * 0.85 + i * 0.32;
          g.beginPath();
          g.moveTo(-r * 0.7, r * 0.7);
          const ex = -r * 0.7 + Math.cos(a + Math.PI / 2.2) * r * 1.5;
          const ey = r * 0.7 + Math.sin(a + Math.PI / 2.2) * r * 1.5;
          g.quadraticCurveTo(-r * 0.7 + (ex + r * 0.7) * 0.5 + r * 0.15, r * 0.7 + (ey - r * 0.7) * 0.5 + r * 0.1, ex, ey);
          g.stroke();
        }
        for (const [x2, y2] of [[0.35, -0.45], [0.55, 0.05], [0, -0.7]]) {
          g.beginPath();
          g.arc(x2 * r, y2 * r, r * 0.08, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case "chain": {
        g.beginPath();
        g.moveTo(-r * 0.85, -r * 0.6);
        g.lineTo(-r * 0.25, -r * 0.2);
        g.lineTo(-r * 0.4, r * 0.1);
        g.lineTo(r * 0.2, r * 0.35);
        g.lineTo(r * 0.05, r * 0.6);
        g.lineTo(r * 0.85, r * 0.85);
        g.moveTo(-r * 0.25, -r * 0.2);
        g.lineTo(r * 0.35, -r * 0.4);
        g.lineTo(r * 0.8, -r * 0.15);
        g.stroke();
        for (const [x2, y2] of [[-0.85, -0.6], [0.85, 0.85], [0.8, -0.15]]) {
          g.beginPath();
          g.arc(x2 * r, y2 * r, r * 0.13, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case "dash": {
        g.beginPath();
        g.moveTo(r * 0.85, -r * 0.1);
        g.quadraticCurveTo(r * 0.2, -r * 0.55, -r * 0.6, -r * 0.4);
        g.quadraticCurveTo(r * 0.1, -r * 0.2, r * 0.85, -r * 0.1);
        g.fill();
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(-r * 0.85 + i * r * 0.15, r * (0.05 + i * 0.27));
          g.lineTo(r * (0.5 - i * 0.12), r * (0.05 + i * 0.27));
          g.globalAlpha = 1 - i * 0.25;
          g.stroke();
        }
        g.globalAlpha = 1;
        break;
      }
      case "buff": {
        g.lineWidth = lw * 0.7;
        g.beginPath();
        g.arc(0, 0, r * 0.85, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(0, -r * 0.65);
        g.bezierCurveTo(r * 0.55, -r * 0.1, r * 0.45, r * 0.55, 0, r * 0.6);
        g.bezierCurveTo(-r * 0.45, r * 0.55, -r * 0.5, 0, -r * 0.1, -r * 0.25);
        g.bezierCurveTo(-r * 0.05, 0, r * 0.05, -r * 0.3, 0, -r * 0.65);
        g.fill();
        break;
      }
      case "totem": {
        g.beginPath();
        g.roundRect(-r * 0.22, -r * 0.3, r * 0.44, r * 1.15, r * 0.06);
        g.fill();
        g.fillRect(-r * 0.45, r * 0.7, r * 0.9, r * 0.15);
        g.beginPath();
        g.moveTo(0, -r * 0.95);
        g.quadraticCurveTo(r * 0.4, -r * 0.55, 0, -r * 0.38);
        g.quadraticCurveTo(-r * 0.4, -r * 0.55, 0, -r * 0.95);
        g.fill();
        break;
      }
      case "aura": {
        g.lineWidth = lw * 0.75;
        for (let i = 0; i < 3; i++) {
          const rr3 = r * (0.35 + i * 0.27);
          g.globalAlpha = 1 - i * 0.22;
          g.beginPath();
          g.arc(0, 0, rr3, i * 0.9, i * 0.9 + Math.PI * 1.55);
          g.stroke();
        }
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(0, 0, r * 0.16, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "meta": {
        g.lineWidth = lw * 0.7;
        g.beginPath();
        g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
          g.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
        }
        g.closePath();
        g.stroke();
        g.beginPath();
        g.arc(0, 0, r * 0.22, 0, Math.PI * 2);
        g.fill();
        break;
      }
    }
    g.restore();
  }
  var iconCache = /* @__PURE__ */ new Map();
  function skillIcon(id, size2) {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const key = `${id}|${size2}|${dpr}`;
    const hit = iconCache.get(key);
    if (hit) return hit;
    const def2 = SKILL_GEM_BY_ID.get(id);
    const col3 = def2 ? ATTR_COLOR[def2.attr] : "#c8b890";
    const cv = document.createElement("canvas");
    cv.width = cv.height = Math.round(size2 * dpr);
    cv.style.width = cv.style.height = size2 + "px";
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    const s = size2;
    const cr = s * 0.14;
    g.beginPath();
    g.roundRect(0, 0, s, s, cr);
    g.fillStyle = rad(g, s * 0.5, s * 0.42, s * 0.8, [[0, shade(col3, -0.35)], [0.65, shade(col3, -0.75)], [1, "#06060a"]]);
    g.fill();
    g.save();
    g.clip();
    glow(g, s * 0.5, s * 0.45, s * 0.55, rgba2(col3, 0.55));
    g.strokeStyle = rgba2("#ffffff", 0.06);
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      g.beginPath();
      g.moveTo(s / 2, s / 2);
      g.lineTo(s / 2 + Math.cos(a) * s, s / 2 + Math.sin(a) * s);
      g.stroke();
    }
    g.restore();
    drawGlyph(g, s / 2, s / 2, s * 0.34, def2 ? def2.kind : "basic", col3);
    g.beginPath();
    g.roundRect(0.75, 0.75, s - 1.5, s - 1.5, cr);
    const bv = g.createLinearGradient(0, 0, 0, s);
    bv.addColorStop(0, rgba2("#ffffff", 0.35));
    bv.addColorStop(0.5, rgba2("#ffffff", 0.05));
    bv.addColorStop(1, rgba2("#000000", 0.5));
    g.strokeStyle = bv;
    g.lineWidth = 1.5;
    g.stroke();
    iconCache.set(key, cv);
    return cv;
  }
  function facetGem(g, cx, cy, r, col3, sides) {
    glow(g, cx, cy, r * 1.7, rgba2(col3, 0.45));
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + i / sides * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.05]);
    }
    g.beginPath();
    for (const [x2, y2] of pts) g.lineTo(x2, y2);
    g.closePath();
    g.fillStyle = rad(g, cx - r * 0.3, cy - r * 0.45, r * 1.6, [[0, "#ffffff"], [0.2, shade(col3, 0.3)], [0.6, col3], [1, shade(col3, -0.7)]]);
    g.fill();
    g.strokeStyle = rgba2("#000000", 0.6);
    g.lineWidth = Math.max(1, r * 0.06);
    g.stroke();
    const ir = r * 0.5;
    g.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + i / sides * Math.PI * 2;
      g.lineTo(cx + Math.cos(a) * ir, cy + Math.sin(a) * ir * 1.05);
    }
    g.closePath();
    g.fillStyle = rgba2("#ffffff", 0.12);
    g.fill();
    g.strokeStyle = rgba2("#ffffff", 0.35);
    g.lineWidth = Math.max(0.75, r * 0.03);
    g.stroke();
    g.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + i / sides * Math.PI * 2;
      g.moveTo(cx + Math.cos(a) * ir, cy + Math.sin(a) * ir * 1.05);
      g.lineTo(pts[i][0], pts[i][1]);
    }
    g.strokeStyle = rgba2("#ffffff", 0.18);
    g.stroke();
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = rad(g, cx - r * 0.35, cy - r * 0.45, r * 0.35, [[0, "rgba(255,255,255,0.9)"], [1, "rgba(255,255,255,0)"]]);
    g.beginPath();
    g.arc(cx - r * 0.35, cy - r * 0.45, r * 0.35, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function supportGem(g, cx, cy, r, col3, tier, accent) {
    glow(g, cx, cy, r * 1.6, rgba2(col3, 0.35));
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = rad(g, cx - r * 0.35, cy - r * 0.4, r * 1.5, [[0, "#ffffff"], [0.18, shade(col3, 0.25)], [0.6, col3], [1, shade(col3, -0.75)]]);
    g.fill();
    g.strokeStyle = rgba2("#000000", 0.6);
    g.lineWidth = Math.max(1, r * 0.07);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
    g.strokeStyle = rgba2(accent.startsWith("#") ? accent : "#ffffff", 0.75);
    g.lineWidth = Math.max(1, r * 0.1);
    g.stroke();
    for (let i = 0; i < tier; i++) {
      const a = Math.PI / 2 + (i - (tier - 1) / 2) * 0.5;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82, r * 0.11, 0, Math.PI * 2);
      g.fillStyle = "#fff6d8";
      g.fill();
    }
  }
  function roughCrystal(g, cx, cy, r, tint) {
    glow(g, cx, cy, r * 1.5, rgba2(tint, 0.3));
    const shards = [
      [-0.45, 0.25, 0.32, -0.35],
      [0.4, 0.3, 0.3, 0.3],
      [0, 0.4, 0.42, 0]
    ];
    for (const [dx, dy, w, lean] of shards) {
      const bx = cx + dx * r;
      const by = cy + dy * r + r * 0.35;
      const h = r * (dx === 0 ? 1.55 : 1.05);
      g.save();
      g.translate(bx, by);
      g.rotate(lean);
      g.beginPath();
      g.moveTo(-w * r * 0.5, 0);
      g.lineTo(-w * r * 0.5, -h * 0.72);
      g.lineTo(0, -h);
      g.lineTo(w * r * 0.5, -h * 0.72);
      g.lineTo(w * r * 0.5, 0);
      g.closePath();
      const lg = g.createLinearGradient(-w * r * 0.5, 0, w * r * 0.5, 0);
      lg.addColorStop(0, shade(tint, -0.55));
      lg.addColorStop(0.45, shade(tint, 0.35));
      lg.addColorStop(0.55, tint);
      lg.addColorStop(1, shade(tint, -0.65));
      g.fillStyle = lg;
      g.fill();
      g.strokeStyle = rgba2("#000000", 0.55);
      g.lineWidth = Math.max(1, r * 0.05);
      g.stroke();
      g.beginPath();
      g.moveTo(0, -h);
      g.lineTo(0, 0);
      g.strokeStyle = rgba2("#ffffff", 0.25);
      g.lineWidth = Math.max(0.75, r * 0.03);
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.ellipse(cx, cy + r * 0.72, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
    g.fillStyle = rad(g, cx, cy + r * 0.65, r, [[0, "#5a5450"], [1, "#1a1816"]]);
    g.fill();
  }
  function gemDrawer(item) {
    if (isSkillGem(item))
      return (g, W3, H3, it) => {
        const def2 = skillDefOf(it);
        const col3 = gemColor(it);
        const r = Math.min(W3, H3) * 0.4;
        facetGem(g, W3 / 2, H3 / 2, r, col3, def2.kind === "aura" || def2.kind === "meta" ? 6 : 8);
        drawGlyph(g, W3 / 2, H3 / 2, r * 0.42, def2.kind, col3);
      };
    if (isSupportGem(item))
      return (g, W3, H3, it) => {
        const d = supportDefOf(it);
        supportGem(g, W3 / 2, H3 / 2, Math.min(W3, H3) * 0.36, gemColor(it), supportTier(it), d.color ?? "#ffffff");
      };
    if (isRough(item))
      return (g, W3, H3) => roughCrystal(g, W3 / 2, H3 / 2, Math.min(W3, H3) * 0.36, item.b === "rough_support" ? "#c8d8c8" : item.b === "rough_spirit" ? "#d8c8f0" : ROUGH_COLOR);
    return null;
  }
  function gemCanvas(item, size2) {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cv = document.createElement("canvas");
    cv.width = cv.height = Math.round(size2 * dpr);
    cv.style.width = cv.style.height = size2 + "px";
    const g = cv.getContext("2d");
    g.scale(dpr, dpr);
    gemDrawer(item)?.(g, size2, size2, item);
    return cv;
  }

  // src/client/keybinds.ts
  var SKILL_SLOTS = 16;
  var FLASK_SLOTS = 5;
  var CHARM_SLOTS = 3;
  var ACTIONS = [
    { id: "moveUp", label: "Move up", group: "move", held: true },
    { id: "moveDown", label: "Move down", group: "move", held: true },
    { id: "moveLeft", label: "Move left", group: "move", held: true },
    { id: "moveRight", label: "Move right", group: "move", held: true },
    { id: "dodge", label: "Dodge roll", group: "combat", held: true },
    { id: "attackInPlace", label: "Attack in place (hold)", group: "combat", held: true },
    { id: "pickup", label: "Pick up / interact (Shift: equip)", group: "combat" },
    { id: "weaponSwap", label: "Weapon swap", group: "combat" },
    ...Array.from({ length: SKILL_SLOTS }, (_, i) => ({ id: `skill${i}`, label: i < 8 ? `Skill ${i + 1}` : `Skill ${i + 1} (second bar)`, group: "skills", held: true })),
    ...Array.from({ length: FLASK_SLOTS }, (_, i) => ({ id: `flask${i}`, label: `Flask ${i + 1}`, group: "flasks" })),
    ...Array.from({ length: CHARM_SLOTS }, (_, i) => ({ id: `charm${i}`, label: `Charm ${i + 1}`, group: "flasks" })),
    { id: "inventory", label: "Inventory", group: "panels" },
    { id: "character", label: "Character sheet", group: "panels" },
    { id: "tree", label: "Passive skill tree", group: "panels" },
    { id: "skills", label: "Skills / gems", group: "panels" },
    { id: "map", label: "World map", group: "panels" },
    { id: "mapOverlay", label: "Map overlay (toggle)", group: "panels" },
    { id: "social", label: "Social", group: "panels" },
    { id: "scoreboard", label: "Scoreboard (hold)", group: "panels", held: true },
    { id: "options", label: "Options", group: "panels" },
    { id: "chat", label: "Chat", group: "interface" },
    { id: "showLabels", label: "Show item labels (hold)", group: "interface", held: true },
    { id: "toggleLabels", label: "Toggle item labels", group: "interface" },
    { id: "perfStats", label: "Toggle FPS / ping", group: "interface" }
  ];
  var ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));
  function poe2Binds() {
    const b = {
      moveUp: ["KeyW", "ArrowUp"],
      moveDown: ["KeyS", "ArrowDown"],
      moveLeft: ["KeyA", "ArrowLeft"],
      moveRight: ["KeyD", "ArrowRight"],
      dodge: ["Space", null],
      attackInPlace: ["ShiftLeft", null],
      pickup: ["KeyF", null],
      weaponSwap: ["KeyX", null],
      inventory: ["KeyI", null],
      character: ["KeyC", null],
      tree: ["KeyP", null],
      skills: ["KeyG", null],
      map: ["KeyM", null],
      mapOverlay: ["Tab", null],
      social: ["KeyJ", null],
      scoreboard: ["KeyL", null],
      options: ["KeyO", null],
      chat: ["Enter", null],
      showLabels: ["AltLeft", null],
      toggleLabels: ["KeyZ", null],
      perfStats: ["F1", null]
    };
    const main = ["Mouse0", "Mouse1", "Mouse2", "KeyQ", "KeyE", "KeyR", "KeyT", "KeyB"];
    const alt8 = [null, null, null, null, null, null, null, "Mouse3"];
    for (let i = 0; i < 8; i++) {
      b[`skill${i}`] = [main[i], alt8[i]];
      b[`skill${i + 8}`] = [main[i] === "KeyT" ? "Ctrl+KeyV" : "Ctrl+" + main[i], alt8[i] ? "Ctrl+" + alt8[i] : null];
    }
    for (let i = 0; i < FLASK_SLOTS; i++) b[`flask${i}`] = [`Digit${i + 1}`, null];
    for (let i = 0; i < CHARM_SLOTS; i++) b[`charm${i}`] = [null, null];
    return b;
  }
  function classicBinds() {
    const b = poe2Binds();
    Object.assign(b, {
      skills: ["KeyK", null],
      mapOverlay: [null, null],
      scoreboard: ["Tab", null],
      social: [null, null],
      character: ["KeyC", null]
    });
    const main = ["Mouse0", "Mouse1", "Mouse2", "KeyQ", "KeyE", "KeyR", "KeyT", "KeyG"];
    for (let i = 0; i < 8; i++) {
      b[`skill${i}`] = [main[i], null];
      b[`skill${i + 8}`] = [main[i] === "KeyT" ? "Ctrl+KeyV" : "Ctrl+" + main[i], null];
    }
    return b;
  }
  function presetBinds(id) {
    const b = id === "classic" ? classicBinds() : poe2Binds();
    for (const a of ACTIONS) if (!b[a.id]) b[a.id] = [null, null];
    return b;
  }
  var DEFAULT_PRESET = "poe2";
  function defaultBinds() {
    return presetBinds(DEFAULT_PRESET);
  }
  var STORAGE_KEY2 = "hns-keybinds";
  var VERSION = 2;
  function load2() {
    const def2 = defaultBinds();
    try {
      const s = localStorage.getItem(STORAGE_KEY2);
      if (!s) return def2;
      const raw = JSON.parse(s);
      if (!raw || raw.v !== VERSION || !raw.binds) return def2;
      for (const a of ACTIONS) {
        const p = raw.binds[a.id];
        if (!Array.isArray(p) || p.length !== 2) continue;
        const ok = (x2) => x2 === null || typeof x2 === "string" && x2.length < 40 && !isReserved(x2);
        if (ok(p[0]) && ok(p[1])) def2[a.id] = [p[0], p[1]];
      }
    } catch {
    }
    return def2;
  }
  var binds = load2();
  var listeners3 = /* @__PURE__ */ new Set();
  function onBindsChange(fn) {
    listeners3.add(fn);
    return () => listeners3.delete(fn);
  }
  var MOD_ORDER = ["Ctrl", "Shift", "Alt"];
  function parseBind(b) {
    let mods = "";
    let rest = b;
    let n2 = 0;
    for (const m of MOD_ORDER) {
      if (rest.startsWith(m + "+")) {
        mods += m + "+";
        rest = rest.slice(m.length + 1);
        n2++;
      }
    }
    return { mods, code: rest, n: n2 };
  }
  function getBinds(id) {
    return binds[id] ?? [null, null];
  }
  var RESERVED = /* @__PURE__ */ new Set([
    "Ctrl+KeyT",
    "Ctrl+KeyW",
    "Ctrl+KeyN",
    "Ctrl+Tab",
    "Ctrl+Shift+KeyT",
    "Ctrl+Shift+KeyW",
    "Ctrl+Shift+KeyN",
    "Ctrl+Shift+Tab",
    "Ctrl+Shift+KeyQ",
    "Alt+Tab",
    "Alt+F4",
    "Escape"
  ]);
  function isReserved(b) {
    return RESERVED.has(b) || parseBind(b).code === "Escape";
  }
  var comboIndex = /* @__PURE__ */ new Map();
  function rebuildIndex() {
    comboIndex = /* @__PURE__ */ new Map();
    for (const p of Object.values(binds)) {
      for (const b of p) {
        if (!b) continue;
        const { mods, code } = parseBind(b);
        let s = comboIndex.get(code);
        if (!s) comboIndex.set(code, s = /* @__PURE__ */ new Set());
        s.add(mods);
      }
    }
  }
  rebuildIndex();
  var MOUSE_LABELS = ["LMB", "MMB", "RMB", "Mouse4", "Mouse5"];
  var SPECIAL = {
    Space: "Space",
    Tab: "Tab",
    Enter: "Enter",
    Backspace: "Bksp",
    ShiftLeft: "Shift",
    ShiftRight: "RShift",
    ControlLeft: "Ctrl",
    ControlRight: "RCtrl",
    AltLeft: "Alt",
    AltRight: "RAlt",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    CapsLock: "Caps",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    PageUp: "PgUp",
    PageDown: "PgDn",
    Delete: "Del",
    Insert: "Ins"
  };
  function bindLabel(b) {
    if (!b) return "";
    const { mods, code } = parseBind(b);
    let k;
    if (code.startsWith("Mouse")) k = MOUSE_LABELS[Number(code.slice(5))] ?? code;
    else if (SPECIAL[code]) k = SPECIAL[code];
    else if (code.startsWith("Key")) k = code.slice(3);
    else if (code.startsWith("Digit")) k = code.slice(5);
    else if (code.startsWith("Numpad")) k = "Num" + code.slice(6);
    else k = code;
    return mods + k;
  }
  function actionLabel(id) {
    const p = getBinds(id);
    return bindLabel(p[0] ?? p[1]) || "-";
  }
  function skillSlotLabel(i) {
    return actionLabel(`skill${i}`);
  }

  // src/client/input.ts
  var input = {
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
    dodge: false,
    scoreboard: false,
    shift: false,
    skills: new Array(SKILL_SLOTS).fill(false),
    attackInPlace: false,
    showLabels: false,
    mouseX: 0,
    mouseY: 0
  };

  // src/client/options.ts
  var panels = [];
  function registerPanel(p) {
    panels.push(p);
  }
  var BASE_RARITY = [...RARITY_COLORS];

  // src/client/skillbar.ts
  var S2 = {
    bar: emptyBar(),
    on: /* @__PURE__ */ new Set(),
    cdEnd: new Array(BAR_SIZE).fill(0),
    cdDur: new Array(BAR_SIZE).fill(1),
    en: new Array(BAR_SIZE).fill(0),
    mp: 0,
    stats: defaultStats(),
    mainhand: null,
    attrs: { str: 0, dex: 0, int: 0 },
    inv: [],
    lastSnap: 0,
    alive: false,
    acts: []
  };
  var send = () => {
  };
  var actsDirty = true;
  var now2 = () => performance.now();
  function slotOf(i) {
    return effectiveSlot(S2.bar, i, S2.mainhand);
  }
  function acts() {
    if (!actsDirty) return S2.acts;
    const w = weaponOf(S2.mainhand);
    S2.acts = Array.from({ length: BAR_SIZE }, (_, i) => {
      const s = slotOf(i);
      if (!s?.gem) return i === 0 ? computeSkill(null, S2.stats, w, !!S2.mainhand, S2.attrs) : null;
      return computeSkill(s, S2.stats, w, !!S2.mainhand, S2.attrs);
    });
    actsDirty = false;
    return S2.acts;
  }
  function manaFrac() {
    return S2.stats.maxMana > 0 ? Math.max(0, Math.min(1, S2.mp / S2.stats.maxMana)) : 0;
  }
  function manaNow() {
    return Math.floor(S2.mp);
  }
  var CSS = `
#skbar { position: fixed; right: 14px; bottom: 12px; display: none; flex-direction: column; gap: 4px; z-index: 8; user-select: none;
  font-family: var(--mono); padding: 6px; background: linear-gradient(180deg, rgba(20,17,22,0.86), rgba(8,7,9,0.92));
  border: 1px solid #050405; box-shadow: inset 0 0 0 1px #3c3842, 0 6px 18px rgba(0,0,0,0.6); border-radius: 6px; }
#skbar .row { display: flex; gap: 4px; }
#skbar .row.sec { opacity: 0.92; }
.sk-slot { position: relative; width: var(--sz); height: var(--sz); border-radius: 6px; background: radial-gradient(circle at 50% 40%, #1b181e, #08070a);
  box-shadow: inset 0 0 0 1px #2c2830, inset 0 0 0 2px #050405; cursor: pointer; overflow: hidden; }
.sk-slot canvas { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 6px; }
.sk-slot .cd { position: absolute; inset: 0; border-radius: 6px; pointer-events: none; }
.sk-slot .cdt { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: bold 13px var(--mono);
  color: #fff; text-shadow: 0 0 3px #000, 0 0 6px #000; pointer-events: none; }
.sk-slot .key { position: absolute; left: 2px; bottom: 1px; font-size: 9px; font-weight: bold; color: #e8dcc4; text-shadow: 0 0 2px #000, 0 0 3px #000;
  pointer-events: none; max-width: calc(100% - 4px); overflow: hidden; white-space: nowrap; }
.sk-slot .en { position: absolute; left: 3px; right: 3px; bottom: 0; height: 3px; border-radius: 2px; background: rgba(0,0,0,0.6); pointer-events: none; }
.sk-slot .en i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, #6cf0c0, #e8fff4); box-shadow: 0 0 6px #6cf0c0; }
.sk-slot.nomana canvas { filter: grayscale(1) brightness(0.45); }
.sk-slot.nomana::after { content: ""; position: absolute; inset: 0; border-radius: 6px; background: rgba(30,50,140,0.28); pointer-events: none; }
.sk-slot.bad canvas { filter: grayscale(1) brightness(0.35); }
.sk-slot.on { box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px var(--ac), 0 0 10px var(--ac); }
.sk-slot.on canvas { animation: skpulse 1.6s ease-in-out infinite; }
@keyframes skpulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.35); } }
.sk-slot.held { transform: scale(0.94); box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px #f0d8a0; }
.sk-slot.empty { opacity: 0.55; }
.sk-slot.innate canvas { opacity: 0.9; }
.sk-slot.innate::before { content: "W"; position: absolute; right: 2px; top: 1px; font-size: 8px; color: #e0c890; z-index: 2; text-shadow: 0 0 2px #000; }

#sk-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); display: none; z-index: 11; color: var(--ink);
  font-size: 12px; padding: 12px 14px; max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); overflow: auto; box-sizing: border-box; user-select: none; }
#sk-panel .hd { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; border-bottom: 1px solid #2c2830; padding-bottom: 4px; margin-bottom: 6px; }
#sk-panel .hd b { color: #c8a060; letter-spacing: 3px; font-size: 14px; }
#sk-panel .hd span { color: #a89c84; }
#sk-panel .hint { color: #8a7f6c; margin-bottom: 8px; min-height: 15px; }
#sk-panel .hint b { color: #f0d8a0; }
#sk-panel .cols { display: flex; gap: 16px; flex-wrap: wrap; }
#sk-panel .bar { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; }
#sk-panel .srow { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 4px; background: rgba(255,255,255,0.02); min-width: 300px; }
#sk-panel .srow.focus { background: rgba(240,200,120,0.08); box-shadow: inset 0 0 0 1px #6a5430; }
#sk-panel .k { width: 44px; color: #d8c08a; font-size: 10px; text-align: right; white-space: nowrap; overflow: hidden; }
#sk-panel .gcell { position: relative; width: 40px; height: 40px; flex: none; border-radius: 6px; background: #09080a; box-shadow: inset 0 0 0 1px #2c2830; cursor: pointer; }
#sk-panel .gcell canvas { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 6px; }
#sk-panel .gcell.target { box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px #f0d070, 0 0 8px rgba(240,208,112,0.6); }
#sk-panel .nm { flex: 1; min-width: 70px; line-height: 1.25; }
#sk-panel .nm i { display: block; font-style: normal; color: #7a705e; font-size: 10px; }
#sk-panel .socks { display: flex; gap: 3px; }
#sk-panel .sock { position: relative; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #16141a, #050405);
  box-shadow: inset 0 0 0 1px #3c3842; cursor: pointer; }
#sk-panel .sock canvas { position: absolute; inset: -2px; width: 26px !important; height: 26px !important; }
#sk-panel .sock.locked { opacity: 0.18; cursor: default; }
#sk-panel .sock.off canvas { filter: grayscale(1) brightness(0.6); }
#sk-panel .sock.off::after { content: "!"; position: absolute; right: -2px; top: -4px; color: #ff6a5a; font-weight: bold; font-size: 11px; text-shadow: 0 0 2px #000; }
#sk-panel .sock.target { box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px #f0d070, 0 0 6px rgba(240,208,112,0.7); }
#sk-panel .inner { margin-left: 4px; width: 30px; height: 30px; border-radius: 50%; }
#sk-panel .inner canvas { border-radius: 50%; }
#sk-panel .bag h4, #sk-panel .bar-h { margin: 2px 0 6px; color: #c8a060; letter-spacing: 2px; font-size: 11px; text-transform: uppercase; }
#sk-panel .bag { min-width: 236px; max-width: 280px; }
#sk-panel .bgrid { display: grid; grid-template-columns: repeat(5, 44px); gap: 5px; }
#sk-panel .bgrid .gcell { width: 44px; height: 44px; }
#sk-panel .bgrid .gcell.sel { box-shadow: inset 0 0 0 1px #050405, 0 0 0 2px #f0d8a0, 0 0 10px rgba(240,216,160,0.7); }
#sk-panel .lv { position: absolute; right: 3px; bottom: 1px; font-size: 9px; font-weight: bold; color: #f0e2c4; text-shadow: 0 0 2px #000; pointer-events: none; }
#sk-panel .cut { margin-top: 10px; border-top: 1px solid #241f26; padding-top: 6px; }
#sk-panel .cut button { display: block; width: 100%; margin: 3px 0; padding: 4px 6px; text-align: left; font: 11px var(--mono); color: #e8dcc4; cursor: pointer;
  background: linear-gradient(180deg, #221c24, #121014); border: 1px solid #050405; box-shadow: inset 0 0 0 1px #3c3842; border-radius: 3px; }
#sk-panel .cut button:hover:not(:disabled) { box-shadow: inset 0 0 0 1px #c8a060; }
#sk-panel .cut button:disabled { color: #5a5248; cursor: default; }
#sk-panel .cut button em { font-style: normal; float: right; color: #7a705e; }
#sk-panel .empty-note { color: #5a5248; }
`;
  var barEl = null;
  var barDirty = true;
  var slotEls = [];
  var tipEl = () => document.getElementById("tooltip");
  var tipOwner = null;
  var esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function showTip(owner, html, x2, y2) {
    const t4 = tipEl();
    if (!t4) return;
    tipOwner = owner;
    t4.innerHTML = html;
    t4.style.display = "block";
    const w = t4.offsetWidth;
    const h = t4.offsetHeight;
    t4.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x2 + 16)) + "px";
    t4.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y2 - h - 12 > 8 ? y2 - h - 12 : y2 + 16)) + "px";
  }
  function hideTip(owner) {
    if (owner && tipOwner !== owner) return;
    const t4 = tipEl();
    if (t4 && tipOwner) t4.style.display = "none";
    tipOwner = null;
  }
  function lineHtml(l) {
    if (l.startsWith("! ")) return `<span class="bad">${esc(l.slice(2))}</span>`;
    return esc(l);
  }
  function slotTipHtml(i) {
    const s = slotOf(i);
    const a = acts()[i];
    const key = skillSlotLabel(i);
    if (!a) return `<div class="tt-name" style="color:#8a7f6c">Empty slot</div><div class="tt-sub">Key ${esc(key)} \xB7 open the Skills panel (K) to socket a gem</div>`;
    const def2 = skillDefOf(s?.gem);
    const col3 = def2 ? ATTR_COLOR[def2.attr] : "#e8e0d0";
    let h = `<div class="tt-name" style="color:${col3}">${esc(a.name)}</div><div class="tt-sub">Key ${esc(key)}${def2 ? ` \xB7 ${ATTR_NAME[def2.attr]}` : ""}</div>`;
    h += `<div class="tt-sec">${actionLines(a).map(lineHtml).join("<br>")}</div>`;
    const sups = a.supports;
    if (sups.length) h += `<div class="tt-sec tt-mods">${sups.map((x2) => x2.ok ? esc(x2.name) : `<span class="bad">${esc(x2.name)}</span>`).join("<br>")}</div>`;
    if (def2?.desc) h += `<div class="tt-hint">${esc(def2.desc)}</div>`;
    return h;
  }
  function gemTipHtml(it, hint = "") {
    const col3 = gemColor(it);
    let h = `<div class="tt-name" style="color:${col3}">${esc(gemDisplayName(it))}</div>`;
    const lines = gemLines(it, S2.attrs);
    if (lines.length) h += `<div class="tt-sec">${lines.map(lineHtml).join("<br>")}</div>`;
    const sd = supportDefOf(it);
    if (sd?.desc && !lines.includes(sd.desc)) h += `<div class="tt-hint">${esc(sd.desc)}</div>`;
    if (hint) h += `<div class="tt-hint">${esc(hint)}</div>`;
    return h;
  }
  function ensureDom() {
    if (barEl) return;
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    barEl = document.createElement("div");
    barEl.id = "skbar";
    const rows = [document.createElement("div"), document.createElement("div")];
    rows[0].className = "row sec";
    rows[1].className = "row";
    barEl.append(rows[0], rows[1]);
    for (let i = 0; i < BAR_SIZE; i++) {
      const el = document.createElement("div");
      el.className = "sk-slot";
      const cd = document.createElement("div");
      cd.className = "cd";
      const cdt = document.createElement("div");
      cdt.className = "cdt";
      const key = document.createElement("div");
      key.className = "key";
      const en = document.createElement("div");
      en.className = "en";
      const enFill = document.createElement("i");
      en.appendChild(enFill);
      el.append(cd, cdt, en, key);
      el.addEventListener("mouseenter", (e) => showTip("bar" + i, slotTipHtml(i), e.clientX, e.clientY));
      el.addEventListener("mousemove", (e) => showTip("bar" + i, slotTipHtml(i), e.clientX, e.clientY));
      el.addEventListener("mouseleave", () => hideTip("bar" + i));
      el.addEventListener("mousedown", (e) => e.stopPropagation());
      el.addEventListener("click", () => {
        focusSlot = i;
        togglePanel(true);
      });
      (i < BAR_MAIN ? rows[1] : rows[0]).appendChild(el);
      slotEls.push({ el, cd, cdt, key, en, enFill, icon: "?" });
    }
    document.body.appendChild(barEl);
    panelEl = document.createElement("div");
    panelEl.id = "sk-panel";
    panelEl.className = "frame";
    panelEl.addEventListener("contextmenu", (e) => e.preventDefault());
    panelEl.addEventListener("mousedown", (e) => e.stopPropagation());
    document.body.appendChild(panelEl);
    onBindsChange(() => {
      barDirty = true;
      panelDirty = true;
    });
    window.addEventListener("resize", () => barDirty = true);
  }
  function slotSize() {
    return Math.max(30, Math.min(46, Math.floor((window.innerWidth * 0.3 - 16) / 8 - 4)));
  }
  function rebuildBar() {
    if (!barEl) return;
    barEl.style.setProperty("--sz", slotSize() + "px");
    const sz = slotSize();
    for (let i = 0; i < BAR_SIZE; i++) {
      const se = slotEls[i];
      const s = slotOf(i);
      const def2 = skillDefOf(s?.gem);
      const innate = !S2.bar[i]?.gem && !!def2;
      const id = def2 ? def2.id : i === 0 ? "" : "-";
      const iconKey = `${id}|${sz}`;
      if (se.icon !== iconKey) {
        se.el.querySelector("canvas")?.remove();
        if (id !== "-") se.el.prepend(skillIcon(id, sz));
        se.icon = iconKey;
      }
      se.el.classList.toggle("empty", id === "-");
      se.el.classList.toggle("innate", innate);
      se.el.style.setProperty("--ac", def2 ? ATTR_COLOR[def2.attr] : "#c8a060");
      se.key.textContent = skillSlotLabel(i);
      se.en.style.display = def2?.kind === "meta" ? "block" : "none";
    }
    barDirty = false;
  }
  function updateBar() {
    if (!barEl) return;
    const show = now2() - S2.lastSnap < 1500 && S2.lastSnap > 0;
    barEl.style.display = show ? "flex" : "none";
    if (!show) {
      if (panelOpen) togglePanel(false);
      return;
    }
    if (barDirty) rebuildBar();
    const A2 = acts();
    const t4 = now2();
    for (let i = 0; i < BAR_SIZE; i++) {
      const se = slotEls[i];
      const a = A2[i];
      const left = S2.cdEnd[i] - t4;
      if (left > 0) {
        const f = Math.max(0, Math.min(1, left / S2.cdDur[i]));
        se.cd.style.background = `conic-gradient(rgba(0,0,0,0.72) ${(f * 360).toFixed(1)}deg, rgba(0,0,0,0) 0)`;
        se.cdt.textContent = left > 1e3 ? String(Math.ceil(left / 1e3)) : (left / 1e3).toFixed(1);
      } else if (se.cdt.textContent) {
        se.cd.style.background = "";
        se.cdt.textContent = "";
      }
      const isToggle = a?.kind === "aura" || a?.kind === "meta";
      se.el.classList.toggle("nomana", !!a && !isToggle && a.cost > S2.mp + 1e-6);
      se.el.classList.toggle("bad", !!a && !a.ok);
      se.el.classList.toggle("on", S2.on.has(i));
      se.el.classList.toggle("held", !!input.skills[i] && !!a);
      if (a?.kind === "meta") se.enFill.style.width = `${Math.max(0, Math.min(100, S2.en[i]))}%`;
    }
  }
  var panelEl = null;
  var panelOpen = false;
  var panelDirty = true;
  var selId = -1;
  var focusSlot = -1;
  function togglePanel(force) {
    ensureDom();
    panelOpen = force ?? !panelOpen;
    if (!panelOpen) {
      selId = -1;
      focusSlot = -1;
      hideTip();
    }
    panelEl.style.display = panelOpen ? "block" : "none";
    panelDirty = true;
  }
  registerPanel({ isOpen: () => panelOpen, close: () => togglePanel(false) });
  function bagGems() {
    return S2.inv.map((e) => e.it).filter((it) => isGem(it)).sort((a, b) => (isSkillGem(b) ? 2 : isSupportGem(b) ? 1 : 0) - (isSkillGem(a) ? 2 : isSupportGem(a) ? 1 : 0) || a.b.localeCompare(b.b));
  }
  function selected() {
    if (selId < 0) return null;
    return S2.inv.find((e) => e.it.id === selId)?.it ?? null;
  }
  function cell(cls, it, size2, opts) {
    const el = document.createElement("div");
    el.className = cls;
    const cv = opts.canvas ?? (it ? gemCanvas(it, size2) : null);
    if (cv) el.appendChild(cv);
    if (opts.lv) {
      const l = document.createElement("span");
      l.className = "lv";
      l.textContent = opts.lv;
      el.appendChild(l);
    }
    if (opts.tip) {
      const tip = opts.tip;
      el.addEventListener("mouseenter", (e) => showTip(opts.owner, tip(), e.clientX, e.clientY));
      el.addEventListener("mousemove", (e) => showTip(opts.owner, tip(), e.clientX, e.clientY));
      el.addEventListener("mouseleave", () => hideTip(opts.owner));
    }
    el.addEventListener("click", (e) => {
      e.preventDefault();
      opts.click?.();
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      opts.rclick?.();
    });
    return el;
  }
  function act(m) {
    send(m);
    selId = -1;
    hideTip();
    panelDirty = true;
  }
  function buildPanel() {
    if (!panelEl) return;
    panelDirty = false;
    const sel = selected();
    if (selId >= 0 && !sel) selId = -1;
    const A2 = acts();
    const spiritUsed = [...S2.on].reduce((t4, i) => t4 + (A2[i]?.spirit ?? 0), 0);
    const equipped = barSkillIds(S2.bar).length;
    panelEl.innerHTML = "";
    const hd = document.createElement("div");
    hd.className = "hd";
    hd.innerHTML = `<b>SKILLS</b><span>Gems ${equipped} / ${MAX_EQUIPPED_SKILLS} \xB7 Spirit ${spiritUsed} / ${Math.round(S2.stats.spirit)} \xB7 Mana ${Math.floor(S2.mp)} / ${Math.round(S2.stats.maxMana)} \xB7 <span style="color:${ATTR_COLOR.str}">Str ${Math.floor(S2.attrs.str)}</span> <span style="color:${ATTR_COLOR.dex}">Dex ${Math.floor(S2.attrs.dex)}</span> <span style="color:${ATTR_COLOR.int}">Int ${Math.floor(S2.attrs.int)}</span></span>`;
    panelEl.appendChild(hd);
    const hint = document.createElement("div");
    hint.className = "hint";
    if (!sel) hint.innerHTML = "Click a gem in your bag to pick it up, then click a bar slot or a socket. Right-click a socketed gem to take it out.";
    else if (isSkillGem(sel)) hint.innerHTML = `<b>${esc(gemDisplayName(sel))}</b>: click a bar slot${skillDefOf(sel)?.kind === "meta" ? "" : " (or a meta gem's centre socket)"}. Click the gem again to put it down.`;
    else if (isSupportGem(sel)) hint.innerHTML = `<b>${esc(gemDisplayName(sel))}</b>: click a socket of a skill (or the skill itself for the first free socket).`;
    else hint.innerHTML = `<b>${esc(gemDisplayName(sel))}</b>: choose what to cut it into, or raise one of your gems.`;
    panelEl.appendChild(hint);
    const cols = document.createElement("div");
    cols.className = "cols";
    panelEl.appendChild(cols);
    const barCol = document.createElement("div");
    const bh = document.createElement("div");
    bh.className = "bar-h";
    bh.textContent = "Skill bar";
    barCol.appendChild(bh);
    const bar2 = document.createElement("div");
    bar2.className = "bar";
    barCol.appendChild(bar2);
    cols.appendChild(barCol);
    for (let r = 0; r < BAR_MAIN; r++)
      for (const i of [r, r + BAR_MAIN]) {
        bar2.appendChild(slotRow(i, sel, A2[i]));
      }
    const bag = document.createElement("div");
    bag.className = "bag";
    const h4 = document.createElement("h4");
    h4.textContent = "Gems in your bag";
    bag.appendChild(h4);
    const grid = document.createElement("div");
    grid.className = "bgrid";
    const gems = bagGems();
    for (const it of gems) {
      const lv = isSupportGem(it) ? ["I", "II", "III"][Math.max(0, Math.min(2, Math.round(it.l) - 1))] : String(Math.round(it.l));
      grid.appendChild(
        cell("gcell" + (it.id === selId ? " sel" : ""), it, 44, {
          owner: "bag" + it.id,
          lv,
          tip: () => gemTipHtml(it, it.id === selId ? "Click to put it down" : "Click to pick it up"),
          click: () => {
            selId = selId === it.id ? -1 : it.id;
            hideTip();
            panelDirty = true;
          }
        })
      );
    }
    bag.appendChild(grid);
    if (!gems.length) {
      const n2 = document.createElement("div");
      n2.className = "empty-note";
      n2.textContent = "No gems yet. Monsters drop Rough Crystals and the odd cut gem.";
      bag.appendChild(n2);
    }
    if (sel && isRough(sel)) bag.appendChild(cutBox(sel));
    cols.appendChild(bag);
  }
  function slotRow(i, sel, a) {
    const row = document.createElement("div");
    row.className = "srow" + (i === focusSlot ? " focus" : "");
    const k = document.createElement("div");
    k.className = "k";
    k.textContent = skillSlotLabel(i);
    row.appendChild(k);
    const bs = S2.bar[i];
    const eff = slotOf(i);
    const def2 = skillDefOf(eff?.gem);
    const innate = !bs.gem && !!def2;
    const canTake = !!sel && isSkillGem(sel);
    const supTarget = !!sel && isSupportGem(sel) && !!bs.gem;
    const gemCell = cell("gcell" + (canTake ? " target" : ""), null, 40, {
      owner: "slot" + i,
      canvas: def2 ? skillIcon(def2.id, 40) : i === 0 ? skillIcon("", 40) : void 0,
      tip: () => slotTipHtml(i) + (bs.gem ? `<div class="tt-hint">Right-click to take the gem out</div>` : ""),
      click: () => {
        if (!sel) return;
        if (isSkillGem(sel)) act({ t: "socket", id: sel.id, slot: i });
        else if (isSupportGem(sel) && bs.gem) {
          const n3 = socketCount(bs.gem);
          let free2 = -1;
          for (let j = 0; j < n3; j++) if (!bs.sups[j]) {
            free2 = j;
            break;
          }
          act({ t: "socket", id: sel.id, slot: i, sup: free2 < 0 ? 0 : free2 });
        }
      },
      rclick: () => {
        if (bs.gem) act({ t: "unsocket", slot: i });
      }
    });
    if (innate) gemCell.style.opacity = "0.75";
    row.appendChild(gemCell);
    const nm = document.createElement("div");
    nm.className = "nm";
    if (def2 && a) {
      const tag = innate ? "weapon skill" : def2.kind === "aura" || def2.kind === "meta" ? S2.on.has(i) ? "on" : "off" : `${a.cost} mana`;
      nm.innerHTML = `<span style="color:${ATTR_COLOR[def2.attr]}">${esc(def2.name)}</span><i>Lv ${a.level} \xB7 ${esc(tag)}</i>`;
    } else if (i === 0) nm.innerHTML = `<span style="color:#e8e0d0">${esc(a?.name ?? "Weapon Strike")}</span><i>free basic attack</i>`;
    else nm.innerHTML = `<span style="color:#5a5248">empty</span>`;
    row.appendChild(nm);
    if (def2?.kind === "meta" && bs.gem) {
      const innerGem = bs.inner ?? null;
      const c = cell("gcell inner" + (canTake && skillDefOf(sel)?.kind !== "meta" ? " target" : ""), innerGem, 30, {
        owner: "inner" + i,
        tip: () => innerGem ? gemTipHtml(innerGem, "Right-click to take it out") : `<div class="tt-name" style="color:#a89c84">Spell socket</div><div class="tt-sub">Socket a spell here; it fires when the energy is full</div>`,
        click: () => {
          if (sel && isSkillGem(sel)) act({ t: "socket", id: sel.id, slot: i, inner: 1 });
        },
        rclick: () => {
          if (innerGem) act({ t: "unsocket", slot: i, inner: 1 });
        }
      });
      row.appendChild(c);
    }
    const socks = document.createElement("div");
    socks.className = "socks";
    const n2 = bs.gem ? socketCount(bs.gem) : 0;
    for (let j = 0; j < MAX_SOCKETS; j++) {
      const sup = bs.sups[j] ?? null;
      const locked = j >= n2;
      const st = sup ? a?.supports.find((x2) => x2.id === supportDefOf(sup)?.id) : void 0;
      const off = !!sup && !!st && !st.ok;
      const el = cell("sock" + (locked ? " locked" : "") + (off ? " off" : "") + (!locked && supTarget ? " target" : ""), sup, 26, {
        owner: `sock${i}_${j}`,
        tip: locked ? void 0 : () => sup ? gemTipHtml(sup, (off && st?.why ? st.why + " \xB7 " : "") + "Right-click to take it out") : `<div class="tt-name" style="color:#a89c84">Empty socket</div><div class="tt-sub">Pick up a support gem and click here</div>`,
        click: () => {
          if (!locked && sel && isSupportGem(sel)) act({ t: "socket", id: sel.id, slot: i, sup: j });
        },
        rclick: () => {
          if (sup) act({ t: "unsocket", slot: i, sup: j });
        }
      });
      socks.appendChild(el);
    }
    row.appendChild(socks);
    return row;
  }
  function cutBox(rough) {
    const box2 = document.createElement("div");
    box2.className = "cut";
    const h = document.createElement("h4");
    h.textContent = "Cut into";
    box2.appendChild(h);
    for (const o of cutOptions(rough)) {
      const b = document.createElement("button");
      b.disabled = !o.ok;
      b.innerHTML = `${esc(o.name)}${o.why ? `<em>${esc(o.why)}</em>` : ""}`;
      b.addEventListener("click", () => act({ t: "cut", id: rough.id, gem: o.id }));
      box2.appendChild(b);
    }
    if (rough.b !== "rough_support") {
      const targets = [];
      for (const e of S2.inv) if (isSkillGem(e.it) && !upgradeRefusal(rough, e.it)) targets.push(e.it);
      for (const s of S2.bar) for (const g of [s.gem, s.inner]) if (g && isSkillGem(g) && !upgradeRefusal(rough, g)) targets.push(g);
      const h2 = document.createElement("h4");
      h2.textContent = "Or raise a gem";
      box2.appendChild(h2);
      if (!targets.length) {
        const n2 = document.createElement("div");
        n2.className = "empty-note";
        n2.textContent = `No ${rough.b === "rough_spirit" ? "spirit" : "skill"} gem below level ${Math.round(rough.l)}.`;
        box2.appendChild(n2);
      }
      for (const g of targets) {
        const b = document.createElement("button");
        b.innerHTML = `${esc(skillDefOf(g).name)}<em>Lv ${Math.round(g.l)} \u2192 ${Math.round(rough.l)}</em>`;
        b.addEventListener("click", () => act({ t: "cut", id: rough.id, target: g.id }));
        box2.appendChild(b);
      }
    }
    return box2;
  }
  itemInfoHooks.push({
    name: (it) => isGem(it) ? gemDisplayName(it) : void 0,
    cls: (it) => isSkillGem(it) ? "Skill Gem" : isSupportGem(it) ? "Support Gem" : isRough(it) ? "Crystal" : void 0,
    lines: (it) => isGem(it) ? gemLines(it, S2.attrs) : void 0
  });
  function loop() {
    ensureDom();
    updateBar();
    if (panelOpen && panelDirty) buildPanel();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // src/client/gfx/icons.ts
  var PAL = {
    k: "#0c0a0b",
    // outline
    s: "#e9eef3",
    // steel light
    m: "#a2abb6",
    // steel mid
    d: "#5b636e",
    // steel dark
    w: "#7a5532",
    // wood
    W: "#4a311b",
    // wood dark
    b: "#c9a24a",
    // brass
    B: "#7d6128",
    // brass dark
    l: "#8a5a34",
    // leather
    L: "#55351d",
    // leather dark
    c: "#6c7480",
    // chain
    C: "#3c424b",
    h: "#3a3f3c",
    // hood cloth
    r: "#b8303f",
    // red liquid
    R: "#6e1823",
    g: "#c4d2d8",
    // glass
    G: "#6d8790",
    y: "#e6d27a",
    // gem
    e: "#5ad1c9",
    // gem cyan
    p: "#9b6ad8"
    // gem purple
  };
  var ICONS = {
    sword: [
      "..........kk",
      ".........ksk",
      "........ksmk",
      ".......ksmk.",
      "......ksmk..",
      "..k..ksmk...",
      "..kkksmk....",
      "...kbmk.....",
      "..kWkbk.....",
      ".kWk.kbk....",
      "kWk...kk....",
      "kk.........."
    ],
    spear: [
      ".........kkk",
      "........ksmk",
      ".......ksmdk",
      "........kdk.",
      ".......kbk..",
      "......kwk...",
      ".....kwk....",
      "....kwk.....",
      "...kwk......",
      "..kwk.......",
      ".kWk........",
      ".kk........."
    ],
    axe: [
      "....kkkk....",
      "...ksssmk...",
      "..ksmmmmdk..",
      "..ksmkkkkk..",
      "..kmdkwk....",
      "...kkkwk....",
      ".....kwk....",
      ".....kwk....",
      ".....kwk....",
      ".....kWk....",
      ".....kWk....",
      ".....kkk...."
    ],
    dagger: [
      "............",
      ".........kk.",
      "........ksk.",
      ".......ksmk.",
      "......ksmk..",
      "....kksmk...",
      "....kbmk....",
      "...kWkbk....",
      "..kWk.k.....",
      "..kk........",
      "............",
      "............"
    ],
    offhand: [
      "....kkkk....",
      "..kkllllkk..",
      ".kllLllllLk.",
      ".klLlllllLk.",
      "kllllbbllllk",
      "klllbmmblllk",
      "klllbmmblllk",
      "kllllbbllllk",
      ".kLllllllLk.",
      ".kLLllllLLk.",
      "..kkLLLLkk..",
      "....kkkk...."
    ],
    helmet: [
      "............",
      "....kkkk....",
      "...kmssmk...",
      "..kmsmmmdk..",
      "..kmmmmmdk..",
      ".kmmmmmmmdk.",
      ".kmkkkkkkdk.",
      ".kmmmmmmmdk.",
      ".kdmkmmkmdk.",
      ".kddk..kddk.",
      "..kk....kk..",
      "............"
    ],
    body: [
      "............",
      "..kkk..kkk..",
      ".kcckkkkcck.",
      "kcccCccCcccC",
      "kccCcccccCck",
      "kkkcCcccCckk",
      "..kccCcCcck.",
      "..kcCcccCck.",
      "..kccbbbcck.",
      "..kcCcccCck.",
      "..kkkkkkkkk.",
      "............"
    ],
    gloves: [
      "............",
      "...k.k.k....",
      "..klklklk...",
      "..klklklk.k.",
      "..klllllkklk",
      "..kllllllllk",
      "..klllllllk.",
      "..kLlllllk..",
      "..kbbbbbbk..",
      "..kLLLLLLk..",
      "...kkkkkk...",
      "............"
    ],
    boots: [
      "............",
      "...kkkk.....",
      "...kllk.....",
      "...kllk.....",
      "...kbbk.....",
      "...kllk.....",
      "...klllk....",
      "...kllllkk..",
      "..kllllllk..",
      "..kLLLLLLLk.",
      "..kkkkkkkkk.",
      "............"
    ],
    amulet: [
      "..k......k..",
      "..kB....Bk..",
      "...kB..Bk...",
      "....kBBk....",
      ".....kk.....",
      "....kbbk....",
      "...kbeebk...",
      "...kbeebk...",
      "....kbbk....",
      ".....kk.....",
      "............",
      "............"
    ],
    ring: [
      "............",
      "............",
      ".....kk.....",
      "....kppk....",
      "...kkbbkk...",
      "..kbBkkBbk..",
      "..kbk..kbk..",
      "..kbk..kbk..",
      "..kBbkkbBk..",
      "...kkBBkk...",
      "....kkkk....",
      "............"
    ],
    belt: [
      "............",
      "............",
      "............",
      "kkkkkkkkkkkk",
      "klLlLkkkLlLl",
      "kllllkbbkllk",
      "kLlLlkbbkLlL",
      "kkkkkkkkkkkk",
      "...kRk.kRk..",
      "...krk.krk..",
      "...kkk.kkk..",
      "............"
    ],
    bow: [
      "......kkk...",
      ".....kwwk...",
      "....kwk.k...",
      "...kwk..k...",
      "...kwk..k...",
      "..kbk...k...",
      "..kbk...k...",
      "...kwk..k...",
      "...kwk..k...",
      "....kwk.k...",
      ".....kwwk...",
      "......kkk..."
    ],
    staff: [
      ".......kkk..",
      "......kepk..",
      "......kpek..",
      ".......kk...",
      "......kwk...",
      ".....kwk....",
      ".....kwk....",
      "....kwk.....",
      "....kWk.....",
      "...kWk......",
      "...kWk......",
      "...kk......."
    ],
    gem: [
      "............",
      "............",
      "....kkkk....",
      "...keeeek...",
      "..keyeeeek..",
      "..keeeeeGk..",
      "..keeeeGGk..",
      "...keeGGk...",
      "....kGGk....",
      ".....kk.....",
      "............",
      "............"
    ],
    flask: [
      "....kkkk....",
      "....kwWk....",
      "....kkkk....",
      "....kgGk....",
      "...kgGGGk...",
      "..kgrrrrGk..",
      ".kgrrrrrrGk.",
      ".kgrrrrrrRk.",
      ".kgrrrrrRRk.",
      "..kRrrrRRk..",
      "...kkkkkk...",
      "............"
    ]
  };
  var cache4 = /* @__PURE__ */ new Map();
  function flaskIcon(fill, usable) {
    const lv = Math.round(Math.max(0, Math.min(1, fill)) * 10);
    const key = `flask|${lv}|${usable ? 1 : 0}`;
    const hit = cache4.get(key);
    if (hit) return hit.cv;
    const rows = ICONS.flask;
    const buf = new PixBuf(12, 12);
    const liquidTop = 9 - Math.round(lv / 10 * 5);
    for (let y2 = 0; y2 < 12; y2++) {
      for (let x2 = 0; x2 < 12; x2++) {
        let ch = rows[y2][x2];
        if (ch === ".") continue;
        if ((ch === "r" || ch === "R") && y2 < liquidTop) ch = "G";
        let col3 = PAL[ch];
        if (!usable && (ch === "r" || ch === "R")) col3 = ch === "r" ? "#6a2632" : "#3e1219";
        buf.set(x2, y2, rgba(col3));
      }
    }
    if (lv > 0) {
      for (let x2 = 3; x2 < 9; x2++) if (rows[liquidTop]?.[x2] === "r") buf.set(x2, liquidTop, rgba(usable ? "#ff6a72" : "#8a3a44"));
    }
    const s = sprite(buf, 6, 11);
    cache4.set(key, s);
    return s.cv;
  }

  // src/client/gfx/lootart.ts
  function rad2(g, x2, y2, r, stops) {
    const gr = g.createRadialGradient(x2, y2, 0, x2, y2, Math.max(0.01, r));
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  function lin(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  function glow2(g, x2, y2, r, col3) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = rad2(g, x2, y2, r, [[0, col3], [1, "rgba(0,0,0,0)"]]);
    g.beginPath();
    g.arc(x2, y2, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function edge(g, w = 0.9, col3 = "rgba(10,6,4,0.85)") {
    g.lineWidth = w;
    g.strokeStyle = col3;
    g.lineJoin = "round";
    g.stroke();
  }
  var EMBER = {
    cur_kindling: { hot: "#fff2c4", mid: "#ff9a2e", dark: "#5a1a06", glow: "rgba(255,130,40,0.55)", emblem: "spark" },
    cur_stoking: { hot: "#d8ecff", mid: "#5a8cff", dark: "#0c1440", glow: "rgba(90,140,255,0.5)", emblem: "plus" },
    cur_crowning: { hot: "#fff8d0", mid: "#f0c040", dark: "#4a3006", glow: "rgba(255,210,80,0.55)", emblem: "crown" },
    cur_blazing: { hot: "#ffffff", mid: "#ffd27a", dark: "#7a2a04", glow: "rgba(255,200,120,0.75)", emblem: "star" },
    cur_shifting: { hot: "#ffe0f4", mid: "#c060d8", dark: "#2a0832", glow: "rgba(200,100,230,0.5)", emblem: "swirl" },
    cur_quenching: { hot: "#e8fbff", mid: "#7ccfe0", dark: "#0a2a34", glow: "rgba(130,210,230,0.45)", emblem: "minus" },
    cur_tempering: { hot: "#fffbe8", mid: "#e8d8a8", dark: "#4a3a18", glow: "rgba(255,240,190,0.65)", emblem: "scales" },
    cur_forgeheart: { hot: "#fff0d0", mid: "#ff6a2a", dark: "#3a0804", glow: "rgba(255,90,30,0.65)", emblem: "anvil" },
    cur_honing: { hot: "#f4f6f8", mid: "#a8b0bc", dark: "#262a30", glow: "rgba(200,210,230,0.4)", emblem: "edge" },
    cur_boring: { hot: "#f8e8d8", mid: "#b88a60", dark: "#2e1a0c", glow: "rgba(220,170,120,0.45)", emblem: "hole" },
    cur_blighted: { hot: "#e8ffd0", mid: "#7a3a9a", dark: "#140418", glow: "rgba(150,230,90,0.5)", emblem: "eye" }
  };
  function emblem(g, kind2, cx, cy, r) {
    g.save();
    g.strokeStyle = "rgba(30,10,4,0.75)";
    g.fillStyle = "rgba(30,10,4,0.72)";
    g.lineWidth = Math.max(1, r * 0.16);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    switch (kind2) {
      case "spark":
        g.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
        g.fill();
        break;
      case "plus":
        g.moveTo(cx - r * 0.4, cy);
        g.lineTo(cx + r * 0.4, cy);
        g.moveTo(cx, cy - r * 0.4);
        g.lineTo(cx, cy + r * 0.4);
        g.stroke();
        break;
      case "minus":
        g.moveTo(cx - r * 0.45, cy);
        g.lineTo(cx + r * 0.45, cy);
        g.stroke();
        break;
      case "crown":
        g.moveTo(cx - r * 0.5, cy + r * 0.3);
        g.lineTo(cx - r * 0.5, cy - r * 0.25);
        g.lineTo(cx - r * 0.22, cy + r * 0.02);
        g.lineTo(cx, cy - r * 0.4);
        g.lineTo(cx + r * 0.22, cy + r * 0.02);
        g.lineTo(cx + r * 0.5, cy - r * 0.25);
        g.lineTo(cx + r * 0.5, cy + r * 0.3);
        g.closePath();
        g.fill();
        break;
      case "star":
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const rr3 = i % 2 ? r * 0.2 : r * 0.5;
          if (i) g.lineTo(cx + Math.cos(a) * rr3, cy + Math.sin(a) * rr3);
          else g.moveTo(cx + Math.cos(a) * rr3, cy + Math.sin(a) * rr3);
        }
        g.closePath();
        g.fill();
        break;
      case "swirl":
        for (let t4 = 0; t4 <= 1; t4 += 0.04) {
          const a = t4 * Math.PI * 3.2;
          const rr3 = r * 0.05 + t4 * r * 0.45;
          if (t4) g.lineTo(cx + Math.cos(a) * rr3, cy + Math.sin(a) * rr3);
          else g.moveTo(cx, cy);
        }
        g.stroke();
        break;
      case "scales":
        g.moveTo(cx, cy - r * 0.45);
        g.lineTo(cx, cy + r * 0.4);
        g.moveTo(cx - r * 0.45, cy - r * 0.2);
        g.lineTo(cx + r * 0.45, cy - r * 0.2);
        g.stroke();
        g.beginPath();
        g.arc(cx - r * 0.38, cy + r * 0.05, r * 0.14, 0, Math.PI);
        g.arc(cx + r * 0.38, cy + r * 0.05, r * 0.14, 0, Math.PI);
        g.fill();
        break;
      case "anvil":
        g.moveTo(cx - r * 0.55, cy - r * 0.25);
        g.lineTo(cx + r * 0.45, cy - r * 0.25);
        g.lineTo(cx + r * 0.2, cy);
        g.lineTo(cx + r * 0.25, cy + r * 0.35);
        g.lineTo(cx - r * 0.25, cy + r * 0.35);
        g.lineTo(cx - r * 0.2, cy);
        g.closePath();
        g.fill();
        break;
      case "edge":
        g.moveTo(cx - r * 0.45, cy + r * 0.35);
        g.lineTo(cx + r * 0.45, cy - r * 0.35);
        g.stroke();
        break;
      case "hole":
        g.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.fillStyle = "rgba(0,0,0,0.85)";
        g.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
        g.fill();
        break;
      case "eye":
        g.moveTo(cx - r * 0.5, cy);
        g.quadraticCurveTo(cx, cy - r * 0.42, cx + r * 0.5, cy);
        g.quadraticCurveTo(cx, cy + r * 0.42, cx - r * 0.5, cy);
        g.stroke();
        g.beginPath();
        g.fillStyle = "#c8ff70";
        g.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
        g.fill();
        break;
    }
    g.restore();
  }
  var emberIcon = (g, W3, H3, item) => {
    const st = EMBER[item.b] ?? EMBER.cur_kindling;
    const cx = W3 / 2;
    const cy = H3 * 0.56;
    const r = Math.min(W3, H3) * 0.31;
    glow2(g, cx, cy, r * 1.9, st.glow);
    g.beginPath();
    g.moveTo(cx + r * 0.1, cy - r * 1.3);
    g.bezierCurveTo(cx + r * 0.5, cy - r * 0.8, cx + r * 1.15, cy - r * 0.3, cx + r * 0.95, cy + r * 0.45);
    g.bezierCurveTo(cx + r * 0.8, cy + r * 1.05, cx - r * 0.8, cy + r * 1.05, cx - r * 0.95, cy + r * 0.45);
    g.bezierCurveTo(cx - r * 1.1, cy - r * 0.15, cx - r * 0.5, cy - r * 0.45, cx - r * 0.25, cy - r * 0.95);
    g.quadraticCurveTo(cx - r * 0.1, cy - r * 0.55, cx + r * 0.1, cy - r * 1.3);
    g.closePath();
    g.fillStyle = rad2(g, cx - r * 0.15, cy + r * 0.1, r * 1.35, [[0, st.hot], [0.4, st.mid], [1, st.dark]]);
    g.fill();
    edge(g);
    g.beginPath();
    g.ellipse(cx - r * 0.4, cy - r * 0.05, r * 0.16, r * 0.3, -0.4, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.fill();
    emblem(g, st.emblem, cx + r * 0.05, cy + r * 0.3, r * 0.75);
  };
  var awlIcon = (g, W3, H3) => {
    const s = Math.min(W3, H3);
    g.save();
    g.translate(W3 / 2, H3 / 2);
    g.rotate(-Math.PI / 4);
    glow2(g, 0, -s * 0.28, s * 0.25, "rgba(150,220,255,0.5)");
    g.beginPath();
    g.moveTo(0, -s * 0.46);
    g.lineTo(s * 0.035, -s * 0.05);
    g.lineTo(-s * 0.035, -s * 0.05);
    g.closePath();
    g.fillStyle = lin(g, -s * 0.04, 0, s * 0.04, 0, [[0, "#5a606a"], [0.5, "#eef2f6"], [1, "#4a4f58"]]);
    g.fill();
    edge(g, 0.7);
    g.beginPath();
    g.rect(-s * 0.07, -s * 0.06, s * 0.14, s * 0.07);
    g.fillStyle = lin(g, -s * 0.07, 0, s * 0.07, 0, [[0, "#5c3f10"], [0.5, "#f0cf78"], [1, "#4e360e"]]);
    g.fill();
    edge(g, 0.7);
    g.beginPath();
    g.ellipse(0, s * 0.2, s * 0.1, s * 0.2, 0, 0, Math.PI * 2);
    g.fillStyle = lin(g, -s * 0.1, 0, s * 0.1, 0, [[0, "#2e1c10"], [0.5, "#8b5e36"], [1, "#2e1c10"]]);
    g.fill();
    edge(g, 0.8);
    g.beginPath();
    g.arc(0, -s * 0.44, s * 0.035, 0, Math.PI * 2);
    g.fillStyle = "#bff0ff";
    g.fill();
    g.restore();
  };
  var RUNE_GLYPH = {
    rune_rootbound: { col: "#7fd060", lines: [[[0, -0.8], [0, 0.8]], [[0, 0.3], [-0.5, 0.8]], [[0, 0.3], [0.5, 0.8]], [[0, -0.3], [-0.4, -0.7]]] },
    rune_quickwater: { col: "#60c8ff", lines: [[[-0.6, -0.4], [-0.2, 0], [0.2, -0.4], [0.6, 0]], [[-0.6, 0.3], [-0.2, 0.7], [0.2, 0.3], [0.6, 0.7]]] },
    rune_hearthstone: { col: "#ff8a40", lines: [[[-0.6, 0.7], [0, -0.7], [0.6, 0.7], [-0.6, 0.7]], [[0, 0.1], [0, 0.5]]] },
    rune_stillmind: { col: "#a8a0ff", lines: [[[-0.6, 0], [0.6, 0]], [[0, -0.7], [0, 0.7]], [[-0.45, -0.45], [0.45, 0.45]]] },
    rune_gale: { col: "#d0f0f0", lines: [[[-0.7, -0.5], [0.4, -0.5], [0.6, -0.2]], [[-0.7, 0], [0.6, 0]], [[-0.7, 0.5], [0.3, 0.5], [0.5, 0.75]]] },
    rune_bramble: { col: "#a0d050", lines: [[[-0.7, 0.7], [0.7, -0.7]], [[-0.3, 0.3], [-0.6, -0.1]], [[0.1, -0.1], [0.5, 0.3]], [[0.3, -0.3], [0, -0.7]]] },
    rune_hoarfrost: { col: "#b0e8ff", lines: [[[0, -0.8], [0, 0.8]], [[-0.7, -0.4], [0.7, 0.4]], [[-0.7, 0.4], [0.7, -0.4]]] },
    rune_brimstone: { col: "#ffb030", lines: [[[-0.5, 0.7], [-0.5, -0.2], [0, -0.7], [0.5, -0.2], [0.5, 0.7]], [[-0.5, 0.2], [0.5, 0.2]]] },
    rune_kingsblood: { col: "#ff4a4a", lines: [[[-0.6, 0.6], [-0.6, -0.3], [-0.2, 0.1], [0, -0.6], [0.2, 0.1], [0.6, -0.3], [0.6, 0.6], [-0.6, 0.6]]] },
    rune_duskglass: { col: "#c070ff", lines: [[[0, -0.8], [0.6, 0], [0, 0.8], [-0.6, 0], [0, -0.8]], [[0, -0.3], [0, 0.3]]] }
  };
  var runeIcon = (g, W3, H3, item) => {
    const gl = RUNE_GLYPH[item.b] ?? RUNE_GLYPH.rune_rootbound;
    const cx = W3 / 2;
    const cy = H3 / 2;
    const s = Math.min(W3, H3) * 0.36;
    g.beginPath();
    g.moveTo(cx - s * 0.8, cy - s * 0.9);
    g.bezierCurveTo(cx - s * 0.2, cy - s * 1.15, cx + s * 0.6, cy - s * 1.05, cx + s * 0.9, cy - s * 0.6);
    g.bezierCurveTo(cx + s * 1.1, cy, cx + s * 1, cy + s * 0.8, cx + s * 0.6, cy + s * 1);
    g.bezierCurveTo(cx, cy + s * 1.2, cx - s * 0.8, cy + s * 1.05, cx - s * 1, cy + s * 0.6);
    g.bezierCurveTo(cx - s * 1.15, cy, cx - s * 1.1, cy - s * 0.65, cx - s * 0.8, cy - s * 0.9);
    g.closePath();
    g.fillStyle = rad2(g, cx - s * 0.35, cy - s * 0.4, s * 1.7, [[0, "#9a948c"], [0.55, "#5a5650"], [1, "#24221f"]]);
    g.fill();
    edge(g, 1);
    g.save();
    g.translate(cx, cy);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.shadowColor = gl.col;
    g.shadowBlur = s * 0.5;
    g.strokeStyle = gl.col;
    g.lineWidth = Math.max(1.2, s * 0.14);
    for (const line of gl.lines) {
      g.beginPath();
      line.forEach(([x2, y2], i) => i ? g.lineTo(x2 * s * 0.62, y2 * s * 0.62) : g.moveTo(x2 * s * 0.62, y2 * s * 0.62));
      g.stroke();
    }
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = Math.max(0.5, s * 0.05);
    for (const line of gl.lines) {
      g.beginPath();
      line.forEach(([x2, y2], i) => i ? g.lineTo(x2 * s * 0.62, y2 * s * 0.62) : g.moveTo(x2 * s * 0.62, y2 * s * 0.62));
      g.stroke();
    }
    g.restore();
  };
  var ICHOR_COL = {
    vital: "#e0303a",
    swift: "#40d0a0",
    keen: "#e8e8f0",
    wrath: "#ff6a20",
    restless: "#f0d040",
    lucid: "#4070ff",
    verdant: "#60c040",
    eel: "#30a8b8",
    incant: "#b060ff"
  };
  var ichorIcon = (g, W3, H3, item) => {
    const fam = item.b.replace(/^ess_/, "").replace(/_potent$/, "");
    const col3 = ICHOR_COL[fam] ?? "#d07fd0";
    const potent = item.b.endsWith("_potent");
    const cx = W3 / 2;
    const s = Math.min(W3, H3);
    const by = H3 * 0.62;
    const r = s * 0.27;
    if (potent) glow2(g, cx, by, r * 2, col3 + "99");
    g.beginPath();
    g.rect(cx - s * 0.07, H3 * 0.14, s * 0.14, s * 0.24);
    g.fillStyle = "rgba(200,220,230,0.35)";
    g.fill();
    edge(g, 0.8);
    g.beginPath();
    g.rect(cx - s * 0.09, H3 * 0.08, s * 0.18, s * 0.09);
    g.fillStyle = lin(g, cx - s * 0.09, 0, cx + s * 0.09, 0, [[0, "#3a2414"], [0.5, "#9a6a40"], [1, "#3a2414"]]);
    g.fill();
    edge(g, 0.8);
    g.beginPath();
    g.arc(cx, by, r, 0, Math.PI * 2);
    g.fillStyle = rad2(g, cx - r * 0.3, by - r * 0.3, r * 1.3, [[0, "#ffffff"], [0.25, col3], [1, "#0a0608"]]);
    g.fill();
    edge(g, 1);
    g.beginPath();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = Math.max(0.8, r * 0.1);
    g.arc(cx + r * 0.1, by + r * 0.05, r * 0.5, 0.6, 3.6);
    g.stroke();
    g.beginPath();
    g.ellipse(cx - r * 0.4, by - r * 0.4, r * 0.14, r * 0.24, -0.6, 0, Math.PI * 2);
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fill();
  };
  var CHARM_STYLE = {
    chm_thawstone: { col: "#9adcff", shape: "disc" },
    chm_anchor: { col: "#8a8f98", shape: "weight" },
    chm_lastbreath: { col: "#e8e0ff", shape: "drop" },
    chm_harefoot: { col: "#d8b080", shape: "leaf" },
    chm_bristle: { col: "#9a7040", shape: "spike" },
    chm_mender: { col: "#70d070", shape: "knot" },
    chm_gildtooth: { col: "#f0c850", shape: "tooth" }
  };
  var charmIcon = (g, W3, H3, item) => {
    const st = CHARM_STYLE[item.b] ?? { col: "#7fc8a8", shape: "disc" };
    const cx = W3 / 2;
    const cy = H3 * 0.6;
    const r = Math.min(W3, H3) * 0.27;
    g.beginPath();
    g.moveTo(cx - r * 0.9, H3 * 0.06);
    g.quadraticCurveTo(cx, cy - r * 1.6, cx + r * 0.9, H3 * 0.06);
    g.lineWidth = Math.max(1, r * 0.09);
    g.strokeStyle = "#8a6a40";
    g.stroke();
    g.beginPath();
    g.arc(cx, cy - r * 1.05, r * 0.16, 0, Math.PI * 2);
    g.fillStyle = "#c8a860";
    g.fill();
    const body = rad2(g, cx - r * 0.3, cy - r * 0.3, r * 1.5, [[0, "#ffffff"], [0.3, st.col], [1, "#140e08"]]);
    g.beginPath();
    switch (st.shape) {
      case "tooth":
        g.moveTo(cx - r * 0.6, cy - r * 0.8);
        g.quadraticCurveTo(cx, cy - r * 1.05, cx + r * 0.6, cy - r * 0.8);
        g.quadraticCurveTo(cx + r * 0.4, cy + r * 0.2, cx, cy + r * 1.1);
        g.quadraticCurveTo(cx - r * 0.4, cy + r * 0.2, cx - r * 0.6, cy - r * 0.8);
        break;
      case "drop":
        g.moveTo(cx, cy - r * 0.95);
        g.bezierCurveTo(cx + r * 0.9, cy, cx + r * 0.8, cy + r, cx, cy + r);
        g.bezierCurveTo(cx - r * 0.8, cy + r, cx - r * 0.9, cy, cx, cy - r * 0.95);
        break;
      case "leaf":
        g.moveTo(cx, cy - r);
        g.quadraticCurveTo(cx + r * 1, cy, cx, cy + r);
        g.quadraticCurveTo(cx - r * 1, cy, cx, cy - r);
        break;
      case "spike":
        for (let i = 0; i < 16; i++) {
          const a = i * Math.PI / 8;
          const rr3 = i % 2 ? r * 0.6 : r;
          if (i) g.lineTo(cx + Math.cos(a) * rr3, cy + Math.sin(a) * rr3);
          else g.moveTo(cx + rr3, cy);
        }
        break;
      case "weight":
        g.moveTo(cx - r * 0.45, cy - r * 0.75);
        g.lineTo(cx + r * 0.45, cy - r * 0.75);
        g.lineTo(cx + r * 0.9, cy + r * 0.85);
        g.lineTo(cx - r * 0.9, cy + r * 0.85);
        break;
      case "knot":
        g.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
        break;
      default:
        g.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    }
    g.closePath();
    g.fillStyle = body;
    g.fill();
    edge(g, 1);
    if (st.shape === "knot") {
      g.beginPath();
      g.strokeStyle = "rgba(20,40,10,0.7)";
      g.lineWidth = Math.max(1, r * 0.14);
      g.moveTo(cx - r * 0.5, cy - r * 0.5);
      g.bezierCurveTo(cx + r * 0.6, cy - r * 0.2, cx - r * 0.6, cy + r * 0.2, cx + r * 0.5, cy + r * 0.5);
      g.stroke();
    }
    if (st.shape === "disc") {
      g.beginPath();
      g.strokeStyle = "rgba(255,255,255,0.75)";
      g.lineWidth = Math.max(0.8, r * 0.08);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI / 3;
        g.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
        g.lineTo(cx - Math.cos(a) * r * 0.55, cy - Math.sin(a) * r * 0.55);
      }
      g.stroke();
    }
    const def2 = CHARM_BY_ID.get(item.b);
    if (def2) {
      const frac = Math.max(0, Math.min(1, (item.c ?? 0) / def2.maxCharges));
      glow2(g, cx, cy, r * (0.6 + frac), `rgba(255,255,255,${0.1 + 0.4 * frac})`);
    }
  };
  var jewelIcon = (g, W3, H3, item) => {
    const col3 = JEWEL_BASE_BY_ID.get(item.b)?.color ?? "#c8323c";
    const cx = W3 / 2;
    const cy = H3 / 2;
    const r = Math.min(W3, H3) * 0.34;
    glow2(g, cx, cy, r * 1.6, col3 + "88");
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    g.beginPath();
    pts.forEach(([x2, y2], i) => i ? g.lineTo(x2, y2) : g.moveTo(x2, y2));
    g.closePath();
    g.fillStyle = rad2(g, cx - r * 0.3, cy - r * 0.35, r * 1.4, [[0, "#ffffff"], [0.3, col3], [1, "#08040a"]]);
    g.fill();
    edge(g, 1);
    const inner = pts.map(([x2, y2]) => [cx + (x2 - cx) * 0.5, cy + (y2 - cy) * 0.5]);
    g.beginPath();
    inner.forEach(([x2, y2], i) => i ? g.lineTo(x2, y2) : g.moveTo(x2, y2));
    g.closePath();
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 0.7;
    g.stroke();
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      g.moveTo(inner[i][0], inner[i][1]);
      g.lineTo(pts[i][0], pts[i][1]);
    }
    g.stroke();
  };
  function lootDrawer(item) {
    if (item.b === "cur_awl") return awlIcon;
    if (CURRENCY_BY_ID.has(item.b)) return emberIcon;
    if (RUNE_BY_ID.has(item.b)) return runeIcon;
    if (ESSENCE_BY_ID.has(item.b)) return ichorIcon;
    if (CHARM_BY_ID.has(item.b)) return charmIcon;
    if (JEWEL_BASE_BY_ID.has(item.b)) return jewelIcon;
    return null;
  }

  // src/client/gfx/itemart.ts
  function lin2(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  function rad3(g, x2, y2, r, stops) {
    const gr = g.createRadialGradient(x2, y2, 0, x2, y2, Math.max(0.01, r));
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }
  var STEEL = [[0, "#4b4f57"], [0.35, "#d9dee4"], [0.55, "#9aa1aa"], [1, "#3a3d44"]];
  var DARK_STEEL = [[0, "#2c2e33"], [0.4, "#8e949c"], [0.6, "#5c6168"], [1, "#222428"]];
  var WOOD = [[0, "#2e1c10"], [0.45, "#7b5432"], [1, "#3a2414"]];
  var LEATHER = [[0, "#2f1d12"], [0.5, "#8a5a36"], [1, "#3b2618"]];
  var GOLD = [[0, "#5c3f10"], [0.45, "#f0cf78"], [0.7, "#b48a34"], [1, "#4e360e"]];
  var BONE = [[0, "#6e6452"], [0.5, "#e6dcc4"], [1, "#857a64"]];
  var CLOTH = {
    ar: ["#3a3c42", "#8d939c"],
    ev: ["#2c3320", "#6e7a46"],
    es: ["#2a1f44", "#7158b8"],
    ar_ev: ["#3a2a1c", "#8a6a44"],
    ar_es: ["#3a2230", "#9a5a6e"],
    ev_es: ["#1d3236", "#4f8c8a"]
  };
  function outline(g, w = 1) {
    g.lineWidth = w;
    g.strokeStyle = "rgba(0,0,0,0.75)";
    g.stroke();
  }
  function shine(g, x2, y2, r, a = 0.55) {
    g.fillStyle = rad3(g, x2, y2, r, [[0, `rgba(255,255,255,${a})`], [1, "rgba(255,255,255,0)"]]);
    g.beginPath();
    g.arc(x2, y2, r, 0, Math.PI * 2);
    g.fill();
  }
  function glow3(g, x2, y2, r, color) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = rad3(g, x2, y2, r, [[0, color], [1, "rgba(0,0,0,0)"]]);
    g.beginPath();
    g.arc(x2, y2, r, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function rrect(g, x2, y2, w, h, r) {
    g.beginPath();
    g.moveTo(x2 + r, y2);
    g.arcTo(x2 + w, y2, x2 + w, y2 + h, r);
    g.arcTo(x2 + w, y2 + h, x2, y2 + h, r);
    g.arcTo(x2, y2 + h, x2, y2, r);
    g.arcTo(x2, y2, x2 + w, y2, r);
    g.closePath();
  }
  function blade(g, cx, y0, y1, hw, tip = hw * 2.2, dark = false) {
    g.beginPath();
    g.moveTo(cx, y0);
    g.lineTo(cx + hw, y0 + tip);
    g.lineTo(cx + hw, y1);
    g.lineTo(cx - hw, y1);
    g.lineTo(cx - hw, y0 + tip);
    g.closePath();
    g.fillStyle = lin2(g, cx - hw, 0, cx + hw, 0, dark ? DARK_STEEL : STEEL);
    g.fill();
    outline(g);
    g.beginPath();
    g.moveTo(cx, y0 + tip * 1.2);
    g.lineTo(cx, y1 - hw * 0.6);
    g.lineWidth = Math.max(1, hw * 0.28);
    g.strokeStyle = "rgba(40,44,50,0.55)";
    g.stroke();
  }
  function haft(g, cx, y0, y1, hw, mat2 = WOOD) {
    rrect(g, cx - hw, y0, hw * 2, y1 - y0, hw);
    g.fillStyle = lin2(g, cx - hw, 0, cx + hw, 0, mat2);
    g.fill();
    outline(g);
  }
  function wraps(g, cx, y0, y1, hw) {
    g.strokeStyle = "rgba(20,10,4,0.65)";
    g.lineWidth = Math.max(1, hw * 0.35);
    for (let y2 = y0 + hw; y2 < y1 - hw * 0.5; y2 += hw * 1.4) {
      g.beginPath();
      g.moveTo(cx - hw, y2);
      g.lineTo(cx + hw, y2 + hw * 0.6);
      g.stroke();
    }
  }
  function guard(g, cx, y2, hw, hh, mat2 = GOLD) {
    rrect(g, cx - hw, y2 - hh, hw * 2, hh * 2, hh);
    g.fillStyle = lin2(g, 0, y2 - hh, 0, y2 + hh, mat2);
    g.fill();
    outline(g);
  }
  function pommel(g, cx, y2, r, mat2 = GOLD) {
    g.beginPath();
    g.arc(cx, y2, r, 0, Math.PI * 2);
    g.fillStyle = rad3(g, cx - r * 0.3, y2 - r * 0.3, r * 1.4, mat2);
    g.fill();
    outline(g);
  }
  function gemDot(g, x2, y2, r, color) {
    glow3(g, x2, y2, r * 2.6, color + "88");
    g.beginPath();
    g.arc(x2, y2, r, 0, Math.PI * 2);
    g.fillStyle = rad3(g, x2 - r * 0.35, y2 - r * 0.35, r * 1.3, [[0, "#ffffff"], [0.3, color], [1, "#000000"]]);
    g.fill();
    outline(g, 0.8);
  }
  var swordLike = (long, wide, darkBlade = false) => (g, W3, H3) => {
    const cx = W3 / 2;
    const hw = Math.min(W3 * 0.16, H3 * 0.05) * wide;
    const bladeEnd = H3 * long;
    blade(g, cx, H3 * 0.05, bladeEnd, hw, hw * 2.4, darkBlade);
    guard(g, cx, bladeEnd + hw * 0.3, hw * 3.2, hw * 0.55);
    haft(g, cx, bladeEnd + hw * 0.8, H3 * 0.9, hw * 0.55, LEATHER);
    wraps(g, cx, bladeEnd + hw * 0.8, H3 * 0.9, hw * 0.55);
    pommel(g, cx, H3 * 0.92, hw * 0.85);
    shine(g, cx - hw * 0.4, H3 * 0.2, hw * 1.2, 0.35);
  };
  var axeLike = (double, big) => (g, W3, H3) => {
    const cx = W3 * (double ? 0.5 : 0.42);
    const hw = Math.max(1.5, W3 * 0.055);
    haft(g, cx, H3 * 0.06, H3 * 0.95, hw);
    const top = H3 * 0.08;
    const hh = H3 * (big ? 0.3 : 0.26);
    const reach = W3 * (double ? 0.42 : 0.5);
    const head = (dir) => {
      g.beginPath();
      g.moveTo(cx + dir * hw, top + hh * 0.15);
      g.quadraticCurveTo(cx + dir * reach * 0.55, top + hh * 0.2, cx + dir * reach, top - hh * 0.05);
      g.quadraticCurveTo(cx + dir * reach * 0.82, top + hh * 0.55, cx + dir * reach, top + hh * 1.1);
      g.quadraticCurveTo(cx + dir * reach * 0.55, top + hh * 0.85, cx + dir * hw, top + hh * 0.85);
      g.closePath();
      g.fillStyle = lin2(g, cx, 0, cx + dir * reach, 0, DARK_STEEL);
      g.fill();
      outline(g);
      g.beginPath();
      g.moveTo(cx + dir * reach, top - hh * 0.05);
      g.quadraticCurveTo(cx + dir * reach * 0.82, top + hh * 0.55, cx + dir * reach, top + hh * 1.1);
      g.lineWidth = Math.max(1.2, W3 * 0.03);
      g.strokeStyle = "rgba(230,236,240,0.85)";
      g.stroke();
    };
    head(1);
    if (double) head(-1);
    guard(g, cx, top + hh * 0.5, hw * 1.6, hh * 0.42, DARK_STEEL);
    pommel(g, cx, H3 * 0.95, hw * 1.2, DARK_STEEL);
  };
  var maceLike = (maul2) => (g, W3, H3) => {
    const cx = W3 / 2;
    const hw = Math.max(1.5, W3 * 0.06);
    haft(g, cx, H3 * 0.2, H3 * 0.94, hw);
    wraps(g, cx, H3 * 0.7, H3 * 0.92, hw);
    if (maul2) {
      const bw = W3 * 0.38;
      const bh = H3 * 0.18;
      rrect(g, cx - bw, H3 * 0.06, bw * 2, bh, bh * 0.15);
      g.fillStyle = lin2(g, 0, H3 * 0.06, 0, H3 * 0.06 + bh, DARK_STEEL);
      g.fill();
      outline(g);
      g.strokeStyle = "rgba(255,255,255,0.25)";
      g.lineWidth = 1;
      g.strokeRect(cx - bw * 0.85, H3 * 0.06 + bh * 0.2, bw * 1.7, bh * 0.6);
    } else {
      const r = Math.min(W3 * 0.3, H3 * 0.13);
      const cy = H3 * 0.16;
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        g.beginPath();
        g.moveTo(cx + Math.cos(a - 0.25) * r * 0.8, cy + Math.sin(a - 0.25) * r * 0.8);
        g.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
        g.lineTo(cx + Math.cos(a + 0.25) * r * 0.8, cy + Math.sin(a + 0.25) * r * 0.8);
        g.closePath();
        g.fillStyle = "#6b7078";
        g.fill();
        outline(g, 0.8);
      }
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fillStyle = rad3(g, cx - r * 0.3, cy - r * 0.3, r * 1.3, DARK_STEEL);
      g.fill();
      outline(g);
      shine(g, cx - r * 0.35, cy - r * 0.35, r * 0.5, 0.5);
    }
    pommel(g, cx, H3 * 0.95, hw * 1.3, DARK_STEEL);
  };
  var spearArt = (g, W3, H3) => {
    const cx = W3 / 2;
    const hw = Math.max(1.5, W3 * 0.09);
    haft(g, cx, H3 * 0.2, H3 * 0.97, hw);
    const bw = W3 * 0.28;
    g.beginPath();
    g.moveTo(cx, H3 * 0.02);
    g.quadraticCurveTo(cx + bw, H3 * 0.12, cx + hw, H3 * 0.22);
    g.lineTo(cx - hw, H3 * 0.22);
    g.quadraticCurveTo(cx - bw, H3 * 0.12, cx, H3 * 0.02);
    g.fillStyle = lin2(g, cx - bw, 0, cx + bw, 0, STEEL);
    g.fill();
    outline(g);
    guard(g, cx, H3 * 0.225, hw * 1.6, hw * 0.7, DARK_STEEL);
    for (const y2 of [0.55, 0.6]) guard(g, cx, H3 * y2, hw * 1.15, hw * 0.35, LEATHER);
  };
  var sceptreArt = (g, W3, H3) => {
    const cx = W3 / 2;
    const hw = Math.max(1.5, W3 * 0.09);
    haft(g, cx, H3 * 0.25, H3 * 0.94, hw, GOLD);
    const r = Math.min(W3 * 0.32, H3 * 0.11);
    const cy = H3 * 0.16;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i / 6 * Math.PI * 2;
      g.lineTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
      g.lineTo(cx + Math.cos(a + Math.PI / 6) * r * 0.7, cy + Math.sin(a + Math.PI / 6) * r * 0.7);
    }
    g.closePath();
    g.fillStyle = lin2(g, cx - r, cy - r, cx + r, cy + r, GOLD);
    g.fill();
    outline(g);
    gemDot(g, cx, cy, r * 0.45, "#c03030");
    guard(g, cx, H3 * 0.27, hw * 1.8, hw * 0.5);
    pommel(g, cx, H3 * 0.95, hw * 1.2);
  };
  var wandArt = (g, W3, H3) => {
    const cx = W3 / 2;
    g.beginPath();
    g.moveTo(cx - W3 * 0.03, H3 * 0.12);
    g.lineTo(cx + W3 * 0.03, H3 * 0.12);
    g.lineTo(cx + W3 * 0.09, H3 * 0.92);
    g.lineTo(cx - W3 * 0.09, H3 * 0.92);
    g.closePath();
    g.fillStyle = lin2(g, cx - W3 * 0.1, 0, cx + W3 * 0.1, 0, BONE);
    g.fill();
    outline(g);
    wraps(g, cx, H3 * 0.7, H3 * 0.9, W3 * 0.08);
    glow3(g, cx, H3 * 0.1, W3 * 0.45, "rgba(150,120,255,0.75)");
    gemDot(g, cx, H3 * 0.1, W3 * 0.12, "#9a7cff");
  };
  var staffArt = (g, W3, H3) => {
    const cx = W3 / 2;
    const hw = Math.max(1.5, W3 * 0.06);
    g.beginPath();
    g.moveTo(cx - hw, H3 * 0.18);
    g.bezierCurveTo(cx - hw * 3, H3 * 0.4, cx + hw * 2, H3 * 0.6, cx - hw, H3 * 0.97);
    g.lineTo(cx + hw, H3 * 0.97);
    g.bezierCurveTo(cx + hw * 3.5, H3 * 0.6, cx - hw, H3 * 0.4, cx + hw, H3 * 0.18);
    g.closePath();
    g.fillStyle = lin2(g, cx - hw * 3, 0, cx + hw * 3, 0, WOOD);
    g.fill();
    outline(g);
    g.strokeStyle = lin2(g, cx - W3 * 0.25, 0, cx + W3 * 0.25, 0, WOOD);
    g.lineWidth = hw * 1.3;
    g.lineCap = "round";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx, H3 * 0.2);
      g.quadraticCurveTo(cx + s * W3 * 0.3, H3 * 0.15, cx + s * W3 * 0.12, H3 * 0.04);
      g.stroke();
    }
    g.lineCap = "butt";
    glow3(g, cx, H3 * 0.12, W3 * 0.5, "rgba(80,170,255,0.7)");
    g.beginPath();
    g.moveTo(cx, H3 * 0.03);
    g.lineTo(cx + W3 * 0.1, H3 * 0.12);
    g.lineTo(cx, H3 * 0.2);
    g.lineTo(cx - W3 * 0.1, H3 * 0.12);
    g.closePath();
    g.fillStyle = lin2(g, cx - W3 * 0.1, H3 * 0.03, cx + W3 * 0.1, H3 * 0.2, [[0, "#e8f6ff"], [0.5, "#58a8f0"], [1, "#1a3a78"]]);
    g.fill();
    outline(g);
  };
  var quarterstaffArt = (g, W3, H3) => {
    const cx = W3 / 2;
    const hw = Math.max(1.5, W3 * 0.07);
    haft(g, cx, H3 * 0.03, H3 * 0.97, hw);
    for (const y2 of [0.03, 0.94]) guard(g, cx, H3 * (y2 + 0.015), hw * 1.25, H3 * 0.03, DARK_STEEL);
    for (const y2 of [0.42, 0.58]) guard(g, cx, H3 * y2, hw * 1.2, hw * 0.45, LEATHER);
    wraps(g, cx, H3 * 0.43, H3 * 0.57, hw);
  };
  var bowArt = (g, W3, H3) => {
    const x0 = W3 * 0.32;
    const top = H3 * 0.04;
    const bot = H3 * 0.96;
    const bulge = W3 * 0.36;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x0, top);
    g.bezierCurveTo(x0 + bulge * 1.3, H3 * 0.25, x0 + bulge * 1.3, H3 * 0.75, x0, bot);
    g.lineWidth = Math.max(3, W3 * 0.1);
    g.strokeStyle = "rgba(0,0,0,0.8)";
    g.stroke();
    g.lineWidth = Math.max(2, W3 * 0.07);
    g.strokeStyle = lin2(g, x0, 0, x0 + bulge, 0, WOOD);
    g.stroke();
    g.beginPath();
    g.moveTo(x0, top);
    g.lineTo(x0, bot);
    g.lineWidth = 1;
    g.strokeStyle = "rgba(230,220,190,0.85)";
    g.stroke();
    guard(g, x0 + bulge * 0.97, H3 * 0.5, W3 * 0.05, H3 * 0.07, LEATHER);
    g.lineCap = "butt";
  };
  var crossbowArt = (g, W3, H3) => {
    const cx = W3 / 2;
    haft(g, cx, H3 * 0.12, H3 * 0.95, W3 * 0.09);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(W3 * 0.06, H3 * 0.36);
    g.quadraticCurveTo(cx, H3 * 0.08, W3 * 0.94, H3 * 0.36);
    g.lineWidth = Math.max(3, W3 * 0.08);
    g.strokeStyle = "rgba(0,0,0,0.8)";
    g.stroke();
    g.lineWidth = Math.max(2, W3 * 0.055);
    g.strokeStyle = lin2(g, 0, 0, W3, 0, DARK_STEEL);
    g.stroke();
    g.beginPath();
    g.moveTo(W3 * 0.06, H3 * 0.36);
    g.lineTo(cx, H3 * 0.46);
    g.lineTo(W3 * 0.94, H3 * 0.36);
    g.lineWidth = 1;
    g.strokeStyle = "rgba(230,220,190,0.85)";
    g.stroke();
    g.lineCap = "butt";
    g.beginPath();
    g.moveTo(cx, H3 * 0.04);
    g.lineTo(cx, H3 * 0.46);
    g.lineWidth = 2;
    g.strokeStyle = "#cfd4da";
    g.stroke();
    guard(g, cx, H3 * 0.62, W3 * 0.05, H3 * 0.04, DARK_STEEL);
  };
  var clawArt = (g, W3, H3) => {
    const cx = W3 / 2;
    rrect(g, W3 * 0.3, H3 * 0.55, W3 * 0.4, H3 * 0.32, W3 * 0.06);
    g.fillStyle = lin2(g, W3 * 0.3, 0, W3 * 0.7, 0, LEATHER);
    g.fill();
    outline(g);
    for (const dx of [-0.18, 0, 0.18]) {
      const x2 = cx + W3 * dx;
      g.beginPath();
      g.moveTo(x2 - W3 * 0.05, H3 * 0.57);
      g.quadraticCurveTo(x2 - W3 * 0.05, H3 * 0.2, x2 + W3 * 0.12, H3 * 0.06);
      g.quadraticCurveTo(x2 + W3 * 0.04, H3 * 0.3, x2 + W3 * 0.05, H3 * 0.57);
      g.closePath();
      g.fillStyle = lin2(g, x2 - W3 * 0.05, 0, x2 + W3 * 0.1, 0, STEEL);
      g.fill();
      outline(g);
    }
  };
  var shieldArt = (shape) => (g, W3, H3, item) => {
    const cx = W3 / 2;
    const def2 = BASE_BY_ID.get(item.b)?.def ?? "ar";
    const [d, l] = CLOTH[def2] ?? CLOTH.ar;
    g.beginPath();
    if (shape === "buckler" || shape === "round") {
      const r = Math.min(W3, H3) * (shape === "buckler" ? 0.38 : 0.44);
      g.arc(cx, H3 / 2, r, 0, Math.PI * 2);
    } else if (shape === "kite") {
      g.moveTo(W3 * 0.1, H3 * 0.1);
      g.quadraticCurveTo(cx, H3 * 0.02, W3 * 0.9, H3 * 0.1);
      g.quadraticCurveTo(W3 * 0.92, H3 * 0.55, cx, H3 * 0.97);
      g.quadraticCurveTo(W3 * 0.08, H3 * 0.55, W3 * 0.1, H3 * 0.1);
    } else {
      g.moveTo(W3 * 0.1, H3 * 0.12);
      g.quadraticCurveTo(cx, H3 * 0.02, W3 * 0.9, H3 * 0.12);
      g.lineTo(W3 * 0.9, H3 * 0.94);
      g.lineTo(W3 * 0.1, H3 * 0.94);
      g.closePath();
    }
    g.fillStyle = lin2(g, 0, 0, W3, H3, [[0, l], [0.6, d], [1, "#111"]]);
    g.fill();
    g.lineWidth = Math.max(2, W3 * 0.05);
    g.strokeStyle = lin2(g, 0, 0, W3, H3, shape === "buckler" ? LEATHER : DARK_STEEL);
    g.stroke();
    outline(g, 0.8);
    if (shape === "buckler" || shape === "round") {
      const r = Math.min(W3, H3) * 0.13;
      g.beginPath();
      g.arc(cx, H3 / 2, r, 0, Math.PI * 2);
      g.fillStyle = rad3(g, cx - r * 0.3, H3 / 2 - r * 0.3, r * 1.4, DARK_STEEL);
      g.fill();
      outline(g);
      shine(g, cx - r * 0.3, H3 / 2 - r * 0.3, r * 0.6, 0.6);
    } else {
      g.beginPath();
      g.moveTo(cx, H3 * 0.2);
      g.lineTo(cx, H3 * 0.75);
      g.moveTo(W3 * 0.28, H3 * 0.4);
      g.lineTo(W3 * 0.72, H3 * 0.4);
      g.lineWidth = Math.max(2, W3 * 0.07);
      g.strokeStyle = lin2(g, 0, 0, W3, 0, GOLD);
      g.stroke();
    }
  };
  var focusArt = (g, W3, H3) => {
    const cx = W3 / 2;
    const cy = H3 * 0.42;
    const r = Math.min(W3, H3) * 0.28;
    g.beginPath();
    g.moveTo(cx - r * 1.1, cy + r * 0.4);
    g.quadraticCurveTo(cx, cy + r * 2.2, cx + r * 1.1, cy + r * 0.4);
    g.lineTo(cx + r * 0.3, H3 * 0.92);
    g.lineTo(cx - r * 0.3, H3 * 0.92);
    g.closePath();
    g.fillStyle = lin2(g, cx - r, 0, cx + r, 0, GOLD);
    g.fill();
    outline(g);
    glow3(g, cx, cy, r * 2.2, "rgba(170,120,255,0.55)");
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = rad3(g, cx - r * 0.4, cy - r * 0.4, r * 1.5, [[0, "#f4ecff"], [0.3, "#a888f0"], [0.8, "#3a2370"], [1, "#150a2a"]]);
    g.fill();
    outline(g);
  };
  var quiverArt = (g, W3, H3) => {
    g.save();
    g.translate(W3 / 2, H3 / 2);
    g.rotate(0.18);
    const w = W3 * 0.36;
    const h = H3 * 0.62;
    for (const dx of [-0.5, 0, 0.5]) {
      const x2 = dx * w * 0.6;
      g.beginPath();
      g.moveTo(x2, -h * 0.5);
      g.lineTo(x2, -h * 0.78);
      g.lineWidth = 1.5;
      g.strokeStyle = "#7b5432";
      g.stroke();
      g.beginPath();
      g.moveTo(x2, -h * 0.82);
      g.lineTo(x2 + w * 0.16, -h * 0.68);
      g.lineTo(x2, -h * 0.72);
      g.lineTo(x2 - w * 0.16, -h * 0.68);
      g.closePath();
      g.fillStyle = "#c8c0a8";
      g.fill();
      outline(g, 0.6);
    }
    rrect(g, -w / 2, -h / 2, w, h, w * 0.25);
    g.fillStyle = lin2(g, -w / 2, 0, w / 2, 0, LEATHER);
    g.fill();
    outline(g);
    for (const y2 of [-0.3, 0.3]) guard(g, 0, h * y2, w * 0.52, h * 0.03, GOLD);
    g.restore();
  };
  var helmetArt = (kind2) => (g, W3, H3) => {
    const cx = W3 / 2;
    const r = Math.min(W3, H3) * 0.38;
    const cy = H3 * 0.55;
    if (kind2 === "circlet") {
      g.beginPath();
      g.ellipse(cx, cy, r, r * 0.4, 0, 0, Math.PI * 2);
      g.lineWidth = Math.max(2.5, W3 * 0.07);
      g.strokeStyle = lin2(g, 0, 0, W3, 0, GOLD);
      g.stroke();
      gemDot(g, cx, cy + r * 0.4, r * 0.16, "#5aa8ff");
      return;
    }
    const hood = kind2 === "hood";
    const coif = kind2 === "coif";
    g.beginPath();
    if (hood) {
      g.moveTo(cx, H3 * 0.08);
      g.quadraticCurveTo(cx + r * 1.4, H3 * 0.25, cx + r * 1.05, H3 * 0.92);
      g.lineTo(cx - r * 1.05, H3 * 0.92);
      g.quadraticCurveTo(cx - r * 1.4, H3 * 0.25, cx, H3 * 0.08);
    } else {
      g.arc(cx, cy, r, Math.PI, 0);
      g.lineTo(cx + r, H3 * (kind2 === "helm_great" ? 0.9 : 0.78));
      g.lineTo(cx - r, H3 * (kind2 === "helm_great" ? 0.9 : 0.78));
      g.closePath();
    }
    g.fillStyle = hood ? lin2(g, 0, 0, W3, H3, [[0, "#4a4636"], [0.6, "#24221a"], [1, "#0e0d0a"]]) : coif ? lin2(g, 0, 0, W3, H3, LEATHER) : lin2(g, cx - r, 0, cx + r, 0, STEEL);
    g.fill();
    outline(g);
    if (hood) {
      g.beginPath();
      g.ellipse(cx, H3 * 0.6, r * 0.55, r * 0.6, 0, 0, Math.PI * 2);
      g.fillStyle = "#050404";
      g.fill();
    } else if (kind2 === "helm_great") {
      g.fillStyle = "#0b0b0d";
      g.fillRect(cx - r * 0.75, cy - r * 0.05, r * 1.5, r * 0.14);
      g.fillRect(cx - r * 0.06, cy - r * 0.05, r * 0.12, r * 0.6);
    } else if (!coif) {
      g.fillStyle = lin2(g, cx - r * 0.08, 0, cx + r * 0.08, 0, DARK_STEEL);
      g.fillRect(cx - r * 0.08, cy - r * 0.4, r * 0.16, r * 0.95);
    } else {
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 1;
      for (let y2 = cy - r * 0.6; y2 < H3 * 0.78; y2 += r * 0.2) {
        g.beginPath();
        g.moveTo(cx - r, y2);
        g.lineTo(cx + r, y2);
        g.stroke();
      }
    }
    if (kind2 === "helm_horned") {
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + s * r * 0.8, cy - r * 0.3);
        g.quadraticCurveTo(cx + s * r * 1.6, cy - r * 0.5, cx + s * r * 1.3, cy - r * 1.4);
        g.quadraticCurveTo(cx + s * r * 1.2, cy - r * 0.7, cx + s * r * 0.7, cy - r * 0.65);
        g.closePath();
        g.fillStyle = lin2(g, 0, cy - r * 1.4, 0, cy, BONE);
        g.fill();
        outline(g);
      }
    }
    if (!hood) shine(g, cx - r * 0.4, cy - r * 0.5, r * 0.4, 0.45);
  };
  var bodyArt = (g, W3, H3, item) => {
    const b = BASE_BY_ID.get(item.b);
    const def2 = b?.def ?? "ev";
    const look = b?.look ?? "";
    const [d, l] = CLOTH[def2] ?? CLOTH.ev;
    const cx = W3 / 2;
    const robe = look.includes("robe");
    g.beginPath();
    g.moveTo(cx - W3 * 0.18, H3 * 0.06);
    g.lineTo(cx - W3 * 0.44, H3 * 0.16);
    g.lineTo(cx - W3 * 0.46, H3 * 0.48);
    g.lineTo(cx - W3 * 0.32, H3 * 0.5);
    g.lineTo(cx - W3 * (robe ? 0.4 : 0.32), H3 * (robe ? 0.96 : 0.86));
    g.lineTo(cx + W3 * (robe ? 0.4 : 0.32), H3 * (robe ? 0.96 : 0.86));
    g.lineTo(cx + W3 * 0.32, H3 * 0.5);
    g.lineTo(cx + W3 * 0.46, H3 * 0.48);
    g.lineTo(cx + W3 * 0.44, H3 * 0.16);
    g.lineTo(cx + W3 * 0.18, H3 * 0.06);
    g.quadraticCurveTo(cx, H3 * 0.16, cx - W3 * 0.18, H3 * 0.06);
    g.closePath();
    g.fillStyle = lin2(g, 0, 0, W3, 0, [[0, d], [0.45, l], [1, d]]);
    g.fill();
    outline(g);
    if (look === "body_plate" || look === "body_plate_robe" || look === "body_mail") {
      g.fillStyle = lin2(g, cx - W3 * 0.28, 0, cx + W3 * 0.28, 0, look === "body_mail" ? DARK_STEEL : STEEL);
      rrect(g, cx - W3 * 0.28, H3 * 0.16, W3 * 0.56, H3 * 0.36, W3 * 0.1);
      g.fill();
      outline(g);
      shine(g, cx - W3 * 0.1, H3 * 0.26, W3 * 0.15, 0.45);
    }
    if (look.includes("scale") || look === "body_brigandine") {
      g.fillStyle = "rgba(0,0,0,0.25)";
      for (let y2 = H3 * 0.2; y2 < H3 * 0.8; y2 += H3 * 0.06)
        for (let x2 = cx - W3 * 0.26; x2 < cx + W3 * 0.26; x2 += W3 * 0.12) {
          g.beginPath();
          g.arc(x2 + y2 / (H3 * 0.06) % 2 * W3 * 0.06, y2, W3 * 0.05, 0, Math.PI);
          g.fill();
        }
    }
    g.fillStyle = lin2(g, 0, 0, W3, 0, LEATHER);
    g.fillRect(cx - W3 * 0.33, H3 * 0.55, W3 * 0.66, H3 * 0.05);
    guard(g, cx, H3 * 0.575, W3 * 0.05, H3 * 0.03);
  };
  var glovesArt = (g, W3, H3, item) => {
    const look = BASE_BY_ID.get(item.b)?.look ?? "gloves_leather";
    const mat2 = look === "gloves_gauntlet" ? STEEL : look === "gloves_silk" ? [[0, "#2a1f44"], [0.5, "#8a72cc"], [1, "#2a1f44"]] : LEATHER;
    const cx = W3 / 2;
    g.beginPath();
    g.moveTo(cx - W3 * 0.22, H3 * 0.92);
    g.lineTo(cx - W3 * 0.24, H3 * 0.52);
    g.lineTo(cx - W3 * 0.4, H3 * 0.38);
    g.quadraticCurveTo(cx - W3 * 0.42, H3 * 0.3, cx - W3 * 0.32, H3 * 0.3);
    g.lineTo(cx - W3 * 0.2, H3 * 0.38);
    g.lineTo(cx - W3 * 0.22, H3 * 0.12);
    for (let i = 0; i < 4; i++) {
      const x2 = cx - W3 * 0.22 + i * W3 * 0.12;
      g.quadraticCurveTo(x2 + W3 * 0.06, H3 * (0.04 + (i === 1 || i === 2 ? 0 : 0.04)), x2 + W3 * 0.12, H3 * 0.12);
    }
    g.lineTo(cx + W3 * 0.26, H3 * 0.92);
    g.closePath();
    g.fillStyle = lin2(g, cx - W3 * 0.3, 0, cx + W3 * 0.3, 0, mat2);
    g.fill();
    outline(g);
    g.fillStyle = lin2(g, 0, 0, W3, 0, look === "gloves_gauntlet" ? DARK_STEEL : LEATHER);
    rrect(g, cx - W3 * 0.27, H3 * 0.7, W3 * 0.56, H3 * 0.12, 3);
    g.fill();
    outline(g, 0.8);
    if (look === "gloves_wrap") wraps(g, cx, H3 * 0.3, H3 * 0.7, W3 * 0.22);
  };
  var bootsArt = (g, W3, H3, item) => {
    const look = BASE_BY_ID.get(item.b)?.look ?? "boots_soft";
    const mat2 = look === "boots_greave" ? STEEL : look === "boots_slipper" ? [[0, "#2a1f44"], [0.5, "#8a72cc"], [1, "#2a1f44"]] : LEATHER;
    const top = look === "boots_slipper" ? 0.4 : 0.08;
    g.beginPath();
    g.moveTo(W3 * 0.3, H3 * top);
    g.lineTo(W3 * 0.62, H3 * top);
    g.lineTo(W3 * 0.62, H3 * 0.6);
    g.quadraticCurveTo(W3 * 0.92, H3 * 0.66, W3 * 0.92, H3 * 0.86);
    g.lineTo(W3 * 0.92, H3 * 0.92);
    g.lineTo(W3 * 0.24, H3 * 0.92);
    g.lineTo(W3 * 0.26, H3 * 0.6);
    g.closePath();
    g.fillStyle = lin2(g, W3 * 0.24, 0, W3 * 0.92, 0, mat2);
    g.fill();
    outline(g);
    g.fillStyle = "#1a120c";
    g.fillRect(W3 * 0.24, H3 * 0.88, W3 * 0.68, H3 * 0.05);
    if (look === "boots_wrap") wraps(g, W3 * 0.46, H3 * 0.12, H3 * 0.6, W3 * 0.16);
    if (look !== "boots_slipper") guard(g, W3 * 0.46, H3 * (top + 0.04), W3 * 0.18, H3 * 0.04, look === "boots_greave" ? DARK_STEEL : LEATHER);
  };
  var beltArt = (g, W3, H3, item) => {
    const look = BASE_BY_ID.get(item.b)?.look ?? "belt_leather";
    const y2 = H3 * 0.3;
    const h = H3 * 0.4;
    rrect(g, W3 * 0.03, y2, W3 * 0.94, h, h * 0.3);
    g.fillStyle = lin2(g, 0, y2, 0, y2 + h, look === "belt_rope" ? WOOD : look === "belt_chain" ? DARK_STEEL : LEATHER);
    g.fill();
    outline(g);
    if (look === "belt_studded") for (let x2 = W3 * 0.1; x2 < W3 * 0.9; x2 += W3 * 0.1) shine(g, x2, y2 + h / 2, h * 0.15, 0.8);
    if (look === "belt_chain") {
      g.strokeStyle = "rgba(220,226,232,0.6)";
      g.lineWidth = 1;
      for (let x2 = W3 * 0.08; x2 < W3 * 0.92; x2 += W3 * 0.06) {
        g.beginPath();
        g.ellipse(x2, y2 + h / 2, W3 * 0.03, h * 0.3, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
    rrect(g, W3 * 0.42, y2 - h * 0.15, W3 * 0.16, h * 1.3, 2);
    g.lineWidth = Math.max(2, h * 0.18);
    g.strokeStyle = lin2(g, 0, 0, W3, 0, GOLD);
    g.stroke();
  };
  var ringArt = (g, W3, H3, item) => {
    const cx = W3 / 2;
    const cy = H3 * 0.58;
    const r = Math.min(W3, H3) * 0.28;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.lineWidth = Math.max(2.5, r * 0.32);
    g.strokeStyle = "rgba(0,0,0,0.8)";
    g.stroke();
    g.lineWidth = Math.max(1.8, r * 0.22);
    g.strokeStyle = lin2(g, cx - r, cy - r, cx + r, cy + r, item.b.includes("tarnished") ? DARK_STEEL : GOLD);
    g.stroke();
    const colors = ["#d04040", "#4080e0", "#40c080", "#e0c040", "#c060e0"];
    gemDot(g, cx, cy - r, r * 0.35, colors[item.b.length % colors.length]);
  };
  var amuletArt = (g, W3, H3, item) => {
    const cx = W3 / 2;
    g.beginPath();
    g.moveTo(W3 * 0.12, H3 * 0.08);
    g.quadraticCurveTo(cx, H3 * 0.7, W3 * 0.88, H3 * 0.08);
    g.lineWidth = 1.2;
    g.strokeStyle = lin2(g, 0, 0, W3, 0, GOLD);
    g.stroke();
    const colors = ["#e07a2a", "#58b8e0", "#9ad060", "#d04070", "#e0d070"];
    const r = Math.min(W3, H3) * 0.17;
    g.beginPath();
    g.moveTo(cx, H3 * 0.48);
    g.lineTo(cx + r, H3 * 0.48 + r * 1.1);
    g.lineTo(cx, H3 * 0.48 + r * 2.4);
    g.lineTo(cx - r, H3 * 0.48 + r * 1.1);
    g.closePath();
    g.fillStyle = lin2(g, cx - r, 0, cx + r, 0, GOLD);
    g.fill();
    outline(g);
    gemDot(g, cx, H3 * 0.48 + r * 1.15, r * 0.5, colors[item.b.length % colors.length]);
  };
  var flaskArt = (g, W3, H3, item) => {
    const cx = W3 / 2;
    const nw = W3 * 0.18;
    const bw = W3 * 0.4;
    const neckTop = H3 * 0.14;
    const bodyTop = H3 * 0.38;
    g.beginPath();
    g.moveTo(cx - nw, neckTop);
    g.lineTo(cx - nw, bodyTop);
    g.quadraticCurveTo(cx - bw * 1.1, bodyTop + H3 * 0.05, cx - bw, H3 * 0.62);
    g.quadraticCurveTo(cx - bw, H3 * 0.94, cx, H3 * 0.94);
    g.quadraticCurveTo(cx + bw, H3 * 0.94, cx + bw, H3 * 0.62);
    g.quadraticCurveTo(cx + bw * 1.1, bodyTop + H3 * 0.05, cx + nw, bodyTop);
    g.lineTo(cx + nw, neckTop);
    g.closePath();
    g.fillStyle = "rgba(160,190,200,0.16)";
    g.fill();
    g.save();
    g.clip();
    const fill = Math.max(0.1, Math.min(1, (item.c ?? 30) / 60));
    const ly = H3 * 0.94 - (H3 * 0.94 - bodyTop) * fill;
    g.fillStyle = lin2(g, 0, ly, 0, H3, [[0, "#ff5a4a"], [0.4, "#b0141a"], [1, "#4a0508"]]);
    g.fillRect(0, ly, W3, H3);
    g.restore();
    outline(g, 1.2);
    g.strokeStyle = "rgba(220,240,255,0.35)";
    g.lineWidth = 1;
    g.stroke();
    shine(g, cx - bw * 0.45, H3 * 0.6, bw * 0.3, 0.5);
    rrect(g, cx - nw * 1.2, H3 * 0.05, nw * 2.4, H3 * 0.1, 2);
    g.fillStyle = lin2(g, 0, 0, W3, 0, WOOD);
    g.fill();
    outline(g, 0.8);
  };
  var gemArt = (g, W3, H3, item) => {
    const cx = W3 / 2;
    const cy = H3 / 2;
    const r = Math.min(W3, H3) * 0.36;
    const colors = ["#d04040", "#40b060", "#4070e0"];
    const c = colors[item.b.length % 3];
    glow3(g, cx, cy, r * 1.6, c + "77");
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i / 6 * Math.PI * 2;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fillStyle = rad3(g, cx - r * 0.3, cy - r * 0.4, r * 1.5, [[0, "#ffffff"], [0.25, c], [1, "#080808"]]);
    g.fill();
    outline(g);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i / 6 * Math.PI * 2;
      g.lineTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
    }
    g.closePath();
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1;
    g.stroke();
  };
  var emberArt = (g, W3, H3) => {
    const cx = W3 / 2;
    const cy = H3 * 0.55;
    const r = Math.min(W3, H3) * 0.32;
    glow3(g, cx, cy, r * 1.9, "rgba(255,120,30,0.7)");
    g.beginPath();
    g.moveTo(cx, cy - r * 1.25);
    g.bezierCurveTo(cx + r * 1.2, cy - r * 0.2, cx + r * 0.9, cy + r, cx, cy + r);
    g.bezierCurveTo(cx - r * 0.9, cy + r, cx - r * 1.2, cy - r * 0.2, cx, cy - r * 1.25);
    g.fillStyle = rad3(g, cx, cy + r * 0.3, r * 1.4, [[0, "#fff4c0"], [0.35, "#ffb030"], [0.75, "#c0400c"], [1, "#3a0e04"]]);
    g.fill();
    outline(g, 0.8);
  };
  var charmArt = (g, W3, H3) => {
    const cx = W3 / 2;
    const cy = H3 * 0.55;
    const r = Math.min(W3, H3) * 0.28;
    g.beginPath();
    g.moveTo(cx, H3 * 0.06);
    g.lineTo(cx, cy - r);
    g.lineWidth = 1;
    g.strokeStyle = "#c8b080";
    g.stroke();
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy);
    g.lineTo(cx, cy + r * 1.2);
    g.lineTo(cx - r, cy);
    g.closePath();
    g.fillStyle = lin2(g, cx - r, cy - r, cx + r, cy + r, BONE);
    g.fill();
    outline(g);
    gemDot(g, cx, cy + r * 0.05, r * 0.32, "#7fc8a8");
  };
  var runeArt = (g, W3, H3) => {
    const cx = W3 / 2;
    const cy = H3 / 2;
    const r = Math.min(W3, H3) * 0.36;
    rrect(g, cx - r, cy - r, r * 2, r * 2, r * 0.4);
    g.fillStyle = lin2(g, 0, cy - r, 0, cy + r, [[0, "#6a6a70"], [1, "#2a2a30"]]);
    g.fill();
    outline(g);
    glow3(g, cx, cy, r, "rgba(120,200,255,0.5)");
    g.beginPath();
    g.moveTo(cx - r * 0.4, cy - r * 0.5);
    g.lineTo(cx + r * 0.1, cy);
    g.lineTo(cx - r * 0.4, cy + r * 0.5);
    g.moveTo(cx + r * 0.35, cy - r * 0.55);
    g.lineTo(cx + r * 0.35, cy + r * 0.55);
    g.lineWidth = Math.max(1.5, r * 0.14);
    g.strokeStyle = "#bfe8ff";
    g.stroke();
  };
  var genericArt = (g, W3, H3) => {
    const s = Math.min(W3, H3) * 0.6;
    rrect(g, (W3 - s) / 2, (H3 - s) / 2, s, s, s * 0.2);
    g.fillStyle = lin2(g, 0, 0, W3, H3, BONE);
    g.fill();
    outline(g);
  };
  var BY_LOOK = {
    sword_short: swordLike(0.6, 1),
    sword_long: swordLike(0.66, 1.1),
    greatsword: swordLike(0.68, 1.45),
    dagger: swordLike(0.52, 1.05),
    axe_hand: axeLike(false, false),
    greataxe: axeLike(true, true),
    mace: maceLike(false),
    maul: maceLike(true),
    claw: clawArt,
    spear: spearArt,
    sceptre: sceptreArt,
    wand: wandArt,
    quarterstaff: quarterstaffArt,
    staff: staffArt,
    bow: bowArt,
    crossbow: crossbowArt,
    shield_buckler: shieldArt("buckler"),
    shield_round: shieldArt("round"),
    shield_kite: shieldArt("kite"),
    shield_tower: shieldArt("tower"),
    focus_orb: focusArt,
    quiver: quiverArt
  };
  var BY_CLASS = {
    body: bodyArt,
    gloves: glovesArt,
    boots: bootsArt,
    belt: beltArt,
    ring: ringArt,
    amulet: amuletArt
  };
  function drawerFor(item) {
    if (isFlask(item)) return flaskArt;
    const loot = lootDrawer(item);
    if (loot) return loot;
    const gem = gemDrawer(item);
    if (gem) return gem;
    const cat = itemCategory(item);
    if (cat === "gem") return gemArt;
    if (cat === "currency" || cat === "essence") return emberArt;
    if (cat === "charm") return charmArt;
    if (cat === "rune" || cat === "jewel") return cat === "jewel" ? gemArt : runeArt;
    const b = BASE_BY_ID.get(item.b);
    if (!b) return genericArt;
    if (b.cls === "helmet") return helmetArt(b.look ?? "helm_open");
    if (b.look && BY_LOOK[b.look]) return BY_LOOK[b.look];
    if (b.cls === "weapon") return BY_LOOK[b.weapon?.kind ?? ""] ?? BY_LOOK.sword_long;
    if (b.cls === "offhand") return BY_LOOK.shield_round;
    return BY_CLASS[b.cls] ?? genericArt;
  }
  function itemArtCanvas(item, w, h) {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    const art = document.createElement("canvas");
    art.width = cv.width;
    art.height = cv.height;
    const a = art.getContext("2d");
    a.imageSmoothingEnabled = true;
    a.imageSmoothingQuality = "high";
    a.scale(dpr, dpr);
    const pad = Math.min(w, h) * 0.06;
    a.translate(pad, pad);
    try {
      drawerFor(item)(a, w - pad * 2, h - pad * 2, item);
    } catch {
      genericArt(a, w - pad * 2, h - pad * 2, item);
    }
    const g = cv.getContext("2d");
    g.shadowColor = "rgba(0,0,0,0.7)";
    g.shadowBlur = Math.min(w, h) * 0.08 * dpr;
    g.shadowOffsetY = Math.min(w, h) * 0.03 * dpr;
    g.drawImage(art, 0, 0);
    return cv;
  }

  // src/client/gfx/gore/gibs.ts
  var G_HEAD = 0;
  var G_ARM = 1;
  var G_LEG = 2;
  var G_TORSO = 3;
  var G_MEAT = 4;
  var G_GUT = 5;
  var G_BONE = 6;
  var G_RIB = 7;
  var G_ICE = 8;
  var G_ROCK = 9;
  var G_CHAR = 10;
  var MAX2 = 240;
  var DEFAULT_LOOK = { skin: "#c49072", cloth: "#5a4a3a", hands: "#c49072", feet: "#3a2e24", helm: null, hair: "#2a1e16" };
  var gibs = [];
  for (let i = 0; i < MAX2; i++) {
    const g = { on: false, kind: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, a: 0, va: 0, s: 1, mat: 0, seed: 0, t: 0, rest: 0, bounces: 0, look: DEFAULT_LOOK, spr: null, sc: { x: 0, y: 0 }, draw: () => drawOne(g) };
    gibs.push(g);
  }
  var centres = /* @__PURE__ */ new WeakMap();
  function spriteCentre(s) {
    let c = centres.get(s.cv);
    if (c) return c;
    c = { x: s.cv.width / 2, y: s.cv.height / 2 };
    try {
      const W3 = s.cv.width;
      const H3 = s.cv.height;
      const d = s.cv.getContext("2d").getImageData(0, 0, W3, H3).data;
      let sx = 0;
      let sy = 0;
      let n2 = 0;
      for (let y2 = 0; y2 < H3; y2 += 2)
        for (let x2 = 0; x2 < W3; x2 += 2)
          if (d[(y2 * W3 + x2) * 4 + 3] > 40) {
            sx += x2;
            sy += y2;
            n2++;
          }
      if (n2) c = { x: sx / n2, y: sy / n2 };
    } catch {
    }
    centres.set(s.cv, c);
    return c;
  }
  var live = 0;
  var ZK2 = 0.62;
  function spawnGib(kind2, mat2, x2, y2, z2, vx2, vy2, vz2, s, look = DEFAULT_LOOK, spr = null) {
    let g = gibs.find((q) => !q.on);
    if (!g) {
      g = gibs.reduce((a, b) => a.rest + a.t * 0.01 > b.rest + b.t * 0.01 ? a : b);
      bakeGib(g);
    }
    g.on = true;
    live++;
    g.kind = kind2;
    g.mat = mat2;
    g.x = x2;
    g.y = y2;
    g.z = z2;
    g.vx = vx2;
    g.vy = vy2;
    g.vz = vz2;
    g.a = Math.random() * Math.PI * 2;
    g.va = rr(-14, 14);
    g.s = s;
    g.seed = Math.random() * 1e9 | 0;
    g.t = 0;
    g.rest = 0;
    g.bounces = 0;
    g.look = look;
    g.spr = spr;
    if (spr) g.sc = spriteCentre(spr);
  }
  function bakeGib(g) {
    if (!g.on) return;
    g.on = false;
    live--;
    if (g.spr || !persistentBlood() && g.kind !== G_ROCK) return;
    const snap = { ...g };
    stamp(g.x, g.y, g.s * 3, (ctx) => {
      ctx.rotate(snap.a);
      paintGib(ctx, snap, 0);
    });
  }
  function shade2(g, r, base, dark = "rgba(0,0,0,0.45)") {
    const grd = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    grd.addColorStop(0, "rgba(255,255,255,0.18)");
    grd.addColorStop(0.5, "rgba(0,0,0,0)");
    grd.addColorStop(1, dark);
    g.fillStyle = base;
    g.fill();
    g.fillStyle = grd;
    g.fill();
  }
  function stump(g, x2, y2, r, mat2) {
    const m = MATS[mat2];
    g.beginPath();
    g.ellipse(x2, y2, r * 0.55, r, 0, 0, Math.PI * 2);
    g.fillStyle = m.drop[2];
    g.fill();
    g.beginPath();
    g.ellipse(x2, y2, r * 0.38, r * 0.72, 0, 0, Math.PI * 2);
    g.fillStyle = m.drop[0];
    g.fill();
    if (mat2 !== M_ECTO) {
      g.beginPath();
      g.arc(x2, y2, r * 0.24, 0, Math.PI * 2);
      g.fillStyle = "#efe6d4";
      g.fill();
    }
  }
  function capsule(g, x0, x1, w) {
    g.beginPath();
    g.moveTo(x0, -w);
    g.lineTo(x1, -w);
    g.arc(x1, 0, w, -Math.PI / 2, Math.PI / 2);
    g.lineTo(x0, w);
    g.arc(x0, 0, w, Math.PI / 2, -Math.PI / 2);
    g.closePath();
  }
  function paintGib(g, gb, t4) {
    const s = gb.s;
    const L2 = gb.look;
    const rand = seeded(gb.seed);
    const m = MATS[gb.mat];
    switch (gb.kind) {
      case G_HEAD: {
        g.beginPath();
        g.arc(0, 0, s, 0, Math.PI * 2);
        shade2(g, s, L2.skin);
        if (L2.monster) {
          g.beginPath();
          g.ellipse(s * 0.85, 0, s * 0.6, s * 0.45, 0, 0, Math.PI * 2);
          shade2(g, s * 0.6, L2.cloth);
          g.fillStyle = "#f0e6cc";
          for (let i = -2; i <= 2; i++) {
            g.beginPath();
            g.moveTo(s * 1.25, i * s * 0.14 - s * 0.05);
            g.lineTo(s * 1.5, i * s * 0.14);
            g.lineTo(s * 1.25, i * s * 0.14 + s * 0.05);
            g.fill();
          }
          g.fillStyle = "#ffcc33";
          g.beginPath();
          g.arc(s * 0.35, -s * 0.45, s * 0.14, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillStyle = "#1a0e0a";
          g.beginPath();
          g.arc(s * 0.62, -s * 0.32, s * 0.12, 0, Math.PI * 2);
          g.arc(s * 0.62, s * 0.32, s * 0.12, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "rgba(255,255,255,0.7)";
          g.beginPath();
          g.arc(s * 0.6, -s * 0.36, s * 0.04, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "#5a1a14";
          g.lineWidth = s * 0.1;
          g.beginPath();
          g.moveTo(s * 0.85, -s * 0.2);
          g.quadraticCurveTo(s * 0.95, 0, s * 0.85, s * 0.2);
          g.stroke();
          g.beginPath();
          g.arc(0, 0, s * 1.04, Math.PI * 0.55, Math.PI * 1.45);
          g.quadraticCurveTo(s * 0.5, 0, Math.cos(Math.PI * 0.55) * s * 1.04, Math.sin(Math.PI * 0.55) * s * 1.04);
          shade2(g, s, L2.helm ?? L2.hair);
          if (L2.helm) {
            g.strokeStyle = "rgba(255,255,255,0.35)";
            g.lineWidth = s * 0.08;
            g.beginPath();
            g.arc(0, 0, s * 0.9, Math.PI * 0.75, Math.PI * 1.25);
            g.stroke();
          }
          if (L2.horns) {
            g.fillStyle = "#e8dcc0";
            for (const sg of [-1, 1]) {
              g.beginPath();
              g.moveTo(-s * 0.2, sg * s * 0.8);
              g.quadraticCurveTo(-s * 0.4, sg * s * 1.8, s * 0.3, sg * s * 1.9);
              g.quadraticCurveTo(-s * 0.05, sg * s * 1.5, s * 0.2, sg * s * 0.8);
              g.fill();
            }
          }
        }
        stump(g, -s * 0.95, 0, s * 0.5, gb.mat);
        break;
      }
      case G_ARM:
      case G_LEG: {
        const leg = gb.kind === G_LEG;
        const len = s * (leg ? 3.2 : 2.6);
        const w = s * (leg ? 0.55 : 0.42);
        capsule(g, -len / 2, len / 2, w);
        shade2(g, w * 2, L2.cloth);
        g.strokeStyle = "rgba(0,0,0,0.35)";
        g.lineWidth = w * 0.25;
        g.beginPath();
        g.moveTo(0, -w);
        g.lineTo(rand() * w * 0.4, w);
        g.stroke();
        g.beginPath();
        if (leg) g.ellipse(len / 2 + w * 0.3, w * 0.35, w * 1.25, w * 0.95, 0.3, 0, Math.PI * 2);
        else g.arc(len / 2 + w * 0.2, 0, w * 1.05, 0, Math.PI * 2);
        shade2(g, w * 1.2, leg ? L2.feet : L2.hands);
        if (!leg) {
          g.strokeStyle = "rgba(0,0,0,0.35)";
          g.lineWidth = w * 0.18;
          for (let i = -1; i <= 1; i++) {
            g.beginPath();
            g.moveTo(len / 2 + w * 0.6, i * w * 0.4);
            g.lineTo(len / 2 + w * 1.3, i * w * 0.5);
            g.stroke();
          }
        }
        g.beginPath();
        g.moveTo(-len / 2 - w * 0.2, 0);
        g.lineTo(-len / 2 - w * 1.4, -w * 0.15);
        g.lineTo(-len / 2 - w * 1.5, w * 0.12);
        g.lineTo(-len / 2 - w * 0.2, w * 0.25);
        g.fillStyle = "#e9dfcc";
        g.fill();
        stump(g, -len / 2, 0, w * 1.05, gb.mat);
        break;
      }
      case G_TORSO: {
        g.beginPath();
        g.ellipse(0, 0, s * 1.4, s * 1.05, 0, 0, Math.PI * 2);
        shade2(g, s * 1.3, L2.cloth);
        g.beginPath();
        g.ellipse(-s * 0.3, 0, s * 0.85, s * 0.75, 0, 0, Math.PI * 2);
        g.fillStyle = m.drop[1];
        g.fill();
        g.strokeStyle = "#ecdfc8";
        g.lineWidth = s * 0.16;
        g.lineCap = "round";
        for (let i = -2; i <= 2; i++) {
          g.beginPath();
          g.moveTo(-s * 0.9, i * s * 0.28);
          g.quadraticCurveTo(-s * 0.3, i * s * 0.36 - s * 0.1, s * 0.3, i * s * 0.3);
          g.stroke();
        }
        g.fillStyle = m.drop[0];
        g.beginPath();
        g.arc(-s * 0.2, s * 0.15, s * 0.25, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case G_MEAT:
      case G_CHAR: {
        const charred = gb.kind === G_CHAR || gb.mat === M_CHAR;
        g.beginPath();
        const n2 = 7;
        for (let i = 0; i < n2; i++) {
          const a = i / n2 * Math.PI * 2;
          const r = s * (0.65 + rand() * 0.5);
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        shade2(g, s, charred ? "#1e1612" : m.drop[2]);
        g.fillStyle = charred ? "rgba(255,110,30,0.55)" : m.drop[0];
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc((rand() - 0.5) * s, (rand() - 0.5) * s, s * (0.1 + rand() * 0.18), 0, Math.PI * 2);
          g.fill();
        }
        if (!charred) {
          g.fillStyle = "rgba(255,210,190,0.5)";
          g.beginPath();
          g.ellipse(s * 0.2, -s * 0.2, s * 0.3, s * 0.1, rand() * 3, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case G_GUT: {
        g.lineCap = "round";
        g.lineJoin = "round";
        const path = () => {
          g.beginPath();
          g.moveTo(-s * 1.4, 0);
          g.bezierCurveTo(-s * 0.8, -s * 1.2, s * 0.2, -s * 1.1, s * 0.3, -s * 0.2);
          g.bezierCurveTo(s * 0.4, s * 0.8, -s * 0.6, s * 0.8, -s * 0.3, s * 0.1);
          g.bezierCurveTo(-s * 0.1, -s * 0.5, s * 1.2, -s * 0.3, s * 1.4, s * 0.5);
        };
        path();
        g.strokeStyle = gb.mat === M_BLOOD ? "#a8545a" : m.drop[2];
        g.lineWidth = s * 0.55;
        g.stroke();
        path();
        g.strokeStyle = gb.mat === M_BLOOD ? "#d48a8a" : m.drop[3];
        g.lineWidth = s * 0.22;
        g.stroke();
        break;
      }
      case G_BONE:
      case G_RIB: {
        g.lineCap = "round";
        g.strokeStyle = "#eadfca";
        g.lineWidth = s * 0.35;
        g.beginPath();
        if (gb.kind === G_RIB) {
          g.arc(0, s * 0.8, s * 1.2, Math.PI * 1.15, Math.PI * 1.85);
        } else {
          g.moveTo(-s, 0);
          g.lineTo(s, 0);
        }
        g.stroke();
        if (gb.kind === G_BONE) {
          g.fillStyle = "#f4ead8";
          g.beginPath();
          g.arc(-s, -s * 0.18, s * 0.25, 0, Math.PI * 2);
          g.arc(-s, s * 0.18, s * 0.25, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = m.drop[1];
          g.beginPath();
          g.arc(s, 0, s * 0.22, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case G_ICE: {
        g.beginPath();
        g.arc(0, 0, s * 0.45, 0, Math.PI * 2);
        g.fillStyle = gb.mat === M_ICE ? "#7a1a1a" : m.drop[1];
        g.fill();
        g.beginPath();
        const n2 = 6;
        for (let i = 0; i < n2; i++) {
          const a = i / n2 * Math.PI * 2 + rand() * 0.4;
          const r = s * (0.8 + rand() * 0.5);
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        g.fillStyle = "rgba(190,230,250,0.6)";
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.85)";
        g.lineWidth = s * 0.08;
        g.stroke();
        g.beginPath();
        g.moveTo(-s * 0.5, -s * 0.3);
        g.lineTo(s * 0.1, -s * 0.6);
        g.stroke();
        break;
      }
      case G_ROCK: {
        g.beginPath();
        const n2 = 5 + (rand() * 3 | 0);
        for (let i = 0; i < n2; i++) {
          const a = i / n2 * Math.PI * 2 + rand() * 0.5;
          const r = s * (0.7 + rand() * 0.45);
          if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        shade2(g, s, L2.cloth, "rgba(0,0,0,0.6)");
        g.strokeStyle = "rgba(255,255,255,0.18)";
        g.lineWidth = s * 0.08;
        g.stroke();
        break;
      }
    }
  }
  var dg = null;
  var dcam = null;
  function drawOne(gb) {
    const g = dg;
    const cam2 = dcam;
    if (!g || !cam2) return;
    const sx = cam2.offX + isoX(gb.x, gb.y);
    const sy = cam2.offY + isoY(gb.x, gb.y);
    if (gb.z > 1) {
      g.globalAlpha = Math.max(0.1, 0.4 - gb.z * 4e-3);
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(sx, sy, gb.s * K * 1.1, gb.s * K * SQ * 1.1, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    g.save();
    if (gb.spr) {
      const s = gb.spr;
      const d = s.d ?? 1;
      g.translate(sx, sy - gb.z * ZK2 - 2);
      g.rotate(gb.a * (gb.rest > 0 ? 0.15 : 1));
      if (gb.rest > 60) g.globalAlpha = Math.max(0, 1 - (gb.rest - 60) / 30);
      g.drawImage(s.cv, -gb.sc.x / d, -gb.sc.y / d, s.cv.width / d, s.cv.height / d);
    } else {
      groundTransform(g, sx, sy - gb.z * ZK2);
      g.rotate(gb.a);
      if (gb.rest <= 0 && gb.z > 0) g.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(gb.t * 9 + gb.seed)));
      paintGib(g, gb, gb.t);
    }
    g.restore();
  }
  function drawGibsDepth(push, cam2) {
    dcam = cam2;
    if (!live) return;
    for (const gb of gibs) {
      if (!gb.on) continue;
      const sx = cam2.offX + isoX(gb.x, gb.y);
      const sy = cam2.offY + isoY(gb.x, gb.y);
      if (sx < -60 || sy < -60 || sx > cam2.ww + 60 || sy > cam2.wh + 80) continue;
      push(depthOf(gb.x, gb.y) + (gb.z > 0 ? 6 : -4), gb.draw);
    }
  }
  function setGibContext(g) {
    dg = g;
  }
  function clearGibs() {
    for (const g of gibs) g.on = false;
    live = 0;
  }

  // src/client/gfx/gore/screen.ts
  var STAMPS = 8;
  var MAX3 = 24;
  var spl = Array.from({ length: MAX3 }, () => ({ on: false, v: 0, x: 0, y: 0, s: 0, rot: 0, t: 0, life: 0, run: 0 }));
  var vignette = 0;
  function screenSplat(severity) {
    const a = goreAmount();
    if (a <= 0) return;
    severity = Math.min(1, severity);
    vignette = Math.min(1, vignette + severity * 1.2);
    const n2 = Math.round((1 + severity * 5) * a);
    for (let i = 0; i < n2; i++) {
      let s = spl.find((q) => !q.on);
      if (!s) s = spl.reduce((p, q) => p.t / p.life > q.t / q.life ? p : q);
      const edge2 = Math.random() * 4 | 0;
      const u = Math.random();
      const inset = Math.random() * 0.08;
      s.on = true;
      s.v = Math.random() * STAMPS | 0;
      s.x = edge2 === 0 ? inset : edge2 === 1 ? 1 - inset : u;
      s.y = edge2 === 2 ? inset : edge2 === 3 ? 1 - inset : u;
      s.s = (0.18 + Math.random() * 0.25) * (0.6 + severity * 0.8);
      s.rot = Math.random() * Math.PI * 2;
      s.t = 0;
      s.life = 2.2 + severity * 2.5 + Math.random();
      s.run = 0.04 + Math.random() * 0.12;
    }
  }

  // src/client/gfx/gore/index.ts
  var players = /* @__PURE__ */ new Map();
  var monsters = /* @__PURE__ */ new Map();
  var selfId = -1;
  var living = /* @__PURE__ */ new Map();
  var familyOf = /* @__PURE__ */ new Map();
  for (const t4 of ROSTER) {
    const f = t4.family;
    if (f) familyOf.set(t4.id, f);
  }
  function monColor(k) {
    return MONSTER_BY_ID.get(k)?.color ?? ROSTER.find((t4) => t4.id === k)?.color ?? "#6a5a4a";
  }
  var HELM = { hood: "#3b3328", coif: "#8a8c90", helm_open: "#9aa0a8", helm_great: "#a4aab2", helm_horned: "#8e949c", circlet: "#d4b048" };
  var BODY = {
    body_leather: "#6b4a2e",
    body_scale: "#6f7562",
    body_mail: "#80848c",
    body_plate: "#a8aeb6",
    body_robe: "#4a3a62",
    body_brigandine: "#5a3a2a",
    body_plate_robe: "#7a7e8a",
    body_scale_robe: "#4e5a4a"
  };
  var GLOVE = { gloves_wrap: "#8a7a62", gloves_leather: "#5a3e26", gloves_gauntlet: "#9aa0a8", gloves_silk: "#6a4a7a" };
  var BOOT = { boots_wrap: "#7a6a52", boots_soft: "#4a3422", boots_greave: "#8e949c", boots_slipper: "#4a3a5a" };
  var SKIN = "#c49072";
  function playerLook(lk, color) {
    try {
      const L2 = decodeLook(lk);
      return {
        skin: SKIN,
        cloth: BODY[L2.body] ?? color ?? "#5a4a3a",
        hands: GLOVE[L2.gloves] ?? SKIN,
        feet: BOOT[L2.boots] ?? "#3a2a1e",
        helm: HELM[L2.helmet] ?? null,
        hair: "#2a1e16",
        horns: L2.helmet === "helm_horned"
      };
    } catch {
      return { skin: SKIN, cloth: color ?? "#5a4a3a", hands: SKIN, feet: "#3a2a1e", helm: null, hair: "#2a1e16" };
    }
  }
  function monsterLook(k) {
    const c = monColor(k);
    return { skin: c, cloth: shadeHex(c, 0.75), hands: c, feet: shadeHex(c, 0.6), helm: null, hair: shadeHex(c, 0.5), monster: true };
  }
  function shadeHex(hex, k) {
    const n2 = parseInt(hex.slice(1), 16);
    const r = Math.round((n2 >> 16 & 255) * k);
    const g = Math.round((n2 >> 8 & 255) * k);
    const b = Math.round((n2 & 255) * k);
    return `rgb(${r},${g},${b})`;
  }
  var MAXC = 220;
  var corpses = [];
  for (let i = 0; i < MAXC; i++) {
    const c = { on: false, kind: "m", id: 0, x: 0, y: 0, r: 0, mat: 0, elem: "p", t: 0, shatterAt: 0, hits: 0, look: monsterLook(""), hidden: false, missing: [], tint: null, tintA: 0, sink: 0, draw: () => drawCorpseOverlay(c) };
    corpses.push(c);
  }
  var corpseKey = /* @__PURE__ */ new Map();
  function newCorpse(kind2, id, x2, y2, r, mat2, elem, look) {
    let c = corpses.find((q) => !q.on);
    if (!c) c = corpses.reduce((a, b) => a.t > b.t ? a : b);
    corpseKey.delete(c.kind + ":" + c.id);
    Object.assign(c, { on: true, kind: kind2, id, x: x2, y: y2, r, mat: mat2, elem, t: 0, shatterAt: 0, hits: 0, look, hidden: false, missing: [], tint: null, tintA: 0, sink: 0 });
    corpseKey.set(kind2 + ":" + id, c);
    return c;
  }
  function goreCorpse(kind2, id) {
    if (goreAmount() <= 0) return null;
    const c = corpseKey.get(kind2 + ":" + id);
    return c && c.on ? c : null;
  }
  function goreWeaponBlood(playerId) {
    return goreAmount() > 0 ? living.get("p:" + playerId)?.coat ?? 0 : 0;
  }
  var hitStop = 0;
  var E_ARTERY = 0;
  var E_NECK = 1;
  var E_SMOKE = 2;
  var E_ARC = 3;
  var E_WISP = 4;
  var emitters = Array.from({ length: 96 }, () => ({ on: false, type: 0, key: "", x: 0, y: 0, z: 0, a: 0, mat: 0, t: 0, life: 0, acc: 0, power: 1 }));
  function emit2(type, key, x2, y2, z2, a, mat2, life2, power = 1) {
    let e = emitters.find((q) => !q.on);
    if (!e) e = emitters.reduce((p, q) => p.t / p.life > q.t / q.life ? p : q);
    Object.assign(e, { on: true, type, key, x: x2, y: y2, z: z2, a, mat: mat2, t: 0, life: life2, acc: 0, power });
  }
  function spray(x2, y2, z2, a, mat2, frac, crit, elem) {
    const f = Math.min(1.6, frac);
    const n2 = goreCount(8 + f * 70 + (crit ? 45 : 0));
    const spread = 0.45 + (1 - Math.min(1, f)) * 0.35;
    for (let i = 0; i < n2; i++) {
      const back = rnd() < 0.12;
      const ang = (back ? a + Math.PI : a) + (rnd() + rnd() + rnd() - 1.5) * spread * 1.4;
      const sp = rr(70, 190 + f * 260) * (back ? 0.4 : 1);
      const big = rnd() < 0.12;
      spawnP(big ? P_CLOT : P_DROP, mat2, x2 + rr(-4, 4), y2 + rr(-4, 4), z2 + rr(-6, 6), Math.cos(ang) * sp, Math.sin(ang) * sp, rr(10, 120 + f * 80), 3, (big ? rr(1.6, 2.8) : rr(0.6, 1.8)) * (0.9 + f * 0.4));
    }
    const mist = goreCount(3 + f * 10 + (crit ? 10 : 0));
    for (let i = 0; i < mist; i++) {
      const ang = a + rr(-0.6, 0.6);
      const sp = rr(30, 110);
      spawnP(P_MIST, mat2, x2, y2, z2, Math.cos(ang) * sp, Math.sin(ang) * sp, rr(0, 30), rr(0.35, 0.7), rr(2, 4) * (1 + f));
    }
    if (elem === "f") for (let i = 0; i < goreCount(8 + f * 16); i++) spawnP(P_EMBER, M_CHAR, x2, y2, z2, rr(-60, 60), rr(-60, 60), rr(30, 120), rr(0.4, 1), rr(0.5, 1.2));
    if (elem === "c") for (let i = 0; i < goreCount(5 + f * 14); i++) spawnP(P_SHARD, M_ICE, x2, y2, z2, Math.cos(a) * rr(60, 200) + rr(-40, 40), Math.sin(a) * rr(60, 200) + rr(-40, 40), rr(60, 160), rr(1, 2.5), rr(0.8, 2));
    if (elem === "l") for (let i = 0; i < goreCount(6 + f * 12); i++) spawnP(P_SPARK, M_BLOOD, x2, y2, z2, rr(-180, 180), rr(-180, 180), rr(-40, 160), rr(0.1, 0.25), rr(0.8, 1.4));
    if (elem === "x") for (let i = 0; i < goreCount(4 + f * 10); i++) spawnP(P_DROP, M_CHAOS, x2, y2, z2, Math.cos(a) * rr(40, 160), Math.sin(a) * rr(40, 160), rr(20, 100), 3, rr(0.8, 1.8));
    if (mat2 === M_DUST) for (let i = 0; i < goreCount(3 + f * 10); i++) spawnP(P_SHARD, M_DUST, x2, y2, z2, Math.cos(a) * rr(60, 220), Math.sin(a) * rr(60, 220), rr(50, 150), rr(0.8, 2), rr(0.8, 2.2));
    if (mat2 === M_UNDEAD && rnd() < 0.3 + f) spawnP(P_SHARD, M_UNDEAD, x2, y2, z2, Math.cos(a) * rr(60, 180), Math.sin(a) * rr(60, 180), rr(60, 150), rr(1.2, 3), rr(0.8, 1.6));
  }
  function splatAt(x2, y2, r, mat2, a, power) {
    if (mat2 === M_DUST) return;
    const sd = rnd() * 1e9 | 0;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    stamp(x2, y2, r * 4, (g) => paintSplat(g, mat2, r, dx, dy, sd, power));
  }
  function onDeath(kind2, id, x2, y2, r, mat2, look, fx, pvp, src) {
    const amt = goreAmount();
    if (amt <= 0) return;
    const elem = fx.dt ?? "p";
    const prev = kind2 === "p" ? players.get(id) : monsters.get(id);
    const maxL = fx.mx ?? (prev ? kind2 === "p" ? prev.maxHp : prev.mhp : 100) ?? 100;
    const ok = fx.ok ?? 0;
    let a;
    if (fx.dx !== void 0 && fx.dy !== void 0) a = Math.atan2(fx.dy, fx.dx);
    else a = src.ang !== void 0 ? src.ang + Math.PI : rnd() * Math.PI * 2;
    const crit = !!fx.cr;
    const lvl = goreLevel();
    const massive = ok > 0.5 * maxL || fx.fo === "area" && ok > 0.2 * maxL;
    const c = newCorpse(kind2, id, x2, y2, r, mat2, elem, look);
    c.lk = src.lk;
    c.color = src.color;
    c.wk = src.wk;
    c.mk = src.mk;
    const z2 = r * 1.1;
    spray(x2, y2, z2, a, mat2, pvp ? 1.6 : 0.9, crit, elem);
    if (pvp) {
      hitStop = 0.16;
      spray(x2, y2, z2, a + Math.PI * 0.5, mat2, 1.2, true, elem);
      spray(x2, y2, z2, a - Math.PI * 0.5, mat2, 1.2, true, elem);
      for (let i = 0; i < 6; i++) splatAt(x2 + rr(-40, 40), y2 + rr(-40, 40), rr(6, 14), mat2, rnd() * 6.28, 1);
      if (fx.cr === void 0 && selfId >= 0 && id === selfId) screenSplat(1);
    }
    let explodeIt = lvl !== "reduced" && (massive || crit && lvl === "extreme" || pvp && rnd() < 0.55);
    if (lvl === "full" && !massive) explodeIt = false;
    switch (elem) {
      case "c": {
        c.tint = "#bfe8ff";
        c.tintA = 0.6;
        c.shatterAt = explodeIt ? 0.15 : rr(1.3, 2.4);
        stamp(x2, y2, r * 2.2, (g) => paintFrost(g, r * 1.6, id * 7 + 3));
        break;
      }
      case "f": {
        c.tint = "#120c08";
        c.tintA = 0.78;
        emit2(E_SMOKE, "", x2, y2, 0, 0, M_CHAR, 9);
        stamp(x2, y2, r * 2.4, (g) => paintScorch(g, r * 1.7, id * 13 + 1));
        if (explodeIt) explode(c, a, 1, true);
        break;
      }
      case "l": {
        c.tint = "#1a1a22";
        c.tintA = 0.65;
        emit2(E_ARC, "", x2, y2, 0, 0, M_BLOOD, 3.2);
        stamp(x2, y2, r * 2.8, (g) => paintLichtenberg(g, r * 2.2, id * 17 + 5));
        if (explodeIt) explode(c, a, 1);
        else addPool(x2, y2, r * 1.2, mat2, 4);
        break;
      }
      case "x": {
        c.tint = "#1c2a08";
        c.tintA = 0.55;
        addPool(x2, y2, r * 2, M_CHAOS, 4, 7);
        for (let i = 0; i < goreCount(20); i++) spawnP(P_SMOKE, M_CHAOS, x2 + rr(-r, r), y2 + rr(-r, r), 2, 0, 0, rr(10, 24), rr(1, 2), rr(2, 4));
        break;
      }
      default: {
        if (mat2 === M_DUST) {
          rockBurst(c, a, explodeIt ? 1.3 : 0.7);
          break;
        }
        if (mat2 === M_ECTO) {
          emit2(E_WISP, "", x2, y2, 0, 0, M_ECTO, 3.5);
          for (let i = 0; i < goreCount(30); i++) spawnP(P_WISP, M_ECTO, x2 + rr(-r, r), y2 + rr(-r, r), rr(4, 20), rr(-40, 40), rr(-40, 40), rr(20, 70), rr(1, 2), rr(3, 7));
          stamp(x2, y2, r * 2, (g) => paintEcto(g, r * 1.5, id * 3 + 1));
          c.tint = "#7affe0";
          c.tintA = 0.35;
          if (explodeIt) explode(c, a, 0.8);
          break;
        }
        if (explodeIt) explode(c, a, pvp ? 1.5 : 1.1);
        else if (lvl !== "reduced") dismember(c, a, pvp);
        addPool(x2, y2, r * (pvp ? 2.6 : 1.6), mat2, 4);
        break;
      }
    }
    goreSound(pvp ? "gore.explode" : "gore.splat", x2, y2, pvp ? 1 : 0.8);
  }
  function dismember(c, a, pvp) {
    const lvl = goreLevel();
    const chance = lvl === "extreme" ? 0.9 : 0.5;
    if (rnd() > chance && !pvp) return;
    const regions = [];
    const pool = ["head", "armL", "armR", "legL", "legR"];
    const nCut = lvl === "extreme" ? pvp ? 3 : 1 + (rnd() * 2.2 | 0) : 1;
    if (rnd() < (lvl === "extreme" ? 0.6 : 0.35) || pvp) regions.push("head");
    while (regions.length < nCut) {
      const r = pick(pool);
      if (!regions.includes(r)) regions.push(r);
    }
    c.missing = regions;
    for (const reg of regions) severPiece(c, reg, a);
    goreSound("gore.dismember", c.x, c.y, 1);
    goreSound("gore.bonecrack", c.x, c.y, 0.7);
  }
  var REG_KIND = { head: G_HEAD, armL: G_ARM, armR: G_ARM, legL: G_LEG, legR: G_LEG, torso: G_TORSO };
  function severPiece(c, reg, a) {
    const ang = a + rr(-0.9, 0.9);
    const sp = rr(110, 240) * (reg === "head" ? 1.2 : 1);
    const z2 = reg === "head" ? c.r * 1.6 : reg.startsWith("leg") ? c.r * 0.5 : c.r * 1.1;
    let spr = null;
    if (c.kind === "p" && c.lk !== void 0) {
      try {
        spr = heroFrame({ look: decodeLook(c.lk), color: c.color ?? "#888", wk: c.wk ?? null, only: reg }, c.lk, dirN(ang, 16), "death", 5);
      } catch {
        spr = null;
      }
    }
    spawnGib(REG_KIND[reg], c.mat, c.x, c.y, z2, Math.cos(ang) * sp, Math.sin(ang) * sp, rr(160, 300), c.r * (reg === "head" ? 0.42 : 0.4), c.look, spr);
    emit2(reg === "head" ? E_NECK : E_ARTERY, "", c.x, c.y, reg === "head" ? c.r * 0.9 : c.r * 0.6, reg === "head" ? rnd() * 6.28 : ang, c.mat, reg === "head" ? 2.6 : 1.4, reg === "head" ? 1.2 : 0.8);
  }
  function explode(c, a, power, charred = false) {
    if (c.hidden) return;
    c.hidden = true;
    const { x: x2, y: y2, r, mat: mat2 } = c;
    const k = goreAmount();
    const mt = charred ? M_CHAR : mat2;
    const out = (z2, s) => {
      const ang = a + rr(-1.6, 1.6) + (rnd() < 0.3 ? Math.PI : 0);
      const sp = rr(90, 300) * power;
      return [Math.cos(ang) * sp, Math.sin(ang) * sp, rr(150, 360) * power, z2, s];
    };
    if (c.kind === "p" && !charred) for (const reg of ["head", "armL", "armR", "legL", "legR", "torso"]) severPiece(c, reg, a + rr(-1.5, 1.5));
    else {
      const kinds = charred ? [G_CHAR, G_CHAR, G_CHAR, G_BONE] : [G_HEAD, G_ARM, G_ARM, G_LEG, G_LEG, G_TORSO];
      for (const kk of kinds) {
        const [vx2, vy2, vz2, z2, s] = out(r, r * (kk === G_TORSO ? 0.45 : 0.4));
        spawnGib(kk, mt, x2, y2, z2, vx2, vy2, vz2, s, c.look);
      }
    }
    const nMeat = Math.round((6 + 8 * power) * k);
    for (let i = 0; i < nMeat; i++) {
      const [vx2, vy2, vz2, , s] = out(r, rr(1.5, 3.5));
      spawnGib(charred ? G_CHAR : G_MEAT, mt, x2, y2, r * 0.8, vx2, vy2, vz2, s, c.look);
    }
    if (!charred) {
      for (let i = 0; i < Math.round(3 * k); i++) {
        const [vx2, vy2, vz2] = out(r, 0);
        spawnGib(G_GUT, mat2, x2, y2, r * 0.7, vx2 * 0.6, vy2 * 0.6, vz2 * 0.7, rr(3, 4.5), c.look);
      }
      for (let i = 0; i < Math.round(5 * k); i++) {
        const [vx2, vy2, vz2] = out(r, 0);
        spawnGib(rnd() < 0.5 ? G_BONE : G_RIB, mat2, x2, y2, r, vx2, vy2, vz2, rr(2.5, 4), c.look);
      }
    }
    for (let i = 0; i < goreCount(30); i++) spawnP(P_SHARD, M_UNDEAD, x2, y2, r, rr(-260, 260) * power, rr(-260, 260) * power, rr(80, 260), rr(1.5, 3), rr(0.6, 1.4));
    if (mt !== M_CHAR) {
      for (let i = 0; i < 4; i++) spray(x2, y2, r, i / 4 * Math.PI * 2 + rr(-0.3, 0.3), mat2, 1.4 * power, true, "p");
      const ring = Math.round(12 * k);
      for (let i = 0; i < ring; i++) {
        const ang = i / ring * Math.PI * 2 + rr(-0.2, 0.2);
        const d = r * rr(1.4, 3.6) * power;
        splatAt(x2 + Math.cos(ang) * d, y2 + Math.sin(ang) * d, rr(5, 12), mat2, ang, 1);
      }
      addPool(x2, y2, r * 2.4 * power, mat2, 3);
    } else {
      for (let i = 0; i < goreCount(40); i++) spawnP(P_EMBER, M_CHAR, x2, y2, r, rr(-200, 200), rr(-200, 200), rr(40, 200), rr(0.6, 1.6), rr(0.6, 1.4));
      for (let i = 0; i < goreCount(14); i++) spawnP(P_SMOKE, M_CHAR, x2 + rr(-10, 10), y2 + rr(-10, 10), r, rr(-30, 30), rr(-30, 30), rr(20, 50), rr(1.5, 3), rr(4, 8));
    }
    goreSound("gore.explode", x2, y2, 1);
    goreSound("gore.gib", x2, y2, 0.9);
    goreSound("gore.bonecrack", x2, y2, 0.8, 0.8);
  }
  function rockBurst(c, a, power) {
    const { x: x2, y: y2, r } = c;
    if (power > 1) c.hidden = true;
    const n2 = Math.round((power > 1 ? 14 : 6) * goreAmount());
    for (let i = 0; i < n2; i++) {
      const ang = a + rr(-2, 2);
      const sp = rr(60, 240) * power;
      spawnGib(G_ROCK, M_DUST, x2, y2, r * 0.9, Math.cos(ang) * sp, Math.sin(ang) * sp, rr(100, 280) * power, rr(2.5, 6), c.look);
    }
    for (let i = 0; i < goreCount(40 * power); i++) spawnP(P_SMOKE, M_DUST, x2 + rr(-r, r), y2 + rr(-r, r), rr(2, r), rr(-60, 60), rr(-60, 60), rr(6, 30), rr(0.8, 1.8), rr(3, 7));
    for (let i = 0; i < goreCount(30 * power); i++) spawnP(P_SHARD, M_DUST, x2, y2, r, rr(-220, 220), rr(-220, 220), rr(60, 220), rr(1, 2.4), rr(0.8, 2));
    goreSound("gore.bonecrack", x2, y2, 1, 0.6);
  }
  var drawG = null;
  var drawCam = null;
  function drawCorpseOverlay(c) {
    const g = drawG;
    const cam2 = drawCam;
    if (!g || !cam2 || c.hidden) return;
    const sx = cam2.offX + isoX(c.x, c.y);
    const sy = cam2.offY + isoY(c.x, c.y);
    if (c.elem === "c" && c.shatterAt > 0) {
      const k = Math.min(1, c.t / 0.25);
      const R8 = c.r * 1.25;
      g.save();
      g.globalAlpha = 0.55 * k;
      const grd = g.createLinearGradient(sx - R8, sy - R8 * 1.2, sx + R8, sy);
      grd.addColorStop(0, "rgba(240,252,255,0.9)");
      grd.addColorStop(0.5, "rgba(150,210,240,0.5)");
      grd.addColorStop(1, "rgba(90,160,210,0.7)");
      g.fillStyle = grd;
      g.beginPath();
      const n2 = 9;
      for (let i = 0; i < n2; i++) {
        const a = i / n2 * Math.PI * 2;
        const rr22 = R8 * (0.75 + 0.35 * ((c.id * 31 + i * 17) % 10 / 10));
        const px = sx + Math.cos(a) * rr22;
        const py = sy - R8 * 0.45 + Math.sin(a) * rr22 * 0.6;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.globalAlpha = 0.9 * k;
      g.strokeStyle = "rgba(255,255,255,0.8)";
      g.lineWidth = 0.6;
      g.stroke();
      const crack = Math.max(0, (c.t - c.shatterAt * 0.4) / (c.shatterAt * 0.6));
      if (crack > 0) {
        g.strokeStyle = "rgba(255,255,255,0.95)";
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + c.id;
          g.moveTo(sx, sy - R8 * 0.45);
          g.lineTo(sx + Math.cos(a) * R8 * crack, sy - R8 * 0.45 + Math.sin(a) * R8 * 0.6 * crack);
        }
        g.stroke();
      }
      g.restore();
    }
  }
  function drawArcs(g, cam2) {
    for (const e of emitters) {
      if (!e.on || e.type !== E_ARC) continue;
      if (rnd() < 0.45) continue;
      const sx = cam2.offX + isoX(e.x, e.y);
      const sy = cam2.offY + isoY(e.x, e.y);
      if (sx < -60 || sy < -60 || sx > cam2.ww + 60 || sy > cam2.wh + 60) continue;
      const f = 1 - e.t / e.life;
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 2; k++) {
        let x2 = sx + rr(-16, 16);
        let y2 = sy - rr(0, 10);
        const tx = sx + rr(-18, 18);
        const ty = sy - rr(0, 16);
        g.strokeStyle = k ? `rgba(240,248,255,${0.9 * f})` : `rgba(110,160,255,${0.5 * f})`;
        g.lineWidth = k ? 0.6 : 2;
        g.beginPath();
        g.moveTo(x2, y2);
        for (let i = 1; i <= 5; i++) {
          x2 += (tx - x2) / (6 - i) + rr(-3, 3);
          y2 += (ty - y2) / (6 - i) + rr(-3, 3);
          g.lineTo(x2, y2);
        }
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";
    }
  }
  addLayer("ground", (g, cam2) => {
    drawG = g;
    setGibContext(g);
    drawDecals(g, cam2, cam2.time);
  });
  addLayer("depth", (push, cam2) => {
    if (goreAmount() <= 0) return;
    drawCam = cam2;
    for (const c of corpses) {
      if (!c.on || c.hidden || c.elem !== "c" || c.shatterAt <= 0) continue;
      const sx = cam2.offX + isoX(c.x, c.y);
      if (sx < -80 || sx > cam2.ww + 80) continue;
      push(depthOf(c.x, c.y) + 2, c.draw);
    }
    drawGibsDepth(push, cam2);
  });
  addLayer("over", (g, cam2) => {
    drawG = g;
    setGibContext(g);
    drawCam = cam2;
    drawParticles(g, cam2, false);
  });
  addLayer("fx", (g, cam2) => {
    drawParticles(g, cam2, true);
    drawArcs(g, cam2);
  });
  function goreReset() {
    clearDecals();
    clearGibs();
    clearParticles();
    for (const c of corpses) c.on = false;
    corpseKey.clear();
    for (const e of emitters) e.on = false;
    living.clear();
  }
  onMapChange(() => goreReset());
  function goreDemo(x2, y2, hurt = false) {
    const me = players.get(selfId);
    const lk = me?.lk;
    x2 ?? (x2 = me?.x ?? 0);
    y2 ?? (y2 = me?.y ?? 0);
    if (hurt) screenSplat(0.8);
    const types = ["p", "p", "f", "c", "l", "x"];
    types.forEach((el, i) => {
      const a = i / types.length * Math.PI * 2;
      const px = x2 + Math.cos(a) * 110;
      const py = y2 + Math.sin(a) * 110;
      const id = 9e5 + (rnd() * 99999 | 0);
      onDeath("p", id, px, py, 20, M_BLOOD, playerLook(lk, "#a33"), { dt: el, cr: i === 1 ? 1 : void 0, ok: i === 1 ? 999 : 0, mx: 100 }, false, { lk, color: "#a33", wk: "sword" });
    });
  }
  if (typeof window !== "undefined") window.hnsGore = goreDemo;

  // src/client/audio/music.ts
  var BIOMES2 = {
    hollowpine: { root: 38, scale: [0, 2, 3, 5, 7, 8, 10], windF: 520, windQ: 1.2, bpm: 84, bell: "pluck" },
    gloamwater: { root: 37, scale: [0, 1, 3, 5, 7, 8, 10], windF: 300, windQ: 2, bpm: 76, bell: "bell" },
    brokenspire: { root: 33, scale: [0, 1, 3, 5, 6, 8, 10], windF: 950, windQ: 6, bpm: 92, bell: "metal" }
  };
  var MENU = { root: 38, scale: [0, 2, 3, 5, 7, 9, 10], windF: 400, windQ: 1, bpm: 60, bell: "bell" };
  var rs = 49721811;
  var rnd2 = () => {
    rs ^= rs << 13;
    rs ^= rs >>> 17;
    rs ^= rs << 5;
    return (rs >>> 0) % 1e5 / 1e5;
  };
  var Scene = class {
    constructor(e, kind2, biome, m) {
      this.e = e;
      this.kind = kind2;
      this.biome = biome;
      this.m = m;
      __publicField(this, "out");
      __publicField(this, "oscs", []);
      __publicField(this, "motifG");
      __publicField(this, "combatG");
      __publicField(this, "lateG");
      __publicField(this, "droneLp");
      __publicField(this, "nextMotif", 0);
      __publicField(this, "nextStep", 0);
      __publicField(this, "step", 0);
      __publicField(this, "combat", 0);
      __publicField(this, "late", 0);
      __publicField(this, "dead", false);
      const ctx = e.ctx;
      const now4 = ctx.currentTime;
      this.out = ctx.createGain();
      this.out.gain.setValueAtTime(1e-4, now4);
      this.out.gain.exponentialRampToValueAtTime(1, now4 + 3);
      this.out.connect(e.music);
      const verbSend = ctx.createGain();
      verbSend.gain.value = 0.5;
      this.out.connect(verbSend).connect(e.musicVerb);
      this.droneLp = ctx.createBiquadFilter();
      this.droneLp.type = "lowpass";
      this.droneLp.frequency.value = kind2 === "match" ? 260 : 420;
      this.droneLp.Q.value = 3;
      const droneG = ctx.createGain();
      droneG.gain.value = kind2 === "match" ? 0.16 : 0.13;
      this.droneLp.connect(droneG).connect(this.out);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + rnd2() * 0.04;
      const lfoG = ctx.createGain();
      lfoG.gain.value = kind2 === "match" ? 120 : 200;
      lfo.connect(lfoG).connect(this.droneLp.frequency);
      this.start(lfo);
      const notes = kind2 === "match" ? [0, 7, -12] : [0, 7, 12, 15];
      for (const n2 of notes)
        for (const d of [-7, 6]) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = midi(m.root + n2);
          o.detune.value = d + rnd2() * 3;
          const g = ctx.createGain();
          g.gain.value = 1 / notes.length;
          o.connect(g).connect(this.droneLp);
          this.start(o);
        }
      const wind = ctx.createBufferSource();
      wind.buffer = e.noise.brown;
      wind.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = m.windF;
      bp.Q.value = m.windQ;
      const wlfo = ctx.createOscillator();
      wlfo.frequency.value = 0.07 + rnd2() * 0.05;
      const wlg = ctx.createGain();
      wlg.gain.value = m.windF * 0.5;
      wlfo.connect(wlg).connect(bp.frequency);
      const wg = ctx.createGain();
      wg.gain.value = kind2 === "match" ? 0.5 : 0.25;
      wind.connect(bp).connect(wg).connect(this.out);
      this.start(wind);
      this.start(wlfo);
      this.motifG = ctx.createGain();
      this.motifG.gain.value = 0.9;
      this.motifG.connect(this.out);
      this.combatG = ctx.createGain();
      this.combatG.gain.value = 1e-4;
      this.combatG.connect(this.out);
      this.lateG = ctx.createGain();
      this.lateG.gain.value = 1e-4;
      this.lateG.connect(this.out);
      const trem = ctx.createGain();
      trem.gain.value = 0.5;
      const tl = ctx.createOscillator();
      tl.frequency.value = 6.5;
      const tlg = ctx.createGain();
      tlg.gain.value = 0.5;
      tl.connect(tlg).connect(trem.gain);
      const tlp = ctx.createBiquadFilter();
      tlp.type = "lowpass";
      tlp.frequency.value = 2400;
      trem.connect(tlp).connect(this.lateG);
      this.start(tl);
      for (const n2 of [24, 25, 31]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = midi(m.root + n2);
        const g = ctx.createGain();
        g.gain.value = 0.03;
        o.connect(g).connect(trem);
        this.start(o);
      }
      this.nextMotif = now4 + 2 + rnd2() * 3;
      this.nextStep = now4 + 0.5;
    }
    start(n2) {
      n2.start();
      this.oscs.push(n2);
    }
    v(out, t4) {
      return { e: this.e, ctx: this.e.ctx, out, verb: this.e.musicVerb, t: t4, p: 1, r: rnd2 };
    }
    setLevels(combat, late) {
      if (this.dead) return;
      const t4 = this.e.ctx.currentTime;
      this.combat = combat;
      this.late = late;
      this.combatG.gain.setTargetAtTime(Math.max(1e-4, combat * 0.9), t4, combat > 0.5 ? 0.6 : 2.5);
      this.lateG.gain.setTargetAtTime(Math.max(1e-4, late * 0.8), t4, 2);
      this.droneLp.frequency.setTargetAtTime((this.kind === "match" ? 260 : 420) + combat * 500 + late * 200, t4, 1.5);
    }
    /** Schedule events up to `until`. */
    schedule(until) {
      if (this.dead) return;
      const m = this.m;
      while (this.nextMotif < until) {
        const t4 = this.nextMotif;
        const deg = m.scale[Math.floor(rnd2() * m.scale.length)];
        const oct = rnd2() < 0.3 ? 36 : 24;
        const f = midi(m.root + oct + deg);
        const v2 = this.v(this.motifG, t4);
        const notes = rnd2() < 0.35 ? 2 : 1;
        for (let i = 0; i < notes; i++) {
          const vv = { ...v2, t: t4 + i * (0.4 + rnd2() * 0.5) };
          const ff = i ? midi(m.root + oct + m.scale[Math.floor(rnd2() * m.scale.length)]) : f;
          if (m.bell === "pluck") fm(vv, { f: ff, ratio: 2, index: ff * 1.2, dur: 2.4, vol: 0.07, noPitch: true });
          else if (m.bell === "bell") metal(vv, { f: ff, ratios: [1, 2, 3.01, 4.17], dur: 4, vol: 0.06, decayK: 0.7 });
          else metal(vv, { f: ff, ratios: [1, 2.32, 3.73, 5.1], dur: 3, vol: 0.05, decayK: 0.65 });
        }
        if (rnd2() < 0.3) tone(v2, { type: "triangle", f: midi(m.root + 12 + m.scale[4]), dur: 5, a: 2.5, vol: 0.05, curve: "lin", noPitch: true });
        const busy = this.kind === "match" ? this.combat : 0;
        this.nextMotif = t4 + (this.kind === "match" ? 4 : 3) + rnd2() * 6 - busy * 2.5;
      }
      const stepDur = 60 / m.bpm / 4;
      while (this.nextStep < until) {
        const t4 = this.nextStep;
        const s = this.step % 16;
        if (this.kind === "match") this.combatStep(t4, s);
        else if (this.kind === "lobby" && (s === 0 || s === 3)) this.kick(this.out, t4, s === 0 ? 0.25 : 0.15, 55);
        if (this.kind === "match" && this.late > 0.05 && s % 4 === 0) {
          noise(this.v(this.lateG, t4), { dur: 0.03, vol: s === 0 ? 0.5 : 0.3, filter: { type: "bandpass", f: s === 0 ? 1800 : 2600, q: 6 } });
        }
        this.nextStep += stepDur;
        this.step++;
      }
    }
    kick(out, t4, vol, f = 60) {
      tone(this.v(out, t4), { type: "sine", f: f * 1.8, f2: f * 0.6, glide: 0.12, dur: 0.35, vol, noPitch: true });
    }
    combatStep(t4, s) {
      if (this.combat < 0.03) return;
      const g = this.combatG;
      const m = this.m;
      const bar2 = Math.floor(this.step / 16) % 4;
      if (s === 0 || s === 6 || s === 10) this.kick(g, t4, s === 0 ? 0.55 : 0.4, 50);
      if (this.combat > 0.45 && (s === 4 || s === 12)) {
        noise(this.v(g, t4), { color: "pink", dur: 0.18, vol: 0.25, filter: { type: "bandpass", f: 260, q: 2 } });
        tone(this.v(g, t4), { type: "sine", f: 140, f2: 90, dur: 0.2, vol: 0.2, noPitch: true });
      }
      if (this.combat > 0.7 && bar2 === 3 && s >= 12) tone(this.v(g, t4), { type: "sine", f: 180 - (s - 12) * 15, f2: 90, dur: 0.15, vol: 0.18, noPitch: true });
      if (s % 2 === 0) {
        const off = s >= 12 ? bar2 % 2 ? m.scale[1] : m.scale[5] - 12 : 0;
        tone(this.v(g, t4), { type: "sawtooth", f: midi(m.root - 12 + off), dur: 0.22, a: 0.01, vol: s % 4 === 0 ? 0.14 : 0.09, noPitch: true, filter: { type: "lowpass", f: 500, f2: 200, q: 4 } });
      }
      if (this.combat > 0.6 && s === 14 && rnd2() < 0.5) noise(this.v(g, t4), { dur: 0.25, a: 0.15, vol: 0.06, curve: "lin", filter: { type: "bandpass", f: 3500, q: 8 } });
    }
    stop() {
      this.dead = true;
      const t4 = this.e.ctx.currentTime;
      this.out.gain.cancelScheduledValues(t4);
      this.out.gain.setTargetAtTime(1e-4, t4, 0.6);
      const oscs = this.oscs;
      setTimeout(() => {
        for (const o of oscs) {
          try {
            o.stop();
          } catch {
          }
        }
        this.out.disconnect();
      }, 4e3);
    }
  };
  var state = { scene: "none", biome: "hollowpine", combat: 0, late: 0 };
  var scene = null;
  var timer = null;
  var sent = { c: 0, l: 0 };
  function rebuild(e) {
    const want = state.scene;
    const biome = state.biome;
    if (scene && scene.kind === want && (want !== "match" || scene.biome === biome)) return;
    scene?.stop();
    scene = null;
    if (want === "none") return;
    scene = new Scene(e, want, biome, want === "match" ? BIOMES2[biome] ?? BIOMES2.hollowpine : MENU);
    scene.setLevels(state.combat, state.late);
    sent.c = state.combat;
    sent.l = state.late;
  }
  function tick2() {
    const e = engineAny();
    if (!e || e.ctx.state !== "running") return;
    rebuild(e);
    scene?.schedule(e.ctx.currentTime + 0.35);
  }
  onEngineReady(() => {
    if (!timer) timer = setInterval(tick2, 100);
  });
  var music = {
    /** Merge a partial state. Cheap: call every frame if convenient. */
    setState(s) {
      const combat = s.combat !== void 0 ? Math.max(0, Math.min(1, s.combat)) : state.combat;
      const late = s.late !== void 0 ? Math.max(0, Math.min(1, s.late)) : state.late;
      Object.assign(state, s, { combat, late });
      if (Math.abs(combat - sent.c) > 0.03 || Math.abs(late - sent.l) > 0.03 || combat === 0 && sent.c !== 0) {
        sent.c = combat;
        sent.l = late;
        scene?.setLevels(combat, late);
      }
    },
    getState() {
      return state;
    }
  };

  // src/client/audio/game.ts
  var now3 = () => performance.now() / 1e3;
  var menuScene = "menu";
  function setMenuScene(s) {
    menuScene = s;
  }
  var lastT = now3();

  // src/client/audio/index.ts
  registerUiSound((id) => sfx.play(id));
  var hnsMusic = {
    ...music,
    setState(s) {
      if (s.scene === "menu" || s.scene === "lobby") setMenuScene(s.scene);
      music.setState(s);
    }
  };
  if (typeof window !== "undefined") Object.assign(window, { hnsMusic, hnsSfx: sfx });

  // src/client/gfx/monsters_kit.ts
  var cap2 = (a, b, r, rp, x2 = {}) => ({ kind: "cap", a, b, r, ramp: rp, ...x2 });
  var sph2 = (a, r, rp, x2 = {}) => ({ kind: "sph", a, r, ramp: rp, ...x2 });
  var dot2 = (a, ref, color, r = 1) => ({ kind: "dot", a, ref, r, color, ramp: EYE2, depthBias: 0.8 });
  var disc = (a, r, n2, rp, x2 = {}) => ({ kind: "disc", a, r, n: n2, ramp: rp, ...x2 });
  var EYE2 = ramp("#3a0a04", "#a02010", "#ff6030", "#ffd0a0");
  function poseOf(anim, f) {
    const p = { gait: 0, moving: false, bob: 0, crouch: 0, lunge: 0, raise: 0, open: 0.15 };
    if (anim === "idle") {
      p.bob = Math.sin(f / 4 * Math.PI * 2) * 0.5 + 0.5;
    } else if (anim === "move") {
      p.gait = f / 6 * Math.PI * 2;
      p.moving = true;
      p.bob = Math.abs(Math.sin(p.gait));
      p.open = 0.3;
    } else if (anim === "windup") {
      const t4 = (f + 1) / 4;
      p.crouch = t4;
      p.raise = t4;
      p.open = 0.3 + t4 * 0.7;
      p.lunge = -t4 * 0.6;
    } else if (anim === "strike") {
      p.lunge = [1, 0.8, 0.35][f] ?? 0;
      p.raise = [-0.4, -0.5, -0.2][f] ?? 0;
      p.open = [1, 0.6, 0.3][f] ?? 0;
    }
    return p;
  }
  function quad(o, po) {
    const P3 = [];
    const L2 = po.lunge * o.len * 0.15;
    const z2 = o.h - po.crouch * o.h * 0.25 + po.bob * 0.6;
    const back = v(-o.len / 2 + L2, 0, z2);
    const front = v(o.len / 2 + L2, 0, z2 + o.bodyR * 0.25);
    P3.push(cap2(back, front, o.bodyR, o.hide));
    P3.push(cap2(add(back, v(1, 0, -o.bodyR * 0.45)), add(front, v(-1, 0, -o.bodyR * 0.5)), o.bodyR * 0.8, o.belly, { depthBias: -0.2 }));
    const legs = [
      [add(front, v(-o.bodyR * 0.3, -o.bodyR * 0.7, 0)), 0],
      [add(front, v(-o.bodyR * 0.3, o.bodyR * 0.7, 0)), Math.PI],
      [add(back, v(o.bodyR * 0.3, -o.bodyR * 0.7, 0)), Math.PI],
      [add(back, v(o.bodyR * 0.3, o.bodyR * 0.7, 0)), 0]
    ];
    for (const [top, ph] of legs) {
      const sw = po.moving ? Math.sin(po.gait + ph) * o.len * 0.22 : 0;
      const lift = po.moving ? Math.max(0, Math.cos(po.gait + ph)) * o.h * 0.25 : 0;
      const foot = v(top[0] + sw, top[1] * 1.2, 0.6 + lift);
      const knee = v((top[0] + foot[0]) / 2 + (top[0] > 0 ? 1.2 : -1.2), top[1] * 1.25, (top[2] + foot[2]) / 2 + (o.low ? -0.5 : 0));
      P3.push(cap2(top, knee, o.legR, o.hide));
      P3.push(cap2(knee, foot, o.legR * 0.8, o.hide));
      P3.push(cap2(foot, add(foot, v(o.legR * 1.2, 0, -0.1)), o.legR * 0.6, o.claw));
    }
    if (o.tail) {
      const t1 = add(back, v(-o.tail * 0.6, 0, -0.5 + po.bob * 0.4));
      const t22 = add(back, v(-o.tail, Math.sin(po.gait) * 1.5, -1.5));
      P3.push(cap2(add(back, v(-1, 0, 0)), t1, o.bodyR * 0.45, o.hide));
      P3.push(cap2(t1, t22, o.bodyR * 0.25, o.hide));
    }
    const head = add(front, v((o.neck ?? 2) + o.headR * 0.6 + po.lunge * 2, 0, o.headR * 0.4 - po.crouch * 1.2));
    P3.push(sph2(head, o.headR, o.hide, { depthBias: 0.2 }));
    const snout = add(head, v(o.headR * 1.1, 0, -o.headR * 0.1));
    P3.push(cap2(add(head, v(o.headR * 0.3, 0, 0)), snout, o.headR * 0.6, o.hide, { depthBias: 0.25 }));
    const jaw = add(head, v(o.headR, 0, -o.headR * 0.55 - po.open * o.headR * 0.7));
    P3.push(cap2(add(head, v(0, 0, -o.headR * 0.4)), jaw, o.headR * 0.45, o.belly, { depthBias: 0.24 }));
    if (o.maw && po.open > 0.4) P3.push(sph2(add(head, v(o.headR * 0.8, 0, -o.headR * 0.45)), o.headR * 0.35, o.maw, { depthBias: 0.26 }));
    const ec = rgba(o.eye);
    P3.push(dot2(add(head, v(o.headR * 0.65, -o.headR * 0.55, o.headR * 0.45)), add(head, v(0, -o.headR * 0.2, 0)), ec, 1.1));
    P3.push(dot2(add(head, v(o.headR * 0.65, o.headR * 0.55, o.headR * 0.45)), add(head, v(0, o.headR * 0.2, 0)), ec, 1.1));
    o.extras?.(P3, { back, front, head, po });
    return P3;
  }
  function biped(o, po) {
    const P3 = [];
    const limb = o.limb ?? o.skin;
    const hipZ = o.hip - po.crouch * o.hip * 0.18 + po.bob * 0.4;
    const hip = v(po.lunge * 1.5, 0, hipZ);
    const chest = add(hip, v(o.hunch + po.lunge * 2.5 - po.crouch * 1.2, 0, o.torso));
    for (const s of [-1, 1]) {
      const sw = po.moving ? Math.sin(po.gait + (s > 0 ? Math.PI : 0)) * o.hip * 0.35 : s * po.lunge * 1.2;
      const lift = po.moving ? Math.max(0, Math.cos(po.gait + (s > 0 ? Math.PI : 0))) * o.hip * 0.18 : 0;
      const top = add(hip, v(0, s * o.torsoR * 0.55, -o.legR * 0.5));
      const foot = v(sw, s * o.torsoR * 0.75, 0.8 + lift);
      const knee = v((top[0] + foot[0]) / 2 + 1.4, s * o.torsoR * 0.7, (top[2] + foot[2]) / 2);
      P3.push(cap2(top, knee, o.legR, limb));
      P3.push(cap2(knee, foot, o.legR * 0.85, limb));
      P3.push(cap2(foot, add(foot, v(o.legR * 1.4, 0, -0.1)), o.legR * 0.7, o.cloth));
    }
    P3.push(cap2(hip, chest, o.torsoR, o.cloth));
    P3.push(sph2(add(chest, v(0.3, 0, 0)), o.torsoR * 1.05, o.skin, { depthBias: 0.05 }));
    const head = add(chest, v(o.headR * 0.5 + o.hunch * 0.3, 0, o.torsoR * 0.6 + o.headR * 0.7));
    P3.push(sph2(head, o.headR, o.skin, { depthBias: 0.2 }));
    const ec = rgba(o.eye);
    P3.push(dot2(add(head, v(o.headR * 0.85, -o.headR * 0.38, o.headR * 0.1)), add(head, v(0, -o.headR * 0.2, 0)), ec, 1.1));
    P3.push(dot2(add(head, v(o.headR * 0.85, o.headR * 0.38, o.headR * 0.1)), add(head, v(0, o.headR * 0.2, 0)), ec, 1.1));
    const AL = o.armLen ?? o.torso * 1.1;
    const hands = [];
    for (const s of [-1, 1]) {
      const sh = add(chest, v(0, s * o.torsoR * 1.05, o.torsoR * 0.3));
      let hand;
      if (po.raise > 0) hand = add(sh, v(AL * 0.3 * (1 - po.raise), s * 1.2, -AL * 0.7 + AL * 1.5 * po.raise));
      else if (po.raise < 0) hand = add(sh, v(AL * (0.6 - po.raise * 0.5), s * 0.5 - s * 1.5, -AL * 0.4 + po.raise * AL * 0.6));
      else {
        const sw = po.moving ? Math.sin(po.gait + (s > 0 ? 0 : Math.PI)) * AL * 0.3 : 0;
        hand = add(sh, v(AL * 0.25 + sw, s * 1.3, -AL * 0.85 + po.bob * 0.4));
      }
      const elbow = add(lerp3(sh, hand, 0.5), v(-1.2, s * 1.5, 0));
      P3.push(cap2(sh, elbow, o.armR, limb));
      P3.push(cap2(elbow, hand, o.armR * 0.9, limb));
      if (o.arms === "fists") P3.push(sph2(hand, o.armR * 1.6, limb, { depthBias: 0.1 }));
      if (o.arms === "claws") for (const c of [-1, 0, 1]) P3.push(cap2(hand, add(hand, v(2.6, c * 1, -1.6)), 0.5, o.cloth));
      hands.push(hand);
    }
    if ((o.arms === "staff" || o.arms === "halberd") && o.staff) {
      const h = hands[1];
      const top = add(h, v(1.5 + po.raise * 2, 0, o.hip * 0.9));
      const bot = add(h, v(-0.5, 0, -o.hip * 0.7));
      P3.push(cap2(bot, top, Math.max(0.7, o.armR * 0.45), o.staff));
      if (o.orb) P3.push(sph2(top, 2 + po.raise * 1.4, o.orb, { depthBias: 0.3 }));
      if (o.arms === "halberd") P3.push({ kind: "poly", a: top, r: 0, ramp: o.staff, pts: [add(top, v(0, 0, 1)), add(top, v(4.5, 0, -2)), add(top, v(3.5, 0, -6)), add(top, v(0, 0, -4))], color: o.staff[3], depthBias: 0.3 });
    }
    o.extras?.(P3, { hip, chest, head, hands: [hands[0], hands[1]], po });
    return P3;
  }
  function winged(o, po, anim, f) {
    const P3 = [];
    const S3 = o.size;
    const hover = S3 * 1.6 + Math.sin(f / 4 * Math.PI * 2) * 0.8 - po.crouch * S3 * 0.4 + po.lunge * -S3 * 0.6;
    const flap = anim === "windup" ? -0.4 - po.crouch * 0.6 : Math.sin(f / (anim === "move" ? 6 : 4) * Math.PI * 2) * 0.8;
    const body = v(po.lunge * 3, 0, hover);
    P3.push(cap2(add(body, v(-S3 * 0.7, 0, 0.3)), add(body, v(S3 * 0.5, 0, 0.6)), S3 * 0.42, o.body));
    for (const s of [-1, 1]) {
      const root = add(body, v(0, s * S3 * 0.3, S3 * 0.25));
      const mid = add(root, v(-S3 * 0.25, s * S3 * 0.8, S3 * 0.5 * flap));
      const tip = add(mid, v(-S3 * 0.55, s * S3 * 0.8, S3 * 0.8 * flap));
      P3.push(cap2(root, mid, S3 * 0.2, o.wing));
      P3.push(cap2(mid, tip, S3 * 0.12, o.wing));
      P3.push({ kind: "poly", a: root, r: 0, ramp: o.wing, pts: [root, mid, tip, add(root, v(-S3 * 0.9, s * S3 * 0.2, -0.3))], color: o.wing[1], depthBias: -0.1 });
      const leg = add(body, v(po.lunge * 2, s * S3 * 0.18, -S3 * 0.4));
      P3.push(cap2(leg, add(leg, v(S3 * 0.2 + po.lunge * 2, 0, -S3 * 0.45)), S3 * 0.08, o.beak));
    }
    const head = add(body, v(S3 * 0.7, 0, S3 * 0.35));
    P3.push(sph2(head, S3 * 0.28, o.body, { depthBias: 0.2 }));
    P3.push(cap2(add(head, v(S3 * 0.15, 0, 0)), add(head, v(S3 * 0.6, 0, -S3 * 0.15)), S3 * 0.09, o.beak, { depthBias: 0.25 }));
    P3.push(dot2(add(head, v(S3 * 0.2, -S3 * 0.17, S3 * 0.07)), head, rgba(o.eye), 1));
    P3.push(dot2(add(head, v(S3 * 0.2, S3 * 0.17, S3 * 0.07)), head, rgba(o.eye), 1));
    P3.push(cap2(add(body, v(-S3 * 0.7, 0, 0.3)), add(body, v(-S3 * 1.3, 0, 0.1)), S3 * 0.14, o.wing));
    return P3;
  }
  function crawler(o, po) {
    const P3 = [];
    const pts = [];
    for (let i = 0; i < o.segs; i++) {
      const wig = Math.sin(po.gait * (o.legs ? 1 : 1.5) + i * 1.2) * (po.moving ? o.r * 0.5 : o.r * 0.15);
      const rear = o.legs === 0 && po.crouch > 0 && i === o.segs - 1 ? po.crouch * o.r * 1.6 : 0;
      pts.push(v(-i * o.r * 1.35 + po.lunge * o.r * 1.6, wig, o.r * 0.9 + rear + (i === 0 ? po.crouch * o.r * 0.8 : 0)));
    }
    pts.reverse();
    for (let i = 0; i < pts.length; i++) {
      const rr3 = o.r * (i === pts.length - 1 ? 0.9 : 0.75 + 0.35 * Math.sin(i / pts.length * Math.PI));
      const glow4 = o.glow && i < pts.length - 1 && i < 2;
      P3.push(sph2(pts[i], rr3, glow4 ? o.glow : o.shell, { depthBias: i * 0.01 }));
      if (i > 0) P3.push(cap2(pts[i - 1], pts[i], rr3 * 0.6, o.under, { depthBias: -0.2 }));
      if (o.legs) for (const s of [-1, 1]) {
        if (i === pts.length - 1) continue;
        const ph = po.gait * 2 + i + (s > 0 ? Math.PI : 0);
        const foot = add(pts[i], v(Math.sin(ph) * o.r * 0.5, s * o.r * 1.7, -o.r * 0.9));
        P3.push(cap2(add(pts[i], v(0, s * o.r * 0.5, 0)), foot, o.r * 0.18, o.under));
      }
    }
    const head = pts[pts.length - 1];
    const ec = rgba(o.eye);
    P3.push(dot2(add(head, v(o.r * 0.7, -o.r * 0.4, o.r * 0.3)), head, ec, 1));
    P3.push(dot2(add(head, v(o.r * 0.7, o.r * 0.4, o.r * 0.3)), head, ec, 1));
    if (!o.legs) {
      P3.push(disc(add(head, v(o.r * 0.85, 0, 0)), o.r * (0.45 + po.open * 0.25), v(1, 0, 0), o.under, { rim: o.shell[3], boss: rgba("#3a0a10") }));
    } else {
      for (const s of [-1, 1]) P3.push(cap2(add(head, v(o.r * 0.6, s * o.r * 0.3, -o.r * 0.2)), add(head, v(o.r * 1.3, s * o.r * (0.1 + po.open * 0.4), -o.r * 0.4)), o.r * 0.14, o.under));
    }
    return P3;
  }

  // src/client/gfx/monsters_hollowpine.ts
  var R3 = {
    bark: ramp("#1f150c", "#3d2a18", "#5e4426", "#7d6036"),
    barkDark: ramp("#120c07", "#24180e", "#3a2817", "#4f3820"),
    moss: ramp("#16200e", "#2c4018", "#466226", "#648634"),
    leaf: ramp("#20300e", "#3e5a18", "#6a8a28", "#9ab83c"),
    sap: ramp("#5a3008", "#a8601a", "#e8a030", "#ffe090"),
    bulb: ramp("#2a1e10", "#56402a", "#86683e", "#b09060"),
    flesh: ramp("#2a1210", "#5a2420", "#8a3a30", "#b05a48"),
    bone: ramp("#5a5244", "#8e8670", "#bcb498", "#e4dcc0"),
    glowG: ramp("#1e5a20", "#4aa83a", "#9af070", "#eaffd0")
  };
  var barkgnaw2 = (a, f) => quad({
    len: 14,
    h: 9,
    bodyR: 4.6,
    headR: 4.2,
    legR: 1.7,
    hide: R3.bark,
    belly: R3.barkDark,
    claw: R3.bone,
    maw: R3.flesh,
    eye: "#b0ff60",
    tail: 7,
    extras: (P3, k) => {
      for (let i = 0; i < 4; i++) {
        const b = add(k.back, v(i * 3.6, 0, 4));
        P3.push(cap2(b, add(b, v(-2.4, (i % 2 ? 1 : -1) * 1.2, 2.6)), 1.1, R3.barkDark, { depthBias: -0.1 }));
      }
      P3.push(sph2(add(k.front, v(0.5, 0, 2.2)), 3.6, R3.moss, { depthBias: -0.05 }));
      for (const s of [-1, 1]) P3.push(cap2(add(k.head, v(-0.5, s * 2.2, 2.8)), add(k.head, v(-4, s * 4.5, 7)), 0.7, R3.bark));
    }
  }, poseOf(a, f));
  function sapspitter2(a, f) {
    const po = poseOf(a, f);
    const P3 = [];
    for (let i = 0; i < 5; i++) {
      const ang = i / 5 * Math.PI * 2 + (po.moving ? Math.sin(po.gait + i) * 0.3 : 0);
      const out = v(Math.cos(ang) * 9, Math.sin(ang) * 9, 0.6 + (po.moving ? Math.max(0, Math.sin(po.gait + i * 1.3)) * 2 : 0));
      const mid = v(Math.cos(ang) * 5, Math.sin(ang) * 5, 4);
      P3.push(cap2(v(0, 0, 7), mid, 1.6, R3.bark));
      P3.push(cap2(mid, out, 1.1, R3.barkDark));
    }
    const squash = 1 - po.crouch * 0.15 + po.lunge * 0.1;
    const body = v(0, 0, 11 * squash + po.bob * 0.5);
    P3.push(sph2(body, 7.2, R3.bulb));
    for (const s of [-1, 0, 1]) P3.push(cap2(add(body, v(4, s * 3, -3)), add(body, v(5.6, s * 2, 3)), 0.8, R3.sap, { depthBias: 0.3 }));
    const neck = add(body, v(2 + po.lunge * 2, 0, 6));
    const mouth = add(neck, v(3 + po.lunge * 2, 0, 3 - po.crouch * 1));
    P3.push(cap2(add(body, v(0, 0, 4)), neck, 2.6, R3.bulb));
    P3.push(cap2(neck, mouth, 2.2 + po.crouch * 1.2, R3.bulb, { depthBias: 0.2 }));
    P3.push(sph2(add(mouth, v(1.5, 0, 0)), 1.3 + po.open * 1.2, R3.sap, { depthBias: 0.3 }));
    for (let i = 0; i < 6; i++) {
      const ang = i / 6 * Math.PI * 2;
      P3.push(cap2(add(body, v(0, 0, 5)), add(body, v(Math.cos(ang) * 6, Math.sin(ang) * 6, 9 + i % 2 * 2)), 0.9, R3.leaf, { depthBias: -0.1 }));
    }
    P3.push(dot2(add(body, v(6.4, -2, 1.5)), body, rgba("#ffd060"), 1.2));
    P3.push(dot2(add(body, v(6.4, 2, 1.5)), body, rgba("#ffd060"), 1.2));
    return P3;
  }
  var tender = (a, f) => biped({
    hip: 11,
    torso: 10,
    torsoR: 3.8,
    headR: 3.2,
    armR: 1.3,
    legR: 1.6,
    hunch: 3,
    skin: R3.bark,
    cloth: R3.moss,
    limb: R3.barkDark,
    eye: "#90ff80",
    arms: "staff",
    staff: R3.bark,
    orb: R3.glowG,
    extras: (P3, k) => {
      for (const s of [-1, 1]) {
        const a0 = add(k.head, v(-0.5, s * 1.8, 2.4));
        const a1 = add(a0, v(-1.5, s * 3, 4.5));
        P3.push(cap2(a0, a1, 0.7, R3.bone));
        P3.push(cap2(a1, add(a1, v(1.5, s * 1.5, 3)), 0.5, R3.bone));
        P3.push(cap2(a1, add(a1, v(-2.5, s * 2.5, 1.5)), 0.5, R3.bone));
      }
      P3.push(cap2(add(k.chest, v(-2.5, 0, 0)), add(k.hip, v(-3.5, 0, -6)), 3.4, R3.moss, { depthBias: -0.3 }));
      for (const s of [-2, 0, 2]) P3.push(cap2(add(k.hip, v(-1, s, -3)), v(-2 + s * 0.3, s * 1.6, 0.5), 0.6, R3.barkDark));
      if (k.po.raise > 0.3) P3.push(sph2(k.hands[0], 1.2 + k.po.raise, R3.glowG, { depthBias: 0.3 }));
    }
  }, poseOf(a, f));
  var stumpfather2 = (a, f) => biped({
    hip: 13,
    torso: 14,
    torsoR: 8.5,
    headR: 3.6,
    armR: 3,
    legR: 3.4,
    hunch: 4,
    skin: R3.bark,
    cloth: R3.barkDark,
    eye: "#ffb040",
    arms: "fists",
    armLen: 19,
    extras: (P3, k) => {
      P3.push(sph2(add(k.chest, v(-1.5, 0, 6)), 6.4, R3.bark, { ry: 0.7, depthBias: -0.05 }));
      P3.push(cap2(add(k.chest, v(-2, 0, 9)), add(k.chest, v(-3, 1, 15)), 0.7, R3.bark));
      P3.push(sph2(add(k.chest, v(-3, 1, 16)), 2.2, R3.leaf));
      for (const s of [-1, 1]) P3.push(sph2(add(k.chest, v(0, s * 7.5, 3)), 3.4, R3.moss, { depthBias: 0.05 }));
      P3.push(sph2(add(k.chest, v(7.5, -2.5, -2)), 1.3, R3.barkDark, { depthBias: 0.3 }));
    }
  }, poseOf(a, f));
  var HOLLOWPINE = {
    barkgnaw: { baseR: 16, scale: 1.2, w: 70, h: 60, ay: 46, parts: barkgnaw2 },
    sapspitter: { baseR: 17, scale: 1.2, w: 70, h: 76, ay: 54, parts: sapspitter2 },
    hollow_tender: { baseR: 17, scale: 1.15, w: 72, h: 92, ay: 70, parts: tender },
    stumpfather: { baseR: 30, scale: 1.15, w: 104, h: 128, ay: 98, parts: stumpfather2 }
  };

  // src/client/gfx/monsters_gloamwater.ts
  var R4 = {
    scale: ramp("#10181a", "#1f3234", "#30504c", "#4a7468"),
    scaleBelly: ramp("#2a2a1c", "#4a4a30", "#6e6a46", "#94906a"),
    reed: ramp("#2a2a10", "#4c4a1e", "#78722e", "#a8a048"),
    mud: ramp("#1a140e", "#33281c", "#4e3e2c", "#6a573e"),
    shell: ramp("#1c1e1a", "#363a32", "#545a4c", "#78806a"),
    frog: ramp("#18200e", "#2e3e1a", "#4a6028", "#6e8a3c"),
    robe: ramp("#0e1214", "#1a2226", "#283438", "#3a4a4e"),
    sludge: ramp("#1a2a10", "#3a5a1a", "#6a9a2a", "#b0e050"),
    leech: ramp("#1a0a12", "#3a1428", "#5e2040", "#8a3a5e"),
    leechU: ramp("#2a1418", "#4e2a2e", "#744048", "#9a5e64"),
    teeth: ramp("#6a6450", "#a49c80", "#ccc4a4", "#eee8d0"),
    mouth: ramp("#140404", "#300a0a", "#521410", "#701e18")
  };
  var reedlurker2 = (a, f) => quad({
    len: 18,
    h: 6,
    bodyR: 3.8,
    headR: 3.6,
    legR: 1.4,
    neck: 1,
    hide: R4.scale,
    belly: R4.scaleBelly,
    claw: R4.mud,
    maw: R4.mouth,
    eye: "#ffe040",
    tail: 12,
    low: true,
    extras: (P3, k) => {
      for (let i = 0; i < 6; i++) {
        const b = add(k.back, v(i * 3.4 - 1, (i % 2 ? 1 : -1) * 1.4, 3));
        P3.push(cap2(b, add(b, v(-1.6, (i % 2 ? 1 : -1) * 0.6, 6 + i % 3 * 1.6)), 0.5, R4.reed, { depthBias: -0.15 }));
      }
      for (const s of [-1, 1]) P3.push(cap2(add(k.head, v(3.5, s * 1.4, -1.2)), add(k.head, v(5.5, s * 1.4, -2.4)), 0.4, R4.teeth, { depthBias: 0.3 }));
    }
  }, poseOf(a, f));
  var chanter = (a, f) => biped({
    hip: 9,
    torso: 9,
    torsoR: 4.8,
    headR: 4,
    armR: 1.3,
    legR: 1.9,
    hunch: 3.5,
    skin: R4.frog,
    cloth: R4.robe,
    eye: "#ffd030",
    arms: "claws",
    extras: (P3, k) => {
      const sac = 1.6 + k.po.crouch * 2.4 + k.po.open * 0.6;
      P3.push(sph2(add(k.head, v(2.2, 0, -3)), sac, R4.scaleBelly, { depthBias: 0.3 }));
      P3.push(cap2(add(k.head, v(3.2, -2.6, -0.8)), add(k.head, v(3.2, 2.6, -0.8)), 0.45, R4.mouth, { depthBias: 0.35 }));
      for (const s of [-1, 1]) P3.push(sph2(add(k.head, v(1.8, s * 2.2, 2.6)), 1.4, R4.frog, { depthBias: 0.25 }));
      if (k.po.raise > 0.2) P3.push(sph2(add(k.chest, v(6, 0, 4 + k.po.raise * 6)), 1.6 + k.po.raise * 2.2, R4.sludge, { depthBias: 0.4 }));
      for (const s of [-2.5, 0, 2.5]) P3.push(cap2(add(k.hip, v(-1, s, -1)), add(k.hip, v(-2, s * 1.2, -7)), 1, R4.robe, { depthBias: -0.2 }));
    }
  }, poseOf(a, f));
  function behemoth(a, f) {
    const po = poseOf(a, f);
    return quad({
      len: 20,
      h: 12,
      bodyR: 9.5,
      headR: 5,
      legR: 3.4,
      neck: 0,
      hide: R4.mud,
      belly: R4.scaleBelly,
      claw: R4.shell,
      maw: R4.mouth,
      eye: "#ff8030",
      tail: 6,
      extras: (P3, k) => {
        const top = add(lerp(k.back, k.front), v(0, 0, 6 - po.crouch * 1.5));
        P3.push(sph2(top, 10.5, R4.shell, { ry: 0.75, depthBias: -0.02 }));
        for (let i = 0; i < 7; i++) {
          const ang = i / 7 * Math.PI * 2;
          P3.push(sph2(add(top, v(Math.cos(ang) * 6.5, Math.sin(ang) * 6.5, 4.5)), 1.5, R4.mud, { depthBias: 0.1 }));
        }
        P3.push(cap2(add(top, v(5, -6, 0)), add(top, v(5.5, -6.5, -6)), 0.7, R4.mud));
        for (const s of [-1, 1]) P3.push(cap2(add(k.head, v(3, s * 2.4, -2)), add(k.head, v(6, s * 3.4, 0.5)), 0.8, R4.teeth, { depthBias: 0.3 }));
      }
    }, po);
  }
  var lerp = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  var leechkin2 = (a, f) => crawler({ segs: 5, r: 2.6, shell: R4.leech, under: R4.leechU, legs: 0, eye: "#ff5060" }, poseOf(a, f));
  var GLOAMWATER = {
    reedlurker: { baseR: 16, scale: 1.2, w: 84, h: 56, ay: 40, parts: reedlurker2 },
    mire_chanter: { baseR: 17, scale: 1.2, w: 72, h: 82, ay: 62, parts: chanter },
    silt_behemoth: { baseR: 31, scale: 1.1, w: 120, h: 104, ay: 76, parts: behemoth },
    leechkin: { baseR: 9, scale: 1.25, w: 44, h: 36, ay: 26, parts: leechkin2 }
  };

  // src/client/gfx/monsters_brokenspire.ts
  var R5 = {
    slate: ramp("#141418", "#2a2a32", "#44444e", "#62626e"),
    feather: ramp("#18141a", "#302836", "#4c4054", "#6e6078"),
    talon: ramp("#3a3020", "#6a5a3a", "#9a8858", "#c8b880"),
    crystal: ramp("#203a5a", "#3a6ea0", "#70b0e8", "#d0f0ff"),
    hood: ramp("#120f14", "#241e28", "#3a3040", "#524658"),
    skin: ramp("#2a2420", "#4a4038", "#6a5e52", "#8e8070"),
    stone: ramp("#1e1d1c", "#3a3836", "#585552", "#7a7672"),
    stoneDark: ramp("#121110", "#222120", "#353331", "#4a4744"),
    lava: ramp("#5a1004", "#b0380a", "#ff7a1a", "#ffe080"),
    mite: ramp("#140c08", "#2a1810", "#44281a", "#603a26"),
    miteU: ramp("#1e1410", "#3a2a20", "#584032", "#785a48")
  };
  var harrier = (a, f) => winged({ body: R5.slate, wing: R5.feather, beak: R5.talon, eye: "#ff5040", size: 9 }, poseOf(a, f), a, f);
  var shardslinger2 = (a, f) => biped({
    hip: 10,
    torso: 9,
    torsoR: 3.6,
    headR: 3,
    armR: 1.2,
    legR: 1.5,
    hunch: 2.5,
    skin: R5.skin,
    cloth: R5.hood,
    eye: "#80e0ff",
    extras: (P3, k) => {
      const shards = [[-0.5, 0, 6, 1.1], [-1.5, -2, 4.5, 0.9], [-1.5, 2, 4.5, 0.9], [-3, -1, 3, 0.8], [-3, 1, 3.5, 0.8]];
      for (const [df, ds, dz, r] of shards) P3.push(cap2(add(k.head, v(df * 0.4, ds * 0.6, 1.5)), add(k.head, v(df, ds, dz)), r, R5.crystal, { depthBias: -0.05 }));
      for (const s of [-1, 1]) P3.push(cap2(add(k.chest, v(-1, s * 3.5, 2)), add(k.chest, v(-3, s * 6, 6)), 0.9, R5.crystal));
      if (k.po.raise > 0.1) for (const h of k.hands) P3.push(cap2(h, add(h, v(1, 0, 2.5 + k.po.raise * 2)), 0.8, R5.crystal, { depthBias: 0.35 }));
      P3.push(cap2(add(k.chest, v(-2.5, 0, 1)), add(k.hip, v(-3.5, 0, -6)), 3, R5.hood, { depthBias: -0.3 }));
    }
  }, poseOf(a, f));
  var cairnbreaker2 = (a, f) => biped({
    hip: 13,
    torso: 13,
    torsoR: 8,
    headR: 3.4,
    armR: 3.4,
    legR: 3.8,
    hunch: 3,
    skin: R5.stone,
    cloth: R5.stoneDark,
    eye: "#ffa040",
    arms: "fists",
    armLen: 20,
    extras: (P3, k) => {
      for (let i = 0; i < 3; i++) P3.push(sph2(add(k.chest, v(-5 + i * 0.3, (i - 1) * 1.5, 3 + i * 4.2)), 4.4 - i * 0.9, R5.stone, { ry: 0.65, depthBias: -0.15 }));
      P3.push(cap2(add(k.chest, v(6, -3, -4)), add(k.chest, v(6.5, 2, 3)), 0.6, R5.lava, { depthBias: 0.35 }));
      P3.push(cap2(add(k.hip, v(4, -4, 1)), add(k.hip, v(4.5, 3, 4)), 0.5, R5.lava, { depthBias: 0.35 }));
      for (const h of k.hands) P3.push(sph2(h, 4.6, R5.stone, { depthBias: 0.1 }));
      if (k.po.raise > 0.6) for (const h of k.hands) P3.push(sph2(h, 2, R5.lava, { depthBias: 0.2 }));
    }
  }, poseOf(a, f));
  var cindermite2 = (a, f) => crawler({ segs: 3, r: 3.2, shell: R5.mite, under: R5.miteU, glow: R5.lava, legs: 3, eye: "#ffd040" }, poseOf(a, f));
  var BROKENSPIRE = {
    spire_harrier: { baseR: 15, scale: 1.2, w: 80, h: 70, ay: 52, parts: harrier },
    shardslinger: { baseR: 18, scale: 1.2, w: 72, h: 86, ay: 64, parts: shardslinger2 },
    cairnbreaker: { baseR: 31, scale: 1.15, w: 108, h: 130, ay: 100, parts: cairnbreaker2 },
    cindermite: { baseR: 10, scale: 1.25, w: 46, h: 38, ay: 28, parts: cindermite2 }
  };

  // src/client/gfx/monsters_bosses.ts
  var R6 = {
    bark: ramp("#1a120a", "#36261a", "#563e28", "#765838"),
    rot: ramp("#1a1a0e", "#34361a", "#545a28", "#7a823a"),
    bloom: ramp("#3a0e2a", "#7a1e52", "#c04a86", "#f0a0c8"),
    bone: ramp("#5a5244", "#8e8670", "#bcb498", "#e4dcc0"),
    toad: ramp("#14180e", "#283020", "#3e4a30", "#5a6a44"),
    toadBelly: ramp("#3a3420", "#64583a", "#8e8058", "#b8a87c"),
    wart: ramp("#2a2a10", "#545020", "#848030", "#b8b048"),
    mouth: ramp("#140404", "#300a0a", "#521410", "#701e18"),
    stone: ramp("#1c1c20", "#36363e", "#54545e", "#76767e"),
    steel: ramp("#202428", "#44505a", "#7a8a96", "#d0dce4"),
    rune: ramp("#103a5a", "#2a7ab0", "#70c8ff", "#e0f6ff")
  };
  function matriarch(a, f) {
    return biped({
      hip: 16,
      torso: 18,
      torsoR: 7,
      headR: 4.6,
      armR: 2.4,
      legR: 3,
      hunch: 5,
      skin: R6.bark,
      cloth: R6.rot,
      eye: "#c0ff60",
      arms: "claws",
      armLen: 22,
      extras: (P3, k) => {
        for (const s of [-1, 1]) {
          const a0 = add(k.head, v(-1, s * 2.5, 3));
          const a1 = add(a0, v(-2, s * 6, 7));
          const a2 = add(a1, v(-1, s * 5, 6));
          P3.push(cap2(a0, a1, 1.2, R6.bone));
          P3.push(cap2(a1, a2, 0.9, R6.bone));
          P3.push(cap2(a1, add(a1, v(3, s * 2, 4)), 0.7, R6.bone));
          P3.push(cap2(a2, add(a2, v(2, s * 1, 3)), 0.6, R6.bone));
          P3.push(cap2(a2, add(a2, v(-2, s * 3, 1)), 0.6, R6.bone));
        }
        const sac = 5.5 + k.po.bob * 0.6 + k.po.crouch * 1.5;
        P3.push(sph2(add(k.chest, v(-7, 0, -2)), sac, R6.bloom, { depthBias: -0.2 }));
        for (const s of [-1, 1]) P3.push(sph2(add(k.chest, v(0, s * 6, 3)), 2.4, R6.bloom, { depthBias: 0.05 }));
        for (let i = 0; i < 7; i++) {
          const ang = i / 7 * Math.PI * 2;
          P3.push(cap2(add(k.hip, v(Math.cos(ang) * 4, Math.sin(ang) * 4, 0)), v(Math.cos(ang) * 10, Math.sin(ang) * 10, 0.6), 1.3, R6.bark, { depthBias: -0.1 }));
        }
      }
    }, poseOf(a, f));
  }
  function gulpmaw2(a, f) {
    const po = poseOf(a, f);
    return quad({
      len: 18,
      h: 13,
      bodyR: 14,
      headR: 9,
      legR: 4,
      neck: -6,
      hide: R6.toad,
      belly: R6.toadBelly,
      claw: R6.wart,
      maw: R6.mouth,
      eye: "#ffe040",
      extras: (P3, k) => {
        P3.push(sph2(add(k.front, v(-2, 0, -4 - po.crouch)), 11 + po.crouch * 2.5, R6.toadBelly, { depthBias: 0.05 }));
        for (let i = 0; i < 9; i++) {
          const ang = i / 9 * Math.PI * 2;
          P3.push(sph2(add(k.back, v(6 + Math.cos(ang) * 8, Math.sin(ang) * 10, 10 + Math.sin(i) * 2)), 1.6, R6.wart, { depthBias: 0.1 }));
        }
        const t0 = add(k.head, v(6, 0, -5));
        P3.push(cap2(t0, add(t0, v(2 + po.lunge * 18, 0, -5 + po.lunge * 2)), 1.6, R6.mouth, { depthBias: 0.4 }));
        for (let i = 0; i < 4; i++) P3.push(cap2(add(k.back, v(i * 4, 0, 12)), add(k.back, v(i * 4 - 3, 0, 17 - i)), 0.9, R6.wart, { depthBias: -0.2 }));
      }
    }, po);
  }
  function warden(a, f) {
    const po = poseOf(a, f);
    return biped({
      hip: 15,
      torso: 15,
      torsoR: 7,
      headR: 4,
      armR: 2.6,
      legR: 3.2,
      hunch: 2,
      skin: R6.stone,
      cloth: R6.steel,
      eye: "#80d0ff",
      arms: "halberd",
      staff: R6.steel,
      armLen: 20,
      extras: (P3, k) => {
        P3.push(cap2(add(k.head, v(-2, 0, 3)), add(k.head, v(-6, 0, 6)), 1.2, R6.steel));
        for (const s of [-1, 1]) P3.push(sph2(add(k.chest, v(0, s * 7.5, 3)), 3.4, R6.steel, { ry: 0.6, depthBias: 0.05 }));
        P3.push(cap2(add(k.chest, v(6.8, -2, -3)), add(k.chest, v(7.2, 1, 4)), 0.5, R6.rune, { depthBias: 0.35 }));
        for (let i = 0; i < 4; i++) {
          const ang = i / 4 * Math.PI * 2 + po.bob;
          P3.push(sph2(add(k.chest, v(Math.cos(ang) * 11, Math.sin(ang) * 11, 6 + Math.sin(ang * 2) * 2)), 1.6, R6.stone, { depthBias: 0.1 }));
        }
        P3.push(cap2(add(k.hip, v(4, 0, 3)), add(k.hip, v(5, 0, -8)), 2.4, R6.rune, { depthBias: 0.2 }));
      }
    }, po);
  }
  var BOSSES = {
    rotwood_matriarch: { baseR: 40, scale: 1.15, w: 150, h: 170, ay: 128, parts: matriarch },
    gulpmaw: { baseR: 42, scale: 1.1, w: 160, h: 130, ay: 94, parts: gulpmaw2 },
    shattered_warden: { baseR: 38, scale: 1.15, w: 150, h: 170, ay: 128, parts: warden }
  };

  // src/client/gfx/monsters_smooth.ts
  var DEFS2 = { ...HOLLOWPINE, ...GLOAMWATER, ...BROKENSPIRE, ...BOSSES };
  for (const t4 of MONSTER_TYPES) if (t4.family) sfx.registerFamily(t4.id, t4.family);
  var cache5 = /* @__PURE__ */ new Map();
  function smoothMonsterFrame(k, r, dir, anim, frame2, flash = false) {
    const def2 = DEFS2[k];
    if (!def2) return null;
    const size2 = Math.round(r / def2.baseR * 10) / 10;
    const key = `${k}|${size2}|${dir}|${anim}|${frame2}|${flash ? 1 : 0}|${spriteDensity()}`;
    let s = cache5.get(key);
    if (s) return s;
    if (!canBuild()) {
      const fb = cache5.get(`${k}|${size2}|${dir}|${anim}|0|0|${spriteDensity()}`) ?? cache5.get(`${k}|${size2}|${dir}|idle|0|0|${spriteDensity()}`);
      if (fb) return fb;
    }
    if (cache5.size > 5e3) cache5.clear();
    const k2 = ART * 1.12 * size2;
    const W3 = Math.ceil(def2.w * k2) + 10;
    const H3 = Math.ceil(def2.h * k2) + 10;
    const AX2 = Math.floor(W3 / 2);
    const AY2 = Math.ceil(def2.ay * k2) + 5;
    const parts = def2.parts(anim === "death" ? "idle" : anim, anim === "death" ? 0 : frame2);
    if (anim === "death") {
      const t4 = Math.min(1, frame2 / 5);
      const e = t4 * t4;
      if (def2.baseR >= 28) transformParts(parts, (p) => rotS(p, -e * 1.4, v(-4, 0, 0)));
      else transformParts(parts, (p) => rotF(p, e * 1.5, v(0, 3, 0)));
    }
    s = paintSprite(parts, dirToWorldAngle(dir, DIRS), def2.scale * k2, W3, H3, AX2, AY2, flash);
    cache5.set(key, s);
    return s;
  }
  var SMOOTH_KINDS = Object.keys(DEFS2);
  function smoothTop(k, r) {
    const def2 = DEFS2[k];
    if (!def2) return null;
    return def2.ay * ART * 1.12 * (r / def2.baseR) * 0.8;
  }

  // src/shared/content/monsters/shrines.ts
  var SHRINES = [
    { id: "galestep", name: "Galestep Shrine", desc: "30% faster movement", color: "#9ae0ff", moveSpeed: 1.3 },
    { id: "bloodroot", name: "Bloodroot Shrine", desc: "Regenerate 5% life per second", color: "#ff5a6a", regen: 0.05 },
    { id: "ironbark", name: "Ironbark Shrine", desc: "Take 35% less damage", color: "#c0b090", dmgTaken: 0.65 },
    { id: "emberheart", name: "Emberheart Shrine", desc: "Deal 50% more damage", color: "#ff8a2a", dmgDealt: 1.5 },
    { id: "magpie", name: "Magpie Shrine", desc: "Monsters you slay drop an extra item", color: "#ffe066", extraLoot: 1 },
    { id: "thornwake", name: "Thornwake Shrine", desc: "Reflect 40% of monster hit damage", color: "#a0d040", thorns: 0.4 },
    { id: "veilshroud", name: "Veilshroud Shrine", desc: "Monsters do not notice you", color: "#b0a0ff", veil: true },
    { id: "stormcall", name: "Stormcall Shrine", desc: "Lightning strikes nearby monsters", color: "#80c8ff", stormcall: { every: 1.2, radius: 320, dmg: 18 } }
  ];
  var SHRINE_BY_ID = new Map(SHRINES.map((s) => [s.id, s]));

  // src/client/gfx/monsters_fx.ts
  var shrineList = [];
  var myBuff = null;
  function poly(fx, pts, fill, stroke) {
    const { g } = fx;
    g.beginPath();
    pts.forEach(([x2, y2], i) => i ? g.lineTo(fx.sx(x2, y2), fx.sy(x2, y2)) : g.moveTo(fx.sx(x2, y2), fx.sy(x2, y2)));
    g.closePath();
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = Math.max(1, fx.up(1));
      g.stroke();
    }
  }
  function drawMonHazard(fx, hz) {
    if (!hz.sh) return false;
    if (!fx.onScreen(hz.x, hz.y, hz.len ?? hz.r + 60)) return true;
    const g = fx.g;
    const hot = Math.floor(fx.time * 10) % 2 === 0 || hz.f > 0.8;
    if (hz.sh === "pool") {
      const c = hz.c ?? "rgba(110,160,40,0.45)";
      const wob = 1 + Math.sin(fx.time * 3 + hz.id) * 0.03;
      g.globalAlpha = 0.85;
      fx.ell(hz.x, hz.y, hz.r * wob, c, null, true);
      g.globalAlpha = 0.5;
      fx.ell(hz.x, hz.y, hz.r * 0.6 * wob, c, null);
      g.globalAlpha = 1;
      return true;
    }
    if (hz.sh === "ring") {
      g.globalAlpha = 0.25 + 0.35 * hz.f;
      fx.ell(hz.x, hz.y, hz.r, "rgba(255,60,30,0.35)", null, true);
      g.globalAlpha = 1;
      fx.ell(hz.x, hz.y, Math.max(4, hz.r * hz.f), null, "rgba(255,150,80,0.9)");
      fx.ell(hz.x, hz.y, hz.r, null, hot ? "#ff5a3c" : "#b8301e");
      return true;
    }
    if (hz.sh === "cone") {
      const a = hz.a ?? 0;
      const arc = hz.arc ?? Math.PI / 2;
      const pts = [[hz.x, hz.y]];
      const n2 = 14;
      for (let i = 0; i <= n2; i++) {
        const t4 = a - arc / 2 + arc * i / n2;
        pts.push([hz.x + Math.cos(t4) * hz.r, hz.y + Math.sin(t4) * hz.r]);
      }
      g.globalAlpha = 0.3 + 0.4 * hz.f;
      poly(fx, pts, "rgba(255,60,30,0.45)", null);
      g.globalAlpha = 1;
      const inner = [[hz.x, hz.y]];
      for (let i = 0; i <= n2; i++) {
        const t4 = a - arc / 2 + arc * i / n2;
        inner.push([hz.x + Math.cos(t4) * hz.r * hz.f, hz.y + Math.sin(t4) * hz.r * hz.f]);
      }
      poly(fx, inner, "rgba(255,110,50,0.35)", null);
      poly(fx, pts, null, hot ? "#ff5a3c" : "#b8301e");
      return true;
    }
    if (hz.sh === "line") {
      const a = hz.a ?? 0;
      const L2 = hz.len ?? hz.r;
      const w = (hz.w ?? 40) / 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rect = (len) => [
        [hz.x - s * w, hz.y + c * w],
        [hz.x + c * len - s * w, hz.y + s * len + c * w],
        [hz.x + c * len + s * w, hz.y + s * len - c * w],
        [hz.x + s * w, hz.y - c * w]
      ];
      g.globalAlpha = 0.3 + 0.4 * hz.f;
      poly(fx, rect(L2), "rgba(255,60,30,0.45)", null);
      g.globalAlpha = 1;
      poly(fx, rect(L2 * hz.f), "rgba(255,110,50,0.35)", null);
      poly(fx, rect(L2), null, hot ? "#ff5a3c" : "#b8301e");
      return true;
    }
    return false;
  }
  function drawMonAura(fx, m) {
    if (!fx.onScreen(m.x, m.y, 280)) return;
    const g = fx.g;
    for (const id of m.e ?? []) {
      const md = ELITE_MOD_BY_ID.get(id);
      const au = md?.allyAura ?? md?.thirstAura;
      if (au) {
        g.globalAlpha = 0.5;
        fx.ell(m.x, m.y, au.radius, null, md.color ?? "#ffb060");
        g.globalAlpha = 0.07;
        fx.ell(m.x, m.y, au.radius, md.color ?? "#ffb060", null);
        g.globalAlpha = 1;
      }
    }
    if (m.bb) {
      const r = Math.abs(m.bb);
      const pulse = 0.5 + 0.2 * Math.sin(fx.time * 3);
      g.globalAlpha = pulse;
      fx.ell(m.x, m.y, r, null, m.bb > 0 ? "#d0f0ff" : "#ffd0ff");
      g.globalAlpha = m.bb > 0 ? 0.12 : 0.05;
      fx.ell(m.x, m.y, r, m.bb > 0 ? "#bfe8ff" : "#ffd0ff", null);
      g.globalAlpha = 1;
    }
    if (m.rr) {
      const c = RARITY_INFO[m.rr].color;
      g.globalAlpha = m.iv ? 0.9 : 0.55;
      fx.ell(m.x, m.y, m.r + 6, null, c);
      if (m.rr >= 2) fx.ell(m.x, m.y, m.r + 9, null, c);
      g.globalAlpha = 1;
    }
  }
  var title = (k) => MONSTER_BY_ID.get(k)?.boss?.title;
  function drawMonLabel(fx, m, damaged, top) {
    if (!m.rr && !m.gm) return false;
    const x2 = fx.sx(m.x, m.y);
    const y2 = fx.sy(m.x, m.y) - top;
    const boss = !!MONSTER_BY_ID.get(m.k)?.boss;
    const col3 = m.rr ? RARITY_INFO[m.rr].color : "#e8e2d4";
    const bw = boss ? Math.max(60, fx.up(m.r * 2)) : Math.max(16, fx.up(m.r * 1.3));
    if (damaged || m.rr >= 2) fx.bar(x2 - Math.floor(bw / 2), y2, bw, m.hp / m.mhp, m.rr === 3 ? "#d8873a" : m.rr === 2 ? "#e8a03a" : "#c8402e");
    let ly = y2 - 10;
    const mods = (m.e ?? []).map((id) => ELITE_MOD_BY_ID.get(id)?.name ?? id);
    if (m.gm) mods.push(`(${ELITE_MOD_BY_ID.get(m.gm)?.name ?? m.gm})`);
    if (mods.length && m.rr !== 1) {
      drawText(fx.g, mods.join(" "), x2, ly, "#c8c0e0", "center");
      ly -= 9;
    }
    if (m.rr && m.n) drawText(fx.g, m.n.toUpperCase(), x2, ly, col3, "center");
    else if (m.rr) drawText(fx.g, (MONSTER_BY_ID.get(m.k)?.name ?? m.k).toUpperCase(), x2, ly, col3, "center");
    if (boss) {
      const t4 = title(m.k);
      if (t4) drawText(fx.g, t4, x2, ly - 9, "#a89878", "center");
      if (m.iv) drawText(fx.g, "!", x2, ly - 18, "#ff5a3c", "center");
    }
    return true;
  }
  function drawBuffShrines(fx) {
    const g = fx.g;
    for (const [, x2, y2, id, used] of shrineList) {
      if (!fx.onScreen(x2, y2, 80)) continue;
      const d = SHRINE_BY_ID.get(id);
      const c = d?.color ?? "#ffffff";
      const pulse = used ? 0.25 : 0.55 + 0.25 * Math.sin(fx.time * 2.5);
      g.globalAlpha = pulse * 0.35;
      fx.ell(x2, y2, 46, c, null, true);
      g.globalAlpha = pulse;
      fx.ell(x2, y2, 46, null, c);
      fx.ell(x2, y2, 28, null, c);
      g.globalAlpha = 1;
      const sx = fx.sx(x2, y2);
      const sy = fx.sy(x2, y2);
      const h = fx.up(30);
      const w = fx.up(7);
      g.fillStyle = "#2a2622";
      g.fillRect(sx - w, sy - h, w * 2, h);
      g.fillStyle = "#4a443c";
      g.fillRect(sx - w, sy - h, w, h);
      g.fillStyle = used ? "#555" : c;
      g.globalAlpha = used ? 0.6 : 0.8 + 0.2 * Math.sin(fx.time * 4);
      g.fillRect(sx - fx.up(2), sy - h + fx.up(6), fx.up(4), fx.up(12));
      g.globalAlpha = 1;
    }
  }
  function drawBuffShrineLabels(fx) {
    for (const [, x2, y2, id, used] of shrineList) {
      if (!fx.onScreen(x2, y2, 80)) continue;
      const d = SHRINE_BY_ID.get(id);
      if (!d) continue;
      drawText(fx.g, used ? `${d.name} (spent)` : d.name, fx.sx(x2, y2), fx.sy(x2, y2) - fx.up(36), used ? "#7a7468" : d.color, "center");
    }
  }
  function drawBuffHud(fx) {
    if (!myBuff) return;
    const d = SHRINE_BY_ID.get(myBuff.id);
    if (!d) return;
    const left = Math.max(0, myBuff.t - (performance.now() - myBuff.at) / 1e3);
    if (left <= 0) return;
    const W3 = fx.g.canvas.width;
    drawText(fx.g, `${d.name}: ${d.desc}  ${Math.ceil(left)}s`, Math.floor(W3 / 2), fx.up(24), d.color, "center");
  }

  // src/client/gfx/light.ts
  var Q = 0.5;
  var spriteCache = /* @__PURE__ */ new Map();
  function lightSprite(c) {
    const key = `${c[0]}|${c[1]}|${c[2]}`;
    let cv = spriteCache.get(key);
    if (cv) return cv;
    if (spriteCache.size > 300) spriteCache.clear();
    const S3 = 128;
    cv = document.createElement("canvas");
    cv.width = S3;
    cv.height = S3;
    const g = cv.getContext("2d");
    const gr = g.createRadialGradient(S3 / 2, S3 / 2, 0, S3 / 2, S3 / 2, S3 / 2);
    for (const [t4, k] of [
      [0, 1],
      [0.15, 0.82],
      [0.35, 0.57],
      [0.55, 0.35],
      [0.75, 0.16],
      [0.9, 0.05],
      [1, 0]
    ])
      gr.addColorStop(t4, `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, S3, S3);
    spriteCache.set(key, cv);
    return cv;
  }
  function hexRGB(hex) {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  var LightMap = class {
    constructor() {
      __publicField(this, "cv", document.createElement("canvas"));
      __publicField(this, "g", this.cv.getContext("2d"));
      __publicField(this, "vig", null);
      __publicField(this, "w", 1);
      __publicField(this, "h", 1);
      __publicField(this, "count", 0);
    }
    /** Size in screen units. */
    resize(w, h) {
      this.w = w;
      this.h = h;
      const cw = Math.max(1, Math.ceil(w * Q));
      const ch = Math.max(1, Math.ceil(h * Q));
      if (this.cv.width === cw && this.cv.height === ch) return;
      this.cv.width = cw;
      this.cv.height = ch;
      this.vig = null;
    }
    begin(ambient) {
      this.count = 0;
      const { g, cv } = this;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "source-over";
      g.fillStyle = ambient;
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = "lighter";
      g.setTransform(Q, 0, 0, Q, 0, 0);
    }
    /** Add a light centred at screen unit (x, y); `rx` horizontal radius in units; `k` scales the colour. */
    add(x2, y2, rx, color, k = 1) {
      if (rx < 2 || k <= 0.02) return;
      const ry = rx * 0.62;
      if (x2 + rx < 0 || y2 + ry < 0 || x2 - rx > this.w || y2 - ry > this.h) return;
      const q = Math.round(Math.min(1.5, k) * 20) / 20;
      const c = [Math.min(255, Math.round(color[0] * q / 4) * 4), Math.min(255, Math.round(color[1] * q / 4) * 4), Math.min(255, Math.round(color[2] * q / 4) * 4)];
      this.g.drawImage(lightSprite(c), x2 - rx, y2 - ry, rx * 2, ry * 2);
      this.count++;
    }
    /** Multiply the light map onto the target (in screen units), then darken the edges. */
    apply(target) {
      const sm = target.imageSmoothingEnabled;
      target.imageSmoothingEnabled = true;
      target.globalCompositeOperation = "multiply";
      target.drawImage(this.cv, 0, 0, this.cv.width / Q, this.cv.height / Q);
      target.globalCompositeOperation = "source-over";
      target.drawImage(this.vignette(), 0, 0, this.w, this.h);
      target.imageSmoothingEnabled = sm;
    }
    vignette() {
      if (this.vig) return this.vig;
      const w = 256;
      const h = Math.max(32, Math.round(256 * this.h / Math.max(1, this.w)));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const g = cv.getContext("2d");
      g.setTransform(1, 0, 0, h / w, 0, 0);
      const gr = g.createRadialGradient(w / 2, w / 2, w * 0.36, w / 2, w / 2, w * 0.78);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(0.35, "rgba(0,0,0,0.18)");
      gr.addColorStop(0.7, "rgba(0,0,0,0.5)");
      gr.addColorStop(1, "rgba(0,0,0,0.78)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
      this.vig = cv;
      return cv;
    }
  };

  // src/client/gfx/props.ts
  var ZS = ART * 0.87;
  var pal = (...h) => h.map((c) => rgba(c));
  var ROCK = pal("#121113", "#1e1c1e", "#2b2828", "#3c3734", "#544c45", "#70675d", "#8e8476");
  var LICHEN = pal("#1a1d16", "#262b1f", "#343b29", "#444c33");
  var RUIN = pal("#121116", "#1d1b22", "#2a2730", "#3a3640", "#4e4953", "#666069", "#827b84");
  var DIRT = pal("#140f0b", "#1e1711", "#291f17", "#34281d", "#3f3123", "#4a3a2a", "#57442f");
  var RUNE = rgba("#8fe8ff");
  var RUNE2 = rgba("#3f9fc0");
  var LX2 = -0.55;
  var LY2 = -0.45;
  var LZ2 = 0.7;
  var LN = Math.hypot(LX2, LY2, LZ2);
  function shadeIdx(nx, ny, nz, n2) {
    const l = Math.hypot(nx, ny, nz) || 1;
    const lit = (nx * LX2 + ny * LY2 + nz * LZ2) / (l * LN);
    return Math.max(0, Math.min(n2 - 1, Math.floor((lit + 0.45) / 1.45 * n2)));
  }
  function rock(cx, cy, rr3, hh, seed2, p = ROCK) {
    const rnd4 = mulberry322(seed2 * 7919 + 17);
    const planes = [];
    const n2 = 6 + Math.floor(rnd4() * 3);
    const a0 = rnd4() * 6.283;
    for (let i = 0; i < n2; i++) {
      const a = a0 + (i + (rnd4() - 0.5) * 0.7) / n2 * Math.PI * 2;
      planes.push([Math.cos(a), Math.sin(a), 1.05 + rnd4() * 0.9, hh * (0.95 + rnd4() * 0.35)]);
    }
    const top = hh * (0.72 + rnd4() * 0.2);
    const t0 = (rnd4() - 0.5) * 0.5;
    const t1 = (rnd4() - 0.5) * 0.5;
    const s = {
      n: [0, 0, 1],
      sn: [0, 0],
      u: 0,
      gap: 9,
      pal: p,
      cols: false,
      brick: false,
      lichen: p === ROCK,
      seed: seed2,
      z(x2, y2) {
        const dx = x2 - cx;
        const dy = y2 - cy;
        if (dx * dx + dy * dy > rr3 * rr3 * 2.2) return -1;
        let z2 = top * (1 + (t0 * dx + t1 * dy) / rr3);
        let z22 = Infinity;
        let best = -1;
        for (let i = 0; i < planes.length; i++) {
          const [px, py, k, h] = planes[i];
          const zz = h * (1 - k * (dx * px + dy * py) / rr3);
          if (zz < z2) {
            z22 = z2;
            z2 = zz;
            best = i;
          } else if (zz < z22) z22 = zz;
        }
        if (z2 <= 0.3) return -1;
        if (best < 0) s.n = [-top * t0 * 2 / rr3, -top * t1 * 2 / rr3, 1];
        else {
          const [px, py, k, h] = planes[best];
          s.n = [h * k / rr3 * px * 2, h * k / rr3 * py * 2, 1];
        }
        s.gap = z22 - z2;
        return z2;
      }
    };
    return s;
  }
  function box(cx, cy, ang, len, thk, hFn, seed2, p = RUIN) {
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const s = {
      n: [0, 0, 1],
      sn: [0, 0],
      u: 0,
      gap: 9,
      pal: p,
      cols: true,
      brick: true,
      lichen: false,
      seed: seed2,
      z(x2, y2) {
        const dx = x2 - cx;
        const dy = y2 - cy;
        const u = dx * c + dy * sn;
        const w = -dx * sn + dy * c;
        if (Math.abs(u) > len / 2 || Math.abs(w) > thk / 2) return -1;
        const z2 = hFn(u);
        if (z2 <= 0.5) return -1;
        if (thk / 2 - Math.abs(w) < len / 2 - Math.abs(u)) {
          const k = Math.sign(w) || 1;
          s.sn = [-sn * k, c * k];
          s.u = u;
        } else {
          const k = Math.sign(u) || 1;
          s.sn = [c * k, sn * k];
          s.u = w;
        }
        s.n = [0, 0, 1];
        return z2;
      }
    };
    return s;
  }
  function pillar(cx, cy, pr, ph, broken, seed2) {
    const ba = hash2(seed2, 2, 91) * 6.283;
    const bx = Math.cos(ba);
    const by = Math.sin(ba);
    const s = {
      n: [0, 0, 1],
      sn: [0, 0],
      u: 0,
      gap: 9,
      pal: RUIN,
      cols: true,
      brick: false,
      lichen: false,
      seed: seed2,
      z(x2, y2) {
        const dx = x2 - cx;
        const dy = y2 - cy;
        const d = Math.hypot(dx, dy);
        if (d > pr) return -1;
        const z2 = ph - broken * ((dx * bx + dy * by) / pr) * 4 - broken * (hash2(Math.round(dx), Math.round(dy), seed2) * 2);
        s.n = [broken * bx * 0.6, broken * by * 0.6, 1];
        s.sn = [dx / (d || 1), dy / (d || 1)];
        s.u = Math.atan2(dy, dx) * 4;
        return z2;
      }
    };
    return s;
  }
  function splat(buf, solids, ax, ay, B) {
    const step = 0.55 / K;
    const zAt = (x2, y2) => {
      let m = -1;
      for (const s of solids) m = Math.max(m, s.z(x2, y2));
      return m;
    };
    for (let y2 = -B; y2 <= B; y2 += step) {
      for (let x2 = -B; x2 <= B; x2 += step) {
        let best = null;
        let bz = -1;
        for (const s of solids) {
          const z2 = s.z(x2, y2);
          if (z2 > bz) {
            bz = z2;
            best = s;
          }
        }
        if (!best || bz <= 0) continue;
        best.z(x2, y2);
        const P3 = best.pal;
        const N = P3.length;
        let i = shadeIdx(best.n[0], best.n[1], best.n[2], N);
        if (!best.cols) {
          if (Math.abs(vnoise2(x2 / 6 + best.seed * 3.1, y2 / 6, 63) - 0.5) < 0.028) i -= 2;
          else if (best.gap < 1.1 && i >= 3) i += 1;
          if (hash2(Math.round(x2 * 2), Math.round(y2 * 2), best.seed) > 0.9) i -= 1;
        } else if (hash2(Math.round(x2 * 2), Math.round(y2 * 2), best.seed) > 0.85) i -= 1;
        i = Math.max(0, Math.min(N - 1, i));
        let c = P3[i];
        if (best.lichen && best.n[2] / Math.hypot(...best.n) > 0.8 && vnoise2(x2 / 7 + best.seed, y2 / 7, 64) > 0.62) c = LICHEN[Math.min(3, Math.max(0, i - 2))];
        const sx = ax + x2 * K;
        const gy = ay + y2 * K * SQ;
        const px = Math.floor(sx);
        const py = Math.floor(gy - bz * ZS);
        buf.set(px, py, c);
        buf.set(px, py + 1, c);
        const front = zAt(x2, y2 + step * 1.5);
        if (front < bz - 1.5) {
          const sideI = best.cols ? shadeIdx(best.sn[0], best.sn[1], 0.25, N) + 1 : Math.max(0, i - 2);
          const bottom = Math.floor(gy - Math.max(0, front) * ZS);
          for (let yy = py + 1; yy <= bottom; yy++) {
            const zz = bz - (yy - py) / ZS;
            let si = sideI;
            if (best.brick) {
              const row = Math.floor(zz / 5);
              const uu = best.u + (row & 1) * 5;
              if (zz - row * 5 < 1 || (uu % 11 + 11) % 11 < 1) si -= 2;
              else if (hash2(Math.floor(uu / 11), row, best.seed + 40) > 0.75) si += 1;
            } else if (best.cols && Math.floor(best.u) % 3 === 0) si -= 1;
            else if (!best.cols && hash2(px, yy, best.seed + 3) > 0.8) si -= 1;
            if (zz < 6 && vnoise2(best.u / 4 + x2 / 4, zz / 3, 43 + best.seed) > 0.55) {
              buf.set(px, yy, mixColor(P3[Math.max(0, Math.min(N - 1, si))], LICHEN[1], 0.7));
              continue;
            }
            buf.set(px, yy, P3[Math.max(0, Math.min(N - 1, si))]);
          }
        }
      }
    }
  }
  var OBS_KINDS = ["rocks", "ruin", "tree", "shrine", "water"];
  function findShrine() {
    const named = OBSTACLES.findIndex((o) => o.k === "shrine");
    if (named >= 0) return named;
    let best = -1;
    let bd = Infinity;
    OBSTACLES.forEach((o, i) => {
      if (o.k) return;
      const d = Math.hypot(o.x - MAP_W / 2, o.y - MAP_H / 2) - o.r * 0.5;
      if (d < bd && o.r > 45) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  var SHRINE_I = findShrine();
  function shrineIndex() {
    return SHRINE_I;
  }
  function obstacleKind(i) {
    if (i === SHRINE_I) return "shrine";
    const k = OBSTACLES[i]?.k;
    if (k && OBS_KINDS.includes(k)) return k;
    const h = hash2(i, 7, 90);
    if (h < 0.24) return "ruin";
    if (h < 0.42) return "tree";
    return "rocks";
  }
  var WOOD2 = [rgba("#100d0b"), rgba("#211b17"), rgba("#362e27"), rgba("#4f453b")];
  var BONE2 = ramp("#4a4438", "#7d7462", "#aaa088", "#cfc6ac");
  var IRON = ramp("#0e0e10", "#1e1e22", "#33333a", "#4f4f58");
  function treeParts(seed2, scale) {
    const rnd4 = mulberry322(seed2 * 31 + 7);
    const P3 = [];
    const branch = (a, dir, len, r, depth) => {
      const b = add(a, mul(dir, len));
      P3.push({ kind: "cap", a, b, r, ramp: WOOD2 });
      if (depth <= 0 || r < 0.45) return;
      const n2 = 2 + (rnd4() < 0.45 ? 1 : 0);
      for (let k = 0; k < n2; k++) {
        const d2 = norm(add(dir, v((rnd4() - 0.5) * 1.6, (rnd4() - 0.5) * 1.6, (rnd4() - 0.25) * 0.7)));
        branch(lerp3(a, b, 0.6 + rnd4() * 0.4), d2, len * (0.58 + rnd4() * 0.15), r * 0.6, depth - 1);
      }
    };
    branch(v(0, 0, 0), norm(v((rnd4() - 0.5) * 0.4, (rnd4() - 0.5) * 0.4, 1)), 22 * scale, 2.8 * scale, 4);
    for (let k = 0; k < 4; k++) {
      const a = rnd4() * 6.283;
      P3.push({ kind: "cap", a: v(0, 0, 3), b: v(Math.cos(a) * 7 * scale, Math.sin(a) * 7 * scale, 0), r: 1.4 * scale, ramp: WOOD2 });
    }
    return P3;
  }
  var obsCache = /* @__PURE__ */ new Map();
  function obstacleSprite(i) {
    let s = obsCache.get(i);
    if (s) return s;
    const o = OBSTACLES[i];
    const r = o.r;
    const seed2 = i + 1;
    const rnd4 = mulberry322(seed2 * 104729);
    const kind2 = obstacleKind(i);
    const solids = [];
    let maxZ = 40;
    let tree = null;
    let rune = null;
    if (kind2 === "rocks") {
      const ox = (rnd4() - 0.5) * r * 0.2;
      const oy = (rnd4() - 0.5) * r * 0.2;
      solids.push(rock(ox, oy, r * 0.74, 8 + r * 0.28, seed2));
      const n2 = 2 + Math.floor(rnd4() * 3);
      for (let k = 0; k < n2; k++) {
        const a = rnd4() * 6.283;
        const d = r * (0.55 + rnd4() * 0.3);
        const rr3 = r * (0.24 + rnd4() * 0.18);
        solids.push(rock(Math.cos(a) * d, Math.sin(a) * d, rr3, 4 + rr3 * 0.32, seed2 * 10 + k));
      }
    } else if (kind2 === "ruin") {
      const th = rnd4() * Math.PI;
      const len = r * 1.75;
      const H4 = 20 + r * 0.14;
      const sd = seed2;
      const hFn = (u) => {
        const t4 = vnoise2(u / 10 + sd * 5, 0, 92);
        if (t4 < 0.22) return 4 + t4 * 10;
        return H4 * (0.45 + 0.55 * t4) + (hash2(Math.floor(u / 3), 1, sd) - 0.5) * 3;
      };
      solids.push(box(0, 0, th, len, 9, hFn, seed2));
      const ex = Math.cos(th) * (len / 2 + 2);
      const ey = Math.sin(th) * (len / 2 + 2);
      solids.push(pillar(ex, ey, 7, 34 + rnd4() * 10, 0, seed2 + 1));
      solids.push(pillar(-ex, -ey, 7, 16 + rnd4() * 10, 1, seed2 + 2));
      for (let k = 0; k < 5; k++) {
        const a = th + (k % 2 ? Math.PI / 2 : -Math.PI / 2) + (rnd4() - 0.5) * 1.2;
        const d = r * (0.35 + rnd4() * 0.45);
        const rr3 = r * (0.12 + rnd4() * 0.12) + 3;
        solids.push(k < 2 ? box(Math.cos(a) * d, Math.sin(a) * d, rnd4() * 3, rr3 * 1.6, rr3, () => 5 + rnd4() * 0 + rr3 * 0.3, seed2 + 20 + k) : rock(Math.cos(a) * d, Math.sin(a) * d, rr3, 3 + rr3 * 0.35, seed2 * 20 + k, RUIN));
      }
      maxZ = 52;
    } else if (kind2 === "tree") {
      solids.push(rock(0, 0, r * 0.82, 5 + r * 0.1, seed2, ROCK));
      for (let k = 0; k < 3; k++) {
        const a = rnd4() * 6.283;
        const d = r * (0.6 + rnd4() * 0.25);
        const rr3 = r * (0.18 + rnd4() * 0.12);
        solids.push(rock(Math.cos(a) * d, Math.sin(a) * d, rr3, 3 + rr3 * 0.35, seed2 * 30 + k));
      }
      tree = { x: 0, y: 0, z: 0 };
      maxZ = 96;
    } else {
      const sd = seed2;
      solids.push(box(0, 0, Math.PI / 4, r * 1.6, r * 1.6, () => 5, sd, RUIN));
      solids.push(box(0, 0, Math.PI / 4, r * 1.05, r * 1.05, () => 10, sd + 1, RUIN));
      solids.push(box(0, 0, Math.PI / 4, 16, 8, (u) => 50 - Math.abs(u) * 0.6, sd + 2, RUIN));
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2;
        solids.push(pillar(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, 5, 18 + hash2(k, sd, 93) * 18, k % 2, sd + 10 + k));
      }
      rune = { x: 0, y: 0, z: 0 };
      maxZ = 60;
    }
    const B = r * 1.3;
    const W3 = Math.ceil(2 * B * K) + 12;
    const H3 = Math.ceil(2 * B * K * SQ + maxZ * ZS + 12);
    const ax = Math.floor(W3 / 2);
    const ay = Math.ceil(maxZ * ZS + B * K * SQ + 6);
    const buf = new PixBuf(W3, H3);
    splat(buf, solids, ax, ay, B);
    if (tree) {
      let z2 = -1;
      for (const so of solids) z2 = Math.max(z2, so.z(0, 0));
      const parts = treeParts(seed2, r > 55 ? 1.25 : 1);
      rasterize(parts, projector(rnd4() * 6.283, ART, ax, ay - Math.max(0, z2) * ZS + 1), ART, buf, false);
    }
    buf.outline(0.4);
    if (rune) {
      const gx = ax - 3;
      const gy = Math.round(ay + 5 * K * SQ - 40 * ZS);
      const glyph2 = [".x.", "xxx", ".x.", "x.x", ".x.", "x.x"];
      glyph2.forEach((row, j) => [...row].forEach((ch, k) => ch === "x" && buf.set(gx + k, gy + j * 2, RUNE)));
      glyph2.forEach((row, j) => [...row].forEach((ch, k) => ch === "x" && buf.set(gx + k, gy + j * 2 + 1, RUNE2)));
      buf.set(ax + 4, gy + 4, RUNE2);
      buf.set(ax + 5, gy + 8, RUNE2);
    }
    s = sprite(buf, ax, ay);
    obsCache.set(i, s);
    if (obsCache.size > 2500) obsCache.delete(obsCache.keys().next().value);
    return s;
  }
  var PAVED = [];
  function fillPaved() {
    PAVED.length = 0;
    OBSTACLES.forEach((o, i) => {
      const k = obstacleKind(i);
      if (k === "ruin" || k === "shrine") PAVED.push({ o, k });
    });
  }
  fillPaved();
  var SCATTER = [];
  function fillScatter() {
    SCATTER.length = 0;
    for (const s of makeScatter()) SCATTER.push(s);
  }
  function makeScatter() {
    const map = currentMap();
    const rnd4 = mulberry322(90210 ^ map.seed);
    const out = [];
    const near = /* @__PURE__ */ new Set();
    const nkey = (x2, y2) => Math.floor(x2 / 24) * 65536 + Math.floor(y2 / 24);
    const free2 = (x2, y2, pad) => {
      if (!(x2 > 70 && y2 > 70 && x2 < MAP_W - 70 && y2 < MAP_H - 70) || !isWalkable(x2, y2, 1, pad)) return false;
      if (near.has(nkey(x2, y2))) return false;
      return true;
    };
    const push = (s) => {
      out.push(s);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) near.add(nkey(s.x + a * 18, s.y + b * 18));
    };
    const sw = map.biome.scatter;
    const areaK = map.openArea / 22e5;
    const graves = Math.round(16 * areaK * sw.grave * 0.5);
    for (let g = 0; g < graves; g++) {
      const x0 = 150 + rnd4() * (MAP_W - 300);
      const y0 = 150 + rnd4() * (MAP_H - 300);
      const n2 = 3 + Math.floor(rnd4() * 3);
      for (let k = 0; k < n2; k++) {
        const x2 = x0 + k * 34 + (rnd4() - 0.5) * 8;
        const y2 = y0 - k * 4 + (rnd4() - 0.5) * 8 + k % 2 * 30;
        if (free2(x2, y2, 30)) push({ x: x2, y: y2, kind: "grave", seed: g % 24 * 10 + k });
      }
    }
    const kinds = [
      ["bones", Math.round(15 * areaK * sw.bones)],
      ["shrub", Math.round(10 * areaK * sw.shrub)],
      ["stones", Math.round(13 * areaK * sw.stones)]
    ];
    for (const [kind2, n2] of kinds) {
      for (let k = 0; k < n2; k++) {
        const x2 = 90 + rnd4() * (MAP_W - 180);
        const y2 = 90 + rnd4() * (MAP_H - 180);
        if (free2(x2, y2, 24)) push({ x: x2, y: y2, kind: kind2, seed: k % 48 + 1 });
      }
    }
    return out;
  }
  fillScatter();
  function refreshProps() {
    SHRINE_I = findShrine();
    obsCache.clear();
    scatterCache.clear();
    fillPaved();
    fillScatter();
  }
  var scatterCache = /* @__PURE__ */ new Map();
  function scatterSprite(idx) {
    const sc = SCATTER[idx];
    const ck = sc.seed * 8 + ["grave", "bones", "shrub", "stones"].indexOf(sc.kind);
    let s = scatterCache.get(ck);
    if (s) return s;
    const rnd4 = mulberry322(sc.seed * 613 + sc.kind.length * 97);
    const W3 = Math.ceil(48 * ART);
    const H3 = Math.ceil(48 * ART);
    const ax = Math.floor(W3 / 2);
    const ay = Math.ceil(36 * ART);
    const buf = new PixBuf(W3, H3);
    if (sc.kind === "grave") {
      const tilt = (rnd4() - 0.5) * 0.25;
      const h = 11 + rnd4() * 6;
      const ang = Math.PI / 4 + (rnd4() - 0.5) * 0.3;
      const mound = rock(4, 4, 8, 2.5, sc.seed + 500, DIRT);
      mound.lichen = false;
      const stone = box(-2, -2, ang, 9, 3.5, (u) => h - (Math.abs(u) > 3 ? 2 : 0) - (Math.abs(u) > 4 ? 2 : 0) + tilt * u * 3, sc.seed + 700, RUIN);
      stone.brick = false;
      splat(buf, [mound, stone], ax, ay, 14);
      if (rnd4() < 0.5) {
        buf.set(ax - 2, ay - Math.round(h) + 3, RUIN[0]);
        buf.set(ax - 2, ay - Math.round(h) + 4, RUIN[0]);
      }
      buf.outline(0.4);
    } else if (sc.kind === "stones") {
      const solids = [rock(0, 0, 5 + rnd4() * 3, 3 + rnd4() * 2, sc.seed + 900)];
      if (rnd4() < 0.6) solids.push(rock(6, -3, 3 + rnd4() * 2, 2 + rnd4(), sc.seed + 901));
      splat(buf, solids, ax, ay, 14);
      buf.outline(0.4);
    } else {
      const P3 = [];
      if (sc.kind === "bones") {
        const n2 = 3 + Math.floor(rnd4() * 3);
        for (let k = 0; k < n2; k++) {
          const a = rnd4() * 6.283;
          const c = v((rnd4() - 0.5) * 8, (rnd4() - 0.5) * 8, 0.8 + k * 0.4);
          const l = 3 + rnd4() * 3;
          P3.push({ kind: "cap", a: add(c, v(Math.cos(a) * -l, Math.sin(a) * -l, 0)), b: add(c, v(Math.cos(a) * l, Math.sin(a) * l, 0.3)), r: 0.75, ramp: BONE2 });
        }
        if (rnd4() < 0.7) {
          const c = v((rnd4() - 0.5) * 4, (rnd4() - 0.5) * 4, 2.2);
          P3.push({ kind: "sph", a: c, r: 2.4, ramp: BONE2 });
          P3.push({ kind: "dot", a: add(c, v(2, -0.8, 0.3)), ref: c, r: 1, ramp: BONE2, color: rgba("#0e0b09"), depthBias: 1 });
          P3.push({ kind: "dot", a: add(c, v(2, 0.8, 0.3)), ref: c, r: 1, ramp: BONE2, color: rgba("#0e0b09"), depthBias: 1 });
        }
      } else {
        const n2 = 5 + Math.floor(rnd4() * 4);
        for (let k = 0; k < n2; k++) {
          const a = rnd4() * 6.283;
          const up = 0.6 + rnd4() * 0.8;
          const l = 5 + rnd4() * 6;
          const mid = v(Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.5, up * l * 0.5);
          P3.push({ kind: "cap", a: v(0, 0, 0), b: mid, r: 0.6, ramp: WOOD2 });
          P3.push({ kind: "cap", a: mid, b: add(mid, v(Math.cos(a + 0.6) * l * 0.4, Math.sin(a + 0.6) * l * 0.4, up * l * 0.5)), r: 0.45, ramp: WOOD2 });
        }
      }
      rasterize(P3, projector(rnd4() * 6.283, ART, ax, ay), ART, buf);
    }
    s = sprite(buf, ax, ay);
    scatterCache.set(ck, s);
    return s;
  }
  var stakeCache = /* @__PURE__ */ new Map();
  function stakeSprite(seed2, outDir) {
    const key = seed2 * 16 + outDir;
    let s = stakeCache.get(key);
    if (s) return s;
    const rnd4 = mulberry322(seed2 * 7 + outDir * 131);
    const P3 = [];
    const TIP = ramp("#4a4136", "#7a6d5b", "#a39478", "#c4b496");
    for (let k = -1; k <= 1; k++) {
      const base = v(rnd4() * 2, k * 4.5 + (rnd4() - 0.5), 0);
      const len = 15 + rnd4() * 6;
      const dir = norm(v(0.55 + rnd4() * 0.2, (rnd4() - 0.5) * 0.2, 1));
      const top = add(base, mul(dir, len));
      P3.push({ kind: "cap", a: base, b: top, r: 1.3, ramp: WOOD2 });
      P3.push({ kind: "cap", a: top, b: add(top, mul(dir, 3.2)), r: 0.6, ramp: TIP });
    }
    P3.push({ kind: "cap", a: v(3, -5, 7), b: v(3, 5, 7.2), r: 0.5, ramp: ramp("#1a140e", "#2e251a", "#463a2a", "#5c4d38") });
    const SW = Math.ceil(44 * ART);
    const sax = Math.floor(SW / 2);
    const say = Math.ceil(32 * ART);
    const buf = new PixBuf(SW, SW);
    rasterize(P3, projector(outDir / 8 * Math.PI * 2, ART, sax, say), ART, buf);
    s = sprite(buf, sax, say);
    stakeCache.set(key, s);
    return s;
  }
  var brazierCache = /* @__PURE__ */ new Map();
  function brazierSprite(frame2) {
    let s = brazierCache.get(frame2);
    if (s) return s;
    const P3 = [];
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI * 2 + 0.4;
      P3.push({ kind: "cap", a: v(Math.cos(a) * 5, Math.sin(a) * 5, 0), b: v(Math.cos(a) * 2, Math.sin(a) * 2, 11), r: 0.8, ramp: IRON });
    }
    P3.push({ kind: "sph", a: v(0, 0, 13), r: 5, ramp: IRON, ry: 0.55 });
    const buf = new PixBuf(Math.ceil(32 * ART), Math.ceil(52 * ART));
    const ax = Math.floor(16 * ART);
    const ay = Math.ceil(46 * ART);
    rasterize(P3, projector(0.3, ART, ax, ay), ART, buf);
    const coal = [rgba("#5a1608"), rgba("#a8320c"), rgba("#ff7a1a")];
    const top = ay - Math.round(15 * ART * 0.8);
    for (let x2 = -6; x2 <= 6; x2++) buf.set(ax + x2, top, coal[(x2 + frame2 + 9) % 3]);
    const FL = [rgba("#fff3c0"), rgba("#ffd25a"), rgba("#ff9a2a"), rgba("#e0501a"), rgba("#8a2410")];
    for (let x2 = -6; x2 <= 6; x2++) {
      const h = Math.max(2, Math.round((20 - Math.abs(x2) * 2.7) * (0.65 + 0.35 * hash2(x2, frame2, 77)) + (frame2 % 2 ? 1 : 0)));
      for (let y2 = 0; y2 < h; y2++) {
        const t4 = y2 / h;
        const edge2 = Math.abs(x2) >= 4 || t4 > 0.8;
        const c = edge2 ? t4 > 0.7 ? FL[4] : FL[3] : t4 < 0.35 && Math.abs(x2) <= 1 ? FL[0] : t4 < 0.6 ? FL[1] : FL[2];
        buf.set(ax + x2 + (t4 > 0.6 ? (frame2 % 2 ? 1 : -1) * (x2 > 0 ? 1 : 0) : 0), top - 1 - y2, c);
      }
    }
    if (frame2 % 2 === 0) buf.set(ax + 1, top - 24, FL[3]);
    else buf.set(ax - 2, top - 22, FL[4]);
    s = sprite(buf, ax, ay);
    brazierCache.set(frame2, s);
    return s;
  }

  // src/client/gfx/world.ts
  var WALL_MAX = 44 * 1.35;
  var GROUND_OX = 10;
  var GROUND_OY = Math.ceil(WALL_MAX + 12);
  var VOID = "#07070a";
  var CHUNK = 128;
  var GROUND_FILL = "#26281e";
  var mapW = MAP_W;
  var mapH = MAP_H;
  var GW = mapW * K;
  var GH = mapH * K * SQ;
  var GRASS = ["#1b1c16", "#22241b", "#292b20", "#303225", "#38392a", "#42422f"].map((c) => rgba(c));
  var DIRT2 = ["#1f1813", "#271f18", "#30261d", "#392d22", "#433528"].map((c) => rgba(c));
  var MUD = rgba("#17120e");
  var FLAG = ["#1c1b1f", "#26242a", "#2f2d33", "#38353c", "#423f46"].map((c) => rgba(c));
  var FLAG_GAP = rgba("#121014");
  var BASE_GRASS = [...GRASS];
  var BASE_DIRT = [...DIRT2];
  var WALL_FILL = [];
  var WATER_FILL = [];
  function applyBiome() {
    const b = currentBiome();
    const [tr, tg, tb] = b.palette.tint;
    const tint = (c) => {
      const r = Math.min(255, Math.round((c & 255) * tr));
      const g = Math.min(255, Math.round((c >>> 8 & 255) * tg));
      const bl = Math.min(255, Math.round((c >>> 16 & 255) * tb));
      return (c & 4278190080 | bl << 16 | g << 8 | r) >>> 0;
    };
    BASE_GRASS.forEach((c, i) => GRASS[i] = tint(c));
    BASE_DIRT.forEach((c, i) => DIRT2[i] = tint(c));
    const wall = rgba(b.palette.wall);
    const edge2 = rgba(b.palette.wallEdge);
    WALL_FILL = [0, 0.25, 0.5, 0.75].map((t4) => mixColor(wall, edge2, t4));
    const water = rgba(b.palette.water);
    WATER_FILL = [0.8, 0.9, 1, 1.15, 1.35].map((f) => scaleColor(water, f));
  }
  applyBiome();
  function blockedColor(x2, y2, px, py) {
    const k = cellKindAt(x2, y2);
    if (k === OPEN) return 0;
    if (k === WATER) {
      const n3 = vnoise2(x2 / 70, y2 / 50, 21) * 0.7 + hash2(px, py, 23) * 0.3;
      return WATER_FILL[Math.min(4, Math.floor(n3 * 5))];
    }
    const n2 = vnoise2(x2 / 40, y2 / 40, 22) * 0.75 + hash2(px, py, 24) * 0.25;
    return WALL_FILL[Math.min(3, Math.floor(n2 * 4))];
  }
  var chunkCache = /* @__PURE__ */ new Map();
  var CHUNK_CACHE_MAX = 700;
  function setGroundSize(w, h) {
    if (w === mapW && h === mapH) return;
    mapW = w;
    mapH = h;
    GW = w * K;
    GH = h * K * SQ;
    chunkCache.clear();
    pavedGrid = null;
  }
  function resetGround() {
    applyBiome();
    wallRamps();
    refreshProps();
    chunkCache.clear();
    pavedGrid = null;
  }
  function groundChunkRange() {
    return {
      cx0: Math.floor(isoX(0, mapH) / CHUNK) - 1,
      cx1: Math.floor(isoX(mapW, 0) / CHUNK) + 1,
      cy0: -1,
      cy1: Math.floor(isoY(mapW, mapH) / CHUNK) + 1
    };
  }
  var WALL_H = 30;
  var isWall = (x2, y2) => cellKindAt(x2, y2) === 1;
  var WALL_TOP = [];
  var WALL_RIM = 0;
  var FACE_L = [];
  var FACE_R = [];
  function wallRamps() {
    const b = currentBiome();
    const wall = rgba(b.palette.wall);
    const edge2 = rgba(b.palette.wallEdge);
    WALL_TOP = [0.75, 0.9, 1, 1.12, 1.25].map((f) => scaleColor(mixColor(wall, edge2, 0.35), f));
    WALL_RIM = scaleColor(edge2, 1.45);
    FACE_L = [0.45, 0.55, 0.65, 0.75].map((f) => scaleColor(edge2, f));
    FACE_R = [0.25, 0.32, 0.4, 0.48].map((f) => scaleColor(edge2, f));
  }
  function raisedWall(sx, sy, px, py) {
    const t4 = unproject(sx, sy + WALL_H);
    if (isWall(t4.x, t4.y)) {
      const r = unproject(sx, sy + WALL_H + 2.2);
      if (!isWall(r.x, r.y)) return WALL_RIM;
      const n2 = vnoise2(t4.x / 46, t4.y / 46, 61) * 0.6 + vnoise2(t4.x / 13, t4.y / 13, 62) * 0.3 + hash2(px, py, 63) * 0.1;
      return WALL_TOP[Math.min(4, Math.floor(n2 * 5))];
    }
    const g = unproject(sx, sy);
    const mid = unproject(sx, sy + WALL_H * 0.5);
    if (!isWall(g.x, g.y) && !isWall(mid.x, mid.y) && cellKindAt(g.x + 64, g.y + 64) !== 1 && cellKindAt(g.x + 32, g.y + 32) !== 1) return 0;
    for (let z2 = WALL_H - 1.5; z2 >= 0; z2 -= 1.5) {
      const q = unproject(sx, sy + z2);
      if (!isWall(q.x, q.y)) continue;
      const openX = !isWall(q.x + 20, q.y);
      const openY = !isWall(q.x, q.y + 20);
      const k = z2 / WALL_H;
      const strata = Math.floor((z2 + vnoise2(sx / 14, 0, 64) * 5) / 5);
      const i = Math.max(0, Math.min(3, Math.floor(k * 3.2 + (hash2(strata, Math.floor(sx / 7), 65) > 0.7 ? 1 : 0))));
      return openY && !openX ? FACE_L[i] : FACE_R[i];
    }
    return 0;
  }
  var GROUND_D = 2;
  var PAD = 2;
  function cachedChunk(cx, cy) {
    const key = cx + "," + cy;
    const c = chunkCache.get(key);
    if (c !== void 0) {
      chunkCache.delete(key);
      chunkCache.set(key, c);
    }
    return c;
  }
  function buildChunk(cx, cy) {
    const key = cx + "," + cy;
    const r = groundChunkRange();
    if (cx < r.cx0 || cx > r.cx1 || cy < r.cy0 || cy > r.cy1) {
      chunkCache.set(key, null);
      return null;
    }
    const D = GROUND_D;
    const N = CHUNK + PAD * 2;
    const buf = new PixBuf(N, N);
    const d = buf.data;
    const ix0 = cx * CHUNK;
    const iy0 = cy * CHUNK;
    let any = false;
    for (let j = 0; j < N; j++) {
      const sy = iy0 + (j - PAD + 0.5);
      const py = Math.floor(sy) + GROUND_OY;
      for (let i = 0; i < N; i++) {
        const sx = ix0 + (i - PAD + 0.5);
        const px = Math.floor(sx) + GROUND_OX;
        let c = raisedWall(sx, sy, px, py);
        if (c === 0) {
          const { x: x2, y: y2 } = unproject(sx, sy);
          if (x2 < 0 || y2 < 0 || x2 >= mapW || y2 >= mapH) continue;
          c = groundColor(x2, y2, px, py);
        }
        if (c) {
          d[j * N + i] = c;
          any = true;
        }
      }
    }
    if (!any) {
      chunkCache.set(key, null);
      return null;
    }
    const src = buf.toCanvas();
    const cv = document.createElement("canvas");
    cv.width = CHUNK * D;
    cv.height = CHUNK * D;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.filter = "blur(1.1px)";
    g.drawImage(src, -PAD * D, -PAD * D, N * D, N * D);
    g.filter = "none";
    paintDecor(g, ix0, iy0);
    chunkCache.set(key, cv);
    while (chunkCache.size > CHUNK_CACHE_MAX) chunkCache.delete(chunkCache.keys().next().value);
    return cv;
  }
  var PAVE_CELL = 256;
  var pavedGrid = null;
  function pavedNear(x2, y2) {
    if (!pavedGrid) {
      pavedGrid = /* @__PURE__ */ new Map();
      for (const e of PAVED) {
        const R8 = e.o.r * 2.3;
        for (let gx = Math.floor((e.o.x - R8) / PAVE_CELL); gx <= Math.floor((e.o.x + R8) / PAVE_CELL); gx++) {
          for (let gy = Math.floor((e.o.y - R8) / PAVE_CELL); gy <= Math.floor((e.o.y + R8) / PAVE_CELL); gy++) {
            const k = gx * 65536 + gy;
            let l = pavedGrid.get(k);
            if (!l) pavedGrid.set(k, l = []);
            l.push(e);
          }
        }
      }
    }
    return pavedGrid.get(Math.floor(x2 / PAVE_CELL) * 65536 + Math.floor(y2 / PAVE_CELL));
  }
  function flagstone(x2, y2, px, py) {
    const near = pavedNear(x2, y2);
    if (!near) return null;
    for (const { o } of near) {
      const dx = x2 - o.x;
      const dy = y2 - o.y;
      const d = Math.hypot(dx, dy) / o.r;
      const edge2 = 1.55 + vnoise2(x2 / 30, y2 / 30, 94) * 0.7;
      if (d > edge2) continue;
      if (d > edge2 - 0.35 && hash2(Math.floor(x2 / 22), Math.floor(y2 / 22), 95) > (edge2 - d) / 0.35) return null;
      const tx = Math.floor(x2 / 22 + (Math.floor(y2 / 22) & 1) * 0.5);
      const ty = Math.floor(y2 / 22);
      const gx = x2 / 22 + (ty & 1) * 0.5 - tx;
      const gy = y2 / 22 - ty;
      if (hash2(tx, ty, 96) < 0.12) return null;
      if (gx < 0.07 || gy < 0.07) return FLAG_GAP;
      let i = 1 + Math.floor(hash2(tx, ty, 97) * 3) + (hash2(px, py, 98) > 0.8 ? 1 : 0) - (gx > 0.9 || gy > 0.9 ? 1 : 0);
      if (Math.abs(vnoise2(x2 / 9 + tx, y2 / 9, 99) - 0.5) < 0.03) i = 0;
      if (vnoise2(x2 / 14, y2 / 14, 100) > 0.7 && hash2(px, py, 101) > 0.4) return GRASS[1];
      return FLAG[Math.max(0, Math.min(4, i))];
    }
    return null;
  }
  function groundColor(x2, y2, px, py) {
    const bc = blockedColor(x2, y2, px, py);
    if (bc) return bc;
    const fl = flagstone(x2, y2, px, py);
    if (fl !== null) return fl;
    const big = vnoise2(x2 / 260, y2 / 260, 11);
    const patch = vnoise2(x2 / 90, y2 / 90, 3) * 0.6 + vnoise2(x2 / 34, y2 / 34, 4) * 0.4;
    const fine = hash2(px, py, 9);
    const dirt = patch + big * 0.35 - 0.62;
    if (dirt > 0.02) {
      if (dirt > 0.22 && vnoise2(x2 / 20, y2 / 20, 5) > 0.72) return MUD;
      const i2 = Math.min(DIRT2.length - 1, Math.max(0, Math.floor(1.5 + vnoise2(x2 / 16, y2 / 16, 6) * 3 + (fine - 0.5) * 1.6)));
      if (dirt < 0.06 && fine > 0.5) return GRASS[2];
      return DIRT2[i2];
    }
    const tx = Math.floor(x2 / 64);
    const ty = Math.floor(y2 / 64);
    const tile = hash2(tx, ty, 2);
    let v0 = 1.9 + big * 1.6 + (tile - 0.5) * 0.9 + (fine - 0.5) * 1.5 + vnoise2(x2 / 22, y2 / 22, 8) * 0.9;
    const gx = x2 - tx * 64;
    const gy = y2 - ty * 64;
    if (gx < 1.6 || gy < 1.6) v0 -= 0.9;
    else if (gx < 3.5 || gy < 3.5) v0 += 0.25;
    const i = Math.min(GRASS.length - 1, Math.max(0, Math.floor(v0)));
    return GRASS[i];
  }
  var STONE = ["#1a1a20", "#2a2a32", "#3a3a44", "#4b4b57", "#5d5d6a"].map((c) => rgba(c));
  var MORTAR = rgba("#121216");
  var ROCKF = ["#0f0e10", "#18161a", "#221f22", "#2c282a", "#373133"].map((c) => rgba(c));
  var STAMPS2 = {
    tuft: { rows: [".a.a.", "a.ab.", ".bbb."], pal: { a: "#4a4a32", b: "#33352a" } },
    tuft2: { rows: ["a..a", ".ab.", ".bb."], pal: { a: "#565236", b: "#3a3a2a" } },
    flowerV: { rows: [".p.", "pyp", ".g."], pal: { p: "#4e4658", y: "#7d7450", g: "#2c3121" } },
    flowerR: { rows: ["r.", "g."], pal: { r: "#5e2222", g: "#2c3121" } },
    flowerY: { rows: [".y.", "y.y", ".g."], pal: { y: "#6c6640", g: "#2c3121" } },
    stone: { rows: [".hl.", "lmmd", ".dd."], pal: { h: "#8a8a92", l: "#6a6a72", m: "#4e4e56", d: "#2c2c32" } },
    stone2: { rows: [".hl", "lmd"], pal: { h: "#7d7b80", l: "#5f5d63", m: "#48464c", d: "#29282c" } },
    bone: { rows: ["b.....", ".bbbb.", ".....b"], pal: { b: "#bdb49a" } },
    skull: { rows: [".www.", "wkwkw", ".www.", "..w.."], pal: { w: "#c9c0a4", k: "#1a1612" } },
    ribs: { rows: [".b.b.b", "bbbbbb", ".b.b.b"], pal: { b: "#aaa188" } },
    mushroom: { rows: ["rrr", ".s."], pal: { r: "#6e3a52", s: "#b8ad92" } }
  };
  function stamp2(buf, st, x2, y2) {
    for (let j = 0; j < st.rows.length; j++) {
      const row = st.rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === ".") continue;
        buf.set(x2 + i, y2 + j, rgba(st.pal[ch]));
      }
    }
  }
  var DECOR_CELL = 30;
  function decorAt(gx, gy) {
    const x2 = (gx + hash2(gx, gy, 4243)) * DECOR_CELL;
    const y2 = (gy + hash2(gx, gy, 4244)) * DECOR_CELL;
    const r = hash2(gx, gy, 4245);
    const q = hash2(gx, gy, 4246);
    let st;
    if (r < 0.42) st = q < 0.5 ? STAMPS2.tuft : STAMPS2.tuft2;
    else if (r < 0.6) st = [STAMPS2.flowerV, STAMPS2.flowerR, STAMPS2.flowerY][Math.min(2, Math.floor(q * 3))];
    else if (r < 0.8) st = q < 0.5 ? STAMPS2.stone : STAMPS2.stone2;
    else if (r < 0.92) st = STAMPS2.bone;
    else if (r < 0.96) st = STAMPS2.mushroom;
    else st = q < 0.6 ? STAMPS2.skull : STAMPS2.ribs;
    return { st, x: x2, y: y2 };
  }
  function paintDecor(g, ix0, iy0) {
    const D = GROUND_D;
    const a = unproject(ix0, iy0 + CHUNK);
    const b = unproject(ix0 + CHUNK, iy0);
    const c0 = unproject(ix0, iy0);
    const c1 = unproject(ix0 + CHUNK, iy0 + CHUNK);
    const gx0 = Math.max(0, Math.floor(Math.min(a.x, c0.x) / DECOR_CELL) - 1);
    const gx1 = Math.min(Math.floor(mapW / DECOR_CELL), Math.floor(Math.max(b.x, c1.x) / DECOR_CELL) + 1);
    const gy0 = Math.max(0, Math.floor(Math.min(b.y, c0.y) / DECOR_CELL) - 1);
    const gy1 = Math.min(Math.floor(mapH / DECOR_CELL), Math.floor(Math.max(a.y, c1.y) / DECOR_CELL) + 1);
    g.lineCap = "round";
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const { st, x: x2, y: y2 } = decorAt(gx, gy);
        if (x2 >= mapW || y2 >= mapH || cellKindAt(x2, y2) !== OPEN) continue;
        const px = (isoX(x2, y2) - ix0) * D;
        const py = (isoY(x2, y2) - iy0) * D;
        if (px < -20 || py < -20 || px > CHUNK * D + 20 || py > CHUNK * D + 20) continue;
        const q = hash2(gx, gy, 4247);
        const s = D * (0.9 + q * 0.4);
        if (st === STAMPS2.tuft || st === STAMPS2.tuft2) {
          const col3 = st.pal.a;
          for (let k = 0; k < 5; k++) {
            const ang = -Math.PI / 2 + (k - 2) * 0.35 + (hash2(gx, gy, 4250 + k) - 0.5) * 0.3;
            const L2 = (2.6 + hash2(gx, gy, 4260 + k) * 2.4) * s;
            g.strokeStyle = k % 2 ? st.pal.b : col3;
            g.lineWidth = 0.7 * s;
            g.beginPath();
            g.moveTo(px + (k - 2) * 0.6 * s, py);
            g.quadraticCurveTo(px + (k - 2) * 0.9 * s, py - L2 * 0.6, px + Math.cos(ang) * L2, py + Math.sin(ang) * L2);
            g.stroke();
          }
        } else if (st === STAMPS2.stone || st === STAMPS2.stone2) {
          const rx = (st === STAMPS2.stone ? 2.4 : 1.8) * s;
          const gr = g.createRadialGradient(px - rx * 0.4, py - rx * 0.5, 0, px, py, rx * 1.2);
          gr.addColorStop(0, st.pal.h);
          gr.addColorStop(0.5, st.pal.m);
          gr.addColorStop(1, st.pal.d);
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.beginPath();
          g.ellipse(px + rx * 0.2, py + rx * 0.35, rx * 1.1, rx * 0.55, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = gr;
          g.beginPath();
          g.ellipse(px, py, rx, rx * 0.7, q * 2, 0, Math.PI * 2);
          g.fill();
        } else if (st === STAMPS2.bone || st === STAMPS2.ribs) {
          g.strokeStyle = st.pal.b;
          g.lineWidth = 0.8 * s;
          const ang = q * Math.PI;
          g.beginPath();
          g.moveTo(px - Math.cos(ang) * 3 * s, py - Math.sin(ang) * 1.6 * s);
          g.lineTo(px + Math.cos(ang) * 3 * s, py + Math.sin(ang) * 1.6 * s);
          g.stroke();
          if (st === STAMPS2.ribs)
            for (let k = -1; k <= 1; k++) {
              g.beginPath();
              g.arc(px + k * 1.6 * s, py, 1.4 * s, Math.PI * 1.1, Math.PI * 1.9);
              g.stroke();
            }
        } else if (st === STAMPS2.skull) {
          g.fillStyle = st.pal.w;
          g.beginPath();
          g.ellipse(px, py, 2 * s, 1.6 * s, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = st.pal.k;
          g.beginPath();
          g.arc(px - 0.7 * s, py - 0.2 * s, 0.45 * s, 0, Math.PI * 2);
          g.arc(px + 0.7 * s, py - 0.2 * s, 0.45 * s, 0, Math.PI * 2);
          g.fill();
        } else {
          const head = Object.values(st.pal)[0];
          g.strokeStyle = "#2c3121";
          g.lineWidth = 0.5 * s;
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px, py - 2.5 * s);
          g.stroke();
          g.fillStyle = head;
          g.beginPath();
          g.arc(px, py - 2.8 * s, 1.1 * s, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
  function buildCampPatch(seed2) {
    const R0 = 150;
    const rx = Math.ceil(R0 * K);
    const W3 = rx * 2 + 4;
    const H3 = Math.ceil(R0 * K * SQ) * 2 + 4;
    const buf = new PixBuf(W3, H3);
    const ax = W3 / 2;
    const ay = H3 / 2;
    const dead = ["#272319", "#2f2a1e", "#373123", "#403828"].map((c) => rgba(c));
    for (let py = 0; py < H3; py++) {
      for (let px = 0; px < W3; px++) {
        const { x: x2, y: y2 } = unproject(px + 0.5 - ax, py + 0.5 - ay);
        const d = Math.hypot(x2, y2) / R0;
        const edge2 = 0.75 + vnoise2(x2 / 30 + seed2, y2 / 30, 70) * 0.4;
        if (d > edge2) continue;
        if (d > edge2 - 0.12 && hash2(px, py, 71) > 0.5) continue;
        const i = Math.max(0, Math.min(3, Math.floor(1 + vnoise2(x2 / 12, y2 / 12, 72 + seed2) * 2.4 + (hash2(px, py, 73) - 0.5))));
        buf.set(px, py, dead[i]);
      }
    }
    const rnd4 = mulberry322(seed2 * 977 + 13);
    for (let i = 0; i < 14; i++) {
      const a = rnd4() * Math.PI * 2;
      const rr3 = rnd4() * R0 * 0.65;
      const px = Math.round(ax + isoX(Math.cos(a) * rr3, Math.sin(a) * rr3));
      const py = Math.round(ay + isoY(Math.cos(a) * rr3, Math.sin(a) * rr3));
      const st = [STAMPS2.bone, STAMPS2.ribs, STAMPS2.skull, STAMPS2.bone, STAMPS2.stone2][Math.floor(rnd4() * 5)];
      stamp2(buf, st, px, py);
    }
    return sprite(buf, Math.floor(ax), Math.floor(ay));
  }
  var T = {
    wood: ramp("#1d130b", "#352315", "#523621", "#6e4a2e"),
    bone: ramp("#5e5648", "#9b9078", "#cfc4a6", "#efe7cf"),
    rag: ramp("#2a0e0e", "#4a1616", "#6e2020", "#8c2e2a"),
    rope: ramp("#2a2216", "#43382a", "#5e503c", "#7a6a52")
  };
  function buildTotem(seed2) {
    const P3 = [];
    const cap3 = (a, b, r, rp) => ({ kind: "cap", a, b, r, ramp: rp });
    const lean = (hash2(seed2, 3, 80) - 0.5) * 2;
    P3.push(cap3(v(0, 0, 0), v(lean, 0, 30), 1.6, T.wood));
    P3.push(cap3(v(lean * 0.8, -6, 24), v(lean * 0.8, 6, 25), 1.1, T.wood));
    P3.push(cap3(v(lean * 0.8 + 0.6, -6, 24), v(lean * 0.8 + 0.4, -7, 15), 1.2, T.rag));
    P3.push(cap3(v(lean * 0.8 + 0.6, 6, 25), v(lean * 0.8 + 0.8, 6.5, 18), 1.1, T.rag));
    P3.push(cap3(v(lean, 0, 21), v(lean, 0, 23), 1.9, T.rope));
    const hd = v(lean + 0.6, 0, 32);
    P3.push({ kind: "sph", a: hd, r: 3.5, ramp: T.bone });
    P3.push({ kind: "cap", a: v(lean + 2, -1.6, 30), b: v(lean + 2, 1.6, 30), r: 1.4, ramp: T.bone });
    for (const s of [-1.3, 1.3]) P3.push({ kind: "dot", a: v(lean + 3.6, s, 32.3), ref: v(lean + 1.6, s, 32.3), r: 2, ramp: T.bone, color: rgba("#120d0a"), depthBias: 1 });
    P3.push(cap3(v(lean, -2.6, 34), v(lean - 2, -5.5, 38.5), 0.9, T.bone));
    P3.push(cap3(v(lean, 2.6, 34), v(lean - 2, 5.5, 38.5), 0.9, T.bone));
    P3.push({ kind: "sph", a: v(2.5, 2, 1), r: 2.2, ramp: ramp("#202025", "#33333a", "#4a4a52", "#64646d") });
    P3.push({ kind: "sph", a: v(-2, -2.5, 1), r: 1.8, ramp: ramp("#202025", "#33333a", "#4a4a52", "#64646d") });
    const W3 = Math.ceil(40 * ART);
    const H3 = Math.ceil(56 * ART);
    const buf = new PixBuf(W3, H3);
    const ax = Math.floor(W3 / 2);
    const ay = H3 - Math.ceil(8 * ART);
    rasterize(P3, projector(0.8 + seed2, ART, ax, ay), ART, buf);
    return sprite(buf, ax, ay);
  }
  var shadowCache = /* @__PURE__ */ new Map();
  function shadowSprite(rpx) {
    const r = Math.max(3, Math.round(rpx));
    let s = shadowCache.get(r);
    if (s) return s;
    const d = 4;
    const W3 = Math.ceil((r * 2 + 6) * d);
    const H3 = Math.ceil((r * 1.3 + 6) * d);
    const cv = document.createElement("canvas");
    cv.width = W3;
    cv.height = H3;
    const g = cv.getContext("2d");
    g.setTransform(1, 0, 0, 0.6, 0, 0);
    const cx = W3 / 2;
    const cy = H3 / 2 / 0.6;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, (r + 2) * d);
    gr.addColorStop(0, "rgba(0,0,0,0.55)");
    gr.addColorStop(0.45, "rgba(0,0,0,0.42)");
    gr.addColorStop(0.8, "rgba(0,0,0,0.14)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W3, H3 / 0.6);
    s = { cv, ax: W3 / 2, ay: H3 / 2, d };
    shadowCache.set(r, s);
    return s;
  }

  // src/client/gfx/hud.ts
  var cache6 = /* @__PURE__ */ new Map();
  var memo = (key, fn) => {
    let c = cache6.get(key);
    if (!c) {
      c = fn();
      cache6.set(key, c);
    }
    return c;
  };
  var STONE2 = ["#121115", "#18171c", "#1e1c22", "#25222a", "#2d2a33", "#36323d"].map((c) => rgba(c));
  var IRON2 = ["#09090b", "#16161a", "#24242a", "#36363e", "#4c4c56", "#6a6a76"].map((c) => rgba(c));
  function panelSprite(w, h) {
    return memo(`panel|${w}|${h}`, () => {
      const SP = 4;
      const buf = new PixBuf(w, h + SP);
      for (let y2 = 0; y2 < h; y2++) {
        for (let x2 = 0; x2 < w; x2++) {
          const row = y2 < h / 2 ? 0 : 1;
          const bx = Math.floor((x2 + row * 13) / 26);
          const lx = (x2 + row * 13) % 26;
          const ly = y2 - row * Math.floor(h / 2);
          let i = 2 + Math.floor(vnoise2(x2 / 5, y2 / 3, 3) * 2.2 + (hash2(x2, y2, 4) - 0.5) * 1.2) + (hash2(bx, row, 5) > 0.6 ? 1 : 0);
          if (lx === 0 || ly === 0) i = 0;
          else if (lx === 1 || ly === 1) i += 1;
          else if (lx === 25 || ly === Math.floor(h / 2) - 1) i -= 1;
          if (Math.abs(vnoise2(x2 / 7, y2 / 7, 6) - 0.5) < 0.02) i -= 2;
          buf.set(x2, y2 + SP, STONE2[Math.max(0, Math.min(5, i))]);
        }
      }
      for (let x2 = 0; x2 < w; x2++) {
        buf.set(x2, SP, IRON2[0]);
        buf.set(x2, SP + 1, IRON2[4]);
        buf.set(x2, SP + 2, IRON2[3]);
        buf.set(x2, SP + 3, IRON2[2]);
        buf.set(x2, SP + 4, IRON2[0]);
        buf.set(x2, SP + h - 1, IRON2[0]);
      }
      for (let x2 = 8; x2 < w - 4; x2 += 20) {
        buf.set(x2, SP + 2, IRON2[5]);
        buf.set(x2 + 1, SP + 2, IRON2[4]);
        buf.set(x2 + 1, SP + 3, IRON2[0]);
      }
      for (let x2 = 18; x2 < w - 10; x2 += 40) {
        for (let k = 0; k < SP; k++) {
          const half = Math.floor((SP - k) / 2);
          for (let dx = -half; dx <= half; dx++) buf.set(x2 + dx, SP - 1 - k + 1, dx < 0 ? IRON2[4] : IRON2[2]);
        }
        buf.set(x2, 0, IRON2[5]);
      }
      for (let y2 = SP; y2 < h + SP; y2++) {
        buf.set(0, y2, IRON2[0]);
        buf.set(1, y2, IRON2[3]);
        buf.set(w - 1, y2, IRON2[0]);
        buf.set(w - 2, y2, IRON2[1]);
      }
      return buf.toCanvas();
    });
  }
  var PANEL_SPIKE = 4;
  function globeFrame(r) {
    return memo(`gframe|${r}`, () => {
      const W3 = r * 2 + 11;
      const H3 = r * 2 + 14;
      const cx = r + 5;
      const cy = r + 8;
      const buf = new PixBuf(W3, H3);
      for (let y2 = 0; y2 < H3; y2++) {
        for (let x2 = 0; x2 < W3; x2++) {
          const dx = x2 + 0.5 - cx - 0.5;
          const dy = y2 + 0.5 - cy - 0.5;
          const d = Math.hypot(dx, dy);
          if (d >= r + 0.5 && d < r + 4.5) {
            const t4 = d - r - 0.5;
            const lit = (-dx - dy) / (d || 1);
            let i = t4 < 1 || t4 > 3.2 ? 0 : 2 + Math.round(lit * 1.6);
            if (hash2(x2, y2, 11) > 0.85) i -= 1;
            buf.set(x2, y2, IRON2[Math.max(0, Math.min(5, i))]);
          }
        }
      }
      for (const a of [0.785, 2.356, 3.927, 5.498]) {
        const x2 = Math.round(cx + Math.cos(a) * (r + 2.5));
        const y2 = Math.round(cy + Math.sin(a) * (r + 2.5));
        buf.set(x2, y2, IRON2[5]);
        buf.set(x2 + 1, y2 + 1, IRON2[0]);
      }
      for (const [ox, hgt] of [[-4, 4], [0, 7], [4, 4]]) {
        for (let k = 0; k < hgt; k++) {
          buf.set(cx + ox, cy - r - 4 - k, k === hgt - 1 ? IRON2[5] : IRON2[3]);
          if (k < hgt - 2) buf.set(cx + ox + 1, cy - r - 4 - k, IRON2[1]);
        }
      }
      const glint = rgba("#ffffff", 150);
      const glint2 = rgba("#ffffff", 70);
      for (let a = 3.6; a < 4.5; a += 0.08) {
        buf.set(Math.round(cx + Math.cos(a) * (r - 3)), Math.round(cy + Math.sin(a) * (r - 3)), glint);
        buf.set(Math.round(cx + Math.cos(a) * (r - 4)), Math.round(cy + Math.sin(a) * (r - 4)), glint2);
      }
      buf.set(cx - Math.round(r * 0.25), cy - Math.round(r * 0.55), glint);
      return buf.toCanvas();
    });
  }
  function globeLiquid(r, base, dim = 1) {
    return memo(`gliq|${r}|${base}|${dim}`, () => {
      const S3 = r * 2 + 1;
      const buf = new PixBuf(S3, S3);
      const c = scaleColor(rgba(base), dim);
      const ramp2 = [scaleColor(c, 0.25), scaleColor(c, 0.45), scaleColor(c, 0.7), c, mixColor(c, rgba("#ffffff"), 0.3)];
      for (let y2 = 0; y2 < S3; y2++) {
        for (let x2 = 0; x2 < S3; x2++) {
          const dx = (x2 - r) / r;
          const dy = (y2 - r) / r;
          const d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          const lit = -dx * 0.45 - dy * 0.5 + nz * 0.75;
          const swirl = vnoise2(x2 / 4, y2 / 3, 21) * 0.5;
          const q = lit * 3 + swirl + (x2 + y2 & 1) * 0.35;
          buf.set(x2, y2, ramp2[Math.max(0, Math.min(4, Math.floor(q)))]);
        }
      }
      return buf.toCanvas();
    });
  }
  function globeBack(r) {
    return memo(`gback|${r}`, () => {
      const S3 = r * 2 + 1;
      const buf = new PixBuf(S3, S3);
      for (let y2 = 0; y2 < S3; y2++)
        for (let x2 = 0; x2 < S3; x2++) {
          const d = Math.hypot(x2 - r, y2 - r) / r;
          if (d <= 1) buf.set(x2, y2, rgba(d > 0.8 ? "#050405" : (x2 + y2) % 2 ? "#0b090c" : "#0e0b0f"));
        }
      return buf.toCanvas();
    });
  }

  // src/shared/ailments.ts
  var AIL_KINDS = ["stun", "freeze", "chill", "shock", "ignite", "bleed", "poison", "electrocute"];
  var AIL_SHORT = {
    stun: "s",
    freeze: "f",
    shock: "k",
    ignite: "g",
    bleed: "b",
    poison: "p",
    electrocute: "e"
  };
  var hasAil = (s, k) => !!s?.a && (s.a & 1 << AIL_KINDS.indexOf(k)) !== 0;
  var isPrimedSnap = (s, k) => !!s?.p && (s.p & 1 << AIL_KINDS.indexOf(k)) !== 0;
  var meterOf = (s, k) => (s?.m?.[AIL_SHORT[k]] ?? 0) / 100;
  var AIL_INFO = {
    stun: { name: "Staggered", color: "#f2e6b8" },
    freeze: { name: "Frozen", color: "#9fe3ff" },
    chill: { name: "Chilled", color: "#6fb7e8" },
    shock: { name: "Shocked", color: "#ffe14d" },
    ignite: { name: "Burning", color: "#ff7a2a" },
    bleed: { name: "Bleeding", color: "#d0323a" },
    poison: { name: "Poisoned", color: "#7bd34a" },
    electrocute: { name: "Jolted", color: "#b49bff" }
  };

  // src/shared/defence.ts
  var DAMAGE_COLORS = {
    phys: "#e8e2d6",
    fire: "#ff8a3d",
    cold: "#8fd8ff",
    light: "#ffe75a",
    chaos: "#c77dff"
  };

  // src/client/defencefx.ts
  var DEF_TEXT = {
    evade: { text: "EVADE", color: "#cfe8ff", big: false },
    block: { text: "BLOCK", color: "#e8d9a8", big: false },
    deflect: { text: "DEFLECT", color: "#b9d6c4", big: false },
    immune: { text: "IMMUNE", color: "#d8d0ff", big: false }
  };
  var AIL_SFX = {
    freeze: "ailment.freeze",
    chill: "ailment.chill",
    ignite: "ailment.ignite",
    shock: "ailment.shock",
    bleed: "ailment.bleed",
    poison: "ailment.poison",
    electrocute: "ailment.shock",
    stun: "hit.block"
  };
  function defenceEvent(e) {
    if (e.k === "def") {
      sfx.play(e.o === "block" ? "hit.block" : e.o === "immune" ? "hit.armour" : "hit.evade", { x: e.x, y: e.y });
      return DEF_TEXT[e.o] ?? null;
    }
    if (e.k === "ail") {
      const id = AIL_SFX[e.a];
      if (id) sfx.play(id, { x: e.x, y: e.y });
      const info = AIL_INFO[e.a];
      if (e.a === "chill") return null;
      return { text: info.name.toUpperCase(), color: info.color, big: e.a === "freeze" || e.a === "stun" || e.a === "electrocute" };
    }
    return null;
  }
  function hitFloat(e, baseColor) {
    const n2 = Math.round(e.dmg);
    let text = `${n2}`;
    let color = baseColor;
    if (e.ty && e.ty !== "phys") color = DAMAGE_COLORS[e.ty];
    if (e.es && e.es >= e.dmg * 0.5) color = "#7fb8ff";
    if (e.dot) return { text, color, big: false };
    if (e.o === "deflect") text = `${n2} DEFLECT`;
    if (e.rs && e.rs >= 1) text += ` (${Math.round(e.rs)} resisted)`;
    return { text, color, big: e.dmg >= 30 };
  }
  var METER_SHOW = ["stun", "freeze", "shock", "ignite", "electrocute", "bleed", "poison"];
  function rr2(g, x2, y2, w, h, r) {
    g.beginPath();
    g.moveTo(x2 + r, y2);
    g.arcTo(x2 + w, y2, x2 + w, y2 + h, r);
    g.arcTo(x2 + w, y2 + h, x2, y2 + h, r);
    g.arcTo(x2, y2 + h, x2, y2, r);
    g.arcTo(x2, y2, x2 + w, y2, r);
    g.closePath();
  }
  function glyph(g, k, x2, y2, r, t4) {
    const c = AIL_INFO[k].color;
    g.save();
    g.translate(x2, y2);
    const grd = g.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r);
    grd.addColorStop(0, "rgba(40,34,44,0.95)");
    grd.addColorStop(1, "rgba(10,8,12,0.95)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = Math.max(1, r * 0.16);
    g.strokeStyle = c;
    g.stroke();
    g.fillStyle = c;
    g.strokeStyle = c;
    g.lineCap = "round";
    g.lineJoin = "round";
    const s = r * 0.6;
    g.lineWidth = Math.max(1, r * 0.18);
    switch (k) {
      case "stun":
        for (let i = 0; i < 3; i++) {
          const a = t4 * 4 + i * Math.PI * 2 / 3;
          g.beginPath();
          g.arc(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.35, r * 0.17, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case "freeze":
      case "chill":
        for (let i = 0; i < (k === "freeze" ? 3 : 2); i++) {
          const a = i * Math.PI / (k === "freeze" ? 3 : 2);
          g.beginPath();
          g.moveTo(Math.cos(a) * s, Math.sin(a) * s);
          g.lineTo(-Math.cos(a) * s, -Math.sin(a) * s);
          g.stroke();
        }
        break;
      case "shock":
      case "electrocute":
        g.beginPath();
        g.moveTo(s * 0.25, -s);
        g.lineTo(-s * 0.35, s * 0.1);
        g.lineTo(s * 0.1, s * 0.1);
        g.lineTo(-s * 0.25, s);
        g.lineTo(s * 0.4, -s * 0.15);
        g.lineTo(-s * 0.05, -s * 0.15);
        g.closePath();
        g.fill();
        break;
      case "ignite": {
        const f = 1 + Math.sin(t4 * 14) * 0.08;
        g.beginPath();
        g.moveTo(0, -s * f);
        g.quadraticCurveTo(s * 0.8, 0, s * 0.45, s * 0.6);
        g.quadraticCurveTo(0, s * 0.95, -s * 0.45, s * 0.6);
        g.quadraticCurveTo(-s * 0.8, 0, 0, -s * f);
        g.fill();
        break;
      }
      case "bleed":
      // drop
      case "poison":
        g.beginPath();
        g.moveTo(0, -s);
        g.quadraticCurveTo(s * 0.75, s * 0.2, 0, s * 0.8);
        g.quadraticCurveTo(-s * 0.75, s * 0.2, 0, -s);
        g.fill();
        break;
    }
    g.restore();
  }
  function drawStatus(g, st, x2, y2, u, t4) {
    if (!st) return;
    g.save();
    const active = AIL_KINDS.filter((k) => hasAil(st, k));
    const r = 4.2 * u;
    let iy = y2 - r - 1.5 * u;
    if (active.length) {
      const gap = r * 2.3;
      let ix = x2 - (active.length - 1) * gap / 2;
      for (const k of active) {
        glyph(g, k, ix, iy, r, t4);
        ix += gap;
      }
      iy -= r * 2 + 1.5 * u;
    }
    const meters = METER_SHOW.map((k) => ({ k, v: meterOf(st, k) })).filter((m) => m.v > 0.02 && !hasAil(st, m.k));
    const bw = 22 * u;
    const bh = 2.2 * u;
    let my = active.length ? iy + r - bh : y2 - bh - 2 * u;
    for (const m of meters.slice(0, 3)) {
      const c = AIL_INFO[m.k].color;
      const bx = x2 - bw / 2;
      g.fillStyle = "rgba(8,6,10,0.8)";
      rr2(g, bx - u * 0.6, my - u * 0.6, bw + u * 1.2, bh + u * 1.2, bh);
      g.fill();
      g.fillStyle = c;
      rr2(g, bx, my, Math.max(bh, bw * Math.min(1, m.v)), bh, bh / 2);
      g.fill();
      const primed = isPrimedSnap(st, m.k);
      if (primed) {
        const a = 0.55 + 0.45 * Math.sin(t4 * 10);
        g.globalAlpha = a;
        g.shadowColor = c;
        g.shadowBlur = 6 * u;
        g.beginPath();
        g.arc(bx + bw + 2.5 * u, my + bh / 2, 1.9 * u, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      }
      my -= bh + 2 * u;
    }
    if (st.i) {
      g.strokeStyle = "rgba(220,215,255,0.75)";
      g.lineWidth = 1.1 * u;
      g.setLineDash([2.5 * u, 2 * u]);
      g.lineDashOffset = -t4 * 12 * u;
      g.beginPath();
      g.ellipse(x2, my - 1 * u, 7 * u, 2.2 * u, 0, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }
  function drawEsGlobe(g, cx, cy, R8, es, esm, t4) {
    if (!esm || esm <= 0) return;
    const f = Math.max(0, Math.min(1, (es ?? 0) / esm));
    g.save();
    g.lineCap = "round";
    g.lineWidth = 3;
    g.strokeStyle = "rgba(20,30,60,0.75)";
    g.beginPath();
    g.arc(cx, cy, R8 + 2.5, Math.PI * 0.5, Math.PI * 2.5);
    g.stroke();
    if (f > 0) {
      const half = Math.PI * f;
      const grd = g.createLinearGradient(cx, cy - R8, cx, cy + R8);
      grd.addColorStop(0, "#bfe4ff");
      grd.addColorStop(1, "#4d8dff");
      g.strokeStyle = grd;
      g.shadowColor = "#6fb0ff";
      g.shadowBlur = 5;
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(cx, cy, R8 + 2.5, Math.PI * 0.5 - half, Math.PI * 0.5 + half);
      g.stroke();
      g.shadowBlur = 0;
      const sheen = g.createRadialGradient(cx, cy, R8 * 0.55, cx, cy, R8);
      sheen.addColorStop(0, "rgba(120,180,255,0)");
      sheen.addColorStop(1, `rgba(140,200,255,${0.18 + 0.32 * f + 0.05 * Math.sin(t4 * 3)})`);
      g.fillStyle = sheen;
      g.beginPath();
      g.arc(cx, cy, R8, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  var tintCv = null;
  function ailTint(st, t4) {
    if (!st || !st.a) return null;
    if (hasAil(st, "freeze")) return { color: "#a8e6ff", a: 0.55 };
    if (hasAil(st, "electrocute")) return { color: "#c4b0ff", a: 0.35 + 0.25 * Math.abs(Math.sin(t4 * 22)) };
    if (hasAil(st, "shock")) return { color: "#fff07a", a: 0.15 + 0.25 * Math.max(0, Math.sin(t4 * 17)) };
    if (hasAil(st, "ignite")) return { color: "#ff7a2a", a: 0.28 + 0.1 * Math.sin(t4 * 11) };
    if (hasAil(st, "poison")) return { color: "#7bd34a", a: 0.25 };
    if (hasAil(st, "chill")) return { color: "#6fb7e8", a: 0.25 };
    if (hasAil(st, "bleed")) return { color: "#d0323a", a: 0.15 };
    return null;
  }
  function drawTint(g, s, x2, y2, color, a) {
    const w = s.cv.width;
    const h = s.cv.height;
    if (!tintCv) tintCv = document.createElement("canvas");
    if (tintCv.width < w || tintCv.height < h) {
      tintCv.width = Math.max(tintCv.width, w);
      tintCv.height = Math.max(tintCv.height, h);
    }
    const c = tintCv.getContext("2d");
    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";
    c.drawImage(s.cv, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";
    const d = s.d ?? 1;
    g.save();
    g.globalAlpha = a;
    g.drawImage(tintCv, 0, 0, w, h, x2 - s.ax / d, y2 - s.ay / d, w / d, h / d);
    g.restore();
  }
  var fract = (v2) => v2 - Math.floor(v2);
  var rnd3 = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
  function drawAilFx(g, st, s, x2, y2, t4, seed2) {
    if (!st || !st.a) return;
    const d = s.d ?? 1;
    const H3 = Math.max(10, s.ay / d * 0.42);
    const W3 = Math.max(5, s.cv.width / d * 0.075);
    const top = y2 - H3;
    g.save();
    if (hasAil(st, "poison")) {
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 5; i++) {
        const ph = t4 * 0.6 + i * 1.7 + seed2;
        const px = x2 + Math.sin(ph) * W3 * 1.3;
        const py = y2 - H3 * (0.15 + 0.5 * fract(ph * 0.25 + rnd3(i, seed2)));
        const r = W3 * (0.9 + 0.4 * Math.sin(ph * 1.3));
        const gr = g.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, "rgba(120,220,70,0.32)");
        gr.addColorStop(1, "rgba(60,140,30,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(px, py, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (hasAil(st, "bleed")) {
      for (let i = 0; i < 4; i++) {
        const ph = fract(t4 * 0.9 + rnd3(i, seed2));
        const px = x2 + (rnd3(i + 9, seed2) - 0.5) * W3 * 1.4;
        const py = top + H3 * 0.35 + ph * H3 * 0.65;
        const a = 1 - ph * 0.7;
        g.fillStyle = `rgba(170,20,28,${a})`;
        g.beginPath();
        g.moveTo(px, py - 2.6);
        g.quadraticCurveTo(px + 1.3, py + 0.2, px, py + 1.2);
        g.quadraticCurveTo(px - 1.3, py + 0.2, px, py - 2.6);
        g.fill();
      }
    }
    if (hasAil(st, "chill") && !hasAil(st, "freeze")) {
      g.fillStyle = "rgba(220,240,255,0.85)";
      for (let i = 0; i < 6; i++) {
        const ph = fract(t4 * 0.35 + rnd3(i, seed2 + 3));
        const px = x2 + Math.sin(t4 * 1.5 + i * 2.1) * W3 * 1.1;
        const py = top + H3 * (1 - ph);
        g.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
        g.beginPath();
        g.arc(px, py, 0.8 + rnd3(i, 7) * 0.7, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (hasAil(st, "freeze")) {
      const n2 = 9;
      for (let i = 0; i < n2; i++) {
        const u = i / (n2 - 1) * 2 - 1;
        const bx = x2 + u * W3 * 1.05;
        const h = H3 * (0.35 + 0.45 * rnd3(i, seed2) * (1 - Math.abs(u) * 0.5));
        const lean = (rnd3(i + 4, seed2) - 0.5) * W3 * 0.5 + u * W3 * 0.25;
        const wd = W3 * (0.28 + 0.18 * rnd3(i + 2, seed2));
        const gr = g.createLinearGradient(bx, y2, bx + lean, y2 - h);
        gr.addColorStop(0, "rgba(150,210,255,0.75)");
        gr.addColorStop(1, "rgba(230,248,255,0.45)");
        g.fillStyle = gr;
        g.strokeStyle = "rgba(240,252,255,0.8)";
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(bx - wd, y2 + 1);
        g.lineTo(bx + lean - wd * 0.25, y2 - h * 0.8);
        g.lineTo(bx + lean, y2 - h);
        g.lineTo(bx + wd, y2 + 1);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const ph = fract(t4 * 0.7 + i / 3);
        const px = x2 + (rnd3(i, Math.floor(t4 * 0.7 + i / 3)) - 0.5) * W3 * 2;
        const py = top + H3 * (0.2 + 0.7 * rnd3(i + 5, Math.floor(t4 * 0.7 + i / 3)));
        const a = Math.sin(ph * Math.PI);
        g.strokeStyle = `rgba(255,255,255,${a})`;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(px - 2.2 * a, py);
        g.lineTo(px + 2.2 * a, py);
        g.moveTo(px, py - 2.2 * a);
        g.lineTo(px, py + 2.2 * a);
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";
    }
    if (hasAil(st, "ignite")) {
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i++) {
        const ph = fract(t4 * 1.6 + rnd3(i, seed2));
        const bx = x2 + (rnd3(i + 1, seed2) - 0.5) * W3 * 1.8;
        const by = y2 - H3 * (0.05 + 0.6 * rnd3(i + 3, seed2)) - ph * H3 * 0.25;
        const fh = H3 * (0.28 + 0.2 * rnd3(i + 6, seed2)) * Math.sin(ph * Math.PI);
        const fw = W3 * (0.35 + 0.15 * rnd3(i, 2));
        const sway = Math.sin(t4 * 9 + i) * fw * 0.6;
        const gr2 = g.createLinearGradient(bx, by, bx, by - fh);
        gr2.addColorStop(0, "rgba(255,120,30,0.75)");
        gr2.addColorStop(0.55, "rgba(255,190,70,0.55)");
        gr2.addColorStop(1, "rgba(255,240,180,0)");
        g.fillStyle = gr2;
        g.beginPath();
        g.moveTo(bx - fw, by);
        g.quadraticCurveTo(bx - fw * 0.6 + sway * 0.5, by - fh * 0.6, bx + sway, by - fh);
        g.quadraticCurveTo(bx + fw * 0.6 + sway * 0.5, by - fh * 0.6, bx + fw, by);
        g.quadraticCurveTo(bx, by + fw * 0.6, bx - fw, by);
        g.fill();
      }
      const gr = g.createRadialGradient(x2, y2 - H3 * 0.4, 0, x2, y2 - H3 * 0.4, W3 * 2.2);
      gr.addColorStop(0, `rgba(255,120,40,${0.22 + 0.08 * Math.sin(t4 * 13)})`);
      gr.addColorStop(1, "rgba(255,80,20,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x2, y2 - H3 * 0.4, W3 * 2.2, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = "source-over";
    }
    const shock = hasAil(st, "shock");
    const elec = hasAil(st, "electrocute");
    if (shock || elec) {
      const frame2 = Math.floor(t4 * 14);
      const n2 = elec ? 4 : 2;
      g.globalCompositeOperation = "lighter";
      g.lineJoin = "round";
      for (let i = 0; i < n2; i++) {
        if (!elec && rnd3(i, frame2 + seed2) < 0.35) continue;
        const a0 = rnd3(i, frame2) * Math.PI * 2;
        const a1 = a0 + 1.2 + rnd3(i + 1, frame2) * 2;
        const pts = [];
        const segs = 6;
        for (let k = 0; k <= segs; k++) {
          const a = a0 + (a1 - a0) * k / segs;
          const jit = (rnd3(i * 10 + k, frame2) - 0.5) * W3 * 0.6;
          pts.push([x2 + Math.cos(a) * (W3 * 1.2 + jit), top + H3 * 0.5 + Math.sin(a) * (H3 * 0.45 + jit)]);
        }
        for (const [lw, col3] of [
          [3.2, elec ? "rgba(170,140,255,0.35)" : "rgba(255,230,90,0.35)"],
          [1, elec ? "rgba(235,225,255,0.95)" : "rgba(255,255,210,0.95)"]
        ]) {
          g.lineWidth = lw;
          g.strokeStyle = col3;
          g.beginPath();
          g.moveTo(pts[0][0], pts[0][1]);
          for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
          g.stroke();
        }
      }
      g.globalCompositeOperation = "source-over";
    }
    g.restore();
  }

  // src/client/render.ts
  var FEED_TIME = 6;
  var FLASH_TIME = 0.1;
  var TARGET_LOW_W = 720;
  var TARGET_HUD_W = 480;
  var ZP = ART * 0.87;
  var RARITY_BEAM = ["#c8c8c8", "#7f95ff", "#ffe066", "#ff9a3a"];
  var HP_GREEN = "#5cc04a";
  var AMBIENT = "#66616e";
  var WARM = [255, 206, 150];
  var TORCH = [255, 128, 40];
  var SHRINE_LIGHT = [80, 180, 255];
  var LOOT_LIGHT = [[150, 150, 150], [90, 120, 255], [255, 210, 80], [255, 140, 50]];
  var BRAZIERS = [
    [62, -38],
    [-46, 58]
  ];
  var splatCache = /* @__PURE__ */ new Map();
  function splatSprite(v2) {
    let s = splatCache.get(v2);
    if (s) return s;
    const big = v2 >= 6;
    const W3 = big ? 30 : 18;
    const H3 = big ? 16 : 10;
    const buf = new PixBuf(W3, H3);
    const rnd4 = mulberry322(v2 * 977 + 3);
    const cols = [rgba("#2a0707"), rgba("#3d0b0a"), rgba("#55110e")];
    const blobs = big ? 7 : 4;
    for (let b = 0; b < blobs; b++) {
      const cx = W3 / 2 + (rnd4() - 0.5) * W3 * 0.55;
      const cy = H3 / 2 + (rnd4() - 0.5) * H3 * 0.5;
      const r = (big ? 4 : 2) + rnd4() * (big ? 5 : 3);
      for (let y2 = 0; y2 < H3; y2++)
        for (let x2 = 0; x2 < W3; x2++) {
          const d = Math.hypot((x2 - cx) / r, (y2 - cy) * 2 / r);
          if (d < 1) buf.set(x2, y2, cols[d < 0.45 ? 0 : d < 0.8 ? 1 : 2]);
        }
    }
    for (let k = 0; k < (big ? 10 : 5); k++) buf.set(Math.floor(rnd4() * W3), Math.floor(rnd4() * H3), cols[2]);
    s = sprite(buf, Math.floor(W3 / 2), Math.floor(H3 / 2));
    splatCache.set(v2, s);
    return s;
  }
  var fogCv = null;
  var groundArt = /* @__PURE__ */ new Map();
  function fogSprite() {
    if (fogCv) return fogCv;
    const cv = document.createElement("canvas");
    cv.width = 192;
    cv.height = 64;
    const g = cv.getContext("2d");
    g.setTransform(1, 0, 0, 1 / 3, 0, 0);
    const gr = g.createRadialGradient(96, 96, 0, 96, 96, 96);
    gr.addColorStop(0, "rgba(176,172,188,1)");
    gr.addColorStop(0.5, "rgba(170,166,182,0.55)");
    gr.addColorStop(1, "rgba(160,156,170,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 192, 192);
    fogCv = cv;
    return fogCv;
  }
  function pixelScale(devW, devH) {
    const scale = Math.max(1, Math.round(devW / TARGET_LOW_W));
    const hudScale = Math.max(2, Math.round(devW * getSettings().interface.uiScale / TARGET_HUD_W));
    return { scale, lowW: Math.ceil(devW / scale), lowH: Math.ceil(devH / scale), hudScale, hudW: Math.ceil(devW / hudScale), hudH: Math.ceil(devH / hudScale) };
  }
  function pxFrame(g, x2, y2, w, h, fill = "#120e0c", hi = "#6b5739") {
    g.fillStyle = "#050405";
    g.fillRect(x2 + 1, y2, w - 2, h);
    g.fillRect(x2, y2 + 1, w, h - 2);
    g.fillStyle = hi;
    g.fillRect(x2 + 2, y2 + 1, w - 4, 1);
    g.fillRect(x2 + 1, y2 + 2, 1, h - 4);
    g.fillStyle = "#3a2e20";
    g.fillRect(x2 + 2, y2 + h - 2, w - 4, 1);
    g.fillRect(x2 + w - 2, y2 + 2, 1, h - 4);
    g.fillStyle = fill;
    g.fillRect(x2 + 2, y2 + 2, w - 4, h - 4);
  }
  var Renderer = class {
    constructor(canvas2) {
      this.canvas = canvas2;
      __publicField(this, "ctx");
      __publicField(this, "lo");
      __publicField(this, "g");
      __publicField(this, "worldG");
      __publicField(this, "hlo", document.createElement("canvas"));
      __publicField(this, "hg", this.hlo.getContext("2d"));
      __publicField(this, "hudScale", 4);
      __publicField(this, "hw", 320);
      __publicField(this, "hh", 180);
      __publicField(this, "ww", 320);
      // world buffer size (lw/lh are swapped to the HUD size during the HUD pass)
      __publicField(this, "wh", 180);
      /** World low-res px -> current target px (1 for the world pass, scale/hudScale for the HUD pass). */
      __publicField(this, "hr", 1);
      __publicField(this, "dpr", 1);
      /** World canvas px per screen unit (base * zoom) and the render-scale fraction of device px. */
      __publicField(this, "Z", 2);
      __publicField(this, "baseZ", 2);
      __publicField(this, "rs", 1);
      /** Camera zoom (mouse wheel), eased toward zoomTarget, clamped. */
      __publicField(this, "zoom", 1);
      __publicField(this, "zoomTarget", 1);
      __publicField(this, "camSX", NaN);
      __publicField(this, "camSY", NaN);
      __publicField(this, "scale", 2);
      __publicField(this, "lw", 320);
      __publicField(this, "lh", 180);
      __publicField(this, "offX", 0);
      __publicField(this, "offY", 0);
      __publicField(this, "time", 0);
      /** Props bucketed by 256-unit world cell (rebuilt if the obstacle / scatter lists change). */
      __publicField(this, "propGrid", null);
      __publicField(this, "light", new LightMap());
      __publicField(this, "decals", []);
      __publicField(this, "fog", Array.from({ length: 9 }, (_, i) => ({ x: hash2(i, 1, 7) * 900, y: hash2(i, 2, 7) * 600, sp: 3 + hash2(i, 3, 7) * 5 })));
      __publicField(this, "dust", Array.from({ length: 60 }, (_, i) => ({ x: hash2(i, 4, 7) * 700, y: hash2(i, 5, 7) * 500, ph: hash2(i, 6, 7) * 6 })));
      __publicField(this, "campArt", /* @__PURE__ */ new Map());
      __publicField(this, "floats", []);
      __publicField(this, "feed", []);
      __publicField(this, "flashes", /* @__PURE__ */ new Map());
      // "p:id" / "m:id" -> time left
      __publicField(this, "rings", []);
      __publicField(this, "parts", []);
      __publicField(this, "corpses", []);
      __publicField(this, "motion", /* @__PURE__ */ new Map());
      __publicField(this, "lastPlayers", /* @__PURE__ */ new Map());
      __publicField(this, "lastHaz", /* @__PURE__ */ new Map());
      __publicField(this, "swingSeen", /* @__PURE__ */ new Map());
      __publicField(this, "healGlow", /* @__PURE__ */ new Map());
      __publicField(this, "shake", 0);
      __publicField(this, "bannerFlash", null);
      __publicField(this, "lastPhase", null);
      __publicField(this, "labels", []);
      __publicField(this, "fps", 60);
      /** Per-section frame cost (ms, smoothed) for profiling from the console. */
      __publicField(this, "prof", {});
      /** Big world-map panel (M). */
      __publicField(this, "bigMapOpen", false);
      /** Translucent full-screen map overlay over the game (Tab in the PoE2 preset). */
      __publicField(this, "mapOverlayOpen", false);
      __publicField(this, "worldFx", null);
      /** Cached 1 px per map cell overview of the current map (north-up, biome map colours). */
      __publicField(this, "mapOverview", null);
      __publicField(this, "lastMonsters", /* @__PURE__ */ new Map());
      // ---- entities ------------------------------------------------------------
      /** Swing counter per player: odd swings play the mirrored attack (alternating slashes). */
      __publicField(this, "swingParity", /* @__PURE__ */ new Map());
      // ---- monsters agent: drawing context for gfx/monsters_fx + rogue exile paper doll ----
      __publicField(this, "_monFx", null);
      this.ctx = canvas2.getContext("2d");
      this.lo = document.createElement("canvas");
      this.g = this.lo.getContext("2d");
      this.worldG = this.g;
      this.resize();
      window.addEventListener("resize", () => this.resize());
      onChange("interface", "uiScale", () => this.resize());
      onChange("graphics", "renderScale", () => this.resize());
      canvas2.addEventListener(
        "wheel",
        (ev) => {
          if (ev.ctrlKey) return;
          this.zoomTarget = Math.max(0.8, Math.min(1.3, this.zoomTarget * (ev.deltaY > 0 ? 0.93 : 1.07)));
        },
        { passive: true }
      );
      onMapChange(() => this.onMapChanged());
      this.onMapChanged();
    }
    /** World agent hook: a new procedural map was installed (shared/map.ts setMap). */
    onMapChanged() {
      const m = currentMap();
      setGroundSize(m.w, m.h);
      resetGround();
      this.propGrid = null;
      this.decals = [];
      this.corpses = [];
      this.campArt.clear();
      this.mapOverview = null;
    }
    /** Extra world-space overlay drawn above the darkness (progression: trial shrines, level-up rings). */
    /** CSS px from the bottom of the screen to the top of the bottom HUD panel (progression XP bar sits above it). */
    panelTopCss() {
      return (26 + 4) * this.hudScale / (this.dpr || 1);
    }
    overview() {
      if (this.mapOverview) return this.mapOverview;
      const m = currentMap();
      const cv = document.createElement("canvas");
      cv.width = m.cols;
      cv.height = m.rows;
      const c2 = cv.getContext("2d");
      const img = c2.createImageData(m.cols, m.rows);
      const pal2 = m.biome.palette;
      const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const cOpen = rgb(pal2.mapOpen);
      const cWall = rgb(pal2.mapWall);
      const cWater = rgb(pal2.mapWater);
      for (let k = 0; k < m.solid.length; k++) {
        const sk = m.solid[k];
        const c = sk === WALL ? cWall : sk === WATER ? cWater : cOpen;
        const f = sk === 0 && m.clear[k] <= 1 ? 0.8 : 1;
        img.data[k * 4] = c[0] * f;
        img.data[k * 4 + 1] = c[1] * f;
        img.data[k * 4 + 2] = c[2] * f;
        img.data[k * 4 + 3] = 255;
      }
      c2.putImageData(img, 0, 0);
      this.mapOverview = cv;
      return cv;
    }
    resize() {
      this.dpr = window.devicePixelRatio || 1;
      const devW = Math.round(window.innerWidth * this.dpr);
      const devH = Math.round(window.innerHeight * this.dpr);
      const { scale, hudScale, hudW, hudH } = pixelScale(devW, devH);
      this.scale = scale;
      this.rs = renderScaleFor(this.dpr);
      this.lo.width = Math.max(1, Math.round(devW * this.rs));
      this.lo.height = Math.max(1, Math.round(devH * this.rs));
      this.baseZ = this.lo.width / TARGET_LOW_W;
      this.applyZoom();
      this.hudScale = hudScale;
      this.hw = hudW;
      this.hh = hudH;
      this.hlo.width = hudW;
      this.hlo.height = hudH;
      this.hg.imageSmoothingEnabled = false;
      this.canvas.width = devW;
      this.canvas.height = devH;
      this.canvas.style.width = devW / this.dpr + "px";
      this.canvas.style.height = devH / this.dpr + "px";
    }
    /** Recompute the unit size of the view for the current zoom. */
    applyZoom() {
      this.Z = this.baseZ * this.zoom;
      this.lw = this.ww = this.lo.width / this.Z;
      this.lh = this.wh = this.lo.height / this.Z;
      this.light.resize(this.ww, this.wh);
      setSpriteDensity(Math.min(6, Math.max(1, Math.ceil(this.Z * 2) / 2)));
    }
    get fpsEstimate() {
      return Math.round(this.fps);
    }
    /** Client (CSS) pixels -> low-res pixels. */
    toLow(cx, cy) {
      return { x: cx * this.dpr * this.rs / this.Z, y: cy * this.dpr * this.rs / this.Z };
    }
    /** Client (CSS) pixels -> world position on the ground plane (using the last frame's camera). */
    screenToWorld(cx, cy) {
      const p = this.toLow(cx, cy);
      return unproject(p.x - this.offX, p.y - this.offY);
    }
    /** Aim angle from a world point (the player's feet) toward the ground point under the cursor. */
    aimAngle(cx, cy, fromX, fromY) {
      const p = this.toLow(cx, cy);
      const sx = this.offX + isoX(fromX, fromY);
      const sy = this.offY + isoY(fromX, fromY);
      const w = unproject(p.x - sx, p.y - sy);
      return Math.atan2(w.y, w.x);
    }
    /** Ground item whose label is under the given client point (from the last frame). */
    groundLabelAt(cx, cy) {
      const x2 = cx * this.dpr / this.hudScale;
      const y2 = cy * this.dpr / this.hudScale;
      for (let i = this.labels.length - 1; i >= 0; i--) {
        const l = this.labels[i];
        if (x2 >= l.x && x2 <= l.x + l.w && y2 >= l.y && y2 <= l.y + l.h) return l.g;
      }
      return null;
    }
    // ---- projection helpers --------------------------------------------------
    sx(x2, y2) {
      const v2 = (this.offX + isoX(x2, y2)) * this.hr;
      return this.hr === 1 ? v2 : Math.round(v2);
    }
    sy(x2, y2) {
      const v2 = (this.offY + isoY(x2, y2)) * this.hr;
      return this.hr === 1 ? v2 : Math.round(v2);
    }
    /** World-pass pixel length -> current target pixels. */
    up(px) {
      return Math.round(px * this.hr);
    }
    onScreen(x2, y2, m = 80) {
      const a = this.offX + isoX(x2, y2);
      const b = this.offY + isoY(x2, y2);
      m *= 1.5;
      return a > -m && b > -m && a < this.ww + m && b < this.wh + m * 1.5;
    }
    blit(s, x2, y2, alpha = 1) {
      if (alpha < 1) this.g.globalAlpha = alpha;
      const d = s.d ?? 1;
      if (d === 1) this.g.drawImage(s.cv, x2 - s.ax, y2 - s.ay);
      else this.g.drawImage(s.cv, x2 - s.ax / d, y2 - s.ay / d, s.cv.width / d, s.cv.height / d);
      if (alpha < 1) this.g.globalAlpha = 1;
    }
    // ---- effects -----------------------------------------------------------
    burst(x2, y2, z2, n2, colors, speed, opts = {}) {
      n2 = particleCount(n2);
      for (let i = 0; i < n2; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);
        this.parts.push({
          x: x2,
          y: y2,
          z: z2,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          vz: 40 + Math.random() * 70,
          g: 260,
          t: 0,
          life: 0.35 + Math.random() * 0.35,
          c: colors[Math.floor(Math.random() * colors.length)],
          s: 1,
          ...opts
        });
      }
    }
    onEvents(events2, selfId2) {
      for (const e of events2) {
        switch (e.k) {
          case "hit": {
            const self2 = !e.m && e.target === selfId2;
            const color = self2 ? "#ff5050" : e.m ? "#ffd27a" : "#ffffff";
            const dn = getSettings().interface.damageNumbers;
            if (dn === "all" || dn === "own" && (e.by === selfId2 || self2)) {
              const hf = hitFloat(e, color);
              this.floats.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y, text: hf.text, color: hf.color, t: 0, big: hf.big });
            }
            this.flashes.set((e.m ? "m:" : "p:") + e.target, FLASH_TIME);
            if (!e.m) {
              const tp = this.lastPlayers.get(e.target);
              const heavy = tp && tp.maxHp > 0 && e.dmg >= tp.maxHp * 0.25;
              playPose(e.target, heavy ? "stagger" : "flinch", heavy ? 520 : 200);
            }
            this.burst(e.x, e.y, 14, 6, ["#fff6c8", "#ffd27a", "#ffffff"], 160, { g: 120, life: 0.18, vz: 30 });
            const bloodless = e.m && this.monsterKindAt(e.target) === "cragback";
            if (goreLevel() === "off") this.burst(e.x, e.y, 12, 7, bloodless ? ["#6a625a", "#8a8278", "#4a443e"] : ["#7a1414", "#a01c1c", "#5a0d0d"], 90);
            if (!bloodless && Math.random() < 0.8) this.decals.push({ x: e.x + (Math.random() - 0.5) * 18, y: e.y + (Math.random() - 0.5) * 18, t: 0, life: 25, v: Math.floor(Math.random() * 6) });
            if (self2) this.shake = Math.max(this.shake, 3);
            break;
          }
          case "def":
          case "ail": {
            const df = defenceEvent(e);
            if (df && getSettings().interface.damageNumbers !== "off") this.floats.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y - 6, text: df.text, color: df.color, t: 0, big: df.big });
            break;
          }
          case "heal":
            this.healGlow.set(e.target, 0.7);
            if (e.target === selfId2) this.floats.push({ x: NaN, y: NaN, text: "+FLASK", color: "#7dff9a", t: 0, big: false });
            break;
          case "boom":
            this.rings.push({ x: e.x, y: e.y, r: e.r, t: 0, life: 0.45, color: "#ffcf5a", color2: "#ff5a1f" });
            this.burst(e.x, e.y, 6, 40, ["#ffcf5a", "#ff8a1f", "#ff4a1a", "#fff2b0"], 260, { vz: 90 });
            this.burst(e.x, e.y, 2, 18, ["#3a3430", "#2a2522", "#4a423b"], 140, { g: 40, vz: 20, life: 0.9, s: 2 });
            this.shake = Math.max(this.shake, 4);
            break;
          case "kill": {
            this.feed.push({ text: `${e.killer} > ${e.victim}`, color: "#ffd0d0", t: 0 });
            const p = this.lastPlayers.get(e.vid);
            this.corpses.push({
              kind: "p",
              id: e.vid,
              x: e.x,
              y: e.y,
              t: 0,
              dir: p ? dirN(p.angle, DIRS) : 4,
              lk: p?.lk ?? NAKED_LOOK,
              color: p?.color ?? "#888888",
              wk: p?.wk ?? null
            });
            this.burst(e.x, e.y, 2, 14, ["#4a423b", "#5c544a", "#3a3430"], 70, { g: 30, vz: 15, life: 0.8, s: 2 });
            this.decals.push({ x: e.x, y: e.y, t: 0, life: 45, v: 6 + Math.floor(Math.random() * 2) });
            break;
          }
          case "mdie":
            if (e.mk !== "cragback") this.decals.push({ x: e.x, y: e.y, t: 0, life: 30, v: 6 + Math.floor(Math.random() * 2) });
            this.corpses.push({ kind: "m", id: e.id, x: e.x, y: e.y, t: 0, dir: dir8(e.a), mk: e.mk, r: e.r, el: e.el ? this.eliteOf(e.id) : void 0 });
            this.burst(e.x, e.y, 2, 10, ["#4a423b", "#5c544a", "#3a3430"], 60, { g: 30, vz: 15, life: 0.7, s: 2 });
            break;
          case "info":
            this.feed.push({ text: e.text, color: "#c8d4ff", t: 0 });
            break;
        }
      }
      if (this.feed.length > 6) this.feed.splice(0, this.feed.length - 6);
      if (this.corpses.length > 120) this.corpses.splice(0, this.corpses.length - 120);
      if (this.decals.length > 260) this.decals.splice(0, this.decals.length - 260);
    }
    monsterKindAt(id) {
      return this.lastMonsters.get(id)?.k;
    }
    eliteOf(id) {
      return this.lastMonsters.get(id)?.e;
    }
    updateFx(dt, v2) {
      this.time += dt;
      for (const f of this.floats) f.t += dt;
      this.floats = this.floats.filter((f) => f.t < 0.9);
      for (const f of this.feed) f.t += dt;
      this.feed = this.feed.filter((f) => f.t < FEED_TIME);
      for (const [id, t4] of this.flashes) {
        if (t4 - dt <= 0) this.flashes.delete(id);
        else this.flashes.set(id, t4 - dt);
      }
      for (const [id, t4] of this.healGlow) {
        if (t4 - dt <= 0) this.healGlow.delete(id);
        else this.healGlow.set(id, t4 - dt);
      }
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter((r) => r.t < r.life);
      for (const c of this.corpses) c.t += dt;
      this.corpses = this.corpses.filter((c) => c.t < 60 && !goreCorpse(c.kind, c.id)?.hidden);
      for (const d of this.decals) d.t += dt;
      this.decals = this.decals.filter((d) => d.t < d.life);
      for (const f of this.fog) f.x += f.sp * dt;
      for (const d of this.dust) {
        d.x += 4 * dt;
        d.ph += dt;
      }
      for (const p of this.parts) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vz -= p.g * dt;
        p.z += p.vz * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.3;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      }
      this.parts = this.parts.filter((p) => p.t < p.life);
      if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
      this.shake = Math.max(0, this.shake - dt * 18);
      if (this.bannerFlash) {
        this.bannerFlash.t += dt;
        if (this.bannerFlash.t > 1.2) this.bannerFlash = null;
      }
      const seenNow = this.time;
      const track2 = (key, x2, y2, s) => {
        let m = this.motion.get(key);
        if (!m) {
          m = { x: x2, y: y2, speed: 0, phase: 0, s, strikeT: 9, seen: seenNow };
          this.motion.set(key, m);
        }
        const d = Math.hypot(x2 - m.x, y2 - m.y);
        if (d > 120) m.speed = 0;
        else {
          m.speed = m.speed * 0.6 + (dt > 0 ? d / dt : 0) * 0.4;
          m.phase += d;
        }
        if (m.s === 2 && s !== 2) m.strikeT = 0;
        else m.strikeT += dt;
        m.s = s;
        m.x = x2;
        m.y = y2;
        m.seen = seenNow;
        return m;
      };
      for (const p of v2.players.values()) {
        track2("p:" + p.id, p.x, p.y, 0);
        if (p.alive && p.rollT > 0 && Math.random() < 0.7) {
          this.parts.push({ x: p.x + (Math.random() - 0.5) * 16, y: p.y + (Math.random() - 0.5) * 16, z: 1, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, vz: 20 + Math.random() * 20, g: 30, t: 0, life: 0.45, c: Math.random() < 0.5 ? "#5c5246" : "#776a58", s: 2 });
        }
      }
      for (const m of v2.monsters.values()) {
        track2("m:" + m.id, m.x, m.y, m.s);
        if (m.e?.includes("rimecloaked")) {
          const aura = ELITE_MOD_BY_ID.get("rimecloaked")?.frostAura;
          const R8 = aura?.radius ?? 170;
          const n2 = Math.random() < dt * 40 ? 1 : 0;
          for (let i = 0; i < n2 + (Math.random() < dt * 20 ? 1 : 0); i++) {
            const a = Math.random() * Math.PI * 2;
            const rr3 = Math.sqrt(Math.random()) * R8;
            this.parts.push({ x: m.x + Math.cos(a) * rr3, y: m.y + Math.sin(a) * rr3, z: 0, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, vz: 6 + Math.random() * 10, g: 0, t: 0, life: 0.8 + Math.random() * 0.8, c: Math.random() < 0.3 ? "#ffffff" : "#9adfff", c2: "#3f7fb0", s: 1 });
          }
        }
      }
      for (const pr of v2.projs.values()) {
        for (let i = 0; i < 2; i++) {
          this.parts.push({ x: pr.x + (Math.random() - 0.5) * 6, y: pr.y + (Math.random() - 0.5) * 6, z: 12 + (Math.random() - 0.5) * 4, vx: 0, vy: 0, vz: 4, g: 0, t: 0, life: 0.3, c: Math.random() < 0.4 ? "#e0ffb0" : "#6fd04a", c2: "#2a5a20", s: 1 });
        }
      }
      for (const [key, m] of this.motion) if (seenNow - m.seen > 2) this.motion.delete(key);
      const cur = new Map(v2.hazards.map((h) => [h.id, h]));
      for (const [id, h] of this.lastHaz) {
        if (!cur.has(id) && h.f > 0.8) {
          this.rings.push({ x: h.x, y: h.y, r: h.r, t: 0, life: 0.4, color: "#d8c8a8", color2: "#6a5a48" });
          this.burst(h.x, h.y, 2, 22, ["#5c5246", "#776a58", "#3e362e"], h.r * 1.4, { g: 120, vz: 50, s: 2, life: 0.6 });
          this.shake = Math.max(this.shake, 2.5);
        }
      }
      this.lastHaz = cur;
      for (const p of v2.players.values()) {
        if (!p.alive || p.atkT <= 0) continue;
        const prog = 1 - p.atkT / p.swingTime;
        const seen = this.swingSeen.get(p.id) ?? 1;
        if (p.wk === "axe" && prog >= ATTACK_COMMIT && seen < ATTACK_COMMIT) {
          const r = PLAYER_RADIUS + p.atkRange * 0.7;
          this.burst(p.x + Math.cos(p.angle) * r, p.y + Math.sin(p.angle) * r, 1, 10, ["#5c5246", "#776a58"], 90, { g: 140, vz: 40, s: 2 });
        }
        this.swingSeen.set(p.id, prog);
      }
      for (const id of this.swingSeen.keys()) {
        const p = v2.players.get(id);
        if (!p || p.atkT <= 0) this.swingSeen.set(id, 1);
      }
    }
    // ---- frame -------------------------------------------------------------
    draw(v2, dt) {
      this.fps = this.fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
      if (v2.phase !== this.lastPhase) {
        if (v2.phase === "fight" && this.lastPhase === "countdown") this.bannerFlash = { text: "FIGHT!", t: 0 };
        if (v2.phase === "countdown") {
          this.corpses = [];
          this.decals = [];
        }
        this.lastPhase = v2.phase;
      }
      let pt = performance.now();
      const mark = (k) => {
        const n2 = performance.now();
        this.prof[k] = (this.prof[k] ?? 0) * 0.9 + (n2 - pt) * 0.1;
        pt = n2;
      };
      startFrameBudget(3);
      this.updateFx(dt, v2);
      mark("fx");
      for (const p of v2.players.values()) if (p.alive) this.lastPlayers.set(p.id, p);
      for (const m of v2.monsters.values()) this.lastMonsters.set(m.id, m);
      if (this.lastMonsters.size > 400) this.lastMonsters = new Map([...v2.monsters].map(([k, m]) => [k, m]));
      if (Math.abs(this.zoomTarget - this.zoom) > 2e-3) {
        this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 10);
        this.applyZoom();
      }
      const { g, lw, lh } = this;
      g.setTransform(this.Z, 0, 0, this.Z, 0, 0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.fillStyle = VOID;
      g.fillRect(0, 0, lw, lh);
      const tx = isoX(v2.camX, v2.camY);
      const ty = isoY(v2.camX, v2.camY);
      if (!Number.isFinite(this.camSX) || Math.hypot(tx - this.camSX, ty - this.camSY) > 400) {
        this.camSX = tx;
        this.camSY = ty;
      } else {
        const k = 1 - Math.exp(-dt * 14);
        this.camSX += (tx - this.camSX) * k;
        this.camSY += (ty - this.camSY) * k;
      }
      const shk = getSettings().graphics.screenShake ? this.shake : 0;
      const shx = (Math.random() - 0.5) * shk;
      const shy = (Math.random() - 0.5) * shk;
      this.offX = lw / 2 - this.camSX + shx;
      this.offY = lh / 2 + 24 - this.camSY + shy;
      Object.assign(cam, { offX: this.offX, offY: this.offY, Z: this.Z, ww: this.ww, wh: this.wh, time: this.time });
      this.drawGround();
      mark("bg");
      for (const c of v2.camps) {
        if (!this.onScreen(c.x, c.y, 120)) continue;
        this.blit(this.campFor(c).patch, this.sx(c.x, c.y), this.sy(c.x, c.y));
      }
      if (goreLevel() !== "off") this.decals.length = 0;
      for (const d of this.decals) {
        if (!this.onScreen(d.x, d.y, 20)) continue;
        this.blit(splatSprite(d.v), this.sx(d.x, d.y), this.sy(d.x, d.y), Math.min(1, (d.life - d.t) / 5));
      }
      for (const m of v2.monsters.values()) this.drawAura(m);
      for (const hz of v2.hazards) this.drawHazard(hz);
      for (const m of v2.monsters.values()) this.drawTelegraph(m);
      drawBuffShrines(this.monFx());
      runLayer("ground", g);
      if (v2.self?.alive) this.isoEllipse(v2.self.x, v2.self.y, PLAYER_RADIUS + 6, null, "rgba(255,240,210,0.22)", true);
      mark("flat");
      const list = [];
      const corpseHide = /* @__PURE__ */ new Set();
      for (const c of this.corpses) if (c.t < 1.5) corpseHide.add(c.kind + ":" + c.id);
      for (const c of this.corpses) {
        if (!this.onScreen(c.x, c.y)) continue;
        list.push({ d: depthOf(c.x, c.y) - (c.t > 0.6 ? 18 : 0), fn: () => this.drawCorpse(c) });
      }
      for (const gi of v2.ground) {
        if (!this.onScreen(gi.x, gi.y, 60)) continue;
        list.push({ d: depthOf(gi.x, gi.y) - 8, fn: () => this.drawGroundItem(gi) });
      }
      for (const k of this.visibleProps()) {
        if (k < OBSTACLES.length) {
          const o = OBSTACLES[k];
          if (o.k === "water" || o.wall && hash2(Math.round(o.x), Math.round(o.y), 77) < 0.75 || !this.onScreen(o.x, o.y, 160)) continue;
          list.push({ d: depthOf(o.x, o.y), fn: () => this.blit(obstacleSprite(k), this.sx(o.x, o.y), this.sy(o.x, o.y)) });
        } else {
          const i = k - OBSTACLES.length;
          const sc = SCATTER[i];
          if (!this.onScreen(sc.x, sc.y, 40)) continue;
          list.push({ d: depthOf(sc.x, sc.y), fn: () => this.blit(scatterSprite(i), this.sx(sc.x, sc.y), this.sy(sc.x, sc.y)) });
        }
      }
      const bf = Math.floor(this.time * 9) % 4;
      for (const c of v2.camps) {
        if (!this.onScreen(c.x, c.y, 200)) continue;
        list.push({ d: depthOf(c.x, c.y), fn: () => this.blit(this.campFor(c).totem, this.sx(c.x, c.y), this.sy(c.x, c.y)) });
        for (const [dx, dy] of BRAZIERS) {
          const x2 = c.x + dx;
          const y2 = c.y + dy;
          list.push({ d: depthOf(x2, y2), fn: () => this.blit(brazierSprite(bf + dx & 3), this.sx(x2, y2), this.sy(x2, y2)) });
        }
        const seed2 = Math.floor(hash2(Math.round(c.x), Math.round(c.y), 9) * 1e3);
        for (let k = 0; k < 10; k++) {
          if ((k + seed2) % 4 === 0) continue;
          const a = k / 10 * Math.PI * 2 + seed2 % 7 * 0.1;
          const x2 = c.x + Math.cos(a) * 150;
          const y2 = c.y + Math.sin(a) * 150;
          const d8 = (Math.round(a / (Math.PI * 2) * 8) % 8 + 8) % 8;
          list.push({ d: depthOf(x2, y2), fn: () => this.blit(stakeSprite(seed2 + k, d8), this.sx(x2, y2), this.sy(x2, y2)) });
        }
      }
      for (const m of v2.monsters.values()) {
        if (corpseHide.has("m:" + m.id) || !this.onScreen(m.x, m.y)) continue;
        list.push({ d: depthOf(m.x, m.y), fn: () => this.drawMonster(m) });
      }
      const living2 = [...v2.players.values()].filter((p) => p.alive && !(corpseHide.has("p:" + p.id) && p.id !== v2.selfId));
      for (const p of living2) {
        if (!this.onScreen(p.x, p.y)) continue;
        list.push({ d: depthOf(p.x, p.y), fn: () => this.drawPlayer(p, v2) });
      }
      for (const pr of v2.projs.values()) {
        if (!this.onScreen(pr.x, pr.y)) continue;
        list.push({ d: depthOf(pr.x, pr.y), fn: () => this.drawProj(pr) });
      }
      for (const m of v2.monsters.values()) if (!corpseHide.has("m:" + m.id) && this.onScreen(m.x, m.y)) this.blit(shadowSprite(m.r * K * 1), this.sx(m.x, m.y), this.sy(m.x, m.y));
      for (const p of living2) if (this.onScreen(p.x, p.y)) this.blit(shadowSprite(PLAYER_RADIUS * K * 0.95), this.sx(p.x, p.y), this.sy(p.x, p.y) + 1);
      for (const pr of v2.projs.values()) if (this.onScreen(pr.x, pr.y)) this.blit(shadowSprite(6), this.sx(pr.x, pr.y), this.sy(pr.x, pr.y));
      for (const c of v2.camps) {
        if (!this.onScreen(c.x, c.y, 200)) continue;
        for (const [dx, dy] of BRAZIERS) this.blit(shadowSprite(8), this.sx(c.x + dx, c.y + dy), this.sy(c.x + dx, c.y + dy));
      }
      for (const fn of layers.depth) {
        try {
          fn((d, draw) => list.push({ d, fn: draw }), cam);
        } catch (err) {
          console.error("depth layer", err);
        }
      }
      list.sort((a, b) => a.d - b.d);
      for (const it of list) it.fn();
      runLayer("over", g);
      mark("sorted");
      this.drawFog(v2);
      this.buildLights(v2);
      this.light.apply(g);
      mark("light");
      for (const gi of v2.ground) if (this.onScreen(gi.x, gi.y, 60)) this.drawLootBeam(gi);
      for (const p of living2) this.drawSlash(p);
      this.drawParticles();
      runLayer("fx", g);
      for (const r of this.rings) this.drawRing(r);
      if (this.worldFx) this.worldFx(g, (x2, y2) => ({ x: this.sx(x2, y2), y: this.sy(x2, y2) }), (px) => this.up(px));
      for (const [id, t4] of this.healGlow) {
        const p = v2.players.get(id);
        if (!p) continue;
        const k = t4 / 0.7;
        g.globalAlpha = Math.max(0, k);
        this.isoEllipse(p.x, p.y, 18 + (1 - k) * 12, null, "#8cffa0");
        g.globalAlpha = 1;
        if (Math.random() < 0.6) this.parts.push({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30, z: 2, vx: 0, vy: 0, vz: 40, g: 0, t: 0, life: 0.5, c: Math.random() < 0.5 ? "#7dff9a" : "#ff6a72", s: 1 });
      }
      mark("effects");
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (this.hw <= 0 || this.hh <= 0) return;
      this.hg.clearRect(0, 0, this.hw, this.hh);
      this.g = this.hg;
      this.lw = this.hw;
      this.lh = this.hh;
      this.hr = this.Z / this.rs / this.hudScale;
      try {
        for (const m of v2.monsters.values()) if (!corpseHide.has("m:" + m.id) && this.onScreen(m.x, m.y)) this.drawMonsterLabel(m);
        drawBuffShrineLabels(this.monFx());
        drawBuffHud(this.monFx());
        const pl = getSettings().interface.playerLabels;
        for (const p of living2) if (pl !== "off" && !(pl === "others" && p.id === v2.selfId) && this.onScreen(p.x, p.y)) this.drawLabel(p, p.id === v2.selfId);
        this.drawLootLabels(v2);
        for (const f of this.floats) {
          const fx = Number.isNaN(f.x) && v2.self ? v2.self.x : f.x;
          const fy = Number.isNaN(f.y) && v2.self ? v2.self.y : f.y;
          const rise = this.up(34 * ZP + f.t * 36);
          g.globalAlpha = Math.min(1, 1.6 - f.t * 1.8);
          drawText(g, f.text, this.sx(fx, fy), this.sy(fx, fy) - rise, f.color, "center", f.big ? 2 : 1);
          g.globalAlpha = 1;
        }
        mark("labels");
        this.drawHud(v2);
      } finally {
        this.g = this.worldG;
        this.lw = this.ww;
        this.lh = this.wh;
        this.hr = 1;
      }
      mark("hud");
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.drawImage(this.lo, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.hlo, 0, 0, this.hw * this.hudScale, this.hh * this.hudScale);
      mark("up");
    }
    /** World point -> light map (centred a little above the feet so bodies are lit). */
    lightAt(x2, y2, R8, c, k) {
      this.light.add(this.sx(x2, y2), this.sy(x2, y2) - 16, R8 * K, c, k);
    }
    buildLights(v2) {
      const t4 = this.time;
      this.light.begin(ambientColor(AMBIENT));
      const lb = lightBudget();
      const flick = (seed2, a) => 1 + a * (Math.sin(t4 * 7.3 + seed2) * 0.6 + Math.sin(t4 * 17.1 + seed2 * 2.3) * 0.4);
      let anyPlayer = false;
      for (const p of v2.players.values()) {
        if (!p.alive || !this.onScreen(p.x, p.y, 260)) continue;
        const self2 = p.id === v2.selfId;
        anyPlayer || (anyPlayer = self2 || p.id === v2.spectating?.id);
        this.lightAt(p.x, p.y, (self2 ? 270 : 225) * lb.radiusK * flick(p.id, 0.025), WARM, self2 ? 1 : 0.85);
      }
      if (!anyPlayer) this.lightAt(v2.camX, v2.camY, 300, [150, 150, 180], 0.55);
      for (const c of v2.camps) {
        if (!this.onScreen(c.x, c.y, 300)) continue;
        BRAZIERS.forEach(([dx, dy], i) => this.lightAt(c.x + dx, c.y + dy, 190 * flick(c.x + i * 3, 0.06), TORCH, 1));
      }
      const SHRINE_IDX = shrineIndex();
      if (SHRINE_IDX >= 0) {
        const o = OBSTACLES[SHRINE_IDX];
        if (this.onScreen(o.x, o.y, 300)) this.lightAt(o.x, o.y, o.r * 2.6, SHRINE_LIGHT, 0.75 + Math.sin(t4 * 1.7) * 0.1);
      }
      for (const gi of v2.ground) {
        if (!gi.item || !this.onScreen(gi.x, gi.y, 60)) continue;
        const r = gi.item.r;
        if (lb.minor) this.lightAt(gi.x, gi.y, [45, 80, 100, 130][r] ?? 45, LOOT_LIGHT[r] ?? LOOT_LIGHT[0], r === 0 ? 0.45 : 0.85);
      }
      for (const pr of v2.projs.values()) if (lb.minor && this.onScreen(pr.x, pr.y)) this.lightAt(pr.x, pr.y, 80, [130, 255, 200], 0.9);
      for (const m of v2.monsters.values()) {
        if (!this.onScreen(m.x, m.y, 100)) continue;
        if (m.k === "bog_seer") this.lightAt(m.x, m.y, m.s === 2 ? 110 : 70, [110, 230, 200], m.s === 2 ? 0.8 : 0.45);
        if (m.e?.includes("rimecloaked")) this.lightAt(m.x, m.y, (ELITE_MOD_BY_ID.get("rimecloaked")?.frostAura?.radius ?? 170) * 1.1, [90, 150, 255], 0.35);
      }
      for (const hz of v2.hazards) if (this.onScreen(hz.x, hz.y, 120)) this.lightAt(hz.x, hz.y, hz.r * 1.3, [255, 80, 30], 0.3 + 0.5 * hz.f);
      for (const r of this.rings) this.lightAt(r.x, r.y, r.r * 1.8, hexRGB(r.color), 1 - r.t / r.life);
      for (const [id, tt] of this.healGlow) {
        const p = v2.players.get(id);
        if (p) this.lightAt(p.x, p.y, 110, [120, 255, 150], tt / 0.7);
      }
    }
    drawFog(v2) {
      const { g, lw, lh } = this;
      const cx = isoX(v2.camX, v2.camY);
      const cy = isoY(v2.camX, v2.camY);
      const wrap = (a, lo, span) => lo + ((a - lo) % span + span) % span;
      const fog = fogSprite();
      g.globalAlpha = 0.09;
      for (const f of this.fog) {
        const x2 = wrap(f.x, cx - lw / 2 - 140, lw + 280);
        const y2 = wrap(f.y, cy - lh / 2 - 60, lh + 120);
        g.drawImage(fog, this.offX + x2 - 90, this.offY + y2 - 30, 180, 60);
      }
      g.fillStyle = "#c8bea6";
      for (const d of this.dust) {
        const x2 = wrap(d.x, cx - lw / 2, lw);
        const y2 = wrap(d.y + Math.sin(d.ph * 0.7) * 6, cy - lh / 2, lh);
        g.globalAlpha = 0.25 + 0.2 * Math.sin(d.ph * 1.3);
        g.beginPath();
        g.arc(this.offX + x2, this.offY + y2, 0.6, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    campFor(c) {
      const key = `${Math.round(c.x)},${Math.round(c.y)}`;
      let a = this.campArt.get(key);
      if (!a) {
        const seed2 = Math.floor(hash2(Math.round(c.x), Math.round(c.y), 5) * 1e3);
        a = { patch: buildCampPatch(seed2 % 97), totem: buildTotem(seed2 % 7) };
        if (this.campArt.size > 64) this.campArt.clear();
        this.campArt.set(key, a);
      }
      return a;
    }
    // ---- ground layer --------------------------------------------------------
    /** Blit the visible ground chunks; build missing ones under a small per-frame budget, then prefetch a ring. */
    drawGround() {
      const { g } = this;
      const R8 = groundChunkRange();
      const x0 = Math.max(R8.cx0, Math.floor(-this.offX / CHUNK));
      const x1 = Math.min(R8.cx1, Math.floor((this.ww - this.offX) / CHUNK));
      const y0 = Math.max(R8.cy0, Math.floor(-this.offY / CHUNK));
      const y1 = Math.min(R8.cy1, Math.floor((this.wh - this.offY) / CHUNK));
      const until = performance.now() + 6;
      let built = 0;
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          let c = cachedChunk(cx, cy);
          if (c === void 0 && (built === 0 || performance.now() < until)) {
            c = buildChunk(cx, cy);
            built++;
          }
          const dx = this.offX + cx * CHUNK;
          const dy = this.offY + cy * CHUNK;
          if (c) g.drawImage(c, dx, dy, CHUNK, CHUNK);
          else if (c === void 0) {
            g.fillStyle = GROUND_FILL;
            g.fillRect(dx, dy, CHUNK, CHUNK);
          }
        }
      }
      for (let cy = Math.max(R8.cy0, y0 - 1); cy <= Math.min(R8.cy1, y1 + 1) && performance.now() < until; cy++) {
        for (let cx = Math.max(R8.cx0, x0 - 1); cx <= Math.min(R8.cx1, x1 + 1) && performance.now() < until; cx++) {
          if (cachedChunk(cx, cy) === void 0) buildChunk(cx, cy);
        }
      }
    }
    /** Obstacle (k < OBSTACLES.length) and scatter (k - OBSTACLES.length) indices near the view. */
    visibleProps() {
      const CELL2 = 256;
      const n2 = OBSTACLES.length + SCATTER.length;
      if (!this.propGrid || this.propGrid.n !== n2) {
        const cells = /* @__PURE__ */ new Map();
        for (let k = 0; k < n2; k++) {
          const p = k < OBSTACLES.length ? OBSTACLES[k] : SCATTER[k - OBSTACLES.length];
          const key = Math.floor(p.x / CELL2) * 65536 + Math.floor(p.y / CELL2);
          let l = cells.get(key);
          if (!l) cells.set(key, l = []);
          l.push(k);
        }
        this.propGrid = { n: n2, cells };
      }
      const a = unproject(-this.offX, -this.offY);
      const b = unproject(this.ww - this.offX, this.wh - this.offY);
      const out = [];
      for (let gx = Math.floor(a.x / CELL2) - 1; gx <= Math.floor(b.x / CELL2) + 1; gx++) {
        for (let gy = Math.floor(a.y / CELL2) - 1; gy <= Math.floor(b.y / CELL2) + 2; gy++) {
          const l = this.propGrid.cells.get(gx * 65536 + gy);
          if (l) for (const k of l) out.push(k);
        }
      }
      return out;
    }
    /** Smooth ellipse (fill, then a thin stroke); "dither" now means a softer, translucent fill. */
    ell(cx, cy, rx, ry, fill, stroke, dither = false) {
      if (rx < 0.5 || ry < 0.5) return;
      const g = this.g;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (fill) {
        const a = g.globalAlpha;
        if (dither) g.globalAlpha = a * 0.6;
        g.fillStyle = fill;
        g.fill();
        g.globalAlpha = a;
      }
      if (stroke) {
        g.strokeStyle = stroke;
        g.lineWidth = this.hr === 1 ? 0.8 : 1;
        g.stroke();
      }
    }
    isoEllipse(x2, y2, r, fill, stroke, dither = false) {
      this.ell(this.sx(x2, y2), this.sy(x2, y2), r * K * this.hr, r * K * SQ * this.hr, fill, stroke, dither);
    }
    drawAura(m) {
      drawMonAura(this.monFx(), m);
      for (const id of m.e ?? []) {
        const aura = ELITE_MOD_BY_ID.get(id)?.frostAura;
        if (!aura || !this.onScreen(m.x, m.y, 120)) continue;
        this.isoEllipse(m.x, m.y, aura.radius, "rgba(120,190,255,0.10)", null, true);
        const g = this.g;
        g.save();
        g.setLineDash([6, 4]);
        g.lineDashOffset = -this.time * 12;
        g.strokeStyle = "rgba(160,220,255,0.7)";
        g.lineWidth = 0.9;
        g.beginPath();
        g.ellipse(this.sx(m.x, m.y), this.sy(m.x, m.y), aura.radius * K, aura.radius * K * SQ, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    }
    drawHazard(hz) {
      if (hz.sh && drawMonHazard(this.monFx(), hz)) return;
      if (!this.onScreen(hz.x, hz.y, 120)) return;
      const pulse = Math.floor(this.time * 10) % 2 === 0;
      const g = this.g;
      g.globalAlpha = 0.35 + 0.4 * hz.f;
      this.isoEllipse(hz.x, hz.y, hz.r, "rgba(255,60,30,0.4)", null, true);
      g.globalAlpha = 0.45 + 0.5 * hz.f;
      this.isoEllipse(hz.x, hz.y, Math.round(hz.r * hz.f / 4) * 4, "rgba(255,90,40,0.5)", null);
      g.globalAlpha = 1;
      this.isoEllipse(hz.x, hz.y, hz.r, null, pulse || hz.f > 0.8 ? "#ff5a3c" : "#b8301e");
    }
    /** Melee windup: a dithered red wedge on the ground in front of the monster. */
    drawTelegraph(m) {
      const type = MONSTER_BY_ID.get(m.k);
      if (m.s !== 2 || type?.ai !== "melee" || !this.onScreen(m.x, m.y)) return;
      const g = this.g;
      const reach = m.r + type.attackRange + PLAYER_RADIUS;
      const flash = m.w > 0.78 && Math.floor(this.time * 16) % 2 === 0;
      g.beginPath();
      g.moveTo(this.sx(m.x + Math.cos(m.a - Math.PI / 3) * m.r, m.y + Math.sin(m.a - Math.PI / 3) * m.r), this.sy(m.x + Math.cos(m.a - Math.PI / 3) * m.r, m.y + Math.sin(m.a - Math.PI / 3) * m.r));
      for (let i = 0; i <= 16; i++) {
        const a = m.a - Math.PI / 3 + Math.PI * 2 / 3 * (i / 16);
        g.lineTo(this.sx(m.x + Math.cos(a) * reach, m.y + Math.sin(a) * reach), this.sy(m.x + Math.cos(a) * reach, m.y + Math.sin(a) * reach));
      }
      for (let i = 16; i >= 0; i--) {
        const a = m.a - Math.PI / 3 + Math.PI * 2 / 3 * (i / 16);
        g.lineTo(this.sx(m.x + Math.cos(a) * m.r, m.y + Math.sin(a) * m.r), this.sy(m.x + Math.cos(a) * m.r, m.y + Math.sin(a) * m.r));
      }
      g.closePath();
      const cx = this.sx(m.x, m.y);
      const cy = this.sy(m.x, m.y);
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, reach * K);
      const w = Math.max(0.05, Math.min(0.98, m.w));
      gr.addColorStop(0, "rgba(255,60,40,0.35)");
      gr.addColorStop(w, `rgba(255,70,40,${flash ? 0.6 : 0.32})`);
      gr.addColorStop(Math.min(1, w + 0.02), "rgba(255,60,40,0.08)");
      gr.addColorStop(1, "rgba(255,60,40,0.08)");
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = flash ? "rgba(255,220,180,0.9)" : `rgba(255,90,60,${0.35 + 0.4 * m.w})`;
      g.lineWidth = flash ? 1.2 : 0.8;
      g.stroke();
    }
    heroAnim(p, v2) {
      const m = this.motion.get("p:" + p.id);
      if (p.rollT > 0) {
        const dur = p.id === v2.selfId ? v2.selfStats.dodgeTime : DODGE_TIME;
        const prog = 1 - p.rollT / Math.max(0.05, dur);
        const ang = Math.hypot(p.rollDx, p.rollDy) > 0.01 ? Math.atan2(p.rollDy, p.rollDx) : p.angle;
        return { anim: "roll", frame: Math.max(0, Math.min(5.99, prog * 6)), dir: dirN(ang, DIRS) };
      }
      const dir = dirN(p.angle, DIRS);
      const pose = currentPose(p.id);
      if (pose && !pose.weak) return { anim: pose.anim, frame: pose.frame, dir: pose.dir !== void 0 ? dirN(pose.dir, DIRS) : dir };
      if (p.atkT > 0) {
        const prog = 1 - p.atkT / Math.max(0.05, p.swingTime);
        const sp2 = this.swingParity.get(p.id) ?? { t: 0, n: 0 };
        if (p.atkT > sp2.t + 0.01) sp2.n++;
        sp2.t = p.atkT;
        this.swingParity.set(p.id, sp2);
        const C5 = ATTACK_COMMIT;
        const f = prog < C5 ? Math.pow(prog / C5, 1.6) * 3 : 3 + (prog - C5) / (1 - C5) * 2.99;
        return { anim: sp2.n % 2 ? "attack2" : "attack", frame: Math.max(0, Math.min(5.99, f)), dir };
      }
      const sp = this.swingParity.get(p.id);
      if (sp) sp.t = 0;
      if (pose) return { anim: pose.anim, frame: pose.frame, dir };
      if (m && m.speed > 40) {
        return { anim: "run", frame: m.phase / 11 % 8, dir };
      }
      return { anim: "idle", frame: (this.time * 3 + p.id * 0.7) % 4, dir };
    }
    drawPlayer(p, v2) {
      const { anim, frame: frame2, dir } = this.heroAnim(p, v2);
      const lk = p.lk ?? NAKED_LOOK;
      const flash = this.flashes.has("p:" + p.id);
      const blood = Math.min(3, Math.ceil(goreWeaponBlood(p.id) * 3 - 0.15));
      const s = heroFrame({ look: decodeLook(lk), color: p.color, wk: p.wk, blood: blood > 0 ? blood : 0 }, lk, dir, anim, frame2, flash);
      this.blit(s, this.sx(p.x, p.y), this.sy(p.x, p.y) - heroLiftAt(anim, frame2));
      const tn = ailTint(p.st, this.time);
      if (tn) drawTint(this.g, s, this.sx(p.x, p.y), this.sy(p.x, p.y) - heroLiftAt(anim, frame2), tn.color, tn.a);
      drawAilFx(this.g, p.st, s, this.sx(p.x, p.y), this.sy(p.x, p.y) - heroLiftAt(anim, frame2), this.time, p.id);
    }
    drawCorpse(c) {
      const gc = goreCorpse(c.kind, c.id);
      if (gc?.hidden) return;
      const sink = gc?.sink ?? 0;
      const x2 = this.sx(c.x, c.y);
      const y2 = this.sy(c.x, c.y) + sink * 8;
      const fade = Math.min(1, (60 - c.t) / 4) * (1 - sink);
      const frame2 = Math.min(5, c.t / 0.11);
      let s;
      if (c.kind === "p") {
        const lying = frame2 >= 5;
        const lk = lying ? NAKED_LOOK : c.lk;
        s = heroFrame({ look: decodeLook(lk), color: c.color, wk: lying ? null : c.wk ?? null, missing: gc?.missing }, lk, c.dir, "death", frame2);
      } else {
        s = smoothMonsterFrame(c.mk, c.r, c.dir * (DIRS / 8), "death", Math.floor(frame2)) ?? monsterFrame(c.mk, c.r, c.el, c.dir, "death", Math.floor(frame2));
      }
      this.blit(s, x2, y2, fade);
      if (gc?.tint && (gc.tintA ?? 0) > 0) {
        this.g.globalAlpha = fade;
        drawTint(this.g, s, x2, y2, gc.tint, gc.tintA ?? 0);
        this.g.globalAlpha = 1;
      }
    }
    monFx() {
      if (!this._monFx) {
        const self2 = this;
        this._monFx = {
          get g() {
            return self2.g;
          },
          get time() {
            return self2.time;
          },
          sx: (x2, y2) => this.sx(x2, y2),
          sy: (x2, y2) => this.sy(x2, y2),
          up: (px) => this.up(px),
          ell: (x2, y2, r, f, st, d) => this.isoEllipse(x2, y2, r, f, st, d),
          bar: (x2, y2, w, fr, c) => this.bar(x2, y2, w, fr, c),
          onScreen: (x2, y2, pad) => this.onScreen(x2, y2, pad)
        };
      }
      return this._monFx;
    }
    exileFrame(m, mo, flash) {
      if (!m.lk) return null;
      const dir = dirN(m.a, DIRS);
      let anim = "idle";
      let frame2 = (this.time * 3 + m.id * 0.7) % 4;
      if (m.rl) {
        anim = "roll";
        frame2 = this.time * 18 % 6;
      } else if (m.s === 2) {
        anim = "attack";
        frame2 = Math.min(2.99, m.w * 3);
      } else if (mo && mo.strikeT < 0.3) {
        anim = "attack";
        frame2 = Math.min(5.99, 3 + mo.strikeT * 10);
      } else if (mo && mo.speed > 40) {
        anim = "run";
        frame2 = mo.phase / 11 % 8;
      }
      return heroFrame({ look: decodeLook(m.lk), color: m.cl ?? "#c0b090", wk: m.wk ?? null }, m.lk, dir, anim, frame2, flash);
    }
    drawMonster(m) {
      const mo = this.motion.get("m:" + m.id);
      const dir = dir8(m.a);
      let anim = "idle";
      let frame2 = Math.floor(this.time * 4 + m.id * 0.37) % 4;
      if (m.s === 2) {
        anim = "windup";
        frame2 = Math.max(0, Math.min(3, Math.floor(m.w * 4)));
      } else if (mo && mo.strikeT < 0.27) {
        anim = "strike";
        frame2 = Math.min(2, Math.floor(mo.strikeT / 0.09));
      } else if (mo && mo.speed > 25) {
        anim = "move";
        const stride = m.k === "cragback" ? 14 : m.k === "gnashling" ? 9 : 8;
        frame2 = Math.floor(mo.phase / stride) % 6;
      }
      const flash = this.flashes.has("m:" + m.id);
      const s = this.exileFrame(m, mo, flash) ?? smoothMonsterFrame(m.k, m.r, dirN(m.a, DIRS), anim, frame2, flash) ?? monsterFrame(m.k, m.r, m.e, dir, anim, frame2, flash);
      const jx = m.s === 2 && m.k === "cragback" && m.w > 0.6 ? Math.floor(this.time * 30) % 2 ? 1 : -1 : 0;
      this.blit(s, this.sx(m.x, m.y) + jx, this.sy(m.x, m.y));
      const tn = ailTint(m.st, this.time);
      if (tn) drawTint(this.g, s, this.sx(m.x, m.y) + jx, this.sy(m.x, m.y), tn.color, tn.a);
      drawAilFx(this.g, m.st, s, this.sx(m.x, m.y) + jx, this.sy(m.x, m.y), this.time, m.id);
    }
    drawProj(p) {
      const { g } = this;
      const x2 = this.sx(p.x, p.y);
      const y2 = this.sy(p.x, p.y) - 17;
      const pulse = 1 + Math.sin(this.time * 18) * 0.12;
      const gr = g.createRadialGradient(x2, y2, 0, x2, y2, 7 * pulse);
      gr.addColorStop(0, "rgba(245,255,225,1)");
      gr.addColorStop(0.3, "rgba(160,250,110,0.9)");
      gr.addColorStop(0.65, "rgba(60,150,40,0.35)");
      gr.addColorStop(1, "rgba(40,120,30,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x2, y2, 7 * pulse, 0, Math.PI * 2);
      g.fill();
    }
    drawGroundItem(gi) {
      const { g } = this;
      const x2 = this.sx(gi.x, gi.y);
      const y2 = this.sy(gi.x, gi.y);
      const r = gi.item?.r ?? 0;
      g.globalAlpha = r === 0 ? 0.12 : 0.22;
      this.ell(x2, y2, 12, 9, RARITY_BEAM[r], null);
      g.globalAlpha = 1;
      if (gi.item) {
        const key = gi.g + "|" + gi.item.b;
        let cv = groundArt.get(key);
        if (!cv) {
          if (groundArt.size > 300) groundArt.clear();
          cv = itemArtCanvas(gi.item, 40, 40);
          groundArt.set(key, cv);
        }
        const rot = gi.g * 2654435761 % 1e3 / 1e3 * 1.2 - 0.6;
        g.save();
        g.translate(x2, y2 + 1);
        g.scale(1, SQ);
        g.fillStyle = "rgba(0,0,0,0.35)";
        g.beginPath();
        g.arc(0.5, 1.5, 7.5, 0, Math.PI * 2);
        g.fill();
        g.rotate(rot);
        g.drawImage(cv, -8, -8, 16, 16);
        g.restore();
      }
    }
    /** Rarity light beam, drawn above the darkness so loot can be spotted from afar. */
    drawLootBeam(gi) {
      const { g } = this;
      const x2 = this.sx(gi.x, gi.y);
      const y2 = this.sy(gi.x, gi.y);
      const r = gi.item?.r ?? 0;
      const col3 = RARITY_BEAM[r];
      const h = r === 3 ? 120 : r === 2 ? 80 : r === 1 ? 50 : 16;
      const flick = 0.85 + 0.15 * Math.sin(this.time * 6 + gi.g);
      const gr = g.createLinearGradient(x2, y2 - 4, x2, y2 - 4 - h);
      gr.addColorStop(0, col3);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      const wd = r > 0 ? 2.4 : 1;
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = (r === 0 ? 0.25 : 0.6) * flick;
      g.fillStyle = gr;
      g.fillRect(x2 - wd / 2, y2 - 4 - h, wd, h);
      g.globalAlpha *= 0.4;
      g.fillRect(x2 - wd * 1.5, y2 - 4 - h * 0.7, wd * 3, h * 0.7);
      g.restore();
    }
    /** Screen point for a world point at height z (old-pixel units). */
    spt(wx, wy, z2) {
      return [this.sx(wx, wy), this.sy(wx, wy) - z2 * ZP];
    }
    /**
     * Tapered glowing ribbon through screen points (tail -> head): width grows from 0 to w at the head,
     * colour fades in from the tail; drawn additively with a soft glow.
     */
    ribbon(pts, w, core, glow4, alpha = 1) {
      if (pts.length < 2) return;
      const g = this.g;
      const L2 = [];
      const R8 = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b[1] - a[1]);
        let ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const t4 = i / (pts.length - 1);
        const hw = w / 2 * Math.pow(t4, 0.8) * (t4 > 0.92 ? (1 - t4) / 0.08 * 0.6 + 0.4 : 1);
        L2.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
        R8.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
      }
      const t0 = pts[0];
      const t1 = pts[pts.length - 1];
      const gr = g.createLinearGradient(t0[0], t0[1], t1[0], t1[1]);
      gr.addColorStop(0, "rgba(0,0,0,0)");
      gr.addColorStop(0.55, glow4);
      gr.addColorStop(1, core);
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = alpha;
      g.shadowColor = glow4;
      g.shadowBlur = 6 * this.Z;
      g.fillStyle = gr;
      g.beginPath();
      L2.forEach(([x2, y2], i) => i ? g.lineTo(x2, y2) : g.moveTo(x2, y2));
      for (let i = R8.length - 1; i >= 0; i--) g.lineTo(R8[i][0], R8[i][1]);
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = core;
      g.lineWidth = Math.max(0.4, w * 0.12);
      g.lineCap = "round";
      g.beginPath();
      const h0 = Math.floor(pts.length * 0.55);
      for (let i = h0; i < pts.length; i++) i === h0 ? g.moveTo(pts[i][0], pts[i][1]) : g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
      g.restore();
    }
    drawSlash(p) {
      if (p.atkT <= 0) return;
      const raw = 1 - p.atkT / Math.max(0.05, p.swingTime);
      const prog = Math.max(0, Math.min(1, (raw - (ATTACK_COMMIT - 0.12)) / 0.5));
      if (prog <= 0) return;
      const fadeOut = prog > 0.8 ? (1 - prog) / 0.2 : 1;
      const reach = PLAYER_RADIUS + p.atkRange;
      const wk = p.wk;
      const tint = wk === "axe" ? ["rgba(255,236,200,0.95)", "rgba(255,140,60,0.55)"] : wk === "spear" || wk === "dagger" ? ["rgba(235,245,255,0.95)", "rgba(140,190,255,0.5)"] : ["rgba(240,246,255,0.95)", "rgba(150,180,255,0.5)"];
      if (wk === "spear" || wk === "dagger") {
        const k = wk === "spear" ? Math.max(0, Math.min(1, (prog - 0.25) / 0.35)) : Math.sin(Math.min(1, prog * 1.15) * Math.PI);
        if (k <= 0) return;
        const tip = reach * (0.45 + 0.55 * k);
        const offs = wk === "dagger" ? [-0.18, 0.12] : [0];
        for (const o of offs) {
          const a = p.angle + o;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const pts2 = [];
          for (let i = 0; i <= 10; i++) {
            const d = PLAYER_RADIUS * 0.8 + (tip - PLAYER_RADIUS * 0.8) * i / 10;
            pts2.push(this.spt(p.x + ca * d, p.y + sa * d, 14));
          }
          this.ribbon(pts2, wk === "spear" ? 5 : 3.5, tint[0], tint[1], fadeOut);
        }
        return;
      }
      if (wk === "axe") {
        const b1 = Math.min(1, prog * 1.2) * 2.3;
        const b0 = Math.max(0, b1 - 1.4);
        const ca = Math.cos(p.angle);
        const sa = Math.sin(p.angle);
        const pts2 = [];
        for (let i = 0; i <= 16; i++) {
          const b = b0 + (b1 - b0) * i / 16;
          const d = PLAYER_RADIUS * 0.4 + reach * 0.65 * Math.sin(Math.min(Math.PI / 2, b * 0.75));
          const z2 = 34 * Math.cos(b * 0.7) + 2;
          pts2.push(this.spt(p.x + ca * d, p.y + sa * d, z2));
        }
        this.ribbon(pts2, 9, tint[0], tint[1], fadeOut);
        return;
      }
      const arc = p.atkArc;
      const flip = (this.swingParity.get(p.id)?.n ?? 0) % 2 ? -1 : 1;
      const start = p.angle + flip * arc / 2;
      const swept = arc * Math.min(1, prog * 1.25);
      const tail = Math.min(arc * 0.75, swept);
      const pts = [];
      for (let i = 0; i <= 18; i++) {
        const a = start - flip * (swept - tail + tail * i / 18);
        pts.push(this.spt(p.x + Math.cos(a) * reach * 0.86, p.y + Math.sin(a) * reach * 0.86, 13));
      }
      this.ribbon(pts, reach * 0.22, tint[0], tint[1], fadeOut);
    }
    drawParticles() {
      const { g } = this;
      for (const p of this.parts) {
        const k = p.t / p.life;
        g.fillStyle = p.c2 && k > 0.6 ? p.c2 : p.c;
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        g.beginPath();
        g.arc(this.sx(p.x, p.y), this.sy(p.x, p.y) - p.z * ZP, (p.s + 1) * 0.55, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    drawRing(r) {
      const k = r.t / r.life;
      const rad4 = r.r * (0.35 + 0.75 * k);
      this.g.globalAlpha = 1 - k;
      this.isoEllipse(r.x, r.y, rad4, null, r.color);
      this.isoEllipse(r.x, r.y, rad4 * 0.92, null, r.color2, true);
      if (k < 0.25) this.isoEllipse(r.x, r.y, rad4 * 0.6, "rgba(255,240,200,0.35)", null);
      this.g.globalAlpha = 1;
    }
    // ---- labels ---------------------------------------------------------------
    bar(x2, y2, w, frac, color) {
      const { g } = this;
      g.fillStyle = "#050405";
      g.fillRect(x2 - 1, y2 - 1, w + 2, 4);
      g.fillStyle = "#2a1414";
      g.fillRect(x2, y2, w, 2);
      g.fillStyle = color;
      g.fillRect(x2, y2, Math.round(w * Math.max(0, Math.min(1, frac))), 2);
    }
    drawMonsterLabel(m) {
      const mb = getSettings().interface.monsterBars;
      const damaged = mb === "always" || mb === "damaged" && m.hp < m.mhp;
      if (m.st) {
        const t0 = (m.k === "cragback" ? 52 : m.k === "bog_seer" ? 30 : 20) * (m.r / (MONSTER_BY_ID.get(m.k)?.radius ?? m.r)) * ZP * 1.12 + 10;
        drawStatus(this.g, m.st, this.sx(m.x, m.y), this.sy(m.x, m.y) - this.up(t0) - (m.e ? 24 : 4), 1, this.time);
      }
      if (drawMonLabel(this.monFx(), m, damaged, this.up((smoothTop(m.k, m.r) ?? (m.k === "cragback" ? 52 : m.k === "bog_seer" ? 30 : 20) * ZP * 1.12) + 10))) return;
      if (!damaged && !m.e) return;
      const top = m.k === "cragback" ? 52 : m.k === "bog_seer" ? 30 : 20;
      const sc = m.r / (MONSTER_BY_ID.get(m.k)?.radius ?? m.r);
      const x2 = this.sx(m.x, m.y);
      const y2 = this.sy(m.x, m.y) - this.up(top * sc * ZP * 1.12 + 10);
      const bw = Math.max(16, this.up(m.r * 1.3));
      if (damaged) this.bar(x2 - Math.floor(bw / 2), y2, bw, m.hp / m.mhp, m.e ? "#e8a03a" : "#c8402e");
      if (m.e) {
        const c = ELITE_COLORS[m.e[0]] ?? "#ffcc66";
        drawText(this.g, (m.n ?? "").toUpperCase(), x2, y2 - 19, "#ffd27a", "center");
        const mods = m.e.map((id) => ELITE_MOD_BY_ID.get(id)?.name ?? id).join(" ");
        drawText(this.g, mods, x2, y2 - 10, c, "center");
      }
    }
    drawLabel(p, isSelf) {
      const x2 = this.sx(p.x, p.y);
      const y2 = this.sy(p.x, p.y) - this.up(68 * ZP);
      const frac = Math.max(0, p.hp / (p.maxHp || 100));
      this.bar(x2 - 10, y2, 20, frac, frac > 0.5 ? HP_GREEN : frac > 0.25 ? "#e0b030" : "#e03a2a");
      drawText(this.g, p.name, x2, y2 - 10, isSelf ? "#ffe9a8" : "#e8e2d4", "center");
      if (p.st) drawStatus(this.g, p.st, x2, y2 - 13, 1, this.time);
      this.g.fillStyle = "#050405";
      this.g.fillRect(x2 - 13 - 1, y2 - 1, 3, 4);
      this.g.fillStyle = p.color;
      this.g.fillRect(x2 - 13, y2, 1, 2);
    }
    /** Interface options: always-show toggle (else only while the show-labels key is held) and the rarity filter. */
    labelVisible(item) {
      const ui = getSettings().interface;
      if (input.showLabels) return true;
      if (!ui.alwaysShowLabels) return false;
      if (ui.hideNormal && item.r === 0 || ui.hideMagic && item.r === 1) return itemCategory(item) !== "gear";
      return true;
    }
    /** Item name labels (also used for hover / click hit-testing, in low-res pixels). */
    drawLootLabels(v2) {
      const { g } = this;
      this.labels = [];
      const sorted = [...v2.ground].sort((a, b) => a.y - b.y);
      for (const gi of sorted) {
        if (!gi.item || !this.onScreen(gi.x, gi.y, 40) || !this.labelVisible(gi.item)) continue;
        const text = gi.item.n;
        const tw = textWidth(text) + 6;
        const sx = this.sx(gi.x, gi.y);
        const sy = this.sy(gi.x, gi.y);
        const rect = { g: gi.g, x: sx - Math.floor(tw / 2), y: sy - this.up(30), w: tw, h: FONT_H + 4 };
        for (let i = 0; i < 8 && this.labels.some((l) => l.x < rect.x + rect.w && rect.x < l.x + l.w && l.y < rect.y + rect.h + 1 && rect.y < l.y + l.h + 1); i++) {
          rect.y -= rect.h + 1;
        }
        this.labels.push(rect);
        const hover = v2.hoverG === gi.g;
        const inRange = v2.self ? Math.hypot(v2.self.x - gi.x, v2.self.y - gi.y) <= PICKUP_RANGE : false;
        g.fillStyle = hover ? "rgba(46,38,30,0.95)" : "rgba(8,6,6,0.82)";
        g.fillRect(rect.x, rect.y, rect.w, rect.h);
        g.fillStyle = hover ? "#e8d8b0" : inRange ? "rgba(232,216,176,0.55)" : "rgba(232,216,176,0.16)";
        g.fillRect(rect.x, rect.y, rect.w, 1);
        g.fillRect(rect.x, rect.y + rect.h - 1, rect.w, 1);
        g.fillRect(rect.x, rect.y, 1, rect.h);
        g.fillRect(rect.x + rect.w - 1, rect.y, 1, rect.h);
        drawText(g, text, rect.x + 3, rect.y + 2, RARITY_COLORS[gi.item.r], "left", 1, "");
      }
    }
    // ---- HUD ---------------------------------------------------------------
    drawHud(v2) {
      const { g, lw, lh } = this;
      if (this.mapOverlayOpen && !this.bigMapOpen) this.drawMapOverlay(v2);
      const cx = Math.floor(lw / 2);
      drawText(g, `ALIVE ${v2.alive}/${v2.total}`, 5, 5, "#d8ccb0");
      const gs = getSettings().graphics;
      if (gs.showPing || !v2.connected) drawText(g, v2.connected ? `${Math.round(v2.ping)}MS` : "DISCONNECTED", 5, 14, v2.ping > 150 || !v2.connected ? "#ffb347" : "#7f8c6c");
      if (gs.showFps) drawText(g, `${Math.round(this.fps)} FPS`, gs.showPing ? 40 : 5, 14, "#7f8c6c");
      if (v2.phase === "waiting") {
        drawText(g, `PRACTICE - WAITING FOR PLAYERS (${v2.total}/${MIN_PLAYERS_FOR_ROUND})`, cx, 6, "#c8b080", "center");
      } else if (v2.phase === "countdown") {
        drawTitle(g, "THE ROUND BEGINS", cx, Math.floor(lh / 2) - 74, "center", 1, TITLE_BONE);
        drawTitle(g, String(Math.max(1, Math.ceil(v2.phaseLeft))), cx, Math.floor(lh / 2) - 54, "center", 3, TITLE_BLOOD);
      } else if (v2.phase === "ended") {
        drawTitle(g, v2.winner ? `${v2.winner} PREVAILS` : "NONE SURVIVED", cx, Math.floor(lh / 2) - 66, "center", 2, TITLE_EMBER);
        drawText(g, `NEXT ROUND IN ${Math.ceil(v2.phaseLeft)}`, cx, Math.floor(lh / 2) - 30, "#d8ccb0", "center");
      }
      if (this.bannerFlash) {
        g.globalAlpha = Math.max(0, 1 - this.bannerFlash.t / 1.2);
        drawTitle(g, this.bannerFlash.text, cx, Math.floor(lh / 2) - 70, "center", this.bannerFlash.t < 0.12 ? 4 : 3, TITLE_BLOOD);
        g.globalAlpha = 1;
      }
      if (!v2.self?.alive) {
        const who = v2.spectating ? `SPECTATING ${v2.spectating.name}` : "SPECTATING";
        const why = v2.phase === "waiting" ? " - RESPAWNING SOON" : v2.phase === "fight" ? " - WAIT FOR THE NEXT ROUND" : "";
        drawText(g, who + why, cx, lh - 52, "#c8bca8", "center");
      }
      if (v2.self) this.drawPanel(v2);
      const mm = this.drawMinimap(v2);
      let fy = mm + 6;
      for (const f of this.feed) {
        g.globalAlpha = Math.min(1, (FEED_TIME - f.t) / 1);
        drawText(g, f.text, lw - 5, fy, f.color, "right");
        fy += 9;
      }
      g.globalAlpha = 1;
      if (v2.showScoreboard) this.drawScoreboard(v2.board, v2.selfId);
      else {
        g.globalAlpha = 0.4;
        drawText(g, "TAB SCORES  I BAG  F LOOT", 5, 24, "#d8ccb0");
        g.globalAlpha = 1;
      }
      if (this.bigMapOpen) this.drawBigMap(v2);
    }
    /** Bottom panel: life globe, flask belt + dodge cooldown, and the (dormant) mana globe. */
    drawPanel(v2) {
      const { g, lw, lh } = this;
      const self2 = v2.self;
      const GR = 19;
      const PW = Math.min(lw - 6, 300);
      const PH = 26;
      const px0 = Math.floor(lw / 2 - PW / 2);
      const py0 = lh - PH;
      g.drawImage(panelSprite(PW, PH), px0, py0 - PANEL_SPIKE);
      const gy = lh - GR - 4;
      const frac = Math.max(0, Math.min(1, self2.hp / v2.selfStats.maxHp));
      const low = frac < 0.3 && Math.floor(this.time * 4) % 2 === 0;
      this.globe(px0 + GR + 3, gy, frac, low ? "#d0241a" : "#a3140f", 1);
      drawEsGlobe(g, px0 + GR + 3, gy, GR, self2.es, self2.esm, this.time);
      if (getSettings().interface.globeNumbers) drawText(g, `${Math.ceil(self2.hp)}`, px0 + GR + 3, gy - 3, "#f2e2cc", "center");
      this.globe(px0 + PW - GR - 4, gy, manaFrac(), "#2a46b0", 0.9);
      if (getSettings().interface.globeNumbers) drawText(g, `${manaNow()}`, px0 + PW - GR - 4, gy - 3, "#dce6ff", "center");
      const bx0 = px0 + GR * 2 + 12;
      const bx1 = px0 + PW - GR * 2 - 12;
      g.fillStyle = "#1c120b";
      g.fillRect(bx0, py0 + 7, bx1 - bx0, 6);
      g.fillStyle = "#3a2615";
      g.fillRect(bx0, py0 + 8, bx1 - bx0, 4);
      g.fillStyle = "#5a3d22";
      for (let x2 = bx0 + 2; x2 < bx1 - 1; x2 += 4) g.fillRect(x2, py0 + 8, 2, 1);
      const size2 = 18;
      const gap = 5;
      const fx0 = Math.floor((bx0 + bx1) / 2 - (MAX_FLASK_SLOTS * size2 + (MAX_FLASK_SLOTS - 1) * gap) / 2);
      for (let i = 0; i < MAX_FLASK_SLOTS; i++) {
        const x2 = fx0 + i * (size2 + gap);
        const y2 = py0 + 1;
        const locked = i >= v2.selfStats.flaskSlots;
        const f = v2.flasks[i];
        pxFrame(g, x2, y2, size2, size2, locked ? "#080708" : "#0f0d10", f && !locked ? RARITY_COLORS[f.r] : "#3c3842");
        if (f && !locked) {
          const props = flaskProps(f, v2.selfStats.flaskRecovery);
          const fr = Math.min(1, (f.c ?? 0) / props.maxCharges);
          const usable = (f.c ?? 0) >= props.perUse;
          g.drawImage(flaskIcon(fr, usable), x2 + 3, y2 + 3);
          drawText(g, String(Math.floor(f.c ?? 0)), x2 + size2 - 2, y2 + size2 - 8, "#e8dcc4", "right");
        }
        drawText(g, locked ? "-" : String(i + 1), x2 + 3, y2 + 2, locked ? "#4a4248" : "#d8c08a");
      }
      const dfrac = Math.min(1, 1 - self2.rollCd / v2.selfStats.dodgeCooldown);
      const dw = bx1 - bx0;
      g.fillStyle = "#050405";
      g.fillRect(bx0 - 1, py0 + 20, dw + 2, 4);
      g.fillStyle = "#101820";
      g.fillRect(bx0, py0 + 21, dw, 2);
      g.fillStyle = dfrac >= 1 ? "#7cc4e4" : "#2c5a74";
      g.fillRect(bx0, py0 + 21, Math.round(dw * dfrac), 2);
      if (dfrac >= 1) {
        g.fillStyle = "#d8f2ff";
        g.fillRect(bx0, py0 + 21, dw, 1);
      }
    }
    globe(cx, cy, frac, color, dim) {
      const { g } = this;
      const R8 = 19;
      const S3 = R8 * 2 + 1;
      g.drawImage(globeBack(R8), cx - R8, cy - R8);
      const top = Math.round((1 - frac) * S3);
      if (top < S3) {
        g.drawImage(globeLiquid(R8, color, dim), 0, top, S3, S3 - top, cx - R8, cy - R8 + top, S3, S3 - top);
        if (top > 0) {
          const dy = top - R8;
          const hw = Math.floor(Math.sqrt(Math.max(0, R8 * R8 - dy * dy)));
          g.fillStyle = dim < 1 ? "#4058a0" : "#ff6a50";
          g.globalAlpha = 0.7;
          const ph = Math.floor(this.time * 6);
          for (let x2 = -hw; x2 <= hw; x2++) if ((x2 + ph) % 3 !== 0) g.fillRect(cx + x2, cy - R8 + top, 1, 1);
          g.globalAlpha = 1;
        }
      }
      g.drawImage(globeFrame(R8), cx - R8 - 5, cy - R8 - 8);
    }
    /**
     * Draw the cached overview with the camera's projection (45-degree turn + ground foreshortening,
     * gfx/iso) so map views line up with the game view. World (wx, wy) lands at screen (ox, oy);
     * k = screen px per projected world unit.
     */
    drawOverviewIso(ox, oy, wx, wy, k) {
      const { g } = this;
      const cell2 = currentMap().cell;
      const a = isoX(1, 0) * k;
      const b = isoY(1, 0) * k;
      const c = isoX(0, 1) * k;
      const d = isoY(0, 1) * k;
      g.save();
      g.transform(a * cell2, b * cell2, c * cell2, d * cell2, ox - (a * wx + c * wy), oy - (b * wx + d * wy));
      g.imageSmoothingEnabled = true;
      g.drawImage(this.overview(), 0, 0);
      g.restore();
    }
    /** Top-right minimap: local window of the cached overview, rotated like the camera; returns its bottom edge. */
    drawMinimap(v2) {
      const { g, lw } = this;
      const ui = getSettings().interface;
      const size2 = Math.round(Math.max(48, Math.min(72, Math.floor(lw * 0.13))) * (ui.minimapSize || 1));
      const x0 = lw - size2 - 6;
      const y0 = 6;
      const self2 = v2.self ?? (v2.selfId >= 0 ? v2.players.get(v2.selfId) : void 0);
      const cx = self2 ? self2.x : v2.camX;
      const cy = self2 ? self2.y : v2.camY;
      const span = 3600;
      const k = size2 / (span * K);
      const ox = x0 + size2 / 2;
      const oy = y0 + size2 / 2;
      g.save();
      g.globalAlpha = Math.max(0.2, Math.min(1, ui.minimapOpacity ?? 1));
      pxFrame(g, x0 - 2, y0 - 2, size2 + 4, size2 + 4, "#0c0b0d", "#4a4652");
      g.beginPath();
      g.rect(x0, y0, size2, size2);
      g.clip();
      g.fillStyle = currentMap().biome.palette.mapWall;
      g.fillRect(x0, y0, size2, size2);
      this.drawOverviewIso(ox, oy, cx, cy, k);
      const to = (x2, y2) => ({ x: ox + isoX(x2 - cx, y2 - cy) * k, y: oy + isoY(x2 - cx, y2 - cy) * k });
      this.drawMapMarkers(v2, to, 1);
      const corners = [
        [0, 0],
        [this.ww, 0],
        [this.ww, this.wh],
        [0, this.wh]
      ].map(([a, b]) => unproject(a - this.offX, b - this.offY));
      for (let i = 0; i < 4; i++) {
        const a = to(corners[i].x, corners[i].y);
        const b = to(corners[(i + 1) % 4].x, corners[(i + 1) % 4].y);
        pxLine(g, a.x, a.y, b.x, b.y, "rgba(255,255,255,0.22)");
      }
      g.restore();
      g.globalAlpha = 1;
      return y0 + size2 + 2;
    }
    /** POIs, camps and players on a map view; to() maps world -> screen. */
    drawMapMarkers(v2, to, k) {
      const { g } = this;
      for (const p of getPois()) {
        const col3 = p.kind === "trial" ? "#7fc8ff" : p.kind === "boss" ? "#ff5a3c" : p.kind === "buff" ? "#b48cff" : null;
        if (!col3) continue;
        const q = to(p.x, p.y);
        g.fillStyle = "#050405";
        g.fillRect(Math.round(q.x) - 2 * k, Math.round(q.y) - 2 * k, 4 * k + 1, 4 * k + 1);
        g.fillStyle = col3;
        g.fillRect(Math.round(q.x) - k, Math.round(q.y) - k, 2 * k + 1, 2 * k + 1);
      }
      for (const c of v2.camps) {
        if (c.n === 0) continue;
        g.fillStyle = c.e ? "#ffb347" : "#c8402e";
        const q = to(c.x, c.y);
        const r = (c.e ? 3 : 2) * k;
        g.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, r, r);
      }
      for (const p of v2.players.values()) {
        if (!p.alive) continue;
        const q = to(p.x, p.y);
        const px = Math.round(q.x);
        const py = Math.round(q.y);
        if (p.id === v2.selfId) {
          g.fillStyle = "#ffffff";
          g.fillRect(px - 2 * k, py - 2 * k, 4 * k + 1, 4 * k + 1);
        }
        g.fillStyle = p.color;
        g.fillRect(px - k, py - k, 2 * k + 1, 2 * k + 1);
      }
    }
    /** Translucent full-screen overlay: the overview rotated like the camera, centred on the player. */
    drawMapOverlay(v2) {
      const { g, lw, lh } = this;
      const self2 = v2.self ?? (v2.selfId >= 0 ? v2.players.get(v2.selfId) : void 0);
      const cx = self2 ? self2.x : v2.camX;
      const cy = self2 ? self2.y : v2.camY;
      const k = lw / (9e3 * K);
      const ox = lw / 2;
      const oy = lh / 2;
      g.save();
      g.globalAlpha = 0.42;
      this.drawOverviewIso(ox, oy, cx, cy, k);
      g.globalAlpha = 0.9;
      this.drawMapMarkers(v2, (x2, y2) => ({ x: ox + isoX(x2 - cx, y2 - cy) * k, y: oy + isoY(x2 - cx, y2 - cy) * k }), 1);
      g.restore();
    }
    /** Full world map overlay (M / Esc closes), projected like the camera (a diamond). */
    drawBigMap(v2) {
      const { g, lw, lh } = this;
      const m = currentMap();
      const boxW = Math.floor(lw * 0.9);
      const boxH = Math.floor(lh * 0.86);
      const bx = Math.floor(lw / 2 - boxW / 2);
      const by = Math.floor(lh / 2 - boxH / 2);
      const projW = isoX(m.w, 0) - isoX(0, m.h);
      const projH = isoY(m.w, m.h) - isoY(0, 0);
      const k = Math.min(boxW / projW, boxH / projH);
      const ox = lw / 2;
      const oy = lh / 2;
      const wx = m.w / 2;
      const wy = m.h / 2;
      g.save();
      g.globalAlpha = 0.9;
      pxFrame(g, bx - 3, by - 3, boxW + 6, boxH + 6, "#07070a", "#6b5739");
      g.globalAlpha = 0.95;
      this.drawOverviewIso(ox, oy, wx, wy, k);
      g.globalAlpha = 1;
      this.drawMapMarkers(v2, (x2, y2) => ({ x: ox + isoX(x2 - wx, y2 - wy) * k, y: oy + isoY(x2 - wx, y2 - wy) * k }), 1);
      drawText(g, m.biome.name.toUpperCase(), bx + 6, by + 6, "#e8e2d4");
      g.restore();
    }
    drawScoreboard(rowsIn, selfId2) {
      const { g, lw, lh } = this;
      const rows = [...rowsIn].sort((a, b) => b.wins - a.wins || b.kills - a.kills);
      const bw = 200;
      const rh = 10;
      const bh = 28 + rows.length * rh;
      const bx = Math.floor(lw / 2 - bw / 2);
      const by = Math.max(10, Math.floor(lh / 2 - bh / 2));
      pxFrame(g, bx, by, bw, bh, "rgba(14,10,9,0.94)");
      drawText(g, "PLAYER", bx + 8, by + 7, "#9a8f7a");
      drawText(g, "KILLS", bx + 140, by + 7, "#9a8f7a", "right");
      drawText(g, "WINS", bx + bw - 8, by + 7, "#9a8f7a", "right");
      rows.forEach((p, i) => {
        const y2 = by + 20 + i * rh;
        g.fillStyle = "#050405";
        g.fillRect(bx + 7, y2, 5, 5);
        g.fillStyle = p.color;
        g.fillRect(bx + 8, y2 + 1, 3, 3);
        const col3 = p.id === selfId2 ? "#ffe08a" : p.alive ? "#e8e2d4" : "#7a7268";
        drawText(g, p.name, bx + 16, y2, col3);
        drawText(g, String(p.kills), bx + 140, y2, col3, "right");
        drawText(g, String(p.wins), bx + bw - 8, y2, col3, "right");
      });
    }
  };

  // src/client/showcase.ts
  var canvas = document.getElementById("game");
  var renderer = new Renderer(canvas);
  var R7 = renderer;
  addLayer("ground", (g, c) => drawDecals(g, c, c.time));
  addLayer("over", (g, c) => drawParticles(g, c, false));
  addLayer("fx", (g, c) => drawParticles(g, c, true));
  var players2 = /* @__PURE__ */ new Map();
  var monsters2 = /* @__PURE__ */ new Map();
  var projs = /* @__PURE__ */ new Map();
  var hazards = [];
  var camps = [];
  var events = [];
  var self = null;
  var center = { x: 0, y: 0 };
  var biomeIdx = 0;
  var panAmp = 40;
  var SOUTH = dirToWorldAngle(2, 8);
  var SE = dirToWorldAngle(1, 8);
  function useBiome(i) {
    biomeIdx = (i % BIOMES.length + BIOMES.length) % BIOMES.length;
    setMap({ seed: 4242 + biomeIdx * 17, players: 10, biome: BIOMES[biomeIdx].id });
    clearDecals();
  }
  function at(sx, sy) {
    const o = unproject(sx, sy);
    return { x: center.x + o.x, y: center.y + o.y };
  }
  function findClearing(rad4) {
    const m = currentMap();
    const spots = getCampSpots();
    const cands = [];
    for (const s of spots) cands.push({ x: s.x, y: s.y });
    for (let i = 0; i < 400; i++) cands.push({ x: i * 7919 % 997 / 997 * m.w * 0.8 + m.w * 0.1, y: i * 104729 % 991 / 991 * m.h * 0.8 + m.h * 0.1 });
    let best = cands[0] ?? { x: m.w / 2, y: m.h / 2 };
    let bestScore = -1;
    for (const c of cands) {
      let ok = 0;
      for (let a = 0; a < 16; a++)
        for (const k of [0.35, 0.7, 1]) if (isWalkable(c.x + Math.cos(a / 16 * Math.PI * 2) * rad4 * k, c.y + Math.sin(a / 16 * Math.PI * 2) * rad4 * k, 20)) ok++;
      if (ok > bestScore) {
        bestScore = ok;
        best = c;
        if (ok === 48) break;
      }
    }
    return best;
  }
  function player(id, name, color, lk, wk, x2, y2, angle) {
    return {
      id,
      name,
      color,
      lk,
      wk,
      x: x2,
      y: y2,
      angle,
      hp: 100,
      maxHp: 100,
      mp: 60,
      atkRange: 70,
      atkArc: 1.7,
      swingTime: 0.45,
      kbx: 0,
      kby: 0,
      rollT: 0,
      rollCd: 0,
      rollDx: 0,
      rollDy: 0,
      atkT: 0,
      atkCd: 0,
      alive: true,
      lv: 12
    };
  }
  function monster(id, k, x2, y2, r, extra = {}) {
    return { id, k, x: x2, y: y2, a: SOUTH, hp: 80, mhp: 100, r, s: 0, w: 0, ...extra };
  }
  function resetEntities() {
    players2 = /* @__PURE__ */ new Map();
    monsters2 = /* @__PURE__ */ new Map();
    projs = /* @__PURE__ */ new Map();
    hazards = [];
    camps = [];
    self = null;
  }
  function addSelf(x2, y2, lk = KNIGHT, wk = "sword") {
    self = player(1, "YOU", "#e0c03a", lk, wk, x2, y2, SOUTH);
    players2.set(1, self);
  }
  var lc = (k, r = 0) => lookCode(k, Object.fromEntries(Object.keys(k).map((s) => [s, r])));
  var KNIGHT = lc({ helmet: "helm_great", body: "body_plate", gloves: "gloves_gauntlet", boots: "boots_greave", offhand: "shield_kite", weapon: "sword_long", belt: "belt_chain" }, 2);
  var GEAR = [
    { name: "NAKED", lk: NAKED_LOOK, wk: null, color: "#e0453a" },
    { name: "VAGRANT (NORMAL)", lk: lc({ helmet: "hood", body: "body_leather", gloves: "gloves_wrap", boots: "boots_wrap", weapon: "dagger", belt: "belt_rope" }, 0), wk: "dagger", color: "#3ae07a" },
    { name: "MERCENARY (MAGIC)", lk: lc({ helmet: "helm_open", body: "body_mail", gloves: "gloves_leather", boots: "boots_soft", offhand: "shield_round", weapon: "sword_short", belt: "belt_leather" }, 1), wk: "sword", color: "#3fa7e0" },
    { name: "KNIGHT (RARE)", lk: KNIGHT, wk: "sword", color: "#e0c03a" },
    { name: "JUGGERNAUT (UNIQUE)", lk: lc({ helmet: "helm_horned", body: "body_plate", gloves: "gloves_gauntlet", boots: "boots_greave", offhand: "shield_tower", weapon: "maul", belt: "belt_studded" }, 3), wk: "mace", color: "#8a4fe0" },
    { name: "MAGE ROBES (MAGIC)", lk: lc({ helmet: "circlet", body: "body_robe", gloves: "gloves_silk", boots: "boots_slipper", offhand: "focus_orb", weapon: "wand", belt: "belt_rope" }, 1), wk: "wand", color: "#5a7ae0" },
    { name: "BATTLEMAGE (RARE)", lk: lc({ helmet: "helm_open", body: "body_plate_robe", gloves: "gloves_gauntlet", boots: "boots_slipper", offhand: "focus_orb", weapon: "sceptre", belt: "belt_leather" }, 2), wk: "sceptre", color: "#e07a3a" },
    { name: "RANGER (RARE)", lk: lc({ helmet: "hood", body: "body_brigandine", gloves: "gloves_leather", boots: "boots_soft", offhand: "quiver", weapon: "bow", belt: "belt_leather" }, 2), wk: "bow", color: "#7ae03a" },
    { name: "WITCHHUNTER (UNIQUE)", lk: lc({ helmet: "coif", body: "body_scale_robe", gloves: "gloves_leather", boots: "boots_greave", weapon: "crossbow", belt: "belt_studded" }, 3), wk: "crossbow", color: "#e03a9a" }
  ];
  var WEAPONS = [
    ["sword", "sword_long", "shield_round"],
    ["axe", "greataxe", ""],
    ["mace", "mace", "shield_kite"],
    ["spear", "spear", ""],
    ["dagger", "dagger", "shield_buckler"],
    ["claw", "claw", ""],
    ["staff", "staff", ""],
    ["quarterstaff", "quarterstaff", ""],
    ["sceptre", "sceptre", "focus_orb"],
    ["wand", "wand", "focus_orb"],
    ["bow", "bow", "quiver"],
    ["crossbow", "crossbow", ""]
  ];
  var POSE_LOOK = lc({ helmet: "hood", body: "body_robe", gloves: "gloves_silk", boots: "boots_slipper", weapon: "staff", belt: "belt_rope" }, 1);
  var labels = [];
  var poseNext = /* @__PURE__ */ new Map();
  function loopPose(id, pose, ms, t4) {
    if ((poseNext.get(id) ?? 0) <= t4) {
      playPose(id, pose, ms);
      poseNext.set(id, t4 + ms / 1e3 + 0.45);
    }
  }
  var SCENES = [
    {
      name: "biomes",
      title: "BIOME TOUR",
      zoom: 0.9,
      notes: ["Real generated map chunk (shared/mapgen) + world/props renderer, lights and fog.", "B = next biome. Raised walls, smooth props and smooth fog are still in progress (look agent)."],
      setup() {
        resetEntities();
        const spots = getCampSpots();
        const s = spots.find((c) => c.tier === 1) ?? spots[0];
        center = s ? { x: s.x, y: s.y } : findClearing(200);
        camps = [{ x: center.x, y: center.y, n: 3, e: true }];
        addSelf(center.x - 110, center.y + 90);
        const ks = MONSTER_KINDS;
        [[40, -20], [-30, 30], [10, 50]].forEach(([dx, dy], i) => monsters2.set(100 + i, monster(100 + i, ks[i % ks.length], center.x + dx, center.y + dy, [15, 16, 28][i % 3])));
        panAmp = 110;
      },
      tick(t4) {
        if (self) {
          const a = t4 * 0.35;
          self.x = center.x + Math.cos(a) * 130;
          self.y = center.y + Math.sin(a) * 130;
          self.angle = a + Math.PI / 2;
        }
      }
    },
    {
      name: "lineup",
      title: "CHARACTER LINEUP",
      zoom: 1.3,
      notes: GEAR.map((g, i) => `${i + 1}. ${g.name}`).concat(["Paper-doll: helmet, body, gloves, boots, weapon, off-hand, belt. Rarity tints: normal / magic / rare / unique."]),
      setup() {
        resetEntities();
        center = findClearing(320);
        GEAR.forEach((g, i) => {
          const p = at((i - (GEAR.length - 1) / 2) * 58, i % 2 * 22 - 10);
          const pl = player(10 + i, g.name, g.color, g.lk, g.wk, p.x, p.y, SOUTH);
          players2.set(pl.id, pl);
          if (i === 3) self = pl;
        });
        panAmp = 18;
      },
      tick(t4) {
        labels = [];
        GEAR.forEach((g, i) => {
          const p = players2.get(10 + i);
          const d = Math.floor(t4 / 1.6 + 2) % 16;
          p.angle = Math.floor(t4 / 9.6) % 2 === 0 ? SOUTH : dirToWorldAngle(d / 2, 8);
          labels.push({ ...p, text: String(i + 1) });
        });
      }
    },
    {
      name: "weapons",
      title: "WEAPONS + SKILL POSES",
      zoom: 1,
      notes: ["Top two rows: one hero per weapon kind looping attack / attack2.", "Bottom row: skill poses cast_forward, cast_raise, channel, slam, leap, throw, buff, summon."],
      setup() {
        resetEntities();
        center = findClearing(360);
        WEAPONS.forEach(([wk, wl, oh], i) => {
          const row = Math.floor(i / 6);
          const col3 = i % 6;
          const p = at((col3 - 2.5) * 100, row * 105 - 125);
          const pl = player(20 + i, wk.toUpperCase(), "#c8a060", lc({ helmet: "helm_open", body: "body_mail", gloves: "gloves_leather", boots: "boots_soft", weapon: wl, offhand: oh, belt: "belt_leather" }, 1), wk, p.x, p.y, SE);
          pl.swingTime = wk === "bow" || wk === "crossbow" ? 0.6 : 0.45;
          players2.set(pl.id, pl);
        });
        SKILL_POSES.forEach((pose, i) => {
          const p = at((i - 3.5) * 76, 100);
          const pl = player(40 + i, pose.toUpperCase(), "#5a7ae0", POSE_LOOK, "staff", p.x, p.y, SOUTH);
          players2.set(pl.id, pl);
        });
        self = players2.get(20);
        panAmp = 20;
      },
      tick(t4) {
        labels = [];
        WEAPONS.forEach(([wk], i) => {
          const p = players2.get(20 + i);
          const per = p.swingTime + 0.35;
          const ph = (t4 + i * 0.13) % per;
          p.atkT = ph < p.swingTime ? p.swingTime - ph : 0;
          labels.push({ x: p.x, y: p.y, text: wk.toUpperCase() });
        });
        SKILL_POSES.forEach((pose, i) => {
          const p = players2.get(40 + i);
          loopPose(p.id, pose, pose === "channel" ? 1600 : 900, t4);
          labels.push({ x: p.x, y: p.y, text: pose.toUpperCase() });
        });
      }
    },
    {
      name: "monsters",
      title: "MONSTERS",
      zoom: 1.2,
      notes: [
        `Monster sprite families that exist: ${MONSTER_KINDS.join(", ")} (gfx/monsters.ts, still pixel-rig).`,
        "Rows: normal idle / moving / winding up, then elites (frenzied, ironhide, volatile, rimecloaked), rare + boss-scale.",
        "Roster families (beast, spirit, caster, brute, undead) + bosses have NO art yet (monsters agent: gfx/monsters_*.ts in progress)."
      ],
      setup() {
        resetEntities();
        center = findClearing(360);
        const R0 = { gnashling: 15, bog_seer: 16, cragback: 28 };
        const EL = { gnashling: ["frenzied"], bog_seer: ["rimecloaked"], cragback: ["ironhide", "volatile"] };
        MONSTER_KINDS.forEach((k, row) => {
          const r = R0[k] ?? 18;
          [0, 1, 2].forEach((col3) => {
            const p2 = at((col3 - 2) * 95, (row - 1) * 92);
            monsters2.set(200 + row * 10 + col3, monster(200 + row * 10 + col3, k, p2.x, p2.y, r));
          });
          const p = at(1 * 95 + 10, (row - 1) * 92);
          monsters2.set(200 + row * 10 + 3, monster(200 + row * 10 + 3, k, p.x, p.y, r * 1.15, { e: EL[k] ?? [], n: "ELITE " + k.toUpperCase(), rr: 2 }));
          const q = at(2 * 95 + 40, (row - 1) * 92);
          monsters2.set(200 + row * 10 + 4, monster(200 + row * 10 + 4, k, q.x, q.y, r * 1.7, { rr: 3, n: "BOSS-SCALE " + k.toUpperCase(), mhp: 1e3, hp: 900 }));
        });
        const s = at(-310, 0);
        addSelf(s.x, s.y);
        self.angle = dirToWorldAngle(0, 8);
        panAmp = 18;
      },
      tick(t4) {
        labels = [];
        for (const m of monsters2.values()) {
          const col3 = (m.id - 200) % 10;
          const base = m;
          if (base.bx === void 0) base.bx = m.x, base.by = m.y;
          if (col3 === 1 || col3 === 3) {
            const a = t4 * 2 + m.id;
            m.x = base.bx + Math.cos(a) * 12;
            m.y = base.by + Math.sin(a) * 12;
            m.a = a + Math.PI / 2;
            m.s = 1;
          } else if (col3 === 2 || col3 === 4) {
            const ph = (t4 + m.id * 0.1) % 2.2;
            m.s = ph < 1 ? 2 : 1;
            m.w = ph < 1 ? ph : 0;
            m.a = SOUTH;
          } else m.a = SOUTH;
        }
      }
    },
    {
      name: "combat",
      title: "COMBAT + VFX + GORE",
      zoom: 1.25,
      notes: [
        "Melee swing arcs, hit sparks + damage numbers, telegraphed slam hazards, explosions, projectiles, deaths.",
        "Gore: gfx/gore decals/pools/particles (blood, ichor, scorch, frost, lightning burn) hooked via view.ts layers.",
        "Not yet drawn by the game: skill VFX for SkillFx events, ailment visuals (ignite/freeze/shock overlays)."
      ],
      setup() {
        resetEntities();
        center = findClearing(300);
        addSelf(center.x, center.y, GEAR[4].lk, "mace");
        const ally = at(-120, 20);
        players2.set(2, player(2, "RIVAL", "#3fa7e0", GEAR[7].lk, "bow", ally.x, ally.y, SE));
        const ks = MONSTER_KINDS;
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * Math.PI * 2;
          monsters2.set(300 + i, monster(300 + i, ks[i % ks.length], center.x + Math.cos(a) * 70, center.y + Math.sin(a) * 70, ks[i % ks.length] === "cragback" ? 28 : 15));
        }
        panAmp = 25;
      },
      tick(t4, dt) {
        const me = self;
        const per = 0.8;
        const ph = t4 % per;
        me.atkT = ph < me.swingTime ? me.swingTime - ph : 0;
        const ms = [...monsters2.values()];
        const tgt = ms[Math.floor(t4 / per) % Math.max(1, ms.length)];
        if (tgt) me.angle = Math.atan2(tgt.y - me.y, tgt.x - me.x);
        for (const m of ms) {
          m.a = Math.atan2(me.y - m.y, me.x - m.x);
          const w = (t4 * 0.6 + m.id * 0.37) % 1.6;
          m.s = w < 1 ? 2 : 1;
          m.w = w < 1 ? w : 0;
        }
        const prevPh = (t4 - dt) % per;
        if (tgt && prevPh < me.swingTime * 0.55 && ph >= me.swingTime * 0.55) {
          const dx = Math.cos(me.angle);
          const dy = Math.sin(me.angle);
          const crit = Math.random() < 0.4;
          events.push({ k: "hit", x: tgt.x, y: tgt.y, target: tgt.id, by: 1, dmg: crit ? 48 + Math.random() * 20 : 14 + Math.random() * 10, m: 1, dt: "p", cr: crit ? 1 : void 0, dx, dy, fo: "melee" });
          goreHit(tgt.x, tgt.y, dx, dy, tgt.k === "cragback" ? M_ICHOR : M_BLOOD, crit);
          tgt.hp = Math.max(5, tgt.hp - 15);
          if (tgt.hp <= 5) {
            events.push({ k: "mdie", id: tgt.id, mk: tgt.k, x: tgt.x, y: tgt.y, r: tgt.r, a: tgt.a, dx, dy, ok: 30 });
            addPool(tgt.x, tgt.y, tgt.r * 1.6, M_BLOOD, 3);
            monsters2.delete(tgt.id);
            const id = tgt.id + 50;
            const a2 = Math.random() * Math.PI * 2;
            setTimeout(() => {
              if (scene2 !== 4) return;
              monsters2.set(id, monster(id, tgt.k, center.x + Math.cos(a2) * 75, center.y + Math.sin(a2) * 75, tgt.r));
            }, 1500);
          }
        }
        const hz = t4 % 3 / 2.2;
        const hp = at(110, -40);
        hazards = hz <= 1 ? [{ id: 1, x: hp.x, y: hp.y, r: 70, f: hz }] : [];
        if (Math.floor((t4 - dt) / 3) !== Math.floor(t4 / 3)) {
          events.push({ k: "boom", x: hp.x, y: hp.y, r: 70 });
          stamp(hp.x, hp.y, 70, (g) => paintScorch(g, 60, Math.random() * 1e6));
          for (let i = 0; i < 30; i++) spawnP(P_EMBER, M_CHAR, hp.x, hp.y, 4, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, 100 + Math.random() * 200, 0.8, 2);
        }
        const rival = players2.get(2);
        const pt = t4 * 0.9 % 1;
        const a = -0.5;
        rival.angle = a;
        projs = /* @__PURE__ */ new Map([[1, { id: 1, x: rival.x + Math.cos(a) * 260 * pt, y: rival.y + Math.sin(a) * 260 * pt, r: 6 }]]);
        if (Math.floor((t4 - dt) * 0.25) !== Math.floor(t4 * 0.25)) {
          const f = at(-60, 90);
          stamp(f.x, f.y, 50, (g) => paintFrost(g, 45, Math.random() * 1e6));
          const l = at(60, 95);
          stamp(l.x, l.y, 50, (g) => paintLichtenberg(g, 45, Math.random() * 1e6));
          for (let i = 0; i < 16; i++) spawnP(P_SPARK, M_ICE, f.x, f.y, 6, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 60 + Math.random() * 120, 0.5, 1.5);
        }
        if (Math.floor((t4 - dt) / 5) !== Math.floor(t4 / 5)) events.push({ k: "heal", target: 1 });
      }
    },
    {
      name: "hud",
      title: "HUD",
      zoom: 1,
      notes: ["Life + mana globes, flask belt, minimap, kill feed, damage numbers - the live HUD pass of render.ts.", "HUD globes / panels / font are still pixel art (smooth conversion pending, look agent).", "Skill bar is drawn by the skills UI (DOM), not by the canvas renderer - not shown here."],
      setup() {
        resetEntities();
        const spots = getCampSpots();
        const s = spots[1] ?? spots[0];
        center = s ? { x: s.x + 160, y: s.y } : findClearing(200);
        camps = s ? [{ x: s.x, y: s.y, n: 3, e: false }] : [];
        addSelf(center.x, center.y, GEAR[6].lk, "sceptre");
        self.hp = 64;
        self.mp = 35;
        const ks = MONSTER_KINDS;
        for (let i = 0; i < 3; i++) monsters2.set(400 + i, monster(400 + i, ks[i % ks.length], center.x - 120 + i * 40, center.y + 20 - i * 30, [15, 16, 28][i]));
        players2.set(3, player(3, "GRIMWALD", "#8a4fe0", GEAR[4].lk, "mace", center.x + 120, center.y + 60, SOUTH));
        panAmp = 30;
      },
      tick(t4, dt) {
        if (Math.floor((t4 - dt) / 2) !== Math.floor(t4 / 2)) {
          events.push({ k: "kill", killer: "GRIMWALD", victim: ["ASHA", "BRUNO", "KEL", "VOSS"][Math.floor(t4 / 2) % 4], vid: 999, x: center.x + 500, y: center.y + 500 });
          events.push({ k: "hit", x: self.x, y: self.y, target: 1, by: 3, dmg: 9, dt: "p" });
        }
      }
    }
  ];
  function goreHit(x2, y2, dx, dy, mat2, crit) {
    const n2 = crit ? 26 : 12;
    for (let i = 0; i < n2; i++) {
      const sp = 80 + Math.random() * (crit ? 260 : 160);
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.3;
      spawnP(P_DROP, mat2, x2, y2, 18, Math.cos(a) * sp, Math.sin(a) * sp, 60 + Math.random() * 160, 1.2, 1 + Math.random() * 2);
    }
    for (let i = 0; i < 4; i++) spawnP(P_MIST, mat2, x2, y2, 18, dx * 40, dy * 40, 20, 0.5, 6);
    stamp(x2 + dx * 20, y2 + dy * 20, 30, (g) => paintSplat(g, mat2, crit ? 18 : 11, dx, dy, Math.random() * 1e6, crit ? 0.9 : 0.5));
  }
  var scene2 = 0;
  var t3 = 0;
  var paused = false;
  var last = performance.now();
  function setZoom(z2) {
    R7.zoom = R7.zoomTarget = z2;
    R7.applyZoom();
  }
  function setScene(i) {
    scene2 = (i % SCENES.length + SCENES.length) % SCENES.length;
    t3 = 0;
    labels = [];
    poseNext.clear();
    clearDecals();
    setSetting("interface", "playerLabels", scene2 === 1 || scene2 === 2 ? "off" : "all");
    SCENES[scene2].setup();
    setZoom(SCENES[scene2].zoom);
    R7.camSX = NaN;
    document.querySelectorAll("#bar button[data-s]").forEach((b) => b.classList.toggle("on", Number(b.dataset.s) === scene2));
  }
  var stats = defaultStats();
  function view() {
    const pan = { x: center.x + Math.cos(t3 * 0.12) * panAmp, y: center.y + Math.sin(t3 * 0.12) * panAmp * 0.6 };
    return {
      selfId: self?.id ?? -1,
      self,
      selfStats: stats,
      players: players2,
      monsters: monsters2,
      projs,
      hazards,
      ground: [],
      flasks: [null, null, null],
      phase: "fight",
      phaseLeft: 0,
      winner: null,
      alive: 7,
      total: 10,
      ping: 32,
      camX: scene2 === 0 ? (self?.x ?? pan.x) * 0.5 + pan.x * 0.5 : pan.x,
      camY: scene2 === 0 ? (self?.y ?? pan.y) * 0.5 + pan.y * 0.5 : pan.y,
      spectating: null,
      showScoreboard: false,
      connected: true,
      board: [],
      camps,
      hoverG: -1
    };
  }
  function overlay() {
    const c = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    c.save();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W3 = canvas.width / dpr;
    const sc = SCENES[scene2];
    const toScreen = (x2, y2) => {
      const r = renderer;
      return { x: r.sx(x2, y2) * r.Z / r.rs / dpr, y: r.sy(x2, y2) * r.Z / r.rs / dpr };
    };
    c.font = "600 11px Georgia, 'Times New Roman', serif";
    c.textAlign = "center";
    for (const l of labels) {
      const p = toScreen(l.x, l.y);
      c.fillStyle = "rgba(0,0,0,0.55)";
      const w = c.measureText(l.text).width + 10;
      c.fillRect(p.x - w / 2, p.y + 8, w, 16);
      c.fillStyle = "#e8d8b0";
      c.fillText(l.text, p.x, p.y + 20);
    }
    const biome = scene2 === 0 ? ` - ${BIOMES[biomeIdx].name.toUpperCase()}` : "";
    c.textAlign = "left";
    const lines = sc.notes;
    c.font = "12px Georgia, serif";
    const bw = Math.min(W3 - 32, Math.max(380, ...lines.map((l) => c.measureText(l).width + 28)));
    const bh = 44 + lines.length * 16;
    const bx = Math.round((W3 - bw) / 2);
    const by = 44;
    const grd = c.createLinearGradient(0, by, 0, by + bh);
    grd.addColorStop(0, "rgba(18,12,10,0.86)");
    grd.addColorStop(1, "rgba(8,6,6,0.78)");
    c.fillStyle = grd;
    c.fillRect(bx, by, bw, bh);
    c.strokeStyle = "rgba(160,120,70,0.7)";
    c.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    c.font = "700 17px Georgia, serif";
    c.fillStyle = "#ffd88a";
    c.fillText(`${scene2 + 1} / ${SCENES.length}   ${sc.title}${biome}`, bx + 14, by + 25);
    c.font = "12px Georgia, serif";
    c.fillStyle = "#cfc4ae";
    lines.forEach((l, i) => c.fillText(l, bx + 14, by + 46 + i * 16));
    c.restore();
  }
  function frame() {
    const now4 = performance.now();
    const dt = Math.min(0.05, (now4 - last) / 1e3);
    last = now4;
    if (!paused) {
      t3 += dt;
      SCENES[scene2].tick(t3, dt);
      updateDecals(dt);
      stepParticles(dt);
    }
    if (events.length) renderer.onEvents(events, self?.id ?? -1);
    events = [];
    if (innerWidth > 200 && innerHeight > 150) {
      try {
        renderer.draw(view(), paused ? 1e-4 : dt);
      } catch (e) {
        const r = renderer;
        Object.assign(r, { g: r.worldG, lw: r.ww, lh: r.wh, hr: 1 });
        console.error("draw", e);
      }
      overlay();
    }
    requestAnimationFrame(frame);
  }
  var bar = document.getElementById("bar");
  SCENES.forEach((s, i) => {
    const b = document.createElement("button");
    b.textContent = `${i + 1} ${s.title}`;
    b.dataset.s = String(i);
    b.onclick = () => setScene(i);
    bar.appendChild(b);
  });
  var bb = document.createElement("button");
  bb.textContent = "B  next biome";
  bb.onclick = () => {
    useBiome(biomeIdx + 1);
    setScene(scene2);
  };
  bar.appendChild(bb);
  window.addEventListener("keydown", (e) => {
    const n2 = Number(e.key);
    if (n2 >= 1 && n2 <= SCENES.length) setScene(n2 - 1);
    else if (e.key === "b" || e.key === "B") bb.click();
    else if (e.key === " ") paused = !paused;
    else if (e.key === "h" || e.key === "H") bar.classList.toggle("hide");
  });
  async function shot(name) {
    const data = canvas.toDataURL("image/jpeg", 0.9);
    const r = await fetch("/__save?name=" + encodeURIComponent(name), { method: "POST", body: data });
    return r.status + " " + await r.text();
  }
  Object.assign(window, {
    showcase: { setScene, useBiome: (i) => (useBiome(i), setScene(scene2)), shot, pause: (p) => paused = p, state: () => ({ scene: scene2, biome: BIOMES[biomeIdx].id, t: t3 }) }
  });
  useBiome(0);
  setScene(Number(new URLSearchParams(location.search).get("scene") ?? 1) - 1);
  requestAnimationFrame(frame);
})();
