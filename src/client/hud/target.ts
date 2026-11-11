// HUD status package (royale-owned look): top-centre target bar and persistent boss bar (spec 2.3 O, STYLE v2).
// Shows the hovered enemy (monster or other living player), else the last thing you hit within 4 s.
// A damaged boss gets a wider persistent block (carved end caps, phase notches, title); the hover
// target then draws below it. Life bars have a gradient fill and a damage trail (a lighter chunk that
// holds briefly after a hit, then drains). Names in the serif display face. All labels original.
import { laneBusy, laneClaim } from "./lanes";
import type { HudCtx } from "./types";
import type { MonsterSnap, PlayerSnap } from "../../shared/protocol";
import type { AilSnap } from "../../shared/ailments";
import { MONSTER_BY_ID, ELITE_MOD_BY_ID } from "../../shared/content/monsters";
import { activeChips, buildupChips, drawRow } from "./effects";
import { SKIN, drawSkinBarFrame, fillTexture, rivet, shade, skinText, skinTextW, stoneTexture } from "./skin";
import { getSettings } from "../settings";

const BAR_W = 150;
const BOSS_W = 220;
const LIFE_H = 5;
const BOSS_LIFE_H = 7;
const LAST_HIT_S = 4;
const PICK_DX = 12;
const PICK_DY = 24;
const TRAIL_HOLD = 0.45;
const TRAIL_RATE = 0.55; // fraction of the bar per second

const RARITY_COL = ["#e8e4dc", "#8a9cff", "#e8d060", "#d8873a"];

type Target = { kind: "m"; m: MonsterSnap } | { kind: "p"; p: PlayerSnap };

// ---- damage trail -------------------------------------------------------------------------------

const trails = new Map<string, { trail: number; last: number; hold: number; seen: number }>();

function trailFor(key: string, frac: number, time: number): number {
  let t = trails.get(key);
  if (!t) {
    t = { trail: frac, last: frac, hold: 0, seen: time };
    trails.set(key, t);
  }
  const dt = Math.max(0, Math.min(0.1, time - t.seen));
  t.seen = time;
  if (frac < t.last - 1e-4) t.hold = TRAIL_HOLD; // new damage: hold the trail where it was
  if (frac > t.trail) t.trail = frac; // healed past the trail
  if (t.hold > 0) t.hold -= dt;
  else t.trail = Math.max(frac, t.trail - TRAIL_RATE * dt);
  t.last = frac;
  if (trails.size > 64) {
    for (const [k, v] of trails) if (time - v.seen > 5) trails.delete(k);
  }
  return t.trail;
}

export function drawTarget(c: HudCtx): void {
  const v = c.v;
  if (!c.s.joined) return;
  if (getSettings().interface.targetBar === false) return;
  if (laneBusy("round")) return; // lanes: round banners (countdown, Fight!, round end) own the top-centre column
  const top = c.L.target.y;
  let y = top;
  const cx = c.L.target.x + c.L.target.w / 2;
  // lanes: world labels keep out of what was drawn here, toasts sit below it
  const claim = (wide: boolean) => {
    const w = (wide ? BOSS_W : BAR_W) + 40;
    laneClaim(wide ? "boss" : "target", { x: cx - w / 2 + w * 0.08, y: 0, w: w * 0.84, h: y + 1 });
  };

  // Boss bar: a damaged boss is shown without hover.
  const boss = pickBoss(c);
  if (boss) {
    y += drawBlock(c, { kind: "m", m: boss }, y, false, true);
    claim(true);
    y += 4;
  }

  if (!v.self?.alive) return;
  let hovered = true;
  let t = pickHover(c);
  if (!t) {
    hovered = false;
    t = lastHitTarget(c);
  }
  if (!t) return;
  if (boss && t.kind === "m" && t.m.id === boss.id) return; // already shown as the boss block
  y += drawBlock(c, t, y, hovered, false);
  claim(!!boss);
}

