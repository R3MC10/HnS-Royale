// HnS Royale desktop app (Electron main process).
//  - Serves the game files (dist/lobby.js) with Electron's own Node, so players need no Node
//    install, and opens the game in a window.
//  - Online play needs no server, tunnel or link: rooms (create / join by code / room list) go
//    through public relays inside the game (src/net/p2p.ts). This process adds the LAN part, like
//    Retro Arena: a UDP beacon (port 41237, once a second) so apps on the same network see each
//    other's rooms, and a small WebSocket relay hub on the host PC so LAN guests join without internet.
//  - HNS_PROFILE=<folder> runs a second copy with its own userData (two players on one PC).
//  - Launcher: on start a small window checks GitHub Releases (electron-updater). A newer version
//    is downloaded with a progress bar, installed silently and the game restarts on it, so players
//    always launch the live version. Offline / GitHub down / no release: the game starts as is.
//  - Closing the game window stops the server.
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import updaterPkg from "electron-updater";
import { randomBytes } from "node:crypto";
import dgram from "node:dgram";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { startServer } from "../scripts/host.mjs";

const { autoUpdater } = updaterPkg;
const here = dirname(fileURLToPath(import.meta.url));
const root = app.getAppPath();
if (process.env.HNS_PROFILE) app.setPath("userData", process.env.HNS_PROFILE); // a second copy on one PC
const FIRST_PORT = Number(process.env.PORT) || 3001;

// Language: the game's own choice (it sets <html lang> from its settings, else the system
// language) once the page has loaded; before that the app / system locale. Polish or English.
const STR = {
  pl: {
    view: "Widok",
    reload: "Odśwież",
    fullscreen: "Pełny ekran",
    quit: "Zakończ",
    serverFail: "Nie udało się uruchomić serwera gry.",
    lChecking: "Sprawdzanie aktualizacji…",
    lDownloading: (v) => `Pobieranie wersji ${v}…`,
    lInstalling: "Instalowanie aktualizacji…",
    lStarting: "Uruchamianie…",
  },
  en: {
    view: "View",
    reload: "Reload",
    fullscreen: "Full screen",
    quit: "Quit",
    serverFail: "Could not start the game server.",
    lChecking: "Checking for updates…",
    lDownloading: (v) => `Downloading version ${v}…`,
    lInstalling: "Installing update…",
    lStarting: "Starting…",
  },
};
let lang = "en";
let T = STR.en;
function setLang(l) {
  if (l !== "pl" && l !== "en") return;
  if (l === lang) return;
  lang = l;
  T = STR[lang];
  buildMenu();
}
/** Same rule as the game's systemLang(): Polish if the system / app language is Polish. */
function systemLang() {
  const list = [app.getLocale(), app.getSystemLocale?.(), ...(app.getPreferredSystemLanguages?.() ?? [])];
  return list.some((l) => /^pl\b/i.test(l || "")) ? "pl" : "en";
}
/** Follows the game's language, also when the player changes it in the game's options. */
async function syncLangFromGame() {
  if (!mainWin || mainWin.isDestroyed() || mainWin.webContents.isLoading()) return;
  try {
    setLang(await mainWin.webContents.executeJavaScript("document.documentElement.lang", true));
  } catch {}
}

let server = null;
let port = FIRST_PORT;
let mainWin = null;

function stopAll() {
  if (server && server.exitCode === null) try { server.kill(); } catch {}
  server = null;
  stopHub();
}

async function startGameServer() {
  let last;
  for (let p = FIRST_PORT; p < FIRST_PORT + 10; p++) {
    try {
      server = await startServer({ root, port: p, env: { ELECTRON_RUN_AS_NODE: "1" }, onStderr: (d) => console.error(String(d)) });
      port = p;
      return;
    } catch (e) {
      last = e; // port taken (e.g. "Play with friends.bat" is running): try the next one
    }
  }
  throw last;
}

// ---- LAN: room beacon + relay hub (same idea as Retro Arena) ---------------------------------

