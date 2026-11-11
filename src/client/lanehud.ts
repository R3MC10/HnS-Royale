// Breachway HUD (docs/MODE-LANES.md section 9): team score, structures, wave timer, gold, respawn timer,
// winner line, and the Quartermaster shop panel (H, or the button, on your platform or while dead).
// Plain DOM: the i18n MutationObserver translates every text node (Polish entries live in i18n/pl.ts).
import { currentMap, onMapChange } from "../shared/map";
import type { ClientMsg, LaneMsg } from "../shared/protocol";
import type { GridEntry } from "../shared/grid";
import {
  GAMBLE_SLOTS, SPIRIT_LEVEL, SPIRIT_PRICE, SUPPORT_TIERS, TEAM_COLORS, TEAM_NAMES,
  gamblePrice, laneSellValue, maxCrystalLevel, skillCrystalPrice,
} from "../shared/lanes";

const SLOT_LABEL: Record<string, string> = {
  weapon: "Weapon", offhand: "Off-hand", body: "Body Armour", helmet: "Helmet", gloves: "Gloves",
  boots: "Boots", belt: "Belt", ring: "Ring", amulet: "Amulet", flask: "Flask",
};
const STRUCT_SHORT: Record<string, string> = { lane_outer: "Outer Spire", lane_inner: "Inner Spire", lane_ward: "Ward", lane_core: "Core" };

let send: (m: ClientMsg) => void = () => {};
let getInv: () => GridEntry[] = () => [];
let st: LaneMsg | null = null;
let bar: HTMLDivElement | null = null;
let panel: HTMLDivElement | null = null;
let shopOpen = false;
let lastPanelKey = "";

export const isLaneMode = () => currentMap().params.mode === "lanes";

const css = `
#lane-bar{position:fixed;right:8px;top:218px;z-index:30;pointer-events:none;font:12px/1.35 Georgia,serif;color:#e8dcc0;
  background:rgba(12,9,8,.72);border:1px solid #5a4a34;border-radius:4px;padding:6px 9px;min-width:190px;text-shadow:0 1px 1px #000}
#lane-bar .row{display:flex;justify-content:space-between;gap:10px}
#lane-bar .pips{display:flex;gap:3px;margin:2px 0}
#lane-bar .pip{width:38px;height:7px;background:#2a2420;border:1px solid #4a3e30;position:relative}
#lane-bar .pip i{position:absolute;left:0;top:0;bottom:0}
#lane-bar .gold{color:#ffd76a;font-weight:bold}
#lane-bar button{pointer-events:auto;margin-top:5px;width:100%;font:12px Georgia,serif;color:#ffe6b0;background:#3a2a18;border:1px solid #a07a40;border-radius:3px;cursor:pointer;padding:3px}
#lane-dead{position:fixed;left:50%;top:38%;transform:translateX(-50%);z-index:30;pointer-events:none;font:22px Georgia,serif;color:#ffd0b0;text-shadow:0 2px 3px #000}
#lane-shop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;width:560px;max-width:calc(100vw - 32px);max-height:80vh;overflow:auto;
  font:13px/1.4 Georgia,serif;color:#e8dcc0;background:rgba(16,12,10,.95);border:1px solid #8a6a3a;border-radius:6px;padding:12px 14px;box-shadow:0 6px 30px #000}
#lane-shop h3{margin:0 0 4px;font-size:17px;color:#ffe6b0}
#lane-shop h4{margin:10px 0 4px;font-size:13px;color:#d0b080;border-bottom:1px solid #4a3a28}
#lane-shop .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:4px}
#lane-shop button{font:12px Georgia,serif;color:#f0e4c8;background:#2c2218;border:1px solid #6a5232;border-radius:3px;padding:4px 6px;cursor:pointer;text-align:left}
#lane-shop button:hover:not(:disabled){background:#46341e}
#lane-shop button:disabled{opacity:.45;cursor:default}
#lane-shop .x{float:right;text-align:center}
#lane-shop .note{color:#a89c84;font-size:11px}
`;

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
  panel.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === "close") return toggleShop(false);
    if (!a) return;
    const m: ClientMsg = { t: "shop", a: a as "gamble" };
    if (b.dataset.slot) m.slot = b.dataset.slot;
    if (b.dataset.lv) m.lv = Number(b.dataset.lv);
    if (b.dataset.id) m.id = Number(b.dataset.id);
    send(m);
    lastPanelKey = ""; // refresh after the purchase
  });
  bar.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button")) toggleShop(true);
  });
}

