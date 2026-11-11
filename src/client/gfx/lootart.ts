// Smooth, anti-aliased icons for the loot agent's items: Embers (currency), runes, ichors (essences),
// charms and jewels, each with its own colour and emblem so stacks are told apart at a glance.
// itemart.ts asks `lootDrawer(item)` first; null falls back to its generic art.
import { CHARM_BY_ID } from "../../shared/content/charms";
import { CURRENCY_BY_ID } from "../../shared/content/currency";
import { ESSENCE_BY_ID } from "../../shared/content/essences";
import { FLASK_BASE_BY_ID } from "../../shared/content/flasks";
import { JEWEL_BASE_BY_ID } from "../../shared/content/jewels";
import { RUNE_BY_ID } from "../../shared/content/runes";
import type { Item } from "../../shared/items";

type G = CanvasRenderingContext2D;
export type LootDrawer = (g: G, W: number, H: number, item: Item) => void;

function rad(g: G, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r));
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
function lin(g: G, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
function glow(g: G, x: number, y: number, r: number, col: string) {
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = rad(g, x, y, r, [[0, col], [1, "rgba(0,0,0,0)"]]);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
function edge(g: G, w = 0.9, col = "rgba(10,6,4,0.85)") {
  g.lineWidth = w;
  g.strokeStyle = col;
  g.lineJoin = "round";
  g.stroke();
}

// ---- Embers -------------------------------------------------------------------------------------

interface EmberStyle {
  hot: string;
  mid: string;
  dark: string;
  glow: string;
  emblem: string;
}
const EMBER: Record<string, EmberStyle> = {
  cur_kindling: { hot: "#fff2c4", mid: "#ff9a2e", dark: "#5a1a06", glow: "rgba(255,130,40,0.55)", emblem: "spark" },
  cur_stoking: { hot: "#d8ecff", mid: "#5a8cff", dark: "#0c1440", glow: "rgba(90,140,255,0.5)", emblem: "plus" },
  cur_crowning: { hot: "#fff8d0", mid: "#f0c040", dark: "#4a3006", glow: "rgba(255,210,80,0.55)", emblem: "crown" },
  cur_blazing: { hot: "#ffffff", mid: "#ffd27a", dark: "#7a2a04", glow: "rgba(255,200,120,0.75)", emblem: "star" },
  cur_shifting: { hot: "#ffe0f4", mid: "#c060d8", dark: "#2a0832", glow: "rgba(200,100,230,0.5)", emblem: "swirl" },
  cur_quenching: { hot: "#e8fbff", mid: "#7ccfe0", dark: "#0a2a34", glow: "rgba(130,210,230,0.45)", emblem: "minus" },
  cur_tempering: { hot: "#fffbe8", mid: "#e8d8a8", dark: "#4a3a18", glow: "rgba(255,240,190,0.65)", emblem: "scales" },
  cur_forgeheart: { hot: "#fff0d0", mid: "#ff6a2a", dark: "#3a0804", glow: "rgba(255,90,30,0.65)", emblem: "anvil" },
  cur_honing: { hot: "#f4f6f8", mid: "#a8b0bc", dark: "#262a30", glow: "rgba(200,210,230,0.4)", emblem: "edge" },
  cur_boring: { hot: "#f8e8d8", mid: "#b88a60", dark: "#2e1a0c", glow: "rgba(220,170,120,0.45)", emblem: "hole" },
  cur_blighted: { hot: "#e8ffd0", mid: "#7a3a9a", dark: "#140418", glow: "rgba(150,230,90,0.5)", emblem: "eye" },
  // Rarity / crafting pass: chance and per-class quality Embers (reuse the existing emblems).
  cur_gambit: { hot: "#fff4e0", mid: "#d8873a", dark: "#3a1606", glow: "rgba(216,135,58,0.6)", emblem: "star" },
  cur_inscribing: { hot: "#f0e8ff", mid: "#9a88d8", dark: "#1e1638", glow: "rgba(170,150,240,0.45)", emblem: "edge" },
  cur_riveting: { hot: "#f0f0ec", mid: "#8c8a80", dark: "#24221c", glow: "rgba(200,200,180,0.4)", emblem: "anvil" },
  cur_glazing: { hot: "#e8fff4", mid: "#70c8a0", dark: "#0a2a1c", glow: "rgba(120,220,170,0.45)", emblem: "plus" },
  cur_polish: { hot: "#e8f8ff", mid: "#60b0e0", dark: "#082030", glow: "rgba(100,190,240,0.5)", emblem: "spark" },
};
/** Greater (_g) / perfect (_p) Ember variants draw as their basic Ember. */
const emberStyle = (b: string): EmberStyle | undefined => EMBER[b] ?? EMBER[b.replace(/_(g|p)$/, "")];

function emblem(g: G, kind: string, cx: number, cy: number, r: number) {
  g.save();
  g.strokeStyle = "rgba(30,10,4,0.75)";
  g.fillStyle = "rgba(30,10,4,0.72)";
  g.lineWidth = Math.max(1, r * 0.16);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  switch (kind) {
    case "spark":
      g.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
      g.fill();
      break;
    case "plus":
      g.moveTo(cx - r * 0.4, cy);
      g.lineTo(cx + r * 0.4, cy);
      g.moveTo(cx, cy - r * 0.4);
      g.lineTo(cx, cy + r * 0.4);
      g.stroke();
      break;
    case "minus":
      g.moveTo(cx - r * 0.45, cy);
      g.lineTo(cx + r * 0.45, cy);
      g.stroke();
      break;
    case "crown":
      g.moveTo(cx - r * 0.5, cy + r * 0.3);
      g.lineTo(cx - r * 0.5, cy - r * 0.25);
      g.lineTo(cx - r * 0.22, cy + r * 0.02);
      g.lineTo(cx, cy - r * 0.4);
      g.lineTo(cx + r * 0.22, cy + r * 0.02);
      g.lineTo(cx + r * 0.5, cy - r * 0.25);
      g.lineTo(cx + r * 0.5, cy + r * 0.3);
      g.closePath();
      g.fill();
      break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.2 : r * 0.5;
        if (i) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      break;
    case "swirl":
      for (let t = 0; t <= 1; t += 0.04) {
        const a = t * Math.PI * 3.2;
        const rr = r * 0.05 + t * r * 0.45;
        if (t) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else g.moveTo(cx, cy);
      }
      g.stroke();
      break;
    case "scales":
      g.moveTo(cx, cy - r * 0.45);
      g.lineTo(cx, cy + r * 0.4);
      g.moveTo(cx - r * 0.45, cy - r * 0.2);
      g.lineTo(cx + r * 0.45, cy - r * 0.2);
      g.stroke();
      g.beginPath();
      g.arc(cx - r * 0.38, cy + r * 0.05, r * 0.14, 0, Math.PI);
      g.arc(cx + r * 0.38, cy + r * 0.05, r * 0.14, 0, Math.PI);
      g.fill();
      break;
    case "anvil":
      g.moveTo(cx - r * 0.55, cy - r * 0.25);
      g.lineTo(cx + r * 0.45, cy - r * 0.25);
      g.lineTo(cx + r * 0.2, cy);
      g.lineTo(cx + r * 0.25, cy + r * 0.35);
      g.lineTo(cx - r * 0.25, cy + r * 0.35);
      g.lineTo(cx - r * 0.2, cy);
      g.closePath();
      g.fill();
      break;
    case "edge":
      g.moveTo(cx - r * 0.45, cy + r * 0.35);
      g.lineTo(cx + r * 0.45, cy - r * 0.35);
      g.stroke();
      break;
    case "hole":
      g.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.fillStyle = "rgba(0,0,0,0.85)";
      g.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
      g.fill();
      break;
    case "eye":
      g.moveTo(cx - r * 0.5, cy);
      g.quadraticCurveTo(cx, cy - r * 0.42, cx + r * 0.5, cy);
      g.quadraticCurveTo(cx, cy + r * 0.42, cx - r * 0.5, cy);
      g.stroke();
      g.beginPath();
      g.fillStyle = "#c8ff70";
      g.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
      g.fill();
      break;
  }
  g.restore();
}

const emberIcon: LootDrawer = (g, W, H, item) => {
  const st = emberStyle(item.b) ?? EMBER.cur_kindling;
  const cx = W / 2;
  const cy = H * 0.56;
  const r = Math.min(W, H) * 0.31;
  glow(g, cx, cy, r * 1.9, st.glow);
  // Flame-shaped coal.
  g.beginPath();
  g.moveTo(cx + r * 0.1, cy - r * 1.3);
  g.bezierCurveTo(cx + r * 0.5, cy - r * 0.8, cx + r * 1.15, cy - r * 0.3, cx + r * 0.95, cy + r * 0.45);
  g.bezierCurveTo(cx + r * 0.8, cy + r * 1.05, cx - r * 0.8, cy + r * 1.05, cx - r * 0.95, cy + r * 0.45);
  g.bezierCurveTo(cx - r * 1.1, cy - r * 0.15, cx - r * 0.5, cy - r * 0.45, cx - r * 0.25, cy - r * 0.95);
  g.quadraticCurveTo(cx - r * 0.1, cy - r * 0.55, cx + r * 0.1, cy - r * 1.3);
  g.closePath();
  g.fillStyle = rad(g, cx - r * 0.15, cy + r * 0.1, r * 1.35, [[0, st.hot], [0.4, st.mid], [1, st.dark]]);
  g.fill();
  edge(g);
  // Specular.
  g.beginPath();
  g.ellipse(cx - r * 0.4, cy - r * 0.05, r * 0.16, r * 0.3, -0.4, 0, Math.PI * 2);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fill();
  emblem(g, st.emblem, cx + r * 0.05, cy + r * 0.3, r * 0.75);
};

const awlIcon: LootDrawer = (g, W, H) => {
  const s = Math.min(W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-Math.PI / 4);
  glow(g, 0, -s * 0.28, s * 0.25, "rgba(150,220,255,0.5)");
  // Needle.
  g.beginPath();
  g.moveTo(0, -s * 0.46);
  g.lineTo(s * 0.035, -s * 0.05);
  g.lineTo(-s * 0.035, -s * 0.05);
  g.closePath();
  g.fillStyle = lin(g, -s * 0.04, 0, s * 0.04, 0, [[0, "#5a606a"], [0.5, "#eef2f6"], [1, "#4a4f58"]]);
  g.fill();
  edge(g, 0.7);
  // Ferrule + handle.
  g.beginPath();
  g.rect(-s * 0.07, -s * 0.06, s * 0.14, s * 0.07);
  g.fillStyle = lin(g, -s * 0.07, 0, s * 0.07, 0, [[0, "#5c3f10"], [0.5, "#f0cf78"], [1, "#4e360e"]]);
  g.fill();
  edge(g, 0.7);
  g.beginPath();
  g.ellipse(0, s * 0.2, s * 0.1, s * 0.2, 0, 0, Math.PI * 2);
  g.fillStyle = lin(g, -s * 0.1, 0, s * 0.1, 0, [[0, "#2e1c10"], [0.5, "#8b5e36"], [1, "#2e1c10"]]);
  g.fill();
  edge(g, 0.8);
  // A tiny cut gem at the tip.
  g.beginPath();
  g.arc(0, -s * 0.44, s * 0.035, 0, Math.PI * 2);
  g.fillStyle = "#bff0ff";
  g.fill();
  g.restore();
};

// ---- Runes --------------------------------------------------------------------------------------

/** Glyph strokes on a unit square (-1..1), and the glow colour. */
const RUNE_GLYPH: Record<string, { col: string; lines: [number, number][][] }> = {
  rune_rootbound: { col: "#7fd060", lines: [[[0, -0.8], [0, 0.8]], [[0, 0.3], [-0.5, 0.8]], [[0, 0.3], [0.5, 0.8]], [[0, -0.3], [-0.4, -0.7]]] },
  rune_quickwater: { col: "#60c8ff", lines: [[[-0.6, -0.4], [-0.2, 0], [0.2, -0.4], [0.6, 0]], [[-0.6, 0.3], [-0.2, 0.7], [0.2, 0.3], [0.6, 0.7]]] },
  rune_hearthstone: { col: "#ff8a40", lines: [[[-0.6, 0.7], [0, -0.7], [0.6, 0.7], [-0.6, 0.7]], [[0, 0.1], [0, 0.5]]] },
  rune_stillmind: { col: "#a8a0ff", lines: [[[-0.6, 0], [0.6, 0]], [[0, -0.7], [0, 0.7]], [[-0.45, -0.45], [0.45, 0.45]]] },
  rune_gale: { col: "#d0f0f0", lines: [[[-0.7, -0.5], [0.4, -0.5], [0.6, -0.2]], [[-0.7, 0], [0.6, 0]], [[-0.7, 0.5], [0.3, 0.5], [0.5, 0.75]]] },
  rune_bramble: { col: "#a0d050", lines: [[[-0.7, 0.7], [0.7, -0.7]], [[-0.3, 0.3], [-0.6, -0.1]], [[0.1, -0.1], [0.5, 0.3]], [[0.3, -0.3], [0, -0.7]]] },
  rune_hoarfrost: { col: "#b0e8ff", lines: [[[0, -0.8], [0, 0.8]], [[-0.7, -0.4], [0.7, 0.4]], [[-0.7, 0.4], [0.7, -0.4]]] },
  rune_brimstone: { col: "#ffb030", lines: [[[-0.5, 0.7], [-0.5, -0.2], [0, -0.7], [0.5, -0.2], [0.5, 0.7]], [[-0.5, 0.2], [0.5, 0.2]]] },
  rune_kingsblood: { col: "#ff4a4a", lines: [[[-0.6, 0.6], [-0.6, -0.3], [-0.2, 0.1], [0, -0.6], [0.2, 0.1], [0.6, -0.3], [0.6, 0.6], [-0.6, 0.6]]] },
  rune_duskglass: { col: "#c070ff", lines: [[[0, -0.8], [0.6, 0], [0, 0.8], [-0.6, 0], [0, -0.8]], [[0, -0.3], [0, 0.3]]] },
};

const runeIcon: LootDrawer = (g, W, H, item) => {
  const gl = RUNE_GLYPH[item.b] ?? RUNE_GLYPH.rune_rootbound;
  const cx = W / 2;
  const cy = H / 2;
  const s = Math.min(W, H) * 0.36;
  // Rounded river stone.
  g.beginPath();
  g.moveTo(cx - s * 0.8, cy - s * 0.9);
  g.bezierCurveTo(cx - s * 0.2, cy - s * 1.15, cx + s * 0.6, cy - s * 1.05, cx + s * 0.9, cy - s * 0.6);
  g.bezierCurveTo(cx + s * 1.1, cy, cx + s * 1.0, cy + s * 0.8, cx + s * 0.6, cy + s * 1.0);
  g.bezierCurveTo(cx, cy + s * 1.2, cx - s * 0.8, cy + s * 1.05, cx - s * 1.0, cy + s * 0.6);
  g.bezierCurveTo(cx - s * 1.15, cy, cx - s * 1.1, cy - s * 0.65, cx - s * 0.8, cy - s * 0.9);
  g.closePath();
  g.fillStyle = rad(g, cx - s * 0.35, cy - s * 0.4, s * 1.7, [[0, "#9a948c"], [0.55, "#5a5650"], [1, "#24221f"]]);
  g.fill();
  edge(g, 1);
  // Glowing glyph.
  g.save();
  g.translate(cx, cy);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.shadowColor = gl.col;
  g.shadowBlur = s * 0.5;
  g.strokeStyle = gl.col;
  g.lineWidth = Math.max(1.2, s * 0.14);
  for (const line of gl.lines) {
    g.beginPath();
    line.forEach(([x, y], i) => (i ? g.lineTo(x * s * 0.62, y * s * 0.62) : g.moveTo(x * s * 0.62, y * s * 0.62)));
    g.stroke();
  }
  g.shadowBlur = 0;
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = Math.max(0.5, s * 0.05);
  for (const line of gl.lines) {
    g.beginPath();
    line.forEach(([x, y], i) => (i ? g.lineTo(x * s * 0.62, y * s * 0.62) : g.moveTo(x * s * 0.62, y * s * 0.62)));
    g.stroke();
  }
  g.restore();
};

// ---- Ichors (essences) --------------------------------------------------------------------------

const ICHOR_COL: Record<string, string> = {
  vital: "#e0303a",
  swift: "#40d0a0",
  keen: "#e8e8f0",
  wrath: "#ff6a20",
  restless: "#f0d040",
  lucid: "#4070ff",
  verdant: "#60c040",
  eel: "#30a8b8",
  incant: "#b060ff",
};

const ichorIcon: LootDrawer = (g, W, H, item) => {
  const fam = item.b.replace(/^ess_/, "").replace(/_(potent|faint|primeval)$/, "");
  const col = ICHOR_COL[fam] ?? "#d07fd0";
  const potent = item.b.endsWith("_potent") || item.b.endsWith("_primeval");
  const cx = W / 2;
  const s = Math.min(W, H);
  const by = H * 0.62;
  const r = s * 0.27;
  if (potent) glow(g, cx, by, r * 2, col + "99");
  // Teardrop vial: neck, cork, bulb.
  g.beginPath();
  g.rect(cx - s * 0.07, H * 0.14, s * 0.14, s * 0.24);
  g.fillStyle = "rgba(200,220,230,0.35)";
  g.fill();
  edge(g, 0.8);
  g.beginPath();
  g.rect(cx - s * 0.09, H * 0.08, s * 0.18, s * 0.09);
  g.fillStyle = lin(g, cx - s * 0.09, 0, cx + s * 0.09, 0, [[0, "#3a2414"], [0.5, "#9a6a40"], [1, "#3a2414"]]);
  g.fill();
  edge(g, 0.8);
  g.beginPath();
  g.arc(cx, by, r, 0, Math.PI * 2);
  g.fillStyle = rad(g, cx - r * 0.3, by - r * 0.3, r * 1.3, [[0, "#ffffff"], [0.25, col], [1, "#0a0608"]]);
  g.fill();
  edge(g, 1);
  // Swirl inside.
  g.beginPath();
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = Math.max(0.8, r * 0.1);
  g.arc(cx + r * 0.1, by + r * 0.05, r * 0.5, 0.6, 3.6);
  g.stroke();
  g.beginPath();
  g.ellipse(cx - r * 0.4, by - r * 0.4, r * 0.14, r * 0.24, -0.6, 0, Math.PI * 2);
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fill();
};

// ---- Charms -------------------------------------------------------------------------------------

const CHARM_STYLE: Record<string, { col: string; shape: "tooth" | "disc" | "knot" | "leaf" | "spike" | "drop" | "weight" }> = {
  chm_thawstone: { col: "#9adcff", shape: "disc" },
  chm_anchor: { col: "#8a8f98", shape: "weight" },
  chm_lastbreath: { col: "#e8e0ff", shape: "drop" },
  chm_harefoot: { col: "#d8b080", shape: "leaf" },
  chm_bristle: { col: "#9a7040", shape: "spike" },
  chm_mender: { col: "#70d070", shape: "knot" },
  chm_gildtooth: { col: "#f0c850", shape: "tooth" },
};

const charmIcon: LootDrawer = (g, W, H, item) => {
  const st = CHARM_STYLE[item.b] ?? { col: "#7fc8a8", shape: "disc" as const };
  const cx = W / 2;
  const cy = H * 0.6;
  const r = Math.min(W, H) * 0.27;
  // Cord.
  g.beginPath();
  g.moveTo(cx - r * 0.9, H * 0.06);
  g.quadraticCurveTo(cx, cy - r * 1.6, cx + r * 0.9, H * 0.06);
  g.lineWidth = Math.max(1, r * 0.09);
  g.strokeStyle = "#8a6a40";
  g.stroke();
  g.beginPath();
  g.arc(cx, cy - r * 1.05, r * 0.16, 0, Math.PI * 2);
  g.fillStyle = "#c8a860";
  g.fill();
  const body = rad(g, cx - r * 0.3, cy - r * 0.3, r * 1.5, [[0, "#ffffff"], [0.3, st.col], [1, "#140e08"]]);
  g.beginPath();
  switch (st.shape) {
    case "tooth":
      g.moveTo(cx - r * 0.6, cy - r * 0.8);
      g.quadraticCurveTo(cx, cy - r * 1.05, cx + r * 0.6, cy - r * 0.8);
      g.quadraticCurveTo(cx + r * 0.4, cy + r * 0.2, cx, cy + r * 1.1);
      g.quadraticCurveTo(cx - r * 0.4, cy + r * 0.2, cx - r * 0.6, cy - r * 0.8);
      break;
    case "drop":
      g.moveTo(cx, cy - r * 0.95);
      g.bezierCurveTo(cx + r * 0.9, cy, cx + r * 0.8, cy + r, cx, cy + r);
      g.bezierCurveTo(cx - r * 0.8, cy + r, cx - r * 0.9, cy, cx, cy - r * 0.95);
      break;
    case "leaf":
      g.moveTo(cx, cy - r);
      g.quadraticCurveTo(cx + r * 1.0, cy, cx, cy + r);
      g.quadraticCurveTo(cx - r * 1.0, cy, cx, cy - r);
      break;
    case "spike":
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        const rr = i % 2 ? r * 0.6 : r;
        if (i) g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else g.moveTo(cx + rr, cy);
      }
      break;
    case "weight":
      g.moveTo(cx - r * 0.45, cy - r * 0.75);
      g.lineTo(cx + r * 0.45, cy - r * 0.75);
      g.lineTo(cx + r * 0.9, cy + r * 0.85);
      g.lineTo(cx - r * 0.9, cy + r * 0.85);
      break;
    case "knot":
      g.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
      break;
    default:
      g.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
  }
  g.closePath();
  g.fillStyle = body;
  g.fill();
  edge(g, 1);
  if (st.shape === "knot") {
    g.beginPath();
    g.strokeStyle = "rgba(20,40,10,0.7)";
    g.lineWidth = Math.max(1, r * 0.14);
    g.moveTo(cx - r * 0.5, cy - r * 0.5);
    g.bezierCurveTo(cx + r * 0.6, cy - r * 0.2, cx - r * 0.6, cy + r * 0.2, cx + r * 0.5, cy + r * 0.5);
    g.stroke();
  }
  if (st.shape === "disc") {
    g.beginPath();
    g.strokeStyle = "rgba(255,255,255,0.75)";
    g.lineWidth = Math.max(0.8, r * 0.08);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      g.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
      g.lineTo(cx - Math.cos(a) * r * 0.55, cy - Math.sin(a) * r * 0.55);
    }
    g.stroke();
  }
  // Charge pips: brightness by fill.
  const def = CHARM_BY_ID.get(item.b);
  if (def) {
    const frac = Math.max(0, Math.min(1, (item.c ?? 0) / def.maxCharges));
    glow(g, cx, cy, r * (0.6 + frac), `rgba(255,255,255,${0.1 + 0.4 * frac})`);
  }
};

