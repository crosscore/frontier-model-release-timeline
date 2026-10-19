// Audio diagnostics: loudness, band levels, stereo image, per-bar level and the balance between the launch cues
// (SFX) and the music (BGM). Everything here is a measurement; none of it is a listening test.
// Usage: node scripts/analyze-audio.mjs [--data data/releases.json] [--out output/qa] [--fast]
//   --fast skips the temporary master and plots; --compare additionally loads optional historical sketches.
//   Default: the published 30 fps render clock. --logical-clock measures unscaled exact film seconds.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { loadDataset } from '../src/data.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, makeTimeline } from '../src/timeline.mjs';
import { SCORE, labVoices, scorePart, synthesize } from '../src/audio.mjs';
import { loudness, masterSoundtrack } from './audio-master.mjs';
import { options } from './options.mjs';

export const EVENT_WINDOW = .08;
export const BROAD_BANDS = [[20, 120], [120, 500], [500, 2000], [2000, 10000]];
export const PRESENCE = [500, 10000];
export const OCTAVES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const db = power => power > 0 ? 10 * Math.log10(power) : -Infinity;
const fixed = (x, digits = 1) => Number.isFinite(x) ? Number(x.toFixed(digits)) : null;
const label = ([lo, hi]) => `${lo}-${hi}`;
const track = (left, right, sampleRate) => ({ left, right, sampleRate }), mixOf = audio => track(audio.left, audio.right, audio.sampleRate);

