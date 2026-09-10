# v1.3.0 enhance-subagent — design

| 사이클 | 버전 | 상태 | 작성 | 갱신 |
|---|---|---|---|---|
| enhance-subagent | v1.3.0 | 확정 | 2026-09-10 | 2026-09-10 |

## 0. 공통

- 의존성을 추가하지 않는다. Node 내장 모듈만 쓴다. `package.json`을 만들지 않는다.
- 픽스처는 `test/fixtures/` 아래에 합성으로 만든다. `data/` 아래를 읽는 테스트를 만들지 않는다. 픽스처의 본문 문자열은 `prompt-body-one` · `x` 같은 무의미한 값만 쓴다.
- 픽스처 디렉터리(`test/fixtures/sub-split/`)는 `.jsonl` · `.meta.json`만 담는다. `.js`를 두지 않는다(인자 없는 `node --test`가 하위 폴더를 훑는다).
- 서버 수치는 `grep`으로 세지 않고 `server.js`의 `replay()`를 거친다.
- 배치마다 그 배치의 검증 명령만 돌린다. 인자 없는 `node --test`는 돌리지 않는다.
- 배치 하나가 끝날 때마다 커밋한다. 메시지는 `do: B-n {한 줄}`.
- 아래 줄 번호는 이 사이클 시작 시점(커밋 `f637120`)의 것이다. 앞 배치가 줄을 밀면 코드 인용으로 자리를 찾는다.
- `index.html`의 CSS 픽셀 값은 출발점이다. 육안 확인에서 사용자가 준 숫자가 있으면 그 숫자를 그대로 쓴다.

## 1. 배치

### B-1 사람 프롬프트에서 완료 알림 · IDE 이벤트 빼기

- 목표: `<task-notification>` · `<ide_opened_file>` · `<ide_selection>`으로 시작하는 text 블록이 사람 프롬프트 판정과 `comp.user`에서 빠진다. 그 블록 뒤에 사람 글이 붙은 레코드는 그대로 프롬프트다.
- 파일
  - 수정 `server.js` — 상수 한 벌 추가 · `case 'user'`의 `human` 판정 · `comp` 집계
  - 신설 `test/fixtures/noise-prompts.jsonl`
  - 신설 `test/noise-prompts.test.js`
- 인터페이스

  **(1) 상수.** `RESUME_RE`(`server.js:25`) 바로 아래에 넣는다.

  ```js
  // 사람이 친 것처럼 user 레코드에 실리지만 도구가 넣는 text 블록. 본문 첫머리의 태그 이름으로 가른다.
  // 클로드 코드가 태그 이름을 바꾸면 여기만 고친다 (v1.3.0 plan §1.4 · D-3).
  const NOISE_TAGS = ['task-notification', 'ide_opened_file', 'ide_selection'];
  const NOISE_RE = new RegExp('^\\s*<(' + NOISE_TAGS.join('|') + ')[\\s>]');
  const isNoise = b => !!b && b.type === 'text' && NOISE_RE.test(b.text || '');
  ```

  **(2) `case 'user'`의 사람 판정** (`server.js:280`). 기존 `human` 한 줄을 아래 세 줄로 교체한다. `askAnswer` 줄(279)은 그대로 둔다.

  ```js
  const blocks = typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : null;
  const own = blocks ? blocks.filter(b => !isNoise(b)) : null;          // 잡음 블록을 뺀 사람 몫
  const human = askAnswer || (!d.isMeta && !f.isSub && !!own && own.length > 0 && own.every(b => b.type === 'text' || b.type === 'image'));
  ```

  `own.length > 0`은 의도한 조건이다. 잡음 블록만 있는 레코드와 빈 배열 레코드는 사람이 아니다.

  **(3) `comp` 집계** (`server.js:285-287`). 두 줄을 고친다.

  ```js
  else if (typeof c === 'string') { f.comp[d.isMeta || NOISE_RE.test(c) ? 'reminders' : 'user'] += c.length; }
  else if (Array.isArray(c)) for (const b of c) {
    if (b.type === 'text') f.comp[d.isMeta || isNoise(b) ? 'reminders' : 'user'] += (b.text || '').length;
  ```

  `image` · `tool_result` 분기는 손대지 않는다.

  **(4) `test/fixtures/noise-prompts.jsonl`** — 한 세션 `sessionId: "s-noise-prompts"`. 모든 줄에 최상위 `uuid`(서로 다르게) · `timestamp` · `sessionId`. 타임스탬프는 `2026-09-05T00:00:00.000Z`부터 5초 간격. `assistant` 줄은 `requestId`(서로 다르게) · `effort: "high"` · `message.model: "claude-sonnet-5"` · `usage`에 `input_tokens: 2` · `output_tokens: 10` · `content: [{type:"text",text:"x"}]` · `stop_reason: "end_turn"`.

  | # | type | `message.content` | 기대 |
  |---|---|---|---|
  | 1 | user | `"prompt-body-one"` (문자열, 15자) | prompts +1 · `comp.user` +15 |
  | 2 | assistant | `cache_creation_input_tokens: 100`, `cache_read_input_tokens: 0` | — |
  | 3 | user | `[{type:"text", text:"<task-notification>\n<task-id>t1</task-id>\nnotify-body"}]` (53자) | 변화 없음 · `comp.reminders` +53 |
  | 4 | assistant | `cache_creation_input_tokens: 50`, `cache_read_input_tokens: 100` | — |
  | 5 | user | `[{type:"text", text:"<ide_opened_file>opened</ide_opened_file>"}, {type:"text", text:"prompt-body-two"}]` (41자 + 15자) | prompts +1 · `comp.user` +15 · `comp.reminders` +41 |
  | 6 | assistant | `cache_creation_input_tokens: 50`, `cache_read_input_tokens: 150` | — |
  | 7 | user | `[{type:"text", text:"<ide_selection>sel</ide_selection>"}]` (34자) | 변화 없음 · `comp.reminders` +34 |
  | 8 | assistant | `cache_creation_input_tokens: 50`, `cache_read_input_tokens: 200` | — |

  3번 text의 `\n`은 JSON 문자열 안의 이스케이프(실제 개행 문자)다.

  **(5) `test/noise-prompts.test.js`** — `require('./helper.js')`의 `runFixture`와 `require('../server.js')`의 `detail`.

  ```js
  test('noise-prompts: 알림·IDE 블록만 있는 레코드는 프롬프트가 아니고 사람 글이 붙은 레코드는 프롬프트다 (SC-4)', …)
    // snap.sessions[0].prompts === 2
    // detail(id).prompts.length === 2
    // detail(id).prompts[1].t === Date.parse('2026-09-05T00:00:20.000Z')   // 5번 줄의 시각
  test('noise-prompts: 잡음 블록 글자 수는 user가 아니라 reminders 층에 간다 (SC-4)', …)
    // f.comp.user === 30
    // f.comp.reminders === 128
  ```

  128 = 53 + 41 + 34. 값이 다르면 픽스처 문자열의 실제 길이를 먼저 재고, 코드가 아니라 기대값이 틀렸으면 기대값을 고친다.

