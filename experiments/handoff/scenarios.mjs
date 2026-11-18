// 引き継ぎ実験の素材。書き手は作業ログだけを見て引き継ぎメッセージを書き、
// 読み手は引き継ぎメッセージだけを見て質問に答える。質問は書き手には見せない。
// 各シナリオの最後の質問は、ログに答えがない（UNKNOWN が正解の）対照質問。

const num = n => new RegExp(`(^|[^\\d.])${n}([^\\d]|$)`);
const NO = /^\W*no\b/i;
const UNKNOWN = /unknown/i;

export const SCENARIOS = {
  bug: {
    log: `[09:02] Task from Mika (PM): users in Japan sometimes get pages in German. Ticket WEB-4127. Deadline: fix must be in release 3.18, code freeze Thursday 17:00 JST.
[09:05] Reproduced on staging: 3 of 40 requests to /pricing with Accept-Language: ja returned lang="de". Production error dashboards show nothing (it is not an error).
[09:11] Hypothesis 1: CDN geo routing sends JP traffic to the Frankfurt edge. Checked edge logs: all 40 requests were served from tyo-2. Ruled out.
[09:20] Hypothesis 2: translation bundle fallback. ja bundle is 412 KB, loads fine, no 404s. Ruled out.
[09:34] Looked at the render cache. src/cache/page_cache.py builds the key at line 58: key = f"{route}:{plan_tier}". Language is not in the key. TTL is 300 s.
[09:36] So the first request after expiry decides the language for everybody for 5 minutes. Matches the 3/40 pattern (a German tester was hitting staging).
[09:41] git blame: line 58 was last changed in commit a41c9e7 by Tomas, 2 weeks ago ("simplify cache key"), which removed locale from the key. PR #882.
[09:48] Fix option A: add locale to the key -> cache entries multiply by the 14 supported locales. Redis memory is now 2.1 GB of the 4 GB limit; the page cache is about 300 MB of that, so it would become about 4.2 GB -> over the limit. Not acceptable as is.
[09:55] Fix option B: add locale to the key AND cache only the 5 top locales (ja, en, de, fr, es); other locales render uncached. Estimated page cache 1.5 GB -> total about 3.3 GB. OK.
[10:02] Asked Tomas on chat: he agrees with B, but says do NOT change the TTL; the billing banner depends on the 300 s TTL.
[10:10] Wrote a failing test tests/cache/test_page_cache.py::test_key_includes_locale. It fails as expected. Not committed yet; it is on branch fix/web-4127-locale-key (local only, not pushed).
[10:15] Remaining: implement B in page_cache.py, add the config list CACHED_LOCALES in config/cache.yaml, run the full cache test suite (make test-cache, about 6 min), push the branch, open a PR with Tomas as reviewer, then tell Mika.
[10:16] Note: staging Redis must be flushed after deploy (redis-cli -n 3 FLUSHDB) or stale pages stay up to 5 min. Use db 3 only; db 0 holds sessions - never flush db 0.`,
    questions: [
      ['What is the ticket ID?', /WEB-4127/i, 'WEB-4127'],
      ['Which file and line contains the root cause? (path:line)', /page_cache\.py\D*58/, 'src/cache/page_cache.py:58'],
      ['Which commit introduced the bug? (hash)', /a41c9e7/, 'a41c9e7'],
      ['What is the cache TTL in seconds?', num(300), '300'],
      ['Was CDN geo routing the cause? (yes/no)', NO, 'no'],
      ['Which fix option was chosen? (A or B)', /^\W*(option\s*)?B\b/i, 'B'],
      ['How many locales will be cached?', num(5), '5'],
      ['What setting must not be changed, according to Tomas?', /ttl/i, 'TTL'],
      ['What command flushes the staging cache after deploy?', /redis-cli\s+-n\s+3\s+FLUSHDB/i, 'redis-cli -n 3 FLUSHDB'],
      ['Which Redis db number must never be flushed?', num(0), '0'],
      ['Has the branch with the failing test been pushed to the remote? (yes/no)', NO, 'no'],
      ['Who should review the PR?', /tomas/i, 'Tomas'],
      ['What is the Redis memory limit in GB?', /(^|[^\d.])4(\.0)?\s*(gb)?\s*$/i, '4'],
      ['What is the name of the config list to add?', /CACHED_LOCALES/, 'CACHED_LOCALES'],
      ['When is the code freeze? (day and time)', /thu\w*\W+.*17:00|17:00.*thu/i, 'Thursday 17:00 JST'],
      ['What is the hostname of the staging server?', UNKNOWN, 'UNKNOWN'],
    ],
  },
  migration: {
    log: `[14:00] Task from Priya (data lead): migrate table orders_legacy (Postgres 12, host db-old) to orders_v2 (Postgres 16, host db-new). Runbook MIG-77. Must finish before the reporting job at 02:00 UTC.
[14:03] Total rows in orders_legacy: 48,200,000. Migrating in batches by year with scripts/migrate_orders.py --year YYYY.
[14:05] 2019 done: 6,100,000 rows. Checksums match.
[14:31] 2020 done: 9,400,000 rows. Checksums match.
[15:02] 2021 done: 11,300,000 rows. Checksums match.
[15:40] 2022 FAILED at about row 4.0M of 12,500,000: error "numeric field overflow" in column discount_rate. The batch rolled back automatically; orders_v2 has no 2022 rows.
[15:48] Cause: orders_v2.discount_rate is NUMERIC(4,3); legacy has 212 rows in 2022 with discount_rate = 10.000 (bad data: should have been 1.000 = 100%). Confirmed with Priya: these come from a known bug in the March 2022 promo.
[15:55] Priya's decision: do NOT widen the column. Clamp values > 1 to 1.000 during migration and log the order ids to the migration_fixes table.
[16:05] Added flag --clamp-discount to scripts/migrate_orders.py (commit 7be21d0, pushed to branch mig-77). Dry run on 2022 with the flag: 0 errors, 212 rows clamped.
[16:10] Not started yet: the real 2022 run, then 2023 (8,900,000 rows). Does 2023 have the same bad pattern? Checked: 0 rows > 1 in 2023.
[16:12] Speed so far is about 310,000 rows/min.
[16:14] After all years: run scripts/verify_counts.py (compares counts per year), then switch the view orders_current to point to orders_v2 (sql/switch_view.sql). Do not drop orders_legacy - Priya wants it kept for 30 days.
[16:15] Warning: db-new replica lag reached 40 s during 2021; pause if lag > 60 s (check with scripts/lag.sh).
[16:16] Credentials are in vault path kv/data/mig-77 (do not copy them into files).`,
    questions: [
      ['What is the runbook ID?', /MIG-77/i, 'MIG-77'],
      ['How many rows have been successfully migrated so far?', /(^|[^\d.])26[.,]?8/, '26,800,000'],
      ['Which year failed?', /2022/, '2022'],
      ['Which column caused the failure?', /discount_rate/, 'discount_rate'],
      ['How many bad rows are there in the failed year?', num(212), '212'],
      ['What was decided: widen the column or clamp the values?', /clamp/i, 'clamp'],
      ['What command-line flag enables the fix?', /--clamp-discount/, '--clamp-discount'],
      ['Which commit added the flag? (hash)', /7be21d0/, '7be21d0'],
      ['Which year should be run next?', /2022/, '2022'],
      ['How many rows remain to be migrated in total?', /(^|[^\d.])21[.,]?4/, '21,400,000'],
      ['Which script verifies the counts after all years are done?', /verify_counts/, 'scripts/verify_counts.py'],
      ['Should orders_legacy be dropped after the switch? (yes/no)', NO, 'no'],
      ['Above what replica lag in seconds should the migration pause?', num(60), '60'],
      ['What is the vault path of the credentials?', /kv\/data\/mig-77/, 'kv/data/mig-77'],
      ['By what time (UTC) must the migration finish?', /0?2:00/, '02:00'],
      ['Does 2023 need clamping? (yes/no)', NO, 'no'],
      ['Who owns the reporting job?', UNKNOWN, 'UNKNOWN'],
    ],
  },
  library: {
    log: `[Mon] Task from Kenji (tech lead): pick a PDF text-extraction library for the invoice pipeline (service invoice-reader, Python 3.12). Decision doc DOC-311 is due Friday.
Requirements from Kenji: (1) the license must allow commercial use without publishing our code, (2) p95 under 2.0 s per 10-page invoice on the standard worker (2 vCPU), (3) table extraction accuracy of at least 90% on our test set of 120 invoices (tests/data/invoices_120/).
Candidates tested: pdfalpha 4.2, quickpdf 1.9, tabuliner 0.8.
pdfalpha 4.2: license AGPL-3.0 -> fails requirement 1 unless we buy the commercial license ($9,000/year). p95 1.1 s. Table accuracy 96%.
quickpdf 1.9: license MIT. p95 0.6 s. Table accuracy 81% -> fails requirement 3. It fails mostly on borderless tables (19 of the 23 failures).
tabuliner 0.8: license Apache-2.0. p95 2.6 s on 2 vCPU -> fails requirement 2; but 1.4 s on 4 vCPU. Table accuracy 93%.
Idea tested: quickpdf for text + tabuliner only for pages that contain tables (detected by quickpdf's page.has_lines heuristic): p95 1.7 s on 2 vCPU, accuracy 92%, both licenses are fine. Benchmark script: bench/hybrid_bench.py, results in bench/results/hybrid_2vcpu.json.
Problem: the hybrid crashes on encrypted PDFs (3 of the 120 files) - tabuliner raises EncryptedPdfError. Workaround not written yet: decrypt first with qpdf (already in the worker image).
Kenji's reaction (chat, Wed): prefers the hybrid; refuses the $9,000 license; moving to 4 vCPU workers is not allowed this quarter (budget).
Still to do: implement the qpdf pre-step in src/extract/hybrid.py, rerun the bench on all 120, write DOC-311 with the comparison table, and get sign-off from Kenji and from Aiko (security) because qpdf handles encrypted files.
Pin versions: quickpdf==1.9.2, tabuliner==0.8.1 (0.8.0 has a memory leak, issue #417).`,
    questions: [
      ['What is the decision document ID?', /DOC-311/i, 'DOC-311'],
      ['Which approach is preferred? (pdfalpha / quickpdf / tabuliner / hybrid)', /hybrid/i, 'hybrid'],
      ['Why was pdfalpha rejected? (license / speed / accuracy)', /licen[sc]e/i, 'license'],
      ['What is the table accuracy of quickpdf alone, in percent?', num(81), '81'],
      ['What is the p95 of tabuliner alone on 2 vCPU, in seconds?', /2\.6/, '2.6'],
      ['What is the p95 of the hybrid on 2 vCPU, in seconds?', /1\.7/, '1.7'],
      ['What is the table accuracy of the hybrid, in percent?', num(92), '92'],
      ['What is the minimum required table accuracy, in percent?', num(90), '90'],
      ['How many invoices are in the test set?', num(120), '120'],
      ['How many test files are encrypted?', num(3), '3'],
      ['Which tool will be used to decrypt PDFs?', /qpdf/i, 'qpdf'],
      ['Which source file gets the decryption pre-step?', /src\/extract\/hybrid\.py/, 'src/extract/hybrid.py'],
      ['Who must sign off besides Kenji?', /aiko/i, 'Aiko'],
      ['What exact tabuliner version should be pinned?', /0\.8\.1/, '0.8.1'],
      ['Is moving to 4 vCPU workers allowed this quarter? (yes/no)', NO, 'no'],
      ['How much is the pdfalpha commercial license per year, in dollars?', /9[,.]?000/, '9,000'],
      ['What is the name of the CI pipeline?', UNKNOWN, 'UNKNOWN'],
    ],
  },
};

