// Who decides what: AI suggests, Code calculates, Analyst decides.
const STYLES = {
  AI: "bg-violet-100 text-violet-800 ring-violet-200",
  Code: "bg-sky-100 text-sky-800 ring-sky-200",
  Analyst: "bg-amber-100 text-amber-800 ring-amber-200",
  "Human-edited": "bg-orange-100 text-orange-800 ring-orange-200",
  "AI-suggested": "bg-violet-50 text-violet-800 ring-violet-200",
  "Analyst-entered": "bg-amber-50 text-amber-800 ring-amber-200",
  "Awaiting review": "bg-white text-stone-600 ring-stone-300",
  Confirmed: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Draft: "bg-stone-100 text-stone-700 ring-stone-300",
} as const;

export function Badge({ kind, children }: { kind: keyof typeof STYLES; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[kind]}`}>
      {children ?? kind}
    </span>
  );
}

const LEVEL_STYLES = {
  High: "bg-red-100 text-red-800 ring-red-200",
  Medium: "bg-amber-100 text-amber-900 ring-amber-200",
  Low: "bg-emerald-100 text-emerald-800 ring-emerald-200",
} as const;

export function LevelPill({ level, large }: { level: keyof typeof LEVEL_STYLES; large?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded font-semibold ring-1 ring-inset ${LEVEL_STYLES[level]} ${
        large ? "px-2.5 py-1 text-lg" : "px-1.5 py-0.5 text-xs"
      }`}
    >
      {level}
    </span>
  );
}

const RATING_STYLES = {
  Satisfactory: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  "Needs evidence": "bg-amber-50 text-amber-900 ring-amber-300",
  Gap: "bg-red-50 text-red-800 ring-red-200",
} as const;

export function RatingPill({ rating }: { rating: keyof typeof RATING_STYLES }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${RATING_STYLES[rating]}`}>
      {rating}
    </span>
  );
}
