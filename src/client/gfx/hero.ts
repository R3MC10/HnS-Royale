// The player character: an original "wanderer" paper doll. A body (nearly bare when nothing is
// worn) with a scarf and sash in the player's colour, and gear layers driven by look keys
// (shared/look.ts): helmet, body armour, gloves, boots, belt, off-hand and a weapon silhouette per
// key. Animations: idle/run, per-weapon attacks timed to the commit point (frames 0-2 wind-up,
// 3-5 strike + follow-through), roll, hit reactions, death, and skill poses (see poses.ts).
// Frames are generated on demand and cached per (look, colour, weapon, direction, anim, frame, flash).
import type { Look, WeaponLookKey } from "../../shared/look";
import { ART, DIRS, dirToWorldAngle } from "./iso";
import { canBuild, mixColor, ramp, rampFrom, rgba, type Ramp, type Sprite } from "./pixel";
import { add, cross, GLOW_RAMPS, lerp3, METAL_RAMPS, mul, norm, paintSprite, rotS, spriteDensity, sub, transformParts, v, type Part, type V3 } from "./rig";

export type SkillPose = "cast_forward" | "cast_raise" | "channel" | "slam" | "leap" | "throw" | "buff" | "summon";
export const SKILL_POSES: SkillPose[] = ["cast_forward", "cast_raise", "channel", "slam", "leap", "throw", "buff", "summon"];
export type HeroAnim = "idle" | "run" | "attack" | "attack2" | "roll" | "death" | "flinch" | "stagger" | SkillPose;
export const HERO_FRAMES: Record<HeroAnim, number> = {
  idle: 4,
  run: 8,
  attack: 6,
  attack2: 6,
  roll: 6,
  death: 6,
  flinch: 3,
  stagger: 6,
  cast_forward: 6,
  cast_raise: 6,
  channel: 4,
  slam: 8,
  leap: 8,
  throw: 6,
  buff: 6,
  summon: 6,
};
/** Skill / reaction poses that loop instead of playing once. */
export const LOOPING: ReadonlySet<HeroAnim> = new Set<HeroAnim>(["channel"]);

/** Animation family of a weapon (any kind string; unknown kinds map to the nearest family). */
export type WeaponFamily = "sword" | "spear" | "axe" | "dagger" | "bow" | "staff" | null;
const FAMILY: Record<string, WeaponFamily> = {
  sword: "sword",
  sword_short: "sword",
  sword_long: "sword",
  greatsword: "sword",
  quarterstaff: "sword",
  spear: "spear",
  axe: "axe",
  axe_hand: "axe",
  greataxe: "axe",
  mace: "axe",
  maul: "axe",
  dagger: "dagger",
  claw: "dagger",
  bow: "bow",
  crossbow: "bow",
  staff: "staff",
  wand: "staff",
  sceptre: "staff",
};
export function weaponFamily(wk: string | null | undefined, wl?: string): WeaponFamily {
  return (wk && FAMILY[wk]) || (wl && FAMILY[wl]) || null;
}
/** Look key to draw when the look code has no weapon but the snapshot says one is held. */
export const KIND_LOOK: Record<string, WeaponLookKey> = {
  sword: "sword_long",
  spear: "spear",
  axe: "axe_hand",
  dagger: "dagger",
  bow: "bow",
  staff: "staff",
  mace: "mace",
  claw: "claw",
  wand: "wand",
  sceptre: "sceptre",
  crossbow: "crossbow",
  quarterstaff: "quarterstaff",
};
const TWO_HANDED = new Set<string>(["greatsword", "greataxe", "maul", "quarterstaff", "spear", "crossbow"]);

const SCALE = 1.42 * ART;
const W = Math.ceil(118 * ART);
const H = Math.ceil(112 * ART);
const AX = Math.floor(W / 2);
const AY = Math.ceil(92 * ART);
/** Hero sprite frame: rig scale (rig units -> screen units), canvas size and anchor (screen units). */
export const HERO_FRAME = { scale: SCALE, w: W, h: H, ax: AX, ay: AY } as const;
/** Head scale: grounded, adult proportions (small head, long legs). */
const HS = 0.82;
const hv = (f: number, s: number, z: number): V3 => [f * HS, s * HS, z * HS];
/** Lengthen legs (and a little the torso) of a designed pose. */
const stretchZ = (z: number) => (z <= 14 ? z * 1.18 : 16.5 + (z - 14) * 1.08);

// ---- palette ---------------------------------------------------------------------
const M = {
  skin: ramp("#36241d", "#634537", "#8c6a55", "#b08e74"),
  hair: ramp("#100b09", "#1f1612", "#33251d", "#4a372b"),
  tunic: ramp("#221e18", "#3c3429", "#574c3b", "#746751"),
  rag: ramp("#1d1812", "#2e261c", "#423727", "#574a35"),
  pants: ramp("#121012", "#1f1b1e", "#2f292d", "#423a3f"),
  leather: ramp("#1c120b", "#342115", "#4f331e", "#6c492d"),
  strap: ramp("#0e0906", "#1a110b", "#291b11", "#382518"),
  mail: ramp("#1b1e22", "#373c43", "#5a616b", "#848d99"),
  plate: ramp("#202328", "#454a53", "#787f8b", "#b2bac4"),
  dark: ramp("#121418", "#262a30", "#3d434c", "#5b636e"),
  scale: ramp("#16180f", "#2d3220", "#4a5133", "#6e7650"),
  robe: ramp("#120f1c", "#231c38", "#372c56", "#4f4178"),
  silk: ramp("#17121f", "#2c2340", "#46386a", "#6a5a96"),
  hood: ramp("#0d0f0e", "#191c1a", "#282c29", "#3b413c"),
  brass: ramp("#2a1f0b", "#513e19", "#806228", "#ab8c48"),
  wraps: ramp("#28231d", "#433c32", "#625849", "#7f7461"),
  rope: ramp("#2a2216", "#43382a", "#5e503c", "#7a6a52"),
  wood: ramp("#24160b", "#432b16", "#674325", "#8a6035"),
  pale: ramp("#2e2a22", "#5a5242", "#8a7e66", "#b4a88c"),
  steel: ramp("#363c44", "#78838f", "#bfc8d2", "#f2f6fa"),
  iron: ramp("#17181b", "#2c2e33", "#474a52", "#676b75"),
  bone: ramp("#5e5648", "#9b9078", "#cfc4a6", "#efe7cf"),
  glow: ramp("#1c3a66", "#3a7ac8", "#8cd0ff", "#f0faff"),
  gem: ramp("#3a0a10", "#7a1622", "#c8343e", "#ff9aa0"),
};
/** Rarity trim: rare = gold, unique = deep amber (plus a light in render). */
const TRIM: (Ramp | null)[] = [null, null, ramp("#3a2a08", "#7a5a14", "#c8a040", "#f4dc8a"), ramp("#3a1606", "#7a3410", "#c46a28", "#f0b070")];
for (const rp of [M.mail, M.plate, M.steel, M.iron, M.brass, M.dark, TRIM[2]!, TRIM[3]!]) METAL_RAMPS.add(rp);
GLOW_RAMPS.add(M.glow);
GLOW_RAMPS.add(M.gem);
const EYE = rgba("#120c0a");
const SLIT = rgba("#07090c");

export interface Pose {
  hip: V3;
  chest: V3;
  neck: V3;
  head: V3;
  shL: V3;
  shR: V3;
  haL: V3;
  haR: V3;
  hpL: V3;
  hpR: V3;
  ftL: V3;
  ftR: V3;
  knL?: V3;
  knR?: V3;
  w: V3; // weapon direction from the right hand
  run: number; // 0..1 how much the scarf streams back
  flap: number;
  rot?: { ang: number; pivot: V3 }; // whole-body rotation around s (roll / death)
  twoHand?: boolean;
  /** Bow in the left hand: limb axis, aim, how far the string is drawn, arrow nocked. */
  bow?: { up: V3; aim: V3; draw: number; arrow: boolean };
  /** Magic glow intensity 0..1 and where (right hand / left hand / both / weapon tip). */
  glow?: number;
  glowAt?: "R" | "L" | "both" | "tip";
  /** Height off the ground (rig units) for jumps; applied by the renderer as a sprite offset. */
  lift?: number;
  /** Vertical squash (<1) / stretch (>1). */
  squash?: number;
}

const ease = (t: number) => 1 - (1 - t) * (1 - t);

function weaponRest(fam: WeaponFamily, wl: string): { ha: V3; w: V3 } {
  switch (fam) {
    case "sword":
      return wl === "greatsword" || wl === "quarterstaff" ? { ha: v(3, 5, 15), w: norm(v(0.35, -0.15, 0.95)) } : { ha: v(3, 6, 15), w: norm(v(0.55, 0.2, 0.8)) };
    case "spear":
      return { ha: v(3, 5.5, 16), w: norm(v(0.3, 0, 0.95)) };
    case "axe":
      return { ha: v(2, 6, 14.5), w: norm(v(0.3, 0.25, 0.92)) };
    case "dagger":
      return { ha: v(3, 5.5, 14.5), w: norm(v(1, 0.05, 0.25)) };
    case "staff":
      return wl === "wand" || wl === "sceptre" ? { ha: v(3, 5.5, 14.5), w: norm(v(0.9, 0.05, 0.4)) } : { ha: v(3, 6, 15), w: norm(v(0.12, 0.05, 1)) };
    case "bow":
      return { ha: v(1.5, 6, 14), w: v(1, 0, 0) };
    default:
      return { ha: v(1.5, 6, 14), w: v(1, 0, 0) };
  }
}

const BOW_REST = { up: norm(v(0.45, -0.1, 0.88)), aim: norm(v(0.88, 0, -0.45)), draw: 0, arrow: false };

