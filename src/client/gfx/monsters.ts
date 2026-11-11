// Original monster designs built on the part rig: Gnashling (small toothy runner), Bog Seer
// (hunched caster with a glowing staff) and Cragback (rock-backed brute with a huge slam windup).
// Frames are generated lazily and cached per (type, size, elite mods, direction, anim, frame, flash).
import { ART, dirToWorldAngle } from "./iso";
import { canBuild, PixBuf, ramp, rgba, scaleColor, type Ramp, type Sprite, sprite } from "./pixel";
import { add, lerp3, norm, projector, rasterize, rotF, rotS, transformParts, v, type Part, type V3 } from "./rig";

export type MonAnim = "idle" | "move" | "windup" | "strike" | "death";
export const MON_FRAMES: Record<MonAnim, number> = { idle: 4, move: 6, windup: 4, strike: 3, death: 6 };

interface MonDef {
  baseR: number; // world radius the rig is designed for
  scale: number;
  w: number;
  h: number;
  ay: number;
  parts(anim: MonAnim, f: number): Part[];
}

// Grim, desaturated palette: ashen hide, grave-rotten cloth, cold stone. Only eyes, the
// corpse-light orb and elite rings are saturated.
const R = {
  gnashHide: ramp("#1b1915", "#34302a", "#504a3f", "#6c6554"),
  gnashBelly: ramp("#28221d", "#433930", "#5e5144", "#786a5a"),
  gnashMouth: ramp("#160505", "#330b0b", "#561412", "#74221c"),
  teeth: ramp("#7a735f", "#ada58c", "#d0c8ae", "#ece6d2"),
  claw: ramp("#14100d", "#2a221b", "#40362b", "#58493a"),
  robe: ramp("#110e0b", "#201b15", "#322a20", "#463b2e"),
  robeHem: ramp("#0b0908", "#16120e", "#231d16", "#332a20"),
  seerSkin: ramp("#38332a", "#655d4e", "#8f8670", "#b1a990"),
  wood: ramp("#17100a", "#2d2014", "#45321f", "#5e462c"),
  orb: ramp("#1d5450", "#45ab9c", "#a0eedd", "#eafff9"),
  orbHot: ramp("#33918a", "#86ecd8", "#d8fff4", "#ffffff"),
  cragSkin: ramp("#1b1715", "#332c28", "#4d433d", "#685b53"),
  cragRock: ramp("#232327", "#3e3e44", "#605f66", "#838188"),
  cragMoss: ramp("#191c14", "#282d20", "#3a412e", "#4f573e"),
  cragFist: ramp("#211d1b", "#3c3532", "#5a504a", "#776a62"),
};
const GLOW_Y = rgba("#ff5a22");
const GLOW_G = rgba("#a8fff0");
const GLOW_R = rgba("#ff4a2a");
const DARK = rgba("#0b0605");

const cap = (a: V3, b: V3, r: number, rp: Ramp, x: Partial<Part> = {}): Part => ({ kind: "cap", a, b, r, ramp: rp, ...x });
const sph = (a: V3, r: number, rp: Ramp, x: Partial<Part> = {}): Part => ({ kind: "sph", a, r, ramp: rp, ...x });
const dot = (a: V3, ref: V3, color: number, r = 1): Part => ({ kind: "dot", a, ref, r, color, ramp: R.teeth, depthBias: 0.8 });

