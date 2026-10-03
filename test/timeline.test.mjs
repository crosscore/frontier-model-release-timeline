import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataset, day } from '../src/data.mjs';
import { makeTimeline, stateAt, visibleEvents } from '../src/timeline.mjs';
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
  const small = structuredClone(data); small.releases = small.releases.slice(0, 2); small.startDate = small.endDate = small.releases[0].date;
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
