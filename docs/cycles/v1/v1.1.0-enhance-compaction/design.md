# v1.1.0 enhance-compaction — design

| 사이클 | 버전 | 상태 | 작성 | 갱신 |
|---|---|---|---|---|
| enhance-compaction | v1.1.0 | 확정 | 2026-09-09 | 2026-09-09 |

## 0. 공통

- 의존성을 추가하지 않는다. `package.json`이 없고 런타임·테스트 모두 Node 내장 모듈만 쓴다.
- 주석과 화면 문구는 기존 한국어 톤을 따른다. 화면 문구는 캐릭터 말투("걸렸어요")를 쓰고 코드 주석은 평서체를 쓴다.
- 수치를 확인할 때 로그를 `grep`으로 직접 집계하지 않는다. `subagents/` 하위와 재기록 중복 때문에 틀린 값이 나온다. 확인은 `node --test` · `node server.js` + `curl /api/state` · `node scripts/…` 셋 중 하나로만 한다.
- 픽스처에는 실제 경로 · 프롬프트 본문 · 토큰 문자열을 남기지 않는다. 집계에 필요한 수치 필드만 남긴다.
- 배치마다 끝에 그 배치의 검증 명령을 실행하고 결과를 do.md에 적는다.
- 서버를 띄워 확인할 때는 빈 포트를 쓰고 확인이 끝나면 종료한다.

## 1. 배치

### B-1 순이득 걷어내기

- 목표: `advice`에서 순이득·손익분기 계산을 제거하고, 강조를 `컨텍스트 > continueThreshold && 폐기물 ≥ 50%`로 바꾼다.
- 파일
  - 수정 `server.js` — `STRONG_RATIO` 삭제, `continueThresholdOf` 헬퍼 신설, `compactAdvice()` 반환 축소
  - 수정 `index.html` — `adviceLine()` 한 갈래로, `openAdvice()`에서 순이득 줄 삭제, `.advice.dim b` CSS 추가
- 인터페이스
  ```js
  // server.js — const STRONG_RATIO = 3; 줄을 삭제한다.

  // server.js — resolveSys() 아래, COMPACT 상수 근처에 신설
  const continueThresholdOf = s => (s.sysTokens || CAL.sys) + CAL.regrowth;

  // server.js compactAdvice() — 다음 지역변수를 삭제한다:
  //   perCallSave, breakEven, callsPerTurn 은 유지, horizon, saving 삭제
  //   (perCallSave 는 breakEven 계산에만 쓰였으므로 함께 삭제)
  // 반환 객체를 아래로 교체한다:
  return { dead, dupRead: tok(dupRead), staleRead: tok(staleRead), oldResults: tok(oldResults),
    dupN, staleN, oldN, deadPct: total ? dead / total : 0,
    perCallNow, perCallAfter, compactionCost, callsPerTurn, postCtx,
    summaryTokens: COMPACT.summary, rewriteTokens: COMPACT.rewrite, regrowthTokens: COMPACT.regrowth,
    emphasize: total > continueThresholdOf(s) && (total ? dead / total : 0) >= 0.5 };
  // 사라지는 반환 필드: breakEven, horizon, saving, recommend, strong

  // server.js snapshot() — 기존 계산식을 헬퍼 호출로 바꾼다 (값은 동일)
  const continueThreshold = continueThresholdOf(s);
  ```
  ```js
  // index.html — adviceLine() 전체 교체
  function adviceLine(s) {
    const a = s.advice; if (!a) return '';
    return `<div class="advice ${a.emphasize ? 'strong' : 'dim'}"><span>폐기물 <b>${fmtTok(a.dead)}</b> · 컨텍스트의 ${Math.round(100 * a.deadPct)}%</span><button onclick="openAdvice()">상세</button></div>`;
  }
  ```
  ```
  index.html openAdvice() 안에서
    - <li>손익분기 … 순절감 …</li> 한 줄을 통째로 삭제한다.
    - 그 아래 <div class="sub">추천 조건: …</div> 의 문구를 아래로 교체한다:
      강조 조건: 컨텍스트가 이어가기 임계(${fmtTok(s.continueThreshold)})를 넘고 폐기물이 50% 이상일 때.
      압축은 캐시가 살아있을 때 해야 함(만료 후 압축은 그 호출이 전체를 다시 씀).
    - "죽은 무게" · "비용 흐름"의 나머지 <li>는 건드리지 않는다.

  index.html CSS — .advice.dim 규칙 뒤에 한 줄 추가:
    .advice.dim b { color:inherit; }
  ```
