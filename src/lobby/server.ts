// Standalone P2P deployment: static files (public/) + the lobby / signalling service on /lobby.
// No game runs here: hosts run matches in their browsers. `npm run lobby` (dev) or
// `node dist/lobby.js` (after `npm run build`). Env: PORT (default 3001), HNS_ICE (JSON ICE
// servers, e.g. to add TURN), HNS_TRUST_PROXY=1 behind a reverse proxy.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { LOBBY_PATH, LobbyService } from "./service";

const PORT = Number(process.env.PORT) || 3001;
const here = dirname(fileURLToPath(import.meta.url));
const candidates = [resolve(here, "../../public"), resolve(here, "../public"), resolve(process.cwd(), "public")];
const PUBLIC_DIR =
  candidates.find((d) => {
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
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".json": "application/json",
};

const http = createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return void res.writeHead(405).end();
  let path: string;
  try {
    path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  } catch {
    return void res.writeHead(400).end();
  }
  if (path === "/healthz") return void res.writeHead(200, { "Content-Type": "text/plain" }).end(`ok ${lobby.lobbies.size} lobbies`);
  if (path.endsWith("/")) path += "index.html";
  const file = normalize(join(PUBLIC_DIR, path));
  if (!file.startsWith(PUBLIC_DIR + sep)) return void res.writeHead(403).end();
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error("not a file");
    // "no-cache" = ask before reuse; the ETag lets the answer be an empty 304, so a reload does not pull the art again.
    const etag = `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
    if (req.headers["if-none-match"] === etag) return void res.writeHead(304, { ETag: etag, "Cache-Control": "no-cache" }).end();
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache", ETag: etag });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
});

const lobby = new LobbyService({ log: (...a) => console.log(...a) });
http.on("upgrade", (req, socket, head) => {
  if ((req.url ?? "/").split("?")[0] === LOBBY_PATH) lobby.handleUpgrade(req, socket, head);
  else socket.destroy();
});

http.listen(PORT, () => console.log(`HnS Royale lobby + signalling on http://localhost:${PORT}  (ws ${LOBBY_PATH}, serving ${PUBLIC_DIR})`));
