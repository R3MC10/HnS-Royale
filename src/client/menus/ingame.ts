// In-match social bits: chat (Enter) and the social panel (J) listing everyone in the match / hall.
//
// Chat runs over the game connection ({t:"chat"}, server/host.ts), so it works on dedicated servers
// and P2P alike. Prefixes: "@name msg" whispers, "/w name msg" too, "/r msg" replies to the last
// whisper, "/mute name" / "/unmute name" keep a local mute list, "/help" lists them. Once the fight
// is on, dead players are ghosts: the server only delivers their lines to other dead players.
// Ctrl/Shift+click an inventory item while chat is open links it (inventory.ts -> insertItemLink).
//
// The log fades after a while; hovering it brings the history back and it scrolls (50 lines).
// Up / Down in the input recall sent messages.
//
// The social panel is a LEFT-dock panel (hud/dock.ts keeps one of character / skills / social).
import type { RoomMember } from "../../net/roomproto";
import { CHAT_MAX } from "../../net/roomproto";
import { CLASS_BY_ID } from "../../shared/content/classes";
import { RARITY_COLORS } from "../../shared/content/loot";
import type { Item } from "../../shared/items";
import type { BoardEntry, ChatMsg, ClientMsg, ServerMsg } from "../../shared/protocol";
import type { Net } from "../net";
import { t, tr } from "../i18n";
import { actionLabel, onBindsChange } from "../keybinds";
import { registerPanel, setAliveHook } from "../options";
import { attachSkinBackdrop } from "../inventory";
import { panelHead } from "../progstyle";
import { getSettings, subscribe } from "../settings";
import { getHudLayout, onHudLayoutChange, rectToCss } from "../hud/layout";
import type { HudLayout } from "../hud/types";

