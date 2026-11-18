// 各パターンの Skill 本文のトークン数を、公開トークナイザで数える（現行の Claude の値ではなく代用の概算）。
import { readFileSync } from 'node:fs';
import { encode as o200k } from 'gpt-tokenizer/encoding/o200k_base';
import { encode as cl100k } from 'gpt-tokenizer/encoding/cl100k_base';
import { countTokens as claudeLegacy } from '@anthropic-ai/tokenizer';
import { skillText, PATTERNS } from './lib.mjs';

const rows = PATTERNS.map(p => {
  const t = skillText(p);
  return { p, chars: [...t].length, o200k: o200k(t).length, cl100k: cl100k(t).length, legacy: claudeLegacy(t) };
});
const b = rows.find(r => r.p === 'B');
const x = (v, base) => (v / base).toFixed(2);
console.log('pattern\tchars\to200k\tx_B\tcl100k\tx_B\tclaude_legacy\tx_B');
for (const r of rows) {
  console.log([r.p, r.chars, r.o200k, x(r.o200k, b.o200k), r.cl100k, x(r.cl100k, b.cl100k), r.legacy, x(r.legacy, b.legacy)].join('\t'));
}
