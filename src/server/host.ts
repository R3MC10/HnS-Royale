// Transport-agnostic game host: per-connection message handling + the per-tick broadcast.
// Runs in Node (src/server/index.ts, over `ws`) and in the host player's browser worker
// (src/net/hostworker.ts, over WebRTC DataChannels + loopback). Keep it browser-safe:
// no node:* imports, no process / Buffer / ws here.
//
// ADD NEW client->server message cases in `handle()` and per-tick outbound messages in `tick()`.
import { pinRandom } from "./devpin";
import { MAX_NAME_LEN } from "../shared/constants";
import type { InputCmd, ServerMsg } from "../shared/protocol";
import { Game } from "./game";
import type { ServerPlayer } from "./player";
import { statsEqual } from "../shared/stats";
import type { WeaponKind } from "../shared/content/types";
import { STARTER_WEAPONS } from "../shared/content/bases";
import { dropById, equipItem, invMessage, moveInGrid, splitStack, swapWeaponSets, unequip } from "./inventory";
import { carriedItem } from "./inventory"; // chat item links
import { CHAT_MAX } from "../net/roomproto";
import type { ChatMsg } from "../shared/protocol";
import { newItemId } from "./loot";
import { autoPlace } from "./inventory";
import { resendBar, takeSkillMsgs } from "./skills";
import { buildSnapshots } from "./snapshot";
import { cycleSpectate } from "./hudsnap";
import { damageDevCommand } from "./damage";
import { handleCharm, handleCraft } from "./lootsys";
import { CLASS_BY_ID, DEFAULT_CLASS, classWeapon } from "../shared/content/classes";
import { activateTrial, allocate, allocateAsc, chooseAscendancy, progOutbox, progResend, resetProgression, socketJewel } from "./progression";
import type { HostConn } from "../net/transport";
import { buffOf, shrineSnap } from "./ai/shrines"; // monsters agent

export type { HostConn } from "../net/transport";

// Control chars, zero-width chars and bidi overrides.
const BAD_RANGES: [number, number][] = [[0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff]];
const isBadChar = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return BAD_RANGES.some(([a, b]) => c >= a && c <= b);
};

export function sanitizeName(raw: unknown, maxLen = MAX_NAME_LEN): string {
  if (typeof raw !== "string") return "Player";
  const chars = [...raw.slice(0, 200)].filter((ch) => !isBadChar(ch));
  const s = chars.join("").trim();
  const clipped = [...s].slice(0, maxLen).join("").trim(); // by code point, never splits emoji
  return clipped || "Player";
}

export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseCmd(c: unknown): InputCmd | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  if (!isNum(o.seq) || !Number.isInteger(o.seq) || o.seq < 0) return null;
  if (!isNum(o.mx) || !isNum(o.my) || !isNum(o.angle)) return null;
  return {
    seq: o.seq,
    mx: Math.max(-1, Math.min(1, o.mx)),
    my: Math.max(-1, Math.min(1, o.my)),
    angle: o.angle,
    attack: o.attack === true,
    dodge: o.dodge === true,
    ...(isNum(o.sk) && Number.isInteger(o.sk) && o.sk >= 0 && o.sk < 16 ? { sk: o.sk } : {}), // held skill slot
    ...(o.blk === true ? { blk: true } : {}), // raised shield (validated against the offhand in game.ts)
  };
}

export interface GameHostOptions {
  /** Accept {t:"dev"} commands (HNS_DEV=1). */
  dev?: boolean;
  /** Reuse an existing Game (default: a new one). */
  game?: Game;
  /** Dev only: pin the map seed and Math.random to this seed (server/devpin.ts; HNS_PIN). */
  pin?: number;
}

export class GameHost {
  readonly game: Game;
  readonly dev: boolean;
  /** Connected clients (joined or not) -> their player record. */
  readonly conns = new Map<HostConn, ServerPlayer>();
  /** Map version last sent to each connection. */
  private mapSent = new WeakMap<HostConn, number>();

  constructor(opts: GameHostOptions = {}) {
    if (opts.dev && opts.pin !== undefined && Number.isFinite(opts.pin)) pinRandom(opts.pin); // before the Game, so its first map is pinned too
    this.game = opts.game ?? new Game();
    this.dev = !!opts.dev;
    if (this.dev) this.game.minPlayers = 1; // dev solo testing: a round starts with one player
  }

  private send(conn: HostConn, msg: ServerMsg) {
    if (conn.open) conn.send(JSON.stringify(msg), true);
  }

  private readonly drop = (item: Parameters<Game["dropItem"]>[0], x: number, y: number) => this.game.dropItem(item, x, y);
  private report(p: ServerPlayer, err: string | null) {
    if (err) this.game.toast(p, err);
  }

  /** A new transport connection: creates its (not yet joined) player slot. */
  connect(conn: HostConn): ServerPlayer {
    const p = this.game.addConnection();
    this.conns.set(conn, p);
    return p;
  }

  /** The connection closed (or the client left the match): full-loot removal. */
  disconnect(conn: HostConn) {
    const p = this.conns.get(conn);
    if (!p) return;
    this.conns.delete(conn);
    this.game.remove(p);
  }

