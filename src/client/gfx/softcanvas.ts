// Small 2D canvases are caches here (terrain chunks, painted ground, silhouettes, gore layers, hero frames).
// Chrome keeps every 2D canvas on the GPU until the page's canvases pass a fixed GPU memory cap (about
// 512 MB, reached after roaming 8-16 places). Past the cap the frame time went from 8 ms to 30-60 ms and
// never recovered. `willReadFrequently` keeps a canvas in normal memory, so the caches no longer count
// towards that cap. Measured: six roam passes at 7.6 ms median, where it used to break in pass 2-5.
// Must be imported before any canvas is created.
const SOFT_MAX = 512;
const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, t: string, o?: unknown) => unknown;
(HTMLCanvasElement.prototype as { getContext: unknown }).getContext = function (this: HTMLCanvasElement, t: string, o?: unknown) {
  if (t === "2d" && !this.isConnected && this.width <= SOFT_MAX && this.height <= SOFT_MAX) {
    o = { ...(o as object | undefined), willReadFrequently: true };
  }
  return getContext.call(this, t, o);
};
export {};
