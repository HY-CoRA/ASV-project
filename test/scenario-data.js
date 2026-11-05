/* 브라우저/Node 검증에 사용하는 입력 블록. 실제 게임 엔진은 변경하지 않는다. */
(function(root){
  const E = typeof module !== 'undefined' ? require('../js/engine.js') : root.NauEngine;
  function route(level, items) {
    let position = [0, 0, 1], result = [];
    for (const item of items) {
      let target;
      level.map.forEach((row,r)=>row.forEach((cell,c)=>{if(cell===item) target=[r,c];}));
      if(!target) throw Error('Missing item: '+item);
      const queue=[{p:position, path:[]}], seen=new Set(); let found;
      for(let i=0;i<queue.length;i++) {
        const {p,path}=queue[i], [r,c,d]=p, key=p.join(',');
        if(seen.has(key)) continue; seen.add(key);
        if(r===target[0] && c===target[1]) { found={p,path}; break; }
        const [dr,dc]=E.DIRS[d];
        if(level.map[r+dr] && level.map[r+dr][c+dc]!==undefined && level.map[r+dr][c+dc]!=='#') queue.push({p:[r+dr,c+dc,d],path:path.concat({op:'move'})});
        queue.push({p:[r,c,(d+3)%4],path:path.concat({op:'left'})},{p:[r,c,(d+1)%4],path:path.concat({op:'right'})});
      }
      if(!found) throw Error('Unreachable item: '+item);
      result=result.concat(found.path,{op:'pick'}); position=found.p;
    }
    return result.concat({op:'checkout'});
  }
  function compact(seq) {
    const result=[];
    for(let i=0;i<seq.length;i++) {
      if(seq[i].op==='move') {
        let count=1; while(seq[i+count] && seq[i+count].op==='move') count++;
        if(count>=3) { result.push({op:'repeat',n:count,body:[{op:'move'}]}); i+=count-1; continue; }
      }
      result.push(seq[i]);
    }
    return result;
  }
  function blocks(seq) {
    let next;
    for(let i=seq.length-1;i>=0;i--) {
      const n=seq[i], b={type:'nau_'+n.op};
      if(n.op==='repeat'){ b.fields={TIMES:n.n}; b.inputs={DO:{block:blocks(n.body)}}; }
      if(n.op==='if'){ b.fields={COND:n.cond}; b.inputs={DO:{block:blocks(n.body)}}; }
      if(next) b.next={block:next}; next=b;
    }
    return next;
  }
  const cases = [
    {name:'레벨 1 · 모두 담고 계산 (150점)',level:1,seq:route(E.LEVELS[0],E.LEVELS[0].shoppingList)},
    {name:'레벨 2 · 모두 담고 계산 (250점)',level:2,seq:compact(route(E.LEVELS[1],E.LEVELS[1].shoppingList))},
    {name:'레벨 2 · 함정 3종 포함 (190점)',level:2,seq:compact(route(E.LEVELS[1],E.LEVELS[1].shoppingList.concat(['초콜릿','양말','다이아몬드'])))},
    {name:'레벨 1 · TNT 폭발 (0점)',level:1,seq:route(E.LEVELS[0],['토마토','TNT'])},
    {name:'레벨 1 · 누락 품목 (50점)',level:1,seq:[{op:'move'},{op:'move'},{op:'pick'},{op:'checkout'}]},
    {name:'빈 장바구니 계산 (0점)',level:1,seq:[{op:'checkout'}]},
    {name:'계산하기 없음 · 가이드만 실행',level:1,seq:[{op:'move'},{op:'move'},{op:'pick'}]},
    {name:'계산하기 뒤에 이동 · 실행 차단',level:1,seq:[{op:'checkout'},{op:'move'}]},
    {name:'반복 안의 계산하기 · 실행 차단',level:1,seq:[{op:'repeat',n:2,body:[{op:'checkout'}]}]},
    {name:'떨어진 계산하기 · 실행 차단',level:1,seq:[{op:'move'},{op:'move'},{op:'pick'}],extra:[{op:'checkout'}]},
    {name:'멈춤/빈 칸/벽 · 긴 실행',level:1,seq:[{op:'pick'},{op:'repeat',n:20,body:[{op:'move'}]}]},
    {name:'조건: 아이템 칸은 벽 아님',level:1,seq:[{op:'move'},{op:'if',cond:'NOWALL',body:[{op:'move'}]},{op:'pick'},{op:'checkout'}]}
  ];
  cases.push({name:'레벨 2 · 8개 담고 계산 전 (배치 검증)',level:2,seq:compact(route(E.LEVELS[1],E.LEVELS[1].shoppingList.concat(['초콜릿','양말','다이아몬드']))).slice(0,-1)});
  cases.push({name:'레벨 2 · 5개 담고 계산 전 (배치 검증)',level:2,seq:compact(route(E.LEVELS[1],E.LEVELS[1].shoppingList)).slice(0,-1)});
  const api={route,compact,blocks,cases};
  if(typeof module !== 'undefined') module.exports=api; else root.ShoppingScenarios=api;
})(typeof globalThis !== 'undefined'?globalThis:this);
