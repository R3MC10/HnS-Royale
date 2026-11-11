// The passive tree ("the Lattice"): an original, royale-sized tree (~110 nodes). The class starts
// sit on an outer ring split into attribute regions (INT, DEX/INT, DEX, STR/DEX, STR, INT/STR; the
// pure DEX and INT regions hold two classes each). The ring is shared travel, spokes lead to a
// central hub, keystones sit between the spokes and every class has an outward wing.
//
// The class regions are DATA-DRIVEN from CLASSES (classes.ts). To add a class:
//   1. Add its ClassDef to CLASSES (id, start: "start_<id>", attrs, color, starter, trait ...).
//      `treeDeg` places its start on the ring; leave it out and the class lands in the widest gap.
//   2. Done: the builder below gives it a start node, its own ring arc to the next start, a short
//      spoke joining the nearest existing spoke, and an outward wing, all generated from its
//      attributes. For hand-made nodes add a CLASS_TREE entry (any part: startMods / ring / spoke / wings).
//   3. Give the new names Polish entries in src/client/i18n/pl_content.ts (the generated notables
//      reuse a few shared names that are translated already). The client heatmap follows by itself.
// Existing node ids never depend on class order: ring arcs, spokes and wings use the ids in CLASS_TREE.
// Stat keys are documented in PASSIVE_LABELS; the math lives in src/shared/progression.ts.

import { CLASSES, type ClassDef } from "./classes";

/** Every stat / effect a passive or ascendancy node can grant. */
export type PassiveKey =
  // attributes
  | "str" | "dex" | "int" | "allAttr"
  // life / mana
  | "life" | "lifeInc" | "mana" | "manaInc" | "manaRegenInc" | "regen" | "spirit"
  // defences
  | "armour" | "armourInc" | "evasion" | "evasionInc" | "barrier" | "barrierInc" | "resist"
  // offence
  | "dmgInc" | "atkSpeed" | "castSpeed" | "spellInc" | "reach" | "kbInc" | "arcInc"
  // utility
  | "moveInc" | "dodgeCdRed" | "flaskRecInc" | "flaskGainInc"
  // "more" multipliers (keystones / ascendancies), in %
  | "lifeMore" | "dmgMore" | "dmgTakenMore" | "barrierMore" | "armourMore" | "dodgeCdMore" | "flaskRecMore" | "barrierRechargeMore" | "atkSpeedMore"
  // special effects (server hooks in src/server/progression.ts)
  | "noRegen" // life regeneration is disabled
  | "noKnockback" // you cannot be knocked back
  | "lifeOnKill" // % of max life recovered on kill
  | "barrierOnKill" // % of max barrier recovered on kill
  | "lowLifeDmg" // % more damage while below 40% life
  | "cheatDeath" // a killing blow leaves you at 1 life + 1.5 s invulnerable; cooldown in s
  | "reflect" // % of hit damage taken reflected to the attacker
  | "killRushAtk" // % attack speed for 4 s after a kill
  | "killRushMove" // % movement speed for 4 s after a kill
  | "postRollDmg" // % more damage for 2 s after a dodge roll
  | "iframes" // + seconds of dodge-roll invulnerability (x1000 in data: ms)
  | "calmDmg" // % more damage if you haven't been hit for 3 s
  | "stillAtk" // % attack speed while standing still
  | "fullBarrierDmg" // % more damage while barrier is full
  | "killNova" // on kill, % of the victim's max life dealt to enemies within 160 px (players hit at the PvP rate)
  | "bountyFlask" // player kills refill flasks (1)
  | "bountyXp" // % more XP from player kills
  | "trophyDmg" // % more damage per player killed this match (max 5 stacks)
  | "evadeHaste" // % movement speed for 1.5 s after evading a hit
  | "chargesOnKill" // + flask charges per kill
  | "lifeLeech" // % of hit damage dealt recovered as life
  | "barrierLeech" // % of hit damage dealt recovered as barrier
  | "splash" // % of hit damage dealt to other enemies near the target
  | "execute" // enemies you hit below this % of life die (players: 60% of the threshold)
  | "firstHitDmg" // % more damage against enemies at full life
  | "eliteDmg" // % more damage against elites and trial guardians
  | "pvpDmg" // % more damage against players
  | "chargesOnHit" // + flask charges per swing that hits
  | "rollStrike" // starting a dodge roll strikes enemies around you for % of attack damage
  | "dodgeHeal" // % of max life recovered when you start a dodge roll
  | "dodgeBarrier" // % of max barrier recovered when you start a dodge roll
  | "secondWind" // dropping below 30% life grants barrier equal to % of max life (20 s cooldown)
  | "xpMore" // % more experience from monsters
  | "noBarrierRecharge"; // barrier does not recharge on its own

