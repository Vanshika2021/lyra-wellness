import { useMemo } from "react";
import type { MoodSignature, VocalFeatures } from "@/lib/audio-features";

// TRIBE v2 — Tonal Resonance & Inflection-Based Estimation
// A transparent, heuristic mapping from vocal features to plausible
// neural correlates. Not a clinical measurement — directional only.
// Each region's activation (0..1) is a documented formula over the
// extracted vocal features, so the visualization actually changes with
// what the user said and how they said it.

type Props = {
  mood: MoodSignature | null;
  features: VocalFeatures | null;
};

type Region = {
  id: string;
  name: string;
  role: string;
  // SVG ellipse coords inside a 400x260 viewBox (lateral brain silhouette)
  cx: number; cy: number; rx: number; ry: number;
  color: string;     // glow color
  activation: number; // 0..1
  driver: string;    // human-readable formula driver
  meaning: string;   // plain-English interpretation
};

function activationLabel(v: number): { label: string; tone: string } {
  if (v >= 0.75) return { label: "Highly active", tone: "oklch(0.78 0.16 25)" };
  if (v >= 0.55) return { label: "Engaged",       tone: "oklch(0.80 0.14 60)" };
  if (v >= 0.35) return { label: "Steady",        tone: "oklch(0.78 0.10 200)" };
  return            { label: "Quiet",          tone: "oklch(0.70 0.05 250)" };
}

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }

export default function TribeBrain({ mood, features }: Props) {
  const regions = useMemo<Region[]>(() => {
    const d = mood?.distress ?? 0.5;
    const a = mood?.arousal ?? 0.5;
    const f = features;

    // Normalize a few features the same way buildMoodSignature does
    const energy        = f ? clamp01(f.rmsMean / 0.18) : 0.5;
    const dynamics      = f ? clamp01(Math.sqrt(f.rmsVar) / 0.08) : 0.5;
    const pitchHi       = f ? clamp01((f.pitchMeanHz - 110) / 140) : 0.5;
    const pitchExpr     = f ? clamp01(f.pitchVarHz / 45) : 0.5;
    const fast          = f ? clamp01((f.speechRateWps - 1.6) / 2.2) : 0.5;
    const pausy         = f ? clamp01(f.pauseRatio / 0.45) : 0.3;
    const voiced        = f ? clamp01(f.voicedRatio / 0.6) : 0.5;

    return [
      {
        id: "amygdala",
        name: "Amygdala",
        role: "threat / emotional salience",
        cx: 232, cy: 168, rx: 22, ry: 16,
        color: "oklch(0.68 0.20 25)",
        activation: clamp01(0.55 * d + 0.25 * pitchHi + 0.20 * dynamics),
        driver: "distress · pitch height · vocal dynamics",
        meaning: "Your alarm system. When this lights up, your body is registering something that feels unsafe or overwhelming.",
      },
      {
        id: "pfc",
        name: "Prefrontal Cortex",
        role: "top-down regulation",
        cx: 110, cy: 110, rx: 58, ry: 36,
        color: "oklch(0.75 0.14 230)",
        activation: clamp01(0.6 * (1 - d) + 0.25 * (1 - fast) + 0.15 * voiced),
        driver: "calm (low distress) · slower pace · steady voicing",
        meaning: "The grown-up in the room — the part of you reflecting, choosing words carefully, and soothing yourself in real time.",
      },
      {
        id: "insula",
        name: "Insula",
        role: "interoception / feeling intensity",
        cx: 198, cy: 150, rx: 26, ry: 18,
        color: "oklch(0.78 0.16 60)",
        activation: clamp01(0.5 * energy + 0.3 * dynamics + 0.2 * a),
        driver: "loudness · dynamics · arousal",
        meaning: "How loudly your body is talking to you — tightness in the chest, heat, butterflies. High here means you're feeling a lot, physically.",
      },
      {
        id: "acc",
        name: "Anterior Cingulate",
        role: "conflict & attention",
        cx: 165, cy: 110, rx: 30, ry: 18,
        color: "oklch(0.74 0.18 320)",
        activation: clamp01(0.5 * a + 0.3 * fast + 0.2 * pitchExpr),
        driver: "arousal · speech rate · intonation variance",
        meaning: "The part that notices when something's off. High activity often means you're holding two feelings at once, or weighing a hard choice.",
      },
      {
        id: "auditory",
        name: "Auditory / Broca",
        role: "speech production & prosody",
        cx: 268, cy: 140, rx: 30, ry: 22,
        color: "oklch(0.80 0.16 150)",
        activation: clamp01(0.5 * pitchExpr + 0.3 * voiced + 0.2 * (1 - pausy)),
        driver: "intonation · voicing · continuity",
        meaning: "Your storytelling self — how expressively and fluidly the words are coming out. Quiet here can mean searching for words.",
      },
      {
        id: "brainstem",
        name: "Brainstem / Locus Coeruleus",
        role: "global arousal tone",
        cx: 250, cy: 200, rx: 16, ry: 12,
        color: "oklch(0.78 0.14 35)",
        activation: clamp01(0.7 * a + 0.3 * energy),
        driver: "arousal · energy",
        meaning: "The dial on your nervous system. Higher means more revved up; lower means calmer, more settled, or tired.",
      },
    ];
  }, [mood, features]);

  const headline = useMemo(() => {
    const top = [...regions].sort((a, b) => b.activation - a.activation)[0];
    if (!top) return "Listening…";
    return `${top.name} most engaged · ${Math.round(top.activation * 100)}%`;
  }, [regions]);

  const narrative = useMemo(() => {
    const byId = Object.fromEntries(regions.map((r) => [r.id, r.activation])) as Record<string, number>;
    const amy = byId.amygdala ?? 0.5;
    const pfc = byId.pfc ?? 0.5;
    const ins = byId.insula ?? 0.5;
    const acc = byId.acc ?? 0.5;
    const stem = byId.brainstem ?? 0.5;

    const parts: string[] = [];

    // Regulation vs threat balance
    if (pfc > amy + 0.1) {
      parts.push("Your regulating mind is leading right now — you're staying with the feeling without being swept by it.");
    } else if (amy > pfc + 0.1) {
      parts.push("Your alarm system is louder than your soothing system at the moment. That's a signal you may need care, not criticism.");
    } else {
      parts.push("Your alarm and your regulation are in close conversation — you're holding something hard, and you're holding it.");
    }

    // Body load
    if (ins >= 0.65) parts.push("Your body is carrying a lot of this — the feeling is physical, not just in your head.");
    else if (ins <= 0.35) parts.push("Your body sounds quiet, even if the thoughts aren't.");

    // Conflict
    if (acc >= 0.65) parts.push("There's a tug-of-war underneath — two true things at once.");

    // Arousal
    if (stem >= 0.7) parts.push("Your nervous system is revved up; slow exhales will help more than thinking right now.");
    else if (stem <= 0.3) parts.push("Your system sounds settled — a gentle, low-tide kind of day.");

    return parts.join(" ");
  }, [regions]);

  return (
    <div
      className="overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="px-6 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Neural Mood Map · TRIBE v2
            </p>
            <p className="mt-1 font-display text-xl text-foreground">{headline}</p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              TRIBE = Tonal Resonance &amp; Inflection-Based Estimation. Heuristic mapping from
              your voice features to plausible neural correlates — directional, not clinical.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary/70 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            v2 · live
          </span>
        </div>
      </div>

      <div className="relative mt-4 aspect-[16/10] w-full bg-[oklch(0.16_0.03_270)]">
        <svg viewBox="0 0 400 260" className="absolute inset-0 h-full w-full">
          <defs>
            {regions.map((r) => (
              <radialGradient key={r.id} id={`g-${r.id}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={r.color} stopOpacity={0.95} />
                <stop offset="55%" stopColor={r.color} stopOpacity={0.45} />
                <stop offset="100%" stopColor={r.color} stopOpacity={0} />
              </radialGradient>
            ))}
            <filter id="brain-blur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          {/* Lateral brain silhouette */}
          <g fill="oklch(0.32 0.04 270 / 0.55)" stroke="oklch(0.55 0.06 270 / 0.6)" strokeWidth="1.2">
            <path d="M70,140
                     C70,80 130,55 200,55
                     C265,55 315,85 320,135
                     C322,160 310,180 295,195
                     C285,205 270,212 252,214
                     C245,225 232,232 215,232
                     C195,232 178,225 168,212
                     C140,212 115,205 98,190
                     C80,175 70,160 70,140 Z" />
            {/* cerebellum */}
            <ellipse cx="295" cy="205" rx="26" ry="18" />
            {/* brainstem */}
            <path d="M250,212 C252,228 248,242 240,250 L256,250 C262,240 264,225 262,212 Z" />
            {/* sulci hints */}
            <path fill="none" d="M110,95 C150,90 190,100 230,90" />
            <path fill="none" d="M105,125 C160,118 220,130 290,118" />
            <path fill="none" d="M100,160 C160,155 230,168 295,158" />
            <path fill="none" d="M115,190 C165,188 215,195 270,190" />
          </g>

          {/* Activation blooms */}
          {regions.map((r) => {
            const intensity = 0.25 + 0.75 * r.activation;
            const radius = (r.rx + r.ry) / 2 * (0.8 + 0.6 * r.activation);
            return (
              <g key={r.id} filter="url(#brain-blur)" opacity={intensity}>
                <circle cx={r.cx} cy={r.cy} r={radius} fill={`url(#g-${r.id})`} />
              </g>
            );
          })}

          {/* Region dots + labels */}
          {regions.map((r) => (
            <g key={`d-${r.id}`}>
              <circle cx={r.cx} cy={r.cy} r={2.5} fill={r.color} />
            </g>
          ))}
        </svg>

        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(180deg, transparent 55%, oklch(0.16 0.03 270 / 0.85))" }}
        />
      </div>

      {/* Region read-out */}
      <div className="grid grid-cols-1 gap-2 px-6 py-5 sm:grid-cols-2">
        {regions.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/40 p-3"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: r.color, boxShadow: `0 0 10px ${r.color}` }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm text-foreground">{r.name}</p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {Math.round(r.activation * 100)}%
                </p>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.round(r.activation * 100)}%`, background: r.color }}
                />
              </div>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {r.role}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                driven by {r.driver}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
