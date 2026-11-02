// The facts pack: the only information the narrative may use. Built by code from the confirmed state.
// Also the source of every figure the number check accepts. Pure.
import { RECOMMENDATION_MEANING } from "../../config/rules.ts";
import type { Outcome } from "../outcome.ts";
import { IRA_QUESTIONS, SAMPLES } from "../sample.ts";
import { DEFAULT_OWNER, type AssessmentState } from "../session.ts";

export interface ReportFacts {
  vendor: string;
  service: string;
  assessedOn: string;
  inherentRisk: {
    level: string;
    tier: string;
    depth: string;
    cadence: string;
    rule: string;
    highAnswers: number;
    mediumAnswers: number;
    highAnswerQuestions: { id: string; question: string; answer: string }[];
  };
  answersChangedFromSample: { id: string; question: string; from: string; to: string; reason: string }[];
  openFollowUps: { id: string; question: string }[];
  fippa: { triggered: boolean; explanation: string };
  dueDiligence: {
    rowsTotal: number;
    rowsConfirmed: number;
    satisfactory: number;
    gaps: number;
    needsEvidence: number;
    controlStrength: string | null;
    rule: string;
    aiSuggestionsOverridden: number;
    notableRows: { id: string; question: string; rating: string; analystRationale: string }[];
  };
  findings: { id: string; kind: string; title: string; owner: string; unassigned: boolean; dueDate: string | null; status: string }[];
  findingCounts: { total: number; open: number; closed: number; unassignedOpen: number; withoutDueDate: number };
  residualRisk: { level: string; provisional: boolean; rule: string } | null;
  recommendation: { decision: string; reason: string; meaning: string | null } | null;
  nextReviewDate: string | null;
  aiReview: { mode: string; source: string } | null;
}

export function buildFacts(state: AssessmentState, o: Outcome): ReportFacts {
  const sample = SAMPLES[state.sampleId]!;
  const q = (id: string) => IRA_QUESTIONS.find((x) => x.id === id)?.question ?? sample.ddq.find((r) => r.id === id)?.question ?? id;
  const confirmed = state.ddq.filter((r) => r.confirmed && r.decision);
  const count = (rating: string) => confirmed.filter((r) => r.decision!.rating === rating).length;
  const findings = o.findings.map((f) => ({
    id: f.id,
    kind: f.kind,
    title: f.title,
    owner: f.owner,
    unassigned: f.owner === DEFAULT_OWNER,
    dueDate: f.dueDate,
    status: f.status,
  }));
  const open = findings.filter((f) => f.status === "Open");
  return {
    vendor: sample.vendor,
    service: sample.service,
    assessedOn: state.assessedOn,
    inherentRisk: {
      level: o.inherent.level,
      tier: o.tier.label,
      depth: o.tier.depth,
      cadence: o.tier.cadence,
      rule: o.inherent.reason,
      highAnswers: o.inherent.highs.length,
      mediumAnswers: o.inherent.mediums.length,
      highAnswerQuestions: o.inherent.highs.map((id) => ({ id, question: q(id), answer: state.ira.find((r) => r.id === id)!.answer })),
    },
    answersChangedFromSample: state.ira
      .filter((r) => r.answer !== r.loadedAnswer)
      .map((r) => ({ id: r.id, question: q(r.id), from: r.loadedAnswer, to: r.answer, reason: r.history.at(-1)?.reason ?? "" })),
    openFollowUps: o.findings.filter((f) => f.kind === "Follow-up" && f.status === "Open").map((f) => ({ id: f.sourceRow, question: q(f.sourceRow) })),
    fippa: { triggered: o.fippa.triggered, explanation: o.fippa.reason },
    dueDiligence: {
      rowsTotal: o.totalRows,
      rowsConfirmed: o.confirmedRows,
      satisfactory: count("Satisfactory"),
      gaps: count("Gap"),
      needsEvidence: count("Needs evidence"),
      controlStrength: o.strength.strength,
      rule: o.strength.reason,
      aiSuggestionsOverridden: confirmed.filter((r) => r.ai && r.ai.rating !== r.decision!.rating).length,
      notableRows: confirmed
        .filter((r) => r.decision!.rating !== "Satisfactory")
        .map((r) => ({ id: r.id, question: q(r.id), rating: r.decision!.rating, analystRationale: r.decision!.note })),
    },
    findings,
    findingCounts: {
      total: findings.length,
      open: open.length,
      closed: findings.length - open.length,
      unassignedOpen: open.filter((f) => f.unassigned).length,
      withoutDueDate: open.filter((f) => !f.dueDate).length,
    },
    residualRisk: o.residual && { level: o.residual.level, provisional: o.residual.provisional, rule: o.residual.reason },
    recommendation: o.recommendation && {
      decision: o.recommendation.decision,
      reason: o.recommendation.reason,
      meaning: RECOMMENDATION_MEANING[o.recommendation.decision] ?? null,
    },
    nextReviewDate: o.nextReview,
    aiReview: state.review && {
      mode: state.review.mode,
      source: state.review.source.kind === "mock" ? "developer-written placeholder" : (state.review.source.model ?? "model"),
    },
  };
}

/**
 * Changes whenever a figure or rating the narrative could state changes. Owners and due dates are excluded:
 * the narrative does not state them (the code-written findings table does). Approval uses the full facts.
 */
export function factsFingerprint(f: ReportFacts): string {
  return JSON.stringify([
    f.inherentRisk.level,
    f.inherentRisk.tier,
    f.fippa.triggered,
    f.dueDiligence.rowsConfirmed,
    f.dueDiligence.satisfactory,
    f.dueDiligence.gaps,
    f.dueDiligence.needsEvidence,
    f.dueDiligence.controlStrength,
    f.findings.map((x) => [x.id, x.status]),
    f.residualRisk?.level,
    f.residualRisk?.provisional,
    f.recommendation?.decision,
    f.nextReviewDate,
    f.openFollowUps.map((x) => x.id),
  ]);
}

/** Code-written: what the report does not show. Always appended to Method & limitations. */
export const REPORT_DOES_NOT_SHOW =
  "What this report does not show: no evidence documents were reviewed in this tool, no on-site or technical testing was performed, vendor responses are self-reported, and the rating rules are a documented prototype method, not a validated scoring model.";
