// Screen-edge blood ("blood on the lens"): when the local player is hit hard, painterly splats land
// on the screen edges, thin drips run down from them, and a feathered, noisy dark-arterial vignette
// creeps in from the borders. Everything fades quickly. The splats keep clear of the HUD's minimap
// and life / mana globes. Drawn in device pixels on the final canvas after the world is composited.
import { getHudLayout } from "../../hud/layout";
import { goreAmount, seeded } from "./core";

const STAMPS = 10;
const SZ = 384;
interface StampMeta {
  dir: number; // spray direction baked into the stamp (radians)
  rim: { x: number; y: number }[]; // body outline samples (fraction of SZ, centre-relative) for drip anchors
}
let stamps: HTMLCanvasElement[] | null = null;
let metas: StampMeta[] = [];
let vigCv: HTMLCanvasElement | null = null;

/** Canvas filter (blur) if supported: soft feathered edges on the pre-built stamps. */
function blur(g: CanvasRenderingContext2D, px: number) {
  if ("filter" in g) g.filter = px > 0 ? `blur(${px}px)` : "none";
}

/** Periodic angular noise: a sum of random-phase harmonics (no circular silhouette survives it). */
function angNoise(rand: () => number, lo: number, hi: number) {
  const h: [number, number, number][] = [];
  for (let k = lo; k <= hi; k++) h.push([k, rand() * Math.PI * 2, (0.6 + rand() * 0.8) / Math.pow(k, 0.85)]);
  return (a: number) => {
    let v = 0;
    for (const [k, ph, amp] of h) v += Math.sin(k * a + ph) * amp;
    return v;
  };
}

/** Closed path through polar samples r(a), scaled by `k` and offset. */
function polarPath(g: CanvasRenderingContext2D, pts: [number, number][], k: number, ox = 0, oy = 0) {
  g.beginPath();
  const n = pts.length;
  const P = (i: number) => pts[((i % n) + n) % n];
  // quadratic smoothing through midpoints: organic, never polygonal
  const m0x = (P(0)[0] + P(1)[0]) / 2;
  const m0y = (P(0)[1] + P(1)[1]) / 2;
  g.moveTo(m0x * k + ox, m0y * k + oy);
  for (let i = 1; i <= n; i++) {
    const c = P(i);
    const nx = P(i + 1);
    g.quadraticCurveTo(c[0] * k + ox, c[1] * k + oy, ((c[0] + nx[0]) / 2) * k + ox, ((c[1] + nx[1]) / 2) * k + oy);
  }
  g.closePath();
}

/** A small irregular droplet stretched along `ang` (spray travelling outward). */
function droplet(g: CanvasRenderingContext2D, rand: () => number, x: number, y: number, r: number, ang: number, stretch: number) {
  const n = 7;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.scale(stretch, 1);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.7 + rand() * 0.5);
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.restore();
}

/**
 * One splat of blood on glass: a noise-displaced, direction-stretched body (near-black maroon core,
 * brighter arterial red only in a thin rim), fingers and an elongated spray thrown along the hit
 * direction, a cloud of satellite droplets, and only a faint wet sheen.
 */
