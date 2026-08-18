export type RecoveryPlanStatus = "draft" | "vigente" | "closed" | "superseded";

export function canApproveExecutiveRecoveryPlan(input: {
  status: RecoveryPlanStatus;
  isAssignedDeliveryManager: boolean;
  fileUrl?: string | null;
  dueDate?: string | null;
}) {
  return input.status === "draft"
    && input.isAssignedDeliveryManager
    && Boolean(input.fileUrl?.trim())
    && Boolean(input.dueDate?.trim());
}
