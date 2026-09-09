# v1.2.0 enhance-measurement — do

| 사이클 | 버전 | 상태 | 작성 | 갱신 |
|---|---|---|---|---|
| enhance-measurement | v1.2.0 | 진행 | 2026-09-09 | 2026-09-09 |

## 1. 배치 상태

| 배치 | 이름 | 상태 | 회차 |
|---|---|---|---|
| B-1 | 아카이브 의존 테스트 걷어내기 | 검증 완료 | R-1 |
| B-2 | 사람이 친 입력이 다 세지게 | 검증 완료 | R-2 · R-3 |
| B-3 | sys 사다리 철거 | 구현 완료 | R-4 |
| B-4 | 브릿지 재접속을 원인으로 보이기 | 미착수 | |

## 2. 진행

### R-1 착수 · B-1

| 항목 | 내용 |
|---|---|
| 한 일 | `test/archive-fuel.test.js` 삭제, `CLAUDE.md` `## cycle` 검증 항목·픽스처 항목 교체 |
| 검증 | `node --test` → 31건 전부 통과 · `node --test test/active-time.test.js test/context-axis.test.js` → 7건 통과 · `grep -n "27건\|archive-fuel" CLAUDE.md` → 0건 |
| 문제 · 조치 | — |
| 결과 | 검증 완료 |

### R-2 착수 · B-2

| 항목 | 내용 |
|---|---|
| 한 일 | `f.askIds` 프레임 필드 추가, `case 'assistant'` tool_use 루프에 id 수집, `case 'user'` askAnswer 판정, `case 'attachment'`에 `queued_command`(human·prompt) 처리. 픽스처 `ask-answer.jsonl` · `queued-human.jsonl`, 테스트 `test/prompt-count.test.js` 신설 |
| 검증 | `node --test test/prompt-count.test.js test/prompt-marks.test.js` → 새 4건 + 기존 3건 전부 통과. 범위 밖 전체 스위트 `node --test` → 34/35 통과, `rewrite-dedupe.test.js`의 `s.prompts` 단언(1) 실패(실제 2) |
| 문제 · 조치 | `test/rewrite-dedupe.test.js`(B-2 지시서 밖 파일)가 AskUserQuestion 답변을 프롬프트로 세지 않던 옛 동작을 단언하고 있어, 이번 배치의 올바른 구현과 충돌한다. 지시서 밖 테스트라 임의로 못 고치고 Q-1로 넘긴다 |
| 결과 | 멈춤(Q-1) |

### R-3 답 · B-2

| 항목 | 내용 |
|---|---|
| 한 일 | Q-1 답 반영. `test/rewrite-dedupe.test.js`의 `s.prompts` 단언 1→2 |
| 검증 | `node --test test/prompt-count.test.js test/prompt-marks.test.js test/rewrite-dedupe.test.js` → 9건 통과 · `node --test` → 35건 전부 통과 |
| 문제 · 조치 | — |
| 결과 | 검증 완료 |

### R-4 착수 · B-3

| 항목 | 내용 |
|---|---|
| 한 일 | `resolveSys` · `CAL.byKey`/`byProj` · `cfgKey`/`cfgNames`/`cfgFrozen` · `coldStartCw`/`warmStartTotal`/`sysSource`/`projKey` · `normName`/`serverNamesFromToolNames`/`projectKey`/`medianExcl`/`keyOf` 삭제. `CAL.folder.first`로 표본 교체, 첫 호출 확정을 `sysTokens = total`로 단순화, `recomputeAdvice()`에서 시스템 재계산 제거. `index.html`의 `SYS_SRC` 삭제, `COMP` 시스템 라벨 축약, `ctxLegend()` 단순화. `test/sys-calibration.test.js` 재작성 |
| 검증 | `node --test test/sys-calibration.test.js test/compact-cost.test.js test/compact-gain.test.js test/context-axis.test.js test/active-time.test.js` → 18건 통과 · `grep -n "resolveSys\|cfgKey\|..." server.js index.html` → 0건 · `node --test`(범위 밖 확인) → 36건 전부 통과 · `data/fishing` curl 확인 → 세션 93·잔존 필드 0·sysTokens 0인 세션 0·CAL.n.sys 93(세션 수와 일치) |
| 문제 · 조치 | — |
| 결과 | 대기(육안) |

| V | 확인 항목 | 어떻게 | 결과 |
|---|---|---|---|
| V-1 | 컨텍스트 구성 범례의 시스템 줄에 출처 문구(실측/추정)가 없고 라벨이 `시스템`이다 | `node server.js --dir <대상> --port <빈 포트>`로 띄운 대시보드에서 세션 카드의 구성 범례 확인 | 대기 |
| V-2 | 그래프 첫 점의 컨텍스트 구성 중 시스템 비율이 그 세션의 `sysTokens`와 맞아떨어진다(첫 점은 100% 시스템으로 보일 수 있음 — 정상, plan §4 리스크에 기록됨) | 같은 대시보드에서 세션 상세 그래프의 첫 점 확인 | 대기 |

## 3. 결정

| 배치 | 회차 | 정한 것 | 이유 |
|---|---|---|---|

## 4. 질문

### Q-1 `rewrite-dedupe.test.js`의 `s.prompts` 단언이 B-2 구현과 충돌 — 답함

| 항목 | 내용 |
|---|---|
| 막힌 것 | `test/rewrite-dedupe.test.js`(design.md가 지목하지 않은 파일)의 픽스처 `rewrite-dup.jsonl`에 `AskUserQuestion` 호출과 그 답(`tool_result`)이 들어 있다. 재기록 dedup(uuid 동일) 뒤 남는 것은 답 1건뿐인데, B-2 구현이 이걸 프롬프트로 세면서 `s.prompts`가 옛 단언값 1에서 2로 바뀌어 그 테스트가 깨진다 |
| 선택지 | a. `rewrite-dedupe.test.js`의 `s.prompts` 단언을 1→2로 고친다 — 대가: design.md B-2가 지목하지 않은 파일을 건드린다 · b. 그대로 두고 실패로 남긴다 — 대가: `node --test`가 실패 1건으로 끝나 close의 최종 검증을 막는다 |
| 추천 | a. 이 단언은 "AskUserQuestion 답변은 프롬프트가 아니다"라는 옛 동작을 그대로 찍어둔 것이고, 그 동작이 정확히 이번 배치(SC-3)가 고치려는 버그다. 재기록 dedup 자체(`compacts`·`asks`·`commits`·`toolResult`·`toolInput`·`results`·`breaks`)는 전혀 안 바뀌므로 그 단언들은 그대로 둔다 |
| 답 | 사용자가 a를 택했다. 이유는 그 단언이 이번 배치가 고치려는 옛 버그를 그대로 찍어둔 것이라서. `test/rewrite-dedupe.test.js`의 `s.prompts` 단언을 1→2로 고쳤다 |

