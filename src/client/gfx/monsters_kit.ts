// Shared part-rig body builders for the biome roster (smooth, painted with rig.paintSprite).
// Local frame: f = forward, s = right, z = up, in rig units (~1 world unit at scale 1).
// Each species is a builder + palette + a few extra parts; all designs are original.
import { ramp, rgba, type Ramp } from "./pixel";
import { add, lerp3, v, type Part, type V3 } from "./rig";

export type SmoothAnim = "idle" | "move" | "windup" | "strike" | "death";

export const cap = (a: V3, b: V3, r: number, rp: Ramp, x: Partial<Part> = {}): Part => ({ kind: "cap", a, b, r, ramp: rp, ...x });
export const sph = (a: V3, r: number, rp: Ramp, x: Partial<Part> = {}): Part => ({ kind: "sph", a, r, ramp: rp, ...x });
export const dot = (a: V3, ref: V3, color: number, r = 1): Part => ({ kind: "dot", a, ref, r, color, ramp: EYE, depthBias: 0.8 });
export const disc = (a: V3, r: number, n: V3, rp: Ramp, x: Partial<Part> = {}): Part => ({ kind: "disc", a, r, n, ramp: rp, ...x });
const EYE = ramp("#3a0a04", "#a02010", "#ff6030", "#ffd0a0");
export { ramp, rgba, add, lerp3, v };

/** Pose drivers shared by every body: gait phase, bob, crouch (windup), lunge (strike), raise. */
export interface Pose {
  gait: number;
  moving: boolean;
  bob: number;
  crouch: number; // 0..1 windup gather
  lunge: number; // strike thrust
  raise: number; // arms / staff up 0..1
  open: number; // jaw / maw open 0..1
}
export function poseOf(anim: SmoothAnim, f: number): Pose {
  const p: Pose = { gait: 0, moving: false, bob: 0, crouch: 0, lunge: 0, raise: 0, open: 0.15 };
  if (anim === "idle") {
    p.bob = Math.sin((f / 4) * Math.PI * 2) * 0.5 + 0.5;
  } else if (anim === "move") {
    p.gait = (f / 6) * Math.PI * 2;
    p.moving = true;
    p.bob = Math.abs(Math.sin(p.gait));
    p.open = 0.3;
  } else if (anim === "windup") {
    const t = (f + 1) / 4;
    p.crouch = t;
    p.raise = t;
    p.open = 0.3 + t * 0.7;
    p.lunge = -t * 0.6;
  } else if (anim === "strike") {
    p.lunge = [1, 0.8, 0.35][f] ?? 0;
    p.raise = [-0.4, -0.5, -0.2][f] ?? 0;
    p.open = [1, 0.6, 0.3][f] ?? 0;
  }
  return p;
}

