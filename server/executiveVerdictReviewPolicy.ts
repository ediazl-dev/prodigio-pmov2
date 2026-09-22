export type VerdictReviewStatus = "PENDING" | "VALIDATED" | "REJECTED";

export type VerdictReviewEligibilityInput = {
  currentAnalysisId: number | null | undefined;
  requestedVerdictId: number;
  currentReviewStatus: VerdictReviewStatus | null | undefined;
};

export type VerdictReviewEligibility =
  | { allowed: true }
  | { allowed: false; code: "STALE_VERDICT" | "ALREADY_REVIEWED" };

/**
 * Una observación agéntica nunca equivale a una decisión ejecutiva. Sólo la
 * observación vigente y aún pendiente puede ser revisada una vez.
 */
export function assessVerdictReviewEligibility(input: VerdictReviewEligibilityInput): VerdictReviewEligibility {
  if (!input.currentAnalysisId || input.currentAnalysisId !== input.requestedVerdictId) {
    return { allowed: false, code: "STALE_VERDICT" };
  }
  if (input.currentReviewStatus && input.currentReviewStatus !== "PENDING") {
    return { allowed: false, code: "ALREADY_REVIEWED" };
  }
  return { allowed: true };
}
