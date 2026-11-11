// Menus: title -> main menu -> lobby browser / host -> lobby room -> match -> post-match -> room.
// Owns the P2P session (HostSession for hosts, a WebRTC ClientConn for joiners) and attaches it
// to main.ts's Net. main.ts keeps the in-match game client untouched.
import { tr } from "../i18n";
import { BIOMES } from "../../shared/biomes";
import { currentMap, WALL, WATER } from "../../shared/map";
import { CLASSES, CLASS_BY_ID, DEFAULT_CLASS } from "../../shared/content/classes";
import { RARITY_COLORS } from "../../shared/content/loot";
import { MAX_PLAYERS } from "../../shared/constants";
import { HostSession } from "../../net/hostbridge";
import { MAP_SIZES } from "../../net/lobbyproto";
import { cleanCode, joinByCode, lobby, type RoomAd } from "../../net/p2p";
import { CHAT_MAX, type MatchResult, type RoomMember, type RoomServerMsg, type RoomSettings } from "../../net/roomproto";
import { uiSound } from "../audio";
import { openOptions } from "../options";
import type { Net } from "../net";
import type { ClientConn } from "../../net/transport";
import { MENU_CSS } from "./style";
import { initInGameSocial } from "./ingame";
import { CLASS_SELECT_CSS, renderClassSelect } from "./classshow";
import { drawClassEmblem } from "../classpick";

/** Build version, injected by esbuild (scripts/build.mjs, dev.mjs); shown bottom-right on every menu screen. */
declare const __APP_VERSION__: string;
const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

/** Dev solo testing: open the client with ?dev=1 to host a match you can start alone (and get dev commands). */
const DEV_SOLO = (() => {
  try {
    return new URLSearchParams(location.search).get("dev") === "1";
  } catch {
    return false;
  }
})();

/**
 * Prototype: one finished biome (Hollowpine; "Random" gives it too, the other two have no art wired).
 * The hall and the browser do not offer or show the biome until there is a real choice.
 */
const SHOW_BIOME = false;

export interface MenuHooks {
  net: Net;
  overlay: HTMLElement;
  /** Clear in-match client state (match over / left), without touching the connection. */
  resetMatch: () => void;
  /** Focus the game canvas. */
  focusGame: () => void;
}

export interface Menus {
  /** main.ts: the game's welcome arrived (we're in the match). */
  onWelcome(): void;
  /** main.ts: Net closed. left = the player chose to leave. */
  onDisconnected(left: boolean, wasJoined: boolean): void;
  /** main.ts: Net opened (dedicated ws mode sends its join here). */
  onOpen(): void;
  /** Status / error line on the current screen. */
  status(text: string): void;
  /** In-match key actions owned by the menus ("chat", "social"). Returns true when handled. */
  action(a: string): boolean;
  /**
   * main.ts Esc-menu "Leave match": in a hall (P2P) this leaves the match / practice but stays in
   * the hall (true = handled, keep the connection). False = not in a hall: disconnect as before.
   */
  leaveMatch(): boolean;
  /** DEV replay (client/devreplay.ts): show the hall and attach a recorded message stream as a P2P member. */
  replayAttach?(conn: ClientConn): void;
}

type Screen = "title" | "main" | "browser" | "room" | "post" | "busy";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function btn(label: string, cls: string, onClick: () => void, sound: "ui.click" | "ui.confirm" = "ui.click"): HTMLButtonElement {
  const b = el("button", `m-btn ${cls}`.trim(), label);
  b.addEventListener("click", () => {
    uiSound(sound);
    onClick();
  });
  return b;
}

