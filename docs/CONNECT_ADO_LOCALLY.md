# Connect a real Azure DevOps organisation (local)

How to point a local copy of Delivery Insights at your real Azure DevOps organisation with a
read-only Personal Access Token (PAT). Production never uses a PAT: it uses a managed identity
(see [DEPLOYMENT.md](DEPLOYMENT.md)), and the app refuses to start with `ADO_AUTH=pat` in production.

## 1. Create the PAT

In Azure DevOps: **User settings (top right) → Personal access tokens → New Token**.

| Setting | Value |
|---|---|
| Name | `delivery-insights-local` |
| Organization | your organisation only (not "All accessible organizations") |
| Expiration | 30 days or less |
| Scopes | **Custom defined**, then only **Work Items: Read** and **Project and Team: Read** |

Nothing else is needed. The app only reads: projects, teams and members, sprints, area paths,
work item types and states, and the work item revisions feed. Copy the token once; Azure DevOps
won't show it again.

The PAT acts as **you**, so the app sees exactly the projects you can see.

## 2. Put the values in `.env`

Edit `.env` in the repository root (it is git-ignored and should stay `chmod 600`). Never paste the
PAT into chat, a ticket or a commit.

```dotenv
ADO_ORG_URL=https://dev.azure.com/<your-org>
ADO_AUTH=pat
ADO_PAT=<the token>
# Start with one project; empty means every project the PAT can read.
ADO_PROJECTS=<Project Name>
# First run: 6 months of history keeps the first sync short. Raise to 730 (2 years) later.
SYNC_LOOKBACK_DAYS=180
```

Leave `SYNC_DISABLED=true` for now.

## 3. Check the connection (read-only)

```bash
npm run build -w @ado-metrics/api
npm run ado:check -w @ado-metrics/api
```

Every line should say `ok`. The check prints names, counts and HTTP statuses only, never the token
or work item content.

| Failure | Meaning |
|---|---|
| `ADO_PAT is empty` | `.env` not saved, or the value is on the wrong line |
| `HTTP 401` or a redirect error | Token mistyped, expired, or created for another organisation |
| `HTTP 403` | A scope is missing (needs Work Items: Read and Project and Team: Read) |
| `HTTP 404` on List projects | `ADO_ORG_URL` is wrong (it is `https://dev.azure.com/<org>`, with no project) |
| `"X" is not visible` | `ADO_PROJECTS` name is misspelt, or you don't have access to that project |

## 4. Turn on sync

Set `SYNC_DISABLED=false` in `.env`, then start the app the way you run it.

**Homebrew Postgres (no Docker):**

```bash
npm run start:local
```

**Docker:** start Docker Desktop once and accept its terms, so `docker` is on your PATH. Both
options use port 3000, so stop `npm run start:local` first. Then:

```bash
docker compose up --build -d --wait app
```

To run the connection check inside the container:

```bash
docker compose run --rm --no-deps app node apps/api/dist/scripts/check-ado.js
```

The compose stack has its own database (`POSTGRES_PASSWORD` in `.env`), separate from Homebrew
Postgres, so it starts empty: the first sync fills it, and `seed-demo.js` can add the demo project.

The first sync starts within a minute. Follow it under **Admin → Sync** at http://localhost:3000
(sign in as *Ada Admin*), or in the logs (`docker compose logs -f app` for Docker). After it finishes,
sign out and back in so the other personas see the new project. Later syncs are incremental, every
`SYNC_INTERVAL_SECONDS`.

## 5. Things to know

- **Real data on your laptop.** The local database now holds confidential work item history. Keep
  FileVault on and don't share database dumps.
- **Per-person views.** Dev personas aren't real ADO users, so "my metrics" don't match anyone.
  The Manager and Admin personas see everyone, as designed.
- **Near-real-time updates** (the Service Bus change queue) only exist in Azure. Locally the app
  syncs on its timer, and **Admin → Sync → Run sync** starts one immediately.
- **When you're done**, revoke the PAT in Azure DevOps, or let it expire.
