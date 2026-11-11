// Hybrid hero renderer: painted 2D body/gear parts (public/heroparts) attached to the procedural
// skeleton rig. Per frame: the rig pose (hero.ts heroPoseAt, with its run bob / lean / lunge /
// skill / reaction keyframes) gives 3D joints; they are projected with the hero camera, each part
// picks the nearest painted view (S / E / mirrored-E / N) for the facing, is rotated (and for limbs
// stretched) between its two joints, painter-sorted by depth and drawn with smooth canvas scaling.
// Equipped look keys map to gear parts; any missing gear part falls back to the base body.
//
// API for render.ts: paperdollFrame(...) -> Sprite | null (same contract as heroFrame; null until the
// manifest and images have loaded, or when painted sprites are disabled).
import type { Look } from "../../../shared/look";
import { DIRS, dirToWorldAngle } from "../iso";
import type { Sprite } from "../pixel";
import { add, lerp3, mul, norm, outlined, projector, rotS, spriteDensity, sub, v, type V3 } from "../rig";
import { pdPose } from "./pose";
import { HERO_FRAME, joint, KIND_LOOK, type BodyRegion, type HeroAnim, type HeroConfig, type Pose } from "../hero";
import { partImage, partManifest, partManifestVersion, type PartDef, type PartView, type PartViewDef } from "./manifest";

export { partManifest, partManifestVersion } from "./manifest";

// ---- look key -> painted part set ----
const HELM: Record<string, string> = { hood: "hood", coif: "hood", helm_open: "helm", helm_great: "helm", helm_horned: "helm", circlet: "circlet" };
const BODY: Record<string, string> = {
  body_leather: "leather",
  body_brigandine: "leather",
  body_scale: "plate",
  body_mail: "plate",
  body_plate: "plate",
  body_robe: "robe",
  body_plate_robe: "robe",
  body_scale_robe: "robe",
};
const GLOVES: Record<string, string> = { gloves_wrap: "leather", gloves_leather: "leather", gloves_silk: "leather", gloves_gauntlet: "gauntlet" };
const BOOTS: Record<string, string> = { boots_wrap: "leather", boots_soft: "leather", boots_slipper: "leather", boots_greave: "greave" };
/** Weapon look -> [part id, size multiplier]. */
const WEAPON: Record<string, [string, number]> = {
  sword_short: ["sword", 0.8],
  sword_long: ["sword", 1],
  greatsword: ["sword", 1.25],
  axe_hand: ["axe", 1],
  greataxe: ["axe", 1.3],
  mace: ["mace", 1],
  maul: ["mace", 1.3],
  sceptre: ["mace", 0.9],
  dagger: ["dagger", 1],
  claw: ["dagger", 0.8],
  spear: ["staff", 1.05],
  quarterstaff: ["staff", 1],
  staff: ["staff", 1],
  wand: ["wand", 1],
  bow: ["bow", 1],
  crossbow: ["bow", 0.8],
};
const OFFHAND: Record<string, [string, number]> = {
  shield_buckler: ["shield", 0.7],
  shield_round: ["shield", 1],
  shield_kite: ["shield", 1.1],
  shield_tower: ["shield", 1.3],
  quiver: ["quiver", 1],
};

type Seg = "head" | "torso" | "hips" | "upperarm" | "forearm" | "hand" | "thigh" | "shin" | "foot";

/** Part id for a body segment: equipped gear first (by priority), then the base body. */
function segPart(seg: Seg, look: Look): string[] {
  const ids: string[] = [];
  const b = BODY[look.body];
  const g = GLOVES[look.gloves];
  const t = BOOTS[look.boots];
  switch (seg) {
    case "head":
      if (HELM[look.helmet]) ids.push(`helmet.${HELM[look.helmet]}.head`);
      break;
    case "torso":
    case "hips":
    case "upperarm":
      if (b) ids.push(`body.${b}.${seg}`);
      break;
    case "forearm":
      if (g) ids.push(`gloves.${g}.forearm`);
      if (b) ids.push(`body.${b}.forearm`);
      break;
    case "hand":
      if (g) ids.push(`gloves.${g}.hand`);
      break;
    case "shin":
    case "foot":
      if (t) ids.push(`boots.${t}.${seg}`);
      break;
  }
  ids.push(`base.base.${seg}`);
  return ids;
}

