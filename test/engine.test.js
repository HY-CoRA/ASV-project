const assert = require('node:assert/strict');
const { Engine, ITEMS, HAZARDS, FAILURES, LEVELS, interpret, score, compareEntries, levelById, generateLevel } = require('../js/engine.js');

const M = { op: 'move' };
const L = { op: 'left' };
const R = { op: 'right' };
const P = { op: 'pick' };
const C = { op: 'checkout' };
const repeat = (n, body) => ({ op: 'repeat', n, body });
const when = (cond, body) => ({ op: 'if', cond, body });

function run(level, program) {
  const engine = new Engine(level);
  const events = Array.from(interpret(program, engine), step => step.ev);
  return { engine, events, result: score(engine) };
}

const [lowMetadata, highMetadata] = LEVELS;
// 이동·집기·반복의 회귀 검증은 생성 지도와 독립적인 고정 지도를 쓴다.
const low = { shoppingList: ['딸기', '브로콜리'], map: [
  ['S', '딸기', '.', '.'], ['#', '#', '#', '.'], ['#', '#', '#', '브로콜리']
] };
const high = { shoppingList: ['딸기', '브로콜리'], map: [
  ['S', '.', '딸기', '#', '.', '.', '.', '.'],
  ['#', '.', '.', '#', '.', '#', '#', '.'],
  ['.', '.', '#', '#', '.', '.', '사과', '.'],
  ['.', '#', '.', '.', '.', '#', '.', '#'],
  ['바나나', '#', '.', '#', '.', '#', '.', '.'],
  ['.', '.', '.', '#', '.', '#', '#', '.'],
  ['#', '#', '.', '.', '.', '.', '.', '.'],
  ['.', '.', '.', '#', '당근', '#', '.', '브로콜리']
] };
assert.equal(LEVELS.length, 2);
assert.equal(levelById('1'), lowMetadata);
assert.equal(levelById('2'), highMetadata);
assert.equal(levelById('3'), null);
assert(!LEVELS.some(level => level.map.flat().includes('E')));

// 집기는 현재 칸에서만 되고, 같은 칸의 물건을 두 번 담을 수 없다.
let { engine, events, result } = run(low, [P, M, P, P, M, M, R, M, M, P, C]);
assert.deepEqual(events.slice(0, 4), [
  { type: 'pickNothing' },
  { type: 'move' },
  { type: 'pick', item: '딸기', row: 0, col: 1 },
  { type: 'pickNothing' }
]);
assert.deepEqual(engine.collected, ['딸기', '브로콜리']);
assert(engine.pickedAt(0, 1));
assert(engine.pickedAt(2, 3));
assert.equal(result.verdict, 'perfect');
assert.equal(result.total, 100);
assert.equal(result.max, 100);

engine.reset();
assert(!engine.pickedAt(0, 1));
assert(!engine.checkedOut);
assert.deepEqual(engine.collected, []);

// 브로콜리부터 담아도 만점이다.
({ engine, result } = run(low, [M, M, M, R, M, M, P, R, R, M, M, L, M, M, P, C]));
assert.deepEqual(engine.collected, ['브로콜리', '딸기']);
assert.equal(result.verdict, 'perfect');
assert.equal(result.total, 100);

// 이동이나 프로그램의 마지막 줄은 자동으로 계산하지 않는다.
({ engine, result } = run(low, [M, P, M, M, R, M, M, P]));
assert.equal(engine.checkedOut, false);
assert.equal(result.verdict, 'unfinished');
assert.equal(result.perfect, false);
assert.equal(result.total, 100);

// 계산하면 즉시 종료한다. 반복 안에서 계산해도 바깥 블록은 실행되지 않는다.
({ engine, events, result } = run(low, [M, P, repeat(3, [C, R]), M]));
assert.deepEqual(events.map(event => event.type), ['move', 'pick', 'repeat', 'checkout']);
assert(engine.checkedOut);
assert.equal(engine.actions, 3);
assert.equal(result.verdict, 'incomplete');
assert.equal(result.total, 50);

