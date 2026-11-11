// HUD belt (vitals package): flask slots, charm slots and the dodge cooldown bar (HUD-SPEC 2.1 C, D, E).
// Drawn with the skin kit: painted slots, glass flasks filled by charges, talisman charms (STYLE v2).
// Only the charm slots the belt grants are shown, packed right after the flasks (charmSlotRects).
import type { HudCtx, HudLayout, HudRect } from "./types";
import { actionLabel } from "../keybinds";
import { flaskProps, type Item } from "../../shared/items";
import { FLASK_BASE_BY_ID } from "../../shared/content/flasks";
import { charmSlotsFor, MAX_CHARM_SLOTS } from "../../shared/content/charms";
import { charmProps } from "../../shared/lootinfo";
import { FLASK_TRICKLE_DELAY, MAX_FLASK_SLOTS } from "../../shared/constants";
import { RARITY_COLORS } from "../../shared/content/loot";
import { drawSkinBar, drawSkinSlot, rgba, shade, SKIN, skinText, skinTextW } from "./skin";

const SLOT_EMPTY = "#3c3842";

// Local trackers.
const flaskMax: number[] = []; // max recovery seconds seen since it became > 0
const charmPrev = new Set<string>(); // charm buff ids active last frame
const charmFlash: number[] = []; // time until which slot i flashes white

/** Thin draining bar along the bottom edge. */
function drainBar(g: CanvasRenderingContext2D, r: HudRect, frac: number, color: string) {
  const f = Math.max(0, Math.min(1, frac));
  g.fillStyle = "rgba(0,0,0,0.8)";
  g.fillRect(r.x + 1.5, r.y + r.h - 2.8, r.w - 3, 1.4);
  g.fillStyle = color;
  g.fillRect(r.x + 1.5, r.y + r.h - 2.8, (r.w - 3) * f, 1.4);
}

const rarityColor = (it: Item) => RARITY_COLORS[it.r] ?? SLOT_EMPTY;
const keyOf = (id: string) => {
  const k = actionLabel(id);
  return k && k !== "-" ? k : "";
};

export function drawBelt(c: HudCtx): void {
  const me = c.v.self;
  if (!me || !me.alive) {
    charmPrev.clear();
    return;
  }
  // Whole belt strap as a tip-less hotspot (registered first so slot tips win): blocks world clicks.
  const f0 = c.L.flaskSlots[0];
  const cl = leftCluster(c);
  if (f0) c.hot({ x: f0.x - 3, y: f0.y - 2.5, w: cl.end - f0.x + 6, h: f0.h + 5 }, {});
  const f1 = c.L.flaskSlots[1];
  if (f1) c.hot({ x: f1.x - 2, y: f1.y - 2.5, w: f1.w + 4, h: f1.h + 5 }, {});
  drawFlasks(c);
  drawCharms(c);
  drawDodge(c);
}

// ---- C. flasks --------------------------------------------------------------------------------

/** Whole uses the current charges still pay for (what the slot number shows). */
const usesLeft = (charges: number, perUse: number) => (perUse > 0 ? Math.floor(charges / perUse) : 0);
/** Slot number text; capped so it can never spill out of the slot. */
const usesLabel = (n: number) => (n > 99 ? "99+" : String(Math.max(0, n)));

/** Per flask slot: usable last frame, and when it last turned usable again (refill flash). */
const flaskUsable: (boolean | undefined)[] = [];
const flaskGlint: number[] = [];
const FLASK_GLINT_S = 0.9;

