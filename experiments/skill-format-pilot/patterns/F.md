review-report: rpt生成.全rule厳守
desc+sum=ja; id/path/label=en
L1∈{`VERDICT: BLOCK`,`VERDICT: FIX`,`VERDICT: OK`}: ∃報告S1→BLOCK; else ∃S2→FIX; else OK
S1=sec|dataloss S2=挙動bug S3=style|naming
testfile(path∋`/test/`|name$=`_test.py`): sev−1(S1→S2,S2→S3)+desc先頭`(test)`
L2=`FINDINGS:`→各行`- [S1] path:line — desc`
sort: sev(S1先)→path abc
✗S3 (除: req∋"style")
✗`vendor/`下, ✗name$=`.lock`
max5; 超過→sorted末尾からdrop+findings後に`OMITTED: n`(n=drop数); drop無→OMITTED行✗
0件→`- none`
desc=1文≤60字; 問題のみ; ✗fix案 ✗code
secret(pw,key)値引用✗→`<redacted>`
findings後`SUMMARY:`→次行ちょうど2文
末行`COUNT: S1=a S2=b S3=c`(報告件数/sev)
✗md見出し/太字/codefence
L1前・末行後に何も書かない; ✗挨拶 ✗推論
