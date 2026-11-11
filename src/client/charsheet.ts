// Character panel (left dock): name, class / ascendancy, level + XP, attributes, offence for a chosen
// skill on the bar, defences (with mitigation estimates), resistances as "current (max)", misc.
// Data: the server `stats` message (final Stats), the owner-only `prog` message and the skill bar.
import { ASC_BY_ID } from "../shared/content/ascendancies";
import { CLASS_BY_ID } from "../shared/content/classes";
import { modLines } from "../shared/content/passives";
import { DEF, armourReduction, deflectChance, effectiveRes, hitChance } from "../shared/defence";
import { BAR_SIZE, computeSkill, weaponOf, type SkillAction } from "../shared/skills";
import type { Stats } from "../shared/stats";
import { drawClassEmblem } from "./classpick";
import { attachSkinBackdrop } from "./inventory";
import { onProgChange, progState } from "./prog";
import { el, ensureProgStyle, esc, panelHead } from "./progstyle";
import { skillDebug } from "./skillbar";

const CSS = `
#pg-char { position: fixed; top: 8vh; left: 24px; width: auto; max-height: 84vh; z-index: 40; display: none; flex-direction: column; overflow: hidden;
  background: #100e0d; border: none; border-radius: 0; }
#pg-char .pgz { zoom: var(--hns-ui, 1); width: 340px; position: relative; display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
#pg-char .head { display: flex; gap: 12px; align-items: center; padding: 12px 16px 10px; border-bottom: 1px solid var(--pg-line); }
#pg-char .head canvas { flex: none; }
#pg-char .head .pg-title { font-size: 18px; text-transform: none; letter-spacing: 0.08em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#pg-char .head .sub { font-size: 12px; color: var(--pg-dim); letter-spacing: 0.08em; margin-top: 2px; }
#pg-char .xp { margin-top: 7px; height: 5px; border-radius: 3px; background: #060507; box-shadow: 0 0 0 1px rgba(216,179,106,0.3); overflow: hidden; }
#pg-char .xp i { display: block; height: 100%; background: linear-gradient(180deg, #f2d27a, #8a6020); }
#pg-char .scroll { overflow-y: auto; padding: 4px 16px 16px; min-height: 0; scrollbar-width: thin; scrollbar-color: #5a4630 #0c0a09; }
#pg-char .attrs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0 4px; }
#pg-char .attr { text-align: center; padding: 7px 4px; border-radius: 3px; background: linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.25));
  border: 1px solid rgba(216,179,106,0.15); box-shadow: inset 0 1px 0 rgba(255,230,190,0.05); }
#pg-char .attr b { display: block; font-family: var(--pg-title); font-size: 19px; }
#pg-char .attr span { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--pg-dim); }
#pg-char .sec { margin-top: 14px; }
#pg-char .sec .pg-h { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; color: #c8a060; }
#pg-char .sec .pg-h::before, #pg-char .sec .pg-h::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(216,179,106,0.4)); }
#pg-char .sec .pg-h::after { background: linear-gradient(90deg, rgba(216,179,106,0.4), transparent); }
#pg-char .row { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 2px 0; cursor: default; }
#pg-char .row:hover { background: linear-gradient(90deg, transparent, rgba(216,179,106,0.07), transparent); }
#pg-char .row span { color: var(--pg-dim); }
#pg-char .row b { font-weight: 600; color: var(--pg-ink); font-variant-numeric: tabular-nums; text-align: right; }
#pg-char .row b small { color: var(--pg-dim); font-weight: normal; font-size: 11px; }
#pg-char .row b.fire { color: #ff9a5a; } #pg-char .row b.cold { color: #8cc8ff; } #pg-char .row b.light { color: #ffe36a; } #pg-char .row b.chaos { color: #d08aff; }
#pg-char .row b.cap { text-decoration: underline dotted rgba(255,255,255,0.4); }
#pg-char .row b.neg { color: #e2483a !important; }
#pg-char select.skill { width: 100%; margin: 2px 0 6px; padding: 4px 6px; font: 13px var(--pg-body); color: var(--pg-ink);
  background: linear-gradient(180deg, #221c1a, #120f0e); border: 1px solid rgba(216,179,106,0.35); border-radius: 3px; outline: none; }
#pg-char select.skill:focus { border-color: var(--pg-gold); }
`;

let root: HTMLDivElement | null = null;
let emblemCv: HTMLCanvasElement;
let headEl: HTMLDivElement;
let bodyEl: HTMLDivElement;
let stats: Stats | null = null;
let open = false;
let emblemFor = "";
/** Bar slot whose offence is shown (-1 = first usable). */
let selSlot = -1;
let renderPending = false;

