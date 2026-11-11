// The P2P host: lobby room (members, class pick, ready, chat, settings, kick) + the authoritative
// game (GameHost) for matches. Platform-independent: runs in the host's Web Worker
// (src/net/hostworker.ts) and headless in Node (tests) over any HostConn.
//
// Flow: members connect -> r-hello -> room (optionally practising in the arena: r-practice). Host
// sends r-start (>= 2 ready, host counts as ready) -> every ready member is joined into the Game,
// which runs a spawn-point-pick countdown (r-spawns / r-spawn) -> fight -> when the Game reaches
// "ended" (or collapses), results go out as r-end, everyone is removed from the Game and returns
// to the room for a rematch. r-leave takes a player out of a match (full loot, counts as dead) or
// out of practice without leaving the hall. A player who drops during the countdown and comes
// back (same per-tab rid) is put straight back into the match. A player who drops during the
// fight keeps their hero in the match for REJOIN_GRACE seconds (it stands where it was and can be
// killed and looted); coming back with the same rid resumes control of it, or spectates if it died.
//
// Bots (r-bot, host only): each one is a BotClient (src/server/bots/bot.ts) on an in-memory HostConn.
// It is an ordinary member that says r-hello / r-ready / r-spawn and plays through the same game
// messages as a remote client; the only difference here is the `bot` flag shown in the hall.
import { BIOMES } from "../shared/biomes";
import { currentMap } from "../shared/map";
import { CLASS_BY_ID, DEFAULT_CLASS } from "../shared/content/classes";
import { MAX_PLAYERS, TICK_RATE } from "../shared/constants";
import type { GameEvent } from "../shared/protocol";
import { GameHost, sanitizeName } from "../server/host";
import type { ServerPlayer } from "../server/player";
import { playerLevel } from "../server/progression";
import { SIZE_PLAYERS, MAP_SIZES, type LobbyMeta } from "./lobbyproto";
import { CHAT_MAX, isRoomMsg, type MatchResult, type ResultRow, type RoomMember, type RoomServerMsg, type RoomSettings } from "./roomproto";
import type { HostConn } from "./transport";
import { BOT_NAMES, BotClient } from "../server/bots/bot";
import { resetPathBudget } from "../server/bots/path";

interface Member {
  id: number;
  conn: HostConn;
  name: string;
  cls: string;
  ready: boolean;
  host: boolean;
  inMatch: boolean;
  hello: boolean;
  chatTokens: number;
  /** In the practice arena (Game "waiting" phase) while the hall waits. */
  practice: boolean;
  /** Per-tab reconnect token from r-hello. */
  rid: string;
  /** A bot the host added (its client end lives in HostRuntime.bots). */
  bot?: boolean;
  /** Asked to leave the winner screen early (r-skip); cleared when the match ends. */
  skip?: boolean;
}

interface Tally {
  dmg: number;
  mdmg: number;
}

/** One participant of the current match (kept after they die or leave, for the results). */
interface Entry {
  pid: number;
  name: string;
  cls: string;
  rid: string;
  kills: number;
  level: number;
  loot: { n: string; r: number }[];
  bot?: boolean;
  place: number; // 0 = not yet placed
  diedTick: number; // match tick of death / leaving (-1 = alive)
  left: boolean;
  team?: 0 | 1; // Breachway
}

export interface HostRuntimeOptions {
  hostName: string;
  settings?: Partial<RoomSettings>;
  dev?: boolean;
  /** Lobby metadata changed (publish it to the lobby service). */
  onMeta?: (meta: LobbyMeta) => void;
  /** Seconds the "ended" phase is shown before results (the Game itself waits ROUND_END_TIME). */
  endHold?: number;
}

/** Seconds a dropped player's hero waits in the fight before it dies. */
export const REJOIN_GRACE = 75;

/** Seconds into the fight a new player can still join the running match (taking a bot's seat if full). */
export const LATE_JOIN_SECS = 180;

/** A player who dropped during the fight: their hero is parked on `conn` (never open). */
interface Away {
  conn: HostConn;
  name: string;
  /** Match tick at which a still-living hero dies (-1 = done). */
  until: number;
}

const validCls = (c: unknown) => (typeof c === "string" && CLASS_BY_ID.has(c) ? c : DEFAULT_CLASS);

