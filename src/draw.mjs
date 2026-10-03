import { day, iso, yearlyStats } from './data.mjs';
import { clamp, smooth, stateAt, stateYear, visibleEvents, calendarPosition } from './timeline.mjs';

export const FORMATS = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1920 } };
export const FIREWORK = Object.freeze({ rise: .36, life: 1.9, rays: 68 });
const C = { bg: '#050A14', text: '#F4F3EE', muted: '#ABB7C9', dim: '#697C94', line: '#263348', gold: '#E5D9B4' };
const TAU = Math.PI * 2;
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const labIndex = (data, id) => data.labs.findIndex(lab => lab.id === id);
// Shared stage geometry. Each lab owns one altitude lane; every burst keeps the same radius.
export function skyBox(format) {
  return format === 'portrait' ? { x: 100, y: 1154, w: 880, riseHeight: 470, radius: 200 } : { x: 100, y: 653, w: 1720, riseHeight: 300, radius: 150 };
}
const rgba = (hex, a) => `${hex}${Math.round(clamp(a) * 255).toString(16).padStart(2, '0')}`;
export function seeded(seed) {
  let a = typeof seed === 'number' ? seed : [...seed].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261);
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function label(ctx, value, x, y, size = 26, color = C.text, weight = 500, align = 'left') {
  ctx.font = `${Math.round(weight / 100) * 100} ${size}px Manrope${weight >= 600 ? 600 : 500}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y);
}
function fit(ctx, value, x, y, width, size = 30, color = C.text) {
  ctx.font = `500 ${size}px Manrope500`;
  while (ctx.measureText(value).width > width && size > 14) { size--; ctx.font = `500 ${size}px Manrope500`; }
  label(ctx, value, x, y, size, color);
}
function line(ctx, x1, y1, x2, y2, color = C.line, width = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function rect(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
function circle(ctx, x, y, radius, color, hollow = false) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, radius), 0, TAU);
  if (hollow) { ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
}
function glow(ctx, x, y, radius, color, strength = .3) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(color, strength)); g.addColorStop(.23, rgba(color, strength * .28)); g.addColorStop(1, rgba(color, 0));
  rect(ctx, x - radius, y - radius, radius * 2, radius * 2, g);
}
function background(ctx, w, h, t) {
  rect(ctx, 0, 0, w, h, C.bg);
  glow(ctx, w * .2, h * .43, w * .72, '#285879', .16);
  glow(ctx, w * .85, h * .55, w * .6, '#523D69', .13);
  const rng = seeded(40);
  for (let i = 0; i < 95; i++) {
    const x = 36 + rng() * (w - 72), y = 170 + rng() * (h * .49), r = .4 + rng() * .9;
    circle(ctx, x, y, r, rgba('#ADCEEE', .09 + .13 * (1 + Math.sin(t * .5 + i)) / 2));
  }
}
function header(ctx, w, portrait, data) {
  label(ctx, 'FRONTIER OBSERVATORY', 64, 58, 18, C.gold, 600);
  label(ctx, 'The frontier, ignited.', 64, portrait ? 137 : 127, portrait ? 62 : 58, C.text, 600);
  const step = portrait ? 236 : 190, ly = portrait ? 204 : 84, lx = portrait ? 65 : 1866 - step * data.labs.length;
  data.labs.forEach((lab, i) => {
    circle(ctx, lx + i * step, ly - 7, 5, lab.color);
    label(ctx, lab.name, lx + 16 + i * step, ly, 24, lab.color);
  });
  if (!portrait) label(ctx, `${data.releases.length} SELECTED LAUNCHES · ${data.startDate.slice(0, 4)}—${data.endDate.slice(0, 4)}`, 1848, 126, 19, C.muted, 500, 'right');
}
function footer(ctx, data, w, h, portrait) {
  line(ctx, 64, h - 67, w - 64, h - 67);
  label(ctx, `CURATED ${data.labs.map(lab => lab.name.toUpperCase()).join(' + ')} · THROUGH ${data.endDate}`, 64, h - 31, portrait ? 18 : 19, C.muted);
  if (!portrait) label(ctx, 'Official sources & selection rules in repository', w - 64, h - 31, 19, C.dim, 500, 'right');
}
export function activeFireworks(data, timeline, time) {
  return data.releases.filter(e => { const age = time - timeline.onsets.get(e.id); return age >= -FIREWORK.rise && age < FIREWORK.life; });
}
export function eventPose(data, event, box) {
  const year = Number(event.date.slice(0, 4)), events = data.releases.filter(e => e.date.startsWith(String(year)));
  const index = events.findIndex(e => e.id === event.id); let start = index, end = index;
  while (start > 0 && day(events[start].date) - day(events[start - 1].date) <= 14) start--;
  while (end < events.length - 1 && day(events[end + 1].date) - day(events[end].date) <= 14) end++;
  const group = events.slice(start, end + 1), slot = index - start;
  const origin = box.x + calendarPosition(event.date, year) * box.w;
  const mean = group.reduce((n, e) => n + calendarPosition(e.date, year), 0) / group.length;
  const span = Math.min(box.w - box.radius * 2, Math.max(0, group.length - 1) * box.radius * 1.16);
  const center = clamp(box.x + mean * box.w, box.x + box.radius + span / 2, box.x + box.w - box.radius - span / 2);
  const bx = center + (group.length > 1 ? slot / (group.length - 1) - .5 : 0) * span;
  const by = box.y - box.riseHeight + labIndex(data, event.lab) * box.radius * .4;
  return { origin, bx, by, slot };
}
function ember(ctx, data, event, box, opacity) {
  const { bx, by } = eventPose(data, event, box), c = data.labs.find(l => l.id === event.lab).color;
  glow(ctx, bx, by, 22, c, opacity * .35);
  circle(ctx, bx, by, 2.3, rgba(c, opacity));
  line(ctx, bx - 6, by, bx + 6, by, rgba(c, opacity * .5));
  line(ctx, bx, by - 6, bx, by + 6, rgba(c, opacity * .5));
}
function rocket(ctx, data, e, lab, age, box) {
  // Style follows the lab, never the event: peony, glitter chrysanthemum, double ring.
  const rand = seeded(e.id), { origin, bx, by } = eventPose(data, e, box), style = labIndex(data, e.lab) % 3;
  const height = box.y - by, radius = box.radius;
  const flight = q => ({ x: origin + (bx - origin) * q, y: box.y - height * (1 - (1 - q) ** 1.7) });
  const c = lab.color;
  if (age < FIREWORK.rise) {
    const q = clamp(age / FIREWORK.rise), head = flight(q);
    for (let j = 0; j < 24; j++) {
      const f = Math.max(0, q - j * .014), p1 = flight(f), p2 = flight(Math.max(0, f - .014));
      line(ctx, p1.x, p1.y, p2.x, p2.y, rgba(c, (1 - j / 24) * .8), 2.5 * (1 - j / 30));
    }
    glow(ctx, head.x, head.y, 30, c, .55); circle(ctx, head.x, head.y, 3, '#FFFFFF');
    return;
  }
  const t = age - FIREWORK.rise, fade = (1 - clamp(t / FIREWORK.life)) ** 1.5;
  if (fade <= 0) return;
  glow(ctx, bx, by, radius * 1.4, c, .25 * Math.exp(-t * 1.4));
  // Local bloom only, never a full-frame white flash.
  const impulse = Math.exp(-t * 10);
  circle(ctx, bx, by, 4 + 11 * (1 - impulse), rgba('#FFF3DB', impulse * .65), true);
  for (let i = 0; i < FIREWORK.rays; i++) {
    const angle = i / FIREWORK.rays * TAU + (rand() - .5) * .08;
    const speed = style === 2 ? (i % 2 ? .94 + rand() * .05 : .5 + rand() * .05) : .76 + rand() * .25;
    const gravity = 19 + rand() * 8, tail = style === 1 ? .17 + rand() * .08 : style === 2 ? .07 : .10 + rand() * .055;
    const at = sec => {
      const r = radius * speed * (1 - Math.exp(-sec * 3.4));
      return { x: bx + Math.cos(angle) * r, y: by + Math.sin(angle) * r + gravity * sec * sec };
    };
    const head = at(t), prev = at(Math.max(0, t - tail));
    const sparkle = .68 + .32 * Math.sin(t * 13 + i * 2.3) ** 2;
    line(ctx, prev.x, prev.y, head.x, head.y, rgba(c, fade * sparkle), i % 5 ? 2.4 : 3.2);
    circle(ctx, head.x, head.y, i % 7 === 0 ? 2.1 : 1.4, rgba(i % 5 === 0 ? '#FFF3DB' : c, fade));
    if (i % 3 === 0 && t > .32) {
      const extra = at(Math.max(0, t - .17));
      circle(ctx, extra.x, extra.y, .75, rgba('#FCDFB1', fade * .5));
    }
    if (style === 1 && i % 2 === 0 && t > .22 && Math.sin(t * 47 + i * 1.9) > .2) {
      const glint = at(Math.max(0, t - .05));
      circle(ctx, glint.x + Math.cos(i * 7.1) * 5, glint.y + Math.sin(i * 3.7) * 5, 1.3, rgba('#FFF3DB', fade * .85));
    }
  }
  const tailFade = Math.exp(-t * 3) * .4;
  line(ctx, origin, box.y, bx, by, rgba(c, tailFade), 1);
}
function sky(ctx, data, timeline, state, year, box, visible, portrait) {
  const current = (state.day - day(`${year}-01-01`)) / (day(`${year + 1}-01-01`) - day(`${year}-01-01`));
  label(ctx, String(year), 64, portrait ? 396 : 284, portrait ? 142 : 124, '#8394AB', 500);
  const count = visible.filter(e => e.date.startsWith(String(year))).length;
  label(ctx, `${String(count).padStart(2, '0')} launches`, portrait ? 1016 : 1848, portrait ? 333 : 214, portrait ? 34 : 30, C.text, 500, 'right');
  label(ctx, `${months[Number(iso(state.day).slice(5, 7)) - 1]} ${year}`, portrait ? 1016 : 1848, portrait ? 378 : 256, 25, C.muted, 500, 'right');
  if (year === Number(data.endDate.slice(0, 4))) label(ctx, `YTD · THROUGH ${data.endDate.slice(5)}`, 68, portrait ? 449 : 326, 20, C.gold);
  glow(ctx, box.x + box.w * .5, box.y, box.w * .7, '#407685', .15);
  // The stage clips particles only; typography lives outside it.
  ctx.save(); ctx.beginPath(); ctx.rect(box.x - 50, portrait ? 480 : 205, box.w + 100, box.y - (portrait ? 480 : 205)); ctx.clip();
  for (const e of visible) ember(ctx, data, e, box, e.date.startsWith(String(year)) ? .4 : .16);
  for (const event of activeFireworks(data, timeline, state.time)) {
    const age = state.time - timeline.onsets.get(event.id) + FIREWORK.rise;
    rocket(ctx, data, event, data.labs.find(l => l.id === event.lab), age, box);
  }
  ctx.restore();
  line(ctx, box.x, box.y, box.x + box.w, box.y, '#42506B');
  const cut = calendarPosition(iso(day(data.endDate) + 1), year);
  if (cut < 1) {
    const from = box.x + Math.max(0, cut) * box.w;
    for (let x = from; x < box.x + box.w; x += 16) line(ctx, x, box.y - 4, x + 5, box.y + 4, C.dim);
    label(ctx, 'UNOBSERVED', box.x + box.w, box.y + 61, portrait ? 27 : 17, C.muted, 500, 'right');
  }
  for (let m = 0; m < 12; m++) {
    const x = box.x + calendarPosition(`${year}-${String(m + 1).padStart(2, '0')}-01`, year) * box.w;
    line(ctx, x, box.y, x, box.y + 9, '#697B93');
    if (!portrait || m % 3 === 0) label(ctx, months[m], x, box.y + 35, portrait ? 30 : 18, C.muted);
  }
  for (const e of visible.filter(e => e.date.startsWith(String(year)))) {
    const x = box.x + calendarPosition(e.date, year) * box.w, lab = data.labs.find(l => l.id === e.lab), offset = (labIndex(data, e.lab) - (data.labs.length - 1) / 2) * 8;
    circle(ctx, x, box.y + offset, 3.5, lab.color, e.stage === 'preview');
  }
  const cursor = box.x + clamp(current) * box.w;
  line(ctx, cursor, box.y - 19, cursor, box.y + 15, C.gold, 2);
  circle(ctx, cursor, box.y, 3, C.text);
}
export function modelLabel(event, portrait = false) {
  const full = event.name + (event.stage === 'preview' ? ' *' : '');
  return portrait ? full.replace(/^Claude (?=[A-Za-z])/, '') : full;
}
function ledger(ctx, data, visible, timeline, state, year, w, portrait) {
  const n = data.labs.length, p = 64, gap = portrait ? (n > 2 ? 30 : 42) : (n > 2 ? 60 : 90), col = (w - 2 * p - gap * (n - 1)) / n, nameX = n > 2 ? 150 : 165;
  const y = portrait ? 1262 : 767, rowH = portrait ? 91 : 49;
  data.labs.forEach((lab, i) => {
    const x = p + i * (col + gap), all = visible.filter(e => e.lab === lab.id), events = all.slice(-4);
    circle(ctx, x + 5, y - 7, 5, lab.color);
    label(ctx, lab.name.toUpperCase(), x + 24, y, portrait ? 30 : 23, lab.color, 600);
    if (!portrait || n === 2) label(ctx, 'RECENT LAUNCHES', x + col, y, portrait ? 21 : 19, C.dim, 500, 'right');
    line(ctx, x, y + 16, x + col, y + 16);
    events.forEach(event => {
      // Four fixed slots: an arrival replaces only the oldest slot, never moves other labels.
      const j = all.indexOf(event) % 4, yy = y + (portrait ? 54 : 58) + j * rowH;
      const age = state.time - timeline.onsets.get(event.id), newest = event === all.at(-1);
      if (age < 1.2) rect(ctx, x - 9, yy - (portrait ? 26 : 30), col + 18, portrait ? 82 : 44, rgba(lab.color, .1 * (1 - age / 1.2)));
      label(ctx, event.date.replaceAll('-', '.'), x, yy, portrait ? 30 : 22, newest ? C.text : C.muted);
      const model = modelLabel(event, portrait);
      fit(ctx, model, portrait ? x : x + nameX, yy + (portrait ? 47 : 0), portrait ? col : col - nameX, portrait ? 43 : 34, C.text);
      if (newest) circle(ctx, x + col - 5, yy - (portrait ? 9 : 12), 3, lab.color);
    });
  });
}
function intro(ctx, data, timeline, state, w, h, portrait) {
  const progress = smooth(state.progress * 2.5), y = portrait ? 708 : 417;
  ctx.save(); ctx.globalAlpha = progress;
  label(ctx, 'NEW MODELS.', 64, y, portrait ? 106 : 120, C.text, 500);
  label(ctx, 'LESS QUIET.', 64, y + (portrait ? 127 : 136), portrait ? 106 : 120, C.gold, 500);
  label(ctx, 'One launch. One spark.', 69, y + (portrait ? 239 : 232), portrait ? 37 : 37, C.muted);
  label(ctx, 'Each release leaves an ember.', 69, y + (portrait ? 302 : 290), portrait ? 29 : 30, C.muted);
  const sy = portrait ? 1207 : 790;
  const gx = 64 + (w - 128) * smooth(state.progress);
  glow(ctx, gx, sy, portrait ? 200 : 270, data.labs[0].color, .35);
  const g = ctx.createLinearGradient(64, sy, w - 64, sy);
  data.labs.forEach((lab, i) => g.addColorStop(i / (data.labs.length - 1), lab.color));
  line(ctx, 64, sy, w - 64, sy, '#364256'); line(ctx, 64, sy, gx, sy, g, 2);
  circle(ctx, gx, sy, 4, C.text);
  label(ctx, `${data.startDate.slice(0, 4)} — ${data.endDate.slice(0, 4)}`, 64, sy + 83, 34, C.text);
  label(ctx, `${data.releases.length} selected launches · ${['', 'one', 'two', 'three'][data.labs.length]} labs · official sources`, 64, sy + 134, portrait ? 27 : 29, C.muted);
  ctx.restore();
}
function ending(ctx, data, state, w, h, portrait) {
  const rows = yearlyStats(data), first = rows[0], last = rows.at(-1), p = 64;
  const box = skyBox(portrait ? 'portrait' : 'landscape');
  for (const e of data.releases) ember(ctx, data, e, box, .19);
  label(ctx, 'The quiet is getting shorter.', p, portrait ? 363 : 285, portrait ? 49 : 58, C.text);
  const valueY = portrait ? 596 : 460, rightX = portrait ? 577 : 1002;
  label(ctx, first.daysPerLaunch?.toFixed(0) ?? '—', p, valueY, portrait ? 164 : 166, C.text);
  label(ctx, '→', portrait ? 403 : 640, valueY - 23, 76, C.dim);
  label(ctx, last.daysPerLaunch?.toFixed(1) ?? '—', rightX, valueY, portrait ? 136 : 166, C.gold);
  label(ctx, String(first.year), p + 5, valueY + 54, 27, C.muted);
  label(ctx, `${last.year}${last.partial ? ' YTD' : ''}`, rightX + 4, valueY + 54, 27, C.muted);
  label(ctx, 'CALENDAR DAYS / SELECTED LAUNCH', p, valueY + 118, portrait ? 23 : 25, C.gold);
  const top = portrait ? 903 : 680, step = portrait ? Math.min(126, 680 / rows.length) : Math.min(55, 230 / rows.length);
  const max = Math.max(1, ...rows.map(r => r.daysPerLaunch ?? 0));
  for (const [i, row] of rows.entries()) {
    const y = top + i * step, bx = portrait ? 278 : 315, bw = portrait ? 535 : 1040;
    label(ctx, String(row.year) + (row.partial ? ' YTD' : ''), p, y + 18, portrait ? 27 : 24, C.muted);
    line(ctx, bx, y + 5, bx + bw, y + 5, '#1B293C', 7);
    line(ctx, bx, y + 5, bx + bw * (row.daysPerLaunch ?? 0) / max * smooth(state.progress * 3), y + 5, i === rows.length - 1 ? C.gold : '#739EAD', 7);
    label(ctx, row.daysPerLaunch?.toFixed(1) ?? '—', bx + bw + 26, y + 18, portrait ? 30 : 28, C.text);
    if (portrait) label(ctx, `${row.observedDays} days / ${row.count} launches`, bx, y + 55, 22, C.dim);
    else label(ctx, `${row.observedDays} days / ${row.count} launches`, w - 64, y + 18, 21, C.dim, 500, 'right');
  }
  const ny = portrait ? 1540 : 952;
  label(ctx, 'Launch density, not development time.', p, ny, portrait ? 30 : 27, C.text);
  label(ctx, 'A curated sample. Changing the selection changes the result.', p, ny + 43, portrait ? 23 : 22, C.muted);
  if (portrait) { label(ctx, 'EDIT THE DATA. REPLAY THE SKY.', p, 1716, 29, C.gold); label(ctx, 'crosscore / frontier-model-release-timeline', p, 1763, 23, C.dim); }
}
export function drawFrame(ctx, data, timeline, seconds, format = 'landscape') {
  const { width: w, height: h } = FORMATS[format], portrait = format === 'portrait', state = stateAt(timeline, seconds);
  background(ctx, w, h, seconds); header(ctx, w, portrait, data);
  if (state.mode === 'intro') intro(ctx, data, timeline, state, w, h, portrait);
  else if (state.mode === 'outro') ending(ctx, data, state, w, h, portrait);
  else {
    const year = stateYear(state), visible = visibleEvents(data, timeline, seconds);
    sky(ctx, data, timeline, state, year, skyBox(format), visible, portrait);
    if (portrait) { label(ctx, '1 BURST = 1 LAUNCH', 64, 1718, 30, C.muted); label(ctx, `Constant calendar speed · ${data.labs.length} selected labs`, 64, 1761, 28, C.muted); }
    else label(ctx, 'ONE BURST = ONE LAUNCH · CONSTANT CALENDAR SPEED', 64, 709, 19, C.muted);
    ledger(ctx, data, visible, timeline, state, year, w, portrait);
    if (portrait) { label(ctx, '* PREVIEW · LANE = LAB · SIZE ≠ CAPABILITY', 64, 1810, 24, C.muted); }
    else label(ctx, '* PREVIEW · LANE = LAB · SIZE ≠ CAPABILITY', 64, 1010, 19, C.muted);
  }
  footer(ctx, data, w, h, portrait);
  rect(ctx, 0, h - 3, w * clamp(seconds / timeline.duration), 3, C.gold);
  return state;
}
