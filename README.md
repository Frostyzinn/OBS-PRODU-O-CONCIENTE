# Produção Consciente — SaaS Profissional 3.3

Plataforma **multiempresa para gestão da produção de materiais de construção**. O sistema foi estruturado para uma operação real: cadastro por CNPJ, equipes e permissões, produtos, matérias-primas, estoque, ordens de produção, planejamento, vendas, compradores, CPP, metas, relatórios e auditoria.

## Visão do produto

```text
                    PRODUÇÃO CONSCIENTE
                           │
                 ┌─────────┴─────────┐
                 │     EMPRESA       │
                 │      CNPJ         │
                 └─────────┬─────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
    Pessoas            Operação           Inteligência
       │                   │                   │
  Admin/Produção      Produtos             CPP/MMS
  Comercial/Viewer    Estoque              Relatórios
                      Produção             Metas
                      Vendas               Indicadores
                      Planejamento
```

## Módulos

### 1. Multiempresa e governança
- Cadastro da empresa por CNPJ.
- CNPJ existente gera solicitação de entrada.
- Primeiro usuário da empresa é administrador.
- Aprovação manual de novos membros.
- Perfis: Administrador, Produção, Comercial e Visualizador.
- Isolamento de dados por `company_id` no backend.
- Auditoria de ações importantes.

### 2. Produtos
- Cadastro de produtos fabricados.
- Unidade de medida.
- Produção atual.
- Custo unitário.
- Composição por matérias-primas.
- Quantidade por produto e percentual de desperdício.

### 3. Estoque
- Cadastro de matérias-primas.
- Estoque atual e estoque mínimo.
- Custo unitário.
- Entradas e saídas.
- Histórico de movimentações.
- Alerta automático de reposição.

### 4. Ordens de produção
- Número automático de OP.
- Produto e quantidade planejada.
- Data planejada.
- Status: planejada, em produção, concluída ou cancelada.
- Registro da quantidade efetivamente produzida.
- Conclusão da OP atualiza a produção do produto.
- Rastreabilidade do usuário que abriu/movimentou a OP.

### 5. Planejamento
- Planejamento mensal por produto.
- Produção planejada.
- Meta de vendas.
- Prioridade.
- Status do plano.
- Integração conceitual com histórico de vendas e CPP.

### 6. Vendas e compradores
- Histórico mensal de vendas.
- Edição em lote.
- Importação CSV.
- Cadastro de compradores.
- Frequência e volume médio.

### 7. CPP / MMS
- Média Móvel Simples para previsão de demanda.
- Identificação de excedente.
- Estimativa financeira.
- Economia de energia e materiais quando informados.
- Relatórios históricos.

### 8. Metas
- Metas de produção.
- Metas de vendas.
- Metas de economia via CPP.
- Metas de redução de desperdício.
- Barra de progresso.

### 9. Relatórios
- Central de controle da empresa.
- Produtos e valor de produção.
- Estoque e itens abaixo do mínimo.
- Ordens abertas/concluídas.
- Produção planejada x realizada.
- Economia CPP recente.
- Progresso das metas.
- Auditoria administrativa.

## Arquitetura técnica

- Frontend: HTML5 + CSS + JavaScript vanilla.
- Backend: Node.js 18+ + Express.
- Banco: MySQL 8+.
- Driver: mysql2/promise.
- Autenticação: JWT.
- Senhas: bcryptjs.
- CORS e JSON.
- DBeaver: cliente recomendado para administração do banco.
- Sem framework ou build obrigatório no frontend.

## Banco de dados

Principais tabelas:

- `companies`
- `users`
- `company_join_requests`
- `products`
- `product_ingredients`
- `sales_histories`
- `buyers`
- `cpp_reports`
- `cpp_report_materials`
- `raw_materials`
- `stock_movements`
- `production_orders`
- `production_plans`
- `company_goals`
- `audit_logs`

O `db/database.js` cria automaticamente o banco e as novas tabelas. Para quem prefere executar pelo DBeaver, existe `db/schema.sql` e `db/migration_professional.sql`.

