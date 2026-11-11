// Client-side prediction + server reconciliation for the local player.
import type { InputCmd, PhysState } from "../shared/protocol";
import { copyPhys, newPhysState, stepPlayer } from "../shared/sim";
import { defaultStats, type Stats } from "../shared/stats";

/** Corrections bigger than this are applied instantly (respawn, teleport). */
const SNAP_DIST = 160;
/** Per-second exponential decay of the visual correction offset. */
const CORRECTION_DECAY = 12;

export class Predictor {
  /** Predicted state after the latest input. */
  cur: PhysState = newPhysState(0, 0);
  /** State before the latest input (for interpolation between input ticks). */
  prev: PhysState = newPhysState(0, 0);
  pending: InputCmd[] = [];
  /** Visual-only offset that hides small corrections and decays to zero. */
  offX = 0;
  offY = 0;
  initialized = false;
  /** Own derived stats, as last sent by the server (used for prediction). */
  stats: Stats = defaultStats();
  private seq = 0;

  reset() {
    this.pending = [];
    this.initialized = false;
    this.offX = this.offY = 0;
  }

  /** Simulate one input step locally. Returns the cmd to send. */
  step(build: (seq: number) => Omit<InputCmd, "seq">, frozen: boolean): InputCmd {
    const cmd: InputCmd = { seq: ++this.seq, ...build(this.seq) };
    copyPhys(this.cur, this.prev);
    stepPlayer(this.cur, cmd, frozen, this.stats);
    this.pending.push(cmd);
    if (this.pending.length > 120) this.pending.shift(); // server not acking; don't grow forever
    return cmd;
  }

  /** Re-base on the authoritative state and replay unacknowledged inputs. */
  reconcile(server: PhysState, ack: number, frozen: boolean) {
    this.pending = this.pending.filter((c) => c.seq > ack);
    const oldX = this.cur.x;
    const oldY = this.cur.y;
    copyPhys(server, this.cur);
    for (const c of this.pending) {
      copyPhys(this.cur, this.prev);
      stepPlayer(this.cur, c, frozen, this.stats);
    }
    if (this.pending.length === 0) copyPhys(this.cur, this.prev);

    if (!this.initialized) {
      this.initialized = true;
      copyPhys(this.cur, this.prev);
      return;
    }
    const dx = this.cur.x - oldX;
    const dy = this.cur.y - oldY;
    if (Math.hypot(dx, dy) > SNAP_DIST) {
      this.offX = this.offY = 0;
      copyPhys(this.cur, this.prev);
    } else {
      // Keep the rendered position where it was; let the offset fade out.
      this.offX -= dx;
      this.offY -= dy;
    }
  }

  decay(dt: number) {
    const f = Math.exp(-CORRECTION_DECAY * dt);
    this.offX *= f;
    this.offY *= f;
    if (Math.abs(this.offX) < 0.05) this.offX = 0;
    if (Math.abs(this.offY) < 0.05) this.offY = 0;
  }

  /** Smoothed render position; alpha = fraction of the current input tick elapsed. */
  renderPos(alpha: number) {
    return {
      x: this.prev.x + (this.cur.x - this.prev.x) * alpha + this.offX,
      y: this.prev.y + (this.cur.y - this.prev.y) * alpha + this.offY,
    };
  }
}
