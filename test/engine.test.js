const assert = require('node:assert/strict');
const { Engine, ITEMS, LEVELS, interpret, score, compareEntries, levelById } = require('../js/engine.js');

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

const [low, high] = LEVELS;
assert.equal(LEVELS.length, 2);
assert.equal(levelById('1'), low);
assert.equal(levelById('2'), high);
assert.equal(levelById('3'), null);
assert.deepEqual(low.map.flat().filter(cell => ITEMS[cell]), ['딸기', '브로콜리']);
assert.deepEqual(high.map.flat().filter(cell => ITEMS[cell] && !high.shoppingList.includes(cell)), ['사과', '바나나', '당근']);
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
  { score: 80, blocks: 1, actions: 1 },
  { score: 100, blocks: 4, actions: 10 },
  { score: 100, blocks: 3, actions: 15 },
  { score: 100, blocks: 3, actions: 12 }
];
assert.deepEqual(entries.slice().sort(compareEntries), [entries[3], entries[2], entries[1], entries[0]]);

console.log('ALL OK');
