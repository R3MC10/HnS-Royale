// Charm triggers and charges (server). Charms live in p.charms (inventory agent: slots, equip routing,
// death drop); this module only reads them. Charges come from kills; a charm fires automatically when
// its trigger happens and it has enough charges, granting a short buff (server/uniques.ts addBuff).
// PoE2 rules: ailment charms (frozen, ignited, shocked, bleeding, poisoned, stunned) remove the
// ailment that set them off and then grant immunity; elemental charms trigger on taking that damage
// type from a hit; charm mods add flat life / mana on use, a chance not to consume charges, extra
// maximum charges; unique charms add their own buffs (content/uniques.ts charmBuff).
import { CHARM_BY_ID, TRIGGER_CURES, charmSlotsFor, type CharmDef, type CharmTrigger } from "../shared/content/charms";
import { DT } from "../shared/constants";
import { LOW_LIFE } from "../shared/content/fx";
import { UNIQUE_BY_ID } from "../shared/content/uniques";
import type { AilmentKind } from "../shared/ailments";
import type { DamageMap } from "../shared/defence";
import type { Item } from "../shared/items";
import { charmProps, type CharmProps } from "../shared/lootinfo";
import { cleansePlayerAilments } from "./damage";
import { addBuff, fxOf, isSlowed, lootFx } from "./uniques";
import type { ServerPlayer } from "./player";

/** Charm charges per kill (PoE2: half the monster's power). */
export const CHARM_CHARGES = { normal: 2, elite: 6, boss: 12, player: 12 } as const;
/** A single hit of at least this fraction of max life is a "heavy blow". */
export const HEAVY_HIT = 0.15;

export interface CharmHost {
  toast(p: ServerPlayer, text: string): void;
  /** Gilded Tooth: an extra Ember at (x, y). */
  bonusCurrency(x: number, y: number): void;
}

function charmsOf(p: ServerPlayer): (Item | null)[] {
  const c = (p as { charms?: (Item | null)[] }).charms;
  if (!c) return [];
  const n = charmSlotsFor(p.equip);
  return c.slice(0, n);
}

interface CharmEdge {
  wasLow: boolean;
  wasSlowed: boolean;
}
const EDGE = new WeakMap<ServerPlayer, CharmEdge>();
const edge = (p: ServerPlayer) => {
  let e = EDGE.get(p);
  if (!e) EDGE.set(p, (e = { wasLow: false, wasSlowed: false }));
  return e;
};

/** Add `amount` raw charges to every slotted charm (scaled by charm-gain modifiers). */
function gainCharges(p: ServerPlayer, amount: number, markDirty: (before: number, after: number) => boolean) {
  const gain = 1 + fxOf(p).charmGain / 100;
  let changed = false;
  for (const c of charmsOf(p)) {
    if (!c) continue;
    const pr = charmProps(c)!;
    const before = c.c ?? 0;
    const next = Math.min(pr.maxCharges, before + amount * gain * pr.gainMult);
    if (next !== before) {
      c.c = next;
      if (markDirty(before, next)) changed = true;
    }
  }
  if (changed) p.invDirty = true;
}

export function addCharmCharges(p: ServerPlayer, kind: keyof typeof CHARM_CHARGES) {
  gainCharges(p, CHARM_CHARGES[kind], () => true);
}

/** Spend charges (unless the no-consume roll wins), apply cures, buffs and recovery. */
function fire(host: CharmHost, p: ServerPlayer, c: Item, d: CharmDef, pr: CharmProps, at?: { x: number; y: number }) {
  if (Math.random() >= pr.noConsume) c.c = (c.c ?? 0) - pr.cost;
  const cures = TRIGGER_CURES[d.trigger];
  if (cures) cleansePlayerAilments(p, cures as AilmentKind[]);
  for (const [k, v] of d.buff) addBuff(p, k, v, pr.duration, `charm${c.id}`);
  const u = c.u ? UNIQUE_BY_ID.get(c.u) : undefined;
  if (u?.charmBuff) for (const [k, v] of u.charmBuff) addBuff(p, k, v, Math.max(1, pr.duration), `charm${c.id}`);
  let heal = pr.lifeOnUse;
  if (d.heal) heal += (p.stats.maxHp * d.heal) / 100;
  if (heal > 0) p.hp = Math.min(p.stats.maxHp, p.hp + heal);
  if (pr.manaOnUse > 0) {
    const sk = (p as { sk?: { mana: number } }).sk;
    if (sk) sk.mana = Math.min(p.stats.maxMana, sk.mana + pr.manaOnUse);
  }
  if (d.id === "chm_gildtooth" && at) host.bonusCurrency(at.x, at.y);
  p.invDirty = true;
}

