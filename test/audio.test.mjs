import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadDataset } from '../src/data.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, kickTimes, makeTimeline } from '../src/timeline.mjs';
import { FIREWORK } from '../src/draw.mjs';
import { CHORDS, SCORE, labVoices, scorePart, soundCues, synthesize, wavBuffer } from '../src/audio.mjs';
import { balance, power } from '../scripts/analyze-audio.mjs';
const data = await loadDataset(), timeline = makeTimeline(data);
const FIVE = ['openai', 'anthropic', 'google', 'deepseek', 'meta'];
const stemsOf = audio => ['bgm', 'sfx'].map(name => ({ left: audio.stems[name][0], right: audio.stems[name][1], sampleRate: audio.sampleRate }));
// A synthetic month with the given launches; only the fields the score reads are filled in.
const fixture = launches => ({ ...data, startDate: '2026-01-01', endDate: '2026-01-31', labs: FIVE.map(id => ({ id, name: id, color: '#FFFFFF' })),
  releases: launches.map(([lab, date], i) => ({ id: `${lab}-${i}`, date, lab, name: `${lab} ${i}`, stage: 'release', sources: [] })) });

test('one sound cue per source event; explosion coincides with its date and visual burst', () => {
  const cues = soundCues(data, timeline);
  assert.equal(cues.length, data.releases.length);
  for (const c of cues) {
    assert.equal(c.burst, timeline.onsets.get(c.id));
    assert(Math.abs(c.burst - c.launch - FIREWORK.rise) < 1e-9);
  }
  const shared = data.releases.find(e => data.releases.some(o => o !== e && o.date === e.date));
  const sameDay = data.releases.filter(e => e.date === shared.date).map(e => cues.find(c => c.id === e.id));
  assert(sameDay.length >= 2);
  for (const c of sameDay) assert.equal(c.burst, sameDay[0].burst);
  assert.equal(new Set(sameDay.map(c => c.pan)).size, sameDay.length);
  assert.equal(new Set(sameDay.map(c => c.tone)).size, sameDay.length);
  for (const c of soundCues(data, timeline, .1)) assert(Math.abs(c.burst - timeline.onsets.get(c.id) * .1) < 1e-9);
});
test('original stereo synthesis is finite, unclipped, reproducible and fades to silence', () => {
  const settings = { duration: 3, sampleRate: 8000 };
  const a = synthesize(data, timeline, settings), b = synthesize(data, timeline, settings), wav = wavBuffer(a);
  assert.equal(a.left.length, 24000); assert.equal(a.right.length, 24000);
  assert.equal(wav.length, 44 + 24000 * 4);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(createHash('sha256').update(wav).digest('hex'), createHash('sha256').update(wavBuffer(b)).digest('hex'));
  let peak = 0, difference = 0, mono = 0;
  for (let i = 0; i < a.left.length; i++) {
    assert(Number.isFinite(a.left[i]) && Number.isFinite(a.right[i]));
    peak = Math.max(peak, Math.abs(a.left[i]), Math.abs(a.right[i]));
    difference += Math.abs(a.left[i] - a.right[i]); mono += ((a.left[i] + a.right[i]) / 2) ** 2;
  }
  assert(peak > .5 && peak < .7); assert(difference > 1); assert(mono > 1);
  assert.equal(Math.abs(a.left[0]), 0); assert(Math.abs(a.left.at(-1)) < .001);
  assert.equal(a.metrics.bpm, SCORE.bpm);
});
test('invalid audio options fail before allocating buffers', () => {
  for (const opts of [{duration: -1}, {sampleRate: 0}, {duration: Infinity}, {timeScale: NaN}]) assert.throws(() => synthesize(data, timeline, opts));
});
test('the drop is the loudest section, builds leave space, and the final hit resolves to silence', () => {
  const sampleRate = 8000, a = synthesize(data, timeline, { sampleRate, stems: true }), p = cuePoints(timeline);
  const rms = (from, to) => { let s = 0; const i0 = Math.round(from * sampleRate), i1 = Math.round(to * sampleRate); for (let i = i0; i < i1; i++) s += a.left[i] ** 2 + a.right[i] ** 2; return 10 * Math.log10(s / (2 * (i1 - i0))); };
  const drop = rms(p.drop, p.drop + BAR_SECONDS), travel = [];
  for (let t = p.intro; t < p.build - 1e-6; t += BAR_SECONDS) travel.push(rms(t, t + BAR_SECONDS));
  assert(drop > Math.max(...travel), 'the drop is the loudest bar');
  assert(rms(p.outro, p.outro + .5) > drop - 3, 'the groove is still running when the summary appears');
  assert(rms(p.finale, p.finale + .3) > rms(p.finale - .3, p.finale), 'the final chord strikes after the high-pass outro');
  assert(rms(timeline.duration - .25, timeline.duration) < drop - 30, 'the final tail reaches silence');
  assert.equal(Math.abs(a.left.at(-1)), 0); assert.equal(Math.abs(a.right.at(-1)), 0);
  const [bgm] = stemsOf(a), level = (from, to = from + BAR_SECONDS) => 10 * Math.log10(power(bgm, from, to));
  const bars = (from, to) => Array.from({ length: Math.round((to - from) / BAR_SECONDS) }, (_, i) => level(from + i * BAR_SECONDS));
  const earlyMax = Math.max(...bars(p.intro, p.lift)), drop1 = bars(p.drop1, p.build), drops = bars(p.drop, p.musicOutro);
  assert(Math.min(...drop1) >= earlyMax + 3, 'each drop1 bar exceeds the loudest A bar by 3 dB');
  assert(Math.min(...drops) >= Math.max(...drop1) + .5, 'each drop bar exceeds drop1 by .5 dB');
  assert(level(p.build) <= Math.min(...drop1) - 2, 'the first build bar steps down at least 2 dB');
  assert(level(p.breath, p.drop) <= Math.min(...drops) - 10, 'the breath steps down at least 10 dB');
  assert.equal(a.metrics.kicks, kickTimes(p).length);
});
test('score sections start on bar lines and follow the film', () => {
  const p = cuePoints(timeline), starts = [];
  for (let t = 0, last = ''; t < timeline.duration; t += BEAT_SECONDS / 4) { const part = scorePart(p, t + 1e-4); if (part !== last) starts.push([part, t]); last = part; }
  assert.deepEqual(starts.map(([part]) => part), ['intro', 'A', 'lift', 'drop1', 'build', 'roll', 'breath', 'drop', 'outro']);
  for (const [part, t] of starts) if (part !== 'breath') assert(Math.abs(t / BAR_SECONDS - Math.round(t / BAR_SECONDS)) < 1e-9, `${part} starts on a bar line`);
  assert.equal(starts.find(([part]) => part === 'drop')[1], p.drop);
});
test('chord voices stay under the chimes and avoid their semitone neighbours', () => {
  for (const chord of CHORDS) for (const tone of chord) {
    assert(tone <= 74);
    assert(![9, 4, 6, 11, 1].includes(tone % 12));
  }
  assert.deepEqual(CHORDS[3], [53, 60, 65, 67, 72], 'F is voiced as Fsus2');
});

