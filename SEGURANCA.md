# Segurança — Produção Consciente

## Proteções implementadas

- Sessões opacas de 256 bits geradas com `crypto.randomBytes`. Somente o hash SHA-256 fica no MySQL. Na navegação web, o identificador não é devolvido no JSON nem armazenado em localStorage/sessionStorage. Clientes que solicitam authMode=bearer recebem um JWT HS256 de 15 minutos, com issuer/audience e vínculo à sessão revogável, assinado exclusivamente por JWT_SECRET do ambiente.
- Cookie HttpOnly e SameSite=Strict. Em produção, Secure e prefixo `__Host-`, sem Domain e com Path=/.
- Expiração imposta pelo servidor: 30 minutos de inatividade e 8 horas absolutas. Logout revoga a sessão; alteração de senha revoga todas. Mudança de perfil/bloqueio revoga as sessões do usuário afetado.
- Consulta do perfil, vínculo e status da empresa no servidor em cada requisição autenticada.
- Proteção contra CSRF por origem exata, Fetch Metadata, JSON e cabeçalho customizado nas operações de escrita. A API exige origem exata, configurada em APP_ORIGIN ou CORS_ORIGIN; valores amplos não liberam terceiros.
- Limites compartilhados no MySQL: 600 requisições/minuto por IP na API; login 30/15 minutos por IP e 10/15 minutos por e-mail; cadastro/solicitação 5/hora por IP; consulta CNPJ 30/15 minutos; alterações de conta 12/15 minutos por usuário. Valores de IP/e-mail são transformados em hash para os contadores.
- Helmet: CSP restringe scripts à própria origem e bloqueia scripts inline, objetos, enquadramento e bases externas; proteção contra MIME sniffing e política sem referer. Estilos inline continuam permitidos para os indicadores dinâmicos.
- HTTPS/HSTS e cookies Secure no ambiente de produção; APP_ORIGIN obrigatório com HTTPS. O TLS deve ser terminado/configurado no provedor.
- SQL parametrizado, validação de números, datas, períodos, tamanhos e estrutura de JSON; composição de produto confere que o insumo pertence à empresa.
- Arquivos internos fora da publicação estática, API com Cache-Control: no-store, mensagens sem SQL/stack trace ou dados de infraestrutura em produção.
- Senhas novas com mínimo de 12 caracteres, máximo de 72 bytes (limite do bcrypt), hash bcrypt com custo 12. Senhas antigas continuam aceitas para não bloquear contas existentes; altere-as antes do uso real. Não reutilize o usuário de demonstração em produção.
- Alteração de e-mail exige senha atual. Alterações administrativas concorrentes são serializadas para preservar ao menos um administrador ativo.
- Exportação CSV neutraliza valores que poderiam ser interpretados como fórmulas.
- Produção não executa as migrações de schema automaticamente. `npm run db:init` deve ser executado na implantação com credencial própria; a credencial do serviço pode ficar restrita a SELECT/INSERT/UPDATE/DELETE no banco da aplicação.

## Publicação

1. Configure NODE_ENV=production, APP_ORIGIN com a URL HTTPS exata, MYSQL_AUTO_CREATE_DATABASE=false e credenciais exclusivas da aplicação.
2. Execute `npm run db:init` com usuário de migração, depois inicie com usuário de execução restrito ao banco.
3. Para MySQL em rede pública, habilite TLS (`MYSQL_SSL=true`) com validação de certificado. O processo recusa desligar essa validação em produção. Use rede privada quando oferecida pelo provedor.
4. Configure TRUST_PROXY apenas com IPs/redes confiáveis documentados pelo provedor. Sem configuração, a aplicação não confia em cabeçalhos de IP e os clientes atrás do mesmo proxy compartilham o limite. Isso precisa ser verificado na hospedagem escolhida.
5. Configure backups automáticos, teste restauração, ative MFA nas contas de hospedagem/GitHub e monitore falhas e alertas. Não publique `.env`, banco local, senhas nem dados de demonstração.
6. Rode os testes em homologação e confirme cookies Secure, headers, isolamento e rate limiting no domínio final. Não rode o script de segurança contra dados reais.

## Verificação e limites

`npm run test:security` usa somente `pc_revisao_20260918`, cria empresas e usuários sintéticos e remove os próprios dados ao concluir. Cobre cookies, CSRF, entradas inválidas, perfis, isolamento entre empresas, revogação, expiração e limites de login. `npm run test:integration` requer a prévia na porta 3001 e verifica os fluxos operacionais no mesmo banco isolado.

A auditoria npm encontrou zero vulnerabilidades conhecidas no momento da revisão. Isso não é certificação nem garantia de ausência de falhas. MFA dentro da aplicação, validação de titularidade de CNPJ/e-mail, recuperação de senha e uma auditoria independente ainda não foram implementados. O cadastro inicial atribui o CNPJ ao primeiro usuário; é necessário validar essa titularidade antes de operar um SaaS público com dados reais. Proteção contra DDoS em grande escala e disponibilidade dependem também da hospedagem/WAF.

Referências:
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- https://expressjs.com/en/advanced/best-practice-security/
