// Who decides what: AI suggests, Code calculates, Analyst decides.
const STYLES = {
  AI: "bg-violet-100 text-violet-800 ring-violet-200",
  Code: "bg-sky-100 text-sky-800 ring-sky-200",
  Analyst: "bg-amber-100 text-amber-800 ring-amber-200",
  "Human-edited": "bg-orange-100 text-orange-800 ring-orange-200",
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
