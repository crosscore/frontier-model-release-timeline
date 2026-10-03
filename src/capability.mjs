// Capability scores come from Epoch AI's Epoch Capabilities Index (ECI), published under CC BY 4.0.
// Each release names the ECI model it maps to; the score itself is copied from Epoch's CSV export.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; if (row.some(v => v !== '')) rows.push(row); row = [];
    } else field += c;
  }
  row.push(field); if (row.some(v => v !== '')) rows.push(row);
  const [header = [], ...body] = rows;
  return body.map(values => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ''])));
}

// Returns a copy of the dataset with every mapped release's score refreshed from the ECI export.
// A mapped model that Epoch has not scored yet keeps `score: null` and is listed in `missing`.
export function applyEciScores(data, csvText, retrievedOn) {
  const rows = parseCsv(csvText);
  if (!rows.length || !('Model' in rows[0]) || !('eci' in rows[0])) throw new Error('ECI CSV must have Model and eci columns');
  const scores = new Map(rows.filter(r => r.eci !== '' && Number.isFinite(Number(r.eci))).map(r => [r.Model, Math.round(Number(r.eci) * 100) / 100]));
  const missing = [], changed = [];
  const releases = data.releases.map(event => {
    if (!event.capability) return event;
    const score = scores.get(event.capability.model) ?? null;
    if (score === null) missing.push(event.capability.model);
    if (score !== event.capability.score) changed.push({ id: event.id, from: event.capability.score, to: score });
    return { ...event, capability: { ...event.capability, score } };
  });
  return { data: { ...data, capability: { ...data.capability, retrievedOn }, releases }, missing, changed };
}