export type PassiveMods = Partial<Record<PassiveKey, number>>;

/** Tooltip lines per key ({v} = value). Keys missing here are described by the node's `desc`. */
export const PASSIVE_LABELS: Partial<Record<PassiveKey, string>> = {
  spirit: "+{v} to Spirit",
  str: "+{v} to Strength",
  dex: "+{v} to Dexterity",
  int: "+{v} to Intelligence",
  allAttr: "+{v} to all Attributes",
  life: "+{v} to maximum Life",
  lifeInc: "{v}% increased maximum Life",
  mana: "+{v} to maximum Mana",
  manaInc: "{v}% increased maximum Mana",
  manaRegenInc: "{v}% increased Mana Regeneration",
  regen: "Regenerate {v} Life per second",
  armour: "+{v} to Armour",
  armourInc: "{v}% increased Armour",
  evasion: "+{v} to Evasion Rating",
  evasionInc: "{v}% increased Evasion Rating",
  barrier: "+{v} to maximum Barrier",
  barrierInc: "{v}% increased maximum Barrier",
  resist: "+{v}% to Elemental Resistance",
  dmgInc: "{v}% increased Attack Damage",
  atkSpeed: "{v}% increased Attack Speed",
  castSpeed: "{v}% increased Cast Speed",
  spellInc: "{v}% increased Spell Damage",
  reach: "+{v} to Melee Reach",
  kbInc: "{v}% increased Knockback",
  arcInc: "{v}% increased Attack Arc",
  moveInc: "{v}% increased Movement Speed",
  dodgeCdRed: "{v}% reduced Dodge Roll cooldown",
  flaskRecInc: "{v}% increased Flask Recovery",
  flaskGainInc: "{v}% increased Flask Charges gained",
  lifeMore: "{v}% more maximum Life",
  dmgMore: "{v}% more Damage",
  dmgTakenMore: "{v}% more Damage taken",
  barrierMore: "{v}% more maximum Barrier",
  armourMore: "{v}% more Armour",
  dodgeCdMore: "{v}% more Dodge Roll cooldown",
  flaskRecMore: "{v}% more Flask Recovery",
  barrierRechargeMore: "Barrier recharges {v}% faster",
  atkSpeedMore: "{v}% more Attack Speed",
  noRegen: "You cannot Regenerate Life",
  noKnockback: "You cannot be Knocked Back",
  lifeOnKill: "Recover {v}% of maximum Life on Kill",
  barrierOnKill: "Recover {v}% of maximum Barrier on Kill",
  lowLifeDmg: "{v}% more Damage while below 40% Life",
  cheatDeath: "A killing blow leaves you at 1 Life and grants 1.5s of invulnerability (once every {v}s)",
  reflect: "Reflect {v}% of Hit damage taken back to the attacker",
  killRushAtk: "{v}% increased Attack Speed for 4s after a Kill",
  killRushMove: "{v}% increased Movement Speed for 4s after a Kill",
  postRollDmg: "{v}% more Damage for 2s after a Dodge Roll",
  iframes: "Dodge Roll invulnerability lasts {v}ms longer",
  calmDmg: "{v}% more Damage if you haven't been Hit for 3s",
  stillAtk: "{v}% increased Attack Speed while standing still",
  fullBarrierDmg: "{v}% more Damage while your Barrier is full",
  killNova: "Enemies you kill burst, dealing {v}% of their maximum Life to enemies nearby",
  bountyFlask: "Killing a player refills your Flasks",
  bountyXp: "{v}% more Experience from killing players",
  trophyDmg: "{v}% more Damage per player you have killed this match (up to 5)",
  evadeHaste: "{v}% increased Movement Speed for 1.5s after Evading a Hit",
  chargesOnKill: "+{v} Flask Charges on Kill",
  lifeLeech: "{v}% of Hit damage dealt is recovered as Life",
  barrierLeech: "{v}% of Hit damage dealt is recovered as Barrier",
  splash: "Hits splash {v}% of their damage onto enemies near the target",
  execute: "Enemies you Hit below {v}% Life are slain outright (players: 60% of that)",
  firstHitDmg: "{v}% more Damage against enemies on full Life",
  eliteDmg: "{v}% more Damage against Elites and Shrine Wardens",
  pvpDmg: "{v}% more Damage against Players",
  chargesOnHit: "+{v} Flask Charge per Swing that Hits",
  rollStrike: "Starting a Dodge Roll strikes enemies around you for {v}% of your Attack Damage",
  dodgeHeal: "Recover {v}% of maximum Life when you start a Dodge Roll",
  dodgeBarrier: "Recover {v}% of maximum Barrier when you start a Dodge Roll",
  secondWind: "Dropping below 30% Life grants Barrier equal to {v}% of maximum Life (20s cooldown)",
  xpMore: "{v}% more Experience from monsters",
  noBarrierRecharge: "Your Barrier does not recharge on its own",
};

