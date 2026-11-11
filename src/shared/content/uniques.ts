// Unique items: fixed, build-defining modifiers on an existing base (rarity 3). Every name and line of
// flavour text is original. Mod ids are "u_<unique id>_<index>"; values roll within [min, max].
// `look` is a hint for the art agent (tint / glow colour and an effect family).
//
// PoE2 structure: a unique is a fixed base + fixed mod lines with value ranges (Divine-style rerolls
// stay inside them), one or more lines that define a build, often paired with a drawback; uniques
// exist for every slot class: weapons, armour of every defence family, jewellery, belts, flasks,
// charms and jewels (including "timeless"-style radius jewels). Bases may be gear (bases.ts), flasks
// (flasks.ts), charms (charms.ts) or jewels (jewels.ts). Flask / charm lines use FlaskModKey /
// CharmModKey; radius-jewel lines scale with allocated passives (radiusLines).
import type { CharmModKey } from "./charms";
import type { FxKey } from "./fx";
import type { FlaskModKey, ModKey } from "./types";

export type UniqueFxFamily = "blood" | "frost" | "ember" | "shadow" | "wind" | "holy" | "thorn" | "stone" | "arcane" | "gold";

export interface UniqueDef {
  id: string;
  name: string;
  base: string; // base id from content/bases.ts
  mods: [ModKey | FxKey | FlaskModKey | CharmModKey, number, number, number?][]; // key, min, max, decimals
  flavour: string;
  weight: number;
  look: { tint: string; glow: string; fx: UniqueFxFamily };
  /** Radius jewels: line index -> granted per allocated Small / Notable passive in the radius. */
  radiusLines?: Record<number, "small" | "notable">;
  /** Unique charms: extra buffs granted for the charm's duration whenever it triggers. */
  charmBuff?: [FxKey, number][];
  /** Unique flasks: buffs granted while the flask recovers (at least `dur` seconds). */
  flaskBuff?: { fx: [FxKey, number][]; dur: number };
}

