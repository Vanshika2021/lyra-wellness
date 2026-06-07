interface Props { active?: boolean; size?: number; bpm?: number | null }

export function BreathingOrb({ active = true, size = 220, bpm }: Props) {
  // A breath cycle = ~4 beats. Clamp to a calming range (5s..14s).
  const cycle = bpm && bpm > 0
    ? Math.min(14, Math.max(5, (60 / bpm) * 4))
    : 8;
  const dur = `${cycle}s`;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{
        background: "radial-gradient(circle, oklch(0.7 0.13 305 / 0.25), transparent 65%)",
        animation: active ? `breathe ${dur} ease-in-out infinite` : undefined,
      }} />
      <div className="absolute inset-6 rounded-full" style={{
        background: "radial-gradient(circle, oklch(0.85 0.08 15 / 0.2), transparent 70%)",
        animation: active ? `breathe ${dur} ease-in-out infinite reverse` : undefined,
      }} />
      <div
        className="relative rounded-full"
        style={{
          width: "60%",
          height: "60%",
          background: "var(--gradient-orb)",
          boxShadow: "var(--shadow-glow)",
          animation: active ? `breathe ${dur} ease-in-out infinite` : undefined,
        }}
      />
    </div>
  );
}
