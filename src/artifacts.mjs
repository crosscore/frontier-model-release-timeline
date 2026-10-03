import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { yearlyStats } from './data.mjs';
import { makeRenderer } from './node-renderer.mjs';
import { FIREWORK } from './draw.mjs';
import { SCORE } from './audio.mjs';

const labList = data => new Intl.ListFormat('en', { type: 'conjunction' }).format(data.labs.map(lab => lab.name));

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const csv = value => `"${String(value).replaceAll('"', '""')}"`;
export function sourceCsv(data) {
  return [['date', 'lab', 'model', 'stage', 'official_sources', 'note'], ...data.releases.map(e => [e.date, e.lab, e.name, e.stage, e.sources.map(s => s.url).join(' '), e.note ?? ''])].map(r => r.map(csv).join(',')).join('\n') + '\n';
}
export function captions(data, timeline, duration = timeline.duration) {
  const stamp = value => {
    const ms = Math.round(value * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
  };
  const dates = [...new Set(data.releases.map(e => e.date))];
  const cues = [{ start: 0, end: timeline.introSeconds, text: `${data.releases.length} selected ${labList(data)} model launches. ${data.startDate} through ${data.endDate}.` },
    ...dates.map((date, i) => {
      const events = data.releases.filter(e => e.date === date);
      return { start: timeline.onsets.get(events[0].id), end: i + 1 < dates.length ? timeline.onsets.get(data.releases.find(e => e.date === dates[i + 1]).id) : timeline.outroStart,
        text: `${date}: ${events.map(e => `${e.name}${e.stage === 'preview' ? ' (preview)' : ''}`).join('; ')}` };
    }), { start: timeline.outroStart, end: timeline.duration, text: 'Launch density = observed calendar days divided by selected launch events. This curated sample is not an industry census.' }];
  const ratio = duration / timeline.duration;
  return 'WEBVTT\n\n' + cues.map(cue => `${stamp(cue.start * ratio)} --> ${stamp(cue.end * ratio)}\n${cue.text.replaceAll('-->', '→')}\n`).join('\n');
}
export function previewHtml(data) {
  const e = escapeHtml, stats = yearlyStats(data);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Frontier / Ignited</title><style>
@font-face{font-family:Manrope;src:url(Manrope.ttf)}*{box-sizing:border-box}body{margin:0;background:#0b1117;color:#f2f1e9;font:16px/1.6 Manrope,system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:48px 24px}a{color:#92f1ce}h1{font-size:clamp(40px,6vw,76px);letter-spacing:-.05em;line-height:1.12;margin:16px 0}h2{margin-top:48px;font-size:28px}.eyebrow{letter-spacing:.13em;color:#d5e4a5;font-size:13px}.muted{color:#9dafb9}video{display:block;width:100%;background:#101b24;border:1px solid #263541;border-radius:12px}video.portrait{max-width:360px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #263541;padding:12px 10px;text-align:left;vertical-align:top}th{color:#9dafb9}td small{display:block;max-width:480px;color:#9dafb9;margin-top:5px}.scroll{overflow:auto}code{color:#d5e4a5}summary{cursor:pointer;font-size:22px;margin:20px 0}footer{border-top:1px solid #263541;margin-top:48px;padding-top:24px}.pill{display:inline-block;border:1px solid #344753;border-radius:99px;padding:5px 13px;margin:6px 8px 6px 0;color:#9dafb9}</style>
<main><div class="eyebrow">FRONTIER OBSERVATORY / RELEASE STUDY 001</div><h1>The frontier, ignited.</h1>
<p class="muted">${e(data.scope)}</p><p><span class="pill">${data.releases.length} events</span><span class="pill">${e(data.startDate)} → ${e(data.endDate)}</span><span class="pill">Official sources</span></p>
<h2>Landscape film</h2><video controls playsinline preload="metadata" poster="poster-landscape.png"><source src="frontier-landscape.mp4" type="video/mp4"><track kind="captions" src="captions-landscape.vtt" srclang="en" label="Release dates">Your browser cannot play this video.</video>
<p><a href="frontier-landscape.mp4" download>Download MP4</a> · <a href="preview.gif">Animated GIF</a></p>
<details><summary>Portrait film · 9:16</summary><video class="portrait" controls playsinline preload="none" poster="poster-portrait.png"><source src="frontier-portrait.mp4" type="video/mp4"><track kind="captions" src="captions-portrait.vtt" srclang="en" label="Release dates"></video><p><a href="frontier-portrait.mp4" download>Download portrait MP4</a></p></details>
<h2>Original soundtrack</h2><p>“${e(SCORE.title)}” — a ${SCORE.bpm} BPM electronic score made entirely from code, plus date-synchronized launch sounds. No recorded samples or existing music. Stereo AAC, mastered to about ${String(SCORE.targetLufs).replace('-', '−')} LUFS. Playback starts only when you press play.</p><audio controls preload="none" src="soundtrack-landscape.m4a"></audio><p><a href="soundtrack-landscape.m4a" download>Download soundtrack</a> · <a href="audio-landscape.json">Audio measurements and cue times</a></p><h2>Read the rhythm</h2><p>Every burst represents one selected launch. The calendar moves at constant speed; the burst and its sound coincide with the release date. Launch trajectories begin ${FIREWORK.rise} seconds earlier. Each lab bursts at its own fixed altitude with its own burst shape; ground markers keep the true date, while bloom positions may shift sideways for legibility. Four fixed slots per lab keep each name on screen for at least 1.4 seconds. Burst size and altitude do not measure capability; an asterisk and hollow ground marker identify previews.</p>
<div class="scroll"><table><thead><tr><th>Window</th><th>Observed days</th><th>Launches</th><th>Days / launch</th><th>Mean adjacent gap</th></tr></thead><tbody>${stats.map(r => `<tr><td>${r.year}${r.partial ? ' YTD' : ''}</td><td>${r.observedDays}</td><td>${r.count}</td><td>${r.daysPerLaunch?.toFixed(1) ?? '—'}</td><td>${r.meanGapDays?.toFixed(1) ?? '—'}</td></tr>`).join('')}</tbody></table></div>
<p class="muted">Days per launch = inclusive calendar days observed / selected launch events. It is not the mean gap or a lab's internal development time. Same-day launches by different labs are separate events. ${e(data.endDate.slice(0, 4))} is a partial year. Changing the selection changes the result.</p>
<h2>Source ledger</h2><p><a href="releases.json">Editable JSON snapshot</a> · <a href="sources.csv">CSV</a> · <a href="https://github.com/crosscore/frontier-model-release-timeline/blob/main/docs/methodology.md">Full methodology</a></p>
<div class="scroll"><table><thead><tr><th>Date</th><th>Lab</th><th>Model / event</th><th>Primary evidence</th></tr></thead><tbody>${data.releases.map(r => `<tr><td>${e(r.date)}</td><td>${e(data.labs.find(l => l.id === r.lab).name)}</td><td>${e(r.name)}${r.stage === 'preview' ? ' <small>Public preview</small>' : ''}${r.note ? `<small>${e(r.note)}</small>` : ''}</td><td>${r.sources.map(s => `<a href="${e(s.url)}" target="_blank" rel="noreferrer">${e(s.title)}</a>`).join('<br>')}</td></tr>`).join('')}</tbody></table></div>
<footer><a href="https://github.com/crosscore/frontier-model-release-timeline">Source code & regeneration</a><p class="muted">Independent visualization by crosscore. No affiliation with the model providers. The reference post's video, graphics and audio are not redistributed.</p></footer></main></html>`;
}

export async function buildArtifacts(data, timeline, out, { posters = true } = {}) {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'index.html'), previewHtml(data));
  await writeFile(join(out, 'releases.json'), JSON.stringify(data, null, 2) + '\n');
  await writeFile(join(out, 'stats.json'), JSON.stringify(yearlyStats(data), null, 2) + '\n');
  await writeFile(join(out, 'sources.csv'), sourceCsv(data));
  if (posters) for (const format of ['landscape', 'portrait']) {
    const renderer = makeRenderer(data, timeline, format);
    renderer.frame(timeline.onsets.get(data.releases.at(-1).id) + .95);
    await writeFile(join(out, `poster-${format}.png`), await renderer.canvas.encode('png'));
  }
}