// 고학년 미로는 반복과 조건으로 풀 수 있다. 물건 위를 지나가도 자동으로 담지 않는다.
const toBanana = [repeat(2, [M]), P, R, when('NOWALL', [M]), R, M, L, M, R, M, L, repeat(2, [M])];
const toBroccoli = [M, L, repeat(2, [M]), R, M, L, repeat(5, [M]), when('WALL', [R]), M, P, C];
({ engine, result } = run(high, [...toBanana, ...toBroccoli]));
assert.equal(engine.bumps, 0);
assert.deepEqual(engine.collected, ['딸기', '브로콜리']);
assert.equal(result.verdict, 'perfect');
assert.equal(result.total, 100);

// 목록 밖의 바나나를 직접 담으면 점수가 깎인다.
({ engine, result } = run(high, [...toBanana, P, ...toBroccoli]));
assert.deepEqual(engine.collected, ['딸기', '바나나', '브로콜리']);
assert.equal(result.verdict, 'wrong');
assert.equal(result.total, 80);
assert.equal(result.rows[1].verdict, '목록에 없음');
assert.equal(result.rows[1].pts, -20);

const entries = [
  { id: 'a', score: 80, elapsedMs: 100, createdAt: 1, blocks: 1 },
  { id: 'b', score: 100, elapsedMs: 3000, createdAt: 1, blocks: 1 },
  { id: 'c', score: 100, elapsedMs: 2000, createdAt: 2, blocks: 2 },
  { id: 'd', score: 100, elapsedMs: 2000, createdAt: 1, blocks: 20 }
];
assert.deepEqual(entries.slice().sort(compareEntries), [entries[3], entries[2], entries[1], entries[0]]);

// 함정은 이동 시 발동하고, 같은 칸은 한 실행에서 한 번만 감점한다.
const trapLevel = { shoppingList: ['딸기', '브로콜리'], map: [
  ['S', '물웅덩이', '딸기', '미끄럼', '브로콜리', '양말']
] };
engine = new Engine(trapLevel);
assert.deepEqual(engine.move(), { type: 'trap', hazard: '물웅덩이', row: 0, col: 1, penalty: 10 });
assert.equal(engine.trapHits, 1);
assert.equal(engine.trapPenalty, 10);
assert.deepEqual(engine.pick(), { type: 'pickNothing' });
engine.turn('R'); engine.turn('R'); engine.move();
engine.turn('R'); engine.turn('R');
assert.deepEqual(engine.move(), { type: 'move' });
assert.equal(engine.trapHits, 1);
assert.equal(engine.trapPenalty, 10);
assert.equal(score(engine).verdict, 'unfinished');
engine.reset();
assert.equal(engine.triggeredTraps.size, 0);
assert.equal(engine.trapHits, 0);
assert.equal(engine.trapPenalty, 0);
assert.equal(engine.move().type, 'trap');

({ engine, result } = run(trapLevel, [M, M, P, M, M, P, C]));
assert.equal(result.total, 80);
assert.equal(result.max, 100);
assert.equal(result.trapPenalty, 20);
assert.equal(result.traps, 2);
assert.equal(result.verdict, 'trapped');
assert.equal(result.perfect, false);
assert.equal(result.rows.length, 2);
({ result } = run(trapLevel, [M, C]));
assert.equal(result.verdict, 'incomplete');
assert.equal(result.total, -10);
({ result } = run(trapLevel, [M, M, P, M, M, P, M, P, C]));
assert.equal(result.verdict, 'easterEgg');
assert.equal(result.failure, '양말');
assert.equal(result.total, 60);
assert.equal(result.rows[2].item, '양말');
assert.equal(result.rows[2].pts, -20);

