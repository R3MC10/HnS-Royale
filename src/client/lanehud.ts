// Breachway HUD (docs/MODE-LANES.md section 9): team score, structures, wave timer, gold, respawn timer,
// winner line, and the Quartermaster vendor window (H, or the button, on your platform or while dead).
// The vendor follows the PoE2 vendor layout: stock on the left (tabs, item tiles with icons and prices,
// item tooltips on hover, click to buy), your bag on the right (click to sell back at a quarter).
// The server validates every purchase / sale (server/modes/lanes.ts handleShop).
// Plain DOM: the i18n MutationObserver translates every text node (Polish entries live in i18n/pl.ts).
import { BASES } from "../shared/content/bases";
import { FLASK_BASES } from "../shared/content/flasks";
import { ROUGH_NAMES, ROUGH_SKILL, ROUGH_SPIRIT, ROUGH_SUPPORT } from "../shared/content/gems";
import { RARITY_COLORS } from "../shared/content/loot";
import { footprint, GRID_H, GRID_W, type GridEntry } from "../shared/grid";
import type { Item } from "../shared/items";
import { currentMap, onMapChange } from "../shared/map";
import type { ClientMsg, LaneMsg } from "../shared/protocol";
import {
  WAYPOINT_KINDS, waypointAt,
  GAMBLE_SLOTS, SPIRIT_LEVEL, SPIRIT_PRICE, SUPPORT_TIERS, TEAM_COLORS, TEAM_NAMES,
  gamblePrice, laneSellValue, maxCrystalLevel, skillCrystalPrice,
} from "../shared/lanes";
import {
  ENHANCE_KINDS, REINF_CAP, REINF_KINDS, REINF_NAME, enhanceBlock, enhancePrice, forgeStep, qualityCur, runesFor,
  type EnhanceKind, type ReinfKind,
} from "../shared/laneshop";
import { SLOTS } from "../shared/content/types";
import { getHudLayout, onHudLayoutChange, rectToCss } from "./hud/layout";
import { setDomRect } from "./hud/lanes";
import { t } from "./i18n";
import { itemIconCanvas } from "./inventory";
import { playSfx } from "./invsfx";
import { hideTip as hideHtmlTip, showTip as showHtmlTip } from "./progstyle";

const SLOT_LABEL: Record<string, string> = {
  weapon: "Weapon", offhand: "Off-hand", body: "Body Armour", helmet: "Helmet", gloves: "Gloves",
  boots: "Boots", belt: "Belt", ring: "Ring", amulet: "Amulet", flask: "Flask",
};
const STRUCT_SHORT: Record<string, string> = { lane_outer: "Outer Spire", lane_inner: "Inner Spire", lane_ward: "Ward", lane_core: "Core" };

/** Item tooltip hooks (the inventory's own tooltip, from main.ts). */
export interface LaneTipHooks {
  show: (it: Item, x: number, y: number, hint: string) => void;
  hide: () => void;
}

let send: (m: ClientMsg) => void = () => {};
let getInv: () => GridEntry[] = () => [];
let tips: LaneTipHooks = { show: () => {}, hide: () => {} };
let st: LaneMsg | null = null;
let bar: HTMLDivElement | null = null;
let panel: HTMLDivElement | null = null;
let shopOpen = false;
type Tab = "gear" | "crystals" | "enhance" | "reinf";
const TABS: [Tab, string][] = [["gear", "Gear"], ["crystals", "Crystals"], ["enhance", "Enhance"], ["reinf", "Reinforcements"]];
let tab: Tab = "gear";
let getEquip: () => Record<string, Item | null> = () => ({});
/** Enhance tab: id of the item being worked on. */
let selId = -1;
let lastPanelKey = "";
let lastGold = -1;
let pending: { kind: "buy" | "sell"; gold: number; at: number } | null = null;
let confirmSell = { id: -1, at: 0 };

/** Shop open: Ctrl+click in the inventory panel sells (worn gear too). Returns false when the shop is closed. */
export function laneQuickSell(it: Item): boolean {
  if (!shopOpen || !st) return false;
  const now = performance.now();
  if (it.r >= 2 && !(confirmSell.id === it.id && now - confirmSell.at < 3000)) {
    confirmSell = { id: it.id, at: now };
    quickNote = { text: t("Ctrl+click {name} again to sell for {n} gold", { name: it.n, n: laneSellValue(it) }), at: now };
    playSfx("ui.click");
    lastPanelKey = "";
    drawShop();
    return true;
  }
  confirmSell = { id: -1, at: 0 };
  quickNote = null;
  pending = { kind: "sell", gold: st.g, at: now };
  hideTips();
  send({ t: "shop", a: "sell", id: it.id });
  return true;
}
let quickNote: { text: string; at: number } | null = null;
let hoverKey = "";

export const isLaneMode = () => currentMap().params.mode === "lanes";
/** Is that structure standing (latest lane HUD message)? True when unknown. */
export function laneStructUp(k: string, tm: 0 | 1): boolean {
  const e = st?.st.find((q) => q[0] === k && q[1] === tm);
  return !e || e[2] > 0;
}

