// DEV-ONLY pinned randomness, for honest before/after captures: the same map, the same monster packs and rolls.
// Inert unless pinRandom() is called (GameHost with dev + pin; the Node server sets it from HNS_DEV=1 HNS_PIN=<seed>).
// While pinned, Math.random in this JS realm is a seeded PRNG, reset to the seed at every new map, so a round
// started the same way rolls the same things. Client input timing still varies, so it is close, not exact.

let pin: number | null = null;
let s = 0;

/** Replace Math.random with a PRNG seeded by `seed` (mulberry32). */
export function pinRandom(seed: number) {
  pin = seed >>> 0;
  s = pin;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** New map: reset the PRNG to the pinned seed. Returns that seed (the map seed to use), or null when not pinned. */
export function repinRandom(): number | null {
  if (pin !== null) s = pin;
  return pin;
}
