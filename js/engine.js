// ===== 병맛 효도 케이크 — 게임 엔진 (DOM 없음) =====
var NauEngine = (function () {
  'use strict';

  // 기획서 7번 맵 그대로. '#' = 선반(벽), '.' = 통로, 'S' = 입구, 'E' = 계산대
  var MAP = [
    ['S', '.', '.', '.', '.', '딸기', '#', '초'],
    ['.', '#', '#', '빵', '#', '생크림', '#', '다이너마이트'],
    ['.', '#', '.', '.', '#', '.', '.', '.'],
    ['.', '#', '.', '.', '#', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '생크림', '.', '#', '.', '.', '.'],
    ['.', '.', '#', '양말', '.', '다이아몬드', '#', '#'],
    ['벽돌', '빵', '#', '초콜릿', '.', '.', '.', 'E']
  ];

  var ITEMS = {
    '빵':        { emoji: '🍞', kind: 'bread',   label: '빵',        sound: 'bread' },
    '생크림':    { emoji: '🍦', kind: 'cream',   label: '생크림',    sound: 'cream' },
    '딸기':      { emoji: '🍓', kind: 'topping', label: '딸기',      sound: 'topping' },
    '초콜릿':    { emoji: '🍫', kind: 'topping', label: '초콜릿',    sound: 'topping' },
    '초':        { emoji: '🕯️', kind: 'deco',    label: '초',        sound: 'deco' },
    '양말':      { emoji: '🧦', kind: 'trap',    label: '냄새나는 양말', sound: 'sock' },
    '벽돌':      { emoji: '🧱', kind: 'trap',    label: '벽돌',      sound: 'brick' },
    '다이아몬드': { emoji: '💎', kind: 'trap',    label: '다이아몬드', sound: 'gem' },
    '다이너마이트': { emoji: '🧨', kind: 'boom',  label: '다이너마이트', sound: 'boom' }
  };

  // 레시피: 빵 → 생크림 → 빵 → 생크림 → 토핑 → 장식
  var RECIPE = ['bread', 'cream', 'bread', 'cream', 'topping', 'deco'];
  var RECIPE_LABEL = ['빵', '생크림', '빵', '생크림', '토핑', '장식(초)'];

  var DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // 북, 동, 남, 서
  var MAX_YIELDS = 600; // 무한 루프 방지용 상한 (반복 중첩 폭주 대비)

  function Engine() { this.reset(); }
  Engine.prototype.reset = function () {
    this.r = 0; this.c = 0; this.d = 1; // 입구에서 동쪽을 보고 시작
    this.cake = [];
    this.actions = 0;   // 실제로 수행한 동작 수(이동/회전/집기)
    this.yields = 0;
    this.bumps = 0;
    this.ended = false;
    this.exploded = false;
    this.checkedOut = false;
    this.overflow = false;
  };
  Engine.prototype.cellAt = function (r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return '#';
    return MAP[r][c];
  };
  Engine.prototype.front = function () {
    var dd = DIRS[this.d];
    return [this.r + dd[0], this.c + dd[1]];
  };
  Engine.prototype.move = function () {
    this.actions++;
    var f = this.front();
    var cell = this.cellAt(f[0], f[1]);
    if (cell === '#') { this.bumps++; return { type: 'bump' }; }
    this.r = f[0]; this.c = f[1];
    if (cell === 'E') { this.checkedOut = true; this.ended = true; return { type: 'checkout' }; }
    return { type: 'move', over: ITEMS[cell] ? cell : null };
  };
  Engine.prototype.turn = function (lr) {
    this.actions++;
    this.d = (this.d + (lr === 'L' ? 3 : 1)) % 4;
    return { type: 'turn', lr: lr };
  };
  Engine.prototype.pick = function () {
    this.actions++;
    var f = this.front();
    var cell = this.cellAt(f[0], f[1]);
    if (!ITEMS[cell]) return { type: 'pickNothing' };
    this.cake.push(cell);
    if (ITEMS[cell].kind === 'boom') { this.exploded = true; this.ended = true; return { type: 'boom', item: cell }; }
    return { type: 'pick', item: cell };
  };
  Engine.prototype.cond = function (k) {
    var f = this.front();
    var cell = this.cellAt(f[0], f[1]);
    var last = this.cake[this.cake.length - 1];
    switch (k) {
      case 'WALL': return cell === '#';
      case 'NOWALL': return cell !== '#';
      case 'GOT_BREAD': return last === '빵';
      case 'GOT_CREAM': return last === '생크림';
    }
    return false;
  };

  // AST 노드: {op:'move'|'left'|'right'|'pick'|'repeat'|'if', n?, cond?, body?, id?}
  function* interpret(seq, eng) {
    for (var i = 0; i < seq.length; i++) {
      var node = seq[i];
      if (eng.ended) return;
      if (++eng.yields > MAX_YIELDS) { eng.overflow = true; eng.ended = true; return; }
      switch (node.op) {
        case 'move':  yield { node: node, ev: eng.move() }; break;
        case 'left':  yield { node: node, ev: eng.turn('L') }; break;
        case 'right': yield { node: node, ev: eng.turn('R') }; break;
        case 'pick':  yield { node: node, ev: eng.pick() }; break;
        case 'repeat':
          yield { node: node, ev: { type: 'repeat', n: node.n } };
          for (var k = 0; k < node.n; k++) {
            if (eng.ended) return;
            yield* interpret(node.body || [], eng);
          }
          break;
        case 'if': {
          var ok = eng.cond(node.cond);
          yield { node: node, ev: { type: 'if', ok: ok, cond: node.cond } };
          if (ok) yield* interpret(node.body || [], eng);
          break;
        }
      }
    }
  }

  // 기획서 8번 점수표
  function score(eng) {
    var cake = eng.cake;
    var rows = [];
    var total = 0;
    var goodIdx = 0;
    var perfect = true;
    for (var i = 0; i < cake.length; i++) {
      var it = cake[i];
      var info = ITEMS[it];
      var row = { item: it, emoji: info.emoji, label: info.label };
      if (info.kind === 'boom') { row.verdict = '폭발'; row.pts = -100; perfect = false; }
      else if (info.kind === 'trap') { row.verdict = '이상한 재료'; row.pts = -20; perfect = false; }
      else {
        if (goodIdx < RECIPE.length && RECIPE[goodIdx] === info.kind) { row.verdict = '정상 (' + (goodIdx + 1) + '층 ' + RECIPE_LABEL[goodIdx] + ')'; row.pts = 50; }
        else { row.verdict = '순서 오류'; row.pts = -10; perfect = false; }
        goodIdx++;
      }
      total += row.pts;
      rows.push(row);
    }
    if (goodIdx !== RECIPE.length) perfect = false;
    var verdict;
    if (cake.length === 0) { verdict = 'empty'; total = 0; }
    else if (eng.exploded) verdict = 'boom';
    else if (perfect) verdict = 'perfect';
    else verdict = 'weird';
    return { total: total, rows: rows, verdict: verdict, perfect: perfect };
  }

  function rankTitle(result, blockCount) {
    if (!result.perfect) return null;
    if (blockCount <= 45) return '알고리즘 장인';
    if (blockCount <= 65) return '효도 코더';
    return '효도 성공';
  }

  // 명예의 전당 정렬: 점수 ↓, 블록 수 ↑, 동작 수 ↑
  function compareEntries(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.blocks !== b.blocks) return a.blocks - b.blocks;
    return a.actions - b.actions;
  }

  // AST의 블록 개수 (중첩 포함)
  function countBlocks(seq) {
    var n = 0;
    for (var i = 0; i < seq.length; i++) {
      n++;
      if (seq[i].body) n += countBlocks(seq[i].body);
    }
    return n;
  }

  return { MAP: MAP, ITEMS: ITEMS, RECIPE: RECIPE, RECIPE_LABEL: RECIPE_LABEL, DIRS: DIRS,
           Engine: Engine, interpret: interpret, score: score, rankTitle: rankTitle,
           compareEntries: compareEntries, countBlocks: countBlocks };
})();
if (typeof module !== 'undefined') module.exports = NauEngine;
