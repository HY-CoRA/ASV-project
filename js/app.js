(function(){
'use strict';
var E = NauEngine, ITEMS = E.ITEMS;
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
    card.innerHTML = '<b>'+lv.name+'</b><span class="hint">'+(lv.id===1 ? '기본 블록 · 쉬운 길' : '반복·조건 블록 · 미로')+'</span>';
    card.addEventListener('click', function(){ selectLevel(lv); });
    box.appendChild(card);
  });
  $('level-label').textContent = level.name;
  $('btn-start').textContent = '▶ '+level.name+' 시작하기';
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
    else if(ITEMS[v]){ d.classList.add('item'); d.innerHTML='<span class="b">'+ITEMS[v].emoji+'</span><small>'+v+'</small>'; }
    d.title = v==='#'?'벽': v==='S'?'입구': ITEMS[v]? ITEMS[v].label : '통로';
    gridEl.appendChild(d);
  }
  nauEl=document.createElement('div'); nauEl.className='nau';
  nauEl.style.width=(100/eng.cols)+'%'; nauEl.style.height=(100/eng.rows)+'%';
  nauEl.innerHTML='<span class="body">🧒</span><span class="dir">▲</span>'; gridEl.appendChild(nauEl);
}
function placeNau(instant){
  if(instant) nauEl.style.transition='none';
  nauEl.style.left=(eng.c*100/eng.cols)+'%'; nauEl.style.top=(eng.r*100/eng.rows)+'%';
  nauEl.querySelector('.dir').style.transform='rotate('+(eng.d*90)+'deg)';
  if(instant){ void nauEl.offsetWidth; nauEl.style.transition=''; }
}

/* ---------- 심부름 목록 ---------- */
function renderShoppingList(container){
  container.replaceChildren();
  eng.shoppingList.forEach(function(key){
    var item = ITEMS[key];
    var done = eng.collected.includes(key);
    var slot = document.createElement('div');
    slot.className = 'slot' + (done ? ' done' : '');
    slot.innerHTML = '<span class="n">'+(done ? '<span class="slot-mark" aria-hidden="true">✓</span> 담았어요' : '아직')+
      '</span><span class="e" aria-hidden="true">'+item.emoji+'</span>'+item.label;
    container.appendChild(slot);
  });
}

/* ---------- Blockly ---------- */
var ws=null, toolboxLevel;
function shoppingToolbox(){
  var types = ['nau_move', 'nau_left', 'nau_right', 'nau_pick'];
  if(level.id===2) types.push('nau_repeat', 'nau_if');
  types.push('nau_checkout');
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
    { type:'nau_move', message0:'앞으로 가기 🚶', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'보는 방향으로 한 칸 이동' },
    { type:'nau_left', message0:'왼쪽으로 돌기 ↩️', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'제자리에서 왼쪽으로 90도' },
    { type:'nau_right', message0:'오른쪽으로 돌기 ↪️', previousStatement:null, nextStatement:null, style:'move_blocks', tooltip:'제자리에서 오른쪽으로 90도' },
    { type:'nau_pick', message0:'서 있는 물건 집기 ✋', previousStatement:null, nextStatement:null, style:'action_blocks', tooltip:'지금 서 있는 칸에 놓인 물건을 집어요' },
    { type:'nau_checkout', message0:'종료 / 계산하기 🧾', previousStatement:null, style:'finish_blocks', tooltip:'장보기를 끝내고 심부름 점수를 계산해요' },
    { type:'nau_repeat', message0:'%1 번 반복하기 🔁', args0:[{ type:'field_number', name:'TIMES', value:3, min:1, max:20, precision:1 }],
      message1:'%1', args1:[{ type:'input_statement', name:'DO' }], previousStatement:null, nextStatement:null, style:'loop_blocks', tooltip:'안의 블록을 N번' },
    { type:'nau_if', message0:'만약 %1', args0:[{ type:'field_dropdown', name:'COND', options:[
        ['앞에 벽이 있다면','WALL'], ['앞에 벽이 없다면','NOWALL'] ] }],
      message1:'%1', args1:[{ type:'input_statement', name:'DO' }], previousStatement:null, nextStatement:null, style:'logic_blocks', tooltip:'조건이 맞을 때만 안의 블록을 실행' }
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
    scrollbars:true, move:{ scrollbars:true, drag:true, wheel:true }, zoom:{ controls:false, wheel:false, startScale:0.8 },
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
  var tops = ws.getTopBlocks(true), seq=[];
  tops.forEach(function(b){ seq = seq.concat(readChain(b)); });
  return { ast: seq, chains: tops.length };
}
function updateCount(){ if(!ws) return; $('block-count').textContent='블록 '+ws.getAllBlocks(false).length+'개'; }

