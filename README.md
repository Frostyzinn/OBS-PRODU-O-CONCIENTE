# Produção Consciente

Sistema multiempresa para gestão de produtos, matérias-primas, estoque, produção, planejamento, vendas, compradores, CPP, metas, equipe e relatórios.

Interface HTML/CSS/JavaScript com a paleta original azul blueprint + prata. Backend Node.js 24.x / Express e MySQL 8+. Sessões revogáveis em cookies HttpOnly; autorização e isolamento por empresa no servidor.

## Desenvolvimento

1. Copie `.env.example` para `.env` e configure o MySQL.
2. Execute `npm ci` e `npm start`.
3. Abra http://localhost:3000/login.html.

O modo de desenvolvimento cria/migra o schema. Em produção, execute `npm run db:init` antes de iniciar, com credencial de migração separada.

## Demonstração e testes

`npm run seed` cria dados fictícios, somente fora do ambiente de produção. A conta de demonstração é `demo@producao.com` / `123456`; não deve ser usada na operação real.

A prévia desta revisão usa o banco isolado `pc_revisao_20260918` e http://localhost:3001.

- `npm run build`: prepara somente arquivos públicos em `public/` para Vercel.
- `npm run test:integration`: testa fluxos operacionais com a prévia ativa na porta 3001.
- `npm run test:security`: testa segurança no banco isolado, usando um servidor temporário.
- `npm run test:routing`: verifica a entrada serverless, JWT, cookies e arquivos estáticos no banco isolado.
- `npm audit`: consulta vulnerabilidades conhecidas das dependências.

Consulte [HOSPEDAGEM.md](HOSPEDAGEM.md), [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) e [SEGURANCA.md](SEGURANCA.md) para configuração, proteções implementadas e limites atuais.
