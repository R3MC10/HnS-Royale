// DEV-ONLY cinematic camera (trailer capture). Inert unless both ?dev=1 and ?cine=1 are present:
// without them nothing is installed on window and cineApply() is never called.
//   window.hnsCine.shot({ ax?, ay?, from?, to?, secs?, hud? })  start one camera move
//     ax, ay    absolute world anchor; omit to anchor on the normal camera target (the hero)
//     from, to  { dx, dy, zoom }: world-px offset from the anchor + zoom (1 = default); `to` is held after the move
//     secs      move duration (smoothstep ease), default 0 (static)
//     hud       false hides the HUD while the shot is active (default false)
//   window.hnsCine.off()   back to the normal camera, HUD shown
import { setHudHidden } from "./hud/dock";

export const CINE = (() => {
  try {
    const q = new URLSearchParams(location.search);
    return q.get("dev") === "1" && q.get("cine") === "1";
  } catch {
    return false;
  }
})();

interface Pose {
  dx?: number;
  dy?: number;
  zoom?: number;
}
interface Shot {
  ax?: number;
  ay?: number;
  from?: Pose;
  to?: Pose;
  secs?: number;
  hud?: boolean;
}

let shot: Shot | null = null;
let t0 = 0;

if (CINE) {
  (window as unknown as { hnsCine: unknown }).hnsCine = {
    shot(s: Shot) {
      shot = s;
      t0 = performance.now();
      setHudHidden(s.hud !== true);
    },
    off() {
      shot = null;
      setHudHidden(false);
    },
  };
}

/** Camera for this frame: (x, y) is the normal camera target. Null when no shot is active. */
export function cineApply(x: number, y: number): { x: number; y: number; zoom: number } | null {
  if (!shot) return null;
  const to = shot.to ?? shot.from ?? {};
  const from = shot.from ?? to;
  const u = shot.secs ? Math.min(1, (performance.now() - t0) / 1000 / shot.secs) : 1;
  const e = u * u * (3 - 2 * u);
  const mix = (a = 0, b = 0) => a + (b - a) * e;
  // zoom is interpolated in log space so a push-in has an even apparent speed
  const zoom = Math.exp(mix(Math.log(from.zoom ?? 1), Math.log(to.zoom ?? 1)));
  return { x: (shot.ax ?? x) + mix(from.dx, to.dx), y: (shot.ay ?? y) + mix(from.dy, to.dy), zoom };
}
