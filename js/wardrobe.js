/* Original, code-drawn pixel artwork. No external assets or network needed. */
(function(global){
'use strict';
var KEY='nau_cake_wardrobe_v1';
var catalog={
  hair:[{id:'long',name:'찰랑 긴 머리',sub:'부드러운 웨이브'},{id:'bob',name:'동글 단발',sub:'가볍고 산뜻하게'},{id:'short',name:'포근 숏컷',sub:'삐죽 앞머리 포인트'},{id:'twintail',name:'방울 양갈래',sub:'양쪽으로 통통!'}],
  outfit:[{id:'hoodie',name:'구름 후드',sub:'민트빛 포근한 하루'},{id:'overalls',name:'딸기 멜빵',sub:'분홍 주머니에 콕'},{id:'baker',name:'꼬마 파티시에',sub:'케이크 만들 준비 끝'},{id:'varsity',name:'별빛 야구 점퍼',sub:'노란 별 하나 반짝'}],
  accessory:[{id:'none',name:'가볍게 출발',sub:'그대로도 멋져요'},{id:'ribbon',name:'체리 리본',sub:'머리 위 작은 포인트'},{id:'cap',name:'레몬 모자',sub:'햇살 같은 노랑'},{id:'headphones',name:'소다 헤드폰',sub:'장보기도 신나게'}],
  basket:[{id:'mint',name:'민트 마켓',sub:'가볍게 들고 가요'},{id:'strawberry',name:'딸기 우유',sub:'분홍 체크와 딸기'},{id:'picnic',name:'소풍 바구니',sub:'따뜻한 라탄 무늬'},{id:'star',name:'별빛 한 스푼',sub:'보랏빛 밤과 작은 별'}]
};
var skinColors=['#ffe0c6','#efba91','#ce9069','#965f47'];
var hairColors=[{name:'초콜릿',base:'#634339',light:'#8b6250',dark:'#382b32'},{name:'밤하늘',base:'#34354b',light:'#545970',dark:'#202238'},{name:'밀크티',base:'#b48758',light:'#d3ae7d',dark:'#705441'},{name:'베리',base:'#86516c',light:'#ae7590',dark:'#4c344c'}];
function preset(g){return {hair:g==='girl'?'long':'short',outfit:g==='girl'?'overalls':'hoodie',accessory:'none',basket:g==='girl'?'strawberry':'mint',skin:0,hairColor:0};}
function fresh(){return {character:'girl',profiles:{girl:preset('girl'),boy:preset('boy')}};}
function copy(x){return JSON.parse(JSON.stringify(x));}
function valid(raw){
  var out=fresh();
  if(!raw||typeof raw!=='object')return out;
  if(raw.character==='boy')out.character='boy';
  ['girl','boy'].forEach(function(g){
    var p=raw.profiles&&raw.profiles[g];if(!p||typeof p!=='object')return;
    Object.keys(catalog).forEach(function(k){if(catalog[k].some(function(v){return v.id===p[k];}))out.profiles[g][k]=p[k];});
    ['skin','hairColor'].forEach(function(k){if(Number.isInteger(p[k])&&p[k]>=0&&p[k]<4)out.profiles[g][k]=p[k];});
  });
  return out;
}
var state=fresh();
try{state=valid(JSON.parse(global.localStorage.getItem(KEY)));}catch(e){}
var draft=copy(state), category='hair', onClose=null;
var $=function(id){return document.getElementById(id);};
function profile(s){return s.profiles[s.character];}
function item(k,id){return catalog[k].filter(function(x){return x.id===id;})[0];}
function rect(x,y,w,h,c){return '<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';}
function path(d,c){return '<path d="'+d+'" fill="'+c+'"/>';}
function svg(body,box){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(box||'0 0 96 112')+'" shape-rendering="crispEdges" aria-hidden="true" focusable="false">'+body+'</svg>';}
function basketBody(id){
  var palettes={mint:['#75cdbc','#baf3d9','#398d89'],strawberry:['#f391ad','#ffe0df','#bc597e'],picnic:['#c99860','#f4d7a3','#936747'],star:['#8981c7','#c9bafb','#5c548e']},p=palettes[id]||palettes.mint;
  var s=path('M10 12V6H14V2H26V6H30V12H26V7H14V12Z',p[2]);
  s+=rect(3,12,34,5,p[2])+rect(5,17,30,20,p[0])+rect(8,19,24,3,p[1])+rect(8,34,24,3,p[2]);
  for(var x=10;x<33;x+=7)s+=rect(x,24,3,7,p[1]);
  if(id==='strawberry')s+=path('M17 22H24V25H26V29H24V32H19V29H16V25H17Z','#cf4869')+rect(19,20,5,3,'#4b9874')+rect(20,25,2,2,'#fff0c4');
  if(id==='star')s+=path('M21 20L23 24H28L24 28L25 33L21 30L17 33L18 28L14 24H19Z','#ffe38c');
  if(id==='picnic')s+=rect(5,26,30,2,p[2])+rect(12,18,2,16,p[2])+rect(26,18,2,16,p[2]);
  return s;
}
function basketSVG(id){return svg(basketBody(id),'0 0 40 40');}
function avatarSVG(p,dir){
  p=p||profile(state);dir=Number(dir)||0;
  var hc=hairColors[p.hairColor],skin=skinColors[p.skin],edge='#363047',s='';
  // Hair silhouette, behind the face and clothing.
  s+=path(p.hair==='short'?'M29 12H36V8H58V12H65V17H70V25H73V40H68V46H28V40H23V27H26V17H29Z':'M29 12H36V8H58V12H65V17H70V25H73V55H68V60H28V55H23V27H26V17H29Z',hc.dark);
  s+=rect(28,22,40,p.hair==='short'?24:38,hc.base);
  if(p.hair==='long')s+=path('M24 33H32V76H28V83H21V71H19V51H22V39H24ZM64 33H72V43H76V72H73V83H66V76H64Z',hc.base)+rect(23,48,3,23,hc.light)+rect(69,46,3,28,hc.light);
  if(p.hair==='twintail')s+=path('M20 27H29V37H23V46H25V67H20V73H12V66H15V40H12V33H20ZM67 27H76V33H84V40H81V66H84V73H76V67H71V46H73V37H67Z',hc.base)+rect(17,37,5,4,'#f5a8b8')+rect(74,37,5,4,'#f5a8b8')+rect(16,46,3,15,hc.light)+rect(77,46,3,15,hc.light);
  if(p.hair==='bob')s+=rect(23,37,8,18,hc.base)+rect(65,37,8,18,hc.base)+rect(25,55,8,5,hc.dark)+rect(63,55,8,5,hc.dark);
  // Legs, socks and little sneakers.
  s+=rect(33,82,12,21,skin)+rect(51,82,12,21,skin)+rect(33,96,12,7,'#fff5e5')+rect(51,96,12,7,'#fff5e5');
  s+=rect(30,103,17,6,edge)+rect(49,103,17,6,edge)+rect(32,101,13,5,'#c8ddd9')+rect(51,101,13,5,'#c8ddd9')+rect(32,107,13,2,'#fff8e8')+rect(51,107,13,2,'#fff8e8');
  var cloth={hoodie:'#86d8c5',overalls:'#f1a4b7',baker:'#fff0cc',varsity:'#8a85c4'}[p.outfit];
  s+=path('M34 55H62V59H69V66H73V84H65V76H63V91H33V76H31V84H23V66H27V59H34Z',edge);
  s+=rect(29,62,8,15,cloth)+rect(59,62,8,15,cloth)+rect(35,59,26,28,cloth)+rect(25,77,8,9,skin)+rect(63,77,8,9,skin);
  s+=rect(40,54,16,9,skin)+rect(38,59,4,4,'#fff6e8')+rect(54,59,4,4,'#fff6e8');
  if(p.outfit==='hoodie'){
    s+=rect(39,61,18,4,'#c7f6df')+rect(41,65,2,8,'#fff8e7')+rect(53,65,2,8,'#fff8e7')+rect(40,77,16,7,'#64b6ab')+rect(43,76,10,2,'#c7f6df')+rect(35,87,26,8,'#536783')+rect(46,88,4,8,edge)+rect(27,73,8,4,'#c7f6df')+rect(61,73,8,4,'#c7f6df');
  }else if(p.outfit==='overalls'){
    s+=rect(35,60,26,14,'#fff8e8')+rect(36,60,5,29,cloth)+rect(55,60,5,29,cloth)+rect(37,71,22,19,cloth)+rect(39,71,3,3,'#ffe49c')+rect(54,71,3,3,'#ffe49c')+rect(43,77,10,8,'#dc7e9a')+rect(46,78,4,5,'#fff0df')+rect(35,89,26,6,'#df8aab')+rect(46,90,4,6,edge);
  }else if(p.outfit==='baker'){
    s+=rect(35,61,26,27,'#f4a4aa')+rect(38,65,20,25,'#fff5dd')+rect(39,59,4,13,'#fff5dd')+rect(53,59,4,13,'#fff5dd')+rect(44,77,8,6,'#c6dfbe')+rect(35,90,26,5,'#7d8b9c')+rect(46,90,4,6,edge)+rect(44,62,8,3,'#a4626e');
  }else{
    s+=rect(29,64,6,12,'#fff4de')+rect(61,64,6,12,'#fff4de')+rect(46,63,4,25,'#fff4de')+rect(37,85,22,3,'#686199')+path('M56 66L58 70H62L59 73L60 77L56 75L53 77L54 73L51 70H55Z','#ffe08b')+rect(35,88,26,8,'#53576f')+rect(46,89,4,7,edge);
  }
  // Face and side ears. Expressions remain legible at small sizes.
  s+=rect(27,29,7,13,skin)+rect(62,29,7,13,skin)+path('M33 22H61V26H65V44H61V50H56V54H40V50H34V45H31V28H33Z',skin);
  s+=rect(34,42,7,4,'#eea4a3')+rect(56,42,7,4,'#eea4a3')+rect(37,32,8,2,hc.dark)+rect(53,32,8,2,hc.dark);
  s+=rect(37,35,8,9,'#fff9ee')+rect(53,35,8,9,'#fff9ee')+rect(39,35,6,8,edge)+rect(53,35,6,8,edge)+rect(40,35,2,3,'#ffffff')+rect(54,35,2,3,'#ffffff')+rect(46,47,6,2,'#bd727b');
  s+=path('M29 19H33V15H38V12H57V15H63V20H66V31H59V26H55V32H50V25H45V30H40V25H35V32H29Z',hc.base)+rect(35,17,22,3,hc.light)+rect(31,22,4,7,hc.light);
  if(p.hair==='short')s+=path('M30 16H35V11H39V7H44V11H57V15H64V20H59V17H47V22H41V18H36V23H30Z',hc.base)+rect(37,13,18,3,hc.light);
  if(p.accessory==='ribbon')s+=path('M55 16V7H60L65 11L70 7H76V17H70L65 14L60 18Z','#d66b95')+rect(63,10,5,7,'#ffa7c4')+rect(57,9,3,4,'#ffcad8');
  if(p.accessory==='cap')s+=path('M28 19V12H33V8H59V12H65V22H24V19Z','#eac46d')+rect(31,12,28,6,'#ffe8a1')+rect(24,22,47,5,'#b99054')+rect(44,12,7,6,'#fff9da');
  if(p.accessory==='headphones')s+=path('M23 34V19H27V12H34V8H61V12H68V19H72V36H67V20H63V15H33V20H28V34Z','#a5dcd8')+rect(21,29,9,17,'#d2f5e7')+rect(24,33,4,10,'#70b7bd')+rect(65,29,9,17,'#d2f5e7')+rect(67,33,4,10,'#70b7bd');
  // Back and side views retain outfit, hair and a clear facing silhouette.
  if(dir===0){
    s+=path('M29 24H65V43H61V49H56V53H40V49H34V43H29Z',hc.base)+rect(33,26,3,16,hc.light)+rect(38,46,20,3,hc.dark);
    if(p.hair==='long')s+=rect(31,43,34,25,hc.base)+rect(34,45,3,18,hc.light)+rect(38,66,20,3,hc.dark);
  }
  if(dir===1||dir===3){
    var faceX=dir===1?46:31,eyeX=dir===1?58:33;
    s+=rect(31,29,34,17,hc.base)+rect(faceX,29,19,17,skin)+rect(eyeX,35,5,7,edge)+rect(eyeX,35,2,2,'#fff9ee')+rect(dir===1?58:34,44,5,3,'#eea4a3');
  }
  s+='<g transform="translate(62 73) scale(.66)">'+basketBody(p.basket)+'</g>';
  return svg(s);
}
function summary(p){return item('outfit',p.outfit).name+' · '+item('basket',p.basket).name;}
function apply(){
  var p=profile(state);
  document.querySelectorAll('[data-nau-avatar]').forEach(function(el){el.innerHTML=avatarSVG(p,2);});
  document.querySelectorAll('[data-nau-basket]').forEach(function(el){el.innerHTML=basketSVG(p.basket);});
  document.querySelectorAll('[data-nau-summary]').forEach(function(el){el.textContent=summary(p);});
  var live=document.querySelector('.cart');if(live)live.dataset.basket=p.basket;
  global.dispatchEvent(new Event('nau-look-change'));
}
function swatches(box,colors,key,names){
  box.innerHTML='';
  colors.forEach(function(color,i){
    var b=document.createElement('button');b.type='button';b.className='closet-swatch';b.style.setProperty('--swatch',color);
    b.setAttribute('aria-label',names[i]);b.setAttribute('aria-pressed',profile(draft)[key]===i?'true':'false');b.title=names[i];b.textContent=profile(draft)[key]===i?'✓':'';
    b.addEventListener('click',function(){
      profile(draft)[key]=i;renderPreview();renderSwatches();renderOptions();
      box.children[i].focus();
    });
    box.appendChild(b);
  });
}
function renderSwatches(){
  swatches($('wardrobe-skins'),skinColors,'skin',['밝은 살구빛','따뜻한 살구빛','캐러멜빛','깊은 갈색빛']);
  swatches($('wardrobe-colors'),hairColors.map(function(c){return c.base;}),'hairColor',hairColors.map(function(c){return c.name;}));
}
function renderPreview(){
  var p=profile(draft),name=draft.character==='girl'?'여자 나우':'남자 나우';
  $('wardrobe-avatar').innerHTML=avatarSVG(p,2);$('wardrobe-avatar').setAttribute('aria-label',name+', '+item('hair',p.hair).name+', '+summary(p));
  $('wardrobe-character-name').textContent=name;$('wardrobe-look-name').textContent=item('outfit',p.outfit).name;
  $('wardrobe-basket-preview').innerHTML=basketSVG(p.basket);
  $('wardrobe-description').textContent=item('hair',p.hair).name+' + '+item('outfit',p.outfit).name+' + '+item('basket',p.basket).name;
  document.querySelectorAll('[data-character]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.character===draft.character?'true':'false');});
}
function renderOptions(){
  var box=$('wardrobe-options'),p=profile(draft);box.innerHTML='';
  catalog[category].forEach(function(opt){
    var b=document.createElement('button');b.type='button';b.className='closet-option';b.dataset.option=opt.id;
    b.setAttribute('aria-pressed',p[category]===opt.id?'true':'false');
    var look=copy(p);look[category]=opt.id;
    b.innerHTML='<span class="option-art '+(category==='basket'?'basket-art':'')+'">'+(category==='basket'?basketSVG(opt.id):avatarSVG(look,2))+'</span><span class="option-label"><b>'+opt.name+'</b><small>'+opt.sub+'</small></span><span class="option-check" aria-hidden="true">'+(p[category]===opt.id?'✓':'')+'</span>';
    b.addEventListener('click',function(){
      profile(draft)[category]=opt.id;renderPreview();
      box.querySelectorAll('button').forEach(function(btn){var selected=btn.dataset.option===opt.id;btn.setAttribute('aria-pressed',String(selected));btn.querySelector('.option-check').textContent=selected?'✓':'';});
    });
    box.appendChild(b);
  });
}
function setCategory(k){
  category=k;
  document.querySelectorAll('[data-category]').forEach(function(b){var active=b.dataset.category===k;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  $('wardrobe-options').setAttribute('aria-labelledby','closet-tab-'+k);
  $('wardrobe-category-title').textContent={hair:'머리 모양',outfit:'오늘의 의상',accessory:'작은 포인트',basket:'나의 장바구니'}[k];
  $('wardrobe-hair-colors').classList.toggle('hidden',k!=='hair');renderOptions();
}
function open(close){
  draft=copy(state);onClose=close;category='hair';renderPreview();renderSwatches();setCategory('hair');
  $('wardrobe-title').focus();
}
function init(){
  document.querySelectorAll('[data-character]').forEach(function(b){b.addEventListener('click',function(){draft.character=b.dataset.character;renderPreview();renderSwatches();renderOptions();});});
  document.querySelectorAll('[data-category]').forEach(function(b){b.addEventListener('click',function(){setCategory(b.dataset.category);});});
  $('wardrobe-tabs').addEventListener('keydown',function(e){
    var keys=['hair','outfit','accessory','basket'],i=keys.indexOf(category);
    if(e.key==='ArrowRight')i=(i+1)%4;else if(e.key==='ArrowLeft')i=(i+3)%4;else if(e.key==='Home')i=0;else if(e.key==='End')i=3;else return;
    e.preventDefault();setCategory(keys[i]);$('closet-tab-'+keys[i]).focus();
  });
  $('wardrobe-reset').addEventListener('click',function(){draft.profiles[draft.character]=preset(draft.character);renderPreview();renderSwatches();renderOptions();});
  $('wardrobe-cancel').addEventListener('click',function(){if(onClose)onClose(false);});
  $('wardrobe-save').addEventListener('click',function(){
    state=copy(draft);var saved=true;
    try{global.localStorage.setItem(KEY,JSON.stringify(state));}catch(e){saved=false;}
    apply();if(onClose)onClose(true,saved);
  });
  apply();
}
global.NauWardrobe={init:init,open:open,avatar:function(dir){return avatarSVG(profile(state),dir);},basket:function(){return basketSVG(profile(state).basket);}};
})(window);
