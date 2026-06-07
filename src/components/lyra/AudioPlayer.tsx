import { useEffect, useState } from "react";
import { Play, Pause } from "lucide-react";

export function AudioPlayer({ duration = 42 }: { duration?: number }) {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setT((v) => {
        if (v >= duration) { setPlaying(false); return duration; }
        return v + 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, duration]);

  const pct = (t / duration) * 100;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-4 rounded-full border border-border/60 bg-card/70 p-2 pl-2 pr-5 backdrop-blur-xl">
      <button
        onClick={() => { if (t >= duration) setT(0); setPlaying((p) => !p); }}
        className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105"
        style={{ boxShadow: "var(--shadow-glow)" }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
      </button>
      <div className="flex flex-1 items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{fmt(t)}</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--lavender), var(--blush))" }}
          />
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{fmt(duration)}</span>
      </div>
    </div>
  );
}