// Butterworth sections (4th order per edge). Cascading a high-pass and a low-pass gives power-complementary bands,
// so the band energies add up to roughly the broadband energy.
const BUTTERWORTH4 = [.5412, 1.3066];
function biquad(type, f, q, sampleRate) {
  const w = 2 * Math.PI * f / sampleRate, c = Math.cos(w), a = Math.sin(w) / (2 * q), a0 = 1 + a;
  const b = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: -2 * c / a0, a2: (1 - a) / a0 };
}
function run(x, { b0, b1, b2, a1, a2 }) {
  const y = new Float32Array(x.length);
  for (let i = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
export function bandpass(x, [lo, hi], sampleRate) {
  let y = x;
  if (lo > 0) for (const q of BUTTERWORTH4) y = run(y, biquad('hp', lo, q, sampleRate));
  if (hi < .45 * sampleRate) for (const q of BUTTERWORTH4) y = run(y, biquad('lp', hi, q, sampleRate));
  return y;
}
const split = (t, range) => track(bandpass(t.left, range, t.sampleRate), bandpass(t.right, range, t.sampleRate), t.sampleRate);
// Mean square over both channels, the same definition as the synthesizer's RMS metric.
export function power(t, from = 0, to = t.left.length / t.sampleRate) {
  const i0 = Math.max(0, Math.round(from * t.sampleRate)), i1 = Math.min(t.left.length, Math.round(to * t.sampleRate));
  let s = 0;
  for (let i = i0; i < i1; i++) s += t.left[i] ** 2 + t.right[i] ** 2;
  return i1 > i0 ? s / (2 * (i1 - i0)) : 0;
}
function image(t, from = 0, to = t.left.length / t.sampleRate) {
  let lr = 0, ll = 0, rr = 0, mid = 0, side = 0;
  for (let i = Math.max(0, Math.round(from * t.sampleRate)), end = Math.min(t.left.length, Math.round(to * t.sampleRate)); i < end; i++) {
    const l = t.left[i], r = t.right[i];
    lr += l * r; ll += l * l; rr += r * r; mid += (l + r) ** 2; side += (l - r) ** 2;
  }
  return { correlation: ll && rr ? lr / Math.sqrt(ll * rr) : null, sideToMidDb: db(side / mid) };
}

// ITU-R BS.1770-4 K-weighting, 400 ms momentary and 3 s short-term loudness at 100 ms hops, gated integrated
// loudness and EBU Tech 3342 loudness range. FFmpeg's own meter cross-checks this on the AAC master.
function kWeighting(sampleRate) {
  let K = Math.tan(Math.PI * 1681.974450955533 / sampleRate), Q = .7071752369554196;
  const Vh = 10 ** (3.999843853973347 / 20), Vb = Vh ** .4996667741545416, a0 = 1 + K / Q + K * K;
  const shelf = { b0: (Vh + Vb * K / Q + K * K) / a0, b1: 2 * (K * K - Vh) / a0, b2: (Vh - Vb * K / Q + K * K) / a0, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
  K = Math.tan(Math.PI * 38.13547087602444 / sampleRate); Q = .5003270373238773;
  const d = 1 + K / Q + K * K, highpass = { b0: 1, b1: -2, b2: 1, a1: 2 * (K * K - 1) / d, a2: (1 - K / Q + K * K) / d };
  return x => run(run(x, shelf), highpass);
}
const lufs = z => z > 0 ? -.691 + 10 * Math.log10(z) : -Infinity;
const mean = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const percentile = (sorted, q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))] : null;
export function loudnessOf(t, hop = .1) {
  const k = kWeighting(t.sampleRate), l = k(t.left), r = k(t.right), n = l.length, sr = t.sampleRate, prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + l[i] * l[i] + r[i] * r[i];
  const block = (end, width) => { const i1 = Math.min(n, Math.round(end * sr)), w = Math.round(width * sr), i0 = Math.max(0, i1 - w); return (prefix[i1] - prefix[i0]) / w; };
  const times = []; for (let s = 1; s * hop <= n / sr + 1e-9; s++) times.push(s * hop);
  const gated = (zs, relative) => { const abs = zs.filter(z => lufs(z) > -70), gate = lufs(mean(abs)) + relative; return abs.filter(z => lufs(z) > gate); };
  const momentary = times.filter(x => x >= .4 - 1e-9).map(x => block(x, .4)), shortTerm = times.filter(x => x >= 3 - 1e-9).map(x => block(x, 3));
  const range = gated(shortTerm, -20).map(lufs).sort((a, b) => a - b);
  return {
    integratedLufs: lufs(mean(gated(momentary, -10))), loudnessRangeLu: range.length ? percentile(range, .95) - percentile(range, .1) : 0,
    maxMomentaryLufs: Math.max(...momentary.map(lufs)), maxShortTermLufs: Math.max(...shortTerm.map(lufs)),
    series: times.map(x => ({ t: x, momentary: lufs(block(x, Math.min(.4, x))), shortTerm: lufs(block(x, Math.min(3, x))) })),
  };
}

// Transients per second in the presence band: 10 ms frames rising 6 dB above the previous 30 ms and no more than
// 20 dB under the band's mean level. A proxy for rhythmic clutter in the range the launch cues occupy.
function presenceOnsets(t) {
  const p = split(t, PRESENCE), frame = Math.round(.01 * t.sampleRate), frames = [];
  for (let i = 0; i + frame <= p.left.length; i += frame) { let s = 0; for (let j = i; j < i + frame; j++) s += p.left[j] ** 2 + p.right[j] ** 2; frames.push(s / frame); }
  const floor = db(mean(frames)) - 20;
  let onsets = 0;
  for (let k = 3; k < frames.length; k++) if (db(frames[k]) > floor && db(frames[k]) - db((frames[k - 1] + frames[k - 2] + frames[k - 3]) / 3) > 6) onsets++;
  return onsets / (p.left.length / t.sampleRate);
}

// Beat-synchronous level swing: a band's energy averaged over every beat at 32 phases per beat, from the end of the
// first bar through the penultimate bar, loudest phase minus quietest. A sidechained bass swings widely, a steady one
// little. The kick's own energy in the band counts too, so this is a proxy for the pump, not a measurement of it.
const SWING_BANDS = [[20, 120], [120, 500]];
function beatSwing(t, range) {
  const b = split(t, range), sr = t.sampleRate, bins = new Float64Array(32), counts = new Float64Array(32);
  for (let i = Math.round(BAR_SECONDS * sr), end = Math.round((t.left.length / sr - BAR_SECONDS) * sr); i < end; i++) {
    const k = Math.floor((i / sr / BEAT_SECONDS % 1) * 32); bins[k] += b.left[i] ** 2 + b.right[i] ** 2; counts[k]++;
  }
  const levels = [...bins].map((s, k) => db(s / counts[k]));
  return Math.max(...levels) - Math.min(...levels);
}

// A level, spectrum, image and per-bar profile of one stereo signal.
export function profile(t, { bar = BAR_SECONDS, onsets = true } = {}) {
  const duration = t.left.length / t.sampleRate, total = power(t);
  let peak = 0; for (let i = 0; i < t.left.length; i++) peak = Math.max(peak, Math.abs(t.left[i]), Math.abs(t.right[i]));
  const loud = loudnessOf(t), bars = [], barImage = [];
  for (let k = 0; k * bar < duration - 1e-6; k++) {
    const from = k * bar, to = Math.min(duration, from + bar);
    bars.push(fixed(db(power(t, from, to)), 2)); barImage.push(fixed(image(t, from, to).correlation, 3));
  }
  const bands = BROAD_BANDS.map(range => { const b = split(t, range), p = power(b); return { band: label(range), rmsDbfs: fixed(db(p), 2), shareDb: fixed(db(p / total), 2), ...rounded(image(b)) }; });
  const octaves = OCTAVES.map(c => ({ centreHz: c, rmsDbfs: fixed(db(power(split(t, [c / Math.SQRT2, c * Math.SQRT2]))), 2) }));
  const weights = octaves.map(o => 10 ** ((o.rmsDbfs ?? -200) / 10));
  return {
    durationS: fixed(duration, 3), rmsDbfs: fixed(db(total), 2), samplePeakDbfs: fixed(20 * Math.log10(peak), 2), crestDb: fixed(20 * Math.log10(peak) - db(total), 2),
    integratedLufs: fixed(loud.integratedLufs, 2), loudnessRangeLu: fixed(loud.loudnessRangeLu, 2), maxShortTermLufs: fixed(loud.maxShortTermLufs, 2),
    ...rounded(image(t)), bands, octaves, octaveCentroidHz: Math.round(Math.exp(mean(OCTAVES.map((c, i) => Math.log(c) * weights[i] / mean(weights))))),
    presenceOnsetsPerSecond: onsets ? fixed(presenceOnsets(t), 2) : undefined, beatSwingDb: Object.fromEntries(SWING_BANDS.map(r => [label(r), fixed(beatSwing(t, r), 2)])),
    barRmsDbfs: bars, barCorrelation: barImage, loudnessSeries: loud.series,
  };
}
function rounded({ correlation, sideToMidDb }) { return { correlation: fixed(correlation, 3), sideToMidDb: fixed(sideToMidDb, 2) }; }

const summary = values => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return { count: v.length, min: fixed(v[0], 2), p10: fixed(percentile(v, .1), 2), median: fixed(percentile(v, .5), 2), p90: fixed(percentile(v, .9), 2), max: fixed(v.at(-1), 2) };
};
// Launch cues against the music: whole-track and per-band ratios, per-event windows that start at each burst,
// and per-bar levels. `bgm` and `sfx` must share one gain, as the synthesizer's stems do.
export function balance(bgm, sfx, cues, { window = EVENT_WINDOW, bar = BAR_SECONDS } = {}) {
  const duration = bgm.left.length / bgm.sampleRate, ranges = [['broadband', null], ...BROAD_BANDS.map(r => [label(r), r]), ['presence', PRESENCE]];
  const result = { wholeDb: {}, events: {}, audibleShare: null, bars: [] };
  for (const [name, range] of ranges) {
    const b = range ? split(bgm, range) : bgm, s = range ? split(sfx, range) : sfx;
    result.wholeDb[name] = fixed(db(power(s) / power(b)), 2);
    const ratios = cues.map(c => db(power(s, c.burst, c.burst + window) / power(b, c.burst, c.burst + window)));
    result.events[name] = summary(ratios);
    if (name === 'presence') {
      result.audibleShare = fixed(ratios.filter(r => r >= 0).length / Math.max(1, ratios.length), 3);
      result.models = cues.map((cue, i) => ({ id: cue.id, burst: cue.burst, sfxToBgmDb: fixed(ratios[i], 2) }));
    }
  }
  for (let k = 0; k * bar < duration - 1e-6; k++) {
    const from = k * bar, to = Math.min(duration, from + bar), ps = power(sfx, from, to), pb = power(bgm, from, to);
    result.bars.push({ bar: k + 1, events: cues.filter(c => c.burst >= from && c.burst < to).length, bgmDbfs: fixed(db(pb), 2), sfxDbfs: fixed(db(ps), 2), sfxToBgmDb: fixed(db(ps / pb), 2) });
  }
  const eventful = result.bars.filter(b => b.events > 0).map(b => b.sfxDbfs).sort((a, b) => a - b);
  result.sfxBarSpreadDb = eventful.length ? fixed(eventful.at(-1) - percentile(eventful, .5), 2) : null;
  return result;
}

