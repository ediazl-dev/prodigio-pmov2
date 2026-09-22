import { describe, expect, it } from "vitest";
import { assessExecutiveEvidenceAccess } from "./executiveEvidenceAccess";

describe("assessExecutiveEvidenceAccess", () => {
  it("habilita Tanner y Staffing cuando existe baseline aprobado", () => {
    expect(assessExecutiveEvidenceAccess({ projectExists: true, approvedSourceExists: true })).toEqual({ allowed: true });
  });

  it("bloquea un proyecto inexistente", () => {
    expect(assessExecutiveEvidenceAccess({ projectExists: false, approvedSourceExists: false })).toEqual({
      allowed: false,
      code: "PROJECT_NOT_FOUND",
      reason: "Proyecto no encontrado",
    });
  });

  it("bloquea un proyecto sin baseline ejecutivo aprobado", () => {
    expect(assessExecutiveEvidenceAccess({ projectExists: true, approvedSourceExists: false })).toEqual({
      allowed: false,
      code: "APPROVED_BASELINE_REQUIRED",
      reason: "El proyecto no tiene un baseline ejecutivo aprobado",
    });
  });
});
