// 出力を規則ごとに採点する。
// 単体での使い方: node score.mjs <outputs ディレクトリ> [case 名]   （ファイル名は <パターン>-<回>.txt）
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES } from './cases.mjs';

const JA = /[぀-ヿ一-鿿]/;

export function scoreOutput(text, exp) {
  const raw = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  const lines = raw.filter(l => l.trim() !== '');
  const si = lines.indexOf('SUMMARY:');
  const findingLines = lines.filter(l => l.startsWith('- '));
  const none = findingLines.length === 1 && findingLines[0] === '- none';
  const parsed = none ? [] : findingLines.map(l => l.match(/^- \[(S[123])\] (\S+:\d+) — (.+)$/));
  const ok = parsed.filter(Boolean);
  const keys = ok.map(m => m[2]);
  const descs = ok.map(m => m[3]);
  const expKeys = exp.findings.map(f => f[1]);
  const empty = exp.findings.length === 0;
  const omitted = lines.filter(l => l.startsWith('OMITTED'));
  const summary = si >= 0 ? lines[si + 1] ?? '' : '';
  const sentences = (summary.match(/[。．!?！？]|\.(?=\s|$)/g) || []).length;

  const c = {};
  c.verdict = raw[0] === `VERDICT: ${exp.verdict}`;
  c.findings_header = lines[1] === 'FINDINGS:';
  c.line_format = empty ? none : findingLines.length > 0 && parsed.every(Boolean);
  c.finding_set = [...keys].sort().join() === [...expKeys].sort().join();
  c.finding_order = keys.join() === expKeys.join();
  c.severity = ok.every(m => (exp.findings.find(f => f[1] === m[2]) || [])[0] === m[1]) && ok.length === exp.findings.length;
  c.excl_vendor_lock = !keys.some(k => k.startsWith('vendor/') || /\.lock:/.test(k));
  c.test_rule = exp.findings.every(([sev, key, isTest]) => {
    const m = ok.find(x => x[2] === key);
    return m && (isTest ? m[3].startsWith('(test)') : !m[3].startsWith('(test)'));
  });
  c.limit_5 = findingLines.length <= 5;
  c.omitted_line = exp.omitted === null
    ? omitted.length === 0
    : omitted.length === 1 && omitted[0] === `OMITTED: ${exp.omitted}` && lines.indexOf(omitted[0]) === si - 1;
  c.desc_len_60 = descs.every(d => [...d].length <= 60);
  c.desc_one_sentence = descs.every(d => (d.match(/。/g) || []).length <= 1);
  c.desc_japanese = descs.every(d => JA.test(d));
  c.no_secret = !exp.secrets.some(s => text.includes(s));
  c.summary_two_sentences = si >= 0 && sentences === 2 && JA.test(summary);
  c.count_line = raw[raw.length - 1] === `COUNT: ${exp.count}`;
  c.no_markdown = !lines.some(l => /^#/.test(l)) && !text.includes('**') && !text.includes('```');
  c.structure = lines.length === 2 + Math.max(exp.findings.length, 1) + (exp.omitted === null ? 0 : 1) + 3
    && si === lines.length - 3;
  return c;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  const exp = CASES[process.argv[3] || 'case1'].expected;
  console.log('file\tpassed\ttotal\tout_chars\tfailed_checks');
  for (const f of readdirSync(dir).filter(f => /^[A-G]-\d+\.txt$/.test(f)).sort()) {
    const text = readFileSync(join(dir, f), 'utf8');
    const c = scoreOutput(text, exp);
    const failed = Object.entries(c).filter(([, v]) => !v).map(([k]) => k).join(',') || '-';
    console.log([f, Object.values(c).filter(Boolean).length, Object.keys(c).length, [...text.trim()].length, failed].join('\t'));
  }
}
