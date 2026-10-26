import clsx from 'clsx';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/** Scrollable table wrapper: wide tables scroll inside the card, never the page. */
export function Table({
  caption,
  children,
  className,
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx('relative overflow-x-auto rounded-lg border bg-card', className)}
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={clsx(
        'h-10 border-b bg-muted/50 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={clsx('border-b px-3 py-2.5 align-top', className)} {...rest}>
      {children}
    </td>
  );
}

export function Tr({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={clsx('transition-colors hover:bg-muted/50 last:[&>td]:border-b-0', className)}
      {...rest}
    >
      {children}
    </tr>
  );
}
