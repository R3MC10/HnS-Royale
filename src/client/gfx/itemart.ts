// Smooth, resolution-independent item art for the inventory (vector paths, gradients,
// devicePixelRatio-aware). Original designs: no external icon sets. Every drawer works in the
// item's own box (W x H css px) so icons fill their grid footprint; long weapons stand upright.
import { BASE_BY_ID } from "../../shared/content/bases";
import { itemCategory } from "../../shared/grid";
import { isFlask, type Item } from "../../shared/items";
import { lootDrawer } from "./lootart";
import { gemDrawer } from "./gemart";

type G = CanvasRenderingContext2D;

// ---- materials -----------------------------------------------------------------------------

function lin(g: G, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
function rad(g: G, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r));
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

const STEEL: [number, string][] = [[0, "#4b4f57"], [0.35, "#d9dee4"], [0.55, "#9aa1aa"], [1, "#3a3d44"]];
const DARK_STEEL: [number, string][] = [[0, "#2c2e33"], [0.4, "#8e949c"], [0.6, "#5c6168"], [1, "#222428"]];
const WOOD: [number, string][] = [[0, "#2e1c10"], [0.45, "#7b5432"], [1, "#3a2414"]];
const LEATHER: [number, string][] = [[0, "#2f1d12"], [0.5, "#8a5a36"], [1, "#3b2618"]];
const GOLD: [number, string][] = [[0, "#5c3f10"], [0.45, "#f0cf78"], [0.7, "#b48a34"], [1, "#4e360e"]];
const BONE: [number, string][] = [[0, "#6e6452"], [0.5, "#e6dcc4"], [1, "#857a64"]];

/** Cloth colours per defence category. */
const CLOTH: Record<string, [string, string]> = {
  ar: ["#3a3c42", "#8d939c"],
  ev: ["#2c3320", "#6e7a46"],
  es: ["#2a1f44", "#7158b8"],
  ar_ev: ["#3a2a1c", "#8a6a44"],
  ar_es: ["#3a2230", "#9a5a6e"],
  ev_es: ["#1d3236", "#4f8c8a"],
};

function outline(g: G, w = 1) {
  g.lineWidth = w;
  g.strokeStyle = "rgba(0,0,0,0.75)";
  g.stroke();
}

