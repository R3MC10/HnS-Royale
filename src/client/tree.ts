// Passive tree panel ("the Lattice") + Ascendancy tab. DOM frame + smooth canvas: pan (drag),
// zoom (wheel), hover tooltips, click to allocate (clicking a distant node allocates the shortest
// path if you have the points). The server validates every allocation.
import { tr } from "./i18n";
import { ASC_BY_ID, type AscendancyDef, type AscNode } from "../shared/content/ascendancies";
import { ASCEND_LEVEL, CLASS_BY_ID } from "../shared/content/classes";
import { PASSIVE_BY_ID, PASSIVE_NODES, modLines, type PassiveNode } from "../shared/content/passives";
import { JEWEL_BASE_BY_ID, isJewel } from "../shared/content/jewels";
import { RARITY_COLORS } from "../shared/content/loot";
import { modText, type Item } from "../shared/items";
import type { ClientMsg } from "../shared/protocol";
import { invExternalDrops } from "./inventory";
import { drawClassEmblem } from "./classpick";
import { drawPassiveIcon, passiveIconReady } from "./gfx/treeart";
import { onProgChange, progState } from "./prog";
import { el, ensureProgStyle, esc, hideTip, showTip } from "./progstyle";
import { actionLabel } from "./keybinds";

const CSS = `
#pg-tree { position: fixed; inset: 0; z-index: 40; display: none; flex-direction: column; overflow: hidden; border-radius: 0; border: none; }
#pg-tree .top { zoom: var(--hns-ui, 1); }
#pg-tree .search { width: 190px; padding: 5px 9px; font: 13px var(--pg-body); color: var(--pg-ink); background: linear-gradient(180deg, #120f0e, #1c1715);
  border: 1px solid rgba(216,179,106,0.3); border-radius: 3px; outline: none; box-shadow: inset 0 1px 3px rgba(0,0,0,0.7); }
#pg-tree .search:focus { border-color: var(--pg-gold); }
#pg-tree .search::placeholder { color: var(--pg-faint); }
#pg-tree .found { font-size: 12px; color: var(--pg-dim); min-width: 5em; }
/* Full screen: the HUD (skill bar, XP, trial bar) hides behind the tree; the canvas HUD can read isTreeOpen(). */
body.pg-tree-open #skbar, body.pg-tree-open #pg-hud, body.pg-tree-open #pg-hon { visibility: hidden !important; }
#pg-tree .top { position: relative; display: flex; align-items: center; gap: 14px; padding: 12px 52px 10px 18px; border-bottom: 1px solid var(--pg-line); }
#pg-tree .top .pc-key { position: static; transform: none; }
#pg-tree .top .pg-title { font-size: 20px; }
#pg-tree .tabs { display: flex; gap: 6px; margin-left: 10px; }
#pg-tree .pts { margin-left: auto; font-family: var(--pg-title); letter-spacing: 0.12em; font-size: 13px; color: var(--pg-dim); text-transform: uppercase; }
#pg-tree .pts b { color: #ffd27a; font-size: 18px; margin: 0 4px; text-shadow: 0 0 10px rgba(255,180,60,0.6); }
#pg-tree .body { position: relative; flex: 1; min-height: 0; }
#pg-tree canvas.view { position: absolute; inset: 0; width: 100%; height: 100%; cursor: grab; }
#pg-tree canvas.view.drag { cursor: grabbing; }
#pg-tree .hint { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 16px 9px; background: linear-gradient(0deg, rgba(6,5,7,0.94) 0%, rgba(6,5,7,0.8) 55%, rgba(6,5,7,0) 100%); font-size: 12px; color: var(--pg-faint); letter-spacing: 0.05em; pointer-events: none; }
#pg-tree .asc-pick { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 20px; }
#pg-tree .asc-cards { display: grid; grid-template-columns: repeat(3, minmax(180px, 260px)); gap: 16px; }
#pg-tree .asc-card { cursor: pointer; padding: 16px; border-radius: 8px; border: 1px solid rgba(216,179,106,0.25);
  background: linear-gradient(180deg, rgba(34,28,34,0.95), rgba(14,12,16,0.95)); transition: border-color .12s, box-shadow .12s, transform .12s; }
#pg-tree .asc-card:hover { transform: translateY(-2px); }
#pg-tree .asc-card b { display: block; font-family: var(--pg-title); font-size: 18px; letter-spacing: 0.12em; margin-bottom: 6px; }
#pg-tree .asc-card p { margin: 0 0 10px; color: var(--pg-dim); font-size: 13px; line-height: 1.4; }
#pg-tree .asc-card ul { margin: 0; padding-left: 16px; font-size: 12px; color: #b9a684; line-height: 1.5; }
#pg-tree .msg { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; color: var(--pg-dim); padding: 30px; }
#pg-tree .msg .pg-title { font-size: 22px; }
@media (max-width: 760px) { #pg-tree .asc-cards { grid-template-columns: 1fr; } }
/* Tree + inventory side by side (PoE2-style): inventory docks right, above the tree, for jewel dragging. */
body.pg-tree-open #tooltip, body.pg-tree-open .invp-ghost { z-index: 62 !important; }
body.pg-tree-open #toasts { z-index: 61 !important; }
body.pg-with-inv #inv-panel { left: auto !important; right: 12px !important; transform: translateY(-50%) !important; z-index: 41 !important; }
`;

