// Timed character pose overrides: skill poses (triggered by the gems client from cast events, for
// every player including remote ones) and hit reactions (flinch / heavy-stun stagger).
// The renderer asks currentPose(id) each frame; priority: stagger > skill pose > (attack) > flinch.
import { HERO_FRAMES, LOOPING, type HeroAnim, type SkillPose } from "./hero";

export type { SkillPose } from "./hero";
export type ReactPose = "flinch" | "stagger";

/**
 * 3D clip for a skill pose (hero3d): the clip's name in hero.glb and how the use time maps onto it.
 *  - hit + contact: the skill lands `hit` (0..1) of the way through the use; the clip shows its
 *    contact frame (`contact`, 0..1 of the clip) at exactly that moment, so the wind-up ends when the hit lands;
 *  - loops: the clip repeats this many times over the use (a whirl);
 *  - enterMs: the clip plays once over this long, then holds its last frame (a stance);
 *  - strongMs: after this long the pose gives way to attack swings (a stance you can fight out of).
 */
export interface PoseClip {
  name: string;
  hit?: number;
  contact?: number;
  loops?: number;
  enterMs?: number;
  strongMs?: number;
}

interface Active {
  pose: HeroAnim;
  start: number;
  dur: number;
  clip?: PoseClip;
  /** World facing angle to hold while posing (undefined = keep the player's own facing). */
  dir?: number;
}

const skills = new Map<number, Active>();
const reacts = new Map<number, Active>();

const now = () => performance.now();

/**
 * Play a skill pose on a player for `durationMs`. `dir` is a world angle (radians) to face while
 * posing. Looping poses (channel) repeat until the duration ends or stopPose() is called.
 */
export function playPose(entityId: number, pose: SkillPose | ReactPose, durationMs: number, dir?: number, clip?: PoseClip) {
  const a: Active = { pose, start: now(), dur: Math.max(60, durationMs), dir, clip };
  if (pose === "flinch" || pose === "stagger") {
    const cur = reacts.get(entityId);
    // A flinch never cuts a stagger short.
    if (pose === "flinch" && cur?.pose === "stagger" && now() - cur.start < cur.dur) return;
    reacts.set(entityId, a);
  } else skills.set(entityId, a);
}

/** Keep an entity's current skill pose (if it plays `clip`) for `ms` more from now: a stance whose real length arrives later. */
export function extendPose(entityId: number, clip: string, ms: number) {
  const a = skills.get(entityId);
  if (a?.clip?.name === clip) a.dur = now() - a.start + ms;
}

/** End any skill pose (e.g. channel released) and reaction on an entity. */
export function stopPose(entityId: number) {
  skills.delete(entityId);
  reacts.delete(entityId);
}

export interface PoseState {
  anim: HeroAnim;
  /** Fractional frame. */
  frame: number;
  dir?: number;
  /** Lower-priority than an attack (renderer lets swings play over it). */
  weak: boolean;
  /** 3D clip to play instead of the pose's default, with its 0..1 progress (and whether it loops). */
  clip?: string;
  prog?: number;
  loop?: boolean;
}

function stateOf(a: Active, t: number): PoseState {
  const n = HERO_FRAMES[a.pose];
  const k = (t - a.start) / a.dur;
  let frame: number;
  if (LOOPING.has(a.pose)) frame = (((t - a.start) / 1000) * 7) % n; // ~7 fps keyframes, blended
  else frame = Math.min(n - 1, k * (n - 0.001));
  const c = a.clip;
  if (!c) return { anim: a.pose, frame, dir: a.dir, weak: a.pose === "flinch" };
  const kk = Math.min(1, Math.max(0, k));
  let prog: number;
  if (c.loops) prog = (kk * c.loops) % 1;
  else if (c.enterMs) prog = Math.min(1, (t - a.start) / c.enterMs);
  else if (c.hit !== undefined && c.contact !== undefined && c.hit > 0.01 && c.hit < 0.99) prog = kk < c.hit ? (kk / c.hit) * c.contact : c.contact + ((kk - c.hit) / (1 - c.hit)) * (1 - c.contact);
  else prog = kk;
  return { anim: a.pose, frame, dir: a.dir, weak: c.strongMs !== undefined && t - a.start > c.strongMs, clip: c.name, prog, loop: !!c.loops };
}

/** Active pose for an entity at this moment, or null. */
export function currentPose(entityId: number): PoseState | null {
  const t = now();
  const r = reacts.get(entityId);
  if (r && t - r.start >= r.dur) reacts.delete(entityId);
  const s = skills.get(entityId);
  if (s && t - s.start >= s.dur) skills.delete(entityId);
  const rr = reacts.get(entityId);
  if (rr?.pose === "stagger") return stateOf(rr, t);
  const ss = skills.get(entityId);
  if (ss) return stateOf(ss, t);
  if (rr) return stateOf(rr, t);
  return null;
}
