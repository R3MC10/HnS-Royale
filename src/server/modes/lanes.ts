// Breachway: the lane mode (docs/MODE-LANES.md, P0 + elites + rogue exiles). Two teams, one lane,
// waves of roster monsters, spires / Ward / Core, a gold and XP purse, a Quartermaster shop, respawns.
// No full loot: deaths keep gear, monsters drop nothing. The royale never creates this object.
import { DT, PLAYER_RADIUS } from "../../shared/constants";
import { BASES } from "../../shared/content/bases";
import { MONSTER_BY_ID, type MonsterType } from "../../shared/content/monsters";
import type { AttackDef } from "../../shared/content/monsters/types";
import { monsterLevelScale } from "../../shared/content/monsters/mods";
import { isGem } from "../../shared/skills";
import { ROUGH_SKILL, ROUGH_SPIRIT, ROUGH_SUPPORT } from "../../shared/content/gems";
import type { Item, Rarity } from "../../shared/items";
import {
  ASSIST_WINDOW, CORE_RANGE, GAMBLE_BASE, LANE, LANE_LEVEL_CAP, SELL_FRACTION, SPIRE_RANGE, SPIRIT_LEVEL, SPIRIT_PRICE, STRUCT_KINDS, STRUCT_X, SUPPORT_TIERS, TEAM_NAMES, TEAM_PLAYER_COLORS,
  gamblePrice, laneSellValue, maxCrystalLevel, onPlatform, skillCrystalPrice, type StructKind, type Team,
} from "../../shared/lanes";
import type { LaneMsg } from "../../shared/protocol";
import {
  ENHANCE_KINDS, REINF_CAP, REINF_KINDS, REINF_NAME, enhanceBlock, enhancePrice, forgeStep, qualityCur, reinfPrice, runesFor, uniquesFor,
  type EnhanceKind, type ReinfKind,
} from "../../shared/laneshop";
import { CURRENCY_BY_ID, MAX_QUALITY } from "../../shared/content/currency";
import { applyEffect, applyRune, findOwned, makeUnique } from "../crafting";
import { refreshStats } from "../inventory";
import { chooseAttack, integrate, startAttack, stepWindup } from "../ai/brain";
import type { Game } from "../game";
import { autoPlace, carriedItem, dropById, storeItem } from "../inventory";
import { rollFlask, rollItem } from "../loot";
import type { Camp, Monster, MonsterSystem, Projectile } from "../monsters";
import { esOf } from "../damage";
import { isWalkable } from "../../shared/map";
import { WAYPOINT_CHANNEL, WAYPOINT_KINDS, WAYPOINT_USE_R, waypointAt, type WaypointKind } from "../../shared/lanes";
import type { ServerPlayer } from "../player";
import { gainXp, levelCap, playerLevel } from "../progression";
import { makeRough } from "../skills";
import { laneHook } from "./lanehook";
import { MAX_LEVEL } from "../../shared/content/classes";

type Kind = "mob" | "elite" | "exile" | "struct";

interface Unit {
  m: Monster;
  team: Team;
  kind: Kind;
  sk?: StructKind;
  /** Purse weight (1 normal, 3 magic, 5 rare). */
  w: number;
  /** Wave purse per weight point at spawn time. */
  gold: number;
  xp: number;
  /** Personal march line (spread so a wave does not walk single file). */
  laneY: number;
  /** Enemy player that hit it (switch target for 3 s). */
  aggroP: number;
  aggroT: number;
  /** Current unit target (enemy mob / structure), or null. */
  tu: Unit | null;
  scanT: number;
  // structures
  fireT: number;
  boltOn: number; // id of the player the last bolts hit
  boltN: number; // consecutive bolts on that player
  hitT: number; // fight time of the last hit taken (Core regen)
  // exiles: march pace relative to the wave (exilePace)
  pace: number;
  paceT: number;
}

/** Doc section 5 / 6 / 7 numbers. */
const N = {
  firstWave: 30,
  /** Wave walking speed (was 150 on the 7168-wide map; 200 keeps first contact near 23 s on the 12288 one). */
  march: 200,
  /** Jungle camps: gold per kill by rarity, xp per kill (x lane level), refill delay after a clear. */
  campGold: [16, 40, 90],
  campXp: [8, 18, 40],
  campRespawn: 60,
  aggro: 380,
  offLane: 500,
  spireRange: SPIRE_RANGE,
  coreRange: CORE_RANGE,
  boltEvery: 1.2,
  boltSpeed: 700,
  boltMob: 0.3,
  boltElite: 0.15,
  boltExile: 0.1,
  /** The Core hits lane units softer than the spires (a wave must be able to reach it). */
  coreMobMult: 0.6,
  mobStructMult: 4,
  eliteStructMult: 7,
  fortifyUntil: 240,
  backdoorR: 600,
  wardRespawn: 120,
  coreRegenDelay: 8,
  goldStart: 150,
  goldPassive: 2,
  goldPassiveFrom: 20,
  xpPassive: 0.6,
  purseR: 1200,
  killGold: 120,
  /** Each ally of the killer who hurt the victim in the last ASSIST_WINDOW s. */
  assistGold: 50,
  exileGold: 100,
  exileLife: 2.5,
  structGold: { lane_outer: 80, lane_inner: 120, lane_ward: 160, lane_core: 0 } as Record<StructKind, number>,
  /** Structure energy shield: share of max life, recharge delay after a hit (s), recharge per second (share of max). */
  structEs: 0.25,
  structEsDelay: 4,
  structEsRate: 0.125,
  structLife: { lane_outer: 4500, lane_inner: 7200, lane_ward: 5000, lane_core: 9000 } /* doc x0.6: the sim ran 30+ min */ as Record<StructKind, number>,
  pvpMult: 0.6,
};

const waveEvery = (t: number) => (t >= 900 ? 15 : t >= 600 ? 20 : 25);
/** Late siege: every hit on a structure grows from 12:00 so a match ends in about 15-20 minutes. */
const siegeMult = (t: number) => (t >= 1200 ? 2 : t >= 900 ? 1.5 : t >= 720 ? 1.25 : 1);

export class LaneMode {
  /** Fight seconds. */
  t = 0;
  wave = 0;
  nextWave = N.firstWave;
  winner: Team | null = null;
  kills: [number, number] = [0, 0];
  readonly gold = new Map<number, number>();
  private readonly xpAcc = new Map<number, number>();
  private readonly respawnAt = new Map<number, number>();
  private readonly units = new Map<Monster, Unit>();
  /** Structures per team by kind (null = destroyed). */
  private readonly structs: [Map<StructKind, Unit | null>, Map<StructKind, Unit | null>] = [new Map(), new Map()];
  /** Ward respawn time (fight seconds) per team whose Ward is down. */
  private readonly wardBack: [number, number] = [0, 0];
  /** Gamble pity: non-rare results in a row per player. */
  private readonly pity = new Map<number, number>();
  /** Enemy player id -> fight time they last hit a player of the other team (spire call for help). */
  private readonly pvpAt = new Map<number, number>();
  /** Victim player id -> attacker id -> fight time of the attacker's last hit on them (assists). */
  private readonly hurtBy = new Map<number, Map<number, number>>();
  private teamSize = 1;
  /** Jungle camps (one per LANE.glades entry) and their refill timers (fight time, 0 = not cleared). */
  private jungle: { camp: Camp; tier: number; clearedAt: number }[] = [];
  private readonly jungleMons = new Set<Monster>();
  /** Waypoint travel in progress: target, finish time, life + shield when it started (damage cancels). */
  private readonly chan = new Map<number, { to: WaypointKind; at: number; hp: number; fx: number; fy: number }>();
  /** Reinforcement pots per team per unit: gold in the pot and who put it there (name -> gold). */
  private readonly pots: [Map<ReinfKind, { have: number; who: Map<string, number> }>, Map<ReinfKind, { have: number; who: Map<string, number> }>] = [new Map(), new Map()];
  /** Funded units waiting for each team's next wave. */
  private readonly queued: [ReinfKind[], ReinfKind[]] = [[], []];

