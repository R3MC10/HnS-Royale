// HUD state (core package): what the HUD remembers between snapshots.
import type { InvMsg, SelfHud, ServerMsg, SnapMsg } from "../../shared/protocol";
import type { ProgMsg } from "../../shared/progression";
import { MONSTER_BY_ID } from "../../shared/content/monsters";

export interface KillFeedEntry {
  t: number; // client seconds when added (performance.now()/1000)
  kind: "kill" | "info";
  text?: string; // info lines
  killer?: string;
  victim?: string;
  kid?: number; // killer player id (absent: monster / environment)
  vid?: number;
  place?: number; // victim's placement
  mine: 0 | 1 | 2; // 1 = you killed, 2 = you died
  kr?: number; // monster killer rarity 0..3 (client lookup by name among visible monsters; absent = player / unknown)
}

/** One hit the local player took (death recap). */
export interface TakenHit {
  at: number; // client seconds
  by: string; // attacker display name
  pid?: number; // attacking player id (absent: monster / environment)
  dmg: number;
  ty?: string; // dominant damage type (shared/defence DamageType)
  dot: boolean;
  es?: number; // part absorbed by energy shield
  heavy: boolean; // >= 25% of max life in one hit
  rr?: number; // monster rarity when known
}

export interface HudState {
  selfId: number;
  me: SelfHud | null; // latest snap.me
  inv: InvMsg | null; // latest inv message
  prog: ProgMsg | null; // latest prog message
  feed: KillFeedEntry[]; // oldest first, max 6, entries older than 8 s pruned
  lastHit: { id: number; m: boolean; at: number } | null; // last entity the local player hit (at = client seconds)
  buffMax: Map<string, number>; // per buff id / "ail:<short>" / "flask<i>": max seconds seen since it appeared (bar denominators)
  fightStart: number; // client seconds when phase became "fight" (0 otherwise)
  matchSecs: number; // server match clock: seconds of fight played this round (-1 = not in a round)
  spirit: { used: number; total: number };
  elimAt: number; // client seconds when the local player died this round (0 = alive)
  joined: boolean; // in a match (main.ts joined, via hudFrame -> setHudJoined)
  taken: TakenHit[]; // last hits taken by the local player, oldest first (max 10)
}

const FEED_LIFE = 8;
const FEED_MAX = 6;

export const hudState: HudState = {
  selfId: -1,
  me: null,
  inv: null,
  prog: null,
  feed: [],
  lastHit: null,
  buffMax: new Map(),
  fightStart: 0,
  matchSecs: -1,
  spirit: { used: 0, total: 0 },
  elimAt: 0,
  joined: false,
  taken: [],
};

const TAKEN_MAX = 10;

/** hud/index.ts hudFrame: whether the client is in a match (HUD parts draw nothing otherwise). */
export function setHudJoined(j: boolean): void {
  hudState.joined = j;
}

let lastPhase = "";
let wasAlive: boolean | null = null;
let spiritProvider: (() => { used: number; total: number }) | null = null;

const nowS = () => performance.now() / 1000;

// Low-priority hints (server toasts prefixed HINT_PREFIX): one line in the left message log, held back
// while a boss bar or a round banner is up so they never join the top-centre pile.
const hints: string[] = [];
export function hudHint(text: string): void {
  hints.push(text);
}
/** Called once per frame by the killfeed part. */
export function hudFlushHints(blocked: boolean): void {
  if (blocked || !hints.length) return;
  pushFeed({ t: nowS(), kind: "info", text: hints.shift()!, mine: 0 });
}

function pushFeed(e: KillFeedEntry) {
  hudState.feed.push(e);
  while (hudState.feed.length > FEED_MAX) hudState.feed.shift();
}

/** main.ts net.onMessage, before the switch. Stores inv / prog. */
export function hudOnMessage(msg: ServerMsg): void {
  if (msg.t === "inv") hudState.inv = msg as InvMsg;
  else if (msg.t === "prog") hudState.prog = msg as ProgMsg;
}

