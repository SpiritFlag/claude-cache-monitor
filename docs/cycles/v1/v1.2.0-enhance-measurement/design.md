# v1.2.0 enhance-measurement — design

| 사이클 | 버전 | 상태 | 작성 | 갱신 |
|---|---|---|---|---|
| enhance-measurement | v1.2.0 | 확정 | 2026-09-09 | 2026-09-09 |

## 0. 공통

- 의존성을 추가하지 않는다. Node 내장 모듈만 쓴다. `package.json`을 만들지 않는다.
- 픽스처는 `test/fixtures/*.jsonl`에 합성으로 만든다. `data/` 아래를 읽는 테스트를 새로 만들지 않는다.
- 픽스처의 프롬프트 본문에는 `x` · `prompt-body-…` 같은 무의미한 문자열만 쓴다. 실제 대화 내용을 넣지 않는다.
- 수치를 확인할 때 로그를 `grep`으로 직접 집계하지 않는다. `server.js`의 `replay()`를 거친다. `handleRecord`는 `uuid`로 재기록 구간을, `message.id`로 토큰 회계를 각각 한 번만 센다.
- 배치마다 그 배치의 검증 명령만 돌린다. 인자 없는 `node --test`는 돌리지 않는다.
- 배치 하나가 끝날 때마다 커밋한다. 커밋 메시지는 `do: B-n {한 줄}`.

## 1. 배치

### B-1 아카이브 의존 테스트 걷어내기

- 목표: `node --test`가 개인 아카이브 크기와 무관하게 통과한다.
- 파일
  - 삭제 `test/archive-fuel.test.js`
  - 수정 `CLAUDE.md` — `## cycle` 절의 검증 항목
- 인터페이스

  `CLAUDE.md`의 `## cycle` 절 첫 항목을 아래로 교체한다. 건수 `31`은 삭제 후 `node --test`가 실제로 출력한 `ℹ tests` 값으로 적는다(다르면 실제 값을 쓴다).

  ```
  - 검증: `node --test` (31건 · 2초 · **인자 없이** — 디렉터리 인자를 주면 Node 24가 그것을 모듈로 읽으려다 실패한다. 인자가 없으면 하위 폴더를 통째로 훑으므로 레포 안에 다른 체크아웃을 두지 않는다) · 육안 확인은 사용자가 `node server.js --dir <대상> --port <빈 포트>`로 띄운 대시보드를 본다 · 수치 대조는 `curl localhost:<포트>/api/state`의 `byCause` · `breaks`
  ```

  같은 절 마지막 항목(테스트 픽스처 관련)에 아래 문장을 이어 붙인다.

  ```
  테스트 입력은 `test/fixtures/`의 커밋된 합성 픽스처뿐이다. `data/`는 육안 확인과 수치 대조 전용이고 테스트가 읽지 않는다 — 커밋되지 않은 데이터에 기대는 테스트는 그 데이터가 바뀔 때마다 깨지고, 데이터가 변한 것인지 코드가 회귀한 것인지 구분할 수 없다.
  ```

- 순서: 1) 파일 삭제 → 2) `node --test`로 실제 건수 확인 → 3) `CLAUDE.md` 두 곳 교체
- 검증
  ```
  test -e test/archive-fuel.test.js && echo "남아있음" || echo "삭제됨"
  node --test test/active-time.test.js test/context-axis.test.js
  grep -n "27건\|archive-fuel" CLAUDE.md
  ```
  `삭제됨` · 활성시간 5건 전부 통과 · `grep` 결과 0건이면 끝.
- 덮는 SC: SC-1 · SC-2

---

### B-2 사람이 친 입력이 다 세지게

- 목표: `AskUserQuestion` 답변과 사람이 친 끼어들기가 `prompts` · `promptMarks`에 잡힌다.
- 파일
  - 수정 `server.js` — 프레임 초기화 · `case 'assistant'` · `case 'user'` · `case 'attachment'`
  - 신설 `test/fixtures/ask-answer.jsonl`
  - 신설 `test/fixtures/queued-human.jsonl`
  - 신설 `test/prompt-count.test.js`
