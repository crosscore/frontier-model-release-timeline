import { day, iso, yearOf, yearlyStats, launchGroups, joinNames, modelLabel } from './data.mjs';
import { BAR_SECONDS, BEAT_SECONDS, clamp, cuePoints, energy, kickLight, scorePart, smooth, stateAt, stateYear, visibleEvents } from './timeline.mjs';
import { chartBox, chartScale, eventPose, scoreOf } from './chart.mjs';
import { cameraAt } from './camera.mjs';
import { launchesAt, paceAt, pacePeak, PACE_CADENCES, PACE_TAU_DAYS } from './pace.mjs';
export { chartBox, chartScale, eventPose, scoreOf, modelLabel };

export const FORMATS = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1920 } };
export const FIREWORK = Object.freeze({ rise: .36, life: 1.9, rays: 68 });
export function lightingAt(timeline, t) {
  const p = cuePoints(timeline), part = scorePart(p, t);
  return { points: p, part, energy: energy(p, t), kick: kickLight(p, t),
    tension: ['build', 'roll'].includes(part) ? clamp((t - p.build) / Math.max(.001, p.breath - p.build)) : 0,
    breath: part === 'breath' ? smooth((t - p.breath) / .12) : 0 };
}
const C = { bg: '#050A14', text: '#F4F3EE', muted: '#ABB7C9', dim: '#697C94', line: '#263348', gold: '#E5D9B4' };
const TAU = Math.PI * 2;
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const labIndex = (data, id) => data.labs.findIndex(lab => lab.id === id);
const labOf = (data, id) => data.labs.find(lab => lab.id === id);
const rgba = (hex, a) => `${hex}${Math.round(clamp(a) * 255).toString(16).padStart(2, '0')}`;
const mixHex = (a, b, q) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - q) + parseInt(b.slice(i, i + 2), 16) * q).toString(16).padStart(2, '0')).join('');
const easeOut = x => 1 - (1 - clamp(x)) ** 3;
export function seeded(seed) {
  let a = typeof seed === 'number' ? seed : [...seed].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261);
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// Each lab keeps one marker shape and one burst form, assigned by its id so that reordering the labs never swaps
// them. A lab outside this list takes the first style that no listed lab in the dataset uses.
export const LAB_STYLES = Object.freeze([
  { shape: 'circle', form: 'peony' }, { shape: 'diamond', form: 'glitter' }, { shape: 'square', form: 'double ring' },
  { shape: 'triangle', form: 'fan' }, { shape: 'cross', form: 'four-point star' }].map(Object.freeze));
