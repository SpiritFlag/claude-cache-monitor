'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runFixture } = require('./helper.js');

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
