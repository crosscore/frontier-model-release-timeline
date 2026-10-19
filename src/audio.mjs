// Original composition: "Supernova / 006". Pure oscillators + seeded noise.
// No recorded samples, external music, audio libraries, or network services.
import { FIREWORK, seeded } from './draw.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, kickTimes, scorePart, energy } from './timeline.mjs';

export const SCORE = Object.freeze({ title: 'Supernova / 006', bpm: 128, sampleRate: 48000, channels: 2, targetLufs: -14, truePeakDb: -1.0 });
const TAU = Math.PI * 2, hz = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Each lab keeps its stereo position and chime by id, so reordering the labs changes nothing. The chimes are the five
// notes of G minor pentatonic; no chord in the score has a tone a semitone under them, so any set can ring together.
// Labs without a preset take the next free slots in dataset order.
const VOICES = { openai: [-.5, 86], deepseek: [-.25, 84], google: [0, 79], meta: [.25, 89], anthropic: [.5, 82] };
const PAN_SLOTS = [0, -.5, .5, -.25, .25, -.375, .375, -.125, .125], CHIME_SLOTS = [79, 82, 84, 86, 89, 91, 94, 96, 98];
export function labVoices(labs) {
  const preset = labs.filter(lab => VOICES[lab.id]), pans = new Set(preset.map(lab => VOICES[lab.id][0])), tones = new Set(preset.map(lab => VOICES[lab.id][1]));
  return labs.map(({ id }) => {
    let [pan, tone] = VOICES[id] ?? [PAN_SLOTS.find(x => !pans.has(x)), CHIME_SLOTS.find(x => !tones.has(x))];
    if (pan === undefined || tone === undefined) throw new Error('Too many labs for distinct launch voices');
    pans.add(pan); tones.add(tone);
    return { id, pan, tone, note: `${NOTE_NAMES[tone % 12]}${Math.floor(tone / 12) - 1}`, hz: hz(tone) };
  });
}
export function soundCues(data, timeline, scale = 1) {
  const voices = new Map(labVoices(data.labs).map(v => [v.id, v]));
  const cues = data.releases.map(event => {
    const { pan, tone } = voices.get(event.lab);
    return { id: event.id, lab: event.lab, launch: Math.max(0, (timeline.onsets.get(event.id) - FIREWORK.rise) * scale), burst: timeline.onsets.get(event.id) * scale, pan, tone };
  });
  for (const cue of cues) cue.neighbors = cues.filter(c => Math.abs(c.burst - cue.burst) < .35).length;
  return cues;
}

export { scorePart, energy } from './timeline.mjs';
export const CHORDS = Object.freeze([[55, 62, 67, 70, 74], [51, 63, 67, 70, 74], [58, 62, 65, 72], [53, 60, 65, 67, 72]].map(Object.freeze));
export const HOOK = Object.freeze([
  [[0,74,3],[3,70,3],[6,67,2],[8,70,2],[10,74,3],[13,77,3]],
  [[0,79,3],[3,77,3],[6,74,2],[8,70,2],[10,74,6]],
  [[0,74,3],[3,70,3],[6,67,2],[8,70,2],[10,74,3],[13,72,3]],
  [[0,72,3],[3,74,3],[6,77,4],[10,79,6]],
].map(bar => Object.freeze(bar.map(Object.freeze))));

