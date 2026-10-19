// Original composition: "Long Exposure / 007". Pure oscillators + seeded noise.
// No recorded samples, external music, audio libraries, or network services.
import { FIREWORK, seeded } from './draw.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, kickTimes, scorePart } from './timeline.mjs';

export const SCORE = Object.freeze({ title: 'Long Exposure / 007', bpm: 128, key: 'B♭ major', sampleRate: 48000, channels: 2, targetLufs: -14, truePeakDb: -1.0 });
const TAU = Math.PI * 2, hz = midi => 440 * 2 ** ((midi - 69) / 12);
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Each lab keeps its stereo position and chime by id, so reordering the labs changes nothing. The chimes are the five
// notes of B♭ major pentatonic; no chord in the score has a tone a semitone under them, so any set can ring together.
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
// One chord per bar in B♭ major: the calendar loops I–IV–vi–V (B♭add9, E♭maj9, Gm11, F7sus4), the build holds IV and
// then V, the reveal loops again, and the film closes IV–I on B♭6/9. `pad` is the sustained voicing, `arp` the four
// notes of the sixteenth-note sequence and `root` the bass (49–87 Hz). No voice is a semitone under a chime
// (A, E, F♯, B, C♯), and none is above D5 (MIDI 74), so the chime band stays clear while launches can sound.
const deepFreeze = x => { for (const v of Object.values(x)) if (typeof v === 'object') deepFreeze(v); return Object.freeze(x); };
export const CHORDS = deepFreeze({
  Bb: { root: 34, pad: [53, 58, 62, 65, 72], arp: [58, 65, 70, 72] },
  Eb: { root: 39, pad: [51, 58, 62, 65, 67], arp: [58, 63, 67, 70] },
  Gm: { root: 31, pad: [55, 62, 65, 70, 72], arp: [55, 62, 67, 70] },
  F: { root: 41, pad: [53, 60, 63, 65, 70], arp: [53, 60, 65, 70] },
  final: { root: 34, pad: [46, 53, 58, 62, 67, 72, 74], arp: [58, 65, 70, 74] },
});
// The theme, as [sixteenth, MIDI note, sixteenths] per bar over B♭–E♭–Gm–F, E♭ and the closing B♭. It sings only once
// the calendar has stopped; its first four bars are heard earlier, an octave down, on the electric piano.
export const THEME = deepFreeze([
  [[0, 74, 6], [6, 72, 2], [8, 70, 4], [12, 72, 4]],
  [[0, 74, 6], [6, 75, 2], [8, 77, 4], [12, 79, 4]],
  [[0, 82, 6], [6, 79, 2], [8, 77, 3], [11, 74, 5]],
  [[0, 75, 6], [6, 74, 2], [8, 72, 8]],
  [[0, 70, 6], [6, 72, 2], [8, 74, 4], [12, 72, 4]],
  [[0, 70, 14]],
]);
// The sequence walks up and down its four notes; eighth-note passages use the first half.
const PENDULUM = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];

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
// t increases.
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
// A value that moves linearly between [time, value] points and holds beyond them. Points that do not move forward in
// time (sections a compressed render squeezes out) are skipped.
const curve = raw => {
  const points = raw.reduce((kept, point) => !kept.length || point[0] > kept.at(-1)[0] + 1e-9 ? [...kept, point] : kept, []);
  return t => {
    if (t <= points[0][0]) return points[0][1];
    for (let k = 1; k < points.length; k++) if (t < points[k][0]) { const [a, x] = points[k - 1], [b, y] = points[k]; return x + (y - x) * (t - a) / (b - a); }
    return points.at(-1)[1];
  };
};

// The music's level follows one slow arc (dB, before mastering). Every change is a ramp across bars, so no section
// is a step louder than the one before it; the reveal sits level with the groove and the closing bars only fall.
export function musicArc(p) {
  return curve([[0, -6], [p.intro, -2.5], [p.lift, -1.5], [p.drop1, 0], [p.build, 1], [p.drop, -.5], [p.musicOutro, -1], [p.finale, -2.5], [p.end, -2.5]]);
}

