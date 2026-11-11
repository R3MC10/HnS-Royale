// Production build: client bundle -> public/bundle.js, server -> dist/server.js
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: { bundle: "src/client/main.ts", sprites: "src/client/sprites.ts", sounds: "src/client/sounds.ts", hostworker: "src/net/hostworker.ts" }, // hostworker: P2P host game loop (Web Worker)
  bundle: true,
  minify: true,
  outdir: "public",
  target: "es2020",
});

await esbuild.build({
  entryPoints: ["src/server/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: "dist/server.js",
  target: "node20",
});

// Standalone P2P lobby + signalling service (static files + /lobby; no game server).
await esbuild.build({
  entryPoints: ["src/lobby/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: "dist/lobby.js",
  target: "node20",
});

console.log("Build complete.");
