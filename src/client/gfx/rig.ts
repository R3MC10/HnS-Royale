// Tiny "3D part rig" rasterizer. Characters are built from shaded capsules, spheres, discs and
// flat polygons positioned in a local frame (f = forward, s = right, z = up, in pixels), rotated
// to a facing, projected with the same 2:1 isometric camera as the world and painter-sorted.
// Every frame is rasterized once into a PixBuf and cached by the caller.
import { cssColor, PixBuf, type Ramp, type Sprite } from "./pixel";

export type V3 = [number, number, number];

export interface Part {
  kind: "cap" | "sph" | "disc" | "poly" | "dot";
  a: V3;
  b?: V3; // capsule end
  r: number;
  ramp: Ramp;
  dither?: boolean;
  bias?: number; // lighting bias
  ry?: number; // sphere vertical squash (screen)
  n?: V3; // disc normal
  rim?: number; // disc rim colour
  boss?: number; // disc centre colour
  pts?: V3[]; // polygon
  color?: number; // flat colour for poly / dot
  ref?: V3; // dot: only drawn when in front of this point (eyes, visor)
  depthBias?: number;
}

export const v = (f: number, s: number, z: number): V3 => [f, s, z];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rotate around the s (right) axis through a pivot; positive = top tips forward. */
export function rotS(p: V3, ang: number, pivot: V3): V3 {
  const df = p[0] - pivot[0];
  const dz = p[2] - pivot[2];
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [pivot[0] + df * c + dz * s, p[1], pivot[2] - df * s + dz * c];
}
/** Rotate around the f (forward) axis through a pivot (sideways tip). */
export function rotF(p: V3, ang: number, pivot: V3): V3 {
  const ds = p[1] - pivot[1];
  const dz = p[2] - pivot[2];
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [p[0], pivot[1] + ds * c + dz * s, pivot[2] - ds * s + dz * c];
}
/** Rotate around the vertical axis (yaw) through the origin. */
export function rotZ(p: V3, ang: number): V3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

/** Apply a point transform to every point of every part. */
export function transformParts(parts: Part[], fn: (p: V3) => V3) {
  for (const pt of parts) {
    pt.a = fn(pt.a);
    if (pt.b) pt.b = fn(pt.b);
    if (pt.ref) pt.ref = fn(pt.ref);
    if (pt.pts) pt.pts = pt.pts.map(fn);
    if (pt.n) {
      const o = fn([0, 0, 0]);
      pt.n = norm(sub(fn(pt.n), o));
    }
  }
}

import { HZ, SQ } from "./iso";

// The diagonal 3/4 camera (see iso.ts): world turned 45 degrees, ground squashed by SQ, height rises.
const C = Math.SQRT1_2;
const SZ = HZ * C;

export interface Projector {
  x(p: V3): number;
  y(p: V3): number;
  depth(p: V3): number;
}

/** Projector for a facing (world angle) and uniform scale, anchored at (ax, ay). */
export function projector(facing: number, scale: number, ax: number, ay: number): Projector {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  const wx = (p: V3) => (p[0] * c - p[1] * s) * scale;
  const wy = (p: V3) => (p[0] * s + p[1] * c) * scale;
  return {
    x: (p) => ax + (wx(p) - wy(p)) * C,
    y: (p) => ay + (wx(p) + wy(p)) * C * SQ - p[2] * scale * SZ,
    depth: (p) => (wx(p) + wy(p)) * C + p[2] * scale * 0.22,
  };
}

/** Rasterize parts into a buffer (painter-sorted), then apply the selective outline. */
export function rasterize(parts: Part[], pr: Projector, scale: number, buf: PixBuf, outline = true) {
  const items = parts.map((p, i) => {
    let d: number;
    if (p.kind === "cap") d = pr.depth(lerp3(p.a, p.b!, 0.5));
    else if (p.kind === "poly") d = p.pts!.reduce((acc, q) => acc + pr.depth(q), 0) / p.pts!.length;
    else d = pr.depth(p.a);
    return { p, d: d + (p.depthBias ?? 0) + i * 1e-4 };
  });
  items.sort((a, b) => a.d - b.d);
  for (const { p } of items) {
    switch (p.kind) {
      case "cap":
        buf.capsule(pr.x(p.a), pr.y(p.a), pr.x(p.b!), pr.y(p.b!), p.r * scale, p.ramp, { dither: p.dither, bias: p.bias });
        break;
      case "sph":
        buf.sphere(pr.x(p.a), pr.y(p.a), p.r * scale, p.ramp, { dither: p.dither, bias: p.bias, ry: p.ry ? p.r * scale * p.ry : undefined });
        break;
      case "dot":
        if (p.ref && pr.depth(p.a) <= pr.depth(p.ref) + 0.3) break;
        buf.set(Math.floor(pr.x(p.a)), Math.floor(pr.y(p.a)), p.color!);
        if (p.r > 1) buf.set(Math.floor(pr.x(p.a)) + 1, Math.floor(pr.y(p.a)), p.color!);
        break;
      case "poly":
        buf.poly(p.pts!.map((q) => [pr.x(q), pr.y(q)] as [number, number]), p.color!);
        break;
      case "disc":
        drawDisc(buf, p, pr, scale);
        break;
    }
  }
  if (outline) buf.outline();
}

