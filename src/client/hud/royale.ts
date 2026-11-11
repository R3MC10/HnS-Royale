// Royale HUD layer (royale package): perf line (L), royale info cluster (Q), elimination / win banner
// (T), death recap ("Last blows"), death dim + world desaturation, minimap hotspots and the waypoint
// beacon. Smooth skin text and painted frames (STYLE v2). Labels are original.
import type { HudCtx } from "./types";
import type { TakenHit } from "./state";
import { hudState } from "./state";
import { getSettings } from "../settings";
import { setProgBannerMuted } from "../prog";
import { MIN_PLAYERS_FOR_ROUND } from "../../shared/constants";
import { DAMAGE_COLORS, type DamageType } from "../../shared/defence";
import { MONSTER_BY_ID } from "../../shared/content/monsters";
import { SKIN, drawSkinPanel, skinText, skinTextW, skinTitle } from "./skin";
import { drawCampHintHud, drawWaypointHud, installMapInput, isMapOverlayOpen, minimapHots, resetMapState } from "./minimap";
import { isRightDockOpen } from "./dock";
import { laneClaim } from "./lanes";

const BANNER_TIME = 4;
const BANNER_FADE = 0.5;
const RECAP_TIME = 14;

const DIM = "#9a8c72";
const WARN = "#ffb347";
const TEXT = "#d8ccb0";
const RED = "#e05040";

// Elimination / win banner tracking (client seconds, performance.now()/1000).
let prevAlive: boolean | null = null;
let elimStart = 0;
let lastElimAt = 0;
let winStart = 0;
let winShown = false;
let revealStart = 0;
let wasReveal = false;
// Death recap
let recapOpen = false;
let recapSpecId = -1;
let recapSpecChanges = 0;
// World grade (read by render.ts through hudWorldGrade, after the HUD pass of the same frame)
let gradeOn = false;
let gradeSince = 0;
let wasJoined = false;
let escHooked = false;

