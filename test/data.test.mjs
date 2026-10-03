import test from 'node:test';
import assert from 'node:assert/strict';
import { day, loadDataset, validateDataset, yearlyStats } from '../src/data.mjs';
const original = await loadDataset();
const copy = () => structuredClone(original);

test('dates reject normalization, invalid formats and invalid leap days', () => {
  for (const date of ['2023-02-29', '2024-02-30', '2024-13-01', '2024-2-01', '2024-01-01T00:00:00Z']) assert.throws(() => day(date));
  assert.equal(day('2024-03-01') - day('2024-02-28'), 2);
});
for (const [name, mutate, expected] of [
  ['unknown data fields', d => { d.releses = []; }, /unknown field/],
  ['missing citations', d => { d.releases[0].sources = []; }, /missing sources/],
  ['spoofed official domains', d => { d.releases[0].sources[0].url = 'https://anthropic.com.evil.example/news'; }, /official HTTPS/],
  ['cross-lab citations', d => { d.releases[0].sources[0].url = 'https://openai.com/index/gpt-4/'; }, /official HTTPS/],
  ['future entries relative to the frozen window', d => { d.releases.at(-1).date = '2099-01-01'; }, /outside observation/],
  ['duplicate IDs', d => { d.releases[1].id = d.releases[0].id; }, /duplicate ID/],
  ['same-lab same-date double counting', d => { d.releases[1].lab = d.releases[0].lab; }, /Group simultaneous/],
  ['unsorted dates', d => { d.releases.reverse(); }, /chronological/],
  ['unverified observation windows', d => { d.verifiedOn = '2020-01-01'; }, /verifiedOn/],
  ['unsupported stage', d => { d.releases[0].stage = 'rumor'; }, /invalid stage/],
]) test(`validation rejects ${name}`, () => { const data = copy(); mutate(data); assert.throws(() => validateDataset(data), expected); });

test('density and adjacent gaps use different denominators; partial years and leap years are correct', () => {
  const data = copy(); data.startDate = '2024-01-01'; data.endDate = '2026-10-02';
  data.releases = [
    { ...data.releases[0], date: '2024-01-01' },
    { ...data.releases[1], date: '2024-12-31' },
    { ...data.releases[2], date: '2026-10-02' }
  ];
  const [leap, empty, partial] = yearlyStats(data);
  assert.equal(leap.observedDays, 366); assert.equal(leap.daysPerLaunch, 183); assert.equal(leap.meanGapDays, 365);
  assert.equal(empty.daysPerLaunch, null); assert.equal(empty.meanGapDays, null);
  assert.equal(partial.observedDays, 275); assert.equal(partial.daysPerLaunch, 275); assert.equal(partial.meanGapDays, null); assert(partial.partial);
});
test('same-day launches from different labs count separately and have zero adjacent gap', () => {
  const data = copy(); data.releases = data.releases.slice(0, 2);
  const [stats] = yearlyStats(validateDataset(data));
  assert.equal(stats.count, 2); assert.equal(stats.meanGapDays, 0); assert.equal(stats.daysPerLaunch, 182.5);
});
test('all sample events reconcile to annual and lab totals', () => {
  const stats = yearlyStats(original);
  assert.equal(stats.reduce((total, row) => total + row.count, 0), original.releases.length);
  for (const row of stats) assert.equal(Object.values(row.byLab).reduce((a, b) => a + b, 0), row.count);
});
