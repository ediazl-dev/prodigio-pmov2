import { describe, expect, it } from "vitest";
import { buildProjectExecutiveSummary } from "./ProjectExecutiveSummary";

const portfolioEvidence = {
  operationalPhase: "Construcción + QA",
  operationalProgressPct: 31,
  stageLabel: "Avance Proyecto",
  stagesClosed: 4,
  totalStages: 6,
  pmName: "Eduardo Mercado",
  executiveHealth: "CRITICO",
  milestonesFulfilled: 8,
  milestonesTotal: 10,
  openRisks: 23,
  highRisksOpen: 12,
  amount: 8200,
};

describe("ProjectExecutiveSummary — read model compacto", () => {
  it("usa Dashboard v2 y evidencia contractual cuando existe baseline aprobado", () => {
    const model = buildProjectExecutiveSummary({
      projectId: 180002,
      cutoffDate: "2026-09-23",
      linkedDashboard: {
        portfolioEvidence,
        financial: { projectFinancial: { valorVentaUF: 8200, utilizadoUF: 2378.17 } },
      },
      baseline: {
        source: { sourceStatus: "approved" },
        milestones: [{ id: 1, milestoneCode: "M01", title: "Kick Off", baselineDate: "2026-02-02", jiraDueDate: "2026-02-02", jiraClosedDate: "2026-02-04", semanticStatus: "fulfilled" }],
      },
      executiveDashboard: {
        contractual: { milestones: [{ milestoneCode: "M01", acceptanceStatus: "accepted", acceptedAt: "2026-02-02", acceptanceFileName: "Acta M01.pdf" }] },
        projectFinance: {
          source: "financial_sync",
          capturedAt: "2026-09-23T00:00:00.000Z",
          overview: { contractedUf: 8200 },
          costs: { consumedUf: 2378.17, budgetUf: 2050, projectedCostUf: 5169.94, capacityProjectedUf: 2714.41 },
          margin: { projectedUf: 3030.06, projectedPct: 0.37 },
          billing: { billedUf: 1200, collectedUf: 800, wipUf: 3690, backlogUf: 4510 },
          milestones: [{ milestoneCode: "M01", amountUf: 3280 }],
        },
      },
    });

    expect(model.dashboardPath).toBe("/projects/180002/executive-dashboard-v2");
    expect(model.dashboardMode).toBe("contractual_v2");
    expect(model.financial.contractedUf).toBe(8200);
    expect(model.financial.billedUf).toBe(1200);
    expect(model.milestones).toEqual([
      expect.objectContaining({ code: "M01", amountUf: 3280, status: "accepted", statusLabel: "Aceptado", evidence: "Acta M01.pdf" }),
    ]);
  });

  it("abre el dashboard histórico en Caja Los Andes y no inventa aceptación desde un hito financiero", () => {
    const model = buildProjectExecutiveSummary({
      projectId: 330001,
      cutoffDate: "2026-09-23",
      linkedDashboard: {
        portfolioEvidence: { ...portfolioEvidence, milestonesFulfilled: 2, milestonesTotal: 3 },
        financial: { projectFinancial: { valorVentaUF: 5147.06, presupuestoUF: 2400, utilizadoUF: 2100, margenProyectadoPorc: 0.21, syncedAt: "2026-09-23T06:15:00.000Z" } },
      },
      baseline: null,
      billingMilestones: [
        { id: 7, milestoneNumber: 1, description: "Hito inicial", amount: "900", currency: "UF", dueDate: "2026-08-30", status: "facturado", invoiceNumber: "FV-123" },
        { id: 8, milestoneNumber: 2, description: "Hito pendiente", amount: "1000", currency: "CLP", dueDate: "2026-09-30", status: "pendiente" },
      ],
    });

    expect(model.dashboardPath).toBe("/projects/330001/linked-dashboard");
    expect(model.dashboardMode).toBe("historical");
    expect(model.financialCutoff).toBe("2026-09-23T06:15:00.000Z");
    expect(model.milestoneDetailSource).toBe("billing");
    expect(model.milestones[0]).toEqual(expect.objectContaining({ code: "H01", amountUf: 900, status: "billed", statusLabel: "Marcado como facturado" }));
    expect(model.milestones[1]).toEqual(expect.objectContaining({ amountUf: null, status: "pending" }));
    expect(model.milestones.some((milestone) => milestone.status === "accepted")).toBe(false);
  });

  it("mantiene N/D cuando Staffing no tiene evidencia financiera ni detalle de hitos", () => {
    const model = buildProjectExecutiveSummary({
      projectId: 510001,
      linkedDashboard: { portfolioEvidence: { ...portfolioEvidence, amount: null, milestonesFulfilled: null, milestonesTotal: null }, financial: { projectFinancial: null } },
      baseline: null,
      billingMilestones: [],
    });

    expect(model.financial.contractedUf).toBeNull();
    expect(model.financial.consumedUf).toBeNull();
    expect(model.financial.billedUf).toBeNull();
    expect(model.milestoneDetailSource).toBe("counts_only");
    expect(model.milestones).toEqual([]);
  });
});
