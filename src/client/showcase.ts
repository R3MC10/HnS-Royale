// Graphics showcase (public/showcase.html): drives the REAL game renderer (render.ts Renderer) with
// scripted snapshots, so every scene shows the current in-game art. No server needed.
// Read-only consumer of gfx/*: nothing here re-implements art; captions name what is still in progress.
import type { WeaponKind } from "../shared/content/types";
import { BIOMES } from "../shared/biomes";
import { lookCode, NAKED_LOOK, type LookSlot } from "../shared/look";
import { currentMap, getCampSpots, isWalkable, setMap } from "../shared/map";
import type { CampSnap, GameEvent, HazardSnap, MonsterSnap, PlayerSnap, ProjSnap } from "../shared/protocol";
import { defaultStats } from "../shared/stats";
import { dirToWorldAngle, unproject } from "./gfx/iso";
import { SKILL_POSES } from "./gfx/hero";
import { playPose } from "./gfx/poses";
import { MONSTER_KINDS } from "./gfx/monsters";
import { addLayer } from "./gfx/view";
import { M_BLOOD, M_CHAR, M_ICE, M_ICHOR } from "./gfx/gore/core";
import { addPool, drawDecals, stamp, updateDecals, clearDecals } from "./gfx/gore/decals";
import { paintFrost, paintLichtenberg, paintScorch, paintSplat } from "./gfx/gore/paint";
import { drawParticles, P_DROP, P_EMBER, P_MIST, P_SPARK, spawnP, stepParticles } from "./gfx/gore/particles";
import { Renderer, type View } from "./render";
import { setSetting } from "./settings";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const R = renderer as unknown as { zoom: number; zoomTarget: number; applyZoom(): void; camSX: number };

// ---- gore hooks (gfx/gore is not wired into render.ts yet; the showcase hooks its public layers) ----
addLayer("ground", (g, c) => drawDecals(g, c, c.time));
addLayer("over", (g, c) => drawParticles(g, c, false));
addLayer("fx", (g, c) => drawParticles(g, c, true));

// ---- scene state ----------------------------------------------------------------------------------
interface Scene {
  name: string;
  title: string;
  zoom: number;
  notes: string[];
  setup(): void;
  tick(t: number, dt: number): void;
}

let players = new Map<number, PlayerSnap>();
let monsters = new Map<number, MonsterSnap>();
let projs = new Map<number, ProjSnap>();
let hazards: HazardSnap[] = [];
let camps: CampSnap[] = [];
let events: GameEvent[] = [];
let self: PlayerSnap | null = null;
let center = { x: 0, y: 0 };
let biomeIdx = 0;
let panAmp = 40;

const SOUTH = dirToWorldAngle(2, 8); // facing the camera
const SE = dirToWorldAngle(1, 8);

function useBiome(i: number) {
  biomeIdx = ((i % BIOMES.length) + BIOMES.length) % BIOMES.length;
  setMap({ seed: 4242 + biomeIdx * 17, players: 10, biome: BIOMES[biomeIdx].id });
  clearDecals();
}

/** World point at screen-unit offset (sx, sy) from the scene centre. */
function at(sx: number, sy: number) {
  const o = unproject(sx, sy);
  return { x: center.x + o.x, y: center.y + o.y };
}

/** Find an open clearing (all sample points walkable) near the map's camps. */
function findClearing(rad: number): { x: number; y: number } {
  const m = currentMap();
  const spots = getCampSpots();
  const cands: { x: number; y: number }[] = [];
  for (const s of spots) cands.push({ x: s.x, y: s.y });
  for (let i = 0; i < 400; i++) cands.push({ x: ((i * 7919) % 997) / 997 * m.w * 0.8 + m.w * 0.1, y: ((i * 104729) % 991) / 991 * m.h * 0.8 + m.h * 0.1 });
  let best = cands[0] ?? { x: m.w / 2, y: m.h / 2 };
  let bestScore = -1;
  for (const c of cands) {
    let ok = 0;
    for (let a = 0; a < 16; a++)
      for (const k of [0.35, 0.7, 1]) if (isWalkable(c.x + Math.cos((a / 16) * Math.PI * 2) * rad * k, c.y + Math.sin((a / 16) * Math.PI * 2) * rad * k, 20)) ok++;
    if (ok > bestScore) {
      bestScore = ok;
      best = c;
      if (ok === 48) break;
    }
  }
  return best;
}

