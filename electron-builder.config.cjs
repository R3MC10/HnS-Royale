// electron-builder config: Windows NSIS installer (per-user, no admin) + GitHub Releases publishing.
// The GitHub repo comes ONLY from package.json "repository" ("github:OWNER/REPO").
// Build locally: npm run dist:win     Release (CI): push a tag vX.Y.Z (.github/workflows/release.yml)
const { readdirSync, readFileSync, existsSync } = require("node:fs");
const { join, posix } = require("node:path");

const pkg = require("./package.json");
const m = /(?:github:|github\.com[/:])([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(
  typeof pkg.repository === "string" ? pkg.repository : (pkg.repository && pkg.repository.url) || "",
);
if (!m) throw new Error('package.json "repository" must be "github:OWNER/REPO"');
const [, owner, repo] = m;

// public/ files no manifest points at are left out of the package (they stay on disk).
// The game loads art via public/art/index.json, sounds via public/audio/manifest.json and hero
// parts via public/heroparts/manifest.json; files missing from those are never requested.
function unreferencedPublic() {
  const pub = join(__dirname, "public");
  const out = [];
  const files = (dir, rel = "") => {
    const r = [];
    if (!existsSync(dir)) return r;
    for (const e of readdirSync(dir, { withFileTypes: true }))
      e.isDirectory() ? r.push(...files(join(dir, e.name), rel + e.name + "/")) : r.push(rel + e.name);
    return r;
  };
  const strings = (v, s = new Set()) => {
    if (typeof v === "string") s.add(v);
    else if (v && typeof v === "object") for (const k in v) strings(v[k], s);
    return s;
  };
  // [folder under public, manifest file, prefix the manifest's paths are relative to]
  for (const [dir, manifest, base] of [
    ["art", "index.json", ""],
    ["audio", "manifest.json", "audio/"],
    ["heroparts", "manifest.json", "heroparts/"],
  ]) {
    const mf = join(pub, dir, manifest);
    if (!existsSync(mf)) continue;
    const refs = strings(JSON.parse(readFileSync(mf, "utf8")));
    const full = new Set([...refs].map((s) => posix.normalize(base + s)));
    const dirs = [...full].filter((s) => s.endsWith("/"));
    for (const f of files(join(pub, dir), dir + "/")) {
      if (f === `${dir}/${manifest}`) continue;
      if (full.has(f) || dirs.some((d) => f.startsWith(d))) continue;
      out.push(`!public/${f}`);
    }
  }
  return out;
}

const skipped = unreferencedPublic();
console.log(`[electron-builder.config] leaving out ${skipped.length} unreferenced public/ files`);

module.exports = {
  appId: "com.r3mc10.hnsroyale",
  productName: "HnS Royale",
  copyright: "HnS Royale",
  directories: { output: "release", buildResources: "build" },
  // Plain folder instead of app.asar: the game server runs as a separate Node process
  // (ELECTRON_RUN_AS_NODE) and reads public/ and node_modules/ws from disk.
  asar: false,
  electronLanguages: ["en-US", "pl"], // Chromium UI locales: only the two the game speaks
  files: [
    "package.json",
    "electron/**",
    "scripts/host.mjs",
    "dist/lobby.js",
    "public/**",
    // dev-only pages and maps
    "!public/**/*.map",
    "!public/{showcase,sounds,sprites}.{html,js}",
    "!public/**/*.bak*",
    "!public/**/manifest.bak*.json",
    ...skipped,
  ],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  nsis: {
    oneClick: false, // assisted installer: the player picks the install folder
    allowToChangeInstallationDirectory: true,
    installerLanguages: ["en_US", "pl_PL"],
    perMachine: false, // per-user install, no admin prompt
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "HnS Royale",
    artifactName: "HnS-Royale-Setup-${version}.${ext}",
    deleteAppDataOnUninstall: false,
  },
  publish: [{ provider: "github", owner, repo, releaseType: "release" }],
};
