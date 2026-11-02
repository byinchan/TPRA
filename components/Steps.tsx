const STEPS = ["Intake & inherent risk", "Due diligence review", "Findings & report"];

/** Workflow position. Screens 2 and 3 arrive in later pull requests. */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`rounded-full px-3 py-1 ring-1 ring-inset ${
              active ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-400 ring-stone-200"
            }`}
          >
            {n}. {label}
          </li>
        );
      })}
    </ol>
  );
}
