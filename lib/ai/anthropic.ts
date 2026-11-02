// The only file that talks to the Claude API. Server-side only (the API key never reaches the browser).
// Maps SDK errors to UpstreamError kinds; returns parsed JSON and the request id, never logs content.
import Anthropic from "@anthropic-ai/sdk";
import { AI_CONFIG } from "../../config/ai.ts";
import { UpstreamError, type ModelCallResult } from "./review.ts";

let client: Anthropic | null = null;

export function apiKeyPresent(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function getClient(): Anthropic {
  // Pass the key explicitly so no other credential source (profiles, auth tokens) is picked up.
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: AI_CONFIG.maxRetries,
    timeout: AI_CONFIG.timeoutMs,
  });
  return client;
}

export async function callClaude(system: string, user: string, schema: Record<string, unknown>): Promise<ModelCallResult> {
  try {
    const { data, request_id } = await getClient()
      .messages.create({
        model: AI_CONFIG.model,
        max_tokens: AI_CONFIG.maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { effort: AI_CONFIG.effort, format: { type: "json_schema", schema } },
      })
      .withResponse();
    const text = data.content.find((b) => b.type === "text");
    let json: unknown;
    try {
      json = text ? JSON.parse(text.text) : undefined;
    } catch {
      json = undefined;
    }
    return { json, stopReason: data.stop_reason, requestId: request_id ?? null, model: data.model };
  } catch (e) {
    const requestId = e instanceof Anthropic.APIError ? (e.requestID ?? null) : null;
    if (e instanceof Anthropic.RateLimitError) throw new UpstreamError("rate-limited", requestId);
    if (e instanceof Anthropic.APIError && (e.status === 402 || e.type === "billing_error")) {
      throw new UpstreamError("budget", requestId);
    }
    if (e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      throw new UpstreamError("unavailable", requestId);
    }
    throw new UpstreamError("failed", requestId);
  }
}
