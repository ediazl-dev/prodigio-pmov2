/**
 * Tests del arreglo `portfolio` del motor: una fila por proyecto, para la
 * lista del portafolio. Los tests de la lectura agregada viven en
 * `executivePortfolio.test.ts` y no se tocan.
 */

import { describe, expect, it } from "vitest";
import { buildExecutivePortfolio, type ExecutivePortfolioInput } from "./executivePortfolio";

function baseInput(overrides: Partial<ExecutivePortfolioInput> = {}): ExecutivePortfolioInput {
  return {
    cutOffDate: "2026-09-18",
    generatedAt: "2026-09-18T13:00:00Z",
    projects: [
      { id: 1, projectName: "Nexos SFA", clientName: "Prodigio Tech", dealId: "PMO-360001", projectType: "desarrollo", status: "activo", currentStage: "design", pmId: 10, totalAmount: "120000", currency: "usd", startDate: "2026-05-01", endDate: null, origin: "linked" },
      { id: 2, projectName: "CCLA SRP MVP1", clientName: "CCLA", dealId: "PMO-2670001", projectType: "integracion", status: "activo", currentStage: "planning", pmId: null, totalAmount: null, currency: null, startDate: "2026-08-01", endDate: null, origin: "platform" },
      { id: 3, projectName: "MaxAgro Assessment", clientName: "MaxAgro", dealId: "PMO-300001", projectType: "data", status: "completado", currentStage: "closure", pmId: 10, totalAmount: "552", currency: "UF", startDate: "2026-02-01", endDate: "2026-06-01" },
      { id: 4, projectName: "Ruta Pass", clientName: "RUTA PASS", dealId: "PMO-210001", projectType: "otro", status: "pausado", currentStage: "risks", pmId: 11, totalAmount: "9000", currency: "USD", startDate: null, endDate: null },
    ],
    compliance: [
      { projectId: 1, projectName: "Nexos SFA", stageId: "design", status: "in_progress", daysUsed: 21, totalAllowed: 18 },
      { projectId: 1, projectName: "Nexos SFA", stageId: "sow", status: "on_time", daysUsed: 7, totalAllowed: 10 },
      { projectId: 1, projectName: "Nexos SFA", stageId: "jira", status: "on_time", daysUsed: 3, totalAllowed: 5 },
      { projectId: 2, projectName: "CCLA SRP MVP1", stageId: "planning", status: "in_progress", daysUsed: 4, totalAllowed: 12 },
      { projectId: 3, projectName: "MaxAgro Assessment", stageId: "sow", status: "on_time", daysUsed: 8, totalAllowed: 10 },
      { projectId: 3, projectName: "MaxAgro Assessment", stageId: "risks", status: "late", daysUsed: 14, totalAllowed: 8 },
    ],
    deadlines: [
      { stageId: "sow", maxBusinessDays: 10, label: "SoW" },
      { stageId: "jira", maxBusinessDays: 5, label: "Jira" },
      { stageId: "risks", maxBusinessDays: 8, label: "Riesgos" },
      { stageId: "planning", maxBusinessDays: 12, label: "Planificación" },
      { stageId: "design", maxBusinessDays: 18, label: "Avance" },
      { stageId: "closure", maxBusinessDays: 6, label: "Cierre" },
    ],
    extensions: [],
    risks: [
      { projectId: 1, status: "abierto", impact: "alto", probability: "alta", mitigation: null, confirmed: true },
      { projectId: 1, status: "abierto", impact: "alto", probability: "media", mitigation: "Plan B", confirmed: true },
      { projectId: 1, status: "cerrado", impact: "alto", probability: "alta", mitigation: null, confirmed: true },
      { projectId: 1, status: "abierto", impact: "alto", probability: "alta", mitigation: null, confirmed: false },
      { projectId: 2, status: "abierto", impact: "medio", probability: "alta", mitigation: null, confirmed: true },
    ],
    milestones: [],
    lessons: [],
    users: [
      { id: 10, name: "Eugenio Díaz" },
      { id: 11, name: "Otro PM" },
    ],
    ...overrides,
  };
}

