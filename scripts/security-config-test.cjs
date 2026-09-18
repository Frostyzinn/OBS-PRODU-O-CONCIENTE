// Valida a configuração de produção sem conectar a um banco real.
process.env.NODE_ENV='production';process.env.APP_ORIGIN='https://producao.example';process.env.MYSQL_AUTO_CREATE_DATABASE='false';
const assert=require('node:assert/strict');
const express=require('express');
const db=require('../db/database');
db.transaction=async fn=>fn({get:async()=>({password_hash:'test-hash',status:'active'}),run:async()=>({changes:1})});
const {issueSession}=require('../middleware/auth');
const {installSecurity}=require('../middleware/security');
(async()=>{
 let saved;
 await issueSession({headers:{}},{cookie:(name,value,options)=>{saved={name,value,options}}},1,'test-hash');
 assert.equal(saved.name,'__Host-pc_session');assert.match(saved.value,/^[a-f0-9]{64}$/);assert.equal(saved.options.secure,true);assert.equal(saved.options.httpOnly,true);assert.equal(saved.options.sameSite,'strict');assert.equal(saved.options.path,'/');assert.equal(saved.options.domain,undefined);
 installSecurity(express());
 process.env.APP_ORIGIN='http://insecure.example';assert.throws(()=>installSecurity(express()),/HTTPS/);
 process.env.APP_ORIGIN='https://producao.example';process.env.MYSQL_SSL='true';process.env.MYSQL_SSL_REJECT_UNAUTHORIZED='false';assert.throws(()=>installSecurity(express()),/certificado/);
 console.log('9 verificações de configuração de produção passaram.');
})().catch(error=>{console.error(error);process.exitCode=1});
