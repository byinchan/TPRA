// Records a real model run over the sample and saves it as the demo-mode output.
// Needs a key in .env.local (git-ignored):  node --env-file=.env.local scripts/record-demo.ts
// The output is validated like a live response; nothing is written if validation fails.
import { writeFileSync } from "node:fs";
import { AI_CONFIG } from "../config/ai.ts";
import { ANSWER_RATINGS } from "../config/rules.ts";
import { apiKeyPresent, callClaude } from "../lib/ai/anthropic.ts";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserMessage } from "../lib/ai/prompt.ts";
import { REVIEW_SCHEMA, validateReview } from "../lib/ai/schema.ts";
import { IRA_QUESTIONS, SAMPLES } from "../lib/sample.ts";

const sampleId = process.argv[2] ?? "v1-halden";
const sample = SAMPLES[sampleId];
if (!sample) throw new Error(`Unknown sample ${sampleId}`);
if (!apiKeyPresent()) throw new Error("ANTHROPIC_API_KEY is not set (use --env-file=.env.local).");

const answers = sample.iraAnswers.map(({ id, answer }) => ({ id, answer }));
const res = await callClaude(REVIEW_SYSTEM_PROMPT, buildReviewUserMessage(sample, IRA_QUESTIONS, answers), REVIEW_SCHEMA);
const checked =
  res.stopReason === "end_turn"
    ? validateReview(res.json, { iraIds: Object.keys(ANSWER_RATINGS), ddqIds: sample.ddq.map((r) => r.id) })
    : null;
if (!checked) throw new Error(`Model output failed validation (stop_reason ${res.stopReason}, request ${res.requestId}).`);

const file = new URL(`../data/demo/${sampleId}-review.json`, import.meta.url);
const generatedAt = new Date().toISOString();
writeFileSync(
  file,
  JSON.stringify(
    {
      sampleId,
      source: {
        kind: "model",
        model: res.model,
        generatedAt,
        note: `Recorded run of ${res.model} (effort ${AI_CONFIG.effort}) on the sample as loaded, ${generatedAt.slice(0, 10)}. Saved for demo mode; reviewed by the developer before commit.`,
      },
      answersUsed: answers,
      output: res.json,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Saved ${file.pathname}. Request ${res.requestId}. Guardrails:`, checked.guardrails);
