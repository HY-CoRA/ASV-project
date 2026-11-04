'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { once } = require('node:events');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');
const { createServer } = require('../server.cjs');
const Game = require('../js/engine.js');

const M = { op: 'move' }, P = { op: 'pick' }, C = { op: 'checkout' };
const fixture = () => ({ map: [['S', '딸기', '양말']], shoppingList: ['딸기'] });
const mapVariant = count => ({ map: [['S', '딸기', ...Array(count).fill('.'), '양말']], shoppingList: ['딸기'] });
const mapId = (level, snapshot) => 'map_' + createHash('sha256').update(JSON.stringify([level, snapshot.map, snapshot.shoppingList])).digest('hex');

function seededRandom(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function shoppingProgram(attempt) {
  const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]], key = cell => cell.join(',');
  let at = [0, 0], facing = 1;
  const program = [];
  for (const item of attempt.shoppingList) {
    const row = attempt.map.findIndex(cells => cells.includes(item)), target = [row, attempt.map[row].indexOf(item)];
    const queue = [[at]], seen = new Set([key(at)]);
    let route;
    for (let i = 0; i < queue.length; i++) {
      const path = queue[i], cell = path.at(-1);
      if (key(cell) === key(target)) { route = path; break; }
      for (const [dr, dc] of directions) {
        const next = [cell[0] + dr, cell[1] + dc], value = attempt.map[next[0]]?.[next[1]];
        if (value === undefined || value === '#' || Game.HAZARDS[value] || seen.has(key(next))) continue;
        seen.add(key(next));
        queue.push([...path, next]);
      }
    }
    assert(route, 'The actual requested ingredient has a hazard-free route');
    for (let i = 1; i < route.length; i++) {
      const direction = directions.findIndex(([dr, dc]) => dr === route[i][0] - route[i - 1][0] && dc === route[i][1] - route[i - 1][1]);
      const turns = (direction - facing + 4) % 4;
      if (turns === 3) program.push({ op: 'left' });
      else for (let n = 0; n < turns; n++) program.push({ op: 'right' });
      program.push(M);
      facing = direction;
    }
    program.push(P);
    at = target;
  }
  return [...program, C];
}

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

