// DOM UI: inventory / equipment panel (view in ./inventory.ts), item tooltips with quick compare
// (equipped item's own tooltip beside the hovered one), Alt advanced mod view, toasts.
import { gemTipIcon } from "./gfx/gemart";
import { RARITY_COLORS } from "../shared/content/loot";
import type { ItemBase, ModKey, Slot } from "../shared/content/types";
import type { GridEntry } from "../shared/grid";
import {
  baseLines,
  baseName,
  classLabel,
  compareStats,
  computeStats,
  defaultSlotFor,
  emptyEquipment,
  isFlask,
  modText,
  previewStats,
  type Equipment,
  type Item,
  type ItemMod,
} from "../shared/items";
import type { ClientMsg, InvMsg } from "../shared/protocol";
import { defaultStats, type Stats } from "../shared/stats";
import { BASE_BY_ID } from "../shared/content/bases";
import { AFFIX_BY_ID, MOD_LABELS, tierNumber, tierRange } from "../shared/content/affixes";
import { FLASK_AFFIX_BY_ID } from "../shared/content/flasks";
import { charmSlotsFor, isCharm } from "../shared/content/charms";
import { CURRENCY_BY_ID } from "../shared/content/currency";
import { keyText, lootBaseLines, lootColor, lootFooterLines } from "../shared/lootinfo";
import { CHARM_AFFIX_BY_ID } from "../shared/content/charms";
import { JEWEL_AFFIX_BY_ID } from "../shared/content/jewels";
import { RUNE_BY_ID, runeModFor, socketLimit } from "../shared/content/runes";
import { CORRUPT_IMPLICIT_BY_ID, itemAllTotals, specialModInfo } from "../shared/content/specialmods";
import { uniqueModLine } from "../shared/content/uniques";
import { FLASK_BASE_BY_ID } from "../shared/content/flasks";
import { SHIELD_BASE_BLOCK, localDefences, localWeapon, modLines } from "../shared/items";
import { InventoryView, attachSkinBackdrop, itemReqs, type TipAnchor } from "./inventory";
import { playSfx } from "./invsfx";
import { getSettings } from "./settings";

