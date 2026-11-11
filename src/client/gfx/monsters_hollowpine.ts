// Hollowpine families: Barkgnaw (bark-plated forest hound), Sapspitter (rooted bulb that spits sap),
// Hollow Tender (antlered root-shaman), Stumpfather (walking stump brute). Original designs.
import { add, biped, cap, dot, poseOf, quad, ramp, rgba, sph, v, type SmoothAnim } from "./monsters_kit";
import type { Part } from "./rig";

export interface SmoothDef {
  baseR: number;
  scale: number;
  w: number;
  h: number;
  ay: number;
  parts(anim: SmoothAnim, f: number): Part[];
}

const R = {
  bark: ramp("#1f150c", "#3d2a18", "#5e4426", "#7d6036"),
  barkDark: ramp("#120c07", "#24180e", "#3a2817", "#4f3820"),
  moss: ramp("#16200e", "#2c4018", "#466226", "#648634"),
  leaf: ramp("#20300e", "#3e5a18", "#6a8a28", "#9ab83c"),
  sap: ramp("#5a3008", "#a8601a", "#e8a030", "#ffe090"),
  bulb: ramp("#2a1e10", "#56402a", "#86683e", "#b09060"),
  flesh: ramp("#2a1210", "#5a2420", "#8a3a30", "#b05a48"),
  bone: ramp("#5a5244", "#8e8670", "#bcb498", "#e4dcc0"),
  glowG: ramp("#1e5a20", "#4aa83a", "#9af070", "#eaffd0"),
};

const barkgnaw = (a: SmoothAnim, f: number) =>
  quad({
    len: 14, h: 9, bodyR: 4.6, headR: 4.2, legR: 1.7, hide: R.bark, belly: R.barkDark, claw: R.bone, maw: R.flesh, eye: "#b0ff60", tail: 7,
    extras: (P, k) => {
      // bark plates + a mossy ruff
      for (let i = 0; i < 4; i++) {
        const b = add(k.back, v(i * 3.6, 0, 4));
        P.push(cap(b, add(b, v(-2.4, (i % 2 ? 1 : -1) * 1.2, 2.6)), 1.1, R.barkDark, { depthBias: -0.1 }));
      }
      P.push(sph(add(k.front, v(0.5, 0, 2.2)), 3.6, R.moss, { depthBias: -0.05 }));
      // twig horns
      for (const s of [-1, 1]) P.push(cap(add(k.head, v(-0.5, s * 2.2, 2.8)), add(k.head, v(-4, s * 4.5, 7)), 0.7, R.bark));
    },
  }, poseOf(a, f));

function sapspitter(a: SmoothAnim, f: number): Part[] {
  const po = poseOf(a, f);
  const P: Part[] = [];
  // root feet
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + (po.moving ? Math.sin(po.gait + i) * 0.3 : 0);
    const out = v(Math.cos(ang) * 9, Math.sin(ang) * 9, 0.6 + (po.moving ? Math.max(0, Math.sin(po.gait + i * 1.3)) * 2 : 0));
    const mid = v(Math.cos(ang) * 5, Math.sin(ang) * 5, 4);
    P.push(cap(v(0, 0, 7), mid, 1.6, R.bark));
    P.push(cap(mid, out, 1.1, R.barkDark));
  }
  const squash = 1 - po.crouch * 0.15 + po.lunge * 0.1;
  const body = v(0, 0, 11 * squash + po.bob * 0.5);
  P.push(sph(body, 7.2, R.bulb));
  // glowing sap veins
  for (const s of [-1, 0, 1]) P.push(cap(add(body, v(4, s * 3, -3)), add(body, v(5.6, s * 2, 3)), 0.8, R.sap, { depthBias: 0.3 }));
  // spout neck + mouth that swells on windup
  const neck = add(body, v(2 + po.lunge * 2, 0, 6));
  const mouth = add(neck, v(3 + po.lunge * 2, 0, 3 - po.crouch * 1));
  P.push(cap(add(body, v(0, 0, 4)), neck, 2.6, R.bulb));
  P.push(cap(neck, mouth, 2.2 + po.crouch * 1.2, R.bulb, { depthBias: 0.2 }));
  P.push(sph(add(mouth, v(1.5, 0, 0)), 1.3 + po.open * 1.2, R.sap, { depthBias: 0.3 }));
  // leaf crown
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    P.push(cap(add(body, v(0, 0, 5)), add(body, v(Math.cos(ang) * 6, Math.sin(ang) * 6, 9 + (i % 2) * 2)), 0.9, R.leaf, { depthBias: -0.1 }));
  }
  P.push(dot(add(body, v(6.4, -2, 1.5)), body, rgba("#ffd060"), 1.2));
  P.push(dot(add(body, v(6.4, 2, 1.5)), body, rgba("#ffd060"), 1.2));
  return P;
}