  constructor(private readonly g: Game) {}

  // ---- setup -------------------------------------------------------------------------------

  /** Called at the countdown, on the lane map. Teams must already be set (or are split here). */
  start(ps: ServerPlayer[]) {
    const counts = [0, 0];
    for (const p of ps) if (p.team !== undefined) counts[p.team]++;
    for (const p of ps) if (p.team === undefined) p.team = counts[0] <= counts[1] ? 0 : 1, counts[p.team]++;
    this.teamSize = Math.max(1, counts[0], counts[1]);
    const ci = [0, 0];
    for (const p of ps) {
      const tm = p.team!;
      p.color = TEAM_PLAYER_COLORS[tm][ci[tm]++ % TEAM_PLAYER_COLORS[tm].length];
      this.gold.set(p.id, N.goldStart);
    }
    laneHook.active = true;
    laneHook.think = (sys, m, players) => this.think(sys, m, players);
    laneHook.incoming = (m, dmg, by) => this.incoming(m, dmg, by);
    laneHook.friendly = (t, by, mon) => this.friendly(t, by, mon);
    laneHook.trialSpawn = (m) => this.setLevel(m, this.laneLevel());
    levelCap.v = LANE_LEVEL_CAP;
    const sys = this.g.monsters;
    sys.camps = [];
    sys.monsters.clear();
    sys.projectiles = [];
    sys.hazards = [];
    for (const team of [0, 1] as Team[]) for (const k of STRUCT_KINDS) this.spawnStruct(team, k);
    // Jungle camps: registered with the monster system (camp snapshots, minimap status), filled here.
    this.jungle = LANE.glades.map((gl, i) => {
      const camp: Camp = { id: 9000 + i, x: gl.x, y: gl.y, monsters: [], clearedFor: 0, tier: gl.tier };
      sys.camps.push(camp);
      return { camp, tier: gl.tier, clearedAt: 0 };
    });
    for (const j of this.jungle) this.fillCamp(j);
  }

  private fillCamp(j: { camp: Camp; tier: number; clearedAt: number }) {
    const [rushT, rangedT] = this.families().map((id) => MONSTER_BY_ID.get(id)!) as [MonsterType, MonsterType];
    const lvl = this.laneLevel() + j.tier;
    const list: [MonsterType, 0 | 1 | 2][] = [[rushT, 0], [rushT, 0], [rangedT, 0], [rushT, 1]];
    if (j.tier) list.push([rangedT, 0], [rushT, 2]);
    list.forEach(([t, r], i) => {
      const a = (i / list.length) * Math.PI * 2;
      let at = { x: j.camp.x + Math.cos(a) * 90, y: j.camp.y + Math.sin(a) * 60 };
      if (!isWalkable(at.x, at.y, 30)) at = { x: j.camp.x, y: j.camp.y };
      const m = this.g.monsters.spawnMonster(j.camp, t, r === 2, at, r);
      this.setLevel(m, lvl);
      this.jungleMons.add(m);
    });
    j.clearedAt = 0;
  }

  private jungleTick() {
    for (const j of this.jungle) {
      if (j.camp.monsters.some((m) => m.alive)) continue;
      if (!j.clearedAt) j.clearedAt = this.t;
      else if (this.t - j.clearedAt >= N.campRespawn && !this.g.joined.some((p) => p.alive && Math.hypot(p.x - j.camp.x, p.y - j.camp.y) < 700)) this.fillCamp(j);
    }
  }

  /** A jungle monster died: the killer is paid, allies near it share some experience. */
  private jungleKill(m: Monster, killer: ServerPlayer | null) {
    this.jungleMons.delete(m);
    if (!killer || killer.team === undefined) return;
    const r = Math.min(2, (m as unknown as { rarity?: number }).rarity ?? (m.elite ? 2 : 0));
    this.addGold(killer, N.campGold[r], true);
    const xp = N.campXp[r] * (1 + 0.15 * this.laneLevel());
    this.addXp(killer, xp);
    for (const p of this.g.joined) if (p !== killer && p.alive && p.team === killer.team && Math.hypot(p.x - m.x, p.y - m.y) < 900) this.addXp(p, xp * 0.5);
  }

  // ---- waypoints ---------------------------------------------------------------------------------

  /** Own waypoints standing now (base always; the others while their structure stands). */
  standingWaypoints(team: Team): WaypointKind[] {
    return WAYPOINT_KINDS.filter((k) => k === "base" || !!this.structs[team].get(k));
  }

  /** Start travelling to waypoint `to`: stand at one of your team's waypoints, 2 s channel, damage cancels. */
  waypoint(p: ServerPlayer, to: unknown): string | null {
    if (p.team === undefined || !p.alive) return "Not now";
    const team = p.team as Team;
    const k = String(to ?? "") as WaypointKind;
    const up = this.standingWaypoints(team);
    if (!WAYPOINT_KINDS.includes(k)) return "No such waypoint";
    if (!up.includes(k)) return "That waypoint has fallen with its structure";
    if (!this.atWaypoint(p)) return "Stand at one of your waypoints to travel";
    const dest = waypointAt(team, k);
    if (Math.hypot(dest.x - p.x, dest.y - p.y) < WAYPOINT_USE_R) return "You are already there";
    this.chan.set(p.id, { to: k, at: this.t + WAYPOINT_CHANNEL, hp: p.hp + esOf(p), fx: p.x, fy: p.y });
    return null;
  }

  /** Within WAYPOINT_USE_R of one of your standing waypoints, or on your platform. */
  private atWaypoint(p: ServerPlayer): boolean {
    if (p.team === undefined) return false;
    const team = p.team as Team;
    return onPlatform(team, p.x, p.y) || this.standingWaypoints(team).some((w) => { const q = waypointAt(team, w); return Math.hypot(q.x - p.x, q.y - p.y) < WAYPOINT_USE_R; });
  }

  private waypointTick() {
    for (const [id, c] of this.chan) {
      const p = this.g.players.get(id);
      const team = p?.team as Team | undefined;
      if (!p || team === undefined || !p.alive) {
        this.chan.delete(id);
        continue;
      }
      const life = p.hp + esOf(p);
      let why = "";
      if (life < c.hp - 0.5) why = "Travel interrupted: you took damage";
      else if (Math.hypot(p.x - c.fx, p.y - c.fy) > WAYPOINT_USE_R + 80) why = "Travel cancelled: you walked away";
      else if (!this.standingWaypoints(team).includes(c.to)) why = "Travel cancelled: that waypoint has fallen";
      c.hp = Math.max(c.hp, life);
      if (why) {
        this.chan.delete(id);
        this.g.toast(p, why);
        continue;
      }
      if (this.t < c.at) continue;
      this.chan.delete(id);
      const d = waypointAt(team, c.to);
      const x0 = Math.round(p.x);
      const y0 = Math.round(p.y);
      p.x = d.x + (Math.random() - 0.5) * 60;
      p.y = d.y + 70 + (Math.random() - 0.5) * 40;
      p.kbx = 0;
      p.kby = 0;
      this.g.events.push({ k: "wp", id: p.id, x: x0, y: y0, x2: Math.round(p.x), y2: Math.round(p.y) });
    }
  }