// Band-limited saw wavetables, chosen per pitch so no harmonic passes 18 kHz or the Nyquist limit.
const TABLE = 2048, tables = new Map();
function saw(f, limit, sampleRate) {
  const harmonics = Math.max(1, Math.min(limit, Math.floor(Math.min(18000, .45 * sampleRate) / f)));
  if (!tables.has(harmonics)) {
    const t = new Float32Array(TABLE + 1);
    for (let i = 0; i <= TABLE; i++) { let v = 0; for (let n = 1; n <= harmonics; n++) v += Math.sin(TAU * n * i / TABLE) / n; t[i] = v * .55; }
    tables.set(harmonics, t);
  }
  const tbl = tables.get(harmonics);
  return phase => { const x = (phase - Math.floor(phase)) * TABLE, i = x | 0; return tbl[i] + (tbl[i + 1] - tbl[i]) * (x - i); };
}
// Seeded noise through a simple band-pass (fast one-pole minus slow one-pole), with corners in Hz so a render at
// any sample rate has the same colour.
const pole = (f, sampleRate) => 1 - Math.exp(-TAU * Math.min(f, sampleRate / 2) / sampleRate);
function noise(seed, high, low, sampleRate) {
  const rng = seeded(seed), a = pole(high, sampleRate), b = pole(low, sampleRate); let fast = 0, slow = 0;
  return () => { const n = rng() * 2 - 1; fast += a * (n - fast); slow += b * (n - slow); return fast - slow; };
}
// Time since the latest of the sorted `times` at or before t, and until the next one. Constant time per call while
// t increases, which is how every layer reads it.
function clock(times) {
  let k = -1;
  const c = {
    since: Infinity, until: Infinity,
    at(t) {
      if (k >= 0 && times[k] > t) k = -1;
      while (k + 1 < times.length && times[k + 1] <= t) k++;
      c.since = k >= 0 ? t - times[k] : Infinity; c.until = k + 1 < times.length ? times[k + 1] - t : Infinity;
      return c;
    },
  };
  return c;
}
// Topology-preserving state-variable filter with low-, band- and high-pass outputs.
function svf(sampleRate) {
  let ic1 = 0, ic2 = 0, k = Math.SQRT2, a1 = 1, a2 = 0, a3 = 0;
  const f = {
    lp: 0, bp: 0, hp: 0,
    set(cutoff, q = Math.SQRT1_2) { const g = Math.tan(Math.PI * Math.min(cutoff, .45 * sampleRate) / sampleRate); k = 1 / q; a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; return f; },
    run(x) { const v3 = x - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; f.lp = v2; f.bp = v1; f.hp = x - k * v1 - v2; return v2; },
  };
  return f;
}