// ---- joints ----
type J = Record<string, V3>;
function rigJoints(p: Pose): J {
  const j: J = {
    hip: p.hip,
    chest: p.chest,
    neck: p.neck,
    head: p.head,
    shL: p.shL,
    shR: p.shR,
    haL: p.haL,
    haR: p.haR,
    hpL: p.hpL,
    hpR: p.hpR,
    ftL: p.ftL,
    ftR: p.ftR,
  };
  for (const [s, side] of [["L", -1], ["R", 1]] as const) {
    const sh = j["sh" + s];
    const ha = j["ha" + s];
    const hp = j["hp" + s];
    const ft = j["ft" + s];
    const el = joint(sh, ha, 6.1, v(-0.9, side * 0.22, -0.3));
    j["el" + s] = el;
    j["kn" + s] = (s === "L" ? p.knL : p.knR) ?? joint(hp, ft, 7.9, v(1, 0, 0.2));
    j["tip" + s] = add(ha, mul(norm(sub(ha, el)), 2));
    j["sole" + s] = add(ft, v(0, 0, -2));
  }
  j.hipDown = add(p.hip, v(0, 0, -3));
  j.wTip = add(p.haR, mul(p.w, 5));
  j.bowTop = add(p.haL, mul(p.bow ? norm(p.bow.up) : v(0, 0, 1), 5));
  const sc = add(lerp3(j.elL, p.haL, 0.55), v(0.4, -1.8, 0));
  j.shield = sc;
  j.shieldUp = add(sc, v(0, 0, 3));
  j.qTop = add(p.neck, v(-3.4, 2.2, 1.5));
  j.qBot = add(p.hip, v(-3.6, 2.8, 0));
  j.scarf = add(p.neck, v(-2.6, 0.5, -1.2 - p.run * 0.8));
  if (p.rot) {
    const { ang, pivot } = p.rot;
    for (const k of Object.keys(j)) j[k] = rotS(j[k], ang, pivot);
  }
  return j;
}

/** View for a screen direction index (DIRS-way, 0 = E, clockwise; 4 = S). */
function viewFor(dir: number): { view: PartView; mirror: boolean } {
  const n = DIRS;
  const a = ((((dir % n) + n) % n) / n) * 16; // in 16ths of a turn
  if (a >= 2.5 && a <= 5.5) return { view: "S", mirror: false };
  if (a >= 10.5 && a <= 13.5) return { view: "N", mirror: false };
  if (a > 5.5 && a < 10.5) return { view: "E", mirror: true };
  return { view: "E", mirror: false };
}
const FALLBACK_VIEWS: Record<PartView, PartView[]> = { S: ["S", "E", "N"], E: ["E", "S", "N"], N: ["N", "E", "S"] };