const css = `
#lane-bar{position:fixed;right:8px;top:218px;z-index:30;pointer-events:none;font:12px/1.35 Georgia,serif;color:#e8dcc0;
  background:rgba(12,9,8,.78);border:1px solid #5a4a34;border-radius:4px;padding:5px 8px;width:188px;box-sizing:border-box;text-shadow:0 1px 1px #000}
#lane-bar .row{display:flex;justify-content:space-between;gap:10px}
#lane-bar .pips{display:flex;gap:3px;margin:2px 0}
#lane-bar .pip{flex:1;height:7px;background:#2a2420;border:1px solid #4a3e30;position:relative}
#lane-bar .pip i{position:absolute;left:0;top:0;bottom:0}
#lane-bar .goldrow{display:flex;align-items:center;gap:6px;margin-top:4px;padding:3px 5px;background:rgba(60,44,14,.55);border:1px solid #6a5222;border-radius:3px}
#lane-bar .goldrow b{color:#ffd76a;font-size:15px;letter-spacing:.02em}
#lane-bar .goldrow .lv{margin-left:auto;color:#cbbf9f}
#lane-bar.flash .goldrow{animation:lanegold .6s ease-out}
@keyframes lanegold{0%{background:rgba(200,150,40,.75);box-shadow:0 0 10px #ffcc55}100%{background:rgba(60,44,14,.55);box-shadow:none}}
.lane-coin{display:inline-block;width:12px;height:12px;border-radius:50%;flex:none;vertical-align:-2px;
  background:radial-gradient(circle at 35% 35%,#fff2b0 0,#f0c040 45%,#8a6010 100%);box-shadow:0 0 0 1px #2a1c06}
#lane-bar button{pointer-events:auto;margin-top:5px;width:100%;font:12px Georgia,serif;color:#ffe6b0;background:#3a2a18;border:1px solid #a07a40;border-radius:3px;cursor:pointer;padding:3px}
#lane-wp{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:31;display:none;font:12px/1.35 Georgia,serif;color:#e8dcc0;
  background:rgba(12,9,8,.85);border:1px solid #6a7ca8;border-radius:4px;padding:5px 8px;text-align:center;text-shadow:0 1px 1px #000}
#lane-wp .t{font:600 11px Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#a8c8ff;margin-bottom:4px}
#lane-wp button{font:12px Georgia,serif;color:#e6f0ff;background:#1c2436;border:1px solid #5a74a8;border-radius:3px;cursor:pointer;padding:3px 9px;margin:0 2px}
#lane-wp button:hover{background:#2a3858;border-color:#9fc0ff}
#lane-wp .h{font-size:11px;color:#8a96aa;margin-top:4px}
#lane-wp .bar{height:8px;margin-top:5px;background:#141a26;border:1px solid #3a4a68;position:relative;min-width:220px}
#lane-wp .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#3a6cc8,#bfe0ff)}
#lane-dead{position:fixed;left:50%;top:38%;transform:translateX(-50%);z-index:30;pointer-events:none;font:22px Georgia,serif;color:#ffd0b0;text-shadow:0 2px 3px #000}
#lane-shop{position:fixed;left:50%;top:46%;transform:translate(-50%,-50%);width:max-content;z-index:60;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow:auto;
  font:13px/1.4 Georgia,serif;color:#e8dcc0;background:linear-gradient(#1c1612,#120e0b);border:1px solid #8a6a3a;outline:1px solid #2a2016;outline-offset:-5px;
  border-radius:4px;padding:10px 12px 12px;box-shadow:0 8px 40px #000;user-select:none}
#lane-shop .hd{display:flex;align-items:center;gap:10px;border-bottom:1px solid #4a3a28;padding-bottom:6px;margin-bottom:8px}
#lane-shop .hd h3{margin:0;font:600 18px Georgia,serif;letter-spacing:.12em;color:#ffe6b0;text-transform:uppercase}
#lane-shop .hd .gold{margin-left:auto;display:flex;align-items:center;gap:5px;font-size:15px;color:#ffd76a}
#lane-shop .hd .x{font:14px Georgia,serif;color:#e8dcc0;background:#2c2218;border:1px solid #6a5232;border-radius:3px;cursor:pointer;width:24px;height:24px;padding:0}
#lane-shop .cols{display:flex;gap:14px;align-items:flex-start}
#lane-shop .col h4{margin:0 0 5px;font:600 12px Georgia,serif;letter-spacing:.14em;text-transform:uppercase;color:#c8a870}
#lane-shop .tabs{display:flex;gap:2px;margin-bottom:-1px}
#lane-shop .tab{font:13px Georgia,serif;color:#b8a888;background:#1a1410;border:1px solid #4a3a28;border-bottom:none;border-radius:3px 3px 0 0;padding:4px 14px;cursor:pointer}
#lane-shop .tab.on{color:#ffe6b0;background:#2a2016;border-color:#8a6a3a}
#lane-shop .stock{display:grid;grid-template-columns:repeat(5,66px);grid-auto-rows:82px;gap:5px;padding:7px;background:#0d0a08;border:1px solid #8a6a3a;min-height:260px;align-content:start}
#lane-shop .tile{position:relative;background:linear-gradient(#211a14,#16110d);border:1px solid #3e3022;border-radius:2px;cursor:pointer;display:flex;flex-direction:column;align-items:center;padding-top:3px}
#lane-shop .tile:hover{border-color:#c8a060;background:linear-gradient(#2e2318,#1c150f)}
#lane-shop .tile canvas{width:52px;height:52px;pointer-events:none}
#lane-shop .tile .pr{margin-top:auto;margin-bottom:3px;display:flex;align-items:center;gap:3px;font-size:12px;color:#ffd76a}
#lane-shop .tile .pr .lane-coin{width:10px;height:10px}
#lane-shop .tile .tg{position:absolute;left:3px;top:2px;font-size:10px;color:#d8c8a8;text-shadow:0 1px 1px #000}
#lane-shop .tile.off{cursor:default}
#lane-shop .tile.off canvas{opacity:.4;filter:grayscale(.6)}
#lane-shop .tile.off .pr{color:#d0503c}
#lane-shop .tile.lock .pr{color:#8a8070}
#lane-shop .bag{position:relative;display:grid;grid-template-columns:repeat(${GRID_W},30px);grid-template-rows:repeat(${GRID_H},30px);gap:0;
  background:#0d0a08;border:1px solid #8a6a3a;background-image:linear-gradient(#2a2016 1px,transparent 1px),linear-gradient(90deg,#2a2016 1px,transparent 1px);background-size:30px 30px}
#lane-shop .bi{position:relative;cursor:pointer;background:rgba(40,52,90,.28);border:1px solid #3a3a52;box-sizing:border-box;overflow:hidden}
#lane-shop .bi:hover{background:rgba(90,110,170,.38);border-color:#9aa8d8}
#lane-shop .bi.cf{background:rgba(160,60,30,.5);border-color:#ff8a50}
#lane-shop .bi canvas{width:100%;height:100%;pointer-events:none}
#lane-shop .note{color:#9a8e76;font-size:11px;margin-top:6px;max-width:372px}
#lane-shop .sellv{margin-top:6px;font-size:12px;color:#c8bca0}
#lane-shop .bi.sel,#lane-shop .eq.sel{outline:2px solid #ffd76a;outline-offset:-2px;background:rgba(160,120,40,.35)}
#lane-shop .eqrow{display:grid;grid-template-columns:repeat(10,34px);gap:3px;margin-bottom:6px}
#lane-shop .eq{width:34px;height:34px;background:#0d0a08;border:1px solid #3e3022;cursor:pointer;box-sizing:border-box}
#lane-shop .eq:hover{border-color:#c8a060}
#lane-shop .eq canvas{width:100%;height:100%;pointer-events:none}
#lane-shop .selbox{display:flex;align-items:center;gap:8px;padding:5px 7px;margin-bottom:6px;background:#0d0a08;border:1px solid #4a3a28;min-height:44px;width:356px;box-sizing:border-box}
#lane-shop .selbox canvas{width:40px;height:40px;flex:none}
#lane-shop .selbox .nm{font-weight:600}
#lane-shop .selbox .sub{font-size:11px;color:#9a8e76}
#lane-shop .stock.sv{grid-auto-rows:78px;min-height:0}
#lane-shop .stock.rn{grid-template-columns:repeat(6,54px);grid-auto-rows:68px;min-height:0;margin-top:5px}
#lane-shop .stock.rn canvas{width:40px;height:40px}
#lane-shop .tile .tg.w{position:static;margin-top:1px;text-align:center;font-size:10px;line-height:1.1}
#lane-shop .reinf{width:356px;display:flex;flex-direction:column;gap:7px;padding:7px;background:#0d0a08;border:1px solid #8a6a3a}
#lane-shop .ru{padding:6px 7px;background:linear-gradient(#211a14,#16110d);border:1px solid #3e3022}
#lane-shop .ru .top{display:flex;justify-content:space-between;align-items:baseline}
#lane-shop .ru .top b{color:#ffe6b0}
#lane-shop .ru .barw{height:10px;margin:5px 0 4px;background:#1a1410;border:1px solid #4a3a28;position:relative}
#lane-shop .ru .barw i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#8a6010,#f0c040)}
#lane-shop .ru .who{font-size:11px;color:#9a8e76;min-height:15px}
#lane-shop .ru .btns{display:flex;gap:4px;margin-top:4px}
#lane-shop .ru button{font:12px Georgia,serif;color:#ffe6b0;background:#3a2a18;border:1px solid #a07a40;border-radius:3px;cursor:pointer;padding:2px 9px}
#lane-shop .ru button:disabled{color:#7a6e5a;border-color:#4a3a28;background:#1e1712;cursor:default}
`;

