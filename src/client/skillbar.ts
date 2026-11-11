// Client side of skills: the 16-slot skill bar HUD (one row of 8; holding Ctrl shows the second 8 in place), the Skills panel (K) for socketing
// and cutting gems, gem tooltips, and which slot the held keys use. The server (server/skills.ts)
// owns the truth; this only mirrors the `bar` / `skcd` messages and sends socket / unsocket / cut.
import { ATTR_COLOR, ATTR_NAME, MAX_EQUIPPED_SKILLS, MAX_SOCKETS } from "../shared/content/gems";
import type { GridEntry } from "../shared/grid";
import { itemInfoHooks, type Item } from "../shared/items";
import type { ClientMsg, PlayerSnap, ServerMsg } from "../shared/protocol";
import {
  actionLines,
  BAR_MAIN,
  BAR_SIZE,
  barSkillIds,
  computeSkill,
  cutOptions,
  effectiveSlot,
  emptyBar,
  gemColor,
  gemDisplayName,
  gemLevel,
  gemLines,
  isGem,
  isRough,
  isSkillGem,
  isSupportGem,
  skillDefOf,
  socketCount,
  supportDefOf,
  supportTier,
  upgradeRefusal,
  weaponOf,
  type Attrs,
  type BarSlot,
  type SkillAction,
} from "../shared/skills";
import { defaultStats, sanitizeStats, type Stats } from "../shared/stats";
import { gemCanvas, rgba, skillIcon, skillIconCopy, skillIconVersion, supportIcon, gemTipIcon, tipIconHtml } from "./gfx/gemart";
import { input } from "./input";
import { actionLabel, isCodeDown, onBindsChange, skillSlotLabel } from "./keybinds";
import { registerPanel } from "./options";
import { getHudLayout, onHudLayoutChange, rectToCss } from "./hud/layout";
import { setSpiritProvider } from "./hud/state";
import { hudArt, hudArtVersion } from "./hud/skin";
import { isHudHidden } from "./hud/dock";

// ---- mirrored state ------------------------------------------------------------------

const S = {
  bar: emptyBar() as BarSlot[],
  on: new Set<number>(),
  cdEnd: new Array<number>(BAR_SIZE).fill(0),
  cdDur: new Array<number>(BAR_SIZE).fill(1),
  en: new Array<number>(BAR_SIZE).fill(0),
  mp: 0,
  stats: defaultStats() as Stats,
  mainhand: null as Item | null,
  attrs: { str: 0, dex: 0, int: 0 } as Attrs,
  inv: [] as GridEntry[],
  lastSnap: 0,
  alive: false,
  acts: [] as (SkillAction | null)[],
};
let send: (m: ClientMsg) => void = () => {};
let actsDirty = true;

const now = () => performance.now();

/** Hook the network sender (main.ts). */
export function initSkills(sender: (m: ClientMsg) => void) {
  send = sender;
  setSpiritProvider(() => ({ used: spiritUsedNow(), total: Math.round(S.stats.spirit) }));
}

/** Spirit reserved by the toggled-on skills (same sum as the Skills panel header). */
function spiritUsedNow(): number {
  const A = acts();
  return [...S.on].reduce((t, i) => t + (A[i]?.spirit ?? 0), 0);
}

function slotOf(i: number): BarSlot | null {
  return effectiveSlot(S.bar, i, S.mainhand);
}

function acts(): (SkillAction | null)[] {
  if (!actsDirty) return S.acts;
  const w = weaponOf(S.mainhand);
  S.acts = Array.from({ length: BAR_SIZE }, (_, i) => {
    const s = slotOf(i);
    if (!s?.gem) return i === 0 ? computeSkill(null, S.stats, w, !!S.mainhand, S.attrs) : null;
    return computeSkill(s, S.stats, w, !!S.mainhand, S.attrs);
  });
  actsDirty = false;
  return S.acts;
}

/** Every server message passes through here first (main.ts). */
export function skillOnMessage(msg: ServerMsg) {
  switch (msg.t) {
    case "bar":
      S.bar = msg.bar;
      S.on = new Set(msg.on);
      actsDirty = true;
      barDirty = panelDirty = true;
      break;
    case "skcd":
      if (msg.cd > 0) {
        S.cdEnd[msg.s] = now() + msg.cd * 1000;
        S.cdDur[msg.s] = msg.cd * 1000;
      } else S.cdEnd[msg.s] = 0;
      if (msg.en !== undefined) S.en[msg.s] = msg.en;
      break;
    case "stats":
      S.stats = sanitizeStats(msg.stats);
      actsDirty = true;
      panelDirty = true;
      break;
    case "inv":
      S.inv = msg.inv;
      if (S.mainhand?.id !== msg.equip.mainhand?.id || S.mainhand?.b !== msg.equip.mainhand?.b) barDirty = true;
      S.mainhand = msg.equip.mainhand ?? null;
      actsDirty = true;
      panelDirty = true;
      break;
    case "prog":
      S.attrs = { str: msg.def.str, dex: msg.def.dex, int: msg.def.int };
      actsDirty = true;
      panelDirty = true;
      break;
  }
  if (pickSlot >= 0 && (msg.t === "bar" || msg.t === "inv")) buildPicker();
}

/** Own player snapshot (mana, alive). */
export function skillOnSnap(me: PlayerSnap | undefined) {
  S.lastSnap = now();
  if (!me) return;
  if (typeof me.mp === "number") S.mp = me.mp;
  S.alive = me.alive;
}

/** Mana globe fill 0..1 (render.ts). */
export function manaFrac(): number {
  return S.stats.maxMana > 0 ? Math.max(0, Math.min(1, S.mp / S.stats.maxMana)) : 0;
}

/** Current mana (rounded) for the globe number. */
export function manaNow(): number {
  return Math.floor(S.mp);
}

/**
 * Held keys -> what the input command uses: the lowest held slot with a gem (or the weapon skill);
 * slot 0 without a gem is the free basic attack.
 */
export function heldSlot(held: boolean[]): { attack: boolean; sk?: number } {
  for (let i = 0; i < BAR_SIZE; i++) {
    if (!held[i]) continue;
    if (slotOf(i)?.gem) return { attack: false, sk: i };
    if (i === 0) return { attack: true };
  }
  return { attack: false };
}

// ---- styles ----------------------------------------------------------------------------