- 순서: `server.js` `STRONG_RATIO` 삭제 → `continueThresholdOf` 신설 → `compactAdvice()` 반환 교체 → `snapshot()` 헬퍼 적용 → `index.html` `adviceLine()` → `openAdvice()` → CSS
- 검증
  ```
  node --test test/compact-cost.test.js
  node server.js --dir data/fishing --port 18801 &
  curl -s localhost:18801/api/state | node -e "let b='';process.stdin.on('data',d=>b+=d).on('end',()=>{const a=JSON.parse(b).sessions.map(s=>s.advice).filter(Boolean);const bad=['breakEven','horizon','saving','recommend','strong'].filter(k=>a.some(x=>k in x));console.log('잔존 필드:',bad.length?bad:'없음','| emphasize 있는 세션:',a.filter(x=>'emphasize' in x).length+'/'+a.length);})"
  ```
  `compact-cost.test.js` 3건 통과(이 파일은 `compactionCost` · `summaryTokens` · `rewriteTokens` · `regrowthTokens` · `postCtx`만 단언하므로 그대로 통과해야 한다). curl 출력에서 잔존 필드가 "없음"이고 모든 advice에 `emphasize`가 있으면 끝. 서버를 종료한다.
- 덮는 SC: SC-1, SC-5

### B-2 압축 실측 수집과 누적 이득

- 목표: `compactMetadata`의 네 필드를 받아 세션마다 누적 절약 금액과 누적 소요 시간을 산출한다.
- 파일
  - 수정 `server.js` — `compact_boundary` 처리 확장, 파일 상태 필드 추가, `compactGain()` 신설, `snapshot()` 응답 3필드 추가
  - 신설 `test/fixtures/compact-gain.jsonl` — 압축 2회 세션
  - 신설 `test/compact-gain.test.js` — SC-2 단언
- 인터페이스
  ```js
  // server.js — system/compact_boundary 처리 교체
  if (d.subtype === 'compact_boundary') {
    s.compacts++; f.pending.push('compact');
    const cm = d.compactMetadata;
    if (cm) {
      if (cm.postTokens != null) f.compactPost = cm.postTokens;
      f.compactPre     = cm.preTokens != null ? cm.preTokens : null;
      f.compactDur     = cm.durationMs != null ? cm.durationMs : null;
      f.compactDropped = cm.cumulativeDroppedTokens != null ? cm.cumulativeDroppedTokens : null;
      f.compactTrigger = cm.trigger || null;
    }
  }

  // server.js — 파일 상태 객체의 신설(files.set 하는 곳)과 리셋(truncated/rewritten 분기)
  // 두 군데 모두에 아래 네 키를 compactPost 옆에 같은 값으로 추가한다:
  //   compactPre: null, compactDur: null, compactDropped: null, compactTrigger: null

  // server.js — s.compactions.push(...) 를 아래로 교체 (기존 4키는 그대로 두고 4키를 얹는다)
  if (events.includes('compact')) s.compactions.push({
    at: s.calls, post: total,
    summary: f.compactPost != null ? f.compactPost : null,
    regrowth: null,
    pre: f.compactPre, durationMs: f.compactDur, dropped: f.compactDropped, trigger: f.compactTrigger,
  });
  ```
  ```js
  // server.js — compactAdvice() 아래에 신설
  // 압축 누적 이득. dropped(cumulativeDroppedTokens)는 그 시점까지의 누적이므로
  // 구간마다 그 구간 시작 압축의 dropped를 그대로 쓴다.
  // 주의: c.summary 가 compactMetadata.postTokens 이고, c.post 는 압축 직후 첫 호출의 total 이다.
  //       D-1 검산에는 c.summary 를 쓴다.
  function compactGain(s) {
    const out = { saved: 0, ms: 0, drift: false };
    if (!s.compactions.length) return out;
    const p = price(s.model || 'claude-sonnet-5');
    const rate = p.in * p.read / 1e6;              // 토큰 1개를 캐시에서 한 번 읽는 값
    let sum = 0;
    for (let i = 0; i < s.compactions.length; i++) {
      const c = s.compactions[i], next = s.compactions[i + 1];
      const calls = Math.max(0, (next ? next.at : s.calls) - c.at);
      if (c.dropped != null) out.saved += c.dropped * rate * calls;
      if (c.durationMs != null) out.ms += c.durationMs;
      if (c.pre != null && c.summary != null) sum += c.pre - c.summary;
      if (c.dropped != null && sum > 0 && Math.abs(sum - c.dropped) > 1) out.drift = true;
    }
    for (const cs of s.compactSamples) out.saved -= cs.extra;   // 실비 차감
    if (out.saved < 0) out.saved = 0;
    return out;
  }

  // server.js snapshot() — 세션 map 안에서 호출하고 응답에 세 필드를 얹는다
  const cg = compactGain(s);
  // …반환 객체에 추가:
  compactSaved: cg.saved, compactMs: cg.ms, compactDrift: cg.drift,
  ```
  ```
  test/fixtures/compact-gain.jsonl — 줄 구성 (test/fixtures/compact-meta.jsonl 의 형식을 그대로 따른다)
    1. assistant · 콜드 스타트 (cache_creation 으로 sysTokens 확정)
    2. assistant · 호출 2~3개
    3. system/compact_boundary · compactMetadata:
         { trigger:"manual", preTokens:300000, postTokens:20000, durationMs:180000,
           cumulativeDroppedTokens:280000 }
    4. assistant · 압축 후 호출 5개 (구간 A 를 만든다)
    5. system/compact_boundary · compactMetadata:
         { trigger:"manual", preTokens:250000, postTokens:15000, durationMs:120000,
           cumulativeDroppedTokens:515000 }        // 280000 + (250000-15000) = 515000
    6. assistant · 호출 3개 (구간 B)
    model 은 claude-sonnet-5 로 고정한다.
  ```
  ```js
  // test/compact-gain.test.js — 단언
  // 1) compactMs === 180000 + 120000
  // 2) compactSaved > 0
  // 3) compactDrift === false      (누적값과 회차합이 일치)
  // 4) 압축이 없는 기존 픽스처(예: 'prompt-marks')에서 compactSaved === 0 이고 compactMs === 0
  ```