// ---- Gnashling ---------------------------------------------------------------------
function gnashParts(anim: MonAnim, f: number): Part[] {
  let lunge = 0;
  let crouch = 0;
  let jaw = 0.25;
  let gait = 0;
  let bob = 0;
  if (anim === "idle") {
    bob = [0, 0.4, 0.7, 0.4][f] ?? 0;
    jaw = 0.2 + bob * 0.15;
  } else if (anim === "move") {
    gait = (f / 6) * Math.PI * 2;
    bob = Math.abs(Math.sin(gait)) * 1.4;
    jaw = 0.35;
  } else if (anim === "windup") {
    const t = (f + 1) / 4;
    crouch = t * 2.6;
    jaw = 0.4 + t * 0.6;
    lunge = -t * 2;
  } else if (anim === "strike") {
    lunge = [5, 6, 3][f] ?? 0;
    jaw = [1, 0.1, 0.3][f] ?? 0;
  }
  const z0 = 8 - crouch + bob * 0.5;
  const P: Part[] = [];
  const body0 = v(-6 + lunge, 0, z0 + 0.5);
  const body1 = v(2 + lunge, 0, z0 + 4);
  P.push(cap(body0, body1, 4.4, R.gnashHide));
  P.push(cap(add(body0, v(1, 0, -2.2)), add(body1, v(-1, 0, -2.4)), 3.6, R.gnashBelly, { depthBias: -0.3 }));
  // Spines along the back
  for (let i = 0; i < 4; i++) {
    const b = lerp3(body0, body1, i / 3);
    P.push(cap(add(b, v(0, 0, 3.2)), add(b, v(-1.6, 0, 5.6 - i * 0.4)), 0.9, R.teeth, { depthBias: -0.2 })); // bony knobs
  }
  // Legs (front pair / back pair, diagonal gait)
  const legs: [number, number, number][] = [
    [2.5 + lunge, -3.2, 0],
    [2.5 + lunge, 3.2, Math.PI],
    [-5 + lunge, -3.2, Math.PI],
    [-5 + lunge, 3.2, 0],
  ];
  for (const [lf, ls, ph] of legs) {
    const sw = Math.sin(gait + ph) * (anim === "move" ? 3.5 : 0);
    const lift = anim === "move" ? Math.max(0, Math.cos(gait + ph)) * 2.2 : 0;
    const top = v(lf, ls, z0 - 1);
    const foot = v(lf + sw + (anim === "strike" ? 1.5 : 0), ls * 1.15, 0.8 + lift);
    const knee = v((lf + foot[0]) / 2 + (lf < 0 ? -1.5 : 1), ls * 1.2, (z0 + foot[2]) / 2);
    P.push(cap(top, knee, 1.9, R.gnashHide));
    P.push(cap(knee, foot, 1.4, R.gnashHide));
    P.push(cap(foot, add(foot, v(1.6, 0, -0.2)), 1, R.claw));
  }
  // Tail
  P.push(cap(add(body0, v(-3, 0, 1)), add(body0, v(-8, 0, 3 + bob)), 1.4, R.gnashHide));
  P.push(cap(add(body0, v(-8, 0, 3 + bob)), add(body0, v(-11, 0.5, 1.5 + bob)), 0.9, R.claw));
  // Head: oversized, all mouth
  const hd = add(body1, v(4, 0, 1));
  P.push(sph(hd, 4.5, R.gnashHide, { depthBias: 0.2 }));
  // Long, ragged bat ears swept back
  P.push(cap(add(hd, v(-1.2, -2.6, 2.6)), add(hd, v(-6, -6, 5)), 0.8, R.gnashHide));
  P.push(cap(add(hd, v(-1.2, 2.6, 2.6)), add(hd, v(-6, 6, 5)), 0.8, R.gnashHide));
  // Jaws: upper snout and a lower jaw that drops open
  const snout = add(hd, v(4.5, 0, 0.6));
  P.push(cap(add(hd, v(1.5, 0, 0.6)), snout, 3.4, R.gnashHide, { depthBias: 0.25 }));
  const jawOpen = jaw * 4.2;
  const lowJaw = add(hd, v(4, 0, -2.2 - jawOpen));
  P.push(cap(add(hd, v(1, 0, -2)), lowJaw, 2.8, R.gnashBelly, { depthBias: 0.22 }));
  // Mouth cavity between the jaws
  if (jawOpen > 1) P.push(cap(add(hd, v(3.2, 0, -0.5)), add(hd, v(4.2, 0, -1.5 - jawOpen * 0.5)), 1.8, R.gnashMouth, { depthBias: 0.24 }));
  // Teeth rows (upper + lower), visible from the front and sides
  for (const s of [-2.4, -1.2, 0, 1.2, 2.4]) {
    P.push(dot(add(snout, v(1.3 - Math.abs(s) * 0.3, s, -2.2)), add(snout, v(-0.5, s * 0.5, -1.5)), R.teeth[3]));
    P.push(dot(add(lowJaw, v(1 - Math.abs(s) * 0.3, s * 0.9, 1.6)), add(lowJaw, v(-1, s * 0.5, 1)), R.teeth[2]));
  }
  // Glowing eyes
  P.push(dot(add(hd, v(3, -2.4, 2.4)), add(hd, v(1, -1.4, 2)), GLOW_Y));
  P.push(dot(add(hd, v(3, 2.4, 2.4)), add(hd, v(1, 1.4, 2)), GLOW_Y));
  return P;
}

