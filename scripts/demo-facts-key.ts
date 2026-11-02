// Prints the facts key of the standard demo path (sample loaded, demo review, all 26 rows confirmed as
// suggested). The saved demo narrative stores it so the app can say whether the narrative fits the data.
import { createLimiter } from "../lib/ai/limits.ts";
import { runReview } from "../lib/ai/review.ts";
import { applyAiReview, confirmRow } from "../lib/ddq.ts";
import { computeOutcome } from "../lib/outcome.ts";
import { buildFacts, factsFingerprint } from "../lib/report/facts.ts";
import { SAMPLES } from "../lib/sample.ts";
import { createFromSample, type AssessmentState } from "../lib/session.ts";

export async function standardDemoState(sampleId = "v1-halden"): Promise<AssessmentState> {
  const sample = SAMPLES[sampleId]!;
  const at = "2026-11-02T00:00:00.000Z";
  const r = await runReview(
    { sampleId, ira: sample.iraAnswers, demo: true },
    { apiKeyPresent: false, limiter: createLimiter({ perIpCalls: 0, perIpWindowMs: 1, dailyCalls: 0 }), ip: "-", now: () => new Date(at), callModel: async () => { throw new Error("unused"); }, log: () => {} },
  );
  if (!r.ok) throw new Error("demo review failed");
  let s = applyAiReview(createFromSample(sample, "2026-11-02"), r, at);
  for (const row of s.ddq) s = confirmRow(s, row.id, null, at);
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await standardDemoState(process.argv[2]);
  console.log(factsFingerprint(buildFacts(s, computeOutcome(s))));
}