- 순서: `compact_boundary` 처리 → 파일 상태 두 군데 → `compactions.push` → `compactGain()` → `snapshot()` 응답 → 픽스처 → 테스트
- 검증
  ```
  node --test test/compact-gain.test.js test/compact-cost.test.js
  ```
  신규 4건과 기존 3건이 모두 통과하면 끝.
- 덮는 SC: SC-2, SC-5

### B-3 Cost 카드 — 절약 칸 신설과 손실 건수 출처 교체

- 목표: Cost 카드에 압축 절약 칸을 넣고, 손실 건수를 `byCause` 기준으로 바꾼다.
- 파일
  - 수정 `index.html` — `LOSS_CAUSES` · `dur()` 신설, Cost 카드 마크업 교체, `.cost-k .mid.ok` CSS 추가
- 인터페이스
  ```js
  // index.html — FREE_CAUSES 정의 바로 아래에 신설 (CAUSE_GROUPS 를 쓰므로 그 뒤여야 한다)
  const LOSS_CAUSES = CAUSE_GROUPS.filter(g => !g.free).flatMap(g => g.causes);

  // index.html — 포맷터 근처(fmtTok · usd 옆)에 신설. 기존 fmtMin 은 시각 포맷터라 쓰지 않는다.
  const dur = ms => { const m = Math.round((ms || 0) / 60e3); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; };
  ```
  ```html
  <!-- index.html — do B-3 R-10: cost-mid를 cost-cols(가로 2열)로 나눈다.
       1열(cost-head, 원래 마크업 그대로): 이 세션·오늘 누적 좌우 나란히.
       2열(cost-col2, 고정폭 세로 스택): 압축 절약 위 · 캐시 깨짐 손실 아래.
       각 칸의 소제목(<span>) 옆에 cost-k-h로 건수·소요시간을 붙이고,
       $금액 줄에는 <small>아꼈어요/잃었어요</small>만 남긴다.
       압축 0회 세션도 "압축 절약" cost-k는 계속 렌더링하되 visibility:hidden으로
       감춰 2열 세로 크기가 항상 2칸 분량으로 고정되게 한다(카드 높이 안정).
       (R-4 Q-1 · R-5 는 한 줄 4칸, R-6 은 2행, R-7 은 $금액 아래 .sub 줄, R-8 에서
        건수·소요시간이 소제목 옆으로, R-9 는 1열 center 정렬 시도였으나 R-10 에서
        1열 라벨 정렬이 다시 어긋나 flex-start로 되돌리고 2열 폭을 고정폭으로 바꿨다) -->
  <div class="cost-cols">
    <div class="cost-head">
      <div class="cost-k"><span>이 세션</span><div class="big">${usd(s.cost)}</div></div>
      <div class="vsep"></div>
      <div class="cost-k" title="이 폴더의 오늘(KST 05시 경계) 전체 세션 누적"><span>오늘 누적</span><div class="mid">${usd(todayBucket(s).cost)}</div></div>
    </div>
    <div class="cost-col2">
      <div class="cost-k" style="${s.compacts > 0 ? '' : 'visibility:hidden'}"><div class="cost-k-h"><span>압축 절약</span><small>${s.compacts}건 · ${dur(s.compactMs)} 걸렸어요</small></div><div class="mid ok">${usd(s.compactSaved)} <small>아꼈어요</small></div></div>
      <div class="cost-k"><div class="cost-k-h"><span>캐시 깨짐 손실</span><small>${sumCauses(s.byCause, LOSS_CAUSES).n}건</small></div><div class="mid bad">${usd(s.breakCost)} <small>잃었어요</small></div></div>
    </div>
  </div>
  ```
  ```
  index.html CSS — .cost-k .mid.bad 규칙 옆에 한 줄 추가:
    .cost-k .mid.ok { color:var(--ok); }
  do B-3 R-5: 칸이 좁아져도 내용이 줄바꿈되지 않게 세 규칙을 고친다.
    .cost-k { display:flex; flex-direction:column; gap:6px; flex-shrink:0; }
    .cost-k .mid { font:600 26px/1 var(--mono); color:var(--dim); padding-bottom:2px; white-space:nowrap; }
  do B-3 R-8: 소제목+건수·소요시간 한 줄 스타일 신설.
    .cost-k-h { display:flex; align-items:baseline; gap:8px; }
    .cost-k-h small { font-size:11px; color:var(--dim); font-weight:400; white-space:nowrap; }
  do B-3 R-11: 2열은 grid 트랙으로 고정한다. flex-wrap 이 있으면 카드 폭(1fr 열에서 약 680px)에서
    2열이 아래로 떨어져 "우측 2열"이 성립하지 않는다. minmax(0,1fr) 로 1열이 커져도 2열 트랙 위치가 밀리지 않는다.
    .cost-cols { display:grid; grid-template-columns:minmax(0,1fr) 240px; column-gap:24px; align-items:start; }
    .cost-head { display:flex; align-items:flex-start; gap:18px; }
    .cost-col2 { display:flex; flex-direction:column; gap:12px; }
  ```
