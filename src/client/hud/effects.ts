// HUD status package: buff row (spec 2.2 M) and debuff / ailment row (spec 2.2 N).
// Systems copy only: bevelled icon frames (neutral bronze = buff, red = debuff) with original procedural
// glyphs per effect (painted icons art/out/icon/fx_<glyph>.png when present), timer bars, seconds, stack
// counts, buildup chips. Text is the smooth serif skin face. The helpers at the bottom (miniText, chips,
// drawRow) are shared with ./target.ts.
import { laneClaim } from "./lanes";
import type { HudCtx, HudRect } from "./types";
import type { AilSnap, AilShort, AilmentKind } from "../../shared/ailments";
import { AIL_KINDS, AIL_SHORT, AIL_INFO } from "../../shared/ailments";
import { FX_LABELS, isFxKey } from "../../shared/content/fx";
import { bevel, chamferPath, hudIcon, rgba, shade, skinText, skinTextW } from "./skin";

const ICON = 14; // icon edge (u) for the self buff/debuff rows
const SMALL = 10; // icon edge for rows shorter than ICON (target chips)

// ---- buff look ----
const BUFF_FRAME = "#9a8458";
const BUFF_FILL = "#0e0c0a";
const BUFF_TEXT = "#e8dcb8";
// ---- debuff look ----
const DEBUFF_FRAME = "#b04040";
const DEBUFF_FILL = "#140a0a";

/** Original ailment abbreviations and colours (spec 2.2 N table). */
export const AIL_LABEL: Record<AilmentKind, { ab: string; col: string }> = {
  stun: { ab: "ST", col: "#e09040" },
  freeze: { ab: "FR", col: "#40d0e8" },
  chill: { ab: "CH", col: "#a8e8f0" },
  shock: { ab: "SK", col: "#e8d840" },
  ignite: { ab: "IG", col: "#e85a28" },
  bleed: { ab: "BL", col: "#a82424" },
  poison: { ab: "PO", col: "#50b040" },
  electrocute: { ab: "EL", col: "#a070e0" },
};

// ------------------------------------------------------------------------------------------------
// Entry points
// ------------------------------------------------------------------------------------------------

let ciMax = 0; // largest CC-immunity seconds seen since it appeared (bar denominator)

export function drawEffects(c: HudCtx): void {
  const self = c.v.self;
  if (!self?.alive) {
    ciMax = 0;
    return;
  }
  drawBuffRow(c, self.st);
  drawDebuffRow(c, self.st);
}

// ------------------------------------------------------------------------------------------------
// M. Buff row
// ------------------------------------------------------------------------------------------------

export interface IconSpec {
  ab: string;
  /** Glyph id (ailment kind or buff glyph); drawn instead of the abbreviation. */
  glyph?: string;
  frame: string;
  fill: string;
  text: string;
  frac?: number; // timer bar fraction (undefined = no bar)
  secs?: number; // seconds left (drawn small when < 10)
  stacks?: number;
  build?: number; // buildup chip fill 0..1 (chip mode)
  blink?: boolean; // primed: frame blinks
  dim?: boolean; // lower alpha label (buildup chips)
  tip: string[];
}

function drawBuffRow(c: HudCtx, st: AilSnap | undefined): void {
  const me = c.s.me;
  const icons: IconSpec[] = [];
  for (const b of me?.bf ?? []) {
    if (b.d) continue;
    const max = Math.max(b.t, c.s.buffMax.get(b.id) ?? 0);
    const tip = [buffLabel(b.id, b.k), `${fmtSecs(b.t)}s left`];
    const src = sourceName(c, b.src);
    if (src) tip.push(`From ${src}`);
    if ((b.n ?? 1) > 1) tip.splice(1, 0, `${b.n} stacks`);
    icons.push({
      ab: buffAbbrev(b.id, b.k), glyph: buffGlyph(b.id, b.k), frame: BUFF_FRAME, fill: BUFF_FILL, text: BUFF_TEXT,
      frac: max > 0 ? b.t / max : undefined, secs: b.t, stacks: b.n, tip,
    });
  }
  if (st?.i) {
    const ci = me?.ci;
    if (ci !== undefined && ci > 0) ciMax = Math.max(ciMax, ci);
    else ciMax = 0;
    const tip = ["Crowd control immune", "Stuns, freezes and jolts cannot land"];
    if (ci !== undefined && ci > 0) tip.push(`${fmtSecs(ci)}s left`);
    icons.push({
      ab: "IM", glyph: "shield", frame: BUFF_FRAME, fill: BUFF_FILL, text: "#f0e0a0",
      frac: ci !== undefined && ci > 0 && ciMax > 0 ? ci / ciMax : undefined, secs: ci, tip,
    });
  } else ciMax = 0;
  drawRow(c, c.L.buffs, icons);
}

