import { day } from './data.mjs';

// Launch pace: an exponential moving average of selected launches, in launches per 30 days, read like an
// indicator under a price chart. Each launch adds 30 / PACE_TAU_DAYS on its date and then decays with that
// time constant, so a steady cadence of one launch every g days settles near 30 / g. It only looks back.
export const PACE_TAU_DAYS = 60, PACE_PER_DAYS = 30;

// `launches` are { day, weight } pairs; the weight is 1 unless a launch is still animating in.
export function paceAt(launches, at) {
  let sum = 0;
  for (const l of launches) if (l.day <= at) sum += l.weight * Math.exp(-(at - l.day) / PACE_TAU_DAYS);
  return sum * PACE_PER_DAYS / PACE_TAU_DAYS;
}
export const launchesOf = (events, weight = () => 1) => events.map(e => ({ day: day(e.date), weight: weight(e) }));
// The pace only decays between launches, so its peak is right after one of them.
export const pacePeak = launches => Math.max(0, ...launches.map(l => paceAt(launches, l.day)));
