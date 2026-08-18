import { isoWeekFromDate } from "./executiveMinutes";

export type MinuteCoverageInput = {
  baselineApprovedAt: Date | string | null | undefined;
  cutoffDate: string;
  minutes: Array<{ isoWeek: string; reviewStatus: "received" | "reviewed" | "incomplete" }>;
};

export type MinuteCoverage = {
  expectedWeeks: number | null;
  reviewedWeeks: number;
  receivedUnreviewedWeeks: number;
  coveragePct: number | null;
  consecutiveGapWeeks: number | null;
  missingWeeks: string[];
};

function toIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function mondayUtc(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date;
}

function weekSeries(startDate: string, cutoffDate: string) {
  const start = mondayUtc(startDate);
  const end = mondayUtc(cutoffDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const weeks: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    weeks.push(isoWeekFromDate(cursor.toISOString().slice(0, 10)));
  }
  return weeks;
}

/**
 * Cobertura documental sólo reconoce minutas revisadas. Una minuta recibida
 * queda visible como evidencia pendiente, pero no mejora el indicador.
 */
export function calculateExecutiveMinutesCoverage(input: MinuteCoverageInput): MinuteCoverage {
  const baselineDate = toIsoDate(input.baselineApprovedAt);
  const cutoffDate = toIsoDate(input.cutoffDate);
  if (!baselineDate || !cutoffDate) {
    return { expectedWeeks: null, reviewedWeeks: 0, receivedUnreviewedWeeks: 0, coveragePct: null, consecutiveGapWeeks: null, missingWeeks: [] };
  }

  const expected = weekSeries(baselineDate, cutoffDate);
  if (!expected.length) {
    return { expectedWeeks: null, reviewedWeeks: 0, receivedUnreviewedWeeks: 0, coveragePct: null, consecutiveGapWeeks: null, missingWeeks: [] };
  }

  const reviewed = new Set(input.minutes.filter((minute) => minute.reviewStatus === "reviewed").map((minute) => minute.isoWeek));
  const received = new Set(input.minutes.filter((minute) => minute.reviewStatus === "received").map((minute) => minute.isoWeek));
  const reviewedWeeks = expected.filter((week) => reviewed.has(week));
  const missingWeeks = expected.filter((week) => !reviewed.has(week));
  let consecutiveGapWeeks = 0;
  for (const week of [...expected].reverse()) {
    if (reviewed.has(week)) break;
    consecutiveGapWeeks += 1;
  }

  return {
    expectedWeeks: expected.length,
    reviewedWeeks: reviewedWeeks.length,
    receivedUnreviewedWeeks: expected.filter((week) => received.has(week) && !reviewed.has(week)).length,
    coveragePct: Math.round((reviewedWeeks.length / expected.length) * 100),
    consecutiveGapWeeks,
    missingWeeks,
  };
}