function nowS(): number {
  return performance.now() / 1000;
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

/** L: ping (or OFFLINE) then fps, laid out left to right so they never overlap. */
function drawPerf(c: HudCtx) {
  const { v, L } = c;
  const gs = getSettings().graphics;
  let x = L.perf.x;
  const y = L.perf.y;
  if (gs.showPing || !v.connected) {
    const s = v.connected ? `${Math.round(v.ping)} ms` : "Offline";
    const col = !v.connected || v.ping > 150 ? WARN : DIM;
    c.text(s, x, y, col);
    x += c.textW(s) + 6;
  }
  if (gs.showFps) c.text(`${Math.round(c.fps)} fps`, x, y, DIM);
}

/** Q: two right-aligned lines under the minimap (and its area name). */
function drawCluster(c: HudCtx) {
  const { v, s, L } = c;
  if (isRightDockOpen()) return; // the docked inventory covers the top-right corner
  if (isMapOverlayOpen()) return; // polish: the Tab overlay's info block already shows these lines
  const r = L.royale;
  const rx = r.x + r.w;
  const off = getSettings().interface.showMinimap !== false ? 8 : 0; // the area name sits under the map frame
  const y1 = r.y + off;
  const y2 = y1 + 9;
  if (v.phase === "waiting") {
    c.text("Practice arena", rx, y1, "#c8b080", "right"); // polish: the old "Practice x/2" read like a score
  } else {
    const head = "Alive ";
    const tail = ` / ${v.total}`;
    const a = String(v.alive);
    const aw = c.textW(a);
    const tw = c.textW(tail);
    c.text(tail, rx, y1, TEXT, "right");
    c.text(a, rx - tw, y1, v.last?.length ? RED : TEXT, "right"); // red while survivors are shown on the map (REVEAL_ALIVE / REVEAL_AFTER)
    c.text(head, rx - tw - aw, y1, "#9a8c72", "right");
  }
  const k = s.me?.k ?? 0;
  // Match clock only (server time, frozen on the round-end screen). The countdowns have their own big
  // centre banners; showing them here too made this read as a wrong match time.
  const clock = s.matchSecs >= 0 ? mmss(s.matchSecs) : "";
  const line2 = clock ? `Player kills ${k}   ${clock}` : `Player kills ${k}`;
  const hov = c.hot(
    { x: r.x, y: y1, w: r.w, h: r.h },
    {
      tip: [
        v.phase === "waiting" ? "Practice arena: monsters, quick respawns" : `${v.alive} of ${v.total} still standing${v.last?.length ? " · survivors are shown on the map" : ""}`,
        `Players you killed this match: ${k}`,
        v.phase === "waiting" ? `Waiting for players (${v.total} here, ${MIN_PLAYERS_FOR_ROUND} needed to start)` : v.phase === "ended" ? "Clock: how long the round lasted" : v.phase === "fight" ? "Clock: match time" : "The round is about to begin",
      ],
    },
  );
  c.text(line2, rx, y2, hov ? "#f0e4c8" : TEXT, "right");
}

function bannerAlpha(start: number, now: number): number {
  const age = now - start;
  if (age < 0 || age > BANNER_TIME) return 0;
  return Math.min(1, (BANNER_TIME - age) / BANNER_FADE, age / 0.25);
}

/** Track own death / round win (drives banner, recap and world grade). */
function track(c: HudCtx) {
  const { v, s } = c;
  const now = nowS();
  const alive = !!v.self?.alive;
  if (v.self && prevAlive === true && !alive && v.phase === "fight") {
    elimStart = s.elimAt > 0 ? s.elimAt : now;
    lastElimAt = s.elimAt;
    recapOpen = true;
    recapSpecId = v.spectating?.id ?? -1;
    recapSpecChanges = 0;
  } else if (s.elimAt > 0 && s.elimAt !== lastElimAt && v.phase === "fight") {
    elimStart = s.elimAt;
    lastElimAt = s.elimAt;
    recapOpen = true;
    recapSpecId = v.spectating?.id ?? -1;
    recapSpecChanges = 0;
  }
  if (alive) {
    elimStart = 0;
    recapOpen = false;
    if (s.elimAt === 0) lastElimAt = 0;
  }
  if (v.self) prevAlive = alive;

  // Survivor reveal (server sends `last` from REVEAL_ALIVE left or REVEAL_AFTER seconds): announce it once.
  const rev = v.phase === "fight" && !!v.last?.length;
  if (rev && !wasReveal) revealStart = now;
  if (!rev) revealStart = 0;
  wasReveal = rev;

  setProgBannerMuted(v.phase === "ended");
  if (v.phase === "ended") {
    if (!winShown && s.me?.pl === 1 && v.winner) { // polish: no "Last One Standing" over "None Survived"
      winShown = true;
      winStart = now;
    }
  } else {
    winShown = false;
    winStart = 0;
  }

  // world grade: dead with a character, in the fight or its end screen
  const dead = !!v.self && !alive && (v.phase === "fight" || v.phase === "ended") && (elimStart > 0 || s.elimAt > 0);
  if (dead && !gradeOn) gradeSince = elimStart > 0 ? elimStart : now;
  gradeOn = dead;

  // recap closes when the spectate target is changed by the player, after a while, or on Esc
  if (recapOpen) {
    const sid = v.spectating?.id ?? -1;
    if (sid !== recapSpecId) {
      if (recapSpecId !== -1) recapSpecChanges++;
      recapSpecId = sid;
    }
    if (recapSpecChanges > 0 || (elimStart > 0 && now - elimStart > RECAP_TIME)) recapOpen = false;
  }
}

/** T: ELIMINATED / placement / killer, or LAST ONE STANDING (serif title face). Returns the banner bottom (u) or 0. */
function drawBanner(c: HudCtx): number {
  const { v, s, L, g } = c;
  const now = nowS();
  const cx = L.centre.x;
  const cy = L.centre.y;
  const wa = winStart > 0 ? bannerAlpha(winStart, now) : 0;
  if (wa > 0) {
    g.save();
    g.globalAlpha = wa;
    // Kept above render.ts' own round-end title so the two never overlap.
    skinTitle(g, "Last One Standing", cx, cy - 100, 16, "center", "#fff4c8", "#c89a3c");
    g.restore();
    return 0;
  }
  const ra = revealStart > 0 ? bannerAlpha(revealStart, now) : 0;
  if (ra > 0) {
    g.save();
    g.globalAlpha = ra;
    skinTitle(g, "Survivors Revealed", cx, cy - 112, 11, "center", "#ffd8b0", "#a0281c");
    skinText(g, "Everyone left is marked on the map", cx, cy - 98, { size: 6.5, align: "center", color: TEXT });
    g.restore();
  }
  if (elimStart <= 0) return 0;
  // If the round ended under the banner, drop it below render.ts' round-end title + "NEXT ROUND IN" line.
  const by = v.phase === "ended" ? cy - 14 : cy - 72;
  const ea = bannerAlpha(elimStart, now);
  const pl = s.me?.pl ?? v.alive + 1;
  if (ea > 0) {
    g.save();
    g.globalAlpha = ea;
    // dark soft band behind the title for legibility over the world
    const band = g.createLinearGradient(cx - 120, 0, cx + 120, 0);
    band.addColorStop(0, "rgba(8,5,5,0)");
    band.addColorStop(0.5, "rgba(8,5,5,0.6)");
    band.addColorStop(1, "rgba(8,5,5,0)");
    g.fillStyle = band;
    g.fillRect(cx - 120, by - 3, 240, 36);
    laneClaim("banner", { x: cx - 90, y: by - 3, w: 180, h: 36 }); // lanes: world labels keep out
    skinTitle(g, "Eliminated", cx, by, 16, "center", "#ffb8a0", "#a0281c");
    skinText(g, `Placed #${pl} of ${v.total}`, cx, by + 19, { size: 7, face: "display", align: "center", color: TEXT });
    if (s.me?.kb) skinText(g, `by ${s.me.kb}`, cx, by + 27, { size: 6.5, align: "center", color: "#c0b098" });
    g.restore();
  }
  return v.phase === "ended" ? 0 : by + 38;
}

// ---- death recap ---------------------------------------------------------------------------------

const TYPE_LABEL: Record<string, string> = { phys: "physical", fire: "fire", cold: "cold", light: "lightning", chaos: "chaos" };

function typeCol(ty: string | undefined): string {
  if (!ty || ty === "phys") return "#d8ccb0";
  return DAMAGE_COLORS[ty as DamageType] ?? "#d8ccb0";
}

/** Killer's visible life fraction (player by name, else a monster whose name matches), or null. */
function killerLife(c: HudCtx, name: string | undefined): number | null {
  if (!name) return null;
  for (const p of c.v.players.values()) if (p.name === name && p.alive && p.maxHp > 0) return p.hp / p.maxHp;
  const n = name.toLowerCase();
  for (const m of c.v.monsters.values()) {
    const mn = (m.n ?? MONSTER_BY_ID.get(m.k)?.name ?? m.k).toLowerCase();
    if (m.hp > 0 && m.mhp > 0 && (mn === n || n.includes(mn))) return m.hp / m.mhp;
  }
  return null;
}

function drawRecap(c: HudCtx, top: number) {
  if (!recapOpen || elimStart <= 0 || top <= 0) return;
  const { g, s, L } = c;
  const now = nowS();
  const hits: TakenHit[] = s.taken.filter((h) => h.at <= elimStart + 0.6 && h.at >= elimStart - 12);
  if (!hits.length) return;
  const last = hits.slice(-5).reverse();
  // damage totalled by source over the final 5 s
  const totals = new Map<string, { dmg: number; rr?: number }>();
  for (const h of hits) {
    if (h.at < elimStart - 5) continue;
    const t = totals.get(h.by) ?? { dmg: 0, rr: h.rr };
    t.dmg += h.dmg;
    totals.set(h.by, t);
  }
  const tot = [...totals.entries()].sort((a, b) => b[1].dmg - a[1].dmg).slice(0, 3);
  const kl = killerLife(c, s.me?.kb);

  const w = 190;
  const rowH = 8;
  const h = 16 + last.length * rowH + (tot.length ? 6 + tot.length * rowH : 0) + (kl !== null ? 9 : 0) + 5;
  const x = Math.round(L.centre.x - w / 2);
  const y = Math.round(Math.min(top + 2, L.spectate.y - h - 16));
  const appear = Math.min(1, Math.max(0, (now - elimStart - 0.6) / 0.4));
  if (appear <= 0) return;
  g.save();
  g.globalAlpha = appear;
  const r = { x, y, w, h };
  drawSkinPanel(g, r, { alpha: 0.94 });
  laneClaim("banner", r);
  c.hot(r, { tip: ["Last blows", "Click or press Esc to close"], onClick: () => (recapOpen = false) });
  skinText(g, "Last blows", x + w / 2, y + 4, { size: 7.5, face: "display", align: "center", color: SKIN.gold });
  let yy = y + 15;
  for (const hit of last) {
    const ago = Math.max(0, elimStart - hit.at);
    const nameCol = hit.pid !== undefined ? "#e8dcc4" : hit.rr !== undefined && hit.rr >= 2 ? "#e8902c" : hit.rr === 1 ? "#8a9cff" : "#c8c0b0";
    skinText(g, hit.by.length > 20 ? hit.by.slice(0, 19) + "." : hit.by, x + 7, yy, { size: 6, color: nameCol, maxW: 82 });
    const tag = hit.dot ? "over time" : hit.heavy ? "heavy" : TYPE_LABEL[hit.ty ?? "phys"] ?? "";
    skinText(g, tag, x + 96, yy, { size: 5.5, color: typeCol(hit.ty) });
    skinText(g, String(Math.round(hit.dmg)), x + w - 30, yy, { size: 6.5, align: "right", color: hit.heavy ? "#ff9070" : TEXT, face: "display" });
    skinText(g, ago < 0.05 ? "last" : `-${ago.toFixed(1)}s`, x + w - 6, yy + 0.5, { size: 5, align: "right", color: SKIN.inkFaint });
    yy += rowH;
  }
  if (tot.length) {
    g.fillStyle = "rgba(216,184,96,0.35)";
    g.fillRect(x + 8, yy + 1.5, w - 16, 0.35);
    yy += 5;
    for (const [name, t] of tot) {
      skinText(g, `${name.length > 22 ? name.slice(0, 21) + "." : name}`, x + 7, yy, { size: 6, color: SKIN.inkDim, maxW: 110 });
      const label = `${Math.round(t.dmg)} in the last 5 s`;
      skinText(g, label, x + w - 6, yy, { size: 6, align: "right", color: TEXT });
      yy += rowH;
    }
  }
  if (kl !== null) {
    const pct = Math.max(0, Math.round(kl * 100));
    const lbl = "Your killer has ";
    const lw = skinTextW(lbl, { size: 6 });
    const total = lw + skinTextW(`${pct}% life left`, { size: 6 });
    const sx = x + w / 2 - total / 2;
    skinText(g, lbl, sx, yy + 1, { size: 6, color: SKIN.inkDim });
    skinText(g, `${pct}% life left`, sx + lw, yy + 1, { size: 6, color: pct <= 30 ? "#ff8060" : TEXT });
  }
  g.restore();
}

// ---- death dim -------------------------------------------------------------------------------------

/** Grade strength: heavy for the first 2 s after death, then lighter while spectating. */
function gradeAmount(): { sat: number; dark: number } {
  if (!gradeOn) return { sat: 0, dark: 0 };
  const t = nowS() - gradeSince;
  const inA = Math.min(1, Math.max(0, t / 0.35));
  const k = t < 2 ? 1 : Math.max(0, 1 - (t - 2) / 1.2); // 1 = heavy, 0 = spectating level
  return { sat: inA * (0.45 + 0.45 * k), dark: inA * (0.12 + 0.23 * k) };
}

/** HUD part (hud/index.ts, right after the vignette): a soft dark edge while dead, under the rest of the HUD. */
export function drawDeathDim(c: HudCtx): void {
  if (!c.s.joined || !gradeOn) return;
  const { g, L } = c;
  const a = gradeAmount();
  if (a.dark <= 0) return;
  const cx = L.w / 2;
  const cy = L.h / 2;
  const rg = g.createRadialGradient(cx, cy, Math.min(L.w, L.h) * 0.3, cx, cy, Math.max(L.w, L.h) * 0.75);
  rg.addColorStop(0, "rgba(10,8,8,0)");
  rg.addColorStop(1, `rgba(10,6,6,${(a.dark * 1.6).toFixed(3)})`);
  g.save();
  g.fillStyle = rg;
  g.fillRect(0, 0, L.w, L.h);
  g.restore();
}

/** render.ts, before the HUD is blitted: desaturate + darken the world canvas while dead. */
export function hudWorldGrade(g: CanvasRenderingContext2D, w: number, h: number): void {
  if (!hudState.joined || !gradeOn) return;
  const a = gradeAmount();
  if (a.sat <= 0 && a.dark <= 0) return;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (a.sat > 0) {
    g.globalCompositeOperation = "saturation";
    g.fillStyle = `rgba(128,128,128,${a.sat.toFixed(3)})`;
    g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = "source-over";
  g.fillStyle = `rgba(10,8,8,${a.dark.toFixed(3)})`;
  g.fillRect(0, 0, w, h);
  g.restore();
}

// ---- entry ---------------------------------------------------------------------------------------

function hookEsc() {
  if (escHooked || typeof window === "undefined") return;
  escHooked = true;
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && recapOpen) recapOpen = false;
  });
}

export function drawRoyaleInfo(c: HudCtx): void {
  installMapInput();
  hookEsc();
  if (!c.s.joined) {
    if (wasJoined) {
      resetMapState();
      prevAlive = null;
      elimStart = 0;
      recapOpen = false;
      gradeOn = false;
    }
    wasJoined = false;
    return;
  }
  wasJoined = true;
  track(c);
  drawPerf(c);
  drawCluster(c);
  minimapHots(c);
  drawWaypointHud(c);
  drawCampHintHud(c);
  const bottom = drawBanner(c);
  if (c.v.phase === "fight") drawRecap(c, bottom > 0 ? bottom : c.L.centre.y - 34);
}
