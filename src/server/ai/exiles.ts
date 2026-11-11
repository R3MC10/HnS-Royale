// Rogue exiles: player-like enemies with real rolled gear (rendered with the hero paper doll),
// gem-driven skill loadouts (real gems + supports), dodge rolls and a full gear drop on death.
import { DT } from "../../shared/constants";
import { BASES } from "../../shared/content/bases";
import { MONSTER_BY_ID } from "../../shared/content/monsters";
import { EXILES, EXILE_ROLL, exileGemLevel, type ExileDef } from "../../shared/content/monsters/exiles";
import type { AttackDef } from "../../shared/content/monsters/types";
import { innateFor, SKILL_GEM_BY_ID, SUPPORT_GEM_BY_ID, type SkillGemDef, type SupportGemDef } from "../../shared/content/gems";
import { computeStats, defaultSlotFor, emptyEquipment, type Item } from "../../shared/items";
import { encodeLook } from "../../shared/look";
import { isWalkable } from "../../shared/map";
import { rollItem } from "../loot";
import type { Camp, Monster, MonsterSystem } from "../monsters";
import type { ServerPlayer } from "../player";

const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export function spawnExiles(sys: MonsterSystem, camp: Camp) {
  const t = MONSTER_BY_ID.get("rogue_exile");
  if (t) sys.spawnMonster(camp, t, false, { x: camp.x, y: camp.y }, 3);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const shuffle = <T>(a: readonly T[]) => [...a].sort(() => Math.random() - 0.5);

/** A support links to a skill when it shares a needed tag and hits no excluded tag (as for players). */
function canLink(s: SupportGemDef, g: SkillGemDef) {
  if (s.excludes?.some((t) => g.tags.includes(t))) return false;
  return !s.needs.length || s.needs.some((t) => g.tags.includes(t));
}

function elementOf(g: SkillGemDef, sups: SupportGemDef[]): AttackDef["element"] {
  if (g.tags.includes("fire")) return "fire";
  if (g.tags.includes("cold")) return "cold";
  if (g.tags.includes("lightning")) return "lightning";
  // A physical skill takes the first element a support adds (Cindertouch / Rimebite).
  const added = sups.flatMap((s) => s.addTags ?? []);
  return added.includes("fire") ? "fire" : added.includes("cold") ? "cold" : "phys";
}

/**
 * Turn one real skill gem (+ linked supports) into an attack-brain AttackDef. `dmg` is a multiplier
 * on the exile's damage: attacks scale like a player's (weapon damage x gem multiplier, +4% / level),
 * spells use the gem's own base damage (x1.13 / level) relative to that damage.
 * Returns null for gems that are not attacks (buffs / auras / meta), which become passives instead.
 */
export function gemAttack(g: SkillGemDef, lvl: number, sups: SupportGemDef[], baseDmg: number, main: boolean): AttackDef | null {
  const spell = g.tags.includes("spell");
  let more = 1;
  let speed = 1;
  let area = 1;
  let proj = 0;
  let ignite = 0;
  let chill = g.chill ?? 0;
  let cdr = 1;
  for (const s of sups) {
    more *= s.more ?? 1;
    speed *= s.speed ?? 1;
    area *= s.area ?? 1;
    proj += s.proj ?? 0;
    ignite += s.ignite ?? 0;
    chill = Math.max(chill, s.chill ?? 0);
    cdr *= s.cdr ?? 1;
  }
  const dmg = spell
    ? clamp((g.dmg * Math.pow(1.13, lvl - 1) * 0.75) / Math.max(1, baseDmg), 0.4, 2.2)
    : clamp((g.dmg * (1 + 0.04 * (lvl - 1))) / 1.5, 0.5, 1.8);
  const windup = clamp((spell ? g.time * 0.8 : g.time * g.commit * 0.6) / speed, 0.28, 0.95);
  const recover = clamp((g.time * (1 - g.commit) * 0.8 + 0.2) / speed, 0.3, 1.0);
  const cooldown = main ? g.cd / cdr : Math.max(g.cd / cdr, 3.5);
  const base: AttackDef = {
    id: g.id, kind: "melee", range: 30, windup: r2(windup), recover: r2(recover), cooldown: r2(cooldown),
    weight: main ? 4 : 2, dmg: r2(dmg * more), form: spell ? "spell" : "attack", element: elementOf(g, sups),
    ...(ignite > 0 ? { ignite } : {}), ...(chill > 0 ? { chill } : {}),
  };
  const arc = ((g.arcDeg ?? 90) * Math.PI) / 180;
  switch (g.kind) {
    case "strike":
      return { ...base, kind: "melee", range: Math.round(18 + (g.reach ?? 10) * 0.4), radius: Math.round((34 + (g.reach ?? 10)) * area), arc: r2(arc), kb: Math.round(260 * (g.kbMult ?? 1)) };
    case "cone":
      return { ...base, kind: "melee", range: Math.round((g.reach ?? 120) * 0.75), radius: Math.round((g.reach ?? 120) * area), arc: r2(arc) };
    case "slam":
      return { ...base, kind: "slam", range: 40, offset: Math.round(Math.min(60, (g.reach ?? 40) * 0.6)), radius: Math.round((g.radius ?? 56) * area), form: "area", kb: Math.round(300 * (g.kbMult ?? 1)) };
    case "volley":
    case "bolt": {
      const count = (g.count ?? 1) + proj;
      const sp = clamp((g.speed ?? 500) * 0.6, 260, 480);
      const range = Math.round(clamp((g.range ?? 500) * 0.8, 300, 460));
      const spreadDeg = (g.spread ?? 10) + (proj ? 6 : 0);
      return { ...base, kind: "proj", range, count, spread: r2(count > 1 ? (spreadDeg * (count - 1) * Math.PI) / 180 : 0), speed: Math.round(sp), life: r2(range / sp + 0.2), projR: spell ? 9 : 7 };
    }
    case "chain":
      // A forking thread: strikes at the target, telegraphed under it.
      return { ...base, kind: "ground", range: g.reach ?? 330, radius: Math.round(48 * area), windup: r2(Math.max(0.5, windup)) };
    case "dash":
      // Gap closer: lunges in and strikes where it lands.
      return { ...base, kind: "leap", range: Math.max(200, (g.speed ?? 200) + 40), minRange: 100, dmg: r2(0.6 * more), radius: 40, form: "attack", cooldown: Math.max(3, g.cd / cdr) };
    case "totem":
      // Effigy fire: a few burning shots raining around the target.
      return { ...base, kind: "rain", range: Math.min(400, g.range ?? 380), radius: Math.round(40 * area), count: 3 + proj, cooldown: Math.max(6, g.cd / cdr) };
    default:
      return null;
  }
}

/** Roll a loadout from the archetype's gem pools: weapon skill + main + 1-2 extras, supports, spirit. */
function rollLoadout(def: ExileDef): { gems: SkillGemDef[]; main: SkillGemDef; sups: SupportGemDef[]; spirit: SkillGemDef | null } {
  const get = (id: string) => SKILL_GEM_BY_ID.get(id);
  const main = get(pick(def.gems.main)) ?? SKILL_GEM_BY_ID.get("cinderbolt")!;
  const gems: SkillGemDef[] = [main];
  const innate = innateFor(def.weapon);
  if (innate && innate.id !== main.id) gems.push(innate);
  const want = gems.length + (Math.random() < 0.5 ? 1 : 2);
  for (const id of shuffle(def.gems.extra)) {
    if (gems.length >= want) break;
    const g = get(id);
    if (g && !gems.includes(g)) gems.push(g);
  }
  const sups: SupportGemDef[] = [];
  const nSup = Math.floor(Math.random() * 3); // 0-2 linked supports
  for (const id of shuffle(def.gems.supports)) {
    if (sups.length >= nSup) break;
    const s = SUPPORT_GEM_BY_ID.get(id);
    if (s && canLink(s, main)) sups.push(s);
  }
  const spirit = def.gems.spirit && Math.random() < 0.5 ? get(pick(def.gems.spirit)) ?? null : null;
  return { gems, main, sups, spirit };
}

/** Roll the exile's gear, derive life / damage from it and build its gem loadout. */
export function exileSetup(_sys: MonsterSystem, m: Monster) {
  const def = pick(EXILES);
  const equip = emptyEquipment();
  const items: Item[] = [];
  const ilvl = 8 + Math.floor(Math.random() * 10);
  const wBases = BASES.filter((b) => b.weapon?.kind === def.weapon);
  const put = (it: Item) => {
    const slot = defaultSlotFor(it, equip);
    if (slot && !equip[slot]) equip[slot] = it;
    items.push(it);
  };
  if (wBases.length) put(rollItem(ilvl, 2, pick(wBases).id));
  for (const cls of def.armour) {
    const bs = BASES.filter((b) => b.cls === cls);
    if (bs.length) put(rollItem(ilvl, Math.random() < 0.4 ? 2 : 1, pick(bs).id));
  }
  const st = computeStats(equip);
  m.maxHp = Math.max(260, st.maxHp * 2.6);
  m.damage = Math.max(10, Math.min(40, st.attackDamage * 0.7));
  m.speed = Math.max(150, Math.min(240, st.moveSpeed * 0.9));
  m.eliteName = `${def.name}, ${def.epithet}`;

  // Gem loadout drawn from the real gem list (shared/content/gems.ts).
  const lvl = exileGemLevel(ilvl);
  const lo = rollLoadout(def);
  const attacks: AttackDef[] = [];
  for (const g of lo.gems) {
    const a = gemAttack(g, lvl, g === lo.main ? lo.sups : [], m.damage, g === lo.main);
    if (a) attacks.push(a);
    else if (g.buff) {
      // Self-buff (e.g. Ember Pact): its uptime folded into a permanent bonus.
      const up = Math.min(1, g.buff.dur / Math.max(1, g.cd));
      m.damage *= 1 + g.buff.more * up;
      m.speed *= 1 + g.buff.move * up;
    }
  }
  if (!attacks.length) attacks.push(gemAttack(SKILL_GEM_BY_ID.get("cinderbolt")!, lvl, [], m.damage, true)!);
  if (lo.spirit?.aura) {
    m.damage *= 1 + lo.spirit.aura.more;
    m.speed *= 1 + lo.spirit.aura.move;
  }
  m.ext!.exile = {
    def, equip, items, lk: encodeLook(equip), wk: def.weapon,
    rollT: 0, rollCd: 1, rollDx: 0, rollDy: 0, flaskCd: 6,
    attacks, gems: lo.gems.map((g) => g.id).concat(lo.spirit ? [lo.spirit.id] : []), supports: lo.sups.map((s) => s.id),
    crit: st.critChance ?? 0, critMulti: st.critMulti ?? 0,
  };
}

/** Dodge roll when hit (if off cooldown), sideways from the attacker. */
export function exileDamaged(_sys: MonsterSystem, m: Monster, attacker: ServerPlayer) {
  const ex = m.ext!.exile!;
  if (ex.rollCd > 0 || !attacker || Math.random() < 0.35) return;
  const a = Math.atan2(m.y - attacker.y, m.x - attacker.x) + (Math.random() < 0.5 ? 1 : -1) * 1.1;
  ex.rollDx = Math.cos(a);
  ex.rollDy = Math.sin(a);
  ex.rollT = EXILE_ROLL.dur;
  ex.rollCd = EXILE_ROLL.cd;
  if (m.state === 2) m.state = 1;
}

/** Per tick: roll movement, cooldowns and a life flask under half life (only while it is being hit: no healing on the chase). */
export function exileStep(_sys: MonsterSystem, m: Monster, _players: Map<number, ServerPlayer>) {
  const ex = m.ext!.exile!;
  if (ex.rollCd > 0) ex.rollCd -= DT;
  if (ex.flaskCd > 0) ex.flaskCd -= DT;
  if (ex.rollT > 0) {
    ex.rollT -= DT;
    const nx = m.x + ex.rollDx * EXILE_ROLL.speed * DT;
    const ny = m.y + ex.rollDy * EXILE_ROLL.speed * DT;
    if (isWalkable(nx, ny, m.radius, 6)) {
      m.x = nx;
      m.y = ny;
    } else ex.rollT = 0;
  }
  if (ex.flaskCd <= 0 && m.hp < m.maxHp * 0.5 && m.state !== 0 && m.ext!.hurtT > 0) {
    ex.flaskCd = 9;
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.3);
  }
}

export function exileKilled(sys: MonsterSystem, m: Monster) {
  const ex = m.ext!.exile!;
  sys.host.spill?.(ex.items, m.x, m.y);
  sys.host.info?.(`${m.eliteName ?? "A rogue exile"} has been slain`);
}
