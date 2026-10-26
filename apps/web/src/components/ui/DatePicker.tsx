import { format, parseISO } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/shadcn/button';
import { Calendar } from '@/components/shadcn/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/shadcn/popover';

interface DatePickerProps {
  id: string;
  /** yyyy-mm-dd, or '' for no date. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}

/** shadcn date picker (Popover + Calendar) in place of the browser's date input. */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Pick a date',
  invalid,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;
  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          aria-invalid={invalid || undefined}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full cursor-pointer justify-start bg-card pr-9 font-normal',
            !date && 'text-muted-foreground',
          )}
        >
          <CalendarIcon aria-hidden />
          {date ? format(date, 'd MMM yyyy') : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(d) => {
              onChange(d ? format(d, 'yyyy-MM-dd') : '');
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {date ? (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
