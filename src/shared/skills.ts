// Skill bar, gem items and final skill numbers, shared by server (execution, validation) and
// client (bar, tooltips, mana greying). PoE2-style: skill gems sit in the skill bar and support
// gems sit in the skill gem's sockets. See content/gems.ts for the rules.
import { BASE_BY_ID, UNARMED } from "./content/bases";
import {
  ATTR_COLOR,
  ATTR_NAME,
  BASE_SOCKETS,
  CUTTABLE_SKILLS,
  CUTTABLE_SPIRIT,
  displayTags,
  GEM_MAX_LEVEL,
  innateFor,
  isSpiritDef,
  MAX_SOCKETS,
  ROUGH_NAMES,
  ROUGH_SKILL,
  ROUGH_SPIRIT,
  ROUGH_SUPPORT,
  SKILL_GEM_BY_ID,
  SKILL_GEM_PREFIX,
  SUPPORT_ATTR_REQ,
  SUPPORT_GEM_BY_ID,
  SUPPORT_GEM_PREFIX,
  SUPPORT_GEMS,
  SUPPORT_MAX_TIER,
  type Attr,
  type SkillGemDef,
  type SkillKind,
  type SkillTag,
  type SupportGemDef,
  weaponReqText,
} from "./content/gems";
import { REC_SCORE, SKILL_SUPPORT_RECS, SUPPORT_TAG_WEIGHT } from "./content/supportrecs";
import type { WeaponProps } from "./content/types";
import { registerItemKind } from "./grid";
import type { Item } from "./items";
import type { Stats } from "./stats";

// ---- key bindings (defaults; the client reads client/keybinds.ts) -------------------

/**
 * Default skill bar keys. Slots 0-7 are the main bar; slots 8-15 use the same keys while holding
 * Ctrl, like PoE2's second bar. client/keybinds.ts owns the live, rebindable table.
 */
export const SKILL_KEYS: { code: string; label: string }[] = [
  { code: "Mouse0", label: "LMB" },
  { code: "Mouse1", label: "MMB" },
  { code: "Mouse2", label: "RMB" },
  { code: "KeyQ", label: "Q" },
  { code: "KeyE", label: "E" },
  { code: "KeyR", label: "R" },
  { code: "KeyT", label: "T" },
  { code: "KeyG", label: "G" },
];
export const SECONDARY_MOD = { codes: ["ControlLeft", "ControlRight"], label: "Ctrl" };
export const BAR_MAIN = SKILL_KEYS.length; // 8
export const BAR_SIZE = BAR_MAIN * 2; // 16
/** Slot 0 (LMB) falls back to the basic weapon attack while it holds no skill gem. */
export const BASIC_SLOT = 0;
/** Slot 1 (MMB) shows the equipped weapon's own skill while it holds no skill gem. */
export const WEAPON_SKILL_SLOT = 1;

export function slotLabel(i: number): string {
  const k = SKILL_KEYS[i % BAR_MAIN]?.label ?? "?";
  return i >= BAR_MAIN ? `${SECONDARY_MOD.label}+${k}` : k;
}

// ---- gem items ----------------------------------------------------------------

/** Narrowing brand for the gem guards (a plain `it is Item` would narrow non-gems to never). */
export type GemItem = Item & { readonly __gem: 1 };

export const isSkillGem = (it: Item | null | undefined): it is GemItem => !!it && it.b.startsWith(SKILL_GEM_PREFIX) && SKILL_GEM_BY_ID.has(it.b.slice(SKILL_GEM_PREFIX.length));
export const isSupportGem = (it: Item | null | undefined): it is GemItem => !!it && it.b.startsWith(SUPPORT_GEM_PREFIX) && SUPPORT_GEM_BY_ID.has(it.b.slice(SUPPORT_GEM_PREFIX.length));
export const isRough = (it: Item | null | undefined): it is GemItem => !!it && it.b in ROUGH_NAMES;
export const isGem = (it: Item | null | undefined): it is GemItem => isSkillGem(it) || isSupportGem(it) || isRough(it);
export const skillDefOf = (it: Item | null | undefined): SkillGemDef | undefined => (isSkillGem(it) ? SKILL_GEM_BY_ID.get(it.b.slice(SKILL_GEM_PREFIX.length)) : undefined);
export const supportDefOf = (it: Item | null | undefined): SupportGemDef | undefined => (isSupportGem(it) ? SUPPORT_GEM_BY_ID.get(it.b.slice(SUPPORT_GEM_PREFIX.length)) : undefined);

