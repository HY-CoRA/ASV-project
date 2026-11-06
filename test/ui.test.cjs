'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
test('merged screen supplies every game and install control with unique IDs', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate IDs break control bindings');
  for (const file of ['js/app.js', 'js/pwa.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/(?:\$|getElementById)\('([^']+)'\)/g)) {
      assert(ids.includes(match[1]), `${file} references missing control ${match[1]}`);
    }
  }
});

test('every ingredient, surprise item and floor hazard has a pixel sprite', () => {
  const vm = require('node:vm');
  const engine = require('../js/engine.js');
  const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const context = vm.createContext({NauEngine:engine, document:{getElementById(){}}});
  vm.runInContext(source.slice(source.indexOf('var E ='), source.indexOf('/* ---------- 효과음')), context);
  for (const key of Object.keys(engine.ITEMS)) {
    assert.match(context.itemIcon(key), /class="pixel-/, key + ' must not fall back to an emoji');
  }
  for (const key of Object.keys(engine.HAZARDS)) {
    assert.match(context.boardIcon(key), /class="pixel-/, key + ' must not fall back to an emoji');
  }
});
