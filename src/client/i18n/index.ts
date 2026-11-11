// Client-side localisation. English is the source language: every string in the code base (and
// every string the server sends) stays English, and is translated where it is PRESENTED:
//   - DOM: a MutationObserver translates text nodes and title / placeholder attributes (domI18n);
//   - canvas: the two text renderers (gfx/font.ts, hud/skin/text.ts) call tr() on what they draw.
// A dictionary (./pl*.ts) maps English source strings to the translation. Keys may hold
// placeholders ("Level {n}", "{$who} wins the round!"), which makes them patterns:
//   {n...} / {v}  a number            {x}  any text, itself translated (item names, labels)
//   {$x}          any text, kept as is (player names, keys)
// The value refers to them by the same name (without the $), or is a function of the captures.
// Anything without an entry is shown in English; a key is never shown.
import { getSettings, onChange } from "../settings";
import { composeName } from "./names";
import { PL } from "./pl";
import { PL_CONTENT } from "./pl_content";
import { PL_ITEMS } from "./pl_items";

export type Lang = "en" | "pl";
export type LangSetting = "auto" | Lang;
export type DictVal = string | ((...args: string[]) => string);
export type Dict = Record<string, DictVal>;

/** Polish plural: 1 gracz, 2-4 gracze, 5+ graczy. */
export function plural(n: number | string, one: string, few: string, many: string): string {
  const v = Math.abs(Math.floor(Number(String(n).replace(",", ".")) || 0));
  if (v === 1) return one;
  const d = v % 10;
  const h = v % 100;
  return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? few : many;
}

/** Language of the system / browser ("Windows language" as the browser reports it). */
export function systemLang(): Lang {
  try {
    const list = navigator.languages?.length ? navigator.languages : [navigator.language];
    const first = String(list[0] ?? "").toLowerCase();
    return first.startsWith("pl") ? "pl" : "en";
  } catch {
    return "en";
  }
}

function resolve(): Lang {
  const s = (getSettings().game as { language?: string }).language;
  return s === "en" || s === "pl" ? s : systemLang();
}

let lang: Lang = "en";
try {
  lang = resolve(); // known before the first canvas text is baked
} catch {
  /* settings not ready: initI18n() sets it */
}
export function getLang(): Lang {
  return lang;
}

// ---- dictionary ---------------------------------------------------------------------------------

interface Pat {
  lit: number;
  re: RegExp;
  names: string[];
  raw: boolean[];
  val: DictVal;
}

const NUM = "[-+−]?\\d[\\d.,]*(?:[-–]\\d[\\d.,]*)?";
const exact = new Map<string, DictVal>();
const lower = new Map<string, DictVal>(); // lower-cased keys, for ALL CAPS headings
const buckets = new Map<string, Pat[]>();
const loose: Pat[] = []; // patterns that start with a placeholder