function buffAbbrev(id: string, k: string | undefined): string {
  if (id === "haste") return "HS";
  if (id.startsWith("shrine:")) return "SH";
  if (id === "chill") return "CH";
  if (k && isFxKey(k)) return fxAbbrev(FX_LABELS[k]);
  return id.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "FX";
}

/** Glyph id for a buff / timed debuff (see drawGlyph). */
function buffGlyph(id: string, k: string | undefined): string {
  if (id === "haste") return "haste";
  if (id.startsWith("shrine:")) return "shrine";
  if (id === "chill") return "chill";
  if (id.startsWith("charm")) return "charm";
  switch (k) {
    case "killHaste":
    case "hasteBuff":
      return "haste";
    case "dmgTakenRed":
    case "kbImmune":
    case "slowImmune":
      return "shield";
    case "takenMore":
      return "crack";
    case "regenBuff":
    case "leech":
    case "killHeal":
      return "heart";
    case "thorns":
      return "thorns";
    case "chillOnHit":
      return "chill";
    case "charmSlots":
    case "charmGain":
      return "charm";
    case "lowLifeMore":
    case "executeMore":
    case "fullLifeMore":
    case "dodgeMore":
    case "pvpMore":
    case "pveMore":
      return "blade";
  }
  return "rune";
}

function buffLabel(id: string, k: string | undefined): string {
  if (id === "haste") return "Hastened";
  if (id.startsWith("shrine:")) return `Shrine blessing (${id.slice(7).replace(/_/g, " ")})`;
  if (id === "chill") return "Slowed by cold";
  if (k && isFxKey(k)) return fxText(FX_LABELS[k]);
  return id;
}

const FILLER = new Set(["increased", "more", "less", "of", "by", "to", "the", "a", "an", "on", "per", "for", "your", "is", "as", "you"]);

/** Initials of the first two meaningful words of an effect label, uppercased ("Movement Speed" -> "MS"). */
function fxAbbrev(label: string): string {
  const words = fxText(label).split(/\s+/).filter((w) => /^[a-z]/i.test(w) && !FILLER.has(w.toLowerCase()));
  const ab = words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return ab.length === 2 ? ab : (words[0] ?? "FX").slice(0, 2).toUpperCase();
}

/** Effect label without its value placeholder, first letter capitalised. */
function fxText(label: string): string {
  const t = label.replace(/\+?\{v\}%?\s*/g, "").replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : label;
}

function sourceName(c: HudCtx, src: string | undefined): string | null {
  if (!src || !src.startsWith("charm")) return null;
  const id = Number(src.slice(5));
  const it = c.s.inv?.charms?.find((x) => x?.id === id);
  return it?.n ?? "a charm";
}

// ------------------------------------------------------------------------------------------------
// N. Debuff / ailment row
// ------------------------------------------------------------------------------------------------

