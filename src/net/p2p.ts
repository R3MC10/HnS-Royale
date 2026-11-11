// Serverless rooms (same idea as Retro Arena): no own server, no tunnel, no link.
//  - Signalling + discovery go through Trystero over public Nostr relays (STUN only, no TURN).
//  - A shared "lobby" room: every open hall advertises itself there (code + metadata); the room
//    browser lists those ads.
//  - Each hall is its own Trystero room "game-<code>". The host greets every peer with "hi"; a guest
//    answers "join" with two SCTP stream ids, and both sides open the game's two data channels
//    (negotiated, so no extra signalling) on the RTCPeerConnection Trystero already made:
//    "rel" ordered + reliable, "fast" unordered with no retransmits (src/net/rtc.ts sendOnLink).
//  - Desktop app only (window.HNS_LAN, electron/preload.cjs): a UDP beacon lists halls on the local
//    network, and the host's app runs a small WebSocket relay hub so LAN guests connect with no
//    internet at all. Browsers use the relays only.
import { joinRoom, type Room } from "trystero";
import type { LobbyMeta } from "./lobbyproto";
import { sendOnLink } from "./rtc";
import type { ClientConn } from "./transport";

export const APP_ID = "hns-royale-r3mc10-v1";
/** Every client must use the same relays (picked from Trystero's list by APP_ID): 8 instead of the
 *  default 5, so a couple of dead public relays don't split players apart. */
const CFG = { appId: APP_ID, relayConfig: { redundancy: 8 } };
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const newCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
export const cleanCode = (c: string) => String(c).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
const gameRoom = (code: string) => `game-${code.toLowerCase()}`;

const AD_EVERY_MS = 2000;
const AD_EXPIRE_MS = 7000;
const FIND_HOST_MS = 25000;
const OPEN_MS = 12000;
const HOST_GONE_MS = 4000;

// ---- desktop-app LAN bridge (electron/preload.cjs) -------------------------------------------

export interface LanBridge {
  setBeacon(d: unknown): void;
  onBeacon(cb: (m: { ip: string; d: { id?: string; c?: string; m?: LobbyMeta; port?: number } }) => void): void;
  hubStart(): Promise<{ port: number; token: string }>;
  hubStop(): Promise<void>;
}
export const lan: LanBridge | null = (() => {
  try {
    return ((window as unknown as { HNS_LAN?: LanBridge }).HNS_LAN ?? null) as LanBridge | null;
  } catch {
    return null;
  }
})();

// ---- lobby: room list ----------------------------------------------------------------------

/** One open hall as the room browser shows it. */
export interface RoomAd {
  code: string;
  meta: LobbyMeta;
  /** ms round trip to the host over WebRTC (relay-found halls), when measured. */
  ping?: number;
  /** Found on the local network (desktop app): the host's IP + relay hub port. */
  lan?: { ip: string; port: number };
}

type AdMsg = { c: string; m: LobbyMeta; port?: number };

class Lobby {
  private room: Room | null = null;
  private send: ((d: AdMsg | null, target?: string) => void) | null = null;
  private net = new Map<string, { ad: AdMsg; t: number; ping?: number }>(); // by Trystero peer id
  private lanAds = new Map<string, { ad: AdMsg; ip: string; t: number }>(); // by app instance id
  private mine: AdMsg | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  readonly lanId = Math.random().toString(36).slice(2, 10);
  /** Set when joining the relays threw (no WebRTC / crypto here). */
  error = "";

  ensure() {
    if (this.room || this.error) return;
    try {
      const room = joinRoom(CFG, "lobby");
      this.room = room;
      const ad = room.makeAction("ad");
      ad.onMessage = (raw, { peerId }) => {
        const d = raw as unknown as AdMsg | null;
        if (d && typeof d.c === "string" && d.m && typeof d.m === "object") this.net.set(peerId, { ad: { c: cleanCode(d.c), m: d.m, port: d.port }, t: Date.now(), ping: this.net.get(peerId)?.ping });
        else this.net.delete(peerId);
      };
      this.send = (d, target) => void ad.send(d as never, target ? { target } : undefined).catch(() => {});
      room.onPeerJoin = (p) => this.mine && this.send?.(this.mine, p);
      room.onPeerLeave = (p) => this.net.delete(p);
    } catch (err) {
      this.error = `Online rooms are unavailable here: ${(err as Error).message}`;
      return;
    }
    if (lan)
      lan.onBeacon(({ ip, d }) => {
        if (!d || d.id === this.lanId) return;
        if (typeof d.c !== "string" || !d.m) {
          if (d.id) this.lanAds.delete(d.id);
          return;
        }
        this.lanAds.set(d.id ?? ip, { ad: { c: cleanCode(d.c), m: d.m, port: d.port }, ip, t: Date.now() });
      });
    this.timer = setInterval(() => {
      if (this.mine) this.send?.(this.mine);
    }, AD_EVERY_MS);
  }

