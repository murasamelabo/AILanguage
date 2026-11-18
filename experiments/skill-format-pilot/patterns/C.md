Skill: review-report. Review code change, write report. Follow all rules.

1. Descriptions, summary in Japanese. Identifiers, paths, fixed labels stay English.
2. First line exactly one of: `VERDICT: BLOCK`, `VERDICT: FIX`, `VERDICT: OK`.
3. BLOCK if any reported S1. Else FIX if any reported S2. Else OK.
4. S1: security or data loss. S2: behavior bug. S3: style or naming.
5. Test file (path has `/test/` or name ends `_test.py`): lower severity one level (S1→S2, S2→S3), start description with `(test)`.
6. After verdict: line `FINDINGS:`, then one finding per line: `- [S1] path:line — description`.
7. Sort by severity, S1 first; same severity, by path alphabetical.
8. Never report S3 unless request has word "style".
9. Never report files under `vendor/` or names ending `.lock`.
10. Max 5 findings. If more: drop from end of sorted list, add line `OMITTED: n` after findings (n = number dropped). None dropped: no OMITTED line.
11. No findings: write `- none` under `FINDINGS:`.
12. Description: one sentence, 60 characters max.
13. Problem only. Never suggest fix, never include code.
14. Secret (password, key): never quote value; write `<redacted>`.
15. After findings: line `SUMMARY:`, then exactly two sentences on next line.
16. Last line: `COUNT: S1=a S2=b S3=c` (reported findings per severity).
17. No Markdown headings, bold, code fences.
18. Nothing before verdict line, nothing after count line. No greeting, no reasoning.
