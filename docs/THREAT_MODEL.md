# Threat model

Method: STRIDE per trust boundary. Review this document whenever a new boundary or data flow is
added. Last reviewed: 2026-10-22.

## Assets

1. Work item data mirrored from Azure DevOps (confidential)
2. Per-person delivery metrics (HR-sensitive)
3. Delay reasons and the audit trail (integrity-critical)
4. Credentials: session secret, Entra client secret, database credentials, managed identity
5. Availability of the reporting service

## Trust boundaries

| # | Boundary | Crossing |
|---|---|---|
| B1 | Browser ↔ App | HTTPS, session cookie, JSON API |
| B2 | App ↔ Entra ID | OIDC redirect and token exchange |
| B3 | App ↔ Azure DevOps | REST with managed identity, or a delegated user token at sign-in |
| B4 | Azure DevOps ↔ Change queue ↔ App | Service hook → queue (send-only) → app (receive with managed identity) |
| B5 | App ↔ PostgreSQL | TLS inside the VNet |
| B6 | CI/CD ↔ Azure | GitHub OIDC federation, protected environments |

## STRIDE analysis

| Threat | Boundary | Scenario | Mitigation | Residual |
|---|---|---|---|---|
| **S**poofing | B1 | Attacker reuses a stolen session cookie | `HttpOnly`/`Secure` `__Host-` cookie, 30 min idle and 8 h absolute timeouts, internal-only network, Entra Conditional Access at sign-in | Low |
| Spoofing | B2 | Authorization-code injection or replay | PKCE, `state` (timing-safe compare), `nonce`, 10 min login window, `aud`/`tid` checks | Low |
| Spoofing | B4 | Forged change notification | Queue is only reachable with a send-only key or the managed identity; the webhook needs Basic auth; payloads only trigger a re-fetch from ADO | Very low |
| **T**ampering | B1 | CSRF changes delay reasons | Origin check plus synchronizer token, SameSite cookie | Low |
| Tampering | B5 | Insider edits the audit log | DB trigger blocks UPDATE/DELETE/TRUNCATE; SHA-256 hash chain with a verification endpoint; DB admin activity audited by pgaudit (enabled after the first server restart, see DEPLOYMENT.md) | Low |
| Tampering | B1 | Mass assignment and over-posting | Strict zod schemas; server-set fields such as author and timestamps | Very low |
| **R**epudiation | B1 | "I didn't write that delay reason" | Reasons are attributed and append-only; audit entry with user, IP, trace id | Very low |
| **I**nformation disclosure | B1 | IDOR across projects or work items | Project access guard (404 for both unknown and forbidden); every query scoped by `projectId` | Low |
| Information disclosure | B1 | Viewer sees colleagues' individual metrics | Person-visibility rules; the People endpoint is role-gated and audited; emails hidden unless allowed | Low |
| Information disclosure | B1 | Stored XSS from ADO rich text | HTML stripped server-side, React escaping, strict CSP without `unsafe-inline` | Very low |
| Information disclosure | B1 | Error messages leak internals | Problem details only; 5xx details stay in the logs (with redaction) | Very low |
| Information disclosure | B3 | Over-privileged sync identity | Managed identity with Reader / Basic access in ADO only; no write scopes | Low |
| **D**enial of service | B1 | Request floods or expensive queries | Rate limits, 64 KB body limit, pagination caps (200), 30 s DB statement timeout, a bounded pool | Medium (in-memory limiter per replica) |
| Denial of service | B3 | ADO throttling | Backoff that honours `Retry-After`, incremental sync, a lease so only one syncer runs | Low |
| **E**levation of privilege | B1 | User grants themselves Admin | Roles come only from signed Entra app-role claims; no role editing in the app | Very low |
| Elevation of privilege | B6 | Compromised pipeline deploys malicious code | OIDC (no stored secrets), required reviewers on production, CodeQL, dependency audit, image scan, SBOM | Low |
| Elevation of privilege | Runtime | Container breakout or code tampering | Non-root user (uid 10001, no shell); application files owned by root and not writable by the process; minimal Alpine image scanned in CI; Container Apps runs unprivileged (read-only root filesystem and dropped capabilities are enforced in docker compose, which Azure Container Apps can't configure) | Low |

## Abuse cases covered by automated tests

See `apps/api/test/security.spec.ts`: unauthenticated access, CSRF (missing token, wrong token,
foreign origin), unknown body keys, role escalation, cross-project access, path traversal in project id,
error leakage, oversized bodies, open redirect after login, forged service hook, insecure production config.
