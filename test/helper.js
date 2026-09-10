'use strict';
const path = require('path');
const { replay } = require('../server.js');
// name: 확장자 없는 픽스처 이름. 반환: { s, f, breaks, byCause, snap }
function runFixture(name) {
  const fp = path.join(__dirname, 'fixtures', name + '.jsonl');
  const { snapshot, sessions, files } = replay(fp);
  const s = [...sessions.values()][0];
  return { s, f: files.get(fp), breaks: s ? s.breaks : [], byCause: s ? s.byCause : {}, snap: snapshot };
}
// name: test/fixtures/ 아래 디렉터리 이름. 반환: { s, snap, sessions, files }. 세션은 하나라고 본다.
function runFixtureDir(name) {
  const { snapshot, sessions, files } = replay(path.join(__dirname, 'fixtures', name));
  const s = [...sessions.values()][0];
  return { s, snap: snapshot, sessions, files };
}
module.exports = { runFixture, runFixtureDir };
