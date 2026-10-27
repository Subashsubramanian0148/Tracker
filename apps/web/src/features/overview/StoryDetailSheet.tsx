import type { StorySummary, StorySummaryItem } from '@ado-metrics/shared';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/shadcn/sheet';
import { Avatar } from '../../components/ui/Avatar';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { formatNumber, typeShortCode } from '../../lib/format';
import { delayFlagLabel } from '../../lib/labels';

export type DetailKind = 'stages' | 'delay' | 'people' | 'warnings';

interface Group {
  key: string;
  label: string;
  match: (i: StorySummaryItem) => boolean;
}

const COPY: Record<DetailKind, { title: string; description: string }> = {
  stages: { title: 'Stories', description: 'Every story on the board in this period, by stage' },
  delay: { title: 'On Time vs. Delayed', description: 'Delayed stories show what flagged them' },
  people: { title: 'Teammates', description: 'Stories each person is holding or has delivered' },
  warnings: { title: 'Delay Warning Signs', description: 'Stories behind each warning sign' },
};

function groupsFor(kind: DetailKind, data: StorySummary): Group[] {
  if (kind === 'stages') {
    return [
      { key: 'todo', label: 'Yet to start', match: (i) => i.stateCategory === 'Proposed' },
      {
        key: 'progress',
        label: 'In progress',
        match: (i) => i.stateCategory !== 'Proposed' && i.stateCategory !== 'Completed',
      },
      { key: 'done', label: 'Delivered', match: (i) => i.stateCategory === 'Completed' },
    ];
  }
  if (kind === 'delay') {
    return [
      { key: 'ontime', label: 'On time', match: (i) => !i.isDelayed },
      { key: 'delayed', label: 'Delayed', match: (i) => i.isDelayed },
    ];
  }
  if (kind === 'people') {
    return data.people.map((p) => ({
      key: p.person?.id ?? 'unassigned',
      label: p.person?.displayName ?? 'Unassigned',
      match: (i) => (i.assignedTo?.id ?? null) === (p.person?.id ?? null),
    }));
  }
  const flags = [...new Set(data.items.flatMap((i) => i.delayFlags))];
  return flags.map((f) => ({
    key: f,
    label: delayFlagLabel(f),
    match: (i) => i.delayFlags.includes(f),
  }));
}

/** Side panel listing the stories behind one Overview card, split into that card's groups. */
export function StoryDetailSheet({
  view,
  data,
  projectId,
  onClose,
}: {
  view: { kind: DetailKind; group?: string } | null;
  data: StorySummary | undefined;
  projectId: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!view} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {view && data ? (
          <Detail
            key={`${view.kind}-${view.group ?? ''}`}
            kind={view.kind}
            initial={view.group}
            data={data}
            projectId={projectId}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Detail({
  kind,
  initial,
  data,
  projectId,
}: {
  kind: DetailKind;
  initial: string | undefined;
  data: StorySummary;
  projectId: string;
}) {
  const groups = groupsFor(kind, data);
  const [groupKey, setGroupKey] = useState(initial ?? groups[0]?.key ?? '');
  const group = groups.find((g) => g.key === groupKey) ?? groups[0];
  const items = group ? data.items.filter(group.match) : [];
  const options = groups.map((g) => ({
    value: g.key,
    label: `${g.label} (${formatNumber(data.items.filter(g.match).length)})`,
  }));

  return (
    <>
      <SheetHeader className="border-b px-6 pt-6 pb-4">
        <SheetTitle className="font-display text-lg">{COPY[kind].title}</SheetTitle>
        <SheetDescription>{COPY[kind].description}</SheetDescription>
        {groups.length > 0 ? (
          <div className="pt-3">
            <SegmentedControl
              label="Show"
              value={group!.key}
              onChange={setGroupKey}
              options={options}
            />
          </div>
        ) : null}
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stories here.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id}>
                <Link
                  to={`/projects/${encodeURIComponent(projectId)}/work-items/${i.id}`}
                  className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-sidebar"
                >
                  <span className="mt-0.5 shrink-0 rounded-md bg-sidebar px-2 py-0.5 font-display text-[11px] font-semibold text-ink-soft tabular-nums">
                    {typeShortCode(i.type)} · {i.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{i.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {i.state}
                      {i.isDelayed ? (
                        <span className="inline-flex items-center gap-1 text-amber-ink">
                          <TriangleAlert aria-hidden className="size-3" />
                          {i.delayFlags.map(delayFlagLabel).join(', ') || 'Delayed'}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
                    <Avatar name={i.assignedTo?.displayName} seed={i.assignedTo?.id} size="xs" />
                    <span className="hidden max-w-24 truncate sm:inline">
                      {i.assignedTo?.displayName ?? 'Unassigned'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
