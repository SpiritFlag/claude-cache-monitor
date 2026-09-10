# v1.3.0 enhance-subagent — do

| 사이클 | 버전 | 상태 | 작성 | 갱신 |
|---|---|---|---|---|
| enhance-subagent | v1.3.0 | 진행 | 2026-09-10 | 2026-09-10 |

## 1. 배치 상태

| 배치 | 이름 | 상태 | 회차 |
|---|---|---|---|
| B-1 | 사람 프롬프트에서 완료 알림 · IDE 이벤트 빼기 | 검증 완료 | R-1 |
| B-2 | 서브에이전트를 집계 단위로 세우기 | 검증 완료 | R-2 |
| B-3 | 캐시 만료 판정을 호출 단위로 | 검증 완료 | R-3 |
| B-4 | 화면 — 서브 줄 · 서브 목록 · 대상별 카드 | 대기(육안) | R-4 |

## 2. 진행

### R-1 착수 · B-1

| 항목 | 내용 |
|---|---|
| 한 일 | `NOISE_TAGS` 상수 · `isNoise` 추가, `human` 판정과 `comp` 집계를 블록 단위로 교체. 픽스처 · 테스트 신설 |
| 검증 | `node --test test/noise-prompts.test.js test/prompt-count.test.js test/prompt-marks.test.js` → 9 pass |
| 문제 · 조치 | 없음 |
| 결과 | 검증 완료 |

표본 대조: `data/fishing` 띄워 `curl /api/state`에서 `1904d418` 세션 `prompts === 4` 확인.

### R-2 착수 · B-2

| 항목 | 내용 |
|---|---|
| 한 일 | `s.subs` 슬롯 맵 · `subSlot` · `nameSub` · `targetOf` 추가. `activeAt` · `flushGroup` · `trackActive` · `folderTotals` · `handleRecord` · `readFile` · `charState` · `snapshot` · `detail` · 라우트를 g 기준으로 교체 |
| 검증 | `node --test test/subagent-split.test.js test/active-time.test.js test/context-axis.test.js test/break-core.test.js test/bridge-cause.test.js` → 19 pass |
| 문제 · 조치 | 없음 |
| 결과 | 검증 완료 |

표본 대조: `1904d418` 세션 `cost 13.22` · `activeMs 24.1분` · `subTotal.cost 40.40` · `subTotal.activeMs 92.6분` · `cost+subTotal.cost 53.62` · `subs.length 6`, 이름이 전부 `Audit issues batch …`로 시작. 서브 2개짜리 세션(`2cacf362…`) `subs.length === 2` 확인.

### R-3 착수 · B-3

| 항목 | 내용 |
|---|---|
| 한 일 | TTL 갱신을 `f.prev.ttlMin`(D-6) 기준으로, 만료 조건을 `prev.ttlMin` 기준으로 교체. `f.prev`에 `ttlMin` 필드 추가 |
| 검증 | `node --test test/subagent-split.test.js test/break-core.test.js test/shift-cause.test.js test/resume-cause.test.js test/bridge-cause.test.js test/breaks-cap.test.js` → 19 pass |
| 문제 · 조치 | 없음 |
| 결과 | 검증 완료 |

표본 대조: `1904d418` 세션 `byCause === {}` · `ttlMin === 60` · `subs[*].byCause.ttl_expiry.n` 합 6. `5f111656` 세션은 B-2 커밋(`12c9c8c`) 서버와 대조해 `byCause.unexplained.n`이 1로 그대로다 — 그 건은 설계 문서가 이미 밝힌 대로 이슈의 판단 재료이지 이 사이클의 기준이 아니다.

### R-4 착수 · B-4

| 항목 | 내용 |
|---|---|
| 한 일 | CSS · `sel` 선택 상태 · `renderList` · `loadDetail` · `renderMain` 분해(`ttlCard`·`subListCard`·`stateChips`) · `fuelCells`·`habitsCard` 시그니처 · `drawChart`의 `!b.sub` 제거 · `tick`·`openAdvice`·리사이즈 핸들러 |
| 검증 | `node -e "require('fs').readFileSync('index.html','utf8')"` 통과, `grep -c selected index.html` → 0 |
| 문제 · 조치 | 없음 |
| 결과 | 대기(육안) |

| V | 확인 항목 | 어떻게 | 결과 |
|---|---|---|---|
| V-1 | `1904d418` 세션 아래에만 "서브에이전트 6" 줄이 붙고 `$40.4` · `1.5h` 부근. 서브 없는 세션엔 줄 없음. 세션 줄 시간 칸이 `24m` | 목록 육안 | 대기 |
| V-2 | 서브 줄 누르면 첫 칸이 서브 목록(이름 6개)으로 바뀌고 첫 서브가 강조. Context가 그 서브 ctx(17만~26만), Cost가 "이 서브" `$5~9`·"서브 소계" `$40.4`, 연비 4줄, 그래프가 그 서브 선, 깨짐 표에 `ttl_expiry (sub)` 1건, 습관 표 제목 "이 서브" | 클릭 육안 | 대기 |
| V-3 | 목록에서 다른 서브 누르면 위 값이 그 서브로 바뀐다 | 클릭 육안 | 대기 |
| V-4 | 세션 줄 다시 누르면 TTL 링(60m) 복귀, Cost가 "이 세션" `$13.2`·"오늘 누적" | 클릭 육안 | 대기 |
| V-5 | 창을 1280px 아래로 좁히면 2×2 접힘에서 서브 목록 카드가 TTL 자리와 같은 칸 | 리사이즈 육안 | 대기 |
| V-6 | 서브 2개짜리 세션(`2cacf362-ea9e-495f-aba2-89991b25129b`) 하나에서 V-1~V-4를 다시 확인 | 클릭 육안 | 대기 |

`node server.js --dir data/fishing --port <빈 포트>`로 띄워서 봐줘.

## 3. 결정

| 배치 | 회차 | 정한 것 | 이유 |
|---|---|---|---|

## 4. 질문
