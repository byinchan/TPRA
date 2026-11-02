"use client";
// Screen 3 (part b): executive report. AI drafts the narrative; the analyst edits each section, the number
// check compares it with the computed figures, and approval needs a clean check, due dates and a preparer.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { DemoReason } from "@/lib/ai/types.ts";
import { checkNarrative } from "@/lib/report/numberCheck.ts";
import { MAX_PAGES, PRINT, estimatePages } from "@/lib/report/pages.ts";
import { NARRATIVE_SECTIONS, SECTION_MAX, type SectionKey } from "@/lib/report/schema.ts";
import {
  applyNarrative,
  approvalCheck,
  approvalStatus,
  approveReport,
  currentFacts,
  discardReport,
  draftIsStale,
  editSection,
  narrativeOf,
  setPreparer,
  type NarrativeSuccess,
} from "@/lib/report/state.ts";
import { computeOutcome } from "@/lib/outcome.ts";
import { SAMPLES } from "@/lib/sample.ts";
import { PREPARER_MAX, type AssessmentState } from "@/lib/session.ts";
import { Badge } from "./Badge.tsx";
import { ReportDocument } from "./ReportDocument.tsx";

const now = () => new Date().toISOString();

const DEMO_TEXT: Record<DemoReason, string> = {
  requested: "You chose the saved demo draft.",
  "no-key": "No API key is configured for this deployment, so the saved demo draft is shown.",
  "rate-limited": "The live-AI limit was reached, so the saved demo draft is shown.",
  "daily-cap": "Today's live-AI limit for this demo was reached, so the saved demo draft is shown.",
  budget: "The demo's AI credit is used up, so the saved demo draft is shown.",
  "service-unavailable": "The AI service was unavailable, so the saved demo draft is shown.",
};