// The music's arc, from bar RMS: the largest rise from one bar to the next after the first calendar bar, the groove
// against the first four calendar bars, the reveal against the groove, the step into the reveal from the last build
// bar, the breath under the reveal, and the smallest fall from one closing bar to the next.
export function sectionDynamics(bgm, p) {
  const level = (from, to = from + BAR_SECONDS) => db(power(bgm, from, to));
  const bars = (from, to) => Array.from({ length: Math.round((to - from) / BAR_SECONDS) }, (_, k) => level(from + k * BAR_SECONDS));
  const all = bars(0, p.end), at = t => Math.round(t / BAR_SECONDS), first = at(p.intro), closing = all.slice(at(p.musicOutro) - 1);
  const early = bars(p.intro, p.intro + 4 * BAR_SECONDS), groove = bars(p.drop1, p.build), reveal = bars(p.drop, p.musicOutro);
  const earlyMax = Math.max(...early), grooveMin = Math.min(...groove), grooveMax = Math.max(...groove), revealMin = Math.min(...reveal), revealMax = Math.max(...reveal), breath = level(p.breath, p.drop);
  return Object.fromEntries(Object.entries({ earlyMax, grooveMin, grooveMax, revealMin, revealMax, breath,
    largestBarRise: Math.max(...all.slice(first + 1).map((x, k) => x - all[first + k])), grooveAboveEarly: grooveMin - earlyMax,
    revealAboveGroove: revealMax - grooveMax, revealMinBelowGroove: grooveMax - revealMin, riseIntoReveal: reveal[0] - all[at(p.gap) - 1],
    breathBelowReveal: revealMin - breath, smallestClosingFall: Math.min(...closing.slice(1).map((x, k) => closing[k] - x)) }).map(([k, v]) => [k, fixed(v, 2)]));
}
// Limits for the arc above (dB), shared by the tests and this report.
export const ARC = Object.freeze({ largestBarRise: ['≤', 2], grooveAboveEarly: ['≥', 1.5], revealAboveGroove: ['≤', .5], revealMinBelowGroove: ['≤', 3],
  riseIntoReveal: ['≤', 1.5], breathBelowReveal: ['≥', 1], smallestClosingFall: ['≥', 1] });
export const arcFailures = d => Object.entries(ARC).filter(([k, [side, limit]]) => !(side === '≤' ? d[k] <= limit : d[k] >= limit)).map(([k]) => `${k} ${d[k]}`);

export function decode(file, sampleRate = SCORE.sampleRate) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(sampleRate), '-'], { maxBuffer: 1 << 29 });
  if (r.status !== 0) throw new Error(`Could not decode ${file}: ${r.stderr}`);
  const pcm = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.byteLength)), n = pcm.length / 2;
  const left = new Float32Array(n), right = new Float32Array(n);
  for (let i = 0; i < n; i++) { left[i] = pcm[2 * i]; right[i] = pcm[2 * i + 1]; }
  return track(left, right, sampleRate);
}
function floatWav(t) {
  const n = t.left.length, header = Buffer.alloc(44), pcm = new Float32Array(2 * n);
  header.write('RIFF', 0); header.writeUInt32LE(36 + n * 8, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(t.sampleRate, 24); header.writeUInt32LE(t.sampleRate * 8, 28); header.writeUInt16LE(8, 32); header.writeUInt16LE(32, 34); header.write('data', 36); header.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) { pcm[2 * i] = t.left[i]; pcm[2 * i + 1] = t.right[i]; }
  return Buffer.concat([header, Buffer.from(pcm.buffer)]);
}
const scaled = (t, gainDb) => { const g = 10 ** (gainDb / 20); return track(t.left.map(v => v * g), t.right.map(v => v * g), t.sampleRate); };
const stemsOf = audio => ['bgm', 'sfx'].map(name => track(audio.stems[name][0], audio.stems[name][1], audio.sampleRate));

