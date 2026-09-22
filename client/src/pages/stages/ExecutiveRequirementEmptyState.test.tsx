import { describe, expect, it } from "vitest";
import {
  buildExecutiveRequirementGapPresentation,
  getExecutiveRequirementsHeaderTag,
} from "./ExecutiveRequirementEmptyState";

describe("ExecutiveRequirementEmptyState", () => {
  it("presenta una brecha de gobierno y no un estado conforme cuando el proyecto es crítico", () => {
    const result = buildExecutiveRequirementGapPresentation({
      governanceState: "CRITICO",
      pendingMilestones: 4,
      highOpenRisks: 12,
      activeTriggers: 2,
    });

    expect(result.tone).toBe("critical");
    expect(result.badge).toBe("BRECHA DE GOBIERNO");
    expect(result.message).toContain("estado CRÍTICO");
    expect(result.message).toContain("Esto no significa que el proyecto esté conforme");
    expect(result.signals).toEqual([
      "4 hito(s) contractual(es) pendiente(s) o demorado(s)",
      "12 riesgo(s) alto(s) abierto(s) en Jira",
      "2 gatillo(s) ejecutivo(s) activo(s)",
    ]);
  });

  it("usa revisión pendiente para estados amarillo o naranjo", () => {
    for (const governanceState of ["AMARILLO", "NARANJO"]) {
      const result = buildExecutiveRequirementGapPresentation({
        governanceState,
        pendingMilestones: 1,
        highOpenRisks: null,
        activeTriggers: 0,
      });
      expect(result.tone).toBe("warning");
      expect(result.badge).toBe("REVISIÓN PENDIENTE");
    }
  });

  it("mantiene un mensaje informativo que no acredita cumplimiento para estados estables", () => {
    const result = buildExecutiveRequirementGapPresentation({
      governanceState: "VERDE",
      pendingMilestones: 0,
      highOpenRisks: 0,
      activeTriggers: 0,
    });

    expect(result.tone).toBe("neutral");
    expect(result.badge).toBe("0 FORMALIZADAS");
    expect(result.message).toContain("no acredita cumplimiento");
  });

  it("no muestra cero abiertas como lectura principal cuando no existe ninguna exigencia", () => {
    expect(getExecutiveRequirementsHeaderTag({
      governanceState: "ROJO",
      totalRequirements: 0,
      openRequirements: 0,
    })).toBe("BRECHA DE GOBIERNO");
  });

  it("distingue exigencias cerradas de la ausencia total de registros", () => {
    expect(getExecutiveRequirementsHeaderTag({
      governanceState: "ROJO",
      totalRequirements: 2,
      openRequirements: 0,
    })).toBe("2 cerrada(s) · 0 abiertas");
    expect(getExecutiveRequirementsHeaderTag({
      governanceState: "ROJO",
      totalRequirements: 3,
      openRequirements: 1,
    })).toBe("1 abierta(s)");
  });
});
