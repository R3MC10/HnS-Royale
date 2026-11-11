// The passive tree ("the Lattice"): an original, royale-sized tree (~110 nodes). Eight class starts
// sit on an outer ring split into six attribute regions (INT, DEX/INT, DEX, STR/DEX, STR, INT/STR;
// the pure DEX and INT regions hold two classes each). The ring is shared travel, six spokes lead
// to a central hub, keystones sit between the spokes and every class has an outward wing.
// Stat keys are documented in PASSIVE_LABELS; the math lives in src/shared/progression.ts.

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
  | "killNova" // on kill, % of the victim's max life dealt to enemies within 160 px
  | "bountyFlask" // player kills refill flasks (1)
  | "bountyXp" // % more XP from player kills
  | "trophyDmg" // % more damage per player killed this match (max 5 stacks)
  | "evadeHaste" // % movement speed for 1.5 s after evading a hit
  | "chargesOnKill" // + flask charges per kill
  | "lifeLeech" // % of hit damage dealt recovered as life
  | "barrierLeech" // % of hit damage dealt recovered as barrier
  | "splash" // % of hit damage dealt to other monsters near a monster you hit
  | "execute" // monsters you hit below this % of life die
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
  killNova: "Enemies you kill burst, dealing {v}% of their maximum Life to monsters nearby",
  bountyFlask: "Killing a player refills your Flasks",
  bountyXp: "{v}% more Experience from killing players",
  trophyDmg: "{v}% more Damage per player you have killed this match (up to 5)",
  evadeHaste: "{v}% increased Movement Speed for 1.5s after Evading a Hit",
  chargesOnKill: "+{v} Flask Charges on Kill",
  lifeLeech: "{v}% of Hit damage dealt is recovered as Life",
  barrierLeech: "{v}% of Hit damage dealt is recovered as Barrier",
  splash: "Hits splash {v}% of their damage onto monsters near the target",
  execute: "Monsters you Hit below {v}% Life are slain outright",
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