function shine(g: G, x: number, y: number, r: number, a = 0.55) {
  g.fillStyle = rad(g, x, y, r, [[0, `rgba(255,255,255,${a})`], [1, "rgba(255,255,255,0)"]]);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function glow(g: G, x: number, y: number, r: number, color: string) {
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = rad(g, x, y, r, [[0, color], [1, "rgba(0,0,0,0)"]]);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function rrect(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---- weapon parts ------------------------------------------------------------------------

/** Vertical straight blade from y0 (tip) to y1 (base), half-width hw. */
function blade(g: G, cx: number, y0: number, y1: number, hw: number, tip = hw * 2.2, dark = false) {
  g.beginPath();
  g.moveTo(cx, y0);
  g.lineTo(cx + hw, y0 + tip);
  g.lineTo(cx + hw, y1);
  g.lineTo(cx - hw, y1);
  g.lineTo(cx - hw, y0 + tip);
  g.closePath();
  g.fillStyle = lin(g, cx - hw, 0, cx + hw, 0, dark ? DARK_STEEL : STEEL);
  g.fill();
  outline(g);
  // fuller
  g.beginPath();
  g.moveTo(cx, y0 + tip * 1.2);
  g.lineTo(cx, y1 - hw * 0.6);
  g.lineWidth = Math.max(1, hw * 0.28);
  g.strokeStyle = "rgba(40,44,50,0.55)";
  g.stroke();
}

function haft(g: G, cx: number, y0: number, y1: number, hw: number, mat = WOOD) {
  rrect(g, cx - hw, y0, hw * 2, y1 - y0, hw);
  g.fillStyle = lin(g, cx - hw, 0, cx + hw, 0, mat);
  g.fill();
  outline(g);
}

function wraps(g: G, cx: number, y0: number, y1: number, hw: number) {
  g.strokeStyle = "rgba(20,10,4,0.65)";
  g.lineWidth = Math.max(1, hw * 0.35);
  for (let y = y0 + hw; y < y1 - hw * 0.5; y += hw * 1.4) {
    g.beginPath();
    g.moveTo(cx - hw, y);
    g.lineTo(cx + hw, y + hw * 0.6);
    g.stroke();
  }
}

function guard(g: G, cx: number, y: number, hw: number, hh: number, mat = GOLD) {
  rrect(g, cx - hw, y - hh, hw * 2, hh * 2, hh);
  g.fillStyle = lin(g, 0, y - hh, 0, y + hh, mat);
  g.fill();
  outline(g);
}

function pommel(g: G, cx: number, y: number, r: number, mat = GOLD) {
  g.beginPath();
  g.arc(cx, y, r, 0, Math.PI * 2);
  g.fillStyle = rad(g, cx - r * 0.3, y - r * 0.3, r * 1.4, mat);
  g.fill();
  outline(g);
}

function gemDot(g: G, x: number, y: number, r: number, color: string) {
  glow(g, x, y, r * 2.6, color + "88");
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = rad(g, x - r * 0.35, y - r * 0.35, r * 1.3, [[0, "#ffffff"], [0.3, color], [1, "#000000"]]);
  g.fill();
  outline(g, 0.8);
}

// ---- drawers -------------------------------------------------------------------------------

type Drawer = (g: G, W: number, H: number, item: Item) => void;

const swordLike = (long: number, wide: number, darkBlade = false): Drawer => (g, W, H) => {
  const cx = W / 2;
  const hw = Math.min(W * 0.16, H * 0.05) * wide;
  const bladeEnd = H * long;
  blade(g, cx, H * 0.05, bladeEnd, hw, hw * 2.4, darkBlade);
  guard(g, cx, bladeEnd + hw * 0.3, hw * 3.2, hw * 0.55);
  haft(g, cx, bladeEnd + hw * 0.8, H * 0.9, hw * 0.55, LEATHER);
  wraps(g, cx, bladeEnd + hw * 0.8, H * 0.9, hw * 0.55);
  pommel(g, cx, H * 0.92, hw * 0.85);
  shine(g, cx - hw * 0.4, H * 0.2, hw * 1.2, 0.35);
};

const axeLike = (double: boolean, big: boolean): Drawer => (g, W, H) => {
  const cx = W * (double ? 0.5 : 0.42);
  const hw = Math.max(1.5, W * 0.055);
  haft(g, cx, H * 0.06, H * 0.95, hw);
  const top = H * 0.08;
  const hh = H * (big ? 0.3 : 0.26);
  const reach = W * (double ? 0.42 : 0.5);
  const head = (dir: 1 | -1) => {
    g.beginPath();
    g.moveTo(cx + dir * hw, top + hh * 0.15);
    g.quadraticCurveTo(cx + dir * reach * 0.55, top + hh * 0.2, cx + dir * reach, top - hh * 0.05);
    g.quadraticCurveTo(cx + dir * reach * 0.82, top + hh * 0.55, cx + dir * reach, top + hh * 1.1);
    g.quadraticCurveTo(cx + dir * reach * 0.55, top + hh * 0.85, cx + dir * hw, top + hh * 0.85);
    g.closePath();
    g.fillStyle = lin(g, cx, 0, cx + dir * reach, 0, DARK_STEEL);
    g.fill();
    outline(g);
    // bright cutting edge
    g.beginPath();
    g.moveTo(cx + dir * reach, top - hh * 0.05);
    g.quadraticCurveTo(cx + dir * reach * 0.82, top + hh * 0.55, cx + dir * reach, top + hh * 1.1);
    g.lineWidth = Math.max(1.2, W * 0.03);
    g.strokeStyle = "rgba(230,236,240,0.85)";
    g.stroke();
  };
  head(1);
  if (double) head(-1);
  guard(g, cx, top + hh * 0.5, hw * 1.6, hh * 0.42, DARK_STEEL);
  pommel(g, cx, H * 0.95, hw * 1.2, DARK_STEEL);
};

const maceLike = (maul: boolean): Drawer => (g, W, H) => {
  const cx = W / 2;
  const hw = Math.max(1.5, W * 0.06);
  haft(g, cx, H * 0.2, H * 0.94, hw);
  wraps(g, cx, H * 0.7, H * 0.92, hw);
  if (maul) {
    const bw = W * 0.38;
    const bh = H * 0.18;
    rrect(g, cx - bw, H * 0.06, bw * 2, bh, bh * 0.15);
    g.fillStyle = lin(g, 0, H * 0.06, 0, H * 0.06 + bh, DARK_STEEL);
    g.fill();
    outline(g);
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 1;
    g.strokeRect(cx - bw * 0.85, H * 0.06 + bh * 0.2, bw * 1.7, bh * 0.6);
  } else {
    const r = Math.min(W * 0.3, H * 0.13);
    const cy = H * 0.16;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a - 0.25) * r * 0.8, cy + Math.sin(a - 0.25) * r * 0.8);
      g.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
      g.lineTo(cx + Math.cos(a + 0.25) * r * 0.8, cy + Math.sin(a + 0.25) * r * 0.8);
      g.closePath();
      g.fillStyle = "#6b7078";
      g.fill();
      outline(g, 0.8);
    }
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = rad(g, cx - r * 0.3, cy - r * 0.3, r * 1.3, DARK_STEEL);
    g.fill();
    outline(g);
    shine(g, cx - r * 0.35, cy - r * 0.35, r * 0.5, 0.5);
  }
  pommel(g, cx, H * 0.95, hw * 1.3, DARK_STEEL);
};

const spearArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  const hw = Math.max(1.5, W * 0.09);
  haft(g, cx, H * 0.2, H * 0.97, hw);
  const bw = W * 0.28;
  g.beginPath();
  g.moveTo(cx, H * 0.02);
  g.quadraticCurveTo(cx + bw, H * 0.12, cx + hw, H * 0.22);
  g.lineTo(cx - hw, H * 0.22);
  g.quadraticCurveTo(cx - bw, H * 0.12, cx, H * 0.02);
  g.fillStyle = lin(g, cx - bw, 0, cx + bw, 0, STEEL);
  g.fill();
  outline(g);
  guard(g, cx, H * 0.225, hw * 1.6, hw * 0.7, DARK_STEEL);
  for (const y of [0.55, 0.6]) guard(g, cx, H * y, hw * 1.15, hw * 0.35, LEATHER);
};

const sceptreArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  const hw = Math.max(1.5, W * 0.09);
  haft(g, cx, H * 0.25, H * 0.94, hw, GOLD);
  const r = Math.min(W * 0.32, H * 0.11);
  const cy = H * 0.16;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    g.lineTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
    g.lineTo(cx + Math.cos(a + Math.PI / 6) * r * 0.7, cy + Math.sin(a + Math.PI / 6) * r * 0.7);
  }
  g.closePath();
  g.fillStyle = lin(g, cx - r, cy - r, cx + r, cy + r, GOLD);
  g.fill();
  outline(g);
  gemDot(g, cx, cy, r * 0.45, "#c03030");
  guard(g, cx, H * 0.27, hw * 1.8, hw * 0.5);
  pommel(g, cx, H * 0.95, hw * 1.2);
};

const wandArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  g.beginPath();
  g.moveTo(cx - W * 0.03, H * 0.12);
  g.lineTo(cx + W * 0.03, H * 0.12);
  g.lineTo(cx + W * 0.09, H * 0.92);
  g.lineTo(cx - W * 0.09, H * 0.92);
  g.closePath();
  g.fillStyle = lin(g, cx - W * 0.1, 0, cx + W * 0.1, 0, BONE);
  g.fill();
  outline(g);
  wraps(g, cx, H * 0.7, H * 0.9, W * 0.08);
  glow(g, cx, H * 0.1, W * 0.45, "rgba(150,120,255,0.75)");
  gemDot(g, cx, H * 0.1, W * 0.12, "#9a7cff");
};

const staffArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  const hw = Math.max(1.5, W * 0.06);
  g.beginPath();
  g.moveTo(cx - hw, H * 0.18);
  g.bezierCurveTo(cx - hw * 3, H * 0.4, cx + hw * 2, H * 0.6, cx - hw, H * 0.97);
  g.lineTo(cx + hw, H * 0.97);
  g.bezierCurveTo(cx + hw * 3.5, H * 0.6, cx - hw, H * 0.4, cx + hw, H * 0.18);
  g.closePath();
  g.fillStyle = lin(g, cx - hw * 3, 0, cx + hw * 3, 0, WOOD);
  g.fill();
  outline(g);
  // claw cradle + crystal
  g.strokeStyle = lin(g, cx - W * 0.25, 0, cx + W * 0.25, 0, WOOD);
  g.lineWidth = hw * 1.3;
  g.lineCap = "round";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx, H * 0.2);
    g.quadraticCurveTo(cx + s * W * 0.3, H * 0.15, cx + s * W * 0.12, H * 0.04);
    g.stroke();
  }
  g.lineCap = "butt";
  glow(g, cx, H * 0.12, W * 0.5, "rgba(80,170,255,0.7)");
  g.beginPath();
  g.moveTo(cx, H * 0.03);
  g.lineTo(cx + W * 0.1, H * 0.12);
  g.lineTo(cx, H * 0.2);
  g.lineTo(cx - W * 0.1, H * 0.12);
  g.closePath();
  g.fillStyle = lin(g, cx - W * 0.1, H * 0.03, cx + W * 0.1, H * 0.2, [[0, "#e8f6ff"], [0.5, "#58a8f0"], [1, "#1a3a78"]]);
  g.fill();
  outline(g);
};

const quarterstaffArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  const hw = Math.max(1.5, W * 0.07);
  haft(g, cx, H * 0.03, H * 0.97, hw);
  for (const y of [0.03, 0.94]) guard(g, cx, H * (y + 0.015), hw * 1.25, H * 0.03, DARK_STEEL);
  for (const y of [0.42, 0.58]) guard(g, cx, H * y, hw * 1.2, hw * 0.45, LEATHER);
  wraps(g, cx, H * 0.43, H * 0.57, hw);
};

const bowArt: Drawer = (g, W, H) => {
  const x0 = W * 0.32;
  const top = H * 0.04;
  const bot = H * 0.96;
  const bulge = W * 0.36;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x0, top);
  g.bezierCurveTo(x0 + bulge * 1.3, H * 0.25, x0 + bulge * 1.3, H * 0.75, x0, bot);
  g.lineWidth = Math.max(3, W * 0.1);
  g.strokeStyle = "rgba(0,0,0,0.8)";
  g.stroke();
  g.lineWidth = Math.max(2, W * 0.07);
  g.strokeStyle = lin(g, x0, 0, x0 + bulge, 0, WOOD);
  g.stroke();
  // string
  g.beginPath();
  g.moveTo(x0, top);
  g.lineTo(x0, bot);
  g.lineWidth = 1;
  g.strokeStyle = "rgba(230,220,190,0.85)";
  g.stroke();
  // grip
  guard(g, x0 + bulge * 0.97, H * 0.5, W * 0.05, H * 0.07, LEATHER);
  g.lineCap = "butt";
};

const crossbowArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  haft(g, cx, H * 0.12, H * 0.95, W * 0.09);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(W * 0.06, H * 0.36);
  g.quadraticCurveTo(cx, H * 0.08, W * 0.94, H * 0.36);
  g.lineWidth = Math.max(3, W * 0.08);
  g.strokeStyle = "rgba(0,0,0,0.8)";
  g.stroke();
  g.lineWidth = Math.max(2, W * 0.055);
  g.strokeStyle = lin(g, 0, 0, W, 0, DARK_STEEL);
  g.stroke();
  g.beginPath();
  g.moveTo(W * 0.06, H * 0.36);
  g.lineTo(cx, H * 0.46);
  g.lineTo(W * 0.94, H * 0.36);
  g.lineWidth = 1;
  g.strokeStyle = "rgba(230,220,190,0.85)";
  g.stroke();
  g.lineCap = "butt";
  // bolt
  g.beginPath();
  g.moveTo(cx, H * 0.04);
  g.lineTo(cx, H * 0.46);
  g.lineWidth = 2;
  g.strokeStyle = "#cfd4da";
  g.stroke();
  guard(g, cx, H * 0.62, W * 0.05, H * 0.04, DARK_STEEL);
};

const clawArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  rrect(g, W * 0.3, H * 0.55, W * 0.4, H * 0.32, W * 0.06);
  g.fillStyle = lin(g, W * 0.3, 0, W * 0.7, 0, LEATHER);
  g.fill();
  outline(g);
  for (const dx of [-0.18, 0, 0.18]) {
    const x = cx + W * dx;
    g.beginPath();
    g.moveTo(x - W * 0.05, H * 0.57);
    g.quadraticCurveTo(x - W * 0.05, H * 0.2, x + W * 0.12, H * 0.06);
    g.quadraticCurveTo(x + W * 0.04, H * 0.3, x + W * 0.05, H * 0.57);
    g.closePath();
    g.fillStyle = lin(g, x - W * 0.05, 0, x + W * 0.1, 0, STEEL);
    g.fill();
    outline(g);
  }
};

const shieldArt = (shape: "buckler" | "round" | "kite" | "tower"): Drawer => (g, W, H, item) => {
  const cx = W / 2;
  const def = BASE_BY_ID.get(item.b)?.def ?? "ar";
  const [d, l] = CLOTH[def] ?? CLOTH.ar;
  g.beginPath();
  if (shape === "buckler" || shape === "round") {
    const r = Math.min(W, H) * (shape === "buckler" ? 0.38 : 0.44);
    g.arc(cx, H / 2, r, 0, Math.PI * 2);
  } else if (shape === "kite") {
    g.moveTo(W * 0.1, H * 0.1);
    g.quadraticCurveTo(cx, H * 0.02, W * 0.9, H * 0.1);
    g.quadraticCurveTo(W * 0.92, H * 0.55, cx, H * 0.97);
    g.quadraticCurveTo(W * 0.08, H * 0.55, W * 0.1, H * 0.1);
  } else {
    g.moveTo(W * 0.1, H * 0.12);
    g.quadraticCurveTo(cx, H * 0.02, W * 0.9, H * 0.12);
    g.lineTo(W * 0.9, H * 0.94);
    g.lineTo(W * 0.1, H * 0.94);
    g.closePath();
  }
  g.fillStyle = lin(g, 0, 0, W, H, [[0, l], [0.6, d], [1, "#111"]]);
  g.fill();
  g.lineWidth = Math.max(2, W * 0.05);
  g.strokeStyle = lin(g, 0, 0, W, H, shape === "buckler" ? LEATHER : DARK_STEEL);
  g.stroke();
  outline(g, 0.8);
  // emblem / boss
  if (shape === "buckler" || shape === "round") {
    const r = Math.min(W, H) * 0.13;
    g.beginPath();
    g.arc(cx, H / 2, r, 0, Math.PI * 2);
    g.fillStyle = rad(g, cx - r * 0.3, H / 2 - r * 0.3, r * 1.4, DARK_STEEL);
    g.fill();
    outline(g);
    shine(g, cx - r * 0.3, H / 2 - r * 0.3, r * 0.6, 0.6);
  } else {
    g.beginPath();
    g.moveTo(cx, H * 0.2);
    g.lineTo(cx, H * 0.75);
    g.moveTo(W * 0.28, H * 0.4);
    g.lineTo(W * 0.72, H * 0.4);
    g.lineWidth = Math.max(2, W * 0.07);
    g.strokeStyle = lin(g, 0, 0, W, 0, GOLD);
    g.stroke();
  }
};

const focusArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  const cy = H * 0.42;
  const r = Math.min(W, H) * 0.28;
  // cradle
  g.beginPath();
  g.moveTo(cx - r * 1.1, cy + r * 0.4);
  g.quadraticCurveTo(cx, cy + r * 2.2, cx + r * 1.1, cy + r * 0.4);
  g.lineTo(cx + r * 0.3, H * 0.92);
  g.lineTo(cx - r * 0.3, H * 0.92);
  g.closePath();
  g.fillStyle = lin(g, cx - r, 0, cx + r, 0, GOLD);
  g.fill();
  outline(g);
  glow(g, cx, cy, r * 2.2, "rgba(170,120,255,0.55)");
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = rad(g, cx - r * 0.4, cy - r * 0.4, r * 1.5, [[0, "#f4ecff"], [0.3, "#a888f0"], [0.8, "#3a2370"], [1, "#150a2a"]]);
  g.fill();
  outline(g);
};

const quiverArt: Drawer = (g, W, H) => {
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(0.18);
  const w = W * 0.36;
  const h = H * 0.62;
  // arrows
  for (const dx of [-0.5, 0, 0.5]) {
    const x = dx * w * 0.6;
    g.beginPath();
    g.moveTo(x, -h * 0.5);
    g.lineTo(x, -h * 0.78);
    g.lineWidth = 1.5;
    g.strokeStyle = "#7b5432";
    g.stroke();
    g.beginPath();
    g.moveTo(x, -h * 0.82);
    g.lineTo(x + w * 0.16, -h * 0.68);
    g.lineTo(x, -h * 0.72);
    g.lineTo(x - w * 0.16, -h * 0.68);
    g.closePath();
    g.fillStyle = "#c8c0a8";
    g.fill();
    outline(g, 0.6);
  }
  rrect(g, -w / 2, -h / 2, w, h, w * 0.25);
  g.fillStyle = lin(g, -w / 2, 0, w / 2, 0, LEATHER);
  g.fill();
  outline(g);
  for (const y of [-0.3, 0.3]) guard(g, 0, h * y, w * 0.52, h * 0.03, GOLD);
  g.restore();
};