/** Fire every charm with this trigger that has the charges. Returns how many fired. */
export function triggerCharms(host: CharmHost, p: ServerPlayer, trig: CharmTrigger, at?: { x: number; y: number }): number {
  if (!p.alive) return 0;
  let n = 0;
  for (const c of charmsOf(p)) {
    if (!c) continue;
    const d = CHARM_BY_ID.get(c.b);
    if (!d || d.trigger !== trig) continue;
    const pr = charmProps(c)!;
    if ((c.c ?? 0) < pr.cost) continue;
    // Don't re-fire while this charm's buff is still running.
    if (lootFx(p).buffs.some((b) => b.src === `charm${c.id}`)) continue;
    fire(host, p, c, d, pr, at);
    host.toast(p, `${c.n} triggered`);
    n++;
  }
  return n;
}

/** Manual use of charm slot `i` (ignores the trigger; still needs the charges). */
export function useCharmSlot(host: CharmHost, p: ServerPlayer, i: number): boolean {
  if (!p.alive || !Number.isInteger(i)) return false;
  const c = charmsOf(p)[i];
  const d = c ? CHARM_BY_ID.get(c.b) : undefined;
  if (!c || !d) return false;
  const pr = charmProps(c)!;
  if ((c.c ?? 0) < pr.cost) {
    host.toast(p, `${c.n}: not enough charges`);
    return false;
  }
  fire(host, p, c, d, pr);
  host.toast(p, `${c.n} used`);
  return true;
}

/** Called when `t` took `dmg` (after mitigation). */
export function charmsOnHitTaken(host: CharmHost, t: ServerPlayer, dmg: number, byPlayer: boolean) {
  if (!t.alive) return;
  if (dmg >= t.stats.maxHp * HEAVY_HIT) triggerCharms(host, t, "heavyHit");
  if (byPlayer) triggerCharms(host, t, "playerHit");
}

const AIL_TRIGGER: Partial<Record<AilmentKind, CharmTrigger>> = {
  freeze: "frozen",
  ignite: "ignited",
  shock: "shocked",
  bleed: "bleeding",
  poison: "poisoned",
  stun: "stunned",
  electrocute: "stunned",
  chill: "slowed",
};

/** An ailment just started on player `t` (defence pipeline onAilment). */
export function charmsOnAilment(host: CharmHost, t: ServerPlayer, kind: AilmentKind) {
  const trig = AIL_TRIGGER[kind];
  if (trig && t.alive) triggerCharms(host, t, trig);
}

/** A hit carrying these damage types landed on `t` (elemental / chaos ward charms). */
export function charmsOnDamageTypes(host: CharmHost, t: ServerPlayer, dmg: DamageMap) {
  if (!t.alive) return;
  if ((dmg.fire ?? 0) > 0) triggerCharms(host, t, "fireHit");
  if ((dmg.cold ?? 0) > 0) triggerCharms(host, t, "coldHit");
  if ((dmg.light ?? 0) > 0) triggerCharms(host, t, "lightHit");
  if ((dmg.chaos ?? 0) > 0) triggerCharms(host, t, "chaosHit");
}

/** Per tick: edge-triggered low-life and slowed charms, and charm charge regeneration. */
export function charmsTick(host: CharmHost, p: ServerPlayer) {
  const e = edge(p);
  if (!p.alive) {
    e.wasLow = e.wasSlowed = false;
    return;
  }
  const regen = fxOf(p).charmChargeRegen;
  // Only resend the inventory when a whole charge ticks over.
  if (regen > 0) gainCharges(p, regen * DT, (a, b) => Math.floor(a) !== Math.floor(b));
  const low = p.hp <= p.stats.maxHp * LOW_LIFE;
  if (low && !e.wasLow) triggerCharms(host, p, "lowLife");
  e.wasLow = low;
  const slowed = isSlowed(p);
  if (slowed && !e.wasSlowed) triggerCharms(host, p, "slowed");
  e.wasSlowed = slowed;
}
