// Client connection to the authoritative game. Transport-agnostic (src/net/transport.ts):
//   - connect(): WebSocket to this page's server (dedicated / dev mode)
//   - attach(conn): any ClientConn (P2P WebRTC to a host, or the host's own loopback)
// Lobby-room messages ("r-*") go to onRoom; everything else to onMessage (main.ts).
import type { ClientMsg, ServerMsg } from "../shared/protocol";
import { isUnreliableType, type ClientConn } from "../net/transport";
import { isRoomMsg, type RoomServerMsg } from "../net/roomproto";

/** Inputs re-sent with every unreliable batch so one lost packet doesn't lose movement. */
const INPUT_REDUNDANCY = 6;

function wsConn(url: string): ClientConn {
  const ws = new WebSocket(url);
  const conn: ClientConn = {
    get open() {
      return ws.readyState === WebSocket.OPEN;
    },
    send: (d) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(d);
    },
    close: () => ws.close(),
    onMessage: () => {},
    onClose: () => {},
  };
  (conn as { ws?: WebSocket }).ws = ws;
  ws.onmessage = (e) => conn.onMessage(e.data as string);
  ws.onclose = () => conn.onClose("closed");
  return conn;
}

export class Net {
  private conn: ClientConn | null = null;
  private lastSnapTick = -1;
  private recentInputs: { seq: number }[] = [];
  onMessage: (msg: ServerMsg) => void = () => {};
  onOpen: () => void = () => {};
  onClose: () => void = () => {};
  /** Lobby-room messages (P2P). */
  onRoom: (msg: RoomServerMsg) => void = () => {};
  /** Why the last connection closed (transport reason). */
  closeReason = "";
  /** "ws" (dedicated server), "p2p" (WebRTC joiner) or "host" (own loopback). */
  mode: "ws" | "p2p" | "host" | "none" = "none";

  get connected() {
    return !!this.conn?.open;
  }

  /** Dedicated server mode: WebSocket to this page's origin. */
  connect() {
    if (this.conn && this.mode === "ws") return;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const c = wsConn(`${proto}//${location.host}`);
    const ws = (c as { ws?: WebSocket }).ws!;
    ws.addEventListener("open", () => this.onOpen());
    this.bind(c, "ws");
  }

  /** Use an already-open transport (WebRTC to a host, or the host's loopback). */
  attach(conn: ClientConn, mode: "p2p" | "host") {
    this.bind(conn, mode);
    this.onOpen();
  }

  /** Drop the current connection without firing onClose. */
  detach() {
    const c = this.conn;
    this.conn = null;
    this.mode = "none";
    if (c) {
      c.onClose = () => {};
      c.onMessage = () => {};
      c.close();
    }
  }

  /** Close the connection (fires onClose). */
  close() {
    this.conn?.close();
  }

  /** A new match on the same connection: forget per-match sequence state. */
  resetMatch() {
    this.lastSnapTick = -1;
    this.recentInputs = [];
  }

  private bind(c: ClientConn, mode: Net["mode"]) {
    if (this.conn && this.conn !== c) this.detach();
    this.conn = c;
    this.mode = mode;
    this.resetMatch();
    c.onClose = (reason) => {
      if (this.conn !== c) return;
      this.conn = null;
      this.mode = "none";
      this.closeReason = reason;
      this.onClose();
    };
    c.onMessage = (data) => {
      let msg: ServerMsg | RoomServerMsg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      if (isRoomMsg(msg.t)) return this.onRoom(msg as RoomServerMsg);
      if (msg.t === "snap" && c.unordered) {
        // Unordered channel: never step back to an older snapshot.
        if (msg.tick <= this.lastSnapTick) return;
        this.lastSnapTick = msg.tick;
      }
      this.onMessage(msg as ServerMsg);
    };
  }

  send(msg: ClientMsg) {
    const c = this.conn;
    if (!c?.open) return;
    if (msg.t === "input" && c.unordered) {
      // Lossy channel: resend the last few inputs too (the server drops seqs it already has).
      const cmds = msg.cmds;
      const merged = [...this.recentInputs.filter((r) => !cmds.some((x) => x.seq === r.seq)), ...cmds];
      this.recentInputs = merged.slice(-INPUT_REDUNDANCY);
      c.send(JSON.stringify({ t: "input", cmds: merged.slice(-Math.max(INPUT_REDUNDANCY, cmds.length)) }), false);
      return;
    }
    c.send(JSON.stringify(msg), !isUnreliableType(msg.t));
  }

  /** Raw send (lobby-room messages). */
  sendRaw(msg: { t: string; [k: string]: unknown }) {
    if (this.conn?.open) this.conn.send(JSON.stringify(msg), true);
  }
}
