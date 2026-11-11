// Small 2D canvases are caches here (terrain chunks, painted ground, silhouettes, gore layers, hero frames).
// Chrome keeps every 2D canvas on the GPU until the page's canvases pass a fixed GPU memory cap (about
// 512 MB, reached after roaming 8-16 places). Past the cap the frame time went from 8 ms to 30-60 ms and
// never recovered. `willReadFrequently` keeps a canvas in normal memory, so the caches no longer count
// towards that cap. Measured: six roam passes at 7.6 ms median, where it used to break in pass 2-5.
// Must be imported before any canvas is created.
// The big per-frame canvases (the world pass, HUD overlay, light map) must stay on the GPU: they pass
// `willReadFrequently: false` explicitly, which is kept. Created at the default 300x150 they used to be
// made software canvases here, so the whole world was rasterised on the main thread and every drawImage
// of a GPU source into them (3D hero, flat layer) was a synchronous GPU readback (frame hitches).
const SOFT_MAX = 512;
const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, t: string, o?: unknown) => unknown;
(HTMLCanvasElement.prototype as { getContext: unknown }).getContext = function (this: HTMLCanvasElement, t: string, o?: unknown) {
  if (t === "2d" && !this.isConnected && this.width <= SOFT_MAX && this.height <= SOFT_MAX && (o as { willReadFrequently?: boolean } | undefined)?.willReadFrequently !== false) {
    o = { ...(o as object | undefined), willReadFrequently: true };
  }
  return getContext.call(this, t, o);
};
export {};
