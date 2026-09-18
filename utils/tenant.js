const {run}=require('../db/database');
function companyId(req){if(!req.user?.companyId)throw Object.assign(new Error('Empresa não vinculada ao usuário'),{status:403});return req.user.companyId;}
async function audit(req,action,entity,entityId=null,metadata=null){try{await run('INSERT INTO audit_logs(company_id,user_id,action,entity,entity_id,metadata) VALUES(?,?,?,?,?,?)',[req.user?.companyId||null,req.user?.id||null,action,entity,entityId,metadata?JSON.stringify(metadata):null]);}catch(e){console.error('Falha no audit log:',e.message)}}
module.exports={companyId,audit};
