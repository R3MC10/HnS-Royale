// Inventory sound hooks (one place to re-point if the audio entry module moves).
import { sfx } from "./audio/index";

export function playSfx(id: string) {
  try {
    sfx.play(id);
  } catch {
    // audio not ready / locked: silent
  }
}
