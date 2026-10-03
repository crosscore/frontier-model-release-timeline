import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadDataset, day } from '../src/data.mjs';
import { makeTimeline } from '../src/timeline.mjs';
import { activeFireworks, eventPose, modelLabel, FIREWORK } from '../src/draw.mjs';
import { makeRenderer } from '../src/node-renderer.mjs';
import { captions, previewHtml } from '../src/artifacts.mjs';
const data = await loadDataset(), timeline = makeTimeline(data);

test('both layouts keep text on canvas at every launch and in the intro/summary', () => {
  for (const format of ['landscape', 'portrait']) {
    const renderer = makeRenderer(data, timeline, format), ctx = renderer.canvas.getContext('2d');
    const fillText = ctx.fillText.bind(ctx); let boxes = [];
    ctx.fillText = (value, x, y) => {
      const metrics = ctx.measureText(value), width = metrics.width;
      const left = ctx.textAlign === 'right' ? x - width : x;
      assert(left >= 0 && left + width <= renderer.width + 1, `${format}: ${value} overflows horizontally (${left}, ${width})`);
      assert(y <= renderer.height && y - metrics.actualBoundingBoxAscent >= 0, `${format}: ${value} overflows vertically`);
      const box = { value, x: left, y: y - metrics.actualBoundingBoxAscent, w: width, h: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent };
      for (const other of boxes) {
        const overlapX = Math.min(box.x + box.w, other.x + other.w) - Math.max(box.x, other.x);
        const overlapY = Math.min(box.y + box.h, other.y + other.h) - Math.max(box.y, other.y);
        assert(overlapX <= 1 || overlapY <= 1, `${format}: text collision between ${value} and ${other.value}`);
      }
      boxes.push(box); fillText(value, x, y);
    };
    for (const seconds of [2, ...timeline.onsets.values()].map((t, i) => i ? t + .5 : t).concat(timeline.outroStart + 4)) { boxes = []; renderer.frame(seconds); }
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

test('fireworks keep their full lifetime across the calendar year boundary', () => {
  const event = data.releases.find(e => e.name === 'GPT-5.2');
  const jan = timeline.introSeconds + (day('2026-01-01') - timeline.start) / (timeline.end - timeline.start) * timeline.travelSeconds;
  assert(activeFireworks(data, timeline, jan - .001).includes(event));
  assert(activeFireworks(data, timeline, jan + .001).includes(event));
  assert(activeFireworks(data, timeline, timeline.onsets.get(event.id) + FIREWORK.life - .001).includes(event));
  assert(!activeFireworks(data, timeline, timeline.onsets.get(event.id) + FIREWORK.life + .001).includes(event));
});
test('simultaneous bursts have separate centers and true-date ground origins', () => {
  for (const date of ['2023-03-14', '2026-09-22']) {
    const events = data.releases.filter(e => e.date === date), box = {x:100,y:1154,w:880,radius:218,riseHeight:440};
    const [a,b] = events.map(e => eventPose(data,e,box));
    assert.equal(a.origin,b.origin);
    assert(Math.hypot(a.bx-b.bx,a.by-b.by) > box.radius * .7);
    for (const pose of [a,b]) assert(pose.bx >= box.x + box.radius && pose.bx <= box.x + box.w - box.radius);
  }
});
test('portrait labels preserve numeric Claude family names and preview status', () => {
  assert.equal(modelLabel({name:'Claude 2.1',stage:'release'},true),'Claude 2.1');
  assert.equal(modelLabel({name:'Claude Opus 4.6',stage:'release'},true),'Opus 4.6');
  assert.equal(modelLabel({name:'GPT-4.5',stage:'preview'},true),'GPT-4.5 *');
});