- 순서: 1) 상수 → 2) `human` → 3) `comp` → 4) 픽스처 → 5) 테스트
- 검증
  ```
  node --test test/noise-prompts.test.js test/prompt-count.test.js test/prompt-marks.test.js
  ```
  새 2건 통과 + 기존 7건 그대로 통과면 끝. 표본 대조: `node server.js --dir data/fishing --port <빈 포트>` 띄우고 `curl -s localhost:<포트>/api/state`에서 `id`가 `1904d418`로 시작하는 세션의 `prompts`가 **4**.
- 덮는 SC: SC-4

---

### B-2 서브에이전트를 집계 단위로 세우기

- 목표: 세션이 메인 몫과 서브 슬롯을 따로 든다. 서브 파일을 함께 읽어도 메인의 `cost` · `activeMs` · `series` · `breaks`가 메인만 읽었을 때와 같다. 서브 슬롯이 `.meta.json`의 이름을 갖는다. 서브가 도는 동안 캐릭터가 `working`이다.
- 파일
  - 수정 `server.js` — `session()` · 새 함수 `subSlot` `nameSub` `targetOf` · `activeAt` · `flushGroup` · `trackActive` · `folderTotals` · `handleRecord` · `readFile` · `charState` · `snapshot` · `detail` · 라우트
  - 수정 `test/helper.js` — `runFixtureDir` 추가
  - 신설 `test/fixtures/sub-split/main.jsonl`
  - 신설 `test/fixtures/sub-split/subagents/agent-x1.jsonl`
  - 신설 `test/fixtures/sub-split/subagents/agent-x1.meta.json`
  - 신설 `test/fixtures/sub-split/subagents/agent-x2.jsonl` (meta 없음)
  - 신설 `test/subagent-split.test.js`