const CSS = `
#hns-chat { position: fixed; left: 14px; bottom: 150px; width: min(440px, calc(100vw - 28px)); z-index: 12; pointer-events: none;
  font-family: var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif); font-size: var(--chat-fs, 14px); color: #e4d6b8;
  -webkit-font-smoothing: antialiased; box-sizing: border-box; border-radius: 5px; padding: 0; }
#hns-chat .log { pointer-events: auto; max-height: calc(var(--chat-fs, 14px) * 1.55 * 8 + 18px); overflow-y: auto; overflow-x: hidden;
  scrollbar-width: none; display: flex; flex-direction: column; align-items: flex-start; }
#hns-chat .log::-webkit-scrollbar { width: 0; }
#hns-chat .log:hover, #hns-chat.open .log { scrollbar-width: thin; scrollbar-color: #5a4a3c transparent; }
#hns-chat .ln { padding: 1px 6px; margin-top: 1px; max-width: 100%; line-height: 1.45; opacity: var(--chat-op, 1);
  text-shadow: 0 1px 2px #000, 0 0 6px rgba(0,0,0,0.9); transition: opacity 1s; overflow-wrap: anywhere; }
#hns-chat .ln b { color: #d9b26a; font-weight: 600; }
#hns-chat .ln.sys { color: #9a8c72; font-style: italic; }
#hns-chat .ln.w, #hns-chat .ln.w b { color: #c890e8; }
#hns-chat .ln.spec { color: #8a8a90; font-style: italic; }
#hns-chat .ln.spec b { color: #a8a8b4; }
#hns-chat .ln.spec b::before { content: "\\2020 "; opacity: 0.7; }
#hns-chat .ln.hall b { color: #b8a27a; }
#hns-chat .ln.old { opacity: 0; }
#hns-chat .log:hover .ln.old, #hns-chat.open .ln.old { opacity: var(--chat-op, 1); }
#hns-chat .ln .lk { cursor: help; border-bottom: 1px dotted currentColor; font-weight: 600; pointer-events: auto; }
#hns-chat .tabs { display: none; gap: 2px; margin: 0 0 4px; pointer-events: auto; }
#hns-chat.open .tabs { display: flex; }
#hns-chat .tabs button { font: 600 11px var(--font-title, "Cinzel", Georgia, serif); letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer;
  color: #8c806a; padding: 4px 10px; border: 1px solid #050405; border-bottom: 0; border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #221d20, #141114); box-shadow: 0 0 0 1px #3a3136; }
#hns-chat .tabs button.on { color: #ffe2a8; background: linear-gradient(180deg, #3a2a22, #1a1416); box-shadow: 0 0 0 1px #8c7448; }
#hns-chat.open { pointer-events: auto; padding: 8px 10px 10px;
  background: radial-gradient(ellipse at 50% 0%, rgba(120,70,40,0.10), transparent 60%), linear-gradient(180deg, rgba(27,23,25,0.94), rgba(13,11,13,0.96));
  border: 1px solid #050405; box-shadow: 0 0 0 1px #3a3136, 0 0 0 2px #0d0b0d, 0 0 0 3px rgba(140,116,72,0.55), 0 12px 40px rgba(0,0,0,0.7),
  inset 0 1px 0 rgba(255,230,190,0.06), inset 0 0 30px rgba(0,0,0,0.55); }
#hns-chat.open::before { content: ""; position: absolute; left: 12px; right: 12px; top: 0; height: 1px;
  background: linear-gradient(90deg, transparent, #c8a060 30%, #c8a060 70%, transparent); opacity: 0.55; }
#hns-chat.w-only .ln:not(.w):not(.sys) { display: none; }
#hns-chat input { pointer-events: auto; display: none; width: 100%; margin-top: 7px; box-sizing: border-box; font: inherit; color: #f2e4c6;
  background: linear-gradient(180deg, #070608, #121013); border: 1px solid #050405; border-radius: 3px; padding: 7px 10px; outline: none;
  box-shadow: 0 0 0 1px #3a3136, inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,220,170,0.05); }
#hns-chat input:focus { box-shadow: 0 0 0 1px #8c7448, inset 0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(200,140,60,0.18); }
#hns-chat.ghost input { color: #b8b8c4; }
#hns-chat.open input { display: block; }
#hns-social { position: fixed; left: 16px; top: 6vh; z-index: 12; display: none; width: 300px; max-height: 70vh; box-sizing: border-box;
  flex-direction: column; overflow: hidden; color: #e4d6b8; font-family: var(--font-body, "Palatino Linotype", Georgia, serif); -webkit-font-smoothing: antialiased;
  background: #100e0d; box-shadow: 0 18px 60px rgba(0,0,0,0.85), 0 0 0 1px #050405; }
#hns-social .sc { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 4px 16px 14px; zoom: var(--hns-ui, 1); scrollbar-width: thin; scrollbar-color: #5a4a3c #0c0b0d; }
#hns-social h3 { margin: 6px 0 8px; font-family: var(--font-title, "Cinzel", Georgia, serif); color: #c8a060; letter-spacing: 0.16em; font-size: 12px;
  text-transform: uppercase; border-bottom: 1px solid rgba(140,116,72,0.28); padding-bottom: 5px; }
#hns-social .r { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 14px; border-bottom: 1px solid rgba(140,116,72,0.1); }
#hns-social .r .pip { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; background: #5e5444; box-shadow: 0 0 0 1px #050405; }
#hns-social .r .pip.alive { background: radial-gradient(circle at 40% 35%, #c8f0a0, #4a8a2a); box-shadow: 0 0 0 1px #050405, 0 0 5px rgba(120,220,80,0.5); }
#hns-social .r .pip.out { background: radial-gradient(circle at 40% 35%, #a04030, #4a120c); }
#hns-social .r .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#hns-social .r.me .nm { color: #ffe2a8; }
#hns-social .r.out .nm { color: #8a8070; text-decoration: line-through; text-decoration-color: rgba(160,60,40,0.6); }
#hns-social .r i { color: #9a8c72; font-size: 12px; white-space: nowrap; }
#hns-social .r .k { color: #d9b26a; font-size: 12px; font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
#hns-social .r button { font: 11px var(--font-body, Georgia, serif); color: #9a8c74; cursor: pointer; padding: 2px 7px; border-radius: 3px;
  border: 1px solid #050405; background: linear-gradient(180deg, #252025, #161316); box-shadow: 0 0 0 1px #3a3136; }
#hns-social .r button:hover { color: #ffe2a8; box-shadow: 0 0 0 1px #9a7a48; }
#hns-social .r button.on { color: #ff9a86; box-shadow: 0 0 0 1px #8c3424; }
#hns-social .sub { font-family: var(--font-title, "Cinzel", Georgia, serif); color: #8c7448; letter-spacing: 0.12em; font-size: 11px; text-transform: uppercase; margin: 10px 0 2px; }
#hns-social .hint { color: #5e5444; font-size: 12px; margin-top: 8px; line-height: 1.5; }
`;

