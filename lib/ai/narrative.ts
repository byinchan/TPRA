// Orchestrates one narrative draft: rebuild the facts from the validated state on the server, decide live vs
// demo, call the model, validate the output. The model call is injected (no SDK code here).
import { computeOutcome } from "../outcome.ts";
import { buildFacts, factsFingerprint } from "../report/facts.ts";
import { NARRATIVE_SCHEMA, validateNarrative } from "../report/schema.ts";
import type { NarrativeSuccess } from "../report/state.ts";
import { parseState, type AssessmentState } from "../session.ts";
import { DEMO_NARRATIVES } from "./demo.ts";
import { NARRATIVE_SYSTEM_PROMPT, buildNarrativeUserMessage } from "./prompt.ts";
import { UpstreamError, type DemoReason, type ReviewDeps, type ReviewFailure } from "./review.ts";

const GENERIC_ERROR = "The narrative could not be drafted. You can try again later or use the saved demo draft.";

export type NarrativeResult = NarrativeSuccess | ReviewFailure;

/** Body: { state: AssessmentState, demo?: boolean }. The state is re-validated exactly as on load. */
export function parseNarrativeRequest(body: unknown): { state: AssessmentState; demo: boolean } | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { error: "Invalid request." };
  const b = body as Record<string, unknown>;
  if (Object.keys(b).some((k) => k !== "state" && k !== "demo")) return { error: "Invalid request." };
  if (b.demo !== undefined && typeof b.demo !== "boolean") return { error: "Invalid request." };
  const state = parseState(JSON.stringify(b.state ?? null));
  if (!state) return { error: "Invalid request." };
  if (!computeOutcome(state).recommendation) return { error: "Confirm every questionnaire row before drafting the report." };
  return { state, demo: b.demo === true };
}

export function demoNarrative(state: AssessmentState, reason: DemoReason): NarrativeResult {
  const saved = DEMO_NARRATIVES[state.sampleId];
  const checked = saved && validateNarrative(saved.output);
  if (!saved || !checked) return { ok: false, error: GENERIC_ERROR, canUseDemo: false };
  const key = factsFingerprint(buildFacts(state, computeOutcome(state)));
  return {
    ok: true,
    mode: "demo",
    demoReason: reason,
    demoMatchesFacts: key === saved.factsKey,
    source: saved.source,
    narrative: checked.narrative,
    truncated: checked.truncated,
  };
}

export async function runNarrative(state: AssessmentState, demo: boolean, deps: ReviewDeps): Promise<NarrativeResult> {
  if (demo) return demoNarrative(state, "requested");
  if (!deps.apiKeyPresent) return demoNarrative(state, "no-key");
  const decision = deps.limiter.take(deps.ip, deps.now().getTime());
  if (decision !== "ok") {
    deps.log({ outcome: decision });
    return demoNarrative(state, decision);
  }
  const facts = buildFacts(state, computeOutcome(state));
  try {
    const res = await deps.callModel(NARRATIVE_SYSTEM_PROMPT, buildNarrativeUserMessage(facts), NARRATIVE_SCHEMA);
    const checked = res.stopReason === "end_turn" ? validateNarrative(res.json) : null;
    if (!checked) {
      deps.log({ outcome: `invalid-output:${res.stopReason ?? "none"}`, requestId: res.requestId });
      return { ok: false, error: GENERIC_ERROR, canUseDemo: true };
    }
    deps.log({ outcome: "ok", requestId: res.requestId });
    return {
      ok: true,
      mode: "live",
      demoReason: null,
      demoMatchesFacts: null,
      source: { kind: "model", model: res.model, generatedAt: deps.now().toISOString(), note: "Drafted live from the confirmed facts." },
      narrative: checked.narrative,
      truncated: checked.truncated,
    };
  } catch (e) {
    if (!(e instanceof UpstreamError)) {
      deps.log({ outcome: "error" });
      return { ok: false, error: GENERIC_ERROR, canUseDemo: true };
    }
    deps.log({ outcome: `upstream-${e.kind}`, requestId: e.requestId });
    if (e.kind === "rate-limited") return demoNarrative(state, "rate-limited");
    if (e.kind === "budget") return demoNarrative(state, "budget");
    if (e.kind === "unavailable") return demoNarrative(state, "service-unavailable");
    return { ok: false, error: GENERIC_ERROR, canUseDemo: true };
  }
}
