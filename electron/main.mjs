// HnS Royale desktop app (Electron main process).
//  - Runs the lobby / signalling service + game files (dist/lobby.js) with Electron's own Node,
//    so players need no Node install, and opens the game in a window.
//  - "Play with friends" (menu): opens a Cloudflare quick tunnel and shows a link to copy. Friends
//    can join with the app or any browser. Same code as scripts/play-with-friends.mjs (scripts/host.mjs).
//  - Auto-update from GitHub Releases (electron-updater): checks on start, downloads in the
//    background, offers a restart when ready, otherwise installs on quit. Offline / no release = silent.
//  - Closing the game window stops the server and the tunnel.
import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu } from "electron";
import updaterPkg from "electron-updater";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTunnelTool, startServer, startTunnel } from "../scripts/host.mjs";

const { autoUpdater } = updaterPkg;
const here = dirname(fileURLToPath(import.meta.url));
const root = app.getAppPath();
const TOOLS = app.isPackaged ? join(app.getPath("userData"), "tools") : join(root, "tools");
const FIRST_PORT = Number(process.env.PORT) || 3001;

// Language: the game's own choice (it sets <html lang> from its settings, else the system
// language) once the page has loaded; before that the app / system locale. Polish or English.
const STR = {
  pl: {
    friends: "Graj ze znajomymi",
    view: "Widok",
    reload: "Odśwież",
    fullscreen: "Pełny ekran",
    quit: "Zakończ",
    serverFail: "Nie udało się uruchomić serwera gry.",
    updTitle: "Aktualizacja",
    updReady: "Aktualizacja gotowa — uruchom ponownie",
    updDetail: (v) => `Wersja ${v} została pobrana. Uruchom ponownie teraz albo zostanie zainstalowana przy zamknięciu gry.`,
    restart: "Uruchom ponownie",
    later: "Później",
  },
  en: {
    friends: "Play with friends",
    view: "View",
    reload: "Reload",
    fullscreen: "Full screen",
    quit: "Quit",
    serverFail: "Could not start the game server.",
    updTitle: "Update",
    updReady: "Update ready — restart",
    updDetail: (v) => `Version ${v} has been downloaded. Restart now, or it installs when you close the game.`,
    restart: "Restart now",
    later: "Later",
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
  if (friendsWin && !friendsWin.isDestroyed()) {
    friendsWin.setTitle(T.friends);
    friendsWin.webContents.send("lang", lang);
  }
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
let tunnel = null; // { url, proc }
let tunnelBusy = false;
let friendsState = { phase: "idle" };
let mainWin = null;
let friendsWin = null;

function stopAll() {
  for (const p of [tunnel?.proc, server]) if (p && p.exitCode === null) try { p.kill(); } catch {}
  tunnel = null;
  server = null;
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

// ---- "Play with friends" window -----------------------------------------------------------

function pushFriends(state) {
  friendsState = state;
  if (friendsWin && !friendsWin.isDestroyed()) friendsWin.webContents.send("state", state);
}

async function openTunnel() {
  if (tunnel || tunnelBusy) return pushFriends(friendsState);
  tunnelBusy = true;
  try {
    pushFriends({ phase: "starting" });
    if (!(await ensureTunnelTool(TOOLS, () => pushFriends({ phase: "downloading" })))) throw new Error("no tunnel tool for this OS");
    pushFriends({ phase: "starting" });
    tunnel = await startTunnel(TOOLS, port);
    clipboard.writeText(tunnel.url);
    pushFriends({ phase: "ready", url: tunnel.url });
    const t = tunnel;
    t.proc.on("exit", () => {
      if (tunnel !== t) return;
      tunnel = null;
      pushFriends({ phase: "error", error: "tunnel stopped" });
    });
  } catch (e) {
    pushFriends({ phase: "error", error: String(e?.message ?? e) });
  } finally {
    tunnelBusy = false;
  }
}

function openFriends() {
  if (friendsWin && !friendsWin.isDestroyed()) {
    friendsWin.focus();
  } else {
    friendsWin = new BrowserWindow({
      width: 520,
      height: 330,
      resizable: false,
      minimizable: false,
      maximizable: false,
      parent: mainWin ?? undefined,
      title: T.friends,
      backgroundColor: "#0b0807",
      autoHideMenuBar: true,
      webPreferences: { preload: join(here, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    friendsWin.setMenu(null);
    friendsWin.loadFile(join(here, "friends.html"), { query: { lang, local: `http://localhost:${port}` } });
    friendsWin.webContents.on("did-finish-load", () => pushFriends(friendsState));
    friendsWin.on("closed", () => (friendsWin = null)); // the link stays up until the game closes
  }
  openTunnel();
}

ipcMain.on("friends:retry", () => openTunnel());
ipcMain.on("friends:copy", () => tunnel && clipboard.writeText(tunnel.url));

// ---- auto-update --------------------------------------------------------------------------

function checkUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", () => {}); // offline, no release yet, GitHub down: play on, say nothing
  autoUpdater.on("update-downloaded", async (info) => {
    const opts = {
      type: "info",
      title: T.updTitle,
      message: T.updReady,
      detail: T.updDetail(info?.version ?? ""),
      buttons: [T.restart, T.later],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    };
    const { response } = mainWin && !mainWin.isDestroyed() ? await dialog.showMessageBox(mainWin, opts) : await dialog.showMessageBox(opts);
    if (response === 0) {
      stopAll();
      autoUpdater.quitAndInstall();
    }
  });
  autoUpdater.checkForUpdates().catch(() => {});
}

// ---- app ----------------------------------------------------------------------------------

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { label: T.friends, click: openFriends },
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
    try {
      await startGameServer();
    } catch (e) {
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
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    mainWin.on("page-title-updated", (e) => e.preventDefault());
    mainWin.loadURL(`http://localhost:${port}/`);
    mainWin.webContents.on("did-finish-load", syncLangFromGame);
    setInterval(syncLangFromGame, 2000);
    mainWin.on("closed", () => {
      mainWin = null;
      app.quit(); // closing the game closes everything, including the friends window and tunnel
    });
    checkUpdates();
  });

  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", stopAll);
  app.on("will-quit", stopAll);
  process.on("exit", stopAll);
}
