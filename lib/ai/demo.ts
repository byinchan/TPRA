// Saved review outputs for demo mode, one per sample. Each is validated like a live response before use.
import v1Demo from "../../data/demo/v1-deloitte-review.json" with { type: "json" };
import type { Answer } from "../types.ts";
import type { ReviewSource } from "./review.ts";

export interface DemoFile {
  sampleId: string;
  source: ReviewSource;
  /** The IRA answers the saved output was produced for. */
  answersUsed: { id: string; answer: Answer }[];
  /** Raw output, passed through validateReview like a live response. */
  output: unknown;
}

export const DEMO_REVIEWS: Record<string, DemoFile> = {
  "v1-deloitte": v1Demo as DemoFile,
};