const store = {
  get(k: string, d = ""): string {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

/** Music scene hook: the audio module may expose window.hnsMusic.setState({scene}). */
function musicScene(scene: "menu" | "lobby" | "match") {
  try {
    const m = (window as unknown as { hnsMusic?: { setState?: (s: { scene: string }) => void } }).hnsMusic;
    m?.setState?.({ scene });
  } catch {
    /* ignore */
  }
}

/** Per-tab token sent with r-hello: lets the hall put a dropped player back into a starting match. */
const RID = (() => {
  const k = "hns-rid";
  try {
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
})();

const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Game modes: the royale and Breachway (lane mode, docs/MODE-LANES.md). */
const MODES: [string, string][] = [["royale", "Royale"], ["lanes", "Breachway (5v5 lane)"]];
const modeName = (m?: string) => (m === "lanes" ? "Breachway (5v5 lane)" : "Royale");
const biomeName = (id: string) => (id === "random" ? "Random" : BIOMES.find((b) => b.id === id)?.name ?? id);
const sizeName = (s: string) => (s === "auto" ? "Auto" : s[0].toUpperCase() + s.slice(1));
const className = (id: string) => CLASS_BY_ID.get(id)?.name ?? id;

export function initMenus(h: MenuHooks): Menus {
  const { net, overlay } = h;
  const style = el("style");
  style.textContent = MENU_CSS + CLASS_SELECT_CSS;
  document.head.appendChild(style);

  let root = document.getElementById("menu-root");
  if (!root) {
    root = el("div");
    root.id = "menu-root";
    overlay.appendChild(root);
  }
  const R = root;
  // polish: keep the menu text hidden until the web / title fonts are ready, so the title never
  // flashes in the page's fallback mono face (1.5 s cap so a missing font can't hide the menu).
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts && fonts.status !== "loaded") {
    R.classList.add("m-fonts-wait");
    const done = () => R.classList.remove("m-fonts-wait");
    const want = ['700 48px "Cinzel"', '600 15px "Cinzel"', '600 14px "Palatino Linotype"'];
    Promise.race([
      Promise.all(want.map((f) => fonts.load(f).catch(() => []))).then(() => fonts.ready),
      new Promise((r) => setTimeout(r, 1500)),
    ]).then(done, done);
  }

  let host: HostSession | null = null;
  /** Code of the hall we host or joined (shown in the hall so it can be shared). */
  let roomCode = "";
  let screen: Screen = "title";
  let statusEl: HTMLElement | null = null;
  let profileName = store.get("hns-name");
  let profileCls = store.get("hns-class", DEFAULT_CLASS);
  if (!CLASS_BY_ID.has(profileCls)) profileCls = DEFAULT_CLASS;
  let dedicatedJoin = false;
  /** Does this page's own server run a dedicated game (probed once)? */
  let dedicatedHere: boolean | null = null;
  let inMatch = false;
  /** In the hall's practice arena (the game's welcome hides the menus). */
  let practicing = false;
  let leavingOnPurpose = false;

  // Room state (from r-state).
  let room: { you: number; members: RoomMember[]; settings: RoomSettings; state: "room" | "match"; hostHidden: boolean } | null = null;
  const chat: { from: string; text: string; sys?: 1 }[] = [];
  let lastResult: MatchResult | null = null;
  const POST_HOLD = 20; // s the results stay up before the hall comes back on its own
  let postTimer = 0;
  let browserTimer: ReturnType<typeof setInterval> | null = null;

  const social = initInGameSocial({
    canChat: () => net.mode === "p2p" || net.mode === "host",
    send: (text) => net.sendRaw({ t: "r-chat", text }),
    inMatch: () => overlay.style.display === "none",
    net, // in-match chat over the game connection (works on dedicated servers too)
  });

  const warn = el("div", "m-warn");
  warn.id = "hns-hidden-warn";
  warn.textContent = "Your tab is in the background: you are hosting, keep this tab visible for a smooth game.";
  document.body.appendChild(warn);

  function show() {
    overlay.style.display = "flex";
  }
  function hide() {
    overlay.style.display = "none";
  }

  function setScreen(s: Screen) {
    screen = s;
    if (browserTimer && s !== "browser") {
      clearInterval(browserTimer);
      browserTimer = null;
    }
    R.replaceChildren();
    R.append(el("div", "m-ver", APP_VERSION === "dev" ? "dev" : "v" + APP_VERSION));
    statusEl = null;
    show();
    musicScene(s === "room" || s === "post" ? "lobby" : "menu");
  }

  function status(text: string) {
    if (statusEl) statusEl.textContent = text;
  }

  function nameOk(): boolean {
    const n = profileName.trim();
    if (!n) {
      status("Choose a name first.");
      return false;
    }
    return true;
  }

  // ---- title -------------------------------------------------------------------------

  function renderTitle() {
    setScreen("title");
    const wrap = el("div", "m-title-screen");
    wrap.append(el("h1", "m-title big", "HnS Royale"), el("div", "m-sub", "Full loot. Last one standing."), el("div", "m-press", "Click to begin"));
    const go = () => {
      window.removeEventListener("keydown", onKey);
      uiSound("ui.confirm");
      renderMain();
    };
    const onKey = (e: KeyboardEvent) => {
      if (screen === "title" && !e.repeat) go();
    };
    wrap.addEventListener("click", go);
    window.addEventListener("keydown", onKey);
    R.append(wrap);
  }

  // ---- main menu ----------------------------------------------------------------------

  function renderMain(msg = "") {
    setScreen("main");
    const p = el("div", "m-panel m-main m-col");
    const name = el("input", "m-input");
    name.maxLength = 16;
    name.placeholder = "Your name";
    name.autocomplete = "off";
    name.value = profileName;
    name.addEventListener("input", () => {
      profileName = name.value;
      store.set("hns-name", profileName);
    });
    const browse = btn("Play · Find a room", "primary", () => nameOk() && renderBrowser(), "ui.confirm");
    const hostB = btn("Create room", "", () => nameOk() && startHosting(), "ui.confirm");
    const opts = btn("Options", "", () => openOptions());
    const appQuit = (window as unknown as { HNS_APP?: { quit: () => void } }).HNS_APP?.quit;
    const quit = appQuit ? btn("Quit game", "", () => appQuit()) : btn("Quit to title", "", () => renderTitle());
    statusEl = el("div", "m-status", msg);
    const ded = el("a", "m-note", "Dev: join this page's dedicated server");
    ded.href = "#";
    ded.style.textAlign = "center";
    // Only where this page really comes from a dedicated game server (npm run dev / npm start answer
    // /dedicated with 204; the friends launcher's lobby server does not), or under ?dev=1.
    ded.style.display = DEV_SOLO || dedicatedHere ? "" : "none";
    if (dedicatedHere === null) {
      void fetch("/dedicated", { cache: "no-store" })
        .then((r) => r.status === 204)
        .catch(() => false)
        .then((yes) => {
          dedicatedHere = yes;
          if (yes) ded.style.display = "";
        });
    }
    ded.addEventListener("click", (e) => {
      e.preventDefault();
      if (!nameOk()) return;
      dedicatedJoin = true;
      status("Connecting to the dedicated server…");
      net.connect();
    });
    p.append(el("h1", "m-title mid", "HnS Royale"), el("div", "m-sub", "Gather. Gear up. Be the last."), el("label", "m-label", "Name"), name, browse, hostB, opts, quit, statusEl, ded);
    R.append(p);
    name.focus();
  }

  // ---- lobby browser ----------------------------------------------------------------

  function renderBrowser() {
    setScreen("browser");
    lobby.ensure();
    const p = el("div", "m-panel m-browser m-col");
    const head = el("div", "m-row");
    head.style.justifyContent = "space-between";
    const ttl = el("h2", "m-title mid", "Rooms");
    const right = el("div", "m-row");
    right.append(btn("Back", "small", () => renderMain()));
    head.append(ttl, right);
    // Create a room, or join one by its code (the list below joins by code too).
    const codeRow = el("div", "m-row");
    const codeIn = el("input", "m-input m-code-in");
    codeIn.maxLength = 5;
    codeIn.placeholder = "CODE";
    codeIn.autocomplete = "off";
    codeIn.spellcheck = false;
    const joinCode = () => {
      const c = cleanCode(codeIn.value);
      if (c.length !== 5) return status("Type the 5-character room code first.");
      void joinGame(c);
    };
    codeIn.addEventListener("input", () => (codeIn.value = cleanCode(codeIn.value)));
    codeIn.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") joinCode();
    });
    const joinB = btn("Join", "", joinCode, "ui.confirm");
    joinB.id = "m-join-code";
    const createB = btn("Create room", "primary", () => startHosting(), "ui.confirm");
    createB.id = "m-create-room";
    codeRow.append(createB, el("span", "m-label", "or join by code"), codeIn, joinB);
    const box = el("div", "m-scroll");
    statusEl = el("div", "m-status", lobby.error);
    p.append(head, codeRow, el("div", "m-h", "Open rooms"), box, statusEl, el("div", "m-note", "Rooms are found through public relays (and your local network in the desktop app); nobody runs a server. The host's machine runs the match."));
    R.append(p);

    const draw = (list: RoomAd[]) => {
      const t = el("table", "m-table");
      const hr = el("tr");
      for (const [hname, num] of [["Code", 0], ["Lobby", 0], ["Host", 0], ["Players", 1], ["Biome", 0], ["Size", 0], ["Ping", 1], ["", 0]] as const) {
        if (hname === "Biome" && !SHOW_BIOME) continue;
        const th = el("th", num ? "num" : "", hname);
        hr.append(th);
      }
      t.append(hr);
      if (!list.length) {
        const tr = el("tr");
        const td = el("td", "m-empty", "No open rooms right now. Create one and share the code.");
        td.colSpan = 8;
        tr.append(td);
        t.append(tr);
      }
      for (const r of list) {
        const l = r.meta;
        const tr = el("tr", "lob");
        const code = el("td", "m-code", r.code);
        code.dataset.noi18n = "";
        const nm = el("td");
        nm.append(el("b", "", l.name), document.createTextNode(" "));
        nm.append(el("span", l.state === "match" ? "m-tag busy" : "m-tag", l.state === "match" ? "In match" : "In hall"));
        if (r.lan) nm.append(document.createTextNode(" "), el("span", "m-tag", "LAN"));
        const full = l.players >= l.max;
        const join = btn(full ? "Full" : "Join", "small primary", () => void joinGame(r.code), "ui.confirm");
        join.disabled = full;
        const tdj = el("td", "num");
        tdj.append(join);
        tr.append(code, nm, el("td", "", l.host), el("td", "num", `${l.players}/${l.max}`), ...(SHOW_BIOME ? [el("td", "", biomeName(l.biome))] : []), el("td", "", sizeName(l.size)), el("td", "num", r.ping !== undefined ? `${r.ping} ms` : r.lan ? "LAN" : "…"), tdj);
        tr.addEventListener("dblclick", () => !full && void joinGame(r.code));
        t.append(tr);
      }
      box.replaceChildren(t);
    };
    box.append(Object.assign(el("div", "m-empty"), { innerHTML: '<span class="m-spin"></span>Looking for rooms…' }));
    // The first ads take a few seconds to come in over the relays: keep the spinner a moment.
    let polls = 0;
    const load = () => {
      if (screen !== "browser") return;
      const list = lobby.list();
      if (list.length || ++polls > 3) draw(list);
    };
    browserTimer = setInterval(load, 1500);
    codeIn.focus();
  }

  // ---- connecting -------------------------------------------------------------------

  function renderBusy(text: string, onCancel?: () => void) {
    setScreen("busy");
    const p = el("div", "m-panel m-col");
    p.style.width = "min(420px, 100%)";
    const t = el("div", "m-sub");
    t.innerHTML = '<span class="m-spin"></span>';
    t.append(text);
    p.append(t);
    if (onCancel) p.append(btn("Cancel", "", onCancel));
    statusEl = el("div", "m-status");
    p.append(statusEl);
    R.append(p);
  }

  async function joinGame(code: string) {
    let cancelled = false;
    renderBusy(`Joining room ${code}…`, () => {
      cancelled = true;
      renderBrowser();
    });
    try {
      const conn = await joinByCode(code, (t) => !cancelled && status(t));
      if (cancelled) return conn.close();
      roomCode = code;
      enterRoom();
      net.attach(conn, "p2p");
      net.sendRaw({ t: "r-hello", name: profileName, cls: profileCls, rid: RID });
    } catch (err) {
      if (!cancelled) {
        renderBrowser();
        status((err as Error).message);
      }
    }
  }

  async function startHosting() {
    renderBusy("Lighting the braziers…");
    let session: HostSession;
    try {
      session = new HostSession(profileName.trim() || "Host", { name: `${profileName.trim() || "Host"}'s hall`, biome: store.get("hns-host-biome", "random"), size: store.get("hns-host-size", "auto"), mode: store.get("hns-host-mode", "royale") === "lanes" ? "lanes" : "royale" }, DEV_SOLO);
    } catch (err) {
      renderMain(`Could not start hosting: ${(err as Error).message}`);
      return;
    }
    host = session;
    roomCode = session.code;
    session.onHidden = (hidden) => (warn.style.display = hidden ? "block" : "none");
    session.onProblem = (text) => {
      pushChat({ from: "", text, sys: 1 });
      if (inMatch || practicing) social.addLine("", text, true);
    };
    enterRoom();
    net.attach(session.local, "host");
    net.sendRaw({ t: "r-hello", name: profileName, cls: profileCls, rid: RID });
    try {
      await session.publish();
      pushChat({ from: "", text: `Room ${session.code} is open and listed in the room browser. Share the code; waiting for players…`, sys: 1 });
    } catch (err) {
      pushChat({ from: "", text: `Not listed in the browser: ${(err as Error).message} The hall works, but nobody can find it.`, sys: 1 });
    }
  }

  // ---- lobby room --------------------------------------------------------------------

  function enterRoom() {
    room = null;
    chat.length = 0;
    inMatch = false;
    practicing = false;
    renderRoom();
  }

  function pushChat(line: { from: string; text: string; sys?: 1 }) {
    chat.push(line);
    if (chat.length > 120) chat.shift();
    if (screen === "room") renderChatLog();
  }

  let chatLog: HTMLElement | null = null;
  function renderChatLog() {
    if (!chatLog) return;
    chatLog.replaceChildren();
    for (const c of chat) {
      const d = el("div", c.sys ? "sys" : "");
      if (c.sys) d.textContent = c.text;
      else {
        d.dataset.noi18n = ""; // player-written
        d.append(el("b", "", c.from + ": "), document.createTextNode(c.text));
      }
      chatLog.append(d);
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function leaveRoom() {
    leavingOnPurpose = true;
    if (host) {
      host.stop("The host closed the hall.");
      host = null;
    }
    net.detach();
    room = null;
    inMatch = false;
    practicing = false;
    spawnPick.hide();
    warn.style.display = "none";
    h.resetMatch();
    leavingOnPurpose = false;
    renderMain();
  }

  function renderRoom() {
    // Keep the chat draft and focus across re-renders.
    const prevDraft = (R.querySelector("#m-chat-in") as HTMLInputElement | null)?.value ?? "";
    const hadFocus = document.activeElement?.id === "m-chat-in";
    setScreen("room");
    const grid = el("div", "m-hall");
    const isHost = !!room?.members.find((m) => m.id === room!.you)?.host;
    const settings = room?.settings;
    const me = room?.members.find((m) => m.id === room!.you);

    // ---- top bar: hall name + mode, room code, options / leave ----
    const top = el("div", "m-panel m-hall-top");
    const tl = el("div", "m-hall-name");
    tl.append(el("h2", "m-title mid", settings?.name ?? "The Hall"));
    if (settings) tl.append(el("span", "m-hall-mode", modeName(settings.mode)));
    const tc = el("div", "m-row m-coderow");
    if (roomCode) {
      const cv = el("b", "m-code", roomCode);
      cv.dataset.noi18n = "";
      tc.append(el("span", "m-label", "Room code"), cv);
      if (isHost) tc.append(btn("Copy", "small", () => void navigator.clipboard?.writeText(roomCode).catch(() => {})));
    }
    const tr_ = el("div", "m-row m-hall-topbtns");
    tr_.append(btn("Options", "small", () => openOptions()), btn(isHost ? "Close hall" : "Leave", "small", leaveRoom));
    top.append(tl, tc, tr_);

    // ---- left: gathered players (+ bots for the host) ----
    const left = el("div", "m-panel m-col m-hall-side");
    left.append(el("div", "m-h", `Gathered ${room ? `${room.members.length}/${settings!.max}` : ""}`));
    if (!room) left.append(Object.assign(el("div", "m-note"), { innerHTML: '<span class="m-spin"></span>Entering the hall…' }));
    const list = el("div", "m-col m-members");
    for (const m of room?.members ?? []) {
      const row = el("div", "m-member" + (m.id === room!.you ? " me" : "") + (m.ready ? " rdy" : ""));
      const em = el("canvas");
      drawClassEmblem(em, m.cls, 30);
      const who = el("div", "who");
      const nm = el("span", "nm");
      if (m.host) nm.append(el("span", "m-crown", "♛ "));
      nm.append(m.name);
      const cl = el("span", "cl", className(m.cls) + (m.inMatch ? " · in match" : ""));
      who.append(nm, cl);
      const dot = el("span", "m-dot" + (m.ready ? " ready" : ""));
      dot.title = m.ready ? "Ready" : "Not ready";
      row.append(em, who);
      if (m.bot) {
        row.title = `Bot · ${className(m.cls)}`;
        row.append(el("span", "m-bot", "BOT"));
      }
      row.append(dot);
      if (isHost && !m.host) {
        const x = el("button", "m-x", "✕");
        x.title = m.bot ? `Remove bot ${m.name}` : `Kick ${m.name}`;
        x.addEventListener("click", () => {
          uiSound("ui.click");
          net.sendRaw({ t: "r-kick", id: m.id });
        });
        row.append(x);
      }
      list.append(row);
    }
    left.append(list);
    if (isHost && room) {
      // Bots (host only): they sit in the hall like players, always ready, and play the match.
      const nBots = room.members.filter((m) => m.bot).length;
      const full = room.members.length >= settings!.max;
      const bots = el("div", "m-bots");
      const add = btn("Add bot", "small", () => net.sendRaw({ t: "r-bot", add: 1 }));
      add.id = "m-bot-add";
      add.disabled = full;
      add.title = full ? "The hall is full" : "Seat one bot. Bots are always ready and play like players.";
      const fillSel = el("select", "m-select");
      fillSel.id = "m-bot-fill-n";
      for (let i = 2; i <= settings!.max; i++) {
        const o = el("option", "", String(i));
        o.value = String(i);
        o.selected = i === Math.min(settings!.max, Math.max(2, Number(store.get("hns-bot-fill", "8"))));
        fillSel.append(o);
      }
      fillSel.addEventListener("change", () => store.set("hns-bot-fill", fillSel.value));
      const fill = btn("Fill to", "small", () => net.sendRaw({ t: "r-bot", fill: Number(fillSel.value) }));
      fill.id = "m-bot-fill";
      fill.disabled = full;
      fill.title = "Add bots until the hall holds this many players";
      bots.append(add, fill, fillSel);
      if (nBots) {
        const clear = btn("Remove bots", "small", () => net.sendRaw({ t: "r-bot", clear: true }));
        clear.id = "m-bot-clear";
        bots.append(clear);
      }
      left.append(el("div", "m-h", "Bots"), bots);
      if (room.state === "match") left.append(el("div", "m-note", "Bots added now play in the next match."));
    }

    // ---- middle: character selection ----
    const mid = el("div", "m-col m-hall-mid");
    if (room?.hostHidden && !isHost) mid.append(el("div", "m-warn", "The host's tab is in the background: the game may stutter until they come back."));
    if (room?.state === "match" && !me?.inMatch) mid.append(el("div", "m-warn", "A match is in progress. You'll join the next one."));
    const pick = renderClassSelect(profileCls, (id) => {
      uiSound("ui.click");
      profileCls = id as typeof profileCls;
      store.set("hns-class", id);
      net.sendRaw({ t: "r-cls", cls: id });
    }, !!me?.inMatch);
    const ph = el("div", "m-h m-hall-pickh", "Choose your calling");
    pick.root.insertBefore(ph, pick.root.lastElementChild);
    mid.append(pick.root);

    // ---- right: rules + hall talk ----
    const right = el("div", "m-panel m-col m-hall-side");
    right.append(el("div", "m-h", "Rules"));
    const sg = el("div", "m-settings");
    if (settings) {
      const lab = (t: string) => el("span", "m-label", t);
      if (isHost) {
        const nameI = el("input", "m-input");
        nameI.maxLength = 32;
        nameI.value = settings.name;
        nameI.addEventListener("change", () => net.sendRaw({ t: "r-set", settings: { name: nameI.value } }));
        const sel = (opts: [string, string][], val: string, key: keyof RoomSettings, remember?: string) => {
          const s = el("select", "m-select");
          for (const [v, t] of opts) {
            const o = el("option", "", t);
            o.value = v;
            o.selected = v === val;
            s.append(o);
          }
          s.addEventListener("change", () => {
            uiSound("ui.click");
            if (remember) store.set(remember, s.value);
            net.sendRaw({ t: "r-set", settings: { [key]: key === "max" ? Number(s.value) : s.value } });
          });
          return s;
        };
        const maxOpts: [string, string][] = [];
        for (let i = 2; i <= MAX_PLAYERS; i++) maxOpts.push([String(i), String(i)]);
        sg.append(
          lab("Hall name"), nameI,
          lab("Mode"), sel(MODES, settings.mode ?? "royale", "mode", "hns-host-mode"),
          ...(SHOW_BIOME ? [lab("Biome"), sel([["random", "Random"], ...BIOMES.map((b) => [b.id, b.name] as [string, string])], settings.biome, "biome", "hns-host-biome")] : []),
          lab("Map size"), sel(MAP_SIZES.map((s) => [s, sizeName(s)] as [string, string]), settings.size, "size", "hns-host-size"),
          lab("Max players"), sel(maxOpts, String(settings.max), "max"),
        );
      } else {
        sg.append(lab("Mode"), el("span", "", modeName(settings.mode)), ...(SHOW_BIOME ? [lab("Biome"), el("span", "", biomeName(settings.biome))] : []), lab("Map size"), el("span", "", sizeName(settings.size)), lab("Max players"), el("span", "", String(settings.max)));
      }
    }
    right.append(sg);
    if (settings?.mode === "lanes") right.append(el("div", "m-note", "Breachway: two teams, one lane. Waves march, spires shoot, you respawn. Destroy the enemy Core to win. No full loot; buy gear from the Quartermaster on your platform (H)."));
    right.append(el("div", "m-h", "Hall talk"));
    chatLog = el("div", "m-chat");
    const input = el("input", "m-input");
    input.id = "m-chat-in";
    input.maxLength = CHAT_MAX;
    input.placeholder = "Say something… (Enter)";
    input.value = prevDraft;
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && input.value.trim()) {
        net.sendRaw({ t: "r-chat", text: input.value.trim() });
        input.value = "";
      }
    });
    right.append(chatLog, input);
    if (lastResult) right.append(btn("Last match results", "small", () => renderPost(lastResult!)));

    // ---- bottom bar: notes and warnings left, practice + begin / ready right ----
    const bar = el("div", "m-panel m-hall-bar");
    const notes = el("div", "m-col m-hall-notes");
    if (!isHost && me && room?.state === "room") notes.append(el("div", "m-note", "Waiting for the host to start…"));
    if (isHost && room!.state === "room") {
      // Only ready players enter the match: say who would be left in the hall before the host starts.
      const waiting = room!.members.filter((m) => !m.ready && !m.bot).map((m) => m.name);
      if (waiting.length) notes.append(el("div", "m-warn", `Not ready yet: ${waiting.join(", ")}. If you begin now, they sit this match out.`));
    }
    if (isHost) notes.append(el("div", "m-note", "You are the host: the match runs in this tab. Keep it in the foreground. Start needs 2 ready players (you count as ready; bots count too)."));
    statusEl = el("div", "m-status");
    notes.append(statusEl);
    const act = el("div", "m-row m-hall-act");
    if (me && room?.state === "room") {
      // Practice while the hall fills: the arena's open (monsters, quick respawns); Esc > Leave returns here.
      const pb = btn("Practice in the arena", "", () => net.sendRaw({ t: "r-practice", v: true }));
      pb.title = "Fight monsters while you wait. Your class is fixed while practising. The match start pulls you out.";
      act.append(pb);
    }
    if (isHost) {
      const ready = room!.members.filter((m) => m.ready).length;
      if (room!.state === "match") act.append(btn("Call off match", "small", () => net.sendRaw({ t: "r-abort" })));
      const start = btn(`Begin the match (${ready} ready)`, "primary m-hall-go", () => net.sendRaw({ t: "r-start" }), "ui.confirm");
      start.disabled = ready < (DEV_SOLO ? 1 : 2) || room!.state !== "room";
      act.append(start);
    } else if (me) {
      const rb = btn(me.ready ? "Ready ✓" : "Ready up", "m-hall-go" + (me.ready ? " on" : " primary"), () => net.sendRaw({ t: "r-ready", v: !me.ready }), "ui.confirm");
      rb.disabled = room!.state !== "room";
      act.append(rb);
    }
    bar.append(notes, act);

    grid.append(top, left, mid, right, bar);
    R.append(grid);
    renderChatLog();
    if (hadFocus) input.focus();
  }

  // ---- post-match ---------------------------------------------------------------------

  /** Results screen. `auto`: shown by the match ending, so it returns to the hall by itself after POST_HOLD s. */
  function renderPost(r: MatchResult, auto = false) {
    setScreen("post");
    clearInterval(postTimer);
    const p = el("div", "m-panel m-post m-col");
    const w = el("div", "m-winner");
    if (r.winner) w.append(el("b", "", r.winner), document.createTextNode("is the last one standing"));
    else w.append(el("b", "", "No survivors"), document.createTextNode("the arena keeps them all"));
    p.append(el("h2", "m-title mid", "The Reckoning"), w, el("div", "m-sub", `Match length ${fmtSecs(r.secs)}`));
    const t = el("table", "m-table");
    const hr = el("tr");
    for (const [n, num] of [["Place", 1], ["Name", 0], ["Class", 0], ["Lvl", 1], ["Player kills", 1], ["Dmg to players", 1], ["Dmg to monsters", 1], ["Time alive", 1], ["Notable loot", 0]] as const) hr.append(el("th", num ? "num" : "", n));
    t.append(hr);
    r.rows.forEach((row) => {
      const tr = el("tr", row.won ? "won" : "");
      const nm = el("td");
      if (row.won) nm.append(el("span", "m-crown", "♛ "));
      nm.append(el("b", "", row.name));
      if (row.bot) nm.append(el("span", "m-note", " BOT"));
      if (row.left) nm.append(el("span", "m-note", " (left)"));
      const loot = el("td", "m-loot");
      if (!row.loot.length) loot.append(el("span", "m-note", "—"));
      for (const it of row.loot) {
        const d = el("div", "", it.n);
        d.style.color = RARITY_COLORS[it.r] ?? "#ddd";
        loot.append(d);
      }
      const place = row.place ? `#${row.place}` : "—";
      tr.append(el("td", "num m-place", place), nm, el("td", "", className(row.cls)), el("td", "num", String(row.level)), el("td", "num", String(row.kills)), el("td", "num", row.dmg.toLocaleString()), el("td", "num", row.mdmg.toLocaleString()), el("td", "num", fmtSecs(row.secs ?? 0)), loot);
      t.append(tr);
    });
    const sc = el("div", "m-scroll");
    sc.append(t);
    const acts = el("div", "m-row");
    acts.style.justifyContent = "center";
    if (net.connected && (net.mode === "p2p" || net.mode === "host")) {
      // Rematch with the same hall: the host starts it (others must be ready), others ready up.
      const amHost = !!room?.members.find((m) => m.id === room!.you)?.host;
      acts.append(
        btn(amHost ? "Rematch" : "Rematch (ready up)", "primary", () => {
          if (amHost) net.sendRaw({ t: "r-start" });
          else net.sendRaw({ t: "r-ready", v: true });
          renderRoom();
        }, "ui.confirm"),
      );
      const back = btn("Back to the hall", "", () => renderRoom());
      acts.append(back);
      if (auto) {
        // Everyone (winner, the dead who watched, those who left for the hall) lands in the same hall without a click.
        let left = POST_HOLD;
        const label = () => (back.textContent = `Back to the hall (${left})`);
        label();
        postTimer = window.setInterval(() => {
          if (screen !== "post" || !back.isConnected) return clearInterval(postTimer);
          if (--left > 0) return label();
          clearInterval(postTimer);
          renderRoom();
        }, 1000);
      }
    } else acts.append(btn("Return to the menu", "primary", () => renderMain(), "ui.confirm"));
    p.append(sc, acts);
    R.append(p);
  }

  // ---- spawn-point pick (hall matches, during the countdown) ----------------------------

  const spawnPick = (() => {
    const box = el("div");
    box.id = "m-spawnpick";
    const head = el("div", "sp-h");
    const timer = el("span", "sp-t", "");
    head.append(el("span", "", "Choose where you rise"), timer);
    const cv = el("canvas");
    cv.width = cv.height = 320;
    const HINT = "Click a free spawn point. Gold = yours, red = taken.";
    const note = el("div", "sp-n", HINT);
    box.append(head, cv, note);
    document.body.appendChild(box);
    let cur: Extract<RoomServerMsg, { t: "r-spawns" }> | null = null;
    let terrain: { key: string; img: HTMLCanvasElement } | null = null;
    const scale = () => cv.width / Math.max(1, cur ? Math.max(cur.w, cur.h) : 1);
    /** Placeholder terrain: the shared map grid (open / wall / water), cached per map. */
    const terrainImg = (): HTMLCanvasElement | null => {
      const mp = currentMap();
      if (!cur || !mp || mp.w !== cur.w || mp.h !== cur.h) return null;
      const key = `${mp.seed}:${mp.w}:${mp.h}`;
      if (terrain?.key === key) return terrain.img;
      const img = el("canvas");
      img.width = mp.cols;
      img.height = mp.rows;
      const g = img.getContext("2d")!;
      const data = g.createImageData(mp.cols, mp.rows);
      for (let i = 0; i < mp.cols * mp.rows; i++) {
        const k = mp.solid[i];
        const c = k === WALL ? [16, 14, 18] : k === WATER ? [22, 40, 58] : [58, 52, 42];
        data.data[i * 4] = c[0];
        data.data[i * 4 + 1] = c[1];
        data.data[i * 4 + 2] = c[2];
        data.data[i * 4 + 3] = 255;
      }
      g.putImageData(data, 0, 0);
      terrain = { key, img };
      return img;
    };
    const draw = () => {
      const g = cv.getContext("2d")!;
      g.fillStyle = "#0b0a0c";
      g.fillRect(0, 0, cv.width, cv.height);
      if (!cur) return;
      const k = scale();
      const t = terrainImg();
      if (t) {
        g.imageSmoothingEnabled = false;
        g.drawImage(t, 0, 0, cur.w * k, cur.h * k);
      }
      const takenBy = new Map(cur.taken.map((x) => [x.i, x]));
      cur.pts.forEach(([x, y], i) => {
        const tk = takenBy.get(i);
        const cx = x * k;
        const cy = y * k;
        g.beginPath();
        g.arc(cx, cy, tk?.me ? 7 : 5, 0, Math.PI * 2);
        g.fillStyle = tk?.me ? "#ffd060" : tk ? "#b0302a" : "#7fb070";
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = "#050405";
        g.stroke();
        if (tk) {
          const right = cx > cv.width - 70;
          g.font = "11px Georgia, serif";
          g.textAlign = right ? "right" : "left";
          g.fillStyle = tk.me ? "#ffe4a0" : "#e8c0b0";
          g.fillText(tk.me ? tr("You") : tk.name, cx + (right ? -9 : 9), cy + 4);
        }
      });
    };
    cv.addEventListener("click", (e) => {
      if (!cur) return;
      const r = cv.getBoundingClientRect();
      const k = scale() * (r.width / cv.width);
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      let best = -1;
      let bd = 18;
      cur.pts.forEach(([x, y], i) => {
        const d = Math.hypot(x * k - mx, y * k - my);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0) return;
      const tk = cur.taken.find((x) => x.i === best);
      if (tk && !tk.me) {
        note.textContent = `${tk.name} already stands there.`;
        return;
      }
      if (tk?.me) return;
      uiSound("ui.click");
      net.sendRaw({ t: "r-spawn", i: best });
      note.textContent = HINT;
    });
    // Clicks on the picker never reach the game canvas below.
    box.addEventListener("mousedown", (e) => e.stopPropagation());
    return {
      show(m: Extract<RoomServerMsg, { t: "r-spawns" }>) {
        cur = m;
        timer.textContent = `${Math.max(0, m.left)}s`;
        box.style.display = "block";
        draw();
      },
      hide() {
        cur = null;
        box.style.display = "none";
      },
    };
  })();

  // ---- room messages ------------------------------------------------------------------

  net.onRoom = (m: RoomServerMsg) => {
    switch (m.t) {
      case "r-state":
        room = m;
        social.setMembers(m.members);
        if (screen === "room" && !inMatch && !practicing) renderRoom();
        break;
      case "r-chat":
        pushChat(m);
        if (inMatch || practicing) social.addLine(m.from, m.text, !!m.sys);
        break;
      case "r-go":
        inMatch = true;
        practicing = false;
        net.resetMatch();
        h.resetMatch();
        break;
      case "r-practice":
        practicing = true;
        net.resetMatch();
        h.resetMatch();
        break;
      case "r-left":
        // Out of the match / practice, still in the hall (Esc > Leave, or the match start).
        inMatch = false;
        practicing = false;
        spawnPick.hide();
        social.reset();
        h.resetMatch();
        renderRoom();
        break;
      case "r-spawns":
        if (m.done || !inMatch) spawnPick.hide();
        else spawnPick.show(m);
        break;
      case "r-end":
        inMatch = false;
        practicing = false;
        spawnPick.hide();
        lastResult = m.result;
        social.reset();
        h.resetMatch();
        renderPost(m.result, true);
        break;
      case "r-full":
        renderBrowser();
        status("That hall is full.");
        break;
      case "r-kicked":
        spawnPick.hide();
        inMatch = false;
        practicing = false;
        leavingOnPurpose = true;
        net.detach();
        leavingOnPurpose = false;
        h.resetMatch();
        renderMain("You were kicked from the hall.");
        break;
      case "r-closed":
        if (host) return; // our own shutdown
        leavingOnPurpose = true;
        net.detach();
        leavingOnPurpose = false;
        h.resetMatch();
        renderMain(inMatch ? `The host left: the match is over. (${m.reason})` : m.reason);
        inMatch = false;
        practicing = false;
        spawnPick.hide();
        break;
    }
  };

  // Esc in the menus goes back a screen (the game's Esc handling is inactive while not joined).
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || overlay.style.display === "none") return;
    if (screen === "browser") renderMain();
    else if (screen === "post") net.connected ? renderRoom() : renderMain();
  });

  renderTitle();

  return {
    onWelcome() {
      hide();
      musicScene("match");
      h.focusGame();
    },
    action: (a) => social.action(a),
    leaveMatch() {
      if (!net.connected || (net.mode !== "p2p" && net.mode !== "host") || (!inMatch && !practicing)) return false;
      net.sendRaw({ t: "r-leave" }); // the hall answers r-left (back to the room screen)
      return true;
    },
    onDisconnected(left, wasJoined) {
      social.reset();
      spawnPick.hide();
      practicing = false;
      if (leavingOnPurpose) return;
      const reason = net.closeReason;
      const wasHost = !!host;
      if (host) {
        // Our own session ended (Leave from the Esc menu closes the hall).
        host.stop("The host left.");
        host = null;
        warn.style.display = "none";
      }
      room = null;
      const wasInMatch = inMatch && !wasHost;
      inMatch = false;
      if (dedicatedJoin) {
        dedicatedJoin = false;
        renderMain(left ? "" : wasJoined ? "Disconnected from the server." : "Could not connect to a dedicated server.");
        return;
      }
      // Dropped out of a running match: the hero waits in the hall's match for REJOIN_GRACE seconds.
      const lost = "Lost the connection to the host. If the hall is still open, join it again within 75 seconds to get your hero back.";
      renderMain(left ? "" : wasJoined ? (wasInMatch ? lost : "The host left: the match is over.") : reason && reason !== "closed" ? reason : "Lost the connection to the host.");
    },
    onOpen() {
      if (dedicatedJoin && net.mode === "ws") {
        net.send({ t: "join", name: profileName, weapon: "sword", cls: profileCls } as Parameters<Net["send"]>[0]);
      }
    },
    status,
    replayAttach: DEV_SOLO
      ? (conn) => {
          enterRoom();
          net.attach(conn, "p2p");
        }
      : undefined,
  };
}
