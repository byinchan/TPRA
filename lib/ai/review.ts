// Orchestrates one AI review: validate the request, decide live vs demo, call the model,
// validate the output. The model call is injected, so this file has no SDK or network code.
import { ANSWER_RATINGS } from "../../config/rules.ts";
import { IRA_QUESTIONS, SAMPLES } from "../sample.ts";
import { ANSWERS, type IraAnswer } from "../types.ts";
import { DEMO_REVIEWS } from "./demo.ts";
import type { Limiter } from "./limits.ts";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserMessage } from "./prompt.ts";
import { validateReview } from "./schema.ts";
import type { DemoReason, ModelCallResult, ReviewResult } from "./types.ts";

export type { DemoReason, ReviewResult, ReviewSource, ReviewSuccess, ReviewFailure, ModelCallResult } from "./types.ts";

export interface ReviewRequest {
  sampleId: string;
  ira: IraAnswer[];
  /** The analyst can ask for the saved demo output instead of a live call. */
  demo: boolean;
}

/** Thrown by the model adapter. kind decides whether we fall back to demo or show an error. */
export class UpstreamError extends Error {
  readonly kind: "rate-limited" | "budget" | "unavailable" | "failed";
  readonly requestId: string | null;
  constructor(kind: UpstreamError["kind"], requestId: string | null) {
    super(`Upstream ${kind}`);
    this.kind = kind;
    this.requestId = requestId;
  }
}

export interface ReviewDeps {
  apiKeyPresent: boolean;
  limiter: Limiter;
  ip: string;
  now: () => Date;
  callModel: (system: string, user: string) => Promise<ModelCallResult>;
  /** Status-and-request-id logging only. */
  log: (event: { outcome: string; requestId?: string | null }) => void;
}

const IRA_IDS = Object.keys(ANSWER_RATINGS);
const GENERIC_ERROR = "The AI review could not be completed. You can try again later or use the saved demo review.";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Strict request check: known sample, exactly the 16 IRA IDs in order, enum answers, nothing else. */
export function parseReviewRequest(body: unknown): ReviewRequest | null {
  if (!isObject(body)) return null;
  const keys = Object.keys(body);
  if (keys.some((k) => !["sampleId", "ira", "demo"].includes(k))) return null;
  if (typeof body.sampleId !== "string" || !(body.sampleId in SAMPLES)) return null;
  if (body.demo !== undefined && typeof body.demo !== "boolean") return null;
  if (!Array.isArray(body.ira) || body.ira.length !== IRA_IDS.length) return null;
  const ira: IraAnswer[] = [];
  for (const [i, row] of body.ira.entries()) {
    if (!isObject(row) || Object.keys(row).length !== 2 || row.id !== IRA_IDS[i]) return null;
    const answer = ANSWERS.find((a) => a === row.answer);
    if (!answer) return null;
    ira.push({ id: IRA_IDS[i]!, answer });
  }
  return { sampleId: body.sampleId, ira, demo: body.demo === true };
}

const known = () => ({ iraIds: IRA_IDS, ddqIds: SAMPLES["v1-deloitte"]!.ddq.map((r) => r.id) });

export function demoReview(req: ReviewRequest, reason: DemoReason): ReviewResult {
  const saved = DEMO_REVIEWS[req.sampleId];
  const checked = saved && validateReview(saved.output, known());
  if (!saved || !checked) return { ok: false, error: GENERIC_ERROR, canUseDemo: false };
  const matches = saved.answersUsed.every((a) => req.ira.find((r) => r.id === a.id)?.answer === a.answer);
  return {
    ok: true,
    mode: "demo",
    demoReason: reason,
    demoMatchesAnswers: matches,
    source: saved.source,
    review: checked.review,
    guardrails: checked.guardrails,
  };
}

export async function runReview(req: ReviewRequest, deps: ReviewDeps): Promise<ReviewResult> {
  if (req.demo) return demoReview(req, "requested");
  if (!deps.apiKeyPresent) return demoReview(req, "no-key");

  const decision = deps.limiter.take(deps.ip, deps.now().getTime());
  if (decision !== "ok") {
    deps.log({ outcome: decision });
    return demoReview(req, decision);
  }

  const sample = SAMPLES[req.sampleId]!;
  try {
    const res = await deps.callModel(REVIEW_SYSTEM_PROMPT, buildReviewUserMessage(sample, IRA_QUESTIONS, req.ira));
    const checked = res.stopReason === "end_turn" ? validateReview(res.json, known()) : null;
    if (!checked) {
      deps.log({ outcome: `invalid-output:${res.stopReason ?? "none"}`, requestId: res.requestId });
      return { ok: false, error: GENERIC_ERROR, canUseDemo: true };
    }
    deps.log({ outcome: "ok", requestId: res.requestId });
    return {
      ok: true,
      mode: "live",
      demoReason: null,
      demoMatchesAnswers: null,
      source: {
        kind: "model",
        model: res.model,
        generatedAt: deps.now().toISOString(),
        note: "Generated live for this assessment.",
      },
      review: checked.review,
      guardrails: checked.guardrails,
    };
  } catch (e) {
    if (!(e instanceof UpstreamError)) {
      deps.log({ outcome: "error" });
      return { ok: false, error: GENERIC_ERROR, canUseDemo: true };
    }
    deps.log({ outcome: `upstream-${e.kind}`, requestId: e.requestId });
    if (e.kind === "rate-limited") return demoReview(req, "rate-limited");
    if (e.kind === "budget") return demoReview(req, "budget");
    if (e.kind === "unavailable") return demoReview(req, "service-unavailable");
    return { ok: false, error: GENERIC_ERROR, canUseDemo: true };
  }
}
