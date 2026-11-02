// One limiter for every AI route, so the per-IP limit and the daily cap count all live calls together.
// In memory: shared by requests that reach the same server instance (see LIMITS in config/ai.ts).
import { LIMITS } from "../../config/ai.ts";
import { createLimiter } from "./limits.ts";

export const sharedLimiter = createLimiter(LIMITS);
