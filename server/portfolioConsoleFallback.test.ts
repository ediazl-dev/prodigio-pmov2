import { describe, expect, it } from "vitest";
import type { PortfolioRow } from "./executivePortfolio";
import { buildPortfolioConsoleFallback, normalizePortfolioConsoleState } from "./portfolioConsoleModel";

function row(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    projectId: 180002,
    projectName: "Tanner Deal 1934",
    clientName: "Banco Tanner",
    dealId: "Deal1934",
    projectType: "desarrollo",
    origin: "linked",
    status: "activo",
    stageId: "design",
    stageLabel: "Avance",
    stageIndex: 4,
    totalStages: 6,
    stagesClosed: 0,
    closedStageIds: [],
    daysUsed: null,
    daysAllowed: null,
    overDays: null,
    deadlineState: "no_deadline",
    deadlineReason: "missing_stage_opening",
    pmId: null,
    pmKey: "name:eduardo mercado",
    pmName: "Eduardo Mercado",
    pmSource: "jira_snapshot",
    amount: 8200,
    currency: "UF",
    amountMissing: false,
    amountSource: "financial_data",
    highRisksOpen: 12,
    openRisks: 23,
    riskSource: "jira_snapshot",
    operationalPhase: "Construcción + QA",
    operationalPhaseSource: "jira_snapshot",
    operationalProgressPct: 31,
    executiveHealth: "Rojo | Crítico",
    jiraEvidenceStatus: "success",
    jiraEvidenceAvailability: "available",
    jiraEvidenceAt: "2026-09-19T04:00:00.000Z",
    jiraSourceUpdatedAt: "2026-09-19T03:55:00.000Z",
    jiraEvidenceStale: false,
    milestonesTotal: 10,
    milestonesFulfilled: 8,
    milestoneSource: "jira_snapshot",
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

const project = { id: 180002, projectName: "Tanner Deal 1934", clientName: "Banco Tanner" };

describe("Fallback Consola de Gobierno — fuentes certificadas", () => {
  it("normaliza la salud Jira sin tratarla como IGE", () => {
    const result = buildPortfolioConsoleFallback(project, row(), "PBTISD1");
    expect(result).toMatchObject({
      estado: "CRITICO",
      ige: null,
      jiraProgressPct: 31,
      pa: 100,
      pmName: "Eduardo Mercado",
      pmSource: "jira_snapshot",
      totalHitos: 10,
      hitosCumplidos: 8,
      openRisks: 23,
      highRisksOpen: 12,
      contractedAmount: 8200,
      contractedCurrency: "UF",
    });
  });

  it("devuelve POR_CONFIRMAR y PA N/D cuando no existe evidencia", () => {
    const result = buildPortfolioConsoleFallback(project, null, null);
    expect(result).toMatchObject({
      estado: "POR_CONFIRMAR",
      pa: null,
      ige: null,
      jiraProgressPct: null,
      ufEnRiesgo: null,
      evidenceMissing: true,
      requiereAtencion: true,
    });
  });

  it("bloquea una salud residual si el snapshot está stale", () => {
    const result = buildPortfolioConsoleFallback(project, row({
      jiraEvidenceAvailability: "stale",
      jiraEvidenceStale: true,
      executiveHealth: "Rojo",
    }), "OLD");
    expect(result.estado).toBe("POR_CONFIRMAR");
    expect(result.pa).toBeNull();
  });

  it("no llama exposición al monto contratado", () => {
    const result = buildPortfolioConsoleFallback(project, row(), "PBTISD1");
    expect(result.ufEnRiesgo).toBeNull();
    expect(result.contractedAmount).toBe(8200);
    expect(result.amountSource).toBe("financial_data");
  });

  it("normaliza estados y deja desconocidos como POR_CONFIRMAR", () => {
    expect(normalizePortfolioConsoleState("Rojo | Crítico")).toBe("CRITICO");
    expect(normalizePortfolioConsoleState("estable")).toBe("VERDE");
    expect(normalizePortfolioConsoleState("AZUL_RARO")).toBe("POR_CONFIRMAR");
    expect(normalizePortfolioConsoleState(null)).toBe("POR_CONFIRMAR");
  });
});
