// Wires progression (passives / ascendancies) into the defence pipeline (combat-systems):
// progression reads and restores the one ES/barrier pool and routes its passive damage (novas,
// splash, roll strikes, thorns) through hitMonster / hitPlayer; its "when hit" passives run as a
// DefenceHook. Called once from Game's constructor.
import { defenceHooks, esMax, esOf, hitMonster, hitPlayer, legacySpec, restoreEs, type DamageHost, type DefenceHook } from "./damage";
import { wireDefenceLoot } from "./defloot";
import { progDefenceHooks, setProgAdapters } from "./progression";
import { setShrineHitter, shrinePvpHook } from "./ai/shrines";

let wired = false;

export function wireDefenceProgression(host: DamageHost) {
  // Shrine damage (Thornwake reflect, Stormcall bolts) through the pipeline: hit events, kill credit, gore.
  setShrineHitter((m, dmg, by, source) => {
    const storm = source === "Stormcall";
    void hitMonster(host, m, { dmg: storm ? { light: dmg } : { phys: dmg }, by, source, form: storm ? "spell" : "dot", x: by.x, y: by.y, kb: storm ? 60 : 0, crit: false });
  });
  if (!defenceHooks.includes(shrinePvpHook)) defenceHooks.push(shrinePvpHook); // Ironbark / Emberheart in PvP
  setProgAdapters({
    esOf,
    esMax,
    restoreEs,
    // Passive damage: progression's numbers are already final (post-PvP, like damagePlayer's input).
    hitMonster: (m, dmg, by, source, x, y) => void hitMonster(host, m, { dmg: { phys: dmg }, by, source, form: "dot", x, y }),
    hitPlayer: (t, dmg, by, source, x, y) => void hitPlayer(host, t, legacySpec(dmg, x, y, 0, by, source, { form: "dot", unblockable: true }, t.x, t.y)),
  });
  if (!wired) {
    wired = true;
    defenceHooks.push(progDefenceHooks as unknown as DefenceHook);
  }
  wireDefenceLoot(); // uniques / charms as defence hooks (server/defloot.ts)
}
