# Autenticação, Vercel e Node 24

## Causas identificadas

As páginas estáticas privadas eram exibidas antes da consulta de sessão em main.js. Alguns módulos iniciavam consultas em paralelo. O login redirecionava sem confirmar a sessão recém-criada.

O entrypoint api/index.js inicializava o MySQL antes de verificar credenciais de GET /api/v1/auth/me. Uma falha de conexão ou de tabelas necessárias podia retornar 503 mesmo sem autenticação. O limitador global também consultava o banco antes dessa verificação.

A rota /api/v1/auth/me já existe no código atual: server.js monta routes/auth.js em /api/v1/auth; o router define GET /me com middleware auth. Não foi reproduzido o antigo 404: o entrypoint atual passou nos testes. Não é possível atribuir a causa histórica do 404 nem identificar a falha específica da Railway sem consultar o deploy e seus logs.

## Fluxo final

1. As 13 páginas privadas começam bloqueadas por CSS, com estado neutro.
2. js/session.js consulta /api/v1/auth/me com o cookie HttpOnly já usado pelo projeto. Dados privados aguardam essa mesma promessa.
3. HTTP 200 com usuário libera a interface. HTTP 401/403 de /me limpa pc_user/pc_token e redireciona com replace para /login.html.
4. HTTP 500/503 ou falha de rede mantém a interface bloqueada, com mensagem e opção de tentar novamente. Não há redirecionamento em loop por indisponibilidade.
5. Login/cadastro bem-sucedido confirma /me antes de abrir index.html.
6. Logout revoga a sessão no servidor, limpa o cache e comunica outras abas. Ao restaurar uma página do histórico, a sessão é revalidada.

O navegador continua usando sessão opaca em cookie HttpOnly (Secure em produção), sem gravar JWT em armazenamento acessível ao JavaScript. pc_user é cache visual, nunca autorização. A API preserva JWT Bearer com assinatura, expiração e vínculo à sessão revogável. JWT é emitido no login quando solicitado authMode=bearer; esse modo foi testado. Não foi substituída a estratégia segura de autenticação existente.

Os HTMLs continuam sendo arquivos estáticos públicos sem dados privados embutidos. O bloqueio visual não substitui a segurança: as rotas de dados continuam protegidas no backend, inclusive contra acesso direto.

## Arquivos alterados

| Arquivos | Alteração |
| --- | --- |
| js/session.js (novo), css/session.css (novo) | Guard central, espera, validação, erros, logout e histórico |
| index.html, produtos.html, historico-vendas.html, relatorio-cpp.html, compradores.html, calculadora-cpp.html, configuracoes.html, equipe.html, estoque.html, producao.html, planejamento.html, metas.html, relatorios.html | Marcação privada e carregamento do guard no head |
| login.html | Carregamento do módulo central de sessão |
| js/auth.js | Confirmação de sessão após login/cadastro |
| js/data.js | Espera pela validação e preservação de status/code dos erros |
| js/utils.js | Logout delegado ao módulo central |
| middleware/auth.js | Exportação da validação de credenciais existente para reutilização |
| server.js | /me sem credenciais válidas retorna 401 antes do banco; falhas conhecidas de conexão retornam 503 |
| api/index.js | Pré-verificação de /me sem banco; diagnóstico com método/caminho/código, sem segredos |
| db/database.js | Reutilização do pool ao tentar novamente após falha |
| package.json, package-lock.json | Node 24.x; script test:session no package.json |
| README.md, DEPLOY_VERCEL.md | Documentação da versão 24.x |
| scripts/routing-test.cjs | Verifica ausência de inicialização de banco para /me sem credenciais |
| scripts/session-test.cjs (novo) | Testes de bloqueio, erros, histórico, cache e marcação das páginas |
| scripts/unavailable-test.cjs (novo) | Teste de indisponibilidade simulada sem conexão real ao banco |
| RELATORIO_AUTENTICACAO.md (novo) | Este relatório |

## Vercel

