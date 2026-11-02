import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWER_RATINGS, FIPPA } from "../config/rules.ts";
import { collectFindings } from "../lib/findings.ts";
import { fippaFlag } from "../lib/ira.ts";
import { controlStrength, recommendation, residualRisk } from "../lib/residual.ts";
import type { Answer, DdqRating } from "../lib/types.ts";

const answers = (overrides: Record<string, Answer>) =>
  Object.keys(ANSWER_RATINGS).map((id) => ({ id, answer: overrides[id] ?? (id === "IRA-09" ? "Yes" : "No") }));
const allSatisfactory = Array.from({ length: 26 }, (_, i) => ({
  id: `DDQ-${String(i + 1).padStart(2, "0")}`,
  question: `Question ${i + 1}`,
  rating: "Satisfactory" as DdqRating,
}));

test("a triggered FIPPA flag is an open finding, so the recommendation cannot be Approve", () => {
  // Data leaves Canada and customer PII is involved; everything else is clean.
  const fippa = fippaFlag(answers({ "IRA-13": "Yes", "IRA-02": "Yes" }));
  assert.equal(fippa.triggered, true);
  const findings = collectFindings({ followUps: [], confirmedDdq: allSatisfactory, fippa });
  assert.deepEqual(findings, [
    { id: "F-FIPPA", source: "FIPPA", sourceRow: "IRA-13", title: FIPPA.findingTitle },
  ]);
  assert.equal(FIPPA.findingTitle, "Confirm with Privacy Office whether a supplementary assessment is required");

  const strength = controlStrength(allSatisfactory.map((r) => r.rating));
  assert.equal(strength.strength, "Strong");
  // Lowest residual possible, to show the FIPPA finding alone blocks "Approve".
  const residual = residualRisk("Low", "Strong", 0);
  assert.equal(recommendation(residual.level, "Strong", findings.length).decision, "Approve with conditions");
  assert.equal(recommendation(residual.level, "Strong", 0).decision, "Approve");
});

test("no FIPPA finding when the flag is checked but not triggered", () => {
  const fippa = fippaFlag(answers({ "IRA-13": "Unknown" }));
  assert.equal(fippa.triggered, false);
  assert.deepEqual(collectFindings({ followUps: [], confirmedDdq: allSatisfactory, fippa }), []);
});

test("follow-ups and non-satisfactory confirmed rows become findings with stable IDs", () => {
  const fippa = fippaFlag(answers({}));
  const confirmedDdq = [
    { id: "DDQ-03", question: "Q3", rating: "Needs evidence" as const },
    { id: "DDQ-04", question: "Q4", rating: "Satisfactory" as const },
    { id: "DDQ-11", question: "Q11", rating: "Gap" as const },
  ];
  const findings = collectFindings({ followUps: [{ id: "IRA-12", question: "Will subcontractors be involved?" }], confirmedDdq, fippa });
  assert.deepEqual(
    findings.map((f) => [f.id, f.source, f.title]),
    [
      ["F-IRA-12", "IRA follow-up", "Resolve unknown answer: Will subcontractors be involved?"],
      ["F-DDQ-03", "Due diligence", "Needs evidence: Q3"],
      ["F-DDQ-11", "Due diligence", "Gap: Q11"],
    ],
  );
});
