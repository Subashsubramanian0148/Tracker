# Architecture

## Overview

Delivery Insights runs as a single container. A **NestJS backend-for-frontend (BFF)** serves the
**React single-page app** and a JSON API from the same origin, and keeps all data in **PostgreSQL**.
The browser never talks to Azure DevOps or Entra ID APIs and never holds an access token.

```
                     company network / VPN only
 ┌──────────┐  HTTPS  ┌────────────────────────────────────────────┐      ┌──────────────────┐
 │ Browser  │────────▶│ Container App (internal ingress)            │─────▶│ PostgreSQL 17    │
 │ React SPA│◀────────│  NestJS BFF                                 │ TLS  │ Flexible Server  │
 └──────────┘ cookie  │  ├─ auth: Entra ID OIDC (code + PKCE)       │      │ (private access) │
      ▲     (session) │  ├─ API: projects, work items, metrics,     │      └──────────────────┘
      │               │  │       delays, admin, audit                │
      │ sign-in       │  ├─ sync: scheduler + change-queue consumer │─────▶ Azure DevOps REST
      ▼               │  ├─ metrics engine (pure functions)         │      (managed identity)
 ┌──────────┐         │  └─ retention job                           │
 │ Entra ID │◀────────│                                             │◀──── Change queue
 └──────────┘         └────────────────────────────────────────────┘      ◀── ADO service hooks
```

## Components

| Path | Responsibility |
|---|---|
| `packages/shared` | API contract: zod request schemas and response types, used by both sides. |
| `apps/api/src/auth` | Entra ID sign-in (MSAL), server-side sessions, dev personas (local only). |
| `apps/api/src/common` | Guards (session, CSRF, roles, project access), problem-details errors, validation pipe, team/person scoping. |
| `apps/api/src/ado` | Azure DevOps REST client. Responses are validated, retries respect `Retry-After`, URLs only go to the configured org. |
| `apps/api/src/sync` | Incremental sync (reporting revisions feed plus continuation token), job lease, scheduler, change-queue consumer, webhook receiver. |
| `apps/api/src/metrics` | Pure metrics engine (history → segments, intervals, changes, cycle/lead time, delays, sprint health), the processor that persists derived rows, and the read-side metrics service. |
| `apps/api/src/work-items`, `delays`, `projects` | Read APIs, delay reasons and categories. |
| `apps/api/src/audit` | Hash-chained, append-only audit log. |
| `apps/api/src/retention` | Daily purge per the retention policy. |
| `apps/web` | React 19 SPA (Vite, Tailwind, React Query, Recharts). |
| `infra/` | Azure Bicep: VNet, Container Apps (internal), PostgreSQL, Key Vault, ACR, Log Analytics, change queue. |
| `.github/` | CI (lint, test, build, audit, image scan, SBOM, DAST), CodeQL, secret scanning, CD template. |

## Data flow

1. **Sync.** Every `SYNC_INTERVAL_SECONDS` (default 10), and within about 2 seconds of a change notification,
   the app reads new revisions from `/_apis/wit/reporting/workitemrevisions` with its
   managed identity. Only tracked fields are stored, as a compact snapshot per revision.
   Rich-text fields are converted to plain text and history keeps only a hash of them.
2. **Derive.** For every touched work item, the metrics engine rebuilds its state segments,
   iteration intervals, scope changes, cycle and lead time, blocked time and reopen count. Delay flags
   are then re-evaluated project-wide against the P85 baseline and sprint dates.
3. **Read.** API endpoints aggregate these tables per project, team, sprint and date range. Results are
   scoped to the projects the signed-in user can see in Azure DevOps.
4. **Explain.** Users attach delay reasons, which are append-only and audited.

### Why a change queue instead of a public webhook

The app is internal only, but Azure DevOps (a cloud service) can't call a private endpoint.
Service hooks therefore post into an Azure queue, and the app pulls from it with its managed identity.
No inbound internet path is needed. An HTTP webhook receiver with Basic auth also exists, for setups
that put Front Door + WAF in front of the app. Notifications only trigger a sync: their payloads
are never trusted as data.

## Key decisions

| Decision | Rationale |
|---|---|
| BFF with server-side sessions | No tokens in the browser (no XSS token theft), simple same-origin CSP, and cookies flagged `HttpOnly` + `Secure` + `SameSite`. |
| Revision history as the source of truth | Revisions are immutable in ADO, so metrics are reproducible and auditable and definitions can change later. |
| State categories, not state names | Custom and inherited processes work without code changes. |
| Pure metrics engine | Every formula is unit-tested without a database. |
| Postgres lease for jobs | Several replicas can run safely and a crashed holder's lease simply expires. |
| Single container | Fewer moving parts for fewer than 50 users. It scales out horizontally (stateless apart from the DB). |
| NestJS 11, Prisma 7, Node 24 LTS | Maintained LTS lines with zero known vulnerabilities in production dependencies at build time. |

## Data model (main tables)

`project`, `team`, `team_member`, `team_area`, `iteration`, `team_iteration`, `person`,
`work_item_type_state` (process metadata) · `work_item`, `work_item_revision` (raw history) ·
`state_segment`, `iteration_interval`, `work_item_change` (derived) · `delay_category`,
`delay_reason` · `app_user`, `session`, `audit_log`, `sync_run`, `job_lease`.

The schema is in [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Migrations are plain SQL under
`apps/api/prisma/migrations` and run as a separate job (`prisma migrate deploy`), never at app startup.
