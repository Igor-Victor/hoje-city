# Hoje.city

> Curadoria de eventos culturais urbanos. MVP: Belo Horizonte.
> "O que rola hoje na sua cidade — em 30 segundos, sem garimpar."

---

## Pré-requisitos

- **Node.js** 20+
- **PostgreSQL** 15+ (local ou Docker)
- **npm** 9+
- Docker + Docker Compose (opcional, mas recomendado)

---

## Setup local (sem Docker)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com seus valores. As variáveis obrigatórias são:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `JWT_SECRET` | Segredo JWT — mínimo 32 chars (gere com `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | Expiração do access token (ex: `1h`) |
| `JWT_REFRESH_EXPIRES_IN` | Expiração do refresh token (ex: `7d`) |
| `NODE_ENV` | `development` ou `production` |
| `PORT` | Porta HTTP (default: `3000`) |
| `SMTP_HOST` | Host SMTP (ex: `smtp.resend.com`) |
| `SMTP_PORT` | Porta SMTP (ex: `465`) |
| `SMTP_SECURE` | `true` ou `false` |
| `SMTP_USER` | Usuário SMTP |
| `SMTP_PASS` | Senha SMTP |
| `EMAIL_FROM` | Remetente (ex: `Hoje.city <ola@hoje.city>`) |
| `COOKIE_SECURE` | `true` em produção (força cookies Secure) |

### 3. Criar e migrar o banco de dados

```bash
npx prisma migrate dev --name init
```

### 4. Popular com dados de exemplo

```bash
npm run seed
```

Popula o banco com a curadoria de 29/03/2026 — 9 eventos em BH.

### 5. Criar o primeiro admin

```bash
npm run create-admin admin@seudominio.com SenhaSegura123!
```

### 6. Iniciar em desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)
Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Setup com Docker

```bash
# 1. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com seus valores (especialmente JWT_SECRET)

# 2. Subir tudo
docker-compose up --build

# 3. (primeira vez) Seed de dados
docker-compose exec app npm run seed

# 4. Criar admin
docker-compose exec app npm run create-admin admin@hoje.city SenhaSegura123!
```

A aplicação estará disponível em [http://localhost:3000](http://localhost:3000).

---

## Scripts disponíveis

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot-reload |
| `npm run build` | Compilar TypeScript para `dist/` |
| `npm run start` | Iniciar servidor de produção (requer build) |
| `npm run seed` | Popular banco com eventos de exemplo |
| `npm run create-admin <email> <senha>` | Criar usuário administrador |
| `npm run db:migrate` | Criar/aplicar migrations do Prisma |
| `npm run db:generate` | Gerar Prisma Client após alterar schema |
| `npm run db:studio` | Abrir Prisma Studio (GUI do banco) |
| `npm audit` | Verificar vulnerabilidades nas dependências |

---

## Estrutura do projeto

```
hoje-city/
├── .env.example          # Template de variáveis de ambiente
├── docker-compose.yml    # PostgreSQL + app em container
├── Dockerfile            # Imagem de produção multi-stage
├── prisma/
│   ├── schema.prisma     # Modelos: Event, Subscriber, Admin, RefreshToken
│   └── seed.ts           # Curadoria de 29/03/2026 (9 eventos BH)
├── scripts/
│   └── create-admin.ts   # CLI para criar admin
├── src/
│   ├── index.ts          # Entry point + Express app
│   ├── config.ts         # Validação de env vars via Zod
│   ├── db.ts             # Prisma Client singleton
│   ├── logger.ts         # Pino logger com redação de dados sensíveis
│   ├── middleware/
│   │   ├── auth.ts       # JWT verification + requireAuth
│   │   ├── rateLimit.ts  # Rate limiting por rota
│   │   └── validate.ts   # Zod schema validation helpers
│   ├── routes/
│   │   ├── public.ts     # GET /, POST /subscribe, /api/events
│   │   └── admin.ts      # Todas as rotas /admin/* e /api/admin/*
│   ├── controllers/
│   │   ├── events.ts     # CRUD de eventos
│   │   ├── subscribers.ts # Subscribe + listagem + export CSV
│   │   └── auth.ts       # Login, logout, refresh token
│   ├── services/
│   │   ├── events.ts     # Lógica de negócio + queries
│   │   └── email.ts      # Nodemailer
│   └── views/            # Handlebars templates
│       ├── layouts/      # main.hbs, admin.hbs, admin-bare.hbs
│       ├── partials/     # event-card.hbs
│       ├── public/       # index.hbs, 404.hbs, error.hbs
│       └── admin/        # login.hbs, events.hbs, event-form.hbs, subscribers.hbs
└── public/
    ├── css/main.css      # Identidade visual (DM Serif + DM Sans, paleta completa)
    ├── css/admin.css     # Estilos do painel admin
    └── js/
        ├── filters.js    # Filtros públicos (progressive enhancement)
        └── admin.js      # Token refresh + UX do admin
```

---

## Segurança (OWASP Top 10)

| Item | Implementação |
|---|---|
| A01 Broken Access Control | JWT em cookie HTTP-only, middleware `requireAuth` global em `/admin/*`, CUID como IDs |
| A02 Cryptographic Failures | bcrypt custo 12, JWT segredo 256+ bits, cookies `HttpOnly + Secure + SameSite=Strict` |
| A03 Injection | Prisma ORM com queries parametrizadas, `sanitize-html` em todos os inputs |
| A04 Insecure Design | Rate limiting em `/subscribe` (3/h) e `/admin/login` (5/15min) |
| A05 Security Misconfiguration | Helmet.js + CSP, `X-Powered-By` removido, stack traces bloqueados em produção |
| A07 Authentication Failures | Resposta genérica para email/senha errados, log de falhas com IP |
| A08 Data Integrity | Validação Zod em todos os endpoints, refresh tokens com revogação no banco |
| A09 Security Logging | Pino logger estruturado com redação de dados sensíveis |
| A10 SSRF | Whitelist de domínios para `ticketUrl`, validação de formato para `sourceUrl` |

---

## API JSON

Além do SSR, a aplicação expõe endpoints JSON para futuro uso mobile/API:

```
GET  /api/events?city=belo-horizonte&cat=musica&date=hoje
POST /api/subscribe
POST /admin/login          → JSON se Content-Type: application/json
GET  /api/admin/events     (requer autenticação)
POST /api/admin/events     (requer autenticação)
PUT  /api/admin/events/:id (requer autenticação)
DELETE /api/admin/events/:id (requer autenticação)
GET  /api/admin/subscribers (requer autenticação)
```

Formato de resposta:
```json
{ "success": true, "data": {}, "pagination": { "page": 1, "total": 9 } }
```

---

## Produção

Em produção (`NODE_ENV=production`):

- Stack traces não são expostos em respostas de erro
- `HTTPS` redirect automático via middleware
- Cookies marcados como `Secure`
- HSTS habilitado (1 ano)
- Logs estruturados via Pino (sem pretty-print)

---

*Hoje.city — curadoria independente de eventos culturais*
