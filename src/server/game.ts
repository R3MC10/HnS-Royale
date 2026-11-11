// Authoritative game state: players, monsters, ground loot, round phases. No networking here.
import {
  CHARGES_ELITE_KILL,
  CHARGES_NORMAL_KILL,
  CHARGES_PLAYER_KILL,
  COUNTDOWN_TIME,
  DT,
  ITEM_RADIUS,
  MAP_H,
  MAP_W,
  MAX_GROUND_ITEMS,
  MAX_INPUT_QUEUE,
  MAX_INPUTS_PER_TICK,
  MAX_PLAYERS,
  MIN_PLAYERS_FOR_ROUND,
  PICKUP_RANGE,
  PLAYER_RADIUS,
  PRACTICE_RESPAWN,
  ROUND_END_TIME,
  SUDDEN_DEATH_AFTER,
  SUDDEN_DEATH_DOUBLE,
  SUDDEN_DEATH_MAX,
} from "../shared/constants";
import { BASE_BY_ID } from "../shared/content/bases";
import { MONSTER_BY_ID } from "../shared/content/monsters";
import type { WeaponKind } from "../shared/content/types";
import { flaskProps, type Item, type Rarity } from "../shared/items";
import { BIOMES, PROTOTYPE_BIOME } from "../shared/biomes";
import { currentMap, isWalkable, randomWalkable, setMap, walkableNear, type MapParams } from "../shared/map";
import type { GameEvent, InputCmd, Phase } from "../shared/protocol";
import { copyPhys, newPhysState, stepPlayer } from "../shared/sim";
import { damagePlayer, stepAttack, type CombatHost } from "./combat";
import { damageTick, FINAL_DUEL_PVP_MULT, finalDuel, playerLocked, removeDefence, resetDefence, setActiveBlock, setDamageRefresh, type DamageMeta } from "./damage";
import { wireDefenceProgression } from "./defprog";
import { isGem } from "../shared/skills";
import { autoPlace, equipDirect, giveStarterKit, refreshStats, storeItem, stripAll } from "./inventory";
import { bindLootHost, devLoot, lootMonsterKilled, lootPlayerKilled, lootTick } from "./lootsys";
import { lootDrinkFlask } from "./uniques";
import { monsterDropContext, rollDrops, rollFlask, rollItem } from "./loot";
import { MonsterSystem, type Monster } from "./monsters";
import { newServerPlayer, type ServerPlayer } from "./player";
import {
  initProgression,
  progDevCommand,
  progOnMonsterKilled,
  progOnPlayerKilled,
  progressionTick,
  removeProgression,
  resetProgression,
  setHurtPlayerHandler,
} from "./progression";
import { prog as skProg, playerLevel as skLevel } from "./progression";
import { rollGemDrops, SkillSystem } from "./skills";
import { hudOnFlask, hudOnKill, hudOnWin, hudRoundStart } from "./hudsnap";
import { LaneMode } from "./modes/lanes";
import { TEAM_NAMES, type GameMode } from "../shared/lanes";

export const PLAYER_COLORS = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#42d4f4", "#f032e6",
  "#bfef45", "#fabed4", "#469990", "#dcbeff", "#9a6324", "#fffac8", "#aaffc3", "#ff8080",
  "#00a3a3", "#c0c0ff", "#ffa94d", "#b3ff66",
];

export interface GroundItem {
  g: number; // ground id (new each time an item touches the ground)
  item: Item;
  x: number;
  y: number;
}

/** Edge padding for spawns. */
const EDGE = 80;
/** Practice spawns keep at least this far from players and monsters (monster aggro is <= 300). */
const PRACTICE_SPAWN_CLEARANCE = 380;
/** Lobby-run matches: the countdown is the spawn-point pick (seconds). */
export const SPAWN_PICK_TIME = 10;

type Avoid = { x: number; y: number; alive: boolean };

function isFreeSpot(x: number, y: number, r: number, players: Iterable<Avoid> = [], minPlayerDist = 0) {
  if (x < EDGE || y < EDGE || x > MAP_W - EDGE || y > MAP_H - EDGE) return false;
  if (!isWalkable(x, y, r, 6)) return false; // procedural map: open ground, no obstacle (grid query)
  for (const p of players) if (p.alive && Math.hypot(p.x - x, p.y - y) < minPlayerDist) return false;
  return true;
}

