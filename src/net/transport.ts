// Transport abstraction shared by every way of reaching the authoritative game:
//   - Node `ws` (dedicated / dev server, headless tests)      -> src/server/index.ts
//   - WebRTC DataChannels (peer-to-peer, host-in-browser)     -> src/net/rtc*.ts
//   - in-memory / worker loopback (the host plays in its tab) -> src/net/loopback.ts, src/net/hostbridge.ts
// Messages are JSON strings. `reliable` picks the channel: snapshots and inputs may go over an
// unordered, unreliable channel (stale data is useless anyway); everything else is reliable + ordered.

/** The server's view of one connected client. */
export interface HostConn {
  /** Send one JSON message. reliable=false allows drop / reorder (snapshots). */
  send(data: string, reliable?: boolean): void;
  /** Close the connection (the transport reports it back via its own close path). */
  close(reason?: string): void;
  readonly open: boolean;
}

/** The client's view of its connection to the host. */
export interface ClientConn {
  send(data: string, reliable?: boolean): void;
  close(): void;
  readonly open: boolean;
  onMessage: (data: string) => void;
  onClose: (reason: string) => void;
  /** True when unreliable messages may arrive out of order (the client then drops stale snapshots). */
  readonly unordered?: boolean;
}

/** Messages that may travel on the unreliable channel. */
export const isUnreliableType = (t: unknown) => t === "snap" || t === "input";
