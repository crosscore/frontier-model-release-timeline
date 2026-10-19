// Short, real-speed visual windows: keep the full dataset, chart coordinates, camera and logical clock.
// Native PNGs complement the 6-second compressed render smoke (whose compressed salvos are sub-frame).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { loadDataset, launchGroups } from '../src/data.mjs';
import { makeTimeline } from '../src/timeline.mjs';
import { makeRenderer } from '../src/node-renderer.mjs';
import { options } from './options.mjs';
const args = options({ out: { type: 'string', default: 'output/qa/per-model/windows' } });
const data = await loadDataset(args.data), timeline = makeTimeline(data), groups = launchGroups(data);
await mkdir(args.out, { recursive: true });
const windows = [['2023-03-14', 'anthropic'], ['2024-09-12', 'openai'], ['2025-04-14', 'openai'], ['2025-05-22', 'anthropic'], ['2025-08-07', 'openai'], ['2025-11-12', 'openai'], ['2025-12-11', 'openai'], ['2026-07-09', 'openai'], ['2026-07-21', 'google'], ['2026-09-22', 'openai']];
const manifest = [];
for (const format of ['landscape', 'portrait']) {
  const native = makeRenderer(data, timeline, format), renderer = makeRenderer(data, timeline, format, format === 'landscape' ? 960 : 540);
  for (const [date, lab] of windows) {
    const group = groups.find(g => g.date === date && g.lab === lab), onset = timeline.onsets.get(group.models[0].id), start = onset - .4;
    const prefix = `${format}-${date}`, file = join(args.out, `${prefix}.mp4`), frames = 48, fps = 30;
    const encoder = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${renderer.width}x${renderer.height}`, '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'ignore', 'pipe'] });
    let error = ''; encoder.stderr.on('data', c => { error += c; });
    const closed = once(encoder, 'close');
    for (let i = 0; i < frames; i++) {
      renderer.frame(start + i / fps);
      if (!encoder.stdin.write(Buffer.from(renderer.canvas.data()))) await once(encoder.stdin, 'drain');
    }
    encoder.stdin.end();
    const [code] = await closed;
    if (code !== 0) throw new Error(error);
    const stills = [];
    for (const offset of [.05, .17, .24, .3]) {
      native.frame(onset + offset);
      const filename = `${prefix}-${Math.round(offset * 1000)}ms.png`;
      await writeFile(join(args.out, filename), await native.canvas.encode('png'));
      stills.push({ filename, logicalTime: onset + offset });
    }
    manifest.push({ format, date, lab, file, start, fps, frames, duration: frames / fps, audio: false, stills });
  }
}
await writeFile(join(args.out, 'windows.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Rendered ${manifest.length} real-speed visual windows and ${manifest.reduce((n, w) => n + w.stills.length, 0)} native frames in ${args.out}`);
