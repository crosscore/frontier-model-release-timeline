import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDataset, launchGroups, joinNames } from '../src/data.mjs';
import { FORMATS, LEDGER_ROWS, ledgerLayout, ledgerName, ledgerEntries, modelLabel, nameLines, tagGroups } from '../src/draw.mjs';
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
test('every announcement name fits in full in both ledgers at the readable minimum size', () => {
  const timeline = makeTimeline(data);
  for (const format of Object.keys(FORMATS)) {
    const ctx = makeRenderer(data, timeline, format).canvas.getContext('2d');
    for (const c of ledgerLayout(data, format)) {
      for (const group of launchGroups(data).filter(e => e.lab === c.lab.id)) {
        ctx.font = `500 ${c.m.score}px Manrope500`;
        const room = c.w - (c.m.nameX ?? 0) - ctx.measureText('000').width - (c.m.nameX ? 24 : 16);
        const full = joinNames(group.models, c.compact), fitted = nameLines(ctx, full, room, c.m.name, c.m.min, 2);
        assert.equal(fitted.lines.join(' '), full, `${format}: ${full} must not be abbreviated`);
        assert(fitted.size >= c.m.min);
        ctx.font = `500 ${fitted.size}px Manrope500`;
        for (const text of fitted.lines) assert(ctx.measureText(text).width <= room + .1);
      }
    }
  }
});
test('actual draw calls include all announcement names and ordered scores in callouts and ledgers', () => {
  const timeline = makeTimeline(data);
  for (const format of Object.keys(FORMATS)) {
    const renderer = makeRenderer(data, timeline, format), ctx = renderer.canvas.getContext('2d'), original = ctx.fillText.bind(ctx);
    let calls = [];
    ctx.fillText = (value, x, y) => { calls.push({ value: String(value), x, y }); original(value, x, y); };
    for (const group of launchGroups(data)) {
      const first = timeline.onsets.get(group.models[0].id), col = ledgerLayout(data, format).find(c => c.lab.id === group.lab);
      calls = [];
      renderer.frame(first + .3);
      const ledgerText = calls.filter(c => c.y > col.y + 15 && c.y <= col.bottom && c.x >= col.x && c.x <= col.x + col.w).map(c => c.value).join(' ');
      assert(ledgerText.includes(joinNames(group.models, col.compact)), `${format}: ledger omits ${joinNames(group.models)}: ${ledgerText}`);
      // A cluster may intentionally overflow whole announcements. Render each real announcement on its
      // own as well, so every constituent model is checked in the actual callout drawing path.
      const isolated = { ...data, releases: group.models }, singleClock = makeTimeline(isolated);
      const single = makeRenderer(isolated, singleClock, format), singleCtx = single.canvas.getContext('2d'), singleFill = singleCtx.fillText.bind(singleCtx);
      calls = [];
      singleCtx.fillText = (value, x, y) => { calls.push({ value: String(value), x, y }); singleFill(value, x, y); };
      single.frame(singleClock.onsets.get(group.models[0].id) + .15);
      const calloutText = calls.filter(c => c.y < (format === 'portrait' ? 890 : 664)).map(c => c.value);
      assert(calloutText.includes(joinNames(group.models)), `${format}: callout omits ${joinNames(group.models)}: ${calloutText.join(' | ')}`);
      const sub = group.models.every(e => !Number.isFinite(e.capability?.score)) ? 'NOT YET SCORED' : `ECI ${group.models.map(e => Number.isFinite(e.capability?.score) ? Math.round(e.capability.score) : '—').join(' · ')}`;
      assert(calloutText.includes(sub), `${format}: score order for ${joinNames(group.models)}`);
    }
  }
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

test('real rows preserve readable single-line fonts and wrap joined models only after a separator', () => {
  const timeline = makeTimeline(data);
  for (const format of Object.keys(FORMATS)) {
    const renderer = makeRenderer(data, timeline, format), ctx = renderer.canvas.getContext('2d'), fill = ctx.fillText.bind(ctx);
    let drawn = [];
    ctx.fillText = (value, x, y) => { drawn.push({ value: String(value), x, y, font: ctx.font }); fill(value, x, y); };
    for (const col of ledgerLayout(data, format)) for (const group of launchGroups(data).filter(g => g.lab === col.lab.id)) {
      const row = ledgerName(ctx, group, col), size = format === 'portrait' ? 32 : 28;
      ctx.font = `500 ${size}px Manrope500`;
      const scoreWidth = (() => { ctx.font = `500 ${col.m.score}px Manrope500`; return ctx.measureText('000').width; })();
      ctx.font = `500 ${size}px Manrope500`;
      if (ctx.measureText(row.name).width <= col.w - scoreWidth - 16) {
        drawn = []; renderer.frame(timeline.onsets.get(group.models[0].id) + .3);
        const call = drawn.find(c => c.value === row.name && c.x === col.x && c.y > col.y + 15);
        assert(call, `${format}: ${row.name} drawn on one line`);
        assert.equal(parseFloat(call.font.split(' ')[1]), size, `${format}: ${row.name} keeps the original font`);
      }
      assert.equal(row.names.lines.join(' '), row.name);
      if (row.names.lines.length === 2 && row.name.includes(' · ')) {
        ctx.font = `500 ${col.m.min}px Manrope500`;
        if (row.name.split(' · ').every(part => ctx.measureText(part).width <= col.w - scoreWidth - 16)) assert(row.names.lines[0].endsWith(' ·'), `${format}: ${row.name} splits between models`);
      }
    }
  }
});
test('every real announcement has 1.4 continuous seconds of complete ink inside its actual column', t => {
  const timeline = makeTimeline(data), groups = launchGroups(data), fps = 60;
  for (const format of Object.keys(FORMATS)) {
    const ctx = makeRenderer(data, timeline, format).canvas.getContext('2d');
    let minimum = Infinity, worst = '';
    for (const col of ledgerLayout(data, format)) {
      const announcements = groups.filter(g => g.lab === col.lab.id), runs = new Map(announcements.map(g => [g, { now: 0, best: 0 }]));
      for (let frame = Math.ceil((timeline.introSeconds + .2) * fps); frame < (timeline.outroStart - .24) * fps; frame++) {
        const time = frame / fps, events = announcements.filter(g => timeline.onsets.get(g.models[0].id) <= time).slice(-6);
        const rows = ledgerEntries(ctx, events, col, timeline, time), full = rows.filter(r => r.complete && r.alpha >= .99).sort((a, b) => a.baseline - b.baseline);
        const ids = new Set(full.map(r => r.event.id));
        for (const group of announcements) {
          const run = runs.get(group); run.now = ids.has(group.id) ? run.now + 1 / fps : 0; run.best = Math.max(run.best, run.now);
        }
        for (let i = 0; i + 1 < full.length; i++) {
          const own = full[i], next = full[i + 1], last = own.baseline + (own.names.lines.length - 1) * own.lineH;
          ctx.font = `500 ${own.names.size}px Manrope500`;
          const bottom = last + ctx.measureText(own.names.lines.at(-1)).actualBoundingBoxDescent, date = own.baseline + own.dateOffset;
          ctx.font = `500 ${col.m.date}px Manrope500`;
          const dateInk = ctx.measureText(own.date);
          assert(date - dateInk.actualBoundingBoxAscent - bottom < next.top - (date + dateInk.actualBoundingBoxDescent),
            `${format}: ${own.name} date is closer to its own last name line`);
          assert(own.bottom < next.top, `${format}: rows do not overlap`);
        }
      }
      for (const [group, run] of runs) {
        assert(run.best >= 1.4, `${format}: ${joinNames(group.models)} completely visible for only ${run.best.toFixed(3)} s`);
        if (run.best < minimum) { minimum = run.best; worst = group.id; }
      }
    }
    t.diagnostic(`${format}: minimum complete, >=99%-opacity dwell ${minimum.toFixed(3)} s (${worst})`);
  }
});
test('real mixed-stage callouts keep per-model stars and fill the glyph unless all models are previews', () => {
  const groups = launchGroups(data), mixed = groups.find(g => g.date === '2024-09-12' && g.lab === 'openai');
  assert(mixed.models.some(m => m.stage === 'release') && mixed.models.some(m => m.stage === 'preview'));
  for (const group of [mixed, groups.find(g => g.date === '2025-02-05' && g.lab === 'google')]) {
    const d = { ...data, releases: group.models }, timeline = makeTimeline(d);
    for (const format of Object.keys(FORMATS)) {
      const renderer = makeRenderer(d, timeline, format), ctx = renderer.canvas.getContext('2d'), fill = ctx.fill.bind(ctx), round = ctx.roundRect.bind(ctx);
      let inPlate = false, fills = [];
      ctx.roundRect = (...args) => { inPlate = true; round(...args); };
      ctx.fill = (...args) => { if (inPlate) fills.push(String(ctx.fillStyle).toLowerCase()); fill(...args); };
      renderer.frame(timeline.onsets.get(group.models[0].id) + .15);
      const allPreview = group.models.every(m => m.stage === 'preview');
      assert.equal(fills[1], allPreview ? '#050a14' : d.labs.find(l => l.id === group.lab).color.toLowerCase());
      assert.equal((joinNames(group.models).match(/ \*/g) ?? []).length, group.models.filter(m => m.stage === 'preview').length);
    }
  }
});
test('the real dense pace shows the 3-day cadence only after substantially exceeding weekly launches', () => {
  const timeline = makeTimeline(data);
  for (const format of Object.keys(FORMATS)) {
    const renderer = makeRenderer(data, timeline, format), ctx = renderer.canvas.getContext('2d'), fill = ctx.fillText.bind(ctx);
    let drawn = [];
    ctx.fillText = (value, x, y) => { drawn.push(String(value)); fill(value, x, y); };
    renderer.frame(timeline.onsets.get(data.releases.find(e => e.date.startsWith('2023-11')).id) + .3);
    assert(!drawn.includes('1 / 3 DAYS'), `${format}: no high-density gridline in the sparse first year`);
    drawn = []; renderer.frame(timeline.outroStart - .4);
    assert(drawn.includes('1 / 3 DAYS') && drawn.includes('122'), `${format}: dense real models expose both the cadence and annualized value`);
  }
});