  /** Host: publish (or update / withdraw with null) this tab's hall. */
  advertise(ad: AdMsg | null) {
    this.ensure();
    const was = this.mine;
    this.mine = ad;
    if (ad || was) this.send?.(ad);
    lan?.setBeacon(ad ? { id: this.lanId, ...ad } : { id: this.lanId });
  }

  /** Open halls (relay ads + LAN beacons merged by code). Also pings relay hosts for the next call. */
  list(): RoomAd[] {
    this.ensure();
    const now = Date.now();
    const out = new Map<string, RoomAd>();
    for (const [peer, e] of this.net) {
      if (now - e.t > AD_EXPIRE_MS) {
        this.net.delete(peer);
        continue;
      }
      out.set(e.ad.c, { code: e.ad.c, meta: e.ad.m, ping: e.ping });
      void this.room
        ?.ping(peer)
        .then((ms) => {
          const cur = this.net.get(peer);
          if (cur) cur.ping = Math.round(ms);
        })
        .catch(() => {});
    }
    for (const [id, e] of this.lanAds) {
      if (now - e.t > 4000) {
        this.lanAds.delete(id);
        continue;
      }
      const prev = out.get(e.ad.c);
      out.set(e.ad.c, { code: e.ad.c, meta: e.ad.m, ping: prev?.ping, lan: e.ad.port ? { ip: e.ip, port: e.ad.port } : undefined });
    }
    return [...out.values()].filter((r) => r.code.length === 5 && r.code !== this.mine?.c);
  }

  findLan(code: string): { ip: string; port: number } | null {
    for (const e of this.lanAds.values()) if (e.ad.c === code && e.ad.port && Date.now() - e.t < 4000) return { ip: e.ip, port: e.ad.port };
    return null;
  }
}

export const lobby = new Lobby();

// ---- negotiated game channels on a Trystero peer connection ---------------------------------

/** Pick a fresh pair of SCTP stream ids (Trystero's own channel uses the low ids). */
const pickIds = (): [number, number] => {
  const a = 200 + 2 * Math.floor(Math.random() * 300);
  return [a, a + 1];
};

function openChannels(pc: RTCPeerConnection, ids: [number, number]) {
  const rel = pc.createDataChannel(`hns-rel-${ids[0]}`, { negotiated: true, id: ids[0], ordered: true });
  const fast = pc.createDataChannel(`hns-fast-${ids[1]}`, { negotiated: true, id: ids[1], ordered: false, maxRetransmits: 0 });
  return { rel, fast };
}

const closeQuiet = (...xs: (RTCDataChannel | WebSocket | null | undefined)[]) => {
  for (const x of xs)
    try {
      x?.close();
    } catch {
      /* ignore */
    }
};

// ---- host side ------------------------------------------------------------------------------

/** One guest as the host sees it (relay WebRTC or LAN hub). */
export interface HostLink {
  send(d: string, reliable: boolean): void;
  close(): void;
}

export interface HostRoomEvents {
  /** A guest's channels are open: start treating it as a player. */
  onOpen(key: string, link: HostLink): void;
  onMessage(key: string, d: string): void;
  onClose(key: string): void;
}

/** Host: open hall `code` on the relays (and the LAN hub in the desktop app). */
export class HostRoom {
  private room: Room | null = null;
  private hub: WebSocket | null = null;
  private hubPort = 0;
  private guests = new Map<string, { rel: RTCDataChannel; fast: RTCDataChannel; open: boolean }>();
  private stopped = false;
  /** Human-readable problem (shown in the hall chat). */
  onProblem: (text: string) => void = () => {};

  constructor(
    readonly code: string,
    private ev: HostRoomEvents,
  ) {}

