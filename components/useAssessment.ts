"use client";
// The only place that touches sessionStorage. State lives in this tab and is lost when it closes.
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEY, parseState, type AssessmentState } from "@/lib/session.ts";

export function useAssessment() {
  const [state, setState] = useState<AssessmentState | null>(null);
  const [ready, setReady] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked: run without persistence.
    }
    const parsed = parseState(raw);
    if (raw !== null && parsed === null) {
      setDiscarded(true);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
    setState(parsed);
    setReady(true);
  }, []);

  const update = useCallback((next: AssessmentState | null) => {
    setState(next);
    try {
      if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  return { state, ready, discarded, update };
}