// ---- Jewels -------------------------------------------------------------------------------------

const jewelIcon: LootDrawer = (g, W, H, item) => {
  const col = JEWEL_BASE_BY_ID.get(item.b)?.color ?? "#c8323c";
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.34;
  glow(g, cx, cy, r * 1.6, col + "88");
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = rad(g, cx - r * 0.3, cy - r * 0.35, r * 1.4, [[0, "#ffffff"], [0.3, col], [1, "#08040a"]]);
  g.fill();
  edge(g, 1);
  // Facets: inner table + spokes.
  const inner = pts.map(([x, y]) => [cx + (x - cx) * 0.5, cy + (y - cy) * 0.5] as [number, number]);
  g.beginPath();
  inner.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 0.7;
  g.stroke();
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    g.moveTo(inner[i][0], inner[i][1]);
    g.lineTo(pts[i][0], pts[i][1]);
  }
  g.stroke();
};

/** The drawer for a loot-agent item, or null for anything else. */
export function lootDrawer(item: Item): LootDrawer | null {
  if (item.b === "cur_awl") return awlIcon;
  if (CURRENCY_BY_ID.has(item.b)) return emberIcon;
  if (RUNE_BY_ID.has(item.b)) return runeIcon;
  if (ESSENCE_BY_ID.has(item.b)) return ichorIcon;
  if (CHARM_BY_ID.has(item.b)) return charmIcon;
  if (JEWEL_BASE_BY_ID.has(item.b)) return jewelIcon;
  return null;
}