// Gems and crystals are 1x1 grid items that never go into gear slots.
registerItemKind({ category: "gem", matches: (it) => isGem(it), footprint: { w: 1, h: 1 } });

export function gemLevel(it: Item): number {
  // A corrupted gem can sit one level above the normal maximum (Blighted Ember, PoE2 corruption).
  return Math.max(1, Math.min(GEM_MAX_LEVEL + (it.x ? 1 : 0), Math.round(it.l || 1)));
}

/** PoE2 gem quality: every 2% quality is 1% more damage (Lapidary's Polish; corruption may push it to 23%). */
export function gemQualityMore(it: Item | null | undefined): number {
  return 1 + Math.max(0, it?.q ?? 0) / 200;
}

/** "Tags: Attack, Melee, Strike, Physical, Mace" (PoE2 order; weapon class last). */
export function tagLine(d: SkillGemDef, tags?: readonly SkillTag[]): string {
  return `Tags: ${displayTags(d, tags).join(", ")}`;
}

/** Why the active weapon set can't use this skill (null = it can). PoE2: attacks are bound to weapon classes. */
export function weaponRefusal(d: SkillGemDef, wk: string | null | undefined): string | null {
  if (!d.weapons?.length || (wk && d.weapons.includes(wk))) return null;
  return `Requires: ${weaponReqText(d)}`;
}
export function supportTier(it: Item): number {
  return Math.max(1, Math.min(SUPPORT_MAX_TIER, Math.round(it.l || 1)));
}
export const TIER_NAMES = ["I", "II", "III"];

/** Support sockets a skill gem offers (2, raised by the gem-socket currency via `gs`, max 5). */
export function socketCount(gem: Item | null): number {
  if (!gem) return 0;
  return Math.min(MAX_SOCKETS, Math.max(BASE_SOCKETS, (gem as { gs?: number }).gs ?? 0));
}

/** Gem colour = its attribute (red Str, green Dex, blue Int); rough crystals are grey. */
export function gemAttr(it: Item): Attr | null {
  return skillDefOf(it)?.attr ?? supportDefOf(it)?.attr ?? null;
}
export function gemColor(it: Item): string {
  const a = gemAttr(it);
  return a ? ATTR_COLOR[a] : "#b0c0c0";
}

export function gemDisplayName(it: Item): string {
  const sp = supportDefOf(it);
  if (sp) return `${sp.name} ${TIER_NAMES[supportTier(it) - 1]}`;
  if (isRough(it)) return `${ROUGH_NAMES[it.b]} (Level ${Math.round(it.l)})`;
  return skillDefOf(it)?.name ?? (it as Item).n;
}

/** What a rough crystal can be cut into. */
export function cutOptions(rough: Item): { id: string; name: string; ok: boolean; why?: string }[] {
  if (rough.b === ROUGH_SUPPORT) return SUPPORT_GEMS.map((s) => ({ id: s.id, name: `${s.name} ${TIER_NAMES[supportTier(rough) - 1]}`, ok: true }));
  const list = rough.b === ROUGH_SPIRIT ? CUTTABLE_SPIRIT : rough.b === ROUGH_SKILL ? CUTTABLE_SKILLS : [];
  return list.map((d) => ({ id: d.id, name: d.name, ok: d.tier <= rough.l, why: d.tier > rough.l ? `needs a level ${d.tier} crystal` : undefined }));
}

/** Can rough crystal `rough` raise `gem` (same family, higher level)? null = yes. */
export function upgradeRefusal(rough: Item, gem: Item): string | null {
  const d = skillDefOf(gem);
  if (!d || d.innate) return "Only skill and spirit gems can be raised";
  if (gem.x) return "Corrupted gems can't be raised";
  if (rough.b !== (isSpiritDef(d) ? ROUGH_SPIRIT : ROUGH_SKILL)) return `Needs a ${isSpiritDef(d) ? "spirit" : "skill"} crystal`;
  if (rough.l <= gemLevel(gem)) return `The crystal must be above level ${gemLevel(gem)}`;
  return null;
}

