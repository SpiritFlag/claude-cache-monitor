#!/usr/bin/env node
// usage: node scripts/diag-breaks.js --dir <경로> [--top 20]
'use strict';
const path = require('path');
const { replay } = require('../server.js');

const args = process.argv.slice(2);
const argv = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DIR = path.resolve(argv('--dir', '.'));
const TOP = parseInt(argv('--top', '20'), 10);

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
function printTable(label, table) {
  console.log('\n' + label);
  for (const [cause, v] of Object.entries(table).sort((a, b) => b[1].extra - a[1].extra)) {
    console.log(`  ${cause.padEnd(18)} n=${String(v.n).padEnd(5)} rewrite=${String(v.rewrite).padEnd(10)} extra=$${v.extra.toFixed(4)}`);
  }
}

function main() {
  const { sessions } = replay(DIR);
  const all = [];
  for (const s of sessions.values()) for (const b of s.breaks) all.push({ ...b, sessionId: s.id });

  printTable('메인 세션', tableFromByCause(sessions, 'main'));
  printTable('서브에이전트', tableFromByCause(sessions, 'sub'));

  console.log(`\n최근 ${TOP}건`);
  const recent = [...all].sort((a, b) => b.ts - a.ts).slice(0, TOP);
  for (const b of recent) {
    console.log(`  ${new Date(b.ts).toISOString()} ${b.sessionId} ${b.cause.padEnd(18)} rewrite=${b.rewrite} shrink=${b.shrink} grew=${b.grew} prefixIntact=${b.prefixIntact} events=${JSON.stringify(b.events)}`);
  }
}

if (require.main === module) { main(); }
module.exports = { tableFromByCause };
