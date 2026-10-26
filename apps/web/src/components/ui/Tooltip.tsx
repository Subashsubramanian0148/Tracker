import type { ReactNode } from 'react';
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/shadcn/tooltip';

interface TooltipProps {
  content: ReactNode;
  children: (props: {
    'aria-describedby': string | undefined;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  }) => ReactNode;
  className?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const noop = () => {};

/** shadcn Tooltip: hover and keyboard focus, Esc dismisses, collision-aware placement. */
export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
  return (
    <ShadTooltip>
      <TooltipTrigger asChild className={className}>
        {children({
          'aria-describedby': undefined,
          onMouseEnter: noop,
          onMouseLeave: noop,
          onFocus: noop,
          onBlur: noop,
        })}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-64">
        {content}
      </TooltipContent>
    </ShadTooltip>
  );
}

/** Wraps one element in a shadcn tooltip (replaces the browser's `title` hover text). No content, no tooltip. */
export function Hint({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  if (!content) return children;
  // Own provider so the hint also works outside the app shell (tests, isolated renders).
  return (
    <TooltipProvider delayDuration={200}>
      <ShadTooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-72">
          {content}
        </TooltipContent>
      </ShadTooltip>
    </TooltipProvider>
  );
}
