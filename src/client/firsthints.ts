// First-spawn controls strip: shown once per browser (localStorage), on the first spawn only.
// Dismissed by its close button, or on its own after 40 s.
import { actionLabel, skillSlotLabel } from "./keybinds";

const KEY = "hns-hints-seen";
let el: HTMLDivElement | null = null;

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // no storage: never nag
  }
}

function dismiss() {
  if (!el) return;
  const e = el;
  el = null;
  e.style.opacity = "0";
  setTimeout(() => e.remove(), 400);
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

/** A docked panel or the passive tree is open: the strip steps aside until it closes (hud/dock.ts, every frame). */
export function yieldFirstHints(on: boolean): void {
  if (el) el.style.display = on ? "none" : "flex";
}

export function showFirstHints(): void {
  if (el || seen() || typeof document === "undefined") return;
  const k = (id: string) => actionLabel(id);
  const rows: [string, string][] = [
    [`${k("moveUp")} ${k("moveLeft")} ${k("moveDown")} ${k("moveRight")}`, "Move"],
    [skillSlotLabel(0), "Attack"],
    [k("dodge"), "Dodge"],
    [k("flask0"), "Life flask"],
    [k("pickup"), "Pick up"],
    [k("inventory"), "Inventory"],
    [k("tree"), "Passives"],
    [k("skills"), "Skills"],
  ];
  el = document.createElement("div");
  el.style.cssText =
    "position:fixed;left:50%;top:13%;transform:translateX(-50%);z-index:40;display:flex;gap:14px;align-items:center;" +
    "padding:7px 12px;background:rgba(14,11,9,0.86);border:1px solid #6b5a3a;border-radius:3px;box-shadow:0 2px 10px rgba(0,0,0,0.6);" +
    "font:13px Georgia,'Times New Roman',serif;color:#d8ccb0;white-space:nowrap;transition:opacity 0.4s;user-select:none";
  for (const [key, what] of rows) {
    if (!key || key.replace(/[\s-]/g, "") === "") continue; // unbound
    const s = document.createElement("span");
    s.style.fontVariantNumeric = "lining-nums";
    const b = document.createElement("b");
    b.textContent = key;
    b.style.cssText = "color:#f0d890;font-weight:normal;border:1px solid #5a4c30;border-radius:2px;padding:0 5px;margin-right:5px;background:rgba(40,32,20,0.9)";
    s.append(b, what);
    el.append(s);
  }
  const x = document.createElement("button");
  x.textContent = "\u00d7";
  x.title = "Hide";
  x.style.cssText = "background:none;border:none;color:#b0a080;font:18px Georgia,serif;cursor:pointer;padding:0 2px;line-height:1";
  x.addEventListener("click", (e) => {
    e.stopPropagation();
    dismiss();
  });
  el.append(x);
  document.body.append(el);
  setTimeout(dismiss, 40000);
}
