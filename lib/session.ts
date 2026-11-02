// Assessment state kept in sessionStorage for the current tab only. Pure: no browser APIs here.
// Anything loaded from storage is validated against this schema and discarded if it fails.
import { ANSWER_RATINGS } from "../config/rules.ts";
import { isIsoDate } from "./dates.ts";
import { DDQ_IDS, SAMPLES, type SampleVendor } from "./sample.ts";
import { ANSWERS, type Answer } from "./types.ts";

export const STORAGE_KEY = "tpra.assessment.v1";
export const STATE_VERSION = 1;
export const REASON_MAX = 300;
const RESPONSE_MAX = 2000;
const HISTORY_MAX = 50;

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

export interface DdqState {
  id: string;
  response: string;
}

export interface AssessmentState {
  version: typeof STATE_VERSION;
  sampleId: string;
  /** YYYY-MM-DD, set when the sample is loaded. */
  assessedOn: string;
  ira: IraState[];
  ddq: DdqState[];
}

const IRA_IDS = Object.keys(ANSWER_RATINGS);

export function createFromSample(sample: SampleVendor, assessedOn: string): AssessmentState {
  return {
    version: STATE_VERSION,
    sampleId: sample.id,
    assessedOn,
    ira: sample.iraAnswers.map(({ id, answer }) => ({ id, answer, loadedAnswer: answer, history: [] })),
    ddq: sample.ddq.map(({ id, response }) => ({ id, response })),
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

function isChange(v: unknown): v is AnswerChange {
  return (
    isObject(v) &&
    isAnswer(v.from) &&
    isAnswer(v.to) &&
    typeof v.at === "string" &&
    !Number.isNaN(Date.parse(v.at)) &&
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

function isDdqRow(v: unknown, expectedId: string | undefined): v is DdqState {
  return isObject(v) && v.id === expectedId && isShortString(v.response, RESPONSE_MAX);
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
  if (!Array.isArray(v.ddq) || v.ddq.length !== DDQ_IDS.length) return null;
  if (!v.ddq.every((row, i) => isDdqRow(row, DDQ_IDS[i]))) return null;
  // Rebuild so unknown extra fields are dropped.
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
    ddq: (v.ddq as DdqState[]).map(({ id, response }) => ({ id, response })),
  };
}
