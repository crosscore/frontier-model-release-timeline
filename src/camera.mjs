import { chartBox, chartScale, eventPose, scoreOf } from './chart.mjs';
import { BAR_SECONDS, clamp, cuePoints, smooth, stateAt } from './timeline.mjs';

// A virtual camera over the chart. The camera frames world coordinates (the whole chart at zoom 1)
// inside the same plot window: it dives in after the intro, follows the calendar and the recent scores,
// tightens in slow stages through the build and pulls back once, at the drop, to the whole chart. It never
// bumps, shakes or punches in: zoom and position depend only on film time and the launch dates and scores,
// never on beats or burst impacts, so any frame renders identically on its own.
const FRAMING = {
  landscape: { lead: .64, eye: .42, zoom: [2.05, 2.35], build: 2.65, breath: 3.1, left: 200, right: 40, below: 30, above: 130 },
  portrait: { lead: .6, eye: .4, zoom: [1.8, 2.1], build: 2.35, breath: 2.75, left: 110, right: 30, below: 30, above: 150 },
};
const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2; };
// Starts and ends at rest like easeInOut, but peaks a third of the way in, so the pullback answers the drop
// promptly without a jolt.
const release = x => { x = clamp(x); return 1 - (1 - x) ** 3 * (1 + 3 * x); };
export const DIVE_SECONDS = .95, REVEAL_SECONDS = .7;
// Soft limits round off the moment the frame meets a chart edge or the zoom meets its ceiling, instead of
// stopping the motion dead.
const softMin = (a, b, k) => Math.min(a, b) - k * Math.log1p(Math.exp(-Math.abs(a - b) / k));
const softClamp = (v, lo, hi, k) => hi < lo ? (lo + hi) / 2 : -softMin(-softMin(v, hi, k), -lo, k);

const plans = new WeakMap();
function plan(data, timeline, format) {
  const cached = plans.get(timeline)?.[format];
  if (cached?.data === data) return cached;
  const box = chartBox(format), scale = chartScale(data, box), points = cuePoints(timeline);
  const scored = data.releases.filter(e => scoreOf(e) !== null).map(e => ({ onset: timeline.onsets.get(e.id), y: eventPose(data, e, box).by }));
  const result = { data, box, scale, points, scored, P: { x: box.x + box.w / 2, y: (box.top + box.y) / 2 }, f: FRAMING[format] };
  plans.set(timeline, { ...plans.get(timeline), [format]: result });
  return result;
}
// Where the camera wants to be while it tracks the calendar: "now" at a fixed lead, the recent bursts at eye height.
function follow(p, timeline, t) {
  const { box, scale, points, f, P } = p;
  // Three slow stages, each easing in and out: across the calendar, through the build, and into the drop.
  let s = f.zoom[0] + (f.zoom[1] - f.zoom[0]) * smooth((t - points.intro) / Math.max(.001, points.build - points.intro));
  s += (f.build - f.zoom[1]) * easeInOut((t - points.build) / Math.max(.001, points.breath - points.build));
  s += (f.breath - f.build) * easeInOut((t - points.breath) / Math.max(.001, points.drop - points.breath));
  // Gaussian-weighted height and spread of the bursts around now; a wide spread loosens the zoom so both ends stay in frame.
  let sw = 1e-9, sy = 1e-9 * P.y, sq = 1e-9 * P.y * P.y;
  const calendarScale = timeline.travelSeconds / (12 * BAR_SECONDS);
  for (const e of p.scored) { const w = Math.exp(-.5 * ((t - e.onset + .25 * calendarScale) / (.9 * calendarScale)) ** 2); sw += w; sy += w * e.y; sq += w * e.y * e.y; }
  const eye = sy / sw, spread = Math.sqrt(Math.max(0, sq / sw - eye * eye));
  s = softMin(s, -softMin(-1.2, -(box.y - box.top) * .5 / (2 * spread + 30), .05), .06);
  const nowX = scale.x(stateAt(timeline, t).day);
  let cx = nowX - (box.x + f.lead * box.w - P.x) / s, cy = eye - (box.top + f.eye * (box.y - box.top) - P.y) / s;
  cx = softClamp(cx, box.x - f.left - (box.x - P.x) / s, box.x + box.w + f.right - (box.x + box.w - P.x) / s, 10);
  cy = softClamp(cy, box.top - f.above - (box.top - P.y) / s, box.y + f.below - (box.y - P.y) / s, 10);
  return { s, cx, cy };
}
export function cameraAt(data, timeline, format, t) {
  const p = plan(data, timeline, format), { points, P } = p;
  // Weight of the tracking shot: it dives in after the intro and releases into the whole chart at the drop,
  // then holds that framing through the summary transition.
  const w = t < points.drop ? easeInOut((t - points.intro) / DIVE_SECONDS) : 1 - release((t - points.drop) / REVEAL_SECONDS);
  let s = 1, cx = P.x, cy = P.y;
  if (w > 0) {
    const shot = follow(p, timeline, Math.min(t, points.drop));
    s = 1 / (1 - w + w / shot.s); cx += (shot.cx - P.x) * w; cy += (shot.cy - P.y) * w;
  }
  const toScreen = (x, y) => ({ x: P.x + (x - cx) * s, y: P.y + (y - cy) * s });
  const toWorld = (x, y) => ({ x: cx + (x - P.x) / s, y: cy + (y - P.y) / s });
  return { s, cx, cy, P, toScreen, toWorld };
}
