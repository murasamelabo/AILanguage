// Anthropic の count_tokens API で、Claude の実際のトークン数を数える（無料のエンドポイント）。
//   1. Skill の書き方 7 通り（skill-format-pilot/patterns）
//   2. 同じ指示文の 15 言語版（language-selection/texts）
// 使い方: node count-claude-tokens.mjs [モデル ID をカンマ区切り]
// API キーは環境変数 AILANG_API_KEY から読む。
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { PATTERNS, skillText } from './skill-format-pilot/lib.mjs';

const models = (process.argv[2] || 'claude-fable-5-2,claude-haiku-5-5').split(',');
const apiKey = process.env.AILANG_API_KEY;
if (!apiKey) {
  console.error('環境変数 AILANG_API_KEY が設定されていません。');
  process.exit(1);
}
const client = new Anthropic({ apiKey, maxRetries: 5 });

// 空に近いメッセージの分を引いて、本文だけのトークン数にする。
async function count(model, text) {
  const res = await client.messages.countTokens({ model, messages: [{ role: 'user', content: text }] });
  return res.input_tokens;
}

const langDir = new URL('./language-selection/texts/', import.meta.url);
const items = [
  ...PATTERNS.map(p => ({ group: 'skill', name: p, text: skillText(p) })),
  ...readdirSync(langDir)
    .filter(f => f.endsWith('.txt'))
    .map(f => ({ group: 'lang', name: f.replace('.txt', ''), text: readFileSync(new URL(f, langDir), 'utf8').trim() })),
];

const lines = ['group\tname\tchars\t' + models.map(m => `${m}\tx_base`).join('\t')];
const table = [];
for (const it of items) {
  const row = { ...it, counts: {} };
  for (const m of models) row.counts[m] = (await count(m, it.text)) - (await count(m, '.'));
  table.push(row);
}
// 基準: Skill は英語の平文（B）、言語は英語（en）。
const base = { skill: table.find(r => r.group === 'skill' && r.name === 'B'), lang: table.find(r => r.name === 'en') };
for (const r of table) {
  const cells = models.map(m => `${r.counts[m]}\t${(r.counts[m] / base[r.group].counts[m]).toFixed(2)}`);
  lines.push([r.group, r.name, [...r.text].length, ...cells].join('\t'));
}
const out = lines.join('\n') + '\n';
writeFileSync(new URL('./claude-token-counts.tsv', import.meta.url), out);
console.log(out);
