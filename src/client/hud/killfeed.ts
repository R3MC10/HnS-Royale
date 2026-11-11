// Killfeed (royale package, HUD-SPEC R / STYLE v2). Top-left under the debuff row, no backing plate:
// a small crossed-blades glyph then smooth serif text. Newest at the bottom, max 6 lines, 8 s life,
// fading over the last 1 s. Your kills gold, your death red, a rare/unique monster killer orange.
import { laneBusy, laneClaim } from "./lanes";
import type { HudCtx, HudRect } from "./types";
import { hudFlushHints, type KillFeedEntry } from "./state";
import { SKIN, skinText, skinTextW } from "./skin";
import { tr } from "../i18n";

const LIFE = 8;
const FADE = 1;
const MAX_LINES = 6;
const PITCH = 8.5;
const SIZE = 6.5;
const GLYPH_W = 8;

const C_TEXT = "#f2ece2";
const C_MINE_KILL = "#e8c050";
const C_MINE_DIED = "#e05040";
const C_ENV = "#b8b0a2";
const C_INFO = "#a89c88";
const C_BOSS = "#e8a03a";
/** Monster killer colour by rarity (normal / magic / rare / unique). */
const C_RARITY = ["#c8c0b0", "#8a9cff", "#e8902c", "#d8873a"];

/** Translate, then shorten: clipping the English first left a cut name no dictionary entry matches ("Bloodscent Barkgn."). */
function clip(s: string, n: number): string {
  s = tr(s);
  return s.length > n ? s.slice(0, n - 1) + "." : s;
}

interface Seg {
  s: string;
  col: string;
}

function killSegs(e: KillFeedEntry, selfId: number): Seg[] {
  const youKilled = e.mine === 1 || (e.kid !== undefined && e.kid === selfId);
  const youDied = e.mine === 2 || (e.vid !== undefined && e.vid === selfId);
  const line = youDied ? C_MINE_DIED : youKilled ? C_MINE_KILL : C_TEXT;
  const env = e.kid === undefined;
  const killerCol = youKilled ? C_MINE_KILL : env ? (e.kr !== undefined ? C_RARITY[e.kr] ?? C_ENV : C_ENV) : C_TEXT;
  const segs: Seg[] = [
    { s: clip(e.killer ?? "?", 18), col: killerCol },
    { s: `  ${tr("slew")}  `, col: C_INFO },
    { s: clip(e.victim ?? "?", 18), col: youDied ? C_MINE_DIED : line },
  ];
  if (e.place) segs.push({ s: `  #${e.place}`, col: youDied ? C_MINE_DIED : C_INFO });
  return segs;
}

/** Two crossed blades with hilt dots (original procedural glyph), centred at (x, y). */
function crossedBlades(g: CanvasRenderingContext2D, x: number, y: number, col: string) {
  g.save();
  g.translate(x, y);
  g.lineCap = "round";
  for (const sgn of [1, -1]) {
    g.save();
    g.rotate((sgn * Math.PI) / 4);
    // shadow
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -3.2);
    g.lineTo(0, 2.6);
    g.stroke();
    // blade
    g.strokeStyle = col;
    g.lineWidth = 0.65;
    g.beginPath();
    g.moveTo(0, -3.2);
    g.lineTo(0, 1.6);
    g.stroke();
    // guard
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(-1, 1.6);
    g.lineTo(1, 1.6);
    g.stroke();
    // hilt dot
    g.fillStyle = SKIN.bronze;
    g.beginPath();
    g.arc(0, 2.6, 0.55, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.restore();
}

/** Feed rect: top-left, below the debuff row (layout's L.feed is the old right-hand spot). */
export function feedRect(c: HudCtx): HudRect {
  const d = c.L.debuffs;
  return { x: 4, y: d.y + d.h + 6, w: 170, h: MAX_LINES * PITCH };
}

export function drawKillfeed(c: HudCtx): void {
  const { s, g, v } = c;
  if (!s.joined) return;
  hudFlushHints(laneBusy("boss") || laneBusy("round"));
  if (!s.feed.length) return;
  const now = performance.now() / 1000;
  const live = s.feed.filter((e) => now - e.t < LIFE).slice(-MAX_LINES);
  if (!live.length) return;
  const r = feedRect(c);
  laneClaim("feed", { x: 0, y: r.y - 1, w: r.x + r.w, h: live.length * PITCH + 2 }); // lanes: world labels keep out
  const selfId = v.selfId ?? s.selfId;
  // newest at the bottom: the block grows downwards from the top of the rect
  let y = r.y;
  for (const e of live) {
    const left = LIFE - (now - e.t);
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, left / FADE));
    if (e.kind === "info") {
      const boss = / (awakens|has fallen)$/.test(e.text ?? ""); // the boss waking / falling: a match event, not chatter
      skinText(g, clip(e.text ?? "", 48), r.x, y, { size: SIZE, color: boss ? C_BOSS : C_INFO, maxW: r.w });
    } else {
      const segs = killSegs(e, selfId);
      const mineCol = e.mine === 2 ? C_MINE_DIED : e.mine === 1 ? C_MINE_KILL : SKIN.inkDim;
      crossedBlades(g, r.x + 3.5, y + SIZE / 2 + 0.3, mineCol);
      let x = r.x + GLYPH_W;
      for (const sg of segs) {
        const w = skinTextW(sg.s, { size: SIZE });
        if (x + w > r.x + r.w + 40) break;
        skinText(g, sg.s, x, y, { size: SIZE, color: sg.col });
        x += w;
      }
    }
    g.restore();
    y += PITCH;
  }
}
