// Match ambience from generated files: a looping night-forest wind bed, sparse distant one-shots
// (owl, wolf, crow, creaking pines, twigs) placed around the listener, and a positional hum on the
// nearest shrine. Runs on the effects bus. With no files there is simply no extra ambience (the
// synth music fallback has its own wind bed).
import { engine, listener, spatial, type Engine } from "./engine";
import { audioLog, track } from "./samples";
import { sfx } from "./sfx";

interface Loop {
  src: AudioBufferSourceNode;
  g: GainNode;
  pan: StereoPannerNode;
}

function startLoop(e: Engine, buf: AudioBuffer, name: string): Loop {
  const ctx = e.ctx;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  const pan = ctx.createStereoPanner();
  src.connect(g).connect(pan).connect(e.sfx);
  src.start(ctx.currentTime, Math.random() * buf.duration);
  audioLog("amb." + name, "amb", name);
  return { src, g, pan };
}
function stopLoop(e: Engine, l: Loop, tc = 0.8) {
  const t = e.ctx.currentTime;
  l.g.gain.cancelScheduledValues(t);
  l.g.gain.setTargetAtTime(0.0001, t, tc);
  setTimeout(() => {
    try {
      l.src.stop();
    } catch {
      /* already stopped */
    }
    l.g.disconnect();
    l.pan.disconnect();
  }, tc * 5000);
}

let bed: Loop | null = null;
let hum: Loop | null = null;
let inMatch = false;
let humPos: { x: number; y: number } | null = null;
let nextCall = 0;
const CALLS = ["amb.creak", "amb.owl", "amb.creak", "amb.twig", "amb.wolf", "amb.crow", "amb.creak"];

export const ambience = {
  /** Wind bed + distant calls on while in a match. */
  setMatch(on: boolean) {
    inMatch = on;
  },
  /** World position of the nearest live shrine (null = none near). */
  setShrine(pos: { x: number; y: number } | null) {
    humPos = pos;
  },
  /** Call regularly (the music timer does, every 100 ms). */
  tick() {
    const e = engine();
    if (!e) return;
    const t = e.ctx.currentTime;
    // wind bed
    if (inMatch && !bed) {
      const tr = track("amb", "forest");
      if (tr.status === "ready" && tr.buf) {
        bed = startLoop(e, tr.buf, "forest");
        bed.g.gain.setTargetAtTime(0.5 * tr.g, t, 1.5);
      }
    } else if (!inMatch && bed) {
      stopLoop(e, bed, 1);
      bed = null;
    }
    // distant one-shots, somewhere 500..1100 px around the camera
    if (inMatch && listener.valid) {
      if (!nextCall) nextCall = t + 6 + Math.random() * 10;
      if (t >= nextCall) {
        nextCall = t + 9 + Math.random() * 18;
        const id = CALLS[Math.floor(Math.random() * CALLS.length)];
        const a = Math.random() * Math.PI * 2;
        const d = 500 + Math.random() * 600;
        if (sfx.samples(id)) sfx.play(id, { x: listener.x + Math.cos(a) * d, y: listener.y + Math.sin(a) * d });
      }
    } else nextCall = 0;
    // shrine hum
    const sp = inMatch && humPos ? spatial(humPos.x, humPos.y) : null;
    const audible = sp && sp.dist < 900 ? sp : null;
    if (audible && !hum) {
      const tr = track("amb", "shrine");
      if (tr.status === "ready" && tr.buf) hum = startLoop(e, tr.buf, "shrine");
    }
    if (hum) {
      if (!audible) {
        stopLoop(e, hum, 0.5);
        hum = null;
      } else {
        const tr = track("amb", "shrine");
        hum.g.gain.setTargetAtTime(0.55 * tr.g * audible.gain * (1 - audible.dist / 900), t, 0.25);
        hum.pan.pan.setTargetAtTime(audible.pan, t, 0.25);
      }
    }
  },
};
