// Gore core: settings, materials, seeded randomness, sound. Everything in gfx/gore is original
// procedural Canvas2D art (no assets). Units: world units for positions / sizes, z = height in world units.
import { sfx } from "../../audio/sfx";
import { getSettings, particleCount } from "../../settings";

export type GoreLevelId = "off" | "reduced" | "full" | "extreme";

export function goreLevel(): GoreLevelId {
  return ((getSettings().graphics as { gore?: GoreLevelId }).gore ?? "extreme") as GoreLevelId;
}
/** 0 (off) .. 1 (extreme) multiplier on gore amounts. */
export function goreAmount(): number {
  switch (goreLevel()) {
    case "off":
      return 0;
    case "reduced":
      return 0.3;
    case "full":
      return 0.7;
    default:
      return 1;
  }
}
export function goreCount(n: number): number {
  const a = goreAmount();
  if (a <= 0) return 0;
  return particleCount(n * a);
}
export function persistentBlood(): boolean {
  return (getSettings().graphics as { persistentBlood?: boolean }).persistentBlood !== false;
}
export function extreme() {
  return goreLevel() === "extreme";
}

// ---- materials --------------------------------------------------------------------------------

export const M_BLOOD = 0;
export const M_ICHOR = 1;
export const M_DUST = 2;
export const M_UNDEAD = 3;
export const M_ECTO = 4;
export const M_CHAR = 5;
export const M_ICE = 6;
export const M_CHAOS = 7;
/** Tree sap: what the wooden things (barkgnaw, stumpfather, matriarch, sapspitter) bleed. */
export const M_SAP = 8;
export type Mat = number;

export interface MatDef {
  drop: string[]; // droplet colours (dark .. bright)
  wet: string; // fresh decal colour
  dark: string; // decal core / dried colour
  gloss: string; // wet highlight
  glow: boolean; // drawn unlit (after the darkness)
  pools: boolean; // pools under corpses
}

export const MATS: MatDef[] = [
  { drop: ["#5e0606", "#8a0b0b", "#b0130f", "#c9221a"], wet: "#7a0808", dark: "#3a0303", gloss: "rgba(255,140,120,0.32)", glow: false, pools: true },
  { drop: ["#1d3a10", "#2f5a1c", "#4f7f22", "#78a82e"], wet: "#2a4a14", dark: "#0f1f07", gloss: "rgba(200,255,140,0.28)", glow: false, pools: true },
  { drop: ["#4e463d", "#6c6256", "#8f8474", "#b2a691"], wet: "#4a4339", dark: "#2c2721", gloss: "rgba(0,0,0,0)", glow: false, pools: false },
  { drop: ["#24060a", "#3a0a0e", "#4e1414", "#5e2418"], wet: "#2e0609", dark: "#140204", gloss: "rgba(200,120,100,0.18)", glow: false, pools: true },
  { drop: ["#3ab0a0", "#5fe0c8", "#9affe6", "#e0fff8"], wet: "#1e5a52", dark: "#0c2a26", gloss: "rgba(160,255,230,0.35)", glow: true, pools: true },
  { drop: ["#0c0806", "#1a1410", "#2a201a", "#3a2c22"], wet: "#120d0a", dark: "#070504", gloss: "rgba(0,0,0,0)", glow: false, pools: false },
  { drop: ["#6fb6d8", "#9fd8f2", "#d8f4ff", "#ffffff"], wet: "#9cc8dc", dark: "#5a8ca8", gloss: "rgba(255,255,255,0.5)", glow: false, pools: false },
  { drop: ["#101a06", "#2a3a10", "#4a6a12", "#8aaa22"], wet: "#1a2a0a", dark: "#060a02", gloss: "rgba(200,255,90,0.3)", glow: false, pools: true },
  { drop: ["#5a3404", "#8f5a08", "#bf8412", "#e0aa2a"], wet: "#7a440a", dark: "#3a1e05", gloss: "rgba(255,210,120,0.3)", glow: false, pools: true },
];

// ---- randomness ---------------------------------------------------------------------------------

export const rnd = Math.random;
export const rr = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(a: readonly T[]): T => a[(Math.random() * a.length) | 0];
/** Small seeded PRNG (painters need repeatable shapes when re-drawn each frame). */
export function seeded(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- sound --------------------------------------------------------------------------------------

export type GoreSfx = "gore.splat" | "gore.gib" | "gore.dismember" | "gore.explode" | "gore.squelch" | "gore.bonecrack";
const lastPlay = new Map<string, number>();
export function goreSound(id: GoreSfx, x: number, y: number, vol = 1, pitch = 1) {
  if (goreAmount() <= 0) return;
  const now = performance.now();
  // Light rate limit so a 40-monster explosion doesn't stack 40 identical voices.
  if (now - (lastPlay.get(id) ?? 0) < 35) return;
  lastPlay.set(id, now);
  try {
    sfx.play(id, { x, y, vol, pitch });
  } catch {
    /* audio not ready */
  }
}