/** Bar placement: right-aligned with the minimap, just under the area name (no overlap with the map at any size). */
function placeBar() {
  if (!bar || bar.style.display === "none") return;
  const L = getHudLayout();
  const anchor = { x: L.minimap.x, y: L.royale.y + 8, w: L.minimap.w, h: 1 };
  const box = rectToCss(L, anchor);
  bar.style.top = `${Math.round(box.top)}px`;
  bar.style.right = `${Math.max(4, Math.round(box.right))}px`;
  // Claim the bar's rect so world labels / loot labels keep out of it (hud/lanes.ts).
  const r = bar.getBoundingClientRect();
  setDomRect("lane-bar", { x: r.left / L.u, y: r.top / L.u, w: r.width / L.u, h: r.height / L.u });
}

function ensureDom() {
  if (bar) return;
  const s = document.createElement("style");
  s.textContent = css;
  document.head.appendChild(s);
  bar = document.createElement("div");
  bar.id = "lane-bar";
  bar.style.display = "none";
  document.body.appendChild(bar);
  panel = document.createElement("div");
  panel.id = "lane-shop";
  panel.style.display = "none";
  document.body.appendChild(panel);
  const dead = document.createElement("div");
  dead.id = "lane-dead";
  dead.style.display = "none";
  document.body.appendChild(dead);
  onHudLayoutChange(() => placeBar());
  panel.addEventListener("click", onPanelClick);
  panel.addEventListener("mousemove", onPanelHover);
  panel.addEventListener("mouseleave", () => hideTips());
  bar.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button")) toggleShop(true);
  });
}

export function initLaneHud(sendFn: (m: ClientMsg) => void, inv: () => GridEntry[], tipHooks?: LaneTipHooks, equip?: () => Record<string, Item | null>): void {
  send = sendFn;
  if (equip) getEquip = equip;
  getInv = inv;
  if (tipHooks) tips = tipHooks;
  window.addEventListener("keydown", (e) => {
    if (e.repeat || !st || !isLaneMode()) return;
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.code === "KeyH") toggleShop(!shopOpen);
    else if (e.code === "Escape" && shopOpen) {
      // Close only the shop: keep Esc from also opening the pause menu.
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleShop(false);
    }
  }, true);
  onMapChange((m) => {
    if (m.params.mode !== "lanes") hideAll();
  });
}

function hideAll() {
  st = null;
  if (wpEl) wpEl.style.display = "none";
  shopOpen = false;
  lastGold = -1;
  hideTips();
  if (bar) bar.style.display = "none";
  if (panel) panel.style.display = "none";
  setDomRect("lane-bar", null);
  const d = document.getElementById("lane-dead");
  if (d) d.style.display = "none";
}

function hideTips() {
  hoverKey = "";
  tips.hide();
  hideHtmlTip();
}

