const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/session.js'),'utf8');
function setup(status){
  const root={dataset:{auth:'checking'},hasAttribute:()=>true};
  const values=new Map([['pc_user','stale'],['pc_token','legacy']]);
  const events={};let destination;let calls=0;
  const context={document:{documentElement:root,readyState:'loading',addEventListener(){}},
    sessionStorage:{removeItem:k=>values.delete(k),setItem:(k,v)=>values.set(k,v)},
    location:{replace:v=>destination=v},AbortSignal,
    fetch:async()=>{calls++;return {ok:status===200,status,json:async()=>status===200?{user:{id:1}}:{error:'Falha',code:'TEST'}}},
    addEventListener:(name,fn)=>events[name]=fn};
  context.window=context;vm.runInNewContext(source,context);
  return {context,root,values,events,destination:()=>destination,calls:()=>calls};
}
for(const status of [401,403])test(`HTTP ${status}: limpa cache e redireciona sem liberar interface`,async()=>{
  const s=setup(status);await assert.rejects(s.context.pcSession.ready);
  assert.equal(s.root.dataset.auth,'checking');assert.equal(s.destination(),'/login.html');assert.equal(s.values.size,0);
});
for(const status of [500,503])test(`HTTP ${status}: mantém bloqueio sem loop de login`,async()=>{
  const s=setup(status);await assert.rejects(s.context.pcSession.ready);assert.equal(s.root.dataset.auth,'checking');assert.equal(s.destination(),undefined);
});
test('Sessão confirmada libera interface; restauração de histórico revalida',async()=>{
  const s=setup(200);assert.equal(s.root.dataset.auth,'checking');await s.context.pcSession.ready;
  assert.equal(s.root.dataset.auth,'ready');await s.context.pcSession.ready;assert.equal(s.calls(),1);
  s.events.pagehide();assert.equal(s.root.dataset.auth,'checking');s.events.pageshow({persisted:true});await s.context.pcSession.ready;assert.equal(s.calls(),2);
  s.events.storage({key:'pc_logout'});assert.equal(s.destination(),'/login.html');assert.equal(s.values.size,0);
});
test('Todos os documentos privados têm bloqueio antes do conteúdo',()=>{
  for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html')&&!['login.html','apresentacao.html'].includes(f))){
    const html=fs.readFileSync(file,'utf8');assert.match(html,/<html[^>]+data-private/);
    assert.ok(html.indexOf('/css/session.css')<html.indexOf('<body'));assert.ok(html.indexOf('/js/session.js')<html.indexOf('<body'));
  }
});
