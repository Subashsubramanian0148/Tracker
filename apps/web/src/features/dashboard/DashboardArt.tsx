/**
 * The dashboard's side illustration: a design board with story cards moving across stages,
 * a small chart and a handoff arrow, drawn in the brand blues. Decorative only.
 */
export function DashboardArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 460 420" className={className} aria-hidden fill="none">
      {/* Soft backdrop */}
      <circle cx="240" cy="210" r="180" className="fill-brand-soft/60" />
      <circle cx="240" cy="210" r="130" className="fill-brand-soft" />

      {/* Board */}
      <g className="animate-drift-slow">
        <rect x="70" y="96" width="300" height="210" rx="18" className="fill-surface" />
        <path
          d="M70 132v-18a18 18 0 0 1 18-18h264a18 18 0 0 1 18 18v18z"
          className="fill-sidebar"
        />
        <rect x="70" y="96" width="300" height="210" rx="18" className="stroke-line" />
        <circle cx="92" cy="114" r="4" className="fill-line" />
        <circle cx="106" cy="114" r="4" className="fill-line" />
        <circle cx="120" cy="114" r="4" className="fill-line" />

        {/* Three stage columns */}
        {[0, 1, 2].map((c) => (
          <g key={c} transform={`translate(${88 + c * 94} 146)`}>
            <rect width="80" height="8" rx="4" className="fill-line" />
            {Array.from({ length: 3 - c }, (_, r) => (
              <g key={r} transform={`translate(0 ${18 + r * 44})`}>
                <rect width="80" height="36" rx="8" className="fill-sidebar stroke-line" />
                <rect x="10" y="10" width="44" height="5" rx="2.5" className="fill-line" />
                <rect x="10" y="21" width="28" height="5" rx="2.5" className="fill-primary/30" />
              </g>
            ))}
          </g>
        ))}
      </g>

      {/* A story card being handed over */}
      <g className="animate-drift">
        <rect
          x="276"
          y="236"
          width="96"
          height="44"
          rx="10"
          className="fill-surface stroke-primary/40"
          strokeWidth="1.5"
        />
        <rect x="288" y="248" width="52" height="6" rx="3" className="fill-primary/60" />
        <rect x="288" y="261" width="34" height="6" rx="3" className="fill-line" />
        <circle cx="356" cy="258" r="8" className="fill-emerald-100" />
        <path
          d="M352 258l3 3 5-6"
          className="stroke-emerald-600"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path
        d="M240 304c20 30 70 34 92-14"
        className="stroke-primary/40"
        strokeWidth="1.5"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />

      {/* Chart card */}
      <g className="animate-drift-slow" style={{ animationDelay: '-2s' }}>
        <rect x="300" y="44" width="124" height="88" rx="14" className="fill-surface stroke-line" />
        <rect x="314" y="58" width="48" height="6" rx="3" className="fill-line" />
        {[22, 36, 28, 48, 40].map((h, i) => (
          <rect
            key={i}
            x={316 + i * 20}
            y={118 - h}
            width="10"
            height={h}
            rx="3"
            className={i === 3 ? 'fill-primary' : 'fill-primary/25'}
          />
        ))}
      </g>

      {/* Person card */}
      <g className="animate-drift" style={{ animationDelay: '-1.5s' }}>
        <rect x="24" y="270" width="128" height="56" rx="14" className="fill-surface stroke-line" />
        <circle cx="50" cy="298" r="12" className="fill-brand-soft" />
        <circle cx="50" cy="294" r="4.5" className="fill-primary/50" />
        <path d="M42 305c2-5 14-5 16 0" className="stroke-primary/50" strokeWidth="2" />
        <rect x="70" y="290" width="62" height="6" rx="3" className="fill-line" />
        <rect x="70" y="302" width="40" height="6" rx="3" className="fill-amber-200" />
      </g>

      {/* Sparkles */}
      <path d="M60 70l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" className="fill-primary/30" />
      <path d="M410 330l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" className="fill-primary/25" />
      <circle cx="210" cy="56" r="4" className="fill-primary/20" />
      <circle cx="400" cy="184" r="3" className="fill-primary/25" />
    </svg>
  );
}
