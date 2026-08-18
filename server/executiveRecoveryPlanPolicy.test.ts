import { describe, expect, it } from "vitest";
import { canApproveExecutiveRecoveryPlan } from "./executiveRecoveryPlanPolicy";

describe("canApproveExecutiveRecoveryPlan", () => {
  const completeDraft = { status: "draft" as const, isAssignedDeliveryManager: true, fileUrl: "https://evidencia.example/prd.pdf", dueDate: "2026-08-21" };

  it("permite aprobar sólo un borrador evidenciado por el Delivery asignado", () => {
    expect(canApproveExecutiveRecoveryPlan(completeDraft)).toBe(true);
  });

  it("bloquea aprobación sin evidencia, fecha, rol asignado o desde un estado terminal", () => {
    expect(canApproveExecutiveRecoveryPlan({ ...completeDraft, fileUrl: "" })).toBe(false);
    expect(canApproveExecutiveRecoveryPlan({ ...completeDraft, dueDate: null })).toBe(false);
    expect(canApproveExecutiveRecoveryPlan({ ...completeDraft, isAssignedDeliveryManager: false })).toBe(false);
    expect(canApproveExecutiveRecoveryPlan({ ...completeDraft, status: "vigente" })).toBe(false);
  });
});
