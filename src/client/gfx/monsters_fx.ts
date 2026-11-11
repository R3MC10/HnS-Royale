// Monster-side ground fx and labels: shaped telegraphs (cone / line / ring / pool), rarity
// nameplates with modifier names, ally auras + immunity bubbles, guarded buff shrines and the
// shrine-buff timer. render.ts passes a small drawing context (MonFx) into these.
import { ELITE_MOD_BY_ID, MONSTER_BY_ID } from "../../shared/content/monsters";
import { RARITY_INFO } from "../../shared/content/monsters/mods";
import { SHRINE_BY_ID } from "../../shared/content/monsters/shrines";
import type { HazardSnap, MonsterSnap } from "../../shared/protocol";
import { drawText } from "./font";
import { skinText, skinTextW } from "../hud/skin";

export interface MonFx {
  g: CanvasRenderingContext2D;
  time: number;
  sx(x: number, y: number): number;
  sy(x: number, y: number): number;
  up(px: number): number;
  ell(x: number, y: number, r: number, fill: string | null, stroke: string | null, dither?: boolean): void;
  bar(x: number, y: number, w: number, frac: number, color: string): void;
  onScreen(x: number, y: number, pad?: number): boolean;
}

// ---- shrine state (from the "bshrine" server message) ----
let shrineList: [number, number, number, string, 0 | 1][] = [];
let myBuff: { id: string; t: number; at: number } | null = null;
export function setBuffShrines(msg: { list: [number, number, number, string, 0 | 1][]; buff: { id: string; t: number } | null }) {
  shrineList = msg.list;
  myBuff = msg.buff ? { ...msg.buff, at: performance.now() } : null;
}

/** Ground polygon in world space (projected). */
function poly(fx: MonFx, pts: [number, number][], fill: string | null, stroke: string | null) {
  const { g } = fx;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(fx.sx(x, y), fx.sy(x, y)) : g.moveTo(fx.sx(x, y), fx.sy(x, y))));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = Math.max(1, fx.up(1));
    g.stroke();
  }
}

/** Shaped hazards. Returns true when handled (render skips its default circle). */
export function drawMonHazard(fx: MonFx, hz: HazardSnap): boolean {
  if (!hz.sh) return false;
  if (!fx.onScreen(hz.x, hz.y, hz.len ?? hz.r + 60)) return true;
  const g = fx.g;
  const hot = Math.floor(fx.time * 10) % 2 === 0 || hz.f > 0.8;
  if (hz.sh === "pool") {
    const c = hz.c ?? "rgba(110,160,40,0.45)";
    const wob = 1 + Math.sin(fx.time * 3 + hz.id) * 0.03;
    g.globalAlpha = 0.85;
    fx.ell(hz.x, hz.y, hz.r * wob, c, null, true);
    g.globalAlpha = 0.5;
    fx.ell(hz.x, hz.y, hz.r * 0.6 * wob, c, null);
    g.globalAlpha = 1;
    return true;
  }
  if (hz.sh === "ring") {
    g.globalAlpha = 0.25 + 0.35 * hz.f;
    fx.ell(hz.x, hz.y, hz.r, "rgba(255,60,30,0.35)", null, true);
    g.globalAlpha = 1;
    // expanding inner ring shows the timing
    fx.ell(hz.x, hz.y, Math.max(4, hz.r * hz.f), null, "rgba(255,150,80,0.9)");
    fx.ell(hz.x, hz.y, hz.r, null, hot ? "#ff5a3c" : "#b8301e");
    return true;
  }
  if (hz.sh === "cone") {
    const a = hz.a ?? 0;
    const arc = hz.arc ?? Math.PI / 2;
    const pts: [number, number][] = [[hz.x, hz.y]];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = a - arc / 2 + (arc * i) / n;
      pts.push([hz.x + Math.cos(t) * hz.r, hz.y + Math.sin(t) * hz.r]);
    }
    g.globalAlpha = 0.3 + 0.4 * hz.f;
    poly(fx, pts, "rgba(255,60,30,0.45)", null);
    g.globalAlpha = 1;
    const inner: [number, number][] = [[hz.x, hz.y]];
    for (let i = 0; i <= n; i++) {
      const t = a - arc / 2 + (arc * i) / n;
      inner.push([hz.x + Math.cos(t) * hz.r * hz.f, hz.y + Math.sin(t) * hz.r * hz.f]);
    }
    poly(fx, inner, "rgba(255,110,50,0.35)", null);
    poly(fx, pts, null, hot ? "#ff5a3c" : "#b8301e");
    return true;
  }
  if (hz.sh === "line") {
    const a = hz.a ?? 0;
    const L = hz.len ?? hz.r;
    const w = (hz.w ?? 40) / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rect = (len: number): [number, number][] => [
      [hz.x - s * w, hz.y + c * w],
      [hz.x + c * len - s * w, hz.y + s * len + c * w],
      [hz.x + c * len + s * w, hz.y + s * len - c * w],
      [hz.x + s * w, hz.y - c * w],
    ];
    g.globalAlpha = 0.3 + 0.4 * hz.f;
    poly(fx, rect(L), "rgba(255,60,30,0.45)", null);
    g.globalAlpha = 1;
    poly(fx, rect(L * hz.f), "rgba(255,110,50,0.35)", null);
    poly(fx, rect(L), null, hot ? "#ff5a3c" : "#b8301e");
    return true;
  }
  return false;
}

