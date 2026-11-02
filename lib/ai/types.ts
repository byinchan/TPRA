// Shapes of an AI review result. No runtime dependencies, so the browser can import these.
import type { AiReview, Guardrails } from "./schema.ts";

export const DEMO_REASONS = ["requested", "no-key", "rate-limited", "daily-cap", "budget", "service-unavailable"] as const;

export type DemoReason = (typeof DEMO_REASONS)[number];

export interface ReviewSource {
  /** "model" = a real model run (live, or recorded for demo). "mock" = a placeholder written by the developer. */
  kind: "model" | "mock";
  model: string | null;
  generatedAt: string;
  note: string;
}

export interface ReviewSuccess {
  ok: true;
  mode: "live" | "demo";
  demoReason: DemoReason | null;
  /** Demo only: false when the analyst's IRA answers differ from the ones the saved output used. */
  demoMatchesAnswers: boolean | null;
  source: ReviewSource;
  review: AiReview;
  guardrails: Guardrails;
}

export interface ReviewFailure {
  ok: false;
  /** Generic, user-facing. Never includes model output or user text. */
  error: string;
  canUseDemo: boolean;
}

export type ReviewResult = ReviewSuccess | ReviewFailure;

export interface ModelCallResult {
  /** Parsed JSON from the model, or undefined if the response had no usable JSON. */
  json: unknown;
  stopReason: string | null;
  requestId: string | null;
  model: string;
}