// ---- ground label style (worldui) ----------------------------------------------------------------
// Label colours follow the loot filter convention: gear by rarity, fixed colours per family
// (Embers amber, runes steel, ichors violet, gems teal, flasks/charms muted), a rarity-tinted border
// for rare/unique and valuable currency, and a slightly larger label for the best drops.

/** RARITY_COLORS from shared/content/loot, duplicated to keep this module free of the loot tables. */
const GEAR_RARITY = ["#e8e8e8", "#8a9cff", "#ffe066", "#d8873a"];

export interface LabelStyle {
  /** Text colour. */
  text: string;
  /** 1px border colour (null = neutral bronze rim). */
  border: string | null;
  /** Box fill. */
  bg: string;
  /** Font scale (1 = normal). */
  scale: number;
}

export function labelStyle(item: Item): LabelStyle {
  const r = Math.max(0, Math.min(3, item.r | 0));
  const bg = "rgba(10,8,7,0.86)";
  const cur = CURRENCY_BY_ID.get(item.b);
  if (cur) {
    const valuable = cur.weight <= 4;
    return { text: "#d8a050", border: valuable ? "#d8a050" : null, bg, scale: valuable ? 1.15 : 1 };
  }
  if (RUNE_BY_ID.has(item.b)) return { text: "#9fb8c8", border: null, bg, scale: 1 };
  if (ESSENCE_BY_ID.has(item.b)) return { text: "#c88ac8", border: "#c88ac8", bg, scale: 1 };
  if (item.b.startsWith("gem")) return { text: "#4fb0a0", border: r >= 2 ? "#4fb0a0" : null, bg, scale: 1 };
  if (CHARM_BY_ID.has(item.b) && r === 0) return { text: "#9cb89a", border: null, bg, scale: 1 };
  if (FLASK_BASE_BY_ID.has(item.b) && r === 0) return { text: "#c4b49a", border: null, bg, scale: 1 };
  const text = GEAR_RARITY[r];
  return { text, border: r >= 2 ? text : null, bg: r === 3 ? "rgba(18,10,4,0.9)" : bg, scale: r === 3 ? 1.15 : 1 };
}
