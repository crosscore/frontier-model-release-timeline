import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataset } from '../src/data.mjs';
import { FORMATS, LEDGER_ROWS, ledgerLayout, modelLabel } from '../src/draw.mjs';
import { makeRenderer } from '../src/node-renderer.mjs';
import { makeTimeline } from '../src/timeline.mjs';
const data = await loadDataset();
test('two through five labs have finite ledger geometry and four complete rows per card', () => {
  assert.equal(LEDGER_ROWS, 4);
  for (let n = 2; n <= 5; n++) {
    for (const format of Object.keys(FORMATS)) {
      const d = { ...data, labs: data.labs.slice(0, n) }, columns = ledgerLayout(d, format);
      assert.equal(columns.length, n);
      for (const c of columns) {
        for (const value of [c.x, c.y, c.w, c.first, c.bottom]) assert(Number.isFinite(value), `${format}/${n}: finite layout`);
        assert(c.x >= 0 && c.x + c.w <= FORMATS[format].width);
        const baseline = c.first + 3 * c.m.rowH;
        assert(baseline + (c.m.dateDy ?? 0) + (c.m.date ?? c.m.name) * .25 <= c.bottom, `${format}/${n}: fourth row must be complete`);
      }
    }
  }
});
test('every actual ledger model label fits in full above the minimum readable name size', () => {
  const timeline = makeTimeline(data);
  for (const format of Object.keys(FORMATS)) {
    const ctx = makeRenderer(data, timeline, format).canvas.getContext('2d');
    for (const c of ledgerLayout(data, format)) {
      for (const event of data.releases.filter(e => e.lab === c.lab.id)) {
        ctx.font = `500 ${c.m.score}px Manrope500`;
        const scoreWidth = ctx.measureText('000').width;
        ctx.font = `500 ${c.m.min}px Manrope500`;
        const width = ctx.measureText(modelLabel(event, c.compact)).width;
        const room = c.w - (c.m.nameX ?? 0) - scoreWidth - (c.m.nameX ? 24 : 16);
        assert(width <= room, `${format}: ${event.name} needs a fuller label layout`);
      }
    }
  }
  assert.equal(modelLabel({ name: 'GPT-6 Sol (Oct 2026)', stage: 'release' }, true), 'GPT-6 Sol (Oct)');
});
test('a grouped callout reveals extra-launch counts only after those launches occur', () => {
  const d = structuredClone(data), base = d.releases[0];
  d.startDate = '2026-01-01';
  d.endDate = '2026-10-19';
  d.releases = [
    { ...base, id: 'current', lab: 'openai', date: '2026-01-10', name: 'CURRENT', capability: { model: 'current', score: 130 } },
    ...d.labs.map((lab, i) => ({ ...base, id: `future-${lab.id}`, lab: lab.id, date: '2026-01-11', name: `FUTURE_${lab.id}`, capability: { model: 'future', score: 140 + i } })),
  ];
  const timeline = makeTimeline(d), renderer = makeRenderer(d, timeline), ctx = renderer.canvas.getContext('2d');
  const fillText = ctx.fillText.bind(ctx);
  let labels = [];
  ctx.fillText = (value, x, y) => {
    labels.push(String(value));
    fillText(value, x, y);
  };
  renderer.frame(timeline.onsets.get('current') + .03);
  assert(!labels.some(s => s.includes('FUTURE_') || s.includes('MORE IN THE LISTS')), 'no future names or counts');
  labels = [];
  renderer.frame(timeline.onsets.get('future-openai') + .1);
  assert(labels.some(s => s.includes('MORE IN THE LISTS')), 'a released cluster can use a grouped overflow note');
});
