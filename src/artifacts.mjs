import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { yearlyStats } from './data.mjs';
import { makeRenderer } from './node-renderer.mjs';
import { FIREWORK, labStyles, scoreOf } from './draw.mjs';
import { SCORE } from './audio.mjs';

const labList = data => new Intl.ListFormat('en', { type: 'conjunction' }).format(data.labs.map(lab => lab.name));
const plural = shape => shape === 'cross' ? 'crosses' : `${shape}s`;
const identities = data => { const styles = labStyles(data.labs); return data.labs.map(lab => `${lab.name}, ${styles.get(lab.id).form.replace(/ (?=ring)/, '-')} bursts and ${plural(styles.get(lab.id).shape)}`).join('; '); };

export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const csv = value => `"${String(value).replaceAll('"', '""')}"`;
export function sourceCsv(data) {
  return [['date', 'lab', 'model', 'stage', 'eci_model', 'eci', 'official_sources', 'note'], ...data.releases.map(e => [e.date, e.lab, e.name, e.stage, e.capability?.model ?? '', scoreOf(e) ?? '', e.sources.map(s => s.url).join(' '), e.note ?? ''])].map(r => r.map(csv).join(',')).join('\n') + '\n';
}
export function captions(data, timeline, duration = timeline.duration) {
  const stamp = value => {
    const ms = Math.round(value * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
  };
  const dates = [...new Set(data.releases.map(e => e.date))];
  const cues = [{ start: 0, end: timeline.introSeconds, text: `${data.releases.length} selected ${labList(data)} models. ${data.startDate} through ${data.endDate}. Burst heights: ${data.capability.index}, ${data.capability.publisher} (${data.capability.license}).` },
    ...dates.map((date, i) => {
      const events = data.releases.filter(e => e.date === date);
      return { start: Math.min(...events.map(e => timeline.onsets.get(e.id))), end: i + 1 < dates.length ? Math.min(...data.releases.filter(e => e.date === dates[i + 1]).map(e => timeline.onsets.get(e.id))) : timeline.outroStart,
        text: `${date}: ${events.map(e => `${e.name}${e.stage === 'preview' ? ' (preview)' : ''}, ${scoreOf(e) === null ? 'no ECI yet' : `ECI ${Math.round(scoreOf(e))}`}`).join('; ')}` };
    }), { start: timeline.outroStart, end: timeline.duration, text: 'Model density = observed calendar days divided by selected models. This curated sample is not an industry census.' }];
  const ratio = duration / timeline.duration;
  return 'WEBVTT\n\n' + cues.map(cue => `${stamp(cue.start * ratio)} --> ${stamp(cue.end * ratio)}\n${cue.text.replaceAll('-->', '→')}\n`).join('\n');
}
export function previewHtml(data) {
  const e = escapeHtml, stats = yearlyStats(data), scored = data.releases.filter(r => scoreOf(r) !== null).length;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Frontier / Ignited</title><style>
@font-face{font-family:Manrope;src:url(Manrope.ttf)}*{box-sizing:border-box}body{margin:0;background:#0b1117;color:#f2f1e9;font:16px/1.6 Manrope,system-ui,sans-serif}main{max-width:1240px;margin:auto;padding:48px 24px}a{color:#92f1ce}h1{font-size:clamp(40px,6vw,76px);letter-spacing:-.05em;line-height:1.12;margin:16px 0}h2{margin-top:48px;font-size:28px}.eyebrow{letter-spacing:.13em;color:#d5e4a5;font-size:13px}.muted{color:#9dafb9}video{display:block;width:100%;background:#101b24;border:1px solid #263541;border-radius:12px}video.portrait{max-width:360px}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #263541;padding:12px 10px;text-align:left;vertical-align:top}th{color:#9dafb9}td small{display:block;max-width:480px;color:#9dafb9;margin-top:5px}.scroll{overflow:auto}code{color:#d5e4a5}summary{cursor:pointer;font-size:22px;margin:20px 0}footer{border-top:1px solid #263541;margin-top:48px;padding-top:24px}.pill{display:inline-block;border:1px solid #344753;border-radius:99px;padding:5px 13px;margin:6px 8px 6px 0;color:#9dafb9}</style>
<main><div class="eyebrow">FRONTIER OBSERVATORY / RELEASE STUDY 001</div><h1>The frontier, ignited.</h1>
<p class="muted">${e(data.scope)}</p><p><span class="pill">${data.releases.length} models</span><span class="pill">${e(data.startDate)} → ${e(data.endDate)}</span><span class="pill">Official sources</span></p>
<h2>Landscape film</h2><video controls playsinline preload="metadata" poster="poster-landscape.png"><source src="frontier-landscape.mp4" type="video/mp4"><track kind="captions" src="captions-landscape.vtt" srclang="en" label="Release dates">Your browser cannot play this video.</video>
<p><a href="frontier-landscape.mp4" download>Download MP4</a> · <a href="preview.gif">Animated GIF</a></p>
<details><summary>Portrait film · 9:16</summary><video class="portrait" controls playsinline preload="none" poster="poster-portrait.png"><source src="frontier-portrait.mp4" type="video/mp4"><track kind="captions" src="captions-portrait.vtt" srclang="en" label="Release dates"></video><p><a href="frontier-portrait.mp4" download>Download portrait MP4</a></p></details>
<h2>Original soundtrack</h2><p>“${e(SCORE.title)}” — a ${SCORE.bpm} BPM electronic score made entirely from code, with wide supersaw chords, arpeggios, rolling bass and a two-octave hook, that lifts across the 60-second calendar, drops at the observation cutoff and closes with a final G minor chord and its tail, plus date-synchronized launch sounds. No recorded samples or existing music. Stereo AAC, mastered to about ${String(SCORE.targetLufs).replace('-', '−')} LUFS. Playback starts only when you press play.</p><audio controls preload="none" src="soundtrack-landscape.m4a"></audio><p><a href="soundtrack-landscape.m4a" download>Download soundtrack</a> · <a href="audio-landscape.json">Audio measurements and cue times</a></p><h2>Read the rhythm</h2><p>Every burst represents one selected model. The horizontal axis is the calendar, moving at constant speed; each rocket climbs straight up from its release date and bursts at the launched model's ${e(data.capability.index)} score, so the bursts trace capability rising over time. The camera never shakes or moves to the beat: it glides with the calendar and the newest scores, tightens slowly in stages as the music builds, and pulls back once to the whole chart at the observation cutoff. A step line per lab follows its best score so far. Beside the chart (under it in portrait), a launch-pace line works like an indicator with a price chart: an exponential moving average of models (60-day time constant), annualized to MODELS / YEAR and kicked up by every model. Its gridlines mark one model every 60, 30, 14 and 7 days, plus 3 days once the peak substantially exceeds the weekly cadence and the gridline fits, and its scale widens whenever the pace sets a new high. Launches that ${e(data.capability.publisher)} has not scored spray a low fountain on the date axis and show “—” instead of a number. The first model of each announcement bursts at the release date; its other models follow at sixteenth-note intervals. Positions stay at each model’s date and ECI; trajectories begin ${FIREWORK.rise} seconds before each burst. Each lab keeps its own burst form and marker shape: ${e(identities(data))}. Where bursts crowd together only their glow and trails dim; each keeps its full size, rays and lifetime. Each tag row names one announcement: all its models in ECI order, with shared leading words elided and every score shown (— if unscored). Announcements a moment apart share one tag of at most three rows; additional announcements are counted towards the lists. Each lab’s list shows up to four newest announcements, newest on top, with all model names, the date and the leading model’s score. Only names too long at the minimum size wrap to two lines; joined names break after a separator, and dates sit directly below the last name line. New arrivals push by their actual height; older rows fade at the column edge. Every announcement is fully inside its column for at least 1.4 seconds. Each model keeps its own preview asterisk and marker; a callout glyph is hollow only when all its models are previews.</p>
<h2>Selection</h2><p>One differently named main-family general-purpose model is one burst, including named small/fast tiers such as Haiku, mini, nano, Instant, Flash, Flash-Lite, Lite and Glimmer. Google includes PaLM 2 before Gemini. Parameter-count-only sizes share one record. Same-name updates, added availability/input/context, hidden routing/fallback variants, compute-only modes, specialists/media/safety, distillations/research/device-only models, auxiliary open-weight families and restricted/unreleased models are excluded; see the full methodology below.</p><h2>Capability scores</h2><p>Burst heights use the <a href="${e(data.capability.url)}">${e(data.capability.index)}</a> by ${e(data.capability.publisher)}, licensed ${e(data.capability.license)}, retrieved ${e(data.capability.retrievedOn)} (<a href="${e(data.capability.data)}">CSV</a>). ${scored} of ${data.releases.length} selected models have a score. ECI combines many benchmarks onto one scale, and Epoch publishes an uncertainty interval several points wide for each model, so small gaps are not rankings. Each record has its own score; same-day models have separate bursts. This visualization is not affiliated with or endorsed by ${e(data.capability.publisher)}.</p>
<div class="scroll"><table><thead><tr><th>Window</th><th>Observed days</th><th>Models</th><th>Days / model</th><th>Mean adjacent gap</th></tr></thead><tbody>${stats.map(r => `<tr><td>${r.year}${r.partial ? ' YTD' : ''}</td><td>${r.observedDays}</td><td>${r.count}</td><td>${r.daysPerModel?.toFixed(1) ?? '—'}</td><td>${r.meanGapDays?.toFixed(1) ?? '—'}</td></tr>`).join('')}</tbody></table></div>
<p class="muted">Days per model = inclusive calendar days observed / selected models. It is not the mean gap or a lab's internal development time. Different named models count separately, including those from the same lab on the same day. ${e(data.endDate.slice(0, 4))} is a partial year. Changing the selection changes the result.</p>
<h2>Source ledger</h2><p><a href="releases.json">Editable JSON snapshot</a> · <a href="sources.csv">CSV</a> · <a href="https://github.com/crosscore/frontier-model-release-timeline/blob/main/docs/methodology.md">Full methodology</a></p>
<div class="scroll"><table><thead><tr><th>Date</th><th>Lab</th><th>Model</th><th>ECI</th><th>Primary evidence</th></tr></thead><tbody>${data.releases.map(r => `<tr><td>${e(r.date)}</td><td>${e(data.labs.find(l => l.id === r.lab).name)}</td><td>${e(r.name)}${r.stage === 'preview' ? ' <small>Public preview</small>' : ''}${r.note ? `<small>${e(r.note)}</small>` : ''}</td><td>${scoreOf(r) ?? '—'}${r.capability && r.capability.model !== r.name ? `<small>${e(r.capability.model)}</small>` : ''}</td><td>${r.sources.map(s => `<a href="${e(s.url)}" target="_blank" rel="noreferrer">${e(s.title)}</a>`).join('<br>')}</td></tr>`).join('')}</tbody></table></div>
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