function drawDebuffRow(c: HudCtx, st: AilSnap | undefined): void {
  const me = c.s.me;
  const icons: IconSpec[] = [];
  const bfDebuffs = (me?.bf ?? []).filter((b) => b.d);
  const hasChillBuff = bfDebuffs.some((b) => b.id === "chill");

  // Active ailments (bit order = AIL_KINDS, as encodeAil writes them).
  AIL_KINDS.forEach((k, i) => {
    if (!st?.a || !(st.a & (1 << i))) return;
    if (k === "chill" && hasChillBuff) return; // the timed debuff entry below already shows it
    const lab = AIL_LABEL[k];
    const short = shortOf(k);
    const secs = short ? me?.am?.[short] : undefined;
    const max = short && secs !== undefined ? Math.max(secs, c.s.buffMax.get("ail:" + short) ?? 0) : 0;
    const tip = [AIL_INFO[k].name];
    if (secs !== undefined) tip.push(`${fmtSecs(secs)}s left`);
    icons.push({
      ab: lab.ab, glyph: k, frame: DEBUFF_FRAME, fill: DEBUFF_FILL, text: lab.col,
      frac: secs !== undefined && max > 0 ? secs / max : undefined, secs, tip,
    });
  });

  // Timed debuffs from the private HUD block.
  for (const b of bfDebuffs) {
    const max = Math.max(b.t, c.s.buffMax.get(b.id) ?? 0);
    const tip = [buffLabel(b.id, b.k), `${fmtSecs(b.t)}s left`];
    if ((b.n ?? 1) > 1) tip.splice(1, 0, `${b.n} stacks`);
    icons.push({
      ab: buffAbbrev(b.id, b.k), glyph: buffGlyph(b.id, b.k), frame: DEBUFF_FRAME, fill: DEBUFF_FILL,
      text: b.id === "chill" ? AIL_LABEL.chill.col : "#f0d0c8",
      frac: max > 0 ? b.t / max : undefined, secs: b.t, stacks: b.n, tip,
    });
  }

  // Buildup chips (meter > 0 and not active).
  for (const ch of buildupChips(st, c.time)) icons.push(ch);

  drawRow(c, c.L.debuffs, icons);
}

function shortOf(k: AilmentKind): AilShort | undefined {
  return k === "chill" ? undefined : AIL_SHORT[k];
}

/** One chip per ailment meter that is building but not active (shared with the target bar). */
export function buildupChips(st: AilSnap | undefined, time: number): IconSpec[] {
  const out: IconSpec[] = [];
  if (!st?.m) return out;
  AIL_KINDS.forEach((k, i) => {
    const short = shortOf(k);
    if (!short) return;
    const v = st.m?.[short] ?? 0;
    if (v <= 0) return;
    if (st.a && st.a & (1 << i)) return;
    const primed = !!st.p && (st.p & (1 << i)) !== 0;
    const lab = AIL_LABEL[k];
    const tip = [`${AIL_INFO[k].name} building`, `Buildup ${Math.round(v)}%`];
    if (primed) tip.push("Primed: the next hit sets it off");
    out.push({
      ab: lab.ab, glyph: k, frame: primed && Math.floor(time * 8) % 2 === 0 ? "#f0f0f0" : DEBUFF_FRAME,
      fill: DEBUFF_FILL, text: lab.col, build: Math.min(1, v / 100), blink: primed, dim: true, tip,
    });
  });
  return out;
}

/** Chips for a target's active ailments (no timers available for others). */
export function activeChips(st: AilSnap | undefined): IconSpec[] {
  const out: IconSpec[] = [];
  if (!st?.a) return out;
  AIL_KINDS.forEach((k, i) => {
    if (!(st.a! & (1 << i))) return;
    const lab = AIL_LABEL[k];
    out.push({ ab: lab.ab, glyph: k, frame: DEBUFF_FRAME, fill: DEBUFF_FILL, text: lab.col, tip: [AIL_INFO[k].name] });
  });
  return out;
}


// ------------------------------------------------------------------------------------------------
// Shared drawing
// ------------------------------------------------------------------------------------------------

/** Icon edge for a row of height h: the full 14u icon when it fits, else the small 10u chip. */
function iconSize(h: number): number {
  return h >= ICON ? ICON : SMALL;
}

