import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Sparkles, Play, Pause } from "lucide-react";
import { BreathingOrb } from "@/components/lyra/BreathingOrb";
import { Waveform } from "@/components/lyra/Waveform";
import { MoodState } from "@/components/lyra/MoodState";
import type { MoodSignature, VocalFeatures } from "@/lib/audio-features";
import TribeBrain from "@/components/lyra/TribeBrain";
import { PHQ9Card, type PHQ9Result } from "@/components/lyra/PHQ9Card";
import ambientCalm from "@/assets/ambient-calm.mp4.asset.json";
import ambientWarm from "@/assets/ambient-warm.mp4.asset.json";
import ambientGrounded from "@/assets/ambient-grounded.mp4.asset.json";
import ambientNight from "@/assets/ambient-night.mp4.asset.json";

function pickAmbient(distress: number, arousal: number): string {
  // High distress → comforting warmth or quieting night depending on energy
  if (distress >= 0.6) return arousal >= 0.55 ? ambientWarm.url : ambientNight.url;
  // Lower distress → calm water for energetic, grounded forest for low-energy
  return arousal >= 0.55 ? ambientCalm.url : ambientGrounded.url;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lyra — Your safe space" },
      { name: "description", content: "A calming voice companion for women navigating PMDD. Record, reflect, and feel held." },
      { property: "og:title", content: "Lyra — Your safe space" },
      { property: "og:description", content: "A calming voice companion for women navigating PMDD." },
    ],
  }),
  component: LyraSession,
});

type State = "idle" | "recording" | "processing" | "results";

const MAX_SECONDS = 60;

const SESSION_ENDPOINT = "https://fxlysgacizwmecgbhjzs.supabase.co/functions/v1/session";
const SESSION_BEARER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4bHlzZ2FjaXp3bWVjZ2JoanpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MzM5MTgsImV4cCI6MjA5NjQwOTkxOH0.EFzw1i63ITG07LESKe_C1_0s5Uq4bPWMRH76az91cGs";

type SessionResponse = {
  transcript: string;
  state: { arousal: number; distress: number; valence: number };
  bpm: number;
  musicUrl: string;
  affirmations: string[];
};

function descriptorFor(s: { arousal: number; distress: number; valence: number }) {
  const tone = s.distress > 0.66 ? "tender and stormy" : s.distress > 0.33 ? "soft and uncertain" : "settled";
  const energy = s.arousal > 0.66 ? "charged" : s.arousal > 0.33 ? "stirring" : "still";
  const warmth = s.valence > 0.6 ? "with light coming through" : s.valence < 0.4 ? "with a heavy undertone" : "holding steady";
  return `Your voice sounds ${tone}, ${energy}, ${warmth}.`;
}