function addDict(d: Dict) {
  for (const key of Object.keys(d)) {
    const val = d[key];
    if (!key.includes("{")) {
      exact.set(key, val);
      const low = key.toLowerCase();
      if (!lower.has(low)) lower.set(low, val);
      continue;
    }
    const names: string[] = [];
    const raw: boolean[] = [];
    let src = "";
    let last = 0;
    const ph = /\{(\$?)([a-zA-Z0-9]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = ph.exec(key))) {
      src += esc(key.slice(last, m.index));
      const numeric = !m[1] && /^(n\d*|v\d*|\d+)$/.test(m[2]);
      src += numeric ? `(${NUM})` : "(.+?)";
      names.push(m[2]);
      raw.push(!!m[1] || numeric);
      last = m.index + m[0].length;
    }
    src += esc(key.slice(last));
    const p: Pat = { lit: key.replace(/\{\$?[a-zA-Z0-9]+\}/g, "").length, re: new RegExp("^" + src + "$"), names, raw, val };
    const lit = key.slice(0, key.indexOf("{"));
    if (lit.length >= 2) {
      const k = lit.slice(0, 2);
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push(p);
    } else loose.push(p);
  }
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

addDict(PL_ITEMS);
addDict(PL_CONTENT);
addDict(PL); // UI last: wins on a clash
// the most specific pattern (most literal text) is tried first
for (const b of buckets.values()) b.sort((a, c) => c.lit - a.lit);
loose.sort((a, c) => c.lit - a.lit);

const cache = new Map<string, string>();
/** Strings seen without a translation (dev aid: window.__i18nMissing in the console). */
const missing = new Set<string>();

function applyVal(val: DictVal, args: string[], names: string[]): string {
  if (typeof val === "function") return val(...args);
  if (!names.length) return val;
  return val.replace(/\{([a-zA-Z0-9]+)\}/g, (all, n: string) => {
    const i = names.indexOf(n);
    return i >= 0 ? args[i] : all;
  });
}

function tryPats(list: Pat[] | undefined, core: string, depth: number): string | null {
  if (!list) return null;
  for (const p of list) {
    const m = p.re.exec(core);
    if (!m) continue;
    const args = p.names.map((_, i) => (p.raw[i] ? m[i + 1] : lookup(m[i + 1], depth + 1) ?? m[i + 1]));
    return applyVal(p.val, args, p.names);
  }
  return null;
}

/** Translation of a trimmed string, or null when there is none. */
function lookup(core: string, depth: number): string | null {
  if (depth > 4 || !/[A-Za-z]/.test(core)) return null;
  const e = exact.get(core);
  if (e !== undefined) return applyVal(e, [], []);
  let r = tryPats(buckets.get(core.slice(0, 2)), core, depth) ?? tryPats(loose, core, depth);
  if (r !== null) return r;
  // "(Label)" alone (a monster's granted modifier tag, "(Brutish)")
  const par = /^\(([^()]+)\)$/.exec(core);
  if (par) {
    const inner = lookup(par[1], depth + 1);
    if (inner !== null) return "(" + inner + ")";
  }
  // "Label:" / "Label…" / "(Label)" without their own entry
  const tail = /^(.*?)([:.!…]|\s*\([^()]*\))$/.exec(core);
  if (tail && tail[1]) {
    const head = lookup(tail[1], depth + 1);
    if (head !== null) {
      const t = tail[2];
      return head + (t.includes("(") ? " (" + (lookup(t.trim().slice(1, -1), depth + 1) ?? t.trim().slice(1, -1)) + ")" : t);
    }
  }
  // Unique drawbacks: "x% reduced Y" is built from the "x% increased Y" label.
  if (core.includes("reduced")) {
    r = lookup(core.replace("reduced", "increased"), depth + 1);
    if (r !== null) return r.replace(/zwiększon/g, "zmniejszon").replace(/Zwiększon/g, "Zmniejszon");
  }
  // "a, b, c" and "a · b" lists of things that each have an entry
  for (const sep of [" · ", ", ", " / ", "+"]) {
    if (!core.includes(sep) || (sep === "+" && core.includes(" "))) continue; // "+": key combos (Ctrl+LMB)
    const parts = core.split(sep);
    const out = parts.map((p) => lookup(p.trim(), depth + 1));
    if (out.some((o) => o !== null)) return parts.map((p, i) => out[i] ?? p).join(sep);
  }
  const name = composeName(core, (s) => lookup(s, depth + 1));
  if (name !== null) return name;
  // lower-case labels ("boots") of something that has a capitalised entry
  if (core === core.toLowerCase()) {
    const e1 = exact.get(core[0].toUpperCase() + core.slice(1));
    if (e1 !== undefined) return applyVal(e1, [], []).toLowerCase();
  }
  // ALL CAPS headings built from a name in code: translate the name, keep the capitals
  if (core.length > 3 && core === core.toUpperCase() && depth < 3) {
    const e2 = lower.get(core.toLowerCase());
    if (e2 !== undefined) return applyVal(e2, [], []).toUpperCase();
  }
  return null;
}

/** Translate an English source string (whitespace around it is kept). Unknown strings come back unchanged. */
export function tr(s: string): string {
  if (lang === "en" || !s) return s;
  let out = cache.get(s);
  if (out !== undefined) return out;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  let core = m[2];
  if (core.includes("\n")) core = core.replace(/\s+/g, " ");
  let r = core ? lookup(core, 0) : null;
  if (r === null && /^[A-Z][\w'-]* [A-Z]/.test(core)) {
    // "Swollen Barkgnaw": a monster modifier in front of a monster name, both known on their own.
    // The modifier can be more than one word ("Thirsting Presence Feral Wolf"): try each split.
    for (let sp = core.indexOf(" "); sp > 0 && r === null; sp = core.indexOf(" ", sp + 1)) {
      const head = lookup(core.slice(0, sp), 0);
      const tail = head === null ? null : lookup(core.slice(sp + 1), 0);
      if (head !== null && tail !== null) r = `${head} ${tail}`;
    }
  }
  out = r === null ? s : m[1] + r + m[3];
  if (r === null && core.length > 1 && /[A-Za-z]{2}/.test(core) && !/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(core) && missing.size < 4000) missing.add(core);
  if (cache.size > 6000) cache.clear();
  cache.set(s, out);
  return out;
}

/** Translate a source string with values filled in: t("Level {n}", { n: 3 }). */
export function t(src: string, vars?: Record<string, string | number>): string {
  return tr(!vars ? src : src.replace(/\{\$?([a-zA-Z0-9]+)\}/g, (all, n: string) => (n in vars ? String(vars[n]) : all)));
}

// ---- DOM ------------------------------------------------------------------------------------------

interface Rec {
  src: string;
  out: string;
}
const textRec = new WeakMap<Node, Rec>();
const attrRec = new WeakMap<Element, Record<string, Rec>>();
const ATTRS = ["title", "placeholder"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CANVAS"]);

/** Player-written text (chat lines, names) opts out with data-noi18n on itself or an ancestor. */
function skipped(el: Element | null): boolean {
  return !el || SKIP_TAGS.has(el.tagName) || !!el.closest("[data-noi18n]");
}

function doText(n: Text, relang: boolean) {
  const cur = n.data;
  const rec = textRec.get(n);
  let src = cur;
  if (rec && rec.out === cur) {
    if (!relang) return;
    src = rec.src;
  }
  if (skipped(n.parentElement)) return;
  const out = tr(src);
  textRec.set(n, { src, out });
  if (out !== cur) n.data = out;
}

function doAttrs(el: Element, relang: boolean) {
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null) continue;
    let recs = attrRec.get(el);
    const rec = recs?.[a];
    let src = cur;
    if (rec && rec.out === cur) {
      if (!relang) continue;
      src = rec.src;
    }
    if (el.closest("[data-noi18n]")) continue;
    const out = tr(src);
    if (!recs) attrRec.set(el, (recs = {}));
    recs[a] = { src, out };
    if (out !== cur) el.setAttribute(a, out);
  }
}

function walk(root: Node, relang: boolean) {
  if (root.nodeType === 3) return doText(root as Text, relang);
  if (root.nodeType !== 1) return;
  const el = root as Element;
  if (SKIP_TAGS.has(el.tagName)) return;
  doAttrs(el, relang);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === 3) doText(n as Text, relang);
    else doAttrs(n as Element, relang);
  }
}

