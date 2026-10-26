import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ToggleGroup, ToggleGroupItem } from '@/components/shadcn/toggle-group';

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: Segment<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** shadcn ToggleGroup (single): arrow keys move focus, one option always selected. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn('max-w-full overflow-x-auto rounded-lg bg-muted p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-8 shrink-0 cursor-pointer gap-1.5 rounded-md! border-0 px-3 text-[13px] whitespace-nowrap text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {o.icon}
          {o.label}
          {o.count !== undefined ? (
            <span className="rounded-full bg-secondary px-1.5 text-[11px] tabular-nums">
              {o.count}
            </span>
          ) : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
