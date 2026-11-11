// Join screen dressing: the gothic pixel title and drifting embers behind the panel.
import { titleSprite, TITLE_BLOOD } from "./gfx/font";

export function initJoinScreen(overlay: HTMLElement) {
  const title = document.getElementById("title") as HTMLCanvasElement | null;
  if (title) {
    const src = titleSprite("HNS ROYALE", TITLE_BLOOD);
    title.width = src.width;
    title.height = src.height;
    title.getContext("2d")!.drawImage(src, 0, 0);
    const scale = Math.max(2, Math.min(3, Math.floor(360 / src.width)));
    title.style.width = src.width * scale + "px";
    title.style.height = src.height * scale + "px";
  }

  const cv = document.getElementById("embers") as HTMLCanvasElement | null;
  if (!cv) return;
  const g = cv.getContext("2d")!;
  const PX = 4; // one ember pixel = 4 CSS px
  const COLS = ["#fff0b0", "#ffc04a", "#ff8a2a", "#e0501a", "#8a2410"];
  type Ember = { x: number; y: number; vy: number; ph: number; life: number; t: number };
  let embers: Ember[] = [];
  let last = performance.now();
  const spawn = (w: number, h: number, anywhere: boolean): Ember => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 2,
    vy: 6 + Math.random() * 14,
    ph: Math.random() * 6.28,
    life: 4 + Math.random() * 6,
    t: anywhere ? Math.random() * 4 : 0,
  });
  const frame = () => {
    if (overlay.style.display === "none") {
      embers = [];
      requestAnimationFrame(frame);
      return;
    }
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const w = Math.ceil(window.innerWidth / PX);
    const h = Math.ceil(window.innerHeight / PX);
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    while (embers.length < Math.min(140, (w * h) / 220)) embers.push(spawn(w, h, embers.length < 20));
    g.clearRect(0, 0, w, h);
    for (const e of embers) {
      e.t += dt;
      e.y -= e.vy * dt;
      e.x += Math.sin(e.t * 1.7 + e.ph) * 6 * dt;
    }
    embers = embers.filter((e) => e.t < e.life && e.y > -2);
    for (const e of embers) {
      const k = e.t / e.life;
      const c = COLS[Math.min(4, Math.floor(k * 5))];
      g.globalAlpha = k < 0.1 ? k * 10 : 1 - Math.max(0, k - 0.6) / 0.4;
      g.fillStyle = c;
      g.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
    }
    g.globalAlpha = 1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
