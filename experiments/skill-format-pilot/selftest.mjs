// 採点器の自己確認。各入力の正解例が満点になり、別の入力の正解例は減点されることを確かめる。
import { scoreOutput } from './score.mjs';
import { CASES } from './cases.mjs';

const summary = '要約の一文目である。要約の二文目である。';
const top5 = [
  '- [S1] src/auth.py:42 — APIキーが直接書かれている。',
  '- [S1] src/db.py:88 — WHERE句のないDELETE文が実行される。',
  '- [S2] src/auth_test.py:8 — (test) 本番パスワードが直接書かれている。',
  '- [S2] src/cart.py:17 — 最後の商品が合計から抜ける。',
  '- [S2] src/price.py:5 — 平均の計算で件数に1を足して割っている。',
].join('\n');
const answers = {
  case1: `VERDICT: BLOCK\nFINDINGS:\n${top5}\nOMITTED: 2\nSUMMARY:\n${summary}\nCOUNT: S1=2 S2=3 S3=0\n`,
  case2: `VERDICT: BLOCK\nFINDINGS:\n${top5}\nOMITTED: 5\nSUMMARY:\n${summary}\nCOUNT: S1=2 S2=3 S3=0\n`,
  case3: `VERDICT: OK\nFINDINGS:\n- none\nSUMMARY:\n${summary}\nCOUNT: S1=0 S2=0 S3=0\n`,
  case4:
    'VERDICT: FIX\nFINDINGS:\n- [S2] src/auth_test.py:8 — (test) 本番パスワードが直接書かれている。\n' +
    `- [S2] src/cart.py:17 — 最後の商品が合計から抜ける。\nSUMMARY:\n${summary}\nCOUNT: S1=0 S2=2 S3=0\n`,
};

let failed = false;
for (const answerOf of Object.keys(answers)) {
  for (const scoredAs of Object.keys(CASES)) {
    const c = scoreOutput(answers[answerOf], CASES[scoredAs].expected);
    const passed = Object.values(c).filter(Boolean).length;
    const total = Object.keys(c).length;
    const expectFull = answerOf === scoredAs;
    const ok = expectFull ? passed === total : passed < total;
    if (!ok) failed = true;
    console.log(`${answerOf} の正解例を ${scoredAs} として採点: ${passed}/${total} ${ok ? 'OK' : 'NG'}`);
  }
}
process.exit(failed ? 1 : 0);