// "Afterburn / 004" as committed in 0bfea69, loaded from Git without a temporary file. It only knew three labs, so
// DeepSeek and Meta get a pan and chord tone; two taps expose its music and cue buses before the mix and its output gain.
export const AFTERBURN = { ref: '0bfea69', title: 'Afterburn / 004' };
async function afterburn(root) {
  let code = execFileSync('git', ['show', `${AFTERBURN.ref}:src/audio.mjs`], { cwd: root, encoding: 'utf8' });
  for (const [from, to] of [
    ["from './draw.mjs'", `from '${new URL('../src/draw.mjs', import.meta.url)}'`],
    ["from './timeline.mjs'", `from '${new URL('../src/timeline.mjs', import.meta.url)}'`],
    ['const PANS = [-.45, .45, 0], TONES = [2, 3, 1];', 'const PANS = [-.45, .45, 0, -.2, .2], TONES = [2, 3, 1, 0, 2];'],
    ['  const level = new Float32Array(length), fade', '  globalThis.__afterburn?.buses(drums, sfx);\n  const level = new Float32Array(length), fade'],
    ['  let sum = 0, peak = 0;', '  globalThis.__afterburn?.gain(gain);\n  let sum = 0, peak = 0;'],
  ]) {
    if (!code.includes(from)) throw new Error(`Unexpected ${AFTERBURN.title} source at ${AFTERBURN.ref}: ${from}`);
    code = code.replace(from, to);
  }
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return (data, timeline, stems = false) => {
    let buses, gain;
    globalThis.__afterburn = { buses: (music, sfx) => { if (stems) buses = [music, sfx].map(b => b.map(c => Float32Array.from(c))); }, gain: g => { gain = g; } };
    try {
      const audio = module.synthesize(data, timeline);
      if (stems) {
        // Same envelope and output gain as its mix stage (the soft clipper is close to unity at these levels).
        const sr = audio.sampleRate, duration = audio.left.length / sr, fade = Math.min(3.2, duration / 4);
        for (const bus of buses) for (const ch of bus) for (let i = 0; i < ch.length; i++) {
          const t = i / sr; ch[i] *= Math.min(1, t / .01) * Math.cos(Math.PI / 2 * Math.max(0, Math.min(1, (t - (duration - fade)) / fade))) ** 2 * gain;
        }
        audio.stems = { bgm: buses[0], sfx: buses[1] };
      }
      return audio;
    } finally { delete globalThis.__afterburn; }
  };
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`FFmpeg failed: ${r.stderr}`);
  return r.stderr;
}
function spectrogram(input, png) {
  ffmpeg(['-loglevel', 'error', '-y', '-i', input, '-lavfi', 'showspectrumpic=s=960x320:legend=1:fscale=log:start=20:stop=16000:color=magma:drange=90', png]);
}
// FFmpeg's ebur128 meter: the loudness curve and its summary. Its LRA follows EBU Tech 3342 like the JavaScript
// meter; loudnorm reports a different LRA estimate for the same file.
function ebur128(input) {
  const log = ffmpeg(['-nostats', '-i', input, '-af', 'ebur128=peak=true', '-f', 'null', '-']), summary = log.slice(log.lastIndexOf('Summary:'));
  const value = re => Number(summary.match(re)?.[1]);
  return {
    series: [...log.matchAll(/t:\s*([\d.]+)\s+TARGET:\S+\s+LUFS\s+M:\s*(-?[\d.]+)\s+S:\s*(-?[\d.]+)/g)].map(m => ({ t: Number(m[1]), momentary: Number(m[2]), shortTerm: Number(m[3]) })),
    integratedLufs: value(/I:\s*(-?[\d.]+) LUFS/), loudnessRangeLu: value(/LRA:\s*(-?[\d.]+) LU/), truePeakDbfs: value(/Peak:\s*(-?[\d.]+) dBFS/),
  };
}
function loudnessSvg(curves, points, { title, from = -40, to = -6 } = {}) {
  const W = 960, H = 360, L = 52, R = 180, T = 30, B = 34, end = points.end, x = t => L + t / end * (W - L - R), y = v => T + (to - Math.max(from, Math.min(to, v))) / (to - from) * (H - T - B);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="sans-serif" font-size="11"><rect width="${W}" height="${H}" fill="#0b1020"/>`, `<text x="${L}" y="18" fill="#e5e9f0" font-size="13">${title}</text>`];
  for (let v = from; v <= to; v += 4) out.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#263348"/><text x="${L - 6}" y="${y(v) + 4}" fill="#8a96aa" text-anchor="end">${v}</text>`);
  for (let k = 0; k * BAR_SECONDS <= end + 1e-6; k++) out.push(`<line x1="${x(k * BAR_SECONDS)}" x2="${x(k * BAR_SECONDS)}" y1="${T}" y2="${H - B}" stroke="#1c2638"/><text x="${x(k * BAR_SECONDS)}" y="${H - B + 14}" fill="#8a96aa" text-anchor="middle">${k + 1}</text>`);
  for (const [name, at] of [['drop', points.drop], ['breath', points.breath], ['build', points.build]]) out.push(`<line x1="${x(at)}" x2="${x(at)}" y1="${T}" y2="${H - B}" stroke="#e5d9b4" stroke-dasharray="3 3"/><text x="${x(at) + 3}" y="${T + 10}" fill="#e5d9b4">${name}</text>`);
  out.push(`<text x="${(W - R + L) / 2}" y="${H - 4}" fill="#8a96aa" text-anchor="middle">bar (128 BPM; LUFS short-term 3 s unless noted)</text>`);
  curves.forEach(({ name, series, color, key = 'shortTerm', dash }, i) => {
    const d = series.filter(s => Number.isFinite(s[key]) && s[key] > from - 20).map((s, j) => `${j ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s[key]).toFixed(1)}`).join('');
    out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${i ? 1.4 : 2.2}"${dash ? ` stroke-dasharray="${dash}"` : ''}/><text x="${W - R + 10}" y="${T + 14 + i * 16}" fill="${color}">${name}</text>`);
  });
  return out.join('\n') + '\n</svg>\n';
}

