// Join screen dressing: the gothic pixel title and drifting (smooth, glowing) embers behind the panel.
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
  // Smooth embers at full device resolution: soft round glows (pre-rendered sprites), sub-pixel motion.
  const COLS = ["#fff0b0", "#ffc04a", "#ff8a2a", "#e0501a", "#8a2410"];
  const SPR = 32; // glow sprite size (device px)
  const glows = COLS.map((c) => {
    const s = document.createElement("canvas");
    s.width = s.height = SPR;
    const sg = s.getContext("2d")!;
    const rg = sg.createRadialGradient(SPR / 2, SPR / 2, 0, SPR / 2, SPR / 2, SPR / 2);
    rg.addColorStop(0, "#fffbe8");
    rg.addColorStop(0.18, c);
    rg.addColorStop(0.45, c + "55");
    rg.addColorStop(1, c + "00");
    sg.fillStyle = rg;
    sg.fillRect(0, 0, SPR, SPR);
    return s;
  });
  type Ember = { x: number; y: number; vy: number; ph: number; life: number; t: number; r: number };
  let embers: Ember[] = [];
  let last = performance.now();
  // positions and speeds in CSS px
  const spawn = (w: number, h: number, anywhere: boolean): Ember => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    vy: 24 + Math.random() * 56,
    ph: Math.random() * 6.28,
    life: 4 + Math.random() * 6,
    t: anywhere ? Math.random() * 4 : 0,
    r: 2 + Math.random() * 3.5,
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
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw;
      cv.height = ph;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    while (embers.length < Math.min(110, (w * h) / 4500)) embers.push(spawn(w, h, embers.length < 20));
    g.clearRect(0, 0, w, h);
    for (const e of embers) {
      e.t += dt;
      e.y -= e.vy * dt;
      e.x += Math.sin(e.t * 1.7 + e.ph) * 24 * dt;
    }
    embers = embers.filter((e) => e.t < e.life && e.y > -10);
    g.globalCompositeOperation = "lighter";
    for (const e of embers) {
      const k = e.t / e.life;
      const flick = 0.85 + 0.15 * Math.sin(e.t * 9 + e.ph);
      g.globalAlpha = (k < 0.1 ? k * 10 : 1 - Math.max(0, k - 0.6) / 0.4) * flick;
      const d = e.r * 4 * (1 - k * 0.4);
      g.drawImage(glows[Math.min(4, Math.floor(k * 5))], e.x - d / 2, e.y - d / 2, d, d);
    }
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