const tender = (a: SmoothAnim, f: number) =>
  biped({
    hip: 11, torso: 10, torsoR: 3.8, headR: 3.2, armR: 1.3, legR: 1.6, hunch: 3, skin: R.bark, cloth: R.moss, limb: R.barkDark, eye: "#90ff80",
    arms: "staff", staff: R.bark, orb: R.glowG,
    extras: (P, k) => {
      // antler crown
      for (const s of [-1, 1]) {
        const a0 = add(k.head, v(-0.5, s * 1.8, 2.4));
        const a1 = add(a0, v(-1.5, s * 3, 4.5));
        P.push(cap(a0, a1, 0.7, R.bone));
        P.push(cap(a1, add(a1, v(1.5, s * 1.5, 3)), 0.5, R.bone));
        P.push(cap(a1, add(a1, v(-2.5, s * 2.5, 1.5)), 0.5, R.bone));
      }
      // hanging moss cloak
      P.push(cap(add(k.chest, v(-2.5, 0, 0)), add(k.hip, v(-3.5, 0, -6)), 3.4, R.moss, { depthBias: -0.3 }));
      // root tendrils at the hem
      for (const s of [-2, 0, 2]) P.push(cap(add(k.hip, v(-1, s, -3)), v(-2 + s * 0.3, s * 1.6, 0.5), 0.6, R.barkDark));
      if (k.po.raise > 0.3) P.push(sph(k.hands[0], 1.2 + k.po.raise, R.glowG, { depthBias: 0.3 }));
    },
  }, poseOf(a, f));

const stumpfather = (a: SmoothAnim, f: number) =>
  biped({
    hip: 13, torso: 14, torsoR: 8.5, headR: 3.6, armR: 3, legR: 3.4, hunch: 4, skin: R.bark, cloth: R.barkDark, eye: "#ffb040",
    arms: "fists", armLen: 19,
    extras: (P, k) => {
      // stump top with rings and a sapling
      P.push(sph(add(k.chest, v(-1.5, 0, 6)), 6.4, R.bark, { ry: 0.7, depthBias: -0.05 }));
      P.push(cap(add(k.chest, v(-2, 0, 9)), add(k.chest, v(-3, 1, 15)), 0.7, R.bark));
      P.push(sph(add(k.chest, v(-3, 1, 16)), 2.2, R.leaf));
      // moss shoulders
      for (const s of [-1, 1]) P.push(sph(add(k.chest, v(0, s * 7.5, 3)), 3.4, R.moss, { depthBias: 0.05 }));
      // knotholes
      P.push(sph(add(k.chest, v(7.5, -2.5, -2)), 1.3, R.barkDark, { depthBias: 0.3 }));
    },
  }, poseOf(a, f));

const furGrey = ramp("#1a1a1c", "#3a3a3c", "#5e5c58", "#8a867e");
const furBelly = ramp("#121214", "#26262a", "#3e3c3a", "#5a5650");
const wolfFeral = (a: SmoothAnim, f: number) =>
  quad({
    len: 15, h: 10, bodyR: 4.2, headR: 3.9, legR: 1.6, hide: furGrey, belly: furBelly, claw: R.bone, maw: R.flesh, eye: "#ffd040", tail: 9,
    extras: (P, k) => {
      // ragged scruff + pointed ears
      P.push(sph(add(k.front, v(0.2, 0, 2.4)), 3.4, furBelly, { depthBias: -0.05 }));
      for (const s of [-1, 1]) P.push(cap(add(k.head, v(-0.8, s * 1.8, 2.6)), add(k.head, v(-1.6, s * 2.4, 6)), 0.9, furGrey));
    },
  }, poseOf(a, f));

export const HOLLOWPINE: Record<string, SmoothDef> = {
  wolf_feral: { baseR: 15, scale: 1.2, w: 72, h: 60, ay: 46, parts: wolfFeral },
  barkgnaw: { baseR: 16, scale: 1.2, w: 70, h: 60, ay: 46, parts: barkgnaw },
  sapspitter: { baseR: 17, scale: 1.2, w: 70, h: 76, ay: 54, parts: sapspitter },
  hollow_tender: { baseR: 17, scale: 1.15, w: 72, h: 92, ay: 70, parts: tender },
  stumpfather: { baseR: 30, scale: 1.15, w: 104, h: 128, ay: 98, parts: stumpfather },
};
