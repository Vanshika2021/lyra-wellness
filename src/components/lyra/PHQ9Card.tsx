import { AlertTriangle, HeartPulse, Phone, Shield } from "lucide-react";

export interface PHQ9Domain {
  question: string;
  score: number;
  cue?: string;
}

export interface PHQ9Result {
  total?: number;
  severity?: string;
  domains?: PHQ9Domain[];
  caveat?: string;
}

interface Props {
  result: PHQ9Result | null;
  loading: boolean;
  error: string | null;
  crisis: boolean;
}

function humanSeverity(total: number | undefined, severityText?: string): { label: string; tone: "calm" | "mild" | "moderate" | "support" } {
  const t = typeof total === "number" ? total : -1;
  if (t >= 0 && t <= 4) return { label: "You seem to be doing okay", tone: "calm" };
  if (t >= 5 && t <= 9) return { label: "Mild symptoms detected", tone: "mild" };
  if (t >= 10 && t <= 14) return { label: "Moderate symptoms detected", tone: "moderate" };
  if (t >= 15) return { label: "Please consider extra support", tone: "support" };

  // fall back to severity text
  const s = (severityText || "").toLowerCase();
  if (s.includes("moderately severe") || s.includes("severe")) return { label: "Please consider extra support", tone: "support" };
  if (s.includes("moderate")) return { label: "Moderate symptoms detected", tone: "moderate" };
  if (s.includes("mild")) return { label: "Mild symptoms detected", tone: "mild" };
  return { label: "You seem to be doing okay", tone: "calm" };
}

const toneStyles: Record<string, { ring: string; chip: string; glow: string }> = {
  calm: { ring: "border-emerald-300/40", chip: "bg-emerald-400/15 text-emerald-200", glow: "oklch(0.78 0.12 165)" },
  mild: { ring: "border-amber-300/40", chip: "bg-amber-400/15 text-amber-200", glow: "oklch(0.82 0.13 90)" },
  moderate: { ring: "border-orange-300/50", chip: "bg-orange-400/15 text-orange-200", glow: "oklch(0.78 0.16 55)" },
  support: { ring: "border-rose-300/50", chip: "bg-rose-400/15 text-rose-200", glow: "oklch(0.75 0.17 20)" },
};

export function PHQ9Card({ result, loading, error, crisis }: Props) {
  return (
    <div className="space-y-4">
      {crisis && <CrisisCard />}

      <div
        className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur-xl"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-primary" />
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Wellness insight</p>
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="font-display italic">Gently reading between the lines…</span>
          </div>
        )}

        {error && !loading && (
          <p className="mt-3 text-sm text-blush">{error}</p>
        )}

        {result && !loading && <PHQ9Body result={result} />}

        <p className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          <Shield className="h-3 w-3" />
          This is a wellness insight, not a clinical diagnosis
        </p>
      </div>
    </div>
  );
}

function PHQ9Body({ result: _result }: { result: PHQ9Result }) {
  return (
    <div className="mt-4 space-y-4">
      <div
        className="rounded-2xl border border-border/50 bg-background/40 p-5"
        style={{ boxShadow: "0 0 32px -12px oklch(0.78 0.12 200)" }}
      >
        <p className="font-display text-xl leading-snug text-foreground">
          We've noted how you're feeling today.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Thank you for sharing — your words have been heard with care.
        </p>
      </div>
    </div>
  );
}

function CrisisCard() {
  return (
    <div
      className="rounded-3xl border border-rose-400/50 bg-rose-500/10 p-6 backdrop-blur-xl"
      style={{ boxShadow: "0 0 40px -10px oklch(0.7 0.2 20)" }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
        <div>
          <p className="font-display text-lg text-foreground">You don't have to go through this alone.</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            If you're thinking about harming yourself, please reach out right now. Someone is ready to listen.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-rose-300/40 bg-background/30 px-4 py-3">
            <Phone className="h-4 w-4 text-rose-200" />
            <span className="text-sm text-foreground">
              <span className="font-medium">Crisis Text Line:</span> Text <span className="font-mono">HOME</span> to <span className="font-mono">741741</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
