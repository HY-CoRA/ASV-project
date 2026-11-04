const assert = require('node:assert/strict');
const { Engine, ITEMS, INGREDIENTS, HAZARDS, FAILURES, LEVELS, interpret, score, compareEntries, levelById, generateLevel } = require('../js/engine.js');

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
assert(INGREDIENTS.length >= 16);
assert.equal(new Set(INGREDIENTS).size, INGREDIENTS.length);
assert(Object.keys(HAZARDS).length >= 8);
assert(Object.keys(FAILURES).length >= 10);
assert.equal(Object.keys(ITEMS).length, INGREDIENTS.length + Object.keys(FAILURES).length);
for (const item of INGREDIENTS) {
  assert(ITEMS[item]?.emoji && ITEMS[item].label);
  assert(!FAILURES[item], '재료는 실패 이벤트 물건과 겹치지 않는다.');
  assert(!HAZARDS[item], '재료는 함정과 겹치지 않는다.');
}
for (const [item, hazard] of Object.entries(HAZARDS)) {
  assert(hazard.emoji && hazard.label);
  assert.equal(hazard.penalty, 10);
  assert(['slip', 'sticky', 'bump'].includes(hazard.motion));
  assert(!ITEMS[item], '함정은 집을 수 있는 물건과 겹치지 않는다.');
}
for (const item of Object.keys(FAILURES)) assert(ITEMS[item], '실패 물건에도 지도에 표시할 정보가 있다.');
for (const metadata of LEVELS) {
  assert.equal(metadata.targetCount, metadata.id === 1 ? 3 : 5);
  assert.equal(metadata.shoppingList.length, metadata.targetCount);
  assert.equal(new Set(metadata.shoppingList).size, metadata.targetCount);
  assert.deepEqual(metadata.map.flat().filter(cell => INGREDIENTS.includes(cell)).sort(), metadata.shoppingList.slice().sort(),
    '대표 지도의 재료와 심부름 목록이 일치한다.');
}

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

