import { loadDataset, yearlyStats } from '../src/data.mjs';
import { options } from './options.mjs';
const data = await loadDataset(options().data);
console.log(`Validated ${data.releases.length} source-linked models (${data.startDate} to ${data.endDate}).`);
console.table(yearlyStats(data).map(r => ({ year: `${r.year}${r.partial ? ' YTD' : ''}`, days: r.observedDays, models: r.count, daysPerModel: r.daysPerModel?.toFixed(1) ?? '—' })));
