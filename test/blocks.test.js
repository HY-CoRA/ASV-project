const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Engine, LEVELS, interpret } = require('../js/engine.js');

// 브라우저용 번들을 VM에서 읽어 실제 Blockly 연결·복제·붙여넣기 규칙을 검증한다.
const context = vm.createContext({ console, setTimeout, clearTimeout, Element: class {}, Node: class {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../vendor/blockly.min.js'), 'utf8'), context);
const Blockly = context.Blockly;
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const from = app.indexOf('var ws=null, toolboxLevel;');
const to = app.indexOf('/* ---------- 실행 ---------- */', from);
assert(from >= 0 && to > from, 'Blockly 함수 구간을 찾을 수 있어야 한다.');

let injectedOptions;
Blockly.inject = (id, options) => {
  assert.equal(id, 'blocklyDiv');
  injectedOptions = options;
  return new Blockly.Workspace(new Blockly.Options(options));
};
const elements = new Map();
context.$ = id => {
  if (!elements.has(id)) elements.set(id, {
    clientWidth: 0, clientHeight: 0, textContent: '', dataset: {},
    querySelector(selector) { return context.$(id + ' ' + selector); }
  });
  return elements.get(id);
};
context.level = LEVELS[0];
context.ResizeObserver = class { observe() {} };
vm.runInContext(app.slice(from, to), context, { filename: 'app-blockly-functions.js' });
context.initBlockly();
const ws = context.ws;

try {
  assert.equal(injectedOptions.maxInstances.nau_start, 1);
  assert.equal(injectedOptions.maxInstances.nau_checkout, 1);
  assert.equal(ws.getBlocksByType('nau_start', false).length, 1, '초기 프로그램에 시작 블록이 있다.');
  ws.clear();

  const start = ws.newBlock('nau_start');
  const repeat = ws.newBlock('nau_repeat');
  repeat.setFieldValue(2, 'TIMES');
  const repeatedMove = ws.newBlock('nau_move');
  const condition = ws.newBlock('nau_if');
  condition.setFieldValue('WALL', 'COND');
  const turn = ws.newBlock('nau_right');
  const move = ws.newBlock('nau_move');
  const pick = ws.newBlock('nau_pick');
  const checkout = ws.newBlock('nau_checkout');
  const loose = ws.newBlock('nau_left');
  start.nextConnection.connect(repeat.previousConnection);
  repeat.getInput('DO').connection.connect(repeatedMove.previousConnection);
  repeat.nextConnection.connect(condition.previousConnection);
  condition.getInput('DO').connection.connect(turn.previousConnection);
  turn.nextConnection.connect(move.previousConnection);
  move.nextConnection.connect(pick.previousConnection);

  assert.equal(start.previousConnection, null);
  assert.equal(checkout.nextConnection, null);
  let program = context.readProgram();
  assert.equal(program.start, start);
  assert.equal(program.blocks, 7, '중첩 블록과 시작 블록을 세고 분리된 블록은 제외한다.');
  assert.deepEqual(Array.from(program.ast, node => node.op), ['repeat', 'if']);
  assert.deepEqual(Array.from(program.ast[1].body, node => node.op), ['right', 'move', 'pick']);
  context.updateCount();
  assert.equal(elements.get('btn-run').textContent, '▶ 미리보기', '분리된 종료 블록은 결과 실행으로 표시하지 않는다.');
  assert.equal(elements.get('btn-run').dataset.mode, 'preview');
  const level = { shoppingList: ['딸기'], map: [['S', '.', '.'], ['#', '#', '딸기']] };
  let engine = new Engine(level);
  Array.from(interpret(program.ast, engine));
  assert.deepEqual(engine.collected, ['딸기']);
  assert.equal(engine.checkedOut, false, '분리된 종료 블록은 실행하지 않는다.');
  assert.equal(engine.actions, 5);

  condition.nextConnection.connect(checkout.previousConnection);
  program = context.readProgram();
  assert.equal(program.blocks, 8);
  context.updateCount();
  assert.equal(elements.get('btn-run').textContent, '▶ 결과까지 실행', '연결된 종료 블록이 있으면 결과까지 실행한다고 표시한다.');
  assert.equal(elements.get('btn-run').dataset.mode, 'submit');
  engine = new Engine(level);
  Array.from(interpret(program.ast, engine));
  assert.equal(engine.checkedOut, true, '시작 체인에 연결한 종료 블록은 실행한다.');
  assert.equal(engine.actions, 6);

  for (const block of [start, checkout]) {
    assert.equal(ws.remainingCapacityOfType(block.type), 0);
    assert.equal(block.isDuplicatable(), false);
    const copy = Blockly.BlockSvg.prototype.toCopyData.call(block);
    assert.equal(Blockly.clipboard.paste(copy, ws), null, '실제 복사 데이터의 붙여넣기도 제한한다.');
    assert.equal(ws.getBlocksByType(block.type, false).length, 1);
  }
  assert.equal(loose.isDuplicatable(), true, '일반 블록은 복제할 수 있다.');

  start.nextConnection.disconnect();
  program = context.readProgram();
  assert.equal(program.start, start);
  assert.equal(program.ast.length, 0);
  assert.equal(program.blocks, 1, '빈 시작 블록 아래의 분리된 체인은 제외한다.');
  context.updateCount();
  assert.equal(elements.get('btn-run').dataset.mode, 'preview', '시작 체인을 끊으면 미리보기 표시로 돌아온다.');
  start.dispose();
  program = context.readProgram();
  assert.equal(program.start, undefined);
  assert.equal(program.ast.length, 0);
  assert.equal(program.blocks, 0, '시작 블록이 없으면 실행할 프로그램도 없다.');
} finally {
  ws.dispose();
}

console.log('ALL OK — 시작 연결 실행, 중첩 블록 수, 시작·종료 복제와 붙여넣기 제한');