  stop() {
    laneHook.active = false;
    laneHook.think = null;
    laneHook.incoming = null;
    laneHook.friendly = null;
    laneHook.trialSpawn = null;
    levelCap.v = MAX_LEVEL;
    for (const p of this.g.players.values()) p.team = undefined;
  }

  /** A player joining the running match: the given (or smaller) team, starting gold, at its base. */
  addLate(p: ServerPlayer, team?: Team) {
    if (team === undefined) {
      const counts = [0, 0];
      for (const o of this.g.players.values()) if (o !== p && o.joined && o.team !== undefined) counts[o.team]++;
      team = counts[0] <= counts[1] ? 0 : 1;
    }
    p.team = team;
    const n = [...this.g.players.values()].filter((o) => o.joined && o.team === team).length;
    p.color = TEAM_PLAYER_COLORS[team][(n - 1 + TEAM_PLAYER_COLORS[team].length) % TEAM_PLAYER_COLORS[team].length];
    this.gold.set(p.id, N.goldStart);
    this.g.spawn(p, this.respawnSpot(team));
  }

  respawnSpot(team: Team) {
    const r = LANE.respawn[team];
    return { x: r.x + (Math.random() - 0.5) * 120, y: r.y + (Math.random() - 0.5) * 120 };
  }

  private newUnit(m: Monster, team: Team, kind: Kind): Unit {
    m.team = team;
    const u: Unit = { m, team, kind, w: 1, gold: 0, xp: 0, laneY: LANE.y, aggroP: -1, aggroT: 0, tu: null, scanT: 0, fireT: 0, boltOn: -1, boltN: 0, hitT: -99, pace: 1, paceT: 0 };
    this.units.set(m, u);
    return u;
  }

  private spawnStruct(team: Team, k: StructKind) {
    const t = MONSTER_BY_ID.get(k)!;
    const m = this.g.monsters.spawnLoose(t, { x: STRUCT_X[k][team], y: LANE.y }, false, 0);
    m.maxHp = Math.round(N.structLife[k] * Math.max(0.6, this.teamSize / 5));
    m.hp = m.maxHp;
    m.esMax = m.es = Math.round(m.maxHp * N.structEs);
    m.speed = 0;
    m.angle = team === 0 ? 0 : Math.PI;
    if (m.ext) m.ext.ccResist = 1;
    const u = this.newUnit(m, team, "struct");
    u.sk = k;
    this.structs[team].set(k, u);
  }

  private meanLevel(): number {
    const ps = this.g.joined;
    return ps.length ? ps.reduce((s, p) => s + playerLevel(p), 0) / ps.length : 1;
  }

  /** Lane level: floor of the mean player level, at least 1. */
  laneLevel(): number {
    const ps = this.g.joined;
    if (!ps.length) return 1;
    return Math.max(1, Math.floor(ps.reduce((s, p) => s + playerLevel(p), 0) / ps.length));
  }

  private setLevel(m: Monster, want: number) {
    const e = m.ext;
    if (!e) return;
    const a = monsterLevelScale(e.level ?? 1);
    const b = monsterLevelScale(want);
    m.maxHp *= b.life / a.life;
    m.damage *= b.dmg / a.dmg;
    m.hp = m.maxHp;
    e.level = want;
  }

  // ---- waves ---------------------------------------------------------------------------------

  private families(): [string, string] {
    const min = this.t / 60;
    if (min < 6) return [this.wave % 2 ? "barkgnaw" : "wolf_feral", "sapspitter"];
    if (min < 12) return ["reedlurker", "mire_chanter"];
    return ["spire_harrier", "shardslinger"];
  }

  private spawnWave() {
    this.wave++;
    const n = this.teamSize;
    const min = this.t / 60;
    const [rushT, rangedT] = this.families().map((id) => MONSTER_BY_ID.get(id)!) as [MonsterType, MonsterType];
    const rushers = 2 + Math.ceil(n / 2);
    const ranged = 1 + Math.floor(n / 3);
    const lvl = this.laneLevel();
    const purseGold = Math.min(80, 36 + 3 * min);
    const purseXp = Math.min(110, 22 + 5.5 * min);
    const eliteWave = this.wave >= 3 && this.wave % 3 === 0;
    for (const team of [0, 1] as Team[]) {
      // Momentum: every enemy structure this team has broken adds a rusher, and from the second one
      // every wave is led by an elite, so a lead turns into a push and the match ends.
      const broken = STRUCT_KINDS.filter((k) => !this.structs[(1 - team) as Team].get(k)).length;
      const myRushers = rushers + broken;
      const list: { t: MonsterType; r: 0 | 1 | 2 }[] = [];
      for (let i = 0; i < myRushers; i++) list.push({ t: rushT, r: 0 });
      for (let i = 0; i < ranged; i++) list.push({ t: rangedT, r: 0 });
      if (!eliteWave && broken >= 2) list[0].r = 1;
      if (eliteWave) {
        if (min < 6) list[0].r = 1;
        else if (min < 12) list[Math.random() < 0.5 ? 0 : myRushers].r = 2;
        else {
          list[0].r = 2;
          list[myRushers].r = 2;
        }
      }
      const weight = list.reduce((s, e) => s + (e.r === 2 ? 5 : e.r === 1 ? 3 : 1), 0);
      const dir = team === 0 ? 1 : -1;
      list.forEach((e, i) => {
        const back = e.t === rangedT ? 90 : 0;
        const at = { x: LANE.mobX[team] - dir * (back + (i % 3) * 30), y: LANE.y + ((i % 4) - 1.5) * 44 };
        const m = this.g.monsters.spawnLoose(e.t, at, false, e.r);
        this.setLevel(m, lvl);
        const u = this.newUnit(m, team, e.r ? "elite" : "mob");
        u.w = e.r === 2 ? 5 : e.r === 1 ? 3 : 1;
        u.gold = purseGold / weight;
        u.xp = purseXp / weight;
        u.laneY = at.y;
        m.state = 1;
      });
      // Crowdfunded reinforcements (Quartermaster "Reinforcements" tab) march at the back of this wave.
      const bought = this.queued[team].splice(0);
      bought.forEach((k, i) => {
        const t = k === "archer" ? rangedT : rushT;
        const r: 0 | 1 | 2 = k === "champion" ? 2 : 1;
        const at = { x: LANE.mobX[team] - dir * (130 + i * 34), y: LANE.y + (i - 1) * 50 };
        const m = this.g.monsters.spawnLoose(t, at, false, r);
        this.setLevel(m, lvl + (k === "champion" ? 1 : 0));
        const u = this.newUnit(m, team, "elite");
        u.w = r === 2 ? 5 : 3;
        // A bought unit is worth little to whoever kills it (no gold farm off the enemy's purse).
        u.gold = 4;
        u.xp = purseXp / weight;
        u.laneY = at.y;
        m.state = 1;
      });
      // Rogue exiles while the enemy Ward is down (doc 6.1).
      if (!this.structs[(1 - team) as Team].get("lane_ward")) this.spawnExile(team);
    }
  }

