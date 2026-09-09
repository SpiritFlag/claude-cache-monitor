'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runFixture } = require('./helper.js');
const { detail } = require('../server.js');

test('ask-answer: AskUserQuestion 답변은 프롬프트로 세고 일반 tool_result는 세지 않는다 (SC-3)', () => {
  const { snap } = runFixture('ask-answer');
  const s = snap.sessions[0];
  assert.equal(s.prompts, 2);
  assert.equal(detail(s.id).prompts.length, 2);
});

test('ask-answer: 답변을 받으면 pendingAsk가 풀린다 (SC-3)', () => {
  const { s } = runFixture('ask-answer');
  assert.equal(s.pendingAsk, false);
});

test('queued-human: origin.kind human + commandMode prompt만 프롬프트로 센다 (SC-4)', () => {
  const { snap } = runFixture('queued-human');
  const s = snap.sessions[0];
  assert.equal(s.prompts, 2);
  assert.equal(detail(s.id).prompts.length, 2);
});

test('queued-human: 끼어들기 본문 길이가 컨텍스트 구성 user 층에 잡힌다 (SC-4)', () => {
  const { f } = runFixture('queued-human');
  assert.equal(f.comp.user, 32);
});
