// Snapshot buffer + interpolation for remote entities (rendered slightly in the past).
import { DT, INTERP_DELAY } from "../shared/constants";
import type { MonsterSnap, PlayerSnap, ProjSnap } from "../shared/protocol";

function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

interface Frame {
  t: number; // server time (tick * DT)
  players: Map<number, PlayerSnap>;
  monsters: Map<number, MonsterSnap>;
  projs: Map<number, ProjSnap>;
}

export interface Sampled {
  players: Map<number, PlayerSnap>;
  monsters: Map<number, MonsterSnap>;
  projs: Map<number, ProjSnap>;
}

/** Interpolate every entity in `b`; entities new in `b` (or teleported) are shown as-is. */
function lerpMap<T extends { id: number; x: number; y: number }>(
  a: Map<number, T>,
  b: Map<number, T>,
  f: number,
  extra?: (pa: T, pb: T, out: T, f: number) => void,
): Map<number, T> {
  const out = new Map<number, T>();
  for (const [id, pb] of b) {
    const pa = a.get(id);
    if (!pa || Math.hypot(pb.x - pa.x, pb.y - pa.y) > 200) {
      out.set(id, pb);
      continue;
    }
    const o = { ...pb, x: pa.x + (pb.x - pa.x) * f, y: pa.y + (pb.y - pa.y) * f };
    extra?.(pa, pb, o, f);
    out.set(id, o);
  }
  return out;
}

export class Interpolator {
  private frames: Frame[] = [];
  /** serverTime ≈ clientNow + offset (seconds). */
  private offset = 0;
  private synced = false;

  push(tick: number, players: PlayerSnap[], monsters: MonsterSnap[], projs: ProjSnap[], nowSec: number) {
    const t = tick * DT;
    const target = t - nowSec;
    if (!this.synced || Math.abs(target - this.offset) > 0.25) {
      this.offset = target;
      this.synced = true;
    } else {
      // Drift slowly toward the latest estimate, biased toward the most recent packets.
      this.offset += (target - this.offset) * (target > this.offset ? 0.2 : 0.02);
    }
    this.frames.push({
      t,
      players: new Map(players.map((p) => [p.id, p])),
      monsters: new Map(monsters.map((m) => [m.id, m])),
      projs: new Map(projs.map((p) => [p.id, p])),
    });
    if (this.frames.length > 60) this.frames.shift();
  }

  /** Interpolated state of every remote entity at (now - INTERP_DELAY). */
  sample(nowSec: number): Sampled {
    if (this.frames.length === 0) return { players: new Map(), monsters: new Map(), projs: new Map() };
    const rt = nowSec + this.offset - INTERP_DELAY;

    let a = this.frames[0];
    let b = this.frames[0];
    for (let i = this.frames.length - 1; i >= 0; i--) {
      if (this.frames[i].t <= rt) {
        a = this.frames[i];
        b = this.frames[Math.min(i + 1, this.frames.length - 1)];
        break;
      }
    }
    const span = b.t - a.t;
    const f = span > 0 ? Math.max(0, Math.min(1, (rt - a.t) / span)) : 0;

    return {
      players: lerpMap(a.players, b.players, f, (pa, pb, o, t) => {
        if (pa.alive !== pb.alive) return;
        o.angle = lerpAngle(pa.angle, pb.angle, t);
        o.atkT = pa.atkT + (pb.atkT - pa.atkT) * t;
        o.rollT = pa.rollT + (pb.rollT - pa.rollT) * t;
        o.hp = t < 0.5 ? pa.hp : pb.hp;
      }),
      monsters: lerpMap(a.monsters, b.monsters, f, (pa, pb, o, t) => {
        o.a = lerpAngle(pa.a, pb.a, t);
      }),
      projs: lerpMap(a.projs, b.projs, f),
    };
  }
}