type Send = (m: ClientMsg) => void;
type Tab = "tree" | "asc";

interface DrawNode {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  links: string[];
  mods: PassiveNode["mods"];
  desc?: string[];
  cls?: string;
}

let root: HTMLDivElement | null = null;
let canvas: HTMLCanvasElement;
let ptsEl: HTMLDivElement;
let tabBtns: Record<Tab, HTMLButtonElement>;
let overlay: HTMLDivElement;
let hintEl: HTMLDivElement;
let send: Send = () => {};
let tab: Tab = "tree";
let open = false;
const cam = { x: 0, y: 0, z: 0.8 };
const ascCam = { x: 0, y: 0, z: 1.3 };
let hover: string | null = null;
let dropOver: string | null = null; // jewel socket under a dragged inventory jewel
let dragJewel: Item | null = null;
let raf = 0;
let searchEl: HTMLInputElement;
let foundEl: HTMLSpanElement;
let query = "";
let hits = new Set<string>();
let hitsKey = "";
const emblemCache = new Map<string, HTMLCanvasElement>();

export function initTreePanel(sendFn: Send) {
  send = sendFn;
}

export function isTreeOpen() {
  return open;
}

export function toggleTree(force?: boolean) {
  const want = force ?? !open;
  if (want === open) return;
  if (!root) build();
  open = want;
  root!.style.display = open ? "flex" : "none";
  document.body.classList.toggle("pg-tree-open", open);
  if (!open) {
    document.body.classList.remove("pg-with-inv");
    root!.style.right = "";
  }
  hideTip();
  if (open) {
    const m = progState.msg;
    if (m && m.ascState === 2) tab = "asc";
    centreOnClass();
    refresh();
    loop();
  } else cancelAnimationFrame(raf);
}

