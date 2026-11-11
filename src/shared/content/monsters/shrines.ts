// Guarded buff shrines (world places "buff" POIs; server/ai/shrines.ts guards and runs them).
// Kill the guardian pack, then step onto the shrine for a 45 s buff. All names are original.

export interface ShrineDef {
  id: string;
  name: string;
  desc: string;
  color: string;
  moveSpeed?: number; // multiplier
  regen?: number; // fraction of max life per second
  dmgTaken?: number; // multiplier on monster damage taken (PvP via combat-systems hook)
  dmgDealt?: number; // multiplier on damage dealt to monsters (PvP via combat-systems hook)
  thorns?: number; // fraction of monster hit damage reflected
  extraLoot?: number; // extra drop rolls per monster kill
  veil?: boolean; // monsters don't notice you
  stormcall?: { every: number; radius: number; dmg: number }; // lightning strikes nearby monsters
}

export const SHRINE_DURATION = 45;
export const SHRINE_RANGE = 46;
/** Guardian pack: this many monsters, one of them magic or better. */
export const SHRINE_GUARDS: [number, number] = [4, 6];

export const SHRINES: ShrineDef[] = [
  { id: "galestep", name: "Galestep Shrine", desc: "30% faster movement", color: "#9ae0ff", moveSpeed: 1.3 },
  { id: "bloodroot", name: "Bloodroot Shrine", desc: "Regenerate 5% life per second", color: "#ff5a6a", regen: 0.05 },
  { id: "ironbark", name: "Ironbark Shrine", desc: "Take 35% less damage", color: "#c0b090", dmgTaken: 0.65 },
  { id: "emberheart", name: "Emberheart Shrine", desc: "Deal 50% more damage", color: "#ff8a2a", dmgDealt: 1.5 },
  { id: "magpie", name: "Magpie Shrine", desc: "Monsters you slay drop an extra item", color: "#ffe066", extraLoot: 1 },
  { id: "thornwake", name: "Thornwake Shrine", desc: "Reflect 40% of monster hit damage", color: "#a0d040", thorns: 0.4 },
  { id: "veilshroud", name: "Veilshroud Shrine", desc: "Monsters do not notice you", color: "#b0a0ff", veil: true },
  { id: "stormcall", name: "Stormcall Shrine", desc: "Lightning strikes nearby monsters", color: "#80c8ff", stormcall: { every: 1.2, radius: 320, dmg: 18 } },
];

export const SHRINE_BY_ID = new Map(SHRINES.map((s) => [s.id, s]));
