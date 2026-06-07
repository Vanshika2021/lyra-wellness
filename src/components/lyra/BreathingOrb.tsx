interface Props { active?: boolean; size?: number; }

export function BreathingOrb({ active = true, size = 220 }: Props) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* outer halo rings */}
      <div className="absolute inset-0 rounded-full" style={{
        background: "radial-gradient(circle, oklch(0.7 0.13 305 / 0.25), transparent 65%)",
        animation: active ? "breathe 8s ease-in-out infinite" : undefined,
      }} />
      <div className="absolute inset-6 rounded-full" style={{
        background: "radial-gradient(circle, oklch(0.85 0.08 15 / 0.2), transparent 70%)",
        animation: active ? "breathe 8s ease-in-out infinite reverse" : undefined,
      }} />
      {/* core orb */}
      <div
        className="relative rounded-full"
        style={{
          width: "60%",
          height: "60%",
          background: "var(--gradient-orb)",
          boxShadow: "var(--shadow-glow)",
          animation: active ? "breathe 8s ease-in-out infinite" : undefined,
        }}
      />
    </div>
  );
}