export function setCharStats(s: Stats) {
  stats = s;
  if (open) render();
}

export function isCharOpen() {
  return open;
}

export function toggleChar(force?: boolean) {
  const want = force ?? !open;
  if (want === open) return;
  if (!root) build();
  open = want;
  root!.style.display = open ? "flex" : "none";
  if (open) render();
}

function build() {
  ensureProgStyle();
  const st = el("style");
  st.textContent = CSS;
  document.head.append(st);
  root = el("div", "pg-root pg-frame");
  root.id = "pg-char";
  const z = el("div", "pgz");
  const head = el("div", "head");
  emblemCv = el("canvas");
  emblemCv.width = emblemCv.height = 56; // placeholder size until a class emblem is drawn
  emblemCv.style.width = emblemCv.style.height = "56px";
  headEl = el("div");
  headEl.style.flex = "1";
  headEl.style.minWidth = "0";
  head.append(emblemCv, headEl);
  bodyEl = el("div", "scroll");
  z.append(panelHead("Character", "character", () => toggleChar(false)), head, bodyEl);
  root.append(z);
  for (const ev of ["mousedown", "mouseup", "click", "contextmenu", "wheel"]) root.addEventListener(ev, (e) => e.stopPropagation());
  document.body.append(root);
  attachSkinBackdrop(root, "panel");
  onProgChange(() => open && render());
  // Skill bar changes arrive through the stats/prog messages; refresh now and then while open.
  let sig = "";
  setInterval(() => {
    if (!open) return;
    const S = skillDebug.state;
    const now = S.bar.map((b) => `${b?.gem?.id ?? ""}:${b?.gem?.l ?? ""}:${(b?.sups ?? []).map((x) => x?.id ?? "").join(".")}`).join("|") + "/" + [...S.on].join(",") + "/" + (S.mainhand?.id ?? "");
    if (now !== sig) {
      sig = now;
      render();
    }
  }, 1000);
}

const r0 = (v: number) => Math.round(v).toLocaleString();
const r1 = (v: number) => (Math.round(v * 10) / 10).toString();
const pct = (v: number) => `${Math.round(v)}%`;
const pct1 = (v: number) => `${(Math.round(v * 10) / 10).toString()}%`;

function row(label: string, value: string, cls = "", note = "", valueHtml = false): string {
  const t = note ? ` title="${esc(note)}"` : "";
  return `<div class="row"${t}><span>${esc(label)}</span><b class="${cls}">${valueHtml ? value : esc(value)}</b></div>`;
}

function playerName(): string {
  try {
    const n = (localStorage.getItem("hns-name") ?? "").trim();
    if (n) return n;
  } catch {
    /* storage blocked */
  }
  return "Wanderer";
}

/** Skills on the bar (basic attack first), computed with the current stats. */
function barSkills(s: Stats): { slot: number; a: SkillAction }[] {
  const S = skillDebug.state;
  const w = weaponOf(S.mainhand);
  const out: { slot: number; a: SkillAction }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < BAR_SIZE; i++) {
    const sl = S.bar[i];
    if (!sl?.gem && i !== 0) continue;
    let a: SkillAction;
    try {
      a = computeSkill(sl?.gem ? sl : null, s, w, !!S.mainhand, S.attrs);
    } catch {
      continue;
    }
    const key = a.id || "basic";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ slot: i, a });
  }
  return out;
}

function spiritUsed(s: Stats): number {
  const S = skillDebug.state;
  const w = weaponOf(S.mainhand);
  let used = 0;
  for (const i of S.on) {
    const sl = S.bar[i];
    if (!sl?.gem) continue;
    try {
      used += computeSkill(sl, s, w, !!S.mainhand, S.attrs).spirit || 0;
    } catch {
      /* skip */
    }
  }
  return used;
}

