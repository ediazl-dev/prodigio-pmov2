export type RequirementStatus = "open" | "in_progress" | "closed" | "waived";

export function canCloseExecutiveRequirement(input: { status: RequirementStatus; closureEvidenceUrl?: string | null }) {
  return !["closed", "waived"].includes(input.status) && Boolean(input.closureEvidenceUrl?.trim());
}

export function canWaiveExecutiveRequirement(input: { status: RequirementStatus; isAssignedDeliveryManager: boolean; reason?: string | null }) {
  return !["closed", "waived"].includes(input.status) && input.isAssignedDeliveryManager && Boolean(input.reason?.trim());
}

