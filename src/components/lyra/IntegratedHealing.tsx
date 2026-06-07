import { useEffect, useRef, useState } from "react";
import { Play, Pause, Sparkles, Volume2, VolumeX } from "lucide-react";

interface Props {
  voiceUrl: string | null;
  musicUrl: string | null;
  musicBpm: number | null;
  musicLoading: boolean;
  musicError: string | null;
  replyText: string;
  distress: number;
}

function trackLabel(distress: number) {
  if (distress > 0.7) return "Slow minor piano · holding the weight with you";
  if (distress >= 0.4) return "Gentle acoustic guitar · softly brightening";
  return "Warm ambient · peaceful and grounding";
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Music sits underneath the voice. When the voice is speaking we duck the
// music down so the affirmation is clearly heard, then lift it back up.
const MUSIC_BASE = 0.42;
const MUSIC_DUCKED = 0.18;

export function IntegratedHealing({
  voiceUrl,
  musicUrl,
  musicBpm,
  musicLoading,
  musicError,
  replyText,
  distress,
}: Props) {
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceTime, setVoiceTime] = useState(0);
  const [voiceDur, setVoiceDur] = useState(0);
  const [voiceDone, setVoiceDone] = useState(false);

  // Build voice element
  useEffect(() => {
    if (!voiceUrl) return;
    const a = new Audio(voiceUrl);
    a.preload = "auto";
    voiceRef.current = a;
    const onTime = () => setVoiceTime(a.currentTime);
    const onMeta = () => setVoiceDur(a.duration || 0);
    const onEnd = () => {
      setVoiceDone(true);
      // Lift the music back up once the affirmation finishes
      if (musicRef.current) musicRef.current.volume = MUSIC_BASE;
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      voiceRef.current = null;
    };
  }, [voiceUrl]);

  // Build music element (looped, soft bed)
  useEffect(() => {
    if (!musicUrl) return;
    const m = new Audio(musicUrl);
    m.loop = true;
    m.preload = "auto";
    m.volume = MUSIC_BASE;
    musicRef.current = m;
    return () => {
      m.pause();
      musicRef.current = null;
    };
  }, [musicUrl]);

  const toggle = async () => {
    const v = voiceRef.current;
    const m = musicRef.current;

    if (playing) {
      v?.pause();
      m?.pause();
      setPlaying(false);
      return;
    }

    // Restart from the top if the affirmation already finished
    if (v && (voiceDone || (v.duration && v.currentTime >= v.duration - 0.05))) {
      v.currentTime = 0;
      setVoiceDone(false);
    }

    try {
      if (m) {
        // duck while voice is speaking
        m.volume = v && !voiceDone ? MUSIC_DUCKED : MUSIC_BASE;
        m.muted = muted;
        await m.play().catch(() => {});
      }
      if (v) {
        v.muted = muted;
        await v.play();
      }
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (voiceRef.current) voiceRef.current.muted = next;
    if (musicRef.current) musicRef.current.muted = next;
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = voiceRef.current;
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setVoiceTime(t);
    if (t < (v.duration || 0) - 0.05) setVoiceDone(false);
  };

  const beatsPerBreath = 8;
  const breathSec = musicBpm ? (60 / musicBpm) * beatsPerBreath : 6;
  const progress = voiceDur > 0 ? (voiceTime / voiceDur) * 100 : 0;

  const ready = !!voiceUrl && !!musicUrl && !musicLoading;

  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your healing session · voice + music</p>
          <p className="mt-1 font-display text-xl text-foreground">A gentle affirmation, held by sound</p>
          <p className="mt-1 text-xs text-muted-foreground">{trackLabel(distress)}</p>
        </div>
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
      </div>

      {/* Stage */}
      <div className="relative mt-4 aspect-video w-full overflow-hidden bg-background/40">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 55%, color-mix(in oklab, var(--primary) 38%, transparent), transparent 60%), var(--gradient-aurora)",
            animation: playing ? `bg-drift ${breathSec * 2}s ease-in-out infinite` : "none",
          }}
        />

        {musicLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div
              className="h-20 w-20 rounded-full"
              style={{
                background: "var(--gradient-orb)",
                boxShadow: "var(--shadow-glow)",
                animation: "track-pulse 1.6s ease-in-out infinite",
              }}
            />
            <p className="font-display text-sm italic text-muted-foreground">Composing your session…</p>
          </div>
        )}

        {musicError && !musicLoading && (
          <div className="absolute inset-0 grid place-items-center px-6">
            <p className="text-center text-sm text-blush">{musicError}</p>
          </div>
        )}

        {ready && (
          <>
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
                  {playing
                    ? voiceDone
                      ? "Stay · breathe · linger"
                      : "Listen · breathe with the sound"
                    : "Press play to begin"}
                </p>
              </div>
            </div>

            {!playing && (
              <button
                onClick={toggle}
                className="absolute inset-0 grid place-items-center"
                aria-label="Play session"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition hover:scale-105">
                  <Play className="h-6 w-6 translate-x-0.5" />
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Controls — single bar for the unified piece */}
      {ready && (
        <div className="flex items-center gap-4 px-6 py-4">
          <button
            onClick={toggle}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
          </button>

          <div className="flex flex-1 items-center gap-3">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{fmt(voiceTime)}</span>
            <div className="relative flex-1">
              <div className="h-1 w-full rounded-full bg-border/60" />
              <div
                className="absolute inset-y-0 left-0 h-1 rounded-full"
                style={{ width: `${progress}%`, background: "var(--gradient-orb)" }}
              />
              <input
                type="range"
                min={0}
                max={voiceDur || 0}
                step={0.1}
                value={voiceTime}
                onChange={seek}
                className="absolute inset-0 h-1 w-full cursor-pointer opacity-0"
                aria-label="Seek affirmation"
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{fmt(voiceDur)}</span>
          </div>

          <button
            onClick={toggleMute}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/60 bg-card/50 text-foreground/80 backdrop-blur transition hover:bg-card"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {musicBpm && (
            <span className="hidden shrink-0 rounded-full border border-border/60 bg-card/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
              {musicBpm} BPM
            </span>
          )}
        </div>
      )}

      {replyText && (
        <div className="border-t border-border/50 px-6 py-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Affirmation</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">"{replyText}"</p>
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