export class HostRuntime {
  readonly gh: GameHost;
  readonly members = new Map<HostConn, Member>();
  settings: RoomSettings;
  state: "room" | "match" = "room";
  hostHidden = false;
  lastResult: MatchResult | null = null;

  private nextId = 1;
  private tally = new Map<number, Tally>(); // game player id -> damage dealt
  private matchTicks = 0;
  private endedFor = -1;
  private sawFight = false;
  private lateWas = false;
  private fightTick = -1;
  private entries = new Map<number, Entry>(); // game player id -> participant
  private spawnSig = "";
  private o: HostRuntimeOptions;
  /** Host-added bots by their in-memory connection. */
  private bots = new Map<HostConn, BotClient>();
  private nextBot = 0;
  /** Dropped during the fight, by rid (cleared with the match). */
  private away = new Map<string, Away>();

  constructor(opts: HostRuntimeOptions) {
    this.o = opts;
    this.gh = new GameHost({ dev: opts.dev });
    this.gh.game.lobbyManaged = true; // practice in the hall; matches start only on r-start
    this.settings = this.cleanSettings({ name: `${opts.hostName}'s hall`, max: MAX_PLAYERS, biome: "random", size: "auto", ...opts.settings });
    // Tally damage from the game's own events (by = attacker id) without touching game code.
    const game = this.gh.game;
    const take = game.takeEvents.bind(game);
    game.takeEvents = (): GameEvent[] => {
      const evs = take();
      if (this.state === "match") this.tallyEvents(evs);
      return evs;
    };
  }

  // ---- connections ------------------------------------------------------------------

  open(conn: HostConn, isHost = false) {
    const m: Member = { id: this.nextId++, conn, name: "…", cls: DEFAULT_CLASS, ready: isHost, host: isHost, inMatch: false, hello: false, chatTokens: 5, practice: false, rid: "" };
    this.members.set(conn, m);
  }

  /** `hold`: a player dropping out of the fight keeps their hero for a while (not when kicked). */
  close(conn: HostConn, hold = true) {
    const m = this.members.get(conn);
    if (!m) return;
    this.members.delete(conn);
    this.bots.delete(conn);
    if (hold && this.holdHero(m)) {
      /* the hero stays in the match */
    } else if (m.inMatch || m.practice) this.leaveGame(m, false);
    if (m.hello) {
      this.sys(`${m.name} left`);
      this.broadcastState();
    }
  }

