// Which open items become findings (code), plus the owner, due date and status the analyst enters on screen 3.
import { FIPPA } from "../config/rules.ts";
import { isIsoDate } from "./dates.ts";
import { confirmRow, editDecision } from "./ddq.ts";
import type { FippaResult } from "./ira.ts";
import {
  DEFAULT_OWNER,
  FINDING_ID,
  OWNER_MAX,
  REASON_MAX,
  type AssessmentState,
  type FindingMeta,
  type FindingSnapshot,
} from "./session.ts";
import type { DdqRating } from "./types.ts";

export type FindingSource = FindingSnapshot["source"];

export interface FindingSeed extends FindingSnapshot {
  /** Stable: derived from the source row and kind, so it survives re-scoring. */
  id: string;
}

export interface FindingInputs {
  /** IRA IDs still answered "Unknown". */
  followUps: readonly { id: string; question: string }[];
  /** CONFIRMED questionnaire rows only. */
  confirmedDdq: readonly { id: string; question: string; rating: DdqRating }[];
  fippa: FippaResult;
}

export function collectFindings({ followUps, confirmedDdq, fippa }: FindingInputs): FindingSeed[] {
  return [
    ...followUps.map((f) => ({
      id: `F-${f.id}`,
      source: "IRA follow-up" as const,
      sourceRow: f.id,
      kind: "Follow-up" as const,
      title: `Resolve unknown answer: ${f.question}`,
    })),
    ...confirmedDdq
      .filter((r) => r.rating !== "Satisfactory")
      .map((r) => ({
        id: `F-${r.id}-${r.rating === "Gap" ? "GAP" : "NE"}`,
        source: "Due diligence" as const,
        sourceRow: r.id,
        kind: r.rating as "Gap" | "Needs evidence",
        title: `${r.rating}: ${r.question}`,
      })),
    ...(fippa.triggered
      ? [{ id: "F-FIPPA", source: "FIPPA" as const, sourceRow: FIPPA.leavesCanadaId, kind: "FIPPA" as const, title: FIPPA.findingTitle }]
      : []),
  ];
}

// ---------- findings with analyst details (screen 3) ----------

export interface Finding extends FindingSeed {
  owner: string;
  dueDate: string | null;
  status: FindingMeta["status"];
  closeNote: string | null;
  history: FindingMeta["history"];
  /**
   * How it can be closed: "note" (Gap, FIPPA), "re-rate" (Needs evidence: re-rate the source row),
   * "screen-2" (IRA follow-up: resolve the answer), or null when already closed.
   */
  closeBy: "note" | "re-rate" | "screen-2" | null;
  /** Closed, and its source has since changed: shown for traceability, cannot be reopened here. */
  archived: boolean;
}

const closeByKind = (kind: FindingSeed["kind"]): Finding["closeBy"] =>
  kind === "Follow-up" ? "screen-2" : kind === "Needs evidence" ? "re-rate" : "note";

/**
 * Current findings merged with the analyst's details, plus closed findings whose source has since changed
 * (kept from their snapshot) and follow-ups resolved on screens 1–2 (from the IRA answer history).
 */
export function withDetails(
  seeds: readonly FindingSeed[],
  meta: readonly FindingMeta[],
  resolvedFollowUps: readonly { seed: FindingSeed; note: string }[] = [],
): Finding[] {
  const current = seeds.map((seed): Finding => {
    const m = meta.find((x) => x.id === seed.id);
    // A Needs-evidence finding only closes by re-rating its row. If the row is Needs evidence again, it is open.
    const closed = m?.status === "Closed" && seed.kind !== "Needs evidence";
    return {
      ...seed,
      owner: m?.owner ?? DEFAULT_OWNER,
      dueDate: m?.dueDate ?? null,
      status: closed ? "Closed" : "Open",
      closeNote: closed ? (m?.closeNote ?? null) : null,
      history: m?.history ?? [],
      closeBy: closed ? null : closeByKind(seed.kind),
      archived: false,
    };
  });
  const ids = new Set(seeds.map((s) => s.id));
  const archived = meta
    .filter((m) => m.status === "Closed" && m.snapshot && !ids.has(m.id))
    .map((m): Finding => ({ id: m.id, ...m.snapshot!, owner: m.owner, dueDate: m.dueDate, status: "Closed", closeNote: m.closeNote, history: m.history, closeBy: null, archived: true }));
  const resolved = resolvedFollowUps
    .filter((r) => !ids.has(r.seed.id))
    .map((r): Finding => {
      const m = meta.find((x) => x.id === r.seed.id);
      return { ...r.seed, owner: m?.owner ?? DEFAULT_OWNER, dueDate: m?.dueDate ?? null, status: "Closed", closeNote: r.note, history: m?.history ?? [], closeBy: null, archived: true };
    });
  return [...current, ...resolved, ...archived];
}