export function heroPose(anim: HeroAnim, frame: number, wk: string | null, wl = ""): Pose {
  const fam = weaponFamily(wk, wl);
  const rest = weaponRest(fam, wl);
  const p: Pose = {
    hip: v(0, 0, 14),
    chest: v(0, 0, 22),
    neck: v(0, 0, 26),
    head: v(0, 0, 31),
    shL: v(0, -4.8, 24.3),
    shR: v(0, 4.8, 24.3),
    haL: v(1, -6, 15),
    haR: rest.ha,
    hpL: v(0, -2.4, 13),
    hpR: v(0, 2.4, 13),
    ftL: v(0.5, -2.7, 1),
    ftR: v(0.5, 2.7, 1),
    w: rest.w,
    run: 0,
    flap: 0,
  };
  if (fam === "bow") p.bow = { ...BOW_REST };
  const up = (pt: V3, dz: number): V3 => [pt[0], pt[1], pt[2] + dz];
  const fwd = (pt: V3, df: number): V3 => [pt[0] + df, pt[1], pt[2]];
  const TORSO = ["hip", "chest", "neck", "head", "shL", "shR", "hpL", "hpR"] as const;
  const UPPER = ["chest", "neck", "head", "shL", "shR"] as const;
  /** Lean the upper body forward (+) / back (-), more at the head. */
  const lean = (k: number) => {
    p.chest = fwd(p.chest, k);
    p.neck = fwd(p.neck, k * 1.3);
    p.head = fwd(p.head, k * 1.45);
    p.shL = fwd(p.shL, k * 1.1);
    p.shR = fwd(p.shR, k * 1.1);
  };
  /** Shift the whole torso (and hips) by df forward, dz up. */
  const shift = (df: number, dz: number) => {
    for (const k of TORSO) p[k] = up(fwd(p[k], df), dz);
  };
  /** Twist shoulders: + turns the right shoulder back (wind-up to the right). */
  const twist = (k: number) => {
    p.shR = fwd(p.shR, -k * 1.5);
    p.shL = fwd(p.shL, k * 1.5);
  };
  const at = <T,>(a: T[]) => a[Math.max(0, Math.min(a.length - 1, frame))];

  if (anim === "idle") {
    const b = [0, 0.5, 1, 0.5][frame % 4];
    for (const k of UPPER) p[k] = up(p[k], b * 0.55);
    p.haL = up(p.haL, b * 0.3);
    p.haR = up(p.haR, b * 0.3);
    p.flap = b * 0.5;
    if (fam === "bow") p.haL = up(v(2, -6, 14), b * 0.3);
  } else if (anim === "run") {
    const ph = (frame / 8) * Math.PI * 2;
    const sw = Math.sin(ph);
    const lift = (a: number) => Math.max(0, Math.cos(a)) * 3.4;
    p.ftL = v(sw * 5.5, -2.7, 1 + lift(ph));
    p.ftR = v(-sw * 5.5, 2.7, 1 + lift(ph + Math.PI));
    const bob = Math.abs(Math.cos(ph)) * 0.9;
    for (const k of TORSO) p[k] = up(p[k], bob - 0.6);
    p.chest = fwd(p.chest, 1.4);
    p.neck = fwd(p.neck, 2.2);
    p.head = fwd(p.head, 2.6);
    p.shL = fwd(p.shL, 1.6);
    p.shR = fwd(p.shR, 1.6);
    p.haL = v(1 - sw * 4.5, -6, 15.5 + Math.max(0, -sw) * 2);
    const dampen = fam ? 0.35 : 1;
    p.haR = add(rest.ha, v(sw * 4 * dampen + 1, 0, Math.max(0, sw) * 1.5 * dampen));
    p.run = 1;
    p.flap = Math.sin(ph * 2) * 1.2;
  } else if (anim === "attack" || anim === "attack2") {
    attackPose(p, anim === "attack2", frame, fam, wl, { lean, shift, twist, at, fwd, up });
  } else if (anim === "roll") {
    // Tucked tumble around the hip.
    const t = (frame + 0.5) / 6;
    Object.assign(p, {
      hip: v(0, 0, 9),
      chest: v(1.5, 0, 14),
      neck: v(2.5, 0, 17),
      head: v(3.5, 0, 20.5),
      shL: v(1.5, -4.5, 16),
      shR: v(1.5, 4.5, 16),
      haL: v(5, -4, 9),
      haR: v(5, 4.5, 9.5),
      hpL: v(0, -2.4, 8.5),
      hpR: v(0, 2.4, 8.5),
      knL: v(5, -2.6, 11),
      knR: v(5, 2.6, 11),
      ftL: v(1, -2.7, 4),
      ftR: v(1, 2.7, 4),
      w: norm(v(0.4, 0.1, -0.9)),
    });
    if (p.bow) p.bow = { up: norm(v(0.3, 0, -1)), aim: v(1, 0, 0), draw: 0, arrow: false };
    p.rot = { ang: t * Math.PI * 2, pivot: v(1.5, 0, 10) };
    p.run = 0.6;
  } else if (anim === "flinch") {
    // Short snap back from a hit; arms jolt out.
    const k = [1, 0.6, 0.25][frame] ?? 0;
    lean(-2.2 * k);
    p.head = add(p.head, v(-0.6 * k, 0.6 * k, -0.4 * k));
    p.haL = add(p.haL, v(-1.5 * k, -1.5 * k, 2 * k));
    p.haR = add(p.haR, v(-1.2 * k, 1 * k, 1.2 * k));
    shift(-0.6 * k, -0.4 * k);
  } else if (anim === "stagger") {
    // Heavy stun: knocked back on the heels, arms flung up, sags, then recovers.
    const k = [0.7, 1, 1, 0.85, 0.55, 0.25][frame];
    const sag = [0.3, 0.8, 1.5, 1.7, 1.2, 0.5][frame];
    lean(-3.6 * k);
    shift(-1.2 * k, -sag);
    p.head = add(p.head, v(-0.4, 1.2 * k, -0.8 * k));
    p.haL = v(-1 - 2 * k, -7.5, 18 + 7 * k);
    p.haR = v(-0.5 - 2 * k, 7.5, 17 + 6 * k);
    p.w = norm(v(-0.4, 0.6, 0.6));
    p.ftR = v(-3.5 * k, 3, 1);
    p.ftL = v(1.5, -2.9, 1);
    p.knL = v(2.5, -2.6, 7.2 - sag * 0.5);
    p.knR = v(-1, 2.8, 7 - sag * 0.6);
    p.run = 0.3;
    if (p.bow) p.bow = { up: norm(v(-0.3, -0.3, 0.9)), aim: v(1, 0, 0), draw: 0, arrow: false };
  } else if (anim === "death") {
    // Recoil, knees buckle, then a fall onto the back (facing kept).
    const t = Math.min(1, frame / 5);
    const recoil = frame === 0 ? 1 : 0;
    const buckle = Math.sin(Math.min(1, t * 1.6) * Math.PI) * 3;
    lean(-1.6 * recoil);
    p.knL = v(1 + buckle, -2.6, 7 - buckle * 0.6);
    p.knR = v(1.5 + buckle, 2.6, 7 - buckle * 0.6);
    p.haL = v(-1 - t * 2, -7.5 - recoil, 17 + t * 4 + recoil * 4);
    p.haR = v(-1 - t * 2, 7.5 + recoil, 17 + t * 4 + recoil * 3);
    const fall = t < 0.25 ? 0 : (t - 0.25) / 0.75;
    p.rot = { ang: -fall * fall * 1.5, pivot: v(-1, 0, 0) };
    p.w = norm(v(0, 1, -0.2));
    if (p.bow) p.bow = { up: norm(v(-0.6, 0.2, 0.6)), aim: v(1, 0, 0), draw: 0, arrow: false };
  } else {
    skillPose(p, anim, frame, fam, { lean, shift, twist, at, fwd, up });
  }
  // Grounded proportions: stretch the designed pose vertically (legs most), then squash/stretch.
  const sq = p.squash ?? 1;
  const st = (q: V3): V3 => [q[0], q[1], stretchZ(q[2]) * sq];
  for (const k of ["hip", "chest", "neck", "head", "shL", "shR", "haL", "haR", "hpL", "hpR", "ftL", "ftR", "knL", "knR"] as const) {
    const q = p[k];
    if (q) p[k] = st(q);
  }
  if (p.rot) p.rot = { ang: p.rot.ang, pivot: st(p.rot.pivot) };
  return p;
}

interface PoseKit {
  lean: (k: number) => void;
  shift: (df: number, dz: number) => void;
  twist: (k: number) => void;
  at: <T>(a: T[]) => T;
  fwd: (pt: V3, df: number) => V3;
  up: (pt: V3, dz: number) => V3;
}

/** Per-family attacks. Frames 0-2 anticipation (2 = fully cocked), 3 = contact (the commit point),
 * 4-5 follow-through / recovery. */