function player(id: number, name: string, color: string, lk: string, wk: WeaponKind | null, x: number, y: number, angle: number): PlayerSnap {
  return {
    id, name, color, lk, wk, x, y, angle,
    hp: 100, maxHp: 100, mp: 60, atkRange: 70, atkArc: 1.7, swingTime: 0.45,
    kbx: 0, kby: 0, rollT: 0, rollCd: 0, rollDx: 0, rollDy: 0, atkT: 0, atkCd: 0, alive: true, lv: 12,
  };
}

function monster(id: number, k: string, x: number, y: number, r: number, extra: Partial<MonsterSnap> = {}): MonsterSnap {
  return { id, k, x, y, a: SOUTH, hp: 80, mhp: 100, r, s: 0, w: 0, ...extra };
}

function resetEntities() {
  players = new Map();
  monsters = new Map();
  projs = new Map();
  hazards = [];
  camps = [];
  self = null;
}

function addSelf(x: number, y: number, lk = KNIGHT, wk: WeaponKind = "sword") {
  self = player(1, "YOU", "#e0c03a", lk, wk, x, y, SOUTH);
  players.set(1, self);
}

// ---- gear sets -------------------------------------------------------------------------------------
type Keys = Partial<Record<LookSlot, string>>;
const lc = (k: Keys, r = 0) => lookCode(k, Object.fromEntries(Object.keys(k).map((s) => [s, r])) as Partial<Record<LookSlot, number>>);
const KNIGHT = lc({ helmet: "helm_great", body: "body_plate", gloves: "gloves_gauntlet", boots: "boots_greave", offhand: "shield_kite", weapon: "sword_long", belt: "belt_chain" }, 2);
const GEAR: { name: string; lk: string; wk: WeaponKind | null; color: string }[] = [
  { name: "NAKED", lk: NAKED_LOOK, wk: null, color: "#e0453a" },
  { name: "VAGRANT (NORMAL)", lk: lc({ helmet: "hood", body: "body_leather", gloves: "gloves_wrap", boots: "boots_wrap", weapon: "dagger", belt: "belt_rope" }, 0), wk: "dagger", color: "#3ae07a" },
  { name: "MERCENARY (MAGIC)", lk: lc({ helmet: "helm_open", body: "body_mail", gloves: "gloves_leather", boots: "boots_soft", offhand: "shield_round", weapon: "sword_short", belt: "belt_leather" }, 1), wk: "sword", color: "#3fa7e0" },
  { name: "KNIGHT (RARE)", lk: KNIGHT, wk: "sword", color: "#e0c03a" },
  { name: "JUGGERNAUT (UNIQUE)", lk: lc({ helmet: "helm_horned", body: "body_plate", gloves: "gloves_gauntlet", boots: "boots_greave", offhand: "shield_tower", weapon: "maul", belt: "belt_studded" }, 3), wk: "mace", color: "#8a4fe0" },
  { name: "MAGE ROBES (MAGIC)", lk: lc({ helmet: "circlet", body: "body_robe", gloves: "gloves_silk", boots: "boots_slipper", offhand: "focus_orb", weapon: "wand", belt: "belt_rope" }, 1), wk: "wand", color: "#5a7ae0" },
  { name: "BATTLEMAGE (RARE)", lk: lc({ helmet: "helm_open", body: "body_plate_robe", gloves: "gloves_gauntlet", boots: "boots_slipper", offhand: "focus_orb", weapon: "sceptre", belt: "belt_leather" }, 2), wk: "sceptre", color: "#e07a3a" },
  { name: "RANGER (RARE)", lk: lc({ helmet: "hood", body: "body_brigandine", gloves: "gloves_leather", boots: "boots_soft", offhand: "quiver", weapon: "bow", belt: "belt_leather" }, 2), wk: "bow", color: "#7ae03a" },
  { name: "WITCHHUNTER (UNIQUE)", lk: lc({ helmet: "coif", body: "body_scale_robe", gloves: "gloves_leather", boots: "boots_greave", weapon: "crossbow", belt: "belt_studded" }, 3), wk: "crossbow", color: "#e03a9a" },
];

