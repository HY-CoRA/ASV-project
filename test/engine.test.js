const E = require('../js/engine.js');
const M = o => ({ op: 'move' }), L = () => ({ op: 'left' }), R = () => ({ op: 'right' }), P = () => ({ op: 'pick' });
const REP = (n, body) => ({ op: 'repeat', n, body });
const IF = (cond, body) => ({ op: 'if', cond, body });

function run(prog) {
  const eng = new E.Engine();
  for (const _ of E.interpret(prog, eng)) {}
  return { eng, res: E.score(eng), blocks: E.countBlocks(prog) };
}

// 1) 조건문 활용 풀이 (빵/생크림 집었다면 으로 왕복 경로 분기)
const shuttle = [R(), R(), REP(2, [M()]),
  IF('GOT_BREAD', [L()]), IF('GOT_CREAM', [R()]), REP(2, [M()]),
  IF('GOT_BREAD', [L()]), IF('GOT_CREAM', [R()]), REP(2, [M()]), P()];
const clever = [
  R(), REP(4, [M()]), L(), REP(3, [M()]), L(), REP(2, [M()]), P(),   // (2,3)N 빵
  REP(3, shuttle),                                                    // 생크림, 빵, 생크림 → (2,5)N
  M(), P(),                                                           // (1,5)N 딸기
  R(), R(), M(), L(), REP(2, [M()]), L(), M(), P()                    // (1,7)N 초
];
let t = run(clever);
console.log('clever:', t.eng.cake.join(','), 'score', t.res.total, t.res.verdict, 'blocks', t.blocks, 'actions', t.eng.actions, 'title', E.rankTitle(t.res, t.blocks));
console.assert(t.res.verdict === 'perfect' && t.res.total === 300, 'clever should be perfect 300');

// 2) 순서 오류: 빵, 빵
t = run([REP(3, [M()]), R(), P(), P()]);
console.log('bread x2:', t.eng.cake.join(','), t.res.total, t.res.verdict, t.res.rows.map(r => r.pts).join(','));
console.assert(t.res.total === 40 && t.res.verdict === 'weird');

// 3) 빈손
t = run([REP(3, [M()])]);
console.log('empty:', t.res.total, t.res.verdict);
console.assert(t.res.total === 0 && t.res.verdict === 'empty');

// 4) 다이너마이트: (2,7)에서 북쪽 보고 집기
t = run([R(), REP(4, [M()]), L(), REP(7, [M()]), L(), REP(2, [M()]), P(), M(), M()]);
console.log('boom:', t.eng.cake.join(','), t.res.total, t.res.verdict, 'ended', t.eng.ended, 'pos', t.eng.r, t.eng.c);
console.assert(t.res.verdict === 'boom' && t.res.total === -100 && t.eng.r === 2 && t.eng.c === 7);

// 5) 벽 부딪힘 + 조건
t = run([REP(10, [IF('NOWALL', [M()])]), P()]);
console.log('wall-follow:', 'pos', t.eng.r, t.eng.c, 'bumps', t.eng.bumps, 'cake', t.eng.cake.join(','));
console.assert(t.eng.r === 0 && t.eng.c === 5 && t.eng.bumps === 0, 'should walk over strawberry cell to (0,5)');

// 6) 계산대 도착으로 종료
t = run([R(), REP(4, [M()]), L(), REP(7, [M()]), R(), M(), R(), REP(2, [M()]), L(), REP(2, [M()]), L(), REP(2, [M()]), P(), P()]);
console.log('checkout:', 'pos', t.eng.r, t.eng.c, 'checkedOut', t.eng.checkedOut, 'cake', t.eng.cake.length);
console.assert(t.eng.checkedOut && t.eng.cake.length === 0);

// 7) 폭주 방지
t = run([REP(20, [REP(20, [REP(20, [L()])])])]);
console.log('overflow:', t.eng.overflow, t.eng.yields);
console.assert(t.eng.overflow);

// 8) 정렬
const arr = [{ score: 300, blocks: 60, actions: 90 }, { score: 300, blocks: 41, actions: 95 }, { score: 180, blocks: 10, actions: 5 }];
console.log('sort:', arr.sort(E.compareEntries).map(e => e.blocks).join(','));
console.log('ALL OK');
