// ===== 병맛 효도 케이크 — 게임 엔진 v2 (DOM 없음, 레벨 지원) =====
var NauEngine = (function () {
  'use strict';

  // 단계 1: 장보기 데이터. recipe는 기존 화면과의 임시 호환 필드입니다.
  var ITEMS = {
  "토마토": {
    "emoji": "🍅",
    "kind": "tomato",
    "label": "토마토",
    "sound": "bread"
  },
  "감자": {
    "emoji": "🥔",
    "kind": "potato",
    "label": "감자",
    "sound": "bread"
  },
  "고구마": {
    "emoji": "🍠",
    "kind": "sweetpotato",
    "label": "고구마",
    "sound": "bread"
  },
  "계란": {
    "emoji": "🥚",
    "kind": "egg",
    "label": "계란",
    "sound": "bread"
  },
  "베이컨": {
    "emoji": "🥓",
    "kind": "bacon",
    "label": "베이컨",
    "sound": "bread"
  },
  "빵": {
    "emoji": "🍞",
    "kind": "bread",
    "label": "빵",
    "sound": "bread"
  },
  "케첩": {
    "emoji": "🥫",
    "kind": "ketchup",
    "label": "케첩",
    "sound": "bread"
  },
  "우유": {
    "emoji": "🥛",
    "kind": "milk",
    "label": "우유",
    "sound": "bread"
  },
  "초콜릿": {
    "emoji": "🍫",
    "kind": "trap",
    "label": "초콜릿",
    "sound": "sock"
  },
  "양말": {
    "emoji": "🧦",
    "kind": "trap",
    "label": "양말",
    "sound": "sock"
  },
  "다이아몬드": {
    "emoji": "💎",
    "kind": "trap",
    "label": "다이아몬드",
    "sound": "sock"
  },
  "TNT": {
    "emoji": "🧨",
    "kind": "boom",
    "label": "TNT",
    "sound": "boom"
  }
};
  var KIND_LABEL = {
  "tomato": "토마토",
  "potato": "감자",
  "sweetpotato": "고구마",
  "egg": "계란",
  "bacon": "베이컨",
  "bread": "빵",
  "ketchup": "케첩",
  "milk": "우유"
};
  var KIND_EMOJI = {
  "tomato": "🍅",
  "potato": "🥔",
  "sweetpotato": "🍠",
  "egg": "🥚",
  "bacon": "🥓",
  "bread": "🍞",
  "ketchup": "🥫",
  "milk": "🥛"
};
  var LEVELS = [
  {
    "id": 1,
    "name": "레벨 1 · 첫 장보기",
    "who": "초등 1~3학년 · 5×5",
    "desc": "토마토, 감자, 고구마를 담아요. TNT를 조심하세요!",
    "shoppingList": [
      "토마토",
      "감자",
      "고구마"
    ],
    "recipe": [
      "tomato",
      "potato",
      "sweetpotato"
    ],
    "map": [
      [
        "S",
        ".",
        "토마토",
        ".",
        "."
      ],
      [
        ".",
        ".",
        "#",
        "감자",
        "."
      ],
      [
        ".",
        ".",
        "#",
        ".",
        "."
      ],
      [
        ".",
        "TNT",
        ".",
        "고구마",
        "."
      ],
      [
        ".",
        ".",
        ".",
        "#",
        "."
      ]
    ],
    "thresholds": [
      10,
      13
    ],
    "starter": {
      "blocks": {
        "languageVersion": 0,
        "blocks": [
          {
            "type": "nau_move",
            "x": 24,
            "y": 24,
            "next": {
              "block": {
                "type": "nau_move",
                "next": {
                  "block": {
                    "type": "nau_pick"
                  }
                }
              }
            }
          }
        ]
      }
    }
  },
  {
    "id": 2,
    "name": "레벨 2 · 도전 장보기",
    "who": "초등 4~6학년 · 7×7",
    "desc": "계란, 베이컨, 빵, 케첩, 우유를 담아요. 목록에 없는 물건을 조심하세요!",
    "shoppingList": [
      "계란",
      "베이컨",
      "빵",
      "케첩",
      "우유"
    ],
    "recipe": [
      "egg",
      "bacon",
      "bread",
      "ketchup",
      "milk"
    ],
    "map": [
      [
        "S",
        ".",
        "계란",
        ".",
        ".",
        ".",
        "."
      ],
      [
        ".",
        ".",
        "#",
        ".",
        "베이컨",
        "#",
        "."
      ],
      [
        ".",
        ".",
        "#",
        ".",
        ".",
        ".",
        "."
      ],
      [
        ".",
        "초콜릿",
        ".",
        "#",
        "빵",
        ".",
        "."
      ],
      [
        ".",
        "#",
        ".",
        ".",
        ".",
        "#",
        "."
      ],
      [
        ".",
        "양말",
        "케첩",
        "#",
        "다이아몬드",
        "우유",
        "."
      ],
      [
        ".",
        ".",
        ".",
        ".",
        ".",
        ".",
        "."
      ]
    ],
    "thresholds": [
      16,
      31
    ],
    "starter": {
      "blocks": {
        "languageVersion": 0,
        "blocks": [
          {
            "type": "nau_move",
            "x": 24,
            "y": 24,
            "next": {
              "block": {
                "type": "nau_move",
                "next": {
                  "block": {
                    "type": "nau_pick"
                  }
                }
              }
            }
          }
        ]
      }
    }
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
    this.map = this.level.map.map(function(row){ return row.slice(); });
    this.r = this.sr; this.c = this.sc; this.d = 1; // 입구에서 동쪽을 보고 시작
    this.cake = []; this.actions = 0; this.yields = 0; this.bumps = 0;
    this.ended = false; this.exploded = false; this.checkedOut = false; this.overflow = false;
  };
  Engine.prototype.cellAt = function (r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return '#';
    return this.map[r][c];
  };
  // 못 지나가는 곳: 맵 밖과 벽(#). 아이템 칸은 이동 가능.
  Engine.prototype.blocked = function (cell) { return cell === '#'; };
  Engine.prototype.front = function () { var dd = DIRS[this.d]; return [this.r + dd[0], this.c + dd[1]]; };
  Engine.prototype.move = function () {
    this.actions++;
    var f = this.front(), cell = this.cellAt(f[0], f[1]);
    if (this.blocked(cell)) { this.bumps++; return { type: 'bump', shelf: !!ITEMS[cell] }; }
    this.r = f[0]; this.c = f[1];
    return { type: 'move' };
  };
  Engine.prototype.turn = function (lr) { this.actions++; this.d = (this.d + (lr === 'L' ? 3 : 1)) % 4; return { type: 'turn', lr: lr }; };
  Engine.prototype.pick = function () {
    this.actions++;
    var cell = this.cellAt(this.r, this.c);
    if (!ITEMS[cell]) return { type: 'pickNothing' };
    this.cake.push(cell);
    this.map[this.r][this.c] = '.';
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
      case 'GOT_WANTED': return this.level.shoppingList.indexOf(last) >= 0;
    }
    return false;
  };

  // 계산하기는 최상위 코드의 마지막에 한 번만 허용한다.
  function validCheckout(seq) {
    var count = 0;
    function visit(nodes) { nodes.forEach(function(n) { if(n.op === 'checkout') count++; if(n.body) visit(n.body); }); }
    visit(seq);
    return count === 1 && seq.length > 0 && seq[seq.length - 1].op === 'checkout';
  }
  function* interpret(seq, eng, nested) {
    if (!nested) eng.checkoutAllowed = validCheckout(seq);
    for (var i = 0; i < seq.length; i++) {
      var node = seq[i];
      if (eng.ended) return;
      if (++eng.yields > MAX_YIELDS) { eng.overflow = true; eng.ended = true; return; }
      switch (node.op) {
        case 'move':  yield { node: node, ev: eng.move() }; break;
        case 'left':  yield { node: node, ev: eng.turn('L') }; break;
        case 'right': yield { node: node, ev: eng.turn('R') }; break;
        case 'checkout':
          if(eng.checkoutAllowed) { eng.actions++; eng.checkedOut = true; eng.ended = true; yield { node: node, ev: { type: 'checkout' } }; }
          break;
        case 'pick':  yield { node: node, ev: eng.pick() }; break;
        case 'repeat':
          yield { node: node, ev: { type: 'repeat', n: node.n } };
          for (var k = 0; k < node.n; k++) { if (eng.ended) return; yield* interpret(node.body || [], eng, true); }
          break;
        case 'if': {
          var ok = eng.cond(node.cond);
          yield { node: node, ev: { type: 'if', ok: ok, cond: node.cond } };
          if (ok) yield* interpret(node.body || [], eng, true);
          break;
        }
      }
    }
  }

  // 장보기: 품목당 최초 +50, 목록 외 -20, TNT -100, 하한 0.
  function score(eng) {
    var wanted = eng.level.shoppingList, seen = [], total = 0;
    var rows = eng.cake.map(function(item) {
      var info = ITEMS[item], pts, verdict;
      if(info.kind === 'boom') { pts = -100; verdict = 'TNT'; }
      else if(wanted.indexOf(item) < 0) { pts = -20; verdict = '목록에 없는 물건'; }
      else if(seen.indexOf(item) >= 0) { pts = 0; verdict = '이미 담은 품목'; }
      else { pts = 50; verdict = '목록 품목'; seen.push(item); }
      total += pts;
      return { item:item, emoji:info.emoji, label:info.label, pts:pts, verdict:verdict };
    });
    var missing = wanted.filter(function(item){ return seen.indexOf(item) < 0; });
    var perfect = missing.length === 0 && rows.every(function(row){ return row.pts >= 0; }) && !eng.exploded;
    return { total:Math.max(0,total), rows:rows, missing:missing, perfect:perfect,
      verdict:eng.exploded ? 'boom' : !eng.cake.length ? 'empty' : perfect ? 'perfect' : 'weird', max:wanted.length*50 };
  }

  function rankTitle(result, blockCount, level) {
    if (!result.perfect) return null;
    var t = (level && level.thresholds) || [45, 65];
    if (blockCount <= t[0]) return '알고리즘 장인';
    if (blockCount <= t[1]) return '장보기 코더';
    return '장보기 성공';
  }
  function compareEntries(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.blocks !== b.blocks) return a.blocks - b.blocks;
    return a.actions - b.actions;
  }
  function countBlocks(seq) { var n = 0; for (var i = 0; i < seq.length; i++) { n++; if (seq[i].body) n += countBlocks(seq[i].body); } return n; }
  function levelById(id) { for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === Number(id)) return LEVELS[i]; return null; }

  return { ITEMS: ITEMS, KIND_LABEL: KIND_LABEL, KIND_EMOJI: KIND_EMOJI, LEVELS: LEVELS, DIRS: DIRS,
           validCheckout: validCheckout, Engine: Engine, interpret: interpret, score: score, rankTitle: rankTitle,
           compareEntries: compareEntries, countBlocks: countBlocks, levelById: levelById };
})();
if (typeof module !== 'undefined') module.exports = NauEngine;