function build() {
  ensureProgStyle();
  const st = el("style");
  st.textContent = CSS;
  document.head.append(st);
  root = el("div", "pg-root pg-frame");
  root.id = "pg-tree";
  const top = el("div", "top");
  const title = el("h2", "pg-title", "The Lattice");
  const tabs = el("div", "tabs");
  tabBtns = { tree: el("button", "pg-btn", "Passives"), asc: el("button", "pg-btn", "Ascendancy") };
  for (const k of ["tree", "asc"] as Tab[]) {
    tabBtns[k].addEventListener("click", () => {
      tab = k;
      hover = null;
      hideTip();
      refresh();
    });
    tabs.append(tabBtns[k]);
  }
  ptsEl = el("div", "pts");
  searchEl = el("input", "search");
  searchEl.type = "search";
  searchEl.placeholder = "Search nodes (Ctrl+F)";
  searchEl.spellcheck = false;
  foundEl = el("span", "found");
  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    hitsKey = "";
  });
  searchEl.addEventListener("keydown", (e) => {
    e.stopPropagation(); // typing must not reach the game binds
    if (e.key === "Escape") {
      if (searchEl.value) {
        searchEl.value = "";
        query = "";
        hitsKey = "";
      } else searchEl.blur();
      e.preventDefault();
    } else if (e.key === "Enter") searchEl.blur();
  });
  searchEl.addEventListener("keyup", (e) => e.stopPropagation());
  top.append(title, tabs, searchEl, foundEl, ptsEl);
  // shared panel chrome (progstyle .pc-key / .pc-x): the toggle key and the close button, right of the points
  const key = actionLabel("tree");
  if (key && key !== "-") {
    const kc = el("span", "pc-key", key);
    kc.title = "Toggle key";
    top.append(kc);
  }
  const x = el("button", "pc-x", "×");
  x.type = "button";
  x.title = "Close";
  x.addEventListener("click", () => toggleTree(false));
  top.append(x);
  const body = el("div", "body");
  canvas = el("canvas", "view");
  overlay = el("div");
  hintEl = el("div", "hint", "Drag to pan · wheel to zoom · Ctrl+F to search · click a node to allocate (a far node takes the whole path) · no refunds this match · drag jewels from the inventory (I) onto allocated sockets, right-click to remove");
  body.append(canvas, overlay, hintEl);
  root.append(top, body);
  document.body.append(root);
  // Stop game input while the panel is under the mouse.
  for (const ev of ["mousedown", "mouseup", "click", "contextmenu", "wheel"]) root.addEventListener(ev, (e) => e.stopPropagation());
  wireCanvas();
  onProgChange(() => open && refresh());
  invExternalDrops.push(onInvDrag);
  // Ctrl+F while the tree is open focuses the node search.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!open || !(e.ctrlKey || e.metaKey) || e.code !== "KeyF") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      searchEl.focus();
      searchEl.select();
    },
    true,
  );
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const id = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (id && tab === "tree" && progState.msg?.jw?.[id]) send({ t: "jewel", node: id });
  });
}

function centreOnClass() {
  const m = progState.msg;
  const c = m ? CLASS_BY_ID.get(m.cls) : undefined;
  const s = c ? PASSIVE_BY_ID.get(c.start) : undefined;
  if (s) {
    cam.x = s.x * 0.55;
    cam.y = s.y * 0.55;
  }
}

function refresh() {
  if (!root) return;
  const m = progState.msg;
  tabBtns.tree.classList.toggle("on", tab === "tree");
  tabBtns.asc.classList.toggle("on", tab === "asc");
  const ascReady = m?.ascState === 2;
  tabBtns.asc.textContent = ascReady ? "Ascendancy ✦" : m?.ascPts ? `Ascendancy (${m.ascPts})` : "Ascendancy";
  if (tab === "tree") ptsEl.innerHTML = `Passive points<b>${m?.pts ?? 0}</b>Level ${m?.lv ?? 1}`;
  else ptsEl.innerHTML = m?.asc ? `Ascendancy points<b>${m.ascPts}</b>` : "";
  if (tab === "asc" && m?.ascState === 2 && overlay.querySelector(".asc-pick")) return; // keep an armed card armed
  overlay.innerHTML = "";
  canvas.style.display = "block";
  hintEl.style.display = tab === "tree" || m?.ascState === 3 ? "block" : "none";
  if (tab === "asc" && m && m.ascState !== 3) {
    canvas.style.display = "none";
    if (m.ascState === 2) overlay.append(ascPicker());
    else {
      const box = el("div", "msg");
      box.append(el("h3", "pg-title", "The Trials of Honour"));
      const cls = CLASS_BY_ID.get(m.cls);
      const p = el("p");
      p.innerHTML = tr(
        m.ascState === 0
          ? `Reach <b>level ${ASCEND_LEVEL}</b> (you are level ${m.lv}), then wake a trial shrine (blue markers on the map) and survive it with your honour intact.`
          : `Find a <b>trial shrine</b> (blue markers on the map) and press <b>F</b> beside it. Slay its guard, then its Warden. Every hit you take drains your honour.`,
      );
      box.append(p);
      if (cls) box.append(el("p", "", `Your ascendancies: ${cls.ascendancies.map((a) => ASC_BY_ID.get(a)?.name ?? a).join(", ")}`));
      overlay.append(box);
    }
  }
}

