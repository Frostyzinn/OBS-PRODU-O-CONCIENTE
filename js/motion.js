(function(){
  const ready=()=>document.body.classList.add('motion-ready');
  function injectLiveStatus(){
    const top=document.querySelector('.topbar');
    if(!top || top.querySelector('.live-status')) return;
    const actions=top.querySelector('.actions');
    const status=document.createElement('div');
    status.className='live-status';
    status.innerHTML='<span>HOJE</span><span class="status-date"></span><span class="live-time"></span>';
    (actions||top).prepend(status);
    status.querySelector('.status-date').textContent=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    const time=status.querySelector('.live-time');
    const tick=()=>{const d=new Date();time.textContent=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
    tick();setInterval(tick,30000);
  }
  function toast(title,message,type='success'){
    const old=document.querySelector('.toast');if(old)old.remove();
    const el=document.createElement('div');el.className='toast '+type;el.innerHTML='<strong>'+escapeHtml(title)+'</strong><small>'+escapeHtml(message)+'</small>';document.body.appendChild(el);setTimeout(()=>el.remove(),3600);
  }
  function observeDynamic(){
    const observer=new MutationObserver(mutations=>{
      mutations.forEach(m=>m.addedNodes.forEach(node=>{if(node.nodeType===1){node.classList.add('motion-item');}}));
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
  window.pcToast=toast;
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(ready,20);injectLiveStatus();observeDynamic();});
})();
