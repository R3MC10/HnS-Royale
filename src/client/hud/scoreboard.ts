// Hold-to-show standings table (royale package, HUD-SPEC S / STYLE v2). Core calls this only while
// v.showScoreboard. Carved-stone panel, serif text, your row framed in gold.
import type { HudCtx } from "./types";
import { SKIN, drawSkinPanel, rgba, skinText } from "./skin";

const ROW = 10;
const HEAD = 28; // title + column header

export function drawScoreboard(c: HudCtx): void {
  const { g, v, L } = c;
  if (!c.s.joined) return;
  const rows = [...v.board].sort(
    (a, b) => Number(b.alive) - Number(a.alive) || b.kills - a.kills || b.wins - a.wins,
  );
  const base = L.scoreboard;
  const maxRows = Math.max(0, Math.floor((base.h - HEAD - 6) / ROW));
  const shown = rows.slice(0, maxRows);
  const h = Math.min(base.h, HEAD + 6 + ROW * Math.max(1, shown.length) + (rows.length > shown.length ? 9 : 0));
  const { x, y, w } = base;

  drawSkinPanel(g, { x, y, w, h }, { alpha: 0.96 });
  skinText(g, "Standings", x + w / 2, y + 5, { size: 8, face: "display", align: "center", color: SKIN.gold });
  skinText(g, `${v.alive} of ${v.total} standing`, x + w / 2, y + 14, { size: 5.5, align: "center", color: SKIN.inkDim });
  const hy = y + HEAD - 6;
  const colStatus = x + 120; // leaves room for the "Player kills" header
  const colKills = x + 180;
  const colWins = x + w - 8;
  const hd = { size: 5.5, color: SKIN.inkFaint, face: "display" as const };
  skinText(g, "#", x + 8, hy, hd);
  skinText(g, "Player", x + 28, hy, hd);
  skinText(g, "Status", colStatus, hy, hd);
  skinText(g, "Player kills", colKills, hy, { ...hd, align: "right" });
  skinText(g, "Wins", colWins, hy, { ...hd, align: "right" });
  const lg = g.createLinearGradient(x + 6, 0, x + w - 6, 0);
  lg.addColorStop(0, "rgba(216,184,96,0)");
  lg.addColorStop(0.5, "rgba(216,184,96,0.6)");
  lg.addColorStop(1, "rgba(216,184,96,0)");
  g.fillStyle = lg;
  g.fillRect(x + 6, hy + 7, w - 12, 0.35);

  shown.forEach((p, i) => {
    const ry = y + HEAD + 2 + i * ROW;
    const mine = p.id === v.selfId;
    const col = p.alive ? SKIN.ink : "#7a7062";
    if (mine) {
      g.fillStyle = rgba(SKIN.gold, 0.08);
      g.fillRect(x + 5, ry - 1.5, w - 10, ROW - 0.5);
      g.lineWidth = 0.45;
      g.strokeStyle = rgba(SKIN.gold, 0.75);
      g.strokeRect(x + 5, ry - 1.5, w - 10, ROW - 0.5);
    } else if (i % 2 === 1) {
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(x + 5, ry - 1.5, w - 10, ROW - 0.5);
    }
    skinText(g, String(i + 1), x + 8, ry, { size: 6, color: SKIN.inkDim });
    g.fillStyle = "rgba(0,0,0,0.9)";
    g.beginPath();
    g.arc(x + 21, ry + 3.3, 2.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(x + 21, ry + 3.3, 1.7, 0, Math.PI * 2);
    g.fill();
    const name = p.name.length > 18 ? p.name.slice(0, 17) + "." : p.name;
    skinText(g, name, x + 28, ry, { size: 6.5, color: mine ? "#f6e8c8" : col, face: mine ? "display" : "body", maxW: colStatus - x - 32 });
    skinText(g, p.alive ? "Alive" : "Fallen", colStatus, ry, { size: 6, color: p.alive ? "#8cc070" : "#a05040" });
    skinText(g, String(p.kills), colKills, ry, { size: 6.5, color: col, align: "right" });
    skinText(g, String(p.wins), colWins, ry, { size: 6.5, color: col, align: "right" });
  });
  if (rows.length > shown.length) {
    skinText(g, `+${rows.length - shown.length} more`, x + w / 2, y + h - 10, { size: 5.5, align: "center", color: SKIN.inkDim });
  }
}