- 인터페이스

  **(1) 세션 필드.** `session()`(`server.js:38`)의 객체에 `subs: new Map()`을 더한다. 자리는 `subActive: 0` 옆.

  **(2) 서브 슬롯 · 이름 · 대상.** `tokensOf` 앞(`server.js:60`)에 넣는다.

  ```js
  // 서브에이전트 하나의 집계 슬롯. 세션과 같은 이름의 필드를 쓰되 세션 전용(프롬프트·압축·조언·캐릭터)은 없다.
  function subSlot(s, f) {
    let x = s.subs.get(f.agentId);
    if (!x) {
      x = { id: f.agentId, name: '', agentType: '', depth: 0, named: false,
        firstTs: 0, lastTs: 0, model: '', effort: '', ctx: 0, ttlMin: 5, lastStop: '', lastTool: '',
        calls: 0, out: 0, think: 0, cacheRead: 0, cacheWrite: 0, cost: 0, compacts: 0, asks: 0, saved: 0,
        tok: { in: 0, cw1h: 0, cw5m: 0, cwOther: 0, cr: 0, out: 0 }, modelCalls: {},
        activeMs: 0, lastA: 0, series: [], breaks: [], breakCost: 0, byCause: {} };
      s.subs.set(f.agentId, x);
    }
    if (!x.named && f.meta) nameSub(x, f.meta);
    return x;
  }
  // description → agentType → id. 없는 필드는 건너뛴다.
  function nameSub(x, meta) {
    x.named = true;
    x.name = meta.description || meta.agentType || x.id;
    x.agentType = meta.agentType || '';
    x.depth = meta.spawnDepth || 1;
  }
  // 이 파일의 값이 쌓이는 그릇. 메인 파일은 세션 자신.
  const targetOf = (s, f) => f.isSub ? subSlot(s, f) : s;
  ```

  **(3) `activeAt`** (`server.js:189`). 첫 인자 이름만 `g`로 바꾸고 본문의 `s.`를 `g.`로 바꾼다. 시그니처 `activeAt(g, f, ts)`. 호출처는 (7)에서 고친다.

  **(4) `flushGroup`** (`server.js:195`). 그룹 변수 이름이 `g`라 대상과 충돌한다. 그룹을 `grp`로 바꾸고 대상을 잡는다.

  ```js
  function flushGroup(f) {
    const grp = f.grp; if (!grp) return;
    f.grp = null; f.actPrevTs = grp.lastTs;
    const s = sessions.get(f.sessionId); if (!s) return;
    const g = targetOf(s, f);
    const ms = Math.max(0, grp.lastTs - grp.prevTs);
    g.activeMs += ms; addDay(s, grp.lastTs, ms, grp.cost);   // D-2: 서브의 활성·비용도 세션의 일별 버킷(=폴더 합계)에 들어간다
  }
  ```

  **(5) `trackActive`** (`server.js:205`). 첫 줄을 바꾼다. 나머지는 그대로.

  ```js
  if (!f.isSub && d.isSidechain === true) return;   // 사이드체인 제외(D-7, v1.1.0)는 메인 파일 안의 줄에만. 서브 파일은 모든 줄이 isSidechain
  ```

  **(6) `folderTotals`** (`server.js:217`). `activeMs += s.activeMs` 줄을 지우고 일별 버킷에서 더한다.

  ```js
  function folderTotals() {
    const days = {}; let activeMs = 0, cost = 0;
    for (const s of sessions.values()) {
      for (const k of Object.keys(s.days)) {
        const b = s.days[k], t = days[k] || (days[k] = { activeMs: 0, cost: 0 });
        t.activeMs += b.activeMs; t.cost += b.cost; activeMs += b.activeMs; cost += b.cost;
      }
    }
    return { activeMs, cost, days };
  }
  ```

  **(7) `handleRecord`.** 아래 표대로 바꾼다. 표에 없는 줄은 손대지 않는다.

  | 위치 | 지금 | 나중 |
  |---|---|---|
  | 233 `const s = session(f.sessionId);` 다음 | — | `const g = targetOf(s, f);` 추가 |
  | 235 `if (ts) { … s.firstTs … s.lastTs … }` 다음 | — | `if (ts && f.isSub) { if (!g.firstTs \|\| ts < g.firstTs) g.firstTs = ts; if (ts > g.lastTs) g.lastTs = ts; }` 추가 |
  | 245 | `s.compacts++;` | `g.compacts++;` |
  | 298 | `s.lastTool = b.name; if (b.name === 'AskUserQuestion') { s.asks++; …` | `g.lastTool = b.name; if (b.name === 'AskUserQuestion') { g.asks++; …` (`if (!f.isSub) s.pendingAsk = true; f.askIds.add(b.id);`는 그대로) |
  | 311 | `s.cost += cost; if (f.grp) …` | `g.cost += cost; if (f.grp) …` (뒤는 그대로) |
  | 312 | `s.out += t.out; s.think += t.think; s.cacheRead += t.cr; s.cacheWrite += t.cw;` | 네 개 모두 `g.` |
  | 313 | `s.tok.in += …` (여섯 개) | 여섯 개 모두 `g.tok.` |
  | 314 | `s.modelCalls[m.model] = (s.modelCalls[m.model] \|\| 0) + 1;` | `g.modelCalls[…] = (g.modelCalls[…] \|\| 0) + 1;` |
  | 315 | `s.saved += …` | `g.saved += …` |
  | 318 | `if (f.isSub) { s.subCalls++; s.subActive = ts; } else { s.calls++; }` | `if (f.isSub) { s.subCalls++; s.subActive = ts; g.calls++; } else { s.calls++; }` |
  | 319 | `if (t.cw1h > 0) s.ttlMin = 60; else if (…) s.ttlMin = 5;` | 앞에 `if (!f.isSub) ` 가드를 붙인다. B-3에서 다시 만진다 |
  | 341 | `if (!FREE_CAUSES.has(cause)) s.breakCost += extra;` | `g.breakCost` |
  | 342 | `const bc = s.byCause[cause] = s.byCause[cause] \|\| { n: 0, rewrite: 0, extra: 0, sub: { … } };` | `const bc = g.byCause[cause] = g.byCause[cause] \|\| { n: 0, rewrite: 0, extra: 0 };` (`sub` 소집계 삭제) |
  | 344 | `if (f.isSub) { bc.sub.n++; … }` | 줄 삭제 |
  | 345 | `if (!FREE_CAUSES.has(cause) && !f.isSub) { brokeNow = true; s.lastAvoidableBreakTs = ts; }` | 그대로 (캐릭터는 메인 깨짐에만 반응) |
  | 346 | `s.breaks.push({ ts, a: activeAt(s, f, ts), … sub: f.isSub, …` | `g.breaks.push({ ts, a: activeAt(g, f, ts), … sub: f.isSub, …` |
  | 349 | `if (s.breaks.length > 60) s.breaks.shift();` | `g.breaks` 둘 다 |
  | 353 `if (!f.isSub) {` 블록 | — | 블록 앞에 아래 `if (f.isSub) { … } else` 를 붙여 기존 블록이 `else` 가지가 되게 한다 |

  ```js
  if (f.isSub) {
    g.model = m.model; g.effort = d.effort || ''; g.ctx = total; g.lastStop = m.stop_reason || '';
    g.series.push({ t: ts, a: activeAt(g, f, ts), ctx: total, cw: t.cw, cr: t.cr, m: m.model });   // 구성(c) 없음 (D-5)
    if (g.series.length > 4000) g.series.splice(0, g.series.length - 4000);
  } else {
    // 기존 353-375 블록 그대로
  }
  ```

  `case 'attachment'`의 `s.prompts++`(265) · `case 'user'`의 `s.prompts++`(281) · `s.promptMarks` · `activeAt(s, f, ts)`(266 · 281)는 `!f.isSub` 안이므로 `s` 그대로 둔다. `s.commits` · `s.lateCalls` · `s.nightCalls` · `s.streak`도 그대로.

  **(8) `readFile`** (`server.js:382`). 프레임 생성 줄(383)의 객체에 두 필드를 더하고, 생성 직후 메타를 읽는다.

  ```js
  // 프레임 객체에 추가
  agentId: null, meta: null,
  ```

  ```js
  // files.set(fp, f); 다음 줄
  if (f.isSub) f.agentId = path.basename(fp, '.jsonl').replace(/^agent-/, '');
  ```

  `let st; try { st = fs.statSync(fp); } catch { return; }` 앞에 넣는다(잘림 감지보다 앞, 매 호출).

  ```js
  if (f.isSub && !f.meta) {                                  // D-7: 없으면 다음 읽기에서 다시 시도
    try { f.meta = JSON.parse(fs.readFileSync(fp.replace(/\.jsonl$/, '.meta.json'), 'utf8')); } catch { }
    if (f.meta && f.sessionId) { const s = sessions.get(f.sessionId); const x = s && s.subs.get(f.agentId); if (x && !x.named) nameSub(x, f.meta); }
  }
  ```

  잘림 감지 분기(386)에는 아무것도 더하지 않는다. `meta` · `agentId`는 파일이 다시 써져도 유지한다.

  **(9) `charState`** (`server.js:403`).

  ```js
  const busy = (s.lastStop === 'tool_use' && now - s.lastTs < 3 * 60e3) || now - s.subActive < 3 * 60e3;
  ```

  **(10) `snapshot`** (`server.js:415`). 세션 객체의 `busy: …, subActive: …` 줄(437) 다음에 두 필드를 더한다. `map` 콜백 앞부분(`const p = price(s.model);` 옆)에서 `subs`를 먼저 만든다.

  ```js
  const subs = [...s.subs.values()].sort((a, b) => a.firstTs - b.firstTs).map(x => ({
    id: x.id, name: x.name || x.id, agentType: x.agentType, depth: x.depth,
    model: x.model, effort: x.effort, firstTs: x.firstTs, lastTs: x.lastTs, lastStop: x.lastStop, lastTool: x.lastTool,
    ctx: x.ctx, ttlMin: x.ttlMin, calls: x.calls, out: x.out, think: x.think, cacheRead: x.cacheRead, cacheWrite: x.cacheWrite,
    cost: x.cost, compacts: x.compacts, breakCost: x.breakCost, tok: x.tok, activeMs: x.activeMs, byCause: x.byCause,
    busy: now - x.lastTs < 3 * 60e3,
  }));
  const subTotal = subs.reduce((t, x) => ({ n: t.n + 1, cost: t.cost + x.cost, activeMs: t.activeMs + x.activeMs, breakCost: t.breakCost + x.breakCost }), { n: 0, cost: 0, activeMs: 0, breakCost: 0 });
  ```

  ```js
  // 세션 객체에 추가
  subs, subTotal,
  ```

  **(11) `detail`** (`server.js:441`) · 라우트(472).

  ```js
  function detail(id, agent) {
    const s = sessions.get(id); if (!s) return null;
    const g = agent ? s.subs.get(agent) : s; if (!g) return null;
    const pts = g.series; const step = Math.max(1, Math.ceil(pts.length / 600));
    const series = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
    return { id, agent: agent || null, series, breaks: g.breaks.slice(-40), prompts: agent ? [] : s.promptMarks };
  }
  ```

  ```js
  if (url.pathname === '/api/detail') { const d = detail(url.searchParams.get('id'), url.searchParams.get('agent') || null); … }   // 뒤는 그대로
  ```

  **(12) `test/helper.js`.** `runFixture` 아래에 추가하고 `module.exports`에 넣는다.

  ```js
  // name: test/fixtures/ 아래 디렉터리 이름. 반환: { s, snap, sessions, files }. 세션은 하나라고 본다.
  function runFixtureDir(name) {
    const { snapshot, sessions, files } = replay(path.join(__dirname, 'fixtures', name));
    const s = [...sessions.values()][0];
    return { s, snap: snapshot, sessions, files };
  }
  ```

  **(13) 픽스처 `test/fixtures/sub-split/`.** 세 파일 모두 `sessionId: "s-sub-split"`. 모든 줄에 서로 다른 최상위 `uuid` · `timestamp`. `assistant` 줄은 `requestId`(아래 표의 것) · `effort: "high"` · `message.model: "claude-sonnet-5"` · `usage.input_tokens: 2` · `usage.output_tokens: 10`. `usage.cache_creation`은 표의 1h/5m 값으로, `cache_creation_input_tokens`는 그 합으로 넣는다. 서브 파일의 모든 줄에 `isSidechain: true` · `agentId`(파일명의 id).

  `main.jsonl`

  | # | type | 시각 | 내용 |
  |---|---|---|---|
  | 1 | user | 00:00:00 | `content: "prompt-body-one"` |
  | 2 | assistant | 00:00:10 | `requestId: "r1"`, cw 1h **100** / 5m 0, `cr: 0`, `content: [{type:"tool_use", id:"rd1", name:"Read", input:{}}]`, `stop_reason: "tool_use"` |
  | 3 | user | 00:00:20 | `content: [{type:"tool_result", tool_use_id:"rd1", content:"ok"}]` |
  | 4 | assistant | 00:00:30 | `requestId: "r2"`, cw 1h **50** / 5m 0, `cr: 100`, `content: [{type:"text",text:"x"}]`, `stop_reason: "end_turn"` |

  `subagents/agent-x1.jsonl` (`agentId: "x1"`)

  | # | type | 시각 | 내용 |
  |---|---|---|---|
  | 1 | user | 00:01:00 | `content: "sub-prompt-body"` (프롬프트로 세지 않아야 함) |
  | 2 | assistant | 00:01:10 | `requestId: "rs1"`, cw 1h 0 / 5m **5000**, `cr: 0`, `content: [{type:"tool_use", id:"b1", name:"Bash", input:{}}]`, `stop_reason: "tool_use"` |
  | 3 | user | 00:01:20 | `content: [{type:"tool_result", tool_use_id:"b1", content:"ok"}]` |
  | 4 | assistant | 00:01:30 | `requestId: "rs2"`, cw 1h 0 / 5m **4000**, `cr: 5000`, `content: [{type:"tool_use", id:"b2", name:"Bash", input:{}}]`, `stop_reason: "tool_use"` |
  | 5 | user | 00:11:30 | `content: [{type:"tool_result", tool_use_id:"b2", content:"ok"}]` (10분 뒤) |
  | 6 | assistant | 00:11:40 | `requestId: "rs3"`, cw 1h 0 / 5m **9000**, `cr: 0`, `content: [{type:"text",text:"x"}]`, `stop_reason: "end_turn"` |

  `subagents/agent-x2.jsonl` (`agentId: "x2"`, meta 파일 없음)

  | # | type | 시각 | 내용 |
  |---|---|---|---|
  | 1 | user | 00:02:00 | `content: "sub-prompt-body"` |
  | 2 | assistant | 00:02:10 | `requestId: "rs21"`, cw 1h 0 / 5m **300**, `cr: 0`, `content: [{type:"text",text:"x"}]`, `stop_reason: "end_turn"` |

  `subagents/agent-x1.meta.json`

  ```json
  {"agentType":"general-purpose","description":"fixture sub one","toolUseId":"tu-x1","spawnDepth":1}
  ```

  시각은 모두 `2026-09-06T` 날짜의 UTC. 기대값: 메인 `activeMs` 20000(r1 10000 + r2 10000), x1 `activeMs` 30000(rs1 · rs2 · rs3 각 10000 — 10분 도구 대기는 빠짐), x2 `activeMs` 10000. x1의 4번 호출은 직전 프리픽스 5000을 전부 읽으므로(`rewrite` 0) 깨짐이 아니고, 6번 호출은 직전 프리픽스 9000을 다시 써서(`rewrite` 9000 > 2000, `shrink` 5000, 차 4000 > 3000이라 브레이크포인트 이동 아님) 깨짐 1건이 난다. 원인은 B-3에서 단언한다. 지금 코드로 메인을 먼저 읽으면 이 건이 `unexplained`다.

  **(14) `test/subagent-split.test.js`.** `require('./helper.js')`의 `runFixture` · `runFixtureDir`, `require('../server.js')`의 `replay` · `detail`. `path`로 세 파일의 절대경로를 만든다.

  ```js
  const DIR = path.join(__dirname, 'fixtures', 'sub-split');
  const MAIN = path.join(DIR, 'main.jsonl'), X1 = path.join(DIR, 'subagents', 'agent-x1.jsonl'), X2 = path.join(DIR, 'subagents', 'agent-x2.jsonl');

  test('sub-split: 서브 파일을 함께 읽어도 메인의 cost·activeMs·calls·prompts는 메인만 읽었을 때와 같다 (SC-1)', …)
    // const alone = replay(MAIN).snapshot.sessions[0];  const both = runFixtureDir('sub-split').snap.sessions[0];
    // both.cost === alone.cost · both.activeMs === alone.activeMs (=== 20000) · both.calls === alone.calls (=== 2) · both.prompts === 1
  test('sub-split: 서브 슬롯이 둘이고 각자 활성·비용을 갖는다 (SC-1)', …)
    // s.subCalls === 4 · snap 세션의 subs.length === 2 · subs[0].id === 'x1' (firstTs 순) · subs[0].activeMs === 30000 · subs[1].activeMs === 10000
    // subs[0].calls === 3 · subs[1].calls === 1 · subs[0].cost > 0 · subTotal.cost === subs[0].cost + subs[1].cost · subTotal.activeMs === 40000
  test('sub-split: 폴더 합계 활성시간에 서브 몫이 들어간다 (D-2)', …)
    // snap.folder.activeMs === 60000
  test('sub-split: 서브 이름은 meta의 description, meta가 없으면 id (SC-2)', …)
    // subs[0].name === 'fixture sub one' · subs[0].agentType === 'general-purpose' · subs[0].depth === 1 · subs[1].name === 'x2'
  test('sub-split: 서브 깨짐은 서브 슬롯에만 쌓인다 (SC-1)', …)
    // 세션 s.breaks.length === 0 · s.breakCost === 0 · subs[0].breakCost > 0 · Object.values(subs[0].byCause).reduce((n, v) => n + v.n, 0) === 1
  test('sub-split: detail에 agent를 주면 그 서브의 시리즈가 오고 프롬프트 마커는 비어 있다 (SC-1)', …)
    // const d = detail(id, 'x1');  d.agent === 'x1' · d.series.length === 3 · d.series[2].a === 30000 · d.breaks.length === 1 · d.prompts.length === 0
    // detail(id).series.length === 2 · detail(id).series[1].a === 20000 · detail(id, 'nope') === null
  test('sub-split: 시리즈 x축은 서브에서도 단조다 (scope §4)', …)
    // d.series 의 a 가 i 순으로 감소하지 않는다
  ```

