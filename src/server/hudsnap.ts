// Private per-player HUD block (core HUD package): kills, placement, killer, timed effects and flask
// recovery timers, sent only to the owning client as SnapMsg.me. State lives in a WeakMap so no
// ServerPlayer fields are added.
import type { ServerPlayer } from "./player";
import type { Game } from "./game";
import type { BuffSnap, SelfHud } from "../shared/protocol";
import { lootFx } from "./uniques";
import { buffOf } from "./ai/shrines";
import * as dmg from "./damage";

interface HudPState {
  k: number;
  pl?: number;
  kb?: string;
  fl: number[]; // per flask slot: Date.now() ms when recovery ends (0 = none)
}

const STATE = new WeakMap<ServerPlayer, HudPState>();

function st(p: ServerPlayer): HudPState {
  let s = STATE.get(p);
  if (!s) {
    s = { k: 0, fl: [] };
    STATE.set(p, s);
  }
  return s;
}

const r1 = (t: number) => Math.round(t * 10) / 10;

/** New round: clear kills / placement / killer / flask timers. */
export function hudRoundStart(players: ServerPlayer[]): void {
  for (const p of players) STATE.set(p, { k: 0, fl: [] });
}

/** Killer kills++, victim placement + killer name. */
export function hudOnKill(victim: ServerPlayer, killer: ServerPlayer | null, source: string, place: number | undefined): void {
  if (killer && killer !== victim) st(killer).k++;
  const v = st(victim);
  if (place !== undefined) v.pl = place;
  v.kb = killer ? (killer === victim ? "yourself" : killer.name) : source;
  v.fl = [];
}

/** Round won: placement 1. */
export function hudOnWin(winner: ServerPlayer): void {
  st(winner).pl = 1;
}

/** Records the slot's recovery end time (duration 0 = instant: no timer). */
export function hudOnFlask(p: ServerPlayer, slot: number, duration: number): void {
  const s = st(p);
  if (!(duration > 0)) {
    s.fl[slot] = 0;
    return;
  }
  // a re-use while running stacks the way the server's heal queue does (each use runs its own timer);
  // the HUD shows whichever ends later
  s.fl[slot] = Math.max(s.fl[slot] ?? 0, Date.now() + duration * 1000);
}

type AilTimesFn = (p: ServerPlayer) => { am?: SelfHud["am"]; ci?: number };

/** JSON of SelfHud for the owning client. */
export function selfHudJson(p: ServerPlayer): string {
  const s = st(p);
  const out: SelfHud = { k: s.k };
  if (s.pl !== undefined) out.pl = s.pl;
  if (s.kb !== undefined) out.kb = s.kb;

  if (p.alive) {
    const bf: BuffSnap[] = [];
    const fx = lootFx(p);
    for (const b of fx.buffs) if (b.t > 0) bf.push({ id: `${b.src}:${b.key}`, t: r1(b.t), k: b.key, src: b.src });
    if (fx.hasteT > 0) bf.push({ id: "haste", t: r1(fx.hasteT) });
    if (fx.chillT > 0) bf.push({ id: "chill", t: r1(fx.chillT), d: 1 });
    const sh = buffOf(p.id);
    if (sh && sh.t > 0) bf.push({ id: `shrine:${sh.id}`, t: r1(sh.t) });
    if (bf.length) out.bf = bf;

    const now = Date.now();
    let anyFl = false;
    const fl: number[] = [];
    for (let i = 0; i < Math.max(3, s.fl.length); i++) {
      const left = s.fl[i] ? Math.max(0, (s.fl[i] - now) / 1000) : 0;
      if (left <= 0) s.fl[i] = 0;
      fl.push(r1(left));
      if (left > 0) anyFl = true;
    }
    if (anyFl) out.fl = fl;

    // optional ailment timers (spec 4.4): only when damage.ts exports playerAilTimes
    const fn = (dmg as unknown as { playerAilTimes?: AilTimesFn }).playerAilTimes;
    if (typeof fn === "function") {
      try {
        const a = fn(p);
        if (a.am && Object.keys(a.am).length) {
          const am: NonNullable<SelfHud["am"]> = {};
          for (const [k, t] of Object.entries(a.am)) if (typeof t === "number" && t > 0) am[k as keyof typeof am] = r1(t);
          if (Object.keys(am).length) out.am = am;
        }
        if (a.ci && a.ci > 0) out.ci = r1(a.ci);
      } catch {
        /* combat state not ready */
      }
    }
  }
  return JSON.stringify(out);
}

/** Next / previous living joined player by id order; sets p.specId. */
export function cycleSpectate(game: Game, p: ServerPlayer, dir: 1 | -1): void {
  const living = [...game.players.values()].filter((q) => q.joined && q.alive && q !== p).sort((a, b) => a.id - b.id);
  if (!living.length) return;
  const cur = living.findIndex((q) => q.id === p.specId);
  let idx: number;
  if (cur < 0) {
    // not watching a living player: pick the first id after (or before) the current target id
    idx = dir === 1 ? living.findIndex((q) => q.id > p.specId) : living.map((q) => q.id < p.specId).lastIndexOf(true);
    if (idx < 0) idx = dir === 1 ? 0 : living.length - 1;
  } else idx = (cur + dir + living.length) % living.length;
  p.specId = living[idx].id;
}
