// Date arithmetic on plain "YYYY-MM-DD" strings (UTC, no time zones). Pure functions.
import { TIERS } from "../config/rules.ts";
import type { Level } from "./types.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Adds calendar months, clamping to the last day of the month (2026-01-31 + 1 = 2026-02-28). */
export function addMonths(isoDate: string, months: number): string {
  if (!isIsoDate(isoDate)) throw new Error(`Not a YYYY-MM-DD date: ${isoDate}`);
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = total % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ty, tm, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/** Next review date from the assessment date and the tier cadence. null = at contract renewal. */
export function nextReviewDate(assessedOn: string, inherent: Level): string | null {
  const months = TIERS[inherent].reviewEveryMonths;
  return months === null ? null : addMonths(assessedOn, months);
}
