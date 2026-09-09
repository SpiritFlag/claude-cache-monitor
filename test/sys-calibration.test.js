'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runFixture } = require('./helper.js');

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
