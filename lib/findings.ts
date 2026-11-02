// Which open items become findings (code), plus the owner, due date and status the analyst enters on screen 3.
import { FIPPA } from "../config/rules.ts";
import { isIsoDate } from "./dates.ts";
import type { FippaResult } from "./ira.ts";
import { DEFAULT_OWNER, FINDING_ID, OWNER_MAX, REASON_MAX, type AssessmentState, type FindingMeta } from "./session.ts";
import type { DdqRating } from "./types.ts";

export type FindingSource = "IRA follow-up" | "Due diligence" | "FIPPA";

export interface FindingSeed {
  /** Stable: derived from the source row, so it survives re-scoring. */
  id: string;
  source: FindingSource;
  sourceRow: string;
  kind: "Follow-up" | "Gap" | "Needs evidence" | "FIPPA";
  title: string;
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
        id: `F-${r.id}`,
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
  /** IRA follow-ups close only by resolving the IRA answer (screen 2), never by hand. */
  closable: boolean;
}

/** Derived findings merged with whatever the analyst has entered for them. */
export function withDetails(seeds: readonly FindingSeed[], meta: readonly FindingMeta[]): Finding[] {
  return seeds.map((seed) => {
    const m = meta.find((x) => x.id === seed.id);
    return {
      ...seed,
      owner: m?.owner ?? DEFAULT_OWNER,
      dueDate: m?.dueDate ?? null,
      status: m?.status ?? "Open",
      closeNote: m?.closeNote ?? null,
      history: m?.history ?? [],
      closable: seed.source !== "IRA follow-up",
    };
  });
}

function updateMeta(
  state: AssessmentState,
  id: string,
  fn: (m: FindingMeta) => FindingMeta,
): AssessmentState {
  if (!FINDING_ID.test(id)) throw new Error(`Unknown finding ${id}`);
  const current = state.findings.find((m) => m.id === id) ?? {
    id,
    owner: DEFAULT_OWNER,
    dueDate: null,
    status: "Open" as const,
    closeNote: null,
    history: [],
  };
  const next = fn(current);
  if (next.history.length > 50) throw new Error("Too many changes recorded for this finding.");
  return { ...state, findings: [...state.findings.filter((m) => m.id !== id), next] };
}

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

export function closeFinding(state: AssessmentState, finding: Finding, note: string, at: string): AssessmentState {
  if (!finding.closable) throw new Error("Resolve this follow-up by answering the inherent risk question on screen 2.");
  const n = note.trim();
  if (!n) throw new Error("A note is required to close a finding.");
  if (n.length > REASON_MAX) throw new Error(`Note is longer than ${REASON_MAX} characters.`);
  return updateMeta(state, finding.id, (m) => ({
    ...m,
    status: "Closed",
    closeNote: n,
    history: [...m.history, { at, detail: `Closed: ${n}` }],
  }));
}

export function reopenFinding(state: AssessmentState, id: string, at: string): AssessmentState {
  return updateMeta(state, id, (m) =>
    m.status === "Open" ? m : { ...m, status: "Open", closeNote: null, history: [...m.history, { at, detail: "Reopened" }] },
  );
}
