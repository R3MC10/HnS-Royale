// Loot effects (uniques / charms / blighted implicits, server/uniques.ts + lootsys.ts) as defence
// pipeline hooks (combat-systems), so they apply to every hit (melee, skills, spells, projectiles)
// exactly once. Previously called directly from combat.ts for melee only.
import { defenceHooks, type DefenceHook } from "./damage";
import { lootMeleeThorns, lootMonsterHit, lootOnAilment, lootOnDamageTypes, lootPlayerHit } from "./lootsys";
import type { ServerPlayer } from "./player";
import { lootKbMult, lootOutMult, lootTakenMult } from "./uniques";

const lootHook: DefenceHook = {
  takenMult: (p) => lootTakenMult(p),
  kbMult: (p) => lootKbMult(p),
  outMult: (by, t, vsPlayer) => lootOutMult(by, "stats" in t ? { hp: t.hp, maxHp: (t as ServerPlayer).stats.maxHp } : t, vsPlayer),
  afterHit(p, h, r) {
    if (r.outcome === "hit" || r.outcome === "deflected") {
      lootPlayerHit(p, r.dealt, h.by ?? null, false); // leech, chill-on-hit, charm triggers
      if (h.form !== "dot" && r.dealt > 0) lootOnDamageTypes(p, h.dmg); // elemental ward charms
    }
    // Thorns answer melee hits that connected (blocked included, as before).
    if (h.by && h.form === "melee" && (r.outcome === "hit" || r.outcome === "deflected" || r.outcome === "blocked")) lootMeleeThorns(h.by, p);
  },
  // Ailment charms (PoE2: "used when you become Frozen", ...).
  onAilment: (t, kind, isPlayer) => {
    if (isPlayer) lootOnAilment(t as ServerPlayer, kind);
  },
  afterMonsterHit: (by, _m, dealt, h) => {
    if (h.form !== "dot") lootMonsterHit(by, dealt);
  },
};

let wired = false;
export function wireDefenceLoot() {
  if (wired) return;
  wired = true;
  defenceHooks.push(lootHook);
}