function ascPicker(): HTMLElement {
  const m = progState.msg!;
  const cls = CLASS_BY_ID.get(m.cls)!;
  const wrap = el("div", "asc-pick");
  wrap.append(el("h3", "pg-title", "Choose your Ascendancy"), el("p", "", "This choice is final for the match. You receive 2 ascendancy points now and 2 more at levels 16, 22 and 28."));
  const cards = el("div", "asc-cards");
  for (const id of cls.ascendancies) {
    const a = ASC_BY_ID.get(id);
    if (!a) continue;
    const card = el("div", "asc-card");
    card.style.borderColor = a.color + "88";
    const b = el("b", "", a.name);
    b.style.color = a.color;
    const ul = el("ul");
    for (const n of a.nodes.filter((n) => n.kind === "notable").slice(0, 5)) ul.append(el("li", "", n.name));
    card.append(b, el("p", "", a.blurb), ul);
    card.addEventListener("mouseenter", () => (card.style.boxShadow = `0 0 24px ${a.color}55`));
    card.addEventListener("mouseleave", () => (card.style.boxShadow = ""));
    const confirmEl = el("div", "", "");
    confirmEl.style.cssText = `margin-top:10px;font-family:var(--pg-title);letter-spacing:.12em;font-size:12px;text-transform:uppercase;color:${a.color};min-height:1.3em`;
    card.append(confirmEl);
    card.addEventListener("click", () => {
      // Two-step confirm (no blocking dialogs): first click arms the card, second click ascends.
      if (card.dataset.armed !== "1") {
        for (const c of Array.from(cards.querySelectorAll<HTMLElement>(".asc-card"))) {
          c.dataset.armed = "";
          (c.lastElementChild as HTMLElement).textContent = "";
        }
        card.dataset.armed = "1";
        confirmEl.textContent = "Click again to ascend (final)";
        return;
      }
      send({ t: "ascend", id: a.id }); // audio/game.ts plays the sound on send
    });
    cards.append(card);
  }
  wrap.append(cards);
  return wrap;
}

// ---- data views ----------------------------------------------------------------------------------

function currentNodes(): { nodes: Map<string, DrawNode>; alloc: Set<string>; points: number; asc: AscendancyDef | null } {
  const m = progState.msg;
  if (tab === "asc" && m?.asc) {
    const a = ASC_BY_ID.get(m.asc)!;
    return { nodes: new Map(a.nodes.map((n: AscNode) => [n.id, n as DrawNode])), alloc: new Set(m.ascAlloc), points: m.ascPts, asc: a };
  }
  return { nodes: PASSIVE_BY_ID as Map<string, DrawNode>, alloc: new Set(m?.alloc ?? []), points: m?.pts ?? 0, asc: null };
}

/** Shortest path (node ids, excluding already allocated) from the allocated set to `target`. */
function pathTo(nodes: Map<string, DrawNode>, alloc: Set<string>, target: string): string[] {
  if (alloc.has(target)) return [];
  const prev = new Map<string, string | null>();
  const q: string[] = [];
  for (const a of alloc) {
    prev.set(a, null);
    q.push(a);
  }
  while (q.length) {
    const id = q.shift()!;
    if (id === target) break;
    for (const l of nodes.get(id)?.links ?? []) {
      if (prev.has(l)) continue;
      const ln = nodes.get(l);
      if (!ln || (ln.kind === "start" && !alloc.has(l))) continue; // never path through another class start
      prev.set(l, id);
      q.push(l);
    }
  }
  if (!prev.has(target)) return [];
  const out: string[] = [];
  for (let c: string | null = target; c && !alloc.has(c); c = prev.get(c) ?? null) out.unshift(c);
  return out;
}

// ---- canvas ----------------------------------------------------------------------------------------

function C() {
  return tab === "asc" ? ascCam : cam;
}