const CSS = `
#skbar { position: fixed; right: 14px; bottom: 12px; display: none; flex-direction: column; gap: var(--gp, 4px); z-index: 8; user-select: none;
  font-family: var(--font-title, "Cinzel", "Palatino Linotype", "Book Antiqua", Georgia, serif); padding: 0; background: none; border: none; }
#skbar .row { display: flex; gap: var(--gp, 4px); }
#skbar .modtag { position: absolute; left: 0; bottom: calc(100% + 2px); padding: 0 5px; font-size: calc(var(--sz) * 0.26); line-height: 1.5; letter-spacing: 0.12em;
  color: #f0d8a0; background: linear-gradient(180deg, #2a2420, #120f0e); border: 1px solid #7a6440; border-radius: 2px; box-shadow: 0 0 6px rgba(216,184,96,0.35);
  text-shadow: 0 1px 1px #000; display: none; pointer-events: none; }
#skbar.swapped .modtag { display: block; }
.sk-slot.nospirit .cd::after { content: "!"; position: absolute; right: 2px; top: 0; font: bold 11px Georgia, serif; color: #ff3030; text-shadow: 0 0 2px #000; }
/* square carved-stone socket; painted frame (hud_slot) when present, bevel otherwise */
.sk-slot { position: relative; width: var(--sz); height: var(--sz); border-radius: 2px; cursor: pointer; overflow: hidden;
  background: radial-gradient(circle at 50% 38%, #24201d 0%, #121010 62%, #070606 100%);
  box-shadow: inset 0 0 0 1px #050405, inset 1px 1px 0 2px rgba(150,138,118,0.28), inset -1px -1px 0 2px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.8); }
/* (the icon canvas carries its own inline size: !important keeps it inside the socket) */
.sk-slot canvas { position: absolute; inset: 3px; width: calc(100% - 6px) !important; height: calc(100% - 6px) !important; border-radius: 1px; }
#skbar.art .sk-slot canvas { inset: calc(var(--skb, 3px) - 1px); width: calc(100% - 2 * (var(--skb, 3px) - 1px)) !important; height: calc(100% - 2 * (var(--skb, 3px) - 1px)) !important; }
.sk-slot .frm { position: absolute; inset: 0; pointer-events: none; z-index: 1; border-radius: 2px;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.9), inset 0 0 0 2px rgba(122,100,64,0.45), inset 0 0 6px rgba(0,0,0,0.75); }
#skbar.art .sk-slot .frm { box-shadow: none; border-style: solid; border-width: var(--skb, 3px); border-image-source: var(--skf); border-image-slice: var(--sks) fill; border-image-repeat: stretch; box-sizing: border-box; }
#skbar.art .sk-slot { box-shadow: 0 1px 2px rgba(0,0,0,0.8); }
.sk-slot .cd { position: absolute; inset: 0; border-radius: 2px; pointer-events: none; z-index: 2; }
.sk-slot .cdt { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 600 calc(var(--sz) * 0.36) Georgia, serif;
  color: #fff4dc; text-shadow: 0 0 3px #000, 0 0 6px #000; pointer-events: none; z-index: 3; }
/* key label: a small plate in the top-left corner so the picture stays clear */
.sk-slot .key { position: absolute; left: 0; top: 0; padding: 0 2px 0 1px; font: 700 max(7px, calc(var(--sz) * 0.19))/1.15 var(--font-body, "Palatino Linotype", Georgia, serif); letter-spacing: 0; color: #f0e2c4;
  background: rgba(8,7,8,0.82); border-radius: 1px 0 3px 0; box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
  text-shadow: 0 1px 1px #000; pointer-events: none; max-width: calc(100% - 4px); overflow: hidden; white-space: nowrap; z-index: 4; }
.sk-slot .en { position: absolute; left: 3px; right: 3px; bottom: 0; height: 3px; border-radius: 2px; background: rgba(0,0,0,0.6); pointer-events: none; z-index: 4; }
.sk-slot .en i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, #6cf0c0, #e8fff4); box-shadow: 0 0 6px #6cf0c0; }
.sk-slot.nomana canvas { filter: grayscale(1) brightness(0.45); }
.sk-slot.nomana::after { content: ""; position: absolute; inset: 0; border-radius: 2px; background: rgba(30,50,140,0.28); pointer-events: none; z-index: 2; }
.sk-slot.bad canvas { filter: grayscale(0.85) brightness(0.62); }
/* cannot be used with this weapon: red wash + a red bar across the picture */
.sk-slot.bad::after { content: ""; position: absolute; inset: 0; border-radius: 2px; pointer-events: none; z-index: 2;
  background: linear-gradient(135deg, transparent 46.5%, rgba(210,44,32,0.92) 46.5%, rgba(210,44,32,0.92) 53.5%, transparent 53.5%), rgba(120,16,12,0.2); }
/* slot picker: a small list above the clicked bar slot */
#sk-pick { position: fixed; display: none; z-index: 12; min-width: 190px; max-width: 280px; max-height: min(320px, 55vh); overflow-y: auto; box-sizing: border-box; padding: 5px;
  font: 13px var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif); color: #e2d4b6; user-select: none;
  background: linear-gradient(180deg, rgba(22,19,24,0.98), rgba(10,9,12,0.98)); border: 1px solid rgba(216,179,106,0.45); border-radius: 5px;
  box-shadow: 0 0 0 1px #050405, 0 8px 28px rgba(0,0,0,0.85); scrollbar-width: thin; scrollbar-color: #6a5636 #0c0b0d; }
#sk-pick .pk-h { font-family: var(--font-title, "Cinzel", "Palatino Linotype", Georgia, serif); color: #c8a060; letter-spacing: 1px; font-size: 12px; padding: 1px 6px 4px; border-bottom: 1px solid #2c2830; margin-bottom: 3px; }
#sk-pick .pk-row { display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 3px; cursor: pointer; }
#sk-pick .pk-row:hover { background: rgba(216,179,106,0.16); }
#sk-pick .pk-row canvas { width: 28px; height: 28px; border-radius: 3px; box-shadow: 0 0 0 1px #050405; flex: none; }
#sk-pick .pk-row .nm { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#sk-pick .pk-row .lv { color: #a89c84; font-size: 12px; white-space: nowrap; }
#sk-pick .pk-row.out, #sk-pick .pk-row.more { color: #a89c84; padding: 4px 6px; }
#sk-pick .pk-note { color: #8a7f6c; padding: 4px 6px; }
/* tooltip header picture (skill / support) */
.tt-ico { float: left; width: 36px; height: 36px; margin: 1px 9px 3px 0; border-radius: 4px; box-shadow: 0 0 0 1px #050405, inset 0 0 0 1px rgba(255,255,255,0.14); overflow: hidden; }
.tt-ico.round { border-radius: 50%; }
.tt-ico img { display: block; width: 100%; height: 100%; filter: drop-shadow(0 0 2px #000); }
.tt-clr { clear: both; }
/* toggled (aura / meta) skill: marker INSIDE the slot above the icon, plus an outer halo above the neighbours */
.sk-slot .tg { position: absolute; inset: 0; border-radius: 2px; pointer-events: none; z-index: 3; display: none;
  box-shadow: inset 0 0 0 2px var(--ac), inset 0 0 8px var(--ac); animation: sktg 1.6s ease-in-out infinite; }
.sk-slot.on { z-index: 1; overflow: visible; box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px var(--ac), 0 0 10px var(--ac); }
.sk-slot.on .tg { display: block; }
.sk-slot.on canvas { animation: skpulse 1.6s ease-in-out infinite; }
@keyframes skpulse { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.35); } }
@keyframes sktg { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }
.sk-slot.held { transform: scale(0.94); box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px #f0d8a0; }
.sk-slot.held.on { box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px #f0d8a0, 0 0 10px var(--ac); }
.sk-slot.empty { opacity: 0.55; }
.sk-slot.innate canvas { opacity: 0.9; }
.sk-slot.innate::before { content: "W"; position: absolute; right: 1px; bottom: 0; font-size: 7px; line-height: 1; color: #e0c890; z-index: 4; text-shadow: 0 0 2px #000; }

#sk-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); display: none; z-index: 11; color: var(--ink);
  font-size: 12px; padding: 12px 14px; max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); overflow: auto; box-sizing: border-box; user-select: none; }
/* STYLE v2: smooth serif type + carved dark frame (the body default is the old mono pixel face). */
#sk-panel { font-family: var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif); font-size: 13px;
  -webkit-font-smoothing: antialiased; font-smooth: auto; color: #e2d4b6;
  background: radial-gradient(ellipse at 50% 0%, rgba(70,40,26,0.35), transparent 60%), linear-gradient(180deg, rgba(22,19,24,0.97), rgba(10,9,12,0.98));
  border: 1px solid rgba(216,179,106,0.35); border-radius: 6px;
  box-shadow: 0 0 0 1px #050405, inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,230,180,0.06), 0 18px 60px rgba(0,0,0,0.85); }
#sk-panel .hd b, #sk-panel .bag h4, #sk-panel .bar-h { font-family: var(--font-title, "Cinzel", "Trajan Pro", "Palatino Linotype", Georgia, serif); color: #d8b36a; }
#sk-panel .cut button { font-family: inherit !important; font-size: 12px !important; }
#sk-panel { scrollbar-width: thin; scrollbar-color: #6a5636 #0c0b0d; }
#sk-panel .hd { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; border-bottom: 1px solid #2c2830; padding-bottom: 4px; margin-bottom: 6px; }
#sk-panel .hd b { color: #c8a060; letter-spacing: 3px; font-size: 14px; }
#sk-panel .hd span { color: #a89c84; }
#sk-panel .hint { color: #8a7f6c; margin-bottom: 8px; min-height: 15px; }
#sk-panel .hint b { color: #f0d8a0; }
#sk-panel .cols { display: flex; gap: 16px; flex-wrap: wrap; }
#sk-panel .bar { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(8, auto); grid-auto-flow: column; gap: 4px 14px; }
#sk-panel.narrow .cols { flex-direction: column; flex-wrap: nowrap; }
#sk-panel.narrow .bar { grid-template-columns: 1fr; grid-template-rows: none; grid-auto-flow: row; }
#sk-panel.narrow .srow { min-width: 0; }
#sk-panel.narrow .bag { max-width: none; order: -1; } /* docked: bag + cut choices on top, never below the fold */
#sk-panel.narrow .bgrid { grid-template-columns: repeat(auto-fill, 44px); }
#sk-panel .srow { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 4px; background: rgba(255,255,255,0.02); min-width: 300px; }
#sk-panel .srow.focus { background: rgba(240,200,120,0.08); box-shadow: inset 0 0 0 1px #6a5430; }
#sk-panel .k { width: 54px; flex: none; color: #d8c08a; font-size: 10px; text-align: right; white-space: nowrap; overflow: hidden; }
#sk-panel .gcell { position: relative; width: 40px; height: 40px; flex: none; border-radius: 6px; background: #09080a; box-shadow: inset 0 0 0 1px #2c2830; cursor: pointer; }
#sk-panel .gcell canvas { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 6px; }
#sk-panel .gcell.target { box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px #f0d070, 0 0 8px rgba(240,208,112,0.6); }
#sk-panel .nm { flex: 1; min-width: 70px; line-height: 1.25; }
#sk-panel .nm i { display: block; font-style: normal; color: #7a705e; font-size: 10px; }
#sk-panel .socks { display: flex; gap: 3px; }
#sk-panel .sock { position: relative; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #16141a, #050405);
  box-shadow: inset 0 0 0 1px #3c3842; cursor: pointer; }
#sk-panel .sock canvas { position: absolute; inset: -2px; width: 26px !important; height: 26px !important; border-radius: 50%; }
#sk-panel .sock.locked { opacity: 0.18; cursor: default; }
#sk-panel .sock.off canvas { filter: grayscale(1) brightness(0.6); }
#sk-panel .sock.off::after { content: "!"; position: absolute; right: -2px; top: -4px; color: #ff6a5a; font-weight: bold; font-size: 11px; text-shadow: 0 0 2px #000; }
#sk-panel .sock.target { box-shadow: inset 0 0 0 1px #050405, 0 0 0 1px #f0d070, 0 0 6px rgba(240,208,112,0.7); }
#sk-panel .inner { margin-left: 4px; width: 30px; height: 30px; border-radius: 50%; }
#sk-panel .inner canvas { border-radius: 50%; }
#sk-panel .bag h4, #sk-panel .bar-h { margin: 2px 0 6px; color: #c8a060; letter-spacing: 2px; font-size: 11px; text-transform: uppercase; }
#sk-panel .bag { min-width: 236px; max-width: 280px; }
#sk-panel .bgrid { display: grid; grid-template-columns: repeat(5, 44px); gap: 5px; }
#sk-panel .bgrid .gcell { width: 44px; height: 44px; }
#sk-panel .bgrid .gcell.sel { box-shadow: inset 0 0 0 1px #050405, 0 0 0 2px #f0d8a0, 0 0 10px rgba(240,216,160,0.7); }
#sk-panel .lv { position: absolute; right: 3px; bottom: 1px; font-size: 9px; font-weight: bold; color: #f0e2c4; text-shadow: 0 0 2px #000; pointer-events: none; }
#sk-panel .cut { margin-top: 10px; border-top: 1px solid #241f26; padding-top: 6px; }
#sk-panel .cut button { display: block; width: 100%; margin: 3px 0; padding: 4px 6px; text-align: left; font: 11px var(--mono); color: #e8dcc4; cursor: pointer;
  background: linear-gradient(180deg, #221c24, #121014); border: 1px solid #050405; box-shadow: inset 0 0 0 1px #3c3842; border-radius: 3px; }
#sk-panel .cut button:hover:not(:disabled) { box-shadow: inset 0 0 0 1px #c8a060; }
#sk-panel .cut button:disabled { color: #5a5248; cursor: default; }
#sk-panel .cut button em { font-style: normal; float: right; color: #7a705e; }
#sk-panel .empty-note { color: #5a5248; }
`;

