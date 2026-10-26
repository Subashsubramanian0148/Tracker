/**
 * Generates a realistic Scrum demo project ("Team 2") so the app can be explored without an
 * Azure DevOps connection. Local development only; refuses to run in production.
 *
 *   npm run build -w @ado-metrics/api && npm run seed:demo -w @ado-metrics/api
 */
import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { RevisionSnapshot } from '../ado/fields';
import { ConfigModule } from '../config/config.module';
import { Prisma } from '../generated/prisma/client';
import { commentSignals } from '../metrics/engine/comment-signals';
import { DAY_MS } from '../metrics/engine/stats';

import { WorkItemProcessor } from '../metrics/work-item-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

const PROJECT_ID = '5c1e0f2a-8b7d-4c3e-9a1f-2d3b4c5e6f70';
const PROJECT = 'Team 2';
const TEAMS = [
  { id: '7a2b3c4d-1e2f-4a5b-8c6d-7e8f9a0b1c2d', name: 'Web Squad', area: `${PROJECT}\\Web` },
  { id: '8b3c4d5e-2f3a-4b6c-9d7e-8f9a0b1c2d3e', name: 'Platform Squad', area: `${PROJECT}\\Platform` },
];
// The design team's three members; everyone works across both areas.
const PEOPLE = [
  { id: 'p-arunvijayan', displayName: 'Arunvijayan', uniqueName: 'arunvijayan@contoso.dev', team: 0, admin: true },
  { id: 'p-vairoshini', displayName: 'Vairoshini', uniqueName: 'vairoshini@contoso.dev', team: 0 },
  { id: 'p-subash', displayName: 'Subash', uniqueName: 'subash@contoso.dev', team: 1, admin: true },
];
const MANAGER = { id: 'p-meera', displayName: 'Meera Iyer', uniqueName: 'meera.iyer@contoso.dev' };

const STATES: Record<string, [string, string][]> = {
  'Product Backlog Item': [['New', 'Proposed'], ['Approved', 'Proposed'], ['Committed', 'InProgress'], ['Done', 'Completed'], ['Removed', 'Removed']],
  Bug: [['New', 'Proposed'], ['Approved', 'Proposed'], ['Committed', 'InProgress'], ['Done', 'Completed'], ['Removed', 'Removed']],
  Feature: [['New', 'Proposed'], ['In Progress', 'InProgress'], ['Done', 'Completed'], ['Removed', 'Removed']],
};

const TITLES = [
  'Fix login bug with Google SSO', 'Design new project creation modal', 'Update colour palette for accessibility',
  'Refactor API client calls', 'Improve search relevance', 'Write unit tests for billing',
  'Add CSV export to reports', 'Paginate audit history', 'Cache dashboard queries', 'Support dark mode',
  'Migrate auth to Entra ID', 'Rate-limit public endpoints', 'Add retry to webhook delivery', 'Onboarding checklist',
  'Invite teammates by email', 'Notification preferences page', 'Optimise image uploads', 'Two-step approval flow',
  'Timeline view for milestones', 'Bulk edit work items', 'Keyboard shortcuts', 'Localise date formats',
  'Archive old projects', 'Health check endpoint', 'Usage analytics events', 'SAML metadata import',
  'Role-based navigation', 'Slack integration', 'Fix timezone offset in reports', 'Reduce bundle size',
  'Password-less sign-in', 'Session timeout warning', 'Upgrade database driver', 'Background job retries',
  'Feature flags service', 'Customer feedback widget', 'Quarterly report template', 'Inline comment mentions',
];
const BUG_TITLES = [
  '401 after token refresh', 'Chart tooltip clipped on Safari', 'Duplicate rows in export', 'Wrong sprint shown on board',
  'Crash when description empty', 'Filter resets on back navigation', 'Avatar missing for new users', 'Slow query on delays page',
  'Date picker off by one day', 'Memory leak in poller', 'Broken link in email footer', 'Search ignores accents',
];
const FEATURES = ['Self-service onboarding', 'Enterprise SSO', 'Reporting 2.0', 'Platform reliability'];