function drawFlasks(c: HudCtx) {
  const { g, L, v } = c;
  const fl = c.s.me?.fl;
  for (let i = 0; i < MAX_FLASK_SLOTS; i++) {
    const r = L.flaskSlots[i];
    if (!r) continue;
    const key = keyOf("flask" + i);
    const rec = fl?.[i] ?? 0;
    if (rec > 0) flaskMax[i] = Math.max(flaskMax[i] ?? 0, rec);
    else flaskMax[i] = 0;

    // Skin kit (skin foundation): painted slot + glass flask; the charm slots follow in the vitals pass.
    const over = c.hot(r, {});
    if (i >= v.selfStats.flaskSlots) {
      if (i >= 2) continue; // the belt-granted third flask only shows once it is unlocked (PoE2 shows two)
      flaskNiche(g, r, false, false);
      drawSkinSlot(g, { x: r.x + 1.5, y: r.y + r.h - r.w - 1, w: r.w - 3, h: r.w - 3 }, { state: "locked" });
      c.hot(r, { tip: ["Locked flask slot", "A better belt opens more slots"] });
      continue;
    }
    const f = v.flasks[i] ?? null;
    if (!f) {
      flaskNiche(g, r, over, false);
      drawTallFlask(g, r, { frac: 0, color: "#3a3640", usable: false, time: c.time });
      if (key) keyTag(c, key, r, false);
      c.hot(r, { tip: ["Empty flask slot", ...(key ? [`Key: ${key}`] : [])] });
      continue;
    }
    const p = flaskProps(f, v.selfStats.flaskRecovery);
    const mana = FLASK_BASE_BY_ID.get(f.b)?.res === "mana";
    const ch = f.c ?? 0;
    const running = rec > 0;
    const usable = ch >= p.perUse;
    flaskNiche(g, r, over, running, rarityColor(f));
    drawTallFlask(g, r, {
      frac: p.maxCharges > 0 ? ch / p.maxCharges : 0,
      color: mana ? "#2c4cc0" : "#b02a22",
      usable,
      time: c.time,
    });
    // An empty flask that became usable again (the out-of-combat trickle, or a kill) flashes once,
    // so the refill is noticed without looking at the belt the whole time.
    if (usable && flaskUsable[i] === false && !running) flaskGlint[i] = c.time;
    flaskUsable[i] = usable;
    const gk = c.time - (flaskGlint[i] ?? -9);
    if (gk >= 0 && gk < FLASK_GLINT_S) {
      const a = 1 - gk / FLASK_GLINT_S;
      g.save();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = rgba(mana ? "#9ab4ff" : "#ffb090", 0.9 * a);
      g.lineWidth = 1.2 + 1.3 * a;
      g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      g.fillStyle = rgba(mana ? "#5a7cf0" : "#f05a40", 0.35 * a);
      g.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      g.restore();
    }
    if (running) {
      // soft inner glow in the liquid colour while recovery runs
      const liq = mana ? "#5a7cf0" : "#f05a40";
      const glowK = 0.75 + 0.25 * Math.sin(c.time * 4);
      g.save();
      const ig = g.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.6, 0, r.x + r.w / 2, r.y + r.h * 0.6, r.w * 0.8);
      ig.addColorStop(0, rgba(liq, 0.35 * glowK));
      ig.addColorStop(1, rgba(liq, 0));
      g.globalCompositeOperation = "lighter";
      g.fillStyle = ig;
      g.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      g.restore();
      const denom = Math.max(flaskMax[i] ?? 0, c.s.buffMax.get("flask" + i) ?? 0, rec);
      drainBar(g, { x: r.x, y: r.y, w: r.w, h: r.h - 4.4 }, rec / denom, "#fff4d8");
    }
    if (key) keyTag(c, key, r, true);
    const uses = usesLeft(ch, p.perUse);
    usesTag(c, usesLabel(uses), r, usable);
    c.hot(r, {
      tip: [
        f.n,
        `Uses left: ${usesLabel(uses)}`,
        `Charges ${Math.floor(ch)} / ${p.maxCharges} (${p.perUse} per use)`,
        ...(uses < 1 ? [`Refills to one use after ${FLASK_TRICKLE_DELAY} s without taking damage`] : []),
        ...(running ? [`Recovering: ${rec.toFixed(1)}s left`] : []),
        ...(key ? [`Key: ${key}`] : []),
      ],
    });
  }
}