// 목록 밖의 엉뚱한 물건은 각자 다른 실패 엔딩으로 즉시 끝난다.
assert.deepEqual(Object.keys(FAILURES).sort(), ['양말', '축구공', '로봇'].sort());
assert.equal(new Set(Object.values(FAILURES).map(failure => failure.id)).size, 3);
assert.equal(new Set(Object.values(FAILURES).map(failure => failure.title)).size, 3);
for (const [item, failure] of Object.entries(FAILURES)) {
  assert.equal(failure.emoji, ITEMS[item].emoji);
  assert(failure.title && failure.message && failure.caption);
  const level = { shoppingList: ['딸기'], map: [['S', item, '딸기']] };
  ({ engine, events, result } = run(level, [M, P, P, M, P, C]));
  assert.deepEqual(events, [
    { type: 'move' },
    { type: 'pick', item, row: 0, col: 1, failure: item }
  ]);
  assert.equal(events.filter(event => event.failure).length, 1);
  assert.equal(engine.failure, item);
  assert(engine.ended);
  assert(!engine.checkedOut);
  assert(!engine.overflow);
  assert.equal(engine.actions, 2);
  assert.equal(engine.c, 1);
  assert.deepEqual(engine.collected, [item]);
  assert(engine.pickedAt(0, 1));
  assert.equal(result.failure, item);
  assert.equal(result.verdict, 'easterEgg');
  assert.equal(result.perfect, false);
  assert.equal(result.total, -20);
  assert.equal(result.rows[0].verdict, '목록에 없음');
  assert.equal(result.rows[0].pts, -20);

  // 반복과 조건 안에서 집어도 남은 반복, 바깥 이동, 계산은 모두 중단한다.
  ({ engine, events, result } = run(level, [M, repeat(3, [
    when('NOWALL', [repeat(2, [P, M])]), C
  ]), M, P, C]));
  assert.deepEqual(events.map(event => event.type), ['move', 'repeat', 'if', 'repeat', 'pick']);
  assert.equal(engine.actions, 2);
  assert.equal(engine.c, 1);
  assert.equal(engine.failure, item);
  assert(!engine.checkedOut);
  assert.equal(result.verdict, 'easterEgg');

  // 다시 실행하면 엔딩 상태가 지워지고, 물건을 지나가기만 하면 안전하다.
  const sameMap = engine.map;
  engine.reset();
  assert.equal(engine.failure, null);
  assert.equal(engine.map, sameMap);
  assert(!engine.ended);
  assert(!engine.pickedAt(0, 1));
  assert.deepEqual(engine.collected, []);
  assert.equal(score(engine).failure, null);
  assert.equal(score(engine).verdict, 'unfinished');
  events = Array.from(interpret([M, M, P, C], engine), step => step.ev);
  assert(!events.some(event => event.failure));
  assert.deepEqual(engine.collected, ['딸기']);
  assert.equal(engine.failure, null);
  assert.equal(score(engine).verdict, 'perfect');
  assert.equal(score(engine).total, 50);

  engine.reset();
  events = Array.from(interpret([M, P, C], engine), step => step.ev);
  assert.equal(events.filter(event => event.failure === item).length, 1);
  assert.equal(score(engine).verdict, 'easterEgg');

  // 지도가 물건을 심부름 목록에 지정한 경우에는 평범한 목표로 처리한다.
  ({ engine, events, result } = run({ shoppingList: [item], map: [['S', item]] }, [M, P, C]));
  assert.equal(events[1].failure, undefined);
  assert.equal(engine.failure, null);
  assert(engine.checkedOut);
  assert.equal(result.failure, null);
  assert.equal(result.verdict, 'perfect');
  assert.equal(result.total, 50);
}

// 다른 오답과 함정 감점이 있어도 실패 엔딩이 결과의 우선 사유가 된다.
const mixedFailure = { shoppingList: ['딸기'], map: [['S', '물웅덩이', '바나나', '로봇', '딸기']] };
({ engine, result } = run(mixedFailure, [M, M, P, M, P, M, P, C]));
assert.equal(result.verdict, 'easterEgg');
assert.equal(result.failure, '로봇');
assert.equal(result.total, -50);
assert.equal(result.traps, 1);
assert.equal(result.trapPenalty, 10);
assert.deepEqual(result.rows.map(row => row.pts), [-20, -20]);
assert(!engine.checkedOut);
assert.deepEqual(engine.collected, ['바나나', '로봇']);

const duplicateLevel = { shoppingList: ['딸기', '브로콜리'], map: [['S', '딸기', '딸기', '브로콜리']] };
({ result } = run(duplicateLevel, [M, P, M, P, M, P, C]));
assert.equal(result.total, 80);
assert.equal(result.rows[1].verdict, '이미 담았어요');