// `stems: true` exposes the BGM and launch buses before master saturation, at the same output gain.
export function synthesize(data, timeline, { duration = timeline.duration, timeScale = duration / timeline.duration, sampleRate = SCORE.sampleRate, stems = false } = {}) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || !Number.isFinite(timeScale) || timeScale <= 0) throw new Error('Invalid audio duration, rate, or time scale');
  const sr = sampleRate, length = Math.ceil(duration * sr), bus = () => [new Float32Array(length), new Float32Array(length)];
  const drums = bus(), perc = bus(), tex = bus(), sfx = bus();
  function add(target, start, len, amp, pan, signal) {
    const first = Math.max(0, Math.ceil(start * sr)), end = Math.min(length, Math.ceil((start + len) * sr));
    const gl = Math.cos((pan + 1) * Math.PI / 4) * amp, gr = Math.sin((pan + 1) * Math.PI / 4) * amp;
    for (let i = first; i < end; i++) { const v = signal(i / sr - start); target[0][i] += v * gl; target[1][i] += v * gr; }
  }
  const osc = (f, limit) => saw(f, limit, sr), hiss = (seed, high, low = 230) => noise(seed, high, low, sr);
  const beat = BEAT_SECONDS, bar = BAR_SECONDS, s16 = beat / 4, p = cuePoints(timeline, timeScale), kicks = kickTimes(p, duration);
  const part = t => scorePart(p, t), cues = soundCues(data, timeline, timeScale);
  const sinceKick = clock(kicks), nearBurst = clock(cues.map(c => c.burst).sort((a, b) => a - b));
  const pump = (t, release = .34) => { const u = sinceKick.at(t).since; return u < .004 ? u / .004 : Math.max(0, 1 - (u - .004) / release); };
  const duck = t => { const { since, until } = nearBurst.at(t); return Math.max(since < .08 ? 1 : Math.exp(-(since - .08) / .11), clamp(1 - until / .008)); };
  const into = gainAt => (start, len, amp, pan, signal) => add(drums, start, len, amp, pan, u => gainAt(start + u) * signal(u));
  const toSub = into(t => 1 - .98 * pump(t) ** 1.5), toBass = into(t => (1 - .96 * pump(t) ** 1.5) * (1 - .45 * duck(t)));
  const toFx = into(t => 1 - .65 * duck(t));
  const ROOTS = [31, 39, 34, 29]; // G1 / Eb2 / Bb1 / F1: all fundamentals 40–90 Hz.
  const loop = t => t >= p.drop ? Math.floor((t - p.drop) / bar + 1e-6) % 4 : t >= p.build ? (t < p.build + 2 * bar ? 1 : 3) : t < p.intro ? 0 : Math.floor((t - p.intro) / bar + 1e-6) % 4;
  const chordAt = t => CHORDS[loop(t)];
  const isFull = pt => pt === 'drop1' || pt === 'drop' || pt === 'outro';
  const tail = (u, len, attack = .006, release = .04) => clamp(u / attack) * clamp((len - u) / release);

  // A broad, held kick body, an attack click and saturation; its low end and the sub do not duck for launches.
  const kick = (t, amp) => {
    let phase = 0; const click = hiss(Math.round(t * 1e4), 10000, 2700), lp = svf(sr).set(9000);
    add(drums, t, .4, amp, 0, u => {
      phase += (49 + 161 * Math.exp(-u / .026)) / sr;
      const env = clamp(u / .0012) * (u < .045 ? 1 : Math.exp(-(u - .045) / .095)) * clamp((.4 - u) / .025);
      return lp.run(Math.tanh(2.8 * (Math.sin(TAU * phase) * env + .65 * Math.exp(-u / .003) * click())) / Math.tanh(2.8));
    });
  };
  for (const t of kicks) kick(t, isFull(part(t + 1e-4)) ? .8 : .64);

  const bassNote = (t, len, midi, amp, sub = false) => {
    const f = hz(midi), o = osc(f, 40), lp = svf(sr), hp = svf(sr).set(260); let n = 0;
    (sub ? toSub : toBass)(t, len, amp, 0, u => {
      if (sub) return tail(u, len, .005, .02) * (Math.sin(TAU * f * u) + .13 * Math.sin(2 * TAU * f * u));
      if (n++ % 32 === 0) lp.set(isFull(part(t + u)) ? 1800 : 500 + 700 * energy(p, t + u), .85);
      const v = lp.run((o(f * u) + .35 * o(f * 1.007 * u + .3)) * .7);
      hp.run(v);
      return tail(u, len) * Math.tanh(1.6 * (part(t + u) === 'build' || part(t + u) === 'roll' ? hp.hp : v));
    });
  };
  for (let t = p.intro; t < Math.min(p.finale, duration) - 1e-6; t += beat / 2) {
    const pt = part(t + 1e-4);
    if (pt === 'breath') continue;
    const root = ROOTS[loop(t + 1e-4)], off = Math.round(t / (beat / 2)) % 2;
    bassNote(t, beat / 2 * .92, root, .42, true);
    if (off || pt === 'drop1' || pt === 'drop') bassNote(t, beat / 2 * .85, root + 12, .42);
  }

  // Seven band-limited saws per note, +/-24 cents, spread in stereo. All stereo side energy is
  // high-passed below 150 Hz on the texture bus. The chord tops stay <= D5 throughout the launches.
  const supersaw = (t, len, notes, amp, cutoff, sustained = false) => {
    for (const [v, midi] of notes.entries()) for (let k = 0; k < 7; k++) {
      const f = hz(midi) * 2 ** ((k - 3) * 8 / 1200), o = osc(f, 64), lp = svf(sr); let n = 0;
      const pan = (k - 3) / 3 * .82, phase = (v * .213 + k * .137) % 1;
      add(tex, t, len, amp / 7, pan, u => {
        if (n++ % 64 === 0) lp.set(typeof cutoff === 'function' ? cutoff(t + u, u) : cutoff, .8);
        const env = sustained ? tail(u, len, Math.min(.15, len / 3), .07) : tail(u, len, .004, .035) * Math.exp(-u / .32);
        return lp.run(o(phase + f * u)) * env;
      });
    }
  };
  const pluck = (t, midi, amp, cutoff) => {
    const f = hz(midi), o = osc(f, 40), lp = svf(sr).set(cutoff, 1.1);
    add(tex, t, .21, amp, Math.sin(t * 1.7) * .55, u => tail(u, .21, .002, .025) * Math.exp(-u / .065) * lp.run(o(f * u)));
  };
  for (let t = 0; t < Math.min(p.finale, duration) - 1e-6; t += bar) {
    const pt = part(t + 1e-4), notes = chordAt(t + 1e-4);
    if (pt === 'intro') supersaw(t, Math.min(bar, p.intro - t), CHORDS[0], .13, 420 + t * 120, true);
    else if (pt === 'lift' || pt === 'build' || pt === 'roll') {
      const end = pt === 'lift' ? p.drop1 : p.breath;
      supersaw(t, Math.min(bar, end - t), notes, .19, at => 1000 + 3800 * clamp((at - (pt === 'lift' ? p.lift : p.build)) / Math.max(.001, end - (pt === 'lift' ? p.lift : p.build))), true);
    } else if (isFull(pt)) {
      for (const [step, , steps] of HOOK[0]) supersaw(t + step * s16, steps * s16 * .86, notes, pt === 'drop' ? .31 : .26, pt === 'drop' ? 6800 : 3500);
    } else if (pt === 'A') for (const step of [2, 6, 10, 14]) supersaw(t + step * s16, .16, notes, .12, 850);
  }
  for (let step = 0; step * s16 < Math.min(p.finale, duration) - 1e-6; step++) {
    const t = step * s16, pt = part(t + 1e-4), lateA = t >= p.intro + (p.lift - p.intro) / 2;
    if (!['A', 'lift', 'drop1'].includes(pt) || (pt === 'A' && !lateA && step % 2)) continue;
    const notes = chordAt(t).filter(m => m >= 60).map(m => { while (m < 67) m += 12; return m; }).filter(m => m <= 74);
    pluck(t, notes[Math.floor(step / (pt === 'A' && !lateA ? 2 : 1)) % notes.length], pt === 'drop1' ? .06 : .095, 1200 + 1800 * clamp((t - p.intro) / Math.max(.001, p.build - p.intro)));
  }
  // The written four-bar melody first appears after the last launch, doubled one octave up.
  for (let t = p.drop, m = 0; t < Math.min(p.musicOutro, duration) - 1e-6; t += bar, m++) {
    for (const [step, midi, steps] of HOOK[m % 4]) for (const [octave, gain] of [[0, 1], [12, .34]]) {
      supersaw(t + step * s16, steps * s16 * .91, [midi + octave], .31 * gain, 8500);
    }
  }

  const hat = (t, amp, decay, ride = false) => {
    const n = hiss(Math.round(t * 1e4) + 1, 14000, ride ? 4500 : 6500);
    add(perc, t, Math.min(.65, decay * 5), amp, ride ? -.4 : .35, u => n() * clamp(u / .001) * Math.exp(-u / decay));
  };
  const snare = (t, amp, roll = false) => {
    const n = hiss(Math.round(t * 1e4) + 3, 8000, 900);
    add(perc, t, .18, amp, -.1, u => (n() + .26 * Math.sin(TAU * 185 * u)) * clamp(u / .001) * Math.exp(-u / (roll ? .027 : .045)));
  };
  const clap = (t, amp) => {
    const n = hiss(Math.round(t * 1e4) + 4, 7000, 750);
    add(perc, t, .28, amp, .1, u => { let e = 0; for (const d of [0, .009, .019, .03]) if (u >= d) e = Math.max(e, Math.exp(-(u - d) / (d === .03 ? .065 : .004))); return n() * e; });
  };
  for (let s = 0; s * s16 < Math.min(p.finale, duration) - 1e-6; s++) {
    const t = s * s16, pt = part(t + 1e-4), inBar = s % 16, full = isFull(pt), lateA = t >= p.intro + (p.lift - p.intro) / 2;
    if (pt === 'intro' || pt === 'roll' || pt === 'breath') continue;
    if (s % 4 === 2) hat(t, full ? .48 : .28, full ? .12 : .028);
    if (full || (pt === 'A' && lateA) || pt === 'lift') {
      hat(t, s % 4 ? .11 : .16, .018);
      if (inBar === 4 || inBar === 12) { clap(t, .45); snare(t, .24); }
    }
    if (full && inBar % 4 === 0) hat(t, .15, .18, true);
    if (pt === 'drop1' && [3, 7].includes(Math.floor((t - p.drop1) / bar)) && inBar >= 12) snare(t, .18 + (inBar - 12) * .025, true);
  }
  const roll = (from, to, spacing, amp) => { for (let t = from; t < Math.min(to, duration) - 1e-6; t += spacing) snare(t, amp * (.6 + .4 * clamp((t - from) / Math.max(.001, to - from))), true); };
  roll(Math.max(0, p.intro - beat), p.intro, s16, .18);
  if (p.drop1 > p.lift) { roll(Math.max(p.lift, p.drop1 - 2 * bar), p.drop1 - bar, beat, .2); roll(Math.max(p.lift, p.drop1 - bar), p.drop1 - beat, beat / 2, .25); roll(p.drop1 - beat, p.drop1, s16 / 2, .2); }
  if (p.build < p.gap) { roll(p.build, Math.min(p.build + 2 * bar, p.gap), beat / 2, .22); roll(p.build + 2 * bar, p.gap, s16, .25); roll(p.gap, p.breath, s16 / 2, .28); }

  const impact = (t, amp) => {
    const crash = hiss(Math.round(t * 1000) + 7, 14000, 2200); let phase = 0;
    toFx(t, 2.1, amp, 0, u => { phase += (42 + 32 * Math.exp(-u / .12)) / sr; return tail(u, 2.1, .002, .05) * (.6 * Math.sin(TAU * phase) * Math.exp(-u / .32) + .22 * crash() * Math.exp(-u / .55)); });
  };
  const crash = (t, amp) => { const n = hiss(700 + Math.round(t * 1000), 14000, 3500); add(perc, t, 1.4, amp, -.3, u => tail(u, 1.4, .002) * Math.exp(-u / .34) * n()); };
  const sweep = (t, len, amp, reverse = false) => {
    if (len <= 0 || t < 0) return;
    const n = hiss(Math.round(t * 1000) + 991, 18000, 400), bp = svf(sr); let k = 0, phase = 0;
    toFx(t, len, amp, 0, u => {
      const q = clamp(u / len), x = reverse ? 1 - q : q;
      if (k++ % 32 === 0) bp.set(400 * 22 ** x, .9);
      phase += 150 * 2 ** (3 * q) / sr;
      return tail(u, len, .02, .006) * (bp.run(n()) * (reverse ? (1 - q) ** 2 : q ** 2) + (reverse ? 0 : .09 * Math.sin(TAU * phase) * q ** 3));
    });
  };
  impact(0, .55);
  sweep(Math.max(0, p.intro - bar), Math.min(bar, p.intro), .15);
  for (const t of [p.intro, p.intro + 4 * bar, p.lift, p.drop1, p.drop1 + 4 * bar, p.drop]) if (t < duration && t < p.finale) crash(t, t === p.drop ? .65 : .38);
  if (p.drop1 > p.lift) { sweep(p.lift, p.drop1 - p.lift, .19); sweep(Math.max(p.lift, p.drop1 - beat), Math.min(beat, p.drop1 - p.lift), .26); impact(p.drop1, .75); sweep(p.drop1, bar, .1, true); }
  sweep(p.build, p.drop - p.build, .16);
  sweep(p.breath, p.drop - p.breath, .12);
  if (p.drop < duration) { impact(p.drop, .95); sweep(p.drop, 2 * bar, .13, true); }
  if (p.finale < duration) { supersaw(p.finale, Math.min(1.6, duration - p.finale), CHORDS[0], .4, 5000); impact(p.finale, .8); crash(p.finale, .5); }

  // Dotted-eighth ping-pong and eight-line reverb. Their high-pass sends keep the sub mono.
  const echo = bus(), wet = bus(), delay = Math.round(.75 * beat * sr), ehp = svf(sr).set(350), el = svf(sr).set(3700), er = svf(sr).set(3700);
  for (let i = delay; i < length; i++) {
    ehp.run((tex[0][i - delay] + tex[1][i - delay]) / 2);
    echo[0][i] = el.run(ehp.hp + .4 * echo[1][i - delay]); echo[1][i] = er.run(.4 * echo[0][i - delay]);
  }
  {
    const lens = [1031, 1327, 1523, 1777, 1949, 2213, 2459, 2687].map(l => Math.max(1, Math.round(l * sr / 44100))), lines = lens.map(l => new Float32Array(l)), at = new Int32Array(8);
    const g = lens.map(l => 10 ** (-3 * l / sr / 2.1)), damp = Math.exp(-TAU * 4500 / sr), state = new Float64Array(8), y = new Float64Array(8), pre = Math.round(.025 * sr), hl = svf(sr).set(200), hr = svf(sr).set(200);
    for (let i = 0; i < length; i++) {
      const j = i - pre;
      hl.run(j >= 0 ? tex[0][j] + .18 * perc[0][j] + .4 * echo[0][j] : 0); hr.run(j >= 0 ? tex[1][j] + .18 * perc[1][j] + .4 * echo[1][j] : 0);
      let sum = 0; for (let k = 0; k < 8; k++) { y[k] = lines[k][at[k]]; sum += y[k]; }
      for (let k = 0; k < 8; k++) { const v = (y[k] - sum / 4) * g[k]; state[k] = v + damp * (state[k] - v); lines[k][at[k]] = state[k] + (k % 2 ? hr.hp : hl.hp) * .5; if (++at[k] >= lens[k]) at[k] = 0; }
      wet[0][i] = (y[0] - y[2] + y[4] - y[6]) * .35; wet[1][i] = (y[1] - y[3] + y[5] - y[7]) * .35;
    }
  }
  const sideHP = [svf(sr).set(150), svf(sr).set(150)], outroHP = [svf(sr), svf(sr)];
  const sectionGain = { intro: .65, A: .46, lift: .65, drop1: 1, build: .52, roll: .46, breath: .14, drop: 1.48, outro: 1.15 };
  for (let i = 0; i < length; i++) {
    const t = i / sr, pt = part(t), d = duck(t), pumpGain = 1 - .85 * pump(t, .36) ** 1.5;
    const l = tex[0][i] + .32 * echo[0][i] + .38 * wet[0][i], r = tex[1][i] + .32 * echo[1][i] + .38 * wet[1][i];
    sideHP[0].run((l - r) / 2); sideHP[1].run(sideHP[0].hp);
    const mid = (l + r) / 2, side = sideHP[1].hp;
    for (const ch of [0, 1]) {
      drums[ch][i] += 1.8 * perc[ch][i] * (1 - .84 * d) + 6 * (mid + (ch ? -side : side)) * pumpGain * (1 - .82 * d);
      if (pt === 'outro' && t < p.finale) {
        if (i % 32 === 0) outroHP[ch].set(25 + 900 * clamp((t - p.musicOutro) / Math.max(.001, p.finale - p.musicOutro)) ** 1.5);
        outroHP[ch].run(drums[ch][i]); drums[ch][i] = outroHP[ch].hp;
      }
      drums[ch][i] *= sectionGain[pt] * (.9 + .1 * energy(p, t));
    }
  }

  // Launch cues: a whistle on the rise; on the date, a crack, a mid-range body (nothing under the bass), the lab's
  // chime and a short crackle. Launches within 0.35 s share loudness by 1/sqrt(n), and the crackle thins out and
  // softens as launches crowd, so dense clusters do not turn into a wash. Bursts land exactly on their dates.
  const whistleLow = pole(640, sr), whistleHigh = pole(5300, sr), crackHigh = pole(11000, sr), bodyHigh = pole(1700, sr), bodyLow = pole(120, sr);
  for (const cue of cues) {
    const gain = 1 / Math.sqrt(cue.neighbors), crowd = cues.reduce((s, c) => s + Math.exp(-Math.abs(c.burst - cue.burst) / .5), 0), rng = seeded(cue.id);
    const rise = cue.burst - cue.launch; let low = 0, high = 0;
    if (rise > 0) add(sfx, cue.launch, rise, .07 * gain, cue.pan * .6, u => {
      const q = u / rise, n = rng() * 2 - 1; low += whistleLow * (n - low); high += whistleHigh * (n - high);
      return Math.sin(Math.PI * q) * (.6 * (high - low) * q + .25 * Math.sin(TAU * (700 * u + 900 * u * u / rise)));
    });
    const f = hz(cue.tone), phase = rng() * TAU, h2 = 2 * f < .45 * sr ? .22 : 0, h3 = 3 * f < .45 * sr ? .07 : 0; let crack = 0, body = 0, floor = 0;
    add(sfx, cue.burst, 1.2, .75 * gain, cue.pan, u => {
      const n = rng() * 2 - 1; crack += crackHigh * (n - crack); body += bodyHigh * (n - body); floor += bodyLow * (n - floor);
      const bell = Math.exp(-u / .32) * Math.sin(TAU * f * u + phase) + h2 * Math.exp(-u / .14) * Math.sin(2 * TAU * f * u) + h3 * Math.exp(-u / .07) * Math.sin(3 * TAU * f * u);
      return Math.min(1, u / .0015) * Math.min(1, (1.2 - u) / .05) * (.5 * (crack - body) * Math.exp(-u * 90) + .9 * (body - floor) * Math.exp(-u * 11) + .35 * bell);
    });
    const clicks = Math.max(4, Math.round(12 / Math.sqrt(crowd))), level = .1 / crowd ** .75;
    for (let k = 0; k < clicks; k++) {
      const at = cue.burst + .1 + rng() ** 1.3 * .6, click = hiss(`${cue.id}-${k}`, 12000, 2200), pan = clamp(cue.pan + (rng() - .5) * .2, -1, 1);
      add(sfx, at, .008, level * (1 - (at - cue.burst) / .8), pan, u => click() * Math.exp(-u * 650));
    }
  }

  // A final chord at the last bar, then its tail. Only the last second is tapered to exact silence.
  const fade = Math.min(1, duration / 4), envelope = t => clamp(t / .01) * (1 - clamp((t - (duration - fade)) / Math.max(.001, fade - 1 / sr))) ** 2;
  let music = 0, effects = 0, both = 0;
  for (let i = 0; i < length; i++) {
    const e = envelope(i / sr) ** 2;
    music += (drums[0][i] ** 2 + drums[1][i] ** 2) * e; effects += (sfx[0][i] ** 2 + sfx[1][i] ** 2) * e; both += ((drums[0][i] + sfx[0][i]) ** 2 + (drums[1][i] + sfx[1][i]) ** 2) * e;
  }
  const knee = Math.sqrt(both / (2 * length)) * 10 ** (13 / 20) || 1;
  const windows = cues.map(c => {
    let m = 0, s = 0;
    for (let i = Math.ceil(c.burst * sr), end = Math.min(length, Math.ceil((c.burst + .08) * sr)); i < end; i++) { m += drums[0][i] ** 2 + drums[1][i] ** 2; s += sfx[0][i] ** 2 + sfx[1][i] ** 2; }
    return 10 * Math.log10(s / m);
  }).filter(Number.isFinite).sort((a, b) => a - b);
  const kept = stems ? [drums, sfx].map(b => b.map(ch => Float32Array.from(ch))) : null;
  const level = new Float32Array(length);
  let power = 0;
  for (let i = 0; i < length; i++) {
    const e = envelope(i / sr);
    for (const ch of [0, 1]) drums[ch][i] = knee * Math.tanh((drums[ch][i] + sfx[ch][i]) * e / knee);
    level[i] = Math.max(Math.abs(drums[0][i]), Math.abs(drums[1][i])); power += drums[0][i] ** 2 + drums[1][i] ** 2;
  }
  // Look-ahead limiter with its ceiling 12 dB above the mix RMS: only the sharpest transients are pulled down
  // (2 ms ramp ahead of the peak, 80 ms release). The level follows the RMS, so one stray peak cannot set it.
  const ceiling = Math.sqrt(power / (2 * length)) * 10 ** (12 / 20), ramp = 1 / Math.round(.002 * sr), release = 1 - Math.exp(-1 / (.08 * sr));
  for (let i = length - 1, next = 1; i >= 0; i--) next = level[i] = Math.min(level[i] > ceiling ? ceiling / level[i] : 1, next + ramp);
  const [left, right] = drums, gain = ceiling ? .66 / ceiling : 1;
  let sum = 0, peak = 0;
  for (let i = 0, g = 1; i < length; i++) {
    g = Math.min(level[i], g + (1 - g) * release);
    left[i] *= g * gain; right[i] *= g * gain; sum += left[i] ** 2 + right[i] ** 2; peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  if (kept) for (const b of kept) for (const ch of b) for (let i = 0; i < length; i++) ch[i] *= envelope(i / sr) * gain;
  const metrics = {
    samples: length, duration: length / sr, samplePeakDbfs: peak ? 20 * Math.log10(peak) : -Infinity, rmsDbfs: 10 * Math.log10(sum / (2 * length)), bpm: SCORE.bpm, cueCount: cues.length, introEnd: p.intro, drop: p.drop, kicks: kicks.length,
    sfxToBgmDb: 10 * Math.log10(effects / music), eventSfxToBgmDb: windows.length ? windows[Math.floor(windows.length / 2)] : null,
  };
  return { left, right, sampleRate, cues, metrics, ...(kept && { stems: { bgm: kept[0], sfx: kept[1] } }) };
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
