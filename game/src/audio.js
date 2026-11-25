// All of Simmer Station's sounds are made here, with the Web Audio API and no
// audio files: short synth blips for chopping, a sizzle for the grill, a bell for
// a served dish. Nothing here is needed to play; a browser without audio just
// stays quiet, and the sounds only start after the player's first input.

/** The one AudioContext for the page, made lazily on the first sound. */
let context = null;
let muted = false;

/** Create the context on demand; return null when audio is unavailable. */
function audioContext() {
  if (context) return context;
  try {
    const Audio = window.AudioContext ?? window.webkitAudioContext;
    if (!Audio) return null;
    context = new Audio();
    return context;
  } catch {
    return null;
  }
}

/** Play one oscillator note: frequency in Hz, length in seconds, wave shape. */
function note(frequency, seconds, type, volume, when = 0) {
  const audio = audioContext();
  if (!audio || muted) return;
  try {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    const start = audio.currentTime + when;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  } catch {
    // A sound that cannot play is skipped, never allowed to break the game.
  }
}

/** A short burst of filtered noise: the thock of a knife, the hiss of the grill. */
function noise(seconds, volume, frequency) {
  const audio = audioContext();
  if (!audio || muted) return;
  try {
    const length = Math.max(1, Math.floor(audio.sampleRate * seconds));
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    const gain = audio.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
  } catch {
    // As above: a missed sound never breaks the game.
  }
}

/** Warm the audio context up after the player's first key or click. */
export function unlockAudio() {
  const audio = audioContext();
  if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
}

/** Flip the mute flag; returns the new state. */
export function toggleMute() {
  muted = !muted;
  return muted;
}

export function soundChop() {
  noise(0.09, 0.5, 1800);
  note(180, 0.07, 'triangle', 0.25);
}

export function soundGrab() {
  note(520, 0.06, 'sine', 0.18);
}

export function soundPlace() {
  note(340, 0.08, 'triangle', 0.2);
}

export function soundSizzle() {
  noise(0.5, 0.12, 3200);
}

export function soundReady() {
  note(880, 0.12, 'sine', 0.22);
  note(1174, 0.18, 'sine', 0.2, 0.1);
}

export function soundServe() {
  note(523, 0.1, 'triangle', 0.25);
  note(659, 0.1, 'triangle', 0.25, 0.09);
  note(784, 0.22, 'triangle', 0.28, 0.18);
}

export function soundError() {
  note(140, 0.18, 'sawtooth', 0.16);
}

export function soundExpire() {
  note(220, 0.25, 'sawtooth', 0.2);
  note(165, 0.35, 'sawtooth', 0.2, 0.18);
}

export function soundTick() {
  note(980, 0.05, 'square', 0.08);
}

export function soundStart() {
  note(392, 0.1, 'triangle', 0.22);
  note(523, 0.1, 'triangle', 0.22, 0.1);
  note(659, 0.2, 'triangle', 0.24, 0.2);
}

export function soundEnd() {
  note(523, 0.15, 'triangle', 0.22);
  note(392, 0.15, 'triangle', 0.22, 0.14);
  note(330, 0.3, 'triangle', 0.22, 0.28);
}
