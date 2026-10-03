// Original composition: "Liftoff / 003". Pure oscillators + seeded noise.
// No recorded samples, external music, audio libraries, or network services.
import { FIREWORK, seeded } from './draw.mjs';

export const SCORE = Object.freeze({ title: 'Liftoff / 003', bpm: 128, sampleRate: 48000, channels: 2, targetLufs: -16, truePeakDb: -1.5 });
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
  const introEnd = timeline.introSeconds * timeScale, travelEnd = (timeline.introSeconds + timeline.travelSeconds) * timeScale;
  const travel = Math.max(.001, travelEnd - introEnd), progress = t => clamp((t - introEnd) / travel);
  // One long build: the drop lands on the observation cutoff, and the last bar of the film is a final chord.
  // Build intensity follows the film's structure, not the release dates.
  const buildStart = travelEnd - 2 * bar, gapStart = travelEnd - bar, finalStart = Math.max(travelEnd, timeline.duration * timeScale - bar);
  const section = t => t < introEnd ? 'intro' : t < travelEnd ? 'travel' : t < finalStart ? 'drop' : 'final';
  const AM = [57, 60, 64, 71], F = [53, 57, 60, 67], C = [48, 55, 60, 64], G = [55, 59, 62, 67], E = [52, 56, 59, 64], A = [57, 61, 64, 69];
  // Am–F–C–G while the calendar runs; E (the dominant) in the bar before the cutoff, Am at the drop, then F and A major.
  const chordAt = t => t >= finalStart ? A : t >= travelEnd ? (Math.floor((t - travelEnd) / bar) % 2 ? F : AM) : t >= gapStart ? E : [AM, F, C, G][Math.max(0, Math.floor(t / bar)) % 4];
  const bassNote = chord => 33 + ((chord[0] - 33) % 12 + 12) % 12;
  // Overall drive: every layer starts low and climbs with the calendar, so the build is heard in level as well as density.
  const drive = t => ({ intro: .5, travel: .35 + .65 * progress(t) ** 1.6, drop: 1, final: 1 })[section(t)];
  const synth = [new Float32Array(length), new Float32Array(length)], kicks = [];
  const supersaw = (start, len, midi, amp, pan, attack = .006, release = .08) => {
    for (const [k, d] of [-.009, -.0045, 0, .0045, .009].entries()) {
      const f = hz(midi) * (1 + d), osc = saw(f, 40), phase = (k * .37 + midi * .11) % 1;
      add(synth, start, len, amp, Math.max(-1, Math.min(1, pan + (k - 2) * .22)), u => Math.min(1, u / attack) * Math.min(1, (len - u) / release) * osc(phase + f * u));
    }
  };

  // Pads: three detuned saws per chord tone, swelling in over the intro; an upper octave joins for the last third.
  for (let n = 0; n * bar < duration; n++) {
    const t = n * bar, chord = chordAt(t + .01), final = t >= finalStart - .01, len = final ? duration - t : Math.min(bar + .05, duration - t);
    for (const [v, midi] of chord.entries()) for (const d of [-.005, 0, .005]) {
      const f = hz(midi) * (1 + d), osc = saw(f, 24), phase = (v * .31 + d * 40 + 1) % 1, attack = n === 0 ? bar * .6 : .02;
      add(synth, t, len, .016 * drive(t), (v - 1.5) * .22 + d * 30, u => Math.min(1, u / attack) * Math.min(1, (len - u) / .1) * osc(phase + f * u));
    }
    if (progress(t) >= 2 / 3 || t >= travelEnd) for (const midi of chord.slice(2)) supersaw(t, len, midi + 12, .006, 0, .02, .1);
  }
  // Arpeggio: eighth notes at first, sixteenths once the groove starts.
  const pattern = [0, 1, 2, 3, 2, 1, 3, 4, 0, 2, 3, 4, 3, 1, 2, 4];
  for (let s = Math.ceil(introEnd / sixteenth - 1e-9); s * sixteenth < finalStart - .01; s++) {
    const t = s * sixteenth;
    if (section(t) === 'travel' && progress(t) < 1 / 3 && s % 2) continue;
    const chord = chordAt(t), p = pattern[s % 16], f = hz((p === 4 ? chord[0] + 12 : chord[p]) + 12), osc = saw(f, 12);
    add(synth, t, .22, .032 * (s % 4 ? .7 : 1) * drive(t), Math.sin(s * .9) * .35, u => Math.min(1, u / .003) * Math.exp(-u * 14) * (.7 * osc(f * u) + .45 * Math.sin(TAU * f * u)));
  }
  // Bass: long roots, then offbeat eighths, then a rolling sixteenth line; silent in the bar before the drop.
  for (let s = Math.ceil(introEnd / sixteenth - 1e-9); s * sixteenth < finalStart - .01; s++) {
    const t = s * sixteenth, part = section(t), p = progress(t), f = hz(bassNote(chordAt(t))), osc = saw(f, 12);
    const tone = (len, amp, decay) => add(synth, t, len, amp * drive(t), 0, u => Math.min(1, u / .004) * Math.min(1, (len - u) / .02) * Math.exp(-u * decay) * (.5 * osc(f * u) + .7 * Math.sin(TAU * f * u)));
    if (part === 'travel' && t >= gapStart) continue;
    if (part === 'travel' && p < 1 / 3) { if (s % 16 === 0) tone(bar * .9, .1, .4); }
    else if (part === 'travel' && p < 2 / 3) { if (s % 4 === 2) tone(beat * .45, .085, 6); }
    else if (s % 4) tone(sixteenth * .9, part === 'drop' ? .095 : .085, 10);
  }
  // Drums. The kick grows from one hit per bar to four on the floor, drops out for the last bar, and returns on the drop.
  const clapAt = (t, i, amp) => { for (const [k, d] of [0, .011, .023].entries()) { const n = noise(i * 7 + k, .55); add(bed, t + d, .22, .05 * amp, .05, u => n() * Math.exp(-u * (k === 2 ? 18 : 90))); } };
  const kick = (t, amp) => { kicks.push(t); add(bed, t, .34, amp, 0, u => Math.min(1, u / .002) * Math.exp(-u * 8.5) * Math.sin(TAU * (48 * u + (155 - 48) / 34 * (1 - Math.exp(-34 * u)))) + .2 * Math.exp(-u * 300) * Math.sin(TAU * 1400 * u)); };
  for (let k = Math.ceil(introEnd / beat - 1e-9); k * beat < finalStart - .01; k++) {
    const t = k * beat, part = section(t), p = progress(t), inBar = k % 4, drop = part === 'drop', groove = drop || t < gapStart;
    if (drop || (t < gapStart && (p >= 1 / 3 || (p >= 1 / 6 ? inBar % 2 === 0 : inBar === 0)))) kick(t, .28 * Math.min(1, .3 + drive(t)));
    if (groove && (drop || p >= .5) && inBar % 2) clapAt(t, k, drive(t));
    if (groove && (drop || p >= 1 / 3)) { const hat = noise(k * 13 + 5, .95); add(bed, t + beat / 2, .16, .03 * drive(t), .25, u => hat() * Math.exp(-u * 22)); }
    if (groove && (drop || p >= 2 / 3)) for (const s of [1, 3]) { const tick = noise(k * 31 + s, .97); add(bed, t + s * sixteenth, .05, .016, -.3, u => tick() * Math.exp(-u * 70)); }
  }
  // The build: a two-bar noise riser and a snare roll that doubles its rate (eighths, sixteenths, thirty-seconds),
  // plus a three-octave uplifter sweep in the final bar before the cutoff.
  const roll = Math.max(.001, travelEnd - buildStart);
  if (buildStart >= introEnd) {
    { const riser = noise(991, .9); add(bed, buildStart, roll, .08, 0, u => { const q = u / roll; return riser() * q * q * (.4 + .6 * Math.sin(TAU * (300 + 2400 * q * q) * u) ** 2); }); }
    for (let t = buildStart, k = 0; t < travelEnd - .01; t += t < gapStart - 1e-6 ? beat / 2 : t < gapStart + bar / 2 - 1e-6 ? sixteenth : sixteenth / 2, k++) {
      const q = (t - buildStart) / roll, snare = noise(500 + k, .6), f = 170 + 150 * q;
      add(bed, t, .09, .025 + .065 * q, 0, u => (snare() + .4 * Math.sin(TAU * f * u)) * Math.exp(-u * 40));
    }
    let phase = 0;
    add(synth, gapStart, bar, .025, 0, u => { const q = u / bar; phase += 220 * 2 ** (3 * q) / sampleRate; return q * Math.sin(TAU * phase); });
  }
  // The drop and the final chord: crash, sub boom, a supersaw hook over Am and F, then a held A major.
  const impact = (t, amp) => {
    const crash = noise(Math.round(t * 1000), .98);
    add(bed, t, 2.4, .09 * amp, 0, u => crash() * Math.exp(-u * 1.6) * Math.min(1, u / .002));
    add(bed, t, 1.2, .16 * amp, 0, u => Math.exp(-u * 2.5) * Math.sin(TAU * (60 * u - 12 * u * u)));
  };
  if (travelEnd < duration) impact(travelEnd, 1);
  const HOOK = { am: [[0, 81, 3], [3, 76, 3], [6, 81, 2], [8, 83, 3], [11, 84, 3], [14, 83, 2]], f: [[0, 81, 3], [3, 77, 3], [6, 81, 2], [8, 84, 3], [11, 81, 3], [14, 79, 2]] };
  for (let t = travelEnd, m = 0; t < finalStart - .01; t += bar, m++) for (const [step, midi, steps] of HOOK[m % 2 ? 'f' : 'am']) supersaw(t + step * sixteenth, steps * sixteenth * .92, midi, .013, 0);
  if (finalStart < duration) {
    impact(finalStart, 1); kick(finalStart, .3);
    for (const midi of [...A, 73, 76]) supersaw(finalStart, duration - finalStart, midi, .007, 0, .01, .3);
    const f = hz(33); add(synth, finalStart, duration - finalStart, .12, 0, u => Math.min(1, u / .01) * Math.exp(-u * .9) * Math.sin(TAU * f * u));
  }

  // Synth bus: a resonant low-pass opens from 400 Hz to fully open across the build; a dotted-eighth
  // ping-pong delay adds width; the bus pumps against every kick.
  const cutoff = t => t < introEnd ? 400 : t < travelEnd ? 600 * 30 ** (progress(t) ** 1.3) : 18000;
  for (const ch of [0, 1]) {
    let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
    for (let i = 0; i < length; i++) {
      if (i % 32 === 0) { const g = Math.tan(Math.PI * Math.min(cutoff(i / sampleRate), .45 * sampleRate) / sampleRate), k = .7; a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; }
      const v3 = synth[ch][i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
      ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; synth[ch][i] = v2;
    }
  }
  const echo = Math.round(.75 * beat * sampleRate), wet = [new Float32Array(length), new Float32Array(length)];
  for (let i = echo, damp = 0; i < length; i++) {
    damp += .35 * ((synth[0][i - echo] + synth[1][i - echo]) * .5 - damp);
    wet[0][i] = damp + .35 * wet[1][i - echo]; wet[1][i] = .35 * wet[0][i - echo];
  }
  kicks.sort((a, b) => a - b);
  for (let i = 0, j = -1; i < length; i++) {
    const t = i / sampleRate;
    while (j + 1 < kicks.length && kicks[j + 1] <= t) j++;
    const since = j >= 0 ? t - kicks[j] : Infinity, depth = j < 0 ? 0 : section(kicks[j]) === 'travel' && progress(kicks[j]) < 1 / 3 ? .2 : section(kicks[j]) === 'travel' ? .38 : .45;
    const g = 1 - depth * (1 - Math.min(1, since / (.5 * beat))) ** 2;
    for (const ch of [0, 1]) bed[ch][i] += (synth[ch][i] + .18 * wet[ch][i]) * g;
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
