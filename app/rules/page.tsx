import type { Metadata } from "next";
import { ANSWER_RATINGS, RULES, UNKNOWN_RATING } from "@/config/rules.ts";
import { assessInherent } from "@/lib/ira.ts";
import { Badge } from "@/components/Badge.tsx";
import v1 from "@/data/v1-vendor.json";

export const metadata: Metadata = { title: "Rules · TPRA" };

export default function RulesPage() {
  const a = assessInherent(v1.ira.map(({ id, answer }) => ({ id, answer: answer as "Yes" | "No" | "Unknown" })));

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Deterministic rules</h1>
        <p className="max-w-2xl text-stone-700">
          <Badge kind="Code" /> applies these rules. The AI never produces a rating, tier or decision.{" "}
          All rules are <Badge kind="Confirmed" /> by the analyst (2026-11-02).
        </p>
        <ul className="divide-y divide-stone-200 rounded border border-stone-200 bg-white">
          {RULES.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:gap-4">
              <div className="flex w-56 shrink-0 items-start gap-2 font-medium">
                {r.name} <Badge kind={r.status} />
              </div>
              <p className="text-sm text-stone-700">{r.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">IRA answers and the v1 back-test ({v1.vendor})</h2>
        <p className="max-w-2xl text-sm text-stone-700">
          Answers are from the manual v1 assessment. &ldquo;Unknown&rdquo; always rates {UNKNOWN_RATING} and opens a
          follow-up. Vendor responses are illustrative and were written for this portfolio. They are not Deloitte&apos;s
          actual responses and make no statement about Deloitte&apos;s security practices.
        </p>
        <div className="overflow-x-auto rounded border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-100 text-xs uppercase text-stone-600">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Area</th>
                <th className="p-2">Question</th>
                <th className="p-2">Yes / No</th>
                <th className="p-2">Answer</th>
                <th className="p-2">Code rating</th>
                <th className="p-2">v1 rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {v1.ira.map((row) => {
                const rated = a.rated.find((r) => r.id === row.id);
                const t = ANSWER_RATINGS[row.id];
                return (
                  <tr key={row.id}>
                    <td className="p-2 font-mono text-xs">{row.id}</td>
                    <td className="p-2">{row.area}</td>
                    <td className="p-2">
                      {row.question}
                      {row.addedAfterV1 && (
                        <span className="ml-2 text-xs text-amber-700">added after v1, not in the manual assessment</span>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs text-stone-600">
                      {t?.Yes} / {t?.No}
                    </td>
                    <td className="p-2">{row.answer}</td>
                    <td className="p-2 font-medium">{rated?.rating}</td>
                    <td className="p-2 text-stone-600">{row.v1Rating ?? "n/a"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <dl className="grid gap-3 rounded border border-sky-200 bg-sky-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-stone-500">
              Inherent risk <Badge kind="Code" />
            </dt>
            <dd>
              <span className="font-semibold">{a.inherent.level}</span> (v1: {v1.v1Labels.overallInherentRisk}).{" "}
              {a.inherent.reason}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-stone-500">
              Tier <Badge kind="Code" />
            </dt>
            <dd>
              <span className="font-semibold">{a.tier.label}</span>: {a.tier.depth}, {a.tier.cadence.toLowerCase()}.
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-stone-500">
              Open follow-ups <Badge kind="Code" />
            </dt>
            <dd>{a.followUps.join(", ") || "None"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-stone-500">
              FIPPA flag <Badge kind="Code" />
            </dt>
            <dd>{a.fippa.reason} Not legal advice.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
