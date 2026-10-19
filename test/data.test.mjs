import test from 'node:test';
import assert from 'node:assert/strict';
import { day, isOfficialSource, loadDataset, validateDataset, yearlyStats } from '../src/data.mjs';
import { applyEciScores, parseCsv } from '../src/capability.mjs';
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
  ['same-lab same-date double counting', d => { d.releases[1] = {...d.releases[0], id: 'duplicate-date'}; }, /Group simultaneous/],
  ['unsorted dates', d => { d.releases.reverse(); }, /chronological/],
  ['unverified observation windows', d => { d.verifiedOn = '2020-01-01'; }, /verifiedOn/],
  ['unsupported stage', d => { d.releases[0].stage = 'rumor'; }, /invalid stage/],
  ['non-numeric capability scores', d => { d.releases[1].capability.score = '125.9'; }, /capability.score/],
  ['negative capability scores', d => { d.releases[1].capability.score = -1; }, /capability.score/],
  ['unknown capability fields', d => { d.releases[1].capability.rank = 1; }, /unknown field/],
  ['capability data hosted outside Epoch AI', d => { d.capability.data = 'https://example.com/eci.csv'; }, /epoch.ai/],
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
  const data = copy(); data.releases = data.releases.filter(e => e.date === '2023-03-14');
  const [stats] = yearlyStats(validateDataset(data));
  assert.equal(stats.count, 2); assert.equal(stats.meanGapDays, 0); assert.equal(stats.daysPerLaunch, 182.5);
});
test('all sample events reconcile to annual and lab totals', () => {
  const stats = yearlyStats(original);
  assert.equal(stats.reduce((total, row) => total + row.count, 0), original.releases.length);
  for (const row of stats) assert.equal(Object.values(row.byLab).reduce((a, b) => a + b, 0), row.count);
});

test('ECI refresh copies scores by mapped model name and reports models Epoch has not scored', () => {
  const csv = 'Model,Display name,eci,Organization\nGPT-4 (Mar 2023),GPT-4 (Mar 2023),125.891,OpenAI\n"Gemini 1.0 Pro","Gemini 1.0 Pro",117.05,"Google DeepMind,Google"\nClaude 2,Claude 2,,Anthropic\n';
  assert.equal(parseCsv(csv)[1].Organization, 'Google DeepMind,Google');
  const { data, missing, changed } = applyEciScores(copy(), csv, '2026-10-04');
  const byId = id => data.releases.find(e => e.id === id).capability;
  assert.equal(byId('openai-gpt-4').score, 125.89); assert.equal(byId('google-gemini-1').score, 117.05);
  assert.equal(byId('anthropic-claude-2').score, null); assert(missing.includes('Claude 2'));
  assert(changed.some(c => c.id === 'anthropic-claude-2' && c.to === null));
  assert.equal(data.capability.retrievedOn, '2026-10-04'); assert.equal(data.releases.find(e => e.id === 'anthropic-claude').capability, undefined);
  validateDataset(data);
  assert.throws(() => applyEciScores(copy(), 'name,score\nx,1\n', '2026-10-04'), /Model and eci/);
});

test('shared source hosts require exact lab-owned organization paths', () => {
  for (const [lab, url] of [
    ['deepseek', 'https://github.com/deepseek-ai/DeepSeek-LLM'],
    ['deepseek', 'https://huggingface.co/deepseek-ai/DeepSeek-V3'],
    ['meta', 'https://github.com/meta-llama/llama-models/blob/main/README.md'],
    ['meta', 'https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B'],
  ]) assert(isOfficialSource(lab, url), url);
  for (const url of [
    'https://github.com/other/deepseek-ai/model', 'https://github.com/deepseek-ai-evil/model',
    'https://huggingface.co/deepseek-ai.evil/model', 'https://huggingface.co/deepseek-ai',
    'https://huggingface.co/deepseek-ai/', 'https://huggingface.co/deepseek-ai/../other/model',
    'https://huggingface.co/deepseek-ai/%2e%2e/other/model', 'https://huggingface.co/deepseek-ai/%2fother/model',
    'https://huggingface.co/other/model?path=/deepseek-ai/', 'https://huggingface.co/other/model#/deepseek-ai/',
    'https://huggingface.co.evil/deepseek-ai/model', 'https://user@huggingface.co/deepseek-ai/model',
    'https://huggingface.co:8443/deepseek-ai/model', 'http://huggingface.co/deepseek-ai/model',
  ]) assert(!isOfficialSource('deepseek', url), url);
  assert(!isOfficialSource('meta', 'https://huggingface.co/deepseek-ai/DeepSeek-V3'));
  assert(!isOfficialSource('deepseek', 'https://huggingface.co/meta-llama/Llama-4'));
});

test('five labs validate and a sixth lab fails before rendering', () => {
  assert.equal(original.labs.length, 5); validateDataset(copy());
  const d = copy(); d.labs.push({id:'sixth',name:'Sixth',color:'#ffffff'});
  assert.throws(() => validateDataset(d), /two through five/);
});
