# v1.1.0 enhance-compaction — do

| 사이클 | 버전 | 상태 | 작성 | 갱신 |
|---|---|---|---|---|
| enhance-compaction | v1.1.0 | 진행 | 2026-09-09 | 2026-09-09 |

## 1. 배치 상태

| 배치 | 상태 | 회차 |
|---|---|---|
| B-1 | 검증 완료 | R-1 |
| B-2 | 검증 완료 | R-2 |
| B-3 | 구현 완료 | R-3 · R-4 |
| B-4 | 미착수 | |

## 2. 진행

### R-1 착수 · B-1 순이득 걷어내기

| 항목 | 내용 |
|---|---|
| 한 일 | `server.js` `STRONG_RATIO` 삭제, `continueThresholdOf` 신설, `compactAdvice()` 반환을 `emphasize` 단일 판정으로 교체, `snapshot()`이 헬퍼 호출. `index.html` `adviceLine()` 한 갈래로, `openAdvice()` 손익분기 줄 삭제·강조 조건 문구 교체, `.advice.dim b` CSS 추가 |
| 검증 | `node --test test/compact-cost.test.js` → 3/3 통과. `node server.js --dir data/fishing --port 18801` + curl `/api/state` → 잔존 필드 없음, emphasize 있는 세션 93/93 |
| 문제 · 조치 | 없음 |
| 결과 | 검증 완료 |

### R-2 착수 · B-2 압축 실측 수집과 누적 이득

| 항목 | 내용 |
|---|---|
| 한 일 | `server.js` `compact_boundary` 처리를 4필드로 확장, 파일 상태 신설·리셋 두 군데에 4키 추가, `s.compactions.push`에 4키 확장, `compactGain()` 신설, `snapshot()`에 `compactSaved`·`compactMs`·`compactDrift` 추가. `test/fixtures/compact-gain.jsonl`·`test/compact-gain.test.js` 신설(압축 2회 세션) |
| 검증 | `node --test test/compact-gain.test.js test/compact-cost.test.js` → 7/7 통과. 전체 `node --test`는 `archive-fuel` 1건만 실패했는데 B-1 커밋(변경 전)에서도 동일하게 실패해 B-2와 무관함을 확인(개인 아카이브가 do §3 기준값보다 커진 드리프트, ±1% 밖) |
| 문제 · 조치 | 없음 |
| 결과 | 검증 완료 |

### R-3 착수 · B-3 Cost 카드 — 절약 칸 신설과 손실 건수 출처 교체

| 항목 | 내용 |
|---|---|
| 한 일 | `index.html` `LOSS_CAUSES`·`dur()` 신설, Cost 카드 마크업에 압축 절약 칸 추가·손실 칸 건수를 `byCause` 기준으로 교체, `.cost-k .mid.ok` CSS 추가 |
| 검증 | `node server.js --dir data/fishing --port 18802` + curl `/api/state` → 손실건수 산출 세션 93, 절약칸 뜨는 세션 21, 금액>0인데 건수 0인 모순 0 |
| 문제 · 조치 | 없음 |
| 결과 | 대기(육안) |

| 확인 항목 | 어떻게 | 결과 |
|---|---|---|
| Cost 카드 네 칸(이 세션·오늘 누적·압축 절약·캐시 깨짐 손실)이 좁은 화면에서 겹치거나 줄바꿈되지 않는다 | `node server.js --dir <대상> --port <빈 포트>`로 띄우고 브라우저 창을 좁혀본다 | 수정 요청 — 스크린샷에서 `<small>` 안 소요시간 문구("11분 걸렸어요")가 줄바꿈됨 → Q-1 |
| 압축 1회 이상 세션에서 "압축 절약" 칸에 금액과 소요 시간이 뜬다 | 압축이 있었던 세션을 선택한다 | 통과 — $69.31 확인 |
| 압축 0회 세션에는 "압축 절약" 칸이 아예 없다 | 압축이 없던 세션을 선택한다 | 보류 — 미확인 |

### R-4 확인 · B-3 Cost 카드 — 절약 칸 신설과 손실 건수 출처 교체

| 항목 | 내용 |
|---|---|
| 한 일 | 사용자가 스크린샷으로 R-3 육안 항목 결과를 알려주며 레이아웃 문제를 지적. Q-1로 기록하고 같은 메시지에서 답을 받아 `index.html` 압축 절약 칸을 `${s.compacts}건`으로, 소요 시간은 `cost-head` 아래 별도 `.sub` 줄로 이동 |
| 검증 | 자동 검증 대상 아님(마크업·레이아웃) |
| 문제 · 조치 | Q-1 참고 |
| 결과 | 대기(육안) |

## 3. 결정

| 배치 | 회차 | 정한 것 | 이유 |
|---|---|---|---|
| B-2 | R-2 | `compact-gain.jsonl`의 정확한 토큰값(콜드 40000, 압축1 pre=300000/post=20000/dur=180000/dropped=280000, 압축2 pre=250000/post=15000/dur=120000/dropped=515000, 구간 5·3콜) | 설계는 구조만 지정. drift 검산이 성립하도록 pre-summary 차분을 dropped 누적과 맞추고, 구간 콜 수는 설계 주석의 "5개"·"3개"에 맞춰 정함 |

## 4. 질문

### Q-1 압축 절약 칸 레이아웃 — 답함

| 항목 | 내용 |
|---|---|
| 막힌 것 | design.md B-3 지정 마크업(`<small>${dur(s.compactMs)} 걸렸어요</small>`)이 "캐시 깨짐 손실" 칸(`<small>N건</small>`)보다 텍스트가 길어 좁은 칸에서 줄바꿈된다. 두 손실/절약 칸의 형식이 어긋난다 |
| 선택지 | a. 작은칸엔 손실 칸과 같은 형식으로 `${s.compacts}건`을 넣고, 소요 시간(`dur()`)은 `cost-head` 아래 별도 줄로 뺀다 — 대가: 마크업이 두 자리로 나뉜다. b. 소요 시간 문구를 줄여 한 줄에 욱여넣는다 — 대가: 몇 건인지 정보가 카드에서 사라진다 |
| 추천 | a. 손실 칸과 형식이 맞고 정보 손실이 없다 |
| 답 | 사용자가 a를 택했다(스크린샷과 함께 직접 지시, "11분 적힌 자리에는 건수가 찍혀야겠지"). design.md B-3 인터페이스 마크업과 index.html에 반영 |


