// HUD vitals (vitals package): life/ES/barrier globe, mana globe + spirit, self heavy-stun meter,
// weapon-set tabs, unspent point indicator, and the low-life vignette (HUD-SPEC 2.1 A, B, F, G, H, I).
// Everything is drawn with the skin kit (./skin): smooth, painted at native resolution (STYLE v2).
import type { HudCircle, HudCtx, HudRect } from "./types";
import { actionLabel } from "../keybinds";
import { getSettings } from "../settings";
import { toggleTree } from "../tree";
import { isPrimedSnap, meterOf } from "../../shared/ailments";
import { drawSkinBar, drawSkinButton, drawSkinGlobe, drawSkinGlobeHolder, drawSkinLabel, globeRimWidth, rgba, SKIN, skinText, skinTextW } from "./skin";
import { flaskProps } from "../../shared/items";
import { FLASK_BASE_BY_ID } from "../../shared/content/flasks";

const LOW_LIFE = 0.35;

// ---- shared drawing helpers ---------------------------------------------------------------

function circleRect(o: HudCircle, pad = 0): HudRect {
  return { x: o.cx - o.r - pad, y: o.cy - o.r - pad, w: (o.r + pad) * 2, h: (o.r + pad) * 2 };
}

function ring(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, width: number, a0 = 0, a1 = Math.PI * 2) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.arc(cx, cy, r, a0, a1);
  g.stroke();
}

const n0 = (x: number) => Math.max(0, Math.round(x));

// ---- G. low-life vignette -------------------------------------------------------------------

/** Heartbeat hook: called once per vignette pulse peak while below the low-life threshold (audio wires in here). */
const beatSubs = new Set<() => void>();
export function onLowLifeBeat(fn: () => void): () => void {
  beatSubs.add(fn);
  return () => {
    beatSubs.delete(fn);
  };
}
let lastBeat = -1;

export function drawVignette(c: HudCtx): void {
  const me = c.v.self;
  if (!me || !me.alive || !(me.maxHp > 1) || me.hp / me.maxHp >= LOW_LIFE) {
    lastBeat = -1;
    return;
  }
  const { g, L } = c;
  const w = c.time * 6;
  const pulse = 0.6 + 0.4 * Math.sin(w);
  // beat at each sine peak (phase pi/2 + 2k*pi)
  const beat = Math.floor((w - Math.PI / 2) / (Math.PI * 2));
  if (lastBeat !== -1 && beat !== lastBeat)
    for (const fn of [...beatSubs]) {
      try {
        fn();
      } catch (e) {
        console.error("low-life beat hook failed", e);
      }
    }
  lastBeat = beat;
  // One soft radial gradient: unit circle stretched to the screen aspect (corners sit at r = sqrt 2).
  const depth = 1 - Math.max(0, me.hp) / (me.maxHp * LOW_LIFE); // 0 at the threshold -> 1 at 0 life
  const a = (0.3 + 0.2 * depth) * pulse;
  g.save();
  g.translate(L.w / 2, L.h / 2);
  g.scale(L.w / 2, L.h / 2);
  const rg = g.createRadialGradient(0, 0, 0.55 - 0.1 * depth, 0, 0, Math.SQRT2);
  rg.addColorStop(0, "rgba(140,10,10,0)");
  rg.addColorStop(0.45, `rgba(140,10,10,${(a * 0.45).toFixed(3)})`);
  rg.addColorStop(1, `rgba(120,6,6,${Math.min(0.75, a * 1.4).toFixed(3)})`);
  g.fillStyle = rg;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
}

// ---- main entry -----------------------------------------------------------------------------

let lastSet = -1;
let setFlashUntil = 0;

export function drawVitals(c: HudCtx): void {
  const me = c.v.self;
  if (!me || !me.alive) {
    lastSet = -1;
    return;
  }
  drawLife(c);
  drawMana(c);
  drawSelfStun(c);
  // Weapon-set tabs and the unspent-points marker moved to the bar package (hud/dock.ts drawBarHud:
  // tabs on the centred skill strip, points as a pulse + "+N" on the passive-tree menu button).
  void drawWeaponSet;
  void drawPoints;
}

// ---- A. life globe + ES + barrier -----------------------------------------------------------

