import { describe, expect, it } from "vitest";
import { assessVerdictReviewEligibility } from "./executiveVerdictReviewPolicy";

describe("assessVerdictReviewEligibility", () => {
  it("permite una sola revisión de la observación vigente y pendiente del piloto", () => {
    expect(assessVerdictReviewEligibility({ pilotEnabled: true, currentAnalysisId: 44, requestedVerdictId: 44, currentReviewStatus: "PENDING" })).toEqual({ allowed: true });
    expect(assessVerdictReviewEligibility({ pilotEnabled: true, currentAnalysisId: 44, requestedVerdictId: 44, currentReviewStatus: null })).toEqual({ allowed: true });
  });

  it("bloquea revisiones fuera del piloto, sobre observaciones obsoletas o ya resueltas", () => {
    expect(assessVerdictReviewEligibility({ pilotEnabled: false, currentAnalysisId: 44, requestedVerdictId: 44, currentReviewStatus: "PENDING" })).toEqual({ allowed: false, code: "PILOT_DISABLED" });
    expect(assessVerdictReviewEligibility({ pilotEnabled: true, currentAnalysisId: 45, requestedVerdictId: 44, currentReviewStatus: "PENDING" })).toEqual({ allowed: false, code: "STALE_VERDICT" });
    expect(assessVerdictReviewEligibility({ pilotEnabled: true, currentAnalysisId: 44, requestedVerdictId: 44, currentReviewStatus: "VALIDATED" })).toEqual({ allowed: false, code: "ALREADY_REVIEWED" });
  });
});