// 지나치게 긴 중첩 반복은 중단되고 계산 전 상태를 유지한다.
({ engine, result } = run(low, [repeat(20, [repeat(20, [repeat(20, [M])])]), C]));
assert(engine.overflow);
assert(engine.ended);
assert.equal(result.verdict, 'unfinished');

function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const key = cell => cell.join(',');
function walkableNeighbors(map, cell, avoidTraps = false) {
  return directions.map(dir => [cell[0] + dir[0], cell[1] + dir[1]])
    .filter(([r, c]) => map[r]?.[c] !== undefined && map[r][c] !== '#' && (!avoidTraps || !HAZARDS[map[r][c]]));
}
function paths(map, start, avoidTraps = false) {
  const found = new Map([[key(start), [start]]]), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const next of walkableNeighbors(map, queue[i], avoidTraps)) {
      if (found.has(key(next))) continue;
      found.set(key(next), [...found.get(key(queue[i])), next]);
      queue.push(next);
    }
  }
  return found;
}
function turnCount(path) {
  let facing = 1, turns = 0;
  for (let i = 1; i < path.length; i++) {
    const direction = directions.findIndex(([dr, dc]) => dr === path[i][0] - path[i - 1][0] && dc === path[i][1] - path[i - 1][1]);
    const change = (direction - facing + 4) % 4;
    turns += Math.min(change, 4 - change);
    facing = direction;
  }
  return turns;
}
function minimumTour(map, targets) {
  const fromStart = paths(map, [0, 0]), fromTargets = targets.map(target => paths(map, target));
  let moves = Infinity, turns = Infinity;
  function visit(remaining, last, route) {
    if (!remaining.length) {
      moves = Math.min(moves, route.length - 1);
      turns = Math.min(turns, turnCount(route));
      return;
    }
    for (const next of remaining) {
      const leg = (last === null ? fromStart : fromTargets[last]).get(key(targets[next]));
      visit(remaining.filter(index => index !== next), next, route.concat(leg.slice(1)));
    }
  }
  visit(targets.map((_, index) => index), null, [[0, 0]]);
  return { moves, turns };
}
function hasBeginnerRoute(map, targets) {
  const remaining = new Set(targets.map(key));
  function visit(row, col, facing, steps, turns) {
    if (steps > 12 || turns > 4) return false;
    const here = key([row, col]), collected = remaining.delete(here);
    const solved = remaining.size === 0 || directions.some(([dr, dc], direction) => {
      const r = row + dr, c = col + dc, cell = map[r]?.[c];
      if (!cell || cell === '#' || HAZARDS[cell]) return false;
      const change = (direction - facing + 4) % 4;
      return visit(r, c, direction, steps + 1, turns + Math.min(change, 4 - change));
    });
    if (collected) remaining.add(here);
    return solved;
  }
  return visit(0, 0, 1, 0, 0);
}
function solveSafely(level) {
  let at = [0, 0], facing = 1;
  const program = [];
  for (const item of level.shoppingList) {
    const r = level.map.findIndex(row => row.includes(item)), target = [r, level.map[r].indexOf(item)];
    const path = paths(level.map, at, true).get(key(target));
    assert(path, '두 목표는 함정을 밟지 않고 도달할 수 있어야 한다.');
    for (let i = 1; i < path.length; i++) {
      const direction = directions.findIndex(([dr, dc]) => dr === path[i][0] - path[i - 1][0] && dc === path[i][1] - path[i - 1][1]);
      const change = (direction - facing + 4) % 4;
      if (change === 3) program.push(L);
      else for (let t = 0; t < change; t++) program.push(R);
      program.push(M);
      facing = direction;
    }
    at = target;
    program.push(P);
  }
  program.push(C);
  return run(level, program);
}