const SLOT_LABELS: Record<Slot, string> = {
  mainhand: "Main Hand",
  offhand: "Off-hand",
  helmet: "Helmet",
  body: "Body",
  gloves: "Gloves",
  boots: "Boots",
  amulet: "Amulet",
  ring1: "Left Ring",
  ring2: "Right Ring",
  belt: "Belt",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** "#rrggbb" -> "r,g,b" (falls back to a warm grey). */
function rgbTriplet(c: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return "200,190,170";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** isCharm is a type guard on Item; a plain boolean keeps `item` un-narrowed. */
const charmy = (it: Item): boolean => isCharm(it);
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const TIP_CSS = `
.itip { position: fixed; display: none; pointer-events: none; z-index: 62; left: 0; top: 0;
  background: #0b0908; box-shadow: 0 8px 28px rgba(0,0,0,0.75); border-radius: 2px; }
.itip-z { zoom: var(--hns-ui, 1); width: max-content; min-width: 210px; max-width: 330px; padding: 4px 0 9px;
  font: 13px/1.45 var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif); -webkit-font-smoothing: antialiased;
  color: #a89c88; text-align: center; }
.itip .tt-cap { font: 600 10px var(--font-title, "Cinzel", "Trajan Pro", Georgia, serif); letter-spacing: 0.24em; text-transform: uppercase;
  color: #8c7448; padding: 2px 0 3px; }
.itip .tt-head { margin: 0 4px; padding: 6px 14px 5px; border-radius: 2px;
  background: linear-gradient(180deg, rgba(var(--rc),0.34), rgba(var(--rc),0.12) 60%, rgba(var(--rc),0.04));
  box-shadow: inset 0 1px 0 rgba(255,240,210,0.14), inset 0 -1px 0 rgba(0,0,0,0.6), 0 1px 0 rgba(var(--rc),0.45); }
.itip .tt-name { font: 700 15px/1.25 var(--font-title, "Cinzel", "Trajan Pro", "Palatino Linotype", Georgia, serif); letter-spacing: 0.06em;
  color: rgb(var(--rc)); text-shadow: 0 1px 0 #000, 0 0 10px rgba(var(--rc),0.3); }
.itip .tt-base { font: 600 13px/1.3 var(--font-title, "Cinzel", "Trajan Pro", "Palatino Linotype", Georgia, serif); letter-spacing: 0.04em; color: rgb(var(--rc)); }
.itip .tt-blk { padding: 0 14px; }
.itip .tt-cls { color: #8a7f6c; font-size: 12px; margin-top: 5px; }
.itip .tt-sep { height: 1px; margin: 6px 12px; background: linear-gradient(90deg, transparent, rgba(var(--rc),0.5), transparent); }
.itip .v { color: #ece2cc; }
.itip .aug { color: #8ab4ff; }
.itip .no { color: #e2483a; }
.itip .tt-req { color: #8a7f6c; }
.itip .tt-ilvl { color: #8a7f6c; font-size: 12px; }
.itip .tt-sock { color: #c8b890; }
.itip .tt-imp, .itip .tt-mod { color: #8fa6ff; }
.itip .tt-rune { color: #b9cfe6; }
.itip .tt-adv { color: #6c6458; font-size: 11px; letter-spacing: 0.03em; margin-top: 3px; }
.itip .tt-adv:first-child { margin-top: 0; }
.itip .tt-rng { color: #6c6458; }
.itip .tt-corrupt { color: #d04030; }
.itip .tt-flav { color: #b08850; font-style: italic; }
.itip .tt-cmp-h { color: #a89c84; margin-bottom: 2px; }
.itip .good { color: #7fe08a; }
.itip .bad { color: #ff6a5a; }
.itip .tt-hint { margin-top: 7px; padding: 0 12px; color: #6c6458; font-size: 11px; }
/* shared #tooltip (skill bar, sockets, gems): smooth serif instead of the body's mono pixel face */
#tooltip { font-family: var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif); font-size: 13px;
  -webkit-font-smoothing: antialiased; font-smooth: auto; }
#tooltip .tt-name { font-family: var(--font-title, "Cinzel", "Trajan Pro", "Palatino Linotype", Georgia, serif); letter-spacing: 0.06em; }
`;

interface TipArgs {
  item: Item;
  x: number;
  y: number;
  compare: boolean;
  hint: string;
  anchor?: TipAnchor;
}

export class UI {
  equip: Equipment = emptyEquipment();
  inv: GridEntry[] = [];
  flasks: (Item | null)[] = [];
  charms: (Item | null)[] = [null, null, null];
  alt: { mainhand: Item | null; offhand: Item | null } = { mainhand: null, offhand: null };
  weaponSet = 0;
  stats: Stats = defaultStats();
  open = false;
  /** worldui: an inventory item is being dragged (its ghost is the cursor). */
  get holding(): boolean {
    return this.view?.dragging ?? false;
  }

  private panel: HTMLDivElement;
  /** Item tooltip + up to two "Equipped" compare tooltips (own elements; #tooltip stays the skill bar's). */
  private tips: HTMLDivElement[] = [];
  private toasts: HTMLDivElement;
  private view: InventoryView;
  private dirty = true;
  private last: TipArgs | null = null;
  private altDown = false;
  private ctrlDown = false;

  constructor(private send: (m: ClientMsg) => void) {
    this.panel = document.getElementById("inv-panel") as HTMLDivElement;
    this.toasts = document.getElementById("toasts") as HTMLDivElement;
    if (!document.getElementById("itip-css")) {
      const st = document.createElement("style");
      st.id = "itip-css";
      st.textContent = TIP_CSS;
      document.head.appendChild(st);
    }
    for (const id of ["itip", "itip-eq1", "itip-eq2"]) {
      const t = document.createElement("div");
      t.id = id;
      t.className = "itip";
      document.body.appendChild(t);
      this.tips.push(t);
    }
    this.panel.addEventListener("contextmenu", (e) => e.preventDefault());
    this.panel.addEventListener("mouseleave", () => this.hideTip());
    this.view = new InventoryView(this.panel, {
      send: (m) => this.send(m),
      showTip: (item, x, y, compare, hint, anchor) => this.showTip(item, x, y, compare, hint, anchor),
      hideTip: () => this.hideTip(),
      toast: (t) => this.toast(t),
      close: () => this.toggle(false),
    });
    // Alt (advanced mod view) and Ctrl (hold to compare) re-render the open tooltip.
    const mods = (e: KeyboardEvent) => {
      const a = e.altKey;
      const c = e.ctrlKey || e.metaKey;
      if (a === this.altDown && c === this.ctrlDown) return;
      this.altDown = a;
      this.ctrlDown = c;
      if (this.last && this.tips[0].style.display !== "none") {
        const l = this.last;
        this.showTip(l.item, l.x, l.y, l.compare, l.hint, l.anchor);
      }
    };
    window.addEventListener("keydown", mods);
    window.addEventListener("keyup", mods);
    window.addEventListener("blur", () => {
      this.altDown = this.ctrlDown = false;
    });
  }

  setInv(m: InvMsg) {
    this.equip = m.equip;
    this.inv = m.inv;
    this.flasks = m.flasks;
    this.charms = m.charms ?? [null, null, null];
    this.alt = m.alt ?? { mainhand: null, offhand: null };
    this.weaponSet = m.set ?? 0;
    this.dirty = true;
    if (this.open) this.build();
  }

  setStats(s: Stats) {
    this.stats = s;
    this.dirty = true;
    if (this.open) this.build();
  }

  /** Server refused a pickup for lack of grid room. */
  noRoom() {
    if (this.open) this.view.flashNoRoom();
  }

  toggle(force?: boolean) {
    const was = this.open;
    this.open = force ?? !this.open;
    if (was !== this.open) playSfx(this.open ? "ui.open" : "ui.close");
    this.panel.style.display = this.open ? "flex" : "none";
    if (!this.open) {
      this.hideTip();
      this.view.cancelDrag(); // a held item goes back where it came from
      this.view.cancelModes();
    }
    if (this.open && this.dirty) this.build();
  }

  toast(text: string) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 2200);
    while (this.toasts.children.length > 4) this.toasts.firstChild?.remove();
  }

  // ---- tooltip ----

  private compareBlock(item: Item, slot: Slot): string {
    const cur = computeStats(this.equip);
    const next = previewStats(this.equip, item, slot);
    const lines = compareStats(cur, next);
    const eq = this.equip[slot];
    const vs = eq
      ? `vs <span style="color:${RARITY_COLORS[eq.r]}">${esc(eq.n)}</span>`
      : `(${SLOT_LABELS[slot]} slot is empty)`;
    let html = `<div class="tt-sep"></div><div class="tt-blk"><div class="tt-cmp-h">${eq ? "If swapped" : "If equipped"} ${vs}:</div>`;
    html += lines.length
      ? lines.map((l) => `<div class="${l.good ? "good" : "bad"}">${l.diff > 0 ? "+" : ""}${l.diff} ${esc(l.label)}</div>`).join("")
      : `<div class="tt-cls">No stat change</div>`;
    return html + `</div>`;
  }

  /**
   * Advanced (Alt) header + roll range for one modifier, PoE2 style:
   * `{ Prefix Modifier "Name" (Tier: 1) — Tags }` above the line and the tier's roll range after it.
   * Data-driven: any affix table with tiers (gear, jewels) or a flat range (flasks, charms) shows up.
   */
  private advMod(m: ItemMod, base?: ItemBase): { head: string; range: string; range2?: string[] } {
    const rng = (min: number, max: number) => (max !== min ? ` <span class="tt-rng">(${fmt(min)}–${fmt(max)})</span>` : "");
    const kindName = (k: string) => (k === "prefix" ? "Prefix" : k === "suffix" ? "Suffix" : cap(k));
    const ga = AFFIX_BY_ID.get(m.a);
    if (ga) {
      // Gear affix: tier number (1 = best), its item level, mod group tags and the roll range
      // (two-handed weapons show their scaled range; hybrids show both ranges).
      const ti = Math.max(0, Math.min(ga.tiers.length - 1, m.t));
      const tier = ga.tiers[ti];
      const tr = tierRange(ga, ti, base);
      const tags = (ga.tags?.length ? ga.tags.join(", ") : modTags(ga.key)) + (ga.local ? (ga.tags?.length ? ", Local" : "Local") : "");
      return {
        head: `{ ${kindName(ga.kind)} Modifier${tier ? ` "${esc(tier.name)}"` : ""} (Tier: ${tierNumber(ga, ti)}${tier ? ` · ilvl ${tier.ilvl}` : ""})${tags ? ` — ${esc(tags)}` : ""} }`,
        range: tr ? rng(tr.min, tr.max) : "",
        range2: tr && tr.min2 !== undefined ? [rng(tr.min2, tr.max2!)] : undefined,
      };
    }
    const tiered = JEWEL_AFFIX_BY_ID.get(m.a);
    if (tiered) {
      const ti = Math.max(0, Math.min(tiered.tiers.length - 1, m.t));
      const tier = tiered.tiers[ti];
      const tierNo = tiered.tiers.length - ti; // tier 1 = best
      const tags = modTags(tiered.key);
      return {
        head: `{ ${kindName(tiered.kind)} Modifier${tier ? ` "${esc(tier.name)}"` : ""} (Tier: ${tierNo}${tier ? ` · ilvl ${tier.ilvl}` : ""})${tags ? ` — ${esc(tags)}` : ""} }`,
        range: tier ? rng(tier.min, tier.max) : "",
      };
    }
    const f = FLASK_AFFIX_BY_ID.get(m.a) ?? CHARM_AFFIX_BY_ID.get(m.a);
    if (f) return { head: `{ ${kindName(f.kind)} Modifier "${esc(f.name)}" }`, range: rng(f.min, f.max) };
    const x = CORRUPT_IMPLICIT_BY_ID.get(m.a);
    if (x) return { head: `{ Corrupted Implicit Modifier }`, range: rng(x.min, x.max) };
    const u = uniqueModLine(m.a);
    if (u) {
      const [, min, max] = u.u.mods[u.i];
      return { head: `{ Unique Modifier }`, range: rng(Math.min(min, max), Math.max(min, max)) };
    }
    return { head: `{ Modifier }`, range: "" };
  }

  /** Full tooltip HTML for an item (header band, properties, requirements, sockets, mods, footer). */
  private tipHtml(item: Item, opts: { caption?: string; compareHtml?: string; hint?: string } = {}): { html: string; rc: string } {
    const r = item.r as number;
    const color = lootColor(item) ?? (RARITY_COLORS as Record<number, string>)[r] ?? (r === 3 ? "#d8803a" : RARITY_COLORS[0]);
    const rc = rgbTriplet(color);
    const cur = CURRENCY_BY_ID.get(item.b);
    const b = BASE_BY_ID.get(item.b);
    const adv = this.altDown;
    let html = "";
    if (opts.caption) html += `<div class="tt-cap">${esc(opts.caption)}</div>`;
    // Header band: name (+ base on its own line for rare / unique).
    const gemIco = gemTipIcon(item);
    html += `<div class="tt-head">${gemIco}<div class="tt-name">${esc(item.n)}</div>`;
    if (r >= 2 && baseName(item) !== item.n) html += `<div class="tt-base">${esc(baseName(item))}</div>`;
    html += `${gemIco ? `<div class="tt-clr"></div>` : ""}</div>`;

    // Group 1 (PoE2 order): item class, quality, local properties with modified values in blue.
    const props: string[] = [`<div class="tt-cls">${esc(itemClassLine(item, !!cur))}</div>`];
    const implicits: string[] = [];
    const sockets: string[] = [];
    const runeLines: string[] = [];
    if (b) {
      for (const l of lootBaseLines(item)) {
        if (/^Quality:/.test(l)) props.push(`<div>Quality: <span class="aug">${esc(l.replace(/^Quality:\s*/, "").replace(/\s*\(.*\)$/, ""))}</span></div>`);
        else if (/^Sockets:/.test(l)) continue; // drawn from item.s below
        else implicits.push(`<div class="tt-imp">${esc(l)}</div>`);
      }
      props.push(...localPropLines(item));
      if (b.implicit)
        for (const [k, v] of Object.entries(b.implicit)) {
          const q = !b.weapon && item.q && (v as number) > 0 ? Math.round((v as number) * (1 + item.q / 100) * 10) / 10 : (v as number);
          const txt = esc(MOD_LABELS[k as ModKey].replace("{v}", fmt(q)));
          implicits.push(`${adv ? `<div class="tt-adv">{ Implicit Modifier }</div>` : ""}<div class="tt-imp">${q !== v ? `<span class="aug">${txt}</span>` : txt}</div>`);
        }
      // Rune sockets: socket glyphs with the item level, socketed rune bonuses in their own block.
      const lim = socketLimit(b);
      if (item.s?.length) {
        sockets.push(`<div class="tt-sock">Sockets: ${item.s.map((s) => (s ? "◆" : "◇")).join(" ")}</div>`);
        for (const rid of item.s) {
          const rn = rid ? RUNE_BY_ID.get(rid) : undefined;
          const rm = rn ? runeModFor(rn, b.cls) : null;
          if (rn && rm) runeLines.push(`${adv ? `<div class="tt-adv">{ Rune: ${esc(rn.name)} }</div>` : ""}<div class="tt-rune">${esc(keyText(rm[0], rm[1]))}</div>`);
        }
      } else if (lim > 0 && !item.x) sockets.push(`<div class="tt-ilvl">Sockets: none (up to ${lim})</div>`);
    } else {
      for (const l of baseLines(item)) props.push(`<div>${esc(l)}</div>`);
    }
    html += `<div class="tt-blk">${props.join("")}</div>`;
    const rq = itemReqs(item);
    if (rq.parts.length)
      html += `<div class="tt-sep"></div><div class="tt-blk"><div class="tt-req">Requires: ${rq.parts.map((p) => `<span class="${p.ok ? "v" : "no"}">${esc(p.label)}</span>`).join(", ")}</div></div>`;
    const lvl: string[] = [];
    if (!cur && item.l) lvl.push(`<div class="tt-ilvl">Item Level: <span class="v">${item.l}</span></div>`);
    lvl.push(...sockets);
    if (lvl.length) html += `<div class="tt-sep"></div><div class="tt-blk">${lvl.join("")}</div>`;

    // Then rune bonuses, implicits (incl. blighted ones), explicits and status / flavour, each behind a separator.
    const after: string[] = [];
    if (runeLines.length) after.push(runeLines.join(""));
    const modHtml = (m: ItemMod) => {
      const ls = modLines(m); // hybrid mods: one line per stat
      if (!adv) return ls.map((l) => `<div class="tt-mod">${esc(l)}</div>`).join("");
      const a = this.advMod(m, b);
      const r2 = a.range2 ?? [];
      return `<div class="tt-adv">${a.head}</div>` + ls.map((l, i) => `<div class="tt-mod">${esc(l)}${i === 0 ? a.range : r2[i - 1] ?? ""}</div>`).join("");
    };
    const impMods = item.m.filter((m) => specialModInfo(m.a)?.implicit);
    const expMods = item.m.filter((m) => !specialModInfo(m.a)?.implicit);
    for (const m of impMods) implicits.push(modHtml(m).replace(/class="tt-mod"/, 'class="tt-imp"'));
    if (implicits.length) after.push(implicits.join(""));
    if (expMods.length) after.push(expMods.map(modHtml).join(""));
    const foot = lootFooterLines(item);
    // PoE2: the red "Corrupted" (or other status) line first, then unique flavour text in its own block.
    const status = foot.filter((f) => f.cls !== "flavour");
    const flav = foot.filter((f) => f.cls === "flavour");
    if (status.length) after.push(status.map((f) => `<div class="tt-corrupt">${esc(f.text)}</div>`).join(""));
    if (flav.length) after.push(flav.map((f) => `<div class="tt-flav">${esc(f.text)}</div>`).join(""));
    for (const blk of after) html += `<div class="tt-sep"></div><div class="tt-blk">${blk}</div>`;
    if (opts.compareHtml) html += opts.compareHtml;
    if (opts.hint) html += `<div class="tt-hint">${esc(opts.hint)}</div>`;
    return { html, rc };
  }

  private fill(el: HTMLDivElement, html: string, rc: string) {
    el.innerHTML = `<div class="itip-z">${html}</div>`;
    el.style.setProperty("--rc", rc);
    el.style.display = "block";
    attachSkinBackdrop(el, "tooltip");
  }

  /** Equipped items to compare the hovered item against (both rings for rings, the active weapon set). */
  private equippedFor(item: Item): { slot: Slot; it: Item }[] {
    if (isFlask(item) || charmy(item) || !BASE_BY_ID.has(item.b)) return [];
    const slot = defaultSlotFor(item, this.equip);
    if (!slot) return [];
    const slots: Slot[] = slot === "ring1" || slot === "ring2" ? ["ring1", "ring2"] : [slot];
    const out: { slot: Slot; it: Item }[] = [];
    for (const s of slots) {
      const it = this.equip[s];
      if (it && it.id !== item.id) out.push({ slot: s, it });
    }
    return out;
  }

  /**
   * Tooltip for an item. `compare` allows quick compare: the equipped item(s) of that slot open beside
   * it (always with the "Tooltip compare" option on, or while Ctrl is held) plus a stat delta block.
   * `anchor` is the hovered cell / label rect: the tip sits beside it instead of under the cursor.
   */
  showTip(item: Item, x: number, y: number, compare: boolean, hint = "", anchor?: TipAnchor) {
    this.last = { item, x, y, compare, hint, anchor };
    const setting = getSettings().interface.tooltipCompare;
    const eqs = compare ? this.equippedFor(item) : [];
    const showCmp = compare && (setting || this.ctrlDown);
    let compareHtml = "";
    if (showCmp && !isFlask(item) && !charmy(item) && BASE_BY_ID.has(item.b)) {
      const slot = defaultSlotFor(item, this.equip);
      if (slot === "ring1" || slot === "ring2") {
        if (this.equip.ring1 && this.equip.ring2) compareHtml = this.compareBlock(item, "ring1") + this.compareBlock(item, "ring2");
        else compareHtml = this.compareBlock(item, slot);
      } else if (slot) compareHtml = this.compareBlock(item, slot);
    }
    let h = hint;
    if (!showCmp && eqs.length) h = (h ? h + " · " : "") + "Hold Ctrl: compare";
    if (!this.altDown && item.m.length) h = (h ? h + " · " : "") + "Hold Alt: modifier details";
    const main = this.tipHtml(item, { compareHtml, hint: h });
    const [t0, t1, t2] = this.tips;
    this.fill(t0, main.html, main.rc);

    // Placement: beside the anchor (to its left when the right side has no room), else by the cursor.
    const A: TipAnchor = anchor ?? { left: x - 14, right: x + 14, top: y + 14, bottom: y + 14 };
    const W = window.innerWidth;
    const H = window.innerHeight;
    const r0 = t0.getBoundingClientRect();
    let lx = A.right + 8;
    if (A.right + 16 + r0.width > W) lx = A.left - r0.width - 8;
    // polish: hovering inside the open inventory panel -> the tip sits beside the whole panel (PoE2:
    // left of the right-docked inventory) so it never covers the paper doll / grid.
    const pr = this.invPanelRect();
    if (pr && anchor) {
      const ax = (A.left + A.right) / 2;
      const ay = (A.top + A.bottom) / 2;
      if (ax >= pr.left && ax <= pr.right && ay >= pr.top && ay <= pr.bottom) {
        if (pr.left - r0.width - 10 >= 8) lx = pr.left - r0.width - 10;
        else if (pr.right + 10 + r0.width <= W - 8) lx = pr.right + 10;
      }
    }
    lx = Math.max(8, Math.min(W - r0.width - 8, lx));
    let ty = A.top;
    if (!anchor && ty + r0.height > H - 8) ty = y - r0.height - 12; // ground label: above the cursor
    ty = Math.max(8, Math.min(H - r0.height - 8, ty));
    t0.style.left = lx + "px";
    t0.style.top = ty + "px";

    // Equipped compare tooltips, on the screen-centre side of the main tip.
    const shown = showCmp ? eqs : [];
    const towardLeft = lx + r0.width / 2 > W / 2;
    let cx = towardLeft ? lx - 8 : lx + r0.width + 8;
    let cy = ty;
    [t1, t2].forEach((t, i) => {
      const e = shown[i];
      if (!e) {
        t.style.display = "none";
        return;
      }
      const caption = shown.length > 1 ? `Equipped · ${SLOT_LABELS[e.slot]}` : "Equipped";
      const c = this.tipHtml(e.it, { caption });
      this.fill(t, c.html, c.rc);
      const rr = t.getBoundingClientRect();
      // Second ring: below the first if it fits, else one column further out.
      if (i === 1 && cy + rr.height > H - 8) {
        const prev = t1.getBoundingClientRect();
        cy = ty;
        cx = towardLeft ? prev.left - 8 : prev.right + 8;
      }
      let left = towardLeft ? cx - rr.width : cx;
      if (left < 8 || left + rr.width > W - 8) {
        // No room on the centre side: try the other side of the main tip.
        const other = towardLeft ? lx + r0.width + 8 : lx - rr.width - 8;
        left = other >= 8 && other + rr.width <= W - 8 ? other : Math.max(8, Math.min(W - rr.width - 8, left));
      }
      const top = Math.max(8, Math.min(H - rr.height - 8, cy));
      t.style.left = left + "px";
      t.style.top = top + "px";
      cy = top + rr.height + 6;
    });
  }

  /** polish: on-screen rect of the open inventory panel, or null when it is closed. */
  private invPanelRect(): DOMRect | null {
    const el = document.getElementById("inv-panel");
    if (!el || getComputedStyle(el).display === "none") return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  }

  hideTip() {
    for (const t of this.tips) t.style.display = "none";
  }

  // ---- panel ----

  private build() {
    this.dirty = false;
    this.view.build({ equip: this.equip, inv: this.inv, flasks: this.flasks, charms: this.charms, charmSlots: charmSlotsFor(this.equip), alt: this.alt, set: this.weaponSet, stats: this.stats });
  }
}

