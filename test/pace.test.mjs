import test from 'node:test';
import assert from 'node:assert/strict';
import { launchesOf, paceAt, pacePeak, PACE_CADENCES, PACE_PER_DAYS, PACE_TAU_DAYS } from '../src/pace.mjs';

const near = (a, b, tolerance = 1e-9) => assert(Math.abs(a - b) <= tolerance, `${a} is not near ${b}`);

test('a launch kicks the pace up on its date and then decays with the time constant; it never looks ahead', () => {
  const launches = [{ day: 100, weight: 1 }], kick = PACE_PER_DAYS / PACE_TAU_DAYS;
  assert.equal(paceAt(launches, 99.999), 0);
  near(paceAt(launches, 100), kick);
  near(paceAt(launches, 100 + PACE_TAU_DAYS), kick / Math.E);
  near(paceAt([{ day: 100, weight: .25 }], 100), kick / 4, 1e-12);
});
test('a steady cadence of one launch every g days averages 365 / g launches per year, where its gridline sits', () => {
  for (const gap of [...PACE_CADENCES.map(c => c.days), 45]) {
    const launches = Array.from({ length: 400 }, (_, k) => ({ day: k * gap, weight: 1 }));
    let sum = 0, n = 0;
    for (let d = 300 * gap; d < 301 * gap; d += gap / 200) { sum += paceAt(launches, d); n++; }
    near(sum / n, PACE_PER_DAYS / gap, .01 * PACE_PER_DAYS / gap);
    const line = PACE_CADENCES.find(c => c.days === gap);
    if (line) near(line.value, PACE_PER_DAYS / gap);
  }
});
test('the peak follows a launch, and same-day launches from different labs both count', () => {
  const events = [{ date: '2024-01-01' }, { date: '2024-01-01' }, { date: '2024-03-01' }], launches = launchesOf(events);
  near(paceAt(launches, launches[0].day), 2 * PACE_PER_DAYS / PACE_TAU_DAYS);
  near(pacePeak(launches), Math.max(...launches.map(l => paceAt(launches, l.day))));
  for (let d = launches[0].day; d < launches[2].day + 90; d += .5) assert(paceAt(launches, d) <= pacePeak(launches) + 1e-12);
  assert.equal(pacePeak([]), 0);
});