// ---- D. charms --------------------------------------------------------------------------------

/** Charm slot rects for `open` usable slots, packed right after the left-hand flasks (only usable slots show). */
export function charmSlotRects(L: HudLayout, open: number, thirdFlask = false): HudRect[] {
  const proto = L.charmSlots[0];
  const f0 = L.flaskSlots[0];
  if (!proto || !f0) return [];
  const lastFlask = thirdFlask && L.flaskSlots[2] ? L.flaskSlots[2] : f0;
  const x0 = lastFlask.x + lastFlask.w + 4;
  const out: HudRect[] = [];
  for (let i = 0; i < Math.min(open, MAX_CHARM_SLOTS); i++) out.push({ x: x0 + i * (proto.w + 1.5), y: proto.y, w: proto.w, h: proto.h });
  return out;
}

/** The left bottom cluster as packed this frame: charm rects, the menu-button rect after them, and its right edge. */
export function leftCluster(c: HudCtx): { charms: HudRect[]; menu: HudRect; end: number; third: boolean } {
  const L = c.L;
  const third = (c.v.selfStats?.flaskSlots ?? 0) >= 3;
  const charms = charmSlotRects(L, openCharmSlots(c), third);
  const f0 = L.flaskSlots[0];
  const lastFlask = third && L.flaskSlots[2] ? L.flaskSlots[2] : f0;
  const lastX = charms.length ? charms[charms.length - 1].x + charms[charms.length - 1].w : lastFlask ? lastFlask.x + lastFlask.w : L.belt.x;
  const menu: HudRect = { x: lastX + 5, y: L.menuButtons.y, w: L.menuButtons.w, h: L.menuButtons.h };
  return { charms, menu, end: menu.x + menu.w, third };
}

// ---- tall flask (stands free in a shallow niche, by its globe) -----------------------------------

/** Shallow carved niche + iron foot behind a standing flask. */
function flaskNiche(g: CanvasRenderingContext2D, r: HudRect, hover: boolean, active: boolean, rarity?: string) {
  g.save();
  const lg = g.createLinearGradient(0, r.y, 0, r.y + r.h);
  lg.addColorStop(0, "rgba(8,7,8,0.25)");
  lg.addColorStop(0.35, "rgba(8,7,8,0.66)");
  lg.addColorStop(1, "rgba(4,4,5,0.92)");
  g.fillStyle = lg;
  g.beginPath();
  g.moveTo(r.x, r.y + r.h);
  g.lineTo(r.x, r.y + r.w * 0.55);
  g.quadraticCurveTo(r.x + r.w / 2, r.y - r.w * 0.3, r.x + r.w, r.y + r.w * 0.55);
  g.lineTo(r.x + r.w, r.y + r.h);
  g.closePath();
  g.fill();
  g.lineWidth = 0.4;
  g.strokeStyle = active ? "rgba(255,236,196,0.9)" : hover ? "rgba(214,184,128,0.8)" : rarity ? rgba(rarity, 0.5) : "rgba(120,108,90,0.45)";
  g.stroke();
  // iron foot
  const fy = r.y + r.h - 2.2;
  const fg = g.createLinearGradient(0, fy, 0, fy + 2.2);
  fg.addColorStop(0, "#5a544c");
  fg.addColorStop(0.35, "#2a2725");
  fg.addColorStop(1, "#0a0909");
  g.fillStyle = fg;
  g.fillRect(r.x - 0.6, fy, r.w + 1.2, 2.2);
  g.fillStyle = "rgba(0,0,0,0.9)";
  g.fillRect(r.x - 0.6, fy + 2.2, r.w + 1.2, 0.3);
  g.fillStyle = "rgba(200,176,130,0.35)";
  g.fillRect(r.x - 0.6, fy, r.w + 1.2, 0.25);
  g.restore();
}

