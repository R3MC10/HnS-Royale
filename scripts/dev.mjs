// Dev runner: rebuilds the client bundle on change and restarts the server on change.
import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
const APP_VERSION = JSON.parse(readFileSync("package.json", "utf8")).version;
import { spawn } from "node:child_process";

const ctx = await esbuild.context({
  entryPoints: { bundle: "src/client/main.ts", sprites: "src/client/sprites.ts", sounds: "src/client/sounds.ts", hostworker: "src/net/hostworker.ts" }, // hostworker: P2P host game loop (Web Worker)
  bundle: true,
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) }, // main-menu version watermark
  sourcemap: true,
  outdir: "public",
  target: "es2020",
  logLevel: "info",
});
await ctx.watch();

const server = spawn("npx", ["tsx", "watch", "src/server/index.ts"], {
  stdio: "inherit",
  shell: true,
});

const stop = async () => {
  server.kill();
  await ctx.dispose();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
