import clsx from 'clsx';

/** Small diamond used for tab markers and the active-nav marker. */
export function DiamondMark({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className={clsx('size-2.5 shrink-0', className)}>
      <path
        d="M5 0.8 9.2 5 5 9.2 0.8 5Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={clsx('size-8 shrink-0', className)}>
      <rect width="32" height="32" rx="9" fill="#FDE4DA" />
      <g
        transform="translate(7 7) scale(0.75)"
        fill="none"
        stroke="#E4572E"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <path d="M7 11v4a2 2 0 0 0 2 2h4" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </g>
    </svg>
  );
}
