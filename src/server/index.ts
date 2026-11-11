// HTTP static server + WebSocket game server on one port.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { TICK_RATE } from "../shared/constants";
import { GameHost, type HostConn } from "./host";
import { LOBBY_PATH, LobbyService } from "../lobby/service";

const DEV = process.env.HNS_DEV === "1";

const PORT = Number(process.env.PORT) || 3000;

// public/ lives at the project root: works from src/server (tsx) and dist/ (build).
const here = dirname(fileURLToPath(import.meta.url));
const candidates = [resolve(here, "../../public"), resolve(here, "../public"), resolve(process.cwd(), "public")];
const PUBLIC_DIR = candidates.find((d) => {
  try {
    return statSync(d).isDirectory();
  } catch {
    return false;
  }
}) ?? candidates[0];

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".json": "application/json",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const http = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  let path: string;
  try {
    path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  // The client's main menu offers "join this page's dedicated server" only where this answers.
  if (path === "/dedicated") {
    res.writeHead(204).end();
    return;
  }
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(PUBLIC_DIR, path));
  if (!file.startsWith(PUBLIC_DIR + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error("not a file");
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": "no-cache",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
});

// ---------------------------------------------------------------------------
// Game connections: message handling and the per-tick broadcast live in ./host.ts (shared with the
// host-in-browser worker). This file is only the Node glue: ws transport + the 30 Hz loop.
// WebSocket upgrades on /lobby go to the P2P lobby + signalling service (src/lobby/service.ts).

const host = new GameHost({ dev: DEV, ...(DEV && process.env.HNS_PIN ? { pin: Number(process.env.HNS_PIN) } : {}) }); // HNS_PIN: dev-only pinned seed (server/devpin.ts)
const game = host.game;
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
const lobby = new LobbyService();
http.on("upgrade", (req, socket, head) => {
  const path = (req.url ?? "/").split("?")[0];
  if (path === LOBBY_PATH) lobby.handleUpgrade(req, socket, head);
  else wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

/** HostConn over a Node ws socket (one reliable, ordered channel). */
function wsConn(ws: WebSocket): HostConn {
  return {
    send: (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    },
    close: () => ws.close(),
    get open() {
      return ws.readyState === ws.OPEN;
    },
  };
}

wss.on("connection", (ws) => {
  const conn = wsConn(ws);
  host.connect(conn);
  ws.on("message", (data, isBinary) => {
    if (!isBinary) host.message(conn, data.toString());
  });
  const cleanup = () => host.disconnect(conn);
  ws.on("close", cleanup);
  ws.on("error", cleanup);
});

// Fixed-rate loop with drift compensation.
const TICK_MS = 1000 / TICK_RATE;
let nextTick = performance.now();
function loop() {
  const now = performance.now();
  let steps = 0;
  while (now >= nextTick && steps < 5) {
    host.tick();
    nextTick += TICK_MS;
    steps++;
  }
  if (now - nextTick > TICK_MS * 5) nextTick = now; // fell far behind: resync
  setTimeout(loop, Math.max(0, nextTick - performance.now()));
}
void game;

http.listen(PORT, () => {
  console.log(`HnS Royale server on http://localhost:${PORT}  (serving ${PUBLIC_DIR})${DEV ? "  [DEV commands enabled]" : ""}`);
  loop();
});
