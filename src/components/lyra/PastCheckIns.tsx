import { useEffect, useState } from "react";
import { CHECKINS_EVENT, loadCheckIns, sortNewestFirst, type CheckIn } from "@/lib/checkins";
import { MoodState } from "@/components/lyra/MoodState";

function MiniBar({ label, value, from, to }: { label: string; value: number; from: string; to: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[9px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: `linear-gradient(90deg, ${from}, ${to})` }} />
      </div>
    </div>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function PastCheckIns() {
  const [items, setItems] = useState<CheckIn[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setItems(sortNewestFirst(loadCheckIns()));
    refresh();
    window.addEventListener(CHECKINS_EVENT, refresh);
    return () => window.removeEventListener(CHECKINS_EVENT, refresh);
  }, []);

  if (!items.length) return null;
  const open = items.find((i) => i.id === openId) ?? null;

  return (
    <section className="mx-auto mt-14 w-full max-w-2xl">
      <h2 className="text-center font-display text-xl text-foreground">Your past check-ins</h2>
      <p className="mt-1 text-center text-xs text-muted-foreground">Saved only on this device.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpenId(openId === c.id ? null : c.id)}
            className={`rounded-2xl border bg-card/50 p-4 text-left backdrop-blur-xl transition hover:bg-card/80 ${openId === c.id ? "border-primary/60" : "border-border/60"}`}
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <p className="text-xs text-foreground">{fmtDate(c.date)}</p>
            <div className="mt-3 space-y-1.5">
              <MiniBar label="Weather" value={c.distress} from="#a78bfa" to="#f87171" />
              <MiniBar label="Energy" value={c.arousal} from="#5eead4" to="#fbbf24" />
            </div>
          </button>
        ))}
      </div>
      {open && (
        <div className="mt-5 space-y-4 rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-soft)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{fmtDate(open.date)}</p>
            <button onClick={() => setOpenId(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          {open.affirmations.length > 0 && (
            <div className="space-y-2">
              {open.affirmations.map((a, i) => (
                <p key={i} className="font-display text-base italic text-foreground">“{a}”</p>
              ))}
            </div>
          )}
          {open.transcript && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">What I heard</p>
              <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground">"{open.transcript}"</p>
            </div>
          )}
          <MoodState distress={open.distress} arousal={open.arousal} />
        </div>
      )}
    </section>
  );
}