/** Ally auras, immunity bubbles and the rarity ground ring (drawn under the monster). */
export function drawMonAura(fx: MonFx, m: MonsterSnap) {
  if (!fx.onScreen(m.x, m.y, 280)) return;
  const g = fx.g;
  for (const id of m.e ?? []) {
    const md = ELITE_MOD_BY_ID.get(id);
    const au = md?.allyAura ?? md?.thirstAura;
    if (au) {
      g.globalAlpha = 0.5;
      fx.ell(m.x, m.y, au.radius, null, md!.color ?? "#ffb060");
      g.globalAlpha = 0.07;
      fx.ell(m.x, m.y, au.radius, md!.color ?? "#ffb060", null);
      g.globalAlpha = 1;
    }
  }
  if (m.bb) {
    const r = Math.abs(m.bb);
    const pulse = 0.5 + 0.2 * Math.sin(fx.time * 3);
    g.globalAlpha = pulse;
    fx.ell(m.x, m.y, r, null, m.bb > 0 ? "#d0f0ff" : "#ffd0ff");
    g.globalAlpha = m.bb > 0 ? 0.12 : 0.05;
    fx.ell(m.x, m.y, r, m.bb > 0 ? "#bfe8ff" : "#ffd0ff", null);
    g.globalAlpha = 1;
  }
  if (m.rr) {
    const c = RARITY_INFO[m.rr].color;
    g.globalAlpha = m.iv ? 0.9 : 0.55;
    fx.ell(m.x, m.y, m.r + 6, null, c);
    if (m.rr >= 2) fx.ell(m.x, m.y, m.r + 9, null, c);
    g.globalAlpha = 1;
  }
}

const title = (k: string) => MONSTER_BY_ID.get(k)?.boss?.title;

/** A placed nameplate box (HUD units), for de-overlapping plates drawn in the same frame. */
export interface PlateRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface MonLabelOpts {
  /** Hovered or recently-hit target: always gets a plate (even a normal monster) with its mods. */
  focus: boolean;
  /** Plates already placed this frame; this plate is stacked upward until it clears them. */
  plates: PlateRect[];
  /** False hides the modifier line (crowds: only the focused monster and the nearest rares keep it). */
  mods?: boolean;
  /** Only the life bar, no text (PoE2: the focused enemy's name is in the top bar; crowds keep a few names). */
  bare?: boolean;
  /** HUD-owned rects (top target / boss bar etc.): a text plate that would land in one is dropped (loop19). */
  hud?: PlateRect[];
  /** When given, the text is queued here and drawn after every monster's bar (a later bar no longer covers a name). */
  defer?: (() => void)[];
}
/** A plate pushed further up than this (HUD units) by a crowd is dropped; the monster keeps its bar. */
const MAX_PUSH = 22;

