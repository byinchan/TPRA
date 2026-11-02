// Report workflow: store an AI draft, analyst edits per section, preparer, approval. Pure.
import type { DemoReason, ReviewSource } from "../ai/types.ts";
import { computeOutcome } from "../outcome.ts";
import { PREPARER_MAX, type AssessmentState, type ReportSection } from "../session.ts";
import { buildFacts, factsFingerprint, type ReportFacts } from "./facts.ts";
import { checkNarrative, type Mismatch } from "./numberCheck.ts";
import { NARRATIVE_SECTIONS, SECTION_KEYS, SECTION_MAX, type Narrative, type SectionKey } from "./schema.ts";

export interface NarrativeSuccess {
  ok: true;
  mode: "live" | "demo";
  demoReason: DemoReason | null;
  demoMatchesFacts: boolean | null;
  source: ReviewSource;
  narrative: Narrative;
  truncated: number;
}

/** The facts as they stand now, and the key an approval is tied to. */
export function currentFacts(state: AssessmentState): { facts: ReportFacts; key: string } {
  const facts = buildFacts(state, computeOutcome(state));
  return { facts, key: JSON.stringify(facts) };
}

/** True when the figures the narrative could mention differ from when it was drafted. */
export function draftIsStale(state: AssessmentState): boolean {
  return state.report !== null && state.report.factsKey !== factsFingerprint(currentFacts(state).facts);
}

export function applyNarrative(state: AssessmentState, res: NarrativeSuccess, at: string): AssessmentState {
  const label = res.mode === "live" ? `live (${res.source.model ?? "model"})` : `demo (${res.demoReason})`;
  return {
    ...state,
    report: {
      mode: res.mode,
      demoReason: res.demoReason,
      source: res.source,
      demoMatchesFacts: res.demoMatchesFacts,
      draftedAt: at,
      factsKey: factsFingerprint(currentFacts(state).facts),
      sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, { aiText: res.narrative[k], text: res.narrative[k] }])) as Record<
        SectionKey,
        ReportSection
      >,
      preparer: state.report?.preparer ?? "",
      approved: null,
      history: [...(state.report?.history ?? []).slice(-40), { at, detail: `Narrative drafted: ${label}` }],
    },
  };
}

export function editSection(state: AssessmentState, key: SectionKey, text: string, at: string): AssessmentState {
  const r = state.report;
  if (!r) throw new Error("Draft the narrative first.");
  const t = text.trim();
  if (!t) throw new Error("A section cannot be empty.");
  if (t.length > SECTION_MAX * 2) throw new Error("Section is too long.");
  if (t === r.sections[key].text) return state;
  const title = NARRATIVE_SECTIONS.find((s) => s.key === key)!.title;
  return {
    ...state,
    report: {
      ...r,
      sections: { ...r.sections, [key]: { ...r.sections[key], text: t } },
      approved: null,
      history: [...r.history.slice(-45), { at, detail: `${title} edited${r.approved ? " (approval withdrawn)" : ""}` }],
    },
  };
}

export function setPreparer(state: AssessmentState, name: string, at: string): AssessmentState {
  const r = state.report;
  if (!r) throw new Error("Draft the narrative first.");
  const n = name.trim();
  if (n.length > PREPARER_MAX) throw new Error(`Name is longer than ${PREPARER_MAX} characters.`);
  if (n === r.preparer) return state;
  return {
    ...state,
    report: { ...r, preparer: n, approved: null, history: [...r.history.slice(-45), { at, detail: `Preparer: ${n || "(none)"}` }] },
  };
}

export function narrativeOf(state: AssessmentState): Narrative | null {
  const r = state.report;
  return r ? (Object.fromEntries(SECTION_KEYS.map((k) => [k, r.sections[k].text])) as Narrative) : null;
}

export interface ApprovalCheck {
  /** Each must be fixed before approval. */
  blockers: string[];
  mismatches: Mismatch[];
}

export function approvalCheck(state: AssessmentState): ApprovalCheck {
  const blockers: string[] = [];
  const o = computeOutcome(state);
  const { facts } = currentFacts(state);
  blockers.push(...o.blockers);
  const narrative = narrativeOf(state);
  if (!narrative) blockers.push("Draft the narrative.");
  const mismatches = narrative ? checkNarrative(narrative, facts) : [];
  if (mismatches.length) {
    blockers.push(`Number check: ${mismatches.length} figure${mismatches.length === 1 ? "" : "s"} in the narrative do not match the computed results.`);
  }
  const noDue = o.findings.filter((f) => f.status === "Open" && !f.dueDate).map((f) => f.id);
  if (noDue.length) blockers.push(`Set a due date on every open finding (${noDue.join(", ")}).`);
  if (!state.report?.preparer.trim()) blockers.push("Enter the preparer's name.");
  return { blockers, mismatches };
}

export function approveReport(state: AssessmentState, at: string): AssessmentState {
  const { blockers } = approvalCheck(state);
  if (blockers.length) throw new Error(`Cannot approve yet: ${blockers.join(" ")}`);
  const r = state.report!;
  return {
    ...state,
    report: {
      ...r,
      approved: { at, by: r.preparer, key: currentFacts(state).key },
      history: [...r.history.slice(-45), { at, detail: `Approved by ${r.preparer}` }],
    },
  };
}

/** An approval stands only while nothing in the facts has changed since. */
export function approvalStatus(state: AssessmentState): "approved" | "void" | "none" {
  const a = state.report?.approved;
  if (!a) return "none";
  return a.key === currentFacts(state).key ? "approved" : "void";
}

export function discardReport(state: AssessmentState): AssessmentState {
  return { ...state, report: null };
}
