// ===== 심부름 장보기 — 게임 엔진 (DOM 없음) =====
var NauEngine = (function () {
  'use strict';

  var ITEMS = {
    '딸기': { emoji: '🍓', label: '딸기', sound: 'pick' },
    '브로콜리': { emoji: '🥦', label: '브로콜리', sound: 'pick' },
    '바나나': { emoji: '🍌', label: '바나나', sound: 'pick' },
    '사과': { emoji: '🍎', label: '사과', sound: 'pick' },
    '당근': { emoji: '🥕', label: '당근', sound: 'pick' },
    '양말': { emoji: '🧦', label: '양말', sound: 'pick' },
    '축구공': { emoji: '⚽', label: '축구공', sound: 'pick' },
    '로봇': { emoji: '🤖', label: '로봇', sound: 'pick' }
  };
  var HAZARDS = {
    '물웅덩이': { emoji: '💦', label: '물웅덩이', penalty: 10 },
    '미끄럼': { emoji: '🧼', label: '미끄러운 바닥', penalty: 10 }
  };
  var FAILURES = {
    '양말': {
      id: 'socks', emoji: '🧦', title: '양말 세탁소 엔딩',
      message: '양말을 담았더니 거품이 몽글몽글! 마트가 세탁소로 변했어요.',
      caption: '심부름 실패 · 빨래는 대성공!'
    },
    '축구공': {
      id: 'football', emoji: '⚽', title: '마트 월드컵 엔딩',
      message: '축구공이 데굴데굴! 과일들이 선수로 모여 마트 월드컵이 시작됐어요.',
      caption: '심부름 실패 · 우승컵은 가져왔어요!'
    },
    '로봇': {
      id: 'robot', emoji: '🤖', title: '삐빅! 댄스 파티 엔딩',
      message: '삐빅! 로봇이 장보기 대신 댄스 파티를 시작했어요. 모두 흔들흔들!',
      caption: '심부름 실패 · 춤 실력 +100!'
    }
  };

  // '#'은 벽, '.'은 통로, 'S'는 시작 칸. 물건이 놓인 칸도 지나갈 수 있다.
  var LEVELS = [
    {
      id: 1, name: '초1–3',
      shoppingList: ['딸기', '브로콜리', '사과'],
      size: 6,
      starter: { blocks: { languageVersion: 0, blocks: [
        { type: 'nau_start', x: 24, y: 24, next: { block: { type: 'nau_move' } } }
      ] } }
    },
    {
      id: 2, name: '초4–6',
      shoppingList: ['딸기', '브로콜리', '사과', '당근', '바나나'],
      size: 8,
      starter: { blocks: { languageVersion: 0, blocks: [
        {
          type: 'nau_start', x: 24, y: 24, next: { block: {
            type: 'nau_repeat', fields: { TIMES: 2 },
            inputs: { DO: { block: { type: 'nau_move' } } }
          } }
        }
      ] } }
    }
  ];

  var DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // 북, 동, 남, 서
  var MAX_YIELDS = 600;

  function shuffle(values, random) {
    for (var i = values.length - 1; i > 0; i--) {
      var j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      var value = values[i]; values[i] = values[j]; values[j] = value;
    }
    return values;
  }
  function seededRandom(seed) {
    return function () {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function cellKey(cell) { return cell[0] + ',' + cell[1]; }
  function neighbors(map, cell) {
    return DIRS.map(function (dir) { return [cell[0] + dir[0], cell[1] + dir[1]]; })
      .filter(function (next) { return map[next[0]] && map[next[0]][next[1]] !== undefined && map[next[0]][next[1]] !== '#'; });
  }
  function pathsFrom(map, start) {
    var paths = {}, queue = [start];
    paths[cellKey(start)] = [start];
    for (var i = 0; i < queue.length; i++) {
      var cell = queue[i];
      neighbors(map, cell).forEach(function (next) {
        var key = cellKey(next);
        if (!paths[key]) {
          paths[key] = paths[cellKey(cell)].concat([next]);
          queue.push(next);
        }
      });
    }
    return paths;
  }
  function routeTurns(path) {
    var facing = 1, turns = 0;
    for (var i = 1; i < path.length; i++) {
      var dr = path[i][0] - path[i - 1][0], dc = path[i][1] - path[i - 1][1];
      var direction = DIRS.findIndex(function (dir) { return dir[0] === dr && dir[1] === dc; });
      var change = (direction - facing + 4) % 4;
      turns += Math.min(change, 4 - change);
      facing = direction;
    }
    return turns;
  }

  // 격자 위의 무작위 신장 트리: 막힌 길도 생기지만 모든 통로가 연결된다.
  function makeMaze(size, random) {
    var side = size / 2, map = [], parent = [], edges = [], extensions = [];
    for (var row = 0; row < size; row++) map.push(Array(size).fill('#'));
    for (var r = 0; r < side; r++) for (var c = 0; c < side; c++) {
      var index = r * side + c;
      parent[index] = index;
      map[r * 2][c * 2] = '.';
      if (c + 1 < side) edges.push([index, index + 1, r * 2, c * 2 + 1]);
      if (r + 1 < side) edges.push([index, index + side, r * 2 + 1, c * 2]);
    }
    function root(index) {
      while (parent[index] !== index) index = parent[index];
      return index;
    }
    // 처음 놓인 앞으로 가기 블록은 항상 입구에서 한 칸 이동할 수 있다.
    parent[1] = 0; map[0][1] = '.';
    shuffle(edges, random).forEach(function (edge) {
      var a = root(edge[0]), b = root(edge[1]);
      if (a !== b) { parent[b] = a; map[edge[2]][edge[3]] = '.'; }
    });
    for (var n = 0; n < side; n++) {
      extensions.push([size - 1, n * 2], [n * 2, size - 1]);
    }
    shuffle(extensions, random).slice(0, size - 2).forEach(function (cell) { map[cell[0]][cell[1]] = '.'; });
    map[0][0] = 'S';
    return map;
  }

  function targetOptions(map, difficult) {
    var startPaths = pathsFrom(map, [0, 0]), cells = Object.keys(startPaths).map(function (key) {
      return startPaths[key][startPaths[key].length - 1];
    });
    var branches = cells.filter(function (cell) { return neighbors(map, cell).length >= 3; }).length;
    if (branches < (difficult ? 4 : 2)) return [];
    var leaves = cells.filter(function (cell) {
      return cellKey(cell) !== '0,0' && neighbors(map, cell).length === 1 && startPaths[cellKey(cell)].length - 1 >= (difficult ? 8 : 5);
    });
    var options = [];
    leaves.forEach(function (a, i) {
      var fromA = pathsFrom(map, a), startA = startPaths[cellKey(a)];
      leaves.slice(i + 1).forEach(function (b) {
        var startB = startPaths[cellKey(b)], between = fromA[cellKey(b)];
        var routeA = startA.concat(between.slice(1));
        var routeB = startB.concat(between.slice().reverse().slice(1));
        var moves = Math.min(routeA.length, routeB.length) - 1;
        if (moves < (difficult ? 28 : 14) || Math.min(routeTurns(routeA), routeTurns(routeB)) < (difficult ? 10 : 5)) return;
        var safe = new Set(startA.concat(startB).map(cellKey));
        var sidePaths = cells.filter(function (cell) { return !safe.has(cellKey(cell)); });
        if (sidePaths.length < (difficult ? 4 : 2)) return;
        var safeTargets = cells.filter(function (cell) {
          return safe.has(cellKey(cell)) && startPaths[cellKey(cell)].length - 1 >= (difficult ? 8 : 5);
        });
        if (safeTargets.length < (difficult ? 5 : 3)) return;
        options.push({ a: a, b: b, sidePaths: sidePaths, cells: cells, safeTargets: safeTargets });
      });
    });
    return options;
  }

  // 매 호출은 독립된 지도와 시작 블록을 반환한다. 재실행은 Engine.reset()을 쓴다.
  function generateLevel(idOrLevel, random) {
    var template = levelById(typeof idOrLevel === 'object' && idOrLevel ? idOrLevel.id : idOrLevel);
    if (!template) throw new RangeError('알 수 없는 난이도입니다.');
    if (random !== undefined && typeof random !== 'function') throw new TypeError('random은 함수여야 합니다.');
    random = random || Math.random;
    var difficult = template.id === 2, map, options;
    // 제한된 난수 함수에서도 종료하도록, 반복 실패 후 고정 시드의 안전한 생성기를 쓴다.
    for (var attempt = 0; attempt < 240; attempt++) {
      if (attempt === 120) random = seededRandom(template.id * 997);
      map = makeMaze(template.size, random);
      options = targetOptions(map, difficult);
      if (options.length) break;
    }
    if (!options.length) throw new Error('안전한 지도를 생성할 수 없습니다.');
    var chosen = shuffle(options, random)[0];
    var targets = shuffle([chosen.a, chosen.b], random);
    // 나머지 장보기 물건도 입구에서 멀고, 기존 물건과 떨어진 안전한 칸에 둔다.
    while (targets.length < template.shoppingList.length) {
      var fromTargets = targets.map(function (cell) { return pathsFrom(map, cell); });
      var pool = shuffle(chosen.safeTargets.filter(function (cell) {
        return !targets.some(function (target) { return cellKey(cell) === cellKey(target); });
      }), random);
      function nearestTarget(cell) {
        return Math.min.apply(null, fromTargets.map(function (paths) { return paths[cellKey(cell)].length; }));
      }
      pool.sort(function (a, b) { return nearestTarget(b) - nearestTarget(a); });
      targets.push(pool[0]);
    }
    shuffle(targets, random);
    targets.forEach(function (cell, i) { map[cell[0]][cell[1]] = template.shoppingList[i]; });
    // 함정은 두 목표까지의 경로 밖에만 둔다. 우회해서 만점을 받을 수 있다.
    shuffle(chosen.sidePaths, random).slice(0, difficult ? 3 : 1).forEach(function (cell, i) {
      map[cell[0]][cell[1]] = i % 2 ? '미끄럼' : '물웅덩이';
    });
    var absurd = shuffle(['양말', '축구공', '로봇'], random);
    var extras = difficult ? absurd : absurd.slice(0, 1);
    var available = chosen.cells.filter(function (cell) { return map[cell[0]][cell[1]] === '.'; });
    shuffle(available, random).slice(0, extras.length).forEach(function (cell, i) { map[cell[0]][cell[1]] = extras[i]; });
    return { id: template.id, name: template.name, size: template.size, shoppingList: template.shoppingList.slice(),
      map: map, starter: JSON.parse(JSON.stringify(template.starter)) };
  }

  LEVELS.forEach(function (level) { level.map = generateLevel(level.id, seededRandom(level.id * 101)).map; });

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
    this.triggeredTraps = new Set();
    this.trapHits = 0;
    this.trapPenalty = 0;
    this.ended = false;
    this.checkedOut = false;
    this.overflow = false;
    this.failure = null;
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
    var cell = this.cellAt(this.r, this.c), key = this.r + ',' + this.c;
    if (HAZARDS[cell] && !this.triggeredTraps.has(key)) {
      this.triggeredTraps.add(key);
      this.trapHits++;
      this.trapPenalty += HAZARDS[cell].penalty;
      return { type: 'trap', hazard: cell, row: this.r, col: this.c, penalty: HAZARDS[cell].penalty };
    }
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
    var event = { type: 'pick', item: item, row: this.r, col: this.c };
    if (FAILURES[item] && !this.shoppingList.includes(item)) {
      this.failure = item;
      this.ended = true;
      event.failure = item;
    }
    return event;
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
    if (eng.failure) verdict = 'easterEgg';
    else if (!eng.checkedOut) verdict = 'unfinished';
    else if (wrong) verdict = 'wrong';
    else if (missing.size) verdict = 'incomplete';
    else if (eng.trapHits) verdict = 'trapped';
    return { total: total - eng.trapPenalty, rows: rows, verdict: verdict, perfect: verdict === 'perfect',
      max: eng.shoppingList.length * 50, trapPenalty: eng.trapPenalty, traps: eng.trapHits, failure: eng.failure };
  }

  function compareEntries(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    if (typeof a.id === 'number' && typeof b.id === 'number') return a.id - b.id;
    return String(a.id).localeCompare(String(b.id));
  }
  function levelById(id) {
    return LEVELS.find(function (level) { return level.id === Number(id); }) || null;
  }

  return { ITEMS: ITEMS, HAZARDS: HAZARDS, FAILURES: FAILURES, LEVELS: LEVELS, Engine: Engine, interpret: interpret, score: score,
           compareEntries: compareEntries, levelById: levelById, generateLevel: generateLevel };
})();
if (typeof module !== 'undefined') module.exports = NauEngine;