/** Short original tag list for an affix stat key (advanced view). */
function modTags(key: string): string {
  const k = key.toLowerCase();
  const t: string[] = [];
  if (k.startsWith("res")) t.push("Elemental", "Resistance");
  if (k.includes("life") || k === "regen") t.push("Life");
  if (k.includes("mana")) t.push("Mana");
  if (k.includes("dmg") || k.includes("atk") || k === "reach" || k.startsWith("kb")) t.push("Attack");
  if (k.includes("spell")) t.push("Caster");
  if (k.includes("armour") || k.includes("evasion") || k.startsWith("es") || k === "block") t.push("Defences");
  if (k.includes("flask")) t.push("Flask");
  if (k.includes("move") || k.includes("dodge") || k.includes("speed")) t.push("Speed");
  if (k.includes("spirit")) t.push("Spirit");
  return [...new Set(t)].join(", ");
}

// ---- PoE2 tooltip helpers --------------------------------------------------------------------

const WEAPON_CLASS: Record<string, string> = {
  bow: "Bow", crossbow: "Crossbow", quarterstaff: "Quarterstaff", staff: "Staff", wand: "Wand", sceptre: "Sceptre",
};
const ARMOUR_CLASS: Record<string, string> = {
  helmet: "Helmet", body: "Body Armour", gloves: "Gloves", boots: "Boots", amulet: "Amulet", ring: "Ring", belt: "Belt",
};