/** Tooltip lines for a gem item (shown under the name). */
export function gemLines(it: Item, attrs?: Attrs): string[] {
  const sk = skillDefOf(it);
  if (sk) {
    const out = [`${isSpiritDef(sk) ? "Spirit gem" : sk.innate ? "Weapon skill" : "Skill gem"} · Level ${gemLevel(it)} · ${ATTR_NAME[sk.attr]}`, tagLine(sk)];
    const req = weaponReqText(sk);
    if (req) out.push(`Requires: ${req}`);
    out.push(sk.desc);
    if (sk.spirit) out.push(`Reserves ${sk.spirit} Spirit while on`);
    else out.push(`Mana cost ${Math.round(levelCost(sk, gemLevel(it)))}${sk.cd ? ` · Cooldown ${sk.cd}s` : ""}`);
    if (it.q) out.push(`Quality: +${it.q}% (${Math.round((gemQualityMore(it) - 1) * 100)}% more damage)`);
    out.push(`Support sockets: ${socketCount(it)} / ${MAX_SOCKETS}`);
    if (it.x) out.push("Corrupted");
    return out;
  }
  const sp = supportDefOf(it);
  if (sp) {
    const t = supportTier(it);
    const req = SUPPORT_ATTR_REQ[t - 1];
    const have = attrs?.[sp.attr];
    const out = [`Support gem · Tier ${TIER_NAMES[t - 1]}`, supportSummary(supportAt(sp, t))];
    out.push(`Cost multiplier ${Math.round(supportAt(sp, t).costMult * 100)}%`);
    out.push(sp.needs.length ? `Supports: ${sp.needs.join(" or ")} skills` : "Supports any skill");
    if (sp.excludes?.length) out.push(`Cannot support: ${sp.excludes.join(", ")}`);
    if (req > 0) out.push(`${have !== undefined && have < req ? "! " : ""}Requires ${req} ${ATTR_NAME[sp.attr]}${have !== undefined ? ` (you have ${Math.floor(have)})` : ""}`);
    out.push("Only one of each support can be socketed");
    return out;
  }
  if (isRough(it)) {
    if (it.b === ROUGH_SUPPORT) return [`Tier ${TIER_NAMES[supportTier(it) - 1]}`, "Right-click it (or open the Skills panel) and cut it into any support gem of this tier."];
    const fam = it.b === ROUGH_SPIRIT ? "spirit" : "skill";
    return [
      `Level ${Math.round(it.l)}`,
      `Right-click it (or open the Skills panel) and cut it into any ${fam} gem of tier ${Math.round(it.l)} or lower,`,
      `or use it to raise an owned ${fam} gem to level ${Math.round(it.l)}.`,
    ];
  }
  return [];
}

// ---- supports by tier ----------------------------------------------------------------

/** Support values at a tier: tiers II/III boost the upside and soften the downside. */
export function supportAt(s: SupportGemDef, tier: number): SupportGemDef {
  if (tier <= 1) return s;
  const up = tier === 2 ? 1.4 : 1.8;
  const down = tier === 2 ? 0.8 : 0.6;
  const scale = (v: number | undefined) => (v === undefined ? undefined : v >= 1 ? 1 + (v - 1) * up : 1 - (1 - v) * down);
  return {
    ...s,
    more: scale(s.more),
    speed: scale(s.speed),
    area: scale(s.area),
    cdr: scale(s.cdr),
    dur: scale(s.dur),
    costMult: s.costMult < 1 ? 1 - (1 - s.costMult) * up : s.costMult,
    proj: s.proj !== undefined ? s.proj + (tier === 3 ? 1 : 0) : undefined,
    chain: s.chain !== undefined ? s.chain + (tier === 3 ? 1 : 0) : undefined,
    ignite: s.ignite !== undefined ? s.ignite * up : undefined,
    chill: s.chill !== undefined ? s.chill * up : undefined,
    leech: s.leech !== undefined ? s.leech * up : undefined,
  };
}

const pct = (m: number) => `${Math.round(Math.abs(m - 1) * 100)}% ${m >= 1 ? "more" : "less"}`;
export function supportSummary(s: SupportGemDef): string {
  const p: string[] = [];
  if (s.more !== undefined) p.push(`${pct(s.more)} damage`);
  if (s.speed !== undefined) p.push(`${pct(s.speed)} use speed`);
  if (s.area !== undefined) p.push(`${pct(s.area)} area`);
  if (s.proj) p.push(`+${s.proj} projectiles`);
  if (s.chain) p.push(`+${s.chain} chains`);
  if (s.ignite) p.push(`ignite for ${Math.round(s.ignite * 100)}% of the hit`);
  if (s.chill) p.push(`chill ${s.chill.toFixed(1)}s`);
  if (s.leech) p.push(`${Math.round(s.leech * 100)}% life leech`);
  if (s.cdr !== undefined) p.push(`${pct(s.cdr)} cooldown recovery`);
  if (s.dur !== undefined) p.push(`${pct(s.dur)} duration`);
  return p.join(", ");
}