function wireCanvas() {
  let drag: { x: number; y: number; cx: number; cy: number; moved: boolean } | null = null;
  canvas.addEventListener("mousedown", (e) => {
    const c = C();
    drag = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false };
    const r = canvas.getBoundingClientRect();
    hover = hitTest(e.clientX - r.left, e.clientY - r.top); // clicks can arrive without a prior mousemove
    canvas.classList.add("drag");
  });
  window.addEventListener("mousemove", (e) => {
    if (!open) return;
    if (drag) {
      const c = C();
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      c.x = drag.cx - dx / c.z;
      c.y = drag.cy - dy / c.z;
    }
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom || canvas.style.display === "none") {
      hover = null;
      hideTip();
      return;
    }
    hover = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (hover && !drag?.moved) tip(hover, e.clientX, e.clientY);
    else hideTip();
  }, true);
  window.addEventListener("mouseup", () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    canvas.classList.remove("drag");
    if (!moved && hover) clickNode(hover);
  }, true); // capture: the panel root stops bubbling mouse events
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const c = C();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;
      const wx = c.x + mx / c.z;
      const wy = c.y + my / c.z;
      c.z = Math.max(0.35, Math.min(2.6, c.z * Math.exp(-e.deltaY * 0.0015)));
      c.x = wx - mx / c.z;
      c.y = wy - my / c.z;
    },
    { passive: false },
  );
}

function radius(kind: string): number {
  // (small / notable / keystone are sized for their painted icons, gfx/treeart.ts)
  return kind === "keystone" ? 28 : kind === "notable" ? 20 : kind === "start" ? 26 : kind === "ascStart" ? 26 : kind === "jewel" ? 15 : 13;
}

/** While the inventory panel is open too, dock it right and shrink the tree to the left of it. */
function dockBesideInventory() {
  const inv = document.getElementById("inv-panel");
  const shown = !!inv && getComputedStyle(inv).display !== "none";
  document.body.classList.toggle("pg-with-inv", shown);
  root!.style.right = shown ? `${Math.round(inv!.getBoundingClientRect().width + 24)}px` : "";
}

/** Inventory drag hook: highlight / socket into an allocated jewel socket under the cursor. */
function onInvDrag(item: Item, x: number, y: number, phase: "move" | "drop" | "end"): boolean {
  if (phase === "end") {
    dropOver = null;
    dragJewel = null;
    return false;
  }
  if (!open || tab !== "tree" || !isJewel(item) || canvas.style.display === "none") return false;
  dragJewel = item;
  const r = canvas.getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) {
    dropOver = null;
    return false;
  }
  const id = hitTest(x - r.left, y - r.top);
  const n = id ? PASSIVE_BY_ID.get(id) : undefined;
  dropOver = n?.kind === "jewel" ? n.id : null;
  if (phase === "drop") {
    dragJewel = null;
    const target = dropOver;
    dropOver = null;
    if (!target) return true; // released over the tree: don't drop it on the ground
    if (!progState.msg?.alloc.includes(target)) {
      flashPoints();
      return true;
    }
    send({ t: "jewel", node: target, id: item.id });
    return true;
  }
  return true;
}

function hitTest(px: number, py: number): string | null {
  const { nodes } = currentNodes();
  const c = C();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  let best: string | null = null;
  let bd = Infinity;
  for (const n of nodes.values()) {
    const sx = (n.x - c.x) * c.z + w / 2;
    const sy = (n.y - c.y) * c.z + h / 2;
    const d = Math.hypot(sx - px, sy - py);
    const r = Math.max(8, (radius(n.kind) + 4) * c.z);
    if (d < r && d < bd) {
      bd = d;
      best = n.id;
    }
  }
  return best;
}

function clickNode(id: string) {
  const { nodes, alloc, points, asc } = currentNodes();
  if (alloc.has(id)) return;
  const path = pathTo(nodes, alloc, id);
  if (!path.length) return;
  if (path.length > points) {
    flashPoints();
    return;
  }
  for (const n of path) send(asc ? { t: "ascalloc", id: n } : { t: "alloc", id: n });
}

function flashPoints() {
  ptsEl.animate([{ color: "#ff6a50" }, { color: "" }], { duration: 600 });
}

