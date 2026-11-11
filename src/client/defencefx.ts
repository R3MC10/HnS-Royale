// Defence / ailment visuals (combat-systems): hit-feedback text, ailment popups and sounds, status
// icons + buildup meters over targets, the energy-shield overlay on the life globe and ailment
// tints on character sprites. Smooth anti-aliased canvas drawing (arcs, gradients), no pixel art.
// render.ts calls into this with small hooks; all state comes from snapshots (`st`, `es`, `esm`)
// and the server's "def" / "ail" / "hit" events (server/damage.ts).
import { AIL_INFO, AIL_KINDS, hasAil, isPrimedSnap, meterOf, type AilmentKind, type AilSnap } from "../shared/ailments";
import { DAMAGE_COLORS } from "../shared/defence";
import type { GameEvent } from "../shared/protocol";
import { sfx } from "./audio/index";
import type { Sprite } from "./gfx/pixel";

export interface DefFloat {
  text: string;
  color: string;
  big: boolean;
}

const DEF_TEXT: Record<string, DefFloat> = {
  evade: { text: "EVADE", color: "#cfe8ff", big: false },
  block: { text: "BLOCK", color: "#e8d9a8", big: false },
  deflect: { text: "DEFLECT", color: "#b9d6c4", big: false },
  immune: { text: "IMMUNE", color: "#d8d0ff", big: false },
};

const AIL_SFX: Partial<Record<AilmentKind, string>> = {
  freeze: "ailment.freeze",
  chill: "ailment.chill",
  ignite: "ailment.ignite",
  shock: "ailment.shock",
  bleed: "ailment.bleed",
  poison: "ailment.poison",
  electrocute: "ailment.shock",
  stun: "hit.block",
};

/**
 * Handle a "def" or "ail" event: plays its sound and returns the floating text to show (or null).
 * "hit" events are styled by hitFloat instead.
 */
export function defenceEvent(e: GameEvent): DefFloat | null {
  if (e.k === "def") {
    sfx.play(e.o === "block" ? "hit.block" : e.o === "immune" ? "hit.armour" : "hit.evade", { x: e.x, y: e.y });
    return DEF_TEXT[e.o] ?? null;
  }
  if (e.k === "ail") {
    const id = AIL_SFX[e.a];
    if (id) sfx.play(id, { x: e.x, y: e.y });
    const info = AIL_INFO[e.a];
    if (e.a === "chill") return null; // frequent, shown by the tint + icon instead
    return { text: info.name.toUpperCase(), color: info.color, big: false };
  }
  return null;
}

/** Text + colour for a hit number: coloured by damage type, ES share, resisted part, deflect tag. */
export function hitFloat(e: Extract<GameEvent, { k: "hit" }>, baseColor: string): DefFloat {
  const n = Math.round(e.dmg);
  let text = `${n}`;
  let color = baseColor;
  if (e.ty && e.ty !== "phys") color = DAMAGE_COLORS[e.ty];
  if (e.es && e.es >= e.dmg * 0.5) color = "#7fb8ff"; // mostly absorbed by energy shield
  if (e.dot) return { text, color, big: false };
  if (e.o === "deflect") text = `${n} DEFLECT`;
  if (e.rs && e.rs >= 1) text += ` (${Math.round(e.rs)} resisted)`;
  return { text, color, big: e.dmg >= 30 };
}

// ---- status icons + buildup meters ----------------------------------------------------------

