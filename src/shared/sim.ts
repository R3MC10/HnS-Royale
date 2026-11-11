// Movement simulation shared by server (authoritative) and client (prediction).
// Must stay deterministic: same state + same input => same result on both sides.
import { ATTACK_RECOVER_MOVE, ATTACK_RECOVER_TAIL, DT, KNOCKBACK_DECAY, MAP_H, MAP_W, PLAYER_RADIUS } from "./constants";
import { forObstaclesNear, rescueFromWall } from "./map";
import type { InputCmd, PhysState } from "./protocol";
import { DEFAULT_STATS, type Stats } from "./stats";

const KB_FACTOR = Math.exp(-KNOCKBACK_DECAY * DT);

export function newPhysState(x: number, y: number): PhysState {
  return { x, y, angle: 0, kbx: 0, kby: 0, rollT: 0, rollCd: 0, rollDx: 0, rollDy: 0, atkT: 0, atkCd: 0 };
}

export function copyPhys<T extends PhysState>(src: PhysState, dst: T): T {
  dst.x = src.x;
  dst.y = src.y;
  dst.angle = src.angle;
  dst.kbx = src.kbx;
  dst.kby = src.kby;
  dst.rollT = src.rollT;
  dst.rollCd = src.rollCd;
  dst.rollDx = src.rollDx;
  dst.rollDy = src.rollDy;
  dst.atkT = src.atkT;
  dst.atkCd = src.atkCd;
  return dst;
}

/** Push a circle out of obstacles and keep it inside the arena. */
export function resolveCollisions(s: { x: number; y: number }, radius = PLAYER_RADIUS) {
  // Spatial-grid query (deterministic order) instead of scanning every obstacle on huge maps.
  forObstaclesNear(s.x, s.y, radius, (o) => {
    const dx = s.x - o.x;
    const dy = s.y - o.y;
    const minDist = o.r + radius;
    const d2 = dx * dx + dy * dy;
    if (d2 < minDist * minDist) {
      const d = Math.sqrt(d2) || 0.0001;
      s.x = o.x + (dx / d) * minDist;
      s.y = o.y + (dy / d) * minDist;
    }
  });
  s.x = Math.max(radius, Math.min(MAP_W - radius, s.x));
  s.y = Math.max(radius, Math.min(MAP_H - radius, s.y));
  rescueFromWall(s); // tunnelled through a wall edge (huge knockback): back to the nearest open cell
}

/**
 * Advance a player one tick. Returns true if a swing started this tick
 * (the server then resolves hits; the client just plays the animation).
 * All tunable numbers come from `st` so equipment can change them; client and
 * server must pass the same stats for prediction to match.
 */
/** Raised shield: move speed multiplier while held (PoE2 raise-shield: slow walk, no attacks). */
export const BLOCK_MOVE_MULT = 0.45;

export function stepPlayer(s: PhysState, input: InputCmd, frozen: boolean, st: Readonly<Stats> = DEFAULT_STATS): boolean {
  // Facing is locked while an attack is in progress (committed attacks, PoE2-style).
  if (s.atkT <= 0) s.angle = input.angle;
  s.rollT = Math.max(0, s.rollT - DT);
  s.rollCd = Math.max(0, s.rollCd - DT);
  s.atkT = Math.max(0, s.atkT - DT);
  s.atkCd = Math.max(0, s.atkCd - DT);

  if (frozen) {
    s.kbx = 0;
    s.kby = 0;
    return false;
  }

  let mx = Math.max(-1, Math.min(1, input.mx || 0));
  let my = Math.max(-1, Math.min(1, input.my || 0));
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }

  if (input.dodge && s.rollCd <= 0 && s.rollT <= 0) {
    // Dodge roll toward movement direction, or facing direction if standing still.
    if (len > 0.01) {
      const l = Math.hypot(mx, my);
      s.rollDx = mx / l;
      s.rollDy = my / l;
    } else {
      s.rollDx = Math.cos(s.angle);
      s.rollDy = Math.sin(s.angle);
    }
    s.rollT = st.dodgeTime;
    s.rollCd = st.dodgeCooldown;
    // Rolling cancels an attack in progress (the server drops its pending hit).
    s.atkT = 0;
  }

  let vx: number;
  let vy: number;
  if (s.rollT > 0) {
    vx = s.rollDx * st.dodgeSpeed;
    vy = s.rollDy * st.dodgeSpeed;
  } else {
    // Attack slow walk; the follow-through (last ATTACK_RECOVER_TAIL s) is already most of the way back to a run.
    const atkMove = s.atkT <= 0 ? 1 : s.atkT <= ATTACK_RECOVER_TAIL ? Math.max(st.swingMoveMult, ATTACK_RECOVER_MOVE) : st.swingMoveMult;
    const speed = st.moveSpeed * atkMove * (input.blk ? BLOCK_MOVE_MULT : 1);
    vx = mx * speed;
    vy = my * speed;
  }

  vx += s.kbx;
  vy += s.kby;
  s.kbx *= KB_FACTOR;
  s.kby *= KB_FACTOR;
  if (Math.abs(s.kbx) < 1) s.kbx = 0;
  if (Math.abs(s.kby) < 1) s.kby = 0;

  s.x += vx * DT;
  s.y += vy * DT;
  resolveCollisions(s);

  if (input.attack && !input.blk && s.atkCd <= 0 && s.rollT <= 0) {
    s.angle = input.angle;
    s.atkCd = st.attackCooldown;
    s.atkT = st.swingTime;
    return true;
  }
  return false;
}

/** True during the invulnerable part of a dodge roll (the first dodgeIframes seconds). */
export function isInvulnerable(s: PhysState, st: Readonly<Stats>): boolean {
  return s.rollT > 0 && st.dodgeTime - s.rollT < st.dodgeIframes;
}