/** A tall corked bottle filling r; the liquid level is the charge fraction. */
function drawTallFlask(g: CanvasRenderingContext2D, r: HudRect, o: { frac: number; color: string; usable: boolean; time: number }) {
  const cx = r.x + r.w / 2;
  const top = r.y + r.h * 0.17;
  const bot = r.y + r.h - 2.6;
  const bw = r.w * 0.4; // body half width
  const nw = r.w * 0.17; // neck half width
  const sh = top + (bot - top) * 0.3; // shoulder line
  const path = () => {
    g.beginPath();
    g.moveTo(cx - nw, top);
    g.lineTo(cx - nw, top + (sh - top) * 0.45);
    g.bezierCurveTo(cx - nw, sh - 0.6, cx - bw, sh - 1.2, cx - bw, sh + 2);
    g.lineTo(cx - bw, bot - 2.4);
    g.quadraticCurveTo(cx - bw, bot, cx - bw + 2.4, bot);
    g.lineTo(cx + bw - 2.4, bot);
    g.quadraticCurveTo(cx + bw, bot, cx + bw, bot - 2.4);
    g.lineTo(cx + bw, sh + 2);
    g.bezierCurveTo(cx + bw, sh - 1.2, cx + nw, sh - 0.6, cx + nw, top + (sh - top) * 0.45);
    g.lineTo(cx + nw, top);
    g.closePath();
  };
  g.save();
  g.imageSmoothingEnabled = true;
  if (!o.usable) g.globalAlpha *= 0.6;
  path();
  g.fillStyle = "rgba(10,11,14,0.88)";
  g.fill();
  const f = Math.max(0, Math.min(1, o.frac));
  if (f > 0) {
    g.save();
    path();
    g.clip();
    const lt = bot - (bot - (top + 1.2)) * f + 0.25 * Math.sin(o.time * 2.2 + r.x);
    const lg = g.createLinearGradient(cx - bw, 0, cx + bw, 0);
    lg.addColorStop(0, shade(o.color, 0.4));
    lg.addColorStop(0.38, shade(o.color, 1.2));
    lg.addColorStop(1, shade(o.color, 0.28));
    g.fillStyle = lg;
    g.fillRect(cx - bw - 1, lt, bw * 2 + 2, bot - lt + 1);
    const dg = g.createLinearGradient(0, lt, 0, bot);
    dg.addColorStop(0, "rgba(255,255,255,0.10)");
    dg.addColorStop(0.2, "rgba(0,0,0,0)");
    dg.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = dg;
    g.fillRect(cx - bw - 1, lt, bw * 2 + 2, bot - lt + 1);
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillRect(cx - bw - 1, lt, bw * 2 + 2, 0.3);
    g.restore();
  }
  // glass: edge, left highlight streak, right inner shadow
  path();
  g.lineWidth = 0.5;
  g.strokeStyle = "rgba(196,206,214,0.55)";
  g.stroke();
  g.save();
  path();
  g.clip();
  const hg = g.createLinearGradient(cx - bw, 0, cx + bw, 0);
  hg.addColorStop(0, "rgba(255,255,255,0)");
  hg.addColorStop(0.18, "rgba(255,255,255,0.3)");
  hg.addColorStop(0.3, "rgba(255,255,255,0)");
  hg.addColorStop(0.8, "rgba(0,0,0,0)");
  hg.addColorStop(1, "rgba(0,0,0,0.4)");
  g.fillStyle = hg;
  g.fillRect(cx - bw, sh, bw * 2, bot - sh);
  g.restore();
  // cork + iron collar
  const cg = g.createLinearGradient(cx - nw, 0, cx + nw, 0);
  cg.addColorStop(0, "#7a5a3a");
  cg.addColorStop(1, "#3a2816");
  g.fillStyle = cg;
  g.fillRect(cx - nw * 0.85, top - r.h * 0.085, nw * 1.7, r.h * 0.09);
  g.fillStyle = "#2c2a28";
  g.fillRect(cx - nw * 1.35, top - 0.2, nw * 2.7, 1);
  g.fillStyle = "rgba(210,190,150,0.4)";
  g.fillRect(cx - nw * 1.35, top - 0.2, nw * 2.7, 0.25);
  g.restore();
}