// 引き継ぎメッセージの書き方。
const L0_SPEC = `L0 reading rules
One statement per line. No articles, no inflection, no plural. Fixed order: TAG topic = body.
Tags: FACT (established), NOT (ruled out), MUST / NEVER (constraint), TODO (next step, in order), WHO (person and role), OPEN (unknown).
Compound words are head-final; the last part gives the type: -path file path, -n number, -val literal value, -cmd command, -id identifier, -date date or time.
Symbols: = is; -> causes or becomes; | or; & and; @ located in; <= at most; ; separates clauses; \`x\` exact text.`;

export const FORMATS = {
  ja: { how: 'Write the handoff in natural Japanese prose.' },
  en: { how: 'Write the handoff in natural English prose.' },
  tele: { how: 'Write the handoff in terse telegraphic English: drop articles, filler and connecting words; fragments are fine.' },
  struct: { how: 'Write the handoff as structured key-value text (YAML-like): short keys and lists, no prose sentences.' },
  free: {
    how: 'The reader is another instance of the same kind of model as you, and no human will read this. Write the handoff in whatever dense notation you would understand best, using as few tokens as possible without losing any fact the next agent needs.',
  },
  lzh: { how: 'Write the handoff in Classical Chinese (文言文).' },
  l0: { how: 'Write the handoff in the notation L0, defined below.', spec: L0_SPEC },
};