// 새 함정도 모두 같은 감점 규칙을 지키고, 재진입과 다시 실행을 구분한다.
for (const hazard of Object.keys(HAZARDS)) {
  engine = new Engine({ shoppingList: ['딸기'], map: [['S', hazard, '딸기']] });
  assert.deepEqual(engine.move(), { type: 'trap', hazard, row: 0, col: 1, penalty: 10 });
  assert.deepEqual(engine.pick(), { type: 'pickNothing' });
  engine.turn('R'); engine.turn('R'); engine.move();
  engine.turn('R'); engine.turn('R');
  assert.deepEqual(engine.move(), { type: 'move' });
  assert.equal(engine.trapHits, 1);
  assert.equal(engine.trapPenalty, 10);
  engine.move(); engine.pick(); engine.checkout();
  assert.equal(score(engine).verdict, 'trapped');
  assert.equal(score(engine).total, 40);
  engine.reset();
  assert.equal(engine.triggeredTraps.size, 0);
  assert.equal(engine.trapHits, 0);
  assert.equal(engine.trapPenalty, 0);
  assert.equal(engine.move().type, 'trap');
  assert.equal(engine.trapPenalty, 10);
}

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
assert.equal(new Set(Object.values(FAILURES).map(failure => failure.id)).size, Object.keys(FAILURES).length);
assert.equal(new Set(Object.values(FAILURES).map(failure => failure.title)).size, Object.keys(FAILURES).length);
for (const [item, failure] of Object.entries(FAILURES)) {
  assert.equal(failure.emoji, ITEMS[item].emoji);
  assert(failure.title && failure.message && failure.caption);
  assert.equal(failure.props.length, 3);
  assert(failure.props.every(prop => typeof prop === 'string' && prop));
  assert(failure.notes.every(note => Number.isFinite(note) && note > 0));
  assert(failure.notes.length >= 3);
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
function safeTourMetrics(map, targets) {
  const safePaths = paths(map, [0, 0], true);
  const graph = new Map(Array.from(safePaths, ([cell, path]) =>
    [cell, walkableNeighbors(map, path.at(-1), true).map(key)]));
  const targetKeys = targets.map(key), targetBits = new Map(targetKeys.map((cell, i) => [cell, 1 << i]));
  const fullMask = (1 << targets.length) - 1;
  const queue = [['0,0', 0, 0]], visited = new Set(['0,0|0']);
  let moves = Infinity;
  // 모든 목표를 방문한 가장 짧은 안전 경로. 계산은 어느 칸에서나 가능하다.
  for (let i = 0; i < queue.length; i++) {
    const [cell, mask, distance] = queue[i];
    if (mask === fullMask) { moves = distance; break; }
    for (const next of graph.get(cell)) {
      const nextMask = mask | (targetBits.get(next) || 0), state = next + '|' + nextMask;
      if (!visited.has(state)) {
        visited.add(state);
        queue.push([next, nextMask, distance + 1]);
      }
    }
  }
  const edgeKey = (a, b) => [a, b].sort().join('|');
  const edges = Array.from(graph).flatMap(([a, neighbors]) => neighbors.filter(b => a < b).map(b => [a, b]));
  const bridges = new Set(), requiredBridges = [];
  for (const [a, b] of edges) {
    const reached = new Set(['0,0']), pending = ['0,0'];
    for (let i = 0; i < pending.length; i++) {
      for (const next of graph.get(pending[i])) {
        if ((pending[i] === a && next === b) || (pending[i] === b && next === a) || reached.has(next)) continue;
        reached.add(next);
        pending.push(next);
      }
    }
    if (reached.size === graph.size) continue;
    bridges.add(edgeKey(a, b));
    const behind = new Set(targetKeys.filter(cell => !reached.has(cell)));
    if (behind.size) requiredBridges.push(behind);
  }
  // 마지막 목표로 가는 다리는 편도면 된다. 나머지 필수 다리만 왕복을 강제한다.
  const finalLegBridges = Math.max(...targetKeys.map(cell => requiredBridges.filter(behind => behind.has(cell)).length));
  return {
    moves,
    cycles: edges.length - graph.size + 1,
    targetsOnCycles: targetKeys.filter(cell =>
      graph.has(cell) && graph.get(cell).filter(next => !bridges.has(edgeKey(cell, next))).length >= 2).length,
    mandatoryRetraces: requiredBridges.length - finalLegBridges,
    safePaths
  };
}
function solveSafely(level) {
  let at = [0, 0], facing = 1;
  const program = [];
  for (const item of level.shoppingList) {
    const r = level.map.findIndex(row => row.includes(item)), target = [r, level.map[r].indexOf(item)];
    const path = paths(level.map, at, true).get(key(target));
    assert(path, '모든 목표는 함정을 밟지 않고 도달할 수 있어야 한다.');
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

// 생성기의 경로 판정과 별개로 칸·방향·수집 목록을 모두 탐색한다.
// 최소 명령 수가 같은 경로에서는 90도 회전을 더 적게 하는 경로를 고른다.
function optimalSafeCommands(level) {
  const rows = level.map.length, cols = level.map[0].length, cells = rows * cols;
  const fullMask = (1 << level.shoppingList.length) - 1, stateCount = cells * 4 * (fullMask + 1);
  const turnBase = stateCount + 1, targetBits = new Int32Array(cells);
  let startCell = -1;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const value = level.map[r][c], item = level.shoppingList.indexOf(value);
    if (value === 'S') startCell = r * cols + c;
    if (item !== -1) targetBits[r * cols + c] = 1 << item;
  }
  assert.notEqual(startCell, -1);
  const stateId = (cell, direction, mask) => (mask * cells + cell) * 4 + direction;
  const costs = new Float64Array(stateCount), previous = new Int32Array(stateCount), operations = new Uint8Array(stateCount);
  costs.fill(Infinity); previous.fill(-1);
  const heap = [];
  function push(entry) {
    let i = heap.length; heap.push(entry);
    while (i) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= entry[0]) break;
      heap[i] = heap[parent]; i = parent;
    }
    heap[i] = entry;
  }
  function pop() {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1][0] < heap[child][0]) child++;
        if (last[0] <= heap[child][0]) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return first;
  }
  const initial = stateId(startCell, 1, targetBits[startCell]);
  costs[initial] = 0; push([0, initial]);
  while (heap.length) {
    const [cost, state] = pop();
    if (cost !== costs[state]) continue;
    const direction = state % 4, cell = Math.floor(state / 4) % cells, mask = Math.floor(state / 4 / cells);
    if (mask === fullMask) {
      const steps = [];
      for (let cursor = state; previous[cursor] !== -1; cursor = previous[cursor]) {
        steps.push([operations[cursor], Math.floor(cursor / 4) % cells]);
      }
      steps.reverse();
      const program = [];
      let collected = 0;
      for (const [operation, at] of steps) {
        program.push(operation === 1 ? L : operation === 2 ? R : M);
        if (targetBits[at] && !(collected & targetBits[at])) {
          program.push(P); collected |= targetBits[at];
        }
      }
      program.push(C);
      const commands = Math.floor(cost / turnBase), turns = cost % turnBase;
      return { moves: commands - turns, turns, commands, program };
    }
    const next = [[cell, (direction + 3) % 4, mask, 1], [cell, (direction + 1) % 4, mask, 2]];
    const r = Math.floor(cell / cols) + directions[direction][0], c = cell % cols + directions[direction][1];
    const value = level.map[r]?.[c];
    if (value !== undefined && value !== '#' && !HAZARDS[value]) {
      const at = r * cols + c;
      next.push([at, direction, mask | targetBits[at], 3]);
    }
    for (const [at, facing, collected, operation] of next) {
      const id = stateId(at, facing, collected), nextCost = cost + turnBase + (operation === 3 ? 0 : 1);
      if (nextCost >= costs[id]) continue;
      costs[id] = nextCost; previous[id] = state; operations[id] = operation;
      push([nextCost, id]);
    }
  }
  assert.fail('모든 재료를 방문하는 안전한 명령 경로가 있어야 한다.');
}
function assertBalancedEffort(level, label) {
  const hard = level.id === 2, effort = optimalSafeCommands(level);
  const within = (value, min, max, what) => assert(value >= min && value <= max,
    label + ': ' + what + ' ' + value + '은 ' + min + '–' + max + ' 범위여야 한다.');
  within(effort.moves, hard ? 20 : 9, hard ? 22 : 10, '최소 명령 경로의 이동');
  within(effort.turns, hard ? 6 : 3, hard ? 7 : 4, '최소 명령 경로의 회전');
  within(effort.commands, hard ? 26 : 12, hard ? 28 : 14, '이동과 회전 명령');
  assert.equal(effort.program.filter(node => node.op === 'move').length, effort.moves);
  assert.equal(effort.program.filter(node => node.op === 'left' || node.op === 'right').length, effort.turns);
  const solved = run(level, effort.program);
  assert.equal(solved.result.verdict, 'perfect', label + ': 최적 경로를 실제로 실행해서 만점으로 종료한다.');
  assert.equal(solved.result.total, level.shoppingList.length * 50);
  assert.equal(solved.engine.bumps, 0);
  assert.equal(solved.engine.trapHits, 0);
  assert.equal(solved.engine.actions, effort.commands + level.shoppingList.length + 1);
  within(solved.engine.actions, hard ? 32 : 16, hard ? 34 : 18, '집기와 종료를 포함한 실행');
  return effort;
}

