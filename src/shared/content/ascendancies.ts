// Ascendancies: three per class (24 total), each a small sub-tree (~11 nodes) with a free root and
// three branches. Points arrive in steps of 2 (see classes.ts), so a player finishes one branch and
// dips into another: 8 points can never take everything. Unlocked mid-match by clearing a trial
// shrine. Every concept and name here is original to this project.
import type { PassiveMods } from "./passives";

export interface AscNode {
  id: string;
  name: string;
  /** "ascStart" is the free root granted on picking the ascendancy. */
  kind: "ascStart" | "small" | "notable";
  x: number; // sub-tree layout (panel units, centred on the root)
  y: number;
  mods: PassiveMods;
  desc?: string[];
  links: string[];
}

export interface AscendancyDef {
  id: string;
  name: string;
  cls: string;
  blurb: string;
  color: string; // panel accent
  nodes: AscNode[];
}

/** [local id, name, mods, flavour?]. A name starting with "~" marks a small node. */
type Step = [nid: string, name: string, mods: PassiveMods, desc?: string];
/** A branch leaves the root at `deg` (-90 = up) and chains its steps outward. */
type Branch = [deg: number, steps: Step[]];

const STEP = 78;

function asc(id: string, name: string, cls: string, blurb: string, color: string, rootMods: PassiveMods, branches: Branch[]): AscendancyDef {
  const root: AscNode = { id: `${id}_root`, name, kind: "ascStart", x: 0, y: 0, mods: rootMods, links: [] };
  const all: AscNode[] = [root];
  for (const [deg, steps] of branches) {
    const a = (deg * Math.PI) / 180;
    let prev = root;
    steps.forEach(([nid, nname, mods, desc], i) => {
      const small = nname.startsWith("~");
      const r = STEP * (i + 1);
      // slight outward fan so long branches don't look ruler-straight
      const bend = a + (i >= 2 ? 0.12 * (i - 1) * Math.sign(Math.cos(a) || 1) : 0);
      const n: AscNode = {
        id: `${id}_${nid}`,
        name: small ? nname.slice(1) : nname,
        kind: small ? "small" : "notable",
        x: Math.round(Math.cos(bend) * r),
        y: Math.round(Math.sin(bend) * r),
        mods,
        links: [prev.id],
        ...(desc ? { desc: [desc] } : {}),
      };
      prev.links.push(n.id);
      all.push(n);
      prev = n;
    });
  }
  return { id, name, cls, blurb, color, nodes: all };
}

const UP = -90, LEFT = 150, RIGHT = 30;