function tip(id: string, x: number, y: number) {
  const { nodes, alloc, points } = currentNodes();
  const n = nodes.get(id);
  if (!n) return;
  const kindLabel: Record<string, string> = { start: "Class Mark", small: "Passive", notable: "Notable", keystone: "Keystone", ascStart: "Ascendancy", jewel: "Jewel Socket" };
  const lines = modLines(n.mods)
    .map((l) => `<div class="ln${/^-|reduced|less|cannot|no Armour|not recharge/.test(l) ? " neg" : ""}">${esc(l)}</div>`)
    .join("");
  const jw = n.kind === "jewel" ? progState.msg?.jw?.[id] : undefined;
  if (jw) {
    const col = RARITY_COLORS[jw.r] ?? "#f0dcb0";
    const ml = jw.m.map((m) => `<div class="ln">${esc(modText(m))}</div>`).join("");
    showTip(`<b style="color:${col}">${esc(jw.n)}</b><i>Socketed jewel</i>${ml}<div class="hint">Right-click to take it out</div>`, x, y);
    return;
  }
  let fl = (n.desc ?? []).map((d) => `<div class="fl">${esc(d)}</div>`).join("");
  if ((n.kind === "start" || n.kind === "ascStart") && alloc.has(id) && alloc.size > 1) {
    // your class start / ascendancy root sums up everything allocated so far
    const sum: Record<string, number> = {};
    for (const a of alloc) for (const [k, v] of Object.entries(nodes.get(a)?.mods ?? {})) sum[k] = Math.round(((sum[k] ?? 0) + (v as number)) * 10) / 10;
    fl += `<div class="hint">${esc(`Total from ${alloc.size} allocated nodes`)}</div>` + modLines(sum).map((l) => `<div class="ln">${esc(l)}</div>`).join("");
  }
  let hint = "";
  if (alloc.has(id)) hint = "Allocated";
  else if (n.kind === "start") hint = n.cls ? `Start of the ${CLASS_BY_ID.get(n.cls)?.name ?? n.cls}` : "";
  else {
    const p = pathTo(nodes, alloc, id).length;
    hint = !p ? "Not reachable" : p > points ? `Needs ${p} points (you have ${points})` : `Click to allocate${p > 1 ? ` (${p} points)` : ""}`;
  }
  showTip(`<b>${esc(n.name)}</b><i>${kindLabel[n.kind] ?? ""}</i>${lines}${fl}${hint ? `<div class="hint">${esc(hint)}</div>` : ""}`, x, y);
}

function loop() {
  if (!open) return;
  dockBesideInventory();
  draw();
  raf = requestAnimationFrame(loop);
}