const WEAPONS: [WeaponKind, string, string][] = [
  ["sword", "sword_long", "shield_round"], ["axe", "greataxe", ""], ["mace", "mace", "shield_kite"], ["spear", "spear", ""],
  ["dagger", "dagger", "shield_buckler"], ["claw", "claw", ""], ["staff", "staff", ""], ["quarterstaff", "quarterstaff", ""],
  ["sceptre", "sceptre", "focus_orb"], ["wand", "wand", "focus_orb"], ["bow", "bow", "quiver"], ["crossbow", "crossbow", ""],
];
const POSE_LOOK = lc({ helmet: "hood", body: "body_robe", gloves: "gloves_silk", boots: "boots_slipper", weapon: "staff", belt: "belt_rope" }, 1);

// ---- labels drawn on the canvas (kept in screenshots) -------------------------------------------
let labels: { x: number; y: number; text: string }[] = [];

// ---- scenes ----------------------------------------------------------------------------------------
const poseNext = new Map<number, number>();
function loopPose(id: number, pose: (typeof SKILL_POSES)[number], ms: number, t: number) {
  if ((poseNext.get(id) ?? 0) <= t) {
    playPose(id, pose, ms);
    poseNext.set(id, t + ms / 1000 + 0.45);
  }
}

const SCENES: Scene[] = [
  {
    name: "biomes",
    title: "BIOME TOUR",
    zoom: 0.9,
    notes: ["Real generated map chunk (shared/mapgen) + world/props renderer, lights and fog.", "B = next biome. Raised walls, smooth props and smooth fog are still in progress (look agent)."],
    setup() {
      resetEntities();
      const spots = getCampSpots();
      const s = spots.find((c) => c.tier === 1) ?? spots[0];
      center = s ? { x: s.x, y: s.y } : findClearing(200);
      camps = [{ x: center.x, y: center.y, n: 3, e: true }];
      addSelf(center.x - 110, center.y + 90);
      const ks = MONSTER_KINDS;
      [[40, -20], [-30, 30], [10, 50]].forEach(([dx, dy], i) => monsters.set(100 + i, monster(100 + i, ks[i % ks.length], center.x + dx, center.y + dy, [15, 16, 28][i % 3])));
      panAmp = 110;
    },
    tick(t) {
      if (self) {
        // walk a slow loop around the camp
        const a = t * 0.35;
        self.x = center.x + Math.cos(a) * 130;
        self.y = center.y + Math.sin(a) * 130;
        self.angle = a + Math.PI / 2;
      }
    },
  },
  {
    name: "lineup",
    title: "CHARACTER LINEUP",
    zoom: 1.3,
    notes: GEAR.map((g, i) => `${i + 1}. ${g.name}`).concat(["Paper-doll: helmet, body, gloves, boots, weapon, off-hand, belt. Rarity tints: normal / magic / rare / unique."]),
    setup() {
      resetEntities();
      center = findClearing(320);
      GEAR.forEach((g, i) => {
        const p = at((i - (GEAR.length - 1) / 2) * 58, (i % 2) * 22 - 10);
        const pl = player(10 + i, g.name, g.color, g.lk, g.wk, p.x, p.y, SOUTH);
        players.set(pl.id, pl);
        if (i === 3) self = pl;
      });
      panAmp = 18;
    },
    tick(t) {
      labels = [];
      GEAR.forEach((g, i) => {
        const p = players.get(10 + i)!;
        // slowly turn the whole lineup to show all 16 directions
        const d = Math.floor(t / 1.6 + 2) % 16;
        p.angle = Math.floor(t / 9.6) % 2 === 0 ? SOUTH : dirToWorldAngle(d / 2, 8);
        labels.push({ ...p, text: String(i + 1) });
      });
    },
  },
  {
    name: "weapons",
    title: "WEAPONS + SKILL POSES",
    zoom: 1.0,
    notes: ["Top two rows: one hero per weapon kind looping attack / attack2.", "Bottom row: skill poses cast_forward, cast_raise, channel, slam, leap, throw, buff, summon."],
    setup() {
      resetEntities();
      center = findClearing(360);
      WEAPONS.forEach(([wk, wl, oh], i) => {
        const row = Math.floor(i / 6);
        const col = i % 6;
        const p = at((col - 2.5) * 100, row * 105 - 125);
        const pl = player(20 + i, wk.toUpperCase(), "#c8a060", lc({ helmet: "helm_open", body: "body_mail", gloves: "gloves_leather", boots: "boots_soft", weapon: wl, offhand: oh, belt: "belt_leather" }, 1), wk, p.x, p.y, SE);
        pl.swingTime = wk === "bow" || wk === "crossbow" ? 0.6 : 0.45;
        players.set(pl.id, pl);
      });
      SKILL_POSES.forEach((pose, i) => {
        const p = at((i - 3.5) * 76, 100);
        const pl = player(40 + i, pose.toUpperCase(), "#5a7ae0", POSE_LOOK, "staff", p.x, p.y, SOUTH);
        players.set(pl.id, pl);
      });
      self = players.get(20)!;
      panAmp = 20;
    },
    tick(t) {
      labels = [];
      WEAPONS.forEach(([wk], i) => {
        const p = players.get(20 + i)!;
        const per = p.swingTime + 0.35;
        const ph = (t + i * 0.13) % per;
        p.atkT = ph < p.swingTime ? p.swingTime - ph : 0;
        labels.push({ x: p.x, y: p.y, text: wk.toUpperCase() });
      });
      SKILL_POSES.forEach((pose, i) => {
        const p = players.get(40 + i)!;
        loopPose(p.id, pose, pose === "channel" ? 1600 : 900, t);
        labels.push({ x: p.x, y: p.y, text: pose.toUpperCase() });
      });
    },
  },
  {
    name: "monsters",
    title: "MONSTERS",
    zoom: 1.2,
    notes: [
      `Monster sprite families that exist: ${MONSTER_KINDS.join(", ")} (gfx/monsters.ts, still pixel-rig).`,
      "Rows: normal idle / moving / winding up, then elites (frenzied, ironhide, volatile, rimecloaked), rare + boss-scale.",
      "Roster families (beast, spirit, caster, brute, undead) + bosses have NO art yet (monsters agent: gfx/monsters_*.ts in progress).",
    ],
    setup() {
      resetEntities();
      center = findClearing(360);
      const R0: Record<string, number> = { gnashling: 15, bog_seer: 16, cragback: 28 };
      const EL: Record<string, string[]> = { gnashling: ["frenzied"], bog_seer: ["rimecloaked"], cragback: ["ironhide", "volatile"] };
      MONSTER_KINDS.forEach((k, row) => {
        const r = R0[k] ?? 18;
        [0, 1, 2].forEach((col) => {
          const p = at((col - 2) * 95, (row - 1) * 92);
          monsters.set(200 + row * 10 + col, monster(200 + row * 10 + col, k, p.x, p.y, r));
        });
        const p = at(1 * 95 + 10, (row - 1) * 92);
        monsters.set(200 + row * 10 + 3, monster(200 + row * 10 + 3, k, p.x, p.y, r * 1.15, { e: EL[k] ?? [], n: "ELITE " + k.toUpperCase(), rr: 2 }));
        const q = at(2 * 95 + 40, (row - 1) * 92);
        monsters.set(200 + row * 10 + 4, monster(200 + row * 10 + 4, k, q.x, q.y, r * 1.7, { rr: 3, n: "BOSS-SCALE " + k.toUpperCase(), mhp: 1000, hp: 900 }));
      });
      const s = at(-310, 0);
      addSelf(s.x, s.y);
      self!.angle = dirToWorldAngle(0, 8);
      panAmp = 18;
    },
    tick(t) {
      labels = [];
      for (const m of monsters.values()) {
        const col = (m.id - 200) % 10;
        const base = (m as MonsterSnap & { bx?: number; by?: number });
        if (base.bx === undefined) ((base.bx = m.x), (base.by = m.y));
        if (col === 1 || col === 3) {
          // move in a small circle -> move animation
          const a = t * 2 + m.id;
          m.x = base.bx! + Math.cos(a) * 12;
          m.y = base.by! + Math.sin(a) * 12;
          m.a = a + Math.PI / 2;
          m.s = 1;
        } else if (col === 2 || col === 4) {
          const ph = (t + m.id * 0.1) % 2.2;
          m.s = ph < 1 ? 2 : 1;
          m.w = ph < 1 ? ph : 0;
          m.a = SOUTH;
        } else m.a = SOUTH;
      }
    },
  },
  {
    name: "combat",
    title: "COMBAT + VFX + GORE",
    zoom: 1.25,
    notes: [
      "Melee swing arcs, hit sparks + damage numbers, telegraphed slam hazards, explosions, projectiles, deaths.",
      "Gore: gfx/gore decals/pools/particles (blood, ichor, scorch, frost, lightning burn) hooked via view.ts layers.",
      "Not yet drawn by the game: skill VFX for SkillFx events, ailment visuals (ignite/freeze/shock overlays).",
    ],
    setup() {
      resetEntities();
      center = findClearing(300);
      addSelf(center.x, center.y, GEAR[4].lk, "mace");
      const ally = at(-120, 20);
      players.set(2, player(2, "RIVAL", "#3fa7e0", GEAR[7].lk, "bow", ally.x, ally.y, SE));
      const ks = MONSTER_KINDS;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        monsters.set(300 + i, monster(300 + i, ks[i % ks.length], center.x + Math.cos(a) * 70, center.y + Math.sin(a) * 70, ks[i % ks.length] === "cragback" ? 28 : 15));
      }
      panAmp = 25;
    },
    tick(t, dt) {
      const me = self!;
      // swing at the nearest monster every 0.8 s
      const per = 0.8;
      const ph = t % per;
      me.atkT = ph < me.swingTime ? me.swingTime - ph : 0;
      const ms = [...monsters.values()];
      const tgt = ms[Math.floor(t / per) % Math.max(1, ms.length)];
      if (tgt) me.angle = Math.atan2(tgt.y - me.y, tgt.x - me.x);
      for (const m of ms) {
        m.a = Math.atan2(me.y - m.y, me.x - m.x);
        const w = (t * 0.6 + m.id * 0.37) % 1.6;
        m.s = w < 1 ? 2 : 1;
        m.w = w < 1 ? w : 0;
      }
      const prevPh = (t - dt) % per;
      if (tgt && prevPh < me.swingTime * 0.55 && ph >= me.swingTime * 0.55) {
        const dx = Math.cos(me.angle);
        const dy = Math.sin(me.angle);
        const crit = Math.random() < 0.4;
        events.push({ k: "hit", x: tgt.x, y: tgt.y, target: tgt.id, by: 1, dmg: crit ? 48 + Math.random() * 20 : 14 + Math.random() * 10, m: 1, dt: "p", cr: crit ? 1 : undefined, dx, dy, fo: "melee" });
        goreHit(tgt.x, tgt.y, dx, dy, tgt.k === "cragback" ? M_ICHOR : M_BLOOD, crit);
        tgt.hp = Math.max(5, tgt.hp - 15);
        if (tgt.hp <= 5) {
          events.push({ k: "mdie", id: tgt.id, mk: tgt.k, x: tgt.x, y: tgt.y, r: tgt.r, a: tgt.a, dx, dy, ok: 30 });
          addPool(tgt.x, tgt.y, tgt.r * 1.6, M_BLOOD, 3);
          monsters.delete(tgt.id);
          const id = tgt.id + 50;
          const a = Math.random() * Math.PI * 2;
          setTimeout(() => {
            if (scene !== 4) return;
            monsters.set(id, monster(id, tgt.k, center.x + Math.cos(a) * 75, center.y + Math.sin(a) * 75, tgt.r));
          }, 1500);
        }
      }
      // slam telegraph cycle + explosion with scorch
      const hz = (t % 3) / 2.2;
      const hp = at(110, -40);
      hazards = hz <= 1 ? [{ id: 1, x: hp.x, y: hp.y, r: 70, f: hz }] : [];
      if (Math.floor((t - dt) / 3) !== Math.floor(t / 3)) {
        events.push({ k: "boom", x: hp.x, y: hp.y, r: 70 });
        stamp(hp.x, hp.y, 70, (g) => paintScorch(g, 60, Math.random() * 1e6));
        for (let i = 0; i < 30; i++) spawnP(P_EMBER, M_CHAR, hp.x, hp.y, 4, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, 100 + Math.random() * 200, 0.8, 2);
      }
      // rival archer: projectiles + frost / lightning ground marks
      const rival = players.get(2)!;
      const pt = (t * 0.9) % 1;
      const a = -0.5;
      rival.angle = a;
      projs = new Map([[1, { id: 1, x: rival.x + Math.cos(a) * 260 * pt, y: rival.y + Math.sin(a) * 260 * pt, r: 6 }]]);
      if (Math.floor((t - dt) * 0.25) !== Math.floor(t * 0.25)) {
        const f = at(-60, 90);
        stamp(f.x, f.y, 50, (g) => paintFrost(g, 45, Math.random() * 1e6));
        const l = at(60, 95);
        stamp(l.x, l.y, 50, (g) => paintLichtenberg(g, 45, Math.random() * 1e6));
        for (let i = 0; i < 16; i++) spawnP(P_SPARK, M_ICE, f.x, f.y, 6, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 60 + Math.random() * 120, 0.5, 1.5);
      }
      if (Math.floor((t - dt) / 5) !== Math.floor(t / 5)) events.push({ k: "heal", target: 1 });
    },
  },
  {
    name: "hud",
    title: "HUD",
    zoom: 1.0,
    notes: ["Life + mana globes, flask belt, minimap, kill feed, damage numbers - the live HUD pass of render.ts.", "HUD globes / panels / font are still pixel art (smooth conversion pending, look agent).", "Skill bar is drawn by the skills UI (DOM), not by the canvas renderer - not shown here."],
    setup() {
      resetEntities();
      const spots = getCampSpots();
      const s = spots[1] ?? spots[0];
      center = s ? { x: s.x + 160, y: s.y } : findClearing(200);
      camps = s ? [{ x: s.x, y: s.y, n: 3, e: false }] : [];
      addSelf(center.x, center.y, GEAR[6].lk, "sceptre");
      self!.hp = 64;
      self!.mp = 35;
      const ks = MONSTER_KINDS;
      for (let i = 0; i < 3; i++) monsters.set(400 + i, monster(400 + i, ks[i % ks.length], center.x - 120 + i * 40, center.y + 20 - i * 30, [15, 16, 28][i]));
      players.set(3, player(3, "GRIMWALD", "#8a4fe0", GEAR[4].lk, "mace", center.x + 120, center.y + 60, SOUTH));
      panAmp = 30;
    },
    tick(t, dt) {
      if (Math.floor((t - dt) / 2) !== Math.floor(t / 2)) {
        events.push({ k: "kill", killer: "GRIMWALD", victim: ["ASHA", "BRUNO", "KEL", "VOSS"][Math.floor(t / 2) % 4], vid: 999, x: center.x + 500, y: center.y + 500 });
        events.push({ k: "hit", x: self!.x, y: self!.y, target: 1, by: 3, dmg: 9, dt: "p" });
      }
    },
  },
];

