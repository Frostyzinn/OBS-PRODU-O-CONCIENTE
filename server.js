require('dotenv').config();
const express=require('express');
const {installSecurity,rateLimit,validateBody}=require('./middleware/security');
const path=require('path');
const {initDatabase,close}=require('./db/database');

const app=express();
app.disable('x-powered-by');
installSecurity(app);
app.use(express.json({limit:'2mb'}));
app.get('/api/health',(req,res)=>res.status(200).json({ok:true,service:'Produção Consciente'}));
app.use('/api',validateBody);
app.use('/api/v1',rateLimit('api-ip',600,60));

const authRoutes=require('./routes/auth');
app.use('/api/v1/auth',authRoutes.router);
app.use('/api/v1/companies',require('./routes/companies'));
app.use('/api/v1/team',require('./routes/team'));
app.use('/api/v1/products',require('./routes/products'));
app.use('/api/v1/sales-histories',require('./routes/sales'));
app.use('/api/v1/buyers',require('./routes/buyers'));
app.use('/api/v1/cpp',require('./routes/cpp'));
app.use('/api/v1/stock',require('./routes/stock'));
app.use('/api/v1/production',require('./routes/production'));
app.use('/api/v1/planning',require('./routes/planning'));
app.use('/api/v1/goals',require('./routes/goals'));
app.use('/api/v1/reports',require('./routes/reports'));

app.get('/api/v1/health',async(req,res)=>{
  try{
    const db=require('./db/database');
    await db.get('SELECT 1 AS ok');
    res.json({ok:true,service:'Produção Consciente',database:'mysql',...(process.env.NODE_ENV!=='production'?{databaseName:db.DB_NAME}:{})});
  }catch(e){res.status(503).json({ok:false,error:'Banco de dados indisponível'})}
});

// Qualquer rota API desconhecida termina em JSON, inclusive POST/PUT/DELETE.
app.use('/api',(req,res)=>res.status(404).json({error:'Rota da API não encontrada'}));

// Somente recursos públicos: nunca servir código do servidor ou arquivos do banco.
for(const dir of ['css','js','assets']) app.use('/'+dir,express.static(path.join(__dirname,dir),{index:false,dotfiles:'deny'}));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/:page', (req,res,next)=>{
  const pages=['index','login','apresentacao','produtos','estoque','producao','planejamento','historico-vendas','compradores','calculadora-cpp','relatorio-cpp','relatorios','metas','equipe','configuracoes'];
  if(!pages.some(p=>req.params.page===p+'.html')) return next();
  res.sendFile(path.join(__dirname,req.params.page));
});
app.get('*',(req,res)=>{
  if(req.path.startsWith('/api/'))return res.status(404).json({error:'Rota não encontrada'});
  res.status(404).send('Página não encontrada.');
});

app.use((err,req,res,next)=>{
  console.error('Falha HTTP:',err.code||err.name||'Error');
  if(res.headersSent)return next(err);
  if(err.type==='entity.parse.failed')return res.status(400).json({error:'JSON inválido.'});
  if(err.type==='entity.too.large')return res.status(413).json({error:'Requisição muito grande.'});
  if(err.code==='ER_DUP_ENTRY')return res.status(409).json({error:'Já existe um registro com esses dados.'});
  if(['ER_ROW_IS_REFERENCED_2','ER_NO_REFERENCED_ROW_2'].includes(err.code))return res.status(409).json({error:'Este registro possui vínculos que impedem a operação.'});
  const status=Number.isInteger(err.status)&&err.status>=400&&err.status<500?err.status:500;
  res.status(status).json({error:status===500?'Erro interno do servidor':err.message});
});

async function start(){
  await initDatabase();
  const port=Number(process.env.PORT||3000);
  app.listen(port,()=>console.log(`Produção Consciente: http://localhost:${port}`));
}

if(require.main===module){
  start().catch(e=>{
    console.error('\nNão foi possível conectar ao MySQL.');
    console.error(e.message);
    console.error('Confira o arquivo .env e se o MySQL está iniciado.');
    process.exit(1);
  });
  process.on('SIGINT',async()=>{await close();process.exit(0)});
  process.on('SIGTERM',async()=>{await close();process.exit(0)});
}

module.exports=app;
