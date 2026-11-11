// Smooth, anti-aliased art for the gems system: skill icons (bar, Skills panel) and gem item art
// (inventory cells). Colour follows the gem's attribute: red = Str, green = Dex, blue = Int.
// All shapes are original: faceted cut gems for skill gems, round cabochons for supports,
// a raw crystal cluster for rough (uncut) crystals.
import { ATTR_COLOR, SKILL_GEM_BY_ID, SUPPORT_GEM_BY_ID, type SkillKind } from "../../shared/content/gems";
import type { Item } from "../../shared/items";
import { artVersion, getImage, iconSrc } from "./sprites2d/registry";
import { gemColor, isRough, isSkillGem, isSupportGem, skillDefOf, supportDefOf, supportTier } from "../../shared/skills";

type G = CanvasRenderingContext2D;

function rad(g: G, x: number, y: number, r: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(0.01, r));
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

function glow(g: G, x: number, y: number, r: number, col: string, a = 1) {
  g.save();
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = a;
  g.fillStyle = rad(g, x, y, r, [[0, col], [1, "rgba(0,0,0,0)"]]);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** #rrggbb mixed toward white (k > 0) or black (k < 0). */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  let r = (n >> 16) & 255;
  let gg = (n >> 8) & 255;
  let b = n & 255;
  const t = k > 0 ? 255 : 0;
  const f = Math.abs(k);
  r = Math.round(r + (t - r) * f);
  gg = Math.round(gg + (t - gg) * f);
  b = Math.round(b + (t - b) * f);
  return `rgb(${r},${gg},${b})`;
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---- skill glyphs ------------------------------------------------------------------

/** White-ish emblem for a skill kind, centred at (cx, cy) with radius r. */
/** Glyph of a gem: its kind, or a closer picture for the kinds that hold several different skills. */
export type GlyphKind = SkillKind | "basic" | "glaive" | "lance" | "barrage";
export function glyphOf(def: { kind: SkillKind; pierce?: boolean; returns?: boolean; ramp?: unknown } | null | undefined): GlyphKind {
  if (!def) return "basic";
  if (def.returns) return "glaive";
  if (def.ramp) return "barrage";
  if (def.pierce && def.kind === "bolt") return "lance";
  return def.kind;
}

export function drawGlyph(g: G, cx: number, cy: number, r: number, kind: GlyphKind, col: string) {
  g.save();
  g.translate(cx, cy);
  g.lineCap = "round";
  g.lineJoin = "round";
  const light = shade(col, 0.75);
  g.strokeStyle = light;
  g.fillStyle = light;
  g.shadowColor = col;
  g.shadowBlur = r * 0.5;
  const lw = Math.max(1, r * 0.13);
  g.lineWidth = lw;
  switch (kind) {
    case "basic": {
      // a plain blade
      g.rotate(-Math.PI / 4);
      g.beginPath();
      g.moveTo(0, -r * 0.9);
      g.lineTo(r * 0.14, -r * 0.65);
      g.lineTo(r * 0.12, r * 0.35);
      g.lineTo(-r * 0.12, r * 0.35);
      g.lineTo(-r * 0.14, -r * 0.65);
      g.closePath();
      g.fill();
      g.fillRect(-r * 0.36, r * 0.35, r * 0.72, r * 0.12);
      g.fillRect(-r * 0.07, r * 0.47, r * 0.14, r * 0.4);
      break;
    }
    case "strike": {
      // a crescent slash
      g.beginPath();
      g.arc(-r * 0.25, r * 0.25, r * 0.95, -Math.PI * 0.62, Math.PI * 0.12);
      g.arc(-r * 0.45, r * 0.45, r * 0.95, Math.PI * 0.08, -Math.PI * 0.55, true);
      g.closePath();
      g.fill();
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo(-r * 0.75, r * 0.75);
      g.lineTo(-r * 0.2, r * 0.2);
      g.stroke();
      break;
    }
    case "slam": {
      // a fist-hammer coming down onto a cracked line
      g.beginPath();
      g.roundRect(-r * 0.42, -r * 0.85, r * 0.84, r * 0.55, r * 0.12);
      g.fill();
      g.fillRect(-r * 0.08, -r * 0.3, r * 0.16, r * 0.45);
      g.beginPath();
      g.moveTo(-r * 0.9, r * 0.45);
      g.lineTo(-r * 0.4, r * 0.32);
      g.lineTo(-r * 0.15, r * 0.6);
      g.lineTo(r * 0.15, r * 0.3);
      g.lineTo(r * 0.45, r * 0.62);
      g.lineTo(r * 0.9, r * 0.42);
      g.stroke();
      break;
    }
    case "volley": {
      // three fanned shards
      for (const a of [-0.45, 0, 0.45]) {
        g.save();
        g.rotate(a - Math.PI / 4);
        g.beginPath();
        g.moveTo(0, -r * 0.92);
        g.lineTo(r * 0.12, -r * 0.6);
        g.lineTo(r * 0.04, r * 0.75);
        g.lineTo(-r * 0.04, r * 0.75);
        g.lineTo(-r * 0.12, -r * 0.6);
        g.closePath();
        g.fill();
        g.restore();
      }
      break;
    }
    case "bolt": {
      // a comet: bright head with a flared tail
      g.rotate(-Math.PI / 4);
      g.beginPath();
      g.moveTo(0, -r * 0.55);
      g.quadraticCurveTo(r * 0.5, r * 0.2, 0, r * 0.95);
      g.quadraticCurveTo(-r * 0.5, r * 0.2, 0, -r * 0.55);
      g.globalAlpha = 0.55;
      g.fill();
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(0, -r * 0.42, r * 0.36, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "cone": {
      // a fan of gusting lines
      g.lineWidth = lw * 0.9;
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI * 0.85 + i * 0.32;
        g.beginPath();
        g.moveTo(-r * 0.7, r * 0.7);
        const ex = -r * 0.7 + Math.cos(a + Math.PI / 2.2) * r * 1.5;
        const ey = r * 0.7 + Math.sin(a + Math.PI / 2.2) * r * 1.5;
        g.quadraticCurveTo(-r * 0.7 + (ex + r * 0.7) * 0.5 + r * 0.15, r * 0.7 + (ey - r * 0.7) * 0.5 + r * 0.1, ex, ey);
        g.stroke();
      }
      // snow flecks
      for (const [x, y] of [[0.35, -0.45], [0.55, 0.05], [0.0, -0.7]]) {
        g.beginPath();
        g.arc(x * r, y * r, r * 0.08, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "chain": {
      // a forking thread of lightning
      g.beginPath();
      g.moveTo(-r * 0.85, -r * 0.6);
      g.lineTo(-r * 0.25, -r * 0.2);
      g.lineTo(-r * 0.4, r * 0.1);
      g.lineTo(r * 0.2, r * 0.35);
      g.lineTo(r * 0.05, r * 0.6);
      g.lineTo(r * 0.85, r * 0.85);
      g.moveTo(-r * 0.25, -r * 0.2);
      g.lineTo(r * 0.35, -r * 0.4);
      g.lineTo(r * 0.8, -r * 0.15);
      g.stroke();
      for (const [x, y] of [[-0.85, -0.6], [0.85, 0.85], [0.8, -0.15]]) {
        g.beginPath();
        g.arc(x * r, y * r, r * 0.13, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "dash": {
      // a sweeping streak and three speed lines
      g.beginPath();
      g.moveTo(r * 0.85, -r * 0.1);
      g.quadraticCurveTo(r * 0.2, -r * 0.55, -r * 0.6, -r * 0.4);
      g.quadraticCurveTo(r * 0.1, -r * 0.2, r * 0.85, -r * 0.1);
      g.fill();
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(-r * 0.85 + i * r * 0.15, r * (0.05 + i * 0.27));
        g.lineTo(r * (0.5 - i * 0.12), r * (0.05 + i * 0.27));
        g.globalAlpha = 1 - i * 0.25;
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    }
    case "buff": {
      // a rising flame inside a ring
      g.lineWidth = lw * 0.7;
      g.beginPath();
      g.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(0, -r * 0.65);
      g.bezierCurveTo(r * 0.55, -r * 0.1, r * 0.45, r * 0.55, 0, r * 0.6);
      g.bezierCurveTo(-r * 0.45, r * 0.55, -r * 0.5, 0, -r * 0.1, -r * 0.25);
      g.bezierCurveTo(-r * 0.05, 0, r * 0.05, -r * 0.3, 0, -r * 0.65);
      g.fill();
      break;
    }
    case "totem": {
      // a carved post with a burning crown
      g.beginPath();
      g.roundRect(-r * 0.22, -r * 0.3, r * 0.44, r * 1.15, r * 0.06);
      g.fill();
      g.fillRect(-r * 0.45, r * 0.7, r * 0.9, r * 0.15);
      g.beginPath();
      g.moveTo(0, -r * 0.95);
      g.quadraticCurveTo(r * 0.4, -r * 0.55, 0, -r * 0.38);
      g.quadraticCurveTo(-r * 0.4, -r * 0.55, 0, -r * 0.95);
      g.fill();
      break;
    }
    case "aura": {
      // three concentric broken rings around a core
      g.lineWidth = lw * 0.75;
      for (let i = 0; i < 3; i++) {
        const rr = r * (0.35 + i * 0.27);
        g.globalAlpha = 1 - i * 0.22;
        g.beginPath();
        g.arc(0, 0, rr, i * 0.9, i * 0.9 + Math.PI * 1.55);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(0, 0, r * 0.16, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "spin": {
      // two blades chasing each other round a hub
      g.lineWidth = lw * 1.5;
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.arc(0, 0, r * 0.72, i * Math.PI - 0.5, i * Math.PI + 1.75);
        g.stroke();
        const a = i * Math.PI + 1.75;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98);
        g.lineTo(Math.cos(a + 0.5) * r * 0.7, Math.sin(a + 0.5) * r * 0.7);
        g.lineTo(Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46);
        g.closePath();
        g.fill();
      }
      g.beginPath();
      g.arc(0, 0, r * 0.16, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "leap": {
      // a high arc that ends in an impact burst
      g.lineWidth = lw;
      g.setLineDash([r * 0.2, r * 0.16]);
      g.beginPath();
      g.moveTo(-r * 0.85, r * 0.55);
      g.quadraticCurveTo(-r * 0.2, -r * 1.25, r * 0.45, r * 0.3);
      g.stroke();
      g.setLineDash([]);
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i / 4) * Math.PI;
        g.beginPath();
        g.moveTo(r * 0.45 + Math.cos(a) * r * 0.2, r * 0.55 + Math.sin(a) * r * 0.14);
        g.lineTo(r * 0.45 + Math.cos(a) * r * 0.55, r * 0.55 + Math.sin(a) * r * 0.42);
        g.stroke();
      }
      break;
    }
    case "blast": {
      // a bolt from above striking a marked circle
      g.lineWidth = lw * 0.7;
      g.beginPath();
      g.ellipse(0, r * 0.55, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(r * 0.3, -r * 0.95);
      g.lineTo(-r * 0.3, -r * 0.1);
      g.lineTo(r * 0.08, -r * 0.1);
      g.lineTo(-r * 0.12, r * 0.6);
      g.lineTo(r * 0.42, -r * 0.32);
      g.lineTo(r * 0.06, -r * 0.32);
      g.closePath();
      g.fill();
      break;
    }
    case "trap": {
      // a toothed snare lying open
      g.lineWidth = lw;
      g.beginPath();
      g.arc(0, r * 0.1, r * 0.8, Math.PI, 0);
      g.stroke();
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const x = -r * 0.8 + (i / 6) * r * 1.6;
        g.lineTo(x, r * 0.1 + (i % 2 ? -r * 0.4 : 0));
      }
      g.stroke();
      g.fillRect(-r * 0.9, r * 0.22, r * 1.8, r * 0.16);
      g.beginPath();
      g.arc(0, r * 0.62, r * 0.14, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "guard": {
      // a kite shield with a boss
      g.beginPath();
      g.moveTo(-r * 0.68, -r * 0.75);
      g.lineTo(r * 0.68, -r * 0.75);
      g.lineTo(r * 0.68, r * 0.05);
      g.quadraticCurveTo(r * 0.55, r * 0.7, 0, r * 0.95);
      g.quadraticCurveTo(-r * 0.55, r * 0.7, -r * 0.68, r * 0.05);
      g.closePath();
      g.lineWidth = lw * 1.3;
      g.stroke();
      g.globalAlpha *= 0.35;
      g.fill();
      g.globalAlpha /= 0.35;
      g.fillRect(-r * 0.07, -r * 0.55, r * 0.14, r * 1.1);
      g.fillRect(-r * 0.45, -r * 0.2, r * 0.9, r * 0.14);
      break;
    }
    case "glaive": {
      // a three-bladed throwing wheel with a return arc
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - 0.4;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.12, Math.sin(a) * r * 0.12);
        g.quadraticCurveTo(Math.cos(a + 0.9) * r * 0.5, Math.sin(a + 0.9) * r * 0.5, Math.cos(a + 0.5) * r * 0.82, Math.sin(a + 0.5) * r * 0.82);
        g.quadraticCurveTo(Math.cos(a + 0.2) * r * 0.5, Math.sin(a + 0.2) * r * 0.5, Math.cos(a - 0.5) * r * 0.2, Math.sin(a - 0.5) * r * 0.2);
        g.closePath();
        g.fill();
      }
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.arc(0, 0, r * 0.98, -Math.PI * 0.95, -Math.PI * 0.35);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.98, Math.PI * 0.05, Math.PI * 0.65);
      g.stroke();
      break;
    }
    case "lance": {
      // a long faceted shard passing through a ring
      g.rotate(-Math.PI / 4);
      g.beginPath();
      g.moveTo(0, -r * 1.0);
      g.lineTo(r * 0.2, -r * 0.35);
      g.lineTo(r * 0.1, r * 0.95);
      g.lineTo(-r * 0.1, r * 0.95);
      g.lineTo(-r * 0.2, -r * 0.35);
      g.closePath();
      g.fill();
      g.lineWidth = lw * 0.8;
      g.beginPath();
      g.ellipse(0, r * 0.1, r * 0.55, r * 0.2, 0, 0, Math.PI * 2);
      g.stroke();
      break;
    }
    case "barrage": {
      // a rising stream of arrows, each closer than the last
      g.rotate(-Math.PI / 4);
      for (const [x, y, k] of [[-0.45, 0.35, 0.7], [0, 0, 1], [0.45, 0.4, 0.7], [-0.22, 0.75, 0.5], [0.22, 0.8, 0.5]] as const) {
        g.beginPath();
        g.moveTo(x * r, (y - 0.95) * r);
        g.lineTo(x * r + r * 0.15 * k, (y - 0.95) * r + r * 0.3 * k);
        g.lineTo(x * r - r * 0.15 * k, (y - 0.95) * r + r * 0.3 * k);
        g.closePath();
        g.fill();
        g.fillRect(x * r - r * 0.035, (y - 0.95) * r + r * 0.3 * k, r * 0.07, r * 0.75 * k);
      }
      break;
    }
    case "meta": {
      // a rune circle with a socket in the middle
      g.lineWidth = lw * 0.7;
      g.beginPath();
      g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        g.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
      }
      g.closePath();
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.22, 0, Math.PI * 2);
      g.fill();
      break;
    }
  }
  g.restore();
}

// ---- skill icon (bar / panel) --------------------------------------------------------------

const iconCache = new Map<string, HTMLCanvasElement>();

// Painted skill pictures (public/art/index.json icons): "skill_<id>" shows what the skill does,
// "skillsup_<id>" what a support adds. Fallbacks: the gem item picture ("gem_<id>" / "sup_<id>", the
// same art the inventory shows), then the drawn glyph while nothing has loaded.
let paintedVer = 0;
const paintedWait = new Set<string>();
function painted(ids: string[]): { im: HTMLImageElement | null; src: string | null; own: boolean } {
  for (let k = 0; k < ids.length; k++) {
    const src = iconSrc(ids[k]);
    if (!src) continue;
    const im = getImage(src);
    if (!im && !paintedWait.has(src)) {
      paintedWait.add(src);
      const probe = new Image();
      probe.onload = () => paintedVer++;
      probe.src = src;
    }
    return { im, src, own: k === 0 && !ids[k].startsWith("gem_") && !ids[k].startsWith("sup_") };
  }
  return { im: null, src: null, own: false };
}
/** Skill id as used by skillIcon: "" = melee basic attack, "basic_ranged" = bow basic attack. */
const skillArtIds = (id: string) => (id === "" ? ["skill_basic_melee"] : id === "basic_ranged" ? ["skill_basic_ranged"] : ["skill_" + id, "gem_" + id]);
const supportArtIds = (id: string) => ["skillsup_" + id, "sup_" + id];
/** Changes when a painted skill icon became available: callers holding a skillIcon redraw. */
export function skillIconVersion(): number {
  return artVersion() * 1000 + paintedVer;
}

/** Tooltip header picture for a skill ("skill") or support gem ("support"); "" when there is no painted art. */
export function tipIconHtml(kind: "skill" | "support", id: string): string {
  const { src } = painted(kind === "skill" ? skillArtIds(id) : supportArtIds(id));
  if (!src) return "";
  const attr = kind === "skill" ? SKILL_GEM_BY_ID.get(id)?.attr : SUPPORT_GEM_BY_ID.get(id)?.attr;
  const col = attr ? ATTR_COLOR[attr] : "#c8b890";
  return `<span class="tt-ico${kind === "support" ? " round" : ""}" style="background:radial-gradient(circle at 50% 42%, ${shade(col, -0.35)}, ${shade(col, -0.78)} 70%, #06060a)"><img src="${src}" alt=""></span>`;
}

/** Tooltip header picture for a gem item (what the skill does / the support adds); "" for crystals and non-gems. */
export function gemTipIcon(it: Item): string {
  const d = isSkillGem(it) ? skillDefOf(it) : undefined;
  if (d) return tipIconHtml("skill", d.id);
  const sd = isSupportGem(it) ? supportDefOf(it) : undefined;
  return sd ? tipIconHtml("support", sd.id) : "";
}

function newCanvas(size: number): [HTMLCanvasElement, G, number] {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.round(size * dpr);
  cv.style.width = cv.style.height = size + "px";
  const g = cv.getContext("2d")!;
  g.scale(dpr, dpr);
  return [cv, g, dpr];
}

/** Painted subject over the socket backdrop: a tight dark rim + soft drop shadow keep it off the tinted ground at 19-32 px. */
function drawArt(g: G, art: HTMLImageElement, s: number, m: number) {
  g.save();
  g.imageSmoothingQuality = "high";
  g.shadowColor = "rgba(0,0,0,0.95)";
  g.shadowBlur = Math.max(1.5, s * 0.07);
  g.drawImage(art, m, m, s - m * 2, s - m * 2);
  g.shadowBlur = Math.max(1, s * 0.03);
  g.drawImage(art, m, m, s - m * 2, s - m * 2);
  // small self-add: the muted oil palette goes flat when shrunk to bar size
  g.shadowColor = "transparent";
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = 0.22;
  g.drawImage(art, m, m, s - m * 2, s - m * 2);
  g.restore();
}

/** A square skill icon of `size` css px (cached: ONE element per id+size, use skillIconCopy for more). id "" / "basic_ranged" = the free weapon attack. */
export function skillIcon(id: string, size: number): HTMLCanvasElement {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const { im: art, own } = painted(skillArtIds(id));
  const key = `${id}|${size}|${dpr}|${art ? (own ? 2 : 1) : 0}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const def = SKILL_GEM_BY_ID.get(id);
  const col = def ? ATTR_COLOR[def.attr] : "#c8b890";
  const [cv, g] = newCanvas(size);
  const s = size;
  const cr = s * 0.14;
  g.beginPath();
  g.roundRect(0, 0, s, s, cr);
  g.fillStyle = rad(g, s * 0.5, s * 0.42, s * 0.8, [[0, shade(col, own ? -0.22 : -0.35)], [0.6, shade(col, own ? -0.68 : -0.75)], [1, "#06060a"]]);
  g.fill();
  g.save();
  g.clip();
  glow(g, s * 0.5, s * 0.45, s * 0.55, rgba(col, own ? 0.4 : 0.55));
  if (!own) {
    // faint facet lines (a cut-gem backdrop)
    g.strokeStyle = rgba("#ffffff", 0.06);
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(s / 2, s / 2);
      g.lineTo(s / 2 + Math.cos(a) * s, s / 2 + Math.sin(a) * s);
      g.stroke();
    }
  }
  if (art) drawArt(g, art, s, own ? s * 0.02 : s * 0.03);
  g.restore();
  if (!art) drawGlyph(g, s / 2, s / 2, s * 0.34, glyphOf(def), col);
  // bevel
  g.beginPath();
  g.roundRect(0.75, 0.75, s - 1.5, s - 1.5, cr);
  const bv = g.createLinearGradient(0, 0, 0, s);
  bv.addColorStop(0, rgba("#ffffff", 0.35));
  bv.addColorStop(0.5, rgba("#ffffff", 0.05));
  bv.addColorStop(1, rgba("#000000", 0.5));
  g.strokeStyle = bv;
  g.lineWidth = 1.5;
  g.stroke();
  iconCache.set(key, cv);
  return cv;
}

function copyOf(src: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = src.width;
  cv.height = src.height;
  cv.style.width = cv.style.height = size + "px";
  cv.getContext("2d")!.drawImage(src, 0, 0);
  return cv;
}
/** A fresh element showing skillIcon(id, size) (panels list the same skill in several places). */
export function skillIconCopy(id: string, size: number): HTMLCanvasElement {
  return copyOf(skillIcon(id, size), size);
}

/** Round support icon (painted "skillsup_<id>" on the attribute colour, tier pips); null = no painted art, use the gem. */
export function supportIcon(id: string, size: number, tier: number): HTMLCanvasElement | null {
  const { im: art, own } = painted(supportArtIds(id));
  if (!art || !own) return null;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const key = `sup:${id}|${size}|${dpr}|${tier}`;
  const hit = iconCache.get(key);
  if (hit) return copyOf(hit, size);
  const def = SUPPORT_GEM_BY_ID.get(id);
  const col = def ? ATTR_COLOR[def.attr] : "#c8b890";
  const [cv, g] = newCanvas(size);
  const s = size;
  const r = s / 2 - 0.5;
  g.beginPath();
  g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
  g.fillStyle = rad(g, s * 0.5, s * 0.42, s * 0.7, [[0, shade(col, -0.25)], [0.7, shade(col, -0.72)], [1, "#06060a"]]);
  g.fill();
  g.save();
  g.clip();
  drawArt(g, art, s, s * 0.1);
  g.restore();
  g.beginPath();
  g.arc(s / 2, s / 2, r - 0.5, 0, Math.PI * 2);
  g.strokeStyle = rgba(col, 0.85);
  g.lineWidth = Math.max(1, s * 0.05);
  g.stroke();
  for (let i = 0; i < tier; i++) {
    const a = Math.PI / 2 + (i - (tier - 1) / 2) * 0.5;
    g.beginPath();
    g.arc(s / 2 + Math.cos(a) * r * 0.86, s / 2 + Math.sin(a) * r * 0.86, Math.max(1, s * 0.05), 0, Math.PI * 2);
    g.fillStyle = "#fff6d8";
    g.fill();
  }
  iconCache.set(key, cv);
  return copyOf(cv, size);
}

// ---- gem items (inventory art) ---------------------------------------------------------------

function facetGem(g: G, cx: number, cy: number, r: number, col: string, sides: number) {
  glow(g, cx, cy, r * 1.7, rgba(col, 0.45));
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.05]);
  }
  g.beginPath();
  for (const [x, y] of pts) g.lineTo(x, y);
  g.closePath();
  g.fillStyle = rad(g, cx - r * 0.3, cy - r * 0.45, r * 1.6, [[0, "#ffffff"], [0.2, shade(col, 0.3)], [0.6, col], [1, shade(col, -0.7)]]);
  g.fill();
  g.strokeStyle = rgba("#000000", 0.6);
  g.lineWidth = Math.max(1, r * 0.06);
  g.stroke();
  // table facet + spokes
  const ir = r * 0.5;
  g.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    g.lineTo(cx + Math.cos(a) * ir, cy + Math.sin(a) * ir * 1.05);
  }
  g.closePath();
  g.fillStyle = rgba("#ffffff", 0.12);
  g.fill();
  g.strokeStyle = rgba("#ffffff", 0.35);
  g.lineWidth = Math.max(0.75, r * 0.03);
  g.stroke();
  g.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i / sides) * Math.PI * 2;
    g.moveTo(cx + Math.cos(a) * ir, cy + Math.sin(a) * ir * 1.05);
    g.lineTo(pts[i][0], pts[i][1]);
  }
  g.strokeStyle = rgba("#ffffff", 0.18);
  g.stroke();
  // sparkle
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = rad(g, cx - r * 0.35, cy - r * 0.45, r * 0.35, [[0, "rgba(255,255,255,0.9)"], [1, "rgba(255,255,255,0)"]]);
  g.beginPath();
  g.arc(cx - r * 0.35, cy - r * 0.45, r * 0.35, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function supportGem(g: G, cx: number, cy: number, r: number, col: string, tier: number, accent: string) {
  glow(g, cx, cy, r * 1.6, rgba(col, 0.35));
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = rad(g, cx - r * 0.35, cy - r * 0.4, r * 1.5, [[0, "#ffffff"], [0.18, shade(col, 0.25)], [0.6, col], [1, shade(col, -0.75)]]);
  g.fill();
  g.strokeStyle = rgba("#000000", 0.6);
  g.lineWidth = Math.max(1, r * 0.07);
  g.stroke();
  // inner ring in the support's own accent colour
  g.beginPath();
  g.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
  g.strokeStyle = rgba(accent.startsWith("#") ? accent : "#ffffff", 0.75);
  g.lineWidth = Math.max(1, r * 0.1);
  g.stroke();
  // tier pips
  for (let i = 0; i < tier; i++) {
    const a = Math.PI / 2 + (i - (tier - 1) / 2) * 0.5;
    g.beginPath();
    g.arc(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82, r * 0.11, 0, Math.PI * 2);
    g.fillStyle = "#fff6d8";
    g.fill();
  }
}

function roughCrystal(g: G, cx: number, cy: number, r: number, tint: string) {
  glow(g, cx, cy, r * 1.5, rgba(tint, 0.3));
  const shards: [number, number, number, number][] = [
    [-0.45, 0.25, 0.32, -0.35],
    [0.4, 0.3, 0.3, 0.3],
    [0, 0.4, 0.42, 0],
  ];
  for (const [dx, dy, w, lean] of shards) {
    const bx = cx + dx * r;
    const by = cy + dy * r + r * 0.35;
    const h = r * (dx === 0 ? 1.55 : 1.05);
    g.save();
    g.translate(bx, by);
    g.rotate(lean);
    g.beginPath();
    g.moveTo(-w * r * 0.5, 0);
    g.lineTo(-w * r * 0.5, -h * 0.72);
    g.lineTo(0, -h);
    g.lineTo(w * r * 0.5, -h * 0.72);
    g.lineTo(w * r * 0.5, 0);
    g.closePath();
    const lg = g.createLinearGradient(-w * r * 0.5, 0, w * r * 0.5, 0);
    lg.addColorStop(0, shade(tint, -0.55));
    lg.addColorStop(0.45, shade(tint, 0.35));
    lg.addColorStop(0.55, tint);
    lg.addColorStop(1, shade(tint, -0.65));
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = rgba("#000000", 0.55);
    g.lineWidth = Math.max(1, r * 0.05);
    g.stroke();
    g.beginPath();
    g.moveTo(0, -h);
    g.lineTo(0, 0);
    g.strokeStyle = rgba("#ffffff", 0.25);
    g.lineWidth = Math.max(0.75, r * 0.03);
    g.stroke();
    g.restore();
  }
  // rocky base
  g.beginPath();
  g.ellipse(cx, cy + r * 0.72, r * 0.95, r * 0.28, 0, 0, Math.PI * 2);
  g.fillStyle = rad(g, cx, cy + r * 0.65, r, [[0, "#5a5450"], [1, "#1a1816"]]);
  g.fill();
}

/** Inventory art for gem items (gfx/itemart.ts asks this first). null = not a gem. */
export function gemDrawer(item: Item): ((g: G, W: number, H: number, item: Item) => void) | null {
  if (isSkillGem(item))
    return (g, W, H, it) => {
      const def = skillDefOf(it)!;
      const col = gemColor(it);
      const r = Math.min(W, H) * 0.4;
      facetGem(g, W / 2, H / 2, r, col, def.kind === "aura" || def.kind === "meta" ? 6 : 8);
      drawGlyph(g, W / 2, H / 2, r * 0.42, glyphOf(def), col);
    };
  if (isSupportGem(item))
    return (g, W, H, it) => {
      const d = supportDefOf(it)!;
      supportGem(g, W / 2, H / 2, Math.min(W, H) * 0.36, gemColor(it), supportTier(it), d.color ?? "#ffffff");
    };
  if (isRough(item))
    return (g, W, H) => {
      // Told apart at a glance: skill = blue, support = gold with a round socket mark, spirit = violet with a diamond mark.
      const kind = item.b === "rough_support" ? 1 : item.b === "rough_spirit" ? 2 : 0;
      const tint = ["#5fb4e8", "#e8c05a", "#b478f0"][kind];
      const r = Math.min(W, H) * 0.36;
      roughCrystal(g, W / 2, H / 2, r, tint);
      if (!kind) return;
      const mx = W / 2 - r * 0.95; // lower left: the level number sits lower right
      const my = H / 2 + r * 0.8;
      const mr = r * 0.34;
      g.beginPath();
      if (kind === 1) g.arc(mx, my, mr, 0, Math.PI * 2);
      else {
        g.moveTo(mx, my - mr * 1.25);
        g.lineTo(mx + mr, my);
        g.lineTo(mx, my + mr * 1.25);
        g.lineTo(mx - mr, my);
        g.closePath();
      }
      g.fillStyle = "#0c0b0d";
      g.fill();
      g.strokeStyle = shade(tint, 0.3);
      g.lineWidth = Math.max(1.25, r * 0.11);
      g.stroke();
    };
  return null;
}

/** A gem drawn into a fresh canvas (Skills panel cells). */
export function gemCanvas(item: Item, size: number): HTMLCanvasElement {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.round(size * dpr);
  cv.style.width = cv.style.height = size + "px";
  const g = cv.getContext("2d")!;
  g.scale(dpr, dpr);
  gemDrawer(item)?.(g, size, size, item);
  return cv;
}