function buildStamp(seed: number): { cv: HTMLCanvasElement; meta: StampMeta } {
  const cv = document.createElement("canvas");
  cv.width = SZ;
  cv.height = SZ;
  const g = cv.getContext("2d")!;
  const rand = seeded(seed);
  const C = SZ / 2;
  g.translate(C, C);
  const R = SZ * 0.115;
  const dir = rand() * Math.PI * 2;
  // body outline: harmonic noise + a few fingers + stretch along the hit direction
  const nLo = angNoise(rand, 2, 5);
  const nHi = angNoise(rand, 6, 22);
  const nFine = angNoise(rand, 23, 48); // crenellated, wet-glass edge
  const fingers: [number, number, number][] = [];
  const nf = 3 + ((rand() * 4) | 0);
  for (let i = 0; i < nf; i++) fingers.push([dir + (rand() - 0.5) * 2.2, 0.08 + rand() * 0.16, 0.35 + rand() * 0.9]);
  const N = 140;
  const pts: [number, number][] = [];
  const rad: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const fw = Math.cos(a - dir);
    let r = R * (1 + nLo(a) * 0.36 + nHi(a) * 0.24 + nFine(a) * 0.16);
    r *= 1 + 0.75 * Math.max(0, fw) ** 2 - 0.18 * Math.max(0, -fw);
    for (const [fa, w, len] of fingers) {
      let d = Math.abs(a - fa) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      r += R * len * Math.exp(-((d / w) ** 2));
    }
    rad.push(r);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  // inset outlines: a constant inward offset (not a scale), so the bright rim stays thin even on fingers
  const inset = (d: number): [number, number][] =>
    rad.map((r, i) => {
      const a = (i / N) * Math.PI * 2;
      const q = Math.max(r * 0.15, r - d);
      return [Math.cos(a) * q, Math.sin(a) * q];
    });
  // 1) spray: elongated droplets along the hit direction, thinning and shrinking with distance
  blur(g, 0.7);
  for (let i = 0; i < 110; i++) {
    const a = dir + (rand() - 0.5) * (0.5 + rand() * 0.9);
    const d = R * (1.3 + rand() ** 0.7 * 1.6);
    const fall = 1 - (d / R - 1.3) / 1.8;
    const r = R * (0.035 + rand() * 0.1) * (0.3 + fall);
    const v = rand();
    g.fillStyle = `rgba(${36 + v * 70 | 0},${2 + v * 6 | 0},${4 + v * 5 | 0},${0.5 + rand() * 0.4})`;
    droplet(g, rand, Math.cos(a) * d, Math.sin(a) * d, r, a, 1.4 + rand() * 2.6);
    g.fill();
  }
  // 2) satellites all round (denser near the body, a few flung far)
  blur(g, 0.5);
  for (let i = 0; i < 80; i++) {
    const a = rand() * Math.PI * 2;
    const d = R * (1.05 + rand() ** 1.6 * 1.4) * (1 + 0.5 * Math.max(0, Math.cos(a - dir)));
    const r = R * (0.03 + rand() ** 2 * 0.15);
    const v = rand();
    g.fillStyle = `rgba(${30 + v * 60 | 0},${2 + v * 5 | 0},${4 + v * 4 | 0},${0.55 + rand() * 0.4})`;
    droplet(g, rand, Math.cos(a) * d, Math.sin(a) * d, r, a, 1 + rand() * 0.8);
    g.fill();
  }
  // 3) body: thin bright rim -> dark maroon -> near-black core (offset toward the impact side)
  blur(g, 0.6);
  g.fillStyle = "rgba(112,10,12,0.9)";
  polarPath(g, pts, 1);
  g.fill();
  blur(g, 2);
  g.fillStyle = "rgba(40,3,6,0.97)";
  polarPath(g, inset(R * 0.07), 1);
  g.fill();
  blur(g, 5);
  g.fillStyle = "rgba(16,1,2,0.97)";
  polarPath(g, inset(R * 0.2), 1, -Math.cos(dir) * R * 0.06, -Math.sin(dir) * R * 0.06);
  g.fill();
  // value breakup: faint lighter pools and black clots inside
  blur(g, 3);
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * R * 0.75;
    const dark = rand() < 0.55;
    g.fillStyle = dark ? `rgba(10,0,1,${0.25 + rand() * 0.3})` : `rgba(74,6,9,${0.18 + rand() * 0.2})`;
    droplet(g, rand, Math.cos(a) * d, Math.sin(a) * d, R * (0.08 + rand() * 0.16), rand() * 6.28, 1 + rand());
    g.fill();
  }
  // 4) faint wet sheen: a thin broken highlight inside the upper-left rim, plus a few glints
  blur(g, 1.4);
  g.lineCap = "round";
  g.strokeStyle = "rgba(230,120,110,0.1)";
  g.lineWidth = R * 0.05;
  g.beginPath();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    if (a < Math.PI * 1.08 || a > Math.PI * 1.55) continue;
    const [px, py] = pts[i];
    if (i % 9 === 0) g.moveTo(px * 0.8, py * 0.8);
    else g.lineTo(px * 0.8, py * 0.8);
  }
  g.stroke();
  blur(g, 0.3);
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const d = R * (0.2 + rand() * 0.5);
    g.fillStyle = `rgba(255,200,190,${0.08 + rand() * 0.12})`;
    droplet(g, rand, Math.cos(a) * d, Math.sin(a) * d, R * (0.012 + rand() * 0.015), 0, 1.6);
    g.fill();
  }
  blur(g, 0);
  const rim: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i += 4) rim.push({ x: (pts[i][0] * 0.95) / SZ, y: (pts[i][1] * 0.95) / SZ });
  return { cv, meta: { dir, rim } };
}

