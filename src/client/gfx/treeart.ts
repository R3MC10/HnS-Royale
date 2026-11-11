// Painted passive-tree node icons (public/art/index.json icons "passive_<family>" and
// "passive_<keystone id>", made with `npm run art`). One picture per STAT FAMILY: a node shows the
// family of its first modifier; keystones have their own. Everything is optional: until the index
// and the image have loaded (or with Painted sprites off) drawPassiveIcon returns false and the
// tree keeps its plain procedural node.
import type { PassiveKey, PassiveMods } from "../../shared/content/passives";
import { getImage, iconSrc } from "./sprites2d/registry";

/** Stat / effect -> icon family. */
const FAMILY: Record<PassiveKey, string> = {
  str: "str", dex: "dex", int: "int", allAttr: "attr", spirit: "attr",
  life: "life", lifeInc: "life", lifeMore: "life", lifeOnKill: "life", lifeLeech: "life", dodgeHeal: "life", cheatDeath: "life", secondWind: "life",
  mana: "mana", manaInc: "mana", manaRegenInc: "mana",
  regen: "regen", noRegen: "regen",
  armour: "armour", armourInc: "armour", armourMore: "armour", noKnockback: "armour", reflect: "armour", dmgTakenMore: "armour",
  evasion: "evasion", evasionInc: "evasion", evadeHaste: "evasion",
  barrier: "barrier", barrierInc: "barrier", barrierMore: "barrier", barrierRechargeMore: "barrier", barrierOnKill: "barrier", barrierLeech: "barrier", dodgeBarrier: "barrier", noBarrierRecharge: "barrier", fullBarrierDmg: "barrier",
  resist: "resist",
  dmgInc: "dmg", dmgMore: "dmg", lowLifeDmg: "dmg", calmDmg: "dmg", firstHitDmg: "dmg", eliteDmg: "dmg", splash: "dmg", postRollDmg: "dmg",
  atkSpeed: "atkspeed", atkSpeedMore: "atkspeed", killRushAtk: "atkspeed", stillAtk: "atkspeed",
  castSpeed: "castspeed", spellInc: "spell",
  reach: "reach", arcInc: "arc", rollStrike: "arc", kbInc: "kb",
  moveInc: "move", killRushMove: "move",
  dodgeCdRed: "dodge", dodgeCdMore: "dodge", iframes: "dodge",
  flaskRecInc: "flask", flaskGainInc: "flask", flaskRecMore: "flask", chargesOnKill: "flask", chargesOnHit: "flask", bountyFlask: "flask",
  pvpDmg: "skull", trophyDmg: "skull", execute: "skull", killNova: "skull", bountyXp: "skull", xpMore: "skull",
};

export interface IconNode {
  id: string;
  kind: string;
  mods: PassiveMods;
}

/** Art id for a node, or null (class starts, jewel sockets, nodes without modifiers). */
export function passiveIconId(n: IconNode): string | null {
  if (n.kind === "start" || n.kind === "jewel") return null;
  if (n.kind === "keystone" && iconSrc("passive_" + n.id)) return "passive_" + n.id;
  for (const k of Object.keys(n.mods)) {
    const f = FAMILY[k as PassiveKey];
    if (f) return "passive_" + f;
  }
  return null;
}

/** Below this many canvas pixels across a painted icon is mush: the node keeps its plain procedural look. */
const MIN_PX = 15;

/** True when the node's painted icon is loaded and legible at `px` canvas pixels across. */
export function passiveIconReady(n: IconNode, px = 99): boolean {
  if (px < MIN_PX) return false;
  const id = passiveIconId(n);
  const src = id ? iconSrc(id) : null;
  return !!src && !!getImage(src);
}

/** 0 = locked (greyed, dim), 1 = can be allocated now (coloured), 2 = allocated (bright). */
export type IconState = 0 | 1 | 2;
const MIPS = [96, 48, 24];
const cache = new Map<string, HTMLCanvasElement[]>();

/**
 * Levels + gamma on the picture itself: the muted oil palette is dark-on-dark at node size, so the
 * subject is stretched over the whole tonal range (brightest 2% -> white) and its midtones lifted.
 * Locked nodes are then part-greyed and dimmed; available / allocated ones stay at full brightness.
 */
function levels(g: CanvasRenderingContext2D, s: number, state: IconState) {
  let id: ImageData;
  try {
    id = g.getImageData(0, 0, s, s);
  } catch {
    return; // (tainted canvas: keep the picture as painted)
  }
  const d = id.data;
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 48) continue;
    hist[Math.max(d[i], d[i + 1], d[i + 2])]++;
    n++;
  }
  if (!n) return;
  let hi = 255;
  for (let acc = 0; hi > 40; hi--) {
    acc += hist[hi];
    if (acc > n * 0.02) break;
  }
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.pow(Math.min(1, v / hi), 0.68) * 255;
  const grey = state === 0 ? 0.45 : 0;
  const dim = state === 0 ? 0.72 : 1;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = lut[d[i]], gg = lut[d[i + 1]], b = lut[d[i + 2]];
    if (grey) {
      const l = 0.3 * r + 0.59 * gg + 0.11 * b;
      r += (l - r) * grey;
      gg += (l - gg) * grey;
      b += (l - b) * grey;
    }
    d[i] = r * dim;
    d[i + 1] = gg * dim;
    d[i + 2] = b * dim;
  }
  g.putImageData(id, 0, 0);
}

function build(im: HTMLImageElement, state: IconState): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  let prev: CanvasImageSource = im;
  for (const s of MIPS) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = s;
    const g = cv.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    if (s === MIPS[0]) {
      const m = s * 0.02;
      g.drawImage(im, m, m, s - m * 2, s - m * 2);
      levels(g, s, state);
    } else g.drawImage(prev, 0, 0, s, s); // halved step by step: a clean small picture
    out.push(cv);
    prev = cv;
  }
  return out;
}

/**
 * Draw a node's painted icon centred on (x, y), `d` css px across (`px` = the same in canvas
 * pixels, for picking the pre-scaled copy). False = no painted art (yet): draw nothing extra.
 */
export function drawPassiveIcon(g: CanvasRenderingContext2D, n: IconNode, x: number, y: number, d: number, px: number, state: IconState): boolean {
  const id = passiveIconId(n);
  if (!id) return false;
  const src = iconSrc(id);
  if (!src) return false;
  const im = getImage(src);
  if (!im) return false;
  if (px < MIN_PX) return false;
  const key = src + "|" + state;
  let mips = cache.get(key);
  if (!mips) cache.set(key, (mips = build(im, state)));
  let cv = mips[0];
  for (const m of mips) if (m.width >= px) cv = m;
  g.drawImage(cv, x - d / 2, y - d / 2, d, d);
  return true;
}