function toggleShop(on: boolean) {
  if (!panel) return;
  const was = shopOpen;
  shopOpen = on && !!st?.shop;
  if (on && !st?.shop) playSfx("ui.error");
  panel.style.display = shopOpen ? "block" : "none";
  lastPanelKey = "";
  if (shopOpen !== was) playSfx(shopOpen ? "ui.open" : "ui.close");
  if (!shopOpen) hideTips();
  if (shopOpen) drawShop();
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const WP_NAME: Record<string, string> = { base: "Base", lane_core: "Core", lane_ward: "Ward", lane_inner: "Inner Spire", lane_outer: "Outer Spire" };

/** Waypoints of both teams for the maps: position, standing, yours or not. */
export function laneWaypoints(): { k: string; x: number; y: number; up: boolean; mine: boolean; color: string }[] {
  if (!st || !isLaneMode()) return [];
  const out: { k: string; x: number; y: number; up: boolean; mine: boolean; color: string }[] = [];
  for (const tm of [0, 1] as const)
    for (const k of WAYPOINT_KINDS) {
      const q = waypointAt(tm, k);
      out.push({ k, x: q.x, y: q.y, up: tm === st.tm ? (st.wp ?? []).includes(k) : k === "base" || laneStructUp(k, tm), mine: tm === st.tm, color: TEAM_COLORS[tm] });
    }
  return out;
}

/** Ask the server to travel to your waypoint `k` (2 s channel; you must stand at a waypoint). */
export function laneTravel(k: string): void {
  if (!st) return;
  if (!st.wa) {
    playSfx("ui.error");
    flashToast(t("Stand at one of your waypoints to travel"));
    return;
  }
  playSfx("ui.click");
  send({ t: "wp", to: k });
}

function flashToast(text: string) {
  const el = document.getElementById("toasts");
  if (!el) return;
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = text;
  el.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}

let wpEl: HTMLDivElement | null = null;
let wpKey = "";
function drawWaypointPanel(msg: LaneMsg) {
  if (!wpEl) {
    wpEl = document.createElement("div");
    wpEl.id = "lane-wp";
    document.body.appendChild(wpEl);
    wpEl.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-wp]");
      if (b) laneTravel(b.dataset.wp!);
    });
  }
  if (msg.ch !== undefined && msg.cto) {
    const f = Math.max(0, Math.min(1, 1 - msg.ch / 2));
    wpEl.style.display = "block";
    wpKey = "";
    wpEl.innerHTML = `<div class="t">${esc(t("Travelling to {x}", { x: t(WP_NAME[msg.cto] ?? msg.cto) }))}</div><div class="bar"><i style="width:${Math.round(f * 100)}%"></i></div><div class="h">${esc(t("Taking damage cancels the travel"))}</div>`;
    return;
  }
  if (!msg.wa || !msg.wp || msg.dead > 0 || msg.win !== undefined || shopOpen) {
    wpEl.style.display = "none";
    wpKey = "";
    return;
  }
  const key = msg.wp.join(",");
  wpEl.style.display = "block";
  if (key === wpKey) return;
  wpKey = key;
  wpEl.innerHTML = `<div class="t">${esc(t("Waypoint"))}</div>` + WAYPOINT_KINDS.filter((k) => msg.wp!.includes(k)).map((k) => `<button data-wp="${k}">${esc(t(WP_NAME[k]))}</button>`).join("") +
    `<div class="h">${esc(t("Or click a waypoint on the map. 2 s to travel; taking damage cancels it."))}</div>`;
}

export function laneOnMessage(msg: LaneMsg): void {
  if (!isLaneMode()) return;
  ensureDom();
  st = msg;
  drawWaypointPanel(msg);
  const me = msg.tm;
  const foe = (1 - me) as 0 | 1;
  const pips = (team: 0 | 1) =>
    `<div class="pips">${msg.st
      .filter((s) => s[1] === team)
      .map((s) => `<div class="pip" title="${STRUCT_SHORT[s[0]]}"><i style="width:${Math.round(s[2] * 100)}%;background:${TEAM_COLORS[team]}"></i></div>`)
      .join("")}</div>`;
  const ward = msg.st.find((s) => s[0] === "lane_ward" && s[1] === me && s[2] <= 0 && s[3] > 0);
  const foeWard = msg.st.find((s) => s[0] === "lane_ward" && s[1] === foe && s[2] <= 0 && s[3] > 0);
  const wasHidden = bar!.style.display === "none";
  bar!.style.display = "block";
  bar!.innerHTML =
    `<div class="row"><span style="color:${TEAM_COLORS[me]}">${TEAM_NAMES[me]}</span><span>${msg.k[me]}</span></div>` +
    pips(me) +
    `<div class="row"><span style="color:${TEAM_COLORS[foe]}">${TEAM_NAMES[foe]}</span><span>${msg.k[foe]}</span></div>` +
    pips(foe) +
    `<div class="row"><span>Wave ${msg.n}</span><span>next ${mmss(msg.wv)}</span></div>` +
    (ward ? `<div>Your Ward rises in ${ward[3]}</div>` : "") +
    (foeWard ? `<div>Enemy Ward rises in ${foeWard[3]}</div>` : "") +
    `<div class="goldrow"><i class="lane-coin"></i><b>${msg.g}</b><span>${t("gold")}</span><span class="lv">Level ${msg.me}</span></div>` +
    (msg.shop ? `<button>Quartermaster (H)</button>` : "");
  // Gold went up: flash the gold row (PoE2-style currency pulse).
  if (lastGold >= 0 && msg.g > lastGold) {
    bar!.classList.remove("flash");
    void bar!.offsetWidth;
    bar!.classList.add("flash");
  }
  // Purchase / sale confirmed by the server (gold moved the right way within a second).
  if (pending && performance.now() - pending.at < 1500) {
    if (pending.kind === "buy" && msg.g < pending.gold) {
      playSfx("shop.buy");
      pending = null;
    } else if (pending.kind === "sell" && msg.g > pending.gold) {
      playSfx("shop.sell");
      pending = null;
    }
  } else pending = null;
  lastGold = msg.g;
  if (wasHidden) requestAnimationFrame(placeBar);
  else placeBar();
  const dead = document.getElementById("lane-dead")!;
  if (msg.win !== undefined) {
    dead.style.display = "block";
    dead.textContent = msg.win === me ? "Victory: the enemy Core has fallen" : "Defeat: your Core has fallen";
  } else if (msg.dead > 0) {
    dead.style.display = "block";
    dead.textContent = `Respawning in ${msg.dead}`;
  } else dead.style.display = "none";
  if (shopOpen && !msg.shop) toggleShop(false);
  else if (shopOpen) drawShop();
}

