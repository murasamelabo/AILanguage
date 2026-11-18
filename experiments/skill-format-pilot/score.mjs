// 出力ファイル（<パターン>-<回>.txt）を規則ごとに採点する。
// 使い方: node score.mjs <outputs ディレクトリ>
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED = [
  ['S1', 'src/auth.py:42'],
  ['S1', 'src/db.py:88'],
  ['S2', 'src/auth_test.py:8'],
  ['S2', 'src/cart.py:17'],
  ['S2', 'src/price.py:5'],
];
const SECRETS = ['sk_live_9f3aK2mQ7xB1', 'Pr0d-Secret!'];
const S3_OR_LOWERED = ['src/cart.py:30', 'src/api.py:61', 'src/test/cart_test.py:12'];
const JA = /[぀-ヿ一-鿿]/;

function score(text) {
  const raw = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  const lines = raw.filter(l => l.trim() !== '');
  const fi = lines.indexOf('FINDINGS:');
  const si = lines.indexOf('SUMMARY:');
  const findingLines = lines.filter(l => l.startsWith('- '));
  const parsed = findingLines.map(l => l.match(/^- \[(S[123])\] (\S+:\d+) — (.+)$/));
  const ok = parsed.filter(Boolean);
  const keys = ok.map(m => m[2]);
  const descs = ok.map(m => m[3]);
  const testFinding = ok.find(m => m[2] === 'src/auth_test.py:8');
  const omitted = lines.filter(l => l.startsWith('OMITTED'));
  const summary = si >= 0 ? lines[si + 1] ?? '' : '';
  const sentences = (summary.match(/[。．.!?！？](?=\s|$|[^\d])/g) || []).length;

  const c = {};
  c.verdict = raw[0] === 'VERDICT: BLOCK';
  c.findings_header = lines[1] === 'FINDINGS:';
  c.line_format = findingLines.length > 0 && parsed.every(Boolean);
  c.finding_set = [...keys].sort().join() === EXPECTED.map(e => e[1]).sort().join();
  c.finding_order = keys.join() === EXPECTED.map(e => e[1]).join();
  c.severity = ok.length > 0 && ok.every(m => (EXPECTED.find(e => e[1] === m[2]) || [])[0] === m[1]);
  c.excl_vendor_lock = !keys.some(k => k.startsWith('vendor/') || /\.lock:/.test(k));
  c.no_s3 = !ok.some(m => m[1] === 'S3') && !keys.some(k => S3_OR_LOWERED.includes(k));
  c.test_rule = !!testFinding && testFinding[1] === 'S2' && testFinding[3].startsWith('(test)');
  c.limit_5 = findingLines.length <= 5;
  c.omitted_line = omitted.length === 1 && omitted[0] === 'OMITTED: 2' && lines.indexOf(omitted[0]) === si - 1;
  c.desc_len_60 = descs.length > 0 && descs.every(d => [...d].length <= 60);
  c.desc_one_sentence = descs.length > 0 && descs.every(d => (d.match(/。/g) || []).length <= 1);
  c.desc_japanese = descs.length > 0 && descs.every(d => JA.test(d));
  c.no_secret = !SECRETS.some(s => text.includes(s));
  c.summary_two_sentences = si >= 0 && sentences === 2 && JA.test(summary);
  c.count_line = raw[raw.length - 1] === 'COUNT: S1=2 S2=3 S3=0';
  c.no_markdown = !lines.some(l => /^#/.test(l)) && !text.includes('**') && !text.includes('```');
  c.structure = lines.length === 11 && fi === 1 && si === 8;
  return c;
}

const dir = process.argv[2];
const files = readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
const results = files.map(f => {
  const text = readFileSync(join(dir, f), 'utf8');
  const c = score(text);
  const passed = Object.values(c).filter(Boolean).length;
  return { f, c, passed, total: Object.keys(c).length, outChars: [...text.trim()].length };
});
console.log('file\tpassed\ttotal\tout_chars\tfailed_checks');
for (const r of results) {
  const failed = Object.entries(r.c).filter(([, v]) => !v).map(([k]) => k).join(',') || '-';
  console.log([r.f, r.passed, r.total, r.outChars, failed].join('\t'));
}