/** main.ts onSnap, after selfId is known. Stores me, feeds the killfeed/lastHit from events, tracks fightStart/elimAt, refreshes buffMax. */
export function hudOnSnap(msg: SnapMsg, selfId: number): void {
  const s = hudState;
  const now = nowS();
  s.selfId = selfId;
  s.me = msg.me ?? null;
  // Match clock: the server's own count, so joining late, reconnecting or a host change can't restart it.
  // (Old recordings without `ft` fall back to the time since this client saw the fight start.)
  if (msg.phase !== "fight" && msg.phase !== "ended") s.matchSecs = -1;
  else if (msg.ft !== undefined) s.matchSecs = msg.ft;
  else if (msg.phase === "fight" && s.fightStart > 0) s.matchSecs = Math.floor(now - s.fightStart);

  // phase tracking
  if (msg.phase !== lastPhase) {
    if (msg.phase === "fight") {
      s.fightStart = now;
      s.elimAt = 0;
    } else if (msg.phase !== "ended") s.fightStart = 0;
    if (msg.phase === "countdown" || msg.phase === "waiting") s.elimAt = 0;
    lastPhase = msg.phase;
  }

  // self alive -> dead
  const self = msg.players.find((p) => p.id === selfId);
  if (self) {
    if (wasAlive === true && !self.alive && s.elimAt === 0) s.elimAt = now;
    if (self.alive && msg.phase !== "fight") s.elimAt = 0;
    wasAlive = self.alive;
  }

  // events
  for (const e of msg.events) {
    if (e.k === "kill") {
      const mine: 0 | 1 | 2 = e.kid !== undefined && e.kid === selfId ? 1 : e.vid === selfId ? 2 : 0;
      const kr = e.kid === undefined ? monsterRarityByName(msg, e.killer) : undefined;
      pushFeed({ t: now, kind: "kill", killer: e.killer, victim: e.victim, kid: e.kid, vid: e.vid, place: e.pl, mine, kr });
      if (e.vid === selfId && s.elimAt === 0 && msg.phase === "fight") s.elimAt = now;
    } else if (e.k === "info") {
      pushFeed({ t: now, kind: "info", text: e.text, mine: 0 });
    } else if (e.k === "hit") {
      if (e.by === selfId && e.target !== selfId && !e.dot) s.lastHit = { id: e.target, m: !!e.m, at: now };
      if (e.target === selfId && !e.m && e.dmg > 0) {
        const pl = e.by >= 0 ? msg.players.find((p) => p.id === e.by) : undefined;
        const name = pl ? pl.name : e.by >= 0 ? `Player ${e.by}` : e.sn ?? "Unknown";
        const mx = e.mx ?? self?.maxHp ?? 0;
        s.taken.push({
          at: now,
          by: name,
          pid: e.by >= 0 ? e.by : undefined,
          dmg: e.dmg,
          ty: e.ty,
          dot: !!e.dot,
          es: e.es,
          heavy: mx > 0 && e.dmg >= mx * 0.25,
          rr: e.by < 0 && e.sn ? monsterRarityByName(msg, e.sn) : undefined,
        });
        while (s.taken.length > TAKEN_MAX) s.taken.shift();
      }
    }
  }

  // buffMax: max seconds seen per id while present; absent ids are dropped
  const seen = new Set<string>();
  const note = (id: string, t: number) => {
    seen.add(id);
    const prev = s.buffMax.get(id) ?? 0;
    s.buffMax.set(id, Math.max(prev, t));
  };
  const me = s.me;
  if (me) {
    if (me.bf) for (const b of me.bf) note(b.id, b.t);
    if (me.fl) me.fl.forEach((t, i) => { if (t > 0) note("flask" + i, t); });
    if (me.am) for (const [k, t] of Object.entries(me.am)) if (typeof t === "number" && t > 0) note("ail:" + k, t);
  }
  for (const id of [...s.buffMax.keys()]) if (!seen.has(id)) s.buffMax.delete(id);
}

/** Rarity (0..3) of a visible monster whose display name matches `name`, else undefined. */
function monsterRarityByName(msg: SnapMsg, name: string | undefined): number | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase();
  for (const m of msg.monsters) {
    const mn = (m.n ?? MONSTER_BY_ID.get(m.k)?.name ?? m.k).toLowerCase();
    if (mn === n || n.includes(mn)) return m.rr ?? 0;
  }
  return undefined;
}

/** The bar package registers this (skillbar.ts knows the toggled spirit reservation). */
export function setSpiritProvider(fn: () => { used: number; total: number }): void {
  spiritProvider = fn;
}

/** Called per frame by hud/index.ts before drawing (pulls the spirit provider, prunes the feed). */
export function hudTick(now: number): void {
  const f = hudState.feed;
  while (f.length && now - f[0].t > FEED_LIFE) f.shift();
  while (f.length > FEED_MAX) f.shift();
  if (spiritProvider) {
    try {
      const sp = spiritProvider();
      hudState.spirit.used = sp.used;
      hudState.spirit.total = sp.total;
    } catch {
      /* provider not ready */
    }
  }
}

/** main.ts resetSession. */
export function hudReset(): void {
  const s = hudState;
  s.selfId = -1;
  s.me = null;
  s.inv = null;
  s.prog = null;
  s.feed.length = 0;
  hints.length = 0;
  s.lastHit = null;
  s.buffMax.clear();
  s.fightStart = 0;
  s.matchSecs = -1;
  s.spirit = { used: 0, total: 0 };
  s.elimAt = 0;
  s.joined = false;
  s.taken.length = 0;
  lastPhase = "";
  wasAlive = null;
}