// ---- the HUD bar --------------------------------------------------------------------

let barEl: HTMLDivElement | null = null;
let modTagEl: HTMLDivElement | null = null;
let barDirty = true;
/** Bar index offset currently shown (0 = main set, BAR_MAIN = the Ctrl set). */
let barOff = 0;
interface SlotEls {
  el: HTMLDivElement;
  cd: HTMLDivElement;
  cdt: HTMLDivElement;
  key: HTMLDivElement;
  en: HTMLDivElement;
  enFill: HTMLElement;
  icon: string;
  /** Bar index this element showed at the last rebuild (k, or k + BAR_MAIN while Ctrl swaps the set). */
  idx: number;
}
const slotEls: SlotEls[] = [];
const tipEl = () => document.getElementById("tooltip") as HTMLDivElement | null;
let tipOwner: string | null = null;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function showTip(owner: string, html: string, x: number, y: number) {
  const t = tipEl();
  if (!t) return;
  tipOwner = owner;
  t.innerHTML = html;
  t.style.display = "block";
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  t.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 16)) + "px";
  t.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y - h - 12 > 8 ? y - h - 12 : y + 16)) + "px";
}
function hideTip(owner?: string) {
  if (owner && tipOwner !== owner) return;
  const t = tipEl();
  if (t && tipOwner) t.style.display = "none";
  tipOwner = null;
}

