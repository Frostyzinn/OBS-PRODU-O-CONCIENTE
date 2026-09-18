# Deploy na Vercel

O projeto utiliza funções Express (`api/`) e um MySQL externo. Railway continua sendo a opção recomendada para manter aplicação e banco no mesmo projeto; veja HOSPEDAGEM.md.

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

APP_ORIGIN deve corresponder ao domínio usado pelos clientes, sem barra final. Cada ambiente de preview precisa de sua própria origem e banco. JWT_SECRET e CORS_ORIGIN não são mais usados.

O runtime pode utilizar uma credencial com SELECT, INSERT, UPDATE e DELETE somente no banco da aplicação. Não habilite MYSQL_MIGRATE_ON_START no serviço público. O proxy de confiança deve ser configurado segundo as redes documentadas pelo provedor; veja SEGURANCA.md.

O build configurado gera `public/`, sem arquivos internos. Os cabeçalhos em vercel.json protegem também os arquivos estáticos. Nunca desative a validação de certificados MySQL para fazer uma conexão funcionar.

Após publicar, confira `/api/v1/health`, o cadastro e o login. Verifique as flags Secure/HttpOnly/SameSite do cookie, a revogação ao sair, os limites de acesso e os backups. Essa etapa remota ainda não foi executada nesta revisão.
