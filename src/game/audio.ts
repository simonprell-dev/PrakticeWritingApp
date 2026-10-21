// Tiny WebAudio synth: all sounds are generated, no audio files.

let ac: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.7;

function ctx(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  if (!ac) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = volume;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

/** Call from a user gesture so browsers allow sound. */
export function unlockAudio(): void {
  ctx();
}

export function setSound(on: boolean, vol = volume): void {
  enabled = on;
  volume = vol;
  if (master) master.gain.value = vol;
}

function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; to?: number; gain?: number; delay?: number; attack?: number } = {},
): void {
  const a = ctx();
  if (!a || !master) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, opts: { gain?: number; delay?: number; freq?: number; q?: number } = {}): void {
  const a = ctx();
  if (!a || !master) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = opts.freq ?? 2000;
  f.Q.value = opts.q ?? 1;
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.3;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  shutter() {
    noise(0.08, { freq: 3500, gain: 0.35 });
    noise(0.06, { freq: 1800, gain: 0.25, delay: 0.09 });
  },
  blub() {
    tone(380 + Math.random() * 200, 0.18, { to: 900, gain: 0.18 });
  },
  /** hatch sound, higher and brighter for better letters */
  hatch(score: number) {
    const base = 300 + score * 4;
    tone(base, 0.12, { type: 'triangle', to: base * 1.6, gain: 0.25 });
    if (score >= 70) tone(base * 2, 0.25, { type: 'sine', gain: 0.12, delay: 0.08 });
    if (score < 30) tone(220, 0.25, { type: 'square', to: 140, gain: 0.06, delay: 0.05 });
  },
  sparkle() {
    [1318, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.09, delay: i * 0.06 }));
  },
  fanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.16, { type: 'square', gain: 0.07, delay: i * 0.13 }));
    notes.forEach((f, i) => tone(f / 2, i === 3 ? 0.5 : 0.16, { type: 'triangle', gain: 0.12, delay: i * 0.13 }));
  },
  plopp(size = 1) {
    const f = 900 / Math.max(0.5, size);
    tone(f, 0.08, { to: f * 2.2, gain: 0.25 });
    noise(0.05, { freq: 4000, gain: 0.12 });
  },
  boing() {
    tone(180, 0.35, { type: 'sine', to: 420, gain: 0.2 });
  },
  bonk() {
    tone(160, 0.09, { type: 'triangle', to: 90, gain: 0.25 });
  },
  whoosh() {
    noise(0.25, { freq: 900, q: 0.6, gain: 0.12 });
  },
  pfff() {
    noise(0.4, { freq: 600, q: 0.5, gain: 0.15 });
  },
  win() {
    const seq = [523, 659, 784, 659, 784, 1046];
    seq.forEach((f, i) => tone(f, 0.22, { type: 'square', gain: 0.07, delay: i * 0.15 }));
    seq.forEach((f, i) => tone(f / 2, 0.22, { type: 'triangle', gain: 0.12, delay: i * 0.15 }));
  },
  click() {
    tone(900, 0.05, { type: 'triangle', gain: 0.1 });
  },
};