function offence(s: Stats): string {
  const list = barSkills(s);
  if (!list.length) return "";
  const cur = list.find((e) => e.slot === selSlot) ?? list.find((e) => e.a.ok && e.a.dmg > 0) ?? list[0];
  selSlot = cur.slot;
  const opts = list
    .map((e) => `<option value="${e.slot}"${e.slot === cur.slot ? " selected" : ""}>${esc(e.a.id ? e.a.name : "Basic attack")}${e.a.ok ? "" : " (unusable)"}</option>`)
    .join("");
  const a = cur.a;
  const crit = Math.max(0, Math.min(100, s.critChance || 0));
  const critMulti = s.critMulti || 150;
  const critFactor = 1 + (crit / 100) * (critMulti / 100 - 1);
  const period = Math.max(a.time || 0, a.cd || 0);
  const ups = period > 0 ? 1 / period : 0;
  const count = Math.max(1, a.count || 1);
  const dps = a.dmg * critFactor * ups;
  const area = a.radius > 0 ? `${r0(a.radius)} radius` : a.reach > 0 ? `${r0(a.reach)} reach` : a.range > 0 ? `${r0(a.range)} range` : "";
  return `<div class="sec"><h3 class="pg-h">Offence</h3>
    <select class="skill" title="Skill to show offence for">${opts}</select>
    ${a.ok ? "" : row("Unusable", a.why ?? "Needs another weapon", "neg")}
    ${row("Hit damage", r0(a.dmg) + (count > 1 ? ` ×${count}` : ""), "", `Per hit, before player-vs-player scaling${count > 1 ? `; ${count} projectiles / strikes` : ""}`)}
    ${row(a.attack ? "Attacks per second" : "Uses per second", r1(ups), "", `Use time ${r1(a.time)}s${a.cd > 0 ? `, cooldown ${r1(a.cd)}s` : ""}`)}
    ${row("Critical chance", pct1(crit), "", "Gear, passives and skill")}
    ${row("Critical damage", `${Math.round(critMulti)}%`, "", "Damage of a critical hit")}
    ${row("Average DPS", r0(dps), "", "Hit × uses per second × average critical bonus (single target)")}
    ${a.cost > 0 ? row("Mana cost", r0(a.cost)) : ""}
    ${area ? row("Area / reach", area) : ""}
    ${row("Accuracy", r0(s.accuracy), "", "Against evasion: higher accuracy hits evasive targets more often")}
    ${row("Spell damage", `×${r1(s.spellMult)}`, "", "Multiplier on spell hits")}
    ${row("Cast speed", `×${r1(s.castSpeed)}`, "", "Multiplier on spell use speed")}</div>`;
}

