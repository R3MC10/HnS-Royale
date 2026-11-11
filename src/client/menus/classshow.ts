// Hall character selection (PoE2-style layout, original content): a large showcase of the selected
// class (its hero in the starting kit, idling) with name, flavour, starting attributes and defences,
// starting weapon and skill gem, playstyle, difficulty and the three ascendancies, above a strip of
// class medallions. Every number and name comes from the real definitions: classes.ts (base stats,
// weapon preference, playstyle), progression.ts (level-1 stat math), bases.ts (starter weapons),
// gems.ts (starter skill) and ascendancies.ts.
import { ASC_BY_ID } from "../../shared/content/ascendancies";
import { BASE_BY_ID, STARTER_WEAPONS } from "../../shared/content/bases";
import { ASCEND_LEVEL, CLASSES, CLASS_BY_ID, classWeapon, type ClassDef } from "../../shared/content/classes";
import { ATTR_COLOR, SKILL_GEM_BY_ID, STARTER_SKILL, WEAPON_CLASS_NAME } from "../../shared/content/gems";
import { tagLine } from "../../shared/skills";
import { lookCode, decodeLook } from "../../shared/look";
import { applyProgression, totalMods } from "../../shared/progression";
import { defaultStats } from "../../shared/stats";
import { drawClassEmblem } from "../classpick";
import { skillIconCopy } from "../gfx/gemart";
import { heroFrame } from "../gfx/hero";
import { hero3dFrame } from "../gfx/hero3d";
import { dirToWorldAngle } from "../gfx/iso";
import { paperdollFrame } from "../gfx/paperdoll";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export interface ClassInfo {
  def: ClassDef;
  weaponKind: string;
  weaponBase: string; // item base id
  weaponName: string;
  skillId: string;
  skillName: string;
  skillTags: string;
  str: number;
  dex: number;
  int: number;
  life: number;
  mana: number;
  es: number;
  armour: number;
  evasion: number;
}

/** Level-1 numbers and starting kit of a class, from the same math the server uses. */
export function classInfo(id: string): ClassInfo {
  const def = CLASS_BY_ID.get(id) ?? CLASSES[0];
  const wk = classWeapon(def.id, STARTER_WEAPONS);
  const wb = STARTER_WEAPONS[wk];
  const m = totalMods(def.id, [], []);
  const s = applyProgression(defaultStats(), m, 1);
  const sk = SKILL_GEM_BY_ID.get(STARTER_SKILL[wk] ?? "cinderbolt");
  return {
    def,
    weaponKind: wk,
    weaponBase: wb,
    weaponName: BASE_BY_ID.get(wb)?.name ?? wb,
    skillId: sk?.id ?? "",
    skillName: sk?.name ?? "",
    skillTags: sk ? tagLine(sk) : "",
    str: Math.round(m.str ?? 0),
    dex: Math.round(m.dex ?? 0),
    int: Math.round(m.int ?? 0),
    life: Math.round(s.maxHp),
    mana: Math.round(s.maxMana),
    es: Math.round(s.energyShield),
    armour: Math.round(s.armour),
    evasion: Math.round(s.evasion),
  };
}

const DIFFICULTY = ["", "Straightforward", "Moderate", "Demanding"];
const ATTR_KEY: Record<string, "str" | "dex" | "int"> = { STR: "str", DEX: "dex", INT: "int" };

// ---- the idling hero figure ------------------------------------------------------------------

const FACE_DIR = 5; // of 16, screen-space: a three-quarter view toward the camera
let figToken = 0;

/** Draw the class hero (starting weapon, class tint) into `cv`, idling, until `cv` leaves the page. */
/** Topmost opaque row of a sprite frame (null while the frame is still blank). */
function figureTop(src: HTMLCanvasElement): number | null {
  const g = src.getContext("2d", { willReadFrequently: false });
  if (!g || !src.width || !src.height) return null;
  let px: Uint8ClampedArray;
  try {
    px = g.getImageData(0, 0, src.width, src.height).data;
  } catch {
    return null;
  }
  const w = src.width;
  for (let y = 0; y < src.height; y++) for (let x = 0; x < w; x += 2) if (px[(y * w + x) * 4 + 3] > 24) return y;
  return null;
}

