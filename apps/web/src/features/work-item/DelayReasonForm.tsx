import type { CreateDelayReasonBody } from '@ado-metrics/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { isApiError } from '../../api/client';
import { useDelayCategories } from '../../api/delays';
import { useCreateDelayReason } from '../../api/workItems';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextArea, TextInput } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

const MIN = 10;
const MAX = 2000;

type Field = 'categoryId' | 'comment' | 'impactDays';
type Errors = Partial<Record<Field | 'form', string>>;

export function validateDelayReason(values: {
  categoryId: string;
  comment: string;
  impactDays: string;
}): Errors {
  const errors: Errors = {};
  if (!values.categoryId) errors.categoryId = 'Choose a category.';
  const len = values.comment.trim().length;
  if (len < MIN) errors.comment = `Please describe the delay (${MIN}+ characters).`;
  else if (len > MAX) errors.comment = `Keep it under ${MAX} characters.`;
  if (values.impactDays !== '') {
    const n = Number(values.impactDays);
    if (!Number.isFinite(n) || n < 0 || n > 365)
      errors.impactDays = 'Enter a number between 0 and 365.';
  }
  return errors;
}

/** Maps server 422 `errors[].path` (e.g. "comment" or "body.comment") onto form fields. */
function mapServerErrors(paths: { path: string; message: string }[]): Errors {
  const out: Errors = {};
  for (const e of paths) {
    const key = e.path
      .split(/[.[\]/]/)
      .filter(Boolean)
      .pop();
    if (key === 'categoryId' || key === 'comment' || key === 'impactDays') out[key] ??= e.message;
    else out.form ??= e.message;
  }
  return out;
}

export function DelayReasonForm({
  projectId,
  workItemId,
}: {
  projectId: string;
  workItemId: number;
}) {
  const categories = useDelayCategories();
  const create = useCreateDelayReason(projectId, workItemId);
  const toast = useToast();
  const [categoryId, setCategoryId] = useState('');
  const [comment, setComment] = useState('');
  const [impactDays, setImpactDays] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [traceId, setTraceId] = useState<string | undefined>();

  const active = categories.data?.filter((c) => c.active) ?? [];
  const clearError = (field: Field) =>
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v = validateDelayReason({ categoryId, comment, impactDays });
    setErrors(v);
    setTraceId(undefined);
    if (Object.keys(v).length > 0) {
      const first = (['categoryId', 'comment', 'impactDays'] as const).find((k) => v[k]);
      if (first) document.getElementById(`dr-${first}`)?.focus();
      return;
    }
    const body: CreateDelayReasonBody = {
      categoryId,
      comment: comment.trim(),
      impactDays: impactDays === '' ? null : Number(impactDays),
    };
    create.mutate(body, {
      onSuccess: () => {
        toast.success('Delay reason saved', 'Thanks — this helps the team learn from delays.');
        setCategoryId('');
        setComment('');
        setImpactDays('');
        setErrors({});
      },
      onError: (err) => {
        if (isApiError(err)) {
          setTraceId(err.traceId);
          const mapped = mapServerErrors(err.errors);
          if (Object.keys(mapped).length === 0) mapped.form = err.detail ?? err.title;
          setErrors(mapped);
        } else {
          setErrors({ form: 'Could not save the delay reason.' });
        }
      },
    });
  }

  if (categories.isPending) return <Skeleton className="h-64" />;

  const describe = (id: Field, hint?: boolean) =>
    [errors[id] ? `dr-${id}-error` : null, hint ? `dr-${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-labelledby="delay-form-title">
      <h4 id="delay-form-title" className="font-display text-base font-semibold">
        Add a delay reason
      </h4>
      {errors.form ? (
        <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {errors.form}
          {traceId ? (
            <span className="mt-1 block text-xs">
              Trace ID: <code className="select-all">{traceId}</code>
            </span>
          ) : null}
        </div>
      ) : null}
      <div>
        <Select
          id="dr-categoryId"
          label="Category"
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            clearError('categoryId');
          }}
          invalid={!!errors.categoryId}
          aria-describedby={describe('categoryId')}
          required
          options={[
            { value: '', label: active.length ? 'Choose a category…' : 'No categories available' },
            ...active.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        {errors.categoryId ? (
          <p id="dr-categoryId-error" className="mt-1 text-xs text-danger">
            {errors.categoryId}
          </p>
        ) : null}
        {categories.isError ? (
          <p className="mt-1 text-xs text-danger">
            Couldn’t load categories
            {isApiError(categories.error) && categories.error.traceId
              ? ` (trace ${categories.error.traceId})`
              : ''}
            .
          </p>
        ) : null}
      </div>
      <FieldWrapper
        id="dr-comment"
        label="What caused the delay?"
        required
        error={errors.comment}
        hint={`${comment.length} / ${MAX}`}
      >
        <TextArea
          id="dr-comment"
          value={comment}
          maxLength={MAX}
          onChange={(e) => {
            setComment(e.target.value);
            clearError('comment');
          }}
          invalid={!!errors.comment}
          aria-describedby={describe('comment', true)}
          aria-required
          placeholder="e.g. Waiting on the payments API contract from another team"
        />
      </FieldWrapper>
      <FieldWrapper
        id="dr-impactDays"
        label="Impact (days, optional)"
        error={errors.impactDays}
        hint="0–365"
      >
        <TextInput
          id="dr-impactDays"
          type="number"
          inputMode="decimal"
          min={0}
          max={365}
          step="0.5"
          value={impactDays}
          onChange={(e) => {
            setImpactDays(e.target.value);
            clearError('impactDays');
          }}
          invalid={!!errors.impactDays}
          aria-describedby={describe('impactDays', true)}
          className="max-w-40"
        />
      </FieldWrapper>
      <Button
        type="submit"
        variant="primary"
        disabled={create.isPending || active.length === 0}
        icon={<Plus aria-hidden className="size-4" />}
      >
        {create.isPending ? 'Saving…' : 'Add delay reason'}
      </Button>
    </form>
  );
}