// ---- quadruped ---------------------------------------------------------------------
export interface QuadOpt {
  len: number; // body length
  h: number; // hip height
  bodyR: number;
  headR: number;
  legR: number;
  neck?: number;
  hide: Ramp;
  belly: Ramp;
  claw: Ramp;
  maw?: Ramp;
  eye: string;
  tail?: number;
  low?: boolean; // belly-dragger (short legs)
  extras?: (P: Part[], k: { back: V3; front: V3; head: V3; po: Pose }) => void;
}
export function quad(o: QuadOpt, po: Pose): Part[] {
  const P: Part[] = [];
  const L = po.lunge * o.len * 0.15;
  const z = o.h - po.crouch * o.h * 0.25 + po.bob * 0.6;
  const back = v(-o.len / 2 + L, 0, z);
  const front = v(o.len / 2 + L, 0, z + o.bodyR * 0.25);
  P.push(cap(back, front, o.bodyR, o.hide));
  P.push(cap(add(back, v(1, 0, -o.bodyR * 0.45)), add(front, v(-1, 0, -o.bodyR * 0.5)), o.bodyR * 0.8, o.belly, { depthBias: -0.2 }));
  const legs: [V3, number][] = [
    [add(front, v(-o.bodyR * 0.3, -o.bodyR * 0.7, 0)), 0],
    [add(front, v(-o.bodyR * 0.3, o.bodyR * 0.7, 0)), Math.PI],
    [add(back, v(o.bodyR * 0.3, -o.bodyR * 0.7, 0)), Math.PI],
    [add(back, v(o.bodyR * 0.3, o.bodyR * 0.7, 0)), 0],
  ];
  for (const [top, ph] of legs) {
    const sw = po.moving ? Math.sin(po.gait + ph) * o.len * 0.22 : 0;
    const lift = po.moving ? Math.max(0, Math.cos(po.gait + ph)) * o.h * 0.25 : 0;
    const foot = v(top[0] + sw, top[1] * 1.2, 0.6 + lift);
    const knee = v((top[0] + foot[0]) / 2 + (top[0] > 0 ? 1.2 : -1.2), top[1] * 1.25, (top[2] + foot[2]) / 2 + (o.low ? -0.5 : 0));
    P.push(cap(top, knee, o.legR, o.hide));
    P.push(cap(knee, foot, o.legR * 0.8, o.hide));
    P.push(cap(foot, add(foot, v(o.legR * 1.2, 0, -0.1)), o.legR * 0.6, o.claw));
  }
  if (o.tail) {
    const t1 = add(back, v(-o.tail * 0.6, 0, -0.5 + po.bob * 0.4));
    const t2 = add(back, v(-o.tail, Math.sin(po.gait) * 1.5, -1.5));
    P.push(cap(add(back, v(-1, 0, 0)), t1, o.bodyR * 0.45, o.hide));
    P.push(cap(t1, t2, o.bodyR * 0.25, o.hide));
  }
  const head = add(front, v((o.neck ?? 2) + o.headR * 0.6 + po.lunge * 2, 0, o.headR * 0.4 - po.crouch * 1.2));
  P.push(sph(head, o.headR, o.hide, { depthBias: 0.2 }));
  const snout = add(head, v(o.headR * 1.1, 0, -o.headR * 0.1));
  P.push(cap(add(head, v(o.headR * 0.3, 0, 0)), snout, o.headR * 0.6, o.hide, { depthBias: 0.25 }));
  const jaw = add(head, v(o.headR, 0, -o.headR * 0.55 - po.open * o.headR * 0.7));
  P.push(cap(add(head, v(0, 0, -o.headR * 0.4)), jaw, o.headR * 0.45, o.belly, { depthBias: 0.24 }));
  if (o.maw && po.open > 0.4) P.push(sph(add(head, v(o.headR * 0.8, 0, -o.headR * 0.45)), o.headR * 0.35, o.maw, { depthBias: 0.26 }));
  const ec = rgba(o.eye);
  P.push(dot(add(head, v(o.headR * 0.65, -o.headR * 0.55, o.headR * 0.45)), add(head, v(0, -o.headR * 0.2, 0)), ec, 1.1));
  P.push(dot(add(head, v(o.headR * 0.65, o.headR * 0.55, o.headR * 0.45)), add(head, v(0, o.headR * 0.2, 0)), ec, 1.1));
  o.extras?.(P, { back, front, head, po });
  return P;
}

