import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataset, day } from '../src/data.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, kickTimes, makeTimeline, stateAt, visibleEvents } from '../src/timeline.mjs';
const data = await loadDataset(), timeline = makeTimeline(data);
test('every launch becomes visible exactly at its onset, including simultaneous labs', () => {
  for (const event of data.releases) {
    const onset = timeline.onsets.get(event.id);
    assert(!visibleEvents(data, timeline, onset - .00001).includes(event));
    assert(visibleEvents(data, timeline, onset).includes(event));
    assert(Math.abs(stateAt(timeline, onset).day - day(event.date)) < .000001);
    assert(stateAt(timeline, onset + .1).day >= day(event.date));
  }
});
test('calendar never runs backward; start, final hold and ending remain exact', () => {
  let previous = timeline.start;
  for (let i = 0; i <= 1000; i++) { const s = stateAt(timeline, i / 1000 * timeline.duration); assert(s.day >= previous); previous = s.day; }
  assert.equal(stateAt(timeline, -100).mode, 'intro');
  assert.equal(stateAt(timeline, timeline.outroStart - .1).day, day(data.endDate));
  assert.equal(stateAt(timeline, timeline.duration + 100).mode, 'outro');
  assert.equal(visibleEvents(data, timeline, timeline.duration).length, data.releases.length);
});
test('one-day datasets and simultaneous launches have a valid timeline', () => {
  const small = structuredClone(data); small.releases = small.releases.filter(e => e.date === '2023-03-14'); small.startDate = small.endDate = small.releases[0].date;
  const clock = makeTimeline(small);
  assert.equal(clock.onsets.get(small.releases[0].id), clock.onsets.get(small.releases[1].id));
  assert(Number.isFinite(clock.duration)); assert.equal(stateAt(clock, 3.1).day, day(small.startDate));
});

test('equal calendar gaps have equal film durations without release-date pauses', () => {
  const scale = timeline.travelSeconds / (timeline.end - timeline.start);
  for (const event of data.releases) assert(Math.abs(timeline.onsets.get(event.id) - timeline.introSeconds - (day(event.date) - timeline.start) * scale) < 1e-8);
});
test('each name stays among its lab\'s four newest ledger rows for at least 1.4 seconds', () => {
  for (const lab of data.labs) {
    const events = data.releases.filter(e => e.lab === lab.id);
    for (const [i, e] of events.entries()) {
      const end = events[i + 4] ? timeline.onsets.get(events[i + 4].id) : timeline.outroStart;
      assert(end - timeline.onsets.get(e.id) >= 1.4, `${e.name} is replaced too quickly`);
    }
  }
});
test('cue points sit on the bar grid and the kick pattern leaves a breath before the drop', () => {
  const p = cuePoints(timeline), kicks = kickTimes(p), on = t => kicks.some(k => Math.abs(k - t) < 1e-9);
  for (const t of [p.intro, p.lift, p.drop1, p.build, p.gap, p.drop, p.outro, p.finale]) assert(Math.abs(t / BAR_SECONDS - Math.round(t / BAR_SECONDS)) < 1e-9);
  assert(on(p.drop) && on(p.intro) && on(BAR_SECONDS) && !on(0) && !on(BAR_SECONDS + BEAT_SECONDS));
  assert(!kicks.some(t => t >= p.drop1 - 2 * BEAT_SECONDS && t < p.drop1), 'two beats free for the reverse cymbal');
  assert(!kicks.some(t => t > p.finale), 'only the final hit, no later kick');
  assert(on(p.gap + BEAT_SECONDS / 2), 'eighth-note kick roll');
  assert(!kicks.some(k => k >= p.breath - 1e-9 && k < p.drop - 1e-9), 'no kick in the breath');
  const scaled = cuePoints(timeline, 1799 / 1800);
  assert.equal(scaled.drop, p.drop, 'a near-full-length render snaps the drop back onto the beat');
});
test('the default clock is exactly 32 bars, with the specified section and scene boundaries', () => {
  assert.equal(timeline.duration, 60);
  assert.equal(timeline.duration / BAR_SECONDS, 32);
  assert.equal(timeline.duration * 30, 1800);
  assert.deepEqual(cuePoints(timeline), { intro: 3.75, lift: 18.75, drop1: 26.25, build: 41.25, gap: 46.875,
    breath: 47.8125, drop: 48.75, outro: 52.5, musicOutro: 56.25, finale: 58.125, end: 60 });
  for (const scale of [3 / 60, 1 / 60, .5, 1.5]) {
    const p = cuePoints(timeline, scale);
    const order = [p.intro, p.lift, p.drop1, p.build, p.gap, p.breath, p.drop, p.musicOutro, p.finale, p.end];
    assert(order.every((x, i) => Number.isFinite(x) && (i === 0 || x >= order[i - 1])), `compressed/extended clock ${scale}`);
  }
});
