// Assessment state kept in sessionStorage for the current tab only. Pure: no browser APIs here.
// Anything loaded from storage is validated against this schema and discarded if it fails.
import { LIMITS } from "../config/ai.ts";
import { ANSWER_RATINGS } from "../config/rules.ts";
import { isStoredAiRow, isStoredInconsistency, type AiInconsistency, type AiRowSuggestion, type Guardrails } from "./ai/schema.ts";
import { DEMO_REASONS, type DemoReason, type ReviewSource } from "./ai/types.ts";
import { isIsoDate } from "./dates.ts";
import { DDQ_IDS, SAMPLES, type SampleVendor } from "./sample.ts";
import { ANSWERS, DDQ_RATINGS, type Answer, type DdqRating } from "./types.ts";

export const STORAGE_KEY = "tpra.assessment.v2";
export const STATE_VERSION = 2;
export const REASON_MAX = 300;
export const NOTE_MAX = LIMITS.maxRationaleChars;
export const EVIDENCE_MAX = LIMITS.maxEvidenceChars;
const RESPONSE_MAX = 2000;
const HISTORY_MAX = 50;
const DETAIL_MAX = 600;

export interface AnswerChange {
  from: Answer;
  to: Answer;
  /** ISO timestamp. */
  at: string;
  reason: string;
}

export interface IraState {
  id: string;
  answer: Answer;
  /** The answer as loaded from the sample, kept for traceability. */
  loadedAnswer: Answer;
  history: AnswerChange[];
}

/** The analyst's decision for a questionnaire row. */
export interface DdqDecision {
  rating: DdqRating;
  note: string;
  evidence: string;
}

export const DDQ_EVENTS = ["ai-suggested", "edited", "confirmed", "reopened"] as const;
export interface DdqEvent {
  at: string;
  action: (typeof DDQ_EVENTS)[number];
  detail: string;
}

export interface DdqState {
  id: string;
  response: string;
  /** The AI's original suggestion, kept unchanged for traceability. null = none (not run, or missing). */
  ai: AiRowSuggestion | null;
  /** The analyst's edits. null = not edited (the AI suggestion stands as the draft). */
  decision: DdqDecision | null;
  /** Required when the confirmed rating differs from the AI's. */
  overrideReason: string | null;
  confirmed: boolean;
  history: DdqEvent[];
}

/** What came back from the review route, minus the per-row suggestions (stored on each row). */
export interface ReviewMeta {
  mode: "live" | "demo";
  demoReason: DemoReason | null;
  demoMatchesAnswers: boolean | null;
  source: ReviewSource;
  guardrails: Guardrails;
  iraInconsistencies: AiInconsistency[];
  receivedAt: string;
}

export interface AssessmentState {
  version: typeof STATE_VERSION;
  sampleId: string;
  /** YYYY-MM-DD, set when the sample is loaded. */
  assessedOn: string;
  ira: IraState[];
  review: ReviewMeta | null;
  ddq: DdqState[];
}

const IRA_IDS = Object.keys(ANSWER_RATINGS);

export function createFromSample(sample: SampleVendor, assessedOn: string): AssessmentState {
  return {
    version: STATE_VERSION,
    sampleId: sample.id,
    assessedOn,
    ira: sample.iraAnswers.map(({ id, answer }) => ({ id, answer, loadedAnswer: answer, history: [] })),
    review: null,
    ddq: sample.ddq.map(({ id, response }) => ({
      id,
      response,
      ai: null,
      decision: null,
      overrideReason: null,
      confirmed: false,
      history: [],
    })),
  };
}

/** Records an analyst's answer change. A non-empty reason is required. */
export function setIraAnswer(state: AssessmentState, id: string, to: Answer, reason: string, at: string): AssessmentState {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("A reason is required to change an answer.");
  if (trimmed.length > REASON_MAX) throw new Error(`Reason is longer than ${REASON_MAX} characters.`);
  const row = state.ira.find((r) => r.id === id);
  if (!row) throw new Error(`Unknown IRA row ${id}`);
  if (row.answer === to) return state;
  if (row.history.length >= HISTORY_MAX) throw new Error("Too many changes recorded for this answer.");
  return {
    ...state,
    ira: state.ira.map((r) =>
      r.id === id ? { ...r, answer: to, history: [...r.history, { from: r.answer, to, at, reason: trimmed }] } : r,
    ),
  };
}

// ---------- validation ----------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isAnswer = (v: unknown): v is Answer => typeof v === "string" && (ANSWERS as readonly string[]).includes(v);
const isShortString = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const isTimestamp = (v: unknown) => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
const IRA_SET = new Set(IRA_IDS);

function isChange(v: unknown): v is AnswerChange {
  return (
    isObject(v) &&
    isAnswer(v.from) &&
    isAnswer(v.to) &&
    isTimestamp(v.at) &&
    isShortString(v.reason, REASON_MAX) &&
    (v.reason as string).trim().length > 0
  );
}

function isIraRow(v: unknown, expectedId: string | undefined): v is IraState {
  return (
    isObject(v) &&
    v.id === expectedId &&
    isAnswer(v.answer) &&
    isAnswer(v.loadedAnswer) &&
    Array.isArray(v.history) &&
    v.history.length <= HISTORY_MAX &&
    v.history.every(isChange)
  );
}

