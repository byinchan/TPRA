// Due diligence review workflow (screen 2). Pure: every function returns a new state.
// The AI proposes, the analyst edits and confirms; only confirmed rows count anywhere downstream.
import type { ReviewSuccess } from "./ai/types.ts";
import { EVIDENCE_MAX, NOTE_MAX, REASON_MAX, setIraAnswer, type AssessmentState, type DdqDecision, type DdqEvent, type DdqState } from "./session.ts";
import type { DdqRating } from "./types.ts";

const HISTORY_MAX = 50;

function withEvent(row: DdqState, event: DdqEvent): DdqState["history"] {
  if (row.history.length >= HISTORY_MAX) throw new Error("Too many changes recorded for this row.");
  return [...row.history, event];
}

function mapRow(state: AssessmentState, id: string, fn: (row: DdqState) => DdqState): AssessmentState {
  if (!state.ddq.some((r) => r.id === id)) throw new Error(`Unknown questionnaire row ${id}`);
  return { ...state, ddq: state.ddq.map((r) => (r.id === id ? fn(r) : r)) };
}

/** The AI suggestion as a draft decision, or null when there is no suggestion. */
export function aiDraft(row: DdqState): DdqDecision | null {
  return row.ai ? { rating: row.ai.rating, note: row.ai.rationale, evidence: row.ai.evidenceToRequest ?? "" } : null;
}

/** What the analyst currently has for the row: their edits, else the AI draft. */
export function effectiveDecision(row: DdqState): DdqDecision | null {
  return row.decision ?? aiDraft(row);
}

export function needsOverrideReason(row: DdqState): boolean {
  const d = effectiveDecision(row);
  return Boolean(row.ai && d && d.rating !== row.ai.rating);
}

export type Provenance = "AI-suggested" | "Human-edited" | "Analyst-entered";

/** Badges: where the current values came from, and whether the row counts yet. */
export function rowBadges(row: DdqState): { provenance: Provenance | null; status: "Confirmed" | "Awaiting review" } {
  const draft = aiDraft(row);
  const d = row.decision;
  const edited =
    d !== null && (!draft || d.rating !== draft.rating || d.note !== draft.note || d.evidence !== draft.evidence);
  const provenance: Provenance | null = !row.ai ? (d ? "Analyst-entered" : null) : edited ? "Human-edited" : "AI-suggested";
  return { provenance, status: row.confirmed ? "Confirmed" : "Awaiting review" };
}

/** Stores an AI review. Only allowed before any row has AI data (discard first to run again). */
export function applyAiReview(state: AssessmentState, result: ReviewSuccess, at: string): AssessmentState {
  if (state.review) throw new Error("An AI review is already loaded. Discard it before requesting another.");
  const label = result.mode === "live" ? `live (${result.source.model ?? "model"})` : `demo (${result.demoReason})`;
  return {
    ...state,
    review: {
      mode: result.mode,
      demoReason: result.demoReason,
      demoMatchesAnswers: result.demoMatchesAnswers,
      source: result.source,
      guardrails: result.guardrails,
      iraInconsistencies: result.review.iraInconsistencies,
      receivedAt: at,
    },
    ddq: state.ddq.map((row) => {
      const ai = result.review.rows.find((s) => s.ddqId === row.id) ?? null;
      return ai
        ? { ...row, ai, history: withEvent(row, { at, action: "ai-suggested", detail: `${ai.rating}, ${label}` }) }
        : row;
    }),
  };
}

/** Clears the AI review and every decision, so the review can start again. IRA answers are untouched. */
export function discardAiReview(state: AssessmentState): AssessmentState {
  return {
    ...state,
    review: null,
    ddq: state.ddq.map((r) => ({ ...r, ai: null, decision: null, overrideReason: null, confirmed: false, history: [] })),
  };
}

/** Analyst edits a row. Editing a confirmed row reopens it. */
export function editDecision(state: AssessmentState, id: string, patch: Partial<DdqDecision>, at: string): AssessmentState {
  return mapRow(state, id, (row) => {
    const base = effectiveDecision(row) ?? { rating: "Satisfactory" as DdqRating, note: "", evidence: "" };
    const next: DdqDecision = { ...base, ...patch };
    if (next.note.length > NOTE_MAX || next.evidence.length > EVIDENCE_MAX) throw new Error("Text is too long.");
    const changes = (["rating", "note", "evidence"] as const)
      .filter((k) => next[k] !== base[k])
      .map((k) => (k === "rating" ? `rating ${base.rating} → ${next.rating}` : `${k} edited`));
    if (changes.length === 0 && row.decision) return row;
    let history = row.history;
    if (row.confirmed) history = [...history, { at, action: "reopened" as const, detail: "Edited after confirmation" }];
    if (changes.length) history = [...history, { at, action: "edited" as const, detail: changes.join("; ") }];
    if (history.length > HISTORY_MAX) throw new Error("Too many changes recorded for this row.");
    return { ...row, decision: next, confirmed: false, overrideReason: null, history };
  });
}

/** Confirms a row. If the rating differs from the AI's, a reason is required (any reason given is recorded). */
export function confirmRow(state: AssessmentState, id: string, overrideReason: string | null, at: string): AssessmentState {
  return mapRow(state, id, (row) => {
    const d = effectiveDecision(row);
    if (!d) throw new Error("Choose a rating before confirming.");
    // A reason is required when the rating differs from the AI's; one given anyway is recorded too.
    const reason = overrideReason?.trim() || null;
    if (needsOverrideReason(row) && !reason) {
      throw new Error("A reason is required when your rating differs from the AI suggestion.");
    }
    if (reason && reason.length > REASON_MAX) throw new Error(`Reason is longer than ${REASON_MAX} characters.`);
    const vsAi = row.ai && row.ai.rating !== d.rating ? ` (AI: ${row.ai.rating})` : "";
    const detail = reason ? `${d.rating}${vsAi}. Reason: ${reason}` : d.rating;
    return {
      ...row,
      decision: d,
      overrideReason: reason,
      confirmed: true,
      history: withEvent(row, { at, action: "confirmed", detail }),
    };
  });
}

export function reopenRow(state: AssessmentState, id: string, at: string): AssessmentState {
  return mapRow(state, id, (row) =>
    row.confirmed ? { ...row, confirmed: false, history: withEvent(row, { at, action: "reopened", detail: "Reopened" }) } : row,
  );
}

/** Ratings of CONFIRMED rows only: the input to control strength. */
export function confirmedRatings(state: AssessmentState): DdqRating[] {
  return state.ddq.filter((r) => r.confirmed && r.decision).map((r) => r.decision!.rating);
}

/**
 * Resolves an open IRA follow-up (an Unknown answer) from a questionnaire row, with a note.
 * Updates the IRA answer through the same audited path as screen 1, so it re-scores everywhere.
 */
export function resolveFollowUp(
  state: AssessmentState,
  iraId: string,
  to: "Yes" | "No",
  ddqId: string,
  note: string,
  at: string,
): AssessmentState {
  const ira = state.ira.find((r) => r.id === iraId);
  if (!ira || ira.answer !== "Unknown") throw new Error(`${iraId} is not an open follow-up.`);
  if (!state.ddq.some((r) => r.id === ddqId)) throw new Error(`Unknown questionnaire row ${ddqId}`);
  const trimmed = note.trim();
  if (!trimmed) throw new Error("A note is required to resolve a follow-up.");
  return setIraAnswer(state, iraId, to, `Resolved from ${ddqId}: ${trimmed}`, at);
}
