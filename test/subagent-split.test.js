'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { runFixture, runFixtureDir } = require('./helper.js');
const { replay, detail } = require('../server.js');

const DIR = path.join(__dirname, 'fixtures', 'sub-split');
const MAIN = path.join(DIR, 'main.jsonl'), X1 = path.join(DIR, 'subagents', 'agent-x1.jsonl'), X2 = path.join(DIR, 'subagents', 'agent-x2.jsonl');

test('sub-split: 서브 파일을 함께 읽어도 메인의 cost·activeMs·calls·prompts는 메인만 읽었을 때와 같다 (SC-1)', () => {
  const alone = replay(MAIN).snapshot.sessions[0];
  const both = runFixtureDir('sub-split').snap.sessions[0];
  assert.equal(both.cost, alone.cost);
  assert.equal(both.activeMs, alone.activeMs);
  assert.equal(both.activeMs, 20000);
  assert.equal(both.calls, alone.calls);
  assert.equal(both.prompts, 1);
});

test('sub-split: 서브 슬롯이 둘이고 각자 활성·비용을 갖는다 (SC-1)', () => {
  const { s, snap } = runFixtureDir('sub-split');
  const sess = snap.sessions[0];
  assert.equal(s.subCalls, 4);
  assert.equal(sess.subs.length, 2);
  assert.equal(sess.subs[0].id, 'x1');
  assert.equal(sess.subs[0].activeMs, 30000);
  assert.equal(sess.subs[1].activeMs, 10000);
  assert.equal(sess.subs[0].calls, 3);
  assert.equal(sess.subs[1].calls, 1);
  assert.ok(sess.subs[0].cost > 0);
  assert.equal(sess.subTotal.cost, sess.subs[0].cost + sess.subs[1].cost);
  assert.equal(sess.subTotal.activeMs, 40000);
});

test('sub-split: 폴더 합계 활성시간에 서브 몫이 들어간다 (D-2)', () => {
  const { snap } = runFixtureDir('sub-split');
  assert.equal(snap.folder.activeMs, 60000);
});

test('sub-split: 서브 이름은 meta의 description, meta가 없으면 id (SC-2)', () => {
  const { snap } = runFixtureDir('sub-split');
  const subs = snap.sessions[0].subs;
  assert.equal(subs[0].name, 'fixture sub one');
  assert.equal(subs[0].agentType, 'general-purpose');
  assert.equal(subs[0].depth, 1);
  assert.equal(subs[1].name, 'x2');
});

test('sub-split: 서브 깨짐은 서브 슬롯에만 쌓인다 (SC-1)', () => {
  const { s, snap } = runFixtureDir('sub-split');
  assert.equal(s.breaks.length, 0);
  assert.equal(s.breakCost, 0);
  const subs = snap.sessions[0].subs;
  assert.ok(subs[0].breakCost > 0);
  assert.equal(Object.values(subs[0].byCause).reduce((n, v) => n + v.n, 0), 1);
});

test('sub-split: detail에 agent를 주면 그 서브의 시리즈가 오고 프롬프트 마커는 비어 있다 (SC-1)', () => {
  const { s } = runFixtureDir('sub-split');
  const d = detail(s.id, 'x1');
  assert.equal(d.agent, 'x1');
  assert.equal(d.series.length, 3);
  assert.equal(d.series[2].a, 30000);
  assert.equal(d.breaks.length, 1);
  assert.equal(d.prompts.length, 0);

  const main = detail(s.id);
  assert.equal(main.series.length, 2);
  assert.equal(main.series[1].a, 20000);
  assert.equal(detail(s.id, 'nope'), null);
});

test('sub-split: 시리즈 x축은 서브에서도 단조다 (scope §4)', () => {
  const { s } = runFixtureDir('sub-split');
  const d = detail(s.id, 'x1');
  for (let i = 1; i < d.series.length; i++) assert.ok(d.series[i].a >= d.series[i - 1].a);
});

test('sub-split: 메인→서브, 서브→메인 어느 순서로 읽어도 서브 깨짐은 ttl_expiry이고 s.ttlMin은 60 (SC-5)', () => {
  for (const order of [[MAIN, X1, X2], [X1, X2, MAIN]]) {
    const { snapshot } = replay(order);
    const s = snapshot.sessions[0];
    assert.equal(s.ttlMin, 60);
    assert.equal(s.subs[0].ttlMin, 5);
    assert.equal(s.subs[0].byCause.ttl_expiry.n, 1);
    assert.equal(s.byCause.ttl_expiry, undefined);
  }
});

test('sub-split: 서브 깨짐 레코드의 gapMin이 5분을 넘고 60분을 안 넘는다 (SC-5)', () => {
  const { s } = runFixtureDir('sub-split');
  const b = detail(s.id, 'x1').breaks[0];
  assert.equal(b.cause, 'ttl_expiry');
  assert.ok(b.gapMin > 5);
  assert.ok(b.gapMin < 60);
  assert.equal(b.rewrite, 9000);
  assert.equal(b.cw5m, 9000);
  assert.equal(b.cw1h, 0);
});