/** Lay icons out left to right in `r` (pitch = icon + 2u); overflow collapses into a final `+N` slot. */
export function drawRow(c: HudCtx, r: HudRect, icons: IconSpec[], withTips = true): void {
  if (!icons.length) return;
  const size = iconSize(r.h);
  const pitch = size + 2;
  const cap = Math.max(1, Math.floor((r.w + 2) / pitch));
  const over = icons.length > cap;
  const shown = over ? cap - 1 : icons.length;
  if (r === c.L.buffs || r === c.L.debuffs) laneClaim("buffs", { x: 0, y: r.y - 1, w: r.x + Math.min(cap, icons.length) * pitch + 1, h: size + 2 }); // lanes: world labels keep out
  for (let i = 0; i < shown; i++) {
    const ic = icons[i];
    const x = r.x + i * pitch;
    drawIcon(c.g, x, r.y, ic, size);
    if (withTips) c.hot({ x, y: r.y, w: size, h: size }, { tip: ic.tip });
  }
  if (over) {
    const x = r.x + shown * pitch;
    const n = icons.length - shown;
    const rest = icons.slice(shown);
    c.g.save();
    iconFrame(c.g, x, r.y, size, "#0a0809", "#7a6a50", "#a89c88");
    c.g.restore();
    skinText(c.g, "+" + Math.min(99, n), x + size / 2, r.y + size / 2 - size * 0.24, { size: size * 0.46, align: "center", face: "display", color: "#d8ccb0" });
    if (withTips) c.hot({ x, y: r.y, w: size, h: size }, { tip: [`${n} more`, ...rest.slice(0, 6).map((ic) => ic.tip[0])] });
  }
}

/** Width a row of n icons takes (u); `size` = icon edge (default: the small chip). */
export function rowWidth(n: number, size = SMALL): number {
  return n > 0 ? (n - 1) * (size + 2) + size : 0;
}

/** Bevelled, chamfered icon well tinted toward `tint`, with a coloured hairline border. */
function iconFrame(g: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string, border: string, tint: string) {
  const ch = Math.min(1.6, s * 0.12);
  chamferPath(g, x, y, s, s, ch);
  g.fillStyle = fill;
  g.fill();
  const rg = g.createRadialGradient(x + s * 0.45, y + s * 0.4, s * 0.05, x + s / 2, y + s / 2, s * 0.75);
  rg.addColorStop(0, rgba(tint, 0.2));
  rg.addColorStop(0.6, rgba(tint, 0.05));
  rg.addColorStop(1, "rgba(0,0,0,0.6)");
  g.fillStyle = rg;
  g.fill();
  bevel(g, x, y, s, s, ch, 0.7, "rgba(170,155,130,0.55)", "rgba(0,0,0,0.95)");
  chamferPath(g, x + 0.9, y + 0.9, s - 1.8, s - 1.8, Math.max(0, ch - 0.5));
  g.lineWidth = 0.45;
  g.strokeStyle = rgba(border, 0.9);
  g.stroke();
}

export function drawIcon(g: CanvasRenderingContext2D, x: number, y: number, ic: IconSpec, size = SMALL): void {
  const s = size;
  g.save();
  g.imageSmoothingEnabled = true;
  iconFrame(g, x, y, s, ic.fill, ic.frame, ic.text);
  // buildup fill (chips): bottom-up translucent wash of the ailment colour
  if (ic.build !== undefined && ic.build > 0) {
    const ih = (s - 2) * Math.min(1, ic.build);
    g.save();
    chamferPath(g, x + 1, y + 1, s - 2, s - 2, 0.8);
    g.clip();
    const bg = g.createLinearGradient(0, y + s - 1 - ih, 0, y + s - 1);
    bg.addColorStop(0, rgba(ic.text, 0.55));
    bg.addColorStop(1, rgba(ic.text, 0.2));
    g.fillStyle = bg;
    g.fillRect(x + 1, y + s - 1 - ih, s - 2, ih);
    g.restore();
  }
  // glyph (painted icon art/out/icon/fx_<glyph>.png when present, else procedural), dimmed for buildup chips
  g.save();
  if (ic.dim) g.globalAlpha *= 0.7;
  const img = ic.glyph ? hudIcon("fx_" + ic.glyph) : null;
  if (img && img.complete && img.naturalWidth > 0) {
    g.drawImage(img, x + 1.5, y + 1.5, s - 3, s - 3);
  } else if (ic.glyph) {
    drawGlyph(g, ic.glyph, x + s / 2, y + s / 2, s * 0.62, ic.text);
  } else {
    skinText(g, ic.ab, x + s / 2, y + s / 2 - s * 0.24, { size: s * 0.46, align: "center", face: "display", color: ic.text });
  }
  g.restore();
  // timer bar: thin lit line inside the bottom edge
  if (ic.frac !== undefined) {
    const f = Math.max(0, Math.min(1, ic.frac));
    const bw = s - 2.4;
    g.fillStyle = "rgba(0,0,0,0.75)";
    g.fillRect(x + 1.2, y + s - 2, bw, 0.9);
    if (f > 0) {
      g.fillStyle = shade(ic.frame, 1.35);
      g.fillRect(x + 1.2, y + s - 2, bw * f, 0.9);
    }
  }
  // stack count, top-right corner
  if (ic.stacks !== undefined && ic.stacks > 1) {
    skinText(g, String(Math.min(99, ic.stacks)), x + s - 0.6, y + 0.2, { size: s * 0.4, align: "right", face: "display", color: "#ffffff" });
  }
  // seconds, bottom-left, over the glyph
  if (ic.secs !== undefined && ic.secs < 10 && ic.secs > 0) {
    const t = ic.secs < 1 ? "." + Math.floor(ic.secs * 10) : String(Math.floor(ic.secs));
    skinText(g, t, x + 1, y + s - 2 - s * 0.38, { size: s * 0.38, align: "left", face: "display", color: "#f0e6d0" });
  }
  g.restore();
}

