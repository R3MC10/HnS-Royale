// Glue between the game loop and the loot agent's systems (crafting, uniques' effects, charms).
// Game / combat / host call these one-liners; all logic lives in crafting.ts, uniques.ts, charms.ts.
import { BASE_BY_ID } from "../shared/content/bases";
import { CURRENCY_BY_ID } from "../shared/content/currency";
import { ESSENCE_BY_ID } from "../shared/content/essences";
import { RUNE_BY_ID } from "../shared/content/runes";
import { UNIQUE_BY_ID } from "../shared/content/uniques";
import { CHARM_BY_ID } from "../shared/content/charms";
import { JEWEL_BASE_BY_ID } from "../shared/content/jewels";
import type { Item, Rarity } from "../shared/items";
import { addCharmCharges, charmsOnAilment, charmsOnDamageTypes, charmsOnHitTaken, charmsTick, triggerCharms, useCharmSlot, type CharmHost } from "./charms";
import type { AilmentKind } from "../shared/ailments";
import type { DamageMap } from "../shared/defence";
import { craft } from "./crafting";
import { rollCharm, rollCurrency, rollEssence, rollItem, rollJewel, rollRune, rollUnique } from "./loot";
import type { ServerPlayer } from "./player";
import { autoPlace } from "./inventory";
import { fxOf, lootAfterHit, lootKillEffects, lootStepPlayer, type LootHost } from "./uniques";

/** What the loot systems need from the Game. */
export interface LootGameHost {
  toast(p: ServerPlayer, text: string): void;
  dropItem(item: Item, x: number, y: number, spread?: number): void;
  /** Reflected / effect damage to a player through the normal path (i-frames, death, events). */
  damagePlayerRaw(t: ServerPlayer, dmg: number, by: ServerPlayer, source: string): void;
  refresh(p: ServerPlayer): void; // recompute stats (refreshStats with the game's drop fn)
}

let H: LootGameHost | null = null;
export function bindLootHost(h: LootGameHost) {
  H = h;
}

const charmHost: CharmHost = {
  toast: (p, t) => H?.toast(p, t),
  bonusCurrency: (x, y) => H?.dropItem(rollCurrency(10), x, y, 30),
};
const fxHost: LootHost = {
  damagePlayerRaw: (t, d, by, src) => H?.damagePlayerRaw(t, d, by, src),
  toast: (p, t) => H?.toast(p, t),
};

// ---- combat ------------------------------------------------------------------------------------

/** A player took `dmg` (after mitigation). `by` = attacking player, if any. */
export function lootPlayerHit(t: ServerPlayer, dmg: number, by: ServerPlayer | null, melee: boolean) {
  if (by && by !== t) lootAfterHit(fxHost, by, dmg, t, melee);
  charmsOnHitTaken(charmHost, t, dmg, !!by && by !== t);
}

/** An ailment started on player `t` (ailment charms: frozen, ignited, shocked, bleeding, poisoned, stunned). */
export function lootOnAilment(t: ServerPlayer, kind: AilmentKind) {
  charmsOnAilment(charmHost, t, kind);
}

/** A hit with these damage types landed on player `t` (elemental / chaos ward charms). */
export function lootOnDamageTypes(t: ServerPlayer, dmg: DamageMap) {
  charmsOnDamageTypes(charmHost, t, dmg);
}

/** Melee swing landed on player `t`: `t`'s thorns answer the attacker. */
export function lootMeleeThorns(by: ServerPlayer, t: ServerPlayer) {
  const th = fxOf(t).thorns;
  if (th > 0 && t.alive && by.alive && by !== t) H?.damagePlayerRaw(by, th, t, `${t.name}'s thorns`);
}

/** A player hit a monster for `dmg`. */
export function lootMonsterHit(by: ServerPlayer, dmg: number) {
  lootAfterHit(fxHost, by, dmg, null, false);
}

