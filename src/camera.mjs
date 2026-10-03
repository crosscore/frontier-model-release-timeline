import { chartBox, chartScale, eventPose, scoreOf } from './chart.mjs';
import { BAR_SECONDS, clamp, cuePoints, kickTimes, smooth, stateAt } from './timeline.mjs';

// A virtual camera over the chart. The camera frames world coordinates (the whole chart at zoom 1)
// inside the same plot window: it dives in after the intro, tracks the calendar and the newest
// scores, tightens through the build, punches in on each burst and pulls back to the whole chart
// at the drop. It is a pure function of film time, so any frame renders identically on its own.
const FRAMING = {
  landscape: { lead: .64, eye: .42, zoom: [2.05, 2.35], build: 2.65, breath: 3.1, left: 200, right: 40, below: 30, above: 130 },
  portrait: { lead: .6, eye: .4, zoom: [1.8, 2.1], build: 2.35, breath: 2.75, left: 110, right: 30, below: 30, above: 150 },
};
const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2; };
const easeOut = x => 1 - (1 - clamp(x)) ** 3;
const easeIn = x => clamp(x) ** 3;
export const DIVE_SECONDS = .95, REVEAL_SECONDS = .7;

const plans = new WeakMap();
function plan(data, timeline, format) {
  const cached = plans.get(timeline)?.[format];
  if (cached?.data === data) return cached;
  const box = chartBox(format), scale = chartScale(data, box), points = cuePoints(timeline), best = new Map();
  const events = data.releases.map((e, i) => {
    const pose = eventPose(data, e, box), score = scoreOf(e), record = score !== null && score > (best.get(e.lab) ?? -Infinity);
    if (record) best.set(e.lab, score);
    return { onset: timeline.onsets.get(e.id), x: pose.bx, y: pose.by, scored: score !== null, record, phase: i * 2.399 };
  });
  // Nearby bursts share the punch, like the launch cues share their loudness.
  for (const e of events) e.amp = (e.record ? .09 : e.scored ? .055 : .035) / Math.sqrt(events.filter(o => Math.abs(o.onset - e.onset) < .35).length);
  const result = { data, box, scale, points, events, scored: events.filter(e => e.scored), kicks: kickTimes(points), P: { x: box.x + box.w / 2, y: (box.top + box.y) / 2 }, f: FRAMING[format] };
  plans.set(timeline, { ...plans.get(timeline), [format]: result });
  return result;
}
// Where the camera wants to be while it tracks the calendar: "now" at a fixed lead, the recent bursts at eye height.
function follow(p, timeline, t) {
  const { box, scale, points, f, P } = p, q = clamp((t - points.intro) / Math.max(.001, points.build - points.intro));
  let s = f.zoom[0] + (f.zoom[1] - f.zoom[0]) * q;
  s += (f.build - f.zoom[1]) * easeInOut((t - points.build) / Math.max(.001, points.breath - points.build));
  s += (f.breath - f.build) * easeIn((t - points.breath) / Math.max(.001, points.drop - points.breath));
  s *= 1 + .03 * Math.sin(Math.PI * (t - points.intro) / (2 * BAR_SECONDS));
  // A quick pull-back and return on the crash that opens each new groove (bars 5 and 9).
  for (const at of [.4, .8].map(q => points.intro + q * (points.build - points.intro))) {
    const u = t - at + .12;
    if (u > 0 && u < 1.6) s *= 1 - .32 * Math.sin(Math.PI * Math.min(1, u / .24) / 2) * Math.exp(-Math.max(0, u - .24) / .3);
  }
  // Gaussian-weighted height and spread of the bursts around now; a wide spread loosens the zoom so both ends stay in frame.
  let sw = 1e-9, sy = 1e-9 * P.y, sq = 1e-9 * P.y * P.y;
  for (const e of p.scored) { const w = Math.exp(-.5 * ((t - e.onset + .25) / .9) ** 2); sw += w; sy += w * e.y; sq += w * e.y * e.y; }
  const eye = sy / sw, spread = Math.sqrt(Math.max(0, sq / sw - eye * eye));
  s = Math.min(s, Math.max(1.2, (box.y - box.top) * .5 / (2 * spread + 30)));
  const nowX = scale.x(stateAt(timeline, t).day);
  let cx = nowX - (box.x + f.lead * box.w - P.x) / s, cy = eye - (box.top + f.eye * (box.y - box.top) - P.y) / s;
  cx = clamp(cx, box.x - f.left - (box.x - P.x) / s, box.x + box.w + f.right - (box.x + box.w - P.x) / s);
  cy = clamp(cy, box.top - f.above - (box.top - P.y) / s, box.y + f.below - (box.y - P.y) / s);
  return { s, cx, cy };
}
export function cameraAt(data, timeline, format, t) {
  const p = plan(data, timeline, format), { points, P } = p;
  // Weight of the tracking shot: it dives in after the intro and releases into the whole chart at the drop,
  // which then drifts slowly closer until the summary.
  const w = t < points.drop ? easeInOut((t - points.intro) / DIVE_SECONDS) : 1 - easeOut((t - points.drop) / REVEAL_SECONDS);
  const wide = 1 + .04 * smooth((t - points.drop) / Math.max(.001, points.outro - points.drop));
  let s = wide, cx = P.x, cy = P.y;
  if (w > 0) {
    const shot = follow(p, timeline, Math.min(t, points.drop));
    s = 1 / ((1 - w) / wide + w / shot.s); cx += (shot.cx - P.x) * w; cy += (shot.cy - P.y) * w;
  }
  // Punch-ins toward each burst (stronger when it sets a lab's best score), a kick on the drop and a bump on each beat.
  let k = 1, qx = 0, qy = 0, qw = 0, dx = 0, dy = 0;
  const live = t >= points.intro && t < points.outro;
  for (const e of live ? p.events : []) {
    const u = t - e.onset;
    if (u < 0 || u > 1.5) continue;
    const a = e.amp * (1 - Math.exp(-u / .03)) * Math.exp(-u / .22), shake = e.amp * 190 * Math.exp(-u / .11);
    k += a; qx += a * e.x; qy += a * e.y; qw += a;
    dx += shake * Math.sin(u * 83 + e.phase); dy += shake * Math.cos(u * 71 + e.phase * 1.7);
  }
  const ud = t - points.drop;
  if (live && ud >= 0) {
    const a = .09 * (1 - Math.exp(-ud / .02)) * Math.exp(-ud / .3), shake = 22 * Math.exp(-ud / .16);
    k += a; qx += a * cx; qy += a * cy; qw += a; dx += shake * Math.sin(ud * 97); dy += shake * Math.cos(ud * 89);
  }
  for (const kick of live ? p.kicks : []) {
    const u = t - kick;
    if (u < 0 || u > .45) continue;
    const a = .012 * Math.exp(-u / .09);
    k += a; qx += a * cx; qy += a * cy; qw += a;
  }
  if (qw > 0) { cx += (1 - 1 / k) * (qx / qw - cx); cy += (1 - 1 / k) * (qy / qw - cy); }
  s *= k;
  const toScreen = (x, y) => ({ x: P.x + (x - cx) * s + dx, y: P.y + (y - cy) * s + dy });
  const toWorld = (x, y) => ({ x: cx + (x - P.x - dx) / s, y: cy + (y - P.y - dy) / s });
  return { s, cx, cy, dx, dy, P, toScreen, toWorld };
}
