import type { DelayCategory } from '@ado-metrics/shared';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useDelayCategories } from '../../api/delays';
import { SectionToolbar } from '../../app/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { SkeletonRows } from '../../components/ui/Skeleton';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { CategoryDialog } from './CategoryDialog';

export function CategoriesTab() {
  const categories = useDelayCategories();
  const [editing, setEditing] = useState<DelayCategory | null>(null);
  const [open, setOpen] = useState(false);

  const openFor = (c: DelayCategory | null) => {
    setEditing(c);
    setOpen(true);
  };

  return (
    <div>
      <SectionToolbar
        title="Delay categories"
        right={
          <Button
            variant="primary"
            icon={<Plus aria-hidden className="size-4" />}
            onClick={() => openFor(null)}
          >
            New category
          </Button>
        }
      />
      {categories.isError ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
      ) : categories.isPending ? (
        <SkeletonRows rows={5} label="Loading categories…" />
      ) : categories.data.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create categories such as “External dependency” or “Unclear requirements”."
        />
      ) : (
        <Table caption="Delay categories">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Description</Th>
              <Th>Status</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {categories.data.map((c) => (
              <Tr key={c.id}>
                <Td className="font-medium whitespace-nowrap">{c.name}</Td>
                <Td className="max-w-lg min-w-60 text-muted-foreground">{c.description ?? '—'}</Td>
                <Td>{c.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openFor(c)}
                    icon={<Pencil aria-hidden className="size-3.5" />}
                  >
                    Edit<span className="sr-only"> {c.name}</span>
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <CategoryDialog open={open} category={editing} onClose={() => setOpen(false)} />
    </div>
  );
}
