// 同じ内容の指示文を各言語で書いたものについて、公開トークナイザでのトークン数を比べる。
// 注意: 現行の Claude のトークナイザは公開されていない。ここでの数値は代用の概算。
import { readFileSync, readdirSync } from 'node:fs';
import { encode as o200k } from 'gpt-tokenizer/encoding/o200k_base';
import { encode as cl100k } from 'gpt-tokenizer/encoding/cl100k_base';
import { countTokens as claudeLegacy } from '@anthropic-ai/tokenizer';

const dir = new URL('./texts/', import.meta.url);
const rows = readdirSync(dir).filter(f => f.endsWith('.txt')).map(f => {
  const text = readFileSync(new URL(f, dir), 'utf8').trim();
  return {
    lang: f.replace('.txt', ''),
    chars: [...text].length,
    bytes: Buffer.byteLength(text, 'utf8'),
    o200k: o200k(text).length,
    cl100k: cl100k(text).length,
    claudeLegacy: claudeLegacy(text),
  };
});
const en = rows.find(r => r.lang === 'en');
rows.sort((a, b) => a.o200k - b.o200k);
const pct = (v, base) => (v / base).toFixed(2);
console.log('lang\tchars\tbytes\to200k\tx_en\tcl100k\tx_en\tclaude_legacy\tx_en');
for (const r of rows) {
  console.log([r.lang, r.chars, r.bytes, r.o200k, pct(r.o200k, en.o200k), r.cl100k, pct(r.cl100k, en.cl100k),
    r.claudeLegacy, pct(r.claudeLegacy, en.claudeLegacy)].join('\t'));
}
