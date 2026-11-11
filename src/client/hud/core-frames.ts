// HUD core frames (skin foundation): the static painted backplates of the bottom band, drawn under every
// other part: the carved stone strip behind the DOM skill bar and the belt strap behind flasks/charms.
import type { HudCtx, HudRect } from "./types";
import { drawSkinStrip } from "./skin";
import { leftCluster } from "./belt";

const grow = (r: HudRect, x: number, y: number): HudRect => ({ x: r.x - x, y: r.y - y, w: r.w + x * 2, h: r.h + y * 2 });

export function drawBottomFrames(c: HudCtx): void {
  const me = c.v.self;
  if (!me || !me.alive) return; // the bottom band hides while dead (HUD-SPEC 2.5 U)
  const { g, L } = c;
  // Left cluster: a low strap under the charm slots + menu buttons (the flasks stand free in their own niches).
  const cl = leftCluster(c);
  const first = cl.charms[0] ?? cl.menu;
  drawSkinStrip(g, grow({ x: first.x, y: L.charmSlots[0].y, w: cl.end - first.x, h: L.charmSlots[0].h }, 2.5, 2), "belt");
  // Stone strip behind the DOM skill bar (2 rows of 8) and the weapon-set tabs.
  const bar = L.skillBar;
  const x0 = Math.min(bar.x, L.weaponSet.x);
  drawSkinStrip(g, grow({ x: x0, y: bar.y, w: bar.x + bar.w - x0, h: bar.h }, 3.5, 3));
}