const METER_SHOW: Exclude<AilmentKind, "chill">[] = ["stun", "freeze", "shock", "ignite", "electrocute", "bleed", "poison"];

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Small vector glyph per ailment, centred on (x, y), radius r. */
function glyph(g: CanvasRenderingContext2D, k: AilmentKind, x: number, y: number, r: number, t: number) {
  const c = AIL_INFO[k].color;
  g.save();
  g.translate(x, y);
  // disc
  const grd = g.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r);
  grd.addColorStop(0, "rgba(40,34,44,0.95)");
  grd.addColorStop(1, "rgba(10,8,12,0.95)");
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = Math.max(1, r * 0.16);
  g.strokeStyle = c;
  g.stroke();
  g.fillStyle = c;
  g.strokeStyle = c;
  g.lineCap = "round";
  g.lineJoin = "round";
  const s = r * 0.6;
  g.lineWidth = Math.max(1, r * 0.18);
  switch (k) {
    case "stun": // three orbiting stars
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        g.beginPath();
        g.arc(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.35, r * 0.17, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "freeze":
    case "chill": // snowflake
      for (let i = 0; i < (k === "freeze" ? 3 : 2); i++) {
        const a = (i * Math.PI) / (k === "freeze" ? 3 : 2);
        g.beginPath();
        g.moveTo(Math.cos(a) * s, Math.sin(a) * s);
        g.lineTo(-Math.cos(a) * s, -Math.sin(a) * s);
        g.stroke();
      }
      break;
    case "shock":
    case "electrocute": // bolt
      g.beginPath();
      g.moveTo(s * 0.25, -s);
      g.lineTo(-s * 0.35, s * 0.1);
      g.lineTo(s * 0.1, s * 0.1);
      g.lineTo(-s * 0.25, s);
      g.lineTo(s * 0.4, -s * 0.15);
      g.lineTo(-s * 0.05, -s * 0.15);
      g.closePath();
      g.fill();
      break;
    case "ignite": { // flame
      const f = 1 + Math.sin(t * 14) * 0.08;
      g.beginPath();
      g.moveTo(0, -s * f);
      g.quadraticCurveTo(s * 0.8, 0, s * 0.45, s * 0.6);
      g.quadraticCurveTo(0, s * 0.95, -s * 0.45, s * 0.6);
      g.quadraticCurveTo(-s * 0.8, 0, 0, -s * f);
      g.fill();
      break;
    }
    case "bleed": // drop
    case "poison":
      g.beginPath();
      g.moveTo(0, -s);
      g.quadraticCurveTo(s * 0.75, s * 0.2, 0, s * 0.8);
      g.quadraticCurveTo(-s * 0.75, s * 0.2, 0, -s);
      g.fill();
      break;
  }
  g.restore();
}

/**
 * Draw status icons (active ailments) and buildup meters (partly filled kinds) centred above
 * (x, y) = the top of the target's label. `u` = target pixels per world-pass pixel (render hr).
 */
