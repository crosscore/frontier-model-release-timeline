import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadDataset } from '../src/data.mjs';
import { makeTimeline } from '../src/timeline.mjs';
import { makeRenderer } from '../src/node-renderer.mjs';
import { captions, previewHtml } from '../src/artifacts.mjs';
const data = await loadDataset(), timeline = makeTimeline(data);

test('both layouts keep text on canvas at every launch and in the intro/summary', () => {
  for (const format of ['landscape', 'portrait']) {
    const renderer = makeRenderer(data, timeline, format), ctx = renderer.canvas.getContext('2d');
    const fillText = ctx.fillText.bind(ctx);
    ctx.fillText = (value, x, y) => {
      const metrics = ctx.measureText(value), width = metrics.width;
      const left = ctx.textAlign === 'right' ? x - width : x;
      assert(left >= 0 && left + width <= renderer.width + 1, `${format}: ${value} overflows horizontally (${left}, ${width})`);
      assert(y <= renderer.height && y - metrics.actualBoundingBoxAscent >= 0, `${format}: ${value} overflows vertically`);
      fillText(value, x, y);
    };
    for (const seconds of [2, ...timeline.onsets.values()].map((t, i) => i ? t + .5 : t).concat(timeline.outroStart + 4)) renderer.frame(seconds);
  }
});
test('frame rendering is deterministic and changes across time', () => {
  const renderer = makeRenderer(data, timeline, 'landscape', 640);
  const hash = time => { renderer.frame(time); return createHash('sha256').update(renderer.canvas.data()).digest('hex'); };
  assert.equal(hash(10), hash(10)); assert.notEqual(hash(10), hash(35));
});
test('VTT uses grouped dates, includes all models and scales to film duration', () => {
  const text = captions(data, timeline, 10);
  assert(text.startsWith('WEBVTT')); assert(text.includes('00:00:10.000'));
  for (const event of data.releases) assert(text.includes(event.name));
  const cueCount = (text.match(/ --> /g) ?? []).length;
  assert.equal(cueCount, new Set(data.releases.map(e => e.date)).size + 2);
});
test('preview source ledger escapes editable text and links every source', () => {
  const modified = structuredClone(data); modified.releases[0].name = '<script>alert(1)</script>';
  const html = previewHtml(modified);
  assert(!html.includes('<script>')); assert(html.includes('&lt;script&gt;'));
  for (const event of data.releases) for (const source of event.sources) assert(html.includes(source.url));
});