function randomFreeSpot(r: number, players: Iterable<Avoid> = [], minPlayerDist = 0) {
  // Sample open cells of the procedural map (most of a huge map is wall).
  let i = 0;
  return randomWalkable(r, Math.random, (x, y) => isFreeSpot(x, y, r, players, i++ < 300 ? minPlayerDist : 0));
}

/** Nearest free spot to (x, y), searching outward in rings. */
function freeSpotNear(x: number, y: number, r: number) {
  if (isFreeSpot(x, y, r)) return { x, y };
  for (let rad = 12; rad < 600; rad += 12) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const cx = x + Math.cos(ang) * rad;
      const cy = y + Math.sin(ang) * rad;
      if (isFreeSpot(cx, cy, r)) return { x: cx, y: cy };
    }
  }
  return walkableNear(x, y, r, 2000) ?? randomFreeSpot(r);
}

export class Game implements CombatHost {
  players = new Map<number, ServerPlayer>();
  ground = new Map<number, GroundItem>();
  monsters: MonsterSystem;
  phase: Phase = "waiting";
  /** Players needed to start a round. Dev solo mode (HNS_DEV=1 / ?dev=1) sets 1: see GameHost. */
  minPlayers = MIN_PLAYERS_FOR_ROUND;
  phaseLeft = 0;
  /** Seconds of fight played this round (0 before it; frozen on the round-end screen). Sent as SnapMsg.ft. */
  fightTime = 0;
  winner: string | null = null;
  tick = 0;
  events: GameEvent[] = [];
  /** Private messages (toasts) to deliver this tick: player id -> texts. */
  toasts = new Map<number, string[]>();

  private nextId = 1;
  private nextGroundId = 1;
  /** Params of the current procedural map (sent to clients as {t:"map"}). */
  mapParams: MapParams = { ...currentMap().params };
  /** Bumped on every new map; index.ts resends the map when a client's copy is stale. */
  mapVersion = 0;
  private mapCount = 0;
  /** Lobby hook: params for the next match's map (consumed at the next countdown). */
  nextMap: Partial<MapParams> | null = null;
  /** Mode of the running match, and the lobby's pick for the next one (Breachway: server/modes/lanes.ts). */
  mode: GameMode = "royale";
  nextMode: GameMode = "royale";
  /** The lane mode controller while a Breachway match runs. */
  lanes: LaneMode | null = null;
  /**
   * Lobby-run matches (P2P host, src/net/hostruntime.ts): "waiting" is open practice and never
   * starts a countdown by itself (beginMatch() does), the countdown is a spawn-point pick that only
   * collapses when everyone is gone, and "ended" falls back to practice instead of a new round.
   */
  lobbyManaged = false;
  /** Spawn points offered during a lobby-run countdown, and player id -> chosen index. */
  spawnChoices: { x: number; y: number }[] = [];
  readonly spawnTaken = new Map<number, number>();
  private readonly dropFn = (item: Item, x: number, y: number) => this.dropItem(item, x, y);
  /** Skills, mana, gems (server/skills.ts). */
  skills!: SkillSystem;

  constructor() {
    this.monsters = new MonsterSystem({
      damagePlayer: (p, dmg, fx, fy, kb, source, meta) => damagePlayer(this, p, dmg, fx, fy, kb, null, source, -1, meta as DamageMeta | undefined),
      boom: (x, y, r) => this.events.push({ k: "boom", x: Math.round(x), y: Math.round(y), r }),
      // monsters agent: exile gear drops, boss shouts, shrine toasts, loot-shrine extra drops
      spill: (items, x, y) => this.spill(items, x, y),
      info: (text) => this.events.push({ k: "info", text }),
      toast: (p, text) => this.toast(p, text),
      extraDrops: (m, killer, rolls) => {
        // Bonus rolls (rare modifiers / bosses): normal-table rolls at the monster's level and the killer's find.
        const dc = monsterDropContext(m, killer ?? null);
        for (let i = 0; i < rolls; i++) this.spill(rollDrops("normal", dc), m.x, m.y);
      },
    });
    this.newMap(MIN_PLAYERS_FOR_ROUND);
    this.monsters.populate([]);
    // Progression (XP, passives, trials): state lives in server/progression.ts.
    initProgression(this, (p) => refreshStats(p, this.dropFn));
    setDamageRefresh((p) => refreshStats(p, this.dropFn)); // chill changes move speed (server/damage.ts)
    wireDefenceProgression(this); // passives <-> defence pipeline (server/defprog.ts)
    setHurtPlayerHandler((t, dmg, from, source) => damagePlayer(this, t, dmg, from.x, from.y, 0, from, source));
    bindLootHost({
      toast: (p, t) => this.toast(p, t),
      dropItem: (it, x, y, spread) => this.dropItem(it, x, y, spread),
      damagePlayerRaw: (t, dmg, by, src) => void damagePlayer(this, t, dmg, by.x, by.y, 0, by, src),
      refresh: (p) => refreshStats(p, this.dropFn),
    });
    this.skills = new SkillSystem(this, (p) => refreshStats(p, this.dropFn), (p) => skProg(p).def);
  }