// ---- bar ------------------------------------------------------------------------

export interface BarSlot {
  gem: Item | null; // skill or spirit gem
  sups: (Item | null)[]; // support gems in the skill's sockets (length = socketCount(gem), max 5)
  /** Meta gems only: the spell socketed into it (the supports apply to this spell). */
  inner?: Item | null;
}

export interface Attrs {
  str: number;
  dex: number;
  int: number;
}

export function emptyBar(): BarSlot[] {
  return Array.from({ length: BAR_SIZE }, () => ({ gem: null, sups: [] }));
}

/** Skill gems on the bar (meta-socketed spells included), for the 9-gem cap and the no-duplicates rule. */
export function barSkillIds(bar: BarSlot[], exceptSlot = -1): string[] {
  const out: string[] = [];
  bar.forEach((s, i) => {
    if (i === exceptSlot) return;
    const d = skillDefOf(s.gem);
    if (d) out.push(d.id);
    const n = skillDefOf(s.inner);
    if (n) out.push(n.id);
  });
  return out;
}

/** Can this skill gem go into a meta gem? null = yes. */
export function metaRefusal(inner: SkillGemDef): string | null {
  if (!inner.tags.includes("spell")) return `${inner.name} is not a spell`;
  if (inner.tags.some((t) => t === "movement" || t === "buff" || t === "persistent" || t === "meta" || t === "totem")) return `${inner.name} can't be triggered`;
  return null;
}

/** Why a support can't link to a skill (null = it can). */
export function supportRefusal(sup: SupportGemDef, skill: SkillGemDef, others: (SupportGemDef | undefined)[] = []): string | null {
  if (sup.excludes?.some((t) => skill.tags.includes(t))) return `${sup.name} can't support ${skill.name}`;
  if (sup.needs.length && !sup.needs.some((t) => skill.tags.includes(t))) return `${sup.name} only fits ${sup.needs.join(" / ")} skills (${skill.name} is ${skill.tags.join(", ")})`;
  if (others.some((o) => o?.id === sup.id)) return `${skill.name} already has ${sup.name}`;
  return null;
}

/** One support's place in a skill's recommended list. */
export interface SupportRec {
  def: SupportGemDef;
  score: number;
  /** In the skill's curated list (content/supportrecs.ts). */
  curated: boolean;
}

/**
 * PoE2 "recommended supports" for a skill: every support that can link to it (supportRefusal ok,
 * ignoring duplicates), best first. Score = curated rank + tag fit (data in content/supportrecs.ts).
 */
export function rankSupports(skill: SkillGemDef): SupportRec[] {
  const cur = SKILL_SUPPORT_RECS[skill.id] ?? [];
  const out: SupportRec[] = [];
  for (const s of SUPPORT_GEMS) {
    if (supportRefusal(s, skill)) continue;
    const r = cur.indexOf(s.id);
    let score = r >= 0 ? REC_SCORE.CURATED_TOP - r * REC_SCORE.CURATED_STEP : 0;
    const w = SUPPORT_TAG_WEIGHT[s.id] ?? {};
    for (const t of skill.tags) score += w[t] ?? 0;
    out.push({ def: s, score, curated: r >= 0 });
  }
  return out.sort((a, b) => b.score - a.score || a.def.name.localeCompare(b.def.name));
}

/**
 * The slot as it is used: slot 1 (MMB) without a gem holds the equipped weapon's own skill, with a
 * virtual gem (id -1) whose level follows the weapon's item level. It disappears with the weapon.
 */
export function effectiveSlot(bar: BarSlot[], i: number, mainhand: Item | null | undefined): BarSlot | null {
  const s = bar[i];
  if (!s) return null;
  if (s.gem || i !== WEAPON_SKILL_SLOT || !mainhand) return s;
  const d = innateFor(weaponOf(mainhand).kind);
  if (!d) return s;
  const lv = Math.max(1, Math.min(GEM_MAX_LEVEL, Math.ceil((mainhand.l || 1) / 2)));
  return { gem: { id: -1, b: SKILL_GEM_PREFIX + d.id, r: 0, l: lv, n: d.name, m: [] } as Item, sups: [] };
}

// ---- final numbers ----------------------------------------------------------------

/**
 * PoE2 "+N to Level of all <tag> Skills" from gear (Stats lvl* fields, content/affixes.ts). Spell /
 * melee / projectile bonuses stack; elemental ones apply to spells of that element.
 */