export interface InGameSocial {
  /** A key action from main.ts; returns true when handled. */
  action(a: string): boolean;
  addLine(from: string, text: string, sys?: boolean): void;
  setMembers(m: RoomMember[]): void;
  /** Hide everything (left the match). */
  reset(): void;
  readonly typing: boolean;
}

// ---- module state (exported hooks for dock.ts / inventory.ts / options.ts) ----------------

let api: {
  open: () => boolean;
  link: (it: Item) => void;
  socialOpen: () => boolean;
  socialToggle: (on?: boolean) => void;
} | null = null;
let tipShow: ((item: Item, x: number, y: number, compare: boolean, hint: string) => void) | null = null;
let tipHide: (() => void) | null = null;

/** True while the chat input is open (inventory.ts: Ctrl/Shift+click links the item instead). */
export function chatIsOpen(): boolean {
  return !!api?.open();
}
/** Link an inventory item into the open chat input. */
export function insertItemLink(item: Item): void {
  api?.link(item);
}
/** Item tooltip used when hovering a linked item in the chat log (inventory.ts passes ui.showTip). */
export function setChatItemTip(show: typeof tipShow, hide: typeof tipHide): void {
  tipShow = show;
  tipHide = hide;
}
/** Social panel state for the left dock (hud/dock.ts). */
export function isSocialOpen(): boolean {
  return !!api?.socialOpen();
}
export function toggleSocial(on?: boolean): void {
  api?.socialToggle(on);
}

const MUTE_KEY = "hns-chat-mutes";
function loadMutes(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(MUTE_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === "string").map((x: string) => x.toLowerCase()) : []);
  } catch {
    return new Set();
  }
}

const CHAT_SIZES = { small: 12, normal: 14, large: 17 } as const;