function LyraSession() {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [processError, setProcessError] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodSignature | null>(null);
  const [features, setFeatures] = useState<VocalFeatures | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [affirmations, setAffirmations] = useState<string[]>([]);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const [phq9, setPhq9] = useState<PHQ9Result | null>(null);
  const [phq9Loading, setPhq9Loading] = useState(false);
  const [phq9Error, setPhq9Error] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceAudiosRef = useRef<HTMLAudioElement[]>([]);
  const clonedVoiceIdRef = useRef<string | null>(null);
  const playTimeoutsRef = useRef<number[]>([]);
  const fadeIntervalsRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (state !== "recording") return;
    timerRef.current = window.setInterval(() => {
      setElapsed((v) => {
        if (v + 1 >= MAX_SECONDS) { stopRecording(); return MAX_SECONDS; }
        return v + 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function startRecording() {
    setMicError(null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }

    try {
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
          if (status.state === "denied") {
            setMicError("Microphone is blocked. Enable it in your browser settings to record.");
            return;
          }
        } catch { /* Safari */ }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : undefined;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setState("processing");
        // Kick off voice cloning in parallel so AI replies can sound like the user.
        clonedVoiceIdRef.current = null;
        const clonePromise = (async () => {
          try {
            const cf = new FormData();
            cf.append("audio", blob, "sample.webm");
            const cr = await fetch("/api/elevenlabs/clone", { method: "POST", body: cf });
            if (!cr.ok) return null;
            const cj = (await cr.json()) as { voiceId?: string };
            return cj.voiceId ?? null;
          } catch { return null; }
        })();
        await processRecording(blob, clonePromise);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setElapsed(0);
      setState("recording");
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError") setMicError("Microphone permission denied. Allow access to record.");
      else if (name === "NotFoundError") setMicError("No microphone was found on this device.");
      else if (name === "NotReadableError") setMicError("Your microphone is in use by another app.");
      else setMicError("Couldn't start recording. Please try again.");
    }
  }

  async function processRecording(blob: Blob, clonePromise?: Promise<string | null>) {
    setProcessError(null);
    setTranscript("");
    setMood(null);
    setFeatures(null);
    setBpm(null);
    setMusicUrl(null);
    setAffirmations([]);

    try {
      const fd = new FormData();
      fd.append("file", blob, "recording.webm");

      const res = await fetch(SESSION_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${SESSION_BEARER}` },
        body: fd,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Session failed: ${res.status}`);
      }
      const data = (await res.json()) as SessionResponse;

      const safeText = (data.transcript || "").trim() || "(I couldn't quite catch your words — I'm still here with you.)";
      setTranscript(safeText);

      const s = data.state ?? { arousal: 0.5, distress: 0.5, valence: 0.5 };
      const moodSig: MoodSignature = {
        distress: s.distress,
        arousal: s.arousal,
        descriptor: descriptorFor(s),
      };
      setMood(moodSig);
      setFeatures(null); // server-side state replaces local feature extraction
      setBpm(data.bpm ?? null);
      setMusicUrl(data.musicUrl ?? null);

      // Generate contextual affirmations from the user's own words + mood,
      // instead of using the server's generic ones.
      let affs: string[] = [];
      try {
        const aRes = await fetch("/api/affirmations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: safeText, state: s }),
        });
        if (aRes.ok) {
          const aJson = (await aRes.json()) as { affirmations?: string[] };
          if (Array.isArray(aJson.affirmations)) affs = aJson.affirmations.slice(0, 2);
        }
      } catch { /* fall through to server affirmations */ }
      if (affs.length < 2 && Array.isArray(data.affirmations)) {
        affs = data.affirmations.slice(0, 2);
      }
      setAffirmations(affs);

      void screenPhq9(safeText);
      // Wait briefly for the clone to finish (don't block UI long); fall back to default voice.
      const vid = clonePromise
        ? await Promise.race([
            clonePromise,
            new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 12000)),
          ])
        : null;
      clonedVoiceIdRef.current = vid;
      void loadAffirmationVoices(affs, vid ?? undefined);
    } catch (e) {
      setProcessError(e instanceof Error ? e.message : "Something went quiet. Please try again.");
    } finally {
      setState("results");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      r.stop();
    } else {
      setState("results");
    }
  }

  async function screenPhq9(text: string) {
    setPhq9(null);
    setPhq9Error(null);
    setCrisis(false);
    setPhq9Loading(true);
    try {
      const res = await fetch("/api/screen/phq9", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.crisis) setCrisis(true);
        throw new Error(json?.error || "Screening failed");
      }
      const isCrisis = Boolean(json?.crisis);
      const screening = json?.screening ?? null;
      setCrisis(isCrisis);
      setPhq9(screening);

      // Silently notify emergency contacts if severe distress detected
      const total = typeof screening?.total === "number" ? screening.total : 0;
      const sev = (screening?.severity || "").toLowerCase();
      const isSevere = isCrisis || total >= 15 || sev.includes("severe");
      if (isSevere) {
        fetch("/api/crisis-alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: isCrisis ? "crisis language detected" : `elevated PHQ-9 (${total})`,
            transcript: text,
          }),
        }).catch(() => {});
      }
    } catch (e) {
      setPhq9Error(e instanceof Error ? e.message : "Couldn't complete wellness insight.");
    } finally {
      setPhq9Loading(false);
    }
  }

  async function loadAffirmationVoices(items: string[], voiceId?: string) {
    // Cleanup any previously loaded voices
    voiceAudiosRef.current.forEach((a) => { a.pause(); a.src = ""; });
    voiceAudiosRef.current = [];
    setVoiceError(null);
    if (!items.length) return;
    setVoiceLoading(true);
    try {
      const results = await Promise.all(
        items.map(async (text) => {
          const res = await fetch("/api/elevenlabs/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(voiceId ? { text, voiceId } : { text }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j?.error || `TTS failed: ${res.status}`);
          }
          const json = (await res.json()) as { audio_base64: string };
          const audio = new Audio(`data:audio/mpeg;base64,${json.audio_base64}`);
          audio.preload = "auto";
          audio.volume = 0.95;
          return audio;
        }),
      );
      voiceAudiosRef.current = results;
    } catch (e) {
      setVoiceError(e instanceof Error ? e.message : "Couldn't prepare the spoken guidance.");
    } finally {
      setVoiceLoading(false);
    }
  }

  function fadeVolume(audio: HTMLAudioElement, target: number, ms = 600) {
    const start = audio.volume;
    const steps = 20;
    const stepMs = Math.max(10, ms / steps);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      const t = i / steps;
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * t));
      if (i >= steps) {
        window.clearInterval(id);
        fadeIntervalsRef.current = fadeIntervalsRef.current.filter((x) => x !== id);
      }
    }, stepMs);
    fadeIntervalsRef.current.push(id);
  }

  function clearScheduling() {
    playTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    playTimeoutsRef.current = [];
    fadeIntervalsRef.current.forEach((id) => window.clearInterval(id));
    fadeIntervalsRef.current = [];
  }

  function scheduleAffirmations() {
    const music = musicRef.current;
    const voices = voiceAudiosRef.current;
    if (!music || voices.length === 0) return;

    const INTRO_MS = 4000; // breathe into the music first
    const GAP_MS = 6000;   // gap between affirmations
    const PASSES = 2;       // loop each affirmation twice across the track
    const MUSIC_BED = 0.65;
    const MUSIC_DUCK = 0.18;

    let cursor = INTRO_MS;
    const sequence: string[] = [];
    for (let p = 0; p < PASSES; p += 1) sequence.push(...voices.map((_, i) => String(i)));

    sequence.forEach((idxStr) => {
      const idx = Number(idxStr);
      const startAt = cursor;
      const t1 = window.setTimeout(() => {
        const v = voiceAudiosRef.current[idx];
        if (!v || !musicRef.current) return;
        fadeVolume(musicRef.current, MUSIC_DUCK, 500);
        try { v.currentTime = 0; } catch { /* ignore */ }
        v.play().catch(() => {});
        const onEnd = () => {
          v.removeEventListener("ended", onEnd);
          const m = musicRef.current;
          if (m) {
            const t2 = window.setTimeout(() => fadeVolume(m, MUSIC_BED, 800), 700);
            playTimeoutsRef.current.push(t2);
          }
        };
        v.addEventListener("ended", onEnd);
      }, startAt);
      playTimeoutsRef.current.push(t1);
      // estimate 5s per affirmation + gap; real fade-back happens on `ended`
      cursor += 5000 + GAP_MS;
    });
  }

  function toggleMusic() {
    const el = musicRef.current;
    if (!el) return;
    if (el.paused) {
      el.volume = 0.65;
      el.play().then(() => {
        scheduleAffirmations();
      }).catch(() => {});
    } else {
      el.pause();
      voiceAudiosRef.current.forEach((v) => v.pause());
      clearScheduling();
    }
  }

  function reset() {
    setElapsed(0);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    setTranscript("");
    setProcessError(null);
    setMood(null);
    setFeatures(null);
    setBpm(null);
    setMusicUrl(null);
    setAffirmations([]);
    setMusicPlaying(false);
    setPhq9(null);
    setPhq9Error(null);
    setPhq9Loading(false);
    setCrisis(false);
    clearScheduling();
    voiceAudiosRef.current.forEach((a) => { a.pause(); a.src = ""; });
    voiceAudiosRef.current = [];
    setVoiceError(null);
    setVoiceLoading(false);
    setState("idle");
  }

  const remaining = MAX_SECONDS - elapsed;
  const fmt = (s: number) => `0:${String(s).padStart(2, "0")}`;

  const ambientSrc = pickAmbient(mood?.distress ?? 0.5, mood?.arousal ?? 0.5);
  const ambientRef = useRef<HTMLVideoElement | null>(null);
  const showAmbient = state === "results" && musicPlaying;
  useEffect(() => {
    const el = ambientRef.current;
    if (!el) return;
    if (showAmbient) { el.play().catch(() => {}); }
    else { el.pause(); }
  }, [showAmbient, ambientSrc]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Mood-tuned ambient backdrop — plays only while the affirmation track is playing */}
      <div
        className="pointer-events-none fixed inset-0 -z-20 transition-opacity duration-[1600ms] ease-out"
        style={{ opacity: showAmbient ? 1 : 0 }}
        aria-hidden="true"
      >
        <video
          ref={ambientRef}
          src={ambientSrc}
          muted
          loop
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
          style={{ filter: "blur(2px) saturate(1.05)" }}
        />
        {/* Soft scrim so foreground text stays readable */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, rgba(8,8,16,0.35), rgba(8,8,16,0.72))" }}
        />
      </div>

      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-aurora)", opacity: showAmbient ? 0.35 : 1, transition: "opacity 1.6s ease-out" }} />
      <div className="absolute inset-0 -z-10 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }} />

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10 sm:py-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "var(--gradient-orb)" }} />
            <span className="font-display text-xl tracking-wide text-foreground">Lyra</span>
          </div>
          <span className="rounded-full border border-border/60 bg-card/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
            Session · today
          </span>
        </header>

        <section className="mt-10 text-center sm:mt-14">
          <h1 className="font-display text-4xl leading-[1.1] text-foreground sm:text-5xl">
            Hi, how are you<br />
            <em className="not-italic" style={{
              background: "linear-gradient(90deg, var(--lavender), var(--blush), var(--amber-glow))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>feeling today?</em>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            This is your safe space. Speak freely — Lyra is listening.
          </p>
        </section>

        <section className="relative mt-10 flex flex-1 flex-col items-center justify-center">
          {state !== "results" && (
            <div className="relative flex flex-col items-center" style={{ animation: "float-slow 6s ease-in-out infinite" }}>
              <BreathingOrb active size={260} bpm={bpm} />
              {state === "idle" && (
                <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">Breathe · in · out</p>
              )}
              {state === "recording" && (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <Waveform active />
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blush" />
                    <span className="font-mono text-2xl tabular-nums text-foreground">{fmt(remaining)}</span>
                  </div>
                </div>
              )}
              {state === "processing" && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                  <span className="font-display italic">Listening to you…</span>
                </div>
              )}
            </div>
          )}

          {(state === "idle" || state === "recording") && (
            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  if (state === "idle") startRecording();
                  else stopRecording();
                }}
                className={`group inline-flex items-center gap-3 rounded-full px-7 py-4 transition ${
                  state === "recording"
                    ? "scale-105 bg-blush text-background"
                    : "bg-primary text-primary-foreground hover:scale-[1.02]"
                }`}
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                {state === "recording" ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span className="font-medium">
                  {state === "recording" ? "Tap to finish" : "Tap to speak"}
                </span>
              </button>
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                {state === "recording" ? `Recording… ${fmt(remaining)} remaining` : "Up to 60 seconds"}
              </p>
              {micError && (
                <p className="max-w-xs text-center text-xs text-blush">{micError}</p>
              )}
            </div>
          )}

          {state === "results" && (
            <div className="w-full space-y-6 animate-[fade-in_0.6s_ease-out]">
              {/* Breathing orb tuned to returned BPM */}
              <div className="flex flex-col items-center">
                <BreathingOrb active size={220} bpm={bpm} />
                {bpm && (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Breathing with you
                  </p>
                )}
              </div>

              {/* Affirmations — editorial serif, like a printed poem */}
              {affirmations.length > 0 && (
                <div
                  className="rounded-3xl border border-border/60 bg-card/60 px-4 py-7 text-center backdrop-blur-xl sm:px-8 sm:py-10"
                  style={{ boxShadow: "var(--shadow-soft)" }}
                >
                  <div className="mx-auto max-w-xs space-y-7 sm:space-y-10">
                    {affirmations.map((a, i) => (
                      <p
                        key={i}
                        className="text-balance text-[1.1rem] italic leading-[1.5] text-foreground/90 sm:text-[1.25rem] sm:leading-[1.45]"
                        style={{
                          fontFamily: '"Instrument Serif", Fraunces, Georgia, serif',
                          fontWeight: 400,
                          letterSpacing: "0.005em",
                          animation: `fade-in 1.2s ease-out ${i * 0.4}s both`,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="mr-1 align-[-0.15em] text-foreground/30"
                          style={{ fontFamily: '"Instrument Serif", serif', fontSize: "1.4em" }}
                        >
                          “
                        </span>
                        {a}
                        <span
                          aria-hidden="true"
                          className="ml-1 align-[-0.15em] text-foreground/30"
                          style={{ fontFamily: '"Instrument Serif", serif', fontSize: "1.4em" }}
                        >
                          ”
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Music player */}
              {musicUrl && (
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
                  <audio
                    ref={musicRef}
                    src={musicUrl}
                    preload="auto"
                    onPlay={() => setMusicPlaying(true)}
                    onPause={() => setMusicPlaying(false)}
                    onEnded={() => setMusicPlaying(false)}
                  />
                  <button
                    onClick={toggleMusic}
                    className="inline-flex items-center gap-3 rounded-full bg-primary/90 px-6 py-3 text-primary-foreground transition hover:scale-[1.02]"
                    style={{ boxShadow: "var(--shadow-glow)" }}
                  >
                    {musicPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    <span className="font-medium">{musicPlaying ? "Pause your track" : "Play your track"}</span>
                  </button>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {voiceLoading
                      ? "Weaving your affirmations into the music…"
                      : voiceError
                        ? "Music only — affirmations couldn't be voiced"
                        : voiceAudiosRef.current.length > 0
                          ? "Affirmations will rise softly over the music"
                          : "A track shaped for this moment"}
                  </p>
                </div>
              )}

              {processError && (
                <p className="text-center text-sm text-blush">{processError}</p>
              )}

              {transcript && (
                <div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">What I heard</p>
                  <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground">"{transcript}"</p>
                </div>
              )}

              <MoodState distress={mood?.distress ?? 0.5} arousal={mood?.arousal ?? 0.5} />
              <PHQ9Card result={phq9} loading={phq9Loading} error={phq9Error} crisis={crisis} />

              <TribeBrain mood={mood} features={features} />


              <div className="flex justify-center pt-2">
                <button onClick={reset} className="rounded-full border border-border/60 bg-card/50 px-6 py-3 text-sm text-foreground backdrop-blur transition hover:bg-card">
                  New check-in
                </button>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-12 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
          Lyra · made with care for cycles
        </footer>
      </div>
    </main>
  );
}
