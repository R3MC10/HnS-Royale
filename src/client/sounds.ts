// Audio review page (/sounds.html): a button per sound id, grouped by category, plus music controls.
import { music, setListener, sfx, unlockAudio, type MusicScene } from "./audio/index";

const root = document.getElementById("root") as HTMLDivElement;
setListener(0, 0);

const groups = new Map<string, string[]>();
for (const id of sfx.ids()) {
  const c = sfx.category(id);
  if (!groups.has(c)) groups.set(c, []);
  groups.get(c)!.push(id);
}

let posMode: "center" | "left" | "right" | "far" = "center";
const pos = () => (posMode === "left" ? { x: -500, y: 0 } : posMode === "right" ? { x: 500, y: 0 } : posMode === "far" ? { x: 300, y: 1100 } : { x: 0, y: 0 });

function play(id: string) {
  unlockAudio();
  sfx.play(id, pos());
}

const h = (tag: string, text = "", cls = "") => {
  const e = document.createElement(tag);
  e.textContent = text;
  if (cls) e.className = cls;
  return e;
};

// controls
const ctl = h("div", "", "ctl");
ctl.append(h("b", "Position: "));
for (const m of ["center", "left", "right", "far"] as const) {
  const b = h("button", m) as HTMLButtonElement;
  b.onclick = () => {
    posMode = m;
    ctl.querySelectorAll("button.pos").forEach((x) => x.classList.toggle("on", x === b));
  };
  b.classList.add("pos");
  if (m === "center") b.classList.add("on");
  ctl.append(b);
}
const all = h("button", "Play all (1 per 0.6 s)") as HTMLButtonElement;
let allTimer: ReturnType<typeof setInterval> | null = null;
all.onclick = () => {
  if (allTimer) {
    clearInterval(allTimer);
    allTimer = null;
    return;
  }
  const ids = sfx.ids();
  let i = 0;
  allTimer = setInterval(() => {
    if (i >= ids.length) {
      clearInterval(allTimer!);
      allTimer = null;
      return;
    }
    play(ids[i++]);
  }, 600);
};
ctl.append(all);
root.append(ctl);

// music
const mus = h("div", "", "ctl");
mus.append(h("b", "Music: "));
for (const s of ["none", "menu", "lobby", "match"] as MusicScene[]) {
  const b = h("button", s) as HTMLButtonElement;
  b.onclick = () => {
    unlockAudio();
    music.setState({ scene: s });
  };
  mus.append(b);
}
const biome = document.createElement("select");
for (const b of ["hollowpine", "gloamwater", "brokenspire"]) biome.append(new Option(b, b));
biome.onchange = () => music.setState({ biome: biome.value });
mus.append(" biome ", biome);
for (const k of ["combat", "late", "boss"] as const) {
  const r = document.createElement("input");
  r.type = "range";
  r.min = "0";
  r.max = "1";
  r.step = "0.05";
  r.value = "0";
  r.oninput = () => music.setState({ [k]: Number(r.value) });
  mus.append(` ${k} `, r);
}
const nowPlaying = h("span", "");
mus.append(" playing: ", nowPlaying);
root.append(mus);

for (const [cat, ids] of groups) {
  const sec = h("section");
  sec.append(h("h3", cat));
  for (const id of ids) {
    const b = h("button", id) as HTMLButtonElement;
    b.onclick = () => play(id);
    b.dataset.id = id;
    sec.append(b);
  }
  root.append(sec);
}

// Mark which ids play a generated file (count of variations) and which still use the synth.
setInterval(() => {
  nowPlaying.textContent = music.playing() ?? "-";
  document.querySelectorAll<HTMLButtonElement>("button[data-id]").forEach((b) => {
    const id = b.dataset.id!;
    const n = sfx.samples(id);
    b.textContent = n ? id + " [" + n + "]" : id + " (synth)";
    b.classList.toggle("synth", !n);
  });
}, 500);