const SKETCHES = [['Undertow', '1-undertow'], ['Pressure', '2-pressure'], ['Night Shift', '3-night-shift'], ['Low Orbit', '4-low-orbit']];
const COLORS = ['#ffd166', '#9aa5ff', '#ef476f', '#f2779a', '#49cfe8', '#76d3b2', '#ffb547'];
function withoutSeries(p) { const { loudnessSeries, ...rest } = p; return rest; }

async function main() {
  const args = options({ out: { type: 'string', default: 'output/qa' }, fast: { type: 'boolean', default: false }, compare: { type: 'boolean', default: false }, 'logical-clock': { type: 'boolean', default: false } });
  const root = fileURLToPath(new URL('..', import.meta.url)), data = await loadDataset(args.data), timeline = makeTimeline(data);
  const timeScale = args['logical-clock'] ? 1 : (timeline.duration * 30 - 1) / (timeline.duration * 30), points = cuePoints(timeline, timeScale);
  const work = await mkdtemp(join(tmpdir(), 'frontier-audio-')), plots = join(args.out, 'audio-plots'), started = Date.now();
  await mkdir(args.out, { recursive: true });
  const parts = Array.from({ length: Math.ceil(timeline.duration / BAR_SECONDS - 1e-6) }, (_, k) => scorePart(points, k * BAR_SECONDS + 1e-4));
  try {
    const audio = synthesize(data, timeline, { stems: true, timeScale }), [bgm, sfx] = stemsOf(audio), mix = mixOf(audio);
    const report = {
      score: SCORE, generatedOn: new Date().toISOString(), commands: ['node scripts/analyze-audio.mjs'],
      dataset: { path: relative(root, args.data), sha256: createHash('sha256').update(await readFile(args.data)).digest('hex'), models: data.releases.length, labs: data.labs.map(l => l.id), startDate: data.startDate, endDate: data.endDate },
      method: { eventWindowSeconds: EVENT_WINDOW, broadBandsHz: BROAD_BANDS, presenceHz: PRESENCE, octaveCentresHz: OCTAVES, bandFilters: '4th-order Butterworth high-pass and low-pass per edge', loudness: 'ITU-R BS.1770-4 K-weighting in JavaScript; FFmpeg loudnorm (true peak) and ebur128 on AAC masters', barSeconds: BAR_SECONDS, timeScale },
      voices: labVoices(data.labs), cuePoints: points, sections: parts, metrics: audio.metrics,
      current: { mix: profile(mix), bgm: profile(bgm), sfx: profile(sfx, { onsets: false }), balance: balance(bgm, sfx, audio.cues) },
    };
    report.current.dynamics = sectionDynamics(bgm, points);
    const { dynamics, balance: mixBalance } = report.current;
    assert(mixBalance.events.presence.median >= 3, '80 ms presence-band SFX/BGM median >= +3 dB');
    assert(mixBalance.models.length === data.releases.length && mixBalance.models.every(m => m.sfxToBgmDb !== null && m.sfxToBgmDb >= 0), 'every model clears the BGM in 500 Hz–10 kHz');
    assert.deepEqual(arcFailures(dynamics), [], 'BGM arc');
    assert(audio.left.every(Number.isFinite) && audio.right.every(Number.isFinite) && audio.metrics.samplePeakDbfs < 0, 'finite, unclipped PCM');
    assert(audio.left.at(-1) === 0 && audio.right.at(-1) === 0, 'the last PCM frame is silent');
    const curves = [];
    if (!args.fast) {
      await mkdir(plots, { recursive: true });
      const { report: mastered } = await masterSoundtrack(data, timeline, { duration: timeline.duration, timeScale, out: work, format: 'qa' });
      const masterFile = join(work, 'soundtrack-qa.m4a'), master = decode(masterFile), ff = loudness(masterFile);
      const { series, ...meter } = ebur128(masterFile);
      report.current.master = { integratedLufs: Number(ff.input_i), truePeakDbtp: Number(ff.input_tp), loudnessRangeLu: Number(ff.input_lra), ebur128: meter, reported: { integratedLufs: mastered.integratedLufs, truePeakDbtp: mastered.truePeakDbtp, loudnessRangeLu: mastered.loudnessRangeLu }, profile: profile(master) };
      assert(Math.abs(Number(ff.input_i) - SCORE.targetLufs) <= .5 && Number(ff.input_tp) <= SCORE.truePeakDb, 'AAC master loudness and true peak');
      const masterGainDb = report.current.master.profile.integratedLufs - report.current.mix.integratedLufs;
      curves.push({ name: `${SCORE.title} master`, series, color: COLORS[0] });
      spectrogram(masterFile, join(plots, 'spectrogram-007-master.png'));
      for (const [name, stem] of [['bgm', bgm], ['sfx', sfx]]) { const wav = join(work, `${name}.wav`); await writeFile(wav, floatWav(scaled(stem, masterGainDb))); spectrogram(wav, join(plots, `spectrogram-007-${name}.png`)); }

      // Candidates: the BGM-only sketches as rendered, 004 as published (51 events, before the dataset grew), and 004
      // on the current data. For the masking test every candidate's music alone is matched to the new BGM stem's
      // loudness and the new launch cues are laid over it, so only the music differs.
      if (args.compare) {
        const reference = report.current.bgm.integratedLufs, candidates = {}, masking = {};
        const dry = (name, t) => { const m = loudnessOf(t).integratedLufs; masking[name] = balance(scaled(t, reference - m), sfx, audio.cues); };
        for (const [name, file] of SKETCHES) {
          const path = join(root, 'output/bgm-sketches', `${file}.m4a`), t = decode(path), ff = loudness(path);
          candidates[name] = { source: relative(root, path), kind: 'BGM-only sketch (no launch cues)', master: { integratedLufs: Number(ff.input_i), truePeakDbtp: Number(ff.input_tp), loudnessRangeLu: Number(ff.input_lra) }, mix: profile(t) };
          dry(name, t); curves.push({ name, series: ebur128(path).series, color: COLORS[curves.length] }); spectrogram(path, join(plots, `spectrogram-${file}.png`));
        }
        // Read the historical master from the pinned revision: preview/ is replaced by each new render.
        const published = join(work, 'afterburn-004-published.m4a');
        await writeFile(published, execFileSync('git', ['show', `${AFTERBURN.ref}:preview/soundtrack-landscape.m4a`], { cwd: root, maxBuffer: 16 << 20 }));
        const ffp = loudness(published);
        candidates[`${AFTERBURN.title} (published)`] = { source: `git ${AFTERBURN.ref}:preview/soundtrack-landscape.m4a`, kind: 'mastered score and launch cues for the earlier 51-event dataset', master: { integratedLufs: Number(ffp.input_i), truePeakDbtp: Number(ffp.input_tp), loudnessRangeLu: Number(ffp.input_lra) }, mix: profile(decode(published)) };
        curves.push({ name: `${AFTERBURN.title} published`, series: ebur128(published).series, color: COLORS[curves.length], dash: '5 3' });
        spectrogram(published, join(plots, 'spectrogram-004-published.png'));
        const old = await afterburn(root), oldAudio = old(data, timeline, true), [oldBgm, oldSfx] = stemsOf(oldAudio);
        candidates[`${AFTERBURN.title} (current data)`] = { source: `git ${AFTERBURN.ref}:src/audio.mjs with DeepSeek/Meta voices added`, kind: 'pre-master synthesis of 004 on this dataset', mix: profile(mixOf(oldAudio)), bgm: profile(oldBgm), sfx: profile(oldSfx, { onsets: false }), balance: balance(oldBgm, oldSfx, oldAudio.cues) };
        // With no releases there are no bursts, so neither score ducks: the music as composed, before it steps aside.
        const empty = { ...data, releases: [] };
        dry(`${AFTERBURN.title} (music only)`, mixOf(old(empty, timeline)));
        dry(`${SCORE.title} (music only)`, mixOf(synthesize(empty, timeline)));
        report.candidates = candidates; report.masking = masking;
      }
      await writeFile(join(plots, 'loudness.svg'), loudnessSvg(curves, points, { title: 'Short-term loudness of the AAC masters (FFmpeg ebur128)' }));
      const offset = series => series.map(s => ({ ...s, momentary: s.momentary + masterGainDb, shortTerm: s.shortTerm + masterGainDb }));
      await writeFile(join(plots, 'stems-loudness.svg'), loudnessSvg([
        { name: 'mix (momentary)', series: offset(report.current.mix.loudnessSeries), color: COLORS[0], key: 'momentary' },
        { name: 'BGM stem (momentary)', series: offset(report.current.bgm.loudnessSeries), color: COLORS[5], key: 'momentary' },
        { name: 'SFX stem (momentary)', series: offset(report.current.sfx.loudnessSeries), color: COLORS[3], key: 'momentary' },
      ], points, { title: `${SCORE.title}: stems at master gain (BS.1770 momentary 400 ms, JavaScript meter)`, from: -48 }));
    }
    report.elapsedSeconds = fixed((Date.now() - started) / 1000, 1);
    const strip = r => JSON.parse(JSON.stringify(r, (key, value) => key === 'loudnessSeries' ? undefined : value));
    await writeFile(join(args.out, 'audio-metrics.json'), JSON.stringify(strip(report), null, 2) + '\n');
    await writeFile(join(args.out, 'audio-report.md'), markdown(strip(report), args.fast));
    console.log(`Wrote ${relative(root, join(args.out, 'audio-metrics.json'))} and audio-report.md in ${report.elapsedSeconds} s.`);
  } finally { await rm(work, { recursive: true, force: true }); }
}