const NAME_SIZE = 5;
const MOD_SIZE = 4.1;
const TITLE_SIZE = 4;

/**
 * Rarity nameplate (smooth serif HUD text): name in rarity colour, mods below it (granted mod in
 * brackets), boss title above, plus the life bar. Normal monsters get a plate only when focused;
 * magic monsters show mods only when focused. Plates that would overlap earlier ones stack upward.
 * Returns true when it handled the monster (render.ts then skips its default bar).
 */
export function drawMonLabel(fx: MonFx, m: MonsterSnap, damaged: boolean, top: number, o?: MonLabelOpts): boolean {
  const focus = !!o?.focus;
  if (!m.rr && !m.gm && !focus) return false;
  const g = fx.g;
  const x = fx.sx(m.x, m.y);
  const y = fx.sy(m.x, m.y) - top;
  const def = MONSTER_BY_ID.get(m.k);
  const boss = !!def?.boss;
  const rr = m.rr ?? 0;
  const col = rr ? RARITY_INFO[rr].color : "#e8e2d4";
  const bw = boss ? Math.max(60, fx.up(m.r * 2)) : Math.max(16, fx.up(m.r * 1.3));
  const hasBar = damaged || rr >= 2 || focus;
  if (hasBar) fx.bar(x - Math.floor(bw / 2), y, bw, m.hp / m.mhp, rr === 3 ? "#d8873a" : rr === 2 ? "#e8a03a" : "#c8402e");
  if (o?.bare) {
    // Declutter: the bar only (name and mods are in the top target / boss bar, or crowded out).
    if (hasBar) o.plates.push({ x: x - bw / 2 - 1, y: y - 1.5, w: bw + 2, h: 5 });
    return true;
  }

  // Lines bottom-up: mods, name, boss title.
  const mods = (m.e ?? []).map((id) => ELITE_MOD_BY_ID.get(id)?.name ?? id);
  if (m.gm) mods.push(`(${ELITE_MOD_BY_ID.get(m.gm)?.name ?? m.gm})`);
  const showMods = mods.length > 0 && (focus || (rr >= 2 && o?.mods !== false));
  const name = rr && m.n ? m.n : def?.name ?? m.k;
  const btitle = boss ? title(m.k) : undefined;
  const lines: { s: string; size: number; face: "display" | "body"; color: string }[] = [];
  if (showMods) lines.push({ s: mods.join(" · "), size: MOD_SIZE, face: "body", color: "#b8b0e0" });
  lines.push({ s: name, size: NAME_SIZE + (rr >= 2 ? 0.4 : 0), face: "display", color: col });
  if (btitle) lines.push({ s: btitle, size: TITLE_SIZE, face: "body", color: "#a89878" });

  const GAP = 1.1;
  let w = 0;
  let h = 0;
  for (const l of lines) {
    w = Math.max(w, skinTextW(l.s, { size: l.size, face: l.face, maxW: 150 }));
    h += l.size + GAP;
  }
  // Stack upward past any plate already placed this frame.
  const rect: PlateRect = { x: x - w / 2 - 1, y: y - 2 - h, w: w + 2, h };
  const baseY = rect.y;
  if (o) {
    const hit = (r: PlateRect) => o.plates.some((p) => p.x < r.x + r.w && r.x < p.x + p.w && p.y < r.y + r.h && r.y < p.y + p.h);
    for (let i = 0; i < 8 && hit(rect); i++) {
      const blocker = o.plates.find((p) => p.x < rect.x + rect.w && rect.x < p.x + p.w && p.y < rect.y + rect.h && rect.y < p.y + p.h)!;
      rect.y = blocker.y - rect.h - 0.6;
    }
    // Its own life bar is an obstacle for later plates too (names used to land on other bars).
    if (hasBar) o.plates.push({ x: x - bw / 2 - 1, y: y - 1.5, w: bw + 2, h: 5 });
    // Crowded out (pushed far up, or still overlapping): lower-priority plates are dropped, bar stays.
    if (!focus && !boss && (baseY - rect.y > MAX_PUSH || hit(rect))) return true;
    // loop19: never tuck a plate under the top target / boss bar (it was clipped there): drop it, the bar stays.
    if (o.hud?.some((p) => p.x < rect.x + rect.w && rect.x < p.x + p.w && p.y < rect.y + rect.h && rect.y < p.y + p.h)) return true;
    o.plates.push(rect);
  }
  const text = () => {
    if (rect.y < baseY - 0.5) {
      // pushed up: a faint leader back to the monster's bar
      g.save();
      g.strokeStyle = "rgba(232,216,176,0.2)";
      g.lineWidth = 0.35;
      g.beginPath();
      g.moveTo(x, y - 1);
      g.lineTo(x, rect.y + rect.h);
      g.stroke();
      g.restore();
    }
    let ly = rect.y + rect.h;
    let nameY = ly;
    for (const l of lines) {
      ly -= l.size + GAP;
      if (l.s === name && l.face === "display") nameY = ly;
      skinText(g, l.s, x, ly, { size: l.size, face: l.face, align: "center", color: l.color, maxW: 150 });
    }
    if (boss && m.iv) skinText(g, "!", x + skinTextW(name, { size: NAME_SIZE, face: "display" }) / 2 + 2, nameY, { size: NAME_SIZE + 0.6, face: "display", color: "#ff5a3c" }); // immune
  };
  if (o?.defer) o.defer.push(text); // loop19: names over every bar
  else text();
  return true;
}