function draw() {
  if (canvas.style.display === "none") return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext("2d")!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = true;
  // Backdrop: deep vignette with faint concentric guide rings
  const bg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, "#17131a");
  bg.addColorStop(1, "#060507");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  const { nodes, alloc, points, asc } = currentNodes();
  const c = C();
  const T = (x: number, y: number) => [(x - c.x) * c.z + w / 2, (y - c.y) * c.z + h / 2] as const;
  const time = performance.now() / 1000;
  const accent = asc?.color ?? "#d8b36a";

  g.save();
  const [ox, oy] = T(0, 0);
  g.strokeStyle = "rgba(216,179,106,0.05)";
  g.lineWidth = 1;
  for (const r of asc ? [78, 156, 234, 312] : [115, 210, 430, 700]) {
    g.beginPath();
    g.arc(ox, oy, r * c.z, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();

  const reach = new Set<string>();
  for (const a of alloc) for (const l of nodes.get(a)?.links ?? []) if (!alloc.has(l)) reach.add(l);
  const preview = new Set(hover ? pathTo(nodes, alloc, hover) : []);
  updateHits(nodes);
  const previewOk = preview.size > 0 && preview.size <= points;

  // Links
  g.lineCap = "round";
  for (const n of nodes.values()) {
    for (const l of n.links) {
      if (l < n.id) continue;
      const o = nodes.get(l);
      if (!o) continue;
      const both = alloc.has(n.id) && alloc.has(l);
      const one = alloc.has(n.id) || alloc.has(l);
      const pv = (preview.has(n.id) || alloc.has(n.id)) && (preview.has(l) || alloc.has(l)) && (preview.has(n.id) || preview.has(l));
      const [ax, ay] = T(n.x, n.y);
      const [bx, by] = T(o.x, o.y);
      g.strokeStyle = "#050405";
      g.lineWidth = Math.max(2, 7 * c.z);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      g.strokeStyle = both ? accent : pv ? (previewOk ? "rgba(140,200,255,0.85)" : "rgba(255,110,80,0.7)") : one ? "rgba(216,179,106,0.35)" : "#2a262e";
      g.lineWidth = Math.max(1, (both ? 4 : 3) * c.z);
      if (both) {
        g.shadowColor = accent;
        g.shadowBlur = 8;
      }
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      g.shadowBlur = 0;
    }
  }

  // Nodes
  const myCls = progState.msg?.cls;
  for (const n of nodes.values()) {
    const [x, y] = T(n.x, n.y);
    if (x < -60 || y < -60 || x > w + 60 || y > h + 60) continue;
    const r = radius(n.kind) * c.z;
    const on = alloc.has(n.id);
    const can = !on && reach.has(n.id) && points > 0 && n.kind !== "start";
    const hov = hover === n.id;
    const pv = preview.has(n.id);
    const hit = query ? hits.has(n.id) : false;
    g.save();
    if (query && !hit && !hov) g.globalAlpha = 0.28; // search: dim everything that doesn't match
    if (on) {
      g.shadowColor = accent;
      g.shadowBlur = 14 * c.z + 4;
    }
    // body
    const iconD = r * (n.kind === "small" ? 2.1 : 1.95); // fills the node; the node shape clips it
    const icon = passiveIconReady(n, iconD * dpr);
    const fill = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    if (on && icon) {
      // allocated, with a painted icon: a warm dark body so the picture reads; the glow and rim say "taken"
      fill.addColorStop(0, "#8e6c3a");
      fill.addColorStop(0.6, "#4a3418");
      fill.addColorStop(1, "#22160a");
    } else if (on) {
      fill.addColorStop(0, "#fff0c4");
      fill.addColorStop(0.5, n.kind === "keystone" ? "#c88a3a" : accent);
      fill.addColorStop(1, "#4a3418");
    } else {
      // (a lighter backing disc under a painted icon, so dark subjects are not dark-on-dark)
      fill.addColorStop(0, icon ? (n.kind === "keystone" ? "#5c4a66" : "#5e5964") : n.kind === "keystone" ? "#3a2c40" : "#3a353e");
      fill.addColorStop(1, icon ? "#25212b" : "#0e0c10");
    }
    g.fillStyle = fill;
    g.beginPath();
    if (n.kind === "keystone") {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const rr = i % 2 ? r : r * 0.86;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.closePath();
    } else if (n.kind === "notable") {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      g.closePath();
    } else g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    if (icon) {
      // painted stat icon inside the node shape: grey and dim (locked), coloured (available), bright (allocated)
      g.save();
      g.clip();
      drawPassiveIcon(g, n, x, y, iconD, iconD * dpr, on ? 2 : can || pv ? 1 : 0);
      g.restore();
    }
    if (n.kind === "jewel") drawJewelSocket(g, x, y, r, n.id, on, time);
    // rim
    g.lineWidth = Math.max(1, (n.kind === "small" ? (on && icon ? 2.2 : 1.5) : 2.5) * c.z);
    g.strokeStyle = on ? "#ffe7b0" : can ? `rgba(140,200,255,${0.55 + 0.4 * Math.sin(time * 4)})` : pv ? (previewOk ? "#8cc8ff" : "#ff6e50") : n.kind === "keystone" ? "#8a6a9a" : n.kind === "notable" ? "#8f7646" : "#57505c";
    if (hov) g.strokeStyle = "#ffffff";
    if (n.kind === "jewel" && dragJewel && !asc) g.strokeStyle = dropOver === n.id ? (on ? "#9fffb0" : "#ff6e50") : on ? `rgba(140,255,170,${0.5 + 0.4 * Math.sin(time * 6)})` : g.strokeStyle;
    g.stroke();
    // class starts: emblem
    if (n.kind === "start" && n.cls) {
      const em = emblem(n.cls);
      const s = r * 1.7;
      g.globalAlpha = n.cls === myCls ? 1 : 0.35;
      g.drawImage(em, x - s / 2, y - s / 2, s, s);
      g.globalAlpha = 1;
    }
    g.restore();
    if (hit) {
      // search match: pulsing ring
      const p = 0.5 + 0.5 * Math.sin(time * 5);
      g.save();
      g.strokeStyle = `rgba(255,214,120,${0.55 + 0.4 * p})`;
      g.shadowColor = "rgba(255,190,80,0.9)";
      g.shadowBlur = 10;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, r + 5 + p * 4, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    // labels for notables / keystones when zoomed in
    if ((n.kind === "notable" || n.kind === "keystone" || n.kind === "start" || n.kind === "ascStart") && c.z > 0.6) {
      g.save();
      g.font = `${n.kind === "keystone" ? 600 : 500} ${Math.round(Math.max(10, 11 * c.z))}px "Cinzel", "Palatino Linotype", Georgia, serif`;
      g.textAlign = "center";
      g.textBaseline = "top";
      g.fillStyle = on ? "#ffe7b0" : n.kind === "keystone" ? "#c8a8d8" : "#a8987c";
      g.shadowColor = "#000";
      g.shadowBlur = 4;
      const label = n.kind === "start" ? CLASS_BY_ID.get(n.cls ?? "")?.name ?? n.name : n.name;
      g.fillText(tr(label), x, y + r + 4);
      g.restore();
    }
  }
}

/** Recompute search matches when the query, tab or node set changes. */
function updateHits(nodes: Map<string, DrawNode>) {
  const key = `${tab}|${query}|${nodes.size}`;
  if (key === hitsKey) return;
  hitsKey = key;
  hits = new Set<string>();
  if (query) {
    for (const n of nodes.values()) {
      // match both the English source and the shown (translated) text, so a Polish query finds nodes too
      const parts = [n.name];
      try {
        parts.push(...modLines(n.mods));
      } catch {
        /* nodes without mods */
      }
      if (n.desc) parts.push(...n.desc);
      const text = parts.map((x) => `${x} ${tr(x)}`).join(" ");
      if (text.toLowerCase().includes(query)) hits.add(n.id);
    }
  }
  if (foundEl) foundEl.textContent = query ? `${hits.size} found` : "";
}

function emblem(cls: string): HTMLCanvasElement {
  let e = emblemCache.get(cls);
  if (!e) {
    e = document.createElement("canvas");
    drawClassEmblem(e, cls, 96);
    emblemCache.set(cls, e);
  }
  return e;
}

/** Unused-node count for tests / debug. */
export const TREE_SIZE = PASSIVE_NODES.length;

/** Inner socket of a jewel node: an empty dark hole, or the socketed jewel as a faceted gem. */
function drawJewelSocket(g: CanvasRenderingContext2D, x: number, y: number, r: number, id: string, on: boolean, time: number) {
  const jw = progState.msg?.jw?.[id];
  g.save();
  g.fillStyle = "#050405";
  g.beginPath();
  g.arc(x, y, r * 0.62, 0, Math.PI * 2);
  g.fill();
  if (jw) {
    const col = JEWEL_BASE_BY_ID.get(jw.b)?.color ?? "#c8a0ff";
    const rr = r * 0.55;
    const grd = g.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.05, x, y, rr);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.35, col);
    grd.addColorStop(1, "#0a0608");
    g.shadowColor = col;
    g.shadowBlur = 10 + 3 * Math.sin(time * 3);
    g.fillStyle = grd;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y - rr);
    g.lineTo(x, y + rr);
    g.moveTo(x - rr * 0.86, y - rr * 0.5);
    g.lineTo(x + rr * 0.86, y + rr * 0.5);
    g.stroke();
  } else {
    g.strokeStyle = on ? "rgba(216,179,106,0.55)" : "rgba(120,110,130,0.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, r * 0.62, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}
