'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runFixture } = require('./helper.js');

test('compact-gain: compactMs는 두 압축의 durationMs 합', () => {
  const { snap } = runFixture('compact-gain');
  const s = snap.sessions[0];
  assert.equal(s.compactMs, 180000 + 120000);
});

test('compact-gain: compactSaved는 0보다 크다', () => {
  const { snap } = runFixture('compact-gain');
  const s = snap.sessions[0];
  assert.ok(s.compactSaved > 0);
});

test('compact-gain: compactDrift는 false (누적값과 회차합이 일치)', () => {
  const { snap } = runFixture('compact-gain');
  const s = snap.sessions[0];
  assert.equal(s.compactDrift, false);
});

test('compact-gain: 압축이 없는 기존 픽스처는 compactSaved·compactMs가 0', () => {
  const { snap } = runFixture('prompt-marks');
  const s = snap.sessions[0];
  assert.equal(s.compactSaved, 0);
  assert.equal(s.compactMs, 0);
});
