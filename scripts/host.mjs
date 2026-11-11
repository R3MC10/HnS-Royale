// Shared hosting pieces (startServer is used by both "Play with friends" paths; the tunnel only by
// scripts/play-with-friends.mjs --tunnel, so friends without the game can load its files):
//   - scripts/play-with-friends.mjs (developer / no-install path, run with Node)
//   - electron/main.mjs (the installed app, run with Electron's own Node)
// startServer: the lobby / signalling service + static game files (dist/lobby.js) as a child process.
// ensureTunnelTool + startTunnel: a free Cloudflare quick tunnel (no account) -> one public link.
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const isWin = process.platform === "win32";
const CF_URL = isWin
  ? "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  : process.platform === "darwin"
    ? null
    : "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64";

/** Path of the cloudflared binary inside a tools folder. */
export const tunnelExe = (toolsDir) => join(toolsDir, "cloudflared", isWin ? "cloudflared.exe" : "cloudflared");

/** Downloads cloudflared into toolsDir/cloudflared on first use. false = no build for this OS. */
export async function ensureTunnelTool(toolsDir, say = () => {}) {
  const exe = tunnelExe(toolsDir);
  if (existsSync(exe) && statSync(exe).size > 1e6) return true;
  if (!CF_URL) return false;
  say("First run: downloading the Cloudflare tunnel tool (about 60 MB, official GitHub release)...");
  mkdirSync(join(toolsDir, "cloudflared"), { recursive: true });
  const res = await fetch(CF_URL, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  const tmp = exe + ".part";
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp, { mode: 0o755 }));
  renameSync(tmp, exe);
  return true;
}

/**
 * Starts dist/lobby.js under `root` on `port`. Resolves with the child process once it listens.
 * `node` is the Node binary to use (process.execPath; under Electron it runs with ELECTRON_RUN_AS_NODE).
 */
export function startServer({ root, port, node = process.execPath, env = {}, onStderr = (d) => process.stderr.write(d) }) {
  return new Promise((ok, fail) => {
    const s = spawn(node, [join(root, "dist", "lobby.js")], {
      cwd: root,
      env: { ...process.env, ...env, PORT: String(port), HNS_TRUST_PROXY: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    s.stdout.on("data", (d) => String(d).includes("lobby + signalling") && ok(s));
    s.stderr.on("data", onStderr);
    s.on("error", fail);
    s.on("exit", (c) => fail(new Error(`game server stopped (code ${c}). Is port ${port} already in use?`)));
  });
}

/** Opens a quick tunnel to localhost:port. Resolves with { url, proc }. */
export function startTunnel(toolsDir, port) {
  return new Promise((ok, fail) => {
    const t = spawn(tunnelExe(toolsDir), ["tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let buf = "";
    let up = false;
    const on = (d) => {
      if (up) return;
      buf += String(d);
      const m = buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) {
        up = true;
        ok({ url: m[0], proc: t });
      }
    };
    t.stdout.on("data", on);
    t.stderr.on("data", on);
    t.on("error", fail);
    t.on("exit", (c) => fail(new Error(`tunnel stopped (code ${c})`)));
    setTimeout(() => {
      if (up) return;
      fail(new Error("tunnel did not come up within 60 s"));
      try { t.kill(); } catch {}
    }, 60000).unref();
  });
}
