// End-to-end: the v1 sample through the real workflow functions, then the computed outcome.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLimiter } from "../lib/ai/limits.ts";
import { runReview } from "../lib/ai/review.ts";
import { applyAiReview, confirmRow, editDecision, resolveFollowUp } from "../lib/ddq.ts";
import { closeFinding, closeNeedsEvidence, reopenFinding, setDueDate, setOwner } from "../lib/findings.ts";
import { RECOMMENDATION_MEANING } from "../config/rules.ts";
import { computeOutcome } from "../lib/outcome.ts";
import { SAMPLES } from "../lib/sample.ts";
import { DEFAULT_OWNER, createFromSample, parseState, setIraAnswer, type AssessmentState } from "../lib/session.ts";

const AT = "2026-11-02T18:00:00.000Z";
const sample = SAMPLES["v1-deloitte"]!;

async function reviewedAndConfirmed(): Promise<AssessmentState> {
  const r = await runReview(
    { sampleId: "v1-deloitte", ira: sample.iraAnswers, demo: true },
    {
      apiKeyPresent: false,
      limiter: createLimiter({ perIpCalls: 1, perIpWindowMs: 1, dailyCalls: 1 }),
      ip: "x",
      now: () => new Date(AT),
      callModel: async () => {
        throw new Error("not called");
      },
      log: () => {},
    },
  );
  assert.ok(r.ok);
  let s = applyAiReview(createFromSample(sample, "2026-11-02"), r, AT);
  for (const row of s.ddq) s = confirmRow(s, row.id, null, AT);
  return s;
}
const finding = (s: AssessmentState, id: string) => computeOutcome(s).findings.find((f) => f.id === id)!;

test("no residual risk or recommendation until every row is confirmed", async () => {
  const s = createFromSample(sample, "2026-11-02");
  const o = computeOutcome(s);
  assert.equal(o.residual, null);
  assert.equal(o.recommendation, null);
  assert.equal(o.blockers.length, 2);
  assert.match(o.recommendationLine, /not available/);
  // Follow-ups are findings from the start.
  assert.deepEqual(o.findings.map((f) => f.id), ["F-IRA-12", "F-IRA-13"]);
});

test("v1 back-test end to end: Medium, Adequate, residual Medium (provisional), Approve with conditions", async () => {
  const o = computeOutcome(await reviewedAndConfirmed());
  assert.deepEqual(o.blockers, []);
  assert.equal(o.inherent.level, "Medium");
  assert.equal(o.strength.strength, "Adequate");
  assert.deepEqual([o.residual!.level, o.residual!.provisional], ["Medium", true]);
  assert.equal(o.recommendation!.decision, "Approve with conditions");
  assert.deepEqual(
    o.findings.map((f) => [f.id, f.kind]),
    [
      ["F-IRA-12", "Follow-up"],
      ["F-IRA-13", "Follow-up"],
      ["F-DDQ-03-NE", "Needs evidence"],
      ["F-DDQ-11-GAP", "Gap"],
      ["F-DDQ-18-NE", "Needs evidence"],
      ["F-DDQ-23-NE", "Needs evidence"],
    ],
  );
  assert.equal(o.openFindings, 6);
  assert.equal(o.nextReview, "2028-11-02");
  assert.ok(o.findings.every((f) => f.owner === DEFAULT_OWNER && f.dueDate === null && f.status === "Open"));
  assert.equal(
    o.recommendationLine,
    "Recommendation: Approve with conditions. Inherent risk Medium (Tier 2), control strength Adequate, residual risk Medium (provisional), 6 open findings.",
  );
});

test("resolving IRA-13 to Yes from DDQ-11: High inherent + Adequate controls = High residual = Escalate", async () => {
  const s = resolveFollowUp(await reviewedAndConfirmed(), "IRA-13", "Yes", "DDQ-11", "Residency not guaranteed", AT);
  const o = computeOutcome(s);
  assert.equal(o.inherent.level, "High");
  assert.equal(o.residual!.level, "High");
  assert.equal(o.recommendation!.decision, "Escalate - do not approve yet");
  assert.match(RECOMMENDATION_MEANING[o.recommendation!.decision]!, /risk owner .* accept .* does not mean the vendor is rejected/i);
  assert.equal(o.nextReview, "2027-11-02");
  const f13 = o.findings.find((f) => f.id === "F-IRA-13")!;
  assert.deepEqual([f13.status, f13.archived, f13.closeNote], ["Closed", true, "Answered Yes: Resolved from DDQ-11: Residency not guaranteed"]);
});

test("closing every finding leads to Approve; reopening the Gap goes back to conditions", async () => {
  let s = await reviewedAndConfirmed();
  s = resolveFollowUp(s, "IRA-12", "No", "DDQ-23", "No subcontractors per engagement letter", AT);
  s = resolveFollowUp(s, "IRA-13", "No", "DDQ-11", "Contract clause: PUC data stays in Canada", AT);
  for (const id of ["F-DDQ-03-NE", "F-DDQ-18-NE", "F-DDQ-23-NE"]) {
    s = closeNeedsEvidence(s, finding(s, id), "Satisfactory", "Document received and reviewed", AT);
  }
  s = closeFinding(s, finding(s, "F-DDQ-11-GAP"), "Residency clause signed", AT);
  let o = computeOutcome(s);
  assert.equal(o.openFindings, 0);
  assert.equal(o.residual!.provisional, false);
  assert.equal(o.recommendation!.decision, "Approve");
  // Every closed finding stays listed for traceability.
  assert.equal(o.findings.length, 6);
  assert.ok(o.findings.every((f) => f.status === "Closed"));
  s = reopenFinding(s, finding(s, "F-DDQ-11-GAP"), AT);
  o = computeOutcome(s);
  assert.equal(o.recommendation!.decision, "Approve with conditions");
});