const STYLE_OF = { openai: 0, anthropic: 1, google: 2, deepseek: 3, meta: 4 };
export function labStyles(labs) {
  const used = new Set(labs.map(lab => STYLE_OF[lab.id]).filter(k => k !== undefined)), styles = new Map();
  let free = 0;
  for (const lab of labs) {
    let k = STYLE_OF[lab.id];
    if (k === undefined) { while (used.has(free)) free++; used.add(free); k = free % LAB_STYLES.length; }
    styles.set(lab.id, LAB_STYLES[k]);
  }
  return styles;
}
const styleOf = (data, id) => labStyles(data.labs).get(id);
function label(ctx, value, x, y, size = 26, color = C.text, weight = 500, align = 'left') {
  if (ctx.globalAlpha < .001) return;
  ctx.font = `${Math.round(weight / 100) * 100} ${size}px Manrope${weight >= 600 ? 600 : 500}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(value, x, y);
}
const textWidth = (ctx, value, size, weight = 500) => { ctx.font = `${weight >= 600 ? 600 : 500} ${size}px Manrope${weight >= 600 ? 600 : 500}`; return ctx.measureText(value).width; };
// Shrinks text to fit `width` but never below `min`; whatever still does not fit is shortened with an ellipsis.
function fitText(ctx, value, width, size, min, weight = 500) {
  const natural = textWidth(ctx, value, size, weight);
  if (natural <= width) return { text: value, size };
  size = Math.max(min, Math.floor(size * width / natural * 10) / 10);
  let text = value;
  while (text.length > 1 && textWidth(ctx, text, size, weight) > width) text = text.slice(0, -2).trimEnd() + '…';
  return { text, size };
}
function fit(ctx, value, x, y, width, size, min, color = C.text, weight = 500, align = 'left') {
  const f = fitText(ctx, value, width, size, min, weight);
  label(ctx, f.text, x, y, f.size, color, weight, align);
  return f;
}
// Keep a fitting name on one line. Joined names break only after a model separator;
// a single oversized model may instead break at a word boundary.
export function nameLines(ctx, value, width, size, min, maxLines = 2) {
  const one = fitText(ctx, value, width, size, min);
  if (!one.text.includes('…') || maxLines === 1) return { lines: [one.text], size: one.size };
  const parts = value.split(' · '), candidates = [];
  for (let i = 1; i < parts.length; i++) candidates.push([parts.slice(0, i).join(' · ') + ' ·', parts.slice(i).join(' · ')]);
  if (parts.some(part => textWidth(ctx, part, min) > width)) {
    const words = value.split(' ');
    for (let i = 1; i < words.length; i++) {
      if (words[i] === '·' || words[i] === '*') continue;
      candidates.push([words.slice(0, i).join(' '), words.slice(i).join(' ')]);
    }
  }
  const best = candidates.map(lines => ({ lines, widest: Math.max(...lines.map(text => textWidth(ctx, text, min))) }))
    .sort((a, b) => a.widest - b.widest)[0];
  if (!best) return { lines: [one.text], size: one.size };
  const fitted = Math.max(min, Math.min(size, min * width / best.widest));
  return { lines: best.lines.map(text => fitText(ctx, text, width, fitted, min).text), size: fitted };
}

function line(ctx, x1, y1, x2, y2, color = C.line, width = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}
function rect(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
function circle(ctx, x, y, radius, color, hollow = false) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, radius), 0, TAU);
  if (hollow) { ctx.strokeStyle = color; ctx.lineWidth = 1.7; ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
}
// Marker outlines of roughly equal area, centred on the point.
function shapePath(ctx, shape, x, y, size) {
  ctx.beginPath();
  const poly = points => points.forEach(([u, v], k) => k ? ctx.lineTo(x + u, y + v) : ctx.moveTo(x + u, y + v));
  if (shape === 'diamond') { const d = size * 1.4; poly([[0, -d], [d, 0], [0, d], [-d, 0]]); }
  else if (shape === 'square') { const d = size * .9; poly([[-d, -d], [d, -d], [d, d], [-d, d]]); }
  else if (shape === 'triangle') { const r = size * 1.55; poly([0, 1, 2].map(k => [r * Math.sin(k * TAU / 3), -r * Math.cos(k * TAU / 3)])); }
  else if (shape === 'cross') { const a = size * 1.3, b = size * .44; poly([[-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b], [-a, -b], [-b, -b]]); }
  else ctx.arc(x, y, Math.max(0, size), 0, TAU);
  ctx.closePath();
}
export function glyph(ctx, shape, x, y, size, color, hollow = false) {
  shapePath(ctx, shape, x, y, size);
  if (hollow) { ctx.fillStyle = C.bg; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.2, size * .4); ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
}
function glow(ctx, x, y, radius, color, strength = .3) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(color, strength)); g.addColorStop(.23, rgba(color, strength * .28)); g.addColorStop(1, rgba(color, 0));
  rect(ctx, x - radius, y - radius, radius * 2, radius * 2, g);
}
// Stars drift against the camera at two depths, so the sky moves with every pan and zoom.
function background(ctx, data, w, h, t, cam, light) {
  rect(ctx, 0, 0, w, h, C.bg);
  const ox = cam ? (cam.P.x - cam.cx) * cam.s : 0, oy = cam ? (cam.P.y - cam.cy) * cam.s : 0, zoom = cam ? cam.s : 1;
  const strength = .6 + .65 * light.energy + .16 * light.kick;
  glow(ctx, w * .2 + ox * .02, h * .43 + oy * .02, w * .72, '#285879', .16 * strength);
  glow(ctx, w * .85 + ox * .03, h * .55 + oy * .03, w * .6, '#523D69', .13 * strength);
  if (light.part === 'drop1' || light.part === 'drop') {
    const cycle = t / 7 % data.labs.length, i = Math.floor(cycle);
    glow(ctx, w * .56, h * .46, w * .72, mixHex(data.labs[i].color, data.labs[(i + 1) % data.labs.length].color, smooth(cycle % 1)), .035 + .025 * light.kick);
  }
  const rng = seeded(40), wrap = (v, lo, span) => lo + ((v - lo) % span + span) % span;
  for (let i = 0; i < 95; i++) {
    const depth = i % 2 ? .05 : .12, x = 36 + rng() * (w - 72), y = 170 + rng() * (h * .49), r = (.4 + rng() * .9) * (1 + (zoom - 1) * depth * 2);
    circle(ctx, wrap(x + ox * depth, 36, w - 72), wrap(y + oy * depth, 170, h * .49), r, rgba('#ADCEEE', (.09 + .13 * (1 + Math.sin(t * .5 + i)) / 2) * (.6 + light.energy * .5)));
  }
  if (light.tension > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * .12, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, rgba(C.bg, 0)); g.addColorStop(1, rgba('#000000', .25 * light.tension)); rect(ctx, 0, 0, w, h, g);
  }
}
const TITLE = 'The frontier, ignited.';
// Lab key: each name beside its marker shape. Landscape sets it right of the title, portrait on its own row;
// names shrink, then shorten, so any five labs fit.
function legend(ctx, data, portrait) {
  const n = data.labs.length, styles = labStyles(data.labs), mark = 22, gap = portrait ? 30 : 34, y = portrait ? 204 : 84;
  const left = portrait ? 64 : 64 + textWidth(ctx, TITLE, 58, 600) + 48, right = portrait ? 1016 : 1856, room = right - left - n * mark - (n - 1) * gap;
  const total = data.labs.reduce((sum, lab) => sum + textWidth(ctx, lab.name, 24), 0), size = clamp(24 * room / total, 18, 24);
  const items = data.labs.map(lab => total * size / 24 <= room ? { text: lab.name, size } : fitText(ctx, lab.name, room / n, size, size));
  const widths = items.map(f => textWidth(ctx, f.text, f.size));
  let x = portrait ? left : right - widths.reduce((a, b) => a + b, 0) - n * mark - (n - 1) * gap;
  data.labs.forEach((lab, i) => {
    glyph(ctx, styles.get(lab.id).shape, x + 6, y - 8, 5.2, lab.color);
    label(ctx, items[i].text, x + mark, y, items[i].size, lab.color);
    x += mark + widths[i] + gap;
  });
}
function header(ctx, w, portrait, data) {
  label(ctx, 'FRONTIER OBSERVATORY', 64, 58, 18, C.gold, 600);
  label(ctx, TITLE, 64, portrait ? 137 : 127, portrait ? 62 : 58, C.text, 600);
  legend(ctx, data, portrait);
  if (!portrait) label(ctx, `${data.releases.length} SELECTED MODELS · ${data.startDate.slice(0, 4)}—${data.endDate.slice(0, 4)}`, 1848, 126, 19, C.muted, 500, 'right');
}
function footer(ctx, data, w, h, portrait) {
  line(ctx, 64, h - 67, w - 64, h - 67);
  const size = portrait ? 18 : 19, credit = `ECI: ${data.capability.publisher}, ${data.capability.license} · retrieved ${data.capability.retrievedOn}`;
  const room = w - 128 - (portrait ? 0 : textWidth(ctx, credit, size) + 48), names = `CURATED ${data.labs.map(lab => lab.name.toUpperCase()).join(' + ')} · THROUGH ${data.endDate}`;
  fit(ctx, textWidth(ctx, names, size) <= room ? names : `CURATED SAMPLE OF ${data.labs.length} LABS · THROUGH ${data.endDate}`, 64, h - 31, room, size, 14, C.muted);
  if (!portrait) label(ctx, credit, w - 64, h - 31, size, C.dim, 500, 'right');
}
export function activeFireworks(data, timeline, time) {
  return data.releases.filter(e => { const age = time - timeline.onsets.get(e.id); return age >= -FIREWORK.rise && age < FIREWORK.life; });
}
// How many bursts are in the air, each counted smoothly from launch to the end of its lifetime. Decorative light
// (glow, flash, climbing trails, streaks, glints) dims together by 1 / sqrt(crowd) in dense clusters; every launch
// keeps its exact position, rays, radius and lifetime.
export function burstCrowd(data, timeline, time) {
  let crowd = 0;
  for (const e of data.releases) {
    const age = time - timeline.onsets.get(e.id);
    if (age > -FIREWORK.rise && age < FIREWORK.life) crowd += smooth((age + FIREWORK.rise) / FIREWORK.rise) * (1 - smooth(age / FIREWORK.life));
  }
  return crowd;
}
function marker(ctx, data, event, box, opacity, size) {
  const { bx, by } = eventPose(data, event, box), c = labOf(data, event.lab).color;
  shapePath(ctx, styleOf(data, event.lab).shape, bx, by, size);
  ctx.fillStyle = event.stage === 'preview' ? rgba(C.bg, opacity) : rgba(c, opacity); ctx.fill();
  if (event.stage === 'preview') { ctx.strokeStyle = rgba(c, opacity); ctx.lineWidth = size * .42; ctx.stroke(); }
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
// The rays of one burst as fractions of its radius. Every form has the same ray count, reach (speed at most 1),
// gravity range and lifetime; only their arrangement differs.
const rayCache = new Map();
export function burstRays(form, seed) {
  const key = `${form}\n${seed}`;
  if (rayCache.has(key)) return rayCache.get(key);
  const rand = seeded(seed), n = FIREWORK.rays, rays = [];
  for (let i = 0; i < n; i++) {
    let angle = i / n * TAU + (rand() - .5) * .08, speed = .76 + rand() * .24, tail = .1 + rand() * .055;
    if (form === 'glitter') tail = .17 + rand() * .08;
    else if (form === 'double ring') { speed = i % 2 ? .94 + rand() * .05 : .5 + rand() * .05; tail = .07; }
    else if (form === 'fan') {
      // Seventeen spokes across the upper 150°, four stars along each.
      angle = -Math.PI / 2 + (i % 17 / 16 - .5) * 2.62 + (rand() - .5) * .03; speed = .37 + .2 * Math.floor(i / 17) + rand() * .03; tail = .12;
    } else if (form === 'four-point star') {
      // Forty stars strung along four arms (up, right, down, left) around a small round core.
      if (i < 40) { angle = i % 4 * Math.PI / 2 - Math.PI / 2 + (rand() - .5) * .06; speed = .3 + .07 * (Math.floor(i / 4) + rand()); tail = .09; }
      else { angle = (i - 39.5) / (n - 40) * TAU + (rand() - .5) * .05; speed = .24 + rand() * .1; tail = .06; }
    }
    rays.push({ angle, speed, tail, gravity: 19 + rand() * 8 });
  }
  rayCache.set(key, rays);
  return rays;
}
// Fireworks are drawn in world coordinates under the camera. `view` carries the camera-dependent parts:
// the visible axis to launch from, the burst radius (it grows with zoom, but slower than the zoom), a line-width
// factor, and `deco`, the shared dimming of decorative light in crowded moments.
function rocket(ctx, data, e, lab, age, box, view) {
  const form = styleOf(data, e.lab).form, rays = burstRays(form, e.id), { origin, bx, by } = eventPose(data, e, box);
  const base = Math.max(view.baseY, by), height = base - by, radius = view.radius, px = view.px, fall = radius / box.radius, deco = view.deco;
  const flight = q => ({ x: origin + (bx - origin) * q, y: base - height * (1 - (1 - q) ** 1.7) });
  const c = lab.color;
  if (age < FIREWORK.rise) {
    const q = clamp(age / FIREWORK.rise), head = flight(q);
    for (let j = 0; j < 24; j++) {
      const f = Math.max(0, q - j * .014), p1 = flight(f), p2 = flight(Math.max(0, f - .014));
      line(ctx, p1.x, p1.y, p2.x, p2.y, rgba(c, (1 - j / 24) * .8 * (.5 + .5 * deco)), 2.5 * (1 - j / 30) * px);
    }
    glow(ctx, head.x, head.y, 30 * px, c, .55 * deco); circle(ctx, head.x, head.y, 3 * px, '#FFFFFF');
    return;
  }
  const t = age - FIREWORK.rise, fade = (1 - clamp(t / FIREWORK.life)) ** 1.5;
  if (fade <= 0) return;
  glow(ctx, bx, by, radius * 1.4, c, .25 * Math.exp(-t * 1.4) * deco);
  // Local bloom only, never a full-frame white flash.
  const impulse = Math.exp(-t * 10);
  circle(ctx, bx, by, (4 + 11 * (1 - impulse)) * px, rgba('#FFF3DB', impulse * .65 * deco), true);
  const streak = .55 + .45 * deco;
  for (const [i, ray] of rays.entries()) {
    const gravity = ray.gravity * fall, at = sec => {
      const r = radius * ray.speed * (1 - Math.exp(-sec * 3.4));
      return { x: bx + Math.cos(ray.angle) * r, y: by + Math.sin(ray.angle) * r + gravity * sec * sec };
    };
    const head = at(t), prev = at(Math.max(0, t - ray.tail));
    const sparkle = .68 + .32 * Math.sin(t * 13 + i * 2.3) ** 2;
    line(ctx, prev.x, prev.y, head.x, head.y, rgba(c, fade * sparkle * streak), (i % 5 ? 2.4 : 3.2) * px);
    circle(ctx, head.x, head.y, (i % 7 === 0 ? 2.1 : 1.4) * px, rgba(i % 5 === 0 ? '#FFF3DB' : c, fade));
    if (i % 3 === 0 && t > .32) {
      const extra = at(Math.max(0, t - .17));
      circle(ctx, extra.x, extra.y, .75 * px, rgba('#FCDFB1', fade * .5 * deco));
    }
    if (form === 'glitter' && i % 2 === 0 && t > .22 && Math.sin(t * 47 + i * 1.9) > .2) {
      const glint = at(Math.max(0, t - .05));
      circle(ctx, glint.x + Math.cos(i * 7.1) * 5 * px, glint.y + Math.sin(i * 3.7) * 5 * px, 1.3 * px, rgba('#FFF3DB', fade * .85 * deco));
    }
  }
  const tailFade = Math.exp(-t * 3) * .4 * deco;
  line(ctx, origin, base, bx, by, rgba(c, tailFade), px);
}
// Launches without a published score spray a low fountain from the date axis instead of claiming a height.
function fountain(ctx, e, lab, age, x, view) {
  const rand = seeded(e.id), c = lab.color, r = view.radius, y0 = view.baseY, px = view.px;
  if (age < FIREWORK.rise) {
    const q = clamp(age / FIREWORK.rise);
    glow(ctx, x, y0, (16 + 18 * q) * px, c, (.2 + .35 * q) * view.deco); circle(ctx, x, y0 - 2 * px, 2.5 * px, '#FFFFFF');
    return;
  }
  const t = age - FIREWORK.rise, fade = (1 - clamp(t / FIREWORK.life)) ** 1.3;
  if (fade <= 0) return;
  glow(ctx, x, y0, r * .7, c, .22 * Math.exp(-t * 1.6) * view.deco);
  for (let i = 0; i < 46; i++) {
    const birth = rand() * .95, angle = -Math.PI / 2 + (rand() - .5) * .75, speed = r * (2.3 + rand() * .7);
    const at = s => ({ x: x + Math.cos(angle) * speed * s, y: y0 + Math.sin(angle) * speed * s + r * 3.6 * s * s });
    const s = t - birth;
    if (s < 0 || s > .8) continue;
    const head = at(s), prev = at(Math.max(0, s - .07)), life = 1 - s / .8;
    line(ctx, prev.x, prev.y, head.x, head.y, rgba(c, fade * life * (.55 + .45 * view.deco)), 2 * px);
    circle(ctx, head.x, head.y, 1.4 * px, rgba(i % 4 ? c : '#FFF3DB', fade * life));
  }
}
// The year counter punches up and flashes gold as each year begins; the launch count pops with each arrival.
// Returns the counter's bounding box so the burst callout can keep clear of it.
function counter(ctx, data, timeline, state, year, visible, box, portrait) {
  const c = portrait ? { x: box.x + 30, y: 440, size: 124, sub: 490, subSize: 30, ytd: 532, ytdSize: 22 } : { x: box.x + 32, y: 302, size: 104, sub: 346, subSize: 25, ytd: 382, ytdSize: 20 };
  const jan = timeline.introSeconds + (day(`${year}-01-01`) - timeline.start) / Math.max(1, timeline.end - timeline.start) * timeline.travelSeconds;
  const turn = year > yearOf(data.startDate) ? Math.exp(-Math.max(0, state.time - jan) / .18) : 0, size = c.size;
  const roll = year > yearOf(data.startDate) ? smooth((state.time - jan) / .3) : 1;
  ctx.save(); ctx.beginPath(); ctx.rect(c.x - 2, c.y - size, size * 3.5, size * 1.08); ctx.clip();
  if (roll < 1) label(ctx, String(year - 1), c.x, c.y - size * roll, size, '#8394AB');
  label(ctx, String(year), c.x, c.y + size * (1 - roll), size, mixHex('#8394AB', C.gold, turn), 500);
  ctx.restore();
  let right = c.x + textWidth(ctx, String(year), size);
  const thisYear = visible.filter(e => e.date.startsWith(String(year))), count = thisYear.length;
  const pop = count ? Math.exp(-(state.time - timeline.onsets.get(thisYear.at(-1).id)) / .12) : 0;
  label(ctx, `${months[Number(iso(state.day).slice(5, 7)) - 1]} · ${count} ${count === 1 ? 'MODEL' : 'MODELS'}`, c.x + 4, c.sub, c.subSize * (1 + .12 * pop), C.text, 500);
  right = Math.max(right, c.x + 4 + ctx.measureText('DEC · 00 MODELS').width * (1 + .12 * pop));
  let bottom = c.sub + 8;
  if (year === yearOf(data.endDate)) { label(ctx, `YTD · THROUGH ${data.endDate.slice(5)}`, c.x + 4, c.ytd, c.ytdSize, C.gold); bottom = c.ytd + 8; }
  return { left: c.x - 8, top: c.y - size * .78, right: right + 12, bottom };
}
// The newest launch's name tag rides next to its burst. Launches arriving within a moment of each other share one
// tag, newest at the bottom, its size fixed from the start so it never jumps; the next tag replaces it, so every tag
// stays up for at least the merge window. Each row names every model of one announcement. At most three rows; a larger cluster names its first two announcements and counts
// the rest, as they arrive, towards the lists.
export const TAG = Object.freeze({ life: 1.6, merge: .3, rows: 3 });
const tagPlans = new WeakMap();
export function tagGroups(data, timeline) {
  const cached = tagPlans.get(timeline);
  if (cached?.data === data) return cached.groups;
  const onset = e => timeline.onsets.get(e.id), groups = [];
  const events = launchGroups(data).sort((a, b) => onset(a.models[0]) - onset(b.models[0]) || (scoreOf(b.models[0]) ?? -1) - (scoreOf(a.models[0]) ?? -1));
  for (const e of events) {
    const g = groups.at(-1), t = onset(e.models[0]), entry = { group: e, event: e.models[0], onset: t };
    if (g && (t === g.events.at(-1).onset || t - g.start <= TAG.merge)) g.events.push(entry);
    else groups.push({ start: t, events: [entry] });
  }
  groups.forEach((g, i) => { g.end = Math.min(g.start + TAG.life, groups[i + 1]?.start ?? Infinity); });
  tagPlans.set(timeline, { data, groups });
  return groups;
}
function callout(ctx, data, timeline, state, cam, box, portrait, avoid) {
  const time = state.time, group = tagGroups(data, timeline).find(g => g.start <= time && time < g.end);
  if (!group) return;
  const announced = group.events.filter(({ onset }) => onset <= time);
  const age = time - group.start, extra = announced.length > TAG.rows ? announced.length - TAG.rows + 1 : 0;
  const pose = eventPose(data, group.events[0].event, box), point = cam.toScreen(pose.bx, pose.by);
  const ax = point.x, ay = pose.scored ? point.y : box.y - (portrait ? 160 : 100);
  const nameSize = portrait ? 36 : 30, subSize = portrait ? 22 : 19, rowH = nameSize + (portrait ? 18 : 14), gap = portrait ? 36 : 32, mark = portrait ? 30 : 26;
  const padX = portrait ? 16 : 14, padY = portrait ? 12 : 10;
  const rows = announced.slice(0, extra ? TAG.rows - 1 : TAG.rows).map(({ group, event, onset }) => ({ onset, name: joinNames(group.models),
    sub: group.models.every(e => scoreOf(e) === null) ? 'NOT YET SCORED' : `ECI ${group.models.map(e => scoreOf(e) === null ? '—' : Math.round(scoreOf(e))).join(' · ')}`, lab: labOf(data, event.lab), preview: group.models.every(model => model.stage === 'preview') }));
  const more = n => `+${n} MORE IN THE LISTS BELOW`, maxWidth = box.w - 24;
  const arrived = group.events.slice(TAG.rows - 1).filter(({ onset }) => onset <= time).length;
  const note = extra ? more(extra) : null;
  let width = note ? textWidth(ctx, note, subSize, 600) : 0;
  for (const r of rows) {
    r.subWidth = textWidth(ctx, r.sub, subSize, 600);
    r.fit = fitText(ctx, r.name, maxWidth - mark - 14 - r.subWidth, nameSize, portrait ? 26 : 22, 600);
    width = Math.max(width, mark + textWidth(ctx, r.fit.text, r.fit.size, 600) + 14 + r.subWidth);
  }
  const height = (rows.length + (note ? 1 : 0)) * rowH - rowH + nameSize, right = box.x + box.w - 12;
  let x = ax + gap > right - width ? ax - gap - width : ax + gap, top = ay - height / 2;
  x = clamp(x, box.x + 12, right - width);
  const fitY = v => clamp(v, box.top + 10, box.y - 16 - height);
  top = fitY(top);
  // The counter keeps clear of the tag's whole plate, not just its text.
  if (x - padX < avoid.right && x + width + padX > avoid.left && top - padY < avoid.bottom && top + height + padY > avoid.top) {
    top = fitY(avoid.bottom + 14);
    if (top - padY < avoid.bottom) x = Math.min(right - width, avoid.right + 20);
  }
  const a = easeOut(age / .12) * clamp((group.end - time) / .25), slide = (1 - easeOut(age / .22)) * (x > ax ? 28 : -28);
  ctx.save();
  const over = ax > x - padX && ax < x + width + padX, edge = over ? ax - slide : x > ax ? x - padX : x + width + padX;
  const end = over ? (ay < top ? top - padY : top + height + padY) : top + nameSize * .45;
  ctx.globalAlpha = a;
  if (!over || ay < top - 36 || ay > top + height + 36) line(ctx, ax, ay, edge + slide, end, rgba(rows[0].lab.color, .55), 1.5);
  // One dark plate behind the whole group, edged in the first launch's lab colour. The tag must stay the last thing
  // drawn in the plot, after the bursts and step lines, so that nothing crosses the plate.
  ctx.beginPath();
  ctx.roundRect(x + slide - padX, top - padY, width + 2 * padX, height + 2 * padY, portrait ? 8 : 6);
  ctx.fillStyle = rgba(C.bg, .82); ctx.fill();
  ctx.strokeStyle = rgba(rows[0].lab.color, .75); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.shadowColor = rgba(C.bg, .9); ctx.shadowBlur = 14;
  rows.forEach((r, i) => {
    if (time < r.onset) return;
    const y = top + nameSize * .8 + i * rowH, tx = x + slide;
    ctx.globalAlpha = a * easeOut((time - r.onset) / .12);
    glyph(ctx, styleOf(data, r.lab.id).shape, tx + mark * .32, y - nameSize * .3, nameSize * .17, r.lab.color, r.preview);
    label(ctx, r.fit.text, tx + mark, y, r.fit.size, C.text, 600);
    label(ctx, r.sub, tx + mark + textWidth(ctx, r.fit.text, r.fit.size, 600) + 14, y, subSize, r.lab.color, 600);
  });
  if (note && arrived) { ctx.globalAlpha = a; label(ctx, more(arrived), x + slide + mark, top + nameSize * .8 + rows.length * rowH, subSize, C.muted, 600); }
  ctx.restore();
}
// Launch pace beside the chart (landscape) or under it (portrait), like an indicator with a price chart: it shares the
// camera's calendar, and its scale widens whenever the pace sets a new high, so the cadence gridlines sink as launches
// speed up. Each launch kicks the line up as it bursts and leaves a mark on the panel's baseline.
function pacePanel(ctx, data, timeline, state, box, visible, portrait, cam, light) {
  const pb = box.pace, beside = pb.x >= box.x + box.w, scale = chartScale(data, box), left = pb.x, right = pb.x + box.w;
  const sx = d => cam.toScreen(scale.x(d), 0).x + pb.x - box.x;
  const launches = launchesAt(data, timeline, state.time), peak = pacePeak(launches);
  // Reserve 35% of the panel above the running peak for cadence labels.
  const top = Math.max(18, peak / .65), py = v => pb.bottom - v / top * (pb.bottom - pb.top);
  // Axis labels pair each gridline's value with its cadence. Highest first; once a label would crowd the one above it,
  // the lower ones wait until the scale gives them room.
  const size = portrait ? 20 : 16, note = portrait ? 15 : 13, room = size * .8 + note + 8;
  let above = -Infinity;
  for (const c of [...PACE_CADENCES].sort((p, q) => q.value - p.value)) {
    if (c.days === 3 && peak <= 1.5 * 365 / 7) continue;
    const y = py(c.value), a = clamp((top - c.value) / (top * .08));
    if (a <= 0) continue;
    ctx.setLineDash([2, 5]); line(ctx, left, y, right, y, rgba('#3A4D6B', a)); ctx.setLineDash([]);
    if (y - above < room) { above = Infinity; continue; }
    above = y; ctx.globalAlpha = a;
    label(ctx, String(Math.round(c.value)), left - 14, y + size * .35, size, C.dim, 500, 'right');
    label(ctx, c.name, left - 14, y + size * .35 + note + 5, note, C.dim, 500, 'right');
    ctx.globalAlpha = 1;
  }
  ctx.save(); ctx.beginPath(); ctx.rect(left, pb.top - 14, box.w, pb.bottom - pb.top + 14); ctx.clip();
  for (let y = yearOf(data.startDate) + 1; y <= yearOf(data.endDate) + 1; y++) { const x = sx(day(`${y}-01-01`)); line(ctx, x, pb.top, x, pb.bottom, '#17233A'); }
  const nowX = sx(state.day);
  line(ctx, nowX, pb.top, nowX, pb.bottom, rgba(C.gold, .16 + .38 * light.kick + .32 * light.tension), 1 + light.kick);
  // Sample the visible stretch every few pixels, plus both sides of each launch so the kicks stay vertical.
  const d0 = Math.max(scale.from, scale.day(cam.toWorld(box.x, 0).x)), d1 = Math.min(state.day, scale.day(cam.toWorld(box.x + box.w, 0).x));
  if (d1 > d0) {
    const n = Math.max(1, Math.ceil((sx(d1) - sx(d0)) / 3)), days = Array.from({ length: n + 1 }, (_, k) => d0 + (d1 - d0) * k / n);
    for (const l of launches) if (l.day > d0 && l.day <= d1) days.push(l.day - 1e-6, l.day);
    const pts = days.sort((a, b) => a - b).map(d => ({ x: sx(d), y: py(paceAt(launches, d)) }));
    ctx.beginPath(); ctx.moveTo(pts[0].x, pb.bottom); for (const p of pts) ctx.lineTo(p.x, p.y); ctx.lineTo(pts.at(-1).x, pb.bottom); ctx.closePath();
    const fill = ctx.createLinearGradient(0, pb.top, 0, pb.bottom); fill.addColorStop(0, rgba(C.gold, .3)); fill.addColorStop(1, rgba(C.gold, .02));
    ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = mixHex(C.gold, '#FFFFFF', .16 * reignition(timeline, state.time).progress); ctx.lineWidth = portrait ? 3 : 2.6; ctx.lineJoin = 'round'; ctx.stroke();
  }
  // A ring in the lab's colour opens where each launch kicks the line.
  for (const e of visible) {
    const age = state.time - timeline.onsets.get(e.id), d = day(e.date);
    if (age < .6) circle(ctx, sx(d), py(paceAt(launches, d)), (4 + 24 * easeOut(age / .6)) * (portrait ? 1.2 : 1.1), rgba(labOf(data, e.lab).color, 1 - age / .6), true);
  }
  ctx.restore();
  // One mark per launch on the baseline, the raw dates the line is built from: one lane per lab, in its marker
  // shape (hollow for previews). The lanes tighten as labs are added and sit just above the date ticks.
  const n = data.labs.length, lane = n > 3 ? 5.5 : 8, styles = labStyles(data.labs);
  for (const e of visible) {
    const x = sx(day(e.date));
    if (x >= left && x <= right) glyph(ctx, styles.get(e.lab).shape, x, pb.bottom - (n > 3 ? 3 : 0) + (labIndex(data, e.lab) - (n - 1) / 2) * lane, n > 3 ? 2.6 : 3.2, labOf(data, e.lab).color, e.stage === 'preview');
  }
  const title = `LAUNCH PACE · MODELS / YEAR, ANNUALIZED · ${PACE_TAU_DAYS}-DAY EMA`;
  if (beside) label(ctx, title, left, pb.top - 16, 17, C.gold, 600); else label(ctx, title, left + 10, pb.top + 20, 19, C.gold, 600);
  // The head carries its live value, like the last price on a trading chart, and pops with each launch.
  if (nowX < left || nowX > right) return;
  const value = paceAt(launches, state.day), y = py(value), last = visible.at(-1);
  const pop = last ? Math.exp(-(state.time - timeline.onsets.get(last.id)) / .14) : 0, tag = 26 * (1 + .25 * pop);
  ctx.setLineDash([3, 6]); line(ctx, nowX, y, right, y, rgba(C.gold, .4)); ctx.setLineDash([]);
  glow(ctx, nowX, y, 22 + 16 * pop, C.gold, .45 + .3 * pop); circle(ctx, nowX, y, 4, C.text);
  ctx.font = `600 ${Math.round(tag)}px Manrope600`;
  const text = String(Math.round(value)), width = ctx.measureText(text).width;
  const tx = nowX + 14 + width > right - 4 ? nowX - 14 - width : nowX + 14;
  label(ctx, text, tx, clamp(y + tag * .36, pb.top + tag * .8, pb.bottom - 5), tag, mixHex(C.gold, '#FFFFFF', pop * .6), 600);
}
function chart(ctx, data, timeline, state, year, box, visible, portrait, cam, light) {
  const scale = chartScale(data, box), W = portrait ? 1080 : 1920, clipTop = portrait ? 250 : 150, right = box.x + box.w;
  const sx = wx => cam.toScreen(wx, 0).x, sy = wy => cam.toScreen(0, wy).y;
  const nowX = sx(scale.x(state.day)), end = sx(scale.x(iso(day(data.endDate) + 1)));
  // Score grid in screen space: lines stay crisp at any zoom, and 5-point lines fade in once the camera is close.
  const minor = clamp((cam.s - 1.3) / .4), top = scale.score(cam.toWorld(0, box.top).y), bottom = scale.score(cam.toWorld(0, box.y).y);
  for (let v = Math.ceil(bottom / 5) * 5; v <= top; v += 5) {
    const y = sy(scale.y(v)), a = v % 10 === 0 ? 1 : minor;
    if (a < .02 || y < box.top - 1 || y > box.y + 1) continue;
    line(ctx, box.x, y, right, y, rgba(v === scale.lo ? '#42506B' : '#17233A', a));
    ctx.globalAlpha = a; label(ctx, String(v), box.x - 16, y + (portrait ? 8 : 6), portrait ? 24 : 17, C.dim, 500, 'right'); ctx.globalAlpha = 1;
  }
  label(ctx, `${data.capability.index.toUpperCase()} · HIGHER = MORE CAPABLE`, box.x, box.top - (portrait ? 18 : 16), portrait ? 21 : 17, C.gold, 600);
  glow(ctx, box.x + box.w * .5, box.y, box.w * .7, '#407685', .15);
  const world = () => { ctx.translate(cam.P.x - cam.cx * cam.s, cam.P.y - cam.cy * cam.s); ctx.scale(cam.s, cam.s); };
  // Step lines and markers stay inside the plot; their strokes thicken a little as the camera closes in.
  const thin = cam.s ** -.7;
  ctx.save(); ctx.beginPath(); ctx.rect(box.x, clipTop, box.w, box.y + 4 - clipTop); ctx.clip();
  line(ctx, nowX, box.top, nowX, box.y, rgba(C.gold, .16 + .38 * light.kick + .32 * light.tension), 1 + light.kick);
  if (light.tension > 0 || light.kick > .01) glow(ctx, nowX, (box.top + box.y) / 2, box.w * .28, C.gold, .08 * light.tension + .04 * light.kick);
  world();
  const sweep = reignition(timeline, state.time);
  frontierLines(ctx, data, timeline, visible, box, state.time, scale.x(state.day), .62 + .12 * sweep.progress, (portrait ? 3 : 2.2) * thin);
  const latest = new Set(data.labs.map(lab => visible.filter(e => e.lab === lab.id && scoreOf(e) !== null).at(-1)));
  for (const e of visible) if (scoreOf(e) !== null) {
    if (latest.has(e)) { const { bx, by } = eventPose(data, e, box); glow(ctx, bx, by, (portrait ? 30 : 22) * thin, labOf(data, e.lab).color, .35); }
    marker(ctx, data, e, box, latest.has(e) ? .95 : .6, (portrait ? 6.5 : 4.8) * thin);
    const passed = sweep.start + (day(e.date) - timeline.start) / Math.max(1, timeline.end - timeline.start) * sweep.length;
    const age = state.time - passed;
    if (age >= 0 && age < .4) {
      const { bx, by } = eventPose(data, e, box), color = labOf(data, e.lab).color;
      glow(ctx, bx, by, (24 + 18 * age / .4) * thin, color, .55 * (1 - age / .4));
      circle(ctx, bx, by, (8 + 18 * age / .4) * thin, rgba(color, .8 * (1 - age / .4)), true);
    }
  }
  ctx.restore();
  pacePanel(ctx, data, timeline, state, box, visible, portrait, cam, light);
  // The date axis runs under the plot and again under the pace panel. Labels go under both panels when they sit side
  // by side, or only under the lower one; ticks and labels slide and spread with the camera.
  const pb = box.pace, beside = pb.x > right, quarter = clamp((cam.s - 1.5) / .4), size = portrait ? 26 : 18;
  for (const { ox, base, labels } of [{ ox: 0, base: box.y, labels: beside }, { ox: pb.x - box.x, base: pb.bottom, labels: true }]) {
    const l = box.x + ox, r = right + ox, labelY = base + (portrait ? 40 : 28);
    line(ctx, l, base, r, base, mixHex('#42506B', C.gold, .65 * light.kick), 1 + light.kick);
    if (end + ox < r) for (let x = Math.max(l, end + ox); x < r; x += 16) line(ctx, x, base - 4, Math.min(r, x + 5), base + 4, C.dim);
    for (let y = yearOf(data.startDate); y <= yearOf(data.endDate) + 1; y++) {
      const x = sx(scale.x(`${y}-01-01`)) + ox;
      if (x >= l - .5 && x <= r + .5) {
        line(ctx, x, base, x, base + 12, '#697B93');
        if (labels && y <= yearOf(data.endDate)) { ctx.font = `500 ${size}px Manrope500`; if (x + 8 + ctx.measureText(String(y)).width <= Math.min(W - 8, r + 56)) label(ctx, String(y), x + 8, labelY, size, C.muted); }
      }
      if (y > yearOf(data.endDate)) continue;
      for (const m of [4, 7, 10]) {
        const q = sx(scale.x(`${y}-${String(m).padStart(2, '0')}-01`)) + ox;
        if (q < l || q > r) continue;
        line(ctx, q, base, q, base + 6, '#3A4860');
        if (labels && quarter > .02 && q + 40 < r) { ctx.globalAlpha = quarter; label(ctx, months[m - 1], q + 6, labelY, portrait ? 19 : 14, C.dim); ctx.globalAlpha = 1; }
      }
    }
  }
  if (end < right) label(ctx, 'UNOBSERVED', right + pb.x - box.x, pb.bottom + (portrait ? 70 : 56), portrait ? 22 : 17, C.muted, 500, 'right');
  if (nowX >= box.x && nowX <= right) { line(ctx, nowX, box.y - 19, nowX, box.y + 15, C.gold, 2); circle(ctx, nowX, box.y, 3, C.text); }
  sectionWaves(ctx, data, timeline, state.time, box, cam);
  return counter(ctx, data, timeline, state, year, visible, box, portrait);
}

// No extra launch: the sweep only relights existing markers. It starts once the .7 s reveal has settled.
export function reignition(timeline, t) {
  const p = cuePoints(timeline), start = p.drop + .7, end = Math.min(p.outro, p.drop + BAR_SECONDS + 2 * BEAT_SECONDS);
  const length = Math.max(.001, end - start);
  return { start, length, progress: clamp((t - start) / length), active: t >= start && t < end };
}
function sectionWaves(ctx, data, timeline, t, box, cam) {
  const p = cuePoints(timeline), sweep = reignition(timeline, t), scale = chartScale(data, box);
  for (const panel of [{ x: box.x, top: box.top, bottom: box.y }, { x: box.pace.x, top: box.pace.top, bottom: box.pace.bottom }]) {
    ctx.save(); ctx.beginPath(); ctx.rect(panel.x, panel.top, box.w, panel.bottom - panel.top); ctx.clip();
    for (const [at, strength] of [[p.lift, .3], [p.drop1, .65], [p.drop, .8]]) {
      const q = (t - at) / BEAT_SECONDS;
      if (q < 0 || q > 1) continue;
      const x = panel.x + box.w * q, width = box.w * .055, g = ctx.createLinearGradient(x - width, 0, x + width, 0);
      g.addColorStop(0, rgba(data.labs[0].color, 0));
      data.labs.forEach((lab, k) => g.addColorStop(.15 + .7 * k / Math.max(1, data.labs.length - 1), rgba(lab.color, .16 * strength * Math.sin(Math.PI * q))));
      g.addColorStop(1, rgba(data.labs.at(-1).color, 0));
      rect(ctx, x - width, panel.top, width * 2, panel.bottom - panel.top, g);
      ctx.strokeStyle = rgba(C.gold, strength * Math.sin(Math.PI * q)); ctx.lineWidth = 2; ctx.strokeRect(panel.x, panel.top, box.w, panel.bottom - panel.top);
    }
    if (sweep.active) {
      const wx = scale.x(timeline.start + (timeline.end - timeline.start) * sweep.progress), x = cam.toScreen(wx, 0).x + panel.x - box.x;
      glow(ctx, x, (panel.top + panel.bottom) / 2, box.w * .15, C.gold, .1);
      line(ctx, x, panel.top, x, panel.bottom, rgba(C.gold, .6), 2);
      if (panel.x === box.pace.x) for (const e of data.releases) {
        const age = t - sweep.start - (day(e.date) - timeline.start) / Math.max(1, timeline.end - timeline.start) * sweep.length;
        if (age >= 0 && age < .4) glow(ctx, scale.x(e.date) + panel.x - box.x, panel.bottom, 17, labOf(data, e.lab).color, .45 * (1 - age / .4));
      }
    }
    ctx.restore();
  }
}
function fireworks(ctx, data, timeline, state, box, portrait, cam) {
  const scale = chartScale(data, box), right = box.x + box.w, clipTop = portrait ? 250 : 150;
  const view = { baseY: Math.min(box.y, cam.toWorld(0, box.y).y), radius: box.radius * cam.s ** -.45, px: cam.s ** -.5, deco: 1 / Math.sqrt(Math.max(1, burstCrowd(data, timeline, state.time))) };
  ctx.save(); ctx.beginPath(); ctx.rect(0, clipTop, box.pace.x > right ? right + 36 : 1080, box.y + 4 - clipTop); ctx.clip();
  ctx.translate(cam.P.x - cam.cx * cam.s, cam.P.y - cam.cy * cam.s); ctx.scale(cam.s, cam.s);
  for (const event of activeFireworks(data, timeline, state.time)) {
    const age = state.time - timeline.onsets.get(event.id) + FIREWORK.rise, lab = labOf(data, event.lab);
    if (scoreOf(event) === null) fountain(ctx, event, lab, age, scale.x(event.date), view); else rocket(ctx, data, event, lab, age, box, view);
  }
  ctx.restore();
}
// Newest first: each arrival pushes by its own measured height, with no overlap mid-slide.
const PUSH_SECONDS = .28;
export function ledgerRows(events, timeline, time, heightOf = () => 1) {
  const eased = events.map(e => easeOut((time - timeline.onsets.get(e.models?.[0].id ?? e.id)) / PUSH_SECONDS));
  let below = Infinity;
  return events.map((event, k) => {
    const height = heightOf(event);
    const row = Math.min(events.slice(k + 1).reduce((sum, e, i) => sum + heightOf(e) * eased[k + 1 + i], 0) - height * (1 - eased[k]), below - height);
    below = row;
    return { event, row, height, alpha: clamp((row + height * .5) / (height * .5)) };
  });
}
// Where each lab's list sits. Landscape: one row of columns under both panels; two or three labs get wide columns
// with the date, name and score on one line, four or five get narrow ones with the date under the name. Portrait:
// up to three columns per row (3 + 2 for five labs, 2 + 2 for four). Columns fit up to four announcements; `bottom` is the
// lowest any of its text may reach, including the fifth name as it fades out.
export const LEDGER_ROWS = 4;
export function ledgerLayout(data, format) {
  const n = data.labs.length, portrait = format === 'portrait', p = 64, room = FORMATS[format].width - 2 * p;
  const grid = portrait ? (n <= 3 ? [n] : [Math.ceil(n / 2), Math.floor(n / 2)]) : [n];
  const m = portrait
    ? grid.length > 1 ? { head: 26, hint: 19, name: 32, min: 25, date: 20, dateDy: 27, score: 30, first: 44, rowH: 72, pitch: 342, y: 1140, bottom: 1796 }
      : { head: 30, hint: 21, name: 42, min: 30, date: 24, dateDy: 34, score: 34, first: 62, rowH: 88, pitch: 0, y: 1150, bottom: 1716 }
    : n <= 3 ? { head: 23, hint: 19, name: 34, min: 26, date: 22, score: 26, first: 48, rowH: 52, nameX: 150, y: 752, bottom: 992 }
      : { head: 21, hint: 17, name: 28, min: 22, date: 16, dateDy: 23, score: 26, first: 40, rowH: 56, y: 752, bottom: 992 };
  const gap = portrait ? 28 : n <= 2 ? 90 : n === 3 ? 60 : 32, columns = [];
  let i = 0;
  grid.forEach((count, g) => {
    const w = (room - gap * (count - 1)) / count, y = m.y + g * (m.pitch ?? 0);
    const bottom = g + 1 < grid.length ? y + m.pitch - m.head * .75 - 12 : m.bottom;
    for (let k = 0; k < count; k++, i++) {
      const compact = portrait || n > 3;
      columns.push({ lab: data.labs[i], x: p + k * (w + gap), w, y, first: y + m.first, bottom, compact, m });
    }
  });
  return columns;
}
// Measure the same ink bounds used for drawing and acceptance checks.
function ink(ctx, value, size) {
  textWidth(ctx, value, size);
  const m = ctx.measureText(value);
  return { ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
}
export function ledgerName(ctx, event, col) {
  const { m, w } = col, name = joinNames(event.models, col.compact);
  const room = w - (m.nameX ?? 0) - textWidth(ctx, '000', m.score) - (m.nameX ? 24 : 16);
  const names = nameLines(ctx, name, room, m.name, m.min);
  const lineH = Math.ceil(names.size * 1.12), last = (names.lines.length - 1) * lineH;
  const bounds = names.lines.map(text => ink(ctx, text, names.size));
  const date = event.date.replaceAll('-', '.'), dateInk = ink(ctx, date, m.date);
  const dateOffset = m.nameX && names.lines.length === 1 ? 0 : last + m.dateDy;
  const top = Math.min(-bounds[0].ascent, dateOffset - dateInk.ascent, -ink(ctx, '000', m.score).ascent);
  const bottom = Math.max(last + bounds.at(-1).descent, dateOffset + dateInk.descent, ink(ctx, '000', m.score).descent);
  // A fixed pitch per format, one line taller for a wrapped name. `rowH` leaves more ink gap below a date than above it,
  // so every date reads as part of its own name.
  const height = m.rowH + last;
  return { name, names, lineH, date, dateOffset, top, bottom, height };
}
export function ledgerEntries(ctx, events, col, timeline, time) {
  const plans = new Map(events.map(event => [event, ledgerName(ctx, event, col)])), heightOf = event => plans.get(event).height;
  // Where each row comes to rest once every push has finished. A row that fits there stays fully opaque; one that will
  // not fit fades as it is pushed past the bottom, so no row is ever left half-transparent at rest.
  const rest = new Map(ledgerRows(events, timeline, Infinity, heightOf).map(row => [row.event, row.row]));
  return ledgerRows(events, timeline, time, heightOf).map(row => {
    const plan = plans.get(row.event), baseline = col.first + row.row;
    const top = baseline + plan.top, bottom = baseline + plan.bottom, clipTop = col.y + 15;
    const fits = col.first + rest.get(row.event) + plan.bottom <= col.bottom;
    const alpha = row.alpha * (fits ? 1 : clamp((col.bottom - bottom) / 8)) * clamp((top - clipTop) / 4);
    return { ...row, ...plan, baseline, top, bottom, alpha, complete: top >= clipTop && bottom <= col.bottom };
  });
}
function ledger(ctx, data, visible, timeline, state, portrait) {
  const styles = labStyles(data.labs), groups = launchGroups(data).filter(g => timeline.onsets.get(g.models[0].id) <= state.time).sort((a, b) => timeline.onsets.get(a.models[0].id) - timeline.onsets.get(b.models[0].id));
  for (const col of ledgerLayout(data, portrait ? 'portrait' : 'landscape')) {
    const { lab, x, w, y, m } = col, all = groups.filter(e => e.lab === lab.id), newest = all.at(-1), hint = 'ECI', hintW = textWidth(ctx, hint, m.hint);
    glyph(ctx, styles.get(lab.id).shape, x + 6, y - m.head * .36, m.head * .24, lab.color);
    fit(ctx, lab.name.toUpperCase(), x + 22, y, w - 22 - hintW - 16, m.head, m.head * .75, lab.color, 600);
    label(ctx, hint, x + w, y, m.hint, C.dim, 500, 'right');
    line(ctx, x, y + 14, x + w, y + 14);
    ctx.save(); ctx.beginPath(); ctx.rect(x - 12, y + 15, w + 24, col.bottom - y - 15); ctx.clip();
    for (const row of ledgerEntries(ctx, all.slice(-(LEDGER_ROWS + 2)), col, timeline, state.time)) {
      if (row.alpha <= .01 || !row.complete) continue;
      const { event, baseline: yy, names, date, dateOffset, lineH } = row;
      const first = event.models[0], age = state.time - timeline.onsets.get(first.id), latest = event === newest;
      const score = scoreOf(first) === null ? '—' : String(Math.round(scoreOf(first)));
      ctx.globalAlpha = row.alpha;
      if (age < 1.2) rect(ctx, x - 9, row.top - 4, w + 18, row.bottom - row.top + 9, rgba(lab.color, .1 * (1 - age / 1.2)));
      names.lines.forEach((text, i) => label(ctx, text, x + (m.nameX ?? 0), yy + i * lineH, names.size));
      label(ctx, date, x, yy + dateOffset, m.date, latest ? C.text : C.muted);
      label(ctx, score, x + w, yy, m.score, latest ? lab.color : C.muted, 500, 'right');
    }
    ctx.restore();
  }
}
// Scale the drawing about a point; text keeps its own coordinates, so layout checks still see the unscaled design.
function zoomAbout(ctx, x, y, k) { ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y); }
const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
// Title card: lines cascade in on the beat while the card drifts closer, then it zooms through into the chart.
function intro(ctx, data, timeline, state, w, h, portrait) {
  const t = state.time, exit = clamp((t - (timeline.introSeconds - .24)) / .24), y = portrait ? 708 : 417;
  const enter = at => easeOut((t - at) / .3), slide = (at, x) => Math.max(8, x - (1 - enter(at)) * 90);
  ctx.save(); zoomAbout(ctx, w * .3, h * .5, 1 + .035 * t / timeline.introSeconds + .25 * exit ** 2);
  const show = (at, draw) => { ctx.globalAlpha = enter(at) * (1 - exit); draw(); };
  show(0, () => label(ctx, 'NEW MODELS.', slide(0, 64), y, portrait ? 106 : 120, C.text, 500));
  show(BEAT_SECONDS, () => label(ctx, 'LESS QUIET.', slide(BEAT_SECONDS, 64), y + (portrait ? 127 : 136), portrait ? 106 : 120, C.gold, 500));
  show(2 * BEAT_SECONDS, () => label(ctx, 'One model. One spark.', slide(2 * BEAT_SECONDS, 69), y + (portrait ? 239 : 232), 37, C.muted));
  show(3 * BEAT_SECONDS, () => label(ctx, 'Each burst lands at its capability score.', slide(3 * BEAT_SECONDS, 69), y + (portrait ? 302 : 290), portrait ? 29 : 30, C.muted));
  const sy = portrait ? 1207 : 790, gx = 64 + (w - 128) * smooth((t - BAR_SECONDS) / Math.max(.001, timeline.introSeconds - BAR_SECONDS - .24));
  show(BAR_SECONDS, () => {
    glow(ctx, gx, sy, portrait ? 200 : 270, data.labs[0].color, .35);
    const g = ctx.createLinearGradient(64, sy, w - 64, sy);
    data.labs.forEach((lab, i) => g.addColorStop(i / (data.labs.length - 1), lab.color));
    line(ctx, 64, sy, w - 64, sy, '#364256'); line(ctx, 64, sy, gx, sy, g, 2);
    circle(ctx, gx, sy, 4, C.text);
  });
  show(BAR_SECONDS, () => {
    label(ctx, `${data.startDate.slice(0, 4)} — ${data.endDate.slice(0, 4)}`, slide(BAR_SECONDS, 64), sy + 83, 34, C.text);
    fit(ctx, `${data.releases.length} selected models · ${COUNT_WORDS[data.labs.length] ?? data.labs.length} labs · scores from ${data.capability.publisher}`, slide(BAR_SECONDS, 64), sy + 134, w - 128, portrait ? 27 : 29, 20, C.muted);
  });
  ctx.restore();
}
// Summary: the card eases in from slightly too close and keeps drifting; figures arrive in sequence and count to their values.
function ending(ctx, data, timeline, state, w, h, portrait) {
  const rows = yearlyStats(data), first = rows[0], last = rows.at(-1), p = 64, t = state.time - timeline.outroStart;
  const enter = at => easeOut((t - at) / .35), show = at => { ctx.globalAlpha = enter(at); };
  const box = chartBox(portrait ? 'portrait' : 'landscape');
  ctx.save(); zoomAbout(ctx, w / 2, h / 2, 1 + .03 * smooth(state.progress) + .06 * (1 - enter(0)));
  show(0);
  frontierLines(ctx, data, timeline, data.releases, box, Infinity, chartScale(data, box).x(data.endDate), .09, portrait ? 3 : 2.2);
  for (const e of data.releases) if (scoreOf(e) !== null) marker(ctx, data, e, box, .1, portrait ? 6.5 : 4.8);
  label(ctx, 'Shorter quiet. Higher ceiling.', p - (1 - enter(0)) * 60, portrait ? 363 : 285, portrait ? 49 : 58, C.text);
  const valueY = portrait ? 596 : 460, rightX = portrait ? 577 : 1002;
  show(BEAT_SECONDS);
  const countProgress = easeOut((t - BEAT_SECONDS) / BAR_SECONDS);
  label(ctx, (first.daysPerModel * countProgress)?.toFixed(1) ?? '—', p, valueY, portrait ? 128 : 166, C.text);
  label(ctx, '→', portrait ? 403 : 640, valueY - 23, 76, C.dim);
  const count = Number.isFinite(first.daysPerModel) && Number.isFinite(last.daysPerModel) ? last.daysPerModel * countProgress : null;
  label(ctx, count?.toFixed(1) ?? '—', rightX, valueY, portrait ? 136 : 166, C.gold);
  label(ctx, String(first.year), p + 5, valueY + 54, 27, C.muted);
  label(ctx, `${last.year}${last.partial ? ' YTD' : ''}`, rightX + 4, valueY + 54, 27, C.muted);
  show(BEAT_SECONDS);
  label(ctx, 'CALENDAR DAYS / SELECTED MODEL', p, valueY + 118, portrait ? 23 : 25, C.gold);
  const best = year => Math.max(...data.releases.filter(e => yearOf(e.date) === year).map(scoreOf).filter(v => v !== null));
  const [low, high] = [best(first.year), best(last.year)];
  if (Number.isFinite(low) && Number.isFinite(high)) {
    show(BAR_SECONDS);
    const shown = Math.round(low + (high - low) * easeOut((t - BAR_SECONDS) / BAR_SECONDS));
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
  const max = Math.max(1, ...rows.map(r => r.daysPerModel ?? 0));
  for (const [i, row] of rows.entries()) {
    const y = top + i * step, bx = portrait ? 278 : 315, bw = portrait ? 535 : 1040, at = BEAT_SECONDS * (1 + i);
    show(at);
    label(ctx, String(row.year) + (row.partial ? ' YTD' : ''), p, y + 18, portrait ? 27 : 24, C.muted);
    line(ctx, bx, y + 5, bx + bw, y + 5, '#1B293C', 7);
    line(ctx, bx, y + 5, bx + bw * (row.daysPerModel ?? 0) / max * easeOut((t - at) / BEAT_SECONDS), y + 5, i === rows.length - 1 ? C.gold : '#739EAD', 7);
    label(ctx, row.daysPerModel?.toFixed(1) ?? '—', bx + bw + 26, y + 18, portrait ? 30 : 28, C.text);
    if (portrait) label(ctx, `${row.observedDays} days / ${row.count} models`, bx, y + 55, 22, C.dim);
    else label(ctx, `${row.observedDays} days / ${row.count} models`, w - 64, y + 18, 21, C.dim, 500, 'right');
  }
  const ny = portrait ? 1575 : 952;
  show(2 * BAR_SECONDS);
  label(ctx, 'Model density, not development time.', p, ny, portrait ? 30 : 27, C.text);
  label(ctx, 'A curated sample. Changing the selection changes the result.', p, ny + 43, portrait ? 23 : 22, C.muted);
  const finale = cuePoints(timeline).finale;
  if (state.time >= finale) {
    ctx.globalAlpha = easeOut((state.time - finale) / .14);
    if (portrait) { label(ctx, 'EDIT THE DATA. REPLAY THE SKY.', p, 1716, 29, C.gold); label(ctx, 'crosscore / frontier-model-release-timeline', p, 1763, 23, C.dim); }
    else {
      label(ctx, 'EDIT THE DATA. REPLAY THE SKY.', 1470, 584, 21, C.gold);
      label(ctx, 'crosscore /', 1470, 622, 21, C.muted);
      label(ctx, 'frontier-model-release-timeline', 1470, 654, 21, C.muted);
    }
  }
  ctx.restore();
}
export function drawFrame(ctx, data, timeline, seconds, format = 'landscape') {
  const { width: w, height: h } = FORMATS[format], portrait = format === 'portrait', state = stateAt(timeline, seconds);
  const cam = state.mode === 'timeline' ? cameraAt(data, timeline, format, state.time) : null;
  const light = lightingAt(timeline, state.time);
  background(ctx, data, w, h, seconds, cam, light);
  if (state.time >= light.points.finale) {
    const u = state.time - light.points.finale;
    glow(ctx, w * .62, h * .62, w * .75, C.gold, .13 * clamp(u / .04) * Math.exp(-u / .32));
  }
  // Scenes dip through the background colour (never a white flash) while they zoom through.
  let veil = 0;
  if (state.mode === 'intro') {
    intro(ctx, data, timeline, state, w, h, portrait);
    veil = clamp((state.time - (timeline.introSeconds - .2)) / .2) * .9;
  } else if (state.mode === 'outro') {
    ending(ctx, data, timeline, state, w, h, portrait);
    veil = 1 - clamp((state.time - timeline.outroStart) / .3);
  } else {
    const year = stateYear(state), visible = visibleEvents(data, timeline, seconds), box = chartBox(format);
    const out = clamp((state.time - (timeline.outroStart - .24)) / .24);
    veil = Math.max(1 - clamp((state.time - timeline.introSeconds) / .2), out);
    ctx.save();
    if (out > 0) { ctx.beginPath(); ctx.rect(0, portrait ? 160 : 140, w, h - (portrait ? 160 : 140) - 70); ctx.clip(); zoomAbout(ctx, cam.P.x, cam.P.y, 1 + .22 * out ** 2); }
    const avoid = chart(ctx, data, timeline, state, year, box, visible, portrait, cam, light);
    ledger(ctx, data, visible, timeline, state, portrait);
    if (portrait) {
      label(ctx, '1 BURST = 1 MODEL · HEIGHT = ECI · * PREVIEW · — = NOT YET SCORED', 64, 1820, 22, C.muted);
      label(ctx, `ECI: ${data.capability.publisher}, ${data.capability.license} · retrieved ${data.capability.retrievedOn}`, 64, 1847, 20, C.muted);
    } else {
      label(ctx, '* PREVIEW · FOUNTAIN ON THE AXIS / — = NOT YET SCORED BY EPOCH AI', 64, 1010, 19, C.muted);
      label(ctx, 'ONE BURST = ONE MODEL · HEIGHT = ECI · CONSTANT CALENDAR SPEED · LISTS NEWEST FIRST', 1856, 1010, 19, C.muted, 500, 'right');
    }
    if (light.breath > 0) rect(ctx, 0, 150, w, h - 220, rgba(C.bg, .2 * light.breath));
    fireworks(ctx, data, timeline, state, box, portrait, cam);
    callout(ctx, data, timeline, state, cam, box, portrait, avoid);
    ctx.restore();
  }
  if (veil > 0) rect(ctx, 0, 0, w, h, rgba(C.bg, veil));
  header(ctx, w, portrait, data);
  footer(ctx, data, w, h, portrait);
  rect(ctx, 0, h - 3, w * clamp(seconds / timeline.duration), 3, C.gold);
  const fade = clamp((state.time - (timeline.duration - 1)) / 1);
  if (fade > 0) rect(ctx, 0, 0, w, h, rgba(C.bg, smooth(fade)));
  return state;
}