// 난수 지도를 여러 시드로 검증한다. 난이도별 목표의 간격은 유지하되,
// 안전한 연결 길로 장보기를 짧게 끝내고 막다른 길의 의무적인 왕복은 피한다.
const metadataSnapshot = structuredClone(LEVELS), ingredientSnapshot = INGREDIENTS.slice();
for (const metadata of LEVELS) {
  const fingerprints = new Set(), topologies = new Set(), lists = new Set();
  const seenFoods = new Set(), seenHazards = new Set(), seenFailures = new Set();
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
    assert.equal(cells.filter(cell => FAILURES[cell]).length, hard ? 3 : 1);
    assert.equal(new Set(cells.filter(cell => HAZARDS[cell])).size, hard ? 3 : 1);
    assert.equal(new Set(cells.filter(cell => FAILURES[cell])).size, hard ? 3 : 1);
    assert.equal(level.shoppingList.length, hard ? 5 : 3);
    assert.equal(new Set(level.shoppingList).size, level.shoppingList.length);
    assert(level.shoppingList.every(item => INGREDIENTS.includes(item)));
    assert.deepEqual(cells.filter(cell => INGREDIENTS.includes(cell)).sort(), level.shoppingList.slice().sort(),
      '지도에는 심부름 목록의 재료만 각각 한 번 나온다.');
    const targets = level.shoppingList.map(item => {
      assert.equal(cells.filter(cell => cell === item).length, 1);
      const r = level.map.findIndex(row => row.includes(item));
      return [r, level.map[r].indexOf(item)];
    });
    const safe = safeTourMetrics(level.map, targets), label = metadata.name + ' 시드 ' + seed;
    assert(safe.moves <= (hard ? 24 : 12), label + ': 함정 없이 장보기를 짧게 끝낼 수 있어야 한다.');
    assert(safe.moves >= (hard ? 20 : 9) && safe.moves <= (hard ? 22 : 10),
      label + ': 회전을 무시한 최단 이동 거리도 같은 난이도 범위를 지켜야 한다.');
    assertBalancedEffort(level, label);
    assert(safe.cycles >= (hard ? 4 : 2), label + ': 함정을 피하는 연결 길이 여러 개 있어야 한다.');
    assert.equal(safe.targetsOnCycles, targets.length, label + ': 모든 목표에 돌아 나올 수 있는 안전한 길이 있어야 한다.');
    assert.equal(safe.mandatoryRetraces, 0, label + ': 재료를 얻기 위해 같은 막힌 길을 반드시 왕복해서는 안 된다.');
    assert(targets.every(target => safe.safePaths.get(key(target))?.length - 1 >= (hard ? 4 : 2)),
      label + ': 목표가 입구 바로 앞에만 몰려서는 안 된다.');
    const separations = targets.flatMap((target, i) => {
      const fromTarget = paths(level.map, target, true);
      return targets.slice(i + 1).map(next => fromTarget.get(key(next)).length - 1);
    });
    assert(Math.min(...separations) >= (hard ? 3 : 2), label + ': 목표끼리 적당히 떨어져 있어야 한다.');
    assert(Math.max(...separations) >= (hard ? 7 : 4), label + ': 갈림길을 살펴볼 만큼 목표가 퍼져 있어야 한다.');
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
    lists.add(level.shoppingList.slice().sort().join('/'));
    cells.forEach(cell => {
      if (INGREDIENTS.includes(cell)) seenFoods.add(cell);
      else if (HAZARDS[cell]) seenHazards.add(cell);
      else if (FAILURES[cell]) seenFailures.add(cell);
    });
  }
  assert(fingerprints.size >= 158, '균형 검사 후에도 같은 대체 지도에 몰리지 않고 물건 배치가 다양해야 한다.');
  assert(topologies.size >= (hard ? 140 : 80), '미로의 길 자체도 달라져야 한다.');
  assert(lists.size >= 80, '새 맵에서는 재료 조합도 다양하게 바뀌어야 한다.');
  assert.deepEqual([...seenFoods].sort(), INGREDIENTS.slice().sort(), '두 난이도에서 모든 재료가 나올 수 있어야 한다.');
  assert.deepEqual([...seenHazards].sort(), Object.keys(HAZARDS).sort(), '두 난이도에서 모든 함정이 나올 수 있어야 한다.');
  assert.deepEqual([...seenFailures].sort(), Object.keys(FAILURES).sort(), '두 난이도에서 모든 실패 물건이 나올 수 있어야 한다.');
  assert.deepEqual(generateLevel(metadata.id, rng(42)), generateLevel(metadata, rng(42)), '같은 시드로 같은 지도를 재현한다.');
  // 극단적인 난수 함수에서도 생성이 종료되고 안전한 지도가 나온다.
  assert.equal(solveSafely(generateLevel(metadata, () => 0)).result.verdict, 'perfect');
  assert.equal(solveSafely(generateLevel(metadata, () => 0.999999)).result.verdict, 'perfect');
  for (const [name, random] of [
    ['0 시드', rng(0)], ['최대 32비트 시드', rng(0xffffffff)],
    ['상수 0', () => 0], ['최소 양수', () => Number.EPSILON],
    ['상수 0.999999', () => 0.999999], ['상수 1', () => 1],
    ['경계 교대', (() => { let next = 0; return () => (next ^= 1); })()]
  ]) {
    const level = generateLevel(metadata, random), label = metadata.name + ' ' + name;
    const targets = level.shoppingList.map(item => {
      const r = level.map.findIndex(row => row.includes(item));
      return [r, level.map[r].indexOf(item)];
    });
    const moves = safeTourMetrics(level.map, targets).moves;
    assert(moves >= (hard ? 20 : 9) && moves <= (hard ? 22 : 10), label + ': 극단 난수에서도 최단 이동 범위를 유지한다.');
    assertBalancedEffort(level, label);
  }
}
assert.deepEqual(LEVELS, metadataSnapshot, '지도 생성이 대표 지도와 난이도 정보를 바꾸지 않는다.');
assert.deepEqual(INGREDIENTS, ingredientSnapshot, '재료를 무작위로 고를 때 원본 재료 목록을 바꾸지 않는다.');

const independentA = generateLevel(1, rng(19)), independentB = generateLevel(1, rng(19));
const independentSnapshot = structuredClone(independentB);
independentA.map[0][0] = '#';
independentA.shoppingList.pop();
independentA.starter.blocks.blocks[0].type = 'changed';
assert.deepEqual(independentB, independentSnapshot, '지도, 목록, 시작 블록은 다른 맵과 객체를 공유하지 않는다.');
assert.equal(independentB.starter.blocks.blocks[0].next.block.type, 'nau_move');
assert.equal(LEVELS[0].starter.blocks.blocks[0].type, 'nau_start');
assert.throws(() => generateLevel(99), RangeError);
assert.throws(() => generateLevel(1, 'seed'), TypeError);

console.log('ALL OK — 엔진 규칙, 모든 함정·실패 엔딩, 무작위 재료, 두 난이도 × 160개 지도, 독립 최적 명령 경로와 난수 경계의 균등 난이도');