function drawDisc(buf: PixBuf, p: Part, pr: Projector, scale: number) {
  const n = norm(p.n!);
  const up: V3 = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const e1 = norm(cross(n, up));
  const e2 = norm(cross(n, e1));
  const R = p.r;
  // Face shade from how much the disc faces the light (projected normal).
  const nsx = pr.x(add(p.a, n)) - pr.x(p.a);
  const nsy = pr.y(add(p.a, n)) - pr.y(p.a);
  const nl = Math.hypot(nsx, nsy) || 1;
  const facing = 1 - Math.min(1, nl / (scale * 0.9));
  const lit = (-0.55 * nsx - 0.62 * nsy) / nl;
  const face = p.ramp[lit > 0.3 ? 2 : facing > 0.6 ? 2 : lit > -0.3 ? 1 : 0];
  const step = 0.3 / scale;
  for (let u = -R; u <= R; u += step) {
    for (let w = -R; w <= R; w += step) {
      const d = Math.hypot(u, w);
      if (d > R) continue;
      const q = add(p.a, add(mul(e1, u), mul(e2, w)));
      let c = face;
      if (d > R - 1.1) c = p.rim ?? p.ramp[0];
      else if (d < 1.3 && p.boss !== undefined) c = p.boss;
      else if (u < -R * 0.3 && w < -R * 0.3 && d < R - 1.5) c = p.ramp[Math.min(3, (lit > 0 ? 3 : 2))];
      buf.set(Math.floor(pr.x(q)), Math.floor(pr.y(q)), c);
    }
  }
}

// ---- smooth painter ---------------------------------------------------------------------------
// Draws the same parts as rasterize(), but as anti-aliased canvas shapes with gradient shading
// (light from the upper left), then a soft dark outline. Used for every rigged sprite.

const LIGHT_X = -0.62;
const LIGHT_Y = -0.78;
const css = new Map<number, string>();
function col(c: number): string {
  let s = css.get(c);
  if (!s) {
    s = cssColor(c);
    if (css.size > 4000) css.clear();
    css.set(c, s);
  }
  return s;
}

function depthItems(parts: Part[], pr: Projector) {
  const items = parts.map((p, i) => {
    let d: number;
    if (p.kind === "cap") d = pr.depth(lerp3(p.a, p.b!, 0.5));
    else if (p.kind === "poly") d = p.pts!.reduce((acc, q) => acc + pr.depth(q), 0) / p.pts!.length;
    else d = pr.depth(p.a);
    return { p, d: d + (p.depthBias ?? 0) + i * 1e-4 };
  });
  items.sort((a, b) => a.d - b.d);
  return items;
}

function capStops(g: CanvasGradient, rp: Ramp, bias = 0) {
  const b = Math.max(-0.3, Math.min(0.3, bias * 0.25));
  g.addColorStop(0, col(rp[2]));
  g.addColorStop(Math.max(0.05, 0.2 - b), col(rp[3]));
  g.addColorStop(Math.max(0.1, 0.42 - b), col(rp[2]));
  g.addColorStop(Math.min(0.95, 0.74 - b), col(rp[1]));
  g.addColorStop(1, col(rp[0]));
}

/** Ramps that paint as polished metal (sharper contrast, specular streak). Registered by the rigs. */
export const METAL_RAMPS = new Set<Ramp>();
/** Ramps that glow softly (magic gems, unique trims). */
export const GLOW_RAMPS = new Set<Ramp>();
const RIM = "rgba(255,196,140,0.38)"; // warm torch rim on the shadow side
const SPEC = "rgba(255,255,255,0.75)";