const BEACON_PORT = 41237;
let beacon = null; // what this app announces: { id, c: room code, m: room metadata, port: hub port }
const udp = dgram.createSocket({ type: "udp4", reuseAddr: true });
udp.on("error", () => {});
udp.on("message", (buf, rinfo) => {
  let m;
  try { m = JSON.parse(String(buf)); } catch { return; }
  if (!m || m.app !== "hns-royale" || !m.d || typeof m.d !== "object") return;
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("lan:beacon", { ip: rinfo.address, d: m.d });
});
udp.bind(BEACON_PORT, () => { try { udp.setBroadcast(true); } catch {} });
const shout = (d) => {
  const msg = Buffer.from(JSON.stringify({ app: "hns-royale", d }));
  if (msg.length < 8000) try { udp.send(msg, BEACON_PORT, "255.255.255.255", () => {}); } catch {}
};
setInterval(() => beacon && shout(beacon), 1000).unref();
ipcMain.on("lan:beacon-set", (_e, d) => {
  if (!d || typeof d !== "object") return;
  if (typeof d.c === "string") beacon = d;
  else if (beacon) {
    beacon = null;
    shout(d); // "room closed": others drop it at once instead of after the timeout
  }
});

// Relay hub: the host's game page connects as host (with a token), LAN guests connect plainly; the
// hub passes each guest's messages to the host as {t:"open"|"msg"|"close", id} and back.
let hub = null;
const isLoopback = (a) => a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
function stopHub() {
  if (!hub) return;
  try {
    for (const c of hub.wss.clients) c.terminate();
    hub.wss.close();
  } catch {}
  hub = null;
}
ipcMain.handle("lan:hub-start", async () => {
  if (hub) return { port: hub.port, token: hub.token };
  const wss = new WebSocketServer({ port: 0, maxPayload: 1 << 20 });
  await new Promise((ok, fail) => {
    wss.once("listening", ok);
    wss.once("error", fail);
  });
  const h = { wss, port: wss.address().port, token: randomBytes(12).toString("hex"), host: null, guests: new Map(), next: 1 };
  const toHost = (m) => {
    try { h.host?.send(JSON.stringify(m)); } catch {}
  };
  wss.on("connection", (ws, req) => {
    ws.on("error", () => {});
    const q = new URL(req.url || "/", "http://hub");
    if (q.searchParams.get("host") === h.token && isLoopback(req.socket.remoteAddress)) {
      h.host = ws;
      ws.on("message", (raw) => {
        let m;
        try { m = JSON.parse(String(raw)); } catch { return; }
        const g = h.guests.get(m.id);
        if (!g) return;
        try {
          if (m.t === "send" && typeof m.d === "string") g.send(m.d);
          else if (m.t === "close") g.close();
        } catch {}
      });
      ws.on("close", () => {
        if (h.host !== ws) return;
        h.host = null;
        for (const g of h.guests.values()) try { g.close(); } catch {}
      });
      return;
    }
    if (!h.host) return ws.close();
    const id = h.next++;
    h.guests.set(id, ws);
    toHost({ t: "open", id });
    ws.on("message", (raw) => toHost({ t: "msg", id, d: String(raw) }));
    ws.on("close", () => {
      if (h.guests.delete(id)) toHost({ t: "close", id });
    });
  });
  hub = h;
  return { port: h.port, token: h.token };
});
ipcMain.handle("lan:hub-stop", async () => stopHub());

// ---- launcher: update to the live version before the game starts ------------------------