function attackPose(p: Pose, alt: boolean, frame: number, fam: WeaponFamily, wl: string, k: PoseKit) {
  const { lean, shift, twist, at } = k;
  if (fam === "sword") {
    // Wide horizontal slash; the follow-up swing (alt) comes back the other way.
    const d = alt ? -1 : 1;
    const a = at([1.2, 1.8, 2.15, 0.15, -1.3, -1.6]) * d;
    const el = at([0.3, 0.38, 0.42, 0.06, -0.12, -0.2]);
    const big = wl === "greatsword" || wl === "quarterstaff";
    p.w = norm(v(Math.cos(a), Math.sin(a), el));
    const r = big ? 6 : 7;
    p.haR = add(p.shR, v(Math.cos(a) * r + 1, Math.sin(a) * r - 3, -3 + el * 4));
    twist(Math.sin(a) * 0.9);
    lean(at([-0.4, -0.7, -0.9, 1.6, 1.9, 1.2]));
    if (big) {
      p.twoHand = true;
      p.haL = add(p.haR, v(-1.2, -2.4, -0.6));
    } else p.haL = v(-1 + Math.sin(a) * 1.5, -6.5, 16 + (frame >= 3 ? 1.5 : 0));
    if (frame >= 3) p.ftL = v(2.8, -2.8, 1);
    else p.ftR = v(-1.2, 2.9, 1);
    p.run = frame >= 3 ? 0.4 : 0;
  } else if (fam === "spear") {
    // Lunge: draw back and crouch, then drive the whole body forward.
    const reach = at([-1, -2.5, -3.5, 9, 10, 5]);
    const lunge = at([-0.5, -1, -1.5, 3, 3.5, 1.5]);
    const crouch = at([0.3, 0.8, 1.2, 1.4, 1.1, 0.5]);
    p.w = norm(v(1, 0, frame < 3 ? 0.12 : 0.03));
    shift(lunge, -crouch);
    lean(Math.max(0, lunge) * 0.4);
    p.haR = v(3 + reach + lunge, 3.5, 18 - crouch * 0.6);
    p.haL = add(sub(p.haR, mul(p.w, 8)), v(0, -4.5, 0));
    p.ftL = v(3 + Math.max(0, lunge) * 1.7, -2.7, 1);
    p.ftR = v(-3 - Math.max(0, lunge) * 0.6, 2.7, 1);
    p.twoHand = true;
    p.run = lunge > 0 ? 0.6 : 0;
  } else if (fam === "axe") {
    // Heavy overhead chop: rise and arch back, then crash down and forward.
    const b = at([-0.3, -0.7, -0.95, 1.75, 2.2, 1.85]);
    p.w = norm(v(Math.sin(b), 0.12, Math.cos(b)));
    const piv = frame < 3 ? v(-0.5, 2.5, 27) : v(3.5, 1.5, 20);
    p.haR = add(piv, mul(p.w, 5));
    p.haL = add(sub(p.haR, mul(p.w, 3)), v(0, -2.5, 0));
    lean(at([-0.8, -1.6, -2.1, 3, 3.6, 2.2]));
    shift(0, at([0.3, 0.6, 0.9, -1.5, -1.9, -1]));
    p.ftL = v(3, -2.7, 1);
    p.ftR = v(-2.5, 2.7, 1);
    p.twoHand = true;
    p.run = frame >= 3 ? 0.5 : 0;
  } else if (fam === "dagger") {
    // Quick double stab: coil, stab (the commit), half retract, second lower stab.
    const ext = at([-1, -2, -2.5, 9, 2.5, 8.5]);
    const lat = at([0.5, 0.8, 1, 0.3, 0, -1.6]);
    const hz = at([19, 19.3, 19.6, 19, 18.4, 17.2]);
    p.haR = v(2 + ext, 4.5 + lat - Math.max(0, ext) * 0.25, hz);
    p.w = norm(v(1, frame === 5 ? -0.3 : -0.1, frame === 5 ? -0.05 : 0.05));
    p.haL = v(1.5, -5.5, 18);
    lean(Math.max(-0.6, ext * 0.18));
    twist(frame < 3 ? 0.4 : -0.3);
    if (frame >= 3) p.ftL = v(2.5, -2.8, 1);
  } else if (fam === "bow") {
    // Draw to the cheek, release (string snaps, hand flies back), settle.
    const draw = at([0.3, 0.65, 1, 0, 0, 0]);
    p.haL = v(8.5, -2.6, frame === 5 ? 19.5 : 21);
    p.haR =
      frame < 3
        ? v(8.5 - 2 - draw * 8.5, -2.6 + draw * 4.8, 21 + draw * 1.6)
        : at([v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(-3, 3.6, 23.5), v(-2.5, 4.6, 21.5), v(-0.5, 5.4, 18)]);
    p.bow = { up: norm(v(0, 0.06, 1)), aim: v(1, 0, 0), draw: frame < 3 ? draw : 0, arrow: frame < 3 };
    p.shL = k.fwd(p.shL, 1.6);
    p.shR = k.fwd(p.shR, -1.4);
    p.head = k.fwd(p.head, 0.6);
    p.ftL = v(2.6, -3.1, 1);
    p.ftR = v(-2.6, 3.1, 1);
  } else if (fam === "staff") {
    // Casting strike: raise the focus and gather, then thrust it forward in a flare.
    const wand = wl === "wand" || wl === "sceptre";
    const r = at([0.35, 0.7, 1, 0, 0, 0]);
    const th = at([0, 0, 0, 1, 0.8, 0.4]);
    if (frame < 3) {
      p.haR = v(1 - r * 1.5, 5, 17 + r * 7);
      p.w = wand ? norm(v(0.2, 0.1, 1)) : norm(v(-0.25 * r + 0.1, 0.05, 1));
      p.haL = v(3 + r * 2, -4.5, 18 + r * 3);
      lean(-0.6 * r);
    } else {
      p.haR = v(2 + th * 6, 4, 22 - th * 2);
      p.w = wand ? norm(v(1, -0.1, 0.15)) : norm(v(0.75 * th + 0.15, 0, 1 - 0.3 * th));
      p.haL = v(4 + th * 6, -3.5, 21);
      lean(1.6 * th);
      p.ftL = v(2.6, -2.8, 1);
    }
    p.glow = frame < 3 ? r * 0.55 : th;
    p.glowAt = "tip";
  } else {
    // Unarmed jab.
    const ext = at([-1, -2, -2.5, 10, 8, 3]);
    p.w = norm(v(1, -0.12, 0.05));
    p.haR = v(2 + ext, 4.5 - Math.max(0, ext) * 0.25, 19);
    p.haL = v(1, -5.5, 18);
    lean(Math.max(-0.6, ext * 0.15));
    twist(frame < 3 ? 0.5 : -0.4);
  }
}

