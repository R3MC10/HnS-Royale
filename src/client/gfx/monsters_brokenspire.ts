// Brokenspire families: Spire Harrier (slate-winged diver), Shardslinger (crystal-hooded thrower),
// Cairnbreaker (stacked-stone giant), Cindermite (ember-bellied swarm bug). Original designs.
import type { SmoothDef } from "./monsters_hollowpine";
import { add, biped, cap, crawler, poseOf, ramp, sph, v, winged, type SmoothAnim } from "./monsters_kit";

const R = {
  slate: ramp("#141418", "#2a2a32", "#44444e", "#62626e"),
  feather: ramp("#18141a", "#302836", "#4c4054", "#6e6078"),
  talon: ramp("#3a3020", "#6a5a3a", "#9a8858", "#c8b880"),
  crystal: ramp("#203a5a", "#3a6ea0", "#70b0e8", "#d0f0ff"),
  hood: ramp("#120f14", "#241e28", "#3a3040", "#524658"),
  skin: ramp("#2a2420", "#4a4038", "#6a5e52", "#8e8070"),
  stone: ramp("#1e1d1c", "#3a3836", "#585552", "#7a7672"),
  stoneDark: ramp("#121110", "#222120", "#353331", "#4a4744"),
  lava: ramp("#5a1004", "#b0380a", "#ff7a1a", "#ffe080"),
  mite: ramp("#140c08", "#2a1810", "#44281a", "#603a26"),
  miteU: ramp("#1e1410", "#3a2a20", "#584032", "#785a48"),
};

const harrier = (a: SmoothAnim, f: number) => winged({ body: R.slate, wing: R.feather, beak: R.talon, eye: "#ff5040", size: 7 }, poseOf(a, f), a, f);

const shardslinger = (a: SmoothAnim, f: number) =>
  biped({
    hip: 10, torso: 9, torsoR: 3.6, headR: 3, armR: 1.2, legR: 1.5, hunch: 2.5, skin: R.skin, cloth: R.hood, eye: "#80e0ff",
    extras: (P, k) => {
      // crystal hood: shards growing from the head and shoulders
      const shards: [number, number, number, number][] = [[-0.5, 0, 6, 1.1], [-1.5, -2, 4.5, 0.9], [-1.5, 2, 4.5, 0.9], [-3, -1, 3, 0.8], [-3, 1, 3.5, 0.8]];
      for (const [df, ds, dz, r] of shards) P.push(cap(add(k.head, v(df * 0.4, ds * 0.6, 1.5)), add(k.head, v(df, ds, dz)), r, R.crystal, { depthBias: -0.05 }));
      for (const s of [-1, 1]) P.push(cap(add(k.chest, v(-1, s * 3.5, 2)), add(k.chest, v(-3, s * 6, 6)), 0.9, R.crystal));
      // shards in hand while winding up
      if (k.po.raise > 0.1) for (const h of k.hands) P.push(cap(h, add(h, v(1, 0, 2.5 + k.po.raise * 2)), 0.8, R.crystal, { depthBias: 0.35 }));
      // tattered hood cape
      P.push(cap(add(k.chest, v(-2.5, 0, 1)), add(k.hip, v(-3.5, 0, -6)), 3, R.hood, { depthBias: -0.3 }));
    },
  }, poseOf(a, f));

const cairnbreaker = (a: SmoothAnim, f: number) =>
  biped({
    hip: 13, torso: 13, torsoR: 8, headR: 3.4, armR: 3.4, legR: 3.8, hunch: 3, skin: R.stone, cloth: R.stoneDark, eye: "#ffa040",
    arms: "fists", armLen: 20,
    extras: (P, k) => {
      // stacked cairn stones on the back, glowing seams
      for (let i = 0; i < 3; i++) P.push(sph(add(k.chest, v(-5 + i * 0.3, (i - 1) * 1.5, 3 + i * 4.2)), 4.4 - i * 0.9, R.stone, { ry: 0.65, depthBias: -0.15 }));
      P.push(cap(add(k.chest, v(6, -3, -4)), add(k.chest, v(6.5, 2, 3)), 0.6, R.lava, { depthBias: 0.35 }));
      P.push(cap(add(k.hip, v(4, -4, 1)), add(k.hip, v(4.5, 3, 4)), 0.5, R.lava, { depthBias: 0.35 }));
      for (const h of k.hands) P.push(sph(h, 4.6, R.stone, { depthBias: 0.1 }));
      if (k.po.raise > 0.6) for (const h of k.hands) P.push(sph(h, 2, R.lava, { depthBias: 0.2 }));
    },
  }, poseOf(a, f));

const cindermite = (a: SmoothAnim, f: number) => crawler({ segs: 3, r: 3.2, shell: R.mite, under: R.miteU, glow: R.lava, legs: 3, eye: "#ffd040" }, poseOf(a, f));

export const BROKENSPIRE: Record<string, SmoothDef> = {
  spire_harrier: { baseR: 15, scale: 1.2, w: 80, h: 70, ay: 52, parts: harrier },
  shardslinger: { baseR: 18, scale: 1.2, w: 72, h: 86, ay: 64, parts: shardslinger },
  cairnbreaker: { baseR: 31, scale: 1.15, w: 108, h: 130, ay: 100, parts: cairnbreaker },
  cindermite: { baseR: 10, scale: 1.25, w: 46, h: 38, ay: 28, parts: cindermite },
};
export { cap, sph };
