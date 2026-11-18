// 実行用のプロンプトを書き出す。採点の正解を被験エージェントが見ないよう、リポジトリの外に出力する。
// 使い方: node build-prompts.mjs <出力先ディレクトリ>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PATTERNS, promptText } from './lib.mjs';

const out = process.argv[2];
if (!out) throw new Error('出力先ディレクトリを指定してください');
mkdirSync(join(out, 'prompts'), { recursive: true });
mkdirSync(join(out, 'outputs'), { recursive: true });
for (const p of PATTERNS) writeFileSync(join(out, 'prompts', `${p}.txt`), promptText(p));
console.log(`wrote ${PATTERNS.length} prompts to ${join(out, 'prompts')}`);
