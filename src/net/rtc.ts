// WebRTC DataChannel transport. Two channels per peer:
//   "rel"  ordered + reliable    : events, inventory, stats, chat, lobby room
//   "fast" unordered, 0 retransmits: snapshots (host -> joiner) and inputs (joiner -> host)
// The host creates the channels and the offer; the joiner answers. SDP / ICE go through the lobby
// service (LobbyClient). Only public STUN by default: peers behind symmetric / strict NATs need a
// TURN server (configure HNS_ICE on the lobby service).
import type { LobbyClient } from "./lobbyclient";
import type { IceServer, LobbyServerMsg, SignalData } from "./lobbyproto";
import type { ClientConn } from "./transport";

/** Drop unreliable sends when this much is queued (a stale snapshot is worthless). */
const FAST_BUFFER_LIMIT = 64 * 1024;
const CONNECT_TIMEOUT_MS = 15000;

export interface PeerLink {
  pc: RTCPeerConnection;
  rel: RTCDataChannel;
  fast: RTCDataChannel | null;
}

export function sendOnLink(l: { rel: RTCDataChannel; fast: RTCDataChannel | null }, d: string, reliable: boolean) {
  if (!reliable && l.fast && l.fast.readyState === "open") {
    if (l.fast.bufferedAmount < FAST_BUFFER_LIMIT) l.fast.send(d);
    return;
  }
  if (l.rel.readyState === "open") l.rel.send(d);
}

function iceOut(c: RTCIceCandidate | null): SignalData {
  return { ice: c ? { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex } : null };
}

async function applySignal(pc: RTCPeerConnection, data: SignalData, pending: RTCIceCandidateInit[]) {
  if ("sdp" in data) {
    await pc.setRemoteDescription(data.sdp as RTCSessionDescriptionInit);
    for (const c of pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});
    return true;
  }
  if (data.ice) {
    const c: RTCIceCandidateInit = { candidate: data.ice.candidate, sdpMid: data.ice.sdpMid ?? undefined, sdpMLineIndex: data.ice.sdpMLineIndex ?? undefined };
    if (pc.remoteDescription) await pc.addIceCandidate(c).catch(() => {});
    else pending.push(c);
  }
  return false;
}

// ---- host side ----------------------------------------------------------------------------

export interface HostPeerEvents {
  onOpen: () => void;
  onMessage: (d: string) => void;
  onClose: () => void;
}

/** Host: answer a joiner announced by the lobby service with {t:"peer"}. */
export function hostPeer(lobby: LobbyClient, peer: string, ice: IceServer[], ev: HostPeerEvents): { link: PeerLink; signal: (d: SignalData) => void; close: () => void } {
  const pc = new RTCPeerConnection({ iceServers: ice as RTCIceServer[] });
  const rel = pc.createDataChannel("rel", { ordered: true });
  const fast = pc.createDataChannel("fast", { ordered: false, maxRetransmits: 0 });
  const link: PeerLink = { pc, rel, fast };
  const pending: RTCIceCandidateInit[] = [];
  let opened = false;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    try {
      pc.close();
    } catch {
      /* ignore */
    }
    if (opened) ev.onClose();
  };
  const timer = setTimeout(() => !opened && close(), CONNECT_TIMEOUT_MS);
  pc.onicecandidate = (e) => lobby.send({ t: "signal", to: peer, data: iceOut(e.candidate) });
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") close();
  };
  rel.onopen = () => {
    opened = true;
    clearTimeout(timer);
    ev.onOpen();
  };
  rel.onclose = close;
  rel.onmessage = (e) => typeof e.data === "string" && ev.onMessage(e.data);
  fast.onmessage = (e) => typeof e.data === "string" && ev.onMessage(e.data);
  (async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    lobby.send({ t: "signal", to: peer, data: { sdp: { type: offer.type, sdp: offer.sdp ?? "" } } });
  })().catch(close);
  return { link, signal: (d) => void applySignal(pc, d, pending).catch(close), close };
}

// ---- joiner side --------------------------------------------------------------------------

/** Joiner: connect to a lobby's host. Resolves with an open ClientConn. */
export async function joinLobby(lobby: LobbyClient, lobbyId: string): Promise<ClientConn> {
  await lobby.connect();
  const pc = new RTCPeerConnection({ iceServers: lobby.ice as RTCIceServer[] });
  const pending: RTCIceCandidateInit[] = [];
  let rel: RTCDataChannel | null = null;
  let fast: RTCDataChannel | null = null;
  let isOpen = false;

  const conn: ClientConn = {
    unordered: true,
    get open() {
      return isOpen;
    },
    send: (d, reliable = true) => rel && sendOnLink({ rel, fast }, d, reliable),
    close: () => shut("closed"),
    onMessage: () => {},
    onClose: () => {},
  };
  let shutDone = false;
  function shut(reason: string) {
    if (shutDone) return;
    shutDone = true;
    const was = isOpen;
    isOpen = false;
    try {
      pc.close();
    } catch {
      /* ignore */
    }
    if (was) conn.onClose(reason);
  }

  return new Promise<ClientConn>((resolve, reject) => {
    const fail = (msg: string) => {
      off();
      clearTimeout(timer);
      shut(msg);
      reject(new Error(msg));
    };
    const timer = setTimeout(() => fail("Could not reach the host. One of you may be behind a strict NAT (needs a TURN server)."), CONNECT_TIMEOUT_MS);
    const off = lobby.on((m: LobbyServerMsg) => {
      if (m.t === "signal" && m.from === "host") {
        void (async () => {
          const isOffer = await applySignal(pc, m.data, pending);
          if (isOffer) {
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            lobby.send({ t: "signal", to: "host", data: { sdp: { type: ans.type, sdp: ans.sdp ?? "" } } });
          }
        })().catch(() => fail("WebRTC negotiation failed."));
      } else if (m.t === "error" && (m.code === "nolobby" || m.code === "self" || m.code === "busy")) {
        fail(m.text);
      }
    });
    pc.onicecandidate = (e) => lobby.send({ t: "signal", to: "host", data: iceOut(e.candidate) });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") (isOpen ? shut("The connection to the host failed.") : fail("The connection to the host failed."));
      else if (pc.connectionState === "closed" && isOpen) shut("The host left.");
    };
    pc.ondatachannel = (e) => {
      const ch = e.channel;
      ch.onmessage = (ev) => isOpen && typeof ev.data === "string" && conn.onMessage(ev.data);
      if (ch.label === "fast") fast = ch;
      if (ch.label === "rel") {
        rel = ch;
        ch.onclose = () => shut("The host left.");
        const ready = () => {
          isOpen = true;
          off();
          clearTimeout(timer);
          resolve(conn);
        };
        if (ch.readyState === "open") ready();
        else ch.onopen = ready;
      }
    };
    lobby.send({ t: "join", id: lobbyId });
  });
}
