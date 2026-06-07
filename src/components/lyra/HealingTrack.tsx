import { useEffect, useRef, useState } from "react";
import { Play, Pause, Sparkles } from "lucide-react";

interface Props {
  loading: boolean;
  url: string | null;
  bpm: number | null;
  error: string | null;
  distress: number;
}

function trackLabel(distress: number) {
  if (distress > 0.7) return "A slow minor piano — heavy held, then warmed";
  if (distress >= 0.4) return "Gentle acoustic guitar — soft, brightening";
  return "Soft uplifting ambient — warm, peaceful";
}

export function HealingTrack({ loading, url, bpm, error, distress }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!url) return;
    const a = new Audio(url);
    a.loop = true;
    audioRef.current = a;
    const onEnd = () => setPlaying(false);
    a.addEventListener("ended", onEnd);
    return () => {
      a.pause();
      a.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  // Breath cycle = one inhale + one exhale, mapped to ~8 beats of the track
  const beatsPerBreath = 8;
  const breathSec = bpm ? (60 / bpm) * beatsPerBreath : 6;

  return (
    <div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your Healing Track</p>
          <p className="mt-1 font-display text-xl text-foreground">{trackLabel(distress)}</p>
        </div>
        <Sparkles className="h-5 w-5 text-primary" />
      </div>

      {loading && (
        <div className="mt-6 flex flex-col items-center gap-4 py-6">
          <div
            className="h-20 w-20 rounded-full"
            style={{
              background: "var(--gradient-orb)",
              boxShadow: "var(--shadow-glow)",
              animation: "track-pulse 1.6s ease-in-out infinite",
            }}
          />
          <p className="font-display text-sm italic text-muted-foreground">Composing your track…</p>
        </div>
      )}

      {error && !loading && (
        <p className="mt-4 text-sm text-blush">{error}</p>
      )}

      {url && !loading && (
        <div className="mt-6 flex flex-col items-center gap-5">
          <div className="relative grid h-44 w-44 place-items-center">
            <div
              className="absolute inset-0 rounded-full opacity-60"
              style={{
                background: "var(--gradient-orb)",
                filter: "blur(18px)",
                animation: playing ? `breath-ring ${breathSec}s ease-in-out infinite` : "none",
              }}
            />
            <div
              className="relative h-32 w-32 rounded-full"
              style={{
                background: "var(--gradient-orb)",
                boxShadow: "var(--shadow-glow)",
                animation: playing ? `breath-ball ${breathSec}s ease-in-out infinite` : "none",
              }}
            />
            <button
              onClick={toggle}
              className="absolute grid h-14 w-14 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition hover:scale-105"
              aria-label={playing ? "Pause track" : "Play track"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {bpm ? `Breathe with the music · ${bpm} BPM` : "Breathe with the music"}
          </p>
        </div>
      )}

      <style>{`
        @keyframes track-pulse {
          0%, 100% { transform: scale(0.92); opacity: 0.75; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes breath-ball {
          0%, 100% { transform: scale(0.85); }
          50% { transform: scale(1.12); }
        }
        @keyframes breath-ring {
          0%, 100% { transform: scale(0.9); opacity: 0.45; }
          50% { transform: scale(1.25); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