function goreHit(x: number, y: number, dx: number, dy: number, mat: number, crit: boolean) {
  const n = crit ? 26 : 12;
  for (let i = 0; i < n; i++) {
    const sp = 80 + Math.random() * (crit ? 260 : 160);
    const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.3;
    spawnP(P_DROP, mat, x, y, 18, Math.cos(a) * sp, Math.sin(a) * sp, 60 + Math.random() * 160, 1.2, 1 + Math.random() * 2);
  }
  for (let i = 0; i < 4; i++) spawnP(P_MIST, mat, x, y, 18, dx * 40, dy * 40, 20, 0.5, 6);
  stamp(x + dx * 20, y + dy * 20, 30, (g) => paintSplat(g, mat, crit ? 18 : 11, dx, dy, Math.random() * 1e6, crit ? 0.9 : 0.5));
}

// ---- main loop ---------------------------------------------------------------------------------
let scene = 0;
let t = 0;
let paused = false;
let last = performance.now();

function setZoom(z: number) {
  R.zoom = R.zoomTarget = z;
  R.applyZoom();
}

function setScene(i: number) {
  scene = ((i % SCENES.length) + SCENES.length) % SCENES.length;
  t = 0;
  labels = [];
  poseNext.clear();
  clearDecals();
  setSetting("interface", "playerLabels", scene === 1 || scene === 2 ? "off" : "all");
  SCENES[scene].setup();
  setZoom(SCENES[scene].zoom);
  R.camSX = NaN; // snap the camera
  document.querySelectorAll<HTMLButtonElement>("#bar button[data-s]").forEach((b) => b.classList.toggle("on", Number(b.dataset.s) === scene));
}