- 인터페이스

  **(1) 프레임에 `askIds` 추가.** `readFile()`의 프레임 생성(`server.js:433`)과 잘림 감지 초기화(`435`) 두 곳 모두에 `askIds: new Set()` / `f.askIds = new Set()`를 넣는다. `f.seen` · `f.uuidSeen`과 같은 자리다.

  **(2) `case 'assistant'`의 tool_use 루프.** 기존 줄을 그대로 두고 `f.askIds.add(b.id)`만 더한다.

  ```js
  s.lastTool = b.name;
  if (b.name === 'AskUserQuestion') { s.asks++; if (!f.isSub) s.pendingAsk = true; f.askIds.add(b.id); }
  ```

  **(3) `case 'user'`의 사람 판정.** 기존 `human` 계산 바로 앞에 `askAnswer`를 만들고, `human`에 OR로 붙인다. `pendingAsk` 해제도 `askAnswer`로 바꾼다.

  ```js
  const askAnswer = !f.isSub && Array.isArray(c) && c.some(b => b.type === 'tool_result' && f.askIds.has(b.tool_use_id));
  const human = askAnswer || (!d.isMeta && !f.isSub && (typeof c === 'string' || (Array.isArray(c) && c.every(b => b.type === 'text' || b.type === 'image'))));
  if (human) { s.prompts++; if (ts) s.promptMarks.push({ t: ts, a: activeAt(s, f, ts) }); }
  if (askAnswer) s.pendingAsk = false;
  ```

  기존의 `if (!f.isSub && Array.isArray(c) && c.some(b => b.type === 'tool_result')) s.pendingAsk = false;` 줄은 위 마지막 줄로 **교체**한다(남겨두지 않는다).

  **(4) `case 'attachment'`에 `queued_command` 처리.** `PREFIX_EVENTS` 처리 줄 다음, 구성 키 수집 블록 앞에 넣는다.

  ```js
  if (!f.isSub && d.attachment && d.attachment.type === 'queued_command') {
    const a = d.attachment;
    if (a.commandMode === 'prompt' && a.origin && a.origin.kind === 'human') {
      s.prompts++;
      if (ts) s.promptMarks.push({ t: ts, a: activeAt(s, f, ts) });
      f.comp.user += (Array.isArray(a.prompt) ? a.prompt : [])
        .reduce((n, b) => n + (b && b.type === 'text' ? (b.text || '').length : 0), 0);
    }
  }
  ```

  같은 case 마지막의 `f.comp.reminders += …` 줄은 건드리지 않는다. `queued_command`는 `a.content` · `a.text`가 모두 없어 그 줄이 0을 더하므로 이중 집계가 되지 않는다.

  `queue-operation` 타입은 다루지 않는다. `case 'attachment'`에도 해당하지 않으므로 코드를 더할 곳이 없다.

  **(5) `test/fixtures/ask-answer.jsonl`** — 한 세션(`sessionId: "s-ask-answer"`), 아래 순서로 한 줄씩. 모든 `assistant` 줄은 `effort: "high"` · `model: "claude-sonnet-5"` · `usage`에 `input_tokens: 2` · `output_tokens: 10`을 담는다. `uuid`는 모두 다르게.

  | # | type | 내용 | 기대 |
  |---|---|---|---|
  | 1 | user | `message.content` = `"prompt-body-one"` (문자열) | prompts +1 |
  | 2 | assistant | `content`에 `{type:"tool_use", id:"ask1", name:"AskUserQuestion", input:{}}`, `cache_creation_input_tokens: 100`, `cache_read_input_tokens: 0`, `stop_reason:"tool_use"` | — |
  | 3 | user | `content` = `[{type:"tool_result", tool_use_id:"ask1", content:"ok"}]` | prompts +1 |
  | 4 | assistant | `content`에 `{type:"tool_use", id:"rd1", name:"Read", input:{}}`, `cache_creation_input_tokens: 50`, `cache_read_input_tokens: 100` | — |
  | 5 | user | `content` = `[{type:"tool_result", tool_use_id:"rd1", content:"ok"}]` | prompts 변화 없음 |
  | 6 | assistant | `content` = `[{type:"text",text:"d"}]`, `cache_creation_input_tokens: 50`, `cache_read_input_tokens: 150`, `stop_reason:"end_turn"` | — |

  타임스탬프는 `2026-09-03T00:00:00.000Z`부터 5초 간격.

  **(6) `test/fixtures/queued-human.jsonl`** — 한 세션(`sessionId: "s-queued-human"`).

  | # | type | 내용 | 기대 |
  |---|---|---|---|
  | 1 | user | `message.content` = `"prompt-body-one"` | prompts +1 |
  | 2 | assistant | `cache_creation_input_tokens: 100`, `cache_read_input_tokens: 0`, `content` = `[{type:"text",text:"x"}]` | — |
  | 3 | attachment | `attachment` = `{type:"queued_command", commandMode:"prompt", origin:{kind:"human"}, prompt:[{type:"text",text:"queued-body-abcde"}], source_uuid:"su1", timestamp:"…"}` | prompts +1, `f.comp.user`에 17 더해짐 |
  | 4 | attachment | `attachment` = `{type:"queued_command", commandMode:"task-notification", prompt:[{type:"text",text:"notify-body"}], source_uuid:"su2", timestamp:"…"}` (`origin` 없음) | 변화 없음 |
  | 5 | assistant | `cache_creation_input_tokens: 50`, `cache_read_input_tokens: 100`, `content` = `[{type:"text",text:"x"}]` | — |

  attachment 줄에도 최상위 `type` · `uuid` · `timestamp` · `sessionId`를 둔다. 타임스탬프는 `2026-09-04T00:00:00.000Z`부터 5초 간격.

  **(7) `test/prompt-count.test.js`** — `require('./helper.js')`의 `runFixture`와 `require('../server.js')`의 `detail`을 쓴다.

  ```js
  test('ask-answer: AskUserQuestion 답변은 프롬프트로 세고 일반 tool_result는 세지 않는다 (SC-3)', …)
    // snap.sessions[0].prompts === 2
    // detail(id).prompts.length === 2

  test('ask-answer: 답변을 받으면 pendingAsk가 풀린다 (SC-3)', …)
    // s.pendingAsk === false

  test('queued-human: origin.kind human + commandMode prompt만 프롬프트로 센다 (SC-4)', …)
    // snap.sessions[0].prompts === 2
    // detail(id).prompts.length === 2

  test('queued-human: 끼어들기 본문 길이가 컨텍스트 구성 user 층에 잡힌다 (SC-4)', …)
    // f.comp.user 가 "prompt-body-one"(15) + "queued-body-abcde"(17) = 32
  ```

  네 번째 단언의 `f`는 `runFixture`가 돌려주는 `f`다. 값이 32가 아니면 실제 값을 확인해 픽스처 문자열 길이로 계산이 맞는지 먼저 보고, 코드가 아니라 기대값이 틀렸으면 기대값을 고친다.

