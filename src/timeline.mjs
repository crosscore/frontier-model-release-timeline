import { day, iso, yearOf } from './data.mjs';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

// Spatial positions are calendar-linear. Presentation time pauses on each date
// so a burst of nearby releases does not flash unreadable labels.
export function makeTimeline(data, { travelSeconds = 16, holdSeconds = 0.85, introSeconds = 3, outroSeconds = 6 } = {}) {
  for (const value of [travelSeconds, holdSeconds, introSeconds, outroSeconds]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('Timeline durations must be positive');
  }
  const start = day(data.startDate), end = day(data.endDate), segments = [], onsets = new Map();
  const targets = new Set([end, ...data.releases.map(event => day(event.date))]);
  for (let year = yearOf(data.startDate) + 1; year <= yearOf(data.endDate); year++) targets.add(day(`${year}-01-01`));
  let at = introSeconds, previous = start;
  const append = (duration, from, to, type) => {
    if (duration <= 0) return;
    segments.push({ fromTime: at, toTime: at + duration, from, to, type }); at += duration;
  };
  for (const target of [...targets].sort((a, b) => a - b)) {
    append((target - previous) / Math.max(1, end - start) * travelSeconds, previous, target, 'travel');
    const events = data.releases.filter(event => day(event.date) === target);
    for (const event of events) onsets.set(event.id, at);
    if (events.length) append(holdSeconds, target, target, 'hold');
    previous = target;
  }
  append(0.9, end, end, 'hold');
  return { segments, onsets, start, end, introSeconds, outroSeconds, outroStart: at, duration: at + outroSeconds };
}

export function stateAt(timeline, seconds) {
  const time = clamp(seconds, 0, timeline.duration);
  if (time < timeline.introSeconds) return { mode: 'intro', day: timeline.start, time, progress: time / timeline.introSeconds };
  if (time >= timeline.outroStart) return { mode: 'outro', day: timeline.end, time, progress: (time - timeline.outroStart) / timeline.outroSeconds };
  const segment = timeline.segments.find(segment => time < segment.toTime) ?? timeline.segments.at(-1);
  const progress = segment ? (time - segment.fromTime) / (segment.toTime - segment.fromTime) : 1;
  return { mode: 'timeline', day: segment ? segment.from + (segment.to - segment.from) * progress : timeline.end, time, progress };
}

export function visibleEvents(data, timeline, seconds) {
  return data.releases.filter(event => seconds >= timeline.onsets.get(event.id));
}
export function calendarPosition(date, year) {
  return (day(date) - day(`${year}-01-01`)) / (day(`${year + 1}-01-01`) - day(`${year}-01-01`));
}
export function stateYear(state) { return yearOf(iso(state.day)); }
