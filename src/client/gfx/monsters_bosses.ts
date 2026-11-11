// Biome bosses: The Rotwood Matriarch (towering antlered tree-mother with a brood sac),
// Gulpmaw the Bloated (vast swamp toad-thing), The Shattered Warden (cracked stone sentinel with a
// halberd and drifting armour shards). All original.
import type { SmoothDef } from "./monsters_hollowpine";
import { add, biped, cap, poseOf, quad, ramp, sph, v, type SmoothAnim } from "./monsters_kit";
import type { Part } from "./rig";

const R = {
  bark: ramp("#1a120a", "#36261a", "#563e28", "#765838"),
  rot: ramp("#1a1a0e", "#34361a", "#545a28", "#7a823a"),
  bloom: ramp("#3a0e2a", "#7a1e52", "#c04a86", "#f0a0c8"),
  bone: ramp("#5a5244", "#8e8670", "#bcb498", "#e4dcc0"),
  toad: ramp("#14180e", "#283020", "#3e4a30", "#5a6a44"),
  toadBelly: ramp("#3a3420", "#64583a", "#8e8058", "#b8a87c"),
  wart: ramp("#2a2a10", "#545020", "#848030", "#b8b048"),
  mouth: ramp("#140404", "#300a0a", "#521410", "#701e18"),
  stone: ramp("#1c1c20", "#36363e", "#54545e", "#76767e"),
  steel: ramp("#202428", "#44505a", "#7a8a96", "#d0dce4"),
  rune: ramp("#103a5a", "#2a7ab0", "#70c8ff", "#e0f6ff"),
};

function matriarch(a: SmoothAnim, f: number): Part[] {
  return biped({
    hip: 16, torso: 18, torsoR: 7, headR: 4.6, armR: 2.4, legR: 3, hunch: 5, skin: R.bark, cloth: R.rot, eye: "#c0ff60",
    arms: "claws", armLen: 22,
    extras: (P, k) => {
      // vast antler crown
      for (const s of [-1, 1]) {
        const a0 = add(k.head, v(-1, s * 2.5, 3));
        const a1 = add(a0, v(-2, s * 6, 7));
        const a2 = add(a1, v(-1, s * 5, 6));
        P.push(cap(a0, a1, 1.2, R.bone));
        P.push(cap(a1, a2, 0.9, R.bone));
        P.push(cap(a1, add(a1, v(3, s * 2, 4)), 0.7, R.bone));
        P.push(cap(a2, add(a2, v(2, s * 1, 3)), 0.6, R.bone));
        P.push(cap(a2, add(a2, v(-2, s * 3, 1)), 0.6, R.bone));
      }
      // brood sac hanging from her back, pulsing
      const sac = 5.5 + k.po.bob * 0.6 + k.po.crouch * 1.5;
      P.push(sph(add(k.chest, v(-7, 0, -2)), sac, R.bloom, { depthBias: -0.2 }));
      // rot blooms on the shoulders, bark skirt of roots
      for (const s of [-1, 1]) P.push(sph(add(k.chest, v(0, s * 6, 3)), 2.4, R.bloom, { depthBias: 0.05 }));
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        P.push(cap(add(k.hip, v(Math.cos(ang) * 4, Math.sin(ang) * 4, 0)), v(Math.cos(ang) * 10, Math.sin(ang) * 10, 0.6), 1.3, R.bark, { depthBias: -0.1 }));
      }
    },
  }, poseOf(a, f));
}

function gulpmaw(a: SmoothAnim, f: number): Part[] {
  const po = poseOf(a, f);
  return quad({
    len: 18, h: 13, bodyR: 14, headR: 9, legR: 4, neck: -6, hide: R.toad, belly: R.toadBelly, claw: R.wart, maw: R.mouth, eye: "#ffe040",
    extras: (P, k) => {
      // bloated belly that swells with the windup, warts, a dangling tongue
      P.push(sph(add(k.front, v(-2, 0, -4 - po.crouch)), 11 + po.crouch * 2.5, R.toadBelly, { depthBias: 0.05 }));
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        P.push(sph(add(k.back, v(6 + Math.cos(ang) * 8, Math.sin(ang) * 10, 10 + Math.sin(i) * 2)), 1.6, R.wart, { depthBias: 0.1 }));
      }
      const t0 = add(k.head, v(6, 0, -5));
      P.push(cap(t0, add(t0, v(2 + po.lunge * 18, 0, -5 + po.lunge * 2)), 1.6, R.mouth, { depthBias: 0.4 }));
      // dorsal frills
      for (let i = 0; i < 4; i++) P.push(cap(add(k.back, v(i * 4, 0, 12)), add(k.back, v(i * 4 - 3, 0, 17 - i)), 0.9, R.wart, { depthBias: -0.2 }));
    },
  }, po);
}

function warden(a: SmoothAnim, f: number): Part[] {
  const po = poseOf(a, f);
  return biped({
    hip: 15, torso: 15, torsoR: 7, headR: 4, armR: 2.6, legR: 3.2, hunch: 2, skin: R.stone, cloth: R.steel, eye: "#80d0ff",
    arms: "halberd", staff: R.steel, armLen: 20,
    extras: (P, k) => {
      // helm crest, cracked shoulder plates and drifting shards
      P.push(cap(add(k.head, v(-2, 0, 3)), add(k.head, v(-6, 0, 6)), 1.2, R.steel));
      for (const s of [-1, 1]) P.push(sph(add(k.chest, v(0, s * 7.5, 3)), 3.4, R.steel, { ry: 0.6, depthBias: 0.05 }));
      P.push(cap(add(k.chest, v(6.8, -2, -3)), add(k.chest, v(7.2, 1, 4)), 0.5, R.rune, { depthBias: 0.35 }));
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + po.bob;
        P.push(sph(add(k.chest, v(Math.cos(ang) * 11, Math.sin(ang) * 11, 6 + Math.sin(ang * 2) * 2)), 1.6, R.stone, { depthBias: 0.1 }));
      }
      // tabard
      P.push(cap(add(k.hip, v(4, 0, 3)), add(k.hip, v(5, 0, -8)), 2.4, R.rune, { depthBias: 0.2 }));
    },
  }, po);
}

export const BOSSES: Record<string, SmoothDef> = {
  rotwood_matriarch: { baseR: 40, scale: 1.15, w: 150, h: 170, ay: 128, parts: matriarch },
  gulpmaw: { baseR: 42, scale: 1.1, w: 160, h: 130, ay: 94, parts: gulpmaw },
  shattered_warden: { baseR: 38, scale: 1.15, w: 150, h: 170, ay: 128, parts: warden },
};
