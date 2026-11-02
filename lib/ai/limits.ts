// Basic public-demo safeguards: per-IP rate limit and an app-wide daily call cap.
// In memory, so they apply per server instance and reset when it restarts. The hard budget cap is the
// prepaid Anthropic credit with auto-reload off. Pure apart from its own Map; time is injected.

export type LimitDecision = "ok" | "rate-limited" | "daily-cap";

export interface Limiter {
  /** Records a call if allowed. */
  take(ip: string, nowMs: number): LimitDecision;
}

export function createLimiter(opts: { perIpCalls: number; perIpWindowMs: number; dailyCalls: number }): Limiter {
  const byIp = new Map<string, number[]>();
  let day = "";
  let dayCount = 0;

  return {
    take(ip, nowMs) {
      const today = new Date(nowMs).toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        dayCount = 0;
        byIp.clear();
      }
      if (dayCount >= opts.dailyCalls) return "daily-cap";
      const recent = (byIp.get(ip) ?? []).filter((t) => nowMs - t < opts.perIpWindowMs);
      if (recent.length >= opts.perIpCalls) {
        byIp.set(ip, recent);
        return "rate-limited";
      }
      recent.push(nowMs);
      byIp.set(ip, recent);
      dayCount++;
      return "ok";
    },
  };
}
