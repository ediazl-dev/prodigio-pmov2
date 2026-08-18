import { describe, expect, it } from "vitest";
import { canCloseExecutiveRequirement, canWaiveExecutiveRequirement } from "./executiveRequirements";

describe("executive requirement governance", () => {
  it("requires closure evidence and rejects terminal requirements", () => {
    expect(canCloseExecutiveRequirement({ status: "open", closureEvidenceUrl: "https://evidence.example/acta.pdf" })).toBe(true);
    expect(canCloseExecutiveRequirement({ status: "open", closureEvidenceUrl: "" })).toBe(false);
    expect(canCloseExecutiveRequirement({ status: "closed", closureEvidenceUrl: "https://evidence.example/acta.pdf" })).toBe(false);
  });

  it("restricts waivers to the assigned delivery manager with an explicit reason", () => {
    expect(canWaiveExecutiveRequirement({ status: "in_progress", isAssignedDeliveryManager: true, reason: "Cambio contractual aprobado" })).toBe(true);
    expect(canWaiveExecutiveRequirement({ status: "in_progress", isAssignedDeliveryManager: false, reason: "Cambio contractual aprobado" })).toBe(false);
    expect(canWaiveExecutiveRequirement({ status: "in_progress", isAssignedDeliveryManager: true, reason: "" })).toBe(false);
  });
});