const stats = defaultStats();
function view(): View {
  const pan = { x: center.x + Math.cos(t * 0.12) * panAmp, y: center.y + Math.sin(t * 0.12) * panAmp * 0.6 };
  return {
    selfId: self?.id ?? -1,
    self,
    selfStats: stats,
    players,
    monsters,
    projs,
    hazards,
    ground: [],
    flasks: [null, null, null],
    phase: "fight",
    phaseLeft: 0,
    winner: null,
    alive: 7,
    total: 10,
    ping: 32,
    camX: scene === 0 ? (self?.x ?? pan.x) * 0.5 + pan.x * 0.5 : pan.x,
    camY: scene === 0 ? (self?.y ?? pan.y) * 0.5 + pan.y * 0.5 : pan.y,
    spectating: null,
    showScoreboard: false,
    connected: true,
    board: [],
    camps,
    hoverG: -1,
  };
}

function overlay() {
  const c = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  c.save();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = canvas.width / dpr;
  const sc = SCENES[scene];
  // per-entity labels (screen positions via the renderer's own projection)
  const toScreen = (x: number, y: number) => {
    const r = renderer as unknown as { sx(x: number, y: number): number; sy(x: number, y: number): number; Z: number; rs: number };
    return { x: (r.sx(x, y) * r.Z) / r.rs / dpr, y: (r.sy(x, y) * r.Z) / r.rs / dpr };
  };
  c.font = "600 11px Georgia, 'Times New Roman', serif";
  c.textAlign = "center";
  for (const l of labels) {
    const p = toScreen(l.x, l.y);
    c.fillStyle = "rgba(0,0,0,0.55)";
    const w = c.measureText(l.text).width + 10;
    c.fillRect(p.x - w / 2, p.y + 8, w, 16);
    c.fillStyle = "#e8d8b0";
    c.fillText(l.text, p.x, p.y + 20);
  }
  // title card
  const biome = scene === 0 ? ` - ${BIOMES[biomeIdx].name.toUpperCase()}` : "";
  c.textAlign = "left";
  const lines = sc.notes;
  c.font = "12px Georgia, serif";
  const bw = Math.min(W - 32, Math.max(380, ...lines.map((l) => c.measureText(l).width + 28)));
  const bh = 44 + lines.length * 16;
  const bx = Math.round((W - bw) / 2);
  const by = 44;
  const grd = c.createLinearGradient(0, by, 0, by + bh);
  grd.addColorStop(0, "rgba(18,12,10,0.86)");
  grd.addColorStop(1, "rgba(8,6,6,0.78)");
  c.fillStyle = grd;
  c.fillRect(bx, by, bw, bh);
  c.strokeStyle = "rgba(160,120,70,0.7)";
  c.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  c.font = "700 17px Georgia, serif";
  c.fillStyle = "#ffd88a";
  c.fillText(`${scene + 1} / ${SCENES.length}   ${sc.title}${biome}`, bx + 14, by + 25);
  c.font = "12px Georgia, serif";
  c.fillStyle = "#cfc4ae";
  lines.forEach((l, i) => c.fillText(l, bx + 14, by + 46 + i * 16));
  c.restore();
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    t += dt;
    SCENES[scene].tick(t, dt);
    updateDecals(dt);
    stepParticles(dt);
  }
  if (events.length) renderer.onEvents(events, self?.id ?? -1);
  events = [];
  if (innerWidth > 200 && innerHeight > 150) {
    try {
      renderer.draw(view(), paused ? 0.0001 : dt);
    } catch (e) {
      // A throw mid-HUD-pass leaves the renderer on its HUD buffer; put it back so the next frame works.
      const r = renderer as unknown as Record<string, unknown>;
      Object.assign(r, { g: r.worldG, lw: r.ww, lh: r.wh, hr: 1 });
      console.error("draw", e);
    }
    overlay();
  }
  requestAnimationFrame(frame);
}

