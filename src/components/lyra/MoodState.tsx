interface Props { distress: number; arousal: number; } // 0..1

const label = (v: number, low: string, mid: string, high: string) =>
  v < 0.34 ? low : v < 0.67 ? mid : high;

export function MoodState({ distress, arousal }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Dial
        title="Inner weather"
        value={distress}
        word={label(distress, "Settled", "Tender", "Stormy")}
        from="oklch(0.78 0.09 305)"
        to="oklch(0.7 0.16 15)"
      />
      <Dial
        title="Energy"
        value={arousal}
        word={label(arousal, "Stilled", "Stirring", "Charged")}
        from="oklch(0.78 0.09 200)"
        to="oklch(0.85 0.12 70)"
      />
    </div>
  );
}

function Dial({ title, value, word, from, to }: { title: string; value: number; word: string; from: string; to: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</span>
        <span className="font-display text-lg text-foreground">{word}</span>
      </div>
      <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-secondary/60">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 20px ${to}` }}
        />
      </div>
      <div className="mt-3 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground/70">
        <span>low</span><span>high</span>
      </div>
    </div>
  );
}