// ---- Bog Seer ----------------------------------------------------------------------
function seerParts(anim: MonAnim, f: number): Part[] {
  let sway = 0;
  let bob = 0;
  let raise = 0; // staff raise 0..1
  let thrust = 0;
  let hot = false;
  if (anim === "idle") {
    sway = [0, 0.5, 0, -0.5][f] ?? 0;
    bob = [0, 0.3, 0.6, 0.3][f] ?? 0;
  } else if (anim === "move") {
    const ph = (f / 6) * Math.PI * 2;
    bob = Math.abs(Math.sin(ph)) * 1.2;
    sway = Math.sin(ph) * 0.8;
  } else if (anim === "windup") {
    raise = (f + 1) / 4;
    hot = f >= 2;
  } else if (anim === "strike") {
    thrust = [1, 0.8, 0.4][f] ?? 0;
    hot = f === 0;
  }
  const P: Part[] = [];
  const z = bob * 0.5;
  // Robe: layered cone, wide ragged hem
  P.push(cap(v(-0.5, sway * 0.3, 2 + z * 0.2), v(0, 0, 3), 6.4, R.robeHem));
  P.push(cap(v(0, 0, 4 + z), v(1, sway * 0.2, 11 + z), 5.4, R.robe));
  for (const [a, l] of [[0.3, 3], [1.4, 2.2], [2.5, 3.2], [3.6, 2.4], [4.7, 3], [5.6, 2]] as const) {
    P.push(cap(v(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 2.5), v(Math.cos(a) * 6.1, Math.sin(a) * 6.1, 2.5 - l * 0.6), 1.1, R.robeHem, { depthBias: -0.1 }));
  }
  // Hunched back + shoulders
  const back = v(-1.5, sway * 0.2, 14.5 + z);
  P.push(sph(back, 5, R.robe));
  const sh = v(1.5, sway * 0.3, 15.5 + z);
  // Hood, pushed forward and low
  const hd = add(sh, v(3.3, 0, 1.6));
  P.push(sph(add(hd, v(-0.6, 0, 0.5)), 4.4, R.robe, { depthBias: 0.2 }));
  P.push(sph(add(hd, v(1.6, 0, -0.3)), 2.9, R.robeHem, { depthBias: 0.25 }));
  P.push(sph(add(hd, v(2.4, 0, -0.6)), 2.2, R.seerSkin, { depthBias: 0.27 })); // skull face in the hood
  P.push(cap(add(hd, v(-1, 0, 3.5)), add(hd, v(-4.5, 0, 6)), 1.3, R.robe, { depthBias: 0.1 }));
  // Antler twigs bound to the hood
  for (const s of [-1, 1]) {
    const base = add(hd, v(-0.5, s * 2.6, 3));
    const tip = add(base, v(-1.5, s * 3, 5));
    P.push(cap(base, tip, 0.55, R.wood));
    P.push(cap(lerp3(base, tip, 0.5), add(lerp3(base, tip, 0.5), v(1.6, s * 1.2, 2.2)), 0.45, R.wood));
  }
  // Glowing eyes deep in the hood
  P.push(dot(add(hd, v(4.3, -1, -0.4)), add(hd, v(1.8, -0.8, -0.2)), GLOW_G));
  P.push(dot(add(hd, v(4.3, 1, -0.4)), add(hd, v(1.8, 0.8, -0.2)), GLOW_G));
  // Left arm: gnarled hand reaching forward
  const shL = add(sh, v(0, -4.2, -0.5));
  const haL = add(shL, v(4.5 + raise * 1.5, -0.5, -3.5 + raise * 2));
  P.push(cap(shL, haL, 1.6, R.robe));
  P.push(sph(haL, 1.4, R.seerSkin, { depthBias: 0.1 }));
  for (const s of [-0.8, 0, 0.8]) P.push(cap(haL, add(haL, v(1.8, s, -0.8)), 0.45, R.seerSkin, { depthBias: 0.12 }));
  // Right arm + staff
  const shR = add(sh, v(0, 4.2, -0.5));
  const haR = add(shR, v(3 + raise * 2 + thrust * 4, 1.2, -4 + raise * 6 + thrust * 1));
  P.push(cap(shR, haR, 1.6, R.robe));
  P.push(sph(haR, 1.4, R.seerSkin, { depthBias: 0.12 }));
  const tilt = raise * 0.55 + thrust * 1.1;
  const sdir = norm(v(Math.sin(tilt), 0, Math.cos(tilt)));
  const at = (t: number): V3 => add(haR, [sdir[0] * t, sdir[1] * t, sdir[2] * t]);
  P.push(cap(at(-9 + raise * 3), at(10), 0.8, R.wood));
  // Crooked head of the staff holding the orb
  P.push(cap(at(10), add(at(11.5), v(-1.4, 0, 0)), 0.7, R.wood));
  P.push(cap(at(10), add(at(11.5), v(1.4, 0, 0)), 0.7, R.wood));
  const orbR = 1.9 + raise * 1.2 + (hot ? 0.5 : 0);
  P.push(sph(at(12.5), orbR, hot ? R.orbHot : R.orb, { depthBias: 0.3, bias: 0.25 }));
  return P;
}

