/**
 * API contract shared by the API (validation + response typing) and the web app.
 * Every request body and query string the API accepts is defined here as a zod schema,
 * so the server rejects anything that does not match before it reaches business logic.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** 'Viewer' is shown as "Designer"; the value stays 'Viewer' to match the Entra app role. */
export const ROLES = ['Viewer', 'TeamLead', 'Manager', 'Admin'] as const;
export type Role = (typeof ROLES)[number];

/** Azure DevOps state categories. Metrics use categories so custom states still work. */
export const STATE_CATEGORIES = [
  'Proposed',
  'InProgress',
  'Resolved',
  'Completed',
  'Removed',
] as const;
export type StateCategory = (typeof STATE_CATEGORIES)[number];

export const WORK_ITEM_TYPES = [
  'Epic',
  'Feature',
  'Product Backlog Item',
  'Issue',
  'Bug',
  'Task',
] as const;

export const DELAY_FLAGS = [
  'CYCLE_TIME_OUTLIER',
  'CARRIED_OVER',
  'PAST_SPRINT_END',
  'LONG_BLOCKED',
  'REOPENED',
  // From Azure DevOps comments (keyword based).
  'REOPENED_IN_COMMENTS',
  'BLOCKED_IN_COMMENTS',
  'DONE_NOT_CLOSED',
] as const;
export type DelayFlag = (typeof DELAY_FLAGS)[number];

export const CHANGE_KINDS = [
  'STATE',
  'EFFORT',
  'REQUIREMENT',
  'ASSIGNEE',
  'ITERATION',
  'BLOCKED',
  'OTHER',
] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

/** Change kinds that alter what is being delivered; see docs/METRICS.md "Scope changes". */
export const SCOPE_CHANGE_KINDS = [
  'EFFORT',
  'REQUIREMENT',
  'ITERATION',
  'ASSIGNEE',
] as const satisfies readonly ChangeKind[];

/** ADO project ids are GUIDs. */
export const guid = z.guid();
/** ADO work item ids are positive integers. */
export const workItemId = z.coerce.number().int().positive().max(2_147_483_647);
const isoDate = z.iso.datetime({ offset: true });

/** Free text is trimmed, length-bounded and stripped of control characters. */
export const safeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    // eslint-disable-next-line no-control-regex
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''));

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PersonRef {
  id: string;
  displayName: string;
  /** Present only when the viewer may see individual data. */
  email?: string;
}

// ---------------------------------------------------------------------------
// Auth / session
// ---------------------------------------------------------------------------

export interface CurrentUser {
  id: string;
  displayName: string;
  email: string;
  jobTitle?: string;
  roles: Role[];
}

export interface ProjectRef {
  id: string;
  name: string;
}

export interface MeResponse {
  user: CurrentUser;
  /** Synchronizer token; send back as the `X-CSRF-Token` header on every mutating request. */
  csrfToken: string;
  /** Projects this user can see in Azure DevOps (intersected with synced projects). */
  projects: ProjectRef[];
  authMode: 'entra' | 'dev';
}

export interface LogoutResponse {
  /** Entra ID end-session URL to navigate to (single sign-out); null in dev mode. */
  logoutUrl: string | null;
}

// ---------------------------------------------------------------------------
// Projects, teams, iterations
// ---------------------------------------------------------------------------

export interface ProjectSummary extends ProjectRef {
  description: string | null;
  lastSyncedAt: string | null;
  workItemCount: number;
  openDelayCount: number;
  /** The Azure DevOps board's columns in order; null when not synced (e.g. demo data). */
  boardColumns: BoardColumnDef[] | null;
}

export interface BoardColumnDef {
  name: string;
  /** States that map to this column, used when an item's column is unknown. */
  states: string[];
}

export interface TeamRef {
  id: string;
  name: string;
}

export interface Iteration {
  id: string;
  name: string;
  path: string;
  startDate: string | null;
  finishDate: string | null;
  timeFrame: 'past' | 'current' | 'future';
}

export const teamScopedQuery = z.object({
  teamId: guid.optional(),
});

// ---------------------------------------------------------------------------
// Work items
// ---------------------------------------------------------------------------