interface Item {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** Resolved image for a part id and wanted view; "wait" while loading; null if unusable. */
function resolve(def: PartDef | undefined, want: PartView): { vd: PartViewDef; im: HTMLImageElement } | "wait" | null {
  if (!def) return null;
  for (const vw of FALLBACK_VIEWS[want]) {
    const vd = def.views[vw];
    if (!vd) continue;
    const im = partImage(vd);
    if (im === "failed") continue;
    if (!im) return "wait";
    return { vd, im };
  }
  return null;
}

const SEG_REGION = (seg: string, side: string): BodyRegion =>
  seg === "head" ? "head" : seg === "torso" || seg === "hips" ? "torso" : ["upperarm", "forearm", "hand"].includes(seg) ? (side === "L" ? "armL" : "armR") : side === "L" ? "legL" : "legR";

/** Build one paperdoll frame, or null when the art is not (yet) available. */
function build(cfg: HeroConfig, dir: number, anim: HeroAnim, ft: number, flash: boolean): Sprite | null {
  const man = partManifest();
  if (!man) return null;
  const { look } = cfg;
  const wl: string = look.weapon || (cfg.wk ? KIND_LOOK[cfg.wk] ?? "" : "");
  const pose = pdPose(anim, ft, cfg.wk, wl);
  const J = rigJoints(pose);
  const d = spriteDensity();
  const facing = dirToWorldAngle(dir, DIRS);
  const pr = projector(facing, HERO_FRAME.scale * d, HERO_FRAME.ax * d, HERO_FRAME.ay * d);
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  /** Horizontal camera depth in rig units (bigger = nearer the camera). */
  const depth = (p: V3) => (p[0] * c - p[1] * s + p[0] * s + p[1] * c) * Math.SQRT1_2;
  const base = viewFor(dir);
  const sW = d / man.ppu;
  const items: Item[] = [];
  let waiting = false;
  const keep = (r: BodyRegion) => (cfg.only ? r === cfg.only : !cfg.missing?.includes(r));

  const place = (ids: string[], j0: V3, j1: V3, bias: number, mul0 = 1, viewTurn = 0): boolean => {
    let got: { vd: PartViewDef; im: HTMLImageElement } | null = null;
    let def: PartDef | undefined;
    const vf = viewTurn ? viewFor(dir + (viewTurn * DIRS) / 16) : base;
    for (const id of ids) {
      def = man.parts[id];
      const r = resolve(def, vf.view);
      if (r === "wait") {
        waiting = true;
        return false;
      }
      if (r) {
        got = r;
        break;
      }
    }
    if (!got || !def) return false;
    const { vd, im } = got;
    const stretch = def.mode === "stretch" && vd.len > 0;
    const up = def.up;
    const mirror = vf.mirror;
    const ax = pr.x(j0);
    const ay = pr.y(j0);
    let tx = pr.x(j1) - ax;
    let ty = pr.y(j1) - ay;
    let tl = Math.hypot(tx, ty);
    if (tl < 0.4 * d) {
      tx = 0;
      ty = up ? -1 : 1;
      tl = 0;
    }
    if (up) {
      tx = -tx;
      ty = -ty;
    }
    const ang = Math.atan2(ty, tx) - Math.PI / 2;
    const w = sW * mul0 * (BULK[`${def.slot}.${def.look}`]?.[def.seg] ?? 1) * (def.seg === "head" ? HEAD_SCALE : 1);
    // Stretch parts overshoot their far joint a little so knees / elbows never open a seam.
    const sl = stretch ? Math.max(w * 0.45, Math.min(w * 1.8, (tl / vd.len) * OVERSHOOT)) : w;
    const dz = depth(lerp3(j0, j1, 0.5)) + bias;
    items.push({
      depth: dz + items.length * 1e-4,
      draw: (ctx) => {
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.scale(mirror ? -w : w, sl);
        ctx.drawImage(im, -vd.ax, -vd.ay);
        ctx.restore();
      },
    });
    return true;
  };

  // Body segments (single). Limbs sort by their own camera depth, so the far arm / leg falls
  // behind the torso and the near one in front.
  if (keep("torso")) {
    place(segPart("hips", look), J.hip, J.hipDown, 2.2);
    place(segPart("torso", look), J.neck, J.hip, 2.4);
    // Player colour as a narrow cloth baldric (left shoulder to right hip), dyed dark so it reads
    // as a deliberate garment detail; drawn on the torso, under the arms.
    const b0 = lerp3(J.shL, J.neck, 0.35);
    const b1 = lerp3(J.hpR, J.hip, 0.2);
    const front = depth(lerp3(J.chest, J.hip, 0.5)) >= -0.01 || base.view !== "N";
    items.push({
      depth: depth(lerp3(J.neck, J.hip, 0.5)) + 2.45,
      draw: (ctx) => {
        if (!front) return;
        ctx.save();
        ctx.lineCap = "butt";
        ctx.strokeStyle = cfg.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = HERO_FRAME.scale * d * 0.75;
        ctx.globalCompositeOperation = "source-atop";
        ctx.beginPath();
        ctx.moveTo(pr.x(b0), pr.y(b0));
        ctx.lineTo(pr.x(b1), pr.y(b1));
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = HERO_FRAME.scale * d * 0.18;
        ctx.stroke();
        ctx.restore();
      },
    });
  }
  if (keep("head")) place(segPart("head", look), J.neck, J.head, 3.5);
  for (const sd of ["L", "R"] as const) {
    if (keep(SEG_REGION("upperarm", sd))) {
      place(segPart("upperarm", look), J["sh" + sd], J["el" + sd], 2.6);
      place(segPart("forearm", look), J["el" + sd], J["ha" + sd], 2.7);
      place(segPart("hand", look), J["ha" + sd], J["tip" + sd], 2.8);
    }
    if (keep(SEG_REGION("thigh", sd))) {
      place(segPart("thigh", look), J["hp" + sd], J["kn" + sd], 0.2);
      place(segPart("shin", look), J["kn" + sd], J["ft" + sd], 0.3);
      place(segPart("foot", look), J["ft" + sd], J["sole" + sd], 0.4);
    }
  }
  // Weapon (right hand; the bow sits in the left hand)
  const wp = WEAPON[wl];
  if (wp) {
    if (wp[0] === "bow") {
      if (keep("armL")) place(["weapon.set.bow"], J.haL, J.bowTop, 2.75 - depth(lerp3(J.haL, J.bowTop, 0.5)) + depth(J.haL), wp[1]);
    } else if (keep("armR")) place([`weapon.set.${wp[0]}`], J.haR, J.wTip, 2.75 - depth(lerp3(J.haR, J.wTip, 0.5)) + depth(J.haR), wp[1]);
  }
  const oh = OFFHAND[look.offhand];
  if (oh) {
    if (oh[0] === "shield" && keep("armL")) place(["offhand.set.shield"], J.shield, J.shieldUp, 3.0, oh[1], -4);
    else if (oh[0] === "quiver" && keep("torso")) place(["offhand.set.quiver"], J.qTop, J.qBot, 2.3, oh[1]);
  }
  if (waiting) return null;
  if (!items.length) return null;

  items.sort((a, b) => a.depth - b.depth);
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(HERO_FRAME.w * d);
  cv.height = Math.ceil(HERO_FRAME.h * d);
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (const it of items) it.draw(ctx);
  grade(ctx, cv.width, cv.height);
  if ((anim === "attack" || anim === "attack2") && wp && wp[0] !== "bow" && wp[0] !== "wand") smear(ctx, cfg, anim, ft, wl, pr, d);
  const out = outlined(cv, Math.max(1, d * 0.45), false);
  const g = out.getContext("2d")!;
  if (pose.glow && pose.glow > 0.05) {
    const at: V3[] = pose.glowAt === "L" ? [J.haL] : pose.glowAt === "R" ? [J.haR] : pose.glowAt === "tip" ? [J.wTip] : [J.haL, J.haR];
    for (const p of at) glow(g, pr.x(p), pr.y(p), HERO_FRAME.scale * d * (2 + pose.glow * 3), pose.glow);
  }
  if (flash) additiveFlash(out);
  return { cv: out, ax: HERO_FRAME.ax * d, ay: HERO_FRAME.ay * d, d };
}

/** Look-specific bulk so plate / leather / robe differ in silhouette, not only in colour. */
const BULK: Record<string, Partial<Record<string, number>>> = {
  "body.plate": { torso: 1.14, upperarm: 1.2, forearm: 1.08, hips: 1.12 },
  "body.leather": { torso: 1.02, upperarm: 1.02 },
  "body.robe": { torso: 1.04, hips: 1.1 },
  "boots.greave": { shin: 1.08, foot: 1.05 },
  "gloves.gauntlet": { forearm: 1.08, hand: 1.08 },
};
const HEAD_SCALE = 1.14;
const OVERSHOOT = 1.07;

/** Shared grade: one top-left key over every part, darker and slightly cooler (wet night). */
function grade(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const gr = ctx.createLinearGradient(w * 0.2, h * 0.15, w * 0.8, h * 0.95);
  gr.addColorStop(0, "rgba(220,226,235,0.07)");
  gr.addColorStop(0.5, "rgba(10,14,20,0.12)");
  gr.addColorStop(1, "rgba(4,6,10,0.32)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(12,16,24,0.14)";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Swing smear: the weapon tip's arc over the last ~0.8 frame, fading toward the past. */
function smear(ctx: CanvasRenderingContext2D, cfg: HeroConfig, anim: HeroAnim, ft: number, wl: string, pr: ReturnType<typeof projector>, d: number) {
  if (ft < 2.6 || ft > 4.6) return;
  const N = 7;
  const pts: [number, number, number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const f = ft - 0.8 + (0.8 * i) / N;
    const p = pdPose(anim, Math.max(0, f), cfg.wk, wl);
    const J = rigJoints(p);
    const inner = lerp3(J.haR, J.wTip, 0.55);
    pts.push([pr.x(inner), pr.y(inner), pr.x(J.wTip), pr.y(J.wTip)]);
  }
  const span = Math.hypot(pts[N][2] - pts[0][2], pts[N][3] - pts[0][3]);
  if (span < 6 * d) return;
  const k = 1 - Math.abs(ft - 3.3) / 1.4;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < N; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    ctx.fillStyle = `rgba(190,200,215,${(0.05 + 0.22 * (i / N)) * Math.max(0, k)})`;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(a[2], a[3]);
    ctx.lineTo(b[2], b[3]);
    ctx.lineTo(b[0], b[1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, k: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,214,150,${0.75 * k})`);
  gr.addColorStop(0.35, `rgba(255,150,60,${0.35 * k})`);
  gr.addColorStop(1, "rgba(255,120,40,0)");
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Hit flash: a brief warm additive tint over the figure (not a white silhouette). */
function additiveFlash(cv: HTMLCanvasElement) {
  const t = document.createElement("canvas");
  t.width = cv.width;
  t.height = cv.height;
  const tg = t.getContext("2d")!;
  tg.drawImage(cv, 0, 0);
  tg.globalCompositeOperation = "source-in";
  tg.fillStyle = "rgba(255,196,150,0.11)";
  tg.fillRect(0, 0, t.width, t.height);
  const g = cv.getContext("2d")!;
  g.save();
  g.globalCompositeOperation = "lighter";
  g.drawImage(t, 0, 0);
  g.restore();
}

// ---- cache ----
const SUB = 3;
const cache = new Map<string, Sprite>();
let cacheVersion = -1;

/**
 * Painted paper-doll hero frame. Same arguments and Sprite contract as heroFrame() (hero.ts):
 * `dir` is a DIRS-way screen direction index, `frameIn` a fractional frame of `anim`.
 * Returns null while the part manifest / images load or when painted sprites are off.
 */
export function paperdollFrame(cfg: HeroConfig, lookCode: string, dir: number, anim: HeroAnim, frameIn: number, flash = false): Sprite | null {
  if (!partManifest()) return null;
  if (cacheVersion !== partManifestVersion()) {
    cache.clear();
    cacheVersion = partManifestVersion();
  }
  const frame = Math.round(frameIn * SUB) / SUB;
  const gk = (cfg.only ? "o" + cfg.only : cfg.missing?.length ? "m" + cfg.missing.join(".") : "");
  const key = `${lookCode}|${cfg.color}|${cfg.wk}|${dir}|${anim}|${frame}|${flash ? 1 : 0}|${spriteDensity()}${gk}`;
  let s = cache.get(key);
  if (s) return s;
  const built = build(cfg, dir, anim, frame, flash);
  if (!built) return null;
  if (cache.size > 4000) cache.clear();
  cache.set(key, built);
  return built;
}
