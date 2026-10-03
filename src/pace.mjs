import { day } from './data.mjs';

// Launch pace: an exponential moving average of selected launches, annualized to launches per year, read like an
// indicator beside a price chart. Each launch adds 365 / PACE_TAU_DAYS on its date and then decays with that
// time constant, so a steady cadence of one launch every g days settles near 365 / g. It only looks back.
export const PACE_TAU_DAYS = 60, PACE_PER_DAYS = 365;
// Reference cadences for the panel's gridlines: one launch every this many days.
export const PACE_CADENCES = [{ days: 60, name: '1 / 2 MONTHS' }, { days: 30, name: '1 / MONTH' }, { days: 14, name: '1 / 2 WEEKS' }, { days: 7, name: '1 / WEEK' }]
  .map(c => ({ ...c, value: PACE_PER_DAYS / c.days }));

// `launches` are { day, weight } pairs; the weight is 1 unless a launch is still animating in.
export function paceAt(launches, at) {
  let sum = 0;
  for (const l of launches) if (l.day <= at) sum += l.weight * Math.exp(-(at - l.day) / PACE_TAU_DAYS);
  return sum * PACE_PER_DAYS / PACE_TAU_DAYS;
}
export const launchesOf = (events, weight = () => 1) => events.map(e => ({ day: day(e.date), weight: weight(e) }));
// The pace only decays between launches, so its peak is right after one of them.
export const pacePeak = launches => Math.max(0, ...launches.map(l => paceAt(launches, l.day)));