const helmetArt = (kind: string): Drawer => (g, W, H) => {
  const cx = W / 2;
  const r = Math.min(W, H) * 0.38;
  const cy = H * 0.55;
  if (kind === "circlet") {
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.4, 0, 0, Math.PI * 2);
    g.lineWidth = Math.max(2.5, W * 0.07);
    g.strokeStyle = lin(g, 0, 0, W, 0, GOLD);
    g.stroke();
    gemDot(g, cx, cy + r * 0.4, r * 0.16, "#5aa8ff");
    return;
  }
  const hood = kind === "hood";
  const coif = kind === "coif";
  g.beginPath();
  if (hood) {
    g.moveTo(cx, H * 0.08);
    g.quadraticCurveTo(cx + r * 1.4, H * 0.25, cx + r * 1.05, H * 0.92);
    g.lineTo(cx - r * 1.05, H * 0.92);
    g.quadraticCurveTo(cx - r * 1.4, H * 0.25, cx, H * 0.08);
  } else {
    g.arc(cx, cy, r, Math.PI, 0);
    g.lineTo(cx + r, H * (kind === "helm_great" ? 0.9 : 0.78));
    g.lineTo(cx - r, H * (kind === "helm_great" ? 0.9 : 0.78));
    g.closePath();
  }
  g.fillStyle = hood
    ? lin(g, 0, 0, W, H, [[0, "#4a4636"], [0.6, "#24221a"], [1, "#0e0d0a"]])
    : coif
      ? lin(g, 0, 0, W, H, LEATHER)
      : lin(g, cx - r, 0, cx + r, 0, STEEL);
  g.fill();
  outline(g);
  if (hood) {
    g.beginPath();
    g.ellipse(cx, H * 0.6, r * 0.55, r * 0.6, 0, 0, Math.PI * 2);
    g.fillStyle = "#050404";
    g.fill();
  } else if (kind === "helm_great") {
    g.fillStyle = "#0b0b0d";
    g.fillRect(cx - r * 0.75, cy - r * 0.05, r * 1.5, r * 0.14);
    g.fillRect(cx - r * 0.06, cy - r * 0.05, r * 0.12, r * 0.6);
  } else if (!coif) {
    g.fillStyle = lin(g, cx - r * 0.08, 0, cx + r * 0.08, 0, DARK_STEEL);
    g.fillRect(cx - r * 0.08, cy - r * 0.4, r * 0.16, r * 0.95);
  } else {
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 1;
    for (let y = cy - r * 0.6; y < H * 0.78; y += r * 0.2) {
      g.beginPath();
      g.moveTo(cx - r, y);
      g.lineTo(cx + r, y);
      g.stroke();
    }
  }
  if (kind === "helm_horned") {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * r * 0.8, cy - r * 0.3);
      g.quadraticCurveTo(cx + s * r * 1.6, cy - r * 0.5, cx + s * r * 1.3, cy - r * 1.4);
      g.quadraticCurveTo(cx + s * r * 1.2, cy - r * 0.7, cx + s * r * 0.7, cy - r * 0.65);
      g.closePath();
      g.fillStyle = lin(g, 0, cy - r * 1.4, 0, cy, BONE);
      g.fill();
      outline(g);
    }
  }
  if (!hood) shine(g, cx - r * 0.4, cy - r * 0.5, r * 0.4, 0.45);
};

const bodyArt: Drawer = (g, W, H, item) => {
  const b = BASE_BY_ID.get(item.b);
  const def = b?.def ?? "ev";
  const look = b?.look ?? "";
  const [d, l] = CLOTH[def] ?? CLOTH.ev;
  const cx = W / 2;
  const robe = look.includes("robe");
  g.beginPath();
  g.moveTo(cx - W * 0.18, H * 0.06);
  g.lineTo(cx - W * 0.44, H * 0.16);
  g.lineTo(cx - W * 0.46, H * 0.48);
  g.lineTo(cx - W * 0.32, H * 0.5);
  g.lineTo(cx - W * (robe ? 0.4 : 0.32), H * (robe ? 0.96 : 0.86));
  g.lineTo(cx + W * (robe ? 0.4 : 0.32), H * (robe ? 0.96 : 0.86));
  g.lineTo(cx + W * 0.32, H * 0.5);
  g.lineTo(cx + W * 0.46, H * 0.48);
  g.lineTo(cx + W * 0.44, H * 0.16);
  g.lineTo(cx + W * 0.18, H * 0.06);
  g.quadraticCurveTo(cx, H * 0.16, cx - W * 0.18, H * 0.06);
  g.closePath();
  g.fillStyle = lin(g, 0, 0, W, 0, [[0, d], [0.45, l], [1, d]]);
  g.fill();
  outline(g);
  if (look === "body_plate" || look === "body_plate_robe" || look === "body_mail") {
    g.fillStyle = lin(g, cx - W * 0.28, 0, cx + W * 0.28, 0, look === "body_mail" ? DARK_STEEL : STEEL);
    rrect(g, cx - W * 0.28, H * 0.16, W * 0.56, H * 0.36, W * 0.1);
    g.fill();
    outline(g);
    shine(g, cx - W * 0.1, H * 0.26, W * 0.15, 0.45);
  }
  if (look.includes("scale") || look === "body_brigandine") {
    g.fillStyle = "rgba(0,0,0,0.25)";
    for (let y = H * 0.2; y < H * 0.8; y += H * 0.06)
      for (let x = cx - W * 0.26; x < cx + W * 0.26; x += W * 0.12) {
        g.beginPath();
        g.arc(x + ((y / (H * 0.06)) % 2) * W * 0.06, y, W * 0.05, 0, Math.PI);
        g.fill();
      }
  }
  // belt line
  g.fillStyle = lin(g, 0, 0, W, 0, LEATHER);
  g.fillRect(cx - W * 0.33, H * 0.55, W * 0.66, H * 0.05);
  guard(g, cx, H * 0.575, W * 0.05, H * 0.03);
};

