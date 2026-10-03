// Original composition: "Ignition / 002". Pure oscillators + seeded noise.
// No recorded samples, external music, audio libraries, or network services.
import { FIREWORK, seeded } from './draw.mjs';

export const SCORE = Object.freeze({ title: 'Ignition / 002', bpm: 128, sampleRate: 48000, channels: 2, targetLufs: -16, truePeakDb: -1.5 });
const TAU = Math.PI * 2, hz = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = x => Math.max(0, Math.min(1, x));
// Lab order in the dataset sets stereo position and which chord tone its burst rings.
const PANS = [-.45, .45, 0], TONES = [2, 3, 1];
export function soundCues(data, timeline, scale = 1) {
  return data.releases.map(event => {
    const lab = data.labs.findIndex(l => l.id === event.lab);
    return { id: event.id, lab: event.lab, launch: Math.max(0, (timeline.onsets.get(event.id) - FIREWORK.rise) * scale), burst: timeline.onsets.get(event.id) * scale, pan: PANS[lab], tone: TONES[lab] };
  });
}

// Band-limited saw wavetables, chosen per pitch so no harmonic passes 18 kHz.
const TABLE = 2048, tables = new Map();
function saw(f, limit) {
  const harmonics = Math.max(1, Math.min(limit, Math.floor(18000 / f)));
  if (!tables.has(harmonics)) {
    const t = new Float32Array(TABLE + 1);
    for (let i = 0; i <= TABLE; i++) { let v = 0; for (let n = 1; n <= harmonics; n++) v += Math.sin(TAU * n * i / TABLE) / n; t[i] = v * .55; }
    tables.set(harmonics, t);
  }
  const tbl = tables.get(harmonics);
  return phase => { const x = (phase - Math.floor(phase)) * TABLE, i = x | 0; return tbl[i] + (tbl[i + 1] - tbl[i]) * (x - i); };
}
// Seeded noise through a simple band-pass (fast one-pole minus slow one-pole).
function noise(seed, color, floor = .03) {
  const rng = seeded(seed); let fast = 0, slow = 0;
  return () => { const n = rng() * 2 - 1; fast += color * (n - fast); slow += floor * (n - slow); return fast - slow; };
}

