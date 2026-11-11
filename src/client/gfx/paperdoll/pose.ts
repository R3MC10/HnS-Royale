// Paper-doll pose layer: the shared rig pose (hero.ts heroPoseAt) tuned for painted parts.
// Painted limbs have real width, so the rig's stick-figure spacing reads as a stiff A-pose; this
// pulls idle arms in, adds breathing and run counter-twist, and replaces the death tilt with a
// crumple that ends lying flat on the ground (the corpse pose).
import { add, lerp3, norm, v, type V3 } from "../rig";
import { heroPoseAt, weaponFamily, type HeroAnim, type Pose } from "../hero";

const PTS = ["hip", "chest", "neck", "head", "shL", "shR", "haL", "haR", "hpL", "hpR", "ftL", "ftR"] as const;
const UPPER = ["chest", "neck", "head", "shL", "shR"] as const;
const smooth = (t: number) => t * t * (3 - 2 * t);
const fwd = (p: V3, d: number): V3 => [p[0] + d, p[1], p[2]];

/** Lying on the back, feet toward +f: the end of the death crumple and the corpse pose. */
const LYING: Record<(typeof PTS)[number] | "knL" | "knR", V3> = {
  hip: v(-3.5, 0, 2.6),
  chest: v(-10.5, 0.4, 3),
  neck: v(-14.5, 0.6, 3),
  head: v(-18.5, 1.2, 3.4),
  shL: v(-12.8, -5, 2.6),
  shR: v(-12.8, 5.4, 2.6),
  haL: v(-8, -9, 1),
  haR: v(-15.5, 10.5, 1),
  hpL: v(-3.5, -2.4, 2.2),
  hpR: v(-3.5, 2.4, 2.2),
  knL: v(3.5, -3.6, 3.2),
  knR: v(4, 3.2, 2.4),
  ftL: v(10.5, -4.4, 1),
  ftR: v(11, 4.6, 1.2),
};

export function pdPose(anim: HeroAnim, ft: number, wk: string | null, wl: string): Pose {
  const p = heroPoseAt(anim, ft, wk, wl);
  const fam = weaponFamily(wk, wl);
  const freeL = !p.twoHand && fam !== "bow";
  const freeR = !fam;
  /** Hang a free hand close to the thigh instead of flaring out. */
  const hang = (k: "haL" | "haR", side: number, amt: number) => {
    const h = p[k];
    p[k] = [h[0], h[1] + (side * 4.7 - h[1]) * amt, h[2]];
  };
  if (anim === "idle") {
    const b = Math.sin((ft / 4) * Math.PI * 2);
    for (const k of UPPER) p[k] = add(p[k], v(0, 0, b * 0.25));
    p.shL = add(p.shL, v(0, -b * 0.12, 0));
    p.shR = add(p.shR, v(0, b * 0.12, 0));
    if (freeL) hang("haL", -1, 0.85);
    if (freeR) hang("haR", 1, 0.85);
  } else if (anim === "run") {
    const sw = Math.sin((ft / 8) * Math.PI * 2);
    // Shoulders counter the hips: right shoulder forward when the left foot leads.
    p.shR = fwd(p.shR, sw * 0.9);
    p.shL = fwd(p.shL, -sw * 0.9);
    p.hpL = fwd(p.hpL, sw * 0.6);
    p.hpR = fwd(p.hpR, -sw * 0.6);
    if (freeL) hang("haL", -1, 0.6);
    if (freeR) hang("haR", 1, 0.6);
  } else if (anim === "death") {
    // 0..1.6 recoil and knees buckle (kneel), 1.6..5 topple back and settle flat.
    const t = Math.max(0, Math.min(5, ft));
    const kneel = smooth(Math.min(1, t / 1.6));
    const fall = smooth(Math.max(0, Math.min(1, (t - 1.6) / 2.6)));
    const K: Record<string, V3> = {};
    for (const k of PTS) K[k] = p[k];
    const drop = 6.5 * kneel;
    for (const k of ["hip", "chest", "neck", "head", "shL", "shR", "hpL", "hpR", "haL", "haR"] as const) K[k] = add(p[k], v(kneel * 1.2, 0, -drop));
    K.chest = fwd(K.chest, kneel * 1.6);
    K.neck = fwd(K.neck, kneel * 2.4);
    K.head = add(K.head, v(kneel * 2.8, 0, -kneel * 1));
    K.haL = v(2.5, -6, 9);
    K.haR = v(3, 6.5, 9.5);
    K.knL = v(4.5, -2.8, 2.2);
    K.knR = v(4, 2.8, 2.4);
    K.ftL = v(-1.5, -2.9, 1);
    K.ftR = v(-1.2, 2.9, 1);
    const mix = (k: keyof typeof LYING) => lerp3(lerp3(k === "knL" || k === "knR" ? (p[k] ?? K[k]) : p[k], K[k], kneel), LYING[k], fall);
    for (const k of PTS) p[k] = mix(k);
    p.knL = mix("knL");
    p.knR = mix("knR");
    p.rot = undefined;
    p.w = norm(lerp3(p.w, v(0.2, 0.95, -0.1), fall));
    p.run = 0;
  }
  return p;
}
