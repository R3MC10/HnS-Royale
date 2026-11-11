import { encodeLook } from "../shared/look";
import { classLookDigit, playerLevel } from "./progression";
// Server-side player record.
import { MAX_FLASK_SLOTS, MAX_HP } from "../shared/constants";
import type { GridEntry } from "../shared/grid";
import type { WeaponKind } from "../shared/content/types";
import { BASE_BY_ID } from "../shared/content/bases";
import { emptyEquipment, type Equipment, type Item } from "../shared/items";
import type { InputCmd, PhysState, PlayerSnap } from "../shared/protocol";
import { newPhysState } from "../shared/sim";
import { defaultStats, type Stats } from "../shared/stats";
import { manaOf, newSkillState, type SkillState } from "./skills";

export interface HealOverTime {
  perSec: number;
  t: number; // seconds left
}

export interface ServerPlayer extends PhysState {
  id: number;
  /** Breachway lane mode: team (undefined in the royale). */
  team?: 0 | 1;
  name: string;
  color: string;
  hp: number;
  /** Derived stats: gear (computeStats) + status effects. Sim + combat read only these. */
  stats: Stats;
  /** Stats from gear only (before status effects like slows). */
  gearStats: Stats;
  /** Last stats sent to this client (to detect changes). */
  sentStats: Stats | null;
  alive: boolean;
  kills: number;
  wins: number;
  joined: boolean; // false until a valid join message
  inputs: InputCmd[]; // queued, not yet simulated
  lastSeq: number; // last processed input seq (ack)
  inputTokens: number; // rate limiter: +1 per tick, each simulated input costs 1
  deadFor: number; // seconds since death (practice respawn)

  startWeapon: WeaponKind;
  equip: Equipment;
  inv: GridEntry[]; // grid inventory (server/inventory.ts)
  flasks: (Item | null)[];
  charms: (Item | null)[]; // charm slots (server/inventory.ts; count set by the belt)
  /** Inactive weapon set (equip.mainhand / equip.offhand are always the ACTIVE set). */
  alt: { mainhand: Item | null; offhand: Item | null };
  weaponSet: number; // 0 = set I active, 1 = set II
  invDirty: boolean; // resend the inv message
  noRoom: number[]; // item ids refused for lack of grid room this tick (sent as `noroom`)
  heals: HealOverTime[];
  slowMult: number; // 1 = not slowed; set each tick by auras
  specId: number; // spectate target while dead
  knownGround: Set<number>; // ground ids whose details this client already has
  /** Pending attack hit: lands when atkT falls to this value (commit point); -1 = none. See combat.ts stepAttack. */
  hitAt: number;
  /** Skills: mana, bar, cooldowns, statuses (server/skills.ts). */
  sk: SkillState;
}

export function newServerPlayer(id: number): ServerPlayer {
  return {
    ...newPhysState(0, 0),
    id,
    name: "Player",
    color: "#fff",
    hp: MAX_HP,
    stats: defaultStats(),
    gearStats: defaultStats(),
    sentStats: null,
    alive: false,
    kills: 0,
    wins: 0,
    joined: false,
    inputs: [],
    lastSeq: 0,
    inputTokens: 0,
    deadFor: 0,
    startWeapon: "sword",
    equip: emptyEquipment(),
    inv: [],
    flasks: new Array(MAX_FLASK_SLOTS).fill(null),
    charms: [null, null, null],
    alt: { mainhand: null, offhand: null },
    weaponSet: 0,
    invDirty: true,
    noRoom: [],
    heals: [],
    slowMult: 1,
    specId: -1,
    knownGround: new Set(),
    hitAt: -1,
    sk: newSkillState(),
  };
}

export function toSnap(p: ServerPlayer): PlayerSnap {
  const wb = p.equip.mainhand ? BASE_BY_ID.get(p.equip.mainhand.b) : undefined;
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    hp: Math.round(p.hp * 10) / 10,
    maxHp: p.stats.maxHp,
    atkRange: p.stats.attackRange,
    atkArc: p.stats.attackArc,
    swingTime: p.stats.swingTime,
    wk: wb?.weapon?.kind ?? null,
    lk: encodeLook(p.equip),
    cl: Number(classLookDigit(p)), // class look 1..8 (progression; tint per CLASSES[].look)
    lv: playerLevel(p),
    mp: manaOf(p),
    alive: p.alive,
    // Full precision so client replay matches the server exactly.
    x: p.x,
    y: p.y,
    angle: p.angle,
    kbx: p.kbx,
    kby: p.kby,
    rollT: p.rollT,
    rollCd: p.rollCd,
    rollDx: p.rollDx,
    rollDy: p.rollDy,
    atkT: p.atkT,
    atkCd: p.atkCd,
    ...(p.team !== undefined ? { tm: p.team } : {}),
  };
}