export function synthesize(data, timeline, { duration = timeline.duration, timeScale = duration / timeline.duration, sampleRate = SCORE.sampleRate } = {}) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || !Number.isFinite(timeScale) || timeScale <= 0) throw new Error('Invalid audio duration, rate, or time scale');
  const length = Math.ceil(duration * sampleRate), bed = [new Float32Array(length), new Float32Array(length)], sfx = [new Float32Array(length), new Float32Array(length)];
  function add(target, start, len, amp, pan, signal) {
    const first = Math.max(0, Math.ceil(start * sampleRate)), end = Math.min(length, Math.ceil((start + len) * sampleRate));
    const gl = Math.cos((pan + 1) * Math.PI / 4) * amp, gr = Math.sin((pan + 1) * Math.PI / 4) * amp;
    for (let i = first; i < end; i++) { const v = signal(i / sampleRate - start); target[0][i] += v * gl; target[1][i] += v * gr; }
  }
  const beat = 60 / SCORE.bpm, bar = beat * 4, sixteenth = beat / 4;
  const introEnd = timeline.introSeconds * timeScale, travelEnd = (timeline.introSeconds + timeline.travelSeconds) * timeScale, outroStart = timeline.outroStart * timeScale;
  // Am – F – C – G, one chord per bar.
  const chords = [[57, 60, 64, 71], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]];
  const chordAt = t => chords[Math.max(0, Math.floor(t / bar)) % 4];
  // Energy follows the film's structure (intro → travel → arrival → outro), not the release dates.
  const energy = t => t < introEnd ? .35 + .3 * t / Math.max(.001, introEnd) : t < travelEnd ? .65 + .35 * clamp((t - introEnd) / Math.max(.001, travelEnd - introEnd)) ** 1.5 : t < outroStart ? 1 : .55;

  // Supersaw pad: three detuned saws per chord tone; brightness rises with energy.
  for (let t = 0, n = 0; t < duration; t += bar, n++) {
    const chord = chords[n % 4], len = Math.min(bar + .25, duration - t), e = energy(t);
    for (const [v, midi] of chord.entries()) for (const detune of [-.0045, 0, .0047]) {
      const f = hz(midi) * (1 + detune), osc = saw(f, Math.round(6 + 18 * e)), phase = (v * .31 + detune * 40 + 1) % 1;
      add(bed, t, len, .02 * (.6 + .4 * e), (v - 1.5) * .22 + detune * 30, u => Math.min(1, u / .03) * Math.min(1, (len - u) / .2) * osc(phase + f * u));
    }
  }
  // Offbeat bass with a sub layer: the house "push" between kicks.
  for (let t = introEnd; t < outroStart - .01; t += beat) {
    const f = hz(chordAt(t)[0] - 24), osc = saw(f, 10);
    add(bed, t + beat / 2, beat * .45, .1, 0, u => Math.min(1, u / .004) * Math.exp(-u * 7) * (.55 * osc(f * u) + .6 * Math.sin(TAU * f * u)));
  }
  // Sixteenth-note arpeggio over the chord, accented on each beat.
  const pattern = [0, 1, 2, 3, 2, 1, 3, 4, 0, 2, 3, 4, 3, 1, 2, 4];
  for (let t = introEnd / 2, i = 0; t < duration - .5; t += sixteenth, i++) {
    const chord = chordAt(t), p = pattern[i % 16], f = hz((p === 4 ? chord[0] + 12 : chord[p]) + 12), osc = saw(f, 8);
    add(bed, t, .22, .038 * (i % 4 ? .62 : 1) * energy(t), Math.sin(i * .9) * .35, u => Math.min(1, u / .003) * Math.exp(-u * 16) * (.7 * osc(f * u) + .45 * Math.sin(TAU * f * u)));
  }
  // Drums: four-on-the-floor kick, layered clap on 2 and 4, open hat on the offbeat,
  // and sixteenth ticks once the calendar passes its midpoint.
  for (let t = introEnd, i = 0; t < outroStart - .01; t += beat, i++) {
    add(bed, t, .32, .27, 0, u => {
      const phase = 48 * u + (150 - 48) / 34 * (1 - Math.exp(-34 * u));
      return Math.min(1, u / .002) * Math.exp(-u * 9) * Math.sin(TAU * phase) + .2 * Math.exp(-u * 300) * Math.sin(TAU * 1400 * u);
    });
    if (i % 2) for (const [k, d] of [0, .011, .023].entries()) { const n = noise(i * 7 + k, .55); add(bed, t + d, .22, .055, .05, u => n() * Math.exp(-u * (k === 2 ? 18 : 90))); }
    const hat = noise(i * 13 + 5, .95);
    add(bed, t + beat / 2, .16, .032 * energy(t), .25, u => hat() * Math.exp(-u * 22));
    if (t > (introEnd + travelEnd) / 2) for (const s of [1, 3]) { const tick = noise(i * 31 + s, .97); add(bed, t + s * sixteenth, .05, .018 * energy(t), -.3, u => tick() * Math.exp(-u * 70)); }
  }
  // The bar before the final date: noise riser and accelerating snare roll. Arrival: crash, sub drop, chord stab.
  const buildStart = Math.max(introEnd, travelEnd - bar), build = Math.max(.001, travelEnd - buildStart);
  { const riser = noise(991, .9); add(bed, buildStart, build, .07, 0, u => { const q = u / build; return riser() * q * q * (.4 + .6 * Math.sin(TAU * (300 + 2400 * q * q) * u) ** 2); }); }
  for (let t = buildStart, k = 0; t < travelEnd - .01; t += k++ < 8 ? sixteenth : sixteenth / 2) {
    const q = (t - buildStart) / build, snare = noise(500 + k, .6);
    add(bed, t, .09, .03 + .05 * q, 0, u => (snare() + .4 * Math.sin(TAU * 190 * u)) * Math.exp(-u * 40));
  }
  { const crash = noise(4242, .98); add(bed, travelEnd, 2.4, .09, 0, u => crash() * Math.exp(-u * 1.6) * Math.min(1, u / .002)); }
  add(bed, travelEnd, 1.2, .16, 0, u => Math.exp(-u * 2.5) * Math.sin(TAU * (60 * u - 12 * u * u)));
  for (const midi of [45, 57, 64, 69, 72, 76]) { const f = hz(midi), osc = saw(f, 20); add(bed, travelEnd, 1.6, .03, (midi % 5 - 2) * .2, u => Math.min(1, u / .005) * Math.exp(-u * 1.8) * osc(f * u)); }
  // Sidechain pump keyed to the kick grid; the first 6 ms of each beat keep the kick transient.
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    if (t < introEnd || t >= outroStart) continue;
    const into = (t - introEnd) % beat;
    if (into > .006) { const g = 1 - .42 * (1 - Math.min(1, into / beat / .55)) ** 2; bed[0][i] *= g; bed[1][i] *= g; }
  }

  // Launch cues: a whistle on the rise; on the date, a bright crack, a boom, a chime on
  // the current chord and a crackle tail that follows the glittering particles.
  const cues = soundCues(data, timeline, timeScale);
  for (const cue of cues) {
    const close = cues.filter(c => Math.abs(c.burst - cue.burst) < .35).length, gain = 1 / Math.sqrt(close), rng = seeded(cue.id);
    const rise = cue.burst - cue.launch; let low = 0, high = 0;
    if (rise > 0) add(sfx, cue.launch, rise, .05 * gain, cue.pan * .6, u => {
      const q = u / rise, n = rng() * 2 - 1; low += .08 * (n - low); high += .5 * (n - high);
      return Math.sin(Math.PI * q) * (.6 * (high - low) * q + .25 * Math.sin(TAU * (700 * u + 900 * u * u / rise)));
    });
    const f = hz(chordAt(cue.burst)[cue.tone] + 24), phase = rng() * TAU; let body = 0;
    add(sfx, cue.burst, 1.3, .28 * gain, cue.pan, u => {
      const n = rng() * 2 - 1; body += .18 * (n - body);
      return Math.min(1, u / .002) * (.55 * n * Math.exp(-u * 70) + .9 * body * Math.exp(-u * 9) + .32 * Math.exp(-u * 4) * (Math.sin(TAU * f * u + phase) + .3 * Math.sin(TAU * 2 * f * u)));
    });
    for (let k = 0; k < 26; k++) {
      const at = cue.burst + .18 + rng() ** 1.4 * .9, click = noise(`${cue.id}-${k}`, .97), pan = Math.max(-1, Math.min(1, cue.pan + (rng() - .5) * .5));
      add(sfx, at, .012, .06 * gain * (1 - (at - cue.burst) / 1.2), pan, u => click() * Math.exp(-u * 400));
    }
  }
  // Duck the music under the most recent burst, then mix, fade the edges and glue with soft saturation.
  const bursts = cues.map(c => c.burst).sort((a, b) => a - b), level = new Float32Array(length);
  let power = 0;
  for (let i = 0, j = -1; i < length; i++) {
    const t = i / sampleRate;
    while (j + 1 < bursts.length && bursts[j + 1] <= t) j++;
    const since = j >= 0 ? t - bursts[j] : Infinity, duck = .45 * Math.min(1, since / .008) * Math.exp(-since / .16);
    const envelope = clamp(t / Math.min(.4, duration / 4)) * clamp((duration - t) / Math.min(1.4, duration / 4));
    for (const ch of [0, 1]) bed[ch][i] = Math.tanh((bed[ch][i] * (1 - (Number.isFinite(since) ? duck : 0)) + sfx[ch][i]) * envelope * 2.5) / 2.5;
    level[i] = Math.max(Math.abs(bed[0][i]), Math.abs(bed[1][i])); power += bed[0][i] ** 2 + bed[1][i] ** 2;
  }
  // Look-ahead limiter with its ceiling 13 dB above the mix RMS: only the sharpest transients are pulled down
  // (2 ms ramp ahead of the peak, 80 ms release). The level follows the RMS, so one stray peak cannot set it.
  const ceiling = Math.sqrt(power / (2 * length)) * 10 ** (13 / 20), ramp = 1 / Math.round(.002 * sampleRate), release = 1 - Math.exp(-1 / (.08 * sampleRate));
  for (let i = length - 1, next = 1; i >= 0; i--) next = level[i] = Math.min(level[i] > ceiling ? ceiling / level[i] : 1, next + ramp);
  const [left, right] = bed, gain = ceiling ? .66 / ceiling : 1;
  let sum = 0, peak = 0;
  for (let i = 0, g = 1; i < length; i++) {
    g = Math.min(level[i], g + (1 - g) * release);
    left[i] *= g * gain; right[i] *= g * gain; sum += left[i] ** 2 + right[i] ** 2; peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  return { left, right, sampleRate, cues, metrics: { samples: length, duration: length / sampleRate, samplePeakDbfs: peak ? 20 * Math.log10(peak) : -Infinity, rmsDbfs: 10 * Math.log10(sum / (2 * length)), bpm: SCORE.bpm, cueCount: cues.length, introEnd } };
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