function updateMeta(state: AssessmentState, id: string, fn: (m: FindingMeta) => FindingMeta): AssessmentState {
  if (!FINDING_ID.test(id)) throw new Error(`Unknown finding ${id}`);
  const current: FindingMeta = state.findings.find((m) => m.id === id) ?? {
    id,
    owner: DEFAULT_OWNER,
    dueDate: null,
    status: "Open",
    closeNote: null,
    snapshot: null,
    history: [],
  };
  const next = fn(current);
  if (next.history.length > 50) throw new Error("Too many changes recorded for this finding.");
  return { ...state, findings: [...state.findings.filter((m) => m.id !== id), next] };
}

const snapshotOf = ({ kind, source, sourceRow, title }: Finding): FindingSnapshot => ({ kind, source, sourceRow, title });

export function setOwner(state: AssessmentState, id: string, owner: string, at: string): AssessmentState {
  const o = owner.trim() || DEFAULT_OWNER;
  if (o.length > OWNER_MAX) throw new Error(`Owner is longer than ${OWNER_MAX} characters.`);
  return updateMeta(state, id, (m) =>
    m.owner === o ? m : { ...m, owner: o, history: [...m.history, { at, detail: `Owner: ${m.owner} → ${o}` }] },
  );
}

export function setDueDate(state: AssessmentState, id: string, dueDate: string | null, at: string): AssessmentState {
  if (dueDate !== null && !isIsoDate(dueDate)) throw new Error("Due date must be a valid date.");
  return updateMeta(state, id, (m) =>
    m.dueDate === dueDate
      ? m
      : { ...m, dueDate, history: [...m.history, { at, detail: `Due date: ${m.dueDate ?? "none"} → ${dueDate ?? "none"}` }] },
  );
}

const cleanNote = (note: string) => {
  const n = note.trim();
  if (!n) throw new Error("A note is required to close a finding.");
  if (n.length > REASON_MAX) throw new Error(`Note is longer than ${REASON_MAX} characters.`);
  return n;
};

/** Closes a Gap or FIPPA finding with a note. */
export function closeFinding(state: AssessmentState, finding: Finding, note: string, at: string): AssessmentState {
  if (finding.closeBy === "screen-2") throw new Error("Resolve this follow-up by answering the inherent risk question on screen 2.");
  if (finding.closeBy === "re-rate") throw new Error("Close a Needs evidence finding by re-rating its questionnaire row.");
  if (finding.closeBy !== "note") throw new Error("This finding is already closed.");
  const n = cleanNote(note);
  return updateMeta(state, finding.id, (m) => ({
    ...m,
    status: "Closed",
    closeNote: n,
    snapshot: snapshotOf(finding),
    history: [...m.history, { at, detail: `Closed: ${n}` }],
  }));
}

/**
 * Closes a Needs-evidence finding: the analyst re-rates the source row (Satisfactory or Gap) with the evidence
 * note as the reason, and the row is re-confirmed. Control strength recalculates from the new rating; a Gap
 * re-rating opens a new Gap finding.
 */
export function closeNeedsEvidence(
  state: AssessmentState,
  finding: Finding,
  newRating: "Satisfactory" | "Gap",
  note: string,
  at: string,
): AssessmentState {
  if (finding.closeBy !== "re-rate") throw new Error("Only an open Needs evidence finding is closed by re-rating.");
  const n = cleanNote(note);
  const row = state.ddq.find((r) => r.id === finding.sourceRow);
  if (!row?.confirmed || row.decision?.rating !== "Needs evidence") throw new Error(`${finding.sourceRow} is not a confirmed Needs evidence row.`);
  let next = editDecision(state, row.id, { rating: newRating }, at);
  next = confirmRow(next, row.id, `Evidence: ${n}`, at);
  return updateMeta(next, finding.id, (m) => ({
    ...m,
    status: "Closed",
    closeNote: `${n} (${row.id} re-rated ${newRating})`,
    snapshot: snapshotOf(finding),
    history: [...m.history, { at, detail: `Closed: ${n}. ${row.id} re-rated Needs evidence → ${newRating}` }],
  }));
}

/** Reopens a closed Gap or FIPPA finding whose source still applies. */
export function reopenFinding(state: AssessmentState, finding: Finding, at: string): AssessmentState {
  if (finding.status !== "Closed" || finding.archived || (finding.kind !== "Gap" && finding.kind !== "FIPPA")) {
    throw new Error("Only a closed Gap or FIPPA finding can be reopened here.");
  }
  return updateMeta(state, finding.id, (m) => ({
    ...m,
    status: "Open",
    closeNote: null,
    snapshot: null,
    history: [...m.history, { at, detail: "Reopened" }],
  }));
}
