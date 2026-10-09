(function(){
'use strict';
var E = NauEngine, ITEMS = E.ITEMS, MAP = E.MAP;
var $ = function(id){ return document.getElementById(id); };

/* ---------- 효과음 (WebAudio, 파일 없음) ---------- */
var audio = { ctx:null, on:true };
function ensureAudio(){ if(!audio.ctx){ try{ audio.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audio.ctx=null; } } if(audio.ctx && audio.ctx.state==='suspended'){ audio.ctx.resume(); } }
function tone(freq, dur, type, gain, slide){
  if(!audio.on || !audio.ctx) return;
  try{
    var c=audio.ctx, o=c.createOscillator(), g=c.createGain();
    o.type=type||'square'; o.frequency.setValueAtTime(freq, c.currentTime);
    if(slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime+dur);
    g.gain.setValueAtTime(gain||0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+dur);
  }catch(e){}
}
function noise(dur, gain){
  if(!audio.on || !audio.ctx) return;
  try{
    var c=audio.ctx, n=c.sampleRate*dur, b=c.createBuffer(1,n,c.sampleRate), d=b.getChannelData(0);
    for(var i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    var s=c.createBufferSource(), g=c.createGain(); s.buffer=b; g.gain.value=gain||0.15; s.connect(g); g.connect(c.destination); s.start();
  }catch(e){}
}
var SFX = {
  step:function(){ tone(420,0.05,'triangle',0.04); },
  turn:function(){ tone(300,0.06,'sine',0.04,500); },
  bump:function(){ tone(90,0.18,'square',0.12,50); },
  bread:function(){ tone(520,0.12,'triangle',0.08,780); },
  cream:function(){ noise(0.25,0.08); tone(900,0.25,'sine',0.03,1400); },
  topping:function(){ tone(700,0.08,'square',0.06); setTimeout(function(){tone(1000,0.1,'square',0.06);},90); },
  deco:function(){ tone(1200,0.3,'sine',0.05,1600); },
  sock:function(){ tone(180,0.3,'sawtooth',0.05,120); },
  brick:function(){ noise(0.3,0.25); tone(70,0.3,'square',0.15,40); },
  gem:function(){ tone(1500,0.15,'sine',0.05); setTimeout(function(){tone(2000,0.2,'sine',0.05);},120); },
  boom:function(){ noise(0.9,0.5); tone(60,0.8,'sawtooth',0.3,25); },
  nothing:function(){ tone(260,0.1,'sine',0.04,200); },
  win:function(){ [523,659,784,1046].forEach(function(f,i){ setTimeout(function(){tone(f,0.25,'triangle',0.08);}, i*140); }); },
  lose:function(){ [392,330,262].forEach(function(f,i){ setTimeout(function(){tone(f,0.3,'sawtooth',0.06);}, i*220); }); }
};

/* ---------- 장면 전환 ---------- */
function showScene(n){
  $('scene-intro').classList.toggle('hidden', n!==1);
  $('scene-play').classList.toggle('hidden', n!==2);
  $('scene-result').classList.toggle('hidden', n!==3);
  $('st1').classList.toggle('on', n===1); $('st2').classList.toggle('on', n===2); $('st3').classList.toggle('on', n===3);
  window.scrollTo({top:0});
}
var toastTimer;
function toast(msg){ var t=$('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){t.classList.remove('on');},2200); }

/* ---------- 케이크 렌더 ---------- */
function layerClass(item){
  var k = ITEMS[item].kind;
  if(k==='trap'){ return 'layer trap ' + (item==='벽돌'?'brick': item==='다이아몬드'?'gem':'stinky'); }
  if(k==='boom') return 'layer boom';
  return 'layer ' + k;
}
function addLayer(cakeEl, item){
  var e = cakeEl.querySelector('.empty'); if(e) e.remove();
  var d = document.createElement('div');
  d.className = layerClass(item);
  d.textContent = ITEMS[item].emoji + ' ' + ITEMS[item].label;
  cakeEl.appendChild(d);
}
function resetCake(cakeEl, withPlate, emptyText){
  cakeEl.innerHTML='';
  if(withPlate){ var p=document.createElement('div'); p.className='plate'; cakeEl.appendChild(p); }
  if(emptyText){ var em=document.createElement('div'); em.className='empty'; em.textContent=emptyText; cakeEl.appendChild(em); }
}
function explode(cakeEl){
  var f=document.createElement('div'); f.className='fire'; f.textContent='💥'; cakeEl.appendChild(f);
  Array.prototype.forEach.call(cakeEl.querySelectorAll('.layer'), function(l,i){ l.style.transform='rotate('+((i%2?1:-1)*(8+i*4))+'deg) translateX('+((i%2?1:-1)*12)+'px)'; l.style.opacity='.55'; });
}

/* 인트로 히어로 케이크: 한눈에 보이는 "병맛" 예시 */
(function(){ var h=$('hero-cake'); resetCake(h,true); ['빵','생크림','양말','벽돌','딸기'].forEach(function(i){ addLayer(h,i); }); })();

/* ---------- 지도 ---------- */
var gridEl = $('grid'), nauEl;
function buildGrid(){
  gridEl.innerHTML='';
  for(var r=0;r<8;r++) for(var c=0;c<8;c++){
    var v = MAP[r][c], d=document.createElement('div'); d.className='cell';
    if(v==='#'){ d.classList.add('wall'); }
    else if(v==='S'){ d.classList.add('start'); d.innerHTML='🚪<small>입구</small>'; }
    else if(v==='E'){ d.classList.add('end'); d.innerHTML='🛒<small>계산대</small>'; }
    else if(ITEMS[v]){ d.classList.add(ITEMS[v].kind==='boom'?'boom': ITEMS[v].kind==='trap'?'trap':'item'); d.innerHTML=ITEMS[v].emoji+'<small>'+v+'</small>'; }
    d.title = v==='#'?'선반': v==='S'?'입구': v==='E'?'계산대': ITEMS[v]? ITEMS[v].label : '통로';
    gridEl.appendChild(d);
  }
  nauEl=document.createElement('div'); nauEl.className='nau'; nauEl.innerHTML='🧒<span class="dir">▲</span>'; gridEl.appendChild(nauEl);
}
function placeNau(eng, instant){
  if(instant) nauEl.style.transition='none';
  nauEl.style.left=(eng.c*12.5)+'%'; nauEl.style.top=(eng.r*12.5)+'%';
  nauEl.querySelector('.dir').style.transform='rotate('+(eng.d*90)+'deg)';
  var over = ITEMS[MAP[eng.r][eng.c]]; nauEl.classList.toggle('over', !!over);
  if(instant){ void nauEl.offsetWidth; nauEl.style.transition=''; }
}
function say(text, who){ $('bubble-text').textContent=text; $('bubble-who').textContent=who||'🧒'; }

/* ---------- 레시피 슬롯 ---------- */
var recipeEl=$('recipe');
function renderRecipe(cake){
  recipeEl.innerHTML='';
  var good = cake.filter(function(i){ return ITEMS[i].kind!=='trap' && ITEMS[i].kind!=='boom'; });
  E.RECIPE.forEach(function(kind, i){
    var s=document.createElement('div'); s.className='slot';
    var emo = {bread:'🍞',cream:'🍦',topping:'🍓🍫',deco:'🕯️'}[kind];
    s.innerHTML='<span class="n">'+(i+1)+'층</span><span class="e">'+emo+'</span>'+E.RECIPE_LABEL[i];
    if(good[i]){ s.classList.add(ITEMS[good[i]].kind===kind?'done':'bad'); }
    recipeEl.appendChild(s);
  });
}
function renderLiveList(cake){
  $('live-list').textContent = cake.length? cake.map(function(i){return ITEMS[i].emoji+' '+i;}).join(', ') : '아직 아무것도 없음';
}

/* ---------- Blockly ---------- */
var ws=null;
function initBlockly(){
  if(ws) return;
  Blockly.defineBlocksWithJsonArray([
    { type:'nau_move', message0:'앞으로 가기 🚶', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'보는 방향으로 한 칸 이동' },
    { type:'nau_left', message0:'왼쪽으로 돌기 ↩️', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'제자리에서 왼쪽으로 90도' },
    { type:'nau_right', message0:'오른쪽으로 돌기 ↪️', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'제자리에서 오른쪽으로 90도' },
    { type:'nau_pick', message0:'앞에 있는 물건 집기 ✋', previousStatement:null, nextStatement:null, style:'action_blocks', tooltip:'바로 앞 칸의 물건을 장바구니에' },
    { type:'nau_repeat', message0:'%1 번 반복하기 🔁', args0:[{ type:'field_number', name:'TIMES', value:3, min:1, max:20, precision:1 }],
      message1:'%1', args1:[{ type:'input_statement', name:'DO' }], previousStatement:null, nextStatement:null, style:'loop_blocks', tooltip:'안의 블록을 N번' },
    { type:'nau_if', message0:'만약 %1', args0:[{ type:'field_dropdown', name:'COND', options:[
        ['앞에 벽이 있다면','WALL'], ['앞에 벽이 없다면','NOWALL'], ['빵을 집었다면','GOT_BREAD'], ['생크림을 집었다면','GOT_CREAM'] ] }],
      message1:'%1', args1:[{ type:'input_statement', name:'DO' }], previousStatement:null, nextStatement:null, style:'logic_blocks', tooltip:'조건이 맞을 때만 안의 블록을 실행' }
  ]);
  var theme = Blockly.Theme.defineTheme('nau', {
    base: Blockly.Themes.Zelos,
    blockStyles: {
      move_blocks:   { colourPrimary:'#2F80ED', colourSecondary:'#8DB8F5', colourTertiary:'#1F5FB8' },
      action_blocks: { colourPrimary:'#E6334F', colourSecondary:'#F3A1AE', colourTertiary:'#B2223A' },
      loop_blocks:   { colourPrimary:'#F29E1F', colourSecondary:'#F8CF8D', colourTertiary:'#C27C12' },
      logic_blocks:  { colourPrimary:'#7B61FF', colourSecondary:'#BDB0FF', colourTertiary:'#5A44C9' }
    },
    componentStyles: { workspaceBackgroundColour:'#FFFDF5', flyoutBackgroundColour:'#F3E9D2', flyoutOpacity:1, scrollbarColour:'#C9B99A', insertionMarkerColour:'#1F1A14', insertionMarkerOpacity:0.3 },
    fontStyle: { family:"'Jua','Apple SD Gothic Neo','Malgun Gothic',sans-serif", weight:'normal', size:13 }
  });
  var toolbox = { kind:'flyoutToolbox', contents:[
    { kind:'block', type:'nau_move' }, { kind:'block', type:'nau_left' }, { kind:'block', type:'nau_right' },
    { kind:'block', type:'nau_pick' }, { kind:'block', type:'nau_repeat' }, { kind:'block', type:'nau_if' } ] };
  ws = Blockly.inject('blocklyDiv', {
    toolbox: toolbox, renderer:'zelos', theme: theme, trashcan:false, sounds:false,
    scrollbars:true, move:{ scrollbars:true, drag:true, wheel:true }, zoom:{ controls:false, wheel:false, startScale:0.8 },
    grid:{ spacing:24, length:2, colour:'#E4D8BC', snap:false }
  });
  // 시작 예시: 3번 앞으로 → 오른쪽 → 집기 (빵 하나)
  Blockly.serialization.workspaces.load({ blocks:{ languageVersion:0, blocks:[
    { type:'nau_repeat', x:24, y:24, fields:{ TIMES:3 }, inputs:{ DO:{ block:{ type:'nau_move' } } },
      next:{ block:{ type:'nau_right', next:{ block:{ type:'nau_pick' } } } } } ] } }, ws);
  ws.addChangeListener(function(e){ if(e.isUiEvent) return; updateCount(); });
  updateCount();
  window.addEventListener('resize', function(){ Blockly.svgResize(ws); });
}
function readChain(b){ var out=[]; while(b){ out.push(readBlock(b)); b=b.getNextBlock(); } return out; }
function readBlock(b){
  switch(b.type){
    case 'nau_move': return { op:'move', id:b.id };
    case 'nau_left': return { op:'left', id:b.id };
    case 'nau_right': return { op:'right', id:b.id };
    case 'nau_pick': return { op:'pick', id:b.id };
    case 'nau_repeat': return { op:'repeat', id:b.id, n: Math.max(1, Math.min(20, Number(b.getFieldValue('TIMES'))||1)), body: readChain(b.getInputTargetBlock('DO')) };
    case 'nau_if': return { op:'if', id:b.id, cond:b.getFieldValue('COND'), body: readChain(b.getInputTargetBlock('DO')) };
  }
  return { op:'noop', id:b.id };
}
function readProgram(){
  var tops = ws.getTopBlocks(true), seq=[];
  tops.forEach(function(b){ seq = seq.concat(readChain(b)); });
  return { ast: seq, chains: tops.length };
}
function updateCount(){ if(!ws) return; $('block-count').textContent='블록 '+ws.getAllBlocks(false).length+'개'; }

/* ---------- 실행 ---------- */
var eng = new E.Engine(), running=false, stopRequested=false, lastResult=null;
var SPEEDS = { 1:650, 2:380, 3:160 }, SPEED_LABEL = { 1:'느림', 2:'보통', 3:'빠름' };
function delayMs(){ return SPEEDS[$('speed').value] || 380; }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
var PICK_LINES = {
  '빵':'앗, 빵 발견! 폭신폭신~ 집어 들었어요!', '생크림':'푸슉~ 생크림 담았어요!', '딸기':'딸기 하나 콕!', '초콜릿':'초콜릿 획득! 조금 녹았어요.',
  '초':'초까지 챙겼어요. 불은 아직 안 붙였어요.', '양말':'찌걱.. 뭔가 축축하고 냄새나요…', '벽돌':'콰광! 이거 왜 이렇게 무거워요?',
  '다이아몬드':'반짝반짝… 근데 케이크에 왜 넣죠?'
};
function resetRun(){
  eng.reset(); placeNau(eng, true); nauEl.classList.remove('bump');
  resetCake($('live-cake'), true, '장바구니가 비어 있어요'); renderRecipe([]); renderLiveList([]);
}
function handleEvent(ev){
  switch(ev.type){
    case 'move': placeNau(eng); SFX.step(); if(ev.over){ say('조심조심… '+ITEMS[ev.over].emoji+' 선반 사이를 지나가요.'); } break;
    case 'bump': nauEl.classList.remove('bump'); void nauEl.offsetWidth; nauEl.classList.add('bump'); SFX.bump(); say('쿵! 앞은 선반이에요. 못 지나가요.'); break;
    case 'turn': placeNau(eng); SFX.turn(); break;
    case 'pick': addLayer($('live-cake'), ev.item); renderRecipe(eng.cake); renderLiveList(eng.cake); SFX[ITEMS[ev.item].sound](); say(PICK_LINES[ev.item]||'집었어요!'); break;
    case 'pickNothing': SFX.nothing(); say('앞에 아무것도 없어요. 허공을 집었어요.'); break;
    case 'boom': addLayer($('live-cake'), ev.item); renderLiveList(eng.cake); explode($('live-cake')); SFX.boom(); say('펑!!! 다이너마이트였어요!!', '💥'); break;
    case 'checkout': placeNau(eng); SFX.deco(); say('계산대 도착! 장보기 끝!', '🛒'); break;
    case 'repeat': say(ev.n+'번 반복 시작!'); break;
    case 'if': say('조건 확인 → '+(ev.ok?'맞아요, 안쪽 실행!':'아니에요, 건너뛰어요.')); break;
  }
}
function setRunningUI(on){
  running=on; $('ws-lock').classList.toggle('on', on);
  $('btn-run').disabled=on; $('btn-stop').disabled=!on; $('btn-clear').disabled=on;
}
async function runProgram(){
  if(running) return;
  ensureAudio();
  var prog = readProgram();
  if(!prog.ast.length){ toast('블록을 하나 이상 놓아주세요'); return; }
  if(prog.chains>1) toast('연결 안 된 블록 뭉치가 '+prog.chains+'개예요. 위에서 아래 순서로 모두 실행해요.');
  stopRequested=false; setRunningUI(true); resetRun(); say('출발!');
  var gen = E.interpret(prog.ast, eng), step;
  await sleep(300);
  while(!(step=gen.next()).done){
    if(stopRequested) break;
    try{ ws.highlightBlock(step.value.node.id); }catch(e){}
    handleEvent(step.value.ev);
    var t = step.value.ev.type;
    await sleep(t==='boom'?1200 : (t==='repeat'||t==='if')? delayMs()*0.5 : delayMs());
  }
  try{ ws.highlightBlock(null); }catch(e){}
  setRunningUI(false);
  if(stopRequested){ say('멈췄어요. 블록을 고치고 다시 실행해요.'); return; }
  if(eng.overflow) toast('동작이 너무 많아서 중간에 멈췄어요 (상한 600). 반복 횟수를 줄여보세요.');
  var blocks = ws.getAllBlocks(false).length;
  lastResult = { res: E.score(eng), blocks: blocks, actions: eng.actions, bumps: eng.bumps, cake: eng.cake.slice(), exploded: eng.exploded };
  await sleep(700);
  showResult();
}

/* ---------- 결과 ---------- */
var VERDICTS = {
  perfect:{ emoji:'🎉', title:'완벽한 케이크!', sub:'효도 성공! 감동의 눈물! 😭💖' },
  weird:{ emoji:'🔪', title:'이상한 케이크', sub:'엄마가 케이크를 자르다가 칼이 부러졌습니다. "…이게 뭐야?"' },
  empty:{ emoji:'😭', title:'빈손…', sub:'마트 구경만 하고 왔나요? 등짝 스매싱! 💥' },
  boom:{ emoji:'💥', title:'폭발 엔딩', sub:'케이크 대신 폭죽이… 생신 파티는 소방서에서 하게 됐어요.' }
};
function showResult(){
  var R = lastResult, v = VERDICTS[R.res.verdict];
  $('res-emoji').textContent=v.emoji; $('res-title').textContent=v.title; $('res-sub').textContent=v.sub;
  var title = E.rankTitle(R.res, R.blocks);
  $('res-badge').innerHTML = title? '<span class="title-badge">🏷️ 칭호: '+title+'</span>' : '';
  $('res-score').textContent=R.res.total; $('res-blocks').textContent=R.blocks; $('res-actions').textContent=R.actions; $('res-bumps').textContent=R.bumps;
  $('res-traps').textContent=R.cake.filter(function(i){ return ITEMS[i].kind==='trap'||ITEMS[i].kind==='boom'; }).length;
  var tb=$('res-rows'); tb.innerHTML='';
  if(!R.res.rows.length){ tb.innerHTML='<tr><td colspan="4" style="color:var(--muted)">아무것도 집지 않았어요.</td></tr>'; }
  R.res.rows.forEach(function(row,i){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+(i+1)+'</td><td>'+row.emoji+' '+row.label+'</td><td>'+row.verdict+'</td><td class="pts '+(row.pts>0?'plus':'minus')+'">'+(row.pts>0?'+':'')+row.pts+'</td>';
    tb.appendChild(tr);
  });
  // 케이크 다시 쌓기 연출
  var ck=$('res-cake'); resetCake(ck, true, R.cake.length? '' : '텅 빈 접시…');
  showScene(3);
  R.cake.forEach(function(item,i){ setTimeout(function(){ addLayer(ck,item); if(ITEMS[item].kind==='boom'){ explode(ck); SFX.boom(); } else { SFX[ITEMS[item].sound](); } }, 350+i*420); });
  setTimeout(function(){ if(R.res.verdict==='perfect') SFX.win(); else if(R.res.verdict!=='boom') SFX.lose(); }, 400+R.cake.length*420);
  $('hof-name').value=''; $('hof-submit').disabled=false; $('hof-submit').textContent='등록';
  renderHof(null);
}

/* ---------- 명예의 전당 (localStorage, 실패해도 조용히) ---------- */
var HOF_KEY='nau_cake_hof_v1';
function loadHof(){ try{ var s=localStorage.getItem(HOF_KEY); return s? JSON.parse(s): []; }catch(e){ return []; } }
function saveHof(list){ try{ localStorage.setItem(HOF_KEY, JSON.stringify(list)); return true; }catch(e){ return false; } }
function renderHof(mine){
  var list = loadHof().sort(E.compareEntries).slice(0,10), ol=$('hof-list'); ol.innerHTML='';
  if(!list.length){ ol.innerHTML='<li style="display:block;color:var(--muted)">아직 아무도 없어요. 첫 번째로 이름을 남겨보세요.</li>'; return; }
  list.forEach(function(e,i){
    var li=document.createElement('li'); if(mine && e.ts===mine) li.classList.add('me');
    li.innerHTML='<span class="rk">'+(i+1)+'</span><span>'+escapeHtml(e.name)+' <span class="meta">'+e.cake.map(function(x){return ITEMS[x]?ITEMS[x].emoji:'';}).join('')+'</span></span><span class="meta">블록 '+e.blocks+' · 동작 '+e.actions+'</span><span class="sc">'+e.score+'</span>';
    ol.appendChild(li);
  });
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* ---------- 이벤트 바인딩 ---------- */
$('btn-start').addEventListener('click', function(){
  showScene(2); buildGrid(); resetRun(); renderRecipe([]);
  try{ initBlockly(); Blockly.svgResize(ws); }catch(e){ toast('블록 편집기를 불러오지 못했어요: '+e.message); }
});
$('btn-run').addEventListener('click', function(){ runProgram(); });
$('btn-stop').addEventListener('click', function(){ stopRequested=true; });
$('btn-clear').addEventListener('click', function(){ if(ws && confirm('블록을 모두 지울까요?')){ ws.clear(); updateCount(); } });
$('btn-sound').addEventListener('click', function(){ audio.on=!audio.on; this.textContent=audio.on?'🔊':'🔇'; if(audio.on){ ensureAudio(); SFX.bread(); } });
$('speed').addEventListener('input', function(){ $('speed-label').textContent=SPEED_LABEL[this.value]; });
$('btn-retry').addEventListener('click', function(){ showScene(2); resetRun(); say('블록을 고쳐서 다시 도전!'); Blockly.svgResize(ws); });
$('btn-restart').addEventListener('click', function(){ showScene(1); if(ws){ ws.clear(); updateCount(); } });
$('hof-form').addEventListener('submit', function(ev){
  ev.preventDefault();
  if(!lastResult) return;
  var name=$('hof-name').value.trim() || '이름 없는 효자';
  var list=loadHof(); var entry={ name:name, score:lastResult.res.total, blocks:lastResult.blocks, actions:lastResult.actions, cake:lastResult.cake, ts:Date.now() };
  list.push(entry);
  if(saveHof(list)){ $('hof-submit').disabled=true; $('hof-submit').textContent='등록됨'; renderHof(entry.ts); toast('명예의 전당에 올렸어요'); }
  else { toast('이 브라우저에서는 저장이 안 돼요 (저장 공간 차단)'); renderHof(null); }
});
})();
