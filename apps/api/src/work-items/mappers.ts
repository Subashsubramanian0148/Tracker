import type {
  DelayFlag,
  DelayReason,
  PersonRef,
  StateCategory,
  WorkItemSummary,
} from '@ado-metrics/shared';
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

export function toSummary(
  w: WorkItemRow,
  assignedTo: PersonRef | null,
  dueDate: Date | undefined,
  hasDelayReason: boolean,
): WorkItemSummary {
  return {
    id: w.id,
    projectId: w.projectId,
    type: w.type,
    title: w.title,
    state: w.state,
    stateCategory: w.stateCategory as StateCategory,
    boardColumn: w.boardColumn,
    assignedTo,
    iterationPath: w.iterationPath,
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