/** Key label: small plate centred on the flask foot. */
function keyTag(c: HudCtx, key: string, r: HudRect, lit: boolean) {
  const size = 4.6;
  const w = Math.max(5, skinTextW(key, { size, face: "body" }) + 2.4);
  const x = r.x + r.w / 2 - w / 2;
  const y = r.y + r.h - 4.6;
  c.g.fillStyle = "rgba(6,5,6,0.9)";
  c.g.fillRect(x, y, w, 5.4);
  c.g.fillStyle = "rgba(150,128,90,0.55)";
  c.g.fillRect(x, y, w, 0.25);
  skinText(c.g, key, r.x + r.w / 2, y + 0.5, { size, face: "body", align: "center", color: lit ? "#f0e2c4" : SKIN.inkFaint });
}

/** Uses left: the one number on a flask (user rule), on the bottle's body. */
function usesTag(c: HudCtx, label: string, r: HudRect, usable: boolean) {
  skinText(c.g, label, r.x + r.w / 2, r.y + r.h * 0.44, { size: 7.2, face: "display", align: "center", color: usable ? "#fff4e0" : "#9a9098" });
}

/** Usable charm slots for the local player right now (0..MAX_CHARM_SLOTS). */
export function openCharmSlots(c: HudCtx): number {
  const inv = c.s.inv;
  return inv ? charmSlotsFor(inv.equip) : 0;
}

/** Small talisman: a gem whose fill shows charges (gold), dimmed when a use is not affordable. */
function charmGem(g: CanvasRenderingContext2D, r: HudRect, frac: number, usable: boolean, time: number) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + 0.6;
  const hw = r.w * 0.28;
  const hh = r.h * 0.34;
  const path = () => {
    g.beginPath();
    g.moveTo(cx, cy - hh);
    g.lineTo(cx + hw, cy - hh * 0.15);
    g.lineTo(cx, cy + hh);
    g.lineTo(cx - hw, cy - hh * 0.15);
    g.closePath();
  };
  g.save();
  if (!usable) g.globalAlpha *= 0.55;
  // cord loop
  g.beginPath();
  g.arc(cx, cy - hh - 1.2, 1.1, 0, Math.PI * 2);
  g.lineWidth = 0.4;
  g.strokeStyle = "#8a7656";
  g.stroke();
  path();
  g.fillStyle = "rgba(12,10,8,0.85)";
  g.fill();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    g.save();
    path();
    g.clip();
    const top = cy + hh - 2 * hh * f;
    const lg = g.createLinearGradient(cx - hw, 0, cx + hw, 0);
    lg.addColorStop(0, shade("#c8a050", 0.5));
    lg.addColorStop(0.45, shade("#c8a050", 1.25 + 0.1 * Math.sin(time * 3)));
    lg.addColorStop(1, shade("#c8a050", 0.35));
    g.fillStyle = lg;
    g.fillRect(cx - hw, top, hw * 2, cy + hh - top);
    g.fillStyle = "rgba(255,240,200,0.5)";
    g.fillRect(cx - hw, top, hw * 2, 0.3);
    g.restore();
  }
  path();
  g.lineWidth = 0.45;
  g.strokeStyle = "rgba(220,200,160,0.6)";
  g.stroke();
  g.beginPath();
  g.moveTo(cx - hw * 0.45, cy - hh * 0.35);
  g.lineTo(cx, cy - hh * 0.8);
  g.strokeStyle = "rgba(255,255,255,0.45)";
  g.lineWidth = 0.35;
  g.stroke();
  g.restore();
}