// ---------- Report ----------
const n = (x, digits = 1, plus = false) => x === null || x === undefined ? '—' : `${plus && x > 0 ? '+' : ''}${Number(x).toFixed(digits)}`.replace('-', '−');
const dB = (x, digits = 1, plus = true) => x === null || x === undefined ? '—' : `${n(x, digits, plus)} dB`;
const row = cells => `| ${cells.join(' | ')} |`;
const table = (head, rows, align) => [row(head), row(align ?? head.map((_, i) => i ? '---:' : '---')), ...rows.map(row)].join('\n');
function markdown(r, fast) {
  const c = r.current, b = c.balance, out = [], bar = k => Math.round(r.cuePoints[k] / r.method.barSeconds);
  const dropBar = bar('drop'), dropRise = bars => bars[dropBar] - Math.max(...bars.slice(bar('intro'), bar('build')));
  const barRange = `${bar('intro') + 1}–${bar('build')}`, old = r.candidates?.[`${AFTERBURN.title} (current data)`];
  out.push(`# Audio QA: ${r.score.title}`, '',
    `Generated by \`node scripts/analyze-audio.mjs${fast ? ' --fast' : ''}\` on ${r.generatedOn.slice(0, 10)} from \`${r.dataset.path}\` (${r.dataset.models} models, ${r.dataset.labs.length} labs, ${r.dataset.startDate} to ${r.dataset.endDate}; SHA-256 \`${r.dataset.sha256.slice(0, 12)}\`). All figures are measurements of synthesized or decoded audio. Nobody listened to these files for this report, and nothing here is a listening approval.`, '');
  if (r.masking) {
    const music = [...SKETCHES.map(([name]) => [name, r.candidates[name].mix, r.masking[name]]), [`${AFTERBURN.title} music (this dataset)`, old.bgm, r.masking[`${AFTERBURN.title} (music only)`]], [`${r.score.title} music`, c.bgm, r.masking[`${r.score.title} (music only)`]]];
    out.push('## Candidates at a glance', '',
      `Music only: the sketches as rendered, and the historical/current BGM stems on this dataset. Beat swing is the loudest minus the quietest point of the band's level averaged over one beat (a pump proxy). The last two columns lay the same new launch cues over each candidate's music at matched loudness, without ducking. Drop rise is bar ${dropBar + 1} against the loudest of bars ${barRange}.`, '',
      table(['Music', '20–120 share', 'Corr. 20–120', 'Beat swing 20–120', 'Beat swing 120–500', '2k–10k share', 'Presence onsets/s', 'Drop rise', 'Bursts: median 500–10k', 'Bursts ≥ 0 dB'],
        music.map(([name, p, m]) => [name, dB(p.bands[0].shareDb, 1, false), n(p.bands[0].correlation, 2), dB(p.beatSwingDb['20-120'], 1, false), dB(p.beatSwingDb['120-500'], 1, false), dB(p.bands[3].shareDb, 1, false), n(p.presenceOnsetsPerSecond, 1), dB(dropRise(p.barRmsDbfs)), dB(m.events.presence.median), `${n(m.audibleShare * 100, 0)} %`])), '');
  }
  out.push('## Launch voices', '', table(['Lab', 'Pan (−1 left … +1 right)', 'Chime', 'Chime Hz'], r.voices.map(v => [v.id, n(v.pan, 2, true), v.note, n(v.hz, 1)])), '');
  if (c.master) out.push('## Temporary master (AAC, FFmpeg)', '', table(['Integrated', 'True peak', 'LRA', 'Target'], [[`${n(c.master.integratedLufs, 2)} LUFS`, `${n(c.master.truePeakDbtp, 2)} dBTP`, `${n(c.master.loudnessRangeLu, 1)} LU`, `${n(r.score.targetLufs, 0)} LUFS / ≤ ${n(r.score.truePeakDb, 1)} dBTP`]]),
    '', `Figures from FFmpeg \`loudnorm\`, as \`npm run verify:media\` measures them. The master is a throwaway written to the system temp directory by \`masterSoundtrack\` and deleted afterwards; the published files are made by \`npm run render\`. FFmpeg \`ebur128\` on the same file: ${n(c.master.ebur128.integratedLufs, 1)} LUFS, LRA ${n(c.master.ebur128.loudnessRangeLu, 1)} LU, true peak ${n(c.master.ebur128.truePeakDbfs, 1)} dBFS. JavaScript BS.1770 meter on the decoded master: ${n(c.master.profile.integratedLufs, 2)} LUFS, LRA ${n(c.master.profile.loudnessRangeLu, 1)} LU. \`loudnorm\` estimates LRA differently from the EBU Tech 3342 meters, hence its larger figure.`, '');
  out.push('## Launch cues against the music', '',
    `Stems come from \`synthesize(..., { stems: true })\`: the music and launch-cue buses just before the soft clipper and limiter, with the fade and output gain they share with the mix. Event windows are the ${r.method.eventWindowSeconds * 1000} ms after each burst; every event counts once, so overlapping windows in dense clusters are counted per event.`, '');
  const ctx = [[r.score.title, b], ...(old ? [[`${AFTERBURN.title} on this dataset`, old.balance]] : [])];
  out.push(table(['Mix', 'Whole track SFX/BGM', 'Event median (broadband)', 'Event p10', 'Event median 500–10k', 'Event p10 500–10k', 'Events ≥ 0 dB in 500–10k', 'Whole 2–10k SFX/BGM', 'Loudest bar SFX − median eventful bar'],
    ctx.map(([name, x]) => [name, dB(x.wholeDb.broadband), dB(x.events.broadband.median), dB(x.events.broadband.p10), dB(x.events.presence.median), dB(x.events.presence.p10), `${n(x.audibleShare * 100, 0)} %`, dB(x.wholeDb['2000-10000']), dB(x.sfxBarSpreadDb, 1, false)])), '');
  out.push('Event-window SFX/BGM by band (median, p10–p90):', '', table(['Mix', ...BROAD_BANDS.map(x => `${label(x)} Hz`)], ctx.map(([name, x]) => [name, ...BROAD_BANDS.map(band => { const e = x.events[label(band)]; return `${n(e.median, 1, true)} (${n(e.p10, 1, true)}…${n(e.p90, 1, true)})`; })])), '');
  if (r.masking) {
    out.push('## Same launch cues over each candidate\'s music', '',
      `Each candidate's music alone (no launch cues, no ducking) is scaled to the new BGM stem's integrated loudness (${n(c.bgm.integratedLufs, 2)} LUFS) and the new launch-cue stem is laid over it unchanged. Higher numbers mean the music leaves more room at the moment of a burst. The new score's own row is its music without the burst ducking, so the ducking's contribution is visible in the comparison with the table above.`, '',
      table(['Music', 'Event median (broadband)', 'Event median 500–10k', 'Event p10 500–10k', 'Events ≥ 0 dB in 500–10k', 'Whole 500–2k SFX/BGM', 'Whole 2–10k SFX/BGM'],
        Object.entries(r.masking).map(([name, x]) => [name, dB(x.events.broadband.median), dB(x.events.presence.median), dB(x.events.presence.p10), `${n(x.audibleShare * 100, 0)} %`, dB(x.wholeDb['500-2000']), dB(x.wholeDb['2000-10000'])])), '');
  }
  const mixes = [[`${r.score.title} ${c.master ? 'AAC master' : 'mix (pre-master)'}`, c.master?.profile ?? c.mix], [`${r.score.title} BGM stem`, c.bgm], ...(old ? [[`${AFTERBURN.title} BGM stem (this dataset)`, old.bgm]] : []), ...Object.entries(r.candidates ?? {}).map(([name, x]) => [name, x.mix])];
  out.push('## Music and mix profiles', '', `Band shares are each band's energy relative to the whole signal. Correlation is +1 for mono and 0 for unrelated channels. Presence onsets count 10 ms frames in 500–10 000 Hz that jump 6 dB over the previous 30 ms. Drop rise is bar ${dropBar + 1} (the drop) against the loudest of bars ${barRange}.`, '',
    table(['Signal', 'LUFS (JS)', 'LRA', 'Crest', '20–120', '120–500', '500–2k', '2k–10k', 'Corr. 20–120', 'Corr. all', 'Centroid', 'Presence onsets/s', 'Beat swing 20–120 / 120–500', 'Drop rise'],
      mixes.map(([name, p]) => [name, n(p.integratedLufs, 1), n(p.loudnessRangeLu, 1), dB(p.crestDb, 1, false), ...p.bands.map(x => dB(x.shareDb, 1, false)), n(p.bands[0].correlation, 2), n(p.correlation, 2), `${p.octaveCentroidHz} Hz`, n(p.presenceOnsetsPerSecond, 1), `${n(p.beatSwingDb['20-120'], 1)} / ${n(p.beatSwingDb['120-500'], 1)} dB`, dB(dropRise(p.barRmsDbfs))])), '');
  out.push('Stereo correlation by band:', '', table(['Signal', ...BROAD_BANDS.map(x => `${label(x)} Hz`), 'Side/mid 20–120'], [[`${r.score.title} mix`, c.mix], ['BGM stem', c.bgm], ['SFX stem', c.sfx], ...(old ? [[`${AFTERBURN.title} mix (this dataset)`, old.mix]] : [])].map(([name, p]) => [name, ...p.bands.map(x => n(x.correlation, 2)), `${n(p.bands[0].sideToMidDb, 1)} dB`])), '');
  out.push('Octave-band RMS (dBFS, pre-master scale for stems):', '', table(['Signal', ...OCTAVES.map(f => f >= 1000 ? `${f / 1000}k` : String(f))], [['mix', c.mix], ['BGM', c.bgm], ['SFX', c.sfx]].map(([name, p]) => [name, ...p.octaves.map(o => n(o.rmsDbfs, 1))])), '');
  out.push('## Per bar', '', 'RMS in dBFS at the pre-master scale; correlation of the mix\'s left and right channels.', '',
    table(['Bar', 'Section', 'Bursts', 'Mix RMS', 'BGM RMS', 'SFX RMS', 'SFX/BGM', 'Mix corr.'], b.bars.map((x, i) => [x.bar, r.sections[i], x.events, n(c.mix.barRmsDbfs[i], 1), n(x.bgmDbfs, 1), n(x.sfxDbfs, 1), dB(x.sfxToBgmDb), n(c.mix.barCorrelation[i], 2)])), '');
  out.push('Arc checks (BGM bar RMS; limits from `ARC`):', '', table(['Measurement', 'dB', 'Limit'], Object.entries(c.dynamics).map(([name, value]) => [name, n(value, 2), ARC[name] ? `${ARC[name][0]} ${n(ARC[name][1], 1)}` : ''])), '');
  if (!fast) out.push('## Plots', '', '- `audio-plots/loudness.svg`: short-term loudness of every AAC master (FFmpeg `ebur128`).', '- `audio-plots/stems-loudness.svg`: momentary loudness of the new mix and its two stems at master gain.', '- `audio-plots/spectrogram-*.png`: FFmpeg `showspectrumpic`, log frequency 20 Hz–16 kHz, 90 dB range.', '');
  out.push('## Method and limits', '',
    '- Bands use 4th-order Butterworth edges (24 dB/octave), so neighbouring bands leak a little; octave bands are not class-1 filters.',
    '- The JavaScript BS.1770 meter is for relative comparisons and stems. Integrated loudness, true peak and LRA of the master come from FFmpeg `loudnorm`, which is what `npm run verify:media` checks.',
    '- Sketch figures are measured on their AAC renders, and 004 (published) on its AAC master for the earlier 51-event dataset. 004 on this dataset is resynthesized from Git commit ' + AFTERBURN.ref + ' with two voices added for DeepSeek and Meta; its stems use the same mix-stage envelope and gain but ignore its soft clipper.',
    '- Ratios measure energy, not perceived loudness or masking thresholds; an 80 ms window favours the crack and body of a burst over its chime and crackle tail.',
    '- Beat swing folds every beat onto one, so it includes the kick\'s own energy in each band; it separates a pumped bass from a steady one only when the kicks are alike.',
    '- None of this establishes how the music sounds. It needs a human listening check on the target devices.', '');
  return out.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