/** Build the stamps still missing (all of them on a first heavy hit when the warm-up did not finish). */
function buildStamps() {
  while (!stampsDone()) buildNextStamp();
}
const stampsDone = () => !!stamps && stamps.length >= STAMPS;
function buildNextStamp() {
  if (!stamps) {
    stamps = [];
    metas = [];
  }
  const b = buildStamp(9001 + stamps.length * 77);
  // Read one pixel back: the blurred paths are rasterised here (about 20 ms per stamp), not at the end
  // of whatever frame happens to use the stamp first.
  b.cv.getContext("2d")!.getImageData(0, 0, 1, 1);
  stamps.push(b.cv);
  metas.push(b.meta);
}

/**
 * Warm-up behind the menus: one stamp (or the vignette) per call. Built all at once on the first heavy
 * hit, the ten blurred 384 px stamps froze that frame for about 250 ms.
 * Returns true while there is work left.
 */
export function prewarmScreenGore(): boolean {
  if (!stampsDone()) {
    buildNextStamp();
    return true;
  }
  if (!vigCv) {
    buildVignette();
    return false;
  }
  return false;
}

/** Smooth 2D value noise (seeded lattice, smoothstep blend). */
function noise2(seed: number) {
  const N = 64;
  const r = seeded(seed);
  const lat = Array.from({ length: N * N }, () => r());
  const at = (x: number, y: number) => lat[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Low-res edge vignette: feathered, noise-broken dark arterial red that lives at the borders only. */
function buildVignette() {
  const w = 320;
  const h = 180;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d")!;
  const img = g.createImageData(w, h);
  const n1 = noise2(4242);
  const n2 = noise2(777);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // distance to the nearest edge in units of the short side
      const d = Math.min(x, w - 1 - x, y, h - 1 - y) / h;
      const n = n1(x / 18, y / 18) * 0.65 + n2(x / 6, y / 6) * 0.35;
      const depth = 0.1 + n * 0.12; // ragged inner edge
      let a = 1 - d / depth;
      if (a <= 0) continue;
      a = Math.min(1, a) ** 1.6;
      const v = n2(x / 3 + 40, y / 3);
      const i = (y * w + x) * 4;
      img.data[i] = 22 + v * 42;
      img.data[i + 1] = v * 4;
      img.data[i + 2] = 3 + v * 5;
      img.data[i + 3] = a * 235;
    }
  }
  g.putImageData(img, 0, 0);
  vigCv = cv;
}

interface Drip {
  ax: number; // anchor on the splat's lower rim (fraction of splat size, after rotation)
  ay: number;
  len: number; // final length (fraction of screen height)
  w: number; // base width (fraction of splat size)
  k: number; // run speed
  wf: number[]; // irregular width profile down the run
}
interface Spl {
  on: boolean;
  v: number;
  x: number; // 0..1 of screen
  y: number;
  s: number; // scale (fraction of screen min dim)
  rot: number;
  t: number;
  born: number; // performance.now() at the hit (wall-clock age: no lingering when frames are sparse)
  life: number;
  drips: Drip[];
}
const MAX = 24;
const spl: Spl[] = Array.from({ length: MAX }, () => ({ on: false, v: 0, x: 0, y: 0, s: 0, rot: 0, t: 0, born: 0, life: 0, drips: [] }));
let vignette = 0;
let vigAt = 0; // performance.now() when `vignette` was last decayed

function decayVignette(now: number) {
  if (vigAt > 0) vignette = Math.max(0, vignette - Math.max(0, now - vigAt) / 1000 * 1.5);
  vigAt = now;
}

