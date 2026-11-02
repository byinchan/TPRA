// POST /api/narrative: AI-drafted report narrative from the confirmed assessment.
// The browser sends its tab state; the server re-validates it exactly as on load and recomputes every figure,
// so the model only ever sees code-computed facts. Logs outcome and request id only, never text.
import { apiKeyPresent, callClaude } from "@/lib/ai/anthropic.ts";
import { parseNarrativeRequest, runNarrative } from "@/lib/ai/narrative.ts";
import { sharedLimiter } from "@/lib/ai/sharedLimiter.ts";

const MAX_BODY_BYTES = 300_000;

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
  if (Number(req.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Request too large.", canUseDemo: false }, 413);
  }
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: "Request too large.", canUseDemo: false }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "Invalid request.", canUseDemo: false }, 400);
  }
  const parsed = parseNarrativeRequest(body);
  if ("error" in parsed) return json({ ok: false, error: parsed.error, canUseDemo: false }, 400);

  const result = await runNarrative(parsed.state, parsed.demo, {
    apiKeyPresent: apiKeyPresent(),
    limiter: sharedLimiter,
    ip: clientIp(req),
    now: () => new Date(),
    callModel: callClaude,
    log: ({ outcome, requestId }) =>
      console.log(JSON.stringify({ route: "narrative", outcome, requestId: requestId ?? null })),
  });
  return json(result, result.ok ? 200 : 502);
}