- 순서: 1) 프레임 `askIds` → 2) `case 'assistant'` → 3) `case 'user'` → 4) `case 'attachment'` → 5) 픽스처 둘 → 6) 테스트
- 검증
  ```
  node --test test/prompt-count.test.js test/prompt-marks.test.js
  ```
  새 4건 통과 + 기존 `prompt-marks` 3건이 그대로 통과(회귀 없음)면 끝. `prompt-marks` 픽스처는 `Read` 도구의 `tool_result`를 담고 있어 음성 사례를 겸한다.
- 덮는 SC: SC-3 · SC-4 · SC-5(육안)

---

### B-3 sys 사다리 철거

- 목표: 모든 세션의 `sysTokens`가 그 세션 첫 호출의 컨텍스트 총량이 되고, 구성 키·출처 개념이 사라진다.
- 파일
  - 수정 `server.js` — 상수 · `CAL` · `calibrate()` · `resolveSys()` 제거 · 프레임 필드 · `case 'attachment'` · 첫 호출 확정 · `recomputeAdvice()` · `snapshot()` · `reset()`
  - 수정 `index.html` — `SYS_SRC` 제거 · `ctxLegend()` · `COMP` 라벨
  - 수정 `test/sys-calibration.test.js` — 재작성
- 인터페이스

  **삭제 목록** (`server.js`). 지운 뒤 참조가 남지 않는지 `grep`으로 확인한다.

  | 대상 | 현재 위치 |
  |---|---|
  | `normName` | 27 |
  | `serverNamesFromToolNames` | 29-35 |
  | `CAL`의 `byKey` · `byProj` · `cfgKeys` · `noCfgKey` · `warmSys` · `n.warmSys` | 111-116 |
  | `medianExcl` · `keyOf` | 119-121 |
  | `calibrate()`의 `byKey` · `byProj` · `bucket` · `noKey` 및 관련 전부 | 123-140 |
  | `resolveSys()` 전체 | 149-165 |
  | 세션 필드 `coldStartCw` · `warmStartTotal` · `sysSource` · `projKey` · `cfgKey` | 65-67 |
  | 프레임 필드 `cfgNames` · `cfgFrozen` | 433 · 435 |
  | `case 'attachment'`의 구성 키 수집 블록 | 310-314 |
  | `snapshot()`의 `sysSource` · `cfgKey` · `projKey` | 482 |
  | `reset()`의 `CAL.cfgKeys` · `CAL.noCfgKey` | 538 |
  | 시작 로그의 `sys ladder: keys=… noKey=…` 줄 | 557 |
  | `projectKey()` — 유일한 호출처가 405이고 그 줄도 지워지므로 함께 삭제 | 38-45 |

  **`CAL.folder`의 표본 배열 교체** (D-6). `folder.cold` · `folder.warm` 두 배열을 `folder.first` 하나로 바꾼다.

  ```js
  // CAL 초기값
  folder: { first: [], summary: [], regrowth: [], rewrite: [], extra: [], postCtx: [] },

  // calibrate() 안, 세션 루프
  if (s.firstTotal) folder.first.push(s.firstTotal);

  // 중앙값
  const m = median(folder.first); CAL.sys = m != null ? m : DEFAULTS.sys; CAL.n.sys = folder.first.length;
  ```

  `CAL.warmSys` · `CAL.n.warmSys`를 계산하던 줄(147)을 지운다. `reset()`(534-538)의 `folder` 초기화도 같은 모양으로 맞춘다.

  **첫 호출 확정** (`403-411`). `if (!s.sysSet)` 블록을 아래로 교체한다.

  ```js
  if (!s.sysSet) {
    s.sysSet = true;
    s.firstTotal = total;
    s.sysTokens = total;
  }
  ```

  **`recomputeAdvice()`** (`503-511`) (D-4). 시스템 값 재계산과 구성 재계산을 없앤다.

  ```js
  function recomputeAdvice() {
    for (const [fp, f] of files) {
      if (f.isSub || !f.prev || !f.sessionId) continue;
      const s = sessions.get(f.sessionId); if (!s || !s.calls) continue;
      s.advice = compactAdvice(f, s, s.ctx, s.compScale);
    }
  }
  ```

  `continueThresholdOf`(169)는 그대로 둔다. `snapshot()`의 `continueThreshold` · `freshCost` · `charState`도 그대로다.

  **`index.html`**

  - `SYS_SRC` 상수(358-363)를 삭제한다.
  - `ctxLegend()`의 라벨 계산(339)을 `const lbl = label;`로 바꾸거나, 삼항을 지우고 `label`을 그대로 쓴다.
  - `COMP` 배열(315)의 첫 항목 라벨을 `'시스템+툴정의+CLAUDE.md'` → `'시스템'`으로 바꾼다.
  - `calNote()`(426)의 `'시스템 바닥'` 문구는 그대로 둔다.

  **`test/sys-calibration.test.js` 재작성.** 픽스처 `mcp-config-cold` · `mcp-config-warm` · `mcp-config-none` 셋을 그대로 쓰고 단언만 바꾼다. `cfgKey` · `sysSource` 단언은 전부 지운다.

  ```js
  test('mcp-config-cold: 콜드 시작 세션의 sysTokens는 첫 호출 컨텍스트 총량과 같다 (SC-6)', () => {
    const { snap } = runFixture('mcp-config-cold');
    assert.equal(snap.sessions[0].sysTokens, 40000);   // in 5 + cw 39995 + cr 0
  });

  test('mcp-config-warm: 웜 시작 세션도 첫 호출 컨텍스트 총량을 그대로 쓴다 (SC-6)', () => {
    const { snap } = runFixture('mcp-config-warm');
    assert.equal(snap.sessions[0].sysTokens, 51002);   // in 2 + cw 1000 + cr 50000
  });

  test('mcp-config-none: attachment가 없어도 첫 호출 컨텍스트 총량을 쓴다 (SC-6)', () => {
    const { snap } = runFixture('mcp-config-none');
    assert.equal(snap.sessions[0].sysTokens, 51002);   // 기존 45000(기본값)에서 바뀐다
  });

  test('sysSource · cfgKey 필드가 응답에 없다 (SC-7)', () => {
    const { snap } = runFixture('mcp-config-cold');
    const s = snap.sessions[0];
    assert.ok(!('sysSource' in s));
    assert.ok(!('cfgKey' in s));
  });
  ```

  파일 이름은 `test/sys-calibration.test.js` 그대로 둔다.