test('five labs get distinct, finite pans and pentatonic chime pitches, fixed by lab id', () => {
  const five = FIVE.map(id => ({ id })), voices = labVoices(five);
  assert.equal(new Set(voices.map(v => v.pan)).size, 5);
  assert.equal(new Set(voices.map(v => v.tone)).size, 5);
  assert.equal(new Set(voices.map(v => Math.round(v.hz))).size, 5);
  for (const v of voices) {
    assert(Number.isFinite(v.pan) && Math.abs(v.pan) <= .5, `${v.id} pan`);
    assert(Number.isInteger(v.tone) && v.hz > 700 && v.hz < 1500, `${v.id} chime`);
    assert([7, 10, 0, 2, 5].includes(v.tone % 12), `${v.id} chime is in G minor pentatonic`);
  }
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) assert(Math.abs(voices[a].pan - voices[b].pan) >= .2, 'pans are clearly apart');
  const byId = new Map(voices.map(v => [v.id, v]));
  for (const order of [[...five].reverse(), [five[3], five[0], five[4], five[2], five[1]], five.slice(1, 3), five.slice(3)]) {
    for (const v of labVoices(order)) assert.deepEqual(v, byId.get(v.id), `${v.id} keeps its voice in any order or subset`);
  }
  const unknown = labVoices([{ id: 'meta' }, { id: 'lab-x' }, { id: 'openai' }, { id: 'lab-y' }, { id: 'lab-z' }]);
  assert.equal(new Set(unknown.map(v => v.pan)).size, 5); assert.equal(new Set(unknown.map(v => v.tone)).size, 5);
  assert(unknown.every(v => Number.isFinite(v.pan) && Number.isFinite(v.hz)));
  const real = labVoices(data.labs), cues = soundCues(data, timeline);
  assert.equal(new Set(real.map(v => v.pan)).size, data.labs.length); assert.equal(new Set(real.map(v => v.tone)).size, data.labs.length);
  for (const c of cues) { const v = real.find(x => x.id === c.lab); assert.equal(c.pan, v.pan); assert.equal(c.tone, v.tone); }
});
test('five same-day launches burst together, keep their voices and share loudness', () => {
  const sampleRate = 8000, single = fixture([['openai', '2026-01-15']]), crowd = fixture(FIVE.map(lab => [lab, '2026-01-15']));
  const cues = soundCues(crowd, makeTimeline(crowd));
  assert.equal(new Set(cues.map(c => c.burst)).size, 1);
  assert.equal(new Set(cues.map(c => c.pan)).size, 5); assert.equal(new Set(cues.map(c => c.tone)).size, 5);
  assert(cues.every(c => c.neighbors === 5));
  const level = d => { const a = synthesize(d, makeTimeline(d), { sampleRate, stems: true }), [, sfx] = stemsOf(a), at = a.cues[0].burst; return [a, 10 * Math.log10(power(sfx, at, at + .08))]; };
  const [one, alone] = level(single), [all, together] = level(crowd);
  for (const a of [one, all]) for (const ch of [a.left, a.right]) assert(ch.every(v => Number.isFinite(v) && Math.abs(v) < 1));
  assert(together > alone - 1 && together < alone + 4, `five at once (${together.toFixed(1)} dB) stay near one launch (${alone.toFixed(1)} dB)`);
});
test('launch cues are not quantized: an off-grid burst starts on its own date', () => {
  const sampleRate = 8000, d = fixture([['google', '2026-01-12']]), clock = makeTimeline(d), a = synthesize(d, clock, { sampleRate, stems: true }), [, sfx] = stemsOf(a);
  const at = a.cues[0].burst, sixteenth = BEAT_SECONDS / 4, grid = Math.abs(at / sixteenth - Math.round(at / sixteenth)) * sixteenth;
  assert(grid > .01, 'the fixture date falls between sixteenth notes');
  assert.equal(at, clock.onsets.get(d.releases[0].id));
  const before = power(sfx, at - .01, at), after = power(sfx, at, at + .01);
  assert(10 * Math.log10(after / before) > 12, 'the crack starts at the burst, not on the beat grid');
});
test('stems are kept only on request and add up to the mix at its own gain', () => {
  const settings = { duration: 3, sampleRate: 8000 }, plain = synthesize(data, timeline, settings), split = synthesize(data, timeline, { ...settings, stems: true });
  assert.equal(plain.stems, undefined);
  assert.deepEqual(split.left, plain.left); assert.deepEqual(split.right, plain.right);
  const [bgm, sfx] = stemsOf(split);
  let error = 0, signal = 0;
  for (const [mix, b, s] of [[split.left, bgm.left, sfx.left], [split.right, bgm.right, sfx.right]]) for (let i = 0; i < mix.length; i++) { error += (mix[i] - b[i] - s[i]) ** 2; signal += mix[i] ** 2; }
  assert(10 * Math.log10(error / signal) < -20, 'only the soft clipper and limiter separate the stems from the mix');
});
test('dense launches stay audible over the music without crowding it', () => {
  const a = synthesize(data, timeline, { sampleRate: 8000, stems: true }), [bgm, sfx] = stemsOf(a), r = balance(bgm, sfx, a.cues);
  assert(r.wholeDb.broadband > -26 && r.wholeDb.broadband < -12, `launch cues are a layer, not the lead (${r.wholeDb.broadband} dB)`);
  assert(r.events.presence.median >= 3, `a typical burst is above the music in 500 Hz+ (${r.events.presence.median} dB)`);
  assert(r.events.presence.p10 >= -3, `quiet bursts are not buried (${r.events.presence.p10} dB)`);
  assert(r.audibleShare >= .8, `at least 80 percent of bursts clear the music (${r.audibleShare})`);
  assert(r.sfxBarSpreadDb <= 4, `the densest bar is not much louder than a typical one (${r.sfxBarSpreadDb} dB)`);
  const busiest = r.bars.reduce((x, y) => y.events > x.events ? y : x), sparse = r.bars.filter(b => b.events > 0 && b.events <= 3);
  assert(busiest.events >= 3 * Math.max(...sparse.map(b => b.events)));
  assert(busiest.sfxDbfs - Math.max(...sparse.map(b => b.sfxDbfs)) < 6, 'tripling the launches in a bar does not triple their loudness');
});