// ---- vendor stock -------------------------------------------------------------------------------

interface Offer {
  key: string;
  label: string; // tile tag (short)
  price: number;
  lock?: string; // why it cannot be bought yet
  icon: Item; // representative item for the icon / tooltip
  gamble?: string; // slot
  msg: ClientMsg;
}

/** Representative base for a gamble slot's icon: the first base of that class (flask: the first life flask). */
function sampleItem(slot: string, lv: number): Item {
  if (slot === "flask") {
    const f = FLASK_BASES[0];
    return { id: -1, b: f.id, r: 0, l: lv, n: f.name, m: [] };
  }
  const b = BASES.find((q) => q.cls === slot) ?? BASES[0];
  return { id: -1, b: b.id, r: 0, l: lv, n: b.name, m: [] };
}
const rough = (b: string, l: number): Item => ({ id: -1, b, r: 0, l, n: ROUGH_NAMES[b] ?? b, m: [] });

function offers(lv: number): Offer[] {
  const out: Offer[] = [];
  if (tab === "gear") {
    for (const slot of GAMBLE_SLOTS)
      out.push({ key: "g:" + slot, label: SLOT_LABEL[slot] ?? slot, price: gamblePrice(slot, lv), icon: sampleItem(slot, lv), gamble: slot, msg: { t: "shop", a: "gamble", slot } });
    return out;
  }
  const maxK = maxCrystalLevel(lv);
  for (let k = 1; k <= 10; k++) {
    const need = 2 * (k - 1); // maxCrystalLevel: 1 + floor(level / 2)
    out.push({ key: "s:" + k, label: `Lv ${k}`, price: skillCrystalPrice(k), lock: k > maxK ? t("Requires level {n}", { n: need }) : undefined, icon: rough(ROUGH_SKILL, k), msg: { t: "shop", a: "skill", lv: k } });
  }
  for (const s of SUPPORT_TIERS)
    out.push({ key: "u:" + s.tier, label: t("Tier {n}", { n: s.tier }), price: s.price, lock: lv < s.level ? t("Requires level {n}", { n: s.level }) : undefined, icon: rough(ROUGH_SUPPORT, s.tier), msg: { t: "shop", a: "support", lv: s.tier } });
  out.push({ key: "p", label: "", price: SPIRIT_PRICE, lock: lv < SPIRIT_LEVEL ? t("Requires level {n}", { n: SPIRIT_LEVEL }) : undefined, icon: rough(ROUGH_SPIRIT, Math.max(1, Math.floor(lv / 2))), msg: { t: "shop", a: "spirit" } });
  return out;
}

let shown: Offer[] = [];
let shownBag: GridEntry[] = [];