export function initLaneHud(sendFn: (m: ClientMsg) => void, inv: () => GridEntry[]): void {
  send = sendFn;
  getInv = inv;
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
  shopOpen = false;
  if (bar) bar.style.display = "none";
  if (panel) panel.style.display = "none";
  const d = document.getElementById("lane-dead");
  if (d) d.style.display = "none";
}

function toggleShop(on: boolean) {
  if (!panel) return;
  shopOpen = on && !!st?.shop;
  panel.style.display = shopOpen ? "block" : "none";
  lastPanelKey = "";
  if (shopOpen) drawShop();
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function laneOnMessage(msg: LaneMsg): void {
  if (!isLaneMode()) return;
  ensureDom();
  st = msg;
  const me = msg.tm;
  const foe = (1 - me) as 0 | 1;
  const pips = (team: 0 | 1) =>
    `<div class="pips">${msg.st
      .filter((s) => s[1] === team)
      .map((s) => `<div class="pip" title="${STRUCT_SHORT[s[0]]}"><i style="width:${Math.round(s[2] * 100)}%;background:${TEAM_COLORS[team]}"></i></div>`)
      .join("")}</div>`;
  const ward = msg.st.find((s) => s[0] === "lane_ward" && s[1] === me && s[2] <= 0 && s[3] > 0);
  const foeWard = msg.st.find((s) => s[0] === "lane_ward" && s[1] === foe && s[2] <= 0 && s[3] > 0);
  bar!.style.display = "block";
  bar!.innerHTML =
    `<div class="row"><span style="color:${TEAM_COLORS[me]}">${TEAM_NAMES[me]}</span><span>${msg.k[me]}</span></div>` +
    pips(me) +
    `<div class="row"><span style="color:${TEAM_COLORS[foe]}">${TEAM_NAMES[foe]}</span><span>${msg.k[foe]}</span></div>` +
    pips(foe) +
    `<div class="row"><span>Wave ${msg.n}</span><span>next ${mmss(msg.wv)}</span></div>` +
    (ward ? `<div>Your Ward rises in ${ward[3]}</div>` : "") +
    (foeWard ? `<div>Enemy Ward rises in ${foeWard[3]}</div>` : "") +
    `<div class="row"><span class="gold">Gold ${msg.g}</span><span>Level ${msg.me}</span></div>` +
    (msg.shop ? `<button>Quartermaster (H)</button>` : "");
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

function drawShop() {
  if (!panel || !st) return;
  const inv = getInv();
  const key = `${st.g}|${st.me}|${inv.map((e) => e.it.id).join(",")}`;
  if (key === lastPanelKey) return;
  lastPanelKey = key;
  const g = st.g;
  const lv = st.me;
  const btn = (label: string, price: number, data: string, ok = true) =>
    `<button ${data} ${ok && g >= price ? "" : "disabled"}><span>${label}</span><span class="x"> ${price}g</span></button>`;
  let h = `<button class="x" data-a="close">✕</button><h3>Quartermaster</h3><div class="note">Gold ${g} · Level ${lv} · H or Esc closes</div>`;
  h += `<h4>Gamble</h4><div class="note">Unidentified gear for your level: 35% normal, 50% magic, 15% rare.</div><div class="grid">`;
  for (const slot of GAMBLE_SLOTS) h += btn(SLOT_LABEL[slot] ?? slot, gamblePrice(slot, lv), `data-a="gamble" data-slot="${slot}"`);
  h += `</div><h4>Crystals</h4><div class="grid">`;
  for (let k = 1; k <= maxCrystalLevel(lv); k++) h += btn(`Skill crystal, level ${k}`, skillCrystalPrice(k), `data-a="skill" data-lv="${k}"`);
  for (const t of SUPPORT_TIERS) h += lv >= t.level ? btn(`Support crystal, tier ${t.tier}`, t.price, `data-a="support" data-lv="${t.tier}"`) : "";
  if (lv >= SPIRIT_LEVEL) h += btn("Spirit crystal", SPIRIT_PRICE, `data-a="spirit"`);
  h += `</div><h4>Sell</h4>`;
  if (!inv.length) h += `<div class="note">Your bag is empty.</div>`;
  else {
    h += `<div class="grid">`;
    for (const e of inv) h += `<button data-a="sell" data-id="${e.it.id}"><span>${esc(e.it.n)}</span><span class="x"> +${laneSellValue(e.it)}g</span></button>`;
    h += `</div>`;
  }
  panel.innerHTML = h;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