function lineHtml(l: string): string {
  if (l.startsWith("! ")) return `<span class="bad">${esc(l.slice(2))}</span>`;
  return esc(l);
}

/** skillIcon id of the free basic attack: bow / crossbow shows the arrow. */
function basicIconId(a: SkillAction | null | undefined): string {
  return a?.tags.includes("projectile") ? "basic_ranged" : "";
}

/** Skills panel picture of a gem: the painted skill / support icon, else the gem itself. */
function panelGemCanvas(it: Item, size: number): HTMLCanvasElement {
  const d = skillDefOf(it);
  if (d) return skillIconCopy(d.id, size);
  const sd = supportDefOf(it);
  return (sd && supportIcon(sd.id, size, supportTier(it))) || gemCanvas(it, size);
}

function slotTipHtml(i: number): string {
  const s = slotOf(i);
  const a = acts()[i];
  const key = skillSlotLabel(i);
  if (!a) return `<div class="tt-name" style="color:#8a7f6c">Empty slot</div><div class="tt-sub">Key ${esc(key)} · open the Skills panel (${esc(actionLabel("skills"))}) to socket a gem</div>`;
  const def = skillDefOf(s?.gem);
  const col = def ? ATTR_COLOR[def.attr] : "#e8e0d0";
  let h = `${tipIconHtml("skill", def ? def.id : basicIconId(a))}<div class="tt-name" style="color:${col}">${esc(a.name)}</div><div class="tt-sub">Key ${esc(key)}${def ? ` · ${ATTR_NAME[def.attr]}` : ""}</div><div class="tt-clr"></div>`;
  h += `<div class="tt-sec">${actionLines(a).map(lineHtml).join("<br>")}</div>`;
  const sups = a.supports;
  if (sups.length) h += `<div class="tt-sec tt-mods">${sups.map((x) => (x.ok ? esc(x.name) : `<span class="bad">${esc(x.name)}</span>`)).join("<br>")}</div>`;
  if (def?.desc) h += `<div class="tt-hint">${esc(def.desc)}</div>`;
  return h;
}

function gemTipHtml(it: Item, hint = ""): string {
  const col = gemColor(it);
  let h = `${gemTipIcon(it)}<div class="tt-name" style="color:${col}">${esc(gemDisplayName(it))}</div><div class="tt-clr"></div>`;
  const lines = gemLines(it, S.attrs);
  if (lines.length) h += `<div class="tt-sec">${lines.map(lineHtml).join("<br>")}</div>`;
  const sd = supportDefOf(it);
  if (sd?.desc && !lines.includes(sd.desc)) h += `<div class="tt-hint">${esc(sd.desc)}</div>`;
  if (hint) h += `<div class="tt-hint">${esc(hint)}</div>`;
  return h;
}

function ensureDom() {
  if (barEl) return;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.appendChild(st);
  barEl = document.createElement("div");
  barEl.id = "skbar";
  // One visible row of 8 (LMB MMB RMB Q E R T G); holding Ctrl shows the second set in place.
  const row = document.createElement("div");
  row.className = "row";
  modTagEl = document.createElement("div");
  modTagEl.className = "modtag";
  barEl.append(modTagEl, row);
  for (let k = 0; k < BAR_MAIN; k++) {
    const el = document.createElement("div");
    el.className = "sk-slot";
    const cd = document.createElement("div");
    cd.className = "cd";
    const cdt = document.createElement("div");
    cdt.className = "cdt";
    const key = document.createElement("div");
    key.className = "key";
    const en = document.createElement("div");
    en.className = "en";
    const enFill = document.createElement("i");
    en.appendChild(enFill);
    const frm = document.createElement("span");
    frm.className = "frm";
    const tg = document.createElement("span");
    tg.className = "tg";
    el.append(frm, cd, tg, cdt, en, key);
    const idx = () => slotEls[k].idx;
    el.addEventListener("mouseenter", (e) => showTip("bar" + k, slotTipHtml(idx()), e.clientX, e.clientY));
    el.addEventListener("mousemove", (e) => showTip("bar" + k, slotTipHtml(idx()), e.clientX, e.clientY));
    el.addEventListener("mouseleave", () => hideTip("bar" + k));
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    el.addEventListener("click", () => {
      hideTip("bar" + k);
      togglePicker(idx(), el);
    });
    row.appendChild(el);
    slotEls.push({ el, cd, cdt, key, en, enFill, icon: "?", idx: k });
  }
  document.body.appendChild(barEl);

  panelEl = document.createElement("div");
  panelEl.id = "sk-panel";
  panelEl.className = "frame";
  panelEl.addEventListener("contextmenu", (e) => e.preventDefault());
  panelEl.addEventListener("mousedown", (e) => e.stopPropagation());
  document.body.appendChild(panelEl);
  onBindsChange(() => {
    barDirty = true;
    panelDirty = true;
  });
  window.addEventListener("resize", () => (barDirty = true));
  onHudLayoutChange(() => (barDirty = true));
}

