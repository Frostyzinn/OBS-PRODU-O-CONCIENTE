# Hospedagem e execução — Produção Consciente

## Recomendação: Railway

Este projeto precisa de um servidor Node.js/Express e de MySQL. Minha recomendação é Railway pela possibilidade de manter os dois serviços no mesmo projeto.

1. Coloque o projeto em um repositório privado no GitHub (não envie `.env` ou `node_modules`).
2. Crie um projeto no Railway e adicione um serviço MySQL.
3. Adicione a aplicação a partir do repositório. Use `npm ci` para instalar e `npm start` para iniciar.
4. Configure as variáveis do serviço da aplicação:

| Variável da aplicação | Valor |
| --- | --- |
| NODE_ENV | production |
| MYSQL_HOST | host do serviço MySQL |
| MYSQL_PORT | porta do serviço MySQL |
| MYSQL_USER | usuário do serviço MySQL |
| MYSQL_PASSWORD | senha do serviço MySQL |
| MYSQL_DATABASE | banco do serviço MySQL |
| MYSQL_AUTO_CREATE_DATABASE | false |
| MYSQL_POOL_SIZE | 5 |
| APP_ORIGIN | URL HTTPS final do site, sem barra final |

Use referências às variáveis do MySQL no painel do Railway. Os nomes fornecidos pelo provedor podem ser diferentes dos nomes `MYSQL_*` esperados por esta aplicação. O servidor usa a variável PORT fornecida pela hospedagem.

Antes de iniciar em produção, execute `npm run db:init` com uma credencial de migração. No serviço público use uma credencial restrita a SELECT, INSERT, UPDATE e DELETE no banco. A autenticação usa sessões HttpOnly; JWT_SECRET é opcional para clientes JWT Bearer. CORS_ORIGIN aceita origem exata como alternativa a APP_ORIGIN; consulte DEPLOY_VERCEL.md. Consulte SEGURANCA.md para configurar o proxy, os limites de acesso e os requisitos de publicação.

5. Gere um domínio público para a aplicação e confira `/api/v1/health`.
6. Abra `/login.html`, use “Cadastrar acesso” e crie sua empresa.
7. Configure backups do banco. Não execute o seed de demonstração na produção.

Se a conexão oferecida pelo seu provedor usa TLS, configure `MYSQL_SSL=true`, mantenha `MYSQL_SSL_REJECT_UNAUTHORIZED=true` e siga os requisitos de certificado do provedor. Não desligue a verificação para contornar erros.

Documentação: https://docs.railway.com/quick-start e https://docs.railway.com/databases/mysql

## Alternativa: Render

Crie um Web Service Node com `npm ci` / `npm start` e configure as mesmas variáveis. O MySQL precisa estar em um serviço separado; pode ser externo ou uma instalação com disco persistente no Render. É uma alternativa válida, com mais configuração para o banco.

https://render.com/docs/deploy-node-express-app
https://render.com/docs/deploy-mysql

## Vercel

É possível usar as funções Express já presentes no projeto, com MySQL externo. O comando `npm run build` prepara somente HTML, CSS, JavaScript de navegador e imagens em `public/`, evitando publicar os arquivos internos como recursos estáticos. Configure as variáveis de ambiente, `MYSQL_AUTO_CREATE_DATABASE=false` e um pool pequeno (por exemplo, 3). A conexão precisa estar acessível a partir das funções.

https://vercel.com/docs/frameworks/backend/express

Railway é a recomendação para esta estrutura, por reunir a aplicação e o banco sem adaptar o funcionamento a funções serverless. Consulte os preços atuais antes de contratar; este guia não pressupõe hospedagem gratuita permanente.

## Rodar no computador

Copie `.env.example` para `.env`, configure o MySQL, instale com `npm ci` e execute `npm start`. O endereço padrão é http://localhost:3000.

Foi criado um banco local separado, `pc_revisao_20260918`, para validação desta revisão. A prévia usa a porta 3001 e esse banco. Acesso de demonstração: `demo@producao.com` / `123456`. Os dados são fictícios.

Para reiniciar a prévia em PowerShell:

```powershell
$env:MYSQL_DATABASE='pc_revisao_20260918'
$env:PORT='3001'
node server.js
```

## Verificação realizada

47 verificações HTTP passaram, incluindo carregamento dos módulos, autenticação, bloqueio de arquivos internos, consumo de matéria-prima, conclusão simultânea de uma mesma ordem, reversão por estoque insuficiente e entradas simultâneas de estoque. Execute `node scripts/verify.cjs` com a prévia ativa para repetir. O script recusa alterar outro banco.

A interface foi conferida no navegador com dados de demonstração. A publicação e a conexão com um banco remoto ainda precisam ser verificadas no provedor escolhido.
