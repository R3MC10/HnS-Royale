// Public audio API. Import from "./audio/index" (plain "./audio" resolves to the settings stub
// src/client/audio.ts). Sounds and music are generated files under public/audio (manifest.json);
// the synthesiser is the fallback for anything missing. window.hnsAudioLog records what played.
//   sfx.play(id, { x, y, vol, pitch })   x/y = world position (omit for non-positional)
//   music.setState({ scene, biome, combat, late })
import { registerUiSound } from "../audio";
import { setSetting } from "../settings";
import { setMenuScene } from "./game";
import { music, type MusicState } from "./music";
import { sfx } from "./sfx";

export { sfx, type PlayOpts, type MonFamily } from "./sfx";
export { music, type MusicScene, type MusicState } from "./music";
export { unlockAudio, setListener } from "./engine";
export { audioFrame, audioEvents, audioOnMessage, hookNetAudio, setMenuScene, lootSoundFor, skillCastSound, audioSetView } from "./game";

registerUiSound((id) => sfx.play(id));

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Volume setters (0..1). They write the settings store, which drives the bus gains. */
export const volume = {
  master: (v: number) => setSetting("audio", "master", clamp01(v)),
  sfx: (v: number) => setSetting("audio", "effects", clamp01(v)),
  music: (v: number) => setSetting("audio", "music", clamp01(v)),
  ui: (v: number) => setSetting("audio", "ui", clamp01(v)),
};

// Menus (net agent) switch scenes through window.hnsMusic. "menu" / "lobby" become the out-of-match
// scene so the per-frame glue doesn't override them; while in a match, the glue keeps "match".
const hnsMusic = {
  ...music,
  setState(s: Partial<MusicState>) {
    if (s.scene === "menu" || s.scene === "lobby") setMenuScene(s.scene);
    music.setState(s);
  },
};
if (typeof window !== "undefined") Object.assign(window, { hnsMusic, hnsSfx: sfx });
