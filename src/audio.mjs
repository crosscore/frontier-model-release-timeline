// Original composition: "Afterburn / 004". Pure oscillators + seeded noise.
// No recorded samples, external music, audio libraries, or network services.
import { FIREWORK, seeded } from './draw.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, kickTimes } from './timeline.mjs';

export const SCORE = Object.freeze({ title: 'Afterburn / 004', bpm: 128, sampleRate: 48000, channels: 2, targetLufs: -16, truePeakDb: -1.5 });
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
  const length = Math.ceil(duration * sampleRate), bus = () => [new Float32Array(length), new Float32Array(length)];
  // Separate buses so the sub, the mid bass and the synths can each pump against the kick by a different depth.
  const drums = bus(), sub = bus(), reese = bus(), synth = bus(), sfx = bus();
  function add(target, start, len, amp, pan, signal) {
    const first = Math.max(0, Math.ceil(start * sampleRate)), end = Math.min(length, Math.ceil((start + len) * sampleRate));
    const gl = Math.cos((pan + 1) * Math.PI / 4) * amp, gr = Math.sin((pan + 1) * Math.PI / 4) * amp;
    for (let i = first; i < end; i++) { const v = signal(i / sampleRate - start); target[0][i] += v * gl; target[1][i] += v * gr; }
  }
  const beat = BEAT_SECONDS, bar = BAR_SECONDS, sixteenth = beat / 4, p = cuePoints(timeline, timeScale), kicks = kickTimes(p, duration);
  const travel = Math.max(.001, p.build - p.intro), progress = t => clamp((t - p.intro) / travel);
  // Sections follow the film, not the release dates: a one-bar intro, three grooves of rising density while the
  // calendar runs (A, B, C), a build bar, a half-bar kick roll, a half-bar breath, then the drop at the observation
  // cutoff, which keeps going until the track fades out. There is no closing cadence.
  const part = t => t < p.intro ? 'intro' : t < p.build ? ['A', 'B', 'C'][Math.min(2, Math.floor(progress(t) / .4))] : t < p.gap ? 'build' : t < p.breath ? 'roll' : t < p.drop ? 'breath' : 'drop';
  const drive = t => ({ intro: .75, A: .82, B: .9, C: 1, build: 1, roll: 1, breath: 1, drop: 1.06 })[part(t)];
  const AM = [57, 60, 64, 71], F = [53, 57, 60, 67], C = [48, 55, 60, 64], G = [55, 59, 62, 67], E = [52, 56, 59, 64], LOOP = [AM, F, C, G];
  // Am–F–C–G from the first travel bar; E (the dominant) in the bar before the drop; the loop restarts on Am at the drop.
  const chordAt = t => t >= p.drop ? LOOP[Math.floor((t - p.drop) / bar + 1e-6) % 4] : t >= p.gap ? E : t < p.intro ? AM : LOOP[Math.floor((t - p.intro) / bar + 1e-6) % 4];
  const rootOf = chord => 29 + ((chord[0] - 29) % 12 + 12) % 12;
  const supersaw = (start, len, midi, amp, pan, attack = .006, release = .08) => {
    for (const [k, d] of [-.009, -.0045, 0, .0045, .009].entries()) {
      const f = hz(midi) * (1 + d), osc = saw(f, 40), phase = (k * .37 + midi * .11) % 1;
      add(synth, start, len, amp, Math.max(-1, Math.min(1, pan + (k - 2) * .22)), u => Math.min(1, u / attack) * Math.min(1, (len - u) / release) * osc(phase + f * u));
    }
  };

  // Kick: a pitch-dropping sine body with a long sub tail and a short click, saturated so its harmonics carry on small speakers.
  const kick = (t, amp) => add(drums, t, .46, amp, 0, u => Math.min(1, u / .001) * Math.min(1, (.46 - u) / .04) *
    Math.tanh(2.4 * (Math.sin(TAU * (50 * u + (175 - 50) / 28 * (1 - Math.exp(-28 * u)))) * Math.exp(-u * 7) + .45 * Math.exp(-u * 300) * Math.sin(TAU * 1800 * u))) / Math.tanh(2.4));
  for (const t of kicks) kick(t, ({ intro: .36, roll: .4, drop: .5 })[part(t + 1e-4)] ?? .45);
  // Sub (sine, mono) and mid "reese" bass (two detuned saws an octave up). Patterns per beat, in sixteenths: [start, length].
  const PATTERN = { off8: [[2, 1.7]], roll16: [[1, .8], [2, .8], [3, .8]], all16: [[0, .8], [1, .8], [2, .8], [3, .8]] };
  const subNote = (t, len, midi, amp) => { const f = hz(midi); add(sub, t, len, .28 * amp, 0, u => Math.min(1, u / .005) * Math.min(1, (len - u) / .008) * (Math.sin(TAU * f * u) + .12 * Math.sin(TAU * 2 * f * u))); };
  const reeseNote = (t, len, midi, amp) => {
    for (const d of [-.007, .007]) { const f = hz(midi + 12) * (1 + d), osc = saw(f, 40), ph = d > 0 ? .37 : 0; add(reese, t, len, .2 * amp, d * 40, u => Math.min(1, u / .003) * Math.min(1, (len - u) / .01) * osc(ph + f * u)); }
  };
  for (let n = 0; n * bar < duration; n++) if (part(n * bar + 1e-4) === 'A') subNote(n * bar, Math.min(bar, duration - n * bar), rootOf(chordAt(n * bar + 1e-4)), drive(n * bar));
  for (let k = 0; k * beat < duration; k++) {
    const t = k * beat, pt = part(t + 1e-4), root = rootOf(chordAt(t + 1e-4)), d = drive(t);
    const subPattern = { B: 'off8', C: 'off8', build: 'roll16', drop: 'off8' }[pt], reesePattern = { B: 'off8', C: 'roll16', build: 'roll16', drop: 'all16' }[pt];
    if (subPattern) for (const [s, l] of PATTERN[subPattern]) subNote(t + s * sixteenth, l * sixteenth, root, d);
    if (reesePattern) for (const [s, l] of PATTERN[reesePattern]) reeseNote(t + s * sixteenth, l * sixteenth, root, d);
  }
  // In the kick roll the sub slides up an octave on E, then everything but the risers drops out for the breath.
  if (p.breath > p.gap && p.gap > 0) { let phase = 0; const len = p.breath - p.gap; add(sub, p.gap, len, .45, 0, u => { const q = u / len; phase += hz(28) * 2 ** q / sampleRate; return Math.min(1, u / .01) * Math.min(1, (len - u) / .02) * Math.sin(TAU * phase); }); }

  // Hats, claps and snares thicken section by section.
  const hat = (t, amp, open) => { const n = noise(Math.round(t * 1e4), .98, .35); add(drums, t, open ? .24 : .08, amp, .2, u => n() * Math.exp(-u * (open ? 11 : 38))); };
  const clap = (t, amp, body) => {
    for (const [k, d] of [0, .011, .023].entries()) { const n = noise(Math.round(t * 1e4) * 7 + k, .55); add(drums, t + d, .24, .09 * amp, -.05, u => n() * Math.exp(-u * (k === 2 ? 16 : 90))); }
    if (body) add(drums, t, .18, .09 * amp, 0, u => Math.sin(TAU * 185 * u) * Math.exp(-u * 26));
  };
  for (let s = 0; s * sixteenth < duration; s++) {
    const t = s * sixteenth, pt = part(t + 1e-4), inBeat = s % 4, d = drive(t);
    if (pt === 'intro' || pt === 'breath' || pt === 'roll') continue;
    if (pt === 'A') { if (inBeat === 2) hat(t, .12 * d, false); continue; }
    hat(t, (inBeat === 2 ? .13 : .075) * d, false);
    if ((pt !== 'B') && inBeat === 2) hat(t, .1 * d, true);
    if (inBeat === 0 && Math.floor(s / 4) % 2 === 1 && pt !== 'build') clap(t, d, pt !== 'B');
  }
  if (p.build > p.intro) for (const t of [p.intro + .4 * travel, p.intro + .8 * travel]) { const n = noise(Math.round(t * 1000), .98); add(drums, t, 1.8, .05, 0, u => n() * Math.exp(-u * 2)); }

  // Pads: three detuned saws per chord tone, swelling in over the intro.
  for (let n = 0; n * bar < duration; n++) {
    const t = n * bar, chord = chordAt(t + 1e-4), len = Math.min(bar + .05, duration - t), pt = part(t + 1e-4);
    if (pt === 'breath') continue;
    for (const [v, midi] of chord.entries()) for (const d of [-.005, 0, .005]) {
      const f = hz(midi) * (1 + d), osc = saw(f, 24), phase = (v * .31 + d * 40 + 1) % 1, attack = n === 0 ? bar * .5 : .02;
      add(synth, t, len, .032 * drive(t), (v - 1.5) * .22 + d * 30, u => Math.min(1, u / attack) * Math.min(1, (len - u) / .1) * osc(phase + f * u));
    }
    if (pt === 'C' || pt === 'build') for (const midi of chord.slice(2)) supersaw(t, len, midi + 12, .013, 0, .02, .1);
  }
  // Pluck arpeggio: eighths in groove A, sixteenths after.
  const ARP = [0, 1, 2, 3, 2, 1, 3, 4, 0, 2, 3, 4, 3, 1, 2, 4];
  for (let s = 0; s * sixteenth < duration; s++) {
    const t = s * sixteenth, pt = part(t + 1e-4);
    if (pt === 'intro' || pt === 'breath' || (pt === 'A' && s % 2)) continue;
    const chord = chordAt(t + 1e-4), n = ARP[s % 16], f = hz((n === 4 ? chord[0] + 12 : chord[n]) + 12), osc = saw(f, 12);
    add(synth, t, .22, .065 * (s % 4 ? .7 : 1) * drive(t) * (pt === 'drop' ? .7 : 1), Math.sin(s * .9) * .35, u => Math.min(1, u / .003) * Math.exp(-u * 14) * (.7 * osc(f * u) + .45 * Math.sin(TAU * f * u)));
  }
  // Drop: offbeat supersaw chord stabs and a lead hook over the restarted loop.
  const HOOK = [[[0, 81, 3], [3, 76, 3], [6, 81, 2], [8, 83, 3], [11, 84, 3], [14, 83, 2]], [[0, 81, 3], [3, 77, 3], [6, 81, 2], [8, 84, 3], [11, 81, 3], [14, 79, 2]],
    [[0, 79, 3], [3, 76, 3], [6, 79, 2], [8, 84, 3], [11, 83, 3], [14, 79, 2]], [[0, 79, 3], [3, 74, 3], [6, 79, 2], [8, 83, 3], [11, 86, 3], [14, 83, 2]]];
  for (let t = p.drop, m = 0; t < duration - .01; t += bar, m++) {
    for (const [step, midi, steps] of HOOK[m % 4]) supersaw(t + step * sixteenth, steps * sixteenth * .92, midi, .026, 0);
    for (let b = 0; b < 4; b++) for (const midi of chordAt(t + 1e-4)) supersaw(t + b * beat + beat / 2, .16, midi + 12, .009, 0, .004, .05);
  }

  // Transitions: an opening boom, a fill into the chart, a two-bar build into the drop, and impacts on both arrivals.
  const impact = (t, amp) => {
    const crash = noise(Math.round(t * 1000) + 7, .98);
    add(drums, t, 2.4, .08 * amp, 0, u => crash() * Math.exp(-u * 1.6) * Math.min(1, u / .002));
    add(drums, t, 1.5, .3 * amp, 0, u => Math.min(1, u / .003) * Math.exp(-u * 2.2) * Math.sin(TAU * (62 * u - 11 * u * u)));
  };
  impact(0, .8);
  if (p.intro < duration) {
    const len = Math.min(p.intro, beat * 2), riser = noise(77, .9);
    add(drums, p.intro - len, len, .05, 0, u => riser() * (u / len) ** 2);
    for (let k = 0; k < 4; k++) clap(p.intro - beat + k * sixteenth, .5 + k * .15, true);
    impact(p.intro, .8);
  }
  const roll = Math.max(.001, p.drop - p.build);
  if (p.build >= p.intro) {
    { const riser = noise(991, .9); add(drums, p.build, roll, .08, 0, u => { const q = u / roll; return riser() * q * q * (.4 + .6 * Math.sin(TAU * (300 + 2400 * q * q) * u) ** 2); }); }
    for (let t = p.build, k = 0; t < p.breath - .01; t += t < p.build + bar / 2 - 1e-6 ? beat / 2 : t < p.gap - 1e-6 ? sixteenth : sixteenth / 2, k++) {
      const q = (t - p.build) / (p.breath - p.build), snare = noise(500 + k, .6), f = 170 + 160 * q;
      add(drums, t, .09, .025 + .07 * q, 0, u => (snare() + .4 * Math.sin(TAU * f * u)) * Math.exp(-u * 40));
    }
    let phase = 0;
    add(synth, p.gap, bar, .022, 0, u => { const q = u / bar; phase += 220 * 2 ** (3 * q) / sampleRate; return q * Math.sin(TAU * phase); });
    const swell = noise(313, .97), len = p.drop - p.breath;
    add(drums, p.breath, len, .07, 0, u => swell() * (u / len) ** 2.5);
  }
  if (p.drop < duration) impact(p.drop, 1.2);

  // Bus processing. Synths: a resonant low-pass opens from 500 Hz in the intro to fully open at the build, plus a
  // dotted-eighth ping-pong delay. Mid bass: its own low-pass, which wobbles on eighth notes in the drop, then saturation.
  const lowpass = (target, cutoff, k) => {
    for (const ch of [0, 1]) {
      let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
      for (let i = 0; i < length; i++) {
        if (i % 32 === 0) { const g = Math.tan(Math.PI * Math.min(cutoff(i / sampleRate), .45 * sampleRate) / sampleRate); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; }
        const v3 = target[ch][i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; target[ch][i] = v2;
      }
    }
  };
  lowpass(synth, t => t < p.intro ? 600 : t < p.build ? 1000 * 18 ** (progress(t) ** 1.2) : 18000, .7);
  lowpass(reese, t => {
    const pt = part(t);
    if (pt === 'drop') return 260 + 2400 * (.5 - .5 * Math.cos(TAU * (t - p.drop) / (beat / 2))) ** 1.6;
    return pt === 'build' || pt === 'roll' ? 1200 + 2400 * clamp((t - p.build) / bar) : 450 + 900 * progress(t);
  }, .5);
  for (const ch of [0, 1]) for (let i = 0; i < length; i++) reese[ch][i] = Math.tanh(2.2 * reese[ch][i]) / 2.2;
  const echo = Math.round(.75 * beat * sampleRate), wet = bus();
  for (let i = echo, damp = 0; i < length; i++) {
    damp += .35 * ((synth[0][i - echo] + synth[1][i - echo]) * .5 - damp);
    wet[0][i] = damp + .35 * wet[1][i - echo]; wet[1][i] = .35 * wet[0][i - echo];
  }
  // Sidechain: the sub ducks almost fully under each kick, the mid bass and synths less, which gives the pumping groove.
  // Launch bursts duck only the melodic buses, so the beat stays solid under dense launches.
  const cues = soundCues(data, timeline, timeScale), bursts = cues.map(c => c.burst).sort((a, b) => a - b);
  const synthDepth = { intro: .2, A: .45, B: .5, C: .5, build: .5, roll: .5, breath: 0, drop: .55 };
  for (let i = 0, j = -1, b = -1; i < length; i++) {
    const t = i / sampleRate;
    while (j + 1 < kicks.length && kicks[j + 1] <= t) j++;
    while (b + 1 < bursts.length && bursts[b + 1] <= t) b++;
    const pump = j >= 0 ? (1 - Math.min(1, (t - kicks[j]) / (.55 * beat))) ** 2 : 0, since = b >= 0 ? t - bursts[b] : Infinity;
    const duck = Number.isFinite(since) ? 1 - .28 * Math.min(1, since / .008) * Math.exp(-since / .16) : 1, gs = (1 - synthDepth[part(t)] * pump) * duck;
    for (const ch of [0, 1]) drums[ch][i] += sub[ch][i] * (1 - .9 * pump) + reese[ch][i] * (1 - .7 * pump) * duck + (synth[ch][i] + .18 * wet[ch][i]) * gs;
  }

  // Launch cues: a whistle on the rise; on the date, a bright crack, a boom, a chime on
  // the current chord and a crackle tail that follows the glittering particles.
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
  // Mix, glue with soft saturation, and shape the edges: an instant start under the opening boom and a long fade-out
  // over the groove instead of an ending.
  const level = new Float32Array(length), fade = Math.min(3.2, duration / 4);
  let power = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate, envelope = clamp(t / .01) * Math.cos(Math.PI / 2 * clamp((t - (duration - fade)) / fade)) ** 2;
    for (const ch of [0, 1]) drums[ch][i] = Math.tanh((drums[ch][i] + sfx[ch][i]) * envelope * 1.5) / 1.5;
    level[i] = Math.max(Math.abs(drums[0][i]), Math.abs(drums[1][i])); power += drums[0][i] ** 2 + drums[1][i] ** 2;
  }
  // Look-ahead limiter with its ceiling 12 dB above the mix RMS: only the sharpest transients are pulled down
  // (2 ms ramp ahead of the peak, 80 ms release). The level follows the RMS, so one stray peak cannot set it.
  const ceiling = Math.sqrt(power / (2 * length)) * 10 ** (12 / 20), ramp = 1 / Math.round(.002 * sampleRate), release = 1 - Math.exp(-1 / (.08 * sampleRate));
  for (let i = length - 1, next = 1; i >= 0; i--) next = level[i] = Math.min(level[i] > ceiling ? ceiling / level[i] : 1, next + ramp);
  const [left, right] = drums, gain = ceiling ? .66 / ceiling : 1;
  let sum = 0, peak = 0;
  for (let i = 0, g = 1; i < length; i++) {
    g = Math.min(level[i], g + (1 - g) * release);
    left[i] *= g * gain; right[i] *= g * gain; sum += left[i] ** 2 + right[i] ** 2; peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  return { left, right, sampleRate, cues, metrics: { samples: length, duration: length / sampleRate, samplePeakDbfs: peak ? 20 * Math.log10(peak) : -Infinity, rmsDbfs: 10 * Math.log10(sum / (2 * length)), bpm: SCORE.bpm, cueCount: cues.length, introEnd: p.intro, drop: p.drop, kicks: kicks.length } };
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