export function drawStatus(g: CanvasRenderingContext2D, st: AilSnap | undefined, x: number, y: number, u: number, t: number) {
  if (!st) return;
  g.save();
  // Active ailment icons
  const active = AIL_KINDS.filter((k) => hasAil(st, k));
  const r = 4.2 * u;
  let iy = y - r - 1.5 * u;
  if (active.length) {
    const gap = r * 2.3;
    let ix = x - ((active.length - 1) * gap) / 2;
    for (const k of active) {
      glyph(g, k, ix, iy, r, t);
      ix += gap;
    }
    iy -= r * 2 + 1.5 * u;
  }
  // Buildup meters (thin rounded bars, primed ones pulse)
  const meters = METER_SHOW.map((k) => ({ k, v: meterOf(st, k) })).filter((m) => m.v > 0.02 && !hasAil(st, m.k));
  const bw = 22 * u;
  const bh = 2.2 * u;
  let my = active.length ? iy + r - bh : y - bh - 2 * u;
  for (const m of meters.slice(0, 3)) {
    const c = AIL_INFO[m.k].color;
    const bx = x - bw / 2;
    g.fillStyle = "rgba(8,6,10,0.8)";
    rr(g, bx - u * 0.6, my - u * 0.6, bw + u * 1.2, bh + u * 1.2, bh);
    g.fill();
    g.fillStyle = c;
    rr(g, bx, my, Math.max(bh, bw * Math.min(1, m.v)), bh, bh / 2);
    g.fill();
    const primed = isPrimedSnap(st, m.k);
    if (primed) {
      // primed: pulsing orb at the bar end
      const a = 0.55 + 0.45 * Math.sin(t * 10);
      g.globalAlpha = a;
      g.shadowColor = c;
      g.shadowBlur = 6 * u;
      g.beginPath();
      g.arc(bx + bw + 2.5 * u, my + bh / 2, 1.9 * u, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    }
    my -= bh + 2 * u;
  }
  // Hard-CC immunity: a faint silver halo ring
  if (st.i) {
    g.strokeStyle = "rgba(220,215,255,0.75)";
    g.lineWidth = 1.1 * u;
    g.setLineDash([2.5 * u, 2 * u]);
    g.lineDashOffset = -t * 12 * u;
    g.beginPath();
    g.ellipse(x, my - 1 * u, 7 * u, 2.2 * u, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }
  g.restore();
}

// ---- energy shield on the life globe -----------------------------------------------------------

/** Blue shell over the life globe: arc length = ES fraction, plus a soft glass sheen while ES > 0. */
export function drawEsGlobe(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, es: number | undefined, esm: number | undefined, t: number) {
  if (!esm || esm <= 0) return;
  const f = Math.max(0, Math.min(1, (es ?? 0) / esm));
  g.save();
  // track
  g.lineCap = "round";
  g.lineWidth = 3;
  g.strokeStyle = "rgba(20,30,60,0.75)";
  g.beginPath();
  g.arc(cx, cy, R + 2.5, Math.PI * 0.5, Math.PI * 2.5);
  g.stroke();
  if (f > 0) {
    // fill arc, starting at the bottom, growing both ways
    const half = Math.PI * f;
    const grd = g.createLinearGradient(cx, cy - R, cx, cy + R);
    grd.addColorStop(0, "#bfe4ff");
    grd.addColorStop(1, "#4d8dff");
    g.strokeStyle = grd;
    g.shadowColor = "#6fb0ff";
    g.shadowBlur = 5;
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(cx, cy, R + 2.5, Math.PI * 0.5 - half, Math.PI * 0.5 + half);
    g.stroke();
    g.shadowBlur = 0;
    // glass sheen inside the globe
    const sheen = g.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    sheen.addColorStop(0, "rgba(120,180,255,0)");
    sheen.addColorStop(1, `rgba(140,200,255,${0.18 + 0.32 * f + 0.05 * Math.sin(t * 3)})`);
    g.fillStyle = sheen;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// ---- sprite tint -------------------------------------------------------------------------------

let tintCv: HTMLCanvasElement | null = null;

/** Tint colour + strength for a target's current ailments (null = none). Priority: freeze > shock > ignite > poison > chill. */
export function ailTint(st: AilSnap | undefined, t: number): { color: string; a: number } | null {
  if (!st || !st.a) return null;
  if (hasAil(st, "freeze")) return { color: "#a8e6ff", a: 0.55 };
  if (hasAil(st, "electrocute")) return { color: "#c4b0ff", a: 0.35 + 0.25 * Math.abs(Math.sin(t * 22)) };
  if (hasAil(st, "shock")) return { color: "#fff07a", a: 0.15 + 0.25 * Math.max(0, Math.sin(t * 17)) };
  if (hasAil(st, "ignite")) return { color: "#ff7a2a", a: 0.28 + 0.1 * Math.sin(t * 11) };
  if (hasAil(st, "poison")) return { color: "#7bd34a", a: 0.25 };
  if (hasAil(st, "chill")) return { color: "#6fb7e8", a: 0.25 };
  if (hasAil(st, "bleed")) return { color: "#d0323a", a: 0.15 };
  return null;
}

/** Re-draw a sprite over itself filled with `color` at alpha `a` (keeps the sprite's silhouette). */
export function drawTint(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number, color: string, a: number) {
  const w = s.cv.width;
  const h = s.cv.height;
  if (!tintCv) tintCv = document.createElement("canvas");
  if (tintCv.width < w || tintCv.height < h) {
    tintCv.width = Math.max(tintCv.width, w);
    tintCv.height = Math.max(tintCv.height, h);
  }
  // GPU canvas (gfx/softcanvas.ts): the 3D hero frames tinted here live on the GPU, a software canvas made every
  // hit flash a synchronous GPU readback.
  const c = tintCv.getContext("2d", { willReadFrequently: false })!;
  c.clearRect(0, 0, w, h);
  c.globalCompositeOperation = "source-over";
  c.drawImage(s.cv, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = color;
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = "source-over";
  const d = s.d ?? 1;
  g.save();
  g.globalAlpha = a;
  g.drawImage(tintCv, 0, 0, w, h, x - s.ax / d, y - s.ay / d, w / d, h / d);
  g.restore();
}

// ---- ailment body effects (smooth, procedural, drawn over the sprite) -------------------------

const fract = (v: number) => v - Math.floor(v);
const rnd = (a: number, b: number) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);

/**
 * Animated ailment effects on a character: flames licking up the body (ignite), an ice crust
 * (freeze), crackling arcs (shock / electrocute), frost motes (chill), blood drips (bleed) and a
 * green haze (poison). (x, y) = the sprite's anchor (feet); the body box comes from the sprite.
 */
export function drawAilFx(g: CanvasRenderingContext2D, st: AilSnap | undefined, s: Sprite, x: number, y: number, t: number, seed: number) {
  if (!st || !st.a) return;
  const d = s.d ?? 1;
  // Visible body: roughly the middle 45% of the sprite width, from the feet up to ~85% of the anchor height.
  const H = Math.max(10, (s.ay / d) * 0.42);
  const W = Math.max(5, (s.cv.width / d) * 0.075);
  const top = y - H;
  g.save();
  if (hasAil(st, "poison")) {
    g.globalCompositeOperation = "source-over";
    for (let i = 0; i < 5; i++) {
      const ph = t * 0.6 + i * 1.7 + seed;
      const px = x + Math.sin(ph) * W * 1.3;
      const py = y - H * (0.15 + 0.5 * fract(ph * 0.25 + rnd(i, seed)));
      const r = W * (0.9 + 0.4 * Math.sin(ph * 1.3));
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, "rgba(120,220,70,0.32)");
      gr.addColorStop(1, "rgba(60,140,30,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (hasAil(st, "bleed")) {
    for (let i = 0; i < 4; i++) {
      const ph = fract(t * 0.9 + rnd(i, seed));
      const px = x + (rnd(i + 9, seed) - 0.5) * W * 1.4;
      const py = top + H * 0.35 + ph * H * 0.65;
      const a = 1 - ph * 0.7;
      g.fillStyle = `rgba(170,20,28,${a})`;
      g.beginPath();
      g.moveTo(px, py - 2.6);
      g.quadraticCurveTo(px + 1.3, py + 0.2, px, py + 1.2);
      g.quadraticCurveTo(px - 1.3, py + 0.2, px, py - 2.6);
      g.fill();
    }
  }
  if (hasAil(st, "chill") && !hasAil(st, "freeze")) {
    g.fillStyle = "rgba(220,240,255,0.85)";
    for (let i = 0; i < 6; i++) {
      const ph = fract(t * 0.35 + rnd(i, seed + 3));
      const px = x + Math.sin(t * 1.5 + i * 2.1) * W * 1.1;
      const py = top + H * (1 - ph);
      g.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      g.beginPath();
      g.arc(px, py, 0.8 + rnd(i, 7) * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  if (hasAil(st, "freeze")) {
    // Ice crust: translucent crystal shards hugging the lower body, a cold rim and sparkles.
    const n = 9;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const bx = x + u * W * 1.05;
      const h = H * (0.35 + 0.45 * rnd(i, seed) * (1 - Math.abs(u) * 0.5));
      const lean = (rnd(i + 4, seed) - 0.5) * W * 0.5 + u * W * 0.25;
      const wd = W * (0.28 + 0.18 * rnd(i + 2, seed));
      const gr = g.createLinearGradient(bx, y, bx + lean, y - h);
      gr.addColorStop(0, "rgba(150,210,255,0.75)");
      gr.addColorStop(1, "rgba(230,248,255,0.45)");
      g.fillStyle = gr;
      g.strokeStyle = "rgba(240,252,255,0.8)";
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(bx - wd, y + 1);
      g.lineTo(bx + lean - wd * 0.25, y - h * 0.8);
      g.lineTo(bx + lean, y - h);
      g.lineTo(bx + wd, y + 1);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const ph = fract(t * 0.7 + i / 3);
      const px = x + (rnd(i, Math.floor(t * 0.7 + i / 3)) - 0.5) * W * 2;
      const py = top + H * (0.2 + 0.7 * rnd(i + 5, Math.floor(t * 0.7 + i / 3)));
      const a = Math.sin(ph * Math.PI);
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(px - 2.2 * a, py);
      g.lineTo(px + 2.2 * a, py);
      g.moveTo(px, py - 2.2 * a);
      g.lineTo(px, py + 2.2 * a);
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  }
  if (hasAil(st, "ignite")) {
    // Flame tongues licking up the body, additive, each flickering on its own phase.
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const ph = fract(t * 1.6 + rnd(i, seed));
      const bx = x + (rnd(i + 1, seed) - 0.5) * W * 1.8;
      const by = y - H * (0.05 + 0.6 * rnd(i + 3, seed)) - ph * H * 0.25;
      const fh = H * (0.28 + 0.2 * rnd(i + 6, seed)) * Math.sin(ph * Math.PI);
      const fw = W * (0.35 + 0.15 * rnd(i, 2));
      const sway = Math.sin(t * 9 + i) * fw * 0.6;
      const gr = g.createLinearGradient(bx, by, bx, by - fh);
      gr.addColorStop(0, "rgba(255,120,30,0.75)");
      gr.addColorStop(0.55, "rgba(255,190,70,0.55)");
      gr.addColorStop(1, "rgba(255,240,180,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(bx - fw, by);
      g.quadraticCurveTo(bx - fw * 0.6 + sway * 0.5, by - fh * 0.6, bx + sway, by - fh);
      g.quadraticCurveTo(bx + fw * 0.6 + sway * 0.5, by - fh * 0.6, bx + fw, by);
      g.quadraticCurveTo(bx, by + fw * 0.6, bx - fw, by);
      g.fill();
    }
    // Ember glow at the core
    const gr = g.createRadialGradient(x, y - H * 0.4, 0, x, y - H * 0.4, W * 2.2);
    gr.addColorStop(0, `rgba(255,120,40,${0.22 + 0.08 * Math.sin(t * 13)})`);
    gr.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y - H * 0.4, W * 2.2, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  }
  const shock = hasAil(st, "shock");
  const elec = hasAil(st, "electrocute");
  if (shock || elec) {
    // Crackling arcs: jagged polylines re-rolled ~14x per second, with a soft glow pass.
    const frame = Math.floor(t * 14);
    const n = elec ? 4 : 2;
    g.globalCompositeOperation = "lighter";
    g.lineJoin = "round";
    for (let i = 0; i < n; i++) {
      if (!elec && rnd(i, frame + seed) < 0.35) continue; // shock flickers
      const a0 = rnd(i, frame) * Math.PI * 2;
      const a1 = a0 + 1.2 + rnd(i + 1, frame) * 2;
      const pts: [number, number][] = [];
      const segs = 6;
      for (let k = 0; k <= segs; k++) {
        const a = a0 + ((a1 - a0) * k) / segs;
        const jit = (rnd(i * 10 + k, frame) - 0.5) * W * 0.6;
        pts.push([x + Math.cos(a) * (W * 1.2 + jit), top + H * 0.5 + Math.sin(a) * (H * 0.45 + jit)]);
      }
      for (const [lw, col] of [
        [3.2, elec ? "rgba(170,140,255,0.35)" : "rgba(255,230,90,0.35)"],
        [1, elec ? "rgba(235,225,255,0.95)" : "rgba(255,255,210,0.95)"],
      ] as [number, string][]) {
        g.lineWidth = lw;
        g.strokeStyle = col;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
        g.stroke();
      }
    }
    g.globalCompositeOperation = "source-over";
  }
  g.restore();
}
