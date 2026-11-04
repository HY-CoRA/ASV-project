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
  win:function(){ [523,659,784,1046].forEach(function(f,i){ setTimeout(function(){tone(f,0.25,'triangle',0.08);}, i*140); }); },
  lose:function(){ [392,330,262].forEach(function(f,i){ setTimeout(function(){tone(f,0.3,'sawtooth',0.06);}, i*220); }); }
};
function failureSound(id){
  var notes=id==='robot' ? [330,660,440,880] : id==='football' ? [784,988,784,1046] : [240,360,300,180];
  notes.forEach(function(f,i){ setTimeout(function(){
    if(!stopRequested) tone(f,0.14,id==='robot'?'square':'triangle',0.05);
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
    card.innerHTML = '<b>'+lv.name+'</b>';
    card.addEventListener('click', function(){ selectLevel(lv); });
    box.appendChild(card);
  });
  $('level-label').textContent = level.name;
  $('btn-start').textContent = '▶ 시작하기';
}
function selectLevel(lv){
  level = lv;
  if(ws){ ws.clear(); loadStarter(); updateCount(); }
  renderLevelPicker();
}
if(locked){
  var pk=$('level-picker-wrap'); if(pk) pk.classList.add('hidden');
  $('btn-level').classList.add('hidden');
}

/* ---------- 장면 전환 ---------- */
function showScene(n){
  $('scene-intro').classList.toggle('hidden', n!==1);
  $('scene-play').classList.toggle('hidden', n!==2);
  $('scene-result').classList.toggle('hidden', n!==3);
  $('timer-wrap').classList.toggle('hidden', n===1 || !attempt);
  window.scrollTo({top:0});
}
var toastTimer;
function toast(msg){ var t=$('toast'); t.textContent=msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){t.classList.remove('on');},2200); }

/* ---------- 지도 ---------- */
var gridEl = $('grid'), nauEl;
function buildGrid(){
  gridEl.innerHTML='';
  gridEl.style.gridTemplateColumns='repeat('+eng.cols+',minmax(0,1fr))';
  gridEl.style.gridTemplateRows='repeat('+eng.rows+',minmax(0,1fr))';
  gridEl.style.aspectRatio=eng.cols+' / '+eng.rows;
  gridEl.style.setProperty('--map-ratio', eng.cols/eng.rows);
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
  }finally{ clearTimeout(timeout); }
}
function mapBusy(on){
  mapPending=on;
  ['btn-start','btn-new-map','btn-retry','btn-restart'].forEach(function(id){ $(id).disabled=on; });
  if(!running){ $('btn-run').disabled=on; $('btn-clear').disabled=on; }
  $('level-picker').querySelectorAll('button').forEach(function(button){ button.disabled=on; });
}
function isCurrent(R){ return lastResult===R && R.revision===sessionRevision && attempt && R.attemptId===attempt.id; }
function closeNameDialog(){ activeDialogResult=null; if($('name-dialog').open) $('name-dialog').close(); }
async function newMap(options){
  options=options||{};
  if(running || mapPending || returningHome) return false;
  var request=++mapRequest, requestedLevel=level;
  mapBusy(true);
  try{
    var data=await api('attempts',Object.assign({level:requestedLevel.id},options.retryOf?{retryOf:options.retryOf}:{}));
    if(request!==mapRequest || level!==requestedLevel) return false;
    closeNameDialog(); sessionRevision++; hofRequest++;
    attempt=data; lastResult=null;
    eng.setLevel({id:level.id,map:data.map,shoppingList:data.shoppingList});
    $('map-label').textContent=level.name;
    var hadWorkspace=!!ws;
    buildGrid(); resetRun(); showScene(2); initBlockly();
    if(!options.retryOf && hadWorkspace){ ws.clear(); loadStarter(); updateCount(); }
    Blockly.svgResize(ws); startTimer(data);
    return true;
  }catch(error){
    if(request===mapRequest) toast(error.message);
    return false;
  }finally{
    if(request===mapRequest) mapBusy(false);
  }
}
async function animatePick(ev){
  var item = ITEMS[ev.item], cell = gridEl.children[ev.row*eng.cols+ev.col];
  var target = ev.failure ? nauEl : Array.from($('recipe').children).find(function(slot){ return slot.dataset.item===ev.item; }) || $('recipe');
  nauEl.classList.add('picking');
  await sleep(200);
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
    await animation.finished.catch(function(){});
  }
  flight.remove(); nauEl.classList.remove('picking');
  renderShoppingList($('recipe'));
  if(ev.failure){
    if(!stopRequested) await animateFailure(ev.failure);
  }else if(eng.shoppingList.includes(ev.item)){
    var slot=Array.from($('recipe').children).find(function(el){ return el.dataset.item===ev.item; });
    slot.classList.add('just-collected');
  }else{ toast(item.emoji+' '+item.label+' −20'); }
}
async function animateFailure(item){
  var ending=FAILURES[item], overlay=$('failure-overlay');
  var props=ending.id==='socks' ? ['🫧','🧺','🫧'] : ending.id==='football' ? ['🥅','🏆','📣'] : ['🎵','🪩','🎶'];
  overlay.dataset.ending=ending.id;
  $('event-emoji').textContent=ending.emoji;
  $('event-title').textContent=ending.title;
  $('event-caption').textContent=ending.caption;
  overlay.querySelectorAll('.event-props span').forEach(function(el,i){ el.textContent=props[i]; });
  overlay.classList.remove('hidden');
  nauEl.dataset.ending=ending.id;
  failureSound(ending.id);
  // 멈춤은 연출 중에도 동작한다. 연출이 끝나면 자동으로 결과 화면을 연다.
  for(var i=0;i<22 && !stopRequested;i++) await sleep(80);
  overlay.classList.add('hidden');
  delete nauEl.dataset.ending;
}

