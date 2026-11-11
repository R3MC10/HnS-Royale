// Spectate overlay (royale package, HUD-SPEC U / STYLE v2). Bottom-centre carved-stone panel while
// dead in a match: who you are watching (name, level, kills, life / shield), previous / next arrow
// buttons with their keys, your placement, and a Leave button (the Esc menu's confirm-then-leave flow).
// Drawn only for a joined client whose own snapshot exists and is dead.
import type { HudCtx, HudRect } from "./types";
import { actionLabel } from "../keybinds";
import { requestLeaveMatch } from "../options";
import { SKIN, drawSkinBar, drawSkinButton, drawSkinPanel, skinText, skinTextW } from "./skin";

const DIM = SKIN.inkDim;
const TEXT = SKIN.ink;

/** Gilt rule across a panel (thin bronze line with a darker shadow under it). */
function rule(g: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const lg = g.createLinearGradient(x, 0, x + w, 0);
  lg.addColorStop(0, "rgba(216,184,96,0)");
  lg.addColorStop(0.5, "rgba(216,184,96,0.7)");
  lg.addColorStop(1, "rgba(216,184,96,0)");
  g.fillStyle = "rgba(0,0,0,0.6)";
  g.fillRect(x, y + 0.35, w, 0.35);
  g.fillStyle = lg;
  g.fillRect(x, y, w, 0.35);
}

/** Painted arrow button: stone button with a carved chevron. */
function arrowButton(c: HudCtx, r: HudRect, key: string, dir: 1 | -1) {
  const hov = c.hot(r, {
    tip: [dir === 1 ? "Watch next player" : "Watch previous player", `Key: ${key}`],
    onClick: () => c.send({ t: "spec", dir }),
  });
  const g = c.g;
  drawSkinButton(g, r, hov ? "hover" : "normal");
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const s = Math.min(r.w, r.h) * 0.24;
  g.save();
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx - dir * s * 0.6, cy - s);
  g.lineTo(cx + dir * s * 0.7, cy);
  g.lineTo(cx - dir * s * 0.6, cy + s);
  g.strokeStyle = "rgba(0,0,0,0.85)";
  g.lineWidth = 1.6;
  g.stroke();
  g.strokeStyle = hov ? "#fff0d0" : SKIN.gold;
  g.lineWidth = 0.8;
  g.stroke();
  g.restore();
}

export function drawSpectate(c: HudCtx): void {
  const { v, s, L, g } = c;
  // Only for a character that exists in a match and has died (never in menus / while loading).
  if (!s.joined || !v.self || v.self.alive) return;
  const r = L.spectate;
  const cx = r.x + r.w / 2;

  if (v.phase === "waiting") {
    const pr = { x: r.x + 50, y: r.y + 18, w: r.w - 100, h: 16 };
    drawSkinPanel(g, pr, { rivets: false });
    skinText(g, "Rising again...", cx, pr.y + 4.5, { size: 7, face: "display", align: "center", color: TEXT });
    return;
  }
  if (v.phase !== "fight" && v.phase !== "ended") return;

  drawSkinPanel(g, r);
  const t = v.spectating;

  // Leave button, top-right corner (above the panel edge so it never covers the target's name)
  const leave = { x: r.x + r.w - 30, y: r.y - 11, w: 30, h: 10 };
  const lh = c.hot(leave, { tip: ["Leave match (optional)", "In a hall: back to the hall, which everyone rejoins when the match ends", "You can keep watching until the end instead"], onClick: () => requestLeaveMatch() });
  drawSkinButton(g, leave, lh ? "hover" : "normal", "Leave", { size: 5.5, color: lh ? "#ffd8c0" : "#e0b0a0" });

  if (!t) {
    skinText(g, "No one left to watch", cx, r.y + 8, { size: 7, face: "display", align: "center", color: DIM });
  } else {
    // Row 1: Watching <name>  Lv N  Kills k
    const kills = v.board.find((b) => b.id === t.id)?.kills ?? 0;
    const parts: { s: string; col: string; face?: "display" | "body" }[] = [
      { s: "Watching ", col: DIM },
      { s: t.name.length > 16 ? t.name.slice(0, 15) + "." : t.name, col: t.color, face: "display" },
      { s: t.lv !== undefined ? `   Lv ${t.lv}` : "", col: TEXT },
      { s: `   Player kills ${kills}`, col: TEXT },
    ];
    const size = 7;
    let x = cx - parts.reduce((n, p) => n + (p.s ? skinTextW(p.s, { size, face: p.face }) : 0), 0) / 2;
    for (const p of parts) {
      if (!p.s) continue;
      x += skinText(g, p.s, x, r.y + 4, { size, color: p.col, face: p.face });
    }

    // Row 2: life bar with energy shield overlay
    const bar = { x: Math.round(cx - 75), y: r.y + 14, w: 150, h: 5 };
    const hf = t.maxHp > 0 ? Math.max(0, Math.min(1, t.hp / t.maxHp)) : 0;
    const ef = t.esm && t.esm > 0 ? Math.max(0, Math.min(1, (t.es ?? 0) / t.esm)) : undefined;
    drawSkinBar(g, bar, { frac: hf, color: "#b0302a", frac2: ef, color2: SKIN.es });
    c.hot(bar, {
      tip: [t.name, `Life ${Math.ceil(t.hp)} / ${Math.ceil(t.maxHp)}`, ...(t.esm ? [`Shield ${Math.ceil(t.es ?? 0)} / ${Math.ceil(t.esm)}`] : [])],
    });
  }
  rule(g, r.x + 10, r.y + r.h - 16, r.w - 20);

  // Row 3: prev / next arrow buttons at the panel edges, key hints, own placement in the middle.
  const by = r.y + r.h - 13;
  const prevKey = actionLabel("specPrev");
  const nextKey = actionLabel("specNext");
  const prev = { x: r.x + 5, y: by, w: 14, h: 10 };
  const next = { x: r.x + r.w - 19, y: by, w: 14, h: 10 };
  arrowButton(c, prev, prevKey, -1);
  arrowButton(c, next, nextKey, 1);
  skinText(g, `[${prevKey}]`, prev.x + prev.w + 3, by + 2, { size: 6, color: DIM });
  skinText(g, `[${nextKey}]`, next.x - 3, by + 2, { size: 6, color: DIM, align: "right" });
  const pl = s.me?.pl;
  if (pl) skinText(g, `You placed #${pl} of ${v.total}`, cx, by + 1.5, { size: 7, face: "display", align: "center", color: SKIN.gold });
}
