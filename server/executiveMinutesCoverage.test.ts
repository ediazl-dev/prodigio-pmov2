import { describe, expect, it } from "vitest";
import { calculateExecutiveMinutesCoverage } from "./executiveMinutesCoverage";

describe("calculateExecutiveMinutesCoverage", () => {
  it("cuenta sólo minutas revisadas y expone la brecha consecutiva al corte", () => {
    const coverage = calculateExecutiveMinutesCoverage({
      baselineApprovedAt: "2026-08-03",
      cutoffDate: "2026-08-17",
      minutes: [
        { isoWeek: "2026-W32", reviewStatus: "reviewed" },
        { isoWeek: "2026-W33", reviewStatus: "received" },
      ],
    });
    expect(coverage).toMatchObject({ expectedWeeks: 3, reviewedWeeks: 1, receivedUnreviewedWeeks: 1, coveragePct: 33, consecutiveGapWeeks: 2 });
    expect(coverage.missingWeeks).toEqual(["2026-W33", "2026-W34"]);
  });

  it("no fabrica cobertura cuando falta la fecha de inicio contractual", () => {
    expect(calculateExecutiveMinutesCoverage({ baselineApprovedAt: null, cutoffDate: "2026-08-17", minutes: [] }).coveragePct).toBeNull();
  });
});
