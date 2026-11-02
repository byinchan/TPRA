// AI review settings. The model name is the only thing to change to switch models.
// Pricing checked 2026-11-02 (Claude API docs): claude-haiku-5-5 is $0.10 / $0.50 per million input / output tokens.

export const AI_CONFIG = {
  /** Override with ANTHROPIC_MODEL in Vercel without a code change. */
  model: process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-5-5",
  /** Haiku 5.5 defaults to "medium"; set explicitly so a model change does not silently change it. */
  effort: "medium" as const,
  maxTokens: 16000,
  timeoutMs: 60_000,
  /** The SDK retries 429/5xx/connection errors; keep it low so a failing call costs little. */
  maxRetries: 1,
} as const;

export const LIMITS = {
  /** Per IP, per window (in-memory, per server instance). */
  perIpCalls: 5,
  perIpWindowMs: 60 * 60 * 1000,
  /** App-wide live calls per UTC day (in-memory, per server instance). */
  dailyCalls: 100,
  /** Request body cap, bytes. */
  maxBodyBytes: 8_000,
  /** Caps applied to every text field the model returns. */
  maxRationaleChars: 280,
  maxNoteChars: 400,
  maxEvidenceChars: 200,
  maxInconsistencies: 10,
} as const;
