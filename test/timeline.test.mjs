import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataset, day } from '../src/data.mjs';
import { makeTimeline, stateAt, visibleEvents, calendarPosition } from '../src/timeline.mjs';
const data = await loadDataset(), timeline = makeTimeline(data);
test('every launch becomes visible exactly at its onset, including simultaneous labs', () => {
  for (const event of data.releases) {
    const onset = timeline.onsets.get(event.id);
    assert(!visibleEvents(data, timeline, onset - .00001).includes(event));
    assert(visibleEvents(data, timeline, onset).includes(event));
    assert.equal(stateAt(timeline, onset + .1).day, day(event.date));
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
test('x position uses full calendar years even for partial observation windows', () => {
  assert.equal(calendarPosition('2024-07-02', 2024), .5);
  assert.equal(calendarPosition('2026-01-01', 2026), 0);
  assert.equal(calendarPosition('2027-01-01', 2026), 1);
  assert(calendarPosition('2026-10-02', 2026) < .76);
});
test('one-day datasets and simultaneous launches have a valid timeline', () => {
  const small = structuredClone(data); small.releases = small.releases.slice(0, 2); small.startDate = small.endDate = small.releases[0].date;
  const clock = makeTimeline(small);
  assert.equal(clock.onsets.get(small.releases[0].id), clock.onsets.get(small.releases[1].id));
  assert(Number.isFinite(clock.duration)); assert.equal(stateAt(clock, 3.1).day, day(small.startDate));
});
