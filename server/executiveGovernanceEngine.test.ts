import { describe, expect, it } from "vitest";
import { calculateCardinalProgress, calculateExecutiveGovernance, isMilestoneAcceptedAtCutoff, type CardinalMilestone, validatePaymentCurveTotal } from "./executiveGovernanceEngine";

const cutoff = "2026-08-17";

function milestone(code: string, baselineDate: string, overrides: Partial<CardinalMilestone> = {}): CardinalMilestone {
  return { code, baselineDate, billingWeight: 10, valueUf: 205, ...overrides };
}

describe("Executive Governance Engine — cardinalidad contractual", () => {
  it("cuenta hitos aceptados y nunca usa la curva de facturación para CHC", () => {
    const milestones = [
      milestone("M01", "2026-01-10", { billingWeight: 90, acceptedAt: "2026-01-11", acceptanceEvidenceUrl: "s3://acta-m01" }),
      milestone("M02", "2026-02-10", { billingWeight: 1, acceptedAt: "2026-02-12", acceptanceEvidenceUrl: "s3://acta-m02" }),
      milestone("M03", "2026-03-10", { billingWeight: 1 }),
      milestone("M04", "2026-04-10", { billingWeight: 1 }),
      milestone("M05", "2026-05-10", { billingWeight: 1 }),
      milestone("M06", "2026-06-10", { billingWeight: 1 }),
      milestone("M07", "2026-10-10", { billingWeight: 1 }),
      milestone("M08", "2026-10-10", { billingWeight: 1 }),
      milestone("M09", "2026-10-10", { billingWeight: 1 }),
      milestone("M10", "2026-10-10", { billingWeight: 1 }),
    ];
    const progress = calculateCardinalProgress(milestones, cutoff);
    expect(progress).toMatchObject({ totalMilestones: 10, committedCount: 6, acceptedCount: 2, chcT: 33.33, chcG: 20, expectedG: 60, breachRate: 66.67 });
  });

  it("no acepta un entregable sin acta y excluye del denominador el hito que vence el día de corte", () => {
    const withNoAct = milestone("M01", "2026-08-10", { acceptedAt: "2026-08-11" });
    const dueToday = milestone("M02", cutoff);
    expect(isMilestoneAcceptedAtCutoff(withNoAct, cutoff)).toBe(false);
    expect(calculateCardinalProgress([withNoAct, dueToday], cutoff)).toMatchObject({ committedCount: 1, acceptedCount: 0, openOverdueCount: 1, dueOnCutoffCount: 1, chcT: 0 });
  });

  it("activa gatillos absolutos sin permitir que Jira mejore el estado", () => {
    const milestones = [
      milestone("M01", "2026-01-10", { billingWeight: 85, acceptedAt: "2026-01-11", acceptanceEvidenceUrl: "s3://m01" }),
      milestone("M02", "2026-02-10", { billingWeight: 5, acceptedAt: "2026-02-11", acceptanceEvidenceUrl: "s3://m02" }),
      milestone("M03", "2026-03-10", { isCritical: true }),
      milestone("M04", "2026-04-10"),
      milestone("M05", "2026-05-10"),
      milestone("M06", "2026-06-10"),
      milestone("M07", "2026-10-10"), milestone("M08", "2026-10-10"), milestone("M09", "2026-10-10"), milestone("M10", "2026-10-10"),
    ];
    const result = calculateExecutiveGovernance({
      cutoffDate: cutoff,
      milestones,
      financial: { budgetCostUf: 2050, executedCostUf: 3114, saleValueUf: 8200, targetMarginUf: 4000, projectedMarginUf: 1000, annualWacc: 0.12, blockedHeadcount: 2, dailyRateUf: 5, blockedDays: 21, penaltyUf: 0 },
      governance: { minutesCoveragePct: 40, commitmentCompliancePct: 0, hasValidRecoveryPlan: false, consecutiveMinutesGap: 3, recoveryPlanRequired: true, recoveryPlanOverdue: true, consecutiveRedVerdicts: 2 },
      operational: { jiraProgressPct: 92, backlogConfidencePct: 34 },
    });
    expect(result.contractual).toMatchObject({ chcT: 33.33, chcG: 20, drcDays: 160 });
    expect(result.governance.activeTriggers).toEqual(expect.arrayContaining(["G-01", "G-02", "G-03", "G-04", "G-05", "G-06", "G-07"]));
    expect(result.governance.state).toBe("CRITICO");
    expect(result.governance.jiraBiasPp).toBe(58.67);
  });

  it("expone POR_CONFIRMAR en vez de completar con cero un IGE sin fuente financiera o documental", () => {
    const result = calculateExecutiveGovernance({ cutoffDate: cutoff, milestones: [milestone("M01", "2026-01-10")] });
    expect(result.financial.financialHealthNorm).toBeNull();
    expect(result.governance.ige).toBeNull();
    expect(result.governance.state).toBe("POR_CONFIRMAR");
  });

  it("T-19 valida una curva comercial de 100,00 y rechaza una suma distinta sin alterar el contrato", () => {
    expect(validatePaymentCurveTotal([
      milestone("M01", "2026-01-10", { billingWeight: 40 }),
      milestone("M02", "2026-02-10", { billingWeight: 5 }),
      milestone("M03", "2026-03-10", { billingWeight: 5 }),
      milestone("M04", "2026-04-10", { billingWeight: 10 }),
      milestone("M05", "2026-05-10", { billingWeight: 10 }),
      milestone("M06", "2026-06-10", { billingWeight: 10 }),
      milestone("M07", "2026-10-10", { billingWeight: 5 }),
      milestone("M08", "2026-10-10", { billingWeight: 5 }),
      milestone("M09", "2026-10-10", { billingWeight: 5 }),
      milestone("M10", "2026-10-10", { billingWeight: 5 }),
    ])).toEqual({ totalWeight: 100, isValid: true });

    expect(validatePaymentCurveTotal([
      milestone("M01", "2026-01-10", { billingWeight: 105 }),
    ])).toEqual({ totalWeight: 105, isValid: false });
  });

  it("T-20 mantiene CHC invariable ante cambios de pesos de facturación", () => {
    const accepted = { acceptedAt: "2026-01-11", acceptanceEvidenceUrl: "s3://acta-m01" };
    const baseline = [milestone("M01", "2026-01-10", { billingWeight: 5, ...accepted }), milestone("M02", "2026-02-10", { billingWeight: 95 })];
    const altered = [milestone("M01", "2026-01-10", { billingWeight: 95, ...accepted }), milestone("M02", "2026-02-10", { billingWeight: 5 })];

    expect(calculateCardinalProgress(altered, cutoff)).toMatchObject(calculateCardinalProgress(baseline, cutoff));
  });

  it("T-01 a T-18 reproduce el corte de validación Tanner con cardinalidad, costo y gatillos auditables", () => {
    const accepted = { acceptedAt: "2026-01-15", acceptanceEvidenceUrl: "s3://acta-cliente" };
    const result = calculateExecutiveGovernance({
      cutoffDate: cutoff,
      milestones: [
        milestone("M01", "2026-01-10", { billingWeight: 40, valueUf: 0, ...accepted }),
        milestone("M02", "2026-02-10", { billingWeight: 5, valueUf: 0, ...accepted }),
        milestone("M03", "2026-07-27", { billingWeight: 5, valueUf: 717.5, isCritical: true }),
        milestone("M04", "2026-06-10", { billingWeight: 10, valueUf: 717.5 }),
        milestone("M05", "2026-05-10", { billingWeight: 10, valueUf: 717.5 }),
        milestone("M06", "2026-04-10", { billingWeight: 10, valueUf: 717.5 }),
        milestone("M07", cutoff, { billingWeight: 5, valueUf: 0 }),
        milestone("M08", "2026-10-10", { billingWeight: 5, valueUf: 0 }),
        milestone("M09", "2026-11-10", { billingWeight: 5, valueUf: 0 }),
        milestone("M10", "2026-12-10", { billingWeight: 5, valueUf: 0 }),
      ],
      financial: { budgetCostUf: 2050, executedCostUf: 3114, saleValueUf: 8200, targetMarginUf: 4000, projectedMarginUf: 1000, annualWacc: 0.12 },
      governance: { minutesCoveragePct: 40, commitmentCompliancePct: 0, hasValidRecoveryPlan: false, consecutiveMinutesGap: 3, recoveryPlanRequired: true, recoveryPlanOverdue: true, consecutiveRedVerdicts: 2 },
      operational: { jiraProgressPct: 56, backlogConfidencePct: 34 },
    });

    expect(result.contractual).toMatchObject({ chcT: 33.33, chcG: 20, expectedG: 60, openOverdueCount: 4, breachRate: 66.67, spiH: 0.33, drcDays: 21 });
    expect(result.financial).toMatchObject({ evCostUf: 410, cpiH: 0.1317, costPerAcceptedMilestoneUf: 1557, eacFloorUf: 4754, eacCeilingUf: 15570, vacFloorUf: -2704, vacCeilingUf: -13520, terminalMarginFloorPct: 42.02, terminalMarginCeilingPct: -89.88 });
    expect(result.exposure).toEqual({ acceptedBillingPct: 45, mismatchPp: 25, retainedUf: 2870 });
    expect(result.governance).toMatchObject({ jiraBiasPp: 22.67, ige: 14.67, state: "CRITICO" });
    expect(result.governance.activeTriggers).toEqual(["G-01", "G-02", "G-03", "G-04", "G-05", "G-06", "G-07"]);
  });
});
