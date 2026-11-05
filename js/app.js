(function(){
'use strict';
var E = NauEngine, ITEMS = E.ITEMS;
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

/* ---------- 레벨 선택 (URL ?level=N&lock=1) ---------- */
var params = new URLSearchParams(location.search);
var level = E.levelById(params.get('level')) || E.LEVELS[0];
var locked = params.get('lock') === '1';
var eng = new E.Engine(level);

function renderLevelPicker(){
  var box = $('level-picker'); box.innerHTML='';
  E.LEVELS.forEach(function(lv){
    var card = document.createElement('button'); card.type='button'; card.className='level-card'+(lv.id===level.id?' on':'');
    card.setAttribute('aria-pressed', lv.id===level.id?'true':'false');
    var recipe = lv.shoppingList.map(function(item){ return ITEMS[item].emoji; }).join(' · ');
    card.innerHTML = '<b>'+lv.name+'</b><span class="who">'+lv.who+'</span><span class="rc">'+recipe+'</span><span class="ds">'+lv.desc+'</span>';
    card.addEventListener('click', function(){ selectLevel(lv); });
    box.appendChild(card);
  });
  $('level-label').textContent = level.name;
  $('score-rule').textContent = '목록 품목 첫 담기 +50점 · '+(level.id===1?'TNT −100점':'함정 −20점')+' · 최저 0점';
  $('btn-start').textContent = '▶ '+level.name.split(' · ')[0]+' 시작하기';
  resetCake($('hero-cake'), false);
  level.shoppingList.forEach(function(item){ addLayer($('hero-cake'), item); });
}
function selectLevel(lv){
  level = lv; eng.setLevel(lv);
  if(ws){ ws.clear(); loadStarter(); updateCount(); }
  renderLevelPicker();
}
if(locked){ var pk=$('level-picker-wrap'); if(pk) pk.classList.add('hidden'); }

/* ---------- 장면 전환 ---------- */
function showScene(n){
  $('scene-intro').classList.toggle('hidden', n!==1);
  $('scene-play').classList.toggle('hidden', n!==2);
  $('scene-result').classList.toggle('hidden', n!==3);
  document.body.classList.toggle('playing', n===2);
  window.scrollTo({top:0});
}
var toastTimer;
function toast(msg){ var t=$('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){t.classList.remove('on');},2200); }

/* ---------- 장바구니 렌더 ---------- */
function addLayer(basket, item){
  var empty = basket.querySelector('.empty'); if(empty) empty.remove();
  var card = document.createElement('div');
  card.className = 'basket-item ' + ITEMS[item].kind;
  var order=basket.querySelectorAll('.basket-item').length + 1;
  card.setAttribute('aria-label', order+'. '+item);
  [['item-order',order+'. '],['item-icon',ITEMS[item].emoji+' '],['item-name',item]].forEach(function(part){
    var span=document.createElement('span'); span.className=part[0]; span.textContent=part[1]; card.appendChild(span);
  });
  basket.appendChild(card);
}
function resetCake(basket, unused, emptyText){
  basket.innerHTML='';
  if(emptyText){ var empty=document.createElement('p'); empty.className='empty'; empty.textContent=emptyText; basket.appendChild(empty); }
}
function explode(cakeEl){
  var f=document.createElement('div'); f.className='fire'; f.textContent='💥'; cakeEl.appendChild(f);
  Array.prototype.forEach.call(cakeEl.querySelectorAll('.basket-item'), function(l,i){ l.style.transform='rotate('+((i%2?1:-1)*(8+i*4))+'deg) translateX('+((i%2?1:-1)*12)+'px)'; l.style.opacity='.55'; });
}
(function(){ var h=$('hero-cake'); resetCake(h,true); ['토마토','감자','고구마'].forEach(function(i){ addLayer(h,i); }); })();

/* ---------- 지도 ---------- */
var gridEl = $('grid'), nauEl;
function buildGrid(){
  gridEl.innerHTML='';
  gridEl.style.gridTemplateColumns='repeat('+eng.cols+',minmax(0,1fr))';
  gridEl.style.gridTemplateRows='repeat('+eng.rows+',minmax(0,1fr))';
  gridEl.style.aspectRatio=eng.cols+' / '+eng.rows;
  gridEl.setAttribute('aria-label','마트 지도 '+eng.rows+'x'+eng.cols);
  for(var r=0;r<eng.rows;r++) for(var c=0;c<eng.cols;c++){
    var v = eng.map[r][c], d=document.createElement('div'); d.className='cell';
    if(v==='#'){ d.classList.add('wall'); }
    else if(v==='S'){ d.classList.add('start'); d.innerHTML='<span class="b">🚪</span><small>입구</small>'; }
    else if(ITEMS[v]){ d.classList.add(ITEMS[v].kind==='boom'?'boom': ITEMS[v].kind==='trap'?'trap':'item'); d.innerHTML='<span class="b">'+ITEMS[v].emoji+'</span><small>'+v+'</small>'; }
    d.title = v==='#'?'벽': v==='S'?'입구': ITEMS[v]? ITEMS[v].label+' · 이 칸에 서서 담아요' : '통로';
    d.dataset.row=r; d.dataset.col=c;
    gridEl.appendChild(d);
  }
  nauEl=document.createElement('div'); nauEl.className='nau';
  nauEl.style.width=(100/eng.cols)+'%'; nauEl.style.height=(100/eng.rows)+'%';
  nauEl.innerHTML='<span class="body">🧒</span><span class="dir">▲</span>'; gridEl.appendChild(nauEl);
}
function placeNau(instant){
  var previous=gridEl.querySelector('.current'); if(previous) previous.classList.remove('current');
  var current=gridEl.querySelector('[data-row="'+eng.r+'"][data-col="'+eng.c+'"]'); if(current) current.classList.add('current');
  nauEl.setAttribute('aria-label', '나우: '+(eng.r+1)+'행 '+(eng.c+1)+'열, '+['북','동','남','서'][eng.d]+'쪽');
  if(instant) nauEl.style.transition='none';
  nauEl.style.left=(eng.c*100/eng.cols)+'%'; nauEl.style.top=(eng.r*100/eng.rows)+'%';
  nauEl.querySelector('.dir').style.transform='rotate('+(eng.d*90)+'deg)';
  if(instant){ void nauEl.offsetWidth; nauEl.style.transition=''; }
}
function say(text, who){ $('bubble-text').textContent=text; $('bubble-who').textContent=who||'🧒'; }

/* ---------- 장보기 목록 ---------- */
var recipeEl=$('recipe');
function renderRecipe(cake){
  recipeEl.innerHTML='';
  eng.level.shoppingList.forEach(function(item){
    var done = cake.indexOf(item) >= 0;
    var slot = document.createElement('div'); slot.className='slot'+(done?' done':'');
    slot.innerHTML='<span class="n">'+(done?'✓ 담음':'미담음')+'</span><span class="e">'+ITEMS[item].emoji+'</span>'+item;
    recipeEl.appendChild(slot);
  });
}
function renderLiveList(cake){
  $('live-list').textContent = '현재 점수 ' + E.score(eng).total + '점';
}

/* ---------- Blockly ---------- */
var ws=null;
function loadStarter(){ try{ Blockly.serialization.workspaces.load(level.starter, ws); }catch(e){} }
function initBlockly(){
  if(ws) return;
  Blockly.defineBlocksWithJsonArray([
    { type:'nau_move', message0:'앞으로 가기 🚶', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'보는 방향으로 한 칸 이동' },
    { type:'nau_left', message0:'왼쪽으로 돌기 ↩️', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'제자리에서 왼쪽으로 90도' },
    { type:'nau_right', message0:'오른쪽으로 돌기 ↪️', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'제자리에서 오른쪽으로 90도' },
    { type:'nau_pick', message0:'여기 물건 담기 ✋', previousStatement:null, nextStatement:null, style:'action_blocks', tooltip:'나우가 서 있는 칸의 물건을 장바구니에 담아요.' },
    { type:'nau_checkout', message0:'계산하기 🛒', previousStatement:null, nextStatement:null, style:'action_blocks', tooltip:'마지막 블록으로 연결해 장보기를 마쳐요.' },
    { type:'nau_repeat', message0:'%1 번 반복하기 🔁', args0:[{ type:'field_number', name:'TIMES', value:3, min:1, max:20, precision:1 }],
      message1:'%1', args1:[{ type:'input_statement', name:'DO' }], previousStatement:null, nextStatement:null, style:'loop_blocks', tooltip:'안의 블록을 N번' },
    { type:'nau_if', message0:'만약 %1', args0:[{ type:'field_dropdown', name:'COND', options:[
        ['앞에 벽이 있다면','WALL'], ['앞에 벽이 없다면','NOWALL'], ['빵을 집었다면','GOT_BREAD'], ['목록 품목을 담았다면','GOT_WANTED'] ] }],
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
    { kind:'block', type:'nau_pick' }, { kind:'block', type:'nau_checkout' }, { kind:'block', type:'nau_repeat' }, { kind:'block', type:'nau_if' } ] };
  ws = Blockly.inject('blocklyDiv', {
    toolbox: toolbox, renderer:'zelos', theme: theme, trashcan:false, sounds:false,
    scrollbars:true, move:{ scrollbars:true, drag:true, wheel:true }, zoom:{ controls:true, wheel:false, startScale:window.innerWidth<700?0.65:0.8, minScale:0.4, maxScale:1.2, scaleSpeed:1.15 },
    grid:{ spacing:24, length:2, colour:'#E4D8BC', snap:false }
  });
  loadStarter();
  ws.addChangeListener(function(e){ if(e.isUiEvent) return; updateCount(); });
  updateCount();
  var editorObserver=new ResizeObserver(function(){ Blockly.svgResize(ws); });
  editorObserver.observe($('blocklyDiv'));
  window.addEventListener('resize', function(){ Blockly.svgResize(ws); });
}
function readChain(b){ var out=[]; while(b){ out.push(readBlock(b)); b=b.getNextBlock(); } return out; }
function readBlock(b){
  switch(b.type){
    case 'nau_move': return { op:'move', id:b.id };
    case 'nau_left': return { op:'left', id:b.id };
    case 'nau_right': return { op:'right', id:b.id };
    case 'nau_checkout': return { op:'checkout', id:b.id };
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
var running=false, stopRequested=false, lastResult=null;
var SPEEDS = { 1:650, 2:380, 3:160 }, SPEED_LABEL = { 1:'느림', 2:'보통', 3:'빠름' };
function delayMs(){ return SPEEDS[$('speed').value] || 380; }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function resetRun(){
  eng.reset(); buildGrid(); placeNau(true); nauEl.classList.remove('bump');
  resetCake($('live-cake'), true, '장바구니가 비어 있어요'); renderRecipe([]); renderLiveList([]);
}
function handleEvent(ev){
  switch(ev.type){
    case 'move': placeNau(); SFX.step(); var here=eng.cellAt(eng.r,eng.c); if(ITEMS[here]) say(here+' 칸이에요. 여기 물건 담기로 담아요.'); break;
    case 'bump': nauEl.classList.remove('bump'); void nauEl.offsetWidth; nauEl.classList.add('bump'); SFX.bump(); say('쿵! 벽이나 지도 밖으로는 갈 수 없어요.'); break;
    case 'turn': placeNau(); SFX.turn(); break;
    case 'pick': buildGrid(); placeNau(true); addLayer($('live-cake'), ev.item); renderRecipe(eng.cake); renderLiveList(eng.cake); SFX[ITEMS[ev.item].sound](); say(ev.item+' 담았어요! '+(level.shoppingList.indexOf(ev.item)<0?'목록에 없는 물건이라 20점이 줄어요.':'+50점'));  break;
    case 'pickNothing': SFX.nothing(); say('여기에는 담을 물건이 없어요.'); break;
    case 'boom': buildGrid(); placeNau(true); addLayer($('live-cake'), ev.item); renderLiveList(eng.cake); explode($('live-cake')); SFX.boom(); say('TNT를 담았어요! 장보기를 멈춰요.', '💥'); break;
    case 'checkout': placeNau(); SFX.deco(); say('계산 완료! 장보기 끝!', '🛒'); break;
    case 'repeat': say(ev.n+'번 반복 시작!'); break;
    case 'if': say('조건 확인 → '+(ev.ok?'맞아요, 안쪽 실행!':'아니에요, 건너뛰어요.')); break;
  }
}
function setRunningUI(on){
  running=on; $('ws-lock').classList.toggle('on', on);
  document.querySelector('.editor-area').inert=on;
  $('btn-guide').disabled=on; $('btn-fit').disabled=on; $('btn-run').disabled=on; $('btn-stop').disabled=!on; $('btn-clear').disabled=on; $('btn-level').disabled=on;
}
function highlightStep(node){
  ws.highlightBlock(node.id);
  var block=ws.getBlockById(node.id), root=block && block.getSvgRoot();
  var path=root && root.querySelector('.blocklyPath');
  if(!path) return;
  var r=path.getBoundingClientRect(), view=$('blocklyDiv').getBoundingClientRect();
  if(r.top<view.top+10 || r.top+Math.min(r.height,35)>view.bottom-25 || r.right>view.right-25){
    ws.centerOnBlock(node.id,true);
  }
}
async function runProgram(){
  if(running) return;
  var prog = readProgram();
  if(!prog.ast.length){ say('블록을 놓고 연결해 주세요. 가이드 다시 놓기로 시작할 수 있어요.'); return; }
  if(prog.chains>1){ say('떨어진 블록이 있어요. 위에서 아래로 한 줄로 연결해 주세요.'); toast('블록들을 한 줄로 연결해 주세요'); return; }
  function hasCheckout(nodes){ return nodes.some(function(n){ return n.op==='checkout' || (n.body && hasCheckout(n.body)); }); }
  if(hasCheckout(prog.ast) && !E.validCheckout(prog.ast)){
    say('계산하기는 반복·조건 밖, 맨 마지막에 한 개만 놓아 주세요.');
    toast('계산하기 블록 위치를 확인해 주세요'); return;
  }
  ensureAudio(); stopRequested=false; setRunningUI(true); resetRun(); say('출발! 연결한 블록을 따라가요.');
  try {
    var gen=E.interpret(prog.ast,eng), step;
    await sleep(250);
    // 멈춘 뒤 next()를 호출하면 화면에 보이지 않는 동작이 실행되므로 먼저 검사한다.
    while(!stopRequested){
      step=gen.next(); if(step.done) break;
      highlightStep(step.value.node);
      handleEvent(step.value.ev);
      var t=step.value.ev.type;
      await sleep(t==='boom'?900:(t==='repeat'||t==='if')?delayMs()*0.5:delayMs());
    }
    ws.highlightBlock(null);
    if(stopRequested){ say('멈췄어요. 다시 실행하면 처음 위치부터 시작해요.'); return; }
    if(eng.overflow){ say('동작이 600회를 넘었어요. 반복 횟수를 줄여 다시 실행해 주세요.'); return; }
    if(!eng.checkedOut && !eng.exploded){ say('장보기를 마치려면 마지막에 계산하기 블록을 넣어 주세요.'); return; }
    lastResult={level:level,res:E.score(eng),blocks:ws.getAllBlocks(false).length,actions:eng.actions,bumps:eng.bumps,cake:eng.cake.slice(),exploded:eng.exploded};
    // 결과 전환이 끝날 때까지 재실행과 레벨 변경을 잠근다.
    $('btn-stop').disabled=true;
    await sleep(400);
    showResult();
  } catch(error){
    say('실행 중 문제가 생겼어요. 다시 실행해 주세요.'); console.error(error);
  } finally {
    ws.highlightBlock(null); setRunningUI(false);
  }
}

/* ---------- 결과 ---------- */
var VERDICTS = {
  perfect:{emoji:'🎉',title:'장보기 성공!',sub:'목록에 있는 물건을 모두 담았어요!'},
  weird:{emoji:'🛒',title:'장바구니를 확인해요',sub:'빠뜨린 품목과 목록에 없는 물건을 확인해 보세요.'},
  empty:{emoji:'🧺',title:'장바구니가 비었어요',sub:'물건이 있는 칸에서 여기 물건 담기를 실행해 보세요.'},
  boom:{emoji:'💥',title:'TNT를 담았어요!',sub:'다시 도전해서 필요한 물건을 담아 보세요.'}
};
function showResult(){
  var R = lastResult, v = VERDICTS[R.res.verdict];
  $('res-emoji').textContent=v.emoji; $('res-title').textContent=v.title; $('res-sub').textContent=v.sub;
  var title = E.rankTitle(R.res, R.blocks, R.level);
  $('res-badge').innerHTML = title? '<span class="title-badge">🏷️ 칭호: '+title+'</span>' : '';
  $('res-score').textContent=R.res.total; $('res-max').textContent='/ '+R.res.max+'점';
  $('res-blocks').textContent=R.blocks; $('res-actions').textContent=R.actions; $('res-bumps').textContent=R.bumps;
  $('res-traps').textContent=R.cake.filter(function(i){ return ITEMS[i].kind==='trap'||ITEMS[i].kind==='boom'; }).length;
  var tb=$('res-rows'); tb.innerHTML='';
  if(!R.res.rows.length){ tb.innerHTML='<tr><td colspan="4" style="color:var(--muted)">아무것도 집지 않았어요.</td></tr>'; }
  R.res.rows.forEach(function(row,i){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+(i+1)+'</td><td>'+row.emoji+' '+row.label+'</td><td>'+row.verdict+'</td><td class="pts '+(row.pts>0?'plus':'minus')+'">'+(row.pts>0?'+':'')+row.pts+'</td>';
    tb.appendChild(tr);
  });
  $('res-level').textContent = R.level.name;
  $('res-missing').textContent = R.res.missing.length ? '빠뜨린 품목: ' + R.res.missing.join(', ') : '목록의 모든 품목을 담았어요.';
  var ck=$('res-cake'); resetCake(ck, true, R.cake.length? '' : '장바구니가 비어 있어요');
  $('hof-level').textContent = R.level.name;
  showScene(3);
  $('res-title').focus({preventScroll:true});
  R.cake.forEach(function(item){ addLayer(ck,item); });
  if(R.exploded) explode(ck);
  if(R.res.perfect) SFX.win(); else SFX.lose();
  $('hof-name').value=''; $('hof-submit').disabled=false; $('hof-submit').textContent='등록';
  renderHof(null);
}

/* ---------- 명예의 전당 (레벨별, localStorage) ---------- */
function hofKey(){ return 'nau_shopping_hof_v1_L'+level.id; }
function loadHof(){ try{ var list=JSON.parse(localStorage.getItem(hofKey())||'[]'); return Array.isArray(list)?list.filter(function(e){return e && typeof e.name==='string' && Number.isFinite(e.score) && Array.isArray(e.basket);}):[]; }catch(e){ return []; } }
function saveHof(list){ try{ localStorage.setItem(hofKey(), JSON.stringify(list)); return true; }catch(e){ return false; } }
function renderHof(mine){
  var list = loadHof().sort(E.compareEntries).slice(0,10), ol=$('hof-list'); ol.innerHTML='';
  if(!list.length){ ol.innerHTML='<li style="display:block;color:var(--muted)">아직 아무도 없어요. 첫 번째로 이름을 남겨보세요.</li>'; return; }
  list.forEach(function(e,i){
    var li=document.createElement('li'); if(mine && e.ts===mine) li.classList.add('me');
    li.innerHTML='<span class="rk">'+(i+1)+'</span><span>'+escapeHtml(e.name)+' <span class="meta">'+(e.basket || []).map(function(x){return ITEMS[x]?ITEMS[x].emoji:'';}).join('')+'</span></span><span class="meta">블록 '+e.blocks+' · 동작 '+e.actions+'</span><span class="sc">'+e.score+'</span>';
    ol.appendChild(li);
  });
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* ---------- 이벤트 바인딩 ---------- */
renderLevelPicker();
$('btn-start').addEventListener('click', function(){
  showScene(2); buildGrid(); resetRun(); renderRecipe([]); say('물건 칸에 서서 담아요. 마지막에는 계산하기!');
  try{ initBlockly(); Blockly.svgResize(ws); }catch(e){ toast('블록 편집기를 불러오지 못했어요: '+e.message); }
});
$('btn-iso').addEventListener('click', function(){
  var on = $('grid-wrap').classList.toggle('iso');
  this.setAttribute('aria-pressed', on?'true':'false'); this.textContent = on? '🗺️ 평면 보기' : '🧊 입체 보기';
});
$('btn-level').addEventListener('click', function(){ showScene(1); });
$('btn-run').addEventListener('click', function(){ runProgram(); });
$('btn-stop').addEventListener('click', function(){ stopRequested=true; });
$('btn-fit').addEventListener('click', function(){ if(ws) ws.zoomToFit(); });
$('btn-guide').addEventListener('click', function(){ if(!ws || (ws.getAllBlocks(false).length && !confirm('지금 블록을 지우고 처음 가이드 3개를 놓을까요?'))) return; ws.clear(); loadStarter(); updateCount(); resetRun(); say('가이드 3개를 놓았어요. 이어서 장보기를 완성해 보세요.'); });
$('btn-clear').addEventListener('click', function(){ if(ws && confirm('블록을 모두 지울까요?')){ ws.clear(); updateCount(); say('블록을 지웠어요. 가이드 다시 놓기로 다시 시작할 수 있어요.'); } });
$('btn-sound').addEventListener('click', function(){ audio.on=!audio.on; this.textContent=audio.on?'🔊':'🔇'; if(audio.on){ ensureAudio(); SFX.bread(); } });
$('speed').addEventListener('input', function(){ $('speed-label').textContent=SPEED_LABEL[this.value]; });
$('btn-retry').addEventListener('click', function(){ showScene(2); resetRun(); say('블록을 고쳐서 다시 도전!'); Blockly.svgResize(ws); });
$('btn-restart').addEventListener('click', function(){ showScene(1); if(ws){ ws.clear(); loadStarter(); updateCount(); } });
$('hof-form').addEventListener('submit', function(ev){
  ev.preventDefault();
  if(!lastResult) return;
  var name=$('hof-name').value.trim() || '이름 없는 장보기 대원';
  var list=loadHof(); var entry={ name:name, score:lastResult.res.total, blocks:lastResult.blocks, actions:lastResult.actions, basket:lastResult.cake, ts:Date.now() };
  list.push(entry);
  if(saveHof(list)){ $('hof-submit').disabled=true; $('hof-submit').textContent='등록됨'; renderHof(entry.ts); toast('명예의 전당에 올렸어요'); }
  else { toast('이 브라우저에서는 저장이 안 돼요 (저장 공간 차단)'); renderHof(null); }
});
})();
