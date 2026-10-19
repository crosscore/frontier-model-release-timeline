import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { day, loadDataset } from '../src/data.mjs';
import { BAR_SECONDS, BEAT_SECONDS, cuePoints, kickTimes, makeTimeline } from '../src/timeline.mjs';
import { makeRenderer } from '../src/node-renderer.mjs';
import { cameraAt, DIVE_SECONDS, REVEAL_SECONDS } from '../src/camera.mjs';
import { burstCrowd } from '../src/draw.mjs';
import { CVD, colorDistance, contrastRatio, simulatedHex } from '../src/color.mjs';
import { labSubset, stressDataset } from './visual-fixtures.mjs';

// One visual QA entrypoint: key frames, contact sheets, luminance scan and camera statistics. The real fixture
// also writes the palette simulation and contrast metrics. Frames default to each format's native resolution.
// node scripts/visual-checks.mjs [--fixture real|stress|labs2|labs3|labs4] [--out output/qa] [--width 960] [--scan 30]
const { values: args } = parseArgs({
  options: {
    data: { type: 'string', default: 'data/releases.json' },
    out: { type: 'string', default: 'output/qa' },
    fixture: { type: 'string', default: 'real' },
    width: { type: 'string' },
    scan: { type: 'string', default: '30' },
  },
  strict: true,
});
const fixtures = {
  real: data => data,
  stress: stressDataset,
  labs2: data => labSubset(data, 2),
  labs3: data => labSubset(data, 3),
  labs4: data => labSubset(data, 4),
};
if (!fixtures[args.fixture]) throw new Error(`Unknown fixture: ${args.fixture}`);
const data = fixtures[args.fixture](await loadDataset(resolve(args.data)));
const timeline = makeTimeline(data), points = cuePoints(timeline);
const out = resolve(args.out, args.fixture), framesOut = join(out, 'frames');
const width = args.width === undefined ? undefined : Number(args.width);
const scanFps = Number(args.scan);
if (!Number.isFinite(scanFps) || scanFps <= 0 || scanFps > 120) throw new Error('Scan rate must be from 0 to 120 fps');
await mkdir(framesOut, { recursive: true });

let densest = { time: points.intro, crowd: 0 };
for (let time = points.intro; time < points.drop; time += 1 / 30) {
  const crowd = burstCrowd(data, timeline, time);
  if (crowd > densest.crowd) densest = { time, crowd };
}
const at = date => timeline.introSeconds + (day(date) - timeline.start) / (timeline.end - timeline.start) * timeline.travelSeconds;
const withinWindow = date => day(date) >= timeline.start && day(date) <= timeline.end;
const boundaryMoments = [];
for (let year = Number(data.startDate.slice(0, 4)) + 1; year <= Number(data.endDate.slice(0, 4)); year++) {
  const date = `${year}-01-01`;
  if (withinWindow(date)) boundaryMoments.push([`${year} boundary`, at(date) + .03]);
}
const clusters = [
  ['2025 cluster', '2025-09-29', .12],
  ['2026 Sep cluster', '2026-09-22', .12],
  ['2026 Oct cluster', '2026-10-12', .04],
].filter(([, date]) => withinWindow(date)).map(([name, date, offset]) => [name, at(date) + offset]);
const stress = data.releases.find(event => event.id === 'stress-openai');
const stressMoments = stress ? [
  ['stress +0.12', timeline.onsets.get(stress.id) + .12],
  ['stress +0.6', timeline.onsets.get(stress.id) + .6],
] : [];
const moments = [
  ['Intro', 1.2],
  ['Title complete', points.intro - .4],
  ['Dive', points.intro + DIVE_SECONDS + .3],
  ...boundaryMoments,
  ...clusters,
  ['Densest', densest.time],
  ...stressMoments,
  ['Lift wave', points.lift + BEAT_SECONDS / 2],
  ['Drop1 wave', points.drop1 + BEAT_SECONDS / 2],
  ['Drop1 kick', points.drop1 + BEAT_SECONDS + .033],
  ['Build', points.build + .2],
  ['Breath', points.breath + .3],
  ['Before drop', points.drop - .1],
  ['Tags before drop', points.drop - .025],
  ['After drop', points.drop + .1],
  ['Wide reveal', points.drop + REVEAL_SECONDS + .15],
  ['Relight sweep', points.drop + 1.8],
  ['Final hold', timeline.outroStart - .4],
  ['Summary count', points.outro + .9],
  ['Summary ECI', points.outro + BAR_SECONDS + .9],
  ['Summary complete', points.musicOutro + .5],
  ['End card', points.finale + .5],
  ['Final fade', timeline.duration - .3],
];
await writeFile(join(out, 'contact-moments.json'), JSON.stringify(moments, null, 2) + '\n');

function scanLuminance(format) {
  const renderer = makeRenderer(data, timeline, format, 320);
  const frames = Math.ceil(timeline.duration * scanFps);
  let maxLuma = 0, maxWhite = 0, maxJump = 0, previous = null;
  for (let frame = 0; frame < frames; frame++) {
    // Match render.mjs: the last encoded frame samples the exact logical ending.
    renderer.frame(frame / Math.max(1, frames - 1) * timeline.duration);
    const pixels = renderer.canvas.data();
    let sum = 0, white = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const luma = (.2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2]) / 255;
      sum += luma;
      if (luma > .92) white++;
    }
    const luma = sum / (pixels.length / 4);
    maxLuma = Math.max(maxLuma, luma);
    maxWhite = Math.max(maxWhite, white / (pixels.length / 4));
    if (previous !== null) maxJump = Math.max(maxJump, Math.abs(luma - previous));
    previous = luma;
  }
  return {
    fps: scanFps,
    frames,
    maxMeanLuma: Number(maxLuma.toFixed(4)),
    maxNearWhiteShare: Number(maxWhite.toFixed(5)),
    maxMeanLumaJump: Number(maxJump.toFixed(4)),
  };
}

