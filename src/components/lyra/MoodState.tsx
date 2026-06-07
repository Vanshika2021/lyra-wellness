interface Props { distress: number; arousal: number; } // 0..1

function labelAndDesc(
  v: number,
  lowLabel: string,
  midLabel: string,
  highLabel: string,
  lowDesc: string,
  midDesc: string,
  highDesc: string,
) {
  if (v < 0.34) return { label: lowLabel, desc: lowDesc };
  if (v < 0.67) return { label: midLabel, desc: midDesc };
  return { label: highLabel, desc: highDesc };
}

export function MoodState({ distress, arousal }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <RadialGauge
        title="Inner weather"
        value={distress}
        {...labelAndDesc(
          distress,
          "Settled",
          "Tender",
          "Stormy",
          "Your inner waters feel calm and clear.",
          "Some gentle waves beneath the surface.",
          "The sky feels heavy right now — and that's okay.",
        )}
        from="#a78bfa"
        to="#f87171"
      />
      <RadialGauge
        title="Energy"
        value={arousal}
        {...labelAndDesc(
          arousal,
          "Stilled",
          "Stirring",
          "Charged",
          "A quiet, restful stillness surrounds you.",
          "A quiet energy is beginning to rise.",
          "A lot of energy is moving through you.",
        )}
        from="#5eead4"
        to="#fbbf24"
      />
    </div>
  );
}

function RadialGauge({
  title,
  value,
  label,
  desc,
  from,
  to,
}: {
  title: string;
  value: number;
  label: string;
  desc: string;
  from: string;
  to: string;
}) {
  const pct = Math.round(value * 100);
  const r = 48;
  const cx = 64;
  const cy = 64;
  const circumference = 2 * Math.PI * r;
  const arcLength = circumference * 0.75; // 270-degree arc
  const gap = circumference - arcLength;
  const offset = gap / 2 + circumference * 0.125; // start at 135 degrees
  const dashOffset = arcLength - (value * arcLength);

  const gradientId = `grad-${title.replace(/\s/g, "")}`;

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{title}</p>
          <p className="mt-0.5 font-display text-xl text-foreground">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">{desc}</p>
        </div>
        <span className="font-mono text-sm tabular-nums text-muted-foreground/60">{pct}%</span>
      </div>

      <div className="relative mx-auto mt-5 flex h-40 w-40 items-center justify-center">
        <svg viewBox="0 0 128 128" className="h-full w-full">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
            <filter id={`blur-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${gap}`}
            strokeDashoffset={offset}
            opacity="0.35"
          />

          {/* Glow layer */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${gap}`}
            strokeDashoffset={offset + arcLength - value * arcLength}
            filter={`url(#blur-${gradientId})`}
            opacity="0.45"
          />

          {/* Active arc */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${gap}`}
            strokeDashoffset={offset + arcLength - value * arcLength}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)" }}
          />

          {/* Inner dot at the end of the arc */}
          {value > 0 && (
            <circle
              r="5"
              fill={to}
              style={{
                transition: "all 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <animateMotion
                dur="0.01s"
                fill="freeze"
                path={describeArc(cx, cy, r, 135, 135 + value * 270)}
              />
            </circle>
          )}
        </svg>

        {/* Center value */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl tabular-nums text-foreground">{pct}</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">score</span>
        </div>
      </div>

      <div className="mt-3 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground/60">
        <span>low</span>
        <span>high</span>
      </div>
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  // Convert angles to radians; subtract 90 because SVG 0° is at 3 o'clock
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [`M ${start.x} ${start.y}`, `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`].join(" ");
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}
