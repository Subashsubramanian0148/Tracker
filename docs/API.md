# API reference

All endpoints are served under `/api` from the same origin as the web app.
Types and validation schemas live in [`packages/shared/src/index.ts`](../packages/shared/src/index.ts).

## Conventions

- **Auth:** server-side session in an `HttpOnly; Secure; SameSite=Lax` cookie (`__Host-adom.sid` in production, `adom.sid` locally). No tokens are ever exposed to the browser.
- **CSRF:** every `POST`/`PUT`/`PATCH`/`DELETE` must send `X-CSRF-Token: <MeResponse.csrfToken>`. Requests without it get `403`.
- **Requests:** always send `credentials: 'include'` and `Accept: application/json`.
- **Errors:** RFC 9457 `application/problem+json` (`ProblemDetails`). `401` → not signed in (redirect to `/api/auth/login`). `403` → signed in but not allowed. `422` → validation failed (`errors[]`).
- **Pagination:** `?page=1&pageSize=50` → `Paged<T>`.
- **Rate limit:** `429` with a `Retry-After` header.

## Endpoints

| Method | Path | Roles | Request | Response |
|---|---|---|---|---|
| GET | `/api/auth/login?returnTo=/path` | public | — | 302 to Entra ID (or dev login page in dev mode) |
| GET | `/api/auth/callback` | public | — | 302 to `returnTo` |
| POST | `/api/auth/logout` | any | — | `LogoutResponse` — navigate to `logoutUrl` if set, else `/` |
| GET | `/api/auth/me` | any | — | `MeResponse` |
| GET | `/api/projects` | any | — | `ProjectSummary[]` |
| GET | `/api/projects/:projectId/teams` | any | — | `TeamRef[]` |
| GET | `/api/projects/:projectId/iterations` | any | `teamScopedQuery` | `Iteration[]` |
| GET | `/api/projects/:projectId/work-items` | any | `workItemListQuery` | `Paged<WorkItemSummary>` |
| GET | `/api/projects/:projectId/work-items/:id` | any | — | `WorkItemDetail` |
| GET | `/api/projects/:projectId/metrics/overview` | any | `metricsQuery` | `OverviewMetrics` |
| GET | `/api/projects/:projectId/metrics/sprints` | any | `teamScopedQuery` | `SprintHealth[]` |
| GET | `/api/projects/:projectId/people` | TeamLead, Manager, Admin | `metricsQuery` | `PersonMetrics[]` |
| GET | `/api/projects/:projectId/delays` | any | `delayListQuery` | `Paged<DelayedItem>` |
| POST | `/api/projects/:projectId/work-items/:id/delay-reasons` | TeamLead, Manager, Admin, or the assignee | `createDelayReasonBody` | `DelayReason` (201) |
| GET | `/api/delay-categories` | any | — | `DelayCategory[]` |
| POST | `/api/admin/delay-categories` | Admin | `upsertDelayCategoryBody` | `DelayCategory` (201) |
| PUT | `/api/admin/delay-categories/:id` | Admin | `upsertDelayCategoryBody` | `DelayCategory` |
| GET | `/api/admin/sync-runs` | Admin | `paginationQuery` | `Paged<SyncRun>` |
| POST | `/api/admin/sync` | Admin | `triggerSyncBody` | `SyncRun` (202) |
| GET | `/api/admin/audit-logs` | Admin | `auditListQuery` | `Paged<AuditEntry>` |
| GET | `/api/admin/audit-logs/verify` | Admin | — | `{ intact, firstBrokenId }` (writes an `audit.verify` entry) |
| POST | `/api/webhooks/ado` | Basic auth (service hook secret) | ADO service hook payload | `202` |
| GET | `/api/health/live` | public | — | `{ status: 'ok' }` |
| GET | `/api/health/ready` | public | — | `{ status: 'ok' }` or `503` |

## Individual (per-person) data

`PersonRef.email` and per-person aggregates are only returned when the viewer is that person, a `Manager`, or an `Admin` (or a `TeamLead` for members of their own teams). Every response that includes per-person metrics writes a `people.view` audit entry.
