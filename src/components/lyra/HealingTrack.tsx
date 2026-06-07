import { useEffect, useRef, useState } from "react";
import { Play, Pause, Sparkles, Volume2, VolumeX } from "lucide-react";

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

function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function HealingTrack({ loading, url, bpm, error, distress }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!url) return;
    const a = new Audio(url);
    a.loop = false;
    audioRef.current = a;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => { setPlaying(false); setTime(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
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

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const v = Number(e.target.value);
    a.currentTime = v;
    setTime(v);
  };

  const beatsPerBreath = 8;
  const breathSec = bpm ? (60 / bpm) * beatsPerBreath : 6;
  const progress = duration > 0 ? (time / duration) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
      <div className="flex items-center justify-between px-6 pt-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your Healing Track · Audiovisual</p>
          <p className="mt-1 font-display text-xl text-foreground">{trackLabel(distress)}</p>
        </div>
        <Sparkles className="h-5 w-5 text-primary" />
      </div>

      {/* Unified audiovisual stage */}
      <div className="relative mt-4 aspect-video w-full overflow-hidden bg-background/40">
        {/* Ambient backdrop reacts to playback */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at 50% 55%, color-mix(in oklab, var(--primary) 35%, transparent), transparent 60%), var(--gradient-aurora)",
            animation: playing ? `bg-drift ${breathSec * 2}s ease-in-out infinite` : "none",
          }}
        />

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
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
          <div className="absolute inset-0 grid place-items-center px-6">
            <p className="text-center text-sm text-blush">{error}</p>
          </div>
        )}

        {url && !loading && (
          <>
            {/* Breathing visual — the "video" */}
            <div className="absolute inset-0 grid place-items-center">
              <div className="relative grid h-56 w-56 place-items-center sm:h-64 sm:w-64">
                <div
                  className="absolute inset-0 rounded-full opacity-60"
                  style={{
                    background: "var(--gradient-orb)",
                    filter: "blur(28px)",
                    animation: playing ? `breath-ring ${breathSec}s ease-in-out infinite` : "none",
                  }}
                />
                <div
                  className="absolute inset-4 rounded-full opacity-70"
                  style={{
                    background: "var(--gradient-orb)",
                    filter: "blur(10px)",
                    animation: playing ? `breath-ring ${breathSec}s ease-in-out infinite reverse` : "none",
                  }}
                />
                <div
                  className="relative h-36 w-36 rounded-full sm:h-40 sm:w-40"
                  style={{
                    background: "var(--gradient-orb)",
                    boxShadow: "var(--shadow-glow)",
                    animation: playing ? `breath-ball ${breathSec}s ease-in-out infinite` : "none",
                  }}
                />
                <p className="absolute -bottom-10 text-[10px] uppercase tracking-[0.3em] text-foreground/70">
                  {playing ? "Breathe with the sound" : "Press play to begin"}
                </p>
              </div>
            </div>

            {/* Center play overlay when paused */}
            {!playing && (
              <button
                onClick={toggle}
                className="absolute inset-0 grid place-items-center"
                aria-label="Play track"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition hover:scale-105">
                  <Play className="h-6 w-6 translate-x-0.5" />
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Player controls — one bar for the whole piece */}
      {url && !loading && (
        <div className="flex items-center gap-4 px-6 py-4">
          <button
            onClick={toggle}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
          </button>

          <div className="flex flex-1 items-center gap-3">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{fmtTime(time)}</span>
            <div className="relative flex-1">
              <div className="h-1 w-full rounded-full bg-border/60" />
              <div
                className="absolute inset-y-0 left-0 h-1 rounded-full"
                style={{ width: `${progress}%`, background: "var(--gradient-orb)" }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={time}
                onChange={seek}
                className="absolute inset-0 h-1 w-full cursor-pointer opacity-0"
                aria-label="Seek"
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{fmtTime(duration)}</span>
          </div>

          <button
            onClick={toggleMute}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/60 bg-card/50 text-foreground/80 backdrop-blur transition hover:bg-card"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {bpm && (
            <span className="hidden shrink-0 rounded-full border border-border/60 bg-card/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
              {bpm} BPM
            </span>
          )}
        </div>
      )}

      <style>{`
        @keyframes track-pulse {
          0%, 100% { transform: scale(0.92); opacity: 0.75; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes breath-ball {
          0%, 100% { transform: scale(0.82); }
          50% { transform: scale(1.14); }
        }
        @keyframes breath-ring {
          0%, 100% { transform: scale(0.88); opacity: 0.4; }
          50% { transform: scale(1.28); opacity: 0.85; }
        }
        @keyframes bg-drift {
          0%, 100% { transform: scale(1); filter: hue-rotate(0deg); }
          50% { transform: scale(1.06); filter: hue-rotate(12deg); }
        }
      `}</style>
    </div>
  );
}
