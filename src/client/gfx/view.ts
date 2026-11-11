// World-pass camera + layer hooks for other client systems (gore, skill VFX, ...).
// The world pass draws in SCREEN UNITS: the canvas transform already maps 1 unit to `Z` canvas px,
// so hook code just uses cam.sx/cam.sy (or isoX/isoY + cam.offX/offY) and never touches devicePixelRatio.

import { depthOf, isoX, isoY } from "./iso";

export interface Cam {
  /** Screen-unit offset of the world origin (world -> screen: offX + isoX(x, y)). */
  offX: number;
  offY: number;
  /** Canvas px per screen unit (includes zoom and render scale). */
  Z: number;
  /** View size in screen units. */
  ww: number;
  wh: number;
  /** Renderer clock (s). */
  time: number;
}

export const cam: Cam = { offX: 0, offY: 0, Z: 1, ww: 720, wh: 405, time: 0 };

/** World ground point (+ height z in world units) -> screen units for the current world pass. */
export const camX = (x: number, y: number) => cam.offX + isoX(x, y);
export const camY = (x: number, y: number, z = 0) => cam.offY + isoY(x, y) - z * 0.62;
export function camOnScreen(x: number, y: number, margin = 120) {
  const a = camX(x, y);
  const b = camY(x, y);
  return a > -margin && b > -margin && a < cam.ww + margin && b < cam.wh + margin * 1.5;
}
export { depthOf };

/** Flat layer drawn on the ground, after the ground and camp patches, before shadows / entities. */
export type LayerFn = (g: CanvasRenderingContext2D, c: Cam) => void;
/** Adds depth-sorted drawables: push(depth (use depthOf(x, y)), draw). */
export type DepthFn = (push: (depth: number, draw: () => void) => void, c: Cam) => void;

export const layers = {
  ground: new Set<LayerFn>(),
  depth: new Set<DepthFn>(),
  /** Drawn after the sorted entities, before the darkness (lit like the world). */
  over: new Set<LayerFn>(),
  /** Drawn after the darkness (glows, sparks, unlit effects). */
  fx: new Set<LayerFn>(),
};

export function addLayer(kind: "ground" | "over" | "fx", fn: LayerFn): () => void;
export function addLayer(kind: "depth", fn: DepthFn): () => void;
export function addLayer(kind: keyof typeof layers, fn: LayerFn | DepthFn): () => void {
  (layers[kind] as Set<unknown>).add(fn);
  return () => (layers[kind] as Set<unknown>).delete(fn);
}

export function runLayer(kind: "ground" | "over" | "fx", g: CanvasRenderingContext2D) {
  for (const fn of layers[kind]) {
    try {
      g.save();
      fn(g, cam);
    } catch (e) {
      console.error("layer", kind, e);
    } finally {
      g.restore();
    }
  }
}
