import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = 'Pagination',
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <p className="text-sm text-muted-foreground tabular-nums">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          icon={<ChevronLeft aria-hidden className="size-4" />}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums" aria-current="page">
          Page {page} / {pages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
