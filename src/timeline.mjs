import { day, iso, yearOf, launchGroups } from './data.mjs';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };

// One continuous clock: a real-world day always has the same film duration.
// Names accumulate in the ledger instead of stopping time at crowded launches.
// Defaults fill exactly 32 bars at 128 BPM (60 s): 2 intro, 24 travel, 2 hold, 4 outro.
export const BAR_SECONDS = 60 / 128 * 4;
export function makeTimeline(data, { travelSeconds = 24 * BAR_SECONDS, holdSeconds = 2 * BAR_SECONDS, introSeconds = 2 * BAR_SECONDS, outroSeconds = 4 * BAR_SECONDS } = {}) {
  for (const value of [travelSeconds, holdSeconds, introSeconds, outroSeconds]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('Timeline durations must be positive');
  }
  const start = day(data.startDate), end = day(data.endDate), segments = [], onsets = new Map();
  let at = introSeconds;
  const append = (duration, from, to, type) => {
    if (duration <= 0) return;
    segments.push({ fromTime: at, toTime: at + duration, from, to, type }); at += duration;
  };
  for (const group of launchGroups(data)) {
    const first = introSeconds + (day(group.date) - start) / Math.max(1, end - start) * travelSeconds;
    group.models.forEach((model, i) => onsets.set(model.id, first + i * BAR_SECONDS / 16));
  }
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
  return data.releases.filter(event => seconds >= timeline.onsets.get(event.id)).sort((a, b) => timeline.onsets.get(a.id) - timeline.onsets.get(b.id));
}
export function stateYear(state) { return yearOf(iso(state.day)); }

// Cue points shared by the camera and the score. `scale` maps film seconds to audio seconds for
// compressed renders; a point within 60 ms of a beat snaps to it so the music stays on the grid.
export const BEAT_SECONDS = BAR_SECONDS / 4;
export function cuePoints(timeline, scale = 1) {
  const snap = t => { const g = Math.round(t / BEAT_SECONDS) * BEAT_SECONDS; return Math.abs(t - g) < .06 ? g : t; };
  const intro = snap(timeline.introSeconds * scale), drop = snap((timeline.introSeconds + timeline.travelSeconds) * scale), end = timeline.duration * scale;
  const total = Math.max(0, Math.round((drop - intro) / BAR_SECONDS));
  let a = Math.round(total / 3), lift = Math.round(total / 6), drop1 = Math.round(total / 3);
  // Reserve two build bars when there is room. Omit the shortest sections first in smoke-test cuts.
  if (total < 4) { a = total; lift = drop1 = 0; }
  else while (total - a - lift - drop1 < 2) {
    if (lift) lift--; else if (drop1) drop1--; else a--;
  }
  const at = bars => Math.min(drop, intro + bars * BAR_SECONDS);
  const build = at(a + lift + drop1), gap = Math.max(build, drop - BAR_SECONDS), breath = Math.max(build, drop - BAR_SECONDS / 2);
  const finale = Math.max(drop, snap(end - Math.min(BAR_SECONDS, timeline.outroSeconds * scale)));
  return { intro, lift: at(a), drop1: at(a + lift), build, gap, breath, drop,
    outro: snap(timeline.outroStart * scale), musicOutro: Math.min(finale, drop + 4 * BAR_SECONDS), finale, end };
}

// One arrangement for sound and light. `outro` above is the summary scene; the music keeps its
// four-bar drop running under that scene before the closing two bars.
export function scorePart(p, t) {
  return t < p.intro ? 'intro' : t < p.lift ? 'A' : t < p.drop1 ? 'lift' : t < p.build ? 'drop1'
    : t < p.gap ? 'build' : t < p.breath ? 'roll' : t < p.drop ? 'breath' : t < p.musicOutro ? 'drop' : 'outro';
}
export function energy(p, t) {
  const part = scorePart(p, t);
  if (part === 'lift') return .5 + .2 * clamp((t - p.lift) / Math.max(.001, p.drop1 - p.lift));
  if (part === 'build' || part === 'roll') return .6 + .3 * clamp((t - p.build) / Math.max(.001, p.breath - p.build));
  return { intro: .2, A: .35, drop1: 1, breath: .4, drop: 1, outro: .6 }[part];
}
export function kickLight(p, t) {
  if (!['drop1', 'drop'].includes(scorePart(p, t))) return 0;
  return Math.exp(-((t % BEAT_SECONDS + BEAT_SECONDS) % BEAT_SECONDS) / .035) * clamp((.12 - t % BEAT_SECONDS) / .02);
}
// The kick: a heartbeat in the intro, four on the floor, an eighth-note roll in the first half of the
// bar before the drop, silence for the last two beats, then four on the floor again from the drop.
export function kickTimes(points, until = points.end) {
  const kicks = [];
  for (let k = 0; k * BEAT_SECONDS < until - 1e-6; k++) {
    const t = k * BEAT_SECONDS;
    if (t > points.finale + 1e-6) continue;
    if (t < points.intro - 1e-6) { if (t >= points.intro - BAR_SECONDS - 1e-6 && k % 2 === 0) kicks.push(t); }
    else if (t >= points.drop1 - BEAT_SECONDS * 2 && t < points.drop1 && points.drop1 > points.lift) continue;
    else if (t < points.gap - 1e-6 || t >= points.drop - 1e-6) kicks.push(t);
    else if (t < points.breath - 1e-6) kicks.push(t, t + BEAT_SECONDS / 2);
  }
  return kicks;
}
