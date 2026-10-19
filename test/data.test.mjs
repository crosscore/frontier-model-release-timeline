import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { day, isOfficialSource, loadDataset, launchGroups, joinNames, validateDataset, yearlyStats } from '../src/data.mjs';
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
  ['duplicate lab/date/name', d => { d.releases[1] = {...d.releases[0], id: 'duplicate-date'}; }, /Duplicate lab\/date\/model/],
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
  assert.equal(leap.observedDays, 366); assert.equal(leap.daysPerModel, 183); assert.equal(leap.meanGapDays, 365);
  assert.equal(empty.daysPerModel, null); assert.equal(empty.meanGapDays, null);
  assert.equal(partial.observedDays, 275); assert.equal(partial.daysPerModel, 275); assert.equal(partial.meanGapDays, null); assert(partial.partial);
});
test('same-day launches from different labs count separately and have zero adjacent gap', () => {
  const data = copy(); data.releases = data.releases.filter(e => e.date === '2023-03-14');
  const [stats] = yearlyStats(validateDataset(data));
  assert.equal(stats.count, data.releases.length); assert.equal(stats.meanGapDays, 0); assert.equal(stats.daysPerModel, 365 / data.releases.length);
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

test('different names from one lab on one day validate and count as individual models', () => {
  const d = copy(), first = d.releases[0];
  d.releases.splice(1, 0, { ...first, id: 'another-model', name: 'Another model' });
  validateDataset(d);
  assert.equal(yearlyStats(d)[0].count, yearlyStats(original)[0].count + 1);
});
test('announcement groups keep labs separate, sort scored models first, and preserve ties and unscored JSON order', () => {
  const model = (id, lab, score) => ({ id, lab, date: '2025-05-22', name: id, capability: { score } });
  const releases = [model('missing-a', 'anthropic', null), model('low', 'anthropic', 120), model('high', 'anthropic', 140), model('tie', 'anthropic', 140), model('other', 'openai', 150), model('missing-b', 'anthropic', null)];
  const before = releases.map(e => e.id), groups = launchGroups({ releases });
  assert.equal(groups.length, 2);
  assert.equal(new Set(groups.map(g => g.id)).size, 2);
  assert.deepEqual(groups[0].models.map(e => e.id), ['high', 'tie', 'low', 'missing-a', 'missing-b']);
  assert.deepEqual(groups[1].models.map(e => e.id), ['other']);
  assert.deepEqual(releases.map(e => e.id), before, 'grouping does not reorder JSON');
});
test('joined names remove only common leading words and retain every distinct model suffix', () => {
  for (const [names, expected] of [
    [['Claude Opus 4', 'Claude Sonnet 4'], 'Claude Opus 4 · Sonnet 4'],
    [['GPT-4.1', 'GPT-4.1 mini', 'GPT-4.1 nano'], 'GPT-4.1 · mini · nano'],
    [['GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna'], 'GPT-5.6 Sol · Terra · Luna'],
    [['o3', 'o4-mini'], 'o3 · o4-mini'],
    [['Llama 4 Maverick', 'Llama 4 Scout'], 'Llama 4 Maverick · Scout'],
    [['Gemini 3.6 Flash', 'Gemini 3.5 Flash-Lite'], 'Gemini 3.6 Flash · 3.5 Flash-Lite'],
    [['Muse Wonder', 'Muse Wonder Full'], 'Muse Wonder · Full'],
    [['A B', 'A B'], 'A B · B'],
  ]) assert.equal(joinNames(names), expected);
  assert.equal(joinNames([]), '');
  assert.equal(joinNames([{ name: 'Claude Opus 4', stage: 'preview' }, { name: 'Claude Sonnet 4', stage: 'release' }], true), 'Opus 4 * · Sonnet 4');
});

test('all 26 audited additions preserve the canonical date, name, stage, ECI mapping and URLs', async () => {
  const spec = await readFile(new URL('../docs/reviews/2026-10-20-per-model.md', import.meta.url), 'utf8');
  const rows = spec.split('### 7.2 ')[1].split('### 7.3 ')[0].split('\n').filter(s => /^\| 20\d\d-/.test(s));
  assert.equal(rows.length, 26);
  let scored = 0, unmapped = 0;
  for (const row of rows) {
    const [date, lab, name, stage, mapping, url] = row.slice(1, -1).split('|').map(s => s.trim());
    const event = original.releases.find(e => e.name === name);
    assert(event, name);
    assert.deepEqual([event.date, original.labs.find(l => l.id === event.lab).name, event.name, event.stage, event.sources[0].url], [date, lab, name, stage, url]);
    const extra = name === 'Claude 3.5 Haiku' ? 'https://www.anthropic.com/news/3-5-models-and-computer-use' : name === 'Gemini 1.5 Flash' ? 'https://ai.google.dev/gemini-api/docs/changelog' : null;
    assert.deepEqual(event.sources.map(s => s.url), extra ? [url, extra] : [url]);
    if (mapping === '—') { assert.equal(event.capability, undefined); unmapped++; }
    else { assert.equal(event.capability.model, mapping.replaceAll('`', '')); assert(Number.isFinite(event.capability.score)); scored++; }
  }
  assert.equal(scored, 20); assert.equal(unmapped, 6);
  assert.equal(original.releases.length, 116);
  assert.deepEqual(Object.fromEntries(original.labs.map(l => [l.id, original.releases.filter(e => e.lab === l.id).length])), { openai: 34, anthropic: 29, google: 21, deepseek: 17, meta: 15 });
  for (const name of ['PaLM 2', 'Claude Instant 1.2', 'Gemini 1.5 Flash']) assert.match(original.releases.find(e => e.name === name).note, /to be confirmed/);
});
