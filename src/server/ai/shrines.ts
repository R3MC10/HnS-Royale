// Guarded buff shrines on "buff" POIs: kill the guardian pack, step on the shrine, get a 45 s buff.
import { DT } from "../../shared/constants";
import { SHRINES, SHRINE_DURATION, SHRINE_GUARDS, SHRINE_RANGE, type ShrineDef } from "../../shared/content/monsters/shrines";
import type { Camp, Monster, MonsterSystem } from "../monsters";
import type { ServerPlayer } from "../player";
import type { DefenceHook } from "../damage";

export interface Shrine {
  id: number;
  x: number;
  y: number;
  def: ShrineDef;
  camp: Camp;
  used: boolean;
}
export interface Buff {
  def: ShrineDef;
  t: number;
  stormT: number;
}

export const shrines: Shrine[] = [];
export const buffs = new Map<number, Buff>();
let sysRef: MonsterSystem | null = null;
let wrapped = false;

export function shrineInit(sys: MonsterSystem) {
  shrines.length = 0;
  buffs.clear();
  sysRef = sys;
  if (wrapped) return;
  wrapped = true;
  // Ironbark / Thornwake act on monster hits to the player (PvP: see shrinePvpHook below).
  const orig = sys.host.damagePlayer.bind(sys.host);
  sys.host.damagePlayer = (p, dmg, fx, fy, kb, source, meta) => {
    const b = buffs.get(p.id);
    const mon = meta?.mon as Monster | undefined;
    if (b && (meta?.monster || mon)) {
      dmg *= b.def.dmgTaken ?? 1;
      const before = p.hp;
      const r = orig(p, dmg, fx, fy, kb, source, meta);
      // Thornwake: reflect onto the monster that actually hit (never pools / auras / reflected damage).
      const form = meta?.form;
      if (b.def.thorns && mon?.alive && form !== "dot" && form !== "reflect" && (r === true || p.hp < before)) {
        shrineHit(mon, dmg * b.def.thorns, p, "Thornwake");
      }
      return r;
    }
    return orig(p, dmg, fx, fy, kb, source, meta);
  };
}

/**
 * Shrine damage to monsters goes through the full damage pipeline (hit event, kill credit, loot, XP,
 * gore 'mdie'); server/defprog.ts installs it. The fallback (no pipeline wired) only removes life.
 */
let shrineHit: (m: Monster, dmg: number, by: ServerPlayer, source: string) => void = (m, dmg, by) => {
  sysRef?.damage(m, dmg, by.x, by.y, 0, by);
};
export function setShrineHitter(f: typeof shrineHit) {
  shrineHit = f;
}

/** Ironbark / Emberheart also apply to player-vs-player hits (defence pipeline hook, server/damage.ts). */
export const shrinePvpHook: DefenceHook = {
  takenMult: (p, h) => (h.by && h.by !== p ? buffs.get(p.id)?.def.dmgTaken ?? 1 : 1),
  outMult: (by, _t, vsPlayer) => (vsPlayer ? buffs.get(by.id)?.def.dmgDealt ?? 1 : 1),
};

/** Guardian pack around a shrine (one magic or rare guard). */
export function shrineSpawn(sys: MonsterSystem, camp: Camp) {
  let s = shrines.find((x) => x.camp === camp);
  if (!s) {
    s = { id: camp.id, x: camp.x, y: camp.y, def: SHRINES[Math.floor(Math.random() * SHRINES.length)], camp, used: false };
    shrines.push(s);
  }
  s.used = false;
  const n = SHRINE_GUARDS[0] + Math.floor(Math.random() * (SHRINE_GUARDS[1] - SHRINE_GUARDS[0] + 1));
  rollGuards(sys, camp, n);
}

let rollGuards: (sys: MonsterSystem, camp: Camp, n: number) => void = () => undefined;
export function setGuardRoller(f: typeof rollGuards) {
  rollGuards = f;
}

export function shrineHidden(p: ServerPlayer): boolean {
  return !!buffs.get(p.id)?.def.veil;
}
export function shrineDealt(p: ServerPlayer | undefined): number {
  return (p && buffs.get(p.id)?.def.dmgDealt) ?? 1;
}
export function shrineMoveMult(p: ServerPlayer): number {
  return buffs.get(p.id)?.def.moveSpeed ?? 1;
}
export function shrineKilled(sys: MonsterSystem, m: Monster, killer: ServerPlayer) {
  const n = buffs.get(killer.id)?.def.extraLoot;
  if (n) sys.host.extraDrops?.(m, killer, n);
}

export function shrineUpdate(sys: MonsterSystem, players: Map<number, ServerPlayer>, alive: ServerPlayer[]) {
  for (const s of shrines) {
    if (s.used || s.camp.monsters.length) continue;
    for (const p of alive) {
      if (!p.alive || Math.hypot(p.x - s.x, p.y - s.y) > SHRINE_RANGE + 16) continue;
      s.used = true;
      buffs.set(p.id, { def: s.def, t: SHRINE_DURATION, stormT: 0 });
      sys.host.toast?.(p, `${s.def.name}: ${s.def.desc} (${SHRINE_DURATION}s)`);
      sys.host.boom(s.x, s.y, 60);
      break;
    }
  }
  for (const [id, b] of buffs) {
    const p = players.get(id);
    if (!p || !p.alive || (b.t -= DT) <= 0) {
      buffs.delete(id);
      continue;
    }
    if (b.def.regen) p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * b.def.regen * DT);
    const sc = b.def.stormcall;
    if (sc && (b.stormT -= DT) <= 0) {
      b.stormT = sc.every;
      let best: Monster | null = null;
      let bd = sc.radius;
      for (const m of sys.active) {
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (m.alive && d < bd) {
          bd = d;
          best = m;
        }
      }
      if (best) {
        sys.host.boom(best.x, best.y, 30);
        shrineHit(best, sc.dmg, p, "Stormcall");
      }
    }
  }
}

/** Compact shrine state for clients: [id, x, y, defId, used]. */
export function shrineSnap(): [number, number, number, string, 0 | 1][] {
  return shrines.map((s) => [s.id, Math.round(s.x), Math.round(s.y), s.def.id, s.used ? 1 : 0]);
}
/** A player's active shrine buff, if any. */
export function buffOf(pid: number): { id: string; t: number } | null {
  const b = buffs.get(pid);
  return b ? { id: b.def.id, t: Math.ceil(b.t) } : null;
}