const glovesArt: Drawer = (g, W, H, item) => {
  const look = BASE_BY_ID.get(item.b)?.look ?? "gloves_leather";
  const mat = look === "gloves_gauntlet" ? STEEL : look === "gloves_silk" ? ([[0, "#2a1f44"], [0.5, "#8a72cc"], [1, "#2a1f44"]] as [number, string][]) : LEATHER;
  const cx = W / 2;
  g.beginPath();
  g.moveTo(cx - W * 0.22, H * 0.92);
  g.lineTo(cx - W * 0.24, H * 0.52);
  g.lineTo(cx - W * 0.4, H * 0.38); // thumb
  g.quadraticCurveTo(cx - W * 0.42, H * 0.3, cx - W * 0.32, H * 0.3);
  g.lineTo(cx - W * 0.2, H * 0.38);
  g.lineTo(cx - W * 0.22, H * 0.12);
  for (let i = 0; i < 4; i++) {
    const x = cx - W * 0.22 + i * W * 0.12;
    g.quadraticCurveTo(x + W * 0.06, H * (0.04 + (i === 1 || i === 2 ? 0 : 0.04)), x + W * 0.12, H * 0.12);
  }
  g.lineTo(cx + W * 0.26, H * 0.92);
  g.closePath();
  g.fillStyle = lin(g, cx - W * 0.3, 0, cx + W * 0.3, 0, mat);
  g.fill();
  outline(g);
  g.fillStyle = lin(g, 0, 0, W, 0, look === "gloves_gauntlet" ? DARK_STEEL : LEATHER);
  rrect(g, cx - W * 0.27, H * 0.7, W * 0.56, H * 0.12, 3);
  g.fill();
  outline(g, 0.8);
  if (look === "gloves_wrap") wraps(g, cx, H * 0.3, H * 0.7, W * 0.22);
};

const bootsArt: Drawer = (g, W, H, item) => {
  const look = BASE_BY_ID.get(item.b)?.look ?? "boots_soft";
  const mat = look === "boots_greave" ? STEEL : look === "boots_slipper" ? ([[0, "#2a1f44"], [0.5, "#8a72cc"], [1, "#2a1f44"]] as [number, string][]) : LEATHER;
  const top = look === "boots_slipper" ? 0.4 : 0.08;
  g.beginPath();
  g.moveTo(W * 0.3, H * top);
  g.lineTo(W * 0.62, H * top);
  g.lineTo(W * 0.62, H * 0.6);
  g.quadraticCurveTo(W * 0.92, H * 0.66, W * 0.92, H * 0.86);
  g.lineTo(W * 0.92, H * 0.92);
  g.lineTo(W * 0.24, H * 0.92);
  g.lineTo(W * 0.26, H * 0.6);
  g.closePath();
  g.fillStyle = lin(g, W * 0.24, 0, W * 0.92, 0, mat);
  g.fill();
  outline(g);
  g.fillStyle = "#1a120c";
  g.fillRect(W * 0.24, H * 0.88, W * 0.68, H * 0.05);
  if (look === "boots_wrap") wraps(g, W * 0.46, H * 0.12, H * 0.6, W * 0.16);
  if (look !== "boots_slipper") guard(g, W * 0.46, H * (top + 0.04), W * 0.18, H * 0.04, look === "boots_greave" ? DARK_STEEL : LEATHER);
};

