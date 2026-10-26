import type { AuditEntry } from '@ado-metrics/shared';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  useAuditLog,
  useVerifyAudit,
  type AuditParams,
  type AuditVerifyResult,
} from '../../api/admin';
import { isApiError } from '../../api/client';
import { SectionToolbar } from '../../app/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { DatePicker } from '../../components/ui/DatePicker';
import { TextInput } from '../../components/ui/Field';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/shadcn/collapsible';
import { Pagination } from '../../components/ui/Pagination';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { useRegisterExport } from '../../lib/exportStore';
import { formatDateTime } from '../../lib/format';
import { useMemo } from 'react';

const PAGE_SIZE = 50;

interface Filters {
  action: string;
  actorId: string;
  from: string; // yyyy-mm-dd from the date picker
  to: string;
}

const EMPTY: Filters = { action: '', actorId: '', from: '', to: '' };

function toParams(f: Filters, page: number): AuditParams {
  return {
    page,
    pageSize: PAGE_SIZE,
    action: f.action.trim() || undefined,
    actorId: f.actorId.trim() || undefined,
    from: f.from ? startOfDay(parseISO(f.from)).toISOString() : undefined,
    to: f.to ? endOfDay(parseISO(f.to)).toISOString() : undefined,
  };
}

function OutcomePill({ outcome }: { outcome: AuditEntry['outcome'] }) {
  if (outcome === 'success') return <Badge tone="success">Success</Badge>;
  if (outcome === 'denied') return <Badge tone="amber">Denied</Badge>;
  return <Badge tone="danger">Error</Badge>;
}

export function AuditTab() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const query = useAuditLog(toParams(applied, page));
  const invalidRange = !!draft.from && !!draft.to && draft.from > draft.to;

  const exportSource = useMemo(
    () =>
      query.data
        ? {
            filename: 'audit-log.csv',
            rows: query.data.items.map((a) => ({
              occurredAt: a.occurredAt,
              actor: a.actorName ?? a.actorId ?? '',
              action: a.action,
              targetType: a.targetType ?? '',
              targetId: a.targetId ?? '',
              outcome: a.outcome,
              ip: a.ip ?? '',
            })),
          }
        : null,
    [query.data],
  );
  useRegisterExport(exportSource);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (invalidRange) return;
    setApplied(draft);
    setPage(1);
  }

  return (
    <div>
      <SectionToolbar title="Audit log" right={<VerifyChain />} />
      <form
        onSubmit={onSubmit}
        className="mb-5 flex flex-wrap items-end gap-3"
        aria-label="Filter audit log"
      >
        <LabeledInput
          id="audit-action"
          label="Action"
          value={draft.action}
          maxLength={80}
          placeholder="e.g. people.view"
          onChange={(v) => setDraft((d) => ({ ...d, action: v }))}
        />
        <LabeledInput
          id="audit-actor"
          label="Actor ID"
          value={draft.actorId}
          maxLength={120}
          onChange={(v) => setDraft((d) => ({ ...d, actorId: v }))}
        />
        <LabeledInput
          id="audit-from"
          label="From"
          type="date"
          value={draft.from}
          onChange={(v) => setDraft((d) => ({ ...d, from: v }))}
        />
        <LabeledInput
          id="audit-to"
          label="To"
          type="date"
          value={draft.to}
          onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
          invalid={invalidRange}
        />
        <Button type="submit" variant="primary" disabled={invalidRange}>
          Apply
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setDraft(EMPTY);
            setApplied(EMPTY);
            setPage(1);
          }}
        >
          Clear
        </Button>
        {invalidRange ? (
          <p className="w-full text-xs text-danger" role="alert">
            “From” must be on or before “To”.
          </p>
        ) : null}
      </form>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <SkeletonRows rows={8} label="Loading audit log…" />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="No audit entries" description="No events match these filters." />
      ) : (
        <>
          <Table caption="Audit log entries, newest first">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Outcome</Th>
                <Th>IP</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap tabular-nums">{formatDateTime(a.occurredAt)}</Td>
                  <Td className="whitespace-nowrap">
                    {a.actorName ?? '—'}
                    {a.actorId ? (
                      <span className="block text-xs text-muted-foreground">{a.actorId}</span>
                    ) : null}
                  </Td>
                  <Td className="font-mono text-xs whitespace-nowrap">{a.action}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {a.targetType ? `${a.targetType}${a.targetId ? ` · ${a.targetId}` : ''}` : '—'}
                  </Td>
                  <Td>
                    <OutcomePill outcome={a.outcome} />
                  </Td>
                  <Td className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {a.ip ?? '—'}
                  </Td>
                  <Td className="min-w-64">
                    <Details details={a.details} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data.total}
            onPageChange={setPage}
            label="Audit log pages"
          />
        </>
      )}
    </div>
  );
}

/** Recomputes the SHA-256 hash chain and shows whether any entry was altered or removed. */
function VerifyChain() {
  const verify = useVerifyAudit();
  const toast = useToast();
  const [result, setResult] = useState<(AuditVerifyResult & { at: string }) | null>(null);

  function run() {
    verify.mutate(undefined, {
      onSuccess: (r) => setResult({ ...r, at: new Date().toISOString() }),
      onError: (e) =>
        toast.error(
          'Could not verify the audit log',
          isApiError(e)
            ? `${e.detail ?? e.title}${e.traceId ? ` · Trace ${e.traceId}` : ''}`
            : undefined,
        ),
    });
  }

  return (
    <>
      <span role="status" className="text-xs text-muted-foreground">
        {result ? (
          result.intact ? (
            <Badge
              tone="success"
              icon={<ShieldCheck aria-hidden className="size-3.5" />}
              title={`Checked ${formatDateTime(result.at)}`}
            >
              Chain intact · checked {formatDateTime(result.at)}
            </Badge>
          ) : (
            <Badge tone="danger" icon={<ShieldAlert aria-hidden className="size-3.5" />}>
              Chain broken at entry {result.firstBrokenId}
            </Badge>
          )
        ) : null}
      </span>
      <Button
        variant="secondary"
        disabled={verify.isPending}
        onClick={run}
        icon={<ShieldCheck aria-hidden className="size-4" />}
      >
        {verify.isPending ? 'Verifying…' : 'Verify integrity'}
      </Button>
    </>
  );
}

function LabeledInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  maxLength,
  placeholder,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {type === 'date' ? (
        <DatePicker
          id={id}
          value={value}
          onChange={onChange}
          placeholder="Any date"
          invalid={invalid}
          className="w-44"
        />
      ) : (
        <TextInput
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
          className="w-44"
        />
      )}
    </div>
  );
}

/** Details JSON rendered as preformatted text (never as HTML). */
function Details({ details }: { details: Record<string, unknown> | null }) {
  if (!details || Object.keys(details).length === 0) return <span className="text-faint">—</span>;
  const json = JSON.stringify(details, null, 2);
  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="cursor-pointer text-xs font-medium text-primary hover:underline">
        <span className="group-data-[state=open]:hidden">Show details</span>
        <span className="hidden group-data-[state=open]:inline">Hide details</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 max-h-64 max-w-md overflow-auto rounded-xl bg-sidebar p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-soft">
          {json}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