export function lootMonsterKilled(killer: ServerPlayer, elite: boolean, boss: boolean, x: number, y: number) {
  addCharmCharges(killer, boss ? "boss" : elite ? "elite" : "normal");
  lootKillEffects(killer);
  if (elite || boss) triggerCharms(charmHost, killer, "eliteKill", { x, y });
}

export function lootPlayerKilled(killer: ServerPlayer | null) {
  if (!killer) return;
  addCharmCharges(killer, "player");
  lootKillEffects(killer);
}

/** Per tick, after regen. */
export function lootTick(players: Iterable<ServerPlayer>) {
  for (const p of players) {
    if (lootStepPlayer(p)) H?.refresh(p);
    charmsTick(charmHost, p);
  }
}

// ---- messages ----------------------------------------------------------------------------------

/** { t: "craft", cur, target }: apply a currency / ichor / rune from the bag onto an item. */
export function handleCraft(p: ServerPlayer, msg: Record<string, unknown>) {
  if (!p.joined || !p.alive) return;
  const res = craft(p, msg.cur, msg.target);
  if (res.err) return H?.toast(p, res.err);
  if (res.equipped) H?.refresh(p);
  if (res.msg) H?.toast(p, res.msg);
}

/** { t: "charm", i }: fire charm slot i by hand. */
export function handleCharm(p: ServerPlayer, i: unknown) {
  if (!p.joined || typeof i !== "number") return;
  if (useCharmSlot(charmHost, p, i)) H?.refresh(p);
}

// ---- dev ---------------------------------------------------------------------------------------

/**
 * Dev: { t:"dev", cmd:"loot", what, id?, ilvl?, n?, rarity? } drops loot at the player.
 * what: currency | rune | essence | unique | charm | jewel | gear | all (one of every currency + samples).
 * bag: 1 = into the inventory grid instead of the floor.
 */
export function devLoot(p: ServerPlayer, msg: Record<string, unknown>) {
  if (!H) return;
  const ilvl = typeof msg.ilvl === "number" ? msg.ilvl : 12;
  const id = typeof msg.id === "string" ? msg.id : undefined;
  const n = Math.max(1, Math.min(30, typeof msg.n === "number" ? Math.round(msg.n) : 1));
  const rarity = (typeof msg.rarity === "number" ? Math.max(0, Math.min(2, Math.round(msg.rarity))) : 0) as Rarity;
  const out: Item[] = [];
  for (let i = 0; i < n; i++) {
    switch (msg.what) {
      case "currency":
        out.push(rollCurrency(ilvl, id));
        break;
      case "rune":
        out.push(rollRune(ilvl, id));
        break;
      case "essence":
        out.push(rollEssence(ilvl, id));
        break;
      case "unique": {
        const u = rollUnique(ilvl, id);
        if (u) out.push(u);
        break;
      }
      case "charm":
        out.push(rollCharm(ilvl, id, rarity > 0 ? 1 : 0));
        break;
      case "jewel":
        out.push(rollJewel(ilvl, rarity || 1, id));
        break;
      case "gear":
        out.push(rollItem(ilvl, rarity, id && BASE_BY_ID.has(id) ? id : undefined));
        break;
      case "all":
        for (const c of CURRENCY_BY_ID.keys()) out.push(rollCurrency(ilvl, c));
        break;
    }
  }
  // bag:1 puts them straight into the grid (falls back to the floor when full).
  for (const it of out) if (!(msg.bag && autoPlace(p, it))) H.dropItem(it, p.x, p.y, 60);
  if (msg.bag) p.invDirty = true;
}

/** Every id the dev command accepts (for docs / quick lookups). */
export const DEV_LOOT_IDS = {
  currency: [...CURRENCY_BY_ID.keys()],
  rune: [...RUNE_BY_ID.keys()],
  essence: [...ESSENCE_BY_ID.keys()],
  unique: [...UNIQUE_BY_ID.keys()],
  charm: [...CHARM_BY_ID.keys()],
  jewel: [...JEWEL_BASE_BY_ID.keys()],
};