- 순서: 1) `server.js`에서 `resolveSys` · 구성 키 계열 삭제 → 2) `CAL.folder` 교체와 `calibrate()` 정리 → 3) 첫 호출 확정 교체 → 4) `recomputeAdvice()` 교체 → 5) `snapshot()` · `reset()` · 시작 로그 정리 → 6) `index.html` 세 곳 → 7) 테스트 재작성
- 검증
  ```
  node --test test/sys-calibration.test.js test/compact-cost.test.js test/compact-gain.test.js test/context-axis.test.js test/active-time.test.js
  grep -n "resolveSys\|cfgKey\|cfgNames\|sysSource\|coldStartCw\|warmStartTotal\|SYS_SRC\|medianExcl\|serverNamesFromToolNames\|normName" server.js index.html
  ```
  테스트 전부 통과 + `grep` 0건이면 끝.

  이어서 아카이브로 값이 서는지 본다(육안 판정은 사용자가 한다).
  ```
  node server.js --dir data/fishing --port 18811 &
  curl -s localhost:18811/api/state | node -e "let b='';process.stdin.on('data',d=>b+=d).on('end',()=>{const j=JSON.parse(b);const bad=j.sessions.filter(s=>'sysSource' in s||'cfgKey' in s).length;const zero=j.sessions.filter(s=>!s.sysTokens).length;console.log('세션',j.sessions.length,'| 잔존 필드 있는 세션',bad,'| sysTokens 0인 세션',zero,'| CAL.sys',j.calibration.sys,'n=',j.calibration.n.sys);})"
  ```
  잔존 필드 0 · `sysTokens` 0인 세션 0 · `CAL.n.sys`가 세션 수와 같으면 끝. 확인 뒤 그 프로세스를 종료한다.
