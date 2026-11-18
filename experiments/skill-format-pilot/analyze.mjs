// 本計測の結果を、英語の平文（B）との差として分析する。 使い方: node analyze.mjs runs/<名前>
// 入力ごとに出力量が大きく違うので、差は入力をそろえて比べ、ブートストラップで 95% 区間を出す。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rows = readFileSync(join(process.argv[2], 'results.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(l => JSON.parse(l))
  .filter(r => !r.error);
const models = [...new Set(rows.map(r => r.model))];
const patterns = [...new Set(rows.map(r => r.pattern))].sort();
const cases = [...new Set(rows.map(r => r.case))].sort();
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const cell = (m, p, c) => rows.filter(r => r.model === m && r.pattern === p && r.case === c);

// 乱数を固定して、結果を再現できるようにする。
let seed = 12345;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const resample = a => a.map(() => a[Math.floor(rand() * a.length)]);

// 入力ごとの平均を取ってから平均する（各入力を同じ重みで扱う）。
const stat = (m, p, f, pick = x => x) => mean(cases.map(c => mean(pick(cell(m, p, c)).map(f))));
function diffCI(m, p, f) {
  const point = stat(m, p, f) - stat(m, 'B', f);
  const boots = [];
  for (let i = 0; i < 2000; i++) boots.push(stat(m, p, f, resample) - stat(m, 'B', f, resample));
  boots.sort((a, b) => a - b);
  return `${point >= 0 ? '+' : ''}${point.toFixed(0)} [${boots[49].toFixed(0)}, ${boots[1949].toFixed(0)}]`;
}

for (const m of models) {
  console.log(`\n## ${m}`);
  console.log('pattern\tall_pass\tin_tok\tout_tok\ttotal_tok\tcost_per_call_$\tout_tok_vs_B [95%]\ttotal_tok_vs_B [95%]\tlatency_s');
  for (const p of patterns) {
    const g = rows.filter(r => r.model === m && r.pattern === p);
    const inT = stat(m, p, r => r.input_tokens);
    const outT = stat(m, p, r => r.output_tokens);
    console.log(
      [
        p,
        `${g.filter(r => r.passed === r.total).length}/${g.length}`,
        inT.toFixed(0),
        outT.toFixed(0),
        (inT + outT).toFixed(0),
        stat(m, p, r => r.cost).toFixed(4),
        p === 'B' ? '-' : diffCI(m, p, r => r.output_tokens),
        p === 'B' ? '-' : diffCI(m, p, r => r.input_tokens + r.output_tokens),
        (stat(m, p, r => r.latency_ms) / 1000).toFixed(1),
      ].join('\t'),
    );
  }
  console.log('\n失敗の内訳（書き方 入力 回: 落ちた項目）');
  for (const r of rows.filter(r => r.model === m && r.passed !== r.total)) {
    const failed = Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k);
    console.log(`${r.pattern} ${r.case} ${r.rep}: ${failed.join(',')}`);
  }
}
