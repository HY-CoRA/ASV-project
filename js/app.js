(function(){
'use strict';
var E = NauEngine, ITEMS = E.ITEMS, HAZARDS = E.HAZARDS, FAILURES = E.FAILURES;
var $ = function(id){ return document.getElementById(id); };

/* ---------- 효과음 (WebAudio, 파일 없음) ---------- */
var audio = { ctx:null };
function ensureAudio(){ if(!audio.ctx){ try{ audio.ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audio.ctx=null; } } if(audio.ctx && audio.ctx.state==='suspended'){ audio.ctx.resume(); } }
function tone(freq, dur, type, gain, slide){
  if(!audio.ctx) return;
  try{
    var c=audio.ctx, o=c.createOscillator(), g=c.createGain();
    o.type=type||'square'; o.frequency.setValueAtTime(freq, c.currentTime);
    if(slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime+dur);
    g.gain.setValueAtTime(gain||0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+dur);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+dur);
  }catch(e){}
}
var SFX = {
  step:function(){ tone(420,0.05,'triangle',0.04); },
  turn:function(){ tone(300,0.06,'sine',0.04,500); },
  bump:function(){ tone(90,0.18,'square',0.12,50); },
  pick:function(){ tone(520,0.12,'triangle',0.08,780); },
  checkout:function(){ tone(1000,0.2,'sine',0.05,1400); },
  nothing:function(){ tone(260,0.1,'sine',0.04,200); },
  win:function(){ var revision=sessionRevision; [523,659,784,1046].forEach(function(f,i){ setTimeout(function(){ if(revision===sessionRevision) tone(f,0.25,'triangle',0.08); }, i*140); }); },
  lose:function(){ var revision=sessionRevision; [392,330,262].forEach(function(f,i){ setTimeout(function(){ if(revision===sessionRevision) tone(f,0.3,'sawtooth',0.06); }, i*220); }); }
};
function failureSound(ending,run){
  var notes=ending.notes || [240,360,300,180];
  var waveform=ending.waveform || (ending.id==='robot'?'square':'triangle');
  notes.forEach(function(f,i){ setTimeout(function(){
    if(runIsCurrent(run) && !stopRequested) tone(f,0.14,waveform,0.05);
  },i*150); });
}

/* ---------- 레벨 선택 (URL ?level=N&lock=1) ---------- */
var params = new URLSearchParams(location.search);
var level = E.levelById(params.get('level')) || E.LEVELS[0];
var locked = params.get('lock') === '1';
var eng = new E.Engine(E.generateLevel(level));

function renderLevelPicker(){
  var box = $('level-picker'); box.innerHTML='';
  E.LEVELS.forEach(function(lv){
    var card = document.createElement('button'); card.type='button'; card.className='level-card'+(lv.id===level.id?' on':'');
    card.setAttribute('aria-pressed', lv.id===level.id?'true':'false');
    var icon=document.createElement('span'); icon.className='level-icon'; icon.setAttribute('aria-hidden','true');
    icon.textContent=lv.id===1?'🌱':'🌳';
    var copy=document.createElement('span'); copy.className='level-card-copy';
    var name=document.createElement('b'); name.textContent=lv.name;
    var detail=document.createElement('small'); detail.textContent='재료 '+lv.targetCount+'개 · '+lv.size+'×'+lv.size+' 지도';
    copy.append(name,detail);
    var check=document.createElement('span'); check.className='level-check'; check.setAttribute('aria-hidden','true'); check.textContent='✓';
    card.append(icon,copy,check);
    card.addEventListener('click', function(){ selectLevel(lv); });
    box.appendChild(card);
  });
  var mission = $('mission-items'); mission.replaceChildren();
  var item=document.createElement('span');
  item.textContent='🎲 랜덤 재료 '+(level.targetCount || level.shoppingList.length)+'개';
  mission.appendChild(item);
  $('level-label').textContent = level.name;
  $('btn-start').textContent = '▶ '+level.name+' 시작하기';
}
function selectLevel(lv){
  level = lv;
  if(ws){ ws.clear(); loadStarter(); updateCount(); }
  renderLevelPicker();
}
if(locked){ var pk=$('level-picker-wrap'); if(pk) pk.classList.add('hidden'); }

/* ---------- 장면 전환 ---------- */
function showScene(n){
  $('scene-intro').classList.toggle('hidden', n!==1);
  $('scene-play').classList.toggle('hidden', n!==2);
  $('scene-result').classList.toggle('hidden', n!==3);
  document.body.classList.toggle('is-playing', n===2);
  document.querySelector('.top').classList.toggle('is-playing', n===2);
  $('play-meta').classList.toggle('hidden', n!==2);
  $('play-actions').classList.toggle('hidden', n!==2);
  $('timer-wrap').classList.toggle('hidden', n===1 || !attempt);
  window.scrollTo({top:0});
}
var toastTimer;
function toast(msg){ var t=$('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){t.classList.remove('on');},2200); }

/* ---------- 재료 위치 표시 ---------- */
var locateTimer=null, locateRevision=0, highlightedCell=null, locatingSlot=null;
function clearItemHighlight(){
  locateRevision++; clearTimeout(locateTimer); locateTimer=null;
  if(highlightedCell) highlightedCell.classList.remove('item-highlight');
  if(locatingSlot) locatingSlot.classList.remove('is-locating');
  highlightedCell=null; locatingSlot=null;
}
function locateItem(item,slot){
  if(running || mapPending || !attempt || lastResult) return;
  clearItemHighlight();
  for(var r=0;r<eng.rows;r++) for(var c=0;c<eng.cols;c++){
    if(eng.map[r][c]!==item) continue;
    highlightedCell=gridEl.children[r*eng.cols+c]; locatingSlot=slot;
    highlightedCell.classList.add('item-highlight'); slot.classList.add('is-locating');
    var revision=locateRevision;
    locateTimer=setTimeout(function(){ if(revision===locateRevision) clearItemHighlight(); },2000);
    return;
  }
}
function updateEditorControls(){
  var disabled=running || mapPending;
  $('btn-zoom-out').disabled=disabled || !ws;
  $('btn-zoom-in').disabled=disabled || !ws;
  $('recipe').querySelectorAll('button').forEach(function(button){ button.disabled=disabled || !attempt || !!lastResult; });
}

/* ---------- 지도 ---------- */
var gridEl = $('grid'), nauEl;
function buildGrid(){
  gridEl.innerHTML='';
  gridEl.style.gridTemplateColumns='repeat('+eng.cols+',minmax(0,1fr))';
  gridEl.style.gridTemplateRows='repeat('+eng.rows+',minmax(0,1fr))';
  gridEl.style.aspectRatio=eng.cols+' / '+eng.rows;
  gridEl.style.setProperty('--map-ratio', eng.cols/eng.rows);
  gridEl.style.setProperty('--map-cols', eng.cols);
  gridEl.setAttribute('aria-label','마트 지도 '+eng.rows+'x'+eng.cols);
  for(var r=0;r<eng.rows;r++) for(var c=0;c<eng.cols;c++){
    var v = eng.map[r][c], d=document.createElement('div'); d.className='cell';
    if(v==='#'){ d.classList.add('wall'); }
    else if(v==='S'){ d.classList.add('start'); d.innerHTML='<span class="b">🚪</span><small>입구</small>'; }
    else if(HAZARDS[v]){ d.classList.add('hazard'); d.innerHTML='<span class="b">'+HAZARDS[v].emoji+'</span><small>'+HAZARDS[v].label+'</small>'; }
    else if(ITEMS[v]){ d.classList.add('item'); d.innerHTML='<span class="b">'+ITEMS[v].emoji+'</span><small>'+v+'</small>'; }
    d.title = v==='#'?'벽': v==='S'?'입구': ITEMS[v]? ITEMS[v].label : HAZARDS[v]? HAZARDS[v].label : '통로';
    gridEl.appendChild(d);
  }
  nauEl=document.createElement('div'); nauEl.className='nau';
  nauEl.style.width=(100/eng.cols)+'%'; nauEl.style.height=(100/eng.rows)+'%';
  nauEl.innerHTML='<span class="body">🧒</span><span class="pick-hand" aria-hidden="true">✋</span><span class="bag" aria-hidden="true">🛍️</span><span class="dir">▲</span>'; gridEl.appendChild(nauEl);
}
function placeNau(instant){
  if(instant) nauEl.style.transition='none';
  nauEl.style.left=(eng.c*100/eng.cols)+'%'; nauEl.style.top=(eng.r*100/eng.rows)+'%';
  nauEl.querySelector('.dir').style.transform='rotate('+(eng.d*90)+'deg)';
  if(instant){ void nauEl.offsetWidth; nauEl.style.transition=''; }
}

/* ---------- 서버 시도와 풀이 시간 ---------- */
var attempt=null, sessionRevision=0, mapRequest=0, mapPending=false;
var timerBase=0, timerStarted=0, timerActive=false;
var activeDialogResult=null, hofRequest=0;
var apiControllers=new Set();
function elapsedNow(){ return timerBase+(timerActive ? Math.max(0,performance.now()-timerStarted) : 0); }
function formatTime(ms){
  var ticks=Math.floor(Math.max(0,Number(ms)||0)/100), minutes=Math.floor(ticks/600);
  return String(minutes).padStart(2,'0')+':'+String(Math.floor(ticks/10)%60).padStart(2,'0')+'.'+ticks%10;
}
function paintTimer(){ $('solve-timer').textContent=formatTime(elapsedNow()); }
function startTimer(data){
  timerBase=Math.max(0,Number(data.elapsedBaseMs)||0)+Math.max(0,(Number(data.serverNow)||0)-(Number(data.startedAt)||0));
  timerStarted=performance.now(); timerActive=true; paintTimer();
}
function freezeTimer(value){ timerBase=value===undefined ? elapsedNow() : Math.max(0,Number(value)||0); timerActive=false; paintTimer(); return timerBase; }
setInterval(paintTimer,100);
async function api(path, body){
  var response, controller=new AbortController();
  apiControllers.add(controller);
  var timeout=setTimeout(function(){ controller.abort(); },12000);
  try{
    response=await fetch(new URL('api/'+path,location.href),{
      method:body===undefined?'GET':'POST', credentials:'same-origin',
      headers:body===undefined?{}:{'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body), signal:controller.signal
    });
    var data;
    try{ data=await response.json(); }catch(error){ throw new Error('기록을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
    if(!response.ok) throw new Error(response.status===429 ? '요청이 많아요. 잠시 뒤 다시 시도해 주세요.' : '기록을 저장하지 못했어요. 다시 시도해 주세요.');
    return data;
  }catch(error){
    if(!response || error.name==='AbortError') throw new Error('서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    throw error;
  }finally{ clearTimeout(timeout); apiControllers.delete(controller); }
}
function mapBusy(on){
  mapPending=on;
  if(on) clearItemHighlight();
  ['btn-start','btn-new-map','btn-retry','btn-restart'].forEach(function(id){ $(id).disabled=on; });
  if(!running){ $('btn-run').disabled=on; $('btn-clear').disabled=on; }
  $('level-picker').querySelectorAll('button').forEach(function(button){ button.disabled=on; });
  updateEditorControls();
}
function isCurrent(R){ return lastResult===R && R.revision===sessionRevision && attempt && R.attemptId===attempt.id; }
function closeNameDialog(){ activeDialogResult=null; if($('name-dialog').open) $('name-dialog').close(); }
async function newMap(options){
  options=options||{};
  if(running || mapPending) return false;
  var request=++mapRequest, requestedLevel=level;
  mapBusy(true);
  try{
    var requestBody={level:requestedLevel.id};
    if(options.retryOf) requestBody.retryOf=options.retryOf;
    else requestBody.mode='random';
    var data=await api('attempts',requestBody);
    if(request!==mapRequest || level!==requestedLevel) return false;
    if(!data.challenge || !data.challenge.id) throw new Error('도전 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    closeNameDialog(); sessionRevision++; hofRequest++;
    attempt=data; lastResult=null;
    eng.setLevel({id:level.id,map:data.map,shoppingList:data.shoppingList});
    $('map-label').textContent=level.name;
    $('challenge-label').textContent=data.challenge.label;
    var hadWorkspace=!!ws;
    buildGrid(); resetRun(); showScene(2); initBlockly();
    if(!options.retryOf && !options.keepCode && hadWorkspace){ ws.clear(); loadStarter(); updateCount(); }
    Blockly.svgResize(ws); startTimer(data);
    return true;
  }catch(error){
    if(request===mapRequest) toast(error.message);
    return false;
  }finally{
    if(request===mapRequest) mapBusy(false);
  }
}
async function animatePick(ev,run){
  if(!runIsCurrent(run)) return;
  var actor=nauEl, item = ITEMS[ev.item], cell = gridEl.children[ev.row*eng.cols+ev.col];
  var target = ev.failure ? nauEl : Array.from($('recipe').children).find(function(slot){ return slot.dataset.item===ev.item; }) || $('recipe');
  actor.classList.add('picking');
  await sleep(200);
  if(!runIsCurrent(run)) return;
  var from=cell.getBoundingClientRect(), to=target.getBoundingClientRect();
  var flight=document.createElement('span'); flight.className='item-flight'; flight.textContent=item.emoji; flight.setAttribute('aria-hidden','true');
  flight.style.left=(from.left+from.width/2)+'px'; flight.style.top=(from.top+from.height/2)+'px';
  flight.style.fontSize=Math.max(24,from.width*0.55)+'px';
  document.body.appendChild(flight); cell.classList.add('picked');
  SFX.pick();
  if(flight.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    var dx=to.left+to.width/2-from.left-from.width/2, dy=to.top+to.height/2-from.top-from.height/2;
    var animation=flight.animate([
      {transform:'translate(-50%,-50%) scale(1)',opacity:1},
      {transform:'translate(calc(-50% + '+dx*0.25+'px),calc(-50% + '+(Math.min(dy,0)-45)+'px)) scale(1.3)',offset:0.4,opacity:1},
      {transform:'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px)) scale(.5)',opacity:0}
    ],{duration:560,easing:'ease-in-out',fill:'forwards'});
    run.animations.add(animation);
    await animation.finished.catch(function(){});
    run.animations.delete(animation);
  }
  flight.remove();
  if(!runIsCurrent(run)) return;
  actor.classList.remove('picking');
  renderShoppingList($('recipe'));
  if(ev.failure){
    if(!stopRequested) await animateFailure(ev.failure,run);
  }else if(eng.shoppingList.includes(ev.item)){
    var slot=Array.from($('recipe').children).find(function(el){ return el.dataset.item===ev.item; });
    slot.classList.add('just-collected');
  }else{ toast(item.emoji+' '+item.label+' −20'); }
}
async function animateFailure(item,run){
  if(!runIsCurrent(run)) return;
  var actor=nauEl, ending=FAILURES[item], overlay=$('failure-overlay');
  var props=ending.props || [ending.emoji,'✨','✨'];
  overlay.dataset.ending=ending.id;
  $('event-emoji').textContent=ending.emoji;
  $('event-title').textContent=ending.title;
  $('event-caption').textContent=ending.caption;
  overlay.querySelectorAll('.event-props span').forEach(function(el,i){ el.textContent=props[i]; });
  overlay.classList.remove('hidden');
  actor.dataset.ending=ending.id;
  failureSound(ending,run);
  for(var i=0;i<22 && !stopRequested;i++){
    await sleep(80);
    if(!runIsCurrent(run)) return;
  }
  if(!runIsCurrent(run)) return;
  overlay.classList.add('hidden');
  delete actor.dataset.ending;
}

/* ---------- 심부름 목록 ---------- */
function renderShoppingList(container){
  container.replaceChildren();
  var interactive=container===$('recipe');
  eng.shoppingList.forEach(function(key){
    var item = ITEMS[key];
    var done = eng.collected.includes(key);
    var slot = document.createElement(interactive?'button':'div');
    if(interactive){
      slot.type='button'; slot.setAttribute('aria-label',item.label+' 위치 찾기');
      slot.addEventListener('click',function(){ locateItem(key,slot); });
    }
    slot.dataset.item = key;
    slot.className = 'slot' + (done ? ' done' : '');
    slot.innerHTML = '<span class="n">'+(done ? '<span class="slot-mark" aria-hidden="true">✓</span> 담았어요' : '아직')+
      '</span><span class="e" aria-hidden="true">'+item.emoji+'</span>'+item.label;
    container.appendChild(slot);
  });
  if(interactive){
    var count=eng.shoppingList.filter(function(key){ return eng.collected.includes(key); }).length;
    $('shopping-progress').textContent='담은 재료 '+count+' / '+eng.shoppingList.length;
    updateEditorControls();
  }
}

/* ---------- Blockly ---------- */
var ws=null, toolboxLevel;
function shoppingToolbox(){
  var types = ['nau_start', 'nau_move', 'nau_left', 'nau_right', 'nau_pick', 'nau_checkout', 'nau_repeat', 'nau_if'];
  return { kind:'flyoutToolbox', contents:types.map(function(type){
    return { kind:'block', type:type, gap:12 };
  }) };
}
function loadStarter(){ try{ Blockly.serialization.workspaces.load(level.starter, ws); }catch(e){} }
function initBlockly(){
  if(ws){
    if(toolboxLevel!==level.id){ ws.updateToolbox(shoppingToolbox()); toolboxLevel=level.id; }
    return;
  }
  Blockly.defineBlocksWithJsonArray([
    { type:'nau_start', message0:'시작하기 🏁', nextStatement:null, style:'finish_blocks', tooltip:'' },
    { type:'nau_move', message0:'앞으로 가기 🚶', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'' },
    { type:'nau_left', message0:'왼쪽으로 돌기 ↩️', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'' },
    { type:'nau_right', message0:'오른쪽으로 돌기 ↪️', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'' },
    { type:'nau_pick', message0:'서 있는 물건 집기 ✋', previousStatement:null, nextStatement:null, style:'action_blocks', tooltip:'' },
    { type:'nau_checkout', message0:'종료하기 🧾', previousStatement:null, style:'finish_blocks', tooltip:'' },
    { type:'nau_repeat', message0:'%1 번 반복하기 🔁', args0:[{ type:'field_number', name:'TIMES', value:3, min:1, max:20, precision:1 }],
      message1:'%1', args1:[{ type:'input_statement', name:'DO' }], previousStatement:null, nextStatement:null, style:'loop_blocks', tooltip:'' },
    { type:'nau_if', message0:'만약 %1', args0:[{ type:'field_dropdown', name:'COND', options:[
        ['앞에 벽이 있다면','WALL'], ['앞에 벽이 없다면','NOWALL'] ] }],
      message1:'%1', args1:[{ type:'input_statement', name:'DO' }], previousStatement:null, nextStatement:null, style:'logic_blocks', tooltip:'' }
  ]);
  var theme = Blockly.Theme.defineTheme('nau', {
    base: Blockly.Themes.Zelos,
    blockStyles: {
      move_blocks:   { colourPrimary:'#2F80ED', colourSecondary:'#8DB8F5', colourTertiary:'#1F5FB8' },
      action_blocks: { colourPrimary:'#E6334F', colourSecondary:'#F3A1AE', colourTertiary:'#B2223A' },
      finish_blocks: { colourPrimary:'#16834D', colourSecondary:'#92D1AC', colourTertiary:'#0F6339' },
      loop_blocks:   { colourPrimary:'#F29E1F', colourSecondary:'#F8CF8D', colourTertiary:'#C27C12' },
      logic_blocks:  { colourPrimary:'#7B61FF', colourSecondary:'#BDB0FF', colourTertiary:'#5A44C9' }
    },
    componentStyles: { workspaceBackgroundColour:'#FFFDF5', flyoutBackgroundColour:'#F3E9D2', flyoutOpacity:1, scrollbarColour:'#C9B99A', insertionMarkerColour:'#1F1A14', insertionMarkerOpacity:0.3 },
    fontStyle: { family:"'Jua','Apple SD Gothic Neo','Malgun Gothic',sans-serif", weight:'normal', size:13 }
  });
  ws = Blockly.inject('blocklyDiv', {
    toolbox: shoppingToolbox(), renderer:'zelos', theme: theme, trashcan:false, sounds:false,
    maxInstances:{ nau_start:1, nau_checkout:1 },
    scrollbars:true, move:{ scrollbars:true, drag:true, wheel:true }, zoom:{ controls:false, wheel:false, pinch:true, startScale:0.9, minScale:0.65, maxScale:1.4 },
    grid:{ spacing:24, length:2, colour:'#E4D8BC', snap:false }
  });
  toolboxLevel=level.id;
  loadStarter();
  ws.addChangeListener(function(e){ if(e.isUiEvent) return; updateCount(); });
  updateCount();
  var editor = $('blocklyDiv');
  new ResizeObserver(function(){
    if(editor.clientWidth) Blockly.svgResize(ws);
  }).observe(editor);
  var play=$('scene-play'), panel=play.querySelector('.panel'), shopping=panel.querySelector('.sticker');
  function fitMapColumn(){
    if(!play.clientHeight) return;
    var gap=parseFloat(getComputedStyle(panel).rowGap)||0;
    var width=Math.max(0,panel.clientHeight-shopping.offsetHeight-gap)*eng.cols/eng.rows;
    var value=width.toFixed(1)+'px';
    if(play.style.getPropertyValue('--map-column')!==value) play.style.setProperty('--map-column',value);
  }
  var mapLayoutObserver=new ResizeObserver(fitMapColumn);
  mapLayoutObserver.observe(play); mapLayoutObserver.observe(shopping);
  fitMapColumn();
}
function readChain(b){ var out=[]; while(b){ out.push(readBlock(b)); b=b.getNextBlock(); } return out; }
function readBlock(b){
  switch(b.type){
    case 'nau_move': return { op:'move', id:b.id };
    case 'nau_left': return { op:'left', id:b.id };
    case 'nau_right': return { op:'right', id:b.id };
    case 'nau_pick': return { op:'pick', id:b.id };
    case 'nau_checkout': return { op:'checkout', id:b.id };
    case 'nau_repeat': return { op:'repeat', id:b.id, n: Math.max(1, Math.min(20, Number(b.getFieldValue('TIMES'))||1)), body: readChain(b.getInputTargetBlock('DO')) };
    case 'nau_if': return { op:'if', id:b.id, cond:b.getFieldValue('COND'), body: readChain(b.getInputTargetBlock('DO')) };
  }
  return { op:'noop', id:b.id };
}
function readProgram(){
  var start = ws.getTopBlocks(true).find(function(block){ return block.type==='nau_start'; });
  return { start:start, ast:start ? readChain(start.getNextBlock()) : [], blocks:start ? start.getDescendants(false).length : 0 };
}
function hasCheckout(nodes){
  return nodes.some(function(node){ return node.op==='checkout' || (node.body && hasCheckout(node.body)); });
}
function updateCount(){
  if(!ws) return;
  $('block-count').textContent='블록 '+ws.getAllBlocks(false).length+'개';
  var prog=readProgram(), submission=hasCheckout(prog.ast);
  $('btn-run').textContent=submission?'▶ 결과까지 실행':'▶ 미리보기';
  $('btn-run').dataset.mode=submission?'submit':'preview';
}

/* ---------- 실행 ---------- */
var running=false, stopRequested=false, lastResult=null, route=[], activeRun=null, runSequence=0;
var STEP_DELAY_MS = 380;
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function runIsCurrent(run){
  return !!run && activeRun===run && !run.cancelled && run.revision===sessionRevision && !!attempt && run.attemptId===attempt.id;
}
function resetRun(){
  clearItemHighlight();
  eng.reset(); route=[[eng.r,eng.c]]; placeNau(true); nauEl.classList.remove('bump', 'picking', 'slipping', 'stuck');
  $('failure-overlay').classList.add('hidden');
  delete $('failure-overlay').dataset.ending;
  delete nauEl.dataset.ending;
  gridEl.querySelectorAll('.picked, .triggered').forEach(function(cell){ cell.classList.remove('picked', 'triggered'); });
  document.querySelectorAll('.item-flight, .trap-loss').forEach(function(el){ el.remove(); });
  renderShoppingList($('recipe'));
}
function handleEvent(ev,run){
  if(!runIsCurrent(run)) return;
  var actor=nauEl;
  switch(ev.type){
    case 'move': route.push([eng.r,eng.c]); placeNau(); SFX.step(); break;
    case 'bump': nauEl.classList.remove('bump'); void nauEl.offsetWidth; nauEl.classList.add('bump'); SFX.bump(); break;
    case 'turn': placeNau(); SFX.turn(); break;
    case 'trap': {
      route.push([eng.r,eng.c]); placeNau();
      var cell = gridEl.children[ev.row*eng.cols+ev.col];
      cell.classList.add('triggered');
      var hazard=HAZARDS[ev.hazard] || {};
      var motionClass=hazard.motion==='sticky'?'stuck':hazard.motion==='bump'?'bump':'slipping';
      actor.classList.remove('slipping','stuck','bump'); void actor.offsetWidth; actor.classList.add(motionClass);
      var loss = document.createElement('span'); loss.className='trap-loss'; loss.textContent='−'+ev.penalty;
      nauEl.appendChild(loss);
      SFX.bump();
      return sleep(700).then(function(){ loss.remove(); if(runIsCurrent(run)) actor.classList.remove(motionClass); });
    }
    case 'pick': return animatePick(ev,run);
    case 'pickNothing':
      nauEl.classList.add('picking'); SFX.nothing();
      return sleep(420).then(function(){ if(runIsCurrent(run)) actor.classList.remove('picking'); });
    case 'checkout': SFX.checkout(); break;
  }
}
function setRunningUI(on){
  if(on) clearItemHighlight();
  running=on; $('ws-lock').classList.toggle('on', on);
  $('btn-run').disabled=on; $('btn-stop').disabled=!on; $('btn-clear').disabled=on; $('btn-new-map').disabled=on;
  updateEditorControls();
}
async function runProgram(){
  if(running || mapPending || !attempt || lastResult) return;
  ensureAudio();
  var prog = readProgram();
  if(!prog.start){ toast('시작하기 블록을 놓아주세요'); return; }
  if(!prog.ast.length){ toast('시작하기 아래에 블록을 연결해주세요'); return; }
  if(!validProgramSize(prog.ast)){ toast('블록은 500개, 겹친 반복은 12단계까지 사용할 수 있어요'); return; }
  var run={id:++runSequence, revision:sessionRevision, attemptId:attempt.id, cancelled:false, animations:new Set()};
  activeRun=run;
  var checkoutAttached=hasCheckout(prog.ast);
  stopRequested=false; setRunningUI(true); resetRun();
  var gen = E.interpret(prog.ast, eng), step, completed=null;
  try{ ws.highlightBlock(prog.start.id); }catch(e){}
  await sleep(300);
  if(!runIsCurrent(run)) return;
  while(runIsCurrent(run) && !stopRequested && !(step=gen.next()).done){
    try{ ws.highlightBlock(step.value.node.id); }catch(e){}
    if(eng.checkedOut || (eng.failure && checkoutAttached)){
      completed=finishProgram(prog);
      $('btn-stop').disabled=true;
    }
    var motion = handleEvent(step.value.ev,run);
    var t = step.value.ev.type;
    await Promise.all([motion, sleep((t==='repeat'||t==='if')? STEP_DELAY_MS*0.5 : STEP_DELAY_MS)]);
  }
  if(!runIsCurrent(run)) return;
  try{ ws.highlightBlock(null); }catch(e){}
  if(stopRequested && !completed){ setRunningUI(false); activeRun=null; return; }
  if(eng.overflow) toast('동작 한도에 도달했어요');
  if(!completed){
    tone(880,0.09,'sine',0.06);
    await sleep(140);
    if(!runIsCurrent(run)) return;
    tone(880,0.09,'sine',0.06);
    resetRun(); setRunningUI(false); activeRun=null;
    toast('미리보기 끝! 처음 위치로 돌아왔어요.');
    return;
  }
  setRunningUI(false); activeRun=null;
  openNameDialog(completed);
}
function goHome(){
  clearItemHighlight();
  mapRequest++; sessionRevision++; hofRequest++; runSequence++;
  if(activeRun){
    activeRun.cancelled=true;
    activeRun.animations.forEach(function(animation){ try{ animation.cancel(); }catch(error){} });
  }
  activeRun=null; stopRequested=true;
  apiControllers.forEach(function(controller){ controller.abort(); });
  apiControllers.clear();
  closeNameDialog(); freezeTimer(); attempt=null; lastResult=null;
  setRunningUI(false); mapBusy(false);
  if(nauEl) resetRun();
  if(ws){
    try{ ws.highlightBlock(null); }catch(error){}
    ws.clear(); loadStarter(); updateCount();
  }
  clearTimeout(toastTimer); $('toast').classList.remove('on');
  showScene(1);
}
function finishProgram(prog){
  var elapsed=freezeTimer();
  lastResult={ attemptId:attempt.id, revision:sessionRevision, levelId:level.id, challenge:attempt.challenge,
    res:E.score(eng), blocks:prog.blocks, actions:eng.actions, bumps:eng.bumps,
    checkedOut:eng.checkedOut, elapsedMs:elapsed, eligible:eng.checkedOut || !!eng.failure,
    program:prog.ast, serverReady:false, registered:false, entryId:null, finishPromise:null,
    finishError:'', submitError:'', submitting:false, shown:false };
  ensureFinished(lastResult).catch(function(){});
  return lastResult;
}

/* ---------- 결과 ---------- */
var VERDICTS = {
  perfect:{ emoji:'🎉', title:'심부름 성공!' },
  incomplete:{ emoji:'📝', title:'빠뜨린 물건이 있어요' },
  wrong:{ emoji:'🛍️', title:'목록에 없는 물건을 담았어요' },
  trapped:{ emoji:'🎉', title:'심부름 완료!' },
  unfinished:{ emoji:'🧾', title:'장보기가 아직 안 끝났어요' }
};
function validProgramSize(ast){
  var count=0;
  function visit(nodes,depth){
    if(depth>12) return false;
    return nodes.every(function(node){ return ++count<=500 && (!node.body || visit(node.body,depth+1)); });
  }
  return visit(ast,0);
}
function renderResultRoute(){
  var resultGrid=$('result-grid'); resultGrid.replaceChildren();
  resultGrid.style.gridTemplateColumns='repeat('+eng.cols+',minmax(0,1fr))';
  resultGrid.style.gridTemplateRows='repeat('+eng.rows+',minmax(0,1fr))';
  resultGrid.style.aspectRatio=eng.cols+' / '+eng.rows;
  resultGrid.style.setProperty('--map-ratio',eng.cols/eng.rows);
  resultGrid.setAttribute('aria-label','이번 장보기 이동 경로');
  var visited=new Map();
  route.forEach(function(cell,index){ var key=cell.join(','); if(!visited.has(key)) visited.set(key,index); });
  for(var r=0;r<eng.rows;r++) for(var c=0;c<eng.cols;c++){
    var key=r+','+c, value=eng.map[r][c], cell=document.createElement('div');
    cell.className='cell';
    if(value==='#') cell.classList.add('wall');
    else if(value==='S'){ cell.classList.add('start'); cell.innerHTML='<span class="b">🚪</span>'; }
    else if(HAZARDS[value]){ cell.classList.add('hazard'); cell.innerHTML='<span class="b">'+HAZARDS[value].emoji+'</span>'; }
    else if(ITEMS[value]){ cell.classList.add('item'); cell.innerHTML='<span class="b">'+ITEMS[value].emoji+'</span>'; }
    if(visited.has(key)){ cell.classList.add('route-visited'); cell.dataset.routeStep=visited.get(key); }
    if(r===eng.sr && c===eng.sc) cell.classList.add('route-start');
    if(eng.pickedCells.has(key)) cell.classList.add('picked');
    if(eng.triggeredTraps.has(key)) cell.classList.add('triggered');
    if(r===eng.r && c===eng.c){
      cell.classList.add('route-end');
      var marker=document.createElement('span'); marker.className='route-marker'; marker.textContent='🧒'; cell.appendChild(marker);
    }
    cell.title=(ITEMS[value]?ITEMS[value].label:HAZARDS[value]?HAZARDS[value].label:value==='#'?'벽':value==='S'?'입구':'통로')+
      (visited.has(key)?' · 지나간 칸':'')+(eng.pickedCells.has(key)?' · 담았어요':'');
    resultGrid.appendChild(cell);
  }
  var found=eng.shoppingList.filter(function(item){ return eng.collected.includes(item); }).length;
  $('route-summary').textContent='지나간 칸 '+visited.size+' · 담은 재료 '+found+'/'+eng.shoppingList.length+' · 함정 '+eng.trapHits;
}
function showResult(R){
  R=R||lastResult;
  if(!R || !isCurrent(R)) return;
  var ending=FAILURES[R.res.failure], v=ending || VERDICTS[R.res.verdict];
  var terminal=R.checkedOut || !!ending;
  $('res-emoji').textContent=v.emoji; $('res-title').textContent=v.title;
  var story=ending?ending.message:R.res.verdict==='trapped'?'재료는 모두 담았어요. 함정 −'+R.res.trapPenalty+'점':'';
  $('res-story').textContent=story;
  $('res-story').classList.toggle('hidden', !story);
  $('res-ending-caption').textContent=ending ? ending.caption : '';
  $('res-ending-caption').classList.toggle('hidden', !ending);
  var verdict=$('res-title').closest('.verdict');
  if(ending) verdict.dataset.ending=ending.id; else delete verdict.dataset.ending;
  $('res-score').textContent=R.serverReady?R.res.total:'…'; $('res-max').textContent='/ '+R.res.max+'점';
  $('res-score').parentElement.classList.toggle('hidden', !terminal);
  $('res-blocks').textContent=R.blocks; $('res-actions').textContent=R.actions; $('res-bumps').textContent=R.bumps;
  $('res-time').textContent=R.serverReady?formatTime(R.elapsedMs):'확인 중';
  $('res-traps').textContent=R.res.trapPenalty ? '−'+R.res.trapPenalty : '0';
  $('res-extras').textContent=R.res.rows.filter(function(row){ return row.pts<0; }).length;
  var tb=$('res-rows'); tb.innerHTML='';
  if(!R.res.rows.length){ tb.innerHTML='<tr><td colspan="3">아무것도 담지 않았어요.</td></tr>'; }
  R.res.rows.forEach(function(row){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+row.emoji+' '+row.label+'</td><td>'+row.verdict+'</td><td class="pts '+(row.pts>0?'plus':'minus')+'">'+(row.pts>0?'+':'')+row.pts+'</td>';
    tb.appendChild(tr);
  });
  renderShoppingList($('res-shopping-list')); renderResultRoute();
  $('hof-context').textContent=E.levelById(R.levelId).name+' · '+R.challenge.label+' · 점수순 · 동점은 빠른 풀이순';
  $('btn-name-entry').disabled=R.registered || !R.eligible;
  $('btn-name-entry').textContent=R.registered?'등록했어요':R.eligible?'이름 남기기':'다시 도전해요';
  $('btn-retry').disabled=mapPending || !!R.finishPromise;
  tb.closest('.table-wrap').classList.toggle('hidden', !terminal);
  showScene(3);
  if(!R.shown){
    R.shown=true;
    if(R.res.perfect || R.res.verdict==='trapped') SFX.win(); else SFX.lose();
    tb.closest('.table-wrap').scrollTop=0; $('hof-list').scrollTop=0;
    renderHof(R);
  }
  if(R.finishError) $('hof-status').textContent='기록을 확인하지 못했어요. 이름 남기기에서 다시 시도해 주세요.';
}
async function ensureFinished(R){
  if(R.serverReady) return R;
  if(R.finishPromise) return R.finishPromise;
  R.finishError='';
  R.finishPromise=(async function(){
    try{
      var data=await api('attempts/'+encodeURIComponent(R.attemptId)+'/finish',{program:R.program});
      R.res=data.result; R.actions=data.actions; R.blocks=data.blocks;
      R.checkedOut=data.checkedOut; R.elapsedMs=data.elapsedMs; R.eligible=data.eligible; R.serverReady=true;
      if(isCurrent(R)){
        freezeTimer(R.elapsedMs);
        if(activeDialogResult===R) updateNameDialog(R);
        else if(R.shown) showResult(R);
      }
      return R;
    }catch(error){
      R.finishError=error.message;
      if(isCurrent(R)){
        if(activeDialogResult===R) updateNameDialog(R);
        else if(R.shown) showResult(R);
      }
      throw error;
    }finally{
      R.finishPromise=null;
      if(isCurrent(R)){
        if(activeDialogResult===R) updateNameDialog(R);
        if(R.shown) $('btn-retry').disabled=mapPending;
      }
    }
  })();
  if(activeDialogResult===R) updateNameDialog(R);
  return R.finishPromise;
}
function rememberedName(){ try{ return sessionStorage.getItem('nau-player-name')||''; }catch(error){ return ''; } }
function updateNameDialog(R){
  if(activeDialogResult!==R) return;
  var pending=!R.serverReady && !!R.finishPromise;
  $('name-summary').textContent=R.serverReady ? R.res.total+'점 · 풀이 시간 '+formatTime(R.elapsedMs) : '풀이 시간 '+formatTime(R.elapsedMs);
  $('name-submit').textContent=R.submitting?'저장 중…':R.eligible?'등록하고 결과 보기':'결과 보기';
  $('name-submit').disabled=R.submitting || pending;
  $('player-name').disabled=R.submitting;
  $('name-status').textContent=pending?'장보기 기록을 확인하고 있어요…':R.registered?'명예의 전당에 이름을 남겼어요.':!R.eligible?'이번 장보기는 순위에 등록되지 않아요.':'';
  var error=R.submitError || R.finishError;
  $('name-error').textContent=error;
  $('name-error').classList.toggle('hidden',!error);
}
function openNameDialog(R){
  if(!isCurrent(R) || R.registered) return;
  activeDialogResult=R; R.submitError='';
  $('player-name').disabled=false; $('player-name').value=rememberedName();
  $('player-name').setCustomValidity(''); updateNameDialog(R);
  if(!$('name-dialog').open) $('name-dialog').showModal();
  $('player-name').focus();
}
function skipNameDialog(){
  var R=activeDialogResult; closeNameDialog();
  if(R && isCurrent(R)) showResult(R);
}
async function submitName(event){
  event.preventDefault();
  var R=activeDialogResult;
  if(!R || !isCurrent(R) || R.submitting || R.registered) return;
  var input=$('player-name'), name=input.value.normalize('NFC').trim();
  var invalid=!name?'이름을 입력해 주세요.':Array.from(name).length>12?'이름은 12글자까지 입력해 주세요.':/[\u0000-\u001f\u007f]/.test(name)?'이름에는 글자와 숫자를 입력해 주세요.':'';
  input.setCustomValidity(invalid);
  if(!input.reportValidity()) return;
  R.submitting=true; R.submitError=''; updateNameDialog(R);
  try{
    await ensureFinished(R);
    if(!isCurrent(R)) return;
    if(R.eligible){
      var data=await api('attempts/'+encodeURIComponent(R.attemptId)+'/entry',{name:name});
      if(!isCurrent(R)) return;
      R.registered=true; R.entryId=data.entry.id;
      try{ sessionStorage.setItem('nau-player-name',name); }catch(error){}
      hofRequest++;
      R.savedEntries=data.entries; R.savedRank=data.rank;
      toast('명예의 전당에 이름을 남겼어요');
    }
    if(activeDialogResult===R) closeNameDialog();
    showResult(R);
    if(R.savedEntries) renderHofEntries(R.savedEntries,R);
  }catch(error){
    if(isCurrent(R)){
      R.submitError=error.message;
      if(activeDialogResult===R) updateNameDialog(R);
      else $('hof-status').textContent=error.message;
    }
  }finally{
    R.submitting=false;
    if(activeDialogResult===R) updateNameDialog(R);
  }
}

/* ---------- 명예의 전당 (공유 서버) ---------- */
function renderHofEntries(entries,R){
  if(!isCurrent(R)) return;
  var list=entries.slice(0,10), ol=$('hof-list'); ol.replaceChildren();
  if(!list.length){
    var empty=document.createElement('li'); empty.className='hof-empty'; empty.textContent='아직 아무도 없어요. 첫 번째로 이름을 남겨보세요.'; ol.appendChild(empty);
  }
  list.forEach(function(entry,index){
    var li=document.createElement('li'); if(R.entryId===entry.id) li.classList.add('me');
    var rank=document.createElement('span'); rank.className='rk'; rank.textContent=index+1;
    var person=document.createElement('span'); person.className='person';
    var name=document.createElement('b'); name.textContent=entry.name;
    var time=document.createElement('small'); time.className='time'; time.textContent=formatTime(entry.elapsedMs);
    person.append(name,time);
    var score=document.createElement('span'); score.className='sc'; score.textContent=entry.score+'점';
    li.append(rank,person,score); ol.appendChild(li);
  });
  $('hof-status').textContent=R.registered?(R.savedRank?'내 기록 '+R.savedRank+'위':'이름을 남겼어요.'):'';
}
async function renderHof(R){
  var request=++hofRequest; $('hof-status').textContent='명예의 전당을 불러오고 있어요…';
  try{
    var data=await api('leaderboard?level='+encodeURIComponent(R.levelId)+'&challengeId='+encodeURIComponent(R.challenge.id));
    if(request!==hofRequest || !isCurrent(R)) return;
    renderHofEntries(data.entries,R);
    if(R.finishError) $('hof-status').textContent='기록을 확인하지 못했어요. 이름 남기기에서 다시 시도해 주세요.';
  }catch(error){
    if(request===hofRequest && isCurrent(R)) $('hof-status').textContent='명예의 전당을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  }
}

/* ---------- 이벤트 바인딩 ---------- */
renderLevelPicker(); updateEditorControls();
$('btn-start').addEventListener('click',function(){ ensureAudio(); newMap(); });
$('btn-new-map').addEventListener('click',function(){ newMap({keepCode:true}); });
$('btn-zoom-out').addEventListener('click',function(){ if(ws && !running && !mapPending) ws.zoomCenter(-1); });
$('btn-zoom-in').addEventListener('click',function(){ if(ws && !running && !mapPending) ws.zoomCenter(1); });
$('btn-run').addEventListener('click',function(){ runProgram(); });
$('btn-stop').addEventListener('click',function(){ if(running && !lastResult) stopRequested=true; });
$('btn-clear').addEventListener('click',function(){ if(ws && !running && !mapPending && confirm('블록을 모두 지울까요?')){ ws.clear(); updateCount(); } });
$('btn-retry').addEventListener('click',async function(){
  var R=lastResult;
  if(!R || !isCurrent(R) || mapPending) return;
  try{
    await ensureFinished(R);
    if(isCurrent(R)) await newMap({retryOf:R.attemptId});
  }catch(error){ if(isCurrent(R)) toast(error.message); }
});
$('btn-home').addEventListener('click',goHome);
$('btn-restart').addEventListener('click',goHome);
$('btn-name-entry').addEventListener('click',function(){ if(lastResult) openNameDialog(lastResult); });
$('name-form').addEventListener('submit',submitName);
$('name-skip').addEventListener('click',skipNameDialog);
$('name-dialog').addEventListener('cancel',function(event){ event.preventDefault(); skipNameDialog(); });
$('name-dialog').addEventListener('close',function(){ if(!$('name-dialog').open && activeDialogResult) skipNameDialog(); });
$('player-name').addEventListener('input',function(){ this.setCustomValidity(''); });
})();