export type NodeKind = "start" | "small" | "notable" | "keystone" | "ascStart" | "jewel";

export interface PassiveNode {
  id: string;
  name: string;
  kind: NodeKind;
  x: number;
  y: number;
  mods: PassiveMods;
  /** Extra tooltip lines (flavour or effects not covered by labels). */
  desc?: string[];
  /** Class whose start this is (start nodes only). */
  cls?: string;
  links: string[]; // undirected; filled symmetric by link()
}

export function modLines(mods: PassiveMods): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(mods)) {
    const label = PASSIVE_LABELS[k as PassiveKey];
    if (!label) continue;
    const n = v as number;
    let line = label.replace("{v}", String(Math.abs(n)));
    if (n < 0) line = line.replace(/^\+/, "-").replace(" increased ", " reduced ").replace(" more ", " less ").replace("% reduced Dodge", "% increased Dodge");
    if (k === "lifeMore" && n < 0) line = `${Math.abs(n)}% less maximum Life`;
    if (k === "armourMore" && n <= -100) line = "You have no Armour";
    out.push(line);
  }
  return out;
}

// ---- builder -----------------------------------------------------------------------

const nodes = new Map<string, PassiveNode>();

function add(id: string, name: string, kind: NodeKind, x: number, y: number, mods: PassiveMods, extra: Partial<PassiveNode> = {}): PassiveNode {
  const n: PassiveNode = { id, name, kind, x: Math.round(x), y: Math.round(y), mods, links: [], ...extra };
  nodes.set(id, n);
  return n;
}

function link(a: string, b: string) {
  const na = nodes.get(a)!;
  const nb = nodes.get(b)!;
  if (!na.links.includes(b)) na.links.push(b);
  if (!nb.links.includes(a)) nb.links.push(a);
}

type Spec = { name?: string; kind?: NodeKind; mods: PassiveMods; desc?: string[] };

/** Nodes evenly spaced on the straight line a -> b (exclusive), chained a - n1 - n2 ... - b. */
function chain(prefix: string, from: string, to: string | null, ax: number, ay: number, bx: number, by: number, specs: Spec[]) {
  let prev = from;
  specs.forEach((s, i) => {
    const t = (i + 1) / (specs.length + (to ? 1 : 0));
    const id = `${prefix}_${i}`;
    add(id, s.name ?? smallName(s.mods), s.kind ?? "small", ax + (bx - ax) * t, ay + (by - ay) * t, s.mods, s.desc ? { desc: s.desc } : {});
    link(prev, id);
    prev = id;
  });
  if (to) link(prev, to);
}