- 순서: 1) `session()` 필드 → 2) `subSlot` · `nameSub` · `targetOf` → 3) `activeAt` · `flushGroup` · `trackActive` · `folderTotals` → 4) `handleRecord` 표 → 5) `readFile` → 6) `charState` → 7) `snapshot` · `detail` · 라우트 → 8) `helper` → 9) 픽스처 → 10) 테스트
- 검증
  ```
  node --test test/subagent-split.test.js test/active-time.test.js test/context-axis.test.js test/break-core.test.js test/bridge-cause.test.js
  ```
  새 7건 통과 + 기존 12건 그대로 통과면 끝. 표본 대조: `node server.js --dir data/fishing --port <빈 포트>` 띄우고 `curl -s localhost:<포트>/api/state`에서 `1904d418` 세션의 `cost`가 `13.2` 부근, `activeMs`가 24분(≈1,446,000) 부근, `subTotal`이 `$40.4` · 1.5시간 부근, `cost + subTotal.cost`가 `53.62`, `subs`가 6개이고 각 `name`이 `Audit issues batch …`로 시작하면 맞다. 서브 2개짜리 세션(`data/fishing/*/subagents`에 파일 둘인 폴더) 하나를 골라 `subs.length === 2`도 본다. `node --test`가 통과했더라도 `data/`가 없는 환경이면 표본 대조는 건너뛰고 do.md에 그렇게 적는다.