function drawLife(c: HudCtx) {
  const { g, L } = c;
  const me = c.v.self!;
  const o = L.lifeGlobe;
  const hp = n0(me.hp);
  const maxHp = n0(me.maxHp);
  const es = n0(me.es ?? 0);
  const esm = n0(me.esm ?? 0);
  const bar = n0(c.s.prog?.bar ?? 0);
  const esOnly = esm > 0 && maxHp <= 1;
  const lifeFrac = maxHp > 0 ? hp / maxHp : 0;
  const low = !esOnly && lifeFrac < LOW_LIFE;

  const hovered = c.hot(circleRect(o, 4), {
    tip: [
      ...(esOnly ? [] : [`Life ${hp} / ${maxHp}`]),
      ...(esm > 0 ? [`Shield ${es} / ${esm}`] : []),
      ...(bar > 0 ? [`Barrier ${bar}`] : []),
    ],
  });

  // Skin kit (skin foundation): carved holder, liquid globe with an ES overlay layer, glass and iron rim.
  const rim = globeRimWidth(o.r);
  drawSkinGlobeHolder(g, o, "left");
  const pulse = low ? 0.5 + 0.5 * Math.sin(c.time * Math.PI * 4) : 0; // 2 Hz
  drawSkinGlobe(g, o, {
    kind: "life",
    frac: esOnly ? 0 : lifeFrac,
    color: low ? SKIN.lifeLow : SKIN.life,
    // ES tints the liquid only when there is no life pool; otherwise a full shield (even 3 points) washed
    // the whole red fill pale. With life, ES is the blue ring + number only.
    overlay: esOnly ? { frac: es / esm, color: SKIN.es } : null,
    time: c.time,
    pulse,
  });
  if (!esOnly && maxHp > 0) {
    const inc = incomingRecovery(c, "life");
    if (inc > 0) drawIncoming(g, o, lifeFrac, Math.min(1, (me.hp + inc) / me.maxHp), "#ff8a70", c.time);
  }

  // ES ring: arc from the bottom, growing both ways (just outside the iron rim).
  if (esm > 0 && es > 0) {
    const f = Math.min(1, es / esm);
    const bottom = Math.PI / 2;
    g.save();
    g.shadowColor = "rgba(150,210,255,0.8)";
    g.shadowBlur = 1.5 * c.L.hudScale;
    ring(g, o.cx, o.cy, o.r + rim + 1, SKIN.es, 1.2, bottom - f * Math.PI, bottom + f * Math.PI);
    g.restore();
  }
  // Barrier: gold ring outside the ES ring plus "+N".
  if (bar > 0) {
    ring(g, o.cx, o.cy, o.r + rim + 2.6, SKIN.gold, 0.8);
    const pts = c.s.prog?.pts ?? 0;
    const asc = c.s.prog?.ascPts ?? 0;
    // Above the globe unless the point indicator (I) occupies that space; then inside, under the numbers.
    if (pts <= 0 && asc <= 0) c.text(`+${bar}`, o.cx, o.cy - o.r - 13, "#d8b860", "center");
    else c.text(`+${bar}`, o.cx, o.cy + 6, "#d8b860", "center");
  }

  // Life / ES numbers are always shown (user request); hover only adds the tooltip.
  void hovered;
  {
    if (!esOnly) skinText(g, `${hp}/${maxHp}`, o.cx, o.cy - 3.5, { face: "display", size: 7, align: "center", color: low ? "#ffd0c8" : "#f0e4dc" });
    if (esm > 0) skinText(g, `${es}`, o.cx, o.cy - 3.5 - (esOnly ? 0 : 7.5), { face: "display", size: 6, align: "center", color: SKIN.es });
  }
}

// ---- B. mana globe + spirit -----------------------------------------------------------------

function drawMana(c: HudCtx) {
  const { g, L } = c;
  const me = c.v.self!;
  const o = L.manaGlobe;
  const maxMp = n0(c.v.selfStats.maxMana);
  const mp = Math.min(maxMp, n0(me.mp ?? 0));
  const sp = c.s.spirit ?? { used: 0, total: 0 };

  const hovered = c.hot(circleRect(o, 2), {
    tip: [`Mana ${mp} / ${maxMp}`, ...(sp.total > 0 || sp.used > 0 ? [`Spirit reserved ${sp.used} of ${sp.total}`] : [])],
  });

  drawSkinGlobeHolder(g, o, "right");
  drawSkinGlobe(g, o, { kind: "mana", frac: maxMp > 0 ? mp / maxMp : 0, time: c.time });
  if (maxMp > 0) {
    const inc = incomingRecovery(c, "mana");
    if (inc > 0) drawIncoming(g, o, mp / maxMp, Math.min(1, ((me.mp ?? 0) + inc) / maxMp), "#8ab0ff", c.time);
  }
  void hovered; // mana numbers are always shown
  skinText(g, `${mp}/${maxMp}`, o.cx, o.cy - 3.5, { face: "display", size: 7, align: "center", color: "#e0e6f4" });

  if (sp.total > 0 || sp.used > 0) drawSpirit(c, sp.used, sp.total);
}