function smallName(m: PassiveMods): string {
  const k = Object.keys(m)[0] as PassiveKey;
  const names: Partial<Record<PassiveKey, string>> = {
    str: "Strength", dex: "Dexterity", int: "Intelligence", allAttr: "Balance",
    life: "Vigour", lifeInc: "Vigour", mana: "Reserves", manaInc: "Reserves", manaRegenInc: "Clarity", regen: "Mending",
    armour: "Hardening", armourInc: "Hardening", evasion: "Evasion", evasionInc: "Evasion", barrier: "Barrier", barrierInc: "Barrier",
    resist: "Warding", dmgInc: "Ferocity", atkSpeed: "Swiftness", castSpeed: "Incantation", spellInc: "Spellcraft",
    reach: "Reach", kbInc: "Impact", arcInc: "Sweep", moveInc: "Fleetness", dodgeCdRed: "Agility", flaskRecInc: "Draughts", flaskGainInc: "Draughts",
  };
  return names[k] ?? "Passive";
}

// Small-node shorthands
const S = (mods: PassiveMods): Spec => ({ mods });
const N = (name: string, mods: PassiveMods, desc?: string[]): Spec => ({ name, kind: "notable", mods, desc });

// ---- layout -------------------------------------------------------------------------

const R = 430;
const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (deg: number, r: number) => ({ x: Math.cos(rad(deg)) * r, y: Math.sin(rad(deg)) * r });

/**
 * Per-class tree data, keyed by class id. Everything is optional: a class in CLASSES with no entry
 * here (or a partial one) gets generated defaults from its attributes (see the header comment).
 *  - ring:  the ring arc from this class's start clockwise to the NEXT class start (ids `<ring.id>_<i>`)
 *  - spoke: a spoke from this class (its start, or the first node of its ring arc) to the hub
 *  - wings: outward branches from the start (ids `<wing.id>_<i>`; `deg` is the branch direction)
 */
interface ClassTreeSpec {
  startMods?: PassiveMods;
  ring?: { id: string; specs: Spec[] };
  spoke?: { key: string; from: "start" | "ring"; specs: Spec[] } | null;
  wings?: { id: string; deg: number; specs: Spec[] }[];
}