- 순서: `LOSS_CAUSES` → `dur()` → CSS → 마크업 교체
- 검증
  ```
  node server.js --dir data/fishing --port 18802 &
  curl -s localhost:18802/api/state | node -e "let b='';process.stdin.on('data',d=>b+=d).on('end',()=>{const FREE=new Set(['compact','breakpoint_shift']);let bad=0,shown=0;for(const s of JSON.parse(b).sessions){let loss=0;for(const [c,v] of Object.entries(s.byCause||{}))if(!FREE.has(c))loss+=v.n;if(s.compacts>0)shown++;if(s.breakCost>0&&loss===0)bad++;}console.log('손실건수 산출 세션:',JSON.parse(b).sessions.length,'| 절약칸 뜨는 세션:',shown,'| 금액>0인데 건수 0인 모순:',bad);})"
  ```
  모순이 0이고 절약칸이 뜨는 세션이 21개면 끝. 서버를 종료한다.
  Cost 카드 네 칸의 눌림 여부는 사용자 육안 판정 항목이므로 do 에서 판정하지 않고 do.md 에 확인 요청으로 남긴다.
- 덮는 SC: SC-2(표시), SC-3

### B-4 byCause 서브 소계와 스크립트 집계

- 목표: `byCause`가 서브에이전트 소계를 함께 들게 하고, 스크립트의 원인별 집계를 절단 없는 소스로 옮긴다.
- 파일
  - 수정 `server.js` — `byCause` 누적에 `sub` 소계 추가
  - 수정 `scripts/diag-breaks.js` — 원인별 집계를 `byCause`에서, 집계 함수 export, CLI 가드
  - 신설 `test/fixtures/breaks-over60.jsonl` — 브레이크 61건 이상 세션
  - 신설 `test/breaks-cap.test.js` — SC-4 단언