function render() {
  if (!root) return;
  const sel = bodyEl.querySelector("select.skill");
  if (sel && document.activeElement === sel) {
    // Don't yank the dropdown away while it is open; refresh when it closes.
    renderPending = true;
    return;
  }
  renderPending = false;
  const m = progState.msg;
  const cls = m ? CLASS_BY_ID.get(m.cls) : undefined;
  const asc = m?.asc ? ASC_BY_ID.get(m.asc) : undefined;
  if (cls && emblemFor !== cls.id) {
    drawClassEmblem(emblemCv, cls.id, 56);
    emblemFor = cls.id;
  }
  const xpFrac = m && m.next > 0 ? Math.min(1, m.xp / m.next) : 1;
  headEl.innerHTML =
    `<h2 class="pg-title" title="${esc(playerName())}">${esc(playerName())}</h2>` +
    `<div class="sub">Level ${m?.lv ?? 1} ${esc(cls?.name ?? "")}${asc ? ` · <span style="color:${asc.color}">${esc(asc.name)}</span>` : ""}</div>` +
    `<div class="xp" title="${m ? `${r0(m.xp)} / ${r0(m.next)} XP` : ""}"><i style="width:${(xpFrac * 100).toFixed(1)}%"></i></div>` +
    `<div class="sub">${m ? (m.next > 0 ? `${r0(m.xp)} / ${r0(m.next)} experience` : "Maximum level") : ""}${m?.pts ? ` · <b style="color:#ffd27a">${m.pts} unspent</b>` : ""}</div>`;

  const d = m?.def;
  const s = stats;
  let h = `<div class="attrs">
    <div class="attr" title="Strength: from your class, passives and gear"><b style="color:#e07a5a">${d ? r0(d.str) : "–"}</b><span>Strength</span></div>
    <div class="attr" title="Dexterity: from your class, passives and gear"><b style="color:#7fd07a">${d ? r0(d.dex) : "–"}</b><span>Dexterity</span></div>
    <div class="attr" title="Intelligence: from your class, passives and gear"><b style="color:#7aa8e8">${d ? r0(d.int) : "–"}</b><span>Intelligence</span></div></div>`;
  if (cls?.trait) {
    // signature class trait (innate, always on): name in the class colour, one line per effect
    h += `<div class="sec"><h3 class="pg-h">Class trait</h3><div class="row" title="Innate to your class, every match"><span style="color:${cls.color};font-weight:600">${esc(cls.trait.name)}</span></div>${modLines(cls.trait.mods)
      .map((l) => `<div class="row"><span style="color:var(--pg-ink)">${esc(l)}</span></div>`)
      .join("")}</div>`;
  }
  if (s) {
    h += offence(s);
    const capv = Math.min(DEF.resHardCap, DEF.resDefaultCap + (s.maxRes || 0));
    const res = (raw: number, c: string, label: string) => {
      const v = Math.round(effectiveRes(raw || 0, s.maxRes || 0));
      const over = (raw || 0) > capv ? ` · ${Math.round(raw)}% before the cap` : "";
      return row(label, `${v}% <small>(${Math.round(capv)}%)</small>`, c + (v < 0 ? " neg" : v >= capv ? " cap" : ""), `Current (maximum)${over}`, true);
    };
    const es = Math.max(s.energyShield || 0, d?.barrier ?? 0);
    const esDelay = DEF.esDelay / (1 + (s.esFasterStart || 0) / 100);
    const armour = Math.max(s.armour || 0, d?.armour ?? 0);
    const evasion = Math.max(s.evasion || 0, d?.evasion ?? 0);
    const refHit = Math.max(10, Math.round(s.maxHp * 0.15));
    const dr = armourReduction(armour, refHit) * 100;
    const evade = (1 - hitChance(DEF.baseAccuracy, evasion)) * 100;
    const defl = deflectChance(evasion, 0, DEF.baseAccuracy) * 100;
    const spTotal = Math.round(s.spirit || 0);
    const spUsed = spiritUsed(s);
    const stun = s.maxHp * (1 + (s.stunThreshold || 0) / 100);
    h += `<div class="sec"><h3 class="pg-h">Defence</h3>
      ${row("Life", `${r0(s.maxHp)} <small>+${r1(s.lifeRegen)}/s</small>`, "", "Maximum life · regeneration per second", true)}
      ${row("Mana", `${r0(s.maxMana)} <small>+${r1(s.manaRegen)}/s</small>`, "", "Maximum mana · regeneration per second", true)}
      ${row("Barrier", es > 0 ? `${r0(es)} <small>${r0(es * DEF.esRecharge)}/s after ${r1(esDelay)}s</small>` : "0", "", `Absorbs damage before life; recharges ${Math.round(DEF.esRecharge * 100)}% per second after ${r1(esDelay)}s without taking damage`, true)}
      ${row("Spirit", `${r0(spUsed)} / ${r0(spTotal)} <small>(${r0(Math.max(0, spTotal - spUsed))} free)</small>`, spUsed > spTotal ? "neg" : "", "Reserved by persistent skills / total", true)}
      ${row("Armour", `${r0(armour)} <small>${pct(dr)} vs ${refHit}</small>`, "", `Estimated physical damage reduction against a ${refHit}-damage hit (less against bigger hits)`, true)}
      ${row("Evasion", `${r0(evasion)} <small>${pct(evade)} evade</small>`, "", `Estimated chance to evade attacks from base accuracy (${DEF.baseAccuracy}); ${pct(defl)} to deflect hits that land`, true)}
      ${row("Block chance", pct(Math.min(DEF.blockCap, s.blockChance || 0)), "", `Passive block, capped at ${DEF.blockCap}%`)}
      ${row("Stun threshold", r0(stun), "", `Based on maximum life${s.stunThreshold ? `, ${Math.round(s.stunThreshold)}% increased` : ""}`)}
      ${res(s.resFire, "fire", "Fire resistance")}${res(s.resCold, "cold", "Cold resistance")}${res(s.resLight, "light", "Lightning resistance")}
      ${res(s.resChaos, "chaos", "Chaos resistance")}</div>`;
    h += `<div class="sec"><h3 class="pg-h">Other</h3>
      ${row("Movement speed", r0(s.moveSpeed), "", "Units per second")}
      ${row("Roll cooldown", `${r1(s.dodgeCooldown)}s`, "", "Time between dodge rolls")}
      ${row("Flask recovery", `×${r1(s.flaskRecovery)}`, "", "Multiplier on flask recovery")}
      ${row("Flask charges gained", `×${r1(s.flaskChargeGain)}`, "", "Multiplier on flask charges from kills")}</div>`;
  } else h += `<div class="sec"><p style="color:var(--pg-dim)">Join a match to see your stats.</p></div>`;
  bodyEl.innerHTML = h;
  const select = bodyEl.querySelector("select.skill") as HTMLSelectElement | null;
  if (select) {
    select.addEventListener("change", () => {
      selSlot = Number(select.value);
      select.blur();
      render();
    });
    select.addEventListener("blur", () => renderPending && render());
    // Keys typed into the dropdown must not reach the game.
    select.addEventListener("keydown", (e) => e.stopPropagation());
  }
}
