import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article';
  padded?: boolean;
}

export function Card({
  as: Tag = 'section',
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={clsx(
        'rounded-xl border bg-card text-card-foreground shadow-sm',
        padded && 'p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 id={id} className="text-base font-semibold text-ink">
          {title}
        </h3>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