- 덮는 SC: SC-6 · SC-7 · SC-8(육안)

---

### B-4 브릿지 재접속을 원인으로 보이기

- 목표: `readdedNames`가 채워진 `deferred_tools_delta`가 깬 캐시가 별도 원인으로 분류되고 화면에 별도 줄로 나온다.
- 파일
  - 수정 `server.js` — `case 'attachment'`의 `PREFIX_EVENTS` 처리 한 줄
  - 수정 `index.html` — `CAUSE_GROUPS` 배열에 한 줄
  - 신설 `test/fixtures/bridge-readd.jsonl`
  - 신설 `test/fixtures/bridge-added.jsonl`
  - 신설 `test/bridge-cause.test.js`
- 인터페이스

  **`server.js`** (D-5). 원인 판정 코드(`375-382`)는 건드리지 않는다. `pending`에 넣는 이름만 가른다.

  ```js
  case 'attachment':
    if (d.attachment && PREFIX_EVENTS.has(d.attachment.type)) {
      const a = d.attachment;
      const bridge = a.type === 'deferred_tools_delta' && Array.isArray(a.readdedNames) && a.readdedNames.length > 0;
      f.pending.push('prefix:' + (bridge ? 'bridge_reconnect' : a.type));
    }
  ```

  원인 키는 `bridge_reconnect`다. 기존 `prefix:` 대체 경로를 그대로 타므로 판정 순서가 바뀌지 않는다.

  **`index.html`.** `CAUSE_GROUPS` 배열에서 `tools` 줄 **바로 앞**에 넣는다(습관 순위표 순서가 배열 순서다).

  ```js
  { key: 'bridge',  label: '브릿지 재접속',      color: '#5cd67d', causes: ['bridge_reconnect'] },
  ```

  색은 기존 여덟 색과 겹치지 않는 초록 계열로 잡아 둔 값이다. 육안 확인에서 사용자가 다른 값을 지정하면 그 값을 그대로 쓴다.

  **픽스처 둘.** 캐시 깨짐 한 건씩만 만든다. 두 파일의 구조는 attachment의 필드만 다르고 나머지는 같다.

  | # | type | 내용 |
  |---|---|---|
  | 1 | assistant | `usage`: `input_tokens: 2` · `cache_creation_input_tokens: 100000` · `cache_read_input_tokens: 0` · `output_tokens: 50`, `content` = `[{type:"text",text:"x"}]`, `stop_reason:"end_turn"` |
  | 2 | attachment | 아래 표 참조 |
  | 3 | assistant | `usage`: `input_tokens: 2` · `cache_creation_input_tokens: 100000` · `cache_read_input_tokens: 0` · `output_tokens: 50`, 나머지는 1번과 같음 |

  | 파일 | sessionId | attachment |
  |---|---|---|
  | `bridge-readd.jsonl` | `s-bridge-readd` | `{type:"deferred_tools_delta", addedNames:[], removedNames:[], readdedNames:["SendUserFile"]}` |
  | `bridge-added.jsonl` | `s-bridge-added` | `{type:"deferred_tools_delta", addedNames:["mcp__github__list"], removedNames:[], readdedNames:[]}` |

  두 `assistant` 줄 모두 `model: "claude-sonnet-5"` · `effort: "high"`로 같게 두고(모델·effort 교체로 분류되지 않게), 타임스탬프는 `2026-09-05T00:00:00.000Z`부터 10초 간격으로 둔다(만료로 분류되지 않게). `uuid`는 모두 다르게. attachment 줄에도 최상위 `type` · `uuid` · `timestamp` · `sessionId`를 둔다.

  이 구성에서 2번 호출의 `rewrite`는 `min(max(0, 100002 - 2 - 0), 100000 + 2) = 100000`으로 2000을 넘어 브레이크가 하나 생기고, `shrink = 0 - 0 = 0`이라 `breakpoint_shift`로 빠지지 않는다.

  **`test/bridge-cause.test.js`**

  ```js
  test('bridge-readd: readdedNames가 있으면 bridge_reconnect로 분류된다 (SC-9)', () => {
    const { breaks, byCause } = runFixture('bridge-readd');
    assert.equal(breaks.length, 1);
    assert.equal(breaks[0].cause, 'bridge_reconnect');
    assert.equal(byCause.bridge_reconnect.n, 1);
    assert.equal(byCause.deferred_tools_delta, undefined);
  });

  test('bridge-added: addedNames만 있으면 기존 deferred_tools_delta 그대로다 (SC-9)', () => {
    const { breaks, byCause } = runFixture('bridge-added');
    assert.equal(breaks.length, 1);
    assert.equal(breaks[0].cause, 'deferred_tools_delta');
    assert.equal(byCause.bridge_reconnect, undefined);
  });

  test('bridge-readd: 손실로 세는 원인이므로 breakCost가 0보다 크다 (SC-9)', () => {
    const { s } = runFixture('bridge-readd');
    assert.ok(s.breakCost > 0);
  });
  ```