- 덮는 SC: SC-1 · SC-2 · SC-7(서버 쪽)

---

### B-3 캐시 만료 판정을 호출 단위로

- 목표: 만료 판정이 직전 호출이 캐시를 쓴 TTL을 본다. 메인 1h · 서브 5m 픽스처를 어느 순서로 읽어도 서브 깨짐이 `ttl_expiry`이고 `s.ttlMin`은 60이다.
- 파일
  - 수정 `server.js` — `case 'assistant'`의 TTL 갱신 · 만료 조건 · `f.prev`
  - 수정 `test/subagent-split.test.js` — 순서 무관 테스트 추가
- 인터페이스

  **(1) TTL 갱신** (B-2에서 가드를 붙인 319 줄). 그 줄을 아래 두 줄로 교체한다.

  ```js
  const ttlNow = t.cw1h > 0 ? 60 : t.cw5m > 0 ? 5 : (f.prev ? f.prev.ttlMin : s.ttlMin);   // D-6: 이 호출이 캐시에 쓴 TTL. 안 썼으면 직전을 잇는다
  if (!f.isSub) { if (t.cw1h > 0) s.ttlMin = 60; else if (t.cw5m > 0 && t.cw1h === 0 && s.calls <= 1) s.ttlMin = 5; } else g.ttlMin = ttlNow;
  ```

  `f.prev`를 `const prev = f.prev`로 잡는 줄(320)은 이 뒤에 있으므로 `ttlNow` 계산에서 `f.prev`를 직접 읽어도 같은 값이다.

  **(2) 만료 조건** (333).

  ```js
  else if (gapMin > (prev.ttlMin === 60 ? 60 : 5)) cause = 'ttl_expiry';
  ```

  **(3) `f.prev`** (352).

  ```js
  f.prev = { total, in: t.in, cr: t.cr, model: m.model, ts, effort: d.effort, ttlMin: ttlNow };
  ```

  **(4) 테스트 추가** (`test/subagent-split.test.js`).

  ```js
  test('sub-split: 메인→서브, 서브→메인 어느 순서로 읽어도 서브 깨짐은 ttl_expiry이고 s.ttlMin은 60 (SC-5)', …)
    // for (const order of [[MAIN, X1, X2], [X1, X2, MAIN]]) {
    //   const { snapshot } = replay(order); const s = snapshot.sessions[0];
    //   s.ttlMin === 60 · s.subs[0].ttlMin === 5 · s.subs[0].byCause.ttl_expiry.n === 1 · s.byCause.ttl_expiry === undefined
    // }
  test('sub-split: 서브 깨짐 레코드의 gapMin이 5분을 넘고 60분을 안 넘는다 (SC-5)', …)
    // const b = detail(id, 'x1').breaks[0];  b.cause === 'ttl_expiry' · b.gapMin > 5 · b.gapMin < 60 · b.rewrite === 9000 · b.cw5m === 9000 · b.cw1h === 0
  ```

