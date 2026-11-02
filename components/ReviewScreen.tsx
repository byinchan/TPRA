"use client";
// Screen 2: due diligence review. AI proposes per row; the analyst edits and confirms; code counts confirmed rows only.
import Link from "next/link";
import { useId, useState } from "react";
import type { DemoReason, ReviewResult } from "@/lib/ai/types.ts";
import { applyAiReview, confirmRow, confirmedRatings, discardAiReview, editDecision, reopenRow, resolveFollowUp } from "@/lib/ddq.ts";
import { assessInherent, describeChange } from "@/lib/ira.ts";
import { controlStrength } from "@/lib/residual.ts";
import { IRA_QUESTIONS, SAMPLES } from "@/lib/sample.ts";
import type { AssessmentState, DdqDecision } from "@/lib/session.ts";
import { Badge, LevelPill } from "./Badge.tsx";
import { DdqRowCard } from "./DdqRowCard.tsx";
import { Steps } from "./Steps.tsx";
import { useAssessment } from "./useAssessment.ts";

const DEMO_REASON_TEXT: Record<DemoReason, string> = {
  requested: "You chose the saved demo review.",
  "no-key": "No API key is configured for this deployment, so the saved demo review is shown.",
  "rate-limited": "The live-review limit was reached, so the saved demo review is shown.",
  "daily-cap": "Today's live-review limit for this demo was reached, so the saved demo review is shown.",
  budget: "The demo's AI credit is used up, so the saved demo review is shown.",
  "service-unavailable": "The AI service was unavailable, so the saved demo review is shown.",
};

const iraQuestion = (id: string) => IRA_QUESTIONS.find((q) => q.id === id)?.question ?? id;
const now = () => new Date().toISOString();