  message(conn: HostConn, raw: string) {
    const m = this.members.get(conn);
    if (!m) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
      if (!msg || typeof msg !== "object") return;
    } catch {
      return;
    }
    if (isRoomMsg(msg.t)) return this.roomMessage(m, msg);
    if (msg.t === "ping") {
      // Answer pings in the room too (the game answers them during a match).
      if (!m.inMatch && !m.practice && typeof msg.c === "number") this.send(m, { t: "pong", c: msg.c } as unknown as RoomServerMsg);
      else this.gh.handle(conn, msg);
      return;
    }
    if (msg.t === "join") return; // the room joins members itself (no name / class spoofing)
    if (m.inMatch || m.practice) this.gh.handle(conn, msg);
  }

  setHostHidden(hidden: boolean) {
    if (hidden === this.hostHidden) return;
    this.hostHidden = hidden;
    this.sys(hidden ? "The host's tab is in the background: the game may stutter." : "The host is back.");
    this.broadcastState();
  }

  /** Shut down: tell everyone, then close their connections. */
  shutdown(reason: string) {
    for (const m of this.members.values()) {
      this.send(m, { t: "r-closed", reason });
      if (!m.host) m.conn.close(reason);
    }
    this.bots.clear(); // the bots go with the hall
  }

  // ---- room -------------------------------------------------------------------------

  private send(m: Member, msg: RoomServerMsg) {
    if (m.conn.open) m.conn.send(JSON.stringify(msg), true);
  }

  private sys(text: string) {
    for (const m of this.members.values()) if (m.hello) this.send(m, { t: "r-chat", from: "", text, sys: 1 });
  }

  private listed(): Member[] {
    return [...this.members.values()].filter((m) => m.hello).sort((a, b) => Number(b.host) - Number(a.host) || a.id - b.id);
  }

  private memberView(m: Member): RoomMember {
    return { id: m.id, name: m.name, cls: m.cls, ready: m.ready, host: m.host, inMatch: m.inMatch, ...(m.practice ? { practice: true } : {}), ...(m.bot ? { bot: true as const } : {}) };
  }

  broadcastState() {
    const members = this.listed().map((m) => this.memberView(m));
    for (const m of this.members.values()) {
      if (m.hello) this.send(m, { t: "r-state", you: m.id, members, settings: this.settings, state: this.state, hostHidden: this.hostHidden });
    }
    this.o.onMeta?.(this.meta());
  }

  meta(): LobbyMeta {
    const host = [...this.members.values()].find((m) => m.host);
    return {
      name: this.settings.name,
      host: host?.name ?? this.o.hostName,
      players: this.listed().length,
      max: this.settings.max,
      biome: this.settings.biome,
      size: this.settings.size,
      state: this.state,
      joinable: this.state === "room" ? this.listed().length < this.settings.max : this.lateOpen() && (this.listed().length < this.settings.max || this.listed().some((o) => o.bot && o.inMatch)),
      ...(this.lateOpen() ? { lateLeft: this.lateLeft() } : {}),
    };
  }

  // ---- late join ----------------------------------------------------------------------

  /** Seconds left in the late-join window (0 when closed). Countdown counts as open. */
  private lateLeft(): number {
    if (this.state !== "match") return 0;
    const g = this.gh.game;
    if (g.phase === "countdown") return LATE_JOIN_SECS;
    if (g.phase !== "fight" || this.fightTick < 0) return 0;
    return Math.max(0, Math.ceil(LATE_JOIN_SECS - (this.matchTicks - this.fightTick) / TICK_RATE));
  }

  private lateOpen(): boolean {
    return this.lateLeft() > 0;
  }

  /** A player arriving in the first minutes of a match goes straight in with a fresh hero. */
  private lateJoin(m: Member, team?: 0 | 1) {
    const g = this.gh.game;
    m.ready = true;
    this.joinMatch(m); // countdown: the Game hands them a free spawn point itself
    const p = this.gh.conns.get(m.conn);
    if (p && g.phase === "fight") {
      g.lateSpawn(p, team);
      const e = this.entries.get(p.id);
      if (e && p.team !== undefined) e.team = p.team;
    }
    this.sys(`${m.name} joined the running match`);
    this.broadcastState();
    if (g.phase === "countdown") this.sendSpawns(true);
  }

  private cleanSettings(s: Partial<RoomSettings>, base?: RoomSettings): RoomSettings {
    const b = base ?? { name: "Lobby", max: MAX_PLAYERS, biome: "random", size: "auto" };
    const max = typeof s.max === "number" && Number.isFinite(s.max) ? Math.max(2, Math.min(MAX_PLAYERS, Math.round(s.max))) : b.max;
    return {
      name: s.name !== undefined ? sanitizeName(s.name, 32) : b.name,
      max,
      biome: s.biome === "random" || BIOMES.some((x) => x.id === s.biome) ? (s.biome as string) : b.biome,
      size: (MAP_SIZES as readonly string[]).includes(s.size as string) ? (s.size as string) : b.size,
      mode: s.mode === "lanes" || s.mode === "royale" ? s.mode : b.mode ?? "royale",
    };
  }

  private roomMessage(m: Member, msg: Record<string, unknown>) {
    if (msg.t !== "r-hello" && !m.hello) return;
    switch (msg.t) {
      case "r-hello": {
        if (m.hello) return;
        const rid = typeof msg.rid === "string" ? msg.rid.slice(0, 40) : "";
        // Same tab reconnecting while its old connection hasn't timed out yet: drop the stale one.
        const stale = rid ? [...this.members.values()].find((o) => o !== m && o.rid === rid && !o.host) : undefined;
        if (stale) {
          this.close(stale.conn);
          stale.conn.close("replaced by a new connection");
        }
        const back = this.state === "match" && !!rid && this.away.has(rid); // their hero is still in the match
        // A player always gets a full hall's bot seat (one that is not fighting right now).
        let seatTeam: 0 | 1 | undefined;
        if (!m.bot && this.listed().length >= this.settings.max) {
          let seat = this.listed().reverse().find((o) => o.bot && !o.inMatch);
          if (!seat && !back && this.lateOpen()) {
            // A full running match still taking late joiners: a random fighting bot gives up its seat.
            const fighting = this.listed().filter((o) => o.bot && o.inMatch);
            seat = fighting[Math.floor(Math.random() * fighting.length)];
            if (seat) seatTeam = this.gh.conns.get(seat.conn)?.team;
          }
          if (seat) this.removeBot(seat);
        }
        if (!back && this.listed().length >= this.settings.max) {
          this.send(m, { t: "r-full" });
          m.conn.close("full");
          return;
        }
        m.hello = true;
        m.rid = rid;
        m.name = this.uniqueName(sanitizeName(msg.name), m);
        m.cls = validCls(msg.cls);
        this.sys(`${m.name} entered the hall`);
        if (this.state === "match" && this.rejoin(m)) break;
        if (this.state === "match" && !m.bot && this.lateOpen()) {
          this.lateJoin(m, seatTeam);
          break;
        }
        this.broadcastState();
        if (this.state === "match") this.send(m, { t: "r-chat", from: "", text: "A match is in progress. You'll play in the next one.", sys: 1 });
        break;
      }
      case "r-practice":
        if (msg.v === true) this.enterPractice(m);
        else if (m.practice) this.leaveGame(m, true);
        break;
      case "r-leave":
        if (m.inMatch || m.practice) this.leaveGame(m, true);
        break;
      case "r-spawn": {
        const p = this.gh.conns.get(m.conn);
        if (!m.inMatch || !p) return;
        const err = this.gh.game.pickSpawn(p, msg.i);
        if (err) this.gh.game.toast(p, err);
        this.sendSpawns(true);
        break;
      }
      case "r-cls":
        if (m.inMatch || m.practice) return; // the class is fixed once you are in the arena
        m.cls = validCls(msg.cls);
        this.broadcastState();
        break;
      case "r-ready":
        if (m.host || m.inMatch) return; // the host is always ready
        m.ready = msg.v === true;
        this.broadcastState();
        break;
      case "r-chat": {
        if (typeof msg.text !== "string") return;
        if (m.chatTokens < 1) return this.send(m, { t: "r-chat", from: "", text: "Slow down.", sys: 1 });
        m.chatTokens -= 1;
        const text = sanitizeName(msg.text, CHAT_MAX);
        if (!text || text === "Player" && msg.text.trim() !== "Player") return;
        for (const o of this.members.values()) if (o.hello) this.send(o, { t: "r-chat", from: m.name, text });
        break;
      }
      case "r-set":
        if (!m.host || !msg.settings || typeof msg.settings !== "object") return;
        this.settings = this.cleanSettings(msg.settings as Partial<RoomSettings>, this.settings);
        this.broadcastState();
        break;
      case "r-kick": {
        if (!m.host) return;
        const t = [...this.members.values()].find((o) => o.id === msg.id && !o.host);
        if (!t) return;
        if (t.bot) {
          this.removeBot(t);
          this.broadcastState();
          break;
        }
        this.send(t, { t: "r-kicked" });
        this.sys(`${t.name} was kicked`);
        this.close(t.conn, false);
        t.conn.close("kicked");
        break;
      }
      case "r-bot": // host only: add / fill / clear bots
        if (!m.host) return;
        if (msg.clear === true) {
          for (const b of [...this.members.values()]) if (b.bot) this.removeBot(b);
          this.broadcastState();
        } else if (typeof msg.fill === "number" && Number.isFinite(msg.fill)) this.addBots(Math.round(msg.fill) - this.listed().length);
        else this.addBots(typeof msg.add === "number" && Number.isFinite(msg.add) ? Math.round(msg.add) : 1);
        break;
      case "r-skip":
        if (this.state === "match" && m.inMatch && this.endedFor >= 0) m.skip = true;
        break;
      case "r-start":
        if (m.host) this.startMatch();
        break;
      case "r-abort":
        if (m.host && this.state === "match") this.endMatch(true);
        break;
    }
  }

  private uniqueName(name: string, self: Member): string {
    const taken = new Set(this.listed().filter((o) => o !== self).map((o) => o.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 99; i++) {
      const n = `${name.slice(0, 13)}${i}`;
      if (!taken.has(n.toLowerCase())) return n;
    }
    return name;
  }

  // ---- bots ---------------------------------------------------------------------------

  /** Seat up to `n` bots (never past the hall's max players). Returns how many were added. */
  addBots(n: number): number {
    const room = this.settings.max - [...this.members.values()].filter((m) => m.hello || m.bot).length;
    const count = Math.max(0, Math.min(n, room));
    if (n > 0 && count === 0) this.sys(`The hall is full (${this.settings.max} players): no room for a bot.`);
    const taken = new Set([...this.members.values()].map((m) => m.name.toLowerCase()));
    for (let k = 0; k < count; k++) {
      // A pool name nobody in the hall (player or bot) carries; r-hello's uniqueName() covers the rest.
      let name = BOT_NAMES[this.nextBot % BOT_NAMES.length];
      for (let i = 0; i < BOT_NAMES.length && taken.has(name.toLowerCase()); i++) name = BOT_NAMES[(this.nextBot + i + 1) % BOT_NAMES.length];
      taken.add(name.toLowerCase());
      const idx = this.nextBot++;
      // The in-memory connection: host -> bot is queued by the bot, bot -> host is an ordinary client message.
      const conn: HostConn = {
        get open() {
          return bot.open;
        },
        send: (data, reliable = true) => bot.receive(data, reliable),
        close: () => {
          bot.open = false; // tickBots() takes it out of the hall
        },
      };
      const bot: BotClient = new BotClient(idx, name, (raw) => this.message(conn, raw));
      this.open(conn);
      this.members.get(conn)!.bot = true;
      this.bots.set(conn, bot);
      bot.tick(); // says r-hello now, so it is seated (and counted) before the next one
    }
    if (count > 0 && this.state === "match") this.sys(count === 1 ? "The bot will play in the next match." : "The bots will play in the next match.");
    return count;
  }

  /** Take a bot out of the hall (out of a running match too: full loot, like a player who drops). */
  private removeBot(m: Member) {
    const bot = this.bots.get(m.conn);
    if (bot) bot.open = false;
    this.bots.delete(m.conn);
    if (!this.members.delete(m.conn)) return;
    if (m.inMatch || m.practice) this.leaveGame(m, false);
    if (m.hello) this.sys(`${m.name} (bot) was sent away`);
  }

  /** After the broadcast: every bot reads its messages and answers like a client would. */
  private tickBots() {
    if (!this.bots.size) return;
    resetPathBudget();
    for (const [conn, bot] of [...this.bots]) {
      if (!bot.open) {
        // The host side closed it (hall full, shutdown ...).
        const m = this.members.get(conn);
        if (m) {
          this.removeBot(m);
          this.broadcastState();
        } else this.bots.delete(conn);
        continue;
      }
      try {
        bot.tick();
      } catch (err) {
        console.error(`bot ${bot.name} error:`, err);
      }
    }
  }

  readyCount(): number {
    return this.listed().filter((m) => m.ready).length;
  }

  // ---- practice / leaving ----------------------------------------------------------

  /** Practice arena while the hall waits (the Game's "waiting" phase: monsters, respawns). */
  private enterPractice(m: Member) {
    if (this.state !== "room" || m.inMatch || m.practice || !m.conn.open) return;
    m.practice = true;
    this.send(m, { t: "r-practice" });
    this.gh.connect(m.conn);
    this.gh.handle(m.conn, { t: "join", name: m.name, weapon: "sword", cls: m.cls });
    this.broadcastState();
  }

  /**
   * Out of the match / practice, back to the hall. In a match this is full loot: the Game drops the
   * player's gear where they stand and they count as dead (placed now).
   */
  private leaveGame(m: Member, stillHere: boolean) {
    const p = this.gh.conns.get(m.conn);
    const g = this.gh.game;
    if (m.inMatch && p) {
      const e = this.entries.get(p.id);
      if (e && !e.place && p.alive) {
        this.snapEntry(e, p);
        e.left = true;
        e.diedTick = this.matchTicks;
        // Placed among the living at the moment they quit (only once the fight is on).
        if (g.phase === "fight" && !g.lanes) e.place = g.aliveCount;
        this.sys(`${m.name} ${stillHere ? "left the match" : "dropped out of the match"}`);
      }
    }
    this.gh.disconnect(m.conn);
    const wasPractice = m.practice;
    m.inMatch = false;
    m.practice = false;
    if (stillHere) {
      this.send(m, { t: "r-left" });
      if (!wasPractice && !m.host) m.ready = false;
      this.broadcastState();
    }
  }

  /**
   * A player (not a bot) dropped during the fight: park the hero on a closed connection instead of
   * removing it. It stands still, can be killed and looted, and dies when the grace runs out
   * (tickAway). A dead player's record is kept the same way so they can come back to watch.
   */
  private holdHero(m: Member): boolean {
    const g = this.gh.game;
    const p = this.gh.conns.get(m.conn);
    if (this.state !== "match" || g.phase !== "fight" || !m.inMatch || m.bot || !m.rid || !p?.joined) return false;
    const conn: HostConn = { open: false, send: () => {}, close: () => {} };
    this.gh.moveConn(m.conn, conn);
    this.away.set(m.rid, { conn, name: m.name, until: this.matchTicks + REJOIN_GRACE * TICK_RATE });
    m.inMatch = false;
    if (p.alive) this.sys(`${m.name} lost the connection: their hero waits ${REJOIN_GRACE} s for them`);
    return true;
  }

  /** The grace ran out: the hero dies where it stands (full loot, a kill line, a place). */
  private tickAway() {
    for (const a of this.away.values()) {
      if (a.until < 0 || this.matchTicks < a.until) continue;
      a.until = -1;
      const p = this.gh.conns.get(a.conn);
      if (!p?.alive || this.gh.game.phase !== "fight") continue;
      const e = this.entries.get(p.id);
      if (e) e.left = true;
      this.gh.game.onPlayerKilled(p, null, "a lost connection");
      this.sys(`${a.name} dropped out of the match`);
    }
  }

  /**
   * A dropped player reconnected (same per-tab rid). Countdown: back into the match with a fresh
   * hero. Fight: the hero that waited for them, as it is now (or its ghost: spectating).
   */
  private rejoin(m: Member): boolean {
    const g = this.gh.game;
    const a = m.rid ? this.away.get(m.rid) : undefined;
    if (a) {
      const e = this.entries.get(this.gh.conns.get(a.conn)?.id ?? -1);
      if (!e) return false;
      this.away.delete(m.rid);
      m.name = e.name; // the hero keeps its name for the results
      m.cls = e.cls;
      m.ready = true;
      m.inMatch = true;
      this.send(m, { t: "r-go" });
      const p = this.gh.moveConn(a.conn, m.conn)!;
      this.sys(p.alive ? `${m.name} is back in the match` : `${m.name} is back, watching the match`);
      this.broadcastState();
      return true;
    }
    if (!m.rid || g.phase !== "countdown") return false;
    const e = [...this.entries.values()].find((x) => x.rid === m.rid && x.left && x.place === 0);
    if (!e) return false;
    this.entries.delete(e.pid);
    m.cls = e.cls;
    m.ready = true;
    this.joinMatch(m);
    this.sys(`${m.name} is back in the match`);
    this.broadcastState();
    this.sendSpawns(true);
    return true;
  }

  private joinMatch(m: Member) {
    m.inMatch = true;
    this.send(m, { t: "r-go" });
    const p = this.gh.connect(m.conn);
    this.gh.game.lateJoining = this.state === "match" && this.gh.game.phase === "fight";
    this.gh.handle(m.conn, { t: "join", name: m.name, weapon: "sword", cls: m.cls });
    this.gh.game.lateJoining = false;
    this.entries.set(p.id, { pid: p.id, name: m.name, cls: m.cls, rid: m.rid, kills: 0, level: 1, loot: [], place: 0, diedTick: -1, left: false, ...(m.bot ? { bot: true } : {}) });
  }

  // ---- matches -----------------------------------------------------------------------

  startMatch(): boolean {
    if (this.state !== "room") return false;
    const players = this.listed().filter((m) => m.ready && m.conn.open);
    const need = this.o.dev ? 1 : 2; // dev solo testing (?dev=1): start alone
    if (players.length < need) {
      this.sys(`Need at least ${need} ready players to start.`);
      return false;
    }
    const game = this.gh.game;
    // Practice ends: the players going in start fresh, everyone else goes back to the hall.
    for (const m of this.members.values()) if (m.practice) this.leaveGame(m, !players.includes(m));
    game.toWaiting();
    const sizeN = SIZE_PLAYERS[this.settings.size];
    game.nextMap = {
      seed: (Math.random() * 0x7fffffff) | 0,
      players: sizeN ?? players.length,
      biome: this.settings.biome === "random" ? undefined : this.settings.biome,
    };
    game.nextMode = this.settings.mode === "lanes" ? "lanes" : "royale";
    this.state = "match";
    this.tally.clear();
    this.entries.clear();
    this.away.clear();
    this.matchTicks = 0;
    this.endedFor = -1;
    this.sawFight = false;
    this.fightTick = -1;
    this.spawnSig = "";
    for (const m of players) this.joinMatch(m);
    if (game.nextMode === "lanes") {
      // Breachway teams: humans alternate first, then bots, so people spread over both sides.
      const order = [...players.filter((m) => !m.bot), ...players.filter((m) => m.bot)];
      order.forEach((m, i) => {
        const p = this.gh.conns.get(m.conn);
        if (!p) return;
        p.team = (i % 2) as 0 | 1;
        const e = this.entries.get(p.id);
        if (e) e.team = p.team;
      });
    }
    if (!game.beginMatch()) {
      this.sys("The arena is not ready, try again in a moment.");
      this.endMatch(true);
      return false;
    }
    this.sys(game.mode === "lanes" ? `Breachway begins: ${players.length} enter, two teams. Destroy the enemy Core.` : `The match begins: ${players.length} enter. Pick your spawn point.`);
    this.broadcastState();
    this.sendSpawns(true);
    return true;
  }

  private tallyEvents(evs: GameEvent[]) {
    for (const e of evs) {
      if (e.k === "kill") {
        if (this.gh.game.lanes) continue; // Breachway: deaths respawn, nobody is placed
        const en = this.entries.get(e.vid);
        if (en && !en.place) {
          const p = this.gh.game.players.get(e.vid);
          if (p) this.snapEntry(en, p);
          en.diedTick = this.matchTicks;
          en.place = e.pl ?? this.gh.game.aliveCount + 1;
        }
        continue;
      }
      if (e.k !== "hit") continue;
      const t = this.tally.get(e.by) ?? { dmg: 0, mdmg: 0 };
      if (e.m) t.mdmg += e.dmg;
      else if (e.target !== e.by) t.dmg += e.dmg;
      this.tally.set(e.by, t);
    }
  }

  /** Spawn-pick state to everyone in the match (on change, and once a second for the timer). */
  private sendSpawns(force = false) {
    const g = this.gh.game;
    const counting = g.phase === "countdown" && g.spawnChoices.length > 0;
    const left = counting ? Math.ceil(g.phaseLeft) : 0;
    const takenBy = new Map<number, number>(); // choice -> player id
    for (const [pid, i] of g.spawnTaken) takenBy.set(i, pid);
    const sig = `${counting}|${left}|${[...takenBy].join(",")}`;
    if (!force && sig === this.spawnSig) return;
    this.spawnSig = sig;
    const map = currentMap();
    const pts = g.spawnChoices.map((c) => [Math.round(c.x), Math.round(c.y)] as [number, number]);
    for (const m of this.members.values()) {
      if (!m.inMatch) continue;
      const me = this.gh.conns.get(m.conn);
      const taken = [...takenBy].map(([i, pid]) => ({ i, name: g.players.get(pid)?.name ?? "?", ...(me && pid === me.id ? { me: 1 as const } : {}) }));
      this.send(m, { t: "r-spawns", pts: counting ? pts : [], taken: counting ? taken : [], left, w: map.w, h: map.h, ...(counting ? {} : { done: 1 as const }) });
    }
  }

  /** 30 Hz. */
  tick() {
    for (const m of this.members.values()) m.chatTokens = Math.min(5, m.chatTokens + 1 / (TICK_RATE * 2));
    // The Game ticks between matches too (practice, or empty = cheap).
    this.gh.tick();
    this.tickBots();
    if (this.state !== "match") return;
    this.matchTicks++;
    const g = this.gh.game;
    // The room list shows whether (and how long) the running match still takes late joiners.
    const late = this.lateOpen();
    if (late !== this.lateWas || (late && this.matchTicks % (10 * TICK_RATE) === 0)) this.o.onMeta?.(this.meta());
    this.lateWas = late;
    if (g.phase === "countdown") this.sendSpawns();
    if (this.away.size) this.tickAway();
    if (g.phase === "fight" && !this.sawFight) {
      this.sawFight = true;
      this.fightTick = this.matchTicks;
      this.sendSpawns(true); // done: the picker closes
    }
    if (g.phase === "ended") {
      if (this.endedFor < 0) this.endedFor = 0;
      this.endedFor++;
      // Early exit: after 2 s, once every human player still in the match has clicked through (r-skip).
      const humans = [...this.members.values()].filter((m) => m.inMatch && !m.bot);
      const skipped = this.endedFor >= 2 * TICK_RATE && humans.length > 0 && humans.every((m) => m.skip);
      if (skipped || this.endedFor >= (this.o.endHold ?? 12) * TICK_RATE) this.endMatch(false);
    } else if (g.phase === "waiting" && this.matchTicks > TICK_RATE) {
      this.endMatch(true); // everyone left before / during the countdown
    } else if (this.gh.conns.size === 0) {
      this.endMatch(true);
    }
  }

  private snapEntry(e: Entry, p: ServerPlayer) {
    e.kills = p.kills;
    try {
      e.level = playerLevel(p);
    } catch {
      /* progression not initialised */
    }
    e.loot = Object.values(p.equip ?? {})
      .filter((it): it is NonNullable<typeof it> => !!it && it.r >= 1)
      .sort((a, b) => b.r - a.r || b.l - a.l)
      .slice(0, 3)
      .map((it) => ({ n: it.n, r: it.r }));
  }

  private endMatch(aborted: boolean) {
    const g = this.gh.game;
    // Survivors: refresh their numbers; the winner (or the last ones alive) take the top places.
    const alive: Entry[] = [];
    for (const p of this.gh.conns.values()) {
      const e = this.entries.get(p.id);
      if (!e) continue;
      if (!e.place) this.snapEntry(e, p);
      if (!e.place && p.alive) alive.push(e);
    }
    const lanes = g.mode === "lanes";
    const winTeam = lanes ? g.lanes?.winner ?? null : null;
    if (lanes) {
      // Breachway: the winning team shares first place, the other second.
      for (const e of this.entries.values()) {
        const p = g.players.get(e.pid);
        if (p) this.snapEntry(e, p);
        e.place = winTeam === null ? 0 : e.team === winTeam ? 1 : 2;
        e.diedTick = -1;
      }
    } else {
      alive.sort((a, b) => Number(b.name === g.winner) - Number(a.name === g.winner) || b.kills - a.kills);
      alive.forEach((e, i) => (e.place = i + 1));
    }
    // Still alive at the end: the fight length, without the winner screen that followed it.
    const fightTicks = (t: number) => (this.fightTick < 0 ? 0 : Math.max(0, (t < 0 ? this.matchTicks - Math.max(0, this.endedFor) : t) - this.fightTick));
    const rows: ResultRow[] = [...this.entries.values()].map((e) => {
      const t = this.tally.get(e.pid) ?? { dmg: 0, mdmg: 0 };
      return {
        name: e.name,
        cls: e.cls,
        kills: e.kills,
        dmg: Math.round(t.dmg),
        mdmg: Math.round(t.mdmg),
        level: e.level,
        won: !aborted && (lanes ? winTeam !== null && e.team === winTeam : !!g.winner && e.place === 1 && e.name === g.winner),
        alive: e.diedTick < 0,
        loot: e.loot,
        place: e.place,
        secs: Math.round(fightTicks(e.diedTick) / TICK_RATE),
        ...(e.left ? { left: true } : {}),
        ...(e.bot ? { bot: true as const } : {}),
      };
    });
    rows.sort((a, b) => (a.place || 99) - (b.place || 99) || b.kills - a.kills || b.dmg - a.dmg);
    const result: MatchResult = { winner: aborted ? null : g.winner, secs: Math.round(fightTicks(-1) / TICK_RATE), rows };
    this.lastResult = result;
    const played = new Set([...this.entries.values()].map((e) => e.rid || e.name));
    for (const conn of [...this.gh.conns.keys()]) this.gh.disconnect(conn);
    g.toWaiting();
    this.state = "room";
    this.entries.clear();
    this.away.clear();
    for (const m of this.members.values()) {
      // Everyone who played gets the results, including those who left the match for the hall.
      if (m.inMatch || (m.hello && played.has(m.rid || m.name))) this.send(m, { t: "r-end", result });
      m.inMatch = false;
      m.skip = false;
      m.practice = false;
      if (!m.host) m.ready = false;
    }
    this.sys(aborted ? "The match was called off." : lanes ? (result.winner ? `${result.winner} wins the Breachway.` : "The Breachway ended without a winner.") : result.winner ? `${result.winner} is the last one standing.` : "Nobody survived.");
    this.broadcastState();
  }
}