- 순서: 1) TTL 갱신 → 2) 만료 조건 → 3) `f.prev` → 4) 테스트
- 검증
  ```
  node --test test/subagent-split.test.js test/break-core.test.js test/shift-cause.test.js test/resume-cause.test.js test/bridge-cause.test.js test/breaks-cap.test.js
  ```
  새 2건 통과 + 기존 원인 테스트 전부 그대로 통과면 끝. 표본 대조: `/api/state`의 `1904d418` 세션에서 `byCause`가 빈 객체이고, `subs[*].byCause.ttl_expiry.n`의 합이 **6**, `ttlMin`이 60. `#5`가 지목한 `5f111656` 세션도 띄워 `byCause.unexplained`가 줄었는지 본다(줄지 않으면 그 사실만 do.md에 적는다 — 그 건은 이슈의 판단 재료이지 이 사이클의 기준이 아니다).
- 덮는 SC: SC-5

---

### B-4 화면 — 서브 줄 · 서브 목록 · 대상별 카드

- 목표: 세션 목록에 서브 줄이 붙고, 고르면 TTL 자리에 서브 목록이 서고, 서브 하나를 고르면 Context · Cost · 그래프 · 깨짐 표 · 습관 표 · State가 그 서브의 값으로 바뀐다. 세션 줄 시간 칸이 활성 시간이다.
- 파일
  - 수정 `index.html` — CSS · 선택 상태 · `renderList` · `loadDetail` · `renderMain` · `ttlCard` `subListCard` `stateChips` 분리 · `fuelCells` · `habitsCard` · `drawChart` · `tick` · `openAdvice` · 리사이즈 핸들러
