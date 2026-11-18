// エージェント実行用のプロンプトを書き出す。採点の正解を被験エージェントが見ないよう、リポジトリの外に出力する。
// 使い方: node build-prompts.mjs <出力先ディレクトリ>
// 出力: <出力先>/prompts/<書き方>-<入力>.txt
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PATTERNS, promptText } from './lib.mjs';
import { CASES } from './cases.mjs';

const out = process.argv[2];
if (!out) throw new Error('出力先ディレクトリを指定してください');
mkdirSync(join(out, 'prompts'), { recursive: true });
let n = 0;
for (const p of PATTERNS) {
  for (const [c, { input }] of Object.entries(CASES)) {
    writeFileSync(join(out, 'prompts', `${p}-${c}.txt`), promptText(p, input));
    n++;
  }
}
console.log(`wrote ${n} prompts to ${join(out, 'prompts')}`);
