// Art review page (public/sprites.html): the player character in all 8 directions and every
// animation with a few gear sets, plus every monster animation, elites and item icons.
import type { WeaponKind } from "../shared/content/types";
import { decodeLook, lookCode, NAKED_LOOK } from "../shared/look";
import { setSpriteDensity } from "./gfx/rig";
import { drawText, drawTitle, TITLE_BLOOD, TITLE_BONE, TITLE_EMBER } from "./gfx/font";
import { globeBack, globeFrame, globeLiquid } from "./gfx/hud";
import { brazierSprite, obstacleKind, obstacleSprite, SCATTER, scatterSprite, stakeSprite, type ObsKind } from "./gfx/props";
import { OBSTACLES } from "../shared/map";
import { HERO_FRAMES, heroFrame, SKILL_POSES, type HeroAnim } from "./gfx/hero";
import { flaskIcon, iconSprite } from "./gfx/icons";
import { MON_FRAMES, monsterFrame, MONSTER_KINDS, type MonAnim } from "./gfx/monsters";
import type { Sprite } from "./gfx/pixel";
import { buildTotem, shadowSprite } from "./gfx/world";

const canvas = document.getElementById("sheet") as HTMLCanvasElement;
const zoomSel = document.getElementById("zoom") as HTMLSelectElement;
const pauseBox = document.getElementById("pause") as HTMLInputElement;
const lo = document.createElement("canvas");
const g = lo.getContext("2d")!;

interface Gear {
  name: string;
  lk: string; // helmet body boots gloves offhand
  color: string;
  wk: WeaponKind | null;
}
const GEARS: Gear[] = [
  { name: "WANDERER (NO GEAR)", lk: NAKED_LOOK, color: "#e0453a", wk: null },
  { name: "HOOD, LEATHER, SWORD, BUCKLER", lk: lookCode({ helmet: "hood", body: "body_leather", gloves: "gloves_leather", boots: "boots_soft", offhand: "shield_buckler", weapon: "sword_long", belt: "belt_leather" }, { body: 1, weapon: 1 }), color: "#3fa7e0", wk: "sword" },
  { name: "HELM, MAIL, SPEAR", lk: lookCode({ helmet: "helm_open", body: "body_mail", gloves: "gloves_gauntlet", boots: "boots_greave", weapon: "spear", belt: "belt_chain" }, { helmet: 2, body: 2 }), color: "#e0c03a", wk: "spear" },
  { name: "GREAT HELM, PLATE, AXE, KITE (UNIQUE)", lk: lookCode({ helmet: "helm_great", body: "body_plate", gloves: "gloves_gauntlet", boots: "boots_greave", offhand: "shield_kite", weapon: "axe_hand", belt: "belt_studded" }, { body: 3, weapon: 3, helmet: 2 }), color: "#8a4fe0", wk: "axe" },
  { name: "HOOD, BRIGANDINE, DAGGER", lk: lookCode({ helmet: "hood", body: "body_brigandine", gloves: "gloves_wrap", boots: "boots_wrap", weapon: "dagger", belt: "belt_rope" }), color: "#3ae07a", wk: "dagger" },
  { name: "CIRCLET, ROBE, STAFF", lk: lookCode({ helmet: "circlet", body: "body_robe", gloves: "gloves_silk", boots: "boots_slipper", weapon: "staff", belt: "belt_rope" }, { body: 2, weapon: 3 }), color: "#c04ae0", wk: "staff" as WeaponKind },
  { name: "COIF, SCALE, BOW, QUIVER", lk: lookCode({ helmet: "coif", body: "body_scale", gloves: "gloves_leather", boots: "boots_soft", offhand: "quiver", weapon: "bow", belt: "belt_leather" }, { body: 1 }), color: "#e08a3a", wk: "bow" as WeaponKind },
];
const ANIMS: HeroAnim[] = ["idle", "run", "attack", "attack2", "roll", "flinch", "stagger", "death", ...SKILL_POSES];
const ANIM_TIME: Partial<Record<HeroAnim, number>> = { idle: 1.4, run: 0.62, attack: 0.5, attack2: 0.5, roll: 0.36, death: 1.2, flinch: 0.25, stagger: 0.6, channel: 0.6 };
const MANIMS: MonAnim[] = ["idle", "move", "windup", "strike", "death"];

let gearIdx = 1;
let t = 0;
let last = performance.now();

