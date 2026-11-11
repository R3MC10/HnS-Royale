// Shared progression math: passive totals -> attributes, defences and Stats. Used by the server
// (authoritative) and by the client (tree panel character sheet). Content lives in
// content/classes.ts, content/passives.ts and content/ascendancies.ts.
import type { Item } from "./items";
import { ASC_NODE_BY_ID } from "./content/ascendancies";
import { ATTR_RULES, CLASS_BY_ID, DEFENCE, LIFE_PER_LEVEL, MANA_PER_LEVEL, spiritForLevel } from "./content/classes";
import { PASSIVE_BY_ID, type PassiveKey, type PassiveMods } from "./content/passives";
import type { Stats } from "./stats";

/** Owner-only progression state (server -> client `prog` message). */
export interface ProgMsg {
  t: "prog";
  lv: number;
  xp: number; // xp into the current level
  next: number; // xp needed for the next level (0 at max level)
  pts: number; // unspent passive points
  cls: string;
  alloc: string[]; // allocated tree nodes (includes the class start)
  asc: string | null; // chosen ascendancy id
  ascAlloc: string[]; // allocated ascendancy nodes (includes its root)
  ascPts: number; // unspent ascendancy points
  /** 0 locked (level too low), 1 trial available, 2 trial cleared: pick an ascendancy, 3 ascended. */
  ascState: 0 | 1 | 2 | 3;
  def: Defences;
  bar: number; // current barrier (briefly above def.barrier after a second wind)
  /** Trial honour 0..100 while your trial is running (absent otherwise). */
  hon?: number;
  /** Jewels socketed in the passive tree: socket node id -> item. */
  jw?: Record<string, Item>;
}

/** Trial shrine marker (everyone): s = 0 dormant, 1 trial in progress, 2 recovering. */
export interface ShrineSnap {
  x: number;
  y: number;
  s: 0 | 1 | 2;
}

export interface ShrinesMsg {
  t: "shrines";
  list: ShrineSnap[];
}

export interface Defences {
  str: number;
  dex: number;
  int: number;
  armour: number;
  evasion: number;
  barrier: number; // max barrier
  resist: number; // % elemental resistance (capped)
  evadeChance: number; // 0..1 (derived, for display)
}

/** Conditional, short-lived states that switch some passive effects on (server-tracked). */
export interface ProgConditions {
  lowLife: boolean;
  postRoll: boolean;
  calm: boolean;
  still: boolean;
  barrierFull: boolean;
  killRush: boolean;
  evadeHaste: boolean;
  trophies: number; // player kills this match
}

export const NO_CONDITIONS: ProgConditions = {
  lowLife: false,
  postRoll: false,
  calm: false,
  still: false,
  barrierFull: false,
  killRush: false,
  evadeHaste: false,
  trophies: 0,
};

/** Sum of every passive / ascendancy node a player has, plus the class base attributes. */
export function totalMods(cls: string, alloc: Iterable<string>, ascAlloc: Iterable<string>): PassiveMods {
  const out: PassiveMods = {};
  const addMods = (m: PassiveMods) => {
    for (const [k, v] of Object.entries(m)) out[k as PassiveKey] = (out[k as PassiveKey] ?? 0) + (v as number);
  };
  const c = CLASS_BY_ID.get(cls);
  if (c) addMods({ str: c.base.str, dex: c.base.dex, int: c.base.int, armour: c.base.armour, evasion: c.base.evasion, barrier: c.base.barrier });
  for (const id of alloc) {
    const n = PASSIVE_BY_ID.get(id);
    if (n) addMods(n.mods);
  }
  for (const id of ascAlloc) {
    const n = ASC_NODE_BY_ID.get(id);
    if (n) addMods(n.mods);
  }
  if (out.allAttr) {
    out.str = (out.str ?? 0) + out.allAttr;
    out.dex = (out.dex ?? 0) + out.allAttr;
    out.int = (out.int ?? 0) + out.allAttr;
  }
  return out;
}

const more = (v: number | undefined) => 1 + (v ?? 0) / 100;
const inc = (v: number | undefined) => 1 + (v ?? 0) / 100;

export function computeDefences(m: PassiveMods): Defences {
  const g = (k: PassiveKey) => m[k] ?? 0;
  const str = g("str");
  const dex = g("dex");
  const int = g("int");
  const armour = Math.max(0, g("armour") * inc(g("armourInc")) * more(g("armourMore")));
  const evasion = Math.max(0, (g("evasion") + dex * ATTR_RULES.dexEvasion) * inc(g("evasionInc")));
  const barrier = Math.max(0, (g("barrier") + int * ATTR_RULES.intBarrier) * inc(g("barrierInc")) * more(g("barrierMore")));
  const resist = Math.min(DEFENCE.resistCap, g("resist"));
  return {
    str,
    dex,
    int,
    armour: Math.round(armour),
    evasion: Math.round(evasion),
    barrier: Math.round(barrier),
    resist,
    evadeChance: Math.min(DEFENCE.evasionCap, evasion / (evasion + DEFENCE.evasionK)),
  };
}

