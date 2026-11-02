// Inherent risk side: answer ratings, follow-ups, inherent risk, tier, FIPPA flag. Pure functions.
import { ANSWER_RATINGS, FIPPA, INHERENT_RISK, TIERS, UNKNOWN_RATING, type TierRule } from "../config/rules.ts";
import type { IraAnswer, Level, RatedIraAnswer } from "./types.ts";

export function rateAnswer({ id, answer }: IraAnswer): Level {
  const table = ANSWER_RATINGS[id];
  if (!table) throw new Error(`No rating rule for ${id}`);
  return answer === "Unknown" ? UNKNOWN_RATING : table[answer];
}

export function rateIra(answers: readonly IraAnswer[]): RatedIraAnswer[] {
  return answers.map((a) => ({ ...a, rating: rateAnswer(a) }));
}

/** Every "Unknown" answer is an open follow-up. */
export function followUps(answers: readonly IraAnswer[]): string[] {
  return answers.filter((a) => a.answer === "Unknown").map((a) => a.id);
}

export interface InherentResult {
  level: Level;
  highs: string[];
  mediums: string[];
  /** Plain-language statement of the rule clause that decided the level. */
  reason: string;
}

export function inherentRisk(answers: readonly IraAnswer[]): InherentResult {
  const rated = rateIra(answers);
  const highs = rated.filter((a) => a.rating === "High").map((a) => a.id);
  const mediums = rated.filter((a) => a.rating === "Medium").map((a) => a.id);
  const yesTriggers = answers
    .filter((a) => (INHERENT_RISK.highIfYes as readonly string[]).includes(a.id) && a.answer === "Yes")
    .map((a) => a.id);
  const result = (level: Level, reason: string): InherentResult => ({ level, highs, mediums, reason });

  if (yesTriggers.length > 0) {
    return result("High", `High because ${yesTriggers.join(" and ")} = Yes (customer PII or regulated information).`);
  }
  if (highs.length >= INHERENT_RISK.highCountForHigh) {
    return result("High", `High because ${highs.length} answers are rated High (threshold ${INHERENT_RISK.highCountForHigh}).`);
  }
  if (highs.length === 0 && mediums.length <= INHERENT_RISK.maxMediumsForLow) {
    return result("Low", `Low because no answers are rated High and ${mediums.length} are Medium (max ${INHERENT_RISK.maxMediumsForLow}).`);
  }
  return result(
    "Medium",
    highs.length > 0
      ? `Medium because ${highs.length} answer${highs.length === 1 ? " is" : "s are"} rated High (below ${INHERENT_RISK.highCountForHigh}) and neither IRA-02 nor IRA-03 is Yes.`
      : `Medium because no answers are rated High but ${mediums.length} are Medium (more than ${INHERENT_RISK.maxMediumsForLow}).`,
  );
}

export function tierFor(level: Level): TierRule {
  return TIERS[level];
}

export interface FippaResult {
  triggered: boolean;
  reason: string;
}

export function fippaFlag(answers: readonly IraAnswer[]): FippaResult {
  const answerOf = (id: string) => answers.find((a) => a.id === id)?.answer;
  const leaves = answerOf(FIPPA.leavesCanadaId);
  const mayLeave = leaves !== undefined && FIPPA.mayAnswers.includes(leaves);
  const personal = FIPPA.personalInfoIds.filter((id) => {
    const a = answerOf(id);
    return a !== undefined && FIPPA.mayAnswers.includes(a);
  });
  const triggered = mayLeave && personal.length > 0;
  const personalText =
    personal.length > 0
      ? `personal information may be involved (${personal.map((id) => `${id} = ${answerOf(id)}`).join(", ")})`
      : `no personal information indicated (${FIPPA.personalInfoIds.map((id) => `${id} = ${answerOf(id) ?? "missing"}`).join(", ")})`;
  const leavesText = mayLeave
    ? `data may leave Canada (${FIPPA.leavesCanadaId} = ${leaves})`
    : `data does not leave Canada (${FIPPA.leavesCanadaId} = ${leaves ?? "missing"})`;
  return {
    triggered,
    reason: triggered
      ? `Triggered: ${leavesText} and ${personalText}.`
      : `Checked, not triggered: ${mayLeave ? `${leavesText}, but ${personalText}` : leavesText}.`,
  };
}

export interface InherentAssessment {
  rated: RatedIraAnswer[];
  inherent: InherentResult;
  tier: TierRule;
  followUps: string[];
  fippa: FippaResult;
}

/** Everything screen 1 shows, from the IRA answers alone. */
export function assessInherent(answers: readonly IraAnswer[]): InherentAssessment {
  const inherent = inherentRisk(answers);
  return {
    rated: rateIra(answers),
    inherent,
    tier: tierFor(inherent.level),
    followUps: followUps(answers),
    fippa: fippaFlag(answers),
  };
}