function blit(s: Sprite, x: number, y: number) {
  const d = s.d ?? 1;
  g.drawImage(s.cv, x - s.ax / d, y - s.ay / d, s.cv.width / d, s.cv.height / d);
}

/** Fractional frame (smooth, interpolated animation). */
function frameOf(n: number, dur: number, hold = false) {
  const p = (t % (dur + (hold ? 0.8 : 0.25))) / dur;
  return Math.min(n - 1, p * n);
}

function draw() {
  const W = 760;
  const H = 2300;
  const z = Number(zoomSel.value) || 2;
  const dpr = window.devicePixelRatio || 1;
  const Zp = z * dpr;
  setSpriteDensity(Math.min(6, Math.ceil(Zp * 2) / 2));
  if (lo.width !== Math.round(W * Zp)) {
    lo.width = Math.round(W * Zp);
    lo.height = Math.round(H * Zp);
  }
  g.setTransform(Zp, 0, 0, Zp, 0, 0);
  g.imageSmoothingEnabled = true;
  g.fillStyle = "#24231c";
  g.fillRect(0, 0, W, H);
  // checker ground
  for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) if (((x + y) >> 3) & 1) {
    g.fillStyle = "#29271f";
    g.fillRect(x, y, 8, 8);
  }
  const gear = GEARS[gearIdx];
  drawText(g, `PLAYER: ${gear.name}   (CLICK THE TOP ROW TO CYCLE GEAR)`, 8, 6, "#ffe9a8");
  // Gear set strip (idle, facing the camera)
  GEARS.forEach((gs, i) => {
    const x = 40 + i * 60;
    blit(shadowSprite(10), x, 84);
    blit(heroFrame({ look: decodeLook(gs.lk), color: gs.color, wk: gs.wk }, gs.lk, 4, "idle", frameOf(4, 1.4)), x, 84);
    if (i === gearIdx) {
      g.fillStyle = "#ffe9a8";
      g.fillRect(x - 12, 92, 24, 1);
    }
  });
  // Animations: rows; columns = 8 of the 16 directions (0 = screen east, clockwise)
  const y0 = 130;
  drawText(g, "16-WAY: SHOWING DIR 0,2,..14  (0 = SCREEN EAST, 4 = SOUTH, 8 = WEST, 12 = NORTH)", 8, y0 - 22, "#9a8f7a");
  ANIMS.forEach((a, row) => {
    const y = y0 + row * 84 + 70;
    drawText(g, a.toUpperCase(), 6, y - 22, "#e8e2d4");
    for (let k = 0; k < 8; k++) {
      const d = k * 2;
      const x = 110 + k * 72;
      const f = frameOf(HERO_FRAMES[a], ANIM_TIME[a] ?? 0.6, a === "death");
      const lk = a === "death" && f >= 5 ? NAKED_LOOK : gear.lk;
      blit(shadowSprite(10), x, y);
      blit(heroFrame({ look: decodeLook(lk), color: gear.color, wk: a === "death" && f >= 5 ? null : gear.wk }, lk, d, a, f, a === "idle" && k === 7 && Math.floor(t * 4) % 4 === 0), x, y);
    }
  });

  // Monsters
  const my0 = y0 + ANIMS.length * 84 + 80;
  drawText(g, "MONSTERS (DIR 1)  IDLE / MOVE / WINDUP / STRIKE / DEATH  +  ELITE", 8, my0 - 20, "#ffe9a8");
  const radius: Record<string, number> = { gnashling: 15, bog_seer: 16, cragback: 28 };
  const elites: Record<string, string[]> = { gnashling: ["frenzied"], bog_seer: ["rimecloaked", "volatile"], cragback: ["ironhide"] };
  MONSTER_KINDS.forEach((k, row) => {
    const y = [my0 + 50, my0 + 130, my0 + 260][row];
    drawText(g, k.toUpperCase(), 8, y - 34, "#e8e2d4");
    MANIMS.forEach((a, i) => {
      const x = 90 + i * 100;
      const dur = a === "windup" ? 0.9 : a === "strike" ? 0.3 : a === "death" ? 0.8 : 0.7;
      const f = frameOf(MON_FRAMES[a], dur, a === "death");
      blit(shadowSprite(radius[k] * 0.6), x, y);
      blit(monsterFrame(k, radius[k], undefined, 1, a, f), x, y);
    });
    const x = 610;
    blit(shadowSprite(radius[k] * 0.8), x, y);
    blit(monsterFrame(k, radius[k] * 1.3, elites[k], (Math.floor(t * 1.5) % 8), "move", frameOf(6, 0.7)), x, y);
  });

  // Obstacles (one of each kind, scaled down so they fit) + scatter dressing + camp props
  const oy = my0 + 440;
  drawText(g, "OBSTACLES: ROCKS / RUIN / DEAD TREE / SHRINE    SCATTER: GRAVE / BONES / SHRUB / STONES", 8, oy - 110, "#ffe9a8");
  OBS_SAMPLES.forEach((i, k) => {
    const s = obstacleSprite(i);
    const sc = Math.min(1, 150 / s.cv.width, 120 / s.cv.height);
    const x = 90 + k * 170;
    g.drawImage(s.cv, x - s.ax * sc, oy - s.ay * sc, s.cv.width * sc, s.cv.height * sc);
  });
  SCAT_SAMPLES.forEach((i, k) => {
    const s = scatterSprite(i);
    blit(s, 60 + k * 40, oy + 40);
  });
  blit(totem, 260, oy + 50);
  for (let k = 0; k < 3; k++) blit(stakeSprite(k + 1, k * 2), 310 + k * 34, oy + 50);
  blit(brazierSprite(Math.floor(t * 8) % 4), 440, oy + 50);
  // HUD globes + title font
  const gy = oy + 110;
  ([["#b0141a", 1], ["#2a46b0", 0.32]] as [string, number][]).forEach(([c, dim], k) => {
    const R = 19;
    const cx = 60 + k * 60;
    g.drawImage(globeBack(R), cx - R, gy - R);
    g.save();
    g.beginPath();
    g.rect(cx - R, gy - R + R * 2 * (k === 0 ? 0.3 : 0), R * 2, R * 2);
    g.clip();
    g.drawImage(globeLiquid(R, c, dim), cx - R, gy - R);
    g.restore();
    g.drawImage(globeFrame(R), cx - R - 5, gy - R - 8);
  });
  drawTitle(g, "NONE SURVIVED", 330, gy - 26, "center", 1, TITLE_BLOOD);
  drawTitle(g, "FIGHT!", 330, gy - 4, "center", 1, TITLE_EMBER);
  drawTitle(g, "HNS ROYALE", 560, gy - 14, "center", 1, TITLE_BONE);
  // Icons
  const py = oy + 170;
  const icons = ["sword", "spear", "axe", "dagger", "offhand", "helmet", "body", "gloves", "boots", "amulet", "ring", "belt", "flask"];
  icons.forEach((k, i) => blit(iconSprite(k, i === 4 || i === 6 ? 2 : 0), 200 + i * 18, py - 4));
  for (let i = 0; i <= 4; i++) g.drawImage(flaskIcon(i / 4, i > 1), 200 + (icons.length + i) * 18 - 6, py - 15);

  if (canvas.width !== lo.width) {
    canvas.width = lo.width;
    canvas.height = lo.height;
    canvas.style.width = W * z + "px";
    canvas.style.height = H * z + "px";
  }
  const c = canvas.getContext("2d")!;
  c.drawImage(lo, 0, 0);
}

