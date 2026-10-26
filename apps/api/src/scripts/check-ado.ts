/**
 * Read-only connection check for Azure DevOps: verifies the configured credential can read
 * projects, teams, sprints, work item types and the revisions feed, without writing anything.
 *
 *   npm run ado:check -w @ado-metrics/api
 *
 * Never prints the PAT or any work item content; only names, counts and HTTP statuses.
 */
import 'reflect-metadata';
import { AdoClient, AdoRequestError } from '../ado/ado.client';
import { loadConfig } from '../config/config';

const print = (line: string) => process.stdout.write(`${line}\n`);

const HINTS: Record<number, string> = {
  401: 'the PAT is invalid, expired or for a different organisation',
  403: 'the PAT is missing a scope (needs Work Items: Read and Project and Team: Read)',
  404: 'ADO_ORG_URL is wrong, or the project is not visible to this identity',
};

function explain(err: unknown): string {
  if (err instanceof AdoRequestError) return `HTTP ${err.status}: ${HINTS[err.status] ?? err.message}`;
  // Azure DevOps answers an invalid PAT with a redirect to its sign-in page rather than a 401.
  return `${err instanceof Error ? err.message : String(err)} (usually an invalid or expired PAT)`;
}

async function step<T>(label: string, fn: () => Promise<T>, describe: (v: T) => string): Promise<T | null> {
  try {
    const value = await fn();
    print(`  ok    ${label}: ${describe(value)}`);
    return value;
  } catch (err) {
    print(`  FAIL  ${label}: ${explain(err)}`);
    process.exitCode = 1;
    return null;
  }
}

async function main() {
  const config = loadConfig();
  if (config.isProduction) throw new Error('ado:check is a local diagnostic; do not run it in production');
  if (config.ADO_AUTH === 'pat' && !config.ADO_PAT) throw new Error('ADO_PAT is empty in .env');
  const ado = new AdoClient(config);
  print(`Checking ${config.ADO_ORG_URL} with ADO_AUTH=${config.ADO_AUTH}`);

  const projects = await step('List projects', () => ado.listProjects(), (p) => `${p.length} visible`);
  if (!projects) return;

  const allow = new Set(config.ADO_PROJECTS.map((p) => p.toLowerCase()));
  const selected = projects.filter((p) => allow.size === 0 || allow.has(p.name.toLowerCase()) || allow.has(p.id));
  for (const name of config.ADO_PROJECTS) {
    if (!projects.some((p) => p.name.toLowerCase() === name.toLowerCase() || p.id === name)) {
      print(`  FAIL  ADO_PROJECTS: "${name}" is not visible to this identity`);
      process.exitCode = 1;
    }
  }
  print(`Projects to sync: ${selected.map((p) => p.name).join(', ') || '(none)'}`);

  for (const p of selected) {
    print(`\n${p.name}`);
    const teams = await step('Teams', () => ado.listTeams(p.id), (t) => `${t.length}`);
    const team = teams?.[0];
    if (team) {
      await step(`Team members (${team.name})`, () => ado.listTeamMembers(p.id, team.id), (m) => `${m.length}`);
      await step(`Sprints (${team.name})`, () => ado.listTeamIterations(p.id, team.id), (i) => `${i.length}`);
      await step(`Area paths (${team.name})`, () => ado.getTeamFieldValues(p.id, team.id), () => 'readable');
    }
    const types = await step('Work item types', () => ado.listWorkItemTypes(p.id), (t) => t.map((x) => x.name).join(', '));
    if (types?.[0]) {
      await step(`States (${types[0].name})`, () => ado.listWorkItemTypeStates(p.id, types[0]!.name), (s) => `${s.length}`);
    }
    const since = new Date(Date.now() - 7 * 24 * 3600_000);
    await step(
      'Revisions feed (last 7 days, first batch)',
      () => ado.reportingRevisions(p.id, { startDateTime: since }),
      (r) => `${r.values.length} revisions`,
    );
  }

  print(process.exitCode ? '\nSome checks failed; fix them before enabling sync.' : '\nAll checks passed. You can enable sync.');
}

main().catch((err: unknown) => {
  process.stderr.write(`ado:check failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
