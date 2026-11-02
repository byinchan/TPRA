"use client";
// Screen 3 (part a): findings and the calculated outcome. Code computes; the analyst sets owner, due date, status.
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { closeFinding, closeNeedsEvidence, reopenFinding, setDueDate, setOwner, type Finding } from "@/lib/findings.ts";
import { computeOutcome } from "@/lib/outcome.ts";
import { SAMPLES } from "@/lib/sample.ts";
import { DEFAULT_OWNER, OWNER_MAX, REASON_MAX, type AssessmentState } from "@/lib/session.ts";
import { FIPPA, RECOMMENDATION_MEANING } from "@/config/rules.ts";
import { Badge, LevelPill } from "./Badge.tsx";
import { ReportPanel } from "./ReportPanel.tsx";
import { Steps } from "./Steps.tsx";
import { useAssessment } from "./useAssessment.ts";

const now = () => new Date().toISOString();

const DECISION_STYLES: Record<string, string> = {
  Approve: "border-emerald-300 bg-emerald-50 text-emerald-900",
  "Approve with conditions": "border-amber-300 bg-amber-50 text-amber-950",
  "Escalate - do not approve yet": "border-red-300 bg-red-50 text-red-900",
};

export function FindingsScreen() {
  const { state, ready, update } = useAssessment();
  const [actionError, setActionError] = useState<string | null>(null);

  if (!ready) return <p className="text-sm text-stone-500">Loading…</p>;
  if (!state) {
    return (
      <div className="space-y-6">
        <Steps current={3} />
        <div className="max-w-xl space-y-3 rounded border border-stone-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">Findings & report</h1>
          <p className="text-stone-700">Start on screen 1: load the sample vendor first.</p>
          <Link href="/" className="inline-block rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white">
            ← Go to intake & inherent risk
          </Link>
        </div>
      </div>
    );
  }

  const s = state;
  const sample = SAMPLES[s.sampleId]!;
  const o = computeOutcome(s);

  function apply(fn: (st: AssessmentState) => AssessmentState) {
    try {
      setActionError(null);
      update(fn(s));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That change could not be applied.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Steps current={3} loaded />
      </div>
      <header className="space-y-1 print:hidden">
        <h1 className="text-2xl font-semibold">Findings & report</h1>
        <p className="text-stone-700">
          <span className="font-medium">{sample.vendor}</span> · {sample.service} · assessed {s.assessedOn}
        </p>
        <p className="max-w-3xl text-xs text-stone-500">{sample.disclaimer}</p>
      </header>

      {actionError && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm print:hidden">
          {actionError}
        </p>
      )}

      <section aria-label="Calculated outcome" className="space-y-4 rounded border border-sky-200 bg-sky-50 p-5 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Calculated outcome</h2>
          <Badge kind="Code" />
        </div>

        {o.recommendation ? (
          <div className={`rounded border p-3 ${DECISION_STYLES[o.recommendation.decision]}`}>
            <p className="text-xs uppercase opacity-70">Recommendation</p>
            <p className="text-xl font-semibold">{o.recommendation.decision}</p>
            <p className="text-sm">{o.recommendation.reason}</p>
            {RECOMMENDATION_MEANING[o.recommendation.decision] && (
              <p className="mt-2 border-t border-current/20 pt-2 text-sm">{RECOMMENDATION_MEANING[o.recommendation.decision]}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 rounded border border-stone-300 bg-white p-3 text-sm">
            <p className="font-medium">Residual risk and the recommendation are not available yet.</p>
            <ul className="list-disc pl-5 text-stone-700">
              {o.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <Link href="/review" className="inline-block text-sky-700 underline">
              Go to due diligence review →
            </Link>
          </div>
        )}

        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase text-stone-500">Inherent risk</dt>
            <dd className="flex items-center gap-2">
              <LevelPill level={o.inherent.level} /> {o.tier.label}
            </dd>
            <dd className="mt-1 text-xs text-stone-600">{o.inherent.reason}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-stone-500">Control strength</dt>
            <dd className="font-medium">{o.strength.strength ?? "Not assessed"}</dd>
            <dd className="mt-1 text-xs text-stone-600">
              {o.strength.reason} ({o.confirmedRows}/{o.totalRows} rows confirmed)
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-stone-500">Residual risk</dt>
            {o.residual ? (
              <>
                <dd className="flex items-center gap-2">
                  <LevelPill level={o.residual.level} />
                  {o.residual.provisional && <span className="text-xs font-medium text-orange-800">Provisional</span>}
                </dd>
                <dd className="mt-1 text-xs text-stone-600">{o.residual.reason}</dd>
              </>
            ) : (
              <dd className="text-stone-500">Not available yet</dd>
            )}
          </div>
          <div>
            <dt className="text-xs uppercase text-stone-500">Next review</dt>
            <dd className="font-medium">{o.nextReview ?? "At contract renewal"}</dd>
            <dd className="mt-1 text-xs text-stone-600">
              {o.tier.cadence}, from the assessment date ({s.assessedOn}).
            </dd>
          </div>
        </dl>

        <p className="text-sm">
          <span className="text-xs uppercase text-stone-500">FIPPA flag: </span>
          {o.fippa.triggered ? (
            <span className="font-medium text-red-800">{FIPPA.message}</span>
          ) : (
            <span>{o.fippa.reason}</span>
          )}{" "}
          <span className="text-xs text-stone-500">{FIPPA.notLegalAdvice}</span>
        </p>
      </section>

      <section className="space-y-3 print:hidden">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-lg font-semibold">Findings ({o.findings.length})</h2>
          <span className="text-sm text-stone-600">{o.openFindings} open</span>
          <span className="ml-auto flex gap-1 text-xs">
            <Badge kind="Code">Code lists them</Badge>
            <Badge kind="Analyst">Analyst sets owner, due date, status</Badge>
          </span>
        </div>
        <p className="text-sm text-stone-600">
          Every open follow-up, every confirmed Gap or Needs evidence row and a triggered FIPPA flag becomes a finding.
          Rows still awaiting review are not included.
        </p>
        {o.findings.length === 0 ? (
          <p className="rounded border border-stone-200 bg-white p-4 text-sm text-stone-600">No findings.</p>
        ) : (
          <ul className="space-y-3">
            {o.findings.map((f) => (
              <FindingCard key={f.id} finding={f} apply={apply} />
            ))}
          </ul>
        )}
      </section>

      <ReportPanel state={s} apply={apply} />

      <p className="text-xs text-stone-500 print:hidden">
        Saved only in this browser tab. Closing the tab erases the assessment; nothing is stored on a server.
      </p>
    </div>
  );
}

function FindingCard({ finding: f, apply }: { finding: Finding; apply: (fn: (s: AssessmentState) => AssessmentState) => void }) {
  const uid = useId();
  // The default owner shows as a placeholder, so typing replaces it instead of appending to it.
  const shownOwner = f.owner === DEFAULT_OWNER ? "" : f.owner;
  const [owner, setOwnerText] = useState(shownOwner);
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const [rerate, setRerate] = useState<"Satisfactory" | "Gap">("Satisfactory");
  useEffect(() => setOwnerText(shownOwner), [shownOwner]);
  const sourceHref = f.source === "Due diligence" ? `/review#${f.sourceRow}` : f.source === "IRA follow-up" ? "/review" : "/";

  return (
    <li className={`rounded border bg-white p-3 ${f.status === "Closed" ? "border-stone-200 opacity-75" : "border-stone-300"}`}>
      <div className="flex flex-wrap items-start gap-2">
        <span className="font-mono text-xs text-stone-500">{f.id}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            f.kind === "Gap" || f.kind === "FIPPA"
              ? "bg-red-50 text-red-800"
              : f.kind === "Needs evidence"
                ? "bg-amber-50 text-amber-900"
                : "bg-stone-100 text-stone-700"
          }`}
        >
          {f.kind}
        </span>
        <p className="min-w-0 flex-1 basis-60 text-sm font-medium">{f.title}</p>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            f.status === "Open" ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {f.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Source: {f.source},{" "}
        <Link href={sourceHref} className="underline">
          {f.sourceRow}
        </Link>
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label htmlFor={`${uid}-owner`} className="block text-xs text-stone-600">
            Owner
          </label>
          <input
            id={`${uid}-owner`}
            value={owner}
            maxLength={OWNER_MAX}
            placeholder={DEFAULT_OWNER}
            onChange={(e) => setOwnerText(e.target.value)}
            onBlur={() => owner.trim() !== shownOwner && apply((s) => setOwner(s, f.id, owner, now()))}
            className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${uid}-due`} className="block text-xs text-stone-600">
            Due date
          </label>
          <input
            id={`${uid}-due`}
            type="date"
            value={f.dueDate ?? ""}
            onChange={(e) => apply((s) => setDueDate(s, f.id, e.target.value || null, now()))}
            className="rounded border border-stone-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          {f.status === "Closed" ? (
            !f.archived &&
            (f.kind === "Gap" || f.kind === "FIPPA") && (
              <button
                type="button"
                onClick={() => apply((s) => reopenFinding(s, f, now()))}
                className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
              >
                Reopen
              </button>
            )
          ) : f.closeBy === "screen-2" ? (
            <Link href="/review" className="text-xs text-sky-700 underline">
              Resolve on screen 2
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setClosing(true)}
              className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
            >
              Close…
            </button>
          )}
        </div>
      </div>
      {!f.dueDate && f.status === "Open" && <p className="mt-1 text-xs text-orange-800">No due date set.</p>}

      {closing && f.status === "Open" && (
        <div className="mt-2 space-y-2 rounded border border-stone-300 bg-stone-50 p-2">
          {f.closeBy === "re-rate" && (
            <div>
              <p className="text-xs text-stone-700">
                Closing a Needs evidence finding re-rates {f.sourceRow} and re-confirms it. Control strength recalculates
                from the new rating.
              </p>
              <label htmlFor={`${uid}-rerate`} className="mt-1 block text-xs font-medium">
                Re-rate {f.sourceRow} as
              </label>
              <select
                id={`${uid}-rerate`}
                value={rerate}
                onChange={(e) => setRerate(e.target.value as "Satisfactory" | "Gap")}
                className="rounded border border-stone-300 px-2 py-1 text-sm"
              >
                <option>Satisfactory</option>
                <option>Gap</option>
              </select>
            </div>
          )}
          <label htmlFor={`${uid}-note`} className="block text-xs font-medium">
            {f.closeBy === "re-rate" ? "Evidence received (required; recorded as the reason)" : "How was this resolved? (required)"}
          </label>
          <input
            id={`${uid}-note`}
            value={note}
            maxLength={REASON_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Certificate received and checked on 2026-11-10"
            className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!note.trim()}
              onClick={() => {
                apply((s) =>
                  f.closeBy === "re-rate" ? closeNeedsEvidence(s, f, rerate, note, now()) : closeFinding(s, f, note, now()),
                );
                setClosing(false);
                setNote("");
              }}
              className="rounded bg-stone-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
            >
              {f.closeBy === "re-rate" ? `Re-rate ${f.sourceRow} ${rerate} and close` : "Close finding"}
            </button>
            <button type="button" onClick={() => setClosing(false)} className="px-3 py-1 text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}
      {f.status === "Closed" && f.closeNote && (
        <p className="mt-1 text-xs text-stone-700">
          Closed: {f.closeNote}
          {f.archived && <span className="text-stone-500"> (source has since changed; kept for traceability)</span>}
        </p>
      )}
      {f.history.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-stone-600">History ({f.history.length})</summary>
          <ol className="mt-1 space-y-0.5 border-l-2 border-stone-200 pl-3 text-stone-700">
            {f.history.map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time> · {h.detail}
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}
