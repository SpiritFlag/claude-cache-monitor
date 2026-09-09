# v1.1.0 enhance-compaction — do

| 사이클 | 버전 | 상태 | 작성 | 갱신 |
|---|---|---|---|---|
| enhance-compaction | v1.1.0 | 진행 | 2026-09-09 | 2026-09-09 |

## 1. 배치 상태

| 배치 | 상태 | 회차 |
|---|---|---|
| B-1 | 검증 완료 | R-1 |
| B-2 | 검증 완료 | R-2 |
| B-3 | 미착수 | |
| B-4 | 미착수 | |

## 2. 진행

### R-1 착수 · B-1

| 항목 | 내용 |
|---|---|
| 한 일 | `server.js` `STRONG_RATIO` 삭제, `continueThresholdOf` 신설, `compactAdvice()` 반환을 `emphasize` 단일 판정으로 교체, `snapshot()`이 헬퍼 호출. `index.html` `adviceLine()` 한 갈래로, `openAdvice()` 손익분기 줄 삭제·강조 조건 문구 교체, `.advice.dim b` CSS 추가 |
| 검증 | `node --test test/compact-cost.test.js` → 3/3 통과. `node server.js --dir data/fishing --port 18801` + curl `/api/state` → 잔존 필드 없음, emphasize 있는 세션 93/93 |
| 문제 · 조치 | 없음 |
| 결과 | 검증 완료 |

### R-2 착수 · B-2

| 항목 | 내용 |
|---|---|
| 한 일 | `server.js` `compact_boundary` 처리를 4필드로 확장, 파일 상태 신설·리셋 두 군데에 4키 추가, `s.compactions.push`에 4키 확장, `compactGain()` 신설, `snapshot()`에 `compactSaved`·`compactMs`·`compactDrift` 추가. `test/fixtures/compact-gain.jsonl`·`test/compact-gain.test.js` 신설(압축 2회 세션) |
| 검증 | `node --test test/compact-gain.test.js test/compact-cost.test.js` → 7/7 통과. 전체 `node --test`는 `archive-fuel` 1건만 실패했는데 B-1 커밋(변경 전)에서도 동일하게 실패해 B-2와 무관함을 확인(개인 아카이브가 do §3 기준값보다 커진 드리프트, ±1% 밖) |
| 문제 · 조치 | 없음 |
| 결과 | 검증 완료 |

## 3. 결정

| 배치 | 회차 | 정한 것 | 이유 |
|---|---|---|---|
| B-2 | R-2 | `compact-gain.jsonl`의 정확한 토큰값(콜드 40000, 압축1 pre=300000/post=20000/dur=180000/dropped=280000, 압축2 pre=250000/post=15000/dur=120000/dropped=515000, 구간 5·3콜) | 설계는 구조만 지정. drift 검산이 성립하도록 pre-summary 차분을 dropped 누적과 맞추고, 구간 콜 수는 설계 주석의 "5개"·"3개"에 맞춰 정함 |

## 4. 질문

(없음)