// `stems: true` exposes the BGM and launch buses before master saturation, at the same output gain.
export function synthesize(data, timeline, { duration = timeline.duration, timeScale = duration / timeline.duration, sampleRate = SCORE.sampleRate, stems = false } = {}) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600 || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000 || !Number.isFinite(timeScale) || timeScale <= 0) throw new Error('Invalid audio duration, rate, or time scale');
  const sr = sampleRate, length = Math.ceil(duration * sr), bus = () => [new Float32Array(length), new Float32Array(length)];
  // low: kick and sub, never ducked. bass: the plucked bass. tex: pads, sequence, keys and lead (sent to the delay
  // and reverb). perc: hats, claps, fills and cymbals. fx: swells and the riser. sfx: the launch cues.
  const low = bus(), bass = bus(), tex = bus(), perc = bus(), fx = bus(), sfx = bus();
  function add(target, start, len, amp, pan, signal, gain) {
    const first = Math.max(0, Math.ceil(start * sr)), last = Math.min(length, Math.ceil((start + len) * sr));
    const gl = Math.cos((pan + 1) * Math.PI / 4) * amp, gr = Math.sin((pan + 1) * Math.PI / 4) * amp;
    for (let i = first; i < last; i++) { const v = signal(i / sr - start) * (gain ? gain[i] : 1); target[0][i] += v * gl; target[1][i] += v * gr; }
  }
  const osc = (f, limit) => saw(f, limit, sr), hiss = (seed, high, low = 230) => noise(seed, high, low, sr);
  const beat = BEAT_SECONDS, bar = BAR_SECONDS, s16 = beat / 4, p = cuePoints(timeline, timeScale), kicks = kickTimes(p, duration);
  const stop = Math.min(p.end, duration), part = t => scorePart(p, t), cues = soundCues(data, timeline, timeScale);
  const tail = (u, len, attack = .004, release = .03) => clamp(u / attack) * clamp((len - u) / release);

  // Control curves per sample: the kick's sidechain pump and the launch duck (8 ms look-ahead, 80 ms hold, 110 ms release).
  const sinceKick = clock(kicks), nearBurst = clock(cues.map(c => c.burst).sort((a, b) => a - b));
  const pumpAt = new Float32Array(length), duckAt = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sr, u = sinceKick.at(t).since, { since, until } = nearBurst.at(t);
    pumpAt[i] = (u < .004 ? u / .004 : Math.max(0, 1 - (u - .004) / .3)) ** 1.5;
    duckAt[i] = Math.max(since < .08 ? 1 : Math.exp(-(since - .08) / .11), clamp(1 - until / .008));
  }
  const pumped = depth => pumpAt.map(x => 1 - depth * x);
  const padPump = pumped(.4), seqPump = pumped(.2), subPump = pumped(.88);

  // Harmony: intro bars count back from the calendar's first bar; every other bar counts on from its section start.
  const CYCLE = ['Bb', 'Eb', 'Gm', 'F'], since = (t, from) => Math.floor((t - from) / bar + 1e-6);
  const chordAt = t => {
    if (t >= p.finale) return CHORDS.final;
    if (t >= p.musicOutro) return CHORDS.Eb;
    if (t >= p.drop) return CHORDS[CYCLE[since(t, p.drop) % 4]];
    if (t >= p.build) return CHORDS[since(t, p.build) < Math.ceil(Math.round((p.drop - p.build) / bar) / 2) ? 'Eb' : 'F'];
    if (t >= p.intro) return CHORDS[CYCLE[since(t, p.intro) % 4]];
    const back = Math.ceil((p.intro - t) / bar - 1e-6);
    return CHORDS[back <= 1 ? 'F' : back === 2 ? 'Eb' : 'Bb'];
  };
  const segments = [], marks = [...new Set([0, p.intro, p.build, p.drop, p.musicOutro, p.finale, stop])].filter(x => x <= stop).sort((a, b) => a - b);
  for (let k = 0; k + 1 < marks.length; k++) {
    const from = marks[k], to = marks[k + 1];
    if (to - from < 1e-6) continue;
    if (to === p.intro) for (let t = to; t > from + 1e-6; t -= bar) segments.unshift([Math.max(from, t - bar), t]);
    else for (let t = from; t < to - 1e-6; t += bar) segments.push([t, Math.min(to, t + bar)]);
  }
  const lateA = t => t >= p.intro + (p.lift - p.intro) / 2;

  // Pad: three saws a note, ±9 cents, spread in stereo, gently pumped. Chords overlap by their release, so the bed
  // never drops out between bars. The filter opens across the calendar, eases for the theme and closes at the end.
  const padCut = curve([[0, 420], [p.intro, 1100], [p.lift, 1600], [p.drop1, 2600], [p.build, 2600], [p.drop, 3200], [p.drop + .6, 2800], [p.musicOutro, 2400], [p.finale, 1700], [stop + 1, 1700]]);
  const pad = (t0, t1, notes, amp, attack, release, decay = Infinity) => {
    const hold = t1 - t0, len = hold + release, per = amp / (3 * Math.sqrt(notes.length));
    for (const [v, midi] of notes.entries()) for (let k = -1; k <= 1; k++) {
      const f = hz(midi) * 2 ** (k * 9 / 1200), o = osc(f, 48), lp = svf(sr), phase = (v * .37 + k * .21 + 1) % 1; let n = 0;
      add(tex, t0, len, per, clamp((v % 2 ? .3 : -.3) + k * .32, -1, 1), u => {
        if (n++ % 64 === 0) lp.set(padCut(t0 + u), .7);
        const env = clamp(u / attack) * (u < hold ? 1 : Math.exp(-3 * (u - hold) / release)) * Math.exp(-u / decay) * clamp((len - u) / .01);
        return lp.run(o(phase + f * u)) * env;
      }, padPump);
    }
  };
  // Sub: a sine on the root, pumped by the kick; mono.
  const sub = (t0, len, midi, amp, gain, attack = .01, decay = Infinity) => {
    const f = hz(midi);
    add(low, t0, len, amp, 0, u => tail(u, len, attack, .03) * Math.exp(-u / decay) * (Math.sin(TAU * f * u) + .12 * Math.sin(2 * TAU * f * u)), gain);
  };
  for (const [t0, t1] of segments) {
    const pt = part(t0 + 1e-4), c = chordAt(t0 + 1e-4);
    if (t0 >= p.finale - 1e-6) { pad(t0, stop, c.pad, .3, .06, .01, 2.4); sub(t0, stop - t0, c.root, .24, null, .06, 1.2); continue; }
    pad(t0, t1, c.pad, .26, t0 < 1e-6 ? 1.6 : .3, .5);
    if (pt === 'outro') sub(t0, t1 - t0 + .03, c.root, .17, null, .25);
    else if (pt !== 'intro') sub(t0, t1 - t0 + .03, c.root, .42, subPump);
  }

  // Plucked bass: two saws an octave above the sub, a short filter blip on the offbeat eighths, with sixteenth
  // pickups once the groove is full. It rests in the breath and stops with the kick.
  const bassNote = (t, midi, amp) => {
    const f = hz(midi), a = osc(f, 40), b = osc(f * 1.006, 40), lp = svf(sr), hp = svf(sr).set(90); let n = 0;
    add(bass, t, .2, amp, 0, u => {
      if (n++ % 16 === 0) lp.set(260 + 900 * Math.exp(-u / .04), .9);
      hp.run(lp.run(.5 * (a(f * u) + b(f * 1.006 * u + .4))));
      return hp.hp * tail(u, .2, .003, .02) * Math.exp(-u / .12);
    });
  };
  const full = pt => pt === 'drop1' || pt === 'build' || pt === 'roll' || pt === 'drop';
  for (let s = Math.ceil(p.intro / s16 - 1e-6); s * s16 < Math.min(p.musicOutro, stop) - 1e-6; s++) {
    const t = s * s16, pt = part(t + 1e-4), inBar = s % 16, root = chordAt(t + 1e-4).root + 12;
    if (pt === 'breath') continue;
    if (inBar % 4 === 2) bassNote(t, root, .34);
    else if (full(pt) && inBar % 4 === 3) bassNote(t, root, .17);
  }

  // Sequence: a soft two-saw pluck on the chord's arp notes, eighths at first and sixteenths from the second half of
  // the opening groove; its filter opens with the calendar and rises through the build.
  const seqCut = curve([[0, 520], [p.intro, 700], [p.lift, 1450], [p.drop1, 2200], [p.build, 2200], [p.breath, 3300], [p.drop, 1900], [p.musicOutro, 1500], [p.finale, 900], [stop + 1, 900]]);
  const pluck = (t, midi, amp, cutoff, pan) => {
    const f = hz(midi), a = osc(f, 40), b = osc(f * 1.004, 40), lp = svf(sr); let n = 0;
    add(tex, t, .32, amp, pan, u => {
      if (n++ % 16 === 0) lp.set(cutoff * (1 + 1.8 * Math.exp(-u / .045)), 1.05);
      return lp.run(.5 * (a(f * u) + b(f * 1.004 * u + .25))) * tail(u, .32, .002) * Math.exp(-u / .13);
    }, seqPump);
  };
  const SEQ = { intro: .05, A: .075, lift: .08, drop1: .075, build: .075, roll: .075, breath: .08, drop: .058, outro: .05 };
  for (let s = 0; s * s16 < Math.min(p.finale, stop) - 1e-6; s++) {
    const t = s * s16, pt = part(t + 1e-4), inBar = s % 16;
    if (pt === 'intro' && t < p.intro - bar - 1e-6) continue;
    const eighths = pt === 'intro' || (pt === 'A' && !lateA(t)) || pt === 'outro';
    if (eighths && s % 2) continue;
    const fade = pt === 'outro' ? 1 - .6 * clamp((t - p.musicOutro) / Math.max(.001, p.finale - p.musicOutro)) : 1;
    pluck(t, chordAt(t + 1e-4).arp[PENDULUM[eighths ? inBar / 2 : inBar]], SEQ[pt] * fade * (inBar % 4 === 0 ? 1 : inBar % 2 === 0 ? .8 : .62), seqCut(t), inBar % 2 ? .2 : -.2);
  }

  // Electric piano: two-operator FM with a short tine. It answers the title's three beats, plays the theme an octave
  // down in the second half of the opening groove, and strums the closing chord.
  const keys = (t, midi, len, amp, pan) => {
    const f = hz(midi), tine = 7 * f < .45 * sr ? .1 : 0, ring = len + .6;
    add(tex, t, ring, amp, pan, u => {
      const index = 1.5 * Math.exp(-u / .2) + .3, env = clamp(u / .003) * Math.exp(-u / 1.4) * (u < len ? 1 : Math.exp(-(u - len) / .15)) * clamp((ring - u) / .02);
      return env * (1 + .1 * Math.sin(TAU * 4.6 * u)) * (Math.sin(TAU * f * u + index * Math.sin(TAU * f * u)) + tine * Math.exp(-u / .02) * Math.sin(TAU * 7 * f * u));
    });
  };
  [67, 70, 74].forEach((midi, k) => { const t = (k + 1) * beat * timeScale; if (t < p.intro - .05) keys(t, midi, .5, .1, (k - 1) * .3); });
  {
    const bars = Math.round((p.lift - p.intro) / bar), start = p.intro + (bars >= 8 ? 4 : 0) * bar;
    for (let k = 0; k < 4 && start + k * bar < p.lift - 1e-6; k++) for (const [step, midi, steps] of THEME[k]) keys(start + k * bar + step * s16, midi - 12, steps * s16 * .9, .1, .15);
  }
  if (p.finale < stop) {
    CHORDS.final.pad.slice(1).forEach((midi, k) => keys(p.finale + k * .018, midi, stop - p.finale, .055, k % 2 ? .25 : -.25));
    // Above it, the five lab chime notes roll upward once, softly, from their own stereo positions.
    labVoices(data.labs).sort((a, b) => a.tone - b.tone).forEach((v, k) => keys(p.finale + beat / 2 + k * beat / 4, v.tone, stop - p.finale, .028, v.pan));
  }

  // Lead: one gliding voice (two saws ±5 cents and a sine an octave down) with delayed vibrato. It enters on the
  // reveal and carries the theme to the final note.
  const melody = [], phrase = (t, notes) => { for (const [step, midi, steps] of notes) melody.push({ t: t + step * s16, len: steps * s16 * .92, midi }); };
  for (let t = p.drop, k = 0; t < Math.min(p.musicOutro, stop) - 1e-6; t += bar, k++) phrase(t, THEME[k % 4]);
  for (let t = p.musicOutro; t < Math.min(p.finale, stop) - 1e-6; t += bar) phrase(t, THEME[4]);
  if (p.finale < stop) phrase(p.finale, THEME[5]);
  if (melody.length) {
    const from = melody[0].t, top = hz(Math.max(...melody.map(m => m.midi))) * 1.02, a = osc(top, 64), b = osc(top, 64), lp = svf(sr);
    const glide = 1 - Math.exp(-1 / (.03 * sr)), up = 1 - Math.exp(-1 / (.012 * sr)), down = 1 - Math.exp(-1 / (.06 * sr));
    let k = 0, f = hz(melody[0].midi), g = 0, pa = 0, pb = .37, ps = 0, n = 0;
    add(tex, from, stop - from, .13, 0, u => {
      const t = from + u;
      while (k + 1 < melody.length && melody[k + 1].t <= t) k++;
      const note = melody[k], at = t - note.t, target = at < note.len ? 1 : 0, vib = 1 + .006 * clamp((at - .2) / .3) * Math.sin(TAU * 5.3 * at);
      f += (hz(note.midi) - f) * glide; g += (target - g) * (target > g ? up : down);
      pa += f * vib * 1.0029 / sr; pb += f * vib * .9971 / sr; ps += f * vib * .5 / sr;
      if (n++ % 32 === 0) lp.set(2400 + 1800 * Math.exp(-at / .3), .85);
      return g * (lp.run(.5 * (a(pa) + b(pb))) + .28 * Math.sin(TAU * ps));
    });
  }

  // Drums: a round kick, offbeat hats (open from the lift), sixteenth hats and shaker once the groove is full, clap on
  // two and four. Fills are short snare runs; cymbals and swells mark the calendar's start, the groove and the reveal.
  const kick = (t, amp) => {
    let phase = 0; const click = hiss(Math.round(t * 1e4), 9000, 1800);
    add(low, t, .38, amp, 0, u => {
      phase += (50 + 88 * Math.exp(-u / .028)) / sr;
      const env = clamp(u / .0015) * (u < .03 ? 1 : Math.exp(-(u - .03) / .11)) * clamp((.38 - u) / .03);
      return Math.tanh(1.6 * (Math.sin(TAU * phase) * env + .22 * Math.exp(-u / .004) * click())) / Math.tanh(1.6);
    });
  };
  for (const t of kicks) kick(t, t < p.intro - 1e-6 ? .34 : .56);
  const hat = (t, amp, decay, pan) => { const n = hiss(Math.round(t * 1e4) + 1, 16000, 8500); add(perc, t, Math.min(.5, decay * 6), amp, pan, u => n() * clamp(u / .0008) * Math.exp(-u / decay)); };
  const shaker = (t, amp) => { const n = hiss(Math.round(t * 1e4) + 2, 11000, 4200); add(perc, t, .09, amp, -.35, u => n() * clamp(u / .006) * Math.exp(-u / .028)); };
  const clap = (t, amp) => {
    const n = hiss(Math.round(t * 1e4) + 4, 7000, 900);
    add(perc, t, .3, amp, .1, u => { let e = 0; for (const d of [0, .01, .021]) if (u >= d) e = Math.max(e, Math.exp(-(u - d) / (d === .021 ? .085 : .004))); return n() * e; });
  };
  const snare = (t, amp) => {
    const n = hiss(Math.round(t * 1e4) + 3, 8000, 1000);
    add(perc, t, .16, amp, -.08, u => (n() + .3 * Math.sin(TAU * 190 * u) * Math.exp(-u / .03)) * clamp(u / .001) * Math.exp(-u / .035));
  };
  const crash = (t, amp) => { const n = hiss(700 + Math.round(t * 1000), 14000, 3800); add(perc, t, 1.6, amp, .2, u => tail(u, 1.6, .003, .05) * Math.exp(-u / .45) * n()); };
  for (let s = Math.ceil(p.intro / s16 - 1e-6); s * s16 < Math.min(p.musicOutro, stop) - 1e-6; s++) {
    const t = s * s16, pt = part(t + 1e-4), inBar = s % 16, hush = pt === 'drop' ? .8 : 1;
    if (pt === 'breath') continue;
    if (inBar % 4 === 2) { if (full(pt) || pt === 'lift') hat(t, .3 * hush, .085, .25); else hat(t, .27, .03, .3); }
    else if (full(pt)) hat(t, (inBar % 4 === 0 ? .13 : .17) * hush, .022, .4);
    if (pt !== 'A' || lateA(t)) {
      shaker(t, (inBar % 2 ? .065 : .095) * hush);
      if (inBar === 4 || inBar === 12) { clap(t, .34); if (full(pt)) snare(t, .1); }
    }
  }
  const fill = (to, beats, amp) => { const from = to - beats * beat; for (let t = from; t < to - 1e-6; t += s16) snare(t, amp * (.55 + .45 * (t - from) / (beats * beat))); };
  if (p.drop1 > p.lift) fill(p.drop1, 1, .2);
  if (p.build > p.drop1) fill(p.build, 1, .2);
  if (p.gap > p.build) for (let t = Math.max(p.build, p.gap - bar); t < p.gap - 1e-6; t += beat / 2) snare(t, .06 + .07 * clamp((t - (p.gap - bar)) / bar));
  for (let t = p.gap; t < p.breath - 1e-6; t += s16) snare(t, .14 + .1 * clamp((t - p.gap) / Math.max(.001, p.breath - p.gap)));
  if (p.musicOutro > p.drop && p.musicOutro < p.finale) fill(p.musicOutro, .5, .14);
  for (const t of [p.intro, p.drop1, p.drop]) if (t > 0 && t < Math.min(p.finale, stop)) crash(t, t === p.drop ? .2 : .17);

  const sweep = (from, to, amp, low = 600, high = 9000) => {
    const len = to - from; if (len <= .05 || from < 0) return;
    const n = hiss(Math.round(from * 1000) + 991, 16000, 300), bp = svf(sr); let k = 0;
    add(fx, from, len, amp, 0, u => { const q = clamp(u / len); if (k++ % 32 === 0) bp.set(low * (high / low) ** q, .8); return tail(u, len, .02, .006) * bp.run(n()) * q ** 2.5; });
  };
  sweep(Math.max(0, p.intro - bar), p.intro, .14);
  if (p.drop1 > p.lift) sweep(p.drop1 - bar, p.drop1, .14);
  if (p.drop > p.build) { sweep(p.build, p.drop, .12, 400, 6000); sweep(Math.max(p.build, p.drop - bar), p.drop, .2); }

  // Dotted-eighth ping-pong and eight-line reverb. Their high-pass sends keep the sub mono.
  const echo = bus(), wet = bus(), delay = Math.round(.75 * beat * sr), ehp = svf(sr).set(350), el = svf(sr).set(3700), er = svf(sr).set(3700);
  for (let i = delay; i < length; i++) {
    ehp.run((tex[0][i - delay] + tex[1][i - delay]) / 2);
    echo[0][i] = el.run(ehp.hp + .4 * echo[1][i - delay]); echo[1][i] = er.run(.4 * echo[0][i - delay]);
  }
  {
    const lens = [1031, 1327, 1523, 1777, 1949, 2213, 2459, 2687].map(l => Math.max(1, Math.round(l * sr / 44100))), lines = lens.map(l => new Float32Array(l)), at = new Int32Array(8);
    const g = lens.map(l => 10 ** (-3 * l / sr / 2.2)), damp = Math.exp(-TAU * 4500 / sr), state = new Float64Array(8), y = new Float64Array(8), pre = Math.round(.025 * sr), hl = svf(sr).set(200), hr = svf(sr).set(200);
    for (let i = 0; i < length; i++) {
      const j = i - pre;
      hl.run(j >= 0 ? tex[0][j] + .15 * perc[0][j] + .4 * echo[0][j] : 0); hr.run(j >= 0 ? tex[1][j] + .15 * perc[1][j] + .4 * echo[1][j] : 0);
      let sum = 0; for (let k = 0; k < 8; k++) { y[k] = lines[k][at[k]]; sum += y[k]; }
      for (let k = 0; k < 8; k++) { const v = (y[k] - sum / 4) * g[k]; state[k] = v + damp * (state[k] - v); lines[k][at[k]] = state[k] + (k % 2 ? hr.hp : hl.hp) * .5; if (++at[k] >= lens[k]) at[k] = 0; }
      wet[0][i] = (y[0] - y[2] + y[4] - y[6]) * .35; wet[1][i] = (y[1] - y[3] + y[5] - y[7]) * .35;
    }
  }
  // Mix: launches duck the texture about 10 dB, percussion about 8, the plucked bass about 2.5 and the swells about 4.5;
  // kick and sub stay put. The arc then sets the level.
  // The texture's mid channel is high-passed at 140 Hz and its side at 150 Hz: the bass owns the low end.
  const sideHP = [svf(sr).set(150), svf(sr).set(150)], midHP = svf(sr).set(140, .6), arc = musicArc(p), music = low;
  for (let i = 0; i < length; i++) {
    const t = i / sr, d = duckAt[i], g = 10 ** (arc(t) / 20);
    const l = tex[0][i] + .3 * echo[0][i] + .42 * wet[0][i], r = tex[1][i] + .3 * echo[1][i] + .42 * wet[1][i];
    sideHP[0].run((l - r) / 2); sideHP[1].run(sideHP[0].hp);
    midHP.run((l + r) / 2);
    const mid = midHP.hp, side = sideHP[1].hp;
    for (const ch of [0, 1]) music[ch][i] = g * (low[ch][i] + bass[ch][i] * (1 - .25 * d) + 1.6 * perc[ch][i] * (1 - .6 * d) + fx[ch][i] * (1 - .4 * d) + 3.2 * (mid + (ch ? -side : side)) * (1 - .7 * d));
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
  let tune = 0, effects = 0, both = 0;
  for (let i = 0; i < length; i++) {
    const e = envelope(i / sr) ** 2;
    tune += (music[0][i] ** 2 + music[1][i] ** 2) * e; effects += (sfx[0][i] ** 2 + sfx[1][i] ** 2) * e; both += ((music[0][i] + sfx[0][i]) ** 2 + (music[1][i] + sfx[1][i]) ** 2) * e;
  }
  const knee = Math.sqrt(both / (2 * length)) * 10 ** (13 / 20) || 1;
  const windows = cues.map(c => {
    let m = 0, s = 0;
    for (let i = Math.ceil(c.burst * sr), end = Math.min(length, Math.ceil((c.burst + .08) * sr)); i < end; i++) { m += music[0][i] ** 2 + music[1][i] ** 2; s += sfx[0][i] ** 2 + sfx[1][i] ** 2; }
    return 10 * Math.log10(s / m);
  }).filter(Number.isFinite).sort((a, b) => a - b);
  const kept = stems ? [music, sfx].map(b => b.map(ch => Float32Array.from(ch))) : null;
  const level = new Float32Array(length);
  let power = 0;
  for (let i = 0; i < length; i++) {
    const e = envelope(i / sr);
    for (const ch of [0, 1]) music[ch][i] = knee * Math.tanh((music[ch][i] + sfx[ch][i]) * e / knee);
    level[i] = Math.max(Math.abs(music[0][i]), Math.abs(music[1][i])); power += music[0][i] ** 2 + music[1][i] ** 2;
  }
  // Look-ahead limiter with its ceiling 12 dB above the mix RMS: only the sharpest transients are pulled down
  // (2 ms ramp ahead of the peak, 80 ms release). The level follows the RMS, so one stray peak cannot set it.
  const ceiling = Math.sqrt(power / (2 * length)) * 10 ** (12 / 20), ramp = 1 / Math.round(.002 * sr), release = 1 - Math.exp(-1 / (.08 * sr));
  for (let i = length - 1, next = 1; i >= 0; i--) next = level[i] = Math.min(level[i] > ceiling ? ceiling / level[i] : 1, next + ramp);
  const [left, right] = music, gain = ceiling ? .66 / ceiling : 1;
  let sum = 0, peak = 0;
  for (let i = 0, g = 1; i < length; i++) {
    g = Math.min(level[i], g + (1 - g) * release);
    left[i] *= g * gain; right[i] *= g * gain; sum += left[i] ** 2 + right[i] ** 2; peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  if (kept) for (const b of kept) for (const ch of b) for (let i = 0; i < length; i++) ch[i] *= envelope(i / sr) * gain;
  const metrics = {
    samples: length, duration: length / sr, samplePeakDbfs: peak ? 20 * Math.log10(peak) : -Infinity, rmsDbfs: 10 * Math.log10(sum / (2 * length)), bpm: SCORE.bpm, cueCount: cues.length, introEnd: p.intro, drop: p.drop, kicks: kicks.length,
    sfxToBgmDb: 10 * Math.log10(effects / tune), eventSfxToBgmDb: windows.length ? windows[Math.floor(windows.length / 2)] : null,
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