/** Spirit plate beside the mana globe: reserved in gold / total in grey (as in the Skills panel); red when over the limit. */
function drawSpirit(c: HudCtx, used: number, total: number) {
  const { g, L } = c;
  const over = used > total;
  const avail = Math.max(0, total - used);
  const size = 6;
  const label = "Spirit";
  const a = String(used); // same reading as the Skills panel header and the character sheet: reserved / total
  const rs = ` / ${total}`;
  const lw = skinTextW(label, { size: 5, face: "display" });
  const aw = skinTextW(a, { size, face: "display" });
  const rw = skinTextW(rs, { size: size - 0.5, face: "body" });
  const w = Math.ceil(lw + aw + rw + 8);
  const h = 9;
  const r: HudRect = { x: L.spirit.x + L.spirit.w - w, y: L.spirit.y - 0.5, w, h };
  drawSkinLabel(g, r, { border: over ? SKIN.blood : SKIN.bronze });
  let x = r.x + 3;
  skinText(g, label, x, r.y + 2.3, { size: 5, face: "display", color: SKIN.inkDim });
  x += lw + 2;
  skinText(g, a, x, r.y + 1.4, { size, face: "display", color: over ? "#e05040" : SKIN.gold });
  x += aw;
  skinText(g, rs, x, r.y + 1.8, { size: size - 0.5, face: "body", color: over ? "#c86858" : "#8c8478" });
  c.hot(r, {
    tip: [`Spirit reserved ${used} of ${total}`, `Free ${avail}`, ...(over ? ["Over the limit: some auras are off"] : [])],
  });
}

// ---- flask recovery "incoming" sliver ------------------------------------------------------------

/** Life / mana still to come from flasks that are recovering right now (linear over the flask duration). */
function incomingRecovery(c: HudCtx, res: "life" | "mana"): number {
  const fl = c.s.me?.fl;
  if (!fl) return 0;
  let sum = 0;
  for (let i = 0; i < fl.length; i++) {
    const left = fl[i] ?? 0;
    if (left <= 0) continue;
    const f = c.v.flasks[i];
    if (!f) continue;
    const isMana = FLASK_BASE_BY_ID.get(f.b)?.res === "mana";
    if (isMana !== (res === "mana")) continue;
    const p = flaskProps(f, c.v.selfStats.flaskRecovery);
    if (p.instant || p.duration <= 0) continue;
    sum += p.heal * Math.min(1, left / p.duration);
  }
  return sum;
}

/** Lighter translucent band from the current fill level up to `to` (fractions), inside the globe. */
function drawIncoming(g: CanvasRenderingContext2D, o: HudCircle, from: number, to: number, color: string, time: number) {
  const f0 = Math.max(0, Math.min(1, from));
  const f1 = Math.max(0, Math.min(1, to));
  if (f1 - f0 < 0.004) return;
  const y0 = o.cy + o.r - f0 * o.r * 2;
  const y1 = o.cy + o.r - f1 * o.r * 2;
  g.save();
  g.beginPath();
  g.arc(o.cx, o.cy, o.r, 0, Math.PI * 2);
  g.clip();
  const shimmer = 0.85 + 0.15 * Math.sin(time * 5);
  const lg = g.createLinearGradient(0, y1, 0, y0);
  lg.addColorStop(0, rgba(color, 0.18 * shimmer));
  lg.addColorStop(1, rgba(color, 0.42 * shimmer));
  g.fillStyle = lg;
  g.fillRect(o.cx - o.r, y1, o.r * 2, y0 - y1);
  g.fillStyle = rgba(color, 0.7 * shimmer);
  g.fillRect(o.cx - o.r, y1, o.r * 2, 0.35);
  g.restore();
}

// ---- F. self heavy-stun meter ---------------------------------------------------------------

