// Saved outputs for demo mode (review and report narrative), one per sample. Each is validated like a live response before use.
import v1Demo from "../../data/demo/v1-halden-review.json" with { type: "json" };
import v1Narrative from "../../data/demo/v1-halden-narrative.json" with { type: "json" };
import type { Answer } from "../types.ts";
import type { ReviewSource } from "./types.ts";

export interface DemoFile {
  sampleId: string;
  source: ReviewSource;
  /** The IRA answers the saved output was produced for. */
  answersUsed: { id: string; answer: Answer }[];
  /** Raw output, passed through validateReview like a live response. */
  output: unknown;
}

export const DEMO_REVIEWS: Record<string, DemoFile> = {
  "v1-halden": v1Demo as DemoFile,
};

export interface DemoNarrativeFile {
  sampleId: string;
  source: ReviewSource;
  /** factsFingerprint of the state the saved narrative was written for. */
  factsKey: string;
  output: unknown;
}

export const DEMO_NARRATIVES: Record<string, DemoNarrativeFile> = {
  "v1-halden": v1Narrative as DemoNarrativeFile,
};
