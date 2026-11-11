// DEV-ONLY match recorder (Node only; never imported by the real server or the browser host).
// Wraps a HostConn and logs every message the host sends to that one client, stamped with a tick
// counter, as gzip text lines "<tick>\t<json>\n". Played back by the client's dev replay mode
// (src/client/devreplay.ts, ?dev=1&replay=<url>), which feeds the lines to the normal client
// exactly as if they came over the network: that player's camera, HUD, menus and results.
// JSON.stringify never emits a raw newline, so one message is always one line.
import { createWriteStream, type WriteStream } from "node:fs";
import { createGzip, constants as zc, type Gzip } from "node:zlib";
import type { HostConn } from "../net/transport";

export interface ConnRecording {
  /** The wrapped connection: hand this to the host instead of the raw one. */
  conn: HostConn;
  /** Gzip file being written. */
  file: string;
  /** Messages written so far. */
  count: number;
  /** Stop recording (later sends still go out, unrecorded). Resolves once the file is flushed. */
  stop(): Promise<void>;
}

/** Record everything sent to `inner` into `file` (gzip). `clock` gives the current tick. */
export function recordConn(inner: HostConn, file: string, clock: () => number): ConnRecording {
  const gz: Gzip = createGzip({ level: zc.Z_BEST_SPEED });
  const out: WriteStream = createWriteStream(file);
  gz.pipe(out);
  let live = true;
  const rec: ConnRecording = {
    file,
    count: 0,
    conn: {
      send(data: string, reliable?: boolean) {
        if (live && inner.open) {
          gz.write(`${clock()}\t${data}\n`);
          rec.count++;
        }
        inner.send(data, reliable);
      },
      close: (reason?: string) => inner.close(reason),
      get open() {
        return inner.open;
      },
    },
    stop() {
      if (!live) return Promise.resolve();
      live = false;
      return new Promise<void>((res) => {
        out.on("close", () => res());
        gz.end();
      });
    },
  };
  return rec;
}
