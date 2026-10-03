import { spawnSync } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SCORE, synthesize, wavBuffer } from '../src/audio.mjs';

export function loudness(file) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=I=${SCORE.targetLufs}:TP=${SCORE.truePeakDb}:LRA=9:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Audio analysis failed: ${result.stderr || result.error}`);
  const match = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error('FFmpeg returned no loudness measurements');
  const values = JSON.parse(match[0]);
  for (const key of ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']) if (!Number.isFinite(Number(values[key]))) throw new Error(`Invalid loudness metric ${key}`);
  return values;
}
export async function masterSoundtrack(data, timeline, { duration, timeScale, out, format }) {
  const audio = synthesize(data, timeline, { duration, timeScale }), wav = join(out, `.mix-${format}.tmp.wav`), filename = `soundtrack-${format}.m4a`, destination = join(out, filename);
  await writeFile(wav, wavBuffer(audio));
  try {
    const measured = loudness(wav);
    const filter = `loudnorm=I=${SCORE.targetLufs}:TP=${SCORE.truePeakDb}:LRA=9:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', filter, '-ar', String(SCORE.sampleRate), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-metadata', `title=${SCORE.title}`, '-metadata', 'artist=crosscore / procedural original', destination], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Audio mastering failed: ${result.stderr || result.error}`);
    const final = loudness(destination);
    const report = { ...SCORE, original: true, recordedSamplesUsed: false, synthesis: 'Deterministic oscillators and seeded filtered noise', ...audio.metrics, integratedLufs: Number(final.input_i), truePeakDbtp: Number(final.input_tp), loudnessRangeLu: Number(final.input_lra), cues: audio.cues };
    await writeFile(join(out, `audio-${format}.json`), JSON.stringify(report, null, 2) + '\n');
    return { filename, report };
  } finally { await rm(wav, { force: true }); }
}