/** A spot on the left, right or top edge (kept away from the minimap and globes) and the inward hit direction there. */
function edgeSpot(inset: number): { x: number; y: number; dir: number } {
  const e = Math.random();
  const j = (Math.random() - 0.5) * 1.1;
  if (e < 0.36) return { x: -0.02 + inset, y: 0.08 + Math.random() * 0.62, dir: j };
  if (e < 0.72) return { x: 1.02 - inset, y: 0.36 + Math.random() * 0.36, dir: Math.PI + j };
  return { x: 0.04 + Math.random() * 0.62, y: -0.03 + inset, dir: Math.PI / 2 + j };
}

/** Local player took a heavy hit: severity 0..1 (fraction of max life, crit boosted). */
export function screenSplat(severity: number) {
  const a = goreAmount();
  if (a <= 0) return;
  if (!stampsDone()) buildStamps();
  severity = Math.min(1, severity);
  const now = performance.now();
  decayVignette(now);
  vignette = Math.min(1, vignette + severity * (0.5 + 0.5 * a));
  const n = Math.round((1 + severity * 4) * a);
  for (let i = 0; i < n; i++) {
    let s = spl.find((q) => !q.on);
    if (!s) s = spl.reduce((p, q) => (p.t / p.life > q.t / q.life ? p : q));
    const deep = a >= 1 && severity > 0.6 && Math.random() < 0.3; // extreme: an occasional splat further onto the lens
    const p = edgeSpot(Math.random() * (deep ? 0.14 : 0.06));
    s.on = true;
    s.v = (Math.random() * STAMPS) | 0;
    s.x = p.x;
    s.y = p.y;
    s.s = (0.2 + Math.random() * 0.22) * (0.6 + severity * 0.7) * (0.75 + 0.35 * a);
    s.rot = p.dir - metas[s.v].dir; // spray points inward, along the hit
    s.t = 0;
    s.born = now;
    s.life = (1.1 + severity * 1.4 + Math.random() * 0.4) * (a >= 1 ? 1.25 : 1);
    s.drips = [];
    // drip anchors: the lowest rim points of the rotated body
    const cr = Math.cos(s.rot);
    const sr = Math.sin(s.rot);
    const rim = metas[s.v].rim.map((q) => ({ x: q.x * cr - q.y * sr, y: q.x * sr + q.y * cr })).sort((u, w) => w.y - u.y);
    const low = rim.slice(0, Math.max(3, rim.length >> 2));
    const nd = Math.round((1 + Math.random() * 2.5) * (0.4 + 0.6 * a));
    for (let d = 0; d < nd; d++) {
      const q = low[(Math.random() * low.length) | 0];
      const wf: number[] = [];
      for (let k = 0; k < 7; k++) wf.push(0.6 + Math.random() * 0.8);
      s.drips.push({
        ax: q.x,
        ay: q.y - 0.012,
        len: (0.04 + Math.random() * 0.12) * (0.6 + severity * 0.6),
        w: 0.01 + Math.random() * 0.016,
        k: 0.9 + Math.random() * 1.4,
        wf,
      });
    }
  }
}

export function stepScreen(_dt: number) {
  // Wall clock: the lens blood must clear on time even when frames are sparse / clamped.
  const now = performance.now();
  decayVignette(now);
  for (const s of spl) {
    if (!s.on) continue;
    s.t = (now - s.born) / 1000;
    if (s.t >= s.life) s.on = false;
  }
}

/** HUD keep-out (device px): minimap frame and both globes stay readable under the blood. */
function hudKeepOut(W: number, H: number): Path2D | null {
  try {
    const L = getHudLayout();
    if (!L || !L.w) return null;
    const k = W / L.w;
    const p = new Path2D();
    p.rect(0, 0, W, H);
    const m = L.minimap;
    const pad = 6;
    p.rect((m.x - pad) * k, 0, (m.w + pad * 2) * k + 2, (m.y + m.h + pad) * k);
    for (const gl of [L.lifeGlobe, L.manaGlobe]) {
      p.moveTo((gl.cx + gl.r + 5) * k, gl.cy * k);
      p.arc(gl.cx * k, gl.cy * k, (gl.r + 5) * k, 0, Math.PI * 2);
    }
    return p;
  } catch {
    return null;
  }
}