function drawSelfStun(c: HudCtx) {
  const st = c.v.self!.st;
  const m = meterOf(st, "stun");
  if (m <= 0) return;
  const { g } = c;
  const r = c.L.selfStun;
  const primed = isPrimedSnap(st, "stun");
  const blinkOn = !primed || Math.sin(c.time * Math.PI * 8) > 0; // 4 Hz
  drawSkinBar(g, r, { frac: blinkOn ? Math.min(1, m) : 0, color: primed ? "#e03828" : "#c87828", glow: primed });
  c.hot(r, { tip: [primed ? "Stagger primed: the next heavy hit stuns you" : "Stagger buildup", `${Math.round(m * 100)}%`] });
}

// ---- H. weapon-set tabs -----------------------------------------------------------------------

function drawWeaponSet(c: HudCtx) {
  const inv = c.s.inv;
  if (!inv) return;
  const { g } = c;
  const r = c.L.weaponSet;
  const set = inv.set === 1 ? 1 : 0;
  if (lastSet !== -1 && lastSet !== set) setFlashUntil = c.time + 0.3;
  lastSet = set;
  const names = ["I", "II"];
  const key = actionLabel("weaponSwap");
  const tabH = Math.floor((r.h - 1) / 2);
  for (let i = 0; i < 2; i++) {
    const tr: HudRect = { x: r.x, y: r.y + i * (tabH + 1), w: r.w, h: tabH };
    const active = i === set;
    const flash = active && c.time < setFlashUntil;
    const over = c.hot(tr, {});
    drawSkinButton(g, tr, active ? "hover" : over ? "normal" : "pressed", names[i], {
      size: 6.5,
      color: active ? "#f0e0b0" : "#7a7268",
    });
    if (active) {
      g.save();
      g.lineWidth = 0.45;
      g.strokeStyle = rgba(SKIN.gold, 0.85);
      g.strokeRect(tr.x + 0.8, tr.y + 0.8, tr.w - 1.6, tr.h - 1.6);
      g.restore();
    }
    if (flash) {
      g.save();
      g.globalAlpha = Math.max(0, (setFlashUntil - c.time) / 0.3) * 0.7;
      g.fillStyle = "#fff4dc";
      g.fillRect(tr.x, tr.y, tr.w, tr.h);
      g.restore();
    }
    c.hot(tr, {
      tip: [`Weapon set ${names[set]} active - ${key} swaps`, ...(i !== set && !inv.alt?.mainhand && !inv.alt?.offhand ? ["Set " + names[i] + " is empty"] : [])],
      onClick: () => c.send({ t: "weaponSwap" }),
    });
  }
}

// ---- I. unspent passive / ascendancy points ---------------------------------------------------

function drawPoints(c: HudCtx) {
  const prog = c.s.prog;
  if (!prog) return;
  const { g } = c;
  const r = c.L.points;
  const key = actionLabel("tree");
  const alpha = 0.8 + 0.2 * Math.sin(c.time * 4); // 0.6..1
  let x = r.x;
  const draw = (n: number, fill: string, border: string, color: string, tip: string) => {
    const b: HudRect = { x, y: r.y, w: 16, h: 10 };
    void fill;
    g.save();
    g.globalAlpha = alpha;
    g.shadowColor = rgba(border, 0.6 * alpha);
    g.shadowBlur = 2 * c.L.hudScale;
    drawSkinButton(g, b, "normal");
    g.restore();
    g.save();
    g.globalAlpha = alpha;
    g.lineWidth = 0.5;
    g.strokeStyle = rgba(border, 0.9);
    g.strokeRect(b.x + 0.8, b.y + 0.8, b.w - 1.6, b.h - 1.6);
    skinText(g, `+${n}`, b.x + b.w / 2, b.y + 1.6, { face: "display", size: 6.5, align: "center", color });
    g.restore();
    c.hot(b, { tip: [tip], onClick: () => toggleTree(true) });
    x += 18;
  };
  if (prog.pts > 0) draw(prog.pts, "#1a1608", "#d8b860", "#f0e0a0", `${prog.pts} unspent passive point${prog.pts === 1 ? "" : "s"} - ${key}`);
  if (prog.ascPts > 0)
    draw(prog.ascPts, "#140c1a", "#b080e0", "#e0c8ff", `${prog.ascPts} unspent ascendancy point${prog.ascPts === 1 ? "" : "s"} - ${key}`);
}
