// 採点の自己確認。模範解答が満点になり、すべて UNKNOWN の回答は対照質問だけ正解になることを確かめる。
import { SCENARIOS, FORMATS, writerPrompt, readerPrompt, scoreAnswers } from './scenarios.mjs';

let failed = false;
for (const [name, s] of Object.entries(SCENARIOS)) {
  const gold = s.questions.map(([, , g], i) => `q${i + 1}: ${g}`).join('\n');
  const allUnknown = s.questions.map((_, i) => `q${i + 1}: UNKNOWN`).join('\n');
  const a = scoreAnswers(name, gold);
  const b = scoreAnswers(name, allUnknown);
  const ok = a.correct === a.total && a.controlOk && b.correct === 0 && b.unknown === b.total && b.controlOk;
  if (!ok) failed = true;
  console.log(`${name}: 模範解答 ${a.correct}/${a.total} 対照 ${a.controlOk}、全 UNKNOWN ${b.correct}/${b.total} 対照 ${b.controlOk} ${ok ? 'OK' : 'NG'}`);
  for (const f of Object.keys(FORMATS)) {
    if (!writerPrompt(name, f).includes(s.log) || !readerPrompt(name, f, 'X').includes('q1.')) failed = true;
  }
}
process.exit(failed ? 1 : 0);
