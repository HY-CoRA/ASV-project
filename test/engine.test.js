const E = require('../js/engine.js');
const M = () => ({ op: 'move' }), L = () => ({ op: 'left' }), R = () => ({ op: 'right' }), P = () => ({ op: 'pick' });
const REP = (n, body) => ({ op: 'repeat', n, body }), IF = (cond, body) => ({ op: 'if', cond, body });
function run(level, prog) { const eng = new E.Engine(level); for (const _ of E.interpret(prog, eng)) {} return { eng, res: E.score(eng), blocks: E.countBlocks(prog) }; }

// BFS 최단 동작 수 (선반 통과 불가 규칙과 동일)
function solve(level) {
  const eng = new E.Engine(level), DIRS = E.DIRS, R = level.recipe;
  const key = s => s.join(','); const q = [[eng.sr, eng.sc, 1, 0]]; const prev = new Map([[key(q[0]), null]]);
  while (q.length) {
    const s = q.shift(); const [r, c, d, k] = s;
    if (k === R.length) { const a = []; let cur = key(s); while (prev.get(cur)) { const [p, x] = prev.get(cur); a.push(x); cur = p; } return a.reverse(); }
    const [dr, dc] = DIRS[d]; const fc = eng.cellAt(r + dr, c + dc); const nx = [];
    if (!eng.blocked(fc) && fc !== 'E') nx.push([[r + dr, c + dc, d, k], 'M']);
    nx.push([[r, c, (d + 3) % 4, k], 'L']); nx.push([[r, c, (d + 1) % 4, k], 'R']);
    if (E.ITEMS[fc] && E.ITEMS[fc].kind === R[k]) nx.push([[r, c, d, k + 1], 'P']);
    for (const [ns, a] of nx) { const nk = key(ns); if (!prev.has(nk)) { prev.set(nk, [key(s), a]); q.push(ns); } }
  }
  return null;
}
const [L1, L2, L3] = E.LEVELS;
for (const lv of E.LEVELS) {
  const a = solve(lv);
  console.assert(a, lv.name + ' 풀이 불가');
  console.log(`${lv.name}: 최소 동작 ${a.length} | 칭호 기준 ${lv.thresholds}`);
  console.assert(lv.thresholds[1] >= a.length - 2, '코더 기준이 최소 동작보다 많이 낮음');
}

// L1 손풀이: M R P L MM R P L MM R P (13) / 반복형 9블록
let t = run(L1, [M(), R(), P(), L(), M(), M(), R(), P(), L(), M(), M(), R(), P()]);
console.assert(t.res.verdict === 'perfect' && t.res.total === 150, 'L1 flat'); console.log('L1 flat', t.blocks, t.res.total);
t = run(L1, [M(), REP(2, [R(), P(), L(), M(), M()]), R(), P()]);
console.assert(t.res.verdict === 'perfect' && E.rankTitle(t.res, t.blocks, L1) === '알고리즘 장인', 'L1 loop'); console.log('L1 loop', t.blocks, E.rankTitle(t.res, t.blocks, L1));
// L1 한 칸 틀리면 양말
t = run(L1, [M(), M(), R(), P()]); console.assert(t.eng.cake[0] === '양말' && t.res.total === -20); console.log('L1 off-by-one →', t.eng.cake[0]);

// L2 반복형: 3×{2번 앞, 오른쪽, 집기, 왼쪽} + 앞 + 오른쪽 + 3×{2번 앞, 오른쪽, 집기, 왼쪽}
const seg = [REP(2, [M()]), R(), P(), L()];
t = run(L2, [REP(3, seg), M(), R(), REP(3, seg), M()]);
console.assert(t.res.verdict === 'perfect' && t.res.total === 300 && t.eng.checkedOut, 'L2 loop'); console.log('L2 loop', t.blocks, E.rankTitle(t.res, t.blocks, L2), 'checkout', t.eng.checkedOut);
// L2 반복 횟수 한 번 더 → 다이너마이트
t = run(L2, [REP(3, seg), M(), R(), REP(2, [M()]), R(), P(), L(), M(), R(), P()]);
console.assert(t.res.verdict === 'boom'); console.log('L2 off-by-one →', t.eng.cake.join(','), t.res.total);

// L3 손풀이 (왕복): 행0에서 빵(0,3)S, 생크림은 (2,5)N 로 내려가서, 초는 (0,6)E
const toBread = [R(), REP(4, [M()]), L(), REP(3, [M()]), L(), REP(2, [M()]), P()]; // (2,3)N 빵
const shuttle = [R(), R(), REP(2, [M()]), IF('GOT_BREAD', [L()]), IF('GOT_CREAM', [R()]), REP(2, [M()]), IF('GOT_BREAD', [L()]), IF('GOT_CREAM', [R()]), REP(2, [M()]), P()];
const toStraw = [R(), R(), REP(2, [M()]), R(), M(), L(), REP(4, [M()]), R(), M(), L(), P()]; // (2,5)N → (4,5) → (4,4)? ← 아래에서 검증
t = run(L3, toBread.concat([REP(3, shuttle)]));
console.assert(t.eng.cake.join(',') === '빵,생크림,빵,생크림', 'L3 shuttle'); console.log('L3 shuttle ok', t.eng.r, t.eng.c, t.eng.d);
const a3 = solve(L3); console.log('L3 최단:', a3.join(''));
// 선반 통과 불가 확인
t = run(L3, [REP(5, [M()])]); console.assert(t.eng.c === 4 && t.eng.bumps === 1, 'shelf blocks movement'); console.log('shelf solid ok, bumps', t.eng.bumps);
// 벽 조건: 선반 앞도 벽
t = run(L1, [IF('NOWALL', [M()]), IF('NOWALL', [M()]), R(), IF('WALL', [P()])]); console.assert(t.eng.cake[0] === '양말'); console.log('WALL cond includes shelf ok');
console.log('ALL OK');
