// ===== 심부름 장보기 — 게임 엔진 (DOM 없음) =====
var NauEngine = (function () {
  'use strict';

  var ITEMS = {
    '딸기': { emoji: '🍓', label: '딸기', sound: 'pick' },
    '브로콜리': { emoji: '🥦', label: '브로콜리', sound: 'pick' },
    '바나나': { emoji: '🍌', label: '바나나', sound: 'pick' },
    '사과': { emoji: '🍎', label: '사과', sound: 'pick' },
    '당근': { emoji: '🥕', label: '당근', sound: 'pick' },
    '오렌지': { emoji: '🍊', label: '오렌지', sound: 'pick' },
    '포도': { emoji: '🍇', label: '포도', sound: 'pick' },
    '수박': { emoji: '🍉', label: '수박', sound: 'pick' },
    '복숭아': { emoji: '🍑', label: '복숭아', sound: 'pick' },
    '배': { emoji: '🍐', label: '배', sound: 'pick' },
    '파인애플': { emoji: '🍍', label: '파인애플', sound: 'pick' },
    '레몬': { emoji: '🍋', label: '레몬', sound: 'pick' },
    '체리': { emoji: '🍒', label: '체리', sound: 'pick' },
    '오이': { emoji: '🥒', label: '오이', sound: 'pick' },
    '옥수수': { emoji: '🌽', label: '옥수수', sound: 'pick' },
    '감자': { emoji: '🥔', label: '감자', sound: 'pick' },
    '양말': { emoji: '🧦', label: '양말', sound: 'pick' },
    '축구공': { emoji: '⚽', label: '축구공', sound: 'pick' },
    '로봇': { emoji: '🤖', label: '로봇', sound: 'pick' },
    '마이크': { emoji: '🎤', label: '마이크', sound: 'pick' },
    '왕관': { emoji: '👑', label: '왕관', sound: 'pick' },
    '로켓': { emoji: '🚀', label: '로켓', sound: 'pick' },
    '마술봉': { emoji: '🪄', label: '마술봉', sound: 'pick' },
    '북': { emoji: '🥁', label: '북', sound: 'pick' },
    '자석': { emoji: '🧲', label: '자석', sound: 'pick' },
    '오리인형': { emoji: '🦆', label: '오리인형', sound: 'pick' }
  };
  var INGREDIENTS = ['딸기', '브로콜리', '바나나', '사과', '당근', '오렌지', '포도', '수박',
    '복숭아', '배', '파인애플', '레몬', '체리', '오이', '옥수수', '감자'];
  var HAZARDS = {
    '물웅덩이': { emoji: '💦', label: '물웅덩이', penalty: 10, motion: 'slip' },
    '미끄럼': { emoji: '🧼', label: '미끄러운 바닥', penalty: 10, motion: 'slip' },
    '얼음판': { emoji: '🧊', label: '얼음판', penalty: 10, motion: 'slip' },
    '바나나껍질': { emoji: '🍌', label: '바나나껍질', penalty: 10, motion: 'slip' },
    '진흙': { emoji: '🟤', label: '진흙', penalty: 10, motion: 'sticky' },
    '거미줄': { emoji: '🕸️', label: '거미줄', penalty: 10, motion: 'sticky' },
    '꿀웅덩이': { emoji: '🍯', label: '꿀웅덩이', penalty: 10, motion: 'sticky' },
    '장난감블록': { emoji: '🧱', label: '장난감블록', penalty: 10, motion: 'bump' }
  };
  var FAILURES = {
    '양말': {
      id: 'socks', emoji: '🧦', title: '양말 세탁소 엔딩',
      message: '양말을 담았더니 거품이 몽글몽글! 마트가 세탁소로 변했어요.',
      caption: '심부름 실패 · 빨래는 대성공!',
      props: ['🫧', '🧦', '🧺'], notes: [440, 554.37, 659.25, 523.25]
    },
    '축구공': {
      id: 'football', emoji: '⚽', title: '마트 월드컵 엔딩',
      message: '축구공이 데굴데굴! 과일들이 선수로 모여 마트 월드컵이 시작됐어요.',
      caption: '심부름 실패 · 우승컵은 가져왔어요!',
      props: ['⚽', '🏆', '🥅'], notes: [523.25, 659.25, 783.99, 1046.5]
    },
    '로봇': {
      id: 'robot', emoji: '🤖', title: '삐빅! 댄스 파티 엔딩',
      message: '삐빅! 로봇이 장보기 대신 댄스 파티를 시작했어요. 모두 흔들흔들!',
      caption: '심부름 실패 · 춤 실력 +100!',
      props: ['🎵', '🤖', '✨'], notes: [440, 659.25, 554.37, 880], waveform: 'square'
    },
    '마이크': {
      id: 'microphone', emoji: '🎤', title: '마트 노래왕 엔딩',
      message: '마이크를 집자 조명이 반짝! 채소 합창단과 함께 마트 콘서트가 시작됐어요.',
      caption: '심부름 실패 · 앙코르만 세 번째!',
      props: ['🎤', '🎶', '🌟'], notes: [392, 493.88, 587.33, 783.99]
    },
    '왕관': {
      id: 'crown', emoji: '👑', title: '장보기 왕국 엔딩',
      message: '왕관을 쓰자 카트가 왕좌로 변했어요! 과일 신하들이 줄지어 인사해요.',
      caption: '심부름 실패 · 왕위에 올랐어요!',
      props: ['👑', '✨', '🏰'], notes: [523.25, 698.46, 783.99, 1046.5]
    },
    '로켓': {
      id: 'rocket', emoji: '🚀', title: '우주 배송 엔딩',
      message: '로켓이 장바구니를 싣고 슝! 장보기 대신 토성으로 우주 배송을 떠났어요.',
      caption: '심부름 실패 · 배송지는 토성!',
      props: ['🚀', '⭐', '🪐'], notes: [261.63, 392, 587.33, 880], waveform: 'sine'
    },
    '마술봉': {
      id: 'wand', emoji: '🪄', title: '토끼 대소동 엔딩',
      message: '마술봉을 흔들자 펑! 장바구니에서 토끼들이 폴짝폴짝 뛰어나왔어요.',
      caption: '심부름 실패 · 토끼는 한 바구니!',
      props: ['🪄', '🐇', '🎩'], notes: [659.25, 783.99, 987.77, 1318.51]
    },
    '북': {
      id: 'drum', emoji: '🥁', title: '마트 행진곡 엔딩',
      message: '둥둥! 북소리를 듣고 카트 행진대가 출발했어요. 마트 한 바퀴 퍼레이드!',
      caption: '심부름 실패 · 퍼레이드 출발!',
      props: ['🥁', '🎺', '🎶'], notes: [130.81, 196, 261.63, 196], waveform: 'square'
    },
    '자석': {
      id: 'magnet', emoji: '🧲', title: '숟가락 폭풍 엔딩',
      message: '자석에 숟가락들이 찰칵찰칵! 재료 대신 반짝이는 숟가락 산이 생겼어요.',
      caption: '심부름 실패 · 숟가락만 잔뜩!',
      props: ['🧲', '🥄', '🪙'], notes: [440, 415.3, 392, 523.25], waveform: 'sine'
    },
    '오리인형': {
      id: 'duck', emoji: '🦆', title: '꽥꽥 목욕탕 엔딩',
      message: '오리인형이 꽥꽥! 거품 욕조가 나타나고 마트가 오리들의 목욕탕이 됐어요.',
      caption: '심부름 실패 · 목욕 준비 완료!',
      props: ['🦆', '🫧', '🛁'], notes: [349.23, 440, 349.23, 523.25]
    }
  };

  // '#'은 벽, '.'은 통로, 'S'는 시작 칸. 물건이 놓인 칸도 지나갈 수 있다.
  var LEVELS = [
    {
      id: 1, name: '초1–3', targetCount: 3,
      shoppingList: ['딸기', '브로콜리', '사과'],
      size: 5,
      starter: { blocks: { languageVersion: 0, blocks: [
        { type: 'nau_start', x: 24, y: 24, next: { block: { type: 'nau_move' } } }
      ] } }
    },
    {
      id: 2, name: '초4–6', targetCount: 5,
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
  // 격자 통로에 여러 연결로를 남긴다. 막다른 길 왕복 대신 경로를 고르게 한다.
  function makeMaze(size, difficult, random) {
    var map = [], last = size % 2 ? size - 1 : size - 2, connectors = [];
    for (var row = 0; row < size; row++) map.push(Array(size).fill('#'));
    for (var r = 0; r <= last; r++) for (var c = 0; c <= last; c++) {
      if (r % 2 === 0 || c % 2 === 0) map[r][c] = '.';
      if ((r + c) % 2 && !(r === 0 && c === 1) && !(r === 1 && c === 0)) connectors.push([r, c]);
    }
    if (!difficult) {
      var openings = shuffle([[1, 1], [1, 3], [3, 1], [3, 3]], random);
      // 작은 지도도 벽의 모양이 달라지도록 일부 모퉁이를 넓힌다.
      openings.slice(0, 1 + Math.min(1, Math.max(0, Math.floor(random() * 2)))).forEach(function (cell) {
        map[cell[0]][cell[1]] = '.';
      });
    }
    if (size % 2 === 0) {
      var loops = [];
      for (var n = 0; n < last; n += 2) loops.push(['row', n], ['col', n]);
      // 가장자리도 두 입구가 있는 우회로로 만든다. 긴 외길은 만들지 않는다.
      shuffle(loops, random).slice(0, 2).forEach(function (loop) {
        for (var i = 0; i < 3; i++) {
          if (loop[0] === 'row') map[size - 1][loop[1] + i] = '.';
          else map[loop[1] + i][size - 1] = '.';
        }
      });
    }
    shuffle(connectors, random);
    var walls = difficult ? 4 : 3;
    connectors.slice(0, walls).forEach(function (cell) { map[cell[0]][cell[1]] = '#'; });
    // 함정은 연결 통로 일부에 둔다. 뒤에서 안전한 우회로와 목표 경로를 검증한다.
    connectors.slice(walls, walls + (difficult ? 3 : 1)).forEach(function (cell, i) {
      map[cell[0]][cell[1]] = i % 2 ? '미끄럼' : '물웅덩이';
    });
    map[0][0] = 'S';
    return map;
  }

  function edgeKey(a, b) {
    var keys = [cellKey(a), cellKey(b)].sort();
    return keys[0] + '/' + keys[1];
  }

  function safeCore(map, difficult) {
    var safeMap = map.map(function (row) { return row.map(function (cell) { return HAZARDS[cell] ? '#' : cell; }); });
    var startPaths = pathsFrom(safeMap, [0, 0]);
    var cells = [];
    safeMap.forEach(function (row, r) { row.forEach(function (cell, c) { if (cell !== '#') cells.push([r, c]); }); });
    if (Object.keys(startPaths).length !== cells.length) return null;
    // 다리 통로를 뺀 입구 쪽 순환 구역에만 목표를 둔다. 필수 왕복 구간을 없앤다.
    var discovered = {}, low = {}, bridges = new Set(), tick = 0;
    function visit(cell, parent) {
      var key = cellKey(cell);
      discovered[key] = low[key] = ++tick;
      neighbors(safeMap, cell).forEach(function (next) {
        var nextKey = cellKey(next);
        if (nextKey === parent) return;
        if (!discovered[nextKey]) {
          visit(next, key);
          low[key] = Math.min(low[key], low[nextKey]);
          if (low[nextKey] > discovered[key]) bridges.add(edgeKey(cell, next));
        } else low[key] = Math.min(low[key], discovered[nextKey]);
      });
    }
    visit([0, 0], null);
    var core = [[0, 0]], seen = new Set(['0,0']), edgeCount = 0;
    for (var i = 0; i < core.length; i++) {
      neighbors(safeMap, core[i]).forEach(function (next) {
        if (bridges.has(edgeKey(core[i], next))) return;
        edgeCount++;
        if (!seen.has(cellKey(next))) { seen.add(cellKey(next)); core.push(next); }
      });
    }
    if (edgeCount / 2 - core.length + 1 < (difficult ? 4 : 2)) return null;
    return { map: safeMap, cells: cells, core: core, keys: seen, startPaths: startPaths };
  }

  // 같은 칸을 두 번 지나지 않는 짧고 안전한 수집 경로를 먼저 확보한다.
  function simpleRoute(graph, difficult, random) {
    var route = [[0, 0]], seen = new Set(['0,0']), budget = difficult ? 2400 : 600;
    var limit = difficult ? 24 : 12;
    function extend() {
      if (route.length - 1 === limit) return true;
      if (--budget < 0) return false;
      var options = shuffle(neighbors(graph.map, route[route.length - 1]).filter(function (cell) {
        return graph.keys.has(cellKey(cell)) && !seen.has(cellKey(cell));
      }), random);
      for (var i = 0; i < options.length; i++) {
        var cell = options[i], key = cellKey(cell);
        route.push(cell); seen.add(key);
        if (extend()) return true;
        route.pop(); seen.delete(key);
      }
      return false;
    }
    return extend() ? route : null;
  }

  function shortestTour(targets, startPaths, targetPaths) {
    var best = Infinity;
    function visit(left, previous, moves) {
      if (moves >= best) return;
      if (!left.length) { best = moves; return; }
      left.forEach(function (index) {
        var paths = previous === null ? startPaths : targetPaths[previous];
        visit(left.filter(function (other) { return other !== index; }), index,
          moves + paths[cellKey(targets[index])].length - 1);
      });
    }
    visit(targets.map(function (_, index) { return index; }), null, 0);
    return best;
  }

  function chooseTargets(graph, route, count, difficult, random) {
    var pool = route.filter(function (cell) {
      return graph.startPaths[cellKey(cell)].length - 1 >= (difficult ? 4 : 2);
    });
    var fromCells = {};
    pool.forEach(function (cell) { fromCells[cellKey(cell)] = pathsFrom(graph.map, cell); });
    for (var attempt = 0; attempt < 40; attempt++) {
      var targets = [];
      shuffle(pool.slice(), random).forEach(function (cell) {
        if (targets.length === count) return;
        if (targets.every(function (target) {
          return fromCells[cellKey(target)][cellKey(cell)].length - 1 >= (difficult ? 3 : 2);
        })) targets.push(cell);
      });
      if (targets.length !== count) continue;
      var targetPaths = targets.map(function (cell) { return fromCells[cellKey(cell)]; });
      var spread = 0;
      targets.forEach(function (cell, i) { targets.forEach(function (other) {
        spread = Math.max(spread, targetPaths[i][cellKey(other)].length - 1);
      }); });
      if (spread < (difficult ? 7 : 4)) continue;
      if (shortestTour(targets, graph.startPaths, targetPaths) < (difficult ? 14 : 7)) continue;
      return targets;
    }
    return null;
  }

  // 매 호출은 독립된 지도와 시작 블록을 반환한다. 재실행은 Engine.reset()을 쓴다.
  function generateLevel(idOrLevel, random) {
    var template = levelById(typeof idOrLevel === 'object' && idOrLevel ? idOrLevel.id : idOrLevel);
    if (!template) throw new RangeError('알 수 없는 난이도입니다.');
    if (random !== undefined && typeof random !== 'function') throw new TypeError('random은 함수여야 합니다.');
    random = random || Math.random;
    var difficult = template.id === 2, targetCount = template.targetCount, map, graph, targets;
    // 제한된 난수 함수에서도 종료하도록, 반복 실패 후 고정 시드의 안전한 생성기를 쓴다.
    for (var attempt = 0; attempt < 160; attempt++) {
      if (attempt === 80) random = seededRandom(template.id * 997);
      map = makeMaze(template.size, difficult, random);
      graph = safeCore(map, difficult);
      if (!graph) continue;
      var route = simpleRoute(graph, difficult, random);
      if (!route) continue;
      targets = chooseTargets(graph, route, targetCount, difficult, random);
      if (targets) break;
    }
    if (!targets) throw new Error('안전한 지도를 생성할 수 없습니다.');
    var shoppingList = shuffle(INGREDIENTS.slice(), random).slice(0, targetCount);
    shuffle(targets, random);
    targets.forEach(function (cell, i) { map[cell[0]][cell[1]] = shoppingList[i]; });
    var hazardTypes = shuffle(Object.keys(HAZARDS), random), hazardIndex = 0;
    map.forEach(function (row, r) { row.forEach(function (cell, c) {
      if (HAZARDS[cell]) map[r][c] = hazardTypes[hazardIndex++];
    }); });
    var extras = shuffle(Object.keys(FAILURES), random).slice(0, difficult ? 3 : 1);
    var available = graph.cells.filter(function (cell) { return map[cell[0]][cell[1]] === '.'; });
    shuffle(available, random).slice(0, extras.length).forEach(function (cell, i) { map[cell[0]][cell[1]] = extras[i]; });
    return { id: template.id, name: template.name, size: template.size, targetCount: targetCount, shoppingList: shoppingList,
      map: map, starter: JSON.parse(JSON.stringify(template.starter)) };
  }

  LEVELS.forEach(function (level) {
    var sample = generateLevel(level.id, seededRandom(level.id * 101));
    level.map = sample.map;
    level.shoppingList = sample.shoppingList;
  });

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

  return { ITEMS: ITEMS, INGREDIENTS: INGREDIENTS, HAZARDS: HAZARDS, FAILURES: FAILURES, LEVELS: LEVELS, Engine: Engine, interpret: interpret, score: score,
           compareEntries: compareEntries, levelById: levelById, generateLevel: generateLevel };
})();
if (typeof module !== 'undefined') module.exports = NauEngine;
