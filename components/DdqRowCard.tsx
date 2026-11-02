"use client";
// One questionnaire row: vendor response | AI suggestion | analyst decision, visibly separate.
import { useEffect, useId, useState } from "react";
import { effectiveDecision, needsOverrideReason, rowBadges } from "@/lib/ddq.ts";
import { EVIDENCE_MAX, NOTE_MAX, REASON_MAX, type DdqDecision, type DdqState } from "@/lib/session.ts";
import { DDQ_RATINGS, type DdqRating } from "@/lib/types.ts";
import { Badge, RatingPill } from "./Badge.tsx";

export function DdqRowCard({
  row,
  question,
  iraQuestion,
  onEdit,
  onConfirm,
  onReopen,
}: {
  row: DdqState;
  question: string;
  iraQuestion: (id: string) => string;
  onEdit: (id: string, patch: Partial<DdqDecision>) => void;
  onConfirm: (id: string, overrideReason: string | null) => void;
  onReopen: (id: string) => void;
}) {
  const uid = useId();
  const d = effectiveDecision(row);
  const badges = rowBadges(row);
  const overrideNeeded = needsOverrideReason(row);
  // Text fields are committed on blur so history records edits, not keystrokes.
  const [note, setNote] = useState(d?.note ?? "");
  const [evidence, setEvidence] = useState(d?.evidence ?? "");
  const [reason, setReason] = useState(row.overrideReason ?? "");
  useEffect(() => {
    setNote(d?.note ?? "");
    setEvidence(d?.evidence ?? "");
  }, [d?.note, d?.evidence]);

  const canConfirm = d !== null && (!overrideNeeded || reason.trim().length > 0);

  return (
    <li
      id={row.id}
      className={`scroll-mt-16 rounded border bg-white ${row.confirmed ? "border-emerald-300" : "border-stone-200"}`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-3 py-2">
        <span className="font-mono text-xs text-stone-500">{row.id}</span>
        <span className="text-sm font-medium">{question}</span>
        <span className="ml-auto flex gap-1">
          {badges.provenance && <Badge kind={badges.provenance} />}
          <Badge kind={badges.status} />
        </span>
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-3">
        <section aria-label="Vendor response" className="space-y-1">
          <p className="text-xs uppercase text-stone-500">Vendor response</p>
          <p className="text-sm text-stone-800">{row.response}</p>
        </section>

        <section aria-label="AI suggestion" className="space-y-1 rounded bg-violet-50/60 p-2">
          <p className="flex items-center gap-2 text-xs uppercase text-stone-500">
            AI suggestion <Badge kind="AI" />
          </p>
          {row.ai ? (
            <>
              <RatingPill rating={row.ai.rating} />
              <p className="text-sm">{row.ai.rationale}</p>
              {row.ai.conflict && (
                <p className="rounded border border-orange-200 bg-orange-50 p-1.5 text-xs">
                  <span className="font-medium">Conflict with {row.ai.conflict.iraIds.join(", ")}</span>
                  {row.ai.conflict.iraIds.map((id) => (
                    <span key={id} className="block text-stone-500">
                      {id}: {iraQuestion(id)}
                    </span>
                  ))}
                  <span className="mt-1 block">{row.ai.conflict.note}</span>
                </p>
              )}
              {row.ai.evidenceToRequest && (
                <p className="text-xs text-stone-700">
                  <span className="font-medium">Evidence to request:</span> {row.ai.evidenceToRequest}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-stone-500">No AI suggestion for this row. Rate it yourself.</p>
          )}
        </section>

        <section aria-label="Analyst decision" className="space-y-2 rounded bg-amber-50/50 p-2">
          <p className="flex items-center gap-2 text-xs uppercase text-stone-500">
            Analyst decision <Badge kind="Analyst" />
          </p>
          <div>
            <label htmlFor={`${uid}-rating`} className="sr-only">
              Rating for {row.id}
            </label>
            <select
              id={`${uid}-rating`}
              value={d?.rating ?? ""}
              onChange={(e) => onEdit(row.id, { rating: e.target.value as DdqRating })}
              className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm"
            >
              {!d && <option value="">Choose a rating…</option>}
              {DDQ_RATINGS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-note`} className="text-xs text-stone-600">
              Rationale
            </label>
            <textarea
              id={`${uid}-note`}
              value={note}
              rows={2}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => note !== (d?.note ?? "") && onEdit(row.id, { note })}
              className="w-full rounded border border-stone-300 bg-white p-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`${uid}-evidence`} className="text-xs text-stone-600">
              Evidence to request
            </label>
            <input
              id={`${uid}-evidence`}
              value={evidence}
              maxLength={EVIDENCE_MAX}
              onChange={(e) => setEvidence(e.target.value)}
              onBlur={() => evidence !== (d?.evidence ?? "") && onEdit(row.id, { evidence })}
              className="w-full rounded border border-stone-300 bg-white p-1.5 text-sm"
            />
          </div>
          {overrideNeeded && !row.confirmed && (
            <div>
              <label htmlFor={`${uid}-reason`} className="text-xs font-medium text-orange-800">
                Reason for changing the AI rating ({row.ai!.rating} → {d!.rating}), required
              </label>
              <input
                id={`${uid}-reason`}
                value={reason}
                maxLength={REASON_MAX}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded border border-orange-300 bg-white p-1.5 text-sm"
              />
            </div>
          )}
          {row.confirmed ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-emerald-800">✓ Confirmed: {d?.rating}</span>
              <button
                type="button"
                onClick={() => onReopen(row.id)}
                className="ml-auto rounded px-2 py-1 text-xs text-stone-600 underline hover:bg-stone-100"
              >
                Reopen
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(row.id, overrideNeeded ? reason : null)}
              className="w-full rounded bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm {d ? d.rating : ""}
            </button>
          )}
          {row.confirmed && row.overrideReason && (
            <p className="text-xs text-stone-600">Override reason: {row.overrideReason}</p>
          )}
        </section>
      </div>

      {row.history.length > 0 && (
        <details className="border-t border-stone-100 px-3 py-2 text-xs">
          <summary className="cursor-pointer text-stone-600">History ({row.history.length})</summary>
          <ol className="mt-1 space-y-0.5 border-l-2 border-stone-200 pl-3 text-stone-700">
            {row.history.map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time> · {h.action}: {h.detail}
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}
