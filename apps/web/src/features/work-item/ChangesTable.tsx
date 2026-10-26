import type { ChangeKind, WorkItemChange } from '@ado-metrics/shared';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Checkbox } from '@/components/shadcn/checkbox';
import { Label } from '@/components/shadcn/label';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { formatDateTime } from '../../lib/format';
import { CHANGE_KIND_LABELS } from '../../lib/labels';
import { TruncatedText } from './TruncatedText';

const ALL = '__all__';

export function ChangesTable({ changes }: { changes: WorkItemChange[] }) {
  const [kind, setKind] = useState<string>(ALL);
  const [scopeOnly, setScopeOnly] = useState(false);
  const kinds = useMemo(() => [...new Set(changes.map((c) => c.kind))], [changes]);
  const rows = changes
    .filter((c) => (kind === ALL || c.kind === kind) && (!scopeOnly || c.isScopeChange))
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt) || b.rev - a.rev);
  const scopeCount = changes.filter((c) => c.isScopeChange).length;

  if (changes.length === 0)
    return <p className="text-sm text-muted-foreground">No field changes recorded.</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Select
          label="Change type"
          className="w-48"
          value={kind}
          onChange={setKind}
          options={[
            { value: ALL, label: 'All changes' },
            ...kinds.map((k) => ({ value: k, label: CHANGE_KIND_LABELS[k as ChangeKind] ?? k })),
          ]}
        />
        <div className="inline-flex h-9 items-center gap-2">
          <Checkbox
            id="scope-only"
            checked={scopeOnly}
            onCheckedChange={(c) => setScopeOnly(c === true)}
            className="cursor-pointer"
          />
          <Label htmlFor="scope-only" className="cursor-pointer font-normal">
            Only scope changes ({scopeCount})
          </Label>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes match this filter.</p>
      ) : (
        <Table caption="Field changes, newest first">
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Who</Th>
              <Th>Type</Th>
              <Th>Field</Th>
              <Th>Change</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <Tr
                key={`${c.rev}-${c.field}`}
                className={clsx(c.isScopeChange && 'bg-warn-soft/70')}
              >
                <Td className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatDateTime(c.changedAt)}
                </Td>
                <Td className="whitespace-nowrap">{c.changedBy?.displayName ?? 'System'}</Td>
                <Td>
                  <div className="flex flex-col items-start gap-1">
                    <Badge>{CHANGE_KIND_LABELS[c.kind] ?? c.kind}</Badge>
                    {c.isScopeChange ? <Badge tone="amber">Scope change</Badge> : null}
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-ink-soft">{c.field}</Td>
                <Td className="max-w-md min-w-64">
                  <span className="text-muted-foreground">
                    <TruncatedText text={c.oldValue} />
                  </span>
                  <span aria-hidden className="mx-1.5 text-faint">
                    →
                  </span>
                  <span className="sr-only"> changed to </span>
                  <TruncatedText text={c.newValue} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
