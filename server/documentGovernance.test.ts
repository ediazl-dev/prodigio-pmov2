import { describe, expect, it } from "vitest";
import { RECURRING_SERVICE_TYPE_VALUES } from "../shared/recurringServiceTypes";
import {
  DOCUMENT_GOVERNANCE_DEFAULTS,
  DOCUMENT_GOVERNANCE_POLICY_VERSION,
  DOCUMENT_REQUIREMENT_DEFINITIONS,
  PROJECT_BASE_REQUIREMENTS,
  RECURRING_DOCUMENT_LEGACY_ALIASES,
  RECURRING_SERVICE_BASE_REQUIREMENTS,
  getBaseDocumentRequirements,
  isDocumentRequirementCode,
} from "../shared/documentGovernance";

describe("documentGovernance", () => {
  it("define una versión de política explícita", () => {
    expect(DOCUMENT_GOVERNANCE_POLICY_VERSION).toBe("2026-09-26.v1");
  });

  it("exige exactamente cuatro documentos a todo servicio recurrente, incluido Staffing", () => {
    expect(RECURRING_SERVICE_BASE_REQUIREMENTS).toEqual([
      "contract",
      "sow",
      "technical_economic_proposal",
      "costed_pnl",
    ]);
    for (const serviceType of RECURRING_SERVICE_TYPE_VALUES) {
      expect(serviceType).toBeTruthy();
      expect(getBaseDocumentRequirements("recurring_service")).toEqual(RECURRING_SERVICE_BASE_REQUIREMENTS);
    }
  });

  it("exige a proyectos los cuatro documentos recurrentes más el plan con hitos", () => {
    expect(getBaseDocumentRequirements("project")).toEqual(PROJECT_BASE_REQUIREMENTS);
    expect(PROJECT_BASE_REQUIREMENTS).toEqual([
      "contract",
      "sow",
      "technical_economic_proposal",
      "costed_pnl",
      "work_plan_milestones",
    ]);
  });

  it("mantiene contrato, SoW y propuesta como requisitos distintos", () => {
    expect(DOCUMENT_REQUIREMENT_DEFINITIONS.contract.validationProfile).toBe("contractual");
    expect(DOCUMENT_REQUIREMENT_DEFINITIONS.sow.validationProfile).toBe("scope");
    expect(DOCUMENT_REQUIREMENT_DEFINITIONS.technical_economic_proposal.validationProfile).toBe("commercial");
  });

  it("no valida propuesta o P&L legacy sólo por el nombre del tipo", () => {
    expect(RECURRING_DOCUMENT_LEGACY_ALIASES.propuesta_tecnica).toMatchObject({
      candidateRequirement: "technical_economic_proposal",
      requiresHumanClassification: true,
    });
    expect(RECURRING_DOCUMENT_LEGACY_ALIASES.pl).toMatchObject({
      candidateRequirement: "costed_pnl",
      requiresHumanClassification: true,
    });
    expect(RECURRING_DOCUMENT_LEGACY_ALIASES.otro.candidateRequirement).toBeNull();
  });

  it("fija defaults conservadores para P&L, roles, vigencia y rollout", () => {
    expect(DOCUMENT_GOVERNANCE_DEFAULTS.pnlRequiredChecks).toEqual([
      "revenueOrBudget",
      "cost",
      "margin",
      "currency",
      "cutoffDate",
      "financialApproval",
    ]);
    expect(DOCUMENT_GOVERNANCE_DEFAULTS.validationRoles).toEqual(["admin", "pmo"]);
    expect(DOCUMENT_GOVERNANCE_DEFAULTS.notApplicableRoles).toEqual(["admin"]);
    expect(DOCUMENT_GOVERNANCE_DEFAULTS.rolloutMode).toBe("observation_before_gate");
  });

  it("reconoce sólo códigos canónicos", () => {
    expect(isDocumentRequirementCode("costed_pnl")).toBe(true);
    expect(isDocumentRequirementCode("pl")).toBe(false);
    expect(isDocumentRequirementCode("otro")).toBe(false);
  });
});
