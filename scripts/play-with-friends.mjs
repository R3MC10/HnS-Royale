// "Play with friends" launcher: builds the game, serves it with the lobby / signalling service,
// opens a free Cloudflare quick tunnel (no account) and prints one link to send to friends.
// Friends only need a browser. Match traffic goes peer-to-peer (WebRTC) to the host's tab.
//   node scripts/play-with-friends.mjs [--no-open] [--no-build] [--no-tunnel (same Wi-Fi only)]
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
  if (!args.has("--no-tunnel") && (await ensureTunnelTool(TOOLS, say))) link = await startTunnel();
} catch (e) {
  say(`Could not open the internet link: ${e.message ?? e}`);
}

say();
say("==============================================================");
if (link) {
  say("  SEND THIS LINK TO YOUR FRIENDS:");
  say();
  say(`    ${link}`);
  say();
  say("  (copied to your clipboard; it changes every time you start)");
  if (isWin) spawnSync("clip", { input: link });
} else {
  say("  No internet link. Friends on the same Wi-Fi can still join via");
  say(`  http://<this PC's IP address>:${PORT}`);
}
say();
say(`  You play here: ${local}`);
say("  1. Click Host a game.   2. Friends open the link and click Browse.");
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