/** Place the bar on the shared HUD layout's skill-bar rect (canvas and DOM agree); returns the slot size. */
function placeBar(): number {
  const L = getHudLayout();
  const box = rectToCss(L, L.skillBar);
  const sz = Math.max(16, Math.round(L.skillSlot * L.u));
  const gap = Math.max(1, Math.round(L.u));
  if (barEl) {
    // Centred on the layout rect (the rect is sized for 8 slots of L.skillSlot u + 1u gaps).
    const rowW = sz * BAR_MAIN + gap * (BAR_MAIN - 1);
    barEl.style.right = "auto";
    barEl.style.left = Math.round(box.left + (box.width - rowW) / 2) + "px";
    barEl.style.bottom = Math.round(box.bottom + (box.height - sz) / 2) + "px";
    barEl.style.setProperty("--gp", gap + "px");
  }
  return sz;
}

function rebuildBar() {
  if (!barEl) return;
  const sz = placeBar();
  barEl.style.setProperty("--sz", sz + "px");
  // Painted skill socket frame (art/out/hud/hud_slot) as a 9-slice border-image when it has loaded.
  const art = hudArt("hud_slot");
  barEl.classList.toggle("art", !!art && !!art.slice);
  if (art && art.slice) {
    barEl.style.setProperty("--skf", `url("${art.img.src}")`);
    barEl.style.setProperty("--sks", art.slice.map((v) => Math.round(v)).join(" "));
    barEl.style.setProperty("--skb", Math.max(2, Math.round((art.def.borderU ?? 3) * getHudLayout().u * 0.8)) + "px");
  }
  for (let k = 0; k < BAR_MAIN; k++) {
    const se = slotEls[k];
    const i = k + barOff;
    se.idx = i;
    const s = slotOf(i);
    const def = skillDefOf(s?.gem);
    const innate = !S.bar[i]?.gem && !!def;
    const id = def ? def.id : i === 0 ? basicIconId(acts()[0]) : "-";
    const iconKey = `${id}|${sz}|${skillIconVersion()}`;
    if (se.icon !== iconKey) {
      se.el.querySelector("canvas")?.remove();
      if (id !== "-") se.el.prepend(skillIcon(id, sz));
      se.icon = iconKey;
    }
    se.el.classList.toggle("empty", id === "-");
    se.el.classList.toggle("innate", innate);
    se.el.style.setProperty("--ac", def ? ATTR_COLOR[def.attr] : "#c8a060");
    se.key.textContent = skillSlotLabel(i);
    se.en.style.display = def?.kind === "meta" ? "block" : "none";
  }
  if (modTagEl) modTagEl.textContent = barOff ? `II · ${modLabel()}` : "";
  barEl.classList.toggle("swapped", barOff > 0);
  barArtSeen = hudArtVersion();
  iconVerSeen = skillIconVersion();
  barDirty = false;
}
let barArtSeen = -1;
let iconVerSeen = -1;
let artCheckAt = 0;

/** Label of the modifier that swaps the bar ("Ctrl"), read from the second set's first binding. */
function modLabel(): string {
  const m = /^([A-Za-z]+)\+/.exec(skillSlotLabel(BAR_MAIN));
  return m ? m[1] : "Ctrl";
}

/** True while the bar modifier (Ctrl) is held: the bar shows the second set (PoE2 secondary skill bar). */
function modHeldNow(): boolean {
  return isCodeDown("ControlLeft") || isCodeDown("ControlRight");
}

/** Own player alive with a fresh snapshot (the bottom band shows); prog.ts hides the XP bar otherwise. */
export function selfAliveForHud(): boolean {
  return S.lastSnap > 0 && now() - S.lastSnap < 1500 && S.alive;
}

function updateBar() {
  if (!barEl) return;
  const show = now() - S.lastSnap < 1500 && S.lastSnap > 0;
  barEl.style.display = show && S.alive && !isHudHidden() ? "flex" : "none";
  if (pickSlot >= 0 && barEl.style.display === "none") closePicker();
  if (!show) {
    if (panelOpen) togglePanel(false);
    return;
  }
  if (!S.alive) return; // dead / spectating: no skill bar
  const off = modHeldNow() ? BAR_MAIN : 0;
  if (off !== barOff) {
    barOff = off;
    barDirty = true;
    hideTip();
  }
  if (barArtSeen !== hudArtVersion() || iconVerSeen !== skillIconVersion()) barDirty = true;
  if (now() > artCheckAt) {
    // the painted frame image may finish loading (or be turned off) after the index
    artCheckAt = now() + 1000;
    if (!!hudArt("hud_slot")?.slice !== barEl.classList.contains("art")) barDirty = true;
  }
  if (barDirty) rebuildBar();
  const A = acts();
  const t = now();
  const overSpirit = spiritUsedNow() > Math.round(S.stats.spirit);
  for (let k = 0; k < BAR_MAIN; k++) {
    const se = slotEls[k];
    const i = se.idx;
    const a = A[i];
    const left = S.cdEnd[i] - t;
    if (left > 0) {
      const f = Math.max(0, Math.min(1, left / S.cdDur[i]));
      se.cd.style.background = `conic-gradient(rgba(0,0,0,0.72) ${(f * 360).toFixed(1)}deg, rgba(0,0,0,0) 0)`;
      se.cdt.textContent = left > 1000 ? String(Math.ceil(left / 1000)) : (left / 1000).toFixed(1);
    } else if (se.cdt.textContent || se.cd.style.background) {
      se.cd.style.background = "";
      se.cdt.textContent = "";
    }
    const isToggle = a?.kind === "aura" || a?.kind === "meta";
    se.el.classList.toggle("nomana", !!a && !isToggle && a.cost > S.mp + 1e-6);
    se.el.classList.toggle("bad", !!a && !a.ok);
    se.el.classList.toggle("on", S.on.has(i));
    se.el.classList.toggle("nospirit", overSpirit && isToggle && S.on.has(i) && (a?.spirit ?? 0) > 0);
    se.el.classList.toggle("held", !!input.skills[i] && !!a);
    if (a?.kind === "meta") se.enFill.style.width = `${Math.max(0, Math.min(100, S.en[i]))}%`;
  }
}

