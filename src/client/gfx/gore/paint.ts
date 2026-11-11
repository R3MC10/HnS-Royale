// Ground painters. Each draws in WORLD-PLANE coordinates centred on (0, 0) (1 unit = 1 world unit,
// +x / +y = world axes); the caller sets up the ground affine so circles come out as the angled
// camera's ellipses. Shapes are seeded so a live pool and its baked copy match exactly.
import { MATS, seeded, type Mat } from "./core";
import { paintedDecal, paintedPool, paintedSmear, paintedSplat } from "./painted";

type G = CanvasRenderingContext2D;

/** "#rrggbb" -> rgba() string with alpha a. */
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Irregular soft blob path (closed) of radius r. */
export function blobPath(g: G, r: number, rand: () => number, lobes = 11, rough = 0.35, cx = 0, cy = 0) {
  const n = lobes;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - rough / 2 + rand() * rough;
    pts.push(cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k);
  }
  g.beginPath();
  const mx = (pts[2 * n - 2] + pts[0]) / 2;
  const my = (pts[2 * n - 1] + pts[1]) / 2;
  g.moveTo(mx, my);
  for (let i = 0; i < n; i++) {
    const x = pts[2 * i];
    const y = pts[2 * i + 1];
    const j = (i + 1) % n;
    g.quadraticCurveTo(x, y, (x + pts[2 * j]) / 2, (y + pts[2 * j + 1]) / 2);
  }
  g.closePath();
}

/** Teardrop pointing along +x from (x, y): length l, width w. */
function tear(g: G, x: number, y: number, ang: number, l: number, w: number) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const tx = x + c * l;
  const ty = y + s * l;
  g.beginPath();
  g.moveTo(x - s * w, y + c * w);
  g.quadraticCurveTo(x + c * l * 0.55 - s * w * 0.7, y + s * l * 0.55 + c * w * 0.7, tx, ty);
  g.quadraticCurveTo(x + c * l * 0.55 + s * w * 0.7, y + s * l * 0.55 - c * w * 0.7, x + s * w, y - c * w);
  g.arc(x, y, w, ang + Math.PI / 2, ang - Math.PI / 2);
  g.fill();
}

/**
 * Splatter: wet core blob, a darker inner clot, satellite drops and streaks thrown along (dx, dy).
 * r = core radius, power 0..1 = how violent (more / longer streaks).
 */
