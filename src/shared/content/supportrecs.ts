// Recommended support links (PoE2-style "recommended supports" per skill). Pure data: the ranking
// (shared/skills.ts rankSupports) adds a curated pick from SKILL_SUPPORT_RECS to a tag-fit score from
// SUPPORT_TAG_WEIGHT, and only ever offers supports that can actually link (supportRefusal).
import type { SkillTag } from "./gems";

/** Curated best links per skill gem id, best first (meta gems: none, their spell's list is used). */
export const SKILL_SUPPORT_RECS: Record<string, string[]> = {
  sundering_blow: ["heavy_hand", "bloodthirst", "quickened_rite", "cindertouch"],
  faultline_slam: ["broadened_ruin", "heavy_hand", "cindertouch", "bloodthirst"],
  splinter_volley: ["scattershot", "arcing_link", "heavy_hand", "rimebite"],
  cinderbolt: ["cindertouch", "scattershot", "arcing_link", "heavy_hand"],
  frostgale: ["rimebite", "broadened_ruin", "heavy_hand", "quickened_rite"],
  stormthread: ["arcing_link", "broadened_ruin", "heavy_hand", "frugal_sigil"],
  shadow_lunge: ["swift_recall", "quickened_rite", "frugal_sigil"],
  ember_pact: ["swift_recall", "frugal_sigil", "quickened_rite"],
  pyre_effigy: ["swift_recall", "scattershot", "cindertouch", "heavy_hand"],
  reaping_whirl: ["broadened_ruin", "bloodthirst", "heavy_hand", "quickened_rite"],
  glacial_lance: ["rimebite", "arcing_link", "scattershot", "heavy_hand"],
  galeshot_barrage: ["scattershot", "heavy_hand", "arcing_link", "bloodthirst"],
  bulwark_stance: ["swift_recall", "frugal_sigil", "quickened_rite"],
  hoarfrost_snare: ["rimebite", "broadened_ruin", "swift_recall", "heavy_hand"],
  wheeling_glaive: ["arcing_link", "heavy_hand", "bloodthirst", "scattershot"],
  stormcall_sigil: ["broadened_ruin", "heavy_hand", "quickened_rite", "frugal_sigil"],
  stormvault: ["broadened_ruin", "heavy_hand", "swift_recall", "bloodthirst"],
  opening_cut: ["heavy_hand", "quickened_rite", "bloodthirst", "cindertouch"],
  hazeward_sweep: ["heavy_hand", "rimebite", "bloodthirst", "quickened_rite"],
  riposte_arc: ["heavy_hand", "bloodthirst", "quickened_rite"],
  rending_chop: ["broadened_ruin", "heavy_hand", "bloodthirst"],
  longreach_thrust: ["heavy_hand", "quickened_rite", "bloodthirst"],
  smoke_step: ["swift_recall", "frugal_sigil"],
  pinning_shot: ["scattershot", "arcing_link", "heavy_hand"],
  kindling_spark: ["cindertouch", "scattershot", "arcing_link"],
};

/** How much each support likes a skill tag (tag-fit part of the score; unknown tags count 0). */
export const SUPPORT_TAG_WEIGHT: Record<string, Partial<Record<SkillTag, number>>> = {
  heavy_hand: { attack: 2, spell: 2, physical: 1 },
  scattershot: { projectile: 3 },
  quickened_rite: { attack: 1, spell: 1, melee: 1 },
  broadened_ruin: { area: 3, chain: 2, slam: 1 },
  cindertouch: { fire: 3, physical: 1, attack: 1 },
  arcing_link: { chain: 3, projectile: 2, lightning: 1 },
  bloodthirst: { attack: 2, melee: 2 },
  frugal_sigil: { spell: 1, buff: 1 },
  rimebite: { cold: 3, area: 1 },
  swift_recall: { movement: 2, totem: 3, duration: 2, buff: 2 },
};

/** Score weights: a curated pick at rank r adds CURATED_TOP - r * CURATED_STEP. */
export const REC_SCORE = { CURATED_TOP: 10, CURATED_STEP: 2, TIER: 1 } as const;