function drawShop() {
  if (!panel || !st) return;
  const inv = getInv();
  const sel = tab === "enhance" ? findSel() : null;
  const eqKey = tab === "enhance" ? SLOTS.map((q) => getEquip()[q]?.id ?? 0).join(",") : "";
  const rfKey = tab === "reinf" ? JSON.stringify(st.rf ?? []) + st.rq : "";
  const key = `${tab}|${st.g}|${st.me}|${st.n}|${confirmSell.id}|${selId}|${sel ? JSON.stringify(sel) : ""}|${eqKey}|${rfKey}|${inv.map((e) => `${e.it.id}@${e.x},${e.y}`).join(",")}`;
  if (key === lastPanelKey) return;
  lastPanelKey = key;
  const g = st.g;
  const lv = st.me;
  shown = offers(lv);
  shownBag = inv;
  let h = `<div class="hd"><h3>Quartermaster</h3><span class="gold"><i class="lane-coin"></i>${g}</span><button class="x" data-a="close">✕</button></div>`;
  h += `<div class="cols"><div class="col"><div class="tabs">`;
  h += TABS.map(([k, label]) => `<button class="tab${tab === k ? " on" : ""}" data-tab="${k}">${label}</button>`).join("") + `</div>`;
  shownSv = [];
  if (tab === "enhance") h += enhanceHtml(sel, g);
  else if (tab === "reinf") h += reinfHtml(g);
  else {
    h += `<div class="stock">`;
    shown.forEach((o, i) => {
      const off = !!o.lock || g < o.price;
      h += `<div class="tile${off ? " off" : ""}${o.lock ? " lock" : ""}" data-o="${i}"><span class="tg">${esc(o.label)}</span><canvas data-ic="${i}"></canvas><span class="pr"><i class="lane-coin"></i>${o.price}</span></div>`;
    });
    h += `</div><div class="note">${tab === "gear" ? "Unidentified gear for your level: 35% normal, 50% magic, 15% rare." : "Crystals become skill and support gems (cut them in your inventory)."}</div>`;
  }
  h += `</div><div class="col">`;
  if (tab === "enhance") {
    h += `<h4>Equipped</h4><div class="eqrow">`;
    const eq = getEquip();
    SLOTS.forEach((q) => {
      const it = eq[q];
      h += `<div class="eq${it && it.id === selId ? " sel" : ""}" data-eq="${q}" style="border-color:${it ? (RARITY_COLORS[it.r] ?? "#3e3022") + "aa" : "#3e3022"}">${it ? `<canvas data-ec="${q}"></canvas>` : ""}</div>`;
    });
    h += `</div>`;
  }
  h += `<h4>Your bag</h4><div class="bag">`;
  inv.forEach((e, i) => {
    const fp = footprint(e.it);
    const cls = tab === "enhance" ? (e.it.id === selId ? " sel" : "") : confirmSell.id === e.it.id ? " cf" : "";
    h += `<div class="bi${cls}" data-b="${i}" style="grid-column:${e.x + 1}/span ${fp.w};grid-row:${e.y + 1}/span ${fp.h};border-color:${RARITY_COLORS[e.it.r] ?? "#3a3a52"}66"><canvas data-bc="${i}"></canvas></div>`;
  });
  const qn = quickNote && performance.now() - quickNote.at < 3000 ? `<b>${quickNote.text}</b><br>` : "";
  h += `</div><div class="note">${qn}${tab === "enhance" ? "Click an equipped or carried item to work on it." : "Click an item to sell it for a quarter of its price (rare and better: click twice). Ctrl+click items in your inventory to sell them, worn gear too. H or Esc closes."}</div></div></div>`;
  panel.innerHTML = h;
  // Paint icons (the inventory's own painted item icons).
  const dpr = window.devicePixelRatio || 1;
  panel.querySelectorAll<HTMLCanvasElement>("canvas[data-ic]").forEach((cv) => {
    const o = shown[Number(cv.dataset.ic)];
    cv.replaceWith(withData(itemIconCanvas(o.icon, Math.round(52 * dpr), Math.round(52 * dpr)), "ic", cv.dataset.ic!));
  });
  panel.querySelectorAll<HTMLCanvasElement>("canvas[data-sc]").forEach((cv) => {
    const sv = shownSv[Number(cv.dataset.sc)];
    const px = sv.rune ? 40 : 52;
    cv.replaceWith(withData(itemIconCanvas(sv.icon, Math.round(px * dpr), Math.round(px * dpr)), "sc", cv.dataset.sc!));
  });
  panel.querySelectorAll<HTMLCanvasElement>("canvas[data-ec]").forEach((cv) => {
    const it = getEquip()[cv.dataset.ec!];
    if (it) cv.replaceWith(withData(itemIconCanvas(it, Math.round(34 * dpr), Math.round(34 * dpr)), "ec", cv.dataset.ec!));
  });
  const sc = panel.querySelector<HTMLCanvasElement>("canvas[data-sel]");
  if (sc && sel) sc.replaceWith(itemIconCanvas(sel, Math.round(40 * dpr), Math.round(40 * dpr)));
  panel.querySelectorAll<HTMLCanvasElement>("canvas[data-bc]").forEach((cv) => {
    const e = shownBag[Number(cv.dataset.bc)];
    const fp = footprint(e.it);
    cv.replaceWith(withData(itemIconCanvas(e.it, Math.round(30 * fp.w * dpr), Math.round(30 * fp.h * dpr)), "bc", cv.dataset.bc!));
  });
  // The panel was rebuilt (a purchase changed prices): refresh the tooltip under the cursor.
  if (hoverKey) {
    hideTips();
    const under = document.elementFromPoint(mouseX, mouseY);
    if (under && panel.contains(under)) onPanelHover({ target: under } as unknown as MouseEvent);
  }
}

function withData(cv: HTMLCanvasElement, k: string, v: string): HTMLCanvasElement {
  cv.dataset[k] = v;
  return cv;
}

function onPanelClick(e: MouseEvent) {
  const el = e.target as HTMLElement;
  if (el.closest("[data-a=close]")) return toggleShop(false);
  const tb = el.closest<HTMLElement>("[data-tab]");
  if (tb) {
    const nt = tb.dataset.tab as Tab;
    if (nt !== tab) {
      tab = nt;
      playSfx("ui.tab");
      hideTips();
      lastPanelKey = "";
      drawShop();
    }
    return;
  }
  if (!st) return;
  const fb = el.closest<HTMLElement>("[data-fund]");
  if (fb) {
    if ((fb as HTMLButtonElement).disabled) return playSfx("ui.error");
    pending = { kind: "buy", gold: st.g, at: performance.now() };
    send({ t: "shop", a: "fund", k: fb.dataset.fund, n: Number(fb.dataset.n) });
    playSfx("ui.click");
    return;
  }
  const svt = el.closest<HTMLElement>("[data-sv]");
  if (svt) {
    const sv = shownSv[Number(svt.dataset.sv)];
    const sel = findSel();
    if (!sv || !sel || sv.block || st.g < sv.price) return playSfx("ui.error");
    pending = { kind: "buy", gold: st.g, at: performance.now() };
    send({ t: "shop", a: "enhance", id: sel.id, k: sv.k, ...(sv.rune ? { rune: sv.rune } : {}) });
    playSfx("ui.click");
    return;
  }
  const eqt = el.closest<HTMLElement>("[data-eq]");
  if (eqt) {
    const it = getEquip()[eqt.dataset.eq!];
    if (it) select(it.id);
    return;
  }
  if (tab === "enhance") {
    const b = el.closest<HTMLElement>("[data-b]");
    const ent = b ? shownBag[Number(b.dataset.b)] : undefined;
    if (ent) select(ent.it.id);
    return;
  }
  const tile = el.closest<HTMLElement>("[data-o]");
  if (tile) {
    const o = shown[Number(tile.dataset.o)];
    if (!o) return;
    if (o.lock || st.g < o.price) {
      playSfx("ui.error");
      return;
    }
    pending = { kind: "buy", gold: st.g, at: performance.now() };
    send(o.msg);
    playSfx("ui.click");
    return;
  }
  const bi = el.closest<HTMLElement>("[data-b]");
  if (bi) {
    const ent = shownBag[Number(bi.dataset.b)];
    if (!ent) return;
    const now = performance.now();
    if (ent.it.r >= 2 && !(confirmSell.id === ent.it.id && now - confirmSell.at < 3000)) {
      confirmSell = { id: ent.it.id, at: now };
      playSfx("ui.click");
      lastPanelKey = "";
      drawShop();
      hoverKey = "";
      return;
    }
    confirmSell = { id: -1, at: 0 };
    pending = { kind: "sell", gold: st.g, at: now };
    hideTips();
    send({ t: "shop", a: "sell", id: ent.it.id });
  }
}

