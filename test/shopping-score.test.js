const assert = require('node:assert/strict');
const E = require('../js/engine.js');
for(const level of E.LEVELS){
 const e = new E.Engine(level);
 e.cake=level.shoppingList.slice().reverse();
 let r=E.score(e);assert.equal(r.total,level.shoppingList.length*50);assert.equal(r.perfect,true);assert.deepEqual(r.missing,[]);
 e.cake.push(e.cake[0]);assert.equal(E.score(e).total,r.total);assert.equal(E.score(e).rows.at(-1).pts,0);
 e.cake=[level.shoppingList[0]];r=E.score(e);assert.equal(r.total,50);assert.equal(r.missing.length,level.shoppingList.length-1);
 e.cake.push('양말');assert.equal(E.score(e).total,30);
 e.cake=['양말','TNT'];e.exploded=true;r=E.score(e);assert.equal(r.total,0);assert.equal(r.verdict,'boom');
 e.reset();assert.equal(E.score(e).verdict,'empty');
}
console.log('Shopping score checks passed');
