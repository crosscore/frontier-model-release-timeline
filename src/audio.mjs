// Original composition: "Afterglow / 001". Pure oscillators + seeded noise.
// No recorded samples, external music, audio libraries, or network services.
import { FIREWORK, seeded } from './draw.mjs';

export const SCORE = Object.freeze({ title: 'Afterglow / 001', bpm: 100, sampleRate: 48000, channels: 2, targetLufs: -18, truePeakDb: -2.5 });
const TAU = Math.PI * 2, hz = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = x => Math.max(0, Math.min(1, x));
export function soundCues(data, timeline, scale = 1) {
  return data.releases.map(event => ({ id: event.id, lab: event.lab, launch: Math.max(0, (timeline.onsets.get(event.id) - FIREWORK.rise) * scale), burst: timeline.onsets.get(event.id) * scale, pan: event.lab === 'openai' ? -.3 : .3 }));
}
export function synthesize(data, timeline, { duration = timeline.duration, timeScale = duration / timeline.duration, sampleRate = SCORE.sampleRate } = {}) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || !Number.isFinite(timeScale) || timeScale <= 0) throw new Error('Invalid audio duration, rate, or time scale');
  const length = Math.ceil(duration * sampleRate), left = new Float32Array(length), right = new Float32Array(length);
  function add(start, len, amp, pan, signal) {
    const first = Math.max(0, Math.ceil(start * sampleRate)), end = Math.min(length, Math.ceil((start + len) * sampleRate));
    const gl = Math.cos((pan + 1) * Math.PI / 4) * amp, gr = Math.sin((pan + 1) * Math.PI / 4) * amp;
    for (let i = first; i < end; i++) { const v = signal(i / sampleRate - start); left[i] += v * gl; right[i] += v * gr; }
  }
  const beat = 60 / SCORE.bpm, bar = beat * 4;
  // Am(add9), Fmaj7, Cmaj9, Gsus2. A fixed tempo under the entire calendar.
  const chords = [[57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 59, 62], [55, 57, 62, 67]];
  const chordAt = t => chords[Math.floor(t / (4 * bar)) % chords.length];
  for (let t = 0, n = 0; t < duration; t += 4 * bar, n++) {
    const chord = chords[n % chords.length], len = Math.min(4 * bar + 1.2, duration - t);
    chord.forEach((midi, voice) => {
      const f = hz(midi);
      add(t, len, .057, (voice - 1.5) * .2, u => {
        const env = Math.sin(Math.PI / 2 * clamp(u / 1.25)) ** 2 * Math.sin(Math.PI / 2 * clamp((len - u) / 1.5)) ** 2;
        const tremolo = .9 + .1 * Math.sin(u * TAU * .17 + voice);
        return env * tremolo * (Math.sin(TAU * f * u) + .32 * Math.sin(TAU * f * 1.003 * u + .4) + .17 * Math.sin(TAU * f * 2 * u)) / 1.49;
      });
    });
  }
  const pluck = (t, midi, amp, pan, len = .8) => {
    const f = hz(midi);
    add(t, len, amp, pan, u => Math.min(1, u / .009) * Math.exp(-u * 5) * Math.min(1, (len - u) / .08) * (Math.sin(TAU * f * u) + .22 * Math.sin(TAU * f * 2 * u) + .06 * Math.sin(TAU * f * 3 * u)));
  };
  for (let t = 0, i = 0; t < duration - 1.4; t += beat / 2, i++) {
    const chord = chordAt(t), pattern = [0, 2, 1, 3, 2, 1, 3, 2], midi = chord[pattern[i % 8]] + 12;
    pluck(t, midi, .07, Math.sin(i * 1.7) * .3);
    pluck(t + beat * .75, midi, .019, -Math.sin(i * 1.7) * .3);
  }
  const introEnd = timeline.introSeconds * timeScale, outro = timeline.outroStart * timeScale;
  for (let t = bar, i = 0; t < outro; t += beat, i++) {
    const strength = Math.min(1, (t - bar + 1) / 4);
    add(t, .4, .15 * strength, 0, u => Math.min(1, u / .005) * Math.exp(-u * 12) * Math.sin(TAU * (49 * u + 2.1 * (1 - Math.exp(-u * 33)))));
    if (i % 2 === 0) {
      const f = hz(chordAt(t)[0] - 12);
      add(t, beat * 1.8, .12, 0, u => Math.min(1, u / .025) * Math.min(1, (beat * 1.8 - u) / .15) * Math.exp(-u * .8) * (Math.sin(TAU * f * u) + .27 * Math.sin(TAU * f * 2 * u)));
    }
    // Low, filtered percussion: no explosive snare or piercing cymbal sample.
    const noise = seeded(i + 76); let lp = 0, slow = 0;
    add(t + beat / 2, .075, .035 * strength, i % 2 ? .35 : -.35, u => {
      const n = noise() * 2 - 1; lp += .35 * (n - lp); slow += .06 * (n - slow);
      return (lp - slow) * Math.exp(-u * 52) * Math.min(1, u / .003);
    });
    if (i % 2) { const noise2 = seeded(i + 232); let body = 0;
      add(t, .16, .058 * strength, .1, u => { body += .12 * (noise2() * 2 - 1 - body); return (body + .2 * Math.sin(TAU * 180 * u)) * Math.exp(-u * 24) * Math.min(1, u / .006); });
    }
  }
  const cues = soundCues(data, timeline, timeScale);
  // Make release accents audible without increasing the overall master level.
  // This changes only the mix around actual data events, never the music tempo.
  for (let i = 0; i < length; i++) {
    const time = i / sampleRate; let duck = 1;
    for (const cue of cues) {
      const delta = time - cue.burst;
      if (delta >= -.012 && delta < .43) {
        const strength = delta < 0 ? (delta + .012) / .012 : delta < .07 ? 1 : Math.exp(-(delta - .07) * 9);
        duck = Math.min(duck, 1 - .58 * strength);
      }
    }
    left[i] *= duck; right[i] *= duck;
  }
  for (const cue of cues) {
    const close = cues.filter(c => Math.abs(c.burst - cue.burst) < .75 * timeScale).length, gain = 1 / Math.sqrt(close);
    const rng = seeded(cue.id), rise = FIREWORK.rise * timeScale, life = 1.8 * timeScale;
    let low = 0, high = 0;
    add(cue.launch, rise, .09 * gain, cue.pan, t => {
      const q = t / rise, n = rng() * 2 - 1; low += .1 * (n - low); high += .4 * (n - high);
      return Math.sin(Math.PI * q) ** 1.5 * (.65 * (high - low) + .18 * Math.sin(TAU * (310 * t + 250 * t * t / rise)));
    });
    let smoke = 0, bright = 0, highpass = 0;
    const chord = chordAt(cue.burst), f = hz(chord[cue.lab === 'openai' ? 2 : 3] + 12);
    const phase = rng() * TAU;
    add(cue.burst, life, .32 * gain, cue.pan, t => {
      const u = t / timeScale, n = rng() * 2 - 1; smoke += .21 * (n - smoke); bright += .55 * (n - bright); highpass += .1 * (n - highpass);
      const env = Math.min(1, u / .015) * Math.exp(-u * 4.2) * Math.min(1, (1.8 - u) / .2);
      return env * (.8 * smoke + .28 * (bright - highpass) + .27 * Math.sin(TAU * f * t + phase) + .14 * Math.sin(TAU * f * 2 * t + phase) + .25 * Math.sin(TAU * (60 * t + 1.8 * (1 - Math.exp(-t * 35)))));
    });
  }
  let peak = 0, sum = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate, envelope = clamp(t / Math.min(1, duration / 4)) * clamp((duration - t) / Math.min(2, duration / 4));
    left[i] *= envelope; right[i] *= envelope;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = peak ? .62 / peak : 1;
  for (let i = 0; i < length; i++) { left[i] *= gain; right[i] *= gain; sum += left[i] ** 2 + right[i] ** 2; }
  return { left, right, sampleRate, cues, metrics: { samples: length, duration: length / sampleRate, samplePeakDbfs: peak ? 20 * Math.log10(.62) : -Infinity, rmsDbfs: 10 * Math.log10(sum / (2 * length)), bpm: SCORE.bpm, cueCount: cues.length, introEnd } };
}
export function wavBuffer(audio) {
  const length = audio.left.length, dataSize = length * 4, buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(audio.sampleRate, 24); buf.writeUInt32LE(audio.sampleRate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < length; i++) {
    if (!Number.isFinite(audio.left[i]) || !Number.isFinite(audio.right[i]) || Math.abs(audio.left[i]) >= 1 || Math.abs(audio.right[i]) >= 1) throw new Error('Invalid or clipped audio sample');
    buf.writeInt16LE(Math.round(audio.left[i] * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(audio.right[i] * 32767), 46 + i * 4);
  }
  return buf;
}
