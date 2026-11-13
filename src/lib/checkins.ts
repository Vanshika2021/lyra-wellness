export type CheckIn = {
  id: string;
  date: string; // ISO
  distress: number;
  arousal: number;
  transcript: string;
  affirmations: string[];
};

const KEY = "lyra.checkins.v1";
const EVENT = "lyra-checkins-changed";

export function loadCheckIns(): CheckIn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

export function saveCheckIn(c: Omit<CheckIn, "id" | "date">) {
  const entry: CheckIn = { ...c, id: `${Date.now()}`, date: new Date().toISOString() };
  const all = [entry, ...loadCheckIns()].slice(0, 100);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* quota */ }
  window.dispatchEvent(new Event(EVENT));
}

export function sortNewestFirst(list: CheckIn[]): CheckIn[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}

export const CHECKINS_EVENT = EVENT;