function runFigure(cv: HTMLCanvasElement, info: ClassInfo) {
  const token = ++figToken;
  const lk = lookCode({}, {}, { weapon: info.weaponBase });
  const cfg = { look: decodeLook(lk), color: info.def.tint, wk: info.weaponKind };
  const angle = dirToWorldAngle(FACE_DIR, 16);
  const g = cv.getContext("2d")!;
  let started = false;
  let boxKey = "";
  let figH = 0;
  const tick = () => {
    if (token !== figToken || !cv.isConnected) {
      if (!started && token === figToken) requestAnimationFrame(tick); // not attached yet
      return;
    }
    started = true;
    const t = performance.now() / 1000;
    const frame = (t * 2.2) % 4; // idle: 4 frames
    const s = hero3dFrame("menu:hero", cfg.look, lk, angle, "idle", frame) ?? paperdollFrame(cfg, lk, FACE_DIR, "idle", frame) ?? heroFrame(cfg, lk, FACE_DIR, "idle", frame);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    if (s) {
      const d = s.d ?? 1;
      // Sprite frames carry wide empty margins: measure the opaque figure once per frame size
      // (the 3D hero replaces the painted fallback when it loads) and scale the figure itself.
      const key = `${s.cv.width}x${s.cv.height}`;
      if (key !== boxKey) {
        const top = figureTop(s.cv);
        if (top !== null) {
          boxKey = key;
          figH = Math.max(1, s.ay - top);
        }
      }
      const h = figH > 0 ? figH : s.cv.height;
      const k = (cv.height * 0.86) / h;
      const kk = k * d;
      const footX = cv.width / 2;
      const footY = cv.height * 0.93;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(s.cv, footX - s.ax * kk / d, footY - s.ay * kk / d, (s.cv.width * kk) / d, (s.cv.height * kk) / d);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- showcase + medallion strip --------------------------------------------------------------

export interface ClassSelect {
  root: HTMLDivElement;
  set(id: string): void;
}

/**
 * Character selection block. `onPick` fires when the player clicks a medallion (not for `set`).
 * `locked`: the class can't change right now (in a match / practising): medallions are dimmed.
 */
export function renderClassSelect(initial: string, onPick: (id: string) => void, locked = false): ClassSelect {
  const root = el("div", "m-cs");
  const show = el("div", "m-cs-show");
  const strip = el("div", "m-cs-strip");
  root.append(show, strip);
  const medals = new Map<string, HTMLDivElement>();

  const fill = (id: string) => {
    const info = classInfo(id);
    const c = info.def;
    show.style.setProperty("--cs-tint", c.tint);
    show.replaceChildren();

    // Figure on a lit plinth
    const fig = el("div", "m-cs-fig");
    const cv = el("canvas");
    cv.width = 360;
    cv.height = 460;
    fig.append(el("div", "m-cs-glow"), cv);
    runFigure(cv, info);

    // Details
    const info2 = el("div", "m-cs-info");
    const head = el("div", "m-cs-head");
    const em = el("canvas");
    drawClassEmblem(em, c.id, 54);
    const nm = el("div", "m-cs-nm");
    nm.append(el("h3", "m-cs-name", c.name));
    const attrs = el("div", "m-cs-attrs");
    for (const a of c.attrs.split("/").map((x) => x.trim())) {
      const chip = el("span", "m-cs-attr", a);
      const key = ATTR_KEY[a];
      if (key) chip.style.color = ATTR_COLOR[key];
      attrs.append(chip);
    }
    nm.append(attrs);
    head.append(em, nm);
    info2.append(head, el("p", "m-cs-blurb", c.blurb));

    const stats = el("div", "m-cs-stats");
    const stat = (label: string, v: number, color = "") => {
      const s = el("div", "m-cs-stat");
      const b = el("b", "", String(v));
      if (color) b.style.color = color;
      s.append(b, el("span", "", label));
      stats.append(s);
    };
    stat("Strength", info.str, ATTR_COLOR.str);
    stat("Dexterity", info.dex, ATTR_COLOR.dex);
    stat("Intelligence", info.int, ATTR_COLOR.int);
    stat("Life", info.life, "#e0645a");
    stat("Mana", info.mana, "#6a9ae8");
    stat("Energy Shield", info.es, "#a8c8f0");
    if (info.armour) stat("Armour", info.armour);
    if (info.evasion) stat("Evasion", info.evasion);
    info2.append(el("div", "m-cs-sec", "Starting attributes"), stats);

    const kit = el("div", "m-cs-kit");
    const wRow = el("div", "m-cs-kitrow");
    wRow.append(el("span", "m-cs-k", "Starting weapon"));
    const wv = el("span", "m-cs-v");
    wv.append(el("b", "", info.weaponName), el("i", "", WEAPON_CLASS_NAME[info.weaponKind] ?? info.weaponKind));
    wRow.append(wv);
    const sRow = el("div", "m-cs-kitrow");
    sRow.append(el("span", "m-cs-k", "Starting skill"));
    const sv = el("span", "m-cs-v");
    if (info.skillId) sv.append(skillIconCopy(info.skillId, 26));
    sv.append(el("b", "", info.skillName), el("i", "", info.skillTags));
    sRow.append(sv);
    const pRow = el("div", "m-cs-kitrow");
    pRow.append(el("span", "m-cs-k", "Playstyle"), el("span", "m-cs-v m-cs-play", c.playstyle));
    const dRow = el("div", "m-cs-kitrow");
    dRow.append(el("span", "m-cs-k", "Difficulty"));
    const dv = el("span", "m-cs-v m-cs-diff");
    for (let i = 1; i <= 3; i++) dv.append(el("i", i <= c.difficulty ? "on" : ""));
    dv.append(el("b", "", DIFFICULTY[c.difficulty]));
    dRow.append(dv);
    kit.append(wRow, sRow, pRow, dRow);
    info2.append(kit);

    const asc = el("div", "m-cs-asc");
    for (const aid of c.ascendancies) {
      const a = ASC_BY_ID.get(aid);
      if (!a) continue;
      const r = el("div", "m-cs-ascrow");
      r.style.setProperty("--asc", a.color);
      r.title = a.blurb; // the row trims to one line on short screens
      r.append(el("b", "", a.name), el("span", "", a.blurb));
      asc.append(r);
    }
    info2.append(el("div", "m-cs-sec", `Ascendancies · trial at level ${ASCEND_LEVEL}`), asc);
    show.append(fig, info2);
  };

  let cur = CLASS_BY_ID.has(initial) ? initial : CLASSES[0].id;
  for (const c of CLASSES) {
    const m = el("div", "m-medal" + (c.id === cur ? " sel" : "") + (locked ? " locked" : ""));
    m.dataset.cls = c.id;
    const cv = el("canvas");
    drawClassEmblem(cv, c.id, 58);
    m.append(cv, el("span", "", c.name));
    m.title = c.name; // names hide on short screens (vertical strip)
    m.addEventListener("click", () => {
      if (locked || c.id === cur) return;
      set(c.id);
      onPick(c.id);
    });
    strip.append(m);
    medals.set(c.id, m);
  }
  function set(id: string) {
    if (!CLASS_BY_ID.has(id)) return;
    cur = id;
    for (const [k, m] of medals) m.classList.toggle("sel", k === id);
    fill(id);
  }
  fill(cur);
  return { root, set };
}

export const CLASS_SELECT_CSS = `
.m-cs { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.m-cs-show { --cs-tint: #5a4a26; position: relative; display: grid; grid-template-columns: minmax(220px, 40%) 1fr; gap: 6px 18px; min-height: 0;
  padding: 14px 18px 16px; border-radius: 6px; overflow: hidden;
  background: radial-gradient(ellipse 60% 70% at 22% 62%, color-mix(in srgb, var(--cs-tint) 55%, transparent), transparent 70%),
    linear-gradient(180deg, rgba(30,24,28,0.94), rgba(10,8,11,0.97));
  border: 1px solid rgba(217,178,106,0.35);
  box-shadow: 0 0 0 1px #050405, 0 0 0 4px rgba(18,14,16,0.9), 0 0 0 5px rgba(140,116,72,0.25), 0 24px 70px rgba(0,0,0,0.85), inset 0 0 80px rgba(0,0,0,0.55); }
.m-cs-fig { position: relative; display: flex; align-items: flex-end; justify-content: center; min-height: 300px; }
.m-cs-fig canvas { position: relative; width: 100%; max-width: 330px; height: auto; aspect-ratio: 360 / 460; }
.m-cs-glow { position: absolute; left: 10%; right: 10%; bottom: 3%; height: 16%; border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(255,200,120,0.28), color-mix(in srgb, var(--cs-tint) 40%, transparent) 45%, transparent 72%);
  box-shadow: 0 0 0 1px rgba(217,178,106,0.18); }
.m-cs-info { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.m-cs-head { display: flex; align-items: center; gap: 12px; }
.m-cs-head canvas { flex: none; filter: drop-shadow(0 0 8px rgba(0,0,0,0.8)); }
.m-cs-name { margin: 0; font-family: var(--m-title); font-weight: 700; font-size: clamp(26px, 3.2vw, 38px); letter-spacing: 0.1em; line-height: 1.05;
  background: linear-gradient(180deg, #f6dfae 0%, #d9a650 50%, #9a5a24 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 2px 0 #1a0805); }
.m-cs-attrs { display: flex; gap: 6px; margin-top: 4px; }
.m-cs-attr { font-family: var(--m-title); font-size: 11px; font-weight: 700; letter-spacing: 0.16em; padding: 2px 8px; border-radius: 3px;
  background: rgba(0,0,0,0.45); box-shadow: inset 0 0 0 1px rgba(140,116,72,0.35); }
.m-cs-blurb { margin: 0; color: #c8b896; font-style: italic; font-size: 15px; line-height: 1.4; }
.m-cs-sec { display: flex; align-items: center; gap: 10px; font-family: var(--m-title); color: var(--m-gold); letter-spacing: 0.16em; text-transform: uppercase; font-size: 11px; margin-top: 2px; }
.m-cs-sec::before, .m-cs-sec::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(217,178,106,0.45), transparent); }
.m-cs-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 5px; }
.m-cs-stat { display: flex; flex-direction: column; align-items: center; padding: 5px 4px 4px; border-radius: 4px; background: rgba(0,0,0,0.38); box-shadow: inset 0 0 0 1px rgba(140,116,72,0.18); }
.m-cs-stat b { font-family: var(--m-title); font-size: 20px; line-height: 1.1; color: #f0dcb0; font-variant-numeric: tabular-nums; }
.m-cs-stat span { font-size: 10.5px; color: var(--m-dim); letter-spacing: 0.06em; text-transform: uppercase; text-align: center; }
.m-cs-kit { display: flex; flex-direction: column; gap: 5px; }
.m-cs-kitrow { display: grid; grid-template-columns: 120px 1fr; gap: 10px; align-items: center; font-size: 14px; }
.m-cs-k { color: var(--m-gold-dim); font-family: var(--m-title); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; }
.m-cs-v { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
.m-cs-v b { color: #f0dcb0; font-weight: 600; }
.m-cs-v i { color: var(--m-dim); font-size: 12px; font-style: normal; }
.m-cs-v canvas { width: 26px; height: 26px; border-radius: 4px; box-shadow: 0 0 0 1px #050405, 0 0 0 2px rgba(140,116,72,0.4); }
.m-cs-play { color: #d8c8a6; line-height: 1.35; }
.m-cs-diff i { display: inline-block; width: 12px; height: 12px; transform: rotate(45deg); background: #2a2224; box-shadow: inset 0 0 0 1px rgba(140,116,72,0.45); }
.m-cs-diff i.on { background: linear-gradient(135deg, #f0c070, #a0501c); box-shadow: 0 0 6px rgba(240,160,80,0.55); }
.m-cs-diff b { margin-left: 4px; }
.m-cs-asc { display: flex; flex-direction: column; gap: 5px; }
.m-cs-ascrow { --asc: #8c7448; padding: 5px 10px; border-radius: 3px; background: linear-gradient(90deg, color-mix(in srgb, var(--asc) 22%, transparent), rgba(0,0,0,0.3) 60%);
  border-left: 3px solid var(--asc); line-height: 1.3; }
.m-cs-ascrow b { display: block; font-family: var(--m-title); letter-spacing: 0.08em; font-size: 13.5px; color: #f0dcb0; }
.m-cs-ascrow span { font-size: 12.5px; color: var(--m-dim); }
.m-cs-strip { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px; }
.m-medal { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 86px; padding: 6px 2px 5px; cursor: pointer; border-radius: 6px;
  transition: background .15s, transform .1s; }
.m-medal canvas { border-radius: 50%; transition: box-shadow .15s, filter .15s; filter: saturate(0.7) brightness(0.8); }
.m-medal span { font-family: var(--m-title); font-size: 11px; letter-spacing: 0.06em; color: var(--m-dim); text-align: center; line-height: 1.15; }
.m-medal:hover canvas { filter: none; box-shadow: 0 0 12px rgba(217,178,106,0.45); }
.m-medal:hover span { color: #f0dcb0; }
.m-medal:active { transform: translateY(1px); }
.m-medal.sel { background: radial-gradient(ellipse at 50% 35%, rgba(224,116,58,0.22), transparent 70%); }
.m-medal.sel canvas { filter: none; box-shadow: 0 0 0 2px #f0c878, 0 0 18px rgba(240,180,90,0.7); }
.m-medal.sel span { color: #ffe2a8; }
.m-medal.locked { cursor: default; opacity: 0.55; }
.m-medal.locked:hover canvas { box-shadow: none; }
@media (max-height: 820px), (max-width: 1400px) {
  .m-cs { gap: 8px; }
  .m-cs-fig { align-self: center; min-height: 240px; }
  .m-cs-fig canvas { max-width: 270px; }
  .m-cs-info { gap: 6px; }
  .m-cs-name { font-size: clamp(22px, 2.6vw, 32px); }
  .m-cs-blurb { font-size: 13.5px; }
  .m-cs-stats { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 4px; }
  .m-cs-stat { padding: 3px 3px 2px; }
  .m-cs-stat b { font-size: 17px; }
  .m-cs-stat span { font-size: 9.5px; }
  .m-cs-kitrow { grid-template-columns: 96px 1fr; gap: 8px; font-size: 13px; }
  .m-cs-ascrow { padding: 3px 8px; }
  .m-cs-ascrow span { display: block; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
/* Short screens (1280x720, 1366x768): medallions become a slim column beside the showcase, ascendancies one line each. */
@media (max-height: 820px) and (min-width: 761px) {
  .m-cs { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; gap: 10px; }
  .m-cs-show { grid-template-columns: minmax(180px, 34%) 1fr; }
  .m-cs-fig { min-height: 0; }
  .m-cs-strip { flex-direction: column; flex-wrap: nowrap; justify-content: center; gap: 4px; padding-left: 8px; border-left: 1px solid rgba(140,116,72,0.25); }
  .m-medal { width: auto; padding: 3px; }
  .m-medal canvas { width: 42px; height: 42px; }
  .m-medal span { display: none; }
  .m-cs-blurb { font-size: 13px; line-height: 1.3; }
  .m-cs-head canvas { width: 44px; height: 44px; }
  .m-cs-stat b { font-size: 16px; }
  .m-cs-kit { gap: 3px; }
  .m-cs-v canvas { width: 22px; height: 22px; }
  .m-cs-asc { gap: 3px; }
  .m-cs-ascrow { display: flex; align-items: baseline; gap: 8px; padding: 3px 8px; min-width: 0; }
  .m-cs-ascrow b { flex: none; font-size: 12.5px; }
  .m-cs-ascrow span { flex: 1; min-width: 0; }
}
@media (max-width: 760px) { .m-cs-show { grid-template-columns: 1fr; } .m-cs-fig { min-height: 220px; } .m-cs-fig canvas { max-width: 200px; } }
`;
