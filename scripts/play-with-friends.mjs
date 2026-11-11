// "Play with friends" launcher: builds the game, serves it locally and opens it. Connecting needs
// no link: in the game, Create room gives a 5-character code; friends join by that code or pick
// the room from the list (public relays, src/net/p2p.ts). Match traffic goes peer-to-peer.
// --tunnel additionally opens a Cloudflare quick tunnel, only so friends WITHOUT the game (no app,
// no local copy) can load the game files in a browser; joining still goes by room code.
//   node scripts/play-with-friends.mjs [--no-open] [--no-build] [--tunnel]
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTunnelTool, startServer as hostServer, startTunnel as hostTunnel } from "./host.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3001;
const args = new Set(process.argv.slice(2));
const isWin = process.platform === "win32";
const TOOLS = join(root, "tools");

const say = (s = "") => console.log(s);
const kids = [];
let stopping = false;
let serverProc = null;
let tunnelProc = null;
function stop(code = 0) {
  stopping = true;
  for (const k of kids) try { k.kill(); } catch {}
  process.exit(code);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

async function startServer() {
  serverProc = await hostServer({ root, port: PORT });
  kids.push(serverProc);
}

async function startTunnel() {
  const { url, proc } = await hostTunnel(TOOLS, PORT);
  kids.push(proc);
  tunnelProc = proc;
  return url;
}

if (!args.has("--no-build")) {
  say("Building the game...");
  const b = spawnSync(process.execPath, [join(root, "scripts", "build.mjs")], { cwd: root, stdio: "inherit" });
  if (b.status !== 0) stop(1);
}
try {
  await startServer();
} catch (e) {
  say(String(e.message ?? e));
  stop(1);
}
const local = `http://localhost:${PORT}`;
let link = null;
try {
  if (args.has("--tunnel") && (await ensureTunnelTool(TOOLS, say))) link = await startTunnel();
} catch (e) {
  say(`Could not open the internet link: ${e.message ?? e}`);
}

say();
say("==============================================================");
if (link) {
  say("  Friends without the game can open it here:");
  say(`    ${link}`);
  say("  (copied to your clipboard; it changes every time you start)");
  if (isWin) spawnSync("clip", { input: link });
  say();
}
say(`  You play here: ${local}`);
say("  1. Play > Create room: you get a 5-character room code.");
say("  2. Friends (app or game page) click Play, then type the code or pick your room.");
say("  3. Add bots if you like, then Begin the match.");
say();
say("  Keep this window open while you play. Close it to stop.");
say("==============================================================");
if (!args.has("--no-open")) {
  if (isWin) spawn("cmd", ["/c", "start", "", local], { stdio: "ignore", detached: true }).unref();
  else spawn(process.platform === "darwin" ? "open" : "xdg-open", [local], { stdio: "ignore", detached: true }).unref();
}

// After the link is out: if a helper process dies, say what died and what to do (it used to be silent).
function died(lines) {
  if (stopping) return;
  say();
  say("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  for (const l of lines) say(`  ${l}`);
  say("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}
const exited = (p) => p.exitCode !== null || p.signalCode !== null;
const serverDied = () =>
  died([
    `THE GAME SERVER STOPPED (exit code ${serverProc.exitCode ?? serverProc.signalCode}).`,
    "Nobody can open the game or join a hall any more, with or without the link.",
    "A match that is already running goes on until it ends.",
    "To play on: close this window and start the launcher again.",
  ]);
const tunnelDied = () =>
  died([
    `THE INTERNET LINK STOPPED WORKING (the tunnel exited, code ${tunnelProc.exitCode ?? tunnelProc.signalCode}).`,
    `Friends can no longer connect through ${link}`,
    "Players who are already in your hall keep playing; nobody new can join over the internet.",
    "To get a new link: close this window and start the launcher again (the link will be different).",
  ]);
if (exited(serverProc)) serverDied();
else serverProc.on("exit", serverDied);
if (link && tunnelProc) {
  if (exited(tunnelProc)) tunnelDied();
  else tunnelProc.on("exit", tunnelDied);
}
setInterval(() => {}, 1 << 30); // stay up so the message above stays on screen until the window is closed