// ---- Cragback ----------------------------------------------------------------------
function cragParts(anim: MonAnim, f: number): Part[] {
  let bob = 0;
  let raise = 0; // windup arms overhead
  let slam = 0; // fists down
  let gait = 0;
  let lean = 0;
  if (anim === "idle") bob = [0, 0.5, 0.9, 0.5][f] ?? 0;
  else if (anim === "move") {
    gait = (f / 6) * Math.PI * 2;
    bob = Math.abs(Math.sin(gait)) * 1.5;
  } else if (anim === "windup") {
    raise = Math.min(1, (f + 1) / 3.2);
    lean = -raise * 3;
  } else if (anim === "strike") {
    slam = [1, 1, 0.7][f] ?? 0;
    lean = 4 * slam;
  }
  const P: Part[] = [];
  const z = bob * 0.5;
  // Stumpy legs
  for (const s of [-1, 1]) {
    const sw = Math.sin(gait + (s > 0 ? Math.PI : 0)) * (anim === "move" ? 3.5 : 0);
    const lift = anim === "move" ? Math.max(0, Math.cos(gait + (s > 0 ? Math.PI : 0))) * 2 : 0;
    const hip = v(-1, s * 5.5, 11 + z);
    const ft = v(sw + (anim === "strike" ? 2 : 0), s * 6.8, 2 + lift);
    P.push(cap(hip, ft, 3.6, R.cragSkin));
    P.push(cap(ft, add(ft, v(2.6, 0, -0.5)), 2.7, R.cragFist));
  }
  // Huge torso, hunched forward
  const torsoB = v(-1 + lean * 0.2, 0, 14 + z);
  const torsoT = v(2 + lean * 0.8, 0, 24 + z - Math.max(0, lean) * 0.6);
  P.push(cap(torsoB, torsoT, 9.2, R.cragSkin));
  P.push(sph(add(torsoB, v(3.5, 0, 1)), 6.5, R.cragFist, { depthBias: 0.3, bias: -0.05 })); // gut
  // Rock back: a ridge of boulders with moss
  const rocks: [number, number, number, number][] = [
    [-5, -4, 26, 4.8],
    [-5.5, 4, 25.5, 4.4],
    [-7.5, 0, 22, 4.8],
    [-3, 0.5, 30, 4.4],
    [-8, -4.5, 17, 3.6],
    [-8, 4.5, 17.5, 3.4],
  ];
  for (const [rf, rs, rz, rr] of rocks) {
    const c = v(rf + lean * 0.5, rs, rz + z - Math.max(0, lean) * 0.4);
    P.push(sph(c, rr, R.cragRock, { depthBias: -0.4 }));
    P.push(sph(add(c, v(-0.6, rs * 0.08, rr * 0.55)), rr * 0.55, R.cragMoss, { depthBias: -0.35, ry: 0.5 }));
  }
  // Small head sunk between the shoulders
  const hd = add(torsoT, v(6, 0, -2.5));
  P.push(sph(hd, 4.2, R.cragSkin, { depthBias: 0.4 }));
  P.push(cap(add(hd, v(1.5, -2.6, 2)), add(hd, v(3.5, -3.4, 0.5)), 0.9, R.cragRock)); // brow ridge
  P.push(cap(add(hd, v(1.5, 2.6, 2)), add(hd, v(3.5, 3.4, 0.5)), 0.9, R.cragRock));
  const eyeCol = anim === "windup" || anim === "strike" ? GLOW_R : rgba("#ff8a3a");
  P.push(dot(add(hd, v(4, -1.6, 0.6)), add(hd, v(2, -1, 0.6)), eyeCol, anim === "windup" ? 2 : 1));
  P.push(dot(add(hd, v(4, 1.6, 0.6)), add(hd, v(2, 1, 0.6)), eyeCol, anim === "windup" ? 2 : 1));
  // Jaw with tusks
  P.push(cap(add(hd, v(2.5, -2, -2.5)), add(hd, v(2.5, 2, -2.5)), 1.8, R.cragFist, { depthBias: 0.45 }));
  P.push(cap(add(hd, v(3.5, -2, -2)), add(hd, v(4.3, -2.4, 0.5)), 0.7, R.teeth, { depthBias: 0.5 }));
  P.push(cap(add(hd, v(3.5, 2, -2)), add(hd, v(4.3, 2.4, 0.5)), 0.7, R.teeth, { depthBias: 0.5 }));
  // Massive arms
  for (const s of [-1, 1]) {
    const sh = add(torsoT, v(-0.5, s * 9, -1.5));
    let fist: V3;
    let elbow: V3;
    if (raise > 0) {
      fist = lerp3(v(9, s * 11, 6), v(1, s * 5, 44), raise);
      elbow = lerp3(v(5, s * 12.5, 13), v(-1, s * 11, 34), raise);
    } else if (slam > 0) {
      fist = v(15, s * 5, 3 + (1 - slam) * 6);
      elbow = v(9, s * 10, 15);
    } else {
      const sw = Math.sin(gait + (s > 0 ? 0 : Math.PI)) * (anim === "move" ? 3 : 0);
      fist = v(8 + sw, s * 11.5, 5 + z * 0.5);
      elbow = v(4 + sw * 0.5, s * 12.5, 14 + z * 0.5);
    }
    P.push(sph(sh, 4.6, R.cragSkin));
    P.push(sph(add(sh, v(-1.2, s * 0.6, 3)), 3.2, R.cragRock, { depthBias: -0.2 })); // shoulder stone
    P.push(cap(sh, elbow, 3.6, R.cragSkin));
    P.push(cap(elbow, fist, 3.4, R.cragSkin));
    P.push(sph(fist, 4.6, R.cragFist, { depthBias: 0.2 }));
  }
  return P;
}