function isDecision(v: unknown): v is DdqDecision {
  return (
    isObject(v) &&
    DDQ_RATINGS.some((r) => r === v.rating) &&
    isShortString(v.note, NOTE_MAX) &&
    isShortString(v.evidence, EVIDENCE_MAX)
  );
}

function isEvent(v: unknown): v is DdqEvent {
  return (
    isObject(v) &&
    isTimestamp(v.at) &&
    DDQ_EVENTS.some((a) => a === v.action) &&
    isShortString(v.detail, DETAIL_MAX)
  );
}

function isDdqRow(v: unknown, expectedId: string | undefined): v is DdqState {
  return (
    isObject(v) &&
    typeof expectedId === "string" &&
    v.id === expectedId &&
    isShortString(v.response, RESPONSE_MAX) &&
    (v.ai === null || isStoredAiRow(v.ai, expectedId, IRA_SET)) &&
    (v.decision === null || isDecision(v.decision)) &&
    (v.overrideReason === null || (isShortString(v.overrideReason, REASON_MAX) && (v.overrideReason as string).trim() !== "")) &&
    typeof v.confirmed === "boolean" &&
    Array.isArray(v.history) &&
    v.history.length <= HISTORY_MAX &&
    v.history.every(isEvent)
  );
}

function isReviewMeta(v: unknown): v is ReviewMeta {
  if (!isObject(v)) return false;
  const s = v.source;
  const g = v.guardrails;
  return (
    (v.mode === "live" || v.mode === "demo") &&
    (v.demoReason === null || DEMO_REASONS.some((r) => r === v.demoReason)) &&
    (v.demoMatchesAnswers === null || typeof v.demoMatchesAnswers === "boolean") &&
    isObject(s) &&
    (s.kind === "model" || s.kind === "mock") &&
    (s.model === null || isShortString(s.model, 100)) &&
    isTimestamp(s.generatedAt) &&
    isShortString(s.note, 500) &&
    isObject(g) &&
    [g.droppedIds, g.droppedRows, g.truncatedFields].every((n) => Number.isInteger(n) && (n as number) >= 0) &&
    Array.isArray(g.missingRows) &&
    g.missingRows.every((id) => typeof id === "string" && DDQ_IDS.includes(id)) &&
    Array.isArray(v.iraInconsistencies) &&
    v.iraInconsistencies.length <= LIMITS.maxInconsistencies &&
    v.iraInconsistencies.every((c) => isStoredInconsistency(c, IRA_SET)) &&
    isTimestamp(v.receivedAt)
  );
}

/** Returns a valid state, or null if the input is missing or fails any check. */
export function parseState(raw: string | null): AssessmentState | null {
  if (raw === null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(v)) return null;
  if (v.version !== STATE_VERSION) return null;
  if (typeof v.sampleId !== "string" || !(v.sampleId in SAMPLES)) return null;
  if (typeof v.assessedOn !== "string" || !isIsoDate(v.assessedOn)) return null;
  if (!Array.isArray(v.ira) || v.ira.length !== IRA_IDS.length) return null;
  if (!v.ira.every((row, i) => isIraRow(row, IRA_IDS[i]))) return null;
  if (!(v.review === null || isReviewMeta(v.review))) return null;
  if (!Array.isArray(v.ddq) || v.ddq.length !== DDQ_IDS.length) return null;
  if (!v.ddq.every((row, i) => isDdqRow(row, DDQ_IDS[i]))) return null;
  // Rebuild so unknown extra fields are dropped.
  const review = v.review as ReviewMeta | null;
  return {
    version: STATE_VERSION,
    sampleId: v.sampleId,
    assessedOn: v.assessedOn,
    ira: (v.ira as IraState[]).map(({ id, answer, loadedAnswer, history }) => ({
      id,
      answer,
      loadedAnswer,
      history: history.map(({ from, to, at, reason }) => ({ from, to, at, reason })),
    })),
    review: review && {
      mode: review.mode,
      demoReason: review.demoReason,
      demoMatchesAnswers: review.demoMatchesAnswers,
      source: {
        kind: review.source.kind,
        model: review.source.model,
        generatedAt: review.source.generatedAt,
        note: review.source.note,
      },
      guardrails: {
        droppedIds: review.guardrails.droppedIds,
        droppedRows: review.guardrails.droppedRows,
        missingRows: [...review.guardrails.missingRows],
        truncatedFields: review.guardrails.truncatedFields,
      },
      iraInconsistencies: review.iraInconsistencies.map(({ iraIds, note }) => ({ iraIds: [...iraIds], note })),
      receivedAt: review.receivedAt,
    },
    ddq: (v.ddq as DdqState[]).map(({ id, response, ai, decision, overrideReason, confirmed, history }) => ({
      id,
      response,
      ai: ai && {
        ddqId: ai.ddqId,
        rating: ai.rating,
        rationale: ai.rationale,
        conflict: ai.conflict && { iraIds: [...ai.conflict.iraIds], note: ai.conflict.note },
        evidenceToRequest: ai.evidenceToRequest,
      },
      decision: decision && { rating: decision.rating, note: decision.note, evidence: decision.evidence },
      overrideReason,
      confirmed,
      history: history.map(({ at, action, detail }) => ({ at, action, detail })),
    })),
  };
}
