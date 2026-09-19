// O navegador usa o cookie HttpOnly; pc_user é apenas um cache de apresentação.
(() => {
  const root=document.documentElement;
  const privatePage=root.hasAttribute('data-private');
  let pending,gateText='Verificando acesso…';
  function clear(){sessionStorage.removeItem('pc_user');sessionStorage.removeItem('pc_token');}
  function redirect(){clear();root.dataset.auth='checking';location.replace('/login.html');}
  function message(text){
    gateText=text;
    const show=()=>{const gate=document.getElementById('authGate');if(gate)gate.querySelector('p').textContent=text;};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
  }
  async function validate(){
    root.dataset.auth='checking';
    try{
      const response=await fetch('/api/v1/auth/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
      const data=await response.json();
      if(!response.ok){
        const error=Object.assign(new Error(data.error||`Falha ao verificar sessão (HTTP ${response.status}).`),{status:response.status,code:data.code});
        if(response.status===401||response.status===403){clear();if(privatePage)redirect();}
        throw error;
      }
      if(!data.user)throw new Error('Resposta de autenticação inválida.');
      sessionStorage.setItem('pc_user',JSON.stringify(data.user));
      root.dataset.auth='ready';
      return data;
    }catch(error){
      message(error.status===503?'Serviço indisponível. Tente novamente em instantes.':error.message||'Não foi possível verificar a sessão.');
      throw error;
    }
  }
  function check(){pending=validate();pending.catch(()=>{});return pending;}
  window.pcSession={
    get ready(){return pending||check();},check,redirect,
    async logout(){
      const response=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-PC-Request':'1'},body:'{}'});
      if(!response.ok)throw new Error('Não foi possível encerrar a sessão. Tente novamente.');
      try{localStorage.setItem('pc_logout',String(Date.now()));}catch{}
      redirect();
    }
  };
  sessionStorage.removeItem('pc_token');
  if(privatePage)check();
  window.addEventListener('pagehide',()=>{if(privatePage)root.dataset.auth='checking';});
  window.addEventListener('pageshow',event=>{if(privatePage&&event.persisted)check();});
  window.addEventListener('storage',event=>{if(event.key==='pc_logout'&&privatePage)redirect();});
  document.addEventListener('DOMContentLoaded',()=>{
    if(!privatePage)return;
    const gate=document.createElement('section');gate.id='authGate';gate.setAttribute('role','status');
    const text=document.createElement('p');text.textContent=gateText;
    const retry=document.createElement('button');retry.textContent='Tentar novamente';retry.onclick=()=>location.reload();
    const login=document.createElement('a');login.href='/login.html';login.textContent='Ir para o login';
    gate.append(text,retry,login);document.body.append(gate);
  });
})();