export function gearLevelBonus(tags: readonly string[], st: Readonly<Stats>): number {
  const has = (t: string) => tags.includes(t);
  let n = 0;
  if (has("spell")) {
    n += st.lvlSpell ?? 0;
    if (has("fire")) n += st.lvlFire ?? 0;
    if (has("cold")) n += st.lvlCold ?? 0;
    if (has("lightning")) n += st.lvlLight ?? 0;
  }
  if (has("melee")) n += st.lvlMelee ?? 0;
  if (has("projectile")) n += st.lvlProj ?? 0;
  return Math.max(0, Math.round(n));
}

/** Everything needed to use one bar slot, after gem level, supports, stats and weapon. */
export interface SkillAction {
  id: string; // skill id, "" = basic weapon attack
  name: string;
  kind: SkillKind | "basic";
  level: number;
  tags: SkillTag[];
  ok: boolean; // usable with the current weapon
  why?: string;
  attack: boolean;
  cost: number;
  time: number; // full use time, s
  commit: number;
  cd: number;
  move: number;
  dmg: number; // per hit, before the PvP multiplier
  reach: number;
  arc: number; // radians
  radius: number;
  speed: number;
  range: number;
  count: number;
  spread: number; // radians between projectiles
  chain: number; // added chains
  ignite: number;
  chill: number;
  leech: number;
  kb: number;
  buff?: { dur: number; more: number; move: number };
  totem?: { dur: number; rate: number; place: number };
  aura?: { more: number; move: number; regen: number };
  /** Projectiles pass through what they hit / fly back to the user at the end of their flight. */
  pierce?: boolean;
  returns?: boolean;
  /** Held use speeds up: use time multiplier per consecutive use and its floor. */
  ramp?: { step: number; min: number };
  guard?: { dur: number; less: number };
  zone?: { place: number; delay: number; dur: number; trig: number; max: number };
  spirit: number; // reserved while on
  /** Meta gems: the socketed spell (null = empty) and energy per distance rolled. */
  inner?: SkillAction | null;
  meta?: { perDist: number };
  innate: boolean;
  /** Damage type of the hit, from the skill gem's own tags (supports that add burn / chill don't convert it). */
  elem?: "fire" | "cold" | "lightning";
  color: string;
  supports: { id: string; name: string; ok: boolean; why?: string }[];
}

export function levelCost(def: SkillGemDef, level: number): number {
  return def.cost * (1 + 0.06 * (level - 1));
}