export function writerPrompt(scenario, format) {
  const f = FORMATS[format];
  return `You are an agent that has finished part of a task. Below is your work log. Another agent will continue the work. It will see ONLY your handoff message, not the log.

Write the handoff message. It must let the next agent continue without the log: what is established, what was ruled out, constraints, people, and what to do next. Keep identifiers, file paths, numbers and commands exactly as they appear in the log. Output only the handoff message.

${f.how}${f.spec ? '\n\n' + f.spec : ''}

<log>
${SCENARIOS[scenario].log}
</log>
`;
}

export function readerPrompt(scenario, format, handoff) {
  const f = FORMATS[format];
  const qs = SCENARIOS[scenario].questions.map(([q], i) => `q${i + 1}. ${q}`).join('\n');
  return `You are an agent taking over work from another agent. Below is their handoff message. You have no other information.
${f.spec ? '\nThe handoff is written in the notation L0:\n' + f.spec + '\n' : ''}
<handoff>
${handoff}
</handoff>

Answer each question using only the handoff. If the handoff does not contain the answer, write UNKNOWN. Do not guess. Answer in English and copy identifiers exactly.
Output exactly one line per question in the form \`q1: answer\`, giving the shortest exact answer (an identifier, a number, yes/no, or a few words). No other text.

${qs}
`;
}

// 読み手の回答を採点する。正解、UNKNOWN（情報が落ちた）、誤答に分ける。
export function scoreAnswers(scenario, text) {
  const qs = SCENARIOS[scenario].questions;
  const answers = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*q(\d+)\s*[:.]\s*(.*)$/i);
    if (m) answers[Number(m[1])] = m[2].trim();
  }
  let correct = 0;
  let unknown = 0;
  let wrong = 0;
  let controlOk = false;
  const detail = [];
  qs.forEach(([, re], i) => {
    const a = answers[i + 1] ?? '';
    const isControl = i === qs.length - 1;
    const ok = re.test(a);
    if (isControl) {
      controlOk = ok;
    } else if (ok) {
      correct++;
    } else if (UNKNOWN.test(a) || a === '') {
      unknown++;
    } else {
      wrong++;
    }
    detail.push(ok ? 1 : 0);
  });
  return { correct, unknown, wrong, total: qs.length - 1, controlOk, detail };
}