export const UNIQUES: UniqueDef[] = [
  // ---- weapons ----
  { id: "firstblood_hush", name: "Firstblood Hush", base: "moonsliver_dirk", weight: 8,
    mods: [["dmgInc", 40, 60], ["fullLifeMore", 50, 70], ["atkSpeedInc", 8, 12]],
    flavour: "The first cut decides. The rest is paperwork.", look: { tint: "#2b2233", glow: "#b04a6a", fx: "shadow" } },
  { id: "gravecall", name: "Gravecall", base: "grievance_axe", weight: 8,
    mods: [["executeMore", 40, 60], ["killHeal", 12, 18], ["atkSpeedInc", -12, -8]],
    flavour: "It hears the dying before they know.", look: { tint: "#4a4f45", glow: "#8fd08a", fx: "shadow" } },
  { id: "long_argument", name: "The Long Argument", base: "wyrmtooth_pike", weight: 8,
    mods: [["reach", 25, 35], ["kbInc", 40, 60], ["dmgInc", 15, 25], ["moveInc", -6, -4]],
    flavour: "Settled, eventually, at a comfortable distance.", look: { tint: "#6a5a40", glow: "#e0d090", fx: "wind" } },
  { id: "thirstblade", name: "Thirstblade", base: "gallowsedge_blade", weight: 8,
    mods: [["leech", 6, 9, 1], ["dmgFlat", 5, 8], ["life", -25, -15]],
    flavour: "It drinks first and asks never.", look: { tint: "#5a1a20", glow: "#ff3a4a", fx: "blood" } },
  { id: "rimebrand", name: "Rimebrand", base: "ruststeel_sword", weight: 10,
    mods: [["chillOnHit", 25, 35], ["dmgInc", 15, 25], ["dmgFlat", 2, 4]],
    flavour: "Forged in a well that never thawed.", look: { tint: "#a8d8f0", glow: "#7ad0ff", fx: "frost" } },
  { id: "oathsplitter", name: "Oathsplitter", base: "woodsplitter_axe", weight: 10,
    mods: [["arcInc", 60, 80], ["kbInc", 30, 50], ["atkSpeedInc", -18, -12]],
    flavour: "Every promise has a grain. Find it.", look: { tint: "#7a5a2a", glow: "#ffb050", fx: "ember" } },
  { id: "hollow_fang", name: "Hollow Fang", base: "wick_knife", weight: 10,
    mods: [["pvpMore", 30, 40], ["dmgFlat", 3, 5], ["pveMore", -25, -15]],
    flavour: "Made for one kind of quarry.", look: { tint: "#3a3a3a", glow: "#e0e0e0", fx: "shadow" } },
  { id: "cinderthorn", name: "Cinderthorn", base: "thornwood_spear", weight: 10,
    mods: [["dodgeMore", 60, 80], ["dodgeCdRed", 12, 18]],
    flavour: "Roll, then strike while the ash still falls.", look: { tint: "#6a2a10", glow: "#ff7a2a", fx: "ember" } },
  // ---- off-hands ----
  { id: "last_gate", name: "The Last Gate", base: "ironbound_ward", weight: 8,
    mods: [["dmgTakenRed", 12, 16], ["life", 25, 35], ["moveInc", -9, -6]],
    flavour: "Nothing passed. Nothing ever will.", look: { tint: "#606a74", glow: "#d0e0ff", fx: "stone" } },
  { id: "briarwall", name: "Briarwall", base: "hide_buckler", weight: 10,
    mods: [["thorns", 6, 10], ["life", 20, 30]],
    flavour: "Hold it close. Let them come closer.", look: { tint: "#4a6a2a", glow: "#a0d060", fx: "thorn" } },
  // ---- helmets ----
  { id: "cindercrown", name: "Cindercrown", base: "visored_helm", weight: 8,
    mods: [["lowLifeMore", 30, 40], ["life", 25, 35]],
    flavour: "Burns brightest just before it goes out.", look: { tint: "#7a3010", glow: "#ffa040", fx: "ember" } },
  { id: "unseen_hour", name: "Hood of the Unseen Hour", base: "leather_coif", weight: 10,
    mods: [["dodgeCdRed", 20, 25], ["killHaste", 25, 35]],
    flavour: "Gone before the bell finishes ringing.", look: { tint: "#20202a", glow: "#8080c0", fx: "shadow" } },
  // ---- body armour ----
  { id: "ossuary_plate", name: "Ossuary Plate", base: "scaled_hauberk", weight: 8,
    mods: [["dmgTakenRed", 8, 12], ["life", 45, 60], ["moveInc", -8, -5]],
    flavour: "Every scale was once somebody's courage.", look: { tint: "#d8d0b8", glow: "#f0e8c0", fx: "stone" } },
  { id: "bloodweave", name: "Bloodweave Jerkin", base: "patchwork_jerkin", weight: 10,
    mods: [["killHeal", 8, 12], ["regen", 2, 3, 1], ["life", 10, 20]],
    flavour: "Mended with whatever was spilled.", look: { tint: "#6a1a1a", glow: "#e04040", fx: "blood" } },
  { id: "glass_saint", name: "Vestment of the Glass Saint", base: "patchwork_jerkin", weight: 6,
    mods: [["pvpMore", 25, 30], ["dmgInc", 10, 15], ["takenMore", 20, 20]],
    flavour: "Holy, fragile and in a hurry.", look: { tint: "#d0f0ff", glow: "#ffffff", fx: "holy" } },
  // ---- gloves ----
  { id: "hangmans_hands", name: "Hangman's Hands", base: "spiked_gauntlets", weight: 8,
    mods: [["executeMore", 25, 35], ["dmgFlat", 4, 6]],
    flavour: "They only ever finish the job.", look: { tint: "#3a2a20", glow: "#c06040", fx: "shadow" } },
  { id: "frostbitten_grasp", name: "Frostbitten Grasp", base: "wrapped_mitts", weight: 10,
    mods: [["chillOnHit", 18, 24], ["atkSpeedInc", 8, 12]],
    flavour: "Shake on it. Then try to walk away.", look: { tint: "#90b8d0", glow: "#9adcff", fx: "frost" } },
  // ---- boots ----
  { id: "stridewind", name: "Stridewind", base: "fleetstride_greaves", weight: 8,
    mods: [["moveInc", 20, 25], ["life", -25, -15]],
    flavour: "The wind does not stop to fight.", look: { tint: "#c0e0d0", glow: "#e0fff0", fx: "wind" } },
  { id: "mudlark_tread", name: "Mudlark's Tread", base: "mudwalker_boots", weight: 10,
    mods: [["kbImmune", 1, 1], ["dodgeCdRed", 10, 15], ["moveInc", 4, 6]],
    flavour: "Rooted like the reeds; quick like the tide.", look: { tint: "#5a4a2a", glow: "#a09060", fx: "stone" } },
  // ---- jewellery ----
  { id: "gamblers_coin", name: "The Gambler's Coin", base: "bonecharm_pendant", weight: 8,
    mods: [["pvpMore", 18, 24], ["takenMore", 10, 10], ["life", 10, 20]],
    flavour: "Heads, you win. Tails, so do they.", look: { tint: "#d0a030", glow: "#ffe070", fx: "gold" } },
  { id: "choirstone", name: "Choirstone", base: "knotted_cord", weight: 10,
    mods: [["spellInc", 40, 50], ["mana", 30, 40], ["manaRegen", 2, 3, 1]],
    flavour: "Hums a note nobody taught it.", look: { tint: "#5a60c0", glow: "#a0b0ff", fx: "arcane" } },
  { id: "leechcoil", name: "Leechcoil", base: "tarnished_band", weight: 10,
    mods: [["leech", 3, 5, 1], ["dmgFlat", 2, 4]],
    flavour: "A ring that is always a little warm.", look: { tint: "#7a2030", glow: "#ff5060", fx: "blood" } },
  { id: "second_wind", name: "Ring of the Second Wind", base: "glimmer_loop", weight: 8,
    mods: [["killHeal", 8, 12], ["killHaste", 20, 30]],
    flavour: "One more breath. One more step.", look: { tint: "#a0d0c0", glow: "#c0fff0", fx: "wind" } },
  { id: "cinderloop", name: "Cinderloop", base: "glimmer_loop", weight: 8,
    mods: [["dodgeMore", 30, 40], ["atkSpeedInc", 4, 8]],
    flavour: "Spin through the sparks.", look: { tint: "#a04010", glow: "#ff8030", fx: "ember" } },
  // ---- belts ----
  { id: "many_pouches", name: "Girdle of Many Pouches", base: "studded_girdle", weight: 8,
    mods: [["charmSlots", 1, 1], ["charmGain", 30, 40], ["flaskGainInc", 20, 30]],
    flavour: "Something for every bad day.", look: { tint: "#6a4a2a", glow: "#d0a060", fx: "gold" } },
  { id: "tallymans_cord", name: "Tallyman's Cord", base: "rope_sash", weight: 10,
    mods: [["pveMore", 25, 35], ["flaskRecInc", 25, 35], ["charmGain", 20, 30]],
    flavour: "Every notch a beast. Every beast a meal.", look: { tint: "#8a6a3a", glow: "#e0c080", fx: "gold" } },
  // =============== itemization pass: a unique for every slot class (PoE2 coverage) ===============
  // ---- weapons: one per weapon kind not covered above ----
  { id: "tollkeepers_knell", name: "Tollkeeper's Knell", base: "bellhammer", weight: 8,
    mods: [["dmgInc", 30, 45], ["kbInc", 60, 80], ["executeMore", 20, 30], ["atkSpeedInc", -10, -6]],
    flavour: "Every debt is called in, one bell at a time.", look: { tint: "#6a6050", glow: "#e0c070", fx: "stone" } },
  { id: "carrion_psalm", name: "Carrion Psalm", base: "carrion_hook", weight: 8,
    mods: [["leech", 3, 5, 1], ["killHeal", 6, 10], ["atkSpeedInc", 10, 15], ["life", -20, -10]],
    flavour: "The crows sing it over every field.", look: { tint: "#2a2020", glow: "#a03040", fx: "blood" } },
  { id: "drowned_choir", name: "Censer of the Drowned Choir", base: "cinder_sceptre", weight: 8,
    mods: [["spellInc", 30, 45], ["spirit", 10, 15], ["esOnKill", 5, 8], ["manaRegen", 2, 3, 1]],
    flavour: "Swing it and the water remembers singing.", look: { tint: "#304a5a", glow: "#80c0e0", fx: "arcane" } },
  { id: "fingerbone_gospel", name: "Fingerbone Gospel", base: "fingerbone_wand", weight: 8,
    mods: [["spellInc", 25, 40], ["manaOnKill", 8, 12], ["mana", 20, 30], ["life", -15, -10]],
    flavour: "It points. Something always answers.", look: { tint: "#d8d0b8", glow: "#b0a0ff", fx: "arcane" } },
  { id: "pilgrims_unrest", name: "Pilgrim's Unrest", base: "pilgrim_quarterstaff", weight: 8,
    mods: [["dodgeMore", 40, 60], ["dodgeCdRed", 15, 20], ["evasionInc", 30, 50], ["moveInc", 4, 6]],
    flavour: "The road never ended, so neither did he.", look: { tint: "#7a6a4a", glow: "#e0f0d0", fx: "wind" } },
  { id: "hollow_lectern", name: "The Hollow Lectern", base: "hollow_staff", weight: 8,
    mods: [["spellInc", 40, 60], ["esInc", 20, 30], ["esStart", 30, 40], ["life", -30, -20]],
    flavour: "Its pages burned long ago. It still knows the words.", look: { tint: "#3a3048", glow: "#c0a0ff", fx: "arcane" } },
  { id: "gallowsong", name: "Gallowsong", base: "thornstring_bow", weight: 8,
    mods: [["dmgInc", 30, 45], ["critInc", 30, 50], ["fullLifeMore", 30, 50], ["moveInc", -5, -3]],
    flavour: "The first note is always the loudest.", look: { tint: "#3a2a20", glow: "#f0e0a0", fx: "shadow" } },
  { id: "the_lockjaw", name: "The Lockjaw", base: "windlass_crossbow", weight: 8,
    mods: [["dmgFlat", 6, 10], ["kbInc", 40, 60], ["chillOnHit", 15, 25], ["atkSpeedInc", -15, -10]],
    flavour: "Wound once. Wait. It does not miss twice.", look: { tint: "#5a6a74", glow: "#9adcff", fx: "frost" } },
  { id: "sorrows_width", name: "Sorrow's Width", base: "executioner_blade", weight: 7,
    mods: [["arcInc", 30, 45], ["dmgInc", 30, 40], ["lowLifeMore", 25, 35], ["life", 20, 30]],
    flavour: "Grief is wider than any one man.", look: { tint: "#5a5a6a", glow: "#d04050", fx: "blood" } },
  { id: "gravelmother", name: "Gravelmother", base: "anvil_maul", weight: 7,
    mods: [["dmgInc", 40, 60], ["kbInc", 50, 70], ["stunThr", 25, 40], ["moveInc", -8, -5]],
    flavour: "She buries what she strikes, and strikes what she buries.", look: { tint: "#6a5a48", glow: "#c0a070", fx: "stone" } },
  { id: "reaping_debt", name: "The Reaping Debt", base: "gravedigger_axe", weight: 7,
    mods: [["executeMore", 40, 60], ["killHaste", 20, 30], ["dmgInc", 20, 30], ["life", -25, -15]],
    flavour: "Owed by all. Collected by one.", look: { tint: "#3a3a2a", glow: "#a0d080", fx: "shadow" } },
  // ---- helmets (Int / Str-Dex / Str-Int / Dex) ----
  { id: "quiet_thorns", name: "The Hushed Briar", base: "thorn_diadem", weight: 8,
    mods: [["esInc", 40, 60], ["thorns", 4, 7], ["manaRegen", 1, 2, 1], ["resLight", 10, 15]],
    flavour: "It never draws blood from the wearer. Only from the hand that reaches.", look: { tint: "#506040", glow: "#c0e0a0", fx: "thorn" } },
  { id: "rams_grudge", name: "The Ram's Grudge", base: "horned_cap", weight: 8,
    mods: [["armourInc", 30, 50], ["evasionInc", 30, 50], ["kbImmune", 1, 1], ["life", 10, 20]],
    flavour: "It has been pushed before. Never again.", look: { tint: "#7a5a3a", glow: "#e0b070", fx: "stone" } },
  { id: "ninth_bell", name: "Vigil of the Ninth Bell", base: "templar_bascinet", weight: 7,
    mods: [["armourInc", 30, 40], ["esInc", 30, 40], ["stunImmune", 1, 1], ["moveInc", -5, -3]],
    flavour: "Eight bells for the dead. The ninth for whoever stands watch.", look: { tint: "#a0a0b0", glow: "#fff0c0", fx: "holy" } },
  { id: "snarewatcher", name: "Snarewatcher", base: "poacher_hood", weight: 8,
    mods: [["evasionInc", 40, 60], ["critInc", 20, 30], ["accuracy", 30, 50], ["pveMore", 10, 15]],
    flavour: "Patience is a trap with no teeth, until it has them.", look: { tint: "#4a5a30", glow: "#b0d070", fx: "wind" } },
  // ---- body armour (Str / Int / Str-Dex / Str-Int / Dex-Int) ----
  { id: "penance_mail", name: "Penance Mail", base: "chain_hauberk", weight: 8,
    mods: [["armourInc", 60, 80], ["life", 30, 45], ["lowLifeTakenRed", 15, 20], ["moveInc", -6, -4]],
    flavour: "Every link a sin. Every sin a little more armour.", look: { tint: "#5a5a60", glow: "#c0c0d0", fx: "stone" } },
  { id: "last_candle", name: "Shroud of the Last Candle", base: "vesper_vestment", weight: 8,
    mods: [["esInc", 60, 80], ["esOnKill", 6, 10], ["resAll", 8, 12], ["life", -25, -15]],
    flavour: "When the others gutter out, it burns on what is left.", look: { tint: "#3a3040", glow: "#ffd080", fx: "holy" } },
  { id: "ransackers_coat", name: "The Ransacker's Coat", base: "raider_lamellar", weight: 8,
    mods: [["armourInc", 40, 60], ["evasionInc", 40, 60], ["killHeal", 5, 8], ["pvpMore", 8, 12]],
    flavour: "Every pocket was someone else's first.", look: { tint: "#6a4a30", glow: "#e09050", fx: "gold" } },
  { id: "unburnt_tabard", name: "Tabard of the Unburnt", base: "templar_tabard", weight: 7,
    mods: [["armourInc", 30, 40], ["esInc", 30, 40], ["resFire", 20, 30], ["igniteImmune", 1, 1]],
    flavour: "They lit the pyre three times. Three times it refused.", look: { tint: "#a04020", glow: "#ffd0a0", fx: "ember" } },
  { id: "mistwalkers_shawl", name: "Mistwalker's Shawl", base: "wanderer_wrap", weight: 8,
    mods: [["evasionInc", 40, 50], ["esInc", 30, 40], ["freezeImmune", 1, 1], ["dodgeCdRed", 8, 12]],
    flavour: "Cold cannot grip what is never quite there.", look: { tint: "#a0b0c0", glow: "#e0f0ff", fx: "frost" } },
  // ---- gloves (Dex / Int / Str-Int / Dex-Int) ----
  { id: "fletchers_penance", name: "Fletcher's Penance", base: "archer_gloves", weight: 8,
    mods: [["atkSpeedInc", 10, 15], ["critMulti", 15, 25], ["evasionInc", 30, 40], ["life", -15, -10]],
    flavour: "Ten thousand arrows. Ten thousand splinters.", look: { tint: "#6a5030", glow: "#e0c090", fx: "wind" } },
  { id: "hushed_choir", name: "Grasp of the Hushed Choir", base: "chanter_gloves", weight: 8,
    mods: [["spellInc", 20, 30], ["esInc", 30, 50], ["manaOnKill", 5, 8]],
    flavour: "Silence, held in both hands.", look: { tint: "#3a3a5a", glow: "#a0b0ff", fx: "arcane" } },
  { id: "confessors_grip", name: "The Confessor's Grip", base: "chapel_gauntlets", weight: 7,
    mods: [["armourInc", 20, 30], ["esInc", 20, 30], ["leech", 2, 3, 1], ["bleedImmune", 1, 1]],
    flavour: "It takes the truth out. It takes a little more.", look: { tint: "#6a3030", glow: "#ff9090", fx: "blood" } },
  { id: "pickpockets_lament", name: "Pickpocket's Lament", base: "thief_gloves", weight: 8,
    mods: [["evasionInc", 30, 40], ["esInc", 20, 30], ["charmGain", 30, 50], ["flaskGainInc", 15, 25]],
    flavour: "Light fingers. Heavy pockets. Short life.", look: { tint: "#40404a", glow: "#d0c080", fx: "gold" } },
  // ---- boots (Int / Str-Dex / Str-Int / Dex-Int) ----
  { id: "ashwalker_slippers", name: "Ashwalker Slippers", base: "acolyte_slippers", weight: 8,
    mods: [["moveInc", 15, 20], ["esInc", 30, 40], ["igniteImmune", 1, 1], ["resFire", 15, 25]],
    flavour: "Walk the coals. Leave no footprints.", look: { tint: "#4a2a20", glow: "#ff9050", fx: "ember" } },
  { id: "trenchfoot", name: "Trenchfoot", base: "legwrap_boots", weight: 8,
    mods: [["moveInc", 10, 15], ["armourInc", 20, 40], ["slowImmune", 1, 1], ["life", -20, -10]],
    flavour: "Mud, frost and blood. None of it slows you anymore.", look: { tint: "#4a4030", glow: "#a09070", fx: "stone" } },
  { id: "long_kneel", name: "The Long Kneel", base: "chapel_boots", weight: 7,
    mods: [["moveInc", 8, 12], ["armourInc", 20, 30], ["esInc", 20, 30], ["shockImmune", 1, 1]],
    flavour: "Prayed into the stone until the storm gave up.", look: { tint: "#8080a0", glow: "#f0f0ff", fx: "holy" } },
  { id: "roadless_wanderers", name: "Roadless Wanderers", base: "pilgrim_boots", weight: 8,
    mods: [["moveInc", 15, 20], ["evasionInc", 20, 30], ["killHaste", 15, 25]],
    flavour: "There was never a road. There was only away.", look: { tint: "#6a6050", glow: "#d0f0e0", fx: "wind" } },
  // ---- off-hands (focus / quiver / Str shield / Str-Dex shield) ----
  { id: "unblinking_eye", name: "The Lidless Watch", base: "glass_eye_focus", weight: 8,
    mods: [["spellInc", 25, 40], ["esInc", 20, 30], ["critInc", 25, 40], ["resChaos", 10, 15]],
    flavour: "It has seen you already. It is still looking.", look: { tint: "#a0c0c0", glow: "#80ffe0", fx: "arcane" } },
  { id: "crowfeather_tithe", name: "Crowfeather Tithe", base: "fletcher_quiver", weight: 8,
    mods: [["dmgFlat", 3, 6], ["atkSpeedInc", 8, 12], ["killHaste", 15, 20], ["critInc", 15, 25]],
    flavour: "Every tenth arrow belongs to the crows.", look: { tint: "#1a1a20", glow: "#8080a0", fx: "shadow" } },
  { id: "faithless_wall", name: "Wall of the Faithless", base: "rampart_shield", weight: 8,
    mods: [["armourInc", 60, 80], ["block", 4, 6], ["thorns", 5, 8], ["moveInc", -5, -3]],
    flavour: "Built by those who no longer believed in anything but walls.", look: { tint: "#5a5048", glow: "#c0b0a0", fx: "stone" } },
  { id: "rootbound_targe", name: "Rootbound Targe", base: "targe_of_boughs", weight: 8,
    mods: [["armourInc", 25, 35], ["evasionInc", 25, 35], ["regen", 1, 2, 1], ["kbImmune", 1, 1]],
    flavour: "It grew into the arm that held it. It will not let go.", look: { tint: "#4a5a2a", glow: "#a0e070", fx: "thorn" } },
  // ---- jewellery and belts ----
  { id: "hanged_sap", name: "Sap of the Hanged Tree", base: "amber_talisman", weight: 8,
    mods: [["life", 30, 40], ["regen", 2, 3, 1], ["flaskRecInc", 20, 30], ["resAll", 8, 12]],
    flavour: "The tree took one man. It gave back amber.", look: { tint: "#c08030", glow: "#ffc060", fx: "gold" } },
  { id: "drowned_bride", name: "Locket of the Drowned Bride", base: "lapis_locket", weight: 8,
    mods: [["mana", 30, 40], ["spirit", 15, 20], ["manaOnKill", 5, 10], ["resCold", 15, 25]],
    flavour: "Open it and hear the river.", look: { tint: "#304a80", glow: "#90b0ff", fx: "frost" } },
  { id: "ninefold_knot", name: "The Ninefold Knot", base: "garnet_ring", weight: 7,
    mods: [["resAll", 10, 15], ["life", 15, 25], ["maxRes", 1, 2]],
    flavour: "Nine wardings, tied by nine hands that never met.", look: { tint: "#8a3040", glow: "#ffd0d0", fx: "holy" } },
  { id: "tidecallers_band", name: "Tidecaller's Band", base: "moonstone_ring", weight: 8,
    mods: [["esInc", 15, 25], ["mana", 20, 30], ["charmChargeRegen", 0.5, 1, 1]],
    flavour: "The tide comes back. So do the charms.", look: { tint: "#a0b0d0", glow: "#d0e0ff", fx: "arcane" } },
  { id: "vintners_chain", name: "The Vintner's Chain", base: "chainlink_belt", weight: 7,
    mods: [["flaskInstant", 25, 35], ["flaskChargeRegen", 0.5, 1, 1], ["flaskRecInc", 20, 30], ["life", 20, 30]],
    flavour: "Never a dry cup on a long road.", look: { tint: "#6a2030", glow: "#e06080", fx: "blood" } },
  { id: "spare_breath", name: "Cord of Spare Breath", base: "hide_belt", weight: 8,
    mods: [["charmSlots", 1, 1], ["charmChargeRegen", 0.3, 0.6, 1], ["charmGain", 15, 25]],
    flavour: "Tied with a knot for every time it saved you.", look: { tint: "#7a6040", glow: "#c0e0b0", fx: "gold" } },
  // ---- flasks (life / life / mana) ----
  { id: "red_lantern", name: "The Red Lantern", base: "bronze_draught", weight: 6,
    mods: [["fRecInc", 40, 60], ["fCureBleed", 1, 1], ["fMaxCharges", 6, 10]],
    flaskBuff: { fx: [["leech", 2]], dur: 3 },
    flavour: "Hang it in the window. Someone always comes.", look: { tint: "#a02020", glow: "#ff6040", fx: "blood" } },
  { id: "penitents_cup", name: "Penitent's Cup", base: "gilt_draught", weight: 5,
    mods: [["fPartInstant", 100, 100], ["fAmountMore", -35, -25], ["fChargesRed", 15, 25]],
    flaskBuff: { fx: [["dmgTakenRed", 10]], dur: 3 },
    flavour: "Drink it all at once. Penance is never sipped.", look: { tint: "#d0b060", glow: "#fff0b0", fx: "holy" } },
  { id: "inkblood_phial", name: "Inkblood Phial", base: "azure_phial", weight: 6,
    mods: [["fRateInc", 50, 80], ["fGainInc", 20, 30], ["fCureElem", 1, 1]],
    flaskBuff: { fx: [["hasteBuff", 15]], dur: 3 },
    flavour: "Written in a hand that never dries.", look: { tint: "#20204a", glow: "#8080ff", fx: "arcane" } },
  // ---- charms ----
  { id: "knucklebone_rosary", name: "The Knucklebone Rosary", base: "chm_bedrock", weight: 5,
    mods: [["cCostRed", 20, 30], ["cDuration", 20, 40]],
    charmBuff: [["armourBuff", 150]],
    flavour: "One bead for every hand that tried to break you.", look: { tint: "#d0c8b0", glow: "#fff0d0", fx: "stone" } },
  { id: "feverglass", name: "Feverglass", base: "chm_emberglass", weight: 5,
    mods: [["cDuration", 30, 50], ["cGain", 20, 30]],
    charmBuff: [["pvpMore", 15]],
    flavour: "Burn me once and I burn back hotter.", look: { tint: "#c04010", glow: "#ffb050", fx: "ember" } },
  { id: "hares_leap", name: "The Hare's Last Leap", base: "chm_harefoot", weight: 6,
    mods: [["cNoConsume", 20, 30], ["cLifeOnUse", 20, 35]],
    charmBuff: [["speedBuff", 20]],
    flavour: "Every hare runs. The lucky ones bite.", look: { tint: "#c0a070", glow: "#fff0c0", fx: "wind" } },
  // ---- jewels (attribute jewels and "timeless"-style radius jewels) ----
  { id: "marrow_splinter", name: "Splinter of the Marrow", base: "jwl_bloodgarnet", weight: 6,
    mods: [["life", 15, 20], ["lowLifeMore", 10, 15], ["regen", -1, -0.5, 1]],
    flavour: "Cracked from something that refused to stop walking.", look: { tint: "#8a1a20", glow: "#ff4050", fx: "blood" } },
  { id: "witchglass_tear", name: "Witchglass Tear", base: "jwl_starsilt", weight: 6,
    mods: [["spellInc", 15, 20], ["esOnKill", 4, 6], ["mana", -10, -5]],
    flavour: "She wept once. It has not stopped glowing.", look: { tint: "#2a40a0", glow: "#a0c0ff", fx: "arcane" } },
  { id: "stilled_hour", name: "The Stilled Hour", base: "jwl_stillstone", weight: 4,
    mods: [["life", 4, 5], ["dmgInc", 8, 10], ["moveInc", -3, -2]],
    radiusLines: { 0: "small", 1: "notable" },
    flavour: "Around it, the old paths forget which way they ran.", look: { tint: "#706090", glow: "#d0c0ff", fx: "arcane" } },
  { id: "ashen_covenant", name: "The Ashen Covenant", base: "jwl_stillstone", weight: 4,
    mods: [["resAll", 1.5, 2, 1], ["armourInc", 15, 20], ["killHeal", 2, 3]],
    radiusLines: { 0: "small", 1: "notable" },
    flavour: "Sworn over a fire that burned the oath-takers too.", look: { tint: "#5a4a40", glow: "#ffb070", fx: "ember" } },
];

export const UNIQUE_BY_ID = new Map(UNIQUES.map((u) => [u.id, u]));

export const UNIQUE_COLOR = "#d8873a";

/** Mod id for a unique's i-th line. */
export const uniqueModId = (uid: string, i: number) => `u_${uid}_${i}`;

/** Parse a unique mod id -> [unique, line] or null. */
export function uniqueModLine(id: string): { u: UniqueDef; i: number } | null {
  if (!id.startsWith("u_")) return null;
  const at = id.lastIndexOf("_");
  const u = UNIQUE_BY_ID.get(id.slice(2, at));
  const i = Number(id.slice(at + 1));
  return u && u.mods[i] ? { u, i } : null;
}
