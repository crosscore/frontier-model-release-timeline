import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadDataset } from '../src/data.mjs';
import { makeTimeline } from '../src/timeline.mjs';
import { FIREWORK } from '../src/draw.mjs';
import { SCORE, soundCues, synthesize, wavBuffer } from '../src/audio.mjs';
const data = await loadDataset(), timeline = makeTimeline(data);
test('one sound cue per source event; explosion coincides with its date and visual burst', () => {
  const cues = soundCues(data, timeline);
  assert.equal(cues.length, data.releases.length);
  for (const c of cues) {
    assert.equal(c.burst, timeline.onsets.get(c.id));
    assert(Math.abs(c.burst - c.launch - FIREWORK.rise) < 1e-9);
  }
  const sameDay = data.releases.slice(0, 2).map(e => cues.find(c => c.id === e.id));
  assert.equal(sameDay[0].burst, sameDay[1].burst);
  assert.notEqual(sameDay[0].pan, sameDay[1].pan);
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
  assert.equal(a.left[0], 0); assert(Math.abs(a.left.at(-1)) < .001);
  assert.equal(a.metrics.bpm, SCORE.bpm);
});
test('invalid audio options fail before allocating buffers', () => {
  for (const opts of [{duration: -1}, {sampleRate: 0}, {duration: Infinity}, {timeScale: NaN}]) assert.throws(() => synthesize(data, timeline, opts));
});
