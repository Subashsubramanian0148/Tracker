# DesignFlow (ADO Metrics)

DesignFlow is an internal web app that reads work item history from **Azure DevOps** and
measures how work actually flows:
- how long each story took (cycle time and lead time) and where the time went (time in state)
- estimate vs actual
- what changed after work started (scope changes)
- sprint commitment vs delivery
- **why** items were delayed

## Documentation

| Document | For |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works and key decisions |
| [docs/METRICS.md](docs/METRICS.md) | Exact definition of every metric |
| [SECURITY.md](SECURITY.md) | Security controls (OSI layers, OWASP ASVS L2, ISO 27001 / SOC 2) |
| [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) | STRIDE threat model |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Azure deployment, Entra ID and Azure DevOps setup, CI/CD |

## Repository layout

```
packages/shared   API contract (zod schemas + types) shared by API and web
apps/api          NestJS 11 backend-for-frontend, Prisma 7 + PostgreSQL
apps/web          React 19 + Vite + Tailwind single-page app
infra/            Azure Bicep (internal-only Container Apps, PostgreSQL, Key Vault, ...)
.github/          CI/CD and security scanning workflows
```

## Local development

Prerequisites: Node.js 22+ (Node 24 LTS recommended) and PostgreSQL 15+ (local install, Docker or
`docker compose up db`).

```bash
npm ci
cp .env.example .env            # then set SESSION_SECRET (openssl rand -base64 48) and DATABASE_URL
npm run build -w @ado-metrics/shared
npm run prisma:deploy -w @ado-metrics/api   # applies migrations (needs DATABASE_URL in the environment)
npm run build -w @ado-metrics/api
npm run seed:demo -w @ado-metrics/api       # optional: realistic demo project, no Azure DevOps needed
npm run dev:api                              # http://localhost:3000
npm run dev:web                              # http://localhost:5173 (proxies /api)
```

With `AUTH_MODE=dev`, signing in shows a persona chooser (Admin, Manager, Team Lead, Designer).
The server refuses to start in dev auth mode when `NODE_ENV=production`.

To sync a real Azure DevOps organisation locally (with or without Docker), follow
[docs/CONNECT_ADO_LOCALLY.md](docs/CONNECT_ADO_LOCALLY.md). It uses a read-only PAT with *Work Items: Read*
and *Project and Team: Read*, and `npm run ado:check -w @ado-metrics/api` verifies it before syncing.
PATs are refused in production, which uses a managed identity.

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run audit:prod     # fails on high/critical vulnerabilities in production dependencies
```

CI runs all of these on every pull request, plus CodeQL, secret scanning, container image scanning,
SBOM generation and an OWASP ZAP baseline scan.
