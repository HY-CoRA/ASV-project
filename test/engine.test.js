const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const F = require('./scenario-data.js');
require('./shopping-interaction.test.js');
require('./shopping-score.test.js');
function run(level, seq) {const eng=new E.Engine(level);const events=Array.from(E.interpret(seq,eng));return {eng,events,res:E.score(eng)};}
assert.equal(E.LEVELS.length,2);
for(const level of E.LEVELS){
 const size=level.id===1?5:7;assert.equal(level.map.length,size);assert(level.map.every(row=>row.length===size));
 const initial=JSON.stringify(level.map);
 for(const items of [level.shoppingList,level.shoppingList.slice().reverse()]){
  const {eng,res}=run(level,F.route(level,items));assert(eng.checkedOut);assert(res.perfect);assert.equal(res.total,items.length*50);assert.deepEqual(eng.cake,items);assert.equal(JSON.stringify(level.map),initial);
 }
 const starter=level.starter.blocks.blocks[0];assert.equal(starter.type,'nau_move');assert.equal(starter.next.block.type,'nau_move');assert.equal(starter.next.block.next.block.type,'nau_pick');
}
let t=run(E.LEVELS[1],F.cases[2].seq);assert.equal(t.res.total,190);assert.equal(t.res.perfect,false);assert.deepEqual(t.res.missing,[]);assert.equal(t.eng.cake.length,8);
t=run(E.LEVELS[0],F.cases[3].seq);assert(t.eng.exploded);assert.equal(t.eng.checkedOut,false);assert.equal(t.events.at(-1).ev.type,'boom');assert.equal(t.res.total,0);
t=run(E.LEVELS[0],F.cases[11].seq);assert.equal(t.res.total,50);assert(t.eng.checkedOut);
t=run(E.LEVELS[0],[{op:'left'},{op:'move'},{op:'if',cond:'WALL',body:[{op:'right'}]}]);assert.equal(t.eng.bumps,1);assert.equal(t.eng.d,1);
t=run(E.LEVELS[0],[{op:'repeat',n:20,body:[{op:'repeat',n:20,body:[{op:'repeat',n:20,body:[{op:'move'}]}]}]},{op:'checkout'}]);assert(t.eng.overflow);assert.equal(t.eng.checkedOut,false);
assert(E.compareEntries({score:150,blocks:10,actions:12},{score:150,blocks:11,actions:10})<0);
console.log('All engine regression checks passed: full routes, traps, conditions, reset, overflow and ranking.');
