import { readFile, writeFile } from 'node:fs/promises';
import { loadDataset, validateDataset } from '../src/data.mjs';
import { applyEciScores } from '../src/capability.mjs';
import { options } from './options.mjs';
// Refreshes every mapped release's ECI score from Epoch AI's CSV export (or a local copy via --csv).
const args = options({ csv: { type: 'string' }, retrieved: { type: 'string', default: new Date().toISOString().slice(0, 10) } });
const data = await loadDataset(args.data);
let text;
if (args.csv) text = await readFile(args.csv, 'utf8');
else {
  const response = await fetch(data.capability.data);
  if (!response.ok) throw new Error(`Could not download ${data.capability.data}: HTTP ${response.status}`);
  text = await response.text();
}
const { data: updated, missing, changed } = applyEciScores(data, text, args.retrieved);
await writeFile(args.data, JSON.stringify(validateDataset(updated), null, 2) + '\n');
const scored = updated.releases.filter(e => Number.isFinite(e.capability?.score)).length;
console.log(`${scored} of ${updated.releases.length} events have an ECI score (retrieved ${args.retrieved}).`);
if (changed.length) console.table(changed);
if (missing.length) console.log(`Not yet scored by Epoch AI: ${missing.join(', ')}`);
const unmapped = updated.releases.filter(e => !e.capability).map(e => e.name);
if (unmapped.length) console.log(`No ECI model mapped: ${unmapped.join(', ')}`);