// ---- biped (casters, brutes, the warden) ------------------------------------------
export interface BipedOpt {
  hip: number;
  torso: number; // hip -> chest length
  torsoR: number;
  headR: number;
  armR: number;
  legR: number;
  hunch: number; // forward lean (rig units at the chest)
  skin: Ramp;
  cloth: Ramp;
  limb?: Ramp;
  eye: string;
  arms?: "staff" | "fists" | "claws" | "halberd";
  staff?: Ramp;
  orb?: Ramp;
  armLen?: number;
  extras?: (P: Part[], k: { hip: V3; chest: V3; head: V3; hands: [V3, V3]; po: Pose }) => void;
}
export function biped(o: BipedOpt, po: Pose): Part[] {
  const P: Part[] = [];
  const limb = o.limb ?? o.skin;
  const hipZ = o.hip - po.crouch * o.hip * 0.18 + po.bob * 0.4;
  const hip = v(po.lunge * 1.5, 0, hipZ);
  const chest = add(hip, v(o.hunch + po.lunge * 2.5 - po.crouch * 1.2, 0, o.torso));
  // legs
  for (const s of [-1, 1]) {
    const sw = po.moving ? Math.sin(po.gait + (s > 0 ? Math.PI : 0)) * o.hip * 0.35 : s * po.lunge * 1.2;
    const lift = po.moving ? Math.max(0, Math.cos(po.gait + (s > 0 ? Math.PI : 0))) * o.hip * 0.18 : 0;
    const top = add(hip, v(0, s * o.torsoR * 0.55, -o.legR * 0.5));
    const foot = v(sw, s * o.torsoR * 0.75, 0.8 + lift);
    const knee = v((top[0] + foot[0]) / 2 + 1.4, s * o.torsoR * 0.7, (top[2] + foot[2]) / 2);
    P.push(cap(top, knee, o.legR, limb));
    P.push(cap(knee, foot, o.legR * 0.85, limb));
    P.push(cap(foot, add(foot, v(o.legR * 1.4, 0, -0.1)), o.legR * 0.7, o.cloth));
  }
  P.push(cap(hip, chest, o.torsoR, o.cloth));
  P.push(sph(add(chest, v(0.3, 0, 0)), o.torsoR * 1.05, o.skin, { depthBias: 0.05 }));
  const head = add(chest, v(o.headR * 0.5 + o.hunch * 0.3, 0, o.torsoR * 0.6 + o.headR * 0.7));
  P.push(sph(head, o.headR, o.skin, { depthBias: 0.2 }));
  const ec = rgba(o.eye);
  P.push(dot(add(head, v(o.headR * 0.85, -o.headR * 0.38, o.headR * 0.1)), add(head, v(0, -o.headR * 0.2, 0)), ec, 1.1));
  P.push(dot(add(head, v(o.headR * 0.85, o.headR * 0.38, o.headR * 0.1)), add(head, v(0, o.headR * 0.2, 0)), ec, 1.1));
  // arms
  const AL = o.armLen ?? o.torso * 1.1;
  const hands: V3[] = [];
  for (const s of [-1, 1]) {
    const sh = add(chest, v(0, s * o.torsoR * 1.05, o.torsoR * 0.3));
    let hand: V3;
    if (po.raise > 0) hand = add(sh, v(AL * 0.3 * (1 - po.raise), s * 1.2, -AL * 0.7 + AL * 1.5 * po.raise));
    else if (po.raise < 0) hand = add(sh, v(AL * (0.6 - po.raise * 0.5), s * 0.5 - s * 1.5, -AL * 0.4 + po.raise * AL * 0.6));
    else {
      const sw = po.moving ? Math.sin(po.gait + (s > 0 ? 0 : Math.PI)) * AL * 0.3 : 0;
      hand = add(sh, v(AL * 0.25 + sw, s * 1.3, -AL * 0.85 + po.bob * 0.4));
    }
    const elbow = add(lerp3(sh, hand, 0.5), v(-1.2, s * 1.5, 0));
    P.push(cap(sh, elbow, o.armR, limb));
    P.push(cap(elbow, hand, o.armR * 0.9, limb));
    if (o.arms === "fists") P.push(sph(hand, o.armR * 1.6, limb, { depthBias: 0.1 }));
    if (o.arms === "claws") for (const c of [-1, 0, 1]) P.push(cap(hand, add(hand, v(2.6, c * 1, -1.6)), 0.5, o.cloth));
    hands.push(hand);
  }
  if ((o.arms === "staff" || o.arms === "halberd") && o.staff) {
    const h = hands[1];
    const top = add(h, v(1.5 + po.raise * 2, 0, o.hip * 0.9));
    const bot = add(h, v(-0.5, 0, -o.hip * 0.7));
    P.push(cap(bot, top, Math.max(0.7, o.armR * 0.45), o.staff));
    if (o.orb) P.push(sph(top, 2 + po.raise * 1.4, o.orb, { depthBias: 0.3 }));
    if (o.arms === "halberd") P.push({ kind: "poly", a: top, r: 0, ramp: o.staff, pts: [add(top, v(0, 0, 1)), add(top, v(4.5, 0, -2)), add(top, v(3.5, 0, -6)), add(top, v(0, 0, -4))], color: o.staff[3], depthBias: 0.3 });
  }
  o.extras?.(P, { hip, chest, head, hands: [hands[0], hands[1]], po });
  return P;
}