const OBS_SAMPLES = (["rocks", "ruin", "tree", "shrine"] as ObsKind[]).map((k) => Math.max(0, OBSTACLES.findIndex((_, i) => obstacleKind(i) === k)));
const SCAT_SAMPLES = (["grave", "bones", "shrub", "stones"] as const).map((k) => Math.max(0, SCATTER.findIndex((s) => s.kind === k)));
const totem = buildTotem(2);

canvas.addEventListener("click", (e) => {
  const z = Number(zoomSel.value) || 2;
  const r = canvas.getBoundingClientRect();
  const y = (e.clientY - r.top) / z;
  const x = (e.clientX - r.left) / z;
  if (y < 95) {
    const i = Math.round((x - 40) / 60);
    gearIdx = i >= 0 && i < GEARS.length ? i : (gearIdx + 1) % GEARS.length;
  } else gearIdx = (gearIdx + 1) % GEARS.length;
});

function loop() {
  const now = performance.now();
  if (!pauseBox.checked) t += (now - last) / 1000;
  last = now;
  draw();
  requestAnimationFrame(loop);
}
// Review hooks (deterministic frames for screenshots): setGear(i), setT(seconds).
Object.assign(window, {
  setGear: (i: number) => {
    gearIdx = i;
    draw();
  },
  setT: (s: number) => {
    t = s;
    draw();
  },
});
requestAnimationFrame(loop);