describe("portfolio · cobertura", () => {
  it("incluye TODOS los proyectos, no solo los activos", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    expect(portfolio).toHaveLength(4);
    expect(portfolio.map(row => row.status).sort()).toEqual(["activo", "activo", "completado", "pausado"]);
  });

  it("respeta el orden de entrada: filtrar y ordenar es trabajo de la UI", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    expect(portfolio.map(row => row.projectId)).toEqual([1, 2, 3, 4]);
  });
});

describe("portfolio · etapa", () => {
  it("cuenta las etapas efectivamente cerradas, no la posición del cursor", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    const nexos = portfolio.find(row => row.projectId === 1);
    // Está en "Avance" (índice 4) pero solo tiene 2 etapas cerradas.
    expect(nexos?.stageIndex).toBe(4);
    expect(nexos?.stagesClosed).toBe(2);
    expect(nexos?.closedStageIds).toEqual(["sow", "jira"]);
    expect(nexos?.totalStages).toBe(6);
  });

  it("usa la etiqueta configurada en stage_deadlines", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    expect(portfolio.find(row => row.projectId === 1)?.stageLabel).toBe("Avance");
    expect(portfolio.find(row => row.projectId === 4)?.stageLabel).toBe("Riesgos");
  });
});

describe("portfolio · plazo", () => {
  it("expone días usados y permitidos de la etapa en curso", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    const nexos = portfolio.find(row => row.projectId === 1);
    expect(nexos).toMatchObject({ daysUsed: 21, daysAllowed: 18, overDays: 3, deadlineState: "overdue" });
  });

  it("marca al día lo que va por debajo del 80% de su plazo", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    expect(portfolio.find(row => row.projectId === 2)?.deadlineState).toBe("on_track");
  });

  it("un proyecto cerrado no tiene plazo vigente: not_applicable, no «al día»", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    const maxagro = portfolio.find(row => row.projectId === 3);
    expect(maxagro?.deadlineState).toBe("not_applicable");
    expect(maxagro?.daysUsed).toBeNull();
    expect(maxagro?.overDays).toBeNull();
  });

  it("un proyecto pausado sin etapa en curso queda sin medir, no al día", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    const ruta = portfolio.find(row => row.projectId === 4);
    expect(ruta?.deadlineState).toBe("no_deadline");
    expect(ruta?.daysUsed).toBeNull();
  });
});