  private spawnExile(team: Team) {
    let alive = 0;
    for (const u of this.units.values()) if (u.kind === "exile" && u.team === team) alive++;
    if (alive >= 1 + Math.floor(this.teamSize / 2)) return;
    const t = MONSTER_BY_ID.get("rogue_exile");
    if (!t) return;
    // In the middle of the wave that just spawned (spawnWave), so it marches with it.
    const x = LANE.mobX[team] - (team === 0 ? 1 : -1) * 45;
    const m = this.g.monsters.spawnLoose(t, { x, y: LANE.y + 60 }, false, 3);
    this.setLevel(m, Math.min(LANE_LEVEL_CAP + 2, this.laneLevel() + 2));
    m.maxHp *= N.exileLife; // a five-hero defence used to melt one in seconds
    m.hp = m.maxHp;
    const u = this.newUnit(m, team, "exile");
    u.laneY = LANE.y + 60;
    m.state = 1;
    this.g.events.push({ k: "info", text: `A rogue exile joins ${TEAM_NAMES[team]}` });
  }

  // ---- damage rules --------------------------------------------------------------------------

  /** Structure order lock: the one before it in its line must be down (the Core needs the Ward down). */
  private targetable(u: Unit): boolean {
    if (u.kind !== "struct") return true;
    const i = STRUCT_KINDS.indexOf(u.sk!);
    return i === 0 || !this.structs[u.team].get(STRUCT_KINDS[i - 1]);
  }

  private incoming(m: Monster, dmg: number, by: ServerPlayer | null): number {
    const u = this.units.get(m);
    if (!u) return dmg;
    if (by && by.team === u.team) return 0;
    if (u.kind === "struct") {
      if (!this.targetable(u)) return 0;
      if (u.sk === "lane_outer" && this.t < N.fortifyUntil) dmg *= 0.5;
      dmg *= siegeMult(this.t);
      // Backdoor: no attacking mob of the hitter's side near the structure.
      if (by) {
        let mobNear = false;
        for (const o of this.units.values()) if (o.kind !== "struct" && o.team !== u.team && Math.hypot(o.m.x - m.x, o.m.y - m.y) < N.backdoorR) {
          mobNear = true;
          break;
        }
        if (!mobNear) dmg *= 0.3;
      }
      u.hitT = this.t;
      // Energy shield takes the hit first; a fully absorbed hit still counts as a hit (not immune).
      const left = this.absorbEs(m, dmg);
      return left > 0 ? left : dmg > 0 ? 1e-6 : 0;
    } else if (by) {
      u.aggroP = by.id;
      u.aggroT = 3;
    }
    return dmg;
  }

  private friendly(t: ServerPlayer, by: ServerPlayer | null | undefined, mon: Monster | null | undefined): boolean {
    if (by && by !== t) {
      if (by.team === t.team) return true;
      this.pvpAt.set(by.id, this.t);
      let hb = this.hurtBy.get(t.id);
      if (!hb) this.hurtBy.set(t.id, (hb = new Map()));
      hb.set(by.id, this.t);
      return false;
    }
    if (mon) {
      const u = this.units.get(mon);
      return !!u && u.team === t.team;
    }
    return false;
  }

  /** Unit-on-unit damage (mobs, exiles, spire bolts). Structures take the siege multiplier. */
  private hurtUnit(target: Unit, dmg: number, from: Unit | null) {
    const m = target.m;
    if (!m.alive || dmg <= 0) return;
    if (target.kind === "struct") {
      if (!this.targetable(target)) return;
      if (from) dmg *= from.kind === "mob" ? N.mobStructMult : N.eliteStructMult;
      if (target.sk === "lane_outer" && this.t < N.fortifyUntil) dmg *= 0.5;
      if (from) dmg *= siegeMult(this.t);
      target.hitT = this.t;
    }
    if (m.ext && (m.ext.invulnT > 0 || (m.ext.exile && m.ext.exile.rollT > 0))) return;
    const full = dmg;
    if (target.kind === "struct") dmg = this.absorbEs(m, dmg);
    m.hp -= dmg;
    this.g.events.push({ k: "hit", x: Math.round(m.x), y: Math.round(m.y), target: m.id, by: 0, dmg: Math.round(full * 10) / 10, m: 1 });
    if (m.hp <= 0) {
      this.g.events.push({ k: "mdie", id: m.id, mk: m.type.id, x: Math.round(m.x), y: Math.round(m.y), r: m.radius, a: Math.round(m.angle * 100) / 100, ...(m.elite ? { el: 1 as const } : {}) });
      this.g.monsters.kill(m);
      this.onUnitDied(m, null);
    }
  }

  /** A lane unit died (from Game.onMonsterKilled for player kills, or hurtUnit). */
  onUnitDied(m: Monster, killer: ServerPlayer | null) {
    if (this.jungleMons.has(m)) return this.jungleKill(m, killer);
    const u = this.units.get(m);
    if (!u) return;
    this.units.delete(m);
    const enemies = this.g.joined.filter((p) => p.alive && p.team !== u.team);
    if (u.kind === "struct") {
      const k = u.sk!;
      this.structs[u.team].set(k, null);
      const by = (1 - u.team) as Team;
      this.g.events.push({ k: "info", text: `${TEAM_NAMES[by]} destroyed the ${TEAM_NAMES[u.team]} ${m.type.name}` });
      for (const p of this.g.joined) if (p.team === by) this.addGold(p, N.structGold[k], true);
      if (k === "lane_ward") {
        this.wardBack[u.team] = this.t + N.wardRespawn;
        // Rogue exiles march with the breaker's next wave (spawnWave), not alone ahead of it.
        this.g.events.push({ k: "info", text: `Rogue exiles will march with the ${TEAM_NAMES[by]} waves` });
      }
      if (k === "lane_core") this.winner = by;
      return;
    }
    if (u.kind === "exile") {
      const L = this.laneLevel();
      for (const p of enemies) if (Math.hypot(p.x - m.x, p.y - m.y) < N.purseR) {
        this.addGold(p, N.exileGold, true);
        gainXp(p, 30 + 4 * L);
      }
      this.g.events.push({ k: "info", text: `${TEAM_NAMES[(1 - u.team) as Team]} slew a rogue exile` });
      return;
    }
    // Wave purse: every living enemy player near the death shares the mob's part of the wave purse.
    for (const p of enemies) if (Math.hypot(p.x - m.x, p.y - m.y) < N.purseR) {
      this.addGold(p, u.gold * u.w, true);
      this.addXp(p, u.xp * u.w);
    }
    if (killer && u.kind === "elite") this.g.events.push({ k: "info", text: `${killer.name} slew ${m.eliteName ?? m.type.name}` });
  }

