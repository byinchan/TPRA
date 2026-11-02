// Back-test of the rules on the v1 Deloitte sample. Differences from v1 are for Bernadette to decide.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessInherent } from "../lib/ira.ts";
import { controlStrength, recommendation, residualRisk } from "../lib/residual.ts";
import { expectedDdqRatings, loadV1 } from "../scripts/backtest.ts";
import type { DdqRating } from "../lib/types.ts";

const v1 = loadV1();
const answers = v1.ira.map(({ id, answer }) => ({ id, answer }));
const a = assessInherent(answers);

test("answer table reproduces all 15 v1 per-question ratings", () => {
  for (const row of v1.ira.filter((r) => !r.addedAfterV1)) {
    assert.equal(a.rated.find((r) => r.id === row.id)?.rating, row.v1Rating, row.id);
  }
});

test("v1 sample: Medium, Tier 2, follow-ups IRA-12/13, FIPPA not triggered", () => {
  assert.equal(a.inherent.level, v1.v1Labels.overallInherentRisk);
  assert.equal(a.inherent.level, "Medium");
  assert.deepEqual(a.inherent.highs, ["IRA-01", "IRA-07", "IRA-15"]);
  assert.deepEqual(a.inherent.mediums, ["IRA-04", "IRA-12", "IRA-13", "IRA-14"]);
  assert.equal(a.tier.label, "Tier 2");
  assert.deepEqual(a.followUps, ["IRA-12", "IRA-13"]);
  assert.equal(a.fippa.triggered, false);
});

test("v1 sample, expected DDQ reading: Adequate, Medium (Provisional), Approve with conditions", () => {
  const ratings = Object.values(expectedDdqRatings(v1));
  const s = controlStrength(ratings);
  assert.deepEqual([s.strength, s.gaps, s.needsEvidence], ["Adequate", 1, 3]);
  const r = residualRisk(a.inherent.level, "Adequate", s.needsEvidence);
  assert.deepEqual([r.level, r.provisional], ["Medium", true]);
  // Open findings: 1 Gap + 3 Needs evidence + 2 IRA follow-ups.
  assert.equal(recommendation(r.level, "Adequate", 6).decision, "Approve with conditions");
});

test("sensitivity: resolving IRA-13 to Yes adds a 4th High and makes inherent High", () => {
  const resolved = answers.map((x) => (x.id === "IRA-13" ? { ...x, answer: "Yes" as const } : x));
  assert.equal(assessInherent(resolved).inherent.level, "High");
});

test("scenario table rows", () => {
  const strength = (n: Partial<Record<DdqRating, number>>) =>
    controlStrength(
      (Object.entries(n) as [DdqRating, number][]).flatMap(([k, c]) => Array<DdqRating>(c).fill(k)),
    ).strength;
  assert.equal(strength({ Satisfactory: 22, "Needs evidence": 4 }), "Adequate");
  assert.equal(strength({ Satisfactory: 24, "Needs evidence": 2 }), "Strong");
  assert.equal(strength({ Satisfactory: 24, Gap: 2 }), "Weak");
  assert.equal(residualRisk("Medium", "Strong", 2).level, "Low");
  assert.equal(residualRisk("Medium", "Weak", 0).level, "High");
});
