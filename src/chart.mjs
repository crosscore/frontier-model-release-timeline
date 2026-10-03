import { day, yearOf } from './data.mjs';

// Shared chart geometry ("world" coordinates, the whole chart at camera zoom 1): x is the calendar date,
// y the launched model's ECI score. The launch-pace panel sits under the date axis and shares its calendar.
export function chartBox(format) {
  return format === 'portrait' ? { x: 150, y: 990, w: 866, top: 300, radius: 125, pace: { top: 1010, bottom: 1150 } }
    : { x: 140, y: 548, w: 1716, top: 190, radius: 100, pace: { top: 566, bottom: 664 } };
}
export const scoreOf = event => Number.isFinite(event.capability?.score) ? event.capability.score : null;
export function chartScale(data, box) {
  const scores = data.releases.map(scoreOf).filter(v => v !== null);
  const lo = scores.length ? Math.floor((Math.min(...scores) - 4) / 10) * 10 : 100;
  const hi = scores.length ? Math.ceil((Math.max(...scores) + 8) / 10) * 10 : 150;
  const from = day(`${yearOf(data.startDate)}-01-01`), to = day(`${yearOf(data.endDate) + 1}-01-01`);
  return { lo, hi, from, to, x: value => box.x + ((typeof value === 'string' ? day(value) : value) - from) / (to - from) * box.w,
    y: score => box.y - (score - lo) / (hi - lo) * (box.y - box.top),
    day: x => from + (x - box.x) / box.w * (to - from), score: y => lo + (box.y - y) / (box.y - box.top) * (hi - lo) };
}
// A scored launch climbs straight up from its date and bursts at its score; an unscored one stays on the axis.
export function eventPose(data, event, box) {
  const scale = chartScale(data, box), x = scale.x(event.date), score = scoreOf(event);
  return { origin: x, bx: x, by: score === null ? box.y : scale.y(score), scored: score !== null };
}