// ---- procedural glyphs (original shapes) ----------------------------------------------------------

/** Draw glyph `id` centred at (cx, cy) inside a box of edge s, in colour col with a dark outline. */
export function drawGlyph(g: CanvasRenderingContext2D, id: string, cx: number, cy: number, s: number, col: string): void {
  const h = s / 2;
  const lit = shade(col, 1.35);
  const dark = shade(col, 0.45);
  g.save();
  g.lineJoin = "round";
  g.lineCap = "round";
  const finish = (fill = true, strokeW = 0.5) => {
    if (fill) {
      const gr = g.createLinearGradient(cx, cy - h, cx, cy + h);
      gr.addColorStop(0, lit);
      gr.addColorStop(1, dark);
      g.fillStyle = gr;
      g.fill();
    }
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.lineWidth = strokeW;
    g.stroke();
  };
  const lines = (w: number, segs: number[][], color = col) => {
    g.beginPath();
    for (const [x0, y0, x1, y1] of segs) {
      g.moveTo(cx + x0 * h, cy + y0 * h);
      g.lineTo(cx + x1 * h, cy + y1 * h);
    }
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.lineWidth = w + 0.6;
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = w;
    g.stroke();
  };
  const px = (x: number) => cx + x * h;
  const py = (y: number) => cy + y * h;
  const shieldPath = () => {
    g.beginPath();
    g.moveTo(px(0), py(-1));
    g.lineTo(px(0.8), py(-0.65));
    g.bezierCurveTo(px(0.8), py(0.2), px(0.45), py(0.7), px(0), py(1));
    g.bezierCurveTo(px(-0.45), py(0.7), px(-0.8), py(0.2), px(-0.8), py(-0.65));
    g.closePath();
  };
  const poly = (pts: number[][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(px(x), py(y)) : g.lineTo(px(x), py(y))));
    g.closePath();
  };
  switch (id) {
    case "ignite": {
      // flame: outer tongue + bright inner core
      g.beginPath();
      g.moveTo(px(0), py(1));
      g.bezierCurveTo(px(-0.95), py(0.9), px(-0.8), py(-0.1), px(-0.15), py(-1));
      g.bezierCurveTo(px(-0.1), py(-0.4), px(0.35), py(-0.5), px(0.3), py(-0.85));
      g.bezierCurveTo(px(1), py(-0.2), px(0.95), py(0.85), px(0), py(1));
      finish();
      g.beginPath();
      g.moveTo(px(0), py(0.85));
      g.bezierCurveTo(px(-0.45), py(0.8), px(-0.4), py(0.1), px(0), py(-0.3));
      g.bezierCurveTo(px(0.4), py(0.15), px(0.45), py(0.8), px(0), py(0.85));
      g.fillStyle = "#ffe8a0";
      g.fill();
      break;
    }
    case "freeze": {
      // hexagonal crystal with facet lines
      poly([[0, -1], [0.55, -0.45], [0.55, 0.45], [0, 1], [-0.55, 0.45], [-0.55, -0.45]]);
      finish();
      lines(0.3, [[0, -1, 0, 1], [-0.55, -0.45, 0, 0], [0.55, -0.45, 0, 0]], "rgba(255,255,255,0.7)");
      break;
    }
    case "chill": {
      // six-armed frost star with barbs
      const segs: number[][] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3 + Math.PI / 2;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        segs.push([-dx * 0.95, -dy * 0.95, dx * 0.95, dy * 0.95]);
        for (const sg of [1, -1]) {
          const bx = dx * 0.55 * sg;
          const by = dy * 0.55 * sg;
          const qx = -dy * 0.25;
          const qy = dx * 0.25;
          segs.push([bx, by, bx + dx * 0.3 * sg + qx, by + dy * 0.3 * sg + qy]);
          segs.push([bx, by, bx + dx * 0.3 * sg - qx, by + dy * 0.3 * sg - qy]);
        }
      }
      lines(0.5, segs);
      break;
    }
    case "shock": {
      poly([[0.25, -1], [-0.55, 0.1], [-0.05, 0.1], [-0.3, 1], [0.6, -0.2], [0.1, -0.2]]);
      finish();
      break;
    }
    case "electrocute": {
      // bolt inside a broken ring
      g.beginPath();
      g.arc(cx, cy, h * 0.92, -0.9, 0.9 + Math.PI * 0.9);
      g.strokeStyle = "rgba(0,0,0,0.85)";
      g.lineWidth = 0.9;
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = 0.45;
      g.stroke();
      poly([[0.15, -0.75], [-0.4, 0.08], [-0.02, 0.08], [-0.2, 0.75], [0.42, -0.12], [0.05, -0.12]]);
      finish(true, 0.4);
      break;
    }
    case "bleed": {
      // blood drop with a highlight
      g.beginPath();
      g.moveTo(px(0), py(-1));
      g.bezierCurveTo(px(0.25), py(-0.5), px(0.75), py(0.05), px(0.75), py(0.4));
      g.arc(cx, py(0.4), 0.75 * h, 0, Math.PI);
      g.bezierCurveTo(px(-0.75), py(0.05), px(-0.25), py(-0.5), px(0), py(-1));
      g.closePath();
      finish();
      g.beginPath();
      g.ellipse(px(-0.3), py(0.3), 0.12 * h, 0.25 * h, 0.3, 0, Math.PI * 2);
      g.fillStyle = "rgba(255,220,210,0.55)";
      g.fill();
      break;
    }
    case "poison": {
      // bubbling cluster
      const bubbles: [number, number, number][] = [[-0.35, 0.35, 0.5], [0.4, 0.25, 0.42], [0, -0.4, 0.38], [0.5, -0.65, 0.18]];
      for (const [x, y, r] of bubbles) {
        g.beginPath();
        g.arc(px(x), py(y), r * h, 0, Math.PI * 2);
        finish(true, 0.4);
        g.beginPath();
        g.arc(px(x - r * 0.35), py(y - r * 0.35), r * 0.25 * h, 0, Math.PI * 2);
        g.fillStyle = "rgba(230,255,210,0.5)";
        g.fill();
      }
      break;
    }
    case "stun": {
      // dizzy ring of three small stars
      g.beginPath();
      g.ellipse(cx, py(0.15), 0.85 * h, 0.35 * h, 0, 0, Math.PI * 2);
      g.strokeStyle = rgba(col, 0.6);
      g.lineWidth = 0.4;
      g.stroke();
      const stars: [number, number, number][] = [[-0.6, 0, 0.32], [0.55, -0.1, 0.3], [0, 0.45, 0.36]];
      for (const [x, y, r] of stars) star(g, px(x), py(y), r * h, col);
      break;
    }
    case "haste": {
      // double chevron pointing right
      lines(0.85, [[-0.75, -0.7, -0.1, 0], [-0.1, 0, -0.75, 0.7], [0.05, -0.7, 0.7, 0], [0.7, 0, 0.05, 0.7]]);
      break;
    }
    case "shield": {
      shieldPath();
      finish();
      lines(0.3, [[0, -0.8, 0, 0.8]], "rgba(255,255,255,0.35)");
      break;
    }
    case "crack": {
      shieldPath();
      finish();
      lines(0.4, [[0.05, -0.95, -0.2, -0.3], [-0.2, -0.3, 0.2, 0.1], [0.2, 0.1, -0.05, 0.9]], "#140808");
      break;
    }
    case "heart": {
      g.beginPath();
      g.moveTo(px(0), py(0.95));
      g.bezierCurveTo(px(-1.1), py(0.1), px(-0.85), py(-0.95), px(0), py(-0.45));
      g.bezierCurveTo(px(0.85), py(-0.95), px(1.1), py(0.1), px(0), py(0.95));
      finish();
      break;
    }
    case "blade": {
      // upright blade with crossguard and grip
      poly([[0, -1], [0.22, -0.7], [0.22, 0.35], [-0.22, 0.35], [-0.22, -0.7]]);
      finish(true, 0.4);
      lines(0.5, [[-0.6, 0.42, 0.6, 0.42]], shade(col, 0.8));
      lines(0.4, [[0, 0.5, 0, 0.95]], shade(col, 0.6));
      break;
    }
    case "thorns": {
      const pts: number[][] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? 1 : 0.45;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
      }
      poly(pts);
      finish(true, 0.4);
      break;
    }
    case "shrine": {
      // small altar with a flame
      poly([[-0.7, 0.35], [0.7, 0.35], [0.7, 0.9], [-0.7, 0.9]]);
      finish(true, 0.4);
      poly([[-0.4, -0.05], [0.4, -0.05], [0.4, 0.35], [-0.4, 0.35]]);
      finish(true, 0.4);
      g.beginPath();
      g.moveTo(px(0), py(-0.15));
      g.bezierCurveTo(px(-0.4), py(-0.3), px(-0.2), py(-0.75), px(0), py(-1));
      g.bezierCurveTo(px(0.2), py(-0.75), px(0.4), py(-0.3), px(0), py(-0.15));
      g.fillStyle = "#ffe0a0";
      g.fill();
      break;
    }
    case "charm": {
      // hanging talisman: ring + gem
      g.beginPath();
      g.arc(cx, py(-0.7), 0.22 * h, 0, Math.PI * 2);
      g.strokeStyle = col;
      g.lineWidth = 0.4;
      g.stroke();
      poly([[0, -0.45], [0.55, 0.25], [0, 1], [-0.55, 0.25]]);
      finish();
      break;
    }
    default: {
      // rune: diamond with a carved mark
      poly([[0, -1], [0.75, 0], [0, 1], [-0.75, 0]]);
      finish();
      lines(0.35, [[0, -0.55, 0, 0.55], [-0.3, -0.15, 0.3, 0.15]], "rgba(20,14,10,0.9)");
    }
  }
  g.restore();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    if (i === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = col;
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.8)";
  g.lineWidth = 0.3;
  g.stroke();
}

export function fillRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
}

/** 1u outline drawn as four filled strips. */
export function frame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  g.fillStyle = col;
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x, y, 1, h);
  g.fillRect(x + w - 1, y, 1, h);
}

export function fmtSecs(t: number): string {
  return t >= 10 ? String(Math.round(t)) : t.toFixed(1);
}

// ---- small text (was a 3x5 pixel font; now the smooth serif skin face at a small size) ----
const MINI_SIZE = 6;

export function miniW(s: string): number {
  return s.length > 0 ? skinTextW(s.toUpperCase(), { size: MINI_SIZE, face: "display" }) : 0;
}

/** Small serif text; y is the top of the old 5u glyph box. */
export function miniText(g: CanvasRenderingContext2D, s: string, x: number, y: number, col: string, align: "left" | "center" | "right" = "left"): void {
  skinText(g, s.toUpperCase(), x, y - 0.6, { size: MINI_SIZE, face: "display", color: col, align });
}