const CLASS_TREE: Record<string, ClassTreeSpec> = {
  gloamcaller: {
    startMods: { int: 8 },
    ring: { id: "gate_int", specs: [{ name: "Gate of the Mind", mods: { int: 10 } }] },
    spoke: { key: "int", from: "ring", specs: [S({ barrier: 10 }), S({ mana: 10 }), N("Gathered Dusk", { barrierInc: 20, manaInc: 15, spirit: 20 }), S({ int: 6 })] },
    wings: [{ id: "wing_gloamcaller", deg: -118, specs: [S({ barrier: 12 }), S({ spellInc: 8 }), N("Dusk Litany", { spellInc: 20, castSpeed: 6 }), S({ barrierInc: 10 }), N("Veilwright", { barrierInc: 30, barrier: 20 })] }],
  },
  lanternwright: {
    startMods: { int: 8 },
    ring: { id: "ring_lm", specs: [S({ barrier: 12 }), S({ int: 6 }), N("Lamplit Fog", { evasion: 30, barrier: 20, dex: 5, int: 5 }), S({ evasion: 25 })] },
    spoke: null, // shares the INT spoke through the Gate of the Mind
    wings: [{ id: "wing_lanternwright", deg: -62, specs: [S({ mana: 10 }), S({ castSpeed: 4 }), N("Ember Lexicon", { spellInc: 20, castSpeed: 8, manaRegenInc: 20 }), S({ spellInc: 8 }), N("Kindled Glass", { barrier: 25, fullBarrierDmg: 15 })] }],
  },
  mistrunner: {
    startMods: { dex: 4, int: 4 },
    ring: { id: "ring_mh", specs: [S({ dex: 6 }), S({ castSpeed: 4 }), N("Quickened Mind", { castSpeed: 8, atkSpeed: 6 }), S({ atkSpeed: 4 })] },
    spoke: { key: "dexint", from: "start", specs: [S({ evasion: 25 }), S({ barrier: 10 }), N("Drifting Haze", { evasionInc: 15, barrierInc: 15 }), S({ dex: 3, int: 3 })] },
    wings: [{ id: "wing_mistrunner", deg: -30, specs: [S({ evasion: 25 }), S({ atkSpeed: 4 }), N("Reed Forms", { dmgInc: 14, atkSpeed: 6 }), S({ dodgeCdRed: 6 }), N("Tidal Footing", { evasion: 40, dodgeCdRed: 10, regen: 1 })] }],
  },
  harrier: {
    startMods: { dex: 8 },
    ring: { id: "gate_dex", specs: [{ name: "Gate of the Hand", mods: { dex: 10 } }] },
    spoke: { key: "dex", from: "ring", specs: [S({ atkSpeed: 4 }), S({ evasion: 25 }), N("Hunter's Cadence", { atkSpeed: 10, moveInc: 3, spirit: 15 }), S({ dex: 6 })] },
    wings: [{ id: "wing_harrier", deg: 4, specs: [S({ atkSpeed: 4 }), S({ dmgInc: 6 }), N("Fletcher's Rhythm", { atkSpeed: 10, dmgInc: 10 }), S({ evasion: 25 }), N("Long Shadow", { firstHitDmg: 20, reach: 12 })] }],
  },
  gutterblade: {
    startMods: { dex: 8 },
    ring: { id: "ring_gd", specs: [S({ moveInc: 3 }), S({ evasionInc: 12 }), N("Road-Worn Soles", { moveInc: 6, dodgeCdRed: 10 }), S({ dex: 6 })] },
    spoke: null, // shares the DEX spoke through the Gate of the Hand
    wings: [{ id: "wing_gutterblade", deg: 56, specs: [S({ evasion: 25 }), S({ dmgInc: 6 }), N("Quick Knives", { atkSpeed: 10, firstHitDmg: 15 }), S({ evasionInc: 12 }), N("Shadow Footwork", { evasionInc: 30, dodgeCdRed: 12 })] }],
  },
  drifter: {
    startMods: { str: 4, dex: 4 },
    ring: { id: "ring_dr", specs: [S({ str: 6 }), S({ dmgInc: 6 }), N("Scarred Veteran", { life: 20, armour: 30, dmgInc: 8 }), S({ life: 10 }), S({ armour: 20 })] },
    spoke: { key: "strdex", from: "start", specs: [S({ dmgInc: 6 }), S({ life: 10 }), N("Sellsword's Habit", { dmgInc: 8, atkSpeed: 5, flaskGainInc: 15 }), S({ str: 3, dex: 3 })] },
    wings: [{ id: "wing_drifter", deg: 90, specs: [S({ dmgInc: 6 }), S({ flaskRecInc: 10 }), N("Sellblade's Edge", { dmgInc: 14, arcInc: 10 }), S({ flaskGainInc: 10 }), N("Hip Flask", { flaskRecInc: 25, flaskGainInc: 25, life: 15 })] }],
  },
  reaver: {
    startMods: { str: 8 },
    ring: { id: "ring_rb", specs: [S({ str: 6 }), S({ regen: 0.6 }), N("Blood and Bronze", { life: 15, armour: 25, resist: 8 }), S({ armourInc: 10 }), S({ resist: 6 })] },
    spoke: { key: "str", from: "start", specs: [S({ life: 10 }), S({ dmgInc: 6 }), N("Heavy Hands", { dmgInc: 14, kbInc: 15, spirit: 15 }), S({ str: 6 })] },
    wings: [
      { id: "wing_reaver_0", deg: 126, specs: [S({ armour: 20 }), S({ armourInc: 12 }), S({ life: 10 }), N("Tempered Hide", { armour: 50, armourInc: 25, life: 15 })] },
      { id: "wing_reaver_1", deg: 174, specs: [S({ life: 12 }), S({ dmgInc: 6 }), N("Iron Gut", { lifeInc: 12, regen: 1.5 }), S({ dmgInc: 6 }), N("Pit Fury", { dmgInc: 18, atkSpeed: 6 })] },
    ],
  },
  bellwarden: {
    startMods: { int: 4, str: 4 },
    ring: { id: "ring_bg", specs: [S({ int: 6 }), S({ barrierInc: 10 }), N("Candle Litany", { barrier: 15, regen: 1, resist: 8, spirit: 15 }), S({ barrier: 12 })] },
    spoke: { key: "intstr", from: "start", specs: [S({ armour: 20 }), S({ barrier: 10 }), N("Tempered Faith", { armourInc: 15, barrierInc: 15, resist: 6, spirit: 15 }), S({ int: 3, str: 3 })] },
    wings: [{ id: "wing_bellwarden", deg: 210, specs: [S({ armour: 20 }), S({ dmgInc: 6 }), N("Ringing Blows", { dmgInc: 14, kbInc: 15, armour: 20 }), S({ barrier: 12 }), N("Bronze Lungs", { armour: 40, barrier: 20, lifeInc: 6 })] }],
  },
};

