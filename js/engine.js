// ===== 병맛 효도 케이크 — 게임 엔진 v2 (DOM 없음, 레벨 지원) =====
var NauEngine = (function () {
  'use strict';

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
  var KIND_LABEL = { bread: '빵', cream: '생크림', topping: '토핑', deco: '장식(초)' };
  var KIND_EMOJI = { bread: '🍞', cream: '🍦', topping: '🍓🍫', deco: '🕯️' };

  // 맵 기호: '#' 선반(벽), '.' 통로, 'S' 입구, 'E' 계산대, 그 외 = 아이템 선반(통과 불가, 앞에서 집기)
  // thresholds: 완벽한 케이크일 때 칭호 기준 블록 수 [장인 이하, 코더 이하]
  var LEVELS = [
    {
      id: 1, name: '레벨 1 · 첫 장보기', who: '초등 저학년 · 처음 해보는 사람',
      desc: '빵 → 생크림 → 딸기, 3층 케이크. 한 줄 복도라 반복 없이도 풀 수 있어요.',
      recipe: ['bread', 'cream', 'topping'],
      map: [
        ['S', '.', '.', '.', '.', '.'],
        ['#', '빵', '양말', '생크림', '벽돌', '딸기']
      ],
      thresholds: [10, 13],
      starter: { blocks: { languageVersion: 0, blocks: [
        { type: 'nau_move', x: 24, y: 24, next: { block: { type: 'nau_right', next: { block: { type: 'nau_pick' } } } } } ] } }
    },
    {
      id: 2, name: '레벨 2 · 반복의 힘', who: '초등 고학년 · 중등',
      desc: '6층 케이크. 재료가 2칸마다 번갈아 놓여 있어서, 반복 블록을 쓰면 블록 수가 절반으로 줄어요. 한 칸 틀리면 벽돌이나 다이너마이트!',
      recipe: ['bread', 'cream', 'bread', 'cream', 'topping', 'deco'],
      map: [
        ['S', '.', '.', '.', '.', '.', '.', '.'],
        ['#', '양말', '빵', '벽돌', '생크림', '다이아몬드', '빵', '.'],
        ['#', '#', '#', '#', '#', '#', '생크림', '.'],
        ['#', '#', '#', '#', '#', '#', '다이너마이트', '.'],
        ['#', '#', '#', '#', '#', '#', '딸기', '.'],
        ['#', '#', '#', '#', '#', '#', '다이너마이트', '.'],
        ['#', '#', '#', '#', '#', '#', '초', '.'],
        ['#', '#', '#', '#', '#', '#', '#', 'E']
      ],
      thresholds: [16, 31],
      starter: { blocks: { languageVersion: 0, blocks: [
        { type: 'nau_repeat', x: 24, y: 24, inputs: { TIMES: { block: { type: 'nau_number', fields: { VALUE: '2' } } }, DO: { block: { type: 'nau_move' } } },
          next: { block: { type: 'nau_right', next: { block: { type: 'nau_pick' } } } } } ] } }
    },
    {
      id: 3, name: '레벨 3 · 미로 마트', who: '중등 · 챌린지',
      desc: '기획서 원본 맵. 빵과 생크림 선반 사이를 왕복해야 해서 길이 길어요. "빵을 집었다면 / 생크림을 집었다면" 조건을 잘 쓰면 블록이 확 줄어요.',
      recipe: ['bread', 'cream', 'bread', 'cream', 'topping', 'deco'],
      map: [
        ['S', '.', '.', '.', '.', '딸기', '.', '초'],
        ['.', '#', '#', '빵', '#', '생크림', '.', '다이너마이트'],
        ['.', '#', '.', '.', '#', '.', '.', '.'],
        ['.', '#', '.', '.', '#', '.', '.', '.'],
        ['.', '.', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '생크림', '.', '#', '.', '.', '.'],
        ['.', '.', '#', '양말', '.', '다이아몬드', '#', '#'],
        ['벽돌', '빵', '#', '초콜릿', '.', '.', '.', 'E']
      ],
      thresholds: [40, 56],
      starter: { blocks: { languageVersion: 0, blocks: [
        { type: 'nau_repeat', x: 24, y: 24, inputs: { TIMES: { block: { type: 'nau_number', fields: { VALUE: '3' } } }, DO: { block: { type: 'nau_move' } } },
          next: { block: { type: 'nau_right', next: { block: { type: 'nau_pick' } } } } } ] } }
    }
  ];

  var DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // 북, 동, 남, 서
  var MAX_YIELDS = 600;

  function findStart(map) {
    for (var r = 0; r < map.length; r++) for (var c = 0; c < map[r].length; c++) if (map[r][c] === 'S') return [r, c];
    return [0, 0];
  }

  function Engine(level) { this.setLevel(level || LEVELS[0]); }
  Engine.prototype.setLevel = function (level) {
    this.level = level; this.map = level.map; this.recipe = level.recipe;
    this.rows = level.map.length; this.cols = level.map[0].length;
    var s = findStart(level.map); this.sr = s[0]; this.sc = s[1];
    this.reset();
  };
  Engine.prototype.reset = function () {
    this.r = this.sr; this.c = this.sc; this.d = 1; // 입구에서 동쪽을 보고 시작
    this.cake = []; this.actions = 0; this.yields = 0; this.bumps = 0;
    this.ended = false; this.exploded = false; this.checkedOut = false; this.overflow = false;
  };
  Engine.prototype.cellAt = function (r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return '#';
    return this.map[r][c];
  };
  // 못 지나가는 곳: 맵 밖, 선반(#), 아이템 선반
  Engine.prototype.blocked = function (cell) { return cell === '#' || !!ITEMS[cell]; };
  Engine.prototype.front = function () { var dd = DIRS[this.d]; return [this.r + dd[0], this.c + dd[1]]; };
  Engine.prototype.move = function () {
    this.actions++;
    var f = this.front(), cell = this.cellAt(f[0], f[1]);
    if (this.blocked(cell)) { this.bumps++; return { type: 'bump', shelf: !!ITEMS[cell] }; }
    this.r = f[0]; this.c = f[1];
    if (cell === 'E') { this.checkedOut = true; this.ended = true; return { type: 'checkout' }; }
    return { type: 'move' };
  };
  Engine.prototype.turn = function (lr) { this.actions++; this.d = (this.d + (lr === 'L' ? 3 : 1)) % 4; return { type: 'turn', lr: lr }; };
  Engine.prototype.pick = function () {
    this.actions++;
    var f = this.front(), cell = this.cellAt(f[0], f[1]);
    if (!ITEMS[cell]) return { type: 'pickNothing' };
    this.cake.push(cell);
    if (ITEMS[cell].kind === 'boom') { this.exploded = true; this.ended = true; return { type: 'boom', item: cell }; }
    return { type: 'pick', item: cell };
  };
  Engine.prototype.cond = function (k) {
    var f = this.front(), cell = this.cellAt(f[0], f[1]);
    var last = this.cake[this.cake.length - 1];
    switch (k) {
      case 'WALL': return this.blocked(cell);
      case 'NOWALL': return !this.blocked(cell);
      case 'GOT_BREAD': return last === '빵';
      case 'GOT_CREAM': return last === '생크림';
    }
    return false;
  };

  // AST 노드: {op:'move'|'left'|'right'|'pick'|'repeat'|'if'|'call', n?, cond?, body?, slot?, id?}
  function* interpret(seq, eng, functions = []) {
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
            yield* interpret(node.body || [], eng, functions);
          }
          break;
        case 'if': {
          var ok = eng.cond(node.cond);
          yield { node: node, ev: { type: 'if', ok: ok, cond: node.cond } };
          if (ok) yield* interpret(node.body || [], eng, functions);
          break;
        }
        case 'call':
          yield { node: node, ev: { type: 'call', slot: node.slot } };
          yield* interpret(functions[node.slot] || [], eng, functions);
          break;
      }
    }
  }

  // 점수표: 정상 +50 / 순서 오류 -10 / 이상한 재료 -20 / 다이너마이트 -100 / 빈손 0
  function score(eng) {
    var cake = eng.cake, recipe = eng.recipe, rows = [], total = 0, goodIdx = 0, perfect = true;
    for (var i = 0; i < cake.length; i++) {
      var it = cake[i], info = ITEMS[it];
      var row = { item: it, emoji: info.emoji, label: info.label };
      if (info.kind === 'boom') { row.verdict = '폭발'; row.pts = -100; perfect = false; }
      else if (info.kind === 'trap') { row.verdict = '이상한 재료'; row.pts = -20; perfect = false; }
      else {
        if (goodIdx < recipe.length && recipe[goodIdx] === info.kind) { row.verdict = '정상 (' + (goodIdx + 1) + '층 ' + KIND_LABEL[recipe[goodIdx]] + ')'; row.pts = 50; }
        else { row.verdict = '순서 오류'; row.pts = -10; perfect = false; }
        goodIdx++;
      }
      total += row.pts; rows.push(row);
    }
    if (goodIdx !== recipe.length) perfect = false;
    var verdict;
    if (cake.length === 0) { verdict = 'empty'; total = 0; }
    else if (eng.exploded) verdict = 'boom';
    else if (perfect) verdict = 'perfect';
    else verdict = 'weird';
    return { total: total, rows: rows, verdict: verdict, perfect: perfect, max: recipe.length * 50 };
  }

  function rankTitle(result, blockCount, level) {
    if (!result.perfect) return null;
    var t = (level && level.thresholds) || [45, 65];
    if (blockCount <= t[0]) return '알고리즘 장인';
    if (blockCount <= t[1]) return '효도 코더';
    return '효도 성공';
  }
  function compareEntries(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.blocks !== b.blocks) return a.blocks - b.blocks;
    return a.actions - b.actions;
  }
  function countBlocks(seq) { var n = 0; for (var i = 0; i < seq.length; i++) { n++; if (seq[i].body) n += countBlocks(seq[i].body); } return n; }
  function levelById(id) { for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === Number(id)) return LEVELS[i]; return null; }

  return { ITEMS: ITEMS, KIND_LABEL: KIND_LABEL, KIND_EMOJI: KIND_EMOJI, LEVELS: LEVELS, DIRS: DIRS,
           Engine: Engine, interpret: interpret, score: score, rankTitle: rankTitle,
           compareEntries: compareEntries, countBlocks: countBlocks, levelById: levelById };
})();
if (typeof module !== 'undefined') module.exports = NauEngine;
