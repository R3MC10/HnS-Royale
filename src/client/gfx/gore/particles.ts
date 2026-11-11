// Gore particles: a fixed struct-of-arrays pool (no per-frame allocation). Droplets fly in real
// height (z), fall under gravity and splat into a baked ground decal where they land.
import { isoX, isoY, K, SQ } from "../iso";
import type { Cam } from "../view";
import { M_DUST, M_ICE, MATS, persistentBlood, type Mat } from "./core";
import { stamp } from "./decals";
import { paintSplat } from "./paint";

export const P_DROP = 0;
export const P_MIST = 1;
export const P_EMBER = 2;
export const P_SMOKE = 3;
export const P_SPARK = 4;
export const P_SHARD = 5;
export const P_WISP = 6;
export const P_SHIMMER = 7;
export const P_CLOT = 8;

const MAX = 3200;
const x = new Float32Array(MAX);
const y = new Float32Array(MAX);
const z = new Float32Array(MAX);
const vx = new Float32Array(MAX);
const vy = new Float32Array(MAX);
const vz = new Float32Array(MAX);
const t = new Float32Array(MAX);
const life = new Float32Array(MAX);
const size = new Float32Array(MAX);
const seed = new Float32Array(MAX);
const kind = new Uint8Array(MAX);
const mat = new Uint8Array(MAX);
const col = new Uint8Array(MAX);
let n = 0;

const C = Math.SQRT1_2;
const ZK = 0.62; // height -> screen units (matches view.ts camY)
const GRAV = 620;

export function particleTotal() {
  return n;
}

export function spawnP(k: number, m: Mat, px: number, py: number, pz: number, pvx: number, pvy: number, pvz: number, lf: number, s: number) {
  let i = n;
  if (n >= MAX) i = (Math.random() * MAX) | 0; // overwrite a random one (cap)
  else n++;
  x[i] = px;
  y[i] = py;
  z[i] = pz;
  vx[i] = pvx;
  vy[i] = pvy;
  vz[i] = pvz;
  t[i] = 0;
  life[i] = lf;
  size[i] = s;
  kind[i] = k;
  mat[i] = m;
  col[i] = (Math.random() * 4) | 0;
  seed[i] = Math.random() * 1e6;
}

function kill(i: number) {
  n--;
  if (i === n) return;
  x[i] = x[n];
  y[i] = y[n];
  z[i] = z[n];
  vx[i] = vx[n];
  vy[i] = vy[n];
  vz[i] = vz[n];
  t[i] = t[n];
  life[i] = life[n];
  size[i] = size[n];
  kind[i] = kind[n];
  mat[i] = mat[n];
  col[i] = col[n];
  seed[i] = seed[n];
}

let landBudget = 0;
function land(i: number) {
  if (landBudget <= 0) return;
  landBudget--;
  const m = mat[i];
  const s = size[i];
  const r = kind[i] === P_CLOT ? s * 1.6 : s * (0.9 + Math.random() * 0.8);
  const dx = vx[i];
  const dy = vy[i];
  const sp = Math.hypot(dx, dy);
  const pw = Math.min(1, sp / 260);
  const sd = seed[i] | 0;
  const px = x[i];
  const py = y[i];
  if (m === M_DUST) return;
  stamp(px, py, r * 4, (g) => paintSplat(g, m, r, dx, dy, sd, pw, persistentBlood() ? 0.95 : 0.8));
}

export function stepParticles(dt: number) {
  landBudget = 220;
  for (let i = n - 1; i >= 0; i--) {
    t[i] += dt;
    const k = kind[i];
    if (t[i] >= life[i]) {
      if (k === P_SHARD && mat[i] !== M_DUST) {
        const m = mat[i];
        const sd = seed[i] | 0;
        const s = size[i];
        const a = seed[i];
        stamp(x[i], y[i], s * 2, (g) => {
          g.rotate(a);
          g.fillStyle = m === M_ICE ? "#cfeefc" : "#d8d0c0";
          g.beginPath();
          g.moveTo(-s, 0);
          g.lineTo(0, -s * 0.35);
          g.lineTo(s, 0);
          g.lineTo(0, s * 0.3);
          g.fill();
          void sd;
        });
      }
      kill(i);
      continue;
    }
    switch (k) {
      case P_DROP:
      case P_CLOT: {
        vz[i] -= GRAV * dt * (k === P_CLOT ? 1.1 : 1);
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        z[i] += vz[i] * dt;
        const drag = 1 - 0.6 * dt;
        vx[i] *= drag;
        vy[i] *= drag;
        if (z[i] <= 0) {
          land(i);
          kill(i);
        }
        break;
      }
      case P_SHARD: {
        vz[i] -= GRAV * dt;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        z[i] += vz[i] * dt;
        if (z[i] <= 0) {
          z[i] = 0;
          vz[i] = Math.abs(vz[i]) > 40 ? -vz[i] * 0.3 : 0;
          vx[i] *= 0.45;
          vy[i] *= 0.45;
        }
        break;
      }
      case P_MIST: {
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        z[i] += vz[i] * dt;
        vx[i] *= 1 - 3 * dt;
        vy[i] *= 1 - 3 * dt;
        vz[i] -= 40 * dt;
        break;
      }
      case P_SMOKE:
      case P_WISP: {
        x[i] += (vx[i] + Math.sin(t[i] * 3 + seed[i]) * (k === P_WISP ? 14 : 6)) * dt;
        y[i] += vy[i] * dt;
        z[i] += vz[i] * dt;
        break;
      }
      case P_EMBER: {
        x[i] += (vx[i] + Math.sin(t[i] * 7 + seed[i]) * 10) * dt;
        y[i] += vy[i] * dt;
        z[i] += vz[i] * dt;
        vz[i] += 20 * dt;
        break;
      }
      default: {
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        z[i] += vz[i] * dt;
      }
    }
  }
}