const beltArt: Drawer = (g, W, H, item) => {
  const look = BASE_BY_ID.get(item.b)?.look ?? "belt_leather";
  const y = H * 0.3;
  const h = H * 0.4;
  rrect(g, W * 0.03, y, W * 0.94, h, h * 0.3);
  g.fillStyle = lin(g, 0, y, 0, y + h, look === "belt_rope" ? WOOD : look === "belt_chain" ? DARK_STEEL : LEATHER);
  g.fill();
  outline(g);
  if (look === "belt_studded") for (let x = W * 0.1; x < W * 0.9; x += W * 0.1) shine(g, x, y + h / 2, h * 0.15, 0.8);
  if (look === "belt_chain") {
    g.strokeStyle = "rgba(220,226,232,0.6)";
    g.lineWidth = 1;
    for (let x = W * 0.08; x < W * 0.92; x += W * 0.06) {
      g.beginPath();
      g.ellipse(x, y + h / 2, W * 0.03, h * 0.3, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  rrect(g, W * 0.42, y - h * 0.15, W * 0.16, h * 1.3, 2);
  g.lineWidth = Math.max(2, h * 0.18);
  g.strokeStyle = lin(g, 0, 0, W, 0, GOLD);
  g.stroke();
};

const ringArt: Drawer = (g, W, H, item) => {
  const cx = W / 2;
  const cy = H * 0.58;
  const r = Math.min(W, H) * 0.28;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.lineWidth = Math.max(2.5, r * 0.32);
  g.strokeStyle = "rgba(0,0,0,0.8)";
  g.stroke();
  g.lineWidth = Math.max(1.8, r * 0.22);
  g.strokeStyle = lin(g, cx - r, cy - r, cx + r, cy + r, item.b.includes("tarnished") ? DARK_STEEL : GOLD);
  g.stroke();
  const colors = ["#d04040", "#4080e0", "#40c080", "#e0c040", "#c060e0"];
  gemDot(g, cx, cy - r, r * 0.35, colors[item.b.length % colors.length]);
};

const amuletArt: Drawer = (g, W, H, item) => {
  const cx = W / 2;
  g.beginPath();
  g.moveTo(W * 0.12, H * 0.08);
  g.quadraticCurveTo(cx, H * 0.7, W * 0.88, H * 0.08);
  g.lineWidth = 1.2;
  g.strokeStyle = lin(g, 0, 0, W, 0, GOLD);
  g.stroke();
  const colors = ["#e07a2a", "#58b8e0", "#9ad060", "#d04070", "#e0d070"];
  const r = Math.min(W, H) * 0.17;
  g.beginPath();
  g.moveTo(cx, H * 0.48);
  g.lineTo(cx + r, H * 0.48 + r * 1.1);
  g.lineTo(cx, H * 0.48 + r * 2.4);
  g.lineTo(cx - r, H * 0.48 + r * 1.1);
  g.closePath();
  g.fillStyle = lin(g, cx - r, 0, cx + r, 0, GOLD);
  g.fill();
  outline(g);
  gemDot(g, cx, H * 0.48 + r * 1.15, r * 0.5, colors[item.b.length % colors.length]);
};

const flaskArt: Drawer = (g, W, H, item) => {
  const cx = W / 2;
  const nw = W * 0.18;
  const bw = W * 0.4;
  const neckTop = H * 0.14;
  const bodyTop = H * 0.38;
  g.beginPath();
  g.moveTo(cx - nw, neckTop);
  g.lineTo(cx - nw, bodyTop);
  g.quadraticCurveTo(cx - bw * 1.1, bodyTop + H * 0.05, cx - bw, H * 0.62);
  g.quadraticCurveTo(cx - bw, H * 0.94, cx, H * 0.94);
  g.quadraticCurveTo(cx + bw, H * 0.94, cx + bw, H * 0.62);
  g.quadraticCurveTo(cx + bw * 1.1, bodyTop + H * 0.05, cx + nw, bodyTop);
  g.lineTo(cx + nw, neckTop);
  g.closePath();
  g.fillStyle = "rgba(160,190,200,0.16)";
  g.fill();
  g.save();
  g.clip();
  const fill = Math.max(0.1, Math.min(1, (item.c ?? 30) / 60));
  const ly = H * 0.94 - (H * 0.94 - bodyTop) * fill;
  g.fillStyle = lin(g, 0, ly, 0, H, [[0, "#ff5a4a"], [0.4, "#b0141a"], [1, "#4a0508"]]);
  g.fillRect(0, ly, W, H);
  g.restore();
  outline(g, 1.2);
  g.strokeStyle = "rgba(220,240,255,0.35)";
  g.lineWidth = 1;
  g.stroke();
  shine(g, cx - bw * 0.45, H * 0.6, bw * 0.3, 0.5);
  rrect(g, cx - nw * 1.2, H * 0.05, nw * 2.4, H * 0.1, 2);
  g.fillStyle = lin(g, 0, 0, W, 0, WOOD);
  g.fill();
  outline(g, 0.8);
};

const gemArt: Drawer = (g, W, H, item) => {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.36;
  const colors = ["#d04040", "#40b060", "#4070e0"];
  const c = colors[item.b.length % 3];
  glow(g, cx, cy, r * 1.6, c + "77");
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fillStyle = rad(g, cx - r * 0.3, cy - r * 0.4, r * 1.5, [[0, "#ffffff"], [0.25, c], [1, "#080808"]]);
  g.fill();
  outline(g);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
    g.lineTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
  }
  g.closePath();
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 1;
  g.stroke();
};

const emberArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  const cy = H * 0.55;
  const r = Math.min(W, H) * 0.32;
  glow(g, cx, cy, r * 1.9, "rgba(255,120,30,0.7)");
  g.beginPath();
  g.moveTo(cx, cy - r * 1.25);
  g.bezierCurveTo(cx + r * 1.2, cy - r * 0.2, cx + r * 0.9, cy + r, cx, cy + r);
  g.bezierCurveTo(cx - r * 0.9, cy + r, cx - r * 1.2, cy - r * 0.2, cx, cy - r * 1.25);
  g.fillStyle = rad(g, cx, cy + r * 0.3, r * 1.4, [[0, "#fff4c0"], [0.35, "#ffb030"], [0.75, "#c0400c"], [1, "#3a0e04"]]);
  g.fill();
  outline(g, 0.8);
};

const charmArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  const cy = H * 0.55;
  const r = Math.min(W, H) * 0.28;
  g.beginPath();
  g.moveTo(cx, H * 0.06);
  g.lineTo(cx, cy - r);
  g.lineWidth = 1;
  g.strokeStyle = "#c8b080";
  g.stroke();
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx + r, cy);
  g.lineTo(cx, cy + r * 1.2);
  g.lineTo(cx - r, cy);
  g.closePath();
  g.fillStyle = lin(g, cx - r, cy - r, cx + r, cy + r, BONE);
  g.fill();
  outline(g);
  gemDot(g, cx, cy + r * 0.05, r * 0.32, "#7fc8a8");
};