/* ---------- 심부름 목록 ---------- */
function renderShoppingList(container){
  container.replaceChildren();
  eng.shoppingList.forEach(function(key){
    var item = ITEMS[key];
    var done = eng.collected.includes(key);
    var slot = document.createElement('div');
    slot.dataset.item = key;
    slot.className = 'slot' + (done ? ' done' : '');
    slot.innerHTML = '<span class="e" aria-hidden="true">'+item.emoji+'</span>'+item.label+
      '<span class="n">'+(done ? '<span class="slot-mark" aria-hidden="true">✓</span> 담았어요' : '아직')+'</span>';
    container.appendChild(slot);
  });
}

/* ---------- Blockly ---------- */
var ws=null, toolboxLevel;
function shoppingToolbox(){
  var types = ['nau_start', 'nau_move', 'nau_left', 'nau_right', 'nau_pick', 'nau_repeat', 'nau_if', 'nau_checkout'];
  return { kind:'flyoutToolbox', contents:types.map(function(type){
    return { kind:'block', type:type, gap:8 };
  }) };
}
function loadStarter(){ try{ Blockly.serialization.workspaces.load(level.starter, ws); }catch(e){} }
function initBlockly(){
  if(ws){
    if(toolboxLevel!==level.id){ ws.updateToolbox(shoppingToolbox()); toolboxLevel=level.id; }
    return;
  }
  Blockly.defineBlocksWithJsonArray([
    { type:'nau_start', message0:'시작하기', nextStatement:null, style:'finish_blocks', tooltip:'' },
    { type:'nau_move', message0:'앞으로 가기', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'' },
    { type:'nau_left', message0:'왼쪽으로 돌기', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'' },
    { type:'nau_right', message0:'오른쪽으로 돌기', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'' },
    { type:'nau_pick', message0:'서 있는 물건 집기', previousStatement:null, nextStatement:null, style:'action_blocks', tooltip:'' },
    { type:'nau_checkout', message0:'종료하기', previousStatement:null, style:'finish_blocks', tooltip:'' },
    { type:'nau_repeat', message0:'%1 번 반복하기', args0:[{ type:'field_number', name:'TIMES', value:3, min:1, max:20, precision:1 }],
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
    componentStyles: { workspaceBackgroundColour:'#FFFFFF', flyoutBackgroundColour:'#F9F9F9', flyoutOpacity:1, scrollbarColour:'#C7C7C7', insertionMarkerColour:'#23262D', insertionMarkerOpacity:0.3 },
    fontStyle: { family:"'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif", weight:'bold', size:15 }
  });
  Blockly.Scrollbar.scrollbarThickness = 12;
  ws = Blockly.inject('blocklyDiv', {
    toolbox: shoppingToolbox(), renderer:'zelos', theme: theme, trashcan:false, sounds:false,
    maxInstances:{ nau_start:1, nau_checkout:1 },
    scrollbars:true, move:{ scrollbars:true, drag:true, wheel:true }, zoom:{ controls:false, wheel:false, startScale:0.75 },
    grid:{ spacing:0, length:0, snap:false }
  });
  toolboxLevel=level.id;
  loadStarter();
  ws.addChangeListener(function(e){ if(e.isUiEvent) return; updateCount(); });
  updateCount();
  var editor = $('blocklyDiv');
  new ResizeObserver(function(){
    if(editor.clientWidth) Blockly.svgResize(ws);
  }).observe(editor);
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
function updateCount(){ if(!ws) return; $('block-count').textContent='블록 '+ws.getAllBlocks(false).length+'개'; }

/* ---------- 실행 ---------- */
var running=false, stopRequested=false, lastResult=null, route=[], runTask=null, returningHome=false;
var STEP_DELAY_MS = 380;
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function resetRun(){
  eng.reset(); route=[[eng.r,eng.c]]; placeNau(true); nauEl.classList.remove('bump', 'picking', 'slipping');
  $('failure-overlay').classList.add('hidden');
  delete $('failure-overlay').dataset.ending;
  delete nauEl.dataset.ending;
  gridEl.querySelectorAll('.picked, .triggered').forEach(function(cell){ cell.classList.remove('picked', 'triggered'); });
  document.querySelectorAll('.item-flight, .trap-loss').forEach(function(el){ el.remove(); });
  renderShoppingList($('recipe'));
}
function handleEvent(ev){
  switch(ev.type){
    case 'move': route.push([eng.r,eng.c]); placeNau(); SFX.step(); break;
    case 'bump': nauEl.classList.remove('bump'); void nauEl.offsetWidth; nauEl.classList.add('bump'); SFX.bump(); break;
    case 'turn': placeNau(); SFX.turn(); break;
    case 'trap': {
      route.push([eng.r,eng.c]); placeNau();
      var cell = gridEl.children[ev.row*eng.cols+ev.col];
      cell.classList.add('triggered');
      nauEl.classList.remove('slipping'); void nauEl.offsetWidth; nauEl.classList.add('slipping');
      var loss = document.createElement('span'); loss.className='trap-loss'; loss.textContent='−'+ev.penalty;
      nauEl.appendChild(loss);
      SFX.bump();
      return sleep(700).then(function(){ loss.remove(); nauEl.classList.remove('slipping'); });
    }
    case 'pick': return animatePick(ev);
    case 'pickNothing':
      nauEl.classList.add('picking'); SFX.nothing();
      return sleep(420).then(function(){ nauEl.classList.remove('picking'); });
    case 'checkout': SFX.checkout(); break;
  }
}
function setRunningUI(on){
  running=on; $('ws-lock').classList.toggle('on', on);
  $('btn-run').disabled=on; $('btn-stop').disabled=!on; $('btn-clear').disabled=on; $('btn-new-map').disabled=on;
}
async function runProgram(){
  if(running || mapPending || returningHome || !attempt || lastResult) return;
  ensureAudio();
  var prog = readProgram();
  if(!prog.start){ toast('시작하기 블록을 놓아주세요'); return; }
  if(!prog.ast.length){ toast('시작하기 아래에 블록을 연결해주세요'); return; }
  if(!validProgramSize(prog.ast)){ toast('블록은 500개, 겹친 반복은 12단계까지 사용할 수 있어요'); return; }
  stopRequested=false; setRunningUI(true); resetRun();
  var gen = E.interpret(prog.ast, eng), step, completed=null;
  try{ ws.highlightBlock(prog.start.id); }catch(e){}
  await sleep(300);
  while(!stopRequested && !(step=gen.next()).done){
    try{ ws.highlightBlock(step.value.node.id); }catch(e){}
    if(eng.ended){
      completed=finishProgram(prog);
      $('btn-stop').disabled=true;
    }
    var motion = handleEvent(step.value.ev);
    var t = step.value.ev.type;
    await Promise.all([motion, sleep((t==='repeat'||t==='if')? STEP_DELAY_MS*0.5 : STEP_DELAY_MS)]);
  }
  try{ ws.highlightBlock(null); }catch(e){}
  setRunningUI(false);
  if(stopRequested && !completed) return;
  if(eng.overflow) toast('동작 한도에 도달했어요');
  if(!completed) completed=finishProgram(prog);
  if(isCurrent(completed)) openNameDialog(completed);
}
function finishProgram(prog){
  var elapsed=freezeTimer();
  lastResult={ attemptId:attempt.id, revision:sessionRevision, levelId:level.id,
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
  trapped:{ emoji:'💦', title:'함정에 걸렸어요!' },
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
  $('res-story').textContent=ending ? ending.message : '';
  $('res-story').classList.toggle('hidden', !ending);
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
  $('btn-name-entry').disabled=R.registered || !R.eligible;
  $('btn-name-entry').textContent=R.registered?'등록했어요':R.eligible?'이름 남기기':'다시 도전해요';
  $('btn-retry').disabled=mapPending || !!R.finishPromise;
  tb.closest('.table-wrap').classList.toggle('hidden', !terminal);
  showScene(3);
  if(!R.shown){
    R.shown=true;
    if(R.res.perfect) SFX.win(); else SFX.lose();
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
  $('hof-status').textContent=R.registered?(R.savedRank?'내 기록 '+R.savedRank+'위 · 점수순, 같은 점수는 빠른 풀이순':'이름을 남겼어요.'):'';
}
async function renderHof(R){
  var request=++hofRequest; $('hof-status').textContent='명예의 전당을 불러오고 있어요…';
  try{
    var data=await api('leaderboard?level='+encodeURIComponent(R.levelId));
    if(request!==hofRequest || !isCurrent(R)) return;
    renderHofEntries(data.entries,R);
    if(R.finishError) $('hof-status').textContent='기록을 확인하지 못했어요. 이름 남기기에서 다시 시도해 주세요.';
  }catch(error){
    if(request===hofRequest && isCurrent(R)) $('hof-status').textContent='명예의 전당을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  }
}

/* ---------- 이벤트 바인딩 ---------- */
renderLevelPicker();
$('btn-start').addEventListener('click',function(){ ensureAudio(); newMap(); });
$('zoom-in').addEventListener('click', function(){ if(ws) ws.zoomCenter(1); });
$('zoom-out').addEventListener('click', function(){ if(ws) ws.zoomCenter(-1); });
$('zoom-reset').addEventListener('click', function(){ if(ws){ ws.setScale(0.75); ws.scrollCenter(); } });
$('btn-new-map').addEventListener('click',function(){ newMap(); });
$('btn-run').addEventListener('click',function(){ if(!running) runTask=runProgram(); });
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
async function returnHome(){
  if(returningHome) return;
  returningHome=true; stopRequested=true; mapRequest++; sessionRevision++; hofRequest++;
  freezeTimer(); closeNameDialog();
  try{ await runTask; }finally{
    attempt=null; lastResult=null; mapBusy(false); closeNameDialog();
    returningHome=false;
  }
  showScene(1); if(ws){ ws.clear(); loadStarter(); updateCount(); }
  $('btn-start').focus();
}
$('btn-home').addEventListener('click',returnHome);
$('btn-restart').addEventListener('click',returnHome);
$('btn-level').addEventListener('click',async function(){
  await returnHome();
  var selected=$('level-picker').querySelector('[aria-pressed="true"]');
  if(selected) selected.focus();
});
$('btn-name-entry').addEventListener('click',function(){ if(lastResult) openNameDialog(lastResult); });
$('name-form').addEventListener('submit',submitName);
$('name-skip').addEventListener('click',skipNameDialog);
$('name-dialog').addEventListener('cancel',function(event){ event.preventDefault(); skipNameDialog(); });
$('name-dialog').addEventListener('close',function(){ if(!$('name-dialog').open && activeDialogResult) skipNameDialog(); });
$('player-name').addEventListener('input',function(){ this.setCustomValidity(''); });
})();
