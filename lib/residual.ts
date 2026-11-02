// Due diligence side: control strength, residual risk, recommendation. Pure functions.
import { CONTROL_STRENGTH } from "../config/rules.ts";
import { LEVELS, type ControlStrength, type DdqRating, type Decision, type Level } from "./types.ts";

export interface StrengthResult {
  /** null until at least one questionnaire row is confirmed. */
  strength: ControlStrength | null;
  confirmed: number;
  gaps: number;
  needsEvidence: number;
  reason: string;
}

/** Pass only CONFIRMED row ratings. Unconfirmed rows never count. */
export function controlStrength(confirmedRatings: readonly DdqRating[]): StrengthResult {
  const confirmed = confirmedRatings.length;
  const gaps = confirmedRatings.filter((r) => r === "Gap").length;
  const needsEvidence = confirmedRatings.filter((r) => r === "Needs evidence").length;
  const result = (strength: ControlStrength | null, reason: string): StrengthResult => ({
    strength,
    confirmed,
    gaps,
    needsEvidence,
    reason,
  });

  if (confirmed === 0) return result(null, "Not assessed: no questionnaire rows are confirmed yet.");
  const share = needsEvidence / confirmed;
  const pct = `${needsEvidence} of ${confirmed} Needs evidence (${Math.round(share * 100)}%)`;
  const maxPct = `${CONTROL_STRENGTH.strongMaxNeedsEvidenceShare * 100}%`;
  if (gaps === 0 && share <= CONTROL_STRENGTH.strongMaxNeedsEvidenceShare) {
    return result("Strong", `Strong: no Gaps and ${pct}, within ${maxPct}.`);
  }
  if (gaps <= CONTROL_STRENGTH.adequateMaxGaps) {
    return result(
      "Adequate",
      gaps === 0
        ? `Adequate: no Gaps, but ${pct} is above ${maxPct}.`
        : `Adequate: ${gaps} Gap (max ${CONTROL_STRENGTH.adequateMaxGaps}).`,
    );
  }
  return result("Weak", `Weak: ${gaps} Gaps (more than ${CONTROL_STRENGTH.adequateMaxGaps}).`);
}

export interface ResidualResult {
  level: Level;
  provisional: boolean;
  reason: string;
}

export function residualRisk(inherent: Level, strength: ControlStrength, openNeedsEvidence: number): ResidualResult {
  const i = LEVELS.indexOf(inherent);
  const shift = strength === "Strong" ? -1 : strength === "Weak" ? 1 : 0;
  const level = LEVELS[Math.min(Math.max(i + shift, 0), LEVELS.length - 1)] as Level;
  const how =
    shift === 0 ? "same as inherent" : shift < 0 ? "one level below inherent" : "one level above inherent";
  const clamped = level === inherent && shift !== 0 ? ` (already ${inherent}, so it stays ${level})` : "";
  const provisional = openNeedsEvidence > 0;
  return {
    level,
    provisional,
    reason:
      `${strength} controls: ${how}${clamped}.` +
      (provisional ? ` Provisional: ${openNeedsEvidence} Needs evidence item${openNeedsEvidence === 1 ? "" : "s"} still open.` : ""),
  };
}

export interface RecommendationResult {
  decision: Decision;
  reason: string;
}

export function recommendation(residual: Level, strength: ControlStrength, openFindings: number): RecommendationResult {
  if (residual === "High" || strength === "Weak") {
    const why = [residual === "High" && "residual risk is High", strength === "Weak" && "control strength is Weak"].filter(Boolean);
    return { decision: "Escalate - do not approve yet", reason: `Escalate because ${why.join(" and ")}.` };
  }
  if (openFindings > 0) {
    return {
      decision: "Approve with conditions",
      reason: `${openFindings} open finding${openFindings === 1 ? "" : "s"} and residual risk is ${residual} (not High).`,
    };
  }
  return { decision: "Approve", reason: `No open findings and residual risk is ${residual}.` };
}
