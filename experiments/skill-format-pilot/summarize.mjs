// run-api.mjs の結果を、モデルと書き方ごとに集計する。 使い方: node summarize.mjs runs/<名前>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rows = readFileSync(join(process.argv[2], 'results.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l));
const good = rows.filter(r => !r.error && r.total > 0);
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const sd = a => {
  const m = mean(a);
  return Math.sqrt(mean(a.map(x => (x - m) ** 2)));
};
const groups = new Map();
for (const r of good) {
  const k = `${r.model}\t${r.pattern}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}

console.log('model\tpattern\tn\tscore_%\tall_pass_%\tin_tok\tout_tok\tout_sd\ttotal_tok\tlatency_s\tcost_$\ttop_failures');
for (const [k, g] of [...groups].sort()) {
  const fails = {};
  for (const r of g) for (const [c, v] of Object.entries(r.checks)) if (!v) fails[c] = (fails[c] || 0) + 1;
  const top =
    Object.entries(fails)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([c, n]) => `${c}:${n}`)
      .join(',') || '-';
  const inT = mean(g.map(r => r.input_tokens));
  const outT = mean(g.map(r => r.output_tokens));
  console.log(
    [
      k,
      g.length,
      (100 * mean(g.map(r => r.passed / r.total))).toFixed(1),
      (100 * mean(g.map(r => +(r.passed === r.total)))).toFixed(0),
      inT.toFixed(0),
      outT.toFixed(0),
      sd(g.map(r => r.output_tokens)).toFixed(0),
      (inT + outT).toFixed(0),
      (mean(g.map(r => r.latency_ms)) / 1000).toFixed(1),
      g.reduce((s, r) => s + r.cost, 0).toFixed(2),
      top,
    ].join('\t'),
  );
}
const bad = rows.length - good.length;
if (bad) console.log(`\n採点できなかった呼び出し: ${bad} 件（エラー、または途中で打ち切られた応答）`);