export function initInGameSocial(opts: { canChat: () => boolean; send: (text: string) => void; inMatch: () => boolean; net?: Net }): InGameSocial {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.id = "hns-chat";
  const tabs = document.createElement("div");
  tabs.className = "tabs";
  const log = document.createElement("div");
  log.className = "log";
  const input = document.createElement("input");
  input.maxLength = CHAT_MAX;
  box.append(tabs, log, input);
  document.body.appendChild(box);
  // Bottom-left anchor comes from the shared HUD layout (above the life globe / points), not a fixed 150px.
  const placeChat = (L: HudLayout) => {
    const r = rectToCss(L, L.chat);
    box.style.left = `${Math.max(4, Math.round(r.left))}px`;
    box.style.bottom = `${Math.max(0, Math.round(r.bottom))}px`;
  };
  placeChat(getHudLayout());
  onHudLayoutChange(placeChat);
  const applyLook = () => {
    const ui = getSettings().interface;
    box.style.setProperty("--chat-fs", `${CHAT_SIZES[ui.chatSize] ?? 14}px`);
    box.style.setProperty("--chat-op", String(Math.max(0.3, Math.min(1, ui.chatOpacity ?? 1))));
  };
  applyLook();
  subscribe((_s, g) => {
    if (g === "interface") applyLook();
  });

  // Tabs: All / Whisper (filter the log).
  const tabBtn = (label: string, w: boolean) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("mousedown", (e) => {
      e.preventDefault(); // keep focus in the input
      box.classList.toggle("w-only", w);
      for (const x of Array.from(tabs.children)) x.classList.toggle("on", x === b);
      log.scrollTop = log.scrollHeight;
    });
    return b;
  };
  tabs.append(tabBtn("All", false), tabBtn("Whisper", true));
  tabs.firstElementChild?.classList.add("on");

  const social = document.createElement("div");
  social.id = "hns-social";
  social.addEventListener("contextmenu", (e) => e.preventDefault());
  document.body.appendChild(social);
  let members: RoomMember[] = [];
  let board: BoardEntry[] = [];

  // ---- game-state tracking (alive, scoreboard, chat) from the game connection ----
  let selfId = -1;
  let selfAlive = true;
  let fight = false;
  const net = opts.net;
  const canChat = () => (net ? net.connected : opts.canChat());
  const sendGame = (m: Extract<ClientMsg, { t: "chat" }>) => {
    if (net?.connected) net.send(m);
    else if (!m.to && m.item === undefined) opts.send(m.text); // no game connection: the lobby relay
  };
  if (net) {
    // main.ts owns net.onMessage; chain ours in front of it (it assigns before initMenus runs).
    const prev = net.onMessage;
    net.onMessage = (msg: ServerMsg) => {
      onGameMsg(msg);
      prev(msg);
    };
  }
  setAliveHook(() => selfAlive || !fight);

  const mutes = loadMutes();
  const saveMutes = () => {
    try {
      localStorage.setItem(MUTE_KEY, JSON.stringify([...mutes]));
    } catch {
      /* storage unavailable: mutes last this session */
    }
  };
  const setMute = (name: string, on: boolean) => {
    const k = name.toLowerCase();
    if (on) mutes.add(k);
    else mutes.delete(k);
    saveMutes();
    if (social.style.display === "flex") renderSocial();
  };
  // Key hints follow the current bindings (bar package: keybinds).
  onBindsChange(() => {
    if (social.style.display === "flex") renderSocial();
  });

  let lastWhisper = ""; // who to /r
  const history: string[] = [];
  let histAt = -1;
  let link: { item: Item; token: string } | null = null;

  const syncGhost = () => {
    const ghost = fight && !selfAlive;
    box.classList.toggle("ghost", ghost);
    input.placeholder = ghost
      ? "Only the fallen hear you now… (Enter to send)"
      : `Say something… (Enter to send, Esc to close, @name to whisper)`;
  };
  syncGhost();

  function onGameMsg(msg: ServerMsg) {
    switch (msg.t) {
      case "welcome":
        selfId = msg.id;
        selfAlive = true;
        fight = false;
        board = [];
        syncGhost();
        break;
      case "snap": {
        const me = msg.players.find((p) => p.id === selfId);
        const f = msg.phase === "fight";
        const a = me ? me.alive : selfAlive;
        if (a !== selfAlive || f !== fight) {
          selfAlive = a;
          fight = f;
          syncGhost();
        }
        if (msg.board) {
          board = msg.board;
          if (social.style.display === "flex") renderSocialSoon();
        }
        break;
      }
      case "chat":
        onChat(msg);
        break;
    }
  }
  let socialTimer: ReturnType<typeof setTimeout> | null = null;
  const renderSocialSoon = () => {
    if (socialTimer) return;
    socialTimer = setTimeout(() => {
      socialTimer = null;
      if (social.style.display === "flex") renderSocial();
    }, 250);
  };

  const closeChat = () => {
    box.classList.remove("open");
    input.value = "";
    link = null;
    histAt = -1;
    input.blur();
    log.scrollTop = log.scrollHeight;
    (document.getElementById("game") as HTMLCanvasElement | null)?.focus();
  };
  const openChat = (prefill = "") => {
    box.classList.add("open");
    if (prefill) input.value = prefill;
    input.focus();
    log.scrollTop = log.scrollHeight;
  };

  const sys = (text: string) => addLine({ from: "", text, cls: "sys" });

  /** Parse prefixes and send. */
  const submit = (raw: string) => {
    let t = raw.trim();
    if (!t) return;
    history.push(t);
    if (history.length > 30) history.shift();
    let to: string | undefined;
    const cmd = /^\/(\w+)\s*(.*)$/s.exec(t);
    if (cmd) {
      const [, c, rest] = cmd;
      const lc = c.toLowerCase();
      if (lc === "help" || lc === "?") {
        sys("@name msg or /w name msg: whisper · /r msg: reply · /mute name, /unmute name · Ctrl+click an item to link it");
        return;
      }
      if (lc === "mute" || lc === "unmute") {
        const n = rest.trim();
        if (!n) return sys(`Usage: /${lc} name`);
        setMute(n, lc === "mute");
        return sys(lc === "mute" ? `${n} is muted.` : `${n} is no longer muted.`);
      }
      if (lc === "r") {
        if (!lastWhisper) return sys("No one has whispered to you yet.");
        to = lastWhisper;
        t = rest.trim();
      } else if (lc === "w" || lc === "whisper" || lc === "tell") {
        const m = /^(\S+)\s+(.+)$/s.exec(rest.trim());
        if (!m) return sys("Usage: /w name message");
        to = m[1];
        t = m[2];
      } else return sys(`Unknown command /${c}. Type /help.`);
    } else if (t.startsWith("@")) {
      const m = /^@(\S+)\s+(.+)$/s.exec(t);
      if (!m) return sys("Usage: @name message");
      to = m[1];
      t = m[2];
    }
    if (!t) return;
    const item = link && t.includes(link.token) ? link.item.id : undefined;
    sendGame({ t: "chat", text: t, ...(to ? { to } : {}), ...(item !== undefined ? { item } : {}) });
  };

  input.addEventListener("keydown", (e) => {
    e.stopPropagation(); // typing must not drive the hero
    if (e.key === "Enter") {
      submit(input.value);
      closeChat();
    } else if (e.key === "Escape") closeChat();
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (!history.length) return;
      e.preventDefault();
      if (e.key === "ArrowUp") histAt = histAt < 0 ? history.length - 1 : Math.max(0, histAt - 1);
      else histAt = histAt < 0 ? -1 : histAt + 1;
      if (histAt >= history.length) histAt = -1;
      input.value = histAt < 0 ? "" : history[histAt];
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
  input.addEventListener("keyup", (e) => e.stopPropagation());
  // Esc layers (options.ts): chat input is its own layer above full-screen and docked panels.
  registerPanel({ isOpen: () => box.classList.contains("open"), close: closeChat, layer: "chat" });
  registerPanel({ isOpen: () => social.style.display === "flex", close: () => setSocial(false), layer: "docked" });

  // ---- log lines ----
  const addLine = (l: { from: string; text: string; cls: string; item?: Item; to?: string }) => {
    const d = document.createElement("div");
    d.className = "ln " + l.cls;
    if (l.from || l.to) {
      d.dataset.noi18n = ""; // player-written
      const b = document.createElement("b");
      b.textContent = l.to ? t("To {$a}:", { a: l.to }) + " " : l.cls === "w" ? t("{$a} whispers:", { a: l.from }) + " " : `${l.from}: `;
      if (l.from && !l.to) {
        b.style.cursor = "pointer";
        b.title = tr("Click to whisper");
        b.addEventListener("mousedown", (e) => {
          e.preventDefault();
          openChat(`@${l.from} `);
        });
      }
      d.append(b);
    }
    appendText(d, l.text, l.item);
    const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    log.append(d);
    while (log.children.length > 50) log.firstElementChild?.remove();
    if (stick) log.scrollTop = log.scrollHeight;
    setTimeout(() => d.classList.add("old"), 10000);
  };
  /** Text with an optional [Item name] token rendered as a rarity-coloured, hoverable link. */
  const appendText = (d: HTMLElement, text: string, item?: Item) => {
    const token = item ? `[${item.n}]` : "";
    const at = item ? text.indexOf(token) : -1;
    if (!item) return void d.append(document.createTextNode(text));
    const span = document.createElement("span");
    span.className = "lk";
    span.textContent = item ? `[${tr(item.n)}]` : token;
    span.style.color = (RARITY_COLORS as readonly string[])[item.r] ?? (item.r === 3 ? "#d8803a" : "#e4d6b8");
    span.addEventListener("mouseenter", (e) => {
      try {
        tipShow?.(item, e.clientX, e.clientY, false, "Linked item");
      } catch {
        /* malformed link: no tooltip */
      }
    });
    span.addEventListener("mousemove", (e) => {
      try {
        tipShow?.(item, e.clientX, e.clientY, false, "Linked item");
      } catch {
        /* ignore */
      }
    });
    span.addEventListener("mouseleave", () => tipHide?.());
    if (at < 0) d.append(document.createTextNode(text + " "), span);
    else d.append(document.createTextNode(text.slice(0, at)), span, document.createTextNode(text.slice(at + token.length)));
  };

  function onChat(m: ChatMsg) {
    if (m.ch !== "sys" && m.from && mutes.has(m.from.toLowerCase()) && !m.to) return;
    if (m.ch === "sys") return sys(m.text);
    if (m.ch === "w" && !m.to) lastWhisper = m.from;
    addLine({ from: m.from, text: m.text, cls: m.ch === "w" ? "w" : m.ch === "spec" ? "spec" : "", item: m.item, to: m.to });
  }

  // ---- social panel (left dock) ----
  const setSocial = (on: boolean) => {
    social.style.display = on ? "flex" : "none";
    if (on) renderSocial();
  };
  const renderSocial = () => {
    const list = document.createElement("div");
    list.className = "sc";
    social.replaceChildren(panelHead("Social", "social", () => setSocial(false)), list);
    attachSkinBackdrop(social, "panel");
    const muteBtn = (name: string) => {
      const b = document.createElement("button");
      b.type = "button";
      const on = mutes.has(name.toLowerCase());
      b.textContent = on ? "Unmute" : "Mute";
      b.classList.toggle("on", on);
      b.addEventListener("click", () => setMute(name, !on));
      return b;
    };
    const byName = new Map(members.map((m) => [m.name, m]));
    const inMatch = board.length > 0;
    const h = document.createElement("h3");
    h.textContent = inMatch ? `In this match (${board.filter((b) => b.alive).length} of ${board.length} standing)` : `In this hall (${members.length})`;
    list.append(h);
    if (inMatch) {
      const rows = [...board].sort((a, b) => Number(b.alive) - Number(a.alive) || b.kills - a.kills || a.name.localeCompare(b.name));
      for (const e of rows) {
        const r = document.createElement("div");
        r.className = "r" + (e.alive ? "" : " out") + (e.id === selfId ? " me" : "");
        const pip = document.createElement("span");
        pip.className = "pip " + (e.alive ? "alive" : "out");
        pip.title = e.alive ? "Standing" : "Out";
        const n = document.createElement("span");
        n.className = "nm";
        const lm = byName.get(e.name);
        n.textContent = (lm?.host ? "♛ " : "") + e.name;
        n.style.color = e.alive && e.id !== selfId ? e.color : "";
        const c = document.createElement("i");
        c.textContent = lm ? CLASS_BY_ID.get(lm.cls)?.name ?? lm.cls : "";
        const k = document.createElement("span");
        k.className = "k";
        k.textContent = `${e.kills} ✕`;
        k.title = `${e.kills} kill${e.kills === 1 ? "" : "s"}`;
        r.append(pip, n, c, k);
        if (e.id !== selfId) r.append(muteBtn(e.name));
        list.append(r);
      }
      const waiting = members.filter((m) => !m.inMatch);
      if (waiting.length) {
        const s = document.createElement("div");
        s.className = "sub";
        s.textContent = "Waiting in the hall";
        list.append(s);
        for (const m of waiting) list.append(memberRow(m, muteBtn));
      }
    } else {
      for (const m of members) list.append(memberRow(m, muteBtn));
      if (!members.length) {
        const d = document.createElement("div");
        d.className = "hint";
        d.textContent = "The match roster appears once the fight is on.";
        list.append(d);
      }
    }
    const hint = document.createElement("div");
    hint.className = "hint";
    const lbl = (id: string) => (actionLabel(id) === "-" ? "" : actionLabel(id)); // actionLabel gives "-" when unbound
    const chatK = lbl("chat") || "unbound";
    const socK = lbl("social") || "Esc";
    hint.textContent = `${chatK} to chat · @name to whisper · ${socK} to close`;
    list.append(hint);
  };
  const memberRow = (m: RoomMember, muteBtn: (n: string) => HTMLElement) => {
    const r = document.createElement("div");
    r.className = "r";
    const pip = document.createElement("span");
    pip.className = "pip";
    const n = document.createElement("span");
    n.className = "nm";
    n.textContent = (m.host ? "♛ " : "") + m.name;
    const c = document.createElement("i");
    c.textContent = `${CLASS_BY_ID.get(m.cls)?.name ?? m.cls}${m.inMatch ? "" : " · waiting"}`;
    r.append(pip, n, c, muteBtn(m.name));
    return r;
  };

  api = {
    open: () => box.classList.contains("open") && document.activeElement === input,
    link: (it) => {
      const token = `[${it.n}]`;
      if (link && input.value.includes(link.token)) input.value = input.value.replace(link.token, "");
      link = { item: it, token };
      const v = input.value;
      const sep = v && !v.endsWith(" ") ? " " : "";
      input.value = (v + sep + token + " ").slice(0, CHAT_MAX);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    },
    socialOpen: () => social.style.display === "flex",
    socialToggle: (on) => setSocial(on ?? social.style.display !== "flex"),
  };

  return {
    get typing() {
      return document.activeElement === input;
    },
    action(a) {
      if (!opts.inMatch()) return false;
      if (a === "chat") {
        if (!canChat()) {
          sys("Not connected: chat is unavailable.");
          return true;
        }
        openChat();
        return true;
      }
      if (a === "social") {
        setSocial(social.style.display !== "flex");
        return true;
      }
      return false;
    },
    addLine(from, text, isSys) {
      // Lobby relay (r-chat): system notices and hall members who are not in the match.
      if (isSys) return sys(text);
      if (from && mutes.has(from.toLowerCase())) return;
      addLine({ from, text, cls: "hall" });
    },
    setMembers(m) {
      members = m;
      if (social.style.display === "flex") renderSocial();
    },
    reset() {
      closeChat();
      setSocial(false);
      log.replaceChildren();
      board = [];
      fight = false;
      selfAlive = true;
      syncGhost();
    },
  };
}
