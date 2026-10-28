import type {
  DelayFlag,
  DelayReason,
  PersonRef,
  StateCategory,
  WorkItemSummary,
} from '@ado-metrics/shared';
import type { SprintWindow } from '../metrics/engine/delays';
import { toDays } from '../metrics/engine/stats';

export interface WorkItemRow {
  id: number;
  projectId: string;
  type: string;
  title: string;
  state: string;
  stateCategory: string;
  iterationPath: string | null;
  areaPath: string | null;
  effort: number | null;
  tags: string[];
  parentId: number | null;
  parentIterationPath: string | null;
  createdDate: Date;
  changedDate: Date;
  activatedDate: Date | null;
  completedDate: Date | null;
  cycleTimeHours: number | null;
  leadTimeHours: number | null;
  isDelayed: boolean;
  delayFlags: string[];
  boardColumn: string | null;
}

/**
 * A backslash, escaped for use in a Prisma `contains` filter: Postgres LIKE treats a single
 * backslash as its escape character, so an unescaped one matches nothing.
 */
export const SPRINT_SEPARATOR = '\\\\';

/**
 * The sprint an item belongs to. The parent's sprint wins whenever the parent has one: the team
 * plans on the parent and often leaves child stories on an old sprint or the project root.
 * Otherwise the item's own Iteration is used. The sprint is never guessed from dates.
 */
export function effectiveIteration(w: Pick<WorkItemRow, 'iterationPath' | 'parentIterationPath'>): {
  path: string | null;
  fromParent: boolean;
} {
  // A path with no sprint segment ("CORE 2.0") is just the project root.
  const parent = w.parentIterationPath;
  if (parent && parent.includes('\\') && parent !== w.iterationPath)
    return { path: parent, fromParent: true };
  return { path: w.iterationPath, fromParent: false };
}

export function toSummary(
  w: WorkItemRow,
  assignedTo: PersonRef | null,
  sprints: readonly SprintWindow[],
  hasDelayReason: boolean,
): WorkItemSummary {
  const sprint = effectiveIteration(w);
  const dueDate = sprints.find((s) => s.path === sprint.path)?.finishDate;
  return {
    id: w.id,
    projectId: w.projectId,
    type: w.type,
    title: w.title,
    state: w.state,
    stateCategory: w.stateCategory as StateCategory,
    boardColumn: w.boardColumn,
    assignedTo,
    iterationPath: sprint.path,
    iterationFromParent: sprint.fromParent,
    areaPath: w.areaPath,
    effort: w.effort,
    tags: w.tags,
    parentId: w.parentId,
    createdDate: w.createdDate.toISOString(),
    changedDate: w.changedDate.toISOString(),
    activatedDate: w.activatedDate?.toISOString() ?? null,
    completedDate: w.completedDate?.toISOString() ?? null,
    dueDate: dueDate?.toISOString() ?? null,
    cycleTimeDays: toDays(w.cycleTimeHours),
    leadTimeDays: toDays(w.leadTimeHours),
    isDelayed: w.isDelayed,
    delayFlags: w.delayFlags as DelayFlag[],
    hasDelayReason,
  };
}

export function toDelayReason(r: {
  id: string;
  workItemId: number;
  comment: string;
  impactDays: number | null;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  supersededAt: Date | null;
  category: { id: string; name: string };
}): DelayReason {
  return {
    id: r.id,
    workItemId: r.workItemId,
    category: { id: r.category.id, name: r.category.name },
    comment: r.comment,
    impactDays: r.impactDays,
    createdBy: { id: r.createdById, displayName: r.createdByName },
    createdAt: r.createdAt.toISOString(),
    supersededAt: r.supersededAt?.toISOString() ?? null,
  };
}
