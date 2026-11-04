// ===== 심부름 장보기 — 게임 엔진 (DOM 없음) =====
var NauEngine = (function () {
  'use strict';

  var ITEMS = {
    '딸기': { emoji: '🍓', label: '딸기', sound: 'pick' },
    '브로콜리': { emoji: '🥦', label: '브로콜리', sound: 'pick' },
    '바나나': { emoji: '🍌', label: '바나나', sound: 'pick' },
    '사과': { emoji: '🍎', label: '사과', sound: 'pick' },
    '당근': { emoji: '🥕', label: '당근', sound: 'pick' }
  };

  // '#'은 벽, '.'은 통로, 'S'는 시작 칸. 물건이 놓인 칸도 지나갈 수 있다.
  var LEVELS = [
    {
      id: 1, name: '초1–3',
      shoppingList: ['딸기', '브로콜리'],
      map: [
        ['S', '딸기', '.', '.'],
        ['#', '#', '#', '.'],
        ['#', '#', '#', '브로콜리']
      ],
      starter: { blocks: { languageVersion: 0, blocks: [
        { type: 'nau_move', x: 24, y: 24 }
      ] } }
    },
    {
      id: 2, name: '초4–6',
      shoppingList: ['딸기', '브로콜리'],
      map: [
        ['S', '.', '딸기', '#', '.', '.', '.', '.'],
        ['#', '.', '.', '#', '.', '#', '#', '.'],
        ['.', '.', '#', '#', '.', '.', '사과', '.'],
        ['.', '#', '.', '.', '.', '#', '.', '#'],
        ['바나나', '#', '.', '#', '.', '#', '.', '.'],
        ['.', '.', '.', '#', '.', '#', '#', '.'],
        ['#', '#', '.', '.', '.', '.', '.', '.'],
        ['.', '.', '.', '#', '당근', '#', '.', '브로콜리']
      ],
      starter: { blocks: { languageVersion: 0, blocks: [
        {
          type: 'nau_repeat', x: 24, y: 24, fields: { TIMES: 2 },
          inputs: { DO: { block: { type: 'nau_move' } } }
        }
      ] } }
    }
  ];

  var DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // 북, 동, 남, 서
  var MAX_YIELDS = 600;

  function findStart(map) {
    for (var row = 0; row < map.length; row++) {
      var col = map[row].indexOf('S');
      if (col !== -1) return [row, col];
    }
    return [0, 0];
  }

  function Engine(level) { this.setLevel(level || LEVELS[0]); }
  Engine.prototype.setLevel = function (level) {
    this.level = level;
    this.map = level.map;
    this.shoppingList = level.shoppingList;
    this.rows = level.map.length;
    this.cols = level.map[0].length;
    var start = findStart(level.map);
    this.sr = start[0];
    this.sc = start[1];
    this.reset();
  };
  Engine.prototype.reset = function () {
    this.r = this.sr;
    this.c = this.sc;
    this.d = 1; // 입구에서 동쪽을 보고 시작
    this.collected = [];
    this.pickedCells = new Set();
    this.actions = 0;
    this.yields = 0;
    this.bumps = 0;
    this.ended = false;
    this.checkedOut = false;
    this.overflow = false;
  };
  Engine.prototype.cellAt = function (row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return '#';
    return this.map[row][col];
  };
  Engine.prototype.front = function () {
    var dir = DIRS[this.d];
    return [this.r + dir[0], this.c + dir[1]];
  };
  Engine.prototype.move = function () {
    this.actions++;
    var front = this.front();
    if (this.cellAt(front[0], front[1]) === '#') {
      this.bumps++;
      return { type: 'bump' };
    }
    this.r = front[0];
    this.c = front[1];
    return { type: 'move' };
  };
  Engine.prototype.turn = function (lr) {
    this.actions++;
    this.d = (this.d + (lr === 'L' ? 3 : 1)) % 4;
    return { type: 'turn' };
  };
  Engine.prototype.pickedAt = function (row, col) {
    return this.pickedCells.has(row + ',' + col);
  };
  Engine.prototype.pick = function () {
    this.actions++;
    var item = this.cellAt(this.r, this.c);
    if (!ITEMS[item] || this.pickedAt(this.r, this.c)) return { type: 'pickNothing' };
    this.pickedCells.add(this.r + ',' + this.c);
    this.collected.push(item);
    return { type: 'pick', item: item, row: this.r, col: this.c };
  };
  Engine.prototype.checkout = function () {
    this.actions++;
    this.checkedOut = true;
    this.ended = true;
    return { type: 'checkout' };
  };
  Engine.prototype.cond = function (condition) {
    var front = this.front();
    var wall = this.cellAt(front[0], front[1]) === '#';
    return condition === 'WALL' ? wall : condition === 'NOWALL' && !wall;
  };

  function* interpret(seq, eng) {
    for (var i = 0; i < seq.length; i++) {
      var node = seq[i];
      if (eng.ended) return;
      if (++eng.yields > MAX_YIELDS) {
        eng.overflow = true;
        eng.ended = true;
        return;
      }
      switch (node.op) {
        case 'move': yield { node: node, ev: eng.move() }; break;
        case 'left': yield { node: node, ev: eng.turn('L') }; break;
        case 'right': yield { node: node, ev: eng.turn('R') }; break;
        case 'pick': yield { node: node, ev: eng.pick() }; break;
        case 'checkout': yield { node: node, ev: eng.checkout() }; break;
        case 'repeat':
          yield { node: node, ev: { type: 'repeat', n: node.n } };
          for (var k = 0; k < node.n && !eng.ended; k++) yield* interpret(node.body || [], eng);
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

  // 목록에 있는 물건은 각 한 번씩 +50, 중복과 목록 밖 물건은 -20.
  function score(eng) {
    var missing = new Set(eng.shoppingList);
    var total = 0;
    var wrong = false;
    var rows = eng.collected.map(function (item) {
      var info = ITEMS[item];
      var row = { item: item, emoji: info.emoji, label: info.label };
      if (missing.delete(item)) {
        row.verdict = '목록에 있음';
        row.pts = 50;
      } else {
        row.verdict = eng.shoppingList.includes(item) ? '이미 담았어요' : '목록에 없음';
        row.pts = -20;
        wrong = true;
      }
      total += row.pts;
      return row;
    });
    var verdict = 'perfect';
    if (!eng.checkedOut) verdict = 'unfinished';
    else if (wrong) verdict = 'wrong';
    else if (missing.size) verdict = 'incomplete';
    return { total: total, rows: rows, verdict: verdict, perfect: verdict === 'perfect', max: eng.shoppingList.length * 50 };
  }

  function compareEntries(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.blocks !== b.blocks) return a.blocks - b.blocks;
    return a.actions - b.actions;
  }
  function levelById(id) {
    return LEVELS.find(function (level) { return level.id === Number(id); }) || null;
  }

  return { ITEMS: ITEMS, LEVELS: LEVELS, Engine: Engine, interpret: interpret, score: score,
           compareEntries: compareEntries, levelById: levelById };
})();
if (typeof module !== 'undefined') module.exports = NauEngine;
