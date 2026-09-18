# Deploy na Vercel

## 1. Banco MySQL
Crie um banco MySQL externo (a Vercel não fornece MySQL). O banco precisa estar acessível pela internet.

## 2. Variáveis de ambiente na Vercel
Em **Project Settings → Environment Variables**, configure:

```text
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_DATABASE=producao_consciente
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_AUTO_CREATE_DATABASE=false
MYSQL_SSL=false
MYSQL_SSL_REJECT_UNAUTHORIZED=true
JWT_SECRET=uma-chave-longa-e-aleatoria
CORS_ORIGIN=true
```

Se o provedor exigir SSL, use `MYSQL_SSL=true`. Em geral, mantenha `MYSQL_SSL_REJECT_UNAUTHORIZED=true`; só altere isso se o provedor documentar que o certificado não pode ser validado.

## 3. Deploy
Suba **todos os arquivos da pasta raiz** para o GitHub e importe o repositório na Vercel.

Não coloque o projeto dentro de uma subpasta no GitHub sem configurar o **Root Directory** corretamente.

## 4. O que foi corrigido nesta versão
- A API agora usa uma função catch-all `api/[...path].js`, evitando problemas de roteamento das rotas `/api/v1/*` na Vercel.
- O `vercel.json` não depende mais de rewrites para encaminhar a API.
- O banco não tenta criar o database quando `MYSQL_AUTO_CREATE_DATABASE=false`, evitando erro de permissão comum em MySQL gerenciado.
- A inicialização do banco é reaproveitada entre invocações serverless quando possível.
- Foi adicionado suporte opcional a SSL do MySQL.
- CSS, JS e imagens continuam sendo arquivos estáticos na raiz do projeto, portanto a Vercel os entrega diretamente.

## 5. Teste depois do deploy
Abra:

```text
https://SEU-PROJETO.vercel.app/api/v1/health
```

Resultado esperado:

```json
{"ok":true,"service":"Produção Consciente","database":"mysql",...}
```

Se retornar `503`, o problema está nas variáveis/acesso ao MySQL, e não no CSS.

Depois teste:

```text
https://SEU-PROJETO.vercel.app/login.html
```

Faça login. O sistema deve redirecionar para `index.html` e carregar os dados.
