// Stored preferences are untrusted and must never break the game or inject SVG.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/wardrobe.js'), 'utf8');
function load(raw, blocked) {
  const window = { localStorage: { getItem() { if (blocked) throw Error('storage blocked'); return raw; } } };
  vm.runInNewContext(source, { window });
  return window.NauWardrobe;
}
const baseline = load(null).avatar(2);
for (const raw of ['invalid JSON', 'null', '[]', '42', '{"character":"unknown"}']) {
  assert.equal(load(raw).avatar(2), baseline, 'Bad preferences should use safe defaults');
}
assert.equal(load(null, true).avatar(2), baseline, 'Blocked storage must allow play');
const invalid = { character: 'girl', profiles: { girl: { hair: '<script>', outfit: '__proto__', accessory: 'missing', basket: '" onclick="alert(1)', skin: -1, hairColor: 99 } } };
assert.equal(load(JSON.stringify(invalid)).avatar(2), baseline, 'Validate every saved option');
const boy = load(JSON.stringify({ character: 'boy' }));
assert.notEqual(boy.avatar(2), baseline, 'Character defaults must differ');
const custom = load(JSON.stringify({ character: 'boy', profiles: { boy: { hair: 'twintail', outfit: 'baker', accessory: 'ribbon', basket: 'star', skin: 3, hairColor: 2 } } }));
assert.notEqual(custom.avatar(2), boy.avatar(2), 'Restore all supported options for either character');
assert.ok(custom.avatar(2).includes('#965f47'), 'Restore skin tone');
assert.ok(custom.basket().includes('#8981c7'), 'Restore selected basket');
assert.equal(new Set([0,1,2,3].map(d => custom.avatar(d))).size, 4, 'All four facing directions differ');
assert.ok(!custom.avatar(2).includes('<script'), 'No saved markup enters an SVG');
console.log('wardrobe preferences, defaults, storage failure, free combinations, four directions: ALL OK');
