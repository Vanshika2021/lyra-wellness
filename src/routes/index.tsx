import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Sparkles } from "lucide-react";
import { BreathingOrb } from "@/components/lyra/BreathingOrb";
import { Waveform } from "@/components/lyra/Waveform";
import { MoodState } from "@/components/lyra/MoodState";
import { AudioPlayer } from "@/components/lyra/AudioPlayer";
import { extractVocalFeatures, buildMoodSignature, type MoodSignature, type VocalFeatures } from "@/lib/audio-features";
import brainHeatmapHigh from "@/assets/brain-heatmap-high.png";
import brainHeatmapMedium from "@/assets/brain-heatmap-medium.png";
import brainHeatmapLow from "@/assets/brain-heatmap-low.png";

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

function LyraSession() {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(42);
  const [transcript, setTranscript] = useState<string>("");
  const [replyText, setReplyText] = useState<string>("");
  const [replyAudioUrl, setReplyAudioUrl] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodSignature | null>(null);
  const [features, setFeatures] = useState<VocalFeatures | null>(null);
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

  // Cleanup object URLs
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
        } catch { /* Safari: no mic permission query, fall through */ }
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
        await processRecording(blob);
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

  async function processRecording(blob: Blob) {
    setProcessError(null);
    setTranscript("");
    setReplyText("");
    setMood(null);
    setFeatures(null);
    if (replyAudioUrl) { URL.revokeObjectURL(replyAudioUrl); setReplyAudioUrl(null); }

    try {
      // Kick off feature extraction in parallel with STT — pure client-side, no extra latency on the server side
      const featuresPromise = extractVocalFeatures(blob).catch((err) => {
        console.warn("vocal feature extraction failed", err);
        return null;
      });

      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const sttRes = await fetch("/api/elevenlabs/stt", { method: "POST", body: fd });
      if (!sttRes.ok) throw new Error((await sttRes.json())?.error || "Transcription failed");
      const { text } = (await sttRes.json()) as { text: string };
      const safeText = (text || "").trim() || "(I couldn't quite catch your words — I'm still here with you.)";
      setTranscript(safeText);

      const feats = await featuresPromise;
      let moodSig: MoodSignature | null = null;
      if (feats) {
        moodSig = buildMoodSignature(feats, safeText);
        setFeatures(feats);
        setMood(moodSig);
      }

      const replyRes = await fetch("/api/elevenlabs/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: safeText,
          vocalMood: moodSig?.descriptor,
          distress: moodSig?.distress,
          arousal: moodSig?.arousal,
        }),
      });
      if (!replyRes.ok) throw new Error((await replyRes.json())?.error || "Reply failed");
      const { reply, audio_base64 } = (await replyRes.json()) as { reply: string; audio_base64: string };
      setReplyText(reply);
      setReplyAudioUrl(`data:audio/mpeg;base64,${audio_base64}`);
    } catch (e) {
      setProcessError(e instanceof Error ? e.message : "Something went quiet. Please try again.");
    } finally {
      setState("results");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordedSeconds(Math.max(1, elapsed || 1));
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      r.stop(); // onstop runs processRecording → results
    } else {
      setState("results");
    }
  }
  function reset() {
    setElapsed(0);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
    if (replyAudioUrl) { URL.revokeObjectURL(replyAudioUrl); setReplyAudioUrl(null); }
    setTranscript("");
    setReplyText("");
    setProcessError(null);
    setMood(null);
    setFeatures(null);
    setState("idle");
  }

  const remaining = MAX_SECONDS - elapsed;
  const fmt = (s: number) => `0:${String(s).padStart(2, "0")}`;

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* aurora background */}
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-aurora)" }} />
      <div className="absolute inset-0 -z-10 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }} />

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10 sm:py-14">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "var(--gradient-orb)" }} />
            <span className="font-display text-xl tracking-wide text-foreground">Lyra</span>
          </div>
          <span className="rounded-full border border-border/60 bg-card/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
            Session · today
          </span>
        </header>

        {/* Greeting */}
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

        {/* Stage */}
        <section className="relative mt-10 flex flex-1 flex-col items-center justify-center">
          {/* Breathing orb stage — idle / recording / processing */}
          {state !== "results" && (
            <div className="relative flex flex-col items-center" style={{ animation: "float-slow 6s ease-in-out infinite" }}>
              <BreathingOrb active size={260} />
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
                  <span className="font-display italic">Listening with care…</span>
                </div>
              )}
            </div>
          )}

          {/* Action button — tap to toggle record */}
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

          {/* Results */}
          {state === "results" && (
            <div className="w-full space-y-6 animate-[fade-in_0.6s_ease-out]">
              <div className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your reflection</p>
                    <p className="mt-1 font-display text-xl text-foreground">A gentle reply, just for you</p>
                  </div>
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <AudioPlayer src={replyAudioUrl ?? undefined} duration={recordedSeconds} />
                {processError && (
                  <p className="mt-4 text-sm text-blush">{processError}</p>
                )}
                {replyText && (
                  <p className="mt-5 text-sm leading-relaxed text-foreground/90">
                    "{replyText}"
                  </p>
                )}
                {transcript && (
                  <div className="mt-5 border-t border-border/50 pt-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">What you shared</p>
                    <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground">"{transcript}"</p>
                  </div>
                )}
              </div>

              <MoodState distress={mood?.distress ?? 0.5} arousal={mood?.arousal ?? 0.5} />
              {features && (
                <div className="rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Voice signature</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/90">{mood?.descriptor}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { k: "Pitch", v: features.pitchMeanHz ? `${Math.round(features.pitchMeanHz)} Hz` : "—" },
                      { k: "Intonation", v: features.pitchVarHz ? `±${Math.round(features.pitchVarHz)} Hz` : "—" },
                      { k: "Pace", v: features.speechRateWps ? `${features.speechRateWps.toFixed(1)} w/s` : "—" },
                      { k: "Pauses", v: `${Math.round(features.pauseRatio * 100)}%` },
                    ].map((m) => (
                      <div key={m.k} className="rounded-2xl border border-border/50 bg-background/40 p-3">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80">{m.k}</p>
                        <p className="mt-1 font-mono text-sm text-foreground tabular-nums">{m.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
                <div className="px-6 pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Predicted Brain Response · Meta TRIBE v2</p>
                      <p className="mt-1 font-display text-xl text-foreground">
                        {(() => {
                          const d = mood?.distress ?? 0.5;
                          if (d >= 0.7) return "Elevated amygdala activation detected";
                          if (d >= 0.4) return "Moderate limbic engagement";
                          return "Calm regulation response";
                        })()}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary/70 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">Model · v0.2</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground/80">Directional guidance, not a clinical measurement</p>
                </div>
                <div className="relative mt-4 aspect-[16/10] w-full">
                  {(() => {
                    const d = mood?.distress ?? 0.5;
                    const src = d >= 0.7 ? brainHeatmapHigh : d >= 0.4 ? brainHeatmapMedium : brainHeatmapLow;
                    const alt = d >= 0.7 ? "Brain heatmap showing elevated amygdala activation" : d >= 0.4 ? "Brain heatmap showing moderate limbic engagement" : "Brain heatmap showing calm regulation response";
                    return <img src={src} alt={alt} loading="lazy" width={1024} height={640} className="h-full w-full object-cover" />;
                  })()}
                  <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, oklch(0.18 0.04 270 / 0.85))" }} />
                  <div className="absolute bottom-4 left-6 right-6 flex flex-wrap gap-2">
                    {[
                      { c: "var(--lavender)", t: "Prefrontal · soothing" },
                      { c: "var(--blush)", t: "Amygdala · tender" },
                      { c: "var(--amber-glow)", t: "Insula · warming" },
                    ].map((p) => (
                      <span key={p.t} className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-foreground backdrop-blur">
                        <span className="h-2 w-2 rounded-full" style={{ background: p.c, boxShadow: `0 0 10px ${p.c}` }} />
                        {p.t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <button onClick={reset} className="rounded-full border border-border/60 bg-card/50 px-6 py-3 text-sm text-foreground backdrop-blur transition hover:bg-card">
                  Begin another check-in
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