describe("portfolio · PM, monto y riesgos", () => {
  it("resuelve el nombre del PM y distingue el no asignado", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    expect(portfolio.find(row => row.projectId === 1)?.pmName).toBe("Eugenio Díaz");
    expect(portfolio.find(row => row.projectId === 2)?.pmName).toBeNull();
    expect(portfolio.find(row => row.projectId === 2)?.pmId).toBeNull();
  });

  it("un monto ausente se marca como ausente, no como cero", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    const ccla = portfolio.find(row => row.projectId === 2);
    expect(ccla?.amount).toBeNull();
    expect(ccla?.currency).toBeNull();
    expect(ccla?.amountMissing).toBe(true);
  });

  it("usa la suma de hitos como monto contratado sólo cuando comparten moneda", () => {
    const result = buildExecutivePortfolio(baseInput({
      projects: [baseInput().projects[1]],
      milestones: [
        { projectId: 2, status: "planned", dueDate: null, completedAt: null, amount: "300", currency: "UF" },
        { projectId: 2, status: "invoiced", dueDate: null, completedAt: null, amount: "700", currency: "UF" },
      ],
    })).portfolio[0];
    expect(result).toMatchObject({ amount: 1000, currency: "UF", amountSource: "billing_milestones" });
  });

  it("no suma hitos de monedas distintas", () => {
    const result = buildExecutivePortfolio(baseInput({
      projects: [baseInput().projects[1]],
      milestones: [
        { projectId: 2, status: "planned", dueDate: null, completedAt: null, amount: "300", currency: "UF" },
        { projectId: 2, status: "planned", dueDate: null, completedAt: null, amount: "700", currency: "USD" },
      ],
    })).portfolio[0];
    expect(result).toMatchObject({ amount: null, currency: null, amountSource: "missing", amountMissing: true });
  });

  it("normaliza la moneda a mayúsculas", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    expect(portfolio.find(row => row.projectId === 1)?.currency).toBe("USD");
  });

  it("cuenta solo los riesgos confirmados de impacto alto que siguen abiertos", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    expect(portfolio.find(row => row.projectId === 1)?.highRisksOpen).toBe(2);
    expect(portfolio.find(row => row.projectId === 2)?.highRisksOpen).toBe(0);
  });

  it("conserva el origen para distinguir un proyecto vinculado a Jira", () => {
    const { portfolio } = buildExecutivePortfolio(baseInput());
    expect(portfolio.find(row => row.projectId === 1)?.origin).toBe("linked");
    expect(portfolio.find(row => row.projectId === 2)?.origin).toBe("platform");
    // Un proyecto sin `origin` en la fuente no revienta.
    expect(portfolio.find(row => row.projectId === 3)?.origin).toBeNull();
  });

  it("resuelve un proyecto Jira vinculado sin confundir la fase operativa con el pipeline PMO", () => {
    const tanner = buildExecutivePortfolio(baseInput({
      projects: [{
        id: 180002,
        projectName: "[PMO Banco Tanner] - Implementacion SFA - Deal 1934",
        clientName: "Banco Tanner",
        dealId: null,
        projectType: "desarrollo",
        status: "activo",
        currentStage: "design",
        pmId: null,
        totalAmount: null,
        currency: null,
        startDate: null,
        endDate: null,
        origin: "linked",
        jiraProjectKey: "PBTISD1",
      }],
      compliance: [],
      risks: [],
      financial: [{
        dealId: "Deal1934",
        projectName: "Banco Tanner",
        clientName: "Banco Tanner",
        pm: "Eduardo Mercado",
        estadoProyecto: "Activo",
        valorVentaUF: "8200",
        syncedAt: "2026-09-18T21:48:00Z",
      }],
      jiraSnapshots: [{
        projectId: 180002,
        jiraProjectKey: "PBTISD1",
        status: "success",
        operationalPhase: "Construcción + QA",
        executiveStatus: "Rojo | Crítico",
        financialStatus: "Sin desviación",
        advanceReportedPct: 31,
        projectManagerName: "Eduardo Mercado",
        milestonesTotal: 10,
        milestonesFulfilled: 8,
        milestonesPending: 2,
        risksTotal: 26,
        risksOpen: 23,
        risksHighPriorityOpen: 12,
        sourceUpdatedAt: "2026-09-18T15:00:00Z",
        capturedAt: "2026-09-18T16:00:00Z",
        lastSuccessAt: "2026-09-18T16:00:00Z",
        errorCode: null,
      }],
    })).portfolio[0];

    expect(tanner).toMatchObject({
      dealId: "Deal1934",
      stageId: "design",
      stageLabel: "Avance",
      deadlineReason: "missing_stage_opening",
      operationalPhase: "Construcción + QA",
      operationalProgressPct: 31,
      pmName: "Eduardo Mercado",
      amount: 8200,
      currency: "UF",
      amountSource: "financial_data",
      openRisks: 23,
      highRisksOpen: 12,
      milestonesTotal: 10,
      milestonesFulfilled: 8,
    });
  });
});

describe("portfolio · coherencia con la lectura agregada", () => {
  it("las filas vencidas coinciden con el contador del titular", () => {
    const result = buildExecutivePortfolio(baseInput());
    const overdueRows = result.portfolio.filter(row => row.deadlineState === "overdue").length;
    expect(overdueRows).toBe(result.headline.stagesOverdue);
  });

  it("los activos del portafolio coinciden con los de la cola de atención", () => {
    const result = buildExecutivePortfolio(baseInput());
    const activeRows = result.portfolio.filter(row => row.status === "activo").map(row => row.projectId).sort();
    expect(activeRows).toEqual(result.attention.map(row => row.projectId).sort());
  });
});
