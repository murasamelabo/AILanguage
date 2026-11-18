// 引き継ぎ実験。書き手が作業ログから引き継ぎメッセージを書き、読み手がそれだけを見て質問に答える。
//
// 使い方:
//   node run-handoff.mjs --name h1 --pairs fable:fable,fable:haiku,haiku:haiku --reps-fable 3 --reps-haiku 5 --budget 9 --workspace wrkspc_...
//   node run-handoff.mjs --dry-run
// --pairs は「書き手:読み手」。同じ書き手のメッセージは、読み手が違っても使い回す。
// 中断しても同じコマンドで再開できる（記録済みの組み合わせは飛ばす）。
import Anthropic from '@anthropic-ai/sdk';
import { mkdirSync, appendFileSync, existsSync, readFileSync } from 'node:fs';
import { makeClient, PRICE, costOf } from '../client.mjs';
import { SCENARIOS, FORMATS, writerPrompt, readerPrompt, scoreAnswers } from './scenarios.mjs';

const MODEL = { fable: 'claude-fable-5-2', haiku: 'claude-haiku-5-5', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5' };
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const pairs = arg('pairs', 'fable:fable').split(',').map(p => p.split(':'));
const formats = arg('formats', Object.keys(FORMATS).join(',')).split(',');
const scenarios = arg('scenarios', Object.keys(SCENARIOS).join(',')).split(',');
const effort = arg('effort', 'medium');
const budget = Number(arg('budget', 5));
const concurrency = Number(arg('concurrency', 4));
const name = arg('name', 'handoff-run');
const reps = w => Number(arg(`reps-${w}`, arg('reps', 3)));

const writers = [...new Set(pairs.map(p => p[0]))];
for (const m of new Set(pairs.flat())) if (!MODEL[m] || !PRICE[MODEL[m]]) throw new Error(`未登録のモデル: ${m}`);

const writeJobs = [];
for (const w of writers) {
  for (const s of scenarios) for (const f of formats) for (let r = 1; r <= reps(w); r++) writeJobs.push({ w, s, f, r });
}
const readJobs = [];
for (const [w, rd] of pairs) {
  for (const s of scenarios) for (const f of formats) for (let r = 1; r <= reps(w); r++) readJobs.push({ w, rd, s, f, r });
}
console.log(`書き手の呼び出し ${writeJobs.length} 回、読み手の呼び出し ${readJobs.length} 回、費用の上限 $${budget}`);
if (process.argv.includes('--dry-run')) process.exit(0);

const client = makeClient();
const dir = new URL(`./runs/${name}/`, import.meta.url);
mkdirSync(dir, { recursive: true });
const writesFile = new URL('writes.jsonl', dir);
const readsFile = new URL('reads.jsonl', dir);
const load = f => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);
const wKey = j => `${j.w}|${j.s}|${j.f}|${j.r}`;
const rKey = j => `${j.w}|${j.rd}|${j.s}|${j.f}|${j.r}`;
const writes = new Map(load(writesFile).filter(j => !j.error).map(j => [wKey(j), j]));
const readsDone = new Set(load(readsFile).filter(j => !j.error).map(rKey));

let spent = 0;
let stopped = false;

async function call(model, prompt) {
  const started = Date.now();
  // 計測対象のモデルを固定したいので、別モデルへの自動切り替え（fallbacks）は使わない。
  const res = await client.messages.create({
    model,
    max_tokens: 16000,
    output_config: { effort },
    messages: [{ role: 'user', content: prompt }],
  });
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const cost = costOf(model, res.usage);
  spent += cost;
  return { text, usage: res.usage, stop_reason: res.stop_reason, latency_ms: Date.now() - started, cost };
}

function onError(e) {
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
  return String(e.message ?? e);
}

function checkBudget() {
  if (spent >= budget && !stopped) {
    stopped = true;
    console.error(`費用が上限 $${budget} に達したので止めます。同じコマンドで再開できます。`);
  }
}

async function runWrite(job) {
  if (stopped || writes.has(wKey(job))) return;
  let rec = { ...job, effort };
  try {
    const out = await call(MODEL[job.w], writerPrompt(job.s, job.f));
    // 引き継ぎメッセージそのもののトークン数（思考を除いた、読み手が受け取る量）。
    const base = await client.messages.countTokens({ model: MODEL[job.w], messages: [{ role: 'user', content: '.' }] });
    const cnt = await client.messages.countTokens({ model: MODEL[job.w], messages: [{ role: 'user', content: out.text || '.' }] });
    rec = { ...rec, ...out, message_tokens: cnt.input_tokens - base.input_tokens, message_chars: [...out.text].length };
    if (out.stop_reason === 'end_turn' && out.text.trim()) writes.set(wKey(job), rec);
  } catch (e) {
    rec = { ...rec, error: onError(e) };
  }
  appendFileSync(writesFile, JSON.stringify(rec) + '\n');
  checkBudget();
}

async function runRead(job) {
  if (stopped || readsDone.has(rKey(job))) return;
  const w = writes.get(wKey(job));
  if (!w) return; // 書き手が失敗した組み合わせは読めない。
  let rec = { ...job, effort };
  try {
    const out = await call(MODEL[job.rd], readerPrompt(job.s, job.f, w.text));
    rec = { ...rec, ...out, score: out.stop_reason === 'end_turn' ? scoreAnswers(job.s, out.text) : null };
  } catch (e) {
    rec = { ...rec, error: onError(e) };
  }
  appendFileSync(readsFile, JSON.stringify(rec) + '\n');
  checkBudget();
}

async function pool(jobs, fn) {
  let next = 0;
  const worker = async () => {
    while (next < jobs.length && !stopped) await fn(jobs[next++]);
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

await pool(writeJobs, runWrite);
await pool(readJobs, runRead);
console.log(`今回の費用: $${spent.toFixed(2)}。集計は node analyze-handoff.mjs runs/${name}`);