- 인터페이스

  **(1) CSS.** `.sess.sel` 줄(44) 아래에 추가한다.

  ```css
  .sess.sub { padding:6px 16px 8px 34px; border-top:0; }
  .sess.sub.sel { padding-left:31px; }
  .sess.sub .t { font-weight:500; font-size:12px; color:var(--dim); }
  .sess.sel + .sess.sub, .sess.sub.sel { }   /* 비워 둔다. 육안 확인에서 사용자 값이 오면 여기서 잡는다 */
  .subrows { flex:1; overflow:auto; display:flex; flex-direction:column; gap:2px; min-height:0; scrollbar-width:none; }
  .subrow { padding:6px 8px; border-radius:6px; cursor:pointer; }
  .subrow:hover { background:#1b1f28; } .subrow.sel { background:#1f2532; }
  .subrow .t { font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .subrow .m { font:11px var(--mono); color:var(--dim); margin-top:2px; display:flex; gap:8px; }
  ```

  **(2) 선택 상태** (173). `selected`를 없애고 `sel`을 둔다. 파일 안의 `selected` 참조는 전부 아래 헬퍼로 바꾼다(`grep -n selected index.html`이 0건이 되어야 한다).

  ```js
  let state = null, sel = { id: null, agent: null }, detailCache = {}, clockSkew = 0;
  const detailKey = () => sel.id + '|' + (sel.agent || '');
  function curSession() { return state ? state.sessions.find(x => x.id === sel.id) : null; }
  // 화면이 가리키는 대상. 서브가 골라졌는데 스냅샷에서 사라졌으면 메인으로 되돌린다.
  function curTarget() { const s = curSession(); if (!s) return null; if (!sel.agent) return s; const x = s.subs.find(y => y.id === sel.agent); if (!x) sel.agent = null; return x || s; }
  ```

  `es.onmessage`(180): `if (!sel.id && state.sessions.length) sel.id = state.sessions[0].id;` · `loadDetail(true)`.

  **(3) `renderList`** (187). 세션 줄과 서브 줄. `.ago` 스팬은 없앤다.

  ```js
  $('#list').innerHTML = state.sessions.map(s => `
    <div class="sess ${s.id===sel.id && !sel.agent ? 'sel' : ''}" data-id="${s.id}">
      <div class="t"><span class="dot ${status(s)}"></span>${esc(s.title)}</div>
      <div class="m"><span>${short(s.model)}</span><span>${fmtTok(s.ctx)}</span><span>${usd(s.cost)}</span><span title="활성 시간">${hrs(s.activeMs)}</span></div>
    </div>` + (s.subs.length ? `
    <div class="sess sub ${s.id===sel.id && sel.agent ? 'sel' : ''}" data-id="${s.id}" data-sub="1">
      <div class="t"><span class="dot ${s.subActive ? 'busy' : 'dead'}"></span>서브에이전트 ${s.subTotal.n}</div>
      <div class="m"><span>${usd(s.subTotal.cost)}</span><span title="서브 활성 시간 합">${hrs(s.subTotal.activeMs)}</span></div>
    </div>` : '')).join('');
  document.querySelectorAll('.sess').forEach(el => el.onclick = () => {
    const s = state.sessions.find(x => x.id === el.dataset.id);
    sel = { id: el.dataset.id, agent: el.dataset.sub ? (s.subs.find(y => y.id === sel.agent) ? sel.agent : s.subs[0].id) : null };   // D-4: 서브 줄은 첫 서브. 같은 세션의 서브를 이미 보고 있었으면 유지
    renderList(); loadDetail(true);
  });
  const g = curTarget(), sc = curSession();
  $('#habits').innerHTML = g ? `<h1>캐시를 깨는 나쁜 습관</h1>${habitsCard(g, sc)}` : '';
  ```

  **(4) `loadDetail`** (237). 시그니처 `loadDetail(force)`.

  ```js
  async function loadDetail(force) {
    if (!sel.id) return; const k = detailKey();
    if (force || !detailCache[k]) { const r = await fetch('/api/detail?id=' + encodeURIComponent(sel.id) + (sel.agent ? '&agent=' + encodeURIComponent(sel.agent) : '')); detailCache[k] = await r.json(); }
    renderMain();
  }
  ```

  **(5) `renderMain`** (242). 첫 두 줄을 바꾸고, 첫 칸 · Context · Cost · State를 대상 기준으로 바꾼다. 캐릭터 카드 · 그래프 카드 제목 · 깨짐 표는 그대로.

  ```js
  const s = curSession(), g = curTarget(); if (!s || !g) return;
  const isSub = g !== s;
  const d = detailCache[detailKey()] || { series: [], breaks: [], prompts: [] };
  ```

  - 첫 칸: 기존 `<div class="card ttl">…</div>`(248-255)를 `ttlCard(s)` 함수로 떼어 내고, 자리에는 `${isSub ? subListCard(s) : ttlCard(s)}`.
  - Context 카드: `s.ctx` `s.cacheRead` `s.cacheWrite` `s.compacts` → `g.`; `ctxNote(g)` `ctxBarSegs(g)` `ctxLegend(g)` `adviceLine(g)`. 서브는 `comp` · `advice`가 없어 단색 바 · 범례 없음 · 조언 줄 없음이 된다(D-5).
  - Cost 카드 `cost-left`(272-276):
    ```js
    <div class="cost-k"><span>${isSub ? '이 서브' : '이 세션'}</span><div class="big">${usd(g.cost)}</div></div>
    <div class="vsep"></div>
    ${isSub
      ? `<div class="cost-k" title="이 세션의 서브에이전트 ${s.subTotal.n}개 합"><span>서브 소계</span><div class="mid">${usd(s.subTotal.cost)}</div></div>`
      : `<div class="cost-k" title="이 폴더의 오늘(KST 05시 경계) 전체 세션 누적"><span>오늘 누적</span><div class="mid">${usd(todayBucket(s).cost)}</div></div>`}
    ```
  - Cost 카드 `cost-right`(278-281): 압축 절약 칸의 `visibility` 조건을 `(!isSub && s.compacts > 0)`로, 캐시 깨짐 손실은 `sumCauses(g.byCause, LOSS_CAUSES).n` · `usd(g.breakCost)`.
  - Cost 카드 발: `fuelCells(g, s)`.
  - State 칩(293-297): `${stateChips(s, g)}`로 교체.
  - 그래프: `drawChart(d.series, d.breaks, d.prompts)` 그대로(서브는 `prompts`가 `[]`).

  **(6) 새 함수 셋.** `charCard` 옆에 둔다.

  ```js
  function ttlCard(s) { return `<div class="card ttl">…기존 248-255 마크업 그대로…</div>`; }

  function subListCard(s) {
    return `<div class="card"><h2>Subagents (${s.subTotal.n})</h2><div class="subrows">`
      + s.subs.map(x => `<div class="subrow ${x.id === sel.agent ? 'sel' : ''}" data-agent="${x.id}" title="${esc(x.agentType)} · depth ${x.depth}">
          <div class="t"><span class="dot ${x.busy ? 'busy' : 'dead'}"></span>${esc(x.name)}</div>
          <div class="m"><span>${fmtTok(x.ctx)}</span><span>${usd(x.cost)}</span><span>${hrs(x.activeMs)}</span></div>
        </div>`).join('')
      + `</div></div>`;
  }

  function stateChips(s, g) {
    const chip = (k, v) => `<span class="chip"><b>${k}</b>${v}</span>`;
    const span = chip('span', `${new Date(g.firstTs).toLocaleString()} → ${new Date(g.lastTs).toLocaleString()}`);
    if (g !== s) return chip('model', short(g.model)) + chip('effort', g.effort || '-') + chip('agent', esc(g.agentType || '-')) + chip('depth', g.depth)
      + chip('last tool', g.lastTool || '-') + chip('stop', g.lastStop || '-') + chip('calls', g.calls) + span;
    return `…기존 294-296의 칩 아홉 개 그대로…` + span;
  }
  ```

  `renderMain` 끝(`drawChart` 앞)에서 서브 목록 클릭을 건다.

  ```js
  document.querySelectorAll('.subrow').forEach(el => el.onclick = () => { sel.agent = el.dataset.agent; renderList(); loadDetail(true); });
  ```

  **(7) `fuelCells(g, s)`** (215). 시그니처를 바꾸고 `rows`를 대상에 따라 만든다. 툴팁 · 척도 · 그리기 코드는 그대로.

  ```js
  const today = todayBucket(s);
  const rows = g !== s
    ? [['이 서브', perHrNum(g.cost, g.activeMs), g.activeMs], ['서브 소계', perHrNum(s.subTotal.cost, s.subTotal.activeMs), s.subTotal.activeMs], ['오늘', …], ['이 기기', …]]
    : [['이 세션', perHrNum(s.cost, s.activeMs), s.activeMs], ['오늘', …], ['이 기기', …]];
  ```

  **(8) `habitsCard(g, s)`** (376). "이 세션" 열 제목을 `g !== s ? '이 서브' : '이 세션'`로, `mine`은 `sumCauses(g.byCause, causes)`. 폴더 전체 `all`은 세션의 `byCause`에 더해 각 서브의 `byCause`도 합친다.

  ```js
  const all = {};
  const add = bc => { for (const [c, v] of Object.entries(bc || {})) { const a = all[c] = all[c] || { n: 0, extra: 0, rewrite: 0 }; a.n += v.n; a.extra += v.extra; a.rewrite += v.rewrite; } };
  for (const x of state.sessions) { add(x.byCause); for (const y of x.subs) add(y.byCause); }
  ```

  **(9) `drawChart`** (466 · 477). 두 곳의 `if (!b.sub)`를 지운다. 넘어오는 `breaks`가 이미 대상 하나의 것이다. `breakTable`의 `(sub)` 표시는 그대로 둔다.

  **(10) `tick`** (491). `const s = state.sessions.find(x => x.id === selected)` → `const s = curSession()`. 마지막 줄 `querySelectorAll('.ago')…`(510)를 지운다. `#ttl`이 없을 때(서브 화면) 이미 `if (!el) return`으로 빠진다.

  **(11) `openAdvice`** (392). `const s = curSession();`. 서브 화면에는 조언 줄이 없으니 열릴 일이 없다.

  **(12) 리사이즈 · 접기 핸들러** (521 · 524). `detailCache[selected]` → `detailCache[detailKey()]`.

