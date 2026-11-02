// Everything screen 3, the report, the PDF and the Excel export show, computed in one place from the
// assessment state. Pure. The UI and the AI narrative only ever read this; they never compute.
import { FIPPA } from "../config/rules.ts";
import type { TierRule } from "../config/rules.ts";
import { nextReviewDate } from "./dates.ts";
import { confirmedRatings } from "./ddq.ts";
import { collectFindings, withDetails, type Finding } from "./findings.ts";
import { assessInherent, type FippaResult, type InherentResult } from "./ira.ts";
import { controlStrength, recommendation, residualRisk, type RecommendationResult, type ResidualResult, type StrengthResult } from "./residual.ts";
import { IRA_QUESTIONS, SAMPLES } from "./sample.ts";
import type { AssessmentState } from "./session.ts";

export interface Outcome {
  inherent: InherentResult;
  tier: TierRule;
  fippa: FippaResult;
  strength: StrengthResult;
  confirmedRows: number;
  totalRows: number;
  findings: Finding[];
  openFindings: number;
  /** Open Needs-evidence findings: residual risk stays "Provisional" while this is above 0. */
  openNeedsEvidence: number;
  /** null until every questionnaire row is confirmed (see `blockers`). */
  residual: ResidualResult | null;
  recommendation: RecommendationResult | null;
  /** YYYY-MM-DD, or null = at contract renewal (Tier 3). */
  nextReview: string | null;
  /** Why residual risk / recommendation are not available yet. Empty when they are. */
  blockers: string[];
  /** The code-written first line of the report. */
  recommendationLine: string;
}

export function computeOutcome(state: AssessmentState): Outcome {
  const sample = SAMPLES[state.sampleId]!;
  const a = assessInherent(state.ira);
  const strength = controlStrength(confirmedRatings(state));
  const question = (id: string) =>
    IRA_QUESTIONS.find((q) => q.id === id)?.question ?? sample.ddq.find((r) => r.id === id)?.question ?? id;

  const seeds = collectFindings({
    followUps: a.followUps.map((id) => ({ id, question: question(id) })),
    confirmedDdq: state.ddq
      .filter((r) => r.confirmed && r.decision)
      .map((r) => ({ id: r.id, question: question(r.id), rating: r.decision!.rating })),
    fippa: a.fippa,
  });
  // Follow-ups answered since they were Unknown, with the note from the answer's history.
  const resolvedFollowUps = state.ira.flatMap((r) => {
    const fromUnknown = [...r.history].reverse().find((h) => h.from === "Unknown");
    return r.answer !== "Unknown" && fromUnknown
      ? [
          {
            seed: {
              id: `F-${r.id}`,
              source: "IRA follow-up" as const,
              sourceRow: r.id,
              kind: "Follow-up" as const,
              title: `Resolve unknown answer: ${question(r.id)}`,
            },
            note: `Answered ${fromUnknown.to}: ${fromUnknown.reason}`,
          },
        ]
      : [];
  });
  const findings = withDetails(seeds, state.findings, resolvedFollowUps);
  const open = findings.filter((f) => f.status === "Open");
  const openNeedsEvidence = open.filter((f) => f.kind === "Needs evidence").length;

  const confirmedRows = state.ddq.filter((r) => r.confirmed).length;
  const totalRows = state.ddq.length;
  const blockers: string[] = [];
  if (!state.review) blockers.push("The questionnaire has not been reviewed yet (screen 2).");
  if (confirmedRows < totalRows) {
    blockers.push(`${totalRows - confirmedRows} of ${totalRows} questionnaire rows are awaiting review (screen 2).`);
  }

  const ready = blockers.length === 0 && strength.strength !== null;
  const residual = ready ? residualRisk(a.inherent.level, strength.strength!, openNeedsEvidence) : null;
  const rec = ready ? recommendation(residual!.level, strength.strength!, open.length) : null;

  return {
    inherent: a.inherent,
    tier: a.tier,
    fippa: a.fippa,
    strength,
    confirmedRows,
    totalRows,
    findings,
    openFindings: open.length,
    openNeedsEvidence,
    residual,
    recommendation: rec,
    nextReview: nextReviewDate(state.assessedOn, a.inherent.level),
    blockers,
    recommendationLine: rec
      ? `Recommendation: ${rec.decision}. Inherent risk ${a.inherent.level} (${a.tier.label}), control strength ${strength.strength}, residual risk ${residual!.level}${residual!.provisional ? " (provisional)" : ""}, ${open.length} open finding${open.length === 1 ? "" : "s"}.`
      : "Recommendation: not available until every questionnaire row is confirmed.",
  };
}

/** For display: the FIPPA finding's wording lives in config, not here. */
export const FIPPA_FINDING_TITLE = FIPPA.findingTitle;
