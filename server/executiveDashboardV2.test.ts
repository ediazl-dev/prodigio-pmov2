import { describe, expect, it } from "vitest";
import { calculateContractualProgress, calculateExecutiveSemaphore, normalizeExecutiveMilestoneStatus } from "./executiveDashboardV2";

describe("Dashboard Ejecutivo v2 — evidencia contractual", () => {
  it("prioriza el nombre de estado contractual por sobre statusCategory de Jira", () => {
    expect(normalizeExecutiveMilestoneStatus("Cumplido (Entregable)", "2026-02-02", new Date("2026-08-18"))).toBe("fulfilled");
  });

  it("calcula avance ponderado del SoW y detecta hitos atrasados", () => {
    const progress = calculateContractualProgress([
      { billingWeight: "40.00", jiraStatusName: "Cumplido (Entregable)", jiraDueDate: "2026-02-02" },
      { billingWeight: "5.00", jiraStatusName: "Cumplido (Entregable)", jiraDueDate: "2026-03-20" },
      { billingWeight: "5.00", jiraStatusName: "Retrasado", jiraDueDate: "2026-07-27" },
      { billingWeight: "50.00", jiraStatusName: "Pendiente", jiraDueDate: "2026-10-09" },
    ], new Date("2026-08-18"));
    expect(progress).toMatchObject({ totalWeight: 100, fulfilledWeight: 45, progressPct: 45, delayedCount: 1, overduePendingCount: 0 });
    expect(calculateExecutiveSemaphore(progress, 103.1)).toBe("ROJO");
  });

  it("marca como atrasado un pendiente vencido aun sin statusCategory confiable", () => {
    expect(normalizeExecutiveMilestoneStatus("Pendiente", "2026-08-03", new Date("2026-08-18"))).toBe("delayed");
  });
});