/** Ground shadow for airborne drops is skipped (too small); gibs draw their own. */
export function drawParticles(g: CanvasRenderingContext2D, cam: Cam, glowPass: boolean) {
  if (!n) return;
  const ox = cam.offX;
  const oy = cam.offY;
  const W = cam.ww + 40;
  const H = cam.wh + 60;
  g.lineCap = "round";
  if (glowPass) g.globalCompositeOperation = "lighter";
  let lastStyle = "";
  for (let i = 0; i < n; i++) {
    const k = kind[i];
    const m = mat[i];
    const glow = k === P_EMBER || k === P_SPARK || k === P_WISP || k === P_SHIMMER || MATS[m].glow;
    if (glow !== glowPass) continue;
    const px = x[i];
    const py = y[i];
    const sx = ox + isoX(px, py);
    const sy = oy + isoY(px, py) - z[i] * ZK;
    if (sx < -40 || sy < -40 || sx > W || sy > H) continue;
    const f = t[i] / life[i];
    const s = size[i];
    switch (k) {
      case P_DROP:
      case P_CLOT: {
        // Streak along the projected velocity.
        const svx = (vx[i] - vy[i]) * C * K;
        const svy = (vx[i] + vy[i]) * C * K * SQ - vz[i] * ZK;
        const st = k === P_CLOT ? 0.012 : 0.022;
        const c = MATS[m].drop[col[i]];
        if (c !== lastStyle) {
          g.strokeStyle = c;
          lastStyle = c;
        }
        g.globalAlpha = 1;
        g.lineWidth = s * (k === P_CLOT ? 1.4 : 0.9);
        g.beginPath();
        g.moveTo(sx - svx * st, sy - svy * st);
        g.lineTo(sx, sy);
        g.stroke();
        break;
      }
      case P_MIST: {
        const r = s * (1 + f * 2.5);
        g.globalAlpha = (1 - f) * 0.45;
        g.fillStyle = MATS[m].drop[1];
        lastStyle = "";
        g.beginPath();
        g.arc(sx, sy, r, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case P_SMOKE: {
        const r = s * (1 + f * 3);
        g.globalAlpha = Math.min(1, f * 6) * (1 - f) * 0.4;
        g.fillStyle = f < 0.3 ? "#2a2420" : "#4a4440";
        lastStyle = "";
        g.beginPath();
        g.arc(sx, sy, r, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case P_SHARD: {
        g.globalAlpha = Math.min(1, (1 - f) * 4);
        const c = MATS[m].drop[col[i]];
        g.fillStyle = m === M_ICE ? (col[i] & 1 ? "#e8f8ff" : "#9fd8f2") : m === M_DUST ? c : "#e6dccb";
        lastStyle = "";
        const a = seed[i] + t[i] * (z[i] > 0 ? 14 : 0);
        const ca = Math.cos(a) * s;
        const sa = Math.sin(a) * s * 0.7;
        g.beginPath();
        g.moveTo(sx + ca, sy + sa);
        g.lineTo(sx - sa * 0.5, sy + ca * 0.3);
        g.lineTo(sx - ca, sy - sa);
        g.lineTo(sx + sa * 0.4, sy - ca * 0.3);
        g.closePath();
        g.fill();
        break;
      }
      case P_EMBER: {
        g.globalAlpha = (1 - f) * (0.6 + 0.4 * Math.sin(t[i] * 20 + seed[i]));
        g.fillStyle = f < 0.4 ? "#ffd27a" : "#ff6a1a";
        lastStyle = "";
        g.beginPath();
        g.arc(sx, sy, s * (1 - f * 0.5), 0, Math.PI * 2);
        g.fill();
        break;
      }
      case P_SPARK: {
        g.globalAlpha = 1 - f;
        g.strokeStyle = f < 0.5 ? "#f2f6ff" : "#8ab8ff";
        lastStyle = "";
        g.lineWidth = s * 0.6;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx - vx[i] * 0.02, sy - vy[i] * 0.02 + vz[i] * 0.01);
        g.stroke();
        break;
      }
      case P_WISP: {
        const r = s * (1 + f * 1.5);
        const grd = g.createRadialGradient(sx, sy, 0, sx, sy, r);
        grd.addColorStop(0, "rgba(200,255,240,0.8)");
        grd.addColorStop(0.5, "rgba(90,230,200,0.35)");
        grd.addColorStop(1, "rgba(40,160,140,0)");
        g.globalAlpha = Math.min(1, f * 5) * (1 - f);
        g.fillStyle = grd;
        lastStyle = "";
        g.beginPath();
        g.arc(sx, sy, r, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case P_SHIMMER: {
        g.globalAlpha = (1 - f) * 0.9;
        g.strokeStyle = "#9fd0ff";
        lastStyle = "";
        g.lineWidth = 0.7;
        const r = s * (0.6 + f);
        g.beginPath();
        for (let h = 0; h < 6; h++) {
          const a = (h / 6) * Math.PI * 2 + seed[i];
          const hx = sx + Math.cos(a) * r;
          const hy = sy + Math.sin(a) * r * 0.8;
          if (h === 0) g.moveTo(hx, hy);
          else g.lineTo(hx, hy);
        }
        g.closePath();
        g.stroke();
        break;
      }
      default: {
        // Glowing ecto droplets
        g.globalAlpha = 1 - f * 0.5;
        g.fillStyle = MATS[m].drop[col[i]];
        lastStyle = "";
        g.beginPath();
        g.arc(sx, sy, s * 0.8, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
}

export function clearParticles() {
  n = 0;
}
