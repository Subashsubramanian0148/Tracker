import clsx from 'clsx';
import { badgeVariants } from '@/components/shadcn/badge';
import { Hint } from './Tooltip';
import type { ReactNode } from 'react';

type Tone = 'neutral' | 'teal' | 'orange' | 'amber' | 'success' | 'danger' | 'info' | 'dark';

const tones: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  teal: 'bg-primary text-primary-foreground',
  orange: 'bg-warn-strong text-white',
  amber: 'bg-amber-soft text-amber-ink',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-accent text-accent-foreground',
  dark: 'bg-foreground text-background',
};

interface BadgeProps {
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  title?: string;
}

/** Rectangular-ish chip for statuses and metadata. */
export function Badge({ tone = 'neutral', icon, className, children, title }: BadgeProps) {
  return (
    <Hint content={title}>
      <span
        tabIndex={title ? 0 : undefined}
        className={clsx(
          badgeVariants({ variant: 'outline' }),
          'border-transparent',
          tones[tone],
          className,
        )}
      >
        {icon}
        {children}
      </span>
    </Hint>
  );
}

/** Small round count badge used in the sidebar and column headers. */
export function CountBadge({
  value,
  tone = 'teal',
  label,
}: {
  value: string | number;
  tone?: 'teal' | 'orange' | 'grey';
  label?: string;
}) {
  return (
    <span
      aria-label={label}
      className={clsx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums',
        tone === 'teal' && 'bg-primary text-primary-foreground',
        tone === 'orange' && 'bg-warn-strong text-white',
        tone === 'grey' && 'bg-secondary text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}
