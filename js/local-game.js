/* Server-free game sessions for file:// and static hosting. Shared rankings stay server-only. */
(function(root){
'use strict';
function create(E, now){
  now=now||Date.now;
  var sessions=new Map(), sequence=0;
  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function session(id){
    var found=sessions.get(id);
    if(!found) throw new Error('새 맵을 시작해 주세요.');
    return found;
  }
  function snapshot(s){
    return clone({id:s.id,map:s.map,shoppingList:s.shoppingList,challenge:s.challenge,
      startedAt:s.startedAt,serverNow:now(),elapsedBaseMs:s.elapsedBaseMs});
  }
  function countBlocks(ast){ return ast.reduce(function(n,node){return n+1+(node.body?countBlocks(node.body):0);},0); }
  async function request(path,body){
    if(path==='attempts'){
      var level=E.levelById(body.level);
      if(!level) throw new Error('난이도를 선택해 주세요.');
      var previous=body.retryOf?session(body.retryOf):null;
      var generated=previous||E.generateLevel(level);
      var id='local-'+(++sequence);
      var s={id:id,map:clone(generated.map),shoppingList:clone(generated.shoppingList),
        challenge:previous?clone(previous.challenge):{id:id,label:'랜덤 도전'},
        startedAt:body.deferStart?null:now(),elapsedBaseMs:previous?(previous.outcome?previous.outcome.elapsedMs:previous.elapsedBaseMs):0,outcome:null};
      sessions.set(id,s);
      return snapshot(s);
    }
    var route=/^attempts\/([^/]+)\/(start|finish)$/.exec(path);
    if(!route) throw new Error('공유 순위는 별도 서버 연결 후 이용할 수 있어요.');
    var s=session(decodeURIComponent(route[1]));
    if(route[2]==='start'){
      if(s.startedAt===null) s.startedAt=now();
      return snapshot(s);
    }
    if(s.startedAt===null) throw new Error('안내의 시작하기를 눌러 주세요.');
    if(!s.outcome){
      var engine=new E.Engine({map:clone(s.map),shoppingList:clone(s.shoppingList)});
      Array.from(E.interpret(body.program,engine));
      s.outcome={result:E.score(engine),actions:engine.actions,blocks:countBlocks(body.program)+1,
        checkedOut:engine.checkedOut,elapsedMs:s.elapsedBaseMs+Math.max(0,now()-s.startedAt),eligible:false};
    }
    return clone(s.outcome);
  }
  return {request:request};
}
var api={create:create};
if(typeof module!=='undefined' && module.exports) module.exports=api;
else root.NauLocalGame=api;
})(typeof globalThis!=='undefined'?globalThis:this);
