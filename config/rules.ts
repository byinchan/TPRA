// Every threshold the app uses lives here. The UI shows these rules; lib/ applies them.
// CONFIRMED rules were decided by Bernadette on 2026-11-02. DRAFT rules still need her sign-off.
import type { Answer, Level } from "../lib/types.ts";

export type RuleStatus = "Confirmed" | "Draft";

/** Rating for a "Yes" or "No" answer, per IRA question. "Unknown" is always UNKNOWN_RATING. */
export const ANSWER_RATINGS: Record<string, Record<Exclude<Answer, "Unknown">, Level>> = {
  "IRA-01": { Yes: "High", No: "Low" },
  "IRA-02": { Yes: "High", No: "Low" },
  "IRA-03": { Yes: "High", No: "Low" },
  "IRA-04": { Yes: "Medium", No: "Low" },
  "IRA-05": { Yes: "High", No: "Low" },
  "IRA-06": { Yes: "High", No: "Low" },
  "IRA-07": { Yes: "High", No: "Low" },
  "IRA-08": { Yes: "High", No: "Low" },
  "IRA-09": { Yes: "Low", No: "Medium" }, // alternate vendor available: "No" is the riskier answer
  "IRA-10": { Yes: "High", No: "Low" },
  "IRA-11": { Yes: "Medium", No: "Low" },
  "IRA-12": { Yes: "Medium", No: "Low" },
  "IRA-13": { Yes: "High", No: "Low" },
  "IRA-14": { Yes: "Medium", No: "Low" },
  "IRA-15": { Yes: "High", No: "Low" },
  "IRA-16": { Yes: "High", No: "Low" }, // added after v1
};
export const UNKNOWN_RATING: Level = "Medium";

export const INHERENT_RISK = {
  /** Any of these answered "Yes" makes inherent risk High (customer PII, regulated info). */
  highIfYes: ["IRA-02", "IRA-03"],
  /** This many High-rated answers (or more) makes inherent risk High. */
  highCountForHigh: 4,
  /** Low needs no Highs and at most this many Mediums. */
  maxMediumsForLow: 2,
} as const;

export interface TierRule {
  tier: 1 | 2 | 3;
  label: string;
  depth: string;
  cadence: string;
  /** null = review at contract renewal (no fixed date). */
  reviewEveryMonths: number | null;
}

export const TIERS: Record<Level, TierRule> = {
  High: { tier: 1, label: "Tier 1", depth: "Full SIG questionnaire + evidence", cadence: "Annual review", reviewEveryMonths: 12 },
  Medium: { tier: 2, label: "Tier 2", depth: "SIG Lite questionnaire", cadence: "Review every 2 years", reviewEveryMonths: 24 },
  Low: { tier: 3, label: "Tier 3", depth: "Basic check", cadence: "Review at contract renewal", reviewEveryMonths: null },
};

export const CONTROL_STRENGTH = {
  /** Strong: no Gaps and Needs evidence share of confirmed rows at or below this. */
  strongMaxNeedsEvidenceShare: 0.1,
  /** Adequate: at most this many Gaps. More is Weak. */
  adequateMaxGaps: 1,
} as const;

export const FIPPA = {
  /** "Will data leave the country?" */
  leavesCanadaId: "IRA-13",
  /** Customer PII; employee or other personal information (added after v1). */
  personalInfoIds: ["IRA-02", "IRA-16"],
  /** Answers that count as "may": Yes or Unknown. */
  mayAnswers: ["Yes", "Unknown"] as readonly Answer[],
  message:
    "FIPPA: storage outside Canada - check whether a supplementary assessment is required (confirm with Privacy Office)",
  notLegalAdvice: "This flag is a prompt for the Privacy Office, not legal advice.",
} as const;

export const RULES: { id: string; name: string; status: RuleStatus; text: string }[] = [
  {
    id: "answer-ratings",
    name: "IRA answer ratings",
    status: "Confirmed",
    text: 'Each Yes/No answer has a fixed rating per question (see table). "Unknown" is always Medium and opens a follow-up.',
  },
  {
    id: "inherent",
    name: "Inherent risk",
    status: "Confirmed",
    text: `High if IRA-02 (customer PII) or IRA-03 (regulated info) is Yes, or ${INHERENT_RISK.highCountForHigh}+ answers are rated High. Low if no answers are High and ${INHERENT_RISK.maxMediumsForLow} or fewer are Medium. Otherwise Medium.`,
  },
  {
    id: "tier",
    name: "Tier and review cadence",
    status: "Draft",
    text: "High: Tier 1 (full SIG + evidence, annual review). Medium: Tier 2 (SIG Lite, review every 2 years). Low: Tier 3 (basic check, review at renewal).",
  },
  {
    id: "fippa",
    name: "BC privacy (FIPPA) flag",
    status: "Confirmed",
    text: "Triggered if data may leave Canada (IRA-13 Yes/Unknown) and personal information may be involved (IRA-02 or IRA-16 Yes/Unknown). Not legal advice.",
  },
  {
    id: "control-strength",
    name: "Control strength",
    status: "Draft",
    text: `From confirmed questionnaire rows only. Strong: no Gaps and at most ${CONTROL_STRENGTH.strongMaxNeedsEvidenceShare * 100}% Needs evidence. Adequate: at most ${CONTROL_STRENGTH.adequateMaxGaps} Gap. Weak: otherwise.`,
  },
  {
    id: "residual",
    name: "Residual risk",
    status: "Draft",
    text: 'Strong: one level below inherent (min Low). Adequate: same as inherent. Weak: one level above (max High). "Provisional" while any Needs evidence row is open.',
  },
  {
    id: "recommendation",
    name: "Recommendation",
    status: "Draft",
    text: "Escalate - do not approve yet if residual is High or control strength is Weak. Otherwise Approve with conditions if any finding is open, else Approve.",
  },
];
