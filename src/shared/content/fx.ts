// Special (non-Stats) effects granted by uniques, runes, corruption and charms. These do not map
// onto a Stats field; the server applies them in combat (server/uniques.ts). Labels are shown in
// tooltips. All wording is original.

export type FxKey =
  | "leech" // % of attack damage dealt recovered as life
  | "thorns" // flat damage reflected to a player who hits you in melee
  | "dmgTakenRed" // % less damage taken (stacks additively, capped)
  | "takenMore" // % more damage taken (drawback)
  | "lowLifeMore" // % more damage while you are on low life
  | "executeMore" // % more damage against targets on low life
  | "fullLifeMore" // % more damage against targets at full life
  | "killHeal" // recover % of max life on kill
  | "killHaste" // % increased move speed for a few seconds after a kill
  | "dodgeMore" // % more attack damage for a short time after a dodge roll
  | "chillOnHit" // hits slow players by % for a short time
  | "kbImmune" // cannot be knocked back
  | "slowImmune" // unaffected by slows (charm buff)
  | "pvpMore" // % more damage against players
  | "pveMore" // % more damage against monsters
  | "charmSlots" // + charm slots (belt/unique)
  | "charmGain" // % increased charm charges gained
  | "hasteBuff" // % increased move speed (charm buff)
  | "regenBuff" // life per second (charm buff)
  // ---- itemization pass: PoE2 charm buffs and unique build-definers ----
  | "freezeImmune" // cannot be frozen (charm buff / unique)
  | "igniteImmune" // cannot be ignited
  | "shockImmune" // cannot be shocked
  | "bleedImmune" // cannot bleed or be poisoned
  | "stunImmune" // cannot be stunned or electrocuted
  | "resFireBuff" // + % fire resistance (charm buff)
  | "resColdBuff" // + % cold resistance (charm buff)
  | "resLightBuff" // + % lightning resistance (charm buff)
  | "resChaosBuff" // + % chaos resistance (charm buff)
  | "armourBuff" // % increased armour (charm buff)
  | "speedBuff" // % increased attack speed (charm buff)
  | "esOnKill" // recover % of maximum energy shield on kill
  | "manaOnKill" // recover % of maximum mana on kill
  | "lowLifeTakenRed" // % less damage taken while on low life
  | "flaskChargeRegen" // flask charges gained per second (belts / uniques)
  | "charmChargeRegen" // charm charges gained per second
  | "flaskInstant"; // % of life flask recovery applied instantly (belts / uniques)

export const FX_LABELS: Record<FxKey, string> = {
  leech: "{v}% of Attack Damage dealt is regained as Life",
  thorns: "Reflects {v} Damage to players who strike you in melee",
  dmgTakenRed: "{v}% less Damage taken",
  takenMore: "{v}% more Damage taken",
  lowLifeMore: "{v}% more Damage while on Low Life",
  executeMore: "{v}% more Damage against enemies on Low Life",
  fullLifeMore: "{v}% more Damage against enemies at full Life",
  killHeal: "Recover {v}% of maximum Life on Kill",
  killHaste: "{v}% increased Movement Speed for 4s after a Kill",
  dodgeMore: "{v}% more Attack Damage for 2s after a Dodge Roll",
  chillOnHit: "Your Hits slow players by {v}% for 1.5s",
  kbImmune: "Cannot be Knocked Back",
  slowImmune: "Unaffected by Slows",
  pvpMore: "{v}% more Damage against players",
  pveMore: "{v}% more Damage against monsters",
  charmSlots: "+{v} Charm Slot",
  charmGain: "{v}% increased Charm Charges gained",
  hasteBuff: "{v}% increased Movement Speed",
  regenBuff: "Regenerate {v} Life per second",
  freezeImmune: "Cannot be Frozen",
  igniteImmune: "Cannot be Ignited",
  shockImmune: "Cannot be Shocked",
  bleedImmune: "Cannot Bleed or be Poisoned",
  stunImmune: "Cannot be Stunned or Electrocuted",
  resFireBuff: "+{v}% to Fire Resistance",
  resColdBuff: "+{v}% to Cold Resistance",
  resLightBuff: "+{v}% to Lightning Resistance",
  resChaosBuff: "+{v}% to Chaos Resistance",
  armourBuff: "{v}% increased Armour",
  speedBuff: "{v}% increased Attack Speed",
  esOnKill: "Recover {v}% of maximum Energy Shield on Kill",
  manaOnKill: "Recover {v}% of maximum Mana on Kill",
  lowLifeTakenRed: "{v}% less Damage taken while on Low Life",
  flaskChargeRegen: "Flasks gain {v} Charges per second",
  charmChargeRegen: "Charms gain {v} Charges per second",
  flaskInstant: "{v}% of Life Flask Recovery is applied Instantly",
};

export const FX_KEYS = Object.keys(FX_LABELS) as FxKey[];
export const isFxKey = (k: string): k is FxKey => k in FX_LABELS;

/** "Low life" threshold (fraction of max life), PoE-style 35%. */
export const LOW_LIFE = 0.35;
/** Caps so stacked reductions never make a player unkillable. */
export const MAX_DMG_TAKEN_RED = 40;
export const KILL_HASTE_TIME = 4;
export const DODGE_BUFF_TIME = 2;
export const CHILL_ON_HIT_TIME = 1.5;
export const MAX_LEECH = 15;
