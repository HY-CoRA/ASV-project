const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const run = (e, seq) => Array.from(E.interpret(seq,e));
for (const level of E.LEVELS) {
 const e = new E.Engine(level);
 assert.equal(e.pick().type,'pickNothing');
 run(e,[{op:'move'},{op:'move'},{op:'pick'}]);
 assert.deepEqual(e.cake,[level.shoppingList[0]]);
 assert.equal(e.cellAt(0,2),'.');
 assert.equal(e.pick().type,'pickNothing');
 assert.equal(e.checkedOut,false);
 e.reset();
 assert.equal(e.cellAt(0,2),level.shoppingList[0]);
 run(e,[{op:'move'},{op:'move'},{op:'pick'},{op:'checkout'}]);
 assert.equal(e.checkedOut,true);
 assert.equal(e.actions,4);
 for(const seq of [[{op:'checkout'},{op:'move'}],[{op:'repeat',n:1,body:[{op:'checkout'}]}],[{op:'checkout'},{op:'checkout'}]]) {
  e.reset(); run(e,seq); assert.equal(e.checkedOut,false);
 }
 e.reset(); assert.equal(e.blocked(level.shoppingList[0]),false); assert.equal(e.blocked('#'),true);
}
const e=new E.Engine(E.LEVELS[0]);e.r=3;e.c=1;
assert.equal(e.pick().type,'boom');assert.equal(e.exploded,true);
console.log('Shopping interaction checks passed');
