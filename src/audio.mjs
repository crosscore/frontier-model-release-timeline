// Original composition: "Deep Field / 005". Pure oscillators + seeded noise.
// No recorded samples, external music, audio libraries, or network services.
import { FIREWORK, seeded } from './draw.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, kickTimes } from './timeline.mjs';

export const SCORE = Object.freeze({ title: 'Deep Field / 005', bpm: 128, sampleRate: 48000, channels: 2, targetLufs: -16, truePeakDb: -1.5 });
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

// Sections follow the film, not the release dates, and start on bar lines: an intro bar, grooves A, B and C over the
// calendar (4, 4 and 2 bars in the 30-second cut), a build bar, a half-bar kick roll, a half-bar breath, then the drop
// at the observation cutoff, which keeps going until the track fades out. There is no closing cadence.
export function scorePart(p, t) {
  if (t < p.intro) return 'intro';
  if (t < p.build) {
    const bars = Math.max(0, (p.build - p.intro) / BAR_SECONDS), k = (t - p.intro) / BAR_SECONDS;
    return k < Math.round(.4 * bars) ? 'A' : k < Math.round(.8 * bars) ? 'B' : 'C';
  }
  return t < p.gap ? 'build' : t < p.breath ? 'roll' : t < p.drop ? 'breath' : 'drop';
}

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

