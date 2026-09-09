'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { replay } = require('../server.js');
const { tableFromByCause } = require('../scripts/diag-breaks.js');

test('breaks-cap: byCause는 60건 상한을 넘겨 집계하지만 breaks 배열은 60에서 잘린다', () => {
  const { sessions } = replay(path.join(__dirname, 'fixtures', 'breaks-over60.jsonl'));
  const s = [...sessions.values()][0];
  const byCauseTotal = Object.values(s.byCause).reduce((a, v) => a + v.n, 0);

  assert.ok(byCauseTotal > 60);
  assert.equal(s.breaks.length, 60);

  const main = tableFromByCause(sessions, 'main');
  const sub = tableFromByCause(sessions, 'sub');
  const tableTotal = Object.values(main).reduce((a, v) => a + v.n, 0) + Object.values(sub).reduce((a, v) => a + v.n, 0);
  assert.equal(tableTotal, byCauseTotal);
});