/** Deterministic PRNG so every developer sees the same demo data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261022);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + rand() * (b - a);
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);

interface Step {
  at: Date;
  by: string;
  set: Partial<RevisionSnapshot>;
}

interface Sprint {
  id: string;
  name: string;
  path: string;
  start: Date;
  finish: Date;
}

function sprints(now: Date): Sprint[] {
  // Sprint 10 is the current one; two-week sprints ending on Fridays.
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const currentStart = new Date(monday.getTime() - 7 * DAY_MS);
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const start = new Date(currentStart.getTime() + (n - 10) * 14 * DAY_MS);
    return {
      id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      name: `Sprint ${n}`,
      path: `${PROJECT}\\Sprint ${n}`,
      start,
      finish: new Date(start.getTime() + 11 * DAY_MS),
    };
  });
}

function buildItem(id: number, sprint: Sprint | null, next: Sprint | null, now: Date, featureId: number | null, isBug: boolean) {
  const team = chance(0.55) ? 0 : 1;
  const assignee = pick(PEOPLE);
  const creator = pick(PEOPLE);
  const type = isBug ? 'Bug' : 'Product Backlog Item';
  const title = isBug ? pick(BUG_TITLES) : pick(TITLES);
  const effort = pick([1, 2, 3, 5, 5, 8, 13]);
  const estimateHours = chance(0.55) ? Math.round(effort * between(4, 8)) : null;
  const description = `As a user I want to ${title.toLowerCase()} so that my work is easier.`;
  const steps: Step[] = [];
  const createdAt = sprint ? new Date(sprint.start.getTime() - between(2, 20) * DAY_MS) : new Date(now.getTime() - between(1, 60) * DAY_MS);
  const base: Partial<RevisionSnapshot> = {
    type,
    title,
    state: 'New',
    areaPath: TEAMS[team]!.area,
    iterationPath: PROJECT,
    createdDate: createdAt.toISOString(),
    effort,
    originalEstimate: estimateHours,
    remainingWork: estimateHours,
    parentId: featureId,
    descriptionHash: hash(description),
    tags: isBug ? ['bug'] : [],
  };
  steps.push({ at: createdAt, by: creator.id, set: base });
  const push = (at: Date, set: Partial<RevisionSnapshot>, by = assignee.id) => {
    if (at.getTime() <= now.getTime()) steps.push({ at, by, set });
  };

  if (!sprint) {
    if (chance(0.5)) push(new Date(createdAt.getTime() + between(1, 5) * DAY_MS), { state: 'Approved' });
    return { type, steps, description };
  }

  const addedMid = chance(0.15);
  const planAt = addedMid
    ? new Date(sprint.start.getTime() + between(2, 6) * DAY_MS)
    : new Date(sprint.start.getTime() - between(0.2, 2) * DAY_MS);
  push(new Date(Math.max(createdAt.getTime() + DAY_MS, planAt.getTime() - DAY_MS)), { state: 'Approved' }, creator.id);
  push(planAt, { iterationPath: sprint.path, assignedTo: { id: assignee.id, displayName: assignee.displayName, uniqueName: assignee.uniqueName } }, PEOPLE[team === 0 ? 0 : 2]!.id);

  const startAt = new Date(Math.max(planAt.getTime(), sprint.start.getTime()) + between(0.1, 3) * DAY_MS);
  push(startAt, { state: 'Committed' });

  let t = startAt.getTime();
  if (chance(0.15)) push(new Date((t += between(0.5, 2) * DAY_MS)), { effort: effort + pick([2, 3, 5]) }, PEOPLE[team === 0 ? 0 : 2]!.id);
  if (chance(0.12)) push(new Date((t += between(0.5, 2) * DAY_MS)), { descriptionHash: hash(`${description} (updated scope)`) }, creator.id);
  if (chance(0.1)) {
    const other = pick(PEOPLE.filter((m) => m.id !== assignee.id));
    push(new Date((t += between(0.5, 2) * DAY_MS)), { assignedTo: { id: other.id, displayName: other.displayName, uniqueName: other.uniqueName } });
  }
  if (chance(0.12)) {
    push(new Date((t += between(0.2, 1) * DAY_MS)), { blocked: true, tags: [...(base.tags ?? []), 'Blocked'] });
    push(new Date(t + between(1, 4.5) * DAY_MS), { blocked: false, tags: base.tags ?? [] });
  }

  const cycleDays = Math.min(between(1.5, 6) * (effort >= 8 ? 1.8 : 1) * (chance(0.15) ? 2.5 : 1), 30);
  const doneAt = new Date(startAt.getTime() + cycleDays * DAY_MS);
  const carry = doneAt.getTime() > sprint.finish.getTime() + DAY_MS && next;
  if (carry) push(new Date(sprint.finish.getTime() + between(0.5, 2.5) * DAY_MS), { iterationPath: next.path }, PEOPLE[team === 0 ? 0 : 2]!.id);

  const actual = estimateHours ? Math.round(estimateHours * between(0.7, 1.9)) : null;
  push(doneAt, { state: 'Done', remainingWork: estimateHours ? 0 : null, completedWork: actual });
  if (chance(0.06) && doneAt.getTime() < now.getTime() - 3 * DAY_MS) {
    push(new Date(doneAt.getTime() + between(0.5, 2) * DAY_MS), { state: 'Committed' });
    push(new Date(doneAt.getTime() + between(2.5, 4) * DAY_MS), { state: 'Done' });
  }
  return { type, steps, description };
}

@Module({ imports: [ConfigModule, PrismaModule], providers: [WorkItemProcessor] })
class SeedModule {}

/** Azure DevOps-style discussion, so the comment keywords (reopen, blocked, done) have something to read. */
async function seedComments(prisma: PrismaService, now: Date) {
  const items = await prisma.workItem.findMany({
    where: { projectId: PROJECT_ID, type: { not: 'Feature' }, activatedDate: { not: null } },
    select: { id: true, assignedToId: true, activatedDate: true, completedDate: true, reopenCount: true },
  });
  const rows: Prisma.WorkItemCommentCreateManyInput[] = [];
  for (const item of items) {
    const author = PEOPLE.find((p) => p.id === item.assignedToId) ?? pick(PEOPLE);
    const reviewer = pick(PEOPLE.filter((p) => p.id !== author.id));
    const start = item.activatedDate!.getTime();
    const end = (item.completedDate ?? now).getTime();
    const add = (who: typeof author, atMs: number, text: string) => {
      if (atMs > end || atMs > now.getTime()) return;
      rows.push({
        workItemId: item.id, commentId: rows.filter((r) => r.workItemId === item.id).length + 1, projectId: PROJECT_ID,
        authorId: who.id, authorName: who.displayName, authorUniqueName: who.uniqueName,
        text, signals: commentSignals(text), createdAt: new Date(atMs),
      });
    };
    add(author, start + 0.2 * DAY_MS, pick(['Started on the first round of mockups.', 'Picking this up today.', 'Kicked off, sharing early sketches soon.']));
    if (item.reopenCount > 0 || chance(0.15)) {
      add(reviewer, start + 2 * DAY_MS, pick(['Reopening this, the spacing on mobile is off.', 'Sent back for changes: the empty state copy is missing.', 'Needs rework, the contrast fails on the secondary button.']));
    }
    if (chance(0.2)) {
      const at = start + between(1, 3) * DAY_MS;
      add(author, at, pick(['Blocked: waiting on copy from marketing.', 'On hold until the API contract is agreed.', 'Waiting for the brand team to approve the illustrations.']));
      if (chance(0.6)) add(author, at + between(1, 4) * DAY_MS, pick(['Unblocked now, copy arrived.', 'No longer blocked, contract signed off.']));
    }
    if (item.completedDate) {
      add(author, end - 0.2 * DAY_MS, pick(['Completed and handed off to dev.', 'Done, final files are in Figma.', 'Design signed off by the PM.']));
    } else if (chance(0.12)) {
      add(author, now.getTime() - between(3, 6) * DAY_MS, 'Design is done, ready for dev.');
    }
  }
  await prisma.workItemComment.createMany({ data: rows });
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('seed:demo refuses to run in production');
  const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const processor = app.get(WorkItemProcessor);
  const now = new Date();
  const allSprints = sprints(now);

  await prisma.workItem.deleteMany({ where: { projectId: PROJECT_ID } });
  await prisma.project.upsert({
    where: { id: PROJECT_ID },
    create: { id: PROJECT_ID, name: PROJECT, description: 'Demo data (generated locally)' },
    update: { description: 'Demo data (generated locally)' },
  });
  for (const [type, states] of Object.entries(STATES)) {
    for (const [state, category] of states) {
      await prisma.workItemTypeState.upsert({
        where: { projectId_workItemType_state: { projectId: PROJECT_ID, workItemType: type, state } },
        create: { projectId: PROJECT_ID, workItemType: type, state, category },
        update: { category },
      });
    }
  }
  for (const p of [...PEOPLE, MANAGER]) {
    await prisma.person.upsert({ where: { id: p.id }, create: { id: p.id, displayName: p.displayName, uniqueName: p.uniqueName }, update: {} });
  }
  for (const s of allSprints) {
    await prisma.iteration.upsert({
      where: { id: s.id },
      create: { id: s.id, projectId: PROJECT_ID, name: s.name, path: s.path, startDate: s.start, finishDate: s.finish },
      update: { startDate: s.start, finishDate: s.finish },
    });
  }
  for (const [i, team] of TEAMS.entries()) {
    await prisma.team.upsert({ where: { id: team.id }, create: { id: team.id, projectId: PROJECT_ID, name: team.name }, update: {} });
    await prisma.teamArea.deleteMany({ where: { teamId: team.id } });
    await prisma.teamArea.create({ data: { teamId: team.id, areaPath: team.area, includeChildren: true } });
    await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
    await prisma.teamMember.createMany({
      data: PEOPLE.filter((p) => p.team === i).map((p) => ({ teamId: team.id, personId: p.id, isTeamAdmin: Boolean(p.admin) })),
    });
    await prisma.teamIteration.deleteMany({ where: { teamId: team.id } });
    await prisma.teamIteration.createMany({ data: allSprints.map((s) => ({ teamId: team.id, iterationId: s.id })) });
  }

  // Features first (parents), then PBIs/bugs spread over sprints 1-11 plus a backlog.
  let nextId = 1001;
  const all: { id: number; type: string; steps: Step[]; description: string }[] = [];
  const featureIds: number[] = [];
  for (const name of FEATURES) {
    const id = nextId++;
    featureIds.push(id);
    const created = new Date(allSprints[0]!.start.getTime() - 10 * DAY_MS);
    all.push({
      id,
      type: 'Feature',
      description: `${name} feature`,
      steps: [
        { at: created, by: MANAGER.id, set: { type: 'Feature', title: name, state: 'New', areaPath: PROJECT, iterationPath: PROJECT, createdDate: created.toISOString(), tags: [] } },
        { at: new Date(created.getTime() + 12 * DAY_MS), by: MANAGER.id, set: { state: 'In Progress' } },
      ],
    });
  }
  for (let s = 0; s < 11; s++) {
    const count = s === 10 ? 6 : Math.round(between(8, 12));
    for (let k = 0; k < count; k++) {
      const id = nextId++;
      all.push({ id, ...buildItem(id, allSprints[s]!, allSprints[s + 1] ?? null, now, chance(0.7) ? pick(featureIds) : null, chance(0.22)) });
    }
  }
  for (let k = 0; k < 14; k++) {
    const id = nextId++;
    all.push({ id, ...buildItem(id, null, null, now, chance(0.5) ? pick(featureIds) : null, chance(0.3)) });
  }

  const revisionRows: Prisma.WorkItemRevisionCreateManyInput[] = [];
  const stubRows: Prisma.WorkItemCreateManyInput[] = [];
  const latestText = new Map<number, { rev: number; description: string | null; acceptanceCriteria: string | null }>();
  for (const item of all) {
    const steps = item.steps.sort((a, b) => a.at.getTime() - b.at.getTime());
    let snapshot = {
      type: item.type, title: '', state: 'New', reason: null, assignedTo: null, iterationPath: null, areaPath: null,
      createdDate: steps[0]!.at.toISOString(), tags: [], parentId: null, effort: null, originalEstimate: null,
      remainingWork: null, completedWork: null, blocked: false, descriptionHash: null, acceptanceCriteriaHash: null, isDeleted: false,
    } as RevisionSnapshot;
    steps.forEach((step, i) => {
      snapshot = { ...snapshot, ...step.set };
      revisionRows.push({
        workItemId: item.id,
        rev: i + 1,
        projectId: PROJECT_ID,
        changedDate: step.at,
        changedById: step.by,
        fields: snapshot as unknown as Prisma.InputJsonValue,
      });
    });
    stubRows.push({
      id: item.id, projectId: PROJECT_ID, type: item.type, title: snapshot.title, state: snapshot.state,
      stateCategory: 'Proposed', createdDate: steps[0]!.at, changedDate: steps[steps.length - 1]!.at, rev: steps.length,
    });
    latestText.set(item.id, { rev: steps.length, description: item.description, acceptanceCriteria: 'Given the feature is enabled, when a user uses it, then it works as described.' });
  }
  await prisma.workItem.createMany({ data: stubRows });
  await prisma.workItemRevision.createMany({ data: revisionRows });
  await processor.processItems(PROJECT_ID, all.map((i) => i.id), latestText);
  await seedComments(prisma, now);
  await processor.recomputeDelays(PROJECT_ID, now);

  // Explain roughly half of the delayed items so every dashboard state is visible.
  const categories = await prisma.delayCategory.findMany({ where: { active: true } });
  const delayed = await prisma.workItem.findMany({ where: { projectId: PROJECT_ID, isDelayed: true }, select: { id: true, assignedToId: true } });
  for (const item of delayed) {
    if (!chance(0.5) || categories.length === 0) continue;
    const author = PEOPLE.find((p) => p.id === item.assignedToId) ?? PEOPLE[0]!;
    await prisma.delayReason.create({
      data: {
        workItemId: item.id,
        categoryId: pick(categories).id,
        comment: pick([
          'Waiting on the platform team to expose the new endpoint.',
          'Acceptance criteria changed after the sprint review with the product owner.',
          'Test environment was down for two days.',
          'Original estimate missed the data migration work.',
          'Developer was on planned leave during the sprint.',
        ]),
        impactDays: Math.round(between(1, 5)),
        createdById: `dev-${author.id}`,
        createdByName: author.displayName,
      },
    });
  }
  await prisma.project.update({ where: { id: PROJECT_ID }, data: { lastSyncedAt: now } });

  const counts = { workItems: all.length, revisions: revisionRows.length, delayed: delayed.length };
  process.stdout.write(`Demo project "${PROJECT}" seeded: ${JSON.stringify(counts)}\n`);
  await app.close();
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