  onPlayerKilled(victim: ServerPlayer, killer: ServerPlayer | null) {
    const lvl = playerLevel(victim);
    this.respawnAt.set(victim.id, this.t + Math.min(36, 6 + 1.5 * lvl));
    const hb = this.hurtBy.get(victim.id);
    this.hurtBy.delete(victim.id);
    if (victim.team !== undefined && killer && killer.team !== victim.team) {
      this.kills[killer.team!]++;
      this.addGold(killer, N.killGold, true);
      gainXp(killer, 20 + 4 * lvl);
    } else if (victim.team !== undefined) this.kills[(1 - victim.team) as Team]++;
    // Assists: every enemy of the victim (killer aside) who hurt them in the last ASSIST_WINDOW seconds.
    if (hb && victim.team !== undefined) for (const [id, at] of hb) {
      const a = this.g.players.get(id);
      if (!a || a === killer || a.team === victim.team || this.t - at > ASSIST_WINDOW) continue;
      this.addGold(a, N.assistGold, true);
      gainXp(a, 10 + 2 * lvl);
    }
  }

  /** Credit gold; `pop` also tells that player's client (the "+N gold" popup over the hero). */
  addGold(p: ServerPlayer, n: number, pop = false) {
    this.gold.set(p.id, (this.gold.get(p.id) ?? 0) + n);
    if (!pop) return;
    // Purse shares are fractions: carry the remainder so the popups add up to what was paid.
    const acc = (this.popAcc.get(p.id) ?? 0) + n;
    const whole = Math.floor(acc);
    this.popAcc.set(p.id, acc - whole);
    if (whole > 0) this.g.events.push({ k: "gold", id: p.id, n: whole });
  }
  private readonly popAcc = new Map<number, number>();

  private addXp(p: ServerPlayer, n: number) {
    // Catch-up (doc 9): +15% per level below the match mean, up to +60%.
    const behind = this.meanLevel() - playerLevel(p);
    if (behind > 0) n *= 1 + Math.min(0.6, 0.15 * behind);
    const acc = (this.xpAcc.get(p.id) ?? 0) + n;
    const whole = Math.floor(acc);
    this.xpAcc.set(p.id, acc - whole);
    if (whole > 0) gainXp(p, whole);
  }

  // ---- brain ------------------------------------------------------------------------------------

  private think(sys: MonsterSystem, m: Monster, players: Map<number, ServerPlayer>): boolean {
    const u = this.units.get(m);
    if (!u) return false;
    if (u.kind === "struct") {
      m.state = 0;
      m.x = STRUCT_X[u.sk!][u.team];
      m.y = LANE.y;
      m.kbx = m.kby = 0;
      return true;
    }
    const ext = m.ext!;
    for (const k in ext.cds) if (ext.cds[k] > 0) ext.cds[k] -= DT;
    if (u.aggroT > 0) u.aggroT -= DT;
    if (m.state === 2) {
      const a = ext.atk;
      const before = sys.projectiles.length;
      stepWindup(sys, m, players);
      if (m.state !== 2 && a) this.released(sys, u, a, before);
      integrate(sys, m, 0, 0, 0);
      return true;
    }
    m.state = 1;
    // Target: a hitter for 3 s, else the nearest enemy (exiles: players first; mobs: mobs, structures, players).
    u.scanT -= DT;
    let tp = u.aggroT > 0 ? players.get(u.aggroP) : undefined;
    if (tp && (!tp.alive || Math.abs(tp.y - LANE.y) > N.offLane || Math.hypot(tp.x - m.x, tp.y - m.y) > N.aggro * 1.6)) tp = undefined;
    if (!tp) {
      if (u.scanT <= 0 || (u.tu && !u.tu.m.alive) || (m.target > 0 && !players.get(m.target)?.alive)) {
        u.scanT = 0.25;
        this.pickTarget(u, players);
      }
      tp = m.target > 0 ? players.get(m.target) : undefined;
      if (tp && (!tp.alive || Math.abs(tp.y - LANE.y) > N.offLane || this.onEnemyPlatform(u, tp.x, tp.y))) {
        tp = undefined;
        m.target = -1;
      }
    } else {
      m.target = tp.id;
      u.tu = null;
    }
    const tu = tp ? null : u.tu?.m.alive ? u.tu : null;
    let mvx = 0;
    let mvy = 0;
    let speed = m.speed;
    if (tp || tu) {
      const tx = tp ? tp.x : tu!.m.x;
      const ty = tp ? tp.y : tu!.m.y;
      const tr = tp ? PLAYER_RADIUS : tu!.m.radius;
      const dx = tx - m.x;
      const dy = ty - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.angle = Math.atan2(dy, dx);
      const dEff = Math.max(0, d - tr + PLAYER_RADIUS);
      let a: AttackDef | null = null;
      if (m.recoverT <= 0) for (let i = 0; i < 3 && !a; i++) {
        const c = chooseAttack(m, dEff);
        if (c && c.kind !== "summon") a = c;
        else if (!c) break;
      }
      if (a) {
        m.target = tp ? tp.id : -1;
        startAttack(sys, m, a, { x: tx, y: ty });
        return true;
      }
      const pref = ext.exile?.def.kite ?? m.type.preferredDist;
      const gap = d - tr - m.radius;
      if (pref ? dEff > pref : gap > 8) {
        mvx = dx / d;
        mvy = dy / d;
      }
    } else {
      // March along the lane toward the enemy base.
      const dir = u.team === 0 ? 1 : -1;
      let ly = u.laneY;
      // Step around own structures on the line.
      for (const s of this.structs[u.team].values()) {
        if (!s || Math.abs(s.m.x - m.x) > 160 || (s.m.x - m.x) * dir < -40) continue;
        ly = LANE.y + (u.laneY >= LANE.y ? 1 : -1) * (s.m.radius + m.radius + 24);
      }
      const gx = m.x + dir * 200;
      const dx = gx - m.x;
      const dy = (ly - m.y) * 1.5;
      const d = Math.hypot(dx, dy) || 1;
      mvx = dx / d;
      mvy = dy / d;
      speed = N.march;
      if (u.kind === "exile") speed *= this.exilePace(u, dir);
      m.angle = Math.atan2(mvy, mvx);
    }
    integrate(sys, m, mvx, mvy, speed);
    return true;
  }

  /**
   * A marching exile keeps pace with its wave: it slows while ahead of the wave's middle and hurries
   * while behind it (no wave-mates within 700 px: its own pace). Checked a few times a second.
   */
  private exilePace(u: Unit, dir: number): number {
    u.paceT -= DT;
    if (u.paceT > 0) return u.pace;
    u.paceT = 0.3;
    let sx = 0;
    let n = 0;
    for (const o of this.units.values()) {
      if (o.team !== u.team || (o.kind !== "mob" && o.kind !== "elite") || !o.m.alive || Math.abs(o.m.x - u.m.x) > 700) continue;
      sx += o.m.x;
      n++;
    }
    if (!n) return (u.pace = 1);
    const ahead = (u.m.x - sx / n) * dir;
    return (u.pace = ahead > 50 ? 0.55 : ahead < -110 ? 1.3 : 1);
  }

  private onEnemyPlatform(u: Unit, x: number, y: number) {
    return onPlatform((1 - u.team) as Team, x, y);
  }

