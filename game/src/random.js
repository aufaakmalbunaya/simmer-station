// A small seeded random source (mulberry32) so a fixed seed always deals the same
// orders and the same screenshots, while a fresh game still surprises the player.

/** Make a random function from a 32-bit seed. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one entry of `list` with the given random function. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** An integer from 0 (inclusive) to `max` (exclusive) with the given random function. */
export function pickIndex(random, max) {
  return Math.floor(random() * max);
}