/** A run of blood from the splat rim: irregular width (pinches and swells), tapering, ending in a small bead. */
function drawDrip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, wf: number[]) {
  const seg = 12;
  const half = (t: number) => {
    const f = t * (wf.length - 1);
    const i = Math.min(wf.length - 2, Math.floor(f));
    const u = f - i;
    const prof = wf[i] + (wf[i + 1] - wf[i]) * u * u * (3 - 2 * u);
    return (w / 2) * prof * (1 - 0.45 * t) * (t < 0.08 ? 1.6 - 7.5 * t : 1); // flared where it leaves the rim
  };
  const sway = (t: number) => Math.sin(t * 5 + wf[0] * 7) * w * 0.18;
  const grd = ctx.createLinearGradient(0, y, 0, y + len);
  grd.addColorStop(0, "rgba(34,2,4,0.9)");
  grd.addColorStop(1, "rgba(58,4,7,0.88)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const px = x + sway(t) - half(t);
    if (i === 0) ctx.moveTo(px, y + t * len);
    else ctx.lineTo(px, y + t * len);
  }
  const bw = half(1) * 1.35;
  const bx = x + sway(1);
  ctx.ellipse(bx, y + len, bw, bw * 1.2, 0, Math.PI, 0, true);
  for (let i = seg; i >= 0; i--) {
    const t = i / seg;
    ctx.lineTo(x + sway(t) + half(t), y + t * len);
  }
  ctx.closePath();
  ctx.fill();
  // thin brighter red edge on one side (blood is only bright where it is thin) + a faint glint on the bead
  ctx.strokeStyle = "rgba(140,14,16,0.4)";
  ctx.lineWidth = Math.max(0.6, w * 0.1);
  ctx.beginPath();
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    const px = x + sway(t) + half(t) * 0.85;
    if (i === 1) ctx.moveTo(px, y + t * len);
    else ctx.lineTo(px, y + t * len);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255,200,190,0.16)";
  ctx.beginPath();
  ctx.arc(bx - bw * 0.35, y + len - bw * 0.2, Math.max(0.5, bw * 0.25), 0, Math.PI * 2);
  ctx.fill();
}

export function drawScreen(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const amt = goreAmount();
  if (amt <= 0) return;
  const any = vignette > 0.01 || spl.some((s) => s.on);
  if (!any) return;
  if (!stampsDone()) buildStamps();
  if (!vigCv) buildVignette();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const keep = hudKeepOut(W, H);
  if (keep) ctx.clip(keep, "evenodd");
  if (vignette > 0.01 && vigCv) {
    const e = vignette * vignette * (3 - 2 * vignette); // smooth ease-out at the tail
    ctx.globalAlpha = e * (0.32 + 0.33 * amt);
    ctx.drawImage(vigCv, 0, 0, W, H);
  }
  const D = Math.min(W, H);
  for (const s of spl) {
    if (!s.on) continue;
    const f = s.t / s.life;
    const fin = Math.min(1, s.t / 0.06);
    const out = f < 0.4 ? 1 : 1 - (f - 0.4) / 0.6;
    const alpha = fin * out * out * (0.6 + 0.2 * amt); // translucent: the world reads through at the edges
    if (alpha <= 0.01) continue;
    const sz = D * s.s * (0.9 + 0.1 * fin);
    const x = s.x * W;
    const y = s.y * H + Math.min(1, s.t * 0.3) * D * 0.01; // the whole splat sags slightly
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.rot);
    ctx.drawImage(stamps![s.v], -sz / 2, -sz / 2, sz, sz);
    ctx.restore();
    for (const d of s.drips) {
      const run = 1 - Math.exp(-s.t * d.k);
      const len = run * d.len * H;
      if (len < 2) continue;
      drawDrip(ctx, x + d.ax * sz, y + d.ay * sz, len, Math.max(1.5, d.w * sz), d.wf);
    }
  }
  ctx.restore();
}
