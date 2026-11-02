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

export const FICTIONAL_VENDOR = "Halden Advisory (fictional)";
export const VENDOR_DISCLAIMER =
  "Halden Advisory is a fictional vendor. Vendor responses are illustrative and were written for this portfolio. They make no statement about any real organization's security practices.";

export const SAMPLES: Record<string, SampleVendor> = {
  "v1-halden": {
    id: "v1-halden",
    label: "Halden Advisory (fictional): AI governance consulting",
    // The manual v1 named a real firm. The app shows a fictional name; /v1 and data/v1-vendor.json stay as written.
    vendor: FICTIONAL_VENDOR,
    service: v1.service,
    disclaimer: VENDOR_DISCLAIMER,
    iraAnswers: v1.ira.map(({ id, answer }) => ({ id, answer: answer as Answer })),
    ddq: v1.ddq.map((r) => ({ ...r, question: r.question.replaceAll(v1.vendor, "Halden Advisory") })),
  },
};

export const DDQ_IDS: readonly string[] = v1.ddq.map((r) => r.id);
