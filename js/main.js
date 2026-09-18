(function(){
  const PUBLIC_PAGES=['login.html','apresentacao.html',''];
  const pageName=()=>location.pathname.split('/').pop()||'index.html';
  const pageLabels={
    'index.html':'Painel','produtos.html':'Produtos','estoque.html':'Estoque','producao.html':'Produção',
    'planejamento.html':'Planejamento','historico-vendas.html':'Vendas','compradores.html':'Compradores',
    'calculadora-cpp.html':'Calculadora CPP','relatorio-cpp.html':'Relatório CPP','relatorios.html':'Relatórios',
    'metas.html':'Metas','equipe.html':'Equipe','configuracoes.html':'Configurações'
  };
  const roleLabels={admin:'Administrador',production:'Produção',commercial:'Comercial',viewer:'Visualizador'};

  document.addEventListener('DOMContentLoaded',async()=>{
    const page=pageName();
    if(!PUBLIC_PAGES.includes(page)&&!sessionStorage.getItem('pc_token')){location.href='login.html';return}
    try{
      if(!PUBLIC_PAGES.includes(page)) await setupShell(page);
      if(document.body.dataset.page==='dashboard') await renderDashboard(await getDashboardData());
      if(typeof renderDashboardControl==='function') renderDashboardControl();
      if(document.getElementById('productForm')&&typeof renderProductsPage==='function') renderProductsPage();
      if(document.getElementById('salesTable')&&typeof renderSales==='function') renderSales();
      if(document.getElementById('buyersTable')&&typeof renderBuyers==='function') renderBuyers();
      if(document.getElementById('cppTable')&&typeof renderCpp==='function') renderCpp(await getDashboardData());
      if(document.getElementById('stockTable')&&typeof renderStockPage==='function') renderStockPage();
      if(document.getElementById('productionTable')&&typeof renderProductionPage==='function') renderProductionPage();
      if(document.getElementById('planningTable')&&typeof renderPlanningPage==='function') renderPlanningPage();
      if(document.getElementById('goalsTable')&&typeof renderGoalsPage==='function') renderGoalsPage();
      if(document.getElementById('managementReport')&&typeof renderReportsPage==='function') renderReportsPage();
      if(document.getElementById('auditTable')&&typeof renderAuditPage==='function') renderAuditPage();
    }catch(err){
      const target=document.querySelector('.main')||document.body;
      target.insertAdjacentHTML('afterbegin',`<div class="notice warning-note app-error"><strong>Não foi possível carregar esta tela.</strong><br>${escapeHtml(err.message||'Erro inesperado.')}</div>`);
    }
  });

  async function setupShell(page){
    let user=null;
    try{
      const data=await getMe();
      user=data.user;
      sessionStorage.setItem('pc_user',JSON.stringify(user));
    }catch{
      try{user=JSON.parse(sessionStorage.getItem('pc_user')||'null')}catch{user=null}
    }
    if(!user) return;

    const company=user.companyName||'Minha empresa';
    const name=user.name||'Usuário';
    const role=user.role||'viewer';

    // Marca visualmente a página atual no menu.
    document.querySelectorAll('[data-nav]').forEach(a=>{
      const active=a.dataset.nav===page;
      a.classList.toggle('active',active);
      if(active) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });

    document.body.dataset.role=role;
    document.body.dataset.company=company;
    document.querySelectorAll('[data-nav]').forEach(a=>a.addEventListener('click',()=>{a.classList.add('nav-pulse');setTimeout(()=>a.classList.remove('nav-pulse'),280)}));

    // Oculta recursos administrativos para os demais perfis.
    document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',role!=='admin'));

    const brand=document.querySelector('.brand');
    if(brand&&!brand.querySelector('.company-name')){
      const wrap=document.createElement('div');
      wrap.className='company-name';
      wrap.innerHTML=`<strong>${escapeHtml(company)}</strong><small>${escapeHtml(name)} · ${escapeHtml(roleLabels[role]||role)}</small>`;
      brand.appendChild(wrap);
    }

    const top=document.querySelector('.topbar');
    if(top){
      // Breadcrumb para o usuário saber exatamente onde está.
      let crumb=top.querySelector('.app-breadcrumb');
      if(!crumb){
        crumb=document.createElement('div');
        crumb.className='app-breadcrumb';
        const first=top.firstElementChild;
        if(first) first.prepend(crumb); else top.prepend(crumb);
      }
      crumb.innerHTML=`<a href="index.html">Início</a><span>›</span><strong>${escapeHtml(pageLabels[page]||'Página')}</strong>`;

      let context=top.querySelector('.company-context');
      if(!context){
        context=document.createElement('div');
        context.className='company-context';
        top.appendChild(context);
      }
      context.innerHTML=`<span>EMPRESA</span><b>${escapeHtml(company)}</b>`;
    }

    const nav=document.querySelector('.sidebar nav');
    if(nav&&role==='admin'&&!nav.querySelector('[data-team-link]')){
      // A página de equipe já existe no menu, mas esta proteção evita duplicação em layouts antigos.
      const existing=nav.querySelector('a[href="equipe.html"]');
      if(existing) existing.dataset.teamLink='true';
    }

    const sidebar=document.querySelector('.sidebar');
    if(sidebar&&!document.querySelector('.mobile-menu-btn')){
      const btn=document.createElement('button');
      btn.className='mobile-menu-btn';
      btn.setAttribute('aria-label','Abrir menu');
      btn.setAttribute('aria-expanded','false');
      btn.innerHTML='☰';
      btn.onclick=()=>{
        const open=sidebar.classList.toggle('open');
        btn.setAttribute('aria-expanded',String(open));
        document.body.classList.toggle('menu-open',open);
      };
      document.body.appendChild(btn);

      const overlay=document.createElement('div');
      overlay.className='mobile-overlay';
      overlay.addEventListener('click',closeMenu);
      document.body.appendChild(overlay);
      sidebar.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
      function closeMenu(){sidebar.classList.remove('open');btn.setAttribute('aria-expanded','false');document.body.classList.remove('menu-open')}
    }
  }

})();
