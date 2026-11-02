// Who decides what: AI suggests, Code calculates, Analyst decides.
const STYLES = {
  AI: "bg-violet-100 text-violet-800 ring-violet-200",
  Code: "bg-sky-100 text-sky-800 ring-sky-200",
  Analyst: "bg-amber-100 text-amber-800 ring-amber-200",
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