test("closing Needs evidence re-rates the row with the evidence note as the reason; control strength recalculates", async () => {
  let s = await reviewedAndConfirmed();
  assert.equal(computeOutcome(s).strength.strength, "Adequate"); // 1 Gap, 3 Needs evidence
  assert.throws(() => closeFinding(s, finding(s, "F-DDQ-03-NE"), "received", AT), /re-rating/);
  assert.throws(() => closeNeedsEvidence(s, finding(s, "F-DDQ-03-NE"), "Satisfactory", " ", AT), /note is required/);

  s = closeNeedsEvidence(s, finding(s, "F-DDQ-03-NE"), "Satisfactory", "ISO certificate received, scope covers consulting", AT);
  const row = s.ddq.find((r) => r.id === "DDQ-03")!;
  assert.deepEqual([row.decision!.rating, row.confirmed, row.ai!.rating], ["Satisfactory", true, "Needs evidence"]);
  assert.equal(row.overrideReason, "Evidence: ISO certificate received, scope covers consulting");
  assert.match(row.history.at(-1)!.detail, /^Satisfactory \(AI: Needs evidence\)\. Reason: Evidence: ISO certificate/);
  let o = computeOutcome(s);
  assert.deepEqual([o.strength.gaps, o.strength.needsEvidence], [1, 2]);
  const closed = finding(s, "F-DDQ-03-NE");
  assert.deepEqual([closed.status, closed.archived], ["Closed", true]);
  assert.throws(() => reopenFinding(s, closed, AT), /Only a closed Gap or FIPPA/);

  // Evidence that shows a gap: the row becomes Gap, a new Gap finding opens, and control strength drops to Weak.
  s = closeNeedsEvidence(s, finding(s, "F-DDQ-18-NE"), "Gap", "SOC 2 summary shows a qualified opinion", AT);
  o = computeOutcome(s);
  assert.deepEqual([o.strength.gaps, o.strength.needsEvidence, o.strength.strength], [2, 1, "Weak"]);
  assert.equal(finding(s, "F-DDQ-18-GAP").status, "Open");
  assert.equal(finding(s, "F-DDQ-18-NE").status, "Closed");
  assert.equal(o.recommendation!.decision, "Escalate - do not approve yet");
});

test("a Needs evidence finding is open again if its row is re-rated Needs evidence on screen 2", async () => {
  const base = await reviewedAndConfirmed();
  let s = closeNeedsEvidence(base, finding(base, "F-DDQ-03-NE"), "Satisfactory", "received", AT);
  assert.equal(finding(s, "F-DDQ-03-NE").status, "Closed");
  s = confirmRow(editDecision(s, "DDQ-03", { rating: "Needs evidence" }, AT), "DDQ-03", null, AT);
  assert.equal(finding(s, "F-DDQ-03-NE").status, "Open");
});

test("a triggered FIPPA flag adds an open finding that blocks Approve", async () => {
  let s = await reviewedAndConfirmed();
  s = setIraAnswer(s, "IRA-16", "Yes", "Interviews include PUC staff", AT);
  const o = computeOutcome(s);
  assert.equal(o.fippa.triggered, true);
  assert.ok(o.findings.some((f) => f.id === "F-FIPPA" && f.status === "Open"));
  assert.notEqual(o.recommendation!.decision, "Approve");
});

test("owner and due date are recorded with history and survive storage", async () => {
  let s = await reviewedAndConfirmed();
  s = setOwner(s, "F-DDQ-11-GAP", "  Jane Analyst ", AT);
  s = setDueDate(s, "F-DDQ-11-GAP", "2026-12-15", AT);
  assert.throws(() => setDueDate(s, "F-DDQ-11-GAP", "2026-02-30", AT));
  assert.throws(() => setOwner(s, "F-XYZ", "x", AT));
  const f = finding(s, "F-DDQ-11-GAP");
  assert.deepEqual([f.owner, f.dueDate], ["Jane Analyst", "2026-12-15"]);
  assert.deepEqual(f.history.map((h) => h.detail), [`Owner: ${DEFAULT_OWNER} → Jane Analyst`, "Due date: none → 2026-12-15"]);
  assert.deepEqual(parseState(JSON.stringify(s)), s);
  // A closed finding without a note is rejected on load.
  const bad = structuredClone(s);
  bad.findings[0]!.status = "Closed";
  assert.equal(parseState(JSON.stringify(bad)), null);
});

test("editing a confirmed row back to Satisfactory removes its finding", async () => {
  let s = await reviewedAndConfirmed();
  s = editDecision(s, "DDQ-03", { rating: "Satisfactory" }, AT);
  assert.equal(computeOutcome(s).residual, null, "row reopened, so residual waits again");
  s = confirmRow(s, "DDQ-03", "Certificate received and checked", AT);
  assert.equal(computeOutcome(s).findings.some((f) => f.id === "F-DDQ-03-NE"), false);
});