function cameraMetrics(format) {
  const dt = 1 / 240, series = [];
  for (let time = points.intro + DIVE_SECONDS; time < points.drop; time += dt) {
    series.push(cameraAt(data, timeline, format, time));
  }
  let maxAccel = 0;
  const reversals = { s: 0, cx: 0, cy: 0 }, last = {};
  for (let i = 1; i + 1 < series.length; i++) {
    maxAccel = Math.max(maxAccel, Math.abs(series[i - 1].s - 2 * series[i].s + series[i + 1].s) / dt ** 2);
    for (const key of Object.keys(reversals)) {
      const delta = series[i + 1][key] - series[i][key];
      if (Math.abs(delta) < 1e-7) continue;
      if (last[key] !== undefined && Math.sign(delta) !== last[key]) reversals[key]++;
      last[key] = Math.sign(delta);
    }
  }
  const kicks = kickTimes(points).filter(time => time > points.intro + DIVE_SECONDS && time < points.drop - .01);
  const kickBump = Math.max(0, ...kicks.map(time => {
    const [before, atKick, after] = [time - .01, time + .005, time + .02].map(t => cameraAt(data, timeline, format, t).s);
    return Math.abs(atKick - (before + after) / 2);
  }));
  return {
    maxZoomAccel: Number(maxAccel.toFixed(3)),
    reversals,
    maxZoomBumpAtKick: Number(kickBump.toExponential(2)),
  };
}

async function writePalette() {
  const canvas = createCanvas(1300, 600), ctx = canvas.getContext('2d');
  const metrics = {
    method: 'Machado et al. 2009, severity 1.0, linear sRGB; Euclidean Oklab distance after clipping; project threshold 0.12',
    source: 'https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html',
    modes: {},
    contrast: {},
  };
  ctx.fillStyle = '#050A14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [row, mode] of Object.keys(CVD).entries()) {
    const pairs = [];
    ctx.font = '600 22px Manrope600';
    ctx.fillStyle = '#F4F3EE';
    ctx.fillText(mode, 20, 45 + row * 190);
    for (const [i, lab] of data.labs.entries()) {
      const x = 220 + i * 210, y = 20 + row * 190;
      const color = simulatedHex(lab.color, mode);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 170, 95);
      ctx.font = '500 20px Manrope500';
      ctx.fillText(lab.name, x, y + 126);
      ctx.font = '500 16px Manrope500';
      ctx.fillStyle = '#ABB7C9';
      ctx.fillText(`${lab.color} → ${color}`, x, y + 155);
      for (const other of data.labs.slice(i + 1)) {
        pairs.push({ a: lab.id, b: other.id, distance: colorDistance(lab.color, other.color, mode) });
      }
    }
    metrics.modes[mode] = { minimum: Math.min(...pairs.map(pair => pair.distance)), pairs };
  }
  for (const lab of data.labs) metrics.contrast[lab.id] = contrastRatio(lab.color, '#050A14');
  await writeFile(join(out, 'palette-simulation.png'), await canvas.encode('png'));
  await writeFile(join(out, 'palette-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
}

const summary = {
  fixture: args.fixture,
  labs: data.labs.map(lab => lab.id),
  events: data.releases.length,
  densest,
  formats: {},
};
for (const format of ['landscape', 'portrait']) {
  const renderer = makeRenderer(data, timeline, format, width);
  const thumbWidth = format === 'landscape' ? 480 : 270;
  const thumbHeight = Math.round(thumbWidth * renderer.height / renderer.width), cols = 4;
  const rows = Math.ceil(moments.length / cols);
  const sheet = createCanvas(cols * thumbWidth, rows * (thumbHeight + 36)), ctx = sheet.getContext('2d');
  ctx.fillStyle = '#050A14';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  for (const [i, [name, time]] of moments.entries()) {
    renderer.frame(time);
    const filename = `${format}-${String(i).padStart(2, '0')}-${name.replace(/[^a-z0-9.+]+/gi, '_')}.png`;
    await writeFile(join(framesOut, filename), await renderer.canvas.encode('png'));
    const x = i % cols * thumbWidth, y = Math.floor(i / cols) * (thumbHeight + 36);
    ctx.drawImage(renderer.canvas, x, y, thumbWidth, thumbHeight);
    ctx.font = '500 14px Manrope500';
    ctx.fillStyle = '#F4F3EE';
    ctx.fillText(`${name} / ${time.toFixed(3)} s`, x + 10, y + thumbHeight + 23);
  }
  await writeFile(join(out, `${format}-contact.png`), await sheet.encode('png'));
  summary.formats[format] = {
    frames: moments.length,
    width: renderer.width,
    height: renderer.height,
    scan: scanLuminance(format),
    camera: cameraMetrics(format),
  };
  const scan = summary.formats[format].scan;
  assert(scan.maxMeanLuma <= .16, `${format}: mean luminance exceeds .16`);
  assert(scan.maxNearWhiteShare <= .015, `${format}: near-white share exceeds .015`);
  assert(scan.maxMeanLumaJump <= .03, `${format}: frame luminance jump exceeds .03`);
}
if (args.fixture === 'real') await writePalette();
await writeFile(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
console.log(`Frames, contact sheets${args.fixture === 'real' ? ' and palette checks' : ''} in ${out}`);