/** Shrines: glowing plinth + name (dim once used). Ground layer. */
export function drawBuffShrines(fx: MonFx) {
  const g = fx.g;
  for (const [, x, y, id, used] of shrineList) {
    if (!fx.onScreen(x, y, 80)) continue;
    const d = SHRINE_BY_ID.get(id);
    const c = d?.color ?? "#ffffff";
    const pulse = used ? 0.25 : 0.55 + 0.25 * Math.sin(fx.time * 2.5);
    g.globalAlpha = pulse * 0.35;
    fx.ell(x, y, 46, c, null, true);
    g.globalAlpha = pulse;
    fx.ell(x, y, 46, null, c);
    fx.ell(x, y, 28, null, c);
    g.globalAlpha = 1;
    // standing stone
    const sx = fx.sx(x, y);
    const sy = fx.sy(x, y);
    const h = fx.up(30);
    const w = fx.up(7);
    g.fillStyle = "#2a2622";
    g.fillRect(sx - w, sy - h, w * 2, h);
    g.fillStyle = "#4a443c";
    g.fillRect(sx - w, sy - h, w, h);
    g.fillStyle = used ? "#555" : c;
    g.globalAlpha = used ? 0.6 : 0.8 + 0.2 * Math.sin(fx.time * 4);
    g.fillRect(sx - fx.up(2), sy - h + fx.up(6), fx.up(4), fx.up(12));
    g.globalAlpha = 1;
  }
}

/** Shrine names (label pass). */
export function drawBuffShrineLabels(fx: MonFx) {
  for (const [, x, y, id, used] of shrineList) {
    if (!fx.onScreen(x, y, 80)) continue;
    const d = SHRINE_BY_ID.get(id);
    if (!d) continue;
    skinText(fx.g, used ? `${d.name} (spent)` : d.name, fx.sx(x, y), fx.sy(x, y) - fx.up(36), { size: 4.8, face: "display", align: "center", color: used ? "#7a7468" : d.color });
  }
}

/** The local player's shrine buff timer (top centre). */
export function drawBuffHud(fx: MonFx) {
  if (!myBuff) return;
  const d = SHRINE_BY_ID.get(myBuff.id);
  if (!d) return;
  const left = Math.max(0, myBuff.t - (performance.now() - myBuff.at) / 1000);
  if (left <= 0) return;
  const W = fx.g.canvas.width;
  drawText(fx.g, `${d.name}: ${d.desc}  ${Math.ceil(left)}s`, Math.floor(W / 2), fx.up(24), d.color, "center");
}