// ---- slot picker (click a bar slot) --------------------------------------------------------

let pickEl: HTMLDivElement | null = null;
let pickSlot = -1;
let pickAnchor: HTMLElement | null = null;

function closePicker() {
  pickSlot = -1;
  pickAnchor = null;
  if (pickEl) pickEl.style.display = "none";
}

/** Open the picker above a bar slot (a second click on the same slot closes it). */
function togglePicker(i: number, anchor: HTMLElement) {
  if (pickSlot === i) return closePicker();
  if (!pickEl) {
    pickEl = document.createElement("div");
    pickEl.id = "sk-pick";
    pickEl.addEventListener("mousedown", (e) => e.stopPropagation());
    pickEl.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(pickEl);
    // A press anywhere else closes it (the slots handle their own clicks).
    window.addEventListener("mousedown", (e) => {
      if (pickSlot >= 0 && !(e.target instanceof Node && (pickEl!.contains(e.target) || barEl?.contains(e.target)))) closePicker();
    }, true);
    registerPanel({ isOpen: () => pickSlot >= 0, close: closePicker });
  }
  pickSlot = i;
  pickAnchor = anchor;
  buildPicker();
}

/** The picker's rows: the skill gems in the bag that the slot accepts, taking the gem out, and the Skills panel. */
function buildPicker() {
  if (!pickEl || pickSlot < 0 || !pickAnchor) return;
  const i = pickSlot;
  const bs = S.bar[i];
  if (!bs || !S.alive) return closePicker();
  pickEl.innerHTML = "";
  const row = (cls: string, text: string, click: () => void) => {
    const r = document.createElement("div");
    r.className = "pk-row " + cls;
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = text;
    r.appendChild(nm);
    r.addEventListener("click", () => {
      hideTip("pick");
      click();
    });
    pickEl!.appendChild(r);
    return r;
  };
  const h = document.createElement("div");
  h.className = "pk-h";
  h.textContent = skillSlotLabel(i);
  pickEl.appendChild(h);
  const others = barSkillIds(S.bar, i);
  const full = others.length + 1 > MAX_EQUIPPED_SKILLS;
  const gems = full ? [] : bagGems().filter((it) => isSkillGem(it) && !others.includes(skillDefOf(it)!.id));
  for (const it of gems) {
    const r = row("", gemDisplayName(it), () => {
      act({ t: "socket", id: it.id, slot: i });
      closePicker();
    });
    r.firstElementChild!.setAttribute("style", `color:${gemColor(it)}`);
    r.prepend(skillIconCopy(skillDefOf(it)!.id, 28));
    const lv = document.createElement("span");
    lv.className = "lv";
    lv.textContent = `Level ${gemLevel(it)}`;
    r.appendChild(lv);
    r.addEventListener("mouseenter", (e) => showTip("pick", gemTipHtml(it), e.clientX, e.clientY));
    r.addEventListener("mousemove", (e) => showTip("pick", gemTipHtml(it), e.clientX, e.clientY));
    r.addEventListener("mouseleave", () => hideTip("pick"));
  }
  if (!gems.length) {
    const n = document.createElement("div");
    n.className = "pk-note";
    n.textContent = full ? `At most ${MAX_EQUIPPED_SKILLS} skill gems` : "No skill gem in your bag for this slot";
    pickEl.appendChild(n);
  }
  if (bs.gem) row("out", "Take the gem out", () => {
    act({ t: "unsocket", slot: i });
    closePicker();
  });
  row("more", "Open the Skills panel", () => {
    closePicker();
    focusSlot = i;
    togglePanel(true);
  });
  // Above the slot, centred on it, kept on screen.
  pickEl.style.display = "block";
  const a = pickAnchor.getBoundingClientRect();
  const w = pickEl.offsetWidth;
  pickEl.style.left = `${Math.round(Math.max(6, Math.min(window.innerWidth - w - 6, a.left + a.width / 2 - w / 2)))}px`;
  pickEl.style.bottom = `${Math.round(window.innerHeight - a.top + 6)}px`;
}

// ---- Skills panel (K) ------------------------------------------------------------------

let panelEl: HTMLDivElement | null = null;
let panelOpen = false;
let panelDirty = true;
let selId = -1; // selected bag gem (item id)
let focusSlot = -1;

export function isSkillsPanelOpen() {
  return panelOpen;
}

export function togglePanel(force?: boolean) {
  ensureDom();
  panelOpen = force ?? !panelOpen;
  if (!panelOpen) {
    selId = -1;
    focusSlot = -1;
    hideTip();
  }
  panelEl!.style.display = panelOpen ? "block" : "none";
  panelDirty = true;
}

registerPanel({ isOpen: () => panelOpen, close: () => togglePanel(false) });

/** Open the Skills panel with a bag gem already picked up (right-click on a gem in the inventory). */
export function openSkillsWith(itemId: number) {
  togglePanel(true);
  selId = itemId;
  panelDirty = true;
}

function bagGems(): Item[] {
  return S.inv
    .map((e) => e.it)
    .filter((it) => isGem(it))
    .sort((a, b) => (isSkillGem(b) ? 2 : isSupportGem(b) ? 1 : 0) - (isSkillGem(a) ? 2 : isSupportGem(a) ? 1 : 0) || a.b.localeCompare(b.b));
}

function selected(): Item | null {
  if (selId < 0) return null;
  return S.inv.find((e) => e.it.id === selId)?.it ?? null;
}

function cell(cls: string, it: Item | null, size: number, opts: { tip?: () => string; click?: () => void; rclick?: () => void; lv?: string; owner: string; canvas?: HTMLCanvasElement }): HTMLDivElement {
  const el = document.createElement("div");
  el.className = cls;
  const cv = opts.canvas ?? (it ? panelGemCanvas(it, size) : null);
  if (cv) el.appendChild(cv);
  if (opts.lv) {
    const l = document.createElement("span");
    l.className = "lv";
    l.textContent = opts.lv;
    el.appendChild(l);
  }
  if (opts.tip) {
    const tip = opts.tip;
    el.addEventListener("mouseenter", (e) => showTip(opts.owner, tip(), e.clientX, e.clientY));
    el.addEventListener("mousemove", (e) => showTip(opts.owner, tip(), e.clientX, e.clientY));
    el.addEventListener("mouseleave", () => hideTip(opts.owner));
  }
  el.addEventListener("click", (e) => {
    e.preventDefault();
    opts.click?.();
  });
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    opts.rclick?.();
  });
  return el;
}