/** PoE2 item class line ("Two Hand Axe", "Body Armour", "Shield", "Stackable Currency"). */
function itemClassLine(item: Item, currency: boolean): string {
  if (currency) return "Stackable Currency";
  const b = BASE_BY_ID.get(item.b);
  if (b?.weapon) {
    const k = b.weapon.kind;
    return WEAPON_CLASS[k] ?? `${b.weapon.twoHand ? "Two Hand" : "One Hand"} ${cap(k)}`;
  }
  if (b?.cls === "offhand") return b.sub ? cap(b.sub) : "Off-hand";
  if (b) return ARMOUR_CLASS[b.cls] ?? cap(b.cls);
  const fb = FLASK_BASE_BY_ID.get(item.b);
  if (fb) return fb.res === "mana" ? "Mana Flask" : "Life Flask";
  return cap(classLabel(item));
}

/**
 * Weapon / armour properties with this item's own quality, mods and runes folded in (PoE2 local
 * properties): a value that differs from the base is drawn in blue. Data-driven through
 * itemAllTotals, so new mod sources (runes, uniques, blighted implicits) change these automatically.
 */
function localPropLines(item: Item): string[] {
  const b = BASE_BY_ID.get(item.b);
  if (!b) return [];
  const t = itemAllTotals(item) as Partial<Record<string, number>>;
  const g = (k: string) => t[k] ?? 0;
  const q = 1 + (item.q ?? 0) / 100;
  const out: string[] = [];
  const line = (label: string, base: number, val: number, unit = "", dec = 0) => {
    const p = Math.pow(10, dec);
    const show = (n: number) => (dec ? (Math.round(n * p) / p).toFixed(dec) : String(Math.round(n)));
    const mod = Math.abs(val - base) > 1e-6 && show(val) !== show(base);
    out.push(`<div>${label}: <span class="${mod ? "aug" : "v"}">${show(val)}${unit}</span></div>`);
  };
  if (b.weapon) {
    const w = b.weapon;
    const lw = localWeapon(item, w); // local flat / % physical (+ quality), local attack speed and crit
    const dmg = (lw.damage + g("dmgFlat")) * (1 + g("dmgInc") / 100);
    if (w.phys) {
      // PoE2 "Physical Damage: min-max", scaled by this item's local damage (quality, flat, %).
      const k = w.damage > 0 ? dmg / w.damage : 1;
      const lo = Math.round(w.phys[0] * k), hi = Math.round(w.phys[1] * k);
      const mod = lo !== Math.round(w.phys[0]) || hi !== Math.round(w.phys[1]);
      out.push(`<div>Physical Damage: <span class="${mod ? "aug" : "v"}">${lo}-${hi}</span></div>`);
    } else line("Damage", w.damage, dmg, "", 1);
    if (w.crit !== undefined || lw.critAdd) line("Critical Hit Chance", w.crit ?? 5, (w.crit ?? 5) + lw.critAdd, "%", 1);
    line("Attacks per Second", 1 / w.cooldown, (1 / lw.cooldown) * (1 + g("atkSpeedInc") / 100), "", 2);
    if (w.reload) out.push(`<div>Reload Time: <span class="v">${w.reload.toFixed(2)}s</span></div>`);
    line("Reach", w.range, w.range + g("reach"));
    line("Arc", w.arcDeg, w.arcDeg * (1 + g("arcInc") / 100), "°");
    return out;
  }
  const ld = localDefences(item); // base + local flat, x (local % + quality)
  if (b.cls === "offhand" && b.sub === "shield") {
    const blk = b.block ?? SHIELD_BASE_BLOCK;
    line("Chance to Block", blk, ld.block + g("block"), "%");
  } else if (b.block) line("Chance to Block", b.block, b.block + g("block"), "%");
  const def = (label: string, base: number, local: number, flat: string, inc: string) => {
    const v = (local + g(flat)) * (1 + g(inc) / 100);
    if (base > 0 || v > 0.5) line(label, base, v);
  };
  def("Armour", b.armour ?? 0, ld.armour, "armour", "armourInc");
  def("Evasion Rating", b.evasion ?? 0, ld.evasion, "evasion", "evasionInc");
  def("Energy Shield", b.barrier ?? 0, ld.barrier, "es", "esInc"); // same name as its mods ("% increased Energy Shield")
  if (b.flaskSlots) out.push(`<div>Flask Slots: <span class="v">${b.flaskSlots}</span></div>`);
  if (b.charmSlots) out.push(`<div>Charm Slots: <span class="v">${b.charmSlots}</span></div>`);
  return out;
}

