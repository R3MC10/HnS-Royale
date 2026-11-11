// Host-added bot players (src/net/hostruntime.ts adds / removes them on the host's request).
// A bot is an ordinary hall member on an in-memory HostConn: it speaks the same protocol messages as
// a real client (r-hello / r-ready / r-spawn, then input / pickup / cut / socket / alloc / flask) and
// sees only what a client is sent (its own snapshots, inventory, stats ...). No access to Game state.
// The map comes from shared/map.ts, which the client regenerates from the same seed.
// Each bot: a small utility AI: clear monster camps for XP / loot, equip upgrades, cut and socket gems,
// quaff life flasks when hurt, allocate passives, dodge telegraphs, fight players when it is the
// stronger one (or the map has thinned out), flee when losing, and drift toward the map centre as
// the match goes on so it converges.
// CPU: a bot decides every THINK_EVERY ticks (staggered across bots) and repeats its last input in
// between; snapshots it does not think on are not even parsed (unless they carry item defs / camps).
// Browser-safe (runs in the host's Web Worker): no node:* imports.
import { currentMap, getCampSpots } from "../../shared/map";
import { BOT_LATE_SECS, TICK_RATE } from "../../shared/constants";
import { BASE_BY_ID, meetsRequirements } from "../../shared/content/bases";
import { CLASSES } from "../../shared/content/classes";
import { FLASK_BASE_BY_ID } from "../../shared/content/flasks";
import { PASSIVE_NODES, PASSIVE_BY_ID } from "../../shared/content/passives";
import { defaultSlotFor, flaskProps, type Item } from "../../shared/items";
import type { MonsterSnap, PlayerSnap, HazardSnap, CampSnap, InvMsg, ProjSnap } from "../../shared/protocol";
import { SKILL_GEM_BY_ID, SUPPORT_GEMS, ROUGH_SPIRIT, ROUGH_SUPPORT, innateFor, isSpiritDef } from "../../shared/content/gems";
import { cutOptions, supportRefusal, skillDefOf, supportDefOf, isRough, isSkillGem, isSupportGem, isGem, upgradeRefusal, levelCost, gemLevel, socketCount, supportAt, supportTier, type BarSlot } from "../../shared/skills";
import { findPath, steer, takePathSlot } from "./path";

export const BOT_NAMES = ["Ashwick", "Brenna", "Corvin", "Dagny", "Edric", "Fenna", "Garrick", "Hilde", "Ivo", "Jorun", "Kael", "Lyra", "Maren", "Nils", "Orla", "Pike", "Quill", "Runa", "Sable", "Torvin"];

const hyp = Math.hypot;
const SKILL_DEF = (id: string) => SKILL_GEM_BY_ID.get(id);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const angTo = (ax: number, ay: number, bx: number, by: number) => Math.atan2(by - ay, bx - ax);

/** A bot decides once every this many host ticks (10 Hz); in between it repeats its last input. */
const THINK_EVERY = 3;
const THINK_DT = THINK_EVERY / TICK_RATE;
/** A per-tick (30 Hz) probability, rolled once per decision instead. */
const chance = (perTick: number) => Math.random() < 1 - Math.pow(1 - Math.min(1, perTick), THINK_EVERY);
/** Dead bots only watch: one snapshot a second is plenty. */
const DEAD_EVERY = TICK_RATE;

// ---- items --------------------------------------------------------------------------------------

function itemScore(it: Item | null | undefined): number {
  if (!it) return -1;
  const b = BASE_BY_ID.get(it.b);
  let s = it.r * 9 + it.l * 1.2 + (it.m?.length ?? 0) * 2.5;
  if (b) {
    s += ((b.armour ?? 0) + (b.evasion ?? 0) + (b.barrier ?? 0) * 1.5) / 6;
    if (b.weapon) s += (b.weapon.damage / Math.max(0.3, b.weapon.cooldown)) * 0.6;
  }
  return s;
}

// ---- bot -------------------------------------------------------------------------------------

/** Seconds after FIGHT! during which bots do not start fights with players (small lobbies count as "late" from second 0, so bots used to hunt a new player within 8 s). */
const OPENING_TRUCE = 40;
const CHASE_GIVE_UP_MS = 7000; // a player target not damaged for this long is dropped
const CHASE_IGNORE_MS = 15000; // and not picked again for this long
// ---- monsters: what a player learns in a match or two (bots stand in for players in every balance measurement) ----
/** The boss is left alone below this level (it scales to whoever wakes it; bots that tried it at 9 died and almost never killed it). */
const BOSS_MIN_LV = 12;
/** A boss hunter sets out for the lair only above this share of life with a flask use ready, and tries again this long after a visit. */
const BOSS_GO_HP = 0.7;
const BOSS_RETRY_MS = 40000;
/**
 * Committed: the boss once a ready bot fights it, and a rare or rogue exile under this share of life, are finished
 * before anything else unless a player keeps hitting the bot (bots walked off half-dead targets for passing players:
 * 80% of boss fights and half of the exile fights at level 6-10 ended without a result).
 */
const COMMIT_HP = 0.5;
/** Not ready for the boss: roam, converge and fight outside this distance from its lair (aggro 437 px, volley 420 px). */
const BOSS_KEEP_OUT = 900;
/** Not ready and the boss is awake within this distance: back out of its arena. */
const BOSS_FLEE_DIST = 620;
/**
 * Rogue exiles scale to the player now (ai/hooks.ts), so bots fight them at any level (the old rule: never under
 * level 10). They still leave one alone under 60% life, and run from one that is on them under this share of life.
 */
const EXILE_FLEE_HP = 0.4;
/** Life fraction under which a bot with no flask use left backs out of a monster fight. */
const WEAK_HP = 0.3;
/** Monster projectiles fly 240 - 480 px/s: the bot sidesteps one that would pass this close within PROJ_DODGE_SECS. */
const PROJ_DODGE_PAD = 34;
const PROJ_DODGE_SECS = 0.8;
type Goal = { kind: "camp" | "explore" | "center" | "loot" | "flee" | "hunt"; x: number; y: number; g?: number; until: number };

class Brain {
  id = -1;
  seq = 0;
  phase = "waiting";
  alive = 0;
  total = 0;
  me: PlayerSnap | null = null;
  monsters: MonsterSnap[] = [];
  players: PlayerSnap[] = [];
  hazards: HazardSnap[] = [];
  projs: ProjSnap[] = [];
  /** Monster projectiles seen on the previous decision (id -> position and time), for their velocity. */
  projSeen = new Map<number, { x: number; y: number; t: number }>();
  bossAt: { x: number; y: number } | null = null;
  /** This decision steps out of a telegraph or off a shot's line: the boss-arena guard in moveDir() lets it be. */
  urgent = false;
  /** Which way round the boss arena's rim this bot is going (kept for a moment: no dithering at the far side). */
  rimSide = 0;
  rimAt = 0;
  ground: [number, number, number][] = [];
  defs = new Map<number, Item>();
  camps: CampSnap[] = [];
  inv: InvMsg | null = null;
  lv = 1;
  pts = 0;
  alloc: string[] = [];
  attrs = { str: 0, dex: 0, int: 0 };
  maxMana = 60;
  mana = 60;
  flaskSlots = 1;
  // personality
  aggro = rnd(0.35, 1);
  skill = rnd(0.4, 1); // dodge / kiting competence
  greed = rnd(0.4, 1);
  // memory
  spawnPicked = false;
  spawnAt = 0;
  tried = new Set<number>();
  visitedCamps: { x: number; y: number; t: number }[] = [];
  goal: Goal | null = null;
  path: { x: number; y: number }[] = [];
  pathFor = "";
  pathAt = 0;
  moveA = 0;
  lastX = 0;
  lastY = 0;
  stuckT = 0;
  unstickT = 0;
  unstickA = 0;
  dodgeCd = 0;
  flaskAt = 0;
  skillHold = 0;
  skillCd = rnd(1, 3);
  allocAt = 0;
  target: { m?: number; p?: number } | null = null;
  targetAt = 0;
  strafe = Math.random() < 0.5 ? 1 : -1;
  strafeT = 0;
  fightStart = 0;
  lastHp = 0;
  hurtT = 0;
  hitBy = new Map<number, { n: number; t: number }>();
  ranged = false;
  skillRange = 120;
  // give up on monsters we cannot damage (unreachable / leashed) instead of standing there forever
  mobId = -1;
  mobHp = 0;
  mobSince = 0;
  ignoreM = new Map<number, number>();
  /** Players this bot gave up chasing (id -> ms until it may pick them again). */
  ignoreP = new Map<number, number>();
  /** Camps this bot saw emptied ("x,y" of the camp snapshot). */
  emptyCamps = new Set<string>();
  // a player target we are not hurting (a wall in between): walk the path to it instead of pushing straight at it
  foeId = -1;
  foeHp = 0;
  foeSince = 0;
  // gems / skills
  bar: BarSlot[] = [];
  on: number[] = [];
  wk = "";
  spirit = 0;
  gemAt = 0;
  gemTries = new Map<string, number>();
  slotReady: number[] = new Array(16).fill(0);
  skSlot = -1;
  auraAt = 0;
  last: [number, number, number][] | null = null;
  bossHunter = false;
  /** Not before this time (ms): back to the lair for another try (was: one visit per match). */
  bossNext = 0;