/** Class starts on the ring (degrees; -90 = up). */
const STARTS: [cls: string, name: string, deg: number, mods: PassiveMods][] = [
  ["gloamcaller", "Gloamcaller's Mark", -104, { int: 8 }],
  ["lanternwright", "Lanternwright's Mark", -76, { int: 8 }],
  ["mistrunner", "Mistrunner's Mark", -30, { dex: 4, int: 4 }],
  ["harrier", "Harrier's Mark", 16, { dex: 8 }],
  ["gutterblade", "Gutterblade's Mark", 44, { dex: 8 }],
  ["drifter", "Drifter's Mark", 90, { str: 4, dex: 4 }],
  ["reaver", "Reaver's Mark", 150, { str: 8 }],
  ["bellwarden", "Bellwarden's Mark", 210, { int: 4, str: 4 }],
];
for (const [cls, name, deg, mods] of STARTS) {
  const p = polar(deg, R);
  add(`start_${cls}`, name, "start", p.x, p.y, mods, { cls });
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

// The ring. Gate nodes join the two classes of a shared pure region; the region's spoke starts there.
arc("gate_int", "start_gloamcaller", "start_lanternwright", -104, -76, [{ name: "Gate of the Mind", mods: { int: 10 } }]);
arc("ring_lm", "start_lanternwright", "start_mistrunner", -76, -30, [
  S({ barrier: 12 }), S({ int: 6 }), N("Lamplit Fog", { evasion: 30, barrier: 20, dex: 5, int: 5 }), S({ evasion: 25 }),
]);
arc("ring_mh", "start_mistrunner", "start_harrier", -30, 16, [
  S({ dex: 6 }), S({ castSpeed: 4 }), N("Quickened Mind", { castSpeed: 8, atkSpeed: 6 }), S({ atkSpeed: 4 }),
]);
arc("gate_dex", "start_harrier", "start_gutterblade", 16, 44, [{ name: "Gate of the Hand", mods: { dex: 10 } }]);
arc("ring_gd", "start_gutterblade", "start_drifter", 44, 90, [
  S({ moveInc: 3 }), S({ evasionInc: 12 }), N("Road-Worn Soles", { moveInc: 6, dodgeCdRed: 10 }), S({ dex: 6 }),
]);
arc("ring_dr", "start_drifter", "start_reaver", 90, 150, [
  S({ str: 6 }), S({ dmgInc: 6 }), N("Scarred Veteran", { life: 20, armour: 30, dmgInc: 8 }), S({ life: 10 }), S({ armour: 20 }),
]);
arc("ring_rb", "start_reaver", "start_bellwarden", 150, 210, [
  S({ str: 6 }), S({ regen: 0.6 }), N("Blood and Bronze", { life: 15, armour: 25, resist: 8 }), S({ armourInc: 10 }), S({ resist: 6 }),
]);
arc("ring_bg", "start_bellwarden", "start_gloamcaller", 210, 256, [
  S({ int: 6 }), S({ barrierInc: 10 }), N("Candle Litany", { barrier: 15, regen: 1, resist: 8, spirit: 15 }), S({ barrier: 12 }),
]);

// Spokes from each region to the hub.
const SPOKES: [key: string, from: string, specs: Spec[]][] = [
  ["int", "gate_int_0", [S({ barrier: 10 }), S({ mana: 10 }), N("Gathered Dusk", { barrierInc: 20, manaInc: 15, spirit: 20 }), S({ int: 6 })]],
  ["dexint", "start_mistrunner", [S({ evasion: 25 }), S({ barrier: 10 }), N("Drifting Haze", { evasionInc: 15, barrierInc: 15 }), S({ dex: 3, int: 3 })]],
  ["dex", "gate_dex_0", [S({ atkSpeed: 4 }), S({ evasion: 25 }), N("Hunter's Cadence", { atkSpeed: 10, moveInc: 3, spirit: 15 }), S({ dex: 6 })]],
  ["strdex", "start_drifter", [S({ dmgInc: 6 }), S({ flaskRecInc: 10 }), N("Sellsword's Habit", { dmgInc: 8, atkSpeed: 5, flaskGainInc: 15 }), S({ str: 3, dex: 3 })]],
  ["str", "start_reaver", [S({ life: 10 }), S({ dmgInc: 6 }), N("Heavy Hands", { dmgInc: 14, kbInc: 15, spirit: 15 }), S({ str: 6 })]],
  ["intstr", "start_bellwarden", [S({ armour: 20 }), S({ barrier: 10 }), N("Tempered Faith", { armourInc: 15, barrierInc: 15, resist: 6, spirit: 15 }), S({ int: 3, str: 3 })]],
];
for (const [key, from, specs] of SPOKES) {
  const f = nodes.get(from)!;
  chain(`spoke_${key}`, from, "hub", f.x, f.y, 0, 0, specs);
}

// Wings: outward branches from each class start (3 small + a notable).
function wing(id: string, from: string, deg: number, specs: Spec[]) {
  const f = nodes.get(from)!;
  const e = polar(deg, 260);
  chain(id, from, null, f.x, f.y, f.x + e.x, f.y + e.y, specs);
}
wing("wing_gloamcaller", "start_gloamcaller", -118, [S({ barrier: 12 }), S({ barrierInc: 10 }), S({ resist: 6 }), N("Veilwright", { barrierInc: 30, barrier: 20 })]);
wing("wing_lanternwright", "start_lanternwright", -62, [S({ mana: 10 }), S({ castSpeed: 4 }), S({ spellInc: 8 }), N("Ember Lexicon", { spellInc: 20, castSpeed: 8, manaRegenInc: 20 })]);
wing("wing_mistrunner", "start_mistrunner", -30, [S({ evasion: 25 }), S({ regen: 0.5 }), S({ dodgeCdRed: 6 }), N("Tidal Footing", { evasion: 40, dodgeCdRed: 10, regen: 1 })]);
wing("wing_harrier", "start_harrier", 4, [S({ atkSpeed: 4 }), S({ reach: 6 }), S({ dmgInc: 6 }), N("Long Shadow", { reach: 18, dmgInc: 10 })]);
wing("wing_gutterblade", "start_gutterblade", 56, [S({ evasion: 25 }), S({ evasionInc: 12 }), S({ dodgeCdRed: 6 }), N("Shadow Footwork", { evasionInc: 30, dodgeCdRed: 12 })]);
wing("wing_drifter", "start_drifter", 90, [S({ flaskGainInc: 10 }), S({ flaskRecInc: 10 }), S({ arcInc: 6 }), N("Hip Flask", { flaskRecInc: 25, flaskGainInc: 25, arcInc: 10 })]);
wing("wing_reaver_0", "start_reaver", 126, [S({ armour: 20 }), S({ armourInc: 12 }), S({ life: 10 }), N("Tempered Hide", { armour: 50, armourInc: 25, life: 15 })]);
wing("wing_reaver_1", "start_reaver", 174, [S({ life: 12 }), S({ lifeInc: 5 }), S({ regen: 0.6 }), N("Iron Gut", { lifeInc: 12, regen: 1.5 })]);
wing("wing_bellwarden", "start_bellwarden", 210, [S({ armour: 20 }), S({ barrier: 12 }), S({ lifeInc: 4 }), N("Bronze Lungs", { armour: 40, barrier: 20, lifeInc: 6 })]);

// Keystones: hub -> path node -> keystone, one between each pair of spokes.
function keystone(id: string, name: string, deg: number, mods: PassiveMods, desc: string[]) {
  const a = polar(deg, 115);
  const b = polar(deg, 210);
  add(`${id}_path`, "Balance", "small", a.x, a.y, { allAttr: 4 });
  link("hub", `${id}_path`);
  add(id, name, "keystone", b.x, b.y, mods, { desc });
  link(`${id}_path`, id);
}
keystone("ks_hollow", "Hollow Vessel", -60, { lifeMore: -50, barrierMore: 100, barrierRechargeMore: 100 }, ["Your body is an empty jar; the dusk fills it."]);
keystone("ks_phantom", "Phantom Step", 0, { dodgeCdRed: 35, iframes: 60, moveInc: 8, armourMore: -100, lifeMore: -15 }, ["Be where the blade is not."]);
keystone("ks_carrion", "Carrion Feast", 60, { lifeOnKill: 8, flaskRecMore: -50, noRegen: 1 }, ["Only the fallen can mend you."]);
keystone("ks_bloodfury", "Bloodfury Oath", 120, { dmgMore: 35, dmgTakenMore: 20, noRegen: 1 }, ["Swear it, and bleed for it."]);
keystone("ks_stoneheart", "Stoneheart", 180, { noKnockback: 1, armourMore: 40, dodgeCdMore: 100 }, ["Nothing moves you. Not even you."]);
keystone("ks_ashen", "Ashen Covenant", 240, { noBarrierRecharge: 1, barrierOnKill: 35, barrierMore: 50 }, ["Embers only rekindle from what burns."]);

// Jewel sockets (PoE2-style): one off the outer node of each spoke. Allocate the socket, then drag a
// jewel from the inventory onto it; its modifiers apply while socketed (server/progression.ts).
for (const [key] of SPOKES) {
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