let observer: MutationObserver | null = null;
function observe() {
  if (observer || typeof MutationObserver === "undefined") return;
  observer = new MutationObserver((list) => {
    if (lang === "en") return;
    for (const m of list) {
      if (m.type === "characterData") {
        if (m.target.nodeType === 3) doText(m.target as Text, false);
      } else if (m.type === "attributes") doAttrs(m.target as Element, false);
      else m.addedNodes.forEach((n) => walk(n, false));
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

const langListeners = new Set<(l: Lang) => void>();
/** Called after the language changed (cached canvases that bake text can redraw). */
export function onLangChange(fn: (l: Lang) => void): () => void {
  langListeners.add(fn);
  return () => langListeners.delete(fn);
}

function apply() {
  const next = resolve();
  const changed = next !== lang;
  lang = next;
  cache.clear();
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  if (document.body) walk(document.body, true);
  if (changed) for (const fn of [...langListeners]) fn(lang);
}

/** Start localisation: pick the language (saved choice, else the system's) and keep the DOM translated. */
export function initI18n() {
  apply();
  observe();
  onChange("game", "language" as never, apply);
  if (typeof window !== "undefined") {
    (window as unknown as { __i18nMissing: Set<string> }).__i18nMissing = missing;
    window.addEventListener("languagechange", apply); // system language changed while on Auto
  }
}