  tpv: { id: number; x: number; y: number; at: number; vx: number; vy: number } | null = null;
  /** Last input sent: repeated (without the dodge press) on the ticks between two decisions. */
  lastCmd: { mx: number; my: number; angle: number; attack: boolean; sk?: number } | null = null;

  constructor(readonly idx: number, readonly send: (m: unknown) => void) {
    this.bossHunter = true; // every bot tries the boss once ready (was one in three: the boss was almost never taken)
  }

  onMsg(m: any) {
    switch (m.t) {
      case "welcome":
        this.id = m.id;
        break;
      case "map":
        // Same realm as the host: shared/map.ts already holds this map (a remote client regenerates it from these params).
        break;
      case "r-spawns":
        this.onSpawns(m);
        break;
      case "inv":
        this.inv = m;
        this.ranged = !!BASE_BY_ID.get(m.equip?.mainhand?.b ?? "")?.weapon?.ranged;
        this.wk = BASE_BY_ID.get(m.equip?.mainhand?.b ?? "")?.weapon?.kind ?? "";
        if (this.wk === "bow" || this.wk === "crossbow") this.ranged = true;
        break;
      case "stats":
        this.flaskSlots = m.stats.flaskSlots ?? 1;
        this.maxMana = m.stats.maxMana ?? 60;
        this.spirit = m.stats.spirit ?? 0;
        break;
      case "prog":
        this.lv = m.lv;
        this.pts = m.pts;
        this.alloc = m.alloc;
        if (m.def) this.attrs = { str: m.def.str ?? 0, dex: m.def.dex ?? 0, int: m.def.int ?? 0 };
        break;
      case "bar":
        this.bar = m.bar ?? [];
        this.on = m.on ?? [];
        break;
      case "snap":
        this.onSnap(m);
        break;
    }
  }