// ---- winged (harriers) ------------------------------------------------------------
export interface WingOpt {
  body: Ramp;
  wing: Ramp;
  beak: Ramp;
  eye: string;
  size: number;
}
export function winged(o: WingOpt, po: Pose, anim: SmoothAnim, f: number): Part[] {
  const P: Part[] = [];
  const S = o.size;
  const hover = S * 1.6 + Math.sin((f / 4) * Math.PI * 2) * 0.8 - po.crouch * S * 0.4 + po.lunge * -S * 0.6;
  const flap = anim === "windup" ? -0.4 - po.crouch * 0.6 : Math.sin((f / (anim === "move" ? 6 : 4)) * Math.PI * 2) * 0.8;
  const body = v(po.lunge * 3, 0, hover);
  P.push(cap(add(body, v(-S * 0.7, 0, 0.3)), add(body, v(S * 0.5, 0, 0.6)), S * 0.42, o.body));
  for (const s of [-1, 1]) {
    const root = add(body, v(0, s * S * 0.3, S * 0.25));
    const mid = add(root, v(-S * 0.3, s * S * 0.65, S * 0.5 * flap));
    const tip = add(mid, v(-S * 0.5, s * S * 0.6, S * 0.8 * flap));
    P.push(cap(root, mid, S * 0.2, o.wing));
    P.push(cap(mid, tip, S * 0.12, o.wing));
    P.push({ kind: "poly", a: root, r: 0, ramp: o.wing, pts: [root, mid, tip, add(root, v(-S * 0.9, s * S * 0.2, -0.3))], color: o.wing[1], depthBias: -0.1 });
    // talons
    const leg = add(body, v(po.lunge * 2, s * S * 0.18, -S * 0.4));
    P.push(cap(leg, add(leg, v(S * 0.2 + po.lunge * 2, 0, -S * 0.45)), S * 0.08, o.beak));
  }
  const head = add(body, v(S * 0.7, 0, S * 0.35));
  P.push(sph(head, S * 0.28, o.body, { depthBias: 0.2 }));
  P.push(cap(add(head, v(S * 0.15, 0, 0)), add(head, v(S * 0.6, 0, -S * 0.15)), S * 0.09, o.beak, { depthBias: 0.25 }));
  P.push(dot(add(head, v(S * 0.2, -S * 0.17, S * 0.07)), head, rgba(o.eye), 1));
  P.push(dot(add(head, v(S * 0.2, S * 0.17, S * 0.07)), head, rgba(o.eye), 1));
  // tail feathers
  P.push(cap(add(body, v(-S * 0.7, 0, 0.3)), add(body, v(-S * 1.3, 0, 0.1)), S * 0.14, o.wing));
  return P;
}

// ---- crawler (mites, leeches) -----------------------------------------------------
export interface CrawlOpt {
  segs: number;
  r: number;
  shell: Ramp;
  under: Ramp;
  glow?: Ramp;
  legs: number; // per side, 0 = worm
  eye: string;
}
export function crawler(o: CrawlOpt, po: Pose): Part[] {
  const P: Part[] = [];
  const pts: V3[] = [];
  for (let i = 0; i < o.segs; i++) {
    const wig = Math.sin(po.gait * (o.legs ? 1 : 1.5) + i * 1.2) * (po.moving ? o.r * 0.5 : o.r * 0.15);
    const rear = o.legs === 0 && po.crouch > 0 && i === o.segs - 1 ? po.crouch * o.r * 1.6 : 0;
    pts.push(v(-i * o.r * 1.35 + po.lunge * o.r * 1.6, wig, o.r * 0.9 + rear + (i === 0 ? po.crouch * o.r * 0.8 : 0)));
  }
  pts.reverse();
  for (let i = 0; i < pts.length; i++) {
    const rr = o.r * (i === pts.length - 1 ? 0.9 : 0.75 + 0.35 * Math.sin((i / pts.length) * Math.PI));
    const glow = o.glow && i < pts.length - 1 && i < 2;
    P.push(sph(pts[i], rr, glow ? o.glow! : o.shell, { depthBias: i * 0.01 }));
    if (i > 0) P.push(cap(pts[i - 1], pts[i], rr * 0.6, o.under, { depthBias: -0.2 }));
    if (o.legs) for (const s of [-1, 1]) {
      if (i === pts.length - 1) continue;
      const ph = po.gait * 2 + i + (s > 0 ? Math.PI : 0);
      const foot = add(pts[i], v(Math.sin(ph) * o.r * 0.5, s * o.r * 1.7, -o.r * 0.9));
      P.push(cap(add(pts[i], v(0, s * o.r * 0.5, 0)), foot, o.r * 0.18, o.under));
    }
  }
  const head = pts[pts.length - 1];
  const ec = rgba(o.eye);
  P.push(dot(add(head, v(o.r * 0.7, -o.r * 0.4, o.r * 0.3)), head, ec, 1));
  P.push(dot(add(head, v(o.r * 0.7, o.r * 0.4, o.r * 0.3)), head, ec, 1));
  if (!o.legs) {
    // round lamprey mouth
    P.push(disc(add(head, v(o.r * 0.85, 0, 0)), o.r * (0.45 + po.open * 0.25), v(1, 0, 0), o.under, { rim: o.shell[3], boss: rgba("#3a0a10") }));
  } else {
    for (const s of [-1, 1]) P.push(cap(add(head, v(o.r * 0.6, s * o.r * 0.3, -o.r * 0.2)), add(head, v(o.r * 1.3, s * o.r * (0.1 + po.open * 0.4), -o.r * 0.4)), o.r * 0.14, o.under));
  }
  return P;
}