export function ReportPanel({ state, apply }: { state: AssessmentState; apply: (fn: (s: AssessmentState) => AssessmentState) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ text: string; canUseDemo: boolean } | null>(null);
  const uid = useId();
  const outcome = computeOutcome(state);
  const sample = SAMPLES[state.sampleId]!;

  if (!outcome.recommendation) {
    return (
      <section className="space-y-2 rounded border border-dashed border-stone-300 p-4 text-sm text-stone-600 print:hidden">
        <h2 className="text-lg font-semibold text-stone-900">Executive report</h2>
        <p>The report is drafted from confirmed data only. Confirm every questionnaire row first.</p>
      </section>
    );
  }

  async function draft(demo: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, demo }),
      });
      const body = (await res.json()) as NarrativeSuccess | { ok: false; error: string; canUseDemo: boolean };
      if (body.ok) apply((s) => applyNarrative(s, body, now()));
      else setError({ text: body.error, canUseDemo: body.canUseDemo });
    } catch {
      setError({ text: "The narrative service could not be reached. You can use the saved demo draft.", canUseDemo: true });
    } finally {
      setLoading(false);
    }
  }

  const r = state.report;
  if (!r) {
    return (
      <section className="space-y-3 rounded border border-violet-200 bg-white p-5 print:hidden">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Executive report <Badge kind="AI" />
        </h2>
        <p className="text-sm text-stone-700">
          The AI drafts the narrative from the computed facts only. Code writes the recommendation line, the findings table, the
          review date and the limitations line. You edit every section, the number check compares the narrative with the computed
          figures, and you approve it.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => draft(false)}
            className="rounded bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {loading ? "Drafting…" : "Draft narrative with AI"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => draft(true)}
            className="rounded border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-50"
          >
            Use saved demo draft
          </button>
        </div>
        {error && (
          <div role="alert" className="space-y-2 rounded border border-red-300 bg-red-50 p-3 text-sm">
            <p>{error.text}</p>
            {error.canUseDemo && (
              <button type="button" onClick={() => draft(true)} className="underline">
                Use saved demo draft
              </button>
            )}
          </div>
        )}
      </section>
    );
  }

  const { facts } = currentFacts(state);
  const narrative = narrativeOf(state)!;
  const check = approvalCheck(state);
  const status = approvalStatus(state);
  const stale = draftIsStale(state);
  const aiSource =
    r.source.kind === "mock" ? "demo placeholder written by the developer" : r.mode === "live" ? (r.source.model ?? "model") : `saved run of ${r.source.model}`;

  return (
    <section className="space-y-4">
      <div className="space-y-2 rounded border border-violet-200 bg-white p-4 text-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Executive report</h2>
          <Badge kind="AI" />
          <span className="font-medium">AI-generated, human-reviewed</span>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${r.mode === "live" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
            {r.mode === "live" ? "Live" : "Demo mode"}
          </span>
          <button
            type="button"
            onClick={() => window.confirm("Discard the narrative draft and your edits?") && apply(discardReport)}
            className="ml-auto text-xs text-stone-600 underline"
          >
            Discard draft
          </button>
        </div>
        {r.mode === "demo" && <p>{DEMO_TEXT[r.demoReason ?? "requested"]}</p>}
        {r.source.kind === "mock" && (
          <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs">
            This saved draft is a placeholder written by the developer, not model output. It will be replaced by a recorded model run.
          </p>
        )}
        {r.demoMatchesFacts === false && (
          <p className="rounded border border-orange-300 bg-orange-50 p-2 text-xs">
            The saved draft was written for the sample with every AI suggestion accepted. Your figures differ, so expect number-check
            flags and check every section.
          </p>
        )}
        {stale && (
          <p className="rounded border border-orange-300 bg-orange-50 p-2 text-xs">
            Figures have changed since this draft was written. Review each section (the number check flags mismatched figures; it
            cannot catch every outdated statement).
          </p>
        )}
      </div>

      <div className="space-y-3 print:hidden">
        {NARRATIVE_SECTIONS.map((sec) => (
          <SectionEditor
            key={`${sec.key}-${r.draftedAt}`}
            sectionKey={sec.key}
            title={sec.title}
            text={r.sections[sec.key].text}
            edited={r.sections[sec.key].text !== r.sections[sec.key].aiText}
            mismatches={check.mismatches.filter((m) => m.section === sec.key)}
            onSave={(text) => apply((s) => editSection(s, sec.key, text, now()))}
          />
        ))}
      </div>

      <div className="space-y-3 rounded border border-stone-300 bg-white p-4 text-sm print:hidden">
        <h3 className="flex items-center gap-2 font-semibold">
          Approval <Badge kind="Analyst" />
        </h3>
        <div>
          <label htmlFor={`${uid}-prep`} className="block text-xs text-stone-600">
            Prepared by (required)
          </label>
          <input
            id={`${uid}-prep`}
            defaultValue={r.preparer}
            maxLength={PREPARER_MAX}
            onBlur={(e) => e.target.value.trim() !== r.preparer && apply((s) => setPreparer(s, e.target.value, now()))}
            className="w-full max-w-sm rounded border border-stone-300 px-2 py-1"
          />
        </div>
        {status === "approved" ? (
          <p className="rounded border border-emerald-300 bg-emerald-50 p-2">
            ✓ Approved by {r.approved!.by} on {new Date(r.approved!.at).toLocaleString()}.
          </p>
        ) : (
          <>
            {status === "void" && (
              <p className="rounded border border-orange-300 bg-orange-50 p-2">
                The earlier approval no longer applies: the assessment changed after it was approved. Review and approve again.
              </p>
            )}
            {check.blockers.length > 0 ? (
              <div>
                <p className="font-medium">Before you can approve:</p>
                <ul className="list-disc pl-5 text-stone-700">
                  {check.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-emerald-800">Number check clean, due dates set, preparer entered.</p>
            )}
            <button
              type="button"
              disabled={check.blockers.length > 0}
              onClick={() => apply((s) => approveReport(s, now()))}
              className="rounded bg-stone-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Approve report
            </button>
          </>
        )}
      </div>

      <PrintBlock
        status={status}
        doc={
          <ReportDocument
            facts={facts}
            recommendationLine={outcome.recommendationLine}
            narrative={narrative}
            preparer={r.preparer}
            approval={{ status, at: r.approved?.at, by: r.approved?.by }}
            aiSource={aiSource}
            disclaimer={sample.disclaimer}
          />
        }
      />
    </section>
  );
}

function SectionEditor({
  sectionKey,
  title,
  text,
  edited,
  mismatches,
  onSave,
}: {
  sectionKey: SectionKey;
  title: string;
  text: string;
  edited: boolean;
  mismatches: { found: string; expected: string }[];
  onSave: (text: string) => void;
}) {
  const [value, setValue] = useState(text);
  useEffect(() => setValue(text), [text]);
  const id = `section-${sectionKey}`;
  return (
    <div className="rounded border border-stone-200 bg-white p-3">
      <div className="mb-1 flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {title}
        </label>
        <Badge kind={edited ? "Human-edited" : "AI-suggested"} />
        {mismatches.length === 0 ? (
          <span className="ml-auto text-xs text-emerald-700">Number check ✓</span>
        ) : (
          <span className="ml-auto text-xs font-medium text-red-700">Number check: {mismatches.length} to fix</span>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        rows={4}
        maxLength={SECTION_MAX * 2}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value.trim() && value.trim() !== text && onSave(value)}
        className="w-full rounded border border-stone-300 p-2 text-sm"
      />
      {mismatches.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-red-800">
          {mismatches.map((m, i) => (
            <li key={`${m.found}-${i}`}>
              “{m.found}”: expected {m.expected}.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Preview, page-fit measurement and print. Print shows only the report (see globals.css). */
function PrintBlock({ doc, status }: { doc: React.ReactNode; status: "approved" | "void" | "none" }) {
  const measure = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (measure.current) setPages(estimatePages(measure.current.scrollHeight));
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <h3 className="font-semibold">Report preview</h3>
        {pages !== null && (
          <span className={`text-sm ${pages > MAX_PAGES ? "font-medium text-red-700" : "text-stone-600"}`}>
            About {pages} page{pages === 1 ? "" : "s"} (Letter){pages > MAX_PAGES ? `: over the ${MAX_PAGES}-page limit, shorten the narrative.` : ""}
          </span>
        )}
        <button
          type="button"
          disabled={status !== "approved"}
          onClick={() => window.print()}
          className="ml-auto rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          title={status === "approved" ? "Opens the print dialog: choose Save as PDF" : "Approve the report first"}
        >
          Download PDF
        </button>
      </div>
      {status !== "approved" && <p className="text-xs text-stone-500 print:hidden">Download PDF is available once the report is approved.</p>}
      <div id="print-report" className="rounded border border-stone-300 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {doc}
      </div>
      {/* Off-screen copy at the printed content width, for the page estimate. */}
      <div aria-hidden className="pointer-events-none absolute -left-[10000px] top-0 print:hidden" style={{ width: PRINT.contentWidthPx }}>
        <div ref={measure}>{doc}</div>
      </div>
    </div>
  );
}
