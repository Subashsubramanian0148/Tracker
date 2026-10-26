import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  Popover as ShadPopover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/shadcn/popover';

interface PopoverProps {
  /** Renders the trigger; spread the given props onto a <button>. */
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-controls'?: string;
    'aria-haspopup': 'true' | 'dialog';
    onClick: () => void;
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  label: string;
  className?: string;
  panelClassName?: string;
  role?: 'dialog' | 'menu';
}

/** shadcn Popover: opens from its trigger, closes on Esc and outside click, returns focus. */
export function Popover({
  trigger,
  children,
  align = 'start',
  label,
  className,
  panelClassName,
  role = 'dialog',
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <ShadPopover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className={className}>
        {/* Radix toggles on click and sets aria-expanded/controls itself. */}
        {trigger({
          'aria-expanded': open,
          'aria-haspopup': role === 'menu' ? 'true' : 'dialog',
          onClick: () => {},
        })}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        aria-label={label}
        className={cn('w-auto min-w-56 p-1.5', panelClassName)}
      >
        {children(() => setOpen(false))}
      </PopoverContent>
    </ShadPopover>
  );
}