/** Armour damage reduction against one hit. */
export function armourReduction(armour: number, hit: number): number {
  if (armour <= 0 || hit <= 0) return 0;
  return Math.min(DEFENCE.armourCap, armour / (armour + DEFENCE.armourK * hit));
}

/**
 * Apply level + passives (+ active conditions) on top of gear stats. Mutates and returns `s`
 * (callers clamp afterwards). Mana / spell fields are applied only if the Stats object has them,
 * so this keeps working while the skill system's stat fields evolve.
 */
export function applyProgression(s: Stats, m: PassiveMods, level: number, c: ProgConditions = NO_CONDITIONS): Stats {
  const g = (k: PassiveKey) => m[k] ?? 0;
  const lv = Math.max(0, level - 1);

  // Life
  const life = (s.maxHp + lv * LIFE_PER_LEVEL + g("life") + g("str") * ATTR_RULES.strLife) * inc(g("lifeInc")) * more(g("lifeMore"));
  s.maxHp = Math.max(1, Math.round(life));
  s.lifeRegen = g("noRegen") ? 0 : s.lifeRegen + g("regen");

  // Offence
  let dmgMult = inc(g("dmgInc") + g("str") * ATTR_RULES.strDmg) * more(g("dmgMore"));
  if (c.lowLife) dmgMult *= more(g("lowLifeDmg"));
  if (c.postRoll) dmgMult *= more(g("postRollDmg"));
  if (c.calm) dmgMult *= more(g("calmDmg"));
  if (c.barrierFull) dmgMult *= more(g("fullBarrierDmg"));
  if (c.trophies > 0) dmgMult *= 1 + (Math.min(5, c.trophies) * g("trophyDmg")) / 100;
  s.attackDamage *= dmgMult;
  let aspd = g("atkSpeed") + g("dex") * ATTR_RULES.dexAtkSpeed;
  if (c.killRush) aspd += g("killRushAtk");
  if (c.still) aspd += g("stillAtk");
  const speed = inc(aspd) * more(g("atkSpeedMore"));
  s.attackCooldown /= speed;
  s.swingTime /= speed;
  s.attackRange += g("reach");
  s.attackArc *= inc(g("arcInc"));
  s.knockback *= inc(g("kbInc"));

  // Utility
  let mv = g("moveInc");
  if (c.killRush) mv += g("killRushMove");
  if (c.evadeHaste) mv += g("evadeHaste");
  s.moveSpeed *= inc(mv);
  s.dodgeCooldown *= Math.max(0.2, 1 - g("dodgeCdRed") / 100) * more(g("dodgeCdMore"));
  s.dodgeIframes += g("iframes") / 1000;
  s.flaskRecovery *= inc(g("flaskRecInc")) * more(g("flaskRecMore"));
  s.flaskChargeGain *= inc(g("flaskGainInc"));

  // Mana / spells (owned by the skill system; only touched if present)
  const r = s as unknown as Record<string, number>;
  if (typeof r.maxMana === "number") r.maxMana = (r.maxMana + lv * MANA_PER_LEVEL + g("mana") + g("int") * ATTR_RULES.intMana) * inc(g("manaInc"));
  if (typeof r.manaRegen === "number") r.manaRegen *= inc(g("manaRegenInc"));
  if (typeof r.castSpeed === "number") r.castSpeed *= inc(g("castSpeed"));
  if (typeof r.spirit === "number") r.spirit += spiritForLevel(level) + g("spirit"); // level milestones + passives
  if (typeof r.spellMult === "number") r.spellMult *= inc(g("spellInc")) * more(g("dmgMore"));

  // Defences (combat-systems, server/damage.ts): passive flat values join gear, passive % applies to both.
  // Barrier == energy shield (one pool, owned by damage.ts). Passive "resist" adds to every element.
  if (typeof r.armour === "number") r.armour = Math.max(0, (r.armour + g("armour")) * inc(g("armourInc")) * more(g("armourMore")));
  if (typeof r.evasion === "number") r.evasion = Math.max(0, (r.evasion + g("evasion") + g("dex") * ATTR_RULES.dexEvasion) * inc(g("evasionInc")));
  if (typeof r.energyShield === "number")
    r.energyShield = Math.max(0, (r.energyShield + g("barrier") + g("int") * ATTR_RULES.intBarrier) * inc(g("barrierInc")) * more(g("barrierMore")));
  if (typeof r.resFire === "number") {
    r.resFire += g("resist");
    r.resCold += g("resist");
    r.resLight += g("resist");
  }
  return s;
}
