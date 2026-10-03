import { readFile } from 'node:fs/promises';

export const DAY = 86_400_000;
export function day(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid ISO date: ${date}`);
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) throw new Error(`Invalid calendar date: ${date}`);
  return timestamp / DAY;
}
export const iso = value => new Date(Math.floor(value) * DAY).toISOString().slice(0, 10);
export const yearOf = date => Number(date.slice(0, 4));
const hosts = { openai: ['openai.com', 'help.openai.com'], anthropic: ['anthropic.com', 'www.anthropic.com', 'platform.claude.com'] };
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function keys(object, allowed, context) {
  requireThat(object && typeof object === 'object' && !Array.isArray(object), `${context} must be an object`);
  for (const key of Object.keys(object)) requireThat(allowed.includes(key), `${context}: unknown field ${key}`);
}
function text(value, context, max = 600) {
  requireThat(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${context} must contain 1–${max} characters`);
}

export function validateDataset(data) {
  keys(data, ['schemaVersion', 'title', 'startDate', 'endDate', 'verifiedOn', 'scope', 'labs', 'releases'], 'Dataset');
  requireThat(data.schemaVersion === 1, 'Unsupported schemaVersion');
  text(data.title, 'title'); text(data.scope, 'scope');
  const start = day(data.startDate), end = day(data.endDate);
  requireThat(start <= end, 'startDate must not follow endDate');
  requireThat(day(data.verifiedOn) >= end, 'verifiedOn must cover endDate');
  requireThat(yearOf(data.endDate) - yearOf(data.startDate) < 8, 'This layout supports at most 8 calendar years');
  requireThat(Array.isArray(data.labs) && data.labs.length === 2, 'The mirrored layout requires exactly two labs');
  const labs = new Set();
  for (const lab of data.labs) {
    keys(lab, ['id', 'name', 'color'], 'Lab');
    requireThat(hosts[lab.id] && !labs.has(lab.id), `Unsupported or duplicate lab: ${lab.id}`);
    text(lab.name, 'Lab name', 40);
    requireThat(/^#[0-9A-Fa-f]{6}$/.test(lab.color), 'Lab color must be a six-digit hex color');
    labs.add(lab.id);
  }
  requireThat(Array.isArray(data.releases) && data.releases.length > 0, 'At least one release is required');
  const ids = new Set(), labDates = new Set();
  let previous = '';
  for (const event of data.releases) {
    keys(event, ['id', 'date', 'lab', 'name', 'stage', 'sources', 'note'], 'Release');
    requireThat(typeof event.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(event.id) && !ids.has(event.id), `Invalid or duplicate ID: ${event.id}`);
    ids.add(event.id);
    text(event.name, `${event.id}: name`, 80);
    requireThat(labs.has(event.lab), `${event.id}: unknown lab`);
    const value = day(event.date);
    requireThat(value >= start && value <= end, `${event.id}: date outside observation window`);
    requireThat(event.date >= previous, 'Releases must be in chronological order');
    previous = event.date;
    const key = `${event.lab}:${event.date}`;
    requireThat(!labDates.has(key), `Group simultaneous models from the same lab into one event: ${key}`);
    labDates.add(key);
    requireThat(['release', 'preview'].includes(event.stage), `${event.id}: invalid stage`);
    if (event.note !== undefined) text(event.note, `${event.id}: note`);
    requireThat(Array.isArray(event.sources) && event.sources.length > 0, `${event.id}: missing sources`);
    for (const source of event.sources) {
      keys(source, ['url', 'title'], 'Source'); text(source.title, 'Source title');
      const url = new URL(source.url);
      requireThat(url.protocol === 'https:' && !url.username && !url.password && hosts[event.lab].includes(url.hostname), `${event.id}: source must use an official HTTPS host for its lab`);
    }
  }
  return data;
}

export async function loadDataset(path = new URL('../data/releases.json', import.meta.url)) {
  return validateDataset(JSON.parse(await readFile(path, 'utf8')));
}

export function yearlyStats(data) {
  const result = [];
  for (let year = yearOf(data.startDate); year <= yearOf(data.endDate); year++) {
    const start = Math.max(day(`${year}-01-01`), day(data.startDate));
    const end = Math.min(day(`${year + 1}-01-01`) - 1, day(data.endDate));
    const events = data.releases.filter(event => yearOf(event.date) === year);
    const observedDays = end - start + 1;
    result.push({ year, start: iso(start), end: iso(end), observedDays, count: events.length,
      partial: observedDays !== day(`${year + 1}-01-01`) - day(`${year}-01-01`),
      daysPerLaunch: events.length ? observedDays / events.length : null,
      meanGapDays: events.length > 1 ? (day(events.at(-1).date) - day(events[0].date)) / (events.length - 1) : null,
      byLab: Object.fromEntries(data.labs.map(lab => [lab.id, events.filter(e => e.lab === lab.id).length])) });
  }
  return result;
}
