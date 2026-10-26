import { createHash } from 'node:crypto';
import { convert } from 'html-to-text';
import { identityRef, type ReportingRevision } from './ado.schemas';

export const F = {
  id: 'System.Id',
  rev: 'System.Rev',
  type: 'System.WorkItemType',
  title: 'System.Title',
  state: 'System.State',
  reason: 'System.Reason',
  assignedTo: 'System.AssignedTo',
  iterationPath: 'System.IterationPath',
  areaPath: 'System.AreaPath',
  createdDate: 'System.CreatedDate',
  changedDate: 'System.ChangedDate',
  changedBy: 'System.ChangedBy',
  tags: 'System.Tags',
  parent: 'System.Parent',
  isDeleted: 'System.IsDeleted',
  description: 'System.Description',
  acceptanceCriteria: 'Microsoft.VSTS.Common.AcceptanceCriteria',
  effort: 'Microsoft.VSTS.Scheduling.Effort',
  storyPoints: 'Microsoft.VSTS.Scheduling.StoryPoints',
  size: 'Microsoft.VSTS.Scheduling.Size',
  originalEstimate: 'Microsoft.VSTS.Scheduling.OriginalEstimate',
  remainingWork: 'Microsoft.VSTS.Scheduling.RemainingWork',
  completedWork: 'Microsoft.VSTS.Scheduling.CompletedWork',
  blocked: 'Microsoft.VSTS.CMMI.Blocked',
  boardColumn: 'System.BoardColumn',
} as const;

export const REVISION_FIELDS: string[] = Object.values(F);

export interface PersonSnapshot {
  id: string;
  displayName: string;
  uniqueName: string;
}

/** The compact, normalised per-revision snapshot stored in work_item_revision.fields. */
export interface RevisionSnapshot {
  type: string;
  title: string;
  state: string;
  reason: string | null;
  assignedTo: PersonSnapshot | null;
  iterationPath: string | null;
  areaPath: string | null;
  createdDate: string;
  tags: string[];
  parentId: number | null;
  effort: number | null;
  originalEstimate: number | null;
  remainingWork: number | null;
  completedWork: number | null;
  blocked: boolean;
  /** Hashes let us detect requirement edits without storing every historical body. */
  descriptionHash: string | null;
  acceptanceCriteriaHash: string | null;
  isDeleted: boolean;
  /** Column on the team's Azure DevOps board (columns can differ from states). Missing on older rows. */
  boardColumn?: string | null;
}

export interface NormalizedRevision {
  id: number;
  rev: number;
  changedDate: Date;
  changedBy: PersonSnapshot | null;
  snapshot: RevisionSnapshot;
  descriptionText: string | null;
  acceptanceCriteriaText: string | null;
}

const MAX_TEXT = 20_000;

export function normalizeRevision(raw: ReportingRevision): NormalizedRevision | null {
  const f = raw.fields;
  const changed = date(f[F.changedDate]);
  const created = date(f[F.createdDate]);
  const type = str(f[F.type]);
  if (!changed || !created || !type) return null;

  const descriptionText = htmlToPlain(f[F.description]);
  const acceptanceCriteriaText = htmlToPlain(f[F.acceptanceCriteria]);

  return {
    id: raw.id,
    rev: raw.rev,
    changedDate: changed,
    changedBy: person(f[F.changedBy]),
    descriptionText,
    acceptanceCriteriaText,
    snapshot: {
      type,
      title: (str(f[F.title]) ?? '').slice(0, 500),
      state: str(f[F.state]) ?? 'Unknown',
      reason: str(f[F.reason]),
      assignedTo: person(f[F.assignedTo]),
      iterationPath: str(f[F.iterationPath]),
      areaPath: str(f[F.areaPath]),
      createdDate: created.toISOString(),
      tags: parseTags(f[F.tags]),
      parentId: num(f[F.parent]),
      effort: num(f[F.effort]) ?? num(f[F.storyPoints]) ?? num(f[F.size]),
      originalEstimate: num(f[F.originalEstimate]),
      remainingWork: num(f[F.remainingWork]),
      completedWork: num(f[F.completedWork]),
      blocked: str(f[F.blocked])?.toLowerCase() === 'yes' || f[F.blocked] === true,
      descriptionHash: hash(descriptionText),
      acceptanceCriteriaHash: hash(acceptanceCriteriaText),
      isDeleted: f[F.isDeleted] === true,
      boardColumn: str(f[F.boardColumn]),
    },
  };
}

export function parseTags(value: unknown): string[] {
  const s = str(value);
  if (!s) return [];
  return s
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 50);
}

/** ADO rich-text fields are HTML; we keep plain text only, so nothing is ever rendered as HTML. */
export function htmlToPlain(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  const text = convert(s, {
    wordwrap: false,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { ignoreHref: true } },
    ],
  }).trim();
  return text ? text.slice(0, MAX_TEXT) : null;
}

function person(value: unknown): PersonSnapshot | null {
  const parsed = identityRef.safeParse(value);
  if (!parsed.success) return null;
  return {
    id: parsed.data.id,
    displayName: parsed.data.displayName.slice(0, 200),
    uniqueName: parsed.data.uniqueName.toLowerCase().slice(0, 320),
  };
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function date(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function hash(text: string | null): string | null {
  return text ? createHash('sha256').update(text).digest('hex').slice(0, 32) : null;
}
