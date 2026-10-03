import { day, iso, yearlyStats } from './data.mjs';
import { clamp, smooth, stateAt, stateYear, visibleEvents, calendarPosition } from './timeline.mjs';

export const FORMATS = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1920 } };
const C = { bg: '#0B1117', panel: '#101B24', line: '#263541', text: '#F2F1E9', muted: '#9DAFB9', dim: '#657984', accent: '#D5E4A5' };
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function label(ctx, value, x, y, size = 26, color = C.text, weight = 500, align = 'left') {
  ctx.font = `${Math.round(weight / 100) * 100} ${size}px Manrope`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y);
}
function fit(ctx, value, x, y, width, size = 42, color = C.text, weight = 600) {
  ctx.font = `${weight} ${size}px Manrope`;
  while (ctx.measureText(value).width > width && size > 14) { size -= 1; ctx.font = `${weight} ${size}px Manrope`; }
  label(ctx, value, x, y, size, color, weight);
}
function line(ctx, x1, y1, x2, y2, color = C.line, width = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function rect(ctx, x, y, w, h, fill, radius = 0) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function circle(ctx, x, y, r, color, stroke = false) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (stroke) { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
}
function dateLabel(date) { return `${months[Number(date.slice(5, 7)) - 1]} ${date.slice(8)} · ${date.slice(0, 4)}`; }
function background(ctx, w, h) {
  rect(ctx, 0, 0, w, h, C.bg);
  const glow = ctx.createRadialGradient(w * .8, h * .1, 0, w * .8, h * .1, w * .9);
  glow.addColorStop(0, '#18332D66'); glow.addColorStop(1, '#0B111700'); rect(ctx, 0, 0, w, h, glow);
  for (let x = 36; x < w; x += 36) for (let y = 36; y < h; y += 36) circle(ctx, x, y, .8, '#50637124');
}
function brand(ctx, w, portrait, data) {
  const p = 72;
  circle(ctx, p + 4, 66, 5, C.accent);
  label(ctx, 'FRONTIER OBSERVATORY', p + 24, 74, 22, C.accent, 650);
  label(ctx, 'RELEASE STUDY / 001', w - p, 74, 20, C.muted, 500, 'right');
  label(ctx, 'The release rhythm.', p, portrait ? 168 : 171, portrait ? 64 : 76, C.text, 650);
  label(ctx, 'Selected OpenAI + Anthropic model launches', p, portrait ? 218 : 218, portrait ? 28 : 30, C.muted);
  line(ctx, p, 255, w - p, 255);
}
function footer(ctx, w, h, data, portrait) {
  const p = 72; line(ctx, p, h - 100, w - p, h - 100);
  label(ctx, `CURATED SAMPLE · THROUGH ${data.endDate}`, p, h - 58, portrait ? 21 : 22, C.muted);
  if (portrait) label(ctx, 'Official sources + methodology in repository', p, h - 28, 19, C.dim);
  else label(ctx, 'Official sources + methodology in repository', w - p, h - 58, 21, C.dim, 500, 'right');
}
function miniMap(ctx, data, currentDay, x, y, w, height = 70) {
  const firstYear = Number(data.startDate.slice(0, 4)), lastYear = Number(data.endDate.slice(0, 4));
  const start = day(`${firstYear}-01-01`), end = day(`${lastYear + 1}-01-01`);
  const position = value => x + (value - start) / (end - start) * w;
  const center = y + height / 2;
  line(ctx, x, center, x + w, center, C.dim);
  for (let year = firstYear; year <= lastYear; year++) {
    const xx = position(day(`${year}-01-01`));
    label(ctx, String(year), xx, y - 17, 21, C.muted);
    line(ctx, xx, y, xx, y + height, C.line);
  }
  for (const event of data.releases) {
    const d = day(event.date), labIndex = data.labs.findIndex(lab => lab.id === event.lab), color = data.labs[labIndex].color;
    ctx.globalAlpha = d <= currentDay ? .85 : .13;
    const xx = position(d); line(ctx, xx, center, xx, center + (labIndex ? 23 : -23), color, 3);
  }
  ctx.globalAlpha = 1;
  const xx = position(currentDay); line(ctx, xx, y - 5, xx, y + height + 5, C.text, 2);
}
function timelineChart(ctx, data, timeline, state, box, year, visible) {
  const { x, y, w, h } = box, center = y + h / 2, inset = 22, plotX = x + inset, plotW = w - inset * 2;
  const xx = d => plotX + calendarPosition(d, year) * plotW;
  const currentX = plotX + (state.day - day(`${year}-01-01`)) / (day(`${year + 1}-01-01`) - day(`${year}-01-01`)) * plotW;
  rect(ctx, x, y, w, h, C.panel, 16);
  // All years use the same Jan–Dec scale, including the unobserved end of 2026.
  const cutoff = day(data.endDate), yearEnd = day(`${year + 1}-01-01`);
  if (cutoff < yearEnd - 1) {
    const cutX = xx(iso(cutoff + 1));
    ctx.save(); ctx.beginPath(); ctx.rect(cutX, y, x + w - cutX, h); ctx.clip();
    for (let a = cutX - h; a < x + w + h; a += 19) line(ctx, a, y + h, a + h, y, '#39444C55');
    ctx.restore();
    label(ctx, 'UNOBSERVED', x + w - 18, y + 35, 17, C.dim, 600, 'right');
  }
  for (let m = 0; m < 12; m++) {
    const mx = xx(`${year}-${String(m + 1).padStart(2, '0')}-01`);
    line(ctx, mx, y + 54, mx, y + h - 52, m % 3 === 0 ? '#344753' : '#20313C');
    label(ctx, months[m], mx, y + h - 17, 17, C.muted);
  }
  line(ctx, plotX, center, plotX + plotW, center, '#556B78', 2);
  const labs = data.labs;
  labs.forEach((lab, i) => {
    circle(ctx, x + 24, y + 29 + i * (h - 105), 5, lab.color);
    label(ctx, lab.name.toUpperCase(), x + 39, y + 36 + i * (h - 105), 20, lab.color, 600);
  });
  const laneEvents = labs.map(lab => visible.filter(event => event.lab === lab.id && Number(event.date.slice(0, 4)) === year));
  // Closely spaced stems keep true x positions; names stay in persistent lab cards.
  laneEvents.forEach((events, labIndex) => events.forEach((event, index) => {
    const onset = timeline.onsets.get(event.id), age = state.time - onset;
    const amplitude = smooth(age / .32), dir = labIndex ? 1 : -1;
    const height = Math.min(h * .27, 130) + (index % 3) * 15;
    const xEvent = xx(event.date), yEnd = center + dir * height * amplitude, color = labs[labIndex].color;
    line(ctx, xEvent, center, xEvent, yEnd, color, 3);
    if (event.stage === 'preview') circle(ctx, xEvent, yEnd, 6, color, true);
    else circle(ctx, xEvent, yEnd, 6, color);
    if (age < .85) {
      ctx.globalAlpha = (1 - clamp(age / .85)) * .65;
      circle(ctx, xEvent, yEnd, 10 + age * 24, color, true); ctx.globalAlpha = 1;
    }
  }));
  const grad = ctx.createLinearGradient(currentX - 70, 0, currentX, 0); grad.addColorStop(0, '#D5E4A500'); grad.addColorStop(1, '#D5E4A512');
  rect(ctx, Math.max(x, currentX - 70), y + 50, Math.min(70, currentX - x), h - 104, grad);
  line(ctx, currentX, y + 46, currentX, y + h - 49, C.accent, 2);
  circle(ctx, currentX, center, 6, C.accent);
}
function eventCard(ctx, lab, event, x, y, w, h, state, timeline, portrait) {
  rect(ctx, x, y, w, h, C.panel, 12); rect(ctx, x, y + 20, 3, h - 40, lab.color);
  const pad = 27;
  label(ctx, lab.name.toUpperCase(), x + pad, y + 36, 20, lab.color, 650);
  if (!event) { label(ctx, 'Awaiting a selected launch', x + pad, y + 94, 26, C.dim); return; }
  const age = state.time - timeline.onsets.get(event.id);
  ctx.globalAlpha = .55 + .45 * smooth(age / .2);
  fit(ctx, event.name, x + pad, y + 91, w - pad * 2, portrait ? 41 : 34);
  label(ctx, dateLabel(event.date), x + pad, y + h - 27, 22, C.muted);
  label(ctx, event.stage === 'preview' ? 'PREVIEW' : 'RELEASE', x + w - pad, y + h - 27, 17, lab.color, 650, 'right');
  ctx.globalAlpha = 1;
}
function yearMetrics(ctx, data, year, revealed, box, portrait) {
  const { x, y, w } = box, stats = yearlyStats(data).find(row => row.year === year);
  label(ctx, String(year), x, y + 122, 148, C.text, 650);
  label(ctx, stats.partial ? `YTD · THROUGH ${stats.end.slice(5)}` : 'JANUARY — DECEMBER', x + (portrait ? 390 : 0), y + (portrait ? 80 : 168), 22, C.muted);
  const cy = y + (portrait ? 159 : 256);
  label(ctx, String(revealed).padStart(2, '0'), x, cy + 70, 81, C.accent, 600);
  label(ctx, 'selected launches', x + 128, cy + 32, 25, C.text);
  label(ctx, 'revealed this year', x + 128, cy + 68, 21, C.muted);
  if (!portrait) {
    line(ctx, x, cy + 102, x + w, cy + 102);
    label(ctx, 'SAME CALENDAR SCALE', x, cy + 142, 20, C.muted, 600);
    label(ctx, 'Position shows release date.', x, cy + 181, 24, C.text);
    label(ctx, 'Height separates the labs.', x, cy + 217, 24, C.text);
    label(ctx, 'It does not measure capability.', x, cy + 253, 21, C.muted);
  }
}
function intro(ctx, data, timeline, state, w, h, portrait) {
  const p = 72, entrance = smooth(state.progress * 3);
  ctx.save(); ctx.globalAlpha = entrance; ctx.translate(0, (1 - entrance) * 28);
  label(ctx, 'A CALENDAR OF CAPABILITY', p, portrait ? 396 : 382, 25, C.accent, 650);
  const lines = portrait ? ['New models.', 'Less quiet.'] : ['New models. Less quiet.'];
  lines.forEach((s, i) => label(ctx, s, p, (portrait ? 521 : 505) + i * 116, portrait ? 94 : 104, C.text, 650));
  const by = portrait ? 771 : 578;
  label(ctx, `${data.startDate.slice(0, 4)} — ${data.endDate.slice(0, 4)}`, p, by, 40, C.muted);
  label(ctx, `${data.releases.length} selected launches. Two frontier labs.`, p, by + 69, portrait ? 32 : 34, C.text);
  label(ctx, 'Every date links to an official source.', p, by + 117, portrait ? 27 : 28, C.muted);
  const my = portrait ? 1240 : 786;
  miniMap(ctx, data, timeline.start + (timeline.end - timeline.start) * smooth(state.progress), p, my, w - p * 2, portrait ? 120 : 70);
  data.labs.forEach((lab, i) => { circle(ctx, p + i * 235, my + 155, 6, lab.color); label(ctx, lab.name, p + 18 + i * 235, my + 162, 25, lab.color); });
  ctx.restore();
}
function summary(ctx, data, state, w, h, portrait) {
  const p = 72, rows = yearlyStats(data), max = Math.max(...rows.map(r => r.daysPerLaunch ?? 0));
  const startY = portrait ? 514 : 474, rowH = portrait ? Math.min(211, 930 / rows.length) : Math.min(88, 410 / rows.length);
  label(ctx, 'How often did a launch land?', p, portrait ? 375 : 354, portrait ? 46 : 51, C.text, 650);
  label(ctx, 'Calendar days per selected launch · lower = denser', p, portrait ? 426 : 403, portrait ? 26 : 27, C.muted);
  rows.forEach((row, i) => {
    const y = startY + i * rowH, barX = portrait ? p : p + 296, barW = portrait ? w - p * 2 - 182 : w - p * 2 - 720;
    label(ctx, `${row.year}${row.partial ? ' YTD' : ''}`, p, y + 23, portrait ? 31 : 33, C.text, 650);
    const yy = portrait ? y + Math.min(52, rowH * .29) : y - 5;
    const fill = (row.daysPerLaunch ?? 0) / Math.max(1, max) * smooth(state.progress * 3 - i * .08);
    rect(ctx, barX, yy, barW, 30, C.panel, 3); rect(ctx, barX, yy, barW * fill, 30, i === rows.length - 1 ? C.accent : '#658B85', 3);
    label(ctx, row.daysPerLaunch === null ? '—' : row.daysPerLaunch.toFixed(1), barX + barW + 28, yy + 27, 35, i === rows.length - 1 ? C.accent : C.text, 650);
    const detail = `${row.observedDays} days / ${row.count} launches`;
    label(ctx, detail, portrait ? p : w - p, portrait ? y + Math.min(124, rowH * .78) : y + 20, portrait ? Math.min(25, rowH * .19) : 22, C.muted, 500, portrait ? 'left' : 'right');
    if (portrait && row.partial && rowH > 180) label(ctx, `Observation ends ${row.end}`, p, y + 159, 21, C.dim);
  });
  const noteY = portrait ? 1532 : 916;
  label(ctx, 'This is launch density, not a measured development cycle.', p, noteY, portrait ? 25 : 25, C.text);
  label(ctx, 'The result changes when the selection changes.', p, noteY + 39, portrait ? 25 : 25, C.muted);
  if (portrait) {
    line(ctx, p, noteY + 91, w - p, noteY + 91);
    label(ctx, 'EDIT THE DATA. REPLAY THE STORY.', p, noteY + 146, 26, C.accent, 650);
    label(ctx, 'crosscore / frontier-model-release-timeline', p, noteY + 193, 23, C.muted);
  }
}

export function drawFrame(ctx, data, timeline, seconds, format = 'landscape') {
  const { width: w, height: h } = FORMATS[format], portrait = format === 'portrait', p = 72;
  const state = stateAt(timeline, seconds);
  background(ctx, w, h); brand(ctx, w, portrait, data);
  if (state.mode === 'intro') intro(ctx, data, timeline, state, w, h, portrait);
  else if (state.mode === 'outro') summary(ctx, data, state, w, h, portrait);
  else {
    const year = stateYear(state), visible = visibleEvents(data, timeline, seconds), current = visible.filter(e => Number(e.date.slice(0, 4)) === year);
    if (portrait) {
      yearMetrics(ctx, data, year, current.length, { x: p, y: 286, w: w - p * 2 }, true);
      label(ctx, dateLabel(iso(state.day)), w - p, 588, 24, C.accent, 650, 'right');
      timelineChart(ctx, data, timeline, state, { x: p, y: 627, w: w - p * 2, h: 550 }, year, visible);
      data.labs.forEach((lab, i) => eventCard(ctx, lab, current.filter(e => e.lab === lab.id).at(-1), p, 1207 + i * 198, w - p * 2, 175, state, timeline, true));
      label(ctx, 'POSITION = DATE · HEIGHT ≠ CAPABILITY', p, 1658, 22, C.muted);
      miniMap(ctx, data, state.day, p, 1720, w - p * 2, 60);
    } else {
      const chartW = 1240;
      label(ctx, dateLabel(iso(state.day)), p + chartW, 306, 24, C.accent, 650, 'right');
      label(ctx, 'MODEL LAUNCHES / CALENDAR VIEW', p, 306, 21, C.muted, 650);
      timelineChart(ctx, data, timeline, state, { x: p, y: 334, w: chartW, h: 395 }, year, visible);
      yearMetrics(ctx, data, year, current.length, { x: 1374, y: 266, w: 474 }, false);
      data.labs.forEach((lab, i) => eventCard(ctx, lab, current.filter(e => e.lab === lab.id).at(-1), p + i * 631, 750, 609, 164, state, timeline, false));
      miniMap(ctx, data, state.day, 1374, 885, 474, 38);
    }
  }
  footer(ctx, w, h, data, portrait);
  rect(ctx, 0, h - 4, w * clamp(seconds / timeline.duration), 4, C.accent);
  return state;
}