export function paintSplat(g: G, mat: Mat, r: number, dx: number, dy: number, seed: number, power = 0.5, alpha = 1) {
  if (paintedSplat(g, mat, r, dx, dy, seed, power, alpha)) return;
  const m = MATS[mat];
  const rand = seeded(seed);
  const dir = Math.atan2(dy, dx);
  const hasDir = dx * dx + dy * dy > 0.01;
  g.globalAlpha = alpha * 0.92;
  // Core: shifted a little along the throw, elongated.
  g.save();
  g.rotate(dir);
  g.scale(1 + power * 0.6, 1);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.1);
  grad.addColorStop(0, m.dark);
  grad.addColorStop(0.55, m.wet);
  grad.addColorStop(1, m.drop[1]);
  g.fillStyle = grad;
  blobPath(g, r, rand, 9 + ((rand() * 5) | 0), 0.55);
  g.fill();
  g.restore();
  // Satellites and streaks.
  g.fillStyle = m.wet;
  const n = 4 + Math.round(power * 10 + rand() * 4);
  for (let i = 0; i < n; i++) {
    const a = hasDir ? dir + (rand() - 0.5) * (1.2 + (1 - power) * 2.4) : rand() * Math.PI * 2;
    const d = r * (0.9 + rand() * (1.4 + power * 2.2));
    const w = r * (0.06 + rand() * 0.16);
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    if (rand() < 0.45 + power * 0.3) tear(g, x * 0.6, y * 0.6, a, d * 0.5 * (0.5 + rand()), w);
    else {
      g.beginPath();
      g.arc(x, y, w * 1.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Fine mist ring
  g.globalAlpha = alpha * 0.55;
  g.fillStyle = m.drop[0];
  const mist = 6 + Math.round(power * 14);
  for (let i = 0; i < mist; i++) {
    const a = hasDir ? dir + (rand() - 0.5) * 2.2 : rand() * Math.PI * 2;
    const d = r * (1.2 + rand() * (2 + power * 3));
    g.beginPath();
    g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.25 + rand() * 0.55, 0, Math.PI * 2);
    g.fill();
  }
  // Wet highlight
  if (m.gloss !== "rgba(0,0,0,0)" && r > 2) {
    g.globalAlpha = alpha * 0.7;
    g.fillStyle = m.gloss;
    g.beginPath();
    g.ellipse(-r * 0.25, -r * 0.3, r * 0.35, r * 0.12, -0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Pool: a big glossy irregular puddle (growth k 0..1). */
export function paintPool(g: G, mat: Mat, R: number, seed: number, k = 1, t = 0, alpha = 1) {
  const m = MATS[mat];
  const r = R * (0.15 + 0.85 * Math.sqrt(Math.min(1, k)));
  if (paintedPool(g, mat, r, seed, alpha)) return;
  const rand = seeded(seed);
  g.globalAlpha = alpha;
  // Rim: a soft halo soaking into the soil (wet colour feathering out to nothing, not a flat bright
  // ring); then the deep body. Same rand consumption as before so live and baked pools still match.
  const halo = g.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.14);
  halo.addColorStop(0, m.wet);
  halo.addColorStop(0.7, hexA(m.wet, 0.55));
  halo.addColorStop(1, hexA(m.dark, 0));
  g.fillStyle = halo;
  blobPath(g, r * 1.14, rand, 13, 0.42);
  g.fill();
  const rand2 = seeded(seed);
  const grad = g.createRadialGradient(r * 0.1, r * 0.1, 0, 0, 0, r);
  grad.addColorStop(0, m.dark);
  grad.addColorStop(0.75, m.dark);
  grad.addColorStop(1, m.wet);
  g.fillStyle = grad;
  blobPath(g, r * 0.96, rand2, 13, 0.42);
  g.fill();
  // Side lobes
  const lobes = 2 + ((rand() * 3) | 0);
  for (let i = 0; i < lobes; i++) {
    const a = rand() * Math.PI * 2;
    const d = r * (0.7 + rand() * 0.3);
    g.fillStyle = m.wet;
    blobPath(g, r * (0.25 + rand() * 0.2), rand, 8, 0.4, Math.cos(a) * d, Math.sin(a) * d);
    g.fill();
  }
  // Specular sheen (only while fresh / wet)
  if (m.gloss !== "rgba(0,0,0,0)") {
    g.globalAlpha = alpha * (0.5 + 0.2 * Math.sin(t * 1.3));
    g.strokeStyle = m.gloss;
    g.lineWidth = Math.max(0.6, r * 0.05);
    g.lineCap = "round";
    g.beginPath();
    g.ellipse(-r * 0.15, -r * 0.2, r * 0.55, r * 0.3, -0.7, Math.PI * 1.05, Math.PI * 1.55);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/** Long smear along (dx, dy) of the given length (a body sliding / a gib skidding). */
export function paintSmear(g: G, mat: Mat, len: number, w: number, dx: number, dy: number, seed: number, alpha = 1) {
  const m = MATS[mat];
  const rand = seeded(seed);
  g.save();
  g.rotate(Math.atan2(dy, dx));
  if (paintedSmear(g, mat, len, w, seed, alpha)) {
    g.restore();
    return;
  }
  const grad = g.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, m.wet);
  grad.addColorStop(0.7, m.dark);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.globalAlpha = alpha * 0.85;
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, -w);
  for (let i = 1; i <= 6; i++) g.lineTo((len * i) / 6, -w * (1 - i / 7) * (0.7 + rand() * 0.5));
  for (let i = 6; i >= 1; i--) g.lineTo((len * i) / 6, w * (1 - i / 7) * (0.7 + rand() * 0.5));
  g.lineTo(0, w);
  g.arc(0, 0, w, Math.PI / 2, -Math.PI / 2);
  g.fill();
  // drag streaks
  g.strokeStyle = m.dark;
  g.lineWidth = 0.4;
  for (let i = 0; i < 4; i++) {
    const y = (rand() - 0.5) * w * 1.4;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(len * (0.5 + rand() * 0.5), y * 0.4);
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 1;
}

/** Bloody footprint (boot sole) facing angle `ang`. */
export function paintFootprint(g: G, mat: Mat, ang: number, seed: number, alpha = 0.7) {
  const m = MATS[mat];
  const rand = seeded(seed);
  g.save();
  g.rotate(ang);
  g.globalAlpha = alpha * (0.6 + rand() * 0.4);
  g.fillStyle = m.wet;
  g.beginPath();
  g.ellipse(1.6, 0, 3.2, 1.5, 0, 0, Math.PI * 2); // fore sole
  g.fill();
  g.beginPath();
  g.ellipse(-2.6, 0, 1.6, 1.25, 0, 0, Math.PI * 2); // heel
  g.fill();
  g.fillStyle = m.dark;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(2.5 - i * 1.4, (rand() - 0.5) * 1.2, 0.35, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.globalAlpha = 1;
}

/** Fire death: soot / scorch with a burnt rim. */
export function paintScorch(g: G, r: number, seed: number, alpha = 1) {
  if (paintedDecal(g, "scorch", r * 0.95, seed, alpha)) return;
  const rand = seeded(seed);
  g.globalAlpha = alpha;
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, "rgba(8,6,5,0.95)");
  grad.addColorStop(0.55, "rgba(22,16,12,0.8)");
  grad.addColorStop(0.85, "rgba(60,34,18,0.35)");
  grad.addColorStop(1, "rgba(60,34,18,0)");
  g.fillStyle = grad;
  blobPath(g, r, rand, 12, 0.45);
  g.fill();
  g.fillStyle = "rgba(10,8,6,0.8)";
  for (let i = 0; i < 10; i++) {
    const a = rand() * Math.PI * 2;
    const d = r * (0.8 + rand() * 0.6);
    g.beginPath();
    g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.4 + rand() * 1.2, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Lightning death: branching burnt Lichtenberg figure. */
export function paintLichtenberg(g: G, r: number, seed: number, alpha = 1) {
  const rand = seeded(seed);
  g.globalAlpha = alpha;
  g.lineCap = "round";
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    if (depth > 4 || len < 1.5) return;
    let cx = x;
    let cy = y;
    g.lineWidth = w;
    g.strokeStyle = depth < 2 ? "rgba(12,10,14,0.85)" : "rgba(30,24,26,0.6)";
    g.beginPath();
    g.moveTo(cx, cy);
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 0.9;
      cx += (Math.cos(a) * len) / steps;
      cy += (Math.sin(a) * len) / steps;
      g.lineTo(cx, cy);
      if (rand() < 0.35) branch(cx, cy, a + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.6), len * 0.55, w * 0.6, depth + 1);
    }
    g.stroke();
  };
  const arms = 5 + ((rand() * 3) | 0);
  for (let i = 0; i < arms; i++) branch(0, 0, (i / arms) * Math.PI * 2 + rand() * 0.5, r * (0.6 + rand() * 0.5), 1.2, 0);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.4);
  grad.addColorStop(0, "rgba(6,6,8,0.9)");
  grad.addColorStop(1, "rgba(6,6,8,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

/** Cold death: frost rime with ice crystals, plus some frozen blood. */
export function paintFrost(g: G, r: number, seed: number, alpha = 1) {
  if (paintedDecal(g, "frost", r * 0.9, seed, alpha * 0.9)) return;
  const rand = seeded(seed);
  g.globalAlpha = alpha * 0.55;
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, "rgba(220,245,255,0.9)");
  grad.addColorStop(0.6, "rgba(150,205,235,0.5)");
  grad.addColorStop(1, "rgba(150,205,235,0)");
  g.fillStyle = grad;
  blobPath(g, r, rand, 10, 0.5);
  g.fill();
  g.globalAlpha = alpha;
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * 0.9;
    const s = 0.8 + rand() * 2.2;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    const b = rand() * Math.PI;
    g.fillStyle = rand() < 0.5 ? "#e8f8ff" : "#a8daf2";
    g.beginPath();
    g.moveTo(x + Math.cos(b) * s, y + Math.sin(b) * s);
    g.lineTo(x + Math.cos(b + 2.2) * s * 0.4, y + Math.sin(b + 2.2) * s * 0.4);
    g.lineTo(x - Math.cos(b) * s, y - Math.sin(b) * s);
    g.lineTo(x + Math.cos(b - 2.2) * s * 0.4, y + Math.sin(b - 2.2) * s * 0.4);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
}

/** Spirit residue: faint glowing ectoplasm stain. */
export function paintEcto(g: G, r: number, seed: number, alpha = 1) {
  const rand = seeded(seed);
  g.globalAlpha = alpha * 0.6;
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, "rgba(140,255,225,0.55)");
  grad.addColorStop(0.6, "rgba(50,160,140,0.35)");
  grad.addColorStop(1, "rgba(20,80,70,0)");
  g.fillStyle = grad;
  blobPath(g, r, rand, 10, 0.6);
  g.fill();
  g.globalAlpha = 1;
}