const DEFS: Record<string, MonDef> = {
  gnashling: { baseR: 15, scale: 1.25, w: 64, h: 52, ay: 40, parts: gnashParts },
  bog_seer: { baseR: 16, scale: 1.3, w: 64, h: 72, ay: 58, parts: seerParts },
  cragback: { baseR: 28, scale: 1.25, w: 104, h: 116, ay: 96, parts: cragParts },
};

/** Elite outline colours per modifier. */
export const ELITE_COLORS: Record<string, string> = {
  frenzied: "#ff3b2e",
  ironhide: "#b9c4d0",
  volatile: "#ff9a1f",
  rimecloaked: "#7fd4ff",
};

function deathTransform(parts: Part[], k: string, f: number) {
  const t = Math.min(1, f / 5);
  const e = t * t;
  if (k === "cragback") transformParts(parts, (p) => rotS(p, e * 1.45, v(6, 0, 0)));
  else if (k === "bog_seer") {
    transformParts(parts, (p) => {
      const q = rotS(p, -e * 1.35, v(-2, 0, 0));
      return [q[0], q[1], q[2] * (1 - e * 0.25)];
    });
  } else transformParts(parts, (p) => rotF(p, e * 1.6, v(0, 4, 0)));
}

export function buildMonsterFrame(k: string, sizeMul: number, elite: string[] | undefined, dir: number, anim: MonAnim, frame: number, flash: boolean): Sprite {
  const def = DEFS[k] ?? DEFS.gnashling;
  const sc = def.scale * sizeMul * ART * 1.12;
  const W = Math.ceil(def.w * sizeMul * ART * 1.12) + 10;
  const H = Math.ceil(def.h * sizeMul * ART * 1.12) + 10;
  const AX = Math.floor(W / 2);
  const AY = Math.ceil(def.ay * sizeMul * ART * 1.12) + 5;
  const parts = def.parts(anim === "death" ? "idle" : anim, anim === "death" ? 0 : frame);
  if (anim === "death") deathTransform(parts, k, frame);
  const buf = new PixBuf(W, H);
  rasterize(parts, projector(dirToWorldAngle(dir), sc, AX, AY), sc, buf);
  if (anim === "death" && frame >= 5) {
    // Corpse: drained of colour
    const d = buf.tinted(rgba("#2a2522"), 0.35);
    return sprite(d, AX, AY);
  }
  if (elite && elite.length && anim !== "death") eliteRing(buf, elite);
  return sprite(flash ? buf.tinted(rgba("#ffffff"), 0.85) : buf, AX, AY);
}