/** Skill poses (played by name for a duration; see poses.ts). */
function skillPose(p: Pose, anim: HeroAnim, frame: number, fam: WeaponFamily, k: PoseKit) {
  const { lean, shift, at } = k;
  const heldUp = () => {
    p.w = fam === "staff" ? norm(v(0.3, 0, 1)) : fam === "bow" ? p.w : norm(v(0.2, 0.3, 0.9));
  };
  switch (anim) {
    case "cast_forward": {
      const g = at([0.25, 0.55, 1, 0.9, 0.5, 0.2]);
      const out = at([0, 0.2, 1, 1, 0.6, 0.2]);
      p.haR = v(3 + out * 6, 3 - out * 0.8, 20 + out);
      p.haL = v(3 + out * 6, -3 + out * 0.8, 20 + out);
      if (fam === "staff") p.w = norm(v(0.6 * out + 0.2, 0, 1 - 0.3 * out));
      else heldUp();
      lean(-0.5 + out * 1.8);
      p.ftL = v(2.2, -2.8, 1);
      p.glow = g;
      p.glowAt = fam === "staff" ? "tip" : "both";
      break;
    }
    case "cast_raise": {
      const h = at([20, 26, 32, 34, 33, 25]);
      const g = at([0.2, 0.5, 0.9, 1, 0.8, 0.3]);
      p.haR = v(at([2, 1.2, 0.6, 0.5, 0.8, 1.8]), 3.6, h);
      p.haL = v(at([2, 1.2, 0.6, 0.5, 0.8, 1.8]), -3.6, h);
      p.w = norm(v(0.1, 0.1, 1));
      lean(at([0, -0.6, -1.2, -1.3, -1, -0.3]));
      shift(0, at([0, 0.3, 0.6, 0.7, 0.4, 0]));
      p.glow = g;
      p.glowAt = fam === "staff" ? "tip" : "both";
      break;
    }
    case "channel": {
      const b = [0, 0.5, 1, 0.5][frame % 4];
      p.haR = v(7.5, 2.6, 21 + b * 0.6);
      p.haL = v(7.5, -2.6, 21 + b * 0.6);
      if (fam === "staff") p.w = norm(v(0.9, 0, 0.5));
      else heldUp();
      lean(0.8);
      p.ftL = v(2.2, -2.8, 1);
      p.ftR = v(-1.5, 2.9, 1);
      p.glow = 0.65 + b * 0.35;
      p.glowAt = fam === "staff" ? "tip" : "both";
      p.flap = b;
      break;
    }
    case "slam": {
      // Crouch, jump with the weapon overhead, smash it into the ground, recover.
      p.lift = at([0, 0, 6, 10, 9, 3, 0, 0]);
      p.squash = at([0.93, 0.86, 1.08, 1.03, 1, 1.05, 0.86, 0.96]);
      const crouch = at([1.5, 2.6, 0, 0, 0, 0, 3, 1]);
      shift(0, -crouch);
      if (frame <= 4) {
        const hz = at([20, 18, 31, 33, 32]);
        p.haR = v(-0.5, 2.5, hz);
        p.haL = v(-0.5, -1, hz - 0.5);
        p.w = norm(v(-0.5, 0.05, 0.85));
        lean(frame >= 2 ? -1.6 : 1.2);
      } else {
        p.haR = at([v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(6, 2.5, 22), v(8, 2, 11), v(5, 3.5, 15)]);
        p.haL = add(p.haR, v(-1, -3, -0.4));
        p.w = at([v(1, 0, 0), v(1, 0, 0), v(1, 0, 0), v(1, 0, 0), v(1, 0, 0), norm(v(1, 0, 0.6)), norm(v(1, 0, -0.7)), norm(v(1, 0, -0.3))]);
        lean(at([0, 0, 0, 0, 0, 2, 4, 2]));
      }
      if (frame >= 2 && frame <= 4) {
        p.knL = v(3.5, -2.6, 9);
        p.knR = v(2.5, 2.6, 8);
        p.ftL = v(0, -2.7, 3.5);
        p.ftR = v(-1, 2.7, 3);
      }
      p.twoHand = fam !== "bow";
      p.run = frame >= 2 && frame <= 5 ? 0.8 : 0;
      break;
    }
    case "leap": {
      // Squash, launch (stretch), tuck at the top of the arc, land (squash), recover.
      p.lift = at([0, 4, 13, 19, 19, 12, 1, 0]);
      p.squash = at([0.8, 1.16, 1.06, 0.94, 0.94, 1.08, 0.8, 0.95]);
      shift(at([0, 0.5, 1, 1, 1, 1, 0.5, 0]), at([-2, 0, 0, 0, 0, 0, -2.2, -0.8]));
      lean(at([1.5, -0.5, 0.5, 1.2, 1.2, 0.8, 2, 0.6]));
      if (frame >= 2 && frame <= 5) {
        const tuck = frame === 3 || frame === 4 ? 1 : 0.4;
        p.knL = v(3 + tuck * 2, -2.6, 9 + tuck * 2);
        p.knR = v(2 + tuck * 2, 2.6, 8.5 + tuck * 2);
        p.ftL = v(0.5, -2.7, 2 + tuck * 3);
        p.ftR = v(-0.5, 2.7, 1.5 + tuck * 3);
        p.haR = v(2, 5.5, 26 + tuck * 3);
        p.haL = v(2, -5.5, 25 + tuck * 3);
        p.w = norm(v(0.3, 0.2, 1));
      } else if (frame === 1) {
        p.haR = v(5, 5, 24);
        p.haL = v(5, -5, 24);
        p.ftR = v(-2.5, 2.7, 1.5);
      } else {
        p.haL = v(3, -6.5, 13);
        p.haR = add(p.haR, v(1, 1, -1));
      }
      p.run = frame >= 1 && frame <= 5 ? 1 : 0;
      p.flap = frame >= 2 && frame <= 5 ? 1.2 : 0;
      break;
    }
    case "throw": {
      p.haR = v(at([-2, -4, -5.5, 7, 9, 6]), 5, at([23, 26, 28, 26, 20, 17]));
      p.haL = v(at([4, 6, 6.5, 0, -1, 1]), -5, at([19, 21, 21.5, 17, 16, 15]));
      p.w = frame < 3 ? norm(v(-0.6, 0.1, 0.8)) : norm(v(1, 0, frame === 3 ? 0.4 : -0.2));
      lean(at([-0.8, -1.6, -2.2, 2.5, 3, 1.4]));
      k.twist(frame < 3 ? 0.8 : -0.6);
      p.ftL = v(at([2, 2.5, 3, 3.5, 3.5, 2.5]), -2.8, 1);
      p.ftR = v(-2.5, 2.8, 1);
      p.run = frame >= 3 ? 0.5 : 0;
      break;
    }
    case "buff": {
      // Gather (fists to the belly, hunched), then flex out and roar.
      const out = at([0, 0, 1, 1, 0.7, 0.3]);
      const hunch = at([0.6, 1, 0, 0, 0, 0]);
      p.squash = at([0.96, 0.92, 1.06, 1.03, 1, 1]);
      lean(hunch * 1.6 - out * 1.2);
      p.haR = out > 0 ? v(1 - out, 5 + out * 4, 19 + out * 8) : v(4, 2, 17);
      p.haL = out > 0 ? v(1 - out, -5 - out * 4, 19 + out * 8) : v(4, -2, 17);
      p.w = norm(v(0, 0.6, 0.8));
      p.ftL = v(1, -3.5, 1);
      p.ftR = v(1, 3.5, 1);
      p.glow = at([0.2, 0.5, 1, 0.8, 0.5, 0.2]);
      p.glowAt = "both";
      p.flap = out;
      break;
    }
    case "summon": {
      // One hand raised high, the other reaching down to the ground where the minion rises.
      const c = at([0, 0.8, 1.5, 1.5, 1, 0.3]);
      const g = at([0.2, 0.5, 0.9, 1, 0.7, 0.3]);
      shift(0, -c);
      lean(c * 0.9);
      p.haR = v(1.5, 4.5, 23 + g * 8);
      p.haL = v(5 + c * 2, -3.5, 13 - c * 2.5);
      p.w = norm(v(0.2, 0.1, 1));
      p.ftL = v(3, -2.8, 1);
      p.knL = v(4.5, -2.6, 7.5 - c * 0.4);
      p.glow = g;
      p.glowAt = "L";
      break;
    }
  }
  if (fam === "bow") p.bow = { up: norm(add(v(0, 0, 1), mul(norm(sub(p.haL, p.shL)), 0.4))), aim: v(1, 0, 0), draw: 0, arrow: false };
}

/** Sprite lift in low-res px for a pose frame (jumps). */
export function heroLift(anim: HeroAnim, frame: number): number {
  if (anim !== "slam" && anim !== "leap") return 0;
  return Math.round((heroPose(anim, frame, null).lift ?? 0) * SCALE);
}

/** Elbow / knee: bend a two-segment limb. */
export function joint(a: V3, b: V3, len: number, bend: V3): V3 {
  const mid = lerp3(a, b, 0.5);
  const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const k = Math.sqrt(Math.max(0, len * len - (d / 2) * (d / 2)));
  return add(mid, mul(norm(bend), k));
}

export interface HeroConfig {
  look: Look;
  color: string; // scarf / sash
  wk: string | null;
  /** Gore: body regions removed from the figure (severed). */
  missing?: readonly BodyRegion[];
  /** Gore: blood coating on the blade, 0..3 (quantized). */
  blood?: number;
  /** Gore: draw ONLY this region (a severed piece, with its gear). */
  only?: BodyRegion;
}

/** Body regions for dismemberment (each rig part is assigned to the nearest bone segment). */
export type BodyRegion = "head" | "armL" | "armR" | "legL" | "legR" | "torso";
export const BODY_REGIONS: BodyRegion[] = ["head", "armL", "armR", "legL", "legR", "torso"];