  private pickTarget(u: Unit, players: Map<number, ServerPlayer>) {
    const m = u.m;
    u.tu = null;
    m.target = -1;
    const R = N.aggro * (u.kind === "exile" ? 1.3 : 1);
    let best: Unit | null = null;
    let bd = R;
    let bestS: Unit | null = null;
    let bsd = R + 80;
    for (const o of this.units.values()) {
      if (o.team === u.team || !o.m.alive) continue;
      const d = Math.hypot(o.m.x - m.x, o.m.y - m.y) - (o.kind === "struct" ? o.m.radius : 0);
      if (o.kind === "struct") {
        if (d < bsd && this.targetable(o)) {
          bsd = d;
          bestS = o;
        }
      } else if (d < bd) {
        bd = d;
        best = o;
      }
    }
    let bp: ServerPlayer | null = null;
    let bpd = R;
    for (const p of players.values()) {
      if (!p.joined || !p.alive || p.team === u.team || this.onEnemyPlatform(u, p.x, p.y)) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < bpd) {
        bpd = d;
        bp = p;
      }
    }
    if (u.kind === "exile") {
      // Exiles are siege champions: they duel a hero who comes close, else break the structure in reach.
      if (bp && bpd < 300) {
        m.target = bp.id;
        return;
      }
      if (bestS) {
        u.tu = bestS;
        return;
      }
      if (best) {
        u.tu = best; // fights the enemy wave alongside its own instead of walking through it
        return;
      }
      if (bp) {
        m.target = bp.id;
        return;
      }
    }
    if (best) u.tu = best;
    else if (bestS) u.tu = bestS;
    else if (bp) m.target = bp.id;
  }

  /** An attack landed: unit targets take the hit directly; projectiles learn to hit enemy units. */
  private released(sys: MonsterSystem, u: Unit, a: AttackDef, before: number) {
    for (let i = before; i < sys.projectiles.length; i++) {
      const pr = sys.projectiles[i];
      if (pr.owner === u.m && !pr.step) pr.step = (p) => this.shotStep(p, u);
    }
    const tu = u.tu;
    if (a.kind === "proj" || !tu || !tu.m.alive || u.m.target > 0) return;
    const reach = Math.hypot(tu.m.x - u.m.x, tu.m.y - u.m.y) - tu.m.radius - u.m.radius;
    if (reach > Math.max(a.range, a.radius ?? 0) + 40) return;
    this.hurtUnit(tu, u.m.damage * a.dmg * (u.m.ext?.bDmg ?? 1), u);
  }

  /** Monster shot flight: hits the first enemy unit it touches (players are handled by the default path). */
  private shotStep(pr: Projectile, from: Unit): boolean | null {
    for (const o of this.units.values()) {
      if (o.team === from.team || !o.m.alive) continue;
      if (Math.abs(o.m.x - pr.x) > 120) continue;
      if (Math.hypot(o.m.x - pr.x, o.m.y - pr.y) < pr.r + o.m.radius) {
        if (o.kind === "struct" && !this.targetable(o)) return false;
        this.hurtUnit(o, pr.dmg, from);
        return false;
      }
    }
    return null;
  }

  // ---- structures --------------------------------------------------------------------------------

  /** Dev (?dev=1): destroy the enemy team's front-most standing structure (screenshots, testing). */
  devFell(p: ServerPlayer) {
    const foe = (1 - (p.team ?? 0)) as Team;
    for (const k of STRUCT_KINDS) {
      const u = this.structs[foe].get(k);
      if (u) return this.hurtUnit(u, 1e9, null); // (huge: the early outer fortify halves damage)
    }
  }

  /** Any enemy (player or lane unit) of `team` within r? */
  private enemyNear(team: Team, x: number, y: number, r: number): boolean {
    for (const p of this.g.joined) if (p.alive && p.team !== team && Math.hypot(p.x - x, p.y - y) < r) return true;
    for (const o of this.units.values()) if (o.team !== team && o.kind !== "struct" && o.m.alive && Math.hypot(o.m.x - x, o.m.y - y) < r) return true;
    return false;
  }

  /** Structure energy shield soaks damage first; returns what is left for life. */
  private absorbEs(m: Monster, dmg: number): number {
    const es = m.es ?? 0;
    if (es <= 0 || dmg <= 0) return dmg;
    const soak = Math.min(es, dmg);
    m.es = es - soak;
    return dmg - soak;
  }

  private structTick(u: Unit) {
    const m = u.m;
    // Energy shield recharges once the structure has gone a few seconds without a hit.
    if (m.esMax && (m.es ?? 0) < m.esMax && this.t - u.hitT > N.structEsDelay) m.es = Math.min(m.esMax, (m.es ?? 0) + m.esMax * N.structEsRate * DT);
    if (u.sk === "lane_ward") return; // the Ward does not shoot
    if (u.sk === "lane_core" && this.t - u.hitT > N.coreRegenDelay && m.hp < m.maxHp && !this.enemyNear(u.team, m.x, m.y, 1000)) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.01 * DT);
    const core = u.sk === "lane_core";
    const range = core ? N.coreRange : N.spireRange;
    // Focus (snapshot `fc`: the client's targeting beam): drops as soon as that hero is dead or out of range.
    if (m.focus) {
      const fp = this.g.players.get(m.focus);
      if (!fp || !fp.alive || Math.hypot(fp.x - m.x, fp.y - m.y) > range + PLAYER_RADIUS) m.focus = 0;
    }
    u.fireT -= DT;
    if (u.fireT > 0) return;
    // Priority: an enemy player who just hit one of ours nearby, then mobs, then players.
    let tgtP: ServerPlayer | null = null;
    let tgtU: Unit | null = null;
    let bd = range;
    for (const p of this.g.joined) {
      if (!p.alive || p.team === u.team) continue;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < range && this.t - (this.pvpAt.get(p.id) ?? -99) < 2 && d < bd) {
        bd = d;
        tgtP = p;
      }
    }
    if (!tgtP) {
      bd = range;
      for (const o of this.units.values()) {
        if (o.team === u.team || o.kind === "struct" || !o.m.alive) continue;
        const d = Math.hypot(o.m.x - m.x, o.m.y - m.y);
        if (d < bd) {
          bd = d;
          tgtU = o;
        }
      }
    }
    if (!tgtP && !tgtU) {
      bd = range;
      for (const p of this.g.joined) {
        if (!p.alive || p.team === u.team) continue;
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < bd) {
          bd = d;
          tgtP = p;
        }
      }
    }
    if (!tgtP && !tgtU) {
      u.boltN = 0;
      m.focus = 0;
      return;
    }
    m.focus = tgtP ? tgtP.id : 0;
    u.fireT = N.boltEvery / (core ? 1.5 : 1);
    if (tgtP) {
      if (u.boltOn === tgtP.id) u.boltN++;
      else {
        u.boltOn = tgtP.id;
        u.boltN = 0;
      }
    } else u.boltOn = -1;
    const mult = core ? 1.5 : 1;
    const consec = Math.min(2.2, 1 + 0.4 * u.boltN);
    const pDmg = (15 + 3 * this.laneLevel()) * consec * mult;
    const tid = tgtP ? tgtP.id : -1;
    const tu = tgtU;
    const sys = this.g.monsters;
    const sy = m.y - 40;
    sys.projectiles.push({
      id: sys.allocId(), x: m.x, y: sy, vx: 0, vy: 0, r: 10, life: 3, dmg: 0, kb: 0, source: m.type.name, owner: m,
      step: (pr) => {
        const tp = tid > 0 ? this.g.players.get(tid) : null;
        const tx = tp ? tp.x : tu?.m.x;
        const ty = tp ? tp.y : tu?.m.y;
        if (tx === undefined || ty === undefined || (tp && !tp.alive) || (tu && !tu.m.alive)) return false;
        const dx = tx - pr.x;
        const dy = ty - pr.y;
        const d = Math.hypot(dx, dy) || 1;
        const tr = tp ? PLAYER_RADIUS : tu!.m.radius;
        if (d < tr + pr.r + 6) {
          if (tp) this.boltPlayer(tp, pDmg, m);
          else if (tu) {
            const pct = (tu.kind === "exile" ? N.boltExile : tu.kind === "elite" ? N.boltElite : N.boltMob) * (core ? N.coreMobMult : 1);
            this.hurtUnit(tu, tu.m.maxHp * pct * mult, null);
          }
          return false;
        }
        pr.vx = (dx / d) * N.boltSpeed;
        pr.vy = (dy / d) * N.boltSpeed;
        return true;
      },
    });
  }

  /** Spire bolts ignore defences. */
  private boltPlayer(p: ServerPlayer, dmg: number, src: Monster) {
    if (!p.alive) return;
    p.hp -= dmg;
    this.g.events.push({ k: "hit", x: Math.round(p.x), y: Math.round(p.y), target: p.id, by: 0, dmg: Math.round(dmg * 10) / 10, sn: src.type.name });
    if (p.hp <= 0) {
      p.hp = 0;
      this.g.onPlayerKilled(p, null, src.type.name);
    }
  }

  // ---- per tick --------------------------------------------------------------------------------

  update() {
    this.t += DT;
    const ps = this.g.joined;
    for (const p of ps) {
      if (this.t > N.goldPassiveFrom) this.addGold(p, N.goldPassive * DT);
      if (p.alive) {
        this.addXp(p, N.xpPassive * DT);
        // Own platform: fast healing and flask refill (the base fountain).
        if (p.team !== undefined && onPlatform(p.team, p.x, p.y)) {
          p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.12 * DT);
          if (this.g.tick % 30 === 0) this.g.addCharges(p, 5);
        }
      } else {
        const at = this.respawnAt.get(p.id) ?? this.t;
        if (this.t >= at && p.team !== undefined) {
          this.respawnAt.delete(p.id);
          this.g.spawn(p, this.respawnSpot(p.team));
          this.g.addCharges(p, 999);
        }
      }
    }
    if (this.t >= this.nextWave) {
      this.spawnWave();
      this.nextWave += waveEvery(this.t);
    }
    for (const team of [0, 1] as Team[]) {
      if (!this.structs[team].get("lane_ward") && this.wardBack[team] > 0 && this.t >= this.wardBack[team] && this.structs[team].get("lane_core")) {
        this.wardBack[team] = 0;
        this.spawnStruct(team, "lane_ward");
        this.g.events.push({ k: "info", text: `The ${TEAM_NAMES[team]} Ward rises again` });
      }
      for (const u of this.structs[team].values()) if (u && u.m.alive) this.structTick(u);
    }
    this.jungleTick();
    this.waypointTick();
    for (const m of this.jungleMons) if (!m.alive) this.jungleMons.delete(m);
    // Units that died some other way (DoT, passives) without passing through here.
    for (const [m] of this.units) if (!m.alive) this.onUnitDied(m, null);
    // Mobs pushed off the band (knockback) walk back; nothing to do: the brain steers to its line.
  }

  // ---- HUD ---------------------------------------------------------------------------------------

  hud(p: ServerPlayer): LaneMsg {
    const st: LaneMsg["st"] = [];
    for (const team of [0, 1] as Team[]) for (const k of STRUCT_KINDS) {
      const u = this.structs[team].get(k);
      st.push([k, team, u ? Math.round((u.m.hp / u.m.maxHp) * 100) / 100 : 0, k === "lane_ward" && !u && this.wardBack[team] > 0 ? Math.ceil(this.wardBack[team] - this.t) : 0]);
    }
    const tm = (p.team ?? 0) as Team;
    return {
      t: "lane",
      tm,
      g: Math.floor(this.gold.get(p.id) ?? 0),
      lv: this.laneLevel(),
      me: Math.min(LANE_LEVEL_CAP, playerLevel(p)),
      wv: Math.max(0, Math.ceil(this.nextWave - this.t)),
      n: this.wave,
      st,
      k: [...this.kills] as [number, number],
      dead: p.alive ? 0 : Math.max(0, Math.ceil((this.respawnAt.get(p.id) ?? this.t) - this.t)),
      shop: this.canShop(p) ? 1 : 0,
      rf: REINF_KINDS.map((k) => {
        const pot = this.pots[tm].get(k);
        const who = pot ? [...pot.who].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `${n}:${Math.round(v)}`).join(",") : "";
        return [k, Math.floor(pot?.have ?? 0), reinfPrice(k, this.wave), who] as [string, number, number, string];
      }),
      rq: this.queued[tm].length,
      wp: this.standingWaypoints(tm),
      ...(p.alive && this.atWaypoint(p) ? { wa: 1 as const } : {}),
      ...(this.chan.has(p.id) ? { ch: Math.max(0, Math.round((this.chan.get(p.id)!.at - this.t) * 10) / 10), cto: this.chan.get(p.id)!.to } : {}),
      ...(this.winner !== null ? { win: this.winner } : {}),
    };
  }

  canShop(p: ServerPlayer) {
    return p.team !== undefined && (!p.alive || onPlatform(p.team, p.x, p.y));
  }

  // ---- shop (doc section 8) ------------------------------------------------------------------------

  shop(p: ServerPlayer, msg: { a?: unknown; slot?: unknown; lv?: unknown; id?: unknown; k?: unknown; rune?: unknown; n?: unknown }): string | null {
    if (!this.canShop(p)) return "The Quartermaster only deals on your platform (or while you are dead).";
    const lvl = Math.min(LANE_LEVEL_CAP, playerLevel(p));
    const gold = this.gold.get(p.id) ?? 0;
    const pay = (n: number) => {
      if (gold < n) return false;
      this.gold.set(p.id, gold - n);
      return true;
    };
    const give = (it: Item, price: number) => {
      const err = storeItem(p, it);
      if (err) {
        this.addGold(p, price); // refund
        return "No room in your bag";
      }
      if (isGem(it)) this.g.skills.onPickup(p, it, autoPlace);
      this.g.toast(p, `Bought ${it.n}`);
      return null;
    };
    switch (msg.a) {
      case "gamble": {
        const slot = String(msg.slot ?? "");
        if (!(slot in GAMBLE_BASE)) return "Nothing like that on offer";
        const price = gamblePrice(slot, lvl);
        if (!pay(price)) return "Not enough gold";
        let it: Item;
        if (slot === "flask") it = rollFlask(lvl);
        else {
          const r = Math.random() * 100;
          let rar: Rarity = r < 35 ? 0 : r < 85 ? 1 : 2; // 35 / 50 / 15 (the 1% unique counts as rare here)
          const miss = this.pity.get(p.id) ?? 0;
          if (rar < 2 && miss >= 5) rar = 2;
          this.pity.set(p.id, rar === 2 ? 0 : miss + 1);
          it = rollItem(lvl, rar, this.gambleBase(p, slot, lvl));
        }
        return give(it, price);
      }
      case "skill": {
        const k = Math.max(1, Math.min(maxCrystalLevel(lvl), Math.round(Number(msg.lv) || 1)));
        const price = skillCrystalPrice(k);
        if (!pay(price)) return "Not enough gold";
        return give(makeRough(ROUGH_SKILL, k), price);
      }
      case "support": {
        const tier = SUPPORT_TIERS.find((s) => s.tier === Math.round(Number(msg.lv) || 1));
        if (!tier || lvl < tier.level) return "Not on offer yet";
        if (!pay(tier.price)) return "Not enough gold";
        return give(makeRough(ROUGH_SUPPORT, tier.tier), tier.price);
      }
      case "spirit": {
        if (lvl < SPIRIT_LEVEL) return "Not on offer yet";
        if (!pay(SPIRIT_PRICE)) return "Not enough gold";
        return give(makeRough(ROUGH_SPIRIT, Math.max(1, Math.floor(lvl / 2))), SPIRIT_PRICE);
      }
      case "enhance":
        return this.enhance(p, msg, pay);
      case "fund":
        return this.fund(p, String(msg.k ?? ""), Number(msg.n));
      case "sell": {
        const it = carriedItem(p, msg.id);
        if (!it) return "No such item";
        // Bag, worn gear, belt flasks and charms all sell (worn gear comes off first; stats refresh).
        const value = this.sellValue(it);
        dropById(p, it.id, (d) => d !== it && this.g.dropItem(d, p.x, p.y));
        this.addGold(p, value);
        this.g.toast(p, `Sold ${it.n} for ${value} gold`);
        return null;
      }
    }
    return "Nothing like that on offer";
  }

  // ---- Enhance: gold services on your own items (crafting.ts rules, unchanged) -----------------------

  private enhance(p: ServerPlayer, msg: { id?: unknown; k?: unknown; rune?: unknown }, pay: (n: number) => boolean): string | null {
    const k = String(msg.k ?? "") as EnhanceKind;
    if (!ENHANCE_KINDS.includes(k)) return "Nothing like that on offer";
    const own = findOwned(p, Number(msg.id));
    if (!own) return "No such item";
    const it = own.it;
    const why = enhanceBlock(k, it);
    if (why) return why;
    const rune = k === "rune" ? runesFor(it).find((r) => r.id === msg.rune) : undefined;
    if (k === "rune" && !rune) return "That rune is not on offer for this item";
    const price = enhancePrice(k, it, this.wave, rune?.id);
    if (!pay(price)) return "Not enough gold";
    const before = JSON.stringify(it);
    const fx = (cid: string) => applyEffect(CURRENCY_BY_ID.get(cid)!.effect, it, CURRENCY_BY_ID.get(cid));
    let res: { err?: string; msg?: string } = {};
    switch (k) {
      case "forge":
        res = fx(forgeStep(it)!);
        break;
      case "quality": {
        // One purchase = one +5% step (Normal takes it in one use, Magic / Rare in several).
        const goal = Math.min(MAX_QUALITY, (Math.floor((it.q ?? 0) / 5) + 1) * 5);
        const cid = qualityCur(it)!;
        for (let i = 0; i < 6 && (it.q ?? 0) < goal && !res.err; i++) res = fx(cid);
        if (!res.err) res = { msg: `Quality raised to ${it.q}%` };
        break;
      }
      case "socket":
        res = fx("cur_boring");
        break;
      case "rune":
        res = applyRune(rune!.id, it);
        break;
      case "chaos":
        res = fx("cur_shifting");
        break;
      case "divine":
        res = fx("cur_tempering");
        break;
      case "reforge": {
        // A fresh Rare of the same base: strip it to Normal, then reforge with four modifiers.
        it.r = 0;
        it.m = [];
        res = fx("cur_forgeheart");
        break;
      }
      case "gemsocket":
        res = fx("cur_awl");
        break;
      case "corrupt":
        res = fx("cur_blighted");
        break;
      case "unique": {
        const pool = uniquesFor(it);
        const u = makeUnique(pool[Math.floor(Math.random() * pool.length)].id, it.l, it.id);
        if (!u) res = { err: "No unique exists on this base" };
        else {
          if (it.q) u.q = it.q;
          if (it.s) u.s = it.s;
          for (const key of Object.keys(it)) delete (it as unknown as Record<string, unknown>)[key];
          Object.assign(it, u);
          res = { msg: `Transformed into ${u.n}` };
        }
        break;
      }
    }
    if (res.err) {
      for (const key of Object.keys(it)) delete (it as unknown as Record<string, unknown>)[key];
      Object.assign(it, JSON.parse(before));
      this.addGold(p, price); // refund
      return res.err;
    }
    if (own.where.k === "equip") refreshStats(p, (d, x, y) => this.g.dropItem(d, x, y));
    p.invDirty = true;
    this.g.toast(p, `${res.msg ?? "Done"} (${price} gold)`);
    return null;
  }

  // ---- Reinforcements: crowdfunded units for your team's next wave ------------------------------------

  private fund(p: ServerPlayer, kind: string, n: number): string | null {
    if (p.team === undefined) return "No team";
    const k = kind as ReinfKind;
    if (!REINF_KINDS.includes(k)) return "No such unit";
    const team = p.team as Team;
    if (this.queued[team].length >= REINF_CAP) return `The next wave is full (${REINF_CAP} bought units)`;
    const price = reinfPrice(k, this.wave);
    const pot = this.pots[team].get(k) ?? { have: 0, who: new Map<string, number>() };
    const gold = this.gold.get(p.id) ?? 0;
    const amt = Math.floor(Math.min(gold, Math.max(1, Number.isFinite(n) ? n : 0), price - pot.have));
    if (amt <= 0) return "Not enough gold";
    this.gold.set(p.id, gold - amt);
    pot.have += amt;
    pot.who.set(p.name, (pot.who.get(p.name) ?? 0) + amt);
    this.pots[team].set(k, pot);
    if (pot.have >= price) {
      this.queued[team].push(k);
      const names = [...pot.who.keys()].join(", ");
      this.pots[team].delete(k);
      for (const q of this.g.joined) if (q.team === team) this.g.toast(q, `Reinforcement funded: ${REINF_NAME[k]} joins the next wave (${names})`);
    } else this.g.toast(p, `+${amt} gold to the ${REINF_NAME[k]} (${Math.floor(pot.have)}/${price})`);
    return null;
  }

  sellValue(it: Item): number {
    return laneSellValue(it);
  }

  /** Gamble base: weapons follow the weapon you hold; other slots any base of that class. */
  private gambleBase(p: ServerPlayer, slot: string, lvl: number): string | undefined {
    const held = p.equip.mainhand ? BASES.find((b) => b.id === p.equip.mainhand!.b)?.weapon?.kind : undefined;
    const pool = BASES.filter((b) => b.cls === slot && b.reqIlvl <= lvl && (slot !== "weapon" || !held || b.weapon?.kind === held));
    if (!pool.length) return undefined;
    const total = pool.reduce((s, b) => s + b.weight, 0);
    let r = Math.random() * total;
    for (const b of pool) if ((r -= b.weight) <= 0) return b.id;
    return pool[0].id;
  }
}