  async start(): Promise<void> {
    lobby.ensure();
    if (lobby.error) throw new Error(lobby.error);
    const room = joinRoom(CFG, gameRoom(this.code));
    this.room = room;
    const hi = room.makeAction<number>("hi");
    const ok = room.makeAction<number>("ok");
    const join = room.makeAction<[number, number]>("join");
    room.onPeerJoin = (p) => void hi.send(1, { target: p }).catch(() => {});
    room.onPeerLeave = (p) => this.drop(`n:${p}`);
    join.onMessage = (ids, { peerId }) => {
      if (this.stopped || !Array.isArray(ids) || ids.length !== 2) return;
      const pc = room.getPeers()[peerId];
      if (!pc) return;
      const key = `n:${peerId}`;
      this.drop(key); // a guest that rejoins gets fresh channels
      let ch: { rel: RTCDataChannel; fast: RTCDataChannel };
      try {
        ch = openChannels(pc, [ids[0] | 0, ids[1] | 0]);
      } catch (err) {
        console.warn("host: data channels failed", err);
        return;
      }
      const g = { ...ch, open: false };
      this.guests.set(key, g);
      const ready = () => {
        if (g.open || this.guests.get(key) !== g) return;
        g.open = true;
        this.ev.onOpen(key, { send: (d, r) => sendOnLink(g, d, r), close: () => this.drop(key) });
        void ok.send(1, { target: peerId }).catch(() => {});
      };
      const onMsg = (e: MessageEvent) => g.open && typeof e.data === "string" && this.ev.onMessage(key, e.data);
      g.rel.onmessage = onMsg;
      g.fast.onmessage = onMsg;
      g.rel.onclose = () => this.drop(key);
      if (g.rel.readyState === "open") ready();
      else g.rel.onopen = ready;
    };
    if (lan) {
      try {
        const { port, token } = await lan.hubStart();
        this.hubPort = port;
        this.connectHub(port, token);
      } catch (err) {
        console.warn("LAN hub unavailable", err);
      }
    }
  }

  /** Desktop app: the relay hub on this PC (electron/main.mjs) passes LAN guests' messages to us. */
  private connectHub(port: number, token: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?host=${encodeURIComponent(token)}`);
    this.hub = ws;
    ws.onmessage = (e) => {
      let m: { t: string; id: number; d?: string };
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      const key = `l:${m.id}`;
      if (m.t === "open") this.ev.onOpen(key, { send: (d) => this.hubSend({ t: "send", id: m.id, d }), close: () => this.hubSend({ t: "close", id: m.id }) });
      else if (m.t === "msg" && typeof m.d === "string") this.ev.onMessage(key, m.d);
      else if (m.t === "close") this.ev.onClose(key);
    };
    ws.onclose = () => {
      if (!this.stopped && this.hub === ws) this.onProblem("The local network relay stopped: players on your network join over the internet relays instead.");
    };
  }

  private hubSend(m: unknown) {
    if (this.hub?.readyState === WebSocket.OPEN) this.hub.send(JSON.stringify(m));
  }

  /** Lobby ad for this hall. */
  ad(meta: LobbyMeta): AdMsg {
    return { c: this.code, m: meta, ...(this.hubPort ? { port: this.hubPort } : {}) };
  }

  private drop(key: string) {
    const g = this.guests.get(key);
    if (!g) return;
    this.guests.delete(key);
    closeQuiet(g.rel, g.fast);
    if (g.open) this.ev.onClose(key);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    for (const k of [...this.guests.keys()]) this.drop(k);
    closeQuiet(this.hub);
    this.hub = null;
    if (this.hubPort) void lan?.hubStop().catch(() => {});
    void this.room?.leave().catch(() => {});
    this.room = null;
  }
}

// ---- guest side -----------------------------------------------------------------------------

/** Guest: reach hall `code` (LAN hub first in the desktop app, else the relays). */
export async function joinByCode(code: string, onStep: (text: string) => void = () => {}): Promise<ClientConn> {
  code = cleanCode(code);
  lobby.ensure();
  const near = lobby.findLan(code);
  if (near) {
    try {
      return await joinHub(near.ip, near.port);
    } catch {
      /* fall back to the relays */
    }
  }
  if (lobby.error) throw new Error(lobby.error);
  return joinRelay(code, onStep);
}

function joinHub(ip: string, port: number): Promise<ClientConn> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${ip}:${port}/`);
    let isOpen = false;
    const conn: ClientConn = {
      get open() {
        return isOpen;
      },
      send: (d) => ws.readyState === WebSocket.OPEN && ws.send(d),
      close: () => {
        if (!isOpen) return;
        isOpen = false;
        closeQuiet(ws);
      },
      onMessage: () => {},
      onClose: () => {},
    };
    const t = setTimeout(() => {
      closeQuiet(ws);
      reject(new Error("LAN host did not answer."));
    }, 3000);
    ws.onopen = () => {
      clearTimeout(t);
      isOpen = true;
      resolve(conn);
    };
    ws.onmessage = (e) => isOpen && conn.onMessage(String(e.data));
    ws.onerror = () => !isOpen && (clearTimeout(t), reject(new Error("LAN host did not answer.")));
    ws.onclose = () => {
      if (!isOpen) return;
      isOpen = false;
      conn.onClose("The host left the room.");
    };
  });
}