/** Attribute keys of a class ("STR / DEX" -> ["str", "dex"]). */
function classAttrs(c: ClassDef): ("str" | "dex" | "int")[] {
  const out = c.attrs.toLowerCase().split("/").map((x) => x.trim()).filter((x): x is "str" | "dex" | "int" => x === "str" || x === "dex" || x === "int");
  return out.length ? out : ["str", "dex", "int"];
}
const split = (keys: string[], total: number): PassiveMods => Object.fromEntries(keys.map((k) => [k, Math.round(total / keys.length)]));
/** Offence / defence flavour per attribute for generated wings. */
const ATTR_OFF: Record<string, PassiveMods> = { str: { dmgInc: 6 }, dex: { atkSpeed: 4 }, int: { spellInc: 8 } };
const ATTR_DEF: Record<string, PassiveMods> = { str: { armour: 20 }, dex: { evasion: 25 }, int: { barrier: 12 } };

/** Generated defaults for a class without (part of) a CLASS_TREE entry. */
function treeSpec(c: ClassDef): Required<Omit<ClassTreeSpec, "spoke">> & { spoke: ClassTreeSpec["spoke"] } {
  const own = CLASS_TREE[c.id] ?? {};
  const at = classAttrs(c);
  const a0 = at[0];
  const a1 = at[1] ?? at[0];
  return {
    startMods: own.startMods ?? split(at, 8),
    ring: own.ring ?? { id: `ring_${c.id}`, specs: [S(split(at, 6)), S(ATTR_DEF[a0]), N("Crossroads", { ...split(at, 6), life: 10 }), S({ life: 10 })] },
    spoke:
      own.spoke !== undefined
        ? own.spoke
        : { key: c.id, from: "start", specs: [S(ATTR_DEF[a1]), S(ATTR_OFF[a0]), N("Wayfarer's Resolve", { ...ATTR_OFF[a0], ...ATTR_DEF[a1], life: 10 })] },
    wings: own.wings ?? [
      { id: `wing_${c.id}`, deg: 0, specs: [S(ATTR_DEF[a0]), S(ATTR_OFF[a0]), N("Path of Mastery", { ...ATTR_OFF[a0], dmgInc: 10, spellInc: 10 }), S(ATTR_DEF[a1]), N("Path of Endurance", { ...ATTR_DEF[a1], life: 20 })] },
    ],
  };
}

