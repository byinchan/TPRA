// Sample vendors. The IRA questions are the same for every sample (only the answers differ).
import v1 from "../data/v1-vendor.json" with { type: "json" };
import type { Answer, Level } from "./types.ts";

export interface IraQuestion {
  id: string;
  area: string;
  question: string;
  addedAfterV1: boolean;
  /** The manual v1 rating, for reference. null for IRA-16. */
  v1Rating: Level | null;
}

export interface SampleVendor {
  id: string;
  label: string;
  vendor: string;
  service: string;
  disclaimer: string;
  iraAnswers: { id: string; answer: Answer }[];
  ddq: { id: string; domain: string; question: string; response: string }[];
}

export const IRA_QUESTIONS: readonly IraQuestion[] = v1.ira.map(({ id, area, question, addedAfterV1, v1Rating }) => ({
  id,
  area,
  question,
  addedAfterV1,
  v1Rating: v1Rating as Level | null,
}));

export const IRA_AREAS = [...new Set(IRA_QUESTIONS.map((q) => q.area))];

export const SAMPLES: Record<string, SampleVendor> = {
  "v1-deloitte": {
    id: "v1-deloitte",
    label: "Sample 1: Deloitte (AI governance consulting)",
    vendor: v1.vendor,
    service: v1.service,
    disclaimer:
      "Vendor responses are illustrative and were written for this portfolio. They are not Deloitte's actual responses and make no statement about Deloitte's security practices.",
    iraAnswers: v1.ira.map(({ id, answer }) => ({ id, answer: answer as Answer })),
    ddq: v1.ddq,
  },
};

export const DDQ_IDS: readonly string[] = v1.ddq.map((r) => r.id);
