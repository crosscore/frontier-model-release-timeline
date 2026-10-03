import { day, iso, yearOf, yearlyStats } from './data.mjs';
import { clamp, smooth, stateAt, stateYear, visibleEvents } from './timeline.mjs';
import { chartBox, chartScale, eventPose, scoreOf } from './chart.mjs';
import { cameraAt } from './camera.mjs';
import { launchesOf, paceAt, pacePeak, PACE_TAU_DAYS } from './pace.mjs';
export { chartBox, chartScale, eventPose, scoreOf };

export const FORMATS = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1920 } };
export const FIREWORK = Object.freeze({ rise: .36, life: 1.9, rays: 68 });
const C = { bg: '#050A14', text: '#F4F3EE', muted: '#ABB7C9', dim: '#697C94', line: '#263348', gold: '#E5D9B4' };
const TAU = Math.PI * 2;
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const labIndex = (data, id) => data.labs.findIndex(lab => lab.id === id);
const rgba = (hex, a) => `${hex}${Math.round(clamp(a) * 255).toString(16).padStart(2, '0')}`;
const mixHex = (a, b, q) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - q) + parseInt(b.slice(i, i + 2), 16) * q).toString(16).padStart(2, '0')).join('');
const easeOut = x => 1 - (1 - clamp(x)) ** 3;
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
// Stars drift against the camera at two depths, so the sky moves with every pan and zoom.
function background(ctx, w, h, t, cam) {
  rect(ctx, 0, 0, w, h, C.bg);
  const ox = cam ? (cam.P.x - cam.cx) * cam.s : 0, oy = cam ? (cam.P.y - cam.cy) * cam.s : 0, zoom = cam ? cam.s : 1;
  glow(ctx, w * .2 + ox * .02, h * .43 + oy * .02, w * .72, '#285879', .16);
  glow(ctx, w * .85 + ox * .03, h * .55 + oy * .03, w * .6, '#523D69', .13);
  const rng = seeded(40), wrap = (v, lo, span) => lo + ((v - lo) % span + span) % span;
  for (let i = 0; i < 95; i++) {
    const depth = i % 2 ? .05 : .12, x = 36 + rng() * (w - 72), y = 170 + rng() * (h * .49), r = (.4 + rng() * .9) * (1 + (zoom - 1) * depth * 2);
    circle(ctx, wrap(x + ox * depth, 36, w - 72), wrap(y + oy * depth, 170, h * .49), r, rgba('#ADCEEE', .09 + .13 * (1 + Math.sin(t * .5 + i)) / 2));
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
// Fireworks are drawn in world coordinates under the camera. `view` carries the camera-dependent parts:
// the visible axis to launch from, the burst radius (it grows with zoom, but slower than the zoom) and a line-width factor.
function rocket(ctx, data, e, lab, age, box, view) {
  // Style follows the lab, never the event: peony, glitter chrysanthemum, double ring.
  const rand = seeded(e.id), { origin, bx, by } = eventPose(data, e, box), style = labIndex(data, e.lab) % 3;
  const base = Math.max(view.baseY, by), height = base - by, radius = view.radius, px = view.px, fall = radius / box.radius;
  const flight = q => ({ x: origin + (bx - origin) * q, y: base - height * (1 - (1 - q) ** 1.7) });
  const c = lab.color;
  if (age < FIREWORK.rise) {
    const q = clamp(age / FIREWORK.rise), head = flight(q);
    for (let j = 0; j < 24; j++) {
      const f = Math.max(0, q - j * .014), p1 = flight(f), p2 = flight(Math.max(0, f - .014));
      line(ctx, p1.x, p1.y, p2.x, p2.y, rgba(c, (1 - j / 24) * .8), 2.5 * (1 - j / 30) * px);
    }
    glow(ctx, head.x, head.y, 30 * px, c, .55); circle(ctx, head.x, head.y, 3 * px, '#FFFFFF');
    return;
  }
  const t = age - FIREWORK.rise, fade = (1 - clamp(t / FIREWORK.life)) ** 1.5;
  if (fade <= 0) return;
  glow(ctx, bx, by, radius * 1.4, c, .25 * Math.exp(-t * 1.4));
  // Local bloom only, never a full-frame white flash.
  const impulse = Math.exp(-t * 10);
  circle(ctx, bx, by, (4 + 11 * (1 - impulse)) * px, rgba('#FFF3DB', impulse * .65), true);
  for (let i = 0; i < FIREWORK.rays; i++) {
    const angle = i / FIREWORK.rays * TAU + (rand() - .5) * .08;
    const speed = style === 2 ? (i % 2 ? .94 + rand() * .05 : .5 + rand() * .05) : .76 + rand() * .25;
    const gravity = (19 + rand() * 8) * fall, tail = style === 1 ? .17 + rand() * .08 : style === 2 ? .07 : .10 + rand() * .055;
    const at = sec => {
      const r = radius * speed * (1 - Math.exp(-sec * 3.4));
      return { x: bx + Math.cos(angle) * r, y: by + Math.sin(angle) * r + gravity * sec * sec };
    };
    const head = at(t), prev = at(Math.max(0, t - tail));
    const sparkle = .68 + .32 * Math.sin(t * 13 + i * 2.3) ** 2;
    line(ctx, prev.x, prev.y, head.x, head.y, rgba(c, fade * sparkle), (i % 5 ? 2.4 : 3.2) * px);
    circle(ctx, head.x, head.y, (i % 7 === 0 ? 2.1 : 1.4) * px, rgba(i % 5 === 0 ? '#FFF3DB' : c, fade));
    if (i % 3 === 0 && t > .32) {
      const extra = at(Math.max(0, t - .17));
      circle(ctx, extra.x, extra.y, .75 * px, rgba('#FCDFB1', fade * .5));
    }
    if (style === 1 && i % 2 === 0 && t > .22 && Math.sin(t * 47 + i * 1.9) > .2) {
      const glint = at(Math.max(0, t - .05));
      circle(ctx, glint.x + Math.cos(i * 7.1) * 5 * px, glint.y + Math.sin(i * 3.7) * 5 * px, 1.3 * px, rgba('#FFF3DB', fade * .85));
    }
  }
  const tailFade = Math.exp(-t * 3) * .4;
  line(ctx, origin, base, bx, by, rgba(c, tailFade), px);
}
// Launches without a published score spray a low fountain from the date axis instead of claiming a height.
function fountain(ctx, e, lab, age, x, view) {
  const rand = seeded(e.id), c = lab.color, r = view.radius, y0 = view.baseY, px = view.px;
  if (age < FIREWORK.rise) {
    const q = clamp(age / FIREWORK.rise);
    glow(ctx, x, y0, (16 + 18 * q) * px, c, .2 + .35 * q); circle(ctx, x, y0 - 2 * px, 2.5 * px, '#FFFFFF');
    return;
  }
  const t = age - FIREWORK.rise, fade = (1 - clamp(t / FIREWORK.life)) ** 1.3;
  if (fade <= 0) return;
  glow(ctx, x, y0, r * .7, c, .22 * Math.exp(-t * 1.6));
  for (let i = 0; i < 46; i++) {
    const birth = rand() * .95, angle = -Math.PI / 2 + (rand() - .5) * .75, speed = r * (2.3 + rand() * .7);
    const at = s => ({ x: x + Math.cos(angle) * speed * s, y: y0 + Math.sin(angle) * speed * s + r * 3.6 * s * s });
    const s = t - birth;
    if (s < 0 || s > .8) continue;
    const head = at(s), prev = at(Math.max(0, s - .07)), life = 1 - s / .8;
    line(ctx, prev.x, prev.y, head.x, head.y, rgba(c, fade * life), 2 * px);
    circle(ctx, head.x, head.y, 1.4 * px, rgba(i % 4 ? c : '#FFF3DB', fade * life));
  }
}
// The year counter punches up and flashes gold as each year begins; the launch count pops with each arrival.
// Returns the counter's bounding box so the burst callout can keep clear of it.
function counter(ctx, data, timeline, state, year, visible, box, portrait) {
  const c = portrait ? { x: box.x + 30, y: 440, size: 124, sub: 490, subSize: 30, ytd: 532, ytdSize: 22 } : { x: box.x + 32, y: 302, size: 104, sub: 346, subSize: 25, ytd: 382, ytdSize: 20 };
  const jan = timeline.introSeconds + (day(`${year}-01-01`) - timeline.start) / Math.max(1, timeline.end - timeline.start) * timeline.travelSeconds;
  const turn = year > yearOf(data.startDate) ? Math.exp(-Math.max(0, state.time - jan) / .18) : 0, size = c.size * (1 + .16 * turn);
  label(ctx, String(year), c.x, c.y, size, mixHex('#8394AB', C.gold, turn), 500);
  let right = c.x + ctx.measureText(String(year)).width;
  const thisYear = visible.filter(e => e.date.startsWith(String(year))), count = thisYear.length;
  const pop = count ? Math.exp(-(state.time - timeline.onsets.get(thisYear.at(-1).id)) / .12) : 0;
  label(ctx, `${months[Number(iso(state.day).slice(5, 7)) - 1]} · ${count} ${count === 1 ? 'LAUNCH' : 'LAUNCHES'}`, c.x + 4, c.sub, c.subSize * (1 + .12 * pop), C.text, 500);
  right = Math.max(right, c.x + 4 + ctx.measureText('DEC · 00 LAUNCHES').width * (1 + .12 * pop));
  let bottom = c.sub + 8;
  if (year === yearOf(data.endDate)) { label(ctx, `YTD · THROUGH ${data.endDate.slice(5)}`, c.x + 4, c.ytd, c.ytdSize, C.gold); bottom = c.ytd + 8; }
  return { left: c.x - 8, top: c.y - size * .78, right: right + 12, bottom };
}
// The newest launch's name tag rides next to its burst for just over a second, sliding in from the side.
// Same-day launches share one stacked tag.
function callout(ctx, data, timeline, state, cam, box, visible, portrait, avoid) {
  const latest = visible.at(-1), life = 1.2;
  if (!latest) return;
  const onset = timeline.onsets.get(latest.id), age = state.time - onset;
  if (age >= life) return;
  const group = visible.filter(e => timeline.onsets.get(e.id) === onset).sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
  const pose = eventPose(data, group[0], box), point = cam.toScreen(pose.bx, pose.by);
  const ax = point.x, ay = pose.scored ? point.y : box.y - (portrait ? 160 : 100);
  const nameSize = portrait ? 40 : 34, subSize = portrait ? 23 : 19, rowH = nameSize + subSize + (portrait ? 26 : 20), gap = portrait ? 36 : 32;
  const rows = group.map(e => ({ name: modelLabel(e, portrait), sub: scoreOf(e) === null ? 'NOT YET SCORED' : `ECI ${Math.round(scoreOf(e))}`, color: data.labs.find(l => l.id === e.lab).color }));
  let width = 0;
  for (const r of rows) { ctx.font = `600 ${nameSize}px Manrope600`; width = Math.max(width, ctx.measureText(r.name).width); ctx.font = `600 ${subSize}px Manrope600`; width = Math.max(width, ctx.measureText(r.sub).width); }
  const height = rows.length * rowH - (portrait ? 18 : 14), right = box.x + box.w - 12;
  let x = ax + gap > right - width ? ax - gap - width : ax + gap, top = ay - height / 2;
  x = clamp(x, box.x + 12, right - width);
  const fitY = v => clamp(v, box.top + 10, box.y - 16 - height);
  top = fitY(top);
  if (x < avoid.right && x + width > avoid.left && top < avoid.bottom && top + height > avoid.top) {
    top = fitY(avoid.bottom + 14);
    if (top < avoid.bottom) x = Math.min(right - width, avoid.right + 20);
  }
  const a = easeOut(age / .12) * clamp((life - age) / .3), slide = (1 - easeOut(age / .22)) * (x > ax ? 28 : -28);
  ctx.save(); ctx.globalAlpha = a;
  const edge = x > ax ? x - 10 : x + width + 10;
  line(ctx, ax, ay, edge + slide, top + nameSize * .45, rgba(rows[0].color, .55), 1.5);
  ctx.shadowColor = rgba(C.bg, .9); ctx.shadowBlur = 14;
  rows.forEach((r, i) => {
    const y = top + nameSize * .78 + i * rowH;
    label(ctx, r.name, x + slide, y, nameSize, C.text, 600);
    label(ctx, r.sub, x + slide, y + subSize + 10, subSize, r.color, 600);
  });
  ctx.restore();
}
// Launch pace under the chart, like an indicator under a price chart: it shares the camera's calendar, and its
// scale widens whenever the pace sets a new high, so the gridlines crowd in as launches speed up. Each launch kicks
// the line up as it bursts.
function pacePanel(ctx, data, timeline, state, box, visible, portrait, cam) {
  const pb = box.pace, scale = chartScale(data, box), right = box.x + box.w, sx = d => cam.toScreen(scale.x(d), 0).x;
  const launches = launchesOf(visible, e => easeOut((state.time - timeline.onsets.get(e.id)) / .3));
  const top = Math.max(1.5, 1.35 * pacePeak(launches)), py = v => pb.bottom - v / top * (pb.bottom - pb.top);
  const every = (pb.bottom - pb.top) / top < (portrait ? 30 : 22) ? 2 : 1;
  for (let v = 1; v < top; v++) {
    const a = clamp((top - v) / .35);
    line(ctx, box.x, py(v), right, py(v), rgba('#1A273D', a));
    if (v % every === 0) { ctx.globalAlpha = a; label(ctx, String(v), box.x - 16, py(v) + (portrait ? 7 : 5), portrait ? 20 : 15, C.dim, 500, 'right'); ctx.globalAlpha = 1; }
  }
  line(ctx, box.x, pb.bottom, right, pb.bottom, '#42506B');
  ctx.save(); ctx.beginPath(); ctx.rect(box.x, pb.top - 14, box.w, pb.bottom - pb.top + 14); ctx.clip();
  for (let y = yearOf(data.startDate) + 1; y <= yearOf(data.endDate) + 1; y++) { const x = sx(day(`${y}-01-01`)); line(ctx, x, pb.top, x, pb.bottom, '#17233A'); }
  const nowX = sx(state.day);
  line(ctx, nowX, pb.top, nowX, pb.bottom, rgba(C.gold, .16));
  // Sample the visible stretch every few pixels, plus both sides of each launch so the kicks stay vertical.
  const d0 = Math.max(scale.from, scale.day(cam.toWorld(box.x, 0).x)), d1 = Math.min(state.day, scale.day(cam.toWorld(right, 0).x));
  if (d1 > d0) {
    const n = Math.max(1, Math.ceil((sx(d1) - sx(d0)) / 3)), days = Array.from({ length: n + 1 }, (_, k) => d0 + (d1 - d0) * k / n);
    for (const l of launches) if (l.day > d0 && l.day <= d1) days.push(l.day - 1e-6, l.day);
    const pts = days.sort((a, b) => a - b).map(d => ({ x: sx(d), y: py(paceAt(launches, d)) }));
    ctx.beginPath(); ctx.moveTo(pts[0].x, pb.bottom); for (const p of pts) ctx.lineTo(p.x, p.y); ctx.lineTo(pts.at(-1).x, pb.bottom); ctx.closePath();
    const fill = ctx.createLinearGradient(0, pb.top, 0, pb.bottom); fill.addColorStop(0, rgba(C.gold, .3)); fill.addColorStop(1, rgba(C.gold, .02));
    ctx.fillStyle = fill; ctx.fill();
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = C.gold; ctx.lineWidth = portrait ? 3 : 2.4; ctx.lineJoin = 'round'; ctx.stroke();
  }
  // A ring in the lab's colour opens where each launch kicks the line.
  for (const e of visible) {
    const age = state.time - timeline.onsets.get(e.id), d = day(e.date);
    if (age < .6) circle(ctx, sx(d), py(paceAt(launches, d)), (4 + 24 * easeOut(age / .6)) * (portrait ? 1.2 : 1), rgba(data.labs.find(l => l.id === e.lab).color, 1 - age / .6), true);
  }
  ctx.restore();
  label(ctx, `LAUNCH PACE · LAUNCHES PER 30 DAYS · ${PACE_TAU_DAYS}-DAY EMA`, box.x + 10, pb.top + (portrait ? 20 : 16), portrait ? 19 : 15, C.gold, 600);
  // The head carries its live value, like the last price on a trading chart, and pops with each launch.
  if (nowX < box.x || nowX > right) return;
  const value = paceAt(launches, state.day), y = py(value), last = visible.at(-1);
  const pop = last ? Math.exp(-(state.time - timeline.onsets.get(last.id)) / .14) : 0, size = (portrait ? 26 : 21) * (1 + .25 * pop);
  ctx.setLineDash([3, 6]); line(ctx, nowX, y, right, y, rgba(C.gold, .4)); ctx.setLineDash([]);
  glow(ctx, nowX, y, 20 + 14 * pop, C.gold, .45 + .3 * pop); circle(ctx, nowX, y, 3.5, C.text);
  ctx.font = `600 ${Math.round(size)}px Manrope600`;
  const text = value.toFixed(1), width = ctx.measureText(text).width;
  const tx = nowX + 14 + width > right - 4 ? nowX - 14 - width : nowX + 14;
  label(ctx, text, tx, clamp(y + size * .36, pb.top + size * .8, pb.bottom - 5), size, mixHex(C.gold, '#FFFFFF', pop * .6), 600);
}
function chart(ctx, data, timeline, state, year, box, visible, portrait, cam) {
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
  const world = () => { ctx.translate(cam.P.x + cam.dx - cam.cx * cam.s, cam.P.y + cam.dy - cam.cy * cam.s); ctx.scale(cam.s, cam.s); };
  // Step lines and markers stay inside the plot; their strokes thicken a little as the camera closes in.
  const thin = cam.s ** -.7;
  ctx.save(); ctx.beginPath(); ctx.rect(box.x, clipTop, box.w, box.y + 4 - clipTop); ctx.clip();
  line(ctx, nowX, box.top, nowX, box.y, rgba(C.gold, .16));
  world();
  frontierLines(ctx, data, timeline, visible, box, state.time, scale.x(state.day), .62, (portrait ? 3 : 2.2) * thin);
  const latest = new Set(data.labs.map(lab => visible.filter(e => e.lab === lab.id && scoreOf(e) !== null).at(-1)));
  for (const e of visible) if (scoreOf(e) !== null) {
    if (latest.has(e)) { const { bx, by } = eventPose(data, e, box); glow(ctx, bx, by, (portrait ? 30 : 22) * thin, data.labs.find(l => l.id === e.lab).color, .35); }
    marker(ctx, data, e, box, latest.has(e) ? .95 : .6, (portrait ? 6.5 : 4.8) * thin);
  }
  ctx.restore();
  // Bursts may spill past the plot's sides; rockets launch from the visible axis.
  const view = { baseY: Math.min(box.y, cam.toWorld(0, box.y).y), radius: box.radius * cam.s ** -.45, px: cam.s ** -.5 };
  ctx.save(); ctx.beginPath(); ctx.rect(0, clipTop, W, box.y + 4 - clipTop); ctx.clip(); world();
  for (const event of activeFireworks(data, timeline, state.time)) {
    const age = state.time - timeline.onsets.get(event.id) + FIREWORK.rise, lab = data.labs.find(l => l.id === event.lab);
    if (scoreOf(event) === null) fountain(ctx, event, lab, age, scale.x(event.date), view); else rocket(ctx, data, event, lab, age, box, view);
  }
  ctx.restore();
  pacePanel(ctx, data, timeline, state, box, visible, portrait, cam);
  // The date axis is pinned to the bottom of the plot and repeated under the pace panel, where its labels sit;
  // ticks and labels slide and spread with the camera.
  const pb = box.pace, labelY = pb.bottom + (portrait ? 40 : 28);
  line(ctx, box.x, box.y, right, box.y, '#42506B');
  if (end < right) {
    for (const base of [box.y, pb.bottom]) for (let x = Math.max(box.x, end); x < right; x += 16) line(ctx, x, base - 4, Math.min(right, x + 5), base + 4, C.dim);
    label(ctx, 'UNOBSERVED', right, pb.bottom + (portrait ? 70 : 56), portrait ? 22 : 17, C.muted, 500, 'right');
  }
  const quarter = clamp((cam.s - 1.5) / .4);
  for (let y = yearOf(data.startDate); y <= yearOf(data.endDate) + 1; y++) {
    const x = sx(scale.x(`${y}-01-01`)), size = portrait ? 26 : 18;
    if (x >= box.x - .5 && x <= right + .5) {
      line(ctx, x, box.y, x, box.y + 12, '#697B93'); line(ctx, x, pb.bottom, x, pb.bottom + 10, '#697B93');
      if (y <= yearOf(data.endDate)) { ctx.font = `500 ${size}px Manrope500`; if (x + 8 + ctx.measureText(String(y)).width <= W - 8) label(ctx, String(y), x + 8, labelY, size, C.muted); }
    }
    if (y > yearOf(data.endDate)) continue;
    for (const m of [4, 7, 10]) {
      const q = sx(scale.x(`${y}-${String(m).padStart(2, '0')}-01`));
      if (q < box.x || q > right) continue;
      line(ctx, q, box.y, q, box.y + 6, '#3A4860'); line(ctx, q, pb.bottom, q, pb.bottom + 6, '#3A4860');
      if (quarter > .02 && q + 40 < right) { ctx.globalAlpha = quarter; label(ctx, months[m - 1], q + 6, labelY, portrait ? 19 : 14, C.dim); ctx.globalAlpha = 1; }
    }
  }
  for (const e of visible) {
    const x = sx(scale.x(e.date));
    if (x < box.x || x > right) continue;
    const lab = data.labs.find(l => l.id === e.lab), offset = (labIndex(data, e.lab) - (data.labs.length - 1) / 2) * 8;
    circle(ctx, x, box.y + offset, 3.5, lab.color, e.stage === 'preview');
  }
  if (nowX >= box.x && nowX <= right) { line(ctx, nowX, box.y - 19, nowX, box.y + 15, C.gold, 2); circle(ctx, nowX, box.y, 3, C.text); }
  const avoid = counter(ctx, data, timeline, state, year, visible, box, portrait);
  callout(ctx, data, timeline, state, cam, box, visible, portrait, avoid);
}
export function modelLabel(event, portrait = false) {
  const full = event.name + (event.stage === 'preview' ? ' *' : '');
  return portrait ? full.replace(/^Claude (?=[A-Za-z])/, '') : full;
}
// Newest first. An arrival enters at the top and pushes older names down one row; the fifth fades out.
const PUSH_SECONDS = .28;
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
  const y = portrait ? 1290 : 767, rowH = portrait ? 91 : 49, top = y + (portrait ? 54 : 58);
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
// Scale the drawing about a point; text keeps its own coordinates, so layout checks still see the unscaled design.
function zoomAbout(ctx, x, y, k) { ctx.translate(x, y); ctx.scale(k, k); ctx.translate(-x, -y); }
// Title card: lines cascade in on the beat while the card drifts closer, then it zooms through into the chart.
function intro(ctx, data, timeline, state, w, h, portrait) {
  const t = state.time, exit = clamp((t - (timeline.introSeconds - .24)) / .24), y = portrait ? 708 : 417;
  const enter = at => easeOut((t - at) / .3), slide = (at, x) => x - (1 - enter(at)) * 90;
  ctx.save(); zoomAbout(ctx, w * .3, h * .5, 1 + .035 * t / timeline.introSeconds + .25 * exit ** 2);
  const show = (at, draw) => { ctx.globalAlpha = enter(at) * (1 - exit); draw(); };
  show(0, () => label(ctx, 'NEW MODELS.', slide(0, 64), y, portrait ? 106 : 120, C.text, 500));
  show(.12, () => label(ctx, 'LESS QUIET.', slide(.12, 64), y + (portrait ? 127 : 136), portrait ? 106 : 120, C.gold, 500));
  show(.3, () => label(ctx, 'One launch. One spark.', slide(.3, 69), y + (portrait ? 239 : 232), 37, C.muted));
  show(.4, () => label(ctx, 'Each burst lands at its capability score.', slide(.4, 69), y + (portrait ? 302 : 290), portrait ? 29 : 30, C.muted));
  const sy = portrait ? 1207 : 790, gx = 64 + (w - 128) * smooth((t - .5) / (timeline.introSeconds - .7));
  show(.5, () => {
    glow(ctx, gx, sy, portrait ? 200 : 270, data.labs[0].color, .35);
    const g = ctx.createLinearGradient(64, sy, w - 64, sy);
    data.labs.forEach((lab, i) => g.addColorStop(i / (data.labs.length - 1), lab.color));
    line(ctx, 64, sy, w - 64, sy, '#364256'); line(ctx, 64, sy, gx, sy, g, 2);
    circle(ctx, gx, sy, 4, C.text);
  });
  show(.6, () => {
    label(ctx, `${data.startDate.slice(0, 4)} — ${data.endDate.slice(0, 4)}`, slide(.6, 64), sy + 83, 34, C.text);
    label(ctx, `${data.releases.length} selected launches · ${['', 'one', 'two', 'three'][data.labs.length]} labs · scores from ${data.capability.publisher}`, slide(.6, 64), sy + 134, portrait ? 27 : 29, C.muted);
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
  show(.1);
  label(ctx, first.daysPerLaunch?.toFixed(0) ?? '—', p, valueY, portrait ? 164 : 166, C.text);
  label(ctx, '→', portrait ? 403 : 640, valueY - 23, 76, C.dim);
  const count = Number.isFinite(first.daysPerLaunch) && Number.isFinite(last.daysPerLaunch) ? first.daysPerLaunch + (last.daysPerLaunch - first.daysPerLaunch) * easeOut((t - .15) / .9) : null;
  label(ctx, count?.toFixed(1) ?? '—', rightX, valueY, portrait ? 136 : 166, C.gold);
  label(ctx, String(first.year), p + 5, valueY + 54, 27, C.muted);
  label(ctx, `${last.year}${last.partial ? ' YTD' : ''}`, rightX + 4, valueY + 54, 27, C.muted);
  show(.2);
  label(ctx, 'CALENDAR DAYS / SELECTED LAUNCH', p, valueY + 118, portrait ? 23 : 25, C.gold);
  const best = year => Math.max(...data.releases.filter(e => yearOf(e.date) === year).map(scoreOf).filter(v => v !== null));
  const [low, high] = [best(first.year), best(last.year)];
  if (Number.isFinite(low) && Number.isFinite(high)) {
    show(.35);
    const shown = Math.round(low + (high - low) * easeOut((t - .35) / 1.1));
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
    const y = top + i * step, bx = portrait ? 278 : 315, bw = portrait ? 535 : 1040, at = .25 + i * .08;
    show(at);
    label(ctx, String(row.year) + (row.partial ? ' YTD' : ''), p, y + 18, portrait ? 27 : 24, C.muted);
    line(ctx, bx, y + 5, bx + bw, y + 5, '#1B293C', 7);
    line(ctx, bx, y + 5, bx + bw * (row.daysPerLaunch ?? 0) / max * easeOut((t - at) / .7), y + 5, i === rows.length - 1 ? C.gold : '#739EAD', 7);
    label(ctx, row.daysPerLaunch?.toFixed(1) ?? '—', bx + bw + 26, y + 18, portrait ? 30 : 28, C.text);
    if (portrait) label(ctx, `${row.observedDays} days / ${row.count} launches`, bx, y + 55, 22, C.dim);
    else label(ctx, `${row.observedDays} days / ${row.count} launches`, w - 64, y + 18, 21, C.dim, 500, 'right');
  }
  const ny = portrait ? 1575 : 952;
  show(.7);
  label(ctx, 'Launch density, not development time.', p, ny, portrait ? 30 : 27, C.text);
  label(ctx, 'A curated sample. Changing the selection changes the result.', p, ny + 43, portrait ? 23 : 22, C.muted);
  if (portrait) { label(ctx, 'EDIT THE DATA. REPLAY THE SKY.', p, 1716, 29, C.gold); label(ctx, 'crosscore / frontier-model-release-timeline', p, 1763, 23, C.dim); }
  ctx.restore();
}
export function drawFrame(ctx, data, timeline, seconds, format = 'landscape') {
  const { width: w, height: h } = FORMATS[format], portrait = format === 'portrait', state = stateAt(timeline, seconds);
  const cam = state.mode === 'timeline' ? cameraAt(data, timeline, format, state.time) : null;
  background(ctx, w, h, seconds, cam);
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
    chart(ctx, data, timeline, state, year, box, visible, portrait, cam);
    if (portrait) { label(ctx, '1 BURST = 1 LAUNCH · HEIGHT = ECI', 64, 1718, 30, C.muted); label(ctx, `ECI: ${data.capability.publisher}, ${data.capability.license} · retrieved ${data.capability.retrievedOn}`, 64, 1761, 26, C.muted); }
    else label(ctx, 'ONE BURST = ONE LAUNCH · HEIGHT = ECI SCORE · CONSTANT CALENDAR SPEED', 64, 720, 19, C.muted);
    ledger(ctx, data, visible, timeline, state, year, w, portrait);
    if (portrait) { label(ctx, '* PREVIEW · FOUNTAIN / — = NOT YET SCORED', 64, 1810, 24, C.muted); }
    else label(ctx, '* PREVIEW · FOUNTAIN ON THE AXIS / — = NOT YET SCORED BY EPOCH AI', 64, 1010, 19, C.muted);
    ctx.restore();
  }
  if (veil > 0) rect(ctx, 0, 0, w, h, rgba(C.bg, veil));
  header(ctx, w, portrait, data);
  footer(ctx, data, w, h, portrait);
  rect(ctx, 0, h - 3, w * clamp(seconds / timeline.duration), 3, C.gold);
  return state;
}
