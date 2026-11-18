skill review-report
MUST lang of desc-text & summary-text = ja ; identifier, path, fixed label = en
MUST first-line = `VERDICT: BLOCK` | `VERDICT: FIX` | `VERDICT: OK`
verdict-val = BLOCK if any reported S1 / FIX if any reported S2 / OK
sev-val: S1 = security | data loss ; S2 = behavior bug ; S3 = style | naming
test-path = path has `/test/` | name ends `_test.py`
if finding @ test-path: MUST sev-val -> one lower (S1->S2, S2->S3) & desc-text starts `(test)`
MUST second-line = `FINDINGS:` ; then finding-list ; finding-line = `- [S1] path:line — {desc-text}`
MUST finding-list sort = sev-val (S1 first) > path (alphabetical)
NEVER report S3 ; except request has word "style"
NEVER report finding @ `vendor/` | name ends `.lock`
MUST finding-n <= 5 ; if more: drop from end of sorted finding-list & add omitted-line `OMITTED: {dropped-n}` after finding-list ; if none dropped: NEVER omitted-line
if finding-n = 0: MUST write `- none` under `FINDINGS:`
MUST desc-text = 1 sentence, <= 60 characters
MUST desc-text = problem only ; NEVER fix ; NEVER code
if finding has secret (password, key): NEVER quote secret-val ; use `<redacted>`
MUST after finding-list: summary-line `SUMMARY:` ; then next line = exactly 2 sentences
MUST last-line = `COUNT: S1={a} S2={b} S3={c}` ; a, b, c = reported finding-n per sev-val
NEVER Markdown heading, bold, code fence
NEVER text before first-line | after last-line ; no greeting, no reasoning