const runeArt: Drawer = (g, W, H) => {
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.36;
  rrect(g, cx - r, cy - r, r * 2, r * 2, r * 0.4);
  g.fillStyle = lin(g, 0, cy - r, 0, cy + r, [[0, "#6a6a70"], [1, "#2a2a30"]]);
  g.fill();
  outline(g);
  glow(g, cx, cy, r, "rgba(120,200,255,0.5)");
  g.beginPath();
  g.moveTo(cx - r * 0.4, cy - r * 0.5);
  g.lineTo(cx + r * 0.1, cy);
  g.lineTo(cx - r * 0.4, cy + r * 0.5);
  g.moveTo(cx + r * 0.35, cy - r * 0.55);
  g.lineTo(cx + r * 0.35, cy + r * 0.55);
  g.lineWidth = Math.max(1.5, r * 0.14);
  g.strokeStyle = "#bfe8ff";
  g.stroke();
};

const genericArt: Drawer = (g, W, H) => {
  const s = Math.min(W, H) * 0.6;
  rrect(g, (W - s) / 2, (H - s) / 2, s, s, s * 0.2);
  g.fillStyle = lin(g, 0, 0, W, H, BONE);
  g.fill();
  outline(g);
};

const BY_LOOK: Record<string, Drawer> = {
  sword_short: swordLike(0.6, 1),
  sword_long: swordLike(0.66, 1.1),
  greatsword: swordLike(0.68, 1.45),
  dagger: swordLike(0.52, 1.05),
  axe_hand: axeLike(false, false),
  greataxe: axeLike(true, true),
  mace: maceLike(false),
  maul: maceLike(true),
  claw: clawArt,
  spear: spearArt,
  sceptre: sceptreArt,
  wand: wandArt,
  quarterstaff: quarterstaffArt,
  staff: staffArt,
  bow: bowArt,
  crossbow: crossbowArt,
  shield_buckler: shieldArt("buckler"),
  shield_round: shieldArt("round"),
  shield_kite: shieldArt("kite"),
  shield_tower: shieldArt("tower"),
  focus_orb: focusArt,
  quiver: quiverArt,
};

const BY_CLASS: Record<string, Drawer> = {
  body: bodyArt,
  gloves: glovesArt,
  boots: bootsArt,
  belt: beltArt,
  ring: ringArt,
  amulet: amuletArt,
};

function drawerFor(item: Item): Drawer {
  if (isFlask(item)) return flaskArt;
  const loot = lootDrawer(item); // Embers / runes / ichors / charms / jewels (gfx/lootart.ts)
  if (loot) return loot;
  const gem = gemDrawer(item); // skill / support gems, rough crystals (gfx/gemart.ts)
  if (gem) return gem;
  const cat = itemCategory(item);
  if (cat === "gem") return gemArt;
  if (cat === "currency" || cat === "essence") return emberArt;
  if (cat === "charm") return charmArt;
  if (cat === "rune" || cat === "jewel") return cat === "jewel" ? gemArt : runeArt;
  const b = BASE_BY_ID.get(item.b);
  if (!b) return genericArt;
  if (b.cls === "helmet") return helmetArt(b.look ?? "helm_open");
  if (b.look && BY_LOOK[b.look]) return BY_LOOK[b.look];
  if (b.cls === "weapon") return BY_LOOK[b.weapon?.kind ?? ""] ?? BY_LOOK.sword_long;
  if (b.cls === "offhand") return BY_LOOK.shield_round;
  return BY_CLASS[b.cls] ?? genericArt;
}

/** Draw `item` into a fresh canvas of w x h css px, rendered at devicePixelRatio. */
export function itemArtCanvas(item: Item, w: number, h: number): HTMLCanvasElement {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  cv.style.width = w + "px";
  cv.style.height = h + "px";
  // Draw the art on its own layer, then composite it once with a soft drop shadow.
  const art = document.createElement("canvas");
  art.width = cv.width;
  art.height = cv.height;
  const a = art.getContext("2d")!;
  a.imageSmoothingEnabled = true;
  a.imageSmoothingQuality = "high";
  a.scale(dpr, dpr);
  const pad = Math.min(w, h) * 0.06;
  a.translate(pad, pad);
  try {
    drawerFor(item)(a, w - pad * 2, h - pad * 2, item);
  } catch {
    genericArt(a, w - pad * 2, h - pad * 2, item);
  }
  const g = cv.getContext("2d")!;
  g.shadowColor = "rgba(0,0,0,0.7)";
  g.shadowBlur = Math.min(w, h) * 0.08 * dpr;
  g.shadowOffsetY = Math.min(w, h) * 0.03 * dpr;
  g.drawImage(art, 0, 0);
  return cv;
}
