import { day, iso } from '../src/data.mjs';

// Synthetic datasets for layout checks, derived from a real dataset so dates, scores and sources stay realistic.
// They exercise the renderer only; the published film always uses data/releases.json.
const LABS = [
  { id: 'openai', color: '#76D3B2', long: 'OpenAI Frontier Research and Deployment', model: 'GPT-7 Orion Ultra Reasoning Research Preview, Extended Context', source: 'https://openai.com/index/gpt-4-research/' },
  { id: 'anthropic', color: '#FFB547', long: 'Anthropic Public Benefit Research Labs', model: 'Claude Opus 6.5 Extended Thinking Research Preview Edition', source: 'https://www.anthropic.com/news/claude-4' },
  { id: 'google', color: '#9AA5FF', long: 'Google DeepMind Gemini Research Program', model: 'Gemini 4.5 Pro Deep Research Experimental Long Context', source: 'https://blog.google/technology/google-deepmind/gemini-model-thinking-updates-march-2025/' },
  { id: 'deepseek', color: '#F2779A', long: 'DeepSeek General Intelligence Research', model: 'DeepSeek V5.2-Exp Reasoner Mixture-of-Experts Long-Context Preview', source: 'https://api-docs.deepseek.com/news/news250120' },
  { id: 'meta', color: '#49CFE8', long: 'Meta Superintelligence Labs and FAIR', model: 'Muse Spark 2.0 Multimodal Open-Weights Instruct Long Context', source: 'https://ai.meta.com/blog/llama-4-multimodal-intelligence/' },
];
const byDate = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0;

// The first `count` labs of a dataset and only their launches.
export function labSubset(data, count) {
  const copy = structuredClone(data);
  copy.labs = copy.labs.slice(0, count);
  const ids = new Set(copy.labs.map(lab => lab.id));
  copy.releases = copy.releases.filter(e => ids.has(e.lab));
  return copy;
}
// Five labs with long names, every model name lengthened, and one date on which all five launch at once with long
// names (scored, unscored and preview): the middle of the widest quiet stretch of the final year, late in the
// calendar where the camera is close, and far enough from its neighbours to get a name tag of its own.
export function stressDataset(data) {
  const copy = structuredClone(data), have = new Map(copy.labs.map(lab => [lab.id, lab]));
  copy.labs = LABS.map(l => ({ id: l.id, name: l.long, color: have.get(l.id)?.color ?? l.color }));
  copy.releases = copy.releases.filter(e => copy.labs.some(lab => lab.id === e.lab)).map(e => ({ ...e, name: `${e.name} Extended Research Preview Edition`.slice(0, 80) }));
  const end = day(copy.endDate), from = Math.max(day(copy.startDate), end - 365);
  const days = [...new Set(copy.releases.map(e => day(e.date)))].filter(d => d >= from).sort((a, b) => a - b);
  let date = end - 40, widest = 1;
  days.slice(1).forEach((d, i) => { if (d - days[i] > widest) { widest = d - days[i]; date = days[i] + Math.floor(widest / 2); } });
  const taken = new Set(copy.releases.map(e => e.date));
  while (taken.has(iso(date)) && date > day(copy.startDate)) date--;
  const scores = [158.4, 166.9, null, 151.2, 162.5];
  const cluster = LABS.map((l, i) => {
    const sources = copy.releases.find(e => e.lab === l.id)?.sources ?? [{ url: l.source, title: 'Official announcement' }];
    return { id: `stress-${l.id}`, date: iso(date), lab: l.id, name: l.model, stage: i === 3 ? 'preview' : 'release', capability: { model: l.model, score: scores[i] }, sources };
  });
  copy.releases = [...copy.releases, ...cluster].sort(byDate);
  return copy;
}