function pickBoss(c: HudCtx): MonsterSnap | null {
  let best: MonsterSnap | null = null;
  let bestD = Infinity;
  const sx = c.v.self?.x ?? 0;
  const sy = c.v.self?.y ?? 0;
  for (const m of c.v.monsters.values()) {
    if (!MONSTER_BY_ID.get(m.k)?.boss) continue;
    if (!(m.hp < m.mhp) || m.hp <= 0) continue;
    const d = (m.x - sx) ** 2 + (m.y - sy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

function pickHover(c: HudCtx): Target | null {
  const mx = c.mouse.x;
  const my = c.mouse.y;
  let best: Target | null = null;
  let bestD = Infinity;
  const consider = (wx: number, wy: number, t: Target) => {
    const p = c.toHud(wx, wy);
    const dx = p.x - mx;
    const dy = p.y - my; // the body sits above the feet point: cursor is 0..24u above it
    if (Math.abs(dx) > PICK_DX || dy < 0 || dy > PICK_DY) return;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  };
  for (const m of c.v.monsters.values()) if (m.hp > 0) consider(m.x, m.y, { kind: "m", m });
  for (const p of c.v.players.values()) {
    if (p.id === c.v.selfId || !p.alive) continue;
    consider(p.x, p.y, { kind: "p", p });
  }
  return best;
}

function lastHitTarget(c: HudCtx): Target | null {
  const lh = c.s.lastHit;
  if (!lh) return null;
  if (performance.now() / 1000 - lh.at >= LAST_HIT_S) return null;
  if (lh.m) {
    const m = c.v.monsters.get(lh.id);
    return m && m.hp > 0 ? { kind: "m", m } : null;
  }
  const p = c.v.players.get(lh.id);
  return p && p.alive && p.id !== c.v.selfId ? { kind: "p", p } : null;
}

/** Carved stone end cap beside a bar (boss block), pointing outward (dir -1 = left cap). */
function endCap(g: CanvasRenderingContext2D, x: number, y: number, h: number, dir: -1 | 1) {
  const w = 9;
  const x0 = dir === -1 ? x - w : x;
  g.save();
  g.beginPath();
  if (dir === -1) {
    g.moveTo(x, y - 2);
    g.lineTo(x0 + 3, y - 2);
    g.lineTo(x0, y + h / 2);
    g.lineTo(x0 + 3, y + h + 2);
    g.lineTo(x, y + h + 2);
  } else {
    g.moveTo(x, y - 2);
    g.lineTo(x0 + w - 3, y - 2);
    g.lineTo(x0 + w, y + h / 2);
    g.lineTo(x0 + w - 3, y + h + 2);
    g.lineTo(x, y + h + 2);
  }
  g.closePath();
  g.fillStyle = "#151311";
  g.fill();
  g.save();
  g.clip();
  fillTexture(g, stoneTexture("iron"), 0.9, x0, y);
  const lg = g.createLinearGradient(0, y - 2, 0, y + h + 2);
  lg.addColorStop(0, "rgba(255,235,200,0.14)");
  lg.addColorStop(1, "rgba(0,0,0,0.55)");
  g.fillStyle = lg;
  g.fillRect(x0, y - 2, w, h + 4);
  g.restore();
  g.lineWidth = 0.5;
  g.strokeStyle = "rgba(170,150,120,0.55)";
  g.stroke();
  rivet(g, x0 + w / 2 + dir * 0.6, y + h / 2, 1.1);
  g.restore();
}

/** Life bar: gradient fill, damage trail, optional ES overlay (top), phase notches. */
function lifeBar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, trail: number, esFrac: number, notches: number[], time: number) {
  const inner = drawSkinBarFrame(g, { x, y, w, h });
  const fw = inner.w * frac;
  const tw = inner.w * trail;
  if (tw > fw) {
    g.fillStyle = "rgba(240,200,160,0.55)";
    g.fillRect(inner.x + fw, inner.y, tw - fw, inner.h);
  }
  if (fw > 0) {
    const base = "#b0302a";
    const lg = g.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    lg.addColorStop(0, shade(base, 1.55));
    lg.addColorStop(0.45, base);
    lg.addColorStop(1, shade(base, 0.45));
    g.fillStyle = lg;
    g.fillRect(inner.x, inner.y, fw, inner.h);
    // slow sheen moving along the fill
    const sx = inner.x + ((time * 30) % Math.max(1, fw + 20)) - 10;
    const sg = g.createLinearGradient(sx - 8, 0, sx + 8, 0);
    sg.addColorStop(0, "rgba(255,220,200,0)");
    sg.addColorStop(0.5, "rgba(255,220,200,0.14)");
    sg.addColorStop(1, "rgba(255,220,200,0)");
    g.save();
    g.beginPath();
    g.rect(inner.x, inner.y, fw, inner.h);
    g.clip();
    g.fillStyle = sg;
    g.fillRect(sx - 8, inner.y, 16, inner.h);
    g.restore();
    g.fillStyle = "rgba(255,255,255,0.3)";
    g.fillRect(inner.x + fw - Math.min(0.4, fw), inner.y, Math.min(0.4, fw), inner.h);
  }
  if (esFrac > 0) {
    g.fillStyle = "rgba(168,212,240,0.85)";
    g.fillRect(inner.x, inner.y, inner.w * esFrac, Math.max(1, inner.h * 0.38));
  }
  for (const n of notches) {
    const nx = inner.x + inner.w * n;
    g.fillStyle = "rgba(0,0,0,0.8)";
    g.fillRect(nx - 0.4, inner.y - 1.2, 0.8, inner.h + 2.4);
    g.fillStyle = SKIN.gold;
    g.beginPath();
    g.moveTo(nx - 1.1, inner.y - 1.6);
    g.lineTo(nx + 1.1, inner.y - 1.6);
    g.lineTo(nx, inner.y + 0.2);
    g.closePath();
    g.fill();
  }
}

/** Soft dark backing (no hard rect) behind a block. */
function backing(g: CanvasRenderingContext2D, cx: number, y: number, w: number, h: number, a: number) {
  const lg = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  lg.addColorStop(0, "rgba(8,6,6,0)");
  lg.addColorStop(0.15, `rgba(8,6,6,${a})`);
  lg.addColorStop(0.85, `rgba(8,6,6,${a})`);
  lg.addColorStop(1, "rgba(8,6,6,0)");
  g.fillStyle = lg;
  g.fillRect(cx - w / 2, y, w, h);
}

/** Draws one target block starting at y; returns its height (u). */
function drawBlock(c: HudCtx, t: Target, y0: number, hovered: boolean, isBoss: boolean): number {
  const g = c.g;
  const r = c.L.target;
  const cx = r.x + r.w / 2;
  const W = isBoss ? BOSS_W : BAR_W;
  const LH = isBoss ? BOSS_LIFE_H : LIFE_H;
  const bx = cx - W / 2;

  // ---- gather ----
  let name: string;
  let nameCol: string;
  let hp: number;
  let max: number;
  let es = 0;
  let esm = 0;
  let st: AilSnap | undefined;
  let tag: string | null = null;
  let title: string | null = null;
  const notches: number[] = [];
  const mods: string[] = [];
  let key: string;
  if (t.kind === "m") {
    const m = t.m;
    const def = MONSTER_BY_ID.get(m.k);
    name = m.n ?? def?.name ?? m.k;
    nameCol = RARITY_COL[m.rr ?? 0] ?? RARITY_COL[0];
    hp = m.hp;
    max = m.mhp;
    st = m.st;
    key = "m" + m.id;
    if (m.iv) tag = "Invulnerable";
    for (const id of m.e ?? []) mods.push(ELITE_MOD_BY_ID.get(id)?.name ?? id);
    if (m.gm) mods.push(ELITE_MOD_BY_ID.get(m.gm)?.name ?? m.gm);
    if (isBoss && def?.boss) {
      title = def.boss.title;
      for (const ph of def.boss.phases) if (ph.below > 0 && ph.below < 1) notches.push(ph.below);
    }
  } else {
    const p = t.p;
    name = p.name;
    nameCol = p.color;
    hp = p.hp;
    max = p.maxHp;
    es = p.es ?? 0;
    esm = p.esm ?? 0;
    st = p.st;
    key = "p" + p.id;
  }
  const chips = [...activeChips(st), ...buildupChips(st, c.time)];
  const modLines = mods.slice(0, 4);
  const phase = isBoss && t.kind === "m" && t.m.ph !== undefined ? `Phase ${t.m.ph + 1}` : null;

  const nameSize = isBoss ? 9 : 7.5;
  const titleH = title ? 7 : 0;
  const ly = y0 + nameSize + 3 + titleH;
  const chipY = ly + LH + 4;
  const modY = chipY + (chips.length ? 13 : 0);
  const h = modY - y0 + modLines.length * 8 + (phase ? 8 : 0);

  // ---- backing ----
  backing(g, cx, y0 - 2, W + 40, h + 3, isBoss ? 0.62 : 0.5);

  // ---- row 1: name (+ level / tag), numbers on the right when hovered ----
  const lvl = t.kind === "p" && t.p.lv ? `  Lv ${t.p.lv}` : "";
  const nw = skinTextW(name, { size: nameSize, face: "display" });
  const lvw = lvl ? skinTextW(lvl, { size: 6.5 }) : 0;
  const tgw = tag ? skinTextW(tag, { size: 6 }) + 5 : 0;
  let nx = cx - (nw + lvw + tgw) / 2;
  nx += skinText(g, name, nx, y0, { size: nameSize, face: "display", color: nameCol });
  if (lvl) nx += skinText(g, lvl, nx, y0 + (nameSize - 6.5) * 0.7, { size: 6.5, color: "#b8b0a0" });
  if (tag) skinText(g, tag, nx + 5, y0 + (nameSize - 6) * 0.7, { size: 6, color: "#8a8680" });
  if (title) skinText(g, title, cx, y0 + nameSize + 1, { size: 5.5, align: "center", color: SKIN.inkDim, spacing: 0.1 });

  // ---- row 2: life bar (trail, ES overlay for players, boss phase notches) ----
  const lf = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const trail = trailFor(key, lf, c.time);
  const ef = esm > 0 ? Math.max(0, Math.min(1, es / esm)) : 0;
  if (isBoss) {
    endCap(g, bx - 1, ly, LH, -1);
    endCap(g, bx + W + 1, ly, LH, 1);
  }
  lifeBar(g, bx, ly, W, LH, lf, trail, ef, notches, c.time);
  if (hovered || isBoss) {
    const num = `${Math.max(0, Math.ceil(hp))} / ${Math.ceil(max)}`;
    skinText(g, num, cx, ly + (LH - 5) / 2 - 0.3, { size: 5, align: "center", color: "#f0e6d8" });
  }
  c.hot({ x: bx, y: ly, w: W, h: LH }, { tip: [name, `Life ${Math.max(0, Math.ceil(hp))} / ${Math.ceil(max)}`, ...(esm > 0 ? [`Shield ${Math.ceil(es)} / ${Math.ceil(esm)}`] : [])] });

  // ---- row 3: heavy stun bar (2u) ----
  const sy = ly + LH + 1;
  const stun = st?.m?.s ?? 0;
  const sw = W * 0.7;
  const sx = cx - sw / 2;
  g.fillStyle = "rgba(10,8,8,0.85)";
  g.fillRect(sx, sy, sw, 1.6);
  if (stun > 0) {
    const primed = !!st?.p && (st.p & 1) !== 0; // bit 0 = stun (AIL_KINDS order)
    const blink = primed && Math.floor(c.time * 8) % 2 === 0;
    g.fillStyle = primed ? (blink ? "#ff5040" : "#c02820") : "#e09040";
    g.fillRect(sx, sy, sw * Math.min(1, stun / 100), 1.6);
  }

  // ---- row 4: ailment chips ----
  if (chips.length) {
    const width = Math.min(chips.length * 12 - 2, W);
    drawRow(c, { x: cx - Math.floor(width / 2), y: chipY, w: W, h: 12 }, chips, true);
  }

  // ---- rows 5+: modifiers, boss phase ----
  let my = modY;
  for (const line of modLines) {
    skinText(g, line, cx, my, { size: 6, align: "center", color: "#a8a0e8" });
    my += 8;
  }
  if (phase) skinText(g, phase, cx, my, { size: 6, face: "display", align: "center", color: SKIN.ember });

  return h;
}