  /** Generate a fresh map for this many players (biome rotation). */
  newMap(players: number, biome?: string, seed?: number, mode?: "lanes") {
    const envBiome = typeof process !== "undefined" ? process.env?.HNS_BIOME : undefined;
    // Prototype: one biome only (HNS_BIOME overrides, default hollowpine). No rotation.
    const b = biome ?? envBiome ?? PROTOTYPE_BIOME;
    this.mapCount++;
    this.mapParams = { seed: seed ?? (Math.random() * 0x7fffffff) | 0, players: Math.max(MIN_PLAYERS_FOR_ROUND, players), biome: b, ...(mode ? { mode } : {}) };
    setMap(this.mapParams);
    this.mapVersion++;
  }

  /** Spread-out spawn points for n players, picked from the map's spawn candidates. */
  private pickSpawns(n: number): { x: number; y: number }[] {
    const cands = [...currentMap().spawns];
    const out: { x: number; y: number }[] = [];
    if (!cands.length) return out;
    out.push(cands.splice(Math.floor(Math.random() * cands.length), 1)[0]);
    while (out.length < n && cands.length) {
      let bi = 0;
      let bd = -1;
      cands.forEach((c, i) => {
        const d = Math.min(...out.map((o) => Math.hypot(o.x - c.x, o.y - c.y))) * (0.85 + Math.random() * 0.3);
        if (d > bd) {
          bd = d;
          bi = i;
        }
      });
      out.push(cands.splice(bi, 1)[0]);
    }
    for (let i = out.length; i < n; i++) out.push(randomFreeSpot(PLAYER_RADIUS));
    return out;
  }

  get joined(): ServerPlayer[] {
    return [...this.players.values()].filter((p) => p.joined);
  }

