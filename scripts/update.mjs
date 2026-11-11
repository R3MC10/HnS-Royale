// Updater: run before the launcher. Compares this folder's version (package.json) with the one on
// GitHub and, when GitHub is newer, downloads that copy and puts it over this folder.
//   - The repo comes from package.json "repository" ("github:OWNER/REPO"). No repository = no updates.
//   - Releasing an update = raise "version" in package.json and push to the default branch.
//   - Skips itself inside the installed app (that one updates through GitHub Releases).
//   - A folder with .git is a developer copy and is never touched (use git pull there).
//   - Offline or GitHub unreachable: says so in one line and the game starts as it is.
//   node scripts/update.mjs [--check (only report)] [--force (reinstall even if not newer)]
// Never fails the launch: it always exits 0.
import { spawnSync } from "node:child_process";
import { cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const say = (s = "") => console.log(s);
/** Folders that mirror the repo exactly: files removed upstream are removed here too. */
const MIRRORED = ["src", "scripts", "public", "docs"];
/** Never replaced or removed, whatever the download contains. */
const KEEP = new Set(["node_modules", "tools", "dist", "recordings", ".git"]);

const readJson = (f) => JSON.parse(readFileSync(f, "utf8"));

function repoOf(pkg) {
  const r = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const m = r && /(?:github:|github\.com[/:])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(r);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** 1 if a is newer than b, -1 if older, 0 if the same ("v" prefix and missing parts are fine). */
function cmp(a, b) {
  const p = (v) => String(v).replace(/^v/i, "").split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

async function get(url, ms) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(ms), headers: { "User-Agent": "hns-royale-updater" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function main() {
  if (process.env.HNS_NO_UPDATE) return;
  // The installed app (Electron) updates itself through GitHub Releases (electron-updater); never
  // overwrite its files from a source tarball. Packaged layout: <install>/resources/app/scripts.
  if (process.versions.electron || /[\\/]resources[\\/]app(\.asar)?$/i.test(root)) return;
  const pkg = readJson(join(root, "package.json"));
  const repo = repoOf(pkg);
  if (!repo) return; // no repository set yet: nothing to check
  if (existsSync(join(root, ".git")) && !args.has("--force")) return; // developer copy
  const rawUrl = process.env.HNS_UPDATE_RAW || `https://raw.githubusercontent.com/${repo}/HEAD/package.json`;
  const tarUrl = process.env.HNS_UPDATE_TAR || `https://github.com/${repo}/archive/HEAD.tar.gz`;

  let latest;
  try {
    latest = (await (await get(rawUrl, 6000)).json()).version;
  } catch (e) {
    say(`Could not check for updates (${e.message}). Starting version ${pkg.version}.`);
    return;
  }
  if (!latest || (cmp(latest, pkg.version) <= 0 && !args.has("--force"))) {
    say(`HnS Royale ${pkg.version} is up to date.`);
    return;
  }
  say(`Update available: ${pkg.version} -> ${latest}`);
  if (args.has("--check")) return;

  const work = join(root, "tools", "update");
  rmSync(work, { recursive: true, force: true });
  mkdirSync(join(work, "new"), { recursive: true });
  try {
    say("Downloading...");
    const res = await get(tarUrl, 15 * 60 * 1000);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(join(work, "update.tar.gz")));
    // Relative paths + cwd: Git's tar on Windows misreads "C:\..." as a remote host.
    const t = spawnSync("tar", ["-xzf", "update.tar.gz", "--strip-components=1", "-C", "new"], { cwd: work, stdio: "inherit" });
    if (t.status !== 0) throw new Error("could not unpack the download");
    const fresh = join(work, "new");
    const got = readJson(join(fresh, "package.json")); // also proves the unpack is whole enough to use
    if (!existsSync(join(fresh, "src")) || !existsSync(join(fresh, "scripts"))) throw new Error("the download is not the game");

    say("Installing...");
    const depsBefore = JSON.stringify([pkg.dependencies, pkg.devDependencies]);
    for (const name of readdirSync(fresh)) {
      if (KEEP.has(name)) continue;
      if (MIRRORED.includes(name)) rmSync(join(root, name), { recursive: true, force: true });
      cpSync(join(fresh, name), join(root, name), { recursive: true, force: true });
    }
    if (JSON.stringify([got.dependencies, got.devDependencies]) !== depsBefore || !existsSync(join(root, "node_modules"))) {
      say("Installing new dependencies...");
      spawnSync("npm", ["install"], { cwd: root, stdio: "inherit", shell: true });
    }
    say(`Updated to ${got.version}.`);
  } catch (e) {
    say(`Update failed (${e.message}). Starting version ${pkg.version}.`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => say(`Updater error: ${e?.message ?? e}`)).finally(() => process.exit(0));
