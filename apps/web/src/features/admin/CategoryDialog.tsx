import type { DelayCategory } from '@ado-metrics/shared';
import { useState, type FormEvent } from 'react';
import { useUpsertDelayCategory } from '../../api/admin';
import { isApiError } from '../../api/client';
import { Label } from '@/components/shadcn/label';
import { Switch } from '@/components/shadcn/switch';
import { Button } from '../../components/ui/Button';
import { FieldWrapper, TextArea, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

type Errors = Partial<Record<'name' | 'description' | 'form', string>>;

interface CategoryDialogProps {
  open: boolean;
  /** Category being edited, or null to create a new one. */
  category: DelayCategory | null;
  onClose: () => void;
}

export function CategoryDialog({ open, category, onClose }: CategoryDialogProps) {
  // Re-mount the form for each open so fields start from the selected category.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Edit delay category' : 'New delay category'}
      description="Categories group delay reasons so trends are comparable across teams."
    >
      <CategoryForm key={category?.id ?? 'new'} category={category} onDone={onClose} />
    </Modal>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category: DelayCategory | null;
  onDone: () => void;
}) {
  const upsert = useUpsertDelayCategory();
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [active, setActive] = useState(category?.active ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [traceId, setTraceId] = useState<string | undefined>();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const v: Errors = {};
    if (name.trim().length < 2) v.name = 'Name must be at least 2 characters.';
    if (name.trim().length > 80) v.name = 'Keep the name under 80 characters.';
    if (description.length > 400) v.description = 'Keep the description under 400 characters.';
    setErrors(v);
    if (Object.keys(v).length) return;
    upsert.mutate(
      {
        id: category?.id,
        body: { name: name.trim(), description: description.trim() || null, active },
      },
      {
        onSuccess: () => {
          toast.success(category ? 'Category updated' : 'Category created');
          onDone();
        },
        onError: (err) => {
          if (!isApiError(err)) return setErrors({ form: 'Could not save the category.' });
          setTraceId(err.traceId);
          const mapped: Errors = {};
          for (const fe of err.errors) {
            const key = fe.path.split('.').pop();
            if (key === 'name' || key === 'description') mapped[key] ??= fe.message;
            else mapped.form ??= fe.message;
          }
          if (!Object.keys(mapped).length) mapped.form = err.detail ?? err.title;
          setErrors(mapped);
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
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
      <FieldWrapper
        id="cat-name"
        label="Name"
        required
        error={errors.name}
        hint={`${name.length} / 80`}
      >
        <TextInput
          id="cat-name"
          data-autofocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          invalid={!!errors.name}
          aria-describedby={errors.name ? 'cat-name-error cat-name-hint' : 'cat-name-hint'}
          aria-required
        />
      </FieldWrapper>
      <FieldWrapper
        id="cat-desc"
        label="Description"
        error={errors.description}
        hint={`${description.length} / 400`}
      >
        <TextArea
          id="cat-desc"
          value={description}
          maxLength={400}
          onChange={(e) => setDescription(e.target.value)}
          invalid={!!errors.description}
          aria-describedby={errors.description ? 'cat-desc-error cat-desc-hint' : 'cat-desc-hint'}
          className="min-h-20"
        />
      </FieldWrapper>
      <div className="flex items-center gap-3">
        <Switch
          id="cat-active"
          checked={active}
          onCheckedChange={setActive}
          className="cursor-pointer"
        />
        <Label htmlFor="cat-active" className="cursor-pointer font-normal">
          Active (available when adding delay reasons)
        </Label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={upsert.isPending}>
          {upsert.isPending ? 'Saving…' : category ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  );
}
