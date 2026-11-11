// Patch notes popup on the main menu: the last 7 days of changelog entries (src/shared/changelog.ts),
// newest first. Opens by itself once per new client version, and from the main menu's button.
import { getLang } from "../i18n";
import { panelHead } from "../progstyle";
import { recentEntries, type ChangelogEntry, type NoteLine } from "../../shared/changelog";

const SEEN_KEY = "hns.lastSeenVersion";

export const PATCHNOTES_CSS = `
.m-pn-back { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(4,3,5,0.62); }
#menu-root > .m-pn-back { margin: 0; }
.m-pn { width: min(620px, 100%); max-height: min(78vh, 760px); display: flex; flex-direction: column; padding: 8px 0 14px; }
.m-pn .pc-head { margin: 0 14px; }
.m-pn-sub { text-align: center; color: var(--m-dim); font-style: italic; font-size: 13px; letter-spacing: 0.06em; margin: 8px 18px 4px; }
.m-pn-body { flex: 1; min-height: 0; overflow: auto; padding: 4px 22px 6px; scrollbar-width: thin; scrollbar-color: rgba(140,116,72,0.55) rgba(0,0,0,0.3); }
.m-pn-body::-webkit-scrollbar { width: 8px; }
.m-pn-body::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
.m-pn-body::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #6a5634, #3e3220); border-radius: 4px; border: 1px solid rgba(0,0,0,0.6); }
.m-pn .m-btn:focus { outline: none; }
.m-pn .m-btn:focus-visible { outline: 1px solid rgba(217,178,106,0.5); outline-offset: 2px; }
.m-pn-ver { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 14px 0 2px; padding-bottom: 4px; border-bottom: 1px solid var(--m-line); }
.m-pn-ver b { font-family: var(--m-title); color: #f0dcb0; letter-spacing: 0.1em; font-size: 17px; }
.m-pn-ver span { color: var(--m-gold-dim); font-size: 12px; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; }
.m-pn .pc-sec { margin: 9px 0 4px; }
.m-pn ul { margin: 0; padding: 0 0 0 18px; }
.m-pn li { font-size: 14px; line-height: 1.45; color: var(--m-ink); margin: 2px 0; }
.m-pn li::marker { color: var(--m-gold-dim); }
.m-pn-foot { display: flex; justify-content: center; padding: 10px 18px 0; }
`;

/** True once per new client version (and records it), so the popup opens by itself only once. */
export function patchNotesDue(version: string): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY) === version) return false;
    localStorage.setItem(SEEN_KEY, version);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the popup inside `root` (the menu root: leaving the screen clears it). Returns a close function.
 * `onClose` runs after it is gone.
 */
export function openPatchNotes(root: HTMLElement, onClose?: () => void): () => void {
  root.querySelector(".m-pn-back")?.remove();
  const back = document.createElement("div");
  back.className = "m-pn-back";
  const panel = document.createElement("div");
  panel.className = "m-panel m-pn";
  const close = () => {
    if (!back.isConnected) return;
    window.removeEventListener("keydown", onKey, true);
    back.remove();
    onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (!back.isConnected) {
      window.removeEventListener("keydown", onKey, true);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
  };
  window.addEventListener("keydown", onKey, true);
  back.addEventListener("mousedown", (e) => {
    if (e.target === back) close();
  });

  const sub = document.createElement("div");
  sub.className = "m-pn-sub";
  sub.textContent = "Changes from the last 7 days";
  const body = document.createElement("div");
  body.className = "m-pn-body";
  const pl = getLang() === "pl";
  for (const e of recentEntries(7)) body.append(entryEl(e, pl));

  const foot = document.createElement("div");
  foot.className = "m-pn-foot";
  const ok = document.createElement("button");
  ok.className = "m-btn";
  ok.textContent = "Close";
  ok.addEventListener("click", close);
  foot.append(ok);

  panel.append(panelHead("Patch notes", null, close), sub, body, foot);
  back.append(panel);
  root.append(back);
  ok.focus();
  return close;
}

function entryEl(e: ChangelogEntry, pl: boolean): HTMLElement {
  const wrap = document.createElement("section");
  const head = document.createElement("div");
  head.className = "m-pn-ver";
  const v = document.createElement("b");
  v.textContent = "v" + e.version;
  v.dataset.noi18n = "";
  const d = document.createElement("span");
  d.textContent = e.date;
  d.dataset.noi18n = "";
  head.append(v, d);
  wrap.append(head);
  const groups: [string, NoteLine[] | undefined][] = [["New", e.new], ["Changes", e.changes], ["Fixes", e.fixes]];
  for (const [label, lines] of groups) {
    if (!lines?.length) continue;
    const h = document.createElement("div");
    h.className = "pc-sec";
    h.textContent = label;
    const ul = document.createElement("ul");
    ul.dataset.noi18n = ""; // lines carry their own Polish
    for (const ln of lines) {
      const li = document.createElement("li");
      li.textContent = pl ? ln.pl : ln.en;
      ul.append(li);
    }
    wrap.append(h, ul);
  }
  return wrap;
}