  /**
   * Hand a player's record to another connection without touching the hero. A dropped player's
   * hero is parked on a closed connection (it stands still; tick() sends it nothing); when the
   * player returns, the new connection gets everything a fresh join would: welcome, map, stats,
   * inventory, progression, skill bar, ground item details.
   */
  moveConn(from: HostConn, to: HostConn): ServerPlayer | undefined {
    const p = this.conns.get(from);
    if (!p) return undefined;
    this.conns.delete(from);
    this.conns.set(to, p);
    p.inputs.length = 0;
    if (!to.open) return p;
    p.lastSeq = 0; // the new client counts its inputs from the start
    p.sentStats = null;
    p.invDirty = true;
    p.noRoom.length = 0;
    p.knownGround.clear();
    resendBar(p);
    progResend(p);
    this.send(to, { t: "welcome", id: p.id });
    return p;
  }

  /** Raw JSON text from a client. */
  message(conn: HostConn, raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
      if (!msg || typeof msg !== "object") return;
    } catch {
      return; // malformed JSON: ignore
    }
    this.handle(conn, msg);
  }

  /** One parsed client message. */
  handle(conn: HostConn, msg: Record<string, unknown>) {
    const p = this.conns.get(conn);
    if (!p) return;
    const game = this.game;
    const drop = this.drop;
    try {
      switch (msg.t) {
        case "join":
          if (p.joined) return;
          const cls = typeof msg.cls === "string" && CLASS_BY_ID.has(msg.cls) ? msg.cls : null;
          const weapon = (cls ? classWeapon(cls, STARTER_WEAPONS) : typeof msg.weapon === "string" && msg.weapon in STARTER_WEAPONS ? msg.weapon : "sword") as WeaponKind;
          resetProgression(p, cls ?? DEFAULT_CLASS); // progression: class + level 1
          if (game.join(p, sanitizeName(msg.name), weapon)) this.send(conn, { t: "welcome", id: p.id });
          else {
            this.send(conn, { t: "full" });
            conn.close("full");
          }
          break;
        case "input": {
          if (!p.joined || !Array.isArray(msg.cmds)) return;
          const cmds: InputCmd[] = [];
          for (const c of msg.cmds.slice(0, 32)) {
            const cmd = parseCmd(c);
            if (cmd) cmds.push(cmd);
          }
          game.queueInputs(p, cmds);
          break;
        }
        case "pickup":
          if (p.joined) game.pickup(p, msg.g, msg.equip === true, msg.ae === true);
          break;
        case "equip":
          if (p.joined && p.alive) this.report(p, equipItem(p, msg.id, msg.to, drop));
          break;
        case "unequip":
          if (p.joined && p.alive) this.report(p, unequip(p, msg.from, msg.x, msg.y, drop));
          break;
        case "move":
          if (p.joined && p.alive) this.report(p, moveInGrid(p, msg.id, msg.x, msg.y));
          break;
        case "drop":
          if (p.joined && p.alive) this.report(p, dropById(p, msg.id, drop));
          break;
        case "split":
          if (p.joined && p.alive) this.report(p, splitStack(p, msg.id, msg.n, msg.x, msg.y, newItemId));
          break;
        case "weaponSwap":
          if (p.joined && p.alive) this.report(p, swapWeaponSets(p, drop));
          break;
        case "spec":
          if (p.joined && !p.alive && (msg.dir === 1 || msg.dir === -1)) cycleSpectate(game, p, msg.dir);
          break;
        case "flask":
          if (p.joined) game.useFlask(p, msg.i);
          break;
        // Skills (server/skills.ts)
        case "socket":
          if (p.joined) this.report(p, game.skills.socket(p, msg.id, msg.slot, msg.sup, autoPlace, msg.inner));
          break;
        case "unsocket":
          if (p.joined) this.report(p, game.skills.unsocket(p, msg.slot, msg.sup, autoPlace, msg.inner));
          break;
        case "cut":
          if (p.joined) this.report(p, game.skills.cut(p, msg.id, msg.gem, msg.target, autoPlace));
          break;
        case "useCurrency": // Embers / runes / ichors / Awl onto an item (server/crafting.ts via lootsys)
          if (p.joined) handleCraft(p, { cur: msg.id, target: msg.on });
          break;
        case "charm": // manual charm use (server/charms.ts via lootsys)
          handleCharm(p, msg.i);
          break;
        // Progression (server/progression.ts)
        case "alloc":
          if (p.joined) this.report(p, allocate(p, msg.id));
          break;
        case "ascalloc":
          if (p.joined) this.report(p, allocateAsc(p, msg.id));
          break;
        case "ascend":
          if (p.joined) this.report(p, chooseAscendancy(p, msg.id));
          break;
        case "jewel":
          if (p.joined) this.report(p, socketJewel(p, msg.node, msg.id));
          break;
        case "trial":
          if (p.joined) this.report(p, activateTrial(p));
          break;
        case "dev":
          if (this.dev && p.joined && !damageDevCommand(game, p, msg)) game.devCommand(p, msg); // ail / meters / es: server/damage.ts
          break;
        case "chat": // in-match chat (menus/ingame.ts)
          if (p.joined) this.chat(conn, p, msg);
          break;
        case "shop": { // Breachway Quartermaster (server/modes/lanes.ts)
          const err = game.lanes?.shop(p, msg) ?? "No shop here";
          if (err) game.toast(p, err);
          break;
        }
        case "ping":
          if (isNum(msg.c)) this.send(conn, { t: "pong", c: msg.c });
          break;
      }
    } catch (err) {
      console.error("message handling error:", err);
    }
  }

  // ---- chat -------------------------------------------------------------------------
  /** Per-connection token bucket: 5 lines burst, one more every 1.5 s. */
  private chatTokens = new WeakMap<HostConn, { n: number; t: number }>();

  /**
   * Relay one chat line. Royale rule: once the fight is on, a dead player is a ghost and only other
   * dead players (spectators) hear them, so nobody can call out positions to the living.
   * `to` whispers one player by name; `item` links a carried item (copied here, never trusted).
   */
  private chat(conn: HostConn, p: ServerPlayer, msg: Record<string, unknown>) {
    const sys = (text: string) => this.send(conn, { t: "chat", from: "", text, ch: "sys" });
    if (typeof msg.text !== "string") return;
    const now = Date.now();
    const b = this.chatTokens.get(conn) ?? { n: 5, t: now };
    b.n = Math.min(5, b.n + (now - b.t) / 1500);
    b.t = now;
    this.chatTokens.set(conn, b);
    if (b.n < 1) return sys("Slow down.");
    b.n -= 1;
    const text = sanitizeName(msg.text, CHAT_MAX);
    if (text === "Player" && msg.text.trim() !== "Player") return;
    const linked = msg.item !== undefined ? carriedItem(p, msg.item) : null;
    const item = linked ? (JSON.parse(JSON.stringify(linked)) as ChatMsg["item"]) : undefined;
    const ghost = !p.alive && this.game.phase === "fight";
    const hears = (o: ServerPlayer) => o.joined && (!ghost || !o.alive);
    if (typeof msg.to === "string" && msg.to.trim()) {
      const want = sanitizeName(msg.to).toLowerCase();
      let target: [HostConn, ServerPlayer] | null = null;
      for (const e of this.conns) if (e[1].joined && e[1].name.toLowerCase() === want) target = e;
      if (!target) return sys(`No one called ${sanitizeName(msg.to)} is in this match.`);
      if (target[1] === p) return sys("You whisper to yourself.");
      if (!hears(target[1])) return sys("The living cannot hear the dead.");
      this.send(target[0], { t: "chat", from: p.name, text, ch: "w", ...(item ? { item } : {}) });
      this.send(conn, { t: "chat", from: p.name, text, ch: "w", to: target[1].name, ...(item ? { item } : {}) });
      return;
    }
    const out: ChatMsg = { t: "chat", from: p.name, text, ch: ghost ? "spec" : "all", ...(item ? { item } : {}) };
    for (const [c, o] of this.conns) if (hears(o)) this.send(c, out);
  }

  /** One 30 Hz server tick: simulate, then send every client its messages + snapshot. */
  tick() {
    const game = this.game;
    game.update();
    const events = JSON.stringify(game.takeEvents());
    const snaps = buildSnapshots(game, events);
    for (const [conn, p] of this.conns) {
      if (!p.joined || !conn.open) continue;
      // Map params go out first (on join and whenever the match map changes); the client regenerates it.
      if (this.mapSent.get(conn) !== game.mapVersion) {
        this.mapSent.set(conn, game.mapVersion);
        const mp = game.mapParams;
        this.send(conn, { t: "map", seed: mp.seed, players: mp.players, biome: mp.biome ?? "", v: game.mapVersion, ...(mp.mode ? { mode: mp.mode } : {}) });
      }
      // Stats and inventory go out before the snap so the client predicts with the new values.
      if (!p.sentStats || !statsEqual(p.sentStats, p.stats)) {
        p.sentStats = { ...p.stats };
        this.send(conn, { t: "stats", stats: p.sentStats });
      }
      if (p.invDirty) {
        p.invDirty = false;
        this.send(conn, invMessage(p));
      }
      for (const id of p.noRoom.splice(0)) this.send(conn, { t: "noroom", id });
      for (const m of progOutbox(p)) this.send(conn, m);
      for (const m of takeSkillMsgs(p)) this.send(conn, m); // skill bar / cooldowns
      for (const text of game.toasts.get(p.id) ?? []) this.send(conn, { t: "toast", text });
      // monsters agent: buff-shrine state + this player's shrine buff, twice a second
      if (game.tick % 15 === 0) this.send(conn, { t: "bshrine", list: shrineSnap(), buff: buffOf(p.id) });
      if (game.lanes && game.tick % 6 === 3) this.send(conn, game.lanes.hud(p)); // Breachway HUD, 5 Hz
      const snap = snaps.get(p);
      if (snap) conn.send(snap, false);
    }
    game.toasts.clear();
  }
}
