import { describe, expect, it } from "vitest";
import { assessMilestoneAcceptanceEligibility } from "./executiveMilestoneAcceptancePolicy";

describe("assessMilestoneAcceptanceEligibility", () => {
  const base = { milestoneExists: true, alreadyAccepted: false, evidenceUrl: "https://evidencia.example/acta.pdf", evidenceFileName: "acta.pdf" };

  it("permite registrar una primera acta con evidencia web válida", () => {
    expect(assessMilestoneAcceptanceEligibility(base)).toEqual({ allowed: true, reason: null });
  });

  it("rechaza hitos fuera del baseline contractual activo", () => {
    expect(assessMilestoneAcceptanceEligibility({ ...base, milestoneExists: false }).allowed).toBe(false);
  });

  it("impide sustituir silenciosamente un acta vigente", () => {
    expect(assessMilestoneAcceptanceEligibility({ ...base, alreadyAccepted: true }).reason).toMatch(/ya tiene/i);
  });

  it("exige una referencia documental válida", () => {
    expect(assessMilestoneAcceptanceEligibility({ ...base, evidenceUrl: "archivo-local", evidenceFileName: "" }).allowed).toBe(false);
  });
});
