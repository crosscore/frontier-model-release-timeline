import { day, iso, yearOf } from './data.mjs';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

// One continuous clock: a real-world day always has the same film duration.
// Names accumulate in the ledger instead of stopping time at crowded launches.
// Defaults fill exactly 16 bars at 128 BPM (30 s): 1 intro, 12 travel, 1 hold, 2 outro.
export const BAR_SECONDS = 60 / 128 * 4;
export function makeTimeline(data, { travelSeconds = 12 * BAR_SECONDS, holdSeconds = BAR_SECONDS, introSeconds = BAR_SECONDS, outroSeconds = 2 * BAR_SECONDS } = {}) {
  for (const value of [travelSeconds, holdSeconds, introSeconds, outroSeconds]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('Timeline durations must be positive');
  }
  const start = day(data.startDate), end = day(data.endDate), segments = [], onsets = new Map();
  let at = introSeconds;
  const append = (duration, from, to, type) => {
    if (duration <= 0) return;
    segments.push({ fromTime: at, toTime: at + duration, from, to, type }); at += duration;
  };
  for (const event of data.releases) onsets.set(event.id, introSeconds + (day(event.date) - start) / Math.max(1, end - start) * travelSeconds);
  append(travelSeconds, start, end, 'travel');
  append(holdSeconds, end, end, 'hold');
  return { segments, onsets, start, end, travelSeconds, introSeconds, outroSeconds, outroStart: at, duration: at + outroSeconds };
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
export function stateYear(state) { return yearOf(iso(state.day)); }

// Cue points shared by the camera and the score. `scale` maps film seconds to audio seconds for
// compressed renders; a point within 60 ms of a beat snaps to it so the music stays on the grid.
export const BEAT_SECONDS = BAR_SECONDS / 4;
export function cuePoints(timeline, scale = 1) {
  const snap = t => { const g = Math.round(t / BEAT_SECONDS) * BEAT_SECONDS; return Math.abs(t - g) < .06 ? g : t; };
  const drop = snap((timeline.introSeconds + timeline.travelSeconds) * scale);
  return { intro: snap(timeline.introSeconds * scale), build: drop - 2 * BAR_SECONDS, gap: drop - BAR_SECONDS, breath: drop - BAR_SECONDS / 2,
    drop, outro: snap(timeline.outroStart * scale), end: timeline.duration * scale };
}
// The kick: a heartbeat in the intro, four on the floor, an eighth-note roll in the first half of the
// bar before the drop, silence for the last two beats, then four on the floor again from the drop.
export function kickTimes(points, until = points.end) {
  const kicks = [];
  for (let k = 0; k * BEAT_SECONDS < until - 1e-6; k++) {
    const t = k * BEAT_SECONDS;
    if (t < points.intro - 1e-6) { if (k % 2 === 0) kicks.push(t); }
    else if (t < points.gap - 1e-6 || t >= points.drop - 1e-6) kicks.push(t);
    else if (t < points.breath - 1e-6) kicks.push(t, t + BEAT_SECONDS / 2);
  }
  return kicks;
}
