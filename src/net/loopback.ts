// In-memory loopback transport: a HostConn / ClientConn pair in the same JS realm. Messages are
// delivered asynchronously (microtask) like a real network, so neither side re-enters the other.
// Used by headless tests; the browser host uses the same idea across its Worker boundary
// (src/net/hostbridge.ts).
import type { ClientConn, HostConn } from "./transport";

export interface LoopbackHostSide {
  onMessage: (data: string) => void;
  onClose: () => void;
}

export function loopbackPair(): { client: ClientConn; host: HostConn; hostSide: LoopbackHostSide } {
  let open = true;
  const hostSide: LoopbackHostSide = { onMessage: () => {}, onClose: () => {} };
  const shut = (reason: string) => {
    if (!open) return;
    open = false;
    queueMicrotask(() => {
      hostSide.onClose();
      client.onClose(reason);
    });
  };
  const client: ClientConn = {
    get open() {
      return open;
    },
    send: (data) => {
      if (open) queueMicrotask(() => open && hostSide.onMessage(data));
    },
    close: () => shut("closed"),
    onMessage: () => {},
    onClose: () => {},
  };
  const host: HostConn = {
    get open() {
      return open;
    },
    send: (data) => {
      if (open) queueMicrotask(() => open && client.onMessage(data));
    },
    close: (reason) => shut(reason ?? "closed"),
  };
  return { client, host, hostSide };
}
