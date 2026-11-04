'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const http = require('node:http');
const { createServer } = require('../server.cjs');

const M = { op: 'move' }, P = { op: 'pick' }, C = { op: 'checkout' };
const fixture = () => ({ map: [['S', '딸기', '양말']], shoppingList: ['딸기'] });

async function launch(t, options = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'asv-server-'));
  fs.writeFileSync(path.join(temp, 'index.html'), '<!doctype html><title>ASV</title>');
  fs.mkdirSync(path.join(temp, 'js'));
  fs.writeFileSync(path.join(temp, 'js', 'app.js'), 'window.test = true;');
  let clock = 1_000_000;
  const server = createServer({ staticDir: temp, dbPath: ':memory:', now: () => clock, generateLevel: fixture, ...options });
  server.listen(0, '0.0.0.0');
  await once(server, 'listening');
  let closed = false;
  async function close() {
    if (!closed) { closed = true; await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  }
  t.after(async () => { await close(); fs.rmSync(temp, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(url, body, method) {
    const response = await fetch(base + url, body === undefined ? { method: method || 'GET' } : {
      method: method || 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://temp.sdy.world' }, body: JSON.stringify(body)
    });
    const result = await response.json();
    return { status: response.status, body: result };
  }
  return { server, request, temp, base, close, setTime: value => { clock = value; },
    start: body => request('/api/attempts', body || { level: 1 }),
    finish: (id, program = [C], extra = {}) => request(`/api/attempts/${id}/finish`, { program, ...extra }),
    enter: (id, name) => request(`/api/attempts/${id}/entry`, { name }) };
}

test('server creates a map session and replays the stored map with authoritative score and time', async t => {
  let generationCount = 0;
  const app = await launch(t, { generateLevel: () => { generationCount++; return fixture(); } });
  assert.deepEqual(await app.request('/api/health'), { status: 200, body: { ok: true } });
  assert.equal(app.server.address().address, '0.0.0.0');
  const started = await app.start();
  assert.equal(started.status, 201);
  assert.equal(started.body.level, 1);
  assert.equal(started.body.startedAt, 1_000_000);
  assert.equal(started.body.serverNow, 1_000_000);
  assert.equal(started.body.elapsedBaseMs, 0);
  assert.deepEqual(started.body.map, fixture().map);
  assert.deepEqual(started.body.shoppingList, ['딸기']);
  app.setTime(1_004_321);
  const finished = await app.finish(started.body.id, [M, P, C], { score: 99999, elapsedMs: 1, map: [['S']], checkedOut: false });
  assert.equal(finished.status, 200);
  assert.equal(finished.body.result.total, 50);
  assert.equal(finished.body.result.verdict, 'perfect');
  assert.equal(finished.body.elapsedMs, 4321);
  assert.equal(finished.body.actions, 3);
  assert.equal(finished.body.blocks, 4);
  assert.equal(finished.body.checkedOut, true);
  assert.equal(finished.body.eligible, true);
  assert.equal(generationCount, 1);
  app.setTime(1_099_999);
  assert.deepEqual((await app.finish(started.body.id, [])).body, finished.body);
  const entered = await app.enter(started.body.id, '  나우  ');
  assert.equal(entered.body.entry.name, '나우');
  assert.equal(entered.body.entry.score, 50);
  assert.equal(entered.body.entry.elapsedMs, 4321);
  assert.equal(entered.body.rank, 1);
});

test('completed failure endings are eligible; missing and unfinished attempts cannot register', async t => {
  const app = await launch(t);
  assert.equal((await app.enter('missing', '이름')).status, 404);
  const pending = (await app.start()).body;
  assert.equal((await app.enter(pending.id, '이름')).status, 409);
  const unfinished = await app.finish(pending.id, [M, P]);
  assert.equal(unfinished.body.eligible, false);
  assert.equal(unfinished.body.result.total, 50);
  assert.equal((await app.enter(pending.id, '이름')).status, 409);
  const started = (await app.start()).body;
  const failure = (await app.finish(started.id, [M, M, P, C])).body;
  assert.equal(failure.checkedOut, false);
  assert.equal(failure.eligible, true);
  assert.equal(failure.actions, 3);
  assert.equal(failure.result.verdict, 'easterEgg');
  const registered = await app.enter(started.id, '양말왕');
  assert.equal(registered.status, 200);
  assert.equal(registered.body.entry.ending, '양말');
  assert.equal(registered.body.entry.score, -20);
});

test('same-map retry preserves solving time and excludes time spent in result/name screens', async t => {
  let generated = 0;
  const app = await launch(t, { generateLevel: () => { generated++; return fixture(); } });
  const initial = (await app.start()).body;
  assert.equal((await app.start({ level: 1, retryOf: initial.id })).status, 409);
  app.setTime(1_005_000);
  await app.finish(initial.id, [M, P]);
  app.setTime(1_100_000);
  const retry = (await app.start({ level: 1, retryOf: initial.id })).body;
  assert.notEqual(retry.id, initial.id);
  assert.deepEqual(retry.map, initial.map);
  assert.deepEqual(retry.shoppingList, initial.shoppingList);
  assert.equal(retry.elapsedBaseMs, 5000);
  assert.equal(retry.startedAt, 1_100_000);
  app.setTime(1_102_000);
  assert.equal((await app.finish(retry.id, [M, P, C])).body.elapsedMs, 7000);
  assert.equal(generated, 1);
  assert.equal((await app.start({ level: 2, retryOf: retry.id })).status, 409);
  assert.equal((await app.start({ level: 1, retryOf: 'missing' })).status, 404);
  assert.equal((await app.start({ level: 1, retryOf: 42 })).status, 400);
  const fresh = (await app.start()).body;
  assert.equal(fresh.elapsedBaseMs, 0);
  assert.equal(generated, 2);
});

test('leaderboard orders by score, then solving time, then creation and ID; levels stay separate', async t => {
  const app = await launch(t);
  const slow = (await app.start()).body;
  app.setTime(1_003_000);
  await app.finish(slow.id);
  await app.enter(slow.id, '느린사람');
  app.setTime(1_004_000);
  const fast = (await app.start()).body;
  app.setTime(1_005_000);
  await app.finish(fast.id, [M, M, M, C]);
  await app.enter(fast.id, '빠른사람');
  const high = (await app.start()).body;
  app.setTime(1_015_000);
  await app.finish(high.id, [M, P, C]);
  await app.enter(high.id, '고득점');
  const tieOne = (await app.start()).body, tieTwo = (await app.start()).body;
  app.setTime(1_016_000);
  await app.finish(tieOne.id);
  await app.finish(tieTwo.id);
  const tiedOne = (await app.enter(tieOne.id, '동점하나')).body.entry;
  const tiedTwo = (await app.enter(tieTwo.id, '동점둘')).body.entry;
  assert.equal(tiedOne.createdAt, tiedTwo.createdAt);
  assert(tiedOne.id < tiedTwo.id);
  const otherLevel = (await app.start({ level: 2 })).body;
  await app.finish(otherLevel.id, [M, P, C]);
  await app.enter(otherLevel.id, '고학년');
  const low = (await app.request('/api/leaderboard?level=1')).body;
  assert.deepEqual(low.entries.map(entry => entry.name), ['고득점', '빠른사람', '동점하나', '동점둘', '느린사람']);
  assert.equal(low.total, 5);
  const highBoard = (await app.request('/api/leaderboard?level=2')).body;
  assert.deepEqual(highBoard.entries.map(entry => entry.name), ['고학년']);
});

test('entry submission is idempotent and concurrent writes keep one entry per attempt', async t => {
  const app = await launch(t);
  const attempt = (await app.start()).body;
  await app.finish(attempt.id);
  const submissions = await Promise.all(Array.from({ length: 10 }, (_, i) => app.enter(attempt.id, `이름${i}`)));
  assert(submissions.every(response => response.status === 200));
  assert.equal(new Set(submissions.map(response => response.body.entry.id)).size, 1);
  assert.equal(new Set(submissions.map(response => response.body.entry.name)).size, 1);
  assert.equal((await app.request('/api/leaderboard')).body.total, 1);
  const attempts = await Promise.all(Array.from({ length: 12 }, () => app.start()));
  const finishes = await Promise.all(attempts.map(response => app.finish(response.body.id)));
  assert(finishes.every(response => response.status === 200));
  const registrations = await Promise.all(attempts.map((response, i) => app.enter(response.body.id, `참가자${i}`)));
  assert(registrations.every(response => response.status === 200));
  const board = (await app.request('/api/leaderboard?level=1')).body;
  assert.equal(board.total, 13);
  assert.equal(board.entries.length, 10);
  assert.equal(new Set(board.entries.map(entry => entry.id)).size, 10);
  assert(registrations.some(response => response.body.rank > 10));
});

test('server validates levels, names, JSON size, and bounded AST before executing', async t => {
  const app = await launch(t);
  for (const level of [0, 3, '1', null]) assert.equal((await app.start({ level })).status, 400);
  for (const level of ['', '3', '1.0', '01']) assert.equal((await app.request('/api/leaderboard?level=' + level)).status, 400);
  const attempt = (await app.start()).body;
  let deep = [];
  for (let i = 0; i < 14; i++) deep = [{ op: 'repeat', n: 1, body: deep }];
  for (const program of [
    null, {}, [{ op: 'eval' }], [{ op: 'move', malicious: 'x' }], [{ op: 'move', id: 1 }],
    [{ op: 'repeat', n: 0, body: [] }], [{ op: 'repeat', n: 21, body: [] }],
    [{ op: 'repeat', n: 1.5, body: [] }], [{ op: 'repeat', n: 2 }],
    [{ op: 'if', cond: 'TRUE', body: [] }], [{ op: 'if', cond: 'WALL', body: null }],
    [C, C], Array.from({ length: 501 }, () => M), deep
  ]) assert.equal((await app.finish(attempt.id, program)).status, 400, JSON.stringify(program).slice(0, 140));
  const invalidJson = await fetch(app.base + '/api/attempts', { method: 'POST', body: '{broken' });
  assert.equal(invalidJson.status, 400);
  const tooBig = await fetch(app.base + '/api/attempts', { method: 'POST', body: JSON.stringify({ level: 1, extra: 'x'.repeat(66_000) }) });
  assert.equal(tooBig.status, 413);
  assert.equal((await app.finish(attempt.id, [{ op: 'checkout', id: 'Blockly-id' }])).status, 200);
  for (const name of ['', '  ', '가'.repeat(13), 'hello\n', 'hi\u0000', 'a\u200bb', null, 42]) {
    assert.equal((await app.enter(attempt.id, name)).status, 400);
  }
  const accepted = await app.enter(attempt.id, '😀'.repeat(12));
  assert.equal(accepted.status, 200);
  assert.equal(Array.from(accepted.body.entry.name).length, 12);
});

test('nested repetition obeys engine execution limit even without a finish block', async t => {
  const app = await launch(t);
  const attempt = (await app.start()).body;
  let program = [M];
  for (let i = 0; i < 10; i++) program = [{ op: 'repeat', n: 20, body: program }];
  const response = await app.finish(attempt.id, program);
  assert.equal(response.status, 200);
  assert.equal(response.body.eligible, false);
  assert.equal(response.body.checkedOut, false);
  assert(response.body.actions <= 600);
  assert.equal(response.body.blocks, 12);
});

test('SQLite retains pending sessions, immutable outcomes, and rankings across server restart', async t => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asv-persistence-'));
  t.after(() => fs.rmSync(dbDir, { recursive: true, force: true }));
  const dbPath = path.join(dbDir, 'rankings.sqlite');
  const first = await launch(t, { dbPath });
  const done = (await first.start()).body, pending = (await first.start({ level: 2 })).body;
  first.setTime(1_002_000);
  const outcome = (await first.finish(done.id, [M, P, C])).body;
  const entry = (await first.enter(done.id, '기억해줘')).body.entry;
  await first.close();
  const second = await launch(t, { dbPath });
  second.setTime(1_003_000);
  assert.deepEqual((await second.request('/api/leaderboard')).body.entries, [entry]);
  assert.deepEqual((await second.finish(done.id, [])).body, outcome);
  assert.deepEqual((await second.enter(done.id, '다른이름')).body.entry, entry);
  const pendingResult = (await second.finish(pending.id, [M, P, C])).body;
  assert.equal(pendingResult.result.total, 50);
  assert.equal(pendingResult.elapsedMs, 3000);
  const retry = (await second.start({ level: 1, retryOf: done.id })).body;
  assert.deepEqual(retry.map, done.map);
  assert.equal(retry.elapsedBaseMs, 2000);
});

test('expired attempts fail explicitly while published entries remain available', async t => {
  const app = await launch(t);
  const attempt = (await app.start()).body;
  await app.finish(attempt.id);
  await app.enter(attempt.id, '기록유지');
  app.setTime(1_000_000 + 24 * 60 * 60 * 1000 + 1);
  assert.equal((await app.finish(attempt.id)).status, 410);
  assert.equal((await app.enter(attempt.id, '새이름')).status, 410);
  assert.equal((await app.start({ level: 1, retryOf: attempt.id })).status, 410);
  assert.equal((await app.request('/api/leaderboard')).body.total, 1);
});

test('static server exposes game assets and rejects traversal, symlink escapes, and private files', async t => {
  const app = await launch(t);
  fs.writeFileSync(path.join(app.temp, 'server.cjs'), 'SECRET');
  fs.writeFileSync(path.join(app.temp, 'private.sqlite'), 'SECRET');
  fs.mkdirSync(path.join(app.temp, '.git'));
  fs.writeFileSync(path.join(app.temp, '.git', 'config'), 'SECRET');
  fs.mkdirSync(path.join(app.temp, 'test'));
  fs.writeFileSync(path.join(app.temp, 'test', 'test.js'), 'SECRET');
  fs.symlinkSync(__filename, path.join(app.temp, 'js', 'escape.js'));
  fs.symlinkSync(path.join(app.temp, 'private.sqlite'), path.join(app.temp, 'js', 'private.js'));
  const root = await fetch(app.base + '/');
  assert.equal(root.status, 200);
  assert((await root.text()).includes('<title>ASV</title>'));
  assert.equal((await fetch(app.base + '/js/app.js')).status, 200);
  assert.equal((await fetch(app.base + '/', { method: 'POST' })).status, 405);
  for (const url of ['/server.cjs', '/private.sqlite', '/.git/config', '/test/test.js', '/js/escape.js', '/js/private.js',
    '/js/%2e%2e%2fserver.cjs', '/js/..%2F.git/config', '/js/%5c..%5cserver.cjs', '/js/%00app.js', '/js/%ZZ']) {
    const response = await fetch(app.base + url);
    assert([400, 404].includes(response.status), `${url}: ${response.status}`);
  }
  // A raw HTTP path also covers traversal syntax before the client URL parser normalizes it.
  const status = await new Promise((resolve, reject) => {
    const request = http.get(app.base + '/js/..%2fserver.cjs', response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(status, 404);
});