function segDist(p: V3, a: V3, b: V3): number {
  const ab = sub(b, a);
  const l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / l2));
  const q = add(a, mul(ab, t));
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Region of a part (by its centre) for the given pose; the weapon follows the right arm. */
function regionOf(p: Part, pose: Pose): BodyRegion {
  const c: V3 = p.kind === "cap" ? lerp3(p.a, p.b!, 0.5) : p.kind === "poly" ? mul(p.pts!.reduce((s, q) => add(s, q), [0, 0, 0] as V3), 1 / p.pts!.length) : p.a;
  const segs: [BodyRegion, V3, V3][] = [
    ["head", pose.neck, add(pose.head, [0, 0, 3])],
    ["armL", pose.shL, pose.haL],
    ["armR", pose.shR, add(pose.haR, mul(pose.w, 14))],
    ["legL", pose.hpL, pose.ftL],
    ["legR", pose.hpR, pose.ftR],
    ["torso", pose.hip, pose.chest],
  ];
  let best: BodyRegion = "torso";
  let bd = Infinity;
  for (const [r, a, b] of segs) {
    const d = segDist(c, a, b) * (r === "torso" ? 0.8 : 1);
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best;
}

function filterRegions(parts: Part[], pose: Pose, cfg: HeroConfig): Part[] {
  if (!cfg.only && !cfg.missing?.length) return parts;
  const gore: Part[] = [];
  const keep = parts.filter((p) => {
    const r = regionOf(p, pose);
    return cfg.only ? r === cfg.only : !cfg.missing!.includes(r);
  });
  // Raw stumps where a region was cut off.
  const stump = (at: V3, r: number) => gore.push({ kind: "sph", a: at, r, ramp: GORE_RAMP });
  const cuts = cfg.only ? [cfg.only] : cfg.missing!;
  for (const r of cuts) {
    if (r === "head") stump(pose.neck, 2.2);
    else if (r === "armL") stump(pose.shL, 2);
    else if (r === "armR") stump(pose.shR, 2);
    else if (r === "legL") stump(pose.hpL, 2.2);
    else if (r === "legR") stump(pose.hpR, 2.2);
  }
  return [...keep, ...gore];
}
const GORE_RAMP: Ramp = ramp("#2a0606", "#5a0c0c", "#8a1616", "#c03030");

/** Torso / hem / sleeve materials per body look key. */
interface BodyStyle {
  torso: Ramp;
  torsoR: number;
  hem: Ramp;
  hemLen: number; // how far the skirt reaches down (rig z units below the hip)
  hemR: number;
  sleeve: Ramp;
  sleeveR: number;
  forearm: Ramp;
  dither: boolean;
  pauldrons: 0 | 1 | 2; // none / left only / both
  strap: boolean;
  studs: boolean;
  bare: boolean;
}
function bodyStyle(key: string): BodyStyle {
  const base: BodyStyle = { torso: M.leather, torsoR: 4.4, hem: M.leather, hemLen: 4.5, hemR: 4.7, sleeve: M.tunic, sleeveR: 1.8, forearm: M.leather, dither: false, pauldrons: 0, strap: false, studs: false, bare: false };
  switch (key) {
    case "":
      return { ...base, torso: M.skin, torsoR: 4.1, hem: M.rag, hemLen: 3, hemR: 4.4, sleeve: M.skin, sleeveR: 1.6, forearm: M.skin, bare: true };
    case "body_leather":
      return { ...base, strap: true };
    case "body_scale":
      return { ...base, torso: M.scale, hem: M.scale, hemLen: 5.5, dither: true, sleeve: M.leather, forearm: M.leather };
    case "body_mail":
      return { ...base, torso: M.mail, hem: M.mail, hemLen: 5.5, dither: true, sleeve: M.mail, forearm: M.leather };
    case "body_plate":
      return { ...base, torso: M.plate, torsoR: 4.9, hem: M.plate, hemLen: 4.5, hemR: 4.4, sleeve: M.plate, forearm: M.plate, pauldrons: 2 };
    case "body_robe":
      return { ...base, torso: M.robe, hem: M.robe, hemLen: 11, hemR: 4.9, sleeve: M.robe, sleeveR: 2.1, forearm: M.robe };
    case "body_brigandine":
      return { ...base, torso: M.leather, torsoR: 4.6, hem: M.leather, hemLen: 5, sleeve: M.leather, forearm: M.leather, pauldrons: 1, studs: true };
    case "body_plate_robe":
      return { ...base, torso: M.plate, torsoR: 4.8, hem: M.robe, hemLen: 10, hemR: 4.9, sleeve: M.robe, sleeveR: 2, forearm: M.plate, pauldrons: 2 };
    case "body_scale_robe":
      return { ...base, torso: M.scale, dither: true, hem: M.robe, hemLen: 10, hemR: 4.9, sleeve: M.robe, sleeveR: 2.1, forearm: M.robe };
    default:
      return base;
  }
}

export function heroParts(cfg: HeroConfig, pose: Pose): Part[] {
  const { look } = cfg;
  const wl: string = look.weapon || (cfg.wk ? KIND_LOOK[cfg.wk] ?? "" : "");
  const pc = rampFrom(cfg.color);
  const parts: Part[] = [];
  const cap = (a: V3, b: V3, r: number, rp: Ramp, extra: Partial<Part> = {}) => parts.push({ kind: "cap", a, b, r, ramp: rp, ...extra });
  const sph = (a: V3, r: number, rp: Ramp, extra: Partial<Part> = {}) => parts.push({ kind: "sph", a, r, ramp: rp, ...extra });
  const dot = (a: V3, ref: V3, color: number, depthBias = 0.6) => parts.push({ kind: "dot", a, r: 1, ramp: M.skin, color, ref, depthBias });
  const bs = bodyStyle(look.body);
  const bodyTrim = TRIM[look.rar.body];

  // Legs: bare shins when nothing protects them.
  for (const side of [-1, 1] as const) {
    const hp = side < 0 ? pose.hpL : pose.hpR;
    const ft = side < 0 ? pose.ftL : pose.ftR;
    const kn = (side < 0 ? pose.knL : pose.knR) ?? joint(hp, ft, 7.9, v(1, 0, 0.2));
    cap(hp, kn, 2.2, M.pants);
    cap(kn, ft, 1.9, bs.bare ? M.skin : M.pants);
    const toe = add(ft, v(2.3, 0, -0.2));
    switch (look.boots) {
      case "":
        cap(ft, add(ft, v(1.9, 0, -0.3)), 1.25, M.skin, { depthBias: 0.2 });
        break;
      case "boots_wrap":
        cap(lerp3(kn, ft, 0.55), ft, 2.05, M.wraps);
        cap(ft, toe, 1.5, M.wraps, { depthBias: 0.2 });
        break;
      case "boots_soft":
        cap(lerp3(kn, ft, 0.4), ft, 2.1, M.leather);
        cap(lerp3(kn, ft, 0.38), lerp3(kn, ft, 0.46), 2.35, M.strap, { depthBias: 0.05 });
        cap(ft, toe, 1.5, M.leather, { depthBias: 0.2 });
        break;
      case "boots_greave":
        cap(lerp3(kn, ft, 0.12), ft, 2.3, M.plate);
        sph(kn, 2.05, M.plate, { depthBias: 0.1 });
        cap(ft, add(toe, v(0.3, 0, 0)), 1.6, M.plate, { depthBias: 0.2 });
        break;
      case "boots_slipper":
        cap(lerp3(kn, ft, 0.8), ft, 1.95, M.silk);
        cap(ft, add(ft, v(2.9, 0, 0.1)), 1.2, M.silk, { depthBias: 0.2 });
        break;
    }
    const bt = TRIM[look.rar.boots];
    if (bt && look.boots) cap(lerp3(kn, ft, 0.5), lerp3(kn, ft, 0.56), 2.4, bt, { depthBias: 0.06 });
  }

  // Skirt / hem and torso
  const hip = pose.hip;
  const hemEnd = add(hip, v(-0.4 - bs.hemLen * 0.05, 0, -bs.hemLen));
  cap(add(hip, v(0, 0, 1)), hemEnd, bs.hemR + (bs.hemLen > 8 ? 0.4 : 0), bs.hem, { dither: bs.dither && bs.hem !== M.robe });
  if (bs.bare) {
    // Ragged loincloth flaps instead of a tunic.
    cap(add(hip, v(2.6, 0, 0)), add(hip, v(3, 0.4, -5)), 1.5, M.rag, { depthBias: 0.1 });
  }
  cap(add(hip, v(0, 0, 1)), pose.chest, bs.torsoR, bs.torso, { dither: bs.dither });
  if (bs.bare) {
    // Collarbone / ribs shading so the bare chest reads as skin, not a shirt.
    cap(add(pose.shL, v(1.2, 1.2, -1)), add(pose.shR, v(1.2, -1.2, -1)), 0.5, M.skin, { bias: -0.4, depthBias: 0.1 });
  }
  if (bs.strap) cap(add(pose.shL, v(0.9, 0.5, 0)), add(hip, v(1.2, 3.5, 2)), 0.8, M.strap, { depthBias: 0.6 });
  if (bs.studs) {
    for (let i = 0; i < 6; i++) {
      const pt = add(lerp3(add(hip, v(0, 0, 3)), pose.chest, (i % 3) / 2.5 + 0.1), v(bs.torsoR * 0.9, i < 3 ? -1.6 : 1.6, 0));
      sph(pt, 0.55, M.brass, { depthBias: 0.5 });
    }
  }
  if (bs.pauldrons) {
    sph(pose.shL, 3.1, M.plate, { depthBias: 0.3 });
    if (bs.pauldrons === 2) sph(pose.shR, 3.1, M.plate, { depthBias: 0.3 });
  }
  if (bodyTrim && look.body) {
    cap(add(hemEnd, v(0, 0, 0.3)), add(hemEnd, v(0, 0, -0.2)), bs.hemR + (bs.hemLen > 8 ? 0.55 : 0.15), bodyTrim, { depthBias: 0.05 });
    cap(add(pose.neck, v(0, 0, -1.6)), add(pose.neck, v(0, 0, -0.9)), 3.4, bodyTrim, { depthBias: 0.12 });
    if (bs.hem === M.robe) cap(add(hip, v(4.6, 0, 1)), add(hemEnd, v(5.1, 0, 0.2)), 0.6, bodyTrim, { depthBias: 0.4 });
  }

  // Belt (over the sash) and sash (player colour) + hanging tail
  const beltR = bs.torsoR + 0.35;
  cap(add(hip, v(0, 0, 2.2)), add(hip, v(0, 0, 3.2)), beltR + 0.1, pc, { depthBias: 0.15 });
  cap(add(hip, v(-0.5, -4.2, 2.4)), add(hip, v(-1.6 - pose.run, -4.6, -4 + pose.flap * 0.4)), 1.15, pc);
  const beltTrim = TRIM[look.rar.belt];
  switch (look.belt) {
    case "belt_rope":
      cap(add(hip, v(0, 0, 0.9)), add(hip, v(0, 0, 1.4)), beltR, M.rope, { depthBias: 0.16 });
      cap(add(hip, v(beltR, 1.2, 1)), add(hip, v(beltR + 0.4, 1.6, -2.4)), 0.5, M.rope, { depthBias: 0.3 });
      break;
    case "belt_leather":
    case "belt_studded":
      cap(add(hip, v(0, 0, 0.6)), add(hip, v(0, 0, 1.7)), beltR + 0.05, M.strap, { depthBias: 0.16 });
      sph(add(hip, v(beltR, 0, 1.15)), 0.95, beltTrim ?? M.brass, { depthBias: 0.4 });
      if (look.belt === "belt_studded") for (const s of [-2.6, -1.4, 1.4, 2.6]) sph(add(hip, v(beltR * 0.85, s, 1.15)), 0.45, M.steel, { depthBias: 0.4 });
      // Flask pouch on the hip
      cap(add(hip, v(0.5, 4.6, 0.6)), add(hip, v(0.5, 4.8, -1.6)), 1.2, M.leather, { depthBias: 0.2 });
      break;
    case "belt_chain":
      cap(add(hip, v(0, 0, 0.8)), add(hip, v(0, 0, 1.5)), beltR, M.iron, { dither: true, depthBias: 0.16 });
      cap(add(hip, v(beltR, -1, 1)), add(hip, v(beltR + 0.3, -1.3, -2)), 0.45, M.iron, { depthBias: 0.3 });
      break;
  }

  // Arms, gloves and the left-hand off-hand
  const glTrim = TRIM[look.rar.gloves];
  const elbowBend = (side: number): V3 => v(-0.6, side * 0.6, -0.5);
  for (const side of [-1, 1] as const) {
    const sh = side < 0 ? pose.shL : pose.shR;
    const ha = side < 0 ? pose.haL : pose.haR;
    const el = joint(sh, ha, 6.1, elbowBend(side));
    cap(sh, el, bs.sleeveR, bs.sleeve, { dither: bs.dither && bs.sleeve !== M.robe });
    cap(el, ha, bs.sleeveR > 1.9 ? 1.8 : 1.6, bs.forearm, { dither: bs.dither && bs.forearm === M.mail });
    switch (look.gloves) {
      case "":
        sph(ha, 1.7, M.skin, { depthBias: 0.1 });
        break;
      case "gloves_wrap":
        cap(lerp3(el, ha, 0.55), ha, 1.7, M.wraps);
        sph(ha, 1.85, M.wraps, { depthBias: 0.1 });
        break;
      case "gloves_leather":
        cap(lerp3(el, ha, 0.62), lerp3(el, ha, 0.78), 1.95, M.leather);
        sph(ha, 1.9, M.leather, { depthBias: 0.1 });
        break;
      case "gloves_gauntlet":
        cap(lerp3(el, ha, 0.5), lerp3(el, ha, 0.8), 2.1, M.plate);
        sph(ha, 2.2, M.plate, { depthBias: 0.1 });
        break;
      case "gloves_silk":
        cap(lerp3(el, ha, 0.75), lerp3(el, ha, 0.85), 1.8, M.brass, { depthBias: 0.05 });
        sph(ha, 1.65, M.silk, { depthBias: 0.1 });
        break;
    }
    if (glTrim && look.gloves) cap(lerp3(el, ha, 0.7), lerp3(el, ha, 0.76), 2.15, glTrim, { depthBias: 0.07 });
    if (side < 0) offhandParts(parts, look, el, ha, pose, pc);
  }
  if (pose.glow && (pose.glowAt === "L" || pose.glowAt === "both")) glowAt(parts, pose.haL, pose.glow);
  if (pose.glow && (pose.glowAt === "R" || pose.glowAt === "both")) glowAt(parts, pose.haR, pose.glow);

  // Scarf (player colour): neck wrap + streaming tail
  cap(add(pose.neck, v(0, 0, -0.6)), add(pose.neck, v(0.2, 0, 0.9)), 3.3, pc, { depthBias: 0.2 });
  const back = add(pose.neck, v(-2.4, 0.5, 0));
  const tailMid = add(back, v(-2.5 - pose.run * 1.5, 0.6, -2.5 + pose.flap));
  const tailEnd = add(tailMid, v(-2 - pose.run * 2.5, 0.4, -2.5 - pose.flap * 0.6));
  cap(back, tailMid, 1.4, pc);
  cap(tailMid, tailEnd, 1.2, pc);

  // Head and headgear
  const hd = pose.head;
  const eye = (s: number, f = 4.4): Part => ({ kind: "dot", a: add(hd, hv(f, s, 0.2)), r: 1, ramp: M.skin, color: EYE, ref: add(hd, hv(f - 1, s, 0.2)), depthBias: 0.6 });
  const face = (r = 3.3) => sph(add(hd, hv(2.4, 0, -0.9)), r * HS, M.skin, { depthBias: 0.35 });
  const hTrim = TRIM[look.rar.helmet];
  switch (look.helmet) {
    case "":
      sph(hd, 4.7 * HS, M.skin, { depthBias: 0.3 });
      sph(add(hd, hv(-0.9, 0, 1.1)), 4.75 * HS, M.hair, { depthBias: 0.31 });
      parts.push(eye(-1.7), eye(1.7));
      break;
    case "circlet":
      sph(hd, 4.7 * HS, M.skin, { depthBias: 0.3 });
      sph(add(hd, hv(-0.9, 0, 1.1)), 4.75 * HS, M.hair, { depthBias: 0.31 });
      parts.push(eye(-1.7), eye(1.7));
      for (let i = 0; i < 10; i++) {
        const a0 = (i / 10) * Math.PI * 2;
        const a1 = ((i + 1) / 10) * Math.PI * 2;
        const R = 5.05;
        cap(add(hd, hv(Math.cos(a0) * R - 0.4, Math.sin(a0) * R, 2.2)), add(hd, hv(Math.cos(a1) * R - 0.4, Math.sin(a1) * R, 2.2)), 0.42, hTrim ?? M.brass, { depthBias: 0.45 });
      }
      sph(add(hd, hv(4.7, 0, 2.3)), 0.75, M.gem, { depthBias: 0.6 });
      break;
    case "hood":
      sph(add(hd, hv(-0.4, 0, 0.6)), 5.5 * HS, M.hood, { depthBias: 0.31 });
      cap(add(hd, hv(-1, 0, 4.2)), add(hd, hv(-4.6, 0, 3)), 1.6 * HS, M.hood, { depthBias: 0.3 });
      cap(add(hd, hv(-3, 0, -1)), add(pose.neck, v(-3.4, 0, -3)), 3.2 * HS, M.hood, { depthBias: -0.2 });
      parts.push({ kind: "sph", a: add(hd, hv(2.7, 0, -0.6)), r: 3.2 * HS, ramp: [M.skin[0], M.skin[0], M.skin[1], M.skin[2]], depthBias: 0.35 });
      parts.push(eye(-1.3), eye(1.3));
      if (hTrim) cap(add(hd, hv(3.6, -3, 2.6)), add(hd, hv(3.6, 3, 2.6)), 0.5, hTrim, { depthBias: 0.5 });
      break;
    case "coif":
      sph(add(hd, hv(-0.4, 0, 0.5)), 5.05 * HS, M.leather, { depthBias: 0.31 });
      face(3.2);
      for (const s of [-1, 1]) cap(add(hd, hv(0.5, s * 3.6, 0)), add(hd, hv(1.4, s * 3.4, -3.6)), 1.2 * HS, M.leather, { depthBias: 0.4 });
      parts.push(eye(-1.4), eye(1.4));
      if (hTrim) cap(add(hd, hv(3.4, -3, 2.2)), add(hd, hv(3.4, 3, 2.2)), 0.45, hTrim, { depthBias: 0.5 });
      break;
    case "helm_open":
    case "helm_horned": {
      sph(add(hd, hv(-0.5, 0, 1)), 5.2 * HS, M.plate, { depthBias: 0.31 });
      face(3.3);
      parts.push(eye(-1.4), eye(1.4));
      cap(add(hd, hv(4.4, 0, 2.6)), add(hd, hv(4.9, 0, -0.6)), 0.55, M.plate, { depthBias: 0.62 }); // nasal
      parts.push({ kind: "disc", a: add(hd, hv(-0.3, 0, 1.7)), r: 5.6 * HS, n: v(0, 0, 1), ramp: M.plate, rim: rgba("#2a2d33"), depthBias: 0.3 });
      if (look.helmet === "helm_horned") {
        for (const s of [-1, 1]) {
          const a0 = add(hd, hv(-0.5, s * 4.2, 3));
          const a1 = add(hd, hv(-1.5, s * 6.8, 5.5));
          const a2 = add(hd, hv(0.8, s * 7.6, 9));
          cap(a0, a1, 1.1, M.bone, { depthBias: 0.35 });
          cap(a1, a2, 0.7, M.bone, { depthBias: 0.35 });
        }
      }
      if (hTrim) cap(add(hd, hv(-0.4, -4.9, 1.9)), add(hd, hv(-0.4, 4.9, 1.9)), 0.5, hTrim, { depthBias: 0.45 });
      break;
    }
    case "helm_great":
      cap(add(hd, hv(0, 0, -1.6)), add(hd, hv(0, 0, 1.4)), 5.1 * HS, M.plate, { depthBias: 0.31 });
      cap(add(hd, hv(2.2, 0, 5.3)), add(hd, hv(-3.5, 0, 4.5)), 1.1 * HS, hTrim ?? M.brass, { depthBias: 0.4 });
      for (let s = -2.4; s <= 2.4; s += 0.8) dot(add(hd, hv(5.1, s, 0.2)), add(hd, hv(3.8, s * 0.6, 0.2)), SLIT);
      dot(add(hd, hv(5.2, 0, -1.4)), add(hd, hv(3.8, 0, -1.4)), SLIT);
      break;
  }

  weaponParts(parts, wl, pose, TRIM[look.rar.weapon], look.rar.weapon >= 3);
  return parts;
}

function glowAt(parts: Part[], at: V3, k: number) {
  if (k <= 0.05) return;
  parts.push({ kind: "sph", a: at, r: 1.4 + k * 1.6, ramp: M.glow, depthBias: 0.8, dither: k < 0.5 });
}

function offhandParts(parts: Part[], look: Look, el: V3, ha: V3, pose: Pose, pc: Ramp) {
  const trim = TRIM[look.rar.offhand];
  const c = add(lerp3(el, ha, 0.55), v(0.4, -1.8, 0));
  const n = norm(v(0.25, -1, 0.1));
  const u = v(0, 0, 1);
  const t = norm(cross(n, u));
  const P = (a: number, b: number) => add(add(c, mul(t, a)), mul(u, b));
  const rim = (pts: V3[], rp: Ramp) => {
    for (let i = 0; i < pts.length; i++) parts.push({ kind: "cap", a: pts[i], b: pts[(i + 1) % pts.length], r: 0.5, ramp: rp, depthBias: 0.45 });
  };
  switch (look.offhand) {
    case "shield_buckler":
      parts.push({ kind: "disc", a: c, r: 3.4, n, ramp: M.leather, rim: rgba("#2b1b10"), boss: rgba(trim ? "#e6c36a" : "#9aa2ae"), depthBias: 0.4 });
      break;
    case "shield_round":
      parts.push({ kind: "disc", a: c, r: 5, n, ramp: M.wood, rim: rgba(trim ? "#c8a040" : "#3a3c42"), boss: rgba("#9aa2ae"), depthBias: 0.4 });
      break;
    case "shield_kite": {
      const pts = [P(0, 6.5), P(4.2, 2.2), P(0, -8), P(-4.2, 2.2)];
      parts.push({ kind: "poly", a: c, r: 0, ramp: M.plate, pts, color: M.plate[1], depthBias: 0.4 });
      parts.push({ kind: "disc", a: add(P(0, 1), mul(n, 0.2)), r: 1.8, n, ramp: pc, rim: pc[0], boss: pc[2], depthBias: 0.42 });
      rim(pts, trim ?? M.iron);
      break;
    }
    case "shield_tower": {
      const pts = [P(-4, 8.5), P(4, 8.5), P(4, -8.5), P(-4, -8.5)];
      parts.push({ kind: "poly", a: c, r: 0, ramp: M.wood, pts, color: M.wood[1], depthBias: 0.4 });
      for (const b of [5, 0, -5]) parts.push({ kind: "cap", a: P(-3.8, b), b: P(3.8, b), r: 0.45, ramp: M.iron, depthBias: 0.43 });
      rim(pts, trim ?? M.iron);
      break;
    }
    case "focus_orb": {
      const o = add(ha, v(0.6, 0, 3.6));
      parts.push({ kind: "sph", a: o, r: 2.1, ramp: M.glow, depthBias: 0.5 });
      parts.push({ kind: "cap", a: add(o, v(-1.8, -1.8, -0.6)), b: add(o, v(1.8, 1.8, 0.6)), r: 0.35, ramp: trim ?? M.brass, depthBias: 0.55 });
      break;
    }
    case "quiver": {
      const top = add(pose.neck, v(-3.4, 2.2, 1.5));
      const bot = add(pose.hip, v(-3.6, 2.8, 0));
      parts.push({ kind: "cap", a: top, b: bot, r: 1.7, ramp: M.leather, depthBias: -0.3 });
      for (const s of [-0.7, 0, 0.7]) parts.push({ kind: "cap", a: add(top, v(0, s, 0)), b: add(top, v(0.3, s * 1.4, 2.6)), r: 0.45, ramp: s === 0 ? M.gem : M.bone, depthBias: -0.25 });
      if (trim) parts.push({ kind: "cap", a: lerp3(top, bot, 0.2), b: lerp3(top, bot, 0.26), r: 1.9, ramp: trim, depthBias: -0.28 });
      break;
    }
  }
}

const UNIQUE_BLADE = ramp("#4a3a30", "#9a8070", "#e6cbb0", "#fff4e6");
METAL_RAMPS.add(UNIQUE_BLADE);
const BLOOD_C = rgba("#6a0606");
/** Blood coating level for the figure being built (set by heroFrame). */
let bladeBlood = 0;
const bloodCache = new Map<string, Ramp>();
function bloodied(base: Ramp): Ramp {
  if (bladeBlood <= 0) return base;
  const k = base.join(",") + "|" + bladeBlood;
  let r = bloodCache.get(k);
  if (!r) {
    const t = [0.25, 0.45, 0.65][Math.min(3, bladeBlood) - 1];
    r = base.map((c, i) => mixColor(c, BLOOD_C, i === 3 ? t * 0.6 : t)) as Ramp;
    bloodCache.set(k, r);
  }
  return r;
}

function weaponParts(parts: Part[], wl: string, pose: Pose, trim: Ramp | null, unique: boolean) {
  const cap = (a: V3, b: V3, r: number, rp: Ramp, extra: Partial<Part> = {}) => parts.push({ kind: "cap", a, b, r, ramp: rp, ...extra });
  const sph = (a: V3, r: number, rp: Ramp, extra: Partial<Part> = {}) => parts.push({ kind: "sph", a, r, ramp: rp, ...extra });
  const poly = (pts: V3[], rp: Ramp, ci = 2, depthBias = 0.03) => parts.push({ kind: "poly", a: pts[0], r: 0, ramp: rp, pts, color: rp[ci], depthBias });
  const ha = pose.haR;
  const w = pose.w;
  const upv: V3 = Math.abs(w[2]) > 0.95 ? v(1, 0, 0) : v(0, 0, 1);
  const side = norm(cross(w, upv));
  const at = (t: number): V3 => add(ha, mul(w, t));
  const guard = trim ?? M.brass;
  const blade = bloodied(unique ? UNIQUE_BLADE : M.steel);
  /** Edge direction for axe heads / mace flanges: perpendicular to the haft in the swing plane. */
  let edge = norm(cross(w, v(0, 1, 0)));
  if (edge[0] < 0) edge = mul(edge, -1);
  const e = (t: number, k: number): V3 => add(at(t), mul(edge, k));
  let tip: V3 | null = null;

  switch (wl) {
    case "sword_short":
      cap(at(-2), at(0.8), 0.85, M.strap);
      cap(add(at(1.2), mul(side, -2.4)), add(at(1.2), mul(side, 2.4)), 0.8, guard, { depthBias: 0.05 });
      cap(at(1.8), at(11), 1.1, blade, { depthBias: 0.05 });
      tip = at(11);
      break;
    case "sword_long":
      cap(at(-2.6), at(1), 0.9, M.strap);
      sph(at(-2.9), 0.9, guard);
      cap(add(at(1.4), mul(side, -3.2)), add(at(1.4), mul(side, 3.2)), 0.9, guard, { depthBias: 0.05 });
      cap(at(2), at(15.5), 1.15, blade, { depthBias: 0.05 });
      tip = at(15.5);
      break;
    case "greatsword":
      cap(at(-5), at(1), 0.95, M.strap);
      sph(at(-5.3), 1.1, guard);
      cap(add(at(1.5), mul(side, -4.2)), add(at(1.5), mul(side, 4.2)), 1.05, guard, { depthBias: 0.05 });
      cap(at(2.2), at(21), 1.55, blade, { depthBias: 0.05 });
      cap(at(2.4), at(18), 0.45, M.iron, { depthBias: 0.07, bias: -0.5 }); // fuller
      tip = at(21.5);
      break;
    case "axe_hand":
    case "greataxe": {
      const big = wl === "greataxe";
      const L = big ? 19 : 13.5;
      cap(at(big ? -6 : -3), at(L), big ? 1.1 : 1, M.wood);
      poly([e(L - 4.5, 0.8), e(L + 0.3, 0.8), e(L + 2.1, big ? 8.5 : 7), e(L - 6.1, big ? 8.5 : 7)], blade, 1, 0.02);
      cap(e(L + 1.9, big ? 8.2 : 6.7), e(L - 5.9, big ? 8.2 : 6.7), 0.55, blade, { bias: 0.8, depthBias: 0.03 });
      if (big) poly([e(L - 4, -0.8), e(L, -0.8), e(L + 1.2, -6), e(L - 5.2, -6)], blade, 1, 0.02);
      else poly([e(L - 3, -0.6), e(L - 1, -0.6), e(L - 2, -3.2)], blade, 0, 0.02);
      if (trim) cap(at(L - 5), at(L + 0.5), 1.25, trim, { depthBias: 0.04 });
      tip = e(L, 5);
      break;
    }
    case "mace":
    case "sceptre": {
      cap(at(-2.5), at(10), 0.85, wl === "sceptre" ? M.brass : M.wood);
      const hdp = at(11.5);
      if (wl === "mace") {
        sph(hdp, 2.3, M.iron);
        for (const k of [-1, 1]) {
          cap(add(hdp, mul(side, 2.4 * k)), add(add(hdp, mul(side, 2.6 * k)), mul(w, 0.8)), 0.65, M.iron, { depthBias: 0.04 });
          cap(add(hdp, mul(edge, 2.4 * k)), add(add(hdp, mul(edge, 2.6 * k)), mul(w, 0.8)), 0.65, M.iron, { depthBias: 0.04 });
        }
      } else {
        sph(hdp, 1.9, trim ?? M.brass);
        sph(add(hdp, mul(w, 1.6)), 1.15, M.gem, { depthBias: 0.05 });
      }
      tip = at(13);
      break;
    }
    case "maul":
      cap(at(-6), at(17), 1.05, M.wood);
      cap(add(at(18.5), mul(edge, -3.2)), add(at(18.5), mul(edge, 3.6)), 2.6, M.iron);
      if (trim) cap(add(at(18.5), mul(edge, -1)), add(at(18.5), mul(edge, 1)), 2.8, trim, { depthBias: 0.03 });
      tip = at(18.5);
      break;
    case "dagger":
      cap(at(-1.6), at(0.8), 0.8, M.strap);
      cap(add(at(1.1), mul(side, -1.8)), add(at(1.1), mul(side, 1.8)), 0.7, guard, { depthBias: 0.05 });
      cap(at(1.6), at(8.5), 0.9, blade, { depthBias: 0.05 });
      tip = at(8.5);
      break;
    case "claw":
      for (const s of [-1.1, 0, 1.1]) {
        const b0 = add(at(0.8), mul(side, s));
        cap(b0, add(add(b0, mul(w, 5.5)), mul(edge, 1.2)), 0.5, M.bone, { depthBias: 0.05 });
      }
      cap(at(-1), at(1), 1.3, guard);
      tip = at(6);
      break;
    case "spear":
    case "quarterstaff": {
      if (wl === "quarterstaff") {
        cap(at(-12), at(14), 0.9, M.wood);
        for (const t of [-12, 14]) cap(at(t - 1), at(t + 0.4), 1.15, trim ?? M.iron);
        tip = at(14);
        break;
      }
      cap(at(-12), at(20), 0.85, M.wood);
      cap(at(19), at(20.5), 1.1, guard);
      const b = at(20.5);
      const tp = at(27);
      poly([add(b, mul(side, 1.9)), tp, add(b, mul(side, -1.9))], blade, 2, 0.03);
      cap(lerp3(b, tp, 0.1), lerp3(b, tp, 0.85), 0.5, blade, { bias: 0.6, depthBias: 0.01 });
      tip = tp;
      break;
    }
    case "wand":
      cap(at(-1), at(8), 0.55, M.bone);
      sph(at(8.4), 0.9, trim ?? M.gem, { depthBias: 0.05 });
      tip = at(8.6);
      break;
    case "staff": {
      cap(at(-11), at(14.5), 0.9, M.wood);
      // Gnarled head: three curling prongs around a stone.
      for (const k of [-1, 1]) cap(at(14.5), add(at(17), mul(side, 1.6 * k)), 0.6, M.wood, { depthBias: 0.02 });
      cap(at(14.5), add(at(17.5), mul(edge, 1.4)), 0.6, M.wood);
      sph(at(16.4), 1.3, trim ?? M.glow, { depthBias: 0.04 });
      tip = at(16.4);
      break;
    }
    case "bow":
      if (pose.bow) bowParts(parts, pose, trim, unique);
      break;
    case "crossbow": {
      cap(at(-4), at(10), 1, M.wood);
      const fr = at(9);
      const pull = at(4.5);
      const l = add(add(fr, mul(side, -6)), mul(w, -2));
      const r = add(add(fr, mul(side, 6)), mul(w, -2));
      cap(fr, l, 0.6, trim ?? M.iron);
      cap(fr, r, 0.6, trim ?? M.iron);
      cap(l, pull, 0.22, M.bone, { depthBias: 0.05 });
      cap(r, pull, 0.22, M.bone, { depthBias: 0.05 });
      cap(pull, at(10.5), 0.35, M.wood, { depthBias: 0.06 });
      tip = at(10.5);
      break;
    }
  }
  if (tip && pose.glow && pose.glowAt === "tip") glowAt(parts, tip, pose.glow);
  else if (pose.glow && pose.glowAt === "tip") glowAt(parts, pose.haR, pose.glow);
  if (tip && unique) parts.push({ kind: "sph", a: tip, r: 1.1, ramp: TRIM[3]!, depthBias: 0.07, dither: true });
}

/** Recurve bow in the left hand; string to the right hand while drawn, with a nocked arrow. */
function bowParts(parts: Part[], pose: Pose, trim: Ramp | null, unique: boolean) {
  const b = pose.bow!;
  const g = pose.haL;
  const u = norm(b.up);
  const aim = norm(b.aim);
  const flex = 2.6 + b.draw * 1.6;
  const pt = (k: number): V3 => add(add(g, mul(u, k * 9.5)), mul(aim, -flex * k * k + (Math.abs(k) < 0.3 ? 0.6 : 0)));
  const wood = unique ? M.bone : M.wood;
  const ks = [-1, -0.65, -0.3, 0, 0.3, 0.65, 1];
  for (let i = 0; i < ks.length - 1; i++) parts.push({ kind: "cap", a: pt(ks[i]), b: pt(ks[i + 1]), r: Math.abs(ks[i]) < 0.35 ? 0.85 : 0.6, ramp: wood, depthBias: 0.1 });
  parts.push({ kind: "cap", a: pt(-0.12), b: pt(0.12), r: 1, ramp: trim ?? M.strap, depthBias: 0.12 });
  const top = add(pt(1), mul(aim, -0.3));
  const bot = add(pt(-1), mul(aim, -0.3));
  const str = ramp("#4a4436", "#8a8270", "#c8c0aa", "#ece6d6");
  if (b.draw > 0.05) {
    const nock = pose.haR;
    parts.push({ kind: "cap", a: top, b: nock, r: 0.2, ramp: str, depthBias: 0.15 });
    parts.push({ kind: "cap", a: bot, b: nock, r: 0.2, ramp: str, depthBias: 0.15 });
  } else parts.push({ kind: "cap", a: top, b: bot, r: 0.2, ramp: str, depthBias: 0.15 });
  if (b.arrow) {
    const nock = b.draw > 0.05 ? pose.haR : add(g, mul(aim, -3));
    const dir = norm(sub(add(g, mul(aim, 3)), nock));
    const head = add(nock, mul(dir, 15));
    parts.push({ kind: "cap", a: nock, b: head, r: 0.3, ramp: M.wood, depthBias: 0.2 });
    parts.push({ kind: "cap", a: head, b: add(head, mul(dir, 1.6)), r: 0.6, ramp: M.steel, depthBias: 0.21 });
    parts.push({ kind: "cap", a: add(nock, mul(dir, 0.4)), b: add(nock, mul(dir, 2.4)), r: 0.6, ramp: M.gem, depthBias: 0.19 });
  }
}

const POSE_PTS = ["hip", "chest", "neck", "head", "shL", "shR", "haL", "haR", "hpL", "hpR", "ftL", "ftR", "w"] as const;

/** Pose at a fractional frame: keyframes are blended so animation is smooth, not stepped. */
export function heroPoseAt(anim: HeroAnim, ft: number, wk: string | null, wl = ""): Pose {
  const n = HERO_FRAMES[anim];
  const loop = LOOPING.has(anim) || anim === "idle" || anim === "run";
  const f0 = Math.floor(ft);
  const t = ft - f0;
  const a = heroPose(anim, loop ? ((f0 % n) + n) % n : Math.min(n - 1, f0), wk, wl);
  if (t < 0.02) return a;
  const b = heroPose(anim, loop ? (((f0 + 1) % n) + n) % n : Math.min(n - 1, f0 + 1), wk, wl);
  const out: Pose = { ...a };
  for (const k of POSE_PTS) out[k] = lerp3(a[k], b[k], t);
  out.w = norm(out.w);
  for (const k of ["knL", "knR"] as const) {
    const ka = a[k];
    const kb = b[k];
    if (ka && kb) out[k] = lerp3(ka, kb, t);
    else out[k] = t < 0.5 ? ka : kb;
  }
  out.run = a.run + (b.run - a.run) * t;
  out.flap = a.flap + (b.flap - a.flap) * t;
  out.glow = (a.glow ?? 0) + ((b.glow ?? 0) - (a.glow ?? 0)) * t;
  out.glowAt = a.glowAt ?? b.glowAt;
  out.lift = (a.lift ?? 0) + ((b.lift ?? 0) - (a.lift ?? 0)) * t;
  if (a.rot || b.rot) {
    const ra = a.rot ?? { ang: 0, pivot: b.rot!.pivot };
    const rb = b.rot ?? { ang: 0, pivot: ra.pivot };
    let d = rb.ang - ra.ang;
    if (anim === "roll" && d < 0) d += Math.PI * 2;
    out.rot = { ang: ra.ang + d * t, pivot: lerp3(ra.pivot, rb.pivot, t) };
  }
  if (a.bow && b.bow) {
    out.bow = {
      up: norm(lerp3(a.bow.up, b.bow.up, t)),
      aim: norm(lerp3(a.bow.aim, b.bow.aim, t)),
      draw: a.bow.draw + (b.bow.draw - a.bow.draw) * t,
      arrow: t < 0.5 ? a.bow.arrow : b.bow.arrow,
    };
  }
  return out;
}

/** Sprite lift (screen units) at a fractional frame (jumps). */
export function heroLiftAt(anim: HeroAnim, ft: number): number {
  if (anim !== "slam" && anim !== "leap") return 0;
  return (heroPoseAt(anim, ft, null).lift ?? 0) * SCALE;
}

/** Sub-frame steps cached per keyframe (smooth motion, bounded cache). */
export const SUBFRAMES = 3;

/** `dir` is a DIRS-way screen direction index; `ft` a fractional frame (quantized by the caller). */
export function buildHeroFrame(cfg: HeroConfig, dir: number, anim: HeroAnim, ft: number, flash: boolean): Sprite {
  const wl = cfg.look.weapon || (cfg.wk ? KIND_LOOK[cfg.wk] ?? "" : "");
  const pose = heroPoseAt(anim, ft, cfg.wk, wl);
  bladeBlood = cfg.blood ?? 0;
  const parts = filterRegions(heroParts(cfg, pose), pose, cfg);
  bladeBlood = 0;
  if (pose.rot) {
    const { ang, pivot } = pose.rot;
    transformParts(parts, (q) => rotS(q, ang, pivot));
  }
  return paintSprite(parts, dirToWorldAngle(dir, DIRS), SCALE, W, H, AX, AY, flash);
}

const cache = new Map<string, Sprite>();
/** Cached hero sprite. `frame` may be fractional; it is quantized to 1/SUBFRAMES. */
export function heroFrame(cfg: HeroConfig, lookCode: string, dir: number, anim: HeroAnim, frameIn: number, flash = false): Sprite {
  const frame = Math.round(frameIn * SUBFRAMES) / SUBFRAMES;
  const gk = (cfg.only ? "o" + cfg.only : cfg.missing?.length ? "m" + cfg.missing.join(".") : "") + (cfg.blood ? "b" + cfg.blood : "");
  const key = `${lookCode}|${cfg.color}|${cfg.wk}|${dir}|${anim}|${frame}|${flash ? 1 : 0}|${spriteDensity()}${gk}`;
  let s = cache.get(key);
  if (!s) {
    if (!canBuild()) {
      const base = `${lookCode}|${cfg.color}|${cfg.wk}|`;
      const d = spriteDensity();
      const fb =
        cache.get(`${base}${dir}|${anim}|${Math.floor(frame)}|0|${d}`) ?? cache.get(`${base}${dir}|${anim}|0|0|${d}`) ?? cache.get(`${base}${dir}|idle|0|0|${d}`);
      if (fb) return fb;
    }
    if (cache.size > 6000) cache.clear();
    s = buildHeroFrame(cfg, dir, anim, frame, flash);
    cache.set(key, s);
  }
  return s;
}
export function heroCacheSize() {
  return cache.size;
}
