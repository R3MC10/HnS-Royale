// Palette-indexed 12x12 item icons (original pixel art), plus HUD frame pieces.
import { FLASK_BASE_BY_ID } from "../../shared/content/flasks";
import { BASE_BY_ID } from "../../shared/content/bases";
import type { Item } from "../../shared/items";
import { PixBuf, rgba, type Sprite, sprite } from "./pixel";

const PAL: Record<string, string> = {
  k: "#0c0a0b", // outline
  s: "#e9eef3", // steel light
  m: "#a2abb6", // steel mid
  d: "#5b636e", // steel dark
  w: "#7a5532", // wood
  W: "#4a311b", // wood dark
  b: "#c9a24a", // brass
  B: "#7d6128", // brass dark
  l: "#8a5a34", // leather
  L: "#55351d", // leather dark
  c: "#6c7480", // chain
  C: "#3c424b",
  h: "#3a3f3c", // hood cloth
  r: "#b8303f", // red liquid
  R: "#6e1823",
  g: "#c4d2d8", // glass
  G: "#6d8790",
  y: "#e6d27a", // gem
  e: "#5ad1c9", // gem cyan
  p: "#9b6ad8", // gem purple
};

const ICONS: Record<string, string[]> = {
  sword: [
    "..........kk",
    ".........ksk",
    "........ksmk",
    ".......ksmk.",
    "......ksmk..",
    "..k..ksmk...",
    "..kkksmk....",
    "...kbmk.....",
    "..kWkbk.....",
    ".kWk.kbk....",
    "kWk...kk....",
    "kk..........",
  ],
  spear: [
    ".........kkk",
    "........ksmk",
    ".......ksmdk",
    "........kdk.",
    ".......kbk..",
    "......kwk...",
    ".....kwk....",
    "....kwk.....",
    "...kwk......",
    "..kwk.......",
    ".kWk........",
    ".kk.........",
  ],
  axe: [
    "....kkkk....",
    "...ksssmk...",
    "..ksmmmmdk..",
    "..ksmkkkkk..",
    "..kmdkwk....",
    "...kkkwk....",
    ".....kwk....",
    ".....kwk....",
    ".....kwk....",
    ".....kWk....",
    ".....kWk....",
    ".....kkk....",
  ],
  dagger: [
    "............",
    ".........kk.",
    "........ksk.",
    ".......ksmk.",
    "......ksmk..",
    "....kksmk...",
    "....kbmk....",
    "...kWkbk....",
    "..kWk.k.....",
    "..kk........",
    "............",
    "............",
  ],
  offhand: [
    "....kkkk....",
    "..kkllllkk..",
    ".kllLllllLk.",
    ".klLlllllLk.",
    "kllllbbllllk",
    "klllbmmblllk",
    "klllbmmblllk",
    "kllllbbllllk",
    ".kLllllllLk.",
    ".kLLllllLLk.",
    "..kkLLLLkk..",
    "....kkkk....",
  ],
  helmet: [
    "............",
    "....kkkk....",
    "...kmssmk...",
    "..kmsmmmdk..",
    "..kmmmmmdk..",
    ".kmmmmmmmdk.",
    ".kmkkkkkkdk.",
    ".kmmmmmmmdk.",
    ".kdmkmmkmdk.",
    ".kddk..kddk.",
    "..kk....kk..",
    "............",
  ],
  body: [
    "............",
    "..kkk..kkk..",
    ".kcckkkkcck.",
    "kcccCccCcccC",
    "kccCcccccCck",
    "kkkcCcccCckk",
    "..kccCcCcck.",
    "..kcCcccCck.",
    "..kccbbbcck.",
    "..kcCcccCck.",
    "..kkkkkkkkk.",
    "............",
  ],
  gloves: [
    "............",
    "...k.k.k....",
    "..klklklk...",
    "..klklklk.k.",
    "..klllllkklk",
    "..kllllllllk",
    "..klllllllk.",
    "..kLlllllk..",
    "..kbbbbbbk..",
    "..kLLLLLLk..",
    "...kkkkkk...",
    "............",
  ],
  boots: [
    "............",
    "...kkkk.....",
    "...kllk.....",
    "...kllk.....",
    "...kbbk.....",
    "...kllk.....",
    "...klllk....",
    "...kllllkk..",
    "..kllllllk..",
    "..kLLLLLLLk.",
    "..kkkkkkkkk.",
    "............",
  ],
  amulet: [
    "..k......k..",
    "..kB....Bk..",
    "...kB..Bk...",
    "....kBBk....",
    ".....kk.....",
    "....kbbk....",
    "...kbeebk...",
    "...kbeebk...",
    "....kbbk....",
    ".....kk.....",
    "............",
    "............",
  ],
  ring: [
    "............",
    "............",
    ".....kk.....",
    "....kppk....",
    "...kkbbkk...",
    "..kbBkkBbk..",
    "..kbk..kbk..",
    "..kbk..kbk..",
    "..kBbkkbBk..",
    "...kkBBkk...",
    "....kkkk....",
    "............",
  ],
  belt: [
    "............",
    "............",
    "............",
    "kkkkkkkkkkkk",
    "klLlLkkkLlLl",
    "kllllkbbkllk",
    "kLlLlkbbkLlL",
    "kkkkkkkkkkkk",
    "...kRk.kRk..",
    "...krk.krk..",
    "...kkk.kkk..",
    "............",
  ],
  bow: [
    "......kkk...",
    ".....kwwk...",
    "....kwk.k...",
    "...kwk..k...",
    "...kwk..k...",
    "..kbk...k...",
    "..kbk...k...",
    "...kwk..k...",
    "...kwk..k...",
    "....kwk.k...",
    ".....kwwk...",
    "......kkk...",
  ],
  staff: [
    ".......kkk..",
    "......kepk..",
    "......kpek..",
    ".......kk...",
    "......kwk...",
    ".....kwk....",
    ".....kwk....",
    "....kwk.....",
    "....kWk.....",
    "...kWk......",
    "...kWk......",
    "...kk.......",
  ],
  gem: [
    "............",
    "............",
    "....kkkk....",
    "...keeeek...",
    "..keyeeeek..",
    "..keeeeeGk..",
    "..keeeeGGk..",
    "...keeGGk...",
    "....kGGk....",
    ".....kk.....",
    "............",
    "............",
  ],
  flask: [
    "....kkkk....",
    "....kwWk....",
    "....kkkk....",
    "....kgGk....",
    "...kgGGGk...",
    "..kgrrrrGk..",
    ".kgrrrrrrGk.",
    ".kgrrrrrrRk.",
    ".kgrrrrrRRk.",
    "..kRrrrRRk..",
    "...kkkkkk...",
    "............",
  ],
};

