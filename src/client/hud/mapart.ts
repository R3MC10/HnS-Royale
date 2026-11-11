// The map picture behind the corner minimap, the Tab overlay and the world map (M): north-up, a few
// px per map cell, drawn once per map. Every kind of place has its own tint, the forest edge is
// shaded, and the real roads and trails are inked on top, so the layout reads at a glance.
import { OPEN, WATER, ZONE, type GameMap } from "../../shared/map";

/** Canvas px per map cell. */
export const MAP_ART_SCALE = 4;

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Tint per shared ZONE id (index = id). */
export const ZONE_TINT: string[] = [
  "#4a4a36", // none
  "#514b38", // trail
  "#5d5139", // road
  "#55693a", // glade
  "#34452b", // thicket
  "#59616a", // graveyard
  "#6f6880", // ruins
  "#735a3a", // logging camp
  "#6a3d35", // lair
  "#6c5a78", // heart
];

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function buildMapArt(m: GameMap): HTMLCanvasElement {
  const S = MAP_ART_SCALE;
  const cv = document.createElement("canvas");
  cv.width = m.cols * S;
  cv.height = m.rows * S;
  const g = cv.getContext("2d")!;
  // 1 px per cell colour image, then scaled up smoothly so cell steps become soft edges.
  const small = document.createElement("canvas");
  small.width = m.cols;
  small.height = m.rows;
  const sg = small.getContext("2d")!;
  const img = sg.createImageData(m.cols, m.rows);
  const wall = hex(m.biome.palette.mapWall);
  const water = hex(m.biome.palette.mapWater);
  const tints = ZONE_TINT.map(hex);
  for (let k = 0; k < m.solid.length; k++) {
    const sk = m.solid[k];
    const i = k % m.cols;
    const j = (k - i) / m.cols;
    let c: RGB;
    let f = 1;
    if (sk === OPEN) {
      c = tints[m.zone[k]] ?? tints[0];
      // Ground beside the forest edge is darker: corridors and clearings get a rim.
      f = m.clear[k] <= 1 ? 0.74 : m.clear[k] === 2 ? 0.9 : 1;
      f *= 0.95 + hash(i, j) * 0.1;
    } else if (sk === WATER) c = water;
    else {
      c = wall;
      f = 0.85 + hash(i, j) * 0.4; // a little grain so the forest is not a flat fill
    }
    img.data[k * 4] = Math.min(255, c[0] * f);
    img.data[k * 4 + 1] = Math.min(255, c[1] * f);
    img.data[k * 4 + 2] = Math.min(255, c[2] * f);
    img.data[k * 4 + 3] = 255;
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(small, 0, 0, cv.width, cv.height);
  // Roads and trails (world px -> canvas px).
  const q = S / m.cell;
  g.lineJoin = "round";
  g.lineCap = "round";
  const stroke = (main: boolean, width: number, style: string) => {
    g.lineWidth = width;
    g.strokeStyle = style;
    g.beginPath();
    for (const rd of m.roads) {
      if (rd.main !== main) continue;
      rd.pts.forEach(([x, y], i) => (i ? g.lineTo(x * q, y * q) : g.moveTo(x * q, y * q)));
    }
    g.stroke();
  };
  stroke(false, 2.2, "rgba(24,18,10,0.35)");
  stroke(false, 1.2, "rgba(196,170,120,0.55)");
  stroke(true, 5, "rgba(24,18,10,0.45)");
  stroke(true, 3, "rgba(214,184,124,0.9)");
  // The heart's clearing keeps its tint over the road ends.
  for (const a of m.areas) {
    if (a.kind !== "heart") continue;
    g.fillStyle = ZONE_TINT[ZONE.heart];
    g.globalAlpha = 0.85;
    g.beginPath();
    g.arc(a.x * q, a.y * q, a.r * 0.55 * q, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  return cv;
}