/** Paint parts (painter-sorted) as smooth shapes onto ctx (device px; pr already includes density). */
export function paintParts(parts: Part[], pr: Projector, scale: number, ctx: CanvasRenderingContext2D) {
  for (const { p } of depthItems(parts, pr)) {
    switch (p.kind) {
      case "cap": {
        const x0 = pr.x(p.a);
        const y0 = pr.y(p.a);
        const x1 = pr.x(p.b!);
        const y1 = pr.y(p.b!);
        const r = p.r * scale;
        let nx = -(y1 - y0);
        let ny = x1 - x0;
        const l = Math.hypot(nx, ny);
        if (l < 0.01) {
          nx = LIGHT_X;
          ny = LIGHT_Y;
        } else {
          nx /= l;
          ny /= l;
          if (nx * LIGHT_X + ny * LIGHT_Y < 0) {
            nx = -nx;
            ny = -ny;
          }
        }
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const g = ctx.createLinearGradient(mx + nx * r, my + ny * r, mx - nx * r, my - ny * r);
        capStops(g, p.ramp, p.bias);
        ctx.strokeStyle = g;
        ctx.lineWidth = r * 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(l < 0.01 ? x0 + 0.01 : x1, y1);
        ctx.stroke();
        if (r > 0.9 && l > r * 0.6) {
          const metal = METAL_RAMPS.has(p.ramp);
          // Rim light on the shadow side, specular streak on the lit side (metal: sharp and bright).
          ctx.lineWidth = Math.max(0.6, r * (metal ? 0.22 : 0.16));
          ctx.strokeStyle = RIM;
          ctx.beginPath();
          ctx.moveTo(x0 - nx * r * 0.82, y0 - ny * r * 0.82);
          ctx.lineTo(x1 - nx * r * 0.82, y1 - ny * r * 0.82);
          ctx.stroke();
          if (metal) {
            ctx.strokeStyle = SPEC;
            ctx.lineWidth = Math.max(0.5, r * 0.2);
            const ins = 0.18 * l;
            const ux = (x1 - x0) / l;
            const uy = (y1 - y0) / l;
            ctx.beginPath();
            ctx.moveTo(x0 + nx * r * 0.45 + ux * ins, y0 + ny * r * 0.45 + uy * ins);
            ctx.lineTo(x1 + nx * r * 0.45 - ux * ins, y1 + ny * r * 0.45 - uy * ins);
            ctx.stroke();
          }
        }
        break;
      }
      case "sph": {
        const x = pr.x(p.a);
        const y = pr.y(p.a);
        const r = p.r * scale;
        const ry = p.ry ? r * p.ry : r;
        const b = (p.bias ?? 0) * 0.15;
        const g = ctx.createRadialGradient(x - r * 0.38, y - ry * 0.42, r * 0.05, x, y, r * 1.05);
        g.addColorStop(0, col(p.ramp[3]));
        g.addColorStop(Math.max(0.1, 0.28 - b), col(p.ramp[2]));
        g.addColorStop(Math.min(0.9, 0.7 - b), col(p.ramp[1]));
        g.addColorStop(1, col(p.ramp[0]));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        if (r > 1.2) {
          // Rim crescent (lower right) and, for metal, a hot specular point.
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = RIM;
          ctx.lineWidth = r * 0.22;
          ctx.beginPath();
          ctx.ellipse(x - r * 0.1, y - ry * 0.1, r, ry, 0, -0.2, Math.PI * 0.75);
          ctx.stroke();
          ctx.restore();
          if (METAL_RAMPS.has(p.ramp)) {
            const sg = ctx.createRadialGradient(x - r * 0.38, y - ry * 0.45, 0, x - r * 0.38, y - ry * 0.45, r * 0.45);
            sg.addColorStop(0, SPEC);
            sg.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.arc(x - r * 0.38, y - ry * 0.45, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (GLOW_RAMPS.has(p.ramp)) {
          const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
          gg.addColorStop(0, "rgba(255,230,180,0.45)");
          gg.addColorStop(1, "rgba(255,200,120,0)");
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.arc(x, y, r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "dot": {
        if (p.ref && pr.depth(p.a) <= pr.depth(p.ref) + 0.3) break;
        ctx.fillStyle = col(p.color!);
        ctx.beginPath();
        ctx.arc(pr.x(p.a), pr.y(p.a), Math.max(0.6, scale * 0.42) * (p.r > 1 ? 1.4 : 1), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "poly": {
        const pts = p.pts!.map((q) => [pr.x(q), pr.y(q)] as [number, number]);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const [x, y] of pts) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
        const base = p.color ?? p.ramp[2];
        const g = ctx.createLinearGradient(minX, minY, maxX, maxY);
        g.addColorStop(0, col(p.ramp[3]));
        g.addColorStop(0.35, col(base));
        g.addColorStop(1, col(p.ramp[0]));
        ctx.fillStyle = g;
        ctx.strokeStyle = col(p.ramp[0]);
        ctx.lineWidth = Math.max(0.6, scale * 0.25);
        ctx.lineJoin = "round";
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (METAL_RAMPS.has(p.ramp)) {
          // Bevel highlight along the upper-left edges.
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = Math.max(0.5, scale * 0.18);
          ctx.beginPath();
          for (let k = 0; k < pts.length; k++) {
            const [ax, ay] = pts[k];
            const [bx, by] = pts[(k + 1) % pts.length];
            const ex = bx - ax;
            const ey = by - ay;
            // edge normal (pointing outward for either winding) facing the light
            if ((-ey * LIGHT_X + ex * LIGHT_Y) * (k % 2 ? 1 : 1) > 0) {
              ctx.moveTo(ax, ay);
              ctx.lineTo(bx, by);
            }
          }
          ctx.stroke();
        }
        break;
      }
      case "disc": {
        const n = norm(p.n!);
        const up: V3 = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
        const e1 = norm(cross(n, up));
        const e2 = norm(cross(n, e1));
        const ring = (R: number) => {
          ctx.beginPath();
          for (let i = 0; i <= 28; i++) {
            const a = (i / 28) * Math.PI * 2;
            const q = add(p.a, add(mul(e1, Math.cos(a) * R), mul(e2, Math.sin(a) * R)));
            if (i) ctx.lineTo(pr.x(q), pr.y(q));
            else ctx.moveTo(pr.x(q), pr.y(q));
          }
          ctx.closePath();
        };
        const cx = pr.x(p.a);
        const cy = pr.y(p.a);
        const R = p.r * scale;
        const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        g.addColorStop(0, col(p.ramp[3]));
        g.addColorStop(0.35, col(p.ramp[2]));
        g.addColorStop(0.75, col(p.ramp[1]));
        g.addColorStop(1, col(p.ramp[0]));
        ring(p.r);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = col(p.rim ?? p.ramp[0]);
        ctx.lineWidth = Math.max(0.8, scale * 0.85);
        ctx.stroke();
        if (p.boss !== undefined) {
          ring(Math.min(1.3, p.r * 0.3));
          const bg = ctx.createRadialGradient(cx - scale * 0.4, cy - scale * 0.4, 0, cx, cy, scale * 1.4);
          bg.addColorStop(0, "rgba(255,255,255,0.9)");
          bg.addColorStop(0.35, col(p.boss));
          bg.addColorStop(1, col(p.ramp[0]));
          ctx.fillStyle = bg;
          ctx.fill();
        }
        break;
      }
    }
  }
}

/** Draw `src` onto a new canvas with a soft dark outline (and an optional flash tint). */
export function outlined(src: HTMLCanvasElement, o: number, flash: boolean): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = src.width;
  cv.height = src.height;
  const g = cv.getContext("2d")!;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.drawImage(src, Math.cos(a) * o, Math.sin(a) * o);
  }
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "rgba(8,6,6,0.82)";
  g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = "source-over";
  g.drawImage(src, 0, 0);
  if (flash) {
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(255,250,240,0.8)";
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = "source-over";
  }
  return cv;
}

/** Sprite density: device px per screen unit for newly painted sprites (set by the renderer). */
let density = 3;
export function setSpriteDensity(d: number) {
  density = Math.max(1, Math.min(6, d));
}
export function spriteDensity() {
  return density;
}

/**
 * Paint parts into a new smooth sprite. W/H/ax/ay are in screen units; the canvas is W*d x H*d.
 * `facing` is the world angle the rig faces; `scale` is rig units -> screen units.
 */
export function paintSprite(parts: Part[], facing: number, scale: number, W: number, H: number, ax: number, ay: number, flash = false): Sprite {
  const d = density;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(W * d);
  cv.height = Math.ceil(H * d);
  const ctx = cv.getContext("2d")!;
  paintParts(parts, projector(facing, scale * d, ax * d, ay * d), scale * d, ctx);
  return { cv: outlined(cv, Math.max(1, d * 0.55), flash), ax: ax * d, ay: ay * d, d };
}
