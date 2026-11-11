// Shared styling for the progression UI (class picker, passive tree, character sheet, XP bar).
// Smooth, anti-aliased dark-gothic look. Typefaces come from the look agent's --font-title /
// --font-body variables when defined, with serif fallbacks.

import { actionLabel } from "./keybinds";

const CSS = `
.pg-root { --pg-title: var(--font-title, "Cinzel", "Trajan Pro", "Palatino Linotype", "Book Antiqua", Georgia, serif);
  --pg-body: var(--font-body, "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif);
  --pg-ink: #e2d4b6; --pg-dim: #9a8c74; --pg-faint: #5e5446; --pg-gold: #d8b36a; --pg-gold-dim: #8f7646;
  --pg-blood: #b0281c; --pg-xp: #c9a24a; --pg-line: rgba(216,179,106,0.22);
  font-family: var(--pg-body); color: var(--pg-ink); -webkit-font-smoothing: antialiased; font-smooth: auto; }
.pg-frame { background: radial-gradient(ellipse at 50% 0%, rgba(70,40,26,0.35), transparent 60%),
    linear-gradient(180deg, rgba(22,19,24,0.97), rgba(10,9,12,0.98));
  border: 1px solid rgba(216,179,106,0.35); border-radius: 6px;
  box-shadow: 0 0 0 1px #050405, inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,230,180,0.06), 0 18px 60px rgba(0,0,0,0.85); }
.pg-h { font-family: var(--pg-title); color: var(--pg-gold); letter-spacing: 0.16em; text-transform: uppercase; font-size: 13px; margin: 0; }
.pg-title { font-family: var(--pg-title); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #f0dcb0;
  text-shadow: 0 0 18px rgba(255,170,80,0.25); margin: 0; }
.pg-btn { font-family: var(--pg-title); letter-spacing: 0.14em; text-transform: uppercase; font-size: 12px; cursor: pointer;
  color: var(--pg-ink); background: linear-gradient(180deg, #2a2326, #161215); border: 1px solid rgba(216,179,106,0.4);
  border-radius: 4px; padding: 7px 14px; }
.pg-btn:hover { border-color: var(--pg-gold); color: #fff0cc; box-shadow: 0 0 12px rgba(216,179,106,0.25); }
.pg-btn.on { border-color: var(--pg-gold); color: #ffe7b0; background: linear-gradient(180deg, #3a2c22, #1e1712); }
.pg-btn:disabled { opacity: 0.45; cursor: default; box-shadow: none; }
.pg-x { position: absolute; top: 10px; right: 12px; width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
  background: rgba(0,0,0,0.4); border: 1px solid rgba(216,179,106,0.35); color: var(--pg-dim); font: 16px/26px var(--pg-body); text-align: center; }
.pg-x:hover { color: #fff; border-color: var(--pg-gold); }

/* ---- shared docked-panel chrome (inventory, character, skills, social, tree): one header, one close
   button, one keybind chip, one section heading, one button style. Panels paint the HUD skin behind. */
.pc-head { position: relative; flex: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  height: 36px; padding: 0 44px; margin: 0; font: 700 15px/1 var(--font-title, "Cinzel", "Trajan Pro", "Palatino Linotype", Georgia, serif);
  letter-spacing: 0.3em; text-transform: uppercase; color: #e0c27a; white-space: nowrap; user-select: none;
  text-shadow: 0 1px 0 #000, 0 0 14px rgba(224,150,60,0.28);
  background: linear-gradient(90deg, transparent, rgba(216,184,96,0.5) 18%, rgba(216,184,96,0.5) 82%, transparent) bottom / 100% 1px no-repeat; }
.pc-head .pc-t { overflow: hidden; text-overflow: ellipsis; padding-left: 0.3em; }
.pc-key { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); min-width: 14px; padding: 2px 5px; border-radius: 3px;
  font: 600 10px/1.2 var(--font-body, "Palatino Linotype", Georgia, serif); letter-spacing: 0.04em; text-transform: none; color: #b8a47a; text-align: center;
  background: linear-gradient(180deg, #221c18, #0f0c0b); box-shadow: inset 0 0 0 1px rgba(216,184,96,0.32), 0 1px 0 rgba(0,0,0,0.8); text-shadow: none; }
.pc-x { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; padding: 0; border-radius: 3px; cursor: pointer;
  font: 15px/22px var(--font-body, "Palatino Linotype", Georgia, serif); text-align: center; color: #a89474; letter-spacing: 0;
  background: linear-gradient(180deg, #2a2220, #120e0d); border: 1px solid rgba(216,184,96,0.35); box-shadow: inset 0 1px 0 rgba(255,230,190,0.07), 0 1px 2px rgba(0,0,0,0.8);
  transition: color .1s, border-color .1s, box-shadow .1s; }
.pc-x:hover { color: #fff0d0; border-color: #d8b36a; box-shadow: 0 0 8px rgba(216,179,106,0.35); }
.pc-x:active { transform: translateY(-50%) scale(0.92); background: linear-gradient(180deg, #120e0d, #2a2220); }
.pc-sec { display: flex; align-items: center; gap: 8px; margin: 12px 0 6px; font: 600 11px/1 var(--font-title, "Cinzel", Georgia, serif);
  letter-spacing: 0.2em; text-transform: uppercase; color: #c8a060; }
.pc-sec::before, .pc-sec::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(216,179,106,0.4)); }
.pc-sec::after { background: linear-gradient(90deg, rgba(216,179,106,0.4), transparent); }
.pc-sec small { font: 11px var(--font-body, "Palatino Linotype", Georgia, serif); letter-spacing: 0.02em; text-transform: none; color: #8a7f6c; }
.pc-btn { font: 600 11px/1.2 var(--font-title, "Cinzel", Georgia, serif); letter-spacing: 0.08em; cursor: pointer; color: #e8d8b0; padding: 4px 9px; border-radius: 3px;
  background: linear-gradient(180deg, #3a2c20, #1e1610); border: 1px solid #8a6a3a; box-shadow: inset 0 1px 0 rgba(255,230,190,0.1), 0 1px 2px rgba(0,0,0,0.7); }
.pc-btn:hover:not(:disabled) { border-color: #e0c070; color: #fff2d0; box-shadow: 0 0 8px rgba(224,180,90,0.35), inset 0 1px 0 rgba(255,230,190,0.15); }
.pc-btn:active:not(:disabled) { background: linear-gradient(180deg, #1e1610, #3a2c20); transform: translateY(1px); }
.pc-btn:disabled { opacity: 0.45; cursor: default; }

/* Tooltip */
.pg-tip { position: fixed; z-index: 70; pointer-events: none; max-width: 320px; padding: 10px 13px; display: none;
  font-size: 13px; line-height: 1.45; }
.pg-tip b { display: block; font-family: var(--pg-title); letter-spacing: 0.08em; font-size: 15px; color: #f0dcb0; margin-bottom: 2px; }
.pg-tip i { display: block; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--pg-gold-dim); font-style: normal; margin-bottom: 6px; }
.pg-tip .ln { color: #9fb8ff; }
.pg-tip .neg { color: #e88a6a; }
.pg-tip .fl { color: var(--pg-dim); font-style: italic; margin-top: 6px; }
.pg-tip .hint { color: var(--pg-gold); margin-top: 6px; font-size: 12px; }

/* Class picker */
.pg-classes { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.pg-class { position: relative; cursor: pointer; padding: 10px 10px 11px; border-radius: 6px; text-align: center;
  background: linear-gradient(180deg, rgba(30,26,32,0.95), rgba(14,12,16,0.95)); border: 1px solid rgba(216,179,106,0.18);
  transition: border-color .12s, transform .12s, box-shadow .12s; }
.pg-class:hover { border-color: rgba(216,179,106,0.55); transform: translateY(-1px); }
.pg-class.sel { border-color: var(--pg-gold); box-shadow: 0 0 0 1px rgba(216,179,106,0.4), 0 0 22px rgba(216,150,70,0.22); }
.pg-class canvas { display: block; margin: 0 auto 6px; width: 72px; height: 72px; }
.pg-class b { display: block; font-family: var(--pg-title); letter-spacing: 0.1em; font-size: 14px; color: #f0dcb4; }
.pg-class .at { display: block; font-size: 10px; letter-spacing: 0.22em; color: var(--pg-gold-dim); margin: 2px 0 5px; }
.pg-class .bl { display: block; font-size: 12px; line-height: 1.35; color: var(--pg-dim); min-height: 3.9em; }
.pg-class .as { display: block; margin-top: 6px; font-size: 10.5px; letter-spacing: 0.04em; color: #b9a684; }

/* XP bar / level */
/* hover readout is a canvas hotspot (hud/dock.ts), so the DOM bar never eats the mouse */
#pg-hud { position: fixed; z-index: 6; pointer-events: none; display: none; }
#pg-hud .lvl { position: absolute; right: calc(100% + 5px); bottom: -2px; font: 600 var(--lvsz, 11px)/1 var(--pg-title); letter-spacing: 0.08em;
  color: #d8b36a; white-space: nowrap; text-shadow: 0 1px 1px #000, 0 0 4px #000; }
/* inset groove cut into the stone band */
#pg-hud .bar { position: absolute; inset: 0; overflow: hidden; border-radius: 2px;
  background: linear-gradient(180deg, #050404 0%, #15110e 55%, #1d1814 100%);
  box-shadow: inset 0 1px 1px rgba(0,0,0,0.95), inset 0 -1px 0 rgba(190,170,140,0.14), 0 0 0 1px rgba(0,0,0,0.7); }
#pg-hud .fill { position: absolute; left: 0; top: 1px; bottom: 1px; transition: width .25s ease-out;
  background: linear-gradient(180deg, #f2d898 0%, #c9a24a 45%, #7a5a22 100%); box-shadow: 0 0 6px rgba(216,179,106,0.45); }
#pg-hud .ticks { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0,0,0,0.75) calc(10% - 1px) 10%); }
#pg-hon { position: fixed; left: 50%; top: 12%; transform: translateX(-50%); z-index: 6; pointer-events: none; display: none; text-align: center; }
#pg-hon .h { font-family: var(--pg-title); letter-spacing: 0.24em; font-size: 12px; color: #cfe0ff; text-transform: uppercase; text-shadow: 0 0 10px rgba(120,170,255,0.6); }
#pg-hon .bar { width: 260px; height: 8px; margin-top: 5px; border-radius: 4px; background: rgba(5,4,8,0.85); box-shadow: 0 0 0 1px rgba(150,190,255,0.5); overflow: hidden; }
#pg-hon .fill { height: 100%; background: linear-gradient(180deg, #d8e8ff, #6f9ae8 60%, #3a5aa8); box-shadow: 0 0 10px rgba(140,180,255,0.7); transition: width .15s; }
/* Own lane below the hero: the top-centre column belongs to the target bar, toasts and round banners. */
#pg-banner { position: fixed; left: 50%; top: 17%; transform: translate(-50%, 0); z-index: 7; pointer-events: none; text-align: center; opacity: 0; }
#pg-banner .t { font-family: var(--pg-title); font-weight: 700; font-size: clamp(28px, 4.2vw, 46px); letter-spacing: 0.22em; color: #ffe2a0;
  text-shadow: 0 0 24px rgba(255,170,60,0.65), 0 2px 0 #000; }
#pg-banner .s { font-family: var(--pg-title); letter-spacing: 0.3em; font-size: 13px; color: var(--pg-gold); text-transform: uppercase; margin-top: 4px; text-shadow: 0 1px 2px #000, 0 0 7px #000, 0 0 12px rgba(0,0,0,0.8); }
#pg-banner.show { animation: pg-banner 2.4s ease-out forwards; }
@keyframes pg-banner { 0% { opacity: 0; transform: translate(-50%, 10%) scale(1.15); } 12% { opacity: 1; transform: translate(-50%, 0) scale(1); }
  75% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -6%); } }
`;