export function ReviewScreen() {
  const { state, ready, update } = useAssessment();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ text: string; canUseDemo: boolean } | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!ready) return <p className="text-sm text-stone-500">Loading…</p>;
  if (!state) {
    return (
      <div className="space-y-6">
        <Steps current={2} />
        <div className="max-w-xl space-y-3 rounded border border-stone-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">Due diligence review</h1>
          <p className="text-stone-700">Start on screen 1: load the sample vendor and review the inherent risk first.</p>
          <Link href="/" className="inline-block rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white">
            ← Go to intake & inherent risk
          </Link>
        </div>
      </div>
    );
  }

  const s = state;
  const sample = SAMPLES[s.sampleId]!;
  const assessment = assessInherent(s.ira);
  const strength = controlStrength(confirmedRatings(s));
  const confirmed = s.ddq.filter((r) => r.confirmed).length;
  const domains = [...new Set(sample.ddq.map((r) => r.domain))];
  const question = (id: string) => sample.ddq.find((r) => r.id === id)?.question ?? id;

  function apply(fn: (st: AssessmentState) => AssessmentState) {
    try {
      setActionError(null);
      update(fn(s));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That change could not be applied.");
    }
  }

  async function requestReview(demo: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: s.sampleId, ira: s.ira.map(({ id, answer }) => ({ id, answer })), demo }),
      });
      const body = (await res.json()) as ReviewResult;
      if (body.ok) update(applyAiReview(s, body, now()));
      else setError({ text: body.error, canUseDemo: body.canUseDemo });
    } catch {
      setError({ text: "The AI review could not be reached. You can use the saved demo review.", canUseDemo: true });
    } finally {
      setLoading(false);
    }
  }

  function onResolve(iraId: string, to: "Yes" | "No", ddqId: string, note: string) {
    try {
      setActionError(null);
      const next = resolveFollowUp(s, iraId, to, ddqId, note, now());
      setNotices(describeChange(assessment, assessInherent(next.ira), { id: iraId, from: "Unknown", to }));
      update(next);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "The follow-up could not be resolved.");
    }
  }

  return (
    <div className="space-y-6">
      <Steps current={2} loaded />
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Due diligence review</h1>
        <p className="text-stone-700">
          <span className="font-medium">{sample.vendor}</span> · {sample.service} · {assessment.tier.label}:{" "}
          {assessment.tier.depth}
        </p>
        <p className="max-w-3xl text-xs text-stone-500">{sample.disclaimer}</p>
      </header>

      {assessment.tier.tier === 1 && (
        <p className="rounded border border-orange-300 bg-orange-50 p-3 text-sm">
          {assessment.tier.label} calls for the full SIG questionnaire and evidence. This prototype only includes the{" "}
          {s.ddq.length}-question questionnaire based on SIG Lite (the full SIG is out of scope for v1), so this review
          is shallower than the tier requires.
        </p>
      )}

      {/* Narrow screens: keep the count and strength in view. */}
      <a
        href="#calculated"
        className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-sky-200 bg-sky-50/95 px-4 py-2 text-sm backdrop-blur lg:hidden"
      >
        <span className="font-medium">
          {confirmed}/{s.ddq.length} confirmed
        </span>
        <span className="text-stone-500">·</span>
        <span>{strength.strength ?? "Not assessed"}</span>
        <span className="ml-auto whitespace-nowrap text-sky-700 underline underline-offset-2">Details ↓</span>
      </a>

      {actionError && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm">
          {actionError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          {!s.review ? (
            <section className="space-y-3 rounded border border-violet-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                AI-assisted review <Badge kind="AI" />
              </h2>
              <p className="text-sm text-stone-700">
                The AI proposes a rating, a one-line rationale, any conflict with your inherent risk answers and the
                evidence to request, for each of the {s.ddq.length} responses. It also flags inherent risk answers that
                don&apos;t fit together. You decide every row; only confirmed rows count.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => requestReview(false)}
                  className="rounded bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  {loading ? "Reviewing…" : "Get AI suggestions"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => requestReview(true)}
                  className="rounded border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-100 disabled:opacity-50"
                >
                  Use saved demo review
                </button>
              </div>
              <p className="text-xs text-stone-500">
                Only your inherent risk answers are sent. The questionnaire text comes from the sample on the server.
                If live AI is unavailable, the saved demo review is used and labelled.
              </p>
              {error && (
                <div role="alert" className="space-y-2 rounded border border-red-300 bg-red-50 p-3 text-sm">
                  <p>{error.text}</p>
                  {error.canUseDemo && (
                    <button type="button" onClick={() => requestReview(true)} className="underline">
                      Use saved demo review
                    </button>
                  )}
                </div>
              )}
            </section>
          ) : (
            <ReviewBanner
              state={s}
              onDiscard={() => {
                if (window.confirm("Discard the AI review and every row decision? Inherent risk answers are kept.")) {
                  apply(discardAiReview);
                }
              }}
            />
          )}

          {s.review && s.review.iraInconsistencies.length > 0 && (
            <section className="space-y-2 rounded border border-violet-200 bg-white p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                Inherent risk answers that may not fit together <Badge kind="AI" />
              </h2>
              <ul className="space-y-2 text-sm">
                {s.review.iraInconsistencies.map((c) => (
                  <li key={c.iraIds.join()}>
                    <span className="font-mono text-xs">{c.iraIds.join(" + ")}</span> {c.note}
                    <span className="block text-xs text-stone-500">
                      {c.iraIds.map((id) => `${id}: ${iraQuestion(id)} (${s.ira.find((r) => r.id === id)?.answer})`).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-stone-500">
                Advisory only. Change an answer on{" "}
                <Link href="/" className="underline">
                  screen 1
                </Link>{" "}
                if you agree; nothing changes automatically.
              </p>
            </section>
          )}

          <FollowUps state={s} notices={notices} onDismiss={() => setNotices([])} onResolve={onResolve} />

          {s.review &&
            domains.map((domain) => (
              <section key={domain} className="space-y-2">
                <h2 className="text-sm font-semibold text-stone-700">{domain}</h2>
                <ul className="space-y-3">
                  {s.ddq
                    .filter((r) => sample.ddq.find((q) => q.id === r.id)?.domain === domain)
                    .map((row) => (
                      <DdqRowCard
                        key={row.id}
                        row={row}
                        question={question(row.id)}
                        iraQuestion={iraQuestion}
                        onEdit={(id, patch: Partial<DdqDecision>) => apply((st) => editDecision(st, id, patch, now()))}
                        onConfirm={(id, reason) => apply((st) => confirmRow(st, id, reason, now()))}
                        onReopen={(id) => apply((st) => reopenRow(st, id, now()))}
                      />
                    ))}
                </ul>
              </section>
            ))}
        </div>

        <aside id="calculated" className="scroll-mt-14 space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Calculated results">
          <div className="space-y-3 rounded border border-sky-200 bg-sky-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Calculated</h2>
              <Badge kind="Code" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-stone-500">Inherent risk</span>
              <LevelPill level={assessment.inherent.level} />
              <span className="font-medium">{assessment.tier.label}</span>
            </div>
            <div>
              <p className="text-xs uppercase text-stone-500">Confirmed rows</p>
              <p className="text-lg font-semibold">
                {confirmed} / {s.ddq.length}
              </p>
              <p className="text-xs text-stone-600">
                {s.ddq.length - confirmed} awaiting review (not counted) · {strength.gaps} Gap · {strength.needsEvidence}{" "}
                Needs evidence among confirmed
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-stone-500">Control strength</p>
              <p className="font-semibold">{strength.strength ?? "Not assessed"}</p>
              <p className="text-xs text-stone-700">{strength.reason}</p>
              {strength.strength && confirmed < s.ddq.length && (
                <p className="mt-1 text-xs text-orange-800">
                  Partial: based on {confirmed} confirmed row{confirmed === 1 ? "" : "s"} only.
                </p>
              )}
            </div>
            <p className="border-t border-sky-200 pt-2 text-xs text-stone-600">
              Residual risk, findings and the recommendation are calculated on screen 3 (next pull request).
            </p>
          </div>
          <p className="text-xs text-stone-500">
            Saved only in this browser tab. Closing the tab erases the assessment; nothing is stored on a server.
          </p>
        </aside>
      </div>
    </div>
  );
}

function ReviewBanner({ state, onDiscard }: { state: AssessmentState; onDiscard: () => void }) {
  const r = state.review!;
  const g = r.guardrails;
  const checks: string[] = [];
  if (g.droppedIds) checks.push(`${g.droppedIds} suggested ID${g.droppedIds === 1 ? " was" : "s were"} not in this assessment and removed.`);
  if (g.droppedRows) checks.push(`${g.droppedRows} malformed or duplicate suggestion${g.droppedRows === 1 ? " was" : "s were"} removed.`);
  if (g.missingRows.length) checks.push(`No usable suggestion for ${g.missingRows.join(", ")}: rate ${g.missingRows.length === 1 ? "it" : "these"} yourself.`);
  if (g.truncatedFields) checks.push(`${g.truncatedFields} text field${g.truncatedFields === 1 ? " was" : "s were"} shortened to the length limit.`);

  return (
    <section className="space-y-2 rounded border border-violet-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge kind="AI" />
        <span className="font-medium">AI-generated, human-reviewed</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            r.mode === "live" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          {r.mode === "live" ? "Live" : "Demo mode"}
        </span>
        <button type="button" onClick={onDiscard} className="ml-auto text-xs text-stone-600 underline">
          Discard and start again
        </button>
      </div>
      {r.mode === "live" ? (
        <p>
          Generated by {r.source.model} at {new Date(r.source.generatedAt).toLocaleString()}.
        </p>
      ) : (
        <p>{DEMO_REASON_TEXT[r.demoReason ?? "requested"]}</p>
      )}
      {r.source.kind === "mock" && (
        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs">
          This saved review is a placeholder written by the developer, not model output. It will be replaced by a
          recorded model run.
        </p>
      )}
      {r.mode === "demo" && r.source.kind === "model" && <p className="text-xs text-stone-600">{r.source.note}</p>}
      {r.demoMatchesAnswers === false && (
        <p className="rounded border border-orange-300 bg-orange-50 p-2 text-xs">
          The saved review was produced for the sample&apos;s original inherent risk answers. Your changed answers are
          not reflected in it, so check conflicts yourself.
        </p>
      )}
      <p className="text-xs text-stone-600">
        <span className="font-medium">Validation:</span>{" "}
        {checks.length ? checks.join(" ") : `all ${state.ddq.length} suggestions passed; nothing was removed or shortened.`}
      </p>
    </section>
  );
}

function FollowUps({
  state,
  notices,
  onDismiss,
  onResolve,
}: {
  state: AssessmentState;
  notices: string[];
  onDismiss: () => void;
  onResolve: (iraId: string, to: "Yes" | "No", ddqId: string, note: string) => void;
}) {
  const open = assessInherent(state.ira).followUps;
  if (open.length === 0 && notices.length === 0) return null;
  return (
    <section className="space-y-3 rounded border border-amber-300 bg-amber-50/50 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        Open follow-ups ({open.length}) <Badge kind="Code" />
      </h2>
      {notices.length > 0 && (
        <div role="status" className="space-y-1 rounded border border-orange-300 bg-orange-50 p-2 text-sm">
          {notices.map((n) => (
            <p key={n}>{n}</p>
          ))}
          <button type="button" onClick={onDismiss} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}
      {open.length > 0 && (
        <p className="text-xs text-stone-600">
          Unknown inherent risk answers stay open until you resolve them. Resolving one from a questionnaire row updates
          the answer, re-scores inherent risk and records the note in the answer&apos;s history.
        </p>
      )}
      <ul className="space-y-3">
        {open.map((id) => (
          // Keyed on the AI review too, so the default source row updates when suggestions arrive.
          <FollowUpItem key={`${id}-${state.review?.receivedAt ?? "none"}`} iraId={id} state={state} onResolve={onResolve} />
        ))}
      </ul>
    </section>
  );
}

function FollowUpItem({
  iraId,
  state,
  onResolve,
}: {
  iraId: string;
  state: AssessmentState;
  onResolve: (iraId: string, to: "Yes" | "No", ddqId: string, note: string) => void;
}) {
  const uid = useId();
  const cited = state.ddq.filter((r) => r.ai?.conflict?.iraIds.includes(iraId)).map((r) => r.id);
  const [to, setTo] = useState<"Yes" | "No">("Yes");
  const [source, setSource] = useState(cited[0] ?? state.ddq[0]!.id);
  const [note, setNote] = useState("");
  return (
    <li className="space-y-2 rounded border border-amber-200 bg-white p-3 text-sm">
      <p>
        <span className="font-mono text-xs">{iraId}</span> {iraQuestion(iraId)}{" "}
        <span className="text-stone-500">(Unknown)</span>
      </p>
      {cited.length > 0 && (
        <p className="text-xs text-violet-800">
          AI flagged a related response: {cited.map((id) => <a key={id} href={`#${id}`} className="mr-1 underline">{id}</a>)}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`${uid}-to`} className="block text-xs text-stone-600">Answer</label>
          <select id={`${uid}-to`} value={to} onChange={(e) => setTo(e.target.value as "Yes" | "No")} className="rounded border border-stone-300 px-2 py-1">
            <option>Yes</option>
            <option>No</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-src`} className="block text-xs text-stone-600">Based on</label>
          <select id={`${uid}-src`} value={source} onChange={(e) => setSource(e.target.value)} className="rounded border border-stone-300 px-2 py-1">
            {state.ddq.map((r) => (
              <option key={r.id}>{r.id}</option>
            ))}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label htmlFor={`${uid}-note`} className="block text-xs text-stone-600">Note (required)</label>
          <input id={`${uid}-note`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="w-full rounded border border-stone-300 px-2 py-1" />
        </div>
        <button
          type="button"
          disabled={!note.trim()}
          onClick={() => onResolve(iraId, to, source, note)}
          className="rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Resolve
        </button>
      </div>
    </li>
  );
}
