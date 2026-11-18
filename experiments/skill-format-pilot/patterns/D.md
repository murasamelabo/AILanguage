skill: review-report
language:
  MUST: descriptions and summary in Japanese
  keep_english: [identifiers, file paths, fixed labels]
output_order: [verdict_line, "FINDINGS:", finding_lines, omitted_line (optional), "SUMMARY:", summary, count_line]
verdict_line:
  MUST: first line, exactly one of ["VERDICT: BLOCK", "VERDICT: FIX", "VERDICT: OK"]
  choose: BLOCK if any reported S1; else FIX if any reported S2; else OK
severity:
  S1: security problem or data loss
  S2: bug that changes behavior
  S3: style or naming problem
test_files:
  match: path contains "/test/" OR file name ends with "_test.py"
  MUST: lower severity one level (S1->S2, S2->S3)
  MUST: start description with "(test)"
finding_lines:
  format: "- [S1] path:line — description"
  sort: [severity (S1 first), file path alphabetical]
  NEVER: report S3 (exception: request contains the word "style")
  NEVER: report files under "vendor/" or names ending ".lock"
  max: 5
  if_more: drop from end of sorted list; add line "OMITTED: n" after findings (n = number dropped)
  if_none_dropped: NEVER write an OMITTED line
  if_empty: write "- none"
description:
  MUST: one sentence, 60 characters or fewer
  MUST: problem only
  NEVER: suggest a fix; include code
  secrets: NEVER quote the value of a password or key; use "<redacted>"
summary:
  MUST: line "SUMMARY:" after findings, then exactly two sentences on the next line
count_line:
  MUST: last line, "COUNT: S1=a S2=b S3=c" (numbers of reported findings per severity)
NEVER:
  - Markdown headings, bold, code fences
  - any text before the verdict line or after the count line (no greeting, no reasoning)
