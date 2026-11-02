import { test } from "node:test";
import assert from "node:assert/strict";
import { createLimiter } from "../lib/ai/limits.ts";
import { runReview } from "../lib/ai/review.ts";
import type { ReviewSuccess } from "../lib/ai/types.ts";
import {
  applyAiReview,
  confirmRow,
  confirmedRatings,
  discardAiReview,
  editDecision,
  effectiveDecision,
  reopenRow,
  resolveFollowUp,
  rowBadges,
} from "../lib/ddq.ts";
import { assessInherent } from "../lib/ira.ts";
import { controlStrength } from "../lib/residual.ts";
import { SAMPLES } from "../lib/sample.ts";
import { createFromSample, parseState } from "../lib/session.ts";

const AT = "2026-11-02T18:00:00.000Z";
const sample = SAMPLES["v1-deloitte"]!;

async function demo(): Promise<ReviewSuccess> {
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
  return r;
}

const reviewed = async () => applyAiReview(createFromSample(sample, "2026-11-02"), await demo(), AT);
const row = (s: Awaited<ReturnType<typeof reviewed>>, id: string) => s.ddq.find((r) => r.id === id)!;

test("applying the AI review stores each suggestion unchanged; nothing is confirmed yet", async () => {
  const s = await reviewed();
  assert.equal(s.review?.mode, "demo");
  assert.equal(s.review?.iraInconsistencies.length, 2);
  assert.ok(s.ddq.every((r) => r.ai && !r.confirmed && r.decision === null));
  assert.deepEqual(rowBadges(row(s, "DDQ-11")), { provenance: "AI-suggested", status: "Awaiting review" });
  assert.deepEqual(confirmedRatings(s), []);
  assert.equal(controlStrength(confirmedRatings(s)).strength, null);
  assert.throws(() => applyAiReview(s, s as never, AT), /already loaded/);
});

test("confirming the AI rating needs no reason; changing it does", async () => {
  let s = await reviewed();
  s = confirmRow(s, "DDQ-11", null, AT);
  assert.deepEqual(rowBadges(row(s, "DDQ-11")), { provenance: "AI-suggested", status: "Confirmed" });
  assert.deepEqual(confirmedRatings(s), ["Gap"]);

  s = editDecision(s, "DDQ-23", { rating: "Satisfactory" }, AT);
  assert.equal(rowBadges(row(s, "DDQ-23")).provenance, "Human-edited");
  assert.throws(() => confirmRow(s, "DDQ-23", null, AT), /reason is required/);
  assert.throws(() => confirmRow(s, "DDQ-23", "   ", AT), /reason is required/);
  s = confirmRow(s, "DDQ-23", "Engagement letter excludes subcontractors", AT);
  const r = row(s, "DDQ-23");
  assert.equal(r.overrideReason, "Engagement letter excludes subcontractors");
  assert.equal(r.ai!.rating, "Needs evidence", "the AI's original suggestion is kept");
  assert.deepEqual(
    r.history.map((h) => h.action),
    ["ai-suggested", "edited", "confirmed"],
  );
  assert.match(r.history[2]!.detail, /Satisfactory \(AI: Needs evidence\)\. Reason: Engagement letter/);
});

test("editing a confirmed row reopens it, and it stops counting", async () => {
  let s = confirmRow(await reviewed(), "DDQ-03", null, AT);
  assert.equal(confirmedRatings(s).length, 1);
  s = editDecision(s, "DDQ-03", { note: "Certificate requested on 2 Nov" }, AT);
  assert.equal(row(s, "DDQ-03").confirmed, false);
  assert.equal(confirmedRatings(s).length, 0);
  assert.deepEqual(row(s, "DDQ-03").history.slice(-2).map((h) => h.action), ["reopened", "edited"]);
  s = reopenRow(confirmRow(s, "DDQ-03", null, AT), "DDQ-03", AT);
  assert.equal(row(s, "DDQ-03").confirmed, false);
});

test("confirming all 26 AI suggestions as-is gives the back-test result: Adequate", async () => {
  let s = await reviewed();
  for (const r of s.ddq) s = confirmRow(s, r.id, null, AT);
  const st = controlStrength(confirmedRatings(s));
  assert.deepEqual([st.strength, st.gaps, st.needsEvidence, st.confirmed], ["Adequate", 1, 3, 26]);
});

test("a row with no AI suggestion needs the analyst to choose a rating", async () => {
  const s = createFromSample(sample, "2026-11-02");
  assert.equal(effectiveDecision(row(s as never, "DDQ-01")), null);
  assert.throws(() => confirmRow(s, "DDQ-01", null, AT), /Choose a rating/);
  const e = editDecision(s, "DDQ-01", { rating: "Gap" }, AT);
  assert.equal(rowBadges(row(e as never, "DDQ-01")).provenance, "Analyst-entered");
  assert.deepEqual(confirmedRatings(confirmRow(e, "DDQ-01", null, AT)), ["Gap"]);
});

test("resolving a follow-up from a questionnaire row updates the IRA answer with a traceable reason", async () => {
  let s = await reviewed();
  assert.throws(() => resolveFollowUp(s, "IRA-12", "No", "DDQ-23", "  ", AT), /note is required/);
  assert.throws(() => resolveFollowUp(s, "IRA-01", "No", "DDQ-23", "x", AT), /not an open follow-up/);
  s = resolveFollowUp(s, "IRA-12", "No", "DDQ-23", "Vendor confirmed in writing", AT);
  const ira = s.ira.find((r) => r.id === "IRA-12")!;
  assert.equal(ira.answer, "No");
  assert.equal(ira.history[0]!.reason, "Resolved from DDQ-23: Vendor confirmed in writing");
  assert.deepEqual(assessInherent(s.ira).followUps, ["IRA-13"]);
  // Resolving IRA-13 to Yes from DDQ-11 moves inherent risk to High / Tier 1, as confirmed.
  s = resolveFollowUp(s, "IRA-13", "Yes", "DDQ-11", "Residency not guaranteed", AT);
  assert.equal(assessInherent(s.ira).tier.label, "Tier 1");
});

test("the full review state round-trips through validated storage", async () => {
  let s = await reviewed();
  s = confirmRow(editDecision(s, "DDQ-23", { rating: "Satisfactory" }, AT), "DDQ-23", "Reason", AT);
  assert.deepEqual(parseState(JSON.stringify(s)), s);
  // Tampered AI data in storage is rejected, not trusted.
  const bad = structuredClone(s);
  bad.ddq[0]!.ai!.conflict = { iraIds: ["IRA-99"], note: "x" };
  assert.equal(parseState(JSON.stringify(bad)), null);
  const bad2 = structuredClone(s);
  (bad2.ddq[1] as { confirmed: unknown }).confirmed = "yes";
  assert.equal(parseState(JSON.stringify(bad2)), null);
});

test("discarding the AI review clears suggestions and decisions but not IRA answers", async () => {
  let s = resolveFollowUp(await reviewed(), "IRA-12", "No", "DDQ-23", "n", AT);
  s = discardAiReview(confirmRow(s, "DDQ-01", null, AT));
  assert.equal(s.review, null);
  assert.ok(s.ddq.every((r) => !r.ai && !r.decision && !r.confirmed && r.history.length === 0));
  assert.equal(s.ira.find((r) => r.id === "IRA-12")!.answer, "No");
});
