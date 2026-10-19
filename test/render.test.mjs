import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCanvas } from '@napi-rs/canvas';
import { loadDataset, day, validateDataset } from '../src/data.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, energy, kickTimes, makeTimeline, scorePart } from '../src/timeline.mjs';
import { cameraAt, DIVE_SECONDS, REVEAL_SECONDS } from '../src/camera.mjs';
import { activeFireworks, burstRays, chartBox, chartScale, eventPose, glyph, LAB_STYLES, labStyles, LEDGER_ROWS, ledgerLayout, ledgerRows, lightingAt, modelLabel, reignition, scoreOf, TAG, tagGroups, FIREWORK } from '../src/draw.mjs';
import { makeRenderer } from '../src/node-renderer.mjs';
import { captions, previewHtml } from '../src/artifacts.mjs';
import { labSubset, stressDataset } from '../scripts/visual-fixtures.mjs';
const data = await loadDataset(), timeline = makeTimeline(data);
const stress = validateDataset(stressDataset(data));

// Renders every launch (just after its onset and half a second later), the intro and the summary, asserting that
// all text stays on canvas and no two strings overlap.
function assertTextFits(data, timeline, label = '') {
  for (const format of ['landscape', 'portrait']) {
    const renderer = makeRenderer(data, timeline, format), ctx = renderer.canvas.getContext('2d');
    // Account for rectangular text masks, notably the two moving years inside the odometer window.
    // Coordinates remain in the design space, like the text checks below.
    let clip = null, pendingClip = null; const saved = [];
    const originals = Object.fromEntries(['save', 'restore', 'beginPath', 'rect', 'clip'].map(k => [k, ctx[k].bind(ctx)]));
    const intersect = (a, b) => a ? { left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) } : b;
    ctx.save = () => { saved.push(clip); originals.save(); };
    ctx.restore = () => { clip = saved.pop() ?? null; originals.restore(); };
    ctx.beginPath = () => { pendingClip = null; originals.beginPath(); };
    ctx.rect = (x, y, w, h) => { pendingClip = { left: x, top: y, right: x + w, bottom: y + h }; originals.rect(x, y, w, h); };
    ctx.clip = (...args) => { if (pendingClip) clip = intersect(clip, pendingClip); originals.clip(...args); };
    const fillText = ctx.fillText.bind(ctx); let boxes = [];
    ctx.fillText = (value, x, y) => {
      const metrics = ctx.measureText(value), width = metrics.width;
      const left = ctx.textAlign === 'right' ? x - width : x;
      const bounds = intersect(clip, { left, right: left + width, top: y - metrics.actualBoundingBoxAscent, bottom: y + metrics.actualBoundingBoxDescent });
      if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) { fillText(value, x, y); return; }
      assert(bounds.left >= 0 && bounds.right <= renderer.width + 1, `${label}${format}: ${value} overflows horizontally`);
      assert(bounds.bottom <= renderer.height && bounds.top >= 0, `${label}${format}: ${value} overflows vertically`);
      const box = { value, x: bounds.left, y: bounds.top, w: bounds.right - bounds.left, h: bounds.bottom - bounds.top };
      for (const other of boxes) {
        const overlapX = Math.min(box.x + box.w, other.x + other.w) - Math.max(box.x, other.x);
        const overlapY = Math.min(box.y + box.h, other.y + other.h) - Math.max(box.y, other.y);
        assert(overlapX <= 1 || overlapY <= 1, `${label}${format}: text collision between ${value} and ${other.value}`);
      }
      boxes.push(box); fillText(value, x, y);
    };
    const p = cuePoints(timeline), years = [];
    for (let year = Number(data.startDate.slice(0, 4)) + 1; year <= Number(data.endDate.slice(0, 4)); year++) {
      const jan = timeline.introSeconds + (day(`${year}-01-01`) - timeline.start) / (timeline.end - timeline.start) * timeline.travelSeconds;
      years.push(jan + .03, jan + .15, jan + .29);
    }
    for (const seconds of [0, .05, 1.2, 2, 3.2, ...years, ...[...timeline.onsets.values()].flatMap(t => [t + .05, t + .5]),
      ...Array.from({ length: 17 }, (_, k) => p.outro + k * BEAT_SECONDS)].filter(t => t <= timeline.duration)) { boxes = []; renderer.frame(seconds); }
  }
}
test('both layouts keep text on canvas at every launch and in the intro/summary', () => {
  assertTextFits(data, timeline);
});
test('five long lab names, long model names and a five-lab same-day launch keep all text on canvas and apart', () => {
  const cluster = stress.releases.filter(e => e.id.startsWith('stress-'));
  assert.equal(new Set(cluster.map(e => e.lab)).size, 5); assert.equal(new Set(cluster.map(e => e.date)).size, 1);
  assert(stress.labs.every(lab => lab.name.length >= 30), 'the fixture should stress the column headers');
  assertTextFits(stress, makeTimeline(stress), 'stress ');
});
test('two, three and four labs keep all text on canvas and apart', () => {
  for (const n of [2, 3, 4]) { const subset = validateDataset(labSubset(data, n)); assertTextFits(subset, makeTimeline(subset), `${n} labs `); }
});
// The texts each lab's list draws at a given time, read back from the canvas calls inside its column.
function ledgerTexts(data, timeline, format, seconds) {
  const renderer = makeRenderer(data, timeline, format), ctx = renderer.canvas.getContext('2d'), fillText = ctx.fillText.bind(ctx), drawn = [];
  ctx.fillText = (value, x, y) => { drawn.push({ value, x: ctx.textAlign === 'right' ? x - ctx.measureText(value).width : x, y }); fillText(value, x, y); };
  renderer.frame(seconds);
  return new Map(ledgerLayout(data, format).map(c => [c.lab.id, drawn.filter(d => d.y > c.y + 15 && d.y <= c.bottom && d.x >= c.x - 1 && d.x <= c.x + c.w).map(d => d.value)]));
}
test('every lab lists its four newest names in both layouts, with real labs and with five long names', () => {
  for (const set of [data, stress]) {
    const clock = makeTimeline(set), hold = cuePoints(clock).drop + 1;
    for (const format of ['landscape', 'portrait']) {
      const texts = ledgerTexts(set, clock, format, hold), compact = ledgerLayout(set, format)[0].compact;
      for (const lab of set.labs) {
        const newest = set.releases.filter(e => e.lab === lab.id).slice(-LEDGER_ROWS).map(e => modelLabel(e, compact));
        const names = (t, name) => t === name || (t.endsWith('…') && t.length > 8 && name.startsWith(t.slice(0, -1)));
        const shown = texts.get(lab.id).filter(t => newest.some(name => names(t, name)));
        assert.equal(shown.length, LEDGER_ROWS, `${format}: ${lab.name} lists ${shown.join(', ')}`);
        for (const name of newest) assert(shown.some(t => names(t, name)), `${format}: ${lab.name} does not list ${name}`);
      }
    }
  }
});
test('frame rendering is deterministic and changes across time', () => {
  const renderer = makeRenderer(data, timeline, 'landscape', 640);
  const hash = time => { renderer.frame(time); return createHash('sha256').update(renderer.canvas.data()).digest('hex'); };
  assert.equal(hash(10), hash(10)); assert.notEqual(hash(10), hash(35));
});
test('sound and light share section energy; kicks only change light and the relight sweep makes no new bursts', () => {
  const p = cuePoints(timeline);
  for (let t = 0; t <= timeline.duration; t += BEAT_SECONDS / 4) {
    const light = lightingAt(timeline, t);
    assert.equal(light.part, scorePart(p, t)); assert.equal(light.energy, energy(p, t));
    assert(light.energy >= .2 && light.energy <= 1);
  }
  assert.equal(lightingAt(timeline, p.drop1).kick, 1);
  assert.equal(lightingAt(timeline, p.drop1 + .13).kick, 0);
  assert.equal(lightingAt(timeline, p.intro).kick, 0);
  const sweep = reignition(timeline, p.drop + 1);
  assert.equal(sweep.start, p.drop + REVEAL_SECONDS);
  assert.equal(reignition(timeline, p.drop + 1.5 * BAR_SECONDS).progress, 1);
  assert.equal(activeFireworks(data, timeline, p.drop + FIREWORK.life).length, 0);
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
test('each burst climbs straight up from its date and opens at its ECI score; unscored launches stay on the axis', () => {
  for (const format of ['landscape', 'portrait']) {
    const box = chartBox(format), scale = chartScale(data, box), clipTop = format === 'portrait' ? 250 : 150;
    for (const e of data.releases) {
      const pose = eventPose(data, e, box);
      assert.equal(pose.origin, scale.x(e.date)); assert.equal(pose.bx, pose.origin);
      if (scoreOf(e) === null) { assert.equal(pose.by, box.y); assert(!pose.scored); continue; }
      assert.equal(pose.by, scale.y(scoreOf(e)));
      assert(pose.by - box.radius >= clipTop, `${format}: ${e.name} burst is cut off at the top`);
      assert(pose.bx >= box.x && pose.bx <= box.x + box.w);
    }
    const scored = data.releases.filter(e => scoreOf(e) !== null).sort((a, b) => scoreOf(a) - scoreOf(b));
    for (let i = 1; i < scored.length; i++) assert(eventPose(data, scored[i], box).by <= eventPose(data, scored[i - 1], box).by);
  }
});
test('the date axis spans whole calendar years, so the observation cutoff falls short of its end', () => {
  const box = chartBox('landscape'), scale = chartScale(data, box);
  assert.equal(scale.x('2023-01-01'), box.x); assert.equal(scale.x('2027-01-01'), box.x + box.w);
  assert(Math.abs(scale.x('2025-01-01') - (box.x + box.w * (day('2025-01-01') - day('2023-01-01')) / (day('2027-01-01') - day('2023-01-01')))) < 1e-9);
  assert(scale.x(data.endDate) < box.x + box.w * .95);
});
test('the pace panel shares the chart width: beside it at full height in landscape, under it in portrait', () => {
  const wide = chartBox('landscape'), wp = wide.pace;
  assert(wp.x >= wide.x + wide.w + 100, 'room for the pace axis labels between the panels');
  assert(wp.x + wide.w <= 1920 - 64); assert.equal(wp.top, wide.top); assert.equal(wp.bottom, wide.y);
  const tall = chartBox('portrait'), tp = tall.pace;
  assert.equal(tp.x, tall.x); assert(tp.top > tall.y && tp.bottom - tp.top >= 120);
});
test('the score axis spans every published score and leaves headroom for the highest burst', () => {
  const scores = data.releases.map(scoreOf).filter(v => v !== null), scale = chartScale(data, chartBox('landscape'));
  assert(scores.length >= 40, 'most selected launches should carry an ECI score');
  assert(scale.lo <= Math.min(...scores) - 4 && scale.hi >= Math.max(...scores) + 8);
  assert.equal(scale.lo % 10, 0); assert.equal(scale.hi % 10, 0);
});
test('ledger shows the newest name on top and pushes older rows down smoothly without overlap', () => {
  const clock = { onsets: new Map([['a', 0], ['b', 1], ['c', 1.03], ['d', 3]]) }, events = ['a', 'b', 'c', 'd'].map(id => ({ id }));
  assert.deepEqual(ledgerRows(events, clock, 5).map(r => r.row), [3, 2, 1, 0]);
  let previous = ledgerRows(events.slice(0, 3), clock, 1);
  for (let t = 1.002; t <= 1.6; t += .002) {
    const rows = ledgerRows(events.slice(0, 3), clock, t);
    for (let k = 1; k < rows.length; k++) assert(rows[k - 1].row - rows[k].row >= 1 - 1e-9, `rows overlap at ${t}`);
    for (const [k, r] of rows.entries()) if (r.alpha > 0 && previous[k]?.alpha > 0) assert(Math.abs(r.row - previous[k].row) < .05, `row jumps at ${t}`);
    previous = rows;
  }
  for (const lab of data.labs) {
    const labEvents = data.releases.filter(e => e.lab === lab.id);
    for (const e of labEvents) for (const dt of [0, .03, .1, .2]) {
      const time = timeline.onsets.get(e.id) + dt, rows = ledgerRows(labEvents.filter(x => timeline.onsets.get(x.id) <= time).slice(-6), timeline, time);
      for (let k = 1; k < rows.length; k++) assert(rows[k - 1].row - rows[k].row >= 1 - 1e-9);
    }
  }
});
test('portrait labels preserve numeric Claude family names and preview status', () => {
  assert.equal(modelLabel({name:'Claude 2.1',stage:'release'},true),'Claude 2.1');
  assert.equal(modelLabel({name:'Claude Opus 4.6',stage:'release'},true),'Opus 4.6');
  assert.equal(modelLabel({name:'GPT-4.5',stage:'preview'},true),'GPT-4.5 *');
  assert.equal(modelLabel({name:'Claude 3.5 Sonnet',stage:'release'},true),'3.5 Sonnet');
  assert.equal(modelLabel({name:'DeepSeek V3.2',stage:'release'},true),'V3.2');
  assert.equal(modelLabel({name:'DeepSeek LLM',stage:'release'},true),'DeepSeek LLM');
  assert.equal(modelLabel({name:'GPT-6 Sol (Oct 2026)',stage:'release'},true),'GPT-6 Sol (Oct)');
  assert.equal(modelLabel({name:'GPT-6 Sol (Oct 2026)',stage:'release'}),'GPT-6 Sol (Oct 2026)', 'full names elsewhere');
});
test('five labs get five distinct marker shapes and burst forms, tied to lab identity rather than order', () => {
  const styles = labStyles(data.labs);
  assert.equal(data.labs.length, 5);
  assert.equal(new Set(data.labs.map(lab => styles.get(lab.id).shape)).size, 5);
  assert.equal(new Set(data.labs.map(lab => styles.get(lab.id).form)).size, 5);
  for (const labs of [[...data.labs].reverse(), data.labs.slice(3), data.labs.slice(1, 3)]) {
    const other = labStyles(labs);
    for (const lab of labs) assert.equal(other.get(lab.id), styles.get(lab.id), `${lab.id} keeps its style`);
  }
  const guests = labStyles([{ id: 'guest-a' }, { id: 'openai' }, { id: 'guest-b' }]);
  assert.equal(guests.get('openai'), styles.get('openai'));
  assert.equal(new Set(guests.values()).size, 3, 'unknown labs take unused styles');
  const silhouette = shape => {
    const canvas = createCanvas(64, 64), ctx = canvas.getContext('2d');
    glyph(ctx, shape, 32, 32, 16, '#ffffff');
    return [...ctx.getImageData(0, 0, 64, 64).data].filter((_, k) => k % 4 === 3).map(a => a > 127);
  };
  const masks = LAB_STYLES.map(({ shape }) => silhouette(shape));
  for (const mask of masks) assert(mask.filter(Boolean).length > 400, 'each marker is a solid, visible shape');
  for (let i = 0; i < masks.length; i++) for (let j = i + 1; j < masks.length; j++) {
    const differ = masks[i].filter((v, k) => v !== masks[j][k]).length, union = masks[i].filter((v, k) => v || masks[j][k]).length;
    assert(differ > .1 * union, `${LAB_STYLES[i].shape} and ${LAB_STYLES[j].shape} markers look alike (${differ} of ${union} px differ)`);
  }
});
test('burst forms differ in arrangement but share ray count, reach and lifetime', () => {
  const rays = Object.fromEntries(LAB_STYLES.map(({ form }) => [form, burstRays(form, 1234)]));
  for (const [form, list] of Object.entries(rays)) {
    assert.equal(list.length, FIREWORK.rays, form);
    assert(list.every(r => r.speed > 0 && r.tail > 0 && Number.isFinite(r.angle)), form);
    const reach = Math.max(...list.map(r => r.speed));
    assert(reach > .95 && reach <= 1, `${form} reaches the common burst radius (${reach})`);
  }
  const mean = (list, f) => list.reduce((sum, r) => sum + f(r), 0) / list.length;
  const turns = list => list.map(r => (r.angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
  const widestGap = list => { const a = turns(list); return Math.max(...a.map((v, k) => (a[k + 1] ?? a[0] + 2 * Math.PI) - v)); };
  assert(widestGap(rays.peony) < .3 && Math.min(...rays.peony.map(r => r.speed)) > .7, 'peony is one full, even shell');
  assert(mean(rays.glitter, r => r.tail) > 1.4 * mean(rays.peony, r => r.tail), 'glitter trails are longer than peony trails');
  const ring = rays['double ring'].map(r => r.speed);
  assert(ring.every(v => v < .6 || v > .9) && ring.filter(v => v < .6).length >= 25 && ring.filter(v => v > .9).length >= 25, 'double ring has two separate shells');
  assert(rays.fan.every(r => Math.sin(r.angle) < -.2), 'fan opens upward only');
  const onAxis = r => { const a = turns([r])[0] % (Math.PI / 2); return Math.min(a, Math.PI / 2 - a) < .1; };
  const star = rays['four-point star'], arms = star.filter(onAxis), core = star.filter(r => !onAxis(r));
  assert(arms.length >= star.length / 2 && Math.max(...core.map(r => r.speed)) < .4, 'four-point star: long arms around a short core');
  for (const form of Object.keys(rays)) assert.deepEqual(burstRays(form, 1234), rays[form], `${form} rays are deterministic`);
});
test('name tags stay up for at least the merge window and never name more than three launches', () => {
  for (const set of [data, stress]) {
    const clock = makeTimeline(set), groups = tagGroups(set, clock);
    assert.equal(groups.reduce((n, g) => n + g.events.length, 0), set.releases.length, 'every launch is in one tag');
    for (const [i, g] of groups.entries()) {
      assert(g.end - g.start >= TAG.merge - 1e-9, `tag at ${g.start.toFixed(2)} s lasts ${(g.end - g.start).toFixed(3)} s`);
      assert(g.end - g.start <= TAG.life + 1e-9 && (groups[i + 1]?.start ?? Infinity) >= g.end);
      for (const { onset } of g.events) assert(onset >= g.start && onset - g.start <= TAG.merge + 1e-9);
    }
    const cluster = groups.find(g => g.events.some(({ event }) => event.id.startsWith('stress-')));
    if (set === stress) assert(cluster.events.length >= 5 && cluster.end - cluster.start >= .4, 'the same-day cluster gets its own tag');
  }
});
// Renders frames at native size and returns each frame's drawing calls in order: every text with its box, every
// plate (rounded rectangle), and every fill and stroke with its style and whether it is drawn under the camera.
function drawLog(data, timeline, format) {
  const renderer = makeRenderer(data, timeline, format), ctx = renderer.canvas.getContext('2d');
  const [fillText, roundRect, fill, stroke] = ['fillText', 'roundRect', 'fill', 'stroke'].map(name => ctx[name].bind(ctx));
  const world = () => ctx.getTransform().a !== 1;
  let log = [];
  ctx.fillText = (value, x, y) => {
    const m = ctx.measureText(value), left = ctx.textAlign === 'right' ? x - m.width : x;
    log.push({ op: 'text', value: String(value), x: left, y: y - m.actualBoundingBoxAscent, w: m.width, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent });
    fillText(value, x, y);
  };
  ctx.roundRect = (x, y, w, h, radius) => {
    log.push({ op: 'plate', x, y, w, h });
    roundRect(x, y, w, h, radius);
  };
  ctx.fill = (...args) => {
    log.push({ op: 'fill', style: String(ctx.fillStyle), world: world() });
    fill(...args);
  };
  ctx.stroke = (...args) => {
    log.push({ op: 'stroke', style: String(ctx.strokeStyle), width: ctx.lineWidth, world: world() });
    stroke(...args);
  };
  return { renderer, frame: seconds => { log = []; renderer.frame(seconds); return log; } };
}
// The plate of the tag in a logged frame, the tag's own texts (drawn after it, inside the plot) and everything else.
function tagPlate(log, box) {
  const plates = log.filter(o => o.op === 'plate'), k = log.indexOf(plates[0]);
  const texts = log.slice(k).filter(o => o.op === 'text' && o.y >= box.top - 20 && o.y + o.h <= box.y);
  return { plates, plate: plates[0], k, texts };
}
test('every name tag sits on one dark plate edged in its lab colour, drawn over the bursts and step lines', () => {
  const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1;
  for (const set of [data, stress]) {
    const clock = makeTimeline(set);
    for (const format of ['landscape', 'portrait']) {
      const box = chartBox(format), { frame } = drawLog(set, clock, format);
      for (const g of tagGroups(set, clock)) {
        const time = g.start + .15, log = frame(time), at = `${set === stress ? 'stress ' : ''}${format} ${time.toFixed(2)} s`;
        const { plates, plate, k, texts } = tagPlate(log, box);
        assert.equal(plates.length, 1, `${at}: one plate per tag group`);
        const fill = log.slice(k).find(o => o.op === 'fill'), edge = log.slice(k).find(o => o.op === 'stroke');
        const opacity = /^#050a14([0-9a-f]{2})$/i.exec(fill.style);
        assert(opacity && parseInt(opacity[1], 16) / 255 >= .8, `${at}: plate fill ${fill.style}`);
        const lab = set.labs.find(l => l.id === g.events[0].event.lab);
        assert(edge.style.toLowerCase().startsWith(lab.color.toLowerCase()) && edge.width <= 2, `${at}: plate edge ${edge.style} / ${edge.width}`);
        // Render order: step lines, markers and bursts come first, then the plate, then the tag's text.
        assert(log.slice(0, k).some(o => o.world), `${at}: the plot is drawn before the tag`);
        assert(!log.slice(k).some(o => o.world), `${at}: something in the plot is drawn over the tag`);
        assert(texts.length >= 2, `${at}: tag text follows its plate`);
        for (const o of texts) {
          const inside = o.x >= plate.x + 6 && o.x + o.w <= plate.x + plate.w - 6 && o.y >= plate.y + 4 && o.y + o.h <= plate.y + plate.h - 4;
          assert(inside, `${at}: ${o.value} is not inside its plate`);
        }
        for (const o of log.slice(0, k)) if (o.op === 'text') assert(!overlap(o, plate), `${at}: the plate hides ${o.value}`);
      }
    }
  }
});
test('the plate dims the bursts and step lines under a tag at the reviewed dense moments', () => {
  const luma = (px, k) => (.2126 * px[k] + .7152 * px[k + 1] + .0722 * px[k + 2]) / 255;
  const groupOf = (set, clock, id) => tagGroups(set, clock).find(g => g.events.some(({ event }) => event.id === id));
  const drop = cuePoints(timeline).drop, moments = [];
  const sonnet = groupOf(data, timeline, data.releases.find(e => e.date === '2025-09-29').id);
  moments.push([data, timeline, sonnet.start + .12, 'the 2025-09-29 cluster']);
  moments.push([data, timeline, drop - .01, 'the tag just before the drop']);
  const stressClock = makeTimeline(stress);
  moments.push([stress, stressClock, groupOf(stress, stressClock, 'stress-openai').start + .15, 'the five-lab stress cluster']);
  for (const [set, clock, time, name] of moments) {
    for (const format of ['landscape', 'portrait']) {
      const box = chartBox(format), at = `${format} ${name} (${time.toFixed(2)} s)`, logged = drawLog(set, clock, format);
      const { plates, plate, texts } = tagPlate(logged.frame(time), box);
      assert.equal(plates.length, 1, `${at}: a tag is up`);
      const bare = makeRenderer(set, clock, format);
      bare.canvas.getContext('2d').roundRect = () => {};
      bare.frame(time);
      const shown = logged.renderer.canvas.data(), under = bare.canvas.data(), width = logged.renderer.width;
      // The padding above and below the text, clear of the plate's edge and rounded corners.
      const top = Math.min(...texts.map(o => o.y)), bottom = Math.max(...texts.map(o => o.y + o.h));
      const bands = [[plate.y + 3, top - 3], [bottom + 3, plate.y + plate.h - 3]];
      let brightest = 0;
      for (const [y0, y1] of bands) {
        for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
          for (let x = Math.ceil(plate.x + 10); x <= Math.floor(plate.x + plate.w - 10); x++) {
            const k = (y * width + x) * 4;
            brightest = Math.max(brightest, luma(under, k));
            assert(luma(shown, k) <= .2 * luma(under, k) + .05, `${at}: pixel (${x}, ${y}) is not dimmed by the plate`);
          }
        }
      }
      assert(brightest > .25, `${at}: expected bursts or step lines under the plate (brightest ${brightest.toFixed(2)})`);
    }
  }
});
test('the camera keeps every burst in the plot while it tracks, then reveals the whole chart after the drop', () => {
  const p = cuePoints(timeline);
  for (const format of ['landscape', 'portrait']) {
    const box = chartBox(format);
    for (const e of data.releases) for (const dt of [0, .35]) {
      const t = timeline.onsets.get(e.id) + dt, cam = cameraAt(data, timeline, format, t), pose = eventPose(data, e, box), at = cam.toScreen(pose.bx, pose.by);
      assert(at.x >= box.x && at.x <= box.x + box.w, `${format}: ${e.name} leaves the plot horizontally`);
      if (pose.scored) assert(at.y >= box.top - 40 && at.y <= box.y, `${format}: ${e.name} leaves the plot vertically`);
    }
    const tracking = cameraAt(data, timeline, format, p.intro + DIVE_SECONDS + .5);
    assert(tracking.s > 1.5, `${format}: the camera dives in after the intro`);
    const wide = cameraAt(data, timeline, format, p.drop + REVEAL_SECONDS + .4);
    assert(wide.s >= 1 && wide.s < 1.05, `${format}: the drop reveals the whole chart`);
    assert(Math.abs(wide.toScreen(box.x, box.y).x - box.x) < box.w * .03, `${format}: the reveal frames the whole calendar`);
    const intro = cameraAt(data, timeline, format, .5);
    assert.deepEqual([intro.s, intro.cx, intro.cy], [1, intro.P.x, intro.P.y]);
    const shot = t => { const c = cameraAt(data, timeline, format, t); return [c.s, c.cx, c.cy]; };
    assert.deepEqual(shot(15.3), shot(15.3), 'the camera is a pure function of time');
  }
});
test('the camera glides: no shake offsets, no beat bumps, no oscillation, and one pullback at the drop', () => {
  const p = cuePoints(timeline), h = 1 / 120, q = BEAT_SECONDS / 4;
  for (const format of ['landscape', 'portrait']) {
    const cam = t => cameraAt(data, timeline, format, t), samples = [];
    for (let t = 0; t <= p.end; t += h) samples.push({ t, ...cam(t) });
    // The view is a pure zoom about the camera centre, with no shake or other screen offset on top.
    for (const c of samples) {
      const centre = c.toScreen(c.cx, c.cy);
      assert(centre.x === c.P.x && centre.y === c.P.y, `${format}: screen offset at ${c.t.toFixed(3)} s`);
    }
    // Tracking: zoom and pan change gently (the old per-kick bumps and sinusoidal breathing reached
    // hundreds of zoom units per second squared here).
    for (let k = 1; k < samples.length - 1; k++) {
      const [a, b, c] = samples.slice(k - 1, k + 2);
      if (b.t < p.intro + DIVE_SECONDS || b.t > p.drop - h) continue;
      assert(Math.abs(a.s - 2 * b.s + c.s) / h / h / b.s < 10, `${format}: zoom jerks at ${b.t.toFixed(3)} s`);
      assert(Math.hypot(a.cx - 2 * b.cx + c.cx, a.cy - 2 * b.cy + c.cy) / h / h * b.s < 3000, `${format}: pan jerks at ${b.t.toFixed(3)} s`);
    }
    // Kicks leave no trace: zoom at each kick lies on the line through a quarter beat either side.
    for (const k of kickTimes(p).filter(k => k > p.intro + DIVE_SECONDS && k < p.drop - q)) {
      const a = cam(k - q), b = cam(k), c = cam(k + q);
      assert(Math.abs(b.s - (a.s + c.s) / 2) / b.s < .005, `${format}: zoom bumps on the kick at ${k.toFixed(3)} s`);
    }
    // Zoom and pan change direction only a handful of times over the whole film.
    for (const [key, eps, most] of [['s', 1e-5, 6], ['cx', 1e-3, 4], ['cy', 1e-3, 6]]) {
      let sign = 0, reversals = 0;
      for (let k = 1; k < samples.length; k++) {
        const d = samples[k][key] - samples[k - 1][key];
        if (Math.abs(d) <= eps) continue;
        if (sign && Math.sign(d) !== sign) reversals++;
        sign = Math.sign(d);
      }
      assert(reversals <= most, `${format}: ${key} reverses ${reversals} times`);
    }
    // Before the drop the zoom only tightens (within a small tolerance for the score spread); the single pullback
    // runs from the drop down to the whole chart without a rebound.
    let peak = 0;
    for (const c of samples.filter(c => c.t >= p.intro + DIVE_SECONDS && c.t <= p.drop)) { peak = Math.max(peak, c.s); assert(c.s > peak * .92, `${format}: zoom pulls back at ${c.t.toFixed(3)} s`); }
    const reveal = samples.filter(c => c.t >= p.drop && c.t <= p.drop + REVEAL_SECONDS);
    for (let k = 1; k < reveal.length; k++) assert(reveal[k].s - reveal[k - 1].s <= .05 * h, `${format}: the pullback rebounds`);
    assert(reveal[0].s > 1.5 && reveal.at(-1).s < 1.05);
  }
});