/* ---------- 실행 ---------- */
var running=false, stopRequested=false, lastResult=null;
var STEP_DELAY_MS = 380;
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function resetRun(){
  eng.reset(); placeNau(true); nauEl.classList.remove('bump');
  gridEl.querySelectorAll('.picked').forEach(function(cell){ cell.classList.remove('picked'); });
  renderShoppingList($('recipe'));
}
function handleEvent(ev){
  switch(ev.type){
    case 'move': placeNau(); SFX.step(); break;
    case 'bump': nauEl.classList.remove('bump'); void nauEl.offsetWidth; nauEl.classList.add('bump'); SFX.bump(); break;
    case 'turn': placeNau(); SFX.turn(); break;
    case 'pick': {
      var item = ITEMS[ev.item];
      gridEl.children[ev.row*eng.cols+ev.col].classList.add('picked');
      renderShoppingList($('recipe'));
      if(!eng.shoppingList.includes(ev.item)) toast(item.emoji+' '+item.label+' · 심부름 목록에 없어요');
      SFX.pick();
      break;
    }
    case 'pickNothing': SFX.nothing(); toast('이 칸에는 집을 물건이 없어요'); break;
    case 'checkout': SFX.checkout(); break;
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
  if(prog.chains>1) toast('블록 묶음 '+prog.chains+'개를 위에서부터 실행해요.');
  stopRequested=false; setRunningUI(true); resetRun();
  var gen = E.interpret(prog.ast, eng), step;
  await sleep(300);
  while(!stopRequested && !(step=gen.next()).done){
    try{ ws.highlightBlock(step.value.node.id); }catch(e){}
    handleEvent(step.value.ev);
    var t = step.value.ev.type;
    await sleep((t==='repeat'||t==='if')? STEP_DELAY_MS*0.5 : STEP_DELAY_MS);
  }
  try{ ws.highlightBlock(null); }catch(e){}
  if(!stopRequested) await sleep(700);
  setRunningUI(false);
  if(stopRequested) return;
  if(eng.overflow) toast('동작이 너무 많아서 중간에 멈췄어요 (상한 600). 반복 횟수를 줄여보세요.');
  var blocks = ws.getAllBlocks(false).length;
  lastResult = { res: E.score(eng), blocks: blocks, actions: eng.actions, bumps: eng.bumps, checkedOut: eng.checkedOut };
  showResult();
}

/* ---------- 결과 ---------- */
var VERDICTS = {
  perfect:{ emoji:'🎉', title:'심부름 성공!' },
  incomplete:{ emoji:'📝', title:'빠뜨린 물건이 있어요' },
  wrong:{ emoji:'🛍️', title:'목록에 없는 물건을 담았어요' },
  unfinished:{ emoji:'🧾', title:'장보기가 아직 안 끝났어요', message:'마지막에 ‘종료 / 계산하기’ 블록을 붙여요.' }
};
function showResult(){
  var R = lastResult, v = VERDICTS[R.res.verdict];
  $('res-emoji').textContent=v.emoji; $('res-title').textContent=v.title;
  $('res-message').textContent=v.message || '';
  $('res-score').textContent=R.res.total; $('res-max').textContent='/ '+R.res.max+'점';
  $('res-score').parentElement.classList.toggle('hidden', !R.checkedOut);
  $('res-blocks').textContent=R.blocks; $('res-actions').textContent=R.actions; $('res-bumps').textContent=R.bumps;
  $('res-extras').textContent=R.res.rows.filter(function(row){ return row.pts<0; }).length;
  var tb=$('res-rows'); tb.innerHTML='';
  if(!R.res.rows.length){ tb.innerHTML='<tr><td colspan="3">아무것도 담지 않았어요.</td></tr>'; }
  R.res.rows.forEach(function(row){
    var tr=document.createElement('tr');
    tr.innerHTML='<td>'+row.emoji+' '+row.label+'</td><td>'+row.verdict+'</td><td class="pts '+(row.pts>0?'plus':'minus')+'">'+(row.pts>0?'+':'')+row.pts+'</td>';
    tb.appendChild(tr);
  });
  renderShoppingList($('res-shopping-list'));
  showScene(3);
  if(R.res.perfect) SFX.win(); else SFX.lose();
  tb.closest('.table-wrap').classList.toggle('hidden', !R.checkedOut);
  tb.closest('.table-wrap').scrollTop=0;
  $('hof-list').scrollTop=0;
  $('hof-form').classList.toggle('hidden', !R.checkedOut);
  $('hof-name').value=''; $('hof-submit').disabled=false; $('hof-submit').textContent='등록';
  renderHof(null);
}

/* ---------- 명예의 전당 (레벨별, localStorage) ---------- */
function hofKey(){ return 'nau_shopping_hof_v1_L'+level.id; }
function loadHof(){ try{ var s=localStorage.getItem(hofKey()); return s? JSON.parse(s): []; }catch(e){ return []; } }
function saveHof(list){ try{ localStorage.setItem(hofKey(), JSON.stringify(list)); return true; }catch(e){ return false; } }
function renderHof(mine){
  var list = loadHof().sort(E.compareEntries).slice(0,10), ol=$('hof-list'); ol.innerHTML='';
  if(!list.length){ ol.innerHTML='<li style="display:block;color:var(--muted)">아직 아무도 없어요. 첫 번째로 이름을 남겨보세요.</li>'; return; }
  list.forEach(function(e,i){
    var li=document.createElement('li'); if(mine && e.ts===mine) li.classList.add('me');
    li.innerHTML='<span class="rk">'+(i+1)+'</span><span>'+escapeHtml(e.name)+'</span><span class="meta">블록 '+e.blocks+' · 동작 '+e.actions+'</span><span class="sc">'+e.score+'</span>';
    ol.appendChild(li);
  });
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* ---------- 이벤트 바인딩 ---------- */
renderLevelPicker();
$('btn-start').addEventListener('click', function(){
  showScene(2); buildGrid(); resetRun();
  try{ initBlockly(); Blockly.svgResize(ws); }catch(e){ toast('블록 편집기를 불러오지 못했어요: '+e.message); }
});
$('btn-run').addEventListener('click', function(){ runProgram(); });
$('btn-stop').addEventListener('click', function(){ stopRequested=true; });
$('btn-clear').addEventListener('click', function(){ if(ws && confirm('블록을 모두 지울까요?')){ ws.clear(); updateCount(); } });
$('btn-retry').addEventListener('click', function(){ showScene(2); resetRun(); Blockly.svgResize(ws); });
$('btn-restart').addEventListener('click', function(){ showScene(1); if(ws){ ws.clear(); loadStarter(); updateCount(); } });
$('hof-form').addEventListener('submit', function(ev){
  ev.preventDefault();
  if(!lastResult || !lastResult.checkedOut) return;
  var name=$('hof-name').value.trim() || '이름 없는 심부름꾼';
  var list=loadHof(); var entry={ name:name, score:lastResult.res.total, blocks:lastResult.blocks, actions:lastResult.actions, ts:Date.now() };
  list.push(entry);
  if(saveHof(list)){ $('hof-submit').disabled=true; $('hof-submit').textContent='등록됨'; renderHof(entry.ts); toast('명예의 전당에 올렸어요'); }
  else { toast('이 브라우저에서는 저장이 안 돼요 (저장 공간 차단)'); renderHof(null); }
});
})();
