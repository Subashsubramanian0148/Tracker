# Security

This document describes how Delivery Insights protects its data. It covers controls at every network layer, how they map to
**OWASP ASVS 4.0 Level 2** and **ISO 27001 / SOC 2**, and the risks accepted on purpose.
Infrastructure details are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and the threat analysis is in
[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Reporting a vulnerability

Do not open a public issue. Email the security owner listed in `.github/CODEOWNERS` (or your internal
security team) with steps to reproduce. We acknowledge within 2 business days.

## Data classification

| Data | Classification | Notes |
|---|---|---|
| Work item history, titles, descriptions | Confidential | Mirrors Azure DevOps. The same people can see it. |
| Per-person metrics | Confidential (HR-sensitive) | Restricted to the person, their Team Lead and Managers. Every view is audited. |
| Delay reasons | Confidential | Append-only and attributed to their author. |
| Audit log | Confidential, integrity-critical | Hash-chained and append-only at database level. |
| Secrets (DB, session, Entra) | Secret | Stored only in Azure Key Vault and injected at runtime. |

## Controls by OSI layer

| Layer | Control | Where |
|---|---|---|
| **L1 Physical** | Azure datacenters (ISO 27001, SOC 1/2/3 attested); no on-premises hardware | Microsoft-managed |
| **L2 Data link** | Azure fabric isolation between tenants; no shared L2 with other customers | Microsoft-managed |
| **L3 Network** | Private VNet; Container Apps environment is **internal only** (no public IP); PostgreSQL (VNet integration), Key Vault and the registry use private endpoints with public access disabled; NSGs deny inbound internet. The change queue (Service Bus Standard) has a public endpoint because Azure DevOps must reach it: ADO holds a **send-only** SAS key for one queue and the app receives with its managed identity. Premium tier adds a private endpoint (see DEPLOYMENT.md). | `infra/` |
| **L4 Transport** | Only HTTPS 443 is exposed internally, through managed ingress; Azure DDoS platform protection; per-IP rate limiting (300/min, 20/min on auth, 5/min on manual sync) | `infra/`, `ThrottlerModule` |
| **L5 Session** | Server-side sessions in Postgres; `__Host-` cookie that is `HttpOnly`, `Secure` and `SameSite=Lax`; session ID regenerated at sign-in (anti-fixation); 30 min idle and 8 h absolute timeout; logout destroys the session and ends the Entra session | `http-security.ts`, `auth.controller.ts`, `guards.ts` |
| **L6 Presentation** | TLS 1.2+ end to end (ingress, PostgreSQL `require_secure_transport`, Azure APIs); HSTS; encryption at rest for Postgres, Key Vault and storage; strict output encoding (React escapes everything, no `dangerouslySetInnerHTML`, rich text converted to plain text on the server) | `infra/`, `ado/fields.ts` |
| **L7 Application** | Every control listed in the next section; optional Front Door + WAF (OWASP rule set) if exposure beyond the VPN is ever needed | `apps/`, `infra/` |

## Application controls (OWASP ASVS L2)

| ASVS chapter | Control | Implementation |
|---|---|---|
| V1 Architecture | Documented architecture, threat model and trust boundaries; BFF so the browser holds no tokens | `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md` |
| V2 Authentication | Microsoft Entra ID only (MFA and Conditional Access are enforced by the tenant); OIDC authorization code flow with **PKCE**, `state` and `nonce`; ID token `aud`/`tid`/`nonce` checked; no local passwords | `auth.service.ts` |
| V3 Session management | See L5 above. The CSRF synchronizer token is bound to the session. | `http-security.ts`, `guards.ts` |
| V4 Access control | Deny by default (global `SessionAuthGuard`); role-based access from Entra **app roles** (Viewer, TeamLead, Manager, Admin); project access limited to what the user can see in ADO (resolved with their own delegated token at sign-in); IDOR protection (every work item lookup is scoped to its project, and unknown and forbidden projects both return 404); per-person data limited to self, own team (Team Lead) and Managers | `guards.ts`, `scope.service.ts` |
| V5 Validation and encoding | Every query, path parameter and body is validated with zod (strict schemas, so unknown keys are rejected and mass assignment is impossible); length limits and control-character stripping on free text; parameterised SQL only (Prisma); ADO responses are schema-validated too | `packages/shared`, `zod-validation.pipe.ts`, `ado.schemas.ts` |
| V7 Errors and logging | RFC 9457 problem details with no stack traces or internal messages for 5xx; structured JSON logs with a correlation id; cookies, auth headers and CSRF tokens redacted; **hash-chained, append-only audit log** for sign-in, sign-out, denied access, per-person views, delay reasons, category changes, sync triggers, audit views and retention runs | `problem-details.filter.ts`, `app.module.ts`, `audit.service.ts` |
| V8 Data protection | `Cache-Control: no-store` on all API responses; data minimisation (only tracked fields are synced, only hashes kept for historical rich text); 2-year retention enforced daily | `http-security.ts`, `retention.service.ts` |
| V9 Communications | HTTPS only; outbound calls go only to the configured `ADO_ORG_URL` (https enforced) with `redirect: 'error'` and timeouts | `config.ts`, `ado.client.ts` |
| V10 Malicious code | Dependency audit is blocking in CI; CodeQL; secret scanning; SBOM; container image scan | `.github/workflows` |
| V12 Files | No file upload. Static files are served from a fixed directory with dotfiles denied. | `http-security.ts` |
| V13 API | JSON only with a 64 KB body limit (512 KB for the webhook); CSRF protection (Origin check plus synchronizer token); webhook protected by Basic auth with timing-safe comparison, and its payload is treated only as a trigger | `guards.ts`, `sync.controller.ts` |
| V14 Configuration | All configuration is validated at startup; production **refuses** insecure combinations (dev auth, PAT auth, http base URL, weak session secret); secrets only from Key Vault; non-root container (uid 10001) whose application files are root-owned and not writable by the process; security headers (CSP without `unsafe-inline`, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict Referrer-Policy, Permissions-Policy, COOP/CORP); `X-Powered-By` removed | `config.ts`, `http-security.ts`, `Dockerfile` |

Automated tests prove these controls on every build. See
[`apps/api/test/security.spec.ts`](apps/api/test/security.spec.ts): headers, 401/403/404 behaviour,
CSRF and cross-origin blocking, strict validation, role denial auditing, error leakage, body limits,
production configuration guard rails, open-redirect protection and audit hash chaining.

## ISO 27001 / SOC 2 mapping (selected)

| Control area | Evidence |
|---|---|
| Access control (ISO A.5.15–5.18, A.8.2–8.5 · SOC CC6.1–6.3) | Entra SSO and MFA, app-role RBAC, assignment-required enterprise app, least-privilege managed identity (ADO Reader) |
| Logging and monitoring (A.8.15–8.16 · CC7.2) | Audit log with integrity verification (`GET /api/admin/audit-logs/verify`), Log Analytics with 2-year retention |
| Secure development (A.8.25–8.29 · CC8.1) | PR template with security checklist, CODEOWNERS review, CI gates (tests, audit, CodeQL, secret scan, image scan, DAST) |
| Cryptography (A.8.24) | TLS 1.2+, Azure-managed encryption at rest, SHA-256 audit chain |
| Data retention (A.8.10) | `RETENTION_DAYS` enforced daily, with the purge itself audited |
| Change management (A.8.32 · CC8.1) | Migrations reviewed as SQL; deployments through protected GitHub environments with required reviewers |
| Supplier security (A.5.19–5.22) | SBOM per image, Dependabot, pinned base images |

## Accepted risks

| Risk | Rationale and mitigation |
|---|---|
| Moderate advisories in **dev-only** tooling (`sprintf-js` via Jest's coverage stack) | No fixed version exists. These packages never ship: the runtime image contains production dependencies only, which have **0 known vulnerabilities**. CI blocks on high or critical issues in production dependencies. |
| Display names of assignees are visible to every viewer of a project | They are already visible in Azure DevOps to the same people. Emails and per-person aggregates are restricted. |
| In-memory rate limiting is per replica | Below 50 users and on an internal network the risk is low. Add Front Door WAF rate limiting if the app is ever exposed. |
| No read-only root filesystem in Azure | Azure Container Apps has no `readOnlyRootFilesystem` setting. The app runs as a non-root user that cannot modify its own files and writes only to `/tmp`; docker compose enforces a read-only root filesystem locally. |
| Change queue reachable from the internet (Service Bus Standard) | Azure DevOps is a cloud service and must push to it. Only a send-only key for one queue exists, and messages are only triggers to re-fetch from ADO. Use Premium with a private endpoint if policy requires it. |

## Security checklist for changes

- New endpoint: has a zod schema, correct `@Roles`, `ProjectAccessGuard` if it is project-scoped, an audit entry if it reads per-person data or changes state.
- New outbound call: only to `ADO_ORG_URL` or Azure SDKs with managed identity.
- No `dangerouslySetInnerHTML`, inline scripts or inline styles in the SPA.
- No secrets in code, logs or the repository. Gitleaks runs in CI.