// 난수 지도를 여러 시드로 검증한다. 저학년도 회전과 갈림길 선택이 필요하고,
// 고학년은 이동 거리와 회전 수가 더 많다. 모든 물건과 함정은 연결된 지도 안에 있다.
for (const metadata of LEVELS) {
  const fingerprints = new Set(), topologies = new Set();
  const hard = metadata.id === 2;
  for (let seed = 1; seed <= 160; seed++) {
    const level = generateLevel(metadata, rng(seed));
    assert.equal(level.id, metadata.id);
    assert.equal(level.map.length, hard ? 8 : 5);
    assert(level.map.every(row => row.length === level.map.length));
    assert.equal(level.map[0][0], 'S');
    assert.notEqual(level.map[0][1], '#');
    const cells = level.map.flat(), fromStart = paths(level.map, [0, 0]);
    assert.equal(cells.filter(cell => cell === 'S').length, 1);
    assert.equal(fromStart.size, cells.filter(cell => cell !== '#').length);
    assert(cells.every(cell => ['S', '.', '#'].includes(cell) || ITEMS[cell] || HAZARDS[cell]));
    assert.equal(cells.filter(cell => HAZARDS[cell]).length, hard ? 3 : 1);
    assert.equal(cells.filter(cell => ['양말', '축구공', '로봇'].includes(cell)).length, hard ? 3 : 1);
    assert.equal(cells.filter(cell => ['사과', '바나나', '당근'].includes(cell)).length, hard ? 3 : 1);
    assert.equal(level.shoppingList.length, hard ? 5 : 3);
    const targets = level.shoppingList.map(item => {
      assert.equal(cells.filter(cell => cell === item).length, 1);
      const r = level.map.findIndex(row => row.includes(item));
      return [r, level.map[r].indexOf(item)];
    });
    if (hard) {
      assert(targets.every(target => fromStart.get(key(target)).length - 1 >= 8));
      const minimum = minimumTour(level.map, targets);
      assert(minimum.moves >= 28);
      assert(minimum.turns >= 10);
    } else {
      assert.equal(cells.filter(cell => cell === '#').length, 6);
      assert(hasBeginnerRoute(level.map, targets), '함정을 피해 12칸, 회전 4번 이내로 장보기를 끝낼 수 있어야 한다.');
    }
    const branchCount = Array.from(fromStart.values()).filter(path => walkableNeighbors(level.map, path.at(-1)).length >= 3).length;
    assert(branchCount >= (hard ? 4 : 2));
    const solved = solveSafely(level);
    assert.equal(solved.result.verdict, 'perfect');
    assert.equal(solved.result.total, level.shoppingList.length * 50);
    assert.equal(solved.result.max, level.shoppingList.length * 50);
    assert.equal(solved.engine.bumps, 0);
    assert.equal(solved.engine.trapHits, 0);
    solved.engine.reset();
    assert.deepEqual(solved.engine.map, level.map, '다시 실행할 때 지도는 유지된다.');
    fingerprints.add(JSON.stringify(level.map));
    topologies.add(level.map.map(row => row.map(cell => cell === '#' ? '#' : '.').join('')).join('/'));
  }
  assert(fingerprints.size >= 150, '물건 배치가 충분히 다양해야 한다.');
  assert(topologies.size >= (hard ? 140 : 15), '미로의 길 자체도 달라져야 한다.');
  assert.deepEqual(generateLevel(metadata.id, rng(42)), generateLevel(metadata, rng(42)), '같은 시드로 같은 지도를 재현한다.');
  // 극단적인 난수 함수에서도 생성이 종료되고 안전한 지도가 나온다.
  assert.equal(solveSafely(generateLevel(metadata, () => 0)).result.verdict, 'perfect');
  assert.equal(solveSafely(generateLevel(metadata, () => 0.999999)).result.verdict, 'perfect');
}

const independentA = generateLevel(1, rng(19)), independentB = generateLevel(1, rng(19));
independentA.map[0][0] = '#';
independentA.shoppingList.pop();
independentA.starter.blocks.blocks[0].type = 'changed';
assert.equal(independentB.map[0][0], 'S');
assert.deepEqual(independentB.shoppingList, ['딸기', '브로콜리', '사과']);
assert.equal(independentB.starter.blocks.blocks[0].type, 'nau_start');
assert.equal(independentB.starter.blocks.blocks[0].next.block.type, 'nau_move');
assert.equal(LEVELS[0].starter.blocks.blocks[0].type, 'nau_start');
assert.throws(() => generateLevel(99), RangeError);
assert.throws(() => generateLevel(1, 'seed'), TypeError);

console.log('ALL OK — 엔진 규칙, 함정, 세 가지 실패 엔딩, 두 난이도 × 160개 무작위 지도');