  get aliveCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (p.joined && p.alive) n++;
    return n;
  }

  toast(p: ServerPlayer, text: string) {
    const list = this.toasts.get(p.id) ?? [];
    list.push(text);
    this.toasts.set(p.id, list);
  }

  /** Creates a not-yet-joined connection slot. */
  addConnection(): ServerPlayer {
    const p = newServerPlayer(this.nextId++);
    this.players.set(p.id, p);
    return p;
  }

  /** Returns false if the server is full. */
  join(p: ServerPlayer, name: string, weapon: WeaponKind): boolean {
    if (p.joined) return true;
    if (this.joined.length >= MAX_PLAYERS) return false;
    p.joined = true;
    p.name = name;
    p.startWeapon = weapon;
    const used = new Set(this.joined.map((o) => o.color));
    p.color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[p.id % PLAYER_COLORS.length];
    giveStarterKit(p, weapon, this.dropFn);
    if (this.lobbyManaged && this.phase === "countdown" && this.spawnChoices.length) {
      // Rejoined during the spawn pick: take the free spawn point farthest from everyone else.
      const i = this.freeSpawnChoice();
      if (i >= 0) this.spawnTaken.set(p.id, i);
      const sp = i >= 0 ? this.spawnChoices[i] : this.practiceSpawnSpot();
      this.spawn(p, freeSpotNear(sp.x, sp.y, PLAYER_RADIUS));
    } else if (this.phase === "waiting" || this.phase === "countdown") {
      this.spawn(p, this.practiceSpawnSpot());
    } else {
      p.alive = false; // spectate until the next round
      p.hp = 0;
      this.events.push({ k: "info", text: `${p.name} is spectating until the next round` });
    }
    this.events.push({ k: "info", text: `${p.name} joined` });
    return true;
  }

  remove(p: ServerPlayer) {
    if (p.joined && p.alive && !this.lanes) this.spill(stripAll(p), p.x, p.y); // full loot: leaving drops everything
    this.players.delete(p.id);
    this.spawnTaken.delete(p.id);
    removeProgression(p);
    removeDefence(p);
    if (p.joined) this.events.push({ k: "info", text: `${p.name} left` });
  }

  /** Queue inputs from a client. Ignores stale/duplicate seqs and caps queue size. */
  queueInputs(p: ServerPlayer, cmds: InputCmd[]) {
    const lastQueued = p.inputs.length ? p.inputs[p.inputs.length - 1].seq : p.lastSeq;
    let last = lastQueued;
    for (const c of cmds) {
      if (c.seq <= last) continue;
      p.inputs.push(c);
      last = c.seq;
    }
    // Drop the oldest excess; the client will be corrected by reconciliation.
    if (p.inputs.length > MAX_INPUT_QUEUE) {
      const dropped = p.inputs.splice(0, p.inputs.length - MAX_INPUT_QUEUE);
      p.lastSeq = dropped[dropped.length - 1].seq;
    }
  }

  spawn(p: ServerPlayer, at: { x: number; y: number }) {
    copyPhys(newPhysState(at.x, at.y), p);
    p.angle = Math.atan2(MAP_H / 2 - at.y, MAP_W / 2 - at.x); // face the center
    p.hp = p.stats.maxHp;
    p.alive = true;
    resetDefence(p); // full energy shield, no ailments (server/damage.ts)
    p.deadFor = 0;
    p.heals = [];
  }

  // ---- ground items -----------------------------------------------------------

  dropItem(item: Item, x: number, y: number, spread = 50) {
    const a = Math.random() * Math.PI * 2;
    const d = 10 + Math.random() * spread;
    const spot = freeSpotNear(x + Math.cos(a) * d, y + Math.sin(a) * d, ITEM_RADIUS);
    const g: GroundItem = { g: this.nextGroundId++, item, x: Math.round(spot.x), y: Math.round(spot.y) };
    this.ground.set(g.g, g);
    while (this.ground.size > MAX_GROUND_ITEMS) this.ground.delete(this.ground.keys().next().value!);
  }

  /** ARPG-style spill: items fan out in a ring around a point. */
  spill(items: Item[], x: number, y: number) {
    if (this.lanes) return; // Breachway: no loot on the ground (no full loot, monsters drop nothing)
    const n = items.length;
    const off = Math.random() * Math.PI * 2;
    items.forEach((it, i) => {
      const a = off + (i / Math.max(1, n)) * Math.PI * 2;
      const d = 30 + (i % 3) * 22 + Math.random() * 10;
      this.dropItem(it, x + Math.cos(a) * d, y + Math.sin(a) * d, 4);
    });
  }

  /** Pick up (or equip directly) a ground item. All checks are server-side. */
  pickup(p: ServerPlayer, g: unknown, equip: boolean) {
    if (typeof g !== "number" || !p.alive) return;
    const gi = this.ground.get(g);
    if (!gi) return this.toast(p, "Already taken");
    if (Math.hypot(gi.x - p.x, gi.y - p.y) > PICKUP_RANGE) return this.toast(p, "Too far away");
    const gem = isGem(gi.item); // gems are never "equipped": they go to the bag, cut skill gems onto the bar
    const err = equip && !gem ? equipDirect(p, gi.item, this.dropFn) : storeItem(p, gi.item);
    if (err) return this.toast(p, err);
    this.ground.delete(g);
    if (gem) this.skills.onPickup(p, gi.item, autoPlace);
  }

  // ---- flasks -------------------------------------------------------------------

  useFlask(p: ServerPlayer, i: unknown) {
    if (!p.alive || typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= p.stats.flaskSlots) return;
    if (this.phase === "countdown") return;
    const f = p.flasks[i];
    if (!f) return;
    const props = flaskProps(f, p.stats.flaskRecovery);
    if ((f.c ?? 0) < props.perUse) return this.toast(p, "Not enough charges");
    if (Math.random() >= props.noConsume) f.c = (f.c ?? 0) - props.perUse; // "chance to not consume charges"
    p.invDirty = true;
    // Recovery, partial / low-life instant, cures and unique flask buffs (server/uniques.ts).
    const overTime = lootDrinkFlask(p, f, props);
    hudOnFlask(p, i, overTime);
    this.events.push({ k: "heal", target: p.id });
  }

  addCharges(p: ServerPlayer, amount: number) {
    for (const f of p.flasks) {
      if (!f) continue;
      const props = flaskProps(f, 1);
      f.c = Math.min(props.maxCharges, (f.c ?? 0) + amount * p.stats.flaskChargeGain * props.gainMult);
    }
    p.invDirty = true;
  }

  // ---- kills --------------------------------------------------------------------

  onPlayerKilled(victim: ServerPlayer, killer: ServerPlayer | null, source: string) {
    if (!victim.alive) return;
    if (this.lanes) {
      // Breachway: keep your gear, respawn after a timer; the mode pays the kill.
      victim.alive = false;
      victim.deadFor = 0;
      victim.hp = 0;
      this.lanes.onPlayerKilled(victim, killer);
      if (killer) {
        killer.kills++;
        this.addCharges(killer, CHARGES_PLAYER_KILL);
      }
      hudOnKill(victim, killer, source, undefined);
      this.events.push({ k: "kill", killer: killer?.name ?? source, victim: victim.name, vid: victim.id, x: Math.round(victim.x), y: Math.round(victim.y), kid: killer?.id });
      return;
    }
    progOnPlayerKilled(victim, killer);
    victim.alive = false;
    victim.deadFor = 0;
    victim.hp = 0;
    this.spill(stripAll(victim), victim.x, victim.y);
    refreshStats(victim, this.dropFn);
    if (killer) {
      killer.kills++;
      this.addCharges(killer, CHARGES_PLAYER_KILL);
    }
    lootPlayerKilled(killer);
    const place = this.phase === "fight" ? this.aliveCount + 1 : undefined;
    hudOnKill(victim, killer, source, place);
    this.events.push({ k: "kill", killer: killer?.name ?? source, victim: victim.name, vid: victim.id, x: Math.round(victim.x), y: Math.round(victim.y), kid: killer?.id, pl: place });
  }

  onMonsterKilled(m: Monster, killer: ServerPlayer) {
    if (this.lanes) {
      // Breachway: the wave purse replaces monster XP and drops.
      this.lanes.onUnitDied(m, killer);
      this.addCharges(killer, CHARGES_NORMAL_KILL);
      return;
    }
    progOnMonsterKilled(m, killer);
    // Rare/unique only: magic monsters carry a mod list too, but shouldn't roll elite loot/charges.
    const mr = (m as unknown as { rarity?: number }).rarity;
    const elite = typeof mr === "number" ? mr >= 2 : !!m.elite;
    // PoE2 drops (server/loot.ts): item level = monster level, monster rarity + killer's rarity/quantity.
    const dc = monsterDropContext(m, killer);
    this.spill(rollDrops(dc.monRarity === 3 ? "boss" : dc.monRarity === 2 ? "elite" : "normal", dc), m.x, m.y);
    this.spill(rollGemDrops(elite ? "elite" : "normal", skLevel(killer) + (elite ? 6 : 1), killer), m.x, m.y);
    this.addCharges(killer, elite ? CHARGES_ELITE_KILL : CHARGES_NORMAL_KILL);
    lootMonsterKilled(killer, elite, false, m.x, m.y);
    if (elite) this.events.push({ k: "info", text: `${killer.name} slew ${m.eliteName}` });
  }

  // ---- phases ---------------------------------------------------------------------

  private setPhase(phase: Phase, time: number) {
    this.phase = phase;
    this.phaseLeft = time;
    if (phase !== "ended") this.fightTime = 0;
  }

  /** Lobby-run: start a match with everyone joined now. False while one is already running. */
  beginMatch(): boolean {
    if (this.phase === "countdown" || this.phase === "fight" || !this.joined.length) return false;
    this.startCountdown();
    return true;
  }

  /** Lobby-run: back to open practice right away (after a match, or when it is called off). */
  toWaiting() {
    this.spawnChoices = [];
    this.spawnTaken.clear();
    if (this.lanes) this.leaveLanes();
    this.enterWaiting();
  }

  /** After a Breachway match: back to a royale practice map. */
  private leaveLanes() {
    this.lanes?.stop();
    this.lanes = null;
    this.mode = "royale";
    this.ground.clear();
    this.newMap(MIN_PLAYERS_FOR_ROUND);
    this.monsters.populate([]);
    for (const p of this.joined) {
      p.team = undefined;
      if (p.alive) this.spawn(p, this.practiceSpawnSpot());
    }
  }

  /** Free spawn choice farthest from the taken ones (-1 if none is free). */
  private freeSpawnChoice(): number {
    const taken = new Set(this.spawnTaken.values());
    let best = -1;
    let bd = -1;
    this.spawnChoices.forEach((c, i) => {
      if (taken.has(i)) return;
      let d = Infinity;
      for (const t of taken) d = Math.min(d, Math.hypot(this.spawnChoices[t].x - c.x, this.spawnChoices[t].y - c.y));
      if (d > bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** Lobby-run spawn pick: move a player to spawn choice i during the countdown. Error text or null. */
  pickSpawn(p: ServerPlayer, i: unknown): string | null {
    if (!this.lobbyManaged || this.phase !== "countdown") return "Spawn points are picked during the countdown.";
    if (!p.joined || !p.alive) return "You are not in this match.";
    if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= this.spawnChoices.length) return "No such spawn point.";
    for (const [pid, idx] of this.spawnTaken) if (idx === i && pid !== p.id) return "Someone already stands there.";
    const sp = this.spawnChoices[i];
    this.spawnTaken.set(p.id, i);
    this.spawn(p, freeSpotNear(sp.x, sp.y, PLAYER_RADIUS));
    p.inputs.length = 0;
    return null;
  }

  private startCountdown() {
    if (this.lanes) this.leaveLanes();
    if (this.nextMode === "lanes") return this.startLanes();
    this.setPhase("countdown", this.lobbyManaged ? SPAWN_PICK_TIME : COUNTDOWN_TIME);
    this.winner = null;
    this.ground.clear();
    const ps = this.joined;
    // New procedural map every match, sized for the player count. Fresh gear, spread-out spawns.
    const nm = this.nextMap;
    this.nextMap = null;
    this.newMap(nm?.players ?? ps.length, undefined, nm?.seed); // prototype: lobby biome pick ignored (one biome)
    const spots = this.pickSpawns(ps.length);
    // Lobby-run: every spawn candidate is offered; players start on the auto-picked spread-out ones.
    this.spawnChoices = this.lobbyManaged ? [...currentMap().spawns] : [];
    this.spawnTaken.clear();
    ps.forEach((p, i) => {
      resetProgression(p); // level 1, empty tree (keeps the class)
      giveStarterKit(p, p.startWeapon, this.dropFn);
      const sp = spots[i];
      const ci = this.spawnChoices.indexOf(sp);
      if (ci >= 0) this.spawnTaken.set(p.id, ci);
      this.spawn(p, freeSpotNear(sp.x, sp.y, PLAYER_RADIUS));
      p.inputs.length = 0; // discard stale movement from before the round
    });
    hudRoundStart(ps);
    this.monsters.populate(ps);
    this.events.push({ k: "info", text: "Round starting!" });
  }

  /** Breachway countdown: the lane map, two teams at their platforms, structures up. */
  private startLanes() {
    this.mode = "lanes";
    this.setPhase("countdown", COUNTDOWN_TIME);
    this.winner = null;
    this.ground.clear();
    this.nextMap = null;
    const ps = this.joined;
    this.newMap(ps.length, undefined, undefined, "lanes");
    this.spawnChoices = [];
    this.spawnTaken.clear();
    this.lanes = new LaneMode(this);
    this.lanes.start(ps);
    for (const p of ps) {
      resetProgression(p);
      giveStarterKit(p, p.startWeapon, this.dropFn);
      this.spawn(p, this.lanes.respawnSpot(p.team ?? 0));
      p.angle = p.team === 1 ? Math.PI : 0;
      p.inputs.length = 0;
    }
    hudRoundStart(ps);
    this.events.push({ k: "info", text: "Breachway: destroy the enemy Core!" });
  }

  private enterWaiting() {
    this.setPhase("waiting", 0);
    this.winner = null;
    for (const p of this.joined) if (!p.alive) this.practiceRespawn(p);
  }

  private practiceRespawn(p: ServerPlayer) {
    giveStarterKit(p, p.startWeapon, this.dropFn);
    this.spawn(p, this.practiceSpawnSpot());
  }

  /** Practice spawn: away from other players and out of monster aggro range. */
  private practiceSpawnSpot() {
    const avoid: Avoid[] = [...this.players.values()];
    for (const m of this.monsters.monsters.values()) avoid.push({ x: m.x, y: m.y, alive: true });
    return randomFreeSpot(PLAYER_RADIUS, avoid, PRACTICE_SPAWN_CLEARANCE);
  }

  private isFrozen(p: ServerPlayer) {
    return !p.alive || this.phase === "countdown" || playerLocked(p); // stun / freeze / electrocute (server/damage.ts)
  }

  /** Damage only counts in practice and during the fight. */
  private combatEnabled() {
    return this.phase === "waiting" || this.phase === "fight";
  }

  update() {
    this.tick++;
    const players = this.joined;
    progressionTick(players);

    // 1. Simulate queued inputs (rate-limited by a token bucket).
    for (const p of players) {
      p.inputTokens = Math.min(MAX_INPUTS_PER_TICK, p.inputTokens + 1);
      while (p.inputs.length && p.inputTokens >= 1) {
        const cmd = p.inputs.shift()!;
        p.inputTokens -= 1;
        p.lastSeq = cmd.seq;
        // Raised shield (hold): needs a shield in the offhand; no attacks / skills while raised.
        if (cmd.blk) {
          if (BASE_BY_ID.get(p.equip.offhand?.b ?? "")?.sub !== "shield") delete cmd.blk;
          else delete cmd.sk;
        }
        const swung = stepPlayer(p, cmd, this.isFrozen(p), p.stats);
        if (cmd.blk && p.alive && !this.isFrozen(p) && p.rollT <= 0) setActiveBlock(p, p.angle, 0.2); // refreshed every held tick
        stepAttack(this, p, swung, p.alive && this.combatEnabled(), players);
        this.skills.afterInput(p, cmd.sk);
      }
    }

    finalDuel.mult = this.phase === "fight" && this.aliveCount === 2 && this.joined.length > 2 ? FINAL_DUEL_PVP_MULT : 1;
    if (this.lanes) finalDuel.mult = 1.5; // Breachway PvP multiplier 0.6 (= 0.4 x 1.5), no sudden death
    else if (this.phase === "fight" && this.fightTime > SUDDEN_DEATH_AFTER) finalDuel.mult *= Math.min(SUDDEN_DEATH_MAX, 2 ** ((this.fightTime - SUDDEN_DEATH_AFTER) / SUDDEN_DEATH_DOUBLE));

    // 2. Regen + flask heals.
    for (const p of players) {
      if (!p.alive) continue;
      let heal = p.stats.lifeRegen * DT;
      for (const h of p.heals) {
        heal += h.perSec * Math.min(DT, h.t);
        h.t -= DT;
      }
      p.heals = p.heals.filter((h) => h.t > 0);
      if (heal > 0) p.hp = Math.min(p.stats.maxHp, p.hp + heal);
    }

    lootTick(players); // charm triggers, unique timers, mana flasks

    // 3. Monsters (paused during the countdown), auras -> stats.
    if (this.phase !== "countdown") this.monsters.update(this.players, this.phase === "waiting");
    for (const p of this.monsters.applyAuras(players)) refreshStats(p, this.dropFn);
    this.skills.update(); // mana, cooldowns, skill projectiles, totems, burns
    if (this.phase !== "countdown") damageTick(this, players); // ES recharge, ailments, DoT (server/damage.ts)

    // 4. Phases.
    const n = players.length;
    if (this.phaseLeft > 0) this.phaseLeft = Math.max(0, this.phaseLeft - DT);
    switch (this.phase) {
      case "waiting":
        for (const p of players) {
          if (p.alive) continue;
          p.deadFor += DT;
          if (p.deadFor >= PRACTICE_RESPAWN) this.practiceRespawn(p);
        }
        if (!this.lobbyManaged && n >= this.minPlayers) this.startCountdown();
        break;
      case "countdown":
        if (this.lobbyManaged ? n === 0 : n < this.minPlayers) this.enterWaiting();
        else if (this.phaseLeft <= 0) {
          this.setPhase("fight", 0);
          this.events.push({ k: "info", text: "FIGHT!" });
        }
        break;
      case "fight": {
        this.fightTime += DT;
        if (this.lanes) {
          this.lanes.update();
          if (this.lanes.winner !== null) {
            const w = this.lanes.winner;
            this.setPhase("ended", ROUND_END_TIME);
            this.winner = `${TEAM_NAMES[w]}`;
            for (const p of players) if (p.team === w) {
              p.wins++;
              hudOnWin(p);
            }
            this.events.push({ k: "info", text: `${TEAM_NAMES[w]} wins: the enemy Core has fallen!` });
          }
          break;
        }
        if (this.fightTime >= SUDDEN_DEATH_AFTER && this.fightTime - DT < SUDDEN_DEATH_AFTER && this.aliveCount > 1) this.events.push({ k: "info", text: "Sudden death: players hurt each other more" });
        const alive = players.filter((p) => p.alive);
        // Solo dev round: runs until the lone player dies (no instant win).
        if (alive.length <= (n < 2 && this.minPlayers < 2 ? 0 : 1)) {
          this.setPhase("ended", ROUND_END_TIME);
          if (alive.length === 1) {
            hudOnWin(alive[0]);
            alive[0].wins++;
            this.winner = alive[0].name;
            this.events.push({ k: "info", text: `${alive[0].name} wins the round!` });
          } else {
            this.winner = null;
            this.events.push({ k: "info", text: "Nobody survived." });
          }
        }
        break;
      }
      case "ended":
        if (this.phaseLeft <= 0) {
          if (this.lobbyManaged) this.toWaiting();
          else if (n >= this.minPlayers) this.startCountdown();
          else this.enterWaiting();
        }
        break;
    }

    // 5. Spectate targets for dead players.
    for (const p of players) {
      if (p.alive) {
        p.specId = -1;
        continue;
      }
      const cur = this.players.get(p.specId);
      if (cur?.alive) continue;
      let best: ServerPlayer | null = null;
      for (const o of players) if (o.alive && (!best || o.kills > best.kills)) best = o;
      p.specId = best?.id ?? -1;
    }
  }

  /** Drains this tick's events. */
  takeEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---- dev commands (HNS_DEV=1 only; used by tests and for solo tuning) ----------

  devCommand(p: ServerPlayer, msg: Record<string, unknown>) {
    const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    switch (msg.cmd) {
      case "gem": // skills agent (server/skills.ts)
      case "mana":
      case "nocd":
        this.skills.dev(p, msg);
        break;
      case "spawn": {
        const type = MONSTER_BY_ID.get(String(msg.type)) ?? MONSTER_BY_ID.get("gnashling")!;
        const d = num(msg.dist, 90);
        const at = freeSpotNear(p.x + Math.cos(p.angle) * d, p.y + Math.sin(p.angle) * d, type.radius);
        // No camp: a loose monster (no camp snapshot, so no braziers / totems / stakes drawn around it).
        const m = this.monsters.spawnLoose(type, at, msg.elite === true, typeof msg.rarity === "number" ? (Math.max(0, Math.min(3, msg.rarity | 0)) as 0 | 1 | 2 | 3) : undefined); // monsters agent: rarity
        this.toast(p, `dev: spawned ${m.eliteName ?? type.name} #${m.id}`);
        break;
      }
      case "hp":
        if (p.alive) p.hp = Math.max(1, Math.min(p.stats.maxHp, num(msg.v, p.hp)));
        break;
      case "lanefell": // Breachway dev: knock down the enemy team's front-most standing structure
        this.lanes?.devFell(p);
        break;
      case "tp":
        if (p.alive) {
          const s = freeSpotNear(num(msg.x, p.x), num(msg.y, p.y), PLAYER_RADIUS);
          p.x = s.x;
          p.y = s.y;
        }
        break;
      case "loot": // loot agent: currency / runes / ichors / uniques / charms / jewels (server/lootsys.ts)
        devLoot(p, msg);
        break;
      case "give": {
        const base = String(msg.base ?? "");
        const ilvl = num(msg.ilvl, 10);
        const rarity = Math.max(0, Math.min(2, Math.round(num(msg.rarity, 1)))) as Rarity;
        const item = BASE_BY_ID.has(base) || !base ? rollItem(ilvl, rarity, base || undefined) : rollFlask(ilvl, base, 1);
        this.dropItem(item, p.x, p.y, 20);
        break;
      }
      case "map": {
        // New map now (testing): {cmd:"map", biome?, players?, seed?}. Everyone respawns on it.
        const n = num(msg.players, Math.max(MIN_PLAYERS_FOR_ROUND, this.joined.length));
        this.newMap(n, typeof msg.biome === "string" ? msg.biome : undefined, typeof msg.seed === "number" ? msg.seed : undefined);
        this.ground.clear();
        const spots = this.pickSpawns(this.joined.length);
        this.joined.forEach((o, i) => {
          if (!o.alive) return;
          const sp = freeSpotNear(spots[i].x, spots[i].y, PLAYER_RADIUS);
          o.x = sp.x;
          o.y = sp.y;
        });
        this.monsters.populate(this.joined);
        break;
      }
      default:
        progDevCommand(p, msg); // xp / level / trialdone / shrinetp
        break;
      case "clear": // remove all monsters and ground loot (isolated tests)
        this.monsters.camps = [];
        this.monsters.monsters.clear();
        this.monsters.projectiles = [];
        this.monsters.hazards = [];
        this.ground.clear();
        break;
    }
  }
}
