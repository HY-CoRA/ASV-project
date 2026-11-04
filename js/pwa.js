(function(){
'use strict';
var button=document.getElementById('btn-install');
var dialog=document.getElementById('install-dialog');
var instructions=document.getElementById('install-instructions');
var connectionNote=document.getElementById('connection-note');
var standalone=window.matchMedia('(display-mode: standalone)');
var pendingPrompt=null, installed=false;

function refreshInstallButton(){
  button.classList.toggle('hidden',installed || standalone.matches || navigator.standalone===true);
}
function showInstallGuide(){
  var apple=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if(!window.isSecureContext){
    instructions.textContent='앱 설치는 HTTPS 주소로 접속한 뒤 이용해 주세요.\n태블릿의 기본 브라우저에서 열어주세요.';
  }else if(apple){
    instructions.textContent='Safari의 공유 버튼을 누르고\n「홈 화면에 추가」를 선택해 주세요.\n「웹 앱으로 열기」가 보이면 켜둔 채 추가해 주세요.';
  }else{
    instructions.textContent='브라우저 메뉴에서 「앱 설치」 또는\n「홈 화면에 추가」를 선택해 주세요.\n메뉴가 없다면 Chrome이나 Edge에서 열어주세요.';
  }
  if(!dialog.open) dialog.showModal();
}
window.addEventListener('beforeinstallprompt',function(event){
  event.preventDefault(); pendingPrompt=event; refreshInstallButton();
});
window.addEventListener('appinstalled',function(){
  installed=true; pendingPrompt=null; refreshInstallButton();
  if(dialog.open) dialog.close();
});
button.addEventListener('click',async function(){
  if(!pendingPrompt){ showInstallGuide(); return; }
  var prompt=pendingPrompt; pendingPrompt=null; button.disabled=true;
  try{ await prompt.prompt(); await prompt.userChoice; }
  catch(error){ showInstallGuide(); }
  finally{ button.disabled=false; refreshInstallButton(); }
});
document.getElementById('btn-install-close').addEventListener('click',function(){ dialog.close(); });
if(standalone.addEventListener) standalone.addEventListener('change',refreshInstallButton);
function refreshConnection(){ connectionNote.classList.toggle('hidden',navigator.onLine!==false); }
window.addEventListener('online',refreshConnection);
window.addEventListener('offline',refreshConnection);
refreshInstallButton(); refreshConnection();
if('serviceWorker' in navigator && window.isSecureContext){
  navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).catch(function(){
    // A failed shell cache must never prevent an online game from starting.
  });
}
})();
