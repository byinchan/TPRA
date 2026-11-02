// POST /api/review: AI-proposed questionnaire ratings for the sample vendor.
// Logs only an outcome and the Anthropic request id. Never logs or stores request or response text.
import { LIMITS } from "@/config/ai.ts";
import { apiKeyPresent, callClaude } from "@/lib/ai/anthropic.ts";
import { createLimiter } from "@/lib/ai/limits.ts";
import { parseReviewRequest, runReview } from "@/lib/ai/review.ts";

// Module scope: shared by requests that reach the same server instance.
const limiter = createLimiter(LIMITS);

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > LIMITS.maxBodyBytes) return json({ ok: false, error: "Request too large.", canUseDemo: false }, 413);

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > LIMITS.maxBodyBytes) return json({ ok: false, error: "Request too large.", canUseDemo: false }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "Invalid request.", canUseDemo: false }, 400);
  }

  const parsed = parseReviewRequest(body);
  if (!parsed) return json({ ok: false, error: "Invalid request.", canUseDemo: false }, 400);

  const result = await runReview(parsed, {
    apiKeyPresent: apiKeyPresent(),
    limiter,
    ip: clientIp(req),
    now: () => new Date(),
    callModel: callClaude,
    log: ({ outcome, requestId }) =>
      console.log(JSON.stringify({ route: "review", outcome, requestId: requestId ?? null })),
  });
  return json(result, result.ok ? 200 : 502);
}
