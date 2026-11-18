// 引き継ぎ実験の集計。 使い方: node analyze-handoff.mjs runs/<名前>
// 書き手と読み手の組ごと、書き方ごとに、メッセージの量、正答率、費用を出す。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const load = f => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);
const dir = process.argv[2];
const writes = load(join(dir, 'writes.jsonl')).filter(r => !r.error && r.stop_reason === 'end_turn');
const reads = load(join(dir, 'reads.jsonl')).filter(r => !r.error && r.score);
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const f0 = x => (Number.isNaN(x) ? '-' : x.toFixed(0));
const formats = [...new Set(writes.map(r => r.f))];
const wOf = r => writes.find(w => w.w === r.w && w.s === r.s && w.f === r.f && w.r === r.r);

console.log('## 書き手（引き継ぎメッセージを書く側）');
console.log('writer\tformat\tn\tmsg_tok\tmsg_chars\tout_tok\tthink_tok\tin_tok\tlatency_s\tcost_$');
for (const w of [...new Set(writes.map(r => r.w))]) {
  for (const f of formats) {
    const g = writes.filter(r => r.w === w && r.f === f);
    if (!g.length) continue;
    console.log(
      [
        w,
        f,
        g.length,
        f0(mean(g.map(r => r.message_tokens))),
        f0(mean(g.map(r => r.message_chars))),
        f0(mean(g.map(r => r.usage.output_tokens))),
        f0(mean(g.map(r => r.usage.output_tokens - r.message_tokens))),
        f0(mean(g.map(r => r.usage.input_tokens))),
        (mean(g.map(r => r.latency_ms)) / 1000).toFixed(1),
        mean(g.map(r => r.cost)).toFixed(4),
      ].join('\t'),
    );
  }
}

// 英語の自然文（en）との差。シナリオごとに量が違うので、シナリオをそろえて比べ、ブートストラップで 95% 区間を出す。
let seed = 12345;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const resample = a => a.map(() => a[Math.floor(rand() * a.length)]);
const scenarios = [...new Set(writes.map(r => r.s))];
const strat = (w, f, get, pick = x => x) =>
  mean(scenarios.map(s => mean(pick(writes.filter(r => r.w === w && r.f === f && r.s === s)).map(get))));
function vsEn(w, f, get) {
  const base = strat(w, 'en', get);
  const boots = [];
  for (let i = 0; i < 2000; i++) boots.push(100 * (strat(w, f, get, resample) / strat(w, 'en', get, resample) - 1));
  boots.sort((a, b) => a - b);
  const p = 100 * (strat(w, f, get) / base - 1);
  return `${p >= 0 ? '+' : ''}${p.toFixed(0)}% [${boots[49].toFixed(0)}, ${boots[1949].toFixed(0)}]`;
}
if (formats.includes('en')) {
  console.log('\n## 英語の自然文との差（書き手、95% 区間）');
  console.log('writer\tformat\tmsg_tok\tout_tok\tlatency');
  for (const w of [...new Set(writes.map(r => r.w))]) {
    for (const f of formats.filter(f => f !== 'en')) {
      console.log([w, f, vsEn(w, f, r => r.message_tokens), vsEn(w, f, r => r.usage.output_tokens), vsEn(w, f, r => r.latency_ms)].join('\t'));
    }
  }
}

console.log('\n## 読み手（引き継ぎメッセージだけを見て質問に答える側）');
console.log('pair\tformat\tn\tcorrect_%\tunknown_%\twrong_%\tall_correct\tcontrol_ok\tin_tok\tout_tok\tlatency_s\tpair_cost_$\tpair_total_tok');
for (const pair of [...new Set(reads.map(r => `${r.w}:${r.rd}`))]) {
  for (const f of formats) {
    const g = reads.filter(r => `${r.w}:${r.rd}` === pair && r.f === f);
    if (!g.length) continue;
    const tot = g.reduce((s, r) => s + r.score.total, 0);
    const pct = k => ((100 * g.reduce((s, r) => s + r.score[k], 0)) / tot).toFixed(1);
    const ws = g.map(wOf);
    console.log(
      [
        pair,
        f,
        g.length,
        pct('correct'),
        pct('unknown'),
        pct('wrong'),
        `${g.filter(r => r.score.correct === r.score.total).length}/${g.length}`,
        `${g.filter(r => r.score.controlOk).length}/${g.length}`,
        f0(mean(g.map(r => r.usage.input_tokens))),
        f0(mean(g.map(r => r.usage.output_tokens))),
        (mean(g.map(r => r.latency_ms)) / 1000).toFixed(1),
        mean(g.map((r, i) => r.cost + ws[i].cost)).toFixed(4),
        f0(mean(g.map((r, i) => r.usage.input_tokens + r.usage.output_tokens + ws[i].usage.input_tokens + ws[i].usage.output_tokens))),
      ].join('\t'),
    );
  }
}

console.log('\n## 落ちた質問（組、書き方、シナリオ、回: 質問番号）');
for (const r of reads) {
  const missed = r.score.detail.map((v, i) => (v ? null : `q${i + 1}`)).filter(Boolean);
  if (missed.length) console.log(`${r.w}:${r.rd} ${r.f} ${r.s} ${r.r}: ${missed.join(',')}`);
}