function build(rows: string[], pal: Record<string, string>): PixBuf {
  const buf = new PixBuf(12, 12);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const ch = rows[y][x];
      if (ch && ch !== ".") buf.set(x, y, rgba(pal[ch]));
    }
  }
  return buf;
}

const cache = new Map<string, Sprite>();
export function iconSprite(kind: string, variant = 0): Sprite {
  const key = `${kind}|${variant}`;
  let s = cache.get(key);
  if (s) return s;
  let pal = PAL;
  if (variant === 2) pal = { ...PAL, l: "#6c7480", L: "#3c424b", c: "#9aa3ae", C: "#5b616c" }; // heavier metal look
  s = sprite(build(ICONS[kind] ?? ICONS.ring, pal), 6, 11);
  cache.set(key, s);
  return s;
}

/** Icon kind for an item. */
export function itemIconKind(item: Item): { kind: string; variant: number } {
  if (FLASK_BASE_BY_ID.has(item.b)) return { kind: "flask", variant: 0 };
  const base = BASE_BY_ID.get(item.b);
  if (!base) return { kind: "ring", variant: 0 };
  if (base.weapon) return { kind: base.weapon.kind, variant: 0 };
  return { kind: base.cls, variant: base.vis ?? 0 };
}

/** Flask bottle icon with a given fill level (0..1), larger for the HUD. */
export function flaskIcon(fill: number, usable: boolean): HTMLCanvasElement {
  const lv = Math.round(Math.max(0, Math.min(1, fill)) * 10);
  const key = `flask|${lv}|${usable ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit.cv;
  const rows = ICONS.flask;
  const buf = new PixBuf(12, 12);
  const liquidTop = 9 - Math.round((lv / 10) * 5); // rows 5..9 hold liquid
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      let ch = rows[y][x];
      if (ch === ".") continue;
      if ((ch === "r" || ch === "R") && y < liquidTop) ch = "G";
      let col = PAL[ch];
      if (!usable && (ch === "r" || ch === "R")) col = ch === "r" ? "#6a2632" : "#3e1219";
      buf.set(x, y, rgba(col));
    }
  }
  // Liquid surface highlight
  if (lv > 0) for (let x = 3; x < 9; x++) if (rows[liquidTop]?.[x] === "r") buf.set(x, liquidTop, rgba(usable ? "#ff6a72" : "#8a3a44"));
  const s = sprite(buf, 6, 11);
  cache.set(key, s);
  return s.cv;
}
