// Anthropic API で、Skill の書き方 × 入力 × モデルの組み合わせを複数回実行し、採点と使用量を記録する。
//
// 使い方:
//   node run-api.mjs --name main1 --models claude-fable-5-2,claude-haiku-5-5 --reps 5 --budget 15
//   node run-api.mjs --dry-run                 # 実行せず、呼び出し回数だけ表示
// オプション: --patterns A,B  --cases case1,case2  --effort medium  --concurrency 4
//
// API キーは環境変数 AILANG_API_KEY から読む。
// （ANTHROPIC_API_KEY という名前は Claude Code 本体の認証に影響するので使わない。）
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { PATTERNS, promptText } from './lib.mjs';
import { CASES } from './cases.mjs';
import { scoreOutput } from './score.mjs';

// 100 万トークンあたりの単価（ドル）。2026-11-03 時点の公開価格。
const PRICE = {
  'claude-fable-5-2': [8, 40],
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const flag = k => process.argv.includes(`--${k}`);
const models = arg('models', 'claude-fable-5-2').split(',');
const patterns = arg('patterns', PATTERNS.join(',')).split(',');
const cases = arg('cases', Object.keys(CASES).join(',')).split(',');
const reps = Number(arg('reps', 3));
const effort = arg('effort', 'medium');
const budget = Number(arg('budget', 10));
const concurrency = Number(arg('concurrency', 4));
const name = arg('name', 'api-run');

for (const m of models) if (!PRICE[m]) throw new Error(`単価が未登録のモデル: ${m}`);
const jobs = [];
for (const model of models) {
  for (const p of patterns) for (const c of cases) for (let r = 1; r <= reps; r++) jobs.push({ model, p, c, r });
}
console.log(
  `${jobs.length} 回の呼び出し（モデル ${models.length} × 書き方 ${patterns.length} × 入力 ${cases.length} × ${reps} 回）、費用の上限 $${budget}`,
);
if (flag('dry-run')) process.exit(0);

const apiKey = process.env.AILANG_API_KEY;
if (!apiKey) {
  console.error('環境変数 AILANG_API_KEY が設定されていません。環境設定に追加してからセッションを開き直してください。');
  process.exit(1);
}
const client = new Anthropic({ apiKey, maxRetries: 5 });

const dir = new URL(`./runs/${name}/`, import.meta.url);
mkdirSync(dir, { recursive: true });
const out = new URL('results.jsonl', dir);
// 中断後の再開: 記録済みの組み合わせは飛ばす。
const key = j => `${j.model}|${j.pattern ?? j.p}|${j.case ?? j.c}|${j.rep ?? j.r}`;
const done = new Set(
  existsSync(out)
    ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(j => !j.error).map(key)
    : [],
);

let spent = 0;
let stopped = false;

async function runOne(job) {
  if (stopped || done.has(key(job))) return;
  const { model, p, c, r } = job;
  const started = Date.now();
  let rec = { model, pattern: p, case: c, rep: r, effort };
  try {
    // 計測対象のモデルを固定したいので、別モデルへの自動切り替え（fallbacks）は使わない。
    const res = await client.messages.create({
      model,
      max_tokens: 16000,
      output_config: { effort },
      messages: [{ role: 'user', content: promptText(p, CASES[c].input) }],
    });
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const checks = res.stop_reason === 'end_turn' ? scoreOutput(text, CASES[c].expected) : {};
    const [pin, pout] = PRICE[model];
    const cost = (res.usage.input_tokens * pin + res.usage.output_tokens * pout) / 1e6;
    spent += cost;
    rec = {
      ...rec,
      stop_reason: res.stop_reason,
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
      latency_ms: Date.now() - started,
      cost,
      text,
      checks,
      passed: Object.values(checks).filter(Boolean).length,
      total: Object.keys(checks).length,
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      stopped = true;
      console.error('認証に失敗しました。API キーを確認してください。');
    } else if (e instanceof Anthropic.RateLimitError) {
      console.error('レート制限に達しました（再試行後も失敗）。');
    } else if (e instanceof Anthropic.APIError) {
      console.error(`API エラー ${e.status}: ${e.message}`);
    } else {
      throw e;
    }
    rec = { ...rec, error: String(e.message ?? e) };
  }
  appendFileSync(out, JSON.stringify(rec) + '\n');
  if (spent >= budget && !stopped) {
    stopped = true;
    console.error(`費用が上限 $${budget} に達したので止めます。同じコマンドで再開できます。`);
  }
}

let next = 0;
const worker = async () => {
  while (next < jobs.length && !stopped) await runOne(jobs[next++]);
};
await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`今回の費用: $${spent.toFixed(2)}。集計は node summarize.mjs runs/${name}`);