test('real random ingredient lists are stored, scored, and preserved on same-map retry', async t => {
  let generated = 0, latest;
  const app = await launch(t, { generateLevel: id => {
    latest = Game.generateLevel(id, seededRandom(200 + ++generated));
    return latest;
  } });
  let clock = 1_000_000;
  for (const level of [1, 2]) {
    const started = (await app.start({ level })).body, count = level === 1 ? 3 : 5;
    assert.deepEqual(started.map, latest.map);
    assert.deepEqual(started.shoppingList, latest.shoppingList);
    assert.equal(started.shoppingList.length, count);
    assert.equal(new Set(started.shoppingList).size, count);
    assert(started.shoppingList.every(item => Game.INGREDIENTS.includes(item)));
    const program = shoppingProgram(started), lists = new Set([started.shoppingList.slice().sort().join('/')]);
    // Only the serialized attempt is authoritative after creation, even if its source object changes.
    latest.map[0][0] = '#';
    latest.shoppingList.length = 0;
    clock += 2500;
    app.setTime(clock);
    const finished = await app.finish(started.id, program, { shoppingList: ['양말'], score: 99999 });
    assert.equal(finished.status, 200);
    assert.equal(finished.body.result.verdict, 'perfect');
    assert.equal(finished.body.result.total, count * 50);
    assert.equal(finished.body.result.max, count * 50);
    assert.deepEqual(finished.body.result.rows.map(row => row.item).sort(), started.shoppingList.slice().sort());
    const entry = await app.enter(started.id, '랜덤재료' + level);
    assert.equal(entry.body.entry.score, count * 50);
    const generationCount = generated;
    clock += 60_000;
    app.setTime(clock);
    const retry = (await app.start({ level, retryOf: started.id })).body;
    assert.equal(generated, generationCount, 'Retry must not sample another map or ingredient list');
    assert.deepEqual(retry.map, started.map);
    assert.deepEqual(retry.shoppingList, started.shoppingList);
    assert.equal(retry.elapsedBaseMs, 2500);
    clock += 1500;
    app.setTime(clock);
    const retried = (await app.finish(retry.id, program)).body;
    assert.equal(retried.result.total, count * 50);
    assert.equal(retried.elapsedMs, 4000);
    for (let i = 0; i < 5; i++) {
      const fresh = (await app.start({ level })).body;
      lists.add(fresh.shoppingList.slice().sort().join('/'));
      assert.equal(fresh.shoppingList.length, count);
      assert.equal(fresh.elapsedBaseMs, 0);
    }
    assert(lists.size > 1, 'Fresh maps must sample different requested ingredient combinations');
  }
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

test('daily challenges persist one shared Korean-day map across concurrent clients, servers, and restart', async t => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asv-daily-'));
  const dbPath = path.join(dbDir, 'daily.sqlite');
  let clock = Date.parse('2026-11-05T02:00:00.000Z'), generated = 0;
  const options = { dbPath, now: () => clock, generateLevel: () => mapVariant(++generated) };
  const first = await launch(t, options), second = await launch(t, options);
  t.after(async () => { await first.close(); await second.close(); fs.rmSync(dbDir, { recursive: true, force: true }); });
  const requests = await Promise.all(Array.from({ length: 16 }, (_, i) => (i % 2 ? first : second).start({ level: 1, mode: 'daily' })));
  assert(requests.every(response => response.status === 201));
  assert.equal(new Set(requests.map(response => response.body.id)).size, 16, 'Each player has an independent clock and attempt');
  assert.equal(new Set(requests.map(response => response.body.challenge.id)).size, 1);
  assert.equal(generated, 1, 'The first daily snapshot is generated only once');
  const daily = requests[0].body;
  assert.deepEqual(daily.challenge, { id: mapId(1, daily), kind: 'daily', label: '2026-11-05 오늘의 도전' });
  assert(requests.every(response => JSON.stringify(response.body.map) === JSON.stringify(daily.map)));
  clock += 5000;
  await second.finish(daily.id, [M, P, C]);
  const saved = await first.enter(daily.id, '오늘첫참가자');
  assert.equal(saved.body.entry.challengeId, daily.challenge.id);
  const fallback = (await second.request('/api/leaderboard?level=1')).body;
  assert.equal(fallback.challenge.id, daily.challenge.id);
  assert.equal(fallback.total, 1);
  assert.equal(generated, 1);
  const high = (await first.start({ level: 2, mode: 'daily' })).body;
  assert.notEqual(high.challenge.id, daily.challenge.id);
  assert.equal(generated, 2);
  await first.close(); await second.close();
  const restarted = await launch(t, { dbPath, now: () => clock, generateLevel: () => { throw new Error('Persisted daily maps must not be regenerated'); } });
  t.after(async () => { await restarted.close(); fs.rmSync(dbDir, { recursive: true, force: true }); });
  const afterRestart = (await restarted.start({ level: 1, mode: 'daily' })).body;
  assert.deepEqual(afterRestart.map, daily.map);
  assert.deepEqual(afterRestart.shoppingList, daily.shoppingList);
  assert.deepEqual(afterRestart.challenge, daily.challenge);
  assert.deepEqual((await restarted.request('/api/leaderboard?level=1')).body.entries, [saved.body.entry]);
});

test('Korean midnight changes the shared map while active and retried attempts keep their original challenge', async t => {
  let clock = Date.parse('2026-11-05T14:59:59.000Z'), generated = 0;
  const app = await launch(t, { now: () => clock, generateLevel: () => mapVariant(++generated) });
  const yesterday = (await app.start({ level: 1, mode: 'daily' })).body;
  assert(yesterday.challenge.label.startsWith('2026-11-05'));
  clock += 1000;
  const todayBoard = (await app.request('/api/leaderboard?level=1')).body;
  assert(todayBoard.challenge.label.startsWith('2026-11-06'));
  assert.notEqual(todayBoard.challenge.id, yesterday.challenge.id);
  assert.equal(todayBoard.total, 0);
  const finished = (await app.finish(yesterday.id, [M, P, C])).body;
  assert.equal(finished.elapsedMs, 1000);
  const saved = (await app.enter(yesterday.id, '자정에도전')).body;
  assert.equal(saved.entry.challengeId, yesterday.challenge.id);
  assert.equal(saved.challenge.id, yesterday.challenge.id);
  assert.equal((await app.request('/api/leaderboard?level=1')).body.total, 0);
  assert.equal((await app.request('/api/leaderboard?level=1&challengeId=' + yesterday.challenge.id)).body.total, 1);
  clock += 60_000;
  const retry = (await app.start({ level: 1, retryOf: yesterday.id })).body;
  assert.equal(retry.challenge.id, yesterday.challenge.id);
  assert.deepEqual(retry.map, yesterday.map);
  assert.equal(retry.elapsedBaseMs, 1000);
  assert.equal(generated, 2);
  clock += 2000;
  assert.equal((await app.finish(retry.id, [M, P, C])).body.elapsedMs, 3000);
  const loaded = (await app.start({ level: 1, challengeId: yesterday.challenge.id })).body;
  assert.equal(loaded.challenge.id, yesterday.challenge.id);
  assert.equal(loaded.elapsedBaseMs, 0, 'A second player joining a shared challenge starts a fresh clock');
});

test('random challenges stay fresh, identical map snapshots share a bucket, and rankings never mix maps', async t => {
  let generated = 0;
  const app = await launch(t, { generateLevel: () => mapVariant(++generated) });
  const daily = (await app.start({ level: 1, mode: 'daily' })).body;
  const randomA = (await app.start({ level: 1, mode: 'random' })).body;
  const randomB = (await app.start({ level: 1 })).body;
  assert.equal(new Set([daily, randomA, randomB].map(attempt => attempt.challenge.id)).size, 3);
  assert.equal(randomA.challenge.kind, 'random');
  assert.equal(randomB.challenge.kind, 'random');
  for (const [attempt, name, program] of [[daily, '일일참가자', [C]], [randomA, '랜덤에이', [M, P, C]], [randomB, '랜덤비', [M, P, C]]]) {
    await app.finish(attempt.id, program);
    const entry = (await app.enter(attempt.id, name)).body;
    assert.equal(entry.rank, 1);
    assert.deepEqual(entry.entries.map(row => row.name), [name]);
  }
  const joined = (await app.start({ level: 1, challengeId: randomA.challenge.id })).body;
  assert.equal(generated, 3, 'A known challenge uses its stored snapshot');
  assert.deepEqual(joined.map, randomA.map);
  assert.deepEqual(joined.shoppingList, randomA.shoppingList);
  assert.equal(joined.elapsedBaseMs, 0);
  await app.finish(joined.id, [C]);
  const joinedEntry = (await app.enter(joined.id, '동일지도참가자')).body;
  assert.equal(joinedEntry.rank, 2, 'Only scores on this exact map affect the rank');
  assert.deepEqual(joinedEntry.entries.map(row => row.name), ['랜덤에이', '동일지도참가자']);
  assert.equal((await app.request('/api/leaderboard?level=1&challengeId=' + randomA.challenge.id)).body.total, 2);
  assert.deepEqual((await app.request('/api/leaderboard?level=1')).body.entries.map(row => row.name), ['일일참가자']);
  const identical = await launch(t);
  const a = (await identical.start()).body, b = (await identical.start()).body;
  assert.notEqual(a.id, b.id);
  assert.equal(a.challenge.id, b.challenge.id);
  const sameDaily = (await identical.start({ level: 1, mode: 'daily' })).body;
  assert.equal(sameDaily.challenge.id, a.challenge.id, 'Identical random and daily maps share the same fair bucket');
});

test('challenge IDs, difficulty, snapshots, score, and registration association are controlled by the server', async t => {
  const app = await launch(t, { generateLevel: level => mapVariant(level) });
  const low = (await app.start({ level: 1, mode: 'daily' })).body;
  const high = (await app.start({ level: 2, mode: 'daily' })).body;
  const sameMapHigh = await launch(t);
  const l1 = (await sameMapHigh.start({ level: 1 })).body, l2 = (await sameMapHigh.start({ level: 2 })).body;
  assert.deepEqual(l1.map, l2.map);
  assert.notEqual(l1.challenge.id, l2.challenge.id, 'Difficulty is part of the snapshot hash');
  for (const mode of ['', null, 1, 'all']) assert.equal((await app.start({ level: 1, mode })).status, 400);
  for (const id of ['', null, 1, 'x'.repeat(101)]) assert.equal((await app.start({ level: 1, challengeId: id })).status, 400);
  assert.equal((await app.start({ level: 1, challengeId: 'unknown' })).status, 404);
  assert.equal((await app.request('/api/leaderboard?level=1&challengeId=unknown')).status, 404);
  assert.equal((await app.request('/api/leaderboard?level=1&challengeId=')).status, 400);
  assert.equal((await app.start({ level: 2, challengeId: low.challenge.id })).status, 400);
  assert.equal((await app.request('/api/leaderboard?level=1&challengeId=' + high.challenge.id)).status, 400);
  assert.equal((await app.start({ level: 1, retryOf: low.id, challengeId: low.challenge.id })).status, 400);
  const loaded = (await app.start({ level: 1, challengeId: low.challenge.id, map: [['S']], shoppingList: [], startedAt: 0 })).body;
  assert.deepEqual(loaded.map, low.map);
  assert.deepEqual(loaded.shoppingList, low.shoppingList);
  assert.equal(loaded.startedAt, 1_000_000);
  await app.finish(loaded.id, [M, P, C], { challengeId: high.challenge.id, score: 99999, elapsedMs: 0 });
  const saved = (await app.request('/api/attempts/' + loaded.id + '/entry', { name: '정직한기록', challengeId: high.challenge.id, score: 99999 })).body;
  assert.equal(saved.entry.challengeId, low.challenge.id);
  assert.equal(saved.entry.score, 50);
  assert.equal((await app.request('/api/leaderboard?level=2&challengeId=' + high.challenge.id)).body.total, 0);
});

test('legacy SQLite schema migrates additively, backfills exact-map groups, and retains all records across restart', async t => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asv-legacy-'));
  const dbPath = path.join(dbDir, 'legacy.sqlite');
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE attempts (id TEXT PRIMARY KEY, level INTEGER NOT NULL, map_json TEXT NOT NULL,
      shopping_json TEXT NOT NULL, started_at INTEGER NOT NULL, elapsed_base_ms INTEGER NOT NULL DEFAULT 0, outcome_json TEXT);
    CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id),
      name TEXT NOT NULL, score INTEGER NOT NULL, elapsed_ms INTEGER NOT NULL, level INTEGER NOT NULL,
      actions INTEGER NOT NULL, blocks INTEGER NOT NULL, verdict TEXT NOT NULL, ending TEXT, created_at INTEGER NOT NULL);
  `);
  const oldOutcome = { id: 'legacy-done', result: { total: 50, verdict: 'perfect', failure: null }, checkedOut: true,
    actions: 3, blocks: 4, elapsedMs: 4500, eligible: true };
  const insert = legacy.prepare('INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?, ?)');
  const snapshots = [fixture(), fixture(), mapVariant(2), fixture(), fixture()];
  const ids = ['legacy-done', 'legacy-same', 'legacy-other-map', 'legacy-other-level', 'legacy-pending'];
  for (let i = 0; i < ids.length; i++) insert.run(ids[i], i === 3 ? 2 : 1, JSON.stringify(snapshots[i].map),
    JSON.stringify(snapshots[i].shoppingList), 1_000_000, 0, i === 4 ? null : JSON.stringify({ ...oldOutcome, id: ids[i] }));
  const insertEntry = legacy.prepare('INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < 4; i++) insertEntry.run(41 + i, ids[i], '이전기록' + i, 50, 4500, i === 3 ? 2 : 1, 3, 4, 'perfect', null, 1_000_100 + i);
  const beforeEntries = legacy.prepare('SELECT * FROM entries ORDER BY id').all().map(row => ({ ...row }));
  const beforeAttempts = legacy.prepare('SELECT * FROM attempts ORDER BY id').all().map(row => ({ ...row }));
  legacy.close();
  const app = await launch(t, { dbPath, generateLevel: () => mapVariant(9) });
  t.after(async () => { await app.close(); fs.rmSync(dbDir, { recursive: true, force: true }); });
  assert.equal(app.server.db.prepare('SELECT COUNT(*) AS count FROM attempts').get().count, 5);
  assert.equal(app.server.db.prepare('SELECT COUNT(*) AS count FROM entries').get().count, 4);
  const afterEntries = app.server.db.prepare('SELECT * FROM entries ORDER BY id').all();
  const afterAttempts = app.server.db.prepare('SELECT * FROM attempts ORDER BY id').all();
  assert.deepEqual(afterEntries.map(({ challenge_id, ...entry }) => entry), beforeEntries);
  assert.deepEqual(afterAttempts.map(({ challenge_id, ...attempt }) => attempt), beforeAttempts);
  assert.equal(afterEntries[0].challenge_id, afterEntries[1].challenge_id);
  assert.notEqual(afterEntries[0].challenge_id, afterEntries[2].challenge_id);
  assert.notEqual(afterEntries[0].challenge_id, afterEntries[3].challenge_id);
  assert.equal(app.server.db.prepare('SELECT COUNT(*) AS count FROM challenges').get().count, 3);
  const oldBoard = (await app.request('/api/leaderboard?level=1&challengeId=' + mapId(1, fixture()))).body;
  assert.deepEqual(oldBoard.entries.map(entry => entry.id), [41, 42]);
  assert.equal(oldBoard.total, 2);
  assert.equal((await app.request('/api/leaderboard?level=1')).body.total, 0, 'Old random maps are not mixed into the current daily board');
  assert.deepEqual((await app.finish('legacy-done', [])).body, oldOutcome, 'Migration never rewrites immutable outcomes');
  const retry = (await app.start({ level: 1, retryOf: 'legacy-done' })).body;
  assert.equal(retry.challenge.id, mapId(1, fixture()));
  assert.equal(retry.elapsedBaseMs, 4500);
  assert.deepEqual(retry.map, fixture().map);
  const pendingResult = (await app.finish('legacy-pending', [M, P, C])).body;
  assert.equal(pendingResult.result.total, 50);
  const pendingEntry = (await app.enter('legacy-pending', '새이름')).body.entry;
  assert(pendingEntry.id > 44, 'Autoincrement IDs are preserved');
  assert.equal(pendingEntry.challengeId, mapId(1, fixture()));
  const migratedIds = app.server.db.prepare('SELECT id, challenge_id FROM attempts ORDER BY id').all();
  await app.close();
  const restarted = await launch(t, { dbPath });
  t.after(async () => { await restarted.close(); fs.rmSync(dbDir, { recursive: true, force: true }); });
  assert.deepEqual(restarted.server.db.prepare('SELECT id, challenge_id FROM attempts ORDER BY id').all(), migratedIds);
  assert.equal(restarted.server.db.prepare('SELECT COUNT(*) AS count FROM entries').get().count, 5);
  const boardAfterRestart = (await restarted.request('/api/leaderboard?level=1&challengeId=' + mapId(1, fixture()))).body;
  assert.equal(boardAfterRestart.total, 3);
  assert.deepEqual(boardAfterRestart.entries.map(entry => entry.name).sort(), ['이전기록0', '이전기록1', '새이름'].sort());
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

test('installable app manifest, worker and every icon are served with valid types and relative scope', async t => {
  const app = await launch(t, { staticDir: path.resolve(__dirname, '..') });
  const response = await fetch(app.base + '/manifest.webmanifest');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/manifest\+json/);
  const manifest = await response.json();
  const mounted = new URL('https://example.test/game-mount/manifest.webmanifest');
  for (const field of ['id', 'scope', 'start_url']) {
    assert.equal(new URL(manifest[field], mounted).href, 'https://example.test/game-mount/');
  }
  assert.equal(manifest.display, 'standalone');
  const sizes = new Set();
  for (const icon of manifest.icons) {
    const asset = await fetch(new URL(icon.src, app.base + '/manifest.webmanifest'));
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), new RegExp('^' + icon.type.replace('+', '\\+')));
    if (icon.type === 'image/png') {
      const bytes = Buffer.from(await asset.arrayBuffer());
      const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
      assert.equal(`${width}x${height}`, icon.sizes);
      sizes.add(icon.sizes);
    }
  }
  assert(sizes.has('192x192') && sizes.has('512x512'));
  assert(manifest.icons.some(icon => icon.purpose === 'maskable'));
  const worker = await fetch(app.base + '/sw.js');
  assert.equal(worker.status, 200);
  assert.match(worker.headers.get('content-type'), /^text\/javascript/);
  assert.equal(worker.headers.get('cache-control'), 'no-cache');
  const apple = await fetch(app.base + '/icons/apple-touch-icon.png');
  assert.equal(apple.status, 200);
  assert.equal((await fetch(app.base + '/js/pwa.js')).status, 200);
});
