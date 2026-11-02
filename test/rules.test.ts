import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWER_RATINGS, CONTROL_STRENGTH, INHERENT_RISK } from "../config/rules.ts";
import { fippaFlag, followUps, inherentRisk, rateAnswer, tierFor } from "../lib/ira.ts";
import { controlStrength, recommendation, residualRisk } from "../lib/residual.ts";
import { addMonths, isIsoDate, nextReviewDate } from "../lib/dates.ts";
import type { Answer, DdqRating, IraAnswer } from "../lib/types.ts";

const ids = Object.keys(ANSWER_RATINGS);
/** Lowest-risk baseline (every answer rates Low: "No", except IRA-09 "Yes"), with overrides. */
function answers(overrides: Record<string, Answer> = {}): IraAnswer[] {
  return ids.map((id) => ({ id, answer: overrides[id] ?? (id === "IRA-09" ? "Yes" : "No") }));
}
const rows = (n: Partial<Record<DdqRating, number>>): DdqRating[] =>
  (Object.entries(n) as [DdqRating, number][]).flatMap(([r, k]) => Array<DdqRating>(k).fill(r));

test("rating table covers IRA-01..IRA-16 exactly", () => {
  assert.deepEqual(ids, Array.from({ length: 16 }, (_, i) => `IRA-${String(i + 1).padStart(2, "0")}`));
});

test("answer ratings: Unknown is Medium everywhere; IRA-09 is inverted", () => {
  for (const id of ids) assert.equal(rateAnswer({ id, answer: "Unknown" }), "Medium", id);
  assert.equal(rateAnswer({ id: "IRA-09", answer: "No" }), "Medium");
  assert.equal(rateAnswer({ id: "IRA-09", answer: "Yes" }), "Low");
  assert.equal(rateAnswer({ id: "IRA-16", answer: "Yes" }), "High");
  assert.throws(() => rateAnswer({ id: "IRA-99", answer: "Yes" }));
});

test("follow-ups are exactly the Unknown answers", () => {
  assert.deepEqual(followUps(answers({ "IRA-04": "Unknown", "IRA-12": "Unknown" })), ["IRA-04", "IRA-12"]);
  assert.deepEqual(followUps(answers()), []);
});

test("inherent: IRA-02 or IRA-03 = Yes is High on its own", () => {
  assert.equal(inherentRisk(answers({ "IRA-02": "Yes" })).level, "High");
  assert.equal(inherentRisk(answers({ "IRA-03": "Yes" })).level, "High");
  // Unknown is not Yes: it rates Medium and does not trigger the clause.
  assert.equal(inherentRisk(answers({ "IRA-02": "Unknown" })).level, "Low");
});

test("inherent: 4+ Highs is High, 3 is not", () => {
  const three = answers({ "IRA-01": "Yes", "IRA-07": "Yes", "IRA-15": "Yes" });
  assert.equal(inherentRisk(three).level, "Medium");
  const four = answers({ "IRA-01": "Yes", "IRA-07": "Yes", "IRA-15": "Yes", "IRA-13": "Yes" });
  assert.equal(INHERENT_RISK.highCountForHigh, 4);
  assert.equal(inherentRisk(four).level, "High");
});

test("inherent: Low needs no Highs and at most 2 Mediums", () => {
  assert.deepEqual([inherentRisk(answers()).level, inherentRisk(answers()).mediums], ["Low", []]);
  assert.equal(inherentRisk(answers({ "IRA-04": "Yes", "IRA-11": "Yes" })).level, "Low");
  const r = inherentRisk(answers({ "IRA-04": "Yes", "IRA-11": "Yes", "IRA-12": "Unknown" }));
  assert.equal(r.level, "Medium");
  assert.match(r.reason, /3 are Medium/);
  assert.equal(inherentRisk(answers({ "IRA-01": "Yes" })).level, "Medium");
});

test("tiers", () => {
  assert.equal(tierFor("High").label, "Tier 1");
  assert.equal(tierFor("Medium").reviewEveryMonths, 24);
  assert.equal(tierFor("Low").reviewEveryMonths, null);
});

test("FIPPA needs data leaving Canada AND personal information (Yes/Unknown)", () => {
  assert.equal(fippaFlag(answers({ "IRA-13": "Unknown" })).triggered, false);
  assert.equal(fippaFlag(answers({ "IRA-13": "Unknown", "IRA-02": "Yes" })).triggered, true);
  assert.equal(fippaFlag(answers({ "IRA-13": "Yes", "IRA-16": "Unknown" })).triggered, true);
  assert.equal(fippaFlag(answers({ "IRA-13": "No", "IRA-02": "Yes", "IRA-16": "Yes" })).triggered, false);
  assert.match(fippaFlag(answers()).reason, /^Checked, not triggered/);
});

test("control strength: Strong / Adequate / Weak boundaries", () => {
  assert.equal(CONTROL_STRENGTH.strongMaxNeedsEvidenceShare, 0.1);
  assert.equal(controlStrength([]).strength, null);
  assert.equal(controlStrength(rows({ Satisfactory: 26 })).strength, "Strong");
  assert.equal(controlStrength(rows({ Satisfactory: 24, "Needs evidence": 2 })).strength, "Strong"); // 7.7%
  assert.equal(controlStrength(rows({ Satisfactory: 9, "Needs evidence": 1 })).strength, "Strong"); // exactly 10%
  assert.equal(controlStrength(rows({ Satisfactory: 23, "Needs evidence": 3 })).strength, "Adequate"); // 11.5%
  assert.equal(controlStrength(rows({ Satisfactory: 25, Gap: 1 })).strength, "Adequate");
  assert.equal(controlStrength(rows({ Satisfactory: 24, Gap: 2 })).strength, "Weak");
});

test("residual risk shifts by strength and clamps at Low/High", () => {
  assert.equal(residualRisk("Medium", "Strong", 0).level, "Low");
  assert.equal(residualRisk("Low", "Strong", 0).level, "Low");
  assert.equal(residualRisk("Medium", "Adequate", 0).level, "Medium");
  assert.equal(residualRisk("Medium", "Weak", 0).level, "High");
  assert.equal(residualRisk("High", "Weak", 0).level, "High");
  assert.equal(residualRisk("Medium", "Adequate", 0).provisional, false);
  assert.equal(residualRisk("Medium", "Adequate", 2).provisional, true);
});

test("recommendation", () => {
  assert.equal(recommendation("Low", "Strong", 0).decision, "Approve");
  assert.equal(recommendation("Medium", "Adequate", 3).decision, "Approve with conditions");
  assert.equal(recommendation("High", "Adequate", 0).decision, "Escalate - do not approve yet");
  // Weak escalates even when residual is not High (e.g. Low inherent + Weak = Medium residual).
  assert.equal(recommendation("Medium", "Weak", 0).decision, "Escalate - do not approve yet");
});

test("dates: month arithmetic clamps, review date follows the tier", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-02-29", 12), "2029-02-28");
  assert.equal(addMonths("2026-11-02", 24), "2028-11-02");
  assert.equal(nextReviewDate("2026-11-02", "High"), "2027-11-02");
  assert.equal(nextReviewDate("2026-11-02", "Low"), null);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.throws(() => addMonths("02/11/2026", 1));
});
