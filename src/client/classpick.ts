// Reusable class picker (8 class cards with an original vector emblem each). Used by any join or
// lobby screen: renderClassPicker(container, onPick). Smooth canvas drawing, no pixel art.
import { ASC_BY_ID } from "../shared/content/ascendancies";
import { CLASSES, CLASS_BY_ID, DEFAULT_CLASS, type ClassId } from "../shared/content/classes";
import { el, ensureProgStyle } from "./progstyle";

export interface ClassPicker {
  get(): ClassId;
  set(id: ClassId): void;
  destroy(): void;
}

/**
 * Render the 8 class cards into `container`. `onPick` fires on every selection (also once for the
 * initial class when `fireInitial` is set). Returns a handle to read / change / remove the picker.
 */
export function renderClassPicker(
  container: HTMLElement,
  onPick: (cls: ClassId) => void,
  opts: { initial?: string; fireInitial?: boolean; showAscendancies?: boolean } = {},
): ClassPicker {
  ensureProgStyle();
  let cur: ClassId = (CLASS_BY_ID.get(opts.initial ?? "")?.id ?? DEFAULT_CLASS) as ClassId;
  const grid = el("div", "pg-root pg-classes");
  const cards = new Map<ClassId, HTMLDivElement>();
  for (const c of CLASSES) {
    const card = el("div", "pg-class");
    card.dataset.cls = c.id;
    card.title = c.blurb;
    const cv = el("canvas");
    drawClassEmblem(cv, c.id, 72);
    card.append(cv, el("b", "", c.name), el("span", "at", c.attrs), el("span", "bl", c.blurb));
    if (opts.showAscendancies !== false) {
      const names = c.ascendancies.map((a) => ASC_BY_ID.get(a)?.name ?? a).join(" · ");
      card.append(el("span", "as", names));
    }
    card.addEventListener("click", () => {
      set(c.id);
      onPick(c.id);
    });
    cards.set(c.id, card);
    grid.append(card);
  }
  container.append(grid);
  function set(id: ClassId) {
    cur = id;
    for (const [k, card] of cards) card.classList.toggle("sel", k === id);
  }
  set(cur);
  if (opts.fireInitial) onPick(cur);
  return { get: () => cur, set, destroy: () => grid.remove() };
}

