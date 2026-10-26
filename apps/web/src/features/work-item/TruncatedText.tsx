import { useState } from 'react';

/** Plain-text value truncated to `max` characters with an accessible expand toggle. */
export function TruncatedText({ text, max = 120 }: { text: string | null; max?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (text === null || text === '') return <span className="text-faint">empty</span>;
  if (text.length <= max) return <span className="break-words whitespace-pre-wrap">{text}</span>;
  return (
    <span className="break-words whitespace-pre-wrap">
      {expanded ? text : `${text.slice(0, max).trimEnd()}…`}{' '}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="text-xs font-medium whitespace-nowrap text-primary underline-offset-2 hover:underline"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </span>
  );
}