const LAUNCHER_HTML = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0b0a0c;color:#d8ccb0;font:15px Georgia,serif;user-select:none;-webkit-app-region:drag}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;border:1px solid #3c3842;box-sizing:border-box}
h1{margin:0;font-size:30px;letter-spacing:3px;color:#e0a868;font-weight:normal}
#bar{width:300px;height:6px;background:#1d1a20;border:1px solid #3c3842}
#fill{height:100%;width:0;background:linear-gradient(90deg,#7a1810,#ff8a2a);transition:width .2s}
#msg{color:#8a7f6c;font-size:13px}#ver{position:fixed;right:10px;bottom:6px;color:#5a5248;font-size:11px}
</style><h1>HnS Royale</h1><div id="bar"><div id="fill"></div></div><div id="msg"></div><div id="ver"></div>`;

/** Launcher window: brings the install up to the live release, then resolves so the game starts.
 *  When an update is found it installs silently and restarts the app instead (never resolves). */
function runLauncher() {
  return new Promise((resolve) => {
    if (!app.isPackaged) return resolve(null);
    const win = new BrowserWindow({ width: 460, height: 240, frame: false, resizable: false, show: false, backgroundColor: "#0b0a0c", title: "HnS Royale" });
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(LAUNCHER_HTML));
    const js = (code) => (win.isDestroyed() ? Promise.resolve() : win.webContents.executeJavaScript(code).catch(() => {}));
    const set = (msg, pct) => js(`msg.textContent=${JSON.stringify(msg)};` + (pct == null ? "" : `fill.style.width="${Math.min(100, pct)}%";`));
    let shown = false;
    let pending = null;
    win.once("ready-to-show", () => {
      win.show();
      shown = true;
      js(`ver.textContent=${JSON.stringify("v" + app.getVersion())}`);
      set(...(pending ?? [T.lChecking, 5]));
    });
    const show = (msg, pct) => (shown ? set(msg, pct) : (pending = [msg, pct]));
    let done = false;
    const start = () => {
      if (done) return;
      done = true;
      show(T.lStarting, 100);
      // the caller closes the launcher once the game window exists (no window = app quits)
      setTimeout(() => resolve(win), 250);
    };
    let ver = "";
    autoUpdater.logger = null;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    // a check that hangs (captive portal, slow DNS) must not block playing
    const hang = setTimeout(start, 10000);
    autoUpdater.on("error", start); // offline, no release, GitHub down: play the installed version
    autoUpdater.on("update-not-available", start);
    autoUpdater.on("update-available", (info) => {
      clearTimeout(hang);
      ver = info?.version ?? "";
      show(T.lDownloading(ver), 8);
    });
    autoUpdater.on("download-progress", (p) => show(`${T.lDownloading(ver)} ${Math.round(p.percent)}%`, 8 + p.percent * 0.9));
    autoUpdater.on("update-downloaded", () => {
      if (done) return; // the game already started (download error path): installs when it closes
      done = true;
      show(T.lInstalling, 100);
      setTimeout(() => {
        stopAll();
        autoUpdater.quitAndInstall(true, true); // silent install, then start the new version
      }, 600);
    });
    autoUpdater.checkForUpdates().catch(start);
  });
}

// ---- app ----------------------------------------------------------------------------------

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: T.view,
        submenu: [
          { label: T.reload, accelerator: "F5", click: () => mainWin?.webContents.reload() },
          { label: T.fullscreen, accelerator: "F11", click: () => mainWin?.setFullScreen(!mainWin.isFullScreen()) },
          ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }]),
          { type: "separator" },
          { label: T.quit, role: "quit" },
        ],
      },
    ]),
  );
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });

  app.whenReady().then(async () => {
    lang = systemLang();
    T = STR[lang];
    buildMenu();
    const launcher = await runLauncher();
    const closeLauncher = () => launcher && !launcher.isDestroyed() && launcher.destroy();
    try {
      await startGameServer();
    } catch (e) {
      closeLauncher();
      dialog.showErrorBox("HnS Royale", `${T.serverFail}\n\n${e?.message ?? e}`);
      app.quit();
      return;
    }
    mainWin = new BrowserWindow({
      width: 1600,
      height: 900,
      minWidth: 960,
      minHeight: 600,
      title: "HnS Royale",
      backgroundColor: "#050405",
      webPreferences: { preload: join(here, "preload.cjs"), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    closeLauncher();
    mainWin.on("page-title-updated", (e) => e.preventDefault());
    mainWin.loadURL(`http://localhost:${port}/`);
    mainWin.webContents.on("did-finish-load", syncLangFromGame);
    setInterval(syncLangFromGame, 2000);
    mainWin.on("closed", () => {
      mainWin = null;
      app.quit(); // closing the game closes everything
    });
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", stopAll);
  app.on("will-quit", stopAll);
  process.on("exit", stopAll);
}
