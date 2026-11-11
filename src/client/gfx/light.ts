// Smooth light map. Each frame the map is cleared to a dark ambient colour, soft elliptical radial
// lights are added with the "lighter" operator, and the result is multiplied onto the world.
// The map works in screen units (same space as the world pass) but is stored at a reduced internal
// resolution: smooth gradients upscale without visible loss. A cached smooth vignette darkens edges.

export type RGB = [number, number, number];

/** Exposure lift on the lit world: gain = 1 + EXPOSURE_LIFT. */
const EXPOSURE_LIFT = 0.36;
/** Internal light-map px per screen unit. */
const Q = 0.5;
const spriteCache = new Map<string, HTMLCanvasElement>();

/** Unit radial light (pre-multiplied colour), stretched to an ellipse at draw time. */
function lightSprite(c: RGB): HTMLCanvasElement {
  const key = `${c[0]}|${c[1]}|${c[2]}`;
  let cv = spriteCache.get(key);
  if (cv) return cv;
  if (spriteCache.size > 300) spriteCache.clear();
  const S = 128;
  cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d")!;
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // Soft core, long tail (approximates (1-r)^1.25).
  for (const [t, k] of [
    [0, 1],
    [0.15, 0.82],
    [0.35, 0.57],
    [0.55, 0.35],
    [0.75, 0.16],
    [0.9, 0.05],
    [1, 0],
  ] as const)
    gr.addColorStop(t, `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, S, S);
  spriteCache.set(key, cv);
  return cv;
}

export function hexRGB(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export class LightMap {
  readonly cv = document.createElement("canvas");
  private g = this.cv.getContext("2d")!;
  private vig: HTMLCanvasElement | null = null;
  private w = 1;
  private h = 1;
  count = 0;

  /** Size in screen units. */
  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    const cw = Math.max(1, Math.ceil(w * Q));
    const ch = Math.max(1, Math.ceil(h * Q));
    if (this.cv.width === cw && this.cv.height === ch) return;
    this.cv.width = cw;
    this.cv.height = ch;
    this.vig = null;
  }

  begin(ambient: string) {
    this.count = 0;
    const { g, cv } = this;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = ambient;
    g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = "lighter";
    g.setTransform(Q, 0, 0, Q, 0, 0);
  }

  /** Add a light centred at screen unit (x, y); `rx` horizontal radius in units; `k` scales the colour. */
  add(x: number, y: number, rx: number, color: RGB, k = 1) {
    if (rx < 2 || k <= 0.02) return;
    const ry = rx * 0.62;
    if (x + rx < 0 || y + ry < 0 || x - rx > this.w || y - ry > this.h) return;
    const q = Math.round(Math.min(1.5, k) * 20) / 20;
    const c: RGB = [Math.min(255, Math.round((color[0] * q) / 4) * 4), Math.min(255, Math.round((color[1] * q) / 4) * 4), Math.min(255, Math.round((color[2] * q) / 4) * 4)];
    this.g.drawImage(lightSprite(c), x - rx, y - ry, rx * 2, ry * 2);
    this.count++;
  }

  /** Multiply the light map onto the target (in screen units), then darken the edges. */
  apply(target: CanvasRenderingContext2D) {
    const sm = target.imageSmoothingEnabled;
    target.imageSmoothingEnabled = true;
    target.globalCompositeOperation = "multiply";
    target.drawImage(this.cv, 0, 0, this.cv.width / Q, this.cv.height / Q);
    // Exposure lift: the painted floor and bodies are dark even in full light, so the lit world gets a
    // flat gain (the canvas added onto itself at EXPOSURE_LIFT alpha) before the edge vignette goes on.
    target.save();
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.globalCompositeOperation = "lighter";
    target.globalAlpha = EXPOSURE_LIFT;
    target.drawImage(target.canvas, 0, 0);
    target.restore();
    target.globalCompositeOperation = "source-over";
    target.drawImage(this.vignette(), 0, 0, this.w, this.h);
    target.imageSmoothingEnabled = sm;
  }

  private vignette(): HTMLCanvasElement {
    if (this.vig) return this.vig;
    const w = 256;
    const h = Math.max(32, Math.round((256 * this.h) / Math.max(1, this.w)));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d")!;
    g.setTransform(1, 0, 0, h / w, 0, 0);
    const gr = g.createRadialGradient(w / 2, w / 2, w * 0.36, w / 2, w / 2, w * 0.78);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.35, "rgba(0,0,0,0.18)");
    gr.addColorStop(0.7, "rgba(0,0,0,0.5)");
    gr.addColorStop(1, "rgba(0,0,0,0.78)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
    this.vig = cv;
    return cv;
  }
}