let injected = false;
export function ensureProgStyle() {
  if (injected) return;
  injected = true;
  const st = document.createElement("style");
  st.id = "pg-style";
  st.textContent = CSS;
  document.head.append(st);
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/**
 * Shared docked-panel header: centred title, the panel's key on the left (from the live key binds),
 * a close button on the right. `action` is the keybinds action id ("inventory", "skills", ...).
 */
export function panelHead(title: string, action: string | null, onClose: () => void): HTMLDivElement {
  ensureProgStyle();
  const h = el("div", "pc-head");
  h.append(el("span", "pc-t", title));
  if (action) {
    const k = actionLabel(action);
    if (k && k !== "-") {
      const kc = el("span", "pc-key", k);
      kc.title = "Toggle key";
      h.append(kc);
    }
  }
  const x = el("button", "pc-x", "×");
  x.type = "button";
  x.title = "Close";
  x.addEventListener("mousedown", (e) => e.stopPropagation());
  x.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });
  h.append(x);
  return h;
}

/** Shared tooltip element. */
let tipEl: HTMLDivElement | null = null;
export function tooltip(): HTMLDivElement {
  ensureProgStyle();
  if (!tipEl) {
    tipEl = el("div", "pg-root pg-frame pg-tip");
    document.body.append(tipEl);
  }
  return tipEl;
}
export function showTip(html: string, x: number, y: number) {
  const t = tooltip();
  t.innerHTML = html;
  t.style.display = "block";
  const r = t.getBoundingClientRect();
  let tx = x + 18;
  let ty = y + 14;
  if (tx + r.width > innerWidth - 8) tx = x - r.width - 14;
  if (ty + r.height > innerHeight - 8) ty = innerHeight - r.height - 8;
  t.style.left = `${Math.max(8, tx)}px`;
  t.style.top = `${Math.max(8, ty)}px`;
}
export function hideTip() {
  if (tipEl) tipEl.style.display = "none";
}
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