function act(m: ClientMsg) {
  send(m);
  selId = -1;
  hideTip();
  panelDirty = true;
}

let panelIconVer = -1;
function buildPanel() {
  if (!panelEl) return;
  panelDirty = false;
  panelIconVer = skillIconVersion();
  const sel = selected();
  if (selId >= 0 && !sel) selId = -1;
  const A = acts();
  const spiritUsed = [...S.on].reduce((t, i) => t + (A[i]?.spirit ?? 0), 0);
  const equipped = barSkillIds(S.bar).length;
  panelEl.innerHTML = "";

  const hd = document.createElement("div");
  hd.className = "hd";
  hd.innerHTML =
    `<b>SKILLS</b><span>Gems ${equipped} / ${MAX_EQUIPPED_SKILLS} · Spirit ${spiritUsed} / ${Math.round(S.stats.spirit)} · ` +
    `Mana ${Math.floor(S.mp)} / ${Math.round(S.stats.maxMana)} · ` +
    `<span style="color:${ATTR_COLOR.str}">Str ${Math.floor(S.attrs.str)}</span> <span style="color:${ATTR_COLOR.dex}">Dex ${Math.floor(S.attrs.dex)}</span> <span style="color:${ATTR_COLOR.int}">Int ${Math.floor(S.attrs.int)}</span></span>`;
  panelEl.appendChild(hd);

  const hint = document.createElement("div");
  hint.className = "hint";
  if (!sel) hint.innerHTML = "Click a gem in your bag to pick it up, then click a bar slot or a socket. Right-click a socketed gem to take it out.";
  else if (isSkillGem(sel)) hint.innerHTML = `<b>${esc(gemDisplayName(sel))}</b>: click a bar slot${skillDefOf(sel)?.kind === "meta" ? "" : " (or a meta gem's centre socket)"}. Click the gem again to put it down.`;
  else if (isSupportGem(sel)) hint.innerHTML = `<b>${esc(gemDisplayName(sel))}</b>: click a socket of a skill (or the skill itself for the first free socket).`;
  else hint.innerHTML = `<b>${esc(gemDisplayName(sel))}</b>: choose what to cut it into, or raise one of your gems.`;
  panelEl.appendChild(hint);

  const cols = document.createElement("div");
  cols.className = "cols";
  panelEl.appendChild(cols);

  // -- bar slots --
  const barCol = document.createElement("div");
  const bh = document.createElement("div");
  bh.className = "bar-h";
  bh.textContent = "Skill bar";
  barCol.appendChild(bh);
  const bar = document.createElement("div");
  bar.className = "bar";
  barCol.appendChild(bar);
  cols.appendChild(barCol);
  // main set then the Ctrl set; the grid flows by column (main left, Ctrl right) or, docked narrow, one column
  for (let i = 0; i < BAR_SIZE; i++) bar.appendChild(slotRow(i, sel, A[i]));

  // -- bag gems --
  const bag = document.createElement("div");
  bag.className = "bag";
  const h4 = document.createElement("h4");
  h4.textContent = "Gems in your bag";
  bag.appendChild(h4);
  const grid = document.createElement("div");
  grid.className = "bgrid";
  const gems = bagGems();
  for (const it of gems) {
    const lv = isSupportGem(it) ? ["I", "II", "III"][Math.max(0, Math.min(2, Math.round(it.l) - 1))] : String(Math.round(it.l));
    grid.appendChild(
      cell("gcell" + (it.id === selId ? " sel" : ""), it, 44, {
        owner: "bag" + it.id,
        lv,
        tip: () => gemTipHtml(it, it.id === selId ? "Click to put it down" : "Click to pick it up"),
        click: () => {
          selId = selId === it.id ? -1 : it.id;
          hideTip();
          panelDirty = true;
        },
      }),
    );
  }
  bag.appendChild(grid);
  if (!gems.length) {
    const n = document.createElement("div");
    n.className = "empty-note";
    n.textContent = "No gems yet. Monsters drop Rough Crystals and the odd cut gem.";
    bag.appendChild(n);
  }
  if (sel && isRough(sel)) bag.appendChild(cutBox(sel));
  cols.appendChild(bag);
}

