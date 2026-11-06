const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../js/engine.js');
const {create}=require('../js/local-game.js');
test('static sessions generate both levels without network or browser storage',async()=>{
  const game=create(E);
  for(const level of [1,2]){
    const a=await game.request('attempts',{level});
    assert.equal(a.map.length,level===1?5:8);
    assert.equal(a.shoppingList.length,level===1?3:5);
    const res=await game.request('attempts/'+a.id+'/finish',{program:[{op:'checkout'}]});
    assert.equal(res.checkedOut,true); assert.equal(res.eligible,false);
    assert.equal(res.result.total,0);assert.equal(res.blocks,2);
  }
});
test('guide, repeated activation, finish and retry preserve map and accumulated clock',async()=>{
  let time=1000;const game=create(E,()=>time);
  const a=await game.request('attempts',{level:1,deferStart:true});assert.equal(a.startedAt,null);
  await assert.rejects(game.request('attempts/'+a.id+'/finish',{program:[]}));
  time=9000;await game.request('attempts/'+a.id+'/start',{});
  time=10000;assert.equal((await game.request('attempts/'+a.id+'/start',{})).startedAt,9000);
  time=12000;const res=await game.request('attempts/'+a.id+'/finish',{program:[{op:'checkout'}]});assert.equal(res.elapsedMs,3000);
  time=30000;assert.deepEqual(await game.request('attempts/'+a.id+'/finish',{program:[]}),res);
  const retry=await game.request('attempts',{level:1,retryOf:a.id});
  assert.deepEqual(retry.map,a.map);assert.deepEqual(retry.shoppingList,a.shoppingList);assert.equal(retry.elapsedBaseMs,3000);
  retry.map[0][0]='#';assert.notDeepEqual((await game.request('attempts',{level:1,retryOf:a.id})).map,retry.map);
});
