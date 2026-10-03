import { day, iso, yearOf, yearlyStats } from './data.mjs';
import { clamp, smooth, stateAt, stateYear, visibleEvents } from './timeline.mjs';

export const FORMATS = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1920 } };
export const FIREWORK = Object.freeze({ rise: .36, life: 1.9, rays: 68 });
const C = { bg: '#050A14', text: '#F4F3EE', muted: '#ABB7C9', dim: '#697C94', line: '#263348', gold: '#E5D9B4' };
const TAU = Math.PI * 2;
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const labIndex = (data, id) => data.labs.findIndex(lab => lab.id === id);
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
  if (!portrait) label(ctx, `ECI: ${data.capability.publisher}, ${data.capability.license} · retrieved ${data.capability.retrievedOn}`, w - 64, h - 31, 19, C.dim, 500, 'right');
}
export function activeFireworks(data, timeline, time) {
  return data.releases.filter(e => { const age = time - timeline.onsets.get(e.id); return age >= -FIREWORK.rise && age < FIREWORK.life; });
}
// Shared chart geometry: x is the calendar date, y the launched model's ECI score. Every burst keeps the same radius.
export function chartBox(format) {
  return format === 'portrait' ? { x: 150, y: 1130, w: 866, top: 300, radius: 125 } : { x: 140, y: 650, w: 1716, top: 190, radius: 110 };
}
export const scoreOf = event => Number.isFinite(event.capability?.score) ? event.capability.score : null;
export function chartScale(data, box) {
  const scores = data.releases.map(scoreOf).filter(v => v !== null);
  const lo = scores.length ? Math.floor((Math.min(...scores) - 4) / 10) * 10 : 100;
  const hi = scores.length ? Math.ceil((Math.max(...scores) + 8) / 10) * 10 : 150;
  const from = day(`${yearOf(data.startDate)}-01-01`), to = day(`${yearOf(data.endDate) + 1}-01-01`);
  return { lo, hi, x: value => box.x + ((typeof value === 'string' ? day(value) : value) - from) / (to - from) * box.w,
    y: score => box.y - (score - lo) / (hi - lo) * (box.y - box.top) };
}
// A scored launch climbs straight up from its date and bursts at its score; an unscored one stays on the axis.
export function eventPose(data, event, box) {
  const scale = chartScale(data, box), x = scale.x(event.date), score = scoreOf(event);
  return { origin: x, bx: x, by: score === null ? box.y : scale.y(score), scored: score !== null };
}
function marker(ctx, data, event, box, opacity, size) {
  const { bx, by } = eventPose(data, event, box), c = data.labs.find(l => l.id === event.lab).color, shape = labIndex(data, event.lab) % 3;
  ctx.beginPath();
  if (shape === 0) ctx.arc(bx, by, size, 0, TAU);
  else if (shape === 1) { const d = size * 1.35; ctx.moveTo(bx, by - d); ctx.lineTo(bx + d, by); ctx.lineTo(bx, by + d); ctx.lineTo(bx - d, by); ctx.closePath(); }
  else ctx.rect(bx - size * .9, by - size * .9, size * 1.8, size * 1.8);
  ctx.fillStyle = event.stage === 'preview' ? rgba(C.bg, opacity) : rgba(c, opacity); ctx.fill();
  if (event.stage === 'preview') { ctx.strokeStyle = rgba(c, opacity); ctx.lineWidth = 2; ctx.stroke(); }
}
// Each lab's best score so far, as a step line that climbs when a launch sets a new high.
function frontierLines(ctx, data, timeline, visible, box, time, nowX, opacity, width) {
  const scale = chartScale(data, box);
  for (const lab of data.labs) {
    let level = null;
    ctx.beginPath();
    for (const e of visible) {
      if (e.lab !== lab.id || scoreOf(e) === null) continue;
      const x = scale.x(e.date), y = scale.y(scoreOf(e));
      if (level === null) { ctx.moveTo(x, y); level = y; continue; }
      if (y >= level) continue;
      ctx.lineTo(x, level); level += (y - level) * easeOut((time - timeline.onsets.get(e.id)) / .3); ctx.lineTo(x, level);
    }
    if (level === null) continue;
    ctx.lineTo(nowX, level);
    ctx.strokeStyle = rgba(lab.color, opacity); ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke();
  }
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
// Launches without a published score spray a low fountain from their date instead of claiming a height.
function fountain(ctx, e, lab, age, box, x) {
  const rand = seeded(e.id), c = lab.color, r = box.radius;
  if (age < FIREWORK.rise) {
    const q = clamp(age / FIREWORK.rise);
    glow(ctx, x, box.y, 16 + 18 * q, c, .2 + .35 * q); circle(ctx, x, box.y - 2, 2.5, '#FFFFFF');
    return;
  }
  const t = age - FIREWORK.rise, fade = (1 - clamp(t / FIREWORK.life)) ** 1.3;
  if (fade <= 0) return;
  glow(ctx, x, box.y, r * .7, c, .22 * Math.exp(-t * 1.6));
  for (let i = 0; i < 46; i++) {
    const birth = rand() * .95, angle = -Math.PI / 2 + (rand() - .5) * .75, speed = r * (2.3 + rand() * .7);
    const at = s => ({ x: x + Math.cos(angle) * speed * s, y: box.y + Math.sin(angle) * speed * s + r * 3.6 * s * s });
    const s = t - birth;
    if (s < 0 || s > .8) continue;
    const head = at(s), prev = at(Math.max(0, s - .07)), life = 1 - s / .8;
    line(ctx, prev.x, prev.y, head.x, head.y, rgba(c, fade * life), 2);
    circle(ctx, head.x, head.y, 1.4, rgba(i % 4 ? c : '#FFF3DB', fade * life));
  }
}
function chart(ctx, data, timeline, state, year, box, visible, portrait) {
  const scale = chartScale(data, box), nowX = scale.x(state.day), end = scale.x(iso(day(data.endDate) + 1));
  for (let v = scale.lo; v <= scale.hi; v += 10) {
    const y = scale.y(v);
    line(ctx, box.x, y, box.x + box.w, y, v === scale.lo ? '#42506B' : '#17233A');
    label(ctx, String(v), box.x - 16, y + (portrait ? 8 : 6), portrait ? 24 : 17, C.dim, 500, 'right');
  }
  label(ctx, `${data.capability.index.toUpperCase()} · HIGHER = MORE CAPABLE`, box.x, box.top - (portrait ? 18 : 16), portrait ? 21 : 17, C.gold, 600);
  // Early scores sit low, so the upper left of the plot stays free for the year counter.
  const counter = portrait ? { x: box.x + 30, y: 440, size: 124, sub: 490, ytd: 532 } : { x: box.x + 32, y: 302, size: 104, sub: 346, ytd: 382 };
  label(ctx, String(year), counter.x, counter.y, counter.size, '#8394AB', 500);
  const count = visible.filter(e => e.date.startsWith(String(year))).length;
  label(ctx, `${months[Number(iso(state.day).slice(5, 7)) - 1]} · ${count} ${count === 1 ? 'LAUNCH' : 'LAUNCHES'}`, counter.x + 4, counter.sub, portrait ? 30 : 25, C.text, 500);
  if (year === yearOf(data.endDate)) label(ctx, `YTD · THROUGH ${data.endDate.slice(5)}`, counter.x + 4, counter.ytd, portrait ? 22 : 20, C.gold);
  glow(ctx, box.x + box.w * .5, box.y, box.w * .7, '#407685', .15);
  // The plot clips particles only; typography lives outside it.
  ctx.save(); ctx.beginPath(); ctx.rect(0, portrait ? 250 : 150, portrait ? 1080 : 1920, box.y + 4 - (portrait ? 250 : 150)); ctx.clip();
  line(ctx, nowX, box.top, nowX, box.y, rgba(C.gold, .16));
  frontierLines(ctx, data, timeline, visible, box, state.time, nowX, .62, portrait ? 3 : 2.2);
  const latest = new Set(data.labs.map(lab => visible.filter(e => e.lab === lab.id && scoreOf(e) !== null).at(-1)));
  for (const e of visible) if (scoreOf(e) !== null) {
    if (latest.has(e)) { const { bx, by } = eventPose(data, e, box); glow(ctx, bx, by, portrait ? 30 : 22, data.labs.find(l => l.id === e.lab).color, .35); }
    marker(ctx, data, e, box, latest.has(e) ? .95 : .6, portrait ? 6.5 : 4.8);
  }
  for (const event of activeFireworks(data, timeline, state.time)) {
    const age = state.time - timeline.onsets.get(event.id) + FIREWORK.rise, lab = data.labs.find(l => l.id === event.lab);
    if (scoreOf(event) === null) fountain(ctx, event, lab, age, box, scale.x(event.date)); else rocket(ctx, data, event, lab, age, box);
  }
  ctx.restore();
  if (end < box.x + box.w) {
    for (let x = end; x < box.x + box.w; x += 16) line(ctx, x, box.y - 4, x + 5, box.y + 4, C.dim);
    label(ctx, 'UNOBSERVED', box.x + box.w, box.y + (portrait ? 74 : 61), portrait ? 22 : 17, C.muted, 500, 'right');
  }
  for (let y = yearOf(data.startDate); y <= yearOf(data.endDate) + 1; y++) {
    const x = scale.x(`${y}-01-01`);
    line(ctx, x, box.y, x, box.y + 12, '#697B93');
    if (y <= yearOf(data.endDate)) label(ctx, String(y), x + 8, box.y + (portrait ? 40 : 35), portrait ? 26 : 18, C.muted);
    if (y <= yearOf(data.endDate)) for (const m of [4, 7, 10]) { const q = scale.x(`${y}-${String(m).padStart(2, '0')}-01`); line(ctx, q, box.y, q, box.y + 6, '#3A4860'); }
  }
  for (const e of visible) {
    const lab = data.labs.find(l => l.id === e.lab), offset = (labIndex(data, e.lab) - (data.labs.length - 1) / 2) * 8;
    circle(ctx, scale.x(e.date), box.y + offset, 3.5, lab.color, e.stage === 'preview');
  }
  line(ctx, nowX, box.y - 19, nowX, box.y + 15, C.gold, 2);
  circle(ctx, nowX, box.y, 3, C.text);
}
export function modelLabel(event, portrait = false) {
  const full = event.name + (event.stage === 'preview' ? ' *' : '');
  return portrait ? full.replace(/^Claude (?=[A-Za-z])/, '') : full;
}
// Newest first. An arrival enters at the top and pushes older names down one row; the fifth fades out.
const PUSH_SECONDS = .28, easeOut = x => 1 - (1 - clamp(x)) ** 3;
export function ledgerRows(events, timeline, time) {
  const eased = events.map(e => easeOut((time - timeline.onsets.get(e.id)) / PUSH_SECONDS));
  let below = Infinity;
  // Oldest first: each name sits one row lower for every later arrival, and a newer name never
  // comes closer than one row above the name below it, so rows cannot overlap mid-animation.
  return events.map((event, k) => {
    const row = Math.min(eased.slice(k + 1).reduce((sum, v) => sum + v, 0) - (1 - eased[k]), below - 1);
    below = row;
    return { event, row, alpha: Math.min(clamp((row + .5) / .5), clamp((3.25 - row) / .25)) };
  });
}
function ledger(ctx, data, visible, timeline, state, year, w, portrait) {
  const n = data.labs.length, p = 64, gap = portrait ? (n > 2 ? 30 : 42) : (n > 2 ? 60 : 90), col = (w - 2 * p - gap * (n - 1)) / n, nameX = n > 2 ? 150 : 165;
  const y = portrait ? 1262 : 767, rowH = portrait ? 91 : 49, top = y + (portrait ? 54 : 58);
  data.labs.forEach((lab, i) => {
    const x = p + i * (col + gap), all = visible.filter(e => e.lab === lab.id), newest = all.at(-1);
    circle(ctx, x + 5, y - 7, 5, lab.color);
    label(ctx, lab.name.toUpperCase(), x + 24, y, portrait ? 30 : 23, lab.color, 600);
    if (!portrait || n === 2) label(ctx, 'NEWEST FIRST · ECI', x + col, y, portrait ? 21 : 19, C.dim, 500, 'right');
    line(ctx, x, y + 16, x + col, y + 16);
    ctx.save(); ctx.beginPath(); ctx.rect(x - 12, y + 17, col + 24, top - y - 17 + 3.25 * rowH + (portrait ? 61 : 12)); ctx.clip();
    for (const { event, row, alpha } of ledgerRows(all.slice(-6), timeline, state.time)) {
      if (alpha <= .01) continue;
      const yy = top + row * rowH, age = state.time - timeline.onsets.get(event.id), latest = event === newest;
      ctx.globalAlpha = alpha;
      if (age < 1.2) rect(ctx, x - 9, yy - (portrait ? 26 : 30), col + 18, portrait ? 82 : 44, rgba(lab.color, .1 * (1 - age / 1.2)));
      // Text that would sit above the list's clip edge stays undrawn until it slides into view.
      const shown = (baseline, size) => baseline - size * .75 >= y + 17;
      if (shown(yy, portrait ? 30 : 22)) label(ctx, event.date.replaceAll('-', '.'), x, yy, portrait ? 30 : 22, latest ? C.text : C.muted);
      if (shown(yy + (portrait ? 47 : 0), portrait ? 43 : 34)) fit(ctx, modelLabel(event, portrait), portrait ? x : x + nameX, yy + (portrait ? 47 : 0), portrait ? col : col - nameX - 88, portrait ? 43 : 34, C.text);
      if (shown(yy, portrait ? 30 : 26)) label(ctx, scoreOf(event) === null ? '—' : String(Math.round(scoreOf(event))), x + col, yy, portrait ? 30 : 26, latest ? lab.color : C.muted, 500, 'right');
    }
    ctx.restore();
  });
}
function intro(ctx, data, timeline, state, w, h, portrait) {
  const progress = smooth(state.progress * 2.5), y = portrait ? 708 : 417;
  ctx.save(); ctx.globalAlpha = progress;
  label(ctx, 'NEW MODELS.', 64, y, portrait ? 106 : 120, C.text, 500);
  label(ctx, 'LESS QUIET.', 64, y + (portrait ? 127 : 136), portrait ? 106 : 120, C.gold, 500);
  label(ctx, 'One launch. One spark.', 69, y + (portrait ? 239 : 232), portrait ? 37 : 37, C.muted);
  label(ctx, 'Each burst lands at its capability score.', 69, y + (portrait ? 302 : 290), portrait ? 29 : 30, C.muted);
  const sy = portrait ? 1207 : 790;
  const gx = 64 + (w - 128) * smooth(state.progress);
  glow(ctx, gx, sy, portrait ? 200 : 270, data.labs[0].color, .35);
  const g = ctx.createLinearGradient(64, sy, w - 64, sy);
  data.labs.forEach((lab, i) => g.addColorStop(i / (data.labs.length - 1), lab.color));
  line(ctx, 64, sy, w - 64, sy, '#364256'); line(ctx, 64, sy, gx, sy, g, 2);
  circle(ctx, gx, sy, 4, C.text);
  label(ctx, `${data.startDate.slice(0, 4)} — ${data.endDate.slice(0, 4)}`, 64, sy + 83, 34, C.text);
  label(ctx, `${data.releases.length} selected launches · ${['', 'one', 'two', 'three'][data.labs.length]} labs · scores from ${data.capability.publisher}`, 64, sy + 134, portrait ? 27 : 29, C.muted);
  ctx.restore();
}
function ending(ctx, data, timeline, state, w, h, portrait) {
  const rows = yearlyStats(data), first = rows[0], last = rows.at(-1), p = 64;
  const box = chartBox(portrait ? 'portrait' : 'landscape');
  frontierLines(ctx, data, timeline, data.releases, box, Infinity, chartScale(data, box).x(data.endDate), .09, portrait ? 3 : 2.2);
  for (const e of data.releases) if (scoreOf(e) !== null) marker(ctx, data, e, box, .1, portrait ? 6.5 : 4.8);
  label(ctx, 'Shorter quiet. Higher ceiling.', p, portrait ? 363 : 285, portrait ? 49 : 58, C.text);
  const valueY = portrait ? 596 : 460, rightX = portrait ? 577 : 1002;
  label(ctx, first.daysPerLaunch?.toFixed(0) ?? '—', p, valueY, portrait ? 164 : 166, C.text);
  label(ctx, '→', portrait ? 403 : 640, valueY - 23, 76, C.dim);
  label(ctx, last.daysPerLaunch?.toFixed(1) ?? '—', rightX, valueY, portrait ? 136 : 166, C.gold);
  label(ctx, String(first.year), p + 5, valueY + 54, 27, C.muted);
  label(ctx, `${last.year}${last.partial ? ' YTD' : ''}`, rightX + 4, valueY + 54, 27, C.muted);
  label(ctx, 'CALENDAR DAYS / SELECTED LAUNCH', p, valueY + 118, portrait ? 23 : 25, C.gold);
  const best = year => Math.max(...data.releases.filter(e => yearOf(e.date) === year).map(scoreOf).filter(v => v !== null));
  const [low, high] = [best(first.year), best(last.year)];
  if (Number.isFinite(low) && Number.isFinite(high)) {
    const reveal = smooth(state.progress * 3), shown = Math.round(low + (high - low) * reveal);
    if (portrait) {
      label(ctx, `HIGHEST SELECTED ECI · ${first.year} → ${last.year}${last.partial ? ' YTD' : ''}`, p, 1406, 23, C.gold);
      label(ctx, `${Math.round(low)} → ${shown}`, p, 1468, 56, C.text);
    } else {
      label(ctx, 'HIGHEST SELECTED ECI', 1470, valueY - 98, 25, C.gold);
      label(ctx, `${Math.round(low)} → ${shown}`, 1466, valueY, 72, C.text);
      label(ctx, `${first.year} → ${last.year}${last.partial ? ' YTD' : ''}`, 1470, valueY + 54, 27, C.muted);
    }
  }
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
  const ny = portrait ? 1575 : 952;
  label(ctx, 'Launch density, not development time.', p, ny, portrait ? 30 : 27, C.text);
  label(ctx, 'A curated sample. Changing the selection changes the result.', p, ny + 43, portrait ? 23 : 22, C.muted);
  if (portrait) { label(ctx, 'EDIT THE DATA. REPLAY THE SKY.', p, 1716, 29, C.gold); label(ctx, 'crosscore / frontier-model-release-timeline', p, 1763, 23, C.dim); }
}
export function drawFrame(ctx, data, timeline, seconds, format = 'landscape') {
  const { width: w, height: h } = FORMATS[format], portrait = format === 'portrait', state = stateAt(timeline, seconds);
  background(ctx, w, h, seconds); header(ctx, w, portrait, data);
  if (state.mode === 'intro') intro(ctx, data, timeline, state, w, h, portrait);
  else if (state.mode === 'outro') ending(ctx, data, timeline, state, w, h, portrait);
  else {
    const year = stateYear(state), visible = visibleEvents(data, timeline, seconds);
    chart(ctx, data, timeline, state, year, chartBox(format), visible, portrait);
    if (portrait) { label(ctx, '1 BURST = 1 LAUNCH · HEIGHT = ECI', 64, 1718, 30, C.muted); label(ctx, `ECI: ${data.capability.publisher}, ${data.capability.license} · retrieved ${data.capability.retrievedOn}`, 64, 1761, 26, C.muted); }
    else label(ctx, 'ONE BURST = ONE LAUNCH · HEIGHT = ECI SCORE · CONSTANT CALENDAR SPEED', 64, 709, 19, C.muted);
    ledger(ctx, data, visible, timeline, state, year, w, portrait);
    if (portrait) { label(ctx, '* PREVIEW · FOUNTAIN / — = NOT YET SCORED', 64, 1810, 24, C.muted); }
    else label(ctx, '* PREVIEW · FOUNTAIN ON THE AXIS / — = NOT YET SCORED BY EPOCH AI', 64, 1010, 19, C.muted);
  }
  footer(ctx, data, w, h, portrait);
  rect(ctx, 0, h - 3, w * clamp(seconds / timeline.duration), 3, C.gold);
  return state;
}