- 순서: 1) `server.js` 한 줄 → 2) 픽스처 둘 → 3) 테스트 → 4) `index.html` 한 줄
- 검증
  ```
  node --test test/bridge-cause.test.js test/break-core.test.js test/shift-cause.test.js test/resume-cause.test.js test/breaks-cap.test.js
  ```
  새 3건 통과 + 기존 원인 분류 테스트가 전부 그대로 통과면 코드 쪽은 끝.

  이어서 아카이브에서 3건이 옮겨갔는지 본다.
  ```
  node server.js --dir data/fishing --port 18812 &
  curl -s localhost:18812/api/state | node -e "let b='';process.stdin.on('data',d=>b+=d).on('end',()=>{const a={};for(const s of JSON.parse(b).sessions)for(const[c,v]of Object.entries(s.byCause||{})){a[c]=a[c]||{n:0,e:0};a[c].n+=v.n;a[c].e+=v.extra;}console.log('bridge_reconnect:',a.bridge_reconnect||'없음');console.log('deferred_tools_delta:',a.deferred_tools_delta||'없음');})"
  ```
  `bridge_reconnect`가 `n: 3` · `extra` 합 약 $5.43으로 나오고 `deferred_tools_delta`가 사라지면 끝. 확인 뒤 그 프로세스를 종료한다.

  화면 확인(습관 순위표와 그래프 범례에 별도 줄·색)은 사용자 육안이다. 항목별 표를 `do.md`에 적고 `대기(육안)`으로 두고 멈춘다.
- 덮는 SC: SC-9 · SC-10(육안)