  onSpawns(m: { pts: [number, number][]; taken: { i: number; name: string; me?: 1 }[]; left: number; done?: 1 }) {
    if (m.done || !m.pts.length || this.spawnPicked) return;
    if (!this.spawnAt) this.spawnAt = Date.now() + rnd(1200, 7000);
    if (Date.now() < this.spawnAt || Math.random() < 0.3) return;
    this.spawnPicked = true;
    if (Math.random() < 0.25) return; // keep the auto pick
    const taken = new Set(m.taken.filter((t) => !t.me).map((t) => t.i));
    const tp = m.taken.filter((t) => !t.me).map((t) => m.pts[t.i]);
    let best = -1;
    let bd = -1;
    m.pts.forEach(([x, y], i) => {
      if (taken.has(i)) return;
      const d = Math.min(1e9, ...tp.map(([a, b]) => hyp(a - x, b - y))) * rnd(0.6, 1.4);
      if (d > bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) this.send({ t: "r-spawn", i: best });
  }

  // ---- per-snapshot brain -----------------------------------------------------------------

  onSnap(s: any) {
    this.phase = s.phase;
    this.alive = s.alive;
    this.total = s.total;
    this.monsters = s.monsters;
    this.hazards = s.hazards;
    this.projs = s.projs ?? [];
    this.ground = s.ground;
    if (s.defs) for (const d of s.defs) this.defs.set(d.g, d.it);
    if (s.camps) this.noteCamps(s.camps);
    this.players = s.players;
    this.last = s.last ?? null;
    this.noteHits(s);
    const me = s.players.find((p: PlayerSnap) => p.id === this.id) ?? null;
    this.me = me;
    this.lastCmd = null;
    if (!me || !me.alive || this.id < 0) return;
    if (this.phase === "countdown") {
      this.input(0, 0, me.angle, false, false);
      return;
    }
    if (this.phase !== "fight") return;
    if (!this.fightStart) this.fightStart = Date.now();
    this.mana = me.mp ?? this.mana;
    if (me.hp < this.lastHp - 0.5) this.hurtT = 1.5;
    this.lastHp = me.hp;
    this.think(me, s.tick);
  }

  /** Remember which players hit this bot (hurtT alone cannot tell a monster's hit from a player's). */
  noteHits(s: any) {
    if (!s.events) return;
    for (const e of s.events) if (e.k === "hit" && !e.m && e.target === this.id && e.by > 0 && e.by !== this.id) {
      const h = this.hitBy.get(e.by);
      const now = Date.now();
      this.hitBy.set(e.by, { n: h && now - h.t < 4000 ? h.n + 1 : 1, t: now });
    }
  }

  /** Nearby-camp snapshot: keep it, and remember which camps were seen empty (as the client minimap does). */
  noteCamps(camps: CampSnap[]) {
    this.camps = camps;
    for (const c of camps) if (c.n <= 0) this.emptyCamps.add(c.x + "," + c.y);
  }

  /** That player landed at least `n` hits on this bot, the last within the past few seconds. */
  struckBy(id: number, n: number) {
    const h = this.hitBy.get(id);
    return !!h && h.n >= n && Date.now() - h.t < 4000;
  }

  /** A snapshot the bot does not decide on, parsed only for what must not be missed. */
  absorb(s: any) {
    this.noteHits(s);
    if (s.defs) for (const d of s.defs) this.defs.set(d.g, d.it);
    if (s.camps) this.noteCamps(s.camps);
  }

  /** Between two decisions: keep doing what was decided (a fresh seq per tick; the dodge press is not repeated). */
  repeat() {
    const c = this.lastCmd;
    if (!c) return;
    const cmd: Record<string, unknown> = { seq: ++this.seq, mx: c.mx, my: c.my, angle: c.angle, attack: c.attack, dodge: false };
    if (c.sk !== undefined) cmd.sk = c.sk;
    this.send({ t: "input", cmds: [cmd] });
  }

  get fightSecs() {
    return this.fightStart ? (Date.now() - this.fightStart) / 1000 : 0;
  }

  power(p: { lv?: number; hp: number; maxHp: number }) {
    return (p.lv ?? 1) * 12 + p.hp * 0.8 + p.maxHp * 0.3;
  }

  /** Life flask: when hurt, the first life flask with enough charges. */
  tryFlask(me: PlayerSnap, now: number) {
    if (!this.inv || now - this.flaskAt < 2600) return;
    const frac = me.hp / Math.max(1, me.maxHp);
    if (frac > 0.55) return;
    for (let i = 0; i < this.flaskSlots; i++) {
      const f = this.inv.flasks[i];
      if (!f) continue;
      const fb = FLASK_BASE_BY_ID.get(f.b);
      if (!fb || fb.res === "mana") continue;
      const p = flaskProps(f, 1);
      if ((f.c ?? 0) >= p.perUse) {
        this.send({ t: "flask", i });
        this.flaskAt = now;
        return;
      }
    }
  }
  flaskReady(): boolean {
    if (!this.inv) return false;
    for (let i = 0; i < this.flaskSlots; i++) {
      const f = this.inv.flasks[i];
      if (f && FLASK_BASE_BY_ID.get(f.b)?.res !== "mana" && (f.c ?? 0) >= flaskProps(f, 1).perUse) return true;
    }
    return false;
  }

  tryAlloc(now: number) {
    if (this.pts <= 0 || now - this.allocAt < 700) return;
    this.allocAt = now;
    const have = new Set(this.alloc);
    const cand = PASSIVE_NODES.filter((n) => !have.has(n.id) && n.kind !== "jewel" && n.kind !== "start" && n.links.some((l) => have.has(l)));
    if (!cand.length) return;
    // Notables first, then anything (keeps walking outward).
    const nb = cand.filter((n) => n.kind === "notable");
    const pool = nb.length && Math.random() < 0.6 ? nb : cand;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick && PASSIVE_BY_ID.has(pick.id)) {
      this.send({ t: "alloc", id: pick.id });
      this.pts--;
    }
  }

  /** Ground item worth walking to (an upgrade that we can wear, or a flask for an empty slot). */
  wants(it: Item): boolean {
    if (!this.inv) return false;
    const fb = FLASK_BASE_BY_ID.get(it.b);
    if (fb) {
      if (fb.res === "mana") return false;
      for (let i = 0; i < this.flaskSlots; i++) if (!this.inv.flasks[i]) return true;
      const cur = this.inv.flasks[0];
      return !!cur && it.r > cur.r;
    }
    const b = BASE_BY_ID.get(it.b);
    if (!b || b.cls === undefined) return false;
    if (!meetsRequirements(it.b, this.lv, this.attrs)) return false;
    const eq = this.inv.equip;
    if (b.weapon) {
      const cur = eq.mainhand ? BASE_BY_ID.get(eq.mainhand.b)?.weapon : undefined;
      if (cur && cur.kind !== b.weapon.kind) return false; // keep the class weapon (skills match it)
      return itemScore(it) > itemScore(eq.mainhand) + 3;
    }
    if (b.cls === "offhand") {
      const w = eq.mainhand ? BASE_BY_ID.get(eq.mainhand.b)?.weapon : undefined;
      if (w?.twoHand) return false;
    }
    const slot = defaultSlotFor(it, eq);
    if (!slot) return false;
    const cur = eq[slot];
    return !cur || itemScore(it) > itemScore(cur) + 3;
  }

  barIds(): string[] {
    const out: string[] = [];
    for (const b of this.bar) {
      const d = skillDefOf(b.gem);
      if (d) out.push(d.id);
    }
    return out;
  }
  socketedSupports(): string[] {
    const out: string[] = [];
    for (const b of this.bar) for (const x of b.sups ?? []) {
      const d = supportDefOf(x);
      if (d) out.push(d.id);
    }
    return out;
  }
  /** Where support `sid` could go: [slot, socket] or null. */
  supportSpot(sid: string): [number, number] | null {
    const sd = SUPPORT_GEMS.find((x) => x.id === sid);
    if (!sd || this.socketedSupports().includes(sid)) return null;
    for (let i = 0; i < this.bar.length; i++) {
      const b = this.bar[i];
      const d = skillDefOf(b.gem);
      if (!d || isSpiritDef(d)) continue;
      const n = socketCount(b.gem);
      const others = (b.sups ?? []).map((x) => supportDefOf(x));
      for (let j = 0; j < n; j++) {
        if (b.sups?.[j]) continue;
        if (!supportRefusal(sd, d, others)) return [i, j];
        break;
      }
    }
    return null;
  }

  /** Cut crystals, socket supports, equip spare skill gems. One request at a time. */
  manageGems(now: number) {
    if (!this.inv || now - this.gemAt < 450 || !this.bar.length) return;
    const tryKey = (k: string) => {
      const n = this.gemTries.get(k) ?? 0;
      if (n >= 2) return false;
      this.gemTries.set(k, n + 1);
      return true;
    };
    const onBar = this.barIds();
    const inBag = this.inv.inv.map((e) => e.it);
    for (const it of inBag) {
      if (!isGem(it)) continue;
      const rough: boolean = isRough(it); // (annotated: no type narrowing, GemItem is Item)
      if (rough) {
        if (it.b === ROUGH_SUPPORT) {
          const bagSup = inBag.map((x) => supportDefOf(x)?.id).filter(Boolean);
          const opts = SUPPORT_GEMS.filter((sd) => !bagSup.includes(sd.id) && this.supportSpot(sd.id)).sort(() => Math.random() - 0.5);
          const pick = opts.find((o) => o.more && o.more > 1) ?? opts[0];
          if (pick && tryKey(`cut${it.id}`)) {
            this.gemAt = now;
            return this.send({ t: "cut", id: it.id, gem: pick.id });
          }
          continue;
        }
        const spirit = it.b === ROUGH_SPIRIT;
        const bagSk = inBag.map((x) => skillDefOf(x)?.id).filter(Boolean);
        const opts = cutOptions(it)
          .filter((o) => o.ok && !onBar.includes(o.id) && !bagSk.includes(o.id))
          .map((o) => SKILL_DEF(o.id)!)
          .filter((d) => d && d.kind !== "meta" && (!d.weapons || d.weapons.includes(this.wk)));
        if (opts.length && tryKey(`cut${it.id}`)) {
          // damage skills first, highest tier
          opts.sort((a, b) => (b.dmg > 0 ? 10 : 0) + b.tier - ((a.dmg > 0 ? 10 : 0) + a.tier) + (Math.random() - 0.5));
          this.gemAt = now;
          return this.send({ t: "cut", id: it.id, gem: opts[0].id });
        }
        // nothing new to cut: raise an owned gem
        for (const b of this.bar) {
          if (b.gem && !upgradeRefusal(it, b.gem) && tryKey(`up${it.id}`)) {
            this.gemAt = now;
            return this.send({ t: "cut", id: it.id, target: b.gem.id });
          }
        }
        continue;
      }
      const support: boolean = isSupportGem(it);
      if (support) {
        const sd = supportDefOf(it)!;
        const spot = this.supportSpot(sd.id);
        if (spot && tryKey(`sock${it.id}`)) {
          this.gemAt = now;
          return this.send({ t: "socket", id: it.id, slot: spot[0], sup: spot[1] });
        }
        continue;
      }
      if (isSkillGem(it)) {
        const d = skillDefOf(it)!;
        if (onBar.includes(d.id) || d.kind === "meta") continue;
        const slot = [3, 4, 5, 6, 7].find((i) => !this.bar[i]?.gem);
        if (slot !== undefined && tryKey(`eq${it.id}`)) {
          this.gemAt = now;
          return this.send({ t: "socket", id: it.id, slot });
        }
      }
    }
  }
  /** A bar slot (MMB weapon skill, RMB, Q E R T G) whose skill makes sense right now, or -1. */
  pickSkill(me: PlayerSnap, d: number, tr: number, strong: boolean, now: number): number {
    const ok: number[] = [];
    for (const slot of [1, 2, 3, 4, 5, 6, 7]) {
      if (this.slotReady[slot] > now) continue;
      const b = this.bar[slot];
      const def = skillDefOf(b?.gem) ?? (slot === 1 ? innateFor(this.wk) : undefined);
      if (!def || isSpiritDef(def)) continue;
      if (def.weapons && !def.weapons.includes(this.wk)) continue;
      let cost = levelCost(def, b?.gem ? gemLevel(b.gem) : 1);
      for (const x of b?.sups ?? []) {
        const sd = supportDefOf(x);
        if (sd) cost *= supportAt(sd, supportTier(x!)).costMult;
      }
      if (this.mana < cost + 1) continue;
      let good = false;
      switch (def.kind) {
        case "strike":
          good = d <= me.atkRange + (def.reach ?? 0) + tr - 4;
          break;
        case "slam": {
          const ahead = me.atkRange * 0.5 + (def.reach ?? 0);
          good = Math.abs(d - ahead) <= (def.radius ?? 50) + tr * 0.5 - 8;
          break;
        }
        case "volley":
        case "bolt":
          good = d <= (def.range ?? 500) * 0.8;
          break;
        case "cone":
        case "chain":
          good = d <= (def.reach ?? 150) + tr - 12;
          break;
        case "dash":
          good = !this.ranged && d > 170 && d < 420;
          break;
        case "buff":
          good = strong && d < 400;
          break;
        case "totem":
          good = d < 340;
          break;
        case "spin":
          good = d <= me.atkRange + (def.reach ?? 0) + tr - 6;
          break;
        case "leap":
          good = !this.ranged && d > 100 && d < (def.speed ?? 200) + (def.radius ?? 50) * 0.6;
          break;
        case "blast":
          // the mark lands a fixed distance ahead: only when the target stands about there
          good = Math.abs(d - (def.zone?.place ?? 180)) <= (def.radius ?? 60) + tr * 0.5 - 16;
          break;
        case "trap":
          good = Math.abs(d - (def.zone?.place ?? 130)) <= 55 + tr * 0.5;
          break;
        case "guard":
          good = strong && d < 150;
          break;
      }
      if (good) ok.push(slot);
    }
    return ok.length ? ok[Math.floor(Math.random() * ok.length)] : -1;
  }

  /** The boss lair (tier-2 camp) of this map. */
  bossSpot(): { x: number; y: number } {
    return (this.bossAt ??= getCampSpots().find((c) => c.tier === 2) ?? currentMap().center);
  }
  /** Lair seen emptied: nothing to keep away from any more. */
  bossGone(): boolean {
    const b = this.bossSpot();
    return this.emptyCamps.has(b.x + "," + b.y);
  }
  bossReady(): boolean {
    return this.lv >= (this.bossHunter ? BOSS_MIN_LV : BOSS_MIN_LV + 1);
  }
  /** How far from the lair this bot keeps its roaming and its fights. */
  bossKeepOut(): number {
    return this.bossReady() || this.bossGone() ? 450 : BOSS_KEEP_OUT;
  }

  /** A monster projectile about to pass through the bot: the sideways direction that leaves its line, or null. */
  projDodge(me: PlayerSnap, now: number): number | null {
    let out: number | null = null;
    let soonest = PROJ_DODGE_SECS;
    const seen = new Map<number, { x: number; y: number; t: number }>();
    for (const p of this.projs) {
      const prev = this.projSeen.get(p.id);
      seen.set(p.id, prev && now - prev.t < 60 ? prev : { x: p.x, y: p.y, t: now });
      if (!prev || now - prev.t < 60) continue;
      const dt = (now - prev.t) / 1000;
      const vx = (p.x - prev.x) / dt;
      const vy = (p.y - prev.y) / dt;
      const v2 = vx * vx + vy * vy;
      if (v2 < 60 * 60) continue;
      const rx = me.x - p.x;
      const ry = me.y - p.y;
      const tc = (rx * vx + ry * vy) / v2; // time to its closest point to the bot
      if (tc <= 0 || tc > soonest) continue;
      const cross = (vx * ry - vy * rx) / Math.sqrt(v2); // signed distance of the bot from its line
      if (Math.abs(cross) > p.r + PROJ_DODGE_PAD) continue;
      if ((p.id * 7 + this.idx * 13) % 100 >= 45 + this.skill * 50) continue; // not every shot is read in time
      soonest = tc;
      out = Math.atan2(vy, vx) + (cross >= 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    this.projSeen = seen;
    return out;
  }

  think(me: PlayerSnap, _tick: number) {
    const now = Date.now();
    const dt = THINK_DT;
    this.dodgeCd -= dt;
    this.skillCd -= dt;
    this.hurtT -= dt;
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafe = Math.random() < 0.5 ? 1 : -1;
      this.strafeT = rnd(0.8, 2.2);
    }
    this.tryFlask(me, now);
    this.tryAlloc(now);
    this.manageGems(now);
    const hpFrac = me.hp / Math.max(1, me.maxHp);
    const late = this.alive <= 6 || this.fightSecs > BOT_LATE_SECS;

    // ---- danger: telegraphed hazards under us -> step out (dodge when it is about to go off)
    let dodge = false;
    let escape: number | null = null;
    let pooled = false; // the only thing underfoot is a lingering pool
    for (const h of this.hazards) {
      if (h.f >= 0.97) continue;
      if (h.sh === "line" && h.a !== undefined) {
        // A charge lane starts at (x, y) and runs len along a: leave it sideways, not along it.
        const dx = me.x - h.x;
        const dy = me.y - h.y;
        const along = dx * Math.cos(h.a) + dy * Math.sin(h.a);
        const across = -dx * Math.sin(h.a) + dy * Math.cos(h.a);
        if (along < -30 || along > (h.len ?? h.r) + 40 || Math.abs(across) > (h.w ?? 40) / 2 + 34) continue;
        escape = h.a + (across >= 0 ? Math.PI / 2 : -Math.PI / 2);
        pooled = false;
        if (h.f > 0.55 && this.dodgeCd <= 0 && chance(0.25 + this.skill * 0.6)) dodge = true;
        continue;
      }
      const reach = h.r + 26;
      const d = hyp(me.x - h.x, me.y - h.y);
      if (d < reach) {
        pooled = escape === null && h.sh === "pool";
        escape = angTo(h.x, h.y, me.x, me.y);
        if (h.f > 0.55 && this.dodgeCd <= 0 && chance(0.25 + this.skill * 0.6)) dodge = true;
      }
    }
    // ---- danger: a monster's shot coming at us -> step off its line
    const shot = this.projDodge(me, now);
    if (shot !== null && (escape === null || pooled)) {
      escape = shot;
      pooled = false;
    }
    this.urgent = escape !== null && !pooled;

    // ---- pick a target (re-evaluated 4x a second; sticky)
    if (now - this.targetAt > 250) {
      this.targetAt = now;
      this.target = this.pickTarget(me, hpFrac, late);
    }
    let tm = this.target?.m !== undefined ? this.monsters.find((m) => m.id === this.target!.m) : undefined;
    let tp = this.target?.p !== undefined ? this.players.find((p) => p.id === this.target!.p && p.alive) : undefined;
    if (!tm && !tp) this.target = null;
    if (tm) {
      const dropped = tm.id === this.mobId && tm.hp < this.mobHp - 0.5;
      const sameMob = tm.id === this.mobId;
      this.mobHp = tm.hp; // compare against the previous snapshot (regenerating monsters go up and down)
      if (!sameMob || dropped) {
        this.mobId = tm.id;
        this.mobSince = now;
      } else if (now - this.mobSince > 8000) {
        this.ignoreM.set(tm.id, now + 45000);
        this.target = null;
        tm = undefined;
        this.goal = null;
      }
    }

    // ---- flee: losing a player fight with no flask
    const threatP = this.players.filter((p) => p.id !== me.id && p.alive && hyp(p.x - me.x, p.y - me.y) < 420);
    const strongest = threatP.sort((a, b) => this.power(b) - this.power(a))[0];
    if (strongest && hpFrac < 0.3 && !this.flaskReady() && this.power(strongest) > this.power(me) * 0.8 && !late) {
      const away = angTo(strongest.x, strongest.y, me.x, me.y);
      if (this.dodgeCd <= 0 && chance(0.06)) dodge = true;
      return this.moveDir(me, escape ?? away, me.angle, false, dodge, true);
    }

    // ---- the boss is awake and this bot is not ready for it: back out of its arena. In a player fight the bot
    // keeps swinging and shooting but gives ground away from the lair; otherwise it just leaves.
    const boss = this.bossReady() || this.last ? undefined : this.monsters.find((m) => m.rr === 3 && !m.lk && m.hp > 0 && (m.s === 1 || m.s === 2) && hyp(m.x - me.x, m.y - me.y) < BOSS_FLEE_DIST);
    if (boss) {
      const away = angTo(boss.x, boss.y, me.x, me.y);
      // A player target that is not within fighting distance is let go (chasing somebody past the boss killed
      // more bots than the chase ever won); the last survivors (endgame reveal) fight wherever they meet.
      const far = !!tp && !this.last && hyp(tp.x - me.x, tp.y - me.y) > (this.ranged ? 420 : 200);
      if (tp && far) {
        this.ignoreP.set(tp.id, now + 6000);
        tp = undefined;
      }
      if (!tp) {
        this.target = null;
        this.targetAt = now;
        this.goal = null;
        if (this.dodgeCd <= 0 && chance(0.08)) dodge = true;
        return this.moveDir(me, escape ?? away, away, false, dodge, true);
      }
      if (escape === null) escape = away;
    }

    // ---- flee: a rogue exile on us while we are hurt, or monsters on us with little life and no flask use left
    // (a player backs off; bots used to trade blows with a pack until they were dead). Not while a player is
    // the target: that fight has its own flee rule above.
    const weak = hpFrac < WEAK_HP && !this.flaskReady();
    let nearest: MonsterSnap | undefined;
    let nd = 1e9;
    let on = 0;
    let scary = false;
    for (const m of this.monsters) {
      if (m.hp <= 0 || !(m.s === 1 || m.s === 2)) continue;
      const d = hyp(m.x - me.x, m.y - me.y);
      if (d > 380) continue;
      const grim = !!m.lk || (m.rr ?? 0) >= 2;
      if (!grim && d > 300) continue;
      on++;
      if (grim) scary = true;
      const early = !!m.lk && hpFrac < EXILE_FLEE_HP;
      if (early || d < nd) {
        nd = early ? -1 : d;
        nearest = m;
      }
    }
    const lone = on === 1 && !scary && !!nearest && nearest.hp < nearest.mhp * 0.5; // one hurt normal monster: finish it (flask charges)
    if (nearest && !tp && !this.last && ((nearest.lk && hpFrac < EXILE_FLEE_HP) || (weak && !lone))) {
      const away = angTo(nearest.x, nearest.y, me.x, me.y);
      if (this.dodgeCd <= 0 && chance(0.08)) dodge = true;
      this.target = null;
      this.goal = null;
      return this.moveDir(me, escape ?? away, away, false, dodge, true);
    }

    // ---- fight
    if (tm || tp) {
      const t = (tm ?? tp)!;
      const tr = tm ? tm.r : 20;
      const d = hyp(t.x - me.x, t.y - me.y);
      let aim = angTo(me.x, me.y, t.x, t.y);
      // Ranged versus a moving player: lead the shot (rig aiming only).
      const tpv = this.tpv;
      if (tp) {
        const nowMs = Date.now();
        if (tpv && tpv.id === tp.id && nowMs - tpv.at > 60) {
          const dt = (nowMs - tpv.at) / 1000;
          tpv.vx = tpv.vx * 0.5 + ((tp.x - tpv.x) / dt) * 0.5;
          tpv.vy = tpv.vy * 0.5 + ((tp.y - tpv.y) / dt) * 0.5;
          tpv.x = tp.x; tpv.y = tp.y; tpv.at = nowMs;
        } else if (!tpv || tpv.id !== tp.id) this.tpv = { id: tp.id, x: tp.x, y: tp.y, at: nowMs, vx: 0, vy: 0 };
        const v = this.tpv!;
        if (this.ranged && d > 90) {
          const lt = Math.min(0.8, d / 620);
          aim = angTo(me.x, me.y, tp.x + v.vx * lt, tp.y + v.vy * lt);
        }
      }
      const reach = me.atkRange + tr - 2;
      // Incoming melee: monster winding up next to us / player mid-swing in reach -> roll sideways.
      if (tm && tm.s === 2 && d < tm.r + 120 && tm.w > 0.35 && this.dodgeCd <= 0 && chance(0.05 + this.skill * 0.12)) dodge = true;
      if (tp && tp.atkT > 0 && d < (tp.atkRange ?? 60) + 40 && this.dodgeCd <= 0 && chance(0.03 + this.skill * 0.08)) dodge = true;
      // Skill: hold the RMB slot briefly every few seconds when in its range and mana allows.
      let sk: number | undefined;
      if (this.skillHold > 0) {
        this.skillHold--;
        sk = this.skSlot;
      } else if (this.skillCd <= 0) {
        const slot = this.pickSkill(me, d, tr, !!tp || (tm?.rr ?? 0) >= 2, now);
        if (slot >= 0) {
          const def = skillDefOf(this.bar[slot]?.gem) ?? innateFor(this.wk);
          this.skSlot = slot;
          this.skillHold = Math.ceil((def?.ramp ? 54 : 8) / THINK_EVERY); // ramping skills are held so they speed up
          this.skillCd = rnd(0.9, 2.6);
          this.slotReady[slot] = now + ((def?.cd ?? 0) + 0.4) * 1000;
          sk = slot;
        } else this.skillCd = 0.3;
      }
      let wantRange = this.ranged ? (tp ? 190 : Math.min(380, 260 + tr)) : reach - 8;
      if (this.ranged && tm && (tm.bb ?? 0) < 0) wantRange = Math.min(wantRange, -tm.bb! - 70); // Close-Quarters: only hurt from nearby
      let mvA: number | null = null;
      let mv = 1;
      if (escape !== null) mvA = escape;
      else if (this.ranged) {
        if (d > wantRange + 40) mvA = aim;
        else if (d < wantRange - 120 && !(tm && (tm.bb ?? 0) < 0)) mvA = aim + Math.PI;
        else {
          mvA = aim + (Math.PI / 2) * this.strafe;
          mv = 0.6;
        }
      } else if (d > reach - 4) mvA = aim;
      else if (Math.random() < 0.3 * this.skill) {
        mvA = aim + (Math.PI / 2) * this.strafe;
        mv = 0.35;
      }
      const inRange = this.ranged ? d < 560 : d <= reach + 6;
      if (dodge) {
        this.dodgeCd = rnd(1.4, 3);
        mvA = (escape ?? aim) + (Math.PI / 2) * this.strafe;
        mv = 1;
      }
      // No damage on a player for 5 s (something is in the way): stop pushing straight at it.
      let walled = false;
      if (tp) {
        if (tp.id !== this.foeId || tp.hp < this.foeHp - 0.5) {
          this.foeId = tp.id;
          this.foeSince = now;
        }
        this.foeHp = tp.hp;
        walled = now - this.foeSince > 5000 && d > (this.ranged ? 120 : reach + 6);
        // A chase that lands nothing: let that player go and get back to the camps (bots used to trail each
        // other at ~300 px for most of minutes 3 - 4, neither fighting nor farming). Not once the match is late.
        if (!late && !this.last && now - this.foeSince > CHASE_GIVE_UP_MS) {
          this.ignoreP.set(tp.id, now + CHASE_IGNORE_MS);
          this.target = null;
          this.goal = null;
          this.targetAt = 0;
          return this.input(0, 0, me.angle, false, false);
        }
      }
      // Too far to fight, or walled off: take the path there (shooting on the way when in range). Ranged bots
      // used to walk straight at the target from any distance: two of them, or one and an idle player, could
      // face each other across a wall for the rest of the match.
      if (d > (this.ranged ? 560 : 260) || (walled && escape === null && !dodge)) return this.travel(me, t.x, t.y, aim, inRange && sk === undefined, dodge, `t${t.id}`);
      return this.moveDir(me, mvA, aim, inRange && sk === undefined, dodge, mvA !== null, mv, sk);
    }

    // ---- not fighting: still step out of a telegraph or off a shot's line (pools are simply walked through)
    if (escape !== null && !pooled) return this.moveDir(me, escape, me.angle, false, dodge, true);

    // ---- spirit gems: switch an aura on (one fresh press) when Spirit allows
    if (this.spirit >= 30 && now > this.auraAt) {
      this.auraAt = now + 12000;
      const slot = this.bar.findIndex((b, i) => {
        const d = skillDefOf(b.gem);
        return !!d && d.kind === "aura" && !this.on.includes(i);
      });
      if (slot >= 0) return this.input(0, 0, me.angle, false, false, slot);
    }

    // ---- endgame reveal: head for the nearest survivor the server shows us
    if (this.last) {
      let bd = 1e9;
      let bx = 0;
      let by = 0;
      for (const [id, x, y] of this.last) {
        if (id === me.id) continue;
        const d = hyp(x - me.x, y - me.y);
        if (d < bd) {
          bd = d;
          bx = x;
          by = y;
        }
      }
      if (bd < 1e9) {
        this.goal = { kind: "hunt", x: bx, y: by, until: now + 2000 };
        return this.travel(me, bx, by, angTo(me.x, me.y, bx, by), false, dodge, "last");
      }
    }

    // ---- loot
    if (!this.goal || this.goal.kind !== "loot" || now > this.goal.until || !this.ground.some((g) => g[0] === this.goal!.g)) {
      if (this.goal?.kind === "loot") this.goal = null;
      let best: Goal | null = null;
      let bd = 520 * this.greed + 200;
      const lootKeep = this.last ? 0 : this.bossKeepOut();
      const lootLair = this.bossSpot();
      for (const [g, x, y] of this.ground) {
        if (this.tried.has(g)) continue;
        const it = this.defs.get(g);
        if (!it || !(this.wants(it) || isGem(it))) continue;
        if (lootKeep > 450 && hyp(x - lootLair.x, y - lootLair.y) < BOSS_KEEP_OUT - 200) continue; // not out of the boss arena
        const d = hyp(x - me.x, y - me.y);
        if (d < bd) {
          bd = d;
          best = { kind: "loot", x, y, g, until: now + 9000 };
        }
      }
      if (best) this.goal = best;
    }
    if (this.goal?.kind === "loot") {
      const d = hyp(this.goal.x - me.x, this.goal.y - me.y);
      if (d < 72) {
        const it = this.defs.get(this.goal.g!);
        this.send({ t: "pickup", g: this.goal.g, equip: !(it && isGem(it)) });
        this.tried.add(this.goal.g!);
        this.goal = null;
        return this.input(0, 0, me.angle, false, false);
      }
      return this.travel(me, this.goal.x, this.goal.y, angTo(me.x, me.y, this.goal.x, this.goal.y), false, dodge, `g${this.goal.g}`);
    }

    // ---- roam: camps for XP early, then the centre (and the players gathering there)
    if (this.goal?.kind === "camp" && this.fightSecs < OPENING_TRUCE && this.crowded(me, this.goal.x, this.goal.y, Math.max(500, hyp(this.goal.x - me.x, this.goal.y - me.y)))) this.goal = null; // opening truce: somebody is at that camp or nearer to it, leave it to them
    if (!this.goal || now > this.goal.until || hyp(this.goal.x - me.x, this.goal.y - me.y) < 90) this.goal = this.pickRoam(me, late);
    const g = this.goal;
    return this.travel(me, g.x, g.y, angTo(me.x, me.y, g.x, g.y), false, dodge, `${g.kind}${Math.round(g.x)},${Math.round(g.y)}`);
  }

  /** Another living player stands within `r` of the point. */
  crowded(me: PlayerSnap, x: number, y: number, r: number) {
    return this.players.some((p) => p.id !== me.id && p.alive && hyp(p.x - x, p.y - y) < r);
  }

  pickTarget(me: PlayerSnap, hpFrac: number, late: boolean): { m?: number; p?: number } | null {
    const myPow = this.power(me);
    const truce = this.fightSecs < OPENING_TRUCE;
    const ready = this.bossReady();
    const gone = this.bossGone();
    const lair = this.bossSpot();
    /** Standing within the boss's reach while this bot is not ready for it (the last survivors fight anywhere). */
    const inReach = (o: { x: number; y: number }) => !ready && !gone && !this.last && hyp(o.x - lair.x, o.y - lair.y) < BOSS_KEEP_OUT - 250;
    const cm = this.target?.m !== undefined ? this.monsters.find((m) => m.id === this.target!.m && m.hp > 0) : undefined;
    if (cm && !this.last && hyp(cm.x - me.x, cm.y - me.y) < 600 && (cm.rr === 3 && !cm.lk ? ready : (cm.rr ?? 0) >= 2 && cm.hp < cm.mhp * COMMIT_HP)) {
      const finish = cm.rr === 3 && !cm.lk && cm.hp < cm.mhp * COMMIT_HP; // a boss under half life: finish it even with a player on us
      if (finish || !this.players.some((p) => p.id !== me.id && p.alive && this.struckBy(p.id, 2))) return this.target;
    }
    // Players
    let bestP: PlayerSnap | null = null;
    let bpScore = -1e9;
    for (const p of this.players) {
      if (p.id === me.id || !p.alive) continue;
      if ((!late || inReach(p)) && (this.ignoreP.get(p.id) ?? 0) > Date.now()) continue;
      const d = hyp(p.x - me.x, p.y - me.y);
      const range = late ? 1100 : 380 + this.aggro * 420;
      if (d > range) continue;
      if ((inReach(p) || inReach(me)) && !(d < 200 && this.struckBy(p.id, 2))) continue; // not into the boss arena after somebody
      if (truce && !(d < 260 && this.struckBy(p.id, 3))) continue; // opening truce: nobody is hunted off the spawn; a bot fights back only against a player who keeps hitting it (one or two stray hits beside a monster are let go)
      const ratio = myPow / Math.max(1, this.power(p));
      const weak = p.hp / Math.max(1, p.maxHp) < 0.35;
      const engage = late || weak || ratio > 1.25 - this.aggro * 0.4 || (d < 160 && this.hurtT > 0) || (this.fightSecs > 200 && ratio > 0.8);
      if (!engage || (hpFrac < 0.35 && !late && !weak)) continue;
      const sc = -d + ratio * 120 + (weak ? 200 : 0);
      if (sc > bpScore) {
        bpScore = sc;
        bestP = p;
      }
    }
    // Current player target is sticky.
    if (this.target?.p !== undefined) {
      const cur = this.players.find((p) => p.id === this.target!.p && p.alive);
      if (cur && !((inReach(cur) || inReach(me)) && hyp(cur.x - me.x, cur.y - me.y) > 200) && hyp(cur.x - me.x, cur.y - me.y) < (late ? 1150 : 800) && (late || !((this.ignoreP.get(cur.id) ?? 0) > Date.now()))) return this.target;
    }
    if (bestP) {
      return { p: bestP.id };
    }
    // Monsters: chasing us first, then the nearest beatable one near our path.
    const weak = hpFrac < WEAK_HP && !this.flaskReady();
    let bestM: MonsterSnap | null = null;
    let bm = 1e9;
    for (const m of this.monsters) {
      if (m.hp <= 0 || m.iv) continue;
      if ((this.ignoreM.get(m.id) ?? 0) > Date.now()) continue;
      const d = hyp(m.x - me.x, m.y - me.y);
      const rr = m.rr ?? 0;
      const exile = !!m.lk; // rogue exile: a geared, player-like hunter
      const chasing = m.s === 1 || m.s === 2;
      if (rr === 3 && !exile && !ready) continue; // the boss: never before the bot is ready (think() backs out of its arena)
      if (!ready && !gone && hyp(m.x - lair.x, m.y - lair.y) < BOSS_KEEP_OUT - 150 && !(chasing && d < 200)) continue; // nor anything within its reach
      const dangerous = (rr === 2 && (this.lv < 4 || hpFrac < 0.5)) || (exile && hpFrac < 0.6);
      if (dangerous && !(chasing && d < 200)) continue;
      if (weak && !chasing && (rr > 0 || this.monsters.filter((o) => o.hp > 0 && hyp(o.x - m.x, o.y - m.y) < 220).length > 2)) continue; // little life, no flask: singles only
      if (this.last && !(chasing && d < 200)) continue; // endgame reveal: the survivors come first, only a monster already on the bot is fought (bots used to clear pack after pack on the way while the last player waited)
      if (truce && !(chasing && d < 200) && this.crowded(me, m.x, m.y, 300)) continue; // opening truce: no fighting over a monster (stray hits start duels)
      const lim = chasing ? 520 : late ? 260 : 340 + this.aggro * 160;
      if (d > lim) continue;
      const sc = d - (chasing ? 200 : 0) + (m.hp / Math.max(1, m.mhp)) * 40;
      if (sc < bm) {
        bm = sc;
        bestM = m;
      }
    }
    if (this.target?.m !== undefined) {
      const cur = this.monsters.find((m) => m.id === this.target!.m);
      const shared = !!cur && truce && !((cur.s === 1 || cur.s === 2) && hyp(cur.x - me.x, cur.y - me.y) < 200) && this.crowded(me, cur.x, cur.y, 300);
      if (cur && !shared && hyp(cur.x - me.x, cur.y - me.y) < (this.last ? 200 : 600) && (!bestM || hyp(cur.x - me.x, cur.y - me.y) < bm + 120)) return this.target;
    }
    return bestM ? { m: bestM.id } : null;
  }

  pickRoam(me: PlayerSnap, late: boolean): Goal {
    const now = Date.now();
    const m = currentMap();
    const keep = this.bossKeepOut();
    const lair = this.bossSpot();
    // Where the bots gather late: the map centre, or (while the boss may live) a point beside it, far enough
    // from the lair that the gathering and its fights stay out of the boss's reach. Bots used to circle 450 px
    // from the centre, with the lair 300 - 420 px off it: the boss shot into most late fights.
    let cx = m.center.x;
    let cy = m.center.y;
    if (keep > 450) {
      const dl = hyp(cx - lair.x, cy - lair.y);
      const b = dl > 1 ? angTo(lair.x, lair.y, cx, cy) : 0;
      cx = Math.max(300, Math.min(m.w - 300, lair.x + Math.cos(b) * (keep + 450)));
      cy = Math.max(300, Math.min(m.h - 300, lair.y + Math.sin(b) * (keep + 450)));
    }
    const t = this.fightSecs;
    // Centre pull grows over the match: 0 for the first ~1.5 min, full at BOT_LATE_SECS (or once few remain).
    const pull = late ? 1 : Math.max(0, Math.min(1, (t - 90) / (BOT_LATE_SECS - 90)));
    const myC = hyp(me.x - cx, me.y - cy);
    // Endgame: once the field is down to a few (or it drags on), the survivors go find each other
    // (director knowledge: stands in for a final-circle reveal so a match always ends).
    const myL = hyp(me.x - lair.x, me.y - lair.y);
    const hunt = this.bossHunter && this.lv >= BOSS_MIN_LV && !this.bossGone() && !this.last;
    if (hunt && now > this.bossNext && myL > 250 && me.hp >= me.maxHp * BOSS_GO_HP && this.flaskReady()) return { kind: "center", x: lair.x, y: lair.y, until: now + 20000 };
    if (hunt && myL <= 250) this.bossNext = now + BOSS_RETRY_MS; // been there (fought it, or it was asleep elsewhere): another try later
    if (pull >= 1 || (pull > 0.5 && Math.random() < pull - 0.3)) {
      // Converge: a point on a shrinking ring around the centre (boss heart stays at arm's length).
      const ring = Math.max(450, Math.min(myC - 600, 2600 * (1 - pull) + 500));
      const a = angTo(cx, cy, me.x, me.y) + rnd(-0.6, 0.6);
      return { kind: "center", x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring, until: now + 15000 };
    }
    this.visitedCamps = this.visitedCamps.filter((v) => now - v.t < 90000);
    let best: CampSnap | null = null;
    let bs = 1e9;
    for (const c of this.camps) {
      if (c.n <= 0) continue;
      if (this.visitedCamps.some((v) => hyp(v.x - c.x, v.y - c.y) < 150)) continue;
      const d = hyp(c.x - me.x, c.y - me.y);
      if (d < 120) continue;
      if (c.e && this.lv < 3) continue;
      if (hyp(c.x - lair.x, c.y - lair.y) < (keep > 450 ? keep : 200)) continue; // not the boss lair (boss hunters go there on purpose, above), nor a camp within its reach before the bot is ready
      if (t < OPENING_TRUCE && this.crowded(me, c.x, c.y, Math.max(500, d))) continue; // opening truce: somebody else is at that camp or will be there first
      const sc = d + hyp(c.x - cx, c.y - cy) * pull * 0.8 + (c.e ? -150 * this.greed : 0);
      if (sc < bs) {
        bs = sc;
        best = c;
      }
    }
    if (best) {
      this.visitedCamps.push({ x: best.x, y: best.y, t: now });
      return { kind: "camp", x: best.x, y: best.y, until: now + 25000 };
    }
    // Nothing alive in the neighbourhood: the nearest camp of the map this bot has not seen emptied (what the
    // player's camp pointer shows; where camps stand is map knowledge, whether one is alive is not).
    let far: { x: number; y: number } | null = null;
    for (const c of getCampSpots()) {
      if (c.tier === 2 || (c.tier === 1 && this.lv < 3)) continue;
      if (keep > 450 && hyp(c.x - lair.x, c.y - lair.y) < keep) continue;
      if (this.emptyCamps.has(c.x + "," + c.y)) continue;
      if (this.visitedCamps.some((v) => hyp(v.x - c.x, v.y - c.y) < 150)) continue;
      const d = hyp(c.x - me.x, c.y - me.y);
      if (d < 120) continue;
      const sc = d + hyp(c.x - cx, c.y - cy) * pull * 0.8;
      if (sc < bs) {
        bs = sc;
        far = c;
      }
    }
    if (far) {
      this.visitedCamps.push({ x: far.x, y: far.y, t: now });
      return { kind: "camp", x: far.x, y: far.y, until: now + 25000 };
    }
    // Explore: a step toward the centre with some sideways wander.
    const a = angTo(me.x, me.y, cx, cy) + rnd(-1.2, 1.2) * (1 - pull * 0.5);
    const d = rnd(700, 1400);
    let ex = Math.max(200, Math.min(m.w - 200, me.x + Math.cos(a) * d));
    let ey = Math.max(200, Math.min(m.h - 200, me.y + Math.sin(a) * d));
    const dl = hyp(ex - lair.x, ey - lair.y);
    if (dl < keep) {
      // not into the boss arena: the same bearing from the lair, pushed out to the keep-out ring
      const b = dl > 1 ? angTo(lair.x, lair.y, ex, ey) : angTo(lair.x, lair.y, me.x, me.y);
      ex = lair.x + Math.cos(b) * keep;
      ey = lair.y + Math.sin(b) * keep;
    }
    return { kind: "explore", x: ex, y: ey, until: now + 14000 };
  }

  /** Walk to (x, y) along an A* path. */
  travel(me: PlayerSnap, x: number, y: number, aim: number, attack: boolean, dodge: boolean, key: string) {
    const now = Date.now();
    const keyChanged = key !== this.pathFor;
    const target = this.path.length ? this.path[this.path.length - 1] : null;
    const moved = target ? hyp(target.x - x, target.y - y) > 140 : true;
    // New path wanted: taken when this tick's shared pathfinding budget allows, else next time (keeps walking meanwhile).
    // (A moving target: the path is renewed as it moves, not only every 6 s: a bot used to run to where its target had been.)
    if (((moved && (keyChanged || now - this.pathAt > 700)) || (!this.path.length && now - this.pathAt > 600) || now - this.pathAt > 6000) && takePathSlot()) {
      this.pathAt = now;
      this.pathFor = key;
      const p = findPath(me.x, me.y, x, y);
      this.path = p ?? [];
      if (!p && this.goal && !this.goal.kind.startsWith("loot")) this.goal.until = 0; // unreachable: pick another
    } else if (keyChanged) this.pathFor = key;
    while (this.path.length > 1 && hyp(this.path[0].x - me.x, this.path[0].y - me.y) < 70) this.path.shift();
    const wp = this.path[0] ?? { x, y };
    const a = angTo(me.x, me.y, wp.x, wp.y);
    const face = attack ? aim : a;
    return this.moveDir(me, a, face, attack, dodge, true);
  }

  /** Final step: obstacle probing, stuck detection, smoothing, send. */
  moveDir(me: PlayerSnap, a: number | null, face: number, attack: boolean, dodge: boolean, moving: boolean, mag = 1, sk?: number) {
    let mx = 0;
    let my = 0;
    if (moving && a !== null) {
      // Stuck: barely moved for a while although we want to -> pick a sideways direction for a moment.
      const step = hyp(me.x - this.lastX, me.y - this.lastY);
      if (step < 1.2 * THINK_EVERY && me.atkT <= 0) this.stuckT += THINK_DT;
      else this.stuckT = Math.max(0, this.stuckT - 2 * THINK_DT);
      if (this.stuckT > 0.6 && this.unstickT <= 0) {
        this.unstickT = rnd(0.4, 0.9);
        this.unstickA = a + (Math.random() < 0.5 ? 1 : -1) * rnd(1.2, 2.2);
        this.stuckT = 0;
        this.path = [];
        if (this.dodgeCd <= 0 && Math.random() < 0.3) dodge = true;
      }
      // Not ready for the boss: no step deeper into its arena, whatever the reason for walking (a route to a camp
      // on the far side, a chase, a retreat from something else, a sidestep off a shot's line). The bot goes round
      // the rim instead, and leaves when it is well inside. Bots used to cut through, back out when the boss woke,
      // and come again until its volleys had worn them down. The last survivors keep to it as well (their final
      // fights used to drift into the boss's reach, and it killed one finalist in ten), unless the one they are
      // after stands well inside the arena: nobody gets to hide there.
      if (this.bossKeepOut() > 450) {
        const lair = this.bossSpot();
        const dl = hyp(me.x - lair.x, me.y - lair.y);
        const rim = BOSS_KEEP_OUT - 200;
        let prey: { x: number; y: number } | undefined;
        if (this.last) prey = (this.target?.p !== undefined ? this.players.find((p) => p.id === this.target!.p && p.alive) : undefined) ?? (this.goal?.kind === "hunt" ? this.goal : undefined);
        if (dl < rim && !(prey && hyp(prey.x - lair.x, prey.y - lair.y) < rim)) {
          const out = angTo(lair.x, lair.y, me.x, me.y);
          const rel = Math.atan2(Math.sin(a - out), Math.cos(a - out));
          if (Math.abs(rel) > Math.PI / 2) {
            if (this.urgent) a += Math.PI; // off the line the other way
            else {
              const now = Date.now();
              if (now > this.rimAt) this.rimSide = rel >= 0 ? 1 : -1;
              this.rimAt = now + 1500;
              a = out + this.rimSide * (dl < rim - 150 ? Math.PI / 3 : Math.PI / 2);
            }
          }
        }
      }
      let want = a;
      if (this.unstickT > 0) {
        this.unstickT -= THINK_DT;
        want = this.unstickA;
      }
      want = steer(me.x, me.y, want);
      // Smooth turning (no single-tick jitter).
      let diff = Math.atan2(Math.sin(want - this.moveA), Math.cos(want - this.moveA));
      const maxTurn = Math.min(1.35, 0.45 * THINK_EVERY);
      diff = Math.max(-maxTurn, Math.min(maxTurn, diff));
      this.moveA += diff;
      mx = Math.cos(this.moveA) * mag;
      my = Math.sin(this.moveA) * mag;
    } else this.stuckT = 0;
    this.lastX = me.x;
    this.lastY = me.y;
    if (dodge) this.dodgeCd = Math.max(this.dodgeCd, rnd(1.2, 2.6));
    this.input(mx, my, face, attack, dodge, sk);
  }

  input(mx: number, my: number, angle: number, attack: boolean, dodge: boolean, sk?: number) {
    const cmd: Record<string, unknown> = { seq: ++this.seq, mx, my, angle, attack, dodge };
    if (sk !== undefined) cmd.sk = sk;
    this.lastCmd = { mx, my, angle, attack, sk };
    this.send({ t: "input", cmds: [cmd] });
  }
}

/**
 * One bot player: the client end of an in-memory HostConn. The host runtime hands it the same
 * messages a remote client would get (`receive`) and calls `tick()` once per host tick, after the
 * broadcast; everything the bot does goes back through `toHost` as ordinary client messages.
 */
export class BotClient {
  readonly cls: string;
  /** False once the host closed this bot's connection (kicked / hall full / shutdown). */
  open = true;
  private brain: Brain;
  private inbox: string[] = [];
  private extra: string[] = [];
  private snap: string | null = null;
  private snaps = 0;
  private said = false;

  constructor(readonly idx: number, readonly name: string, private toHost: (raw: string) => void) {
    this.cls = CLASSES[idx % CLASSES.length].id;
    this.brain = this.newBrain();
  }

  private newBrain(): Brain {
    return new Brain(this.idx, (m) => this.toHost(JSON.stringify(m)));
  }

  /** A message from the host (called from inside the host's broadcast: only queued here). */
  receive(data: string, reliable: boolean) {
    if (!this.open) return;
    if (reliable) {
      this.inbox.push(data);
      return;
    }
    // Snapshot (30 Hz). Decide on every THINK_EVERY-th one, staggered by bot index so the bots of a
    // match spread over the ticks; the others are dropped unparsed unless they carry one-off data.
    const n = this.snaps++ + this.idx;
    const dead = this.brain.me !== null && !this.brain.me.alive;
    if (n % (dead ? DEAD_EVERY : THINK_EVERY) === 0) this.snap = data;
    else if (!dead && (data.includes(',"defs":[') || data.includes(',"camps":[') || data.includes(`"target":${this.brain.id},"by":`))) this.extra.push(data); // defs, camps, or a hit on this bot
  }

  /** Once per host tick, after the host's broadcast. */
  tick() {
    if (!this.open) return;
    if (!this.said) {
      this.said = true;
      this.toHost(JSON.stringify({ t: "r-hello", name: this.name, cls: this.cls, rid: `bot-${this.idx}-${this.name}` }));
    }
    if (this.inbox.length) {
      const inbox = this.inbox;
      this.inbox = [];
      // Only the newest hall state counts: answering every stale one would have each bot re-send
      // r-ready once per queued r-state, and every r-ready broadcasts a new r-state to all bots.
      let state: unknown = null;
      for (const raw of inbox) {
        const m = JSON.parse(raw);
        if (m.t === "r-state") state = m;
        else this.onMsg(m);
      }
      if (state) this.onMsg(state);
    }
    if (this.extra.length) {
      for (const raw of this.extra) this.brain.absorb(JSON.parse(raw));
      this.extra.length = 0;
    }
    if (this.snap) {
      const raw = this.snap;
      this.snap = null;
      this.brain.onSnap(JSON.parse(raw));
    } else this.brain.repeat();
  }

  private onMsg(m: any) {
    switch (m.t) {
      case "r-state": {
        // Always ready (also after a match, when the hall resets everyone's ready flag).
        const me = (m.members as { id: number; ready: boolean; inMatch: boolean }[]).find((x) => x.id === m.you);
        if (me && !me.ready && !me.inMatch) this.toHost('{"t":"r-ready","v":true}');
        break;
      }
      case "r-go": // a new match: fresh character, fresh memory
        this.brain = this.newBrain();
        this.snap = null;
        this.extra.length = 0;
        break;
      case "r-full":
      case "r-kicked":
      case "r-closed":
        this.open = false;
        break;
      default:
        this.brain.onMsg(m);
    }
  }
}
