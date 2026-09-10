'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runFixture } = require('./helper.js');
const { detail } = require('../server.js');

test('noise-prompts: 알림·IDE 블록만 있는 레코드는 프롬프트가 아니고 사람 글이 붙은 레코드는 프롬프트다 (SC-4)', () => {
  const { snap, f } = runFixture('noise-prompts');
  const s = snap.sessions[0];
  assert.equal(s.prompts, 2);
  const d = detail(s.id);
  assert.equal(d.prompts.length, 2);
  assert.equal(d.prompts[1].t, Date.parse('2026-09-05T00:00:20.000Z'));
});

test('noise-prompts: 잡음 블록 글자 수는 user가 아니라 reminders 층에 간다 (SC-4)', () => {
  const { f } = runFixture('noise-prompts');
  assert.equal(f.comp.user, 30);
  assert.equal(f.comp.reminders, 128);
});