## Instalação

1. Instale Node.js 18+ e MySQL 8+.
2. Copie `.env.example` para `.env`.
3. Configure host, porta, usuário, senha e nome do banco.
4. Execute:

```bash
npm install
npm start
```

O endereço padrão é:

```text
http://localhost:3000
```

## Desenvolvimento

```bash
npm run dev
```

## Seed de demonstração

```bash
npm run seed
```

Credenciais demo:

```text
E-mail: demo@producao.com
Senha: 123456
CNPJ: 12.345.678/0001-95
```

## API principal

### Auth
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `PUT /api/v1/auth/me`
- `PUT /api/v1/auth/password`

### Empresa/equipe
- `GET/POST /api/v1/companies/lookup/:cnpj`
- `POST /api/v1/companies/register`
- `POST /api/v1/companies/join`
- `GET/PUT /api/v1/companies/me`
- `GET /api/v1/team`
- `GET /api/v1/team/requests`
- `PATCH /api/v1/team/requests/:id`
- `PATCH /api/v1/team/:id`
- `DELETE /api/v1/team/:id`

### Produção
- `GET/POST/PUT/DELETE /api/v1/products`
- `GET/POST/PUT/DELETE /api/v1/sales-histories`
- `POST /api/v1/sales-histories/import`
- `GET/POST/PUT/DELETE /api/v1/buyers`
- `GET/POST/PUT/DELETE /api/v1/stock`
- `POST /api/v1/stock/:id/movements`
- `GET /api/v1/stock/movements`
- `GET/POST /api/v1/production/orders`
- `PATCH/DELETE /api/v1/production/orders/:id`
- `GET /api/v1/production/summary`
- `GET/POST/PATCH/DELETE /api/v1/planning`
- `POST /api/v1/cpp/calculate`
- `GET /api/v1/cpp/reports`
- `GET /api/v1/reports/management`
- `GET /api/v1/reports/audit`
- `GET/POST/PATCH/DELETE /api/v1/goals`

## Segurança

- JWT com expiração.
- bcrypt para senhas.
- Autorização no backend por perfil.
- Validação da empresa em cada operação protegida.
- Todos os registros operacionais carregam `company_id`.
- FKs para preservar integridade referencial.
- Auditoria para rastrear ações.
- Frontend nunca é considerado uma camada de segurança.

## Evolução recomendada para produção comercial

Antes de colocar o SaaS em produção pública, adicionar:

1. HTTPS obrigatório.
2. Refresh token e revogação de sessões.
3. Rate limiting e proteção contra brute force.
4. Recuperação de senha por e-mail.
5. MFA opcional para administradores.
6. Backup automático do MySQL.
7. Logs centralizados e monitoramento.
8. Filas para tarefas pesadas/importações.
9. Testes automatizados de API e regras de tenant.
10. Política de privacidade, termos de uso e LGPD.
11. Billing/assinaturas caso o produto seja comercializado.
12. Deploy com ambiente separado para desenvolvimento, homologação e produção.

Esta versão já deixa a aplicação organizada para essas extensões sem tirar o foco do nicho de **produção de materiais de construção**.

## Versão 3.3 — interface viva + prata

- Paleta expandida com prata metálica, prata clara e grafite para superfícies e estados.
- Nova camada `css/motion.css` com entrada de páginas, microinterações, hover, brilho sutil da marca, status online, grid blueprint e respeito a `prefers-reduced-motion`.
- `js/motion.js` adiciona status operacional/horário e infraestrutura de feedback visual.
- Gráfico do painel ganhou animação de desenho.
- Logo oficial aplicada ao menu, login e apresentação.
- Preparação mantida para Vercel + MySQL externo.

A inspiração aqui é a abordagem de prototipação interativa usada por ferramentas como Claude Design: não é uma cópia do site, e sim a aplicação dos mesmos princípios de composição, movimento e feedback para o contexto de produção de materiais de construção.
