// WebRTC DataChannel helpers. Two channels per guest (opened in src/net/p2p.ts):
//   "rel"  ordered + reliable    : events, inventory, stats, chat, lobby room
//   "fast" unordered, 0 retransmits: snapshots (host -> guest) and inputs (guest -> host)

/** Drop unreliable sends when this much is queued (a stale snapshot is worthless). */
const FAST_BUFFER_LIMIT = 64 * 1024;

export function sendOnLink(l: { rel: RTCDataChannel; fast: RTCDataChannel | null }, d: string, reliable: boolean) {
  if (!reliable && l.fast && l.fast.readyState === "open") {
    if (l.fast.bufferedAmount < FAST_BUFFER_LIMIT) l.fast.send(d);
    return;
  }
  if (l.rel.readyState === "open") l.rel.send(d);
}
