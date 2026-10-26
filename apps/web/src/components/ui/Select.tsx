import { cn } from '@/lib/utils';
import { Label } from '@/components/shadcn/label';
import {
  Select as ShadSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  /** Visually hide the label (it stays available to assistive tech). */
  hideLabel?: boolean;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Classes for the trigger itself (size, padding), not the wrapper. */
  triggerClassName?: string;
}

// Radix items can't use '' as a value; map it to a sentinel and back.
const EMPTY = '__empty__';

/** shadcn Select (Radix): typeahead, arrow keys, and a hidden native select for forms. */
export function Select({
  label,
  hideLabel,
  options,
  value,
  onChange,
  className,
  triggerClassName,
  invalid,
  id,
  required,
  disabled,
}: SelectProps) {
  const selectId = id ?? `sel-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label
        htmlFor={selectId}
        className={cn('text-xs text-muted-foreground', hideLabel && 'sr-only')}
      >
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </Label>
      <ShadSelect
        value={value === '' ? EMPTY : value}
        onValueChange={(v) => onChange(v === EMPTY ? '' : v)}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger
          id={selectId}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={cn('w-full cursor-pointer bg-card', triggerClassName)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value || EMPTY} value={o.value || EMPTY}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadSelect>
    </div>
  );
}
