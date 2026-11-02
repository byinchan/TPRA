"use client";
// Screen 1: intake and inherent risk. The analyst sets answers; lib/ computes everything shown in the Code panel.
import Link from "next/link";
import { useId, useState } from "react";
import { ANSWER_RATINGS, FIPPA, UNKNOWN_RATING } from "@/config/rules.ts";
import { assessInherent, describeChange } from "@/lib/ira.ts";
import { IRA_AREAS, IRA_QUESTIONS, SAMPLES } from "@/lib/sample.ts";
import { REASON_MAX, createFromSample, setIraAnswer, type IraState } from "@/lib/session.ts";
import { ANSWERS, type Answer, type Level } from "@/lib/types.ts";
import { Badge, LevelPill } from "./Badge.tsx";
import { Steps } from "./Steps.tsx";
import { useAssessment } from "./useAssessment.ts";

const SAMPLE = SAMPLES["v1-halden"]!;
const TAB_ONLY = "Saved only in this browser tab. Closing the tab erases the assessment; nothing is stored on a server.";

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function IntakeScreen() {
  const { state, ready, discarded, update } = useAssessment();
  const [notices, setNotices] = useState<string[]>([]);

  if (!ready) return <p className="text-sm text-stone-500">Loading…</p>;

  if (!state) {
    return (
      <div className="space-y-6">
        <Steps current={1} />
        {discarded && (
          <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            Saved data in this tab failed validation and was discarded. Load the sample to start again.
          </p>
        )}
        <section className="max-w-2xl space-y-4 rounded border border-stone-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">Intake & inherent risk</h1>
          <p className="text-stone-700">
            Inherent risk comes first: it sets the tier, and the tier sets how deep due diligence goes. Load the sample
            vendor to fill the {IRA_QUESTIONS.length} inherent risk answers and the {SAMPLE.ddq.length} questionnaire
            responses in one step.
          </p>
          <div className="rounded border border-stone-200 bg-stone-50 p-3 text-sm">
            <p className="font-medium">{SAMPLE.label}</p>
            <p className="mt-1 text-stone-600">{SAMPLE.disclaimer}</p>
          </div>
          <button
            type="button"
            onClick={() => update(createFromSample(SAMPLE, localDate()))}
            className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
          >
            Load sample vendor
          </button>
          <p className="text-xs text-stone-500">{TAB_ONLY}</p>
        </section>
      </div>
    );
  }

  const assessment = assessInherent(state.ira);
  const rating = (id: string) => assessment.rated.find((r) => r.id === id)?.rating as Level;
  const question = (id: string) => IRA_QUESTIONS.find((q) => q.id === id)?.question ?? id;

  function applyChange(id: string, to: Answer, reason: string) {
    const row = state!.ira.find((r) => r.id === id)!;
    const next = setIraAnswer(state!, id, to, reason, new Date().toISOString());
    setNotices(describeChange(assessment, assessInherent(next.ira), { id, from: row.answer, to }));
    update(next);
  }

  function startOver() {
    if (window.confirm("Clear this assessment from the tab? All answers and change history will be lost.")) {
      setNotices([]);
      update(null);
    }
  }

  return (
    <div className="space-y-6">
      <Steps current={1} loaded />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Intake & inherent risk</h1>
          <p className="text-stone-700">
            <span className="font-medium">{SAMPLE.vendor}</span> · {SAMPLE.service} · assessed {state.assessedOn}
          </p>
          <p className="max-w-2xl text-xs text-stone-500">{SAMPLE.disclaimer}</p>
        </div>
        <button
          type="button"
          onClick={startOver}
          className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-100"
        >
          Start over
        </button>
      </header>

      {/* Narrow screens: the Calculated panel sits below the questions, so keep a summary in view. */}
      <a
        href="#calculated"
        aria-label={`Inherent risk ${assessment.inherent.level}, ${assessment.tier.label}, ${assessment.followUps.length} open follow-ups${
          notices.length > 0 ? ", changed" : ""
        }. Jump to the calculated results.`}
        className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-sky-200 bg-sky-50/95 px-4 py-2 text-sm backdrop-blur lg:hidden"
      >
        <LevelPill level={assessment.inherent.level} />
        <span className="font-medium">{assessment.tier.label}</span>
        <span className="text-stone-500">·</span>
        <span>
          {assessment.followUps.length} follow-up{assessment.followUps.length === 1 ? "" : "s"}
        </span>
        {notices.length > 0 && <span className="font-medium text-orange-700">· changed</span>}
        <span className="ml-auto whitespace-nowrap text-sky-700 underline underline-offset-2">Details ↓</span>
      </a>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-5" aria-label="Inherent risk questions">
          <p className="text-sm text-stone-600">
            <Badge kind="Analyst" /> sets each answer; changing one needs a reason and is kept in the row&apos;s history.{" "}
            <Badge kind="Code" /> rates it from the fixed table. &ldquo;Unknown&rdquo; rates {UNKNOWN_RATING} and opens a
            follow-up.
          </p>
          {IRA_AREAS.map((area) => (
            <div key={area} className="overflow-hidden rounded border border-stone-200 bg-white">
              <h2 className="border-b border-stone-200 bg-stone-100 px-3 py-2 text-sm font-semibold">{area}</h2>
              <ul className="divide-y divide-stone-100">
                {IRA_QUESTIONS.filter((q) => q.area === area).map((q) => (
                  <IraRow
                    key={q.id}
                    row={state.ira.find((r) => r.id === q.id)!}
                    question={q.question}
                    addedAfterV1={q.addedAfterV1}
                    v1Rating={q.v1Rating}
                    rating={rating(q.id)}
                    onApply={applyChange}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>

        <aside
          id="calculated"
          className="scroll-mt-14 space-y-4 lg:sticky lg:top-4 lg:self-start"
          aria-label="Calculated results"
        >
          {notices.length > 0 && (
            <div role="status" className="space-y-2 rounded border border-orange-300 bg-orange-50 p-3 text-sm">
              {notices.map((n) => (
                <p key={n}>{n}</p>
              ))}
              <button type="button" onClick={() => setNotices([])} className="text-xs text-orange-800 underline">
                Dismiss
              </button>
            </div>
          )}

          <div className="space-y-4 rounded border border-sky-200 bg-sky-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Calculated</h2>
              <Badge kind="Code" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase text-stone-500">Inherent risk</p>
              <LevelPill level={assessment.inherent.level} large />
              <p className="text-sm text-stone-700">{assessment.inherent.reason}</p>
              <p className="text-xs text-stone-500">
                {assessment.inherent.highs.length} High · {assessment.inherent.mediums.length} Medium ·{" "}
                {IRA_QUESTIONS.length - assessment.inherent.highs.length - assessment.inherent.mediums.length} Low
              </p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-stone-500">Tier</dt>
              <dd className="font-medium">{assessment.tier.label}</dd>
              <dt className="text-stone-500">Due diligence</dt>
              <dd>{assessment.tier.depth}</dd>
              <dt className="text-stone-500">Reassessment</dt>
              <dd>{assessment.tier.cadence}</dd>
            </dl>

            <div className="space-y-1">
              <p className="text-xs uppercase text-stone-500">Open follow-ups ({assessment.followUps.length})</p>
              {assessment.followUps.length === 0 ? (
                <p className="text-sm text-stone-600">None. No answers are Unknown.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {assessment.followUps.map((id) => (
                    <li key={id}>
                      <span className="font-mono text-xs">{id}</span> {question(id)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase text-stone-500">BC privacy (FIPPA) flag</p>
              {assessment.fippa.triggered ? (
                <div className="space-y-1 rounded border border-red-200 bg-red-50 p-2 text-sm">
                  <p className="font-medium">{FIPPA.message}</p>
                  <p className="text-stone-700">{assessment.fippa.reason}</p>
                  <p className="text-stone-700">Opens a finding: {FIPPA.findingTitle}.</p>
                </div>
              ) : (
                <p className="text-sm text-stone-700">{assessment.fippa.reason}</p>
              )}
              <p className="text-xs text-stone-500">{FIPPA.notLegalAdvice}</p>
            </div>

            <p className="border-t border-sky-200 pt-3 text-xs text-stone-600">
              {state.ddq.length} questionnaire responses loaded for the {assessment.tier.depth.toLowerCase()}.
            </p>
          </div>
          <Link
            href="/review"
            className="block rounded bg-stone-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-stone-700"
          >
            Continue to due diligence review →
          </Link>
          <p className="text-xs text-stone-500">{TAB_ONLY}</p>
        </aside>
      </div>
    </div>
  );
}

function IraRow({
  row,
  question,
  addedAfterV1,
  v1Rating,
  rating,
  onApply,
}: {
  row: IraState;
  question: string;
  addedAfterV1: boolean;
  v1Rating: Level | null;
  rating: Level;
  onApply: (id: string, to: Answer, reason: string) => void;
}) {
  const [pending, setPending] = useState<Answer | null>(null);
  const [reason, setReason] = useState("");
  const uid = useId();
  const table = ANSWER_RATINGS[row.id]!;
  const edited = row.answer !== row.loadedAnswer || row.history.length > 0;

  function cancel() {
    setPending(null);
    setReason("");
  }

  return (
    <li className="space-y-2 px-3 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm">
            <span className="mr-2 font-mono text-xs text-stone-500">{row.id}</span>
            {question}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            Yes = {table.Yes} · No = {table.No} · Unknown = {UNKNOWN_RATING}
            {v1Rating ? ` · v1: ${v1Rating}` : ""}
          </p>
          {addedAfterV1 && (
            <p className="mt-1 text-xs font-medium text-amber-700">Added after v1, not in the manual assessment</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${uid}-answer`} className="sr-only">
            Answer for {row.id}
          </label>
          <select
            id={`${uid}-answer`}
            value={pending ?? row.answer}
            onChange={(e) => {
              const v = e.target.value as Answer;
              setPending(v === row.answer ? null : v);
            }}
            className={`rounded border px-2 py-1 text-sm ${
              row.answer === "Unknown" && !pending ? "border-amber-400 bg-amber-50" : "border-stone-300 bg-white"
            }`}
          >
            {ANSWERS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <span className="w-16 text-right" title="Calculated rating">
            <LevelPill level={rating} />
          </span>
        </div>
      </div>

      {pending && (
        <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-2">
          <label htmlFor={`${uid}-reason`} className="block text-xs font-medium">
            Reason for changing {row.answer} → {pending} (required)
          </label>
          <textarea
            id={`${uid}-reason`}
            value={reason}
            maxLength={REASON_MAX}
            rows={2}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Questionnaire DDQ-11: data residency is not guaranteed"
            className="w-full rounded border border-stone-300 bg-white p-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() => {
                onApply(row.id, pending, reason);
                cancel();
              }}
              className="rounded bg-stone-900 px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply change
            </button>
            <button type="button" onClick={cancel} className="rounded px-3 py-1 text-xs hover:bg-amber-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {edited && (
        <details className="text-xs">
          <summary className="cursor-pointer text-stone-600">
            <Badge kind="Human-edited" /> Loaded as {row.loadedAnswer} · {row.history.length} change
            {row.history.length === 1 ? "" : "s"}
          </summary>
          <ol className="mt-1 space-y-1 border-l-2 border-orange-200 pl-3 text-stone-700">
            {row.history.map((h) => (
              <li key={h.at}>
                <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time>: {h.from} → {h.to}. {h.reason}
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}