let mouseX = 0;
let mouseY = 0;
function onPanelHover(e: MouseEvent) {
  if (e.clientX !== undefined) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
  if (!st) return;
  const el = e.target as HTMLElement;
  const tile = el.closest<HTMLElement>("[data-o]");
  const bi = el.closest<HTMLElement>("[data-b]");
  const svt = el.closest<HTMLElement>("[data-sv]");
  const eqt = el.closest<HTMLElement>("[data-eq]");
  const k = tile ? "o" + tile.dataset.o : bi ? "b" + bi.dataset.b : svt ? "s" + svt.dataset.sv : eqt ? "e" + eqt.dataset.eq : "";
  if (!k) {
    if (hoverKey) hideTips();
    return;
  }
  const rect = (tile ?? bi ?? svt ?? eqt)!.getBoundingClientRect();
  const x = rect.right + 6;
  const y = rect.top;
  if (k === hoverKey) return;
  hoverKey = k;
  tips.hide();
  hideHtmlTip();
  if (svt) {
    const sv = shownSv[Number(svt.dataset.sv)];
    if (!sv) return;
    const info = SERVICE_INFO[sv.k];
    const line = sv.block ? t(sv.block) : st.g >= sv.price ? t("Price: {n} gold · click to buy", { n: sv.price }) : t("Price: {n} gold · not enough gold", { n: sv.price });
    showHtmlTip(`<b>${esc(sv.rune ? sv.icon.n : t(info[0]))}</b><div>${esc(t(info[1]))}</div><div class="hint">${esc(line)}</div>`, x, y);
    return;
  }
  if (eqt) {
    const it = getEquip()[eqt.dataset.eq!];
    if (it) tips.show(it, x, y, t("Click to work on this item"));
    return;
  }
  if (tab === "enhance" && bi) {
    const ent = shownBag[Number(bi.dataset.b)];
    if (ent) tips.show(ent.it, x, y, t("Click to work on this item"));
    return;
  }
  if (tile) {
    const o = shown[Number(tile.dataset.o)];
    if (!o) return;
    const priceLine = st.g >= o.price ? t("Price: {n} gold · click to buy", { n: o.price }) : t("Price: {n} gold · not enough gold", { n: o.price });
    if (o.gamble) {
      const html =
        `<b>${esc(t("Unidentified {x}", { x: t(SLOT_LABEL[o.gamble] ?? o.gamble) }))}</b><i>${esc(t("Item level {n}", { n: st.me }))}</i>` +
        `<div>${esc(t(o.gamble === "flask" ? "A random flask for your level." : "A random base of this kind: 35% normal, 50% magic, 15% rare."))}</div>` +
        (o.gamble === "weapon" ? `<div class="fl">${esc(t("Weapons follow the kind you are holding."))}</div>`: "") +
        `<div class="hint">${esc(priceLine)}</div>`;
      showHtmlTip(html, x, y);
    } else tips.show(o.icon, x, y, o.lock ? o.lock : priceLine);
    return;
  }
  const ent = shownBag[Number(bi!.dataset.b)];
  if (!ent) return;
  const v = laneSellValue(ent.it);
  const hint = confirmSell.id === ent.it.id ? t("Click again to sell for {n} gold", { n: v }) : t("Sells for {n} gold · click to sell", { n: v });
  tips.show(ent.it, x, y, hint);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// ---- Enhance tab: gold services on your own items (server/modes/lanes.ts enhance) -------------------

interface Service {
  k: EnhanceKind;
  price: number;
  block: string | null;
  icon: Item;
  rune?: string;
}
let shownSv: Service[] = [];

/** [title, description] per service (English; Polish in i18n/pl.ts). */
const SERVICE_INFO: Record<EnhanceKind, [string, string]> = {
  forge: ["Forge a modifier", "Adds one random modifier: Normal becomes Magic, a full Magic item becomes Rare, then more modifiers until the Rare is full. The price rises with every modifier already on it."],
  quality: ["Temper quality", "Raises quality by 5% (up to 20%): more base damage on weapons, more defences on armour, stronger flasks and charms, more gem damage."],
  socket: ["Bore a socket", "Adds a rune socket, up to the base's limit (body armour and two-handers 2, other martial weapons and armour 1)."],
  rune: ["Set a rune", "Sets a rune into an empty socket."],
  chaos: ["Reroll a modifier", "Removes one random modifier from a Rare item and rolls a new one."],
  divine: ["Reroll values", "Rerolls the numbers of every modifier; the modifiers stay."],
  reforge: ["Reforge as Rare", "Wipes every modifier and reforges the item into a new Rare with four modifiers."],
  gemsocket: ["Gem socket", "Bores another support socket into a skill gem (up to 5)."],
  unique: ["Transmute to Unique", "Turns the item into a random unique of the same base (quality and sockets are kept)."],
  corrupt: ["Corrupt", "A gamble: nothing, a new implicit, an extra socket, rerolled values or the item unravels. Corrupted items can't be changed again."],
};
const SERVICE_ICON: Record<EnhanceKind, string> = {
  forge: "cur_crowning", quality: "cur_honing", socket: "cur_boring", rune: "rune_rootbound", chaos: "cur_shifting",
  divine: "cur_tempering", reforge: "cur_forgeheart", gemsocket: "cur_awl", unique: "cur_gambit", corrupt: "cur_blighted",
};
const SERVICE_SHORT: Record<EnhanceKind, string> = {
  forge: "Forge mod", quality: "Quality", socket: "Socket", rune: "Rune", chaos: "Reroll mod", divine: "Values",
  reforge: "Reforge", gemsocket: "Gem socket", unique: "Unique", corrupt: "Corrupt",
};
const icoItem = (b: string, n = ""): Item => ({ id: -1, b, r: 0, l: 1, n, m: [] });

function findSel(): Item | null {
  if (selId < 0) return null;
  const eq = getEquip();
  for (const q of SLOTS) if (eq[q]?.id === selId) return eq[q]!;
  return getInv().find((e) => e.it.id === selId)?.it ?? null;
}

function select(id: number) {
  selId = selId === id ? -1 : id;
  playSfx("ui.click");
  hideTips();
  lastPanelKey = "";
  drawShop();
}

function enhanceHtml(sel: Item | null, g: number): string {
  const wave = st?.n ?? 0;
  let h = `<div class="selbox">`;
  if (!sel) h += `<div class="sub">${esc(t("Pick an item on the right: equipped gear or anything in your bag."))}</div></div>`;
  else {
    const q = sel.q ? ` · ${t("Quality")} ${sel.q}%` : "";
    const sk = sel.s?.length ? ` · ${t("Sockets")} ${sel.s.filter((x) => x).length}/${sel.s.length}` : "";
    h += `<canvas data-sel="1"></canvas><div><div class="nm" style="color:${RARITY_COLORS[sel.r] ?? "#e8dcc0"}">${esc(sel.n)}</div><div class="sub">${esc(t("Item level {n}", { n: sel.l }))} · ${esc(t("{n} modifiers", { n: sel.m.length }))}${esc(q)}${esc(sk)}${sel.x ? " · " + esc(t("Corrupted")) : ""}</div></div></div>`;
  }
  h += `<div class="stock sv">`;
  for (const k of ENHANCE_KINDS) {
    if (k === "rune") continue;
    const icon = icoItem(k === "quality" && sel ? (qualityCur(sel) ?? SERVICE_ICON.quality) : k === "forge" && sel ? (forgeStep(sel) ?? SERVICE_ICON.forge) : SERVICE_ICON[k]);
    const sv: Service = { k, price: sel ? enhancePrice(k, sel, wave) : 0, block: sel ? enhanceBlock(k, sel) : "Pick an item first", icon };
    const i = shownSv.push(sv) - 1;
    const off = !!sv.block || g < sv.price;
    h += `<div class="tile${off ? " off" : ""}${sv.block ? " lock" : ""}" data-sv="${i}"><canvas data-sc="${i}"></canvas><span class="tg w">${esc(t(SERVICE_SHORT[k]))}</span><span class="pr"><i class="lane-coin"></i>${sel ? sv.price : "-"}</span></div>`;
  }
  h += `</div>`;
  if (sel && sel.s?.length) {
    const block = enhanceBlock("rune", sel);
    h += `<div class="stock rn">`;
    for (const r of runesFor(sel)) {
      const sv: Service = { k: "rune", price: enhancePrice("rune", sel, wave, r.id), block, icon: icoItem(r.id, r.name), rune: r.id };
      const i = shownSv.push(sv) - 1;
      const off = !!block || g < sv.price;
      h += `<div class="tile${off ? " off" : ""}${block ? " lock" : ""}" data-sv="${i}"><canvas data-sc="${i}"></canvas><span class="pr"><i class="lane-coin"></i>${sv.price}</span></div>`;
    }
    h += `</div>`;
  }
  h += `<div class="note">${esc(t("Prices rise with every wave. Uniques, corrupted items and full Rares refuse what they can't take."))}</div>`;
  return h;
}

// ---- Reinforcements tab: crowdfunded units for your team's next wave -------------------------------

const REINF_DESC: Record<ReinfKind, string> = {
  brute: "A Magic front-line brute of the current wave family.",
  archer: "A Magic ranged attacker of the current wave family.",
  champion: "A Rare champion, one level above the wave. Breaks spires.",
};

function reinfHtml(g: number): string {
  const rf = st?.rf ?? [];
  const full = (st?.rq ?? 0) >= REINF_CAP;
  let h = `<div class="reinf">`;
  h += `<div class="sub" style="font-size:12px">${esc(t("Bought for the next wave: {n}/{n2}", { n: st?.rq ?? 0, n2: REINF_CAP }))}</div>`;
  for (const k of REINF_KINDS) {
    const e = rf.find((q) => q[0] === k);
    const have = e?.[1] ?? 0;
    const price = e?.[2] ?? 0;
    const need = Math.max(0, price - have);
    const who = (e?.[3] ?? "").split(",").filter(Boolean).map((w) => { const i = w.lastIndexOf(":"); return `${w.slice(0, i)} ${w.slice(i + 1)}`; }).join(" · ");
    const btn = (n: number, label: string) => `<button data-fund="${k}" data-n="${n}"${full || g < 1 || n <= 0 ? " disabled" : ""}>${label}</button>`;
    h += `<div class="ru"><div class="top"><b>${esc(t(REINF_NAME[k]))}</b><span><i class="lane-coin"></i> ${have} / ${price}</span></div>` +
      `<div class="sub" style="font-size:11px;color:#b8a888">${esc(t(REINF_DESC[k]))}</div>` +
      `<div class="barw"><i style="width:${price ? Math.min(100, (have / price) * 100) : 0}%"></i></div>` +
      `<div class="who">${who ? esc(t("Chipped in: {$x}", { x: who })) : esc(t("Nobody has chipped in yet"))}</div>` +
      `<div class="btns">${btn(25, "+25")}${btn(100, "+100")}${btn(Math.min(need, g), esc(t("Fund the rest ({n})", { n: Math.min(need, g) })))}</div></div>`;
  }
  h += `</div><div class="note">${esc(t("Anyone on your team can chip in. A funded unit marches with your next wave down the lane (the Breachway has a single lane). Prices rise with every wave."))}${full ? "<br>" + esc(t("The next wave is full.")) : ""}</div>`;
  return h;
}