export function weaponOf(mainhand: Item | null | undefined): WeaponProps {
  return (mainhand && BASE_BY_ID.get(mainhand.b)?.weapon) || UNARMED;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Bows and crossbows fire a projectile for their basic attack (`ranged: true` on WeaponProps also works). */
export function isRangedWeapon(w: WeaponProps): boolean {
  return (w as { ranged?: boolean }).ranged === true || w.kind === ("bow" as string) || w.kind === ("crossbow" as string);
}

/** Arrow speed/range of a ranged weapon's basic attack. */
export const BASIC_ARROW = { speed: 760, range: 560 };

function basicAction(st: Readonly<Stats>, w: WeaponProps): SkillAction {
  const ranged = isRangedWeapon(w);
  return {
    id: "", name: ranged ? "Loose Arrow" : "Weapon Strike", kind: "basic", level: 1, tags: ranged ? ["attack", "projectile"] : ["attack", "melee"],
    ok: true, attack: true, cost: 0, time: st.swingTime, commit: 0.5, cd: 0, move: st.swingMoveMult, dmg: r1(st.attackDamage),
    reach: st.attackRange, arc: st.attackArc, radius: 0, speed: BASIC_ARROW.speed, range: BASIC_ARROW.range, count: 1, spread: 0,
    chain: 0, ignite: 0, chill: 0, leech: 0, kb: st.knockback, spirit: 0, innate: false, color: "#e8e0d0", supports: [],
  };
}

/**
 * Resolve one bar slot into final numbers. Supports that don't fit the skill, or whose attribute
 * requirement isn't met (`attrs` given), are listed with ok=false and ignored.
 */
export function computeSkill(slot: BarSlot | null | undefined, st: Readonly<Stats>, w: WeaponProps, armed: boolean, attrs?: Attrs): SkillAction {
  const def = skillDefOf(slot?.gem);
  if (!slot || !def) return basicAction(st, w);
  if (def.kind === "meta") {
    const innerDef = skillDefOf(slot.inner);
    const inner = innerDef && !metaRefusal(innerDef) ? computeSkill({ gem: slot.inner!, sups: slot.sups }, st, w, armed, attrs) : null;
    const lv = gemLevel(slot.gem!);
    return {
      ...basicAction(st, w), id: def.id, name: def.name, kind: "meta", level: lv, tags: [...def.tags], attack: false, cost: 0, time: def.time,
      commit: def.commit, cd: def.cd, move: def.move, dmg: 0, spirit: def.spirit ?? 0, innate: false, color: def.color,
      inner, meta: { perDist: (def.meta?.perDist ?? 1) * (1 + 0.05 * (lv - 1)) }, supports: inner?.supports ?? [],
      ok: !!inner, why: inner ? undefined : "Socket a spell into it",
    };
  }
  const level = gemLevel(slot.gem!) + gearLevelBonus(def.tags, st); // + gear "+N to Level of all X Skills"
  const quality = gemQualityMore(slot.gem); // Lapidary's Polish: 1% more damage per 2% quality
  const sdefs = slot.sups.map((s) => supportDefOf(s));
  const supports: SkillAction["supports"] = [];
  const tags = [...def.tags];
  let more = 1, costM = 1, speed = 1, area = 1, proj = 0, chain = 0, ignite = 0, chill = def.chill ?? 0, leech = 0, cdr = 1, dur = 1;
  sdefs.forEach((s0, i) => {
    if (!s0) return;
    const tier = supportTier(slot.sups[i]!);
    const s = supportAt(s0, tier);
    let why = supportRefusal(s0, def, sdefs.slice(0, i)) ?? undefined;
    const req = SUPPORT_ATTR_REQ[tier - 1];
    if (!why && attrs && attrs[s0.attr] < req) why = `needs ${req} ${ATTR_NAME[s0.attr]}`;
    supports.push({ id: s0.id, name: `${s0.name} ${TIER_NAMES[tier - 1]}`, ok: !why, why });
    if (why) return;
    costM *= s.costMult;
    more *= s.more ?? 1;
    speed *= s.speed ?? 1;
    area *= s.area ?? 1;
    proj += s.proj ?? 0;
    chain += s.chain ?? 0;
    ignite += s.ignite ?? 0;
    if (s.chill) chill = chill > 0 ? chill + s.chill * 0.5 : s.chill; // a skill that already chills: longer, never a dead link
    leech += s.leech ?? 0;
    cdr *= s.cdr ?? 1;
    dur *= s.dur ?? 1;
    for (const t of s.addTags ?? []) if (!tags.includes(t)) tags.push(t);
  });

  const attack = def.tags.includes("attack");
  const wk: string | null = armed ? w.kind : null;
  // PoE2: weapon-bound skills need that weapon class in the ACTIVE weapon set (equip.mainhand after a swap).
  const why = weaponRefusal(def, wk) ?? undefined;
  const ok = !why;
  const lv = level - 1;
  const base = attack ? st.attackDamage * (def.dmg + 0.04 * lv) : def.dmg * Math.pow(1.13, lv) * st.spellMult;
  const time = (attack ? st.swingTime * def.time : def.time / (st.castSpeed || 1)) / speed;
  const sqA = Math.sqrt(area);
  let reach = def.reach ?? 0;
  const arc = ((def.arcDeg ?? 0) * Math.PI) / 180;
  if (def.kind === "strike") reach = st.attackRange + (def.reach ?? 0);
  if (def.kind === "cone") reach *= sqA;
  if (def.kind === "slam") reach = st.attackRange * 0.5 + (def.reach ?? 0);
  if (def.kind === "blast" || def.kind === "trap") reach = def.zone?.place ?? 0;
  // spin: the blade's sweep around the user (weapon reach + the gem's bonus), grown by area supports
  const radius = def.kind === "spin" ? (st.attackRange + (def.reach ?? 0)) * sqA : (def.radius ?? 0) * (def.kind === "totem" ? 1 : sqA);
  const auraScale = 1 + 0.1 * lv; // +10% of the value per level
  return {
    id: def.id,
    name: def.name,
    kind: def.kind,
    level,
    tags,
    ok,
    why,
    attack,
    cost: def.cost > 0 ? Math.max(1, Math.round(levelCost(def, level) * costM)) : 0,
    time: Math.max(0.12, time),
    commit: def.commit,
    cd: def.cd / cdr,
    move: def.move,
    dmg: r1(base * more * quality),
    reach,
    arc,
    radius,
    speed: def.speed ?? 0,
    range: def.range ?? 0,
    count: (def.count ?? 1) + (def.kind === "spin" ? 0 : proj) + (def.kind === "chain" ? chain : 0),
    spread: (((def.spread ?? 8) + (proj > 0 ? 6 : 0)) * Math.PI) / 180,
    chain: def.kind === "chain" ? 0 : chain,
    ignite,
    chill,
    leech,
    kb: attack ? st.knockback * (def.kbMult ?? 1) : 240,
    buff: def.buff ? { ...def.buff, dur: def.buff.dur * dur } : undefined,
    totem: def.totem ? { ...def.totem, dur: def.totem.dur * dur } : undefined,
    aura: def.aura ? { more: def.aura.more * auraScale, move: def.aura.move * auraScale, regen: def.aura.regen * auraScale } : undefined,
    pierce: def.pierce,
    returns: def.returns,
    ramp: def.ramp,
    guard: def.guard ? { less: def.guard.less, dur: def.guard.dur * dur } : undefined,
    zone: def.zone ? { place: def.zone.place, delay: def.zone.delay, dur: (def.zone.dur ?? 0) * dur, trig: def.zone.trig ?? 0, max: def.zone.max ?? 1 } : undefined,
    spirit: def.spirit ?? 0,
    innate: !!def.innate,
    elem: def.tags.find((g): g is "fire" | "cold" | "lightning" => g === "fire" || g === "cold" || g === "lightning"),
    color: def.color,
    supports,
  };
}

/** Tooltip lines with the final numbers of a computed action. */
export function actionLines(a: SkillAction): string[] {
  const out: string[] = [];
  if (!a.ok && a.why) out.push(`! ${a.why}`);
  if (a.id === "") {
    out.push(`Damage ${a.dmg} · ${a.time.toFixed(2)}s per attack · free`);
    return out;
  }
  if (a.innate) out.push("Weapon skill (from your equipped weapon)");
  out.push(`Level ${a.level}`);
  const def = SKILL_GEM_BY_ID.get(a.id);
  if (def) {
    out.push(tagLine(def, a.tags));
    const req = weaponReqText(def);
    if (req && a.ok) out.push(`Requires: ${req}`);
  }
  if (a.kind === "aura" || a.kind === "meta") {
    out.push(`Reserves ${a.spirit} Spirit while switched on (press to toggle)`);
    if (a.aura) {
      if (a.aura.more) out.push(`${Math.round(a.aura.more * 100)}% more damage`);
      if (a.aura.move) out.push(`${Math.round(a.aura.move * 100)}% more movement speed`);
      if (a.aura.regen) out.push(`${a.aura.regen.toFixed(1)} life regenerated per second`);
    }
    if (a.meta) {
      out.push(`Rolling builds ${a.meta.perDist.toFixed(2)} energy per unit; fires the spell at 100 energy`);
      if (a.inner) out.push(`Socketed: ${a.inner.name} (level ${a.inner.level}), damage ${a.inner.dmg}, no mana cost`);
    }
    for (const s of a.supports) if (!s.ok) out.push(`! ${s.name}: ${s.why ?? "does not apply"}`);
    return out;
  }
  out.push(`Mana cost ${a.cost} · ${a.attack ? "Attack" : "Cast"} time ${a.time.toFixed(2)}s${a.cd ? ` · Cooldown ${a.cd.toFixed(1)}s` : ""}`);
  if (a.dmg > 0) {
    const n = a.kind === "volley" || a.kind === "bolt" ? (a.count > 1 ? ` x${a.count} projectiles` : "") : a.kind === "chain" ? ` · hits up to ${a.count} enemies` : "";
    out.push(`Damage ${a.dmg} per hit${n} (players take 40%)`);
  }
  if (a.kind === "slam") out.push(`Impact radius ${Math.round(a.radius)}`);
  if (a.kind === "spin") out.push(`Hits ${a.count} times around you, radius ${Math.round(a.radius)}`);
  if (a.kind === "leap") out.push(`Leap up to ${Math.round(a.speed)}, impact radius ${Math.round(a.radius)}`);
  if (a.kind === "blast" && a.zone) out.push(`Strikes ${Math.round(a.reach)} ahead after ${a.zone.delay.toFixed(1)}s, radius ${Math.round(a.radius)}`);
  if (a.kind === "trap" && a.zone) {
    out.push(`Snare sets in ${a.zone.delay.toFixed(1)}s and waits ${a.zone.dur.toFixed(1)}s; burst radius ${Math.round(a.radius)}`);
    out.push(`At most ${a.zone.max} snares at once`);
  }
  if (a.guard) out.push(`${Math.round(a.guard.less * 100)}% less damage taken and no knockback for ${a.guard.dur.toFixed(1)}s`);
  if (a.pierce) out.push(a.returns ? "Pierces, then returns to you and hits again" : "Pierces every enemy in its path");
  if (a.ramp) out.push(`Hold: each shot is ${Math.round(a.ramp.step * 100)}% quicker, up to ${Math.round((1 / a.ramp.min - 1) * 100)}% faster`);
  if (a.kind === "cone") out.push(`Cone length ${Math.round(a.reach)}, ${Math.round((a.arc * 180) / Math.PI)}°`);
  if (a.kind === "chain") out.push(`Jump range ${Math.round(a.radius)}`);
  if (a.kind === "dash") out.push(`Lunge up to ${Math.round(a.speed)}`);
  if (a.buff) out.push(`${Math.round(a.buff.more * 100)}% more damage, ${Math.round(a.buff.move * 100)}% more move speed for ${a.buff.dur.toFixed(1)}s`);
  if (a.totem) out.push(`Effigy lasts ${a.totem.dur.toFixed(1)}s, fires every ${a.totem.rate}s`);
  if (a.chain) out.push(`Projectiles chain ${a.chain} times`);
  if (a.ignite) out.push(`Ignites for ${Math.round(a.ignite * 100)}% of the hit over 3s`);
  if (a.chill) out.push(`Chills for ${a.chill.toFixed(1)}s`);
  if (a.leech) out.push(`${Math.round(a.leech * 100)}% life leech`);
  for (const s of a.supports) if (!s.ok) out.push(`! ${s.name}: ${s.why ?? "does not apply"}`);
  return out;
}

// ---- effects (server -> client, inside a GameEvent { k: "fx" }) ---------------------------------

export type SkillFx =
  /** Use started (s = skill id). Slam: tx/ty/r is the telegraphed impact zone. c = commit fraction of t, r2 = strike reach / arc for the wind-up. */
  | { e: "cast"; p: number; s: string; x: number; y: number; a: number; t: number; tx?: number; ty?: number; r?: number; c?: number; n?: number }
  /** Strike / cone / slam landed at the commit point. */
  | { e: "land"; p: number; s: string; x: number; y: number; a: number; r: number; arc?: number }
  /** Projectile launched (or redirected by a chain); positions are extrapolated client-side. */
  | { e: "proj"; id: number; s: string; x: number; y: number; vx: number; vy: number; life: number }
  /** Projectile gone (hit = it struck something). */
  | { e: "pend"; id: number; x: number; y: number; hit?: 1 }
  /** Chain lightning path: flat [x0, y0, x1, y1, ...]. */
  | { e: "chain"; s: string; pts: number[] }
  | { e: "dash"; p: number; x0: number; y0: number; x1: number; y1: number }
  | { e: "buff"; p: number; s: string; dur: number }
  /** Persistent aura switched on (on = 1) or off for player p. */
  | { e: "aura"; p: number; s: string; on: 0 | 1 }
  /** Meta gem fired its socketed spell. */
  | { e: "meta"; p: number; s: string }
  | { e: "totem"; id: number; s: string; x: number; y: number; dur: number }
  | { e: "tend"; id: number }
  /** Ground effect placed: a blast mark that strikes after t seconds, or a trap that arms after t and lasts dur. */
  | { e: "zone"; id: number; s: string; x: number; y: number; r: number; t: number; dur?: number }
  /** Ground effect gone: hit = it went off (the blast is drawn at x, y with radius r). */
  | { e: "zend"; id: number; s: string; x: number; y: number; r: number; hit?: 1 }
  /** Guard raised for dur seconds. */
  | { e: "guard"; p: number; s: string; dur: number }
  /** Status ticks: burning / chilled target. */
  | { e: "burn"; x: number; y: number }
  | { e: "chill"; x: number; y: number };

/** Server -> one client: the skill bar contents and the switched-on spirit gems. */
export interface BarMsg {
  t: "bar";
  bar: BarSlot[];
  on: number[]; // slots whose aura / meta gem is switched on
}

/** Server -> one client: a slot went on cooldown (cd), or meta energy changed (en, 0..100). */
export interface CdMsg {
  t: "skcd";
  s: number; // slot
  cd: number; // seconds
  en?: number;
}
