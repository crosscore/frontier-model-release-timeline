// Keep numeric prose and tables derived from the same source as the preview bundle.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { day, loadDataset, yearlyStats } from '../src/data.mjs';
import { launchesOf, paceAt } from '../src/pace.mjs';

export function documentationSections(data) {
  const stats = yearlyStats(data), scored = data.releases.filter(e => Number.isFinite(e.capability?.score)).length;
  const unscored = data.releases.filter(e => !Number.isFinite(e.capability?.score));
  const byLab = data.labs.map(l => `${l.name} ${data.releases.filter(e => e.lab === l.id).length}`).join(' / ');
  const end = paceAt(launchesOf(data.releases), day(data.endDate)), last = stats.at(-1);
  return {
    'dataset-summary': `**${data.releases.length}モデル（${data.startDate}〜${data.endDate}）**を公式出典付きで収録しています。${byLab}。ECIあり${scored}モデル、未採点${unscored.length}モデルです。`,
    unscored: `未採点は${unscored.length}モデル: ${unscored.map(e => `${e.name}（${e.date}）`).join('、')}。高さを持たない横軸上の噴き出し花火で表し、一覧は「—」です。`,
    'yearly-stats': ['| Observation | Days | Models | Days / model |', '| --- | ---: | ---: | ---: |', ...stats.map(r => `| ${r.partial ? `${r.start}–${r.end}` : r.year} | ${r.observedDays} | ${r.count} | ${r.daysPerModel?.toFixed(1) ?? '—'} |`)].join('\n'),
    'pace-summary': `観測終了日のペースは年${end.toFixed(1)}モデル（約${(365 / end).toFixed(1)}日に1モデル）です。${last.year}年途中集計の平均は${last.daysPerModel.toFixed(1)}日／モデル（年${(365 / last.daysPerModel).toFixed(1)}モデル）で、直近の集中により終了時のペースが高くなっています。`,
  };
}
export async function syncDocs(data, { check = false } = {}) {
  const sections = documentationSections(data);
  for (const path of ['README.md', 'docs/methodology.md']) {
    const file = new URL(`../${path}`, import.meta.url), before = await readFile(file, 'utf8');
    let after = before;
    for (const [key, value] of Object.entries(sections)) {
      const start = `<!-- ${key}:start -->`, end = `<!-- ${key}:end -->`;
      const from = after.indexOf(start), to = after.indexOf(end);
      if (from >= 0) {
        assert(to > from, `${path}: ${key} end marker`);
        after = after.slice(0, from) + `${start}\n${value}\n${end}` + after.slice(to + end.length);
      }
    }
    if (check) assert.equal(before, after, `${path}: run node scripts/sync-docs.mjs`);
    else if (before !== after) await writeFile(file, after);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await syncDocs(await loadDataset());
  console.log('Synchronized documentation counts, unscored names, annual density and launch pace.');
}