function joinRelay(code: string, onStep: (text: string) => void): Promise<ClientConn> {
  const room = joinRoom(CFG, gameRoom(code));
  const hi = room.makeAction<number>("hi");
  const ok = room.makeAction<number>("ok");
  const join = room.makeAction<[number, number]>("join");
  let host = "";
  let ch: { rel: RTCDataChannel; fast: RTCDataChannel } | null = null;
  let isOpen = false;
  let done = false;
  const early: string[] = [];
  let goneTimer: ReturnType<typeof setTimeout> | null = null;

  const conn: ClientConn = {
    unordered: true,
    get open() {
      return isOpen;
    },
    send: (d, reliable = true) => ch && sendOnLink(ch, d, reliable),
    close: () => shut(""),
    onMessage: () => {},
    onClose: () => {},
  };
  function shut(reason: string) {
    if (done) return;
    done = true;
    const was = isOpen;
    isOpen = false;
    if (goneTimer) clearTimeout(goneTimer);
    closeQuiet(ch?.rel, ch?.fast);
    void room.leave().catch(() => {});
    if (was && reason) conn.onClose(reason);
  }

  onStep("Looking for the host…");
  return new Promise<ClientConn>((resolve, reject) => {
    const fail = (msg: string) => {
      clearTimeout(timer);
      shut("");
      reject(new Error(msg));
    };
    let timer = setTimeout(
      () => fail(`No host answered for room ${code}. Check the code; if it is right, your network or the host's may block direct connections.`),
      FIND_HOST_MS,
    );
    hi.onMessage = (_d, { peerId }) => {
      if (host || done) return;
      const pc = room.getPeers()[peerId];
      if (!pc) return;
      host = peerId;
      onStep("Connecting to the host…");
      const ids = pickIds();
      try {
        ch = openChannels(pc, ids);
      } catch (err) {
        return fail(`Could not open a connection to the host (${(err as Error).message}).`);
      }
      const onMsg = (e: MessageEvent) => {
        if (typeof e.data !== "string") return;
        if (isOpen) conn.onMessage(e.data);
        else early.push(e.data);
      };
      ch.rel.onmessage = onMsg;
      ch.fast.onmessage = onMsg;
      ch.rel.onclose = () => (isOpen ? shut("The host left the room.") : fail("The host closed the connection."));
      clearTimeout(timer);
      timer = setTimeout(() => fail("The host was found but the connection did not open. One of you may be behind a strict network (no TURN relay)."), OPEN_MS);
      void join.send(ids, { target: peerId }).catch(() => {});
    };
    ok.onMessage = (_d, { peerId }) => {
      if (peerId !== host || isOpen || done || !ch) return;
      const ready = () => {
        if (isOpen || done) return;
        clearTimeout(timer);
        isOpen = true;
        resolve(conn);
        // Messages that raced the "ok" go out once the caller has attached its handler.
        setTimeout(() => {
          for (const d of early.splice(0)) if (isOpen) conn.onMessage(d);
        }, 0);
      };
      if (ch.rel.readyState === "open") ready();
      else ch.rel.onopen = ready;
    };
    room.onPeerJoin = (p) => {
      if (p === host && goneTimer) {
        clearTimeout(goneTimer);
        goneTimer = null;
      }
    };
    room.onPeerLeave = (p) => {
      if (p !== host) return;
      if (!isOpen) return fail("The host left the room.");
      // A short blip may come back; after HOST_GONE_MS the host is gone.
      goneTimer ??= setTimeout(() => shut("The host left the room."), HOST_GONE_MS);
    };
  });
}