// ---- UI + hooks ----------------------------------------------------------------------------------
const bar = document.getElementById("bar")!;
SCENES.forEach((s, i) => {
  const b = document.createElement("button");
  b.textContent = `${i + 1} ${s.title}`;
  b.dataset.s = String(i);
  b.onclick = () => setScene(i);
  bar.appendChild(b);
});
const bb = document.createElement("button");
bb.textContent = "B  next biome";
bb.onclick = () => {
  useBiome(biomeIdx + 1);
  setScene(scene);
};
bar.appendChild(bb);
window.addEventListener("keydown", (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= SCENES.length) setScene(n - 1);
  else if (e.key === "b" || e.key === "B") bb.click();
  else if (e.key === " ") paused = !paused;
  else if (e.key === "h" || e.key === "H") bar.classList.toggle("hide");
});

async function shot(name: string) {
  const data = canvas.toDataURL("image/jpeg", 0.9);
  const r = await fetch("/__save?name=" + encodeURIComponent(name), { method: "POST", body: data });
  return r.status + " " + (await r.text());
}
Object.assign(window, {
  showcase: { setScene, useBiome: (i: number) => (useBiome(i), setScene(scene)), shot, pause: (p: boolean) => (paused = p), state: () => ({ scene, biome: BIOMES[biomeIdx].id, t }) },
});

useBiome(0);
setScene(Number(new URLSearchParams(location.search).get("scene") ?? 1) - 1);
requestAnimationFrame(frame);