export const ASCENDANCIES: AscendancyDef[] = [
  // ======== Reaver (STR) ========
  asc("bloodsworn", "Bloodsworn", "reaver", "Thrives at the edge of death; every kill feeds the fury.", "#b0281c", { life: 20 }, [
    [UP, [["wrath", "Wrath of the Wounded", { lowLifeDmg: 35 }], ["~vein", "~Open Vein", { lifeLeech: 2 }], ["laststand", "Last Stand", { cheatDeath: 40 }, "Death has to ask twice."], ["redmist", "Red Mist", { lifeLeech: 4, dmgTakenMore: 5 }]]],
    [LEFT, [["tithe", "Red Tithe", { lifeOnKill: 6 }], ["~gorge", "~Gorge", { life: 25 }], ["gorged", "Gorged Fury", { killRushAtk: 20, killRushMove: 10 }]]],
    [RIGHT, [["pact", "Crimson Pact", { regen: 4, lifeInc: 10, flaskRecMore: -30 }], ["~scab", "~Scab Over", { regen: 1 }], ["second", "Second Wind", { secondWind: 30 }]]],
  ]),
  asc("stonewarden", "Stonewarden", "reaver", "An unmovable wall that punishes whoever strikes it.", "#8a8070", { armour: 40 }, [
    [UP, [["granite", "Granite Skin", { armourInc: 50, dmgTakenMore: -8 }], ["~slab", "~Slab", { armour: 40 }], ["thorns", "Thorned Hide", { reflect: 40 }], ["cairn", "Living Cairn", { armourMore: 30, moveInc: -8 }]]],
    [LEFT, [["rooted", "Unmovable", { noKnockback: 1, kbInc: 30 }], ["~footing", "~Footing", { life: 20 }], ["bedrock", "Bedrock", { life: 40, regen: 2 }]]],
    [RIGHT, [["heavy", "Heavy Hand", { dmgMore: 20, atkSpeedMore: -10 }], ["~maul", "~Maul Grip", { kbInc: 15 }], ["quake", "Aftershock", { splash: 30 }, "The ground carries the blow."]]],
  ]),
  asc("pitking", "Pitking", "reaver", "Crowned in a fighting pit. Plays to the crowd and the crowd pays.", "#c8862a", { pvpDmg: 5 }, [
    [UP, [["crowd", "Roar of the Crowd", { trophyDmg: 8 }], ["~purse", "~Purse", { bountyXp: 20 }], ["champion", "Undefeated", { pvpDmg: 15, cheatDeath: 90 }], ["crown", "Iron Crown", { bountyFlask: 1, lifeOnKill: 10 }]]],
    [LEFT, [["brawl", "Brawler's Footing", { arcInc: 30, kbInc: 20 }], ["~scar", "~Pit Scar", { life: 20 }], ["sand", "Sand in the Eyes", { rollStrike: 60 }, "Your roll kicks up the arena floor."]]],
    [RIGHT, [["firstblood", "First Blood", { firstHitDmg: 40 }], ["~jeer", "~Jeer", { dmgInc: 10 }], ["finisher", "Crowd Pleaser", { execute: 12 }]]],
  ]),

  // ======== Harrier (DEX) ========
  asc("windrunner", "Windrunner", "harrier", "Never where the enemy aims. Rolls, strikes, rolls again.", "#5aa070", { moveInc: 5 }, [
    [UP, [["slip", "Slipstream", { postRollDmg: 40 }], ["~gust", "~Gust", { dodgeCdRed: 8 }], ["untouch", "Untouchable", { iframes: 80 }], ["cyclone", "Cyclone Turn", { rollStrike: 70 }]]],
    [LEFT, [["fleet", "Fleet Step", { moveInc: 8, dodgeCdRed: 20 }], ["~breath", "~Second Breath", { regen: 1 }], ["tailwind", "Tailwind", { dodgeHeal: 6 }]]],
    [RIGHT, [["ghost", "Ghostweave", { evasionInc: 40, evadeHaste: 25 }], ["~feather", "~Feather", { evasion: 40 }], ["hitrun", "Hit and Run", { killRushMove: 25, killRushAtk: 10 }]]],
  ]),
  asc("huntmaster", "Huntmaster", "harrier", "Patient, far-reaching, and paid in blood for every rival.", "#b08a3a", { reach: 8 }, [
    [UP, [["patience", "Predator's Patience", { calmDmg: 30 }], ["~hide", "~Blind", { evasion: 40 }], ["steady", "Steady Aim", { stillAtk: 20 }], ["quarry", "Marked Quarry", { firstHitDmg: 50 }]]],
    [LEFT, [["reach", "Long Reach", { reach: 22 }], ["~string", "~Taut String", { dmgInc: 10 }], ["bigGame", "Big Game", { eliteDmg: 35 }]]],
    [RIGHT, [["bounty", "Bounty Hunter", { bountyFlask: 1, bountyXp: 50 }], ["~tally", "~Tally", { pvpDmg: 5 }], ["trophy", "Trophy Wall", { trophyDmg: 8 }]]],
  ]),
  asc("gallowsbow", "Gallowsbow", "harrier", "Executioner of the marshes; ends what others start.", "#6a6a8a", { execute: 4 }, [
    [UP, [["noose", "The Noose", { execute: 8 }], ["~knot", "~Hangman's Knot", { dmgInc: 10 }], ["verdict", "Final Verdict", { execute: 6, eliteDmg: 20 }], ["crows", "Feeding the Crows", { lifeOnKill: 6, chargesOnKill: 2 }]]],
    [LEFT, [["sentence", "Swift Sentence", { atkSpeedMore: 10 }], ["~drop", "~Trapdoor", { reach: 8 }], ["dread", "Gallows Dread", { pvpDmg: 15 }]]],
    [RIGHT, [["warrant", "Standing Warrant", { bountyXp: 40, xpMore: 10 }], ["~ledger", "~Ledger", { atkSpeed: 6 }], ["reprieve", "No Reprieve", { secondWind: 25 }]]],
  ]),

  // ======== Gutterblade (DEX) ========
  asc("alleyknife", "Alleyknife", "gutterblade", "The first cut decides the fight; there is rarely a second.", "#8a2a4a", { firstHitDmg: 15 }, [
    [UP, [["ambush", "Ambush", { firstHitDmg: 40 }], ["~shade", "~Shade", { evasion: 40 }], ["opener", "Perfect Opener", { calmDmg: 35 }], ["vanish", "Vanishing Act", { iframes: 60, evadeHaste: 30 }]]],
    [LEFT, [["quick", "Quick Hands", { atkSpeedMore: 12 }], ["~edge", "~Whetted", { dmgInc: 10 }], ["twist", "Twist the Knife", { lifeLeech: 4 }]]],
    [RIGHT, [["throat", "Open Throat", { execute: 10 }], ["~coin", "~Pickpocket", { chargesOnHit: 1 }], ["gone", "Gone by Morning", { killRushMove: 30 }]]],
  ]),
  asc("ratking", "Ratking", "gutterblade", "Lord of the sewers; survives on scraps and spreads like rot.", "#6a7a3a", { chargesOnKill: 1 }, [
    [UP, [["swarm", "Swarming Bite", { splash: 35 }], ["~gnaw", "~Gnaw", { atkSpeed: 8 }], ["plague", "Plague Bearer", { killNova: 30 }], ["nest", "Nest of Thousands", { splash: 25, killNova: 15 }]]],
    [LEFT, [["scraps", "Living on Scraps", { flaskGainInc: 40, chargesOnHit: 1 }], ["~gut", "~Iron Gut", { life: 20 }], ["sewer", "Sewer Hardened", { resist: 20, regen: 2 }]]],
    [RIGHT, [["scurry", "Scurry", { moveInc: 10, dodgeCdRed: 15 }], ["~burrow", "~Burrow", { evasion: 40 }], ["vermin", "Vermin's Luck", { cheatDeath: 50 }]]],
  ]),
  asc("debtcollector", "Debtcollector", "gutterblade", "Every hit taken is owed back with interest.", "#9a8a5a", { reflect: 10 }, [
    [UP, [["interest", "Compound Interest", { reflect: 30 }], ["~receipt", "~Receipt", { armour: 30 }], ["foreclose", "Foreclosure", { execute: 10, pvpDmg: 10 }], ["default", "Default Notice", { lowLifeDmg: 40 }]]],
    [LEFT, [["collateral", "Collateral", { lifeLeech: 3, life: 20 }], ["~ledger", "~Ledger", { regen: 1 }], ["repossess", "Repossession", { lifeOnKill: 8, barrierOnKill: 15 }]]],
    [RIGHT, [["dues", "Collecting Dues", { bountyXp: 40, bountyFlask: 1 }], ["~levy", "~Levy", { dmgInc: 10 }], ["hounds", "Sent the Hounds", { evadeHaste: 25, postRollDmg: 25 }]]],
  ]),

  // ======== Gloamcaller (INT) ========
  asc("hexweaver", "Hexweaver", "gloamcaller", "Wraps herself in dusk and drinks the souls of the slain.", "#6a5ac8", { barrier: 20 }, [
    [UP, [["veil", "Veil of Dusk", { barrierInc: 40, barrierRechargeMore: 50 }], ["~gauze", "~Gauze", { barrier: 20 }], ["eclipse", "Eclipse", { fullBarrierDmg: 30 }], ["umbral", "Umbral Mantle", { barrierMore: 30, dmgTakenMore: -6 }]]],
    [LEFT, [["siphon", "Soul Siphon", { barrierOnKill: 25 }], ["~sip", "~Sip", { barrierLeech: 2 }], ["drain", "Grave Drink", { barrierLeech: 4, lifeOnKill: 4 }]]],
    [RIGHT, [["mind", "Kindled Mind", { castSpeed: 15, mana: 30 }], ["~thread", "~Black Thread", { spellInc: 10 }], ["hex", "Lingering Hex", { spellInc: 25, dmgMore: 8 }]]],
  ]),
  asc("mothwarden", "Mothwarden", "gloamcaller", "A cloud of pale moths guards her and gnaws at whoever comes close.", "#c8c0e0", { evasion: 30 }, [
    [UP, [["cloud", "Mothcloud", { evasionInc: 40, barrierInc: 20 }], ["~wing", "~Dust Wing", { evasion: 40 }], ["flurry", "Gnawing Flurry", { reflect: 30, rollStrike: 40 }], ["lantern", "Drawn to the Flame", { evadeHaste: 30, dodgeBarrier: 15 }]]],
    [LEFT, [["cocoon", "Cocoon", { secondWind: 35 }], ["~silk", "~Silk", { barrier: 20 }], ["molt", "Molting", { dodgeBarrier: 20, dodgeCdRed: 10 }]]],
    [RIGHT, [["pale", "Pale Swarm", { splash: 30 }], ["~dust", "~Wingdust", { resist: 10 }], ["devour", "Devouring Night", { killNova: 30, barrierOnKill: 10 }]]],
  ]),
  asc("dirgesinger", "Dirgesinger", "gloamcaller", "Sings the dying down; each death is a verse that strengthens the song.", "#5a3a6a", { mana: 20 }, [
    [UP, [["dirge", "Funeral Dirge", { killNova: 25 }], ["~hum", "~Low Hum", { spellInc: 10 }], ["requiem", "Requiem", { killRushAtk: 20, castSpeed: 10 }], ["chorus", "Chorus of the Fallen", { trophyDmg: 10, xpMore: 10 }]]],
    [LEFT, [["lament", "Lament", { lifeOnKill: 5, barrierOnKill: 15 }], ["~breath", "~Breath Control", { manaRegenInc: 25 }], ["hush", "The Hush", { calmDmg: 30, castSpeed: 8 }]]],
    [RIGHT, [["knell", "Death Knell", { execute: 10 }], ["~verse", "~Verse", { mana: 25 }], ["elegy", "Elegy", { bountyXp: 50, bountyFlask: 1 }]]],
  ]),

  // ======== Lanternwright (INT) ========
  asc("pyrebinder", "Pyrebinder", "lanternwright", "Turns every kill into kindling for the next.", "#d8682a", { resist: 10 }, [
    [UP, [["burst", "Cinder Burst", { killNova: 35 }], ["~coal", "~Coal", { spellInc: 10 }], ["pyre", "Pyre Heart", { killNova: 25, spellInc: 25 }], ["wildfire", "Wildfire", { splash: 30 }]]],
    [LEFT, [["ember", "Ember Ward", { resist: 25 }], ["~ash", "~Ash", { barrier: 20 }], ["phoenix", "Out of the Ashes", { cheatDeath: 60, secondWind: 20 }]]],
    [RIGHT, [["kindle", "Kindling", { dmgMore: 12, spellInc: 15 }], ["~flint", "~Flint", { castSpeed: 6 }], ["ashstep", "Ash Step", { postRollDmg: 25, dodgeCdRed: 10 }]]],
  ]),
  asc("beaconkeeper", "Beaconkeeper", "lanternwright", "Keeps the light lit at any cost; the lamp shields and guides.", "#e8c860", { barrier: 25 }, [
    [UP, [["beacon", "Steady Beacon", { stillAtk: 20, castSpeed: 15 }], ["~wick", "~Trimmed Wick", { barrierInc: 15 }], ["lighthouse", "Lighthouse", { fullBarrierDmg: 30, reach: 10 }], ["guide", "Guiding Light", { xpMore: 15, moveInc: 6 }]]],
    [LEFT, [["glass", "Storm Glass", { barrierInc: 40, barrierRechargeMore: 40 }], ["~shutter", "~Shutter", { resist: 10 }], ["ward", "Lamp Ward", { dmgTakenMore: -10 }]]],
    [RIGHT, [["flare", "Flare", { rollStrike: 60 }], ["~oil", "~Lamp Oil", { mana: 25 }], ["signal", "Signal Fire", { dodgeBarrier: 20 }]]],
  ]),
  asc("tallowsworn", "Tallowsworn", "lanternwright", "Burns her own body as fuel. Brilliant, brief and terrifying.", "#d8b090", { spellInc: 10 }, [
    [UP, [["burn", "Burn Both Ends", { dmgMore: 25, lifeMore: -15 }], ["~melt", "~Melt", { castSpeed: 8 }], ["gutter", "Guttering Flame", { lowLifeDmg: 50 }], ["inferno", "Last Light", { cheatDeath: 45 }]]],
    [LEFT, [["wax", "Waxen Skin", { barrierLeech: 3 }], ["~drip", "~Drip", { life: 20 }], ["remold", "Remolded", { lifeLeech: 3, regen: 2 }]]],
    [RIGHT, [["wick", "Long Wick", { killRushAtk: 25 }], ["~smoke", "~Smoke", { evasion: 40 }], ["snuff", "Snuff Out", { execute: 12 }]]],
  ]),

  // ======== Drifter (STR/DEX) ========
  asc("edgewalker", "Edgewalker", "drifter", "A whirling blade that slips every answer.", "#c8c0a8", { atkSpeed: 5 }, [
    [UP, [["whirl", "Whirling Edge", { arcInc: 40, kbInc: 20 }], ["~spin", "~Spin", { atkSpeed: 6 }], ["dance", "Dance of Knives", { postRollDmg: 30, killRushAtk: 15 }], ["storm", "Steel Storm", { rollStrike: 80 }]]],
    [LEFT, [["flurry", "Flurry", { atkSpeedMore: 15 }], ["~hilt", "~Hilt Wrap", { dmgInc: 10 }], ["cleave", "Clean Through", { splash: 25 }]]],
    [RIGHT, [["riposte", "Riposte", { evasion: 80, evadeHaste: 20, reflect: 20 }], ["~guard", "~High Guard", { armour: 30 }], ["poise", "Poise", { calmDmg: 20, armour: 40 }]]],
  ]),
  asc("oathbreaker", "Oathbreaker", "drifter", "Loots the dead and wears their luck. Grows with every rival felled.", "#a07a3a", { flaskGainInc: 20 }, [
    [UP, [["spoils", "Spoils of War", { trophyDmg: 7, bountyXp: 30 }], ["~coin", "~Dead Man's Coin", { pvpDmg: 5 }], ["blood", "Blood Money", { bountyFlask: 1, lifeOnKill: 4 }], ["turncoat", "Turncoat", { pvpDmg: 20, dmgTakenMore: 5 }]]],
    [LEFT, [["plunder", "Plunderer", { chargesOnKill: 3, flaskRecInc: 30 }], ["~pouch", "~Pouch", { flaskGainInc: 15 }], ["survivor", "Survivor's Luck", { cheatDeath: 60, life: 20 }]]],
    [RIGHT, [["scrapper", "Dirty Scrapper", { dmgInc: 20, kbInc: 20 }], ["~boot", "~Boot", { moveInc: 4 }], ["cheap", "Cheap Shot", { firstHitDmg: 35 }]]],
  ]),
  asc("roadwarden", "Roadwarden", "drifter", "Walks the long roads and keeps them; tireless, patient, hard to stop.", "#7a8a6a", { life: 15 }, [
    [UP, [["miles", "Thousand Miles", { moveInc: 10, regen: 2 }], ["~pack", "~Pack", { life: 25 }], ["milestone", "Milestone", { xpMore: 15, lifeInc: 8 }], ["toll", "Road Toll", { eliteDmg: 30, chargesOnKill: 2 }]]],
    [LEFT, [["shield", "Wayshield", { armourInc: 40, dmgTakenMore: -6 }], ["~cloak", "~Road Cloak", { resist: 10 }], ["stand", "Hold the Bridge", { noKnockback: 1, stillAtk: 15 }]]],
    [RIGHT, [["canteen", "Canteen", { flaskRecInc: 40, chargesOnHit: 1 }], ["~bread", "~Hard Bread", { regen: 1 }], ["rest", "Roadside Rest", { secondWind: 30 }]]],
  ]),

  // ======== Mistrunner (DEX/INT) ========
  asc("fogdancer", "Fogdancer", "mistrunner", "Strikes from the haze and is gone before the mist settles.", "#9ab0b8", { evasion: 30 }, [
    [UP, [["haze", "Haze Step", { rollStrike: 60, dodgeCdRed: 10 }], ["~mist", "~Mist", { evasion: 40 }], ["veil", "Veiled Strike", { postRollDmg: 40 }], ["phantasm", "Phantasm", { iframes: 70, evadeHaste: 25 }]]],
    [LEFT, [["damp", "Damp Air", { barrierInc: 30, evasionInc: 20 }], ["~dew", "~Dew", { regen: 1 }], ["condense", "Condense", { dodgeBarrier: 20 }]]],
    [RIGHT, [["sweep", "Staff Sweep", { arcInc: 40, reach: 10 }], ["~pole", "~Long Pole", { reach: 6 }], ["tide", "Turning Tide", { splash: 25, kbInc: 20 }]]],
  ]),
  asc("marshlight", "Marshlight", "mistrunner", "Lures prey into the bog with false lights, then feeds.", "#7ac8a0", { barrier: 20 }, [
    [UP, [["lure", "False Light", { firstHitDmg: 35 }], ["~glow", "~Glow", { spellInc: 10 }], ["wisp", "Wisp Swarm", { killNova: 30 }], ["drown", "Drowning Pull", { execute: 10 }]]],
    [LEFT, [["bog", "Bog Drink", { barrierLeech: 3, lifeLeech: 2 }], ["~reed", "~Reed", { barrier: 20 }], ["peat", "Peat Skin", { resist: 20, armour: 40 }]]],
    [RIGHT, [["willo", "Will-o'-Wander", { moveInc: 8, evadeHaste: 20 }], ["~swamp", "~Swamp Gas", { castSpeed: 6 }], ["sink", "Sinkhole", { rollStrike: 50, kbInc: 30 }]]],
  ]),
  asc("reedpilgrim", "Reedpilgrim", "mistrunner", "A wandering ascetic; bends like the reed and never breaks.", "#b8a87a", { regen: 1 }, [
    [UP, [["bend", "Bend, Don't Break", { secondWind: 35 }], ["~fast", "~Fasting", { lifeInc: 6 }], ["serene", "Serenity", { calmDmg: 30, regen: 2 }], ["enlight", "Stillwater", { stillAtk: 20, dmgTakenMore: -8 }]]],
    [LEFT, [["breath", "Measured Breath", { dodgeHeal: 6, dodgeCdRed: 10 }], ["~stride", "~Stride", { moveInc: 4 }], ["pilgrim", "Long Pilgrimage", { xpMore: 15, moveInc: 6 }]]],
    [RIGHT, [["staff", "Pilgrim's Staff", { kbInc: 30, arcInc: 20 }], ["~prayer", "~Prayer", { resist: 10 }], ["humble", "Humbling Blow", { pvpDmg: 15, eliteDmg: 15 }]]],
  ]),

  // ======== Bellwarden (INT/STR) ========
  asc("toller", "Toller", "bellwarden", "Every swing rings the bell; the toll shakes everything nearby.", "#c8a050", { kbInc: 10 }, [
    [UP, [["peal", "Great Peal", { splash: 35 }], ["~clapper", "~Clapper", { dmgInc: 10 }], ["resound", "Resounding", { splash: 20, kbInc: 30 }], ["deaf", "Deafening Toll", { rollStrike: 80 }]]],
    [LEFT, [["bronze", "Bronze Shell", { armourInc: 40, barrierInc: 20 }], ["~rim", "~Rim", { armour: 30 }], ["hum", "Lingering Hum", { reflect: 30 }]]],
    [RIGHT, [["hour", "Strike the Hour", { atkSpeedMore: 10 }], ["~rope", "~Bellrope", { reach: 8 }], ["knell", "Last Knell", { execute: 10 }]]],
  ]),
  asc("shrinekeeper", "Shrinekeeper", "bellwarden", "Tends the old shrines; their trials bend in her favour.", "#a0b0d0", { resist: 10 }, [
    [UP, [["vigil", "Long Vigil", { barrierInc: 30, regen: 2 }], ["~candle", "~Candle", { barrier: 20 }], ["sanctum", "Sanctum", { dmgTakenMore: -10 }], ["relic", "Living Relic", { cheatDeath: 50, barrierMore: 20 }]]],
    [LEFT, [["offering", "Offerings", { xpMore: 15, eliteDmg: 20 }], ["~alms", "~Alms", { chargesOnKill: 1 }], ["blessing", "Shrine Blessing", { lifeOnKill: 5, barrierOnKill: 15 }]]],
    [RIGHT, [["censer", "Swinging Censer", { arcInc: 30, splash: 15 }], ["~incense", "~Incense", { resist: 10 }], ["sanctify", "Sanctified Ground", { stillAtk: 15, calmDmg: 20 }]]],
  ]),
  asc("ironcantor", "Ironcantor", "bellwarden", "Chants war-hymns in an iron voice; the song hardens body and blade.", "#8a8a9a", { armour: 30 }, [
    [UP, [["hymn", "War Hymn", { dmgMore: 15, atkSpeed: 8 }], ["~verse", "~Iron Verse", { dmgInc: 10 }], ["crescendo", "Crescendo", { killRushAtk: 20, killRushMove: 10 }], ["anthem", "Anthem of Ruin", { trophyDmg: 8, pvpDmg: 10 }]]],
    [LEFT, [["chant", "Iron Chant", { armourMore: 25, lifeInc: 8 }], ["~lung", "~Iron Lung", { life: 25 }], ["unbowed", "Unbowed", { noKnockback: 1, secondWind: 25 }]]],
    [RIGHT, [["cadence", "Marching Cadence", { moveInc: 8, dodgeCdRed: 10 }], ["~drum", "~Drum", { atkSpeed: 6 }], ["refrain", "Refrain", { dodgeHeal: 5, dodgeBarrier: 10 }]]],
  ]),
];

export const ASC_BY_ID = new Map(ASCENDANCIES.map((a) => [a.id, a]));
export const ASC_NODE_BY_ID = new Map(ASCENDANCIES.flatMap((a) => a.nodes.map((n) => [n.id, n] as const)));