// `stems: true` also returns the music (bgm) and launch-cue (sfx) buses as they enter the master, with the fade and
// output gain they share with the mix. They cost two extra stereo buffers, so they are only kept on request.
export function synthesize(data, timeline, { duration = timeline.duration, timeScale = duration / timeline.duration, sampleRate = SCORE.sampleRate, stems = false } = {}) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || !Number.isFinite(timeScale) || timeScale <= 0) throw new Error('Invalid audio duration, rate, or time scale');
  const sr = sampleRate, length = Math.ceil(duration * sr), bus = () => [new Float32Array(length), new Float32Array(length)];
  // The music bus (`drums`) collects the kick and every layer that needs no bus processing; the hats and the texture
  // get their own buses for the reverb and delay sends and are mixed in at the end.
  const drums = bus(), perc = bus(), tex = bus(), sfx = bus();
  function add(target, start, len, amp, pan, signal) {
    const first = Math.max(0, Math.ceil(start * sr)), end = Math.min(length, Math.ceil((start + len) * sr));
    const gl = Math.cos((pan + 1) * Math.PI / 4) * amp, gr = Math.sin((pan + 1) * Math.PI / 4) * amp;
    for (let i = first; i < end; i++) { const v = signal(i / sr - start); target[0][i] += v * gl; target[1][i] += v * gr; }
  }
  const osc = (f, limit) => saw(f, limit, sr), hiss = (seed, high, low = 230) => noise(seed, high, low, sr);
  const beat = BEAT_SECONDS, bar = BAR_SECONDS, s16 = beat / 4, p = cuePoints(timeline, timeScale), kicks = kickTimes(p, duration);
  const part = t => scorePart(p, t), progress = t => clamp((t - p.intro) / Math.max(.001, p.build - p.intro));

  // Sidechain and ducking. The sub and bass duck almost fully under each kick and swell back (the pump); the texture
  // and its echoes pump less. Around each burst the music above the sub steps aside with a 5 ms look-ahead, a 40 ms
  // hold and a 0.14 s release: texture −6 dB, hats −8 dB, pads and transitions −4 dB, bass −2.5 dB. The kick and
  // sub never duck for launches, so the beat stays solid under dense clusters.
  const cues = soundCues(data, timeline, timeScale), bursts = cues.map(c => c.burst).sort((a, b) => a - b), sinceKick = clock(kicks), nearBurst = clock(bursts);
  const pump = (t, release) => { const u = sinceKick.at(t).since; return u < .004 ? u / .004 : Math.max(0, 1 - (u - .004) / release); };
  const duck = t => { const { since, until } = nearBurst.at(t); return Math.max(since < .04 ? 1 : Math.exp(-(since - .04) / .14), clamp(1 - until / .005)); };
  const into = gainAt => (start, len, amp, pan, signal) => add(drums, start, len, amp, pan, u => gainAt(start + u) * signal(u));
  const toSub = into(t => 1 - pump(t, .3) ** 2), toBass = into(t => (1 - .95 * pump(t, .42) ** 1.6) * (1 - .25 * duck(t))), toFx = into(t => 1 - .35 * duck(t));
  const lift = t => ({ intro: .8, A: .86, B: .93, C: 1, build: 1, roll: 1, breath: 1, drop: 1.08 })[part(t)];
  // G minor, one root per bar: G, E♭, C, D from the first calendar bar; D in the bar before the drop; G again at the drop.
  const ROOTS = [31, 39, 36, 38];
  const loop = t => t >= p.drop ? Math.floor((t - p.drop) / bar + 1e-6) % 4 : t >= p.gap ? 3 : t < p.intro ? 0 : Math.floor((t - p.intro) / bar + 1e-6) % 4;

  // Kick: a sine falling from 210 Hz to G (49 Hz) with a held body, a long tail and a noise click, saturated so its
  // harmonics carry on small speakers, then low-passed so the saturation adds no fizz on top.
  const kick = (t, amp) => {
    let phase = 0; const click = hiss(Math.round(t * 1e4), 10000, 2700), lp = svf(sr).set(9000);
    add(drums, t, .46, amp, 0, u => {
      phase += (49 + 161 * Math.exp(-u / .032)) / sr;
      const env = Math.min(1, u / .0012) * (u < .045 ? 1 : Math.exp(-(u - .045) / .13)) * Math.min(1, (.46 - u) / .02);
      return lp.run(Math.tanh(2.6 * (Math.sin(TAU * phase) * env + .5 * Math.exp(-u / .0025) * click())) / Math.tanh(2.6));
    });
  };
  for (const t of kicks) kick(t, ({ intro: .7, A: .75, B: .78, C: .8, drop: .92 })[part(t + 1e-4)] ?? .84);

  // Low end, all mono: a sine sub on the root and three detuned saws an octave up, one long note per bar. Both duck
  // almost fully under each kick and swell back between kicks, which is the pump. The bass filter opens with the
  // calendar but stays under the chimes until the launches are over.
  const bassCut = t => { const pt = part(t); return pt === 'drop' ? 1700 : pt === 'build' || pt === 'roll' ? 1100 + 400 * clamp((t - p.build) / bar) : 300 + 800 * progress(t) ** 1.3; };
  const subNote = (t, len, midi, amp, glide = 0) => {
    let phase = 0;
    toSub(t, len, amp, 0, u => { phase += hz(midi + glide * u / len) / sr; return Math.min(1, u / .005) * Math.min(1, (len - u) / .01) * (Math.sin(TAU * phase) + .15 * Math.sin(2 * TAU * phase)); });
  };
  const bassNote = (t, len, midi, amp) => {
    const voices = [-14, 0, 14].map((cents, k) => { const f = hz(midi) * 2 ** (cents / 1200); return [osc(f, 60), f, k * .29 + .1]; }), lp = svf(sr);
    let n = 0;
    toBass(t, len, amp, 0, u => {
      if (n++ % 32 === 0) lp.set(bassCut(t + u), 1.2);
      let v = 0; for (const [o, f, phase] of voices) v += o(phase + f * u);
      return Math.min(1, u / .004) * Math.min(1, (len - u) / .02) * Math.tanh(1.8 * lp.run(v * .58)) / 1.8;
    });
  };
  for (let k = 1; k * bar < duration - 1e-6; k++) {
    const t = k * bar, pt = part(t + 1e-4), root = ROOTS[loop(t + 1e-4)], len = Math.min(pt === 'roll' ? bar / 2 : bar + .02, duration - t);
    if (pt === 'intro' || pt === 'breath') continue;
    // In the kick roll the sub slides up an octave on D; then everything but the risers drops out for the breath.
    if (pt === 'roll') subNote(t, len, root - 12, .5, 12); else subNote(t, len, root, .4 * lift(t));
    bassNote(t, len, root + 12, .7 * lift(t));
  }

  // Upper texture, kept sparse: a dub chord stab of B♭ D F G C (the pentatonic itself, consonant over every root),
  // later the hook, both through a filter that opens with the calendar, a ping-pong delay and a dark reverb.
  const STAB = [58, 62, 65, 67, 72], STABS = { A: [7], B: [2, 10], C: [2, 10], build: [2, 10], drop: [2, 10] };
  const stab = (t, amp) => {
    for (const [v, midi] of STAB.entries()) for (const d of [-.004, .004]) {
      const f = hz(midi) * (1 + d), o = osc(f, 40), lp = svf(sr), phase = (v * .23 + d * 60 + 1) % 1;
      let n = 0;
      add(tex, t, .22, amp, 0, u => { if (n++ % 16 === 0) lp.set(300 + 1800 * Math.exp(-u / .05), 1.6); return Math.min(1, u / .002) * Math.exp(-u / .12) * Math.min(1, (.22 - u) / .02) * lp.run(o(phase + f * u)); });
    }
  };
  // Hats, shaker, rim and claps arrive section by section; there are no sixteenth-note synths.
  // Everything is band-limited: hats 7–11 kHz, shaker under 10 kHz, claps under 5 kHz, so the music has little air.
  const hat = (t, amp, decay) => {
    const n = hiss(Math.round(t * 1e4) + 1, 11000, 3900), hp = svf(sr).set(7000, .8), lp = svf(sr).set(11000);
    add(perc, t, Math.min(.5, decay * 6), amp, .15, u => { hp.run(n()); return lp.run(hp.hp) * Math.min(1, u / .0005) * Math.exp(-u / decay); });
  };
  const shaker = (t, amp) => { const n = hiss(Math.round(t * 1e4) + 2, 10000, 5300), lp = svf(sr).set(9500); add(perc, t, .09, amp, -.3, u => lp.run(n()) * Math.min(1, u / .006) * Math.exp(-u / .025)); };
  const rim = (t, amp) => { const n = hiss(Math.round(t * 1e4) + 3, 7000, 1700); add(perc, t, .06, amp, .3, u => (.7 * Math.sin(TAU * 1650 * u) + .6 * n()) * Math.exp(-u / .011)); };
  const clap = (t, amp) => {
    const n = hiss(Math.round(t * 1e4) + 4, 6100, 640), lp = svf(sr).set(5000);
    add(perc, t, .3, amp, -.05, u => { let e = 0; for (const d of [0, .0095, .019]) if (u >= d) e = Math.max(e, Math.exp(-(u - d) / .0042)); if (u >= .027) e = Math.max(e, .7 * Math.exp(-(u - .027) / .08)); return lp.run(n()) * e; });
  };
  for (let s = 0; s * s16 < duration - 1e-6; s++) {
    const t = s * s16, pt = part(t + 1e-4), inBar = s % 16, inBeat = s % 4, d = lift(t);
    if (STABS[pt]?.includes(inBar)) stab(t, .16 * d);
    if (pt === 'intro' || pt === 'roll' || pt === 'breath') continue;
    if (inBeat === 2) hat(t, (pt === 'A' ? .35 : .43) * d, .03);
    if (pt === 'A') continue;
    shaker(t, (inBeat === 0 ? .16 : .11) * d);
    if (inBar === 4 || inBar === 12) clap(t, .55 * d);
    if (inBar === 3 || inBar === 10) rim(t, .18 * d);
    if (pt !== 'B' && inBeat === 2) hat(t, .24 * d, .14);
  }

  // The hook in the drop: G–B♭–D, then a different answer in each bar, all on the chimes' five notes, so the launch
  // pitches turn into the tune once the launches are over.
  const HOOK = [[[0, 67, 3], [3, 70, 3], [6, 74, 6], [12, 72, 2], [14, 70, 2]], [[0, 67, 3], [3, 70, 3], [6, 77, 4], [10, 74, 6]],
    [[0, 67, 3], [3, 70, 3], [6, 74, 6], [12, 77, 2], [14, 79, 2]], [[0, 67, 3], [3, 70, 3], [6, 72, 4], [10, 70, 6]]];
  const lead = (t, len, midi, amp) => {
    const f = hz(midi), o = osc(f, 30), lp = svf(sr);
    let n = 0;
    add(tex, t, len + .25, amp, 0, u => {
      if (n++ % 16 === 0) lp.set(500 + 3800 * Math.exp(-u / .06), 1.4);
      const gate = Math.min(1, u / .004) * (u < len ? 1 : Math.max(0, 1 - (u - len) / .25));
      return gate * Math.exp(-u / .45) * (lp.run(.6 * o(f * u)) + .5 * Math.sin(TAU * f * u) + .12 * Math.exp(-u / .12) * Math.sin(TAU * 2 * f * u));
    });
  };
  for (let t = p.drop, m = 0; t < duration - .01; t += bar, m++) for (const [step, midi, steps] of HOOK[m % 4]) lead(t + step * s16, steps * s16 * .9, midi, .2);

  // Pads only frame the calendar: a muffled swell in the intro and an E♭-over-D swell under the last calendar bar.
  const pad = (t, len, notes, amp, cutoff) => {
    for (const [v, midi] of notes.entries()) for (const d of [-.006, .006]) {
      const f = hz(midi) * (1 + d), o = osc(f, 24), lp = svf(sr).set(cutoff, .7), phase = (v * .31 + d * 50 + 1) % 1;
      toFx(t, len, amp, (v - (notes.length - 1) / 2) * .25 + d * 30, u => Math.min(1, u / (len * .45)) * Math.min(1, (len - u) / .15) * lp.run(o(phase + f * u)));
    }
  };
  pad(0, Math.min(duration, p.intro + .3), [43, 50, 55, 58, 62], .03, 600);
  if (p.drop > p.gap && p.gap >= 0) pad(p.gap, Math.min(duration, p.drop + .05) - p.gap, [50, 55, 58, 63], .025, 1400);

  // Transitions: an opening boom, a fill into the chart, small crashes on grooves B and C, a two-bar build, and the drop.
  const impact = (t, amp, boom = 1) => {
    const crash = hiss(Math.round(t * 1000) + 7, 12000, 2700); let phase = 0;
    toFx(t, 2.4, amp, 0, u => { phase += (37 + 23 * Math.exp(-u / .25)) / sr; return boom * .5 * Math.sin(TAU * phase) * Math.min(1, u / .003) * Math.exp(-u / .55) + .1 * crash() * Math.exp(-u / .7) * Math.min(1, u / .002); });
  };
  const sweep = (t, len, amp, from, to, seed) => {
    const n = hiss(seed, 24000, 150), bp = svf(sr); let c = 0;
    toFx(t, len, amp, 0, u => { const q = u / len; if (c++ % 32 === 0) bp.set(from * (to / from) ** q, 1.5); bp.run(n()); return bp.bp * q * q * Math.min(1, (len - u) / .005); });
  };
  impact(0, .8);
  if (p.intro < duration) { const len = Math.min(p.intro, 2 * beat); sweep(p.intro - len, len, .06, 600, 6000, 77); impact(p.intro, .45, .5); }
  for (let t = p.intro + bar; t < p.build - 1e-6; t += bar) if (part(t + 1e-4) !== part(t - 1e-4)) impact(t, .3, .2);
  if (p.build >= p.intro) {
    sweep(p.build, p.drop - p.build, .08, 300, 7000, 991);
    let phase = 0; const lp = svf(sr).set(3000);
    toFx(p.gap, bar, .02, 0, u => { const q = u / bar; phase += 160 * 2 ** (3 * q) / sr; return q * lp.run(Math.sin(TAU * phase)); });
    const swell = hiss(313, 24000), len = p.drop - p.breath, slp = svf(sr); let c = 0;
    toFx(p.breath, len, .08, 0, u => { const q = u / len; if (c++ % 32 === 0) slp.set(300 + 7000 * q * q, .8); return slp.run(swell()) * q ** 2.5; });
    // Snare roll: eighths, then sixteenths, then thirty-seconds through the kick roll.
    for (let t = p.build, k = 0; t < p.breath - .01; t += t < p.build + bar / 2 - 1e-6 ? beat / 2 : t < p.gap - 1e-6 ? s16 : s16 / 2, k++) {
      const q = (t - p.build) / (p.breath - p.build), snare = hiss(500 + k, 7000), f = 170 + 160 * q;
      add(drums, t, .09, .025 + .07 * q, 0, u => (snare() + .4 * Math.sin(TAU * f * u)) * Math.exp(-u * 40));
    }
  }
  if (p.drop < duration) impact(p.drop, 1.1);

  // Bus processing. The texture's low-pass opens from 600 Hz in the intro to fully open in the drop.
  for (const ch of tex) {
    const lp = svf(sr);
    for (let i = 0; i < ch.length; i++) {
      if (i % 32 === 0) { const t = i / sr, pt = part(t); lp.set(pt === 'intro' ? 600 : pt === 'drop' ? 8000 : t < p.build ? 900 + 3100 * progress(t) ** 1.4 : 4000 + 3000 * clamp((t - p.build) / Math.max(.001, p.drop - p.build)), 1.1); }
      ch[i] = lp.run(ch[i]);
    }
  }
  // Dotted-eighth ping-pong (damped, nothing under 350 Hz), then an eight-line feedback-delay reverb fed by the
  // texture, its echoes and a little of the hats.
  const echo = bus(), wet = bus(), delay = Math.round(.75 * beat * sr), ehp = svf(sr).set(350), el = svf(sr).set(2400), er = svf(sr).set(2400);
  for (let i = delay; i < length; i++) {
    ehp.run((tex[0][i - delay] + tex[1][i - delay]) / 2);
    echo[0][i] = el.run(ehp.hp + .5 * echo[1][i - delay]); echo[1][i] = er.run(.5 * echo[0][i - delay]);
  }
  {
    const lens = [1031, 1327, 1523, 1777, 1949, 2213, 2459, 2687].map(l => Math.max(1, Math.round(l * sr / 44100))), lines = lens.map(l => new Float32Array(l)), at = new Int32Array(8);
    const g = lens.map(l => 10 ** (-3 * l / sr / 3.2)), damp = Math.exp(-TAU * 3800 / sr), state = new Float64Array(8), y = new Float64Array(8), pre = Math.round(.025 * sr), hl = svf(sr).set(200), hr = svf(sr).set(200);
    for (let i = 0; i < length; i++) {
      const j = i - pre;
      hl.run(j >= 0 ? tex[0][j] + .15 * perc[0][j] + .5 * echo[0][j] : 0); hr.run(j >= 0 ? tex[1][j] + .15 * perc[1][j] + .5 * echo[1][j] : 0);
      let sum = 0; for (let k = 0; k < 8; k++) { y[k] = lines[k][at[k]]; sum += y[k]; }
      for (let k = 0; k < 8; k++) {
        const v = (y[k] - sum / 4) * g[k]; state[k] = v + damp * (state[k] - v);
        lines[k][at[k]] = state[k] + (k % 2 ? hr.hp : hl.hp) * .5; if (++at[k] >= lens[k]) at[k] = 0;
      }
      wet[0][i] = (y[0] - y[2] + y[4] - y[6]) * .35; wet[1][i] = (y[1] - y[3] + y[5] - y[7]) * .35;
    }
  }
  // The hats and the texture with its echoes and reverb join the music bus, pumping and ducking as described above.
  const depth = { intro: .3, A: .5, B: .55, C: .6, build: .6, roll: .6, breath: 0, drop: .6 };
  for (let i = 0; i < length; i++) {
    const t = i / sr, ducked = duck(t), gPerc = 1 - .6 * ducked, gTex = (1 - depth[part(t)] * pump(t, .4) ** 1.6) * (1 - .5 * ducked);
    for (const ch of [0, 1]) drums[ch][i] += perc[ch][i] * gPerc + (tex[ch][i] + .45 * echo[ch][i] + .8 * wet[ch][i]) * gTex;
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
    add(sfx, cue.burst, 1.2, .55 * gain, cue.pan, u => {
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

  // Mix, glue with soft saturation, and shape the edges: an instant start under the opening boom and a long fade-out
  // over the groove instead of an ending. The saturation's knee sits 13 dB above the mix RMS, so it rounds only the
  // loudest hits whatever the absolute bus levels are.
  const fade = Math.min(3.2, duration / 4), envelope = t => clamp(t / .01) * Math.cos(Math.PI / 2 * clamp((t - (duration - fade)) / fade)) ** 2;
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
