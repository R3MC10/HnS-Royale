// Client side of progression: the owner-only `prog` state, trial shrines, the XP bar / level badge,
// trial honour bar, level-up banner, and world effects (shrines, level-up rings, evade floats).
// Server logic: src/server/progression.ts.
import { tr } from "./i18n";
import { ASC_BY_ID } from "../shared/content/ascendancies";
import { ASCEND_LEVEL } from "../shared/content/classes";

const SHRINE_RANGE_HINT = 130; // server SHRINE_RANGE (110) + player radius
import type { ProgMsg, ShrineSnap } from "../shared/progression";
import type { GameEvent, PlayerSnap } from "../shared/protocol";
import { sfx } from "./audio/sfx";
import { el, ensureProgStyle } from "./progstyle";
import { getHudLayout, rectToCss } from "./hud/layout";
import { isHudHidden } from "./hud/dock";
import { selfAliveForHud } from "./skillbar";

export const progState: { msg: ProgMsg | null; shrines: ShrineSnap[] } = { msg: null, shrines: [] };
const subs = new Set<() => void>();
export function onProgChange(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
const fire = () => subs.forEach((f) => f());

let prevLv = 0;
let prevAscState = 0;
export function setProg(m: ProgMsg) {
  const prev = progState.msg;
  progState.msg = m;
  if (prev && m.ascState === 2 && prevAscState < 2) banner("Trial passed", "Open the passive tree (P) to ascend");
  prevLv = m.lv;
  prevAscState = m.ascState;
  fire();
  updateHud();
}
export function setShrines(list: ShrineSnap[]) {
  progState.shrines = list;
  fire();
}
export function resetProgClient() {
  progState.msg = null;
  progState.shrines = [];
  prevLv = 0;
  prevAscState = 0;
  fire();
  updateHud();
}
export const playSfx = (id: string) => {
  try {
    (sfx.play as (id: string) => unknown)(id);
  } catch {
    /* sound ids may not exist yet */
  }
};

// ---- HUD (DOM, smooth) ----------------------------------------------------------------------

let hud: HTMLDivElement | null = null;
let lvlEl: HTMLDivElement;
let fillEl: HTMLDivElement;
let barEl: HTMLDivElement;
let hon: HTMLDivElement;
let honFill: HTMLDivElement;
let bannerEl: HTMLDivElement;

function buildHud() {
  ensureProgStyle();
  hud = el("div", "pg-root");
  hud.id = "pg-hud";
  lvlEl = el("div", "lvl", "1");
  barEl = el("div", "bar");
  fillEl = el("div", "fill");
  barEl.append(fillEl, el("div", "ticks"));
  hud.append(barEl, lvlEl); // unspent points live on the canvas HUD now (no DOM pts text)
  hon = el("div", "pg-root");
  hon.id = "pg-hon";
  const hb = el("div", "bar");
  honFill = el("div", "fill");
  hb.append(honFill);
  hon.append(el("div", "h", "Honour"), hb);
  bannerEl = el("div", "pg-root");
  bannerEl.id = "pg-banner";
  document.body.append(hud, hon, bannerEl);
}

function updateHud() {
  if (!hud) return;
  const m = progState.msg;
  if (!m) return;
  lvlEl.textContent = `Lv ${m.lv}`;
  const pct = m.next > 0 ? Math.min(100, (m.xp / m.next) * 100) : 100;
  fillEl.style.width = `${pct.toFixed(1)}%`;
  // Hover readout: canvas hotspot over L.xpBar (hud/dock.ts xpTipLines), through the shared HUD tooltip.
  hon.style.display = m.hon != null ? "block" : "none";
  if (m.hon != null) honFill.style.width = `${Math.max(0, Math.min(100, m.hon))}%`;
}

/**
 * Per frame from main: show while in a match AND alive (it hides with the rest of the bottom band when
 * dead / spectating, or when the HUD is hidden), on the shared HUD layout's XP-bar rect
 * (panelTopCss is unused; kept for main.ts).
 */
export function layoutProgHud(visible: boolean, panelTopCss: number) {
  void panelTopCss;
  if (!hud) buildHud();
  const show = visible && !!progState.msg && selfAliveForHud() && !isHudHidden();
  hud!.style.display = show ? "block" : "none";
  if (!show) {
    hon.style.display = "none";
    return;
  }
  if (progState.msg && progState.msg.hon != null) hon.style.display = "block";
  const L = getHudLayout();
  const box = rectToCss(L, L.xpBar);
  const hpx = Math.max(5, Math.round(2 * L.u));
  hud!.style.setProperty("--lvsz", `${Math.max(10, Math.round(5 * L.u))}px`);
  hud!.style.left = `${Math.round(box.left)}px`;
  hud!.style.width = `${Math.round(box.width)}px`;
  hud!.style.bottom = `${Math.max(0, Math.round(box.bottom + box.height - hpx))}px`;
  hud!.style.height = `${hpx}px`;
}

let bannerMuted = false;
/** Round-end screen owns the middle of the screen: no "Level N" banner over the winner title. */
export function setProgBannerMuted(m: boolean) {
  if (m === bannerMuted) return;
  bannerMuted = m;
  if (m && bannerEl) bannerEl.classList.remove("show");
  if (m) bannerUntil = 0;
}

function banner(title: string, sub: string) {
  if (bannerMuted) return;
  if (!bannerEl) buildHud();
  bannerEl.innerHTML = "";
  bannerEl.append(el("div", "t", title), el("div", "s", sub));
  bannerEl.classList.remove("show");
  void bannerEl.offsetWidth;
  bannerEl.classList.add("show");
  bannerUntil = performance.now() + BANNER_MS;
}

const BANNER_MS = 2400; // progstyle.ts pg-banner animation length
let bannerUntil = 0;
/** CSS px box of the banner while it is on screen (render.ts keeps world labels out of it), else null. */
export function progBannerRect(topCss?: number): DOMRect | null {
  if (bannerMuted || !bannerEl || performance.now() > bannerUntil) return null;
  if (topCss !== undefined) {
    const t = `${Math.round(topCss)}px`;
    if (bannerEl.style.top !== t) bannerEl.style.top = t;
  }
  const r = bannerEl.getBoundingClientRect();
  return r.width > 0 ? r : null;
}

// ---- events / world effects -------------------------------------------------------------------

interface Fx {
  x: number;
  y: number;
  t: number;
  kind: "lvl" | "asc" | "evade" | "ward";
  id: number;
}
const fxs: Fx[] = [];

export function progEvents(events: GameEvent[], selfId: number) {
  for (const e of events) {
    if (e.k === "lvl") {
      fxs.push({ x: e.x, y: e.y, t: 0, kind: e.asc ? "asc" : "lvl", id: e.id });
      if (e.id === selfId) {
        if (e.asc) {
          banner("Ascended", ascName());
        } else {
          banner(`Level ${e.lv}`, "+1 passive point");
        }
      }
    } else if (e.k === "evade") {
      fxs.push({ x: e.x, y: e.y, t: 0, kind: e.cd ? "ward" : "evade", id: e.target });
    }
  }
}

function ascName(): string {
  const a = progState.msg?.asc;
  return a ? ASC_BY_ID.get(a)?.name ?? a : "";
}

let lastT = performance.now();
let shrineHintFor: { x: number; y: number } | null = null;

/** Renderer.worldFx: drawn above the darkness in world space. */
export function drawProgWorld(
  g: CanvasRenderingContext2D,
  to: (x: number, y: number) => { x: number; y: number },
  up: (px: number) => number,
  self: PlayerSnap | null,
) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  const time = now / 1000;
  shrineHintFor = null;
  // Trial shrines
  for (const s of progState.shrines) {
    const p = to(s.x, s.y);
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.2 + s.x);
    const col = s.s === 1 ? [255, 90, 60] : s.s === 2 ? [140, 130, 120] : [120, 180, 255];
    const rgba = (a: number) => `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    g.save();
    // ground rune circle
    g.translate(p.x, p.y);
    g.scale(1, 0.5);
    const R = up(46);
    const glow = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.5);
    glow.addColorStop(0, rgba(0.35 + 0.2 * pulse));
    glow.addColorStop(1, rgba(0));
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, R * 1.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba(0.75);
    g.lineWidth = Math.max(1, up(2));
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.stroke();
    g.rotate(time * (s.s === 1 ? 1.2 : 0.25));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78, Math.max(1, up(3)), 0, Math.PI * 2);
      g.fillStyle = rgba(0.9);
      g.fill();
    }
    g.restore();
    // standing stone with a glowing sigil
    const h = up(54);
    const w = up(16);
    g.save();
    g.translate(p.x, p.y);
    const stone = g.createLinearGradient(-w, -h, w, 0);
    stone.addColorStop(0, "#4a4650");
    stone.addColorStop(1, "#16141a");
    g.fillStyle = stone;
    g.beginPath();
    g.moveTo(-w, 0);
    g.lineTo(-w * 0.75, -h * 0.85);
    g.lineTo(0, -h);
    g.lineTo(w * 0.75, -h * 0.85);
    g.lineTo(w, 0);
    g.closePath();
    g.fill();
    g.shadowColor = rgba(1);
    g.shadowBlur = up(10);
    g.strokeStyle = rgba(0.7 + 0.3 * pulse);
    g.lineWidth = Math.max(1, up(2));
    g.beginPath();
    g.moveTo(0, -h * 0.75);
    g.lineTo(0, -h * 0.3);
    g.moveTo(-w * 0.4, -h * 0.6);
    g.lineTo(w * 0.4, -h * 0.45);
    g.stroke();
    g.restore();
    if (self && self.alive && s.s === 0 && Math.hypot(self.x - s.x, self.y - s.y) < SHRINE_RANGE_HINT) shrineHintFor = s;
  }
  if (shrineHintFor && self) {
    const m = progState.msg;
    const p = to(shrineHintFor.x, shrineHintFor.y);
    const ready = m && m.ascState === 1;
    const text = !m ? "" : m.ascState >= 2 ? "Trial already passed" : ready ? "F  Begin the Trial of Honour" : `Trial shrine (requires level ${ASCEND_LEVEL})`;
    // Drawn by render.ts in the HUD's prompt lane (just above the bottom band), not over the shrine:
    // there it sat on name plates, loot labels and the shrine's own Alt label.
    hintText = text ? { text, ready: !!ready } : null;
    void p;
  } else hintText = null;
  // Level-up / ascend rings and evade floats
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i];
    f.t += dt;
    const life = f.kind === "evade" ? 0.8 : f.kind === "ward" ? 1.0 : 1.6;
    if (f.t > life) {
      fxs.splice(i, 1);
      continue;
    }
    const k = f.t / life;
    const p = to(f.x, f.y);
    if (f.kind === "lvl" || f.kind === "asc") {
      const col = f.kind === "asc" ? "180,140,255" : "255,200,90";
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.5);
      for (const off of [0, 0.18]) {
        const kk = Math.max(0, k - off);
        g.strokeStyle = `rgba(${col},${(1 - kk) * 0.9})`;
        g.lineWidth = Math.max(1, up(4 * (1 - kk)));
        g.beginPath();
        g.arc(0, 0, up(16 + kk * 90), 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
      // soft column of light (a stretched radial glow; the old flat rectangle hid the hero behind a slab)
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 5);
      const beam = g.createRadialGradient(0, 0, 0, 0, 0, up(22));
      beam.addColorStop(0, `rgba(${col},${0.34 * (1 - k)})`);
      beam.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = beam;
      g.fillRect(-up(22), -up(22), up(44), up(22));
      g.restore();
    } else {
      g.globalAlpha = 1 - k;
      worldLabel(g, f.kind === "evade" ? "Evaded" : "Warded!", p.x, p.y - up(60 + k * 30), up(12), f.kind === "evade" ? "#cfe8ff" : "#ffd27a", true);
      g.globalAlpha = 1;
    }
  }
}

function worldLabel(g: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color: string, bare = false) {
  text = tr(text);
  g.save();
  g.font = `600 ${Math.max(9, px)}px "Cinzel", "Palatino Linotype", Georgia, serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (!bare) {
    const w = g.measureText(text).width + px * 1.4;
    g.fillStyle = "rgba(8,6,10,0.78)";
    g.strokeStyle = "rgba(216,179,106,0.5)";
    g.lineWidth = 1;
    roundRect(g, x - w / 2, y - px * 0.95, w, px * 1.9, px * 0.4);
    g.fill();
    g.stroke();
  }
  g.fillStyle = color;
  g.shadowColor = "#000";
  g.shadowBlur = 4;
  g.fillText(text, x, y);
  g.restore();
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

let hintText: { text: string; ready: boolean } | null = null;
/** Interaction prompt for the shrine the local player stands at, or null. */
export function shrineHint(): { text: string; ready: boolean } | null {
  return shrineHintFor ? hintText : null;
}

/** True when the local player stands at a dormant shrine (F starts the trial if no loot is under the cursor). */
export function atShrine(): boolean {
  return !!shrineHintFor;
}
