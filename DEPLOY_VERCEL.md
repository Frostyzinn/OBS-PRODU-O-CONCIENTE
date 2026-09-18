# Deploy na Vercel

## Correção do erro de ponto de entrada

O `vercel.json` define explicitamente `"framework": null` (preset **Other**). Isso desativa a detecção automática de Express, que procurava um ponto de entrada do servidor dentro de `public/`. Essa pasta contém somente o frontend; as funções permanecem em `api/` na raiz.

Configuração de build:

- Framework Preset: **Other** (definido pelo arquivo).
- Build Command: `npm run build`.
- Output Directory: `public`.
- Root Directory: a pasta que contém `package.json`, `vercel.json` e `api/`.
- Node.js: **22.x**, fixado no `package.json`.

Envie os arquivos corrigidos, incluindo `package-lock.json`, para a branch conectada à Vercel e faça um novo deploy. Na primeira tentativa, desmarque a reutilização do cache de build. Não mova o backend para `public/` nem altere as variáveis de ambiente para resolver esse erro. Se o log continuar identificando o preset Express, confira se o deploy está usando o commit e o Root Directory corretos.

O build local não conecta ao MySQL. A validação de banco e sessões ocorre quando a API é executada, separadamente do build.

Referência: https://vercel.com/docs/project-configuration/vercel-json#framework

## Configuração de execução (após o build)

O projeto utiliza uma função Express (`api/index.js`) e um MySQL externo. Railway continua sendo a opção recomendada para manter aplicação e banco no mesmo projeto; veja HOSPEDAGEM.md.

1. Envie o código ao repositório, excluindo `.env`, `node_modules/` e dados locais.
2. Crie o banco MySQL com TLS ou rede privada adequada ao provedor.
3. Execute `npm run db:init` contra esse banco usando uma credencial de migração. O comando cria as tabelas operacionais, sessões e limites de requisição.
4. Configure no projeto Vercel:

```text
NODE_ENV=production
APP_ORIGIN=https://seu-dominio.com
MYSQL_HOST=host-do-banco
MYSQL_PORT=3306
MYSQL_DATABASE=nome-do-banco
MYSQL_USER=usuario-da-aplicacao
MYSQL_PASSWORD=senha-exclusiva
MYSQL_POOL_SIZE=3
MYSQL_AUTO_CREATE_DATABASE=false
MYSQL_SSL=true
MYSQL_SSL_REJECT_UNAUTHORIZED=true
```

APP_ORIGIN deve corresponder ao domínio usado pelos clientes, sem barra final. Cada ambiente de preview precisa de sua própria origem e banco. JWT_SECRET habilita a emissão opcional de JWT Bearer (mínimo 32 bytes). CORS_ORIGIN aceita uma origem HTTPS exata como alternativa a APP_ORIGIN; true e * não liberam acesso indiscriminado. Na Vercel, VERCEL_URL é usado como fallback quando nenhuma origem explícita foi informada.

O runtime pode utilizar uma credencial com SELECT, INSERT, UPDATE e DELETE somente no banco da aplicação. Não habilite MYSQL_MIGRATE_ON_START no serviço público. O proxy de confiança deve ser configurado segundo as redes documentadas pelo provedor; veja SEGURANCA.md.

O build configurado gera `public/`, sem arquivos internos. Os cabeçalhos em vercel.json protegem também os arquivos estáticos. Nunca desative a validação de certificados MySQL para fazer uma conexão funcionar.

Após publicar, confira `/api/v1/health`, o cadastro e o login. Verifique as flags Secure/HttpOnly/SameSite do cookie, a revogação ao sair, os limites de acesso e os backups. Essa etapa remota ainda não foi executada nesta revisão.

## Roteamento explícito da API

A configuração usa uma única entrada, sem depender de nomes de arquivo catch-all:

```json
"rewrites": [{ "source": "/api/:path*", "destination": "/api/index" }]
```

A regra alcança somente /api e seus subcaminhos. CSS, JS, assets e HTML continuam servidos de public/. O Express recebe a URL original: /api/v1/auth/me é atendido pelo mount /api/v1/auth e router.get('/me'). Rotas API desconhecidas retornam JSON 404 para todos os métodos; nunca recebem HTML.

- GET /api/health: liveness HTTP, JSON 200 sem depender do banco.
- GET /api/v1/health: readiness, verifica a conexão MySQL (200 ou 503).
- GET /api/v1/auth/me: JSON 401 sem credenciais/inválidas; JSON 200 com sessão válida.

O frontend atual usa cookies HttpOnly. Para clientes Bearer, envie authMode: "bearer" no JSON do POST /api/v1/auth/login junto de email/password e do header X-PC-Request: 1. Com JWT_SECRET configurado, a resposta inclui token; use Authorization: Bearer TOKEN nas chamadas seguintes. Não existe segredo padrão no código. Os JWTs duram 15 minutos e são vinculados a sessões revogáveis; tokens de versões antigas exigem novo login. A sessão de cookie continua funcionando sem JWT_SECRET.

Não é necessário mudar credenciais MySQL para corrigir roteamento. Se a API responder 503 após o deploy, a função já foi alcançada: verifique separadamente conectividade e migrações, incluindo user_sessions e security_rate_limits. Não confunda essa falha de execução com 404 de encaminhamento.

Teste local: npm run build e npm run test:routing. A suíte usa apenas pc_revisao_20260918, gera segredos efêmeros em memória e remove o usuário/empresa sintéticos ao finalizar. Ela simula a seleção da função pela regra da Vercel; a infraestrutura remota deve ser confirmada após publicar.