/** Coloured 1px glow ring around the sprite per elite modifier (second mod = outer ring). */
function eliteRing(buf: PixBuf, mods: string[]) {
  for (let i = 0; i < Math.min(2, mods.length); i++) {
    const c = rgba(ELITE_COLORS[mods[i]] ?? "#ffb347");
    const { w, h, data } = buf;
    const src = data.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x] >>> 24 !== 0) continue;
        const n = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && src[yy * w + xx] >>> 24 !== 0;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) data[y * w + x] = i === 0 ? c : scaleColor(c, 0.7);
      }
    }
  }
}

const cache = new Map<string, Sprite>();
export function monsterFrame(k: string, r: number, elite: string[] | undefined, dir: number, anim: MonAnim, frame: number, flash = false): Sprite {
  const def = DEFS[k] ?? DEFS.gnashling;
  const sizeMul = Math.round((r / def.baseR) * 10) / 10;
  const ek = elite?.join(",") ?? "";
  const key = `${k}|${sizeMul}|${ek}|${dir}|${anim}|${frame}|${flash ? 1 : 0}`;
  let s = cache.get(key);
  if (!s) {
    if (!canBuild()) {
      const base = `${k}|${sizeMul}|${ek}|${dir}|`;
      const fb = cache.get(`${base}${anim}|${frame}|0`) ?? cache.get(`${base}${anim}|0|0`) ?? cache.get(`${base}idle|0|0`);
      if (fb) return fb;
    }
    if (cache.size > 6000) cache.clear();
    s = buildMonsterFrame(k, sizeMul, elite, dir, anim, frame, flash);
    cache.set(key, s);
  }
  return s;
}

export const MONSTER_KINDS = Object.keys(DEFS);
