import { describe, expect, it } from "vitest";
import { assessVerdictReviewEligibility } from "./executiveVerdictReviewPolicy";

describe("assessVerdictReviewEligibility", () => {
  it("permite una sola revisión de la observación vigente y pendiente", () => {
    expect(assessVerdictReviewEligibility({ currentAnalysisId: 44, requestedVerdictId: 44, currentReviewStatus: "PENDING" })).toEqual({ allowed: true });
    expect(assessVerdictReviewEligibility({ currentAnalysisId: 44, requestedVerdictId: 44, currentReviewStatus: null })).toEqual({ allowed: true });
  });

  it("bloquea observaciones obsoletas o ya resueltas", () => {
    expect(assessVerdictReviewEligibility({ currentAnalysisId: 45, requestedVerdictId: 44, currentReviewStatus: "PENDING" })).toEqual({ allowed: false, code: "STALE_VERDICT" });
    expect(assessVerdictReviewEligibility({ currentAnalysisId: 44, requestedVerdictId: 44, currentReviewStatus: "VALIDATED" })).toEqual({ allowed: false, code: "ALREADY_REVIEWED" });
  });
});
