// The AI review contract: the JSON schema sent to the model, and the validator every response
// (live or saved) must pass. The model is treated as untrusted: unknown IDs are dropped and counted,
// text is length-capped, and anything malformed is rejected. Pure functions.
import { LIMITS } from "../../config/ai.ts";
import { DDQ_RATINGS, type DdqRating } from "../types.ts";

export interface AiConflict {
  iraIds: string[];
  note: string;
}

export interface AiRowSuggestion {
  ddqId: string;
  rating: DdqRating;
  rationale: string;
  conflict: AiConflict | null;
  evidenceToRequest: string | null;
}

export interface AiInconsistency {
  iraIds: string[];
  note: string;
}

export interface AiReview {
  rows: AiRowSuggestion[];
  iraInconsistencies: AiInconsistency[];
}

export interface Guardrails {
  /** Suggested IDs that do not exist (DDQ rows or IRA references) and were removed. */
  droppedIds: number;
  /** Rows removed because they were duplicates or malformed. */
  droppedRows: number;
  /** Questionnaire rows with no usable AI suggestion. */
  missingRows: string[];
  /** Text fields shortened to the length cap. */
  truncatedFields: number;
}

const conflictSchema = {
  type: "object",
  properties: {
    iraIds: { type: "array", items: { type: "string" }, description: "IRA IDs from the input, e.g. IRA-12" },
    note: { type: "string", description: "One sentence: what conflicts and why it matters" },
  },
  required: ["iraIds", "note"],
  additionalProperties: false,
} as const;

/** Sent as output_config.format. Only features the structured-outputs docs list as supported. */
export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ddqId: { type: "string", description: "Questionnaire row ID from the input, e.g. DDQ-01" },
          rating: { type: "string", enum: [...DDQ_RATINGS] },
          rationale: { type: "string", description: "One line, grounded only in the row and the IRA answers" },
          conflict: { anyOf: [{ type: "null" }, conflictSchema] },
          evidenceToRequest: { anyOf: [{ type: "null" }, { type: "string" }] },
        },
        required: ["ddqId", "rating", "rationale", "conflict", "evidenceToRequest"],
        additionalProperties: false,
      },
    },
    iraInconsistencies: {
      type: "array",
      items: conflictSchema,
    },
  },
  required: ["rows", "iraInconsistencies"],
  additionalProperties: false,
} as const;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function validateReview(
  raw: unknown,
  known: { iraIds: readonly string[]; ddqIds: readonly string[] },
): { review: AiReview; guardrails: Guardrails } | null {
  if (!isObject(raw) || !Array.isArray(raw.rows) || !Array.isArray(raw.iraInconsistencies)) return null;
  const g: Guardrails = { droppedIds: 0, droppedRows: 0, missingRows: [], truncatedFields: 0 };
  const ira = new Set(known.iraIds);
  const ddq = new Set(known.ddqIds);

  const text = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    g.truncatedFields++;
    return `${t.slice(0, max - 1).trimEnd()}…`;
  };
  const iraRefs = (v: unknown): string[] | null => {
    if (!Array.isArray(v)) return null;
    const ids = [...new Set(v.filter((x): x is string => typeof x === "string"))];
    const valid = ids.filter((id) => ira.has(id));
    g.droppedIds += ids.length - valid.length;
    return valid;
  };
  const conflictOf = (v: unknown, minIds: number): AiConflict | null => {
    if (!isObject(v)) return null;
    const iraIds = iraRefs(v.iraIds);
    const note = text(v.note, LIMITS.maxNoteChars);
    return iraIds && iraIds.length >= minIds && note ? { iraIds, note } : null;
  };

  const rows: AiRowSuggestion[] = [];
  const seen = new Set<string>();
  for (const r of raw.rows) {
    if (!isObject(r) || typeof r.ddqId !== "string") {
      g.droppedRows++;
      continue;
    }
    if (!ddq.has(r.ddqId)) {
      g.droppedIds++;
      continue;
    }
    if (seen.has(r.ddqId)) {
      g.droppedRows++;
      continue;
    }
    const rating = DDQ_RATINGS.find((x) => x === r.rating);
    const rationale = text(r.rationale, LIMITS.maxRationaleChars);
    if (!rating || !rationale) {
      g.droppedRows++;
      continue;
    }
    seen.add(r.ddqId);
    const evidence = r.evidenceToRequest === null ? null : text(r.evidenceToRequest, LIMITS.maxEvidenceChars);
    rows.push({
      ddqId: r.ddqId,
      rating,
      rationale,
      conflict: r.conflict === null ? null : conflictOf(r.conflict, 1),
      evidenceToRequest: evidence || null,
    });
  }
  // Keep questionnaire order regardless of the order the model used.
  rows.sort((a, b) => known.ddqIds.indexOf(a.ddqId) - known.ddqIds.indexOf(b.ddqId));
  g.missingRows = known.ddqIds.filter((id) => !seen.has(id));

  const iraInconsistencies = raw.iraInconsistencies
    .slice(0, LIMITS.maxInconsistencies)
    .map((c) => conflictOf(c, 2))
    .filter((c): c is AiInconsistency => c !== null);

  return { review: { rows, iraInconsistencies }, guardrails: g };
}
