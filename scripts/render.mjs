import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, rename, rm, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadDataset } from '../src/data.mjs';
import { makeTimeline } from '../src/timeline.mjs';
import { makeRenderer } from '../src/node-renderer.mjs';
import { buildArtifacts, captions } from '../src/artifacts.mjs';
import { options } from './options.mjs';

const args = options({ format: { type: 'string', default: 'landscape' }, width: { type: 'string' }, fps: { type: 'string', default: '30' }, duration: { type: 'string' }, 'no-gif': { type: 'boolean', default: false } });
const fps = Number(args.fps);
if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('FPS must be an integer from 1 to 60');
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) throw new Error('FFmpeg is required. On macOS: brew install ffmpeg');
const data = await loadDataset(args.data), timeline = makeTimeline(data);
const requestedDuration = args.duration === undefined ? timeline.duration : Number(args.duration);
if (!Number.isFinite(requestedDuration) || requestedDuration < 1 || requestedDuration > 600) throw new Error('Duration must be between 1 and 600 seconds');
const frames = Math.ceil(requestedDuration * fps), duration = frames / fps;
const renderer = makeRenderer(data, timeline, args.format, args.width === undefined ? undefined : Number(args.width));
await buildArtifacts(data, timeline, args.out);
await copyFile(new URL('../assets/fonts/Manrope.ttf', import.meta.url), join(args.out, 'Manrope.ttf'));
await copyFile(new URL('../assets/fonts/OFL.txt', import.meta.url), join(args.out, 'OFL.txt'));
const filename = `frontier-${args.format}.mp4`, temp = join(args.out, `.render-${args.format}.tmp.mp4`);
const command = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${renderer.width}x${renderer.height}`, '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-threads', '4', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', temp];
const encoder = spawn('ffmpeg', command, { stdio: ['pipe', 'ignore', 'pipe'] });
let errorText = '', streamError;
encoder.stderr.on('data', chunk => { errorText = (errorText + chunk).slice(-16000); });
encoder.stdin.on('error', error => { streamError = error; });
const finished = new Promise((resolve, reject) => {
  encoder.once('error', reject);
  encoder.once('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${errorText}`)));
});
finished.catch(() => {});
try {
  for (let frame = 0; frame < frames; frame++) {
    if (streamError) throw streamError;
    renderer.frame(frame / Math.max(1, frames - 1) * timeline.duration);
    if (!encoder.stdin.write(renderer.canvas.data())) await Promise.race([once(encoder.stdin, 'drain'), finished.then(() => { throw new Error('Encoder exited before the last frame'); })]);
    if (frame % (fps * 5) === 0) console.log(`${args.format}: ${Math.round(frame / frames * 100)}% (${frame}/${frames} frames)`);
  }
  encoder.stdin.end(); await finished; await rename(temp, join(args.out, filename));
} catch (error) {
  encoder.kill('SIGTERM'); await finished.catch(() => {}); await rm(temp, { force: true }); throw error;
}
await writeFile(join(args.out, `captions-${args.format}.vtt`), captions(data, timeline, duration));
const hash = createHash('sha256').update(await readFile(args.data)).digest('hex');
const manifest = { format: args.format, width: renderer.width, height: renderer.height, fps, frames, duration, datasetSha256: hash, events: data.releases.length, observationEnd: data.endDate, codec: 'h264', pixelFormat: 'yuv420p', audio: false };
await writeFile(join(args.out, `manifest-${args.format}.json`), JSON.stringify(manifest, null, 2) + '\n');
if (!args['no-gif'] && args.format === 'landscape') {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', join(args.out, filename), '-vf', 'fps=8,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', join(args.out, 'preview.gif')], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('GIF generation failed');
}
console.log(`Rendered ${filename}: ${renderer.width}×${renderer.height}, ${frames} frames, ${duration.toFixed(2)} seconds.`);
