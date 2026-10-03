import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadDataset, yearlyStats } from '../src/data.mjs';
import { makeTimeline } from '../src/timeline.mjs';
import { makeRenderer } from '../src/node-renderer.mjs';
import { buildArtifacts } from '../src/artifacts.mjs';
import { options } from './options.mjs';
const args = options(), data = await loadDataset(args.data), timeline = makeTimeline(data);
await buildArtifacts(data, timeline, args.out);
await copyFile(new URL('../assets/fonts/Manrope.ttf', import.meta.url), join(args.out, 'Manrope.ttf'));
await copyFile(new URL('../assets/fonts/OFL.txt', import.meta.url), join(args.out, 'OFL.txt'));
await mkdir(join(args.out, 'storyboard'), { recursive: true });
const renderer = makeRenderer(data, timeline);
const moments = [timeline.introSeconds * .65, ...yearlyStats(data).map(({ year }) => {
  const event = data.releases.filter(e => e.date.startsWith(String(year))).at(-1);
  return event ? timeline.onsets.get(event.id) + .65 : undefined;
}).filter(t => t !== undefined), timeline.outroStart + 4];
for (const [i, time] of moments.entries()) {
  renderer.frame(time); await writeFile(join(args.out, 'storyboard', `${i}.png`), await renderer.canvas.encode('png'));
}
console.log(`Built posters, source ledger and ${moments.length} storyboard frames in ${args.out}. Film duration: ${timeline.duration.toFixed(2)}s.`);
