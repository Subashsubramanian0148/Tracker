import clsx from 'clsx';
import { avatarColor, initials } from '../../lib/format';
import { Hint } from './Tooltip';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const sizes: Record<Size, string> = {
  xs: 'size-6 text-[10px]',
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-12 text-base',
};

interface AvatarProps {
  name: string | null | undefined;
  /** Stable seed for the colour (person id); falls back to the name. */
  seed?: string;
  size?: Size;
  className?: string;
  /** When true the avatar is decorative (name shown next to it). */
  decorative?: boolean;
}

/** Initials avatar with a deterministic colour (we have no profile photos). */
export function Avatar({ name, seed, size = 'sm', className, decorative = true }: AvatarProps) {
  if (!name) {
    return (
      <span
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : 'Unassigned'}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-faint text-faint',
          sizes[size],
          className,
        )}
      >
        ?
      </span>
    );
  }
  return (
    <Hint content={decorative ? undefined : name}>
      <span
        aria-hidden={decorative || undefined}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : name}
        className={clsx(
          'inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold',
          avatarColor(seed ?? name),
          sizes[size],
          className,
        )}
      >
        {initials(name)}
      </span>
    </Hint>
  );
}

export function AvatarStack({
  people,
  max = 4,
  label,
}: {
  people: { id: string; displayName: string }[];
  max?: number;
  label: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center" role="group" aria-label={label}>
      <ul className="flex -space-x-2">
        {shown.map((p) => (
          <li key={p.id}>
            <Avatar
              name={p.displayName}
              seed={p.id}
              size="md"
              decorative={false}
              className="ring-2 ring-surface"
            />
          </li>
        ))}
      </ul>
      {extra > 0 ? (
        <span className="-ml-2 inline-flex size-9 items-center justify-center rounded-full bg-pill text-xs font-semibold text-ink-soft ring-2 ring-surface">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
