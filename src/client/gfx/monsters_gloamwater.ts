// Gloamwater families: Reedlurker (reed-backed swamp ambusher), Mire Chanter (frog-faced sludge
// singer), Silt Behemoth (mud-shelled giant), Leechkin (lamprey swarm). Original designs.
import type { SmoothDef } from "./monsters_hollowpine";
import { add, biped, cap, crawler, dot, poseOf, quad, ramp, rgba, sph, v, type SmoothAnim } from "./monsters_kit";
import type { Part } from "./rig";

const R = {
  scale: ramp("#10181a", "#1f3234", "#30504c", "#4a7468"),
  scaleBelly: ramp("#2a2a1c", "#4a4a30", "#6e6a46", "#94906a"),
  reed: ramp("#2a2a10", "#4c4a1e", "#78722e", "#a8a048"),
  mud: ramp("#1a140e", "#33281c", "#4e3e2c", "#6a573e"),
  shell: ramp("#1c1e1a", "#363a32", "#545a4c", "#78806a"),
  frog: ramp("#18200e", "#2e3e1a", "#4a6028", "#6e8a3c"),
  robe: ramp("#0e1214", "#1a2226", "#283438", "#3a4a4e"),
  sludge: ramp("#1a2a10", "#3a5a1a", "#6a9a2a", "#b0e050"),
  leech: ramp("#1a0a12", "#3a1428", "#5e2040", "#8a3a5e"),
  leechU: ramp("#2a1418", "#4e2a2e", "#744048", "#9a5e64"),
  teeth: ramp("#6a6450", "#a49c80", "#ccc4a4", "#eee8d0"),
  mouth: ramp("#140404", "#300a0a", "#521410", "#701e18"),
};

const reedlurker = (a: SmoothAnim, f: number) =>
  quad({
    len: 18, h: 6, bodyR: 3.8, headR: 3.6, legR: 1.4, neck: 1, hide: R.scale, belly: R.scaleBelly, claw: R.mud, maw: R.mouth, eye: "#ffe040", tail: 12, low: true,
    extras: (P, k) => {
      // reeds sprouting along the back
      for (let i = 0; i < 6; i++) {
        const b = add(k.back, v(i * 3.4 - 1, (i % 2 ? 1 : -1) * 1.4, 3));
        P.push(cap(b, add(b, v(-1.6, (i % 2 ? 1 : -1) * 0.6, 6 + (i % 3) * 1.6)), 0.5, R.reed, { depthBias: -0.15 }));
      }
      // long snout teeth
      for (const s of [-1, 1]) P.push(cap(add(k.head, v(3.5, s * 1.4, -1.2)), add(k.head, v(5.5, s * 1.4, -2.4)), 0.4, R.teeth, { depthBias: 0.3 }));
    },
  }, poseOf(a, f));

const chanter = (a: SmoothAnim, f: number) =>
  biped({
    hip: 9, torso: 9, torsoR: 4.8, headR: 4, armR: 1.3, legR: 1.9, hunch: 3.5, skin: R.frog, cloth: R.robe, eye: "#ffd030",
    arms: "claws",
    extras: (P, k) => {
      // throat sac that swells while chanting
      const sac = 1.6 + k.po.crouch * 2.4 + k.po.open * 0.6;
      P.push(sph(add(k.head, v(2.2, 0, -3)), sac, R.scaleBelly, { depthBias: 0.3 }));
      // wide frog mouth line + bulging eyes
      P.push(cap(add(k.head, v(3.2, -2.6, -0.8)), add(k.head, v(3.2, 2.6, -0.8)), 0.45, R.mouth, { depthBias: 0.35 }));
      for (const s of [-1, 1]) P.push(sph(add(k.head, v(1.8, s * 2.2, 2.6)), 1.4, R.frog, { depthBias: 0.25 }));
      // sludge orb between the hands when casting
      if (k.po.raise > 0.2) P.push(sph(add(k.chest, v(6, 0, 4 + k.po.raise * 6)), 1.6 + k.po.raise * 2.2, R.sludge, { depthBias: 0.4 }));
      // dripping robe tatters
      for (const s of [-2.5, 0, 2.5]) P.push(cap(add(k.hip, v(-1, s, -1)), add(k.hip, v(-2, s * 1.2, -7)), 1, R.robe, { depthBias: -0.2 }));
    },
  }, poseOf(a, f));

function behemoth(a: SmoothAnim, f: number): Part[] {
  const po = poseOf(a, f);
  return quad({
    len: 20, h: 12, bodyR: 9.5, headR: 5, legR: 3.4, neck: 0, hide: R.mud, belly: R.scaleBelly, claw: R.shell, maw: R.mouth, eye: "#ff8030", tail: 6,
    extras: (P, k) => {
      // domed silt shell with barnacle knobs
      const top = add(lerp(k.back, k.front), v(0, 0, 6 - po.crouch * 1.5));
      P.push(sph(top, 10.5, R.shell, { ry: 0.75, depthBias: -0.02 }));
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        P.push(sph(add(top, v(Math.cos(ang) * 6.5, Math.sin(ang) * 6.5, 4.5)), 1.5, R.mud, { depthBias: 0.1 }));
      }
      // dripping mud
      P.push(cap(add(top, v(5, -6, 0)), add(top, v(5.5, -6.5, -6)), 0.7, R.mud));
      // tusks
      for (const s of [-1, 1]) P.push(cap(add(k.head, v(3, s * 2.4, -2)), add(k.head, v(6, s * 3.4, 0.5)), 0.8, R.teeth, { depthBias: 0.3 }));
    },
  }, po);
}
const lerp = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

const leechkin = (a: SmoothAnim, f: number) => crawler({ segs: 5, r: 2.6, shell: R.leech, under: R.leechU, legs: 0, eye: "#ff5060" }, poseOf(a, f));

export const GLOAMWATER: Record<string, SmoothDef> = {
  reedlurker: { baseR: 16, scale: 1.2, w: 84, h: 56, ay: 40, parts: reedlurker },
  mire_chanter: { baseR: 17, scale: 1.2, w: 72, h: 82, ay: 62, parts: chanter },
  silt_behemoth: { baseR: 31, scale: 1.1, w: 120, h: 104, ay: 76, parts: behemoth },
  leechkin: { baseR: 9, scale: 1.25, w: 44, h: 36, ay: 26, parts: leechkin },
};
export { dot, rgba, cap, sph };