export const workItemListQuery = paginationQuery.extend({
  teamId: guid.optional(),
  type: z.enum(WORK_ITEM_TYPES).optional(),
  stateCategory: z.enum(STATE_CATEGORIES).optional(),
  iterationPath: safeText(400).optional(),
  delayed: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: safeText(200).optional(),
  sort: z.enum(['changedDate', 'cycleTime', 'leadTime', 'id']).default('changedDate'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type WorkItemListQuery = z.infer<typeof workItemListQuery>;

export interface WorkItemSummary {
  id: number;
  projectId: string;
  type: string;
  title: string;
  state: string;
  stateCategory: StateCategory;
  /** Column on the Azure DevOps board; null when unknown (older sync or no board). */
  boardColumn: string | null;
  assignedTo: PersonRef | null;
  iterationPath: string | null;
  /** True when the item has no sprint of its own and iterationPath is its parent's sprint. */
  iterationFromParent: boolean;
  areaPath: string | null;
  effort: number | null;
  tags: string[];
  parentId: number | null;
  createdDate: string;
  changedDate: string;
  activatedDate: string | null;
  completedDate: string | null;
  /** Sprint end date of the current iteration, used as the "due" date on cards. */
  dueDate: string | null;
  cycleTimeDays: number | null;
  leadTimeDays: number | null;
  isDelayed: boolean;
  delayFlags: DelayFlag[];
  hasDelayReason: boolean;
}

export interface StateSegment {
  state: string;
  category: StateCategory;
  enteredAt: string;
  exitedAt: string | null;
  durationHours: number;
}

export interface WorkItemChange {
  rev: number;
  changedAt: string;
  changedBy: PersonRef | null;
  kind: ChangeKind;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  /** True when the change happened after work started. */
  afterWorkStarted: boolean;
  /** After work started and of a scope kind (effort, requirement, sprint move, reassignment). */
  isScopeChange: boolean;
}

export interface EstimateSummary {
  effort: number | null;
  initialEffort: number | null;
  originalEstimateHours: number | null;
  completedWorkHours: number | null;
  remainingWorkHours: number | null;
  /** actual / estimate in hours; >1 means it took longer than estimated. */
  estimateVsActualRatio: number | null;
}

export interface WorkItemDetail extends WorkItemSummary {
  description: string | null;
  acceptanceCriteria: string | null;
  url: string;
  stateTimeline: StateSegment[];
  timeInState: { state: string; category: StateCategory; hours: number }[];
  changes: WorkItemChange[];
  estimate: EstimateSummary;
  blockedHours: number;
  reopenCount: number;
  sprintsSpanned: string[];
  delayReasons: DelayReason[];
  children: WorkItemSummary[];
  /** Discussion from Azure DevOps, oldest first. */
  comments: WorkItemComment[];
  /** Time held up according to reopen/blocked comments, in days. */
  commentDelayDays: number;
  /** Set when the team agreed the item wasn't really late. */
  dismissal: { reason: string; by: string; at: string } | null;
  attachments: { name: string; url: string; sizeBytes: number | null }[];
}

export const dismissDelayBody = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
export type DismissDelayBody = z.infer<typeof dismissDelayBody>;

export const COMMENT_SIGNALS = ['REOPEN', 'BLOCKED', 'UNBLOCKED', 'DONE'] as const;
export type CommentSignal = (typeof COMMENT_SIGNALS)[number];

export interface WorkItemComment {
  id: number;
  author: PersonRef | null;
  createdAt: string;
  text: string;
  signals: CommentSignal[];
  /** Someone marked this comment's tags as not a real signal; it no longer counts. */
  ignored: boolean;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export const metricsQuery = z
  .object({
    teamId: guid.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    type: z.enum(WORK_ITEM_TYPES).optional(),
  })
  .refine((q) => !q.from || !q.to || new Date(q.from) <= new Date(q.to), {
    error: '`from` must be before `to`',
  });
export type MetricsQuery = z.infer<typeof metricsQuery>;

export interface DistributionStats {
  count: number;
  avg: number | null;
  median: number | null;
  p85: number | null;
  max: number | null;
}

/** Stories on the board during a period, by stage, by delay and by person. */
export interface StorySummary {
  range: { from: string; to: string };
  total: number;
  yetToStart: number;
  inProgress: number;
  delivered: number;
  onTime: number;
  delayed: number;
  /** Most stories first; `person` is null for unassigned stories. */
  people: { person: PersonRef | null; total: number; open: number; delivered: number }[];
  /** The stories behind the counts, for the cards' detail views. */
  items: StorySummaryItem[];
}

export interface StorySummaryItem {
  id: number;
  title: string;
  type: string;
  state: string;
  stateCategory: StateCategory;
  isDelayed: boolean;
  delayFlags: DelayFlag[];
  assignedTo: PersonRef | null;
}

export interface OverviewMetrics {
  range: { from: string; to: string };
  cycleTime: DistributionStats;
  leadTime: DistributionStats;
  throughput: { weekStart: string; count: number }[];
  cycleTimeScatter: {
    workItemId: number;
    title: string;
    type: string;
    completedAt: string;
    cycleTimeDays: number;
  }[];
  timeInStateAvg: { state: string; category: StateCategory; avgHours: number }[];
  scopeChanges: {
    effortChanges: number;
    requirementEdits: number;
    sprintMoves: number;
    reassignments: number;
    addedMidSprint: number;
    itemsAffected: number;
  };
  estimateAccuracy: {
    itemsWithEstimates: number;
    itemsCompleted: number;
    avgRatio: number | null;
    /** Share of items finished within +/-20% of estimate. */
    onTargetPct: number | null;
  };
  delays: {
    delayedCount: number;
    explainedCount: number;
    byCategory: { categoryId: string; category: string; count: number }[];
    byFlag: { flag: DelayFlag; count: number }[];
  };
}

export interface SprintHealth {
  iterationId: string;
  name: string;
  path: string;
  startDate: string | null;
  finishDate: string | null;
  timeFrame: Iteration['timeFrame'];
  committedCount: number;
  committedEffort: number;
  completedCount: number;
  completedEffort: number;
  addedMidSprint: number;
  removedMidSprint: number;
  carriedOver: number;
  /** completedCount / committedCount, 0..1. */
  completionRate: number | null;
}

export interface PersonMetrics {
  person: PersonRef;
  completedCount: number;
  activeCount: number;
  cycleTime: DistributionStats;
  delayedCount: number;
  estimateAccuracyRatio: number | null;
}

// ---------------------------------------------------------------------------
// Delays
// ---------------------------------------------------------------------------

export const delayListQuery = paginationQuery.extend({
  teamId: guid.optional(),
  status: z.enum(['open', 'explained', 'all']).default('open'),
});
export type DelayListQuery = z.infer<typeof delayListQuery>;

export interface DelayCategory {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface DelayReason {
  id: string;
  workItemId: number;
  category: { id: string; name: string };
  comment: string;
  impactDays: number | null;
  createdBy: PersonRef;
  createdAt: string;
  /** Set when a later entry replaced this one; history is never deleted. */
  supersededAt: string | null;
}

export const createDelayReasonBody = z
  .object({
    categoryId: guid,
    comment: safeText(2000).pipe(z.string().min(10, 'Please describe the delay (10+ chars)')),
    impactDays: z.number().min(0).max(365).nullable().optional(),
  })
  .strict();
export type CreateDelayReasonBody = z.infer<typeof createDelayReasonBody>;

export const upsertDelayCategoryBody = z
  .object({
    name: safeText(80).pipe(z.string().min(2)),
    description: safeText(400).nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict();
export type UpsertDelayCategoryBody = z.infer<typeof upsertDelayCategoryBody>;

export interface DelayedItem {
  workItem: WorkItemSummary;
  flags: DelayFlag[];
  detectedAt: string;
  latestReason: DelayReason | null;
}

// ---------------------------------------------------------------------------
// Admin: sync + audit
// ---------------------------------------------------------------------------

export interface SyncRun {
  id: string;
  projectId: string | null;
  trigger: 'schedule' | 'webhook' | 'manual' | 'startup';
  status: 'running' | 'succeeded' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  itemsUpserted: number;
  revisionsUpserted: number;
  error: string | null;
}

export const triggerSyncBody = z
  .object({
    projectId: guid.optional(),
    full: z.boolean().default(false),
  })
  .strict();
export type TriggerSyncBody = z.infer<typeof triggerSyncBody>;

export const auditListQuery = paginationQuery.extend({
  action: safeText(80).optional(),
  actorId: safeText(120).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuery>;

export interface AuditEntry {
  id: string;
  occurredAt: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: 'success' | 'denied' | 'error';
  ip: string | null;
  details: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Errors (RFC 9457 problem details)
// ---------------------------------------------------------------------------

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  /** Correlation id; matches the server log entry. */
  traceId: string;
  errors?: { path: string; message: string }[];
}

// ---------------------------------------------------------------------------
// Task tracker (Mode 1): tasks people log by hand
// ---------------------------------------------------------------------------

export const TASK_STATUSES = [
  'upcoming',
  'started',
  'in_progress',
  'approval_pending',
  'completed',
  'reopened',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Calendar date without time, as sent by <input type="date">. */
const dateOnly = z.iso.date();

export interface Task {
  id: string;
  owner: PersonRef;
  title: string;
  notes: string | null;
  status: TaskStatus;
  workItemId: number | null;
  /** yyyy-mm-dd */
  dueDate: string | null;
  estimateHours: number | null;
  spentHours: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Not done and past its due date, or finished after it. */
  late: boolean;
}

const taskFields = {
  title: safeText(200).pipe(z.string().min(2, 'Give the task a short title')),
  notes: safeText(2000).nullable().optional(),
  status: z.enum(TASK_STATUSES),
  workItemId: workItemId.nullable().optional(),
  dueDate: dateOnly.nullable().optional(),
  estimateHours: z.number().min(0).max(1000).nullable().optional(),
  spentHours: z.number().min(0).max(10_000),
};

export const createTaskBody = z
  .object({
    ...taskFields,
    status: taskFields.status.default('upcoming'),
    spentHours: taskFields.spentHours.optional(),
  })
  .strict();
export type CreateTaskBody = z.infer<typeof createTaskBody>;

export const updateTaskBody = z.object(taskFields).partial().strict();
export type UpdateTaskBody = z.infer<typeof updateTaskBody>;

export const taskListQuery = paginationQuery.extend({
  scope: z.enum(['mine', 'team']).default('mine'),
  status: z.enum([...TASK_STATUSES, 'open', 'all']).default('all'),
  ownerId: safeText(120).optional(),
  q: safeText(100).optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuery>;

export const taskSummaryQuery = z.object({
  weeks: z.coerce.number().int().min(4).max(26).default(8),
});
export type TaskSummaryQuery = z.infer<typeof taskSummaryQuery>;

export interface TaskComment {
  id: string;
  author: PersonRef;
  body: string;
  createdAt: string;
}

export const createTaskCommentBody = z
  .object({ body: safeText(2000).pipe(z.string().trim().min(1, 'Write a comment first')) })
  .strict();
export type CreateTaskCommentBody = z.infer<typeof createTaskCommentBody>;

export interface TaskCounts {
  upcoming: number;
  started: number;
  inProgress: number;
  approvalPending: number;
  reopened: number;
  /** Completed within the summary window. */
  completed: number;
  /** Open and past due. */
  overdue: number;
}

export interface TaskSummary {
  totals: TaskCounts;
  /** Share of tasks completed in the window that finished on or before their due date (null: none had one). */
  onTimeRate: number | null;
  people: (TaskCounts & { owner: PersonRef })[];
  /** Oldest week first; weeks start on Monday. */
  weekly: { weekStart: string; created: number; completed: number; completedLate: number }[];
}

/** Live health of the API and its connections, for the project's API Health tab. */
export type HealthStatus = 'ok' | 'degraded' | 'down';
export interface ApiHealth {
  checkedAt: string;
  api: { status: HealthStatus; uptimeSeconds: number; version: string | null };
  database: { status: HealthStatus; latencyMs: number | null };
  /** Azure DevOps reachability, judged by the most recent sync runs. */
  azureDevOps: { status: HealthStatus; lastSuccessAt: string | null };
  sync: {
    lastSyncedAt: string | null;
    runsLast24h: number;
    failedLast24h: number;
    avgDurationMs: number | null;
    lastError: string | null;
  };
  data: { workItems: number; revisions: number; comments: number };
  recentRuns: {
    startedAt: string;
    status: string;
    durationMs: number | null;
    items: number;
    trigger: string;
  }[];
}