/** Original emblem per class, drawn with smooth vector strokes onto `cv` (size in CSS px). */
export function drawClassEmblem(cv: HTMLCanvasElement, cls: string, size: number) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  cv.width = Math.round(size * dpr);
  cv.height = Math.round(size * dpr);
  cv.style.width = `${size}px`;
  cv.style.height = `${size}px`;
  const g = cv.getContext("2d")!;
  g.setTransform(dpr * (size / 100), 0, 0, dpr * (size / 100), 0, 0);
  const c = CLASS_BY_ID.get(cls);
  const tint = c?.tint ?? "#5a4a26";
  // Medallion
  const bg = g.createRadialGradient(50, 40, 6, 50, 50, 50);
  bg.addColorStop(0, lighten(tint, 0.35));
  bg.addColorStop(0.65, tint);
  bg.addColorStop(1, "#0a0809");
  g.fillStyle = bg;
  g.beginPath();
  g.arc(50, 50, 46, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = "#d8b36a";
  g.stroke();
  g.lineWidth = 1;
  g.strokeStyle = "rgba(0,0,0,0.7)";
  g.beginPath();
  g.arc(50, 50, 41, 0, Math.PI * 2);
  g.stroke();
  // Glyph
  g.save();
  g.shadowColor = "rgba(255,200,120,0.45)";
  g.shadowBlur = 6;
  g.strokeStyle = "#f2dfb4";
  g.fillStyle = "#f2dfb4";
  g.lineWidth = 4;
  g.lineCap = "round";
  g.lineJoin = "round";
  const P = (pts: number[], close = false, fill = false) => {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    if (close) g.closePath();
    if (fill) g.fill();
    else g.stroke();
  };
  switch (cls) {
    case "reaver": // two crossed hooked cleavers
      for (const s of [1, -1]) {
        g.save();
        g.translate(50, 52);
        g.scale(s, 1);
        P([-22, 22, 16, -16]);
        g.beginPath();
        g.moveTo(10, -24);
        g.quadraticCurveTo(28, -26, 24, -6);
        g.lineTo(12, -14);
        g.closePath();
        g.fill();
        g.restore();
      }
      break;
    case "harrier": // arrow over a hunter's crescent
      g.beginPath();
      g.arc(50, 50, 26, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
      P([26, 62, 74, 30]);
      P([74, 30, 62, 31, 70, 40], true, true);
      P([26, 62, 30, 54]);
      P([26, 62, 34, 64]);
      break;
    case "gutterblade": // falling knife with a drop
      P([50, 18, 57, 46, 50, 70, 43, 46], true, true);
      P([36, 46, 64, 46]);
      P([50, 46, 50, 30]);
      g.beginPath();
      g.moveTo(50, 74);
      g.quadraticCurveTo(57, 84, 50, 86);
      g.quadraticCurveTo(43, 84, 50, 74);
      g.fill();
      break;
    case "gloamcaller": // eclipsed moon with an eye
      g.beginPath();
      g.arc(50, 50, 26, Math.PI * 0.35, Math.PI * 1.65);
      g.arc(60, 50, 20, Math.PI * 1.55, Math.PI * 0.45, true);
      g.closePath();
      g.fill();
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(60, 50, 9, 5, 0, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(60, 50, 2.5, 0, Math.PI * 2);
      g.fill();
      break;
    case "lanternwright": // caged lantern with a flame
      P([38, 30, 62, 30]);
      P([50, 22, 50, 30]);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(38, 30);
      g.bezierCurveTo(30, 50, 30, 64, 40, 74);
      g.lineTo(60, 74);
      g.bezierCurveTo(70, 64, 70, 50, 62, 30);
      g.stroke();
      P([50, 30, 50, 74]);
      g.fillStyle = "#ffb04a";
      g.beginPath();
      g.moveTo(50, 46);
      g.quadraticCurveTo(60, 58, 50, 68);
      g.quadraticCurveTo(40, 58, 50, 46);
      g.fill();
      break;
    case "drifter": // upright sword over the road's horizon
      P([22, 66, 78, 66]);
      g.lineWidth = 2;
      P([34, 80, 46, 66]);
      P([66, 80, 54, 66]);
      g.lineWidth = 4;
      P([50, 16, 50, 62]);
      P([40, 54, 60, 54]);
      P([46, 16, 50, 10, 54, 16], true, true);
      break;
    case "mistrunner": // long staff through drifting mist
      P([30, 78, 70, 20]);
      g.lineWidth = 3;
      for (const [y, x0] of [
        [40, 22],
        [54, 30],
        [68, 40],
      ]) {
        g.beginPath();
        g.moveTo(x0, y);
        g.bezierCurveTo(x0 + 10, y - 6, x0 + 20, y + 6, x0 + 30, y);
        g.bezierCurveTo(x0 + 38, y - 5, x0 + 44, y + 3, x0 + 48, y);
        g.stroke();
      }
      break;
    case "bellwarden": // bronze bell with clapper
      g.beginPath();
      g.moveTo(32, 68);
      g.bezierCurveTo(34, 50, 34, 28, 50, 26);
      g.bezierCurveTo(66, 28, 66, 50, 68, 68);
      g.closePath();
      g.fill();
      P([26, 70, 74, 70]);
      P([50, 26, 50, 18]);
      g.beginPath();
      g.arc(50, 76, 5, 0, Math.PI * 2);
      g.fill();
      break;
    default:
      g.beginPath();
      g.arc(50, 50, 12, 0, Math.PI * 2);
      g.fill();
  }
  g.restore();
}

function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v + (255 - v) * k);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
