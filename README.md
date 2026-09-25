# NordcsCare

Sistema de gestão clínica multi-tenant (multi-clínica) para controle de pacientes, fila de atendimento, triagem, internações, agendamentos, prontuário eletrônico e relatórios.

## Stack

**Backend**
- PHP puro (sem framework), com roteador próprio ([api/routes/router.php](api/routes/router.php))
- Arquitetura em controllers ([api/controllers/](api/controllers/))
- MySQL via PDO ([api/config/database.php](api/config/database.php))
- Autenticação e permissões por tela via middleware ([api/middleware/](api/middleware/))
- Multi-tenant (clínicas) via middleware de tenant

**Frontend**
- React 19 + TypeScript
- Vite (build/dev server)
- React Router DOM (rotas)
- Axios (chamadas HTTP)
- Recharts (gráficos), React Grid Layout (dashboard configurável), jsPDF/html2canvas (exportação de PDF)

## Estrutura do projeto

```
NordcsCare/
├── api/                    # Backend PHP
│   ├── config/             # Configuração (env, database, S3, redcheck)
│   ├── controllers/        # Um controller por recurso (Paciente, Fila, Triagem, etc.)
│   ├── middleware/         # auth, rate_limit, tenant
│   ├── routes/router.php   # Definição de todas as rotas da API
│   ├── utils/              # Utilitários (ex: AuditLog)
│   ├── logs/                # Logs da aplicação
│   └── index.php           # Entry point da API
├── frontend/
│   └── src/pages/          # Páginas da aplicação (uma pasta por módulo)
├── deploy/                 # Scripts de deploy/infra (SSL, domínio, admin)
├── tests/                  # Scripts avulsos de teste/depuração
├── DB.sql                  # Schema principal do banco de dados
├── create_internacoes.sql  # Schema do módulo de internações
└── create_modelos.sql      # Schema de modelos de documentos
```

## Módulos / Telas

Autenticação, Home, Dashboard (com builder de widgets), Pacientes, Fila de Atendimento, Triagem, Prontuário, Internações (com controle de leitos), Agendamentos, Agenda de Escola, Especialidades, Médicos, Usuários, Clínicas (tenants), Permissões/Roles, Laudos Prontos, Modelos de Documentos, SpotVision (exames/OCR), Relatórios, Histórico de Atendimentos, Logs e Auditoria.

## Como rodar localmente

### Pré-requisitos
- XAMPP (Apache + MySQL) ou PHP 8+ com MySQL
- Node.js 18+

### Backend
1. Coloque o projeto na pasta `htdocs` do XAMPP (ex: `C:\xampp\htdocs\NordcsCare`).
2. Crie o banco de dados e importe os schemas:
   ```
   mysql -u root -p < DB.sql
   mysql -u root -p < create_internacoes.sql
   mysql -u root -p < create_modelos.sql
   ```
3. Crie um arquivo `.env` na raiz com as variáveis de ambiente (veja seção abaixo).
4. Inicie o Apache e o MySQL pelo painel do XAMPP.
5. A API ficará disponível em `http://localhost/NordcsCare/api/...`.

### Frontend
```bash
cd frontend
npm install
npm run dev
```
A aplicação abre por padrão em `http://localhost:5173`.

## Variáveis de ambiente

Configuradas em um arquivo `.env` na raiz (lido por [api/config/env.php](api/config/env.php)):

| Variável | Descrição | Padrão |
|---|---|---|
| `DB_HOST` | Host do MySQL | `localhost` |
| `DB_NAME` | Nome do banco | `nordcscare` |
| `DB_USER` | Usuário do banco | `root` |
| `DB_PASSWORD` | Senha do banco | *(vazio)* |
| `CORS_ORIGIN` | Origem(ns) permitida(s) para CORS, separadas por vírgula | `http://localhost:5173` |
| `FORCE_HTTPS` | Força redirecionamento para HTTPS em produção | `false` |

## API

Todas as rotas ficam sob o prefixo `/api`. Exemplos de recursos expostos:

- `POST /api/auth/login`, `/api/auth/me`, `/api/auth/switch-tenant`
- `GET/POST/PUT/DELETE /api/pacientes`
- `GET/POST/PUT/DELETE /api/fila` (fila de atendimento, com avançar, chamar, priorizar)
- `GET/POST/PUT/DELETE /api/triagem`
- `GET/POST/PUT/DELETE /api/internacoes` e `/api/leitos`
- `GET/POST/PUT/DELETE /api/agendamentos`
- `GET /api/dashboard/metricas`, `/api/dashboard-config`
- `GET/POST/PUT/DELETE /api/usuarios`, `/api/clinicas`, `/api/medicos`
- `GET/PUT /api/permissoes/*` (permissões por tela)
- `GET /api/historico`, `/api/audit`, `/api/logs/fila`

A lista completa de rotas está em [api/routes/router.php](api/routes/router.php).

## Segurança

- Headers de segurança (`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`) aplicados em toda resposta.
- CORS restrito às origens definidas em `CORS_ORIGIN`.
- Rate limiting no endpoint de login ([api/middleware/rate_limit.php](api/middleware/rate_limit.php)).
- Controle de acesso por tela/permissão via `Auth::requireTela()`.
- Log de auditoria de ações (`audit_log`) acessível em `/api/audit`.

## Licença

Projeto privado/interno — sem licença pública definida.
