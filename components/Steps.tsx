import Link from "next/link";

const STEPS = [
  { label: "Intake & inherent risk", href: "/" },
  { label: "Due diligence review", href: "/review" },
  { label: "Findings & report", href: null },
] as const;

/** Workflow position. Steps link once an assessment is loaded; screen 3 arrives in a later pull request. */
export function Steps({ current, loaded = false }: { current: 1 | 2 | 3; loaded?: boolean }) {
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {STEPS.map(({ label, href }, i) => {
        const n = i + 1;
        const active = n === current;
        const cls = `block rounded-full px-3 py-1 ring-1 ring-inset ${
          active
            ? "bg-stone-900 text-white ring-stone-900"
            : href && loaded
              ? "bg-white text-stone-700 ring-stone-300 hover:bg-stone-100"
              : "bg-white text-stone-400 ring-stone-200"
        }`;
        return (
          <li key={label} aria-current={active ? "step" : undefined}>
            {href && loaded && !active ? (
              <Link href={href} className={cls}>
                {n}. {label}
              </Link>
            ) : (
              <span className={cls}>
                {n}. {label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
