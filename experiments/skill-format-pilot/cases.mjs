// 入力と正解。1 つの Skill に対して、規則の違う部分が働く 4 つの入力を用意する。
const ISSUES = {
  db: 'src/db.py line 88 — data loss — DELETE statement runs without a WHERE clause',
  cart: 'src/cart.py line 17 — behavior bug — loop skips the last item when summing prices',
  vendor: 'vendor/lib/util.py line 5 — security — SQL built by string concatenation',
  auth: 'src/auth.py line 42 — security — API key "sk_live_9f3aK2mQ7xB1" is hardcoded',
  naming: 'src/cart.py line 30 — naming — variable named x',
  testBug: 'src/test/cart_test.py line 12 — behavior bug — assertion always passes',
  testSecret: 'src/auth_test.py line 8 — security — production password "Pr0d-Secret!" is hardcoded',
  lock: 'poetry.lock line 301 — behavior bug — dependency version changed unexpectedly',
  user: 'src/user.py line 9 — behavior bug — age check rejects users who are exactly 18',
  price: 'src/price.py line 5 — behavior bug — average divides by count plus one',
  style: 'src/api.py line 61 — style — line longer than 120 characters',
  report: 'src/report.py line 3 — behavior bug — date is formatted in the wrong time zone',
};
const input = (request, keys) =>
  `Request: ${request}\n\nRaw issues found by the scanner:\n` + keys.map((k, i) => `${i + 1}. ${ISSUES[k]}`).join('\n');

const TOP5 = [
  ['S1', 'src/auth.py:42', false],
  ['S1', 'src/db.py:88', false],
  ['S2', 'src/auth_test.py:8', true],
  ['S2', 'src/cart.py:17', false],
  ['S2', 'src/price.py:5', false],
];
const SECRETS = ['sk_live_9f3aK2mQ7xB1', 'Pr0d-Secret!'];

export const CASES = {
  // 上限 5 件を超える。S3 は報告しない。
  case1: {
    input: input('Review this change before merge.',
      ['db', 'cart', 'vendor', 'auth', 'naming', 'testBug', 'testSecret', 'lock', 'user', 'price', 'style', 'report']),
    expected: { verdict: 'BLOCK', findings: TOP5, omitted: 2, count: 'S1=2 S2=3 S3=0', secrets: SECRETS },
  },
  // 依頼文に "style" があるので S3 も対象になり、削る件数が変わる。
  case2: {
    input: input('Review this change before merge. Include style issues.',
      ['report', 'style', 'price', 'user', 'lock', 'testSecret', 'testBug', 'naming', 'auth', 'vendor', 'cart', 'db']),
    expected: { verdict: 'BLOCK', findings: TOP5, omitted: 5, count: 'S1=2 S2=3 S3=0', secrets: SECRETS },
  },
  // 報告する指摘が 1 件もない。
  case3: {
    input: input('Review this change before merge.', ['vendor', 'lock', 'naming', 'testBug', 'style']),
    expected: { verdict: 'OK', findings: [], omitted: null, count: 'S1=0 S2=0 S3=0', secrets: [] },
  },
  // 上限以内。テストファイルの S1 が S2 に下がり、判定は FIX になる。
  case4: {
    input: input('Review this change before merge.', ['style', 'testBug', 'cart', 'vendor', 'testSecret', 'naming']),
    expected: {
      verdict: 'FIX',
      findings: [['S2', 'src/auth_test.py:8', true], ['S2', 'src/cart.py:17', false]],
      omitted: null, count: 'S1=0 S2=2 S3=0', secrets: SECRETS,
    },
  },
};