vercel.json foi revisado e preservado: framework null (Other), build npm run build, outputDirectory public, função api/index.js e rewrite /api/:path* para /api/index. CSS, JS, assets e HTML permanecem estáticos. Não há fallback HTML capturando a API. O handler exportado chama o Express sem app.listen; o servidor local usa listen apenas quando server.js é executado diretamente.

scripts/build.cjs já copia os arquivos do frontend e não publica backend/credenciais. Não precisou de alteração.

## Validação realizada

Node utilizado: v24.21.0, npm 11.19.0, distribuição oficial portátil. O Node global do computador permanece v22.15.1; selecione/instale Node 24 no seu terminal para reproduzir a execução. engines.node está fixado em 24.x. Não foram encontradas outras versões fixadas em .nvmrc, .node-version, Dockerfile ou workflows.

- npm install com engine-strict: sucesso, 97 pacotes auditados, zero vulnerabilidades reportadas. Nenhuma dependência atualizada/removida; lockfile mudou apenas engines.node. Nenhuma incompatibilidade encontrada nos testes executados.
- npm run build: sucesso.
- npm run test:routing: 18 requisições HTTP passaram pelo entrypoint serverless.
- npm run test:security: 71 verificações passaram.
- npm run test:security:config: 9 verificações passaram.
- npm run test:integration: 47 verificações passaram contra servidor Node 24 local.
- npm run test:session: 6 testes passaram.
- node scripts/unavailable-test.cjs: 4 verificações passaram.
- git diff --check: passou. Avisos de LF/CRLF do Git são de fim de linha, não incompatibilidades do Node.

Endpoints: GET /api/health 200 JSON; GET /api/v1/auth/me sem autenticação, JWT inválido/expirado ou sessão revogada 401 JSON; JWT e cookie válidos 200 JSON; POST /api/v1/auth/login 200; POST /api/v1/auth/logout 204; API inexistente GET/POST 404 JSON; CSS/JS/assets/HTML 200. Com banco indisponível simulado: health 200, /me sem credenciais/inválidas 401, /me que exige consulta de sessão 503 JSON.

No navegador local: /, /produtos.html e /estoque.html sem sessão redirecionaram para login; login válido abriu painel; atualização manteve a sessão; logout e nova tentativa de Produtos voltaram ao login; voltar pelo histórico permaneceu no login. Expiração/revogação foi coberta pelos testes de API e o comportamento de 401/403 pelo teste do guard.

Utilizado somente o banco de testes já existente, com MYSQL_AUTO_CREATE_DATABASE=false. Não foi criado outro banco. Credenciais, cores e funcionalidades foram preservadas. Não foi realizado deploy, commit ou push.

## Variáveis de ambiente

Não há .env neste checkout nem variáveis MySQL/JWT/CORS herdadas no processo padrão. Os testes usam configuração local temporária; JWT_SECRET de teste é aleatório e não foi gravado.

Não foi possível verificar quais variáveis faltam na Vercel. Confira os nomes MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_POOL_SIZE, JWT_SECRET, CORS_ORIGIN, MYSQL_SSL, MYSQL_SSL_REJECT_UNAUTHORIZED. APP_ORIGIN também é aceito para definir a origem. Preserve os valores reais e use MYSQL_AUTO_CREATE_DATABASE=false em produção. Não habilite migrações no serviço público para mascarar falhas: caso os logs indiquem ER_NO_SUCH_TABLE, é necessário verificar o esquema do banco existente. ECONNREFUSED/ETIMEDOUT indicam problemas de conexão; ER_ACCESS_DENIED_ERROR exige conferir configuração de acesso. Os logs novos registram códigos, sem credenciais.

## Versionar

A branch existente é master, não mestre. Execute no diretório do projeto:

```powershell
git status
git add .
git diff --cached --stat
git commit -m "fix: corrige autenticação e roteamento da API"
git pull --rebase origin master
git push origin master
```

Confira o conteúdo preparado antes do commit e não inclua .env. Após o push/deploy, repita health e /me no domínio real: os testes locais simulam o encaminhamento da Vercel, mas não validam a configuração remota nem a conexão da Vercel com a Railway.
