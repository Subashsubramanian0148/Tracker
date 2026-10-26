# Deployment and operations

This guide is for the platform / DevOps engineer who deploys and runs **ADO Metrics / Delivery Insights** on Azure. It covers the infrastructure (`infra/`), the container image (`Dockerfile`), CI/CD (`.github/`), helper scripts (`scripts/`) and the local stack (`docker-compose.yml`).

Application-level security controls (authentication, authorisation, CSRF, input validation, audit logging) are described in [`SECURITY.md`](../SECURITY.md). The API contract is in [`API.md`](API.md).

## Contents

1. [Architecture](#1-architecture)
2. [Prerequisites](#2-prerequisites)
3. [Entra ID app registration](#3-entra-id-app-registration)
4. [Change queue: Service Bus or Storage Queue](#4-change-queue-service-bus-or-storage-queue)
5. [Phase 1: deploy the platform](#5-phase-1-deploy-the-platform)
6. [Database roles and pgaudit](#6-database-roles-and-pgaudit)
7. [Key Vault secrets](#7-key-vault-secrets)
8. [First images and Phase 2](#8-first-images-and-phase-2)
9. [Azure DevOps access for the managed identity](#9-azure-devops-access-for-the-managed-identity)
10. [Azure DevOps service hooks](#10-azure-devops-service-hooks)
11. [GitHub CI/CD](#11-github-cicd)
12. [Operations](#12-operations)
13. [Optional: Azure Front Door + WAF](#13-optional-azure-front-door--waf)
14. [Local run with docker compose](#14-local-run-with-docker-compose)
15. [Configuration reference](#15-configuration-reference)
16. [Security controls by OSI layer](#16-security-controls-by-osi-layer)
17. [Cost notes](#17-cost-notes)
18. [Hardening backlog and known limitations](#18-hardening-backlog-and-known-limitations)

---

## 1. Architecture

```
 Corporate network / VPN ──(hub VNet peering / ExpressRoute)──┐
                                                              ▼
┌──────────────────────── Spoke VNet  <app>-<env>-vnet  (10.60.0.0/22) ────────────────────────┐
│                                                                                               │
│  snet-aca (/23, delegated)            snet-pe (/27)                 snet-psql (/28, delegated)  │
│  ┌─────────────────────────────┐      ┌──────────────────────┐      ┌───────────────────────┐ │
│  │ Container Apps environment  │      │ PE: Key Vault        │      │ PostgreSQL Flexible   │ │
│  │ (INTERNAL load balancer)    │─────▶│ PE: Container Reg.   │      │ Server 17             │ │
│  │  ├ app  (1–3 replicas)      │      │ PE: Storage queue*   │      │ private access only   │ │
│  │  └ job-migrate (manual)     │──────┼──────────────────────┼─────▶│ TLS 1.2+, pgaudit     │ │
│  └─────────────────────────────┘      └──────────────────────┘      └───────────────────────┘ │
│        │ managed identity                                                                     │
│  snet-tools (/27): self-hosted CI runner for smoke tests (optional)                           │
└────────┼──────────────────────────────────────────────────────────────────────────────────────┘
         │ outbound HTTPS (Entra-authenticated)
         ├──▶ Azure DevOps REST API (dev.azure.com)       ◀── reads work items as the managed identity
         ├──▶ Service Bus queue  ado-changes   ◀──────────── Azure DevOps service hooks (Send only)
         └──▶ Entra ID (login.microsoftonline.com)

 All resource logs and metrics ──▶ Log Analytics (730 days)          * only when CHANGE_QUEUE_KIND=storage
```

Key properties:

- **No public inbound endpoint.** The Container Apps environment is internal (`vnetConfiguration.internal: true`); Key Vault, ACR and PostgreSQL have public network access disabled. The only resource reachable from the internet is the change queue, and only by authenticated senders (see section 4).
- **No stored credentials for Azure.** The app uses a user-assigned managed identity for ACR, Key Vault, the change queue and Azure DevOps. CI/CD uses GitHub OIDC federation.
- **Separate identities per duty.** `id-app` (runtime), `id-migrator` (schema changes, reads only the migrator DB secret), `id-deploy` (CI/CD, custom least-privilege role).
- **Near-real-time sync without inbound exposure.** Azure DevOps service hooks push events into a queue; the app pulls from inside the VNet. A scheduled sync (`SYNC_INTERVAL_SECONDS`) is the safety net.

Naming follows `<appName>-<environmentName>-<resource>`; globally unique names add a 5-character suffix (e.g. `adom-prod-kv-x7k2p`, `adomprodacrx7k2p`).

## 2. Prerequisites

**Tools** (operator workstation or Cloud Shell): Azure CLI ≥ 2.60 with Bicep (`az bicep install`), the `containerapp` extension (`az extension add -n containerapp`), `psql` ≥ 16, `openssl`, `jq`.

**Azure**

| Need | Why |
|---|---|
| Subscription with resource providers `Microsoft.App`, `Microsoft.ContainerRegistry`, `Microsoft.DBforPostgreSQL`, `Microsoft.KeyVault`, `Microsoft.ServiceBus` (or `Microsoft.Storage`), `Microsoft.OperationalInsights`, `Microsoft.Network`, `Microsoft.ManagedIdentity`, `Microsoft.Cdn` (Front Door only) registered | `az provider register -n <ns>` |
| One resource group per environment, e.g. `rg-adom-staging`, `rg-adom-prod` | Blast-radius and RBAC boundary |
| **Owner** (or Contributor + Role Based Access Control Administrator) on the resource group for the person running Bicep | The template creates role assignments and a custom role definition |
| An address range that does not overlap the corporate network (default `10.60.0.0/22`) and a way to reach it (hub peering / VPN) | Users, DBAs and the CI runner need line of sight to the internal environment |
| Corporate DNS that forwards the private zones (or link them to the hub resolver VNet via `dnsZoneLinkVnetIds`) | Users must resolve the app and DBAs the private endpoints |

**Entra ID**: permission to create an app registration and grant admin consent (Application Administrator + Privileged Role Administrator or Global Administrator for consent); two security groups: DBAs (`postgresEntraAdminObjectId`) and secret operators (`keyVaultSecretsOfficerPrincipalIds`). Assigning groups to app roles requires Entra ID P1.

**Azure DevOps**: Project Collection Administrator (to add the managed identity as a user) and project administrators (to create service hooks). The organisation must be connected to the same Entra tenant.

**GitHub**: repository admin; GitHub Advanced Security (Code Security + Secret Protection) for private repositories, or set repository variable `GHAS_ENABLED=false` to skip SARIF uploads and dependency review.

## 3. Entra ID app registration

The app signs users in with the OAuth 2.0 authorisation code flow (confidential client) and maps Entra app roles to its own roles.

```bash
PUBLIC_BASE_URL=https://metrics.contoso.internal
APP_NAME="ADO Metrics (prod)"

# App roles: values must be exactly Viewer, TeamLead, Manager, Admin. "Viewer" is the Designer role (shown as Designer in the app).
cat > app-roles.json <<EOF
[
  {"allowedMemberTypes":["User"],"displayName":"Designer","value":"Viewer","isEnabled":true,"id":"$(uuidgen | tr A-Z a-z)","description":"Designer: log own tasks and read project delivery metrics."},
  {"allowedMemberTypes":["User"],"displayName":"TeamLead","value":"TeamLead","isEnabled":true,"id":"$(uuidgen | tr A-Z a-z)","description":"Designer plus per-person metrics for own teams and delay reasons."},
  {"allowedMemberTypes":["User"],"displayName":"Manager","value":"Manager","isEnabled":true,"id":"$(uuidgen | tr A-Z a-z)","description":"Per-person metrics across teams."},
  {"allowedMemberTypes":["User"],"displayName":"Admin","value":"Admin","isEnabled":true,"id":"$(uuidgen | tr A-Z a-z)","description":"Configuration, sync control and audit log access."}
]
EOF

# Delegated permissions: Azure DevOps user_impersonation + openid profile email offline_access.
ADO_RESOURCE=499b84ac-1321-427f-aa17-267ca6975798
ADO_SCOPE=$(az ad sp show --id $ADO_RESOURCE --query "oauth2PermissionScopes[?value=='user_impersonation'].id" -o tsv)
GRAPH=00000003-0000-0000-c000-000000000000
graph_scope() { az ad sp show --id $GRAPH --query "oauth2PermissionScopes[?value=='$1'].id" -o tsv; }
cat > required-access.json <<EOF
[
  {"resourceAppId":"$ADO_RESOURCE","resourceAccess":[{"id":"$ADO_SCOPE","type":"Scope"}]},
  {"resourceAppId":"$GRAPH","resourceAccess":[
    {"id":"$(graph_scope openid)","type":"Scope"},
    {"id":"$(graph_scope profile)","type":"Scope"},
    {"id":"$(graph_scope email)","type":"Scope"},
    {"id":"$(graph_scope offline_access)","type":"Scope"}]}
]
EOF

APP_ID=$(az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "$PUBLIC_BASE_URL/api/auth/callback" \
  --enable-id-token-issuance false \
  --enable-access-token-issuance false \
  --app-roles @app-roles.json \
  --required-resource-accesses @required-access.json \
  --query appId -o tsv)

az ad sp create --id "$APP_ID"
az ad sp update --id "$APP_ID" --set appRoleAssignmentRequired=true   # "Assignment required" = Yes
az ad app permission admin-consent --id "$APP_ID"

# Client secret: short-lived, stored only in Key Vault (section 7). Prefer a certificate if the app supports it.
az ad app credential reset --id "$APP_ID" --display-name "kv:entra-client-secret" --years 0.5 --query password -o tsv
```

Then, in **Entra admin center → Enterprise applications → ADO Metrics (prod) → Users and groups**, assign groups to the four roles. Users without an assignment cannot sign in.

Recommended: a Conditional Access policy for this enterprise application requiring MFA and a compliant or hybrid-joined device; token lifetime defaults are fine. Use a separate app registration per environment (staging redirect URI differs).

`ENTRA_CLIENT_ID` = `$APP_ID`, `ENTRA_TENANT_ID` = your tenant ID.

## 4. Change queue: Service Bus or Storage Queue

Azure DevOps (a SaaS in Microsoft's cloud) cannot reach anything inside our VNet, so it cannot call the app's webhook. Instead its service hooks write events to a queue that the app polls from inside the network. The queue's public endpoint is the only internet-facing surface, so the question is how tightly the **sender** can be restricted.

| | **Azure Service Bus (default)** | Azure Storage Queue |
|---|---|---|
| ADO service-hook auth options | SAS connection string, or an Azure Resource Manager service connection | Storage **account key**, or an Azure Resource Manager service connection |
| Least-privilege fallback when no service connection is used | **Queue-scoped SAS rule with `Send` only** - cannot read, delete, manage, or touch any other entity | Account key = full control of the whole storage account (all services); cannot be scoped |
| App receive auth | Managed identity, `Azure Service Bus Data Receiver` on the queue only | Managed identity, `Storage Queue Data Message Processor` on the queue only |
| Private endpoint for the app side | Premium only (~USD 680/month); Standard uses the public endpoint with TLS 1.2 + Entra auth | Yes (included) |
| Poison messages | Built-in dead-letter queue after 10 deliveries, peek-lock | Manual (dequeue count) |
| Cost | Standard ~USD 10/month | Cents |

**Decision: Service Bus Standard with a queue-scoped Send-only SAS rule** (`changeQueueKind=servicebus`, `serviceHookAuthMode=sharedKey`). Rationale: the credential handed to Azure DevOps can only add messages to one queue, which is the least privilege any option offers without depending on an ARM service connection; the app side uses Entra RBAC; dead-lettering gives poison-message handling for free.

If your Azure DevOps organisation offers **Authentication mode → Azure Resource Manager service connection** in the service-hook wizard (the consumer reference lists it for both Service Bus and Storage), you can remove SAS entirely: set `serviceHookAuthMode=serviceConnection` and `serviceHookSenderPrincipalId` to the service connection's service principal object ID. Bicep then grants only `Azure Service Bus Data Sender` (or `Storage Queue Data Message Sender`) on the queue and sets `disableLocalAuth=true` on the namespace (or keeps `allowSharedKeyAccess=false` on storage). Verify this option in your organisation before switching.

`changeQueueKind=storage` with `serviceHookAuthMode=sharedKey` turns on `allowSharedKeyAccess` because the ADO consumer then needs the account key. Only accept that with a documented risk exception: the account is dedicated to this one queue, keys are rotated, and the account has no other data.

The app is told which one is in use via `CHANGE_QUEUE_KIND` (`servicebus` | `storage`) and `CHANGE_QUEUE_URL` (section 15).

## 5. Phase 1: deploy the platform

```bash
ENV=prod                      # dev | test | staging | prod
RG=rg-adom-$ENV
LOCATION=westeurope
az group create -n $RG -l $LOCATION --tags app=ado-metrics env=$ENV dataClassification=Confidential

cp infra/main.parameters.example.json infra/main.parameters.$ENV.json
# Edit every <REPLACE: ...> value (the deploy script refuses to run while any remain).
# Keep environment parameter files out of git if they contain internal identifiers you consider sensitive.

# Break-glass admin password: only needed when the server is first created.
export POSTGRES_ADMIN_PASSWORD="$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-32)"

scripts/deploy/deploy-infra.sh $RG infra/main.parameters.$ENV.json --phase 1
```

`deploy-infra.sh` runs `az deployment group create --confirm-with-what-if`, so you review the diff before anything changes, and prints the outputs (`keyVaultName`, `acrLoginServer`, `postgresFqdn`, `appIdentityClientId`, `changeQueueUrl`, `githubEnvironmentVariables`, `requiredKeyVaultSecrets`, ...). Equivalent raw command:

```bash
az deployment group create -g $RG -f infra/main.bicep \
  -p @infra/main.parameters.$ENV.json -p deployApp=false -p postgresAdminPassword="$POSTGRES_ADMIN_PASSWORD" \
  --confirm-with-what-if
```

Phase 1 creates: VNet + NSGs, Log Analytics, managed identities (+ GitHub federated credential and custom deployer role when `githubRepository` is set), ACR Premium (private endpoint), Key Vault (private endpoint, RBAC, purge protection), PostgreSQL 17 (private access), the change queue, private DNS zones, and the internal Container Apps environment. In `prod`, Key Vault and PostgreSQL get a `CanNotDelete` lock.

**Network access for operators.** Key Vault and PostgreSQL are private. Run the next steps from a machine that resolves and routes to the private endpoints (VPN through the hub, or a jump host in `snet-tools`). If you must seed secrets from outside, temporarily set `keyVaultAllowedIpRanges=["<your egress IP>/32"]`, redeploy Phase 1, and remove it afterwards.

Store the break-glass password first (section 7), then `unset POSTGRES_ADMIN_PASSWORD`.

## 6. Database roles and pgaudit

The app and the migrator use separate, non-admin roles. Day-to-day human access uses Entra ID (members of the DBA group set as Entra admin).

```bash
PGHOST=$(az postgres flexible-server show -g $RG -n <postgres-name> --query fullyQualifiedDomainName -o tsv)
export PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
psql "host=$PGHOST dbname=ado_metrics user=<DBA group display name> sslmode=verify-full sslrootcert=system"
```

```sql
-- Generate both passwords with: openssl rand -base64 33 | tr -d '/+=' | cut -c1-32
CREATE ROLE ado_metrics_migrator LOGIN PASSWORD '<migrator password>';
CREATE ROLE ado_metrics_app      LOGIN PASSWORD '<app password>' CONNECTION LIMIT 40;

GRANT CONNECT ON DATABASE ado_metrics TO ado_metrics_migrator, ado_metrics_app;
GRANT USAGE, CREATE ON SCHEMA public TO ado_metrics_migrator;   -- owns all tables it creates
GRANT USAGE ON SCHEMA public TO ado_metrics_app;

-- Tables/sequences created by the migrator are usable (DML only) by the app.
ALTER DEFAULT PRIVILEGES FOR ROLE ado_metrics_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ado_metrics_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ado_metrics_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ado_metrics_app;

-- Extensions are installed by the DBA, not by migrations (the migrator cannot create them).
CREATE EXTENSION IF NOT EXISTS pgaudit;
```

The app role cannot run DDL, so a compromised app cannot alter the schema or drop audit tables. If the backend's audit table must be append-only, additionally `REVOKE UPDATE ON <audit table> FROM ado_metrics_app` after the first migration (deletes stay allowed for the 730-day retention job).

**pgaudit.** Phase 1 allow-lists `pgaudit` and adds it to `shared_preload_libraries`, which needs one restart:

```bash
az postgres flexible-server restart -g $RG -n <postgres-name>
```

Then run `CREATE EXTENSION pgaudit;` (above), set `"pgauditLogClasses": { "value": "DDL,ROLE" }` in the parameter file and run Phase 1 again. Audit records go to Log Analytics (`AzureDiagnostics`, category `PostgreSQLLogs`) together with `log_connections` / `log_disconnections`.

## 7. Key Vault secrets

Bicep creates secret **names only**; values are set by a member of the secrets-officer group and never pass through templates, parameter files or pipelines.

| Secret | Consumed by | Value |
|---|---|---|
| `database-url` | app → `DATABASE_URL` | `postgresql://ado_metrics_app:<pw>@<postgresFqdn>:5432/ado_metrics?sslmode=verify-full` |
| `migrator-database-url` | migration job → `DATABASE_URL` | `postgresql://ado_metrics_migrator:<pw>@<postgresFqdn>:5432/ado_metrics?sslmode=require` |
| `session-secret` | app → `SESSION_SECRET` | ≥ 32 random characters |
| `entra-client-secret` | app → `ENTRA_CLIENT_SECRET` | from section 3 |
| `webhook-basic-password` | app → `WEBHOOK_BASIC_PASSWORD` | random; only used if the HTTP webhook is exposed via Front Door |
| `postgres-admin-password` | humans (break-glass) | the Phase 1 admin password |

```bash
KV=<keyVaultName output>
set_secret() { az keyvault secret set --vault-name "$KV" --name "$1" --file /dev/stdin --encoding utf-8 --output none ${2:+--expires "$2"}; }

openssl rand -base64 48 | tr -d '\n' | set_secret session-secret
openssl rand -base64 33 | tr -d '\n' | set_secret webhook-basic-password
printf %s "$POSTGRES_ADMIN_PASSWORD" | set_secret postgres-admin-password
# GNU date; on macOS use: date -u -v+180d +%Y-%m-%dT%H:%M:%SZ
read -rs ENTRA_SECRET && printf %s "$ENTRA_SECRET" | set_secret entra-client-secret "$(date -u -d '+180 days' +%Y-%m-%dT%H:%M:%SZ)"
read -rs APP_DB_URL && printf %s "$APP_DB_URL" | set_secret database-url
read -rs MIGRATOR_DB_URL && printf %s "$MIGRATOR_DB_URL" | set_secret migrator-database-url
unset ENTRA_SECRET APP_DB_URL MIGRATOR_DB_URL
```

Piping through stdin keeps values out of shell history and process listings. `sslmode=verify-full` makes node-postgres verify the server certificate chain and host name (Azure's certificates chain to DigiCert Global Root G2 / Microsoft RSA Root CA 2017, both in Node's CA store).

Container Apps references secrets **without a version**, so a new secret version is picked up within ~30 minutes and the affected revision restarts automatically. Each identity gets `Key Vault Secrets User` on its own secrets only (granted in Phase 2, because a secret must exist before it can be a role-assignment scope).

## 8. First images and Phase 2

The CD pipeline normally imports images and rolls out revisions, but the app and migration job do not exist until Phase 2, which itself needs image references. Bootstrap once:

1. Build and publish images: run the **Deploy** workflow once with `DEPLOY_ENABLED=true` (the `build` job succeeds; the staging job fails at the migration step because the job does not exist yet - expected on first run), or build locally and push to GHCR. Note the two `ghcr.io/...@sha256:...` references from the job summary/log.
2. Import them into ACR (control-plane operation, works with the private registry):
   ```bash
   export GHCR_USERNAME=<github user> GHCR_TOKEN=<classic PAT with read:packages, delete it afterwards>
   RUNTIME_IMAGE=$(scripts/deploy/import-image.sh <acr> ghcr.io/<org>/<repo>/runtime@sha256:<d1> ado-metrics/runtime bootstrap)
   MIGRATOR_IMAGE=$(scripts/deploy/import-image.sh <acr> ghcr.io/<org>/<repo>/migrator@sha256:<d2> ado-metrics/migrator bootstrap)
   export RUNTIME_IMAGE MIGRATOR_IMAGE
   ```
3. Phase 2:
   ```bash
   scripts/deploy/deploy-infra.sh $RG infra/main.parameters.$ENV.json --phase 2
   ```
   This grants secret-scoped Key Vault access, then creates the Container App, the migration job, alerts and (optionally) Front Door. If the app fails to start with a Key Vault "Authentication failed" error right after the role assignments were created, RBAC had not propagated yet - re-run the same command.
4. Run the first migration:
   ```bash
   scripts/deploy/run-migration.sh $RG adom-$ENV-job-migrate "$MIGRATOR_IMAGE"
   ```
5. DNS: point `customDomainName` (e.g. `metrics.contoso.internal`) at the environment's internal IP (`environmentStaticIp` output) in corporate DNS. Without a custom domain, users browse to `appInternalFqdn`, which resolves through the linked private zone. The custom domain certificate (issued by your internal CA, imported into Key Vault as a certificate named `customDomainCertificateName`) must exist before Phase 2.

From now on, `deploy-infra.sh --phase 2` re-uses the currently deployed images, so infrastructure changes never roll back the app.

## 9. Azure DevOps access for the managed identity

The app reads Azure DevOps as the user-assigned managed identity `<app>-<env>-id-app` (`ADO_AUTH=managed-identity`, `AZURE_CLIENT_ID`). No PAT exists anywhere.

1. **Organization settings → Users → Add users**, search for the managed identity by name (`adom-prod-id-app`), select it.
2. **Access level**: *Basic* if the app uses Analytics/OData; *Stakeholder* is sufficient for work-item REST reads only. Choose the lowest level that works.
3. **Add to projects**: each project in `ADO_PROJECTS` (or all projects to be reported on), group **Readers**.
4. Do not grant any other permission (no Contributors, no PAT management, no service connections).

Scripted alternative (Service Principal Entitlements API, run as a Project Collection Administrator):

```bash
ORG=contoso
PRINCIPAL_ID=<appIdentityPrincipalId output>
TOKEN=$(az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 --query accessToken -o tsv)
curl -sS -X POST "https://vsaex.dev.azure.com/$ORG/_apis/serviceprincipalentitlements?api-version=7.1-preview.1" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"accessLevel\":{\"accountLicenseType\":\"stakeholder\"},\"servicePrincipal\":{\"origin\":\"aad\",\"originId\":\"$PRINCIPAL_ID\",\"subjectKind\":\"servicePrincipal\"}}"
```

Then add it to each project's Readers group in **Project settings → Permissions**.

## 10. Azure DevOps service hooks

Create one subscription per event, per project: **Work item created**, **Work item updated**, **Work item deleted**, **Work item restored**.

**Service Bus (default)** - get the Send-only connection string (it is scoped to the queue and contains `EntityPath`):

```bash
az servicebus queue authorization-rule keys list -g $RG \
  --namespace-name <serviceBus namespace> --queue-name ado-changes --name ado-service-hook-send \
  --query primaryConnectionString -o tsv
```

**Project settings → Service hooks → + → Azure Service Bus → trigger → action "Send a message to a Service Bus Queue"**:

| Field | Value |
|---|---|
| Authentication mode | SAS connection string (or Azure Resource Manager service connection, section 4) |
| SAS connection string | the value above |
| Queue name | `ado-changes` |
| Send as non-serialized string | **checked** (the consumer is Node.js, not .NET) |
| Resource details to send | **Minimal** - the app re-reads the work item through the API, so the queue never holds full work-item content |
| Messages to send / Detailed messages to send | None |

Use **Test** in the wizard, then confirm the message arrives (Service Bus Explorer in the portal, or the app's sync log).

Programmatic creation (repeat per event type and project):

```bash
curl -sS -X POST "https://dev.azure.com/$ORG/_apis/hooks/subscriptions?api-version=7.1" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @- <<EOF
{
  "publisherId": "tfs", "eventType": "workitem.updated", "resourceVersion": "1.0",
  "publisherInputs": { "projectId": "<project GUID>" },
  "consumerId": "azureServiceBus", "consumerActionId": "serviceBusQueueSend",
  "consumerInputs": {
    "connectionString": "<Send-only connection string>",
    "queueName": "ado-changes",
    "bypassSerializer": "true",
    "resourceDetailsToSend": "minimal",
    "messagesToSend": "none",
    "detailedMessagesToSend": "none"
  }
}
EOF
```

Event types: `workitem.created`, `workitem.updated`, `workitem.deleted`, `workitem.restored`.

**Storage queue (alternative)** - **Azure Storage → Insert a message in a Storage queue**, account name from the `changeQueueUrl` output, queue `ado-changes`, visibility timeout `0`, TTL `604800`, authentication by service connection, or the account key only under the exception described in section 4.

**Hardening after setup**: when SAS is in use, the namespace-level `RootManageSharedAccessKey` (full Manage rights) is not needed by anyone - delete it so the only key in existence is the queue-scoped Send key:

```bash
az servicebus namespace authorization-rule delete -g $RG --namespace-name <ns> --name RootManageSharedAccessKey
```

Rotate the Send key twice a year: `az servicebus queue authorization-rule keys renew --key SecondaryKey ...`, update the hooks to the secondary connection string, then renew the primary.

## 11. GitHub CI/CD

### Workflows

| Workflow | Trigger | What it enforces |
|---|---|---|
| `ci.yml` | PR, push to `main` | lint, typecheck, tests + coverage; `npm audit --omit=dev --audit-level=high` (blocking) and full audit (report); dependency review (high, copyleft licences); Bicep build + lint, shellcheck, Trivy IaC scan; runtime + migrator image build, hardening assertions (uid 10001, no npm/curl/wget, read-only FS start), CycloneDX SBOMs, Trivy image scan (fixable HIGH/CRITICAL fail; SARIF to code scanning); ZAP baseline DAST against the compose stack (rules in `.github/zap/rules.tsv`) |
| `codeql.yml` | PR, push, weekly | CodeQL `security-extended` for JavaScript/TypeScript and for the workflows themselves |
| `secret-scan.yml` | PR, push, daily | gitleaks over the full git history (`.github/gitleaks.toml`) |
| `deploy.yml` (+ `deploy-environment.yml`) | manual, or `v*.*.*` tags when `DEPLOY_ON_TAG=true` | build once → push to GHCR with SBOM + provenance attestations → Trivy re-scan → per environment: OIDC login, `az acr import` by digest, migration job, revision rollout with health wait, optional in-VNet smoke test |

All third-party actions are pinned to full commit SHAs; Dependabot (`.github/dependabot.yml`) keeps SHAs, npm packages and base images current with a 7-day cooldown.

### One-time repository setup

1. **Settings → Actions → General**: *Allow enterprise, and select non-enterprise, actions* (GitHub-authored + the ones used here); enable *Require actions to be pinned to a full-length commit SHA*; workflow permissions *Read repository contents*; *Require approval for all outside collaborators* on fork PRs.
2. **Settings → Code security**: enable dependency graph, Dependabot alerts + security updates, secret scanning + push protection, private vulnerability reporting. Without GHAS on a private repository, set repository variable `GHAS_ENABLED=false`.
3. **Rulesets → `main`**: require PRs (≥ 1 approval, code-owner review, dismiss stale approvals), block force pushes and deletion, require status checks: `Lint, typecheck, test`, `Dependency audit`, `Dependency review`, `Validate Bicep and IaC`, `Build, scan, SBOM`, `DAST (OWASP ZAP baseline)`, `Analyze (javascript-typescript)`, `Analyze (actions)`, `gitleaks`. Add a tag ruleset restricting who can create `v*` tags.
4. Replace the placeholder teams in `.github/CODEOWNERS`.

### Azure OIDC (no client secrets)

Bicep creates a deployer managed identity `<app>-<env>-id-deploy` with a federated credential for subject `repo:<githubRepository>:environment:<githubEnvironment>` and assigns the custom role *`<app>-<env> deployer`* on the resource group (import images, update app/job image, start the migration job, read status; nothing else). Set `githubRepository` / `githubEnvironment` per environment parameter file (`staging` → GitHub environment `staging`, `prod` → `production`).

If your organisation customised the OIDC subject claim template, adjust the subject accordingly:
`az identity federated-credential update -g $RG --identity-name adom-$ENV-id-deploy -n github-production --subject <custom subject>`.

### GitHub environments

Create `staging` and `production` (**Settings → Environments**):

| Setting | staging | production |
|---|---|---|
| Required reviewers | optional | **≥ 2 from the release approvers team, prevent self-review** |
| Deployment branches and tags | `main` | `main` and tags `v*.*.*` |
| Variables | from the `githubEnvironmentVariables` output of that environment's deployment | same |

Environment variables: `AZURE_CLIENT_ID` (deployer identity), `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `ACR_NAME`, `CONTAINER_APP_NAME`, `MIGRATION_JOB_NAME`.

```bash
az deployment group show -g $RG -n <deployment name> --query properties.outputs.githubEnvironmentVariables.value
```

Repository variables: `DEPLOY_ENABLED=true` (turns the CD template on), `DEPLOY_ON_TAG=true|false`, `SMOKE_TEST_ENABLED=true|false`, `GHAS_ENABLED` (only to set `false`).

### Self-hosted runner for smoke tests

The app is internal, so GitHub-hosted runners can deploy (control plane only) but cannot call it. Smoke tests (`scripts/deploy/smoke-test.sh`: health, 401 on `/api/auth/me`, security headers, HTTP→HTTPS redirect) run on a runner labelled `self-hosted, vnet` with line of sight to the app. Options, in order of preference:

1. **GitHub-hosted runners with Azure private networking** (GitHub Team/Enterprise): VNet-inject a hosted runner pool into `snet-tools`.
2. **Ephemeral runners as a Container Apps job** in this environment (KEDA `github-runner` scaler, one job per workflow run).
3. A small Linux VM in `snet-tools`, registered as an ephemeral/JIT runner in a runner group limited to this repository.

If the custom domain uses an internal CA, set `SMOKE_CA_BUNDLE` on the runner.

## 12. Operations

**Deploy a release**: merge to `main`, then run **Deploy** (`staging`, or `staging-then-production`), or push a `vX.Y.Z` tag with `DEPLOY_ON_TAG=true`. Production waits for environment approval. The same image digest is promoted through both environments.

**Migrations** run before the new revision rolls out, while the previous revision still serves traffic. Migrations must therefore be backwards compatible with the running version (expand → deploy → contract in a later release). A failed migration stops the pipeline; the app is not updated. Inspect:

```kusto
ContainerAppConsoleLogs
| where ContainerName == "migrate"
| project TimeGenerated, ContainerGroupName, Log
| order by TimeGenerated desc
```

**Rollback**: single-revision mode keeps the previous revision serving until the new one is ready, so a revision that never becomes healthy needs no action. To roll back a healthy-but-wrong release, redeploy the previous digest (printed by `deploy-revision.sh`):

```bash
az containerapp update -n adom-prod-app -g $RG --image <acr>.azurecr.io/ado-metrics/runtime@sha256:<previous>
```

Schema changes are not rolled back automatically; restore or write a forward fix.

**Secret rotation**

| Secret | Procedure | Cadence |
|---|---|---|
| `entra-client-secret` | `az ad app credential reset --append` → new KV version → remove old credential after the app restarted | ≤ 6 months (set `--expires`) |
| `database-url` / `migrator-database-url` | `ALTER ROLE ... PASSWORD` → new KV version (app restarts within ~30 min; force with `az containerapp revision restart`) | yearly or on suspicion |
| `session-secret` | new KV version (signs out all users) | yearly or on suspicion |
| Service Bus Send key | see section 10 | 6 months |

**Backups / restore**: PostgreSQL keeps 35 days of point-in-time restore (geo-redundant backup off). Restore to a new server with `az postgres flexible-server restore --source-server <name> --restore-time <UTC>` into the same delegated subnet, then switch the Key Vault connection strings. Test a restore at least once a year (ISO 27001 A.8.13).

**Logs**: all resources send logs to `<app>-<env>-log`. Useful tables: `ContainerAppConsoleLogs` (app and job stdout, JSON), `ContainerAppSystemLogs` (probes, restarts, Key Vault reference errors), `AzureDiagnostics` (Key Vault `AuditEvent`, PostgreSQL, Service Bus), `AzureActivity` (enable subscription Activity Log export separately), `ContainerRegistryLoginEvents`. Alerts (5xx, restarts, PostgreSQL CPU/storage, dead-lettered messages) mail `alertEmailAddresses`.

**Scaling**: 1–3 replicas, HTTP concurrency 50. For < 50 users one replica is plenty; `minReplicas=1` avoids cold starts and keeps the queue consumer running.

## 13. Optional: Azure Front Door + WAF

Only if users must reach the app without VPN. Set `enableFrontDoor=true` and run Phase 2. This deploys Front Door Premium with a WAF policy in **Prevention** mode (Microsoft Default Rule Set 2.1, Bot Manager 1.1, 300 requests/minute per client IP, optional country allow-list) and connects to the internal environment through **Private Link** (the environment's `publicNetworkAccess` is set to `Disabled`; the origin still has no public endpoint).

After deployment, approve the private endpoint connection once:

```bash
az network private-endpoint-connection list -g $RG -n adom-$ENV-cae --type Microsoft.App/managedEnvironments \
  --query "[?properties.privateLinkServiceConnectionState.status=='Pending'].id" -o tsv |
  xargs -r -n1 az network private-endpoint-connection approve --description "AFD" --id
```

Then: add a custom domain with a managed certificate on the Front Door endpoint, set `publicBaseUrl` to it, add `<custom domain>/api/auth/callback` to the Entra app's redirect URIs, and keep Conditional Access (MFA + compliant device) mandatory. `TRUST_PROXY_HOPS` becomes `2` automatically. The HTTP service-hook endpoint `/api/webhooks/ado` becomes reachable only in this setup; the queue remains the recommended path.

Validate this combination in staging first: Front Door → Private Link into a VNet-integrated internal environment is supported for workload-profile environments, and zone-redundant environments must use this private-endpoint method (not Private Link Service).

## 14. Local run with docker compose

```bash
cp .env.example .env       # .env.example is maintained with the backend; fill POSTGRES_PASSWORD, SESSION_SECRET, ...
docker compose up --build -d --wait app
open http://localhost:3000
docker compose logs -f app
docker compose down        # add -v to drop the database volume
```

The compose stack forces `NODE_ENV=development` and `AUTH_MODE=dev` (the app refuses dev auth in production), publishes the app only on `127.0.0.1:3000`, keeps PostgreSQL on an internal-only network, runs migrations as a one-shot `migrate` service before the app starts, and applies the same hardening as production: read-only root filesystem, `/tmp` tmpfs, all capabilities dropped, `no-new-privileges`, non-root user. CI uses the same file for DAST (`scripts/ci/create-dast-env.sh` generates a throwaway `.env`).

## 15. Configuration reference

All configuration is environment variables. Values in **bold** are set by Bicep; secrets come from Key Vault references and never appear in templates or images.

| Variable | Azure value | Notes |
|---|---|---|
| `NODE_ENV` | **`production`** | also baked into the image |
| `PORT` | **`3000`** | ingress target port |
| `LOG_LEVEL` | **`info`** (`logLevel`) | |
| `PUBLIC_BASE_URL` | **`publicBaseUrl`** | used for redirect URIs and absolute links |
| `STATIC_DIR` | `/app/apps/web/dist` | set in the image |
| `TRUST_PROXY_HOPS` | **`1`** (`2` with Front Door) | Container Apps Envoy is one hop |
| `DATABASE_URL` | Key Vault `database-url` | `sslmode=verify-full` |
| `SESSION_SECRET` | Key Vault `session-secret` | ≥ 32 chars |
| `AUTH_MODE` | **`entra`** | `dev` only in docker compose |
| `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` | **parameters** | |
| `ENTRA_CLIENT_SECRET` | Key Vault `entra-client-secret` | |
| `ADO_ORG_URL` | **`adoOrgUrl`** | e.g. `https://dev.azure.com/contoso` |
| `ADO_AUTH` | **`managed-identity`** | `pat` is refused in production |
| `AZURE_CLIENT_ID` | **app identity client ID** | read by `@azure/identity` |
| `ADO_PROJECTS` | **`adoProjects`** (omitted when empty) | comma-separated |
| `SYNC_INTERVAL_SECONDS` | **`10`** | scheduled incremental sync |
| `RETENTION_DAYS` | **`730`** | 2-year retention |
| `WEBHOOK_BASIC_USER` | **`ado-service-hook`** | |
| `WEBHOOK_BASIC_PASSWORD` | Key Vault `webhook-basic-password` | |
| `CHANGE_QUEUE_KIND` | **`servicebus`** \| `storage` | selects the queue client |
| `CHANGE_QUEUE_URL` | **output `changeQueueUrl`** | `https://<ns>.servicebus.windows.net/ado-changes` or `https://<account>.queue.core.windows.net/ado-changes` |

Migration job: `NODE_ENV=production`, `DATABASE_URL` from Key Vault `migrator-database-url`.

### Runtime contract the application relies on

The platform assumes the following of the app; changes to any of these need a platform review.

- **Change queue**: `CHANGE_QUEUE_KIND=servicebus` → `@azure/service-bus` `ServiceBusClient(<host of CHANGE_QUEUE_URL>, credential)` receiving from the queue named by the URL path, peek-lock, complete after the DB commit, abandon on failure (dead-letter after 10 deliveries). `storage` → `@azure/storage-queue` `QueueClient(CHANGE_QUEUE_URL, credential)`, delete after processing. Credential: `ManagedIdentityCredential` / `DefaultAzureCredential` with `AZURE_CLIENT_ID`. Messages are at-least-once and may arrive out of order or duplicated; they carry minimal resource details, so the app re-reads the work item by ID. `CHANGE_QUEUE_KIND=none` disables the consumer (local dev); a queue kind without a valid https `CHANGE_QUEUE_URL` makes the app refuse to start. Implemented in `apps/api/src/sync/change-queue.consumer.ts`.
- **Multiple replicas (1–3)**: sessions are stored in PostgreSQL, not in memory; scheduled work (full sync, retention purge) takes a PostgreSQL advisory lock so only one replica runs it; queue consumers may run on every replica.
- **Health**: `/api/health/live` never touches dependencies; `/api/health/ready` checks the database only (not Azure DevOps or the queue), so an Azure DevOps outage does not take the app out of rotation. Both are unauthenticated and exempt from rate limiting.
- **Shutdown**: on `SIGTERM` (forwarded by tini) the app stops receiving queue messages, drains in-flight requests and disconnects Prisma within 30 seconds (`terminationGracePeriodSeconds`).
- **Filesystem**: writes only to `/tmp` (`os.tmpdir()`); logs as JSON to stdout.
- **Proxy**: `trust proxy` = `TRUST_PROXY_HOPS` so `req.secure` / `req.ip` are correct behind Envoy (required for the `__Host-` cookie).
- **Migrations**: no `CREATE EXTENSION` (the DBA installs extensions), backwards compatible with the previous release; `prisma.config.ts` must only import packages present in the api workspace's dependencies.
- **Build output**: everything the API needs at runtime is inside `apps/api/dist` (copy non-TypeScript files of the generated Prisma client via `nest-cli.json` assets if there are any) plus production `node_modules` and `packages/shared/dist`.

## 16. Security controls by OSI layer

Infrastructure-side controls; application-layer controls (authN/Z, CSRF, input validation, output encoding, audit log, rate limiting) are in [`SECURITY.md`](../SECURITY.md).

| Layer | Threats | Controls | Evidence |
|---|---|---|---|
| **L1 Physical** | Physical access, hardware theft | Azure datacentres: perimeter, biometric access, CCTV, media destruction (Microsoft responsibility under the shared-responsibility model) | Microsoft SOC 2 Type II, ISO 27001/27017/27018 reports (Service Trust Portal) |
| **L2 Data link** | MAC spoofing, ARP poisoning, VLAN hopping | Azure SDN: hypervisor-enforced tenant isolation, no L2 adjacency between tenants or broadcast; IEEE 802.1AE MACsec between Microsoft datacentres | Microsoft SOC 2 / ISO reports; Azure network security whitepaper |
| **L3 Network** | Direct internet reachability, lateral movement, IP spoofing | No public IPs on any workload; internal-only Container Apps environment; private endpoints for Key Vault, ACR (+ Storage queue); PostgreSQL with private VNet access and `publicNetworkAccess=Disabled`; NSG per subnet with explicit `DenyInternetInbound`; PostgreSQL NSG allows 5432 only from the app/tools subnets (+ declared DBA ranges); optional ingress IP allow-list (`allowedIngressCidrs`); ACR export policy disabled; Azure DDoS infrastructure protection (platform) | Bicep `infra/modules/network.bicep`; NSG diagnostic logs in Log Analytics; `az network nsg rule list` |
| **L4 Transport** | Port scanning, SYN floods, unintended services | Single ingress port (443; 80 only redirects); app port 3000 only inside the environment; NSG port restrictions (443 / 5432 / 5671-5672); PostgreSQL `connection_throttle.enable=on`; Front Door absorbs volumetric L4 attacks when enabled; Azure DDoS Network Protection available as an add-on for the hub VNet | NSG rules; Container Apps ingress config |
| **L5 Session** | Session hijacking, fixation, replay | TLS session handling at the managed ingress (no session renegotiation exposure); server-side sessions in an `HttpOnly; Secure; SameSite=Lax` `__Host-` cookie; `SESSION_SECRET` from Key Vault with rotation; Entra ID token lifetimes + Conditional Access; idle/absolute session timeouts (SECURITY.md) | `docs/API.md` conventions; ZAP cookie rules (FAIL on missing HttpOnly/SameSite) |
| **L6 Presentation** | Eavesdropping, downgrade, data-at-rest disclosure | TLS 1.2+ everywhere: Container Apps ingress (HTTPS only, `allowInsecure=false`), PostgreSQL `require_secure_transport=on` + `ssl_min_protocol_version=TLSv1.2` + `verify-full` from the app, Key Vault / ACR / Service Bus / Storage `minimumTlsVersion 1.2`; peer-traffic encryption between replicas in the environment; encryption at rest with AES-256 (PostgreSQL storage and backups, Key Vault, ACR, Service Bus, Storage with infrastructure double encryption); CMK available on PostgreSQL if required | Bicep properties; `az postgres flexible-server parameter show -n require_secure_transport` |
| **L7 Application** | OWASP Top 10, bots, abuse | Optional Front Door WAF (DRS 2.1, Bot Manager, rate limit, geo filter); app-level controls per SECURITY.md (Entra ID SSO with app roles and assignment required, CSRF header, zod validation, Helmet headers/CSP, throttling, RFC 9457 errors, audit log); supply chain: SHA-pinned actions, `npm audit`, dependency review, CodeQL, gitleaks, Trivy, SBOM + SLSA provenance, non-root read-only image without package manager; DAST (ZAP) on every PR; smoke test asserts security headers in each environment | CI run history, SARIF in code scanning, SBOM artifacts, attestations (`gh attestation verify`) |

Cross-cutting (ISO 27001 / SOC 2):

| Control area | Implementation |
|---|---|
| Identity & access (A.5.15–5.18, A.8.2 / CC6.1–6.3) | Managed identities, no shared keys except the queue-scoped Send SAS; secret-scoped Key Vault RBAC; custom least-privilege deployer role; OIDC federation; Entra-only human DB access; assignment-required app |
| Logging & monitoring (A.8.15–8.16 / CC7.2) | Diagnostic settings on every resource → Log Analytics (730 days, local auth disabled, query audit on); PostgreSQL connection + pgaudit logs; Key Vault AuditEvent; baseline metric alerts |
| Change management (A.8.32 / CC8.1) | PR + code-owner review, required checks, protected environments with approvers, immutable image digests, what-if before infra changes, IaC in git |
| Vulnerability management (A.8.8 / CC7.1) | Dependabot, npm audit, Trivy (image + IaC), CodeQL, ZAP, weekly/daily scheduled scans |
| Backup & recovery (A.8.13 / A1.2) | 35-day PITR, delete locks in prod, Key Vault soft delete 90 days + purge protection |
| Data retention (A.5.33 / C1.2) | `RETENTION_DAYS=730` in the app, Log Analytics 730 days, queue TTL 7 days, ACR untagged-manifest retention 30 days |
| Secrets management (A.8.24 / CC6.1) | Key Vault only, values set out-of-band, rotation table above, no secrets in images (`.dockerignore`, gitleaks) |

## 17. Cost notes

Approximate pay-as-you-go list prices per environment per month (USD, West Europe, October 2026). Validate with the Azure pricing calculator.

| Resource | Default | ~Cost | Cheaper option |
|---|---|---|---|
| Container Apps (Consumption, 1 × 0.5 vCPU / 1 GiB always on) | | 20–35 | |
| PostgreSQL Flexible B2ms + 32 GB | | 30–40 | B1ms for dev/test; HA (GeneralPurpose) roughly doubles+ |
| ACR **Premium** | private endpoint | ~50 | Standard (~20): public endpoint, RBAC only (see `registry.bicep`) |
| Service Bus Standard | | ~10 | Premium (~680) only if the app side must be private |
| Private endpoints (KV, ACR [, queue]) | 2–3 × ~7.5 | ~15–25 | |
| Log Analytics (ingestion ~1–3 GB + 730-day retention) | | 5–15 | Retention beyond 31 days is billed per GB-month; for large volumes move audit tables to long-term retention |
| Front Door Premium (optional) | off | ~330 + requests | |
| Defender for Cloud plans (recommended) | not deployed | varies | |

## 18. Hardening backlog and known limitations

- **Egress control**: outbound traffic currently uses the platform default. For full egress filtering, route `snet-aca` through Azure Firewall (UDR) with an FQDN allow-list: `dev.azure.com`, `*.vssps.visualstudio.com`, `login.microsoftonline.com`, `<ns>.servicebus.windows.net`, `mcr.microsoft.com`, plus the [Container Apps required FQDNs](https://learn.microsoft.com/azure/container-apps/use-azure-firewall).
- **VNet flow logs**: enable for the spoke VNet (Network Watcher → flow logs → Traffic Analytics) for L3/L4 forensics.
- **Subscription level** (outside this template): Activity Log export to the workspace, Defender for Cloud (Containers, Key Vault, open-source databases, Resource Manager), Azure Policy initiatives (e.g. *Microsoft cloud security benchmark*, deny public network access), budget alerts.
- **Read-only root filesystem**: enforced in docker compose; Azure Container Apps has no `readOnlyRootFilesystem` setting, so in Azure the guarantee is that the image's files are root-owned and the process runs as uid 10001 (it cannot modify them), with `/tmp` on an `EmptyDir` volume.
- **Base image digest**: the Dockerfile pins `node:24.22.1-alpine3.24` by tag; pin by digest (`FROM node:<tag>@sha256:...`) once Renovate/Dependabot digest updates are in place.
- **Entra client secret**: prefer a certificate credential or a managed-identity federated credential on the app registration once the backend supports client assertions.
- **Key Vault references with private Key Vault**: Container Apps resolves them through the VNet-integrated environment; the private endpoint and the `privatelink.vaultcore.azure.net` zone link must exist before Phase 2 (they are created in Phase 1).
- **Bicep validation**: the template is compiled and linted in CI (`infra-validate` job). Always review the what-if output before applying.
