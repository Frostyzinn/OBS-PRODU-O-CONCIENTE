require('dotenv').config();
const express=require('express');
const cors=require('cors');
const path=require('path');
const {initDatabase,close}=require('./db/database');

const app=express();
const corsOrigin=process.env.CORS_ORIGIN||true;
app.use(cors({origin:corsOrigin}));
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true}));

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
    res.json({ok:true,service:'Produção Consciente',database:'mysql',databaseName:db.DB_NAME});
  }catch(e){res.status(503).json({ok:false,error:'Banco de dados indisponível'})}
});

app.use(express.static(path.join(__dirname)));
app.get('*',(req,res)=>{
  if(req.path.startsWith('/api/'))return res.status(404).json({error:'Rota não encontrada'});
  res.sendFile(path.join(__dirname,'login.html'));
});

app.use((err,req,res,next)=>{
  console.error(err);
  if(res.headersSent)return next(err);
  const status=err.status||500;
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