function drawCharms(c: HudCtx) {
  const { g, L } = c;
  const inv = c.s.inv;
  const bf = c.s.me?.bf ?? [];
  const seen = new Set<string>();
  const rects = leftCluster(c).charms;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const key = keyOf("charm" + i);
    const over = c.hot(r, {});
    const it = inv?.charms?.[i] ?? null;
    if (!it) {
      drawSkinSlot(g, r, { state: over ? "hover" : "empty" });
      if (key) skinText(g, key, r.x + 1.2, r.y + 0.8, { size: 3.8, face: "body", color: SKIN.inkFaint });
      c.hot(r, { tip: ["Empty charm slot", ...(key ? [`Key: ${key}`] : [])] });
      continue;
    }
    const p = charmProps(it);
    const ch = it.c ?? 0;
    const usable = !p || ch >= p.cost;
    const buff = bf.find((b) => b.src === "charm" + it.id);
    if (buff) {
      seen.add(buff.id);
      if (!charmPrev.has(buff.id)) charmFlash[i] = c.time + 0.4;
    }
    const flashLeft = (charmFlash[i] ?? 0) - c.time;
    drawSkinSlot(g, r, { rarity: rarityColor(it), state: buff ? "active" : over ? "hover" : "normal", glow: "rgba(255,214,140,0.9)" });
    charmGem(g, r, p && p.maxCharges > 0 ? ch / p.maxCharges : 1, usable, c.time);
    if (buff) {
      const max = Math.max(c.s.buffMax.get(buff.id) ?? 0, buff.t);
      drainBar(g, r, max > 0 ? buff.t / max : 0, "#fff4d8");
    }
    if (flashLeft > 0) {
      // auto-fire flash: bright burst fading over 0.4s
      g.save();
      g.globalAlpha = Math.min(1, flashLeft / 0.4) * 0.8;
      const fg = g.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 0, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.75);
      fg.addColorStop(0, "rgba(255,250,235,1)");
      fg.addColorStop(1, "rgba(255,220,150,0)");
      g.fillStyle = fg;
      g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
      g.restore();
    }
    if (key) skinText(g, key, r.x + 1.2, r.y + 0.8, { size: 3.8, face: "body", color: "#d8ccb4" });
    const uses = p ? usesLeft(ch, p.cost) : Math.floor(ch);
    skinText(g, usesLabel(uses), r.x + r.w - 1.2, r.y + r.h - 5.6, { size: 5, face: "display", align: "right", color: usable ? "#f4ead8" : "#8a8088" });
    c.hot(r, {
      tip: [
        it.n,
        `Uses left: ${usesLabel(uses)}`,
        p ? `Charges ${Math.floor(ch)} / ${p.maxCharges} (${p.cost} per use)` : `Charges ${Math.floor(ch)}`,
        ...(buff ? [`Active: ${buff.t.toFixed(1)}s left`] : []),
        key ? `Fires on its own; ${key} fires it manually` : "Fires on its own",
      ],
    });
  }
  charmPrev.clear();
  for (const id of seen) charmPrev.add(id);
}

// ---- E. dodge cooldown ------------------------------------------------------------------------

function drawDodge(c: HudCtx) {
  const { g } = c;
  const r = c.L.dodge;
  const me = c.v.self!;
  const cd = Math.max(0.001, c.v.selfStats.dodgeCooldown);
  const frac = Math.max(0, Math.min(1, 1 - me.rollCd / cd));
  const ready = me.rollCd <= 0;
  drawSkinBar(g, r, { frac, color: ready ? "#5aa8cc" : "#2c5a74", glow: ready });
  c.hot({ x: r.x, y: r.y - 1, w: r.w, h: r.h + 2 }, {
    tip: [ready ? "Dodge ready" : `Dodge in ${me.rollCd.toFixed(1)}s`, `Key: ${actionLabel("dodge")}`],
  });
}