/** Ring angle per class: its `treeDeg`, or the middle of the widest gap left between placed starts. */
function placeClasses(): { c: ClassDef; deg: number }[] {
  const norm = (d: number) => ((d % 360) + 360) % 360;
  const placed = CLASSES.filter((c) => c.treeDeg !== undefined).map((c) => ({ c, deg: c.treeDeg! }));
  for (const c of CLASSES) {
    if (c.treeDeg !== undefined) continue;
    let deg = 90;
    if (placed.length) {
      const ds = placed.map((p) => norm(p.deg)).sort((a, b) => a - b);
      let best = -1;
      for (let i = 0; i < ds.length; i++) {
        const a = ds[i];
        const b = i + 1 < ds.length ? ds[i + 1] : ds[0] + 360;
        if (b - a > best) {
          best = b - a;
          deg = a + (b - a) / 2;
        }
      }
    }
    placed.push({ c, deg });
  }
  // clockwise ring order (start angles kept as given, so existing coordinates never move)
  return placed.sort((a, b) => norm(a.deg) - norm(b.deg));
}

const PLACED = placeClasses();
const SPECS = new Map(PLACED.map(({ c }) => [c.id, treeSpec(c)]));
for (const { c, deg } of PLACED) {
  const p = polar(deg, R);
  add(c.start, `${c.name}'s Mark`, "start", p.x, p.y, SPECS.get(c.id)!.startMods, { cls: c.id });
}
add("hub", "Heart of the Lattice", "small", 0, 0, { allAttr: 6 });

/** Nodes along the ring arc between two starts (exclusive), chained from -> ... -> to. */
function arc(prefix: string, from: string, to: string, d0: number, d1: number, specs: Spec[]) {
  let prev = from;
  specs.forEach((sp, i) => {
    const p = polar(d0 + ((d1 - d0) * (i + 1)) / (specs.length + 1), R);
    const id = `${prefix}_${i}`;
    add(id, sp.name ?? smallName(sp.mods), sp.kind ?? "small", p.x, p.y, sp.mods, sp.desc ? { desc: sp.desc } : {});
    link(prev, id);
    prev = id;
  });
  link(prev, to);
}

// The ring: each class owns the arc clockwise to the next start. Gate nodes join the two classes of a
// shared pure region; that region's spoke starts there.
PLACED.forEach(({ c, deg }, i) => {
  if (PLACED.length < 2) return;
  const next = PLACED[(i + 1) % PLACED.length];
  let d1 = next.deg;
  while (d1 <= deg) d1 += 360;
  const ring = SPECS.get(c.id)!.ring;
  arc(ring.id, c.start, next.c.start, deg, d1, ring.specs);
});

// Spokes from each region to the hub (built in ring order so the region keys are stable).
const SPOKE_KEYS: string[] = [];
for (const { c } of PLACED) {
  const sp = SPECS.get(c.id)!;
  if (!sp.spoke) continue;
  const from = sp.spoke.from === "ring" ? `${sp.ring.id}_0` : c.start;
  const f = nodes.get(from)!;
  if (CLASS_TREE[c.id]?.spoke) {
    chain(`spoke_${sp.spoke.key}`, from, "hub", f.x, f.y, 0, 0, sp.spoke.specs);
    SPOKE_KEYS.push(sp.spoke.key);
  }
}
// Generated spokes (classes without hand-made tree data) run partway in and join the nearest
// hand-made spoke, so they never cut through the keystones around the hub.
for (const { c } of PLACED) {
  const sp = SPECS.get(c.id)!;
  if (!sp.spoke || CLASS_TREE[c.id]?.spoke) continue;
  const f = nodes.get(c.start)!;
  const k = 0.62; // end point at 62% of the ring radius
  const ex = f.x * k;
  const ey = f.y * k;
  let join = "hub";
  let jd = Math.hypot(ex, ey);
  for (const key of SPOKE_KEYS) {
    for (let i = 0; nodes.has(`spoke_${key}_${i}`); i++) {
      const n = nodes.get(`spoke_${key}_${i}`)!;
      const d = Math.hypot(n.x - ex, n.y - ey);
      if (d < jd) {
        jd = d;
        join = n.id;
      }
    }
  }
  chain(`spoke_${sp.spoke.key}`, c.start, join, f.x, f.y, ex, ey, sp.spoke.specs);
  SPOKE_KEYS.push(sp.spoke.key);
}