function slotRow(i: number, sel: Item | null, a: SkillAction | null | undefined): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "srow" + (i === focusSlot ? " focus" : "");
  const k = document.createElement("div");
  k.className = "k";
  k.textContent = skillSlotLabel(i);
  row.appendChild(k);
  const bs = S.bar[i];
  const eff = slotOf(i);
  const def = skillDefOf(eff?.gem);
  const innate = !bs.gem && !!def;
  const canTake = !!sel && isSkillGem(sel);
  const supTarget = !!sel && isSupportGem(sel) && !!bs.gem;

  const gemCell = cell("gcell" + (canTake ? " target" : ""), null, 40, {
    owner: "slot" + i,
    canvas: def ? skillIconCopy(def.id, 40) : i === 0 ? skillIconCopy(basicIconId(a), 40) : undefined,
    tip: () => slotTipHtml(i) + (bs.gem ? `<div class="tt-hint">Right-click to take the gem out</div>` : ""),
    click: () => {
      if (!sel) return;
      if (isSkillGem(sel)) act({ t: "socket", id: sel.id, slot: i });
      else if (isSupportGem(sel) && bs.gem) {
        const n = socketCount(bs.gem);
        let free = -1;
        for (let j = 0; j < n; j++) if (!bs.sups[j]) {
          free = j;
          break;
        }
        act({ t: "socket", id: sel.id, slot: i, sup: free < 0 ? 0 : free });
      }
    },
    rclick: () => {
      if (bs.gem) act({ t: "unsocket", slot: i });
    },
  });
  if (innate) gemCell.style.opacity = "0.75";
  row.appendChild(gemCell);

  const nm = document.createElement("div");
  nm.className = "nm";
  if (def && a) {
    const tag = innate ? "weapon skill" : def.kind === "aura" || def.kind === "meta" ? (S.on.has(i) ? "on" : "off") : `${a.cost} mana`;
    nm.innerHTML = `<span style="color:${ATTR_COLOR[def.attr]}">${esc(def.name)}</span><i>Lv ${a.level} · ${esc(tag)}</i>`;
  } else if (i === 0) nm.innerHTML = `<span style="color:#e8e0d0">${esc(a?.name ?? "Weapon Strike")}</span><i>free basic attack</i>`;
  else nm.innerHTML = `<span style="color:#5a5248">empty</span>`;
  row.appendChild(nm);

  // meta gem centre socket (the triggered spell)
  if (def?.kind === "meta" && bs.gem) {
    const innerGem = bs.inner ?? null;
    const c = cell("gcell inner" + (canTake && skillDefOf(sel!)?.kind !== "meta" ? " target" : ""), innerGem, 30, {
      owner: "inner" + i,
      tip: () => (innerGem ? gemTipHtml(innerGem, "Right-click to take it out") : `<div class="tt-name" style="color:#a89c84">Spell socket</div><div class="tt-sub">Socket a spell here; it fires when the energy is full</div>`),
      click: () => {
        if (sel && isSkillGem(sel)) act({ t: "socket", id: sel.id, slot: i, inner: 1 });
      },
      rclick: () => {
        if (innerGem) act({ t: "unsocket", slot: i, inner: 1 });
      },
    });
    row.appendChild(c);
  }

  // support sockets
  const socks = document.createElement("div");
  socks.className = "socks";
  const n = bs.gem ? socketCount(bs.gem) : 0;
  for (let j = 0; j < MAX_SOCKETS; j++) {
    const sup = bs.sups[j] ?? null;
    const locked = j >= n;
    const st = sup ? a?.supports.find((x) => x.id === supportDefOf(sup)?.id) : undefined;
    const off = !!sup && !!st && !st.ok;
    const el = cell("sock" + (locked ? " locked" : "") + (off ? " off" : "") + (!locked && supTarget ? " target" : ""), sup, 26, {
      owner: `sock${i}_${j}`,
      tip: locked
        ? undefined
        : () =>
            sup
              ? gemTipHtml(sup, (off && st?.why ? st.why + " · " : "") + "Right-click to take it out")
              : `<div class="tt-name" style="color:#a89c84">Empty socket</div><div class="tt-sub">Pick up a support gem and click here</div>`,
      click: () => {
        if (!locked && sel && isSupportGem(sel)) act({ t: "socket", id: sel.id, slot: i, sup: j });
      },
      rclick: () => {
        if (sup) act({ t: "unsocket", slot: i, sup: j });
      },
    });
    socks.appendChild(el);
  }
  row.appendChild(socks);
  return row;
}

function cutBox(rough: Item): HTMLDivElement {
  const box = document.createElement("div");
  box.className = "cut";
  const h = document.createElement("h4");
  h.textContent = "Cut into";
  box.appendChild(h);
  const isSup = rough.b === "rough_support";
  const onBar = new Set<string>();
  for (const s of S.bar) for (const g of [s.gem, s.inner, ...s.sups]) if (g) onBar.add(g.b);
  for (const e of S.inv) if (isSkillGem(e.it) || isSupportGem(e.it)) onBar.add(e.it.b);
  cutOptions(rough).forEach((o, n) => {
    // What the crystal would become: same tooltip the finished gem gets, plus what would stop it working right now.
    const preview: Item = { ...rough, b: (isSup ? "sup_" : "gem_") + o.id, n: o.name };
    const def = skillDefOf(preview);
    const wk = S.mainhand ? weaponOf(S.mainhand).kind : undefined;
    const wrong = !!def?.weapons && !(wk && def.weapons.includes(wk));
    const note = o.why ?? (onBar.has(preview.b) ? "you have it" : wrong ? "wrong weapon" : "");
    const b = document.createElement("button");
    b.disabled = !o.ok;
    b.innerHTML = `${esc(o.name)}${note ? `<em${!o.why && wrong ? ' style="color:#c9685a"' : ""}>${esc(note)}</em>` : ""}`;
    b.addEventListener("click", () => {
      hideTip();
      act({ t: "cut", id: rough.id, gem: o.id });
    });
    const tip = () => gemTipHtml(preview, o.why ?? (onBar.has(preview.b) ? "You already have this gem" : wrong ? `Will not work with your ${wk ?? "bare hands"}: needs ${def!.weapons!.join(" / ")}` : isSup ? "Click to cut, then socket it into a skill" : "Click to cut: it goes straight onto your skill bar"));
    b.addEventListener("mouseenter", (e) => showTip("cut" + n, tip(), e.clientX, e.clientY));
    b.addEventListener("mousemove", (e) => showTip("cut" + n, tip(), e.clientX, e.clientY));
    b.addEventListener("mouseleave", () => hideTip("cut" + n));
    box.appendChild(b);
  });
  if (rough.b !== "rough_support") {
    const targets: Item[] = [];
    for (const e of S.inv) if (isSkillGem(e.it) && !upgradeRefusal(rough, e.it)) targets.push(e.it);
    for (const s of S.bar) for (const g of [s.gem, s.inner]) if (g && isSkillGem(g) && !upgradeRefusal(rough, g)) targets.push(g);
    const h2 = document.createElement("h4");
    h2.textContent = "Or raise a gem";
    box.appendChild(h2);
    if (!targets.length) {
      const n = document.createElement("div");
      n.className = "empty-note";
      n.textContent = `No ${rough.b === "rough_spirit" ? "spirit" : "skill"} gem below level ${Math.round(rough.l)}.`;
      box.appendChild(n);
    }
    for (const g of targets) {
      const b = document.createElement("button");
      b.innerHTML = `${esc(skillDefOf(g)!.name)}<em>Lv ${Math.round(g.l)} → ${Math.round(rough.l)}</em>`;
      b.addEventListener("click", () => act({ t: "cut", id: rough.id, target: g.id }));
      box.appendChild(b);
    }
  }
  return box;
}

// ---- tooltips for gems everywhere else (inventory, ground labels) -------------------------------

itemInfoHooks.push({
  name: (it) => (isGem(it) ? gemDisplayName(it) : undefined),
  cls: (it) => (isSkillGem(it) ? "Skill Gem" : isSupportGem(it) ? "Support Gem" : isRough(it) ? "Crystal" : undefined),
  lines: (it) => (isGem(it) ? gemLines(it, S.attrs) : undefined),
});

// ---- loop -----------------------------------------------------------------------------------

function loop() {
  ensureDom();
  updateBar();
  if (panelOpen && panelIconVer !== skillIconVersion()) panelDirty = true; // painted icons finished loading
  if (panelOpen && panelDirty) buildPanel();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/** Dev / screenshots: current client view of the bar. */
export const skillDebug = { state: S, rgba };
