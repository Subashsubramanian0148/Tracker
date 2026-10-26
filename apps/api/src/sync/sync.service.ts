import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SyncRun as SyncRunDto, Paged } from '@ado-metrics/shared';
import { AdoClient } from '../ado/ado.client';
import {
  htmlToPlain,
  normalizeRevision,
  type NormalizedRevision,
  type PersonSnapshot,
} from '../ado/fields';
import { APP_CONFIG, AppConfig } from '../config/config';
import { Prisma } from '../generated/prisma/client';
import { commentSignals } from '../metrics/engine/comment-signals';
import { DELIVERY_TYPES } from '../metrics/engine/delays';
import { DAY_MS } from '../metrics/engine/stats';
import { WorkItemProcessor, type LatestText } from '../metrics/work-item-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobLeaseService } from './job-lease.service';

export type SyncTrigger = SyncRunDto['trigger'];
export interface SyncOptions {
  projectId?: string;
  full?: boolean;
}

const LEASE = 'ado-sync';
const LEASE_TTL_MS = 30 * 60_000;
/** Team/iteration metadata changes rarely; refresh it at most hourly on incremental runs. */
const METADATA_MAX_AGE_MS = 60 * 60_000;

/**
 * Pulls data from Azure DevOps into Postgres.
 * - Revisions come from the reporting revisions feed, resumed via a stored continuation token,
 *   so each run only transfers what changed since the last one.
 * - Webhook/queue notifications only *trigger* a sync; their payloads are never trusted as data.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly metadataRefreshedAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ado: AdoClient,
    private readonly lease: JobLeaseService,
    private readonly processor: WorkItemProcessor,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Starts a sync unless another replica is already syncing. Resolves as soon as the run is
   * recorded; `done` settles when it finishes. Returns null when skipped.
   */
  async start(
    trigger: SyncTrigger,
    opts: SyncOptions = {},
  ): Promise<{ run: SyncRunDto; done: Promise<SyncRunDto> } | null> {
    if (!(await this.lease.acquire(LEASE, LEASE_TTL_MS))) {
      this.logger.log({ trigger }, 'Sync skipped: another instance holds the lease');
      return null;
    }
    // Long full syncs keep extending the lease so no other replica starts a parallel run.
    const heartbeat = setInterval(
      () => void this.lease.acquire(LEASE, LEASE_TTL_MS).catch(() => undefined),
      LEASE_TTL_MS / 3,
    );
    const release = async () => {
      clearInterval(heartbeat);
      await this.lease.release(LEASE).catch(() => undefined);
    };
    let row;
    try {
      row = await this.prisma.syncRun.create({
        data: { trigger, status: 'running', projectId: opts.projectId ?? null },
      });
    } catch (err) {
      await release();
      throw err;
    }
    const done = this.execute(row.id, trigger, opts).finally(release);
    return { run: toDto(row), done };
  }

  /** Runs a sync to completion (scheduler / queue). */
  async run(trigger: SyncTrigger, opts: SyncOptions = {}): Promise<SyncRunDto | null> {
    const started = await this.start(trigger, opts);
    return started ? started.done : null;
  }

  async listRuns(page: number, pageSize: number): Promise<Paged<SyncRunDto>> {
    const [total, rows] = await Promise.all([
      this.prisma.syncRun.count(),
      this.prisma.syncRun.findMany({
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { page, pageSize, total, items: rows.map(toDto) };
  }

  private async execute(
    runId: string,
    trigger: SyncTrigger,
    opts: SyncOptions,
  ): Promise<SyncRunDto> {
    const run = { id: runId };
    let itemsUpserted = 0;
    let revisionsUpserted = 0;
    try {
      const projects = await this.syncProjects(opts.projectId);
      for (const project of projects) {
        // Scheduled ticks run every few seconds, so they refresh metadata only when it is stale.
        const forceMetadata = trigger === 'manual' || trigger === 'startup' || opts.full;
        await this.syncProjectMetadata(project.id, Boolean(forceMetadata));
        const r = await this.syncRevisions(project.id, Boolean(opts.full));
        itemsUpserted += r.items;
        revisionsUpserted += r.revisions;
        await this.processor.recomputeDelays(project.id);
        await this.prisma.project.update({
          where: { id: project.id },
          data: { lastSyncedAt: new Date() },
        });
      }
      const done = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: { status: 'succeeded', finishedAt: new Date(), itemsUpserted, revisionsUpserted },
      });
      // Scheduled ticks run every few seconds; keep only the ones that pulled something in.
      if (trigger === 'schedule' && itemsUpserted === 0 && revisionsUpserted === 0) {
        await this.prisma.syncRun.delete({ where: { id: run.id } });
        this.logger.debug({ runId: run.id }, 'Sync finished: no changes');
      } else {
        this.logger.log({ runId: run.id, itemsUpserted, revisionsUpserted }, 'Sync finished');
      }
      return toDto(done);
    } catch (err) {
      this.logger.error({ err, runId: run.id }, 'Sync failed');
      const failed = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          itemsUpserted,
          revisionsUpserted,
          // Only the message (no stack) is shown to admins in the UI.
          error: err instanceof Error ? err.message.slice(0, 500) : 'Unknown error',
        },
      });
      return toDto(failed);
    }
  }

  private async syncProjects(onlyId?: string) {
    const remote = await this.ado.listProjects();
    const allow = new Set(this.config.ADO_PROJECTS.map((p) => p.toLowerCase()));
    const selected = remote.filter(
      (p) =>
        (allow.size === 0 || allow.has(p.name.toLowerCase()) || allow.has(p.id)) &&
        (!onlyId || p.id === onlyId),
    );
    for (const p of selected) {
      await this.prisma.project.upsert({
        where: { id: p.id },
        create: { id: p.id, name: p.name, description: p.description ?? null },
        update: { name: p.name, description: p.description ?? null },
      });
    }
    return selected;
  }

  private async syncProjectMetadata(projectId: string, force: boolean) {
    const last = this.metadataRefreshedAt.get(projectId) ?? 0;
    if (!force && Date.now() - last < METADATA_MAX_AGE_MS) return;

    const types = await this.ado.listWorkItemTypes(projectId);
    for (const t of types) {
      const states = await this.ado.listWorkItemTypeStates(projectId, t.name);
      for (const s of states) {
        await this.prisma.workItemTypeState.upsert({
          where: {
            projectId_workItemType_state: { projectId, workItemType: t.name, state: s.name },
          },
          create: { projectId, workItemType: t.name, state: s.name, category: s.category },
          update: { category: s.category },
        });
      }
    }

    const teams = this.scopedTeams(await this.ado.listTeams(projectId));
    for (const team of teams) {
      await this.prisma.team.upsert({
        where: { id: team.id },
        create: { id: team.id, projectId, name: team.name },
        update: { name: team.name },
      });

      const [members, fieldValues, iterations] = await Promise.all([
        this.ado.listTeamMembers(projectId, team.id),
        this.ado.getTeamFieldValues(projectId, team.id),
        this.ado.listTeamIterations(projectId, team.id),
      ]);

      await this.upsertPeople(
        members.map((m) => ({
          id: m.identity.id,
          displayName: m.identity.displayName,
          uniqueName: m.identity.uniqueName.toLowerCase(),
        })),
      );
      const isAreaField =
        !fieldValues.field || fieldValues.field.referenceName === 'System.AreaPath';

      for (const it of iterations) {
        await this.prisma.iteration.upsert({
          where: { id: it.id },
          create: {
            id: it.id,
            projectId,
            name: it.name,
            path: it.path,
            startDate: parseDate(it.attributes?.startDate),
            finishDate: parseDate(it.attributes?.finishDate),
          },
          update: {
            name: it.name,
            path: it.path,
            startDate: parseDate(it.attributes?.startDate),
            finishDate: parseDate(it.attributes?.finishDate),
          },
        });
      }

      await this.prisma.$transaction([
        this.prisma.teamMember.deleteMany({ where: { teamId: team.id } }),
        this.prisma.teamMember.createMany({
          data: members.map((m) => ({
            teamId: team.id,
            personId: m.identity.id,
            isTeamAdmin: m.isTeamAdmin ?? false,
          })),
          skipDuplicates: true,
        }),
        this.prisma.teamArea.deleteMany({ where: { teamId: team.id } }),
        this.prisma.teamArea.createMany({
          data: isAreaField
            ? fieldValues.values.map((v) => ({
                teamId: team.id,
                areaPath: v.value,
                includeChildren: v.includeChildren,
              }))
            : [],
          skipDuplicates: true,
        }),
        this.prisma.teamIteration.deleteMany({ where: { teamId: team.id } }),
        this.prisma.teamIteration.createMany({
          data: iterations.map((it) => ({ teamId: team.id, iterationId: it.id })),
          skipDuplicates: true,
        }),
      ]);
    }
    await this.syncBoardColumns(projectId, teams);
    this.metadataRefreshedAt.set(projectId, Date.now());
  }

  /** With ADO_TEAM set, only that team (matched by name) is synced; otherwise all teams. */
  private scopedTeams<T extends { name: string }>(teams: T[]): T[] {
    const only = this.config.ADO_TEAM?.toLowerCase();
    if (!only) return teams;
    const match = teams.filter((t) => t.name.toLowerCase() === only);
    if (match.length === 0)
      this.logger.warn(
        `ADO_TEAM "${this.config.ADO_TEAM}" not found; teams: ${teams.map((t) => t.name).join(', ')}`,
      );
    return match;
  }

  /**
   * Area paths owned by the ADO_TEAM team, or null when sync isn't limited to one team.
   * Items outside these paths belong to other boards and are skipped.
   */
  private async teamAreaFilter(
    projectId: string,
  ): Promise<((areaPath: string | null) => boolean) | null> {
    if (!this.config.ADO_TEAM) return null;
    const areas = await this.prisma.teamArea.findMany({
      where: { team: { projectId, name: { equals: this.config.ADO_TEAM, mode: 'insensitive' } } },
    });
    return (areaPath) => {
      if (!areaPath) return false;
      const p = areaPath.toLowerCase();
      return areas.some((a) => {
        const root = a.areaPath.toLowerCase();
        return p === root || (a.includeChildren && p.startsWith(`${root}\\`));
      });
    };
  }

  /**
   * Stores the column layout of the board DesignFlow mirrors: the ADO_TEAM team's board, or
   * the default team ("<Project> Team") when sync covers the whole project.
   */
  private async syncBoardColumns(projectId: string, teams: { id: string; name: string }[]) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const team = this.config.ADO_TEAM
      ? teams[0]
      : (teams.find((t) => t.name === `${project.name} Team`) ?? teams[0]);
    if (!team) return;
    for (const board of await this.ado.listBoards(projectId, team.id)) {
      const columns = await this.ado.listBoardColumns(projectId, team.id, board.id);
      // The backlog-item board is the one whose columns map deliverable types (not Epics/Features).
      const types = new Set(columns.flatMap((c) => Object.keys(c.stateMappings)));
      if (![...types].some((t) => DELIVERY_TYPES.has(t))) continue;
      const boardColumns = columns.map((c) => ({
        name: c.name,
        states: [...new Set(Object.values(c.stateMappings))],
      }));
      await this.prisma.project.update({ where: { id: projectId }, data: { boardColumns } });
      return;
    }
  }

  private async syncRevisions(projectId: string, full: boolean) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    let token = full ? undefined : (project.revisionsContinuationToken ?? undefined);
    const startDateTime = new Date(Date.now() - this.config.SYNC_LOOKBACK_DAYS * DAY_MS);
    const touched = new Set<number>();
    const latestText = new Map<number, LatestText>();
    let revisions = 0;
    const inTeam = await this.teamAreaFilter(projectId);

    for (;;) {
      const batch = await this.ado.reportingRevisions(projectId, {
        continuationToken: token,
        startDateTime,
      });
      const normalized = batch.values
        .map(normalizeRevision)
        .filter((r): r is NormalizedRevision => r !== null)
        .filter((r) => !inTeam || inTeam(r.snapshot.areaPath));

      if (normalized.length > 0) {
        await this.upsertPeople(
          normalized
            .flatMap((r) => [r.changedBy, r.snapshot.assignedTo])
            .filter((p): p is PersonSnapshot => !!p),
        );
        // Revisions are immutable in ADO, so existing (id, rev) rows are left untouched.
        await this.ensureWorkItemStubs(projectId, normalized);
        const res = await this.prisma.workItemRevision.createMany({
          data: normalized.map((r) => ({
            workItemId: r.id,
            rev: r.rev,
            projectId,
            changedDate: r.changedDate,
            changedById: r.changedBy?.id ?? null,
            fields: r.snapshot as unknown as Prisma.InputJsonValue,
          })),
          skipDuplicates: true,
        });
        revisions += res.count;
        if (full) {
          // Revisions don't change in ADO, but a full resync refreshes our stored copy so newly
          // read fields (e.g. the board column) reach rows that were synced before.
          await this.prisma.$transaction(
            normalized.map((r) =>
              this.prisma.workItemRevision.update({
                where: { workItemId_rev: { workItemId: r.id, rev: r.rev } },
                data: { fields: r.snapshot as unknown as Prisma.InputJsonValue },
              }),
            ),
          );
        }
        for (const r of normalized) {
          touched.add(r.id);
          const prev = latestText.get(r.id);
          if (!prev || r.rev > prev.rev) {
            latestText.set(r.id, {
              rev: r.rev,
              description: r.descriptionText,
              acceptanceCriteria: r.acceptanceCriteriaText,
            });
          }
        }
      }

      token = batch.continuationToken ?? token;
      // Persist progress after each batch so an interrupted sync resumes instead of restarting.
      await this.prisma.project.update({
        where: { id: projectId },
        data: { revisionsContinuationToken: token ?? null },
      });
      if (batch.isLastBatch) break;
    }

    await this.processor.processItems(projectId, [...touched], latestText);
    if (full && inTeam) {
      // Drop items synced before the team filter, or since moved to another team's area.
      // Runs after processing so items created this run already have their area path.
      const stored = await this.prisma.workItem.findMany({
        where: { projectId },
        select: { id: true, areaPath: true },
      });
      const outside = stored.filter((w) => !inTeam(w.areaPath)).map((w) => w.id);
      if (outside.length) await this.prisma.workItem.deleteMany({ where: { id: { in: outside } } });
      for (const id of outside) touched.delete(id);
    }
    // Adding a comment creates a revision, so the touched items are exactly the ones to refresh.
    for (const id of touched) await this.syncComments(projectId, id);
    return { items: touched.size, revisions };
  }

  /** Replaces an item's stored comments with the current Azure DevOps discussion. */
  private async syncComments(projectId: string, workItemId: number) {
    const comments = await this.ado.listComments(projectId, workItemId);
    const rows = comments.flatMap((c) => {
      const text = htmlToPlain(c.text);
      if (!text) return [];
      return [
        {
          workItemId,
          commentId: c.id,
          projectId,
          authorId: c.createdBy?.id ?? null,
          authorName: c.createdBy?.displayName ?? 'Unknown',
          authorUniqueName: c.createdBy?.uniqueName.toLowerCase() ?? '',
          text,
          signals: commentSignals(text),
          createdAt: new Date(c.createdDate),
          modifiedAt: parseDate(c.modifiedDate),
        },
      ];
    });
    await this.prisma.$transaction([
      this.prisma.workItemComment.deleteMany({ where: { workItemId } }),
      this.prisma.workItemComment.createMany({ data: rows }),
    ]);
  }

  /** Revisions reference work_item; create minimal rows first, the processor fills them in. */
  private async ensureWorkItemStubs(projectId: string, revs: NormalizedRevision[]) {
    const byId = new Map<number, NormalizedRevision>();
    for (const r of revs) if (!byId.has(r.id)) byId.set(r.id, r);
    await this.prisma.workItem.createMany({
      data: [...byId.values()].map((r) => ({
        id: r.id,
        projectId,
        type: r.snapshot.type,
        title: r.snapshot.title,
        state: r.snapshot.state,
        stateCategory: 'Proposed',
        createdDate: new Date(r.snapshot.createdDate),
        changedDate: r.changedDate,
        rev: r.rev,
      })),
      skipDuplicates: true,
    });
  }

  private async upsertPeople(people: PersonSnapshot[]) {
    const unique = new Map(people.filter((p) => p.id).map((p) => [p.id, p]));
    for (const p of unique.values()) {
      await this.prisma.person.upsert({
        where: { id: p.id },
        create: { id: p.id, displayName: p.displayName, uniqueName: p.uniqueName },
        update: { displayName: p.displayName, uniqueName: p.uniqueName },
      });
    }
  }
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDto(r: {
  id: string;
  projectId: string | null;
  trigger: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  itemsUpserted: number;
  revisionsUpserted: number;
  error: string | null;
}): SyncRunDto {
  return {
    id: r.id,
    projectId: r.projectId,
    trigger: r.trigger as SyncRunDto['trigger'],
    status: r.status as SyncRunDto['status'],
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    itemsUpserted: r.itemsUpserted,
    revisionsUpserted: r.revisionsUpserted,
    error: r.error,
  };
}
