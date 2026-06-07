import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

export function AudioPlayer({ src, duration: durationProp = 42 }: { src?: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(durationProp);

  useEffect(() => {
    if (!src) return;
    const a = new Audio(src);
    audioRef.current = a;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => {
      if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    };
    const onEnd = () => { setPlaying(false); setT(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("durationchange", onMeta);
      a.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [src]);

  // Fallback fake progress when no src
  useEffect(() => {
    if (src || !playing) return;
    const id = setInterval(() => {
      setT((v) => {
        if (v >= duration) { setPlaying(false); return duration; }
        return v + 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, duration, src]);

  const toggle = () => {
    const a = audioRef.current;
    if (a) {
      if (a.ended || a.currentTime >= duration) a.currentTime = 0;
      if (playing) { a.pause(); setPlaying(false); }
      else { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
    } else {
      if (t >= duration) setT(0);
      setPlaying((p) => !p);
    }
  };

  const pct = duration > 0 ? (t / duration) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-4 rounded-full border border-border/60 bg-card/70 p-2 pl-2 pr-5 backdrop-blur-xl">
      <button
        onClick={toggle}
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