- 인터페이스
  ```js
  // server.js — byCause 누적부 교체
  const bc = s.byCause[cause] = s.byCause[cause] || { n: 0, rewrite: 0, extra: 0, sub: { n: 0, rewrite: 0, extra: 0 } };
  bc.n++; bc.rewrite += rewrite; bc.extra += extra;
  if (f.isSub) { bc.sub.n++; bc.sub.rewrite += rewrite; bc.sub.extra += extra; }
  // n · rewrite · extra 의 의미는 그대로(메인+서브 합)라 index.html 의 sumCauses 는 손대지 않는다.
  ```
  ```js
  // scripts/diag-breaks.js — byCauseTable(list) 를 아래로 대체한다.
  // 원인별 건수는 byCause 에서 집계한다. s.breaks 는 60건에서 잘리므로 집계에 쓰지 않는다.
  function tableFromByCause(sessions, which) {          // which: 'main' | 'sub'
    const t = {};
    for (const s of sessions.values()) for (const [cause, v] of Object.entries(s.byCause || {})) {
      const sb = v.sub || { n: 0, rewrite: 0, extra: 0 };
      const n       = which === 'sub' ? sb.n       : v.n - sb.n;
      const rewrite = which === 'sub' ? sb.rewrite : v.rewrite - sb.rewrite;
      const extra   = which === 'sub' ? sb.extra   : v.extra - sb.extra;
      if (!n && !rewrite && !extra) continue;
      const c = t[cause] = t[cause] || { n: 0, rewrite: 0, extra: 0 };
      c.n += n; c.rewrite += rewrite; c.extra += extra;
    }
    return t;
  }
  // printTable(label, list) 는 printTable(label, table) 로 바꿔 위 결과를 그대로 출력한다.
  // 호출부: printTable('메인 세션', tableFromByCause(sessions, 'main'))
  //         printTable('서브에이전트', tableFromByCause(sessions, 'sub'))
  // "최근 N건" 목록은 지금처럼 s.breaks 에서 뽑는다(목록 용도라 절단이 의도된 것이다).

  // scripts/diag-breaks.js — CLI 실행부를 아래 가드로 감싸고 파일 끝에 export 를 둔다.
  if (require.main === module) { /* 기존 실행부 전체 */ }
  module.exports = { tableFromByCause };
  ```
  ```
  test/fixtures/breaks-over60.jsonl — 만드는 법
    기존 픽스처 중 캐시 깨짐이 실제로 발생하는 것(test/fixtures/rewrite-dup.jsonl 등)의
    assistant 줄 구조를 본떠, 같은 원인의 브레이크가 61회 이상 나도록 줄을 반복 생성한다.
    생성에 임시 스크립트를 써도 되지만 커밋하는 것은 결과 jsonl 하나뿐이다.
    타임스탬프는 단조 증가시키고 uuid 는 줄마다 다르게 한다(uuidSeen 중복 제거에 걸리지 않도록).
  ```
  ```js
  // test/breaks-cap.test.js — 단언 (SC-4)
  const { s } = runFixture('breaks-over60');
  const byCauseTotal = Object.values(s.byCause).reduce((a, v) => a + v.n, 0);
  // 1) byCauseTotal > 60                       — 픽스처가 상한을 실제로 넘겼다
  // 2) s.breaks.length === 60                  — 배열은 상한에서 잘려 있다
  // 3) tableFromByCause 로 집계한 n 의 합 === byCauseTotal
  //    (scripts/diag-breaks.js 에서 require 하고, sessions 는 replay 로 얻는다)
  ```
- 순서: `server.js` `byCause` 소계 → `scripts/diag-breaks.js` 집계 교체 + export/가드 → 픽스처 → 테스트
- 검증
  ```
  node --test test/breaks-cap.test.js test/break-core.test.js test/shift-cause.test.js test/resume-cause.test.js
  node scripts/diag-breaks.js --dir data/fishing --top 5
  ```
  신규 테스트가 통과하고 기존 원인 분류 테스트가 깨지지 않으면 끝. 스크립트 출력의 메인/서브 두 표가 이전과 같은 건수를 보이는지 눈으로 확인한다(실데이터는 최대 17건이라 절단이 없어 값이 같아야 한다).
- 덮는 SC: SC-4, SC-5