// Wings: outward branches from each class start. Each class gets an offence notable early on its wing
// and a defence / utility notable at the end, so its archetype is a few points from the start instead
// of a trip through the hub. Generated wings point straight out (deg 0 = the start's own angle).
function wing(id: string, from: string, deg: number, specs: Spec[]) {
  const f = nodes.get(from)!;
  const e = polar(deg, 260);
  chain(id, from, null, f.x, f.y, f.x + e.x, f.y + e.y, specs);
}
for (const { c, deg } of PLACED) {
  for (const w of SPECS.get(c.id)!.wings) wing(w.id, c.start, CLASS_TREE[c.id]?.wings ? w.deg : deg + w.deg, w.specs);
}

// Keystones sit between two neighbouring spokes and hang off both spoke notables (not the hub), so
// each one is close to the classes of its two regions and a long detour for everyone else.
function keystone(id: string, name: string, deg: number, spokes: [string, string], mods: PassiveMods, desc: string[]) {
  if (!spokes.every((k) => nodes.has(`spoke_${k}_2`))) return; // a region left the class list
  const a = polar(deg, 165);
  const b = polar(deg, 235);
  add(`${id}_path`, "Balance", "small", a.x, a.y, { allAttr: 4 });
  for (const k of spokes) link(`spoke_${k}_2`, `${id}_path`);
  add(id, name, "keystone", b.x, b.y, mods, { desc });
  link(`${id}_path`, id);
}
keystone("ks_hollow", "Hollow Vessel", -60, ["int", "dexint"], { lifeMore: -50, barrierMore: 100, barrierRechargeMore: 100 }, ["Your body is an empty jar; the dusk fills it."]);
keystone("ks_phantom", "Phantom Step", 0, ["dexint", "dex"], { dodgeCdRed: 35, iframes: 60, moveInc: 8, armourMore: -100, lifeMore: -15 }, ["Be where the blade is not."]);
keystone("ks_carrion", "Carrion Feast", 60, ["dex", "strdex"], { lifeOnKill: 8, lifeLeech: 3, flaskRecMore: -50, noRegen: 1 }, ["Only the fallen can mend you."]);
keystone("ks_bloodfury", "Bloodfury Oath", 120, ["strdex", "str"], { dmgMore: 30, dmgTakenMore: 15, noRegen: 1 }, ["Swear it, and bleed for it."]);
keystone("ks_stoneheart", "Stoneheart", 180, ["str", "intstr"], { noKnockback: 1, armourMore: 50, lifeMore: 10, dodgeCdMore: 100 }, ["Nothing moves you. Not even you."]);
keystone("ks_ashen", "Ashen Covenant", 240, ["intstr", "int"], { noBarrierRecharge: 1, barrierOnKill: 35, barrierMore: 50 }, ["Embers only rekindle from what burns."]);

// Jewel sockets (PoE2-style): one off the outer node of each spoke. Allocate the socket, then drag a
// jewel from the inventory onto it; its modifiers apply while socketed (server/progression.ts).
for (const key of SPOKE_KEYS) {
  const a = nodes.get(`spoke_${key}_0`)!;
  const len = Math.hypot(a.x, a.y) || 1;
  // Offset sideways from the spoke (perpendicular), a little inward.
  const px = -a.y / len;
  const py = a.x / len;
  const id = `jewel_${key}`;
  add(id, "Jewel Socket", "jewel", a.x + px * 58 - (a.x / len) * 20, a.y + py * 58 - (a.y / len) * 20, {}, {
    desc: ["Drag a jewel from your inventory onto this socket once allocated.", "Right-click a socketed jewel to take it out."],
  });
  link(a.id, id);
}

export const PASSIVE_NODES: PassiveNode[] = [...nodes.values()];
export const JEWEL_SOCKETS: string[] = PASSIVE_NODES.filter((n) => n.kind === "jewel").map((n) => n.id);
export const PASSIVE_BY_ID = new Map(PASSIVE_NODES.map((n) => [n.id, n]));