- 순서: 1) CSS → 2) 선택 상태 · 헬퍼 → 3) `renderList` → 4) `loadDetail` → 5) `ttlCard` · `subListCard` · `stateChips` 분리 → 6) `renderMain` → 7) `fuelCells` → 8) `habitsCard` → 9) `drawChart` → 10) `tick` · `openAdvice` · 핸들러 → 11) `grep -n selected index.html` 0건 확인
- 검증

  ```
  node -e "require('fs').readFileSync('index.html','utf8')" && grep -c "selected" index.html
  ```
  `grep` 결과 0. 그다음 사용자가 `node server.js --dir data/fishing --port <빈 포트>`로 띄운 대시보드에서 육안 확인:

  1. `1904d418` 세션 아래에만 "서브에이전트 6" 줄이 붙고 `$40.4` · `1.5h` 부근. 서브 없는 세션에는 줄이 없다. 세션 줄 시간 칸이 `24m`.
  2. 서브 줄을 누르면 첫 칸이 서브 목록(이름 6개)으로 바뀌고 첫 서브가 강조된다. Context가 그 서브의 ctx(17만~26만), Cost가 "이 서브" `$5~9` · "서브 소계" `$40.4`, 연비 4줄, 그래프가 그 서브의 선, 깨짐 표에 `ttl_expiry (sub)` 1건, 습관 표 제목 "이 서브".
  3. 목록에서 다른 서브를 누르면 위 값이 그 서브로 바뀐다.
  4. 세션 줄을 다시 누르면 TTL 링(60m)이 돌아오고 Cost가 "이 세션" `$13.2` · "오늘 누적".
  5. 창을 좁혀(1280px 아래) 2×2 접힘에서 서브 목록 카드가 TTL 자리와 같은 칸에 있다.
  6. 서브 두 개짜리 세션 하나에서 1~4를 다시 본다.

  1~6이 사용자 눈으로 맞으면 끝. 픽셀이 어긋나면 사용자가 준 숫자로 CSS를 고치고 다시 본다.
- 덮는 SC: SC-3 · SC-6 · SC-7(육안 — 서브가 도는 실세션이 있을 때)
