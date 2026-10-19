// Check that the complete preview bundle describes the same canonical input and clock.
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadDataset, yearlyStats } from '../src/data.mjs';
import { makeTimeline } from '../src/timeline.mjs';
import { captions, sourceCsv, previewHtml } from '../src/artifacts.mjs';
import { soundCues, SCORE } from '../src/audio.mjs';
import { syncDocs } from './sync-docs.mjs';
import { options } from './options.mjs';
const args = options();
const data = await loadDataset(args.data), timeline = makeTimeline(data);
await syncDocs(data, { check: true });
const text = name => readFile(join(args.out, name), 'utf8');
const json = async name => JSON.parse(await text(name));
assert.deepEqual(await json('releases.json'), data, 'bundled dataset');
assert.deepEqual(await json('stats.json'), yearlyStats(data), 'annual counts');
assert.equal(await text('sources.csv'), sourceCsv(data), 'source ledger');
assert.equal(await text('index.html'), previewHtml(data), 'preview page');
const hash = createHash('sha256').update(await readFile(args.data)).digest('hex');
for (const format of ['landscape', 'portrait']) {
  const manifest = await json(`manifest-${format}.json`), audio = await json(`audio-${format}.json`);
  assert.equal(manifest.datasetSha256, hash);
  assert.equal(manifest.events, data.releases.length);
  assert.equal(manifest.observationEnd, data.endDate);
  assert.equal(manifest.audio.title, SCORE.title);
  assert.equal(manifest.duration, timeline.duration, 'published bundle uses the complete timeline');
  assert.equal(manifest.fps, 30);
  assert.equal(manifest.frames, 1800);
  assert(audio.integratedLufs >= SCORE.targetLufs - .5 && audio.integratedLufs <= SCORE.targetLufs + .5);
  assert(audio.truePeakDbtp <= SCORE.truePeakDb);
  assert.equal(audio.title, SCORE.title);
  assert.equal(audio.cueCount, data.releases.length);
  const scale = (manifest.frames - 1) / manifest.fps / timeline.duration;
  assert.deepEqual(audio.cues, soundCues(data, timeline, scale), 'unquantized event cues');
  assert.equal(await text(`captions-${format}.vtt`), captions(data, timeline, manifest.duration));
  for (const filename of [`frontier-${format}.mp4`, `soundtrack-${format}.m4a`, `poster-${format}.png`]) {
    assert((await stat(join(args.out, filename))).size > 0, filename);
  }
  assert((await stat(join(args.out, `frontier-${format}.mp4`))).size <= 30_000_000, 'MP4 <= 30 MB');
}
assert((await stat(join(args.out, 'preview.gif'))).size > 0);
assert((await stat(join(args.out, 'preview.gif'))).size <= 15_000_000, 'GIF <= 15 MB');
console.log(`Verified both artifact bundles against ${data.releases.length} models, sources, annual statistics, captions, original score and announcement-sequenced cues.`);
