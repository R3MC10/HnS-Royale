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
  GAMBLE_BASE, LANE, LANE_LEVEL_CAP, SELL_FRACTION, SPIRIT_LEVEL, SPIRIT_PRICE, STRUCT_KINDS, STRUCT_X, SUPPORT_TIERS, TEAM_NAMES, TEAM_PLAYER_COLORS,
  gamblePrice, laneSellValue, maxCrystalLevel, onPlatform, skillCrystalPrice, type StructKind, type Team,
} from "../../shared/lanes";
import type { LaneMsg } from "../../shared/protocol";
import { chooseAttack, integrate, startAttack, stepWindup } from "../ai/brain";
import type { Game } from "../game";
import { autoPlace, carriedItem, dropById, storeItem } from "../inventory";
import { rollFlask, rollItem } from "../loot";
import type { Monster, MonsterSystem, Projectile } from "../monsters";
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
}

/** Doc section 5 / 6 / 7 numbers. */
const N = {
  firstWave: 30,
  march: 150,
  aggro: 380,
  offLane: 500,
  spireRange: 520,
  coreRange: 650,
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
  exileGold: 100,
  exileLife: 2.5,
  structGold: { lane_outer: 80, lane_inner: 120, lane_ward: 160, lane_core: 0 } as Record<StructKind, number>,
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
  private teamSize = 1;

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
    levelCap.v = LANE_LEVEL_CAP;
    const sys = this.g.monsters;
    sys.camps = [];
    sys.monsters.clear();
    sys.projectiles = [];
    sys.hazards = [];
    for (const team of [0, 1] as Team[]) for (const k of STRUCT_KINDS) this.spawnStruct(team, k);
  }

  stop() {
    laneHook.active = false;
    laneHook.think = null;
    laneHook.incoming = null;
    laneHook.friendly = null;
    levelCap.v = MAX_LEVEL;
    for (const p of this.g.players.values()) p.team = undefined;
  }

  respawnSpot(team: Team) {
    const r = LANE.respawn[team];
    return { x: r.x + (Math.random() - 0.5) * 120, y: r.y + (Math.random() - 0.5) * 120 };
  }

  private newUnit(m: Monster, team: Team, kind: Kind): Unit {
    m.team = team;
    const u: Unit = { m, team, kind, w: 1, gold: 0, xp: 0, laneY: LANE.y, aggroP: -1, aggroT: 0, tu: null, scanT: 0, fireT: 0, boltOn: -1, boltN: 0, hitT: -99 };
    this.units.set(m, u);
    return u;
  }

  private spawnStruct(team: Team, k: StructKind) {
    const t = MONSTER_BY_ID.get(k)!;
    const m = this.g.monsters.spawnLoose(t, { x: STRUCT_X[k][team], y: LANE.y }, false, 0);
    m.maxHp = Math.round(N.structLife[k] * Math.max(0.6, this.teamSize / 5));
    m.hp = m.maxHp;
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
    const front = STRUCT_KINDS.map((k) => this.structs[team].get(k)).find((u) => u);
    const x = front ? front.m.x + (team === 0 ? 120 : -120) : LANE.mobX[team];
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
    m.hp -= dmg;
    this.g.events.push({ k: "hit", x: Math.round(m.x), y: Math.round(m.y), target: m.id, by: 0, dmg: Math.round(dmg * 10) / 10, m: 1 });
    if (m.hp <= 0) {
      this.g.events.push({ k: "mdie", id: m.id, mk: m.type.id, x: Math.round(m.x), y: Math.round(m.y), r: m.radius, a: Math.round(m.angle * 100) / 100, ...(m.elite ? { el: 1 as const } : {}) });
      this.g.monsters.kill(m);
      this.onUnitDied(m, null);
    }
  }

  /** A lane unit died (from Game.onMonsterKilled for player kills, or hurtUnit). */
  onUnitDied(m: Monster, killer: ServerPlayer | null) {
    const u = this.units.get(m);
    if (!u) return;
    this.units.delete(m);
    const enemies = this.g.joined.filter((p) => p.alive && p.team !== u.team);
    if (u.kind === "struct") {
      const k = u.sk!;
      this.structs[u.team].set(k, null);
      const by = (1 - u.team) as Team;
      this.g.events.push({ k: "info", text: `${TEAM_NAMES[by]} destroyed the ${TEAM_NAMES[u.team]} ${m.type.name}` });
      for (const p of this.g.joined) if (p.team === by) this.addGold(p, N.structGold[k]);
      if (k === "lane_ward") {
        this.wardBack[u.team] = this.t + N.wardRespawn;
        this.spawnExile(by);
      }
      if (k === "lane_core") this.winner = by;
      return;
    }
    if (u.kind === "exile") {
      const L = this.laneLevel();
      for (const p of enemies) if (Math.hypot(p.x - m.x, p.y - m.y) < N.purseR) {
        this.addGold(p, N.exileGold);
        gainXp(p, 30 + 4 * L);
      }
      this.g.events.push({ k: "info", text: `${TEAM_NAMES[(1 - u.team) as Team]} slew a rogue exile` });
      return;
    }
    // Wave purse: every living enemy player near the death shares the mob's part of the wave purse.
    for (const p of enemies) if (Math.hypot(p.x - m.x, p.y - m.y) < N.purseR) {
      this.addGold(p, u.gold * u.w);
      this.addXp(p, u.xp * u.w);
    }
    if (killer && u.kind === "elite") this.g.events.push({ k: "info", text: `${killer.name} slew ${m.eliteName ?? m.type.name}` });
  }

  onPlayerKilled(victim: ServerPlayer, killer: ServerPlayer | null) {
    const lvl = playerLevel(victim);
    this.respawnAt.set(victim.id, this.t + Math.min(36, 6 + 1.5 * lvl));
    if (victim.team !== undefined && killer && killer.team !== victim.team) {
      this.kills[killer.team!]++;
      this.addGold(killer, N.killGold);
      gainXp(killer, 20 + 4 * lvl);
    } else if (victim.team !== undefined) this.kills[(1 - victim.team) as Team]++;
  }

  addGold(p: ServerPlayer, n: number) {
    this.gold.set(p.id, (this.gold.get(p.id) ?? 0) + n);
  }

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
      m.angle = Math.atan2(mvy, mvx);
    }
    integrate(sys, m, mvx, mvy, speed);
    return true;
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

  private structTick(u: Unit) {
    const m = u.m;
    if (u.sk === "lane_ward") return; // the Ward does not shoot
    if (u.sk === "lane_core" && this.t - u.hitT > N.coreRegenDelay && m.hp < m.maxHp && !this.enemyNear(u.team, m.x, m.y, 1000)) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.01 * DT);
    const core = u.sk === "lane_core";
    const range = core ? N.coreRange : N.spireRange;
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
      return;
    }
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
      ...(this.winner !== null ? { win: this.winner } : {}),
    };
  }

  canShop(p: ServerPlayer) {
    return p.team !== undefined && (!p.alive || onPlatform(p.team, p.x, p.y));
  }

  // ---- shop (doc section 8) ------------------------------------------------------------------------

  shop(p: ServerPlayer, msg: { a?: unknown; slot?: unknown; lv?: unknown; id?: unknown }): string | null {
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
      case "sell": {
        const it = carriedItem(p, msg.id);
        if (!it) return "No such item";
        if (Object.values(p.equip).includes(it)) return "Take it off first";
        const value = this.sellValue(it);
        dropById(p, it.id, () => {});
        this.addGold(p, value);
        this.g.toast(p, `Sold ${it.n} for ${value} gold`);
        return null;
      }
    }
    return "Nothing like that on offer";
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
