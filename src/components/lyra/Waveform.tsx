interface Props { active?: boolean; bars?: number; }

export function Waveform({ active = true, bars = 32 }: Props) {
  return (
    <div className="flex h-16 items-center justify-center gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => {
        const h = 20 + Math.sin(i * 0.7) * 18 + Math.random() * 10;
        return (
          <span
            key={i}
            className="w-[3px] rounded-full bg-gradient-to-t from-primary/60 to-blush"
            style={{
              height: `${h}px`,
              animation: active ? `wave ${0.7 + (i % 5) * 0.15}s ease-in-out ${i * 0.04}s infinite` : undefined,
              transformOrigin: "center",
              opacity: active ? 1 : 0.35,
            }}
          />
        );
      })}
    </div>
  );
}
